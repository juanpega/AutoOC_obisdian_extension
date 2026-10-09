const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),Module=require('node:module');
const {randomUUID}=require('node:crypto');
const ts=require('typescript');
function load(name){const file=path.resolve(__dirname,'..',name+'.ts'),mod=new Module(file,module);mod.filename=file;mod.paths=module.paths;mod.require=name=>name.startsWith('.')?load(name):require(name);mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);return mod.exports;}
const {createPluginRequestHost,requestPluginExecution}=load('cli-plugin-requests');
const {acquireExecutionLease}=load('execution-lease');
function fixture(t,execute){
  const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-mailbox-')),lease=acquireExecutionLease(runtime);
  const host=createPluginRequestHost(lease,execute),directory=path.join(runtime,'cli-'+lease.token);
  t.after(()=>{host.close();lease.release();assert.equal(path.dirname(fs.realpathSync(runtime)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(runtime).startsWith('autooc-mailbox-'));fs.rmSync(runtime,{recursive:true,force:true});});
  const request=(changes={})=>{const id=randomUUID(),data={protocol:1,owner:lease.token,id,command:'run',workflowId:'w',expiresAt:Date.now()+30000,...changes};fs.writeFileSync(path.join(directory,id+'.request'),JSON.stringify(data));return id;};
  const receipt=id=>JSON.parse(fs.readFileSync(path.join(directory,id+'.receipt')));
  return {runtime,lease,host,directory,request,receipt};
}
const state={runId:'aa11',workflowId:'w',phase:'completed',revision:2,nextStepId:null};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('JSON null and malformed requests are rejected without disabling the receiver',async t=>{
  let effects=0;const f=fixture(t,async()=>{effects++;return state;});
  for(const contents of ['null','{','[]','"text"']) {
    const id=randomUUID();fs.writeFileSync(path.join(f.directory,id+'.request'),contents);
    f.host.poll();assert.equal(f.receipt(id).status,'rejected');
  }
  const valid=f.request();f.host.poll();await settle();assert.equal(effects,1);assert.equal(f.receipt(valid).status,'completed');
});
test('durable acceptance precedes effects and repeated polls never repeat an accepted request',async t=>{
  let effects=0,f;
  f=fixture(t,async()=>{effects++;const receipts=fs.readdirSync(f.directory).filter(n=>n.endsWith('.receipt'));assert.equal(JSON.parse(fs.readFileSync(path.join(f.directory,receipts[0]))).status,'accepted');return state;});
  const id=f.request();f.host.poll();await settle();
  for(let i=0;i<4;i++)f.host.poll();
  assert.equal(effects,1);assert.equal(f.receipt(id).status,'completed');
});
test('expired, wrong-owner, malformed, cancelled and concurrent requests have no effects',async t=>{
  let finish,effects=0;const f=fixture(t,async()=>{effects++;return new Promise(resolve=>finish=resolve);});
  for(const changes of [{expiresAt:0},{owner:randomUUID()},{command:'erase'},{taskId:'t'},{command:'resume'},{expiresAt:Date.now()+120000}]){
    const id=f.request(changes);f.host.poll();assert.equal(f.receipt(id).status,'rejected');
  }
  const cancelled=f.request();fs.writeFileSync(path.join(f.directory,cancelled+'.cancel'),'{}');f.host.poll();assert.equal(f.receipt(cancelled).status,'rejected');
  assert.equal(effects,0);
  const first=f.request();f.host.poll();const second=f.request();f.host.poll();
  assert.equal(effects,1);assert.equal(f.receipt(second).status,'rejected');
  finish(state);await settle();assert.equal(f.receipt(first).status,'completed');
});
test('client gets progress and result; closing host never triggers a second executor',async t=>{
  const progress=[];const f=fixture(t,async(command,signal,report)=>{report({...state,phase:'in_flight'});await new Promise(resolve=>setTimeout(resolve,150));return state;});
  const running=requestPluginExecution(f.runtime,{command:'run',workflowId:'w'},undefined,s=>progress.push(s));
  f.host.poll();assert.deepEqual(await running,state);assert.ok(progress.some(s=>s.phase==='in_flight'));
  f.host.close();await assert.rejects(requestPluginExecution(f.runtime,{command:'run',workflowId:'w'}));
});
test('cancelling the CLI wait requests cooperative stop and preserves accepted receipt',async t=>{
  let signal,finish;const f=fixture(t,async(command,s)=>{signal=s;return new Promise(resolve=>finish=resolve);});
  const controller=new AbortController(),running=requestPluginExecution(f.runtime,{command:'run',workflowId:'w'},controller.signal);
  const rejected=assert.rejects(running,/cancellation requested.*Request/);
  f.host.poll();controller.abort();await rejected;f.host.poll();assert.equal(signal.aborted,true);
  finish({...state,phase:'ready'});await settle();
});
test('lost owner after acceptance reports uncertainty without retrying effects',async t=>{
  let finish,effects=0;const f=fixture(t,async()=>{effects++;return new Promise(resolve=>finish=resolve);});
  const running=requestPluginExecution(f.runtime,{command:'run',workflowId:'w'});
  const rejected=assert.rejects(running,/unavailable.*Request/);
  f.host.poll();f.host.close();await rejected;assert.equal(effects,1);
  finish(state);await settle();
});
test('invalid result cannot be mistaken for an absent host and fall back',async t=>{
  const f=fixture(t,async()=>state),running=requestPluginExecution(f.runtime,{command:'run',workflowId:'w'});
  const rejected=assert.rejects(running,/Missing CLI result checkpoint/);
  const name=fs.readdirSync(f.directory).find(n=>n.endsWith('.request')),id=name.slice(0,-8);
  fs.writeFileSync(path.join(f.directory,id+'.receipt'),JSON.stringify({protocol:1,owner:f.lease.token,id,status:'completed'}));await rejected;
});
test('request file hard links are rejected without reading or modifying their target',async t=>{
  let effects=0;const f=fixture(t,async()=>{effects++;return state;}),id=randomUUID();
  const target=path.join(f.runtime,'unrelated');fs.writeFileSync(target,'{"private":"preserved"}');
  fs.linkSync(target,path.join(f.directory,id+'.request'));f.host.poll();await settle();
  assert.equal(effects,0);assert.equal(f.receipt(id).status,'rejected');assert.equal(fs.readFileSync(target,'utf8'),'{"private":"preserved"}');
});
