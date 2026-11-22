const {test,afterEach}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const realPages={exports:{}};
new Function('require','module','exports',require('esbuild').buildSync({entryPoints:[path.join(__dirname,'../work-pages.ts')],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text)(require,realPages,realPages.exports);
const cleanups=[];
afterEach(()=>{for(const cleanup of cleanups.splice(0))cleanup();});
function harness(failPrepare=false) {
  class Element {
    constructor(options={}){this.children=[];this.text=options.text||'';this.style={};this.attrs={};this.classes=new Set((typeof options==='string'?options:options.cls||'').split(' '));}
    createEl(tag,options={}){const child=new Element(options);child.tag=tag;this.children.push(child);return child;}
    createDiv(options={}){return this.createEl('div',options);} empty(){this.children=[];} setText(v){this.text=v;this.children=[];} setAttr(k,v){this.attrs[k]=v;} addClass(c){this.classes.add(c);}
    all(){return [this,...this.children.flatMap(c=>c.all())];}
    querySelectorAll(selector){return this.all().filter(e=>selector.split(',').map(t=>t.trim()).some(t=>t.startsWith('.')?e.classes.has(t.slice(1)):t===e.tag));}
  }
  class Control {
    constructor(e){this.e=e;this.options=[];} setValue(v){this.e.value=v;return this;} setDisabled(v){this.e.disabled=v;return this;}
    setButtonText(v){this.e.text=v;return this;} setPlaceholder(){return this;}
    addOption(value,label){this.options.push({value,label});return this;} onChange(f){this.e.change=f;return this;} onClick(f){this.e.onclick=f;return this;}
  }
  class Setting {
    constructor(root){this.root=root.createDiv();}
    setName(v){this.root.name=v;return this;} setDesc(v){this.root.desc=v;return this;}
    add(type,fn){const e=this.root.createEl(type),c=new Control(e);e.control=c;fn(c);return this;}
    addToggle(fn){return this.add('toggle',fn);} addText(fn){return this.add('input',fn);} addTextArea(fn){return this.add('textarea',fn);}
    addDropdown(fn){return this.add('select',fn);} addButton(fn){return this.add('button',fn);}
  }
  const opened=[],effects=[],notices=[],module={exports:{}};
  cleanups.push(()=>opened.forEach(modal=>modal.close()));
  class Modal {
    constructor(app){this.app=app;this.modalEl=new Element();this.contentEl=new Element();}
    open(){opened.push(this);this.onOpen?.();} close(){this.onClose?.();}
  }
  const helper={
    pageDeletionBlockers:realPages.exports.pageDeletionBlockers,
    assertPageDirectoryAvailable(){},
    registerWorkPage:async(settings,page,save)=>{settings.workPages=[...(settings.workPages||[]),page];await save();},
    readWorkspaceGitState:async()=>({kind:'branch',branch:'feat/current'}),
    inspectWorktreePreparation:async()=>{effects.push('inspect');return {directory:'/repo/.autooc/worktrees',ignoreFile:'/repo/.gitignore',preferenceKey:'repo-key',excluded:false};},
    prepareWorktreeIgnore:async prep=>{effects.push('prepare');if(failPrepare)throw Error('write failed');return prep;},
    createPageWorktree:async()=>{effects.push('create');return {kind:'worktree',directory:'/repo/.autooc/worktrees/id',repository:'/repo',branch:'feat/test'};},
    describePageFolder:async dir=>({directory:dir,kind:'folder'}),
    selectWorkPage:(settings,id)=>settings.workPages.find(p=>p.id===id)
  };
  const source=fs.readFileSync(path.join(__dirname,'../work-pages-ui.ts'),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(js+'\nmodule.exports.testing={NewPageModal,PreparationModal};',{
    module,exports:module.exports,require:id=>id==='obsidian'?{Modal,Setting,Notice:class{constructor(s){notices.push(s);}}}:id==='./work-pages'?helper:id==='./merge-review'?{mergeEditorUri:dir=>'vscode://file/'+dir}:id==='electron'?{clipboard:{writeText:text=>effects.push(text)},shell:{openExternal:async uri=>effects.push(uri)}}:require(id),console,process,setTimeout,clearTimeout
  });
  const host={settings:{tasks:[],workflows:[],workingDirectory:'/repo'},saveSettings:async()=>effects.push('save'),
    isLifecycleStopped:()=>false,assertPagesEditable(){},reservePagePreparation(){effects.push('reserve');return()=>effects.push('release');},
    redactSecrets:s=>s,ownsExecution:()=>false};
  const app={vault:{adapter:{basePath:'/repo'}}},root=new Element();
  function field(modal,name,tag){return modal.contentEl.all().find(e=>e.name===name).all().find(e=>e.tag===tag);}
  function button(modal,text){const b=modal.contentEl.all().find(e=>e.tag==='button'&&e.text===text);assert.ok(b,text);return b;}
  function create(){const modal=new module.exports.testing.NewPageModal(app,host,id=>effects.push('select'));modal.open();return modal;}
  return {api:module.exports,host,app,root,effects,opened,notices,field,button,create,helper};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('CLI workspace selector requires a choice, excludes unavailable pages and never saves configuration',()=>{
  const h=harness(),selected=[],page={id:'p',name:'Feature',directory:'/repo/p',kind:'worktree',branch:'feat/p'};
  h.host.settings.workPages=[page,{...page,id:'a',name:'Archived',archived:true},{...page,id:'r',name:'Removed',worktreeRemoval:{status:'removed'}}];
  const before=JSON.stringify(h.host.settings);h.api.openCliWorkspaceSelector(h.app,h.host,p=>selected.push(p));const modal=h.opened.at(-1);
  assert.deepEqual(selected,[]);assert.equal(modal.contentEl.all().filter(e=>e.text==='Use workspace').length,2);
  assert.equal(modal.contentEl.all().some(e=>e.text==='Archived'||e.text==='Removed'),false);
  const choose=modal.contentEl.all().filter(e=>e.text==='Use workspace')[1];choose.onclick();choose.onclick();
  assert.equal(selected.length,1);assert.equal(selected[0].directory,'/repo/p');assert.equal(selected[0].id,'p');assert.equal(JSON.stringify(h.host.settings),before);assert.deepEqual(h.effects,[]);
  h.api.openCliWorkspaceSelector(h.app,h.host,p=>selected.push(p));const cancelled=h.opened.at(-1),stale=cancelled.contentEl.all().find(e=>e.text==='Use workspace');h.button(cancelled,'Cancel').onclick();stale.onclick();assert.equal(selected.length,1);
});

test('CLI workspace selector rejects changed, archived or deleted pages and a changed Main folder',()=>{
  for(const change of [h=>h.host.settings.workPages[0].directory='/other',h=>h.host.settings.workPages[0].archived=true,h=>h.host.settings.workPages=[],h=>h.host.settings.workPages[0].worktreeRemoval={status:'pending'}]){
    const h=harness(),selected=[];h.host.settings.workPages=[{id:'p',name:'Feature',directory:'/repo/p',kind:'folder'}];
    h.api.openCliWorkspaceSelector(h.app,h.host,p=>selected.push(p));const modal=h.opened.at(-1),button=modal.contentEl.all().filter(e=>e.text==='Use workspace')[1];
    change(h);button.onclick();assert.deepEqual(selected,[]);assert.ok(modal.contentEl.all().some(e=>/workspace changed or is unavailable/.test(e.text)));
  }
  const h=harness(),selected=[];h.api.openCliWorkspaceSelector(h.app,h.host,p=>selected.push(p));const modal=h.opened.at(-1);h.host.settings.workingDirectory='/different';h.button(modal,'Use workspace').onclick();
  assert.deepEqual(selected,[]);assert.ok(modal.contentEl.all().some(e=>/Main workspace folder changed/.test(e.text)));
  h.host.isLifecycleStopped=()=>true;h.api.openCliWorkspaceSelector(h.app,h.host,p=>selected.push(p));assert.equal(h.opened.length,1);
});

function mergeHarness(state='conflicts',inProgress=false) {
  const h=harness(),page={id:'p',name:'Feature',directory:'/repo/p',kind:'worktree',branch:'feat/p',taskIds:[],workflowIds:[]};
  h.host.settings.workPages=[page];
  const source={directory:page.directory,branch:page.branch,head:'a'.repeat(40)},target={directory:'/repo',branch:'main',head:'b'.repeat(40)};
  let review={source,target,targets:[target],state,inProgress,conflicts:state==='conflicts'?['file.ts']:[],blockers:[],completionBlockers:[],details:'Review details',hash:'one'};
  h.host.reviewPageMerge=async()=>review;
  h.host.executePageMerge=async(id,directory,hash,action,confirmed)=>{
    if(hash!==review.hash||review.blockers.length)throw Error('Workspace or activity changed');
    h.effects.push({id,directory,hash,action,confirmed});return {review,output:'Git output'};
  };
  h.api.renderWorkPages(h.root,h.app,h.host,'p',()=>{},()=>{});
  return {...h,setReview(value){review={...review,...value};},async open(){await h.root.all().find(e=>e.text==='Merge review').onclick();await tick();return h.opened.at(-1);}};
}
test('Merge review executes Start merge for the displayed target and refreshes the outcome',async()=>{
  const h=mergeHarness(),modal=await h.open();
  assert.ok(modal.contentEl.all().some(e=>e.text==='Predicted conflict files (1)'));
  assert.equal(modal.contentEl.all().some(e=>e.text==='Complete merge'),false);
  assert.equal(modal.contentEl.all().some(e=>e.text==='Archive page'),false);
  await h.button(modal,'Start merge').onclick();assert.deepEqual(h.effects,[{id:'p',directory:'/repo',hash:'one',action:'start',confirmed:false}]);
  assert.ok(modal.contentEl.all().some(e=>/Git output/.test(e.text)));
  await h.button(modal,'Open target in VS Code').onclick();assert.ok(h.effects.some(e=>e==='vscode://file//repo'));
  assert.ok(modal.modalEl.classes.has('auto-oc-work-page-dialog'));
});
test('blocked merge polling keeps the review mounted while Git runs and unchanged results preserve scroll and controls',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const h=mergeHarness('blocked');h.setReview({blockers:['Main session active']});
  const modal=await h.open(),body=modal.contentEl.all().find(e=>e.classes.has('auto-oc-finish-body'));
  const target=h.field(modal,'Target branch','select');body.scrollTop=630;
  const current=await h.host.reviewPageMerge();let resolve,reviews=0;
  h.host.reviewPageMerge=()=>{reviews++;return new Promise(r=>{resolve=r;});};
  t.mock.timers.tick(5000);
  assert.ok(modal.contentEl.all().includes(body),'The existing review must remain visible during a slow Git check');
  assert.equal(body.scrollTop,630);assert.equal(!!target.disabled,false,'Automatic reads must not toggle controls');
  t.mock.timers.tick(5000);assert.equal(reviews,1,'No overlapping Git reads');
  resolve(JSON.parse(JSON.stringify(current)));await tick();
  assert.ok(modal.contentEl.all().includes(body));assert.equal(body.scrollTop,630);
  assert.equal(h.field(modal,'Target branch','select'),target);assert.equal(!!target.disabled,false);
  t.mock.timers.tick(5000);resolve({...current,state:'ready',blockers:[],hash:'new'});await tick();
  const updated=modal.contentEl.all().find(e=>e.classes.has('auto-oc-finish-body'));
  assert.notEqual(updated,body);assert.equal(updated.scrollTop,630);
  assert.equal(h.button(modal,'Start merge').disabled,undefined);assert.deepEqual(h.effects,[]);
  t.mock.timers.tick(10000);assert.equal(reviews,2,'Actionable reviews are not polled');
});
test('unchanged automatic merge reviews preserve abort consent but changed sessions invalidate it',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const h=mergeHarness('resolved',true);let notify,state='tracked';
  h.host.subscribePageReview=fn=>{notify=fn;return()=>{notify=undefined;};};
  h.host.pageBlockingSessions=()=>[{id:'session',pageId:'main',pageName:'Main',label:'CLI',directory:'/repo',state}];
  const modal=await h.open();h.field(modal,'I accept discarding conflict-resolution edits when aborting','toggle').change(true);
  const abort=h.button(modal,'Abort merge');notify();t.mock.timers.tick(150);await tick();
  assert.equal(h.button(modal,'Abort merge'),abort);assert.equal(abort.disabled,false);
  state='exited';notify();t.mock.timers.tick(150);await tick();
  assert.notEqual(h.button(modal,'Abort merge'),abort);assert.equal(h.button(modal,'Abort merge').disabled,true);
  assert.deepEqual(h.effects,[]);modal.close();assert.equal(notify,undefined);
});
test('a merge action remains usable during background review and its result supersedes the late read',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const h=mergeHarness('ready');let notify,resolveRead,resolveAction;
  h.host.subscribePageReview=fn=>{notify=fn;return()=>{};};
  const modal=await h.open(),previous=await h.host.reviewPageMerge(),start=h.button(modal,'Start merge');
  h.host.reviewPageMerge=()=>new Promise(r=>{resolveRead=r;});
  h.host.executePageMerge=async()=>{h.effects.push('start');await new Promise(r=>{resolveAction=r;});return {review:{...previous,state:'resolved',inProgress:true,hash:'after-start'},output:''};};
  notify();t.mock.timers.tick(150);await tick();
  assert.equal(!!start.disabled,false);
  const pending=start.onclick();await start.onclick();assert.deepEqual(h.effects,['start']);
  resolveRead(previous);await tick();assert.equal(start.disabled,true,'The stale read must not unlock a mutation');
  resolveAction();await pending;
  assert.ok(h.button(modal,'Complete merge'));assert.equal(modal.contentEl.all().some(e=>e.text==='Start merge'),false);
});
test('failed merge refresh keeps the last review visible with stale actions disabled until a successful retry',async()=>{
  const h=mergeHarness('ready'),modal=await h.open();
  const body=modal.contentEl.all().find(e=>e.classes.has('auto-oc-finish-body')),start=h.button(modal,'Start merge');
  const read=h.host.reviewPageMerge;let fail;
  h.host.reviewPageMerge=()=>new Promise((_,reject)=>{fail=reject;});
  const pending=h.button(modal,'Recheck conflicts').onclick();
  assert.ok(modal.contentEl.all().includes(body));assert.equal(start.disabled,true);
  await start.onclick();assert.deepEqual(h.effects,[]);
  fail(Error('Git is unavailable'));await pending;
  assert.ok(modal.contentEl.all().includes(body));assert.equal(start.disabled,true);
  assert.ok(modal.contentEl.all().some(e=>e.text.includes('Git is unavailable')));
  h.host.reviewPageMerge=read;await h.button(modal,'Retry review').onclick();
  assert.equal(!!h.button(modal,'Start merge').disabled,false);
  assert.equal(modal.contentEl.all().some(e=>e.text.includes('Git is unavailable')),false);assert.deepEqual(h.effects,[]);
});
test('closing a merge review during a background Git read cannot reopen or repopulate it',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const h=mergeHarness('blocked');h.setReview({blockers:['Pending files']});
  const modal=await h.open(),review=await h.host.reviewPageMerge();let resolve,reviews=0;
  h.host.reviewPageMerge=()=>{reviews++;return new Promise(r=>{resolve=r;});};
  t.mock.timers.tick(5000);modal.close();resolve(review);await tick();
  t.mock.timers.tick(10000);assert.equal(reviews,1);assert.equal(modal.contentEl.children.length,0);assert.equal(h.opened.length,1);
});
test('Merge review gates completion on actual resolved state, preserves a merge on close and refreshes stale actions',async()=>{
  const h=mergeHarness('conflicts',true),modal=await h.open();
  assert.ok(modal.contentEl.all().some(e=>e.text==='Unresolved files (1)'));
  assert.equal(modal.contentEl.all().some(e=>e.text==='Complete merge'),false);
  h.setReview({state:'resolved',conflicts:[],hash:'two'});await h.button(modal,'Recheck conflicts').onclick();
  await h.button(modal,'Complete merge').onclick();assert.equal(h.effects[0].action,'complete');
  h.field(modal,'I accept discarding conflict-resolution edits when aborting','toggle').change(true);
  h.setReview({state:'blocked',blockers:['Session active'],hash:'three'});await h.button(modal,'Abort merge').onclick();
  assert.equal(h.effects.length,1);assert.ok(h.notices.some(s=>/Workspace or activity changed/.test(s)));
  assert.equal(modal.contentEl.all().some(e=>e.text==='Abort merge'),false);
  h.button(modal,'Close').onclick();assert.equal(h.effects.length,1);
});

test('merge actions prevent double submission and abort requires confirmation after every review',async()=>{
  const h=mergeHarness('resolved',true),modal=await h.open();
  const abort=h.button(modal,'Abort merge');await abort.onclick();assert.equal(h.effects.length,0);
  h.field(modal,'I accept discarding conflict-resolution edits when aborting','toggle').change(true);
  let release;h.host.executePageMerge=async(...args)=>{h.effects.push(args);await new Promise(r=>{release=r;});return {review:await h.host.reviewPageMerge(),output:''};};
  const first=abort.onclick();await abort.onclick();assert.equal(h.effects.length,1);assert.equal(h.effects[0][4],true);
  h.button(modal,'Close').onclick();assert.ok(modal.contentEl.children.length);
  release();await first;assert.equal(h.button(modal,'Abort merge').disabled,true);
  h.setReview({completionBlockers:['Stage changes']});await h.button(modal,'Recheck conflicts').onclick();
  assert.equal(h.button(modal,'Complete merge').disabled,true);
});
test('Merge review opens independent archiving even while Git actions have blockers',async()=>{
  const h=mergeHarness('integrated');h.setReview({integration:'verified',blockers:['Main session running']});
  h.host.reviewPageFinish=async()=>({hash:'close',changes:'',archiveBlockers:[],removalBlockers:[],files:[]});
  const modal=await h.open();assert.ok(modal.contentEl.all().some(e=>e.text==='Already integrated'));
  assert.equal(modal.contentEl.all().some(e=>e.text==='Start merge'),false);
  await h.button(modal,'Review archiving').onclick();await tick();
  assert.equal(h.opened.length,2);assert.equal(h.button(h.opened.at(-1),'Archive page').disabled,false);
  assert.deepEqual(h.effects,[]);
});
test('ordinary folders and removed worktrees do not expose Merge review',()=>{
  const h=mergeHarness();h.host.settings.workPages[0].kind='folder';h.root.empty();h.api.renderWorkPages(h.root,h.app,h.host,'p',()=>{},()=>{});
  assert.equal(h.root.all().some(e=>e.text==='Merge review'),false);
  h.host.settings.workPages[0].kind='worktree';h.host.settings.workPages[0].worktreeRemoval={status:'removed'};h.root.empty();h.api.renderWorkPages(h.root,h.app,h.host,'p',()=>{},()=>{});
  assert.equal(h.root.all().some(e=>e.text==='Merge review'),false);
});

test('Discard work requires the exact branch name and explicit loss confirmation and is absent for ordinary folders',async()=>{
  const h=harness(),selected=[];
  const page={id:'p',name:'Feature',directory:'/repo/p',kind:'worktree',branch:'feat/p',taskIds:[],workflowIds:[]};h.host.settings.workPages=[page];
  h.host.reviewPageDiscard=async()=>({hash:'review',blockers:[],stage:'worktree',changes:'+new',commits:'abcd Feature',fileCount:3,commitCount:1});
  h.host.discardWorkPage=async(...args)=>h.effects.push(args);
  h.api.renderWorkPages(h.root,h.app,h.host,'p',id=>selected.push(id),()=>{});
  await h.root.all().find(e=>e.text==='Discard work').onclick();await tick();const modal=h.opened.at(-1);
  const accept=h.button(modal,'Discard worktree and branch');assert.equal(accept.disabled,true);
  h.field(modal,'Type the branch name to discard','input').change('wrong');
  h.field(modal,'I accept losing these files and the local branch, and have closed sessions, services and Git processes using this worktree','toggle').change(true);
  assert.equal(accept.disabled,true);await accept.onclick();assert.deepEqual(h.effects,[]);
  h.field(modal,'Type the branch name to discard','input').change('feat/p');assert.equal(accept.disabled,false);
  await accept.onclick();assert.deepEqual(h.effects,[['p','review','feat/p',true]]);assert.deepEqual(selected,['main']);
  assert.ok(h.notices.some(s=>/local branch discarded/.test(s)));
  h.root.empty();page.kind='folder';h.api.renderWorkPages(h.root,h.app,h.host,'p',()=>{},()=>{});
  assert.equal(h.root.all().some(e=>e.text==='Discard work'),false);
});

test('discard blockers cannot be bypassed; their resolution refreshes the open branch review',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});let blocked=true,notify;
  const h=harness();h.host.settings.workPages=[{id:'p',name:'Feature',directory:'/repo/p',kind:'worktree',branch:'feat/p',taskIds:[],workflowIds:[],archived:true,worktreeRemoval:{mode:'discard',status:'pending'}}];
  h.host.subscribePageReview=fn=>{notify=fn;return()=>{notify=undefined;};};
  h.host.reviewPageDiscard=async()=>({hash:'review',blockers:blocked?['Another worktree uses this branch.']:[],stage:'branch-only',changes:'',commits:'',fileCount:0,commitCount:0});
  h.api.renderWorkPages(h.root,h.app,h.host,'p',()=>{},()=>{});
  assert.ok(h.root.all().some(e=>e.text==='Check discard'));assert.equal(h.root.all().some(e=>e.text==='Check removal'),false);
  await h.root.all().find(e=>e.text==='Discard work').onclick();await tick();const modal=h.opened.at(-1);
  h.field(modal,'Type the branch name to discard','input').change('feat/p');
  h.field(modal,'I accept losing these files and the local branch, and have closed sessions, services and Git processes using this worktree','toggle').change(true);
  assert.equal(h.button(modal,'Discard remaining branch').disabled,true);
  blocked=false;notify();t.mock.timers.tick(150);await tick();assert.equal(h.opened.length,1);
  assert.equal(h.button(modal,'Discard remaining branch').disabled,true,'The new review still requires explicit confirmation');
  h.field(modal,'Type the branch name to discard','input').change('feat/p');
  h.field(modal,'I accept losing these files and the local branch, and have closed sessions, services and Git processes using this worktree','toggle').change(true);
  assert.equal(h.button(modal,'Discard remaining branch').disabled,false);
  h.button(modal,'Cancel').onclick();assert.deepEqual(h.effects,[]);
  h.root.empty();h.host.settings.workPages[0].worktreeRemoval.status='removed';h.api.renderWorkPages(h.root,h.app,h.host,'p',()=>{},()=>{});
  assert.ok(h.root.all().some(e=>e.text==='Worktree and local branch discarded. Page history kept.'));
  assert.equal(h.root.all().some(e=>['Discard work','Restore page'].includes(e.text)),false);
});

test('existing-folder close has a visible confirmation outside the diff and preserves files by default',async()=>{
  const h=harness();h.host.settings.workPages=[{id:'p',name:'Shared folder',directory:'/repo',kind:'folder',taskIds:[],workflowIds:[]}];
  h.host.reviewPageFinish=async()=>({hash:'h',changes:'diff --git a/a b/a\n@@ -1 +1 @@\n-old\n+new',archiveBlockers:[],removalBlockers:['Main folder cannot be removed']});
  h.host.finishWorkPage=async(...args)=>h.effects.push(args);
  h.api.renderWorkPages(h.root,h.app,h.host,'p',()=>{},()=>{});
  await h.root.all().find(e=>e.text==='Archive page').onclick();await tick();const modal=h.opened.at(-1);
  const footer=modal.contentEl.all().find(e=>e.classes.has('auto-oc-finish-footer'));
  assert.ok(footer.all().some(e=>e.text==='Archive page'));assert.equal(h.button(modal,'Archive page').disabled,false);
  assert.equal(footer.all().some(e=>e.classes.has('auto-oc-page-diff')),false);
  assert.ok(modal.contentEl.all().some(e=>/existing folder/.test(e.text)));
  assert.ok(modal.contentEl.all().some(e=>e.text==='Discard work is unavailable for this page.'));
  assert.ok(modal.contentEl.all().some(e=>/even if you have not made any changes/.test(e.text)));
  assert.ok(modal.contentEl.all().some(e=>/Settings.*Execution.*Git worktrees/.test(e.text)));
  assert.equal(modal.contentEl.all().some(e=>e.tag==='button'&&/Discard/.test(e.text)),false);
  assert.equal(modal.contentEl.all().some(e=>e.name==='Remove worktree folder'),false);
  await h.button(modal,'Archive page').onclick();assert.deepEqual(h.effects,[['p','h',false,false]]);
  assert.ok(h.notices.some(s=>/All files kept/.test(s)));
});

test('finish and discard keep long workspace identity outside the scrolling review and footer',async()=>{
  for(const discard of [false,true]){
    const h=harness(),directory='/repo/'+('long-directory-name/').repeat(12);
    h.host.settings.workPages=[{id:'p',name:'Long workspace label '.repeat(8),directory,kind:'worktree',branch:'feat/long',taskIds:[],workflowIds:[]}];
    h.host.reviewPageFinish=async()=>({hash:'h',changes:'+line\n'.repeat(1600),archiveBlockers:[],removalBlockers:[]});
    h.host.reviewPageDiscard=async()=>({hash:'h',blockers:[],stage:'worktree',changes:'+line\n'.repeat(1600),commits:'',fileCount:1,commitCount:0});
    h.api.renderWorkPages(h.root,h.app,h.host,'p',()=>{},()=>{});
    await h.root.all().find(e=>e.text===(discard?'Discard work':'Archive page')).onclick();await tick();const modal=h.opened.at(-1);
    const header=modal.contentEl.all().find(e=>e.classes.has('auto-oc-finish-header'));
    const body=modal.contentEl.all().find(e=>e.classes.has('auto-oc-finish-body'));
    assert.ok(modal.modalEl.classes.has('auto-oc-work-page-dialog'));
    assert.ok(header.all().some(e=>e.text===directory));assert.equal(body.all().some(e=>e.text===directory),false);
    assert.ok(header.all().some(e=>e.text.startsWith(h.host.settings.workPages[0].name)));
    assert.equal(header.all().some(e=>e.classes.has('auto-oc-page-diff')),false);
  }
});

test('Delete page is confirmed from Overview and only removes the archived page configuration',async()=>{
  const h=harness(),selected=[];
  const page={id:'p',name:'Old attempt',directory:'/repo',kind:'folder',archived:true,taskIds:[],workflowIds:[]};
  h.host.settings.workPages=[page,{...page,id:'active',archived:false}];
  h.host.deleteWorkPage=async expected=>{h.effects.push(expected.id);h.host.settings.workPages=h.host.settings.workPages.filter(p=>p.id!==expected.id);};
  h.api.renderWorkPages(h.root,h.app,h.host,'general',id=>selected.push(id),()=>{});
  const remove=h.root.all().filter(e=>e.tag==='button'&&e.text==='Delete page');assert.equal(remove.length,1);
  remove[0].onclick();let modal=h.opened.at(-1);assert.ok(modal.contentEl.all().some(e=>/files, Git branches, tasks and workflows will stay unchanged/.test(e.text)));
  h.button(modal,'Cancel').onclick();assert.deepEqual(h.effects,[]);
  remove[0].onclick();modal=h.opened.at(-1);await h.button(modal,'Delete page').onclick();
  assert.deepEqual(h.effects,['p']);assert.deepEqual(selected,['general']);assert.equal(h.host.settings.workPages.length,1);
  h.root.empty();h.api.renderWorkPages(h.root,h.app,h.host,'general',()=>{},()=>{});
  assert.equal(h.root.all().some(e=>e.text==='Old attempt (archived)'),false);
});

test('Delete page permits completed history and removal, blocks pending evidence and reports failed saves',async()=>{
  const h=harness(),page={id:'p',name:'Old attempt',directory:'/repo',kind:'folder',archived:true,taskIds:[],workflowIds:[]};
  h.host.settings.workPages=[page];h.host.deleteWorkPage=async()=>{throw Error('save failed');};
  h.api.renderWorkPages(h.root,h.app,h.host,'general',()=>h.effects.push('navigate'),()=>{});
  const open=()=>{h.root.all().find(e=>e.tag==='button'&&e.text==='Delete page').onclick();return h.opened.at(-1);};
  h.host.settings.pageRuns=[{pageId:'p'}];let modal=open();assert.equal(h.button(modal,'Delete page').disabled,true);
  h.host.settings.pageRuns=[{pageId:'p',phase:'completed',uncertain:true}];modal=open();assert.equal(h.button(modal,'Delete page').disabled,true);
  h.host.settings.pageRuns=[{pageId:'p',phase:'completed',uncertain:false}];page.worktreeRemoval={status:'removed'};modal=open();assert.equal(h.button(modal,'Delete page').disabled,false);
  h.host.settings.pageRuns=[];page.worktreeRemoval={status:'pending'};modal=open();assert.equal(h.button(modal,'Delete page').disabled,true);
  delete page.worktreeRemoval;modal=open();await h.button(modal,'Delete page').onclick();
  assert.ok(modal.contentEl.all().some(e=>/save failed/.test(e.text)));assert.deepEqual(h.effects,[]);assert.deepEqual(h.notices,[]);
});

test('deleted page history keeps logs available without workspace or execution controls',async()=>{
  const h=harness();h.host.settings.workPages=[];
  h.host.settings.deletedWorkPages=[{page:{id:'p',name:'Removed feature',directory:'/repo/removed',archived:true,worktreeRemoval:{status:'removed'}},deletedAt:'2026-11-22T12:00:00.000Z'}];
  h.host.settings.pageRuns=[{pageId:'p',runId:'done',workflowId:'w',name:'Completed task',phase:'completed',uncertain:false}];
  h.host.pageRunOutput=()=> 'retained output';
  h.api.renderWorkPages(h.root,h.app,h.host,'general',()=>{},()=>{});
  assert.equal(h.root.all().some(e=>e.text.includes('Completed task')),false);
  await h.root.all().find(e=>e.tag==='button'&&e.text==='Deleted page history').onclick();
  const modal=h.opened.at(-1);
  assert.ok(modal.contentEl.all().some(e=>e.text.includes('Removed feature')));
  assert.equal(modal.contentEl.all().some(e=>e.tag==='button'&&['Open page','Continue','Reconcile','Stop','Delete page'].includes(e.text)),false);
  await h.button(modal,'Log').onclick();assert.ok(h.opened.at(-1).contentEl.all().some(e=>e.text==='retained output'));
});

test('blocked close explains the reason next to confirmation and can refresh after sessions end',async()=>{
  const h=harness();let blocked=true;
  h.host.settings.workPages=[{id:'p',name:'Feature',directory:'/repo/p',kind:'worktree',branch:'feat/p',taskIds:[],workflowIds:[]}];
  h.host.reviewPageFinish=async()=>({hash:'h',changes:'',archiveBlockers:blocked?['Close active terminals.']:[],removalBlockers:['Ignored files present.']});
  h.api.renderWorkPages(h.root,h.app,h.host,'p',()=>{},()=>{});
  await h.root.all().find(e=>e.text==='Archive page').onclick();await tick();let modal=h.opened.at(-1);
  assert.equal(h.button(modal,'Archive page').disabled,true);
  assert.ok(modal.contentEl.all().some(e=>/Cannot continue yet: Close active terminals/.test(e.text)));
  blocked=false;await h.button(modal,'Refresh review').onclick();
  assert.equal(h.button(modal,'Archive page').disabled,false);
  assert.equal(modal.contentEl.all().some(e=>e.name==='Remove worktree folder'),false);
});

test('a failed close inspection provides retry and cancel without a dead-end modal',async()=>{
  const h=harness();h.host.settings.workPages=[{id:'p',name:'Feature',directory:'/repo',kind:'folder',taskIds:[],workflowIds:[]}];
  h.host.reviewPageFinish=async()=>{throw Error('read failure');};
  h.api.renderWorkPages(h.root,h.app,h.host,'p',()=>{},()=>{});
  await h.root.all().find(e=>e.text==='Archive page').onclick();await tick();const modal=h.opened.at(-1);
  assert.ok(h.button(modal,'Retry review'));assert.ok(h.button(modal,'Cancel'));
  assert.equal(modal.contentEl.all().some(e=>e.tag==='button'&&e.text==='Archive page'),false);
});

test('pending files are grouped as local configuration or project files without interpreting markup',()=>{
  const h=harness();h.api.renderPendingFiles(h.root,h.host,[
    {path:'.obsidian/plugins/auto-oc/data.json',indexStatus:' ',worktreeStatus:'M',category:'local-configuration'},
    {path:'<img>.ts',originalPath:'old.ts',indexStatus:'R',worktreeStatus:' ',category:'project'}],'Pending');
  assert.ok(h.root.all().some(e=>e.text==='Local configuration (1)'));assert.ok(h.root.all().some(e=>e.text==='Product / other project files (1)'));
  assert.ok(h.root.all().some(e=>e.text==='old.ts → <img>.ts'));assert.equal(h.root.all().some(e=>e.tag==='img'),false);
});

test('archive dialog automatically refreshes after session changes and unsubscribes when closed',async()=>{
  const h=harness(),listeners=new Set();let blocked=true;
  h.host.settings.workPages=[{id:'p',name:'Page',directory:'/repo/p',kind:'folder'}];
  h.host.subscribePageReview=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
  h.host.reviewPageFinish=async()=>({hash:'h',changes:'',files:[],archiveBlockers:blocked?['Terminal active']:[],removalBlockers:[]});
  h.api.renderWorkPages(h.root,h.app,h.host,'p',()=>{},()=>{});await h.root.all().find(e=>e.text==='Archive page').onclick();await tick();
  const modal=h.opened.at(-1);assert.equal(h.button(modal,'Archive page').disabled,true);
  blocked=false;for(const fn of listeners)fn();await new Promise(r=>setTimeout(r,220));
  assert.equal(h.opened.length,1);assert.equal(h.button(modal,'Archive page').disabled,false);
  modal.close();assert.equal(listeners.size,0);
});

test('worktree removal is a separate action on an archived page, with its own confirmation',async()=>{
  const h=harness();h.host.settings.workPages=[{id:'p',name:'Archived',directory:'/repo/p',kind:'worktree',archived:true}];
  h.host.reviewPageFinish=async()=>({hash:'remove',changes:'',files:[],archiveBlockers:[],removalBlockers:[]});
  h.host.finishWorkPage=async(...args)=>h.effects.push(args);
  h.api.renderWorkPages(h.root,h.app,h.host,'p',()=>{},()=>{});
  assert.equal(h.root.all().some(e=>e.text==='Archive page'),false);
  await h.root.all().find(e=>e.text==='Remove worktree').onclick();await tick();const modal=h.opened.at(-1);
  assert.equal(h.button(modal,'Remove worktree folder').disabled,true);
  h.field(modal,'I closed external sessions and services using this worktree','toggle').change(true);
  await h.button(modal,'Remove worktree folder').onclick();assert.deepEqual(h.effects,[['p','remove',true,true]]);
});

test('blocked removal rechecks external Git changes without reopening and stops polling once ready',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const h=harness();let dirty=true,reviews=0;
  h.host.settings.workPages=[{id:'p',name:'Archived',directory:'/repo/p',kind:'worktree',archived:true}];
  h.host.reviewPageFinish=async()=>{reviews++;return {hash:'r'+reviews,changes:'',files:[],archiveBlockers:[],removalBlockers:dirty?['Pending files']:[]};};
  h.api.renderWorkPages(h.root,h.app,h.host,'p',()=>{},()=>{});
  await h.root.all().find(e=>e.text==='Remove worktree').onclick();await tick();const modal=h.opened.at(-1);
  assert.equal(h.button(modal,'Remove worktree folder').disabled,true);
  dirty=false;t.mock.timers.tick(5000);t.mock.timers.tick(150);await tick();
  assert.equal(reviews,2);assert.equal(h.opened.length,1);
  h.field(modal,'I closed external sessions and services using this worktree','toggle').change(true);
  assert.equal(h.button(modal,'Remove worktree folder').disabled,false);
  t.mock.timers.tick(10000);await tick();assert.equal(reviews,2);
  assert.equal(h.button(modal,'Remove worktree folder').disabled,false);assert.deepEqual(h.effects,[]);
  modal.close();t.mock.timers.tick(10000);await tick();assert.equal(reviews,2);
});

test('session refresh waits for an in-flight archive and never repeats the mutation',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const h=harness();let notify,finish,reviews=0,writes=0;
  h.host.settings.workPages=[{id:'p',name:'Page',directory:'/repo/p',kind:'folder'}];
  h.host.subscribePageReview=fn=>{notify=fn;return()=>{notify=undefined;};};
  h.host.reviewPageFinish=async()=>{reviews++;return {hash:'h',changes:'',files:[],archiveBlockers:[],removalBlockers:[]};};
  h.host.finishWorkPage=()=>{writes++;return new Promise(resolve=>{finish=resolve;});};
  h.api.renderWorkPages(h.root,h.app,h.host,'p',()=>{},()=>{});
  await h.root.all().find(e=>e.text==='Archive page').onclick();await tick();const modal=h.opened.at(-1);
  const saving=h.button(modal,'Archive page').onclick();notify();t.mock.timers.tick(6000);await tick();
  assert.equal(reviews,1);assert.equal(writes,1);assert.equal(h.button(modal,'Archive page').disabled,true);
  finish();await saving;t.mock.timers.tick(10000);await tick();
  assert.equal(reviews,1);assert.equal(writes,1);assert.equal(notify,undefined);assert.equal(modal.contentEl.children.length,0);
});

test('close dialog shows only relevant sessions and closes the selected native session through its confirmation',async()=>{
  const h=harness();h.host.settings.workPages=[{id:'p',name:'Page',directory:'/repo/p',kind:'folder'}];
  h.host.reviewPageFinish=async()=>({hash:'h',changes:'',files:[],archiveBlockers:['Terminal active'],removalBlockers:[]});
  h.host.pageBlockingSessions=id=>{assert.equal(id,'p');return [{id:'claim:busy',claimId:'busy',sessionId:7,pageId:'other',pageName:'Other page',label:'Agent',directory:'/repo/p',state:'tracked'}];};
  h.host.openBlockingPageSession=async(...args)=>h.effects.push(args);
  h.api.renderWorkPages(h.root,h.app,h.host,'p',()=>{},()=>{});await h.root.all().find(e=>e.text==='Archive page').onclick();await tick();const modal=h.opened.at(-1);
  assert.ok(modal.contentEl.all().some(e=>e.text==='Other page — Agent'));
  await h.button(modal,'Close this session…').onclick();assert.deepEqual(h.effects,[['claim:busy',true]]);
  assert.ok(modal.contentEl.all().some(e=>e.text==='Other page — Agent'),'Closing a session keeps the page review open');
});

test('diff colors distinguish headers and content, preserve markup as text and limit huge previews',()=>{
  const h=harness();h.api.renderPageDiff(h.root,'diff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -1 +1 @@\n-old\n+<script>unsafe()</script>\n context');
  const added=h.root.all().filter(e=>e.classes.has('auto-oc-diff-added'));
  assert.equal(added.length,1);assert.equal(added[0].text,'+<script>unsafe()</script>\n');
  assert.equal(h.root.all().filter(e=>e.classes.has('auto-oc-diff-file')).length,3);
  assert.equal(h.root.all().filter(e=>e.classes.has('auto-oc-diff-removed')).length,1);
  assert.equal(h.root.all().some(e=>e.tag==='script'),false);
  h.root.empty();h.api.renderPageDiff(h.root,'+a\n'.repeat(1500));
  assert.equal(h.root.all().filter(e=>e.classes.has('auto-oc-diff-line')).length,1200);
  assert.ok(h.root.all().some(e=>/Preview shortened/.test(e.text)));
});

test('page controls route a selected step to its whole page workflow and keep history scoped',async()=>{
  const h=harness();h.host.settings.workPages=[{id:'p',name:'Feature',directory:'/repo/p',kind:'folder',taskIds:[],workflowIds:[]}];
  h.host.settings.workflows=[{id:'w',name:'All steps'}];
  h.host.settings.pageRuns=[{pageId:'other',sourceId:'w',task:false,runId:'secret-other',name:'Other',phase:'completed'}];
  h.host.runWorkPage=async(...args)=>h.effects.push(args);
  h.api.openPageItemControls(h.app,h.host,'p',{id:'step',workflowId:'w',kind:'code',name:'Code'},()=>h.effects.push('edit'));
  const modal=h.opened.at(-1);assert.equal(modal.contentEl.all().some(e=>e.text==='secret-other'),false);
  await h.button(modal,'Run workflow here').onclick();assert.deepEqual(h.effects,[['p','w',false]]);
});

test('interactive workflow task can run on its own in the selected page and retains rejection details',async()=>{
  const h=harness();h.host.settings.workPages=[{id:'p',name:'Feature',directory:'/repo/p',kind:'worktree',taskIds:[],workflowIds:[]}];
  h.host.settings.tasks=[{id:'cli',name:'Agent',taskKind:'cli',interactiveTerminal:true,workingDirectory:'/repo'}];
  h.host.settings.workflows=[{id:'w',name:'Workflow'}];
  const item={id:'step',taskId:'cli',workflowId:'w',kind:'task',name:'Agent'};
  h.host.settings.pageRuns=[{pageId:'p',sourceId:'cli',task:true,runId:'own',name:'Own task',phase:'completed'},
    {pageId:'other',sourceId:'cli',task:true,runId:'other',name:'Other page',phase:'completed'}];
  h.host.runWorkPage=async()=>{throw Error('Fixed folder outside this page');};
  h.api.openPageItemControls(h.app,h.host,'p',item,()=>{});let modal=h.opened.at(-1);
  assert.ok(modal.contentEl.all().some(e=>/Fixed task folder/.test(e.text)));
  assert.ok(modal.contentEl.all().some(e=>/Own task/.test(e.text)));assert.equal(modal.contentEl.all().some(e=>/Other page/.test(e.text)),false);
  await h.button(modal,'Run this task only').onclick();
  assert.ok(modal.contentEl.all().some(e=>e.attrs.role==='alert'&&/Fixed folder/.test(e.text)));
  h.host.runWorkPage=async(...args)=>h.effects.push(args);
  await h.button(modal,'Run this task only').onclick();assert.deepEqual(h.effects,[['p','cli',true]]);
  h.host.settings.tasks[0].disabled=true;h.api.openPageItemControls(h.app,h.host,'p',item,()=>{});modal=h.opened.at(-1);
  assert.equal(h.button(modal,'Run this task only').disabled,true);
  h.host.settings.tasks[0].disabled=false;h.host.settings.tasks[0].interactiveTerminal=false;h.host.settings.tasks[0].taskKind='code';
  h.api.openPageItemControls(h.app,h.host,'p',{...item,kind:'code'},()=>{});
  assert.equal(h.opened.at(-1).contentEl.all().some(e=>e.text==='Run this task only'),false);
});

test('archiving always keeps the folder and routes back to Main without implicit removal',async()=>{
  const h=harness();h.host.settings.workPages=[{id:'login',name:'Login',objective:'',directory:'/repo/login',repository:'/repo',kind:'worktree',branch:'feat/login',workflowIds:[],taskIds:[]}];
  h.host.reviewPageFinish=async()=>({pageId:'login',hash:'reviewed',changes:'No changes.',archiveBlockers:[],removalBlockers:[]});
  h.host.finishWorkPage=async(...args)=>h.effects.push(args);
  const selected=[];
  const open=async()=>{h.root.empty();h.api.renderWorkPages(h.root,h.app,h.host,'login',id=>selected.push(id),()=>{});await h.root.all().find(e=>e.text==='Archive page').onclick();await tick();return h.opened.at(-1);};
  let modal=await open();assert.equal(modal.contentEl.all().some(e=>e.name==='Remove worktree folder'),false);
  h.button(modal,'Cancel').onclick();assert.deepEqual(h.effects,[]);
  modal=await open();const confirm=h.button(modal,'Archive page');assert.equal(confirm.disabled,false);
  await confirm.onclick();assert.deepEqual(h.effects,[['login','reviewed',false,false]]);assert.deepEqual(selected,['main']);
});

test('removed pages keep history but offer no restore or new worktree removal',()=>{
  const h=harness();h.host.settings.workPages=[{id:'gone',name:'Gone',objective:'',directory:'/repo/gone',kind:'worktree',archived:true,worktreeRemoval:{status:'removed'},workflowIds:[],taskIds:[]}];
  h.api.renderWorkPages(h.root,h.app,h.host,'gone',()=>{},()=>{});
  const buttons=h.root.all().filter(e=>e.tag==='button');assert.equal(buttons.some(e=>['Restore page','Archive page','Remove worktree','Check removal'].includes(e.text)),false);
  assert.equal(buttons.find(e=>e.text==='CLI in this page').disabled,true);
  assert.ok(h.root.all().some(e=>e.text==='Worktree removed. Branch and page history kept.'));
  h.root.empty();h.api.renderWorkPages(h.root,h.app,h.host,'main',()=>{},()=>{});
  assert.equal(h.root.all().some(e=>e.tag==='button'&&e.text==='Gone (archived)'),false);
  h.root.empty();h.api.renderWorkPages(h.root,h.app,h.host,'general',()=>{},()=>{});
  assert.ok(h.root.all().some(e=>e.tag==='h4'&&e.text==='Gone (archived)'));
});

test('tracked page terminals offer navigation; untracked sessions retain manual confirmation',()=>{
  const h=harness();h.host.settings.pageTerminalClaims=[{id:'claim',pageId:'main',directory:'/repo',createdAt:'now'}];
  h.host.pageTerminalState=()=> 'tracked';h.host.hasPageTerminal=()=>true;h.host.showPageTerminal=async()=>{};
  h.api.renderWorkPages(h.root,h.app,h.host,'main',()=>{},()=>{});
  assert.ok(h.root.all().some(e=>e.text==='Open terminal'));
  assert.equal(h.root.all().some(e=>e.text==='Confirm session ended'),false);
  h.root.empty();h.host.pageTerminalState=()=> 'unknown';h.host.hasPageTerminal=()=>false;
  h.api.renderWorkPages(h.root,h.app,h.host,'main',()=>{},()=>{});
  assert.ok(h.root.all().some(e=>e.text==='Confirm session ended'));
  h.root.empty();h.api.renderWorkPages(h.root,h.app,h.host,'general',()=>{},()=>{});
  assert.equal(h.root.all().some(e=>e.text==='Confirm session ended'||e.text==='Open terminal'),false);
});
test('worktrees default off; enabling only saves the setting, and ordinary pages stay available',async()=>{
  const h=harness();h.api.addWorkPageSettings(h.root,h.host);
  const toggle=h.root.all().find(e=>e.tag==='toggle');assert.equal(toggle.value,false);await toggle.change(true);
  assert.equal(h.host.settings.worktreesEnabled,true);assert.deepEqual(h.effects,['save']);
  h.host.settings.worktreesEnabled=false;const modal=h.create();
  assert.deepEqual(Array.from(h.field(modal,'Environment','select').control.options,o=>o.value),['folder']);
});
test('cancelling preparation has no Git effects and does not remember the notice',async()=>{
  const h=harness();h.host.settings.worktreesEnabled=true;const modal=h.create();
  h.field(modal,'Name','input').change('Feature');h.field(modal,'Environment','select').change('create');
  const operation=h.button(modal,'Create page').onclick();await tick();
  const notice=h.opened.at(-1);assert.notEqual(notice,modal);
  assert.equal(h.field(notice,"Don't show this notice again for this project",'toggle').value,false);
  h.button(notice,'Cancel').onclick();await operation;
  assert.deepEqual(h.effects,['inspect','reserve','release']);assert.equal(h.host.settings.worktreeNoticeDismissed,undefined);
});
test('acceptance prepares ignore before creation, saves opt-out per repository and links the page',async()=>{
  const h=harness();h.host.settings.worktreesEnabled=true;const modal=h.create();
  h.field(modal,'Name','input').change('Feature');h.field(modal,'Environment','select').change('create');
  const operation=h.button(modal,'Create page').onclick();await tick();const notice=h.opened.at(-1);
  h.field(notice,"Don't show this notice again for this project",'toggle').change(true);h.button(notice,'Continue').onclick();await operation;
  assert.deepEqual(h.effects,['inspect','reserve','prepare','save','create','save','select','release']);
  assert.deepEqual(Array.from(h.host.settings.worktreeNoticeDismissed),['repo-key']);assert.equal(h.host.settings.workPages[0].kind,'worktree');
});
test('failed gitignore preparation creates nothing and does not save opt-out',async()=>{
  const h=harness(true);h.host.settings.worktreesEnabled=true;const modal=h.create();
  h.field(modal,'Name','input').change('Feature');h.field(modal,'Environment','select').change('create');
  const operation=h.button(modal,'Create page').onclick();await tick();const notice=h.opened.at(-1);
  h.field(notice,"Don't show this notice again for this project",'toggle').change(true);h.button(notice,'Continue').onclick();await operation;
  assert.deepEqual(h.effects,['inspect','reserve','prepare','release']);assert.equal(h.host.settings.worktreeNoticeDismissed,undefined);
});

test('Overview only reads logs and navigates; execution and terminal controls stay in their page',async()=>{
  const h=harness(),selected=[];
  h.host.settings.workPages=[{id:'login',name:'Login fix',directory:'/repo/login',kind:'folder',objective:'',workflowIds:[],taskIds:[]}];
  h.host.settings.pageRuns=[
    {pageId:'login',sourceId:'w',task:false,runId:'live',workflowId:'page-w',name:'Build',phase:'in_flight'},
    {pageId:'login',sourceId:'w',task:false,runId:'review',workflowId:'page-w',name:'Review',phase:'ready',uncertain:true}
  ];
  h.host.settings.pageTerminalClaims=[{id:'cli',pageId:'login',directory:'/repo/login',createdAt:'2026-11-09'}];
  h.host.ownsExecution=(_,runId)=>runId==='live';h.host.pageRunOutput=()=>{h.effects.push('read-log');return 'Log text';};
  const before=JSON.stringify(h.host.settings);
  assert.equal(h.api.renderWorkPages(h.root,h.app,h.host,'general',id=>selected.push(id),()=>h.effects.push('cli')),true);
  const buttons=h.root.all().filter(e=>e.tag==='button');
  assert.ok(!buttons.some(e=>e.text==='Overview'));assert.ok(buttons.some(e=>e.text==='Main workspace'));
  assert.ok(buttons.some(e=>e.text==='Login fix'));
  assert.ok(!buttons.some(e=>['Stop','Continue','Reconcile','Confirm session ended','+ New page','Run here','CLI in this page'].includes(e.text)));
  await buttons.find(e=>e.text==='Log').onclick();
  for(const b of buttons.filter(e=>e.text==='Open page')) b.onclick();
  assert.ok(selected.includes('main'));assert.ok(selected.includes('login'));
  assert.deepEqual(h.effects,['read-log']);assert.equal(JSON.stringify(h.host.settings),before);
  h.root.empty();h.api.renderWorkPages(h.root,h.app,h.host,'login',()=>{},()=>{});
  const pageButtons=h.root.all().filter(e=>e.tag==='button').map(e=>e.text);
  for(const label of ['Stop','Continue','Reconcile','Confirm session ended','+ New page']) assert.ok(pageButtons.includes(label),label);
});

test('Main workspace reads its effective folder and refreshes the branch without a setting save',async()=>{
  const h=harness(),directories=[];let state={kind:'branch',branch:'feat/current'};
  h.host.settings.workingDirectory=' /default/project ';
  h.helper.readWorkspaceGitState=async directory=>{directories.push(directory);return state;};
  assert.equal(h.api.renderWorkPages(h.root,h.app,h.host,'main',()=>{},()=>{}),false);
  await tick();assert.deepEqual(directories,['/default/project']);
  const status=h.root.all().find(e=>e.attrs['aria-live']==='polite');
  assert.equal(status.text,'Branch: feat/current');
  const refresh=h.root.all().find(e=>e.attrs['aria-label']==='Refresh branch');
  state={kind:'branch',branch:'fix/new-branch'};await refresh.onclick();assert.equal(status.text,'Branch: fix/new-branch');
  h.host.settings.workingDirectory='/another/project';await refresh.onclick();assert.equal(directories.at(-1),'/another/project');
  assert.ok(h.root.all().some(e=>e.text==='/another/project'));
  state={kind:'detached',commit:'1234abcd'};await refresh.onclick();assert.equal(status.text,'Detached HEAD: 1234abcd');
  state={kind:'no-repository'};await refresh.onclick();assert.equal(status.text,'Branch: not a Git repository');
  h.helper.readWorkspaceGitState=async()=>{throw Error('private error');};h.host.redactSecrets=()=>'redacted';
  await refresh.onclick();assert.equal(status.text,'Branch: unavailable');assert.equal(status.title,'redacted');assert.equal(refresh.disabled,false);
  assert.deepEqual(h.effects,[]);
  h.root.empty();h.host.settings.workingDirectory='';
  h.helper.readWorkspaceGitState=async directory=>{directories.push(directory);return state;};
  h.api.renderWorkPages(h.root,h.app,h.host,'main',()=>{},()=>{});await tick();assert.equal(directories.at(-1),'/repo');
});

test('confirming a terminal removes only its saved reservation and preserves a replacement session',async()=>{
  const h=harness(),old={id:'old',pageId:'main',directory:'/repo',createdAt:'yesterday'};
  h.host.settings.pageTerminalClaims=[old];h.host.pageTerminalState=id=>id==='old'?'unknown':'tracked';
  h.host.confirmPageTerminal=async id=>{
    assert.equal(id,'old');
    h.host.settings.pageTerminalClaims=[{...old,id:'new',createdAt:'today'}];
  };
  h.api.renderWorkPages(h.root,h.app,h.host,'main',()=>{},()=>{});
  const context=h.root.all().find(e=>e.classes.has('auto-oc-workspace-context'));
  const pending=h.root.all().find(e=>e.text==='Confirm session ended').onclick();
  await h.button(h.opened.at(-1),'I closed the session — release folder').onclick();await pending;
  assert.equal(h.root.all().some(e=>e.text.includes('completion unconfirmed')),false);
  assert.equal(h.root.all().some(e=>e.text==='Confirm session ended'),false);
  assert.ok(h.root.all().some(e=>e.text.includes('session reserved')));
  assert.ok(h.root.all().includes(context));assert.equal(h.host.settings.pageTerminalClaims[0].id,'new');
  const row=h.root.all().find(e=>e.classes.has('auto-oc-page-row'));
  h.api.refreshWorkPageTerminals(h.root);assert.ok(h.root.all().includes(row),'Unchanged refresh keeps the same row');
  h.host.settings.pageTerminalClaims=[];h.api.refreshWorkPageTerminals(h.root);
  assert.equal(h.root.all().some(e=>e.classes.has('auto-oc-page-row')),false);
});

test('a failed terminal confirmation and cancellation keep the reservation visible',async()=>{
  const h=harness();h.host.settings.pageTerminalClaims=[{id:'old',pageId:'main',directory:'/repo'}];
  h.host.confirmPageTerminal=async()=>{throw Error('Save failed');};
  h.api.renderWorkPages(h.root,h.app,h.host,'main',()=>{},()=>{});
  const pending=h.root.all().find(e=>e.text==='Confirm session ended').onclick();
  const modal=h.opened.at(-1);await h.button(modal,'I closed the session — release folder').onclick();
  assert.ok(h.notices.some(message=>message.includes('Save failed')));assert.ok(h.root.all().some(e=>e.text.includes('completion unconfirmed')));
  h.button(modal,'Cancel').onclick();await pending;assert.equal(h.host.settings.pageTerminalClaims.length,1);
  assert.ok(h.root.all().some(e=>e.text==='Confirm session ended'));
});
