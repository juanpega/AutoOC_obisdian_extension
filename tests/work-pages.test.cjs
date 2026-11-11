const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const runtime=require('../autooc-runtime.cjs');
const build=require('esbuild').buildSync({entryPoints:[path.join(__dirname,'../work-pages.ts')],bundle:true,platform:'node',format:'cjs',write:false});
const helper={exports:{}};new Function('require','module','exports',build.outputFiles[0].text)(require,helper,helper.exports);
const pages=helper.exports;
function fixture(t) {
  // Persist canonical folders, just as the page creator does (macOS /var aliases, Windows casing).
  const vault=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'autooc-pages-')));
  const directory=path.join(vault,'.obsidian/plugins/auto-oc'),file=path.join(directory,'data.json');
  fs.mkdirSync(path.join(directory,'runtime'),{recursive:true});
  const a=path.join(vault,'a'),b=path.join(vault,'b');fs.mkdirSync(a);fs.mkdirSync(b);
  const workPages=[a,b].map((directory,i)=>({id:i?'b':'a',name:i?'B':'A',objective:'Goal '+i,directory,kind:'folder',workflowIds:['w'],taskIds:[]}));
  const workflow={id:'w',name:'Shared',steps:[{id:'write',stepKind:'code',codeAllowVault:true,code:'vault.append("effect.txt","once"); output="done";'}]};
  let settings={tasks:[],workflows:[workflow],workPages,custom:{preserved:1},defaultConcurrency:'parallel',maxConcurrentExecutions:3};
  fs.writeFileSync(file,JSON.stringify(settings));
  t.after(()=>{assert.equal(path.dirname(fs.realpathSync.native(vault)),fs.realpathSync.native(os.tmpdir()));assert.match(path.basename(vault),/^autooc-pages-/);fs.rmSync(vault,{force:true,recursive:true});});
  return {vault,directory,file,a,b,workPages,settings,write(){fs.writeFileSync(file,JSON.stringify(settings));},run(pageId,extra={}){return runtime.runInstalledWorkflow({vault,workflowId:'w',pageId,redact:s=>s,...extra});}};
}
const git=(cwd,...args)=>execFileSync('git',['-c','safe.directory='+cwd.replace(/\\/g,'/'),...args],{cwd,encoding:'utf8',windowsHide:true}).trim();

test('pages execute any catalog workflow without linking and preserve the Main catalog',async t=>{
  const f=fixture(t);for(const page of f.settings.workPages)page.workflowIds=[];f.write();
  const before=JSON.stringify(f.settings.workflows);await f.run('b');
  assert.equal(fs.readFileSync(path.join(f.b,'effect.txt'),'utf8'),'once');
  assert.equal(fs.existsSync(path.join(f.a,'effect.txt')),false);
  const saved=JSON.parse(fs.readFileSync(f.file));assert.equal(JSON.stringify(saved.workflows),before);
  assert.deepEqual(saved.workPages[1].workflowIds,[]);assert.equal(saved.pageRuns[0].pageId,'b');
});

test('diff preview includes staged and unstaged content, is read-only and covers unborn repositories',async t=>{
  const f=fixture(t),repo=f.a;git(repo,'init','-b','main');git(repo,'config','user.name','Test');git(repo,'config','user.email','test@example.invalid');
  fs.writeFileSync(path.join(repo,'file.txt'),'original\n');git(repo,'add','file.txt');
  let preview=await pages.pageChanges(f.workPages[0]);assert.match(preview,/\+original/);
  git(repo,'commit','-m','base');fs.writeFileSync(path.join(repo,'file.txt'),'staged\n');git(repo,'add','file.txt');
  fs.writeFileSync(path.join(repo,'file.txt'),'staged\nworking\n');const before=git(repo,'diff','--cached');
  preview=await pages.pageChanges(f.workPages[0]);assert.match(preview,/-original/);assert.match(preview,/\+staged/);assert.match(preview,/\+working/);
  assert.equal(git(repo,'diff','--cached'),before);assert.equal(git(repo,'branch','--show-current'),'main');
});

test('workspace Git inspection follows actual HEAD, including unborn and detached states, without writing',async t=>{
  const f=fixture(t),repo=f.a;
  assert.deepEqual(await pages.readWorkspaceGitState(repo),{kind:'no-repository'});
  git(repo,'init','-b','feat/unborn');
  assert.deepEqual(await pages.readWorkspaceGitState(repo),{kind:'branch',branch:'feat/unborn'});
  git(repo,'config','user.name','AutoOC test');git(repo,'config','user.email','test@example.invalid');
  fs.writeFileSync(path.join(repo,'tracked.txt'),'base');git(repo,'add','tracked.txt');git(repo,'commit','-m','fixture');
  git(repo,'switch','-c','fix/selected');
  const head=fs.readFileSync(path.join(repo,'.git/HEAD')),index=fs.readFileSync(path.join(repo,'.git/index'));
  assert.deepEqual(await pages.readWorkspaceGitState(repo),{kind:'branch',branch:'fix/selected'});
  assert.deepEqual(fs.readFileSync(path.join(repo,'.git/HEAD')),head);assert.deepEqual(fs.readFileSync(path.join(repo,'.git/index')),index);
  git(repo,'checkout','--detach');
  assert.deepEqual(await pages.readWorkspaceGitState(repo),{kind:'detached',commit:git(repo,'rev-parse','--short=8','HEAD')});
  await assert.rejects(pages.readWorkspaceGitState(path.join(repo,'missing')),/Git:/);
});

test('same global workflow writes to each page and preserves global results',async t=>{
  const f=fixture(t),original=JSON.stringify(f.settings.workflows);
  const a=await f.run('a'),b=await f.run('b');
  assert.equal(a.phase,'completed');assert.equal(b.phase,'completed');assert.notEqual(a.runId,b.runId);assert.notEqual(a.workflowId,b.workflowId);
  assert.equal(fs.readFileSync(path.join(f.a,'effect.txt'),'utf8'),'once');assert.equal(fs.readFileSync(path.join(f.b,'effect.txt'),'utf8'),'once');
  assert.equal(fs.existsSync(path.join(f.vault,'effect.txt')),false);
  const saved=JSON.parse(fs.readFileSync(f.file));assert.equal(JSON.stringify(saved.workflows),original);assert.equal(saved.pageRuns.length,2);assert.deepEqual(saved.custom,{preserved:1});
  assert.ok(fs.existsSync(path.join(f.directory,'runtime/page-definitions',a.runId+'.json')));
});
test('two pages run one definition concurrently; duplicate physical page is refused',async t=>{
  const f=fixture(t);f.settings.workflows[0].steps=[{id:'wait',stepKind:'delay',delayValue:1,delayUnit:'seconds'},...f.settings.workflows[0].steps];f.write();
  const lease=runtime.acquireExecutionLease(path.join(f.directory,'runtime'));
  let notify;const started=new Promise(resolve=>notify=resolve);
  let a,b;
  try {
    a=f.run('a',{lease,onCheckpoint:async c=>{if(c.phase==='in_flight')notify();}});
    await Promise.race([started,a.then(()=>{throw Error('did not overlap');})]);
    await assert.rejects(f.run('a',{lease}),/already executing|reserved/);
    b=f.run('b',{lease});
    const result=await Promise.all([a,b]);assert.ok(result.every(c=>c.phase==='completed'));
  } finally {await Promise.allSettled([a,b].filter(Boolean));lease.release();}
});
test('frozen page definition survives catalog edits and resumes without duplicate effects',async t=>{
  const f=fixture(t);f.settings.workflows[0].steps.push({id:'second',stepKind:'code',codeAllowVault:true,code:'vault.append("effect.txt","second"); output="original";'});f.write();
  const first=await f.run('a',{maxSteps:1});assert.equal(first.phase,'ready');
  const saved=JSON.parse(fs.readFileSync(f.file));saved.workflows[0].steps[1].code='throw new Error("new definition must not run")';fs.writeFileSync(f.file,JSON.stringify(saved));
  const resumed=await f.run('a',{resumeRunId:first.runId});assert.equal(resumed.phase,'completed');assert.equal(resumed.runId,first.runId);
  assert.equal(fs.readFileSync(path.join(f.a,'effect.txt'),'utf8'),'oncesecond');
});
test('fixed task directories and terminal reservations fail before a journal or effects',async t=>{
  const f=fixture(t);
  f.settings.tasks=[{id:'t',name:'fixed',taskKind:'code',workingDirectory:f.b,code:'output="x";'}];f.settings.workflows[0].steps=[{id:'s',taskId:'t',stepKind:'task'}];f.write();
  await assert.rejects(f.run('a'),/fixed folder/);
  assert.equal(fs.existsSync(path.join(f.a,'effect.txt')),false);
  f.settings.tasks[0].workingDirectory='';f.settings.pageTerminalClaims=[{id:'terminal',pageId:'a',directory:f.a,createdAt:new Date().toISOString()}];f.write();
  await assert.rejects(f.run('a'),/terminal reserves/);
  assert.equal((await f.run('b')).phase,'completed');
});
test('prepare ignore preserves bytes and staging, is idempotent, then creates a real linked worktree',async t=>{
  const f=fixture(t),repo=f.a;
  git(repo,'init');git(repo,'config','user.name','AutoOC test');git(repo,'config','user.email','test@example.invalid');
  fs.writeFileSync(path.join(repo,'tracked.txt'),'base');git(repo,'add','tracked.txt');git(repo,'commit','-m','fixture');
  const ignore=path.join(repo,'.gitignore'),before=Buffer.from('\ufeff# keep\r\nlocal/\r\n','utf8');fs.writeFileSync(ignore,before);
  const staged=git(repo,'diff','--cached','--name-only');
  const observed=await pages.inspectWorktreePreparation(repo);assert.equal(observed.excluded,false);assert.deepEqual(fs.readFileSync(ignore),before);
  const prepared=await pages.prepareWorktreeIgnore(observed),bytes=fs.readFileSync(ignore);
  assert.equal(prepared.excluded,true);assert.deepEqual(bytes.subarray(0,before.length),before);assert.match(bytes.toString(),/\/\.autooc\/worktrees\/\r\n$/);
  await pages.prepareWorktreeIgnore(prepared);assert.deepEqual(fs.readFileSync(ignore),bytes);assert.equal(git(repo,'diff','--cached','--name-only'),staged);
  const created=await pages.createPageWorktree(prepared,'test-page','feat/page','HEAD');
  assert.equal(git(created.directory,'branch','--show-current'),'feat/page');assert.equal(fs.readFileSync(path.join(created.directory,'tracked.txt'),'utf8'),'base');
  assert.equal((await pages.describePageFolder(created.directory,true)).branch,'feat/page');
  await assert.rejects(pages.createPageWorktree(prepared,'../../escape','feat/no','HEAD'),/page ID/);
});
test('malformed page configuration is rejected without replacing the catalog',async t=>{
  const f=fixture(t);f.settings.workPages[1].id='a';f.write();const bytes=fs.readFileSync(f.file);
  await assert.rejects(f.run('a'),/Invalid work page/);assert.deepEqual(fs.readFileSync(f.file),bytes);
});

test('plugin page entry points preserve the host vault and load independent histories',async t=>{
  const f=fixture(t),bundle={exports:{}};
  const obsidian=Object.fromEntries(['Plugin','Notice','Modal','Setting','ItemView','PluginSettingTab','WorkspaceLeaf'].map(k=>[k,class{}]));
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8'),{
    module:bundle,exports:bundle.exports,require:n=>n==='obsidian'?obsidian:require(n),process,Buffer,console,AbortController,
    setTimeout,clearTimeout,setInterval,clearInterval,window:{setInterval,clearInterval,clearTimeout}
  });
  const p=new bundle.exports.default();p.manifest={id:'auto-oc'};
  p.app={vault:{adapter:{basePath:f.vault},configDir:'.obsidian'},workspace:{getLeavesOfType:()=>[],detachLeavesOfType(){}}};
  p.createVaultMutationBatch=()=>{throw Error('must not use host Obsidian vault');};
  p.reservePluginExecution();
  try {
    await p.loadSettings();
    const result=await p.runWorkPage('a','w',false);
    assert.equal(result.phase,'completed');assert.equal(p.settings.pageRuns.length,1);
    assert.equal(p.settings.workflows[0].runtimeExecution,undefined);
    assert.match(p.pageRunOutput(p.settings.pageRuns[0]),/done/);
    p.assertPagesEditable(); // snapshot files must not be confused with journals
    p.settings.pageTerminalClaims=[{id:'manual',pageId:'a',directory:f.a,createdAt:new Date().toISOString()}];
    await p.saveSettings(false);
    await assert.rejects(p.runWorkPage('a','w',false),/terminal reserves/);
    assert.equal((await p.runWorkPage('b','w',false)).phase,'completed');
    await p.confirmPageTerminal('manual');assert.equal(p.settings.pageTerminalClaims.length,0);
    // A page CLI task acknowledges launch, but retains its folder reservation.
    p.settings.tasks=[{id:'cli',name:'Interactive',taskKind:'cli',cliProvider:'codex',interactiveTerminal:true,prompt:'Synthetic task',workingDirectory:''}];
    p.settings.codexPath=process.execPath;p.settings.cliTerminalDestination='integrated';
    const opened=[];p.cliTerminals={openTask:async request=>opened.push(request)};
    await p.saveSettings(false);
    const cli=await p.runWorkPage('a','cli',true);assert.equal(cli.phase,'completed');assert.equal(opened.length,1);assert.equal(opened[0].cwd,f.a);
    assert.equal(p.settings.pageTerminalClaims.length,1);
    await assert.rejects(p.runWorkPage('a','w',false),/terminal reserves/);
    await assert.rejects(p.runWorkPage('b','w',false),/exclusive page terminal reserves/);
    assert.equal(opened[0].page.pageId,'a');assert.equal(opened[0].page.claimId,p.settings.pageTerminalClaims[0].id);
    const ended={...opened[0].page};
    await p.pageTerminalExited(ended);assert.equal(p.settings.pageTerminalClaims.length,0);
    p.settings.pageTerminalClaims=[{id:'new-session',pageId:'a',directory:f.a,createdAt:new Date().toISOString()}];
    await p.saveSettings(false);
    await p.pageTerminalExited(ended);assert.equal(p.settings.pageTerminalClaims.length,1); // stale exit must not release a newer session
    p.cliTerminals.sessions=[{page:{pageId:'a',claimId:'new-session'},exited:false}];
    await assert.rejects(p.confirmPageTerminal('new-session'),/still tracked/);
    p.cliTerminals.sessions[0].exited=true;
    const save=p.saveSettings.bind(p);p.saveSettings=async()=>{throw Error('save failed');};
    await assert.rejects(p.pageTerminalExited({pageId:'a',claimId:'new-session'}),/save failed/);
    assert.equal(p.settings.pageTerminalClaims.length,1);assert.equal(JSON.parse(fs.readFileSync(f.file)).pageTerminalClaims.length,1);
    p.saveSettings=save;await p.confirmPageTerminal('new-session');
    p.settings.workflows.push({id:'mixed',name:'Mixed',steps:[{id:'cli',stepKind:'task',taskId:'cli'},{id:'later',stepKind:'code',code:'output="later";'}]});
    await p.saveSettings(false);
    await assert.rejects(p.runWorkPage('a','mixed',false),/standalone page task/);assert.equal(opened.length,1);
    let released;
    p.cliTerminals.openTask=async request=>{released=p.pageTerminalExited(request.page);};
    assert.equal((await p.runWorkPage('a','cli',true)).phase,'completed');
    await released;assert.equal(p.settings.pageTerminalClaims.length,0);
    assert.equal(JSON.parse(fs.readFileSync(f.file)).pageTerminalClaims.length,0);
  } finally {p.releasePluginExecution(false);}
});

test('alias pages cannot run together and page runs keep Code permissions explicit',async t=>{
  const f=fixture(t);f.settings.workPages[1].directory=f.a;
  f.settings.workflows[0].steps=[{id:'wait',stepKind:'delay',delayValue:1,delayUnit:'seconds'},...f.settings.workflows[0].steps];f.write();
  const lease=runtime.acquireExecutionLease(path.join(f.directory,'runtime'));
  let notify;const started=new Promise(resolve=>notify=resolve);let first;
  try {
    first=f.run('a',{lease,onCheckpoint:async c=>{if(c.phase==='in_flight')notify();}});
    await Promise.race([started,first.then(()=>{throw Error('did not overlap');})]);
    await assert.rejects(f.run('b',{lease}),/occupied/);
    await first;
  } finally {await Promise.allSettled([first].filter(Boolean));lease.release();}
  const config=JSON.parse(fs.readFileSync(f.file));config.workflows[0].steps=[{id:'denied',stepKind:'code',code:'vault.write("denied.txt","no");'}];
  fs.writeFileSync(f.file,JSON.stringify(config));
  const denied=await f.run('a');assert.equal(denied.phase,'failed');assert.equal(fs.existsSync(path.join(f.a,'denied.txt')),false);
});

test('linked worktrees share Git metadata but execute independently, and branch drift blocks execution',async t=>{
  const f=fixture(t),repo=f.a;
  git(repo,'init');git(repo,'config','user.name','AutoOC test');git(repo,'config','user.email','test@example.invalid');
  fs.writeFileSync(path.join(repo,'tracked.txt'),'base');git(repo,'add','tracked.txt');git(repo,'commit','-m','fixture');
  const prepared=await pages.prepareWorktreeIgnore(await pages.inspectWorktreePreparation(repo));
  const environments=[];
  for(const id of ['a','b']) environments.push(await pages.createPageWorktree(prepared,id,'feat/'+id,'HEAD'));
  f.settings.workPages=f.settings.workPages.map((page,index)=>({...page,...environments[index]}));
  f.settings.worktreesEnabled=false; // disabling creation does not abandon existing environments
  f.settings.workflows[0].steps.unshift({id:'wait',stepKind:'delay',delayValue:1,delayUnit:'seconds'});f.write();
  const lease=runtime.acquireExecutionLease(path.join(f.directory,'runtime'));
  try {
    const result=await Promise.all([f.run('a',{lease}),f.run('b',{lease})]);assert.ok(result.every(c=>c.phase==='completed'));
  } finally {lease.release();}
  for(const env of environments)assert.equal(fs.readFileSync(path.join(env.directory,'effect.txt'),'utf8'),'once');
  assert.equal(fs.existsSync(path.join(repo,'effect.txt')),false);
  git(environments[0].directory,'checkout','-b','changed-by-user');
  await assert.rejects(f.run('a'),/repository or branch changed/);
  assert.equal(fs.readFileSync(path.join(environments[0].directory,'effect.txt'),'utf8'),'once');
});

test('final creator prompts include page scope and their actual examples pass both real validators',()=>{
  const bundle={exports:{}},obsidian=Object.fromEntries(['Plugin','Notice','Modal','Setting','ItemView','PluginSettingTab','WorkspaceLeaf'].map(k=>[k,class{}]));
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8')+'\nmodule.exports.creators={AUTOOC_WORKFLOW_PROMPT,buildDraftPrompt,parseGeneratedDraft};',{
    module:bundle,exports:bundle.exports,require:n=>n==='obsidian'?obsidian:require(n),process,Buffer,console,AbortController,
    setTimeout,clearTimeout,setInterval,clearInterval
  });
  const api=bundle.exports.creators;
  for(const kind of ['task','workflow'])for(const engine of ['opencode','opencode2','codex','copilot']){
    const prompt=api.buildDraftPrompt(api.AUTOOC_WORKFLOW_PROMPT,kind,'Trabajar en la página seleccionada',engine,require('../package.json').version);
    assert.match(prompt,/Work pages are local execution environments/);
    assert.match(prompt,/Discard work is a separate explicit operation for independent worktrees/);
    assert.match(prompt,/Check discard only inspects an interrupted outcome/);
    assert.match(prompt,/Delete page removes only page configuration and keeps folders, branches and shared definitions/);
    assert.match(prompt,/Merge review previews conflicts/);
    assert.match(prompt,/Import stays available in Overview/);
    assert.match(prompt,/CLI in Overview requires an explicit workspace selection/);
    assert.match(prompt,/never executes merge, commit or abort/);
    assert.match(prompt,/Integrated page terminals reuse their live session/);
    assert.match(prompt,/External AutoOC CLI commands retain Main workspace behavior/);
    const json=prompt.split('CREATOR EXAMPLE (replace its content with the requested objective):\n')[1].split("\n\nThe following JSON string")[0];
    const parsed=JSON.parse(json);assert.equal(parsed.workPages,undefined);assert.equal(parsed.worktreesEnabled,undefined);
    const draft=api.parseGeneratedDraft(json,kind,{engine,model:'fixture/model',opencode2Model:'fixture/model',agent:'build',codexModel:'',copilotModel:''});
    assert.equal(draft.tasks.length,1);assert.equal(!!draft.workflow,kind==='workflow');assert.equal(draft.tasks[0].workingDirectory,undefined);
  }
});

test('scoped root and ignored registered worktree can run together; ordinary nesting stays reserved',async t=>{
  const f=fixture(t),repo=f.a;
  git(repo,'init');git(repo,'config','user.name','AutoOC test');git(repo,'config','user.email','test@example.invalid');
  fs.writeFileSync(path.join(repo,'tracked.txt'),'base');git(repo,'add','tracked.txt');git(repo,'commit','-m','fixture');
  const prepared=await pages.prepareWorktreeIgnore(await pages.inspectWorktreePreparation(repo));
  const child=await pages.createPageWorktree(prepared,'child','feat/child','HEAD');
  f.settings.workPages[1]={...f.settings.workPages[1],...child};
  f.settings.workflows[0].steps.unshift({id:'wait',stepKind:'delay',delayValue:1,delayUnit:'seconds'});f.write();
  const lease=runtime.acquireExecutionLease(path.join(f.directory,'runtime'));
  let notify;const started=new Promise(resolve=>notify=resolve);let first;
  try {
    first=f.run('a',{lease,onCheckpoint:async c=>{if(c.phase==='in_flight')notify();}});
    await Promise.race([started,first.then(()=>{throw Error('did not overlap');})]);
    const second=await f.run('b',{lease});assert.equal(second.phase,'completed');assert.equal((await first).phase,'completed');
  } finally {await Promise.allSettled([first].filter(Boolean));lease.release();}
  const claims={pageTerminalClaims:[{id:'main-cli',pageId:'main',directory:repo,createdAt:new Date().toISOString()}]};
  assert.doesNotThrow(()=>pages.assertNoPageTerminal(claims,child.directory,true));
  assert.throws(()=>pages.assertNoPageTerminal(claims,child.directory),/terminal reserves/); // legacy broad execution remains conservative
  assert.throws(()=>pages.assertNoPageTerminal(claims,repo,true),/terminal reserves/);
  const nested=path.join(repo,'ordinary');fs.mkdirSync(nested);
  assert.throws(()=>pages.assertNoPageTerminal(claims,nested,true),/terminal reserves/);
  const inverse={pageTerminalClaims:[{...claims.pageTerminalClaims[0],directory:child.directory}]};
  assert.doesNotThrow(()=>pages.assertNoPageTerminal(inverse,repo,true));
  const saved=JSON.parse(fs.readFileSync(f.file));saved.pageTerminalClaims=claims.pageTerminalClaims;
  saved.workflows[0].concurrency='exclusive';fs.writeFileSync(f.file,JSON.stringify(saved));
  await assert.rejects(f.run('b'),/Exclusive execution must wait/);
  const exclusive={pageTerminalClaims:[{...inverse.pageTerminalClaims[0],exclusive:true}]};
  assert.throws(()=>pages.assertNoPageTerminal(exclusive,repo,true),/exclusive page terminal reserves/);
  fs.writeFileSync(path.join(repo,'.gitignore'),'# worktree no longer excluded\n');
  assert.throws(()=>pages.assertNoPageTerminal(claims,child.directory,true),/terminal reserves/);
});

test('page workflows keep existing background tasks independent of the default for new terminals',t=>{
  const f=fixture(t),module={exports:{}};
  const built=require('esbuild').buildSync({entryPoints:[path.join(__dirname,'../page-workflow.ts')],bundle:true,platform:'node',format:'cjs',write:false});
  new Function('require','module','exports',built.outputFiles[0].text)(require,module,module.exports);
  f.settings.defaultInteractiveTerminal=true;
  f.settings.workflows[0].steps=[{id:'ai',taskId:'legacy'},{id:'after',stepKind:'code',code:'output="after";'}];
  for(const mode of [false,undefined]){
    f.settings.tasks=[{id:'legacy',name:'Background OpenCode',prompt:'Review the code',interactiveTerminal:mode}];
    const definition=module.exports.preparePageDefinition(f.settings,f.workPages[0],'w',false);
    assert.equal(definition.tasks[0].interactiveTerminal,mode);
    assert.equal(definition.workflow.steps.length,2);
  }
  f.settings.tasks[0].interactiveTerminal=true;
  assert.throws(()=>module.exports.preparePageDefinition(f.settings,f.workPages[0],'w',false),/standalone page task|one-step/);
  f.settings.workflows[0].steps=[{id:'ai',taskId:'legacy'}];
  assert.doesNotThrow(()=>module.exports.preparePageDefinition(f.settings,f.workPages[0],'w',false));
});

test('linking a worktree from a bare repository preserves its Git identity and can execute',async t=>{
  const f=fixture(t),repo=f.a,bare=path.join(f.vault,'shared.git'),linked=path.join(f.vault,'bare-worktree');
  git(f.vault,'init','--bare',bare);git(bare,'config','user.name','AutoOC test');git(bare,'config','user.email','test@example.invalid');
  const tree=execFileSync('git',['-C',bare,'mktree'],{input:'',encoding:'utf8',windowsHide:true}).trim();
  const commit=git(bare,'commit-tree',tree,'-m','fixture');
  git(bare,'update-ref','refs/heads/main',commit);git(bare,'symbolic-ref','HEAD','refs/heads/main');
  git(bare,'worktree','add','-b','feat/bare',linked,'HEAD');
  const environment=await pages.describePageFolder(linked,true);
  assert.equal(environment.repository,fs.realpathSync.native(bare));
  f.settings.workPages[0]={...f.workPages[0],...environment};f.write();
  assert.equal((await f.run('a')).phase,'completed');
  assert.equal(fs.readFileSync(path.join(linked,'effect.txt'),'utf8'),'once');
  assert.equal(fs.existsSync(path.join(repo,'effect.txt')),false);
});

test('manual page CLI records context before launch and reuses an existing live session',async t=>{
  const f=fixture(t),bundle={exports:{}};
  const obsidian=Object.fromEntries(['Plugin','Notice','Modal','Setting','ItemView','PluginSettingTab','WorkspaceLeaf'].map(k=>[k,class{}]));
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8'),{
    module:bundle,exports:bundle.exports,require:n=>n==='obsidian'?obsidian:require(n),process,Buffer,console,AbortController,
    setTimeout,clearTimeout,setInterval,clearInterval,window:{setInterval,clearInterval,clearTimeout}
  });
  const p=new bundle.exports.default();p.manifest={id:'auto-oc'};
  p.app={vault:{adapter:{basePath:f.vault},configDir:'.obsidian'},workspace:{getLeavesOfType:()=>[],detachLeavesOfType(){}}};
  p.reservePluginExecution();
  try {
    await p.loadSettings();p.settings.cliTerminalDestination='integrated';
    const opened=[],focused=[];
    p.cliTerminals={sessions:[],pageSession(id){return this.sessions.find(s=>s.page.pageId===id);},
      focusPage:async id=>{focused.push(id);return true;},async open(provider,cwd,label,page){
        assert.ok(JSON.parse(fs.readFileSync(f.file)).pageTerminalClaims.some(c=>c.id===page.claimId));
        await assert.rejects(p.confirmPageTerminal(page.claimId),/still tracked/);
        const session={provider,cwd,label,page,exited:false};this.sessions.push(session);opened.push(session);
      }};
    await p.launchManualCli('codex',f.a,'a');await p.launchManualCli('codex',f.a,'a');
    assert.equal(opened.length,1);assert.deepEqual(focused,['a']);assert.equal(p.settings.pageTerminalClaims.length,1);
    await p.launchManualCli('codex',f.b,'b');assert.equal(opened.length,2);assert.equal(p.settings.pageTerminalClaims.length,2);
    await assert.rejects(p.launchManualCli('codex',f.b,'a'),/context changed/);
    opened[0].exited=true;await p.pageTerminalExited(opened[0].page);
    assert.equal(p.settings.pageTerminalClaims.length,1);assert.equal(p.settings.pageTerminalClaims[0].pageId,'b');
  } finally {p.releasePluginExecution(false);}
});
