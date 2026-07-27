const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const childProcess = require("node:child_process");

const originalLoad = Module._load;
const originalSpawn = childProcess.spawn;
const spawnCalls = [];
let spawnFailure;
let lastSpawnedChild;
childProcess.spawn = function(...args) {
  spawnCalls.push(args);
  if (spawnFailure) {
    const error = spawnFailure;
    spawnFailure = undefined;
    throw error;
  }
  const child = {
    pid: 12345,
    unref() {},
    kill() {},
    on(event, callback) {
      if (event === "error") this.errorCallback = callback;
      return this;
    },
    emitError(error) {
      return this.errorCallback?.(error);
    },
  };
  lastSpawnedChild = child;
  return child;
};
test.after(() => {
  childProcess.spawn = originalSpawn;
});
Module._load = function(request, parent, isMain) {
  if (request === "obsidian") {
    class Plugin {}
    class Notice {}
    class Modal {}
    class Setting {}
    class ItemView {}
    class PluginSettingTab {}
    return { Plugin, Notice, Modal, Setting, ItemView, PluginSettingTab, WorkspaceLeaf: class {} };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const AutoOCPlugin = require("../main.js").default;
Module._load = originalLoad;
const mainSource = fs.readFileSync(require.resolve("../main.js"), "utf8");
const mainTypeScriptSource = fs.readFileSync(require.resolve("../main.ts"), "utf8");
const psSingleQuotedSource = mainSource.match(/function psSingleQuoted\([^)]*\) \{[\s\S]*?\n\}/)?.[0];
const psSingleQuoted = new Function(`${psSingleQuotedSource}; return psSingleQuoted;`)();

function generateHiddenLauncher(psScriptFile) {
  const start = mainSource.indexOf("function launchHiddenPS(");
  const end = mainSource.indexOf("\nfunction writeUtf8BomFile", start);
  const source = mainSource.slice(start, end);
  const writes = new Map();
  const child = { pid: 1, unref() {}, kill() {}, on() { return this; } };
  const launchHiddenPS = new Function("require", `${source}; return launchHiddenPS;`)((request) => {
    if (request === "fs") return {
      writeFileSync(file, data) { writes.set(file, String(data)); },
      unlinkSync() {},
      existsSync() { return false; },
    };
    if (request === "child_process") return { spawn() { return child; } };
    throw new Error(`Unexpected module: ${request}`);
  });
  const originalSetTimeout = global.setTimeout;
  global.setTimeout = () => ({ unref() {} });
  try {
    launchHiddenPS(psScriptFile);
  } finally {
    global.setTimeout = originalSetTimeout;
  }
  return writes.get(psScriptFile.replace(/\.ps1$/, ".vbs"));
}

function createPlugin(task) {
  const plugin = Object.create(AutoOCPlugin.prototype);
  plugin.settings = {
    tasks: [task],
    workflows: [],
    workingDirectory: "C:\\workspace",
    defaultInteractiveTerminal: false,
  };
  plugin.app = { vault: { adapter: { basePath: "C:\\vault" } } };
  plugin.runningProcesses = new Map();
  plugin.isTaskActive = () => false;
  plugin.getSecretsEnv = () => ({});
  plugin.getEffectiveAgent = () => "build";
  plugin.buildArgs = () => ["C:\\tools\\opencode.cmd"];
  plugin.saveSettings = async () => {};
  return plugin;
}

function createTask(branch) {
  const task = {
    id: "branch-regression",
    name: "Branch regression",
    taskKind: "opencode",
    prompt: "test prompt",
    model: "test-model",
    scheduleType: "manual",
    status: "pending",
    output: "",
    workingDirectory: "C:\\workspace",
  };
  if (arguments.length) task.branch = branch;
  return task;
}

async function captureRunTaskScript(task) {
  const plugin = createPlugin(task);
  const originalWriteFileSync = fs.writeFileSync;
  const originalSetInterval = global.setInterval;
  const originalSetTimeout = global.setTimeout;
  const scripts = [];
  let poll;
  spawnCalls.length = 0;
  fs.writeFileSync = function(file, data, ...args) {
    if (String(file).endsWith(".ps1")) {
      scripts.push(String(data));
      return;
    }
    return originalWriteFileSync.call(this, file, data, ...args);
  };
  global.setInterval = (callback) => {
    poll = callback;
    return { unref() {} };
  };
  global.setTimeout = () => ({ unref() {} });
  try {
    await plugin.runTask(task);
  } finally {
    fs.writeFileSync = originalWriteFileSync;
    global.setInterval = originalSetInterval;
    global.setTimeout = originalSetTimeout;
  }
  return {
    script: scripts.find((script) => script.includes("git checkout")),
    spawnCalls: [...spawnCalls],
    poll,
  };
}

test("runTask rejects every explicitly provided non-string branch before launch", async () => {
  for (const branch of [undefined, null, false, 0]) {
    const task = createTask(branch);
    const plugin = createPlugin(task);
    let buildArgsCalls = 0;
    plugin.buildArgs = () => { buildArgsCalls++; return ["C:\\tools\\opencode.cmd"]; };
    spawnCalls.length = 0;

    await plugin.runTask(task);

    assert.equal(buildArgsCalls, 0, `branch ${String(branch)} reached command construction`);
    assert.equal(spawnCalls.length, 0, `branch ${String(branch)} reached process launch`);
    assert.equal(task.status, "failed");
    assert.match(task.output, /branch must be a string when provided/);
  }
});

test("runTask launches legacy tasks with an empty or whitespace branch", async () => {
  for (const branch of ["", "   "]) {
    const { script, spawnCalls: launches } = await captureRunTaskScript(createTask(branch));

    assert.equal(launches.length, 1, `branch ${JSON.stringify(branch)} did not launch`);
    assert.equal(script, undefined, `branch ${JSON.stringify(branch)} attempted checkout`);
  }
});

test("runTask polling preserves output and adds one running marker when no output is available", async () => {
  const task = createTask("");
  const { poll } = await captureRunTaskScript(task);

  task.output = "Existing output";
  await poll();
  await poll();

  assert.equal(task.output, "Existing output\n[running…]");
});

test("hidden launcher writes VBScript accepted by cscript with a quoted temporary PowerShell path", (t) => {
  if (process.platform !== "win32") t.skip("cscript.exe is only available on Windows");

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "autooc-vbs-"));
  const psScriptFile = path.join(tempDir, "innocuous script.ps1");
  const launcherFile = psScriptFile.replace(/\.ps1$/, ".vbs");
  try {
    fs.writeFileSync(psScriptFile, "exit 0\r\n", "utf8");
    const launcherScript = generateHiddenLauncher(psScriptFile);
    assert.ok(launcherScript, "launchHiddenPS should write a .vbs launcher");
    assert.match(launcherScript, /powershell\.exe -NoLogo -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File/);
    assert.match(launcherScript, new RegExp(`-File ""${psScriptFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}""`));
    fs.writeFileSync(launcherFile, launcherScript, "utf8");

    const result = childProcess.spawnSync("cscript.exe", ["//Nologo", launcherFile], { encoding: "utf8", windowsHide: true });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("runTask marks the task failed when the hidden launcher cannot spawn", async () => {
  const task = createTask("");
  const plugin = createPlugin(task);
  spawnFailure = new Error("wscript.exe unavailable");

  await plugin.runTask(task);

  assert.equal(task.status, "failed");
  assert.match(task.output, /Task launcher failed: Error: wscript\.exe unavailable/);
  assert.equal(plugin.runningProcesses.has(task.id), false);
});

test("runTask handles an asynchronous hidden-launcher spawn error", async () => {
  const task = createTask("");
  const plugin = createPlugin(task);
  const originalSetInterval = global.setInterval;
  const originalSetTimeout = global.setTimeout;
  let cleared = false;
  global.setInterval = () => ({ unref() {} });
  global.setTimeout = () => ({ unref() {} });
  const originalClearInterval = global.clearInterval;
  global.clearInterval = () => { cleared = true; };
  try {
    await plugin.runTask(task);
    await lastSpawnedChild.emitError(new Error("wscript.exe asynchronous failure"));
  } finally {
    global.setInterval = originalSetInterval;
    global.setTimeout = originalSetTimeout;
    global.clearInterval = originalClearInterval;
  }

  assert.equal(task.status, "failed");
  assert.match(task.output, /Task launcher failed: Error: wscript\.exe asynchronous failure/);
  assert.equal(plugin.runningProcesses.has(task.id), false);
  assert.equal(cleared, true);
});

test("runTask rejects invalid branch names before launch", async () => {
  const task = createTask("feature invalid");
  const plugin = createPlugin(task);
  let buildArgsCalls = 0;
  plugin.buildArgs = () => { buildArgsCalls++; return ["C:\\tools\\opencode.cmd"]; };
  spawnCalls.length = 0;

  await plugin.runTask(task);

  assert.equal(buildArgsCalls, 0);
  assert.equal(spawnCalls.length, 0);
  assert.equal(task.status, "failed");
  assert.match(task.output, /invalid git branch name/);
});

test("runTask assigns a quoted branch variable before every checkout", async () => {
  const branch = "feature/test";
  const safeBranch = psSingleQuoted(branch);
  const nonCreate = await captureRunTaskScript(createTask(branch));
  const createTaskWithFallback = createTask(branch);
  createTaskWithFallback.createBranch = true;
  const create = await captureRunTaskScript(createTaskWithFallback);
  const nonCreateScript = nonCreate.script;
  const createScript = create.script;

  assert.equal(nonCreate.spawnCalls.length, 1);
  assert.equal(create.spawnCalls.length, 1);
  assert.match(nonCreateScript, new RegExp(`\\$safeBranch = ${safeBranch}; git checkout \\$safeBranch`));
  assert.match(createScript, new RegExp(`\\$safeBranch = ${safeBranch};[\\s\\S]*else \\{ git checkout \\$safeBranch \\}`));
  assert.doesNotMatch(nonCreateScript, /git checkout feature\/test/);
  assert.doesNotMatch(createScript, /git checkout feature\/test/);
});

test("runTask keeps malicious branch text literal in the launched script", async () => {
  const branch = "feature'quoted";
  const safeBranch = psSingleQuoted(branch);
  const { script, spawnCalls: launches } = await captureRunTaskScript(createTask(branch));
  assert.equal(launches.length, 1);
  assert.equal(safeBranch, "'feature''quoted'");
  assert.match(script, new RegExp(`\\$safeBranch = ${safeBranch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}; git checkout \\$safeBranch`));
  assert.doesNotMatch(script, /git checkout feature'quoted/);

  const absentTask = createTask();
  const absentPlugin = createPlugin(absentTask);
  let buildArgsCalls = 0;
  absentPlugin.buildArgs = () => { buildArgsCalls++; return ["C:\\tools\\opencode.cmd"]; };
  absentPlugin.buildArgs = () => { buildArgsCalls++; throw new Error("absent branch reached launch path"); };
  await assert.rejects(absentPlugin.runTask(absentTask), /absent branch reached launch path/);
  assert.equal(buildArgsCalls, 1);
});

test("resetSecretsPin requires unlocked secrets before resetting the PIN", () => {
  const resetSecretsPin = mainTypeScriptSource.match(/private async resetSecretsPin\(\): Promise<void> \{[\s\S]*?\n  \}/)?.[0];

  assert.ok(resetSecretsPin, "resetSecretsPin should exist in main.ts");
  assert.match(
    resetSecretsPin,
    /if \(!await this\.ensureSecretsUnlocked\(\)\) return;[\s\S]*?this\.plugin\.secretStore\.resetPin\(\);/
  );
});

test("importFromData retains step order and explicit terminal transitions", async () => {
  const plugin = createPlugin(createTask());
  plugin.ensureUniqueTaskName = (name) => name;
  plugin.ensureUniqueWorkflowName = (name) => name;
  plugin.getEffectiveDefaultModel = () => "test-model";

  await plugin.importFromData({
    autoOCExport: { schemaVersion: "1.4.0" },
    tasks: [],
    workflows: [{
      name: "Imported workflow",
      steps: [
        { id: "first", stepKind: "task", name: "First" },
        { id: "terminal", stepKind: "delay", name: "Terminal", transitions: [] },
        { id: "last", stepKind: "code", name: "Last" },
      ],
    }],
  });

  const steps = plugin.settings.workflows[0].steps;
  assert.deepEqual(steps.map((step) => step.id), ["first", "terminal", "last"]);
  assert.equal(steps[0].transitions[0].toStepId, "terminal");
  assert.deepEqual(steps[1].transitions, []);
  assert.equal(steps[2].transitions, undefined);
});

test("workflow export preserves explicit terminal transitions without changing legacy steps", async () => {
  const plugin = createPlugin(createTask());
  plugin.ensureUniqueTaskName = (name) => name;
  plugin.ensureUniqueWorkflowName = (name) => name;
  plugin.getEffectiveDefaultModel = () => "test-model";
  plugin.manifest = { version: "1.5.11" };
  plugin.settings.workflows = [{
    id: "workflow-1",
    name: "Round-trip workflow",
    steps: [
      { id: "explicit-terminal", stepKind: "delay", transitions: [] },
      { id: "legacy", stepKind: "delay" },
    ],
    status: "pending",
    currentStep: -1,
    createdAt: "2026-01-01T00:00:00.000Z",
    scheduleType: "manual",
    scheduleTime: "09:00",
    scheduleDate: "",
    scheduleDays: [],
    scheduleMonthDays: [],
    scheduleIntervalValue: 10,
    scheduleIntervalUnit: "minutes",
  }];

  const exported = JSON.parse(plugin.buildExportJson([], plugin.settings.workflows, "Round-trip export"));
  const exportedSteps = exported.workflows[0].steps;
  assert.deepEqual(exportedSteps[0].transitions, []);
  assert.equal(Object.hasOwn(exportedSteps[1], "transitions"), false);

  plugin.settings.workflows = [];
  await plugin.importFromData(exported);

  const importedSteps = plugin.settings.workflows[0].steps;
  assert.deepEqual(importedSteps[0].transitions, []);
  assert.equal(importedSteps[1].transitions, undefined);
});

test("workflow prompt documents the canonical export contract", () => {
  const prompt = mainTypeScriptSource.match(/const AUTOOC_WORKFLOW_PROMPT = `([\s\S]*?)`;/)?.[1];

  assert.ok(prompt, "AUTOOC_WORKFLOW_PROMPT should exist in main.ts");
  assert.match(prompt, /"pluginVersion": "1\.5\.11"/);
  assert.match(prompt, /schemaVersion must be exactly "1\.0" or "1\.4\.0"/);
  assert.match(prompt, /YYYY-MM-DDTHH:mm:ss\.sssZ/);
  assert.match(prompt, /Every task must include it, including taskKind "code"/);
  assert.match(prompt, /forceModel: true forces the selected model and does not apply the agent/);
  assert.match(prompt, /transitions array is the recommended canonical form/);
  assert.match(prompt, /MCP validator validates transitions when provided/);
  assert.doesNotMatch(prompt, /required for MCP workflow payloads/);
  assert.match(prompt, /single transition object only for legacy compatibility/);
  assert.match(prompt, /missing, it is treated as legacy compatibility/);
  assert.match(prompt, /fills the missing links as a linear chain/);
  assert.match(prompt, /not restrictions enforced by the importer/);
});
