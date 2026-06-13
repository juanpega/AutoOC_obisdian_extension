import {
  App,
  ItemView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  WorkspaceLeaf,
} from "obsidian";
import { spawn, exec } from "child_process";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";

// Resolve the opencode binary: on Windows prefer .cmd so Electron finds it without PATH
function resolveOpencodeBin(configured: string): string {
  if (configured && configured !== "opencode") return configured;
  if (os.platform() === "win32") {
    // Try common npm global path
    const candidate = `${process.env.APPDATA}\\npm\\opencode.cmd`;
    try {
      const { existsSync } = require("fs");
      if (existsSync(candidate)) return candidate;
    } catch { /* ignore */ }
  }
  return configured || "opencode";
}

function psSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function openOpencodeCli(bin: string, cwd: string): void {
  if (process.platform === "win32") {
    const command = `Set-Location -LiteralPath ${psSingleQuoted(cwd)}; & ${psSingleQuoted(bin)}`;
    const launcher = spawn(
      "cmd.exe",
      ["/c", "start", "OpenCode CLI", "/D", cwd, "powershell.exe", "-NoLogo", "-NoExit", "-Command", command],
      { detached: true, stdio: "ignore", windowsHide: false },
    );
    launcher.unref();
    return;
  }

  if (process.platform === "darwin") {
    const escapedCwd = cwd.replace(/(["\\$`])/g, "\\$1");
    const escapedBin = bin.replace(/(["\\$`])/g, "\\$1");
    const script = `tell application "Terminal" to do script "cd ${escapedCwd} && ${escapedBin}"`;
    const launcher = spawn("osascript", ["-e", script], { detached: true, stdio: "ignore" });
    launcher.unref();
    return;
  }

  const command = `cd ${JSON.stringify(cwd)} && ${JSON.stringify(bin)}`;
  const launcher = spawn("x-terminal-emulator", ["-e", "sh", "-lc", command], { detached: true, stdio: "ignore" });
  launcher.unref();
}

// Launch a PowerShell script completely silently using wscript.exe + VBScript.
// wscript.exe with WScript.Shell.Run(..., 0, false) shows NO window at all —
// not even a brief black flash — and breaks out of Electron's Job Object.
function launchHiddenPS(psScriptFile: string): void {
  const fs   = require("fs");
  const path = require("path");
  const vbsFile = psScriptFile.replace(/\.ps1$/, ".vbs");
  const vbs = `Set sh = CreateObject("WScript.Shell")\r\n` +
    `sh.Run "powershell.exe -NoLogo -NonInteractive -WindowStyle Hidden -File """ & "${psScriptFile.replace(/"/g, '""')}" & """", 0, False\r\n`;
  fs.writeFileSync(vbsFile, vbs, "utf8");
  const { spawn } = require("child_process");
  const ws = spawn("wscript.exe", [vbsFile], { detached: true, stdio: "ignore", windowsHide: true });
  ws.unref();
  // Clean up vbs after a moment
  setTimeout(() => { try { fs.unlinkSync(vbsFile); } catch { /* ignore */ } }, 10000);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ScheduleType = "once" | "daily" | "weekly";
type TaskStatus = "pending" | "running" | "completed" | "failed";

interface ScheduledTask {
  id: string;
  name: string;
  prompt: string;
  model: string;
  useRalphLoop: boolean;
  scheduleType: ScheduleType;
  scheduleTime: string;    // "HH:MM"
  scheduleDate: string;    // "YYYY-MM-DD" — usado en tipo 'once'
  scheduleDays: number[];  // [0–6] Dom–Sáb — usado en tipo 'weekly'
  status: TaskStatus;
  lastRun: string;         // ISO string
  output: string;
  createdAt: string;       // ISO string;
  workingDirectory?: string; // Optional path override
  branch?: string;           // Git branch name
  createBranch?: boolean;    // Create branch if it doesn't exist
}

interface AutoOCSettings {
  tasks: ScheduledTask[];
  opencodePath: string;
  defaultModel: string;
  workingDirectory: string;
  cmdTemplate: string;
  taskTimeoutSeconds: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// No hardcoded models: load dynamically with `opencode models`.
const FALLBACK_MODELS: { value: string; label: string }[] = [];

function fetchModelsSync(opencodePath: string): { value: string; label: string }[] {
  const { execSync } = require("child_process");
  const bin = resolveOpencodeBin(opencodePath);
  try {
    const out = execSync(`"${bin}" models`, { timeout: 8000, encoding: "utf8" });
    return out
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && l.includes("/"))
      .map((l) => ({ value: l, label: l }));
  } catch {
    return [];
  }
}

const DEFAULT_SETTINGS: AutoOCSettings = {
  tasks: [],
  opencodePath: "opencode",
  defaultModel: "",
  workingDirectory: "",
  // {opencode} = binary path, {model} = provider/model, {prompt} = escaped prompt
  cmdTemplate: '{opencode} run --model {model} "{prompt}"',
  taskTimeoutSeconds: 1800,  // 30 min por defecto
};

export const VIEW_TYPE = "auto-oc-view";
const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("es-ES") +
    " " +
    d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
  );
}

function padTwo(n: number): string {
  return String(n).padStart(2, "0");
}

function todayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${padTwo(now.getMonth() + 1)}-${padTwo(now.getDate())}`;
}

function nowTimeString(): string {
  const now = new Date();
  return `${padTwo(now.getHours())}:${padTwo(now.getMinutes())}`;
}

function normalizeCommandOutput(text: string): string {
  if (!text) return "";

  // Remove ANSI color/control escape sequences
  let cleaned = text.replace(/\x1B\[[0-9;]*[A-Za-z]/g, "");

  // Best-effort fix for common mojibake (UTF-8 interpreted as Latin-1)
  // Only apply when typical broken markers are present.
  if (/[ÃÂâ€œâ€|â€|â€|â„¢|â€“|â€”]/.test(cleaned)) {
    try {
      cleaned = Buffer.from(cleaned, "latin1").toString("utf8");
    } catch {
      // keep cleaned as-is if conversion fails
    }
  }

  return cleaned.trim();
}

function getOpencodeConfigPath(): string {
  return path.join(os.homedir(), ".config", "opencode", "opencode.json");
}

function getRalphStateFilePath(vaultBasePath: string): string {
  return path.join(vaultBasePath, ".opencode", "ralph-loop.local.md");
}

function isTaskDue(task: ScheduledTask): boolean {
  if (task.status === "running") return false;

  const now = new Date();
  const [hh, mm] = task.scheduleTime.split(":").map(Number);

  if (task.scheduleType === "once") {
    if (task.status === "completed") return false;
    const target = new Date(`${task.scheduleDate}T${task.scheduleTime}:00`);
    return now >= target;
  }

  if (task.scheduleType === "daily") {
    const todayTarget = new Date();
    todayTarget.setHours(hh, mm, 0, 0);
    if (now < todayTarget) return false;
    if (!task.lastRun) return true;
    return new Date(task.lastRun).toDateString() !== now.toDateString();
  }

  if (task.scheduleType === "weekly") {
    if (!task.scheduleDays.includes(now.getDay())) return false;
    const todayTarget = new Date();
    todayTarget.setHours(hh, mm, 0, 0);
    if (now < todayTarget) return false;
    if (!task.lastRun) return true;
    return new Date(task.lastRun).toDateString() !== now.toDateString();
  }

  return false;
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default class AutoOCPlugin extends Plugin {
  settings!: AutoOCSettings;
  view?: AutoOCView;
  availableModels: { value: string; label: string }[] = FALLBACK_MODELS;
  // Map taskId -> child process, so we can kill running tasks
  private runningProcesses = new Map<string, ReturnType<typeof spawn>>();

  async onload() {
    await this.loadSettings();
    // Load models asynchronously to avoid blocking startup
    setTimeout(() => this.refreshModels(), 2000);

    this.registerView(VIEW_TYPE, (leaf) => {
      this.view = new AutoOCView(leaf, this);
      return this.view;
    });

    this.addRibbonIcon("alarm-clock", "AutoOC — Task Scheduler", () => {
      this.toggleView();
    });

    this.addCommand({
      id: "open-auto-oc",
      name: "Open AutoOC Task Scheduler",
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: "create-task",
      name: "Create new OpenCode task",
      callback: () => new CreateTaskModal(this.app, this).open(),
    });

    this.addCommand({
      id: "check-tasks-now",
      name: "Check due tasks now",
      callback: async () => {
        await this.runDueTasks();
        new Notice("AutoOC: check completed.");
      },
    });

    this.addCommand({
      id: "diagnose",
      name: "AutoOC: Diagnostic — test opencode command",
      callback: () => new DiagnosticModal(this.app, this).open(),
    });

    this.addCommand({
      id: "install-ralph-loop",
      name: "AutoOC: Ralph Loop Assistant (install/activate)",
      callback: async () => {
        const result = await this.ensureRalphLoopPluginEnabled();
        new Notice(
          result.changed
            ? `AutoOC: Ralph Loop enabled at ${result.configPath}. Restart OpenCode.`
            : `AutoOC: Ralph Loop was already active at ${result.configPath}.`
        );
      },
    });

    this.addSettingTab(new AutoOCSettingTab(this.app, this));

    // Scheduler: comprueba cada 60 segundos
    this.registerInterval(
      window.setInterval(() => this.runDueTasks(), 60_000)
    );

    // Initial check after startup (5 s margin for Obsidian to load)
    setTimeout(() => this.runDueTasks(), 5_000);
  }

  async onunload() {
    // Kill all running processes cleanly when plugin unloads
    for (const [, proc] of this.runningProcesses) {
      proc.kill();
    }
    this.runningProcesses.clear();
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  refreshModels(): void {
    const models = fetchModelsSync(this.settings.opencodePath || "opencode");
    if (models.length > 0) {
      this.availableModels = models;
      if (!this.settings.defaultModel || !models.find((m) => m.value === this.settings.defaultModel)) {
        this.settings.defaultModel = models[0].value;
        void this.saveSettings();
      }
      this.view?.refresh();
    }
  }

  getEffectiveDefaultModel(): string {
    if (this.settings.defaultModel) return this.settings.defaultModel;
    return this.availableModels[0]?.value ?? "";
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
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    delete (this.settings as any).chatHistory;
    delete (this.settings as any).chatModel;
    let changed = false;
    for (const task of this.settings.tasks) {
      if (task.status === "running") {
        task.status = "failed";
        task.output = `${task.output || ""}\n[stale running state cleared on plugin load]`;
        changed = true;
      }
    }
    if (!this.settings.defaultModel) {
      this.settings.defaultModel = this.availableModels[0]?.value ?? "";
      changed = true;
    }
    if (changed) {
      await this.saveData(this.settings);
    }
  }

  isRalphLoopEnabled(): boolean {
    const configPath = getOpencodeConfigPath();
    if (!fs.existsSync(configPath)) return false;
    try {
      const raw = fs.readFileSync(configPath, "utf8");
      const data = JSON.parse(raw);
      return Array.isArray(data?.plugin) && data.plugin.includes("opencode-ralph-loop");
    } catch {
      return false;
    }
  }

  async ensureRalphLoopPluginEnabled(): Promise<{ changed: boolean; configPath: string }> {
    const configPath = getOpencodeConfigPath();
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    let data: Record<string, any> = {};
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, "utf8");
        data = raw.trim() ? JSON.parse(raw) : {};
      } catch {
        throw new Error(`Could not read valid JSON from ${configPath}`);
      }
    }

    const plugins = Array.isArray(data.plugin) ? [...data.plugin] : [];
    if (plugins.includes("opencode-ralph-loop")) {
      return { changed: false, configPath };
    }

    plugins.push("opencode-ralph-loop");
    data.plugin = plugins;
    fs.writeFileSync(configPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    return { changed: true, configPath };
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.view?.refresh();
  }

  // Returns the args array exactly as tool.py does: ["opencode", "run", prompt, "-m", model]
  buildArgs(task: ScheduledTask): string[] {
    let prompt = task.prompt;
    if (task.useRalphLoop) {
      prompt = `/ralph-loop ${prompt}`;
    }
    const bin = resolveOpencodeBin(this.settings.opencodePath);
    // --dangerously-skip-permissions prevents opencode from blocking on tool-approval prompts
    return [bin, "run", prompt, "-m", task.model, "--dangerously-skip-permissions"];
  }

  // Human-readable command string for the preview modal
  buildCommand(task: ScheduledTask): string {
    const args = this.buildArgs(task);
    return `${args[0]} ${args[1]} "${args[2]}" ${args[3]} ${args[4]} ${args[5]}`;
  }

  // Runs opencode via a fully-detached PowerShell process to avoid Electron's
  // restricted environment killing the child. Output is written to a temp file
  // that the plugin polls every 3 s.
  async runTask(task: ScheduledTask) {
    const idx = this.settings.tasks.findIndex((t) => t.id === task.id);
    if (idx === -1) return;

    this.settings.tasks[idx].status = "running";
    this.settings.tasks[idx].lastRun = new Date().toISOString();
    this.settings.tasks[idx].output = "[iniciando proceso desacoplado…]\n";
    await this.saveSettings();

    new Notice(`AutoOC: running "${task.name}"…`);

    const args = this.buildArgs(this.settings.tasks[idx]);
    const bin   = args[0]; // opencode.cmd full path
    const prompt = args[2];
    const model  = args[4];
    const safePrompt = prompt
      .replace(/\r?\n\s*[-*]\s+/g, "; ")
      .replace(/\r?\n+/g, "; ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/'/g, "''"); // escape for PS single-quoted string

    const tmpDir = require("os").tmpdir();
    const outFile = require("path").join(tmpDir, `autooc-${task.id}.txt`);
    const pidFile = require("path").join(tmpDir, `autooc-${task.id}.pid`);
    const fs = require("fs");

    // Clean up any previous temp files
    try { fs.unlinkSync(outFile); } catch { /* ignore */ }
    try { fs.unlinkSync(pidFile); } catch { /* ignore */ }

    // PS script: Start-Process in ONE line (multi-line breaks PS argument parsing)
    // Resolve working directory: Task override -> Global Setting -> Vault Path
    const taskCwd = task.workingDirectory || this.settings.workingDirectory || ((this.app.vault.adapter as any).basePath || ".");
    const safeCwd = taskCwd.replace(/'/g, "''");

    // Git branch logic
    let gitCmds = "";
    if (task.branch) {
      const safeBranch = task.branch.replace(/'/g, "''");
      if (task.createBranch) {
        gitCmds = `git checkout -b ${safeBranch} 2>$null; if ($?) { echo "Created branch ${safeBranch}" } else { git checkout ${safeBranch} }`;
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
      `$combined = ($stdout + $(if($stderr){"\n[stderr]\n" + $stderr}else{""})).Trim()`,
      `[System.IO.File]::WriteAllText('${outFile.replace(/'/g, "''")}', $combined + "\nDONE:$code")`,
    ].filter(line => line !== "").join("\n");

    const psScriptFile = require("path").join(tmpDir, `autooc-${task.id}.ps1`);
    fs.writeFileSync(psScriptFile, psScript, "utf8");

    // Launch completely silently via wscript.exe VBScript — zero window flash
    launchHiddenPS(psScriptFile);
    this.runningProcesses.set(task.id, { kill: () => { /* best-effort */ } } as any);

    const timeoutSeconds = this.settings.taskTimeoutSeconds ?? 1800;
    const timeoutEnabled = timeoutSeconds > 0;
    const timeoutMs = timeoutSeconds * 1000;
    const startedAt = Date.now();

    // Poll the output file every 3 s
    const pollHandle = setInterval(async () => {
      const t = this.settings.tasks.find((x) => x.id === task.id);
      if (!t) { clearInterval(pollHandle); return; }

      // Timeout guard
      if (timeoutEnabled && Date.now() - startedAt > timeoutMs) {
        clearInterval(pollHandle);
        t.output += `\n[⏱ timeout: ${timeoutSeconds}s superados]`;
        t.status = "failed";
        await this.saveSettings();
        new Notice(`AutoOC: ⏱ "${task.name}" superó el timeout.`);
        return;
      }

      if (!fs.existsSync(outFile)) {
        // Still running — heartbeat dot
        t.output += ".";
        await this.saveSettings();
        return;
      }

      // File exists — read result
      clearInterval(pollHandle);
      this.runningProcesses.delete(task.id);
      try { fs.unlinkSync(psScriptFile); } catch { /* ignore */ }

      const raw = fs.readFileSync(outFile, "utf8");
      try { fs.unlinkSync(outFile); } catch { /* ignore */ }

      const doneMatch = raw.match(/\nDONE:(-?\d+)\s*$/);
      const exitCode = doneMatch ? parseInt(doneMatch[1], 10) : -1;
      const output = doneMatch ? raw.slice(0, doneMatch.index).trim() : raw.trim();
      const normalized = normalizeCommandOutput(output);

      t.output = normalized || "(sin output)";
      if (exitCode !== 0) {
        t.status = "failed";
        t.output += `\n[código de salida: ${exitCode}]`;
        new Notice(`AutoOC: ❌ "${task.name}" falló (código ${exitCode}).`);
      } else {
        t.status = t.scheduleType === "once" ? "completed" : "pending";
        new Notice(`AutoOC: ✅ "${task.name}" completada.`);
      }
      await this.saveSettings();
    }, 3000);
  }

  async killTask(id: string) {
    const proc = this.runningProcesses.get(id);
    if (proc) {
      try { proc.kill(); } catch { /* ignore */ }
      this.runningProcesses.delete(id);
    }
    const t = this.settings.tasks.find((x) => x.id === id);
    if (t) {
      t.status = "failed";
      t.output += "\n[task stopped manually]";
      await this.saveSettings();
    }
    new Notice(`AutoOC: ⏹ Task stopped.`);
  }

  async runDueTasks() {
    for (const task of this.settings.tasks) {
      if (isTaskDue(task)) {
        await this.runTask(task);
      }
    }
  }

  async deleteTask(id: string) {
    this.settings.tasks = this.settings.tasks.filter((t) => t.id !== id);
    await this.saveSettings();
  }
}

// ─── Sidebar View ─────────────────────────────────────────────────────────────

class AutoOCView extends ItemView {
  private plugin: AutoOCPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: AutoOCPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "AutoOC Scheduler"; }
  getIcon() { return "alarm-clock"; }

  async onOpen() { this.render(); }
  async onClose() {}
  refresh() { this.render(); }

  private openCli() {
    try {
      const bin = resolveOpencodeBin(this.plugin.settings.opencodePath);
      const cwd = this.plugin.settings.workingDirectory || (this.app.vault.adapter as any).basePath || ".";
      openOpencodeCli(bin, cwd);
      new Notice(`AutoOC: opened OpenCode CLI in ${cwd}`);
    } catch (e) {
      new Notice(`AutoOC: could not open OpenCode CLI: ${String(e)}`);
    }
  }

  render() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("auto-oc-view");

    // ── Tab buttons ──
    const tabBar = containerEl.createDiv("auto-oc-tab-bar");
    const btnTasks = tabBar.createEl("button", {
      text: "📋 Tasks",
      cls: "auto-oc-tab-btn active",
    });
    btnTasks.onclick = () => this.render();

    const btnCli = tabBar.createEl("button", {
      text: "OpenCode CLI",
      cls: "auto-oc-tab-btn",
    });
    btnCli.onclick = () => this.openCli();

    // ── Content ──
    this.renderTasks(containerEl);
  }

  private renderTasks(containerEl: HTMLElement) {
    // ── Header ──
    const header = containerEl.createDiv("auto-oc-header");
    header.createEl("h4", { text: "⏰ AutoOC Scheduler" });

    const btnRow = header.createDiv("auto-oc-btn-row");

    const btnNew = btnRow.createEl("button", {
      text: "+ New Task",
      cls: "auto-oc-btn-primary",
    });
    btnNew.onclick = () => new CreateTaskModal(this.app, this.plugin).open();

    const btnCheck = btnRow.createEl("button", {
      text: "▶ Check Now",
      cls: "auto-oc-btn-secondary",
    });
    btnCheck.onclick = async () => {
      await this.plugin.runDueTasks();
      new Notice("AutoOC: check completed.");
    };

    // ── Stats bar ──
    const tasks = this.plugin.settings.tasks;
    const stats = containerEl.createDiv("auto-oc-stats");
    const pending = tasks.filter((t) => t.status === "pending").length;
    const running = tasks.filter((t) => t.status === "running").length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const failed = tasks.filter((t) => t.status === "failed").length;
    stats.createEl("span", { text: `${tasks.length} tasks` });
    if (running > 0) stats.createEl("span", { text: `🟡 ${running} running`, cls: "auto-oc-stat-running" });
    if (failed > 0) stats.createEl("span", { text: `🔴 ${failed} failed`, cls: "auto-oc-stat-failed" });
    if (completed > 0) stats.createEl("span", { text: `🟢 ${completed} completed` });

    // ── Task list ──
    if (tasks.length === 0) {
      containerEl.createEl("p", {
        text: 'No tasks scheduled. Create one with "+New Task".',
        cls: "auto-oc-empty",
      });
      return;
    }

    const list = containerEl.createDiv("auto-oc-list");
    // Show most recent first
    for (const task of [...tasks].reverse()) {
      this.renderTaskCard(list, task);
    }
  }

  private renderTaskCard(parent: HTMLElement, task: ScheduledTask) {
    const card = parent.createDiv(`auto-oc-card auto-oc-status-${task.status}`);

    // Top row: name + badge
    const top = card.createDiv("auto-oc-card-top");
    top.createEl("span", { text: task.name, cls: "auto-oc-task-name" });
    top.createEl("span", {
      text: task.status,
      cls: `auto-oc-badge auto-oc-badge-${task.status}`,
    });

    // Meta: model, schedule, last run
    const meta = card.createDiv("auto-oc-card-meta");
    const modelLabel = this.plugin.availableModels.find((m) => m.value === task.model)?.label ?? task.model;
    meta.createEl("span", { text: `🤖 ${modelLabel}` });

    let scheduleText = "";
    if (task.scheduleType === "once") {
      scheduleText = `📅 ${task.scheduleDate} ${task.scheduleTime}`;
    } else if (task.scheduleType === "daily") {
      scheduleText = `🔁 Every day at ${task.scheduleTime}`;
    } else {
      const days = task.scheduleDays.map((d) => DAY_NAMES[d]).join(", ");
      scheduleText = `🔁 ${days || "no days"} at ${task.scheduleTime}`;
    }
    meta.createEl("span", { text: scheduleText });

    if (task.lastRun) {
      meta.createEl("span", { text: `⏱ Last: ${formatDateTime(task.lastRun)}` });
    }

    if (task.useRalphLoop) {
      meta.createEl("span", { text: "♻️ Ralph Loop active", cls: "auto-oc-ralph-badge" });
    }

    // Prompt preview
    const preview = card.createDiv("auto-oc-prompt-preview");
    preview.createEl("span", {
      text: task.prompt.slice(0, 140) + (task.prompt.length > 140 ? "…" : ""),
    });

    // Action buttons
    const actions = card.createDiv("auto-oc-card-actions");

    const btnRun = actions.createEl("button", {
      text: task.status === "running" ? "⏳ Running…" : "▶ Run",
      cls: "auto-oc-btn-run",
    });
    btnRun.disabled = task.status === "running";
    btnRun.onclick = () => this.plugin.runTask(task);

    // Stop button — only when running
    if (task.status === "running") {
      const btnStop = actions.createEl("button", {
        text: "⏹ Stop",
        cls: "auto-oc-btn-stop",
      });
      btnStop.title = "Terminate process now";
      btnStop.onclick = async () => {
        btnStop.disabled = true;
        btnStop.textContent = "Stopping…";
        await this.plugin.killTask(task.id);
      };
    }

    // Log button — always visible; live-refresh when running
    const btnLog = actions.createEl("button", {
      text: task.status === "running" ? "📡 Live Log" : "📄 Log",
      cls: task.status === "running" ? "auto-oc-btn-log-live" : "auto-oc-btn-output",
    });
    btnLog.disabled = !task.output && task.status !== "running";
    btnLog.title = task.output ? "" : "Aún no hay output";
    btnLog.onclick = () => new LiveLogModal(this.app, task, this.plugin).open();

    const btnCmd = actions.createEl("button", {
      text: "🔍 Command",
      cls: "auto-oc-btn-cmd",
    });
    btnCmd.onclick = () => {
      const cmd = this.plugin.buildCommand(task);
      new CommandPreviewModal(this.app, task.name, cmd).open();
    };

    const btnEdit = actions.createEl("button", {
      text: "✏️ Edit",
      cls: "auto-oc-btn-edit",
    });
    btnEdit.onclick = () =>
      new CreateTaskModal(this.app, this.plugin, task).open();

    const btnDelete = actions.createEl("button", {
      text: "🗑",
      cls: "auto-oc-btn-delete",
    });
    btnDelete.title = "Delete task";
    btnDelete.onclick = async () => {
      if (confirm(`Delete task "${task.name}"?`)) {
        await this.plugin.deleteTask(task.id);
      }
    };
  }
}

// ─── Create / Edit Task Modal ─────────────────────────────────────────────────

class CreateTaskModal extends Modal {
  private plugin: AutoOCPlugin;
  private editTask?: ScheduledTask;
  private draft: Partial<ScheduledTask>;

  constructor(app: App, plugin: AutoOCPlugin, editTask?: ScheduledTask) {
    super(app);
    this.plugin = plugin;
    this.editTask = editTask;
    this.draft = editTask
      ? { ...editTask }
      : {
          name: "",
          prompt: "",
          model: plugin.getEffectiveDefaultModel(),
          useRalphLoop: false,
          scheduleType: "once",
          scheduleTime: nowTimeString(),
          scheduleDate: todayString(),
          scheduleDays: [],
        };
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("auto-oc-modal");
    contentEl.style.maxWidth = "800px";
    contentEl.style.width = "90%";

    contentEl.createEl("h3", {
      text: this.editTask ? "Edit Task" : "New OpenCode Task",
    });


    new Setting(contentEl)
      .setName("Name")
      .setDesc("Short task identifier")
      .addText((text) => {
        text.inputEl.addClass("auto-oc-modal-input");
        text
          .setValue(this.draft.name ?? "")
          .onChange((v) => (this.draft.name = v));
        window.setTimeout(() => text.inputEl.focus(), 50);
      });

    new Setting(contentEl)
      .setName("Prompt / Goal")
      .setDesc("Text to send to OpenCode")
      .addTextArea((ta) => {
        ta.setValue(this.draft.prompt ?? "").onChange((v) => (this.draft.prompt = v));
        ta.inputEl.addClass("auto-oc-modal-textarea");
        ta.inputEl.rows = 5;
        ta.inputEl.style.width = "100%";
        ta.inputEl.spellcheck = false;
      });

    contentEl.createDiv("auto-oc-modal-section-title").setText("📂 Workspace & Git");

    new Setting(contentEl)
      .setName("Project Path")
      .setDesc("Absolute path to the project (empty = vault root)")
      .addText((text) => {
        text.inputEl.addClass("auto-oc-modal-input");
        text
          .setPlaceholder((this.app.vault.adapter as any).basePath || "C:\\path\\to\\project")
          .setValue(this.draft.workingDirectory ?? "")
          .onChange((v) => (this.draft.workingDirectory = v));
      });

    new Setting(contentEl)
      .setName("Git Branch")
      .setDesc("Branch to work on")
      .addText((text) => {
        text.inputEl.addClass("auto-oc-modal-input");
        text
          .setPlaceholder("main")
          .setValue(this.draft.branch ?? "")
          .onChange((v) => (this.draft.branch = v));
      });

    new Setting(contentEl)
      .setName("Create Branch")
      .setDesc("Automatically create the branch if it doesn't exist")
      .addToggle((tog) => {
        tog.setValue(this.draft.createBranch ?? false);
        tog.onChange((v) => (this.draft.createBranch = v));
      });

    new Setting(contentEl)
      .setName("Model")
      .setDesc("AI model to use")

      .addDropdown((dd) => {
        const models = this.plugin.availableModels;
        models.forEach((m) => dd.addOption(m.value, m.label));
        const current = this.draft.model ?? this.plugin.getEffectiveDefaultModel();
        if (!current && models.length === 0) {
          dd.addOption("", "(no models; tap refresh)");
        } else if (current && !models.find((m) => m.value === current)) {
          dd.addOption(current, current);
        }
        dd.setValue(current || "");
        dd.onChange((v) => (this.draft.model = v));
      });

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText("🔄 Refresh Models").onClick(() => {
          this.plugin.refreshModels();
          new Notice("AutoOC: models updated. Reopen dialog.");
        })
      );

    new Setting(contentEl)
      .setName("Ralph Loop")
      .setDesc("Wrap prompt with /ralph-loop to auto-continue until DONE")
      .addToggle((tog) => {
        tog.setValue(this.draft.useRalphLoop ?? false);
        tog.onChange((v) => (this.draft.useRalphLoop = v));
      })
      .addButton((btn) =>
        btn.setButtonText("Installation Assistant").onClick(async () => {
          try {
            const result = await this.plugin.ensureRalphLoopPluginEnabled();
            new Notice(
              result.changed
                ? `Ralph Loop enabled at ${result.configPath}. Restart OpenCode.`
                : `Ralph Loop was already active at ${result.configPath}.`
            );
          } catch (e) {
            new Notice(`AutoOC: error enabling Ralph Loop: ${String(e)}`);
          }
        })
      );

    new Setting(contentEl)
      .setName("Schedule Type")
      .addDropdown((dd) => {
        dd.addOption("once", "Once (specific date and time)");
        dd.addOption("daily", "Daily (fixed time)");
        dd.addOption("weekly", "Weekdays");
        dd.setValue(this.draft.scheduleType ?? "once");
        dd.onChange((v) => {
          this.draft.scheduleType = v as ScheduleType;
          this.onOpen(); // re-render to show relevant fields
        });
      });

    // Date — only for 'once'
    if (this.draft.scheduleType === "once") {
      new Setting(contentEl)
        .setName("Date")
        .setDesc("Format YYYY-MM-DD")
        .addText((text) => {
          text.inputEl.addClass("auto-oc-modal-input");
          text
            .setPlaceholder(todayString())
            .setValue(this.draft.scheduleDate ?? "")
            .onChange((v) => (this.draft.scheduleDate = v));
        });
    }

    // Days — only for 'weekly'
    if (this.draft.scheduleType === "weekly") {
      const daySetting = new Setting(contentEl).setName("Weekdays");
      daySetting.settingEl.style.flexWrap = "wrap";
      DAY_NAMES.forEach((name, idx) => {
        daySetting.addToggle((tog) => {
          tog.setValue((this.draft.scheduleDays ?? []).includes(idx));
          tog.onChange((checked) => {
            const days = [...(this.draft.scheduleDays ?? [])];
            if (checked) {
              if (!days.includes(idx)) days.push(idx);
            } else {
              const pos = days.indexOf(idx);
              if (pos > -1) days.splice(pos, 1);
            }
            this.draft.scheduleDays = days;
          });
          // Label next to toggle
          tog.toggleEl.insertAdjacentHTML(
            "afterend",
            `<span class="auto-oc-day-label">${name}</span>`
          );
        });
      });
    }

    new Setting(contentEl)
      .setName("Time")
      .setDesc("Format HH:MM (24h)")
      .addText((text) => {
        text.inputEl.addClass("auto-oc-modal-input");
        text
          .setPlaceholder("09:00")
          .setValue(this.draft.scheduleTime ?? "")
          .onChange((v) => (this.draft.scheduleTime = v));
      });

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText(this.editTask ? "Save Changes" : "Create Task")
        .setCta()
        .onClick(async () => {
          if (!this.draft.name?.trim()) {
            new Notice("Name is required.");
            return;
          }
          if (!this.draft.prompt?.trim()) {
            new Notice("Prompt is required.");
            return;
          }
          if (!(this.draft.model ?? "").trim()) {
            new Notice("You must select a model.");
            return;
          }
          if (!/^\d{2}:\d{2}$/.test(this.draft.scheduleTime ?? "")) {
            new Notice("Invalid time. Use HH:MM format.");
            return;
          }
          if (
            this.draft.scheduleType === "once" &&
            !/^\d{4}-\d{2}-\d{2}$/.test(this.draft.scheduleDate ?? "")
          ) {
            new Notice("Invalid date. Use YYYY-MM-DD format.");
            return;
          }

          if (this.editTask) {
            const idx = this.plugin.settings.tasks.findIndex(
              (t) => t.id === this.editTask!.id
            );
            if (idx !== -1) {
              const wasRunning = this.editTask.status === "running";
              this.plugin.settings.tasks[idx] = {
                ...this.editTask,
                ...(this.draft as ScheduledTask),
                status: wasRunning ? "running" : "pending",
              };
            }
          } else {
            const task: ScheduledTask = {
              id: generateId(),
              name: this.draft.name!,
              prompt: this.draft.prompt!,
              model: this.draft.model!,
              useRalphLoop: this.draft.useRalphLoop ?? false,
              scheduleType: this.draft.scheduleType ?? "once",
              scheduleTime: this.draft.scheduleTime!,
              scheduleDate: this.draft.scheduleDate ?? "",
              scheduleDays: this.draft.scheduleDays ?? [],
              status: "pending",
              lastRun: "",
              output: "",
              createdAt: new Date().toISOString(),
              workingDirectory: this.draft.workingDirectory,
              branch: this.draft.branch,
              createBranch: this.draft.createBranch,
            };
            this.plugin.settings.tasks.push(task);

          }

          await this.plugin.saveSettings();
          new Notice(`Task "${this.draft.name}" saved.`);
          this.close();
        })
    );
  }

  onClose() {
    this.contentEl.empty();
  }
}

// ─── Live Log Modal ───────────────────────────────────────────────────────────

class LiveLogModal extends Modal {
  private task: ScheduledTask;
  private plugin: AutoOCPlugin;
  private pre: HTMLPreElement | null = null;
  private statusEl: HTMLElement | null = null;
  private intervalId: number | null = null;
  private elapsedIntervalId: number | null = null;
  private autoScroll = true;

  constructor(app: App, task: ScheduledTask, plugin: AutoOCPlugin) {
    super(app);
    this.task = task;
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("auto-oc-output-modal");

    const header = contentEl.createDiv("auto-oc-log-header");
    header.createEl("h3", { text: `📄 Log: ${this.task.name}` });

    this.statusEl = header.createEl("p", { cls: "auto-oc-log-status" });

    // Elapsed timer line
    const elapsedEl = header.createEl("p", { cls: "auto-oc-log-elapsed" });
    const updateElapsed = () => {
      if (!this.task.lastRun) { elapsedEl.textContent = ""; return; }
      const secs = Math.floor((Date.now() - new Date(this.task.lastRun).getTime()) / 1000);
      const min = Math.floor(secs / 60);
      const sec = secs % 60;
      elapsedEl.textContent = `⏱ Elapsed time: ${min}m ${sec}s`;
    };
    updateElapsed();
    this.elapsedIntervalId = window.setInterval(updateElapsed, 1000);

    const toolbar = contentEl.createDiv("auto-oc-log-toolbar");

    const btnScroll = toolbar.createEl("button", {
      text: "↓ Auto-scroll: ON",
      cls: "auto-oc-btn-secondary",
    });
    btnScroll.onclick = () => {
      this.autoScroll = !this.autoScroll;
      btnScroll.textContent = `↓ Auto-scroll: ${this.autoScroll ? "ON" : "OFF"}`;
    };

    const btnCopy = toolbar.createEl("button", {
      text: "📋 Copy",
      cls: "auto-oc-btn-secondary",
    });
    btnCopy.onclick = () => {
      navigator.clipboard.writeText(this.pre?.textContent ?? "");
      new Notice("Log copied.");
    };

    const btnClear = toolbar.createEl("button", {
      text: "🗑 Clear View",
      cls: "auto-oc-btn-secondary",
    });
    btnClear.onclick = () => {
      if (this.pre) this.pre.textContent = "";
    };

    this.pre = contentEl.createEl("pre", { cls: "auto-oc-output-pre auto-oc-log-pre" });

    this.refresh();

    // Auto-refresh every second while running
    this.intervalId = window.setInterval(() => this.refresh(), 1000);
  }

  private refresh() {
    // Get latest task state from plugin
    const latest = this.plugin.settings.tasks.find((t) => t.id === this.task.id);
    if (!latest) return;
    this.task = latest;

    if (this.statusEl) {
      const isRunning = latest.status === "running";
      this.statusEl.textContent =
        `Estado: ${latest.status}` +
        (latest.lastRun ? `  |  Inicio: ${formatDateTime(latest.lastRun)}` : "") +
        (isRunning ? "  ⏳" : "");
      this.statusEl.className =
        "auto-oc-log-status auto-oc-badge-" + latest.status;
    }

    if (this.pre) {
      const newContent = latest.output || "(sin output aún…)";
      if (this.pre.textContent !== newContent) {
        this.pre.textContent = newContent;
        if (this.autoScroll) {
          this.pre.scrollTop = this.pre.scrollHeight;
        }
      }
    }

    // Stop polling when no longer running
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
}

// ─── Command Preview Modal ────────────────────────────────────────────────────

class CommandPreviewModal extends Modal {
  constructor(app: App, private taskName: string, private cmd: string) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: `Command: ${this.taskName}` });
    contentEl.createEl("p", {
      text: "This is the CLI command that will be executed:",
      cls: "setting-item-description",
    });
    const pre = contentEl.createEl("pre", { cls: "auto-oc-output-pre" });
    pre.textContent = this.cmd;

    new Setting(contentEl).addButton((btn) =>
      btn.setButtonText("Copy").onClick(() => {
        navigator.clipboard.writeText(this.cmd);
        new Notice("Command copied.");
      })
    );
  }

  onClose() {
    this.contentEl.empty();
  }
}

// ─── Diagnostic Modal ─────────────────────────────────────────────────────────

class DiagnosticModal extends Modal {
  private plugin: AutoOCPlugin;
  private logEl: HTMLPreElement | null = null;

  constructor(app: App, plugin: AutoOCPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "🔧 AutoOC Diagnostic" });
    contentEl.createEl("p", {
      text: "Test the opencode command directly from Obsidian.",
      cls: "setting-item-description",
    });

    const bin = resolveOpencodeBin(this.plugin.settings.opencodePath);
    contentEl.createEl("p", { text: `Detected binary: ${bin}`, cls: "setting-item-description" });
    contentEl.createEl("p", { text: `Default model: ${this.plugin.getEffectiveDefaultModel() || "(not configured)"}`, cls: "setting-item-description" });

    new Setting(contentEl).addButton((btn) =>
      btn.setButtonText("▶ Launch test: 'di hola'").setCta().onClick(() => {
        if (this.logEl) this.logEl.textContent = "[launching detached PowerShell process…]\n";
        const bin = resolveOpencodeBin(this.plugin.settings.opencodePath);
        const model = this.plugin.getEffectiveDefaultModel();
        if (!model) {
          new Notice("AutoOC: no model selected. Reload models in Settings.");
          return;
        }
        const fs   = require("fs");
        const path = require("path");
        const osTmp = require("os").tmpdir();
        const outFile = path.join(osTmp, "autooc-diag.txt");
        try { fs.unlinkSync(outFile); } catch { /* ignore */ }

        const psScript = [
          `$env:USERPROFILE = '${process.env.USERPROFILE}'`,
          `$env:APPDATA     = '${process.env.APPDATA}'`,
          `$env:LOCALAPPDATA= '${process.env.LOCALAPPDATA}'`,
          `$env:PATH        = '${process.env.PATH}'`,
          `$env:HOME        = '${process.env.USERPROFILE}'`,
          `$outTmp = [System.IO.Path]::GetTempFileName()`,
          `$errTmp = [System.IO.Path]::GetTempFileName()`,
          `$p = Start-Process -FilePath '${bin.replace(/'/g, "''")}' -ArgumentList 'run','di hola','-m','${model}','--dangerously-skip-permissions' -RedirectStandardOutput $outTmp -RedirectStandardError $errTmp -Wait -NoNewWindow -PassThru`,
          `$out = (Get-Content $outTmp -Raw -ErrorAction SilentlyContinue).Trim()`,
          `Remove-Item $outTmp,$errTmp -ErrorAction SilentlyContinue`,
          `[System.IO.File]::WriteAllText('${outFile.replace(/'/g, "''")}', $out + "\nDONE:" + $p.ExitCode)`,
        ].join("\n");

        const psFile = path.join(osTmp, "autooc-diag.ps1");
        fs.writeFileSync(psFile, psScript, "utf8");
        if (this.logEl) this.logEl.textContent += `Script: ${psFile}\n\n`;

        // Launch via wscript.exe VBScript — completely silent, no window
        launchHiddenPS(psFile);

        const poll = setInterval(() => {
          if (!fs.existsSync(outFile)) {
            if (this.logEl) this.logEl.textContent += ".";
            return;
          }
          clearInterval(poll);
          const raw = fs.readFileSync(outFile, "utf8");
          try { fs.unlinkSync(outFile); fs.unlinkSync(psFile); } catch { /* ignore */ }
          // Strip DONE sentinel, show clean output
          const doneMatch = raw.match(/\nDONE:(-?\d+)\s*$/);
          const output = doneMatch ? raw.slice(0, doneMatch.index).trim() : raw.trim();
          const normalized = normalizeCommandOutput(output);
          const exitCode = doneMatch ? parseInt(doneMatch[1], 10) : -1;
          if (this.logEl) {
            this.logEl.textContent = normalized || "(sin output)";
            this.logEl.textContent += exitCode === 0 ? "\n\n[\u2705 completado]" : `\n\n[\u274c c\u00f3digo ${exitCode}]`;
          }
        }, 2000);
      })
    );

    this.logEl = contentEl.createEl("pre", { cls: "auto-oc-output-pre auto-oc-log-pre" });
    this.logEl.textContent = "(aquí aparecerá el output…)";
  }

  onClose() { this.contentEl.empty(); }
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

class AutoOCSettingTab extends PluginSettingTab {
  private plugin: AutoOCPlugin;

  constructor(app: App, plugin: AutoOCPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "AutoOC — Settings" });

    new Setting(containerEl)
      .setName("OpenCode CLI Path")
      .setDesc(
        `Absolute path to executable. Empty = auto-detect.\nDetected now: ${resolveOpencodeBin(this.plugin.settings.opencodePath)}`
      )
      .addText((text) => {
        text
          .setPlaceholder("auto-detect")
          .setValue(this.plugin.settings.opencodePath)
          .onChange(async (v) => {
            this.plugin.settings.opencodePath = v.trim();
            await this.plugin.saveSettings();
          });
        return text;
      })
      .addButton((btn) =>
        btn.setButtonText("🔍 Auto-detect").onClick(async () => {
          // Search for opencode.cmd / opencode.exe in typical npm paths
          const { existsSync } = require("fs");
          const candidates = [
            `${process.env.APPDATA}\\npm\\opencode.cmd`,
            `${process.env.APPDATA}\\npm\\opencode`,
            `${process.env.LOCALAPPDATA}\\npm\\opencode.cmd`,
            `${process.env.ProgramFiles}\\nodejs\\opencode.cmd`,
          ].filter(Boolean);
          const found = candidates.find((c) => existsSync(c));
          if (found) {
            this.plugin.settings.opencodePath = found;
            await this.plugin.saveSettings();
            new Notice(`AutoOC: path configured → ${found}`);
            this.display(); // re-render to show new value
          } else {
            new Notice("AutoOC: opencode not found automatically. Enter the path manually.");
          }
        })
      );

    new Setting(containerEl)
      .setName("Working Directory")
      .setDesc(
        "Directory from which to launch OpenCode (empty = vault's current directory)"
      )
      .addText((text) =>
        text
          .setPlaceholder("C:\\Users\\GiJu236\\projects\\mi-proyecto")
          .setValue(this.plugin.settings.workingDirectory)
          .onChange(async (v) => {
            this.plugin.settings.workingDirectory = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Task Timeout (seconds)")
      .setDesc("If process doesn't finish in this time, it's automatically killed. Default 1800 s (30 min). Use 0 to disable timeout.")
      .addText((text) =>
        text
          .setPlaceholder("1800")
          .setValue(String(this.plugin.settings.taskTimeoutSeconds ?? 1800))
          .onChange(async (v) => {
            const n = parseInt(v, 10);
            if (!isNaN(n) && n >= 0) {
              this.plugin.settings.taskTimeoutSeconds = n;
              await this.plugin.saveSettings();
            }
          })
      );

    containerEl.createEl("h3", { text: "Ralph Loop" });
    containerEl.createEl("p", {
      text: "Enable opencode-ralph-loop in ~/.config/opencode/opencode.json to use auto-continuation with /ralph-loop.",
      cls: "setting-item-description",
    });
    containerEl.createEl("p", {
      text: `Current status: ${this.plugin.isRalphLoopEnabled() ? "enabled" : "not configured"}`,
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("Ralph Loop Assistant")
      .setDesc("Add opencode-ralph-loop to OpenCode configuration file")
      .addButton((btn) =>
        btn.setButtonText("Install / Activate").setCta().onClick(async () => {
          try {
            const result = await this.plugin.ensureRalphLoopPluginEnabled();
            new Notice(
              result.changed
                ? `AutoOC: Ralph Loop enabled at ${result.configPath}. Restart OpenCode.`
                : `AutoOC: Ralph Loop was already active at ${result.configPath}.`
            );
            this.display();
          } catch (e) {
            new Notice(`AutoOC: error enabling Ralph Loop: ${String(e)}`);
          }
        })
      )
      .addButton((btn) =>
        btn.setButtonText("Show status path").onClick(() => {
          const basePath = (this.app.vault.adapter as any).basePath || ".";
          const statePath = getRalphStateFilePath(basePath);
          new Notice(`Ralph state file: ${statePath}`);
        })
      );

    new Setting(containerEl)
      .setName("Default Model")
      .addDropdown((dd) => {
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
      text: "🔄 Reload Model List",
      cls: "auto-oc-btn-secondary",
    });
    refreshBtn.style.marginBottom = "8px";
    refreshBtn.onclick = () => {
      this.plugin.refreshModels();
      new Notice("AutoOC: models reloaded. Refresh this panel.");
      this.display();
    };
    containerEl.createEl("p", {
      text: `${this.plugin.availableModels.length} models loaded from \`opencode models\``,
      cls: "setting-item-description",
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
}
