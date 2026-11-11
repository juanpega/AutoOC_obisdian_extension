const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {spawn,spawnSync,execFileSync}=require('node:child_process');
const runtime=require('../autooc-runtime.cjs'),cli=path.resolve(__dirname,'../autooc-cli.cjs');
function fixture(t){
  // Match the canonical paths stored by the page creator, including aliased temp roots.
  const vault=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'autooc-cli-pages-')));
  const directory=path.join(vault,'.obsidian/plugins/auto-oc'),file=path.join(directory,'data.json');
  fs.mkdirSync(directory,{recursive:true});
  const a=path.join(vault,'a'),b=path.join(vault,'b');fs.mkdirSync(a);fs.mkdirSync(b);
  const config={tasks:[{id:'t',name:'Task',taskKind:'code',codeAllowVault:true,code:'vault.append("task.txt","T"); output="PRIVATE_TASK";'}],
    workflows:[{id:'w',name:'Shared',steps:[{id:'one',stepKind:'code',codeAllowVault:true,code:'vault.append("effect.txt","1"); output="PRIVATE_OUTPUT";'},
      {id:'two',stepKind:'code',codeAllowVault:true,code:'vault.append("effect.txt","2"); output="done";'}]}],
    workPages:[a,b].map((directory,i)=>({id:i?'b':'a',name:'Same label',objective:'PRIVATE_OBJECTIVE',directory,kind:'folder',workflowIds:['w'],taskIds:['t']}))};
  fs.writeFileSync(file,JSON.stringify(config));
  t.after(()=>{assert.equal(path.dirname(fs.realpathSync.native(vault)),fs.realpathSync.native(os.tmpdir()));assert.match(path.basename(vault),/^autooc-cli-pages-/);fs.rmSync(vault,{recursive:true,force:true});});
  return {vault,directory,file,a,b,config,write(){fs.writeFileSync(file,JSON.stringify(config));},
    call(command,...args){return spawnSync(process.execPath,[cli,command,'--vault',vault,...args],{cwd:b,encoding:'utf8',windowsHide:true,timeout:30000});}};
}
function ok(result){assert.equal(result.status,0,result.stderr);assert.doesNotMatch(result.stdout+result.stderr,/PRIVATE_/);return JSON.parse(result.stdout);}
function running(f,args,onProgress){
  const child=spawn(process.execPath,[cli,...args,'--vault',f.vault],{cwd:f.b,windowsHide:true});
  let stdout='',stderr='',pending='';
  const watchdog=setTimeout(()=>child.kill(),30000);
  const done=new Promise((resolve,reject)=>{
    child.on('error',error=>{clearTimeout(watchdog);reject(error);});
    child.stdout.on('data',s=>stdout+=s);child.stderr.on('data',s=>{
      stderr+=s;pending+=s;
      while(pending.includes('\n')){const end=pending.indexOf('\n'),line=pending.slice(0,end);pending=pending.slice(end+1);onProgress?.(JSON.parse(line));}
    });
    child.on('close',status=>{clearTimeout(watchdog);resolve({status,stdout,stderr});});
  });
  return {child,done};
}
function plugin(f){
  const bundle={exports:{}},obsidian=Object.fromEntries(['Plugin','Notice','Modal','Setting','ItemView','PluginSettingTab','WorkspaceLeaf'].map(k=>[k,class{}]));
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8'),{
    module:bundle,exports:bundle.exports,require:n=>n==='obsidian'?obsidian:require(n),process,Buffer,console,AbortController,
    setTimeout,clearTimeout,setInterval,clearInterval,window:{setInterval,clearInterval,clearTimeout}
  });
  const p=new bundle.exports.default();p.manifest={id:'auto-oc'};
  p.app={vault:{adapter:{basePath:f.vault},configDir:'.obsidian'},workspace:{getLeavesOfType:()=>[],detachLeavesOfType(){}}};
  p.createVaultMutationBatch=()=>({record(){},async flush(){}});
  return p;
}

test('legacy commands and explicit main keep the original context despite shell cwd; page discovery is read-only',t=>{
  const f=fixture(t),before=fs.readFileSync(f.file);
  const pages=ok(f.call('pages'));assert.deepEqual(pages.pages.map(p=>p.id),['main','a','b']);
  assert.equal(pages.pages[1].name,pages.pages[2].name); // IDs disambiguate labels
  assert.deepEqual(fs.readFileSync(f.file),before);assert.equal(fs.existsSync(path.join(f.directory,'runtime')),false);
  const initial=ok(f.call('run','--workflow','w'));assert.equal(initial.workflowId,'w');assert.equal(initial.pageId,undefined);
  const explicit=ok(f.call('run','--workflow','w','--page','main'));assert.equal(explicit.workflowId,'w');assert.equal(explicit.pageId,undefined);
  assert.equal(fs.readFileSync(path.join(f.vault,'effect.txt'),'utf8'),'1212');assert.equal(fs.existsSync(path.join(f.b,'effect.txt')),false);
  assert.deepEqual(ok(f.call('status','--page','main')),ok(f.call('status')));
  assert.ok(ok(f.call('list')).workflows.some(w=>w.id==='w'));
});

test('standalone CLI executes, resumes and reconciles only the selected page, preserving global results',async t=>{
  const f=fixture(t),global=JSON.stringify(f.config.workflows);
  const run=ok(f.call('run','--workflow','w','--page','a'));assert.equal(run.pageId,'a');assert.equal(run.workflowId,'@page:a:workflow:w');
  assert.equal(fs.readFileSync(path.join(f.a,'effect.txt'),'utf8'),'12');assert.equal(fs.existsSync(path.join(f.vault,'effect.txt')),false);
  const partial=await runtime.runInstalledWorkflow({vault:f.vault,workflowId:'w',pageId:'b',maxSteps:1,redact:s=>s});assert.equal(partial.phase,'ready');
  const wrong=f.call('resume','--workflow','w','--page','a','--run',partial.runId);assert.equal(wrong.status,1);
  assert.equal(f.call('resume','--workflow','w','--run',partial.runId).status,1);
  const resumed=ok(f.call('resume','--workflow','w','--page','b','--run',partial.runId));assert.equal(resumed.runId,partial.runId);assert.equal(resumed.phase,'completed');
  ok(f.call('reconcile','--workflow','w','--page','b','--run',partial.runId));assert.equal(fs.readFileSync(path.join(f.b,'effect.txt'),'utf8'),'12');
  const task=ok(f.call('run','--task','t','--page','a'));assert.equal(task.workflowId,'@page:a:task:t');assert.equal(fs.readFileSync(path.join(f.a,'task.txt'),'utf8'),'T');
  assert.equal(JSON.stringify(JSON.parse(fs.readFileSync(f.file)).workflows),global);
  const status=ok(f.call('status','--page','a'));assert.equal(status.page.id,'a');assert.equal(status.workflows,undefined);
  assert.ok(status.executions.length>=2);assert.ok(status.executions.every(e=>e.workflowId.startsWith('@page:a:')));
});

test('invalid, missing and archived pages fail explicitly with no fallback to Main workspace',t=>{
  const f=fixture(t);f.config.workPages[0].archived=true;f.write();const before=fs.readFileSync(f.file);
  for(const page of ['general','missing','../a','a'])assert.equal(f.call('run','--workflow','w','--page',page).status,1,page);
  assert.equal(f.call('run','--workflow','w','--page','b','--step','one').status,1);
  assert.equal(f.call('status','--page','missing').status,1);
  assert.deepEqual(fs.readFileSync(f.file),before);
  for(const root of [f.vault,f.a,f.b])assert.equal(fs.existsSync(path.join(root,'effect.txt')),false);
});

test('CLI selects an actual Git worktree and rejects branch drift without writing to Main workspace',t=>{
  const f=fixture(t),repo=f.a,worktree=path.join(repo,'.autooc/worktrees/cli');
  const git=(cwd,...args)=>execFileSync('git',['-c','safe.directory='+cwd.replace(/\\/g,'/'),...args],{cwd,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
  git(repo,'init');git(repo,'config','user.name','AutoOC test');git(repo,'config','user.email','test@example.invalid');
  fs.writeFileSync(path.join(repo,'tracked.txt'),'base');git(repo,'add','tracked.txt');git(repo,'commit','-m','fixture');
  fs.writeFileSync(path.join(repo,'.gitignore'),'/.autooc/worktrees/\n');fs.mkdirSync(path.dirname(worktree),{recursive:true});
  git(repo,'worktree','add','-b','feat/cli',worktree,'HEAD');
  f.config.workPages[1]={...f.config.workPages[1],kind:'worktree',directory:worktree,repository:repo,branch:'feat/cli'};f.write();
  assert.equal(ok(f.call('run','--workflow','w','--page','b')).phase,'completed');
  assert.equal(fs.readFileSync(path.join(worktree,'effect.txt'),'utf8'),'12');assert.equal(fs.existsSync(path.join(f.vault,'effect.txt')),false);
  git(worktree,'checkout','-b','feat/changed');
  const rejected=f.call('run','--workflow','w','--page','b');assert.equal(rejected.status,1);assert.match(rejected.stderr,/branch changed/);
  assert.equal(fs.readFileSync(path.join(worktree,'effect.txt'),'utf8'),'12');
});

test('standalone stop validates page and run identity while preserving the one-owner boundary',async t=>{
  const f=fixture(t);f.config.workflows[0].steps=[{id:'wait',stepKind:'delay',delayValue:30,delayUnit:'seconds'},...f.config.workflows[0].steps];f.write();
  let signal;const started=new Promise(resolve=>signal=resolve);
  const first=running(f,['run','--workflow','w','--page','a'],event=>{if(event.phase==='in_flight')signal(event);});
  try{
    const state=await Promise.race([started,first.done.then(result=>{throw Error('No active checkpoint: '+result.stderr);})]);
    assert.equal(f.call('run','--workflow','w','--page','b').status,1); // no second standalone owner
    for(const flags of [[],['--page','b']])assert.equal(f.call('stop','--workflow','w',...flags,'--run',state.runId).status,1);
    assert.equal(ok(f.call('stop','--workflow','w','--page','a','--run',state.runId)).requested,true);
    await first.done;assert.equal(fs.existsSync(path.join(f.a,'effect.txt')),false);
  }finally{first.child.kill();await first.done;}
});

test('real plugin mailbox runs the same workflow in two pages and only cancels the selected run',async t=>{
  const f=fixture(t);f.config.workflows[0].steps.unshift({id:'wait',stepKind:'delay',delayValue:3,delayUnit:'seconds'});f.write();
  const p=plugin(f);p.reservePluginExecution();let timer,a,b;
  try{
    await p.loadSettings();p.startCliRequests();timer=setInterval(()=>void p.cliRequestHost.poll(),10);
    const start=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:e=>{if(e.phase==='in_flight')resolve(e);}};};
    const sa=start(),sb=start();a=running(f,['run','--workflow','w','--page','a'],sa.resolve);
    const ra=await Promise.race([sa.promise,a.done.then(r=>{throw Error(r.stderr);})]);
    b=running(f,['run','--workflow','w','--page','b'],sb.resolve);
    const rb=await Promise.race([sb.promise,b.done.then(r=>{throw Error(r.stderr);})]);
    assert.equal(ra.host,'obsidian');assert.equal(rb.host,'obsidian');assert.equal(ra.pageId,'a');assert.equal(rb.pageId,'b');
    assert.equal(ok(f.call('stop','--workflow','w','--page','a','--run',ra.runId)).requested,true);
    await a.done;const result=ok(await b.done);assert.equal(result.phase,'completed');
    assert.equal(fs.existsSync(path.join(f.a,'effect.txt')),false);assert.equal(fs.readFileSync(path.join(f.b,'effect.txt'),'utf8'),'12');
    // Stopping A retains its durable reservation. Existing recovery rules still
    // apply to later commands even though B was allowed to finish independently.
    const blocked=await running(f,['resume','--workflow','w','--page','b','--run',rb.runId]).done;
    assert.equal(blocked.status,1);assert.match(blocked.stderr,/continuation or reconciliation/);
    // A cancelled in-flight delay keeps its failed outcome on resume; it is not
    // permission to replay the workflow or discard the retained uncertainty.
    const cancelled=await running(f,['resume','--workflow','w','--page','a','--run',ra.runId]).done;
    assert.equal(cancelled.status,1);assert.equal(JSON.parse(cancelled.stdout).phase,'failed');
    assert.equal(fs.existsSync(path.join(f.a,'effect.txt')),false);
    assert.equal(fs.readFileSync(path.join(f.b,'effect.txt'),'utf8'),'12');assert.equal(p.settings.workflows[0].runtimeExecution,undefined);
  }finally{
    clearInterval(timer);p.cliRequestHost?.close();await Promise.allSettled([a?.done,b?.done].filter(Boolean));await p.cliRequestHost?.drain();p.releasePluginExecution(false);
  }
});
