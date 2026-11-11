const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const runtime=require('../autooc-runtime.cjs');
const source=require('esbuild').buildSync({entryPoints:[path.join(__dirname,'../finish-work.ts')],bundle:true,platform:'node',format:'cjs',write:false});
const mod={exports:{}};new Function('require','module','exports',source.outputFiles[0].text)(require,mod,mod.exports);
const helper=mod.exports;
const git=(cwd,...args)=>execFileSync('git',['-c','safe.directory='+cwd.replace(/\\/g,'/'),...args],{cwd,windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
function plugin(vault){
  const mod={exports:{}},obsidian=Object.fromEntries(['Plugin','Notice','Modal','Setting','ItemView','PluginSettingTab','WorkspaceLeaf'].map(k=>[k,class{}]));
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8'),{module:mod,exports:mod.exports,require:n=>n==='obsidian'?obsidian:require(n),process,Buffer,console,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,window:{setInterval,clearInterval,clearTimeout}});
  const p=new mod.exports.default();p.manifest={id:'auto-oc'};
  p.app={vault:{adapter:{basePath:vault},configDir:'.obsidian'},workspace:{getLeavesOfType:()=>[],detachLeavesOfType(){}}};
  p.refreshOpenViews=()=>{};return p;
}
async function fixture(t){
  const vault=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'autooc-finish-'))),repo=path.join(vault,'repo');fs.mkdirSync(repo);
  git(repo,'init','-b','fixture-main');git(repo,'config','user.name','AutoOC test');git(repo,'config','user.email','test@example.invalid');
  fs.writeFileSync(path.join(repo,'tracked.txt'),'base');fs.writeFileSync(path.join(repo,'.gitignore'),'.autooc/worktrees/\n.env\nnode_modules/\n');git(repo,'add','.');git(repo,'commit','-m','base');
  const base=git(repo,'rev-parse','HEAD'),worktree=path.join(repo,'.autooc/worktrees/page');fs.mkdirSync(path.dirname(worktree),{recursive:true});
  git(repo,'worktree','add','-b','feat/finish',worktree,'HEAD');
  const dir=path.join(vault,'.obsidian/plugins/auto-oc'),file=path.join(dir,'data.json');fs.mkdirSync(dir,{recursive:true});
  const page={id:'page',name:'Finish me',objective:'Keep history',directory:fs.realpathSync.native(worktree),repository:fs.realpathSync.native(repo),kind:'worktree',branch:'feat/finish',baseCommit:base,workflowIds:['w'],taskIds:[]};
  fs.writeFileSync(file,JSON.stringify({workingDirectory:repo,tasks:[],workflows:[{id:'w',name:'Write',steps:[{id:'write',stepKind:'code',codeAllowVault:true,code:'vault.append("effect.txt","once");'}]}],workPages:[page]}));
  const instances=[];
  const open=async()=>{const p=plugin(vault);instances.push(p);p.reservePluginExecution();await p.loadSettings();return p;};
  t.after(async()=>{for(const p of instances){await p.settingsWriter.drain().catch(()=>{});p.releasePluginExecution(false);}assert.equal(path.dirname(fs.realpathSync.native(vault)),fs.realpathSync.native(os.tmpdir()));assert.match(path.basename(vault),/^autooc-finish-/);fs.rmSync(vault,{recursive:true,force:true});});
  const p=await open();
  return {vault,repo,worktree,dir,file,page,p,open,read:()=>JSON.parse(fs.readFileSync(file,'utf8')),review:()=>p.reviewPageFinish('page')};
}

test('merge review checks the installed owner and terminal activity without saving page settings',async t=>{
  const f=await fixture(t),before=fs.readFileSync(f.file,'utf8');
  let review=await f.p.reviewPageMerge('page');assert.equal(review.state,'integrated');assert.equal(review.source.branch,'feat/finish');
  f.p.settings.pageTerminalClaims=[{id:'terminal',pageId:'page',directory:f.worktree,createdAt:new Date().toISOString()}];
  review=await f.p.reviewPageMerge('page');assert.equal(review.state,'blocked');assert.match(review.blockers.join(),/Close active terminals/);
  f.p.settings.pageTerminalClaims=[];f.p.releasePluginExecution(false);
  review=await f.p.reviewPageMerge('page');assert.equal(review.state,'blocked');assert.match(review.blockers.join(),/own execution/);
  assert.equal(fs.readFileSync(f.file,'utf8'),before);assert.ok(fs.existsSync(f.worktree));
});

test('explicit discard removes dirty, untracked and ignored worktree files and its local branch, preserving Main and history',async t=>{
  const f=await fixture(t);await f.p.runWorkPage('page','w',false);
  fs.writeFileSync(path.join(f.worktree,'tracked.txt'),'committed feature');git(f.worktree,'add','tracked.txt');git(f.worktree,'commit','-m','feature commit');
  fs.appendFileSync(path.join(f.worktree,'tracked.txt'),'dirty');fs.writeFileSync(path.join(f.worktree,'.env'),'private local');
  const mainHead=git(f.repo,'rev-parse','HEAD'),index=fs.readFileSync(path.join(f.repo,'.git/index')),before=f.read();
  const review=await f.p.reviewPageDiscard('page');assert.deepEqual(Array.from(review.blockers),[]);assert.equal(review.commitCount,1);assert.match(review.changes,/\.env/);
  await assert.rejects(f.p.discardWorkPage('page',review.hash,'wrong',true),/exact branch/);
  await assert.rejects(f.p.discardWorkPage('page',review.hash,'feat/finish',false),/confirm/);
  assert.ok(fs.existsSync(f.worktree));
  await f.p.discardWorkPage('page',review.hash,'feat/finish',true);
  const after=f.read();assert.equal(after.workPages[0].worktreeRemoval.mode,'discard');assert.equal(after.workPages[0].worktreeRemoval.status,'removed');
  assert.equal(fs.existsSync(f.worktree),false);assert.equal(git(f.repo,'branch','--list','feat/finish'),'');
  assert.equal(git(f.repo,'rev-parse','HEAD'),mainHead);assert.deepEqual(fs.readFileSync(path.join(f.repo,'.git/index')),index);
  assert.equal(fs.readFileSync(path.join(f.repo,'tracked.txt'),'utf8'),'base');assert.deepEqual(after.workflows,before.workflows);assert.deepEqual(after.pageRuns,before.pageRuns);
  await assert.rejects(runtime.runInstalledWorkflow({vault:f.vault,workflowId:'w',pageId:'page',lease:f.p.pluginExecutionLease,redact:s=>s}),/removed/);
});

test('discard rejects changed ignored contents after review, and late files after pending publication',async t=>{
  const f=await fixture(t);fs.writeFileSync(path.join(f.worktree,'.env'),'first');
  let review=await f.p.reviewPageDiscard('page');fs.writeFileSync(path.join(f.worktree,'.env'),'other');
  await assert.rejects(f.p.discardWorkPage('page',review.hash,'feat/finish',true),/changed/);assert.equal(f.read().workPages[0].worktreeRemoval,undefined);
  review=await f.p.reviewPageDiscard('page');const save=f.p.saveSettings.bind(f.p);
  f.p.saveSettings=async(...args)=>{await save(...args);if(f.p.settings.workPages[0].worktreeRemoval?.status==='pending')fs.writeFileSync(path.join(f.worktree,'late.txt'),'keep');};
  await assert.rejects(f.p.discardWorkPage('page',review.hash,'feat/finish',true),/files or index changed/);
  assert.ok(fs.existsSync(f.worktree));assert.equal(f.read().workPages[0].worktreeRemoval.status,'pending');
  f.p.saveSettings=save;await f.p.finishWorkPage('page','check-removal',false,false);
  assert.equal(f.read().workPages[0].worktreeRemoval,undefined);assert.equal(fs.readFileSync(path.join(f.worktree,'late.txt'),'utf8'),'keep');
});

test('discard blocks ordinary/protected folders, protected branches, shared branches and nested repositories',async t=>{
  const f=await fixture(t),page=f.p.settings.workPages[0];
  page.kind='folder';assert.ok((await f.p.reviewPageDiscard('page')).blockers.some(s=>/independent Git worktree/.test(s)));page.kind='worktree';
  f.p.settings.workingDirectory=f.worktree;assert.ok((await f.p.reviewPageDiscard('page')).blockers.some(s=>/Main workspace/.test(s)));f.p.settings.workingDirectory=f.repo;
  fs.mkdirSync(path.join(f.worktree,'nested'));fs.mkdirSync(path.join(f.worktree,'nested/.git'));
  assert.ok((await f.p.reviewPageDiscard('page')).blockers.some(s=>/nested Git/.test(s)));
  fs.rmdirSync(path.join(f.worktree,'nested/.git'));fs.rmdirSync(path.join(f.worktree,'nested'));
  git(f.worktree,'checkout','-b','main');page.branch='main';assert.ok((await f.p.reviewPageDiscard('page')).blockers.some(s=>/Protected branches|main workspace branch/.test(s)));
  git(f.worktree,'checkout','feat/finish');page.branch='feat/finish';
  const second=path.join(f.repo,'.autooc/worktrees/second');git(f.repo,'worktree','add','--force',second,'feat/finish');
  assert.ok((await f.p.reviewPageDiscard('page')).blockers.some(s=>/Another worktree uses/.test(s)));
  assert.ok(fs.existsSync(f.worktree));assert.ok(fs.existsSync(second));
});

test('discard never skips differently cased Git metadata names during its full-file review',async t=>{
  const f=await fixture(t);
  // Probe this filesystem: macOS volumes can be case-sensitive or case-insensitive.
  if(fs.existsSync(path.join(f.worktree,'.GIT')))fs.renameSync(path.join(f.worktree,'.git'),path.join(f.worktree,'.GIT'));
  else {fs.mkdirSync(path.join(f.worktree,'.GIT'));fs.writeFileSync(path.join(f.worktree,'.GIT','local.txt'),'preserve');}
  const review=await f.p.reviewPageDiscard('page');
  assert.ok(review.blockers.some(s=>/nested Git repository|unexpected metadata name/.test(s)));
  await assert.rejects(f.p.discardWorkPage('page',review.hash,'feat/finish',true),/nested Git repository|unexpected metadata name/);
  assert.ok(fs.existsSync(f.worktree));assert.ok(git(f.repo,'branch','--list','feat/finish'));
});

test('discard never starts if pending publication fails and never retries a completed deletion after final save failure',async t=>{
  const f=await fixture(t),review=await f.p.reviewPageDiscard('page'),save=f.p.saveSettings.bind(f.p);
  f.p.saveSettings=async()=>{throw Error('pending save failed');};
  await assert.rejects(f.p.discardWorkPage('page',review.hash,'feat/finish',true),/pending save failed/);assert.ok(fs.existsSync(f.worktree));
  f.p.saveSettings=async(...args)=>{if(f.p.settings.workPages[0].worktreeRemoval?.status==='removed')throw Error('final save failed');return save(...args);};
  await assert.rejects(f.p.discardWorkPage('page',review.hash,'feat/finish',true),/final save failed/);
  assert.equal(fs.existsSync(f.worktree),false);assert.equal(git(f.repo,'branch','--list','feat/finish'),'');assert.equal(f.read().workPages[0].worktreeRemoval.status,'pending');
  f.p.releasePluginExecution(false);const next=await f.open();await next.finishWorkPage('page','check-removal',false,false);
  assert.equal(f.read().workPages[0].worktreeRemoval.status,'removed');assert.equal(f.read().workPages[0].worktreeRemoval.mode,'discard');
});

test('interrupted branch deletion requires a new review and confirmation; Check discard never deletes it',async t=>{
  const f=await fixture(t),review=await f.p.reviewPageDiscard('page');
  const lock=path.join(f.repo,'.git/refs/heads/feat/finish.lock');fs.writeFileSync(lock,'synthetic lock');
  await assert.rejects(f.p.discardWorkPage('page',review.hash,'feat/finish',true),/lock|exists/i);
  assert.equal(fs.existsSync(f.worktree),false);assert.ok(git(f.repo,'branch','--list','feat/finish'));
  await assert.rejects(f.p.finishWorkPage('page','check-removal',false,false),/branch remains/);
  fs.unlinkSync(lock); // Only our isolated fixture lock, after its failed operation ended.
  const remaining=await f.p.reviewPageDiscard('page');assert.equal(remaining.stage,'branch-only');assert.deepEqual(Array.from(remaining.blockers),[]);
  await f.p.discardWorkPage('page',remaining.hash,'feat/finish',true);
  assert.equal(git(f.repo,'branch','--list','feat/finish'),'');assert.equal(f.read().workPages[0].worktreeRemoval.status,'removed');
});

test('discard does not delete a branch moved after the review',async t=>{
  const f=await fixture(t),review=await f.p.reviewPageDiscard('page');
  fs.writeFileSync(path.join(f.worktree,'tracked.txt'),'new commit');git(f.worktree,'add','.');git(f.worktree,'commit','-m','after review');
  const changed=git(f.worktree,'rev-parse','HEAD');await assert.rejects(f.p.discardWorkPage('page',review.hash,'feat/finish',true),/changed/);
  assert.ok(fs.existsSync(f.worktree));assert.equal(git(f.repo,'rev-parse','feat/finish'),changed);
});

test('unloading during discard publication prevents deletion and keeps pending evidence',async t=>{
  const f=await fixture(t),review=await f.p.reviewPageDiscard('page'),save=f.p.saveSettings.bind(f.p);
  let entered,release;const reached=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
  f.p.saveSettings=async(...args)=>{await save(...args);entered();await gate;};
  const operation=f.p.discardWorkPage('page',review.hash,'feat/finish',true),failed=assert.rejects(operation,/closed|stopped/i);
  await reached;const unloading=f.p.onunload();release();await failed;await unloading;
  assert.ok(fs.existsSync(f.worktree));assert.equal(f.read().workPages[0].worktreeRemoval.mode,'discard');assert.equal(f.read().workPages[0].worktreeRemoval.status,'pending');
});

test('manual worktree CLI refuses a changed branch before publishing a reservation or launching',async t=>{
  const f=await fixture(t),opened=[];
  f.p.settings.cliTerminalDestination='integrated';
  f.p.cliTerminals={sessions:[],pageSession:()=>undefined,async open(...args){opened.push(args);}};
  git(f.worktree,'checkout','-b','feat/switched-outside-autooc');
  await assert.rejects(f.p.launchManualCli('codex',f.worktree,'page'),/repository or branch changed/);
  assert.equal(opened.length,0);assert.equal(f.read().pageTerminalClaims?.length || 0,0);
  git(f.worktree,'checkout','feat/finish');
  await f.p.launchManualCli('codex',f.worktree,'page');
  assert.equal(opened.length,1);assert.equal(f.read().pageTerminalClaims.length,1);
});

test('deleting an empty archived folder page removes its configuration and preserves Main, other pages and history',async t=>{
  const f=await fixture(t);
  f.p.settings.workPages.push({...f.page,id:'other'});await f.p.saveSettings();await f.p.runWorkPage('other','w',false);
  const page=f.p.settings.workPages[0];page.kind='folder';page.directory=f.repo;page.archived=true;await f.p.saveSettings();
  const before=f.read(),head=git(f.repo,'rev-parse','HEAD'),index=fs.readFileSync(path.join(f.repo,'.git/index'));
  await f.p.deleteWorkPage(JSON.parse(JSON.stringify(page)));
  const after=f.read();assert.equal(after.workPages.length,1);assert.equal(after.workPages[0].id,'other');
  assert.deepEqual(after.tasks,before.tasks);assert.deepEqual(after.workflows,before.workflows);assert.deepEqual(after.pageRuns,before.pageRuns);
  assert.ok(fs.existsSync(f.worktree));assert.equal(fs.readFileSync(path.join(f.repo,'tracked.txt'),'utf8'),'base');
  assert.equal(git(f.repo,'rev-parse','HEAD'),head);assert.deepEqual(fs.readFileSync(path.join(f.repo,'.git/index')),index);
  assert.ok(git(f.repo,'branch','--list','feat/finish'));assert.equal(typeof f.p.pageRunOutput(after.pageRuns[0]),'string');
});

test('page deletion rejects active/stale pages and terminals, and rolls back a failed save',async t=>{
  const f=await fixture(t);let page=f.p.settings.workPages[0];
  await assert.rejects(f.p.deleteWorkPage({...page}),/Archive this page/);
  page.archived=true;await f.p.saveSettings();const before=fs.readFileSync(f.file),expected=JSON.parse(JSON.stringify(page));
  await assert.rejects(f.p.deleteWorkPage({...expected,name:'stale name'}),/Page changed/);
  f.p.settings.pageTerminalClaims=[{id:'terminal',pageId:'page',directory:f.worktree,createdAt:new Date().toISOString()}];
  await assert.rejects(f.p.deleteWorkPage(expected),/terminals/);f.p.settings.pageTerminalClaims=[];
  const save=f.p.saveSettings.bind(f.p);f.p.saveSettings=async()=>{throw Error('save failed');};
  await assert.rejects(f.p.deleteWorkPage(expected),/save failed/);
  assert.deepEqual(fs.readFileSync(f.file),before);assert.equal(f.p.settings.workPages[0].id,'page');
  f.p.saveSettings=save;await f.p.deleteWorkPage(expected);assert.equal(f.read().workPages.length,0);assert.ok(fs.existsSync(f.worktree));
});

test('unloading during page deletion waits for its published save before releasing ownership',async t=>{
  const f=await fixture(t),page=f.p.settings.workPages[0];page.archived=true;await f.p.saveSettings();
  const save=f.p.saveSettings.bind(f.p);let entered,release;
  const reached=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);
  f.p.saveSettings=async(...args)=>{await save(...args);entered();await gate;};
  const deleting=f.p.deleteWorkPage({...page});await reached;
  const stopping=f.p.onunload();assert.ok(fs.existsSync(path.join(f.dir,'runtime/execution.lock')));
  release();await deleting;await stopping;
  assert.equal(f.read().workPages.length,0);assert.equal(fs.existsSync(path.join(f.dir,'runtime/execution.lock')),false);assert.ok(fs.existsSync(f.worktree));
});

test('page deletion retains execution history and worktree removal evidence',async t=>{
  const f=await fixture(t);await f.p.runWorkPage('page','w',false);
  let review=await f.review();await f.p.finishWorkPage('page',review.hash,false,false);
  const before=f.read();await assert.rejects(f.p.deleteWorkPage({...f.p.settings.workPages[0]}),/run history/);assert.deepEqual(f.read(),before);
  const g=await fixture(t);review=await g.review();await g.p.finishWorkPage('page',review.hash,true,true);
  const retained=g.read();await assert.rejects(g.p.deleteWorkPage({...g.p.settings.workPages[0]}),/removal evidence/);assert.deepEqual(g.read(),retained);
});

test('archive preserves dirty and ignored files, branch and global definitions',async t=>{
  const f=await fixture(t);fs.appendFileSync(path.join(f.worktree,'tracked.txt'),'edit');fs.writeFileSync(path.join(f.worktree,'.env'),'private');
  const before=f.read(),review=await f.review();assert.equal(review.archiveBlockers.length,0);assert.ok(review.removalBlockers.length);
  await f.p.finishWorkPage('page',review.hash,false,false);
  const after=f.read();assert.equal(after.workPages[0].archived,true);assert.equal(after.workPages[0].worktreeRemoval,undefined);
  assert.equal(fs.readFileSync(path.join(f.worktree,'.env'),'utf8'),'private');assert.equal(git(f.worktree,'branch','--show-current'),'feat/finish');
  assert.deepEqual(after.tasks,before.tasks);assert.deepEqual(after.workflows,before.workflows);
});

test('clean worktree removal keeps unmerged commits, history and Main workspace; runtime cannot reuse the removed page',async t=>{
  const f=await fixture(t);await f.p.runWorkPage('page','w',false);
  fs.writeFileSync(path.join(f.worktree,'tracked.txt'),'feature');git(f.worktree,'add','.');git(f.worktree,'commit','-m','unmerged');
  const head=git(f.worktree,'rev-parse','HEAD'),before=f.read(),review=await f.review();assert.equal(review.removalBlockers.length,0);
  const index=fs.readFileSync(path.join(f.repo,'.git/index')),mainHead=git(f.repo,'rev-parse','HEAD');
  await f.p.finishWorkPage('page',review.hash,true,true);
  const after=f.read();assert.equal(after.workPages[0].worktreeRemoval.status,'removed');assert.equal(after.workPages[0].archived,true);
  assert.equal(fs.existsSync(f.worktree),false);assert.equal(git(f.repo,'rev-parse','refs/heads/feat/finish'),head);
  assert.equal(fs.readFileSync(path.join(f.repo,'tracked.txt'),'utf8'),'base');assert.deepEqual(after.workflows,before.workflows);
  assert.deepEqual(after.pageRuns,before.pageRuns);assert.equal(after.pageRuns.length,1);assert.equal(typeof f.p.pageRunOutput(after.pageRuns[0]),'string');
  assert.deepEqual(fs.readFileSync(path.join(f.repo,'.git/index')),index);assert.equal(git(f.repo,'rev-parse','HEAD'),mainHead);
  await assert.rejects(runtime.runInstalledWorkflow({vault:f.vault,workflowId:'w',pageId:'page',lease:f.p.pluginExecutionLease,redact:s=>s}),/removed/);
  assert.equal(fs.existsSync(path.join(f.vault,'effect.txt')),false);
});

test('stale review, ignored files and locked worktrees never trigger removal',async t=>{
  const f=await fixture(t),review=await f.review();
  fs.writeFileSync(path.join(f.worktree,'.env'),'keep');
  await assert.rejects(f.p.finishWorkPage('page',review.hash,true,true),/changed/);assert.ok(fs.existsSync(f.worktree));
  assert.equal(f.read().workPages[0].worktreeRemoval,undefined);
  fs.unlinkSync(path.join(f.worktree,'.env'));git(f.repo,'worktree','lock',f.worktree);
  const locked=await f.review();assert.ok(locked.removalBlockers.some(s=>/locked/.test(s)));
  await assert.rejects(f.p.finishWorkPage('page',locked.hash,true,true),/locked/);
  assert.match(git(f.repo,'worktree','list','--porcelain'),/locked/);
  git(f.repo,'worktree','unlock',f.worktree);git(f.worktree,'checkout','-b','feat/changed');
  const changed=await f.review();assert.ok(changed.removalBlockers.some(s=>/branch changed/.test(s)));
  await assert.rejects(f.p.finishWorkPage('page',review.hash,true,true),/changed/);assert.ok(fs.existsSync(f.worktree));
});

test('main folder, nested page, protected default folder and hidden index flags block removal',async t=>{
  const f=await fixture(t);
  await assert.rejects(helper.inspectWorktreeRemoval({...f.page,directory:f.repo},[],[]),/main Git/);
  await assert.rejects(helper.inspectWorktreeRemoval(f.page,[f.worktree],[]),/Main workspace/);
  await assert.rejects(helper.inspectWorktreeRemoval(f.page,[],[{...f.page,id:'alias'}]),/Another page/);
  git(f.worktree,'update-index','--assume-unchanged','tracked.txt');fs.appendFileSync(path.join(f.worktree,'tracked.txt'),'hidden');
  assert.ok((await f.review()).removalBlockers.some(s=>/Index flags/.test(s)));assert.ok(fs.existsSync(f.worktree));
});

test('pending write failure preserves the worktree and releases only preparation ownership',async t=>{
  const f=await fixture(t),review=await f.review(),before=fs.readFileSync(f.file),save=f.p.saveSettings.bind(f.p);
  f.p.saveSettings=async()=>{throw Error('save rejected');};
  await assert.rejects(f.p.finishWorkPage('page',review.hash,true,true),/save rejected/);
  assert.deepEqual(fs.readFileSync(f.file),before);assert.ok(fs.existsSync(f.worktree));assert.equal(f.p.pagePreparation,false);
  f.p.saveSettings=save;await f.p.finishWorkPage('page',review.hash,false,false);assert.equal(f.read().workPages[0].archived,true);
});

test('final save failure keeps a durable pending record; a new owner can verify completed removal without replay',async t=>{
  const f=await fixture(t),review=await f.review(),save=f.p.saveSettings.bind(f.p);
  f.p.saveSettings=async(...args)=>{if(f.p.settings.workPages[0].worktreeRemoval?.status==='removed')throw Error('final save rejected');return save(...args);};
  await assert.rejects(f.p.finishWorkPage('page',review.hash,true,true),/final save rejected/);
  assert.equal(f.read().workPages[0].worktreeRemoval.status,'pending');assert.equal(fs.existsSync(f.worktree),false);
  f.p.releasePluginExecution(false);const next=await f.open();await next.finishWorkPage('page','check-removal',false,false);
  assert.equal(f.read().workPages[0].worktreeRemoval.status,'removed');assert.equal(git(f.repo,'rev-parse','refs/heads/feat/finish'),review.proof.head);
});

test('a late write is caught after pending publication; checking the same owner keeps the folder without retrying',async t=>{
  const f=await fixture(t),review=await f.review(),save=f.p.saveSettings.bind(f.p);
  f.p.saveSettings=async(...args)=>{await save(...args);if(f.p.settings.workPages[0].worktreeRemoval?.status==='pending')fs.writeFileSync(path.join(f.worktree,'late.txt'),'keep');};
  await assert.rejects(f.p.finishWorkPage('page',review.hash,true,true),/modified, untracked or ignored/);
  assert.equal(f.read().workPages[0].worktreeRemoval.status,'pending');f.p.saveSettings=save;
  await f.p.finishWorkPage('page','check-removal',false,false);
  assert.equal(f.read().workPages[0].worktreeRemoval,undefined);assert.equal(f.read().workPages[0].archived,true);
  assert.equal(fs.readFileSync(path.join(f.worktree,'late.txt'),'utf8'),'keep');
});

test('a new owner needs explicit review before keeping an intact worktree and never repeats removal',async t=>{
  const f=await fixture(t),review=await f.review(),save=f.p.saveSettings.bind(f.p);
  f.p.saveSettings=async(...args)=>{await save(...args);if(f.p.settings.workPages[0].worktreeRemoval?.status==='pending')fs.writeFileSync(path.join(f.worktree,'late.txt'),'keep');};
  await assert.rejects(f.p.finishWorkPage('page',review.hash,true,true));f.p.releasePluginExecution(false);
  const next=await f.open();await assert.rejects(next.finishWorkPage('page','check-removal',false,false),/previous owner/);
  assert.equal(f.read().workPages[0].worktreeRemoval.status,'pending');assert.ok(fs.existsSync(f.worktree));
  await next.finishWorkPage('page','check-removal',false,true);
  assert.equal(f.read().workPages[0].worktreeRemoval,undefined);assert.equal(f.read().workPages[0].archived,true);
  assert.equal(fs.readFileSync(path.join(f.worktree,'late.txt'),'utf8'),'keep');
});

test('tracked terminals, uncertain sessions and missing execution evidence block finishing',async t=>{
  const f=await fixture(t);
  f.p.cliTerminals={sessions:[{exited:false}]};assert.ok((await f.review()).archiveBlockers.some(s=>/terminals/.test(s)));
  const review=await f.review();await assert.rejects(f.p.finishWorkPage('page',review.hash,false,false),/terminals/);
  f.p.cliTerminals=undefined;f.p.settings.pageTerminalClaims=[{id:'claim',pageId:'page',directory:f.worktree,createdAt:new Date().toISOString()}];
  await assert.rejects(f.p.finishWorkPage('page',review.hash,true,true),/terminals/);
  f.p.settings.pageTerminalClaims=[];f.p.settings.pageRuns=[{pageId:'page',sourceId:'w',task:false,runId:'aabb',workflowId:'@page:page:workflow:w',name:'Missing evidence',phase:'ready',revision:1,createdAt:new Date().toISOString(),uncertain:true}];
  assert.ok((await f.review()).archiveBlockers.some(s=>/evidence is missing/.test(s)));assert.ok(fs.existsSync(f.worktree));
});

test('plugin unload during pending publication retains ownership until the operation drains and never starts removal',async t=>{
  const f=await fixture(t),review=await f.review(),save=f.p.saveSettings.bind(f.p);
  let entered,release;const reached=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
  f.p.saveSettings=async(...args)=>{await save(...args);entered();await gate;};
  const operation=f.p.finishWorkPage('page',review.hash,true,true),failed=assert.rejects(operation,/closed|stopped/i);
  await reached;assert.throws(()=>f.p.assertExecutionIdle(),/Active execution/);
  const unloading=f.p.onunload();assert.ok(fs.existsSync(path.join(f.dir,'runtime/execution.lock')));
  release();await failed;await unloading;
  assert.ok(fs.existsSync(f.worktree));assert.equal(f.read().workPages[0].worktreeRemoval.status,'pending');
});
