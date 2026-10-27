const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const runtime=require('../autooc-runtime.cjs');
function gate(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function fixture(t){
  const vault=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-concurrency-'));
  const directory=path.join(vault,'.obsidian/plugins/auto-oc');fs.mkdirSync(directory,{recursive:true});
  const tasks=['a','b','c'].map(id=>({id,name:id,taskKind:'code',concurrency:'independent',code:`output="${id}";`,scheduleType:'manual'}));
  const file=path.join(directory,'data.json');fs.writeFileSync(file,JSON.stringify({tasks,workflows:[],custom:{retained:true}}));
  const f={vault,directory,file,tasks};
  t.after(async()=>{await f.dispose?.();assert.equal(path.dirname(fs.realpathSync(vault)),fs.realpathSync(os.tmpdir()));assert.match(path.basename(vault),/^autooc-concurrency-/);fs.rmSync(vault,{recursive:true,force:true});});
  return f;
}
function pluginFixture(t){
  const f=fixture(t),bundle={exports:{}};
  const obsidian=Object.fromEntries(['Plugin','Notice','Modal','Setting','ItemView','PluginSettingTab','WorkspaceLeaf'].map(k=>[k,class{}]));
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8')+'\nmodule.exports.setAdapter=value=>{createWorkflowTaskAdapter=()=>value;};',{
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
  return {...f,p,started,finish,effects};
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
  const original=definition(f.tasks[0]);
  const state=await runtime.runCodeWorkflowHost({definition:original,vaultBase:f.vault,runtimeDirectory:dir,lease,redact:s=>s,
    tasks:{supports:()=>true,execute:async()=>({succeeded:false,cancelled:true,output:'unknown outcome'})}});
  assert.equal(state.phase,'failed');lease.release();lease=runtime.acquireExecutionLease(dir);
  const before=fs.readFileSync(path.join(dir,state.runId+'.json'));
  const next=runtime.prepareWorkflowDefinition({id:'next',concurrency:'independent',steps:[{id:'s',stepKind:'code',code:'output="must not execute";'}]},[],{});
  await assert.rejects(runtime.runCodeWorkflowHost({definition:next,vaultBase:f.vault,runtimeDirectory:dir,lease,redact:s=>s}),/requires continuation or reconciliation/);
  assert.deepEqual(fs.readFileSync(path.join(dir,state.runId+'.json')),before);
});
test('admission reserves referenced tasks, defaults to exclusive, and retains unknown outcomes',t=>{
  const f=fixture(t),dir=path.join(f.directory,'runtime');fs.mkdirSync(dir);const lease=runtime.acquireExecutionLease(dir);f.dispose=()=>lease.release();
  const coordinator=runtime.executionCoordinator(lease),first=coordinator.admit(definition(f.tasks[0]),f.vault);
  assert.throws(()=>coordinator.admit(runtime.prepareWorkflowDefinition({id:'other',concurrency:'independent',steps:[{id:'s',taskId:'a'}]},f.tasks,{}),f.vault),/referenced task/);
  const exclusive=definition({...f.tasks[1],concurrency:undefined});assert.throws(()=>coordinator.admit(exclusive,f.vault),/Exclusive/);
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

test('export and import preserve explicit policy and old definitions remain exclusive',async t=>{
  const f=pluginFixture(t),{p}=f;await p.loadSettings();p.manifest.version='synthetic';
  const exported=JSON.parse(p.buildExportJson(p.settings.tasks,[]));assert.equal(exported.tasks[0].concurrency,'independent');
  await p.importFromData(exported);assert.equal(p.settings.tasks.at(-1).concurrency,'independent');
  exported.tasks[0].concurrency='invalid';await assert.rejects(p.importFromData(exported),/Invalid concurrency/);
});
