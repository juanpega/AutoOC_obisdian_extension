const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(name){
  const file=path.join(root,name+'.ts');if(cache.has(file))return cache.get(file).exports;
  const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(root);cache.set(file,m);
  const original=m.require.bind(m);m.require=name=>name.startsWith('./')?load(name.slice(2)):original(name);
  m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);return m.exports;
}
test('terminal disposition preserves exact historical bytes and only releases individually reviewed uncertainty',async t=>{
  const vault=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-disposition-'));
  t.after(()=>fs.rmSync(vault,{recursive:true,force:true}));
  const directory=path.join(vault,'.obsidian/plugins/auto-oc'),runtime=path.join(directory,'runtime');fs.mkdirSync(runtime,{recursive:true});
  fs.writeFileSync(path.join(directory,'data.json'),JSON.stringify({tasks:[],workflows:[]}));
  const {ExecutionJournal,readExecutionCheckpoint}=load('execution-journal'),{acquireExecutionLease}=load('execution-lease');
  const {assertIdleJournals}=load('execution-idle');
  const {inspectTerminalExecution,disposeTerminalExecution}=load('execution-abandonment');
  const lease=acquireExecutionLease(runtime),states=[];
  for(let i=0;i<2;i++) {
    const j=await ExecutionJournal.create(lease,'wf-'+i,'a'.repeat(64),'a');await j.begin('a');
    await j.recordResult({succeeded:false,output:'original result',cancelled:true});
    await j.recordEvaluation('review');await j.finish('a',false,'original output',null);states.push(j.snapshot());
  }
  lease.release();
  const catalog=fs.readFileSync(path.join(directory,'data.json'));
  assert.throws(()=>assertIdleJournals(runtime),/uncertain/);
  for(const state of states) {
    const original=fs.readFileSync(path.join(runtime,state.runId+'.json'));
    const observed=inspectTerminalExecution({vault,runId:state.runId});
    const decision={...observed,reason:'Human reviewed this exact historical attempt',acknowledgedUnknownEffects:true};
    await assert.rejects(disposeTerminalExecution({...decision,revision:state.revision+1}),/revision/);
    await assert.rejects(disposeTerminalExecution({...decision,workflowId:'other'}),/identity/);
    await assert.rejects(disposeTerminalExecution({...decision,acknowledgedUnknownEffects:false}),/acknowledg/);
    const owner=acquireExecutionLease(runtime);
    await assert.rejects(disposeTerminalExecution(decision));owner.release();
    const after=await disposeTerminalExecution(decision);
    assert.equal(after.phase,'failed');assert.deepEqual(after.steps,state.steps);assert.equal(after.revision,state.revision+1);
    assert.equal(after.disposition.outcome,'unknown');
    assert.deepEqual(fs.readFileSync(path.join(runtime,after.disposition.snapshot)),original);
    assert.deepEqual(readExecutionCheckpoint(runtime,state.runId),after);
    await assert.rejects(disposeTerminalExecution(decision),/revision|already/);
    assert.deepEqual(fs.readFileSync(path.join(directory,'data.json')),catalog);
    if(state===states[0])assert.throws(()=>assertIdleJournals(runtime),/uncertain/);
  }
  assert.equal(assertIdleJournals(runtime).size,2);
  const state=readExecutionCheckpoint(runtime,states[0].runId);
  fs.appendFileSync(path.join(runtime,state.disposition.snapshot),' ');
  assert.throws(()=>assertIdleJournals(runtime),/snapshot/i);
});

test('terminal disposition rejects unsafe decisions and preserves evidence on persistence failure and retry',async t=>{
  const vault=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-disposition-'));
  t.after(()=>fs.rmSync(vault,{recursive:true,force:true}));
  const directory=path.join(vault,'.obsidian/plugins/auto-oc'),runtime=path.join(directory,'runtime');fs.mkdirSync(runtime,{recursive:true});
  fs.writeFileSync(path.join(directory,'data.json'),JSON.stringify({tasks:[],workflows:[]}));
  const {ExecutionJournal,readExecutionCheckpoint}=load('execution-journal'),{acquireExecutionLease}=load('execution-lease');
  const {inspectTerminalExecution,disposeTerminalExecution}=load('execution-abandonment');
  const lease=acquireExecutionLease(runtime),j=await ExecutionJournal.create(lease,'wf','a'.repeat(64),'a');
  await j.begin('a');await j.recordResult({succeeded:false,output:'unchanged',cancelled:true});await j.finish('a',false,'unchanged',null);lease.release();
  const before=j.snapshot(),file=path.join(runtime,before.runId+'.json'),bytes=fs.readFileSync(file);
  const decision={...inspectTerminalExecution({vault,runId:before.runId}),reason:'Explicit review',acknowledgedUnknownEffects:true};
  for(const changes of [{reason:''},{reason:' '.repeat(1001)},{definitionHash:'b'.repeat(64)},{vaultIdentity:'other'},{installationIdentity:'other'},{runtimeIdentity:'other'},{causes:[]},{acknowledgedUnknownEffects:false}]) {
    await assert.rejects(disposeTerminalExecution({...decision,...changes}));assert.deepEqual(fs.readFileSync(file),bytes);
  }
  fs.writeFileSync(path.join(directory,'data.json.write-lock'),'fixture');
  await assert.rejects(disposeTerminalExecution(decision),/write/);fs.unlinkSync(path.join(directory,'data.json.write-lock'));
  const rename=fs.promises.rename;
  fs.promises.rename=async()=>{throw Object.assign(new Error('injected durable write failure'),{code:'EIO'});};
  try {await assert.rejects(disposeTerminalExecution(decision),/injected/);} finally {fs.promises.rename=rename;}
  assert.deepEqual(fs.readFileSync(file),bytes);assert.equal(readExecutionCheckpoint(runtime,before.runId).disposition,undefined);
  const snapshot=path.join(runtime,`disposition-${before.runId}-${before.revision}.snapshot`);
  assert.deepEqual(fs.readFileSync(snapshot),bytes);
  const liveOwner=acquireExecutionLease(runtime),originalOpen=fs.promises.open;
  const ownerFile=path.join(runtime,'execution.lock','owner.json'),ownerBytes=fs.readFileSync(ownerFile);
  fs.promises.open=async function(target,...args){
    const handle=await originalOpen.call(this,target,...args);
    if(String(target).startsWith(file+'.') && String(target).endsWith('.tmp')) {
      const changed=JSON.parse(ownerBytes);changed.token='changed-owner';fs.writeFileSync(ownerFile,JSON.stringify(changed));
    }
    return handle;
  };
  try {await assert.rejects(disposeTerminalExecution({...decision,lease:liveOwner}),/ownership/);assert.deepEqual(fs.readFileSync(file),bytes);}
  finally {fs.promises.open=originalOpen;fs.writeFileSync(ownerFile,ownerBytes);liveOwner.release();}
  const result=await disposeTerminalExecution(decision);assert.equal(result.disposition.outcome,'unknown');
  const owner=acquireExecutionLease(runtime);
  await assert.rejects(ExecutionJournal.open(owner,before.runId,before.definitionHash).begin('a'),/disposed/);owner.release();
  const changed=JSON.parse(fs.readFileSync(file));changed.steps[0].output='forged';fs.writeFileSync(file,JSON.stringify(changed));
  assert.throws(()=>readExecutionCheckpoint(runtime,before.runId),/snapshot/);
});

test('completed history with pending evaluation remains completed and a clean terminal run cannot be disposed',async t=>{
  const vault=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-disposition-'));
  t.after(()=>fs.rmSync(vault,{recursive:true,force:true}));
  const directory=path.join(vault,'.obsidian/plugins/auto-oc'),runtime=path.join(directory,'runtime');fs.mkdirSync(runtime,{recursive:true});
  fs.writeFileSync(path.join(directory,'data.json'),JSON.stringify({tasks:[],workflows:[]}));
  const {ExecutionJournal,readExecutionCheckpoint}=load('execution-journal'),{acquireExecutionLease}=load('execution-lease'),{inspectTerminalExecution,disposeTerminalExecution}=load('execution-abandonment');
  for(const pending of [true,false]) {
    const lease=acquireExecutionLease(runtime),j=await ExecutionJournal.create(lease,'wf','a'.repeat(64),'a');
    await j.begin('a');await j.recordResult({succeeded:true,output:'observed task success'});
    if(pending)await j.recordEvaluation('evaluation');await j.finish('a',true,'observed task success',null);
    const before=j.snapshot();lease.release();
    const decision={...inspectTerminalExecution({vault,runId:before.runId}),reason:'Reviewed evaluation uncertainty only',acknowledgedUnknownEffects:true};
    if(pending) {
      const state=await disposeTerminalExecution(decision);assert.equal(state.phase,'completed');assert.deepEqual(state.steps,before.steps);assert.equal(state.disposition.outcome,'unknown');
    } else {await assert.rejects(disposeTerminalExecution(decision),/No terminal uncertainty/);assert.deepEqual(readExecutionCheckpoint(runtime,before.runId),before);}
  }
});

test('maintenance reports a durable disposition even when a subsequent write marker fails its postcondition',async t=>{
  const vault=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-disposition-'));
  t.after(()=>fs.rmSync(vault,{recursive:true,force:true}));
  const directory=path.join(vault,'.obsidian/plugins/auto-oc'),runtime=path.join(directory,'runtime');fs.mkdirSync(runtime,{recursive:true});
  const {RELEASE_FILES,RELEASE_DESCRIPTOR}=load('release-update');
  for(const name of [...RELEASE_FILES,RELEASE_DESCRIPTOR]) {const file=path.join(directory,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.copyFileSync(path.join(root,name),file);}
  fs.writeFileSync(path.join(directory,'data.json'),JSON.stringify({tasks:[],workflows:[]}));
  const {ExecutionJournal,readExecutionCheckpoint}=load('execution-journal'),{acquireExecutionLease}=load('execution-lease'),{inspectTerminalExecution}=load('execution-abandonment');
  const lease=acquireExecutionLease(runtime),j=await ExecutionJournal.create(lease,'wf','a'.repeat(64),'a');
  await j.begin('a');await j.recordResult({succeeded:false,output:'original',cancelled:true});await j.finish('a',false,'original',null);const before=j.snapshot();lease.release();
  const decision={...inspectTerminalExecution({vault,runId:before.runId}),reason:'Individual fixture review',acknowledgedUnknownEffects:true};
  const rename=fs.promises.rename;
  fs.promises.rename=async function(from,to){await rename.call(this,from,to);if(to===path.join(runtime,before.runId+'.json'))fs.writeFileSync(path.join(directory,'data.json.write-lock'),'fixture-pending-writer');};
  try {
    await assert.rejects(load('release-maintenance').maintainRelease({sourceDirectory:root,vault,version:'1.6.8',decisions:[decision]}),error=>{
      const receipt=JSON.parse(error.message);assert.equal(receipt.applied.length,1);assert.equal(receipt.applied[0].runId,before.runId);assert.equal(receipt.loadedInObsidian,false);return true;
    });
  } finally {fs.promises.rename=rename;}
  const state=readExecutionCheckpoint(runtime,before.runId);assert.equal(state.disposition.outcome,'unknown');assert.deepEqual(state.steps,before.steps);
  assert.equal(fs.existsSync(path.join(directory,'data.json.write-lock')),true);
});

for(const [version,commit] of [['1.6.6','d5fc124'],['1.6.7','5539e570b833bd17bd51df7bd4955c1c22c6910e']])test(`official transition from authentic ${version} keeps legacy readers conservative and installs individual decisions`,async t=>{
  const vault=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-transition-'));
  t.after(()=>fs.rmSync(vault,{recursive:true,force:true}));
  const directory=path.join(vault,'.obsidian/plugins/auto-oc'),runtime=path.join(directory,'runtime');fs.mkdirSync(runtime,{recursive:true});
  const {RELEASE_FILES,RELEASE_DESCRIPTOR,verifyRelease}=load('release-update');
  const old={};
  for(const name of [...RELEASE_FILES,RELEASE_DESCRIPTOR]) {
    const result=spawnSync('git',['-c',`safe.directory=${root.replace(/\\/g,'/')}`,'show',`${commit}:${name}`],{cwd:root,maxBuffer:12*1024*1024,windowsHide:true});
    assert.equal(result.status,0,result.stderr?.toString());old[name]=result.stdout;
    const file=path.join(directory,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,result.stdout);
  }
  verifyRelease(old,version);
  fs.writeFileSync(path.join(directory,'data.json'),JSON.stringify({tasks:[],workflows:[],custom:'preserve'}));
  const catalog=fs.readFileSync(path.join(directory,'data.json'));
  const legacy=require(path.join(directory,'autooc-runtime.cjs'));
  const {ExecutionJournal}=load('execution-journal'),lease=legacy.acquireExecutionLease(runtime),states=[];
  const tasks=[0,1].map(i=>({id:'task-'+i,name:'Synthetic task '+i,taskKind:'code',code:'throw Error("must never execute");',scheduleType:'manual',status:'failed'}));
  const workflows=[0,1].map(i=>({id:'wf-'+i,name:'Synthetic workflow '+i,status:'failed',steps:[{id:'a',stepKind:'task',taskId:'task-'+i}]}));
  for(let i=0;i<2;i++) {
    const definition=load('workflow-definition').prepareWorkflowDefinition(workflows[i],tasks,{});
    const j=await ExecutionJournal.create(lease,'wf-'+i,definition.hash,'a');await j.begin('a');await j.recordResult({succeeded:false,output:'original',cancelled:true});await j.finish('a',false,'original',null);const state=j.snapshot();states.push(state);
    const binding={runId:state.runId,workflowId:state.workflowId,definitionHash:state.definitionHash,revision:state.revision,phase:state.phase,requiresReconciliation:true};
    workflows[i].runtimeExecution=binding;tasks[i].runtimeExecution={...binding,stepId:'a',stepIndex:0};
  }
  lease.release();
  fs.writeFileSync(path.join(directory,'data.json'),JSON.stringify({tasks,workflows,custom:'preserve'}));
  const boundCatalog=fs.readFileSync(path.join(directory,'data.json'));
  const oldAbandon=()=>legacy.abandonInstalledExecution({vault,runId:states[0].runId,workflowId:states[0].workflowId,revision:states[0].revision,reason:'explicit fixture authorization',acknowledgedUnknownEffects:true});
  await assert.rejects(oldAbandon(),/terminal/);
  const source=path.join(vault,'extracted-new-package'),out=path.join(vault,'package');
  const packaged=spawnSync(process.execPath,[path.join(root,'scripts/package-release.mjs'),'--out',out],{cwd:root,encoding:'utf8',timeout:60000,windowsHide:true});
  assert.equal(packaged.status,0,packaged.stderr);
  const zip=path.join(out,'auto-oc-1.6.8.zip');
  const extracted=process.platform==='win32'
    ? spawnSync('powershell.exe',['-NoProfile','-Command',`Expand-Archive -LiteralPath '${zip.replace(/'/g,"''")}' -DestinationPath '${source.replace(/'/g,"''")}'`],{encoding:'utf8',timeout:30000,windowsHide:true})
    : spawnSync('unzip',['-q',zip,'-d',source],{encoding:'utf8',timeout:30000,windowsHide:true});
  assert.equal(extracted.status,0,extracted.stderr);
  const cli=(...args)=>spawnSync(process.execPath,[path.join(source,'autooc-cli.cjs'),...args],{encoding:'utf8',timeout:30000,windowsHide:true});
  let result=cli('maintain-release','--vault',vault,'--inspect');assert.equal(result.status,0,result.stderr);
  const inspection=JSON.parse(result.stdout);assert.equal(inspection.installedVersion,version);
  const decisions=states.map(s=>({...inspection.executions.find(e=>e.runId===s.runId),reason:'Individual synthetic authorization',acknowledgedUnknownEffects:true})),decisionFile=path.join(vault,'decisions.json');
  const originals=states.map(s=>fs.readFileSync(path.join(runtime,s.runId+'.json')));
  const owner=legacy.acquireExecutionLease(runtime);
  assert.notEqual(cli('maintain-release','--vault',vault,'--inspect').status,0);owner.release();
  for(const batch of [[],[decisions[0],decisions[0]],[{...decisions[0],vaultIdentity:'wrong-vault'}],[{...decisions[0],revision:999}]]) {
    fs.writeFileSync(decisionFile,JSON.stringify(batch));
    assert.notEqual(cli('maintain-release','--vault',vault,'--decisions',decisionFile).status,0);
    states.forEach((s,i)=>assert.deepEqual(fs.readFileSync(path.join(runtime,s.runId+'.json')),originals[i]));
    assert.deepEqual(fs.readFileSync(path.join(directory,'main.js')),old['main.js']);
  }
  const packageMain=path.join(source,'main.js'),packageBytes=fs.readFileSync(packageMain);
  fs.appendFileSync(packageMain,'\n// corrupt synthetic package');
  result=cli('maintain-release','--vault',vault,'--inspect');assert.notEqual(result.status,0);assert.match(result.stderr,/integrity/);
  fs.writeFileSync(packageMain,packageBytes);
  fs.writeFileSync(decisionFile,JSON.stringify([decisions[0]]));
  result=cli('maintain-release','--vault',vault,'--decisions',decisionFile);assert.notEqual(result.status,0,'second uncertainty must still block installation');
  assert.match(result.stderr,/uncertain/);assert.deepEqual(fs.readFileSync(path.join(directory,'main.js')),old['main.js']);
  const first=JSON.parse(fs.readFileSync(path.join(runtime,states[0].runId+'.json')));
  assert.equal(first.phase,'failed');assert.equal(first.disposition.outcome,'unknown');assert.deepEqual(first.steps,states[0].steps);
  // The genuine old reader accepts the additive journal but never bypasses its
  // conservative idle check. No old command is patched or replaced first.
  const oldLease=legacy.acquireExecutionLease(runtime);
  assert.throws(()=>legacy.installRelease({directory,version,files:old,lease:oldLease}),/uncertain/);oldLease.release();
  // An installation failure after the remaining durable decision restores the
  // genuine old package. Retrying with an explicit empty batch installs without
  // undoing decisions or manufacturing a second acknowledgement.
  const {maintainRelease}=load('release-maintenance'),write=fs.writeFileSync;let injected=false;
  fs.writeFileSync=(file,...args)=>{
    if(!injected && file===path.join(directory,'main.js')) {injected=true;throw new Error('injected install failure');}
    return write(file,...args);
  };
  try {await assert.rejects(maintainRelease({sourceDirectory:source,vault,version:'1.6.8',decisions:[decisions[1]]}),/injected install failure/);} finally {fs.writeFileSync=write;}
  assert.equal(injected,true);for(const name of [...RELEASE_FILES,RELEASE_DESCRIPTOR])assert.deepEqual(fs.readFileSync(path.join(directory,name)),old[name]);
  assert.deepEqual(fs.readFileSync(path.join(directory,'data.json')),boundCatalog);
  const oldLeaseAfterRollback=legacy.acquireExecutionLease(runtime);
  assert.throws(()=>legacy.installRelease({directory,version,files:old,lease:oldLeaseAfterRollback}),/uncertain/);oldLeaseAfterRollback.release();
  fs.writeFileSync(decisionFile,'[]');
  result=cli('maintain-release','--vault',vault,'--decisions',decisionFile);assert.equal(result.status,0,result.stderr);
  const receipt=JSON.parse(result.stdout);assert.equal(receipt.loadedInObsidian,false);assert.equal(receipt.version,'1.6.8');
  for(const name of [...RELEASE_FILES,RELEASE_DESCRIPTOR])assert.deepEqual(fs.readFileSync(path.join(directory,name)),fs.readFileSync(path.join(root,name)));
  assert.deepEqual(fs.readFileSync(path.join(directory,'data.json')),boundCatalog);
  const status=JSON.parse(cli('status','--vault',vault).stdout);
  assert.ok(status.executions.every(e=>e.phase==='failed' && e.disposition.outcome==='unknown' && !e.requiresReconciliation));
  // Real plugin methods under a host double verify projection/reload, not GUI.
  const originalLoad=Module._load;let Plugin;
  try {
    Module._load=function(name,...args){if(name==='obsidian')return Object.fromEntries(['Plugin','Notice','Modal','Setting','ItemView','PluginSettingTab'].map(k=>[k,class {}]));return originalLoad.call(this,name,...args);};
    Plugin=require(path.join(directory,'main.js')).default;
  } finally {Module._load=originalLoad;}
  const plugin=new Plugin();plugin.manifest={id:'auto-oc'};plugin.app={vault:{adapter:{basePath:vault},configDir:'.obsidian'},workspace:{getLeavesOfType:()=>[]}};
  plugin.reservePluginExecution();
  try {
    await plugin.loadSettings();
    assert.ok(plugin.settings.workflows.every(w=>w.status==='failed' && w.runtimeExecution.disposition.outcome==='unknown'));
    assert.ok(plugin.settings.tasks.every(task=>task.status==='failed' && task.output==='original' && task.runtimeExecution.disposition.outcome==='unknown'));
    for(const w of workflows)assert.equal(plugin.settings.workflows.find(x=>x.id===w.id).runtimeExecution.disposition.runId,w.runtimeExecution.runId);
  } finally {plugin.releasePluginExecution(false);}
  const backup=JSON.parse(fs.readFileSync(path.join(receipt.maintenanceBackup,'backup-integrity.json')));
  const crypto=require('node:crypto');
  for(const [name,hash] of Object.entries(backup.sha256))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(receipt.maintenanceBackup,name))).digest('hex'),hash);
});
test('installed CLI abandonment is exclusive, exact, audited and allows new work without replay',async t=>{
  const vault=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-abandon-'));
  t.after(()=>{assert.equal(path.dirname(fs.realpathSync(vault)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(vault).startsWith('autooc-abandon-'));fs.rmSync(vault,{recursive:true,force:true});});
  const directory=path.join(vault,'.obsidian/plugins/auto-oc'),runtime=path.join(directory,'runtime');fs.mkdirSync(runtime,{recursive:true});
  const {prepareWorkflowDefinition}=load('workflow-definition'),{ExecutionJournal}=load('execution-journal'),{acquireExecutionLease}=load('execution-lease');
  const tasks=[{id:'old',name:'Old',taskKind:'code',code:'throw Error("must never replay");',scheduleType:'manual',status:'pending'},
    {id:'new',name:'New',taskKind:'code',code:'output="new task ran";',scheduleType:'manual',status:'pending'}];
  const workflow={id:'wf',name:'Old workflow',steps:[{id:'a',stepKind:'task',taskId:'old'}],status:'pending'};
  const definition=prepareWorkflowDefinition(workflow,tasks,{}),lease=acquireExecutionLease(runtime);
  const journal=await ExecutionJournal.create(lease,'wf',definition.hash,'a');await journal.begin('a');
  await journal.recordCodexThread('a','lost-thread','lost-turn');const before=journal.snapshot();
  workflow.runtimeExecution={runId:before.runId,workflowId:'wf',revision:before.revision,requiresReconciliation:true};
  tasks[0].runtimeExecution={...workflow.runtimeExecution,stepId:'a',stepIndex:0};
  const config=path.join(directory,'data.json');fs.writeFileSync(config,JSON.stringify({tasks,workflows:[workflow]}));
  const catalog=fs.readFileSync(config,'utf8');
  const cli=(...args)=>spawnSync(process.execPath,[path.join(root,'autooc-cli.cjs'),...args],{encoding:'utf8',timeout:15000});
  const args=['abandon','--vault',vault,'--workflow','wf','--run',before.runId,'--revision',String(before.revision),'--reason','Explicit human decision','--acknowledge-unknown-effects','true'];
  assert.notEqual(cli(...args).status,0,'live owner must block abandonment');lease.release();
  assert.notEqual(cli(...args.slice(0,-2)).status,0,'missing acknowledgement');
  const wrong=[...args];wrong[8]=String(before.revision+1);assert.notEqual(cli(...wrong).status,0);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(runtime,before.runId+'.json'))),before);
  const result=cli(...args);assert.equal(result.status,0,result.stderr);
  const abandoned=JSON.parse(result.stdout);assert.equal(abandoned.phase,'abandoned');assert.equal(abandoned.abandonment.outcome,'unknown');
  const after=JSON.parse(fs.readFileSync(path.join(runtime,before.runId+'.json')));
  assert.deepEqual(after.steps,before.steps);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(runtime,after.abandonment.snapshot))),before);
  assert.equal(fs.readFileSync(config,'utf8'),catalog,'decision does not overwrite loaded catalog');
  assert.notEqual(cli(...args).status,0,'stale repeat rejected');
  const status=JSON.parse(cli('status','--vault',vault).stdout).executions[0];
  assert.equal(status.phase,'abandoned');assert.equal(status.requiresReconciliation,false);
  assert.notEqual(cli('resume','--vault',vault,'--workflow','wf','--run',before.runId).status,0,'abandoned identity cannot restart');
  const {recoverWorkflowProgress}=load('workflow-progress');
  const projected=recoverWorkflowProgress(workflow,tasks,{},after,before.runId);
  assert.equal(projected.status,'abandoned');assert.equal(projected.steps[0].status,'abandoned');
  const originalLoad=Module._load;
  let Plugin;
  try {
    Module._load=function(name,...args) {
      if(name==='obsidian')return Object.fromEntries(['Plugin','Notice','Modal','Setting','ItemView','PluginSettingTab'].map(key=>[key,class {}]));
      return originalLoad.call(this,name,...args);
    };
    Plugin=require(path.join(root,'main.js')).default;
  } finally {Module._load=originalLoad;}
  const plugin=new Plugin();plugin.manifest={id:'auto-oc'};
  plugin.app={vault:{adapter:{basePath:vault},configDir:'.obsidian'},workspace:{getLeavesOfType:()=>[]}};
  plugin.reservePluginExecution();
  try {
    await plugin.loadSettings();
    assert.equal(plugin.settings.workflows[0].status,'abandoned');
    assert.equal(plugin.settings.tasks[0].status,'abandoned');
    assert.equal(plugin.settings.tasks[0].runtimeExecution.abandonment.outcome,'unknown');
    assert.equal(plugin.settings.tasks[0].runtimeExecution.requiresReconciliation,false);
  } finally {plugin.releasePluginExecution(false);}
  const next=cli('run','--vault',vault,'--task','new');assert.equal(next.status,0,next.stderr);
  assert.equal(JSON.parse(next.stdout).phase,'completed');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(runtime,before.runId+'.json'))),after);
  const {assertIdleJournals}=load('execution-idle');assert.equal(assertIdleJournals(runtime).get(before.runId).phase,'abandoned');
});
