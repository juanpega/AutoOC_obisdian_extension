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

function stopCardHarness() {
  const notices = [], elements = [], bundle = { exports: {} };
  class Stub {}
  const obsidian = { Plugin: Stub, Notice: class { constructor(text) { notices.push(text); } }, Modal: Stub, Setting: Stub, ItemView: Stub, PluginSettingTab: Stub };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8') + '\nmodule.exports.TestView = AutoOCView; module.exports.TestClient = CodexAppServerClient; module.exports.setRunner = runner => { runInstalledWorkflow = runner; };', {
    module: bundle, exports: bundle.exports, require: name => name === 'obsidian' ? obsidian : require(name),
    process, Buffer, console, AbortController, setTimeout, clearTimeout, setInterval, clearInterval,
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
    detailStop: elements.find(el => el.text === '⏹ Stop'), renderCard, Plugin: bundle.exports.default, Client: bundle.exports.TestClient, setRunner: bundle.exports.setRunner };
}

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
  let killed = 0, saved = 0;
  legacy.plugin.runningProcesses.set('t', { kill() { killed++; } });
  legacy.plugin.saveSettings = async () => { saved++; };
  assert.equal(await legacy.plugin.killTask('t'), 'stopped');
  assert.equal(killed, 1); assert.equal(saved, 1); assert.equal(legacy.task.status, 'failed');
  assert.match(legacy.task.output, /stopped manually/);
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
    else { await h.plugin.killTask(h.task.id); if (mode === 'relaunch') await h.plugin.runTask(h.task, async () => { completions++; }); }
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
