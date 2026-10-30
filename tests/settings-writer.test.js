const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const file = path.resolve(__dirname, '../settings-writer.ts');
const mod = new Module(file, module);
mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file));
const codecFile=path.resolve(__dirname,'../cooperative-json.ts');
const codec=new Module(codecFile,module);codec.filename=codecFile;codec.paths=mod.paths;
codec._compile(ts.transpileModule(fs.readFileSync(codecFile,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,codecFile);
const originalRequire=mod.require.bind(mod);
mod.require=name=>name==='./cooperative-json'?codec.exports:originalRequire(name);
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText, file);
const { atomicSettingsWrite, SettingsWriter } = mod.exports;

for(const phase of ['create','write','close'])test('early lock '+phase+' failure preserves catalog and incomplete evidence',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-early-lock-')),target=path.join(dir,'data.json');
  fs.writeFileSync(target,'{"revision":0}');
  const writer=new SettingsWriter();await writer.loadAsync(target);
  const open=fs.openSync,write=fs.writeFileSync,close=fs.closeSync;let lockFd,snapshots=0;
  t.after(()=>{
    assert.equal(path.dirname(fs.realpathSync(dir)),fs.realpathSync(os.tmpdir()));
    assert(path.basename(dir).startsWith('autooc-early-lock-'));
    fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:50});
  });
  t.mock.method(fs,'openSync',(file,...args)=>{
    if(file===target+'.write-lock'&&phase==='create')throw Object.assign(new Error('injected lock create'),{code:'EIO'});
    const fd=open.call(fs,file,...args);if(file===target+'.write-lock')lockFd=fd;return fd;
  });
  t.mock.method(fs,'writeFileSync',(fd,...args)=>{
    if(fd===lockFd&&phase==='write') {write.call(fs,fd,'{');throw Object.assign(new Error('injected lock write'),{code:'EIO'});}
    return write.call(fs,fd,...args);
  });
  t.mock.method(fs,'closeSync',fd=>{close.call(fs,fd);if(fd===lockFd&&phase==='close')throw Object.assign(new Error('injected lock close'),{code:'EIO'});});
  await assert.rejects(writer.save(target,()=>{snapshots++;return {revision:1};}),/injected lock/);
  t.mock.restoreAll();
  assert.equal(snapshots,0);assert.equal(fs.readFileSync(target,'utf8'),'{"revision":0}');
  assert.equal(fs.existsSync(target+'.write-lock'),phase!=='create');
  if(phase==='write')assert.throws(()=>mod.exports.parseSettingsWriteLock(fs.readFileSync(target+'.write-lock','utf8')),/Incomplete/);
  if(phase==='close')assert.equal(mod.exports.parseSettingsWriteLock(fs.readFileSync(target+'.write-lock','utf8')).pid,process.pid);
});

for(const fallback of [false,true])test('large ASCII decoding avoids retaining all pieces alongside their joined duplicate'+(fallback?' without native isAscii':''),async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-ascii-')),target=path.join(dir,'data.json');
  const expected=('synthetic ASCII inert\n').repeat(1300000);fs.writeFileSync(target,expected);
  const join=Array.prototype.join,buffer=require('node:buffer'),isAscii=buffer.isAscii;
  if(fallback)buffer.isAscii=undefined;
  Array.prototype.join=function(...args){
    if(this.every(item=>typeof item==='string'))assert.ok(this.reduce((size,item)=>size+item.length,0)<=256*1024,'ASCII input must not retain pieces plus a second joined catalog');
    return join.apply(this,args);
  };
  let ticks=0;const timer=setInterval(()=>ticks++,1);
  try{assert.equal(await mod.exports.readSettingsTextAsync(target),expected);assert.ok(ticks>=2);}
  finally{Array.prototype.join=join;buffer.isAscii=isAscii;clearInterval(timer);fs.unlinkSync(target);fs.rmdirSync(dir);}
});

test('large multibyte input decoding yields in bounded byte slices and matches native UTF8 at boundaries',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-utf8-')),target=path.join(dir,'data.json');
  const bytes=Buffer.concat([Buffer.from('x'.repeat(262143)+'😀é'),Buffer.from([0xf0,0x80,0xff]),Buffer.from(('synthetic😀é\n').repeat(1200000)),Buffer.from([0xe2,0x82])]);
  const expected=bytes.toString('utf8'),decode=Buffer.prototype.toString;
  fs.writeFileSync(target,bytes);
  t.mock.method(Buffer.prototype,'toString',function(...args){assert.ok(this.length<=256*1024,`monolithic UTF8 decode: ${this.length}`);return decode.apply(this,args);});
  let ticks=0;const timer=setInterval(()=>ticks++,1);
  try{
    assert.equal(await mod.exports.readSettingsTextAsync(target),expected);
    assert.ok(ticks>=2,`input during UTF8 decode ${ticks}`);
  }finally{clearInterval(timer);fs.unlinkSync(target);fs.rmdirSync(dir);}
});

test('lock durability yields to input and precedes snapshot or publication',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-lock-durability-')),target=path.join(dir,'data.json');
  const sync=fs.fsync;
  let release,entered;
  const gate=new Promise(resolve=>{release=resolve;});
  const syncing=new Promise(resolve=>{entered=resolve;});
  let saving,snapshots=0;
  try{
    fs.writeFileSync(target,'{"revision":0}');
    const writer=new SettingsWriter();await writer.loadAsync(target);
    fs.fsync=function(descriptor,callback){
      entered();
      gate.then(()=>sync.call(this,descriptor,callback));
    };
    saving=writer.save(target,()=>{snapshots++;return {revision:1};});
    // The initial OS identity query precedes lock publication. The input-yield
    // assertion below measures the held fsync, independently of that startup.
    const reached=await Promise.race([syncing.then(()=>true),new Promise(resolve=>setTimeout(()=>resolve(false),10000))]);
    assert.equal(reached,true,'lock fsync must yield rather than block the input thread');
    let ticks=0;await new Promise(resolve=>setTimeout(()=>{ticks++;resolve();},5));
    assert.equal(ticks,1);
    assert.equal(snapshots,0,'snapshot waits for durable ownership');
    assert.match(JSON.parse(fs.readFileSync(target+'.write-lock','utf8')).token,/^[a-f0-9-]{36}$/,'token published before yielding');
    assert.equal(fs.readFileSync(target,'utf8'),'{"revision":0}');
    await assert.rejects(new SettingsWriter().save(target,()=>({foreign:true})),e=>e.code==='EEXIST');
    release();await saving;
    assert.equal(snapshots,1);assert.deepEqual(JSON.parse(fs.readFileSync(target)),{revision:1});
    assert.equal(fs.existsSync(target+'.write-lock'),false);
  }finally{
    release();await saving?.catch(()=>{});fs.fsync=sync;
    if(fs.existsSync(target))fs.unlinkSync(target);fs.rmdirSync(dir);
  }
});

test('failed asynchronous lock flush preserves prior bytes and ownership without taking a snapshot',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-lock-flush-error-')),target=path.join(dir,'data.json');
  const sync=fs.fsync;
  let snapshots=0;
  try{
    fs.writeFileSync(target,'{"revision":0}');
    const writer=new SettingsWriter();await writer.loadAsync(target);
    fs.fsync=(_descriptor,callback)=>setImmediate(()=>callback(Object.assign(new Error('synthetic flush failure'),{code:'EIO'})));
    await assert.rejects(writer.save(target,()=>{snapshots++;return {revision:1};}),/synthetic flush failure/);
    await assert.rejects(writer.drain(),/synthetic flush failure/);
    assert.equal(snapshots,0);
    assert.equal(fs.readFileSync(target,'utf8'),'{"revision":0}');
    assert.match(JSON.parse(fs.readFileSync(target+'.write-lock','utf8')).token,/^[a-f0-9-]{36}$/);
  }finally{
    fs.fsync=sync;
    if(fs.existsSync(target+'.write-lock'))fs.unlinkSync(target+'.write-lock');
    fs.unlinkSync(target);fs.rmdirSync(dir);
  }
});

test('large catalog load processes input timers before publishing the catalog',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-responsive-load-')),target=path.join(dir,'data.json');
  try{
    const payload='synthetic\\\n😀'.repeat(1500000);
    fs.writeFileSync(target,JSON.stringify({payload}));
    let ticks=0;const timer=setInterval(()=>ticks++,1);
    try{
      const writer=new SettingsWriter();
      const loaded=await (writer.loadAsync ? writer.loadAsync(target) : writer.load(target));
      assert.equal(loaded.payload,payload);
      assert.ok(ticks>=2,`input timers during load: ${ticks}`);
    }finally{clearInterval(timer);}
  }finally{fs.unlinkSync(target);fs.rmdirSync(dir);}
});

test('async loads are ordered with saves and rejected publication cannot advance the observed version',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-async-order-')),target=path.join(dir,'data.json');
  try{
    fs.writeFileSync(target,'{"revision":0}');
    const writer=new SettingsWriter();await writer.loadAsync(target);
    const saving=writer.save(target,()=>({revision:1}));
    const loading=writer.loadAsync(target);
    await saving;assert.deepEqual(await loading,{revision:1});
    fs.writeFileSync(target,'{"revision":2,"external":"keep"}');
    await assert.rejects(writer.loadAsync(target,()=>false),/changed while loading/);
    await assert.rejects(writer.save(target,()=>({revision:3})),/changed externally/);
    assert.deepEqual(JSON.parse(fs.readFileSync(target)),{revision:2,external:'keep'});
  }finally{fs.unlinkSync(target);fs.rmdirSync(dir);}
});

test('confirmed versions require current bytes and accepted publication before advancing a baseline',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-confirmed-')),target=path.join(dir,'data.json');
  try{
    fs.writeFileSync(target,'{"revision":0}');
    const first=new SettingsWriter(),second=new SettingsWriter();await first.loadAsync(target);await second.loadAsync(target);
    await first.save(target,()=>({revision:1}));const version=first.confirmedVersion(target);
    await assert.rejects(second.adoptConfirmed(target,version,()=>false),/changed while loading/);
    await assert.rejects(second.save(target,()=>({stale:true})),/changed externally/);
    await second.adoptConfirmed(target,version,()=>true);
    await second.save(target,()=>({revision:2}));
    await assert.rejects(second.adoptConfirmed(target,version,()=>true),/changed externally/);
    assert.deepEqual(JSON.parse(fs.readFileSync(target)),{revision:2});
  }finally{fs.unlinkSync(target);fs.rmdirSync(dir);}
});

test('a catalog disappearing after lstat is a conflict, never an absent-file default',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-read-race-')),target=path.join(dir,'data.json');
  const open=fs.promises.open;
  try{
    fs.writeFileSync(target,'{"preserved":true}');
    fs.promises.open=async function(file,...args){
      if(path.resolve(file)===target && args[0]==='r')fs.unlinkSync(target);
      return open.call(this,file,...args);
    };
    await assert.rejects(new SettingsWriter().loadAsync(target),/changed while reading/);
  }finally{fs.promises.open=open;if(fs.existsSync(target))fs.unlinkSync(target);fs.rmdirSync(dir);}
});

test('asynchronous byte reads reject a file changed before validation without adopting its version',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-byte-read-race-')),target=path.join(dir,'data.json');
  const open=fs.promises.open;
  try{
    fs.writeFileSync(target,'{"revision":0}');
    const writer=new SettingsWriter();
    fs.promises.open=async function(file,...args){
      const handle=await open.call(this,file,...args);
      if(file===target && args[0]==='r'){
        const read=handle.read.bind(handle);
        handle.read=async(...readArgs)=>{const bytes=await read(...readArgs);fs.writeFileSync(target,'{"external":"preserved new revision"}');return bytes;};
      }
      return handle;
    };
    await assert.rejects(writer.loadAsync(target),/changed while reading/);
    assert.throws(()=>writer.confirmedVersion(target),/no confirmed version/);
    assert.deepEqual(JSON.parse(fs.readFileSync(target)),{external:'preserved new revision'});
  }finally{fs.promises.open=open;fs.unlinkSync(target);fs.rmdirSync(dir);}
});

test('cached reads and forked writers isolate local edits and detect external bytes',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-cache-')),target=path.join(dir,'data.json');
  try{
    fs.writeFileSync(target,JSON.stringify({nested:{name:'original'},payload:'synthetic'.repeat(10000)}));
    const writer=new SettingsWriter(),first=await writer.loadAsync(target);
    first.nested.name='unsaved';
    assert.equal((await writer.loadAsync(target)).nested.name,'original');
    const fork=writer.fork(),forked=await fork.loadAsync(target);forked.nested.name='private-fork';
    assert.equal((await writer.loadAsync(target)).nested.name,'original');
    fs.writeFileSync(target,'{"nested":{"name":"external"},"unknown":"keep"}');
    assert.deepEqual(await fork.loadAsync(target),{nested:{name:'external'},unknown:'keep'});
    await assert.rejects(writer.save(target,()=>first),/changed externally/);
    assert.equal(JSON.parse(fs.readFileSync(target)).unknown,'keep');
  }finally{fs.unlinkSync(target);fs.rmdirSync(dir);}
});

test('streamed saves capture one immutable snapshot while later edits queue another',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-stream-snapshot-')),target=path.join(dir,'data.json');
  const rename=fs.promises.rename,states=[];
  try{
    const writer=new SettingsWriter(),state={payload:'synthetic'.repeat(1000000),nested:{revision:1}};
    fs.promises.rename=async function(from,to){await rename.call(this,from,to);if(to===target)states.push(JSON.parse(fs.readFileSync(target)).nested.revision);};
    let queued;const later=new Promise(resolve=>{queued=resolve;});
    const first=writer.save(target,()=>{setImmediate(()=>{state.nested.revision=2;queued(writer.save(target,()=>state));});return state;});
    await first;await later;
    assert.deepEqual(states,[1,2]);assert.equal(JSON.parse(fs.readFileSync(target)).nested.revision,2);
  }finally{fs.promises.rename=rename;if(fs.existsSync(target))fs.unlinkSync(target);fs.rmdirSync(dir);}
});

test('streamed Unicode bytes and confirmed hashes agree with native JSON at chunk boundaries',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-stream-unicode-')),target=path.join(dir,'data.json');
  try{
    const value={['😀'.repeat(40000)]:('x'.repeat(16383)+'😀\\\n\ud800').repeat(20)};
    const writer=new SettingsWriter();await writer.save(target,()=>value);
    const expected=JSON.stringify(value,null,2);
    assert.equal(fs.readFileSync(target,'utf8'),expected);
    assert.equal(writer.confirmedVersion(target).textHash,require('node:crypto').createHash('sha256').update(expected).digest('hex'));
    assert.deepEqual(await writer.loadAsync(target),value);
    assert.deepEqual(await new SettingsWriter().loadAsync(target),value);
  }finally{fs.unlinkSync(target);fs.rmdirSync(dir);}
});

test('external edits during cooperative preparation are preserved and require reload',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-async-edit-')),target=path.join(dir,'data.json');
  try{
    fs.writeFileSync(target,'{"revision":0}');
    const writer=new SettingsWriter();await writer.loadAsync(target);
    let edit;
    const saving=writer.save(target,()=>{
      edit=setImmediate(()=>fs.writeFileSync(target,'{"external":"keep"}'));
      return {payload:'synthetic'.repeat(3000000)};
    });
    await assert.rejects(saving,/changed during preparation|changed while reading/);
    assert.deepEqual(JSON.parse(fs.readFileSync(target)),{external:'keep'});
    await assert.rejects(writer.save(target,()=>({stale:true})),/changed externally/);
    clearImmediate(edit);
    assert.deepEqual(fs.readdirSync(dir),['data.json']);
  }finally{fs.unlinkSync(target);fs.rmdirSync(dir);}
});

test('a foreign replacement lock during preparation prevents publication and is preserved',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-async-owner-')),target=path.join(dir,'data.json');
  try{
    fs.writeFileSync(target,'{"revision":0}');
    const writer=new SettingsWriter();await writer.loadAsync(target);
    const saving=writer.save(target,()=>{
      setImmediate(()=>fs.writeFileSync(target+'.write-lock','foreign-token'));
      return {payload:'synthetic'.repeat(3000000)};
    });
    await assert.rejects(saving,/lock ownership changed/);
    assert.equal(fs.readFileSync(target,'utf8'),'{"revision":0}');
    assert.equal(fs.readFileSync(target+'.write-lock','utf8'),'foreign-token');
  }finally{fs.unlinkSync(target+'.write-lock');fs.unlinkSync(target);fs.rmdirSync(dir);}
});

test('large unchanged catalogs avoid repeated JSON conversion on load and save', async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-large-settings-')),target=path.join(dir,'data.json');
  const payload='large-catalog-'.repeat(100000),initial={payload,revision:0};
  fs.writeFileSync(target,JSON.stringify(initial,null,2));
  const parse=JSON.parse,stringify=JSON.stringify;
  let parsedBytes=0,serializedBytes=0;
  JSON.parse=function(text,...args){if(typeof text==='string'&&text.includes(payload))parsedBytes+=text.length;return parse.call(this,text,...args);};
  JSON.stringify=function(value,...args){const text=stringify.call(this,value,...args);if(text?.includes(payload))serializedBytes+=text.length;return text;};
  try{
    const writer=new SettingsWriter(),loaded=writer.load(target);
    await writer.save(target,()=>({...loaded,revision:1}));
    assert.ok(parsedBytes < payload.length*1.1,`parsed ${parsedBytes} bytes for a ${payload.length}-byte catalog`);
    assert.ok(serializedBytes < payload.length*1.1,`serialized ${serializedBytes} bytes for a ${payload.length}-byte catalog`);
    assert.deepEqual(parse(fs.readFileSync(target,'utf8')),{payload,revision:1});
  } finally {JSON.parse=parse;JSON.stringify=stringify;fs.unlinkSync(target);fs.rmdirSync(dir);}
});

test('format-only external edits remain compatible, but changed data is rejected',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-format-settings-')),target=path.join(dir,'data.json');
  try{
    fs.writeFileSync(target,'{"revision":0,"unrelated":"keep"}');
    const writer=new SettingsWriter();writer.load(target);
    fs.writeFileSync(target,'{ "revision": 0, "unrelated": "keep" }');
    await writer.save(target,()=>({revision:1,unrelated:'keep'}));
    fs.writeFileSync(target,'{ "revision": 1, "unrelated": "external" }');
    await assert.rejects(writer.save(target,()=>({revision:2,unrelated:'keep'})),/changed externally/);
    assert.equal(JSON.parse(fs.readFileSync(target)).unrelated,'external');
  }finally{fs.unlinkSync(target);fs.rmdirSync(dir);}
});

test('Windows replacement retries transient denial without repeating serialization', {skip:process.platform !== 'win32'}, async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-retry-')),target=path.join(dir,'data.json');
  try {
    fs.writeFileSync(target,'{"old":true}');let attempts=0;
    const io={...fs.promises,rename:async(...args)=>{if(++attempts<3)throw Object.assign(new Error('busy'),{code:'EPERM'});return fs.promises.rename(...args);}};
    await atomicSettingsWrite(target,{next:true},io);
    assert.equal(attempts,3);assert.deepEqual(JSON.parse(fs.readFileSync(target)),{next:true});
    assert.deepEqual(fs.readdirSync(dir),['data.json']);
  } finally {fs.unlinkSync(target);fs.rmdirSync(dir);}
});

test('Windows replacement preserves external changes and bounds permanent denial', {skip:process.platform !== 'win32'}, async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-retry-')),target=path.join(dir,'data.json');
  try {
    fs.writeFileSync(target,'{"old":true}');let attempts=0;
    const deny=async()=>{attempts++;throw Object.assign(new Error('denied'),{code:'EPERM'});};
    await assert.rejects(atomicSettingsWrite(target,{next:true},{...fs.promises,rename:deny}),{code:'EPERM'});
    assert.equal(attempts,5);assert.equal(fs.readFileSync(target,'utf8'),'{"old":true}');
    await assert.rejects(atomicSettingsWrite(target,{next:true},{...fs.promises,rename:async()=>{fs.writeFileSync(target,'{"external":true}');return deny();}}),/changed during replacement/);
    assert.equal(fs.readFileSync(target,'utf8'),'{"external":true}');assert.deepEqual(fs.readdirSync(dir),['data.json']);
  } finally {fs.unlinkSync(target);fs.rmdirSync(dir);}
});

test('failed replacement preserves valid previous settings and cleans its temp file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autooc-settings-'));
  const target = path.join(dir, 'data.json');
  fs.writeFileSync(target, '{"previous":true}');
  const io = {...fs.promises, rename:async()=>{throw Error('disk unavailable');}};
  await assert.rejects(atomicSettingsWrite(target, {next:true}, io), /disk unavailable/);
  assert.deepEqual(JSON.parse(fs.readFileSync(target)), {previous:true});
  assert.deepEqual(fs.readdirSync(dir), ['data.json']);
  fs.unlinkSync(target); fs.rmdirSync(dir);
});

test('partial disk write preserves the original file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autooc-settings-'));
  const target = path.join(dir, 'data.json');
  fs.writeFileSync(target, '{"previous":true}');
  const io = {...fs.promises, open:async(...args)=>{
    const h=await fs.promises.open(...args);
    return {writeFile:async()=>{await h.writeFile('{');throw Error('ENOSPC');},sync:()=>h.sync(),close:()=>h.close()};
  }};
  await assert.rejects(atomicSettingsWrite(target, {next:true}, io), /ENOSPC/);
  assert.deepEqual(JSON.parse(fs.readFileSync(target)), {previous:true});
  assert.deepEqual(fs.readdirSync(dir), ['data.json']);
  fs.unlinkSync(target); fs.rmdirSync(dir);
});

test('ordered saves recover after failure and leave the latest complete state', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autooc-settings-'));
  const target = path.join(dir, 'data.json');
  const writer = new SettingsWriter();
  const failed = writer.save(target, ()=>{throw Error('snapshot failed');});
  const first = writer.save(target, ()=>({revision:1}));
  const last = writer.save(target, ()=>({revision:2}));
  await assert.rejects(failed, /snapshot failed/);
  await Promise.all([first,last]);
  assert.deepEqual(JSON.parse(fs.readFileSync(target)), {revision:2});
  fs.unlinkSync(target); fs.rmdirSync(dir);
});

test('independent writers reject stale snapshots until an explicit reload',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-conflict-')),target=path.join(dir,'data.json');
  try {
    fs.writeFileSync(target,JSON.stringify({revision:0,unrelated:'preserve'}));
    const first=new SettingsWriter(),second=new SettingsWriter();
    assert.deepEqual(first.load(target),second.load(target));
    await first.save(target,()=>({revision:1,unrelated:'new external value'}));
    await assert.rejects(second.save(target,()=>({revision:2,unrelated:'old value'})),/changed externally/);
    assert.equal(JSON.parse(fs.readFileSync(target)).unrelated,'new external value');
    const reloaded=second.load(target);await second.save(target,()=>({...reloaded,revision:2}));
    assert.deepEqual(JSON.parse(fs.readFileSync(target)),{revision:2,unrelated:'new external value'});
    assert.deepEqual(fs.readdirSync(dir),['data.json']);
  } finally {fs.unlinkSync(target);fs.rmdirSync(dir);}
});

test('writer refuses a lock from another process and preserves its evidence',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-lock-')),target=path.join(dir,'data.json'),lock=target+'.write-lock';
  try {
    fs.writeFileSync(target,'{"value":"previous"}');
    const {spawnSync}=require('node:child_process');
    const result=spawnSync(process.execPath,['-e','require("node:fs").writeFileSync(process.argv[1],"other-owner",{flag:"wx"});',lock],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const writer=new SettingsWriter();writer.load(target);
    await assert.rejects(writer.save(target,()=>({value:'replacement'})),{code:'EEXIST'});
    assert.equal(fs.readFileSync(lock,'utf8'),'other-owner');assert.equal(fs.readFileSync(target,'utf8'),'{"value":"previous"}');
  } finally {fs.unlinkSync(lock);fs.unlinkSync(target);fs.rmdirSync(dir);}
});

test('missing-file baseline detects creation by another writer and invalid JSON is not overwritten',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-baseline-')),target=path.join(dir,'data.json');
  try {
    const writer=new SettingsWriter();assert.equal(writer.load(target),null);
    fs.writeFileSync(target,'{"created":"externally"}');
    await assert.rejects(writer.save(target,()=>({lost:true})),/changed externally/);
    fs.writeFileSync(target,'{"private":"do-not-echo');
    await assert.rejects(writer.save(target,()=>({lost:true})),error=>error.message==='Cannot read valid AutoOC configuration');
    assert.equal(fs.readFileSync(target,'utf8'),'{"private":"do-not-echo');
    assert.deepEqual(fs.readdirSync(dir),['data.json']);
  } finally {fs.unlinkSync(target);fs.rmdirSync(dir);}
});

// A resolved I/O promise can keep the microtask queue busy even when the
// filesystem API is async. This double models a hot local file deterministically.
function immediateCatalog(t, bytes, options={}) {
  const state={offset:0,closed:false,inputAt:null,clock:0,stats:0,pathStats:0,buffers:new Set()};
  const stat={dev:1,ino:2,size:bytes.length,mtimeMs:3,ctimeMs:4,isFile:()=>true,isSymbolicLink:()=>false};
  t.mock.method(performance,'now',()=>state.clock);
  t.mock.method(fs.promises,'lstat',async()=>({...stat,...(++state.pathStats===1?options.pathStat:options.finalPathStat)}));
  t.mock.method(fs.promises,'open',async()=>({
    stat:async()=>{state.stats++;return {...stat,...(state.stats===1?options.openStat:options.afterStat)};},
    read:async(buffer,offset,length)=>{
      state.buffers.add(buffer.buffer);state.clock+=2;
      if(state.offset===0)setImmediate(()=>{state.inputAt=state.offset;});
      if(options.readError)throw Object.assign(new Error('synthetic read failure'),{code:'EIO'});
      const count=Math.min(length,options.shortReads?7:length,bytes.length-state.offset);
      bytes.copy(buffer,offset,state.offset,state.offset+count);state.offset+=count;
      return {bytesRead:options.truncated?0:count,buffer};
    },
    readFile:async()=>{state.offset=bytes.length;state.clock+=20;setImmediate(()=>{state.inputAt=state.offset;});return Buffer.from(bytes);},
    close:async()=>{state.closed=true;}
  }));
  return state;
}

for(const method of ['settingsFingerprint','readSettingsTextAsync'])test(method+' attends pending input before immediately resolved reads finish',async t=>{
  const bytes=Buffer.from('synthetic inert ASCII\n'.repeat(100000)),state=immediateCatalog(t,bytes);
  const value=await mod.exports[method]('synthetic-catalog');
  assert.equal(value,method==='settingsFingerprint'?require('crypto').createHash('sha256').update(bytes).digest('hex'):bytes.toString('utf8'));
  assert.ok(state.inputAt!==null&&state.inputAt<bytes.length,`input ran after ${state.inputAt} of ${bytes.length} bytes`);
  assert.equal(state.closed,true);
  assert.equal(state.buffers.size,1,'read uses one backing buffer, without chunk accumulation');
});

for(const method of ['settingsFingerprint','readSettingsTextAsync']) {
  for(const bytes of [Buffer.alloc(0),Buffer.from([0x61,0xf0,0x9f,0x98,0x80,0xff,0xe2,0x82])])test(method+' preserves empty/short reads and native malformed UTF8 ('+bytes.length+' bytes)',async t=>{
    const state=immediateCatalog(t,bytes,{shortReads:true});
    const value=await mod.exports[method]('synthetic-catalog');
    assert.equal(value,method==='settingsFingerprint'?require('crypto').createHash('sha256').update(bytes).digest('hex'):bytes.toString('utf8'));
    assert.equal(state.offset,bytes.length);assert.equal(state.closed,true);
  });
  for(const [scenario,options]of Object.entries({truncation:{truncated:true},growth:{afterStat:{size:200}},mtime:{afterStat:{mtimeMs:99}},ctime:{afterStat:{ctimeMs:99}},identity:{openStat:{ino:99}},replacement:{finalPathStat:{ino:99}},symlink:{finalPathStat:{isSymbolicLink:()=>true}},io:{readError:true}}))test(method+' rejects '+scenario+' and closes its descriptor',async t=>{
    const state=immediateCatalog(t,Buffer.from('synthetic original bytes'),options);
    await assert.rejects(mod.exports[method]('synthetic-catalog'),/changed while reading|synthetic read failure/);
    assert.equal(state.closed,true);
  });
  test(method+' distinguishes initial absence from access errors',async t=>{
    for(const code of ['ENOENT','EACCES']){
      t.mock.method(fs.promises,'lstat',async()=>{throw Object.assign(new Error('synthetic '+code),{code});});
      if(code==='ENOENT')assert.equal(await mod.exports[method]('synthetic-catalog'),null);
      else await assert.rejects(mod.exports[method]('synthetic-catalog'),e=>e.code===code);
    }
  });
}
