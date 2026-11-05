const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const {execFileSync}=require('node:child_process');
function loader(overrides={}) {
  const cache=new Map();
  function load(name) {
    if(overrides[name])return overrides[name];
    if(cache.has(name))return cache.get(name).exports;
    const file=path.resolve(__dirname,'../'+name+'.ts'),m=new Module(file,module);
    m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));cache.set(name,m);
    const original=m.require.bind(m);m.require=id=>id.startsWith('./')?load(id.slice(2)):original(id);
    m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
    return m.exports;
  }
  return load;
}
const load=loader(),{prepareWorkflowDefinition:prepare}=load('workflow-definition'),{runCodeWorkflowHost:run}=load('code-workflow-host');

const code=(id,code)=>({id,stepKind:'code',code});
const call=(id,workflowId)=>({id,stepKind:'workflow',workflowId});
const flow=(id,steps)=>({id,name:id,handoffOutput:true,steps});
async function fixture(work) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-nesting-'));
  fs.mkdirSync(path.join(root,'runtime'));
  try { return await work(root); } finally { fs.rmSync(root,{recursive:true,force:true}); }
}
const execute=(root,definition,extra={})=>run({definition,vaultBase:root,runtimeDirectory:path.join(root,'runtime'),redact:s=>s,...extra});

test('nested calls pass input, return output, isolate local outputs and permit repeated children',()=>fixture(async root=>{
  const leaf=flow('leaf',[code('first','output = input + ":leaf";')]);
  const child=flow('child',[code('first','if (Object.keys(outputs).length) throw Error("leaked outputs"); output = input + ":child";'),call('nested','leaf')]);
  const parent=flow('parent',[code('first','output="start";'),call('one','child'),call('two','child'),code('last','output=JSON.stringify({input,outputs});')]);
  const definition=prepare(parent,[],{workflows:[parent,child,leaf]});
  const state=await execute(root,definition);
  assert.equal(state.phase,'completed');
  const result=JSON.parse(state.steps.at(-1).output);
  assert.equal(result.input,'start:child:leaf:child:leaf');
  assert.deepEqual(Object.keys(result.outputs),['first','one','two']);
  assert.equal(result.outputs.one,'start:child:leaf');
  const projected=load('workflow-progress').projectWorkflowProgress(parent,[],{workflows:[parent,child,leaf]},state,state.runId);
  assert.deepEqual(projected.steps.map(s=>s.status),['completed','completed','completed','completed']);
  assert.equal(projected.steps[1].output,'start:child:leaf');
}));

test('child failures reach the parent transition and force can explicitly continue',()=>fixture(async root=>{
  const child=flow('child',[code('bad','throw Error("child failed")')]);
  for(const force of [false,true]) {
    const parent=flow('parent-'+force,[{...call('child','child'),transitions:[{toStepId:'after',mode:force?'force':'default'}]},code('after','output="recovered"')]);
    const state=await execute(root,prepare(parent,[],{workflows:[child]}));
    assert.equal(state.phase,force?'completed':'failed');
    assert.equal(state.steps.find(s=>s.stepId==='child').status,'failed');
    assert.equal(state.steps.some(s=>s.stepId==='after'),force);
  }
}));

test('resume inside a child preserves the invocation and never repeats completed effects',()=>fixture(async root=>{
  const child=flow('child',[code('one','output=input+"1"'),code('two','output=input+"2"')]);
  const parent=flow('parent',[call('call','child'),code('end','output=input+"3"')]);
  const definition=prepare(parent,[],{workflows:[child]});
  const partial=await execute(root,definition,{maxSteps:2});
  assert.equal(partial.phase,'ready');
  assert.equal(partial.steps.at(-1).output,'1');
  const done=await execute(root,definition,{resumeRunId:partial.runId});
  assert.equal(done.phase,'completed');assert.equal(done.steps.at(-1).output,'123');
  assert.equal(done.steps.filter(s=>s.stepId===partial.steps.at(-1).stepId).length,1);
  const again=await execute(root,definition,{resumeRunId:done.runId});assert.deepEqual(again,done);
}));

test('cycles, missing children, depth and edited descendants reject before effects',()=>fixture(async root=>{
  const a=flow('a',[call('b','b')]),b=flow('b',[call('a','a')]);
  assert.throws(()=>prepare(a,[],{workflows:[a,b]}),/cycle/);
  assert.throws(()=>prepare(a,[],{workflows:[]}),/Missing/);
  const chain=Array.from({length:17},(_,i)=>flow(String(i),i===16?[code('end','output="end"')]:[call('next',String(i+1))]));
  assert.throws(()=>prepare(chain[0],[],{workflows:chain}),/levels/);
  b.steps=[code('c','output="original"')];
  const original=prepare(a,[],{workflows:[b]});
  const partial=await execute(root,original,{maxSteps:1});
  b.steps[0].code='output="changed"';
  const changed=prepare(a,[],{workflows:[b]});assert.notEqual(original.hash,changed.hash);
  await assert.rejects(execute(root,changed,{resumeRunId:partial.runId}),/definition|identity/);
  b.steps[0].code='output="original"';b.steps[0].output='unrelated historic result';b.disabled=true;
  const disabled=prepare(a,[],{workflows:[b]});assert.equal(original.hash,disabled.hash);
  await assert.rejects(execute(root,disabled,{resumeRunId:partial.runId}),/disabled/);
}));

test('descendant tasks and workflows are reserved for the parent',()=>fixture(async root=>{
  const lease=load('execution-lease').acquireExecutionLease(path.join(root,'runtime'));
  try {
    const task={id:'t',taskKind:'code',code:'output="ok"'},child=flow('child',[{id:'t',stepKind:'task',taskId:'t'}]);
    const parent=flow('parent',[call('child','child')]),other=flow('other',[call('child','child')]);
    const coordinator=load('execution-coordinator').executionCoordinator(lease);
    const admitted=coordinator.admit(prepare(parent,[task],{workflows:[child]}),root);
    assert.throws(()=>coordinator.admit(prepare(child,[task],{}),root),/reserved/);
    assert.throws(()=>coordinator.admit(prepare(other,[task],{workflows:[child]}),root),/reserved/);
    admitted.finish();
    coordinator.admit(prepare(child,[task],{}),root).finish();
  } finally {lease.release();}
}));

test('interrupting a child delay stops the parent without taking force transitions',()=>fixture(async root=>{
  const child=flow('child',[{id:'wait',stepKind:'delay',delayValue:5,delayUnit:'seconds'}]);
  const parent=flow('parent',[{...call('call','child'),transitions:[{toStepId:'after',mode:'force'}]},code('after','output="unexpected"')]);
  const controller=new AbortController();
  const pending=execute(root,prepare(parent,[],{workflows:[child]}),{signal:controller.signal,onCheckpoint:async s=>{
    if(s.phase==='in_flight' && s.steps.at(-1).stepId.includes('wait')) setTimeout(()=>controller.abort(),10);
  }});
  const state=await pending;assert.equal(state.phase,'failed');assert.equal(state.steps.at(-1).result.cancelled,true);
  assert.equal(state.steps.some(s=>s.stepId==='after'),false);
}));

test('nested package validates forward references and rejects cycles before import',()=>{
  const {validateNestedWorkflowExport:validate}=load('workflow-nesting');
  const data={autoOCExport:{schemaVersion:'1.7.0'},tasks:[],workflows:[{exportId:'parent',steps:[{id:'child',stepKind:'workflow',workflowExportId:'child'}]},{exportId:'child',steps:[code('code','output="ok"')]}]};
  assert.doesNotThrow(()=>validate(data));
  data.workflows[1].steps=[{id:'parent',stepKind:'workflow',workflowExportId:'parent'}];assert.throws(()=>validate(data),/cycle/);
  data.workflows.pop();assert.throws(()=>validate(data),/Missing/);
});

test('installed execution projects parent and leaf task without replacing child standalone history',()=>fixture(async root=>{
  const directory=path.join(root,'.obsidian/plugins/auto-oc');fs.mkdirSync(directory,{recursive:true});
  const task={id:'t',name:'t',taskKind:'code',prompt:'output="task"',code:'output="task"'};
  const child={...flow('child',[{id:'task',stepKind:'task',taskId:'t'}]),status:'completed',output:'old standalone result'};
  const parent=flow('parent',[call('child','child'),code('end','output=input')]);
  fs.writeFileSync(path.join(directory,'data.json'),JSON.stringify({tasks:[task],workflows:[parent,child],logsEnabled:false}));
  const result=await load('installed-workflow-host').runInstalledWorkflow({vault:root,workflowId:'parent',newExecution:true,redact:s=>s});
  assert.equal(result.phase,'completed');
  const saved=JSON.parse(fs.readFileSync(path.join(directory,'data.json'),'utf8'));
  assert.match(saved.tasks[0].output,/task$/);assert.equal(saved.tasks[0].runtimeExecution.workflowId,'parent');
  assert.deepEqual(saved.workflows[1],child);assert.equal(saved.workflows[0].steps[0].output,saved.tasks[0].output);
}));

test('nested Codex recovery reconciles the exact leaf and does not launch another task',()=>fixture(async root=>{
  const child=flow('child',[{id:'task',stepKind:'task',taskId:'t'},code('suffix','output=input+":child"')]);
  const parent=flow('parent',[call('call','child'),code('end','output=input+":parent"')]);
  const definition=prepare(parent,[{id:'t',taskKind:'codex',prompt:'test'}],{workflows:[child]});
  let launches=0,runId;
  const tasks={supports:()=>true,execute:async(_task,_prompt,_signal,record)=>{
    launches++;await record('thread-exact','turn-exact');throw Error('transport lost');
  },reconcile:async(_task,threadId,turnId)=>{
    assert.equal(threadId,'thread-exact');assert.equal(turnId,'turn-exact');
    return {threadId,turnId,status:'completed',output:'observed'};
  }};
  await assert.rejects(execute(root,definition,{tasks,onCheckpoint:async s=>{runId=s.runId;}}),/transport lost/);
  await assert.rejects(execute(root,definition,{tasks,resumeRunId:runId}),/reconciliation/);
  const recovered=await execute(root,definition,{tasks,resumeRunId:runId,reconcile:true});
  assert.equal(recovered.phase,'ready');assert.equal(launches,1);
  const done=await execute(root,definition,{tasks,resumeRunId:runId});
  assert.equal(done.steps.at(-1).output,'observed:child:parent');assert.equal(launches,1);
}));

test('local conditions and model evaluations inside a child preserve routing on resume',()=>fixture(async root=>{
  const child=flow('child',[
    {...code('a','output="local"'),transitions:[{toStepId:'b',mode:'conditional',condition:'outputs.a === "local" && outputs.seed === undefined'}]},
    {...code('b','output=input+"!"'),transitions:[{toStepId:'c',mode:'eval',evaluatePrompt:'Continue?'}]},
    code('c','output=input+"done"')]);
  const parent=flow('parent',[code('seed','output="parent"'),call('child','child')]);
  const definition=prepare(parent,[],{workflows:[child]});let evaluations=0;
  const done=await execute(root,definition,{evaluate:async()=>{evaluations++;return 'YES';}});
  assert.equal(done.phase,'completed');assert.equal(done.steps.at(-1).output,'local!done');assert.equal(evaluations,1);
  await execute(root,definition,{resumeRunId:done.runId,evaluate:async()=>{throw Error('replayed');}});
}));

test('disabled and retired descendants are rejected before the first parent effect',()=>fixture(async root=>{
  const child=flow('child',[code('child','output="child"')]);
  const parent=flow('parent',[code('first','output="must not run"'),call('child','child')]);
  child.steps[0].disabled=true;
  await assert.rejects(execute(root,prepare(parent,[],{workflows:[child]})),/disabled/);
  delete child.steps[0].disabled;child.requiresAutoOCSecrets=true;
  await assert.rejects(execute(root,prepare(parent,[],{workflows:[child]})),/retired/);
  assert.deepEqual(fs.readdirSync(path.join(root,'runtime')),[]);
}));

test('compiled entry and return boundaries can resume after interruption without reconciliation',()=>fixture(async root=>{
  const child=flow('child',[code('leaf','output="once"')]),parent=flow('parent',[call('call','child')]);
  const definition=prepare(parent,[],{workflows:[child]});
  const {workflowExecutionPlan}=load('workflow-nesting');
  const lease=load('execution-lease').acquireExecutionLease(path.join(root,'runtime'));
  const journal=await load('execution-journal').ExecutionJournal.create(lease,'parent',definition.hash,workflowExecutionPlan(definition).entry);
  await journal.begin(journal.snapshot().nextStepId);const runId=journal.snapshot().runId;lease.release();
  const done=await execute(root,definition,{resumeRunId:runId});
  assert.equal(done.phase,'completed');assert.equal(done.steps.at(-1).output,'once');
}));

function pluginHarness() {
  const vm=require('node:vm'),module={exports:{}},Stub=class{};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../main.js'),'utf8')+'\nmodule.exports.nestingTest={ImportModal,AUTOOC_WORKFLOW_PROMPT};',{
    module,exports:module.exports,require:id=>id==='obsidian'?{Plugin:Stub,Modal:Stub,ItemView:Stub,PluginSettingTab:Stub,Notice:Stub}:require(id),
    process,Buffer,console,setTimeout,clearTimeout,setInterval,clearInterval,AbortController,
  });
  const plugin=new module.exports.default();plugin.settings={tasks:[],workflows:[]};plugin.manifest={version:'1.7.18'};
  plugin.saveSettings=async()=>{};
  return {plugin,...module.exports.nestingTest};
}

test('built plugin exports descendants and imports forward references with new identities',async()=>{
  const {plugin,ImportModal}=pluginHarness();
  const child=flow('child',[code('code','output=input+"child"')]);
  const parent=flow('parent',[call('child','child'),code('end','output=input')]);
  plugin.settings.workflows=[parent,child];
  const data=JSON.parse(plugin.buildExportJson([], [parent]));
  assert.equal(data.autoOCExport.schemaVersion,'1.7.0');assert.equal(data.workflows.length,2);
  assert.equal(data.workflows[0].steps[0].workflowExportId,data.workflows[1].exportId);
  const check=ImportModal.prototype.validateExport.call({},data);assert.equal(check.ok,true,check.errors.join('\n'));
  const before=JSON.stringify(plugin.settings);
  const invalid=JSON.parse(JSON.stringify(data));invalid.workflows[1].steps=[{id:'cycle',stepKind:'workflow',workflowExportId:invalid.workflows[0].exportId}];
  await assert.rejects(plugin.importFromData(invalid),/cycle/);assert.equal(JSON.stringify(plugin.settings),before);
  const result=await plugin.importFromData(data);assert.equal(result.workflowsImported,2);
  const imported=plugin.settings.workflows.slice(2);assert.equal(imported[0].steps[0].workflowId,imported[1].id);
  assert.notEqual(imported[1].id,child.id);
  assert.doesNotThrow(()=>prepare(imported[0],[],plugin.settings));
});

test('actual shared generation guide nested example passes the real importer validator',()=>{
  const {AUTOOC_WORKFLOW_PROMPT:guide,ImportModal}=pluginHarness();
  const data=JSON.parse(guide.split('Nested workflow package example (schema 1.7.0):\n')[1].split('\n\nNow write')[0]);
  assert.equal(data.autoOCExport.pluginVersion,JSON.parse(fs.readFileSync(path.resolve(__dirname,'../manifest.json'),'utf8')).version);
  const result=ImportModal.prototype.validateExport.call({},data);assert.equal(result.ok,true,result.errors.join('\n'));
});

test('legacy workflows without export IDs still receive separate import identities',async()=>{
  const {plugin}=pluginHarness();
  await plugin.importFromData({autoOCExport:{schemaVersion:'1.0'},tasks:[],workflows:[
    {name:'first',steps:[code('a','output=1')]},{name:'second',steps:[code('b','output=2')]},
  ]});
  assert.equal(new Set(plugin.settings.workflows.map(w=>w.id)).size,2);
});

test('distributed CLI runs and resumes a nested workflow through its parent identity',()=>fixture(async root=>{
  const directory=path.join(root,'.obsidian/plugins/auto-oc');fs.mkdirSync(directory,{recursive:true});
  const parent=flow('parent',[code('start','output="CLI"'),call('child','child')]);
  const child=flow('child',[code('end','output=input+":nested"')]);
  fs.writeFileSync(path.join(directory,'data.json'),JSON.stringify({tasks:[],workflows:[parent,child],logsEnabled:false}));
  const cli=path.resolve(__dirname,'../autooc-cli.cjs');
  const invoke=(...args)=>JSON.parse(execFileSync(process.execPath,[cli,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true,timeout:60000}));
  assert.equal(invoke('version').nestedWorkflows,1);
  const result=invoke('run','--vault',root,'--workflow','parent');assert.equal(result.phase,'completed');
  const journalPath=path.join(directory,'runtime',result.runId+'.json'),before=fs.readFileSync(journalPath,'utf8');
  assert.equal(JSON.parse(before).steps.at(-1).output,'CLI:nested');
  const resumed=invoke('resume','--vault',root,'--workflow','parent','--run',result.runId);
  assert.equal(resumed.phase,'completed');assert.equal(fs.readFileSync(journalPath,'utf8'),before);
  const status=invoke('status','--vault',root);assert.equal(status.executions.length,1);assert.equal(status.executionLockPresent,false);
}));
