var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  VIEW_TYPE: () => VIEW_TYPE,
  default: () => AutoOCPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var import_child_process = require("child_process");
var os = __toESM(require("os"));
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
function resolveOpencodeBin(configured) {
  if (configured && configured !== "opencode") return configured;
  if (os.platform() === "win32") {
    const candidate = `${process.env.APPDATA}\\npm\\opencode.cmd`;
    try {
      const { existsSync: existsSync2 } = require("fs");
      if (existsSync2(candidate)) return candidate;
    } catch (e) {
    }
  }
  return configured || "opencode";
}
function launchHiddenPS(psScriptFile) {
  const fs2 = require("fs");
  const path2 = require("path");
  const vbsFile = psScriptFile.replace(/\.ps1$/, ".vbs");
  const vbs = `Set sh = CreateObject("WScript.Shell")\r
sh.Run "powershell.exe -NoLogo -NonInteractive -WindowStyle Hidden -File """ & "${psScriptFile.replace(/"/g, '""')}" & """", 0, False\r
`;
  fs2.writeFileSync(vbsFile, vbs, "utf8");
  const { spawn: spawn2 } = require("child_process");
  const ws = spawn2("wscript.exe", [vbsFile], { detached: true, stdio: "ignore", windowsHide: true });
  ws.unref();
  setTimeout(() => {
    try {
      fs2.unlinkSync(vbsFile);
    } catch (e) {
    }
  }, 1e4);
}
var FALLBACK_MODELS = [];
function fetchModelsSync(opencodePath) {
  const { execSync } = require("child_process");
  const bin = resolveOpencodeBin(opencodePath);
  try {
    const out = execSync(`"${bin}" models`, { timeout: 8e3, encoding: "utf8" });
    return out.split("\n").map((l) => l.trim()).filter((l) => l.length > 0 && l.includes("/")).map((l) => ({ value: l, label: l }));
  } catch (e) {
    return [];
  }
}
var DEFAULT_SETTINGS = {
  tasks: [],
  chatHistory: [],
  chatModel: "",
  opencodePath: "opencode",
  defaultModel: "",
  workingDirectory: "",
  // {opencode} = binary path, {model} = provider/model, {prompt} = escaped prompt
  cmdTemplate: '{opencode} run --model {model} "{prompt}"',
  taskTimeoutSeconds: 1800
  // 30 min por defecto
};
var VIEW_TYPE = "auto-oc-view";
var DAY_NAMES = ["Dom", "Lun", "Mar", "Mi\xE9", "Jue", "Vie", "S\xE1b"];
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function formatDateTime(iso) {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES") + " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}
function padTwo(n) {
  return String(n).padStart(2, "0");
}
function todayString() {
  const now = /* @__PURE__ */ new Date();
  return `${now.getFullYear()}-${padTwo(now.getMonth() + 1)}-${padTwo(now.getDate())}`;
}
function nowTimeString() {
  const now = /* @__PURE__ */ new Date();
  return `${padTwo(now.getHours())}:${padTwo(now.getMinutes())}`;
}
function normalizeCommandOutput(text) {
  if (!text) return "";
  let cleaned = text.replace(/\x1B\[[0-9;]*[A-Za-z]/g, "");
  if (/[ÃÂâ€œâ€|â€|â€|â„¢|â€“|â€”]/.test(cleaned)) {
    try {
      cleaned = Buffer.from(cleaned, "latin1").toString("utf8");
    } catch (e) {
    }
  }
  return cleaned.trim();
}
function getOpencodeConfigPath() {
  return path.join(os.homedir(), ".config", "opencode", "opencode.json");
}
function getRalphStateFilePath(vaultBasePath) {
  return path.join(vaultBasePath, ".opencode", "ralph-loop.local.md");
}
function isTaskDue(task) {
  if (task.status === "running") return false;
  const now = /* @__PURE__ */ new Date();
  const [hh, mm] = task.scheduleTime.split(":").map(Number);
  if (task.scheduleType === "once") {
    if (task.status === "completed") return false;
    const target = /* @__PURE__ */ new Date(`${task.scheduleDate}T${task.scheduleTime}:00`);
    return now >= target;
  }
  if (task.scheduleType === "daily") {
    const todayTarget = /* @__PURE__ */ new Date();
    todayTarget.setHours(hh, mm, 0, 0);
    if (now < todayTarget) return false;
    if (!task.lastRun) return true;
    return new Date(task.lastRun).toDateString() !== now.toDateString();
  }
  if (task.scheduleType === "weekly") {
    if (!task.scheduleDays.includes(now.getDay())) return false;
    const todayTarget = /* @__PURE__ */ new Date();
    todayTarget.setHours(hh, mm, 0, 0);
    if (now < todayTarget) return false;
    if (!task.lastRun) return true;
    return new Date(task.lastRun).toDateString() !== now.toDateString();
  }
  return false;
}
var AutoOCPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.availableModels = FALLBACK_MODELS;
    // Map taskId -> child process, so we can kill running tasks
    this.runningProcesses = /* @__PURE__ */ new Map();
  }
  async onload() {
    await this.loadSettings();
    setTimeout(() => this.refreshModels(), 2e3);
    this.registerView(VIEW_TYPE, (leaf) => {
      this.view = new AutoOCView(leaf, this);
      return this.view;
    });
    this.addRibbonIcon("alarm-clock", "AutoOC \u2014 Task Scheduler", () => {
      this.toggleView();
    });
    this.addCommand({
      id: "open-auto-oc",
      name: "Open AutoOC Task Scheduler",
      callback: () => this.activateView()
    });
    this.addCommand({
      id: "create-task",
      name: "Create new OpenCode task",
      callback: () => new CreateTaskModal(this.app, this).open()
    });
    this.addCommand({
      id: "check-tasks-now",
      name: "Check due tasks now",
      callback: async () => {
        await this.runDueTasks();
        new import_obsidian.Notice("AutoOC: check completed.");
      }
    });
    this.addCommand({
      id: "diagnose",
      name: "AutoOC: Diagnostic \u2014 test opencode command",
      callback: () => new DiagnosticModal(this.app, this).open()
    });
    this.addCommand({
      id: "install-ralph-loop",
      name: "AutoOC: Ralph Loop Assistant (install/activate)",
      callback: async () => {
        const result = await this.ensureRalphLoopPluginEnabled();
        new import_obsidian.Notice(
          result.changed ? `AutoOC: Ralph Loop enabled at ${result.configPath}. Restart OpenCode.` : `AutoOC: Ralph Loop was already active at ${result.configPath}.`
        );
      }
    });
    this.addSettingTab(new AutoOCSettingTab(this.app, this));
    this.registerInterval(
      window.setInterval(() => this.runDueTasks(), 6e4)
    );
    setTimeout(() => this.runDueTasks(), 5e3);
  }
  async onunload() {
    for (const [, proc] of this.runningProcesses) {
      proc.kill();
    }
    this.runningProcesses.clear();
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }
  refreshModels() {
    var _a;
    const models = fetchModelsSync(this.settings.opencodePath || "opencode");
    if (models.length > 0) {
      this.availableModels = models;
      if (!this.settings.defaultModel || !models.find((m) => m.value === this.settings.defaultModel)) {
        this.settings.defaultModel = models[0].value;
        void this.saveSettings();
      }
      (_a = this.view) == null ? void 0 : _a.refresh();
    }
  }
  getEffectiveDefaultModel() {
    var _a, _b;
    if (this.settings.defaultModel) return this.settings.defaultModel;
    return (_b = (_a = this.availableModels[0]) == null ? void 0 : _a.value) != null ? _b : "";
  }
  async activateView() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
      this.app.workspace.revealLeaf(leaf);
    }
  }
  toggleView() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.detachLeavesOfType(VIEW_TYPE);
      return;
    }
    this.activateView();
  }
  async loadSettings() {
    var _a, _b;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (!this.settings.defaultModel) {
      this.settings.defaultModel = (_b = (_a = this.availableModels[0]) == null ? void 0 : _a.value) != null ? _b : "";
    }
  }
  isRalphLoopEnabled() {
    const configPath = getOpencodeConfigPath();
    if (!fs.existsSync(configPath)) return false;
    try {
      const raw = fs.readFileSync(configPath, "utf8");
      const data = JSON.parse(raw);
      return Array.isArray(data == null ? void 0 : data.plugin) && data.plugin.includes("opencode-ralph-loop");
    } catch (e) {
      return false;
    }
  }
  async ensureRalphLoopPluginEnabled() {
    const configPath = getOpencodeConfigPath();
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    let data = {};
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, "utf8");
        data = raw.trim() ? JSON.parse(raw) : {};
      } catch (e) {
        throw new Error(`Could not read valid JSON from ${configPath}`);
      }
    }
    const plugins = Array.isArray(data.plugin) ? [...data.plugin] : [];
    if (plugins.includes("opencode-ralph-loop")) {
      return { changed: false, configPath };
    }
    plugins.push("opencode-ralph-loop");
    data.plugin = plugins;
    fs.writeFileSync(configPath, `${JSON.stringify(data, null, 2)}
`, "utf8");
    return { changed: true, configPath };
  }
  async saveSettings() {
    var _a;
    await this.saveData(this.settings);
    (_a = this.view) == null ? void 0 : _a.refresh();
  }
  // Returns the args array exactly as tool.py does: ["opencode", "run", prompt, "-m", model]
  buildArgs(task) {
    let prompt = task.prompt;
    if (task.useRalphLoop) {
      prompt = `/ralph-loop ${prompt}`;
    }
    const bin = resolveOpencodeBin(this.settings.opencodePath);
    return [bin, "run", prompt, "-m", task.model, "--dangerously-skip-permissions"];
  }
  // Human-readable command string for the preview modal
  buildCommand(task) {
    const args = this.buildArgs(task);
    return `${args[0]} ${args[1]} "${args[2]}" ${args[3]} ${args[4]} ${args[5]}`;
  }
  // Runs opencode via a fully-detached PowerShell process to avoid Electron's
  // restricted environment killing the child. Output is written to a temp file
  // that the plugin polls every 3 s.
  async runTask(task) {
    var _a;
    const idx = this.settings.tasks.findIndex((t) => t.id === task.id);
    if (idx === -1) return;
    this.settings.tasks[idx].status = "running";
    this.settings.tasks[idx].lastRun = (/* @__PURE__ */ new Date()).toISOString();
    this.settings.tasks[idx].output = "[iniciando proceso desacoplado\u2026]\n";
    await this.saveSettings();
    new import_obsidian.Notice(`AutoOC: running "${task.name}"\u2026`);
    const args = this.buildArgs(this.settings.tasks[idx]);
    const bin = args[0];
    const prompt = args[2];
    const model = args[4];
    const safePrompt = prompt.replace(/'/g, "''");
    const tmpDir = require("os").tmpdir();
    const outFile = require("path").join(tmpDir, `autooc-${task.id}.txt`);
    const pidFile = require("path").join(tmpDir, `autooc-${task.id}.pid`);
    const fs2 = require("fs");
    try {
      fs2.unlinkSync(outFile);
    } catch (e) {
    }
    try {
      fs2.unlinkSync(pidFile);
    } catch (e) {
    }
    const psScript = [
      `$env:USERPROFILE = '${process.env.USERPROFILE}'`,
      `$env:APPDATA     = '${process.env.APPDATA}'`,
      `$env:LOCALAPPDATA= '${process.env.LOCALAPPDATA}'`,
      `$env:PATH        = '${process.env.PATH}'`,
      `$env:HOME        = '${process.env.USERPROFILE}'`,
      `Set-Location '${(this.app.vault.adapter.basePath || ".").replace(/'/g, "''")}'`,
      `$outTmp = [System.IO.Path]::GetTempFileName()`,
      `$errTmp = [System.IO.Path]::GetTempFileName()`,
      `$p = Start-Process -FilePath '${bin.replace(/'/g, "''")}' -ArgumentList 'run','${safePrompt}','-m','${model}','--dangerously-skip-permissions' -RedirectStandardOutput $outTmp -RedirectStandardError $errTmp -Wait -NoNewWindow -PassThru`,
      `$stdout = Get-Content $outTmp -Raw -ErrorAction SilentlyContinue`,
      `$stderr = Get-Content $errTmp -Raw -ErrorAction SilentlyContinue`,
      `Remove-Item $outTmp,$errTmp -ErrorAction SilentlyContinue`,
      `$code = $p.ExitCode`,
      `$combined = ($stdout + $(if($stderr){"
[stderr]
" + $stderr}else{""})).Trim()`,
      `[System.IO.File]::WriteAllText('${outFile.replace(/'/g, "''")}', $combined + "
DONE:$code")`
    ].join("\n");
    const psScriptFile = require("path").join(tmpDir, `autooc-${task.id}.ps1`);
    fs2.writeFileSync(psScriptFile, psScript, "utf8");
    launchHiddenPS(psScriptFile);
    this.runningProcesses.set(task.id, { kill: () => {
    } });
    const timeoutSeconds = (_a = this.settings.taskTimeoutSeconds) != null ? _a : 1800;
    const timeoutEnabled = timeoutSeconds > 0;
    const timeoutMs = timeoutSeconds * 1e3;
    const startedAt = Date.now();
    const pollHandle = setInterval(async () => {
      const t = this.settings.tasks.find((x) => x.id === task.id);
      if (!t) {
        clearInterval(pollHandle);
        return;
      }
      if (timeoutEnabled && Date.now() - startedAt > timeoutMs) {
        clearInterval(pollHandle);
        t.output += `
[\u23F1 timeout: ${timeoutSeconds}s superados]`;
        t.status = "failed";
        await this.saveSettings();
        new import_obsidian.Notice(`AutoOC: \u23F1 "${task.name}" super\xF3 el timeout.`);
        return;
      }
      if (!fs2.existsSync(outFile)) {
        t.output += ".";
        await this.saveSettings();
        return;
      }
      clearInterval(pollHandle);
      this.runningProcesses.delete(task.id);
      try {
        fs2.unlinkSync(psScriptFile);
      } catch (e) {
      }
      const raw = fs2.readFileSync(outFile, "utf8");
      try {
        fs2.unlinkSync(outFile);
      } catch (e) {
      }
      const doneMatch = raw.match(/\nDONE:(-?\d+)\s*$/);
      const exitCode = doneMatch ? parseInt(doneMatch[1], 10) : -1;
      const output = doneMatch ? raw.slice(0, doneMatch.index).trim() : raw.trim();
      const normalized = normalizeCommandOutput(output);
      t.output = normalized || "(sin output)";
      if (exitCode !== 0) {
        t.status = "failed";
        t.output += `
[c\xF3digo de salida: ${exitCode}]`;
        new import_obsidian.Notice(`AutoOC: \u274C "${task.name}" fall\xF3 (c\xF3digo ${exitCode}).`);
      } else {
        t.status = t.scheduleType === "once" ? "completed" : "pending";
        new import_obsidian.Notice(`AutoOC: \u2705 "${task.name}" completada.`);
      }
      await this.saveSettings();
    }, 3e3);
  }
  async killTask(id) {
    const proc = this.runningProcesses.get(id);
    if (proc) {
      try {
        proc.kill();
      } catch (e) {
      }
      this.runningProcesses.delete(id);
    }
    const t = this.settings.tasks.find((x) => x.id === id);
    if (t) {
      t.status = "failed";
      t.output += "\n[task stopped manually]";
      await this.saveSettings();
    }
    new import_obsidian.Notice(`AutoOC: \u23F9 Task stopped.`);
  }
  async runDueTasks() {
    for (const task of this.settings.tasks) {
      if (isTaskDue(task)) {
        await this.runTask(task);
      }
    }
  }
  async deleteTask(id) {
    this.settings.tasks = this.settings.tasks.filter((t) => t.id !== id);
    await this.saveSettings();
  }
};
var AutoOCView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.currentTab = "tasks";
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return "AutoOC Scheduler";
  }
  getIcon() {
    return "alarm-clock";
  }
  async onOpen() {
    this.render();
  }
  async onClose() {
  }
  refresh() {
    this.render();
  }
  render() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("auto-oc-view");
    const tabBar = containerEl.createDiv("auto-oc-tab-bar");
    const btnTasks = tabBar.createEl("button", {
      text: "\u{1F4CB} Tasks",
      cls: `auto-oc-tab-btn ${this.currentTab === "tasks" ? "active" : ""}`
    });
    btnTasks.onclick = () => {
      this.currentTab = "tasks";
      this.render();
    };
    const btnChat = tabBar.createEl("button", {
      text: "\u{1F4AC} Chat",
      cls: `auto-oc-tab-btn ${this.currentTab === "chat" ? "active" : ""}`
    });
    btnChat.onclick = () => {
      this.currentTab = "chat";
      this.render();
    };
    if (this.currentTab === "tasks") {
      this.renderTasks(containerEl);
    } else {
      this.renderChat(containerEl);
    }
  }
  renderTasks(containerEl) {
    const header = containerEl.createDiv("auto-oc-header");
    header.createEl("h4", { text: "\u23F0 AutoOC Scheduler" });
    const btnRow = header.createDiv("auto-oc-btn-row");
    const btnNew = btnRow.createEl("button", {
      text: "+ New Task",
      cls: "auto-oc-btn-primary"
    });
    btnNew.onclick = () => new CreateTaskModal(this.app, this.plugin).open();
    const btnCheck = btnRow.createEl("button", {
      text: "\u25B6 Check Now",
      cls: "auto-oc-btn-secondary"
    });
    btnCheck.onclick = async () => {
      await this.plugin.runDueTasks();
      new import_obsidian.Notice("AutoOC: check completed.");
    };
    const tasks = this.plugin.settings.tasks;
    const stats = containerEl.createDiv("auto-oc-stats");
    const pending = tasks.filter((t) => t.status === "pending").length;
    const running = tasks.filter((t) => t.status === "running").length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const failed = tasks.filter((t) => t.status === "failed").length;
    stats.createEl("span", { text: `${tasks.length} tasks` });
    if (running > 0) stats.createEl("span", { text: `\u{1F7E1} ${running} running`, cls: "auto-oc-stat-running" });
    if (failed > 0) stats.createEl("span", { text: `\u{1F534} ${failed} failed`, cls: "auto-oc-stat-failed" });
    if (completed > 0) stats.createEl("span", { text: `\u{1F7E2} ${completed} completed` });
    if (tasks.length === 0) {
      containerEl.createEl("p", {
        text: 'No tasks scheduled. Create one with "+New Task".',
        cls: "auto-oc-empty"
      });
      return;
    }
    const list = containerEl.createDiv("auto-oc-list");
    for (const task of [...tasks].reverse()) {
      this.renderTaskCard(list, task);
    }
  }
  renderChat(containerEl) {
    const chatLayout = containerEl.createDiv("auto-oc-chat-layout");
    chatLayout.style.height = "100%";
    const header = chatLayout.createDiv("auto-oc-header");
    header.createEl("h4", { text: "\u{1F4AC} Chat with Models" });
    const modelRow = chatLayout.createDiv("auto-oc-chat-model-row");
    modelRow.createEl("label", { text: "Model:" });
    const selectModel = modelRow.createEl("select", { cls: "auto-oc-chat-model-select" });
    selectModel.innerHTML = "";
    this.plugin.availableModels.forEach((m) => {
      const opt = selectModel.createEl("option", { text: m.label });
      opt.value = m.value;
    });
    const currentModel = this.plugin.settings.chatModel || this.plugin.getEffectiveDefaultModel();
    if (currentModel) selectModel.value = currentModel;
    selectModel.onchange = async () => {
      this.plugin.settings.chatModel = selectModel.value;
      await this.plugin.saveSettings();
    };
    chatLayout.createEl("p", {
      text: `Conversation is saved. Locked model: ${selectModel.value || "(none)"}`,
      cls: "setting-item-description"
    });
    const messagesDiv = chatLayout.createDiv("auto-oc-chat-messages");
    const sanitizeForContext = (text) => {
      return text.replace(/\n?\[stderr\][\s\S]*$/i, "").replace(/^>\s*build\s.*$/gim, "").trim();
    };
    const renderMessages = () => {
      messagesDiv.empty();
      this.plugin.settings.chatHistory.forEach((msg) => {
        const msgEl = messagesDiv.createDiv(`auto-oc-chat-message auto-oc-chat-${msg.role}`);
        msgEl.createEl("div", { text: msg.role === "user" ? "You:" : "Assistant:", cls: "auto-oc-chat-role" });
        const visibleContent = msg.role === "assistant" ? sanitizeForContext(msg.content) || msg.content || "(no response)" : msg.content;
        msgEl.createEl("div", { text: visibleContent, cls: "auto-oc-chat-content" });
      });
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    };
    renderMessages();
    const footer = chatLayout.createDiv("auto-oc-chat-footer");
    const inputDiv = footer.createDiv("auto-oc-chat-input-area");
    const inputField = inputDiv.createEl("textarea", { cls: "auto-oc-chat-input" });
    inputField.placeholder = "Type your prompt here... (Enter to send, Shift+Enter for newline)";
    inputField.disabled = false;
    inputField.readOnly = false;
    const actionsCol = inputDiv.createDiv("auto-oc-chat-actions-col");
    const btnSend = actionsCol.createEl("button", {
      text: "\u25B6 Send",
      cls: "auto-oc-btn-primary"
    });
    const btnClear = actionsCol.createEl("button", {
      text: "\u{1F5D1} Clear History",
      cls: "auto-oc-btn-secondary"
    });
    const buildChatPrompt = (history, userPrompt) => {
      const compact = (s) => s.replace(/\s+/g, " ").trim();
      const userOnly = history.filter((m) => m.role === "user").slice(-4).map((m) => compact(m.content)).filter(Boolean);
      if (userOnly.length === 0) return userPrompt;
      const clippedUserHistory = userOnly.join(" | ").slice(-900);
      const compactPrompt = compact(userPrompt);
      return [
        "Use this short user context if relevant:",
        clippedUserHistory,
        "Current user message:",
        compactPrompt
      ].join("\n\n");
    };
    const runPrompt = async () => {
      var _a;
      const prompt = inputField.value.trim();
      if (!prompt) return;
      const model = selectModel.value;
      if (!model) {
        new import_obsidian.Notice("Please select a model first.");
        return;
      }
      const historyBefore = [...this.plugin.settings.chatHistory];
      const contextualPrompt = buildChatPrompt(historyBefore, prompt);
      this.plugin.settings.chatModel = model;
      this.plugin.settings.chatHistory.push({
        role: "user",
        content: prompt,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      await this.plugin.saveSettings();
      inputField.value = "";
      renderMessages();
      btnSend.disabled = true;
      btnSend.textContent = "\u23F3 Waiting...";
      try {
        const bin = resolveOpencodeBin(this.plugin.settings.opencodePath);
        const cwd = this.plugin.settings.workingDirectory || this.app.vault.adapter.basePath || ".";
        const timeoutMs = ((_a = this.plugin.settings.taskTimeoutSeconds) != null ? _a : 1800) * 1e3;
        const chatTimeoutMs = Math.min(timeoutMs, 12e4);
        const finishChatRequest = () => {
          btnSend.disabled = false;
          btnSend.textContent = "\u25B6 Send";
          inputField.focus();
          renderMessages();
        };
        const onResult = async (error, stdout, stderr) => {
          const cleanStdout = normalizeCommandOutput(stdout || "");
          const cleanStderr = normalizeCommandOutput(stderr || "");
          let output = cleanStdout;
          if (!output && cleanStderr) output = `Error: ${cleanStderr}`;
          if (!output && error) output = `Error: ${String(error)}`;
          this.plugin.settings.chatHistory.push({
            role: "assistant",
            content: output.trim() || "(no response)",
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
          try {
            await this.plugin.saveSettings();
          } catch (e) {
          }
          finishChatRequest();
        };
        if (process.platform === "win32" && /\.(cmd|bat)$/i.test(bin)) {
          const promptB64 = Buffer.from(contextualPrompt, "utf8").toString("base64");
          const tmpDir = require("os").tmpdir();
          const outFile = require("path").join(tmpDir, `autooc-chat-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
          const psScriptFile = require("path").join(tmpDir, `autooc-chat-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`);
          const psScript = [
            `$env:USERPROFILE = '${(process.env.USERPROFILE || "").replace(/'/g, "''")}'`,
            `$env:APPDATA     = '${(process.env.APPDATA || "").replace(/'/g, "''")}'`,
            `$env:LOCALAPPDATA= '${(process.env.LOCALAPPDATA || "").replace(/'/g, "''")}'`,
            `$env:PATH        = '${(process.env.PATH || "").replace(/'/g, "''")}'`,
            `$env:HOME        = '${(process.env.USERPROFILE || "").replace(/'/g, "''")}'`,
            `$env:OPENCODE_MODEL = '${model.replace(/'/g, "''")}'`,
            `Set-Location '${cwd.replace(/'/g, "''")}'`,
            `$p = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${promptB64}'))`,
            `$outTmp = [System.IO.Path]::GetTempFileName()`,
            `$errTmp = [System.IO.Path]::GetTempFileName()`,
            `$proc = Start-Process -FilePath '${bin.replace(/'/g, "''")}' -ArgumentList 'run',$p,'-m','${model.replace(/'/g, "''")}','--dangerously-skip-permissions' -RedirectStandardOutput $outTmp -RedirectStandardError $errTmp -Wait -NoNewWindow -PassThru`,
            `$stdout = (Get-Content $outTmp -Raw -ErrorAction SilentlyContinue)`,
            `$stderr = (Get-Content $errTmp -Raw -ErrorAction SilentlyContinue)`,
            `Remove-Item $outTmp,$errTmp -ErrorAction SilentlyContinue`,
            `$combined = ($stdout + $(if($stderr){"
[stderr]
" + $stderr}else{""})).Trim()`,
            `[System.IO.File]::WriteAllText('${outFile.replace(/'/g, "''")}', $combined + "
DONE:" + $proc.ExitCode)`
          ].join("\n");
          fs.writeFileSync(psScriptFile, psScript, "utf8");
          launchHiddenPS(psScriptFile);
          const startedAt = Date.now();
          const outFileDeadlineMs = 15e3;
          const pollHandle = setInterval(async () => {
            if (Date.now() - startedAt > chatTimeoutMs) {
              clearInterval(pollHandle);
              try {
                fs.unlinkSync(psScriptFile);
              } catch (e) {
              }
              await onResult(new Error(`Chat timeout after ${Math.floor(chatTimeoutMs / 1e3)}s`), "", "");
              return;
            }
            if (!fs.existsSync(outFile)) {
              if (Date.now() - startedAt > outFileDeadlineMs) {
                clearInterval(pollHandle);
                try {
                  fs.unlinkSync(psScriptFile);
                } catch (e) {
                }
                await onResult(new Error("Chat process did not start correctly (no output file created)."), "", "");
              }
              return;
            }
            clearInterval(pollHandle);
            const raw = fs.readFileSync(outFile, "utf8");
            try {
              fs.unlinkSync(outFile);
            } catch (e) {
            }
            try {
              fs.unlinkSync(psScriptFile);
            } catch (e) {
            }
            const doneMatch = raw.match(/\nDONE:(-?\d+)\s*$/);
            const exitCode = doneMatch ? parseInt(doneMatch[1], 10) : -1;
            const output = doneMatch ? raw.slice(0, doneMatch.index).trim() : raw.trim();
            const stderrFromOutput = output.includes("[stderr]") ? output : "";
            await onResult(exitCode === 0 ? null : new Error(`Exit code ${exitCode}`), output, stderrFromOutput);
          }, 1200);
        } else {
          (0, import_child_process.execFile)(
            bin,
            ["run", contextualPrompt, "-m", model, "--dangerously-skip-permissions"],
            {
              cwd,
              timeout: chatTimeoutMs,
              windowsHide: true,
              env: { ...process.env, OPENCODE_MODEL: model }
            },
            onResult
          );
        }
      } catch (e) {
        const errMsg = String(e);
        this.plugin.settings.chatHistory.push({
          role: "assistant",
          content: `Error: ${errMsg}`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
        await this.plugin.saveSettings();
        btnSend.disabled = false;
        btnSend.textContent = "\u25B6 Send";
        renderMessages();
      }
    };
    btnSend.onclick = runPrompt;
    inputField.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (btnSend.disabled) return;
        runPrompt();
      }
    });
    btnClear.onclick = async () => {
      if (confirm("Clear chat history?")) {
        this.plugin.settings.chatHistory = [];
        try {
          await this.plugin.saveSettings();
        } catch (e) {
        }
        btnSend.disabled = false;
        btnSend.textContent = "\u25B6 Send";
        inputField.removeAttribute("disabled");
        inputField.readOnly = false;
        inputField.value = "";
        inputField.focus();
        window.setTimeout(() => inputField.focus(), 0);
        this.render();
        window.setTimeout(() => {
          const ta = this.containerEl.querySelector(".auto-oc-chat-input");
          if (ta) {
            ta.disabled = false;
            ta.readOnly = false;
            ta.focus();
          }
        }, 0);
      }
    };
  }
  renderTaskCard(parent, task) {
    var _a, _b;
    const card = parent.createDiv(`auto-oc-card auto-oc-status-${task.status}`);
    const top = card.createDiv("auto-oc-card-top");
    top.createEl("span", { text: task.name, cls: "auto-oc-task-name" });
    top.createEl("span", {
      text: task.status,
      cls: `auto-oc-badge auto-oc-badge-${task.status}`
    });
    const meta = card.createDiv("auto-oc-card-meta");
    const modelLabel = (_b = (_a = this.plugin.availableModels.find((m) => m.value === task.model)) == null ? void 0 : _a.label) != null ? _b : task.model;
    meta.createEl("span", { text: `\u{1F916} ${modelLabel}` });
    let scheduleText = "";
    if (task.scheduleType === "once") {
      scheduleText = `\u{1F4C5} ${task.scheduleDate} ${task.scheduleTime}`;
    } else if (task.scheduleType === "daily") {
      scheduleText = `\u{1F501} Every day at ${task.scheduleTime}`;
    } else {
      const days = task.scheduleDays.map((d) => DAY_NAMES[d]).join(", ");
      scheduleText = `\u{1F501} ${days || "no days"} at ${task.scheduleTime}`;
    }
    meta.createEl("span", { text: scheduleText });
    if (task.lastRun) {
      meta.createEl("span", { text: `\u23F1 Last: ${formatDateTime(task.lastRun)}` });
    }
    if (task.useRalphLoop) {
      meta.createEl("span", { text: "\u267B\uFE0F Ralph Loop active", cls: "auto-oc-ralph-badge" });
    }
    const preview = card.createDiv("auto-oc-prompt-preview");
    preview.createEl("span", {
      text: task.prompt.slice(0, 140) + (task.prompt.length > 140 ? "\u2026" : "")
    });
    const actions = card.createDiv("auto-oc-card-actions");
    const btnRun = actions.createEl("button", {
      text: task.status === "running" ? "\u23F3 Running\u2026" : "\u25B6 Run",
      cls: "auto-oc-btn-run"
    });
    btnRun.disabled = task.status === "running";
    btnRun.onclick = () => this.plugin.runTask(task);
    if (task.status === "running") {
      const btnStop = actions.createEl("button", {
        text: "\u23F9 Stop",
        cls: "auto-oc-btn-stop"
      });
      btnStop.title = "Terminate process now";
      btnStop.onclick = async () => {
        btnStop.disabled = true;
        btnStop.textContent = "Stopping\u2026";
        await this.plugin.killTask(task.id);
      };
    }
    const btnLog = actions.createEl("button", {
      text: task.status === "running" ? "\u{1F4E1} Live Log" : "\u{1F4C4} Log",
      cls: task.status === "running" ? "auto-oc-btn-log-live" : "auto-oc-btn-output"
    });
    btnLog.disabled = !task.output && task.status !== "running";
    btnLog.title = task.output ? "" : "A\xFAn no hay output";
    btnLog.onclick = () => new LiveLogModal(this.app, task, this.plugin).open();
    const btnCmd = actions.createEl("button", {
      text: "\u{1F50D} Command",
      cls: "auto-oc-btn-cmd"
    });
    btnCmd.onclick = () => {
      const cmd = this.plugin.buildCommand(task);
      new CommandPreviewModal(this.app, task.name, cmd).open();
    };
    const btnEdit = actions.createEl("button", {
      text: "\u270F\uFE0F Edit",
      cls: "auto-oc-btn-edit"
    });
    btnEdit.onclick = () => new CreateTaskModal(this.app, this.plugin, task).open();
    const btnDelete = actions.createEl("button", {
      text: "\u{1F5D1}",
      cls: "auto-oc-btn-delete"
    });
    btnDelete.title = "Delete task";
    btnDelete.onclick = async () => {
      if (confirm(`Delete task "${task.name}"?`)) {
        await this.plugin.deleteTask(task.id);
      }
    };
  }
};
var CreateTaskModal = class extends import_obsidian.Modal {
  constructor(app, plugin, editTask) {
    super(app);
    this.plugin = plugin;
    this.editTask = editTask;
    this.draft = editTask ? { ...editTask } : {
      name: "",
      prompt: "",
      model: plugin.getEffectiveDefaultModel(),
      useRalphLoop: false,
      scheduleType: "once",
      scheduleTime: nowTimeString(),
      scheduleDate: todayString(),
      scheduleDays: []
    };
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("auto-oc-modal");
    contentEl.createEl("h3", {
      text: this.editTask ? "Edit Task" : "New OpenCode Task"
    });
    new import_obsidian.Setting(contentEl).setName("Name").setDesc("Short task identifier").addText(
      (text) => {
        var _a;
        return text.setValue((_a = this.draft.name) != null ? _a : "").onChange((v) => this.draft.name = v);
      }
    );
    new import_obsidian.Setting(contentEl).setName("Prompt / Goal").setDesc("Text to send to OpenCode").addTextArea((ta) => {
      var _a;
      ta.setValue((_a = this.draft.prompt) != null ? _a : "").onChange((v) => this.draft.prompt = v);
      ta.inputEl.rows = 5;
      ta.inputEl.style.width = "100%";
    });
    new import_obsidian.Setting(contentEl).setName("Model").setDesc("AI model to use").addDropdown((dd) => {
      var _a;
      const models = this.plugin.availableModels;
      models.forEach((m) => dd.addOption(m.value, m.label));
      const current = (_a = this.draft.model) != null ? _a : this.plugin.getEffectiveDefaultModel();
      if (!current && models.length === 0) {
        dd.addOption("", "(no models; tap refresh)");
      } else if (current && !models.find((m) => m.value === current)) {
        dd.addOption(current, current);
      }
      dd.setValue(current || "");
      dd.onChange((v) => this.draft.model = v);
    });
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("\u{1F504} Refresh Models").onClick(() => {
        this.plugin.refreshModels();
        new import_obsidian.Notice("AutoOC: models updated. Reopen dialog.");
      })
    );
    new import_obsidian.Setting(contentEl).setName("Ralph Loop").setDesc("Wrap prompt with /ralph-loop to auto-continue until DONE").addToggle((tog) => {
      var _a;
      tog.setValue((_a = this.draft.useRalphLoop) != null ? _a : false);
      tog.onChange((v) => this.draft.useRalphLoop = v);
    }).addButton(
      (btn) => btn.setButtonText("Installation Assistant").onClick(async () => {
        try {
          const result = await this.plugin.ensureRalphLoopPluginEnabled();
          new import_obsidian.Notice(
            result.changed ? `Ralph Loop enabled at ${result.configPath}. Restart OpenCode.` : `Ralph Loop was already active at ${result.configPath}.`
          );
        } catch (e) {
          new import_obsidian.Notice(`AutoOC: error enabling Ralph Loop: ${String(e)}`);
        }
      })
    );
    new import_obsidian.Setting(contentEl).setName("Schedule Type").addDropdown((dd) => {
      var _a;
      dd.addOption("once", "Once (specific date and time)");
      dd.addOption("daily", "Daily (fixed time)");
      dd.addOption("weekly", "Weekdays");
      dd.setValue((_a = this.draft.scheduleType) != null ? _a : "once");
      dd.onChange((v) => {
        this.draft.scheduleType = v;
        this.onOpen();
      });
    });
    if (this.draft.scheduleType === "once") {
      new import_obsidian.Setting(contentEl).setName("Date").setDesc("Format YYYY-MM-DD").addText(
        (text) => {
          var _a;
          return text.setPlaceholder(todayString()).setValue((_a = this.draft.scheduleDate) != null ? _a : "").onChange((v) => this.draft.scheduleDate = v);
        }
      );
    }
    if (this.draft.scheduleType === "weekly") {
      const daySetting = new import_obsidian.Setting(contentEl).setName("Weekdays");
      daySetting.settingEl.style.flexWrap = "wrap";
      DAY_NAMES.forEach((name, idx) => {
        daySetting.addToggle((tog) => {
          var _a;
          tog.setValue(((_a = this.draft.scheduleDays) != null ? _a : []).includes(idx));
          tog.onChange((checked) => {
            var _a2;
            const days = [...(_a2 = this.draft.scheduleDays) != null ? _a2 : []];
            if (checked) {
              if (!days.includes(idx)) days.push(idx);
            } else {
              const pos = days.indexOf(idx);
              if (pos > -1) days.splice(pos, 1);
            }
            this.draft.scheduleDays = days;
          });
          tog.toggleEl.insertAdjacentHTML(
            "afterend",
            `<span class="auto-oc-day-label">${name}</span>`
          );
        });
      });
    }
    new import_obsidian.Setting(contentEl).setName("Time").setDesc("Format HH:MM (24h)").addText(
      (text) => {
        var _a;
        return text.setPlaceholder("09:00").setValue((_a = this.draft.scheduleTime) != null ? _a : "").onChange((v) => this.draft.scheduleTime = v);
      }
    );
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText(this.editTask ? "Save Changes" : "Create Task").setCta().onClick(async () => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _i;
        if (!((_a = this.draft.name) == null ? void 0 : _a.trim())) {
          new import_obsidian.Notice("Name is required.");
          return;
        }
        if (!((_b = this.draft.prompt) == null ? void 0 : _b.trim())) {
          new import_obsidian.Notice("Prompt is required.");
          return;
        }
        if (!((_c = this.draft.model) != null ? _c : "").trim()) {
          new import_obsidian.Notice("You must select a model.");
          return;
        }
        if (!/^\d{2}:\d{2}$/.test((_d = this.draft.scheduleTime) != null ? _d : "")) {
          new import_obsidian.Notice("Invalid time. Use HH:MM format.");
          return;
        }
        if (this.draft.scheduleType === "once" && !/^\d{4}-\d{2}-\d{2}$/.test((_e = this.draft.scheduleDate) != null ? _e : "")) {
          new import_obsidian.Notice("Invalid date. Use YYYY-MM-DD format.");
          return;
        }
        if (this.editTask) {
          const idx = this.plugin.settings.tasks.findIndex(
            (t) => t.id === this.editTask.id
          );
          if (idx !== -1) {
            this.plugin.settings.tasks[idx] = {
              ...this.editTask,
              ...this.draft
            };
          }
        } else {
          const task = {
            id: generateId(),
            name: this.draft.name,
            prompt: this.draft.prompt,
            model: this.draft.model,
            useRalphLoop: (_f = this.draft.useRalphLoop) != null ? _f : false,
            scheduleType: (_g = this.draft.scheduleType) != null ? _g : "once",
            scheduleTime: this.draft.scheduleTime,
            scheduleDate: (_h = this.draft.scheduleDate) != null ? _h : "",
            scheduleDays: (_i = this.draft.scheduleDays) != null ? _i : [],
            status: "pending",
            lastRun: "",
            output: "",
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          this.plugin.settings.tasks.push(task);
        }
        await this.plugin.saveSettings();
        new import_obsidian.Notice(`Task "${this.draft.name}" saved.`);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};
var LiveLogModal = class extends import_obsidian.Modal {
  constructor(app, task, plugin) {
    super(app);
    this.pre = null;
    this.statusEl = null;
    this.intervalId = null;
    this.elapsedIntervalId = null;
    this.autoScroll = true;
    this.task = task;
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("auto-oc-output-modal");
    const header = contentEl.createDiv("auto-oc-log-header");
    header.createEl("h3", { text: `\u{1F4C4} Log: ${this.task.name}` });
    this.statusEl = header.createEl("p", { cls: "auto-oc-log-status" });
    const elapsedEl = header.createEl("p", { cls: "auto-oc-log-elapsed" });
    const updateElapsed = () => {
      if (!this.task.lastRun) {
        elapsedEl.textContent = "";
        return;
      }
      const secs = Math.floor((Date.now() - new Date(this.task.lastRun).getTime()) / 1e3);
      const min = Math.floor(secs / 60);
      const sec = secs % 60;
      elapsedEl.textContent = `\u23F1 Elapsed time: ${min}m ${sec}s`;
    };
    updateElapsed();
    this.elapsedIntervalId = window.setInterval(updateElapsed, 1e3);
    const toolbar = contentEl.createDiv("auto-oc-log-toolbar");
    const btnScroll = toolbar.createEl("button", {
      text: "\u2193 Auto-scroll: ON",
      cls: "auto-oc-btn-secondary"
    });
    btnScroll.onclick = () => {
      this.autoScroll = !this.autoScroll;
      btnScroll.textContent = `\u2193 Auto-scroll: ${this.autoScroll ? "ON" : "OFF"}`;
    };
    const btnCopy = toolbar.createEl("button", {
      text: "\u{1F4CB} Copy",
      cls: "auto-oc-btn-secondary"
    });
    btnCopy.onclick = () => {
      var _a, _b;
      navigator.clipboard.writeText((_b = (_a = this.pre) == null ? void 0 : _a.textContent) != null ? _b : "");
      new import_obsidian.Notice("Log copied.");
    };
    const btnClear = toolbar.createEl("button", {
      text: "\u{1F5D1} Clear View",
      cls: "auto-oc-btn-secondary"
    });
    btnClear.onclick = () => {
      if (this.pre) this.pre.textContent = "";
    };
    this.pre = contentEl.createEl("pre", { cls: "auto-oc-output-pre auto-oc-log-pre" });
    this.refresh();
    this.intervalId = window.setInterval(() => this.refresh(), 1e3);
  }
  refresh() {
    const latest = this.plugin.settings.tasks.find((t) => t.id === this.task.id);
    if (!latest) return;
    this.task = latest;
    if (this.statusEl) {
      const isRunning = latest.status === "running";
      this.statusEl.textContent = `Estado: ${latest.status}` + (latest.lastRun ? `  |  Inicio: ${formatDateTime(latest.lastRun)}` : "") + (isRunning ? "  \u23F3" : "");
      this.statusEl.className = "auto-oc-log-status auto-oc-badge-" + latest.status;
    }
    if (this.pre) {
      const newContent = latest.output || "(sin output a\xFAn\u2026)";
      if (this.pre.textContent !== newContent) {
        this.pre.textContent = newContent;
        if (this.autoScroll) {
          this.pre.scrollTop = this.pre.scrollHeight;
        }
      }
    }
    if (latest.status !== "running" && this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  onClose() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.elapsedIntervalId !== null) {
      window.clearInterval(this.elapsedIntervalId);
      this.elapsedIntervalId = null;
    }
    this.contentEl.empty();
  }
};
var CommandPreviewModal = class extends import_obsidian.Modal {
  constructor(app, taskName, cmd) {
    super(app);
    this.taskName = taskName;
    this.cmd = cmd;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: `Command: ${this.taskName}` });
    contentEl.createEl("p", {
      text: "This is the CLI command that will be executed:",
      cls: "setting-item-description"
    });
    const pre = contentEl.createEl("pre", { cls: "auto-oc-output-pre" });
    pre.textContent = this.cmd;
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Copy").onClick(() => {
        navigator.clipboard.writeText(this.cmd);
        new import_obsidian.Notice("Command copied.");
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};
var DiagnosticModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.logEl = null;
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "\u{1F527} AutoOC Diagnostic" });
    contentEl.createEl("p", {
      text: "Test the opencode command directly from Obsidian.",
      cls: "setting-item-description"
    });
    const bin = resolveOpencodeBin(this.plugin.settings.opencodePath);
    contentEl.createEl("p", { text: `Detected binary: ${bin}`, cls: "setting-item-description" });
    contentEl.createEl("p", { text: `Default model: ${this.plugin.getEffectiveDefaultModel() || "(not configured)"}`, cls: "setting-item-description" });
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("\u25B6 Launch test: 'di hola'").setCta().onClick(() => {
        if (this.logEl) this.logEl.textContent = "[launching detached PowerShell process\u2026]\n";
        const bin2 = resolveOpencodeBin(this.plugin.settings.opencodePath);
        const model = this.plugin.getEffectiveDefaultModel();
        if (!model) {
          new import_obsidian.Notice("AutoOC: no model selected. Reload models in Settings.");
          return;
        }
        const fs2 = require("fs");
        const path2 = require("path");
        const osTmp = require("os").tmpdir();
        const outFile = path2.join(osTmp, "autooc-diag.txt");
        try {
          fs2.unlinkSync(outFile);
        } catch (e) {
        }
        const psScript = [
          `$env:USERPROFILE = '${process.env.USERPROFILE}'`,
          `$env:APPDATA     = '${process.env.APPDATA}'`,
          `$env:LOCALAPPDATA= '${process.env.LOCALAPPDATA}'`,
          `$env:PATH        = '${process.env.PATH}'`,
          `$env:HOME        = '${process.env.USERPROFILE}'`,
          `$outTmp = [System.IO.Path]::GetTempFileName()`,
          `$errTmp = [System.IO.Path]::GetTempFileName()`,
          `$p = Start-Process -FilePath '${bin2.replace(/'/g, "''")}' -ArgumentList 'run','di hola','-m','${model}','--dangerously-skip-permissions' -RedirectStandardOutput $outTmp -RedirectStandardError $errTmp -Wait -NoNewWindow -PassThru`,
          `$out = (Get-Content $outTmp -Raw -ErrorAction SilentlyContinue).Trim()`,
          `Remove-Item $outTmp,$errTmp -ErrorAction SilentlyContinue`,
          `[System.IO.File]::WriteAllText('${outFile.replace(/'/g, "''")}', $out + "
DONE:" + $p.ExitCode)`
        ].join("\n");
        const psFile = path2.join(osTmp, "autooc-diag.ps1");
        fs2.writeFileSync(psFile, psScript, "utf8");
        if (this.logEl) this.logEl.textContent += `Script: ${psFile}

`;
        launchHiddenPS(psFile);
        const poll = setInterval(() => {
          if (!fs2.existsSync(outFile)) {
            if (this.logEl) this.logEl.textContent += ".";
            return;
          }
          clearInterval(poll);
          const raw = fs2.readFileSync(outFile, "utf8");
          try {
            fs2.unlinkSync(outFile);
            fs2.unlinkSync(psFile);
          } catch (e) {
          }
          const doneMatch = raw.match(/\nDONE:(-?\d+)\s*$/);
          const output = doneMatch ? raw.slice(0, doneMatch.index).trim() : raw.trim();
          const normalized = normalizeCommandOutput(output);
          const exitCode = doneMatch ? parseInt(doneMatch[1], 10) : -1;
          if (this.logEl) {
            this.logEl.textContent = normalized || "(sin output)";
            this.logEl.textContent += exitCode === 0 ? "\n\n[\u2705 completado]" : `

[\u274C c\xF3digo ${exitCode}]`;
          }
        }, 2e3);
      })
    );
    this.logEl = contentEl.createEl("pre", { cls: "auto-oc-output-pre auto-oc-log-pre" });
    this.logEl.textContent = "(aqu\xED aparecer\xE1 el output\u2026)";
  }
  onClose() {
    this.contentEl.empty();
  }
};
var AutoOCSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "AutoOC \u2014 Settings" });
    new import_obsidian.Setting(containerEl).setName("OpenCode CLI Path").setDesc(
      `Absolute path to executable. Empty = auto-detect.
Detected now: ${resolveOpencodeBin(this.plugin.settings.opencodePath)}`
    ).addText((text) => {
      text.setPlaceholder("auto-detect").setValue(this.plugin.settings.opencodePath).onChange(async (v) => {
        this.plugin.settings.opencodePath = v.trim();
        await this.plugin.saveSettings();
      });
      return text;
    }).addButton(
      (btn) => btn.setButtonText("\u{1F50D} Auto-detect").onClick(async () => {
        const { existsSync: existsSync2 } = require("fs");
        const candidates = [
          `${process.env.APPDATA}\\npm\\opencode.cmd`,
          `${process.env.APPDATA}\\npm\\opencode`,
          `${process.env.LOCALAPPDATA}\\npm\\opencode.cmd`,
          `${process.env.ProgramFiles}\\nodejs\\opencode.cmd`
        ].filter(Boolean);
        const found = candidates.find((c) => existsSync2(c));
        if (found) {
          this.plugin.settings.opencodePath = found;
          await this.plugin.saveSettings();
          new import_obsidian.Notice(`AutoOC: path configured \u2192 ${found}`);
          this.display();
        } else {
          new import_obsidian.Notice("AutoOC: opencode not found automatically. Enter the path manually.");
        }
      })
    );
    new import_obsidian.Setting(containerEl).setName("Working Directory").setDesc(
      "Directory from which to launch OpenCode (empty = vault's current directory)"
    ).addText(
      (text) => text.setPlaceholder("C:\\Users\\GiJu236\\projects\\mi-proyecto").setValue(this.plugin.settings.workingDirectory).onChange(async (v) => {
        this.plugin.settings.workingDirectory = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Task Timeout (seconds)").setDesc("If process doesn't finish in this time, it's automatically killed. Default 1800 s (30 min). Use 0 to disable timeout.").addText(
      (text) => {
        var _a;
        return text.setPlaceholder("1800").setValue(String((_a = this.plugin.settings.taskTimeoutSeconds) != null ? _a : 1800)).onChange(async (v) => {
          const n = parseInt(v, 10);
          if (!isNaN(n) && n >= 0) {
            this.plugin.settings.taskTimeoutSeconds = n;
            await this.plugin.saveSettings();
          }
        });
      }
    );
    containerEl.createEl("h3", { text: "Ralph Loop" });
    containerEl.createEl("p", {
      text: "Enable opencode-ralph-loop in ~/.config/opencode/opencode.json to use auto-continuation with /ralph-loop.",
      cls: "setting-item-description"
    });
    containerEl.createEl("p", {
      text: `Current status: ${this.plugin.isRalphLoopEnabled() ? "enabled" : "not configured"}`,
      cls: "setting-item-description"
    });
    new import_obsidian.Setting(containerEl).setName("Ralph Loop Assistant").setDesc("Add opencode-ralph-loop to OpenCode configuration file").addButton(
      (btn) => btn.setButtonText("Install / Activate").setCta().onClick(async () => {
        try {
          const result = await this.plugin.ensureRalphLoopPluginEnabled();
          new import_obsidian.Notice(
            result.changed ? `AutoOC: Ralph Loop enabled at ${result.configPath}. Restart OpenCode.` : `AutoOC: Ralph Loop was already active at ${result.configPath}.`
          );
          this.display();
        } catch (e) {
          new import_obsidian.Notice(`AutoOC: error enabling Ralph Loop: ${String(e)}`);
        }
      })
    ).addButton(
      (btn) => btn.setButtonText("Show status path").onClick(() => {
        const basePath = this.app.vault.adapter.basePath || ".";
        const statePath = getRalphStateFilePath(basePath);
        new import_obsidian.Notice(`Ralph state file: ${statePath}`);
      })
    );
    new import_obsidian.Setting(containerEl).setName("Default Model").addDropdown((dd) => {
      const models = this.plugin.availableModels;
      models.forEach((m) => dd.addOption(m.value, m.label));
      const current = this.plugin.getEffectiveDefaultModel();
      if (!current && models.length === 0) {
        dd.addOption("", "(no models; press reload)");
      } else if (current && !models.find((m) => m.value === current)) {
        dd.addOption(current, current);
      }
      dd.setValue(current || "");
      dd.onChange(async (v) => {
        this.plugin.settings.defaultModel = v;
        await this.plugin.saveSettings();
      });
    });
    containerEl.createEl("h3", { text: "Available Models" });
    const refreshBtn = containerEl.createEl("button", {
      text: "\u{1F504} Reload Model List",
      cls: "auto-oc-btn-secondary"
    });
    refreshBtn.style.marginBottom = "8px";
    refreshBtn.onclick = () => {
      this.plugin.refreshModels();
      new import_obsidian.Notice("AutoOC: models reloaded. Refresh this panel.");
      this.display();
    };
    containerEl.createEl("p", {
      text: `${this.plugin.availableModels.length} models loaded from \`opencode models\``,
      cls: "setting-item-description"
    });
    const table = containerEl.createEl("table", { cls: "auto-oc-models-table" });
    const thead = table.createEl("thead");
    const hr = thead.createEl("tr");
    hr.createEl("th", { text: "provider/model" });
    const tbody = table.createEl("tbody");
    this.plugin.availableModels.forEach((m) => {
      const tr = tbody.createEl("tr");
      tr.createEl("td", { text: m.value, cls: "auto-oc-model-value" });
    });
  }
};
