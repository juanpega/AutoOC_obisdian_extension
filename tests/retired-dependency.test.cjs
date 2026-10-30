const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module'),vm=require('node:vm');
const {transformSync}=require('esbuild');
const root=path.resolve(__dirname,'..');
const notices=[];
const file=path.join(root,'main.js'),mod=new Module(file,module);
mod.filename=file;mod.paths=Module._nodeModulePaths(root);
const original=mod.require.bind(mod);
mod.require=name=>name==='obsidian'?{
  Plugin:class{},Notice:class{constructor(value){notices.push(value);}},ItemView:class{},PluginSettingTab:class{},
  Modal:class{constructor(app){this.app=app;}},Setting:class{},
}:original(name);
mod._compile(fs.readFileSync(file,'utf8')+'\nmodule.exports.internals={LegacyOutputRedaction,VisualBuilderModal,CreateTaskModal,CreateWorkflowModal,toExportTask,toExportWorkflow};',file);
const Plugin=mod.exports.default,{LegacyOutputRedaction,VisualBuilderModal,CreateTaskModal,CreateWorkflowModal,toExportTask,toExportWorkflow}=mod.exports.internals;
function sourceModule(name){
  const filename=path.join(root,name),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(root);
  m._compile(transformSync(fs.readFileSync(filename,'utf8'),{loader:'ts',format:'cjs'}).code,filename);return m.exports;
}
const {assertWorkflowDependencies}=sourceModule('retired-dependency.ts');
function plugin(tasks=[],workflows=[]){
  const p=new Plugin();p.settings={tasks,workflows,workingDirectory:os.tmpdir(),logsEnabled:false};
  p.app={vault:{adapter:{basePath:os.tmpdir()}},workspace:{getLeavesOfType:()=>[]}};
  p.saveSettings=async()=>{};p.ensureUniqueTaskName=x=>x;p.ensureUniqueWorkflowName=x=>x;
  p.getEffectiveDefaultModel=()=> 'fixture';p.getEffectiveAgent=()=> 'build';p.getEffectiveCodexModel=()=> 'fixture';
  return p;
}
function task(kind,dependency){return {id:kind,name:kind,taskKind:kind,requiresAutoOCSecrets:arguments.length<2?true:dependency,prompt:'synthetic prompt',code:'throw Error("must not execute")',status:'pending'};}

test('every plugin engine rejects before reservation, Code, callbacks, process or Git effects',async()=>{
  for(const kind of ['opencode','codex','copilot','code'])for(const dependency of [true,'true',null]){
    const t=task(kind,dependency),p=plugin([t]),before=JSON.stringify(p.settings);let effects=0;
    p.beginLegacyAttempt=()=>{effects++;throw Error('unexpected reservation');};
    await assert.rejects(p.runTask(t,async()=>{effects++;}),/Secrets was retired|must be boolean/);
    if(kind!=='opencode')await assert.rejects(p[{code:'runCodeTask',codex:'runCodexTask',copilot:'runCopilotTask'}[kind]](t),/Secrets was retired|must be boolean/);
    assert.equal(effects,0);assert.equal(JSON.stringify(p.settings),before);
  }
});

test('whole workflow rejects a later dependency before the first Code step, also on continuation',async()=>{
  for(const placement of ['workflow','step','task']){
    const t=task('code',false),wf={id:'workflow',name:'synthetic',status:'pending',steps:[{id:'first',stepKind:'code',code:'throw Error("effect")'},{id:'later',stepKind:'task',taskId:t.id}]};
    (placement==='workflow'?wf:placement==='step'?wf.steps[1]:t).requiresAutoOCSecrets=true;
    const p=plugin([t],[wf]);let effects=0;p.beginExecutionEffects=()=>{effects++;};p.pluginExecutionLease={};
    await assert.rejects(p.runWorkflow(wf),/Secrets was retired/);
    await assert.rejects(p.runSharedWorkflow(wf.id,'historical-run'),/Secrets was retired/);
    wf.status='running';const before=JSON.stringify(wf);
    await assert.rejects(p.runWorkflowStepById(wf.id,'first'),/Secrets was retired/);
    await assert.rejects(p.runWorkflowStep(0,0),/Secrets was retired/);
    await assert.rejects(p.runCodeStep(wf,wf.steps[0],0),/Secrets was retired/);
    assert.equal(effects,0);assert.equal(JSON.stringify(wf),before);
  }
});

test('shared host rejects dependency before lease, journal, evaluator or adapter effects',async()=>{
  const runtime=require('../autooc-runtime.cjs');
  for(const kind of ['opencode','codex','copilot','code']){
    const t=task(kind),wf={id:'synthetic',steps:[{id:'first',stepKind:'code',code:'throw Error("effect")'},{id:'task',stepKind:'task',taskId:t.id}]};
    const definition=runtime.prepareWorkflowDefinition(wf,[t],{});let effects=0;
    await assert.rejects(runtime.runCodeWorkflowHost({definition,runtimeDirectory:'must-not-create',vaultBase:os.tmpdir(),redact:x=>x,tasks:{supports:()=>true,execute:async()=>{effects++;}},evaluate:async()=>{effects++;}}),/Secrets was retired/);
    assert.equal(effects,0);assert.equal(fs.existsSync(path.join(root,'must-not-create')),false);
  }
  for(const value of [false,undefined])assert.doesNotThrow(()=>assertWorkflowDependencies({steps:[{stepKind:'task',taskId:'ok'}]},[{id:'ok',requiresAutoOCSecrets:value}]));
});

test('synthetic historical masking is read only, handles overlaps and sanitizes failures',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-retired-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'historical.json'),short='synthetic-token',long=short+'-long';
  const content=JSON.stringify({pin:{hash:'kept'},secrets:[short,long,'abc'].map(v=>({encryptedValue:Buffer.from(v).toString('base64')}))});
  fs.writeFileSync(file,content);const diagnostics=[],redactor=new LegacyOutputRedaction(()=>diagnostics.push('unavailable'));
  redactor.load(file,{decryptString:b=>b.toString()});
  assert.equal(redactor.redact(long+' '+short+' abc'),'[secret:redacted] [secret:redacted] abc');
  assert.equal(fs.readFileSync(file,'utf8'),content);
  for(const method of ['save','upsert','delete','getEnv','getRedactionValues','decryptValue','setPin','resetPin'])assert.equal(redactor[method],undefined);
  const unavailable=new LegacyOutputRedaction(()=>diagnostics.push('unavailable'));
  unavailable.load(file,null);assert.equal(diagnostics.length,1);
  unavailable.load(file,{decryptString:()=>{throw Error(long);}});assert.equal(diagnostics.length,2);
  fs.writeFileSync(file,'{"broken":"'+long+'"');unavailable.load(file,null);assert.equal(diagnostics.length,3);
  assert.ok(!JSON.stringify(diagnostics).includes(short));
  const absent=path.join(dir,'absent.json');unavailable.load(absent,null);assert.equal(fs.existsSync(absent),false);
});

test('import/export, classic drafts and builder merge preserve dependency including malformed metadata',async()=>{
  for(const value of [true,false,undefined,'true',null]){
    const p=plugin();const portable={autoOCExport:{schemaVersion:'1.6.0'},tasks:[{...task('code',value),exportId:'t'}],workflows:[{exportId:'w',name:'old',requiresAutoOCSecrets:value,steps:[{id:'s',stepKind:'task',taskExportId:'t',requiresAutoOCSecrets:value}]}]};
    await p.importFromData(portable);const t=p.settings.tasks[0],w=p.settings.workflows[0];
    const exportedT=toExportTask(t,'t'),exportedW=toExportWorkflow(w,'w',new Map([[t.id,'t']]));
    assert.equal(exportedT.requiresAutoOCSecrets,value);assert.equal(exportedW.requiresAutoOCSecrets,value);assert.equal(exportedW.steps[0].requiresAutoOCSecrets,value);
    assert.equal(new CreateTaskModal(p.app,p,t).draft.requiresAutoOCSecrets,value);
    assert.equal(new CreateWorkflowModal(p.app,p,w).draft.requiresAutoOCSecrets,value);
    const builder=new VisualBuilderModal(p.app,p);const state=JSON.parse(JSON.stringify(p.settings));
    delete state.tasks[0].requiresAutoOCSecrets;delete state.workflows[0].requiresAutoOCSecrets;delete state.workflows[0].steps[0].requiresAutoOCSecrets;
    await builder.applyExternalState(state);
    assert.equal(p.settings.tasks[0].requiresAutoOCSecrets,value);assert.equal(p.settings.workflows[0].requiresAutoOCSecrets,value);assert.equal(p.settings.workflows[0].steps[0].requiresAutoOCSecrets,value);
    const reloaded=plugin();await reloaded.importFromData({autoOCExport:{schemaVersion:'1.6.0'},tasks:[exportedT],workflows:[exportedW]});
    assert.equal(reloaded.settings.workflows[0].requiresAutoOCSecrets,value);
  }
});

test('Visual Builder serializes step dependency and visibly warns without a management toggle',()=>{
  const html=fs.readFileSync(path.join(root,'util/ui_workflow_builder/index.html'),'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const messages=[],context=vm.createContext({document:{querySelector:()=>({innerHTML:'',classList:{add(){}}}),querySelectorAll:()=>[]},window:{parent:{postMessage:x=>messages.push(x)}},setTimeout:()=>0,clearTimeout(){},confirm:()=>true});
  vm.runInContext(script.replace(/  init\(\);\s*$/,''),context);
  vm.runInContext('inExtension=true;state.tasks=[{id:"t",requiresAutoOCSecrets:true}];state.workflows=[{id:"w",requiresAutoOCSecrets:true,steps:[{id:"s",stepKind:"task",taskId:"t",requiresAutoOCSecrets:true}]}];applyToExtension(true);',context);
  assert.equal(messages[0].state.workflows[0].steps[0].requiresAutoOCSecrets,true);
  assert.match(vm.runInContext('retiredDependencyWarning(state.tasks[0])',context),/retired/);
  const portable=vm.runInContext('buildStandaloneExport()',context);
  assert.equal(portable.workflows[0].requiresAutoOCSecrets,true);assert.equal(portable.workflows[0].steps[0].requiresAutoOCSecrets,true);
});

test('scheduling reports incompatible definitions and still considers compatible work',async()=>{
  const incompatible={...task('code'),scheduleType:'interval',scheduleIntervalValue:1,scheduleIntervalUnit:'seconds'};
  const compatible={...task('copilot',false),scheduleType:'interval',scheduleIntervalValue:1,scheduleIntervalUnit:'seconds'};
  const wf={id:'old',name:'old',status:'pending',scheduleType:'interval',scheduleIntervalValue:1,scheduleIntervalUnit:'seconds',steps:[{id:'code',stepKind:'code'},{id:'later',stepKind:'task',taskId:incompatible.id}]};
  const p=plugin([incompatible,compatible],[wf]),attempts=[];
  p.runTask=async t=>attempts.push(t.id);p.runWorkflow=async w=>attempts.push(w.id);
  const before=notices.length;await p.runDueAll();
  assert.deepEqual(attempts,[compatible.id]);assert.ok(notices.slice(before).some(x=>x.includes('retired')));
});

test('loading and saving a synthetic old catalog preserves history and the historical file',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-retired-catalog-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const historical=path.join(dir,'.obsidian/plugins/auto-oc/secrets.vault.json');fs.mkdirSync(path.dirname(historical),{recursive:true});
  const value='synthetic-history-only',bytes=JSON.stringify({secrets:[{encryptedValue:Buffer.from(value).toString('base64')}]});fs.writeFileSync(historical,bytes);
  const old={...task('code'),status:'completed',output:'old result',scheduleMonthDays:[],scheduleIntervalValue:10,scheduleIntervalUnit:'minutes'};
  const wf={id:'w',name:'old',status:'completed',requiresAutoOCSecrets:true,scheduleType:'manual',scheduleMonthDays:[],scheduleIntervalValue:10,scheduleIntervalUnit:'minutes',handoffOutput:true,steps:[{id:'s',stepKind:'code',requiresAutoOCSecrets:true,transitions:[],position:{x:0,y:0},output:'old step'}]};
  const catalog={tasks:[old],workflows:[wf],custom:{id:'retained'}};
  const p=plugin();p.manifest={version:'fixture'};p.app.vault.adapter.basePath=dir;p.loadData=async()=>JSON.parse(JSON.stringify(catalog));
  let saved;p.saveSettings=async()=>{saved=JSON.parse(JSON.stringify(p.settings));};
  const previous=global.window;global.window={require:()=>({safeStorage:{isEncryptionAvailable:()=>true,decryptString:b=>b.toString()}})};
  try{await p.loadSettings();await p.saveSettings();}finally{global.window=previous;}
  assert.deepEqual(saved.tasks,catalog.tasks);assert.deepEqual(saved.workflows,catalog.workflows);assert.deepEqual(saved.custom,catalog.custom);
  assert.equal(p.redactSecrets('output '+value),'output [secret:redacted]');assert.equal(fs.readFileSync(historical,'utf8'),bytes);
  await p.duplicateTask(p.settings.tasks[0]);await p.duplicateWorkflow(p.settings.workflows[0]);
  assert.equal(p.settings.tasks[1].requiresAutoOCSecrets,true);assert.equal(p.settings.workflows[1].requiresAutoOCSecrets,true);assert.equal(p.settings.workflows[1].steps[0].requiresAutoOCSecrets,true);
});
