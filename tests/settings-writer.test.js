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
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText, file);
const { atomicSettingsWrite, SettingsWriter } = mod.exports;

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
