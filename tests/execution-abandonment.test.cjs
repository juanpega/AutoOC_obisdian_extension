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
