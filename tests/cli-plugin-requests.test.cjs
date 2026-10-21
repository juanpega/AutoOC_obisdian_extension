const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),Module=require('node:module');
const {randomUUID}=require('node:crypto');
const ts=require('typescript');
function load(name){const file=path.resolve(__dirname,'..',name+'.ts'),mod=new Module(file,module);mod.filename=file;mod.paths=module.paths;mod.require=name=>name.startsWith('.')?load(name):require(name);mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);return mod.exports;}
const {createPluginRequestHost,requestPluginExecution,requestPluginWorkflowEdit}=load('cli-plugin-requests');
const {acquireExecutionLease}=load('execution-lease');
function fixture(t,execute,edit){
  const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-mailbox-')),lease=acquireExecutionLease(runtime);
  const host=createPluginRequestHost(lease,execute,edit),directory=path.join(runtime,'cli-'+lease.token);
  let released=false;const release=()=>{lease.release();released=true;};
  t.after(async()=>{host.close();await host.drain?.().catch(()=>{});if(!released)release();assert.equal(path.dirname(fs.realpathSync(runtime)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(runtime).startsWith('autooc-mailbox-'));fs.rmSync(runtime,{recursive:true,force:true});});
  const request=(changes={})=>{const id=randomUUID(),data={protocol:1,owner:lease.token,id,command:'run',workflowId:'w',expiresAt:Date.now()+30000,...changes};fs.writeFileSync(path.join(directory,id+'.request'),JSON.stringify(data));return id;};
  const receipt=id=>JSON.parse(fs.readFileSync(path.join(directory,id+'.receipt')));
  return {runtime,lease,release,host,directory,request,receipt};
}
const state={runId:'aa11',workflowId:'w',phase:'completed',revision:2,nextStepId:null};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('external workflow editing uses the live owner, durable receipt and no execution or replay',async t=>{
  let effects=0,edits=0;
  const result={workflowId:'w',definitionHash:'a'.repeat(64)};
  const f=fixture(t,async()=>{effects++;return state;},async()=>{edits++;return result;});
  const running=requestPluginWorkflowEdit(f.runtime,{command:'edit-workflow',workflowId:'w',expectedHash:'b'.repeat(64),changes:{description:'new'}});
  await f.host.poll();await f.host.drain();assert.deepEqual(await running,result);
  await f.host.poll();assert.equal(edits,1);assert.equal(effects,0);
});
test('failed edit receipt never repeats an edit or falls back to execution',async t=>{
  let edits=0,effects=0;
  const f=fixture(t,async()=>{effects++;return state;},async()=>{edits++;throw Error('synthetic conflict');});
  const running=requestPluginWorkflowEdit(f.runtime,{command:'edit-workflow',workflowId:'w',expectedHash:'b'.repeat(64),changes:{name:'new'}});
  const rejected=assert.rejects(running,/Workflow edit failed.*keep Obsidian open.*Request/);
  await f.host.poll();await f.host.drain();await rejected;await f.host.poll();assert.equal(edits,1);assert.equal(effects,0);
});
test('old loaded host and oversized edit reject before publishing a request',async t=>{
 const f=fixture(t,async()=>state),command={command:'edit-workflow',workflowId:'w',expectedHash:'b'.repeat(64),changes:{name:'new'}};
 await assert.rejects(requestPluginWorkflowEdit(f.runtime,command),/reload the updated plugin once/);
 assert.equal(fs.readdirSync(f.directory).some(n=>n.endsWith('.request')),false);
 const g=fixture(t,async()=>state,async()=>({workflowId:'w',definitionHash:'a'.repeat(64)}));
 await assert.rejects(requestPluginWorkflowEdit(g.runtime,{...command,changes:{description:'x'.repeat(70000)}}),/Invalid CLI command|payload/);
 assert.equal(fs.readdirSync(g.directory).some(n=>n.endsWith('.request')),false);
});
test('mailbox heartbeat and acceptance flush asynchronously and recheck temporary identity before publication',async t=>{
  let effects=0;const f=fixture(t,async()=>{effects++;return state;});
  t.mock.method(fs,'fsyncSync',()=>assert.fail('recurring mailbox flush blocks input'));
  let release,entered;const entry=new Promise(resolve=>entered=resolve),barrier=new Promise(resolve=>release=resolve);
  const flush=fs.fsync;
  t.mock.method(fs,'fsync',(fd,callback)=>{entered(fd);void barrier.then(()=>flush(fd,callback));});
  const id=f.request();const polling=f.host.poll();await entry;
  assert.equal(effects,0);assert.equal(fs.existsSync(path.join(f.directory,id+'.receipt')),false);
  assert.equal(f.host.hasPendingWork,true);
  release();await polling;await f.host.drain();assert.equal(effects,1);assert.equal(f.receipt(id).status,'completed');
});
test('heartbeat flush yields and closing during it drains without recreating the host',async t=>{
  const f=fixture(t,async()=>state),file=path.join(f.directory,'host'),now=Date.now();
  t.mock.method(Date,'now',()=>now+2000);
  t.mock.method(fs,'fsyncSync',()=>assert.fail('heartbeat flush must leave the input thread'));
  let release,entered;const entry=new Promise(r=>entered=r),barrier=new Promise(r=>release=r),flush=fs.fsync;
  t.mock.method(fs,'fsync',(fd,callback)=>{entered();void barrier.then(()=>flush(fd,callback));});
  const polling=f.host.poll();await entry;
  assert.equal(f.host.hasPendingWork,true);f.host.close();assert.equal(fs.existsSync(file),false);
  release();await polling;await f.host.drain();assert.equal(f.host.hasPendingWork,false);assert.equal(fs.existsSync(file),false);
});
test('temporary changed during asynchronous acceptance is preserved and cannot authorize effects',async t=>{
  let effects=0;const f=fixture(t,async()=>{effects++;return state;}),flush=fs.fsync;
  let altered;
  t.mock.method(fs,'fsync',(fd,callback)=>{
    if(!altered){altered=fs.readdirSync(f.directory).find(n=>n.endsWith('.tmp'));fs.writeFileSync(path.join(f.directory,altered),'synthetic foreign temporary');}
    flush(fd,callback);
  });
  const id=f.request();await f.host.poll();await f.host.drain();
  assert.equal(effects,0);assert.equal(f.receipt(id).status,'failed');
  assert.equal(fs.readFileSync(path.join(f.directory,altered),'utf8'),'synthetic foreign temporary');
  await f.host.poll();assert.equal(effects,0);
});
test('JSON null and malformed requests are rejected without disabling the receiver',async t=>{
  let effects=0;const f=fixture(t,async()=>{effects++;return state;});
  for(const contents of ['null','{','[]','"text"']) {
    const id=randomUUID();fs.writeFileSync(path.join(f.directory,id+'.request'),contents);
    await f.host.poll();assert.equal(f.receipt(id).status,'rejected');
  }
  const valid=f.request();await f.host.poll();await f.host.drain();assert.equal(effects,1);assert.equal(f.receipt(valid).status,'completed');
});
test('durable acceptance precedes effects and repeated polls never repeat an accepted request',async t=>{
  let effects=0,f;
  f=fixture(t,async()=>{effects++;const receipts=fs.readdirSync(f.directory).filter(n=>n.endsWith('.receipt'));assert.equal(JSON.parse(fs.readFileSync(path.join(f.directory,receipts[0]))).status,'accepted');return state;});
  const id=f.request();await f.host.poll();await f.host.drain();
  for(let i=0;i<4;i++)await f.host.poll();
  assert.equal(effects,1);assert.equal(f.receipt(id).status,'completed');
});
test('expired, wrong-owner, malformed, cancelled and concurrent requests have no effects',async t=>{
  let finish,effects=0;const f=fixture(t,async()=>{effects++;return new Promise(resolve=>finish=resolve);});
  for(const changes of [{expiresAt:0},{owner:randomUUID()},{command:'erase'},{taskId:'t'},{command:'resume'},{expiresAt:Date.now()+120000}]){
    const id=f.request(changes);await f.host.poll();assert.equal(f.receipt(id).status,'rejected');
  }
  const cancelled=f.request();fs.writeFileSync(path.join(f.directory,cancelled+'.cancel'),'{}');await f.host.poll();assert.equal(f.receipt(cancelled).status,'rejected');
  assert.equal(effects,0);
  const first=f.request();await f.host.poll();const second=f.request();await f.host.poll();
  assert.equal(effects,1);assert.equal(f.receipt(second).status,'rejected');
  finish(state);await f.host.drain();assert.equal(f.receipt(first).status,'completed');
});
test('client gets progress and result; closing host never triggers a second executor',async t=>{
  const progress=[];const f=fixture(t,async(command,signal,report)=>{report({...state,phase:'in_flight'});await new Promise(resolve=>setTimeout(resolve,150));return state;});
  const running=requestPluginExecution(f.runtime,{command:'run',workflowId:'w'},undefined,s=>progress.push(s));
  await f.host.poll();assert.deepEqual(await running,state);assert.ok(progress.some(s=>s.phase==='in_flight'));
  f.host.close();await assert.rejects(requestPluginExecution(f.runtime,{command:'run',workflowId:'w'}));
});
test('cancelling the CLI wait requests cooperative stop and preserves accepted receipt',async t=>{
  let signal,finish;const f=fixture(t,async(command,s)=>{signal=s;return new Promise(resolve=>finish=resolve);});
  const controller=new AbortController(),running=requestPluginExecution(f.runtime,{command:'run',workflowId:'w'},controller.signal);
  const rejected=assert.rejects(running,/cancellation requested.*Request/);
  await f.host.poll();controller.abort();await rejected;await f.host.poll();assert.equal(signal.aborted,true);
  finish({...state,phase:'ready'});await settle();
});
test('lost owner after acceptance reports uncertainty without retrying effects',async t=>{
  let finish,effects=0;const f=fixture(t,async()=>{effects++;return new Promise(resolve=>finish=resolve);});
  const running=requestPluginExecution(f.runtime,{command:'run',workflowId:'w'});
  const rejected=assert.rejects(running,/unavailable.*Request/);
  await f.host.poll();f.host.close();await rejected;assert.equal(effects,1);
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
  fs.linkSync(target,path.join(f.directory,id+'.request'));await f.host.poll();await settle();
  assert.equal(effects,0);assert.equal(f.receipt(id).status,'rejected');assert.equal(fs.readFileSync(target,'utf8'),'{"private":"preserved"}');
});

// Inject only at the filesystem boundary; real mailbox files, readers and leases
// still run. A reader sharing a Windows receipt can transiently deny rename.
function denyReceiptRenames(t,select) {
  const rename=fs.renameSync;let failures=0;
  t.mock.method(fs,'renameSync',(from,to)=>{
    if(String(to).endsWith('.receipt')) {
      const value=JSON.parse(fs.readFileSync(from,'utf8'));
      if(select(value,failures)){failures++;throw Object.assign(new Error('synthetic sharing violation'),{code:'EPERM'});}
    }
    return rename(from,to);
  });
  return ()=>failures;
}
async function until(predicate,ms=4000) {
  const end=Date.now()+ms;
  while(!predicate()){assert.ok(Date.now()<end,'bounded mailbox watchdog');await new Promise(r=>setTimeout(r,5));}
}
for(const stage of ['accepted','running','completed']) {
  test(`receipt EPERM transient at ${stage} yields, preserves atomic reads and executes once`,async t=>{
    let effects=0,f;
    f=fixture(t,async(command,signal,report)=>{
      assert.equal(f.receipt(id).status,'accepted','durable acceptance before effects');
      await report({...state,phase:'in_flight',revision:1});
      effects++;return state;
    });
    const count=denyReceiptRenames(t,(v,n)=>v.status===stage&&n<3);
    const id=f.request();let ticks=0;const seen=[];
    const timer=setInterval(()=>{ticks++;const file=path.join(f.directory,id+'.receipt');if(fs.existsSync(file))seen.push(JSON.parse(fs.readFileSync(file,'utf8')).status);},1);
    try {
      await f.host.poll();await until(()=>fs.existsSync(path.join(f.directory,id+'.receipt'))&&f.receipt(id).status==='completed');
      await f.host.drain();for(let i=0;i<4;i++)await f.host.poll();
      assert.equal(effects,1);assert.equal(count(),3);assert.ok(ticks>=2,'retries let other input run');
      assert.ok(seen.every(s=>['accepted','running','completed'].includes(s)));
      assert.deepEqual(fs.readdirSync(f.directory).filter(n=>n.endsWith('.tmp')),[]);
    }finally{clearInterval(timer);}
  });
  test(`receipt EPERM persistent at ${stage} stops with identity and no replay`,async t=>{
    const controller=new AbortController(),watchdog=setTimeout(()=>controller.abort(),8000);
    t.after(()=>clearTimeout(watchdog));
    let effects=0;const f=fixture(t,async(command,signal,report)=>{
      await report({...state,phase:'in_flight',revision:1});effects++;return state;
    });
    denyReceiptRenames(t,v=>v.status===stage||v.status==='failed');
    const running=requestPluginExecution(f.runtime,{command:'run',workflowId:'w'},controller.signal);
    const rejected=assert.rejects(running,/Request [a-f0-9-]+.*inspect status and receipt/);
    await f.host.poll();await rejected;
    await assert.rejects(f.host.drain(),/receipt|publication/i);
    assert.equal(effects,stage==='completed'?1:0);
    await assert.rejects(f.host.poll());assert.equal(effects,stage==='completed'?1:0);
  });
}
test('unawaited progress remains ordered before terminal publication',async t=>{
  const f=fixture(t,async(command,signal,report)=>{report({...state,revision:1,phase:'in_flight'});report(state);return state;});
  denyReceiptRenames(t,(v,n)=>v.status==='running'&&n<2);
  const id=f.request();await f.host.poll();await f.host.drain();
  assert.equal(f.receipt(id).status,'completed');assert.deepEqual(f.receipt(id).checkpoint,state);
});
test('failed terminal publication reports uncertainty even with a completed checkpoint and a live host',async t=>{
  let effects=0;const f=fixture(t,async()=>{effects++;return state;});
  denyReceiptRenames(t,v=>v.status==='completed');
  const running=requestPluginExecution(f.runtime,{command:'run',workflowId:'w'});
  const rejected=assert.rejects(running,/publication failed.*Request/);
  await f.host.poll();await rejected;await f.host.drain();
  const name=fs.readdirSync(f.directory).find(n=>n.endsWith('.request')),id=name.slice(0,-8);
  assert.equal(f.receipt(id).status,'failed');assert.ok(fs.existsSync(path.join(f.directory,'host')));
  await f.host.poll();assert.equal(effects,1);
});
test('late progress cannot replace a terminal receipt or write after host drain',async t=>{
  let late;const f=fixture(t,async(command,signal,report)=>{late=report;return state;});
  const id=f.request();await f.host.poll();await f.host.drain();
  f.host.close();f.release();
  await late({...state,phase:'in_flight',revision:1});
  assert.equal(f.receipt(id).status,'completed');assert.deepEqual(f.receipt(id).checkpoint,state);
});
test('closing during acceptance drains retries before lease release and starts no effects',async t=>{
  let effects=0;const f=fixture(t,async()=>{effects++;return state;});
  const count=denyReceiptRenames(t,(v,n)=>v.status==='accepted'&&n<2);
  const id=f.request(),polling=f.host.poll();await until(()=>count()>0);
  f.host.close();assert.equal(f.host.hasPendingWork,true);assert.ok(fs.existsSync(path.join(f.runtime,'execution.lock')));
  await polling;await f.host.drain();assert.equal(f.host.hasPendingWork,false);assert.equal(effects,0);
  assert.equal(f.receipt(id).status,'failed');
});
test('stale host heartbeat bounds accepted CLI wait without treating completed progress as success',async t=>{
  const controller=new AbortController(),watchdog=setTimeout(()=>controller.abort(),1500);
  t.after(()=>clearTimeout(watchdog));
  const f=fixture(t,async()=>state),running=requestPluginExecution(f.runtime,{command:'run',workflowId:'w'},controller.signal);
  const rejected=assert.rejects(running,/unavailable|heartbeat|publication/);
  const name=fs.readdirSync(f.directory).find(n=>n.endsWith('.request')),id=name.slice(0,-8);
  fs.writeFileSync(path.join(f.directory,id+'.receipt'),JSON.stringify({protocol:1,owner:f.lease.token,id,status:'running',checkpoint:state}));
  fs.writeFileSync(path.join(f.directory,'host'),JSON.stringify({protocol:1,owner:f.lease.token,pid:process.pid,heartbeatAt:Date.now()-60000}));
  await rejected;assert.equal(f.receipt(id).status,'running');
});
test('accepted CLI wait has a monotonic deadline even when host heartbeats stay fresh',async t=>{
  let now=0;t.mock.method(require('node:perf_hooks').performance,'now',()=>now);
  const controller=new AbortController(),watchdog=setTimeout(()=>controller.abort(),1500);
  t.after(()=>clearTimeout(watchdog));
  const f=fixture(t,async()=>state),running=requestPluginExecution(f.runtime,{command:'run',workflowId:'w'},controller.signal);
  const rejected=assert.rejects(running,/wait deadline.*Request .*run aa11.*inspect status and receipt/);
  const name=fs.readdirSync(f.directory).find(n=>n.endsWith('.request')),id=name.slice(0,-8);
  fs.writeFileSync(path.join(f.directory,id+'.receipt'),JSON.stringify({protocol:1,owner:f.lease.token,id,status:'running',checkpoint:state}));
  now=24*60*60*1000+1;await rejected;assert.equal(f.receipt(id).status,'running');
});
test('heartbeat renewal never overwrites or removes a descriptor with changed identity',async t=>{
  const f=fixture(t,async()=>state),file=path.join(f.directory,'host');
  const changed=JSON.stringify({protocol:1,owner:randomUUID(),pid:process.pid,heartbeatAt:Date.now()});
  fs.writeFileSync(file,changed);
  const now=Date.now();t.mock.method(Date,'now',()=>now+2000);
  await assert.rejects(f.host.poll(),/publication failed/);
  assert.equal(fs.readFileSync(file,'utf8'),changed);await assert.rejects(f.host.drain());
});
