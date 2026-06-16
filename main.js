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
function psSingleQuoted(value) {
  return `'${value.replace(/'/g, "''")}'`;
}
function openOpencodeCli(bin, cwd) {
  if (process.platform === "win32") {
    const command2 = `Set-Location -LiteralPath ${psSingleQuoted(cwd)}; & ${psSingleQuoted(bin)}`;
    const launcher2 = (0, import_child_process.spawn)(
      "cmd.exe",
      ["/c", "start", "OpenCode CLI", "/D", cwd, "powershell.exe", "-NoLogo", "-NoExit", "-Command", command2],
      { detached: true, stdio: "ignore", windowsHide: false }
    );
    launcher2.unref();
    return;
  }
  if (process.platform === "darwin") {
    const escapedCwd = cwd.replace(/(["\\$`])/g, "\\$1");
    const escapedBin = bin.replace(/(["\\$`])/g, "\\$1");
    const script = `tell application "Terminal" to do script "cd ${escapedCwd} && ${escapedBin}"`;
    const launcher2 = (0, import_child_process.spawn)("osascript", ["-e", script], { detached: true, stdio: "ignore" });
    launcher2.unref();
    return;
  }
  const command = `cd ${JSON.stringify(cwd)} && ${JSON.stringify(bin)}`;
  const launcher = (0, import_child_process.spawn)("x-terminal-emulator", ["-e", "sh", "-lc", command], { detached: true, stdio: "ignore" });
  launcher.unref();
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
var FALLBACK_AGENTS = [
  { value: "general", label: "general" },
  { value: "build", label: "build" },
  { value: "plan", label: "plan" },
  { value: "explore", label: "explore" }
];
function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}
function isValidAgentName(name) {
  return /^[A-Za-z0-9_-]+$/.test(name);
}
function listGitBranches(cwd) {
  const { execFileSync } = require("child_process");
  const out = execFileSync("git", ["branch", "--format=%(refname:short)"], {
    cwd,
    timeout: 8e3,
    encoding: "utf8",
    windowsHide: true
  });
  return out.split("\n").map((b) => b.trim()).filter(Boolean);
}
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
function fetchAgentsSync(opencodePath) {
  const { execSync } = require("child_process");
  const bin = resolveOpencodeBin(opencodePath);
  try {
    const out = execSync(`"${bin}" agent list`, { timeout: 8e3, encoding: "utf8" });
    const agents = stripAnsi(out).split("\n").map((l) => l.trim()).filter((l) => /^\S+\s+\(/.test(l)).map((l) => {
      var _a, _b;
      const name = (_b = (_a = l.match(/^(\S+)\s+\(/)) == null ? void 0 : _a[1]) != null ? _b : l.split(" ")[0];
      return { value: name, label: name };
    }).filter((a) => isValidAgentName(a.value));
    return agents.length > 0 ? agents : FALLBACK_AGENTS;
  } catch (e) {
    return FALLBACK_AGENTS;
  }
}
var DEFAULT_SETTINGS = {
  tasks: [],
  opencodePath: "opencode",
  defaultModel: "",
  defaultAgent: "general",
  workingDirectory: "",
  // {opencode} = binary path, {model} = provider/model, {prompt} = escaped prompt
  cmdTemplate: '{opencode} run --model {model} "{prompt}"',
  taskTimeoutSeconds: 1800,
  // 30 min por defecto
  logsEnabled: true,
  maxLogsPerTask: 50,
  logRetentionDays: 30
};
var VIEW_TYPE = "auto-oc-view";
var DAY_NAMES = ["Dom", "Lun", "Mar", "Mi\xE9", "Jue", "Vie", "S\xE1b"];
var GITHUB_REPO = "juanpega/AutoOC_obisdian_extension";
var GITHUB_BRANCH = "dev";
var REMOTE_MANIFEST_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/manifest.json`;
var REMOTE_FILE_URLS = {
  mainJs: `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/main.js`,
  manifest: `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/manifest.json`,
  styles: `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/styles.css`
};
function compareVersions(a, b) {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}
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
function getTaskLogDir(vaultBasePath, taskId) {
  return path.join(vaultBasePath, ".opencode", "logs", taskId);
}
function formatTimestampForLog() {
  const now = /* @__PURE__ */ new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}
function saveLogToFile(vaultBasePath, taskId, output) {
  if (!output || !output.trim()) return null;
  const logDir = getTaskLogDir(vaultBasePath, taskId);
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (e) {
  }
  const timestamp = formatTimestampForLog();
  const logFile = path.join(logDir, `${timestamp}.log`);
  try {
    fs.writeFileSync(logFile, output, "utf8");
    const latestFile = path.join(logDir, "latest.log");
    fs.writeFileSync(latestFile, output, "utf8");
    return logFile;
  } catch (e) {
    return null;
  }
}
function getLogHistory(vaultBasePath, taskId) {
  const logDir = getTaskLogDir(vaultBasePath, taskId);
  try {
    if (!fs.existsSync(logDir)) return [];
    const files = fs.readdirSync(logDir).filter((f) => f.endsWith(".log") && f !== "latest.log").sort().reverse();
    return files.map((f) => ({
      file: path.join(logDir, f),
      timestamp: f.replace(".log", "").replace("_", " ").replace(/-/g, (m, i) => {
        if (i < 10) return m.replace(/-/g, "/");
        return m;
      }).replace(/(\d{4}\/\d{2}\/\d{2}) (\d{2})-(\d{2})-(\d{2})/, "$1 $2:$3:$4")
    }));
  } catch (e) {
    return [];
  }
}
function readLogFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (e) {
    return "(error reading log file)";
  }
}
function cleanupOldLogs(vaultBasePath, taskId, maxLogs) {
  if (maxLogs <= 0) return;
  const logDir = getTaskLogDir(vaultBasePath, taskId);
  try {
    if (!fs.existsSync(logDir)) return;
    const files = fs.readdirSync(logDir).filter((f) => f.endsWith(".log") && f !== "latest.log").sort();
    while (files.length > maxLogs) {
      const oldFile = files.shift();
      if (oldFile) {
        try {
          fs.unlinkSync(path.join(logDir, oldFile));
        } catch (e) {
        }
      }
    }
  } catch (e) {
  }
}
function cleanupLogsByAge(vaultBasePath, taskId, retentionDays) {
  if (retentionDays <= 0) return;
  const logDir = getTaskLogDir(vaultBasePath, taskId);
  try {
    if (!fs.existsSync(logDir)) return;
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1e3;
    const files = fs.readdirSync(logDir).filter((f) => f.endsWith(".log") && f !== "latest.log");
    for (const f of files) {
      const match = f.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.log$/);
      if (match) {
        const [, y, m, d, h, min, s] = match;
        const fileDate = /* @__PURE__ */ new Date(`${y}-${m}-${d}T${h}:${min}:${s}`);
        if (fileDate.getTime() < cutoff) {
          try {
            fs.unlinkSync(path.join(logDir, f));
          } catch (e) {
          }
        }
      }
    }
  } catch (e) {
  }
}
function clearTaskLogs(vaultBasePath, taskId) {
  const logDir = getTaskLogDir(vaultBasePath, taskId);
  try {
    if (!fs.existsSync(logDir)) return;
    const files = fs.readdirSync(logDir);
    for (const f of files) {
      try {
        fs.unlinkSync(path.join(logDir, f));
      } catch (e) {
      }
    }
    try {
      fs.rmdirSync(logDir);
    } catch (e) {
    }
  } catch (e) {
  }
}
function clearAllLogs(vaultBasePath) {
  const logsDir = path.join(vaultBasePath, ".opencode", "logs");
  try {
    if (!fs.existsSync(logsDir)) return;
    const dirs = fs.readdirSync(logsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    for (const dir of dirs) {
      clearTaskLogs(vaultBasePath, dir);
    }
    try {
      fs.rmdirSync(logsDir);
    } catch (e) {
    }
  } catch (e) {
  }
}
function deleteSingleLogFile(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (e) {
  }
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
    this.availableAgents = FALLBACK_AGENTS;
    // Map taskId -> child process, so we can kill running tasks
    this.runningProcesses = /* @__PURE__ */ new Map();
    // Update-check state
    this.latestVersion = null;
    this.updateAvailable = false;
    this.updateCheckError = null;
    this.updateInProgress = false;
  }
  async onload() {
    await this.loadSettings();
    setTimeout(() => {
      this.refreshModels();
      this.refreshAgents();
    }, 2e3);
    this.registerView(VIEW_TYPE, (leaf) => {
      this.view = new AutoOCView(leaf, this);
      return this.view;
    });
    this.addRibbonIcon("workflow", "AutoOC \u2014 Task Scheduler", () => {
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
    setTimeout(() => this.checkForUpdates(), 3e3);
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
  refreshAgents() {
    var _a;
    const agents = fetchAgentsSync(this.settings.opencodePath || "opencode");
    if (agents.length > 0) {
      this.availableAgents = agents;
      if (!this.settings.defaultAgent) {
        this.settings.defaultAgent = "general";
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
    delete this.settings.chatHistory;
    delete this.settings.chatModel;
    let changed = false;
    for (const task of this.settings.tasks) {
      if (task.status === "running") {
        task.status = "failed";
        task.output = `${task.output || ""}
[stale running state cleared on plugin load]`;
        changed = true;
      }
    }
    if (!this.settings.defaultModel) {
      this.settings.defaultModel = (_b = (_a = this.availableModels[0]) == null ? void 0 : _a.value) != null ? _b : "";
      changed = true;
    }
    if (changed) {
      await this.saveData(this.settings);
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
  // ── Version / update helpers ────────────────────────────────────────────────
  async checkForUpdates() {
    var _a, _b;
    try {
      this.updateCheckError = null;
      const res = await fetch(REMOTE_MANIFEST_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const remoteVersion = data == null ? void 0 : data.version;
      if (!remoteVersion || typeof remoteVersion !== "string") {
        throw new Error("Remote manifest has no version");
      }
      this.latestVersion = remoteVersion;
      this.updateAvailable = compareVersions(remoteVersion, this.manifest.version) > 0;
      (_a = this.view) == null ? void 0 : _a.refresh();
    } catch (e) {
      this.updateCheckError = String(e);
      (_b = this.view) == null ? void 0 : _b.refresh();
    }
  }
  async updatePlugin() {
    var _a, _b;
    if (this.updateInProgress) return;
    if (!this.latestVersion) return;
    this.updateInProgress = true;
    (_a = this.view) == null ? void 0 : _a.refresh();
    new import_obsidian.Notice("AutoOC: downloading update\u2026");
    try {
      const [mainJs, manifest, styles] = await Promise.all([
        fetch(REMOTE_FILE_URLS.mainJs, { cache: "no-cache" }).then((r) => {
          if (!r.ok) throw new Error(`main.js HTTP ${r.status}`);
          return r.text();
        }),
        fetch(REMOTE_FILE_URLS.manifest, { cache: "no-cache" }).then((r) => {
          if (!r.ok) throw new Error(`manifest.json HTTP ${r.status}`);
          return r.text();
        }),
        fetch(REMOTE_FILE_URLS.styles, { cache: "no-cache" }).then((r) => {
          if (!r.ok) throw new Error(`styles.css HTTP ${r.status}`);
          return r.text();
        })
      ]);
      const pluginDir = `.obsidian/plugins/${this.manifest.id}`;
      await this.app.vault.adapter.write(`${pluginDir}/main.js`, mainJs);
      await this.app.vault.adapter.write(`${pluginDir}/manifest.json`, manifest);
      await this.app.vault.adapter.write(`${pluginDir}/styles.css`, styles);
      new import_obsidian.Notice(`AutoOC: updated to v${this.latestVersion}. Reloading plugin\u2026`);
      try {
        await this.app.plugins.disablePlugin(this.manifest.id);
        await this.app.plugins.enablePlugin(this.manifest.id);
        new import_obsidian.Notice("AutoOC: plugin reloaded.");
      } catch (e) {
        new import_obsidian.Notice("AutoOC: update saved. Restart Obsidian to finish.");
      }
    } catch (e) {
      new import_obsidian.Notice(`AutoOC: update failed \u2014 ${String(e)}`);
    } finally {
      this.updateInProgress = false;
      (_b = this.view) == null ? void 0 : _b.refresh();
    }
  }
  // Returns the args array exactly as tool.py does: ["opencode", "run", prompt, "-m", model]
  buildArgs(task) {
    let prompt = task.prompt;
    if (task.useRalphLoop) {
      prompt = `/ralph-loop ${prompt}`;
    }
    const bin = resolveOpencodeBin(this.settings.opencodePath);
    const agent = task.agent || this.settings.defaultAgent || "general";
    return [bin, "run", prompt, "-m", task.model, "--agent", agent, "--dangerously-skip-permissions"];
  }
  // Human-readable command string for the preview modal
  buildCommand(task) {
    const args = this.buildArgs(task);
    return args.join(" ");
  }
  // Runs opencode via a fully-detached PowerShell process to avoid Electron's
  // restricted environment killing the child. Output is written to a temp file
  // that the plugin polls every 3 s.
  async runTask(task) {
    var _a;
    const idx = this.settings.tasks.findIndex((t) => t.id === task.id);
    if (idx === -1) return;
    const vaultBasePath = this.app.vault.adapter.basePath || ".";
    const previousOutput = this.settings.tasks[idx].output;
    if (this.settings.logsEnabled && previousOutput && previousOutput.trim() && previousOutput !== "[iniciando proceso desacoplado\u2026]\n") {
      saveLogToFile(vaultBasePath, task.id, previousOutput);
      cleanupOldLogs(vaultBasePath, task.id, this.settings.maxLogsPerTask);
      cleanupLogsByAge(vaultBasePath, task.id, this.settings.logRetentionDays);
    }
    this.settings.tasks[idx].status = "running";
    this.settings.tasks[idx].lastRun = (/* @__PURE__ */ new Date()).toISOString();
    this.settings.tasks[idx].output = "[iniciando proceso desacoplado\u2026]\n";
    await this.saveSettings();
    new import_obsidian.Notice(`AutoOC: running "${task.name}"\u2026`);
    const args = this.buildArgs(this.settings.tasks[idx]);
    const bin = args[0];
    const prompt = args[2];
    const model = args[4];
    const safePrompt = prompt.replace(/\r?\n\s*[-*]\s+/g, "; ").replace(/\r?\n+/g, "; ").replace(/\s+/g, " ").trim().replace(/'/g, "''");
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
    const taskCwd = task.workingDirectory || this.settings.workingDirectory || (this.app.vault.adapter.basePath || ".");
    const safeCwd = taskCwd.replace(/'/g, "''");
    let gitCmds = "";
    if (task.branch) {
      const safeBranch = task.branch.replace(/'/g, "''");
      if (task.createBranch) {
        gitCmds = `$timestamp = Get-Date -Format "yyyyMMdd-HHmm"; $branchName = "${safeBranch}-$timestamp"; git checkout -b $branchName 2>$null; if ($?) { echo "Created branch $branchName" } else { git checkout ${safeBranch} }`;
      } else {
        gitCmds = `git checkout ${safeBranch}`;
      }
    }
    const psScript = [
      `$env:USERPROFILE = '${process.env.USERPROFILE}'`,
      `$env:APPDATA     = '${process.env.APPDATA}'`,
      `$env:LOCALAPPDATA= '${process.env.LOCALAPPDATA}'`,
      `$env:PATH        = '${process.env.PATH}'`,
      `$env:HOME        = '${process.env.USERPROFILE}'`,
      `Set-Location -LiteralPath '${safeCwd}'`,
      gitCmds ? gitCmds : "",
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
    ].filter((line) => line !== "").join("\n");
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
        if (this.settings.logsEnabled) {
          saveLogToFile(vaultBasePath, task.id, t.output);
          cleanupOldLogs(vaultBasePath, task.id, this.settings.maxLogsPerTask);
          cleanupLogsByAge(vaultBasePath, task.id, this.settings.logRetentionDays);
        }
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
      if (this.settings.logsEnabled) {
        saveLogToFile(vaultBasePath, task.id, t.output);
        cleanupOldLogs(vaultBasePath, task.id, this.settings.maxLogsPerTask);
        cleanupLogsByAge(vaultBasePath, task.id, this.settings.logRetentionDays);
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
      if (this.settings.logsEnabled) {
        const vaultBasePath = this.app.vault.adapter.basePath || ".";
        saveLogToFile(vaultBasePath, id, t.output);
        cleanupOldLogs(vaultBasePath, id, this.settings.maxLogsPerTask);
        cleanupLogsByAge(vaultBasePath, id, this.settings.logRetentionDays);
      }
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
  async clearTaskLogs(id) {
    const vaultBasePath = this.app.vault.adapter.basePath || ".";
    clearTaskLogs(vaultBasePath, id);
    new import_obsidian.Notice("Logs cleared for this task.");
  }
  async clearAllLogs() {
    const vaultBasePath = this.app.vault.adapter.basePath || ".";
    clearAllLogs(vaultBasePath);
    new import_obsidian.Notice("All logs cleared.");
  }
};
var AutoOCView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.filterText = "";
    this.filterStatus = "all";
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return "AutoOC Scheduler";
  }
  getIcon() {
    return "workflow";
  }
  async onOpen() {
    this.render();
  }
  async onClose() {
  }
  refresh() {
    this.render();
  }
  openCli() {
    try {
      const bin = resolveOpencodeBin(this.plugin.settings.opencodePath);
      const cwd = this.plugin.settings.workingDirectory || this.app.vault.adapter.basePath || ".";
      openOpencodeCli(bin, cwd);
      new import_obsidian.Notice(`AutoOC: opened OpenCode CLI in ${cwd}`);
    } catch (e) {
      new import_obsidian.Notice(`AutoOC: could not open OpenCode CLI: ${String(e)}`);
    }
  }
  render() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("auto-oc-view");
    const tabBar = containerEl.createDiv("auto-oc-tab-bar");
    const btnTasks = tabBar.createEl("button", {
      text: "\u{1F4CB} Tasks",
      cls: "auto-oc-tab-btn active"
    });
    btnTasks.onclick = () => this.render();
    const btnCli = tabBar.createEl("button", {
      text: "OpenCode CLI",
      cls: "auto-oc-tab-btn"
    });
    btnCli.onclick = () => this.openCli();
    this.renderTasks(containerEl);
  }
  renderTasks(containerEl) {
    const header = containerEl.createDiv("auto-oc-header");
    const titleRow = header.createDiv("auto-oc-title-row");
    titleRow.createEl("h4", { text: "\u23F0 AutoOC Scheduler" });
    const versionWrap = titleRow.createDiv("auto-oc-version-wrap");
    versionWrap.createEl("span", {
      text: `v${this.plugin.manifest.version}`,
      cls: "auto-oc-version"
    });
    if (this.plugin.updateInProgress) {
      versionWrap.createEl("span", {
        text: "\u23F3 Updating\u2026",
        cls: "auto-oc-update-status"
      });
    } else if (this.plugin.updateAvailable && this.plugin.latestVersion) {
      versionWrap.createEl("span", {
        text: `\u{1F680} v${this.plugin.latestVersion} available`,
        cls: "auto-oc-update-badge"
      });
      const btnUpdate = versionWrap.createEl("button", {
        text: "Update now",
        cls: "auto-oc-btn-update"
      });
      btnUpdate.onclick = () => this.plugin.updatePlugin();
    } else if (this.plugin.updateCheckError) {
      versionWrap.createEl("span", {
        text: "\u26A0\uFE0F update check failed",
        cls: "auto-oc-update-error",
        title: this.plugin.updateCheckError
      });
    }
    const btnRow = header.createDiv("auto-oc-btn-row");
    const btnNew = btnRow.createEl("button", {
      text: "+ New Task",
      cls: "auto-oc-btn-primary"
    });
    btnNew.onclick = () => new CreateTaskModal(this.app, this.plugin).open();
    const filterBar = containerEl.createDiv("auto-oc-filter-bar");
    const searchInput = filterBar.createEl("input", {
      type: "text",
      placeholder: "\u{1F50D} Search name or prompt...",
      cls: "auto-oc-search-input"
    });
    searchInput.value = this.filterText;
    searchInput.oninput = () => {
      this.filterText = searchInput.value.toLowerCase();
      this.render();
    };
    const statusSelect = filterBar.createEl("select", {
      cls: "auto-oc-status-select"
    });
    const statuses = ["all", "pending", "running", "completed", "failed"];
    statuses.forEach((s) => {
      const opt = statusSelect.createEl("option");
      opt.value = s;
      opt.text = s.charAt(0).toUpperCase() + s.slice(1);
    });
    statusSelect.value = this.filterStatus;
    statusSelect.onchange = () => {
      this.filterStatus = statusSelect.value;
      this.render();
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
    const filteredTasks = tasks.filter((t) => {
      const matchesText = t.name.toLowerCase().includes(this.filterText) || t.prompt.toLowerCase().includes(this.filterText);
      const matchesStatus = this.filterStatus === "all" || t.status === this.filterStatus;
      return matchesText && matchesStatus;
    });
    if (filteredTasks.length === 0) {
      containerEl.createEl("p", {
        text: this.filterText || this.filterStatus !== "all" ? "No tasks match your filters." : 'No tasks scheduled. Create one with "+New Task".',
        cls: "auto-oc-empty"
      });
      return;
    }
    const list = containerEl.createDiv("auto-oc-list");
    for (const task of [...filteredTasks].reverse()) {
      this.renderTaskCard(list, task);
    }
  }
  renderTaskCard(parent, task) {
    var _a, _b;
    const card = parent.createDiv(`auto-oc-card auto-oc-status-${task.status}`);
    const summary = card.createDiv("auto-oc-card-summary");
    const title = summary.createEl("span", { text: task.name, cls: "auto-oc-task-name" });
    const badge = summary.createEl("span", {
      text: task.status,
      cls: `auto-oc-badge auto-oc-badge-${task.status}`
    });
    if (task.status === "failed") {
      badge.addClass("auto-oc-badge-clickable");
      badge.title = "Click to reset to pending (will run on next schedule, or hit \u25B6 Run now)";
      badge.onclick = async (e) => {
        e.stopPropagation();
        task.status = "pending";
        await this.plugin.saveSettings();
        this.render();
        new import_obsidian.Notice(`AutoOC: "${task.name}" reset to pending.`);
      };
    }
    const details = card.createDiv("auto-oc-card-details");
    details.style.display = "none";
    const meta = details.createDiv("auto-oc-card-meta");
    const modelLabel = (_b = (_a = this.plugin.availableModels.find((m) => m.value === task.model)) == null ? void 0 : _a.label) != null ? _b : task.model;
    meta.createEl("span", { text: `\u{1F916} ${modelLabel}` });
    meta.createEl("span", { text: `\u2699\uFE0F ${task.agent || "general"}` });
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
    const preview = details.createDiv("auto-oc-prompt-preview");
    preview.createEl("span", {
      text: task.prompt.slice(0, 140) + (task.prompt.length > 140 ? "\u2026" : "")
    });
    const actions = details.createDiv("auto-oc-card-actions");
    const btnRun = actions.createEl("button", {
      text: task.status === "running" ? "\u23F3 Running\u2026" : "\u25B6 Run",
      cls: "auto-oc-btn-run"
    });
    btnRun.disabled = task.status === "running";
    btnRun.onclick = (e) => {
      e.stopPropagation();
      this.plugin.runTask(task);
    };
    if (task.status === "running") {
      const btnStop = actions.createEl("button", {
        text: "\u23F9 Stop",
        cls: "auto-oc-btn-stop"
      });
      btnStop.title = "Terminate process now";
      btnStop.onclick = async (e) => {
        e.stopPropagation();
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
    btnLog.onclick = (e) => {
      e.stopPropagation();
      new LiveLogModal(this.app, task, this.plugin).open();
    };
    const btnHistory = actions.createEl("button", {
      text: "\u{1F4DC} History",
      cls: "auto-oc-btn-history"
    });
    btnHistory.onclick = (e) => {
      e.stopPropagation();
      new LogHistoryModal(this.app, task, this.plugin).open();
    };
    const btnCmd = actions.createEl("button", {
      text: "\u{1F50D} Command",
      cls: "auto-oc-btn-cmd"
    });
    btnCmd.onclick = (e) => {
      e.stopPropagation();
      const cmd = this.plugin.buildCommand(task);
      new CommandPreviewModal(this.app, task.name, cmd).open();
    };
    const btnEdit = actions.createEl("button", {
      text: "\u270F\uFE0F Edit",
      cls: "auto-oc-btn-edit"
    });
    btnEdit.onclick = (e) => {
      e.stopPropagation();
      new CreateTaskModal(this.app, this.plugin, task).open();
    };
    const btnDelete = actions.createEl("button", {
      text: "\u{1F5D1}",
      cls: "auto-oc-btn-delete"
    });
    btnDelete.title = "Delete task";
    btnDelete.onclick = async (e) => {
      e.stopPropagation();
      if (confirm(`Delete task "${task.name}"?`)) {
        await this.plugin.deleteTask(task.id);
      }
    };
    summary.onclick = () => {
      const isHidden = details.style.display === "none";
      details.style.display = isHidden ? "block" : "none";
      card.classList.toggle("expanded", isHidden);
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
      agent: plugin.settings.defaultAgent || "general",
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
    contentEl.style.maxWidth = "800px";
    contentEl.style.width = "90%";
    contentEl.createEl("h3", {
      text: this.editTask ? "Edit Task" : "New OpenCode Task"
    });
    new import_obsidian.Setting(contentEl).setName("Name").setDesc("Short task identifier").addText((text) => {
      var _a;
      text.inputEl.addClass("auto-oc-modal-input");
      text.setValue((_a = this.draft.name) != null ? _a : "").onChange((v) => this.draft.name = v);
      window.setTimeout(() => text.inputEl.focus(), 50);
    });
    new import_obsidian.Setting(contentEl).setName("Prompt / Goal").setDesc("Text to send to OpenCode").addTextArea((ta) => {
      var _a;
      ta.setValue((_a = this.draft.prompt) != null ? _a : "").onChange((v) => this.draft.prompt = v);
      ta.inputEl.addClass("auto-oc-modal-textarea");
      ta.inputEl.rows = 5;
      ta.inputEl.style.width = "100%";
      ta.inputEl.spellcheck = false;
    });
    contentEl.createDiv("auto-oc-modal-section-title").setText("\u{1F4C2} Workspace & Git");
    new import_obsidian.Setting(contentEl).setName("Project Path").setDesc("Absolute path to the project (empty = vault root)").addText((text) => {
      var _a;
      text.inputEl.addClass("auto-oc-modal-input");
      text.setPlaceholder(this.app.vault.adapter.basePath || "C:\\path\\to\\project").setValue((_a = this.draft.workingDirectory) != null ? _a : "").onChange((v) => this.draft.workingDirectory = v);
    });
    let branchInput = null;
    new import_obsidian.Setting(contentEl).setName("Git Branch").setDesc("Branch to work on").addText((text) => {
      var _a;
      branchInput = text.inputEl;
      text.inputEl.addClass("auto-oc-modal-input");
      text.setPlaceholder("main").setValue((_a = this.draft.branch) != null ? _a : "").onChange((v) => this.draft.branch = v);
    }).addButton(
      (btn) => btn.setButtonText("\u{1F50D} Discover").onClick(async () => {
        const taskCwd = this.draft.workingDirectory || this.plugin.settings.workingDirectory || this.app.vault.adapter.basePath || ".";
        new import_obsidian.Notice("AutoOC: Fetching branches...");
        try {
          const branches = listGitBranches(taskCwd);
          if (branches.length > 0) {
            const selected = await new BranchSelectorModal(this.app, branches).open();
            if (selected) {
              this.draft.branch = selected;
              if (branchInput) branchInput.value = selected;
              new import_obsidian.Notice(`AutoOC: Selected branch ${selected}`);
            }
          } else {
            new import_obsidian.Notice("AutoOC: No branches found.");
          }
        } catch (e) {
          new import_obsidian.Notice(`AutoOC: Could not list branches: ${String(e)}`);
        }
      })
    );
    new import_obsidian.Setting(contentEl).setName("Create Branch").setDesc("Automatically create the branch if it doesn't exist").addToggle((tog) => {
      var _a;
      tog.setValue((_a = this.draft.createBranch) != null ? _a : false);
      tog.onChange((v) => this.draft.createBranch = v);
    });
    new import_obsidian.Setting(contentEl).setName("Agent").setDesc(`AI agent personality to use (${this.plugin.availableAgents.length} loaded)`).addDropdown((dd) => {
      var _a;
      const agents = this.plugin.availableAgents.filter((a) => isValidAgentName(a.value));
      agents.forEach((a) => dd.addOption(a.value, a.label));
      const current = (_a = this.draft.agent) != null ? _a : this.plugin.settings.defaultAgent || "general";
      if (!current && agents.length === 0) {
        dd.addOption("", "(no agents; tap refresh)");
      } else if (current && !agents.find((a) => a.value === current)) {
        dd.addOption(current, current);
      }
      dd.setValue(current || "");
      dd.onChange((v) => this.draft.agent = v);
    });
    contentEl.createEl("p", {
      text: `Detected agents: ${this.plugin.availableAgents.map((a) => a.label).join(", ") || "none"}`,
      cls: "setting-item-description auto-oc-agent-list"
    });
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("\u{1F504} Refresh Agents").onClick(() => {
        this.plugin.refreshAgents();
        new import_obsidian.Notice(`AutoOC: ${this.plugin.availableAgents.length} agents loaded.`);
        this.contentEl.empty();
        this.onOpen();
      })
    );
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
      new import_obsidian.Setting(contentEl).setName("Date").setDesc("Format YYYY-MM-DD").addText((text) => {
        var _a;
        text.inputEl.addClass("auto-oc-modal-input");
        text.setPlaceholder(todayString()).setValue((_a = this.draft.scheduleDate) != null ? _a : "").onChange((v) => this.draft.scheduleDate = v);
      });
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
    new import_obsidian.Setting(contentEl).setName("Time").setDesc("Format HH:MM (24h)").addText((text) => {
      var _a;
      text.inputEl.addClass("auto-oc-modal-input");
      text.setPlaceholder("09:00").setValue((_a = this.draft.scheduleTime) != null ? _a : "").onChange((v) => this.draft.scheduleTime = v);
    });
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
            const wasRunning = this.editTask.status === "running";
            this.plugin.settings.tasks[idx] = {
              ...this.editTask,
              ...this.draft,
              status: wasRunning ? "running" : "pending"
            };
          }
        } else {
          const task = {
            id: generateId(),
            name: this.draft.name,
            prompt: this.draft.prompt,
            model: this.draft.model,
            agent: this.draft.agent || "general",
            useRalphLoop: (_f = this.draft.useRalphLoop) != null ? _f : false,
            scheduleType: (_g = this.draft.scheduleType) != null ? _g : "once",
            scheduleTime: this.draft.scheduleTime,
            scheduleDate: (_h = this.draft.scheduleDate) != null ? _h : "",
            scheduleDays: (_i = this.draft.scheduleDays) != null ? _i : [],
            status: "pending",
            lastRun: "",
            output: "",
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            workingDirectory: this.draft.workingDirectory,
            branch: this.draft.branch,
            createBranch: this.draft.createBranch
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
var LogHistoryModal = class extends import_obsidian.Modal {
  constructor(app, task, plugin) {
    super(app);
    this.task = task;
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("auto-oc-output-modal");
    const header = contentEl.createDiv("auto-oc-log-header");
    header.createEl("h3", { text: `\u{1F4DC} Log History: ${this.task.name}` });
    const vaultBasePath = this.app.vault.adapter.basePath || ".";
    const history = getLogHistory(vaultBasePath, this.task.id);
    if (history.length === 0) {
      contentEl.createEl("p", {
        text: "No historical logs found for this task.",
        cls: "auto-oc-empty"
      });
      return;
    }
    const toolbar = header.createDiv("auto-oc-log-toolbar");
    toolbar.createEl("span", {
      text: `${history.length} execution(s)`,
      cls: "setting-item-description"
    });
    const btnClearAll = toolbar.createEl("button", {
      text: "\u{1F9F9} Clear All",
      cls: "auto-oc-btn-secondary"
    });
    btnClearAll.onclick = async () => {
      if (confirm(`Delete ALL ${history.length} logs for "${this.task.name}"?`)) {
        clearTaskLogs(vaultBasePath, this.task.id);
        this.close();
        new import_obsidian.Notice("All logs cleared.");
      }
    };
    const list = contentEl.createDiv("auto-oc-log-history-list");
    list.style.maxHeight = "60vh";
    list.style.overflowY = "auto";
    for (const entry of history) {
      const item = list.createDiv("auto-oc-log-history-item");
      item.style.display = "flex";
      item.style.alignItems = "center";
      item.style.justifyContent = "space-between";
      item.style.padding = "8px 12px";
      item.style.marginBottom = "4px";
      item.style.borderRadius = "4px";
      item.style.backgroundColor = "var(--background-secondary)";
      const label = item.createSpan({ text: `\u{1F550} ${entry.timestamp}`, cls: "auto-oc-log-history-timestamp" });
      label.style.cursor = "pointer";
      label.style.flex = "1";
      label.onclick = () => {
        const content = readLogFile(entry.file);
        const previewModal = new LogPreviewModal(this.app, this.task.name, entry.timestamp, content);
        previewModal.open();
      };
      const btnDelete = item.createEl("button", {
        text: "\u{1F5D1}",
        cls: "auto-oc-btn-delete-small"
      });
      btnDelete.title = "Delete this log";
      btnDelete.style.marginLeft = "8px";
      btnDelete.onclick = async (e) => {
        e.stopPropagation();
        if (confirm(`Delete log from ${entry.timestamp}?`)) {
          deleteSingleLogFile(entry.file);
          this.close();
          this.open();
        }
      };
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
var LogPreviewModal = class extends import_obsidian.Modal {
  constructor(app, taskName, timestamp, content) {
    super(app);
    this.pre = null;
    this.taskName = taskName;
    this.timestamp = timestamp;
    this.content = content;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("auto-oc-output-modal");
    const header = contentEl.createDiv("auto-oc-log-header");
    header.createEl("h3", { text: `\u{1F4C4} Log: ${this.taskName}` });
    header.createEl("p", { text: `Execution: ${this.timestamp}`, cls: "auto-oc-log-status" });
    const toolbar = contentEl.createDiv("auto-oc-log-toolbar");
    const btnCopy = toolbar.createEl("button", {
      text: "\u{1F4CB} Copy",
      cls: "auto-oc-btn-secondary"
    });
    btnCopy.onclick = () => {
      navigator.clipboard.writeText(this.content);
      new import_obsidian.Notice("Log copied.");
    };
    const btnClose = toolbar.createEl("button", {
      text: "\u2716 Close",
      cls: "auto-oc-btn-secondary"
    });
    btnClose.onclick = () => this.close();
    this.pre = contentEl.createEl("pre", { cls: "auto-oc-output-pre auto-oc-log-pre" });
    this.pre.textContent = this.content;
    this.pre.scrollTop = this.pre.scrollHeight;
  }
  onClose() {
    this.contentEl.empty();
  }
};
var BranchSelectorModal = class extends import_obsidian.Modal {
  constructor(app, branches) {
    super(app);
    this.selectedBranch = null;
    this.resolveSelection = null;
    this.branches = branches;
  }
  async open() {
    return new Promise((resolve) => {
      this.resolveSelection = resolve;
      super.open();
    });
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Select Git Branch" });
    const list = contentEl.createDiv("branch-selector-list");
    list.style.maxHeight = "400px";
    list.style.overflowY = "auto";
    this.branches.forEach((branch) => {
      const item = list.createEl("div", { text: branch, cls: "branch-selector-item" });
      item.style.cursor = "pointer";
      item.style.padding = "4px 8px";
      item.onclick = () => {
        this.selectedBranch = branch;
        this.close();
      };
    });
  }
  onClose() {
    var _a;
    this.contentEl.empty();
    (_a = this.resolveSelection) == null ? void 0 : _a.call(this, this.selectedBranch);
    this.resolveSelection = null;
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
    containerEl.createEl("h3", { text: "Logging" });
    containerEl.createEl("p", {
      text: "Logs are saved to `.opencode/logs/{task-id}/` in your vault. Each execution creates a timestamped log file.",
      cls: "setting-item-description"
    });
    new import_obsidian.Setting(containerEl).setName("Enable Log Persistence").setDesc("Save task logs to files when execution completes").addToggle(
      (tog) => tog.setValue(this.plugin.settings.logsEnabled).onChange(async (v) => {
        this.plugin.settings.logsEnabled = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Max Logs Per Task").setDesc("Maximum number of log files to keep per task (0 = unlimited)").addText(
      (text) => {
        var _a;
        return text.setPlaceholder("50").setValue(String((_a = this.plugin.settings.maxLogsPerTask) != null ? _a : 50)).onChange(async (v) => {
          const n = parseInt(v, 10);
          if (!isNaN(n) && n >= 0) {
            this.plugin.settings.maxLogsPerTask = n;
            await this.plugin.saveSettings();
          }
        });
      }
    );
    new import_obsidian.Setting(containerEl).setName("Log Retention (days)").setDesc("Delete logs older than this many days (0 = no age limit)").addText(
      (text) => {
        var _a;
        return text.setPlaceholder("30").setValue(String((_a = this.plugin.settings.logRetentionDays) != null ? _a : 30)).onChange(async (v) => {
          const n = parseInt(v, 10);
          if (!isNaN(n) && n >= 0) {
            this.plugin.settings.logRetentionDays = n;
            await this.plugin.saveSettings();
          }
        });
      }
    );
    new import_obsidian.Setting(containerEl).setName("Clear All Logs").setDesc("Delete all log files for every task").addButton(
      (btn) => btn.setButtonText("\u{1F9F9} Clear All Logs").setWarning().onClick(async () => {
        if (confirm("Delete ALL log files for ALL tasks? This cannot be undone.")) {
          await this.plugin.clearAllLogs();
        }
      })
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
    new import_obsidian.Setting(containerEl).setName("Default Agent").setDesc(`Agent used by default (${this.plugin.availableAgents.length} loaded)`).addDropdown((dd) => {
      const agents = this.plugin.availableAgents;
      agents.forEach((a) => dd.addOption(a.value, a.label));
      const current = this.plugin.settings.defaultAgent || "general";
      if (current && !agents.find((a) => a.value === current)) {
        dd.addOption(current, current);
      }
      dd.setValue(current);
      dd.onChange(async (v) => {
        this.plugin.settings.defaultAgent = v;
        await this.plugin.saveSettings();
      });
    });
    containerEl.createEl("h3", { text: "Available Agents" });
    const refreshAgentsBtn = containerEl.createEl("button", {
      text: "\u{1F504} Reload Agent List",
      cls: "auto-oc-btn-secondary"
    });
    refreshAgentsBtn.style.marginBottom = "8px";
    refreshAgentsBtn.onclick = () => {
      this.plugin.refreshAgents();
      new import_obsidian.Notice(`AutoOC: ${this.plugin.availableAgents.length} agents loaded.`);
      this.display();
    };
    containerEl.createEl("p", {
      text: `${this.plugin.availableAgents.length} agents loaded from \`opencode agent list\``,
      cls: "setting-item-description"
    });
    const agentsTable = containerEl.createEl("table", { cls: "auto-oc-models-table" });
    const agentsHead = agentsTable.createEl("thead");
    const agentsHeader = agentsHead.createEl("tr");
    agentsHeader.createEl("th", { text: "agent" });
    const agentsBody = agentsTable.createEl("tbody");
    this.plugin.availableAgents.forEach((a) => {
      const tr = agentsBody.createEl("tr");
      tr.createEl("td", { text: a.value, cls: "auto-oc-model-value" });
    });
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
