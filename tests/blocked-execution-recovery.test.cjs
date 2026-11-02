const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(name){
  const file=path.join(root,name+'.ts');if(cache.has(file))return cache.get(file).exports;
  const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(root);cache.set(file,m);
  const original=m.require.bind(m);m.require=name=>name.startsWith('./')?load(name.slice(2)):original(name);
  m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);return m.exports;
}
async function fixture(t,phase='ready'){
  const vault=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'autooc-reset-')));
  const directory=path.join(vault,'.obsidian/plugins/auto-oc'),runtime=path.join(directory,'runtime');fs.mkdirSync(runtime,{recursive:true});
  t.after(()=>{assert.equal(path.dirname(vault),fs.realpathSync.native(os.tmpdir()));assert.ok(path.basename(vault).startsWith('autooc-reset-'));fs.rmSync(vault,{recursive:true,force:true});});
  const lease=load('execution-lease').acquireExecutionLease(runtime);
  const workflow={id:'wf',name:'Synthetic workflow',disabled:false,status:'pending',steps:[
    {id:'a',stepKind:'code',code:'output = "PRIVATE_CODE";'},
    {id:'b',stepKind:'code',code:'output = 2;'}]};
  const catalog={tasks:[],workflows:[workflow],custom:'preserved'};
  const hash=load('workflow-definition').prepareWorkflowDefinition(workflow,[],catalog).hash;
  const journal=await load('execution-journal').ExecutionJournal.create(lease,'wf',hash,'a');
  await journal.begin('a');
  if(phase==='ready'){await journal.recordResult({succeeded:true,output:'PRIVATE_OUTPUT'});await journal.finish('a',true,'PRIVATE_OUTPUT','b');}
  if(phase==='failed'){await journal.recordResult({succeeded:false,output:'PRIVATE_OUTPUT',cancelled:true});await journal.finish('a',false,'PRIVATE_OUTPUT',null);}
  const state=journal.snapshot();workflow.runtimeExecution={runId:state.runId,workflowId:'wf',definitionHash:hash,phase:state.phase,revision:state.revision};
  const file=path.join(directory,'data.json');fs.writeFileSync(file,JSON.stringify(catalog));
  const location=load('installed-workflow-location').resolveInstalledWorkflowLocation(vault),api=load('blocked-execution-recovery');
  const inspect=()=>api.inspectBlockedExecutions(location);
  const read=()=>load('execution-journal').readExecutionCheckpoint(runtime,state.runId);
  return {vault,directory,runtime,lease,catalog,file,state,journal,location,api,inspect,read};
}

for(const phase of ['ready','in_flight','failed'])test(`direct reset preserves ${phase} evidence and never writes the catalog`,async t=>{
  const h=await fixture(t,phase),before=fs.readFileSync(h.file),original=h.read(),inspection=await h.inspect();
  assert.equal(inspection.attempts.length,1);assert.doesNotMatch(JSON.stringify(inspection),/PRIVATE_/);
  assert.equal(inspection.attempts[0].completedSteps,phase==='ready'?1:0);
  await h.api.resetBlockedAttempt(inspection,inspection.attempts[0],h.lease,'Original work ended; close this attempt',true,()=>{});
  const result=h.read(),decision=phase==='failed'?result.disposition:result.abandonment;
  assert.equal(result.phase,phase==='failed'?'failed':'abandoned');assert.equal(decision.outcome,'unknown');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(h.runtime,decision.snapshot))),original);
  assert.deepEqual(result.steps,original.steps);assert.deepEqual(fs.readFileSync(h.file),before);
  assert.equal((await h.inspect()).attempts.length,0);
  await assert.rejects(h.api.resetBlockedAttempt(inspection,inspection.attempts[0],h.lease,'repeat',true,()=>{}),/Attempt changed/);
  h.lease.release();
});

for(const change of ['catalog','revision','owner','write','intent','update','activity','acknowledgement','reason','installation'])test(`review rejects ${change} changes before closing an attempt`,async t=>{
  const h=await fixture(t),inspection=await h.inspect(),attempt=inspection.attempts[0];
  let expected=h.read();
  if(change==='catalog')fs.writeFileSync(h.file,JSON.stringify({...h.catalog,custom:'new user edit'}));
  if(change==='revision'){await h.journal.begin('b');expected=h.read();}
  if(change==='owner')fs.writeFileSync(path.join(h.runtime,'execution.lock/owner.json'),JSON.stringify({...inspection.owner,token:require('crypto').randomUUID()}));
  if(change==='write')fs.writeFileSync(h.file+'.write-lock','uncertain');
  if(change==='intent')fs.writeFileSync(h.file+'.write-intent','uncertain');
  if(change==='update')fs.writeFileSync(path.join(h.runtime,'update-pending.json'),'{}');
  if(change==='installation')inspection.location.runtimeIdentity='changed';
  await assert.rejects(h.api.resetBlockedAttempt(inspection,attempt,h.lease,change==='reason'?'':'Reviewed',change!=='acknowledgement',()=>{
    if(change==='activity')throw Error('Active work');
  }));
  assert.deepEqual(h.read(),expected);
  assert.equal(fs.readdirSync(h.runtime).some(n=>n.startsWith('abandonment-')),false);
});

test('another live owner cannot replace the owner observed in the review',async t=>{
  const h=await fixture(t),inspection=await h.inspect();h.lease.release();
  const next=load('execution-lease').acquireExecutionLease(h.runtime);
  assert.throws(()=>h.api.assertBlockedInspection(inspection,true),/owner changed/);next.release();
});

test('explicit new work is possible after reset while the abandoned identity cannot resume',async t=>{
  const h=await fixture(t),inspection=await h.inspect();
  await h.api.resetBlockedAttempt(inspection,inspection.attempts[0],h.lease,'Synthetic decision',true,()=>{});h.lease.release();
  const {runInstalledWorkflow}=load('installed-workflow-host');
  await assert.rejects(runInstalledWorkflow({vault:h.vault,workflowId:'wf',resumeRunId:h.state.runId,redact:text=>text}),/abandoned|terminal/i);
  const result=await runInstalledWorkflow({vault:h.vault,workflowId:'wf',newExecution:true,redact:text=>text});
  assert.equal(result.phase,'completed');assert.notEqual(result.runId,h.state.runId);assert.equal(h.read().phase,'abandoned');
});

function ui(){
  class Element {
    constructor(options={}){this.textContent=options.text||'';this.children=[];this.style={};this.attrs={};}
    createEl(tag,options){const el=new Element(options);el.tag=tag;this.children.push(el);return el;}
    createDiv(cls){const el=this.createEl('div');el.cls=cls;return el;}
    empty(){this.children=[];} addClass(){} setAttr(k,v){this.attrs[k]=v;}
    all(){return [this,...this.children.flatMap(el=>el.all())];}
  }
  const opened=[],notices=[],mod={exports:{}};
  class Stub{}
  const obsidian={Plugin:Stub,ItemView:Stub,PluginSettingTab:Stub,Setting:Stub,Notice:class{constructor(text){notices.push(text);}},
    Modal:class{constructor(){this.contentEl=new Element();}open(){opened.push(this);this.rendered=this.onOpen();}close(){this.onClose();}}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'main.js'),'utf8')+'\nmodule.exports.testing={BlockedExecutionModal,AutoOCRecoveryView,ConfirmModal};',{
    module:mod,exports:mod.exports,require:id=>id==='obsidian'?obsidian:require(id),process,Buffer,console,setTimeout,clearTimeout,setInterval,clearInterval,AbortController,
    window:{setTimeout,clearTimeout,setInterval,clearInterval}});
  return {...mod.exports.testing,Plugin:mod.exports.default,opened,notices,Element};
}

test('reset review is available in consultation and requires a distinct confirmation',async t=>{
  const h=await fixture(t),u=ui(),p=new u.Plugin();
  Object.assign(p,{app:{},settings:h.catalog,ready:true,manifest:{version:'1.7.18'},pluginExecutionLease:h.lease,
    selectedExecutionLocation:()=>h.location,loadSettings:async()=>{},refreshOpenViews(){}});
  let allow=false,confirmations=0;
  u.ConfirmModal.prototype.openAndWait=async function(){confirmations++;this.reason='Original terminal ended';return allow;};
  p.openBlockedExecutionsReview(h.state.runId);let modal=u.opened[0];await modal.rendered;
  assert.ok(modal.contentEl.all().some(e=>e.textContent==='Selected attempt'));
  const button=modal.contentEl.all().find(e=>e.textContent==='Reset this attempt…');assert.ok(button);
  await button.onclick();assert.equal(confirmations,1);assert.equal(h.read().phase,'ready');
  allow=true;await button.onclick();assert.equal(h.read().phase,'abandoned');
  assert.ok(u.notices.some(n=>n.includes('Nothing was started')));h.lease.release();
});

test('confirmation refuses newly active work without touching the attempt',async t=>{
  const h=await fixture(t),u=ui(),p=new u.Plugin();
  Object.assign(p,{app:{},settings:h.catalog,ready:true,pluginExecutionLease:h.lease,selectedExecutionLocation:()=>h.location});
  const inspection=await h.inspect();
  u.ConfirmModal.prototype.openAndWait=async function(){this.reason='Human decision';p.runningProcesses.set('other',{});return true;};
  await assert.rejects(p.confirmResetBlockedAttempt(inspection,inspection.attempts[0]),/Active work/);
  assert.equal(h.read().phase,'ready');h.lease.release();
});

test('consultation view offers recovery without executing it on open',async()=>{
  const u=ui();let actions=0;
  const view=new u.AutoOCRecoveryView({},'Unfinished execution',async()=>{},undefined,false,true,
    async()=>({tasks:[],workflows:[]}),undefined,()=>{actions++;});
  view.contentEl=new u.Element();await view.onOpen();assert.equal(actions,0);
  const button=view.contentEl.all().find(e=>e.textContent==='Resolve blocked executions');assert.ok(button);
  button.onclick();assert.equal(actions,1);
});

test('reconnect in consultation keeps the ready checkpoint and releases only its own quiet reservation',async t=>{
  const h=await fixture(t),u=ui(),p=new u.Plugin();
  Object.assign(p,{app:{},settings:h.catalog,ready:false,startupError:'Unfinished execution',lifecycleStopped:true,
    pluginExecutionLease:h.lease,pluginExecutionLocation:h.location,selectedExecutionLocation:()=>h.location});
  const before=fs.readFileSync(h.file),state=h.read();let reloaded=0;
  p.retryLoadingAutoOC=async()=>{assert.equal(fs.existsSync(path.join(h.runtime,'execution.lock')),false);reloaded++;};
  await p.withRecoveryLease(await h.inspect(),async()=>{});
  assert.equal(reloaded,1);assert.deepEqual(h.read(),state);assert.deepEqual(fs.readFileSync(h.file),before);
});

test('consultation cannot take an unregistered live owner, even in the same process',async t=>{
  const h=await fixture(t),u=ui(),p=new u.Plugin();
  Object.assign(p,{app:{},ready:false,startupError:'Reserved',lifecycleStopped:true,selectedExecutionLocation:()=>h.location});
  const owner=fs.readFileSync(path.join(h.runtime,'execution.lock/owner.json'));
  await assert.rejects(p.withRecoveryLease(await h.inspect(),async()=>{throw Error('must not execute');}),/live or cannot/);
  assert.deepEqual(fs.readFileSync(path.join(h.runtime,'execution.lock/owner.json')),owner);h.lease.release();
});

for(const mode of ['reconnect','reset','still-stopping'])test(`consultation handles a retained stopped predecessor: ${mode}`,async t=>{
  const h=await fixture(t),u=ui(),previous=new u.Plugin(),p=new u.Plugin();
  Object.assign(previous,{app:{workspace:{detachLeavesOfType(){}}},settings:h.catalog,ready:true,
    pluginExecutionLease:h.lease,pluginExecutionLocation:h.location,selectedExecutionLocation:()=>h.location,
    executionAttempted:true,stopMcpBridge:async()=>{}});
  await previous.onunload();assert.equal(fs.existsSync(path.join(h.runtime,'execution.lock')),true);
  Object.assign(p,{app:{},ready:false,startupError:'Unfinished execution',lifecycleStopped:true,selectedExecutionLocation:()=>h.location});
  let reloads=0;p.retryLoadingAutoOC=async()=>{reloads++;};
  const inspection=await h.inspect();
  if(mode==='still-stopping')previous.sharedCompletions.add(Promise.resolve());
  const operation=p.withRecoveryLease(inspection,async(lease,idle)=>{
    if(mode==='reset')await h.api.resetBlockedAttempt(inspection,inspection.attempts[0],lease,'Explicit reset',true,idle);
  });
  if(mode==='still-stopping'){
    await assert.rejects(operation,/still stopping/);assert.equal(reloads,0);assert.equal(h.read().phase,'ready');
    previous.sharedCompletions.clear();previous.releasePluginExecution(false);
  }else{
    await operation;assert.equal(reloads,1);assert.equal(fs.existsSync(path.join(h.runtime,'execution.lock')),false);
    assert.equal(h.read().phase,mode==='reset'?'abandoned':'ready');
  }
});

test('shutdown waits for a recovery operation and cancels it before effects',async t=>{
  const h=await fixture(t),u=ui(),p=new u.Plugin();
  Object.assign(p,{app:{workspace:{detachLeavesOfType(){}}},settings:h.catalog,ready:true,pluginExecutionLease:h.lease,
    pluginExecutionLocation:h.location,selectedExecutionLocation:()=>h.location,stopMcpBridge:async()=>{}});
  let entered,finish;const started=new Promise(r=>entered=r),gate=new Promise(r=>finish=r);
  const operation=p.withRecoveryLease(await h.inspect(),async(lease,idle)=>{entered();await gate;idle();});
  const rejection=assert.rejects(operation,/Active work/);
  await started;const closing=p.onunload();
  assert.equal(fs.existsSync(path.join(h.runtime,'execution.lock')),true);finish();
  await rejection;await closing;assert.equal(h.read().phase,'ready');p.releasePluginExecution(false);
});

test('a concurrent local edit is preserved after a durable reset',async t=>{
  const h=await fixture(t),u=ui(),p=new u.Plugin();let loaded=false;
  Object.assign(p,{app:{},settings:h.catalog,ready:true,pluginExecutionLease:h.lease,
    selectedExecutionLocation:()=>h.location,loadSettings:async()=>{loaded=true;}});
  const inspection=await h.inspect();
  await assert.rejects(p.withRecoveryLease(inspection,async(lease,idle)=>{
    await h.api.resetBlockedAttempt(inspection,inspection.attempts[0],lease,'Explicit reset',true,idle);
    p.settings.custom='Concurrent user edit';
  }),/Local edits were preserved/);
  assert.equal(h.read().phase,'abandoned');assert.equal(loaded,false);assert.equal(p.settings.custom,'Concurrent user edit');h.lease.release();
});

test('a ready checkpoint cannot offer continuation after the workflow definition changes',async t=>{
  const h=await fixture(t),u=ui(),p=new u.Plugin();
  Object.assign(p,{settings:h.catalog,selectedExecutionLocation:()=>h.location});
  assert.equal(p.sharedWorkflowRecoveryMode('wf',h.state.runId),'resume');
  h.catalog.workflows[0].steps[1].code='output = "Edited definition";';
  assert.equal(p.sharedWorkflowRecoveryMode('wf',h.state.runId),'blocked');
  assert.equal(h.read().phase,'ready');assert.equal(h.read().revision,h.state.revision);h.lease.release();
});
