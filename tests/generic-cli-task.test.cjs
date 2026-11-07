const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const Module = require('node:module'), ts = require('typescript');

class Element {
  constructor(options = {}) { this.textContent = options.text || ''; this.children = []; this.style = {}; this.attrs = options.attr || {}; this.dataset = {}; this.value = ''; }
  createEl(tag, options = {}) { const el = new Element(options); el.tag = tag; this.children.push(el); return el; }
  createDiv(options) { return this.createEl('div', options); }
  createSpan(options) { return this.createEl('span', options); }
  empty() { this.children = []; }
  setText(value) { this.textContent = value; }
  addClass() {} removeClass() {} toggleClass() {} addEventListener() {} focus() {} select() {}
  setAttr(key, value) { this.attrs[key] = value; }
  setAttribute(key, value) { this.attrs[key] = value; }
  all() { return [this, ...this.children.flatMap(child => child.all())]; }
}
class Control {
  constructor(el) { this.inputEl = this.selectEl = this.buttonEl = el; }
  setValue(value) { this.inputEl.value = value; return this; }
  setButtonText(value) { this.buttonEl.textContent = value; return this; }
  setDisabled(value) { this.buttonEl.disabled = value; return this; }
  addOption(value, label) { const el = this.selectEl.createEl('option', {text: label}); el.value = value; return this; }
  addOptions(values) { for (const [value, label] of Object.entries(values)) this.addOption(value, label); return this; }
  setCta() { return this; } setWarning() { return this; } setPlaceholder() { return this; } setTooltip() { return this; }
  onChange(callback) { this.inputEl.change = callback; return this; }
  onClick(callback) { this.buttonEl.onclick = callback; return this; }
}
class Setting {
  constructor(parent) { this.settingEl = parent.createDiv(); this.controlEl = this.infoEl = this.settingEl; }
  setName(name) { this.settingEl.name = name; return this; }
  setDesc(desc) { this.settingEl.desc = desc; return this; }
  setHeading() { return this; }
  add(tag, callback) { callback(new Control(this.settingEl.createEl(tag))); return this; }
  addText(cb) { return this.add('input', cb); } addTextArea(cb) { return this.add('textarea', cb); }
  addDropdown(cb) { return this.add('select', cb); } addToggle(cb) { return this.add('input', cb); }
  addButton(cb) { return this.add('button', cb); }
}

const compiled = new Map();
function loader(overrides = {}) {
  const cache = new Map(), notices = [];
  class Stub {}
  const obsidian = {Plugin: Stub, ItemView: Stub, PluginSettingTab: Stub, Setting,
    Notice: class { constructor(message) { notices.push(message); } },
    Modal: class { constructor(app) { this.app = app; this.contentEl = new Element(); } open() { this.onOpen(); } close() { this.onClose(); } }};
  const processes = new Proxy({}, {get: (_target, name) => () => { throw Error(`Unexpected process: ${String(name)}`); }});
  function load(name) {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (cache.has(name)) return cache.get(name).exports;
    const file = path.resolve(__dirname, '..', name + '.ts'), m = new Module(file, module);
    m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file)); cache.set(name, m);
    const original = m.require.bind(m);
    m.require = id => id === 'obsidian' ? obsidian : id === 'child_process' || id === 'node:child_process' ? processes :
      id.startsWith('./') && !path.extname(id) ? load(id.slice(2)) : original(id);
    // Current source, never the potentially stale distributed main.js.
    const source = fs.readFileSync(file, 'utf8');
    if (compiled.get(file)?.source !== source) compiled.set(file, {source, text: ts.transpileModule(source, {
      compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
    }).outputText});
    const prefix = name === 'main' ? 'const window = {setTimeout: () => 0};\n' : '';
    const suffix = name === 'main' ? '\nmodule.exports.genericTest = {CreateTaskModal, ImportModal, toExportTask, AUTOOC_WORKFLOW_PROMPT, CLI_TASK_COMMAND_NOTICE};' : '';
    m._compile(prefix + compiled.get(file).text + suffix, file);
    return m.exports;
  }
  load.notices = notices;
  return load;
}

function harness(overrides = {}) {
  const external = [], versions = [], raw = loader();
  const launchers = raw('cli-launchers'), code = raw('code-runtime');
  const load = loader({
    'cli-launchers': {...launchers, openOpencodeCli: (...args) => external.push(args),
      openOpencodeCliLongPromptWindows: (...args) => external.push(args)},
    // Real trusted interpreter and filesystem; only replace its subprocess transport.
    'code-runtime': {...code, executeCodeAsync: async options => code.executeCode(options)},
    'opencode-version': {assertOpenCode2: async bin => { versions.push(bin); }}, ...overrides,
  });
  return {load, external, versions};
}
const providers = ['opencode', 'opencode2', 'codex', 'copilot', 'claude'];
const pathKeys = ['opencodePath', 'opencode2Path', 'codexPath', 'copilotPath', 'claudePath'];
const taskOf = (provider = 'codex') => ({id: 'cli-task', name: 'Synthetic CLI', taskKind: 'cli', cliProvider: provider,
  interactiveTerminal: true, prompt: 'Review with me.', scheduleType: 'manual', status: 'pending', output: ''});
const flow = (id, steps) => ({id, name: id, steps, handoffOutput: true});
const taskStep = {id: 'launch', stepKind: 'task', taskId: 'cli-task'};
const handoff = 'Exact input\n"quotes" $() `ticks` \\ end\n' + 'long context\n'.repeat(3000);
const acknowledgement = '[opened interactive CLI with preloaded prompt; interactive task result is not observed]';
async function fixture(work) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'autooc-generic-cli-'));
  try {
    const settings = {workingDirectory: root, cliTerminalDestination: 'integrated', defaultAiEngine: 'opencode',
      defaultModel: 'background/model', defaultOpencode2Model: 'background/v2', defaultAgent: 'background-agent',
      defaultOpencode2Agent: 'background-v2-agent', defaultCodexModel: 'background-codex', defaultCopilotModel: 'background-copilot',
      defaultCodexReasoningEffort: 'medium', taskTimeoutSeconds: 2, logsEnabled: false};
    providers.forEach((provider, index) => {
      const file = path.join(root, provider + (process.platform === 'win32' ? '.cmd' : ''));
      fs.writeFileSync(file, 'synthetic executable, never launched', {mode: 0o755}); settings[pathKeys[index]] = file;
    });
    return await work(root, settings);
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
}

for (const provider of providers) test(`generic ${provider} dispatch preserves exact request and waits for acknowledgement`, () => fixture(async (root, settings) => {
  const h = harness(), requests = [], signal = new AbortController().signal;
  const task = {...taskOf(provider), model: 'selected/model', ...(provider.startsWith('opencode') ? {agent: 'review'} : {}),
    ...(provider === 'codex' ? {reasoningEffort: 'high'} : {})};
  const definition = h.load('workflow-definition').prepareWorkflowDefinition(flow('w', [taskStep]), [task], settings);
  settings[pathKeys[providers.indexOf(provider)]] = path.join(root, 'changed-after-snapshot');
  let acknowledge, settled = false;
  const adapter = h.load('workflow-task-adapters').createWorkflowTaskAdapter(definition, root, undefined,
    {destination: 'integrated', launch: request => { requests.push(request); return new Promise(resolve => { acknowledge = resolve; }); }});
  assert.equal(adapter.supports(task), true);
  const pending = adapter.execute(definition.tasks[0], handoff, signal).then(result => { settled = true; return result; });
  assert.equal(settled, false); assert.equal(requests.length, 1);
  assert.deepEqual(requests[0], {provider, bin: definition.settings[pathKeys[providers.indexOf(provider)]], cwd: root,
    label: task.name, major: provider === 'opencode2' ? 2 : 1, model: 'selected/model',
    agent: provider.startsWith('opencode') ? 'review' : '', prompt: handoff,
    reasoningEffort: provider === 'codex' ? 'high' : undefined, signal});
  acknowledge('not the session result');
  assert.deepEqual(await pending, {succeeded: true, output: acknowledgement}); assert.deepEqual(h.external, []);
}));

test('generic native defaults never inherit background models/agents', () => fixture((root, settings) => {
  const {prepareCliTask} = harness().load('interactive-cli-task');
  for (const provider of providers) {
    const request = prepareCliTask(taskOf(provider), {...settings, cliLauncherEnabled: {[provider]: false}}, root, handoff);
    assert.equal(request.model, ''); assert.equal(request.agent, ''); assert.equal(request.reasoningEffort, undefined);
    assert.equal(request.prompt, handoff);
  }
  const forced = prepareCliTask({...taskOf('opencode'), model: 'selected', agent: 'review', forceModel: true}, settings, root, handoff);
  assert.equal(forced.model, 'selected'); assert.equal(forced.agent, '');
}));

test('generic cwd selection uses task, frozen settings, then vault and rejects invalid paths', () => fixture(async (root, settings) => {
  const h = harness(), requests = [], taskDirectory = path.join(root, 'task'), globalDirectory = path.join(root, 'global');
  fs.mkdirSync(taskDirectory); fs.mkdirSync(globalDirectory);
  for (const [workingDirectory, configured, expected] of [[taskDirectory, globalDirectory, taskDirectory], [undefined, globalDirectory, globalDirectory], [undefined, '', root]]) {
    const adapter = h.load('workflow-task-adapters').createWorkflowTaskAdapter({settings: {...settings, workingDirectory: configured}}, root, undefined,
      {destination: 'integrated', launch: async request => { requests.push(request); }});
    await adapter.execute({...taskOf(), workingDirectory}, handoff);
    assert.equal(requests.at(-1).cwd, expected);
  }
  const {prepareCliTask} = h.load('interactive-cli-task');
  for (const cwd of ['relative', path.join(root, 'missing'), settings.codexPath]) {
    assert.throws(() => prepareCliTask(taskOf(), settings, cwd, handoff));
  }
  assert.equal(requests.length, 3); assert.deepEqual(h.external, []);
}));

for (const provider of providers) for (const destination of [undefined, 'external']) {
  test(`generic ${provider} ${destination || 'absent destination'} uses original external callback route`, () => fixture(async (root, settings) => {
    const h = harness(); let integrated = 0, settled = false;
    const adapter = h.load('cli-workflow-adapters').createInteractiveCliWorkflowAdapter({settings}, root,
      {destination, launch: async () => { integrated++; }});
    const pending = adapter.execute(taskOf(provider), handoff).then(result => { settled = true; return result; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(integrated, 0); assert.equal(settled, false); assert.equal(h.external.length, 1);
    const args = h.external[0], callbacks = args.at(-1);
    if (process.platform === 'win32') {
      assert.equal(args[0], settings[pathKeys[providers.indexOf(provider)]]); assert.equal(args[3], ''); assert.equal(args[4], '');
      assert.equal(args[5], handoff);
      assert.deepEqual(callbacks.promptArgs('pointer.txt'), h.load('interactive-cli-profile').interactiveCliTaskArgs(provider, '', '', 'pointer.txt'));
    } else {
      assert.equal(args[0], '/bin/sh');
      const script = fs.readFileSync(args[3][0], 'utf8'), directory = path.dirname(args[3][0]);
      assert.match(script, /trap cleanup EXIT/); assert.equal(fs.readFileSync(path.join(directory, 'prompt.txt'), 'utf8'), handoff);
      assert.doesNotMatch(script, /--allow-all|dangerously-skip|--yolo/);
    }
    callbacks.onLaunched(); assert.deepEqual(await pending, {succeeded: true, output: acknowledgement});
    assert.deepEqual(h.versions, provider === 'opencode2' ? [settings.opencode2Path] : []);
  }));
}

test('generic integrated failures never fall back; cancellation prevents launch', () => fixture(async (root, settings) => {
  const h = harness(), api = h.load('cli-workflow-adapters');
  for (const launch of [undefined, async () => { throw Error('PTY unavailable'); }]) {
    const adapter = api.createInteractiveCliWorkflowAdapter({settings}, root, {destination: 'integrated', launch});
    await assert.rejects(adapter.execute(taskOf(), handoff), launch ? /PTY unavailable/ : /No external terminal was started/);
  }
  const controller = new AbortController(); controller.abort();
  const adapter = api.createInteractiveCliWorkflowAdapter({settings}, root, {destination: 'integrated', launch: async () => assert.fail('aborted launch')});
  await assert.rejects(adapter.execute(taskOf(), handoff, controller.signal), /cancelled before launch/);
  assert.deepEqual(h.external, []);
}));

const invalid = [
  ['missing provider', {cliProvider: undefined}], ['unknown provider', {cliProvider: 'unknown'}],
  ['noninteractive', {interactiveTerminal: false}], ['malformed interactive', {interactiveTerminal: 'true'}],
  ['missing prompt', {prompt: undefined}], ['blank prompt', {prompt: '  '}], ['nonstring model', {model: 42}],
  ['foreign agent', {agent: 'build'}], ['malformed agent', {agent: false}], ['malformed forceModel', {forceModel: 'true'}],
  ['nonstring reasoning', {reasoningEffort: true}], ['blank reasoning', {reasoningEffort: ' '}],
  ['foreign reasoning', {cliProvider: 'claude', reasoningEffort: 'high'}], ['branch', {branch: 'feature'}], ['malformed branch', {branch: false}],
  ...['codeAllowVault', 'codeAllowFiles', 'codeAllowTerminal', 'copilotAllowAllTools', 'useRalphLoop', 'createBranch']
    .flatMap(field => [[field, {[field]: true}], [`malformed ${field}`, {[field]: 'false'}]]),
];
function installation(root, settings, task, nested = false) {
  const directory = path.join(root, '.obsidian', 'plugins', 'auto-oc'); fs.mkdirSync(directory, {recursive: true});
  const before = {id: 'before', stepKind: 'code', codeAllowFiles: true, code: 'files.write("effect.txt", "ran"); output="Code handoff";'};
  const workflows = [flow('parent', [before, nested ? {id: 'child', stepKind: 'workflow', workflowId: 'child'} : taskStep])];
  if (nested) workflows.push(flow('child', [taskStep]));
  const catalog = {...settings, tasks: [task], workflows}, file = path.join(directory, 'data.json');
  fs.writeFileSync(file, JSON.stringify(catalog)); return {file, directory, runtime: path.join(directory, 'runtime'), catalog};
}
for (const nested of [false, true]) test(`all invalid generic flags reject before ${nested ? 'nested' : 'later'} CLI, Code or journal`, () => fixture(async (root, settings) => {
  const h = harness(), {getCliTaskValidationError: validate} = h.load('interactive-cli-task');
  for (const [name, patch] of invalid) {
    const task = {...taskOf(), ...patch}, error = validate(task);
    assert.equal(typeof error, 'string', name);
    const f = installation(root, settings, task, nested), original = fs.readFileSync(f.file, 'utf8');
    await assert.rejects(h.load('installed-workflow-host').runInstalledWorkflow({vault: root, workflowId: 'parent', redact: s => s,
      launchInteractiveTerminal: async () => assert.fail(name)}), undefined, name);
    assert.equal(fs.existsSync(f.runtime), false, name); assert.equal(fs.existsSync(path.join(root, 'effect.txt')), false, name);
    assert.equal(fs.readFileSync(f.file, 'utf8'), original, name);
  }
  assert.deepEqual(h.external, []);
}));

test('canonical validator forbids provider on old kinds and accepts explicit disabled capabilities', () => {
  const {getCliTaskValidationError: validate} = harness().load('interactive-cli-task');
  for (const taskKind of ['opencode', 'opencode2', 'codex', 'copilot', 'code', undefined]) {
    assert.equal(validate({taskKind}), null); assert.match(validate({taskKind, cliProvider: 'codex'}), /only valid for taskKind cli/);
  }
  const task = {...taskOf(), model: '', agent: '', branch: '', forceModel: false};
  for (const key of ['codeAllowVault', 'codeAllowFiles', 'codeAllowTerminal', 'copilotAllowAllTools', 'useRalphLoop', 'createBranch']) task[key] = false;
  assert.equal(validate(task), null);
});

for (const nested of [false, true]) test(`generic integrated ${nested ? 'nested' : 'later'} task requires plugin before any effects`, () => fixture(async (root, settings) => {
  const h = harness(), f = installation(root, settings, taskOf('claude'), nested);
  await assert.rejects(h.load('installed-workflow-host').runInstalledWorkflow({vault: root, workflowId: 'parent', redact: s => s}), /loaded Obsidian/);
  assert.equal(fs.existsSync(f.runtime), false); assert.equal(fs.existsSync(path.join(root, 'effect.txt')), false); assert.deepEqual(h.external, []);
}));

test('installed generic callback receives real Code handoff and native defaults', () => fixture(async (root, settings) => {
  const h = harness(), f = installation(root, settings, taskOf('claude')); let request;
  const result = await h.load('installed-workflow-host').runInstalledWorkflow({vault: root, workflowId: 'parent', redact: s => s,
    launchInteractiveTerminal: async received => { request = received; }});
  assert.equal(result.phase, 'completed'); assert.equal(result.steps.at(-1).output, acknowledgement);
  assert.equal(fs.readFileSync(path.join(root, 'effect.txt'), 'utf8'), 'ran');
  assert.equal(request.provider, 'claude'); assert.equal(request.bin, settings.claudePath); assert.equal(request.model, ''); assert.equal(request.agent, '');
  assert.equal(request.prompt, h.load('workflow-handoff').workflowTaskPrompt(taskOf().prompt, f.catalog.workflows[0], {stepId: 'before', output: 'Code handoff'}));
  assert.deepEqual(h.external, []);
}));

test('frozen fingerprints include provider2 and selected Claude path only, never terminal placement', () => fixture(async (root, settings) => {
  const {prepareWorkflowDefinition: prepare, prepareWorkflowDefinitionAsync: prepareAsync} = harness().load('workflow-definition');
  const workflow = flow('w', [taskStep]);
  for (const task of [taskOf('opencode2'), taskOf('claude'), {...taskOf(), taskKind: 'codex', cliProvider: undefined}, {...taskOf(), taskKind: 'opencode', cliProvider: undefined}]) {
    const original = prepare(workflow, [task], settings);
    assert.deepEqual(await prepareAsync(workflow, [task], {...settings, cliTerminalDestination: 'external'}), original);
    assert.equal(original.settings.cliTerminalDestination, undefined);
    const changedClaude = prepare(workflow, [task], {...settings, claudePath: 'another-claude'});
    assert.equal(original.hash === changedClaude.hash, task.cliProvider !== 'claude');
    assert.equal(Object.hasOwn(original.settings, 'claudePath'), task.cliProvider === 'claude');
    if (task.cliProvider === 'opencode2') {
      assert.equal(original.settings.opencode2Path, settings.opencode2Path);
      assert.equal(original.settings.defaultOpencode2Model, settings.defaultOpencode2Model);
      assert.notEqual(prepare(workflow, [task], {...settings, opencode2Path: 'other-v2'}).hash, original.hash);
    }
    if (task.taskKind !== 'cli') {
      assert.equal(prepare(workflow, [task], {...settings, opencode2Path: 'unrelated-v2'}).hash, original.hash);
    }
  }
}));

let mainHarness;
function pluginHarness(settings = {}, root = os.tmpdir()) {
  mainHarness ||= harness();
  const api = mainHarness.load('main'), plugin = new api.default();
  plugin.app = {vault: {adapter: {basePath: root}}}; plugin.manifest = {version: require('../manifest.json').version};
  plugin.settings = {defaultAiEngine: 'codex', defaultModel: 'background/model', defaultCodexReasoningEffort: 'medium',
    cliTerminalDestination: 'integrated', tasks: [], workflows: [], ...settings};
  plugin.availableModels = []; plugin.availableAgents = []; plugin.availableCodexModels = [];
  plugin.getEffectiveDefaultModel = () => 'background/model'; plugin.getEffectiveCodexModel = () => 'background/codex';
  plugin.getEffectiveAgent = () => 'background-agent'; plugin.getCodexReasoningEfforts = () => ['medium', 'high'];
  plugin.saveSettings = async () => {}; plugin.beginExecutionEffects = () => {}; plugin.refreshStartControls = () => {};
  return {plugin, ...api.genericTest};
}
function control(modal, name, tag) {
  const setting = modal.contentEl.all().find(el => el.name === name);
  assert.ok(setting, `Missing setting ${name}`);
  const el = setting.all().find(el => el.tag === tag); assert.ok(el, `Missing ${tag} for ${name}`); return el;
}
function button(modal, text) {
  const el = modal.contentEl.all().find(el => el.tag === 'button' && el.textContent === text);
  assert.ok(el, `Missing button ${text}`); return el;
}

for (const provider of providers) test(`real editor creates, edits, drafts and round-trips ${provider} native defaults`, () => fixture(async (root, settings) => {
  const {plugin, CreateTaskModal, ImportModal} = pluginHarness(settings, root);
  const editor = new CreateTaskModal(plugin.app, plugin); editor.open();
  const type = control(editor, 'Task type', 'select');
  assert.ok(type.children.some(el => el.value === 'interactive-cli'));
  assert.ok(type.children.some(el => el.value === 'codex-app'));
  type.change('interactive-cli');
  const providerSelect = control(editor, 'Harness', 'select');
  assert.deepEqual(providerSelect.children.map(el => el.value), providers);
  providerSelect.change(provider);
  assert.equal(control(editor, 'Model (optional)', 'input').value, '');
  assert.equal(editor.contentEl.all().some(el => el.name === 'Agent (optional)'), provider.startsWith('opencode'));
  assert.equal(editor.contentEl.all().some(el => el.name === 'Reasoning effort (optional)'), provider === 'codex');
  control(editor, 'Name', 'input').change('Created ' + provider);
  control(editor, 'Prompt / Goal', 'textarea').change('Interactive prompt');
  await button(editor, 'Create Task').onclick();
  assert.equal(plugin.settings.tasks.length, 1);
  const created = plugin.settings.tasks[0];
  assert.ok(created.id); assert.equal(created.model, ''); assert.equal(created.agent, '');
  assert.equal(created.cliProvider, provider); assert.equal(created.taskKind, 'cli'); assert.equal(created.interactiveTerminal, true);
  created.output = 'saved history'; created.status = 'completed';
  const edit = new CreateTaskModal(plugin.app, plugin, created); edit.open();
  control(edit, 'Name', 'input').change('Edited ' + provider); await button(edit, 'Save Changes').onclick();
  const saved = plugin.settings.tasks[0]; assert.equal(saved.id, created.id); assert.equal(saved.output, 'saved history'); assert.equal(saved.model, '');
  let draft;
  const draftEditor = new CreateTaskModal(plugin.app, plugin, saved, task => { draft = task; }); draftEditor.open();
  await button(draftEditor, 'Apply to workflow draft').onclick();
  assert.equal(draft.id, saved.id); assert.equal(draft.model, ''); assert.equal(draft.cliProvider, provider);
  const exported = JSON.parse(plugin.buildExportJson([saved], []));
  const check = ImportModal.prototype.validateExport.call({}, exported); assert.equal(check.ok, true, check.errors.join('\n'));
  assert.equal(exported.tasks[0].model, ''); assert.equal(exported.tasks[0].cliProvider, provider);
  await plugin.importFromData(exported);
  const imported = plugin.settings.tasks[1]; assert.notEqual(imported.id, saved.id); assert.equal(imported.model, ''); assert.equal(imported.agent, '');
  assert.equal(imported.cliProvider, provider); assert.equal(imported.interactiveTerminal, true);
}));

test('real create/edit/saveDraft buttons reject invalid provider, prompt and malformed capabilities', () => fixture(async (root, settings) => {
  for (const mode of ['new', 'edit', 'draft']) for (const patch of [{cliProvider: 'unknown'}, {prompt: ''}, {codeAllowFiles: 'false'}]) {
    const {plugin, CreateTaskModal} = pluginHarness(settings, root);
    const existing = {...taskOf(), model: ''}; let saves = 0, drafts = 0;
    plugin.saveSettings = async () => { saves++; };
    if (mode === 'edit') plugin.settings.tasks = [existing];
    const modal = new CreateTaskModal(plugin.app, plugin, mode === 'new' ? undefined : existing,
      mode === 'draft' ? () => { drafts++; } : undefined);
    modal.draft = {...existing, ...patch}; modal.open();
    await button(modal, mode === 'new' ? 'Create Task' : mode === 'edit' ? 'Save Changes' : 'Apply to workflow draft').onclick();
    assert.equal(saves, 0); assert.equal(drafts, 0);
    assert.deepEqual(plugin.settings.tasks, mode === 'edit' ? [existing] : []);
  }
}));

test('explicit generic model/agent/reasoning survive actual export and import without background substitution', async () => {
  const {plugin, ImportModal} = pluginHarness();
  plugin.settings.tasks = providers.map(provider => ({...taskOf(provider), id: provider, model: 'selected/' + provider,
    agent: provider.startsWith('opencode') ? 'selected-agent' : '', ...(provider === 'codex' ? {reasoningEffort: 'high'} : {})}));
  const exported = JSON.parse(plugin.buildExportJson(plugin.settings.tasks, []));
  const result = ImportModal.prototype.validateExport.call({}, exported); assert.equal(result.ok, true, result.errors.join('\n'));
  await plugin.importFromData(exported);
  for (const [index, provider] of providers.entries()) {
    const imported = plugin.settings.tasks[providers.length + index];
    assert.equal(imported.model, 'selected/' + provider); assert.equal(imported.agent, provider.startsWith('opencode') ? 'selected-agent' : '');
    assert.equal(imported.reasoningEffort, provider === 'codex' ? 'high' : undefined);
    assert.notEqual(imported.id, provider);
  }
});

test('real import/export/raw validators reject malformed generic definitions without catalog mutation', async () => {
  const {plugin, ImportModal, toExportTask} = pluginHarness();
  for (const [name, patch] of invalid) {
    const task = {...taskOf(), exportId: 'exported', ...patch};
    const data = {autoOCExport: {schemaVersion: '1.7.0'}, tasks: [task], workflows: []};
    assert.equal(ImportModal.prototype.validateExport.call({}, data).ok, false, name);
    assert.throws(() => toExportTask(task, 'exported'), undefined, name);
    assert.equal(typeof plugin.getMcpRawTaskPayloadError(task), 'string', name);
    await assert.rejects(plugin.importFromData(data), undefined, name);
    assert.deepEqual(plugin.settings.tasks, [], name);
  }
});

const invalidMixedImports = [
  ['Copilot interactive', {taskKind: 'copilot', interactiveTerminal: true}, /Copilot tasks run in the background/],
  ['OpenCode 2 Ralph Loop', {taskKind: 'opencode2', useRalphLoop: true}, /Ralph Loop.*only supported for OpenCode 1/],
  ['Code interactive', {taskKind: 'code', code: 'output=1', interactiveTerminal: true}, /cannot combine Code with interactiveTerminal/],
  ['OpenCode reasoning', {taskKind: 'opencode', reasoningEffort: 'high'}, /reasoningEffort outside a Codex task/],
  ['Copilot reasoning', {taskKind: 'copilot', interactiveTerminal: false, reasoningEffort: 'high'}, /reasoningEffort outside a Codex task/],
  ['Codex blank reasoning', {taskKind: 'codex', reasoningEffort: ' '}, /reasoningEffort outside a Codex task/],
  ['Codex malformed reasoning', {taskKind: 'codex', reasoningEffort: 42}, /reasoningEffort outside a Codex task/],
  ['legacy provider', {taskKind: 'codex', cliProvider: 'codex'}, /cliProvider is only valid for taskKind cli/],
  ['legacy Copilot permission', {taskKind: 'copilot', copilotAllowAllTools: 'false'}, /copilotAllowAllTools must be a boolean/],
  ['unknown kind', {taskKind: 'unknown'}, /Unsupported taskKind/],
  ['generic provider', {taskKind: 'cli', cliProvider: 'unknown', interactiveTerminal: true}, /known cliProvider/],
  ['generic capability', {taskKind: 'cli', cliProvider: 'claude', interactiveTerminal: true, codeAllowFiles: true}, /codeAllowFiles is not supported/],
];
for (const [name, invalidTask, expectedError] of invalidMixedImports) {
  test(`import prepass rejects later ${name} atomically after valid CLI and mixed legacy rows`, async t => {
    const {plugin} = pluginHarness();
    const existing = {...taskOf('claude'), id: 'existing-task', status: 'completed', output: 'retained synthetic result',
      runtimeExecution: {runId: 'retained-run', workflowId: 'retained-workflow', revision: 8, phase: 'completed'},
      history: [{runId: 'earlier-run', output: 'retained earlier result'}]};
    const workflow = {...flow('existing-workflow', [{...taskStep, taskId: existing.id}]), status: 'failed', currentStep: 0,
      output: 'retained workflow evidence', legacyExecution: {token: 'retained-token'}};
    plugin.settings.tasks = [existing]; plugin.settings.workflows = [workflow];
    const catalog = plugin.settings, tasks = catalog.tasks, workflows = catalog.workflows;
    const evidence = existing.runtimeExecution, history = existing.history, owner = workflow.legacyExecution;
    const snapshot = JSON.stringify(catalog);
    let saves = 0, namesAllocated = 0;
    plugin.saveSettings = async () => { saves++; };
    const allocateName = plugin.ensureUniqueTaskName.bind(plugin);
    plugin.ensureUniqueTaskName = name => { namesAllocated++; return allocateName(name); };
    const taskPush = t.mock.fn(Array.prototype.push), workflowPush = t.mock.fn(Array.prototype.push);
    Object.defineProperty(tasks, 'push', {value: taskPush, configurable: true});
    Object.defineProperty(workflows, 'push', {value: workflowPush, configurable: true});
    const cli = {...taskOf('codex'), exportId: 'valid-cli', model: ''};
    const legacy = {exportId: 'valid-legacy', taskKind: 'opencode', name: 'Valid legacy', prompt: 'Synthetic instruction', interactiveTerminal: false};
    const bad = {exportId: 'bad', name: 'Invalid later task', prompt: 'Synthetic instruction', scheduleType: 'manual', ...invalidTask};
    // First reproduce valid CLI followed immediately by invalid legacy; then mix both kinds before the invalid row.
    for (const incoming of [[cli, bad], [legacy, cli, bad]]) {
      const data = {autoOCExport: {schemaVersion: '1.7.0'}, tasks: incoming,
        workflows: [{exportId: 'incoming-workflow', name: 'Must not import', steps: [
          {id: 'incoming-step', stepKind: 'task', taskExportId: 'valid-cli', transitions: []},
        ]}]};
      const source = JSON.stringify(data); let importedCounters;
      await assert.rejects(plugin.importFromData(data).then(result => { importedCounters = result; }), expectedError);
      assert.equal(importedCounters, undefined, 'no successful import counts may be returned');
      assert.equal(plugin.settings, catalog); assert.equal(plugin.settings.tasks, tasks); assert.equal(plugin.settings.workflows, workflows);
      assert.equal(tasks.length, 1); assert.equal(workflows.length, 1);
      assert.equal(tasks[0], existing); assert.equal(workflows[0], workflow);
      assert.equal(existing.runtimeExecution, evidence); assert.equal(existing.history, history); assert.equal(workflow.legacyExecution, owner);
      assert.equal(JSON.stringify(catalog), snapshot); assert.equal(JSON.stringify(data), source);
      assert.equal(taskPush.mock.callCount(), 0); assert.equal(workflowPush.mock.callCount(), 0);
      assert.equal(namesAllocated, 0); assert.equal(saves, 0);
    }
  });
}

test('import prepass accepts compatible generic and legacy types with accurate counters', async () => {
  const {plugin} = pluginHarness(); let saves = 0;
  plugin.saveSettings = async () => { saves++; };
  const rows = [
    {...taskOf('codex'), exportId: 'generic', reasoningEffort: 'high'},
    {exportId: 'copilot', taskKind: 'copilot', interactiveTerminal: false, copilotAllowAllTools: false},
    {exportId: 'v2', taskKind: 'opencode2', interactiveTerminal: true, useRalphLoop: false},
    {exportId: 'code', taskKind: 'code', interactiveTerminal: false, code: 'output=1'},
    {exportId: 'codex-app', taskKind: 'codex', interactiveTerminal: true, reasoningEffort: 'high'},
    {exportId: 'absent-kind', interactiveTerminal: false},
  ].map((row, index) => ({name: 'Compatible ' + index, prompt: 'Synthetic instruction', scheduleType: 'manual', ...row}));
  const result = await plugin.importFromData({autoOCExport: {schemaVersion: '1.7.0'}, tasks: rows, workflows: []});
  assert.deepEqual(result, {tasksImported: rows.length, workflowsImported: 0}); assert.equal(saves, 1);
  assert.equal(plugin.settings.tasks.length, rows.length);
  assert.equal(new Set(plugin.settings.tasks.map(task => task.id)).size, rows.length);
  assert.equal(plugin.settings.tasks[0].model, '');
  assert.equal(plugin.settings.tasks[4].taskKind, 'codex'); assert.equal(plugin.settings.tasks[4].interactiveTerminal, true);
});

for (const [failure, message] of [
  ['timeout', 'Interactive CLI startup was not confirmed within 30 seconds; prompt retained until session exit'],
  ['readState error', 'Interactive CLI launcher failed; check the session and Windows process inspection availability'],
  ['observer exit', 'Interactive CLI observer exited without startup confirmation; prompt retained'],
]) {
  test(`legacy generic external ${failure} preserves real uncertain-error semantics and blocks relaunch`, () => fixture(async (root, settings) => {
    const source = loader(), terminal = source('interactive-task-terminal'), launchers = source('cli-launchers');
    const error = new terminal.InteractiveTerminalLaunchUncertainError(message);
    let transports = 0, callbacks = 0, attempt, plugin;
    const failTransport = (...args) => {
      transports++;
      assert.equal(error.constructor, terminal.InteractiveTerminalLaunchUncertainError);
      assert.ok(error instanceof Error); assert.equal(error.code, 'AUTOOC_TERMINAL_UNCERTAIN');
      attempt = plugin.legacyAttempts.get('cli-task');
      const options = args.at(-1);
      if (process.platform === 'win32') {
        assert.equal(args[0], settings.codexPath); assert.equal(args[3], ''); assert.equal(args[4], ''); assert.equal(args[5], handoff);
        assert.deepEqual(options.promptArgs('prompt-pointer'), ['--', 'prompt-pointer']);
      }
      options.onError(error);
    };
    // Only the OS transport is doubled: external preparation, provider profiles and main remain source-real.
    const h = harness({'interactive-task-terminal': terminal, 'cli-launchers': {...launchers,
      openOpencodeCliLongPromptWindows: failTransport, openOpencodeCli: failTransport, resolveLinuxTerminal: () => 'synthetic-terminal'}});
    const api = h.load('main'); plugin = new api.default();
    const task = {...taskOf('codex'), prompt: handoff};
    plugin.app = {vault: {adapter: {basePath: root}}};
    plugin.settings = {...settings, cliTerminalDestination: 'external', tasks: [task], workflows: []};
    plugin.beginExecutionEffects = () => {}; plugin.refreshStartControls = () => {};
    const saved = []; plugin.saveSettings = async () => { saved.push(JSON.parse(JSON.stringify(task))); };
    plugin.cliTerminals = {openTask: async () => assert.fail('external launch fell back to integrated terminal')};
    assert.equal(plugin.killTask, api.default.prototype.killTask);
    assert.equal(h.load('interactive-task-terminal').InteractiveTerminalLaunchUncertainError, error.constructor);
    assert.deepEqual(h.load('interactive-cli-profile').interactiveCliTaskArgs('codex', '', '', 'prompt-pointer'), ['--', 'prompt-pointer']);
    await plugin.executeTask(task, async () => { callbacks++; });
    assert.equal(transports, 1); assert.equal(callbacks, 0);
    assert.equal(task.status, 'failed'); assert.equal(task.legacyExecution.stopState, 'unconfirmed');
    assert.equal(task.legacyExecution.finishedAt, undefined); assert.equal(attempt.cancelled, true);
    assert.equal(plugin.legacyAttempts.get(task.id), attempt); assert.equal(plugin.runningProcesses.has(task.id), false);
    assert.match(task.output, /Interactive terminal outcome is unconfirmed/); assert.ok(task.output.includes(message));
    assert.equal(saved.at(-1).legacyExecution.stopState, 'unconfirmed'); assert.equal(saved.at(-1).output, task.output);
    await assert.rejects(plugin.executeTask(task, async () => { callbacks++; }), /outcome is unconfirmed/);
    assert.equal(transports, 1); assert.equal(callbacks, 0);
  }));
}

test('legacy generic callback launches once with native model and coded uncertainty uses official killTask', () => fixture(async (root, settings) => {
  const {plugin} = pluginHarness(settings, root); let request, launches = 0, completion;
  const task = taskOf('claude'); plugin.settings.tasks = [task];
  plugin.cliTerminals = {openTask: async value => { launches++; request = value; }};
  await plugin.executeTask(task, async (value, code) => { completion = {value, code}; }, {prompt: handoff});
  assert.equal(request.prompt, handoff); assert.equal(request.model, ''); assert.equal(request.provider, 'claude');
  assert.deepEqual(completion, {value: task, code: 0}); assert.match(task.output, /launch confirmed; agent task completion is not tracked/);
  const uncertain = {...taskOf('copilot'), id: 'uncertain'}; plugin.settings.tasks.push(uncertain);
  const {InteractiveTerminalLaunchUncertainError} = mainHarness.load('interactive-task-terminal');
  let attempt, callbacks = 0;
  plugin.cliTerminals = {openTask: async value => {
    launches++; request = value; attempt = plugin.legacyAttempts.get(uncertain.id);
    throw new InteractiveTerminalLaunchUncertainError('unknown spawn');
  }};
  assert.equal(plugin.killTask, mainHarness.load('main').default.prototype.killTask);
  await plugin.executeTask(uncertain, async () => { callbacks++; });
  assert.equal(uncertain.legacyExecution.stopState, 'unconfirmed'); assert.equal(attempt.cancelled, true);
  assert.equal(plugin.runningProcesses.has(uncertain.id), false); assert.equal(request.signal.aborted, true); assert.equal(callbacks, 0);
  await assert.rejects(plugin.executeTask(uncertain, async () => { callbacks++; }), /outcome is unconfirmed/);
  assert.equal(launches, 2); assert.equal(callbacks, 0);
}));

test('legacy Codex App and background kinds are not rerouted to generic terminal', async () => {
  const {plugin} = pluginHarness(); let codex = 0, copilot = 0;
  plugin.cliTerminals = {openTask: async () => assert.fail('generic terminal called')};
  plugin.runCodexTask = async () => { codex++; }; plugin.runCopilotTask = async () => { copilot++; };
  for (const interactiveTerminal of [false, true]) {
    const task = {...taskOf(), id: 'codex-' + interactiveTerminal, taskKind: 'codex', cliProvider: undefined, interactiveTerminal};
    plugin.settings.tasks.push(task); await plugin.executeTask(task, async () => {});
  }
  const task = {...taskOf(), id: 'copilot-background', taskKind: 'copilot', cliProvider: undefined, interactiveTerminal: false};
  plugin.settings.tasks.push(task); await plugin.executeTask(task, async () => {});
  assert.equal(codex, 2); assert.equal(copilot, 1);
  const h = harness(), adapter = h.load('cli-workflow-adapters').createInteractiveCliWorkflowAdapter({settings: {}}, os.tmpdir());
  for (const taskKind of ['codex', 'copilot', 'opencode', 'opencode2', 'code', undefined]) assert.equal(adapter.supports({taskKind}), false);
});

test('source shared main callback forwards generic provider and never falls back', () => fixture(async (root, settings) => {
  let options;
  const h = harness({'installed-workflow-host': {runInstalledWorkflow: async value => { options = value; return 'receipt'; }}});
  const api = h.load('main'), plugin = new api.default();
  const workflow = flow('shared', [taskStep]);
  plugin.settings = {...settings, tasks: [taskOf()], workflows: [workflow]};
  plugin.pluginExecutionLease = {}; plugin.beginExecutionEffects = () => {}; plugin.saveSettings = async () => {};
  plugin.selectedExecutionLocation = () => ({vault: root, installationDirectory: root, configurationFile: path.join(root, 'data.json')});
  plugin.settingsWriter = {fork: () => ({}), confirmedVersion: () => undefined}; plugin.loadSettings = async () => {}; plugin.refreshOpenViews = () => {};
  let received; plugin.cliTerminals = {openTask: async value => { received = value; }};
  assert.equal(await plugin.executeSharedWorkflow('shared'), 'receipt');
  const request = h.load('interactive-cli-task').prepareCliTask(taskOf(), settings, root, handoff, options.signal);
  await options.launchInteractiveTerminal(request); assert.equal(received, request); assert.equal(received.provider, 'codex');
  plugin.cliTerminals = undefined;
  await assert.rejects(options.launchInteractiveTerminal(request), /No external terminal was started/); assert.deepEqual(h.external, []);
}));

test('actual generic guide JSON imports with native model and fresh identity', async () => {
  const {plugin, AUTOOC_WORKFLOW_PROMPT: guide, ImportModal} = pluginHarness();
  const marker = /Generic interactive CLI (?:task example:|import example[^\n]*:)\n/;
  assert.match(guide, marker);
  const text = guide.split(marker)[1].split('\n\nNow write')[0];
  const example = JSON.parse(text), result = ImportModal.prototype.validateExport.call({}, example);
  assert.equal(result.ok, true, result.errors.join('\n')); assert.equal(example.tasks[0].taskKind, 'cli');
  assert.equal(example.tasks[0].interactiveTerminal, true);
  assert.doesNotMatch(JSON.stringify(example), /cliTerminalDestination/);
  await plugin.importFromData(example);
  assert.equal(plugin.settings.tasks[0].model, ''); assert.notEqual(plugin.settings.tasks[0].id, example.tasks[0].exportId);
});

for (const provider of providers) test(`generic ${provider} command preview throws before binary lookup, defaults or filesystem effects`, t => {
  const {plugin, CLI_TASK_COMMAND_NOTICE: notice} = pluginHarness();
  let configurationReads = 0;
  for (const key of [...pathKeys, 'defaultModel', 'defaultOpencode2Model', 'defaultCodexModel', 'defaultCopilotModel', 'defaultAgent']) {
    Object.defineProperty(plugin.settings, key, {get() { configurationReads++; throw Error('Unexpected command configuration access: ' + key); }});
  }
  plugin.getEffectiveAgent = () => assert.fail('generic preview must not resolve an OpenCode agent');
  for (const method of ['writeFileSync', 'mkdirSync', 'appendFileSync', 'readFileSync', 'statSync', 'existsSync', 'accessSync']) {
    t.mock.method(fs, method, () => assert.fail('generic preview touched filesystem: ' + method));
  }
  for (const method of ['buildArgs', 'buildCommand']) {
    assert.throws(() => plugin[method]({...taskOf(provider), model: '', agent: ''}), error => {
      assert.ok(error instanceof Error); assert.equal(error.message, notice);
      assert.match(error.message, /provider-specific launcher/); assert.match(error.message, /no directly copyable command/);
      assert.doesNotMatch(error.message, /OpenCode|background\/model|--dangerously|--yolo|skip-permissions/);
      return true;
    });
  }
  assert.equal(configurationReads, 0);
});

// Execute only the real Command-button subtree. Unrelated card layout needs no DOM emulation.
function commandButtonRenderer(methodName) {
  const file = path.resolve(__dirname, '../main.ts');
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const view = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'AutoOCView');
  assert.ok(view, 'AutoOCView source must exist');
  const method = view.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === methodName);
  assert.ok(method?.body, `${methodName} source must exist`);
  let statements;
  function visit(node) {
    if (ts.isBlock(node)) {
      const start = node.statements.findIndex(statement => ts.isVariableStatement(statement) &&
        statement.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === 'btnCmd'));
      if (start >= 0) {
        const end = node.statements.findIndex((statement, index) => index > start && ts.isExpressionStatement(statement) &&
          ts.isBinaryExpression(statement.expression) && ts.isPropertyAccessExpression(statement.expression.left) &&
          statement.expression.left.expression.getText(source) === 'btnCmd' && statement.expression.left.name.text === 'onclick');
        assert.ok(end > start, `${methodName} must assign the Command click handler`);
        assert.equal(statements, undefined, 'Command subtree must be unambiguous');
        statements = node.statements.slice(start, end + 1);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(method.body); assert.ok(statements, `${methodName} must render a Command button`);
  const body = ts.transpileModule(statements.map(statement => statement.getText(source)).join('\n'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
  }).outputText;
  return new Function('task', 'actions', 'taskActions', 'CLI_TASK_COMMAND_NOTICE', 'CommandPreviewModal', 'navigator', 'copyTextToClipboard',
    body + '\nreturn btnCmd;');
}

for (const method of ['renderTaskCard', 'renderWorkflowCard']) for (const provider of providers) {
  test(`${method} disables ${provider} Command and programmatic click cannot preview or copy`, () => {
    const render = commandButtonRenderer(method), {CLI_TASK_COMMAND_NOTICE: notice} = pluginHarness();
    const parent = new Element(); let commands = 0, modals = 0, copies = 0, events = 0;
    class Preview {
      constructor() { modals++; }
      open() { modals++; }
    }
    const copy = () => { copies++; };
    const button = render.call({app: {}, plugin: {buildCommand() { commands++; return 'must-not-be-copyable'; }}},
      taskOf(provider), parent, parent, notice, Preview, {clipboard: {writeText: copy}}, copy);
    assert.equal(parent.children.length, 1); assert.equal(button.tag, 'button'); assert.match(button.textContent, /Command/);
    assert.equal(button.disabled, true); assert.equal(button.title, notice); assert.match(button.title, /no directly copyable command/);
    assert.equal(typeof button.onclick, 'function');
    button.onclick({stopPropagation() { events++; }});
    // A programmatic caller can ignore the disabled flag; the task-kind guard must still hold.
    button.disabled = false; button.onclick({stopPropagation() { events++; }});
    assert.equal(events, 2); assert.equal(commands, 0); assert.equal(modals, 0); assert.equal(copies, 0);
  });
}

test('legacy OpenCode retains buildArgs/buildCommand and both real Command handlers open preview', () => {
  const {plugin, CLI_TASK_COMMAND_NOTICE: notice} = pluginHarness({opencodePath: 'synthetic-opencode'});
  const task = {...taskOf(), taskKind: 'opencode', cliProvider: undefined, interactiveTerminal: false, model: 'chosen/model', agent: 'review'};
  const args = plugin.buildArgs(task), command = plugin.buildCommand(task);
  assert.equal(args[0], 'synthetic-opencode'); assert.equal(args[1], 'run');
  assert.equal(args[args.indexOf('-m') + 1], 'chosen/model'); assert.equal(args.at(-1), task.prompt);
  assert.ok(command.includes('synthetic-opencode')); assert.ok(command.includes('chosen/model')); assert.notEqual(command, notice);
  for (const method of ['renderTaskCard', 'renderWorkflowCard']) {
    const render = commandButtonRenderer(method), parent = new Element(), previews = [];
    let opened = 0, copied = 0;
    class Preview {
      constructor(app, name, text) { previews.push({app, name, text}); }
      open() { opened++; }
    }
    const app = {}, copy = () => { copied++; };
    const button = render.call({app, plugin}, task, parent, parent, notice, Preview, {clipboard: {writeText: copy}}, copy);
    assert.equal(button.disabled, false);
    button.onclick({stopPropagation() {}});
    assert.deepEqual(previews, [{app, name: task.name, text: command}]); assert.equal(opened, 1); assert.equal(copied, 0);
  }
});

for (const kind of ['task', 'workflow']) for (const engine of ['opencode', 'opencode2', 'codex', 'copilot']) {
  test(`actual final ${kind}/${engine} creator example stays supported and does not generate generic CLI`, () => {
    const {AUTOOC_WORKFLOW_PROMPT: guide, ImportModal} = pluginHarness();
    const {buildDraftPrompt, parseGeneratedDraft} = harness().load('ai-draft');
    const prompt = buildDraftPrompt(guide, kind, 'Synthetic objective', engine, require('../manifest.json').version);
    assert.match(prompt, /cliTerminalDestination/); assert.match(prompt, /interactiveTerminal false/);
    const example = JSON.parse(prompt.split('CREATOR EXAMPLE (replace its content with the requested objective):\n')[1]
      .split('\n\nThe following JSON string')[0]);
    assert.equal(example.tasks[0].taskKind, engine); assert.equal(example.tasks[0].interactiveTerminal, false);
    assert.doesNotMatch(JSON.stringify(example), /cliProvider|cliTerminalDestination/);
    const draft = parseGeneratedDraft(JSON.stringify(example), kind, {engine, model: 'fixture/model', opencode2Model: 'fixture/v2', agent: 'build', codexModel: '', copilotModel: ''});
    assert.equal(draft.tasks[0].taskKind, engine); assert.equal(draft.tasks[0].interactiveTerminal, false);
    const result = ImportModal.prototype.validateExport.call({}, example); assert.equal(result.ok, true, result.errors.join('\n'));
    const unsupported = JSON.parse(JSON.stringify(example)); unsupported.tasks[0] = {...unsupported.tasks[0], taskKind: 'cli', cliProvider: 'codex', interactiveTerminal: true};
    assert.throws(() => parseGeneratedDraft(JSON.stringify(unsupported), kind, {engine, model: '', agent: ''}));
  });
}
