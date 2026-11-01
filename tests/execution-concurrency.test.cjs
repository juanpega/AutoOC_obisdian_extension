const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const runtime=require('../autooc-runtime.cjs');
function gate(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function fixture(t,count=3){
  const vault=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-concurrency-'));
  const directory=path.join(vault,'.obsidian/plugins/auto-oc');fs.mkdirSync(directory,{recursive:true});
  const tasks=Array.from({length:count},(_,i)=>String.fromCharCode(97+i)).map(id=>({id,name:id,taskKind:'code',concurrency:'independent',code:`output="${id}";`,scheduleType:'manual'}));
  const file=path.join(directory,'data.json');fs.writeFileSync(file,JSON.stringify({tasks,workflows:[],defaultConcurrency:'exclusive',maxConcurrentExecutions:2,custom:{retained:true}}));
  const f={vault,directory,file,tasks};
  t.after(async()=>{await f.dispose?.();assert.equal(path.dirname(fs.realpathSync(vault)),fs.realpathSync(os.tmpdir()));assert.match(path.basename(vault),/^autooc-concurrency-/);fs.rmSync(vault,{recursive:true,force:true});});
  return f;
}
function pluginFixture(t,count=3){
  const f=fixture(t,count),bundle={exports:{}};
  const obsidian=Object.fromEntries(['Plugin','Notice','Modal','Setting','ItemView','PluginSettingTab','WorkspaceLeaf'].map(k=>[k,class{}]));
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8')+'\nmodule.exports.setAdapter=value=>{createWorkflowTaskAdapter=()=>value;};module.exports.prepareAsync=prepareWorkflowDefinitionAsync;',{
    module:bundle,exports:bundle.exports,require:n=>n==='obsidian'?obsidian:require(n),process,Buffer,console,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,
    window:{setInterval,clearInterval,clearTimeout},
  });
  const p=new bundle.exports.default();p.manifest={id:'auto-oc'};p.app={vault:{adapter:{basePath:f.vault},configDir:'.obsidian'},workspace:{getLeavesOfType:()=>[],detachLeavesOfType(){}}};
  p.createVaultMutationBatch=()=>({record(){},async flush(){}});p.reservePluginExecution();
  f.dispose=async()=>{for(const e of p.sharedWorkflowExecutions.values())e.controller.abort();p.cliRequestHost?.close();if(p.cliRequestTimer!==undefined)clearInterval(p.cliRequestTimer);await p.cliRequestHost?.drain();p.releasePluginExecution(false);};
  const started=new Map(f.tasks.map(t=>[t.id,gate()])),finish=new Map(f.tasks.map(t=>[t.id,gate()]));
  const effects=[];
  bundle.exports.setAdapter({supports:()=>true,async execute(task,prompt,signal){effects.push(task.id);started.get(task.id).resolve();return new Promise(resolve=>{
    const abort=()=>resolve({succeeded:false,cancelled:true,output:'cancelled-'+task.id});
    signal.addEventListener('abort',abort,{once:true});
    finish.get(task.id).promise.then(()=>{signal.removeEventListener('abort',abort);resolve({succeeded:true,output:'result-'+task.id});});
    if(signal.aborted)abort();
  });}});
  return {...f,p,started,finish,effects,prepareAsync:bundle.exports.prepareAsync};
}

test('plugin overlaps two tasks, preserves interleaved settings and finishes in reverse order',async t=>{
  const f=pluginFixture(t),{p}=f;await p.loadSettings();
  const a=p.runSharedWorkflow('@task:a',undefined,false,false,'a');await f.started.get('a').promise;
  const b=p.runSharedWorkflow('@task:b',undefined,false,false,'b');await f.started.get('b').promise;
  assert.equal(p.sharedWorkflowExecutions.size,2);
  const aId=p.sharedWorkflowExecutions.get('@task:a').runId,bId=p.sharedWorkflowExecutions.get('@task:b').runId;assert.notEqual(aId,bId);
  await assert.rejects(p.killWorkflow('@task:a','stale-run'),/changed/);
  assert.equal(p.sharedWorkflowExecutions.get('@task:a').controller.signal.aborted,false);
  p.settings.custom.updated='during-both';await p.saveSettings(false);
  await assert.rejects(p.runSharedWorkflow('@task:c',undefined,false,false,'c'),/limit/);
  await assert.rejects(p.runSharedWorkflow('@task:a',undefined,false,false,'a'),/already executing|already starting/);
  f.finish.get('b').resolve();assert.equal((await b).phase,'completed');
  assert.equal(p.sharedWorkflowExecutions.get('@task:a').controller.signal.aborted,false);
  f.finish.get('a').resolve();assert.equal((await a).phase,'completed');
  await p.loadSettings();
  const saved=JSON.parse(fs.readFileSync(f.file));assert.deepEqual(saved.custom,{retained:true,updated:'during-both'});
  assert.deepEqual(saved.tasks.slice(0,2).map(t=>[t.output,t.runtimeExecution.runId]),[['result-a',aId],['result-b',bId]]);
  assert.deepEqual(f.effects,['a','b']);
});

test('stopping one task leaves the other active with separate progress and result',async t=>{
  const f=pluginFixture(t),{p}=f;await p.loadSettings();
  const a=p.runSharedWorkflow('@task:a',undefined,false,false,'a');await f.started.get('a').promise;
  const b=p.runSharedWorkflow('@task:b',undefined,false,false,'b');await f.started.get('b').promise;
  const stopped=p.settings.tasks.find(t=>t.id==='a');await p.killTask('a',p.taskStopIdentity(stopped));await a;
  assert.equal(p.sharedWorkflowExecutions.get('@task:b').controller.signal.aborted,false);
  assert.equal(p.settings.tasks.find(t=>t.id==='b').status,'running');
  f.finish.get('b').resolve();assert.equal((await b).phase,'completed');
  assert.equal(JSON.parse(fs.readFileSync(f.file)).tasks.find(t=>t.id==='b').output,'result-b');
});

test('GUI and delegated CLI share admission while request cancellation remains isolated',async t=>{
  const f=pluginFixture(t),{p}=f;await p.loadSettings();p.startCliRequests();
  const a=p.runSharedWorkflow('@task:a',undefined,false,false,'a');await f.started.get('a').promise;
  const id=require('node:crypto').randomUUID(),owner=p.pluginExecutionLease.token;
  const mailbox=path.join(f.directory,'runtime','cli-'+owner);
  fs.writeFileSync(path.join(mailbox,id+'.request'),JSON.stringify({protocol:1,owner,id,command:'run',taskId:'b',expiresAt:Date.now()+30000}));
  await p.cliRequestHost.poll();await f.started.get('b').promise;
  const bound=p.sharedWorkflowExecutions.get('@task:b').runId;assert.ok(bound);
  fs.writeFileSync(path.join(mailbox,id+'.cancel'),JSON.stringify({protocol:1,owner,id}));await p.cliRequestHost.poll();
  await p.cliRequestHost.drain();
  assert.equal(p.sharedWorkflowExecutions.get('@task:a').controller.signal.aborted,false);
  const receipt=JSON.parse(fs.readFileSync(path.join(mailbox,id+'.receipt')));
  assert.equal(receipt.checkpoint.runId,bound);assert.equal(receipt.status,'completed');
  f.finish.get('a').resolve();await a;
  assert.equal(JSON.parse(fs.readFileSync(f.file)).tasks.find(t=>t.id==='a').output,'result-a');
});

test('Play uses the same admission and unload drains both while retaining uncertain cancellations',async t=>{
  const f=pluginFixture(t),{p}=f;await p.loadSettings();
  const a=p.runTask(p.settings.tasks[0]);await f.started.get('a').promise;
  const b=p.runTask(p.settings.tasks[1]);await f.started.get('b').promise;
  const owner=p.pluginExecutionLease;
  const unloading=p.onunload();assert.equal(p.pluginExecutionLease,owner);
  await assert.rejects(p.runTask(p.settings.tasks[2]),/stopped/);
  await Promise.all([a,b,unloading]);
  assert.equal(p.sharedWorkflowExecutions.size,0);assert.equal(p.sharedCompletions.size,0);
  assert.equal(p.pluginExecutionLease,owner);
  const saved=JSON.parse(fs.readFileSync(f.file));assert.equal(saved.tasks[0].output,'cancelled-a');assert.equal(saved.tasks[1].output,'cancelled-b');
});

test('external catalog edit stops the next effect boundary and retains the execution reservation',async t=>{
  const f=pluginFixture(t),{p}=f;await p.loadSettings();
  const a=p.runSharedWorkflow('@task:a',undefined,false,false,'a');await f.started.get('a').promise;
  const rejection=assert.rejects(a,/changed externally/);
  const saved=JSON.parse(fs.readFileSync(f.file));saved.custom.external='preserved';fs.writeFileSync(f.file,JSON.stringify(saved));
  f.finish.get('a').resolve();await rejection;
  assert.equal(JSON.parse(fs.readFileSync(f.file)).custom.external,'preserved');
  await assert.rejects(p.runSharedWorkflow('@task:b',undefined,false,false,'b'),/reconciliation|externally|unresolved/);
  assert.deepEqual(f.effects,['a']);
});

test('local edits made after a save snapshot are retained and prevent execution effects',async t=>{
  const f=pluginFixture(t),{p}=f;await p.loadSettings();
  const save=p.settingsWriter.save.bind(p.settingsWriter);
  p.settingsWriter.save=(file,snapshot,validate)=>save(file,()=>{
    const value=snapshot();queueMicrotask(()=>{p.settings.custom.unsaved='kept';});return value;
  },validate);
  await assert.rejects(p.runSharedWorkflow('@task:a',undefined,false,false,'a'),/changed during save/);
  assert.equal(p.settings.custom.unsaved,'kept');assert.deepEqual(f.effects,[]);
  assert.equal(JSON.parse(fs.readFileSync(f.file)).custom.unsaved,undefined);
});

test('official disposition clears only the resolved retained reservation',async t=>{
  const f=pluginFixture(t),{p}=f;await p.loadSettings();
  const a=p.runSharedWorkflow('@task:a',undefined,false,false,'a');await f.started.get('a').promise;
  const runId=p.sharedWorkflowExecutions.get('@task:a').runId;
  await p.killTask('a',p.taskStopIdentity(p.settings.tasks[0]));await a;
  await assert.rejects(p.runSharedWorkflow('@task:b',undefined,false,false,'b'),/reconciliation/);
  const observed=runtime.inspectTerminalExecution({vault:f.vault,runId});
  await runtime.disposeTerminalExecution({...observed,lease:p.pluginExecutionLease,reason:'Synthetic human disposition; effects remain unknown',acknowledgedUnknownEffects:true});
  await p.loadSettings();
  const b=p.runSharedWorkflow('@task:b',undefined,false,false,'b');await f.started.get('b').promise;
  f.finish.get('b').resolve();await b;
  const previous=JSON.parse(fs.readFileSync(path.join(f.directory,'runtime',runId+'.json')));assert.ok(previous.disposition);assert.equal(previous.steps[0].result.cancelled,true);
});

function definition(task,extra={}){return runtime.prepareWorkflowDefinition({id:'@task:'+task.id,steps:[{id:'s',stepKind:'task',taskId:task.id}]},[task],extra);}
test('an invalid resume cannot retain a provisional reservation for the wrong definition',async t=>{
  const f=fixture(t),dir=path.join(f.directory,'runtime');fs.mkdirSync(dir);const lease=runtime.acquireExecutionLease(dir);f.dispose=()=>lease.release();
  const original=runtime.prepareWorkflowDefinition({id:'w',steps:[{id:'s',stepKind:'code',code:'output="done";'}]},[],{});
  const options={definition:original,vaultBase:f.vault,runtimeDirectory:dir,lease,redact:s=>s};
  const state=await runtime.runCodeWorkflowHost(options);
  const changed=runtime.prepareWorkflowDefinition({...original.workflow,name:'changed'},[],{});
  await assert.rejects(runtime.runCodeWorkflowHost({...options,definition:changed,resumeRunId:state.runId}),/identity or definition changed/);
  assert.equal((await runtime.runCodeWorkflowHost({...options,resumeRunId:state.runId})).runId,state.runId);
  const next=runtime.prepareWorkflowDefinition({...original.workflow,id:'next'},[],{});
  assert.equal((await runtime.runCodeWorkflowHost({...options,definition:next})).phase,'completed');
});

test('a new owner cannot bypass a terminal label that still has uncertain effects',async t=>{
  const f=fixture(t),dir=path.join(f.directory,'runtime');fs.mkdirSync(dir);let lease=runtime.acquireExecutionLease(dir);f.dispose=()=>lease.release();
  const original=definition({...f.tasks[0],concurrency:'parallel'});
  const state=await runtime.runCodeWorkflowHost({definition:original,vaultBase:f.vault,runtimeDirectory:dir,lease,redact:s=>s,
    tasks:{supports:()=>true,execute:async()=>({succeeded:false,cancelled:true,output:'unknown outcome'})}});
  assert.equal(state.phase,'failed');lease.release();lease=runtime.acquireExecutionLease(dir);
  const before=fs.readFileSync(path.join(dir,state.runId+'.json'));
  const next=runtime.prepareWorkflowDefinition({id:'next',concurrency:'parallel',steps:[{id:'s',stepKind:'code',code:'output="must not execute";'}]},[],{});
  await assert.rejects(runtime.runCodeWorkflowHost({definition:next,vaultBase:f.vault,runtimeDirectory:dir,lease,redact:s=>s}),/requires continuation or reconciliation/);
  assert.deepEqual(fs.readFileSync(path.join(dir,state.runId+'.json')),before);
});
test('admission reserves referenced tasks, honors explicit exclusivity, and retains unknown outcomes',t=>{
  const f=fixture(t),dir=path.join(f.directory,'runtime');fs.mkdirSync(dir);const lease=runtime.acquireExecutionLease(dir);f.dispose=()=>lease.release();
  const coordinator=runtime.executionCoordinator(lease),first=coordinator.admit(definition(f.tasks[0]),f.vault);
  assert.throws(()=>coordinator.admit(runtime.prepareWorkflowDefinition({id:'other',concurrency:'independent',steps:[{id:'s',taskId:'a'}]},f.tasks,{}),f.vault),/referenced task/);
  const exclusive=definition({...f.tasks[1],concurrency:'exclusive'});assert.throws(()=>coordinator.admit(exclusive,f.vault),/Exclusive/);
  first.runId='synthetic';first.finish();assert.throws(()=>coordinator.admit(definition(f.tasks[1]),f.vault),/reconciliation/);
  assert.equal(fs.existsSync(path.join(dir,'execution.lock')),true);
});

test('workspace containment and common Git metadata conflict before effects',t=>{
  const f=fixture(t),dir=path.join(f.directory,'runtime');fs.mkdirSync(dir);const lease=runtime.acquireExecutionLease(dir);f.dispose=()=>lease.release();
  const a=path.join(f.vault,'work'),b=path.join(a,'nested');fs.mkdirSync(b,{recursive:true});
  const coordinator=runtime.executionCoordinator(lease),task=(id,workingDirectory)=>({id,taskKind:'codex',concurrency:'independent',prompt:'fixture',workingDirectory});
  const first=coordinator.admit(definition(task('a',a)),f.vault);assert.throws(()=>coordinator.admit(definition(task('b',b)),f.vault),/resource/);first.finish();
  const {execFileSync}=require('node:child_process');execFileSync('git',['init',a],{windowsHide:true,stdio:'ignore'});
  const c=path.join(a,'sibling');fs.mkdirSync(c);
  coordinator.admit(definition(task('a',b)),f.vault);assert.throws(()=>coordinator.admit(definition(task('b',c)),f.vault),/resource/);
});

test('broad Code capabilities, interactive engines and evaluations remain exclusive',t=>{
  const f=fixture(t),dir=path.join(f.directory,'runtime');fs.mkdirSync(dir);const lease=runtime.acquireExecutionLease(dir);f.dispose=()=>lease.release();const coordinator=runtime.executionCoordinator(lease);
  const first=coordinator.admit(definition(f.tasks[0]),f.vault);
  for(const overrides of [{codeAllowVault:true},{codeAllowFiles:true},{codeAllowTerminal:true},{taskKind:'codex',interactiveTerminal:true}])assert.throws(()=>coordinator.admit(definition({...f.tasks[1],...overrides}),f.vault),/Exclusive/);
  assert.throws(()=>coordinator.admit(definition({...f.tasks[1],concurrency:'invalid'}),f.vault),/Invalid concurrency/);
  first.finish();
});

test('export and import preserve explicit policy and reject unknown policies',async t=>{
  const f=pluginFixture(t),{p}=f;await p.loadSettings();p.manifest.version='synthetic';
  const exported=JSON.parse(p.buildExportJson(p.settings.tasks,[]));assert.equal(exported.tasks[0].concurrency,'independent');
  await p.importFromData(exported);assert.equal(p.settings.tasks.at(-1).concurrency,'independent');
  exported.tasks[0].concurrency='invalid';await assert.rejects(p.importFromData(exported),/Invalid concurrency/);
});

function enableSharedVault(f,limit=0){
  const data=JSON.parse(fs.readFileSync(f.file));
  data.defaultConcurrency='parallel';data.maxConcurrentExecutions=limit;
  for(const task of data.tasks){delete task.concurrency;task.taskKind='codex';task.prompt='Synthetic provider, no external effects';}
  fs.writeFileSync(f.file,JSON.stringify(data));
}
async function waitForStart(f,id,run){
  await Promise.race([f.started.get(id).promise,run.then(()=>{throw new Error('Run ended before its adapter started');})]);
}

test('Play defaults to eight parallel AI tasks in the same vault without saved preferences and preserves separate results',async t=>{
  const f=pluginFixture(t,8);enableSharedVault(f);await f.p.loadSettings();
  const data=JSON.parse(fs.readFileSync(f.file));delete data.defaultConcurrency;delete data.maxConcurrentExecutions;
  fs.writeFileSync(f.file,JSON.stringify(data));await f.p.loadSettings();
  const runs=[];
  for(const task of f.p.settings.tasks){
    const run=f.p.runTask(task);runs.push(run);await waitForStart(f,task.id,run);
  }
  assert.equal(f.p.sharedWorkflowExecutions.size,8);
  assert.equal(new Set([...f.p.sharedWorkflowExecutions.values()].map(e=>e.runId)).size,8);
  f.p.settings.custom.duringParallel=true;await f.p.saveSettings(false);
  for(const task of [...f.tasks].reverse())f.finish.get(task.id).resolve();
  await Promise.all(runs);
  const saved=JSON.parse(fs.readFileSync(f.file));
  assert.equal(saved.custom.duringParallel,true);
  assert.equal(saved.defaultConcurrency,undefined);assert.equal(saved.maxConcurrentExecutions,undefined);
  for(const task of saved.tasks){assert.equal(task.status,'completed');assert.equal(task.output,'result-'+task.id);assert.ok(task.runtimeExecution.runId);}
});

test('Play defaults to overlapping workflows with distinct reusable tasks in one vault',async t=>{
  const f=pluginFixture(t);enableSharedVault(f);
  const data=JSON.parse(fs.readFileSync(f.file));delete data.defaultConcurrency;delete data.maxConcurrentExecutions;
  data.workflows=data.tasks.map(task=>({id:'w-'+task.id,name:'Workflow '+task.id,steps:[{id:'step',stepKind:'task',taskId:task.id}]}));
  fs.writeFileSync(f.file,JSON.stringify(data));await f.p.loadSettings();
  const runs=[];
  for(const workflow of f.p.settings.workflows){
    const run=f.p.runWorkflow(workflow);runs.push(run);await waitForStart(f,workflow.steps[0].taskId,run);
  }
  assert.equal(f.p.sharedWorkflowExecutions.size,3);
  for(const task of f.tasks)f.finish.get(task.id).resolve();await Promise.all(runs);
  const saved=JSON.parse(fs.readFileSync(f.file));
  for(const workflow of saved.workflows){assert.equal(workflow.status,'completed');assert.ok(workflow.runtimeExecution.runId);}
});

test('cancelled parallel task retains its attempt without blocking a different task in the same owner',async t=>{
  const f=pluginFixture(t);enableSharedVault(f);await f.p.loadSettings();
  const a=f.p.runTask(f.p.settings.tasks[0]);await waitForStart(f,'a',a);
  const b=f.p.runTask(f.p.settings.tasks[1]);await waitForStart(f,'b',b);
  const aRun=f.p.sharedWorkflowExecutions.get('@task:a').runId;
  await f.p.killTask('a',f.p.taskStopIdentity(f.p.settings.tasks[0]));await a;
  const before=fs.readFileSync(path.join(f.directory,'runtime',aRun+'.json'));
  const c=f.p.runTask(f.p.settings.tasks[2]);await waitForStart(f,'c',c);
  assert.equal(f.p.sharedWorkflowExecutions.get('@task:b').controller.signal.aborted,false);
  await assert.rejects(f.p.runSharedWorkflow('@task:a',undefined,false,true,'a'),/reserved|uncertain|Unfinished|reconciliation/);
  f.finish.get('b').resolve();f.finish.get('c').resolve();await Promise.all([b,c]);
  assert.deepEqual(fs.readFileSync(path.join(f.directory,'runtime',aRun+'.json')),before);
});

test('shared-vault admission keeps explicit exclusivity, task identity and branch/interactive guards',t=>{
  const f=fixture(t),dir=path.join(f.directory,'runtime');fs.mkdirSync(dir);
  const lease=runtime.acquireExecutionLease(dir);f.dispose=()=>lease.release();const coordinator=runtime.executionCoordinator(lease);
  const settings={defaultConcurrency:'parallel',maxConcurrentExecutions:0};
  const task=id=>({id,taskKind:'codex',prompt:'fixture',concurrency:'parallel',workingDirectory:f.vault});
  require('node:child_process').execFileSync('git',['init',f.vault],{windowsHide:true,stdio:'ignore'});
  coordinator.admit(definition(task('a'),settings),f.vault);
  coordinator.admit(definition(task('b'),settings),f.vault);
  assert.throws(()=>coordinator.admit(definition(task('a'),settings),f.vault),/reserved/);
  for(const overrides of [{concurrency:'exclusive'},{branch:'feature'},{interactiveTerminal:true}]){
    assert.throws(()=>coordinator.admit(definition({...task('c'),...overrides},settings),f.vault),/Exclusive/);
  }
  assert.throws(()=>coordinator.admit(definition({...task('c'),concurrency:'independent'},settings),f.vault),/resource/);
  // Code permissions are unchanged; explicitly parallel trusted Code can share a vault.
  const code=definition({...f.tasks[2],concurrency:'parallel',codeAllowVault:true,codeAllowFiles:true},settings);
  coordinator.admit(code,f.vault);
  assert.equal(code.tasks[0].codeAllowTerminal,undefined);
});

test('configured capacity replaces two, applies to new runs, and Unlimited has no fixed ceiling',t=>{
  const f=fixture(t),dir=path.join(f.directory,'runtime');fs.mkdirSync(dir);const lease=runtime.acquireExecutionLease(dir);f.dispose=()=>lease.release();
  const coordinator=runtime.executionCoordinator(lease),prepare=(id,limit)=>definition({id,taskKind:'code',code:'output=1;'}, {defaultConcurrency:'parallel',maxConcurrentExecutions:limit});
  for(let i=0;i<4;i++)coordinator.admit(prepare('limited-'+i,4),f.vault);
  assert.throws(()=>coordinator.admit(prepare('fifth',4),f.vault),/limit reached \(4\)/);
  assert.throws(()=>coordinator.admit(prepare('lowered',1),f.vault),/limit reached \(1\)/);
  for(let i=0;i<40;i++)coordinator.admit(prepare('unlimited-'+i,0),f.vault);
  for(const invalid of [-1,1.5,'4',Infinity,NaN,null])assert.throws(()=>prepare('invalid',invalid),/whole number/);
  assert.throws(()=>definition(f.tasks[0],{defaultConcurrency:'invalid'}),/Invalid concurrency/);
});

test('admission preferences preserve historical fingerprints and are captured before asynchronous preparation yields',async t=>{
  const f=pluginFixture(t),task={...f.tasks[0],concurrency:undefined};
  const previous=definition(task),settings={defaultConcurrency:'parallel',maxConcurrentExecutions:0};
  const current=definition(task,settings);
  assert.equal(current.hash,previous.hash);
  const pending=f.prepareAsync(current.workflow,[task],settings);
  settings.defaultConcurrency='exclusive';settings.maxConcurrentExecutions=1;
  const captured=await pending;
  assert.equal(captured.hash,previous.hash);
  assert.deepEqual(JSON.parse(JSON.stringify(captured.admissionSettings)),{defaultConcurrency:'parallel',maxConcurrentExecutions:0});
  assert.equal(Object.isFrozen(captured.admissionSettings),true);
});

test('parallel policy survives export/import and missing policy continues to inherit',async t=>{
  const f=pluginFixture(t);await f.p.loadSettings();f.p.manifest.version='synthetic';
  f.p.settings.tasks[0].concurrency='parallel';delete f.p.settings.tasks[1].concurrency;
  const exported=JSON.parse(f.p.buildExportJson(f.p.settings.tasks,[]));
  assert.equal(exported.tasks[0].concurrency,'parallel');assert.equal(exported.tasks[1].concurrency,undefined);
  await f.p.importFromData(exported);
  assert.equal(f.p.settings.tasks.at(-3).concurrency,'parallel');assert.equal(f.p.settings.tasks.at(-2).concurrency,undefined);
});
