const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
// Compile only the runtime modules used by this fixture, without a plugin host.
const cache=new Map();
function load(name){
  const file=path.resolve(__dirname,'../'+name+'.ts');if(cache.has(file))return cache.get(file).exports;
  const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));cache.set(file,m);
  const original=m.require.bind(m);m.require=name=>name.startsWith('./')?load(name.slice(2)):original(name);
  m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);return m.exports;
}
const {acquireExecutionLease}=load('execution-lease'),{ExecutionJournal:J}=load('execution-journal');
const {advanceWorkflowSession:advance}=load('workflow-session');
const {executeCode}=load('code-runtime');
const {prepareWorkflowDefinition:prepare}=load('workflow-definition');
const {runCodeWorkflowHost}=load('code-workflow-host');
const hash='a'.repeat(64);
test('terminal recovery separates edited definitions from historical results',()=>{
  const {recoverWorkflowProgress,projectWorkflowProgress}=load('workflow-progress');
  const original={id:'w',name:'Before',steps:[{id:'a',taskId:'t'}]},tasks=[{id:'t',prompt:'before'}];
  const definition=prepare(original,tasks,{});
  for(const phase of ['completed','failed']) {
    const checkpoint={schemaVersion:1,runId:'run-1',workflowId:'w',definitionHash:definition.hash,revision:3,phase,nextStepId:null,steps:[{stepId:'a',status:phase,output:'historical'}]};
    const edited={...original,name:'After',runtimeExecution:{runId:'run-1',revision:3},steps:[{id:'a',taskId:'replacement',output:'stale',status:'completed'}]};
    const before=JSON.stringify(checkpoint);
    const recovered=recoverWorkflowProgress(edited,[],{},checkpoint,'run-1');
    assert.equal(recovered.name,'After');assert.equal(recovered.status,phase);
    assert.equal(recovered.runtimeExecution.definitionHash,definition.hash);
    assert.deepEqual(recovered.runtimeExecution.historicalSteps,checkpoint.steps);
    assert.equal(recovered.steps[0].output,'');assert.equal(recovered.steps[0].status,'pending');
    assert.equal(JSON.stringify(checkpoint),before);
    assert.throws(()=>projectWorkflowProgress(edited,[],{},checkpoint,'run-1'));
  }
});
test('terminal recovery still rejects identity, malformed checkpoints and stale revisions',()=>{
  const {recoverWorkflowProgress}=load('workflow-progress');
  const workflow={id:'w',steps:[],runtimeExecution:{runId:'run-1',revision:3}};
  const checkpoint={schemaVersion:1,runId:'run-1',workflowId:'w',definitionHash:hash,revision:3,phase:'completed',nextStepId:null,steps:[]};
  assert.equal(recoverWorkflowProgress(workflow,[],{},checkpoint,'run-1').status,'completed');
  for(const invalid of [{...checkpoint,runId:'run-2'},{...checkpoint,workflowId:'other'},{...checkpoint,revision:2},{...checkpoint,phase:'in_flight'}]) {
    assert.throws(()=>recoverWorkflowProgress(workflow,[],{},invalid,'run-1'));
  }
});
async function fixture(fn){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-journal-')),lease=acquireExecutionLease(dir);
  try {await fn(lease,dir);} finally {lease.release();for(const file of fs.readdirSync(dir)){assert.match(file,/^[a-f0-9-]+\.json$/);fs.unlinkSync(path.join(dir,file));}fs.rmdirSync(dir);}
}
test('checkpoint survives reopening with full output and next step',async()=>fixture(async lease=>{
  const run=await J.create(lease,'workflow',hash,'first');await run.begin('first');await run.finish('first',true,'x'.repeat(24000),'second');
  const opened=J.open(lease,run.snapshot().runId,hash);assert.equal(opened.snapshot().steps[0].output.length,24000);assert.equal(opened.snapshot().nextStepId,'second');
  await opened.begin('second');await opened.finish('second',true,'done',null);assert.equal(opened.snapshot().phase,'completed');
  await assert.rejects(opened.begin('second'),/not ready/);
}));
test('interrupted step is retained and cannot be automatically replayed',async()=>fixture(async lease=>{
  const run=await J.create(lease,'workflow',hash,'effect');await run.begin('effect');
  const opened=J.open(lease,run.snapshot().runId,hash);assert.equal(opened.snapshot().phase,'in_flight');await assert.rejects(opened.begin('effect'),/reconcile/);
}));
test('definition changes and invalid identity are rejected',async()=>fixture(async lease=>{
  const run=await J.create(lease,'workflow',hash,'first');assert.throws(()=>J.open(lease,run.snapshot().runId,'b'.repeat(64)),/definition changed/);assert.throws(()=>J.open(lease,'../outside',hash),/identity/);
}));
test('simultaneous stale handles cannot overwrite each other',async()=>fixture(async lease=>{
  const run=await J.create(lease,'workflow',hash,'first'),other=J.open(lease,run.snapshot().runId,hash);
  const results=await Promise.allSettled([run.begin('first'),other.begin('first')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.match(results.find(r=>r.status==='rejected').reason.message,/checkpoint changed/);
}));
test('malformed persisted state is preserved and rejected',async()=>fixture(async(lease,dir)=>{
  const run=await J.create(lease,'workflow',hash,'first');const file=path.join(dir,run.snapshot().runId+'.json');fs.writeFileSync(file,'{broken');assert.throws(()=>J.open(lease,run.snapshot().runId,hash));assert.equal(fs.readFileSync(file,'utf8'),'{broken');
}));
test('failed steps retain evidence even when an explicit transition continues',async()=>fixture(async lease=>{
  const run=await J.create(lease,'workflow',hash,'first');await run.begin('first');await run.finish('first',false,'failure','handler');assert.equal(run.snapshot().steps[0].status,'failed');assert.equal(run.snapshot().phase,'ready');await run.begin('handler');await run.finish('handler',false,'unhandled',null);assert.equal(run.snapshot().phase,'failed');
}));

const sessionHost=execute=>({execute,evaluate:async()=> 'NO',redact:text=>text.replaceAll('fake-secret','[redacted]'),onTransitionError:()=>{}});

test('late success or failure after stop is durable but never starts evaluation or force continuation',async()=>fixture(async lease=>{
  for (const succeeded of [true,false]) {
    const definition=prepare({id:'late',steps:[{id:'a',stepKind:'task',taskId:'t',transitions:[{toStepId:'b',mode:'eval'},{toStepId:'b',forceContinue:true}]},{id:'b',stepKind:'code'}]},[{id:'t'}],{});
    const run=await J.create(lease,'late',definition.hash,'a'),controller=new AbortController();
    let release,started;const ready=new Promise(resolve=>started=resolve),calls=[];
    const pending=advance(run,definition,{...sessionHost(async step=>{calls.push(step.id);started();return await new Promise(resolve=>release=resolve);}),
      evaluate:async()=>{calls.push('eval');return 'YES';}}, {signal:controller.signal});
    await ready;controller.abort();release({succeeded,output:'late result'});
    const result=await pending;
    assert.deepEqual(calls,['a']);assert.equal(result.phase,'in_flight');
    assert.equal(result.steps[0].result.output,'late result');
    assert.deepEqual(J.open(lease,result.runId,definition.hash).snapshot(),result);
    const {projectWorkflowProgress}=load('workflow-progress');
    assert.equal(projectWorkflowProgress(definition.workflow,definition.tasks,{},result,result.runId).runtimeExecution.requiresReconciliation,true);
  }
}));

test('stop at evaluation publication blocks evaluation effects and keeps reconciliation evidence',async()=>fixture(async lease=>{
  const definition=prepare({id:'eval-stop',steps:[{id:'a',stepKind:'task',taskId:'t',transitions:[{toStepId:'b',mode:'eval'}]},{id:'b',stepKind:'code'}]},[{id:'t'}],{});
  const run=await J.create(lease,'eval-stop',definition.hash,'a'),controller=new AbortController();let evaluations=0;
  await assert.rejects(advance(run,definition,{...sessionHost(async()=>({succeeded:true,output:'observed'})),
    evaluate:async()=>{evaluations++;return 'YES';},
    onCheckpoint:async state=>{if(state.steps.at(-1)?.evaluations?.length)controller.abort();},
  },{signal:controller.signal}),/cancelled before evaluation effects/);
  assert.equal(evaluations,0);assert.equal(run.snapshot().steps.length,1);
  assert.equal(run.snapshot().steps[0].evaluations[0].status,'in_flight');
}));

test('late thread callback cannot bind an earlier occurrence to a repeated step',async()=>fixture(async(lease,dir)=>{
  const definition=prepare({id:'repeat',steps:[{id:'a',stepKind:'task',taskId:'t',transitions:[{toStepId:'a',forceContinue:true}]}]},[{id:'t'}],{});
  let prior,calls=0;
  const tasks={supports:()=>true,execute:async(task,prompt,signal,recordThread)=>{
    calls++;
    if(calls===1)prior=recordThread;
    else {
      await assert.rejects(prior('old-thread','old-turn'),/occurrence/);
      await recordThread('current-thread','current-turn');
    }
    return {succeeded:true,output:'done'};
  }};
  const result=await runCodeWorkflowHost({definition,runtimeDirectory:dir,vaultBase:dir,lease,tasks,redact:s=>s,maxSteps:2});
  assert.equal(result.steps[0].codexThreadId,undefined);
  assert.equal(result.steps[1].codexThreadId,'current-thread');
}));

test('cancellation before effects and confirmed terminal cancellation do not follow force transitions',async()=>fixture(async lease=>{
  for(const when of ['before','terminal']) {
    const definition=prepare({id:'cancel',steps:[{id:'a',stepKind:'task',taskId:'t',transitionMode:'force'},{id:'b',stepKind:'code'}]},[{id:'t'}],{});
    const run=await J.create(lease,'cancel',definition.hash,'a'),controller=new AbortController();let calls=0;
    const result=await advance(run,definition,{...sessionHost(async()=>{calls++;return {succeeded:false,cancelled:true,output:'observed cancellation'};}),
      onCheckpoint:async state=>{if(when==='before'&&state.phase==='in_flight')controller.abort();}}, {signal:controller.signal});
    assert.equal(result.phase,'failed');assert.equal(result.steps.length,1);assert.equal(calls,when==='before'?0:1);
  }
}));
test('Code host runs without Obsidian and retains complete durable output',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-host-'));
  try {
    const definition=prepare({id:'fixture',steps:[{id:'a',stepKind:'code',code:'output = "q".repeat(24000);'},{id:'b',stepKind:'code',code:'output = input.length;'}]},[],{});
    const result=await runCodeWorkflowHost({definition,runtimeDirectory:dir,vaultBase:dir,redact:s=>s});
    assert.equal(result.phase,'completed');assert.equal(result.steps[1].output,'24000');assert.equal(fs.existsSync(path.join(dir,'execution.lock')),false);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,result.runId+'.json'))),result);
  } finally {for(const file of fs.readdirSync(dir)){assert.match(file,/^[a-f0-9-]+\.json$/);fs.unlinkSync(path.join(dir,file));}fs.rmdirSync(dir);}
});
test('Code host refuses unsupported steps before creating execution artifacts',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-host-'));
  try {
    const definition=prepare({id:'fixture',steps:[{id:'a',stepKind:'task',taskId:'t'}]},[{id:'t'}],{});
    await assert.rejects(runCodeWorkflowHost({definition,runtimeDirectory:dir,vaultBase:dir,redact:s=>s}),/No adapter/);assert.deepEqual(fs.readdirSync(dir),[]);
  } finally {fs.rmdirSync(dir);}
});
test('definition binds referenced task permissions and defaults but ignores runtime and unrelated tasks',()=>{
  const workflow={id:'workflow',steps:[{id:'a',stepKind:'task',taskId:'t'}]};
  const task={id:'t',prompt:'hello',codeAllowTerminal:false};
  const first=prepare(workflow,[task],{defaultModel:'m'});
  assert.equal(first.hash,prepare({...workflow,status:'running'},[{...task,output:'old',status:'completed'},{id:'other',prompt:'different'}],{defaultModel:'m'}).hash);
  assert.notEqual(first.hash,prepare(workflow,[{...task,codeAllowTerminal:true}],{defaultModel:'m'}).hash);
  assert.notEqual(first.hash,prepare(workflow,[task],{defaultModel:'changed'}).hash);
  assert.ok(Object.isFrozen(first.workflow.steps));assert.ok(Object.isFrozen(first.tasks[0]));
  assert.throws(()=>prepare(workflow,[],{}),/referenced task/);
});
test('changed execution definition is rejected before any effect',async()=>fixture(async lease=>{
  const workflow={id:'workflow',steps:[{id:'a',stepKind:'code',code:'output = 1;'}]};
  const first=prepare(workflow,[],{}),run=await J.create(lease,'workflow',first.hash,'a');let calls=0;
  const changed=prepare({...workflow,steps:[{...workflow.steps[0],code:'output = 2;'}]},[],{});
  await assert.rejects(advance(run,changed,sessionHost(async()=>{calls++;return {succeeded:true,output:'x'};})),/does not match/);
  assert.equal(calls,0);assert.equal(run.snapshot().phase,'ready');
}));
test('session preserves legacy forced task continuation after observed failure',async()=>fixture(async lease=>{
  const definition=prepare({id:'workflow',steps:[{id:'a',stepKind:'task',taskId:'t',transitionMode:'force'},{id:'b',stepKind:'code'}]},[{id:'t',prompt:'fixture'}],{});
  const run=await J.create(lease,'workflow',definition.hash,'a'),seen=[];
  const result=await advance(run,definition,sessionHost(async step=>{seen.push(step.id);return {succeeded:step.id==='b',output:step.id};}));
  assert.deepEqual(seen,['a','b']);assert.equal(result.phase,'completed');assert.equal(result.steps[0].status,'failed');
}));
test('headless session executes Code with full handoff, current outputs and durable completion',async()=>fixture(async lease=>{
  const steps=[{id:'a',code:'output = "z".repeat(24000);',transitions:[{toStepId:'b',mode:'conditional',condition:'outputs.a === input && input.length === 24000'}]}, {id:'b',code:'output = input.length + ":fake-secret";'}];
  const run=await J.create(lease,'workflow',prepare({id:'workflow',steps},[],{}).hash,'a');
  const result=await advance(run,prepare({id:'workflow',steps},[],{}),sessionHost(async(step,input,outputs)=>({succeeded:true,output:executeCode({vaultBase:lease.directory,cwd:lease.directory,code:step.code,input,outputs})})));
  assert.equal(result.phase,'completed');assert.equal(result.steps.length,2);assert.equal(result.steps[1].output,'24000:[redacted]');
}));
test('known failure stops default continuation while transport uncertainty remains in flight',async()=>fixture(async lease=>{
  const steps=[{id:'a'},{id:'b'}],run=await J.create(lease,'workflow',prepare({id:'workflow',steps},[],{}).hash,'a');let calls=0;
  const result=await advance(run,prepare({id:'workflow',steps},[],{}),sessionHost(async()=>{calls++;return {succeeded:false,output:'error'};}));assert.equal(result.phase,'failed');assert.equal(calls,1);
  const uncertain=await J.create(lease,'workflow',prepare({id:'workflow',steps},[],{}).hash,'a');await assert.rejects(advance(uncertain,prepare({id:'workflow',steps},[],{}),sessionHost(async()=>{throw Error('transport lost');})),/transport lost/);assert.equal(uncertain.snapshot().phase,'in_flight');
  await assert.rejects(advance(uncertain,prepare({id:'workflow',steps},[],{}),sessionHost(async()=>{throw Error('must not replay');})),/reconciliation/);
}));
test('bounded continuation reopens at next step without repeating prior effects',async()=>fixture(async lease=>{
  const steps=[{id:'a'},{id:'b'}],run=await J.create(lease,'workflow',prepare({id:'workflow',steps},[],{}).hash,'a'),seen=[];
  const host=sessionHost(async step=>{seen.push(step.id);return {succeeded:true,output:step.id};});
  assert.equal((await advance(run,prepare({id:'workflow',steps},[],{}),host,{maxSteps:1})).phase,'ready');
  const reopened=J.open(lease,run.snapshot().runId,run.snapshot().definitionHash);assert.equal((await advance(reopened,prepare({id:'workflow',steps},[],{}),host)).phase,'completed');assert.deepEqual(seen,['a','b']);
}));

test('headless delay cancellation records observed failure and never follows force-continue',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-delay-'));
  try {
    const definition=prepare({id:'fixture',steps:[{id:'wait',stepKind:'delay',delayValue:60,transitions:[{toStepId:'effect',forceContinue:true}]},{id:'effect',stepKind:'code',code:'output = "should not run";'}]},[],{});
    const abort=new AbortController();
    let timer;
    const pending=runCodeWorkflowHost({definition,runtimeDirectory:dir,vaultBase:dir,signal:abort.signal,redact:s=>s,onCheckpoint:async state=>{if(state.phase==='in_flight')timer=setTimeout(()=>abort.abort(),30);}});
    try {assert.equal((await pending).phase,'failed');} finally {clearTimeout(timer);}
    const files=fs.readdirSync(dir);assert.equal(files.length,1);
    const saved=JSON.parse(fs.readFileSync(path.join(dir,files[0]),'utf8'));
    assert.equal(saved.phase,'failed');assert.equal(saved.steps.length,1);assert.equal(saved.steps[0].stepId,'wait');assert.match(saved.steps[0].output,/cancelled/);
    assert.equal((await runCodeWorkflowHost({definition,runtimeDirectory:dir,vaultBase:dir,redact:s=>s,resumeRunId:saved.runId})).phase,'failed');
  } finally {for(const file of fs.readdirSync(dir)){assert.match(file,/^[a-f0-9-]+\.json$/);fs.unlinkSync(path.join(dir,file));}fs.rmdirSync(dir);}
});

test('host resumes the same ready run and never repeats a completed effect',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-resume-'));
  const effect=path.join(dir,'effects.txt');
  try {
    const definition=prepare({id:'fixture',steps:[
      {id:'a',stepKind:'code',codeAllowVault:true,code:'vault.append("effects.txt", "a"); output = "first";'},
      {id:'b',stepKind:'code',codeAllowVault:true,code:'vault.append("effects.txt", "b"); output = input + "-second";'}
    ]},[],{});
    const options={definition,runtimeDirectory:dir,vaultBase:dir,redact:s=>s};
    await assert.rejects(runCodeWorkflowHost({...options,maxSteps:0}),/limit/);
    assert.deepEqual(fs.readdirSync(dir),[]);
    const first=await runCodeWorkflowHost({...options,maxSteps:1});
    assert.equal(first.phase,'ready');assert.equal(fs.readFileSync(effect,'utf8'),'a');
    await assert.rejects(runCodeWorkflowHost(options),/continuation/);
    const done=await runCodeWorkflowHost({...options,resumeRunId:first.runId});
    assert.equal(done.runId,first.runId);assert.equal(done.phase,'completed');
    assert.equal(done.steps[1].output,'first-second');assert.equal(fs.readFileSync(effect,'utf8'),'ab');
    const replay=await runCodeWorkflowHost({...options,resumeRunId:first.runId});
    assert.deepEqual(replay,done);assert.equal(fs.readFileSync(effect,'utf8'),'ab');
    const changed=prepare({...definition.workflow,steps:[{id:'a',stepKind:'code',code:'output = "changed";'}]},[],{});
    await assert.rejects(runCodeWorkflowHost({...options,definition:changed,resumeRunId:first.runId}),/definition changed/);
  } finally {for(const file of fs.readdirSync(dir)){assert.ok(file==='effects.txt'||/^[a-f0-9-]+\.json$/.test(file));fs.unlinkSync(path.join(dir,file));}fs.rmdirSync(dir);}
});

test('host refuses explicit resume of an uncertain effect without rewriting its checkpoint',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-uncertain-'));
  try {
    const definition=prepare({id:'fixture',steps:[{id:'a',stepKind:'code',code:'output = "never";'}]},[],{});
    const lease=acquireExecutionLease(dir);
    const journal=await J.create(lease,'fixture',definition.hash,'a');await journal.begin('a');lease.release();
    const before=journal.snapshot();
    await assert.rejects(runCodeWorkflowHost({definition,runtimeDirectory:dir,vaultBase:dir,redact:s=>s,resumeRunId:before.runId}),/reconciliation/);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,before.runId+'.json'),'utf8')),before);
  } finally {for(const file of fs.readdirSync(dir)){assert.match(file,/^[a-f0-9-]+\.json$/);fs.unlinkSync(path.join(dir,file));}fs.rmdirSync(dir);}
});

test('mixed Code to Codex to Code workflow shares handoff and waits for task completion',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-mixed-'));
  try {
    const {codexWorkflowAdapter}=load('codex-workflow-adapter');
    const {createCodeWorkflowAdapter}=load('code-workflow-adapter');
    const {combineWorkflowTaskAdapters}=load('workflow-task-adapters');
    let disposed=0,calls=0;
    const definition=prepare({id:'mixed',handoffOutput:true,steps:[
      {id:'prepare',stepKind:'code',code:'output = "x".repeat(24000);'},
      {id:'agent',stepKind:'task',taskId:'codex'},
      {id:'code-task',stepKind:'task',taskId:'code'},
      {id:'finish',stepKind:'code',code:'output = input + ":" + outputs.prepare.length;'}
    ]},[{id:'codex',taskKind:'codex',prompt:'Read the input',model:'fixture-model'},{id:'code',taskKind:'code',code:'output="code done";'}],{});
    const codex=codexWorkflowAdapter((task,callbacks)=>({
      run:async(prompt,model,effort,policy)=>{calls++;await callbacks.onThreadCreated({threadId:'fixture-thread'});assert.equal(task.id,'codex');assert.ok(Object.isFrozen(task));assert.ok(prompt.includes('x'.repeat(24000)));assert.equal(model,'fixture-model');assert.equal(policy,'never');return {status:'completed',output:'done',threadId:'fixture-thread',turnId:'fixture-turn'};},
      interrupt:async()=>{},dispose:()=>{disposed++;}
    }));
    const tasks=combineWorkflowTaskAdapters([createCodeWorkflowAdapter(dir),codex]);
    const result=await runCodeWorkflowHost({definition,runtimeDirectory:dir,vaultBase:dir,tasks,redact:s=>s});
    assert.equal(result.phase,'completed');assert.equal(result.steps[1].codexThreadId,'fixture-thread');assert.equal(result.steps[3].output,'[running code task...]\ncode done:24000');assert.equal(calls,1);assert.equal(disposed,1);
  } finally {for(const file of fs.readdirSync(dir)){assert.match(file,/^[a-f0-9-]+\.json$/);fs.unlinkSync(path.join(dir,file));}fs.rmdirSync(dir);}
});

test('UTF-8 Codex bytes survive the real adapter, journal reopen and next Code input',async()=>fixture(async(lease,dir)=>{
  const {CodexAppServerClient,JsonLineRpcPeer}=load('codex-client');
  const {codexWorkflowAdapter}=load('codex-workflow-adapter');
  const answer=JSON.stringify({text:'acción, pingüino, € 😀',path:'carpeta/niño/😀',decomposed:'a\u0301'});
  const definition=prepare({id:'utf8',handoffOutput:true,steps:[
    {id:'agent',stepKind:'task',taskId:'codex'},
    {id:'next',stepKind:'code',code:'if (input !== outputs.agent) throw Error("changed handoff"); output = input;'}
  ]},[{id:'codex',taskKind:'codex',prompt:'fixture'}],{});
  const requests=[];
  const tasks=codexWorkflowAdapter((task,callbacks)=>{
    const client=new CodexAppServerClient('fixture',dir,callbacks);
    client.initialize=async()=>{};
    const feed=message=>{
      for(const byte of Buffer.from(JSON.stringify(message)+'\n','utf8'))client.peer.feed(Buffer.from([byte]));
    };
    client.peer=new JsonLineRpcPeer(line=>{
      const request=JSON.parse(line);requests.push(request.method);
      if(request.method==='thread/start')feed({id:request.id,result:{thread:{id:'hilo-ñ'}}});
      else if(request.method==='turn/start'){
        feed({id:request.id,result:{turn:{id:'turno-😀'}}});
        setImmediate(()=>{
          feed({method:'item/agentMessage/delta',params:{itemId:'f',delta:answer}});
          feed({method:'item/completed',params:{item:{id:'f',type:'agentMessage',phase:'final_answer',text:answer}}});
          feed({method:'turn/completed',params:{threadId:'hilo-ñ',turn:{id:'turno-😀',status:'completed'}}});
        });
      } else assert.fail('Unexpected RPC: '+request.method);
    },message=>client.handleMessage(message));
    return client;
  });
  const first=await runCodeWorkflowHost({definition,runtimeDirectory:dir,vaultBase:dir,lease,tasks,redact:s=>s,maxSteps:1});
  assert.equal(first.phase,'ready');assert.equal(first.steps[0].output,answer);
  assert.equal(first.steps[0].codexThreadId,'hilo-ñ');assert.equal(first.steps[0].codexTurnId,'turno-😀');
  const reopened=J.open(lease,first.runId,definition.hash).snapshot();
  assert.deepEqual(reopened,first);
  const resumed=await runCodeWorkflowHost({definition,runtimeDirectory:dir,vaultBase:dir,lease,tasks,redact:s=>s,resumeRunId:first.runId});
  assert.equal(resumed.phase,'completed');assert.equal(resumed.steps[1].output,answer);
  assert.equal(J.open(lease,first.runId,definition.hash).snapshot().steps[1].output,answer);
  assert.deepEqual(requests,['thread/start','turn/start']);
}));

test('Codex transport loss is uncertain and adapter disposal never turns it into success',async()=>{
  const {codexWorkflowAdapter}=load('codex-workflow-adapter');let disposed=0;
  const adapter=codexWorkflowAdapter(()=>({run:async()=>{throw Error('transport lost');},interrupt:async()=>{},dispose:()=>disposed++}));
  assert.equal(adapter.supports({taskKind:'codex',interactiveTerminal:true}),true);
  assert.equal(adapter.supports({taskKind:'codex',createBranch:true}),true);
  await assert.rejects(adapter.execute({taskKind:'codex',interactiveTerminal:true},'fixture'),/approval channel/);
  await assert.rejects(adapter.execute({taskKind:'codex'},'fixture'),/transport lost/);assert.equal(disposed,1);
});

test('Codex thread identity survives restart and cannot be replaced on a step',async()=>fixture(async lease=>{
  const run=await J.create(lease,'workflow',hash,'a');await run.begin('a');
  await run.recordCodexThread('a','thread-one');
  const reopened=J.open(lease,run.snapshot().runId,hash);
  assert.equal(reopened.snapshot().steps[0].codexThreadId,'thread-one');
  await assert.rejects(reopened.recordCodexThread('a','thread-two'),/identity changed/);
  await assert.rejects(reopened.recordCodexThread('other','thread-one'),/matching step/);
  assert.equal(reopened.snapshot().phase,'in_flight');
}));

test('journal preserves exact turn and rejects replacement during recovery',async()=>fixture(async lease=>{
  const run=await J.create(lease,'workflow',hash,'a');await run.begin('a');
  await run.recordCodexThread('a','thread','turn');
  const reopened=J.open(lease,run.snapshot().runId,hash);
  assert.equal(reopened.snapshot().steps[0].codexTurnId,'turn');
  await assert.rejects(reopened.recordCodexThread('a','thread','other'),/turn identity changed/);
  await reopened.finish('a',true,'verified',null);
  assert.equal(reopened.snapshot().steps[0].codexTurnId,'turn');
}));

test('recovery records only the saved terminal result without replaying the task',async()=>fixture(async lease=>{
  const {reconcileWorkflowTask}=load('workflow-recovery');
  const definition=prepare({id:'wf',steps:[{id:'a',stepKind:'task',taskId:'t'},{id:'b',stepKind:'code',code:'output = input;'}]},[{id:'t',taskKind:'codex'}],{});
  const journal=await J.create(lease,'wf',definition.hash,'a');await journal.begin('a');await journal.recordCodexThread('a','thread','turn');
  const before=journal.snapshot(),host=sessionHost(()=>{throw Error('must not execute');});
  const result={threadId:'thread',turnId:'turn',status:'inProgress',output:'partial'};
  assert.deepEqual(await reconcileWorkflowTask(journal,definition,async()=>result,host),before);
  await assert.rejects(reconcileWorkflowTask(journal,definition,async()=>({...result,turnId:'other'}),host),/identity mismatch/);
  const ready=await reconcileWorkflowTask(journal,definition,async()=>({...result,status:'completed',output:'done'}),host);
  assert.equal(ready.phase,'ready');assert.equal(ready.nextStepId,'b');assert.equal(ready.steps.length,1);assert.equal(ready.steps[0].output,'done');
  assert.deepEqual(await reconcileWorkflowTask(journal,definition,async()=>{throw Error('must not reread');},host),ready);
}));

test('host reconciliation finishes observed task then continues the same run without relaunch',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-recover-host-'));
  try {
    const definition=prepare({id:'wf',steps:[{id:'a',stepKind:'task',taskId:'t'},{id:'b',stepKind:'code',code:'output = input + "-next";'}]},[{id:'t',taskKind:'codex'}],{});
    const lease=acquireExecutionLease(dir),journal=await J.create(lease,'wf',definition.hash,'a');
    await journal.begin('a');await journal.recordCodexThread('a','thread','turn');lease.release();
    const tasks={supports:()=>true,execute:async()=>{throw Error('must not relaunch');},reconcile:async(task,threadId,turnId)=>({threadId,turnId,status:'completed',output:'done'})};
    const options={definition,runtimeDirectory:dir,vaultBase:dir,tasks,redact:s=>s,resumeRunId:journal.snapshot().runId};
    const reconciled=await runCodeWorkflowHost({...options,reconcile:true,onCheckpoint:async state=>{state.phase="failed";}});
    assert.equal(reconciled.phase,'ready');assert.equal(reconciled.steps.length,1);
    const done=await runCodeWorkflowHost(options);assert.equal(done.runId,reconciled.runId);assert.equal(done.steps[1].output,'done-next');
    await assert.rejects(runCodeWorkflowHost({...options,reconcile:true,resumeRunId:undefined}),/existing run identity/);
  } finally {for(const file of fs.readdirSync(dir)){assert.match(file,/^[a-f0-9-]+\.json$/);fs.unlinkSync(path.join(dir,file));}fs.rmdirSync(dir);}
});

test('adapter selection rejects ambiguity and never retries effects in another executor',async()=>{
  const {combineWorkflowTaskAdapters:combine}=load('workflow-task-adapters');
  let calls=0;
  const adapter={supports:t=>t.taskKind==='fixture',execute:async()=>{calls++;throw Error('uncertain effect');},reconcile:async(t,threadId,turnId)=>({threadId,turnId,status:'completed',output:'observed'})};
  const task={taskKind:'fixture'};
  const ambiguous=combine([adapter,adapter]);assert.equal(ambiguous.supports(task),false);
  assert.throws(()=>ambiguous.execute(task,''),/exactly one/);assert.equal(calls,0);
  const selected=combine([adapter]);
  await assert.rejects(selected.execute(task,''),/uncertain effect/);assert.equal(calls,1);
  assert.deepEqual(await selected.reconcile(task,'thread','turn'),{threadId:'thread',turnId:'turn',status:'completed',output:'observed'});
  assert.equal(selected.supports({taskKind:'unsupported'}),false);
  await assert.rejects(combine([{supports:()=>true,execute:async()=>({succeeded:true,output:''})}]).reconcile(task,'thread','turn'),/cannot reconcile/);
});

test('unfinished execution reserves the vault across different workflows until resumed',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-vault-reservation-'));
  try {
    const first=prepare({id:'first',steps:[{id:'a',stepKind:'code',code:'output="first";'},{id:'b',stepKind:'code',code:'output=input+" done";'}]},[],{});
    const second=prepare({id:'second',steps:[{id:'a',stepKind:'code',code:'output="second";'}]},[],{});
    const options={runtimeDirectory:dir,vaultBase:dir,redact:s=>s};
    const pending=await runCodeWorkflowHost({...options,definition:first,maxSteps:1});
    assert.equal(pending.phase,'ready');
    const before=fs.readFileSync(path.join(dir,pending.runId+'.json'),'utf8');
    await assert.rejects(runCodeWorkflowHost({...options,definition:second}),/Previous execution requires/);
    assert.equal(fs.readFileSync(path.join(dir,pending.runId+'.json'),'utf8'),before);
    assert.deepEqual(fs.readdirSync(dir),[pending.runId+'.json']);
    const done=await runCodeWorkflowHost({...options,definition:first,resumeRunId:pending.runId});
    assert.equal(done.phase,'completed');assert.equal(done.steps.length,2);
    const next=await runCodeWorkflowHost({...options,definition:second});
    assert.equal(next.phase,'completed');assert.notEqual(next.runId,pending.runId);
  } finally {for(const file of fs.readdirSync(dir)){assert.match(file,/^[a-f0-9-]+\.json$/);fs.unlinkSync(path.join(dir,file));}fs.rmdirSync(dir);}
});

test('progress observer sees persisted boundaries and cannot mutate or race execution state',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-progress-'));
  try {
    const definition=prepare({id:'wf',steps:[{id:'a',stepKind:'code',code:'output="done";'}]},[],{});
    const seen=[];
    const result=await runCodeWorkflowHost({definition,runtimeDirectory:dir,vaultBase:dir,redact:s=>s,
      onCheckpoint:async state=>{
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,state.runId+'.json'),'utf8')),state);
        seen.push(state.phase);state.phase='failed';
        await new Promise(resolve=>setImmediate(resolve));
      }});
    assert.deepEqual(seen,['ready','in_flight','completed']);assert.equal(result.phase,'completed');
  } finally {for(const file of fs.readdirSync(dir)){assert.match(file,/^[a-f0-9-]+\.json$/);fs.unlinkSync(path.join(dir,file));}fs.rmdirSync(dir);}
});

test('failed publication before step effects records a known failure and never replays that step',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-publish-before-effect-'));
  try {
    const definition=prepare({id:'wf',steps:[{id:'a',stepKind:'code',codeAllowVault:true,code:'vault.write("unexpected.txt","effect");'}]},[],{});
    let id;
    await assert.rejects(runCodeWorkflowHost({definition,runtimeDirectory:dir,vaultBase:dir,redact:s=>s,
      onCheckpoint:async state=>{id=state.runId;if(state.phase==='in_flight')throw Error('private filesystem diagnostic');}}),/private filesystem diagnostic/);
    const saved=JSON.parse(fs.readFileSync(path.join(dir,id+'.json'),'utf8'));
    assert.equal(saved.phase,'failed');assert.equal(saved.steps[0].status,'failed');
    assert.match(saved.steps[0].output,/before step effects/);
    assert.ok(!JSON.stringify(saved).includes('private filesystem diagnostic'));
    assert.equal(fs.existsSync(path.join(dir,'unexpected.txt')),false);
    const resumed=await runCodeWorkflowHost({definition,runtimeDirectory:dir,vaultBase:dir,redact:s=>s,resumeRunId:id});
    assert.deepEqual(resumed,saved);assert.equal(fs.existsSync(path.join(dir,'unexpected.txt')),false);
  } finally {for(const file of fs.readdirSync(dir)){assert.match(file,/^[a-f0-9-]+\.json$/);fs.unlinkSync(path.join(dir,file));}fs.rmdirSync(dir);}
});

test('failed progress persistence stops advancement while retaining completed effects',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-progress-fail-'));
  try {
    const definition=prepare({id:'wf',steps:[{id:'a',stepKind:'code',code:'output="completed-effect";'},{id:'b',stepKind:'code',code:'output="next-effect";'}]},[],{});
    let id;
    await assert.rejects(runCodeWorkflowHost({definition,runtimeDirectory:dir,vaultBase:dir,redact:s=>s,
      onCheckpoint:async state=>{id=state.runId;if(state.phase==='ready'&&state.steps.length)throw Error('view write failed');}}),/view write failed/);
    const saved=JSON.parse(fs.readFileSync(path.join(dir,id+'.json'),'utf8'));
    assert.equal(saved.phase,'ready');assert.equal(saved.steps.length,1);assert.equal(saved.nextStepId,'b');
    const done=await runCodeWorkflowHost({definition,runtimeDirectory:dir,vaultBase:dir,redact:s=>s,resumeRunId:id});
    assert.equal(done.phase,'completed');assert.equal(done.steps.length,2);assert.equal(done.runId,id);
  } finally {for(const file of fs.readdirSync(dir)){assert.match(file,/^[a-f0-9-]+\.json$/);fs.unlinkSync(path.join(dir,file));}fs.rmdirSync(dir);}
});
