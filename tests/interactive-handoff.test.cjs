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
