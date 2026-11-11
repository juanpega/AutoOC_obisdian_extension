const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function harness(failPrepare=false) {
  class Element {
    constructor(options={}){this.children=[];this.text=options.text||'';this.style={};this.attrs={};this.classes=new Set((typeof options==='string'?options:options.cls||'').split(' '));}
    createEl(tag,options={}){const child=new Element(options);child.tag=tag;this.children.push(child);return child;}
    createDiv(options={}){return this.createEl('div',options);} empty(){this.children=[];} setText(v){this.text=v;} setAttr(k,v){this.attrs[k]=v;} addClass(c){this.classes.add(c);}
    all(){return [this,...this.children.flatMap(c=>c.all())];}
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
  class Modal {
    constructor(app){this.app=app;this.modalEl=new Element();this.contentEl=new Element();}
    open(){opened.push(this);this.onOpen?.();} close(){this.onClose?.();}
  }
  const helper={
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
    module,exports:module.exports,require:id=>id==='obsidian'?{Modal,Setting,Notice:class{constructor(s){notices.push(s);}}}:id==='./work-pages'?helper:id==='./merge-review'?{mergeReviewCommand:(_review,action)=>'command:'+action,mergeEditorUri:dir=>'vscode://file/'+dir}:id==='electron'?{clipboard:{writeText:text=>effects.push(text)},shell:{openExternal:async uri=>effects.push(uri)}}:require(id),console,process
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
  let review={source,target,targets:[target],state,inProgress,conflicts:state==='conflicts'?['file.ts']:[],blockers:[],details:'Review details',hash:'one'};
  h.host.reviewPageMerge=async()=>review;
  h.api.renderWorkPages(h.root,h.app,h.host,'p',()=>{},()=>{});
  return {...h,setReview(value){review={...review,...value};},async open(){await h.root.all().find(e=>e.text==='Merge review').onclick();await tick();return h.opened.at(-1);}};
}
test('Merge review distinguishes predicted conflicts, copies a command and never runs it',async()=>{
  const h=mergeHarness(),modal=await h.open();
  assert.ok(modal.contentEl.all().some(e=>e.text==='Predicted conflict files (1)'));
  assert.equal(modal.contentEl.all().some(e=>e.text==='Copy complete command'),false);
  assert.equal(modal.contentEl.all().some(e=>e.text==='Finish work'),false);
  await h.button(modal,'Copy merge command').onclick();assert.deepEqual(h.effects,['command:start']);
  await h.button(modal,'Open target in VS Code').onclick();assert.ok(h.effects.some(e=>e==='vscode://file//repo'));
  assert.ok(modal.modalEl.classes.has('auto-oc-work-page-dialog'));
});
test('Merge review gates completion on actual resolved state, preserves a merge on close and refreshes stale commands',async()=>{
  const h=mergeHarness('conflicts',true),modal=await h.open();
  assert.ok(modal.contentEl.all().some(e=>e.text==='Unresolved files (1)'));
  assert.equal(modal.contentEl.all().some(e=>e.text==='Copy complete command'),false);
  h.setReview({state:'resolved',conflicts:[],hash:'two'});await h.button(modal,'Recheck conflicts').onclick();
  await h.button(modal,'Copy complete command').onclick();assert.deepEqual(h.effects,['command:complete']);
  h.setReview({state:'blocked',blockers:['Session active'],hash:'three'});await h.button(modal,'Copy abort command').onclick();
  assert.deepEqual(h.effects,['command:complete']);assert.ok(h.notices.some(s=>/Workspace or activity changed/.test(s)));
  assert.equal(modal.contentEl.all().some(e=>e.text==='Copy abort command'),false);
  h.button(modal,'Close').onclick();assert.deepEqual(h.effects,['command:complete']);
});
test('Merge review offers Finish work only after rechecking verified integration',async()=>{
  const h=mergeHarness('integrated'),modal=await h.open();
  h.setReview({state:'ready',hash:'changed'});await h.button(modal,'Finish work').onclick();
  assert.equal(h.opened.length,1);assert.equal(modal.contentEl.all().some(e=>e.text==='Finish work'),false);
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
  h.field(modal,'I accept losing these files and the local branch, and have closed all sessions, services and previous Git processes','toggle').change(true);
  assert.equal(accept.disabled,true);await accept.onclick();assert.deepEqual(h.effects,[]);
  h.field(modal,'Type the branch name to discard','input').change('feat/p');assert.equal(accept.disabled,false);
  await accept.onclick();assert.deepEqual(h.effects,[['p','review','feat/p',true]]);assert.deepEqual(selected,['main']);
  assert.ok(h.notices.some(s=>/local branch discarded/.test(s)));
  h.root.empty();page.kind='folder';h.api.renderWorkPages(h.root,h.app,h.host,'p',()=>{},()=>{});
  assert.equal(h.root.all().some(e=>e.text==='Discard work'),false);
});

test('discard blockers cannot be bypassed by confirmation and pending discard labels preserve the correct outcome',async()=>{
  const h=harness();h.host.settings.workPages=[{id:'p',name:'Feature',directory:'/repo/p',kind:'worktree',branch:'feat/p',taskIds:[],workflowIds:[],archived:true,worktreeRemoval:{mode:'discard',status:'pending'}}];
  h.host.reviewPageDiscard=async()=>({hash:'review',blockers:['Another worktree uses this branch.'],stage:'branch-only',changes:'',commits:'',fileCount:0,commitCount:0});
  h.api.renderWorkPages(h.root,h.app,h.host,'p',()=>{},()=>{});
  assert.ok(h.root.all().some(e=>e.text==='Check discard'));assert.equal(h.root.all().some(e=>e.text==='Check removal'),false);
  await h.root.all().find(e=>e.text==='Discard work').onclick();await tick();const modal=h.opened.at(-1);
  h.field(modal,'Type the branch name to discard','input').change('feat/p');
  h.field(modal,'I accept losing these files and the local branch, and have closed all sessions, services and previous Git processes','toggle').change(true);
  assert.equal(h.button(modal,'Discard remaining branch').disabled,true);
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
  await h.root.all().find(e=>e.text==='Finish work').onclick();await tick();const modal=h.opened.at(-1);
  const footer=modal.contentEl.all().find(e=>e.classes.has('auto-oc-finish-footer'));
  assert.ok(footer.all().some(e=>e.text==='Archive page'));assert.equal(h.button(modal,'Archive page').disabled,false);
  assert.equal(footer.all().some(e=>e.classes.has('auto-oc-page-diff')),false);
  assert.ok(modal.contentEl.all().some(e=>/existing folder/.test(e.text)));
  assert.ok(modal.contentEl.all().some(e=>e.text==='Discard work is unavailable for this page.'));
  assert.ok(modal.contentEl.all().some(e=>/even if you have not made any changes/.test(e.text)));
  assert.ok(modal.contentEl.all().some(e=>/Settings → Execution → Git worktrees/.test(e.text)));
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
    await h.root.all().find(e=>e.text===(discard?'Discard work':'Finish work')).onclick();await tick();const modal=h.opened.at(-1);
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

test('Delete page retains history or removal evidence and reports failed saves without claiming success',async()=>{
  const h=harness(),page={id:'p',name:'Old attempt',directory:'/repo',kind:'folder',archived:true,taskIds:[],workflowIds:[]};
  h.host.settings.workPages=[page];h.host.deleteWorkPage=async()=>{throw Error('save failed');};
  h.api.renderWorkPages(h.root,h.app,h.host,'general',()=>h.effects.push('navigate'),()=>{});
  const open=()=>{h.root.all().find(e=>e.tag==='button'&&e.text==='Delete page').onclick();return h.opened.at(-1);};
  h.host.settings.pageRuns=[{pageId:'p'}];let modal=open();assert.equal(h.button(modal,'Delete page').disabled,true);
  h.host.settings.pageRuns=[];page.worktreeRemoval={status:'pending'};modal=open();assert.equal(h.button(modal,'Delete page').disabled,true);
  delete page.worktreeRemoval;modal=open();await h.button(modal,'Delete page').onclick();
  assert.ok(modal.contentEl.all().some(e=>/save failed/.test(e.text)));assert.deepEqual(h.effects,[]);assert.deepEqual(h.notices,[]);
});

test('blocked close explains the reason next to confirmation and can refresh after sessions end',async()=>{
  const h=harness();let blocked=true;
  h.host.settings.workPages=[{id:'p',name:'Feature',directory:'/repo/p',kind:'worktree',branch:'feat/p',taskIds:[],workflowIds:[]}];
  h.host.reviewPageFinish=async()=>({hash:'h',changes:'',archiveBlockers:blocked?['Close active terminals.']:[],removalBlockers:['Ignored files present.']});
  h.api.renderWorkPages(h.root,h.app,h.host,'p',()=>{},()=>{});
  await h.root.all().find(e=>e.text==='Finish work').onclick();await tick();let modal=h.opened.at(-1);
  assert.equal(h.button(modal,'Archive page').disabled,true);
  assert.ok(modal.contentEl.all().some(e=>/Cannot archive yet: Close active terminals/.test(e.text)));
  blocked=false;await h.button(modal,'Refresh review').onclick();
  assert.equal(h.button(modal,'Archive page').disabled,false);
  assert.equal(h.field(modal,'Remove worktree folder','toggle').disabled,true);
});

test('a failed close inspection provides retry and cancel without a dead-end modal',async()=>{
  const h=harness();h.host.settings.workPages=[{id:'p',name:'Feature',directory:'/repo',kind:'folder',taskIds:[],workflowIds:[]}];
  h.host.reviewPageFinish=async()=>{throw Error('read failure');};
  h.api.renderWorkPages(h.root,h.app,h.host,'p',()=>{},()=>{});
  await h.root.all().find(e=>e.text==='Finish work').onclick();await tick();const modal=h.opened.at(-1);
  assert.ok(h.button(modal,'Retry review'));assert.ok(h.button(modal,'Cancel'));
  assert.equal(modal.contentEl.all().some(e=>e.text==='Archive page'),false);
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

test('Finish work defaults to keeping the folder and requires explicit removal and session confirmation',async()=>{
  const h=harness();h.host.settings.workPages=[{id:'login',name:'Login',objective:'',directory:'/repo/login',repository:'/repo',kind:'worktree',branch:'feat/login',workflowIds:[],taskIds:[]}];
  h.host.reviewPageFinish=async()=>({pageId:'login',hash:'reviewed',changes:'No changes.',archiveBlockers:[],removalBlockers:[]});
  h.host.finishWorkPage=async(...args)=>h.effects.push(args);
  const selected=[];
  const open=async()=>{h.root.empty();h.api.renderWorkPages(h.root,h.app,h.host,'login',id=>selected.push(id),()=>{});await h.root.all().find(e=>e.text==='Finish work').onclick();await tick();return h.opened.at(-1);};
  let modal=await open();assert.equal(h.field(modal,'Remove worktree folder','toggle').value,false);
  h.button(modal,'Cancel').onclick();assert.deepEqual(h.effects,[]);
  modal=await open();h.field(modal,'Remove worktree folder','toggle').change(true);
  const confirm=h.button(modal,'Archive and remove worktree');assert.equal(confirm.disabled,true);
  h.field(modal,'I closed external sessions and services using this worktree','toggle').change(true);assert.equal(confirm.disabled,false);
  await confirm.onclick();assert.deepEqual(h.effects,[['login','reviewed',true,true]]);assert.deepEqual(selected,['main']);
});

test('removed pages keep history but offer no restore or new worktree removal',()=>{
  const h=harness();h.host.settings.workPages=[{id:'gone',name:'Gone',objective:'',directory:'/repo/gone',kind:'worktree',archived:true,worktreeRemoval:{status:'removed'},workflowIds:[],taskIds:[]}];
  h.api.renderWorkPages(h.root,h.app,h.host,'gone',()=>{},()=>{});
  const buttons=h.root.all().filter(e=>e.tag==='button');assert.equal(buttons.some(e=>['Restore page','Finish work','Check removal'].includes(e.text)),false);
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
  assert.deepEqual(h.effects,['reserve','inspect','release']);assert.equal(h.host.settings.worktreeNoticeDismissed,undefined);
});
test('acceptance prepares ignore before creation, saves opt-out per repository and links the page',async()=>{
  const h=harness();h.host.settings.worktreesEnabled=true;const modal=h.create();
  h.field(modal,'Name','input').change('Feature');h.field(modal,'Environment','select').change('create');
  const operation=h.button(modal,'Create page').onclick();await tick();const notice=h.opened.at(-1);
  h.field(notice,"Don't show this notice again for this project",'toggle').change(true);h.button(notice,'Continue').onclick();await operation;
  assert.deepEqual(h.effects,['reserve','inspect','prepare','save','create','save','select','release']);
  assert.deepEqual(Array.from(h.host.settings.worktreeNoticeDismissed),['repo-key']);assert.equal(h.host.settings.workPages[0].kind,'worktree');
});
test('failed gitignore preparation creates nothing and does not save opt-out',async()=>{
  const h=harness(true);h.host.settings.worktreesEnabled=true;const modal=h.create();
  h.field(modal,'Name','input').change('Feature');h.field(modal,'Environment','select').change('create');
  const operation=h.button(modal,'Create page').onclick();await tick();const notice=h.opened.at(-1);
  h.field(notice,"Don't show this notice again for this project",'toggle').change(true);h.button(notice,'Continue').onclick();await operation;
  assert.deepEqual(h.effects,['reserve','inspect','prepare','release']);assert.equal(h.host.settings.worktreeNoticeDismissed,undefined);
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
