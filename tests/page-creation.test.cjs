const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),crypto=require('node:crypto');
const {execFileSync,spawn}=require('node:child_process');
const runtime=require('../autooc-runtime.cjs'),cli=path.resolve(__dirname,'../autooc-cli.cjs');
function fixture(t){
  const vault=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'autooc-create-page-'))),installation=path.join(vault,'.obsidian/plugins/auto-oc');
  fs.mkdirSync(installation,{recursive:true});
  const file=path.join(installation,'data.json'),repo=path.join(vault,'project');fs.mkdirSync(repo);
  const git=(...args)=>execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid',...args],{cwd:repo,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
  git('init','-b','main');fs.writeFileSync(path.join(repo,'README.md'),'fixture');git('add','README.md');git('commit','-m','fixture');
  const config={tasks:[{id:'child-task',name:'Child task',taskKind:'code',codeAllowVault:true,code:'vault.append("effect.txt","task"); output="done";'}],
    workflows:[{id:'child',name:'Child workflow',steps:[{id:'write',stepKind:'code',codeAllowVault:true,code:'vault.append("effect.txt",vault.read(".autooc/requirement.md")); output="done";'}]}],worktreesEnabled:true};
  const write=()=>fs.writeFileSync(file,JSON.stringify(config));write();
  const cleanups=[];t.after(async()=>{for(const cleanup of cleanups)await cleanup();assert.equal(path.dirname(fs.realpathSync.native(vault)),fs.realpathSync.native(os.tmpdir()));assert.match(path.basename(vault),/^autooc-create-page-/);fs.rmSync(vault,{recursive:true,force:true});});
  const request=(extra={})=>({requestId:'req-1',name:'Requirement',objective:'PRIVATE_OBJECTIVE',mode:'create',repository:repo,branch:'feat/requirement',base:'main',allowGitignoreUpdate:true,...extra});
  const inspect=id=>runtime.inspectPageCreation(path.join(installation,'runtime'),id||'req-1');
  return {vault,installation,file,repo,git,config,write,request,inspect,cleanups};
}
function call(args){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[cli,...args],{windowsHide:true}),timer=setTimeout(()=>child.kill(),40000);let stdout='',stderr='';
    child.stdout.on('data',s=>stdout+=s);child.stderr.on('data',s=>stderr+=s);
    child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);resolve({code,stdout,stderr,value:stdout.trim()?JSON.parse(stdout):undefined});});
  });
}
test('invalid requests are rejected before creating runtime files or changing Git',async t=>{
  const f=fixture(t),input=path.join(f.vault,'invalid.json'),before=fs.readFileSync(f.file);
  for(const changes of [{requestId:123},{repository:'relative/path'},{unknown:true},{launch:{taskId:'child-task',workflowId:'child'}},{launch:{workflowId:'child\n'}}]){
    fs.writeFileSync(input,JSON.stringify(f.request(changes)));assert.throws(()=>runtime.readPageCreationRequest(input),/Invalid page creation request/);
  }
  assert.deepEqual(fs.readFileSync(f.file),before);assert.equal(fs.existsSync(path.join(f.installation,'runtime')),false);assert.equal(fs.existsSync(path.join(f.repo,'.gitignore')),false);
});
test('requirement delivery refuses a linked snapshot directory without writing outside the page',async t=>{
  const f=fixture(t),folder=path.join(f.vault,'folder'),outside=path.join(f.vault,'outside');fs.mkdirSync(folder);fs.mkdirSync(outside);
  try{fs.symlinkSync(outside,path.join(folder,'.autooc'),process.platform==='win32'?'junction':'dir');}
  catch(error){if(['EPERM','EACCES','ENOTSUP'].includes(error.code)){t.skip('The host cannot create the required directory link: '+error.code);return;}throw error;}
  const result=await runtime.createStandalonePage(f.vault,{requestId:'linked-snapshot',name:'Folder',mode:'folder',directory:folder,requirementId:'REQ-1',requirementText:'PRIVATE_REQUIREMENT'});
  assert.equal(result.errorCode,'UNSAFE_REQUIREMENT_PATH');assert.equal(result.created,false);assert.deepEqual(fs.readdirSync(outside),[]);assert.equal(JSON.parse(fs.readFileSync(f.file)).workPages,undefined);
});
test('CLI creates a worktree and requirement snapshot once; retries preserve catalog and Git identity',async t=>{
  const f=fixture(t),before=f.git('rev-parse','HEAD'),request=f.request({requirementId:'REQ-1',requirementText:'PRIVATE_REQUIREMENT\nSecond line'}),input=path.join(f.vault,'request.json');
  fs.writeFileSync(input,JSON.stringify(request));
  const result=await call(['create-page','--vault',f.vault,'--request',input]);assert.equal(result.code,0,result.stderr);
  const page=result.value;assert.equal(page.status,'created');assert.equal(page.baseCommit,before);assert.equal(f.git('branch','--show-current'),'main');
  assert.equal(f.git('diff','--cached','--name-only'),'');assert.equal(fs.readFileSync(path.join(page.directory,'.autooc/requirement.md'),'utf8'),request.requirementText);
  assert.doesNotMatch(result.stdout+result.stderr,/PRIVATE_/);
  const catalog=fs.readFileSync(f.file,'utf8'),trees=f.git('worktree','list','--porcelain');
  const repeated=await runtime.createStandalonePage(f.vault,Object.fromEntries(Object.entries(request).reverse()));
  assert.equal(repeated.pageId,page.pageId);assert.equal(fs.readFileSync(f.file,'utf8'),catalog);assert.equal(f.git('worktree','list','--porcelain'),trees);
  await assert.rejects(runtime.createStandalonePage(f.vault,{...request,name:'Different'}),/different parameters/);
  assert.equal(f.inspect().pageId,page.pageId);
  const queried=await call(['inspect-page-request','--vault',f.vault,'--request-id','req-1']);assert.equal(queried.code,0);assert.equal(queried.value.pageId,page.pageId);
});
test('preflight rejects disabled worktrees, invalid base, branch collision and absent ignore consent before Git effects',async t=>{
  const f=fixture(t);
  f.config.worktreesEnabled=false;f.write();
  let result=await runtime.createStandalonePage(f.vault,f.request());assert.equal(result.errorCode,'WORKTREES_DISABLED');
  assert.equal(fs.existsSync(path.join(f.repo,'.gitignore')),false);
  f.config.worktreesEnabled=true;f.write();
  result=await runtime.createStandalonePage(f.vault,f.request({requestId:'base',base:'missing'}));assert.equal(result.status,'blocked');
  f.git('branch','feat/collision');result=await runtime.createStandalonePage(f.vault,f.request({requestId:'collision',branch:'feat/collision'}));assert.equal(result.errorCode,'ENVIRONMENT_COLLISION');
  result=await runtime.createStandalonePage(f.vault,f.request({requestId:'consent',allowGitignoreUpdate:false}));assert.equal(result.errorCode,'GITIGNORE_APPROVAL_REQUIRED');
  assert.equal(fs.existsSync(path.join(f.repo,'.gitignore')),false);assert.equal(f.git('worktree','list','--porcelain').match(/^worktree /gm).length,1);
});
test('folder and linked worktree modes preserve existing files and reject duplicate page directories',async t=>{
  const f=fixture(t),folder=path.join(f.vault,'folder');fs.mkdirSync(folder);
  const a=await runtime.createStandalonePage(f.vault,{requestId:'folder',name:'Folder',mode:'folder',directory:folder});assert.equal(a.status,'created');
  const duplicate=await runtime.createStandalonePage(f.vault,{requestId:'duplicate',name:'Again',mode:'folder',directory:folder});assert.equal(duplicate.errorCode,'PAGE_DIRECTORY_IN_USE');
  const linked=path.join(f.vault,'linked');f.git('worktree','add','-b','feat/linked',linked,'main');
  const b=await runtime.createStandalonePage(f.vault,{requestId:'link',name:'Linked',mode:'link',directory:linked});assert.equal(b.status,'created');assert.equal(b.branch,'feat/linked');
  assert.equal(f.git('diff','--cached','--name-only'),'');
});
test('already effective ignore is reused without rewriting the file',async t=>{
  const f=fixture(t);fs.writeFileSync(path.join(f.repo,'.gitignore'),'# custom\n/.autooc/worktrees/\n');const before=fs.readFileSync(path.join(f.repo,'.gitignore'));
  const result=await runtime.createStandalonePage(f.vault,f.request({allowGitignoreUpdate:false}));assert.equal(result.status,'created');assert.deepEqual(fs.readFileSync(path.join(f.repo,'.gitignore')),before);
});
test('requirement snapshot is verified before page execution and remains out of discovery output',async t=>{
  const f=fixture(t),page=await runtime.createStandalonePage(f.vault,f.request({requirementId:'REQ-1',requirementText:'PRIVATE_SPEC',launch:{workflowId:'child'}}));
  assert.equal(page.status,'completed');assert.equal(page.launchPhase,'completed');assert.equal(fs.readFileSync(path.join(page.directory,'effect.txt'),'utf8'),'PRIVATE_SPEC');
  fs.writeFileSync(path.join(page.directory,'.autooc/requirement.md'),'tampered');
  await assert.rejects(runtime.runInstalledWorkflow({vault:f.vault,pageId:page.pageId,workflowId:'child',newExecution:true,redact:s=>s}),/snapshot changed/);
  const result=await call(['pages','--vault',f.vault]);assert.doesNotMatch(result.stdout,/PRIVATE_/);assert.equal(result.value.pages[1].requirementFile,'.autooc/requirement.md');
});
function service(t,f,{failRegister=false}={}){
  const location=runtime.resolveInstalledWorkflowLocation(f.vault);fs.mkdirSync(location.runtimeDirectory,{recursive:true});
  const lease=runtime.acquireExecutionLease(location.runtimeDirectory);let busy=false,fail=failRegister;
  const pages=runtime.createPageCreationService({lease,location,busy:()=>busy,activeRuns:()=>[],assertOpen:()=>lease.assertOwned(),reserve:()=>()=>{},
    catalog:async()=>JSON.parse(fs.readFileSync(f.file,'utf8')),
    register:async page=>{if(fail)throw Error('synthetic save failure');const config=JSON.parse(fs.readFileSync(f.file,'utf8'));if(!(config.workPages||[]).some(p=>p.id===page.id)){config.workPages=[...(config.workPages||[]),page];fs.writeFileSync(f.file,JSON.stringify(config));}},
    launch:()=>{throw Error('unused');}});
  f.cleanups.push(async()=>{pages.close();await pages.drain();lease.release();});
  return {pages,setBusy:value=>busy=value,setFailure:value=>fail=value};
}
test('concurrent identical submissions reserve one ID, defer effects while busy and return a durable receipt',async t=>{
  const f=fixture(t),s=service(t,f);s.setBusy(true);
  const [a,b]=await Promise.all([s.pages.submit(f.request()),s.pages.submit(f.request())]);assert.equal(a.pageId,b.pageId);assert.equal(a.created,false);
  await s.pages.poll();assert.equal(f.git('worktree','list','--porcelain').match(/^worktree /gm).length,1);assert.equal(f.inspect().status,'queued');
  s.setBusy(false);await s.pages.flush();assert.equal(f.inspect().status,'created');assert.equal(JSON.parse(fs.readFileSync(f.file)).workPages.length,1);
});
test('catalog save failure retains a verified worktree and same-ID retry completes registration without Git replay',async t=>{
  const f=fixture(t),s=service(t,f,{failRegister:true});await s.pages.submit(f.request());await s.pages.flush();
  const failed=f.inspect();assert.equal(failed.status,'environment');assert.equal(failed.created,false);assert.equal(fs.existsSync(failed.directory),true);
  const trees=f.git('worktree','list','--porcelain');s.setFailure(false);await s.pages.submit(f.request());await s.pages.flush();
  assert.equal(f.inspect().pageId,failed.pageId);assert.equal(f.inspect().status,'created');assert.equal(f.git('worktree','list','--porcelain'),trees);
});
test('restart does not replay queued or uncertain operations; resubmission preserves exact identity',async t=>{
  const f=fixture(t),location=runtime.resolveInstalledWorkflowLocation(f.vault);fs.mkdirSync(location.runtimeDirectory,{recursive:true});
  let lease=runtime.acquireExecutionLease(location.runtimeDirectory);
  const host=()=>({lease,location,busy:()=>true,activeRuns:()=>[],assertOpen:()=>lease.assertOwned(),reserve:()=>()=>{},catalog:async()=>f.config,register:async()=>{},launch:async()=>{throw Error('unused');}});
  let pages=runtime.createPageCreationService(host());const queued=await pages.submit(f.request());pages.close();await pages.drain();lease.release();
  lease=runtime.acquireExecutionLease(location.runtimeDirectory);pages=runtime.createPageCreationService(host());await pages.poll();assert.equal(f.inspect().status,'queued');
  const same=await pages.submit(f.request());assert.equal(same.pageId,queued.pageId);pages.close();await pages.drain();lease.release();
  const file=path.join(location.runtimeDirectory,'page-requests',crypto.createHash('sha256').update('req-1').digest('hex')+'.json'),record=JSON.parse(fs.readFileSync(file));record.stage='preparing';fs.writeFileSync(file,JSON.stringify(record));
  const retained=await runtime.createStandalonePage(f.vault,f.request());assert.equal(retained.status,'needs-review');assert.equal(retained.pageId,queued.pageId);assert.equal(f.git('worktree','list','--porcelain').match(/^worktree /gm).length,1);
});
function parent(f,{task=false,fail=false}={}){
  const input=path.join(f.vault,'request.json');fs.writeFileSync(input,JSON.stringify(f.request({requirementId:'REQ-1',requirementText:'PRIVATE_PARENT_SPEC',launch:{workflowId:'child'}})));
  // Fixture paths cannot contain quote metacharacters. This is a trusted Code test,
  // exercising the actual CLI child process and owner mailbox rather than a mock.
  const quote=p=>{assert.doesNotMatch(p,/["'`$\r\n]/);return process.platform==='win32'?'"'+p+'"':"'"+p+"'";};
  const command=[process.execPath,cli,'create-page','--vault',f.vault,'--request',input].map(quote).join(' ');
  const code='const result=JSON.parse(terminal.run('+JSON.stringify(command)+')); if(result.status!=="queued" || result.created) throw new Error("Not deferred"); output=result.pageId;'+(fail?' throw new Error("parent fails");':'');
  if(task)f.config.tasks.push({id:'parent',name:'Parent task',taskKind:'code',codeAllowTerminal:true,code});
  else f.config.workflows.push({id:'parent',name:'Parent workflow',steps:[{id:'prepare',stepKind:'code',codeAllowTerminal:true,code},{id:'next',stepKind:'code',code:'output="continued";'}]});
  f.write();return task?{taskId:'parent'}:{workflowId:'parent'};
}
for(const task of [false,true])test(`active standalone ${task?'task':'workflow'} submits creation and launches its child after completing`,async t=>{
  const f=fixture(t),selection=parent(f,{task});
  const result=await runtime.runStandaloneWorkflowWithPages({vault:f.vault,...selection,newExecution:true,redact:s=>s});
  assert.equal(result.phase,'completed');const receipt=f.inspect();assert.equal(receipt.status,'completed');assert.equal(receipt.launchPhase,'completed');assert.ok(receipt.waitForRuns.includes(result.runId));
  assert.equal(fs.readFileSync(path.join(receipt.directory,'effect.txt'),'utf8'),'PRIVATE_PARENT_SPEC');
  const again=await runtime.createStandalonePage(f.vault,f.request({requirementId:'REQ-1',requirementText:'PRIVATE_PARENT_SPEC',launch:{workflowId:'child'}}));
  assert.equal(again.launchRunId,receipt.launchRunId);assert.equal(fs.readFileSync(path.join(receipt.directory,'effect.txt'),'utf8'),'PRIVATE_PARENT_SPEC');
});
test('failed parent blocks queued creation and launch without creating Git effects',async t=>{
  const f=fixture(t),selection=parent(f,{fail:true});const result=await runtime.runStandaloneWorkflowWithPages({vault:f.vault,...selection,newExecution:true,redact:s=>s});
  assert.equal(result.phase,'failed');assert.equal(f.inspect().errorCode,'PARENT_NOT_COMPLETED');assert.equal(f.inspect().created,false);assert.equal(f.git('worktree','list','--porcelain').match(/^worktree /gm).length,1);
});
test('loaded plugin accepts a page request from its running workflow and publishes the page without reload',async t=>{
  const f=fixture(t),selection=parent(f),bundle={exports:{}};
  const obsidian=Object.fromEntries(['Plugin','Notice','Modal','Setting','ItemView','PluginSettingTab','WorkspaceLeaf'].map(k=>[k,class{}]));
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8'),{module:bundle,exports:bundle.exports,require:n=>n==='obsidian'?obsidian:require(n),process,Buffer,console,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,window:{setInterval,clearInterval,clearTimeout}});
  const p=new bundle.exports.default();p.manifest={id:'auto-oc'};p.app={vault:{adapter:{basePath:f.vault},configDir:'.obsidian'},workspace:{getLeavesOfType:()=>[],detachLeavesOfType(){}}};
  p.createVaultMutationBatch=()=>({record(){},async flush(){}});p.reservePluginExecution();let timer;
  try{
    await p.loadSettings();p.startCliRequests();let pollError;
    timer=setInterval(()=>void p.cliRequestHost.poll().catch(e=>{pollError=e;}),10);
    const state=await p.runSharedWorkflow(selection.workflowId,undefined,false,true);assert.equal(state.phase,'completed');
    // Await the owner's real publication barrier instead of racing Git and disk
    // work against a fixed wall-clock deadline under a concurrent test suite.
    await p.cliRequestHost.poll();await p.cliRequestHost.drain();
    if(pollError)throw pollError;const receipt=f.inspect();assert.equal(receipt.status,'completed');assert.equal(p.settings.workPages[0].id,receipt.pageId);assert.equal(p.settings.pageRuns[0].runId,receipt.launchRunId);
    assert.equal(fs.readFileSync(path.join(receipt.directory,'effect.txt'),'utf8'),'PRIVATE_PARENT_SPEC');
  }finally{clearInterval(timer);p.cliRequestHost?.close();await p.cliRequestHost?.drain();p.releasePluginExecution(false);}
});
