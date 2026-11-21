const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const build=require('esbuild').buildSync({entryPoints:[path.join(__dirname,'../merge-review.ts')],bundle:true,platform:'node',format:'cjs',write:false});
const loaded={exports:{}};new Function('require','module','exports',build.outputFiles[0].text)(require,loaded,loaded.exports);
const {reviewPageMerge,executePageMerge,parseMergePreview,mergeEditorUri}=loaded.exports;
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
function fixture(t) {
  const root=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'autooc-merge-')));
  const original={global:process.env.GIT_CONFIG_GLOBAL,system:process.env.GIT_CONFIG_NOSYSTEM};
  process.env.GIT_CONFIG_GLOBAL=path.join(root,'empty-config');process.env.GIT_CONFIG_NOSYSTEM='1';fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL,'');
  const repo=path.join(root,"target ' space $(echo nope)"),source=path.join(root,'source');fs.mkdirSync(repo);
  git(repo,'init','-b','main');git(repo,'config','user.name','Test');git(repo,'config','user.email','test@example.invalid');git(repo,'config','core.editor','true');
  fs.writeFileSync(path.join(repo,'file.txt'),'base\n');git(repo,'add','.');git(repo,'commit','-m','base');git(repo,'worktree','add','-b','feat/test',source);
  const page={id:'page',name:'Test',objective:'',kind:'worktree',directory:fs.realpathSync(source),repository:fs.realpathSync(repo),branch:'feat/test',taskIds:[],workflowIds:[]};
  t.after(()=>{
    for(const [key,value] of [['GIT_CONFIG_GLOBAL',original.global],['GIT_CONFIG_NOSYSTEM',original.system]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}
    assert.equal(path.dirname(fs.realpathSync.native(root)),fs.realpathSync.native(os.tmpdir()));assert.match(path.basename(root),/^autooc-merge-/);fs.rmSync(root,{recursive:true,force:true});
  });
  function commit(cwd,file,text){fs.writeFileSync(path.join(cwd,file),text);git(cwd,'add','--',file);git(cwd,'commit','-m','change '+file);}
  return {root,repo,source,page,commit,review:target=>reviewPageMerge(page,target),
    execute:(review,action,confirmed=false,assertCurrent=()=>{})=>executePageMerge(page,review.target.directory,review.hash,action,assertCurrent,confirmed)};
}

test('integration is verified before dirty files and active sessions; no repeat merge or configuration commit',async t=>{
  const f=fixture(t);f.commit(f.source,'feature.txt','done');git(f.repo,'merge','--ff-only','feat/test');
  const local='.obsidian/plugins/auto-oc/data.json';fs.mkdirSync(path.dirname(path.join(f.source,local)),{recursive:true});
  fs.writeFileSync(path.join(f.source,local),'private settings');fs.writeFileSync(path.join(f.repo,'untracked.txt'),'keep');
  fs.appendFileSync(path.join(f.source,'file.txt'),'pending product edit');
  const before=[git(f.repo,'rev-parse','HEAD'),git(f.source,'rev-parse','HEAD'),git(f.repo,'ls-files','--stage'),git(f.source,'ls-files','--stage')];
  const r=await reviewPageMerge(f.page,undefined,['Main helper running']);
  assert.equal(r.integration,'verified');assert.equal(r.state,'integrated');assert.match(r.details,/No repeated merge/);
  assert.equal(r.sourceFiles.find(x=>x.path===local).category,'local-configuration');
  assert.equal(r.sourceFiles.find(x=>x.path==='file.txt').category,'project');assert.ok(r.targetFiles.some(x=>x.path==='untracked.txt'));
  await assert.rejects(f.execute(r,'start'));
  const noActivity=await f.review();await assert.rejects(f.execute(noActivity,'start'),/Recheck/);
  assert.deepEqual([git(f.repo,'rev-parse','HEAD'),git(f.source,'rev-parse','HEAD'),git(f.repo,'ls-files','--stage'),git(f.source,'ls-files','--stage')],before);
  assert.equal(fs.readFileSync(path.join(f.source,local),'utf8'),'private settings');
  f.commit(f.source,'later.txt','not integrated');assert.equal((await f.review()).integration,'not-integrated');
});

test('pending file parsing preserves NUL-delimited rename paths and rejects incomplete evidence',()=>{
  const build=require('esbuild').buildSync({entryPoints:[path.join(__dirname,'../worktree-changes.ts')],bundle:true,platform:'node',format:'cjs',write:false});
  const mod={exports:{}};new Function('require','module','exports',build.outputFiles[0].text)(require,mod,mod.exports);
  const parse=mod.exports.parseWorktreeStatus;
  const files=parse(' M .obsidian/plugins/auto-oc/data.json\0R  new name.ts\0old name.ts\0?? .env.example\0!! .env.local\0R  .obsidian/moved.ts\0product.ts\0');
  assert.equal(files.length,5);assert.equal(files[0].indexStatus,' ');assert.equal(files[0].category,'local-configuration');
  assert.equal(files[1].originalPath,'old name.ts');assert.equal(files[1].path,'new name.ts');
  assert.equal(files[2].category,'project');assert.equal(files[3].category,'local-configuration');assert.equal(files[4].category,'project');
  assert.throws(()=>parse('R  destination\0'),/Incomplete/);assert.throws(()=>parse(' M unfinished'),/Incomplete/);
});

test('direct merge preserves preview, stops before commit even for fast-forward and verifies ancestry after completion',async t=>{
  const f=fixture(t);f.commit(f.source,'new.txt','feature\n');
  const before=[git(f.repo,'rev-parse','HEAD'),git(f.repo,'status','--porcelain'),git(f.repo,'ls-files','--stage')];
  let r=await f.review();assert.equal(r.state,'ready');assert.equal(r.target.branch,'main');assert.equal(r.targets.length,1);
  assert.deepEqual([git(f.repo,'rev-parse','HEAD'),git(f.repo,'status','--porcelain'),git(f.repo,'ls-files','--stage')],before);
  await f.execute(r,'start');assert.equal(git(f.repo,'rev-parse','HEAD'),before[0]);
  r=await f.review();assert.equal(r.state,'resolved');assert.equal(r.inProgress,true);
  await f.execute(r,'complete');r=await f.review();assert.equal(r.state,'integrated');assert.equal(r.inProgress,false);
  assert.equal(git(f.repo,'rev-list','--parents','-n','1','HEAD').split(' ').length,3);
  await assert.rejects(f.execute(r,'abort',true),/Recheck/);assert.equal(fs.readFileSync(path.join(f.repo,'new.txt'),'utf8'),'feature\n');
});

test('conflicts distinguish predicted files from actual unresolved entries, staging and completion',async t=>{
  const f=fixture(t);f.commit(f.source,'file.txt','incoming\n');f.commit(f.repo,'file.txt','current\n');
  let r=await f.review();assert.equal(r.state,'conflicts');assert.equal(r.inProgress,false);assert.deepEqual(r.conflicts,['file.txt']);assert.match(r.details,/CONFLICT/);
  const started=await f.execute(r,'start');assert.match(started.output,/CONFLICT/);
  r=await f.review();assert.equal(r.state,'conflicts');assert.equal(r.inProgress,true);assert.deepEqual(r.conflicts,['file.txt']);
  await assert.rejects(f.execute(r,'complete'),/Recheck/);
  fs.writeFileSync(path.join(f.repo,'file.txt'),'both reviewed\n');assert.equal((await f.review()).state,'conflicts');
  git(f.repo,'add','file.txt');r=await f.review();assert.equal(r.state,'resolved');
  await f.execute(r,'complete');assert.equal((await f.review()).state,'integrated');
});

test('direct abort requires explicit confirmation and cancels only the reviewed merge',async t=>{
  const f=fixture(t);f.commit(f.source,'new.txt','new\n');const r=await f.review();await f.execute(r,'start');
  const pending=await f.review();await f.review();assert.equal(git(f.repo,'rev-parse','MERGE_HEAD'),pending.source.head);
  await assert.rejects(f.execute(pending,'abort'),/Confirm/);
  await f.execute(pending,'abort',true);assert.equal((await f.review()).state,'ready');assert.equal(fs.existsSync(path.join(f.repo,'new.txt')),false);
  await assert.rejects(f.execute(pending,'abort',true),/changed|Recheck/);assert.equal(git(f.repo,'branch','--show-current'),'main');
});

test('direct actions reject stale refs, active ownership, dirty files and duplicate execution',async t=>{
  const f=fixture(t);f.commit(f.source,'new.txt','new');let r=await f.review();
  f.commit(f.source,'next.txt','next');await assert.rejects(f.execute(r,'start'),/changed/);
  r=await f.review();await assert.rejects(f.execute(r,'start',false,()=>{throw Error('Owner lost');}),/Owner lost/);
  fs.writeFileSync(path.join(f.repo,'untracked'),'keep');await assert.rejects(f.execute(r,'start'),/changed|Recheck/);
  fs.unlinkSync(path.join(f.repo,'untracked'));r=await f.review();
  const first=f.execute(r,'start');await assert.rejects(f.execute(r,'start'),/already running/);await first;
  await assert.rejects(f.execute(r,'start'),/changed/);assert.equal(git(f.repo,'rev-parse','MERGE_HEAD'),r.source.head);
});

test('staged content and unstaged resolution edits are bound to the reviewed merge',async t=>{
  const f=fixture(t);f.commit(f.source,'new.txt','new');await f.execute(await f.review(),'start');
  const staged=await f.review();fs.writeFileSync(path.join(f.repo,'new.txt'),'review me');git(f.repo,'add','new.txt');
  assert.notEqual((await f.review()).hash,staged.hash);await assert.rejects(f.execute(staged,'complete'),/changed/);
  fs.writeFileSync(path.join(f.repo,'new.txt'),'not staged');let r=await f.review();
  assert.ok(r.completionBlockers.length);await assert.rejects(f.execute(r,'complete'),/stage/);
  fs.writeFileSync(path.join(f.repo,'new.txt'),'different unstaged');await assert.rejects(f.execute(r,'abort',true),/changed/);
  git(f.repo,'add','new.txt');await f.execute(await f.review(),'complete');assert.equal((await f.review()).state,'integrated');
});

test('direct merge blocks ignored collisions before any mutation',async t=>{
  const f=fixture(t);f.commit(f.repo,'.gitignore','ignored.txt\n');f.commit(f.source,'ignored.txt','incoming');
  fs.writeFileSync(path.join(f.repo,'ignored.txt'),'preserve');const r=await f.review();
  assert.equal(r.state,'blocked');assert.match(r.blockers.join(),/ignored target files/);
  await assert.rejects(f.execute(r,'start'),/Recheck/);assert.equal(fs.readFileSync(path.join(f.repo,'ignored.txt'),'utf8'),'preserve');
  fs.unlinkSync(path.join(f.repo,'ignored.txt'));await f.execute(await f.review(),'start');
  await f.execute(await f.review(),'complete');assert.equal(fs.readFileSync(path.join(f.repo,'ignored.txt'),'utf8'),'incoming');
});

test('Git commit failure preserves the pending merge and requires an explicit new action',async t=>{
  const f=fixture(t);f.commit(f.source,'new.txt','new');await f.execute(await f.review(),'start');
  const before=git(f.repo,'rev-parse','HEAD');git(f.repo,'config','user.name','');
  await assert.rejects(f.execute(await f.review(),'complete'),/Git did not complete/);
  assert.equal(git(f.repo,'rev-parse','HEAD'),before);assert.equal((await f.review()).state,'resolved');
  git(f.repo,'config','user.name','Test');await f.execute(await f.review(),'complete');assert.equal((await f.review()).state,'integrated');
});

test('repository hooks are honored when completing a merge',async t=>{
  const f=fixture(t);f.commit(f.source,'new.txt','new');await f.execute(await f.review(),'start');
  const before=git(f.repo,'rev-parse','HEAD'),hook=path.join(f.repo,'.git/hooks/pre-commit');
  fs.writeFileSync(hook,'#!/bin/sh\necho hook-rejected >&2\nexit 1\n',{mode:0o755});
  let failure;try{await f.execute(await f.review(),'complete');}catch(error){failure=error;}
  assert.equal(git(f.repo,'rev-parse','HEAD'),before);assert.equal((await f.review()).state,'resolved');
  if(process.platform==='win32'&&/NtCreateDirectoryObject.*0xC0000022/.test(failure?.message || '')) {
    t.skip('Git for Windows shell cannot create its MSYS object in this sandbox; native hook not verified.');return;
  }
  assert.match(failure?.message || '',/hook-rejected/);
});

test('dirty files, execution blockers, hidden index flags and source operations prevent readiness',async t=>{
  const f=fixture(t);f.commit(f.source,'new.txt','new');
  fs.writeFileSync(path.join(f.source,'untracked'),'x');let r=await f.review();assert.equal(r.state,'blocked');assert.match(r.blockers.join(),/source changes/);fs.unlinkSync(path.join(f.source,'untracked'));
  fs.writeFileSync(path.join(f.repo,'untracked'),'x');r=await f.review();assert.equal(r.state,'blocked');assert.match(r.blockers.join(),/target changes/);fs.unlinkSync(path.join(f.repo,'untracked'));
  r=await reviewPageMerge(f.page,undefined,['Active execution']);assert.equal(r.state,'blocked');await assert.rejects(f.execute(r,'start'));
  git(f.repo,'update-index','--assume-unchanged','file.txt');assert.match((await f.review()).blockers.join(),/hidden index/);git(f.repo,'update-index','--no-assume-unchanged','file.txt');
  const op=path.resolve(f.source,git(f.source,'rev-parse','--git-path','CHERRY_PICK_HEAD'));fs.writeFileSync(op,git(f.source,'rev-parse','HEAD')+'\n');assert.match((await f.review()).blockers.join(),/Git operation in the source/);
});

test('unrelated ongoing merge is blocked and cannot offer complete or abort commands',async t=>{
  const f=fixture(t);f.commit(f.source,'new.txt','new');git(f.repo,'branch','other');
  git(f.source,'switch','other');f.commit(f.source,'other.txt','other');git(f.source,'switch','feat/test');
  git(f.repo,'merge','--no-ff','--no-commit','other');const r=await f.review();assert.equal(r.state,'blocked');assert.match(r.blockers.join(),/different commit/);await assert.rejects(f.execute(r,'abort',true));
});

test('direct actions reject changed target branches, source commits and working files',async t=>{
  const f=fixture(t);f.commit(f.source,'new.txt','new');const r=await f.review();
  git(f.repo,'switch','-c','different');await assert.rejects(f.execute(r,'start'));git(f.repo,'switch','main');
  f.commit(f.source,'next.txt','next');await assert.rejects(f.execute(r,'start'));
  const fresh=await f.review();fs.writeFileSync(path.join(f.repo,'untracked'),'keep');await assert.rejects(f.execute(fresh,'start'));assert.equal(fs.existsSync(path.join(f.repo,'new.txt')),false);
});

test('custom drivers and renormalization never execute during automatic preview',async t=>{
  const f=fixture(t);f.commit(f.source,'file.txt','incoming\n');f.commit(f.repo,'file.txt','current\n');
  f.commit(f.repo,'.gitattributes','*.txt merge=external\n');
  const marker=path.join(f.root,'driver-ran');git(f.repo,'config','merge.external.driver',`echo ran > "${marker.replace(/\\/g,'/')}"`);
  const r=await f.review();assert.equal(r.state,'unavailable');assert.match(r.details,/custom merge drivers/);assert.equal(fs.existsSync(marker),false);
  git(f.repo,'config','--unset','merge.external.driver');git(f.repo,'config','merge.renormalize','true');assert.equal((await f.review()).state,'unavailable');
});

test('target selection excludes source and locked worktrees; folder, wrong repo and moved source are rejected',async t=>{
  const f=fixture(t);f.commit(f.source,'new.txt','new');const third=path.join(f.root,'third');git(f.repo,'worktree','add','-b','third',third);
  git(f.repo,'worktree','add','--force',path.join(f.root,'same-branch'),'feat/test');
  assert.equal((await f.review()).targets.length,2);assert.equal((await f.review(fs.realpathSync(third))).target.branch,'third');
  git(f.repo,'worktree','lock',third);assert.equal((await f.review()).targets.length,1);await assert.rejects(f.review(fs.realpathSync(third)),/no longer/);
  await assert.rejects(f.review(f.page.directory),/no longer/);await assert.rejects(reviewPageMerge({...f.page,kind:'folder'}),/independent/);
  git(f.source,'switch','-c','moved');await assert.rejects(f.review(),/branch changed/);
});

test('NUL parser preserves unusual paths and conflicted exit status without file stages; editor URIs cannot escape',async t=>{
  const f=fixture(t),oid='a'.repeat(40);
  assert.deepEqual(parseMergePreview(oid+'\0name\nwith\ttabs\0\0',1).conflicts,['name\nwith\ttabs']);
  assert.equal(parseMergePreview(oid+'\0\0',1).state,'conflicts');assert.equal(parseMergePreview(oid+'\0',0).state,'ready');
  assert.throws(()=>parseMergePreview('bad output',1),/Unsupported/);
  assert.throws(()=>mergeEditorUri(f.repo,'../outside'),/outside/);assert.match(mergeEditorUri(f.repo,'file #?.txt'),/file%20%23%3F.txt$/);
  const uri=new URL(mergeEditorUri(f.repo));assert.equal(decodeURIComponent(uri.pathname),(process.platform==='win32'?'/':'')+fs.realpathSync(f.repo).replace(/\\/g,'/')+'/');
});
