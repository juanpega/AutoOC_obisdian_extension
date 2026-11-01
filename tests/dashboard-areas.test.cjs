const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function harness(){
  const doc={activeElement:null};
  class Element{
    constructor(tag='div',options={}){this.tag=tag;this.textContent=options.text||'';this.attrs=options.attr||{};this.children=[];this.style={};this.ownerDocument=doc;this.isConnected=true;this.scrollTop=0;this.classes=new Set((typeof options==='string'?options:options.cls||'').split(' '));}
    createEl(tag,options={}){const el=new Element(tag,options);this.children.push(el);return el;}
    createDiv(options={}){return this.createEl('div',options);} createSpan(options={}){return this.createEl('span',options);}
    empty(){this.children=[];} setText(text){this.textContent=text;}
    setAttr(k,v){this.attrs[k]=v;} getAttribute(k){return this.attrs[k]||null;}
    addClass(c){this.classes.add(c);} focus(){doc.activeElement=this;}
    get childElementCount(){return this.children.length;}
    all(){return [this,...this.children.flatMap(c=>c.all())];}
    querySelectorAll(selector){assert.equal(selector,'[data-area-item-key]');return this.all().filter(el=>el.attrs['data-area-item-key']);}
  }
  class Stub{} const notices=[],module={exports:{}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../main.js'),'utf8')+'\nmodule.exports.areaTest={AreaDashboard,createAreaDashboardState,dashboardItems,dashboardVisibleItems,AutoOCView};',{
    module,exports:module.exports,require:id=>id==='obsidian'?{Plugin:Stub,ItemView:Stub,PluginSettingTab:Stub,Modal:Stub,Setting:Stub,setIcon:(el,name)=>el.icon=name,Notice:class{constructor(s){notices.push(s)}}}:require(id),
    process,Buffer,console,setTimeout,clearTimeout,setInterval,clearInterval,AbortController,
  });
  return {...module.exports.areaTest,Element,doc,notices};
}
const task=(id,extra={})=>({id,name:`Task ${id}`,area:'Engineering',status:'pending',...extra});
const flow=(id,steps,extra={})=>({id,name:`Flow ${id}`,area:'Engineering',status:'completed',currentStep:0,steps,...extra});
const code=(id,extra={})=>({id,stepKind:'code',name:`Code ${id}`,status:'pending',...extra});

test('area model preserves identities and branch state, separates disabled dependencies and isolated Code results',()=>{
  const h=harness(), tasks=[task('a',{disabled:true}),task('standalone',{taskKind:'code',area:' '})];
  const wf=flow('w',[{id:'ref',stepKind:'task',taskId:'a'},code('new',{status:'failed',lastRun:'2026-01-01',codeExecution:{status:'completed',lastRun:'2026-02-01',output:'private'}}),code('unvisited')]);
  const before=JSON.stringify([tasks,wf]),items=h.dashboardItems(tasks,[wf]),model=items.find(i=>i.kind==='workflow');
  assert.equal(model.children[0].disabled,true);assert.equal(model.attention,true);
  assert.equal(model.children[1].status,'completed');assert.equal(model.children[2].status,'pending');
  assert.equal(model.children[0].status,'pending');assert.equal(items.find(i=>i.id==='standalone').kind,'code');
  assert.equal(items.find(i=>i.id==='standalone').area,'No area');
  assert.equal(JSON.stringify([tasks,wf]),before);assert.ok(!JSON.stringify(items).includes('private'));
  const different=h.dashboardItems([],[flow('a:b',[code('c')]),flow('a',[code('b:c')])]);
  assert.notEqual(different[0].children[0].key,different[1].children[0].key);
});

test('search finds workflow steps, attention excludes healthy items, disabled items remain available explicitly',()=>{
  const h=harness(),state=h.createAreaDashboardState();
  const items=h.dashboardItems([task('healthy'),task('off',{disabled:true}),task('failure',{status:'failed'})],[flow('w',[code('special')])]);
  assert.equal(h.dashboardVisibleItems(items,state).length,3);
  state.showDisabled=true;assert.equal(h.dashboardVisibleItems(items,state).length,4);
  state.attentionOnly=true;assert.deepEqual(Array.from(h.dashboardVisibleItems(items,state),i=>i.id),['failure']);
  state.attentionOnly=false;state.query='SPECIAL';assert.deepEqual(Array.from(h.dashboardVisibleItems(items,state),i=>i.id),['w']);
});

test('area Dashboard renders bounded Code detail, keeps toolbar, selection, focus and collapse across events without writes',()=>{
  const h=harness(),root=new h.Element(),state=h.createAreaDashboardState(),tasks=[task('a')];
  const wf=flow('w',Array.from({length:120},(_,i)=>code(String(i))));
  let opened, logged, history;
  const dashboard=new h.AreaDashboard(root,state,{items:()=>h.dashboardItems(tasks,[wf]),diameter:()=>16,open:i=>opened=i,log:i=>logged=i,history:i=>history=i});
  const all=()=>root.all(),button=text=>all().find(el=>el.tag==='button'&&el.textContent===text);
  assert.equal(all().filter(el=>el.classes.has('auto-oc-area-step')).length,40);
  const search=all().find(el=>el.tag==='input'&&el.attrs['aria-label']==='Search Dashboard');search.focus();
  const initialNodes=all().filter(el=>el.classes.has('auto-oc-area-node'));
  tasks[0].output='Large output changed';dashboard.update();
  assert.equal(all().find(el=>el.classes.has('auto-oc-area-node')),initialNodes[0]);
  assert.equal(h.doc.activeElement,search);
  const selected=all().find(el=>el.classes.has('auto-oc-area-step'));selected.onclick();
  assert.equal(h.doc.activeElement.attrs['data-area-item-key'],state.selected);
  button('Log').onclick();button('History').onclick();button('Open controls').onclick();
  assert.equal(logged.id,'0');assert.equal(history.workflowId,'w');assert.equal(opened.key,state.selected);
  button('Collapse areas').onclick();assert.ok(state.collapsed.has('Engineering'));
  wf.steps[0].status='running';dashboard.update();
  assert.ok(state.collapsed.has('Engineering'));assert.equal(all().filter(el=>el.classes.has('auto-oc-area-node')).length,0);
  assert.ok(all().some(el=>el.textContent==='Code 0 · Running'));
  assert.ok(all().some(el=>el.textContent===' steps running'));
  search.value='Code 119';search.oninput();
  assert.equal(all().filter(el=>el.classes.has('auto-oc-area-step')).length,1);
  assert.equal(all().find(el=>el.classes.has('auto-oc-area-step')).attrs['aria-label'],'Code 119, code, Ready');
  assert.ok(all().some(el=>el.classes.has('auto-oc-area-orb')&&el.style.width==='16px'));
});

test('Dashboard integration opens exact Code controls and clears stale list filters without running anything',()=>{
  const h=harness(),plugin={settings:{tasks:[task('a')],workflows:[flow('w',[code('s')])]},getDashboardBubbleDiameter:()=>30};
  const view=new h.AutoOCView({},plugin),root=new h.Element();let opened;
  view.openWorkflowCodeEntry=(wf,step)=>opened=[wf,step];view.filterText='old';view.filterArea='missing';view.taskSource='catalog';
  view.renderDashboard(root);
  root.all().find(el=>el.classes.has('auto-oc-area-step')).onclick();
  root.all().find(el=>el.tag==='button'&&el.textContent==='Open controls').onclick();
  assert.deepEqual(opened,['w','s']);assert.equal(view.filterText,'');assert.equal(view.filterArea,'all');assert.equal(view.taskSource,'all');
  const previous=view.areaDashboard;view.refresh();assert.equal(view.areaDashboard,previous);
});
