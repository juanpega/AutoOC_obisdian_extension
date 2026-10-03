const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const cli = path.resolve(__dirname, '../autooc-cli.cjs');
const call = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

test('public lease recovery keeps an in-flight journal blocked and does not repeat effects',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-cli-recover-'));
  try {
    const folder=path.join(root,'.obsidian/plugins/auto-oc'),runtime=path.join(folder,'runtime');
    fs.mkdirSync(runtime,{recursive:true});
    fs.writeFileSync(path.join(folder,'data.json'),JSON.stringify({tasks:[],workflows:[{id:'w',name:'Workflow',steps:[{id:'code',stepKind:'code',codeAllowVault:true,code:'vault.append("effects.txt","bad");'}]}]}));
    const child=spawnSync(process.execPath,['-e',`const fs=require('fs'),path=require('path'),crypto=require('crypto');const dir=process.argv[1];fs.mkdirSync(path.join(dir,'execution.lock'));fs.writeFileSync(path.join(dir,'execution.lock','owner.json'),JSON.stringify({schemaVersion:1,token:crypto.randomUUID(),pid:process.pid,createdAt:new Date().toISOString()}));`,runtime],{encoding:'utf8'});
    assert.equal(child.status,0,child.stderr);
    const state={schemaVersion:1,runId:'aa11',workflowId:'w',definitionHash:'a'.repeat(64),revision:1,phase:'in_flight',nextStepId:'code',steps:[{stepId:'code',status:'in_flight'}]};
    const original=JSON.stringify(state);fs.writeFileSync(path.join(runtime,'aa11.json'),original);
    const observed=JSON.parse(call('status','--vault',root).stdout);
    const recovered=call('recover-lease','--vault',root,'--owner',observed.executionOwner.token);
    assert.equal(recovered.status,0,recovered.stderr);assert.equal(JSON.parse(recovered.stdout).executionsResumed,false);
    assert.equal(fs.readFileSync(path.join(runtime,'aa11.json'),'utf8'),original);
    const next=call('run','--vault',root,'--workflow','w');assert.equal(next.status,1);assert.match(next.stderr,/continuation or reconciliation/);
    assert.ok(!fs.existsSync(path.join(root,'effects.txt')));
  } finally {
    assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('autooc-cli-recover-'));fs.rmSync(root,{recursive:true});
  }
});

test('preflight rejects an unauthorized task directory and deferred store dependency before earlier Code effects', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-preflight-'));
  try {
    const folder=path.join(root,'.obsidian/plugins/auto-oc');fs.mkdirSync(folder,{recursive:true});
    const file=path.join(folder,'data.json');
    const config={tasks:[{id:'t',name:'Task',taskKind:'code',code:'output="safe";',workingDirectory:os.tmpdir()}],workflows:[{id:'w',name:'Workflow',steps:[{id:'first',stepKind:'code',codeAllowVault:true,code:'vault.write("must-not-exist.txt","bad");'},{id:'task',stepKind:'task',taskId:'t'}]}]};
    for (const kind of ['directory','store']) {
      if(kind==='store') {delete config.tasks[0].workingDirectory;config.tasks[0].requiresAutoOCSecrets=true;}
      const original=JSON.stringify(config);fs.writeFileSync(file,original);
      const result=call('run','--vault',root,'--workflow','w');
      assert.equal(result.status,1);assert.match(result.stderr,kind==='store'?/secret store is unavailable/:/outside the selected vault/);
      assert.equal(fs.readFileSync(file,'utf8'),original);
      assert.ok(!fs.existsSync(path.join(root,'must-not-exist.txt')));
      assert.ok(!fs.existsSync(path.join(folder,'runtime')));
    }
  } finally {
    assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('autooc-preflight-'));
    fs.rmSync(root,{recursive:true});
  }
});

test('standalone task uses a durable identity and never inserts a workflow or repeats terminal effects', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'autooc-single-task-'));
  try {
    const folder = path.join(root, '.obsidian/plugins/auto-oc');
    fs.mkdirSync(folder, {recursive:true});
    const file = path.join(folder, 'data.json');
    fs.writeFileSync(file, JSON.stringify({custom:'preserved',tasks:[{id:'single',name:'Single',taskKind:'code',codeAllowVault:true,code:'vault.append("effect.txt","once"); output="task result";'}],workflows:[]}));
    const first = call('run','--vault',root,'--task','single');
    assert.equal(first.status,0,first.stderr);
    const state = JSON.parse(first.stdout);
    assert.equal(state.phase,'completed');
    const resumed = call('resume','--vault',root,'--task','single','--run',state.runId);
    assert.equal(resumed.status,0,resumed.stderr);
    assert.equal(JSON.parse(resumed.stdout).runId,state.runId);
    assert.equal(fs.readFileSync(path.join(root,'effect.txt'),'utf8'),'once');
    let config=JSON.parse(fs.readFileSync(file,'utf8'));
    assert.deepEqual(config.workflows,[]);
    assert.equal(config.custom,'preserved');
    assert.equal(config.tasks[0].runtimeExecution.runId,state.runId);
    assert.match(config.tasks[0].output,/task result/);
    assert.equal(call('run','--vault',root,'--task','single','--workflow','wrong').status,1);
    assert.equal(call('resume','--vault',root,'--workflow',state.workflowId,'--run',state.runId).status,1);
    const second=call('run','--vault',root,'--task','single');
    assert.equal(second.status,0,second.stderr);
    assert.notEqual(JSON.parse(second.stdout).runId,state.runId);
    assert.equal(fs.readFileSync(path.join(root,'effect.txt'),'utf8'),'onceonce');
    assert.equal(call('resume','--vault',root,'--task','single','--run',state.runId).status,1);
  } finally {
    assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('autooc-single-task-'));
    fs.rmSync(root,{recursive:true});
  }
});

test('bundled CLI reads metadata without execution, mutations or secret output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'autooc-cli-'));
  try {
    const folder = path.join(root, '.obsidian/plugins/auto-oc');
    fs.mkdirSync(folder, { recursive: true });
    const file = path.join(folder, 'data.json');
    const original = JSON.stringify({ secret: 'DO_NOT_PRINT', tasks: [{ id: 't', name: 'Task', status: 'running', prompt: 'DO_NOT_PRINT', output: 'DO_NOT_PRINT' }], workflows: [] });
    fs.writeFileSync(file, original);
    const result = call('status', '--vault', root);
    assert.equal(result.status, 0, result.stderr);
    const data = JSON.parse(result.stdout);
    assert.equal(data.activityVerified, false);
    assert.equal(data.tasks[0].recordedStatus, 'running');
    assert.ok(!result.stdout.includes('DO_NOT_PRINT'));
    assert.equal(call('run', '--vault', root).status, 1);
    assert.equal(fs.readFileSync(file, 'utf8'), original);
    assert.deepEqual(fs.readdirSync(folder), ['data.json']);
    fs.writeFileSync(file, '{DO_NOT_PRINT');
    const malformed = call('list', '--vault', root);
    assert.equal(malformed.status, 1);
    assert.ok(!malformed.stderr.includes('DO_NOT_PRINT'));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('CLI requires explicit vault and reports experimental build version', () => {
  assert.equal(call('list').status, 1);
  assert.equal(call('list', '--vault', '.').status, 1);
  const result = JSON.parse(call('version').stdout);
  assert.equal(result.version, require('../manifest.json').version);
  assert.equal(result.experimental, true);
});

test('CLI status reads durable checkpoints without exposing outputs or claiming live activity',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-cli-journal-'));
  try {
    const folder=path.join(root,'.obsidian/plugins/auto-oc'),runtime=path.join(folder,'runtime');
    fs.mkdirSync(runtime,{recursive:true});fs.writeFileSync(path.join(folder,'data.json'),JSON.stringify({tasks:[],workflows:[]}));
    const runId='a123-456',file=path.join(runtime,runId+'.json');
    const state={schemaVersion:1,runId,workflowId:'wf',definitionHash:'a'.repeat(64),revision:1,phase:'in_flight',nextStepId:'two',steps:[{stepId:'one',status:'completed',output:'PRIVATE_OUTPUT'},{stepId:'two',status:'in_flight',codexThreadId:'PRIVATE_THREAD'}]};
    const text=JSON.stringify(state);fs.writeFileSync(file,text);fs.mkdirSync(path.join(runtime,'execution.lock'));
    const result=call('status','--vault',root);assert.equal(result.status,0,result.stderr);
    const data=JSON.parse(result.stdout);assert.equal(data.activityVerified,false);assert.equal(data.executionLockPresent,true);
    assert.deepEqual(data.executions,[{runId,workflowId:'wf',phase:'in_flight',revision:1,nextStepId:'two',completedSteps:1,failedSteps:0,requiresReconciliation:true}]);
    assert.ok(!result.stdout.includes('PRIVATE_'));assert.equal(fs.readFileSync(file,'utf8'),text);
    assert.equal(JSON.parse(call('list','--vault',root).stdout).executions,undefined);
    fs.writeFileSync(file,'{PRIVATE_INVALID');const bad=call('status','--vault',root);assert.equal(bad.status,1);assert.ok(!bad.stderr.includes('PRIVATE_INVALID'));assert.equal(bad.stdout,'');
  } finally {
    assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('autooc-cli-journal-'));
    fs.rmSync(root,{recursive:true});
  }
});

test('CLI runs the installed workflow and resumes its terminal identity without repeating effects',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-cli-exec-'));
  try {
    const folder=path.join(root,'.obsidian','plugins','auto-oc');fs.mkdirSync(folder,{recursive:true});
    fs.writeFileSync(path.join(folder,'data.json'),JSON.stringify({tasks:[],workflows:[{id:'cli-run',name:'CLI fixture',steps:[{id:'one',stepKind:'code',codeAllowVault:true,code:'vault.append("effect.txt","one"); output="PRIVATE_RESULT";'}]}]}));
    const first=call('run','--vault',root,'--workflow','cli-run');assert.equal(first.status,0,first.stderr);
    assert.ok(!first.stdout.includes('PRIVATE_RESULT'));const state=JSON.parse(first.stdout);assert.equal(state.phase,'completed');
    const resumed=call('resume','--vault',root,'--workflow','cli-run','--run',state.runId);assert.equal(resumed.status,0,resumed.stderr);
    assert.equal(JSON.parse(resumed.stdout).runId,state.runId);assert.equal(fs.readFileSync(path.join(root,'effect.txt'),'utf8'),'one');
    const status=JSON.parse(call('status','--vault',root).stdout);assert.equal(status.executions[0].runId,state.runId);assert.equal(status.workflows[0].recordedStatus,'completed');
    const repeated=call('run','--vault',root,'--workflow','cli-run');assert.equal(repeated.status,0,repeated.stderr);
    assert.notEqual(JSON.parse(repeated.stdout).runId,state.runId);assert.equal(fs.readFileSync(path.join(root,'effect.txt'),'utf8'),'oneone');
    assert.equal(call('resume','--vault',root,'--workflow','cli-run').status,1);
  } finally {
    assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('autooc-cli-exec-'));
    fs.rmSync(root,{recursive:true});
  }
});
