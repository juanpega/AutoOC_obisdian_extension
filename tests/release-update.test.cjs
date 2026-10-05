const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const Module=require('node:module');
const {spawnSync}=require('node:child_process');
const esbuild=require('esbuild');
const built=esbuild.buildSync({entryPoints:[path.resolve(__dirname,'../release-update.ts')],bundle:true,platform:'node',format:'cjs',write:false});
const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(built.outputFiles[0].text,__filename);
const {verifyRelease,installRelease,downloadRelease,RELEASE_FILES,RELEASE_DESCRIPTOR}=m.exports;
const {acquireExecutionLease}=require('../autooc-runtime.cjs');
function pluginClass() {
  const load=Module._load;
  try {
    Module._load=function(name,...args){if(name==='obsidian')return {Plugin:class{},Notice:class{},Modal:class{},Setting:class{},ItemView:class{},PluginSettingTab:class{},WorkspaceLeaf:class{}};return load.call(this,name,...args);};
    return require('../main.js').default;
  }finally{Module._load=load;}
}
function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-update-'));
  const directory=path.join(root,'.obsidian/plugins/auto-oc'),runtime=path.join(directory,'runtime');
  fs.mkdirSync(runtime,{recursive:true});
  t.after(()=>{assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('autooc-update-'));fs.rmSync(root,{recursive:true});});
  return {root,directory,runtime};
}
function release() {
  const files=Object.fromEntries(RELEASE_FILES.map(name=>[name,Buffer.from(name==='manifest.json'?JSON.stringify({id:'auto-oc',version:'1.6.0'}):`new ${name}`)]));
  files[RELEASE_DESCRIPTOR]=Buffer.from(JSON.stringify({schemaVersion:1,version:'1.6.0',sha256:Object.fromEntries(RELEASE_FILES.map(name=>[name,crypto.createHash('sha256').update(files[name]).digest('hex')]))}));
  return files;
}
test('update installs whole verified release and preserves catalog, journals and backup',t=>{
  const {directory,runtime}=fixture(t),files=release();
  fs.writeFileSync(path.join(directory,'main.js'),'old bundle');fs.writeFileSync(path.join(directory,'data.json'),'user catalog');
  fs.writeFileSync(path.join(runtime,'aa.json'),JSON.stringify({schemaVersion:1,runId:'aa',workflowId:'w',definitionHash:'a'.repeat(64),revision:1,phase:'completed',nextStepId:null,steps:[]}));
  const lease=acquireExecutionLease(runtime);
  try {
    const result=installRelease({directory,version:'1.6.0',files,lease});
    for(const name of [...RELEASE_FILES,RELEASE_DESCRIPTOR])assert.deepEqual(fs.readFileSync(path.join(directory,name)),files[name]);
    assert.equal(fs.readFileSync(path.join(result.backup,'main.js'),'utf8'),'old bundle');
    assert.equal(fs.readFileSync(path.join(directory,'data.json'),'utf8'),'user catalog');
    assert.ok(fs.existsSync(path.join(runtime,'aa.json')));assert.ok(!fs.existsSync(path.join(runtime,'update-pending.json')));
  } finally {lease.release();}
});
test('incomplete download, mixed revisions and wrong version are rejected before writes',async t=>{
  const files=release();
  await assert.rejects(downloadRelease('https://fixture.invalid','1.6.0',async url=>({ok:!url.includes('autooc-cli'),status:404,arrayBuffer:async()=>files[url.split('/').pop().split('?')[0]]})),/HTTP 404/);
  assert.throws(()=>verifyRelease(files,'9.0.0'),/incompatible/);
  files['main.js']=Buffer.from('mixed');
  const {directory,runtime}=fixture(t),lease=acquireExecutionLease(runtime);
  try {assert.throws(()=>installRelease({directory,version:'1.6.0',files,lease}),/integrity mismatch/);assert.deepEqual(fs.readdirSync(directory),['runtime']);}finally{lease.release();}
});
test('write failure rolls back artifacts; failed rollback leaves execution blocked',t=>{
  for(const rollbackFails of [false,true]) {
    const {directory,runtime}=fixture(t),lease=acquireExecutionLease(runtime),files=release();
    fs.writeFileSync(path.join(directory,'main.js'),'old');
    const write=fs.writeFileSync;let failed=false;
    try {
      fs.writeFileSync=function(file,...args){
        if(file===path.join(directory,'manifest.json') && !failed){failed=true;throw Error('injected write failure');}
        if(rollbackFails && failed && file===path.join(directory,'main.js'))throw Error('injected rollback failure');
        return write.call(this,file,...args);
      };
      assert.throws(()=>installRelease({directory,version:'1.6.0',files,lease}),/injected/);
    }finally{fs.writeFileSync=write;lease.release();}
    assert.equal(fs.existsSync(path.join(runtime,'update-pending.json')),rollbackFails);
    if(rollbackFails)assert.throws(()=>acquireExecutionLease(runtime),/Incomplete plugin update/);
    else {assert.equal(fs.readFileSync(path.join(directory,'main.js'),'utf8'),'old');assert.ok(!fs.existsSync(path.join(directory,'manifest.json')));}
  }
});
test('unfinished run and linked artifact directory prevent update',t=>{
  const {root,directory,runtime}=fixture(t),lease=acquireExecutionLease(runtime),files=release();
  const state={schemaVersion:1,runId:'bb',workflowId:'w',definitionHash:'a'.repeat(64),revision:1,phase:'ready',nextStepId:'step',steps:[]};
  fs.writeFileSync(path.join(runtime,'bb.json'),JSON.stringify(state));
  try {
    assert.throws(()=>installRelease({directory,version:'1.6.0',files,lease}),/Unfinished execution/);
    fs.unlinkSync(path.join(runtime,'bb.json'));
    const outside=path.join(root,'outside');fs.mkdirSync(outside);
    fs.symlinkSync(outside,path.join(directory,'skills'),process.platform==='win32'?'junction':'dir');
    assert.throws(()=>installRelease({directory,version:'1.6.0',files,lease}),/Unsafe release destination/);
    assert.deepEqual(fs.readdirSync(outside),[]);
  } finally {lease.release();}
});
test('actual deployment installs runtime and skill, preserves configuration, excludes live owner',t=>{
  const {root,directory,runtime}=fixture(t);
  fs.writeFileSync(path.join(directory,'data.json'),JSON.stringify({custom:'preserved',tasks:[],workflows:[]}));
  const deploy=()=>spawnSync(process.execPath,[path.resolve(__dirname,'../deploy.mjs'),root],{encoding:'utf8',timeout:30000});
  const lease=acquireExecutionLease(runtime);
  try {const denied=deploy();assert.equal(denied.status,1);assert.match(denied.stderr,/reservation/);}finally{lease.release();}
  const result=deploy();assert.equal(result.status,0,result.stderr);
  const cli=path.join(directory,'autooc-cli.cjs');
  const list=spawnSync(process.execPath,[cli,'list','--vault',root],{encoding:'utf8'});assert.equal(list.status,0,list.stderr);
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory,'data.json'))).custom,'preserved');
  assert.ok(fs.existsSync(path.join(directory,'skills/autooc-runtime/SKILL.md')));
  const names=[...RELEASE_FILES,RELEASE_DESCRIPTOR];
  verifyRelease(Object.fromEntries(names.map(name=>[name,fs.readFileSync(path.join(directory,name))])),JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'))).version);
});

test('plugin repairs legacy three-file installation, blocks launches during download and reloads complete package',async t=>{
  const {root,directory}=fixture(t),Plugin=pluginClass(),p=new Plugin(),files=release();
  p.app={vault:{adapter:{basePath:root},configDir:'.obsidian'},plugins:{disablePlugin:async()=>{p.releasePluginExecution(false);},enablePlugin:async()=>{assert.ok(fs.existsSync(path.join(directory,'autooc-cli.cjs')));}}};
  p.manifest={id:'auto-oc',version:'1.6.0'};p.settings={tasks:[],workflows:[]};p.reservePluginExecution();
  const priorFetch=global.fetch,priorConfirm=global.confirm;
  let requested=0;
  global.confirm=()=>true;
  global.fetch=async url=>{
    const file=url.split('/').pop().split('?')[0];
    if(!p.updateInProgress)return {ok:true,json:async()=>({version:'1.6.0'})};
    requested++;
    await assert.rejects(p.runTask({id:'t'}),/update is in progress/);
    await assert.rejects(p.runWorkflow({id:'w'}),/update is in progress/);
    const name=file==='SKILL.md'?'skills/autooc-runtime/SKILL.md':file;
    return {ok:true,arrayBuffer:async()=>files[name]};
  };
  try {
    await p.checkForUpdates(true);assert.equal(p.updateAvailable,true);
    await p.updatePlugin();assert.equal(requested,7);assert.equal(p.updateInProgress,false);
    assert.equal(fs.readFileSync(path.join(directory,'autooc-cli.cjs'),'utf8'),'new autooc-cli.cjs');
  } finally {global.fetch=priorFetch;global.confirm=priorConfirm;p.releasePluginExecution(false);}
});
