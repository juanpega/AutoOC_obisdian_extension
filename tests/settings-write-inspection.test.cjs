const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),Module=require('node:module'),ts=require('typescript'),cp=require('node:child_process');
const cache=new Map();
function load(file) {
  file=path.resolve(__dirname,'..',file);
  if(cache.has(file))return cache.get(file).exports;
  const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));cache.set(file,m);
  const original=m.require.bind(m);
  m.require=name=>name.startsWith('.')&&fs.existsSync(path.resolve(path.dirname(file),name+'.ts'))?load(path.resolve(path.dirname(file),name+'.ts')):original(name);
  m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
  return m.exports;
}
const api=load('settings-write-inspection.ts'),writer=load('settings-writer.ts');
const deadPid=987654321;
function fixture(t) {
  const vault=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-settings-inspection-')),directory=path.join(vault,'.obsidian/plugins/auto-oc'),runtime=path.join(directory,'runtime');
  fs.mkdirSync(runtime,{recursive:true});const file=path.join(directory,'data.json');
  fs.writeFileSync(file,JSON.stringify({tasks:[],workflows:[],privatePrompt:'SYNTHETIC_PRIVATE_CONTENT'}));
  const journal={schemaVersion:1,runId:'history',workflowId:'historical',definitionHash:'a'.repeat(64),revision:3,phase:'completed',nextStepId:null,steps:[{stepId:'one',status:'completed',output:'SYNTHETIC_PRIVATE_OUTPUT'}]};
  fs.writeFileSync(path.join(runtime,'history.json'),JSON.stringify(journal));
  const lock={schemaVersion:1,token:crypto.randomUUID(),transactionId:crypto.randomUUID(),pid:deadPid,processStart:'windows:123456789012345678',directoryIdentity:writer.settingsDirectoryIdentity(directory)};
  fs.writeFileSync(file+'.write-lock',JSON.stringify(lock));
  fs.writeFileSync(file+'.123.1.abcd.tmp',Buffer.from([0xff,0x00,0x7b]));
  const kill=process.kill;
  t.mock.method(process,'kill',(pid,...args)=>{if(pid===deadPid)throw Object.assign(new Error('absent'),{code:'ESRCH'});return kill.call(process,pid,...args);});
  t.after(()=>{
    assert.equal(path.dirname(fs.realpathSync(vault)),fs.realpathSync(os.tmpdir()));
    assert(path.basename(vault).startsWith('autooc-settings-inspection-'));
    fs.rmSync(vault,{recursive:true,force:true,maxRetries:10,retryDelay:50});
  });
  return {vault,directory,runtime,file,lock};
}
function snapshot(root) {
  const result={};
  for(const entry of fs.readdirSync(root,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
    const file=path.join(root,entry.name);
    if(entry.isDirectory()) {result[entry.name+'/']='directory';for(const [n,v]of Object.entries(snapshot(file)))result[entry.name+'/'+n]=v;}
    else result[entry.name]=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  }
  return result;
}
const decision=i=>({schemaVersion:1,action:'recover-settings-write',vault:i.vault,installationDirectory:i.installationDirectory,inspectionHash:i.inspectionHash,token:i.lock.token,transactionId:i.lock.transactionId,reason:'Operador revisó la bóveda sintética',preserveCatalog:true,executionsResumed:false});
test('inspection is stable, read-only and redacted, including binary partial temporaries',async t=>{
  const f=fixture(t),before=snapshot(f.directory),i=await api.inspectSettingsWrite(f.vault),again=await api.inspectSettingsWrite(f.vault);
  assert.equal(i.recoverable,true,JSON.stringify(i.blockingReasons));assert.equal(i.inspectionHash,again.inspectionHash);
  assert.deepEqual(snapshot(f.directory),before);
  assert(!JSON.stringify(i).includes('SYNTHETIC_PRIVATE'));
  assert(i.records.some(r=>r.name==='runtime/history.json'));
  assert.equal(i.temporaries[0].integrity,'incomplete_or_invalid');
});
for(const kind of ['legacy','empty','truncated','corrupt-catalog','uncertain-journal','missing-runtime','foreign-lease','pending-update','invalid-intent','hardlink'])test('inspection diagnoses and preserves '+kind,async t=>{
  const f=fixture(t);
  if(kind==='legacy')fs.writeFileSync(f.file+'.write-lock',f.lock.token);
  if(kind==='empty')fs.writeFileSync(f.file+'.write-lock','');
  if(kind==='truncated')fs.writeFileSync(f.file+'.write-lock','{"schemaVersion":');
  if(kind==='corrupt-catalog')fs.writeFileSync(f.file,'{');
  if(kind==='uncertain-journal') {const p=path.join(f.runtime,'history.json'),j=JSON.parse(fs.readFileSync(p));j.phase='in_flight';fs.writeFileSync(p,JSON.stringify(j));}
  if(kind==='missing-runtime') {fs.unlinkSync(path.join(f.runtime,'history.json'));fs.rmdirSync(f.runtime);}
  if(kind==='foreign-lease') {fs.mkdirSync(path.join(f.runtime,'execution.lock'));fs.writeFileSync(path.join(f.runtime,'execution.lock/owner.json'),JSON.stringify({pid:process.pid}));}
  if(kind==='pending-update')fs.writeFileSync(path.join(f.runtime,'update-pending.json'),'{}');
  if(kind==='invalid-intent')fs.writeFileSync(f.file+'.write-intent','{}');
  if(kind==='hardlink')fs.linkSync(f.file+'.write-lock',path.join(f.directory,'link'));
  const before=snapshot(f.directory),i=await api.inspectSettingsWrite(f.vault);
  assert.equal(i.recoverable,false);assert(i.blockingReasons.length);assert.deepEqual(snapshot(f.directory),before);
});
for(const kind of ['active','reused','permission','unknown-start'])test('owner verification blocks '+kind,async t=>{
  const f=fixture(t);
  if(kind==='unknown-start') {f.lock.processStart=null;fs.writeFileSync(f.file+'.write-lock',JSON.stringify(f.lock));}
  else {
    t.mock.method(process,'kill',()=>{if(kind==='permission')throw Object.assign(new Error('denied'),{code:'EPERM'});return true;});
    t.mock.method(writer,'settingsProcessStart',async()=>kind==='reused'?'windows:999999999999999999':f.lock.processStart);
  }
  const before=snapshot(f.directory),i=await api.inspectSettingsWrite(f.vault);
  assert.equal(i.recoverable,false);assert.deepEqual(snapshot(f.directory),before);
});
for(const kind of ['missing','invalid','other-vault','other-token','other-transaction','changed-catalog','changed-lock','new-temporary','changed-checkpoint'])test('decision rejects without effects: '+kind,async t=>{
  const f=fixture(t),d=decision(await api.inspectSettingsWrite(f.vault));
  if(kind==='other-vault')d.vault+='-other';
  if(kind==='other-token')d.token=crypto.randomUUID();
  if(kind==='other-transaction')d.transactionId=crypto.randomUUID();
  if(kind==='changed-catalog')fs.appendFileSync(f.file,' ');
  if(kind==='changed-lock')fs.appendFileSync(f.file+'.write-lock',' ');
  if(kind==='new-temporary')fs.writeFileSync(f.file+'.123.2.abcd.tmp','partial');
  if(kind==='changed-checkpoint')fs.appendFileSync(path.join(f.runtime,'history.json'),' ');
  const before=snapshot(f.directory);
  await assert.rejects(api.recoverSettingsWrite(f.vault,kind==='missing'?undefined:kind==='invalid'?{}:d));
  assert.deepEqual(snapshot(f.directory),before);
});
test('successful recovery preserves exact catalog, checkpoint and lease; archives every temporary once',async t=>{
  const f=fixture(t),lease=path.join(f.runtime,'execution.lock');fs.mkdirSync(lease);
  const owner={schemaVersion:1,token:crypto.randomUUID(),pid:deadPid,createdAt:new Date().toISOString()};
  const intent={schemaVersion:1,token:f.lock.token,directoryIdentity:writer.settingsDirectoryIdentity(f.directory),runtimeIdentity:writer.settingsDirectoryIdentity(f.runtime),owner:{...owner},originalHash:crypto.createHash('sha256').update(fs.readFileSync(f.file)).digest('hex')};
  const intentText=JSON.stringify(intent);fs.writeFileSync(f.file+'.write-intent',intentText);
  owner.settingsWriteIntent={token:f.lock.token,sha256:crypto.createHash('sha256').update(intentText).digest('hex')};
  fs.writeFileSync(path.join(lease,'owner.json'),JSON.stringify(owner));
  const saved=fs.readFileSync(f.file),checkpoint=fs.readFileSync(path.join(f.runtime,'history.json')),ownerBytes=fs.readFileSync(path.join(lease,'owner.json'));
  const d=decision(await api.inspectSettingsWrite(f.vault)),r=await api.recoverSettingsWrite(f.vault,d);
  assert.equal(r.recovered,true,JSON.stringify(r));assert.equal(r.executionsResumed,false);assert.equal(r.temporaryPromoted,false);
  assert(fs.readFileSync(f.file).equals(saved));assert(fs.readFileSync(r.backup).equals(saved));
  assert(fs.readFileSync(path.join(f.runtime,'history.json')).equals(checkpoint));assert(fs.readFileSync(path.join(lease,'owner.json')).equals(ownerBytes));
  assert.equal(fs.existsSync(f.file+'.write-lock'),false);assert(fs.existsSync(path.join(r.archive,'receipt.json')));
  const after=snapshot(f.directory);await assert.rejects(api.recoverSettingsWrite(f.vault,d));assert.deepEqual(snapshot(f.directory),after);
});
for(const kind of ['backup','move','receipt'])test('partial '+kind+' failure reports effects and blocks writers and startup',async t=>{
  const f=fixture(t),d=decision(await api.inspectSettingsWrite(f.vault)),saved=fs.readFileSync(f.file),checkpoint=fs.readFileSync(path.join(f.runtime,'history.json'));
  const rename=fs.renameSync;
  if(kind==='move')t.mock.method(fs,'renameSync',(from,to)=>{if(String(to).includes('settings-write-explicit-'))throw Object.assign(new Error('injected'),{code:'EIO'});return rename.call(fs,from,to);});
  const open=fs.openSync;
  if(kind!=='move')t.mock.method(fs,'openSync',(file,...args)=>{if(String(file).endsWith(kind==='backup'?'data.json.backup':'receipt.json'))throw Object.assign(new Error('injected'),{code:'EIO'});return open.call(fs,file,...args);});
  const r=await api.recoverSettingsWrite(f.vault,d);
  assert.equal(r.recovered,false);assert.equal(r.guardRetained,true);assert(r.archive);
  assert.equal(typeof r.backupVerified,'boolean');assert(Array.isArray(r.pending));assert(r.backup.endsWith('data.json.backup'));
  assert(fs.readFileSync(f.file).equals(saved));assert(fs.readFileSync(path.join(f.runtime,'history.json')).equals(checkpoint));
  await assert.rejects(new writer.SettingsWriter().save(f.file,()=>({tasks:[],workflows:[]})),/recovery guard/);
  assert.throws(()=>load('execution-lease.ts').acquireExecutionLease(f.runtime),/recovery is in progress/);
  const i=await api.inspectSettingsWrite(f.vault);assert.equal(i.recoverable,false);
});
test('two recoverers cannot both mutate evidence',async t=>{
  const f=fixture(t),d=decision(await api.inspectSettingsWrite(f.vault));
  const results=await Promise.allSettled([api.recoverSettingsWrite(f.vault,d),api.recoverSettingsWrite(f.vault,d)]);
  assert.equal(results.filter(r=>r.status==='fulfilled'&&r.value.recovered).length,1);
});
test('built CLI advertises strict commands and prints only diagnostic JSON',async t=>{
  const f=fixture(t),cli=path.resolve(__dirname,'../autooc-cli.cjs');
  const run=args=>cp.spawnSync(process.execPath,[cli,...args],{encoding:'utf8',windowsHide:true,timeout:15000});
  const version=run(['version']);assert.equal(version.status,0);assert(JSON.parse(version.stdout).capabilities.includes('inspect-settings-write'));
  const help=run(['help']);assert.equal(help.status,0);assert.match(JSON.parse(help.stdout).settingsWriteRecovery,/recover-settings-write/);
  const i=run(['inspect-settings-write','--vault',f.vault]);assert.equal(i.status,0,i.stderr);assert.equal(JSON.parse(i.stdout).schemaVersion,1);assert(!i.stdout.includes('SYNTHETIC_PRIVATE'));
  const bad=run(['inspect-settings-write','--vault',f.vault,'--force','true']);assert.equal(bad.status,1);
  const absent=run(['recover-settings-write','--vault',f.vault]);assert.equal(absent.status,1);
});

test('real terminated writer is inspected and recovered through the built CLI',{timeout:45000},async t=>{
  const f=fixture(t);fs.unlinkSync(f.file+'.write-lock');
  const childSource=`const fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript');
    const __dirname=${JSON.stringify(__dirname)},cache=new Map();${load.toString()}
    const {SettingsWriter}=load('settings-writer.ts');
    new SettingsWriter().save(process.argv[1],()=>process.exit(0)).catch(()=>process.exit(2));`;
  const child=cp.spawnSync(process.execPath,['-e',childSource,f.file],{encoding:'utf8',windowsHide:true,timeout:20000});
  assert.equal(child.status,0,child.stderr);
  const lock=JSON.parse(fs.readFileSync(f.file+'.write-lock'));
  assert.equal(typeof lock.pid,'number');assert.equal(typeof lock.transactionId,'string');
  if(lock.processStart===null){t.skip('OS process-start observation unavailable; conservative refusal remains covered offline');return;}
  const cli=path.resolve(__dirname,'../autooc-cli.cjs'),run=args=>cp.spawnSync(process.execPath,[cli,...args],{encoding:'utf8',windowsHide:true,timeout:15000});
  const i=run(['inspect-settings-write','--vault',f.vault]);assert.equal(i.status,0,i.stderr);
  const inspection=JSON.parse(i.stdout);assert.equal(inspection.recoverable,true,JSON.stringify(inspection.blockingReasons));
  const decisionFile=path.join(f.vault,'decision.json');fs.writeFileSync(decisionFile,JSON.stringify(decision(inspection)));
  const before=fs.readFileSync(f.file),journal=fs.readFileSync(path.join(f.runtime,'history.json'));
  const r=run(['recover-settings-write','--vault',f.vault,'--decision',decisionFile]);assert.equal(r.status,0,r.stderr||r.stdout);
  const receipt=JSON.parse(r.stdout);assert.equal(receipt.recovered,true);assert.equal(receipt.executionsResumed,false);
  assert(fs.readFileSync(f.file).equals(before));assert(fs.readFileSync(path.join(f.runtime,'history.json')).equals(journal));assert(fs.readFileSync(receipt.backup).equals(before));
});
