const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const Module = require('node:module'), ts = require('typescript');

// Compile current sources, not main.js: the coordinator owns the product build.
function loader(overrides = {}) {
  const cache = new Map();
  class Stub {}
  const obsidian = {Plugin: Stub, Modal: Stub, ItemView: Stub, PluginSettingTab: Stub, Notice: Stub};
  const forbiddenProcess = new Proxy({}, {get: (_target, name) => () => { throw Error(`Unexpected process: ${String(name)}`); }});
  function load(name) {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (cache.has(name)) return cache.get(name).exports;
    const file = path.resolve(__dirname, '..', name + '.ts'), m = new Module(file, module);
    m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file)); cache.set(name, m);
    const original = m.require.bind(m);
    m.require = id => {
      if (id === 'obsidian') return obsidian;
      if (id === 'child_process' || id === 'node:child_process') return forbiddenProcess;
      if (id.startsWith('./') && !path.extname(id)) return load(id.slice(2));
      return original(id);
    };
    const extra = name === 'main' ? '\nmodule.exports.terminalTest = {ImportModal, AUTOOC_WORKFLOW_PROMPT};' : '';
    m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8') + extra, {
      compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
    }).outputText, file);
    return m.exports;
  }
  return load;
}

function terminalHarness(overrides = {}) {
  const external = [], background = [], versions = [];
  const actual = loader()('cli-launchers');
  const codeRuntime = loader()('code-runtime');
  const load = loader({
    // Keep the real interpreter and filesystem, replacing only its process transport.
    'code-runtime': {...codeRuntime, executeCodeAsync: async options => codeRuntime.executeCode(options)},
    'cli-launchers': {...actual, resolveOpencodeBin: value => value || 'opencode',
      openOpencodeCli: (...args) => external.push(args),
      openOpencodeCliLongPromptWindows: (...args) => external.push(args),
      launchHidden(script) {
        background.push(script);
        fs.writeFileSync(path.join(path.dirname(script), 'stdout.txt'), 'background response');
        fs.writeFileSync(path.join(path.dirname(script), 'done.txt'), '0');
        return {cleanup() {}, kill() {}, onError() {}};
      }},
    'opencode-version': {assertOpenCode2: async bin => { versions.push(bin); }},
    ...overrides,
  });
  return {load, external, background, versions};
}

const settings = {opencodePath: 'fixture-v1', opencode2Path: 'fixture-v2', defaultModel: 'default/v1',
  defaultOpencode2Model: 'default/v2', defaultAgent: 'plan', defaultOpencode2Agent: 'review', taskTimeoutSeconds: 2};
const interactive = (kind = 'opencode') => ({id: 'terminal', name: 'Synthetic terminal', taskKind: kind,
  prompt: 'Task instruction', interactiveTerminal: true, scheduleType: 'manual', status: 'pending', output: ''});
const flow = (id, steps) => ({id, name: id, handoffOutput: true, steps});
const taskStep = {id: 'interactive', stepKind: 'task', taskId: 'terminal'};
const prompt = 'Exact prompt\nwith "quotes", $(), `ticks`, \\ and ' + 'long context\n'.repeat(3000);
const ack = '[opened integrated OpenCode CLI with preloaded prompt; interactive task result is not observed]';

async function fixture(work) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'autooc-task-terminal-'));
  try { return await work(root); }
  finally { fs.rmSync(root, {recursive: true, force: true}); }
}

for (const kind of ['opencode', 'opencode2', undefined]) {
  test(`integrated ${kind || 'absent kind'} preserves exact request and waits for launch acknowledgement`, async () => {
    const h = terminalHarness(), task = {...interactive(), taskKind: kind, model: 'chosen/model', agent: 'chosen-agent', workingDirectory: os.tmpdir()};
    const controller = new AbortController();
    let request, acknowledge, settled = false;
    const adapter = h.load('workflow-task-adapters').createWorkflowTaskAdapter({settings}, process.cwd(), undefined,
      {destination: 'integrated', launch: received => { request = received; return new Promise(resolve => { acknowledge = resolve; }); }});
    assert.equal(adapter.supports(task), true);
    const pending = adapter.execute(task, prompt, controller.signal).then(result => { settled = true; return result; });
    // OpenCode 2 also awaits its version check.
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(settled, false);
    assert.deepEqual(request, {bin: kind === 'opencode2' ? 'fixture-v2' : 'fixture-v1', cwd: os.tmpdir(),
      label: task.name, major: kind === 'opencode2' ? 2 : 1, model: 'chosen/model', agent: 'chosen-agent', prompt, signal: controller.signal});
    acknowledge('not an agent result');
    assert.deepEqual(await pending, {succeeded: true, output: ack});
    assert.deepEqual(h.external, []); assert.deepEqual(h.background, []);
    assert.deepEqual(h.versions, kind === 'opencode2' ? ['fixture-v2'] : []);
  });
}

for (const kind of ['opencode', 'opencode2', undefined]) {
  test(`integrated ${kind || 'absent kind'} applies engine defaults and forceModel omits agent`, async () => {
    const h = terminalHarness(), requests = [];
    const adapter = h.load('cli-workflow-adapters').createOpenCodeWorkflowAdapter({settings: {...settings, workingDirectory: os.tmpdir()}}, process.cwd(),
      {destination: 'integrated', launch: async request => { requests.push(request); }});
    await adapter.execute({...interactive(), taskKind: kind}, 'handoff');
    await adapter.execute({...interactive(), taskKind: kind, forceModel: true, agent: 'must-not-pass'}, 'handoff');
    assert.equal(requests[0].model, kind === 'opencode2' ? 'default/v2' : 'default/v1');
    assert.equal(requests[0].agent, kind === 'opencode2' ? 'review' : 'plan');
    assert.equal(requests[0].cwd, os.tmpdir()); assert.equal(requests[1].agent, '');
  });
}

test('integrated OpenCode 1 prefixes Ralph Loop once without truncating handoff', async () => {
  const h = terminalHarness(); let request;
  const adapter = h.load('cli-workflow-adapters').createOpenCodeWorkflowAdapter({settings}, process.cwd(),
    {destination: 'integrated', launch: async value => { request = value; }});
  assert.equal((await adapter.execute({...interactive(), useRalphLoop: true}, prompt)).output, ack);
  assert.equal(request.prompt, '/ralph-loop ' + prompt);
});

test('OpenCode 2 rejects Ralph Loop before either terminal route', async () => {
  const h = terminalHarness(); let launches = 0;
  const adapter = h.load('cli-workflow-adapters').createOpenCodeWorkflowAdapter({settings}, process.cwd(),
    {destination: 'integrated', launch: async () => { launches++; }});
  const result = await adapter.execute({...interactive('opencode2'), useRalphLoop: true}, 'prompt');
  assert.equal(result.succeeded, false); assert.match(result.output, /only supported for OpenCode 1/);
  assert.equal(launches, 0); assert.deepEqual(h.external, []);
});

for (const terminal of [undefined, {}, {destination: 'external'}]) {
  test(`terminal options ${JSON.stringify(terminal)} retain external launch callbacks`, async () => {
    const h = terminalHarness(); let integrated = 0, settled = false;
    const options = terminal && {...terminal, launch: async () => { integrated++; }};
    const adapter = h.load('cli-workflow-adapters').createOpenCodeWorkflowAdapter({settings}, process.cwd(), options);
    const pending = adapter.execute({...interactive(), model: 'selected', forceModel: true, useRalphLoop: true}, prompt)
      .then(result => { settled = true; return result; });
    assert.equal(settled, false); assert.equal(h.external.length, 1); assert.equal(integrated, 0);
    const args = h.external[0], callbacks = args.at(-1);
    if (process.platform === 'win32') {
      assert.equal(args[3], 'selected'); assert.equal(args[4], ''); assert.equal(args[5], '/ralph-loop ' + prompt);
    } else {
      assert.deepEqual(args[3], h.load('opencode-profile').openCodeInteractiveArgs(1, 'selected', '', '/ralph-loop ' + prompt));
    }
    callbacks.onLaunched();
    assert.deepEqual(await pending, {succeeded: true, output: '[opened interactive OpenCode CLI with preloaded prompt; interactive task result is not observed]'});
  });
}

test('integrated missing host or failed host never falls back to an external process', async () => {
  for (const launch of [undefined, async () => { throw Error('PTY unavailable'); }]) {
    const h = terminalHarness();
    const adapter = h.load('cli-workflow-adapters').createOpenCodeWorkflowAdapter({settings}, process.cwd(), {destination: 'integrated', launch});
    await assert.rejects(adapter.execute(interactive(), prompt), launch ? /PTY unavailable/ : /loaded Obsidian terminal host/);
    assert.deepEqual(h.external, []); assert.deepEqual(h.background, []);
  }
});

test('already aborted interactive launch never reaches either terminal host', async () => {
  for (const kind of ['opencode', 'opencode2']) {
    const controller = new AbortController(); let launches = 0;
    const h = terminalHarness();
    const adapter = h.load('cli-workflow-adapters').createOpenCodeWorkflowAdapter({settings}, process.cwd(),
      {destination: 'integrated', launch: async () => { launches++; }});
    controller.abort();
    await assert.rejects(adapter.execute(interactive(kind), prompt, controller.signal), /cancelled before launch/);
    assert.equal(launches, 0); assert.deepEqual(h.external, []);
  }
});

test('OpenCode 2 cancellation during version check prevents integrated launch', async () => {
  const controller = new AbortController(); let launches = 0;
  const h = terminalHarness({'opencode-version': {assertOpenCode2: async () => { controller.abort(); }}});
  const adapter = h.load('cli-workflow-adapters').createOpenCodeWorkflowAdapter({settings}, process.cwd(),
    {destination: 'integrated', launch: async () => { launches++; }});
  await assert.rejects(adapter.execute(interactive('opencode2'), prompt, controller.signal), /cancelled before launch/);
  assert.equal(launches, 0); assert.deepEqual(h.external, []);
});

test('background OpenCode ignores integrated preference and returns observed output', () => fixture(async root => {
  const h = terminalHarness(); let launches = 0;
  const adapter = h.load('workflow-task-adapters').createWorkflowTaskAdapter({settings}, root, undefined,
    {destination: 'integrated', launch: async () => { launches++; }});
  const result = await adapter.execute({...interactive(), interactiveTerminal: false}, prompt);
  assert.equal(result.succeeded, true); assert.match(result.output, /background response/);
  assert.equal(h.background.length, 1); assert.equal(launches, 0); assert.deepEqual(h.external, []);
}));

test('terminal preference does not replace Codex app or Copilot executors', () => {
  const h = terminalHarness();
  const adapter = h.load('workflow-task-adapters').createWorkflowTaskAdapter({settings}, process.cwd(), undefined,
    {destination: 'integrated', launch: async () => { assert.fail('OpenCode terminal used for another engine'); }});
  assert.equal(adapter.supports(interactive('codex')), true);
  assert.equal(adapter.supports({...interactive('copilot'), interactiveTerminal: false}), true);
  assert.equal(adapter.supports(interactive('copilot')), false);
  assert.equal(h.load('cli-workflow-adapters').createOpenCodeWorkflowAdapter({settings}, process.cwd()).supports(interactive('codex')), false);
});

function installed(root, nested = false) {
  const directory = path.join(root, '.obsidian', 'plugins', 'auto-oc'), file = path.join(directory, 'data.json');
  fs.mkdirSync(directory, {recursive: true});
  const first = {id: 'before', stepKind: 'code', codeAllowFiles: true,
    code: 'files.write("effect.txt", "ran"); output = "handoff from Code";'};
  const workflows = [flow('parent', [first, nested ? {id: 'child', stepKind: 'workflow', workflowId: 'child'} : taskStep])];
  if (nested) workflows.push(flow('child', [taskStep]));
  const catalog = {...settings, cliTerminalDestination: 'integrated', tasks: [interactive()], workflows, logsEnabled: false};
  fs.writeFileSync(file, JSON.stringify(catalog));
  return {file, directory, runtime: path.join(directory, 'runtime'), catalog};
}

for (const nested of [false, true]) {
  test(`autonomous integrated preflight rejects ${nested ? 'nested' : 'later'} task before journal or Code effect`, () => fixture(async root => {
    const h = terminalHarness(), f = installed(root, nested), before = fs.readFileSync(f.file, 'utf8');
    await assert.rejects(h.load('installed-workflow-host').runInstalledWorkflow({vault: root, workflowId: 'parent', redact: s => s}),
      /Integrated CLI tasks require a loaded Obsidian plugin/);
    assert.equal(fs.existsSync(path.join(root, 'effect.txt')), false);
    assert.equal(fs.existsSync(f.runtime), false);
    assert.equal(fs.readFileSync(f.file, 'utf8'), before);
    assert.deepEqual(h.external, []); assert.deepEqual(h.background, []);
  }));
}

test('installed host passes global destination outside hash, preserves Code handoff and allows reconcile without callback', () => fixture(async root => {
  const h = terminalHarness(), f = installed(root), requests = [];
  const run = h.load('installed-workflow-host').runInstalledWorkflow;
  const done = await run({vault: root, workflowId: 'parent', redact: s => s,
    launchInteractiveTerminal: async request => { requests.push(request); }});
  assert.equal(done.phase, 'completed', JSON.stringify(done)); assert.equal(requests.length, 1);
  assert.equal(fs.readFileSync(path.join(root, 'effect.txt'), 'utf8'), 'ran');
  const definition = h.load('workflow-definition').prepareWorkflowDefinition(f.catalog.workflows[0], f.catalog.tasks, f.catalog);
  assert.equal(done.definitionHash, definition.hash);
  assert.equal(definition.settings.cliTerminalDestination, undefined);
  assert.equal(requests[0].prompt, h.load('workflow-handoff').workflowTaskPrompt('Task instruction', f.catalog.workflows[0],
    {stepId: 'before', output: 'handoff from Code'}));
  assert.equal(requests[0].cwd, root); assert.equal(requests[0].label, 'Synthetic terminal');
  assert.equal(requests[0].signal instanceof AbortSignal, true);
  assert.equal(done.steps.at(-1).output, ack);
  const reconciled = await run({vault: root, workflowId: 'parent', resumeRunId: done.runId, reconcile: true, redact: s => s});
  assert.equal(reconciled.phase, 'completed'); assert.equal(requests.length, 1);
  assert.deepEqual(h.external, []); assert.deepEqual(h.background, []);
}));

test('sync and cooperative snapshots keep historical fingerprints across terminal destination changes', async () => {
  const {prepareWorkflowDefinition: prepare, prepareWorkflowDefinitionAsync: prepareAsync} = loader()('workflow-definition');
  const workflow = flow('parent', [taskStep]), tasks = [interactive()];
  const historical = prepare(workflow, tasks, settings);
  for (const destination of ['external', 'integrated']) {
    const config = {...settings, cliTerminalDestination: destination};
    const sync = prepare(workflow, tasks, config), asyncSnapshot = await prepareAsync(workflow, tasks, config);
    assert.deepEqual(sync, historical); assert.deepEqual(asyncSnapshot, historical);
    assert.equal(sync.settings.cliTerminalDestination, undefined);
    assert.equal(Object.isFrozen(asyncSnapshot.tasks[0]), true);
  }
});

let mainApi;
function pluginHarness(api) {
  mainApi ||= terminalHarness().load('main');
  api ||= mainApi;
  const plugin = new api.default();
  plugin.app = {vault: {adapter: {basePath: os.tmpdir()}}};
  plugin.manifest = {version: require('../manifest.json').version};
  plugin.settings = {...settings, cliTerminalDestination: 'integrated', tasks: [], workflows: []};
  plugin.saveSettings = async () => {};
  plugin.beginExecutionEffects = () => {};
  plugin.refreshStartControls = () => {};
  return {plugin, ...api.terminalTest};
}

test('source plugin legacy onComplete and prompt override use integrated terminal and launch-only result', async () => {
  const {plugin} = pluginHarness(), task = {...interactive(), model: 'chosen', agent: 'chosen-agent', forceModel: true, useRalphLoop: true};
  plugin.settings.tasks = [task]; let request, completed;
  plugin.cliTerminals = {openTask: async value => { request = value; }};
  await plugin.executeTask(task, async (value, code) => { completed = {value, code}; }, {prompt});
  assert.equal(request.prompt, '/ralph-loop ' + prompt); assert.equal(request.agent, '');
  assert.equal(request.model, 'chosen'); assert.equal(request.label, task.name);
  assert.equal(request.signal instanceof AbortSignal, true); assert.equal(request.signal.aborted, false);
  assert.equal(completed.value, task); assert.equal(completed.code, 0);
  assert.equal(task.prompt, 'Task instruction'); assert.equal(task.status, 'completed');
  assert.match(task.output, /launch confirmed; agent task completion is not tracked/);
  assert.equal(plugin.runningProcesses.size, 0);
});

test('source plugin legacy cancellation aborts terminal request and ignores late acknowledgement', async () => {
  const {plugin} = pluginHarness(), task = {...interactive(), model: 'chosen'};
  plugin.settings.tasks = [task]; let request, acknowledge, started, completed = 0;
  const launched = new Promise(resolve => { started = resolve; });
  plugin.cliTerminals = {openTask: value => { request = value; started(); return new Promise(resolve => { acknowledge = resolve; }); }};
  const pending = plugin.executeTask(task, async () => { completed++; });
  await launched;
  plugin.runningProcesses.get(task.id).kill();
  task.status = 'failed'; task.output = 'stopped by fixture';
  assert.equal(request.signal.aborted, true);
  acknowledge(); await pending;
  assert.equal(completed, 0); assert.equal(task.status, 'failed'); assert.equal(task.output, 'stopped by fixture');
});

test('source legacy uncertain terminal error uses real killTask and blocks another launch', async () => {
  const {plugin} = pluginHarness(), task = {...interactive(), model: 'chosen'};
  const {InteractiveTerminalLaunchUncertainError} = loader()('interactive-task-terminal');
  const error = new InteractiveTerminalLaunchUncertainError('spawn or cleanup uncertain: synthetic-private-token');
  assert.equal(error.code, 'AUTOOC_TERMINAL_UNCERTAIN');
  plugin.settings.tasks = [task];
  plugin.redactSecrets = text => text.replaceAll('synthetic-private-token', '[REDACTED]');
  const saved = []; let launches = 0, completed = 0, request, attempt;
  plugin.saveSettings = async () => { saved.push(JSON.parse(JSON.stringify(task))); };
  plugin.cliTerminals = {openTask: async value => {
    launches++; request = value; attempt = plugin.legacyAttempts.get(task.id); throw error;
  }};
  assert.equal(plugin.killTask, mainApi.default.prototype.killTask);
  await plugin.executeTask(task, async () => { completed++; });
  assert.equal(attempt.cancelled, true);
  assert.equal(task.status, 'failed'); assert.equal(task.legacyExecution.stopState, 'unconfirmed');
  assert.equal(task.legacyExecution.finishedAt, undefined);
  assert.equal(plugin.legacyAttempts.get(task.id), attempt);
  assert.equal(plugin.runningProcesses.has(task.id), false); assert.equal(request.signal.aborted, true);
  assert.equal(completed, 0);
  assert.match(task.output, /Interactive terminal outcome is unconfirmed/);
  assert.match(task.output, /\[REDACTED\]/); assert.doesNotMatch(task.output, /synthetic-private-token/);
  assert.equal(saved.at(-1).legacyExecution.stopState, 'unconfirmed');
  assert.equal(saved.at(-1).output, task.output);
  await assert.rejects(plugin.executeTask(task, async () => { completed++; }), /Previous task outcome is unconfirmed/);
  assert.equal(launches, 1); assert.equal(completed, 0);
});

test('source legacy uncertain launch stops owner workflow even with force continuation', async () => {
  const {plugin} = pluginHarness(), task = {...interactive(), model: 'chosen'};
  const {InteractiveTerminalLaunchUncertainError} = loader()('interactive-task-terminal');
  const first = {...taskStep, transitions: [{toStepId: 'after', mode: 'force'}]};
  const next = {id: 'after', stepKind: 'code', code: 'output="must not run"', status: 'pending', output: ''};
  const workflow = {...flow('owner', [first, next]), status: 'running', currentStep: 0};
  const context = {stepOutputs: new Map(), stepIndex: 0};
  plugin.settings.tasks = [task]; plugin.settings.workflows = [workflow];
  plugin.workflowRuntime = new Map([[workflow.id, context]]);
  // Bypass only start admission; runTaskStep, executeTask and killTask stay real.
  plugin.runTask = (...args) => plugin.executeTask(...args);
  let launches = 0, attempt;
  plugin.cliTerminals = {openTask: async () => {
    launches++; attempt = plugin.legacyAttempts.get(task.id);
    throw new InteractiveTerminalLaunchUncertainError('PTY cleanup unconfirmed');
  }};
  await plugin.runTaskStep(workflow, first, 0);
  assert.equal(attempt.cancelled, true); assert.equal(attempt.owner.context, context);
  assert.equal(task.legacyExecution.stopState, 'unconfirmed');
  assert.equal(plugin.runningProcesses.has(task.id), false);
  assert.equal(workflow.status, 'failed'); assert.equal(workflow.currentStep, 0);
  assert.equal(plugin.workflowRuntime.has(workflow.id), false);
  assert.equal(context.stepOutputs.size, 0, 'completion callback must not publish a result or resolve force transitions');
  assert.equal(first.output, undefined); assert.equal(next.status, 'pending'); assert.equal(next.output, '');
  await assert.rejects(plugin.executeWorkflow(workflow), /Previous workflow outcome is unconfirmed/);
  assert.equal(launches, 1); assert.equal(next.status, 'pending');
});

test('source legacy generic pre-spawn terminal error remains a normal failed completion', async () => {
  const {plugin} = pluginHarness(), task = {...interactive(), model: 'chosen'};
  plugin.settings.tasks = [task]; let attempt, request, completion, launches = 0;
  plugin.cliTerminals = {openTask: async value => {
    launches++; request = value; attempt = plugin.legacyAttempts.get(task.id);
    throw new Error('terminal support unavailable before spawn');
  }};
  await plugin.executeTask(task, async (value, code) => { completion = {value, code}; });
  assert.equal(task.status, 'failed'); assert.equal(task.legacyExecution.stopState, undefined);
  assert.equal(attempt.cancelled, false); assert.equal(request.signal.aborted, false);
  assert.ok(task.legacyExecution.finishedAt);
  assert.equal(plugin.runningProcesses.has(task.id), false); assert.equal(plugin.legacyAttempts.has(task.id), false);
  assert.deepEqual(completion, {value: task, code: -1}); assert.equal(launches, 1);
  assert.match(task.output, /Could not open interactive OpenCode CLI: Error: terminal support unavailable before spawn/);
  assert.doesNotMatch(task.output, /external outcome unconfirmed/);
});

test('shared uncertain terminal launch retains in-flight journal and cannot silently relaunch', () => fixture(async root => {
  const h = terminalHarness(), f = installed(root);
  const {InteractiveTerminalLaunchUncertainError} = h.load('interactive-task-terminal');
  const run = h.load('installed-workflow-host').runInstalledWorkflow;
  const error = new InteractiveTerminalLaunchUncertainError('terminal spawn unconfirmed');
  let runId, launches = 0;
  const options = {vault: root, workflowId: 'parent', redact: s => s,
    onCheckpoint: async checkpoint => { runId = checkpoint.runId; },
    launchInteractiveTerminal: async () => { launches++; throw error; }};
  await assert.rejects(run(options), received => received === error);
  const checkpoint = h.load('execution-journal').readExecutionCheckpoint(f.runtime, runId);
  assert.equal(checkpoint.phase, 'in_flight');
  assert.equal(checkpoint.steps[0].status, 'completed');
  assert.equal(checkpoint.steps.at(-1).stepId, 'interactive');
  assert.equal(checkpoint.steps.at(-1).status, 'in_flight');
  assert.equal(checkpoint.steps.at(-1).result, undefined);
  assert.equal(fs.readFileSync(path.join(root, 'effect.txt'), 'utf8'), 'ran');
  await assert.rejects(run({...options, resumeRunId: runId}), /reconcil/i);
  assert.equal(launches, 1); assert.deepEqual(h.external, []); assert.deepEqual(h.background, []);
}));

for (const kind of ['task', 'workflow']) for (const engine of ['opencode', 'opencode2', 'codex', 'copilot']) {
  test(`real ${kind} creator prompt for ${engine} keeps global destination out of valid JSON examples`, () => {
    const {AUTOOC_WORKFLOW_PROMPT: guide, ImportModal} = pluginHarness();
    const {buildDraftPrompt, parseGeneratedDraft} = loader()('ai-draft');
    const finalPrompt = buildDraftPrompt(guide, kind, 'Synthetic objective', engine, require('../manifest.json').version);
    assert.match(finalPrompt, /Do not include cliTerminalDestination: terminal placement is a vault setting, not a task or workflow field/);
    assert.match(finalPrompt, /requires? a loaded Obsidian plugin for the integrated option/);
    assert.match(finalPrompt, /Keep interactiveTerminal false in drafts/);
    const example = JSON.parse(finalPrompt.split('CREATOR EXAMPLE (replace its content with the requested objective):\n')[1]
      .split('\n\nThe following JSON string')[0]);
    assert.equal(example.tasks[0].interactiveTerminal, false); assert.equal(example.tasks[0].taskKind, engine);
    assert.doesNotMatch(JSON.stringify(example), /cliTerminalDestination/);
    const draft = parseGeneratedDraft(JSON.stringify(example), kind, {engine, model: 'fixture/model', opencode2Model: 'fixture/v2',
      codexModel: '', copilotModel: '', agent: 'build'});
    assert.equal(draft.tasks[0].interactiveTerminal, false);
    const validation = ImportModal.prototype.validateExport.call({}, example);
    assert.equal(validation.ok, true, validation.errors.join('\n'));
  });
}

for (const name of ['minimal', 'nested']) test(`actual shared main guide ${name} example passes actual import validator`, () => {
  const {AUTOOC_WORKFLOW_PROMPT: guide, ImportModal} = pluginHarness();
  assert.match(guide, /cliTerminalDestination/);
  const minimalText = guide.split('Minimal valid workflow example:\n')[1].split('\n\nNested workflow package example')[0].trim();
  const nestedText = guide.split('Nested workflow package example (schema 1.7.0):\n')[1].split('\n\nGeneric interactive CLI import example')[0].split('\n\nNow write')[0].trim();
  const example = JSON.parse(name === 'minimal' ? minimalText : nestedText), result = ImportModal.prototype.validateExport.call({}, example);
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.doesNotMatch(JSON.stringify(example), /cliTerminalDestination/);
});

test('source shared plugin injects terminal callback into installed host without external fallback', () => fixture(async root => {
  let hostOptions;
  const h = terminalHarness({'installed-workflow-host': {runInstalledWorkflow: async options => { hostOptions = options; return 'host-result'; }}});
  const {plugin} = pluginHarness(h.load('main'));
  const workflow = flow('shared', [{id: 'code', stepKind: 'code', code: 'output=1'}]);
  plugin.settings.workflows = [workflow];
  plugin.pluginExecutionLease = {};
  plugin.selectedExecutionLocation = () => ({vault: root, installationDirectory: root, configurationFile: path.join(root, 'data.json')});
  plugin.settingsWriter = {fork: () => ({}), confirmedVersion: () => undefined};
  plugin.loadSettings = async () => {};
  plugin.refreshOpenViews = () => {};
  let received;
  plugin.cliTerminals = {openTask: async request => { received = request; }};
  assert.equal(await plugin.executeSharedWorkflow('shared'), 'host-result');
  assert.equal(hostOptions.workflowId, 'shared');
  const request = {bin: 'fixture', cwd: root, major: 1, label: 'Shared', model: 'm', agent: 'a', prompt, signal: hostOptions.signal};
  await hostOptions.launchInteractiveTerminal(request);
  assert.equal(received, request);
  plugin.cliTerminals = undefined;
  await assert.rejects(hostOptions.launchInteractiveTerminal(request), /No external terminal was started/);
  assert.deepEqual(h.external, []);
}));
