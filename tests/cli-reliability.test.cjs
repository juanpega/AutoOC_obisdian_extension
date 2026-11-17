const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),Module=require('node:module');
const {randomUUID}=require('node:crypto');
const {setTimeout:delay}=require('node:timers/promises');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const compiled=require('esbuild').buildSync({stdin:{contents:['cli-plugin-requests','execution-timing','execution-lease','code-workflow-host','workflow-definition','settings-writer'].map(f=>`export * from './${f}';`).join('\n'),resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'cjs',write:false});
const mod=new Module(path.join(root,'reliability-test.cjs'),module);mod.filename=path.join(root,'reliability-test.cjs');mod.paths=module.paths;mod._compile(compiled.outputFiles[0].text,mod.filename);
const api=mod.exports;
const state={runId:'run-1',workflowId:'w',phase:'completed',revision:2,nextStepId:null};
function temp(t) {
  const directory=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'autooc-reliability-')));
  t.after(()=>{assert.equal(path.dirname(directory),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(directory).startsWith('autooc-reliability-'));fs.rmSync(directory,{recursive:true,force:true});});return directory;
}
function fixture(t,execute=async()=>state,capabilities={}) {
  const runtime=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'autooc-reliability-'))),lease=api.acquireExecutionLease(runtime),host=api.createPluginRequestHost(lease,execute,undefined,()=>({}),capabilities);
  const directory=host.directory;let released=false,stop;
  t.after(async()=>{stop?.();host.close();await host.drain().catch(()=>{});if(!released)lease.release();assert.equal(path.dirname(runtime),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(runtime).startsWith('autooc-reliability-'));fs.rmSync(runtime,{recursive:true,force:true});});
  return {runtime,lease,host,directory,pump(){stop=api.startPluginRequestPump(host,()=>{});return stop;},release(){lease.release();released=true;},
    submit(changes={}){const id=randomUUID();fs.writeFileSync(path.join(directory,id+'.request'),JSON.stringify({protocol:1,owner:lease.token,id,command:'run',workflowId:'w',submittedAt:Date.now(),expiresAt:Date.now()+30000,...changes}));return id;},
    receipt(id){return JSON.parse(fs.readFileSync(path.join(directory,id+'.receipt'),'utf8'));}};
}
async function until(predicate,timeout=4000){const deadline=Date.now()+timeout;while(!predicate()){if(Date.now()>deadline)throw new Error('fixture deadline');await delay(10);}}

test('Node reception works with suspended browser timers; watcher and polling never duplicate effects',async t=>{
  let effects=0;const f=fixture(t,async()=>{effects++;await delay(30);return state;});
  const previous=global.window;global.window={setInterval(){throw new Error('browser timer must not be used');},setTimeout(){throw new Error('browser timer must not be used');}};
  t.after(()=>{global.window=previous;});f.pump();
  const id=f.submit();
  // Reception must happen through the pump before manual concurrent polling.
  await until(()=>effects===1);
  await Promise.all([f.host.poll(),f.host.poll(),f.host.poll()]);
  await until(()=>fs.existsSync(path.join(f.directory,id+'.receipt'))&&f.receipt(id).status==='completed');
  for(let n=0;n<5;n++)await f.host.poll();await f.host.drain();
  assert.equal(effects,1);assert.ok(f.receipt(id).timing.queueMs<30000);
});

test('Node timer receives requests when filesystem notifications are unavailable',async t=>{
  let effects=0;const f=fixture(t,async()=>{effects++;return state;});
  const watch=fs.watch;
  try{fs.watch=()=>{throw Error('watch unavailable');};f.pump();}
  finally{fs.watch=watch;}
  const id=f.submit();
  await until(()=>fs.existsSync(path.join(f.directory,id+'.receipt')) && f.receipt(id).status==='completed');
  await f.host.drain();assert.equal(effects,1);assert.ok(f.receipt(id).timing.queueMs<30000);
});

test('expired requests and expiry during durable acceptance never execute',async t=>{
  let effects=0;const f=fixture(t,async()=>{effects++;return state;});
  const old=f.submit({expiresAt:Date.now()-1});await f.host.poll();assert.equal(f.receipt(old).status,'rejected');
  const original=fs.fsync;fs.fsync=(fd,callback)=>original(fd,error=>setTimeout(()=>callback(error),100));
  try {const id=f.submit({expiresAt:Date.now()+50});await f.host.poll();await f.host.drain();assert.equal(f.receipt(id).status,'rejected');assert.equal(effects,0);}
  finally {fs.fsync=original;}
});

test('slow page polling does not hold reception or heartbeat',async t=>{
  let release;const gate=new Promise(resolve=>release=resolve);
  const pages={poll:()=>gate,close(){release();},drain:()=>gate,hasPendingWork:false};
  const f=fixture(t,async()=>state,{pages});
  try {
    await f.host.poll();const id=f.submit();await f.host.poll();
    await until(()=>f.receipt(id).status==='completed');assert.equal(f.receipt(id).checkpoint.runId,'run-1');
  } finally {release();}
});

test('lost heartbeat can be observed and followed to the same completed receipt',async t=>{
  let finish;const gate=new Promise(resolve=>finish=resolve);let effects=0;
  const f=fixture(t,async(_command,_signal,progress)=>{effects++;await progress({...state,phase:'in_flight'});await gate;return state;});
  const id=f.submit();await f.host.poll();await until(()=>f.receipt(id).status==='running');
  const hostFile=path.join(f.directory,'host'),host=JSON.parse(fs.readFileSync(hostFile));host.heartbeatAt=Date.now()-60000;fs.writeFileSync(hostFile,JSON.stringify(host));
  assert.equal(api.inspectPluginRequest(f.runtime,{requestId:id}).state,'unknown');
  const followed=api.followPluginRequest(f.runtime,{requestId:id},{timeoutMs:3000});
  finish();const result=await followed;assert.equal(result.state,'finished');assert.equal(result.runId,state.runId);assert.equal(effects,1);
  assert.equal(fs.readdirSync(f.directory).filter(n=>n.endsWith('.request')).length,1);
});

test('query survives owner replacement and run lookup selects the correct receipt',async t=>{
  const f=fixture(t);const id=f.submit();await f.host.poll();await f.host.drain();f.host.close();f.release();
  const replacement=api.acquireExecutionLease(f.runtime);
  try {const result=api.inspectPluginRequest(f.runtime,{runId:state.runId});
    assert.equal(result.requestId,id);assert.equal(result.hostAvailable,false);assert.equal(result.state,'finished');}
  finally {replacement.release();}
});

test('pending, rejected, running and unknown outcomes remain distinct',async t=>{
  let finish;const gate=new Promise(resolve=>finish=resolve);const f=fixture(t,async()=>{await gate;return state;});
  try {
    const id=f.submit();assert.equal(api.inspectPluginRequest(f.runtime,{requestId:id}).acceptance,'pending');
    assert.equal(api.inspectPluginRequest(f.runtime,{requestId:id}).state,'unknown');
    await f.host.poll();assert.equal(api.inspectPluginRequest(f.runtime,{requestId:id}).state,'running');
    const rejected=f.submit({expiresAt:Date.now()-1});await f.host.poll();assert.equal(api.inspectPluginRequest(f.runtime,{requestId:rejected}).state,'not-accepted');
    assert.equal(api.inspectPluginRequest(f.runtime,{requestId:randomUUID()}).state,'unknown');
  } finally {finish();}
});

test('follow timeout and SIGINT only stop observation, never cancellation or replay',async t=>{
  const f=fixture(t);const id=f.submit();const controller=new AbortController();controller.abort();
  const interrupted=await api.followPluginRequest(f.runtime,{requestId:id},{signal:controller.signal});assert.equal(interrupted.interrupted,true);
  const timeout=await api.followPluginRequest(f.runtime,{requestId:id},{timeoutMs:10});assert.equal(timeout.waitTimedOut,true);
  assert.equal(fs.existsSync(path.join(f.directory,id+'.cancel')),false);
  assert.equal(fs.readdirSync(f.directory).filter(n=>n.endsWith('.request')).length,1);
});

test('inspect validates identities and rejects malformed receipts without exposing payloads',async t=>{
  const f=fixture(t),id=f.submit();await f.host.poll();await f.host.drain();
  assert.throws(()=>api.inspectPluginRequest(f.runtime,{requestId:'../secret'}),/valid requestId/);
  assert.throws(()=>api.inspectPluginRequest(f.runtime,{requestId:id,runId:'run-1'}),/exactly one/);
  const receipt=f.receipt(id);receipt.checkpoint.workflowId='other';receipt.secret='PRIVATE';fs.writeFileSync(path.join(f.directory,id+'.receipt'),JSON.stringify(receipt));
  assert.throws(()=>api.inspectPluginRequest(f.runtime,{requestId:id}),/Invalid CLI receipt checkpoint/);
});

test('structured submission error retains requestId and runId for reconnection',async t=>{
  const f=fixture(t,async()=>{throw Error('PRIVATE_PROVIDER_ERROR');});let requestId;
  const pending=api.requestPluginExecution(f.runtime,{command:'run',workflowId:'w'},undefined,undefined,id=>requestId=id);
  const rejected=assert.rejects(pending,error=>{assert.equal(error.requestId,requestId);assert.match(error.message,/do not launch again/);assert.doesNotMatch(error.message,/PRIVATE_PROVIDER_ERROR/);return true;});
  await f.host.poll();await rejected;assert.match(requestId,/^[a-f0-9-]{36}$/);
});

test('diagnostics keep overlapping contexts separate and expose only numeric allowlisted phases',async t=>{
  const runtime=temp(t),ids=[randomUUID(),randomUUID()];
  await Promise.all(ids.map((id,index)=>api.withExecutionTiming(runtime,{requestId:id,queueMs:index+3},async timing=>{
    api.bindTimingRun('run-'+index,timing);const code=api.startPhaseTiming('code','step-code',timing);await delay(15);code();code();
    const provider=api.startPhaseTiming('provider','step-provider',timing);try{throw Error('PRIVATE_PROMPT_SECRET');}catch{}finally{provider();}
  })));
  for(let index=0;index<ids.length;index++) {
    const [record]=api.readExecutionTimings(runtime,{requestId:ids[index]});assert.equal(record.runId,'run-'+index);assert.equal(record.finished,true);
    assert.equal(record.phases.queue.totalMs,index+3);assert.equal(record.phases.code.count,1);assert.ok(record.phases.code.totalMs>=10);assert.equal(record.phases.provider.active,0);
    assert.deepEqual(record.spans.map(s=>[s.stepId,s.active]),[['step-code',false],['step-provider',false]]);assert.ok(record.spans[0].durationMs>=10);assert.equal(record.droppedSpans,0);
  }
  assert.doesNotMatch(fs.readdirSync(path.join(runtime,'timings')).map(n=>fs.readFileSync(path.join(runtime,'timings',n),'utf8')).join(''),/PRIVATE|output|prompt|directory/);
});

test('settings writer queue and save durations are recorded without catalog values',async t=>{
  const runtime=temp(t),file=path.join(runtime,'settings.json'),writer=new api.SettingsWriter(),requestId=randomUUID();
  fs.writeFileSync(file,'{}');writer.load(file);
  await api.withExecutionTiming(runtime,{requestId},async timing=>{await Promise.all([writer.save(file,()=>({secret:'DO_NOT_LOG'}),undefined,timing),writer.save(file,()=>({secret:'DO_NOT_LOG'}),undefined,timing)]);});
  const [record]=api.readExecutionTimings(runtime,{requestId});assert.equal(record.phases.settingsSave.count,2);assert.equal(record.phases.settingsQueue.count,2);assert.ok(record.phases.settingsQueue.maxMs>0);
  assert.doesNotMatch(JSON.stringify(record),/DO_NOT_LOG|secret/);
});

test('active phases remain observable and diagnostic publication failure cannot fail an effect',async t=>{
  const runtime=temp(t),requestId=randomUUID();let ready,finish;
  const started=new Promise(r=>ready=r),gate=new Promise(r=>finish=r);
  const run=api.withExecutionTiming(runtime,{requestId},async timing=>{const done=api.startPhaseTiming('provider',undefined,timing);ready();await gate;done();return 42;});
  await started;try {await until(()=>api.readExecutionTimings(runtime,{requestId})[0]?.phases.provider?.active===1);}finally{finish();}
  assert.equal(await run,42);
  const missing=path.join(runtime,'absent');assert.equal(await api.withExecutionTiming(missing,{requestId:randomUUID()},async()=>7),7);
});

test('real Code runtime records phases and recovers terminal output without a live receipt',async t=>{
  const runtime=temp(t),definition=api.prepareWorkflowDefinition({id:'w',steps:[{id:'c',stepKind:'code',code:'output = "PRIVATE_RESULT";',codeAllowVault:false}]},[],{});
  const result=await api.runCodeWorkflowHost({definition,runtimeDirectory:runtime,vaultBase:runtime,redact:text=>text});
  assert.equal(result.phase,'completed');
  const inspected=api.inspectPluginRequest(runtime,{runId:result.runId});assert.equal(inspected.state,'finished');assert.equal(inspected.resultAvailable,true);assert.equal(inspected.result,undefined);
  const full=api.inspectPluginRequest(runtime,{runId:result.runId,includeOutput:true});assert.match(JSON.stringify(full.result),/PRIVATE_RESULT/);
  const [timing]=full.diagnostics;assert.equal(timing.phases.code.count,1);assert.equal(timing.spans[0].stepId,'c');assert.ok(timing.spans[0].durationMs>=0);assert.ok(timing.phases.settingsSave.count>0);assert.doesNotMatch(JSON.stringify(timing),/PRIVATE_RESULT/);
});

test('per-step spans are bounded while phase totals retain every invocation',async t=>{
  const runtime=temp(t),requestId=randomUUID();
  await api.withExecutionTiming(runtime,{requestId},async timing=>{for(let index=0;index<260;index++)api.startPhaseTiming('code','same-step',timing)();});
  const [record]=api.readExecutionTimings(runtime,{requestId});assert.equal(record.spans.length,256);assert.equal(record.droppedSpans,4);assert.equal(record.phases.code.count,260);
});

test('unavailable diagnostics cannot hide a completed receipt',async t=>{
  const f=fixture(t);const id=f.submit();await f.host.poll();await f.host.drain();
  const timing=path.join(f.runtime,'timings');fs.renameSync(timing,path.join(f.runtime,'timing-backup'));fs.writeFileSync(timing,'not a directory');
  const result=api.inspectPluginRequest(f.runtime,{requestId:id});assert.equal(result.state,'finished');assert.equal(result.diagnosticsUnavailable,true);
});

test('delegation carries explicit timing through the real host and rejection keeps its request state',async t=>{
  const definition=api.prepareWorkflowDefinition({id:'w',steps:[{id:'c',stepKind:'code',codeAllowVault:true,code:'vault.append("effect.txt","once");output="done";'}]},[],{});
  let f;f=fixture(t,async(_request,signal,progress,timing)=>api.runCodeWorkflowHost({definition,runtimeDirectory:f.runtime,vaultBase:f.runtime,lease:f.lease,signal,timing,onCheckpoint:cp=>progress(cp),redact:s=>s}));
  const id=f.submit();await f.host.poll();await f.host.drain();
  const receipt=api.inspectPluginRequest(f.runtime,{requestId:id});assert.equal(receipt.state,'finished');
  assert.equal(receipt.diagnostics.length,1);assert.equal(receipt.diagnostics[0].requestId,id);assert.equal(receipt.diagnostics[0].runId,receipt.runId);
  assert.equal(receipt.diagnostics[0].spans[0].stepId,'c');assert.ok(receipt.diagnostics[0].phases.settingsSave.count>0);assert.equal(receipt.diagnostics[0].phases.queue.count,1);
  const rejected=f.submit({command:'resume',runId:receipt.runId,expiresAt:Date.now()-1});await f.host.poll();
  assert.equal(api.inspectPluginRequest(f.runtime,{requestId:rejected}).state,'not-accepted');assert.equal(fs.readFileSync(path.join(f.runtime,'effect.txt'),'utf8'),'once');
});

test('CLI inspects and follows an existing completed run without replay or output by default',async t=>{
  const vault=temp(t),install=path.join(vault,'.obsidian','plugins','auto-oc'),runtime=path.join(install,'runtime');fs.mkdirSync(runtime,{recursive:true});
  fs.writeFileSync(path.join(install,'data.json'),JSON.stringify({tasks:[],workflows:[]}));
  const definition=api.prepareWorkflowDefinition({id:'w',steps:[{id:'c',stepKind:'code',code:'output="PRIVATE_RESULT";'}]},[],{});
  const run=await api.runCodeWorkflowHost({definition,runtimeDirectory:runtime,vaultBase:vault,redact:s=>s});
  const before=fs.readFileSync(path.join(runtime,run.runId+'.json'));
  for(const command of ['inspect-request','follow']) {
    const result=spawnSync(process.execPath,[path.join(root,'autooc-cli.cjs'),command,'--vault',vault,'--run',run.runId],{encoding:'utf8',windowsHide:true});
    assert.equal(result.status,0,result.stderr);const value=JSON.parse(result.stdout);assert.equal(value.state,'finished');assert.equal(value.runId,run.runId);assert.doesNotMatch(result.stdout+result.stderr,/PRIVATE_RESULT/);
  }
  const unknown=spawnSync(process.execPath,[path.join(root,'autooc-cli.cjs'),'follow','--vault',vault,'--request-id',randomUUID(),'--timeout-ms','0'],{encoding:'utf8',windowsHide:true});
  assert.equal(unknown.status,2,unknown.stderr);assert.equal(JSON.parse(unknown.stdout).state,'unknown');assert.deepEqual(fs.readFileSync(path.join(runtime,run.runId+'.json')),before);
});

test('CLI advertises inspection and rejects invalid selectors before any effects',t=>{
  const cli=path.join(root,'autooc-cli.cjs');
  const version=spawnSync(process.execPath,[cli,'version'],{encoding:'utf8',windowsHide:true});assert.equal(version.status,0,version.stderr);assert.equal(JSON.parse(version.stdout).requestInspection,1);
  const help=spawnSync(process.execPath,[cli,'help'],{encoding:'utf8',windowsHide:true});assert.match(JSON.parse(help.stdout).requestInspection,/do not launch again/);
});
