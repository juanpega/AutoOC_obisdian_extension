const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'..');
const compiled=require('esbuild').buildSync({stdin:{contents:['code-runtime','code-workflow-host','code-workflow-adapter','workflow-definition','execution-journal'].map(f=>`export * from './${f}';`).join('\n'),resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;

function fixture() {
  const child=new EventEmitter();Object.assign(child,{pid:123456,exitCode:null,signalCode:null,connected:true,stderr:new EventEmitter()});
  let effects=0,spawns=0,started;
  const spawning=new Promise(resolve=>{started=resolve;}),treeStops=[];
  child.stderr.destroy=()=>{};child.unref=()=>{};
  child.disconnect=()=>{child.connected=false;child.emit('disconnect');};
  child.send=(_data,callback)=>{effects++;callback?.(null);};
  child.kill=()=>{child.emit('error',Object.assign(new Error('fixture termination denied'),{code:'EPERM'}));return false;};
  const timers=new Map();let next=0;
  const clock={setTimeout(fn,ms){const id=++next;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);}};
  const mod=new Module(path.join(root,'protocol-fixture.cjs'),module);mod.filename=path.join(root,'protocol-fixture.cjs');mod.paths=module.paths;
  const original=mod.require.bind(mod);
  mod.require=name=>name==='fixture-clock'?clock:name==='fixture-process'?{...process,kill(pid,signal){treeStops.push({pid,signal});}}:name==='child_process'?{...require('node:child_process'),spawn(executable,args){
    if(executable.endsWith('taskkill.exe')){treeStops.push({args});const killer=new EventEmitter();killer.kill=()=>true;killer.unref=()=>{};return killer;}
    spawns++;started();return child;
  }}:original(name);
  mod._compile("const {setTimeout,clearTimeout}=require('fixture-clock');const process=require('fixture-process');\n"+compiled,mod.filename);
  return {api:mod.exports,child,timers,spawning,treeStops,get effects(){return effects;},get spawns(){return spawns;},
    fireTimers(){const pending=[...timers.values()];timers.clear();for(const {fn} of pending)fn();}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const options={vaultBase:root,cwd:root,code:'output="fixture";'};

test('disconnect after dispatch settles even when kill is denied and close never arrives',async()=>{
  const f=fixture();let settled=false;
  const result=f.api.executeCodeAsync(options).then(value=>({value}),error=>({error})).finally(()=>{settled=true;});
  f.child.emit('message',{type:'ready'});f.child.disconnect();
  await flush();f.fireTimers();await flush();
  const bounded=settled;
  // Release the pre-fix implementation, so RED never strands the test runner.
  f.child.emit('close',5);const outcome=await result;
  assert.equal(bounded,true,'transport loss must not wait forever for close');
  assert.ok(outcome.error);assert.equal(f.effects,1);assert.equal(f.spawns,1);
});

test('ready retains a finite result deadline and duplicate ready never dispatches twice',async()=>{
  const f=fixture();let settled=false;
  const result=f.api.executeCodeAsync(options).catch(error=>error).finally(()=>{settled=true;});
  f.child.emit('message',{type:'ready'});f.child.emit('message',{type:'ready'});
  const deadlines=[...f.timers.values()].map(timer=>timer.ms);
  f.fireTimers();await flush();f.fireTimers();await flush();const bounded=settled;
  f.child.emit('close',5);await result;
  assert.ok(deadlines.some(ms=>ms>=900000 && ms<=960000),'deadline must cover the existing 15-minute Code budget');
  assert.equal(bounded,true);assert.equal(f.effects,1);
  assert.equal(f.treeStops.length,1,'a result timeout must request termination of descendants too');
  if(process.platform==='win32')assert.deepEqual(f.treeStops[0].args,['/PID',String(f.child.pid),'/T','/F']);
  else assert.deepEqual(f.treeStops[0],{pid:-f.child.pid,signal:'SIGKILL'});
});

for(const kind of ['step','task'])test(`lost ${kind} result preserves in-flight journal and blocks replay`,async()=>{
  const f=fixture(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-code-protocol-'));
  const task={id:'t',taskKind:'code',code:'output="fixture";'};
  const definition=f.api.prepareWorkflowDefinition({id:'w',steps:[kind==='step'?{id:'s',stepKind:'code',code:task.code}:{id:'s',stepKind:'task',taskId:'t'}]},kind==='task'?[task]:[],{});
  let checkpoint;
  const host={definition,runtimeDirectory:directory,vaultBase:directory,redact:s=>s,tasks:f.api.createCodeWorkflowAdapter(directory),onCheckpoint:async state=>{checkpoint=state;}};
  try {
    const result=f.api.runCodeWorkflowHost(host).then(value=>({value}),error=>({error}));
    await Promise.race([f.spawning,result]);assert.equal(f.spawns,1);
    f.child.emit('message',{type:'ready'});f.child.disconnect();f.child.emit('close',5);
    const outcome=await result;
    const journal=JSON.parse(fs.readFileSync(path.join(directory,checkpoint.runId+'.json'),'utf8'));
    assert.ok(outcome.error,'missing transport result is not an observed script failure');
    assert.equal(journal.phase,'in_flight');assert.equal(journal.steps[0].result,undefined);
    assert.ok(f.api.checkpointUncertainties(journal).length);
    await assert.rejects(f.api.runCodeWorkflowHost({...host,resumeRunId:journal.runId}),/reconciliation|replay/i);
    assert.equal(f.effects,1);assert.equal(f.spawns,1);
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});

for(const event of ['startup timeout','send failure','worker crash','abort','callback failure','result without close'])test(`${event} cannot wait indefinitely or claim an observed script failure`,async()=>{
  const f=fixture(),controller=new AbortController();let settled=false;
  if(event==='send failure')f.child.send=(_data,callback)=>callback(new Error('send failed'));
  const result=f.api.executeCodeAsync({...options,log(){throw new Error('observer failed');}},controller.signal)
    .then(value=>({value}),error=>({error})).finally(()=>{settled=true;});
  if(event==='startup timeout')f.fireTimers();
  else {
    f.child.emit('message',{type:'ready'});
    if(event==='worker crash')f.child.emit('message',{type:'runner-error'});
    if(event==='abort')controller.abort();
    if(event==='callback failure')f.child.emit('message',{type:'log',text:'fixture'});
    if(event==='result without close')f.child.emit('message',{type:'result',output:'observed'});
  }
  await flush();f.fireTimers();await flush();
  const bounded=settled;f.child.emit('close',5);const outcome=await result;
  assert.equal(bounded,true);assert.ok(outcome.error);assert.ok(!(outcome.error instanceof f.api.CodeExecutionError));
  assert.equal(f.spawns,1);assert.equal(f.timers.size,0);
  if (['send failure','worker crash','abort','callback failure'].includes(event))
    assert.equal(f.treeStops.length,1,'loss of an in-flight result must terminate the owned process tree');
});

test('transport loss ignores late results and observer callbacks',async()=>{
  const f=fixture();let observations=0;
  const result=f.api.executeCodeAsync({...options,log(){observations++;},onVaultMutation(){observations++;}}).catch(error=>error);
  f.child.emit('message',{type:'ready'});f.child.disconnect();
  f.child.emit('message',{type:'result',output:'late'});
  f.child.emit('message',{type:'log',text:'late'});
  f.child.emit('message',{type:'mutation',mutation:{path:'late',operation:'write'}});
  await flush();f.fireTimers();await flush();
  f.child.emit('close',5);
  assert.ok(await result instanceof Error);assert.equal(observations,0);assert.equal(f.effects,1);
  assert.equal(f.treeStops.length,1);
});

for(const kind of ['step','task'])for(const succeeded of [true,false])test(`confirmed ${kind} ${succeeded?'result':'script error'} keeps its terminal outcome`,async()=>{
  const f=fixture(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-code-protocol-'));
  const task={id:'t',taskKind:'code',code:'output="fixture";'};
  const definition=f.api.prepareWorkflowDefinition({id:'w',steps:[kind==='step'?{id:'s',stepKind:'code',code:task.code}:{id:'s',stepKind:'task',taskId:'t'}]},kind==='task'?[task]:[],{});
  try {
    const result=f.api.runCodeWorkflowHost({definition,runtimeDirectory:directory,vaultBase:directory,redact:s=>s,tasks:f.api.createCodeWorkflowAdapter(directory)});
    await Promise.race([f.spawning,result]);assert.equal(f.spawns,1);
    f.child.emit('message',{type:'ready'});
    f.child.emit('message',succeeded?{type:'result',output:'confirmed'}:{type:'error',name:'TypeError',message:'fixture',text:'TypeError: fixture'});
    // A trailing disconnect must not overwrite an already observed result.
    f.child.disconnect();f.child.emit('close',0);
    const journal=await result;
    assert.equal(journal.phase,succeeded?'completed':'failed');
    assert.equal(f.api.checkpointUncertainties(journal).length,0);
    assert.match(journal.steps[0].output,succeeded?/confirmed/:/TypeError: fixture/);
    assert.equal(f.effects,1);assert.equal(f.timers.size,0);
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});

test('recover failed publication after a completed Codex turn with exactly one pending Code dispatch',async()=>{
  const f=fixture(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-publication-'));
  const definition=f.api.prepareWorkflowDefinition({id:'w',steps:[{id:'implement',stepKind:'task',taskId:'t'},{id:'panel-after-implement',stepKind:'code',code:'output=input;',transitions:[{mode:'conditional',condition:'false',toStepId:'panel-after-implement'}]}]},[{id:'t',taskKind:'codex'}],{});
  let providerCalls=0,runId,received;
  const tasks={supports:()=>true,execute:async(_task,_prompt,_signal,record)=>{providerCalls++;await record('thread','turn');return {succeeded:true,output:'review ok'};}};
  const options={definition,runtimeDirectory:directory,vaultBase:directory,redact:s=>s,tasks};
  try {
    await assert.rejects(f.api.runCodeWorkflowHost({...options,onCheckpoint:async state=>{
      runId=state.runId;if(state.phase==='in_flight' && state.nextStepId==='panel-after-implement')throw Error('fixture publication');
    }}),/fixture publication/);
    const file=path.join(directory,runId+'.json'),original=fs.readFileSync(file),failed=JSON.parse(original);
    const decision={revision:failed.revision,journalHash:require('node:crypto').createHash('sha256').update(original).digest('hex'),definitionHash:definition.hash};
    const recover=patch=>f.api.runCodeWorkflowHost({...options,resumeRunId:runId,publicationRecovery:{...decision,...patch}});
    await assert.rejects(recover({journalHash:'0'.repeat(64)}));assert.deepEqual(fs.readFileSync(file),original);
    const send=f.child.send;f.child.send=(data,cb)=>{received=data.input;send(data,cb);};
    const result=recover({});await Promise.race([result,f.spawning]);f.child.emit('message',{type:'ready'});
    f.child.emit('message',{type:'result',output:'panel done'});f.child.emit('close',0);
    assert.equal((await result).phase,'completed');assert.equal(received,'review ok');
    await assert.rejects(recover({}));assert.equal(f.effects,1);assert.equal(providerCalls,1);
    assert.deepEqual(fs.readFileSync(path.join(directory,`publication-${runId}-${failed.revision}-${decision.journalHash}.snapshot`)),original);
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});
