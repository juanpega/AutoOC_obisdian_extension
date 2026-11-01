const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

function harness() {
  class Element {
    constructor(options={}) {this.textContent=options.text||'';this.children=[];this.attrs={};}
    createEl(tag, options) {const child=new Element(options);child.tag=tag;this.children.push(child);return child;}
    createDiv(cls) {const child=this.createEl('div');child.cls=cls;return child;}
    empty() {this.children=[];}
    addClass() {}
    setAttr(key,value) {this.attrs[key]=value;}
    all() {return [this,...this.children.flatMap(child=>child.all())];}
  }
  const mod={exports:{}},opened=[],copies=[];
  class Stub {}
  const obsidian={Plugin:Stub,ItemView:Stub,PluginSettingTab:Stub,Setting:Stub,Notice:Stub,
    Modal:class {constructor(){this.contentEl=new Element();} open(){opened.push(this);this.onOpen();} close(){this.onClose();}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8')+
    '\nmodule.exports.helpTest={AutoOCView,executionStatusHelp,ExecutionStatusHelpModal};',
    {module:mod,exports:mod.exports,require:id=>id==='obsidian'?obsidian:require(id),process,Buffer,console,
      setTimeout,clearTimeout,setInterval,clearInterval,AbortController,
      navigator:{clipboard:{async writeText(value){copies.push(value);}}}});
  const {AutoOCView,executionStatusHelp}=mod.exports.helpTest;
  const view=Object.create(AutoOCView.prototype),plugin={manifest:{version:'1.7.2'},settings:{tasks:[],workflows:[]},ownsExecution:()=>false};
  view.plugin=plugin;view.app={};view.openTaskInList=item=>view.destination=['task',item.id];view.openWorkflowInList=item=>view.destination=['workflow',item.id];
  const render=(item,kind)=>{plugin.settings[kind==='task'?'tasks':'workflows']=[item];const root=new Element();view.renderExecutionStatus(root,item,kind);return root;};
  return {view,plugin,render,opened,copies,help:executionStatusHelp};
}
const base={name:'Synthetic',status:'completed',runId:'run-old',phase:'completed',owned:false};
test('finished history needs no live owner; incomplete and uncertain attempts still need guidance',()=>{
  const {help}=harness();
  assert.match(help(base).label,/completed/);assert.equal(help(base).attention,false);
  assert.match(help(base).next,/You do not need to unlock/);
  for (const flags of [{requiresReconciliation:true},{terminalUncertainty:true}]) {
    assert.equal(help({...base,...flags}).label,'Needs review');
    assert.equal(help({...base,...flags}).attention,true);
  }
  for (const phase of ['ready','in_flight']) assert.equal(help({...base,phase}).label,'Activity not confirmed');
  assert.equal(help({...base,status:'running'}).label,'Activity not confirmed');
  assert.match(help({...base,phase:'failed',status:'failed'}).label,/failed/);
  assert.match(help({...base,phase:'abandoned'}).label,/unknown/);
  assert.match(help({...base,disposition:true,terminalUncertainty:true}).label,/unknown/);
  assert.equal(help({...base,phase:undefined}).label,'Run information');
  assert.equal(help({...base,owned:true,phase:'in_flight'}).label,'Run controlled by this window');
  assert.equal(help({...base,owned:true,waitingApproval:true}).label,'Waiting for your approval');
  assert.equal(help({...base,owned:true,stopUnconfirmed:true}).label,'Stop not confirmed');
});

for (const kind of ['task','workflow']) test(`${kind} card help uses current state and never changes or runs the catalog`,async()=>{
  const h=harness(),item={id:'item',name:'Synthetic',status:'failed',prompt:'PRIVATE_PROMPT',output:'PRIVATE_OUTPUT',
    runtimeExecution:{workflowId:'item',runId:'run-old',phase:'failed',token:'PRIVATE_TOKEN'}};
  const root=h.render(item,kind),before=JSON.stringify(h.plugin.settings);
  assert.ok(root.all().some(el=>el.textContent==='Last run failed'));
  assert.ok(!root.all().some(el=>/run-old|propiedad no verificada/.test(el.textContent)));
  const button=root.all().find(el=>el.textContent==='What can I do?');
  assert.match(button.attrs['aria-label'],/Synthetic/);
  // The help reads the current item, not the stale card closure.
  item.runtimeExecution.terminalUncertainty=true;
  let stopped=false;button.onclick({stopPropagation(){stopped=true;}});assert.equal(stopped,true);
  const modal=h.opened[0];assert.ok(modal.contentEl.all().some(el=>el.textContent==='Needs review'));
  delete item.runtimeExecution.terminalUncertainty;
  modal.contentEl.all().find(el=>el.textContent==='Refresh information').onclick();
  assert.ok(modal.contentEl.all().some(el=>el.textContent==='Last run failed'));
  await modal.contentEl.all().find(el=>el.textContent==='Copy diagnostics').onclick();
  assert.equal(JSON.parse(h.copies[0]).runId,'run-old');
  assert.doesNotMatch(h.copies[0],/PRIVATE_|Synthetic/);
  modal.contentEl.all().find(el=>el.textContent==='View details and options').onclick();
  assert.deepEqual(h.view.destination,[kind,'item']);
  assert.equal(h.view.filterArea,'all');assert.equal(h.view.filterStatus,'all');
  assert.equal(JSON.stringify(h.plugin.settings),before);
});

test('completed task in unfinished workflow explains the owning attempt and opens its options',()=>{
  const h=harness(),task={id:'t',name:'Step',status:'completed',runtimeExecution:{workflowId:'w',runId:'shared',phase:'completed'}},
    workflow={id:'w',name:'Parent',runtimeExecution:{runId:'shared',phase:'in_flight',requiresReconciliation:true}};
  h.plugin.settings.workflows=[workflow];
  const root=h.render(task,'task');assert.ok(root.all().some(el=>el.textContent==='Needs review'));
  root.all().find(el=>el.textContent==='What can I do?').onclick({stopPropagation(){}});
  const modal=h.opened[0];assert.ok(modal.contentEl.all().some(el=>el.textContent==='Workflow run: Parent'));
  modal.contentEl.all().find(el=>el.textContent==='View workflow and options').onclick();
  assert.deepEqual(h.view.destination,['workflow','w']);
  workflow.runtimeExecution.runId='different-attempt';
  const next=h.render(task,'task');assert.equal(next.children.length,0);
});

test('help handles deleted items without acting on an old execution',()=>{
  const h=harness(),root=h.render({id:'t',name:'Deleted',status:'failed',runtimeExecution:{runId:'old',phase:'failed'}},'task');
  root.all().find(el=>el.textContent==='What can I do?').onclick({stopPropagation(){}});
  const modal=h.opened[0];h.plugin.settings.tasks=[];
  modal.contentEl.all().find(el=>el.textContent==='Refresh information').onclick();
  assert.match(modal.contentEl.all().map(el=>el.textContent).join(' '),/no longer available/);
  assert.ok(!modal.contentEl.all().some(el=>el.tag==='button'));assert.equal(h.view.destination,undefined);
});

for (const kind of ['task','workflow']) test(`${kind} shows guidance only when intervention is needed`,()=>{
  const h=harness();
  const render=(status,phase,flags={},owned=false)=>{
    h.plugin.ownsExecution=()=>owned;
    const item={id:'item',name:'Synthetic',status,runtimeExecution:{runId:'run',workflowId:'item',phase,...flags}};
    const before=JSON.stringify(item),root=h.render(item,kind);
    assert.equal(JSON.stringify(item),before);
    return root;
  };
  for (const [status,phase,flags,owned] of [
    ['pending',undefined,{},false], ['completed','completed',{},false],
    ['running','in_flight',{},true], ['completed','completed',{},true],
    ['abandoned','abandoned',{},false], ['failed','failed',{disposition:{at:'closed'},terminalUncertainty:true},false],
  ]) assert.equal(render(status,phase,flags,owned).children.length,0,`${status}/${phase}`);
  for (const [status,phase,flags] of [
    ['failed','failed',{}], ['failed','completed',{}], ['running','in_flight',{}],
    ['completed','completed',{requiresReconciliation:true}],
    ['completed','completed',{terminalUncertainty:true}],
  ]) assert.ok(render(status,phase,flags).all().some(el=>el.textContent==='What can I do?'),`${status}/${phase}`);
  // Once a review is resolved, the next card render removes the whole help block.
  assert.ok(render('completed','completed',{requiresReconciliation:true}).children.length);
  assert.equal(render('completed','completed').children.length,0);
});

test('owned tasks still show approval and unconfirmed-stop guidance',()=>{
  const h=harness();h.plugin.ownsExecution=()=>true;
  for(const flags of [{pendingCodexApproval:{requestId:'approval'}},{legacyExecution:{stopState:'unconfirmed'}}]) {
    const root=h.render({id:'t',name:'Needs action',status:'running',runtimeExecution:{runId:'run',phase:'in_flight'},...flags},'task');
    assert.ok(root.all().some(el=>el.textContent==='What can I do?'));
  }
});
