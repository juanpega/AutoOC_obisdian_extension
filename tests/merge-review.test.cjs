const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const build=require('esbuild').buildSync({entryPoints:[path.join(__dirname,'../merge-review.ts')],bundle:true,platform:'node',format:'cjs',write:false});
const loaded={exports:{}};new Function('require','module','exports',build.outputFiles[0].text)(require,loaded,loaded.exports);
const {reviewPageMerge,parseMergePreview,mergeReviewCommand,mergeEditorUri}=loaded.exports;
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-merge-'));
  const original={global:process.env.GIT_CONFIG_GLOBAL,system:process.env.GIT_CONFIG_NOSYSTEM};
  process.env.GIT_CONFIG_GLOBAL=path.join(root,'empty-config');process.env.GIT_CONFIG_NOSYSTEM='1';fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL,'');
  const repo=path.join(root,"target ' space $(echo nope)"),source=path.join(root,'source');fs.mkdirSync(repo);
  git(repo,'init','-b','main');git(repo,'config','user.name','Test');git(repo,'config','user.email','test@example.invalid');git(repo,'config','core.editor','true');
  fs.writeFileSync(path.join(repo,'file.txt'),'base\n');git(repo,'add','.');git(repo,'commit','-m','base');git(repo,'worktree','add','-b','feat/test',source);
  const page={id:'page',name:'Test',objective:'',kind:'worktree',directory:fs.realpathSync(source),repository:fs.realpathSync(repo),branch:'feat/test',taskIds:[],workflowIds:[]};
  t.after(()=>{
    for(const [key,value] of [['GIT_CONFIG_GLOBAL',original.global],['GIT_CONFIG_NOSYSTEM',original.system]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}
    assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));assert.match(path.basename(root),/^autooc-merge-/);fs.rmSync(root,{recursive:true,force:true});
  });
  function commit(cwd,file,text){fs.writeFileSync(path.join(cwd,file),text);git(cwd,'add','--',file);git(cwd,'commit','-m','change '+file);}
  function script(command){const file=path.join(root,process.platform==='win32'?'review.ps1':'review.sh');fs.writeFileSync(file,(process.platform==='win32'?'\uFEFF':'')+command);return execFileSync(process.platform==='win32'?'powershell.exe':'sh',process.platform==='win32'?['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',file]:[file],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']});}
  return {root,repo,source,page,commit,script,review:target=>reviewPageMerge(page,target)};
}

test('preview preserves refs, index and files; clean merge handoff stops before commit and verifies ancestry afterwards',async t=>{
  const f=fixture(t);f.commit(f.source,'new.txt','feature\n');
  const before=[git(f.repo,'rev-parse','HEAD'),git(f.repo,'status','--porcelain'),git(f.repo,'ls-files','--stage')];
  let r=await f.review();assert.equal(r.state,'ready');assert.equal(r.target.branch,'main');assert.equal(r.targets.length,1);
  assert.deepEqual([git(f.repo,'rev-parse','HEAD'),git(f.repo,'status','--porcelain'),git(f.repo,'ls-files','--stage')],before);
  f.script(mergeReviewCommand(r,'start'));assert.equal(git(f.repo,'rev-parse','HEAD'),before[0]);
  r=await f.review();assert.equal(r.state,'resolved');assert.equal(r.inProgress,true);
  f.script(mergeReviewCommand(r,'complete'));r=await f.review();assert.equal(r.state,'integrated');assert.equal(r.inProgress,false);
  assert.throws(()=>mergeReviewCommand(r,'abort'),/Recheck/);assert.equal(fs.readFileSync(path.join(f.repo,'new.txt'),'utf8'),'feature\n');
});

test('conflicts distinguish predicted files from actual unresolved entries, staging and completion',async t=>{
  const f=fixture(t);f.commit(f.source,'file.txt','incoming\n');f.commit(f.repo,'file.txt','current\n');
  let r=await f.review();assert.equal(r.state,'conflicts');assert.equal(r.inProgress,false);assert.deepEqual(r.conflicts,['file.txt']);assert.match(r.details,/CONFLICT/);
  try{f.script(mergeReviewCommand(r,'start'));}catch{} // git merge reports conflicts with exit 1.
  r=await f.review();assert.equal(r.state,'conflicts');assert.equal(r.inProgress,true);assert.deepEqual(r.conflicts,['file.txt']);
  assert.throws(()=>mergeReviewCommand(r,'complete'),/Recheck/);
  fs.writeFileSync(path.join(f.repo,'file.txt'),'both reviewed\n');assert.equal((await f.review()).state,'conflicts');
  git(f.repo,'add','file.txt');r=await f.review();assert.equal(r.state,'resolved');
  f.script(mergeReviewCommand(r,'complete'));assert.equal((await f.review()).state,'integrated');
});

test('abort handoff cancels only the reviewed merge; closing/rechecking alone never aborts',async t=>{
  const f=fixture(t);f.commit(f.source,'new.txt','new\n');const r=await f.review();f.script(mergeReviewCommand(r,'start'));
  const pending=await f.review();await f.review();assert.equal(git(f.repo,'rev-parse','MERGE_HEAD'),pending.source.head);
  f.script(mergeReviewCommand(pending,'abort'));assert.equal((await f.review()).state,'ready');assert.equal(fs.existsSync(path.join(f.repo,'new.txt')),false);
  assert.throws(()=>f.script(mergeReviewCommand(pending,'abort')));assert.equal(git(f.repo,'branch','--show-current'),'main');
});

test('dirty files, execution blockers, hidden index flags and source operations prevent readiness',async t=>{
  const f=fixture(t);f.commit(f.source,'new.txt','new');
  fs.writeFileSync(path.join(f.source,'untracked'),'x');let r=await f.review();assert.equal(r.state,'blocked');assert.match(r.blockers.join(),/source changes/);fs.unlinkSync(path.join(f.source,'untracked'));
  fs.writeFileSync(path.join(f.repo,'untracked'),'x');r=await f.review();assert.equal(r.state,'blocked');assert.match(r.blockers.join(),/target changes/);fs.unlinkSync(path.join(f.repo,'untracked'));
  r=await reviewPageMerge(f.page,undefined,['Active execution']);assert.equal(r.state,'blocked');assert.throws(()=>mergeReviewCommand(r,'start'));
  git(f.repo,'update-index','--assume-unchanged','file.txt');assert.match((await f.review()).blockers.join(),/hidden index/);git(f.repo,'update-index','--no-assume-unchanged','file.txt');
  const op=path.resolve(f.source,git(f.source,'rev-parse','--git-path','CHERRY_PICK_HEAD'));fs.writeFileSync(op,git(f.source,'rev-parse','HEAD')+'\n');assert.match((await f.review()).blockers.join(),/Git operation in the source/);
});

test('unrelated ongoing merge is blocked and cannot offer complete or abort commands',async t=>{
  const f=fixture(t);f.commit(f.source,'new.txt','new');git(f.repo,'branch','other');
  git(f.source,'switch','other');f.commit(f.source,'other.txt','other');git(f.source,'switch','feat/test');
  git(f.repo,'merge','--no-ff','--no-commit','other');const r=await f.review();assert.equal(r.state,'blocked');assert.match(r.blockers.join(),/different commit/);assert.throws(()=>mergeReviewCommand(r,'abort'));
});

test('copied commands reject changed branches, source commits and working files',async t=>{
  const f=fixture(t);f.commit(f.source,'new.txt','new');const r=await f.review(),cmd=mergeReviewCommand(r,'start');
  git(f.repo,'switch','-c','different');assert.throws(()=>f.script(cmd));git(f.repo,'switch','main');
  f.commit(f.source,'next.txt','next');assert.throws(()=>f.script(cmd));
  const fresh=await f.review();fs.writeFileSync(path.join(f.repo,'untracked'),'keep');assert.throws(()=>f.script(mergeReviewCommand(fresh,'start')));assert.equal(fs.existsSync(path.join(f.repo,'new.txt')),false);
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
