const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const test = require("node:test");
const childProcess = require("node:child_process");

const originalLoad = Module._load;
const originalSpawn = childProcess.spawn;
const spawnCalls = [];
childProcess.spawn = function(...args) {
  spawnCalls.push(args);
  return { pid: 12345, unref() {}, kill() {} };
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
const psSingleQuotedSource = mainSource.match(/function psSingleQuoted\([^)]*\) \{[\s\S]*?\n\}/)?.[0];
const psSingleQuoted = new Function(`${psSingleQuotedSource}; return psSingleQuoted;`)();

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
  spawnCalls.length = 0;
  fs.writeFileSync = function(file, data, ...args) {
    if (String(file).endsWith(".ps1")) {
      scripts.push(String(data));
      return;
    }
    return originalWriteFileSync.call(this, file, data, ...args);
  };
  global.setInterval = () => ({ unref() {} });
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
  };
}

test("runTask rejects every explicitly provided falsy branch before launch", async () => {
  for (const branch of [undefined, null, false, 0, ""]) {
    const task = createTask(branch);
    const plugin = createPlugin(task);
    let buildArgsCalls = 0;
    plugin.buildArgs = () => { buildArgsCalls++; return ["C:\\tools\\opencode.cmd"]; };
    spawnCalls.length = 0;

    await plugin.runTask(task);

    assert.equal(buildArgsCalls, 0, `branch ${String(branch)} reached command construction`);
    assert.equal(spawnCalls.length, 0, `branch ${String(branch)} reached process launch`);
    assert.equal(task.status, "failed");
    assert.match(task.output, /branch must be a non-empty string/);
  }
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
