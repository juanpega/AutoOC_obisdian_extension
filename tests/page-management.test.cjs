const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),Module=require('node:module'),ts=require('typescript');
const cache=new Map();
function load(name){const file=path.resolve(__dirname,'..',name+'.ts');if(cache.has(file))return cache.get(file).exports;const mod=new Module(file,module);cache.set(file,mod);mod.filename=file;mod.paths=module.paths;mod.require=n=>n.startsWith('.')?load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(file),n))):require(n);mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);return mod.exports;}
const {managePage,validPageManagementCommand,parsePageManagementArgs}=load('page-management');
const {createPluginRequestHost,requestPluginPageManagement,inspectPluginRequest,requestPluginExecution}=load('cli-plugin-requests');
const {acquireExecutionLease}=load('execution-lease');
const digest='a'.repeat(64),dir=path.resolve(os.tmpdir(),'autooc-page-target');
function fixture(){
  const page={id:'p',name:'Feature',directory:dir+'-source',repository:dir,kind:'worktree',branch:'feat/p',taskIds:[],workflowIds:[]},effects=[];
  const source={directory:page.directory,branch:page.branch,head:'a'.repeat(40)},target={directory:dir,branch:'main',head:'b'.repeat(40)};
  let sessions=[],merge={source,target,targets:[target],state:'ready',inProgress:false,conflicts:[],blockers:[],completionBlockers:[],integration:'not-integrated',sourceFiles:[],targetFiles:[],details:'',hash:digest};
  const host={settings:{workPages:[page],pageRuns:[]},isLifecycleStopped:()=>false,redactSecrets:s=>s.replaceAll('private-secret','[REDACTED]'),pageBlockingSessions:()=>sessions,
    reviewPageMerge:async()=>merge,reviewPageFinish:async()=>({pageId:page.id,hash:digest,changes:'',files:[],archiveBlockers:[],removalBlockers:[]}),
    reviewPageDiscard:async()=>({pageId:page.id,hash:digest,blockers:[],changes:'',commits:'',fileCount:0,commitCount:1,stage:'worktree'}),
    executePageMerge:async(...args)=>{effects.push(args);return {review:merge,output:'done'};},
    finishWorkPage:async(...args)=>{effects.push(args);page.archived=true;},
    discardWorkPage:async(...args)=>{effects.push(args);},deleteWorkPage:async value=>{effects.push(value);host.settings.workPages=[];}};
  const command=async(command,request)=>managePage(host,{command,request},()=>[]);
  return {page,host,effects,command,review:kind=>command('review-page',{pageId:'p',kind}),setMerge:value=>{merge={...merge,...value};},setSessions:value=>{sessions=value;}};
}
test('page management rejects ambiguous options, malformed actions, Main and implicit destructive confirmations',()=>{
  const review={command:'review-page',request:{pageId:'p',kind:'merge'}};
  assert.equal(validPageManagementCommand(review),true);
  for(const request of [{pageId:'main',kind:'merge'},{pageId:'../p',kind:'merge'},{pageId:'p',kind:'finish',targetDirectory:dir},{pageId:'p',kind:'merge',force:true}])assert.equal(validPageManagementCommand({...review,request}),false);
  for(const action of ['__proto__',[],['archive'],{},null])assert.equal(validPageManagementCommand({command:'page-action',request:{pageId:'p',action,reviewHash:digest}}),false);
  for(const action of ['merge-abort','discard','remove-worktree','delete'])assert.equal(validPageManagementCommand({command:'page-action',request:{pageId:'p',action,reviewHash:digest,targetDirectory:dir}}),false);
  assert.throws(()=>parsePageManagementArgs('review-page',['--vault',dir,'--page','p','--kind','merge','--page','q']),/Invalid/);
  assert.throws(()=>parsePageManagementArgs('review-page',['--vault','relative','--page','p','--kind','merge']),/absolute/);
  assert.deepEqual(parsePageManagementArgs('review-page',['--kind','merge','--page','p','--vault',dir,'--target',dir]).command.request,{pageId:'p',kind:'merge',targetDirectory:dir});
});
test('review reports current blockers and sessions without running any mutation',async()=>{
  const f=fixture();f.setMerge({blockers:['Active writer'],state:'blocked'});f.setSessions([{id:'terminal:1',pageId:'main',pageName:'Main',label:'CLI',directory:dir,state:'tracked'}]);
  const r=await f.review('merge');assert.equal(r.review.state,'blocked');assert.deepEqual(r.review.blockers,['Active writer']);assert.equal(r.sessions[0].id,'terminal:1');assert.match(r.reviewHash,/^[a-f0-9]{64}$/);assert.deepEqual(f.effects,[]);
});
test('actions bind the page, target, Git state and sessions before delegating the underlying reviewed hash',async()=>{
  for(const change of [f=>{f.page.name='Changed';},f=>f.setMerge({hash:'b'.repeat(64)}),f=>f.setMerge({target:{directory:dir+'other',branch:'other',head:'c'.repeat(40)}}),f=>f.setSessions([{id:'new',pageId:'p',pageName:'P',label:'CLI',directory:dir,state:'tracked'}])]){
    const f=fixture(),r=await f.review('merge');change(f);
    await assert.rejects(f.command('page-action',{pageId:'p',action:'merge-start',targetDirectory:dir,reviewHash:r.reviewHash}),/changed after review/);assert.deepEqual(f.effects,[]);
  }
  for(const [action,extra] of [['merge-start',{}],['merge-complete',{}],['merge-abort',{confirmLoss:true}]]){
    const f=fixture(),r=await f.review('merge');const result=await f.command('page-action',{pageId:'p',action,targetDirectory:dir,reviewHash:r.reviewHash,...extra});
    assert.equal(result.applied,true);assert.deepEqual(f.effects,[['p',dir,digest,action.slice(6),!!extra.confirmLoss]]);
  }
});
test('finish, discard and delete remain separate explicit actions and keep engine guards',async()=>{
  const f=fixture(),review=await f.review('finish');
  await f.command('page-action',{pageId:'p',action:'archive',reviewHash:review.reviewHash});assert.deepEqual(f.effects,[['p',digest,false,false]]);
  const archived=await f.review('finish');await f.command('page-action',{pageId:'p',action:'remove-worktree',reviewHash:archived.reviewHash,sessionsClosed:true});assert.deepEqual(f.effects.at(-1),['p',digest,true,true]);
  const discard=await f.review('discard');await f.command('page-action',{pageId:'p',action:'discard',reviewHash:discard.reviewHash,branchName:'feat/p',confirmLoss:true,sessionsClosed:true});assert.deepEqual(f.effects.at(-1),['p',digest,'feat/p',true]);
  f.host.settings.pageRuns=[{pageId:'p',phase:'in_flight',uncertain:false}];const deletion=await f.review('delete');assert.match(deletion.review.blockers.join(),/unfinished/);
  await assert.rejects(f.command('page-action',{pageId:'p',action:'delete',reviewHash:deletion.reviewHash,confirmDelete:true}),/unfinished/);
  f.host.settings.pageRuns[0].phase='completed';f.page.worktreeRemoval={status:'pending'};
  assert.match((await f.review('delete')).review.blockers.join(),/removal is pending/);
  f.page.worktreeRemoval.status='removed';const valid=await f.review('delete');assert.deepEqual(valid.review.blockers,[]);
  await f.command('page-action',{pageId:'p',action:'delete',reviewHash:valid.reviewHash,confirmDelete:true});assert.deepEqual(f.host.settings.workPages,[]);
});
test('catalog drift during review and duplicate page identities never produce an actionable result',async()=>{
  const f=fixture(),read=f.host.reviewPageFinish;
  f.host.reviewPageFinish=async()=>{f.page.directory+='changed';return read();};await assert.rejects(f.review('finish'),/changed during review/);
  f.host.settings.workPages.push({...f.page});await assert.rejects(f.review('finish'),/ambiguous/);assert.deepEqual(f.effects,[]);
});
test('large reviews are bounded with explicit counts and truncation; errors are redacted',async()=>{
  const f=fixture();f.setMerge({targetFiles:Array.from({length:3000},(_,i)=>({path:'file'+i+'.ts',category:'project'})),details:'private-secret '+'.'.repeat(100000)});
  const r=await f.review('merge');assert.equal(r.review.targetFileCount,3000);assert.equal(r.truncated,true);assert.ok(Buffer.byteLength(JSON.stringify(r))<60000);assert.ok(!JSON.stringify(r).includes('private-secret'));
  f.host.reviewPageMerge=async()=>{throw Error('private-secret unavailable');};await assert.rejects(f.review('merge'),/\[REDACTED\] unavailable/);
});
function mailbox(t,f,manage=command=>managePage(f.host,command,()=>[]),execute=async()=>({runId:'run',workflowId:'w',phase:'completed',revision:1,nextStepId:null})){
  const runtime=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'autooc-page-management-'))),lease=acquireExecutionLease(runtime);
  const pump=createPluginRequestHost(lease,execute,undefined,()=>({maxConcurrentExecutions:1}),manage?{managePage:manage}:{});
  t.after(async()=>{pump.close();await pump.drain();lease.release();assert.equal(path.dirname(runtime),fs.realpathSync(os.tmpdir()));assert.match(path.basename(runtime),/^autooc-page-management-/);fs.rmSync(runtime,{recursive:true,force:true});});
  return {runtime,pump,lease};
}
test('mailbox capabilities reject legacy/absent owners before submission',async t=>{
  const f=fixture(),{runtime,pump}=mailbox(t,f,null);const command={command:'review-page',request:{pageId:'p',kind:'merge'}};
  await assert.rejects(requestPluginPageManagement(runtime,command),/does not support page management/);assert.equal(fs.readdirSync(pump.directory).filter(n=>n.endsWith('.request')).length,0);
  await assert.rejects(requestPluginPageManagement(path.join(runtime,'absent'),command),/Enable a compatible AutoOC/);
});
test('real mailbox persists page reviews/actions, exposes requestId and reinspection never replays effects',async t=>{
  const f=fixture(),{runtime,pump}=mailbox(t,f);let submitted;
  const pending=requestPluginPageManagement(runtime,{command:'review-page',request:{pageId:'p',kind:'merge'}},id=>{submitted=id;});
  await pump.poll();await pump.drain();const review=await pending;assert.equal(review.requestId,submitted);
  const action=requestPluginPageManagement(runtime,{command:'page-action',request:{pageId:'p',action:'merge-start',targetDirectory:dir,reviewHash:review.reviewHash}});
  await pump.poll();await pump.drain();const result=await action;assert.equal(result.applied,true);assert.equal(f.effects.length,1);
  for(let i=0;i<2;i++){const inspected=inspectPluginRequest(runtime,{requestId:result.requestId,includeOutput:true});assert.equal(inspected.state,'finished');assert.equal(inspected.pageManagement.applied,true);await pump.poll();}
  assert.equal(f.effects.length,1);
  assert.equal(inspectPluginRequest(runtime,{requestId:review.requestId}).pageManagement.review,undefined);
  assert.equal(inspectPluginRequest(runtime,{requestId:review.requestId,includeOutput:true}).pageManagement.review.target.directory,dir);
});
test('reviews remain available at execution capacity while mutation requests cannot bypass exclusivity',async t=>{
  const f=fixture();let finish;const gate=new Promise(r=>{finish=r;});
  const {runtime,pump}=mailbox(t,f,undefined,async()=>{await gate;return {runId:'run',workflowId:'w',phase:'completed',revision:1,nextStepId:null};});
  const run=requestPluginExecution(runtime,{command:'run',workflowId:'w'});await pump.poll();
  try {
    const read=requestPluginPageManagement(runtime,{command:'review-page',request:{pageId:'p',kind:'finish'}});await pump.poll();const review=await read;
    const action=requestPluginPageManagement(runtime,{command:'page-action',request:{pageId:'p',action:'archive',reviewHash:review.reviewHash}});const rejected=assert.rejects(action,/limit|exclusive/);
    await pump.poll();await rejected;assert.deepEqual(f.effects,[]);
  }finally{finish();await pump.drain();await run;}
});
test('failed mutations retain their receipt as uncertain and report the concrete redacted diagnostic',async t=>{
  const f=fixture(),{runtime,pump}=mailbox(t,f);const review=await f.review('merge');let submitted;
  f.host.executePageMerge=async()=>{f.effects.push('partial');throw Error('private-secret Git hook failed');};
  const action=requestPluginPageManagement(runtime,{command:'page-action',request:{pageId:'p',action:'merge-start',targetDirectory:dir,reviewHash:review.reviewHash}},id=>{submitted=id;});
  const rejected=assert.rejects(action,/\[REDACTED\] Git hook failed/);await pump.poll();await pump.drain();await rejected;
  const inspection=inspectPluginRequest(runtime,{requestId:submitted,includeOutput:true});assert.equal(inspection.state,'unknown');assert.equal(inspection.receiptStatus,'failed');assert.match(inspection.error,/Git hook/);assert.equal(inspection.pageManagement,undefined);
  await pump.poll();assert.deepEqual(f.effects,['partial']);
});
test('interrupting the CLI wait does not cancel or replay an accepted page mutation',async t=>{
  const f=fixture();let finish;const gate=new Promise(r=>{finish=r;});
  f.host.executePageMerge=async()=>{f.effects.push('start');await gate;return {output:'done',review:await f.host.reviewPageMerge()};};
  const {runtime,pump}=mailbox(t,f),review=await f.review('merge'),controller=new AbortController();let submitted;
  const pending=requestPluginPageManagement(runtime,{command:'page-action',request:{pageId:'p',action:'merge-start',targetDirectory:dir,reviewHash:review.reviewHash}},id=>{submitted=id;},controller.signal);
  const rejected=assert.rejects(pending,/may continue/);
  try {
    await pump.poll();await new Promise(r=>setImmediate(r));controller.abort();await rejected;
    assert.equal(inspectPluginRequest(runtime,{requestId:submitted}).receiptStatus,'accepted');
  }finally{finish();await pump.drain();}
  assert.equal(inspectPluginRequest(runtime,{requestId:submitted}).pageManagement.applied,true);await pump.poll();assert.deepEqual(f.effects,['start']);
});
