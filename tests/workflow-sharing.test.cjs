const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),Module=require('node:module'),ts=require('typescript'),{randomUUID}=require('node:crypto');
const cache=new Map();
function load(name){const file=path.resolve(__dirname,'..',name+'.ts');if(cache.has(file))return cache.get(file).exports;const mod=new Module(file,module);cache.set(file,mod);mod.filename=file;mod.paths=module.paths;mod.require=n=>n.startsWith('.')?load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(file),n))):require(n);mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);return mod.exports;}
const core=load('workflow-sharing'),{WorkflowSharingService,validSharingCommand}=load('workflow-sharing-service');
function catalog(prefix='a'){
  return {tasks:[{id:prefix+'t',name:'Summarize',taskKind:'code',prompt:'old',code:'return input;',codeLang:'javascript',codeAllowVault:false,codeAllowFiles:false,codeAllowTerminal:false,model:'local-model',agent:'local-agent',workingDirectory:'C:/private-project',scheduleType:'daily',scheduleTime:'09:00',status:'completed',output:'PRIVATE OUTPUT',lastRun:'yesterday',disabled:false}],workflows:[{id:prefix+'w',name:'Delivery',description:'v1',steps:[{id:'step',stepKind:'task',taskId:prefix+'t',transitions:[],status:'completed',output:'PRIVATE STEP'}],status:'completed',output:'PRIVATE WORKFLOW',scheduleType:'daily',disabled:false}],secret:'PRIVATE SECRET'};
}
function peer(t,base,name){
  const root=fs.mkdtempSync(path.join(base,name+'-')),c=catalog(name);let persisted,fail=false,blocked=false,saves=0;const notices=[];
  const service=new WorkflowSharingService({catalog:()=>c,runtimeDirectory:()=>root,transaction:async op=>op(),save:async validate=>{validate?.();if(fail)throw Error('save failed');persisted=JSON.parse(JSON.stringify(c));saves++;},assertReady:plan=>{if(plan&&blocked)throw Error('Affected execution active');},validate:()=>{},refresh:()=>{},notify:s=>notices.push(s)});
  t.after(()=>service.close());return {c,service,root,notices,get persisted(){return persisted;},get saves(){return saves;},fail:v=>fail=v,block:v=>blocked=v};
}
async function setup(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-sharing-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const directory=path.join(root,'library'),a=peer(t,root,'a'),b=peer(t,root,'b');for(const p of [a,b])await p.service.execute({action:'connect',directory,projectName:p===a?'Inncrea':'AutoOC',allowPush:true});return {root,directory,a,b,store:await core.ShareStore.connect(directory,a.c.workflowSharing.libraryId)};}
async function publish(a,prior){return a.service.execute({action:'publish',...(prior?{bundleId:prior.bundleId}:{}),workflowIds:['aw'],taskIds:[],name:'SDLC',note:prior?'Improved':'Initial',expectedParent:prior?.hash||null});}
async function link(b,v){const mapping=Object.fromEntries([...v.tasks.map(t=>['task:'+t.id,'bt']),...v.workflows.map(w=>['workflow:'+w.id,'bw'])]);const r=await b.service.execute({action:'review',bundleId:v.bundleId,revision:v.revision,hash:v.hash,mapping});return b.service.execute({action:'apply',bundleId:v.bundleId,revision:v.revision,hash:v.hash,mapping:r.mapping,reviewHash:r.reviewHash,replaceLocal:true,acceptPermissions:true});}
async function send(a,b,v,replaceLocal=false){const status=await b.service.execute({action:'status'}),binding=status.installed.find(x=>x.bundleId===v.bundleId);return a.service.execute({action:'distribute',bundleId:v.bundleId,revision:v.revision,hash:v.hash,replaceLocal,targets:[{projectId:b.c.workflowSharing.projectId,localHash:binding.localHash}]});}

test('first link preserves IDs, local preferences, results and history; backup precedes save',async t=>{
  const {a,b,store}=await setup(t),v=await publish(a);assert.equal(v.revision,1);const raw=JSON.stringify(await store.version(v.bundleId,v.revision,v.hash));for(const privateValue of ['PRIVATE OUTPUT','PRIVATE SECRET','PRIVATE STEP','PRIVATE WORKFLOW','local-model','local-agent','C:/private-project'])assert.ok(!raw.includes(privateValue));
  await link(b,v);assert.equal(b.c.tasks.length,1);assert.equal(b.c.workflows.length,1);assert.equal(b.c.tasks[0].id,'bt');assert.equal(b.c.workflows[0].steps[0].taskId,'bt');assert.equal(b.c.tasks[0].model,'local-model');assert.equal(b.c.tasks[0].workingDirectory,'C:/private-project');assert.equal(b.c.tasks[0].scheduleType,'daily');assert.equal(b.c.tasks[0].disabled,false);assert.equal(b.c.tasks[0].output,'PRIVATE OUTPUT');assert.equal(b.c.workflows[0].steps[0].output,'PRIVATE STEP');assert.equal(fs.readdirSync(path.join(b.root,'sharing-backups')).length,1);assert.deepEqual(b.persisted,b.c);
});
test('publish v2, notify, distribute from source, apply once and acknowledge after durable save',async t=>{
  const {a,b,store}=await setup(t),v1=await publish(a);await link(b,v1);a.c.tasks[0].code='return "improved";';const v2=await publish(a,v1);await b.service.poll();assert.match(b.notices[0],/version 2/);assert.equal(b.c.tasks[0].code,'return input;');const result=await send(a,b,v2);assert.equal(result.deliveries[0].state,'pending');await b.service.poll();assert.equal(b.c.tasks[0].code,'return "improved";');const writes=b.saves;await b.service.poll();assert.equal(b.saves,writes);assert.equal(b.c.tasks.length,1);const d=(await store.deliveries())[0];assert.equal((await store.receipt(d)).state,'applied');assert.equal(b.persisted.workflowSharing.bindings[v1.bundleId].revision,2);
});
test('local changes require explicit replacement; later edits invalidate sender review',async t=>{
  const {a,b,store}=await setup(t),v1=await publish(a);await link(b,v1);b.c.tasks[0].code='local edit';a.c.tasks[0].code='incoming';const v2=await publish(a,v1);
  assert.equal((await send(a,b,v2)).deliveries[0].state,'rejected');await send(a,b,v2,true);b.c.tasks[0].code='later edit';await b.service.poll();assert.equal(b.c.tasks[0].code,'later edit');assert.equal((await store.receipt((await store.deliveries())[0])).state,'review');
  await send(a,b,v2,true);await b.service.poll();assert.equal(b.c.tasks[0].code,'incoming');
});
test('affected execution postpones distribution, then same delivery completes; unrelated terminal claims do not block',async t=>{
  const {a,b,store}=await setup(t),v1=await publish(a);await link(b,v1);a.c.tasks[0].code='v2';const v2=await publish(a,v1);b.c.pageTerminalClaims=[{id:'unrelated'}];b.block(true);await send(a,b,v2);await b.service.poll();const d=(await store.deliveries())[0];assert.equal((await store.receipt(d)).state,'pending');assert.equal(b.c.tasks[0].code,'return input;');b.block(false);await b.service.poll();assert.equal((await store.receipt(d)).state,'applied');assert.equal(b.c.pageTerminalClaims.length,1);
});
test('closed target remains pending and processes the original delivery after reopening',async t=>{
  const {a,b,store}=await setup(t),v1=await publish(a);await link(b,v1);a.c.tasks[0].code='v2';const v2=await publish(a,v1);await send(a,b,v2);const d=(await store.deliveries())[0];assert.equal(await store.receipt(d),undefined);assert.equal(b.c.workflowSharing.bindings[v1.bundleId].revision,1);await b.service.poll();assert.equal((await store.receipt(d)).state,'applied');
});
test('increased permissions and changed engine require review at target even with replace enabled',async t=>{
  const {a,b,store}=await setup(t),v1=await publish(a);await link(b,v1);a.c.tasks[0].codeAllowTerminal=true;const v2=await publish(a,v1);await send(a,b,v2,true);await b.service.poll();assert.equal(b.c.tasks[0].codeAllowTerminal,false);assert.equal((await store.receipt((await store.deliveries())[0])).state,'review');
  const req={bundleId:v2.bundleId,revision:v2.revision,hash:v2.hash};const r=await b.service.execute({action:'review',...req});await assert.rejects(b.service.execute({action:'apply',...req,mapping:r.mapping,reviewHash:r.reviewHash,replaceLocal:false,acceptPermissions:false}),/permissions/);await b.service.execute({action:'apply',...req,mapping:r.mapping,reviewHash:r.reviewHash,replaceLocal:false,acceptPermissions:true});assert.equal(b.c.tasks[0].codeAllowTerminal,true);
});
test('failed save restores definitions and binding and never reports applied',async t=>{
  const {a,b,store}=await setup(t),v1=await publish(a);await link(b,v1);const before=JSON.stringify(b.c);a.c.tasks[0].code='v2';const v2=await publish(a,v1);await send(a,b,v2);b.fail(true);await b.service.poll();assert.equal(JSON.stringify(b.c),before);assert.equal((await store.receipt((await store.deliveries())[0])).state,'review');
});
test('missing explicit mappings reject duplicate-name imports; stale review rejects edits',async t=>{
  const {a,b}=await setup(t),v=await publish(a),req={bundleId:v.bundleId,revision:v.revision,hash:v.hash};await assert.rejects(b.service.execute({action:'review',...req}),/explicitly/);
  const mapping=Object.fromEntries([...v.tasks.map(t=>['task:'+t.id,'bt']),...v.workflows.map(w=>['workflow:'+w.id,'bw'])]);const r=await b.service.execute({action:'review',...req,mapping});b.c.workflows[0].description='local';await assert.rejects(b.service.execute({action:'apply',...req,mapping:r.mapping,reviewHash:r.reviewHash,replaceLocal:true,acceptPermissions:true}),/changed/);assert.equal(b.c.tasks.length,1);
});
test('new identities are deterministic, disabled, manual and linked without duplicates',async t=>{
  const {a,b}=await setup(t);b.c.tasks=[];b.c.workflows=[];const v=await publish(a),req={bundleId:v.bundleId,revision:v.revision,hash:v.hash};const r=await b.service.execute({action:'review',...req});await b.service.execute({action:'apply',...req,mapping:r.mapping,reviewHash:r.reviewHash,replaceLocal:false,acceptPermissions:true});assert.equal(b.c.tasks[0].disabled,true);assert.equal(b.c.tasks[0].scheduleType,'manual');assert.equal(b.c.tasks[0].workingDirectory,undefined);const id=b.c.tasks[0].id;const again=await b.service.execute({action:'review',...req});await b.service.execute({action:'apply',...req,mapping:again.mapping,reviewHash:again.reviewHash,replaceLocal:false,acceptPermissions:true});assert.equal(b.c.tasks[0].id,id);assert.equal(b.c.tasks.length,1);
});
test('a destination can publish its improvement; stale concurrent publication is rejected',async t=>{
  const {a,b}=await setup(t),v=await publish(a);await link(b,v);b.c.tasks[0].code='from destination';const v2=await b.service.execute({action:'publish',bundleId:v.bundleId,expectedParent:v.hash,name:'SDLC',note:'Destination improvement',workflowIds:['bw'],taskIds:[]});assert.equal(v2.revision,2);await assert.rejects(publish(a,v),/newer version/);
});
test('nested workflows and shared tasks travel once and references map to local identities',async t=>{
  const {a,b}=await setup(t);a.c.workflows.push({id:'child',name:'Child',steps:[{id:'childstep',stepKind:'task',taskId:'at',transitions:[]}]});a.c.workflows[0].steps=[{id:'call',stepKind:'workflow',workflowId:'child',transitions:[]}];b.c.tasks=[];b.c.workflows=[];const v=await publish(a);assert.equal(v.tasks.length,1);assert.equal(v.workflows.length,2);const req={bundleId:v.bundleId,revision:v.revision,hash:v.hash},r=await b.service.execute({action:'review',...req});await b.service.execute({action:'apply',...req,mapping:r.mapping,reviewHash:r.reviewHash,replaceLocal:false,acceptPermissions:true});const parent=b.c.workflows.find(w=>w.name==='Delivery'),child=b.c.workflows.find(w=>w.name==='Child');assert.equal(parent.steps[0].workflowId,child.id);assert.equal(child.steps[0].taskId,b.c.tasks[0].id);
});
test('tampered revisions, wrong library identities and interrupted publication lock fail closed',async t=>{
  const {a,directory,store}=await setup(t),v=await publish(a);await assert.rejects(core.ShareStore.connect(directory,randomUUID()),/identity/);fs.mkdirSync(path.join(directory,'publish.lock'));await assert.rejects(publish(a,v),/publication/);fs.rmdirSync(path.join(directory,'publish.lock'));const file=path.join(directory,'versions',`${v.bundleId}-1.json`),value=JSON.parse(fs.readFileSync(file));value.payload.tasks[0].code='tampered';fs.writeFileSync(file,JSON.stringify(value));await assert.rejects(store.latest(v.bundleId),/changed/);
});
test('unsupported request fields, malformed mappings and implicit confirmations are rejected',()=>{
  assert.equal(validSharingCommand({command:'share-workflows',request:{action:'connect',directory:path.resolve(os.tmpdir()),projectName:'A',allowPush:true}}),true);
  assert.equal(validSharingCommand({command:'share-workflows',request:{action:'connect',directory:path.resolve(os.tmpdir()),projectName:'A'}}),false);
  assert.equal(validSharingCommand({command:'share-workflows',request:{action:'status',force:true}}),false);
  assert.equal(validSharingCommand({command:'share-workflows',request:{action:'apply',bundleId:randomUUID(),revision:1,hash:'a'.repeat(64),reviewHash:'a'.repeat(64),mapping:{'__proto__':'bad'},replaceLocal:true}}),false);
});
test('publishing overlapping collections and withdrawing linked members are rejected before publication',async t=>{
  const {a,store}=await setup(t),v=await publish(a);await assert.rejects(publish(a),/already belongs/);
  await assert.rejects(a.service.execute({action:'publish',bundleId:v.bundleId,workflowIds:[],taskIds:['at'],expectedParent:v.hash,name:'SDLC',note:'Remove workflow'}),/retains all linked/);assert.equal((await store.heads()).length,1);assert.equal((await store.latest(v.bundleId)).revision,1);
});
test('copied project connection must reconnect with a distinct project identity',async t=>{
  const {a,b,directory}=await setup(t);b.c.workflowSharing=JSON.parse(JSON.stringify(a.c.workflowSharing));await assert.rejects(b.service.execute({action:'status'}),/copied from another installation/);
  await b.service.execute({action:'connect',directory,projectName:'Copied project',allowPush:true});assert.notEqual(a.c.workflowSharing.projectId,b.c.workflowSharing.projectId);
});
test('polling reads the lightweight index; corrupt payload blocks apply without blocking unrelated status',async t=>{
  const {a,b,directory,store}=await setup(t),v=await publish(a);await link(b,v);a.c.tasks[0].code='v2';const v2=await publish(a,v);await send(a,b,v2);
  const file=path.join(directory,'versions',`${v2.bundleId}-2.json`);fs.writeFileSync(file,'broken');assert.equal((await b.service.execute({action:'status'})).collections[0].revision,2);await b.service.poll();assert.equal(b.c.tasks[0].code,'return input;');assert.equal((await store.receipt((await store.deliveries())[0])).state,'review');
});
test('local preferences edited after review invalidate apply, and unrelated edits survive a failed save',async t=>{
  const {a,b,store}=await setup(t),v=await publish(a);await link(b,v);a.c.tasks[0].code='incoming';const v2=await publish(a,v),revision=await store.version(v2.bundleId,v2.revision,v2.hash),plan=core.reviewSharedVersion(b.c,revision);b.c.tasks[0].model='new preference';
  await assert.rejects(core.applySharedVersion({catalog:b.c,assertReady:()=>{},validate:()=>{},backup:async()=>{},save:async()=>{}},plan,{replaceLocal:true,acceptPermissions:true}),/changed since review/);assert.equal(b.c.tasks[0].code,'return input;');
  const refreshed=core.reviewSharedVersion(b.c,revision);await assert.rejects(core.applySharedVersion({catalog:b.c,assertReady:()=>{},validate:()=>{},backup:async()=>{},save:async()=>{b.c.tasks.push({id:'unrelated',name:'Keep me'});throw Error('save failed');}},refreshed,{replaceLocal:true,acceptPermissions:true}),/save failed/);assert.equal(b.c.tasks[0].code,'return input;');assert.equal(b.c.tasks[0].model,'new preference');assert.equal(b.c.tasks[1].id,'unrelated');assert.equal(b.c.workflowSharing.bindings[v.bundleId].revision,1);
});
test('an older loaded owner is rejected before submission and a closed owner has no standalone fallback',async t=>{
  const {acquireExecutionLease}=load('execution-lease'),{createPluginRequestHost,requestPluginSharing}=load('cli-plugin-requests');
  const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'autooc-sharing-old-owner-'))),lease=acquireExecutionLease(root);const pump=createPluginRequestHost(lease,async()=>{throw Error('Unexpected execution');});
  t.after(async()=>{pump.close();await pump.drain();lease.release();fs.rmSync(root,{recursive:true,force:true});});
  await assert.rejects(requestPluginSharing(root,{action:'status'}),/does not support shared workflows/);assert.equal(fs.readdirSync(pump.directory).filter(n=>n.endsWith('.request')).length,0);
  await assert.rejects(requestPluginSharing(path.join(root,'absent'),{action:'status'}),/no standalone catalog writes/);
});
test('failed advertisement after a durable apply reports applied with a warning, not a failed mutation',async t=>{
  const {a,b}=await setup(t),v=await publish(a);await link(b,v);a.c.tasks[0].code='v2';const v2=await publish(a,v),req={bundleId:v2.bundleId,revision:v2.revision,hash:v2.hash},r=await b.service.execute({action:'review',...req});
  const original=core.ShareStore.prototype.advertise;core.ShareStore.prototype.advertise=async()=>{throw Error('Folder offline');};
  try{const result=await b.service.execute({action:'apply',...req,mapping:r.mapping,reviewHash:r.reviewHash,replaceLocal:false,acceptPermissions:false});assert.equal(result.applied,true);assert.match(result.warning,/Saved locally/);assert.equal(b.persisted.tasks[0].code,'v2');}finally{core.ShareStore.prototype.advertise=original;}
});
