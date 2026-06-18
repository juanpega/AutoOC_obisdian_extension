import {
  App,
  ItemView,
  MarkdownRenderer,
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

type ScheduleType = "manual" | "once" | "daily" | "weekly";
type TaskStatus = "pending" | "running" | "completed" | "failed";

interface ScheduledTask {
  id: string;
  name: string;
  prompt: string;
  model: string;
  agent: string;
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

type WorkflowStatus = "pending" | "running" | "completed" | "failed";

interface WorkflowStep {
  taskId: string;
  transitionMode?: "default" | "force" | "eval";
  evaluatePrompt?: string;   // Prompt to evaluate whether to continue to next step
  forceContinue?: boolean;   // Skip evaluation, always continue
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  status: WorkflowStatus;
  currentStep: number;       // Index of step being executed (or last completed)
  createdAt: string;
  lastRun?: string;
  handoffBranch?: boolean;   // Pass git branch from one task to the next
  handoffOutput?: boolean;   // Pass previous task output as context to next task
  scheduleType: ScheduleType;
  scheduleTime: string;
  scheduleDate: string;
  scheduleDays: number[];
}

interface AutoOCSettings {
  tasks: ScheduledTask[];
  workflows: Workflow[];
  opencodePath: string;
  defaultModel: string;
  defaultAgent: string;
  workingDirectory: string;
  cmdTemplate: string;
  taskTimeoutSeconds: number;
  logsEnabled: boolean;
  maxLogsPerTask: number;
  logRetentionDays: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// No hardcoded models: load dynamically with `opencode models`.
const FALLBACK_MODELS: { value: string; label: string }[] = [];
const FALLBACK_AGENTS: { value: string; label: string }[] = [
  { value: "build", label: "build" },
  { value: "plan", label: "plan" },
];

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

function isValidAgentName(name: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(name);
}

function listGitBranches(cwd: string): string[] {
  const { execFileSync } = require("child_process");
  const out = execFileSync("git", ["branch", "--format=%(refname:short)"], {
    cwd,
    timeout: 8000,
    encoding: "utf8",
    windowsHide: true,
  });
  return out
    .split("\n")
    .map((b: string) => b.trim())
    .filter(Boolean);
}

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

function fetchAgentsSync(opencodePath: string, cwd?: string): { value: string; label: string }[] {
  const { execSync } = require("child_process");
  const bin = resolveOpencodeBin(opencodePath);
  try {
    const out = execSync(`"${bin}" agent list`, {
      timeout: 8000,
      encoding: "utf8",
      cwd: cwd || undefined,
      windowsHide: true,
    });
    const agents = stripAnsi(out)
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^\S+\s+\(primary\)/.test(l))
      .map((l) => {
        const name = l.match(/^(\S+)\s+\(/)?.[1] ?? l.split(" ")[0];
        return { value: name, label: name };
      })
      .filter((a) => isValidAgentName(a.value));
    return agents.length > 0 ? agents : FALLBACK_AGENTS;
  } catch {
    return FALLBACK_AGENTS;
  }
}

const DEFAULT_SETTINGS: AutoOCSettings = {
  tasks: [],
  workflows: [],
  opencodePath: "opencode",
  defaultModel: "",
  defaultAgent: "build",
  workingDirectory: "",
  // {opencode} = binary path, {model} = provider/model, {prompt} = escaped prompt
  cmdTemplate: '{opencode} run --model {model} -- "{prompt}"',
  taskTimeoutSeconds: 1800,  // 30 min por defecto
  logsEnabled: true,
  maxLogsPerTask: 50,
  logRetentionDays: 30,
};

export const VIEW_TYPE = "auto-oc-view";
const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const INITIAL_DUE_CHECK_DELAY_MS = 30_000;
const DUE_LAUNCH_GAP_MS = 10_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function preventBackdropClose(modal: Modal): void {
  const contentEl = modal.contentEl;
  const modalContainer = contentEl.parentElement;
  if (modalContainer) {
    const modalBg = modalContainer.querySelector(".modal-bg") as HTMLElement;
    if (modalBg) {
      modalBg.addEventListener("click", (e) => {
        e.stopImmediatePropagation();
        e.preventDefault();
      }, true);
    }
  }
}

function setupModalX(modal: Modal): void {
  preventBackdropClose(modal);
}

function setAutoOCModalSize(modal: Modal, widthPx: number): void {
  const modalEl = (modal as any).modalEl as HTMLElement | undefined;
  if (modalEl) {
    modalEl.style.width = `min(${widthPx}px, calc(100vw - 72px))`;
    modalEl.style.maxWidth = "calc(100vw - 72px)";
    modalEl.style.maxHeight = "calc(100vh - 72px)";
    modalEl.style.overflow = "hidden";
  }

  modal.contentEl.style.width = "100%";
  modal.contentEl.style.maxWidth = "100%";
  modal.contentEl.style.overflowX = "hidden";
  modal.contentEl.style.overflowY = "auto";
}

// ─── Update / Version Check ───────────────────────────────────────────────────

const GITHUB_REPO = "juanpega/AutoOC_obisdian_extension";
const GITHUB_BRANCH = "main";
const REMOTE_MANIFEST_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/manifest.json`;
const REMOTE_FILE_URLS = {
  mainJs: `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/main.js`,
  manifest: `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/manifest.json`,
  styles: `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/styles.css`,
};

function noCacheUrl(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
}

function compareVersions(a: string, b: string): number {
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

function formatLogContent(text: string): string {
  if (!text) return "";
  return normalizeCommandOutput(text).replace(/\r\n/g, "\n");
}

function countReplacementChars(text: string): number {
  return (text.match(/�/g) || []).length;
}

function decodeCp850(bytes: Buffer): string {
  const map: Record<number, string> = {
    0x80: "Ç", 0x81: "ü", 0x82: "é", 0x83: "â", 0x84: "ä", 0x85: "à", 0x86: "å", 0x87: "ç",
    0x88: "ê", 0x89: "ë", 0x8a: "è", 0x8b: "ï", 0x8c: "î", 0x8d: "ì", 0x8e: "Ä", 0x8f: "Å",
    0x90: "É", 0x91: "æ", 0x92: "Æ", 0x93: "ô", 0x94: "ö", 0x95: "ò", 0x96: "û", 0x97: "ù",
    0x98: "ÿ", 0x99: "Ö", 0x9a: "Ü", 0x9b: "ø", 0x9c: "£", 0x9d: "Ø", 0x9e: "×", 0x9f: "ƒ",
    0xa0: "á", 0xa1: "í", 0xa2: "ó", 0xa3: "ú", 0xa4: "ñ", 0xa5: "Ñ", 0xa6: "ª", 0xa7: "º",
    0xa8: "¿", 0xa9: "®", 0xaa: "¬", 0xab: "½", 0xac: "¼", 0xad: "¡", 0xae: "«", 0xaf: "»",
  };
  let out = "";
  for (const byte of bytes) {
    if (byte < 0x80) out += String.fromCharCode(byte);
    else out += map[byte] ?? String.fromCharCode(byte);
  }
  return out;
}

function decodeWindows1252(bytes: Buffer): string {
  const map: Record<number, string> = {
    0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡",
    0x88: "ˆ", 0x89: "‰", 0x8a: "Š", 0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž",
    0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—",
    0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›", 0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
  };
  let out = "";
  for (const byte of bytes) {
    if (byte < 0x80 || byte >= 0xa0) out += String.fromCharCode(byte);
    else out += map[byte] ?? "";
  }
  return out;
}

function decodeCommandBuffer(bytes: Buffer): string {
  const utf8 = bytes.toString("utf8");
  if (countReplacementChars(utf8) === 0) return utf8;
  const win1252 = decodeWindows1252(bytes);
  const cp850 = decodeCp850(bytes);
  return countReplacementChars(win1252) <= countReplacementChars(cp850) ? win1252 : cp850;
}

function getOpencodeConfigPath(): string {
  return path.join(os.homedir(), ".config", "opencode", "opencode.json");
}

function getRalphStateFilePath(vaultBasePath: string): string {
  return path.join(vaultBasePath, ".opencode", "ralph-loop.local.md");
}

// ─── Log File Helpers ────────────────────────────────────────────────────────

function getTaskLogDir(vaultBasePath: string, taskId: string): string {
  return path.join(vaultBasePath, ".opencode", "logs", taskId);
}

function formatTimestampForLog(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

function formatLogFilenameTimestamp(fileName: string): string {
  const match = fileName.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.log$/);
  if (!match) return fileName.replace(/\.log$/, "");
  const [, year, month, day, hour, minute, second] = match;
  return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
}

function saveLogToFile(vaultBasePath: string, taskId: string, output: string): string | null {
  if (!output || !output.trim()) return null;
  const logDir = getTaskLogDir(vaultBasePath, taskId);
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch { /* ignore */ }
  const timestamp = formatTimestampForLog();
  const logFile = path.join(logDir, `${timestamp}.log`);
  try {
    fs.writeFileSync(logFile, output, "utf8");
    // Update latest.log
    const latestFile = path.join(logDir, "latest.log");
    fs.writeFileSync(latestFile, output, "utf8");
    return logFile;
  } catch {
    return null;
  }
}

function getLogHistory(vaultBasePath: string, taskId: string): { file: string; timestamp: string }[] {
  const logDir = getTaskLogDir(vaultBasePath, taskId);
  try {
    if (!fs.existsSync(logDir)) return [];
    const files = fs.readdirSync(logDir)
      .filter((f: string) => f.endsWith(".log") && f !== "latest.log")
      .sort()
      .reverse();
    return files.map((f: string) => ({
      file: path.join(logDir, f),
      timestamp: formatLogFilenameTimestamp(f),
    }));
  } catch {
    return [];
  }
}

function readLogFile(filePath: string): string {
  try {
    return formatLogContent(fs.readFileSync(filePath, "utf8"));
  } catch {
    return "(error reading log file)";
  }
}

function cleanupOldLogs(vaultBasePath: string, taskId: string, maxLogs: number): void {
  if (maxLogs <= 0) return;
  const logDir = getTaskLogDir(vaultBasePath, taskId);
  try {
    if (!fs.existsSync(logDir)) return;
    const files = fs.readdirSync(logDir)
      .filter((f: string) => f.endsWith(".log") && f !== "latest.log")
      .sort();
    while (files.length > maxLogs) {
      const oldFile = files.shift();
      if (oldFile) {
        try { fs.unlinkSync(path.join(logDir, oldFile)); } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
}

function cleanupLogsByAge(vaultBasePath: string, taskId: string, retentionDays: number): void {
  if (retentionDays <= 0) return;
  const logDir = getTaskLogDir(vaultBasePath, taskId);
  try {
    if (!fs.existsSync(logDir)) return;
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(logDir)
      .filter((f: string) => f.endsWith(".log") && f !== "latest.log");
    for (const f of files) {
      // Parse timestamp from filename: 2026-06-13_14-30-00.log
      const match = f.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.log$/);
      if (match) {
        const [, y, m, d, h, min, s] = match;
        const fileDate = new Date(`${y}-${m}-${d}T${h}:${min}:${s}`);
        if (fileDate.getTime() < cutoff) {
          try { fs.unlinkSync(path.join(logDir, f)); } catch { /* ignore */ }
        }
      }
    }
  } catch { /* ignore */ }
}

function clearTaskLogs(vaultBasePath: string, taskId: string): void {
  const logDir = getTaskLogDir(vaultBasePath, taskId);
  try {
    if (!fs.existsSync(logDir)) return;
    const files = fs.readdirSync(logDir);
    for (const f of files) {
      try { fs.unlinkSync(path.join(logDir, f)); } catch { /* ignore */ }
    }
    try { fs.rmdirSync(logDir); } catch { /* ignore */ }
  } catch { /* ignore */ }
}

function clearAllLogs(vaultBasePath: string): void {
  const logsDir = path.join(vaultBasePath, ".opencode", "logs");
  try {
    if (!fs.existsSync(logsDir)) return;
    const dirs = fs.readdirSync(logsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    for (const dir of dirs) {
      clearTaskLogs(vaultBasePath, dir);
    }
    try { fs.rmdirSync(logsDir); } catch { /* ignore */ }
  } catch { /* ignore */ }
}

function deleteSingleLogFile(filePath: string): void {
  try { fs.unlinkSync(filePath); } catch { /* ignore */ }
}

function isTaskDue(task: ScheduledTask): boolean {
  if (task.status === "running") return false;
  if (task.scheduleType === "manual") return false;

  const now = new Date();
  const [hh, mm] = task.scheduleTime.split(":").map(Number);

  if (task.scheduleType === "once") {
    if (task.status !== "pending") return false;
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

function isWorkflowDue(wf: Workflow): boolean {
  if (wf.status === "running") return false;
  if (wf.steps.length === 0) return false;
  if (wf.scheduleType === "manual") return false;

  const now = new Date();
  const [hh, mm] = (wf.scheduleTime || "00:00").split(":").map(Number);

  if (wf.scheduleType === "once") {
    if (wf.status !== "pending") return false;
    const target = new Date(`${wf.scheduleDate || ""}T${wf.scheduleTime || "00:00"}:00`);
    return now >= target;
  }

  if (wf.scheduleType === "daily") {
    const todayTarget = new Date();
    todayTarget.setHours(hh, mm, 0, 0);
    if (now < todayTarget) return false;
    if (!wf.lastRun) return true;
    return new Date(wf.lastRun).toDateString() !== now.toDateString();
  }

  if (wf.scheduleType === "weekly") {
    const days = wf.scheduleDays || [];
    if (!days.includes(now.getDay())) return false;
    const todayTarget = new Date();
    todayTarget.setHours(hh, mm, 0, 0);
    if (now < todayTarget) return false;
    if (!wf.lastRun) return true;
    return new Date(wf.lastRun).toDateString() !== now.toDateString();
  }

  return false;
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default class AutoOCPlugin extends Plugin {
  settings!: AutoOCSettings;
  view?: AutoOCView;
  availableModels: { value: string; label: string }[] = FALLBACK_MODELS;
  availableAgents: { value: string; label: string }[] = FALLBACK_AGENTS;
  // Map taskId -> child process, so we can kill running tasks
  private runningProcesses = new Map<string, ReturnType<typeof spawn>>();
  private dueCheckInProgress = false;

  // Update-check state
  latestVersion: string | null = null;
  updateAvailable = false;
  updateCheckError: string | null = null;
  updateInProgress = false;

  async onload() {
    await this.loadSettings();
    // Load models asynchronously to avoid blocking startup
    setTimeout(() => {
      this.refreshModels();
      this.refreshAgents();
    }, 2000);

    this.registerView(VIEW_TYPE, (leaf) => {
      this.view = new AutoOCView(leaf, this);
      return this.view;
    });

    this.addRibbonIcon("workflow", "AutoOC — Task Scheduler", () => {
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
        await this.runDueAll();
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
      window.setInterval(() => this.runDueAll(), 60_000)
    );

    // Initial check only after Obsidian has restored its layout, plus an extra
    // margin so other plugins and the Electron environment settle before launch.
    this.app.workspace.onLayoutReady(() => {
      const startupTimer = window.setTimeout(() => this.runDueAll(), INITIAL_DUE_CHECK_DELAY_MS);
      this.register(() => window.clearTimeout(startupTimer));
    });

    // Check for plugin updates in the background
    setTimeout(() => this.checkForUpdates(true), 3_000);
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

  getAgentsForDirectory(cwd?: string): { value: string; label: string }[] {
    return fetchAgentsSync(this.settings.opencodePath || "opencode", cwd);
  }

  refreshAgents(cwd?: string): void {
    const agents = this.getAgentsForDirectory(cwd);
    if (agents.length > 0) {
      this.availableAgents = agents;
      if (!this.settings.defaultAgent || !agents.find((a) => a.value === this.settings.defaultAgent)) {
        this.settings.defaultAgent = agents[0].value;
        void this.saveSettings();
      }
      this.view?.refresh();
    }
  }

  getEffectiveAgent(agent?: string): string {
    const requested = agent || this.settings.defaultAgent;
    if (requested && this.availableAgents.find((a) => a.value === requested)) return requested;
    if (this.settings.defaultAgent && this.availableAgents.find((a) => a.value === this.settings.defaultAgent)) return this.settings.defaultAgent;
    return this.availableAgents[0]?.value || "build";
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
    // Stale workflow cleanup + migration for missing schedule fields
    if (!this.settings.workflows) this.settings.workflows = [];
    for (const wf of this.settings.workflows) {
      if (wf.status === "running") {
        wf.status = "failed";
        changed = true;
      }
      // Migrate workflows without schedule fields
      if (!wf.scheduleType) {
        wf.scheduleType = "once";
        wf.scheduleTime = "00:00";
        wf.scheduleDate = "";
        wf.scheduleDays = [];
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

  // ── Version / update helpers ────────────────────────────────────────────────

  async checkForUpdates(silent = false): Promise<void> {
    try {
      this.updateCheckError = null;
      const res = await fetch(noCacheUrl(REMOTE_MANIFEST_URL), { cache: "reload" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const remoteVersion = data?.version;
      if (!remoteVersion || typeof remoteVersion !== "string") {
        throw new Error("Remote manifest has no version");
      }
      this.latestVersion = remoteVersion;
      this.updateAvailable = compareVersions(remoteVersion, this.manifest.version) > 0;
      this.view?.refresh();
      if (!silent) {
        new Notice(
          this.updateAvailable
            ? `AutoOC: update available v${remoteVersion}.`
            : `AutoOC: already up to date (v${this.manifest.version}).`
        );
      }
    } catch (e) {
      this.updateCheckError = String(e);
      this.view?.refresh();
      if (!silent) new Notice(`AutoOC: update check failed — ${String(e)}`);
    }
  }

  async updatePlugin(): Promise<void> {
    if (this.updateInProgress) return;
    if (!this.latestVersion) return;

    const shouldUpdate = confirm(
      `AutoOC will download v${this.latestVersion} and try to reload the plugin automatically.\n\n` +
      `If Obsidian cannot reload it automatically, you will need to run: Ctrl+Shift+P → Reload app without saving.\n\n` +
      `Continue?`
    );
    if (!shouldUpdate) return;

    this.updateInProgress = true;
    this.view?.refresh();
    new Notice("AutoOC: downloading update…");

    try {
      const [mainJs, manifest, styles] = await Promise.all([
        fetch(noCacheUrl(REMOTE_FILE_URLS.mainJs), { cache: "reload" }).then((r) => {
          if (!r.ok) throw new Error(`main.js HTTP ${r.status}`);
          return r.text();
        }),
        fetch(noCacheUrl(REMOTE_FILE_URLS.manifest), { cache: "reload" }).then((r) => {
          if (!r.ok) throw new Error(`manifest.json HTTP ${r.status}`);
          return r.text();
        }),
        fetch(noCacheUrl(REMOTE_FILE_URLS.styles), { cache: "reload" }).then((r) => {
          if (!r.ok) throw new Error(`styles.css HTTP ${r.status}`);
          return r.text();
        }),
      ]);

      const pluginDir = `.obsidian/plugins/${this.manifest.id}`;
      await this.app.vault.adapter.write(`${pluginDir}/main.js`, mainJs);
      await this.app.vault.adapter.write(`${pluginDir}/manifest.json`, manifest);
      await this.app.vault.adapter.write(`${pluginDir}/styles.css`, styles);

      new Notice(`AutoOC: updated to v${this.latestVersion}. Reloading plugin…`);

      // Try to reload without restarting Obsidian
      try {
        // @ts-ignore — internal Obsidian API
        await this.app.plugins.disablePlugin(this.manifest.id);
        // @ts-ignore — internal Obsidian API
        await this.app.plugins.enablePlugin(this.manifest.id);
        new Notice("AutoOC: plugin reloaded.");
      } catch {
        new Notice("AutoOC: update saved. Restart Obsidian to finish.");
      }
    } catch (e) {
      new Notice(`AutoOC: update failed — ${String(e)}`);
    } finally {
      this.updateInProgress = false;
      this.view?.refresh();
    }
  }

  // Keep CLI options before "--" so prompt text cannot be parsed as opencode flags.
  buildArgs(task: ScheduledTask): string[] {
    let prompt = task.prompt;
    if (task.useRalphLoop) {
      prompt = `/ralph-loop ${prompt}`;
    }
    const bin = resolveOpencodeBin(this.settings.opencodePath);
    const agent = this.getEffectiveAgent(task.agent);
    // --dangerously-skip-permissions prevents opencode from blocking on tool-approval prompts
    return [bin, "run", "-m", task.model, "--agent", agent, "--dangerously-skip-permissions", "--", prompt];
  }

  // Human-readable command string for the preview modal
  buildCommand(task: ScheduledTask): string {
    const args = this.buildArgs(task);
    return args.join(" ");
  }

  // Quick evaluation via same detached PS + polling mechanism. Used for workflow
  // transition validation prompts.
  async evaluateWithOpencode(prompt: string, model: string, cwd: string): Promise<{ output: string; exitCode: number }> {
    return new Promise((resolve) => {
      const fs = require("fs");
      const path = require("path");
      const tmpDir = require("os").tmpdir();
      const evalId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const outFile = path.join(tmpDir, `autooc-eval-${evalId}.txt`);
      const bin = resolveOpencodeBin(this.settings.opencodePath);
      const agent = this.getEffectiveAgent();
      const safePrompt = prompt.replace(/"/g, '\\"').replace(/'/g, "''");
      const safeCwd = cwd.replace(/'/g, "''");

      const psScript = [
        `$env:USERPROFILE = '${process.env.USERPROFILE}'`,
        `$env:APPDATA     = '${process.env.APPDATA}'`,
        `$env:LOCALAPPDATA= '${process.env.LOCALAPPDATA}'`,
        `$env:PATH        = '${process.env.PATH}'`,
        `$env:HOME        = '${process.env.USERPROFILE}'`,
        `Set-Location -LiteralPath '${safeCwd}'`,
        `$outTmp = [System.IO.Path]::GetTempFileName()`,
        `$errTmp = [System.IO.Path]::GetTempFileName()`,
        `$p = Start-Process -FilePath '${bin.replace(/'/g, "''")}' -ArgumentList 'run','-m','${model}','--agent','${agent}','--dangerously-skip-permissions','--','${safePrompt}' -RedirectStandardOutput $outTmp -RedirectStandardError $errTmp -Wait -NoNewWindow -PassThru`,
        `$stdout = Get-Content $outTmp -Raw -ErrorAction SilentlyContinue`,
        `$stderr = Get-Content $errTmp -Raw -ErrorAction SilentlyContinue`,
        `Remove-Item $outTmp,$errTmp -ErrorAction SilentlyContinue`,
        `$combined = ($stdout + $(if($stderr){"\n" + $stderr}else{""})).Trim()`,
        `[System.IO.File]::WriteAllText('${outFile.replace(/'/g, "''")}', "\nDONE:" + $p.ExitCode + "\n" + $combined)`,
      ].join("\n");

      const psFile = path.join(tmpDir, `autooc-eval-${evalId}.ps1`);
      fs.writeFileSync(psFile, psScript, "utf8");
      launchHiddenPS(psFile);

      const startedAt = Date.now();
      const poll = setInterval(() => {
        if (Date.now() - startedAt > 180000) { // 3 min timeout
          clearInterval(poll);
          try { fs.unlinkSync(psFile); } catch { /* ignore */ }
          resolve({ output: "evaluation timeout", exitCode: -1 });
          return;
        }
        if (!fs.existsSync(outFile)) return;
        clearInterval(poll);
        try { fs.unlinkSync(psFile); } catch { /* ignore */ }
        const raw = fs.readFileSync(outFile, "utf8");
        try { fs.unlinkSync(outFile); } catch { /* ignore */ }
        const doneMatch = raw.match(/^[\s\S]*?\nDONE:(-?\d+)\n([\s\S]*)$/m);
        const exitCode = doneMatch ? parseInt(doneMatch[1], 10) : -1;
        const output = doneMatch ? doneMatch[2].trim() : raw.trim();
        resolve({ output: normalizeCommandOutput(output), exitCode });
      }, 2000);
    });
  }

  // Runs opencode via a fully-detached PowerShell process to avoid Electron's
  // restricted environment killing the child. Output is written to a temp file
  // that the plugin polls every 3 s.
  async runTask(
    task: ScheduledTask,
    onComplete?: (task: ScheduledTask, exitCode: number) => Promise<void>,
    overrides: Partial<Pick<ScheduledTask, "prompt" | "branch" | "createBranch">> = {},
  ) {
    const idx = this.settings.tasks.findIndex((t) => t.id === task.id);
    if (idx === -1) return;
    const effectiveTask: ScheduledTask = { ...this.settings.tasks[idx], ...overrides };

    if (!effectiveTask.prompt?.trim()) {
      this.settings.tasks[idx].status = "failed";
      this.settings.tasks[idx].lastRun = new Date().toISOString();
      this.settings.tasks[idx].output = "[AutoOC] Task not launched: prompt is empty.";
      await this.saveSettings();
      new Notice(`AutoOC: "${task.name}" has an empty prompt.`);
      if (onComplete) await onComplete(this.settings.tasks[idx], -1);
      return;
    }

    if (!effectiveTask.model?.trim()) {
      this.settings.tasks[idx].status = "failed";
      this.settings.tasks[idx].lastRun = new Date().toISOString();
      this.settings.tasks[idx].output = "[AutoOC] Task not launched: model is empty.";
      await this.saveSettings();
      new Notice(`AutoOC: "${task.name}" has no model selected.`);
      if (onComplete) await onComplete(this.settings.tasks[idx], -1);
      return;
    }

    const vaultBasePath = (this.app.vault.adapter as any).basePath || ".";

    this.settings.tasks[idx].status = "running";
    this.settings.tasks[idx].lastRun = new Date().toISOString();
    this.settings.tasks[idx].output = "[iniciando proceso desacoplado…]\n";
    await this.saveSettings();

    new Notice(`AutoOC: running "${task.name}"…`);

    const args = this.buildArgs(effectiveTask);
    const bin = args[0]; // opencode.cmd full path
    let prompt = effectiveTask.prompt;
    if (effectiveTask.useRalphLoop) {
      prompt = `/ralph-loop ${prompt}`;
    }
    const model = effectiveTask.model;
    const preparedPrompt = prompt.trim();

    const tmpDir = require("os").tmpdir();
    const outFile = require("path").join(tmpDir, `autooc-${task.id}.txt`);
    const errFile = require("path").join(tmpDir, `autooc-${task.id}.err.txt`);
    const doneFile = require("path").join(tmpDir, `autooc-${task.id}.done.txt`);
    const pidFile = require("path").join(tmpDir, `autooc-${task.id}.pid`);
    const promptFile = require("path").join(tmpDir, `autooc-${task.id}.prompt.txt`);
    const fs = require("fs");

    // Clean up any previous temp files
    try { fs.unlinkSync(outFile); } catch { /* ignore */ }
    try { fs.unlinkSync(errFile); } catch { /* ignore */ }
    try { fs.unlinkSync(doneFile); } catch { /* ignore */ }
    try { fs.unlinkSync(pidFile); } catch { /* ignore */ }
    try { fs.unlinkSync(promptFile); } catch { /* ignore */ }
    fs.writeFileSync(promptFile, preparedPrompt, "utf8");

    // PS script: Start-Process in ONE line (multi-line breaks PS argument parsing)
    // Resolve working directory: Task override -> Global Setting -> Vault Path
    const taskCwd = effectiveTask.workingDirectory || this.settings.workingDirectory || ((this.app.vault.adapter as any).basePath || ".");
    const safeCwd = taskCwd.replace(/'/g, "''");

    // Git branch logic
    let gitCmds = "";
    if (effectiveTask.branch) {
      const safeBranch = effectiveTask.branch.replace(/'/g, "''");
      if (effectiveTask.createBranch) {
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
      `$prompt = Get-Content '${promptFile.replace(/'/g, "''")}' -Raw`,
      `$bin = '${bin.replace(/'/g, "''")}'`,
      `$argList = @('run','-m','${model.replace(/'/g, "''")}','--agent','${this.getEffectiveAgent(effectiveTask.agent).replace(/'/g, "''")}','--dangerously-skip-permissions','--',$prompt)`,
      `$p = Start-Process -FilePath $bin -ArgumentList $argList -RedirectStandardOutput '${outFile.replace(/'/g, "''")}' -RedirectStandardError '${errFile.replace(/'/g, "''")}' -Wait -NoNewWindow -PassThru`,
      `[System.IO.File]::WriteAllText('${doneFile.replace(/'/g, "''")}', [string]$p.ExitCode, [System.Text.Encoding]::UTF8)`,
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
        try { fs.unlinkSync(outFile); } catch { /* ignore */ }
        try { fs.unlinkSync(errFile); } catch { /* ignore */ }
        try { fs.unlinkSync(doneFile); } catch { /* ignore */ }
        try { fs.unlinkSync(promptFile); } catch { /* ignore */ }
        t.output += `\n[⏱ timeout: ${timeoutSeconds}s superados]`;
        t.status = "failed";
        if (this.settings.logsEnabled) {
          saveLogToFile(vaultBasePath, task.id, t.output);
          cleanupOldLogs(vaultBasePath, task.id, this.settings.maxLogsPerTask);
          cleanupLogsByAge(vaultBasePath, task.id, this.settings.logRetentionDays);
        }
        await this.saveSettings();
        new Notice(`AutoOC: ⏱ "${task.name}" superó el timeout.`);
        if (onComplete) {
          await onComplete(t, -1);
        }
        return;
      }

      if (!fs.existsSync(doneFile)) {
        // Still running — heartbeat dot
        t.output += ".";
        await this.saveSettings();
        return;
      }

      // File exists — read result
      clearInterval(pollHandle);
      this.runningProcesses.delete(task.id);
      try { fs.unlinkSync(psScriptFile); } catch { /* ignore */ }
      try { fs.unlinkSync(promptFile); } catch { /* ignore */ }

      const stdout = fs.existsSync(outFile) ? decodeCommandBuffer(fs.readFileSync(outFile)) : "";
      const stderr = fs.existsSync(errFile) ? decodeCommandBuffer(fs.readFileSync(errFile)) : "";
      const exitCodeRaw = fs.readFileSync(doneFile, "utf8").trim();
      try { fs.unlinkSync(outFile); } catch { /* ignore */ }
      try { fs.unlinkSync(errFile); } catch { /* ignore */ }
      try { fs.unlinkSync(doneFile); } catch { /* ignore */ }

      const exitCode = /^-?\d+$/.test(exitCodeRaw) ? parseInt(exitCodeRaw, 10) : -1;
      const output = (stdout + (stderr.trim() ? `\n[stderr]\n${stderr}` : "")).trim();
      const normalized = normalizeCommandOutput(output);

      t.output = normalized || "(sin output)";
      if (exitCode !== 0) {
        t.status = "failed";
        t.output += `\n[código de salida: ${exitCode}]`;
        new Notice(`AutoOC: ❌ "${task.name}" falló (código ${exitCode}).`);
      } else {
        t.status = task.scheduleType === "daily" || task.scheduleType === "weekly" ? "pending" : "completed";
        new Notice(`AutoOC: ✅ "${task.name}" completada.`);
      }
      if (this.settings.logsEnabled) {
        saveLogToFile(vaultBasePath, task.id, t.output);
        cleanupOldLogs(vaultBasePath, task.id, this.settings.maxLogsPerTask);
        cleanupLogsByAge(vaultBasePath, task.id, this.settings.logRetentionDays);
      }
      await this.saveSettings();

      if (onComplete) {
        await onComplete(t, exitCode);
      }
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
      if (this.settings.logsEnabled) {
        const vaultBasePath = (this.app.vault.adapter as any).basePath || ".";
        saveLogToFile(vaultBasePath, id, t.output);
        cleanupOldLogs(vaultBasePath, id, this.settings.maxLogsPerTask);
        cleanupLogsByAge(vaultBasePath, id, this.settings.logRetentionDays);
      }
      await this.saveSettings();
    }
    new Notice(`AutoOC: ⏹ Task stopped.`);
  }

  async runDueAll() {
    if (this.dueCheckInProgress) return;
    this.dueCheckInProgress = true;
    try {
      await this.runDueTasks();
      await this.runDueWorkflows();
    } finally {
      this.dueCheckInProgress = false;
    }
  }

  async runDueTasks() {
    const dueTasks = this.settings.tasks.filter((task) => isTaskDue(task));
    for (let i = 0; i < dueTasks.length; i++) {
      await this.runTask(dueTasks[i]);
      if (i < dueTasks.length - 1) await delay(DUE_LAUNCH_GAP_MS);
    }
  }

  async runDueWorkflows() {
    const dueWorkflows = this.settings.workflows.filter((wf) => isWorkflowDue(wf));
    for (let i = 0; i < dueWorkflows.length; i++) {
      await this.runWorkflow(dueWorkflows[i]);
      if (i < dueWorkflows.length - 1) await delay(DUE_LAUNCH_GAP_MS);
    }
  }

  async deleteTask(id: string) {
    this.settings.tasks = this.settings.tasks.filter((t) => t.id !== id);
    await this.saveSettings();
  }

  async duplicateTask(task: ScheduledTask) {
    const copy: ScheduledTask = {
      ...task,
      id: generateId(),
      name: `${task.name} (copy)`,
      status: "pending",
      lastRun: "",
      output: "",
      createdAt: new Date().toISOString(),
    };
    this.settings.tasks.push(copy);
    await this.saveSettings();
    new Notice(`Task "${copy.name}" duplicated.`);
  }

  async clearTaskLogs(id: string) {
    const vaultBasePath = (this.app.vault.adapter as any).basePath || ".";
    clearTaskLogs(vaultBasePath, id);
    new Notice("Logs cleared for this task.");
  }

  async clearAllLogs() {
    const vaultBasePath = (this.app.vault.adapter as any).basePath || ".";
    clearAllLogs(vaultBasePath);
    new Notice("All logs cleared.");
  }

  async deleteWorkflow(id: string) {
    this.settings.workflows = this.settings.workflows.filter((w) => w.id !== id);
    await this.saveSettings();
  }

  async duplicateWorkflow(workflow: Workflow) {
    const copy: Workflow = {
      ...workflow,
      id: generateId(),
      name: `${workflow.name} (copy)`,
      steps: workflow.steps.map((step) => ({ ...step })),
      status: "pending",
      currentStep: -1,
      createdAt: new Date().toISOString(),
      lastRun: undefined,
    };
    this.settings.workflows.push(copy);
    await this.saveSettings();
    new Notice(`Workflow "${copy.name}" duplicated.`);
  }

  async runWorkflow(workflow: Workflow) {
    const idx = this.settings.workflows.findIndex((w) => w.id === workflow.id);
    if (idx === -1) return;
    const wf = this.settings.workflows[idx];

    if (wf.steps.length === 0) {
      new Notice(`AutoOC: Workflow "${wf.name}" has no steps.`);
      return;
    }

    // Validate all tasks exist
    for (let i = 0; i < wf.steps.length; i++) {
      const step = wf.steps[i];
      const t = this.settings.tasks.find((t) => t.id === step.taskId);
      if (!t) {
        new Notice(`AutoOC: Workflow "${wf.name}" — step ${i + 1} references a deleted task.`);
        return;
      }
    }

    wf.status = "running";
    wf.currentStep = 0;
    wf.lastRun = new Date().toISOString();
    await this.saveSettings();
    new Notice(`AutoOC: ⚡ Starting workflow "${wf.name}" (${wf.steps.length} steps)...`);

    await this.runWorkflowStep(idx, 0);
  }

  async runWorkflowStep(wfIdx: number, stepIndex: number) {
    const wf = this.settings.workflows[wfIdx];
    if (!wf || wf.status !== "running") return;

    const step = wf.steps[stepIndex];
    const taskIdx = this.settings.tasks.findIndex((t) => t.id === step.taskId);
    if (taskIdx === -1) {
      wf.status = "failed";
      new Notice(`AutoOC: Workflow "${wf.name}" failed — task not found at step ${stepIndex + 1}.`);
      await this.saveSettings();
      return;
    }

    const task = this.settings.tasks[taskIdx];
    const taskOverrides: Partial<Pick<ScheduledTask, "prompt" | "branch" | "createBranch">> = {};

    // Apply handoff from previous step
    if (stepIndex > 0) {
      const prevStep = wf.steps[stepIndex - 1];
      const prevTaskIdx = this.settings.tasks.findIndex((t) => t.id === prevStep.taskId);
      if (prevTaskIdx !== -1) {
        const prevTask = this.settings.tasks[prevTaskIdx];

        if (wf.handoffBranch && prevTask.branch) {
          taskOverrides.branch = prevTask.branch;
          taskOverrides.createBranch = false;
        }

        // handoffOutput defaults to true for backwards compatibility (undefined = true)
        const handoffEnabled = wf.handoffOutput !== false;
        if (handoffEnabled && prevTask.output && prevTask.output.trim()) {
          // Strip AutoOC markers and stderr noise so the AI only sees real output
          const cleanOutput = prevTask.output
            .replace(/\[código de salida:.*?\]/g, "")
            .replace(/\[iniciando proceso desacoplado…\]/g, "")
            .replace(/\[Workflow evaluation[^\]]*?\].*?(?=\n|$)/g, "")
            .replace(/\[Workflow (failed|stopped)[^\]]*?\]/g, "")
            .replace(/\n\[stderr\][\s\S]*?(?=\n\[|$)/g, "")
            .replace(/\.{3,}/g, "")  // heartbeat dots
            .replace(/\n{3,}/g, "\n\n")
            .trim();
          const contextBlock = `\n\n--- Context from previous task: "${prevTask.name}" ---\n${cleanOutput.slice(0, 2000)}\n--- End of context ---`;
          taskOverrides.prompt = `${task.prompt}${contextBlock}`;
          new Notice(`AutoOC: ↪ Passing context from "${prevTask.name}" to "${task.name}"`);
        }
      }
    }

    wf.currentStep = stepIndex;
    await this.saveSettings();

    // Run the task with completion callback for chaining
    await this.runTask(task, async (completedTask, exitCode) => {
      // Refresh workflow reference (may have been reloaded)
      const currentWf = this.settings.workflows[wfIdx];
      if (!currentWf || currentWf.status !== "running") return;
      const currentStep = currentWf.steps[stepIndex];
      const transitionMode = currentStep.transitionMode ?? (currentStep.forceContinue ? "force" : currentStep.evaluatePrompt !== undefined ? "eval" : "default");

      // Check if this is the last step
      if (stepIndex >= currentWf.steps.length - 1) {
        currentWf.status = exitCode === 0 && completedTask.status !== "failed" ? "completed" : "failed";
        currentWf.currentStep = stepIndex;
        new Notice(
          currentWf.status === "completed"
            ? `AutoOC: ✅ Workflow "${currentWf.name}" completed (${currentWf.steps.length}/${currentWf.steps.length} steps).`
            : `AutoOC: ❌ Workflow "${currentWf.name}" failed at final step ${stepIndex + 1}.`
        );
        await this.saveSettings();
        return;
      }

      // Evaluate transition to next step
      let shouldContinue = false;

      if (transitionMode === "force") {
        shouldContinue = true;
      } else if (transitionMode === "eval") {
        new Notice(`AutoOC: Evaluating step ${stepIndex + 1} → ${stepIndex + 2} for "${currentWf.name}"...`);
        try {
          const cwd = completedTask.workingDirectory || this.settings.workingDirectory || (this.app.vault.adapter as any).basePath || ".";
          const prompt = currentStep.evaluatePrompt?.trim() || "Did the previous task complete successfully? If it is safe to continue, reply YES. Otherwise reply NO.";
          const evalFullPrompt = `${prompt}\n\nPrevious task output:\n---\n${completedTask.output}\n---\n\nReply ONLY with YES or NO.`;
          const evalResult = await this.evaluateWithOpencode(evalFullPrompt, completedTask.model, cwd);

          // Parse: if output contains YES and not NO, continue
          const isYes = /\bYES\b/i.test(evalResult.output) && !/\bNO\b/i.test(evalResult.output);
          shouldContinue = isYes;

          // Append evaluation note to task output
          completedTask.output += `\n\n[Workflow evaluation (step ${stepIndex + 1}→${stepIndex + 2}): ${evalResult.output.trim().slice(0, 300)}]`;
        } catch (err) {
          completedTask.output += `\n\n[Workflow evaluation error: ${String(err)}]`;
          shouldContinue = false;
        }
      } else {
        // Default: continue only if task succeeded
        shouldContinue = exitCode === 0 && completedTask.status !== "failed";
      }

      if (shouldContinue) {
        currentWf.currentStep = stepIndex + 1;
        await this.saveSettings();
        new Notice(`AutoOC: ⚡ Workflow "${currentWf.name}" step ${stepIndex + 2}/${currentWf.steps.length}...`);
        // Small delay to let UI update
        setTimeout(() => {
          this.runWorkflowStep(wfIdx, stepIndex + 1);
        }, 500);
      } else {
        const failedByTask = transitionMode === "default" && (exitCode !== 0 || completedTask.status === "failed");
        currentWf.status = failedByTask ? "failed" : "completed";
        completedTask.output += failedByTask
          ? `\n[Workflow failed at step ${stepIndex + 1}/${currentWf.steps.length}]`
          : `\n[Workflow stopped at step ${stepIndex + 1}/${currentWf.steps.length}]`;
        new Notice(
          failedByTask
            ? `AutoOC: ❌ Workflow "${currentWf.name}" failed at step ${stepIndex + 1}/${currentWf.steps.length}.`
            : `AutoOC: ⏸ Workflow "${currentWf.name}" stopped at step ${stepIndex + 1}/${currentWf.steps.length}.`
        );
        await this.saveSettings();
      }
    }, taskOverrides);
  }
}

// ─── Sidebar View ─────────────────────────────────────────────────────────────

class AutoOCView extends ItemView {
  private plugin: AutoOCPlugin;
  private filterText: string = "";
  private filterStatus: string = "all";
  private currentTab: string = "tasks";

  constructor(leaf: WorkspaceLeaf, plugin: AutoOCPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "AutoOC Scheduler"; }
  getIcon() { return "workflow"; }

  async onOpen() { this.render(); }
  async onClose() {}
  refresh() { this.render(); }

  private openCli() {
    new OpenCodeCliModal(this.app, this.plugin).open();
  }

  render() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("auto-oc-view");

    // ── Tab buttons ──
    const tabBar = containerEl.createDiv("auto-oc-tab-bar");
    const btnTasks = tabBar.createEl("button", {
      text: "📋 Tasks",
      cls: "auto-oc-tab-btn",
    });
    btnTasks.onclick = () => { this.currentTab = "tasks"; this.render(); };

    const btnWorkflows = tabBar.createEl("button", {
      text: "🔗 Workflows",
      cls: "auto-oc-tab-btn",
    });
    btnWorkflows.onclick = () => { this.currentTab = "workflows"; this.render(); };

    const btnCli = tabBar.createEl("button", {
      text: "OpenCode CLI",
      cls: "auto-oc-tab-btn",
    });
    btnCli.onclick = () => this.openCli();

    // Highlight active tab
    if (this.currentTab === "tasks") btnTasks.addClass("active");
    else if (this.currentTab === "workflows") btnWorkflows.addClass("active");

    // ── Content ──
    if (this.currentTab === "workflows") {
      this.renderWorkflows(containerEl);
    } else {
      this.renderTasks(containerEl);
    }
  }

  private renderTasks(containerEl: HTMLElement) {
    // ── Header ──
    const header = containerEl.createDiv("auto-oc-header");

    const titleRow = header.createDiv("auto-oc-title-row");
    titleRow.createEl("h4", { text: "⏰ AutoOC Scheduler" });

    const versionWrap = titleRow.createDiv("auto-oc-version-wrap");
    versionWrap.createEl("span", {
      text: `v${this.plugin.manifest.version}`,
      cls: "auto-oc-version",
    });

    const btnCheckUpdates = versionWrap.createEl("button", {
      text: "Check updates",
      cls: "auto-oc-btn-check-update",
    });
    btnCheckUpdates.disabled = this.plugin.updateInProgress;
    btnCheckUpdates.title = "Check GitHub main/manifest.json for a newer AutoOC version";
    btnCheckUpdates.onclick = async () => {
      btnCheckUpdates.disabled = true;
      btnCheckUpdates.textContent = "Checking…";
      await this.plugin.checkForUpdates(false);
      this.render();
    };

    if (this.plugin.updateInProgress) {
      versionWrap.createEl("span", {
        text: "⏳ Updating…",
        cls: "auto-oc-update-status",
      });
    } else if (this.plugin.updateAvailable && this.plugin.latestVersion) {
      versionWrap.createEl("span", {
        text: `🚀 v${this.plugin.latestVersion} available`,
        cls: "auto-oc-update-badge",
      });
      const btnUpdate = versionWrap.createEl("button", {
        text: "Update now",
        cls: "auto-oc-btn-update",
      });
      btnUpdate.onclick = () => this.plugin.updatePlugin();
    } else if (this.plugin.updateCheckError) {
      versionWrap.createEl("span", {
        text: "⚠️ update check failed",
        cls: "auto-oc-update-error",
        title: this.plugin.updateCheckError,
      });
    }

    const btnRow = header.createDiv("auto-oc-btn-row");

    const btnNew = btnRow.createEl("button", {
      text: "+ New Task",
      cls: "auto-oc-btn-primary",
    });
    btnNew.onclick = () => new CreateTaskModal(this.app, this.plugin).open();

    // ── Filters Bar ──
    const filterBar = containerEl.createDiv("auto-oc-filter-bar");
    
    const searchInput = filterBar.createEl("input", {
      type: "text",
      placeholder: "🔍 Search name or prompt...",
      cls: "auto-oc-search-input",
    });
    searchInput.value = this.filterText;
    searchInput.oninput = () => {
      this.filterText = searchInput.value.toLowerCase();
      this.render();
    };

    const statusSelect = filterBar.createEl("select", {
      cls: "auto-oc-status-select",
    });
    const statuses = ["all", "pending", "running", "completed", "failed"];
    statuses.forEach(s => {
      const opt = statusSelect.createEl("option");
      opt.value = s;
      opt.text = s.charAt(0).toUpperCase() + s.slice(1);
    });
    statusSelect.value = this.filterStatus;
    statusSelect.onchange = () => {
      this.filterStatus = statusSelect.value;
      this.render();
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
    const filteredTasks = tasks.filter(t => {
      const matchesText = t.name.toLowerCase().includes(this.filterText) || 
                          t.prompt.toLowerCase().includes(this.filterText);
      const matchesStatus = this.filterStatus === "all" || t.status === this.filterStatus;
      return matchesText && matchesStatus;
    });

    if (filteredTasks.length === 0) {
      containerEl.createEl("p", {
        text: this.filterText || this.filterStatus !== "all" 
              ? "No tasks match your filters." 
              : "No tasks scheduled. Create one with \"+New Task\".",
        cls: "auto-oc-empty",
      });
      return;
    }

    const list = containerEl.createDiv("auto-oc-list");
    for (const task of [...filteredTasks].reverse()) {
      this.renderTaskCard(list, task);
    }
  }

  private renderTaskCard(parent: HTMLElement, task: ScheduledTask) {
    const card = parent.createDiv(`auto-oc-card auto-oc-status-${task.status}`);
    
    // Summary Bar (Always Visible)
    const summary = card.createDiv("auto-oc-card-summary");
    const title = summary.createEl("span", { text: task.name, cls: "auto-oc-task-name" });
    
    const badge = summary.createEl("span", {
      text: task.status,
      cls: `auto-oc-badge auto-oc-badge-${task.status}`,
    });
    if (task.status === "failed") {
      badge.addClass("auto-oc-badge-clickable");
      badge.title = "Click to reset to pending (will run on next schedule, or hit ▶ Run now)";
      badge.onclick = async (e) => {
        e.stopPropagation();
        task.status = "pending";
        await this.plugin.saveSettings();
        this.render();
        new Notice(`AutoOC: "${task.name}" reset to pending.`);
      };
    }

    // Details Section (Collapsible)
    const details = card.createDiv("auto-oc-card-details");
    details.style.display = "none";

    const meta = details.createDiv("auto-oc-card-meta");
    const modelLabel = this.plugin.availableModels.find((m) => m.value === task.model)?.label ?? task.model;
    meta.createEl("span", { text: `🤖 ${modelLabel}` });
    meta.createEl("span", { text: `⚙️ ${this.plugin.getEffectiveAgent(task.agent)}` });

    let scheduleText = "";
    if (task.scheduleType === "manual") {
      scheduleText = "▶ Manual only";
    } else if (task.scheduleType === "once") {
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

    const preview = details.createDiv("auto-oc-prompt-preview");
    preview.createEl("span", {
      text: task.prompt.slice(0, 140) + (task.prompt.length > 140 ? "…" : ""),
    });

    const actions = details.createDiv("auto-oc-card-actions");

    const btnRun = actions.createEl("button", {
      text: task.status === "running" ? "⏳ Running…" : "▶ Run",
      cls: "auto-oc-btn-run",
    });
    btnRun.disabled = task.status === "running";
    btnRun.onclick = (e) => {
      e.stopPropagation();
      this.plugin.runTask(task);
    };

    if (task.status === "running") {
      const btnStop = actions.createEl("button", {
        text: "⏹ Stop",
        cls: "auto-oc-btn-stop",
      });
      btnStop.title = "Terminate process now";
      btnStop.onclick = async (e) => {
        e.stopPropagation();
        btnStop.disabled = true;
        btnStop.textContent = "Stopping…";
        await this.plugin.killTask(task.id);
      };
    }

    const btnLog = actions.createEl("button", {
      text: task.status === "running" ? "📡 Live Log" : "📄 Log",
      cls: task.status === "running" ? "auto-oc-btn-log-live" : "auto-oc-btn-output",
    });
    btnLog.disabled = !task.output && task.status !== "running";
    btnLog.title = task.output ? "" : "Aún no hay output";
    btnLog.onclick = (e) => {
      e.stopPropagation();
      new LiveLogModal(this.app, task, this.plugin).open();
    };

    const btnHistory = actions.createEl("button", {
      text: "📜 History",
      cls: "auto-oc-btn-history",
    });
    btnHistory.onclick = (e) => {
      e.stopPropagation();
      try {
        new LogHistoryModal(this.app, task, this.plugin).open();
      } catch (err) {
        new Notice(`AutoOC: could not open history — ${String(err)}`);
      }
    };

    const btnCmd = actions.createEl("button", {
      text: "🔍 Command",
      cls: "auto-oc-btn-cmd",
    });
    btnCmd.onclick = (e) => {
      e.stopPropagation();
      const cmd = this.plugin.buildCommand(task);
      new CommandPreviewModal(this.app, task.name, cmd).open();
    };

    const btnEdit = actions.createEl("button", {
      text: "✏️ Edit",
      cls: "auto-oc-btn-edit",
    });
    btnEdit.onclick = (e) => {
      e.stopPropagation();
      try {
        new CreateTaskModal(this.app, this.plugin, task).open();
      } catch (err) {
        new Notice(`AutoOC: could not open task editor — ${String(err)}`);
      }
    };

    const btnDuplicate = actions.createEl("button", {
      text: "⧉ Duplicate",
      cls: "auto-oc-btn-duplicate",
    });
    btnDuplicate.onclick = async (e) => {
      e.stopPropagation();
      await this.plugin.duplicateTask(task);
      this.render();
    };

    const btnDelete = actions.createEl("button", {
      text: "🗑",
      cls: "auto-oc-btn-delete",
    });
    btnDelete.title = "Delete task";
    btnDelete.onclick = async (e) => {
      e.stopPropagation();
      if (confirm(`Delete task "${task.name}"?`)) {
        await this.plugin.deleteTask(task.id);
      }
    };

    // Toggle interaction
    summary.onclick = () => {
      const isHidden = details.style.display === "none";
      details.style.display = isHidden ? "block" : "none";
      card.classList.toggle("expanded", isHidden);
    };
  }

  // ── Workflows rendering ──────────────────────────────────────────────────

  private renderWorkflows(containerEl: HTMLElement) {
    // Header
    const header = containerEl.createDiv("auto-oc-header");
    const titleRow = header.createDiv("auto-oc-title-row");
    titleRow.createEl("h4", { text: "🔗 Workflows" });

    const btnRow = header.createDiv("auto-oc-btn-row");
    const btnNew = btnRow.createEl("button", {
      text: "+ New Workflow",
      cls: "auto-oc-btn-primary",
    });
    btnNew.onclick = () => new CreateWorkflowModal(this.app, this.plugin).open();

    const help = header.createDiv("auto-oc-workflow-panel-help");
    help.createSpan({
      text: "Workflows run tasks in order using their own schedule. Per-step transitions decide whether the next task starts: success, force, or AI decides.",
    });

    const workflows = this.plugin.settings.workflows;
    const stats = containerEl.createDiv("auto-oc-stats");
    const completed = workflows.filter((w) => w.status === "completed").length;
    const running = workflows.filter((w) => w.status === "running").length;
    const failed = workflows.filter((w) => w.status === "failed").length;
    stats.createEl("span", { text: `${workflows.length} workflows` });
    if (running > 0) stats.createEl("span", { text: `🟡 ${running} running`, cls: "auto-oc-stat-running" });
    if (failed > 0) stats.createEl("span", { text: `🔴 ${failed} failed`, cls: "auto-oc-stat-failed" });
    if (completed > 0) stats.createEl("span", { text: `🟢 ${completed} completed` });

    if (workflows.length === 0) {
      containerEl.createEl("p", {
        text: "No workflows yet. Chain tasks together with \"+ New Workflow\".",
        cls: "auto-oc-empty",
      });
      return;
    }

    const list = containerEl.createDiv("auto-oc-list");
    for (const wf of [...workflows].reverse()) {
      this.renderWorkflowCard(list, wf);
    }
  }

  private renderWorkflowCard(parent: HTMLElement, workflow: Workflow) {
    const card = parent.createDiv(`auto-oc-card auto-oc-status-${workflow.status}`);
    const summary = card.createDiv("auto-oc-card-summary");

    const nameEl = summary.createEl("span", {
      text: workflow.name,
      cls: "auto-oc-task-name",
    });

    const badge = summary.createEl("span", {
      text: workflow.status,
      cls: `auto-oc-badge auto-oc-badge-${workflow.status}`,
    });
    if (workflow.status === "failed") {
      badge.addClass("auto-oc-badge-clickable");
      badge.title = "Click to reset to pending";
      badge.onclick = async (e) => {
        e.stopPropagation();
        workflow.status = "pending";
        await this.plugin.saveSettings();
        this.render();
        new Notice(`Workflow "${workflow.name}" reset to pending.`);
      };
    }

    const details = card.createDiv("auto-oc-card-details");
    details.style.display = "none";

    // Description
    if (workflow.description) {
      const desc = details.createDiv("auto-oc-prompt-preview");
      desc.createEl("span", { text: workflow.description.slice(0, 200) });
    }

    // Steps list with task details/actions
    const stepsDiv = details.createDiv("auto-oc-workflow-steps-mini");
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      const task = this.plugin.settings.tasks.find((t) => t.id === step.taskId);
      const stepItem = stepsDiv.createDiv("auto-oc-workflow-task-detail");
      const isCurrent = workflow.status === "running" && workflow.currentStep === i;
      const isDone = workflow.currentStep > i || (workflow.status === "completed" && workflow.currentStep >= i);
      const icon = isDone ? "✅" : isCurrent ? "⏳" : "⬜";

      const stepHeader = stepItem.createDiv("auto-oc-workflow-task-header");
      stepHeader.createSpan({
        text: `${icon} Step ${i + 1}: ${task ? task.name : "(deleted task)"}`,
        cls: "auto-oc-workflow-task-title",
      });
      if (task) {
        stepHeader.createSpan({
          text: task.status,
          cls: `auto-oc-badge auto-oc-badge-${task.status}`,
        });
      }

      if (i < workflow.steps.length - 1) {
        const transitionMode = step.transitionMode ?? (step.forceContinue ? "force" : step.evaluatePrompt !== undefined ? "eval" : "default");
        stepHeader.createSpan({
          text: transitionMode === "force"
            ? " → [force]"
            : transitionMode === "eval"
              ? " → [eval]"
              : " → [default]",
          cls: "auto-oc-workflow-transition-label",
        });
      }

      if (!task) continue;

      const taskMeta = stepItem.createDiv("auto-oc-workflow-task-meta");
      const modelLabel = this.plugin.availableModels.find((m) => m.value === task.model)?.label ?? task.model;
      taskMeta.createSpan({ text: `🤖 ${modelLabel || "(no model)"}` });
      taskMeta.createSpan({ text: `⚙️ ${this.plugin.getEffectiveAgent(task.agent)}` });
      if (task.branch) taskMeta.createSpan({ text: `🌿 ${task.branch}${task.createBranch ? " (create)" : ""}` });
      if (task.workingDirectory) taskMeta.createSpan({ text: `📂 ${task.workingDirectory}` });
      if (task.lastRun) taskMeta.createSpan({ text: `⏱ ${formatDateTime(task.lastRun)}` });

      const promptPreview = stepItem.createDiv("auto-oc-workflow-task-prompt");
      promptPreview.createSpan({
        text: task.prompt.slice(0, 180) + (task.prompt.length > 180 ? "…" : ""),
      });

      const taskActions = stepItem.createDiv("auto-oc-workflow-task-actions");
      const btnLog = taskActions.createEl("button", {
        text: task.status === "running" ? "📡 Live Log" : "📄 Log",
        cls: task.status === "running" ? "auto-oc-btn-log-live" : "auto-oc-btn-output",
      });
      btnLog.disabled = !task.output && task.status !== "running";
      btnLog.onclick = (e) => {
        e.stopPropagation();
        new LiveLogModal(this.app, task, this.plugin).open();
      };

      const btnHistory = taskActions.createEl("button", {
        text: "📜 History",
        cls: "auto-oc-btn-history",
      });
      btnHistory.onclick = (e) => {
        e.stopPropagation();
        try {
          new LogHistoryModal(this.app, task, this.plugin).open();
        } catch (err) {
          new Notice(`AutoOC: could not open history — ${String(err)}`);
        }
      };

      const btnCmd = taskActions.createEl("button", {
        text: "🔍 Command",
        cls: "auto-oc-btn-cmd",
      });
      btnCmd.onclick = (e) => {
        e.stopPropagation();
        new CommandPreviewModal(this.app, task.name, this.plugin.buildCommand(task)).open();
      };

      const btnEditTask = taskActions.createEl("button", {
        text: "✏️ Edit Task",
        cls: "auto-oc-btn-edit",
      });
      btnEditTask.onclick = (e) => {
        e.stopPropagation();
        try {
          new CreateTaskModal(this.app, this.plugin, task).open();
        } catch (err) {
          new Notice(`AutoOC: could not open task editor — ${String(err)}`);
        }
      };
    }

    // Handoff info
    if (workflow.handoffBranch || workflow.handoffOutput) {
      const handoffDiv = details.createDiv("auto-oc-card-meta");
      if (workflow.handoffBranch) {
        handoffDiv.createEl("span", { text: "🔄 Branch handoff enabled" });
      }
      if (workflow.handoffOutput) {
        handoffDiv.createEl("span", { text: "📄 Output context handoff enabled" });
      }
    }

    if (workflow.lastRun) {
      const meta = details.createDiv("auto-oc-card-meta");
      meta.createEl("span", { text: `⏱ Last run: ${formatDateTime(workflow.lastRun)}` });
    }

    // Schedule info
    const wfScheduleType = workflow.scheduleType || "once";
    const wfScheduleTime = workflow.scheduleTime || "00:00";
    const wfScheduleDate = workflow.scheduleDate || "";
    const wfScheduleDays = workflow.scheduleDays || [];
    if (wfScheduleType === "manual" || wfScheduleType !== "once" || wfScheduleTime !== "00:00") {
      const schedMeta = details.createDiv("auto-oc-card-meta");
      if (wfScheduleType === "manual") {
        schedMeta.createEl("span", { text: "▶ Manual only" });
      } else if (wfScheduleType === "once") {
        schedMeta.createEl("span", { text: `📅 ${wfScheduleDate} ${wfScheduleTime}` });
      } else if (wfScheduleType === "daily") {
        schedMeta.createEl("span", { text: `🔁 Every day at ${wfScheduleTime}` });
      } else if (wfScheduleType === "weekly") {
        const days = wfScheduleDays.map((d) => DAY_NAMES[d]).join(", ");
        schedMeta.createEl("span", { text: `🔁 ${days || "no days"} at ${wfScheduleTime}` });
      }
    }

    const actions = details.createDiv("auto-oc-card-actions");

    const btnRun = actions.createEl("button", {
      text: workflow.status === "running" ? "⏳ Running…" : "▶ Run Workflow",
      cls: "auto-oc-btn-run",
    });
    btnRun.disabled = workflow.status === "running";
    btnRun.onclick = (e) => {
      e.stopPropagation();
      this.plugin.runWorkflow(workflow);
    };

    const btnEdit = actions.createEl("button", {
      text: "✏️ Edit",
      cls: "auto-oc-btn-edit",
    });
    btnEdit.onclick = (e) => {
      e.stopPropagation();
      new CreateWorkflowModal(this.app, this.plugin, workflow).open();
    };

    const btnDuplicate = actions.createEl("button", {
      text: "⧉ Duplicate",
      cls: "auto-oc-btn-duplicate",
    });
    btnDuplicate.onclick = async (e) => {
      e.stopPropagation();
      await this.plugin.duplicateWorkflow(workflow);
      this.render();
    };

    const btnDelete = actions.createEl("button", {
      text: "🗑",
      cls: "auto-oc-btn-delete",
    });
    btnDelete.title = "Delete workflow";
    btnDelete.onclick = async (e) => {
      e.stopPropagation();
      if (confirm(`Delete workflow "${workflow.name}"?`)) {
        await this.plugin.deleteWorkflow(workflow.id);
      }
    };

    summary.onclick = () => {
      const isHidden = details.style.display === "none";
      details.style.display = isHidden ? "block" : "none";
      card.classList.toggle("expanded", isHidden);
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
            agent: plugin.getEffectiveAgent(),
            useRalphLoop: false,
            scheduleType: "manual",
            scheduleTime: nowTimeString(),
            scheduleDate: todayString(),
            scheduleDays: [],
          };
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("auto-oc-modal");
    setAutoOCModalSize(this, 900);
    preventBackdropClose(this);

    // Header with X button
    const headerBar = contentEl.createDiv("auto-oc-modal-header");
    headerBar.createEl("h3", {
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

    let branchInput: HTMLInputElement | null = null;
    new Setting(contentEl)
      .setName("Git Branch")
      .setDesc("Branch to work on")
      .addText((text) => {
        branchInput = text.inputEl;
        text.inputEl.addClass("auto-oc-modal-input");
        text
          .setPlaceholder("main")
          .setValue(this.draft.branch ?? "")
          .onChange((v) => (this.draft.branch = v));
      })
      .addButton((btn) => 
        btn.setButtonText("🔍 Discover").onClick(async () => {
          const taskCwd = this.draft.workingDirectory || this.plugin.settings.workingDirectory || (this.app.vault.adapter as any).basePath || ".";
          new Notice("AutoOC: Fetching branches...");
          try {
            const branches = listGitBranches(taskCwd);
            if (branches.length > 0) {
              const selected = await new BranchSelectorModal(this.app, branches).open();
              if (selected) {
                this.draft.branch = selected;
                if (branchInput) branchInput.value = selected;
                new Notice(`AutoOC: Selected branch ${selected}`);
              }
            } else {
              new Notice("AutoOC: No branches found.");
            }
          } catch (e) {
            new Notice(`AutoOC: Could not list branches: ${String(e)}`);
          }
        })
      );

    new Setting(contentEl)
      .setName("Create Branch")
      .setDesc("Automatically create the branch if it doesn't exist")
      .addToggle((tog) => {
        tog.setValue(this.draft.createBranch ?? false);
        tog.onChange((v) => (this.draft.createBranch = v));
      });

    const agentCwd = this.draft.workingDirectory || this.plugin.settings.workingDirectory || (this.app.vault.adapter as any).basePath || ".";
    const projectAgents = this.plugin.availableAgents.filter((a) => isValidAgentName(a.value));

    new Setting(contentEl)
      .setName("Agent")
      .setDesc(`AI agent personality to use (${projectAgents.length} loaded). Use Refresh Agents after changing Project Path.`)
      .addDropdown((dd) => {
        projectAgents.forEach((a) => dd.addOption(a.value, a.label));
        const current = this.draft.agent ?? this.plugin.getEffectiveAgent();
        if (!current && projectAgents.length === 0) {
          dd.addOption("", "(no agents; tap refresh)");
        } else if (current && !projectAgents.find((a) => a.value === current)) {
          dd.addOption(current, current);
        }
        dd.setValue(current || "");
        dd.onChange((v) => (this.draft.agent = v));
      });

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText("🔄 Refresh Agents").onClick(() => {
          this.plugin.refreshAgents(agentCwd);
          new Notice(`AutoOC: ${this.plugin.availableAgents.length} agents loaded from project/global config.`);
          this.contentEl.empty();
          this.onOpen();
        })
      );

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
        dd.addOption("manual", "Manual (run only when I press play)");
        dd.addOption("once", "Once (specific date and time)");
        dd.addOption("daily", "Daily (fixed time)");
        dd.addOption("weekly", "Weekdays");
        dd.setValue(this.draft.scheduleType ?? "manual");
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

    if (this.draft.scheduleType !== "manual") {
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
    }

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
          if (
            this.draft.scheduleType !== "manual" &&
            !/^\d{2}:\d{2}$/.test(this.draft.scheduleTime ?? "")
          ) {
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
              agent: this.plugin.getEffectiveAgent(this.draft.agent),
              useRalphLoop: this.draft.useRalphLoop ?? false,
              scheduleType: this.draft.scheduleType ?? "manual",
              scheduleTime: this.draft.scheduleTime ?? nowTimeString(),
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

// ─── Create / Edit Workflow Modal ────────────────────────────────────────────

class CreateWorkflowModal extends Modal {
  private plugin: AutoOCPlugin;
  private editWorkflow?: Workflow;
  private draft: Partial<Workflow>;
  private selectedTaskIds: string[];      // Ordered list
  private stepConfigs: Record<string, { transitionMode?: "default" | "force" | "eval"; evaluatePrompt?: string; forceContinue?: boolean }>;

  constructor(app: App, plugin: AutoOCPlugin, editWorkflow?: Workflow) {
    super(app);
    this.plugin = plugin;
    this.editWorkflow = editWorkflow;
    this.draft = editWorkflow
      ? { ...editWorkflow }
      : { name: "", description: "", handoffBranch: false, handoffOutput: true, scheduleType: "manual", scheduleTime: nowTimeString(), scheduleDate: todayString(), scheduleDays: [] };
    this.selectedTaskIds = editWorkflow
      ? editWorkflow.steps.map((s) => s.taskId)
      : [];
    this.stepConfigs = {};
    if (editWorkflow) {
      for (const step of editWorkflow.steps) {
        this.stepConfigs[step.taskId] = {
          transitionMode: step.transitionMode ?? (step.forceContinue ? "force" : step.evaluatePrompt !== undefined ? "eval" : "default"),
          evaluatePrompt: step.evaluatePrompt,
          forceContinue: step.forceContinue,
        };
      }
    }
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("auto-oc-modal");
    setAutoOCModalSize(this, 1100);
    preventBackdropClose(this);

    // Header with X button
    const headerBar = contentEl.createDiv("auto-oc-modal-header");
    headerBar.createEl("h3", {
      text: this.editWorkflow ? "Edit Workflow" : "New Workflow",
    });

    const guide = contentEl.createDiv("auto-oc-workflow-guide");
    guide.createEl("h4", { text: "How workflows work" });
    const guideList = guide.createEl("ol");
    guideList.createEl("li", { text: "A workflow has its own schedule. When it runs, it executes the selected tasks in order." });
    guideList.createEl("li", { text: "Task schedules are ignored inside a workflow. A task can be reused even if its own schedule is manual, once, daily, weekly, completed, or pending." });
    guideList.createEl("li", { text: "Each transition controls what happens after a step finishes: continue on success, force continue, or ask AI to decide." });
    guideList.createEl("li", { text: "AI decides sends the previous task output plus your transition prompt to OpenCode. It must answer YES to continue; any NO/unclear answer stops the workflow." });
    guide.createEl("p", {
      text: "Tip: configure the transition on the step that just finished, not on the next step. Example: Step 1 -> Step 2 means Step 1 decides whether Step 2 starts.",
      cls: "auto-oc-workflow-guide-tip",
    });

    new Setting(contentEl)
      .setName("Name")
      .setDesc("Workflow identifier")
      .addText((text) => {
        text.inputEl.addClass("auto-oc-modal-input");
        text.setValue(this.draft.name ?? "").onChange((v) => (this.draft.name = v));
        window.setTimeout(() => text.inputEl.focus(), 50);
      });

    new Setting(contentEl)
      .setName("Description")
      .setDesc("Optional description")
      .addText((text) => {
        text.inputEl.addClass("auto-oc-modal-input");
        text.setValue(this.draft.description ?? "").onChange((v) => (this.draft.description = v));
      });

    // ── Handoff section ──
    contentEl.createDiv("auto-oc-modal-section-title").setText("🔄 Handoff between steps");
    contentEl.createEl("p", {
      text: "Handoff passes context from the task that just finished to the next task at runtime only. It does not edit the original task prompt.",
      cls: "setting-item-description auto-oc-workflow-section-help",
    });

    new Setting(contentEl)
      .setName("Pass Git Branch")
      .setDesc("The next task checks out the same branch used by the previous task. Useful when one step creates/edits code and the next step reviews or tests it.")
      .addToggle((tog) => {
        tog.setValue(this.draft.handoffBranch ?? false);
        tog.onChange((v) => (this.draft.handoffBranch = v));
      });

    new Setting(contentEl)
      .setName("Pass Output Context")
      .setDesc("The previous task output is appended to the next task prompt only for that workflow run. The saved task is not modified.")
      .addToggle((tog) => {
        tog.setValue(this.draft.handoffOutput ?? false);
        tog.onChange((v) => (this.draft.handoffOutput = v));
      });

    // ── Schedule section ──
    contentEl.createDiv("auto-oc-modal-section-title").setText("⏰ Schedule");
    contentEl.createEl("p", {
      text: "This schedule belongs to the workflow itself. The individual task schedules are not used while the workflow is running.",
      cls: "setting-item-description auto-oc-workflow-section-help",
    });

    new Setting(contentEl)
      .setName("Schedule Type")
      .addDropdown((dd) => {
        dd.addOption("manual", "Manual (run only when I press play)");
        dd.addOption("once", "Once (specific date and time)");
        dd.addOption("daily", "Daily (fixed time)");
        dd.addOption("weekly", "Weekdays");
        dd.setValue(this.draft.scheduleType ?? "manual");
        dd.onChange((v) => {
          this.draft.scheduleType = v as ScheduleType;
          this.onOpen();
        });
      });

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
          tog.toggleEl.insertAdjacentHTML(
            "afterend",
            `<span class="auto-oc-day-label">${name}</span>`
          );
        });
      });
    }

    if (this.draft.scheduleType !== "manual") {
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
    }

    // ── Steps section ──
    contentEl.createDiv("auto-oc-modal-section-title").setText("📋 Steps — Chain your tasks");
    contentEl.createEl("p", {
      text: "Add tasks in execution order. For every pair of steps, choose the transition rule that decides whether the next task starts.",
      cls: "setting-item-description auto-oc-workflow-section-help",
    });

    const stepsContainer = contentEl.createDiv("auto-oc-workflow-steps-container");
    this.renderStepsList(stepsContainer);

    // ── Save / Cancel ──
    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText(this.editWorkflow ? "Save Changes" : "Create Workflow")
        .setCta()
        .onClick(async () => {
          if (!this.draft.name?.trim()) {
            new Notice("Name is required.");
            return;
          }
          if (this.selectedTaskIds.length < 2) {
            new Notice("A workflow needs at least 2 tasks.");
            return;
          }
          if (
            this.draft.scheduleType !== "manual" &&
            !/^\d{2}:\d{2}$/.test(this.draft.scheduleTime ?? "")
          ) {
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

          const steps: WorkflowStep[] = this.selectedTaskIds.map((tid) => ({
            taskId: tid,
            transitionMode: this.stepConfigs[tid]?.transitionMode || "default",
            evaluatePrompt: this.stepConfigs[tid]?.evaluatePrompt || undefined,
            forceContinue: this.stepConfigs[tid]?.forceContinue || undefined,
          }));

          if (this.editWorkflow) {
            const idx = this.plugin.settings.workflows.findIndex(
              (w) => w.id === this.editWorkflow!.id
            );
            if (idx !== -1) {
              const wasRunning = this.editWorkflow.status === "running";
              this.plugin.settings.workflows[idx] = {
                ...this.editWorkflow,
                name: this.draft.name!,
                description: this.draft.description,
                steps,
                handoffBranch: this.draft.handoffBranch ?? false,
                handoffOutput: this.draft.handoffOutput ?? false,
                status: wasRunning ? "running" : "pending",
                scheduleType: this.draft.scheduleType ?? "manual",
                scheduleTime: this.draft.scheduleTime ?? nowTimeString(),
                scheduleDate: this.draft.scheduleDate ?? "",
                scheduleDays: this.draft.scheduleDays ?? [],
              };
            }
          } else {
            const workflow: Workflow = {
              id: generateId(),
              name: this.draft.name!,
              description: this.draft.description ?? "",
              steps,
              status: "pending",
              currentStep: -1,
              createdAt: new Date().toISOString(),
              handoffBranch: this.draft.handoffBranch ?? false,
              handoffOutput: this.draft.handoffOutput ?? false,
              scheduleType: this.draft.scheduleType ?? "manual",
              scheduleTime: this.draft.scheduleTime ?? nowTimeString(),
              scheduleDate: this.draft.scheduleDate ?? todayString(),
              scheduleDays: this.draft.scheduleDays ?? [],
            };
            this.plugin.settings.workflows.push(workflow);
          }

          await this.plugin.saveSettings();
          new Notice(`Workflow "${this.draft.name}" saved.`);
          this.close();
        })
    );
  }

  private renderStepsList(container: HTMLElement) {
    container.empty();

    if (this.selectedTaskIds.length === 0) {
      container.createEl("p", {
        text: "No steps added yet. Use 'Add Task to Chain' below.",
        cls: "auto-oc-empty",
      });
    }

    for (let i = 0; i < this.selectedTaskIds.length; i++) {
      const taskId = this.selectedTaskIds[i];
      const task = this.plugin.settings.tasks.find((t) => t.id === taskId);
      const config = this.stepConfigs[taskId] || {};

      const stepEl = container.createDiv("auto-oc-workflow-step-item");
      const isLast = i === this.selectedTaskIds.length - 1;

      // Header row
      const header = stepEl.createDiv("auto-oc-workflow-step-header");
      header.createEl("span", {
        text: `Step ${i + 1}`,
        cls: "auto-oc-workflow-step-num",
      });
      header.createEl("span", {
        text: task ? `📌 ${task.name}` : "❌ Deleted task",
        cls: task ? "" : "auto-oc-workflow-step-err",
      });

      if (!isLast) {
        header.createEl("span", { text: "→", cls: "auto-oc-workflow-step-arrow" });
        header.createEl("span", {
          text: `Step ${i + 2}`,
          cls: "auto-oc-workflow-step-num",
        });
        const nextTask = this.plugin.settings.tasks.find(
          (t) => t.id === this.selectedTaskIds[i + 1]
        );
        if (nextTask) {
          header.createEl("span", { text: `📌 ${nextTask.name}` });
        }
      }

      // Remove button
      const btnRemove = header.createEl("button", {
        text: "✖",
        cls: "auto-oc-btn-delete-small",
      });
      btnRemove.style.marginLeft = "auto";
      btnRemove.onclick = () => {
        this.selectedTaskIds.splice(i, 1);
        delete this.stepConfigs[taskId];
        this.renderStepsList(container);
      };

      // Transition config (only if not last)
      if (!isLast) {
        const transConfig = stepEl.createDiv("auto-oc-workflow-transition");
        const nextTask = this.plugin.settings.tasks.find((t) => t.id === this.selectedTaskIds[i + 1]);

        const transitionHeader = transConfig.createDiv("auto-oc-workflow-transition-header");
        transitionHeader.createSpan({
          text: `Transition: Step ${i + 1} → Step ${i + 2}`,
          cls: "auto-oc-workflow-transition-title",
        });
        transitionHeader.createSpan({
          text: `After «${task?.name ?? "current task"}» finishes, decide whether «${nextTask?.name ?? "next task"}» starts.`,
          cls: "auto-oc-workflow-transition-help",
        });

        // Mode selector: force, evaluate, or stop-on-fail (default)
        const modeDiv = transConfig.createDiv("auto-oc-workflow-mode");
        modeDiv.createSpan({
          text: "Decision mode:",
          cls: "auto-oc-workflow-label",
        });

        const modeSel = modeDiv.createEl("select", { cls: "auto-oc-status-select" });
        modeSel.style.marginLeft = "6px";
        const modes: { val: string; label: string; desc: string }[] = [
          { val: "default", label: "Default — continue only if this step succeeds", desc: "Starts the next task only when the current task exits successfully." },
          { val: "force",  label: "Force — always start next step", desc: "Starts the next task even if the current task fails." },
          { val: "eval",   label: "AI decides — evaluate output", desc: "Runs your transition prompt against this step output. YES starts the next task; NO stops the workflow." },
        ];
        const defaultEvalPrompt = "Did the previous task complete successfully? Check the output for errors, failures, or unfinished work. If it is safe to continue, reply YES. Otherwise reply NO.";
        const currentMode = config.transitionMode ?? ((config.forceContinue ?? false) ? "force" : (config.evaluatePrompt !== undefined ? "eval" : "default"));

        for (const m of modes) {
          modeSel.createEl("option", { text: m.label }).value = m.val;
        }
        modeSel.value = currentMode;
        const modeDesc = modeDiv.createSpan({
          text: modes.find((m) => m.val === currentMode)?.desc ?? "",
          cls: "auto-oc-workflow-mode-desc",
        });
        modeSel.onchange = () => {
          this.stepConfigs[taskId] = this.stepConfigs[taskId] || {};
          if (modeSel.value === "force") {
            this.stepConfigs[taskId].transitionMode = "force";
            this.stepConfigs[taskId].forceContinue = true;
            this.stepConfigs[taskId].evaluatePrompt = undefined;
          } else if (modeSel.value === "eval") {
            this.stepConfigs[taskId].transitionMode = "eval";
            this.stepConfigs[taskId].forceContinue = undefined;
            this.stepConfigs[taskId].evaluatePrompt = this.stepConfigs[taskId].evaluatePrompt ?? defaultEvalPrompt;
          } else {
            this.stepConfigs[taskId].transitionMode = "default";
            this.stepConfigs[taskId].forceContinue = undefined;
            this.stepConfigs[taskId].evaluatePrompt = undefined;
          }
          this.renderStepsList(container);
        };

        // Evaluate prompt (only if eval mode)
        if (currentMode === "eval") {
          const evalDiv = transConfig.createDiv("auto-oc-workflow-eval");

          // The actual prompt textarea. Each AI-decided transition owns its own prompt.
          const promptBox = evalDiv.createDiv("auto-oc-workflow-ai-prompt-box");
          promptBox.createSpan({
            text: `AI decides prompt: Step ${i + 1} → Step ${i + 2}`,
            cls: "auto-oc-workflow-ai-prompt-title",
          });
          promptBox.createSpan({
            text: `Write the condition here. OpenCode will receive this text plus the output of «${task?.name ?? "current task"}». It must answer YES to start «${nextTask?.name ?? "next task"}».`,
            cls: "auto-oc-workflow-ai-prompt-help",
          });
          const evalTextarea = promptBox.createEl("textarea", {
            cls: "auto-oc-modal-textarea auto-oc-workflow-ai-textarea",
          });
          evalTextarea.rows = 4;
          evalTextarea.value = config.evaluatePrompt ?? defaultEvalPrompt;
          evalTextarea.placeholder = "Example: Did the previous task complete successfully? Reply YES or NO.";

          // Info box: how it works
          const infoBox = evalDiv.createDiv("auto-oc-workflow-eval-info");
          infoBox.createSpan({
            text: `Evaluation contract: YES = continue to next step. NO or anything unclear = stop. The answer is saved in the previous task log as a workflow evaluation note.`,
          });

          // Presets
          const presetsDiv = evalDiv.createDiv("auto-oc-workflow-presets");
          presetsDiv.createSpan({
            text: "Quick presets:",
            cls: "auto-oc-workflow-label",
          });

          const presets = [
            { label: "¿Errores?", prompt: "Did the previous task complete without errors or failures? Look for error messages, stack traces, or exit codes in the output. If no errors were found, reply YES. If there were errors, reply NO." },
            { label: "¿Tests OK?", prompt: "Were all tests executed successfully? Check the output for test failures, assertion errors, or test suite crashes. If all tests passed, reply YES. If any test failed, reply NO." },
            { label: "¿Build OK?", prompt: "Was the build successful? Check for compilation errors, linker errors, or build failures. If the build completed without errors, reply YES. Otherwise reply NO." },
            { label: "¿Queda trabajo?", prompt: "Based on the output, is there remaining work that requires a follow-up step? Look for TODO comments, unfinished tasks, or incomplete implementations. If more work is needed, reply YES. If the task is fully complete, reply NO." },
            { label: "Custom", prompt: "" },
          ];

          for (const p of presets) {
            const btn = presetsDiv.createEl("button", {
              text: p.label,
              cls: "auto-oc-btn-secondary",
            });
            btn.style.fontSize = "0.7rem";
            btn.style.padding = "2px 6px";
            btn.onclick = () => {
              if (p.prompt) {
                evalTextarea.value = p.prompt;
                this.stepConfigs[taskId] = this.stepConfigs[taskId] || {};
                this.stepConfigs[taskId].evaluatePrompt = p.prompt;
                previewCode.textContent = `${p.prompt}\n\nPrevious task output:\n---\n[output of «${task?.name ?? "?"}» appears here]\n---\n\nReply ONLY with YES or NO.`;
              }
            };
            if (config.evaluatePrompt === p.prompt && p.prompt) {
              btn.style.borderColor = "var(--interactive-accent)";
              btn.style.color = "var(--interactive-accent)";
            }
          }

          // Preview
          const previewDiv = evalDiv.createDiv("auto-oc-workflow-eval-preview");
          previewDiv.createSpan({
            text: "What will be sent to OpenCode:",
            cls: "auto-oc-workflow-label",
          });
          const previewCode = previewDiv.createEl("pre", {
            cls: "auto-oc-workflow-eval-preview-code",
          });
          const currentEvalText = config.evaluatePrompt || "(your prompt)";
          previewCode.textContent = `${currentEvalText}\n\nPrevious task output:\n---\n[output of «${task?.name ?? "?"}» appears here]\n---\n\nReply ONLY with YES or NO.`;
          evalTextarea.oninput = () => {
            this.stepConfigs[taskId] = this.stepConfigs[taskId] || {};
            this.stepConfigs[taskId].evaluatePrompt = evalTextarea.value;
            previewCode.textContent = `${evalTextarea.value || "(your prompt)"}\n\nPrevious task output:\n---\n[output of «${task?.name ?? "?"}» appears here]\n---\n\nReply ONLY with YES or NO.`;
          };
        }
      }

      // Connector arrow
      if (!isLast) {
        stepEl.createDiv("auto-oc-workflow-connector");
      }
    }

    // Add task button
    const addDiv = container.createDiv("auto-oc-workflow-add-step");
    const tasks = this.plugin.settings.tasks.filter(
      (t) => !this.selectedTaskIds.includes(t.id)
    );

    // "Create New Task" button — always visible
    const btnCreateTask = addDiv.createEl("button", {
      text: "➕ Create New Task",
      cls: "auto-oc-btn-secondary",
    });
    btnCreateTask.title = "Create a fresh task and auto-add it to this chain";
    btnCreateTask.onclick = async () => {
      const prevCount = this.plugin.settings.tasks.length;
      const prevIds = new Set(this.plugin.settings.tasks.map((t) => t.id));

      // Open CreateTaskModal — it blocks until closed
      const taskModal = new CreateTaskModal(this.app, this.plugin);
      // We don't await here because Modal.open() doesn't return a promise.
      // Instead, we'll use a MutationObserver-like approach or just poll.
      // Easiest: use the modal's onClose to detect
      const origClose = taskModal.close.bind(taskModal);
      taskModal.close = () => {
        origClose();
        // After modal closes, find the new task
        setTimeout(() => {
          const newTasks = this.plugin.settings.tasks.filter(
            (t) => !prevIds.has(t.id) && !this.selectedTaskIds.includes(t.id)
          );
          if (newTasks.length > 0) {
            // Add the most recently created task
            const newest = newTasks[newTasks.length - 1];
            this.selectedTaskIds.push(newest.id);
            new Notice(`AutoOC: Task "${newest.name}" added to workflow chain.`);
          }
          this.renderStepsList(container);
        }, 200);
      };
      taskModal.open();
    };

    if (tasks.length === 0) {
      addDiv.createEl("span", {
        text: "All existing tasks are already in the chain.",
        cls: "setting-item-description",
      });
    }

    if (tasks.length > 0) {
      const sel = addDiv.createEl("select", { cls: "auto-oc-status-select" });
      sel.createEl("option", { text: "-- Add existing task --" }).value = "";
      for (const t of tasks) {
        sel.createEl("option", { text: t.name }).value = t.id;
      }
      const addBtn = addDiv.createEl("button", {
        text: "Add",
        cls: "auto-oc-btn-secondary",
      });
      addBtn.style.marginLeft = "4px";
      addBtn.onclick = () => {
        if (sel.value) {
          this.selectedTaskIds.push(sel.value);
          this.renderStepsList(container);
        }
      };
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

// ─── Live Log Modal ───────────────────────────────────────────────────────────

class LiveLogModal extends Modal {
  private task: ScheduledTask;
  private plugin: AutoOCPlugin;
  private renderEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private intervalId: number | null = null;
  private elapsedIntervalId: number | null = null;
  private autoScroll = true;
  private lastRenderedContent = "";

  constructor(app: App, task: ScheduledTask, plugin: AutoOCPlugin) {
    super(app);
    this.task = task;
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("auto-oc-output-modal");
    setupModalX(this);

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
      navigator.clipboard.writeText(this.lastRenderedContent);
      new Notice("Log copied.");
    };

    const btnClear = toolbar.createEl("button", {
      text: "🗑 Clear View",
      cls: "auto-oc-btn-secondary",
    });
    btnClear.onclick = () => {
      if (this.renderEl) this.renderEl.empty();
      this.lastRenderedContent = "";
    };

    this.renderEl = contentEl.createDiv("auto-oc-log-rendered markdown-rendered");

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

    if (this.renderEl) {
      const newContent = latest.output || "(sin output aún…)";
      if (this.lastRenderedContent !== newContent) {
        this.lastRenderedContent = newContent;
        this.renderEl.empty();
        void MarkdownRenderer.render(this.app, newContent, this.renderEl, "", this.plugin);
        if (this.autoScroll) {
          this.renderEl.scrollTop = this.renderEl.scrollHeight;
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

// ─── Log History Modal ───────────────────────────────────────────────────────

class LogHistoryModal extends Modal {
  private task: ScheduledTask;
  private plugin: AutoOCPlugin;

  constructor(app: App, task: ScheduledTask, plugin: AutoOCPlugin) {
    super(app);
    this.task = task;
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("auto-oc-output-modal");
    setupModalX(this);

    const header = contentEl.createDiv("auto-oc-log-header");
    header.createEl("h3", { text: `📜 Log History: ${this.task.name}` });

    const vaultBasePath = (this.app.vault.adapter as any).basePath || ".";
    const history = getLogHistory(vaultBasePath, this.task.id);

    if (history.length === 0) {
      contentEl.createEl("p", {
        text: "No historical logs found for this task.",
        cls: "auto-oc-empty",
      });
      return;
    }

    const toolbar = header.createDiv("auto-oc-log-toolbar");
    toolbar.createEl("span", {
      text: `${history.length} execution(s)`,
      cls: "setting-item-description",
    });

    const btnClearAll = toolbar.createEl("button", {
      text: "🧹 Clear All",
      cls: "auto-oc-btn-secondary",
    });
    btnClearAll.onclick = async () => {
      if (confirm(`Delete ALL ${history.length} logs for "${this.task.name}"?`)) {
        clearTaskLogs(vaultBasePath, this.task.id);
        this.close();
        new Notice("All logs cleared.");
      }
    };

    const list = contentEl.createDiv("auto-oc-log-history-list");

    for (const entry of history) {
      const item = list.createDiv("auto-oc-log-history-item");

      const label = item.createSpan({ text: `🕐 ${entry.timestamp}`, cls: "auto-oc-log-history-timestamp" });
      label.onclick = () => {
        const content = readLogFile(entry.file);
        const previewModal = new LogPreviewModal(this.app, this.task.name, entry.timestamp, content, this.plugin);
        previewModal.open();
      };

      const btnDelete = item.createEl("button", {
        text: "🗑",
        cls: "auto-oc-btn-delete-small",
      });
      btnDelete.title = "Delete this log";
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
}

// ─── Log Preview Modal ───────────────────────────────────────────────────────

class LogPreviewModal extends Modal {
  private taskName: string;
  private timestamp: string;
  private content: string;
  private plugin: AutoOCPlugin;

  constructor(app: App, taskName: string, timestamp: string, content: string, plugin: AutoOCPlugin) {
    super(app);
    this.taskName = taskName;
    this.timestamp = timestamp;
    this.content = content;
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("auto-oc-output-modal");
    setupModalX(this);

    const header = contentEl.createDiv("auto-oc-log-header");
    header.createEl("h3", { text: `📄 Log: ${this.taskName}` });
    header.createEl("p", { text: `Execution: ${this.timestamp}`, cls: "auto-oc-log-status" });

    const toolbar = contentEl.createDiv("auto-oc-log-toolbar");

    const btnCopy = toolbar.createEl("button", {
      text: "📋 Copy",
      cls: "auto-oc-btn-secondary",
    });
    btnCopy.onclick = () => {
      navigator.clipboard.writeText(this.content);
      new Notice("Log copied.");
    };

    const btnClose = toolbar.createEl("button", {
      text: "✖ Close",
      cls: "auto-oc-btn-secondary",
    });
    btnClose.onclick = () => this.close();

    const renderEl = contentEl.createDiv("auto-oc-log-rendered markdown-rendered");
    void MarkdownRenderer.render(this.app, this.content, renderEl, "", this.plugin);
    renderEl.scrollTop = renderEl.scrollHeight;
  }

  onClose() {
    this.contentEl.empty();
  }
}

class BranchSelectorModal extends Modal {
  private branches: string[];
  private selectedBranch: string | null = null;
  private resolveSelection: ((branch: string | null) => void) | null = null;

  constructor(app: App, branches: string[]) {
    super(app);
    this.branches = branches;
  }

  async open(): Promise<string | null> {
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
    this.contentEl.empty();
    this.resolveSelection?.(this.selectedBranch);
    this.resolveSelection = null;
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

// ─── OpenCode CLI Launcher Modal ──────────────────────────────────────────────

class OpenCodeCliModal extends Modal {
  private plugin: AutoOCPlugin;

  constructor(app: App, plugin: AutoOCPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("auto-oc-cli-modal");
    setupModalX(this);

    contentEl.createEl("h3", { text: "OpenCode CLI Launcher" });
    contentEl.createEl("p", {
      text: "Choose where to open the OpenCode terminal.",
      cls: "setting-item-description",
    });

    const vaultCwd = (this.app.vault.adapter as any).basePath || ".";
    const defaultCwd = this.plugin.settings.workingDirectory || vaultCwd;

    const buttons = contentEl.createDiv("auto-oc-cli-modal-buttons");

    const btnDefault = buttons.createEl("button", {
      text: "📂 Open in project / vault",
      cls: "auto-oc-btn-primary",
    });
    btnDefault.onclick = () => this.launch(defaultCwd);

    contentEl.createEl("p", {
      text: defaultCwd,
      cls: "setting-item-description auto-oc-cli-path",
    });

    const btnChoose = buttons.createEl("button", {
      text: "🗀 Choose folder…",
      cls: "auto-oc-btn-secondary",
    });
    btnChoose.onclick = async () => {
      const chosen = await this.chooseFolder();
      if (chosen) this.launch(chosen);
    };

    const btnCancel = buttons.createEl("button", {
      text: "Cancel",
      cls: "auto-oc-btn-secondary",
    });
    btnCancel.onclick = () => this.close();
  }

  private launch(cwd: string) {
    try {
      const bin = resolveOpencodeBin(this.plugin.settings.opencodePath);
      openOpencodeCli(bin, cwd);
      new Notice(`AutoCO: opened OpenCode CLI in ${cwd}`);
      this.close();
    } catch (e) {
      new Notice(`AutoOC: could not open OpenCode CLI: ${String(e)}`);
    }
  }

  private async chooseFolder(): Promise<string | null> {
    try {
      // @ts-ignore — Electron API available on desktop Obsidian
      const electron = window.require("electron");
      const result = await electron.remote.dialog.showOpenDialog({
        properties: ["openDirectory"],
        title: "Select folder for OpenCode CLI",
      });
      if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
      }
    } catch (e) {
      new Notice(`AutoOC: folder picker failed — ${String(e)}`);
    }
    return null;
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
    setupModalX(this);

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
          `$p = Start-Process -FilePath '${bin.replace(/'/g, "''")}' -ArgumentList 'run','-m','${model}','--dangerously-skip-permissions','--','di hola' -RedirectStandardOutput $outTmp -RedirectStandardError $errTmp -Wait -NoNewWindow -PassThru`,
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

    containerEl.createEl("h3", { text: "Logging" });
    containerEl.createEl("p", {
      text: "Logs are saved to `.opencode/logs/{task-id}/` in your vault. Each execution creates a timestamped log file.",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("Enable Log Persistence")
      .setDesc("Save task logs to files when execution completes")
      .addToggle((tog) =>
        tog
          .setValue(this.plugin.settings.logsEnabled)
          .onChange(async (v) => {
            this.plugin.settings.logsEnabled = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Max Logs Per Task")
      .setDesc("Maximum number of log files to keep per task (0 = unlimited)")
      .addText((text) =>
        text
          .setPlaceholder("50")
          .setValue(String(this.plugin.settings.maxLogsPerTask ?? 50))
          .onChange(async (v) => {
            const n = parseInt(v, 10);
            if (!isNaN(n) && n >= 0) {
              this.plugin.settings.maxLogsPerTask = n;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Log Retention (days)")
      .setDesc("Delete logs older than this many days (0 = no age limit)")
      .addText((text) =>
        text
          .setPlaceholder("30")
          .setValue(String(this.plugin.settings.logRetentionDays ?? 30))
          .onChange(async (v) => {
            const n = parseInt(v, 10);
            if (!isNaN(n) && n >= 0) {
              this.plugin.settings.logRetentionDays = n;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Clear All Logs")
      .setDesc("Delete all log files for every task")
      .addButton((btn) =>
        btn
          .setButtonText("🧹 Clear All Logs")
          .setWarning()
          .onClick(async () => {
            if (confirm("Delete ALL log files for ALL tasks? This cannot be undone.")) {
              await this.plugin.clearAllLogs();
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
      .setName("Default Agent")
      .setDesc(`Agent used by default (${this.plugin.availableAgents.length} loaded)`)
      .addDropdown((dd) => {
        const agents = this.plugin.availableAgents;
        agents.forEach((a) => dd.addOption(a.value, a.label));
        const current = this.plugin.getEffectiveAgent();
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
      text: "🔄 Reload Agent List",
      cls: "auto-oc-btn-secondary",
    });
    refreshAgentsBtn.style.marginBottom = "8px";
    refreshAgentsBtn.onclick = () => {
      this.plugin.refreshAgents();
      new Notice(`AutoOC: ${this.plugin.availableAgents.length} agents loaded.`);
      this.display();
    };
    containerEl.createEl("p", {
      text: `${this.plugin.availableAgents.length} agents loaded from \`opencode agent list\``,
      cls: "setting-item-description",
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
