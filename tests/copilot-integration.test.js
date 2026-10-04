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

function loadBuilder() {
  const html = fs.readFileSync(path.join(__dirname, "..", "util", "ui_workflow_builder", "index.html"), "utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const context = vm.createContext({});
  vm.runInContext(script.replace(/  init\(\);\s*$/, ""), context);
  return vm.runInContext("({ state, meta, defaultTask, migrateTask, editorTaskHtml, buildStandaloneExport })", context);
}

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
