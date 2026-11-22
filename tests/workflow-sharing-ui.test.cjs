const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {randomUUID}=require('node:crypto');
function harness(){
  class Element{
    constructor(tag='div',options={}){this.tag=tag;this.textContent=options.text||'';this.children=[];this.style={};this.value='';this.isConnected=true;}
    createEl(tag,options={}){const el=new Element(tag,options);this.children.push(el);return el;}
    createDiv(options={}){return this.createEl('div',options);}empty(){for(const c of this.children)c.isConnected=false;this.children=[];}setText(v){this.textContent=v;}all(){return [this,...this.children.flatMap(c=>c.all())];}
  }
  class Control{constructor(el){this.el=el;}setValue(v){this.el.value=v;return this;}onChange(fn){this.el.change=fn;return this;}setDisabled(v){this.el.disabled=v;return this;}addOption(v,label){const option=this.el.createEl('option',{text:label});option.value=v;return this;}}
  class Setting{constructor(parent){this.el=parent.createDiv();}setName(v){this.el.name=v;return this;}setDesc(v){this.el.desc=v;return this;}addText(fn){fn(new Control(this.el.createEl('input')));return this;}addTextArea(fn){fn(new Control(this.el.createEl('textarea')));return this;}addToggle(fn){fn(new Control(this.el.createEl('toggle')));return this;}addDropdown(fn){fn(new Control(this.el.createEl('select')));return this;}}
  class Stub{}class Modal{constructor(app){this.app=app;this.contentEl=new Element();this.modalEl=new Element();}open(){this.onOpen?.();}close(){this.onClose?.();}}
  const notices=[],module={exports:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../main.js'),'utf8')+'\nmodule.exports.shareTest={WorkflowSharingModal,WorkflowSharingService,ImportModal,createPluginRequestHost,acquireExecutionLease};',{module,exports:module.exports,require:id=>id==='obsidian'?{Plugin:Stub,ItemView:Stub,PluginSettingTab:Stub,Modal,Setting,Notice:class{constructor(v){notices.push(v);}}}:require(id),process,Buffer,console,setTimeout,clearTimeout,setInterval,clearInterval,AbortController});
  return {...module.exports.shareTest,Plugin:module.exports.default,Element,notices};
}
async function until(fn){const end=Date.now()+3000;while(!fn()){if(Date.now()>end)throw Error('Timed out waiting for UI');await new Promise(r=>setTimeout(r,5));}}
const button=(modal,text)=>modal.contentEl.all().find(e=>e.tag==='button'&&e.textContent===text);
const change=(modal,name,value)=>{const s=modal.contentEl.all().find(e=>e.name===name);assert.ok(s,`Missing setting ${name}`);s.children.find(c=>c.change).change(value);};
test('compiled sharing dialog connects explicitly, publishes selection and shows available version',async t=>{
  const h=harness(),root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-share-ui-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const c={tasks:[],workflows:[{id:'w',name:'Hello',description:'Original',steps:[{id:'s',stepKind:'code',code:'return input;',codeLang:'javascript',transitions:[]}]}]};
  const service=new h.WorkflowSharingService({catalog:()=>c,runtimeDirectory:()=>root,transaction:op=>op(),save:async validate=>validate?.(),assertReady:()=>{},validate:()=>{},refresh:()=>{},notify:()=>{}});t.after(()=>service.close());
  const modal=new h.WorkflowSharingModal({}, {catalog:()=>c,service:()=>service});modal.open();await until(()=>button(modal,'Connect shared folder'));button(modal,'Connect shared folder').onclick();await until(()=>button(modal,'Connect trusted folder'));
  change(modal,'Shared folder (absolute path)',path.join(root,'library'));change(modal,'Project display name','Inncrea');change(modal,'Allow distribution from linked projects',true);button(modal,'Connect trusted folder').onclick();await until(()=>button(modal,'Publish a collection'));
  assert.equal(c.workflowSharing.allowPush,true);button(modal,'Publish a collection').onclick();await until(()=>button(modal,'Publish version'));change(modal,'Collection name','Pilot');change(modal,'What changed?','First release');change(modal,'Hello',true);button(modal,'Publish version').onclick();await until(()=>button(modal,'Publish local improvements'));
  assert.ok(modal.contentEl.all().some(e=>e.textContent==='Pilot · v1'));assert.equal(Object.keys(c.workflowSharing.bindings).length,1);assert.match(h.notices[0],/Published Pilot v1/);modal.close();
});
test('compiled dialog rejects implicit mapping, renders before/after and requires permissions confirmation',async()=>{
  const h=harness(),bundleId=randomUUID(),tid=randomUUID(),wid=randomUUID(),v={bundleId,revision:1,hash:'a'.repeat(64),name:'Collection',payload:{tasks:[{id:tid,name:'Existing task',taskKind:'code',codeAllowTerminal:true}],workflows:[{id:wid,name:'Existing flow',steps:[{id:'s',stepKind:'task',taskId:tid}]}]}};
  const c={tasks:[{id:'t',name:'Existing task'}],workflows:[{id:'w',name:'Existing flow'}],workflowSharing:{bindings:{}}},calls=[];
  const service={definitionPreview:async()=>v,execute:async request=>{calls.push(request);if(request.action==='review'){assert.equal(request.mapping['task:'+tid],'t');assert.equal(request.mapping['workflow:'+wid],'w');return {mapping:request.mapping,reviewHash:'b'.repeat(64),modified:true,permissions:true,changes:[{kind:'task',id:'t',name:'Existing task',action:'replace'}],dependents:[]};}if(request.action==='apply'){if(!request.replaceLocal||!request.acceptPermissions)throw Error('Explicit confirmation required');return {applied:true};}return {connected:false};}};
  const modal=new h.WorkflowSharingModal({}, {catalog:()=>c,service:()=>service});await modal.review(v);for(const el of modal.contentEl.all().filter(e=>e.tag==='select'))assert.equal(el.value,'');change(modal,'task: Existing task','t');change(modal,'workflow: Existing flow','w');button(modal,'Review replacement').onclick();await until(()=>button(modal,'Apply this version'));assert.ok(modal.contentEl.all().some(e=>e.tag==='textarea'&&e.readOnly&&e.value.includes('codeAllowTerminal')));
  button(modal,'Apply this version').onclick();await until(()=>modal.contentEl.all().some(e=>e.textContent==='Explicit confirmation required'));change(modal,'Replace the reviewed local changes',true);change(modal,'Accept the reviewed engines and permissions',true);await until(()=>!button(modal,'Apply this version').disabled);button(modal,'Apply this version').onclick();await until(()=>button(modal,'Connection settings'));assert.equal(calls.filter(c=>c.action==='apply').length,2);
});
test('compiled host guards Page executions and preserves unrelated terminal sessions during sharing',async t=>{
  const h=harness(),root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-share-host-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const plugin=new h.Plugin();plugin.app={vault:{adapter:{basePath:root}}};plugin.manifest={version:'1.7.30'};plugin.lifecycleStopped=false;plugin.pluginExecutionLease={assertOwned(){}};plugin.settingsPublicationState='ready';plugin.settings={tasks:[],workflows:[{id:'w',name:'Code',steps:[{id:'s',name:'Run',stepKind:'code',code:'return input;',codeLang:'javascript',transitions:[]}],disabled:false}],pageTerminalClaims:[{id:'terminal',pageId:'main'}],pageRuns:[]};
  plugin.selectedExecutionLocation=()=>({runtimeDirectory:root,configurationFile:path.join(root,'data.json')});plugin.settingsWriter={trackTransaction:p=>p};plugin.saveSettings=async(_refresh,validate)=>validate?.();plugin.refreshOpenViews=()=>{};
  const service=plugin.sharingService();t.after(()=>service.close());await service.execute({action:'connect',directory:path.join(root,'library'),projectName:'Host',allowPush:true});const v=await service.execute({action:'publish',workflowIds:['w'],taskIds:[],expectedParent:null,name:'Collection',note:'One'});
  const req={bundleId:v.bundleId,revision:v.revision,hash:v.hash};const r=await service.execute({action:'review',...req});assert.equal(r.changes[0].action,'unchanged');await service.execute({action:'apply',...req,mapping:r.mapping,reviewHash:r.reviewHash,replaceLocal:false,acceptPermissions:true});assert.equal(plugin.settings.pageTerminalClaims.length,1);
  const r2=await service.execute({action:'review',...req});plugin.settings.pageRuns.push({sourceId:'w',task:false,phase:'in_flight',uncertain:false});await assert.rejects(service.execute({action:'apply',...req,mapping:r2.mapping,reviewHash:r2.reviewHash,replaceLocal:false,acceptPermissions:true}),/Page execution/);
  plugin.settingsPublicationState='conflicted';await assert.rejects(service.execute({action:'publish',bundleId:v.bundleId,workflowIds:['w'],taskIds:[],expectedParent:v.hash,name:'Collection',note:'Unsafe snapshot'}),/catalog save or maintenance/);
});
test('compiled dialog does not replace closed content when asynchronous status arrives',async()=>{
  const h=harness();let resolve;const pending=new Promise(r=>resolve=r);const m=new h.WorkflowSharingModal({}, {catalog:()=>({tasks:[],workflows:[]}),service:()=>({execute:()=>pending})});m.open();m.close();resolve({connected:false});await new Promise(r=>setImmediate(r));assert.equal(m.contentEl.children.length,0);
});
test('pilot demo passes the actual import validator and declares no filesystem or terminal access',()=>{
  const h=harness(),demo=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../library/workflow-sharing-demo.json'),'utf8'));
  const result=new h.ImportModal({}, {settings:{}}).validateExport(demo);assert.equal(result.ok,true,JSON.stringify(result.errors));assert.equal(demo.workflows[0].scheduleType,'manual');const step=demo.workflows[0].steps[0];for(const field of ['codeAllowVault','codeAllowFiles','codeAllowTerminal'])assert.equal(step[field],false);
  assert.equal(demo.tasks.length,0);
});
test('matching by name is an explicit suggestion and leaves ambiguous names unselected',async()=>{
  const h=harness(),tid=randomUUID(),wid=randomUUID(),v={bundleId:randomUUID(),revision:1,hash:'a'.repeat(64),name:'Collection',payload:{tasks:[{id:tid,name:'Unique'}],workflows:[{id:wid,name:'Ambiguous',steps:[]}]}};
  const c={tasks:[{id:'t',name:'Unique'}],workflows:[{id:'w1',name:'Ambiguous'},{id:'w2',name:'Ambiguous'}],workflowSharing:{bindings:{}}};let request;
  const modal=new h.WorkflowSharingModal({}, {catalog:()=>c,service:()=>({definitionPreview:async()=>v,execute:async r=>{request=r;throw Error('Review stopped for ambiguous mapping');}})});await modal.review(v);
  assert.ok(modal.contentEl.all().filter(e=>e.tag==='select').every(e=>e.value===''));button(modal,'Suggest matches by exact name').onclick();await until(()=>modal.contentEl.all().some(e=>e.textContent.startsWith('1 unique matches')));await until(()=>!modal.busy);button(modal,'Review replacement').onclick();await until(()=>!!request);
  assert.equal(request.mapping['task:'+tid],'t');assert.equal(request.mapping['workflow:'+wid],undefined);assert.equal(button(modal,'Apply this version'),undefined);
});

test('compiled CLI and compiled plugin mailbox connect, publish, link, distribute and inspect the same receipt',async t=>{
  const h=harness(),root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'autooc-share-cli-'))),peers=[];
  t.after(async()=>{for(const p of peers){clearInterval(p.timer);p.pump.close();await p.pump.drain();p.service.close();p.lease.release();}fs.rmSync(root,{recursive:true,force:true});});
  for(const name of ['source','target']){
    const vault=path.join(root,name),install=path.join(vault,'.obsidian','plugins','auto-oc'),runtime=path.join(install,'runtime');fs.mkdirSync(runtime,{recursive:true});
    const c={tasks:[],workflows:name==='source'?[{id:'w',name:'Example',description:'one',steps:[{id:'s',stepKind:'code',code:'return input;',codeLang:'javascript',codeAllowTerminal:false,transitions:[]}]}]:[]};fs.writeFileSync(path.join(install,'data.json'),JSON.stringify(c));
    const service=new h.WorkflowSharingService({catalog:()=>c,runtimeDirectory:()=>runtime,transaction:op=>op(),save:async validate=>{validate?.();fs.writeFileSync(path.join(install,'data.json'),JSON.stringify(c));},assertReady:()=>{},validate:()=>{},refresh:()=>{},notify:()=>{}}),lease=h.acquireExecutionLease(runtime);
    const pump=h.createPluginRequestHost(lease,async()=>{throw Error('Sharing must not execute workflows');},undefined,()=>({}),{sharing:r=>service.execute(r)});const timer=setInterval(()=>pump.poll().catch(()=>{}),10);
    peers.push({vault,c,service,lease,pump,timer,runtime});
  }
  async function cli(peer,request){
    const file=path.join(root,randomUUID()+'.json');fs.writeFileSync(file,JSON.stringify(request));const {execFile}=require('node:child_process');
    return new Promise((resolve,reject)=>execFile(process.execPath,[path.resolve(__dirname,'../autooc-cli.cjs'),'share-workflows','--vault',peer.vault,'--request',file],{timeout:30000,windowsHide:true,maxBuffer:1024*1024},(error,stdout,stderr)=>error?reject(new Error(stderr||stdout||error.message)):resolve(JSON.parse(stdout))));
  }
  const [a,b]=peers;for(const p of peers)assert.equal((await cli(p,{action:'connect',directory:path.join(root,'library'),projectName:p===a?'Inncrea':'AutoOC',allowPush:true})).connected,true);
  const v=await cli(a,{action:'publish',workflowIds:['w'],taskIds:[],expectedParent:null,name:'Pilot',note:'one'}),req={bundleId:v.bundleId,revision:v.revision,hash:v.hash};
  const review=await cli(b,{action:'review',...req});const applied=await cli(b,{action:'apply',...req,mapping:review.mapping,reviewHash:review.reviewHash,replaceLocal:false,acceptPermissions:true});assert.equal(applied.applied,true);
  a.c.workflows[0].description='two';const v2=await cli(a,{action:'publish',bundleId:v.bundleId,workflowIds:['w'],taskIds:[],expectedParent:v.hash,name:'Pilot',note:'two'});const status=await cli(b,{action:'status'});
  const sent=await cli(a,{action:'distribute',bundleId:v2.bundleId,revision:v2.revision,hash:v2.hash,replaceLocal:false,targets:[{projectId:b.c.workflowSharing.projectId,localHash:status.installed[0].localHash}]});assert.equal(sent.deliveries[0].state,'pending');await b.service.poll();assert.equal(b.c.workflows[0].description,'two');
  const inspected=await new Promise((resolve,reject)=>require('node:child_process').execFile(process.execPath,[path.resolve(__dirname,'../autooc-cli.cjs'),'inspect-request','--vault',a.vault,'--request-id',sent.requestId,'--include-output','true'],{timeout:30000,windowsHide:true},(err,out,stderr)=>err?reject(new Error(stderr||err.message)):resolve(JSON.parse(out))));assert.equal(inspected.state,'finished');assert.equal(inspected.result.action,'distribute');assert.equal(inspected.result.deliveries[0].deliveryId,sent.deliveries[0].deliveryId);await a.pump.poll();assert.equal((await cli(a,{action:'status'})).deliveries.length,1);
});
