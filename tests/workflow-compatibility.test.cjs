const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const {execFileSync}=require('node:child_process');
function loader(overrides={}) {
  const cache=new Map();
  function load(name) {
    if(overrides[name])return overrides[name];
    if(cache.has(name))return cache.get(name).exports;
    const file=path.resolve(__dirname,'../'+name+'.ts'),m=new Module(file,module);
    m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));cache.set(name,m);
    const original=m.require.bind(m);m.require=id=>id.startsWith('./')?load(id.slice(2)):original(id);
    m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
    return m.exports;
  }
  return load;
}
const load=loader(),{prepareWorkflowDefinition:prepare}=load('workflow-definition'),{runCodeWorkflowHost:run}=load('code-workflow-host');
test('dirty branch switch is rejected before a run is created, while current-branch support remains allowed',()=>fixture(async root=>{
  const git=(...args)=>execFileSync('git',['-c',`safe.directory=${root}`,...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git('init','-b','work');fs.writeFileSync(path.join(root,'tracked.txt'),'original');git('add','tracked.txt');
  git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','fixture');git('checkout','-b','dev');
  fs.writeFileSync(path.join(root,'tracked.txt'),'different branch');git('add','tracked.txt');
  git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','other branch');git('checkout','work');
  fs.writeFileSync(path.join(root,'tracked.txt'),'unsaved changes');
  const directory=path.join(root,'.obsidian/plugins/auto-oc'),runtime=path.join(directory,'runtime');fs.mkdirSync(runtime,{recursive:true});
  const task={id:'buddy',name:'Buddy',taskKind:'opencode',interactiveTerminal:true,prompt:'Support',model:'test/model',branch:'dev'};
  fs.writeFileSync(path.join(directory,'data.json'),JSON.stringify({tasks:[task],workflows:[],opencodePath:path.join(root,'must-not-launch-missing.exe')}));
  const {runInstalledWorkflow}=load('installed-workflow-host');
  await assert.rejects(runInstalledWorkflow({vault:root,taskId:'buddy',newExecution:true,redact:s=>s}),/Git Branch.*uncommitted changes/);
  assert.deepEqual(fs.readdirSync(runtime),[],'no journal, no stuck execution');
  assert.equal(git('branch','--show-current'),'work');assert.equal(fs.readFileSync(path.join(root,'tracked.txt'),'utf8'),'unsaved changes');
  const {preflightInstalledWorkflow}=load('workflow-preflight');
  for(const branch of ['work',undefined]) {
    const definition=prepare({id:'@task:buddy',steps:[{id:'task',taskId:'buddy'}]},[{...task,branch}],{});
    assert.doesNotThrow(()=>preflightInstalledWorkflow(definition,root));
  }
  git('restore','tracked.txt');git('rm','tracked.txt');
  git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','remove only in fixture work branch');
  fs.writeFileSync(path.join(root,'tracked.txt'),'untracked content must survive');
  await assert.rejects(runInstalledWorkflow({vault:root,taskId:'buddy',newExecution:true,redact:s=>s}),/Git Branch.*uncommitted changes/);
  assert.deepEqual(fs.readdirSync(runtime),[]);
  assert.equal(fs.readFileSync(path.join(root,'tracked.txt'),'utf8'),'untracked content must survive');
}));
// Ask Windows for the actual alias; never manufacture a name or use a link.
function shortWindowsPath(directory) {
  assert.equal(process.platform,'win32');
  assert.doesNotMatch(directory,/["%\r\n&|<>^!]/);
  const short=execFileSync('cmd.exe',['/d','/c','for %I in (.) do @echo %~fsI'],{cwd:directory,encoding:'utf8',windowsHide:true}).trim();
  assert.notEqual(short,directory,'Windows fixture volume must supply real 8.3 aliases');
  assert.equal(fs.realpathSync.native(short),fs.realpathSync.native(directory));
  return short;
}
test('Windows 8.3 branch preflight accepts mixed physical identities', {skip:process.platform!=='win32'},()=>fixture(async temporary=>{
  const root=path.join(temporary,'Vault with long name');fs.mkdirSync(root);
  const child=path.join(root,'Working directory');fs.mkdirSync(child);
  const git=(...args)=>execFileSync('git',['-c',`safe.directory=${root}`,...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git('init');
  const short=shortWindowsPath(root),shortChild=shortWindowsPath(child);
  const {branchRepository}=load('workflow-branch'),{preflightInstalledWorkflow}=load('workflow-preflight');
  for(const vault of [root,short]) for(const cwd of [child,shortChild]) {
    assert.equal(branchRepository(cwd,vault),fs.realpathSync.native(root));
    const definition=prepare({id:'w',handoffBranch:true,steps:[{id:'a',taskId:'t'}]},[{id:'t',taskKind:'code',branch:'feature',code:'output=1'}],{workingDirectory:cwd});
    assert.doesNotThrow(()=>preflightInstalledWorkflow(definition,vault));
  }
}));
function pluginFor(root, configDir='.obsidian', pluginId='auto-oc') {
  const original=Module._load;
  try {
    Module._load=function(id,...args){if(id==='obsidian')return {Plugin:class{},Notice:class{},Modal:class{},Setting:class{},ItemView:class{},PluginSettingTab:class{},WorkspaceLeaf:class{}};return original.call(this,id,...args);};
    const Plugin=require('../main.js').default,plugin=new Plugin();
    plugin.app={vault:{adapter:{basePath:root},configDir}};plugin.manifest={id:pluginId};
    plugin.app.workspace={getLeavesOfType:()=>[]};
    return plugin;
  } finally {Module._load=original;}
}
test('Windows 8.3 installation identity preserves link and lease restrictions', {skip:process.platform!=='win32'},()=>fixture(async root=>{
  const selected=path.join(root,'Selected long directory/plugins/auto-oc');fs.mkdirSync(selected,{recursive:true});
  const short=shortWindowsPath(root),shortSelected=shortWindowsPath(selected);
  const {resolveInstalledWorkflowLocation:resolve,ensureInstalledWorkflowRuntime:ensure}=load('installed-workflow-location');
  const expected=resolve(root,'Selected long directory/plugins/auto-oc');
  for(const vault of [root,short]) for(const installation of [selected,shortSelected]) assert.deepEqual(resolve(vault,installation),expected);
  ensure(expected);
  const {acquireExecutionLease:acquire}=load('execution-lease');
  const lease=acquire(path.join(shortSelected,'runtime'));
  try {
    assert.throws(()=>acquire(expected.runtimeDirectory),/EEXIST/);
    const definition=prepare({id:'w',steps:[{id:'a',stepKind:'code',code:'output=1'}]},[],{});
    const result=await run({definition,runtimeDirectory:expected.runtimeDirectory,vaultBase:root,lease,redact:s=>s});
    assert.equal(result.phase,'completed');lease.assertOwned();
  } finally {lease.release();}
  const link=path.join(root,'linked');fs.symlinkSync(selected,link,'junction');
  for(const vault of [root,short]) assert.throws(()=>resolve(vault,link),/regular directories/);
}));
function branchFixture(root, gate=false) {
  const git=(...args)=>execFileSync('git',['-c',`safe.directory=${root}`,...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git('init');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-m','fixture');
  git('branch','existing');
  const installation=path.join(root,'.obsidian/plugins/auto-oc');fs.mkdirSync(installation,{recursive:true});
  const code='vault.append("effects.txt","A");'+(gate?'const deadline=Date.now()+20000; while(!vault.exists("release.txt")){if(Date.now()>deadline)throw Error("fixture gate timed out");}':'')+'output="first";';
  const tasks=[{id:'t',name:'Task',taskKind:'code',branch:'feature',createBranch:true,codeAllowVault:true,code}];
  const workflows=[{id:'w',name:'Workflow',handoffBranch:true,steps:[{id:'a',taskId:'t'},{id:'b',stepKind:'code',codeAllowVault:true,code:'vault.append("effects.txt","B");output=input;'}]}];
  const file=path.join(installation,'data.json');fs.writeFileSync(file,JSON.stringify({tasks,workflows}));
  return {git,file,installation,runtime:path.join(installation,'runtime'),tasks,workflows};
}
test('Windows 8.3 host and runtime bundle resume all alias directions without replay', {skip:process.platform!=='win32'},async t=>{
  for(const bundled of [false,true]) for(const [startShort,endShort] of [[false,false],[true,true],[false,true],[true,false]]) {
    await t.test(`${bundled?'bundle':'source'} ${startShort}->${endShort}`,()=>fixture(async root=>{
      const data=branchFixture(root),short=shortWindowsPath(root),start=startShort?short:root,end=endShort?short:root;
      const host=(bundled?require('../autooc-runtime.cjs'):load('installed-workflow-host')).runInstalledWorkflow;
      const options={workflowId:'w',installationDirectory:data.installation,redact:s=>s};
      const first=await host({...options,vault:start,maxSteps:1});
      assert.equal(first.phase,'ready');assert.equal(fs.readFileSync(path.join(root,'effects.txt'),'utf8'),'A');
      const branch=data.git('branch','--show-current');assert.match(branch,/^feature-/);
      const final=await host({...options,vault:end,resumeRunId:first.runId});
      assert.equal(final.phase,'completed');assert.equal(final.runId,first.runId);assert.equal(final.definitionHash,first.definitionHash);
      assert.deepEqual(final.steps[0],first.steps[0]);assert.equal(data.git('branch','--show-current'),branch);
      assert.deepEqual(await host({...options,vault:start,resumeRunId:first.runId}),final);
      assert.equal(fs.readFileSync(path.join(root,'effects.txt'),'utf8'),'AB');
    }));
  }
});
test('Windows 8.3 historical branch spelling is compared physically without rewriting history', {skip:process.platform!=='win32'},()=>fixture(async root=>{
  const data=branchFixture(root),short=shortWindowsPath(root),record={directory:short,name:data.git('branch','--show-current')};
  const original=structuredClone(record),saved=[];
  const journal={snapshot:()=>({steps:[{branch:record}]}),recordBranch:async branch=>saved.push(branch)};
  const {prepareTaskBranch,verifyWorkflowBranch}=load('workflow-branch');
  verifyWorkflowBranch(journal,root);
  await prepareTaskBranch(journal,{branch:'must-not-be-created',createBranch:true},root,short,true);
  assert.deepEqual(record,original);assert.equal(saved.length,1);assert.equal(saved[0].name,record.name);
  assert.equal(saved[0].directory,fs.realpathSync.native(root));assert.doesNotMatch(data.git('branch','--list'),/must-not-be-created/);
}));
test('Windows 8.3 plugin retains its reservation when the selected vault spelling changes', {skip:process.platform!=='win32'},()=>fixture(async root=>{
  branchFixture(root);const short=shortWindowsPath(root),plugin=pluginFor(short);
  plugin.app.vault.adapter.queue=async job=>job();
  plugin.app.vault.adapter.reconcileInternalFile=async relative=>assert.equal(relative,'effects.txt');
  await plugin.loadSettings();plugin.reservePluginExecution();
  try {
    const first=await plugin.runSharedWorkflow('w');assert.equal(first.phase,'completed',JSON.stringify(first.steps));
    plugin.app.vault.adapter.basePath=root;
    const resumed=await plugin.runSharedWorkflow('w',first.runId);
    assert.equal(resumed.runId,first.runId);assert.equal(fs.readFileSync(path.join(root,'effects.txt'),'utf8'),'AB');
  } finally {plugin.releasePluginExecution(false);}
}));
test('Windows 8.3 public CLI stops and resumes across all alias directions', {skip:process.platform!=='win32'},async t=>{
  const {spawn,spawnSync}=require('node:child_process'),cli=path.resolve(__dirname,'../autooc-cli.cjs');
  const call=(...args)=>{
    const result=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:15000,windowsHide:true});
    assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
  };
  for(const [startShort,endShort] of [[false,false],[true,true],[false,true],[true,false]]) await t.test(`${startShort}->${endShort}`,()=>fixture(async root=>{
    const data=branchFixture(root,true),short=shortWindowsPath(root),start=startShort?short:root,end=endShort?short:root;
    const child=spawn(process.execPath,[cli,'run','--vault',start,'--workflow','w'],{windowsHide:true});
    let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
    const finished=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code));});
    try {
      const deadline=Date.now()+15000;
      while(!fs.existsSync(path.join(root,'effects.txt')) && child.exitCode===null && Date.now()<deadline) await new Promise(r=>setTimeout(r,20));
      assert.equal(fs.readFileSync(path.join(root,'effects.txt'),'utf8'),'A',stderr);
      const status=call('status','--vault',end),observed=status.executions[0];
      assert.equal(observed.phase,'in_flight');assert.equal(status.executionLockPresent,true);
      const stop=call('stop','--vault',end,'--workflow','w','--run',observed.runId);assert.equal(stop.requested,true);
      fs.writeFileSync(path.join(root,'release.txt'),'continue');
      assert.equal(await finished,0,stderr);
      const first=JSON.parse(stdout);assert.equal(first.runId,observed.runId);assert.equal(first.phase,'in_flight');
      const snapshot=JSON.parse(fs.readFileSync(path.join(data.runtime,first.runId+'.json')));
      assert.equal(snapshot.steps[0].result.succeeded,true);
      const branch=data.git('branch','--show-current');
      const final=call('resume','--vault',end,'--workflow','w','--run',first.runId);
      assert.equal(final.phase,'completed');assert.equal(final.runId,first.runId);
      const checkpoint=JSON.parse(fs.readFileSync(path.join(data.runtime,first.runId+'.json')));
      assert.equal(checkpoint.definitionHash,snapshot.definitionHash);assert.deepEqual(checkpoint.steps[0].branch,snapshot.steps[0].branch);
      assert.equal(data.git('branch','--show-current'),branch);
      assert.equal(call('resume','--vault',start,'--workflow','w','--run',first.runId).phase,'completed');
      assert.equal(fs.readFileSync(path.join(root,'effects.txt'),'utf8'),'AB');
    } finally {
      fs.writeFileSync(path.join(root,'release.txt'),'continue');await finished;
    }
  }));
  for(const createBranch of [false,true]) await t.test(`standalone task create=${createBranch}`,()=>fixture(async root=>{
    const data=branchFixture(root),short=shortWindowsPath(root),config=JSON.parse(fs.readFileSync(data.file));
    config.tasks[0].createBranch=createBranch;config.tasks[0].branch=createBranch?'feature':'existing';fs.writeFileSync(data.file,JSON.stringify(config));
    const first=call('run','--vault',short,'--task','t');assert.equal(first.phase,'completed');
    assert.equal(call('resume','--vault',root,'--task','t','--run',first.runId).runId,first.runId);
    assert.equal(fs.readFileSync(path.join(root,'effects.txt'),'utf8'),'A');
    assert.match(data.git('branch','--show-current'),createBranch?/^feature-/:/^existing$/);
  }));
});
test('branch rejection preserves ready and observed checkpoints for explicit recovery',async t=>{
  for(const observed of [false,true]) await t.test(observed?'observed result':'ready',()=>fixture(async root=>{
    const data=branchFixture(root),host=load('installed-workflow-host').runInstalledWorkflow,controller=new AbortController();
    const options={vault:root,workflowId:'w',redact:s=>s};
    const first=await host({...options,maxSteps:1,signal:controller.signal,
      vaultMutations:()=>({record:()=>{},flush:async()=>{if(observed)controller.abort();}})});
    assert.equal(first.phase,observed?'in_flight':'ready');
    const file=path.join(data.runtime,first.runId+'.json'),before=fs.readFileSync(file);
    const branch=data.git('branch','--show-current');data.git('branch','-m','changed');
    await assert.rejects(host({...options,resumeRunId:first.runId}),/branch changed/);
    assert.deepEqual(fs.readFileSync(file),before,'denied recovery must not mutate the journal');
    assert.equal(fs.readFileSync(path.join(root,'effects.txt'),'utf8'),'A');
    data.git('branch','-m',branch);
    const final=await host({...options,resumeRunId:first.runId});
    assert.equal(final.phase,'completed');assert.equal(final.runId,first.runId);
    assert.equal(fs.readFileSync(path.join(root,'effects.txt'),'utf8'),'AB');
  }));
});

test('branch continuity rejects changed branches and exterior recorded repositories before another effect',async t=>{
  for(const mode of ['branch','exterior','definition','uncertain']) await t.test(mode,()=>fixture(async root=>{
    const data=branchFixture(root),host=load('installed-workflow-host').runInstalledWorkflow;
    const first=await host({vault:root,workflowId:'w',maxSteps:1,redact:s=>s});
    const file=path.join(data.runtime,first.runId+'.json');
    if(mode==='branch')data.git('branch','-m','changed');
    if(mode==='exterior') {
      const state=JSON.parse(fs.readFileSync(file));state.steps[0].branch.directory=path.dirname(root);fs.writeFileSync(file,JSON.stringify(state));
    }
    if(mode==='definition') {
      const config=JSON.parse(fs.readFileSync(data.file));config.tasks[0].code='output="changed"';fs.writeFileSync(data.file,JSON.stringify(config));
    }
    if(mode==='uncertain') {
      const {acquireExecutionLease}=load('execution-lease'),{ExecutionJournal}=load('execution-journal');
      const lease=acquireExecutionLease(data.runtime);try {await ExecutionJournal.open(lease,first.runId,first.definitionHash).begin('b');} finally {lease.release();}
    }
    await assert.rejects(host({vault:root,workflowId:'w',resumeRunId:first.runId,redact:s=>s}),/branch changed|Git branch operation|outside|definition|reconciliation/i);
    assert.equal(fs.readFileSync(path.join(root,'effects.txt'),'utf8'),'A');
  }));
});
test('branch preflight rejects exterior git-dir and common-dir without branch or Code effects',async t=>{
  for(const commonOnly of [false,true]) await t.test(commonOnly?'common-dir':'git-dir',()=>fixture(async root=>{
    const original=branchFixture(root),vault=path.join(root,'isolated vault');
    original.git('worktree','add','--detach',vault,'HEAD');
    if(commonOnly) {
      const metadata=execFileSync('git',['-C',vault,'rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim();
      const internal=path.join(vault,'internal metadata');fs.cpSync(metadata,internal,{recursive:true});
      fs.writeFileSync(path.join(internal,'commondir'),path.join(root,'.git')+'\n');
      // Git marks this fixture file hidden on Windows; open the existing file
      // without O_CREAT (which Windows rejects for hidden files).
      const fd=fs.openSync(path.join(vault,'.git'),'r+');
      try {fs.ftruncateSync(fd,0);fs.writeFileSync(fd,'gitdir: '+internal+'\n');} finally {fs.closeSync(fd);}
    }
    const installation=path.join(vault,'.obsidian/plugins/auto-oc');fs.mkdirSync(installation,{recursive:true});
    fs.writeFileSync(path.join(installation,'data.json'),JSON.stringify({tasks:original.tasks,workflows:original.workflows}));
    const head=original.git('rev-parse','HEAD'),branches=original.git('branch','--list');
    const config=fs.readFileSync(path.join(installation,'data.json'));
    for(const candidate of process.platform==='win32'?[vault,shortWindowsPath(vault)]:[vault]) {
      await assert.rejects(load('installed-workflow-host').runInstalledWorkflow({vault:candidate,workflowId:'w',redact:s=>s}),/Git metadata is outside/);
      assert.equal(fs.existsSync(path.join(installation,'runtime')),false);
      assert.equal(fs.existsSync(path.join(vault,'effects.txt')),false);
      assert.equal(original.git('rev-parse','HEAD'),head);assert.equal(original.git('branch','--list'),branches);
      assert.deepEqual(fs.readFileSync(path.join(installation,'data.json')),config);
    }
  }));
});
test('Duplicate creates independent executable definitions after completion and reload',async t=>{
  for(const kind of ['task','workflow']) await t.test(kind,()=>fixture(async root=>{
    const directory=path.join(root,'.obsidian/plugins/auto-oc'),runtime=path.join(directory,'runtime');
    fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,'data.json');
    fs.writeFileSync(file,JSON.stringify({logsEnabled:true,maxLogsPerTask:100,tasks:[{id:'t',name:'Original task',taskKind:'code',code:'output="task-result";'}],
      workflows:[{id:'w',name:'Original workflow',steps:[{id:'a',stepKind:'code',code:'output="workflow-result";',transitions:[]}]}]}));
    const collection=kind==='task'?'tasks':'workflows',method=kind==='task'?'duplicateTask':'duplicateWorkflow';
    const plugin=pluginFor(root);await plugin.loadSettings();plugin.reservePluginExecution();
    let first,original,copyId,journalBefore,historyBefore;
    const historyDirectory=path.join(root,'.opencode/logs');
    // Read only the synthetic history created by this fixture.
    const history=()=>new Map(fs.existsSync(historyDirectory)?fs.readdirSync(historyDirectory,{recursive:true}).filter(f=>fs.statSync(path.join(historyDirectory,f)).isFile()).map(f=>[f,fs.readFileSync(path.join(historyDirectory,f))]):[]);
    try {
      first=await plugin.runSharedWorkflow(kind==='task'?'@task:t':'w',undefined,false,false,kind==='task'?'t':undefined);
      assert.equal(first.phase,'completed');
      original=structuredClone(plugin.settings[collection][0]);
      journalBefore=fs.readFileSync(path.join(runtime,first.runId+'.json'));historyBefore=history();
      if(kind==='task')assert.ok(historyBefore.size>0);
      else assert.equal(JSON.parse(journalBefore).steps[0].status,'completed');
      await plugin[method](plugin.settings[collection][0]);
      assert.deepEqual(plugin.settings[collection][0],original);
      const copy=plugin.settings[collection][1];copyId=copy.id;
      assert.notEqual(copyId,original.id);assert.equal(copy.status,'pending');
      assert.equal(copy.runtimeExecution,undefined);assert.equal(copy.legacyExecution,undefined);
      assert.ok(!copy.lastRun);
      if(kind==='task')assert.equal(copy.output,'');
      else {assert.equal(copy.currentStep,-1);assert.equal(copy.steps[0].status,'pending');assert.equal(copy.steps[0].output,'');assert.equal(copy.steps[0].lastRun,undefined);}
      assert.deepEqual(JSON.parse(fs.readFileSync(file))[collection][1],JSON.parse(JSON.stringify(copy)));
    } finally {plugin.releasePluginExecution(false);}
    const reopened=pluginFor(root);await reopened.loadSettings();reopened.reservePluginExecution();
    try {
      const second=await reopened.runSharedWorkflow(kind==='task'?'@task:'+copyId:copyId,undefined,false,false,kind==='task'?copyId:undefined);
      assert.equal(second.phase,'completed');assert.notEqual(second.runId,first.runId);
      assert.equal(second.workflowId,kind==='task'?'@task:'+copyId:copyId);
      assert.match(second.steps[0].output,kind==='task'?/task-result$/:/workflow-result$/);
      const checkpoint=JSON.parse(fs.readFileSync(path.join(runtime,second.runId+'.json')));
      assert.equal(checkpoint.runId,second.runId);assert.equal(checkpoint.workflowId,second.workflowId);
      assert.ok(!JSON.stringify(checkpoint).includes(first.runId));
      const final=pluginFor(root);await final.loadSettings();
      assert.deepEqual(final.settings[collection][0],original);
      assert.equal(final.settings[collection][1].runtimeExecution.runId,second.runId);
      assert.deepEqual(fs.readFileSync(path.join(runtime,first.runId+'.json')),journalBefore);
      for(const [f,bytes] of historyBefore)assert.deepEqual(fs.readFileSync(path.join(historyDirectory,f)),bytes);
    } finally {reopened.releasePluginExecution(false);}
  }));
});

test('Duplicate strips legacy ownership and isolates mutable definition configuration',async t=>{
  for(const legacy of [false,true]) await t.test('legacy='+legacy,()=>fixture(async root=>{
    const directory=path.join(root,'.obsidian/plugins/auto-oc');fs.mkdirSync(directory,{recursive:true});
    fs.writeFileSync(path.join(directory,'data.json'),JSON.stringify({tasks:[{id:'t',name:'Task',taskKind:'code',code:'output=1;',scheduleType:'weekly',scheduleDays:[1],scheduleMonthDays:[2]}],
      workflows:[{id:'w',name:'Workflow',scheduleType:'weekly',scheduleDays:[3],scheduleMonthDays:[4],handoffOutput:true,steps:[{id:'a',stepKind:'task',taskId:'t',position:{x:1,y:2},transitions:[{toStepId:'b',mode:'default'}]},{id:'b',stepKind:'code',code:'output=2;',transitions:[]}]}]}));
    const plugin=pluginFor(root);await plugin.loadSettings();plugin.reservePluginExecution();
    try {
      const task=plugin.settings.tasks[0],workflow=plugin.settings.workflows[0];
      if(legacy) {
        task.legacyExecution={token:'fixture-token',ownerToken:'fixture-owner',startedAt:'2026-01-01T00:00:00Z',stopState:'error',stopError:'fixture'};
        task.lastCodexThreadId='old-thread';task.lastCodexTurnId='old-turn';task.pendingCodexApproval={requestId:1,kind:'command',summary:'fixture'};
        workflow.legacyExecution={token:'workflow-token'};
        for(const entry of [task,workflow,...workflow.steps])Object.assign(entry,{status:'completed',lastRun:'2026-01-01T00:00:00Z'});
        task.output='old';for(const step of workflow.steps)step.output='old';
      }
      const originals=structuredClone([task,workflow]);
      plugin.workflowRuntime=new Map([['w',{previousOutput:'original context'}]]);
      const attempts=new Map(plugin.legacyAttempts),contexts=structuredClone(plugin.workflowRuntime);
      await plugin.duplicateTask(task);await plugin.duplicateWorkflow(workflow);
      const taskCopy=plugin.settings.tasks[1],workflowCopy=plugin.settings.workflows[1];
      for(const copy of [taskCopy,workflowCopy]) {assert.equal(copy.legacyExecution,undefined);assert.equal(copy.runtimeExecution,undefined);assert.equal(copy.status,'pending');assert.ok(!copy.lastRun);}
      for(const key of ['lastCodexThreadId','lastCodexTurnId','pendingCodexApproval'])assert.equal(taskCopy[key],undefined);
      assert.equal(taskCopy.code,task.code);assert.equal(taskCopy.scheduleType,task.scheduleType);
      assert.deepEqual(workflowCopy.steps.map(s=>s.id),['a','b']);assert.equal(workflowCopy.steps[0].taskId,'t');
      assert.deepEqual(workflowCopy.steps[0].transitions,workflow.steps[0].transitions);assert.equal(workflowCopy.handoffOutput,true);
      for(const step of workflowCopy.steps){assert.equal(step.status,'pending');assert.equal(step.output,'');assert.equal(step.lastRun,undefined);}
      taskCopy.scheduleDays.push(5);taskCopy.scheduleMonthDays.push(6);
      workflowCopy.scheduleDays.push(5);workflowCopy.scheduleMonthDays.push(6);
      workflowCopy.steps[0].position.x=100;workflowCopy.steps[0].transitions[0].toStepId='a';workflowCopy.steps[1].transitions.push({toStepId:'a',mode:'default'});
      assert.deepEqual([task,workflow],originals);
      assert.deepEqual(plugin.legacyAttempts,attempts);assert.deepEqual(plugin.workflowRuntime,contexts);
    } finally {plugin.releasePluginExecution(false);}
  }));
});

test('selected installation runs plugin tasks and workflows without reading the alternative',async t=>{
  for(const kind of ['task','workflow']) for(const alternative of [false,true]) await t.test(`${kind}/alternative=${alternative}`,()=>fixture(async root=>{
    const configDir='custom/nested',pluginId=alternative?'custom-plugin':'auto-oc',selected=path.join(root,configDir,'plugins',pluginId),other=path.join(root,'.obsidian/plugins/auto-oc');
    const catalog=value=>({tasks:[{id:'t',name:'Task',taskKind:'code',code:`output="${value}";`}],workflows:[{id:'w',name:'Workflow',steps:[{id:'a',taskId:'t'}]}]});
    fs.mkdirSync(selected,{recursive:true});fs.writeFileSync(path.join(selected,'data.json'),JSON.stringify(catalog('selected')));
    if(alternative){fs.mkdirSync(other,{recursive:true});fs.writeFileSync(path.join(other,'data.json'),JSON.stringify(catalog('wrong')));}
    const before=alternative?fs.readFileSync(path.join(other,'data.json')):undefined;
    const original=fs.readFileSync,reads=[];
    fs.readFileSync=function(file,...args){if(typeof file==='string' && (file===path.join(other,'data.json') || file.startsWith(path.join(other,'runtime')+path.sep)))reads.push(file);return original.call(this,file,...args);};
    const plugin=pluginFor(root,configDir,pluginId);
    try {
      await plugin.loadSettings();assert.equal(fs.existsSync(path.join(selected,'runtime')),false);
      plugin.reservePluginExecution();
      const result=await plugin.runSharedWorkflow(kind==='task'?'@task:t':'w',undefined,false,false,kind==='task'?'t':undefined);
      assert.equal(result.phase,'completed');assert.match(result.steps[0].output,/\nselected$/);
      assert.equal(plugin.settings.tasks[0].output,result.steps[0].output);
      const physicalRuntime=process.platform==='win32'?fs.realpathSync.native(path.join(selected,'runtime')):fs.realpathSync(path.join(selected,'runtime'));
      assert.equal(plugin.pluginExecutionLease.directory,physicalRuntime);
      const bytes=fs.readFileSync(path.join(selected,'runtime',result.runId+'.json'));
      const reloaded=pluginFor(root,configDir,pluginId);await reloaded.loadSettings();
      assert.equal(reloaded.settings.tasks[0].runtimeExecution.runId,result.runId);
      assert.deepEqual(fs.readFileSync(path.join(selected,'runtime',result.runId+'.json')),bytes);
      assert.deepEqual(reads,[]);
    } finally {fs.readFileSync=original;plugin.releasePluginExecution(false);}
    if(alternative){assert.deepEqual(fs.readFileSync(path.join(other,'data.json')),before);assert.equal(fs.existsSync(path.join(other,'runtime')),false);}
    else assert.equal(fs.existsSync(path.join(root,'.obsidian')),false);
  }));
});
test('selected installation rejects crossed leases before catalog reads and preserves the owner',()=>fixture(async root=>{
  const {runInstalledWorkflow:host}=load('installed-workflow-host');
  const selected=path.join(root,'selected/plugins/auto-oc'),other=path.join(root,'.obsidian/plugins/auto-oc');
  for(const directory of [selected,other]) {
    fs.mkdirSync(path.join(directory,'runtime'),{recursive:true});
    fs.writeFileSync(path.join(directory,'data.json'),JSON.stringify({tasks:[],workflows:[{id:'w',steps:[{id:'a',stepKind:'code',code:'output="right";'}]}]}));
  }
  const lease=load('execution-lease').acquireExecutionLease(path.join(other,'runtime'));
  const before=fs.readFileSync(path.join(selected,'data.json')),read=fs.readFileSync;
  let catalogReads=0;
  fs.readFileSync=function(file,...args){if(file===path.join(selected,'data.json'))catalogReads++;return read.call(this,file,...args);};
  try {
    await assert.rejects(host({vault:root,installationDirectory:selected,workflowId:'w',lease,redact:s=>s}),/another installation/);
    assert.equal(catalogReads,0);lease.assertOwned();
    assert.deepEqual(fs.readdirSync(path.join(selected,'runtime')),[]);
    assert.deepEqual(read(path.join(selected,'data.json')),before);
  } finally {fs.readFileSync=read;lease.release();}
  const own=load('execution-lease').acquireExecutionLease(path.join(selected,'runtime'));
  try {assert.equal((await host({vault:root,installationDirectory:selected,workflowId:'w',lease:own,redact:s=>s})).phase,'completed');own.assertOwned();}
  finally {own.release();}
}));

test('selected installation rejects changes throughout the reserved plugin lifetime',()=>fixture(async root=>{
  for(const configDir of ['selected','.obsidian']) {
    const dir=path.join(root,configDir,'plugins/auto-oc');fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,'data.json'),JSON.stringify({tasks:[],workflows:[]}));
  }
  const plugin=pluginFor(root,'selected');await plugin.loadSettings();plugin.reservePluginExecution();
  const before=fs.readFileSync(path.join(root,'.obsidian/plugins/auto-oc/data.json'));
  try {
    plugin.app.vault.configDir='.obsidian';
    assert.throws(()=>plugin.reservePluginExecution(),/changed while reserved/);
    await assert.rejects(plugin.loadSettings(),/changed while reserved/);
    await assert.rejects(plugin.saveSettings(),/changed while reserved/);
    await assert.rejects(plugin.runSharedWorkflow('w'),/changed while reserved/);
    assert.deepEqual(fs.readFileSync(path.join(root,'.obsidian/plugins/auto-oc/data.json')),before);
    plugin.pluginExecutionLease.assertOwned();
    assert.equal(fs.existsSync(path.join(root,'.obsidian/plugins/auto-oc/runtime')),false);
  } finally {plugin.releasePluginExecution(false);}
}));

test('selected installation recovers pending tasks and workflows read-only before reserving',async t=>{
  for(const kind of ['task','workflow']) for(const phase of ['ready','in_flight']) await t.test(`${kind}/${phase}`,()=>fixture(async root=>{
    const installation=path.join(root,'selected/plugins/auto-oc'),runtime=path.join(installation,'runtime');fs.mkdirSync(runtime,{recursive:true});
    const task={id:'t',taskKind:'code',code:'output="once";'},workflow=kind==='task'?load('standalone-task').standaloneTaskWorkflow('t'):{id:'w',steps:[{id:'a',taskId:'t'}]};
    const config={tasks:[task],workflows:kind==='task'?[]:[workflow]},definition=prepare(workflow,[task],config);
    const lease=load('execution-lease').acquireExecutionLease(runtime),journal=await load('execution-journal').ExecutionJournal.create(lease,workflow.id,definition.hash,workflow.steps[0].id);
    if(phase==='in_flight')await journal.begin(workflow.steps[0].id);lease.release();
    const state=journal.snapshot();(kind==='task'?task:workflow).runtimeExecution={runId:state.runId,workflowId:workflow.id,revision:state.revision};
    const file=path.join(installation,'data.json');fs.writeFileSync(file,JSON.stringify(config));
    const before=fs.readFileSync(path.join(runtime,state.runId+'.json')),catalogBefore=fs.readFileSync(file),plugin=pluginFor(root,'selected');
    await plugin.loadSettings();
    const recovered=kind==='task'?plugin.settings.tasks[0]:plugin.settings.workflows[0];
    assert.equal(recovered.runtimeExecution.runId,state.runId);assert.equal(recovered.runtimeExecution.phase,phase);
    assert.equal(recovered.runtimeExecution.requiresReconciliation,phase==='in_flight');
    assert.deepEqual(fs.readFileSync(path.join(runtime,state.runId+'.json')),before);assert.deepEqual(fs.readFileSync(file),catalogBefore);
    assert.equal(fs.existsSync(path.join(runtime,'execution.lock')),false);
    const options={vault:root,installationDirectory:installation,...(kind==='task'?{taskId:'t'}:{workflowId:'w'}),resumeRunId:state.runId,redact:s=>s};
    if(phase==='in_flight') {
      await assert.rejects(load('installed-workflow-host').runInstalledWorkflow(options),/requires reconciliation/);
      assert.deepEqual(fs.readFileSync(path.join(runtime,state.runId+'.json')),before);
    } else assert.equal((await load('installed-workflow-host').runInstalledWorkflow(options)).phase,'completed');
    assert.equal(fs.existsSync(path.join(root,'.obsidian')),false);
  }));
});

test('selected installation routes live approve and deny using the same journal and owner',async t=>{
  for(const kind of ['task','workflow']) for(const approved of [true,false]) await t.test(`${kind}/${approved}`,()=>fixture(async root=>{
    const installation=path.join(root,'selected/plugins/auto-oc'),other=path.join(root,'.obsidian/plugins/auto-oc');
    const task={id:'t',name:'Task',taskKind:'codex',interactiveTerminal:true,prompt:'fixture'},workflow={id:'w',name:'Workflow',steps:[{id:'a',taskId:'t'}]};
    fs.mkdirSync(installation,{recursive:true});fs.mkdirSync(other,{recursive:true});
    const config={tasks:[task],workflows:[workflow]};
    for(const dir of [installation,other])fs.writeFileSync(path.join(dir,'data.json'),JSON.stringify(config));
    const otherBefore=fs.readFileSync(path.join(other,'data.json')),plugin=pluginFor(root,'selected');
    await plugin.loadSettings();plugin.reservePluginExecution();
    const controller=new AbortController();let observed,decisions=0,token;
    const host=loader({'workflow-task-adapters':{createWorkflowTaskAdapter:()=>({supports:()=>true,execute:async(_task,_prompt,signal,record,interaction)=>{
      await record('thread','turn');observed=await interaction.approve({requestId:1,kind:'command',summary:'controlled'},signal);
      return {succeeded:true,output:'done'};
    }})}})('installed-workflow-host').runInstalledWorkflow;
    plugin.sharedWorkflowExecution={workflowId:kind==='task'?'@task:t':'w',controller};
    try {
      const result=await host({vault:root,installationDirectory:installation,...(kind==='task'?{taskId:'t'}:{workflowId:'w'}),lease:plugin.pluginExecutionLease,redact:s=>s,
        onCheckpoint:async state=>{
          plugin.sharedWorkflowExecution.runId=state.runId;await plugin.loadSettings();
          const pending=state.steps.at(-1)?.approval;if(!pending)return;
          decisions++;token=pending.token;
          assert.equal(pending.ownerToken,plugin.pluginExecutionLease.token);
          plugin.settings.tasks[0].pendingCodexApproval.requestId='bad';
          await assert.rejects(plugin.resolveCodexApproval('t',approved),/no longer pending/);
          plugin.settings.tasks[0].pendingCodexApproval.requestId=pending.token;
          plugin.app.vault.configDir='.obsidian';
          await assert.rejects(plugin.resolveCodexApproval('t',approved),/changed while reserved/);plugin.app.vault.configDir='selected';
          const runId=plugin.sharedWorkflowExecution.runId;plugin.sharedWorkflowExecution.runId='foreign';
          await assert.rejects(plugin.resolveCodexApproval('t',approved),/active execution/);plugin.sharedWorkflowExecution.runId=runId;
          await plugin.resolveCodexApproval('t',approved);
          await assert.rejects(plugin.resolveCodexApproval('t',approved),/EEXIST/);
        }});
      assert.equal(result.phase,'completed');assert.equal(observed,approved);assert.equal(decisions,1);
      const response=JSON.parse(fs.readFileSync(path.join(installation,'runtime',`${result.runId}-${token}.approval.json`)));
      assert.equal(response.approved,approved);plugin.pluginExecutionLease.assertOwned();
      assert.deepEqual(fs.readFileSync(path.join(other,'data.json')),otherBefore);assert.equal(fs.existsSync(path.join(other,'runtime')),false);
    } finally {plugin.sharedWorkflowExecution=undefined;plugin.releasePluginExecution(false);}
  }));
});

test('selected installation validation rejects missing, escaped and linked paths without fallback',async t=>{
  const {resolveInstalledWorkflowLocation:resolve}=load('installed-workflow-location');
  await fixture(async root=>{
    const valid=path.join(root,'.obsidian/plugins/auto-oc');fs.mkdirSync(valid,{recursive:true});
    fs.writeFileSync(path.join(valid,'data.json'),'{}');
    for(const invalid of ['',null,'missing',path.dirname(root),'../escape','missing/../.obsidian/plugins/auto-oc','.obsidian/./plugins/auto-oc']) {
      assert.throws(()=>resolve(root,invalid));
      await assert.rejects(load('installed-workflow-host').runInstalledWorkflow({vault:root,installationDirectory:invalid,workflowId:'w',redact:s=>s}));
    }
    fs.writeFileSync(path.join(root,'file'),'');assert.throws(()=>resolve(root,'file/plugins/auto-oc'));
    const physicalInstallation=process.platform==='win32'?fs.realpathSync.native(valid):fs.realpathSync(valid);
    const location=resolve(root);assert.equal(location.installationDirectory,physicalInstallation);assert.equal(fs.existsSync(location.runtimeDirectory),false);
  });
  for(const component of ['custom','custom/nested','custom/nested/plugins','custom/nested/plugins/auto-oc','custom/nested/plugins/auto-oc/runtime','custom/nested/plugins/auto-oc/data.json']) await t.test(component,()=>fixture(async root=>{
    const selected=path.join(root,'custom/nested/plugins/auto-oc'),link=path.join(root,component),target=path.join(root,'target');
    fs.mkdirSync(path.dirname(link),{recursive:true});fs.mkdirSync(target);
    // A directory junction at data.json also must be rejected before reading.
    fs.symlinkSync(target,link,process.platform==='win32'?'junction':'dir');
    assert.throws(()=>resolve(root,selected),/regular|runtime/);
    await assert.rejects(load('installed-workflow-host').runInstalledWorkflow({vault:root,installationDirectory:selected,workflowId:'w',redact:s=>s}),/regular|runtime/);
    assert.equal(fs.existsSync(path.join(root,'.obsidian')),false);
  }));
});
test('edited terminal tasks and workflows reload and rerun without rewriting history',async t=>{
  for(const kind of ['task','workflow']) for(const phase of ['completed','failed']) {
    const changes={name:c=>{(kind==='task'?c.tasks[0]:c.workflows[0]).name='Edited';},
      prompt:c=>{c.tasks[0].prompt='Edited prompt';},model:c=>{c.tasks[0].model='edited-model';},
      global:c=>{c.defaultCodexModel='edited-default';c.taskTimeoutSeconds=900;}};
    for(const [changeName,change] of Object.entries(changes)) await t.test(`${kind}/${phase}/${changeName}`,()=>fixture(async root=>{
      const directory=path.join(root,'.obsidian/plugins/auto-oc'),runtime=path.join(directory,'runtime');
      fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,'data.json');
      const config={logsEnabled:true,maxLogsPerTask:100,tasks:[{id:'t',name:'Original task',taskKind:'code',prompt:'Original prompt',code:'output="controlled";'}],
        workflows:kind==='workflow'?[{id:'w',name:'Original workflow',steps:[{id:'a',taskId:'t'}]}]:[]};
      fs.writeFileSync(file,JSON.stringify(config));
      const definitions=[],effects=[];
      const host=loader({'workflow-task-adapters':{createWorkflowTaskAdapter:definition=>{
        definitions.push(definition);
        return {supports:()=>true,execute:async(task,prompt)=>{effects.push({task,prompt});return {succeeded:phase==='completed',output:'historical-result-'+effects.length};}};
      }}})('installed-workflow-host').runInstalledWorkflow;
      const options={vault:root,...(kind==='task'?{taskId:'t'}:{workflowId:'w'}),redact:s=>s};
      const first=await host(options);assert.equal(first.phase,phase);
      const journalFile=path.join(runtime,first.runId+'.json'),journalBefore=fs.readFileSync(journalFile);
      const historyDir=path.join(root,'.opencode/logs/t'),historyFiles=fs.readdirSync(historyDir),historyBefore=new Map(historyFiles.map(f=>[f,fs.readFileSync(path.join(historyDir,f))]));
      const edited=JSON.parse(fs.readFileSync(file));change(edited);fs.writeFileSync(file,JSON.stringify(edited));
      const plugin=pluginFor(root);
      plugin.reservePluginExecution();
      try {
        await plugin.loadSettings();
        const recovered=kind==='task'?plugin.settings.tasks[0]:plugin.settings.workflows[0];
        assert.equal(recovered.status,phase);assert.equal(recovered.runtimeExecution.runId,first.runId);
        assert.equal(recovered.runtimeExecution.definitionHash,first.definitionHash);
        assert.equal(plugin.settings.tasks[0].prompt,edited.tasks[0].prompt);
        assert.equal(plugin.settings.tasks[0].output,'historical-result-1');
        if(kind==='workflow') assert.deepEqual(recovered.runtimeExecution.historicalSteps,first.steps);
        const bytes=fs.readFileSync(file);await plugin.saveSettings();await plugin.loadSettings();
        assert.deepEqual(fs.readFileSync(journalFile),journalBefore);
        for(const [f,contents] of historyBefore) assert.deepEqual(fs.readFileSync(path.join(historyDir,f)),contents);
        assert.equal(effects.length,1);
        assert.ok(bytes.length);
      } finally {plugin.releasePluginExecution(false);}
      await assert.rejects(host({...options,resumeRunId:first.runId}),/definition changed/);
      assert.equal(effects.length,1);assert.deepEqual(fs.readFileSync(journalFile),journalBefore);
      const second=await host({...options,newExecution:true});
      assert.notEqual(second.runId,first.runId);assert.notEqual(second.definitionHash,first.definitionHash);
      assert.equal(second.definitionHash,definitions.at(-1).hash);
      assert.equal(effects.at(-1).task.prompt,edited.tasks[0].prompt);
      assert.equal(effects.at(-1).task.model,edited.tasks[0].model);
      if(changeName==='global') assert.equal(definitions.at(-1).settings.defaultCodexModel,'edited-default');
      assert.deepEqual(fs.readFileSync(journalFile),journalBefore);
      for(const [f,contents] of historyBefore) if(f!=='latest.log') assert.deepEqual(fs.readFileSync(path.join(historyDir,f)),contents);
      const beforeLate=fs.readFileSync(file);
      await assert.rejects(load('workflow-catalog-progress').persistWorkflowProgress({configurationFile:file,runtimeDirectory:runtime,checkpoint:first,expectedRunId:first.runId,...(kind==='task'?{taskId:'t'}:{})}));
      assert.deepEqual(fs.readFileSync(file),beforeLate);
    }));
  }
});

test('reopening a structurally edited terminal workflow never assigns history to a replacement task',()=>fixture(async root=>{
  const directory=path.join(root,'.obsidian/plugins/auto-oc');fs.mkdirSync(directory,{recursive:true});
  const file=path.join(directory,'data.json');
  fs.writeFileSync(file,JSON.stringify({tasks:[{id:'old',taskKind:'code',code:'output="old-result";'},
    {id:'replacement',taskKind:'code',code:'output="new-result";',status:'pending',output:''}],workflows:[{id:'w',steps:[{id:'a',taskId:'old'}]}]}));
  const host=load('installed-workflow-host').runInstalledWorkflow;
  const first=await host({vault:root,workflowId:'w',redact:s=>s});
  const original=JSON.parse(fs.readFileSync(file)),plugin=pluginFor(root);
  for(const steps of [[{id:'a',taskId:'replacement'}],[],[{id:'missing',taskId:'absent'}]]) {
    const edited=structuredClone(original);edited.workflows[0].steps=steps;fs.writeFileSync(file,JSON.stringify(edited));
    plugin.reservePluginExecution();try {
      await plugin.loadSettings();assert.equal(plugin.settings.tasks[1].output,'');assert.equal(plugin.settings.tasks[1].status,'pending');
      assert.equal(plugin.settings.tasks[0].output,original.tasks[0].output);assert.deepEqual(plugin.settings.workflows[0].runtimeExecution.historicalSteps,first.steps);
    } finally {plugin.releasePluginExecution(false);}
  }
}));

test('unfinished edited definitions remain visible on reload but reject resume and new runs without effects',async t=>{
  for(const kind of ['task','workflow']) for(const phase of ['ready','in_flight']) await t.test(`${kind}/${phase}`,()=>fixture(async root=>{
    const directory=path.join(root,'.obsidian/plugins/auto-oc'),runtime=path.join(directory,'runtime');fs.mkdirSync(runtime,{recursive:true});
    const task={id:'t',taskKind:'code',code:'output="must not execute";',prompt:'before'},workflow=kind==='task'?load('standalone-task').standaloneTaskWorkflow('t'):{id:'w',steps:[{id:'a',taskId:'t'}]};
    const config={tasks:[task],workflows:kind==='task'?[]:[workflow]},definition=prepare(workflow,[task],config);
    const lease=load('execution-lease').acquireExecutionLease(runtime),journal=await load('execution-journal').ExecutionJournal.create(lease,workflow.id,definition.hash,workflow.steps[0].id);
    if(phase==='in_flight')await journal.begin(workflow.steps[0].id);lease.release();
    const state=journal.snapshot();(kind==='task'?task:workflow).runtimeExecution={runId:state.runId,workflowId:workflow.id,revision:state.revision};
    task.prompt='changed';const file=path.join(directory,'data.json');fs.writeFileSync(file,JSON.stringify(config));
    const before=fs.readFileSync(path.join(runtime,state.runId+'.json')),plugin=pluginFor(root);
    plugin.reservePluginExecution();try {
      await plugin.loadSettings();
      const item=kind==='task'?plugin.settings.tasks[0]:plugin.settings.workflows[0];
      assert.equal(item.runtimeExecution.definitionChanged,true);
      assert.equal(item.runtimeExecution.requiresReconciliation,true);
      assert.equal(item.status,'pending');
      assert.deepEqual(item.runtimeExecution.historicalSteps,state.steps);
    } finally {plugin.releasePluginExecution(false);}
    let effects=0;
    const host=loader({'workflow-task-adapters':{createWorkflowTaskAdapter:()=>({supports:()=>true,execute:async()=>{effects++;return {succeeded:true,output:'bad'};}})}})('installed-workflow-host').runInstalledWorkflow;
    await assert.rejects(host({vault:root,...(kind==='task'?{taskId:'t'}:{workflowId:'w'}),resumeRunId:state.runId,redact:s=>s}),/definition changed/);
    await assert.rejects(host({vault:root,...(kind==='task'?{taskId:'t'}:{workflowId:'w'}),newExecution:true,redact:s=>s}),/unfinished execution/);
    assert.equal(effects,0);assert.deepEqual(fs.readFileSync(path.join(runtime,state.runId+'.json')),before);
  }));
});

test('task replacement validates historical bindings and rejects late publication with an unchanged definition',()=>fixture(async root=>{
  const directory=path.join(root,'.obsidian/plugins/auto-oc'),runtime=path.join(directory,'runtime');fs.mkdirSync(directory,{recursive:true});
  const file=path.join(directory,'data.json');
  fs.writeFileSync(file,JSON.stringify({tasks:[{id:'t',taskKind:'code',code:'output=1;'}],workflows:[{id:'w',steps:[{id:'a',taskId:'t'}]}]}));
  const host=load('installed-workflow-host').runInstalledWorkflow;
  const workflowRun=await host({vault:root,workflowId:'w',redact:s=>s});
  const first=await host({vault:root,taskId:'t',newExecution:true,redact:s=>s});
  assert.notEqual(workflowRun.runId,first.runId);
  const second=await host({vault:root,taskId:'t',newExecution:true,redact:s=>s});
  assert.equal(second.definitionHash,first.definitionHash);
  const before=fs.readFileSync(file);
  await assert.rejects(load('workflow-catalog-progress').persistWorkflowProgress({configurationFile:file,runtimeDirectory:runtime,checkpoint:first,expectedRunId:first.runId,taskId:'t'}),/Stale progress/);
  assert.deepEqual(fs.readFileSync(file),before);
  for(const mutate of [c=>{c.tasks[0].runtimeExecution.revision+=1;},c=>{c.tasks[0].runtimeExecution.workflowId='wrong';},c=>{c.tasks[0].id='other';}]) {
    const config=JSON.parse(before);mutate(config);fs.writeFileSync(file,JSON.stringify(config));
    const plugin=pluginFor(root);plugin.reservePluginExecution();
    try {await assert.rejects(plugin.loadSettings(),/identity|Stale/);} finally {plugin.releasePluginExecution(false);}
    await assert.rejects(host({vault:root,taskId:config.tasks[0].id,newExecution:true,redact:s=>s}),/identity|Stale/);
  }
}));
test('autonomous task history survives resume and another run, honors logging, and freezes elapsed time',()=>fixture(async root=>{
  const directory=path.join(root,'.obsidian/plugins/auto-oc');fs.mkdirSync(directory,{recursive:true});
  const file=path.join(directory,'data.json');
  fs.writeFileSync(file,JSON.stringify({logsEnabled:true,tasks:[{id:'history',taskKind:'code',code:'output="history-"+"x".repeat(64000);'}],workflows:[]}));
  const cli=(...args)=>require('node:child_process').spawnSync(process.execPath,[path.resolve(__dirname,'../autooc-cli.cjs'),...args,'--vault',root],{encoding:'utf8',timeout:15000});
  const first=cli('run','--task','history');assert.equal(first.status,0,first.stderr);
  const runId=JSON.parse(first.stdout).runId,logDir=path.join(root,'.opencode/logs/history');
  assert.ok(fs.existsSync(logDir),'History must have persistent logs from CLI tasks');
  const logs=()=>fs.readdirSync(logDir).filter(f=>f!=='latest.log');
  assert.equal(logs().length,1);
  assert.match(fs.readFileSync(path.join(logDir,logs()[0]),'utf8'),new RegExp(runId));
  assert.ok(fs.readFileSync(path.join(logDir,logs()[0]),'utf8').includes('x'.repeat(64000)));
  const task=JSON.parse(fs.readFileSync(file)).tasks[0];
  assert.ok(task.runtimeExecution.finishedAt);
  const elapsed=load('task-history').taskElapsedSeconds;
  assert.equal(elapsed(task,Date.now()),elapsed(task,Date.now()+3600000));
  assert.equal(elapsed({...task,runtimeExecution:{}},Date.now()),undefined);
  const resumed=cli('resume','--task','history','--run',runId);assert.equal(resumed.status,0,resumed.stderr);
  assert.equal(logs().length,1);
  const next=cli('run','--task','history');assert.equal(next.status,0,next.stderr);
  assert.equal(logs().length,2);
  const config=JSON.parse(fs.readFileSync(file));config.logsEnabled=false;fs.writeFileSync(file,JSON.stringify(config));
  const disabled=cli('run','--task','history');assert.equal(disabled.status,0,disabled.stderr);
  assert.equal(logs().length,2);
}));
test('runtime history keeps attempts and failures, applies retention and refuses path escape',()=>fixture(async root=>{
  const {persistTaskHistory,taskElapsedSeconds}=load('task-history');
  const workflow={steps:[{id:'a',taskId:'t'},{id:'b',taskId:'t'}]};
  const startedAt=new Date().toISOString();
  const checkpoint={runId:'run-1',steps:[
    {stepId:'a',status:'completed',startedAt,finishedAt:startedAt,output:'first'},
    {stepId:'a',status:'failed',startedAt,finishedAt:startedAt,output:'second'},
    {stepId:'b',status:'in_flight',startedAt}
  ]};
  persistTaskHistory(root,workflow,checkpoint,{});
  const dir=path.join(root,'.opencode/logs/t'),logs=()=>fs.readdirSync(dir).filter(f=>f!=='latest.log');
  assert.equal(logs().length,2);assert.match(fs.readFileSync(path.join(dir,'latest.log'),'utf8'),/Status: failed[\s\S]*second/);
  persistTaskHistory(root,workflow,checkpoint,{});assert.equal(logs().length,2);
  persistTaskHistory(root,workflow,checkpoint,{maxLogsPerTask:1});assert.equal(logs().length,1);
  assert.match(fs.readFileSync(path.join(dir,logs()[0]),'utf8'),/second/);
  assert.throws(()=>persistTaskHistory(root,{steps:[{id:'a',taskId:'../escape'}]},checkpoint,{}),/Unsafe/);
  assert.equal(taskElapsedSeconds({lastRun:'2026-01-01T00:00:00Z',status:'completed',runtimeExecution:{finishedAt:'2026-01-01T00:00:03Z'}},0),3);
  assert.equal(taskElapsedSeconds({lastRun:'2026-01-01T00:00:00Z',status:'running'},Date.parse('2026-01-01T00:00:07Z')),7);
  assert.equal(taskElapsedSeconds({lastRun:'invalid',status:'completed'}),undefined);
  const old={runId:'old-run',steps:[{stepId:'a',status:'completed',startedAt:'2000-01-01T00:00:00Z',output:'old'}]};
  persistTaskHistory(root,workflow,old,{logRetentionDays:1,maxLogsPerTask:0});
  assert.equal(logs().length,1);assert.ok(!logs()[0].includes('old-run'));
  const linked=path.join(root,'link-target');fs.mkdirSync(linked);
  fs.symlinkSync(linked,path.join(root,'.opencode/logs/linked'),'junction');
  assert.throws(()=>persistTaskHistory(root,{steps:[{id:'a',taskId:'linked'}]},checkpoint,{}),/regular directories/);
  assert.deepEqual(fs.readdirSync(linked),[]);
}));

test('journal finish times are validated without rejecting legacy terminal checkpoints',()=>fixture(async root=>{
  const {acquireExecutionLease}=load('execution-lease'),{ExecutionJournal,validateExecutionCheckpoint}=load('execution-journal');
  const lease=acquireExecutionLease(root);
  try {
    const journal=await ExecutionJournal.create(lease,'w','a'.repeat(64),'a');
    await journal.begin('a');await journal.finish('a',false,'failed',null);
    const state=journal.snapshot();assert.ok(state.steps[0].finishedAt);validateExecutionCheckpoint(state);
    state.steps[0].finishedAt='invalid';assert.throws(()=>validateExecutionCheckpoint(state),/finish timestamp/);
    state.steps[0].finishedAt='2000-01-01T00:00:00Z';assert.throws(()=>validateExecutionCheckpoint(state),/finish timestamp/);
    delete state.steps[0].finishedAt;validateExecutionCheckpoint(state);
  } finally {lease.release();}
}));
test('CLI history is listed by the plugin History modal and Log duration stays fixed after reopening',()=>fixture(async root=>{
  const directory=path.join(root,'.obsidian/plugins/auto-oc');fs.mkdirSync(directory,{recursive:true});
  const file=path.join(directory,'data.json');
  fs.writeFileSync(file,JSON.stringify({tasks:[{id:'ui',name:'History fixture',taskKind:'code',code:'output="VISIBLE_HISTORY"'}],workflows:[{id:'ui-workflow',steps:[{id:'a',taskId:'ui'}]}]}));
  const cli=require('node:child_process').spawnSync(process.execPath,[path.resolve(__dirname,'../autooc-cli.cjs'),'run','--workflow','ui-workflow','--vault',root],{encoding:'utf8',timeout:15000});
  assert.equal(cli.status,0,cli.stderr);
  const elements=[];
  class Element {
    constructor(options={}){this.textContent=options.text||'';this.cls=options.cls;elements.push(this);}
    addClass(){} empty(){} createEl(_tag,options){return new Element(options);} createDiv(options){return new Element(options);} createSpan(options){return new Element(options);}
  }
  const original=Module._load,priorWindow=global.window,priorNow=Date.now;
  const timers=new Map();let timerId=0;
  global.window={setInterval:fn=>{timers.set(++timerId,fn);return timerId;},clearInterval:id=>timers.delete(id)};
  let plugin,live;
  try {
    Module._load=function(id,...args){if(id==='obsidian')return {Plugin:class{},Notice:class{},Modal:class{constructor(app){this.app=app;this.contentEl=new Element();}},Setting:class{},ItemView:class{},PluginSettingTab:class{},WorkspaceLeaf:class{},MarkdownRenderer:{render(){}}};return original.call(this,id,...args);};
    const filename=path.resolve(__dirname,'../main.js'),bundle=new Module(filename,module);bundle.filename=filename;bundle.paths=Module._nodeModulePaths(path.dirname(filename));
    bundle._compile(fs.readFileSync(filename,'utf8')+'\nmodule.exports.historyTest={LiveLogModal,LogHistoryModal,getLogHistory};',filename);
    const {LiveLogModal,LogHistoryModal,getLogHistory}=bundle.exports.historyTest;
    plugin=new bundle.exports.default();plugin.app={vault:{adapter:{basePath:root},configDir:'.obsidian'}};plugin.manifest={id:'auto-oc'};
    plugin.reservePluginExecution();await plugin.loadSettings();
    const task=plugin.settings.tasks[0],history=getLogHistory(root,task.id);
    assert.equal(history.length,1);assert.match(history[0].timestamp,/^\d{2}\/\d{2}\/\d{4} /);
    assert.match(fs.readFileSync(history[0].file,'utf8'),/VISIBLE_HISTORY/);
    new LogHistoryModal(plugin.app,task,plugin).onOpen();
    assert.ok(elements.some(el=>el.textContent==='1 execution(s)'));
    live=new LiveLogModal(plugin.app,task,plugin);live.onOpen();
    const elapsed=elements.find(el=>el.cls==='auto-oc-log-elapsed'),initial=elapsed.textContent;
    assert.doesNotMatch(initial,/unavailable/);
    Date.now=()=>priorNow()+3600000;for(const callback of timers.values())callback();
    assert.equal(elapsed.textContent,initial);
    delete task.runtimeExecution.finishedAt;for(const callback of timers.values())callback();
    assert.match(elapsed.textContent,/unavailable/);
  } finally {live?.onClose();plugin?.releasePluginExecution(false);Module._load=original;global.window=priorWindow;Date.now=priorNow;}
}));
test('CLI-first reopening preserves terminal history after edits while resume stays strict',async t=>{
  const original=Module._load;let Plugin;
  try {
    Module._load=function(id,...args){if(id==='obsidian')return {Plugin:class{},Notice:class{},Modal:class{},Setting:class{},ItemView:class{},PluginSettingTab:class{},WorkspaceLeaf:class{}};return original.call(this,id,...args);};
    Plugin=require('../main.js').default;
  } finally {Module._load=original;}
  const defaults=load('execution-defaults').EXECUTION_DEFAULTS;
  for(const [name,settings] of Object.entries({omitted:{},explicit:{...defaults},custom:{taskTimeoutSeconds:3600,defaultModel:'fixture-model'}})) {
    await t.test(name,()=>fixture(async root=>{
      const directory=path.join(root,'.obsidian/plugins/auto-oc');fs.mkdirSync(directory,{recursive:true});
      const file=path.join(directory,'data.json');
      fs.writeFileSync(file,JSON.stringify({...settings,tasks:[{id:'task',taskKind:'code',code:'output=input.length;'}],workflows:[
        {id:'first',steps:[{id:'effect',stepKind:'code',codeAllowVault:true,code:'vault.append("effect.txt","once");output="x".repeat(64000);'},{id:'task',taskId:'task'}]}
      ]}));
      const cli=(...args)=>require('node:child_process').spawnSync(process.execPath,[path.resolve(__dirname,'../autooc-cli.cjs'),...args,'--vault',root],{encoding:'utf8',timeout:15000});
      const result=cli('run','--workflow','first');assert.equal(result.status,0,result.stderr);
      const run=JSON.parse(result.stdout);assert.equal(run.phase,'completed');
      const persisted=fs.readFileSync(file,'utf8'),config=JSON.parse(persisted);
      const journal=path.join(directory,'runtime',run.runId+'.json'),journalBefore=fs.readFileSync(journal,'utf8');
      const plugin=new Plugin();plugin.app={vault:{adapter:{basePath:root},configDir:'.obsidian'}};plugin.manifest={id:'auto-oc'};
      const reopen=async()=>{plugin.reservePluginExecution();try {await plugin.loadSettings();} finally {plugin.releasePluginExecution(false);}};
      await reopen();
      assert.equal(plugin.settings.workflows[0].runtimeExecution.runId,run.runId);
      assert.equal(plugin.settings.workflows[0].status,'completed');
      assert.deepEqual(plugin.settings.workflows[0].steps,config.workflows[0].steps);
      assert.equal(plugin.settings.workflows[0].steps[0].output.length,64000);
      assert.equal(fs.readFileSync(file,'utf8'),persisted);
      const resumed=cli('resume','--workflow','first','--run',run.runId);assert.equal(resumed.status,0,resumed.stderr);
      assert.equal(fs.readFileSync(journal,'utf8'),journalBefore);
      for(const change of [
        value=>{value.taskTimeoutSeconds=(settings.taskTimeoutSeconds??defaults.taskTimeoutSeconds)+1;},
        value=>{value.opencodePath='changed-opencode';},
        value=>{value.defaultModel='changed-model';},
        value=>{value.workflows[0].steps[0].code='output="changed";';},
      ]) {
        const changed=JSON.parse(persisted);change(changed);const text=JSON.stringify(changed);fs.writeFileSync(file,text);
        await reopen();
        assert.equal(plugin.settings.workflows[0].runtimeExecution.definitionHash,JSON.parse(journalBefore).definitionHash);
        assert.equal(plugin.settings.workflows[0].runtimeExecution.definitionChanged,true);
        const rejected=cli('resume','--workflow','first','--run',run.runId);
        assert.equal(rejected.status,1);assert.match(rejected.stderr,/definition changed/);
        assert.equal(fs.readFileSync(file,'utf8'),text);
        assert.equal(fs.readFileSync(journal,'utf8'),journalBefore);
        assert.equal(fs.readFileSync(path.join(root,'effect.txt'),'utf8'),'once');
      }
    }));
  }
});
async function fixture(fn) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-compat-'));
  try {await fn(root);} finally {
    assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('autooc-compat-'));fs.rmSync(root,{recursive:true,force:true});
  }
}
test('shared host executes configured Git branch and carries it across resume without recreating it',()=>fixture(async root=>{
  const git=(...args)=>execFileSync('git',['-c',`safe.directory=${root}`,...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git('init');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-m','fixture');
  const runtime=path.join(root,'runtime');fs.mkdirSync(runtime);
  const definition=prepare({id:'branch',handoffBranch:true,steps:[{id:'a',taskId:'first'},{id:'b',taskId:'second'}]},[
    {id:'first',taskKind:'code',branch:'feature',createBranch:true,code:'output=1'},
    {id:'second',taskKind:'code',branch:'ignored',code:'output=2'},
  ],{});
  const seen=[],tasks={supports:()=>true,execute:async()=>{seen.push(git('branch','--show-current'));return {succeeded:true,output:'ok'};}};
  const first=await run({definition,tasks,runtimeDirectory:runtime,vaultBase:root,maxSteps:1,redact:s=>s});
  assert.match(seen[0],/^feature-/);
  const final=await run({definition,tasks,runtimeDirectory:runtime,vaultBase:root,resumeRunId:first.runId,redact:s=>s});
  assert.equal(final.phase,'completed');assert.deepEqual(seen,[seen[0],seen[0]]);
}));
test('model routing saves the task result before evaluation and never replays it after transport loss',()=>fixture(async root=>{
  let effects=0,evaluations=0;
  const definition=prepare({id:'eval',steps:[{id:'a',taskId:'t',transitions:[{mode:'eval',toStepId:'b'}]},{id:'b',stepKind:'code',code:'output=input.length;'}]},[{id:'t'}],{});
  const options={definition,runtimeDirectory:root,vaultBase:root,redact:s=>s,
    tasks:{supports:()=>true,execute:async()=>{effects++;return {succeeded:true,output:'x'.repeat(64000)};}},
    evaluate:async()=>{evaluations++;throw Error('transport lost');}};
  await assert.rejects(run(options),/transport lost/);
  const file=fs.readdirSync(root).find(f=>f.endsWith('.json')),state=JSON.parse(fs.readFileSync(path.join(root,file)));
  assert.equal(state.steps[0].result.output.length,64000);
  await assert.rejects(run({...options,resumeRunId:state.runId}),/evaluation.*reconciliation/i);
  assert.equal(effects,1);assert.equal(evaluations,1);
}));
test('model routing preserves complete input and persists decisions for conditional continuation',()=>fixture(async root=>{
  let input;
  const definition=prepare({id:'eval',steps:[{id:'a',stepKind:'code',code:'output="z".repeat(64000)',transitions:[{mode:'eval',toStepId:'b'}]},{id:'b',stepKind:'code',code:'output=input.length;'}]},[],{});
  const result=await run({definition,runtimeDirectory:root,vaultBase:root,redact:s=>s,evaluate:async(_t,_s,value)=>{input=value;return 'YES';}});
  assert.equal(input.length,64000);assert.equal(result.steps[1].output,'64000');
  assert.equal(result.steps[0].evaluations[0].output,'YES');
}));
test('interactive Codex keeps exact identity, on-request approvals and actual completion',async()=>{
  let args,callbacks,approved,recorded=[];
  const adapter=load('codex-workflow-adapter').codexWorkflowAdapter((_task,cbs)=>{
    callbacks=cbs;
    return {run:async(...values)=>{args=values;await callbacks.onThreadCreated({threadId:'thread'});await callbacks.onStarted({threadId:'thread',turnId:'turn'});await callbacks.onApproval({requestId:7,kind:'command',summary:'fixture'});return {status:'completed',output:'done'};},
      resolveApproval:(_id,value)=>{approved=value;return true;},interrupt:async()=>{},dispose:()=>{}};
  });
  assert.equal(adapter.supports({taskKind:'codex',interactiveTerminal:true}),true);
  const result=await adapter.execute({taskKind:'codex',interactiveTerminal:true},'prompt',undefined,async(...ids)=>recorded.push(ids),{approve:async()=>false});
  assert.equal(args[3],'on-request');assert.deepEqual(recorded,[['thread'],['thread','turn']]);assert.equal(approved,false);assert.equal(result.output,'done');
});

test('public decision command answers exactly one live durable approval and preserves full output',()=>fixture(async root=>{
  const installation=path.join(root,'.obsidian/plugins/auto-oc'),runtime=path.join(installation,'runtime');fs.mkdirSync(runtime,{recursive:true});
  const workflow={id:'gate',name:'Gate',steps:[{id:'a',taskId:'t'}]},task={id:'t',name:'Task',taskKind:'codex',interactiveTerminal:true,prompt:'fixture'};
  const config={tasks:[task],workflows:[workflow]},definition=prepare(workflow,[task],config);
  const file=path.join(installation,'data.json');fs.writeFileSync(file,JSON.stringify(config));
  const call=(...args)=>require('node:child_process').spawnSync(process.execPath,[path.resolve(__dirname,'../autooc-cli.cjs'),...args],{encoding:'utf8',timeout:10000});
  let decisions=0,accepted;
  const tasks={supports:()=>true,execute:async(_task,_prompt,signal,record,interaction)=>{
    await record('thread','turn');accepted=await interaction.approve({requestId:1,kind:'command',summary:'fixture gate'},signal);
    return {succeeded:true,output:'y'.repeat(64000)};
  }};
  const result=await run({definition,tasks,runtimeDirectory:runtime,vaultBase:root,redact:s=>s,onCheckpoint:async checkpoint=>{
    await load('workflow-catalog-progress').persistWorkflowProgress({configurationFile:file,runtimeDirectory:runtime,checkpoint,expectedRunId:checkpoint.runId});
    const pending=checkpoint.steps.slice(-1)[0]?.approval;if(!pending)return;
    decisions++;
    const status=call('status','--vault',root);assert.equal(status.status,0,status.stderr);
    assert.equal(JSON.parse(status.stdout).executions[0].pendingApproval.token,pending.token);
    assert.equal(JSON.parse(fs.readFileSync(file)).tasks[0].pendingCodexApproval.requestId,pending.token);
    assert.equal(call('approve','--vault',root,'--run',checkpoint.runId,'--approval','bad').status,1);
    const answer=call('deny','--vault',root,'--run',checkpoint.runId,'--approval',pending.token);assert.equal(answer.status,0,answer.stderr);
    assert.equal(call('approve','--vault',root,'--run',checkpoint.runId,'--approval',pending.token).status,1);
  }});
  assert.equal(accepted,false);assert.equal(decisions,1);assert.equal(result.phase,'completed');assert.equal(result.steps[0].output.length,64000);
  assert.equal(JSON.parse(fs.readFileSync(file)).tasks[0].pendingCodexApproval,undefined);
}));

test('aborting an approval preserves uncertainty and stops waiting without granting permission',()=>fixture(async root=>{
  const definition=prepare({id:'w',steps:[{id:'a',taskId:'t'}]},[{id:'t'}],{}),controller=new AbortController();
  let granted=false;
  await assert.rejects(run({definition,runtimeDirectory:root,vaultBase:root,signal:controller.signal,redact:s=>s,
    tasks:{supports:()=>true,execute:async(_t,_p,signal,_record,interaction)=>{granted=await interaction.approve({requestId:1,kind:'command',summary:'fixture'},signal);return {succeeded:true,output:'bad'};}},
    onCheckpoint:async state=>{if(state.steps.slice(-1)[0]?.approval)controller.abort();}}),/Approval interrupted/);
  assert.equal(granted,false);
  const state=JSON.parse(fs.readFileSync(path.join(root,fs.readdirSync(root).find(f=>f.endsWith('.json')))));
  assert.equal(state.phase,'in_flight');assert.ok(state.steps[0].approval);assert.equal(state.steps[0].result,undefined);
}));

test('resume uses persisted task and evaluation outcomes without repeating either effect',()=>fixture(async root=>{
  const {acquireExecutionLease}=load('execution-lease'),{ExecutionJournal}=load('execution-journal');
  const definition=prepare({id:'w',steps:[{id:'a',taskId:'t',transitions:[{mode:'eval',toStepId:'b'}]},{id:'b',stepKind:'code',code:'output=input.length'}]},[{id:'t'}],{});
  const lease=acquireExecutionLease(root),journal=await ExecutionJournal.create(lease,'w',definition.hash,'a');
  await journal.begin('a');await journal.recordResult({succeeded:true,output:'z'.repeat(64000)});await journal.recordEvaluation('0');await journal.recordEvaluation('0','YES');lease.release();
  const result=await run({definition,runtimeDirectory:root,vaultBase:root,resumeRunId:journal.snapshot().runId,redact:s=>s,
    tasks:{supports:()=>true,execute:async()=>{throw Error('must not replay task');}},evaluate:async()=>{throw Error('must not replay evaluation');}});
  assert.equal(result.phase,'completed');assert.equal(result.steps[1].output,'64000');
}));

test('reconcile a task before model routing is read-only; explicit resume performs evaluation once',()=>fixture(async root=>{
  const {acquireExecutionLease}=load('execution-lease'),{ExecutionJournal}=load('execution-journal');
  const definition=prepare({id:'w',steps:[{id:'a',taskId:'t',transitions:[{mode:'eval',toStepId:'b'}]},{id:'b',stepKind:'code',code:'output=input'}]},[{id:'t'}],{});
  const lease=acquireExecutionLease(root),journal=await ExecutionJournal.create(lease,'w',definition.hash,'a');
  await journal.begin('a');await journal.recordCodexThread('a','thread','turn');lease.release();
  let evals=0;
  const options={definition,runtimeDirectory:root,vaultBase:root,resumeRunId:journal.snapshot().runId,redact:s=>s,
    tasks:{supports:()=>true,execute:async()=>{throw Error('must not replay');},reconcile:async()=>({threadId:'thread',turnId:'turn',status:'completed',output:'observed'})},evaluate:async()=>{evals++;return 'YES';}};
  const reconciled=await run({...options,reconcile:true});assert.equal(evals,0);assert.equal(reconciled.steps[0].result.output,'observed');
  const result=await run(options);assert.equal(result.phase,'completed');assert.equal(evals,1);assert.equal(result.steps[1].output,'observed');
}));

test('evaluation adapter sends the entire output and configured model through the shared launcher',async()=>{
  let captured;
  const injected=loader({'cli-workflow-adapters':{createOpenCodeWorkflowAdapter:()=>({execute:async(...args)=>{captured=args;return {succeeded:true,output:'NO'};}})}});
  const evaluator=injected('workflow-evaluation').createWorkflowEvaluator({settings:{defaultModel:'fixture/model',defaultAgent:'plan',workingDirectory:process.cwd()}},process.cwd());
  assert.equal(await evaluator({evaluatePrompt:'Only continue on success'}, {}, 'q'.repeat(64000)),'NO');
  assert.equal(captured[0].model,'fixture/model');assert.equal(captured[0].agent,'plan');assert.ok(captured[1].includes('q'.repeat(64000)));
});

test('plugin and distributed CLI execute the same branching definition and retain catalog results',()=>fixture(async root=>{
  const git=(...args)=>execFileSync('git',['-c',`safe.directory=${root}`,...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git('init');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-m','fixture');
  const directory=path.join(root,'.obsidian/plugins/auto-oc');fs.mkdirSync(directory,{recursive:true});
  const file=path.join(directory,'data.json');
  const task={id:'code',name:'Code',taskKind:'code',branch:'feature',createBranch:true,code:'output="x".repeat(64000)'};
  const workflow={id:'shared',name:'Shared',handoffBranch:true,steps:[{id:'a',taskId:'code'},{id:'b',stepKind:'code',code:'output=input.length',transitions:[{toStepId:'c',mode:'conditional',condition:'Number(input)>64000'}]},{id:'c',stepKind:'code',code:'throw Error("deliberate")'}]};
  fs.writeFileSync(file,JSON.stringify({tasks:[task],workflows:[workflow]}));
  const original=Module._load;let Plugin;
  try {
    Module._load=function(id,...args){if(id==='obsidian')return {Plugin:class{},Notice:class{},Modal:class{},Setting:class{},ItemView:class{},PluginSettingTab:class{},WorkspaceLeaf:class{}};return original.call(this,id,...args);};
    Plugin=require('../main.js').default;
  } finally {Module._load=original;}
  const plugin=new Plugin();plugin.app={vault:{adapter:{basePath:root},configDir:'.obsidian'}};plugin.manifest={id:'auto-oc'};
  try {
    plugin.app.workspace={getLeavesOfType:()=>[]};
    plugin.reservePluginExecution();await plugin.loadSettings();await plugin.runWorkflow(plugin.settings.workflows[0]);
    const first=JSON.parse(fs.readFileSync(file)).workflows[0];assert.equal(first.status,'failed');
    assert.match(git('branch','--show-current'),/^feature-/);assert.equal(first.steps[0].output.length,64023);
    plugin.releasePluginExecution(false);
    const cli=require('node:child_process').spawnSync(process.execPath,[path.resolve(__dirname,'../autooc-cli.cjs'),'run','--vault',root,'--workflow','shared'],{encoding:'utf8',timeout:15000});
    assert.equal(cli.status,1,cli.stderr);assert.equal(JSON.parse(cli.stdout).phase,'failed');
    const second=JSON.parse(fs.readFileSync(file)).workflows[0];
    assert.deepEqual(second.steps.map(s=>[s.status,s.output]),first.steps.map(s=>[s.status,s.output]));
    assert.notEqual(second.runtimeExecution.runId,first.runtimeExecution.runId);
    plugin.reservePluginExecution();await plugin.loadSettings();assert.equal(plugin.settings.workflows[0].runtimeExecution.runId,second.runtimeExecution.runId);
  } finally {plugin.releasePluginExecution(false);}
}));

test('branch preflight rejects invalid names and repositories outside the selected vault before Code effects',()=>fixture(async root=>{
  const git=(...args)=>execFileSync('git',['-c',`safe.directory=${root}`,...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  git('init');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-m','fixture');
  const nested=path.join(root,'vault');fs.mkdirSync(nested);
  const {preflightInstalledWorkflow}=load('workflow-preflight');
  const definition=prepare({id:'w',steps:[{id:'a',taskId:'t'}]},[{id:'t',taskKind:'code',branch:'feature'}],{});
  assert.throws(()=>preflightInstalledWorkflow(definition,nested),/outside the selected vault/);
  for(const branch of ['--orphan','@{-1}','name with spaces','x;echo bad',123]) {
    const invalid=prepare(definition.workflow,[{id:'t',taskKind:'code',branch}],{});
    assert.throws(()=>preflightInstalledWorkflow(invalid,root),/branch/i);
  }
}));

test('interactive opt-in must be boolean and an interrupted Codex result never follows a forced transition',()=>fixture(async root=>{
  const {preflightInstalledWorkflow}=load('workflow-preflight');
  const task={id:'t',taskKind:'codex',prompt:'fixture',interactiveTerminal:'false'};
  const workflow={id:'w',steps:[{id:'a',taskId:'t',transitions:[{toStepId:'b',mode:'force'}]},{id:'b',stepKind:'code',code:'output="must not execute"'}]};
  assert.throws(()=>preflightInstalledWorkflow(prepare(workflow,[task],{}),root),/must be boolean/);
  const tasks=load('codex-workflow-adapter').codexWorkflowAdapter(()=>({run:async()=>({status:'interrupted',output:'cancelled'}),interrupt:async()=>{},dispose:()=>{}}));
  assert.equal(tasks.supports(task),false);
  const result=await run({definition:prepare(workflow,[{...task,interactiveTerminal:false}],{}),tasks,runtimeDirectory:root,vaultBase:root,redact:s=>s});
  assert.equal(result.phase,'failed');assert.equal(result.steps.length,1);assert.equal(result.steps[0].result.cancelled,true);
}));
