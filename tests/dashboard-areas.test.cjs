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
  class Stub{} const notices=[],opened=[],module={exports:{}};
  class Modal {constructor(app){this.app=app;this.contentEl=new Element();this.modalEl=new Element();}open(){opened.push(this);this.onOpen?.();}close(){this.onClose?.();}}
  vm.runInNewContext(fs.readFileSync(require.resolve('../main.js'),'utf8')+'\nmodule.exports.areaTest={AreaDashboard,createAreaDashboardState,dashboardItems,workPageDashboardItems,dashboardVisibleItems,AutoOCView,CliLauncherModal,ImportModal};',{
    module,exports:module.exports,require:id=>id==='obsidian'?{Plugin:Stub,ItemView:Stub,PluginSettingTab:Stub,Modal,Setting:Stub,setIcon:(el,name)=>el.icon=name,Notice:class{constructor(s){notices.push(s)}}}:require(id),
    process,Buffer,console,setTimeout,clearTimeout,setInterval,clearInterval,AbortController,
  });
  return {...module.exports.areaTest,Element,doc,notices,opened};
}
const task=(id,extra={})=>({id,name:`Task ${id}`,area:'Engineering',status:'pending',...extra});
const flow=(id,steps,extra={})=>({id,name:`Flow ${id}`,area:'Engineering',status:'completed',currentStep:0,steps,...extra});
const code=(id,extra={})=>({id,stepKind:'code',name:`Code ${id}`,status:'pending',...extra});

test('every page uses the real area Dashboard for the full catalog without linking or saving',()=>{
  const h=harness(),root=new h.Element();
  const page={id:'a',name:'Feature',kind:'folder',directory:'/repo/a',objective:'',taskIds:[],workflowIds:[]};
  const plugin={settings:{tasks:[task('a'),task('b')],workflows:[flow('w',[code('s')])],workPages:[page]},
    ownsExecution:()=>false,isLifecycleStopped:()=>false};
  const before=JSON.stringify(plugin.settings),view=new h.AutoOCView({},plugin);
  view.app={vault:{adapter:{basePath:'/repo'}}};view.selectedWorkPage='a';view.renderDashboard(root);
  const items=()=>root.all().filter(e=>e.classes.has('auto-oc-area-node'));
  assert.equal(items().length,3);assert.equal(root.all().filter(e=>e.classes.has('auto-oc-areas-dashboard')).length,1);
  assert.equal(root.all().some(e=>e.textContent==='Link'),false);
  assert.ok(root.all().some(e=>e.textContent==='Your areas'));assert.equal(JSON.stringify(plugin.settings),before);
  plugin.settings.tasks.push(task('new'));
  view.areaDashboard.update();assert.equal(items().length,4);
  assert.equal(page.taskIds.length,0);assert.equal(page.workflowIds.length,0);
});

test('a panel whose page was deleted returns to Overview and Dashboard then opens Main',()=>{
  const h=harness(),root=new h.Element(),rendered=[];
  const plugin={settings:{tasks:[],workflows:[],workPages:[{id:'old'}]},hasPageTerminal:()=>false};
  const view=new h.AutoOCView({},plugin);view.containerEl=root;view.renderHeader=()=>{};
  view.renderDashboard=()=>rendered.push(view.selectedWorkPage);
  view.currentTab='dashboard';view.selectedWorkPage='old';view.lastWorkPage='old';view.render();
  assert.equal(view.selectedWorkPage,'old');
  plugin.settings.workPages=[];view.render();
  assert.equal(view.selectedWorkPage,'general');assert.equal(view.lastWorkPage,'main');
  assert.equal(!!root.all().find(e=>e.textContent.endsWith('CLI')).disabled,false);
  assert.equal(root.all().find(e=>e.attrs['aria-label']==='Overview').attrs['aria-pressed'],'true');
  root.all().find(e=>e.textContent==='Dashboard').onclick();
  assert.deepEqual(rendered,['old','general','main']);assert.equal(view.selectedWorkPage,'main');
});

test('page Dashboard isolates run and step states from Main and other pages without scanning outputs',()=>{
  const h=harness(),tasks=[task('a',{status:'failed',lastRun:'main',runtimeExecution:{runId:'private-main'}})],
    workflows=[flow('w',[code('s',{status:'failed',codeExecution:{status:'completed',lastRun:'main'}})])];
  const run={pageId:'p',sourceId:'w',task:false,runId:'p-run',workflowId:'p:w',createdAt:'2026-11-10',phase:'in_flight',uncertain:true};
  const runs=[{...run,pageId:'other',sourceId:'a',task:true,phase:'failed'},run],before=JSON.stringify([tasks,workflows,runs]);
  const reads=[],model=h.workPageDashboardItems(tasks,workflows,'p',runs,(w,r)=>w==='p:w'&&r==='p-run',r=>{
    reads.push(r.runId);return {steps:[{stepId:'s',status:'in_flight'}]};
  });
  assert.deepEqual(reads,['p-run']);assert.equal(model.find(i=>i.id==='a').status,'pending');
  const projected=model.find(i=>i.id==='w');assert.equal(projected.status,'running');assert.equal(projected.attention,false);
  assert.equal(projected.children[0].status,'running');assert.equal(projected.activeSteps,1);
  assert.equal(JSON.stringify([tasks,workflows,runs]),before);
  const lost=h.workPageDashboardItems(tasks,workflows,'p',runs,()=>false,()=>undefined).find(i=>i.id==='w');
  assert.equal(lost.attention,true);assert.equal(lost.status,'pending');assert.match(lost.detail,/unavailable/);
});

test('owned runs are Running despite durable recovery flags; approvals, stops and lost ownership still need attention',()=>{
  const h=harness(),root=new h.Element(),state=h.createAreaDashboardState();
  const binding={workflowId:'@task:a',runId:'live',phase:'in_flight',requiresReconciliation:true};
  const tasks=[task('a',{status:'running',runtimeExecution:binding})];
  let owner=true;const checks=[];
  const project=()=>h.dashboardItems(tasks,[],(w,r)=>{checks.push([w,r]);return owner&&w==='@task:a'&&r==='live'});
  const dashboard=new h.AreaDashboard(root,state,{items:project,open(){},log(){},history(){}});
  assert.equal(root.all().find(el=>el.classes.has('auto-oc-area-node')).attrs['aria-label'],'Task a, task, Running');
  assert.ok(!root.all().some(el=>el.textContent==='Review the recorded result and execution controls before continuing.'));
  state.attentionOnly=true;assert.equal(h.dashboardVisibleItems(project(),state).length,0);
  owner=false;dashboard.update();assert.equal(h.dashboardVisibleItems(project(),state).length,1);
  assert.ok(root.all().some(el=>el.textContent==='Review the recorded result and execution controls before continuing.'));
  owner=true;tasks[0].pendingCodexApproval={requestId:'approval'};assert.equal(project()[0].attention,true);
  delete tasks[0].pendingCodexApproval;tasks[0].legacyExecution={stopState:'unconfirmed'};assert.equal(project()[0].attention,true);
  delete tasks[0].legacyExecution;tasks[0].runtimeExecution={...binding,runId:'previous'};assert.equal(project()[0].attention,true);
  tasks[0].runtimeExecution={...binding};tasks[0].status='failed';assert.equal(project()[0].attention,true);
  assert.ok(checks.every(([w])=>w==='@task:a'));assert.equal(binding.requiresReconciliation,true);
});

test('workflow and isolated Code use exact run ownership without changing historical results',()=>{
  const h=harness(),wf=flow('w',[code('s',{codeExecution:{status:'running',lastRun:'2026-11-01',runtimeExecution:{runId:'solo',phase:'in_flight',requiresReconciliation:true}}})],
    {status:'running',runtimeExecution:{runId:'full',phase:'in_flight',requiresReconciliation:true}});
  const before=JSON.stringify(wf),calls=[];
  let item=h.dashboardItems([], [wf],(w,r)=>{calls.push([w,r]);return w==='w'&&['solo','full'].includes(r)})[0];
  assert.equal(item.attention,false);assert.equal(item.children[0].attention,false);
  assert.deepEqual(calls,[['w','solo'],['w','full']]);assert.equal(JSON.stringify(wf),before);
  item=h.dashboardItems([], [wf],(w,r)=>r==='full')[0];assert.equal(item.attention,true);assert.equal(item.children[0].attention,true);
});

test('real Dashboard adapter forwards the installed host ownership check for a running task',()=>{
  const h=harness(),root=new h.Element(),seen=[];
  const plugin={settings:{tasks:[task('a',{status:'running',runtimeExecution:{workflowId:'@task:a',runId:'live',phase:'in_flight',requiresReconciliation:true}})],workflows:[]},
    ownsExecution:(w,r)=>{seen.push([w,r]);return true},isLifecycleStopped:()=>false};
  const view=new h.AutoOCView({},plugin);view.app={vault:{adapter:{basePath:''}}};view.renderDashboard(root);
  assert.deepEqual(seen,[['@task:a','live']]);
  assert.equal(root.all().find(el=>el.classes.has('auto-oc-area-node')).attrs['aria-label'],'Task a, task, Running');
});

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

test('Dashboard type buttons filter their areas, include Code tasks and preserve focus and choice across updates',()=>{
  const h=harness(),root=new h.Element(),state=h.createAreaDashboardState();
  const tasks=[task('a'),task('code',{taskKind:'code',area:'Operations'}),task('off',{disabled:true,area:''})];
  const workflows=[flow('parent',[{id:'nested',stepKind:'workflow',workflowId:'child'},code('inline')]),flow('child',[],{area:'Marketing'})];
  const before=JSON.stringify([tasks,workflows]);
  const dashboard=new h.AreaDashboard(root,state,{items:()=>h.dashboardItems(tasks,workflows),open(){},log(){},history(){}});
  const filter=kind=>root.all().find(el=>el.attrs['data-area-kind-filter']===kind);
  const nodes=()=>root.all().filter(el=>el.classes.has('auto-oc-area-node'));
  const areas=()=>root.all().filter(el=>el.classes.has('auto-oc-area-group')).map(el=>el.children[0].children[0].textContent);
  const ids=()=>nodes().map(el=>JSON.parse(el.attrs['data-area-item-key'])[1]).sort();
  assert.equal(filter('all').attrs['aria-pressed'],'true');
  assert.deepEqual(ids(),['a','child','code','parent']);
  assert.equal(filter('task').children[0].textContent,'3');
  filter('workflow').onclick();
  assert.deepEqual(ids(),['child','parent']);assert.deepEqual(areas(),['Engineering','Marketing']);
  root.all().find(el=>el.classes.has('auto-oc-area-step')).onclick();
  assert.equal(JSON.parse(state.selected)[0],'step');
  const tasksButton=filter('task');tasksButton.focus();tasksButton.onclick();
  assert.deepEqual(ids(),['a','code']);assert.deepEqual(areas(),['Engineering','Operations']);
  assert.equal(JSON.parse(state.selected)[0],'task');
  assert.equal(root.all().filter(el=>el.classes.has('auto-oc-area-step')).length,0);
  assert.equal(tasksButton.attrs['aria-pressed'],'true');assert.equal(filter('workflow').attrs['aria-pressed'],'false');
  assert.equal(h.doc.activeElement,tasksButton);assert.equal(JSON.stringify([tasks,workflows]),before);
  const operations=root.all().find(el=>el.classes.has('auto-oc-area-group')&&el.children[0].children[0].textContent==='Operations');
  operations.open=false;operations.ontoggle();
  filter('workflow').onclick();filter('task').onclick();
  assert.ok(state.collapsed.has('Operations'));assert.deepEqual(ids(),['a']);
  tasks[0].status='running';dashboard.update();
  assert.equal(filter('task'),tasksButton);assert.equal(h.doc.activeElement,tasksButton);
  assert.equal(state.kindFilter,'task');assert.deepEqual(areas(),['Engineering','Operations']);
  assert.deepEqual(ids(),['a']);
  filter('all').onclick();assert.deepEqual(ids(),['a','child','parent']);
  assert.equal(filter('all').attrs['aria-pressed'],'true');assert.equal(filter('task').attrs['aria-pressed'],'false');
  const reopened=new h.Element();
  state.kindFilter='workflow';
  new h.AreaDashboard(reopened,state,{items:()=>h.dashboardItems(tasks,workflows),open(){},log(){},history(){}});
  assert.equal(reopened.all().find(el=>el.attrs['data-area-kind-filter']==='workflow').attrs['aria-pressed'],'true');
  assert.equal(reopened.all().filter(el=>el.classes.has('auto-oc-area-node')).length,2);
});

test('Dashboard type filters combine with search, attention and disabled toggles and clear hidden details',()=>{
  const h=harness(),root=new h.Element(),state=h.createAreaDashboardState();
  const tasks=[task('code',{taskKind:'code',name:'Needle Code',status:'failed'}),task('off',{disabled:true,name:'Needle off',status:'failed'}),task('ready',{name:'Needle ready'})];
  const workflows=[flow('w',[code('needle')],{status:'failed'}),flow('off',[code('needle')],{disabled:true,status:'failed'})];
  new h.AreaDashboard(root,state,{items:()=>h.dashboardItems(tasks,workflows),open(){},log(){},history(){}});
  const filter=kind=>root.all().find(el=>el.attrs['data-area-kind-filter']===kind);
  const ids=()=>root.all().filter(el=>el.classes.has('auto-oc-area-node')).map(el=>JSON.parse(el.attrs['data-area-item-key'])[1]).sort();
  const toggle=(label,checked)=>{
    const wrapper=root.all().find(el=>el.tag==='label'&&el.children.some(child=>child.textContent===label));
    const input=wrapper.children.find(el=>el.tag==='input');input.checked=checked;input.onchange();
  };
  const search=root.all().find(el=>el.attrs['aria-label']==='Search Dashboard');
  search.value='NEEDLE';search.oninput();toggle('Needs attention',true);
  filter('workflow').onclick();assert.deepEqual(ids(),['w']);
  toggle('Show disabled',true);assert.deepEqual(ids(),['off','w']);
  filter('task').onclick();assert.deepEqual(ids(),['code','off']);
  assert.equal(search.value,'NEEDLE');assert.equal(state.attentionOnly,true);
  toggle('Show disabled',false);assert.deepEqual(ids(),['code']);
  search.value='missing';search.oninput();assert.deepEqual(ids(),[]);assert.equal(state.selected,undefined);
  assert.ok(!root.all().some(el=>el.classes.has('auto-oc-area-group')));
  const inspector=root.all().find(el=>el.classes.has('auto-oc-areas-inspector'));
  assert.ok(!inspector.all().some(el=>el.tag==='h3'||el.tag==='button'));
  assert.equal(filter('task').attrs['aria-pressed'],'true');assert.equal(filter('task').children[0].textContent,'3');
  search.value='';search.oninput();filter('all').onclick();assert.deepEqual(ids(),['code','w']);
});

test('area Dashboard renders bounded Code detail, keeps toolbar, selection, focus and collapse across events without writes',()=>{
  const h=harness(),root=new h.Element(),state=h.createAreaDashboardState(),tasks=[task('a')];
  const wf=flow('w',Array.from({length:120},(_,i)=>code(String(i))));
  let opened, logged, history;
  const dashboard=new h.AreaDashboard(root,state,{items:()=>h.dashboardItems(tasks,[wf]),open:i=>opened=i,log:i=>logged=i,history:i=>history=i});
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
  assert.ok(all().some(el=>el.classes.has('auto-oc-area-orb')&&el.style.width==='30px'));
});

test('Dashboard integration opens exact Code controls and clears stale list filters without running anything',()=>{
  const h=harness(),plugin={settings:{tasks:[task('a')],workflows:[flow('w',[code('s')])]},isLifecycleStopped:()=>false};
  const view=new h.AutoOCView({},plugin),root=new h.Element();let opened;
  view.app={vault:{adapter:{basePath:''}}};
  view.openWorkflowCodeEntry=(wf,step)=>opened=[wf,step];view.filterText='old';view.filterArea='missing';view.taskSource='catalog';
  view.renderDashboard(root);
  root.all().find(el=>el.classes.has('auto-oc-area-step')).onclick();
  root.all().find(el=>el.tag==='button'&&el.textContent==='Open controls').onclick();
  assert.deepEqual(opened,['w','s']);assert.equal(view.filterText,'');assert.equal(view.filterArea,'all');assert.equal(view.taskSource,'all');
  const previous=view.areaDashboard;view.refresh();assert.equal(view.areaDashboard,previous);
});

test('Overview enables global Import and requires a workspace selection before opening its CLI launcher',()=>{
  const h=harness(),root=new h.Element(),page={id:'p',name:'Feature',objective:'',directory:'/repo/p',kind:'folder',taskIds:[],workflowIds:[]};
  const plugin={settings:{tasks:[],workflows:[],workPages:[page],workingDirectory:'/repo'},isLifecycleStopped:()=>false};
  const view=new h.AutoOCView({},plugin);view.app={vault:{adapter:{basePath:'/vault'}}};view.containerEl=root;view.renderHeader=()=>{};view.renderDashboard=()=>{};
  view.currentTab='dashboard';view.selectedWorkPage='general';view.render();
  h.ImportModal.prototype.onOpen=function(){};h.CliLauncherModal.prototype.onOpen=function(){};
  const importButton=root.all().find(e=>e.textContent.endsWith('Import'));assert.equal(!!importButton.disabled,false);importButton.onclick();assert.ok(h.opened.at(-1) instanceof h.ImportModal);
  const cli=root.all().find(e=>e.textContent.endsWith('CLI'));assert.equal(!!cli.disabled,false);cli.onclick();
  const selector=h.opened.at(-1);assert.equal(h.opened.some(e=>e instanceof h.CliLauncherModal),false);
  const row=selector.contentEl.all().find(e=>e.classes.has('auto-oc-page-row')&&e.children.some(c=>c.textContent==='Feature'));
  row.all().find(e=>e.textContent==='Use workspace').onclick();
  const launcher=h.opened.at(-1);assert.ok(launcher instanceof h.CliLauncherModal);assert.equal(launcher.page.id,'p');assert.equal(launcher.page.directory,'/repo/p');
  assert.equal(view.selectedWorkPage,'general');assert.deepEqual(h.notices,[]);
});

test('Overview workspace selection reuses a live page terminal and Main retains its legacy launcher context',async()=>{
  const h=harness(),effects=[],page={id:'p',name:'Feature',objective:'',directory:'/repo/p',kind:'folder',taskIds:[],workflowIds:[]};
  const plugin={settings:{tasks:[],workflows:[],workPages:[page],workingDirectory:'/repo'},isLifecycleStopped:()=>false,hasPageTerminal:(id,live)=>id==='p'&&live,showPageTerminal:async id=>effects.push(id)};
  const view=new h.AutoOCView({},plugin);view.app={vault:{adapter:{basePath:'/vault'}}};view.currentTab='dashboard';view.selectedWorkPage='general';
  h.CliLauncherModal.prototype.onOpen=function(){};view.openCli();let selector=h.opened.at(-1);
  selector.contentEl.all().filter(e=>e.textContent==='Use workspace')[1].onclick();await Promise.resolve();
  assert.deepEqual(effects,['p']);assert.equal(h.opened.some(e=>e instanceof h.CliLauncherModal),false);
  view.openCli();selector=h.opened.at(-1);selector.contentEl.all().find(e=>e.textContent==='Use workspace').onclick();
  assert.ok(h.opened.at(-1) instanceof h.CliLauncherModal);assert.equal(h.opened.at(-1).page,undefined);assert.equal(view.selectedWorkPage,'general');
});
