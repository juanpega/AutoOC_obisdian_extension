const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, overrides = {}, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, { exports, require: name => overrides[name] || require(name), process, Buffer, console, setTimeout, clearTimeout, setInterval, clearInterval, ...globals });
  return exports;
}

test('Code handoff preserves report-like headings and every byte above 50 KB', () => {
  const { workflowTaskPrompt } = load('workflow-handoff.ts');
  const payload = '## Response\r\n  INICIO ñ " & $ % ...\r\n' + 'contenido\r\n'.repeat(6000) + '\r\n---\r\n\r\n## OpenCode trace\r\nFINAL  ';
  const prompt = workflowTaskPrompt('Lee los datos', { handoffOutput: true, steps: [{ id: 'code', stepKind: 'code' }] }, { stepId: 'code', output: payload });
  assert.ok(prompt.includes(payload), 'Code output must stay opaque, including headings and whitespace');
});

function launcherHarness() {
  const files = new Map(), timers = [], intervals = [], children = [], calls = [];
  let serial = 0;
  const fakeFs = {
    mkdtempSync(prefix) { return prefix + (++serial); },
    writeFileSync(file, data, options) {
      if (options?.flag === 'wx' && files.has(file)) throw Error('EEXIST');
      files.set(file, String(data));
    },
    existsSync(file) { return files.has(file); },
    readFileSync(file) { if (!files.has(file)) throw Error('ENOENT'); return files.get(file); },
    unlinkSync(file) { files.delete(file); },
    rmdirSync() {},
  };
  const spawn = (...args) => {
    calls.push(args);
    const callbacks = {};
    const child = { unref() {}, on(name, fn) { callbacks[name] = fn; return this; }, emit(name, ...args) { callbacks[name]?.(...args); } };
    children.push(child); return child;
  };
  const globals = {
    setTimeout(fn, ms) { const timer = { fn, ms, referenced: true, unref() { this.referenced = false; } }; timers.push(timer); return timer; }, clearTimeout() {},
    setInterval(fn, ms) { const timer = { fn, ms, referenced: true, unref() { this.referenced = false; } }; intervals.push(timer); return timer; }, clearInterval() {},
  };
  const overrides = { fs: fakeFs, child_process: { spawn } };
  const launch = load('cli-launchers.ts', overrides, globals).openOpencodeCliLongPromptWindows;
  const signal = (index, state) => {
    const observer = Buffer.from(calls[index][1].at(-1), 'base64').toString('utf16le');
    const attempt = observer.match(/attempt = '([a-f0-9]+)'/)[1];
    const file = [...files.keys()].filter(name => name.endsWith('prompt.txt'))[index];
    files.set(path.join(path.dirname(file), 'state.json'), JSON.stringify({ attempt, ...state }));
    intervals[index].fn();
  };
  return { files, timers, intervals, children, calls, launch, signal, fakeFs, overrides, globals };
}

test('outer process spawn never confirms interactive launch and time alone never deletes prompt', () => {
  const h = launcherHarness(); let launched = 0;
  h.launch('opencode', 'C:/vault', {}, 'test/model', 'plan', 'INICIO' + 'x'.repeat(60000) + 'FINAL', { onLaunched() { launched++; } });
  h.children[0].emit('spawn');
  assert.equal(launched, 0);
  const prompt = [...h.files].find(([name]) => name.endsWith('.txt'));
  assert.ok(prompt);
  for (const timer of h.timers) timer.fn();
  assert.equal(h.files.get(prompt[0]), prompt[1]);
});

test('only matching confirmation settles once; prompt survives until owning session ends', () => {
  const h = launcherHarness(); const results = [];
  h.launch('opencode', 'C:/vault', {}, 'test/model', 'plan', 'payload', { onLaunched: () => results.push('ok'), onError: () => results.push('error') });
  assert.equal(h.intervals[0].referenced, true, 'standalone runtime must stay alive while awaiting confirmation');
  h.signal(0, { attempt: 'foreign', status: 'started', confirmed: true });
  assert.deepEqual(results, []);
  h.signal(0, { status: 'started', confirmed: true });
  h.signal(0, { status: 'started', confirmed: true });
  assert.deepEqual(results, ['ok']);
  assert.equal(h.intervals[0].referenced, false, 'interactive session must not keep the standalone host alive after settlement');
  assert.ok([...h.files.keys()].some(f => f.endsWith('prompt.txt')));
  h.signal(0, { status: 'ended', confirmed: true, ended: true });
  assert.equal(h.files.size, 0);
  assert.deepEqual(results, ['ok']);
});

test('timeout preserves input, rejects late success, and still cleans after session exit', () => {
  const h = launcherHarness(); const results = [];
  h.launch('opencode', 'C:/vault', {}, 'test/model', 'plan', 'payload', { onLaunched: () => results.push('ok'), onError: e => results.push(e.message) });
  h.timers[0].fn();
  assert.match(results[0], /30 seconds/);
  h.signal(0, { status: 'started', confirmed: true });
  assert.equal(results.length, 1);
  assert.ok([...h.files.values()].includes('payload'));
  h.signal(0, { status: 'ended', confirmed: true, ended: true });
  assert.equal(h.files.size, 0);
});

test('initial errors and missing executable cannot yield a successful launch', () => {
  for (const mode of ['write', 'spawn', 'exit', 'internal', 'missing']) {
    const h = launcherHarness(); let errors = 0, successes = 0;
    if (mode === 'write') h.fakeFs.writeFileSync = () => { throw Error('EACCES'); };
    h.launch('missing', 'C:/vault', {}, 'test/model', 'plan', 'payload', { onLaunched: () => successes++, onError: () => errors++ });
    if (mode === 'spawn') h.children[0].emit('error', Error('ENOENT'));
    if (mode === 'exit') h.children[0].emit('exit', 1);
    if (mode === 'internal') h.signal(0, { status: 'error', ended: false });
    if (mode === 'missing') h.signal(0, { status: 'ended', ended: true, confirmed: false });
    assert.equal(successes, 0, mode); assert.equal(errors, 1, mode);
  }
});

test('payload size does not grow the command and environment values never enter scripts', () => {
  const h = launcherHarness();
  for (const payload of ['x', 'BEGIN ñ & % $ "\r\n'.repeat(6000)]) h.launch("C:/O'Brien/工具/opencode.cmd", "C:/O'Brien/工具", { SYNTHETIC_VALUE: 'fake-value-for-test' }, 'test/model', 'plan', payload);
  assert.equal(h.calls[0][1].at(-1).length, h.calls[1][1].at(-1).length);
  const observer = Buffer.from(h.calls[0][1].at(-1), 'base64').toString('utf16le');
  assert.ok(!observer.includes('fake-value-for-test'));
  const encoded = observer.match(/'-EncodedCommand', '([^']+)'/)[1];
  const runner = Buffer.from(encoded, 'base64').toString('utf16le');
  assert.ok(runner.includes("O''Brien")); assert.ok(runner.includes('工具'));
  assert.ok(!runner.includes('fake-value-for-test')); assert.ok(!runner.includes('BEGIN'));
  assert.equal(h.calls[0][2].env.SYNTHETIC_VALUE, 'fake-value-for-test');
});

test('session cleanup is isolated and does not sweep unrelated files', () => {
  const h = launcherHarness();
  h.launch('opencode', 'C:/vault', {}, 'test/model', 'plan', 'one');
  h.launch('opencode', 'C:/vault', {}, 'test/model', 'plan', 'two');
  const prompt = [...h.files.keys()].find(f => f.endsWith('prompt.txt'));
  const foreign = path.join(path.dirname(prompt), 'keep.md'); h.files.set(foreign, 'preserve');
  h.signal(0, { status: 'ended', ended: true, confirmed: true });
  assert.equal(h.files.get(foreign), 'preserve');
  assert.ok([...h.files.values()].includes('two'));
});

function pluginHarness(payload) {
  const h = launcherHarness();
  const exports = {};
  const bundleModule = { exports };
  class Stub {}
  const obsidian = { Plugin: Stub, Notice: Stub, Modal: Stub, Setting: Stub, ItemView: Stub, PluginSettingTab: Stub };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8'), {
    exports, module: bundleModule, require: name => name === 'obsidian' ? obsidian : h.overrides[name] || require(name),
    process: { ...process, platform: 'win32' }, Buffer, console, ...h.globals,
  });
  const plugin = Object.create(bundleModule.exports.default.prototype);
  const task = { id: 'interactive', name: 'Interactive', taskKind: 'opencode', interactiveTerminal: true, model: 'test/model', agent: 'plan', prompt: 'Read data', status: 'pending', output: '' };
  const workflow = { id: 'workflow', name: 'Code to CLI', status: 'running', handoffOutput: true, steps: [
    { id: 'code', stepKind: 'code', code: `output = ${JSON.stringify(payload)};`, transitions: [{ toStepId: 'cli', mode: 'default' }] },
    { id: 'cli', stepKind: 'task', taskId: task.id, transitions: [] },
  ] };
  plugin.settings = { tasks: [task], workflows: [workflow], workingDirectory: 'C:/test-vault', opencodePath: 'opencode' };
  plugin.app = { vault: { adapter: { basePath: 'C:/test-vault' } } };
  plugin.runningProcesses = new Map(); plugin.stoppingWorkflows = new Set();
  plugin.workflowRuntime = new Map([[workflow.id, { stepOutputs: new Map() }]]);
  plugin.saveSettings = async () => {};
  plugin.getSecretsEnv = () => ({}); plugin.getEffectiveAgent = () => 'plan';
  plugin.isTaskActive = t => t.status === 'running';
  return { ...h, plugin, task, workflow };
}
const drain = () => new Promise(resolve => setImmediate(resolve));

// C5: complete the real shared host before reusing its task, retaining the journal.
for (const entry of ['card', 'workflow']) for (const standalone of [false, true]) for (const logsEnabled of [false, true]) {
  test(`shared to legacy ${entry}, standalone=${standalone}, logs=${logsEnabled}`, async () => {
    const h = stopCardHarness(), p = h.plugin, os = require('node:os');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'autooc-legacy-history-'));
    const install = path.join(root, '.obsidian/plugins/auto-oc'), file = path.join(install, 'data.json');
    fs.mkdirSync(install, { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ logsEnabled, tasks: [{ id: 't', name: 'Task', taskKind: 'codex', prompt: 'fixture', scheduleType: 'manual' }],
      workflows: [{ id: 'wf', name: 'Shared', steps: [{ id: 'a', stepKind: 'task', taskId: 't' }] }] }));
    delete p.pluginExecutionLease; delete p.sharedWorkflowExecution; delete p.saveSettings;
    p.app = { vault: { adapter: { basePath: root }, configDir: '.obsidian' }, workspace: { getLeavesOfType: () => [] } };
    p.manifest = { id: 'auto-oc' }; p.redactSecrets = text => text;
    h.Client.prototype.run = async function() { return { status: 'completed', output: 'historical result', threadId: 'thread-history', turnId: 'turn-history' }; };
    h.Client.prototype.dispose = () => {};
    let finish, legacyJob, disposed = 0, advances = 0;
    try {
      p.reservePluginExecution(); await p.loadSettings();
      await p.runSharedWorkflow(standalone ? '@task:t' : 'wf', undefined, false, true, standalone ? 't' : undefined);
      const task = p.settings.tasks[0], historical = JSON.stringify(task.runtimeExecution);
      const oldIdentity = p.taskStopIdentity(task);
      const journalFile = path.join(install, 'runtime', task.runtimeExecution.runId + '.json');
      const journal = fs.readFileSync(journalFile, 'utf8');
      const wf = { id: 'legacy', name: 'Legacy', status: 'running', currentStep: 0, steps: [
        { id: 'first', stepKind: 'task', taskId: 't', transitions: [{ toStepId: 'next', mode: 'force' }] },
        { id: 'next', stepKind: 'code', code: 'output = "must not run";' }] };
      if (!standalone && logsEnabled) { Object.assign(p.settings.workflows[0], {...wf,id:'wf'}); Object.assign(wf,p.settings.workflows[0]); p.settings.workflows[0]=wf; }
      else p.settings.workflows.push(wf);
      task.taskKind = 'copilot';
      p.workflowRuntime = new Map([[wf.id, { stepOutputs: new Map() }]]);
      p.runWorkflowStepById = async () => { advances++; };
      p.createCopilotClient = () => ({ run: () => new Promise(resolve => finish = resolve), dispose() { disposed++; } });
      const runLegacy = p.runCopilotTask.bind(p);
      p.runCopilotTask = (...args) => (legacyJob = runLegacy(...args));
      await p.runTaskStep(wf, wf.steps[0], 0);
      while (!finish) await drain();
      const active = p.taskStopIdentity(task);
      assert.equal(active.kind, 'legacy'); assert.notEqual(active.token, oldIdentity.runId);
      assert.equal(active.workflowId, wf.id); assert.equal(JSON.stringify(task.runtimeExecution), historical);
      await assert.rejects(p.killTask('t', oldIdentity), /changed|owned/);
      assert.equal(disposed, 0);
      const reloaded = new h.Plugin(); reloaded.app = p.app; reloaded.manifest = p.manifest;
      await reloaded.loadSettings();
      assert.equal(reloaded.settings.tasks[0].legacyExecution.token, active.token);
      assert.notEqual(reloaded.settings.tasks[0].output, 'historical result');
      await assert.rejects(reloaded.killTask('t', active), /changed|owned/);
      if (entry === 'card') await h.renderCard(task).find(el => el.text === '⏹').onclick({ stopPropagation() {} });
      else await p.killWorkflow(wf.id);
      assert.equal(disposed, 1);
      assert.equal(task.legacyExecution.stopState, 'unconfirmed');
      assert.equal(wf.status, 'failed');
      finish({ exitCode: 0, output: 'late result' }); await drain();
      await new Promise(resolve => setTimeout(resolve, 250));
      assert.equal(advances, 0); assert.notEqual(task.output, 'late result');
      assert.equal(JSON.stringify(task.runtimeExecution), historical);
      assert.equal(fs.readFileSync(journalFile, 'utf8'), journal);
      await reloaded.loadSettings();
      assert.equal(reloaded.settings.tasks[0].legacyExecution.stopState, 'unconfirmed');
      assert.equal(JSON.stringify(reloaded.settings.tasks[0].runtimeExecution), historical);
      assert.notEqual(reloaded.settings.tasks[0].output, 'historical result');
      assert.ok(h.renderCard(task).some(el => el.text === 'stop outcome unconfirmed'));
      if (standalone && !logsEnabled && entry === 'card') {
        task.taskKind='codex'; await p.saveSettings();
        await p.runSharedWorkflow('@task:t',undefined,false,true,'t');
        assert.equal(p.settings.tasks[0].legacyExecution,undefined);
        assert.notEqual(p.settings.tasks[0].runtimeExecution.runId,JSON.parse(historical).runId);
        assert.equal(p.taskStopIdentity(p.settings.tasks[0]).kind,'shared');
        assert.equal(fs.readFileSync(journalFile,'utf8'),journal);
      }
    } finally {
      if (finish) finish({ exitCode: 0, output: '' }); if (legacyJob) await legacyJob; p.releasePluginExecution(false);
      assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
      assert.ok(path.basename(root).startsWith('autooc-legacy-history-'));
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}

function stopCardHarness(globals = {}) {
  const notices = [], elements = [], bundle = { exports: {} };
  class Stub {}
  const obsidian = { Plugin: Stub, Notice: class { constructor(text) { notices.push(text); } }, Modal: Stub, Setting: Stub, ItemView: Stub, PluginSettingTab: Stub };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8') + '\nmodule.exports.TestView = AutoOCView; module.exports.TestClient = CodexAppServerClient; module.exports.setRunner = runner => { runInstalledWorkflow = runner; }; module.exports.setConfirmation = answer => { ConfirmModal.prototype.openAndWait = answer; };', {
    module: bundle, exports: bundle.exports, require: name => name === 'obsidian' ? obsidian : require(name),
    process, Buffer, console, AbortController, setTimeout, clearTimeout, setInterval, clearInterval, ...globals,
  });
  const plugin = new bundle.exports.default();
  const binding = { runId: 'run-1', workflowId: 'wf', stepId: 'a', stepIndex: 0, revision: 1 };
  const task = { id: 't', name: 'Task', taskKind: 'codex', prompt: '', status: 'running', output: '', scheduleType: 'manual', runtimeExecution: binding };
  const workflow = { id: 'wf', steps: [{ id: 'a', taskId: 't' }, { id: 'b', stepKind: 'code' }] };
  plugin.settings = { tasks: [task], workflows: [workflow] };
  plugin.pluginExecutionLease = { assertOwned() {} };
  plugin.sharedWorkflowExecution = { workflowId: 'wf', runId: 'run-1', controller: new AbortController(), checkpoint: {
    runId: 'run-1', workflowId: 'wf', revision: 1, phase: 'in_flight', nextStepId: 'a', steps: [{ stepId: 'a', status: 'in_flight' }],
  } };
  plugin.saveSettings = async () => { throw Error('Shared stop must not write catalog'); };
  plugin.refreshOpenViews = () => {};
  function element(options = {}) {
    const el = { ...options, textContent: options.text, style: {}, classList: { toggle() {} },
      createEl(tag, opts) { return element({ tag, ...opts }); }, createDiv(opts) { return element(typeof opts === 'string' ? { cls: opts } : opts); },
      setAttr() {}, addClass() {}, addEventListener() {}, };
    elements.push(el); return el;
  }
  const view = Object.create(bundle.exports.TestView.prototype);
  view.plugin = plugin; view.expandedTasks = new Set();
  const renderCard = task => {
    const start = elements.length;
    view.renderTaskCard(element(), task);
    return elements.slice(start);
  };
  renderCard(task);
  return { plugin, task, workflow, notices, elements, stop: elements.find(el => el.text === '⏹'),
    detailStop: elements.find(el => el.text === '⏹ Stop'), renderCard, Plugin: bundle.exports.default, Client: bundle.exports.TestClient, setRunner: bundle.exports.setRunner, setConfirmation: bundle.exports.setConfirmation };
}

test('task card abandons only the confirmed historical attempt after edits and permits a fresh task', async () => {
  const os=require('node:os'), root=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-card-abandon-'));
  const h=stopCardHarness(), p=h.plugin;
  delete p.sharedWorkflowExecution;delete p.pluginExecutionLease;delete p.saveSettings;
  const install=path.join(root,'.obsidian/plugins/auto-oc'),runtime=path.join(install,'runtime');fs.mkdirSync(runtime,{recursive:true});
  p.app={vault:{adapter:{basePath:root},configDir:'.obsidian'},workspace:{getLeavesOfType:()=>[]}};p.manifest={id:'auto-oc'};p.redactSecrets=s=>s;
  const state={schemaVersion:1,runId:'old-attempt',workflowId:'@task:t',definitionHash:'a'.repeat(64),revision:1,phase:'in_flight',nextStepId:'task',steps:[{stepId:'task',status:'in_flight'}]};
  const file=path.join(runtime,'old-attempt.json');fs.writeFileSync(file,JSON.stringify(state));
  fs.writeFileSync(path.join(install,'data.json'),JSON.stringify({logsEnabled:false,workflows:[],tasks:[{id:'t',name:'Edited task',taskKind:'code',code:'output="fresh task succeeded";',prompt:'edited',scheduleType:'manual',runtimeExecution:{runId:state.runId,workflowId:state.workflowId,revision:1,definitionHash:state.definitionHash}}]}));
  p.reservePluginExecution();
  try {
    await p.loadSettings();
    await assert.rejects(p.runTask(p.settings.tasks[0]),/Unfinished attempt old-attempt/);
    const card=h.renderCard({...p.settings.tasks[0],taskKind:'codex'}), button=card.find(el=>el.text==='Abandon attempt');assert.ok(button);
    h.setConfirmation(async()=>false);await button.onclick({stopPropagation(){}});
    assert.deepEqual(JSON.parse(fs.readFileSync(file)),state,'cancel is read-only');
    h.setConfirmation(async()=>{p.sharedWorkflowExecution={workflowId:'other'};return true;});
    await assert.rejects(p.confirmAbandonTaskExecution('t'),/still active/);delete p.sharedWorkflowExecution;
    h.setConfirmation(async()=>{const changed={...state,revision:2};fs.writeFileSync(file,JSON.stringify(changed));return true;});
    await assert.rejects(p.confirmAbandonTaskExecution('t'),/revision changed/);
    assert.equal(JSON.parse(fs.readFileSync(file)).phase,'in_flight');
    // The next confirmation observes the updated revision.
    h.setConfirmation(async()=>true);await p.confirmAbandonTaskExecution('t');
    const abandoned=JSON.parse(fs.readFileSync(file));assert.equal(abandoned.phase,'abandoned');assert.deepEqual(abandoned.steps,state.steps);
    assert.equal(p.settings.tasks[0].status,'abandoned');assert.equal(p.settings.tasks[0].prompt,'edited');
    p.pluginExecutionLease.assertOwned();
    await p.runTask(p.settings.tasks[0]);
    assert.equal(p.settings.tasks[0].status,'completed');assert.match(p.settings.tasks[0].output,/fresh task succeeded/);
    assert.deepEqual(JSON.parse(fs.readFileSync(file)),abandoned);
  } finally {
    p.releasePluginExecution(false);
    assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('autooc-card-abandon-'));fs.rmSync(root,{recursive:true,force:true});
  }
});

function legacyHarness(kind = 'copilot', globals = {}) {
  const h = stopCardHarness(globals), p = h.plugin;
  delete p.sharedWorkflowExecution; delete p.pluginExecutionLease; delete h.task.runtimeExecution;
  Object.assign(h.task, {taskKind:kind,prompt:'fixture',code:'output="code result";',status:'pending',model:'test/model'});
  p.app = {vault:{adapter:{basePath:require('node:os').tmpdir()}}};
  p.saveSettings = async () => {};
  return h;
}

// C6: keep production workflow dispatch, Code execution, task ownership and Stop;
// only the persistence boundary, clock and external client are controlled.
function terminalRestartHarness(kind) {
  const timers = [];
  const h = legacyHarness('copilot', {
    setTimeout(fn, ms) { const timer = {fn, ms}; timers.push(timer); return timer; },
    clearTimeout(timer) { if (timer) timer.cancelled = true; },
  });
  const p = h.plugin, wf = h.workflow;
  Object.assign(wf, {name:'C6 fixture', status:'pending', currentStep:0, steps:[{
    id:'terminal', stepKind:kind === 'delay' ? 'delay' : 'code', delayValue:0,
    code:kind === 'failure' ? 'throw new Error("old failure");' : 'output="old result";', transitions:[],
  }]});
  p.createVaultMutationBatch = () => ({record(){}, async flush(){}});
  const clients = [], callbacks = [];
  p.createCopilotClient = (_cwd, onOutput) => {
    const record = {onOutput, killed:0}; clients.push(record);
    return record.client = {run:() => new Promise(resolve => record.finish = resolve), dispose(){record.killed++;}};
  };
  const runTask = p.runTask.bind(p);
  p.runTask = (task, callback, ...args) => { callbacks.push(callback); return runTask(task, callback, ...args); };
  return {...h, timers, clients, callbacks};
}

for (const kind of ['code', 'delay', 'failure']) {
  for (const action of ['continue', 'stop', 'reject']) {
    test(`C6 terminal ${kind} preserves restarted owner: ${action}`, async () => {
      const h = terminalRestartHarness(kind), p = h.plugin, wf = h.workflow;
      let release, reject;
      p.saveSettings = () => ['completed','failed'].includes(wf.status) && !release
        ? new Promise((resolve, fail) => {release=resolve; reject=fail;}) : Promise.resolve();
      const first = p.runWorkflow(wf), oldContext = p.workflowRuntime.get(wf.id);
      // Delay and failed-Code persistence rejections propagate; successful Code
      // catches its persistence error and ignores it once ownership has changed.
      const settledFirst = first.then(() => null, error => error);
      await drain();
      if (kind === 'delay') { h.timers.find(t => t.ms === 0).fn(); await drain(); }
      assert.equal(typeof release, 'function', 'old terminal save reached');
      wf.steps = [{id:'task',stepKind:'task',taskId:'t',transitions:[{toStepId:'next',mode:'default'}]},
        {id:'next',stepKind:'delay',delayValue:1,transitions:[]}];
      await p.runWorkflow(wf); await drain();
      const current = p.workflowRuntime.get(wf.id), handle = p.runningProcesses.get('t');
      const identity = p.taskStopIdentity(h.task), before = JSON.stringify(wf), noticeCount = h.notices.length;
      assert.notEqual(current, oldContext); assert.ok(handle); assert.equal(h.clients.length, 1);
      if (action === 'reject') reject(Error('old save rejected')); else release();
      const error = await settledFirst;
      if (action === 'reject' && kind !== 'code') assert.match(error.message, /old save rejected/);
      else assert.equal(error, null);
      assert.equal(p.workflowRuntime.get(wf.id), current, 'new context survives old terminal save');
      assert.equal(JSON.stringify(wf), before); assert.equal(p.runningProcesses.get('t'), handle);
      assert.equal(p.taskStopIdentity(h.task).token, identity.token);
      assert.equal(h.notices.length, noticeCount, 'no stale terminal notice');
      let foreignKills = 0;
      p.runningProcesses.set('foreign', {kill(){foreignKills++;}});
      if (action === 'stop') {
        await p.killWorkflow(wf.id);
        assert.equal(h.clients[0].killed, 1); assert.equal(foreignKills, 0);
        assert.equal(h.task.legacyExecution.stopState, 'unconfirmed');
        assert.match(h.task.output, /external outcome unconfirmed/);
        h.clients[0].onOutput('late stream'); h.clients[0].finish({exitCode:0,output:'late result'});
        await drain(); await h.callbacks[0]({status:'completed',output:'late callback'}, 0);
        assert.equal(wf.status, 'failed'); assert.equal(h.timers.filter(t => t.ms === 200).length, 0);
        assert.notEqual(h.task.output, 'late result');
      } else {
        h.clients[0].finish({exitCode:0,output:'new result'}); await drain();
        assert.equal(wf.steps[0].output, 'new result'); assert.equal(current.stepOutputs.get('task'), 'new result');
        await h.callbacks[0]({status:'completed',output:'duplicate'}, 0);
        assert.equal(wf.steps[0].output, 'new result');
        const advances = h.timers.filter(t => t.ms === 200); assert.equal(advances.length, 1);
        advances[0].fn(); await drain(); assert.equal(wf.steps[1].status, 'running');
        await p.killWorkflow(wf.id); await drain();
        const stopped = JSON.stringify(wf); advances[0].fn(); await drain();
        assert.equal(JSON.stringify(wf), stopped); assert.equal(foreignKills, 0);
      }
    });
  }
  test(`C6 terminal ${kind} without restart keeps normal result and cleanup`, async () => {
    const h = terminalRestartHarness(kind), p = h.plugin, wf = h.workflow;
    const job = p.runWorkflow(wf); await drain();
    if (kind === 'delay') h.timers.find(t => t.ms === 0).fn();
    await job;
    assert.equal(wf.status, kind === 'failure' ? 'failed' : 'completed');
    assert.equal(p.workflowRuntime.has(wf.id), false);
    assert.equal(p.workflowDelayControllers.has(wf.id), false);
    assert.match(wf.steps[0].output, kind === 'failure' ? /old failure/ : kind === 'delay' ? /delay 0/ : /old result/);
    assert.ok(h.notices.some(text => text.includes(`Workflow "C6 fixture" ${wf.status}.`)));
  });
}

test('C6 old delay cleanup preserves the replacement delay controller', async () => {
  const h = terminalRestartHarness('delay'), p = h.plugin, wf = h.workflow;
  let release;
  p.saveSettings = () => wf.status === 'completed' && !release ? new Promise(resolve => release=resolve) : Promise.resolve();
  const first = p.runWorkflow(wf); await drain(); h.timers[0].fn(); await drain();
  const second = p.runWorkflow(wf); await drain();
  const context = p.workflowRuntime.get(wf.id), controller = p.workflowDelayControllers.get(wf.id);
  release(); await first;
  assert.equal(p.workflowRuntime.get(wf.id), context);
  assert.equal(p.workflowDelayControllers.get(wf.id), controller); assert.equal(controller.signal.aborted, false);
  h.timers[1].fn(); await second;
  assert.equal(wf.status, 'completed'); assert.equal(p.workflowDelayControllers.has(wf.id), false);
});

for (const boundary of ['transition', 'stop', 'entry']) {
  test(`C6 ${boundary} save cannot emit an old notice or advance after restart`, async () => {
    const h = terminalRestartHarness('code'), p = h.plugin, wf = h.workflow;
    let release, gated = false;
    if (boundary === 'transition') wf.steps.push({id:'next',stepKind:'delay',delayValue:1,transitions:[]});
    if (boundary === 'transition') wf.steps[0].transitions = [{toStepId:'next',mode:'default'}];
    const realEntry = p.findEntryStep.bind(p);
    if (boundary === 'entry') p.findEntryStep = () => null;
    if (boundary === 'stop') {
      wf.steps = [{id:'task',stepKind:'task',taskId:'t',transitions:[]}];
      await p.runWorkflow(wf); await drain();
    }
    p.saveSettings = () => {
      const atBoundary = boundary === 'transition' ? wf.currentStep === 1 : wf.status === 'failed';
      if (!gated && atBoundary) {gated=true; return new Promise(resolve => release=resolve);}
      return Promise.resolve();
    };
    const first = boundary === 'stop' ? p.killWorkflow(wf.id) : p.runWorkflow(wf);
    await drain(); assert.equal(typeof release, 'function');
    if (boundary === 'transition') await p.killWorkflow(wf.id);
    p.findEntryStep = realEntry;
    wf.steps = [{id:'replacement',stepKind:'delay',delayValue:1,transitions:[]}];
    const second = p.runWorkflow(wf); await drain();
    const before = JSON.stringify(wf), count = h.notices.length, context = p.workflowRuntime.get(wf.id);
    release(); await first;
    assert.equal(p.workflowRuntime.get(wf.id), context); assert.equal(JSON.stringify(wf), before);
    assert.equal(h.notices.length, count); assert.equal(h.timers.filter(t => t.ms === 200).length, 0);
    await p.killWorkflow(wf.id); await second;
    if (h.clients[0]) {h.clients[0].finish({exitCode:0,output:'late'}); await drain();}
  });
}

test('legacy stop requires a complete identity and never cancels a foreign workflow or occurrence', async () => {
  const h = legacyHarness(), p = h.plugin, task = h.task;
  let finish, killed = 0;
  p.createCopilotClient = () => ({run:()=>new Promise(resolve=>finish=resolve),dispose(){killed++;}});
  const wf = {id:'owner',name:'Owner',status:'running',currentStep:0,steps:[{id:'a',taskId:'t'},{id:'b',taskId:'t'}]};
  const context = {stepOutputs:new Map()}; p.workflowRuntime = new Map([[wf.id,context]]); p.settings.workflows=[wf];
  const job = p.runCopilotTask(task, undefined, {workflowId:wf.id,stepId:'a',stepIndex:0,context}); await drain();
  const identity = p.taskStopIdentity(task), before = JSON.stringify(task);
  for (const stale of [undefined, {...identity,token:undefined}, {...identity,workflowId:'foreign'}, {...identity,stepId:'b'}, {...identity,stepIndex:1}]) {
    await assert.rejects(p.killTask('t',stale),/changed|owned/);
    assert.equal(JSON.stringify(task),before); assert.equal(killed,0);
  }
  const foreign = {...wf,id:'foreign'}; p.settings.workflows.push(foreign); p.workflowRuntime.set('foreign',{});
  await p.killWorkflow('foreign'); assert.equal(killed,0); assert.equal(JSON.stringify(task),before);
  await Promise.all([p.killTask('t',identity),p.killTask('t',identity)]); assert.equal(killed,1);
  finish({exitCode:0,output:'late'}); await job;
});

for (const kind of ['copilot','codex','code']) {
  test(`legacy ${kind} reserves identity before initial persistence and suppresses launch after stop`, async () => {
    const h=legacyHarness(kind), p=h.plugin; let release, launches=0, saves=0, completions=0;
    p.saveSettings=()=>++saves===1 ? new Promise(resolve=>release=resolve) : Promise.resolve();
    p.createCopilotClient=p.createCodexClient=()=>{launches++;throw Error('must not launch');};
    p.createVaultMutationBatch=()=>{launches++;throw Error('must not execute');};
    const method={copilot:'runCopilotTask',codex:'runCodexTask',code:'runCodeTask'}[kind];
    const job=p[method](h.task,async()=>{completions++;});
    const identity=p.taskStopIdentity(h.task); assert.equal(identity.kind,'legacy');
    await p.killTask('t',identity); release(); await job;
    assert.equal(launches,0); assert.equal(completions,0); assert.equal(h.task.status,'failed');
  });
}

for (const kind of ['copilot','codex']) for (const outcome of ['success','error']) {
  test(`legacy ${kind} old ${outcome} cannot overwrite a replacement or remove its handle`, async () => {
    const h=legacyHarness(kind),p=h.plugin, runs=[]; let completed=0;
    const create=(_cwd,callbacks)=>{
      const record={callbacks,killed:0}; runs.push(record);
      return record.client={run:()=>new Promise((resolve,reject)=>{record.resolve=resolve;record.reject=reject;}),
        dispose(){record.killed++;},interrupt:async()=>{record.killed++;},getIds:()=>({})};
    };
    p.createCopilotClient=p.createCodexClient=create;
    const method=kind==='copilot'?'runCopilotTask':'runCodexTask';
    const first=p[method](h.task,async()=>{completed++;}); await drain(); const stale=p.taskStopIdentity(h.task);
    await p.killTask('t',stale);
    const second=p[method](h.task,async()=>{completed++;}); await drain(); const current=p.taskStopIdentity(h.task);
    assert.notEqual(current.token,stale.token);
    await assert.rejects(p.killTask('t',stale),/changed|owned/);
    const before=JSON.stringify(h.task), handle=p.runningProcesses.get('t');
    if(kind==='copilot') runs[0].callbacks('late stream');
    else {
      runs[0].callbacks.onStarted({threadId:'late',turnId:'late'});
      runs[0].callbacks.onOutput('late stream');
      runs[0].callbacks.onApproval({requestId:1,kind:'command',summary:'late approval'});
    }
    if(outcome==='error') runs[0].reject(Error('late error'));
    else runs[0].resolve({exitCode:0,status:'completed',output:'late result'});
    await first;
    assert.equal(JSON.stringify(h.task),before); assert.equal(p.runningProcesses.get('t'),handle);
    if(kind==='codex') assert.equal(p.runningCodexClients.get('t'),runs[1].client);
    assert.equal(completed,0);
    runs[1].resolve({exitCode:0,status:'completed',output:'new result'}); await second;
    assert.equal(h.task.output,'new result'); assert.equal(completed,1);
  });
}

test('legacy interruption errors stay visible and double stop never repeats the request', async () => {
  const h=legacyHarness('codex'),p=h.plugin; let finish, interrupts=0;
  p.createCodexClient=()=>({run:()=>new Promise(resolve=>finish=resolve),interrupt:async()=>{interrupts++;throw Error('fixture interruption failure');},dispose(){}});
  const job=p.runCodexTask(h.task); await drain(); const identity=p.taskStopIdentity(h.task);
  await Promise.all([p.killTask('t',identity),p.killTask('t',identity)]);
  assert.equal(interrupts,1); assert.equal(h.task.legacyExecution.stopState,'error');
  assert.match(h.task.legacyExecution.stopError,/fixture interruption failure/);
  finish({status:'completed',output:'late'}); await job;
  assert.notEqual(h.task.output,'late'); assert.ok(h.notices.some(text=>/Stop request failed/.test(text)));
});

test('legacy Code result after vault flush cannot overwrite a newer attempt', async () => {
  const h=legacyHarness('code'),p=h.plugin; const flushes=[]; let completions=0;
  p.createVaultMutationBatch=()=>({record(){},flush:()=>new Promise(resolve=>flushes.push(resolve))});
  const first=p.runCodeTask(h.task,async()=>{completions++;}); await drain();
  await p.killTask('t',p.taskStopIdentity(h.task)); h.task.code='output="new result";';
  const second=p.runCodeTask(h.task,async()=>{completions++;}); await drain();
  const before=JSON.stringify(h.task), identity=p.taskStopIdentity(h.task);
  flushes[0](); await first;
  assert.equal(JSON.stringify(h.task),before); assert.equal(p.taskStopIdentity(h.task).token,identity.token); assert.equal(completions,0);
  flushes[1](); await second; assert.match(h.task.output,/new result/); assert.equal(completions,1);
});

test('stop during legacy final persistence suppresses continuation after a relaunch', async () => {
  const h=legacyHarness(),p=h.plugin; const runs=[]; let release, completes=0;
  p.createCopilotClient=()=>({run:()=>new Promise(resolve=>runs.push(resolve)),dispose(){}});
  p.saveSettings=()=>h.task.status==='completed' && !release ? new Promise(resolve=>release=resolve) : Promise.resolve();
  const first=p.runCopilotTask(h.task,async()=>{completes++;}); await drain();
  runs[0]({exitCode:0,output:'first result'}); await drain(); assert.ok(release);
  await p.killTask('t',p.taskStopIdentity(h.task));
  const second=p.runCopilotTask(h.task,async()=>{completes++;}); await drain();
  const before=JSON.stringify(h.task); release(); await first;
  assert.equal(JSON.stringify(h.task),before); assert.equal(completes,0);
  runs[1]({exitCode:0,output:'second result'}); await second; assert.equal(completes,1);
});

for (const interactiveTerminal of [true,false]) {
  test(`OpenCode reserves identity before persistence, interactive=${interactiveTerminal}`, async () => {
    const h=pluginHarness('fixture'); h.task.interactiveTerminal=interactiveTerminal;
    let release,saves=0,completes=0;
    h.plugin.saveSettings=()=>++saves===1 ? new Promise(resolve=>release=resolve) : Promise.resolve();
    const job=h.plugin.runTask(h.task,async()=>{completes++;});
    const identity=h.plugin.taskStopIdentity(h.task); assert.equal(identity.kind,'legacy');
    await h.plugin.killTask(h.task.id,identity); release(); await job;
    assert.equal(h.calls.length,0); assert.equal(completes,0);
  });
}

test('legacy duration never combines the historical shared end with the latest start', () => {
  const {taskElapsedSeconds}=load('task-history.ts');
  const task={lastRun:'2026-10-04T12:00:00Z',status:'failed',runtimeExecution:{finishedAt:'2026-10-03T12:00:00Z'},legacyExecution:{token:'new'}};
  assert.equal(taskElapsedSeconds(task),undefined);
  task.legacyExecution.finishedAt='2026-10-04T12:00:05Z'; assert.equal(taskElapsedSeconds(task),5);
});

test('a stopped workflow cannot launch from its delayed initial save after replacement', async () => {
  const h=legacyHarness(),p=h.plugin; let release,saves=0,launches=0;
  Object.assign(h.workflow,{name:'Fixture',status:'pending',currentStep:-1});
  p.saveSettings=()=>++saves===1 ? new Promise(resolve=>release=resolve) : Promise.resolve();
  p.runWorkflowStepById=async()=>{launches++;};
  const first=p.runWorkflow(h.workflow); await p.killWorkflow(h.workflow.id);
  await p.runWorkflow(h.workflow); assert.equal(launches,1);
  release(); await first; assert.equal(launches,1);
});

test('referenced task card requests cancellation from its workflow owner without fabricating a result', async () => {
  const h = stopCardHarness(), before = JSON.stringify(h.task);
  await h.stop.onclick({ stopPropagation() {} });
  assert.equal(h.plugin.sharedWorkflowExecution.controller.signal.aborted, true);
  assert.equal(JSON.stringify(h.task), before);
  assert.ok(h.notices.some(text => /requested/i.test(text)));
  assert.ok(h.notices.every(text => !/Task stopped|stopped manually/.test(text)));
  await h.detailStop.onclick({ stopPropagation() {} });
  assert.equal(h.notices.length, 1, 'request is idempotent');
});

test('obsolete task cards never cancel another owner or occurrence and recover their button', async () => {
  const changes = {
    run: h => { h.task.runtimeExecution.runId = h.plugin.sharedWorkflowExecution.runId = 'run-2'; },
    workflow: h => { h.task.runtimeExecution.workflowId = 'foreign'; },
    step: h => { h.task.runtimeExecution.stepId = 'b'; },
    reference: h => { h.workflow.steps[0].taskId = 'other'; },
    finished: h => { h.plugin.sharedWorkflowExecution.checkpoint.steps[0].status = 'completed'; },
    lease: h => { h.plugin.pluginExecutionLease.assertOwned = () => { throw Error('lost'); }; },
    occurrence: h => { h.task.runtimeExecution.stepIndex = 1; h.plugin.sharedWorkflowExecution.checkpoint.steps.push({ stepId: 'a', status: 'in_flight' }); },
    incomplete: h => { delete h.task.runtimeExecution.stepIndex; },
    ownerGone: h => { h.plugin.sharedWorkflowExecution.runId = undefined; },
  };
  for (const [name, change] of Object.entries(changes)) {
    const h = stopCardHarness(); change(h); const before = JSON.stringify(h.task);
    await h.stop.onclick({ stopPropagation() {} });
    assert.equal(h.plugin.sharedWorkflowExecution.controller.signal.aborted, false, name);
    assert.equal(JSON.stringify(h.task), before, name);
    assert.equal(h.stop.disabled, false, name);
    assert.ok(h.notices.some(text => /refresh or reconcile/.test(text)), name);
  }
});

test('same occurrence remains stoppable across thread and approval checkpoint revisions', async () => {
  const h = stopCardHarness();
  h.task.runtimeExecution.revision = h.plugin.sharedWorkflowExecution.checkpoint.revision = 5;
  await h.stop.onclick({ stopPropagation() {} });
  assert.equal(h.plugin.sharedWorkflowExecution.controller.signal.aborted, true);
});

test('legacy stop and standalone owner cancellation preserve their separate behavior', async () => {
  const legacy = stopCardHarness();
  delete legacy.task.runtimeExecution; delete legacy.plugin.sharedWorkflowExecution;
  let killed = 0, finish;
  legacy.task.taskKind = 'copilot'; legacy.task.prompt = 'fixture';
  legacy.plugin.app = { vault: { adapter: { basePath: '.' } } };
  legacy.plugin.saveSettings = async () => {};
  legacy.plugin.createCopilotClient = () => ({ run: () => new Promise(resolve => finish = resolve), dispose() { killed++; } });
  const job = legacy.plugin.runCopilotTask(legacy.task); await drain();
  assert.equal(await legacy.plugin.killTask('t', legacy.plugin.taskStopIdentity(legacy.task)), 'stop-requested');
  assert.equal(killed, 1); assert.equal(legacy.task.status, 'failed');
  assert.match(legacy.task.output, /external outcome unconfirmed/);
  finish({exitCode:0,output:'late'}); await job;
  const single = stopCardHarness(); single.plugin.sharedWorkflowExecution.taskId = 't';
  single.plugin.settings.workflows = [];
  await single.stop.onclick({ stopPropagation() {} });
  assert.equal(single.plugin.sharedWorkflowExecution.controller.signal.aborted, true);
  assert.equal(single.task.status, 'running');
});

test('real shared host receives card stop, preserves uncertain Codex outcome and reload never advances', async () => {
  const os = require('node:os');
  for (const mode of ['interrupt-ok', 'interrupt-error', 'standalone']) {
    const h = stopCardHarness(), p = h.plugin;
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'autooc-card-stop-'));
    const install = path.join(root, '.obsidian/plugins/auto-oc'), file = path.join(install, 'data.json');
    fs.mkdirSync(install, { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ logsEnabled: false, tasks: [{ id: 't', name: 'Task', taskKind: 'codex', prompt: 'fixture', scheduleType: 'manual' }],
      workflows: [{ id: 'wf', name: 'Fixture', steps: [{ id: 'a', stepKind: 'task', taskId: 't', transitionMode: 'force' },
        { id: 'b', stepKind: 'code', codeAllowVault: true, code: 'vault.write("next-effect.txt", "bad");' }] }] }));
    delete p.pluginExecutionLease; delete p.sharedWorkflowExecution; delete p.saveSettings;
    p.app = { vault: { adapter: { basePath: root }, configDir: '.obsidian' }, workspace: { getLeavesOfType: () => [] } };
    p.manifest = { id: 'auto-oc' }; p.redactSecrets = text => text;
    let finish, started, interrupts = 0, runs = 0;
    const ready = new Promise(resolve => started = resolve);
    h.Client.prototype.run = async function() {
      runs++;
      await this.callbacks.onThreadCreated({ threadId: 'thread-fixture' });
      await this.callbacks.onStarted({ threadId: 'thread-fixture', turnId: 'turn-fixture' });
      started();
      return await new Promise(resolve => finish = resolve);
    };
    h.Client.prototype.interrupt = async () => { interrupts++; if (mode === 'interrupt-error') throw Error('fixture interrupt failure'); };
    h.Client.prototype.dispose = () => {};
    let pending;
    try {
      p.reservePluginExecution(); await p.loadSettings();
      pending = p.runSharedWorkflow(mode === 'standalone' ? '@task:t' : 'wf', undefined, false, true, mode === 'standalone' ? 't' : undefined);
      // Race against rejection so a broken fixture never waits indefinitely.
      await Promise.race([ready, pending.then(() => { throw Error('host finished before task started'); })]);
      const owner = p.sharedWorkflowExecution;
      const card = h.renderCard(p.settings.tasks[0]);
      await card.find(el => el.text === '⏹').onclick({ stopPropagation() {} });
      assert.equal(owner.controller.signal.aborted, true); assert.equal(interrupts, 1);
      finish({ status: 'completed', output: 'late external result', threadId: 'thread-fixture', turnId: 'turn-fixture' });
      await assert.rejects(pending, /cancelled; reconcile/);
      const task = p.settings.tasks[0], binding = task.runtimeExecution;
      const checkpoint = JSON.parse(fs.readFileSync(path.join(install, 'runtime', binding.runId + '.json'), 'utf8'));
      assert.equal(checkpoint.phase, 'in_flight'); assert.equal(checkpoint.steps.length, 1);
      assert.equal(checkpoint.steps[0].codexThreadId, 'thread-fixture'); assert.equal(checkpoint.steps[0].codexTurnId, 'turn-fixture');
      assert.equal(binding.requiresReconciliation, true); assert.equal(fs.existsSync(path.join(root, 'next-effect.txt')), false);
      const reloaded = new h.Plugin(); reloaded.app = p.app; reloaded.manifest = p.manifest;
      await reloaded.loadSettings();
      assert.equal(reloaded.settings.tasks[0].runtimeExecution.requiresReconciliation, true);
      assert.equal(reloaded.settings.tasks[0].status, 'pending'); assert.equal(runs, 1);
      assert.ok(h.renderCard(reloaded.settings.tasks[0]).some(el => el.text === 'reconciliation required'));
      assert.ok(h.notices.every(text => !/Task stopped|stopped manually/.test(text)));
    } finally {
      if (finish) finish({ status: 'interrupted', output: '' });
      if (pending) await pending.catch(() => {});
      p.releasePluginExecution(false);
      // Only this isolated fixture tree is removed; never the operational vault.
      assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
      assert.ok(path.basename(root).startsWith('autooc-card-stop-'));
      assert.equal(fs.lstatSync(root).isSymbolicLink(), false);
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test('shared checkpoints cannot regress, change run or overwrite a replacement owner', async () => {
  const h = stopCardHarness(), p = h.plugin;
  let callback, finish, ready, loads = 0;
  const started = new Promise(resolve => ready = resolve);
  delete p.sharedWorkflowExecution;
  p.app = { vault: { adapter: { basePath: 'fixture' } } };
  // This unit fixture controls the host and persistence; location validation
  // is exercised through real installations in workflow-compatibility.
  p.selectedExecutionLocation = () => ({ vault: 'fixture', installationDirectory: 'fixture/install' });
  p.saveSettings = async () => {}; p.loadSettings = async () => { loads++; };
  h.setRunner(async options => { callback = options.onCheckpoint; ready(); return await new Promise(resolve => finish = resolve); });
  const pending = p.runSharedWorkflow('wf'); await started;
  const state = { runId: 'run-a', workflowId: 'wf', revision: 2, phase: 'in_flight', nextStepId: 'a', steps: [{ stepId: 'a', status: 'in_flight' }] };
  await callback(state); state.steps[0].status = 'completed';
  assert.equal(p.sharedWorkflowExecution.checkpoint.steps[0].status, 'in_flight', 'checkpoint is copied');
  for (const altered of [{ ...state, runId: 'other' }, { ...state, workflowId: 'other' }, { ...state, revision: 1 }]) await callback(altered);
  assert.equal(loads, 1); assert.equal(p.sharedWorkflowExecution.runId, 'run-a');
  await callback({ ...state, revision: 3 }); assert.equal(loads, 2);
  const replacement = { workflowId: 'wf', runId: 'run-b', controller: new AbortController() };
  p.sharedWorkflowExecution = replacement; await callback({ ...state, revision: 4 });
  assert.equal(loads, 2); assert.equal(p.sharedWorkflowExecution, replacement);
  finish(); await pending;
  assert.equal(p.sharedWorkflowExecution, replacement);
});

test('task GUI buttons surface blocked starts without changing status or swallowing rejection', async () => {
  const h = stopCardHarness(), p = h.plugin;
  delete p.sharedWorkflowExecution;
  Object.assign(h.task, { status: 'pending', taskKind: 'opencode', interactiveTerminal: true, model: 'test/model' });
  delete h.task.runtimeExecution;
  p.redactSecrets = text => text.replace('PRIVATE_SENTINEL', '[redacted]');
  let calls = 0;
  p.runTask = async () => { calls++; throw Error('Previous execution requires continuation or reconciliation PRIVATE_SENTINEL'); };
  const before = JSON.stringify(h.task);
  for (const label of ['▶', '▶ Run']) {
    await h.renderCard(h.task).find(el => el.text === label).onclick({ stopPropagation() {} });
    assert.match(h.notices.at(-1) || '', /Previous execution requires continuation or reconciliation/);
    assert.ok(!h.notices.at(-1).includes('PRIVATE_SENTINEL'));
    assert.equal(JSON.stringify(h.task), before);
  }
  assert.equal(calls, 2);
  assert.equal(h.notices.length, 2);
});

test('workflow GUI buttons report rejected preflight without effects; CLI still returns an error', async () => {
  const Module = require('node:module'), os = require('node:os');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'autooc-preflight-notice-'));
  const directory = path.join(root, '.obsidian/plugins/auto-oc');
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'data.json'), badCwd = path.join(root, 'not-directory.txt');
  fs.writeFileSync(badCwd, 'fixture');
  fs.writeFileSync(file, JSON.stringify({ tasks: [{ id: 'interactive', name: 'Interactive', taskKind: 'opencode', interactiveTerminal: true,
    prompt: 'Read', model: 'test/model', workingDirectory: badCwd }], workflows: [{ id: 'workflow', name: 'Preflight', steps: [
    { id: 'code', stepKind: 'code', codeAllowVault: true, code: 'vault.write("must-not-exist.txt", "bad");' },
    { id: 'cli', stepKind: 'task', taskId: 'interactive' }] }] }));
  const original = Module._load, notices = [];
  let plugin;
  try {
    class Notice { constructor(message) { notices.push(message); } }
    Module._load = function(id, ...args) {
      if (id === 'obsidian') return { Plugin: class {}, Notice, Modal: class {}, Setting: class {}, ItemView: class {}, PluginSettingTab: class {} };
      return original.call(this, id, ...args);
    };
    const filename = path.resolve(__dirname, '../main.js'), source = fs.readFileSync(filename, 'utf8');
    const bundle = new Module(filename, module);
    bundle.filename = filename; bundle.paths = Module._nodeModulePaths(path.dirname(filename));
    bundle._compile(source, filename);
    plugin = new bundle.exports.default();
    plugin.app = { vault: { adapter: { basePath: root }, configDir: '.obsidian' }, workspace: { getLeavesOfType: () => [] } };
    plugin.manifest = { id: 'auto-oc' };
    plugin.reservePluginExecution(); await plugin.loadSettings(); await plugin.saveSettings(false);
    const before = fs.readFileSync(file, 'utf8');
    const runtime = path.join(directory, 'runtime'), entries = fs.readdirSync(runtime);
    // Execute both real bundle event handlers, without requiring an Obsidian DOM.
    const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const handlers = [];
    function visit(node) {
      if (ts.isMethodDeclaration(node) && node.name.getText(ast) === 'renderWorkflowCard') {
        function find(child) {
          if (ts.isBinaryExpression(child) && ['btnQuickRun.onclick', 'btnRun.onclick'].includes(child.left.getText(ast))) handlers.push(child.right.getText(ast));
          ts.forEachChild(child, find);
        }
        find(node);
      } else ts.forEachChild(node, visit);
    }
    visit(ast); assert.equal(handlers.length, 2);
    let stopped = 0;
    for (const handler of handlers) {
      const click = vm.runInNewContext('(function () { return ' + handler + '; })', { workflow: plugin.settings.workflows[0], import_obsidian: { Notice } }).call({ plugin });
      await click({ stopPropagation() { stopped++; } });
      assert.match(notices.at(-1), /Working directory is unavailable/);
      assert.equal(fs.readFileSync(file, 'utf8'), before, 'no binding, status or history changes');
      assert.deepEqual(fs.readdirSync(runtime), entries, 'no execution journal');
      assert.equal(fs.existsSync(path.join(root, 'must-not-exist.txt')), false);
      assert.equal(fs.existsSync(path.join(root, '.opencode')), false, 'no process logs');
      assert.equal(plugin.sharedWorkflowExecution, undefined);
    }
    assert.equal(notices.length, 2); assert.equal(stopped, 2);
    await assert.rejects(plugin.runWorkflow(plugin.settings.workflows[0]), /Working directory is unavailable/);
    plugin.releasePluginExecution(false);
    const result = require('node:child_process').spawnSync(process.execPath, [path.resolve(__dirname, '../autooc-cli.cjs'), 'run', '--vault', root, '--workflow', 'workflow'], { encoding: 'utf8', timeout: 15000 });
    assert.equal(result.status, 1); assert.match(result.stderr, /Working directory is unavailable/);
    assert.equal(fs.readFileSync(file, 'utf8'), before);
    assert.equal(fs.existsSync(path.join(root, 'must-not-exist.txt')), false);
  } finally {
    plugin?.releasePluginExecution(false); Module._load = original;
    assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('autooc-preflight-notice-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('shared owner projects running and refreshes every open panel; reopening stays read-only pending', async () => {
  const Module = require('node:module'), os = require('node:os');
  for (const standalone of [false, true]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'autooc-owner-ui-'));
    const directory = path.join(root, '.obsidian/plugins/auto-oc');
    fs.mkdirSync(directory, { recursive: true });
    const file = path.join(directory, 'data.json');
    fs.writeFileSync(file, JSON.stringify({ tasks: [{ id: 'interactive', taskKind: 'opencode', interactiveTerminal: true, prompt: 'Read', model: 'test/model' }],
      workflows: [{ id: 'workflow', steps: [{ id: 'cli', taskId: 'interactive' }] }] }));
    const original = Module._load;
    let plugin, finish, execution;
    try {
      Module._load = function(id, ...args) {
        if (id === 'obsidian') return { Plugin: class {}, Notice: class {}, Modal: class {}, Setting: class {}, ItemView: class {}, PluginSettingTab: class {} };
        return original.call(this, id, ...args);
      };
      const filename = path.resolve(__dirname, '../main.js'), bundle = new Module(filename, module);
      bundle.filename = filename; bundle.paths = Module._nodeModulePaths(path.dirname(filename));
      bundle._compile(fs.readFileSync(filename, 'utf8') + '\nmodule.exports.uiTest={AutoOCView,setAdapter:adapter=>{createWorkflowTaskAdapter=()=>adapter;}};', filename);
      const { AutoOCView, setAdapter } = bundle.exports.uiTest;
      let entered;
      const started = new Promise(resolve => { entered = resolve; });
      const gate = new Promise(resolve => { finish = resolve; });
      setAdapter({ supports: () => true, execute: async () => { entered(); return await gate; } });
      const createPlugin = () => {
        const p = new bundle.exports.default();
        p.app = { vault: { adapter: { basePath: root }, configDir: '.obsidian' }, workspace: { getLeavesOfType: () => [] } };
        p.manifest = { id: 'auto-oc' };
        return p;
      };
      plugin = createPlugin(); plugin.reservePluginExecution(); await plugin.loadSettings();
      const rendered = [[], []];
      const leaves = rendered.map(states => {
        const view = Object.create(AutoOCView.prototype);
        view.refresh = () => states.push(plugin.settings.tasks[0].status);
        return { view };
      });
      plugin.app.workspace.getLeavesOfType = () => leaves;
      plugin.view = { refresh() {} }; // A stale cached view must not swallow refreshes.
      execution = plugin.runSharedWorkflow(standalone ? '@task:interactive' : 'workflow', undefined, false, true, standalone ? 'interactive' : undefined);
      await Promise.race([started, execution.then(() => { throw Error('Executor never entered'); })]);
      assert.equal(plugin.settings.tasks[0].status, 'running');
      assert.equal(plugin.settings.tasks[0].runtimeExecution.requiresReconciliation, false);
      if (!standalone) {
        assert.equal(plugin.settings.workflows[0].status, 'running');
        assert.equal(plugin.settings.workflows[0].steps[0].status, 'running');
      }
      for (const states of rendered) assert.equal(states.at(-1), 'running');
      const persisted = fs.readFileSync(file, 'utf8');
      assert.equal(JSON.parse(persisted).tasks[0].status, 'pending');
      const runId = plugin.settings.tasks[0].runtimeExecution.runId;
      const journalFile = path.join(directory, 'runtime', runId + '.json');
      const journal = fs.readFileSync(journalFile, 'utf8');
      const reopened = createPlugin(); await reopened.loadSettings();
      assert.equal(reopened.settings.tasks[0].status, 'pending');
      assert.equal(reopened.settings.tasks[0].runtimeExecution.requiresReconciliation, true);
      assert.equal(fs.readFileSync(file, 'utf8'), persisted);
      assert.equal(fs.readFileSync(journalFile, 'utf8'), journal);
      const owner = plugin.sharedWorkflowExecution;
      plugin.sharedWorkflowExecution = { ...owner, runId: 'another-run' };
      await plugin.loadSettings(); assert.equal(plugin.settings.tasks[0].status, 'pending');
      plugin.sharedWorkflowExecution = owner;
      const assertOwned = plugin.pluginExecutionLease.assertOwned;
      plugin.pluginExecutionLease.assertOwned = () => { throw Error('Lost ownership'); };
      await plugin.loadSettings(); assert.equal(plugin.settings.tasks[0].status, 'pending');
      plugin.pluginExecutionLease.assertOwned = assertOwned;
      await plugin.loadSettings(); assert.equal(plugin.settings.tasks[0].status, 'running');
      finish({ succeeded: true, output: 'Interactive terminal opened; agent result not verified.' });
      await execution;
      assert.equal(plugin.sharedWorkflowExecution, undefined);
      assert.equal(plugin.settings.tasks[0].status, 'completed');
      for (const states of rendered) assert.equal(states.at(-1), 'completed');
      assert.match(plugin.settings.tasks[0].output, /agent result not verified/);
    } finally {
      finish?.({ succeeded: false, output: 'Test cleanup' });
      await execution?.catch(() => {});
      plugin?.releasePluginExecution(false);
      Module._load = original;
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test('real Code → task → Windows launcher keeps literal payload and waits for one confirmation', async () => {
  for (const size of [10, 12000, 60000]) {
    const payload = '## Response\r\n INICIO ñ " & % $\r\n' + 'z'.repeat(size) + '\r\nFINAL  ';
    const h = pluginHarness(payload);
    await h.plugin.runWorkflowStep(0, 0);
    h.timers.find(t => t.ms === 200).fn(); await drain();
    assert.equal(h.workflow.steps[0].output, payload);
    assert.equal(h.task.status, 'running'); assert.equal(h.workflow.steps[1].status, 'running');
    assert.ok([...h.files.values()].some(value => value.includes(payload)));
    h.children[0].emit('spawn'); await drain(); assert.equal(h.task.status, 'running');
    h.signal(0, { status: 'started', confirmed: true }); await drain();
    assert.equal(h.task.status, 'completed'); assert.equal(h.workflow.status, 'completed');
    assert.equal(h.workflow.steps[1].status, 'completed');
    const output = h.task.output;
    h.signal(0, { status: 'started', confirmed: true }); await drain();
    assert.equal(h.task.output, output); assert.equal(h.calls.length, 1);
  }
});

test('late callbacks after stop, deletion or relaunch cannot complete another task attempt', async () => {
  for (const mode of ['stop', 'delete', 'relaunch']) {
    const h = pluginHarness('data'); let completions = 0;
    await h.plugin.runTask(h.task, async () => { completions++; });
    if (mode === 'delete') h.plugin.settings.tasks = [];
    else { await h.plugin.killTask(h.task.id, h.plugin.taskStopIdentity(h.task)); if (mode === 'relaunch') await h.plugin.runTask(h.task, async () => { completions++; }); }
    h.signal(0, { status: 'started', confirmed: true }); await drain();
    assert.equal(completions, 0, mode);
    if (mode === 'relaunch') {
      assert.equal(h.task.status, 'running');
      h.signal(1, { status: 'started', confirmed: true }); await drain();
      assert.equal(completions, 1);
    }
  }
});

test('launcher failure fails task and workflow exactly once', async () => {
  const h = pluginHarness('data');
  await h.plugin.runWorkflowStep(0, 0);
  h.timers.find(t => t.ms === 200).fn(); await drain();
  h.signal(0, { status: 'ended', ended: true, confirmed: false }); await drain();
  assert.equal(h.task.status, 'failed'); assert.equal(h.workflow.status, 'failed');
  assert.equal(h.workflow.steps[1].status, 'failed'); assert.equal(h.calls.length, 1);
});

test('standalone interactive adapter records a known missing executable without launching', async () => {
  const missing = path.join(__dirname, 'fixture-executable-that-does-not-exist.exe');
  assert.equal(fs.existsSync(missing), false);
  let launches = 0;
  const launch = () => { launches++; throw Error('Unexpected launch'); };
  const { createOpenCodeWorkflowAdapter } = load('cli-workflow-adapters.ts', {
    './cli-launchers': { resolveOpencodeBin: value => value, openOpencodeCli: launch, openOpencodeCliLongPromptWindows: launch },
    './copilot-client': {}, './opencode-script': {}, './command-output': {},
  });
  const adapter = createOpenCodeWorkflowAdapter({ settings: { opencodePath: missing, defaultModel: 'test/model' } }, __dirname);
  const result = await adapter.execute({ taskKind: 'opencode', interactiveTerminal: true }, 'synthetic prompt');
  assert.equal(result.succeeded, false);
  assert.match(result.output, /nothing was launched/);
  assert.equal(launches, 0);
});

test('importable workflow reads the full synthetic note without a compaction task', () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../library/wf-code-interactive-handoff.json'), 'utf8'));
  const note = fs.readFileSync(path.join(__dirname, '../library/fixtures/interactive-handoff-note.md'), 'utf8');
  assert.ok(Buffer.byteLength(note) > 10000);
  assert.equal(fixture.workflows[0].steps.length, 2);
  assert.equal(fixture.workflows[0].steps[1].taskExportId, fixture.tasks[0].exportId);
  assert.equal(fixture.tasks[0].agent, 'plan'); assert.equal(fixture.tasks[0].interactiveTerminal, true);
  const { executeCode } = load('code-runtime.ts');
  const output = executeCode({ ...fixture.workflows[0].steps[0], cwd: path.join(__dirname, '..'), vaultBase: path.join(__dirname, '..') });
  assert.equal(output, note);
});

test('session ignore file excludes only its owned directory in a fresh Git repository', () => {
  const os = require('node:os'), cp = require('node:child_process');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'autooc-ignore-test-'));
  try {
    cp.execFileSync('git', ['init', '--quiet', root]);
    const session = path.join(root, '.autooc-interactive-fixture'); fs.mkdirSync(session);
    const h = launcherHarness(); h.launch('opencode', root, {}, 'test/model', 'plan', 'payload');
    const ignore = [...h.files].find(([file]) => file.endsWith('.gitignore'))[1];
    fs.writeFileSync(path.join(session, '.gitignore'), ignore);
    fs.writeFileSync(path.join(session, 'prompt.txt'), 'fixture');
    fs.writeFileSync(path.join(root, 'keep.md'), 'legitimate fixture');
    const args = ['-c', `safe.directory=${root}`, '-C', root];
    assert.match(cp.execFileSync('git', [...args, 'check-ignore', '.autooc-interactive-fixture/prompt.txt'], { encoding: 'utf8' }), /prompt.txt/);
    assert.equal(cp.execFileSync('git', [...args, 'status', '--porcelain'], { encoding: 'utf8' }).trim(), '?? keep.md');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Windows PowerShell parses generated observer and runner without launching them', { skip: process.platform !== 'win32' }, () => {
  const cp = require('node:child_process');
  const h = launcherHarness(); h.launch("C:/O'Brien/工具/opencode.cmd", "C:/O'Brien/工具", {}, 'test/model', 'plan', 'payload');
  const observer = Buffer.from(h.calls[0][1].at(-1), 'base64').toString('utf16le');
  const runner = Buffer.from(observer.match(/'-EncodedCommand', '([^']+)'/)[1], 'base64').toString('utf16le');
  for (const script of [observer, runner]) {
    const parse = "$text = [Console]::In.ReadToEnd(); $tokens = $null; $errors = $null; [void][System.Management.Automation.Language.Parser]::ParseInput($text, [ref]$tokens, [ref]$errors); if ($errors.Count) { $errors | ForEach-Object { $_.Message }; exit 1 }";
    const result = cp.spawnSync('powershell.exe', ['-NoProfile', '-Command', parse], { input: script, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  }
});
