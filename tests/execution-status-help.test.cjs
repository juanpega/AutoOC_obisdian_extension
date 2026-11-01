const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

function harness() {
  class Element {
    constructor(options={}) {this.textContent=options.text||'';this.children=[];this.attrs={};this.style={};this.classList={add(){},toggle(){}};}
    createEl(tag, options) {const child=new Element(options);child.tag=tag;this.children.push(child);return child;}
    createDiv(cls) {const child=this.createEl('div');child.cls=cls;return child;}
    empty() {this.children=[];}
    addClass() {}
    setAttr(key,value) {this.attrs[key]=value;}
    all() {return [this,...this.children.flatMap(child=>child.all())];}
  }
  const mod={exports:{}},opened=[],copies=[],notices=[];
  class Stub {}
  const obsidian={Plugin:Stub,ItemView:Stub,PluginSettingTab:Stub,Setting:Stub,Notice:class {constructor(text){notices.push(text);}},
    Modal:class {constructor(){this.contentEl=new Element();} open(){opened.push(this);this.onOpen();} close(){this.onClose();}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8')+
    '\nmodule.exports.helpTest={AutoOCView,executionStatusHelp,ExecutionStatusHelpModal};',
    {module:mod,exports:mod.exports,require:id=>id==='obsidian'?obsidian:require(id),process,Buffer,console,
      setTimeout,clearTimeout,setInterval,clearInterval,AbortController,
      navigator:{clipboard:{async writeText(value){copies.push(value);}}}});
  const {AutoOCView,executionStatusHelp}=mod.exports.helpTest;
  const view=Object.create(AutoOCView.prototype),plugin={manifest:{version:'1.7.14'},settings:{tasks:[],workflows:[]},ownsExecution:()=>false,
    availableModels:[],taskStopIdentity:()=>undefined,configureStartButton(){},getEffectiveAgent:()=>'',redactSecrets:text=>text};
  view.plugin=plugin;view.app={};view.openTaskInList=item=>view.destination=['task',item.id];view.openWorkflowInList=item=>view.destination=['workflow',item.id];
  const render=(item,kind)=>{plugin.settings[kind==='task'?'tasks':'workflows']=[item];const root=new Element();view.renderExecutionStatus(root,item,kind);return root;};
  view.expandedTasks=new Set();view.renderSelectionCheckbox=()=>{};view.renderAvailabilityButton=()=>{};
  const renderCard=item=>{plugin.settings.tasks=[item];const root=new Element();view.renderTaskCard(root,item);return root;};
  return {view,plugin,render,renderCard,opened,copies,notices,help:executionStatusHelp};
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

function previousTask(phase='ready', flags={}) {
  return {id:'t',name:'Previous task',status:'pending',taskKind:'opencode',prompt:'PRIVATE_PROMPT',scheduleType:'manual',
    runtimeExecution:{workflowId:'@task:t',runId:'run-previous',phase,...flags}};
}
function blockedError(task) {
  const b=task.runtimeExecution;
  return new Error(`Previous execution requires continuation or reconciliation (run ${b.runId}, workflow ${b.workflowId}, step task). No new task was started.`);
}

for(const label of ['▶','▶ Run']) test(`${label} opens actionable recovery for a ready attempt without changing its state`,async()=>{
  const h=harness(),task=previousTask(),root=h.renderCard(task),before=JSON.stringify(h.plugin.settings);
  let starts=0;h.plugin.runTask=async()=>{starts++;throw blockedError(task);};
  assert.ok(root.all().some(el=>el.textContent==='Abandon attempt'),'ready checkpoints need an exit even without requiresReconciliation');
  await root.all().find(el=>el.tag==='button'&&el.textContent===label).onclick({stopPropagation(){}});
  assert.equal(starts,1);assert.equal(h.opened.length,1);assert.equal(h.notices.length,0);
  const modal=h.opened[0],text=modal.contentEl.all().map(el=>el.textContent).join(' ');
  assert.match(text,/No new task was started/);assert.match(text,/choose Abandon attempt/);
  assert.match(text,/process has ended/);assert.match(text,/may repeat earlier effects/);
  h.view.taskSource='workflow-code';h.view.filterArea='Hidden area';
  modal.contentEl.all().find(el=>el.textContent==='Open recovery controls').onclick();
  assert.deepEqual(h.view.destination,['task','t']);assert.equal(h.view.taskSource,'all');assert.equal(h.view.filterArea,'all');
  assert.equal(JSON.stringify(h.plugin.settings),before);assert.equal(starts,1,'review must not retry the task');
});

test('unfinished and terminal guards explain the available recovery action, not a reset',()=>{
  const cases=[
    [previousTask('in_flight',{requiresReconciliation:true}), 'Unfinished attempt run-previous. Use Abandon attempt on this task after checking its external process has ended. No new task was started.', 'Abandon attempt'],
    [previousTask('failed',{requiresReconciliation:true,terminalUncertainty:true}), 'Previous task outcome is unconfirmed; recovery is required before starting a new attempt.', 'Resolve historical uncertainty'],
  ];
  for(const [task,message,label] of cases){
    const h=harness(),root=h.renderCard(task),before=JSON.stringify(h.plugin.settings);
    h.view.showTaskStartFailure(task,new Error(message));
    assert.equal(h.opened.length,1);
    assert.ok(h.opened[0].contentEl.all().some(el=>el.textContent.includes(label)));
    assert.ok(root.all().some(el=>el.textContent===label));
    if(task.runtimeExecution.phase==='failed')assert.ok(!root.all().some(el=>el.textContent==='Abandon attempt'));
    assert.equal(JSON.stringify(h.plugin.settings),before);
  }
});

test('a blocked task belonging to a workflow opens the owning workflow controls',()=>{
  const h=harness(),task=previousTask('completed');task.runtimeExecution.workflowId='w';
  h.plugin.settings.workflows=[{id:'w',name:'Owning workflow',status:'pending',runtimeExecution:{runId:'run-previous',phase:'in_flight',requiresReconciliation:true}}];
  h.renderCard(task);h.view.showTaskStartFailure(task,blockedError(task));
  const modal=h.opened[0];assert.ok(modal.contentEl.all().some(el=>el.textContent==='Owning workflow'));
  assert.ok(modal.contentEl.all().some(el=>el.textContent.includes('Verify previous result')));
  modal.contentEl.all().find(el=>el.textContent==='Open recovery controls').onclick();
  assert.deepEqual(h.view.destination,['workflow','w']);
});

test('starting another task identifies the blocking task rather than the clicked card',async()=>{
  const h=harness(),blocking=previousTask(),clicked={...previousTask(),id:'other',name:'New task',runtimeExecution:undefined};
  const root=h.renderCard(clicked);h.plugin.settings.tasks.push(blocking);
  const before=JSON.stringify(h.plugin.settings);h.plugin.runTask=async()=>{throw blockedError(blocking);};
  await root.all().find(el=>el.tag==='button'&&el.textContent==='▶').onclick({stopPropagation(){}});
  const modal=h.opened[0];assert.ok(modal.contentEl.all().some(el=>el.textContent==='Previous task'));
  modal.contentEl.all().find(el=>el.textContent==='Open recovery controls').onclick();
  assert.deepEqual(h.view.destination,['task','t']);assert.equal(JSON.stringify(h.plugin.settings),before);
});

test('unrelated failures, deleted tasks and errors from another attempt never redirect recovery',()=>{
  const h=harness(),task=previousTask();h.renderCard(task);
  h.view.showTaskStartFailure(task,new Error('Provider unavailable'));
  const old=blockedError(task);task.runtimeExecution.runId='new-run';h.view.showTaskStartFailure(task,old);
  h.plugin.settings.tasks=[];h.view.showTaskStartFailure(task,blockedError(task));
  assert.equal(h.opened.length,0);assert.equal(h.notices.length,3);
});

test('owned attempts do not offer abandonment and still direct the user to live controls',()=>{
  const h=harness();h.plugin.ownsExecution=()=>true;
  const task=previousTask('in_flight',{requiresReconciliation:true}),root=h.renderCard(task);
  assert.ok(!root.all().some(el=>el.textContent==='Abandon attempt'));
  h.view.showTaskStartFailure(task,blockedError(task));
  assert.ok(!h.opened[0].contentEl.all().some(el=>el.textContent.includes('choose Abandon attempt')));
});

test('blocked-run help stays bound to the observed attempt after the catalog changes',()=>{
  for(const action of ['Open recovery controls','Refresh information']){
    const h=harness(),task=previousTask();h.renderCard(task);
    h.view.showTaskStartFailure(task,blockedError(task));
    const modal=h.opened[0];task.runtimeExecution.runId='replacement';
    modal.contentEl.all().find(el=>el.textContent===action).onclick();
    assert.equal(h.view.destination,undefined);
    if(action==='Refresh information')assert.ok(modal.contentEl.all().some(el=>el.textContent.includes('no longer available')));
  }
});
