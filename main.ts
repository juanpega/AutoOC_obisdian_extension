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
import { spawn, exec, execFile } from "child_process";
import * as os from "os";

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
  createdAt: string;       // ISO string
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

// Fallback si opencode no responde aún
const FALLBACK_MODELS = [
  { value: "spark-reasoning/reasoning", label: "spark-reasoning/reasoning" },
  { value: "spark-coder/coder",         label: "spark-coder/coder" },
  { value: "rndia/qwen3.6:35b",         label: "rndia/qwen3.6:35b" },
];

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
  defaultModel: "spark-reasoning/reasoning",
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
    // Carga modelos de forma asíncrona para no bloquear el arranque
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
      name: "Abrir AutoOC Task Scheduler",
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: "create-task",
      name: "Crear nueva tarea OpenCode",
      callback: () => new CreateTaskModal(this.app, this).open(),
    });

    this.addCommand({
      id: "check-tasks-now",
      name: "Comprobar tareas pendientes ahora",
      callback: async () => {
        await this.runDueTasks();
        new Notice("AutoOC: comprobación completada.");
      },
    });

    this.addCommand({
      id: "diagnose",
      name: "AutoOC: Diagnóstico — probar comando opencode",
      callback: () => new DiagnosticModal(this.app, this).open(),
    });

    this.addSettingTab(new AutoOCSettingTab(this.app, this));

    // Scheduler: comprueba cada 60 segundos
    this.registerInterval(
      window.setInterval(() => this.runDueTasks(), 60_000)
    );

    // Comprobación inicial tras arrancar (5 s de margen para que cargue Obsidian)
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
      this.view?.refresh();
    }
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

    new Notice(`AutoOC: ejecutando "${task.name}"…`);

    const args = this.buildArgs(this.settings.tasks[idx]);
    const bin   = args[0]; // opencode.cmd full path
    const prompt = args[2];
    const model  = args[4];
    const safePrompt = prompt.replace(/'/g, "''"); // escape for PS single-quoted string

    const tmpDir = require("os").tmpdir();
    const outFile = require("path").join(tmpDir, `autooc-${task.id}.txt`);
    const pidFile = require("path").join(tmpDir, `autooc-${task.id}.pid`);
    const fs = require("fs");

    // Clean up any previous temp files
    try { fs.unlinkSync(outFile); } catch { /* ignore */ }
    try { fs.unlinkSync(pidFile); } catch { /* ignore */ }

    // PS script: Start-Process in ONE line (multi-line breaks PS argument parsing)
    const psScript = [
      `$env:USERPROFILE = '${process.env.USERPROFILE}'`,
      `$env:APPDATA     = '${process.env.APPDATA}'`,
      `$env:LOCALAPPDATA= '${process.env.LOCALAPPDATA}'`,
      `$env:PATH        = '${process.env.PATH}'`,
      `$env:HOME        = '${process.env.USERPROFILE}'`,
      `Set-Location '${((this.app.vault.adapter as any).basePath || ".").replace(/'/g, "''")}'`,
      `$outTmp = [System.IO.Path]::GetTempFileName()`,
      `$errTmp = [System.IO.Path]::GetTempFileName()`,
      `$p = Start-Process -FilePath '${bin.replace(/'/g, "''")}' -ArgumentList 'run','${safePrompt}','-m','${model}','--dangerously-skip-permissions' -RedirectStandardOutput $outTmp -RedirectStandardError $errTmp -Wait -NoNewWindow -PassThru`,
      `$stdout = Get-Content $outTmp -Raw -ErrorAction SilentlyContinue`,
      `$stderr = Get-Content $errTmp -Raw -ErrorAction SilentlyContinue`,
      `Remove-Item $outTmp,$errTmp -ErrorAction SilentlyContinue`,
      `$code = $p.ExitCode`,
      `$combined = ($stdout + $(if($stderr){"\n[stderr]\n" + $stderr}else{""})).Trim()`,
      `[System.IO.File]::WriteAllText('${outFile.replace(/'/g, "''")}', $combined + "\nDONE:$code")`,
    ].join("\n");

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
      t.output += "\n[tarea detenida manualmente]";
      await this.saveSettings();
    }
    new Notice(`AutoOC: ⏹ Tarea detenida.`);
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

  render() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("auto-oc-view");

    // ── Header ──
    const header = containerEl.createDiv("auto-oc-header");
    header.createEl("h4", { text: "⏰ AutoOC Scheduler" });

    const btnRow = header.createDiv("auto-oc-btn-row");

    const btnNew = btnRow.createEl("button", {
      text: "+ Nueva tarea",
      cls: "auto-oc-btn-primary",
    });
    btnNew.onclick = () => new CreateTaskModal(this.app, this.plugin).open();

    const btnCheck = btnRow.createEl("button", {
      text: "▶ Comprobar ahora",
      cls: "auto-oc-btn-secondary",
    });
    btnCheck.onclick = async () => {
      await this.plugin.runDueTasks();
      new Notice("AutoOC: comprobación completada.");
    };

    // ── Stats bar ──
    const tasks = this.plugin.settings.tasks;
    const stats = containerEl.createDiv("auto-oc-stats");
    const pending = tasks.filter((t) => t.status === "pending").length;
    const running = tasks.filter((t) => t.status === "running").length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const failed = tasks.filter((t) => t.status === "failed").length;
    stats.createEl("span", { text: `${tasks.length} tareas` });
    if (running > 0) stats.createEl("span", { text: `🟡 ${running} ejecutando`, cls: "auto-oc-stat-running" });
    if (failed > 0) stats.createEl("span", { text: `🔴 ${failed} fallidas`, cls: "auto-oc-stat-failed" });
    if (completed > 0) stats.createEl("span", { text: `🟢 ${completed} completadas` });

    // ── Task list ──
    if (tasks.length === 0) {
      containerEl.createEl("p", {
        text: 'No hay tareas programadas. Crea una con "+ Nueva tarea".',
        cls: "auto-oc-empty",
      });
      return;
    }

    const list = containerEl.createDiv("auto-oc-list");
    // Mostrar más recientes primero
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
      scheduleText = `🔁 Cada día a las ${task.scheduleTime}`;
    } else {
      const days = task.scheduleDays.map((d) => DAY_NAMES[d]).join(", ");
      scheduleText = `🔁 ${days || "ningún día"} a las ${task.scheduleTime}`;
    }
    meta.createEl("span", { text: scheduleText });

    if (task.lastRun) {
      meta.createEl("span", { text: `⏱ Último: ${formatDateTime(task.lastRun)}` });
    }

    if (task.useRalphLoop) {
      meta.createEl("span", { text: "♻️ Ralph Loop activo", cls: "auto-oc-ralph-badge" });
    }

    // Prompt preview
    const preview = card.createDiv("auto-oc-prompt-preview");
    preview.createEl("span", {
      text: task.prompt.slice(0, 140) + (task.prompt.length > 140 ? "…" : ""),
    });

    // Action buttons
    const actions = card.createDiv("auto-oc-card-actions");

    const btnRun = actions.createEl("button", {
      text: task.status === "running" ? "⏳ Ejecutando…" : "▶ Ejecutar",
      cls: "auto-oc-btn-run",
    });
    btnRun.disabled = task.status === "running";
    btnRun.onclick = () => this.plugin.runTask(task);

    // Stop button — only when running
    if (task.status === "running") {
      const btnStop = actions.createEl("button", {
        text: "⏹ Parar",
        cls: "auto-oc-btn-stop",
      });
      btnStop.title = "Terminar el proceso ahora";
      btnStop.onclick = async () => {
        btnStop.disabled = true;
        btnStop.textContent = "Parando…";
        await this.plugin.killTask(task.id);
      };
    }

    // Log button — always visible; live-refresh when running
    const btnLog = actions.createEl("button", {
      text: task.status === "running" ? "📡 Log en vivo" : "📄 Log",
      cls: task.status === "running" ? "auto-oc-btn-log-live" : "auto-oc-btn-output",
    });
    btnLog.disabled = !task.output && task.status !== "running";
    btnLog.title = task.output ? "" : "Aún no hay output";
    btnLog.onclick = () => new LiveLogModal(this.app, task, this.plugin).open();

    const btnCmd = actions.createEl("button", {
      text: "🔍 Comando",
      cls: "auto-oc-btn-cmd",
    });
    btnCmd.onclick = () => {
      const cmd = this.plugin.buildCommand(task);
      new CommandPreviewModal(this.app, task.name, cmd).open();
    };

    const btnEdit = actions.createEl("button", {
      text: "✏️ Editar",
      cls: "auto-oc-btn-edit",
    });
    btnEdit.onclick = () =>
      new CreateTaskModal(this.app, this.plugin, task).open();

    const btnDelete = actions.createEl("button", {
      text: "🗑",
      cls: "auto-oc-btn-delete",
    });
    btnDelete.title = "Eliminar tarea";
    btnDelete.onclick = async () => {
      if (confirm(`¿Eliminar tarea "${task.name}"?`)) {
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
          model: plugin.settings.defaultModel,
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
    contentEl.createEl("h3", {
      text: this.editTask ? "Editar tarea" : "Nueva tarea OpenCode",
    });

    new Setting(contentEl)
      .setName("Nombre")
      .setDesc("Identificador corto de la tarea")
      .addText((text) =>
        text.setValue(this.draft.name ?? "").onChange((v) => (this.draft.name = v))
      );

    new Setting(contentEl)
      .setName("Prompt / Goal")
      .setDesc("Texto que se enviará a OpenCode")
      .addTextArea((ta) => {
        ta.setValue(this.draft.prompt ?? "").onChange((v) => (this.draft.prompt = v));
        ta.inputEl.rows = 5;
        ta.inputEl.style.width = "100%";
      });

    new Setting(contentEl)
      .setName("Modelo")
      .setDesc("Modelo de IA a usar")
      .addDropdown((dd) => {
        const models = this.plugin.availableModels;
        models.forEach((m) => dd.addOption(m.value, m.label));
        const current = this.draft.model ?? this.plugin.settings.defaultModel;
        // Asegúrate de que el valor guardado esté en la lista
        if (!models.find((m) => m.value === current)) {
          dd.addOption(current, current);
        }
        dd.setValue(current);
        dd.onChange((v) => (this.draft.model = v));
      });

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText("🔄 Refrescar modelos").onClick(() => {
          this.plugin.refreshModels();
          new Notice("AutoOC: modelos actualizados. Vuelve a abrir el diálogo.");
        })
      );

    new Setting(contentEl)
      .setName("Ralph Loop")
      .setDesc("Envuelve el prompt con /ralph-loop para continuar automáticamente hasta DONE")
      .addToggle((tog) => {
        tog.setValue(this.draft.useRalphLoop ?? false);
        tog.onChange((v) => (this.draft.useRalphLoop = v));
      });

    new Setting(contentEl)
      .setName("Tipo de schedule")
      .addDropdown((dd) => {
        dd.addOption("once", "Una vez (fecha y hora concretas)");
        dd.addOption("daily", "Cada día (hora fija)");
        dd.addOption("weekly", "Días de la semana");
        dd.setValue(this.draft.scheduleType ?? "once");
        dd.onChange((v) => {
          this.draft.scheduleType = v as ScheduleType;
          this.onOpen(); // re-render para mostrar campos relevantes
        });
      });

    // Fecha — solo para 'once'
    if (this.draft.scheduleType === "once") {
      new Setting(contentEl)
        .setName("Fecha")
        .setDesc("Formato YYYY-MM-DD")
        .addText((text) =>
          text
            .setPlaceholder(todayString())
            .setValue(this.draft.scheduleDate ?? "")
            .onChange((v) => (this.draft.scheduleDate = v))
        );
    }

    // Días — solo para 'weekly'
    if (this.draft.scheduleType === "weekly") {
      const daySetting = new Setting(contentEl).setName("Días de la semana");
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
          // Etiqueta junto al toggle
          tog.toggleEl.insertAdjacentHTML(
            "afterend",
            `<span class="auto-oc-day-label">${name}</span>`
          );
        });
      });
    }

    new Setting(contentEl)
      .setName("Hora")
      .setDesc("Formato HH:MM (24 h)")
      .addText((text) =>
        text
          .setPlaceholder("09:00")
          .setValue(this.draft.scheduleTime ?? "")
          .onChange((v) => (this.draft.scheduleTime = v))
      );

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText(this.editTask ? "Guardar cambios" : "Crear tarea")
        .setCta()
        .onClick(async () => {
          if (!this.draft.name?.trim()) {
            new Notice("El nombre es obligatorio.");
            return;
          }
          if (!this.draft.prompt?.trim()) {
            new Notice("El prompt es obligatorio.");
            return;
          }
          if (!/^\d{2}:\d{2}$/.test(this.draft.scheduleTime ?? "")) {
            new Notice("Hora inválida. Usa formato HH:MM.");
            return;
          }
          if (
            this.draft.scheduleType === "once" &&
            !/^\d{4}-\d{2}-\d{2}$/.test(this.draft.scheduleDate ?? "")
          ) {
            new Notice("Fecha inválida. Usa formato YYYY-MM-DD.");
            return;
          }

          if (this.editTask) {
            const idx = this.plugin.settings.tasks.findIndex(
              (t) => t.id === this.editTask!.id
            );
            if (idx !== -1) {
              this.plugin.settings.tasks[idx] = {
                ...this.editTask,
                ...(this.draft as ScheduledTask),
              };
            }
          } else {
            const task: ScheduledTask = {
              id: generateId(),
              name: this.draft.name!,
              prompt: this.draft.prompt!,
              model: this.draft.model ?? this.plugin.settings.defaultModel,
              useRalphLoop: this.draft.useRalphLoop ?? false,
              scheduleType: this.draft.scheduleType ?? "once",
              scheduleTime: this.draft.scheduleTime!,
              scheduleDate: this.draft.scheduleDate ?? "",
              scheduleDays: this.draft.scheduleDays ?? [],
              status: "pending",
              lastRun: "",
              output: "",
              createdAt: new Date().toISOString(),
            };
            this.plugin.settings.tasks.push(task);
          }

          await this.plugin.saveSettings();
          new Notice(`Tarea "${this.draft.name}" guardada.`);
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
      elapsedEl.textContent = `⏱ Tiempo transcurrido: ${min}m ${sec}s`;
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
      text: "📋 Copiar",
      cls: "auto-oc-btn-secondary",
    });
    btnCopy.onclick = () => {
      navigator.clipboard.writeText(this.pre?.textContent ?? "");
      new Notice("Log copiado.");
    };

    const btnClear = toolbar.createEl("button", {
      text: "🗑 Limpiar vista",
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
    contentEl.createEl("h3", { text: `Comando: ${this.taskName}` });
    contentEl.createEl("p", {
      text: "Este es el comando CLI que se ejecutará:",
      cls: "setting-item-description",
    });
    const pre = contentEl.createEl("pre", { cls: "auto-oc-output-pre" });
    pre.textContent = this.cmd;

    new Setting(contentEl).addButton((btn) =>
      btn.setButtonText("Copiar").onClick(() => {
        navigator.clipboard.writeText(this.cmd);
        new Notice("Comando copiado.");
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
    contentEl.createEl("h3", { text: "🔧 Diagnóstico AutoOC" });
    contentEl.createEl("p", {
      text: "Prueba el comando opencode directamente desde Obsidian.",
      cls: "setting-item-description",
    });

    const bin = resolveOpencodeBin(this.plugin.settings.opencodePath);
    contentEl.createEl("p", { text: `Binario detectado: ${bin}`, cls: "setting-item-description" });
    contentEl.createEl("p", { text: `Modelo por defecto: ${this.plugin.settings.defaultModel}`, cls: "setting-item-description" });

    new Setting(contentEl).addButton((btn) =>
      btn.setButtonText("▶ Lanzar prueba: 'di hola'").setCta().onClick(() => {
        if (this.logEl) this.logEl.textContent = "[lanzando proceso PowerShell desacoplado…]\n";
        const bin = resolveOpencodeBin(this.plugin.settings.opencodePath);
        const model = this.plugin.settings.defaultModel;
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
    containerEl.createEl("h2", { text: "AutoOC — Configuración" });

    new Setting(containerEl)
      .setName("Ruta de OpenCode CLI")
      .setDesc(
        `Ruta absoluta al ejecutable. Vacío = auto-detectar.\nDetectado ahora: ${resolveOpencodeBin(this.plugin.settings.opencodePath)}`
      )
      .addText((text) => {
        text
          .setPlaceholder("auto-detectar")
          .setValue(this.plugin.settings.opencodePath)
          .onChange(async (v) => {
            this.plugin.settings.opencodePath = v.trim();
            await this.plugin.saveSettings();
          });
        return text;
      })
      .addButton((btn) =>
        btn.setButtonText("🔍 Auto-detectar").onClick(async () => {
          // Busca opencode.cmd / opencode.exe en las rutas npm habituales
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
            new Notice(`AutoOC: ruta configurada → ${found}`);
            this.display(); // re-render para mostrar nuevo valor
          } else {
            new Notice("AutoOC: no se encontró opencode automáticamente. Introduce la ruta manualmente.");
          }
        })
      );

    new Setting(containerEl)
      .setName("Directorio de trabajo")
      .setDesc(
        "Directorio desde el que se lanza OpenCode (vacío = directorio actual del vault)"
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
      .setName("Timeout por tarea (segundos)")
      .setDesc("Si el proceso no termina en este tiempo, se mata automáticamente. Por defecto 1800 s (30 min). Usa 0 para desactivar timeout.")
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

    new Setting(containerEl)
      .setName("Modelo por defecto")
      .addDropdown((dd) => {
        const models = this.plugin.availableModels;
        models.forEach((m) => dd.addOption(m.value, m.label));
        const current = this.plugin.settings.defaultModel;
        if (!models.find((m) => m.value === current)) {
          dd.addOption(current, current);
        }
        dd.setValue(current);
        dd.onChange(async (v) => {
          this.plugin.settings.defaultModel = v;
          await this.plugin.saveSettings();
        });
      });

    containerEl.createEl("h3", { text: "Modelos disponibles" });
    const refreshBtn = containerEl.createEl("button", {
      text: "🔄 Recargar lista de modelos",
      cls: "auto-oc-btn-secondary",
    });
    refreshBtn.style.marginBottom = "8px";
    refreshBtn.onclick = () => {
      this.plugin.refreshModels();
      new Notice("AutoOC: modelos recargados. Recarga este panel.");
      this.display();
    };
    containerEl.createEl("p", {
      text: `${this.plugin.availableModels.length} modelos cargados desde \`opencode models\``,
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
