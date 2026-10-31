const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm');
const {runInstalledWorkflow} = require('../autooc-runtime.cjs');

class Element {
  constructor(options={}) { this.textContent=options.text || ''; this.children=[]; this.style={}; this.attrs=options.attr || {}; this.classList={toggle(){}}; this.isConnected=true; }
  createEl(tag, options={}) { const el=new Element(options); el.tag=tag; this.children.push(el); return el; }
  createDiv(options) { return this.createEl('div',options); } createSpan(options) {return this.createEl('span',options);}
  setAttr(key,value) {this.attrs[key]=value;} addClass(){} removeClass(){} empty(){this.children=[];}
  all(){return [this,...this.children.flatMap(el=>el.all())];}
}
const notices=[], moduleStub={exports:{}};
class Stub {}
const obsidian={Plugin:Stub,ItemView:Stub,Modal:class {constructor(){this.contentEl=new Element();} open(){}},Setting:Stub,PluginSettingTab:Stub,Notice:class {constructor(text){notices.push(text);}}};
// Match Obsidian: the renderer exposes Node APIs but cannot create Node Workers.
const rendererProcess=new Proxy(process,{get(target,key){return key==='versions'?{...target.versions,electron:'fixture'}:Reflect.get(target,key,target);}});
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8')+
  '\nmodule.exports.testing={AutoOCView,selectCodeStep,prepareWorkflowDefinition,codeStepDisplay,toExportWorkflow};',
  {module:moduleStub,exports:moduleStub.exports,require:id=>id==='obsidian'?obsidian:id==='worker_threads'?{Worker:class {constructor(){throw Error('Renderer workers unavailable');}}}:require(id),process:rendererProcess,Buffer,console,setTimeout,clearTimeout,setInterval,clearInterval,AbortController});
const Plugin=moduleStub.exports.default, api=moduleStub.exports.testing;
function catalog(code='output="selected";') {return {tasks:[],workflows:[{id:'workflow',name:'Workflow',status:'pending',currentStep:-1,steps:[
  {id:'before',stepKind:'code',codeAllowVault:true,code:'vault.append("effects.txt","before"); output="before";'},
  {id:'chosen',stepKind:'code',name:'Code helper',codeAllowVault:true,code},
  {id:'after',stepKind:'code',codeAllowVault:true,code:'vault.append("effects.txt","after"); output="after";'},
]}]};}
async function fixture(config, action) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-code-controls-'));
  const directory=path.join(root,'.obsidian/plugins/auto-oc');fs.mkdirSync(directory,{recursive:true});
  const file=path.join(directory,'data.json');fs.writeFileSync(file,JSON.stringify(config));
  const read=()=>JSON.parse(fs.readFileSync(file,'utf8'));
  try {await action({root,directory,file,read});}
  finally {assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('autooc-code-controls-'));fs.rmSync(root,{recursive:true});}
}
function plugin(root){const p=new Plugin();p.app={vault:{configDir:'.obsidian',adapter:{basePath:root,queue:job=>job(),reconcileInternalFile:async()=>{}}},workspace:{getLeavesOfType:()=>[]}};p.manifest={id:'auto-oc'};return p;}

test('isolated code run preserves full workflow state, identities, routing and history across reload', async()=>{
  await fixture(catalog('vault.append("effects.txt","chosen"); output="selected";'),async f=>{
    const complete=await runInstalledWorkflow({vault:f.root,workflowId:'workflow',newExecution:true,redact:s=>s});
    assert.equal(complete.phase,'completed');
    const before=f.read(), p=plugin(f.root);
    p.reservePluginExecution();
    try {
      await p.loadSettings();
      await p.runCodeStepOnly('workflow','chosen');
      const current=f.read(), step=current.workflows[0].steps[1];
      assert.equal(step.codeExecution.status,'completed');assert.equal(step.codeExecution.output,'selected');
      assert.equal(fs.readFileSync(path.join(f.root,'effects.txt'),'utf8'),'beforechosenafterchosen');
      assert.equal(current.workflows[0].runtimeExecution.runId,complete.runId);
      delete current.workflows[0].steps[1].codeExecution;
      assert.deepEqual(current.workflows,before.workflows);
      await p.loadSettings();
      assert.equal(p.codeStepState('workflow','chosen').output,'selected');
      assert.equal(p.codeStepState('workflow','chosen').status,'completed');
      const runId=p.settings.workflows[0].steps[1].codeExecution.runtimeExecution.runId;
      assert.notEqual(runId,complete.runId);
      await p.runCodeStepOnly('workflow','chosen');
      assert.notEqual(p.settings.workflows[0].steps[1].codeExecution.runtimeExecution.runId,runId);
      const previous=JSON.parse(fs.readFileSync(path.join(f.directory,'runtime',runId+'.json'),'utf8'));
      assert.equal(previous.steps.length,1);assert.equal(previous.steps[0].stepId,'chosen');
    } finally {p.releasePluginExecution(false);}
  });
});

test('disabled code steps block isolated and full runs without changing definition hashes or losing output',async()=>{
  const config=catalog(), before=api.prepareWorkflowDefinition(config.workflows[0],[],config).hash;
  config.workflows[0].steps[1].disabled=true;
  assert.equal(api.prepareWorkflowDefinition(config.workflows[0],[],config).hash,before);
  assert.equal(api.toExportWorkflow(config.workflows[0],'wf',new Map()).steps[1].disabled,true);
  await fixture(config,async f=>{
    await assert.rejects(runInstalledWorkflow({vault:f.root,workflowId:'workflow',stepId:'chosen',newExecution:true,redact:s=>s}),/disabled/);
    await assert.rejects(runInstalledWorkflow({vault:f.root,workflowId:'workflow',newExecution:true,redact:s=>s}),/disabled/);
    assert.equal(fs.existsSync(path.join(f.root,'effects.txt')),false);
    assert.deepEqual(f.read(),config);
  });
});

test('changing the kind of a completed code step or duplicating its workflow does not inherit a live binding',async()=>{
  await fixture(catalog(),async f=>{
    await runInstalledWorkflow({vault:f.root,workflowId:'workflow',stepId:'chosen',newExecution:true,redact:s=>s});
    const config=f.read();config.workflows[0].steps[1].stepKind='delay';
    fs.writeFileSync(f.file,JSON.stringify(config));
    const p=plugin(f.root);p.reservePluginExecution();
    try {
      await p.loadSettings();
      assert.equal(p.settings.workflows[0].steps[1].codeExecution.status,'completed');
      p.settings.workflows[0].scheduleDays=[];
      await p.duplicateWorkflow(p.settings.workflows[0]);
      assert.equal(p.settings.workflows[1].steps[1].codeExecution,undefined);
    } finally {p.releasePluginExecution(false);}
  });
});

test('background code allows Stop during a loop, keeps effects unknown, and never starts later steps',async()=>{
  await fixture(catalog('console.log("entered"); while (true) {}'),async f=>{
    const controller=new AbortController();let ticks=0, seen=false;
    const timer=setInterval(()=>ticks++,10);
    try {
      const result=await runInstalledWorkflow({vault:f.root,workflowId:'workflow',stepId:'chosen',newExecution:true,redact:s=>s,signal:controller.signal,
        onTaskOutput:event=>{assert.equal(event.stepId,'chosen');seen=true;controller.abort();}});
      assert.ok(seen);assert.ok(ticks>0);assert.equal(result.phase,'failed');assert.equal(result.steps.length,1);
      assert.equal(result.steps[0].result.cancelled,true);assert.equal(fs.existsSync(path.join(f.root,'effects.txt')),false);
      assert.equal(f.read().workflows[0].steps[1].codeExecution.runtimeExecution.terminalUncertainty,true);
    } finally {clearInterval(timer);}
  });
});

test('background vault mutations flush after writes, including code that throws, without expanding permissions',async()=>{
  const config=catalog('vault.write("note.md","kept"); throw new Error("test failure");');
  await fixture(config,async f=>{
    const events=[];
    const result=await runInstalledWorkflow({vault:f.root,workflowId:'workflow',stepId:'chosen',newExecution:true,redact:s=>s,
      vaultMutations:()=>({record:m=>events.push(m.operation),flush:async()=>{assert.equal(fs.readFileSync(path.join(f.root,'note.md'),'utf8'),'kept');events.push('flush');}})});
    assert.equal(result.phase,'failed');assert.deepEqual(events,['write','flush']);
  });
  const denied=catalog('output=typeof files + "," + typeof terminal + "," + typeof require + "," + typeof process;');
  await fixture(denied,async f=>{
    const result=await runInstalledWorkflow({vault:f.root,workflowId:'workflow',stepId:'chosen',newExecution:true,redact:s=>s});
    assert.equal(result.steps[0].output,'undefined,undefined,undefined,undefined');
  });
});

test('inline code cards collapse independently and expose the same actions in Tasks and workflows',async()=>{
  const p=plugin();p.settings=catalog();p.settings.workflows.push({...catalog().workflows[0],id:'other'});
  p.saveSettings=async()=>{};
  const view=new api.AutoOCView({},p);view.app=p.app;
  const render=(id)=>{const root=new Element(), workflow=p.settings.workflows.find(w=>w.id===id), step=workflow.steps[1];
    view.renderWorkflowCodeEntry(root,{workflow,step,stepIndex:1,name:step.name,area:'No area',status:'pending'});return root;};
  const first=render('workflow'), card=first.children[0], summary=card.children[0], details=card.children[1];
  assert.equal(details.style.display,'none');summary.onclick();assert.equal(details.style.display,'block');
  assert.equal(render('other').children[0].children[1].style.display,'none');
  assert.equal(render('workflow').children[0].children[1].style.display,'block');
  const buttons=first.all().filter(el=>el.tag==='button');
  for(const text of ['Disable','▶','📄','📜','Edit Code','Open workflow']) assert.ok(buttons.some(b=>b.textContent===text),text);
  const calls=[];p.runCodeStepOnly=async(...args)=>calls.push(args);
  await buttons.find(b=>b.textContent==='▶').onclick({stopPropagation(){}});
  assert.equal(JSON.stringify(calls),JSON.stringify([['workflow','chosen']]));
  await buttons.find(b=>b.textContent==='Disable').onclick({stopPropagation(){}});
  assert.equal(p.settings.workflows[0].steps[1].disabled,true);
  assert.equal(p.settings.workflows[1].steps[1].disabled,undefined);
});

test('Stop refuses a stale or different step identity',async()=>{
  const p=plugin();p.settings=catalog();p.pluginExecutionLease={assertOwned(){}};
  const controller=new AbortController();
  p.sharedWorkflowExecutions.set('workflow',{workflowId:'workflow',runId:'current',controller,checkpoint:{runId:'current',phase:'in_flight',nextStepId:'chosen',steps:[{stepId:'chosen',status:'in_flight'}]}});
  await assert.rejects(p.stopCodeStep('workflow','chosen',{runId:'old',stepIndex:0}),/changed/);
  await assert.rejects(p.stopCodeStep('workflow','before',{runId:'current',stepIndex:0}),/changed/);
  assert.equal(controller.signal.aborted,false);
  await p.stopCodeStep('workflow','chosen',{runId:'current',stepIndex:0});assert.equal(controller.signal.aborted,true);
});
