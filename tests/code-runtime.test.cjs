const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const file=path.resolve(__dirname,'../code-runtime.ts');
const mod=new Module(file,module);mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));
mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {executeCode}=mod.exports;

test('standalone task state survives plugin reload and plugin uses the same coordinator',async()=>{
  const {runInstalledWorkflow}=require('../autooc-runtime.cjs');
  const load=Module._load;let Plugin;
  try {
    Module._load=function(name,...args){if(name==='obsidian')return {Plugin:class{},Notice:class{},Modal:class{},Setting:class{},ItemView:class{},PluginSettingTab:class{},WorkspaceLeaf:class{}};return load.call(this,name,...args);};
    Plugin=require('../main.js').default;
  } finally {Module._load=load;}
  const p=new Plugin();
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-task-parity-'));
  const install=path.join(root,'.obsidian/plugins/auto-oc'),file=path.join(install,'data.json');
  fs.mkdirSync(install,{recursive:true});
  fs.writeFileSync(file,JSON.stringify({tasks:[{id:'single',name:'Single',taskKind:'code',codeAllowVault:true,code:'vault.append("effects.txt","once"); output="shared result";'}],workflows:[],custom:'keep'}));
  const reconciled=[];
  p.app={vault:{adapter:{basePath:root,queue:job=>job(),reconcileInternalFile:async relative=>{reconciled.push(relative);}},configDir:'.obsidian'},workspace:{getLeavesOfType:()=>[]}};p.manifest={id:'auto-oc'};
  try {
    const first=await runInstalledWorkflow({vault:root,taskId:'single',newExecution:true,redact:s=>s});
    const before=fs.readFileSync(file,'utf8');
    p.reservePluginExecution();await p.loadSettings();
    assert.equal(p.settings.tasks[0].runtimeExecution.runId,first.runId);
    assert.equal(p.settings.tasks[0].status,'completed');assert.match(p.settings.tasks[0].output,/shared result/);
    assert.equal(fs.readFileSync(file,'utf8'),before);
    await p.runTask(p.settings.tasks[0]);
    const current=p.settings.tasks[0].runtimeExecution.runId;
    assert.notEqual(current,first.runId);assert.equal(p.settings.custom,'keep');assert.deepEqual(p.settings.workflows,[]);
    p.releasePluginExecution(false);
    assert.equal((await runInstalledWorkflow({vault:root,taskId:'single',resumeRunId:current,redact:s=>s})).phase,'completed');
    assert.equal(fs.readFileSync(path.join(root,'effects.txt'),'utf8'),'onceonce');
    assert.deepEqual(reconciled,['effects.txt']);
  } finally {
    p.releasePluginExecution(false);
    assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('autooc-task-parity-'));
    fs.rmSync(root,{recursive:true});
  }
});
function run(options={}) {return executeCode({vaultBase:process.cwd(),cwd:process.cwd(),code:'output = input;',...options});}

test('Code execution preserves a 24KB handoff, outputs and variable aliases',()=>{
  const input='á'.repeat(24000);
  assert.equal(run({input,outputs:{prior:'ok'},codeInputVar:'source',codeOutputVar:'result',code:'result = source + outputs.prior;'}),input+'ok');
});
test('capabilities are absent unless explicitly granted',()=>{
  assert.equal(run({code:'output = [typeof vault,typeof files,typeof terminal,typeof require,typeof process].join(",");'}),'undefined,undefined,undefined,undefined,undefined');
  assert.throws(()=>run({code:'vault.write("unexpected", "x");'}),/vault is not defined/);
});
test('vault write, append, read and listing use the selected root and reject traversal',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-code-'));
  try {
    assert.equal(run({vaultBase:dir,codeAllowVault:true,code:'vault.write("note.md", "uno"); vault.append("note.md", " dos"); output = vault.read("note.md");'}),'uno dos');
    assert.equal(run({vaultBase:dir,codeAllowVault:true,code:'output = vault.exists("note.md") && vault.list().includes("note.md");'}),'true');
    assert.throws(()=>run({vaultBase:dir,codeAllowVault:true,code:'vault.write("../outside.md", "bad");'}),/Path escapes vault/);
    assert.throws(()=>run({vaultBase:dir,codeAllowVault:true,code:'vault.read("missing.md");'}),/ENOENT/);
  } finally {fs.unlinkSync(path.join(dir,'note.md'));fs.rmdirSync(dir);}
});
test('vault capability rejects linked paths before reading or writing outside the selected vault',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-code-links-'));
  const vault=path.join(root,'vault'),outside=path.join(root,'outside'),link=path.join(vault,'linked');
  fs.mkdirSync(vault);fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside,'note.md'),'original');
  try {
    fs.symlinkSync(outside,link,process.platform==='win32'?'junction':'dir');
    for(const code of [
      'output = vault.read("linked/note.md");',
      'vault.write("linked/note.md", "changed");',
      'vault.append("linked/note.md", "changed");',
      'vault.write("linked/new/note.md", "changed");',
      'output = vault.list("linked");',
      'output = vault.exists("linked/note.md");',
      'output = vault.resolve("linked/note.md");',
    ]) assert.throws(()=>run({vaultBase:vault,codeAllowVault:true,code}),/Linked vault paths are unsupported/);
    assert.equal(fs.readFileSync(path.join(outside,'note.md'),'utf8'),'original');
    assert.equal(fs.existsSync(path.join(outside,'new')),false);
  } finally {
    if(fs.existsSync(link)) fs.unlinkSync(link);
    fs.unlinkSync(path.join(outside,'note.md'));fs.rmdirSync(outside);fs.rmdirSync(vault);fs.rmdirSync(root);
  }
});

test('standalone task API preserves its prior shape and logging',()=>{
  const logs=[];
  assert.equal(run({codeAllowVault:true,codeAllowFiles:true,exposePaths:false,log:(...a)=>logs.push(a),code:'console.log("hello", 2); output = typeof vault.resolve + ":" + typeof files.cwd;'}),'undefined:undefined');
  assert.deepEqual(logs,[['hello',2]]);
});
test('exceptions propagate to the host instead of becoming successful output',()=>{
  assert.throws(()=>run({code:'throw Error("fixture failure");'}),/fixture failure/);
  assert.equal(run({code:'output = null;'}),'');
});
test('built plugin executes Code tasks and workflow steps through the same contract',async()=>{
  const load=Module._load;let Plugin;
  try {
    Module._load=function(name,...args){if(name==='obsidian')return {Plugin:class{},Notice:class{},Modal:class{},Setting:class{},ItemView:class{},PluginSettingTab:class{},WorkspaceLeaf:class{}};return load.call(this,name,...args);};
    Plugin=require('../main.js').default;
  } finally {Module._load=load;}
  const p=new Plugin();p.app={vault:{adapter:{basePath:process.cwd()}}};p.saveSettings=async()=>{};
  const task={id:'fixture',name:'Fixture',code:'output = "result";',scheduleType:'once'};
  p.settings={tasks:[task],logsEnabled:false};
  let exit;await p.runCodeTask(task,async(_,code)=>{exit=code;});
  assert.equal(exit,0);assert.equal(task.status,'completed');assert.ok(task.output.endsWith('result'));
  p.workflowRuntime=new Map([['wf',{stepOutputs:new Map([['previous','result']])}]]);
  let completed;p.completeStep=async(...args)=>{completed=args;};
  await p.runCodeStep({id:'wf',name:'Fixture'},{id:'next',code:'output = input + outputs.previous;'},0);
  assert.equal(completed[3],true);assert.equal(completed[4],'resultresult');
  await p.runCodeStep({id:'wf',name:'Fixture'},{id:'bad',code:'throw Error("fixture");'},1);
  assert.equal(completed[3],false);assert.match(completed[4],/fixture/);
});

test('stopping a plugin delay cannot complete or advance the stopped workflow',async()=>{
  const load=Module._load;let Plugin;
  try {
    Module._load=function(name,...args){if(name==='obsidian')return {Plugin:class{},Notice:class{},Modal:class{},Setting:class{},ItemView:class{},PluginSettingTab:class{},WorkspaceLeaf:class{}};return load.call(this,name,...args);};
    Plugin=require('../main.js').default;
  } finally {Module._load=load;}
  const p=new Plugin(); const step={id:'wait',stepKind:'delay',delayValue:3600};
  const wf={id:'wf',name:'Fixture',status:'running',currentStep:0,steps:[step]};
  p.settings={workflows:[wf],tasks:[]};p.saveSettings=async()=>{};
  p.workflowRuntime=new Map([['wf',{stepOutputs:new Map()}]]);
  let completed=0;p.completeStep=async()=>{completed++;};
  const pending=p.runDelayStep(wf,step,0);
  await p.killWorkflow(wf.id);await pending;
  assert.equal(wf.status,'failed');assert.equal(completed,0);
  assert.equal(p.workflowDelayControllers.size,0);
  wf.status='running';step.delayValue=0;
  await p.runDelayStep(wf,step,0);assert.equal(completed,1);
});

test('late and duplicated task callbacks cannot advance a replacement workflow execution',async()=>{
  const Plugin=require('../main.js').default;
  const p=new Plugin(),task={id:'t',prompt:'fixture'};
  const wf={id:'wf',name:'Fixture',status:'running',currentStep:0,steps:[{id:'s',stepKind:'task',taskId:'t'}]};
  p.settings={tasks:[task],workflows:[wf]};p.saveSettings=async()=>{};
  const old={stepOutputs:new Map()};p.workflowRuntime=new Map([['wf',old]]);
  let callback,transitions=0;p.runTask=async(_task,cb)=>{callback=cb;};
  p.resolveNextStep=async()=>{transitions++;return {nextStepId:null,reason:'end'};};
  await p.runTaskStep(wf,wf.steps[0],0);
  const replacement={stepOutputs:new Map()};p.workflowRuntime.set('wf',replacement);
  await callback({status:'completed',output:'stale'},0);
  assert.equal(transitions,0);assert.equal(wf.status,'running');assert.equal(replacement.stepOutputs.size,0);
  await p.runTaskStep(wf,wf.steps[0],0);
  await callback({status:'completed',output:'fresh'},0);
  await callback({status:'completed',output:'duplicate'},0);
  assert.equal(transitions,1);assert.equal(wf.status,'completed');
});

test('non-task completion cannot close a new run after asynchronous transition evaluation',async()=>{
  const Plugin=require('../main.js').default,p=new Plugin();
  const step={id:'s',stepKind:'code'},wf={id:'wf',status:'running',steps:[step]};
  p.settings={workflows:[wf]};p.saveSettings=async()=>{};
  const replacement={stepOutputs:new Map()};p.workflowRuntime=new Map([['wf',{stepOutputs:new Map()}]]);
  p.resolveNextStep=async()=>{p.workflowRuntime.set('wf',replacement);return {nextStepId:null,reason:'end'};};
  await p.completeStep(wf,step,0,true,'old output');
  assert.equal(wf.status,'running');assert.equal(p.workflowRuntime.get('wf'),replacement);
});

test('shared handoff preserves opaque Code data and strips diagnostics only from task reports',async()=>{
  const source=path.resolve(__dirname,'../workflow-handoff.ts');
  const m=new Module(source,module);m._compile(ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,source);
  const {workflowTaskPrompt:prompt}=m.exports;
  const previous={id:'previous',name:'Prepare',stepKind:'code'};
  const step={id:'next',stepKind:'task',taskId:'task'};
  const wf={id:'wf',name:'Fixture',status:'running',handoffOutput:true,steps:[previous,step]};
  const response='x'.repeat(24000);
  const output='## Response\n\n'+response+'\n\n---\n\n## Touched files\n\n- diagnostic.md\n\n---\n\n## OpenCode trace\n\nTRACE_ONLY';
  const expected=prompt('Do work',wf,{stepId:previous.id,output});
  assert.ok(expected.includes(output));
  const reportWorkflow={...wf,steps:[{...previous,stepKind:'task'},step]};
  const reportPrompt=prompt('Do work',reportWorkflow,{stepId:previous.id,output});
  assert.ok(reportPrompt.includes(response));assert.ok(reportPrompt.includes('DIAGNOSTIC ONLY'));assert.ok(!reportPrompt.includes('TRACE_ONLY'));
  assert.equal(prompt('Do work',{...wf,handoffOutput:false},{stepId:previous.id,output}),'Do work');
  assert.equal(prompt('Do work',wf),'Do work');
  const complete='x'.repeat(60000)+'\n\n\n... [exit code: literal data] END';
  assert.ok(prompt('Do work',wf,{stepId:previous.id,output:complete}).includes(complete));
  const Plugin=require('../main.js').default,p=new Plugin();
  p.settings={tasks:[{id:'task',prompt:'Do work'}],workflows:[wf]};p.saveSettings=async()=>{};
  p.workflowRuntime=new Map([['wf',{stepOutputs:new Map([[previous.id,output]])}]]);
  let supplied;p.runTask=async(task,callback,overrides)=>{supplied=overrides.prompt;};
  await p.runTaskStep(wf,step,1);assert.equal(supplied,expected);
});

test('shared Codex execution waits for actual completion and preserves approval policy',async()=>{
  const source=path.resolve(__dirname,'../codex-execution.ts');
  const m=new Module(source,module);m._compile(ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,source);
  const execute=m.exports.executeCodexTask;
  let settle,args,finished=false;
  const client={run:(...values)=>{args=values;return new Promise(resolve=>{settle=resolve;});}};
  const pending=execute(client,{prompt:'fixture',model:'chosen',reasoningEffort:'high',interactive:true}).then(value=>{finished=true;return value;});
  await Promise.resolve();assert.equal(finished,false);
  assert.deepEqual(args,['fixture','chosen','high','on-request']);
  const result={output:'final',threadId:'thread',turnId:'turn',status:'completed'};
  settle(result);assert.equal(await pending,result);
  await execute({run:async(...values)=>{assert.equal(values[3],'never');return result;}},{prompt:'fixture'});
  await assert.rejects(execute({run:()=>{throw Error('must not launch');}},{prompt:'  '}),/prompt is empty/);
  await assert.rejects(execute({run:async()=>{throw Error('transport lost');}},{prompt:'fixture'}),/transport lost/);
});

test('Code task adapter matches plugin output, logging, aliases, failures and empty source',async()=>{
  const {createCodeWorkflowAdapter}=require('../autooc-runtime.cjs');
  const Plugin=require('../main.js').default;
  const adapter=createCodeWorkflowAdapter(process.cwd());
  for(const definition of [
    {code:'console.log("observed", 3); result = input === "" ? "done" : "unexpected";',codeOutputVar:'result'},
    {prompt:'output="prompt fallback";'},
    {code:'console.log("before"); throw Error("intentional");'},
    {code:'   '},
  ]) {
    const task={id:'code-task',name:'fixture',taskKind:'code',scheduleType:'once',...definition};
    const plugin=new Plugin();plugin.app={vault:{adapter:{basePath:process.cwd()}}};
    plugin.saveSettings=async()=>{};plugin.settings={tasks:[{...task}],logsEnabled:false};
    let exit;await plugin.runCodeTask(task,async(_,code)=>{exit=code;});
    const result=await adapter.execute(task,'not JavaScript: incoming model prompt');
    assert.equal(result.output,plugin.settings.tasks[0].output);
    assert.equal(result.succeeded,exit===0);
  }
  const abort=new AbortController();abort.abort();
  await assert.rejects(adapter.execute({taskKind:'code',code:'throw Error("should not execute");'},'',abort.signal),/cancelled before/);
});

test('built plugin projects durable progress without replacing configuration or accepting stale runs',async()=>{
  const {prepareWorkflowDefinition,runCodeWorkflowHost}=require('../autooc-runtime.cjs');
  const Plugin=require('../main.js').default,p=new Plugin();
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-plugin-progress-'));
  try {
    const workflow={id:'progress',name:'Keep this name',area:'Keep area',status:'pending',currentStep:0,steps:[{id:'code',stepKind:'code',code:'output="verified";',position:{x:42,y:12}}]};
    p.settings={tasks:[],workflows:[workflow],customSetting:'keep'};
    const seen=[];p.saveSettings=async()=>{seen.push(p.settings.workflows[0].status);};
    const definition=prepareWorkflowDefinition(workflow,[],p.settings);
    let first,active;
    const result=await runCodeWorkflowHost({definition,runtimeDirectory:dir,vaultBase:dir,redact:s=>s,
      onCheckpoint:async state=>{first ||= structuredClone(state);if(state.phase==='in_flight')active=structuredClone(state);await p.applyWorkflowCheckpoint(state,state.runId,true);}});
    assert.deepEqual(seen,['running','running','completed']);
    const final=p.settings.workflows[0];assert.equal(final.name,workflow.name);assert.equal(final.area,workflow.area);
    assert.deepEqual(final.steps[0].position,{x:42,y:12});assert.equal(final.steps[0].code,workflow.steps[0].code);
    assert.equal(final.steps[0].output,'verified');assert.equal(p.settings.customSetting,'keep');
    assert.equal(prepareWorkflowDefinition(final,[],p.settings).hash,definition.hash);
    await assert.rejects(p.applyWorkflowCheckpoint(first,first.runId),/Stale progress/);
    await assert.rejects(p.applyWorkflowCheckpoint({...result,runId:'other'},'other'),/Stale progress/);
    assert.equal(p.settings.workflows[0],final);
    p.settings.workflows=[workflow];await p.applyWorkflowCheckpoint(active,active.runId);
    assert.equal(p.settings.workflows[0].status,'pending');assert.equal(p.settings.workflows[0].runtimeExecution.requiresReconciliation,true);
  } finally {
    for(const file of fs.readdirSync(dir)){assert.match(file,/^[a-f0-9-]+\.json$/);fs.unlinkSync(path.join(dir,file));}fs.rmdirSync(dir);
  }
});

test('plugin startup recovers a bound checkpoint read-only and blocks legacy replay',async()=>{
  const {prepareWorkflowDefinition,runCodeWorkflowHost}=require('../autooc-runtime.cjs');
  const Plugin=require('../main.js').default;
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-startup-'));
  const runtime=path.join(dir,'.obsidian','plugins','auto-oc','runtime');
  fs.mkdirSync(runtime,{recursive:true});
  try {
    const file=path.join(path.dirname(runtime),'data.json');
    fs.writeFileSync(file,JSON.stringify({tasks:[],workflows:[]}));
    const p=new Plugin();p.app={vault:{adapter:{basePath:dir},configDir:'.obsidian'}};p.manifest={id:'auto-oc'};p.saveSettings=async()=>{};
    await p.loadSettings();
    const wf={id:'startup',name:'Recovery',status:'pending',handoffOutput:false,steps:[{id:'one',stepKind:'code',code:'output="once";'},{id:'two',stepKind:'code',code:'output="next";'}]};
    p.settings.workflows=[wf];
    const definition=prepareWorkflowDefinition(wf,[],p.settings);
    const checkpoint=await runCodeWorkflowHost({definition,runtimeDirectory:runtime,vaultBase:dir,redact:s=>s,maxSteps:1});
    const stored=structuredClone(p.settings);stored.workflows[0].runtimeExecution={runId:checkpoint.runId,revision:0,phase:'ready'};
    stored.workflows[0].status='running';
    const before=fs.readFileSync(path.join(runtime,checkpoint.runId+'.json'),'utf8');
    fs.writeFileSync(file,JSON.stringify(stored));let saves=0;p.saveSettings=async()=>{saves++;};
    await p.loadSettings();
    assert.equal(saves,0);assert.equal(p.settings.workflows[0].status,'pending');
    assert.equal(p.settings.workflows[0].steps[0].output,'once');assert.equal(p.settings.workflows[0].handoffOutput,false);
    assert.equal(prepareWorkflowDefinition(p.settings.workflows[0],[],p.settings).hash,definition.hash);
    await p.runWorkflow(p.settings.workflows[0]);assert.equal(saves,0);
    assert.equal(fs.readFileSync(path.join(runtime,checkpoint.runId+'.json'),'utf8'),before);
    stored.workflows[0].steps[0].code='output="changed";';
    fs.writeFileSync(file,JSON.stringify(stored));
    // Edited definitions remain visible, but never authorize replay of the old run.
    await p.loadSettings();assert.equal(saves,0);
    assert.equal(p.settings.workflows[0].steps[0].code,'output="changed";');
    const recovered=p.settings.workflows[0];
    assert.equal(recovered.runtimeExecution.definitionChanged,true);
    assert.equal(recovered.runtimeExecution.requiresReconciliation,true);
    assert.deepEqual(recovered.runtimeExecution.historicalSteps,checkpoint.steps);
    assert.ok(recovered.steps.every(step=>step.status==='pending' && step.output===''));
    await assert.rejects(runCodeWorkflowHost({
      definition:prepareWorkflowDefinition(recovered,[],p.settings),runtimeDirectory:runtime,
      vaultBase:dir,redact:s=>s,resumeRunId:checkpoint.runId,
    }),/Execution identity or definition changed/);
    assert.equal(fs.readFileSync(path.join(runtime,checkpoint.runId+'.json'),'utf8'),before);
    assert.equal(fs.readFileSync(file,'utf8'),JSON.stringify(stored));
  } finally {
    for(const file of fs.readdirSync(runtime)){assert.match(file,/^[a-f0-9-]+\.json$/);fs.unlinkSync(path.join(runtime,file));}
    fs.rmdirSync(runtime);fs.unlinkSync(path.join(path.dirname(runtime),'data.json'));fs.rmdirSync(path.dirname(runtime));fs.rmdirSync(path.join(dir,'.obsidian','plugins'));fs.rmdirSync(path.join(dir,'.obsidian'));fs.rmdirSync(dir);
  }
});

test('plugin save refuses to overwrite catalog changes made after its real load',async()=>{
  const Plugin=require('../main.js').default,p=new Plugin();
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-plugin-writer-'));
  const install=path.join(dir,'.obsidian','plugins','auto-oc'),target=path.join(install,'data.json');
  fs.mkdirSync(install,{recursive:true});fs.writeFileSync(target,JSON.stringify({tasks:[],workflows:[],custom:'initial'}));
  try {
    p.app={vault:{adapter:{basePath:dir},configDir:'.obsidian'}};p.manifest={id:'auto-oc'};
    p.loadData=async()=>{throw Error('must load the observed file');};
    await p.loadSettings();
    const external=JSON.parse(fs.readFileSync(target,'utf8'));external.custom='external';
    fs.writeFileSync(target,JSON.stringify(external));
    p.settings.custom='local';
    await assert.rejects(p.saveSettings(),/changed externally/);
    assert.equal(JSON.parse(fs.readFileSync(target,'utf8')).custom,'external');
    await p.loadSettings();p.settings.custom='reviewed';await p.saveSettings();
    assert.equal(JSON.parse(fs.readFileSync(target,'utf8')).custom,'reviewed');
    assert.deepEqual(fs.readdirSync(install),['data.json']);
  } finally {fs.unlinkSync(target);fs.rmdirSync(install);fs.rmdirSync(path.dirname(install));fs.rmdirSync(path.join(dir,'.obsidian'));fs.rmdirSync(dir);}
});

test('plugin reopens a minimal catalog written by the external host with identical execution defaults',async()=>{
  const {prepareWorkflowDefinition,runCodeWorkflowHost,persistWorkflowProgress}=require('../autooc-runtime.cjs');
  const Plugin=require('../main.js').default,p=new Plugin();
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-defaults-'));
  const install=path.join(dir,'.obsidian','plugins','auto-oc'),runtime=path.join(install,'runtime'),target=path.join(install,'data.json');
  fs.mkdirSync(runtime,{recursive:true});
  try {
    const wf={id:'defaults',name:'Minimal catalog',steps:[{id:'code',stepKind:'code',code:'output="reopened";'}]};
    const config={tasks:[],workflows:[wf]};fs.writeFileSync(target,JSON.stringify(config));
    const definition=prepareWorkflowDefinition(wf,[],config);
    const result=await runCodeWorkflowHost({definition,runtimeDirectory:runtime,vaultBase:dir,redact:s=>s,onCheckpoint:checkpoint=>persistWorkflowProgress({configurationFile:target,runtimeDirectory:runtime,checkpoint,expectedRunId:checkpoint.runId})});
    const before=fs.readFileSync(target,'utf8');
    p.app={vault:{adapter:{basePath:dir},configDir:'.obsidian'}};p.manifest={id:'auto-oc'};
    await p.loadSettings();
    assert.equal(p.settings.workflows[0].status,'completed');assert.equal(p.settings.workflows[0].steps[0].output,'reopened');
    assert.equal(p.settings.workflows[0].runtimeExecution.runId,result.runId);
    assert.equal(prepareWorkflowDefinition(p.settings.workflows[0],[],p.settings).hash,definition.hash);
    assert.equal(fs.readFileSync(target,'utf8'),before);
    assert.notEqual(prepareWorkflowDefinition(wf,[],{defaultCodexModel:'explicit-model'}).hash,definition.hash);
    assert.equal(prepareWorkflowDefinition(wf,[],{...definition.settings}).hash,definition.hash);
  } finally {
    for(const file of fs.readdirSync(runtime)){assert.match(file,/^[a-f0-9-]+\.json$/);fs.unlinkSync(path.join(runtime,file));}
    fs.rmdirSync(runtime);fs.unlinkSync(target);fs.rmdirSync(install);fs.rmdirSync(path.dirname(install));fs.rmdirSync(path.join(dir,'.obsidian'));fs.rmdirSync(dir);
  }
});

test('plugin lifetime reservation excludes the installed host in both directions',async()=>{
  const {runInstalledWorkflow}=require('../autooc-runtime.cjs');
  const Plugin=require('../main.js').default,p=new Plugin();
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-plugin-lease-'));
  const install=path.join(root,'.obsidian','plugins','auto-oc'),runtime=path.join(install,'runtime'),file=path.join(install,'data.json');
  fs.mkdirSync(install,{recursive:true});
  fs.writeFileSync(file,JSON.stringify({tasks:[],workflows:[{id:'exclusive',name:'Exclusive',steps:[{id:'a',stepKind:'code',code:'output="one";'}]}]}));
  p.app={vault:{adapter:{basePath:root},configDir:'.obsidian'},workspace:{getLeavesOfType:()=>[]}};p.manifest={id:'auto-oc'};
  const options={vault:root,workflowId:'exclusive',redact:s=>s};
  try {
    p.reservePluginExecution();p.reservePluginExecution();
    await assert.rejects(runInstalledWorkflow(options),{code:'EEXIST'});
    assert.equal(fs.readdirSync(runtime).filter(f=>f.endsWith('.json')).length,0);
    p.releasePluginExecution(true);
    await assert.rejects(runInstalledWorkflow(options),{code:'EEXIST'});
    p.releasePluginExecution(false);
    const pending=runInstalledWorkflow(options);
    assert.throws(()=>p.reservePluginExecution(),{code:'EEXIST'});
    const result=await pending;assert.equal(result.phase,'completed');
    p.reservePluginExecution();await p.loadSettings();
    assert.equal(p.settings.workflows[0].steps[0].output,'one');
    await assert.rejects(runInstalledWorkflow({...options,resumeRunId:result.runId}),{code:'EEXIST'});
    p.releasePluginExecution(false);
    assert.equal((await runInstalledWorkflow({...options,resumeRunId:result.runId})).phase,'completed');
  } finally {
    p.releasePluginExecution(false);
    for(const entry of fs.readdirSync(runtime)){assert.match(entry,/^[a-f0-9-]+\.json$/);fs.unlinkSync(path.join(runtime,entry));}
    fs.rmdirSync(runtime);fs.unlinkSync(file);fs.rmdirSync(install);fs.rmdirSync(path.dirname(install));fs.rmdirSync(path.join(root,'.obsidian'));fs.rmdirSync(root);
  }
});

test('plugin shared entry runs the installed motor while retaining its lifetime lease',async()=>{
  const {runInstalledWorkflow}=require('../autooc-runtime.cjs');
  const Plugin=require('../main.js').default,p=new Plugin();
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-plugin-shared-'));
  const install=path.join(root,'.obsidian','plugins','auto-oc'),runtime=path.join(install,'runtime'),file=path.join(install,'data.json');
  fs.mkdirSync(install,{recursive:true});
  fs.writeFileSync(file,JSON.stringify({tasks:[],workflows:[{id:'shared',name:'Shared',steps:[{id:'a',stepKind:'code',code:'output="same motor";'}]}]}));
  p.app={vault:{adapter:{basePath:root},configDir:'.obsidian'},workspace:{getLeavesOfType:()=>[]}};p.manifest={id:'auto-oc'};
  try {
    p.reservePluginExecution();await p.loadSettings();
    const pending=p.runWorkflow(p.settings.workflows[0]);
    await assert.rejects(p.runSharedWorkflow('shared'),/already executing/);
    await assert.rejects(p.runTask({id:'none'}),/owns the execution/);
    await assert.rejects(p.runWorkflow({id:'none'}),/owns the execution/);
    await pending;
    const result=JSON.parse(fs.readFileSync(path.join(runtime,p.settings.workflows[0].runtimeExecution.runId+'.json'),'utf8'));
    assert.equal(result.phase,'completed');assert.equal(p.settings.workflows[0].steps[0].output,'same motor');
    assert.ok(Number.isFinite(Date.parse(result.createdAt)));
    assert.equal(p.settings.workflows[0].lastRun,result.createdAt);
    assert.equal(p.settings.workflows[0].steps[0].lastRun,result.steps[0].startedAt);
    assert.equal(p.settings.workflows[0].runtimeExecution.runId,result.runId);
    assert.ok(fs.existsSync(path.join(runtime,'execution.lock')));
    await assert.rejects(runInstalledWorkflow({vault:root,workflowId:'shared',resumeRunId:result.runId,redact:s=>s}),{code:'EEXIST'});
    assert.equal((await p.runSharedWorkflow('shared',result.runId)).runId,result.runId);
    assert.equal(p.settings.workflows[0].lastRun,result.createdAt);
    assert.equal(p.settings.workflows[0].steps[0].lastRun,result.steps[0].startedAt);
    p.releasePluginExecution(false);
    assert.equal((await runInstalledWorkflow({vault:root,workflowId:'shared',resumeRunId:result.runId,redact:s=>s})).phase,'completed');
  } finally {
    p.releasePluginExecution(false);
    for(const entry of fs.readdirSync(runtime)){assert.match(entry,/^[a-f0-9-]+\.json$/);fs.unlinkSync(path.join(runtime,entry));}
    fs.rmdirSync(runtime);fs.unlinkSync(file);fs.rmdirSync(install);fs.rmdirSync(path.dirname(install));fs.rmdirSync(path.join(root,'.obsidian'));fs.rmdirSync(root);
  }
});

test('plugin stop controls follow the owned session and cancellation prevents the next effect',async()=>{
  const Plugin=require('../main.js').default,p=new Plugin();
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-plugin-stop-'));
  const install=path.join(root,'.obsidian','plugins','auto-oc'),runtime=path.join(install,'runtime'),file=path.join(install,'data.json');
  fs.mkdirSync(install,{recursive:true});
  fs.writeFileSync(file,JSON.stringify({tasks:[],workflows:[{id:'stop',name:'Stop',steps:[{id:'wait',stepKind:'delay',delayValue:30,delayUnit:'seconds'},{id:'after',stepKind:'code',code:'output="must not execute";'}]}]}));
  p.app={vault:{adapter:{basePath:root},configDir:'.obsidian'},workspace:{getLeavesOfType:()=>[]}};p.manifest={id:'auto-oc'};
  let pending;
  try {
    p.reservePluginExecution();await p.loadSettings();
    assert.equal(p.isWorkflowExecuting('stop'),false);
    pending=p.runWorkflow(p.settings.workflows[0]);
    const deadline=Date.now()+5000;
    while(p.settings.workflows[0].runtimeExecution?.phase!=='in_flight') {
      if(Date.now()>deadline) throw Error('no persisted in-flight checkpoint');
      await new Promise(resolve=>setTimeout(resolve,10));
    }
    assert.equal(p.settings.workflows[0].status,'running');
    assert.equal(p.isWorkflowExecuting('stop'),true);
    assert.equal(p.isWorkflowExecuting('other'),false);
    await p.killWorkflow('stop');await pending;
    assert.equal(p.isWorkflowExecuting('stop'),false);
    assert.equal(p.settings.workflows[0].status,'failed');
    const checkpoint=JSON.parse(fs.readFileSync(path.join(runtime,p.settings.workflows[0].runtimeExecution.runId+'.json'),'utf8'));
    assert.equal(checkpoint.steps.length,1);assert.match(checkpoint.steps[0].output,/cancelled/);
    p.settings.workflows[0].status='running';
    assert.equal(p.isWorkflowExecuting('stop'),false,'durable status alone cannot create an active control');
  } finally {
    if(p.isWorkflowExecuting('stop')) await p.killWorkflow('stop');
    if(pending) await pending;
    p.releasePluginExecution(false);
    for(const entry of fs.readdirSync(runtime)){assert.match(entry,/^[a-f0-9-]+\.json$/);fs.unlinkSync(path.join(runtime,entry));}
    fs.rmdirSync(runtime);fs.unlinkSync(file);fs.rmdirSync(install);fs.rmdirSync(path.dirname(install));fs.rmdirSync(path.join(root,'.obsidian'));fs.rmdirSync(root);
  }
});

test('plugin recovery continues the exact saved execution without repeating its first step',async()=>{
  const {runInstalledWorkflow}=require('../autooc-runtime.cjs');
  const Plugin=require('../main.js').default,p=new Plugin();
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-plugin-recover-'));
  const install=path.join(root,'.obsidian','plugins','auto-oc'),runtime=path.join(install,'runtime'),file=path.join(install,'data.json');
  fs.mkdirSync(install,{recursive:true});
  fs.writeFileSync(file,JSON.stringify({tasks:[],workflows:[{id:'recover',name:'Recover',steps:[{id:'first',stepKind:'code',code:'output="first";'},{id:'last',stepKind:'code',code:'output=input+" last";'}]}]}));
  p.app={vault:{adapter:{basePath:root},configDir:'.obsidian'},workspace:{getLeavesOfType:()=>[]}};p.manifest={id:'auto-oc'};
  try {
    const partial=await runInstalledWorkflow({vault:root,workflowId:'recover',redact:s=>s,maxSteps:1});
    assert.equal(partial.phase,'ready');
    p.reservePluginExecution();await p.loadSettings();
    await assert.rejects(p.recoverSharedWorkflow('recover','stale-id'),/identity changed/);
    const result=await p.recoverSharedWorkflow('recover',partial.runId);
    assert.equal(result.runId,partial.runId);assert.equal(result.phase,'completed');
    assert.equal(result.steps.length,2);assert.deepEqual(result.steps[0],partial.steps[0]);
    assert.equal(result.steps[1].output,'first last');
    await assert.rejects(p.recoverSharedWorkflow('recover',partial.runId),/does not require recovery/);
  } finally {
    p.releasePluginExecution(false);
    for(const entry of fs.readdirSync(runtime)){assert.match(entry,/^[a-f0-9-]+\.json$/);fs.unlinkSync(path.join(runtime,entry));}
    fs.rmdirSync(runtime);fs.unlinkSync(file);fs.rmdirSync(install);fs.rmdirSync(path.dirname(install));fs.rmdirSync(path.join(root,'.obsidian'));fs.rmdirSync(root);
  }
});
