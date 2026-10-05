const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

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
    assert.equal(resolveInstalledWorkflowLocation(root,selected).runtimeDirectory,path.join(selected,'runtime'));
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
