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
test('autonomous task history survives resume and another run, honors logging, and freezes elapsed time',()=>fixture(async root=>{
  const directory=path.join(root,'.obsidian/plugins/auto-oc');fs.mkdirSync(directory,{recursive:true});
  const file=path.join(directory,'data.json');
  fs.writeFileSync(file,JSON.stringify({logsEnabled:true,tasks:[{id:'history',taskKind:'code',code:'output="history-"+"x".repeat(64000);'}],workflows:[]}));
  const cli=(...args)=>require('node:child_process').spawnSync(process.execPath,[path.resolve(__dirname,'../autooc-cli.cjs'),...args,'--vault',root],{encoding:'utf8',timeout:15000});
  const first=cli('run','--task','history');assert.equal(first.status,0,first.stderr);
  const runId=JSON.parse(first.stdout).runId,logDir=path.join(root,'.opencode/logs/history');
  assert.ok(fs.existsSync(logDir),'History must have persistent logs from CLI tasks');
  const logs=()=>fs.readdirSync(logDir).filter(f=>f!=='latest.log');
  assert.equal(logs().length,1);
  assert.match(fs.readFileSync(path.join(logDir,logs()[0]),'utf8'),new RegExp(runId));
  assert.ok(fs.readFileSync(path.join(logDir,logs()[0]),'utf8').includes('x'.repeat(64000)));
  const task=JSON.parse(fs.readFileSync(file)).tasks[0];
  assert.ok(task.runtimeExecution.finishedAt);
  const elapsed=load('task-history').taskElapsedSeconds;
  assert.equal(elapsed(task,Date.now()),elapsed(task,Date.now()+3600000));
  assert.equal(elapsed({...task,runtimeExecution:{}},Date.now()),undefined);
  const resumed=cli('resume','--task','history','--run',runId);assert.equal(resumed.status,0,resumed.stderr);
  assert.equal(logs().length,1);
  const next=cli('run','--task','history');assert.equal(next.status,0,next.stderr);
  assert.equal(logs().length,2);
  const config=JSON.parse(fs.readFileSync(file));config.logsEnabled=false;fs.writeFileSync(file,JSON.stringify(config));
  const disabled=cli('run','--task','history');assert.equal(disabled.status,0,disabled.stderr);
  assert.equal(logs().length,2);
}));
test('runtime history keeps attempts and failures, applies retention and refuses path escape',()=>fixture(async root=>{
  const {persistTaskHistory,taskElapsedSeconds}=load('task-history');
  const workflow={steps:[{id:'a',taskId:'t'},{id:'b',taskId:'t'}]};
  const startedAt=new Date().toISOString();
  const checkpoint={runId:'run-1',steps:[
    {stepId:'a',status:'completed',startedAt,finishedAt:startedAt,output:'first'},
    {stepId:'a',status:'failed',startedAt,finishedAt:startedAt,output:'second'},
    {stepId:'b',status:'in_flight',startedAt}
  ]};
  persistTaskHistory(root,workflow,checkpoint,{});
  const dir=path.join(root,'.opencode/logs/t'),logs=()=>fs.readdirSync(dir).filter(f=>f!=='latest.log');
  assert.equal(logs().length,2);assert.match(fs.readFileSync(path.join(dir,'latest.log'),'utf8'),/Status: failed[\s\S]*second/);
  persistTaskHistory(root,workflow,checkpoint,{});assert.equal(logs().length,2);
  persistTaskHistory(root,workflow,checkpoint,{maxLogsPerTask:1});assert.equal(logs().length,1);
  assert.match(fs.readFileSync(path.join(dir,logs()[0]),'utf8'),/second/);
  assert.throws(()=>persistTaskHistory(root,{steps:[{id:'a',taskId:'../escape'}]},checkpoint,{}),/Unsafe/);
  assert.equal(taskElapsedSeconds({lastRun:'2026-01-01T00:00:00Z',status:'completed',runtimeExecution:{finishedAt:'2026-01-01T00:00:03Z'}},0),3);
  assert.equal(taskElapsedSeconds({lastRun:'2026-01-01T00:00:00Z',status:'running'},Date.parse('2026-01-01T00:00:07Z')),7);
  assert.equal(taskElapsedSeconds({lastRun:'invalid',status:'completed'}),undefined);
  const old={runId:'old-run',steps:[{stepId:'a',status:'completed',startedAt:'2000-01-01T00:00:00Z',output:'old'}]};
  persistTaskHistory(root,workflow,old,{logRetentionDays:1,maxLogsPerTask:0});
  assert.equal(logs().length,1);assert.ok(!logs()[0].includes('old-run'));
  const linked=path.join(root,'link-target');fs.mkdirSync(linked);
  fs.symlinkSync(linked,path.join(root,'.opencode/logs/linked'),'junction');
  assert.throws(()=>persistTaskHistory(root,{steps:[{id:'a',taskId:'linked'}]},checkpoint,{}),/regular directories/);
  assert.deepEqual(fs.readdirSync(linked),[]);
}));

test('journal finish times are validated without rejecting legacy terminal checkpoints',()=>fixture(async root=>{
  const {acquireExecutionLease}=load('execution-lease'),{ExecutionJournal,validateExecutionCheckpoint}=load('execution-journal');
  const lease=acquireExecutionLease(root);
  try {
    const journal=await ExecutionJournal.create(lease,'w','a'.repeat(64),'a');
    await journal.begin('a');await journal.finish('a',false,'failed',null);
    const state=journal.snapshot();assert.ok(state.steps[0].finishedAt);validateExecutionCheckpoint(state);
    state.steps[0].finishedAt='invalid';assert.throws(()=>validateExecutionCheckpoint(state),/finish timestamp/);
    state.steps[0].finishedAt='2000-01-01T00:00:00Z';assert.throws(()=>validateExecutionCheckpoint(state),/finish timestamp/);
    delete state.steps[0].finishedAt;validateExecutionCheckpoint(state);
  } finally {lease.release();}
}));
test('CLI history is listed by the plugin History modal and Log duration stays fixed after reopening',()=>fixture(async root=>{
  const directory=path.join(root,'.obsidian/plugins/auto-oc');fs.mkdirSync(directory,{recursive:true});
  const file=path.join(directory,'data.json');
  fs.writeFileSync(file,JSON.stringify({tasks:[{id:'ui',name:'History fixture',taskKind:'code',code:'output="VISIBLE_HISTORY"'}],workflows:[{id:'ui-workflow',steps:[{id:'a',taskId:'ui'}]}]}));
  const cli=require('node:child_process').spawnSync(process.execPath,[path.resolve(__dirname,'../autooc-cli.cjs'),'run','--workflow','ui-workflow','--vault',root],{encoding:'utf8',timeout:15000});
  assert.equal(cli.status,0,cli.stderr);
  const elements=[];
  class Element {
    constructor(options={}){this.textContent=options.text||'';this.cls=options.cls;elements.push(this);}
    addClass(){} empty(){} createEl(_tag,options){return new Element(options);} createDiv(options){return new Element(options);} createSpan(options){return new Element(options);}
  }
  const original=Module._load,priorWindow=global.window,priorNow=Date.now;
  const timers=new Map();let timerId=0;
  global.window={setInterval:fn=>{timers.set(++timerId,fn);return timerId;},clearInterval:id=>timers.delete(id)};
  let plugin,live;
  try {
    Module._load=function(id,...args){if(id==='obsidian')return {Plugin:class{},Notice:class{},Modal:class{constructor(app){this.app=app;this.contentEl=new Element();}},Setting:class{},ItemView:class{},PluginSettingTab:class{},WorkspaceLeaf:class{},MarkdownRenderer:{render(){}}};return original.call(this,id,...args);};
    const filename=path.resolve(__dirname,'../main.js'),bundle=new Module(filename,module);bundle.filename=filename;bundle.paths=Module._nodeModulePaths(path.dirname(filename));
    bundle._compile(fs.readFileSync(filename,'utf8')+'\nmodule.exports.historyTest={LiveLogModal,LogHistoryModal,getLogHistory};',filename);
    const {LiveLogModal,LogHistoryModal,getLogHistory}=bundle.exports.historyTest;
    plugin=new bundle.exports.default();plugin.app={vault:{adapter:{basePath:root},configDir:'.obsidian'}};plugin.manifest={id:'auto-oc'};
    plugin.reservePluginExecution();await plugin.loadSettings();
    const task=plugin.settings.tasks[0],history=getLogHistory(root,task.id);
    assert.equal(history.length,1);assert.match(history[0].timestamp,/^\d{2}\/\d{2}\/\d{4} /);
    assert.match(fs.readFileSync(history[0].file,'utf8'),/VISIBLE_HISTORY/);
    new LogHistoryModal(plugin.app,task,plugin).onOpen();
    assert.ok(elements.some(el=>el.textContent==='1 execution(s)'));
    live=new LiveLogModal(plugin.app,task,plugin);live.onOpen();
    const elapsed=elements.find(el=>el.cls==='auto-oc-log-elapsed'),initial=elapsed.textContent;
    assert.doesNotMatch(initial,/unavailable/);
    Date.now=()=>priorNow()+3600000;for(const callback of timers.values())callback();
    assert.equal(elapsed.textContent,initial);
    delete task.runtimeExecution.finishedAt;for(const callback of timers.values())callback();
    assert.match(elapsed.textContent,/unavailable/);
  } finally {live?.onClose();plugin?.releasePluginExecution(false);Module._load=original;global.window=priorWindow;Date.now=priorNow;}
}));
test('CLI-first reopening preserves persisted defaults, journals and effects; real definition changes are rejected',async t=>{
  const original=Module._load;let Plugin;
  try {
    Module._load=function(id,...args){if(id==='obsidian')return {Plugin:class{},Notice:class{},Modal:class{},Setting:class{},ItemView:class{},PluginSettingTab:class{},WorkspaceLeaf:class{}};return original.call(this,id,...args);};
    Plugin=require('../main.js').default;
  } finally {Module._load=original;}
  const defaults=load('execution-defaults').EXECUTION_DEFAULTS;
  for(const [name,settings] of Object.entries({omitted:{},explicit:{...defaults},custom:{taskTimeoutSeconds:3600,defaultModel:'fixture-model'}})) {
    await t.test(name,()=>fixture(async root=>{
      const directory=path.join(root,'.obsidian/plugins/auto-oc');fs.mkdirSync(directory,{recursive:true});
      const file=path.join(directory,'data.json');
      fs.writeFileSync(file,JSON.stringify({...settings,tasks:[{id:'task',taskKind:'code',code:'output=input.length;'}],workflows:[
        {id:'first',steps:[{id:'effect',stepKind:'code',codeAllowVault:true,code:'vault.append("effect.txt","once");output="x".repeat(64000);'},{id:'task',taskId:'task'}]}
      ]}));
      const cli=(...args)=>require('node:child_process').spawnSync(process.execPath,[path.resolve(__dirname,'../autooc-cli.cjs'),...args,'--vault',root],{encoding:'utf8',timeout:15000});
      const result=cli('run','--workflow','first');assert.equal(result.status,0,result.stderr);
      const run=JSON.parse(result.stdout);assert.equal(run.phase,'completed');
      const persisted=fs.readFileSync(file,'utf8'),config=JSON.parse(persisted);
      const journal=path.join(directory,'runtime',run.runId+'.json'),journalBefore=fs.readFileSync(journal,'utf8');
      const plugin=new Plugin();plugin.app={vault:{adapter:{basePath:root},configDir:'.obsidian'}};plugin.manifest={id:'auto-oc'};
      const reopen=async()=>{plugin.reservePluginExecution();try {await plugin.loadSettings();} finally {plugin.releasePluginExecution(false);}};
      await reopen();
      assert.equal(plugin.settings.workflows[0].runtimeExecution.runId,run.runId);
      assert.equal(plugin.settings.workflows[0].status,'completed');
      assert.deepEqual(plugin.settings.workflows[0].steps,config.workflows[0].steps);
      assert.equal(plugin.settings.workflows[0].steps[0].output.length,64000);
      assert.equal(fs.readFileSync(file,'utf8'),persisted);
      const resumed=cli('resume','--workflow','first','--run',run.runId);assert.equal(resumed.status,0,resumed.stderr);
      assert.equal(fs.readFileSync(journal,'utf8'),journalBefore);
      for(const change of [
        value=>{value.taskTimeoutSeconds=(settings.taskTimeoutSeconds??defaults.taskTimeoutSeconds)+1;},
        value=>{value.opencodePath='changed-opencode';},
        value=>{value.defaultModel='changed-model';},
        value=>{value.workflows[0].steps[0].code='output="changed";';},
      ]) {
        const changed=JSON.parse(persisted);change(changed);const text=JSON.stringify(changed);fs.writeFileSync(file,text);
        await assert.rejects(reopen(),/Progress identity or definition mismatch/);
        assert.equal(fs.readFileSync(file,'utf8'),text);
        assert.equal(fs.readFileSync(journal,'utf8'),journalBefore);
        assert.equal(fs.readFileSync(path.join(root,'effect.txt'),'utf8'),'once');
      }
    }));
  }
});
async function fixture(fn) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-compat-'));
  try {await fn(root);} finally {
    assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('autooc-compat-'));fs.rmSync(root,{recursive:true,force:true});
  }
}
test('shared host executes configured Git branch and carries it across resume without recreating it',()=>fixture(async root=>{
  const git=(...args)=>execFileSync('git',['-c',`safe.directory=${root}`,...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git('init');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-m','fixture');
  const runtime=path.join(root,'runtime');fs.mkdirSync(runtime);
  const definition=prepare({id:'branch',handoffBranch:true,steps:[{id:'a',taskId:'first'},{id:'b',taskId:'second'}]},[
    {id:'first',taskKind:'code',branch:'feature',createBranch:true,code:'output=1'},
    {id:'second',taskKind:'code',branch:'ignored',code:'output=2'},
  ],{});
  const seen=[],tasks={supports:()=>true,execute:async()=>{seen.push(git('branch','--show-current'));return {succeeded:true,output:'ok'};}};
  const first=await run({definition,tasks,runtimeDirectory:runtime,vaultBase:root,maxSteps:1,redact:s=>s});
  assert.match(seen[0],/^feature-/);
  const final=await run({definition,tasks,runtimeDirectory:runtime,vaultBase:root,resumeRunId:first.runId,redact:s=>s});
  assert.equal(final.phase,'completed');assert.deepEqual(seen,[seen[0],seen[0]]);
}));
test('model routing saves the task result before evaluation and never replays it after transport loss',()=>fixture(async root=>{
  let effects=0,evaluations=0;
  const definition=prepare({id:'eval',steps:[{id:'a',taskId:'t',transitions:[{mode:'eval',toStepId:'b'}]},{id:'b',stepKind:'code',code:'output=input.length;'}]},[{id:'t'}],{});
  const options={definition,runtimeDirectory:root,vaultBase:root,redact:s=>s,
    tasks:{supports:()=>true,execute:async()=>{effects++;return {succeeded:true,output:'x'.repeat(64000)};}},
    evaluate:async()=>{evaluations++;throw Error('transport lost');}};
  await assert.rejects(run(options),/transport lost/);
  const file=fs.readdirSync(root).find(f=>f.endsWith('.json')),state=JSON.parse(fs.readFileSync(path.join(root,file)));
  assert.equal(state.steps[0].result.output.length,64000);
  await assert.rejects(run({...options,resumeRunId:state.runId}),/evaluation.*reconciliation/i);
  assert.equal(effects,1);assert.equal(evaluations,1);
}));
test('model routing preserves complete input and persists decisions for conditional continuation',()=>fixture(async root=>{
  let input;
  const definition=prepare({id:'eval',steps:[{id:'a',stepKind:'code',code:'output="z".repeat(64000)',transitions:[{mode:'eval',toStepId:'b'}]},{id:'b',stepKind:'code',code:'output=input.length;'}]},[],{});
  const result=await run({definition,runtimeDirectory:root,vaultBase:root,redact:s=>s,evaluate:async(_t,_s,value)=>{input=value;return 'YES';}});
  assert.equal(input.length,64000);assert.equal(result.steps[1].output,'64000');
  assert.equal(result.steps[0].evaluations[0].output,'YES');
}));
test('interactive Codex keeps exact identity, on-request approvals and actual completion',async()=>{
  let args,callbacks,approved,recorded=[];
  const adapter=load('codex-workflow-adapter').codexWorkflowAdapter((_task,cbs)=>{
    callbacks=cbs;
    return {run:async(...values)=>{args=values;await callbacks.onThreadCreated({threadId:'thread'});await callbacks.onStarted({threadId:'thread',turnId:'turn'});await callbacks.onApproval({requestId:7,kind:'command',summary:'fixture'});return {status:'completed',output:'done'};},
      resolveApproval:(_id,value)=>{approved=value;return true;},interrupt:async()=>{},dispose:()=>{}};
  });
  assert.equal(adapter.supports({taskKind:'codex',interactiveTerminal:true}),true);
  const result=await adapter.execute({taskKind:'codex',interactiveTerminal:true},'prompt',undefined,async(...ids)=>recorded.push(ids),{approve:async()=>false});
  assert.equal(args[3],'on-request');assert.deepEqual(recorded,[['thread'],['thread','turn']]);assert.equal(approved,false);assert.equal(result.output,'done');
});

test('public decision command answers exactly one live durable approval and preserves full output',()=>fixture(async root=>{
  const installation=path.join(root,'.obsidian/plugins/auto-oc'),runtime=path.join(installation,'runtime');fs.mkdirSync(runtime,{recursive:true});
  const workflow={id:'gate',name:'Gate',steps:[{id:'a',taskId:'t'}]},task={id:'t',name:'Task',taskKind:'codex',interactiveTerminal:true,prompt:'fixture'};
  const config={tasks:[task],workflows:[workflow]},definition=prepare(workflow,[task],config);
  const file=path.join(installation,'data.json');fs.writeFileSync(file,JSON.stringify(config));
  const call=(...args)=>require('node:child_process').spawnSync(process.execPath,[path.resolve(__dirname,'../autooc-cli.cjs'),...args],{encoding:'utf8',timeout:10000});
  let decisions=0,accepted;
  const tasks={supports:()=>true,execute:async(_task,_prompt,signal,record,interaction)=>{
    await record('thread','turn');accepted=await interaction.approve({requestId:1,kind:'command',summary:'fixture gate'},signal);
    return {succeeded:true,output:'y'.repeat(64000)};
  }};
  const result=await run({definition,tasks,runtimeDirectory:runtime,vaultBase:root,redact:s=>s,onCheckpoint:async checkpoint=>{
    await load('workflow-catalog-progress').persistWorkflowProgress({configurationFile:file,runtimeDirectory:runtime,checkpoint,expectedRunId:checkpoint.runId});
    const pending=checkpoint.steps.slice(-1)[0]?.approval;if(!pending)return;
    decisions++;
    const status=call('status','--vault',root);assert.equal(status.status,0,status.stderr);
    assert.equal(JSON.parse(status.stdout).executions[0].pendingApproval.token,pending.token);
    assert.equal(JSON.parse(fs.readFileSync(file)).tasks[0].pendingCodexApproval.requestId,pending.token);
    assert.equal(call('approve','--vault',root,'--run',checkpoint.runId,'--approval','bad').status,1);
    const answer=call('deny','--vault',root,'--run',checkpoint.runId,'--approval',pending.token);assert.equal(answer.status,0,answer.stderr);
    assert.equal(call('approve','--vault',root,'--run',checkpoint.runId,'--approval',pending.token).status,1);
  }});
  assert.equal(accepted,false);assert.equal(decisions,1);assert.equal(result.phase,'completed');assert.equal(result.steps[0].output.length,64000);
  assert.equal(JSON.parse(fs.readFileSync(file)).tasks[0].pendingCodexApproval,undefined);
}));

test('aborting an approval preserves uncertainty and stops waiting without granting permission',()=>fixture(async root=>{
  const definition=prepare({id:'w',steps:[{id:'a',taskId:'t'}]},[{id:'t'}],{}),controller=new AbortController();
  let granted=false;
  await assert.rejects(run({definition,runtimeDirectory:root,vaultBase:root,signal:controller.signal,redact:s=>s,
    tasks:{supports:()=>true,execute:async(_t,_p,signal,_record,interaction)=>{granted=await interaction.approve({requestId:1,kind:'command',summary:'fixture'},signal);return {succeeded:true,output:'bad'};}},
    onCheckpoint:async state=>{if(state.steps.slice(-1)[0]?.approval)controller.abort();}}),/Approval interrupted/);
  assert.equal(granted,false);
  const state=JSON.parse(fs.readFileSync(path.join(root,fs.readdirSync(root).find(f=>f.endsWith('.json')))));
  assert.equal(state.phase,'in_flight');assert.ok(state.steps[0].approval);assert.equal(state.steps[0].result,undefined);
}));

test('resume uses persisted task and evaluation outcomes without repeating either effect',()=>fixture(async root=>{
  const {acquireExecutionLease}=load('execution-lease'),{ExecutionJournal}=load('execution-journal');
  const definition=prepare({id:'w',steps:[{id:'a',taskId:'t',transitions:[{mode:'eval',toStepId:'b'}]},{id:'b',stepKind:'code',code:'output=input.length'}]},[{id:'t'}],{});
  const lease=acquireExecutionLease(root),journal=await ExecutionJournal.create(lease,'w',definition.hash,'a');
  await journal.begin('a');await journal.recordResult({succeeded:true,output:'z'.repeat(64000)});await journal.recordEvaluation('0');await journal.recordEvaluation('0','YES');lease.release();
  const result=await run({definition,runtimeDirectory:root,vaultBase:root,resumeRunId:journal.snapshot().runId,redact:s=>s,
    tasks:{supports:()=>true,execute:async()=>{throw Error('must not replay task');}},evaluate:async()=>{throw Error('must not replay evaluation');}});
  assert.equal(result.phase,'completed');assert.equal(result.steps[1].output,'64000');
}));

test('reconcile a task before model routing is read-only; explicit resume performs evaluation once',()=>fixture(async root=>{
  const {acquireExecutionLease}=load('execution-lease'),{ExecutionJournal}=load('execution-journal');
  const definition=prepare({id:'w',steps:[{id:'a',taskId:'t',transitions:[{mode:'eval',toStepId:'b'}]},{id:'b',stepKind:'code',code:'output=input'}]},[{id:'t'}],{});
  const lease=acquireExecutionLease(root),journal=await ExecutionJournal.create(lease,'w',definition.hash,'a');
  await journal.begin('a');await journal.recordCodexThread('a','thread','turn');lease.release();
  let evals=0;
  const options={definition,runtimeDirectory:root,vaultBase:root,resumeRunId:journal.snapshot().runId,redact:s=>s,
    tasks:{supports:()=>true,execute:async()=>{throw Error('must not replay');},reconcile:async()=>({threadId:'thread',turnId:'turn',status:'completed',output:'observed'})},evaluate:async()=>{evals++;return 'YES';}};
  const reconciled=await run({...options,reconcile:true});assert.equal(evals,0);assert.equal(reconciled.steps[0].result.output,'observed');
  const result=await run(options);assert.equal(result.phase,'completed');assert.equal(evals,1);assert.equal(result.steps[1].output,'observed');
}));

test('evaluation adapter sends the entire output and configured model through the shared launcher',async()=>{
  let captured;
  const injected=loader({'cli-workflow-adapters':{createOpenCodeWorkflowAdapter:()=>({execute:async(...args)=>{captured=args;return {succeeded:true,output:'NO'};}})}});
  const evaluator=injected('workflow-evaluation').createWorkflowEvaluator({settings:{defaultModel:'fixture/model',defaultAgent:'plan',workingDirectory:process.cwd()}},process.cwd());
  assert.equal(await evaluator({evaluatePrompt:'Only continue on success'}, {}, 'q'.repeat(64000)),'NO');
  assert.equal(captured[0].model,'fixture/model');assert.equal(captured[0].agent,'plan');assert.ok(captured[1].includes('q'.repeat(64000)));
});

test('plugin and distributed CLI execute the same branching definition and retain catalog results',()=>fixture(async root=>{
  const git=(...args)=>execFileSync('git',['-c',`safe.directory=${root}`,...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git('init');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-m','fixture');
  const directory=path.join(root,'.obsidian/plugins/auto-oc');fs.mkdirSync(directory,{recursive:true});
  const file=path.join(directory,'data.json');
  const task={id:'code',name:'Code',taskKind:'code',branch:'feature',createBranch:true,code:'output="x".repeat(64000)'};
  const workflow={id:'shared',name:'Shared',handoffBranch:true,steps:[{id:'a',taskId:'code'},{id:'b',stepKind:'code',code:'output=input.length',transitions:[{toStepId:'c',mode:'conditional',condition:'Number(input)>64000'}]},{id:'c',stepKind:'code',code:'throw Error("deliberate")'}]};
  fs.writeFileSync(file,JSON.stringify({tasks:[task],workflows:[workflow]}));
  const original=Module._load;let Plugin;
  try {
    Module._load=function(id,...args){if(id==='obsidian')return {Plugin:class{},Notice:class{},Modal:class{},Setting:class{},ItemView:class{},PluginSettingTab:class{},WorkspaceLeaf:class{}};return original.call(this,id,...args);};
    Plugin=require('../main.js').default;
  } finally {Module._load=original;}
  const plugin=new Plugin();plugin.app={vault:{adapter:{basePath:root},configDir:'.obsidian'}};plugin.manifest={id:'auto-oc'};
  try {
    plugin.reservePluginExecution();await plugin.loadSettings();await plugin.runWorkflow(plugin.settings.workflows[0]);
    const first=JSON.parse(fs.readFileSync(file)).workflows[0];assert.equal(first.status,'failed');
    assert.match(git('branch','--show-current'),/^feature-/);assert.equal(first.steps[0].output.length,64023);
    plugin.releasePluginExecution(false);
    const cli=require('node:child_process').spawnSync(process.execPath,[path.resolve(__dirname,'../autooc-cli.cjs'),'run','--vault',root,'--workflow','shared'],{encoding:'utf8',timeout:15000});
    assert.equal(cli.status,1,cli.stderr);assert.equal(JSON.parse(cli.stdout).phase,'failed');
    const second=JSON.parse(fs.readFileSync(file)).workflows[0];
    assert.deepEqual(second.steps.map(s=>[s.status,s.output]),first.steps.map(s=>[s.status,s.output]));
    assert.notEqual(second.runtimeExecution.runId,first.runtimeExecution.runId);
    plugin.reservePluginExecution();await plugin.loadSettings();assert.equal(plugin.settings.workflows[0].runtimeExecution.runId,second.runtimeExecution.runId);
  } finally {plugin.releasePluginExecution(false);}
}));

test('branch preflight rejects invalid names and repositories outside the selected vault before Code effects',()=>fixture(async root=>{
  const git=(...args)=>execFileSync('git',['-c',`safe.directory=${root}`,...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  git('init');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-m','fixture');
  const nested=path.join(root,'vault');fs.mkdirSync(nested);
  const {preflightInstalledWorkflow}=load('workflow-preflight');
  const definition=prepare({id:'w',steps:[{id:'a',taskId:'t'}]},[{id:'t',taskKind:'code',branch:'feature'}],{});
  assert.throws(()=>preflightInstalledWorkflow(definition,nested),/outside the selected vault/);
  for(const branch of ['--orphan','@{-1}','name with spaces','x;echo bad',123]) {
    const invalid=prepare(definition.workflow,[{id:'t',taskKind:'code',branch}],{});
    assert.throws(()=>preflightInstalledWorkflow(invalid,root),/branch/i);
  }
}));

test('interactive opt-in must be boolean and an interrupted Codex result never follows a forced transition',()=>fixture(async root=>{
  const {preflightInstalledWorkflow}=load('workflow-preflight');
  const task={id:'t',taskKind:'codex',prompt:'fixture',interactiveTerminal:'false'};
  const workflow={id:'w',steps:[{id:'a',taskId:'t',transitions:[{toStepId:'b',mode:'force'}]},{id:'b',stepKind:'code',code:'output="must not execute"'}]};
  assert.throws(()=>preflightInstalledWorkflow(prepare(workflow,[task],{}),root),/must be boolean/);
  const tasks=load('codex-workflow-adapter').codexWorkflowAdapter(()=>({run:async()=>({status:'interrupted',output:'cancelled'}),interrupt:async()=>{},dispose:()=>{}}));
  assert.equal(tasks.supports(task),false);
  const result=await run({definition:prepare(workflow,[{...task,interactiveTerminal:false}],{}),tasks,runtimeDirectory:root,vaultBase:root,redact:s=>s});
  assert.equal(result.phase,'failed');assert.equal(result.steps.length,1);assert.equal(result.steps[0].result.cancelled,true);
}));
