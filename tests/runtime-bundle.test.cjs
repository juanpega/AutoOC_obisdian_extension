const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

function publicHostFixture(t, instrument=false){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-public-preparation-'));
  const runtimeDirectory=path.join(root,'runtime');fs.mkdirSync(runtimeDirectory);
  t.after(()=>{
    assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));
    assert.match(path.basename(root),/^autooc-public-preparation-/);
    fs.rmSync(root,{recursive:true,force:true});
  });
  let api=require('../autooc-runtime.cjs');
  if(instrument){
    const bundle={exports:{}};
    require('node:vm').runInNewContext(fs.readFileSync(path.join(__dirname,'../autooc-runtime.cjs'),'utf8')+
      '\nmodule.exports={...module.exports,executionCoordinator,ExecutionAdmission,acquireExecutionLease};',
      {module:bundle,exports:bundle.exports,require,process,Buffer,console,AbortController,setTimeout,clearTimeout,setInterval,clearInterval});
    api=bundle.exports;
  }
  let effects=0;
  const definition=(concurrency='exclusive',workingDirectory=root)=>api.prepareWorkflowDefinition(
    {id:'preparation',concurrency,steps:[{id:'task',stepKind:'task',taskId:'task'}]},
    [{id:'task',workingDirectory,prompt:'fixture'}],{});
  const options={runtimeDirectory,vaultBase:root,redact:s=>s,tasks:{supports:()=>true,execute:async()=>{effects++;return {succeeded:true,output:'done'};}}};
  return {api,root,runtimeDirectory,definition,options,effects:()=>effects,
    run:(definitionValue=definition(),extra={})=>api.runCodeWorkflowHost({...options,definition:definitionValue,...extra})};
}

for(const scenario of ['invalid policy','missing directory'])test(`public host releases its lease after ${scenario} and permits a valid retry`,async t=>{
  const f=publicHostFixture(t);
  const invalid=scenario==='invalid policy'?f.definition('invalid'):f.definition('exclusive',path.join(f.root,'missing'));
  await assert.rejects(f.run(invalid),scenario==='invalid policy'?/Invalid concurrency policy/:/ENOENT/);
  assert.equal(f.effects(),0);assert.deepEqual(fs.readdirSync(f.runtimeDirectory),[]);
  assert.equal((await f.run()).phase,'completed');assert.equal(f.effects(),1);
  assert.equal(fs.existsSync(path.join(f.runtimeDirectory,'execution.lock')),false);
});

test('public host finishes its provisional admission after validation fails while retaining an external lease and another session',async t=>{
  const f=publicHostFixture(t,true),lease=f.api.acquireExecutionLease(f.runtimeDirectory);
  const coordinator=f.api.executionCoordinator(lease),definition=f.definition('independent');
  const other=f.api.prepareWorkflowDefinition({id:'other',concurrency:'independent',steps:[{id:'code',stepKind:'code',code:'output="other";'}]},[],{});
  const foreign=coordinator.admit(other,f.root),owner=fs.readFileSync(path.join(f.runtimeDirectory,'execution.lock/owner.json'));
  const original=f.api.ExecutionAdmission.prototype.assertOwned;
  f.api.ExecutionAdmission.prototype.assertOwned=function(...args){
    original.apply(this,args);if(this.definition.workflow.id==='preparation')throw Error('post-admission validation fixture');
  };
  try {
    await assert.rejects(f.run(definition,{lease}),/post-admission validation fixture/);
    assert.equal(f.effects(),0);assert.deepEqual(fs.readdirSync(f.runtimeDirectory),['execution.lock']);
    lease.assertOwned();assert.deepEqual(fs.readFileSync(path.join(f.runtimeDirectory,'execution.lock/owner.json')),owner);
    foreign.assertOwned(lease,other);
    f.api.ExecutionAdmission.prototype.assertOwned=original;
    assert.equal((await f.run(definition,{lease})).phase,'completed');assert.equal(f.effects(),1);
    foreign.assertOwned(lease,other);
  } finally {f.api.ExecutionAdmission.prototype.assertOwned=original;foreign.finish();lease.release();}
});

test('public host leaves consumer admission and lease under consumer control on preparation failure',async t=>{
  const f=publicHostFixture(t,true),lease=f.api.acquireExecutionLease(f.runtimeDirectory),definition=f.definition();
  const admission=f.api.executionCoordinator(lease).admit(definition,f.root);
  const owner=fs.readFileSync(path.join(f.runtimeDirectory,'execution.lock/owner.json'));
  const original=admission.assertOwned;admission.assertOwned=()=>{throw Error('external validation fixture');};
  try {
    await assert.rejects(f.run(definition,{lease,admission}),/external validation fixture/);
    assert.equal(admission.advancing,true);assert.equal(f.effects(),0);
    assert.deepEqual(fs.readdirSync(f.runtimeDirectory),['execution.lock']);
    assert.deepEqual(fs.readFileSync(path.join(f.runtimeDirectory,'execution.lock/owner.json')),owner);
    admission.assertOwned=original;admission.assertOwned(lease,definition);
    assert.equal((await f.run(definition,{lease,admission})).phase,'completed');
    assert.equal(admission.advancing,true);lease.assertOwned();
  } finally {admission.assertOwned=original;admission.finish();lease.release();}
});

test('public host attempts own lease release when admission finish fails and retains both diagnostics',async t=>{
  const f=publicHostFixture(t,true),prototype=f.api.ExecutionAdmission.prototype;
  const validate=prototype.assertOwned,finish=prototype.finish;
  prototype.assertOwned=function(...args){validate.apply(this,args);throw Error('preparation fixture');};
  prototype.finish=function(){finish.call(this);throw Error('finish fixture');};
  try {
    await assert.rejects(f.run(),error=>{
      assert.match(error.message,/preparation fixture/);assert.match(error.message,/finish fixture/);
      assert.match(error.cause.message,/preparation fixture/);assert.equal(error.errors.length,2);return true;
    });
    assert.equal(f.effects(),0);assert.deepEqual(fs.readdirSync(f.runtimeDirectory),[]);
  } finally {prototype.assertOwned=validate;prototype.finish=finish;}
  assert.equal((await f.run()).phase,'completed');
});

test('public host refuses to release a substituted lease owner and preserves the preparation error',async t=>{
  const f=publicHostFixture(t,true),prototype=f.api.ExecutionAdmission.prototype,validate=prototype.assertOwned;
  let replacement;
  prototype.assertOwned=function(...args){
    validate.apply(this,args);
    const file=path.join(f.runtimeDirectory,'execution.lock/owner.json');
    const owner=JSON.parse(fs.readFileSync(file));owner.token=require('node:crypto').randomUUID();
    replacement=JSON.stringify(owner);fs.writeFileSync(file,replacement);throw Error('preparation fixture');
  };
  try {
    await assert.rejects(f.run(),error=>{
      assert.match(error.message,/preparation fixture/);assert.match(error.message,/ownership changed/);return true;
    });
    assert.equal(fs.readFileSync(path.join(f.runtimeDirectory,'execution.lock/owner.json'),'utf8'),replacement);
    assert.equal(f.effects(),0);assert.deepEqual(fs.readdirSync(f.runtimeDirectory),['execution.lock']);
  } finally {prototype.assertOwned=validate;}
});

test('public host preserves uncertain durable evidence and blocks a fresh call after releasing its own lease',async t=>{
  const f=publicHostFixture(t);
  const definition=f.api.prepareWorkflowDefinition({id:'uncertain',steps:[
    {id:'effect',stepKind:'code',codeAllowVault:true,code:'vault.append("effects.txt","once");output="done";',transitions:[{mode:'eval',toStepId:'last'}]},
    {id:'last',stepKind:'code',code:'output="last";'}]},[],{});
  await assert.rejects(f.run(definition,{evaluate:async()=>{throw Error('evaluation uncertain fixture');}}),/evaluation uncertain fixture/);
  const files=fs.readdirSync(f.runtimeDirectory);assert.equal(files.length,1);assert.match(files[0],/\.json$/);
  const journal=path.join(f.runtimeDirectory,files[0]),before=fs.readFileSync(journal);
  await assert.rejects(f.run(),/continuation or reconciliation/);
  assert.deepEqual(fs.readFileSync(journal),before);assert.deepEqual(fs.readdirSync(f.runtimeDirectory),files);
  assert.equal(fs.readFileSync(path.join(f.root,'effects.txt'),'utf8'),'once');assert.equal(f.effects(),0);
});

function pluginClass(){
  const Module=require('node:module'), original=Module._load;
  let Plugin;
  try {
    Module._load=function(name,...args){
      if(name==='obsidian')return Object.fromEntries(['Plugin','Notice','Modal','Setting','ItemView','PluginSettingTab','WorkspaceLeaf'].map(key=>[key,class {}]));
      return original.call(this,name,...args);
    };
    Plugin=require('../main.js').default;
  } finally {Module._load=original;}
  return Plugin;
}

test('plugin resumes a durable Code result after Stop without replaying effects',async()=>{
  const Plugin=pluginClass();
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-durable-stop-'));
  const install=path.join(root,'.obsidian/plugins/auto-oc');fs.mkdirSync(install,{recursive:true});
  fs.writeFileSync(path.join(install,'data.json'),JSON.stringify({tasks:[],workflows:[{id:'recover',name:'Recover',steps:[
    {id:'first',stepKind:'code',codeAllowVault:true,code:'vault.append("effects.txt","once"); output="first";'},
    {id:'last',stepKind:'code',code:'output=input+" last";'}
  ]}]}));
  const p=new Plugin();p.app={vault:{adapter:{basePath:root},configDir:'.obsidian'},workspace:{getLeavesOfType:()=>[]}};p.manifest={id:'auto-oc'};
  try {
    p.reservePluginExecution();await p.loadSettings();
    // Stop after the real Code effect, before the host records its result and transitions.
    p.createVaultMutationBatch=()=>({record:()=>{},flush:async()=>{p.sharedWorkflowExecution.controller.abort();}});
    const partial=await p.runSharedWorkflow('recover');
    assert.equal(partial.phase,'in_flight');assert.deepEqual(partial.steps[0].result,{succeeded:true,output:'first'});
    assert.equal(partial.steps.length,1);
    p.createVaultMutationBatch=()=>({record:()=>{},flush:async()=>{}});
    assert.equal(p.sharedWorkflowRecoveryMode('recover',partial.runId),'resume');
    const result=await p.recoverSharedWorkflow('recover',partial.runId);
    assert.equal(result.phase,'completed');assert.equal(result.runId,partial.runId);
    assert.equal(result.steps.length,2);assert.equal(result.steps[1].output,'first last');
    assert.equal(fs.readFileSync(path.join(root,'effects.txt'),'utf8'),'once');
    assert.deepEqual(result.steps[0].result,partial.steps[0].result);
  } finally {
    p.releasePluginExecution(false);
    assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('autooc-durable-stop-'));
    fs.rmSync(root,{recursive:true});
  }
});

test('plugin blocks uncertain evaluation even with a durable Code result',async()=>{
  const {prepareWorkflowDefinition,runCodeWorkflowHost,persistWorkflowProgress}=require('../autooc-runtime.cjs');
  const Plugin=pluginClass(),p=new Plugin(),root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-uncertain-eval-'));
  const install=path.join(root,'.obsidian/plugins/auto-oc'),runtime=path.join(install,'runtime'),file=path.join(install,'data.json');
  fs.mkdirSync(runtime,{recursive:true});
  const workflow={id:'eval',name:'Eval',steps:[{id:'first',stepKind:'code',codeAllowVault:true,code:'vault.append("effects.txt","once");output="observed";',transitions:[{mode:'eval',toStepId:'last'}]},{id:'last',stepKind:'code',code:'output="last";'}]};
  const config={tasks:[],workflows:[workflow]};fs.writeFileSync(file,JSON.stringify(config));
  p.app={vault:{adapter:{basePath:root},configDir:'.obsidian'},workspace:{getLeavesOfType:()=>[]}};p.manifest={id:'auto-oc'};
  let checkpoint;
  try {
    await assert.rejects(runCodeWorkflowHost({definition:prepareWorkflowDefinition(workflow,[],config),runtimeDirectory:runtime,vaultBase:root,redact:s=>s,
      evaluate:async()=>{throw Error('evaluation transport lost');},onCheckpoint:async state=>{
        checkpoint=state;await persistWorkflowProgress({configurationFile:file,runtimeDirectory:runtime,checkpoint:state,expectedRunId:state.runId});
      }}),/evaluation transport lost/);
    p.reservePluginExecution();await p.loadSettings();
    const journal=path.join(runtime,checkpoint.runId+'.json'),before=fs.readFileSync(journal);
    assert.equal(p.sharedWorkflowRecoveryMode('eval',checkpoint.runId),'blocked');
    await assert.rejects(p.recoverSharedWorkflow('eval',checkpoint.runId),/evaluation.*reconciliation/);
    assert.deepEqual(fs.readFileSync(journal),before);assert.equal(fs.readFileSync(path.join(root,'effects.txt'),'utf8'),'once');
  } finally {
    p.releasePluginExecution(false);
    assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('autooc-uncertain-eval-'));
    fs.rmSync(root,{recursive:true});
  }
});

test('runtime bundle accepts an explicit installation and retains the default without discovery',async()=>{
  const {runInstalledWorkflow,resolveInstalledWorkflowLocation}=require('../autooc-runtime.cjs');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-bundle-selection-'));
  try {
    const selected=path.join(root,'custom/plugins/custom-plugin'),normal=path.join(root,'.obsidian/plugins/auto-oc');
    const install=(dir,output)=>{fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'data.json'),JSON.stringify({tasks:[],workflows:[{id:'w',steps:[{id:'a',stepKind:'code',code:`output="${output}";`}]}]}));};
    install(selected,'selected');
    const options={vault:root,workflowId:'w',redact:s=>s};
    await assert.rejects(runInstalledWorkflow(options),/ENOENT/);
    const first=await runInstalledWorkflow({...options,installationDirectory:selected});assert.equal(first.steps[0].output,'selected');
    assert.equal(fs.existsSync(path.join(root,'.obsidian')),false);
    install(normal,'default');
    const second=await runInstalledWorkflow(options);assert.equal(second.steps[0].output,'default');
    const previous=fs.readFileSync(path.join(normal,'data.json'));
    assert.equal((await runInstalledWorkflow({...options,installationDirectory:selected,resumeRunId:first.runId})).runId,first.runId);
    assert.deepEqual(fs.readFileSync(path.join(normal,'data.json')),previous);
    const physicalSelected=process.platform==='win32'?fs.realpathSync.native(selected):fs.realpathSync(selected);
    assert.equal(resolveInstalledWorkflowLocation(root,selected).runtimeDirectory,path.join(physicalSelected,'runtime'));
    await assert.rejects(runInstalledWorkflow({...options,installationDirectory:'absent'}),/ENOENT/);
  } finally {
    assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('autooc-bundle-selection-'));fs.rmSync(root,{recursive:true});
  }
});

test('standalone runtime bundle executes and resumes real Code workflow across processes',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-runtime-real-'));
  try {
    fs.mkdirSync(path.join(root,'runs'));
    fs.copyFileSync(path.resolve(__dirname,'../autooc-runtime.cjs'),path.join(root,'autooc-runtime.cjs'));
    const driver=path.join(root,'driver.cjs');
    fs.writeFileSync(driver,`
      const fs=require('node:fs'),path=require('node:path');
      const {prepareWorkflowDefinition,runCodeWorkflowHost,createWorkflowTaskAdapter}=require('./autooc-runtime.cjs');
      const root=__dirname;
      const definition=prepareWorkflowDefinition({id:'fixture',steps:[
        {id:'prepare',stepKind:'code',codeAllowVault:true,code:'vault.append("effects.txt","once\\\\n"); output="x".repeat(24000);'},
        {id:'task',stepKind:'task',taskId:'task-code'},
        {id:'verify',stepKind:'code',codeAllowVault:true,code:'if(outputs.prepare.length!==24000 || !input.endsWith("task complete"))throw Error("lost context"); vault.write("result.md", "Verified "+outputs.prepare.length); output="verified";'}
      ]},[{id:'task-code',taskKind:'code',codeAllowVault:true,code:'vault.append("task-effects.txt","once"); console.log("task observation"); output="task complete";'}],{});
      const resume=process.argv[2];
      runCodeWorkflowHost({definition,runtimeDirectory:path.join(root,'runs'),vaultBase:root,
        maxSteps:resume?undefined:1,resumeRunId:resume,redact:x=>x,tasks:createWorkflowTaskAdapter(definition,root)
      }).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1;});
    `);
    const call=(...args)=>{
      const r=spawnSync(process.execPath,[driver,...args],{cwd:root,encoding:'utf8',timeout:30000});
      assert.equal(r.status,0,r.stderr);
      return JSON.parse(r.stdout);
    };
    const first=call();
    assert.equal(first.phase,'ready');assert.equal(first.nextStepId,'task');
    const effects=fs.readFileSync(path.join(root,'effects.txt'),'utf8');
    assert.ok(!fs.existsSync(path.join(root,'result.md')));
    const second=call(first.runId);
    assert.equal(second.phase,'completed');assert.equal(second.runId,first.runId);
    assert.equal(second.steps.length,3);assert.equal(second.steps[0].output.length,24000);
    assert.ok(second.steps[1].output.includes('task observation'));
    assert.equal(fs.readFileSync(path.join(root,'result.md'),'utf8'),'Verified 24000');
    const third=call(first.runId);
    assert.deepEqual(third,second);
    assert.equal(fs.readFileSync(path.join(root,'effects.txt'),'utf8'),effects);
    assert.equal(fs.readFileSync(path.join(root,'task-effects.txt'),'utf8'),'once');
    assert.ok(!fs.existsSync(path.join(root,'runs/execution.lock')));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'runs',first.runId+'.json'),'utf8')),second);
  } finally {
    // This test owns only the exact temporary directory returned above.
    assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('autooc-runtime-real-'));
    fs.rmSync(root,{recursive:true});
  }
});

test('durable progress updates the current catalog and preserves unrelated edits across resume',async()=>{
  const {prepareWorkflowDefinition,runCodeWorkflowHost,persistWorkflowProgress}=require('../autooc-runtime.cjs');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-catalog-')),runtime=path.join(root,'runtime'),file=path.join(root,'data.json');
  fs.mkdirSync(runtime);
  try {
    const workflow={id:'catalog',name:'Keep name',handoffOutput:false,steps:[{id:'a',stepKind:'code',code:'output="first";'},{id:'b',stepKind:'code',codeAllowVault:true,code:'vault.write("effect.txt","once"); output="second";'}]};
    const config={tasks:[],workflows:[workflow,{id:'other',name:'Unrelated',steps:[]}],custom:'initial'};
    fs.writeFileSync(file,JSON.stringify(config));
    const definition=prepareWorkflowDefinition(workflow,[],config);
    const observe=checkpoint=>persistWorkflowProgress({configurationFile:file,runtimeDirectory:runtime,checkpoint,expectedRunId:checkpoint.runId});
    const options={definition,runtimeDirectory:runtime,vaultBase:root,redact:s=>s,onCheckpoint:observe};
    const first=await runCodeWorkflowHost({...options,maxSteps:1});
    let current=JSON.parse(fs.readFileSync(file,'utf8'));
    assert.equal(current.workflows[0].runtimeExecution.runId,first.runId);
    assert.equal(current.workflows[0].steps[0].output,'first');assert.equal(current.workflows[0].status,'pending');
    current.custom='external preserved';current.workflows[1].name='Edited other workflow';
    fs.writeFileSync(file,JSON.stringify(current));
    const final=await runCodeWorkflowHost({...options,resumeRunId:first.runId});
    current=JSON.parse(fs.readFileSync(file,'utf8'));
    assert.equal(current.custom,'external preserved');assert.equal(current.workflows[1].name,'Edited other workflow');
    assert.equal(current.workflows[0].status,'completed');assert.equal(current.workflows[0].steps[1].output,'second');
    assert.equal(current.workflows[0].handoffOutput,false);assert.equal(fs.readFileSync(path.join(root,'effect.txt'),'utf8'),'once');
    const before=fs.readFileSync(file,'utf8');
    await assert.rejects(observe({...final,revision:final.revision+1}),/durable checkpoint/);
    assert.equal(fs.readFileSync(file,'utf8'),before);
    current.workflows[0].steps[0].code='output="edited";';fs.writeFileSync(file,JSON.stringify(current));
    await assert.rejects(observe(final),/definition mismatch/);
    assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).workflows[0].steps[0].code,'output="edited";');
  } finally {
    for(const entry of fs.readdirSync(runtime)){assert.match(entry,/^[a-f0-9-]+\.json$/);fs.unlinkSync(path.join(runtime,entry));}
    fs.rmdirSync(runtime);fs.unlinkSync(file);if(fs.existsSync(path.join(root,'effect.txt')))fs.unlinkSync(path.join(root,'effect.txt'));fs.rmdirSync(root);
  }
});

test('installed catalog host persists results, excludes another caller and resumes the selected run',async()=>{
  const {runInstalledWorkflow}=require('../autooc-runtime.cjs');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-installed-'));
  const install=path.join(root,'.obsidian','plugins','auto-oc'),file=path.join(install,'data.json');
  fs.mkdirSync(install,{recursive:true});
  try {
    const workflow={id:'installed',name:'Installed',steps:[{id:'first',stepKind:'code',codeAllowVault:true,code:'vault.append("effects.txt","one"); output="first";'},{id:'second',stepKind:'code',code:'output=input+" second";'}]};
    fs.writeFileSync(file,JSON.stringify({tasks:[],workflows:[workflow]}));
    const options={vault:root,workflowId:workflow.id,redact:s=>s};
    const pending=runInstalledWorkflow({...options,maxSteps:1});
    await assert.rejects(runInstalledWorkflow(options),{code:'EEXIST'});
    const first=await pending;
    assert.equal(first.phase,'ready');
    await assert.rejects(runInstalledWorkflow(options),/bound execution/);
    await assert.rejects(runInstalledWorkflow({...options,newExecution:true}),/unfinished execution/);
    await assert.rejects(runInstalledWorkflow({...options,newExecution:true,resumeRunId:first.runId}),/cannot also resume/);
    const completed=await runInstalledWorkflow({...options,resumeRunId:first.runId});
    assert.equal(completed.phase,'completed');assert.equal(completed.steps[1].output,'first second');
    let config=JSON.parse(fs.readFileSync(file,'utf8'));
    assert.equal(config.workflows[0].runtimeExecution.runId,first.runId);assert.equal(config.workflows[0].status,'completed');
    await runInstalledWorkflow({...options,resumeRunId:first.runId});
    assert.equal(fs.readFileSync(path.join(root,'effects.txt'),'utf8'),'one');
    const previousFile=path.join(install,'runtime',first.runId+'.json');
    const previousEvidence=fs.readFileSync(previousFile,'utf8');
    const next=await runInstalledWorkflow({...options,newExecution:true});
    assert.notEqual(next.runId,first.runId);assert.equal(next.phase,'completed');
    assert.equal(fs.readFileSync(path.join(root,'effects.txt'),'utf8'),'oneone');
    assert.equal(fs.readFileSync(previousFile,'utf8'),previousEvidence);
    config=JSON.parse(fs.readFileSync(file,'utf8'));
    assert.equal(config.workflows[0].runtimeExecution.runId,next.runId);
    config.tasks.push({id:'external',status:'running'});fs.writeFileSync(file,JSON.stringify(config));
    await assert.rejects(runInstalledWorkflow({...options,resumeRunId:first.runId}),/unresolved running/);
  } finally {
    const runtime=path.join(install,'runtime');
    for(const entry of fs.readdirSync(runtime)){assert.match(entry,/^[a-f0-9-]+\.json$/);fs.unlinkSync(path.join(runtime,entry));}
    fs.rmdirSync(runtime);fs.unlinkSync(file);fs.rmdirSync(install);fs.rmdirSync(path.dirname(install));fs.rmdirSync(path.join(root,'.obsidian'));
    if(fs.existsSync(path.join(root,'effects.txt')))fs.unlinkSync(path.join(root,'effects.txt'));fs.rmdirSync(root);
  }
});

test('stop request interrupts an installed delay without executing the following step',async()=>{
  const {runInstalledWorkflow,requestWorkflowStop}=require('../autooc-runtime.cjs');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-stop-')),install=path.join(root,'.obsidian','plugins','auto-oc'),runtime=path.join(install,'runtime');
  fs.mkdirSync(install,{recursive:true});
  fs.writeFileSync(path.join(install,'data.json'),JSON.stringify({tasks:[],workflows:[{id:'stop',name:'Stop fixture',steps:[{id:'delay',stepKind:'delay',delayValue:30,delayUnit:'seconds'},{id:'effect',stepKind:'code',codeAllowVault:true,code:'vault.write("unexpected.txt","bad");'}]}]}));
  let runId;
  try {
    const stoppedRun=await runInstalledWorkflow({vault:root,workflowId:'stop',redact:s=>s,onCheckpoint:async state=>{
      runId=state.runId;
      if(state.phase==='in_flight') {
        const stopped=spawnSync(process.execPath,[path.resolve(__dirname,'../autooc-cli.cjs'),'stop','--vault',root,'--workflow','stop','--run',runId],{encoding:'utf8',timeout:10000});
        assert.equal(stopped.status,0,stopped.stderr);assert.equal(JSON.parse(stopped.stdout).requested,true);
      }
    }});
    assert.equal(stoppedRun.phase,'failed');
    const state=JSON.parse(fs.readFileSync(path.join(runtime,runId+'.json'),'utf8'));
    assert.equal(state.phase,'failed');assert.equal(state.nextStepId,null);assert.match(state.steps[0].output,/cancelled/);
    assert.ok(!fs.existsSync(path.join(root,'unexpected.txt')));assert.ok(!fs.existsSync(path.join(runtime,'execution.lock')));
    assert.equal((await runInstalledWorkflow({vault:root,workflowId:'stop',resumeRunId:runId,redact:s=>s})).phase,'failed');
    assert.equal((await requestWorkflowStop(runtime,runId)).requested,false);
  } finally {
    for(const entry of fs.readdirSync(runtime)){assert.match(entry,/^[a-f0-9-]+(\.stop)?\.json$/);fs.unlinkSync(path.join(runtime,entry));}
    fs.rmdirSync(runtime);fs.unlinkSync(path.join(install,'data.json'));fs.rmdirSync(install);fs.rmdirSync(path.dirname(install));fs.rmdirSync(path.join(root,'.obsidian'));fs.rmdirSync(root);
  }
});

test('task cards reflect observed results and old workflow recovery cannot overwrite a later task run',async()=>{
  const {runInstalledWorkflow}=require('../autooc-runtime.cjs');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-task-card-')),install=path.join(root,'.obsidian','plugins','auto-oc'),file=path.join(install,'data.json');
  fs.mkdirSync(install,{recursive:true});
  const task={id:'shared-task',name:'Preserve task',taskKind:'code',code:'output="task result";',model:'chosen-model',reasoningEffort:'high'};
  const other={id:'untouched',name:'Untouched',status:'completed',output:'earlier'};
  const workflow=id=>({id,name:id,steps:[{id:'task-step',stepKind:'task',taskId:task.id}]});
  fs.writeFileSync(file,JSON.stringify({tasks:[task,other],workflows:[workflow('a'),workflow('b')]}));
  try {
    const opts={vault:root,redact:s=>s};
    const a=await runInstalledWorkflow({...opts,workflowId:'a'});
    let cfg=JSON.parse(fs.readFileSync(file,'utf8'));
    assert.equal(cfg.tasks[0].status,'completed');assert.ok(cfg.tasks[0].output.endsWith('task result'));
    assert.equal(cfg.tasks[0].model,'chosen-model');assert.equal(cfg.tasks[0].reasoningEffort,'high');assert.equal(cfg.tasks[0].code,task.code);
    assert.equal(cfg.tasks[0].runtimeExecution.runId,a.runId);assert.deepEqual(cfg.tasks[1],other);
    const b=await runInstalledWorkflow({...opts,workflowId:'b'});
    cfg=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(cfg.tasks[0].runtimeExecution.runId,b.runId);
    const latestTask=JSON.stringify(cfg.tasks[0]);
    await runInstalledWorkflow({...opts,workflowId:'a',resumeRunId:a.runId});
    cfg=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(JSON.stringify(cfg.tasks[0]),latestTask);
  } finally {
    assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('autooc-task-card-'));
    fs.rmSync(root,{recursive:true});
  }
});
