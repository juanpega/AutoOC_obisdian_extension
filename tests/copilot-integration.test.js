const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const vm = require("node:vm");
const test = require("node:test");

// Expose internal classes only in this test module, leaving the production
// bundle and Obsidian's public plugin export unchanged.
const bundlePath = path.resolve(__dirname, "..", "main.js");
const mod = new Module(bundlePath, module);
mod.filename = bundlePath;
mod.paths = Module._nodeModulePaths(path.dirname(bundlePath));
const originalRequire = mod.require.bind(mod);
mod.require = (request) => request === "obsidian" ? {
  Plugin: class {}, Notice: class {}, ItemView: class {}, PluginSettingTab: class {},
  Modal: class { constructor(app) { this.app = app; } }, Setting: class {},
} : originalRequire(request);
mod._compile(fs.readFileSync(bundlePath, "utf8") + "\nmodule.exports.__test = { VisualBuilderModal, CreateTaskModal, ImportModal, DEFAULT_SETTINGS };", bundlePath);
const AutoOCPlugin = mod.exports.default;
const { VisualBuilderModal, CreateTaskModal, ImportModal, DEFAULT_SETTINGS } = mod.exports.__test;

function createTask(overrides = {}) {
  return {
    id: "copilot-test", name: "Copilot test", taskKind: "copilot", prompt: "Review this project", model: "",
    agent: "", forceModel: false, useRalphLoop: false, scheduleType: "manual", scheduleDays: [], scheduleMonthDays: [],
    scheduleTime: "09:00", scheduleDate: "", scheduleIntervalValue: 10, scheduleIntervalUnit: "minutes",
    status: "pending", lastRun: "", output: "", createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function createPlugin(tasks = [createTask()]) {
  const plugin = new AutoOCPlugin();
  plugin.settings = { ...DEFAULT_SETTINGS, tasks, workflows: [], logsEnabled: false, defaultCopilotModel: "copilot-default" };
  plugin.app = { vault: { adapter: { basePath: os.tmpdir() } } };
  plugin.manifest = { version: "1.6.0" };
  plugin.saveSettings = async () => {};
  plugin.saveData = async () => {};
  plugin.getSecretsEnv = () => ({ AUTOOC_TEST_SECRET: "secret-fixture-value" });
  plugin.redactSecrets = (value) => value.replaceAll("secret-fixture-value", "[REDACTED]");
  return plugin;
}

function loadBuilder(html = fs.readFileSync(path.join(__dirname, "..", "util", "ui_workflow_builder", "index.html"), "utf8")) {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const elements = new Map(), messages = [], confirmations = [], listeners = {};
  let receiver;
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, {
      innerHTML: "", style: {}, events: {}, classes: new Set(),
      addEventListener(name, fn) { this.events[name] = fn; },
      classList: { add(name) { element(selector).classes.add(name); }, remove(name) { element(selector).classes.delete(name); } },
    });
    return elements.get(selector);
  };
  const context = vm.createContext({
    document: { querySelector: element, querySelectorAll: () => [], addEventListener() {} },
    window: { parent: { postMessage: message => {
      const copy = JSON.parse(JSON.stringify(message));
      messages.push(copy);
      receiver?.({ data: copy });
    } }, addEventListener: (name, fn) => { listeners[name] = fn; } },
    confirm: message => { confirmations.push(message); return context.confirmResult; },
    setTimeout: () => 0, clearTimeout() {},
  });
  vm.runInContext(script.replace(/  init\(\);\s*$/, ""), context);
  const builder = vm.runInContext("({ state, ui, meta, defaultTask, migrateTask, editorTaskHtml, buildStandaloneExport, validateAll, applyToExtension, showValidation, bindEvents, setupPostMessage })", context);
  return Object.assign(builder, { messages, confirmations, element, listeners,
    connect() { vm.runInContext("inExtension = true", context); },
    confirmWith(value) { context.confirmResult = value; },
    sendTo(handler) { receiver = handler; },
    disableRendering() { vm.runInContext("renderAll = () => {}; fitToView = () => {}", context); },
  });
}

function connectedCatalog(builder) {
  builder.connect();
  builder.state.tasks = [createTask()];
  builder.state.workflows = [
    { id: "empty", name: "No steps", steps: [] },
    { id: "connected", name: "Connected", steps: [
      { id: "a", stepKind: "task", taskId: "copilot-test", position: { x: 20, y: 40 }, transitions: [{ toStepId: "b", mode: "default" }] },
      { id: "b", stepKind: "delay", delayValue: 1, delayUnit: "seconds", position: { x: 300, y: 60 }, transitions: [] },
    ] },
  ];
  builder.ui.activeWorkflowId = "empty";
}

test("Visual Builder validates and applies connected catalogs independently of selection", () => {
  const builder = loadBuilder();
  connectedCatalog(builder);
  for (const selected of ["empty", "connected"]) {
    builder.ui.activeWorkflowId = selected;
    assert.equal(builder.validateAll().flatMap(group => group.issues).filter(issue => issue.kind === "err").length, 0);
    builder.applyToExtension();
    const sent = builder.messages.at(-1);
    assert.equal(sent.type, "apply");
    assert.deepEqual(sent.state, JSON.parse(JSON.stringify(builder.state)));
  }
  assert.equal(builder.messages.length, 2);
  assert.equal(builder.confirmations.length, 0);
});

test("Visual Builder rejects missing and cross-workflow destinations unless explicitly confirmed", () => {
  for (const destination of ["missing", "foreign"]) {
    const builder = loadBuilder();
    connectedCatalog(builder);
    builder.state.workflows[0].steps = [{ id: "foreign", stepKind: "delay", transitions: [] }];
    builder.state.workflows[1].steps[0].transitions[0].toStepId = destination;
    const validation = builder.validateAll();
    assert.equal(validation.length, 1);
    assert.equal(validation[0].wf.id, "connected");
    assert.match(validation[0].issues[0].msg, /transition points to a missing step/);
    builder.confirmWith(false);
    builder.applyToExtension();
    assert.equal(builder.messages.length, 0);
    assert.match(builder.element("#validationReport").innerHTML, /transition points to a missing step/);
    assert.ok(builder.element("#validationModal").classes.has("open"));
    builder.confirmWith(true);
    builder.applyToExtension();
    assert.equal(builder.messages.length, 1);
    assert.equal(builder.messages[0].state.workflows[1].steps[0].transitions[0].toStepId, destination);
    assert.equal(builder.confirmations.length, 2);
  }
});

test("Visual Builder preserves empty catalogs and existing validation diagnostics", () => {
  const builder = loadBuilder();
  builder.connect();
  assert.equal(builder.validateAll().length, 0);
  builder.applyToExtension();
  assert.equal(builder.messages.length, 1);
  connectedCatalog(builder);
  builder.state.tasks[0].prompt = " ";
  builder.state.workflows[1].steps.push(
    { id: "missing-task", stepKind: "task", taskId: "absent" },
    { id: "code", stepKind: "code", code: " ", transitions: [{ toStepId: "a", mode: "eval" }, { toStepId: "b", mode: "conditional", condition: " " }] },
  );
  const issues = builder.validateAll().flatMap(group => group.issues);
  assert.deepEqual(JSON.parse(JSON.stringify(issues.map(issue => issue.kind))), ["warn", "err", "err", "err", "warn", "warn"]);
  for (const diagnostic of ["no steps", "no prompt", "no longer exists", "code is empty", "AI eval", "no expression"]) {
    assert.ok(issues.some(issue => issue.msg.includes(diagnostic)), diagnostic);
  }
  builder.confirmWith(false);
  builder.applyToExtension();
  assert.equal(builder.messages.length, 1);
  builder.state.workflows = [{ id: "no-edges", steps: [{ id: "delay", stepKind: "delay", transitions: [] }] }];
  assert.equal(builder.validateAll().length, 0);
  builder.applyToExtension();
  assert.equal(builder.messages.length, 2);
});

// Minimal Obsidian DOM boundary: handlers and modal logic come from main.js.
function modalDom() {
  const nodes = [];
  function createEl(tag, options = {}) {
    const node = { tag, text: options.text, style: {}, events: {},
      createEl, createDiv: () => createEl("div"), createSpan: () => createEl("span"),
      empty() {}, appendChild() {}, addClass() {},
      addEventListener(name, handler) { this.events[name] = handler; },
    };
    nodes.push(node);
    return node;
  }
  return { nodes, contentEl: createEl("div"), modalEl: createEl("div"), titleEl: createEl("h1") };
}

test("Visual Builder controls persist the connected graph and preserve history through reload", async t => {
  for (const control of ["Apply", "Apply and close", "internal"]) await t.test(control, async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "autooc-builder-"));
    const previousWindow = global.window;
    let plugin, modal;
    try {
      const directory = path.join(root, ".obsidian", "plugins", "auto-oc");
      fs.mkdirSync(directory, { recursive: true });
      const settingsFile = path.join(directory, "data.json");
      fs.writeFileSync(settingsFile, JSON.stringify({ logsEnabled: false, tasks: [
        createTask({ id: "task", taskKind: "code", code: 'output="historic task";', status: "completed", output: "historic output", lastRun: "2026-10-01T00:00:00.000Z",
          legacyExecution: { kind: "legacy", token: "fixture", taskId: "task", startedAt: "2026-10-01T00:00:00.000Z" } }),
      ], workflows: [
        { id: "empty", name: "No steps", steps: [], scheduleType: "manual", status: "pending", currentStep: -1, createdAt: "2026-10-01T00:00:00.000Z" },
        { id: "connected", name: "Connected", scheduleType: "manual", createdAt: "2026-10-01T00:00:00.000Z", steps: [
          { id: "a", stepKind: "task", taskId: "task", position: { x: 20, y: 40 }, transitions: [{ toStepId: "b", mode: "default" }] },
          { id: "b", stepKind: "code", code: 'output="historic workflow";', position: { x: 300, y: 60 }, transitions: [] },
        ] },
      ] }));
      const freshPlugin = async () => {
        const instance = new AutoOCPlugin();
        instance.app = { vault: { adapter: { basePath: root }, configDir: ".obsidian" }, workspace: { getLeavesOfType: () => [] } };
        instance.manifest = { id: "auto-oc", version: "1.6.1" };
        await instance.loadSettings();
        return instance;
      };
      plugin = await freshPlugin();
      plugin.reservePluginExecution();
      const historyRun = await plugin.runSharedWorkflow("connected", undefined, false, false);
      assert.equal(historyRun.phase, "completed");
      plugin.releasePluginExecution(false);
      const runtime = path.join(directory, "runtime");
      const journalFile = path.join(runtime, historyRun.runId + ".json");
      const journalBefore = fs.readFileSync(journalFile);
      const filesBefore = fs.readdirSync(runtime).sort();
      // The persistence boundary is JSON: absent optional values are not stored.
      // Compare all serializable history, including any actual abandonment record.
      const before = JSON.parse(JSON.stringify(plugin.settings));
      for (const method of ["runTask", "runWorkflow", "runSharedWorkflow", "resetWorkflow"]) {
        plugin[method] = () => assert.fail("Saving must not execute or reset: " + method);
      }
      global.window = { addEventListener() {}, removeEventListener() {} };
      modal = new VisualBuilderModal(plugin.app, plugin);
      const dom = modalDom();
      Object.assign(modal, dom);
      let closed = false;
      modal.close = () => { closed = true; modal.onClose(); };
      modal.onOpen();
      // Exercise the exact HTML distributed in the bundle, not a copied validator.
      const iframe = dom.nodes.find(node => node.tag === "iframe");
      assert.equal(iframe.srcdoc, fs.readFileSync(path.join(__dirname, "..", "util/ui_workflow_builder/index.html"), "utf8").replace(/\r\n/g, "\n"));
      const builder = loadBuilder(iframe.srcdoc);
      builder.disableRendering();
      builder.setupPostMessage();
      builder.bindEvents();
      iframe.contentWindow = { postMessage: data => builder.listeners.message({ data: JSON.parse(JSON.stringify(data)) }) };
      builder.sendTo(event => modal.messageHandler(event));
      dom.nodes.find(node => node.text === "Reload state").onclick();
      assert.equal(builder.ui.activeWorkflowId, "empty");
      const graph = builder.state.workflows[1];
      graph.steps[0].position = { x: 520, y: 240 };
      graph.steps[0].transitions[0].mode = "force";
      const expectedGraph = JSON.parse(JSON.stringify(graph.steps));
      const realSave = plugin.settingsWriter.save.bind(plugin.settingsWriter);
      let releaseSave;
      const gate = new Promise(resolve => { releaseSave = resolve; });
      plugin.settingsWriter.save = async (...args) => { await gate; return realSave(...args); };
      const diskBefore = fs.readFileSync(settingsFile);
      let application;
      const realApply = modal.applyExternalState.bind(modal);
      modal.applyExternalState = state => { application = realApply(state); return application; };
      if (control === "internal") builder.element("#btnApply").events.click();
      else dom.nodes.find(node => node.text === control).onclick();
      assert.ok(application, "real control must reach the modal receiver");
      assert.equal(closed, false, "must not close before persistence completes");
      assert.deepEqual(fs.readFileSync(settingsFile), diskBefore);
      releaseSave();
      await application;
      await Promise.resolve();
      assert.equal(closed, control === "Apply and close");
      if (!closed) {
        builder.state.workflows[1].steps[0].position.x = -999;
        dom.nodes.find(node => node.text === "Reload state").onclick();
        assert.deepEqual(builder.state.workflows[1].steps[0].position, expectedGraph[0].position);
      }
      const persisted = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
      for (const collection of ["tasks", "workflows"]) for (let i = 0; i < before[collection].length; i++) {
        for (const key of ["id", "status", "output", "lastRun", "createdAt", "currentStep", "runtimeExecution", "legacyExecution"]) {
          assert.deepEqual(persisted[collection][i][key], before[collection][i][key], `persisted ${collection}/${key}`);
        }
      }
      for (let i = 0; i < before.workflows[1].steps.length; i++) for (const key of ["status", "output", "lastRun"]) {
        assert.deepEqual(persisted.workflows[1].steps[i][key], before.workflows[1].steps[i][key], "persisted step/" + key);
      }
      const reopened = await freshPlugin();
      const savedGraph = reopened.settings.workflows[1];
      assert.deepEqual(savedGraph.steps.map(s => ({ id: s.id, taskId: s.taskId, transitions: s.transitions, position: s.position })),
        expectedGraph.map(s => ({ id: s.id, taskId: s.taskId, transitions: s.transitions, position: s.position })));
      for (const collection of ["tasks", "workflows"]) for (let i = 0; i < before[collection].length; i++) {
        for (const key of ["id", "status", "output", "lastRun", "createdAt", "legacyExecution"]) {
          assert.deepEqual(reopened.settings[collection][i][key], before[collection][i][key], `${collection}/${key}`);
        }
      }
      // Existing recovery intentionally separates results from an edited definition.
      // Verify history rather than attaching old step results to a changed graph.
      for (const [key, value] of Object.entries(before.workflows[1].runtimeExecution)) {
        assert.deepEqual(savedGraph.runtimeExecution[key], value, "runtimeExecution/" + key);
      }
      assert.equal(savedGraph.runtimeExecution.definitionChanged, true);
      assert.deepEqual(savedGraph.runtimeExecution.historicalSteps, JSON.parse(journalBefore).steps);
      assert.equal(savedGraph.currentStep, 0);
      assert.ok(savedGraph.steps.every(step => step.status === "pending" && step.output === ""));
      assert.deepEqual(JSON.parse(JSON.stringify(reopened.settings.tasks[0].runtimeExecution)), before.tasks[0].runtimeExecution);
      assert.deepEqual(fs.readFileSync(journalFile), journalBefore);
      assert.deepEqual(fs.readdirSync(runtime).sort(), filesBefore);
      const reopenedModal = new VisualBuilderModal(reopened.app, reopened);
      const reopenedBuilder = loadBuilder(iframe.srcdoc);
      reopenedBuilder.disableRendering();
      reopenedBuilder.setupPostMessage();
      reopenedModal.iframe = { contentWindow: { postMessage: data => reopenedBuilder.listeners.message({ data }) } };
      reopenedModal.sendState();
      assert.deepEqual(JSON.parse(JSON.stringify(reopenedBuilder.state.workflows[1].steps)), JSON.parse(JSON.stringify(savedGraph.steps)));
      assert.equal(reopenedBuilder.validateAll().flatMap(group => group.issues).filter(issue => issue.kind === "err").length, 0);
    } finally {
      modal?.onClose();
      global.window = previousWindow;
      plugin?.releasePluginExecution(false);
      assert.equal(path.dirname(root), os.tmpdir());
      assert.ok(path.basename(root).startsWith("autooc-builder-"));
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

test("Copilot dispatch honors workflow prompt overrides and never falls through to OpenCode", async () => {
  const task = createTask();
  const plugin = createPlugin([task]);
  let invocation;
  plugin.runCopilotTask = async (...args) => { invocation = args; };
  const completion = async () => {};
  await plugin.runTask(task, completion, { prompt: "Workflow context" });
  assert.equal(invocation[0].prompt, "Workflow context");
  assert.equal(invocation[1], completion);
  assert.equal(task.prompt, "Review this project");
});

test("Copilot run uses configured model, cwd, timeout and secrets, then resets recurring tasks", async () => {
  const task = createTask({ scheduleType: "daily", copilotAllowAllTools: true, workingDirectory: os.tmpdir() });
  const plugin = createPlugin([task]);
  let invocation, completion, disposed = false;
  plugin.createCopilotClient = (cwd, onOutput) => ({
    async run(prompt, options) {
      invocation = { cwd, prompt, options };
      onOutput("secret-fixture-value partial");
      assert.equal(task.output, "[REDACTED] partial");
      return { output: "Done secret-fixture-value", error: "", exitCode: 0 };
    },
    dispose() { disposed = true; },
  });
  await plugin.runCopilotTask(task, async (completed, exitCode) => { completion = { completed, exitCode }; });
  assert.equal(invocation.cwd, os.tmpdir());
  assert.equal(invocation.options.model, "copilot-default");
  assert.equal(invocation.options.allowAllTools, true);
  assert.equal(invocation.options.timeoutMs, DEFAULT_SETTINGS.taskTimeoutSeconds * 1000);
  assert.equal(invocation.options.env.AUTOOC_TEST_SECRET, "secret-fixture-value");
  assert.equal(task.status, "pending");
  assert.equal(task.output, "Done [REDACTED]");
  assert.equal(completion.exitCode, 0);
  assert.equal(disposed, true);
  assert.equal(plugin.runningProcesses.size, 0);
});

test("Copilot run records policy failures and invokes workflow completion once", async () => {
  const task = createTask({ model: "explicit-model" });
  const plugin = createPlugin([task]);
  let completions = 0;
  plugin.createCopilotClient = () => ({
    async run(_prompt, options) {
      assert.equal(options.model, "explicit-model");
      assert.equal(options.allowAllTools, false);
      return { output: "", error: "Access denied by policy settings", exitCode: 1 };
    }, dispose() {},
  });
  await plugin.runCopilotTask(task, async (_task, code) => { completions++; assert.equal(code, 1); });
  assert.equal(task.status, "failed");
  assert.match(task.output, /Access denied by policy settings/);
  assert.equal(completions, 1);
});

test("Copilot validation failures do not spawn a client", async () => {
  for (const overrides of [{ prompt: " " }, { interactiveTerminal: true }, { copilotAllowAllTools: "true" }]) {
    const task = createTask(overrides);
    const plugin = createPlugin([task]);
    plugin.createCopilotClient = () => { assert.fail("Invalid task must not start a process"); };
    let code;
    await plugin.runCopilotTask(task, async (_task, exitCode) => { code = exitCode; });
    assert.equal(task.status, "failed");
    assert.equal(code, -1);
    assert.equal(plugin.runningProcesses.size, 0);
  }
});

test("stopping a Copilot task preserves the stopped state and suppresses late results", async () => {
  const task = createTask();
  const plugin = createPlugin([task]);
  let ready, finish, output;
  const started = new Promise(resolve => { ready = resolve; });
  plugin.createCopilotClient = (_cwd, onOutput) => ({
    run() { output = onOutput; ready(); return new Promise(resolve => { finish = resolve; }); },
    dispose() { finish?.({ output: "late output", error: "", exitCode: 0 }); },
  });
  const job = plugin.runCopilotTask(task);
  await started;
  await plugin.killTask(task.id, plugin.taskStopIdentity(task));
  output("late stream");
  await job;
  assert.equal(task.status, "failed");
  assert.match(task.output, /stop requested; external outcome unconfirmed/);
  assert.doesNotMatch(task.output, /late/);
  assert.equal(plugin.runningProcesses.size, 0);
});

test("editing a running Copilot task retains the result on the current saved task object", async () => {
  const task = createTask();
  const plugin = createPlugin([task]);
  plugin.createCopilotClient = (_cwd, onOutput) => ({
    async run() {
      plugin.settings.tasks[0] = { ...task, name: "Edited during run" };
      onOutput("Live output");
      return { output: "Final output", error: "", exitCode: 0 };
    }, dispose() {},
  });
  await plugin.runCopilotTask(task);
  assert.equal(plugin.settings.tasks[0].name, "Edited during run");
  assert.equal(plugin.settings.tasks[0].output, "Final output");
  assert.equal(plugin.settings.tasks[0].status, "completed");
});

test("Copilot history includes metadata while workflow output contains only the response", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "autooc-copilot-history-"));
  try {
    const task = createTask();
    const plugin = createPlugin([task]);
    plugin.app.vault.adapter.basePath = dir;
    plugin.settings.logsEnabled = true;
    plugin.createCopilotClient = () => ({ async run() { return { output: "Review complete", error: "", exitCode: 0 }; }, dispose() {} });
    await plugin.runCopilotTask(task);
    const logs = path.join(dir, ".opencode", "logs", task.id);
    const text = fs.readFileSync(path.join(logs, fs.readdirSync(logs)[0]), "utf8");
    assert.match(text, /\[engine: copilot\]/);
    assert.match(text, /\[model: copilot-default\]/);
    assert.equal(task.output, "Review complete");
  } finally {
    assert.equal(path.dirname(dir), os.tmpdir());
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("Copilot workflow handoff passes prior output without changing the saved prompt", async () => {
  const task = createTask();
  const plugin = createPlugin([task]);
  const step = { id: "review", stepKind: "task", taskId: task.id, transitions: [] };
  const workflow = { id: "wf", name: "Mixed workflow", status: "running", handoffOutput: true, currentStep: 0, steps: [step] };
  plugin.settings.workflows = [workflow];
  plugin.workflowRuntime = new Map([[workflow.id, { stepOutputs: new Map([["previous", "Prior engine output"]]) }]]);
  let receivedPrompt, job;
  plugin.createCopilotClient = () => ({ async run(prompt) { receivedPrompt = prompt; return { output: "Reviewed", error: "", exitCode: 0 }; }, dispose() {} });
  const run = plugin.runCopilotTask.bind(plugin);
  plugin.runCopilotTask = (...args) => { job = run(...args); return job; };
  await plugin.runTaskStep(workflow, step, 0);
  await job;
  assert.match(receivedPrompt, /Prior engine output/);
  assert.equal(task.prompt, "Review this project");
  assert.equal(workflow.status, "completed");
});

test("Copilot exports and mixed workflow references round-trip using schema 1.6", async () => {
  const task = createTask({ copilotAllowAllTools: true, model: "private-model", output: "runtime" });
  const other = createTask({ id: "codex-task", taskKind: "codex", name: "Codex task" });
  const source = createPlugin([task, other]);
  const wf = { id: "mixed", name: "Mixed", steps: [{ id: "a", stepKind: "task", taskId: task.id, transitions: [{ toStepId: "b", mode: "default" }] }, { id: "b", stepKind: "task", taskId: other.id, transitions: [] }] };
  const data = JSON.parse(source.buildExportJson([task, other], [wf]));
  assert.equal(data.autoOCExport.schemaVersion, "1.6.0");
  assert.equal(data.tasks[0].model, undefined);
  assert.equal(data.tasks[0].output, undefined);
  assert.equal(data.tasks[0].copilotAllowAllTools, true);
  const target = createPlugin([]);
  await target.importFromData(data);
  assert.deepEqual(target.settings.tasks.map(task => task.taskKind), ["copilot", "codex"]);
  assert.equal(target.settings.tasks[0].model, "copilot-default");
  assert.equal(target.settings.tasks[0].copilotAllowAllTools, true);
  assert.equal(target.settings.workflows[0].steps[0].taskId, target.settings.tasks[0].id);
  assert.equal(target.settings.workflows[0].steps[1].taskId, target.settings.tasks[1].id);
});

test("MCP and import validation reject invalid Copilot permission and interactive fields", async () => {
  const plugin = createPlugin([]);
  for (const fields of [{ copilotAllowAllTools: "false" }, { interactiveTerminal: true }]) {
    const task = { taskKind: "copilot", name: "Bad", prompt: "x", ...fields };
    assert.ok(plugin.getMcpRawTaskPayloadError(task));
    await assert.rejects(plugin.importFromData({ autoOCExport: { schemaVersion: "1.6.0" }, tasks: [{ ...task, exportId: "bad" }], workflows: [] }));
  }
  const task = { taskKind: "copilot", name: "Good", prompt: "x", copilotAllowAllTools: false };
  assert.equal(plugin.getMcpRawTaskPayloadError(task), null);
  assert.equal(plugin.wrapMcpCreatePayload("task", task).autoOCExport.schemaVersion, "1.6.0");
});

test("Copilot default survives settings migration and is used in both task editors", async () => {
  const plugin = createPlugin([]);
  plugin.loadData = async () => ({ ...plugin.settings, defaultAiEngine: "copilot" });
  await plugin.loadSettings();
  assert.equal(plugin.settings.defaultAiEngine, "copilot");
  const modal = new CreateTaskModal(plugin.app, plugin);
  assert.equal(modal.draft.taskKind, "copilot");
  assert.equal(modal.draft.model, "copilot-default");
  const builder = loadBuilder();
  builder.meta.defaultAiEngine = "copilot";
  builder.meta.defaultCopilotModel = "copilot-default";
  const task = builder.defaultTask();
  assert.equal(task.taskKind, "copilot");
  assert.equal(task.model, "copilot-default");
  assert.equal(task.copilotAllowAllTools, false);
  assert.equal(builder.migrateTask({ id: "legacy" }).taskKind, "opencode");
  assert.equal(builder.migrateTask({ id: "legacy" }).copilotAllowAllTools, undefined);
  const html = builder.editorTaskHtml(task);
  assert.match(html, /value="copilot" selected/);
  assert.match(html, /data-f="copilotAllowAllTools"/);
  assert.doesNotMatch(html, /data-f="reasoningEffort"|data-f="branch"|data-f="useRalphLoop"/);
});

test("Visual Builder preserves Copilot configuration and runtime state across edits", async () => {
  const task = createTask({ status: "completed", output: "Existing result", copilotAllowAllTools: true, model: "chosen" });
  task.runtimeExecution = {runId:"historical"};
  task.legacyExecution = {kind:"legacy",token:"current",taskId:task.id};
  const plugin = createPlugin([task]);
  const modal = new VisualBuilderModal(plugin.app, plugin);
  await modal.applyExternalState({ tasks: [{ id: task.id, taskKind: "copilot", name: "Renamed", prompt: task.prompt, legacyExecution: {token:"stale"} }], workflows: [] });
  const edited = plugin.settings.tasks[0];
  assert.equal(edited.status, "completed");
  assert.equal(edited.output, "Existing result");
  assert.equal(edited.model, "chosen");
  assert.equal(edited.copilotAllowAllTools, true);
  assert.deepEqual(edited.runtimeExecution, task.runtimeExecution);
  assert.deepEqual(edited.legacyExecution, task.legacyExecution);
});

test("standalone Copilot workflow export is accepted by the plugin and import preview", async () => {
  const builder = loadBuilder();
  const task = createTask({ copilotAllowAllTools: false });
  builder.state.tasks = [task];
  builder.state.workflows = [{ id: "wf", name: "Review", steps: [{ id: "step", stepKind: "task", taskId: task.id, transitions: [] }] }];
  const data = JSON.parse(JSON.stringify(builder.buildStandaloneExport()));
  const plugin = createPlugin([]);
  const modal = new ImportModal(plugin.app, plugin);
  assert.deepEqual(modal.validateExport(data).errors, []);
  await plugin.importFromData(data);
  assert.equal(plugin.settings.workflows[0].steps[0].taskId, plugin.settings.tasks[0].id);
  const example = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "library", "copilot-code-review.json"), "utf8"));
  assert.deepEqual(modal.validateExport(example).errors, []);
});
