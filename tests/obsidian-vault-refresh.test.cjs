const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function source(name) {
  const file = path.resolve(__dirname, '..', name + '.ts');
  const m = new Module(file, module);
  m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file));
  const originalRequire = m.require.bind(m);
  m.require = id => id.startsWith('./') ? source(id.slice(2)) : originalRequire(id);
  m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
  }).outputText, file);
  return m.exports;
}
const {ObsidianVaultRefresh} = source('obsidian-vault-refresh');
const {runWithVaultMutations} = source('code-vault-mutations');
const {executeCode} = source('code-runtime');
const runtime = require('../autooc-runtime.cjs');
const originalLoad = Module._load;
let Plugin;
try {
  Module._load = function(name, ...args) {
    if (name === 'obsidian') return Object.fromEntries(['Plugin','Notice','Modal','Setting','ItemView','PluginSettingTab','WorkspaceLeaf'].map(key => [key, class {}]));
    return originalLoad.call(this, name, ...args);
  };
  Plugin = require('../main.js').default;
} finally { Module._load = originalLoad; }

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'autooc-refresh-'));
  // Delete only this test's freshly created temporary directory.
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  return root;
}
function execute(root, code, onVaultMutation, extra = {}) {
  return executeCode({vaultBase:root, cwd:root, codeAllowVault:true, code, onVaultMutation, ...extra});
}
function adapter(root, reconcile = async () => {}) {
  let tail = Promise.resolve();
  return {basePath:root, queue(job) { const next = tail.then(job); tail = next.catch(() => {}); return next; }, reconcileInternalFile:reconcile};
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('Windows 8.3 refresh reconciles real long and short paths without replaying writes', {skip:process.platform!=='win32'}, async t => {
  const temporary=fixture(t), root=path.join(temporary,'Vault with long name');
  fs.mkdirSync(root);
  const long=fs.realpathSync.native(root);
  const short=require('node:child_process').execFileSync('cmd.exe',['/d','/c','for %I in (.) do @echo %~fsI'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();
  assert.notEqual(short,long); assert.equal(fs.realpathSync.native(short),long);
  for (const selected of [long,short]) for (const writer of [long,short]) {
    const seen=[], relative=`Long notes folder/note ${seen.length}.md`;
    const refresh=new ObsidianVaultRefresh(selected,adapter(selected,async rel=>seen.push(rel)));
    const before=fs.existsSync(path.join(root,relative))?fs.readFileSync(path.join(root,relative),'utf8'):'';
    const batch=refresh.createBatch();
    execute(writer,`vault.append(${JSON.stringify(relative)}, "once");`,batch.record);
    const stat=fs.statSync(path.join(root,relative));
    await batch.flush(); await batch.flush();
    assert.deepEqual(seen,[relative]);
    assert.equal(fs.readFileSync(path.join(root,relative),'utf8'),before+'once');
    assert.equal(fs.statSync(path.join(root,relative)).mtimeMs,stat.mtimeMs);
  }
  const outside=path.join(temporary,'outside');fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'note.md'),'unchanged');
  const inside=path.join(root,'Long notes folder');
  for (const target of [inside,outside]) {
    const link=path.join(root,target===inside?'inside-link':'outside-link');fs.symlinkSync(target,link,'junction');
    const seen=[], refresh=new ObsidianVaultRefresh(short,adapter(short,async rel=>seen.push(rel)));
    for (const file of [path.join(short,path.basename(link),'note.md'),short+'\\'+path.basename(link)+'\\..\\Long notes folder\\note 0.md',path.join(outside,'note.md')]) {
      const batch=refresh.createBatch();batch.record({path:file,operation:'write'});
      await assert.rejects(batch.flush(),/Linked refresh|Refresh path escapes vault|Invalid refresh/);
      assert.deepEqual(seen,[]);
    }
  }
  assert.equal(fs.readFileSync(path.join(outside,'note.md'),'utf8'),'unchanged');
});

test('observer reports completed vault writes synchronously, without content or sandbox access', t => {
  const root = fixture(t), mutations = [];
  // Keep the lexical root as input so a temporary-directory alias is exercised.
  const canonicalRoot = fs.realpathSync(root);
  const output = execute(root, 'const p=vault.write("Nueva carpeta/á nota.md", "uno"); vault.append("Nueva carpeta/á nota.md", " dos"); output=JSON.stringify([p,vault.read("Nueva carpeta/á nota.md"),typeof onVaultMutation]);', m => mutations.push(m));
  assert.deepEqual(JSON.parse(output), [path.join(canonicalRoot,'Nueva carpeta/á nota.md'),'uno dos','undefined']);
  assert.deepEqual(mutations, ['write','append'].map(operation => ({path:path.join(canonicalRoot,'Nueva carpeta/á nota.md'),operation})));
  execute(root, 'files.write("files.md", "other"); files.append("files.md", "!");', m => mutations.push(m), {codeAllowFiles:true});
  assert.equal(mutations.length, 2);
});

test('write/append/mkdir failures and rejected outside or linked paths never notify', t => {
  const root = fixture(t), mutations = [];
  fs.mkdirSync(path.join(root,'directory')); fs.writeFileSync(path.join(root,'file'),'block');
  const outside = path.join(root,'outside'), vault = path.join(root,'vault');
  fs.mkdirSync(outside); fs.mkdirSync(vault);
  fs.symlinkSync(outside,path.join(vault,'link'),process.platform==='win32'?'junction':'dir');
  for (const method of ['write','append']) {
    for (const file of ['directory','file/child.md','../escape.md',path.join(os.tmpdir(),'escape-refresh.md')]) {
      assert.throws(() => execute(root, `vault.${method}(${JSON.stringify(file)}, "bad");`, m => mutations.push(m)));
    }
    assert.throws(() => execute(vault, `vault.${method}("link/note.md", "bad");`, m => mutations.push(m)), /Linked vault/);
  }
  assert.deepEqual(mutations, []); assert.deepEqual(fs.readdirSync(outside), []);
});

test('batch deduplicates, reads latest state and preserves bytes and timestamps without rewriting', async t => {
  const root = fixture(t), seen = [];
  const refresh = new ObsidianVaultRefresh(root, adapter(root, async relative => seen.push([relative,fs.readFileSync(path.join(root,relative),'utf8')])));
  const batch = refresh.createBatch();
  const relative = path.join('Nueva carpeta','á nota.md'), file = path.join(root,relative);
  execute(root, `vault.write(${JSON.stringify(relative)}, "a"); vault.append(${JSON.stringify(relative)}, "b"); vault.append(${JSON.stringify(relative)}, "c");`, batch.record);
  fs.writeFileSync(file,'human edit');
  const before = fs.statSync(file);
  await batch.flush(); await batch.flush();
  assert.deepEqual(seen, [['Nueva carpeta/á nota.md','human edit']]);
  const after = fs.statSync(file);
  assert.equal(after.mtimeMs,before.mtimeMs); assert.equal(after.ctimeMs,before.ctimeMs);
  assert.equal(fs.readFileSync(file,'utf8'),'human edit');
});

test('refresh is awaited on partial failure and keeps original error primary', async t => {
  const root=fixture(t), seen=[];
  const refresh = new ObsidianVaultRefresh(root, adapter(root, async rel => seen.push(rel)));
  await assert.rejects(runWithVaultMutations(()=>refresh.createBatch(), record=>execute(root,'vault.append("partial.md", "once"); throw Error("original");',record)), /original/);
  assert.deepEqual(seen,['partial.md']); assert.equal(fs.readFileSync(path.join(root,'partial.md'),'utf8'),'once');
  const bad = new ObsidianVaultRefresh(root, adapter(root, async()=>{throw Error('refresh failure');}));
  await assert.rejects(runWithVaultMutations(()=>bad.createBatch(), record=>execute(root,'vault.append("partial.md", "!"); throw Error("script failure");',record)), error=> {
    assert.match(error.message,/script failure.*persisted.*refresh failure/); assert.match(String(error.cause),/script failure/); return true;
  });
  assert.equal(fs.readFileSync(path.join(root,'partial.md'),'utf8'),'once!');
});

test('missing capability fails only after mutations; read-only and headless code remain compatible', async t => {
  const root=fixture(t), refresh=new ObsidianVaultRefresh(root, {});
  assert.equal(await runWithVaultMutations(()=>refresh.createBatch(), record=>execute(root,'output="read only";',record)), 'read only');
  await assert.rejects(runWithVaultMutations(()=>refresh.createBatch(), record=>execute(root,'vault.write("saved.md", "saved");',record)), /persisted.*unavailable/);
  assert.equal(fs.readFileSync(path.join(root,'saved.md'),'utf8'),'saved');
  assert.equal(await runWithVaultMutations(undefined, record=>execute(root,'vault.append("saved.md", "!"); output=vault.read("saved.md");',record)), 'saved!');
});

test('timeout and unload settle waiters and prevent late queued callbacks from reconciling', async t => {
  const root=fixture(t);
  for (const mode of ['timeout','unload']) {
    let job, calls=0;
    const refresh=new ObsidianVaultRefresh(root,{queue:fn=>{job=fn;return new Promise(()=>{});},reconcileInternalFile:async()=>{calls++;}},20);
    const pending=runWithVaultMutations(()=>refresh.createBatch(), record=>execute(root,'vault.write("saved.md", "saved");',record));
    const rejected=assert.rejects(pending, mode==='timeout'?/timed out/:/unloaded/);
    await tick(); if (mode==='unload') refresh.dispose();
    await rejected; await job(); assert.equal(calls,0);
  }
});

test('refresh rechecks links at flush and leaves hidden paths to normal Obsidian handling', async t => {
  const root=fixture(t), calls=[], refresh=new ObsidianVaultRefresh(root,adapter(root,async rel=>calls.push(rel)));
  const batch=refresh.createBatch();
  execute(root,'vault.write(".hidden/note.md", "hidden");',batch.record);
  await batch.flush(); assert.deepEqual(calls,[]);
  const external=path.join(root,'external'), folder=path.join(root,'notes'); fs.mkdirSync(external);
  const next=refresh.createBatch(); execute(root,'vault.write("notes/note.md", "saved");',next.record);
  fs.unlinkSync(path.join(folder,'note.md')); fs.rmdirSync(folder);
  fs.symlinkSync(external,folder,process.platform==='win32'?'junction':'dir');
  await assert.rejects(next.flush(),/Linked refresh/); assert.deepEqual(calls,[]);
});

test('concurrent batches serialize through adapter queue and tolerate an earlier watcher reconciliation', async t => {
  const root=fixture(t), order=[]; let release;
  const a=adapter(root, async rel=>{order.push('start:'+rel);if(rel==='one.md')await new Promise(resolve=>{release=resolve;});order.push('end:'+rel);});
  const refresh=new ObsidianVaultRefresh(root,a);
  const first=runWithVaultMutations(()=>refresh.createBatch(),r=>execute(root,'vault.write("one.md","1");',r));
  const second=runWithVaultMutations(()=>refresh.createBatch(),r=>execute(root,'vault.write("two.md","2");',r));
  await tick(); assert.deepEqual(order,['start:one.md']); release(); await Promise.all([first,second]);
  assert.deepEqual(order,['start:one.md','end:one.md','start:two.md','end:two.md']);
  await a.queue(()=>a.reconcileInternalFile('two.md'));
  assert.equal(fs.readFileSync(path.join(root,'two.md'),'utf8'),'2');
});

test('an adapter queue cannot report success by swallowing errors or omitting its callback', async t => {
  const root=fixture(t);
  for(const queue of [job=>job().catch(()=>{}), async()=>{}]) {
    const refresh=new ObsidianVaultRefresh(root,{queue,reconcileInternalFile:async()=>{throw Error('rejected');}});
    await assert.rejects(runWithVaultMutations(()=>refresh.createBatch(),r=>execute(root,'vault.write("saved.md","saved");',r)), /persisted.*(rejected|did not confirm)/);
  }
});

test('classic callbacks cannot complete a stopped task or replacement workflow after refresh', async t => {
  const root=fixture(t);
  for(const kind of ['task','step']) {
    let release, completions=0;
    const p=new Plugin();p.app={vault:{adapter:adapter(root,()=>new Promise(resolve=>{release=resolve;}))}};p.saveSettings=async()=>{};
    const item={id:'code',name:'Code',status:'running',scheduleType:'once',codeAllowVault:true,code:'vault.write("late.md","saved");'};
    p.settings={tasks:[item],logsEnabled:false};p.completeStep=async()=>{completions++;};
    p.workflowRuntime=new Map([['wf',{stepOutputs:new Map()}]]);
    const pending=kind==='task'?p.runCodeTask(item,async()=>{completions++;}):p.runCodeStep({id:'wf',name:'WF'},item,0);
    await tick();
    if(kind==='task') await p.killTask(item.id,p.taskStopIdentity(item));
    else p.workflowRuntime.set('wf',{stepOutputs:new Map()});
    release();await pending;assert.equal(completions,0);
    if(kind==='task')assert.equal(item.status,'failed');
    else assert.equal(p.workflowRuntime.get('wf').stepOutputs.size,0);
  }
});

test('plugin unload cancels pending refresh and preserves uncertain state without later Code writes', async t => {
  const root=fixture(t),p=new Plugin();let job,saves=0;
  p.app={vault:{adapter:{basePath:root,queue:fn=>{job=fn;return new Promise(()=>{});},reconcileInternalFile:async()=>{throw Error('late refresh');}}},workspace:{detachLeavesOfType:()=>{}}};
  p.saveSettings=async()=>{saves++;};p.stopMcpBridge=async()=>{};
  const task={id:'code',name:'Code',scheduleType:'once',codeAllowVault:true,code:'vault.append("unload.md","once");'};
  p.settings={tasks:[task],workflows:[],logsEnabled:false};
  const pending=p.runCodeTask(task);await tick();const before=JSON.stringify(task),savedBefore=saves;
  await p.onunload();await pending;
  // A late completion cannot rewrite the evidence or present an unobserved
  // refresh as a finished effect after the instance has stopped.
  assert.equal(JSON.stringify(task),before);assert.equal(task.status,'running');
  assert.equal(saves,savedBefore);
  await job();await assert.rejects(p.runCodeTask(task),/instance is stopped/);
  assert.equal(JSON.stringify(task),before);assert.equal(saves,savedBefore);
  assert.equal(fs.readFileSync(path.join(root,'unload.md'),'utf8'),'once');
});

test('built classic task and step wait for refresh, including partial script failures', async t => {
  const root=fixture(t);
  for (const kind of ['task','step']) for (const fails of [false,true]) {
    let release, settled=false;
    const p=new Plugin();p.app={vault:{adapter:adapter(root,()=>new Promise(resolve=>{release=resolve;}))}};p.saveSettings=async()=>{};
    const item={id:'code',name:'Code',scheduleType:'once',codeAllowVault:true,code:'vault.write("classic.md","saved");'+(fails?'throw Error("partial");':'output="done";')};
    p.settings={tasks:[item],logsEnabled:false};
    p.workflowRuntime=new Map([['wf',{stepOutputs:new Map()}]]);
    let success;p.completeStep=async(_wf,_step,_index,ok)=>{success=ok;};
    const pending=(kind==='task'?p.runCodeTask(item,async(_task,exit)=>{success=exit===0;}):p.runCodeStep({id:'wf',name:'WF'},item,0)).then(()=>{settled=true;});
    await tick(); assert.equal(settled,false); assert.equal(fs.readFileSync(path.join(root,'classic.md'),'utf8'),'saved');
    release();await pending;assert.equal(success,!fails);
  }
});

test('built plugin shared hosts refresh direct steps, referenced tasks and standalone tasks before completion', async t => {
  for (const kind of ['step','referenced','standalone']) {
    const root=fixture(t), install=path.join(root,'.obsidian/plugins/auto-oc');fs.mkdirSync(install,{recursive:true});
    const task={id:'task',name:'Code',taskKind:'code',codeAllowVault:true,code:'vault.append("shared.md", "once"); output="done";'};
    const step=kind==='step'?{...task,id:'step',stepKind:'code'}:{id:'step',stepKind:'task',taskId:task.id};
    fs.writeFileSync(path.join(install,'data.json'),JSON.stringify({tasks:[task],workflows:[{id:'wf',name:'WF',steps:[step]}]}));
    let release, settled=false;
    const p=new Plugin();p.app={vault:{adapter:adapter(root,()=>new Promise(resolve=>{release=resolve;})),configDir:'.obsidian'},workspace:{getLeavesOfType:()=>[]}};p.manifest={id:'auto-oc'};
    p.reservePluginExecution();
    try {
      await p.loadSettings();
      const pending=p.runSharedWorkflow(kind==='standalone'?'task:task':'wf',undefined,false,false,kind==='standalone'?'task':undefined).then(r=>{settled=true;return r;});
      for(let i=0;i<200 && !release;i++) await new Promise(resolve=>setTimeout(resolve,5));
      assert.equal(typeof release,'function');assert.equal(settled,false);
      release();const result=await pending;assert.equal(result.phase,'completed');assert.equal(fs.readFileSync(path.join(root,'shared.md'),'utf8'),'once');
      const saved=fs.readFileSync(path.join(install,'data.json'),'utf8');assert.doesNotMatch(saved,/onVaultMutation|vaultMutations/);
    } finally {p.releasePluginExecution(false);}
  }
});

test('shared step next effect waits, and refresh failure is terminal without replay', async t => {
  for(const fails of [false,true]) {
    const root=fixture(t), dir=path.join(root,'runtime');fs.mkdirSync(dir);
    const definition=runtime.prepareWorkflowDefinition({id:'wf',steps:[
      {id:'first',stepKind:'code',codeAllowVault:true,code:'vault.append("first.md","once");'},
      {id:'second',stepKind:'code',codeAllowVault:true,code:'vault.write("second.md","next");'},
    ]},[],{});
    let release;
    const refresh=new ObsidianVaultRefresh(root,adapter(root,async rel=>{if(rel==='first.md'){await new Promise(r=>{release=r;});if(fails)throw Error('refresh rejected');}}));
    const options={definition,runtimeDirectory:dir,vaultBase:root,redact:s=>s,vaultMutations:()=>refresh.createBatch()};
    const pending=runtime.runCodeWorkflowHost(options);
    for(let i=0;i<200&&!release;i++)await new Promise(r=>setTimeout(r,5));
    assert.equal(typeof release,'function');assert.equal(fs.existsSync(path.join(root,'second.md')),false);
    release();const result=await pending;assert.equal(result.phase,fails?'failed':'completed');
    assert.equal(fs.existsSync(path.join(root,'second.md')),!fails);
    if(fails){assert.match(result.steps[0].output,/persisted.*refresh rejected/);await runtime.runCodeWorkflowHost({...options,resumeRunId:result.runId});}
    assert.equal(fs.readFileSync(path.join(root,'first.md'),'utf8'),'once');
  }
});
