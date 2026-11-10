const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const crypto=require('node:crypto'),zlib=require('node:zlib'),ts=require('typescript');
const {EventEmitter}=require('node:events');
const root=path.resolve(__dirname,'..');
function load(file,dependencies={},globals={},transform=x=>x){
  const source=transform(fs.readFileSync(path.join(root,file),'utf8'));
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(code,{module,exports:module.exports,Buffer,console,process,setTimeout,clearTimeout,
    require:id=>Object.hasOwn(dependencies,id)?dependencies[id]:require(id),...globals},{filename:file});
  return module.exports;
}
function lifecycle({cleanupFails=false,killFails=false}={}){
  const events=new EventEmitter(),timers=new Set(),signals=[],writes=[],sizes=[],errors=[];
  let disposals=0,fail=cleanupFails;
  const terminal={pid:1234,_writeStream:{dispose(){disposals++;if(fail)throw Error('writer busy');}},
    write:data=>writes.push(data),resize:(...v)=>sizes.push(v),kill:signal=>{signals.push(signal);if(killFails)throw Error('native error');},
    onData(fn){events.on('data',fn);return{dispose:()=>events.off('data',fn)};},
    onExit(fn){events.on('exit',fn);return{dispose:()=>events.off('exit',fn)};}};
  const api=load('terminal-pty-posix.ts',{'node:path':path.posix},{
    console:{error:e=>errors.push(e)},setTimeout(fn){const timer={fn};timers.add(timer);return timer;},clearTimeout:t=>timers.delete(t),
  });
  let captured;
  const backend=api.createPosixTerminalBackend({spawn(file,args,options){captured={file,args,options};return terminal;}});
  const options={cwd:'/Users/Test/My Project',env:{HOME:'/Users/Test',PATH:'/usr/bin:/bin'},cols:80,rows:24,name:'xterm-256color'};
  const pty=backend.spawn('/opt/homebrew/bin/cli',['literal $(touch nope)'],options);
  return{pty,backend,options,events,signals,writes,sizes,errors,captured,timers,
    retryCleanup(){fail=false;},disposals:()=>disposals,timeout(){for(const t of [...timers]){timers.delete(t);t.fn();}}};
}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
test('Darwin PTY accepts a POSIX environment and literal argv, streams data and resizes',async()=>{
  const h=lifecycle(),received=[];h.pty.onData(data=>received.push(data));
  assert.equal(h.captured.file,'/opt/homebrew/bin/cli');assert.deepEqual(Array.from(h.captured.args),['literal $(touch nope)']);
  assert.equal(h.captured.options.env.SystemRoot,undefined);assert.equal(h.captured.options.useConpty,undefined);
  h.events.emit('data','ñ');h.pty.write('input');h.pty.resize(120,32);
  assert.deepEqual(received,['ñ']);assert.deepEqual(h.writes,['input']);assert.deepEqual(h.sizes,[[120,32]]);
  for(const invalid of [{cwd:'relative'},{cols:0},{env:{BAD:'nul\0'}}])assert.throws(()=>h.backend.spawn('/bin/sh',[],{...h.options,...invalid}));
  h.events.emit('exit',{exitCode:0});await flush();assert.equal(h.disposals(),1);
});
test('Darwin Stop waits for native exit and cleanup, suppresses input and sends SIGHUP only once',async()=>{
  const h=lifecycle(),exits=[];h.pty.onExit(e=>exits.push(e));
  const stopping=h.pty.kill();assert.equal(h.pty.kill(),stopping);let done=false;stopping.then(()=>done=true);
  h.pty.write('ignored');h.pty.resize(90,30);await flush();assert.equal(done,false);
  assert.deepEqual(h.signals,['SIGHUP']);assert.deepEqual(h.writes,[]);assert.deepEqual(h.sizes,[]);
  h.events.emit('exit',{exitCode:0,signal:1});await stopping;assert.equal(exits.length,1);
  await h.pty.kill();assert.equal(h.signals.length,1);assert.equal(h.disposals(),1);assert.equal(h.timers.size,0);
});
test('Darwin timeout preserves observation and retries waiting without resending a signal',async()=>{
  const h=lifecycle(),first=h.pty.kill(),rejected=assert.rejects(first,/no confirmada/);
  h.timeout();await rejected;const second=h.pty.kill();assert.notEqual(second,first);
  assert.equal(h.signals.length,1);h.events.emit('exit',{exitCode:0});await second;
});
test('Darwin native kill errors do not claim success or repeat the uncertain signal',async()=>{
  const h=lifecycle({killFails:true});await assert.rejects(h.pty.kill(),/no confirmada/);
  const waiting=h.pty.kill();assert.equal(h.signals.length,1);h.events.emit('exit',{exitCode:1});await waiting;
});
test('Darwin cleanup failure can be retried after exit without signalling a stale PID',async()=>{
  const h=lifecycle({cleanupFails:true}),exits=[];h.pty.onExit(e=>exits.push(e));
  const stopping=h.pty.kill(),rejected=assert.rejects(stopping,/cleanup/);h.events.emit('exit',{exitCode:0});await rejected;
  assert.equal(exits.length,0);h.retryCleanup();await h.pty.kill();assert.equal(exits.length,1);assert.equal(h.signals.length,1);
});
test('Darwin natural silent exit performs cleanup and makes later Stop a no-op',async()=>{
  const h=lifecycle(),exits=[];h.pty.onExit(()=>{throw Error('listener');});h.pty.onExit(e=>exits.push(e));
  h.events.emit('exit',{exitCode:7});await flush();await h.pty.kill();
  assert.equal(exits.length,1);assert.equal(exits[0].exitCode,7);assert.equal(h.signals.length,0);assert.equal(h.disposals(),1);
});
test('macOS commands launch the executable directly with unchanged literal arguments',()=>{
  const source=ts.createSourceFile('integrated-terminal.ts',fs.readFileSync(path.join(root,'integrated-terminal.ts'),'utf8'),ts.ScriptTarget.Latest,true);
  const fn=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='integratedCliCommand');
  const module={exports:{}};
  vm.runInNewContext(ts.transpileModule(fn.getText(source),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,
    {module,exports:module.exports,process:{platform:'darwin'},path:path.posix,Buffer});
  const args=['--prompt',"spaces 'quotes' $(no)\nñ"];
  const result=module.exports.integratedCliCommand('/Users/Test/My CLI/codex',args);
  assert.equal(result.file,'/Users/Test/My CLI/codex');assert.deepEqual(Array.from(result.args),args);assert.notEqual(result.args,args);
});
test('Dock PATH preserves precedence and adds Homebrew, user tools and configured CLI without executing profiles',()=>{
  const api=load('terminal-environment.ts',{'node:path':path.posix,'node:os':{homedir:()=>'/Users/Test'},'node:fs':{realpathSync:()=>'/Users/Test/.nvm/versions/node/v22/bin/cli'}},{process:{platform:'darwin'}});
  const original={PATH:'/custom/bin:/usr/bin:.:relative',HOME:'/Users/Test',TERM:'xterm'};
  const env=api.terminalEnvironment('/Users/Test/.nvm/versions/node/v22/bin/cli',original);
  const dirs=env.PATH.split(':');assert.deepEqual(dirs.slice(0,2),['/custom/bin','/usr/bin']);
  for(const dir of ['/opt/homebrew/bin','/usr/local/bin','/Users/Test/.nvm/versions/node/v22/bin','/Users/Test/.volta/bin'])assert.ok(dirs.includes(dir));
  assert.ok(!dirs.includes('.')&&!dirs.includes('relative'));assert.equal(new Set(dirs).size,dirs.length);
  assert.equal(original.PATH,'/custom/bin:/usr/bin:.:relative');assert.equal(env.TERM,'xterm');
});
test('macOS independent host and its CLI receive the same completed PATH without mutating global env',async()=>{
  const environment=load('terminal-environment.ts',{'node:path':path.posix,'node:os':{homedir:()=>'/Users/Test'},'node:fs':{realpathSync:file=>file}},
    {process:{platform:'darwin'}});
  const child=new EventEmitter(),launches=[];let sent;
  Object.assign(child,{connected:true,send(config,callback){sent=config;queueMicrotask(()=>{callback?.();child.emit('message',{type:'ready',port:12345,pid:54321});});},
    disconnect(){this.connected=false;},unref(){}});
  const original={PATH:'/usr/bin:/bin',ELECTRON_RUN_AS_NODE:'1'};
  const api=load('terminal-session.ts',{'./terminal-environment':environment,path:path.posix,
    child_process:{spawn(...args){launches.push(args);return child;}}},
    {process:{platform:'darwin',env:original},setInterval:()=>123,clearInterval:()=>{}});
  const config={pluginDirectory:'/Users/Test/Vault/.obsidian/plugins/auto-oc',file:'/opt/homebrew/bin/codex',args:[],
    options:{cwd:'/Users/Test/Project',env:{PATH:original.PATH,HOME:'/Users/Test'},cols:80,rows:24,name:'xterm'}};
  const session=await api.createTerminalSession(config);session.disconnect();
  assert.equal(launches.length,1);assert.equal(launches[0][0],'node');assert.equal(launches[0][2].env.PATH,sent.options.env.PATH);
  assert.ok(sent.options.env.PATH.includes('/opt/homebrew/bin'));assert.equal(launches[0][2].env.ELECTRON_RUN_AS_NODE,undefined);
  assert.equal(original.PATH,'/usr/bin:/bin');assert.equal(original.ELECTRON_RUN_AS_NODE,'1');assert.equal(config.options.env.PATH,original.PATH);
});

// Synthetic archive/digest tests exercise the real installer and filesystem;
// the production trust pin is separately asserted in integrated-terminal.test.
function archive(){
  const files={'package.json':JSON.stringify({name:'node-pty',version:'1.1.0',license:'MIT'}),LICENSE:'MIT',
    'lib/index.js':'exports.spawn = function() {};','lib/unixTerminal.js':'pinned source',
    'prebuilds/win32-x64/conpty.node':'not for Mac'};
  for(const arch of ['arm64','x64'])for(const file of ['pty.node','spawn-helper'])files[`prebuilds/darwin-${arch}/${file}`]=arch+file;
  const chunks=[];
  for(const [name,text]of Object.entries(files)){
    const b=Buffer.from(text),h=Buffer.alloc(512);h.write('package/'+name);h.write('0000644\0',100);h.write(b.length.toString(8).padStart(11,'0')+'\0',124);h.fill(32,148,156);h[156]=48;
    const sum=[...h].reduce((a,b)=>a+b,0);h.write(sum.toString(8).padStart(6,'0')+'\0 ',148);
    chunks.push(h,b,Buffer.alloc((512-b.length%512)%512));
  }
  return zlib.gzipSync(Buffer.concat([...chunks,Buffer.alloc(1024)]));
}
for(const arch of ['arm64','x64'])test(`macOS ${arch} installs verified dual-architecture support, executable helpers and loads offline`,async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-mac-pty-test-'));
  t.after(()=>{assert.equal(path.dirname(fs.realpathSync(directory)),fs.realpathSync(os.tmpdir()));fs.rmSync(directory,{recursive:true,force:true});});
  const body=archive(),digest='sha512-'+crypto.createHash('sha512').update(body).digest('base64');
  const modes=new Map(),requires=[];let requests=0;
  const disk={...fs.promises,async chmod(file,mode){modes.set(file,mode);},async lstat(file){const st=await fs.promises.lstat(file);if(modes.has(file))st.mode=(st.mode&~0o777)|modes.get(file);return st;}};
  const backend={spawn(){throw Error('Do not spawn in installer test');}};
  const api=load('terminal-pty.ts',{
    './terminal-pty-posix':{createPosixTerminalBackend:b=>b},'node:fs':{promises:disk},
    'node:module':{createRequire:()=>file=>{requires.push(file);return file.endsWith('index.js')?backend:{};}},
    'node:https':{get(url,options,callback){
      requests++;const req=new EventEmitter(),res=new EventEmitter();res.statusCode=200;req.destroy=e=>req.emit('error',e);
      queueMicrotask(()=>{callback(res);res.emit('data',body);res.emit('end');req.emit('close');});return req;
    }},
  },{process:{platform:'darwin',arch,versions:{napi:'8',node:'22.0.0'}}},source=>source.replace(/sha512-[A-Za-z0-9+/=]+/,digest));
  await api.installTerminalSupport(directory);
  const installed=path.join(directory,'terminal-support','node-pty-1.1.0-darwin');
  // rename moves the helpers; reflect that in our cross-platform permission model.
  for(const a of ['arm64','x64']){
    const helper=path.join(installed,'prebuilds','darwin-'+a,'spawn-helper');
    assert.ok([...modes.keys()].some(p=>p.endsWith(path.join('darwin-'+a,'spawn-helper'))));modes.set(helper,0o755);
  }
  assert.ok(!fs.existsSync(path.join(installed,'prebuilds','win32-x64')));
  assert.equal(await api.loadTerminalPty(directory),backend);assert.equal(requests,1);
  assert.ok(requires[0].endsWith(path.join(`darwin-${arch}`,'pty.node')));
  await api.installTerminalSupport(directory);assert.equal(requests,1,'existing support is verified offline');
  const helper=path.join(installed,'prebuilds',`darwin-${arch}`,'spawn-helper');modes.set(helper,0o644);
  await assert.rejects(api.verifyTerminalSupport(directory),/permiso de ejecucion/);modes.set(helper,0o755);
  fs.writeFileSync(helper,Buffer.alloc(fs.statSync(helper).size,88));await assert.rejects(api.loadTerminalPty(directory),/alterado/);assert.equal(requests,1);
});
