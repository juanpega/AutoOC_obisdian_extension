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
import * as crypto from "crypto";
// The visual builder is shipped as a self-contained HTML file under
// `util/ui_workflow_builder/index.html`. A pre-build step
// (scripts/inline-visual-builder.mjs) reads the file at build time and
// emits `visualBuilderHtml.generated.ts` with the HTML as a string
// constant. The extension then serves the builder from memory via an
// iframe `srcdoc`, which avoids any file://, path-resolution, or
// sandbox issues. The standalone HTML file is still kept in the repo
// (under `util/`) so the builder can be opened directly in a browser
// for development and testing.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const visualBuilderHtml: string = require("./visualBuilderHtml.generated").visualBuilderHtml;

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

function commandPreviewArg(value: string): string {
  return /^[A-Za-z0-9_@%+=:,./\\-]+$/.test(value) ? value : `"${value.replace(/"/g, '\\"')}"`;
}

function shSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function buildPowerShellEnvLines(env: Record<string, string>): string[] {
  return Object.entries(env)
    .filter(([key]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
    .map(([key, value]) => `$env:${key} = ${psSingleQuoted(value)}`);
}

function openOpencodeCli(bin: string, cwd: string, env: Record<string, string> = {}, args: string[] = []): void {
  if (process.platform === "win32") {
    const envScript = buildPowerShellEnvLines(env).join("; ");
    const runCommand = args.length > 0
      ? `$bin = ${psSingleQuoted(bin)}; $argList = @(${args.map(psSingleQuoted).join(",")}); & $bin @argList`
      : `& ${psSingleQuoted(bin)}`;
    const command = `${envScript ? `${envScript}; ` : ""}Set-Location -LiteralPath ${psSingleQuoted(cwd)}; ${runCommand}`;
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
    const escapedCmd = [bin, ...args].map(shSingleQuoted).join(" ").replace(/(["\\$`])/g, "\\$1");
    const envPrefix = Object.entries(env)
      .filter(([key]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join(" ");
    const script = `tell application "Terminal" to do script "cd ${escapedCwd} && ${envPrefix ? `${envPrefix} ` : ""}${escapedCmd}"`;
    const launcher = spawn("osascript", ["-e", script], { detached: true, stdio: "ignore" });
    launcher.unref();
    return;
  }

  const envPrefix = Object.entries(env)
    .filter(([key]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(" ");
  const command = `cd ${shSingleQuoted(cwd)} && ${envPrefix ? `${envPrefix} ` : ""}${[bin, ...args].map(shSingleQuoted).join(" ")}`;
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
    `sh.Run "powershell.exe -NoLogo -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & "${psScriptFile.replace(/"/g, '""')}" & """", 0, False\r\n`;
  fs.writeFileSync(vbsFile, vbs, "utf8");
  const { spawn } = require("child_process");
  const ws = spawn("wscript.exe", [vbsFile], { detached: true, stdio: "ignore", windowsHide: true });
  ws.unref();
  // Clean up launcher files after PowerShell has had time to read them. This
  // also limits exposure for launch scripts that contain temporary env vars.
  setTimeout(() => { try { fs.unlinkSync(vbsFile); } catch { /* ignore */ } }, 10000);
  setTimeout(() => { try { fs.unlinkSync(psScriptFile); } catch { /* ignore */ } }, 30000);
}

function writeUtf8BomFile(filePath: string, content: string): void {
  fs.writeFileSync(filePath, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(content, "utf8")]));
}

function psUtf8Prelude(): string[] {
  return [
    `$utf8NoBom = New-Object System.Text.UTF8Encoding($false)`,
    `[Console]::OutputEncoding = $utf8NoBom`,
    `$OutputEncoding = $utf8NoBom`,
  ];
}

function setupCodeTextarea(textarea: HTMLTextAreaElement): void {
  textarea.addClass("auto-oc-code-editor");
  textarea.spellcheck = false;
  textarea.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = textarea.value.slice(0, start) + "  " + textarea.value.slice(end);
    textarea.selectionStart = textarea.selectionEnd = start + 2;
    textarea.dispatchEvent(new Event("input"));
  });
}

function renderCodePreview(parent: HTMLElement, code: string, maxChars = 600): void {
  const pre = parent.createEl("pre", { cls: "auto-oc-code-preview" });
  const codeEl = pre.createEl("code");
  const src = (code || "// empty code").slice(0, maxChars);
  const pattern = /(\/\/.*|\/\*[\s\S]*?\*\/|`(?:\\.|[^`])*`|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\b(?:const|let|var|return|if|else|for|while|await|async|function|new|try|catch|throw|true|false|null|undefined)\b|\b\d+(?:\.\d+)?\b)/g;
  let last = 0;
  for (const match of src.matchAll(pattern)) {
    const text = match[0];
    const index = match.index ?? 0;
    if (index > last) codeEl.appendChild(document.createTextNode(src.slice(last, index)));
    const span = codeEl.createSpan();
    span.setText(text);
    if (text.startsWith("//") || text.startsWith("/*")) span.addClass("auto-oc-code-token-comment");
    else if (text.startsWith("'") || text.startsWith('"') || text.startsWith("`")) span.addClass("auto-oc-code-token-string");
    else if (/^\d/.test(text)) span.addClass("auto-oc-code-token-number");
    else span.addClass("auto-oc-code-token-keyword");
    last = index + text.length;
  }
  if (last < src.length) codeEl.appendChild(document.createTextNode(src.slice(last)));
  if ((code || "").length > maxChars) codeEl.appendChild(document.createTextNode("\n..."));
}

const AUTOOC_WORKFLOW_PROMPT = `You are an expert AutoOC assistant. AutoOC is an Obsidian plugin that automates OpenCode CLI tasks and visual workflows. Your goal is to generate valid import-ready AutoOC JSON for tasks and/or workflows.

Always output only one valid JSON object. Do not write explanations outside the final JSON.

Required root format:
{
  "autoOCExport": {
    "schemaVersion": "1.4.0",
    "exportedAt": "ISO timestamp",
    "pluginVersion": "1.5.5",
    "name": "Package name",
    "description": "Short description"
  },
  "tasks": [],
  "workflows": []
}

Available modules:
AutoOC supports DAG workflows with three step kinds:
1. task: runs an OpenCode task prompt.
2. code: runs JavaScript in a sandbox.
3. delay: pauses the workflow.

Tasks:
A task is reusable and can be referenced by workflows.

Task fields:
- exportId: unique within the JSON, for example "task-0".
- taskKind: "opencode" by default, or "code" for a reusable JavaScript task.
- name: short name, preferably snake_case or kebab-case.
- area: optional grouping area.
- prompt: complete direct instruction for OpenCode. For code tasks, mirror the code here for compatibility.
- interactiveTerminal: true only for CLI tasks. CLI tasks are taskKind "opencode" with interactiveTerminal true.
- code, codeLang, codeInputVar, codeOutputVar, codeAllowVault, codeAllowFiles, codeAllowTerminal: only for taskKind "code".
- scheduleType: "manual" | "once" | "daily" | "weekly" | "monthly" | "interval".
- scheduleTime: "HH:MM", use "09:00" if not relevant.
- scheduleDate: "YYYY-MM-DD" or "".
- scheduleDays: array 0-6, Sunday=0.
- scheduleMonthDays: array 1-31.
- scheduleIntervalValue: number, usually 10.
- scheduleIntervalUnit: "seconds" | "minutes" | "hours", usually "minutes".
- useRalphLoop: true only when the task may need iterations until completion.
- agent: "build" by default, "plan" for analysis only, or a custom agent if requested.
- branch: optional git branch, usually "".
- createBranch: true/false.

Do not include model in importable tasks unless the user explicitly asks for it. AutoOC will use the system default model on import.

Code steps and code tasks:
Code runs with vm.runInContext and must always assign output.

Use code for:
- filtering outputs before calling AI
- keyword checks
- JSON transformations
- deciding whether it is worth continuing
- reading/writing the Obsidian vault when permission is enabled
- saving tokens by avoiding large AI inputs

Code fields:
- stepKind: "code" for workflow steps.
- taskKind: "code" for reusable code tasks.
- name: optional display name.
- area: optional grouping area; use the workflow area when applicable.
- code: JavaScript source.
- codeLang: "javascript".
- codeInputVar: usually "input".
- codeOutputVar: usually "output".
- codeAllowVault: true/false.
- codeAllowFiles: true/false.
- codeAllowTerminal: true/false.
- transitions: array of transitions for workflow steps.

Always available in code:
- input: string output from the previous step.
- outputs: map of stepId to output.
- JSON, Math, Date, String, Number, Boolean, Array, Object, RegExp.
- console.log, but do not use it as the main output.

Code timeout is 10 seconds.

Important code rule:
Do not recursively scan an entire vault unless necessary. Large vaults can timeout. Prefer direct likely paths and bounded searches.

For daily notes, try direct paths first:
- Daily_notes/DD-MM-YYYY.md
- Daily Notes/DD-MM-YYYY.md
- Daily/DD-MM-YYYY.md
- Diario/DD-MM-YYYY.md
- Journal/DD-MM-YYYY.md
- DD-MM-YYYY.md

Optional Code APIs:

Vault API, enabled with codeAllowVault: true:
- vault.read("Daily_notes/01-07-2026.md")
- vault.write("path.md", "content")
- vault.append("path.md", "content")
- vault.exists("path.md")
- vault.list("folder")

The vault API is confined to the Obsidian vault.

Local Files API, enabled with codeAllowFiles: true:
- files.read("path")
- files.write("path", "content")
- files.append("path", "content")
- files.exists("path")
- files.list("path")

Use files only if the user explicitly needs access outside the vault.

Terminal API, enabled with codeAllowTerminal: true:
- terminal.run("command", { cwd: "optional", timeoutMs: 30000 })

Use terminal only if it adds clear value and the user allows it.

Delay steps:
{
  "id": "wait-5-min",
  "stepKind": "delay",
  "name": "Wait 5 minutes",
  "area": "Optional area",
  "delayValue": 5,
  "delayUnit": "minutes",
  "transitions": []
}

Workflows:
A workflow chains steps in order or with branching.

Workflow fields:
- exportId: for example "wf-0".
- name.
- area.
- description.
- scheduleType: "manual" | "once" | "daily" | "weekly" | "monthly" | "interval".
- scheduleTime.
- scheduleDate.
- scheduleDays.
- scheduleMonthDays.
- scheduleIntervalValue.
- scheduleIntervalUnit.
- handoffBranch: true if all steps should share a git branch.
- handoffOutput: normally true.
- steps: array of steps.

Task step example:
{
  "id": "step-ai",
  "stepKind": "task",
  "name": "AI analysis",
  "area": "Optional area",
  "taskExportId": "task-0",
  "transitions": []
}

taskExportId must match an existing task exportId.

Transitions:
Each step can have outgoing transitions.

Fields:
- toStepId
- mode: "default" | "force" | "eval" | "conditional"
- evaluatePrompt: only for eval
- condition: only for conditional
- conditionLang: "javascript" when using condition

default: continue only if previous step succeeded.
force: always continue.
eval: ask the model to answer YES/NO.
conditional: evaluate JavaScript against input, outputs, JSON, Math, Date.

Conditional rule:
The condition must be a JavaScript expression without return.
Correct: JSON.parse(input).FOUND === "YES"
Incorrect: return JSON.parse(input).FOUND === "YES";

Design rules:
1. Decide whether the user needs one task or a workflow.
2. Use a workflow when there are multiple phases such as search -> filter -> AI -> write result.
3. Use code steps before AI to save tokens.
4. Do not send large files to AI when code can cheaply detect whether AI is needed.
5. Task prompts must be complete and direct.
6. If useRalphLoop is true, include clear completion criteria.
7. Every task referenced by a workflow must exist in tasks.
8. Every toStepId must exist in steps.
9. Every non-terminal step must have at least one transition.
10. Terminal steps must have "transitions": [].
11. For daily notes or large vaults, avoid full recursive searches.
12. If code needs to read or write the vault, set codeAllowVault: true.
13. If code needs terminal, set codeAllowTerminal: true.
14. If code needs files outside the vault, set codeAllowFiles: true.

Recommended pattern: detect a cheap condition before AI.
1. Code step: find keyword or condition.
2. Conditional transition: FOUND=YES -> AI task; FOUND!=YES -> noop terminal code step.
3. AI task: runs only when needed.
4. Code step: writes or summarizes result if needed.

Final output requirements:
- Output only valid JSON.
- No Markdown.
- No explanations.
- No comments.
- No trailing commas.

Minimal valid workflow example:
{
  "autoOCExport": {
    "schemaVersion": "1.4.0",
    "exportedAt": "2026-07-06T00:00:00.000Z",
    "pluginVersion": "1.5.5",
    "name": "Example package",
    "description": "Example AutoOC import"
  },
  "tasks": [
    {
      "exportId": "task-0",
      "taskKind": "opencode",
      "name": "ai_followup",
      "area": "Automation",
      "prompt": "Complete the requested follow-up using the previous step output as context. Finish only when the result is written or clearly reported.",
      "scheduleType": "manual",
      "scheduleTime": "09:00",
      "scheduleDate": "",
      "scheduleDays": [],
      "scheduleMonthDays": [],
      "scheduleIntervalValue": 10,
      "scheduleIntervalUnit": "minutes",
      "useRalphLoop": false,
      "interactiveTerminal": false,
      "agent": "build",
      "branch": "",
      "createBranch": false
    }
  ],
  "workflows": [
    {
      "exportId": "wf-0",
      "name": "conditional_workflow",
      "area": "Automation",
      "description": "Detects a keyword and only runs AI when needed.",
      "scheduleType": "manual",
      "scheduleTime": "09:00",
      "scheduleDate": "",
      "scheduleDays": [],
      "scheduleMonthDays": [],
      "scheduleIntervalValue": 10,
      "scheduleIntervalUnit": "minutes",
      "handoffBranch": false,
      "handoffOutput": true,
      "steps": [
        {
          "id": "step-0",
          "stepKind": "code",
          "name": "Detect keyword",
          "area": "Automation",
          "code": "output = JSON.stringify({ FOUND: input.includes('keyword') ? 'YES' : 'NO' });",
          "codeLang": "javascript",
          "codeInputVar": "input",
          "codeOutputVar": "output",
          "codeAllowVault": false,
          "codeAllowFiles": false,
          "codeAllowTerminal": false,
          "transitions": [
            {
              "toStepId": "step-1",
              "mode": "conditional",
              "condition": "JSON.parse(input).FOUND === \"YES\"",
              "conditionLang": "javascript"
            },
            {
              "toStepId": "step-noop",
              "mode": "conditional",
              "condition": "JSON.parse(input).FOUND !== \"YES\"",
              "conditionLang": "javascript"
            }
          ]
        },
        {
          "id": "step-1",
          "stepKind": "task",
          "name": "Run AI follow-up",
          "area": "Automation",
          "taskExportId": "task-0",
          "transitions": []
        },
        {
          "id": "step-noop",
          "stepKind": "code",
          "name": "No changes needed",
          "area": "Automation",
          "code": "output = input;",
          "codeLang": "javascript",
          "codeInputVar": "input",
          "codeOutputVar": "output",
          "codeAllowVault": false,
          "codeAllowFiles": false,
          "codeAllowTerminal": false,
          "transitions": []
        }
      ]
    }
  ]
}

Now write the objective for the AutoOC workflow or task you want to generate:`;

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ScheduleType = "manual" | "once" | "daily" | "weekly" | "monthly" | "interval";
type TaskStatus = "pending" | "running" | "completed" | "failed";
type IntervalUnit = "seconds" | "minutes" | "hours";
type TaskKind = "opencode" | "code";

// v1.4 step model: a step can be a task, a delay, or a programmable code block.
// Workflows are no longer strictly linear — each step declares its outgoing
// transitions explicitly, allowing branching and conditional paths.
type StepKind = "task" | "delay" | "code";
type TransitionMode = "default" | "force" | "eval" | "conditional";

interface WorkflowTransition {
  toStepId: string;
  mode: TransitionMode;
  // for "eval" — prompt sent to the model to decide
  evaluatePrompt?: string;
  // for "conditional" — JavaScript expression evaluated against the runtime
  // context (last output available as `input`, all previous outputs as `outputs[stepId]`)
  condition?: string;
  conditionLang?: "javascript";
  forceContinue?: boolean;
}

interface WorkflowStep {
  id: string;
  stepKind: StepKind;
  name?: string;
  area?: string;
  // task-specific
  taskId?: string;
  // legacy fields (used when transitions[] is missing) — kept for back-compat
  transitionMode?: "default" | "force" | "eval";
  evaluatePrompt?: string;
  forceContinue?: boolean;
  // delay-specific
  delayValue?: number;
  delayUnit?: "seconds" | "minutes" | "hours";
  // code-specific (programmable step)
  code?: string;
  codeLang?: "javascript";
  codeInputVar?: string;  // variable name for the input (default "input")
  codeOutputVar?: string; // variable name for the output (default "output")
  codeAllowVault?: boolean;
  codeAllowFiles?: boolean;
  codeAllowTerminal?: boolean;
  status?: TaskStatus;
  lastRun?: string;
  output?: string;
  // DAG
  transitions?: WorkflowTransition[];
  // visual position (used by the visual builder)
  position?: { x: number; y: number };
}

interface ScheduledTask {
  id: string;
  taskKind?: TaskKind;
  name: string;
  area?: string;
  prompt: string;
  model: string;
  agent: string;
  useRalphLoop: boolean;
  scheduleType: ScheduleType;
  scheduleTime: string;    // "HH:MM"
  scheduleDate: string;    // "YYYY-MM-DD" — used in 'once' type
  scheduleDays: number[];  // [0–6] Sun–Sat — used in 'weekly' type
  scheduleMonthDays: number[]; // [1–31] — used in 'monthly' type
  scheduleIntervalValue: number; // e.g. 10 — used in 'interval' type
  scheduleIntervalUnit: IntervalUnit; // seconds | minutes | hours — used in 'interval' type
  status: TaskStatus;
  lastRun: string;         // ISO string
  output: string;
  createdAt: string;       // ISO string;
  workingDirectory?: string; // Optional path override
  branch?: string;           // Git branch name
  createBranch?: boolean;    // Create branch if it doesn't exist
  code?: string;
  codeLang?: "javascript";
  codeInputVar?: string;
  codeOutputVar?: string;
  codeAllowVault?: boolean;
  codeAllowFiles?: boolean;
  codeAllowTerminal?: boolean;
  interactiveTerminal?: boolean;
}

type WorkflowStatus = "pending" | "running" | "completed" | "failed";

interface Workflow {
  id: string;
  name: string;
  area?: string;
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
  scheduleMonthDays: number[];
  scheduleIntervalValue: number;
  scheduleIntervalUnit: IntervalUnit;
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
  defaultInteractiveTerminal: boolean;
  logsEnabled: boolean;
  maxLogsPerTask: number;
  logRetentionDays: number;
  libraryUrl: string;
  dashboardPositions?: Record<string, { x: number; y: number; size?: number; sizePx?: number }>;
}

function getConfiguredAreaNames(settings: Pick<AutoOCSettings, "tasks" | "workflows">): string[] {
  const names = new Set<string>();
  for (const task of settings.tasks) {
    const area = task.area?.trim();
    if (area) names.add(area);
  }
  for (const workflow of settings.workflows) {
    const area = workflow.area?.trim();
    if (area) names.add(area);
    for (const step of workflow.steps || []) {
      const stepArea = step.area?.trim();
      if (stepArea) names.add(stepArea);
    }
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

function renderAreaSuggestions(
  container: HTMLElement,
  areaInput: HTMLInputElement,
  areaNames: string[],
  onSelect: (area: string) => void
): void {
  const wrapper = container.createDiv("auto-oc-area-suggestions");
  wrapper.createDiv("auto-oc-area-suggestions-title").setText(
    areaNames.length > 0
      ? "Existing areas: click one, or type a new area above."
      : "No areas yet. Type a name above to create a new area."
  );

  if (areaNames.length === 0) return;

  const chips = wrapper.createDiv("auto-oc-area-suggestion-chips");
  for (const area of areaNames) {
    const chip = chips.createEl("button", {
      text: area,
      cls: "auto-oc-area-suggestion-chip",
    });
    chip.type = "button";
    chip.onclick = () => {
      areaInput.value = area;
      onSelect(area);
    };
  }
}

// Portable representation for import / export.
// Intentionally excludes machine/runtime-specific fields:
//   - internal id, status, lastRun, output, createdAt
//   - model (taken from the importer's system default)
//   - workingDirectory (taken from the importer's settings / vault)
interface ExportTask {
  exportId: string;
  taskKind?: TaskKind;
  name: string;
  area?: string;
  prompt: string;
  code?: string;
  codeLang?: "javascript";
  codeInputVar?: string;
  codeOutputVar?: string;
  codeAllowVault?: boolean;
  codeAllowFiles?: boolean;
  codeAllowTerminal?: boolean;
  interactiveTerminal?: boolean;
  scheduleType: ScheduleType;
  scheduleTime: string;
  scheduleDate: string;
  scheduleDays: number[];
  scheduleMonthDays: number[];
  scheduleIntervalValue: number;
  scheduleIntervalUnit: IntervalUnit;
  useRalphLoop: boolean;
  agent: string;
  branch?: string;
  createBranch?: boolean;
}

interface ExportWorkflowTransition {
  toStepId: string;
  mode: TransitionMode;
  evaluatePrompt?: string;
  condition?: string;
  conditionLang?: "javascript";
  forceContinue?: boolean;
}

interface ExportWorkflowStep {
  id: string;
  stepKind: StepKind;
  name?: string;
  area?: string;
  // task
  taskExportId?: string;
  transitionMode?: "default" | "force" | "eval";
  evaluatePrompt?: string;
  forceContinue?: boolean;
  // delay
  delayValue?: number;
  delayUnit?: "seconds" | "minutes" | "hours";
  // code
  code?: string;
  codeLang?: "javascript";
  codeInputVar?: string;
  codeOutputVar?: string;
  codeAllowVault?: boolean;
  codeAllowFiles?: boolean;
  codeAllowTerminal?: boolean;
  // DAG
  transitions?: ExportWorkflowTransition[];
  // visual position
  position?: { x: number; y: number };
}

interface ExportWorkflow {
  exportId: string;
  name: string;
  area?: string;
  description?: string;
  scheduleType: ScheduleType;
  scheduleTime: string;
  scheduleDate: string;
  scheduleDays: number[];
  scheduleMonthDays: number[];
  scheduleIntervalValue: number;
  scheduleIntervalUnit: IntervalUnit;
  handoffBranch?: boolean;
  handoffOutput?: boolean;
  steps: ExportWorkflowStep[];
}

interface AutoOCExportFile {
  autoOCExport: {
    schemaVersion: string;
    exportedAt: string;
    pluginVersion: string;
    name?: string;
    description?: string;
  };
  tasks: ExportTask[];
  workflows: ExportWorkflow[];
}

interface LibraryEntry {
  name: string;
  description?: string;
  file: string;
}

interface LibraryIndex {
  schemaVersion: string;
  library: LibraryEntry[];
}

type SecretType = "token" | "api_key" | "username" | "password" | "cookie" | "basic_auth" | "custom";

interface SecretRecord {
  id: string;
  name: string;
  envName: string;
  type: SecretType;
  profile: string;
  encryptedValue: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface SecretsVaultPin {
  enabled: boolean;
  salt: string;
  hash: string;
}

interface SecretsVault {
  schemaVersion: number;
  pin?: SecretsVaultPin;
  secrets: SecretRecord[];
}

const SECRET_TYPES: SecretType[] = ["token", "api_key", "username", "password", "cookie", "basic_auth", "custom"];
const SECRETS_SCHEMA_VERSION = 1;
const SECRETS_UNLOCK_MS = 5 * 60 * 1000;

function normalizeEnvName(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  const prefixed = cleaned.startsWith("AUTOOC_") ? cleaned : `AUTOOC_${cleaned || "SECRET"}`;
  return /^[A-Za-z_]/.test(prefixed) ? prefixed : `AUTOOC_${prefixed}`;
}

function hashSecretPin(pin: string, salt: string): string {
  return crypto.pbkdf2Sync(pin, salt, 120_000, 32, "sha256").toString("base64");
}

function timingSafeEqualText(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  return aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);
}

function tryGetSafeStorage(): any | null {
  try {
    const electron = typeof window !== "undefined" && (window as any).require
      ? (window as any).require("electron")
      : require("electron");
    const safeStorage = electron?.safeStorage || electron?.remote?.safeStorage;
    if (safeStorage?.isEncryptionAvailable?.()) return safeStorage;
  } catch { /* ignore */ }
  return null;
}

class SecretStore {
  private vault: SecretsVault = { schemaVersion: SECRETS_SCHEMA_VERSION, secrets: [] };
  private unlockedUntil = 0;

  constructor(private vaultBasePath: string) {}

  get filePath(): string {
    return path.join(this.vaultBasePath, ".obsidian", "plugins", "auto-oc", "secrets.vault.json");
  }

  load(): void {
    const file = this.filePath;
    if (!fs.existsSync(file)) {
      this.vault = { schemaVersion: SECRETS_SCHEMA_VERSION, secrets: [] };
      return;
    }
    const raw = fs.readFileSync(file, "utf8");
    const parsed = raw.trim() ? JSON.parse(raw) : {};
    this.vault = {
      schemaVersion: parsed.schemaVersion || SECRETS_SCHEMA_VERSION,
      pin: parsed.pin,
      secrets: Array.isArray(parsed.secrets) ? parsed.secrets : [],
    };
  }

  save(): void {
    const file = this.filePath;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(this.vault, null, 2)}\n`, "utf8");
  }

  isSecureStorageAvailable(): boolean {
    return !!tryGetSafeStorage();
  }

  hasPin(): boolean {
    return !!this.vault.pin?.enabled && !!this.vault.pin.hash && !!this.vault.pin.salt;
  }

  isUnlocked(): boolean {
    return !this.hasPin() || Date.now() < this.unlockedUntil;
  }

  lock(): void {
    this.unlockedUntil = 0;
  }

  verifyPin(pin: string): boolean {
    const pinData = this.vault.pin;
    if (!pinData?.enabled) return true;
    const hash = hashSecretPin(pin, pinData.salt);
    const ok = timingSafeEqualText(hash, pinData.hash);
    if (ok) this.unlockedUntil = Date.now() + SECRETS_UNLOCK_MS;
    return ok;
  }

  setPin(pin: string): void {
    const salt = crypto.randomBytes(16).toString("base64");
    this.vault.pin = { enabled: true, salt, hash: hashSecretPin(pin, salt) };
    this.unlockedUntil = Date.now() + SECRETS_UNLOCK_MS;
    this.save();
  }

  resetPin(): void {
    delete this.vault.pin;
    this.unlockedUntil = 0;
    this.save();
  }

  list(): SecretRecord[] {
    return [...this.vault.secrets].sort((a, b) => a.name.localeCompare(b.name));
  }

  encryptValue(value: string): string {
    const safeStorage = tryGetSafeStorage();
    if (!safeStorage) throw new Error("Secure storage is not available on this system.");
    return Buffer.from(safeStorage.encryptString(value)).toString("base64");
  }

  decryptValue(record: SecretRecord): string {
    const safeStorage = tryGetSafeStorage();
    if (!safeStorage) throw new Error("Secure storage is not available on this system.");
    return safeStorage.decryptString(Buffer.from(record.encryptedValue, "base64"));
  }

  upsert(input: { id?: string; name: string; envName: string; type: SecretType; profile: string; value?: string; notes?: string }): void {
    const now = new Date().toISOString();
    const existing = input.id ? this.vault.secrets.find((s) => s.id === input.id) : undefined;
    if (existing) {
      existing.name = input.name.trim();
      existing.envName = normalizeEnvName(input.envName || input.name);
      existing.type = input.type;
      existing.profile = input.profile.trim() || "default";
      existing.notes = input.notes || "";
      existing.updatedAt = now;
      if (input.value !== undefined) existing.encryptedValue = this.encryptValue(input.value);
    } else {
      this.vault.secrets.push({
        id: generateId(),
        name: input.name.trim(),
        envName: normalizeEnvName(input.envName || input.name),
        type: input.type,
        profile: input.profile.trim() || "default",
        encryptedValue: this.encryptValue(input.value || ""),
        notes: input.notes || "",
        createdAt: now,
        updatedAt: now,
      });
    }
    this.save();
  }

  delete(id: string): void {
    this.vault.secrets = this.vault.secrets.filter((s) => s.id !== id);
    this.save();
  }

  getEnv(profile = "default"): Record<string, string> {
    const result: Record<string, string> = {};
    for (const secret of this.vault.secrets) {
      if (secret.profile && secret.profile !== "default" && secret.profile !== profile) continue;
      result[secret.envName] = this.decryptValue(secret);
    }
    return result;
  }

  getRedactionValues(): string[] {
    const values: string[] = [];
    for (const secret of this.vault.secrets) {
      try {
        const value = this.decryptValue(secret);
        if (value && value.length >= 4) values.push(value);
      } catch { /* ignore */ }
    }
    return values;
  }
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
  taskTimeoutSeconds: 7200,  // 2 h default
  defaultInteractiveTerminal: false,
  logsEnabled: true,
  maxLogsPerTask: 50,
  logRetentionDays: 30,
  libraryUrl: "https://raw.githubusercontent.com/juanpega/AutoOC_obisdian_extension/main/library",
  dashboardPositions: {},
};

export const VIEW_TYPE = "auto-oc-view";
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const INITIAL_DUE_CHECK_DELAY_MS = 30_000;
const DUE_LAUNCH_GAP_MS = 10_000;
const DEFAULT_TASK_TIMEOUT_SECONDS = 7200;

function isDayScheduleDue(now: Date, scheduleTime: string, lastRun?: string): boolean {
  const [hh, mm] = scheduleTime.split(":").map(Number);
  const todayTarget = new Date(now);
  todayTarget.setHours(hh, mm, 0, 0);
  if (now < todayTarget) return false;
  if (!lastRun) return true;
  return new Date(lastRun).toDateString() !== now.toDateString();
}

function intervalToMs(value: number, unit: IntervalUnit): number {
  const multiplier: Record<IntervalUnit, number> = {
    seconds: 1000,
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
  };
  return Math.max(1, value) * multiplier[unit];
}

function parseMonthDays(input: string): number[] | null {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/[;,\s]+/).filter(Boolean);
  const days = parts.map((part) => Number(part));
  if (days.some((day) => !Number.isInteger(day) || day < 1 || day > 31)) return null;
  return [...new Set(days)].sort((a, b) => a - b);
}

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

// Make a modal take nearly the full viewport, centered. Used by the
// Visual Builder modal so it feels like a real editor rather than a
// cramped sidebar leaf.
function setAutoOCModalFullscreen(modal: Modal): void {
  const modalEl = (modal as any).modalEl as HTMLElement | undefined;
  if (!modalEl) return;
  modalEl.style.width = "min(1400px, calc(100vw - 40px))";
  modalEl.style.height = "calc(100vh - 80px)";
  modalEl.style.maxWidth = "calc(100vw - 40px)";
  modalEl.style.maxHeight = "calc(100vh - 40px)";
  modalEl.style.overflow = "hidden";
  modalEl.addClass("auto-oc-fullscreen-modal");
  // The modal's content panel is a flex child of the modal. Make it grow
  // to fill the modal's body and become a vertical flex container for
  // the toolbar + iframe. Without `flex: 1` the content panel would
  // collapse to its intrinsic height and the iframe (which is 100% of
  // its parent) would render at a tiny default size.
  modal.contentEl.style.flex = "1 1 auto";
  modal.contentEl.style.minHeight = "0";
  modal.contentEl.style.width = "100%";
  modal.contentEl.style.height = "auto";
  modal.contentEl.style.maxWidth = "100%";
  modal.contentEl.style.padding = "0";
  modal.contentEl.style.overflow = "hidden";
  modal.contentEl.style.display = "flex";
  modal.contentEl.style.flexDirection = "column";
  modal.contentEl.style.boxSizing = "border-box";
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

// Convert a GitHub repo / tree / blob URL into a raw.githubusercontent.com URL.
// Already-raw URLs are returned unchanged. Falls back to the configured default.
function normalizeLibraryUrl(input: string): string {
  if (!input) return DEFAULT_SETTINGS.libraryUrl;
  if (input.startsWith("https://raw.githubusercontent.com/")) return input;
  const match = input.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/(?:tree|blob)\/([^/]+)(?:\/(.*))?)?\/?$/
  );
  if (match) {
    const [, owner, repo, branch = "main", subPath = "library"] = match;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${subPath}`;
  }
  return input;
}

function getLibraryIndexUrl(baseUrl: string): string {
  return `${normalizeLibraryUrl(baseUrl).replace(/\/$/, "")}/index.json`;
}

function getLibraryFileUrl(baseUrl: string, fileName: string): string {
  return `${normalizeLibraryUrl(baseUrl).replace(/\/$/, "")}/${fileName}`;
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

// Helper for the Visual Builder apply path: prefer the incoming value, fall
// back to the existing one when the field was not sent. Avoids losing data
// when the iframe payload is missing optional fields.
function t_or_undef<T>(incoming: T | undefined, fallback: T): T {
  return incoming === undefined ? fallback : incoming;
}

function toExportTask(task: ScheduledTask, exportId: string): ExportTask {
  return {
    exportId,
    taskKind: task.taskKind,
    name: task.name,
    area: task.area,
    prompt: task.prompt,
    code: task.code,
    codeLang: task.codeLang,
    codeInputVar: task.codeInputVar,
    codeOutputVar: task.codeOutputVar,
    codeAllowVault: task.codeAllowVault,
    codeAllowFiles: task.codeAllowFiles,
    codeAllowTerminal: task.codeAllowTerminal,
    interactiveTerminal: task.interactiveTerminal,
    scheduleType: task.scheduleType,
    scheduleTime: task.scheduleTime,
    scheduleDate: task.scheduleDate,
    scheduleDays: task.scheduleDays,
    scheduleMonthDays: task.scheduleMonthDays || [],
    scheduleIntervalValue: task.scheduleIntervalValue ?? 10,
    scheduleIntervalUnit: task.scheduleIntervalUnit ?? "minutes",
    useRalphLoop: task.useRalphLoop,
    agent: task.agent,
    branch: task.branch,
    createBranch: task.createBranch,
  };
}

function toExportWorkflow(
  workflow: Workflow,
  exportId: string,
  taskExportIdMap: Map<string, string>
): ExportWorkflow {
  return {
    exportId,
    name: workflow.name,
    area: workflow.area,
    description: workflow.description,
    scheduleType: workflow.scheduleType,
    scheduleTime: workflow.scheduleTime,
    scheduleDate: workflow.scheduleDate,
    scheduleDays: workflow.scheduleDays,
    scheduleMonthDays: workflow.scheduleMonthDays || [],
    scheduleIntervalValue: workflow.scheduleIntervalValue ?? 10,
    scheduleIntervalUnit: workflow.scheduleIntervalUnit ?? "minutes",
    handoffBranch: workflow.handoffBranch,
    handoffOutput: workflow.handoffOutput,
    steps: workflow.steps.map((step) => ({
      id: step.id,
      stepKind: step.stepKind || "task",
      name: step.name,
      area: step.area,
      taskExportId: step.taskId ? (taskExportIdMap.get(step.taskId) ?? "") : undefined,
      transitionMode: step.transitionMode,
      evaluatePrompt: step.evaluatePrompt,
      forceContinue: step.forceContinue,
      delayValue: step.delayValue,
      delayUnit: step.delayUnit,
      code: step.code,
      codeLang: step.codeLang,
      codeInputVar: step.codeInputVar,
      codeOutputVar: step.codeOutputVar,
      codeAllowVault: step.codeAllowVault,
      codeAllowFiles: step.codeAllowFiles,
      codeAllowTerminal: step.codeAllowTerminal,
      transitions: step.transitions && step.transitions.length > 0
        ? step.transitions.map((t) => ({
            toStepId: t.toStepId,
            mode: t.mode,
            evaluatePrompt: t.evaluatePrompt,
            condition: t.condition,
            conditionLang: t.conditionLang,
            forceContinue: t.forceContinue,
          }))
        : undefined,
      position: step.position,
    })),
  };
}

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US") +
    " " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
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

function extractTouchedFiles(trace: string): string[] {
  const files = new Set<string>();
  for (const line of trace.split(/\r?\n/)) {
    const match = line.match(/^[←→]\s+(?:Edit|Write|Read)\s+(.+)$/) || line.match(/^Index:\s+(.+)$/);
    if (match?.[1]) files.add(match[1].trim());
  }
  return [...files];
}

function formatTaskOutput(stdout: string, stderr: string): string {
  const cleanStdout = normalizeCommandOutput(stdout);
  const cleanStderr = normalizeCommandOutput(stderr);
  const parts: string[] = [];

  if (cleanStdout) {
    parts.push(`## Response\n\n${cleanStdout}`);
  }

  const touchedFiles = extractTouchedFiles(cleanStderr);
  if (touchedFiles.length > 0) {
    parts.push(`## Touched files\n\n${touchedFiles.map((f) => `- ${f}`).join("\n")}`);
  }

  if (cleanStderr) {
    parts.push(`## OpenCode trace\n\n\`\`\`text\n${cleanStderr}\n\`\`\``);
  }

  return parts.join("\n\n---\n\n").trim();
}

function extractSection(output: string, title: string): string {
  const match = output.match(new RegExp(`^## ${title}\\s*\\n\\s*([\\s\\S]*?)(?:\\n\\n---\\n\\n## |$)`, "m"));
  return match ? match[1].trim() : "";
}

function cleanWorkflowContext(output: string): string {
  if (!output) return "";
  return output
    .replace(/\[exit code:.*?\]/g, "")
    .replace(/\[starting detached process…\]/g, "")
    .replace(/\[Workflow evaluation[^\]]*?\].*?(?=\n|$)/g, "")
    .replace(/\[Workflow (failed|stopped)[^\]]*?\]/g, "")
    .replace(/\.{3,}/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractContextForHandoff(output: string): string {
  const cleaned = cleanWorkflowContext(output);
  if (!cleaned) return "";

  const response = extractSection(cleaned, "Response");
  const touchedFiles = extractSection(cleaned, "Touched files");
  const trace = extractSection(cleaned, "OpenCode trace").replace(/^```text\s*/, "").replace(/```$/, "").trim();
  const parts: string[] = [];

  if (response) parts.push(`Response: ${response}`);
  if (touchedFiles) parts.push(`Touched files: ${touchedFiles}`);
  if (trace) parts.push(`OpenCode trace: ${trace}`);

  return (parts.length > 0 ? parts.join("\n\n") : cleaned).slice(0, 6000).trim();
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
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return bytes.toString("utf16le");
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return Buffer.from(bytes).swap16().toString("utf16le");
  }

  if (bytes.length > 4) {
    let oddNulls = 0;
    let evenNulls = 0;
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0) {
        if (i % 2 === 0) evenNulls++;
        else oddNulls++;
      }
    }
    const nullRatio = (oddNulls + evenNulls) / bytes.length;
    if (nullRatio > 0.2 && oddNulls > evenNulls * 4) return bytes.toString("utf16le");
    if (nullRatio > 0.2 && evenNulls > oddNulls * 4) return Buffer.from(bytes).swap16().toString("utf16le");
  }

  const utf8 = bytes.toString("utf8");
  if (countReplacementChars(utf8) === 0) return utf8;
  const win1252 = decodeWindows1252(bytes);
  const cp850 = decodeCp850(bytes);
  return countReplacementChars(win1252) <= countReplacementChars(cp850) ? win1252 : cp850;
}

function getOpencodeConfigPath(): string {
  return path.join(os.homedir(), ".config", "opencode", "opencode.json");
}

function getUvCandidates(): string[] {
  return [
    path.join(os.homedir(), "AppData", "Local", "hermes", "bin", "uv.exe"),
    path.join(os.homedir(), ".local", "bin", process.platform === "win32" ? "uv.exe" : "uv"),
    path.join(os.homedir(), "AppData", "Roaming", "Python", "Scripts", "uv.exe"),
  ];
}

function resolveUvBin(): string | null {
  for (const candidate of getUvCandidates()) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch { /* ignore */ }
  }
  return null;
}

function getUvInstallCommand(): string {
  return process.platform === "win32"
    ? `powershell -ExecutionPolicy Bypass -c "irm https://astral.sh/uv/install.ps1 | iex"`
    : `curl -LsSf https://astral.sh/uv/install.sh | sh`;
}

function getUvHelpText(): string {
  return `uv is required to run autooc-mcp because the MCP server is a self-contained FastMCP Python script. Install uv with: ${getUvInstallCommand()}`;
}

function requireUvBin(): string {
  const uv = resolveUvBin();
  if (!uv) throw new Error(getUvHelpText());
  return uv;
}

function describeUvStatus(): { available: boolean; path?: string; installCommand: string } {
  const uv = resolveUvBin();
  return { available: !!uv, path: uv || undefined, installCommand: getUvInstallCommand() };
}

function resolveUvBinForDisplay(): string {
  return resolveUvBin() || (process.platform === "win32" ? "uv.exe" : "uv");
}

function getAutoOcMcpServerSource(): string {
  return String.raw`# /// script
# dependencies = ["mcp>=1.10.0"]
# ///
import json
import os
import re
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("autooc-mcp")
VAULT_PATH = Path(os.environ.get("AUTOOC_VAULT_PATH") or os.getcwd())
SECRETS_PATH = VAULT_PATH / ".obsidian" / "plugins" / "auto-oc" / "secrets.vault.json"


def read_secrets_metadata() -> list[dict[str, Any]]:
    try:
        if not SECRETS_PATH.exists():
            return []
        data = json.loads(SECRETS_PATH.read_text(encoding="utf-8") or "{}")
        secrets = data.get("secrets") if isinstance(data, dict) else []
        if not isinstance(secrets, list):
            return []
        return [
            {
                "name": secret.get("name"),
                "envName": secret.get("envName"),
                "type": secret.get("type"),
                "profile": secret.get("profile") or "default",
                "updatedAt": secret.get("updatedAt"),
            }
            for secret in secrets
            if isinstance(secret, dict)
        ]
    except Exception as exc:
        return [{"error": str(exc)}]


def normalize_key(value: str | None) -> str:
    text = str(value or "").strip()
    text = re.sub(r"^https?://", "", text, flags=re.I)
    text = re.sub(r"^www\.", "", text, flags=re.I)
    text = text.split("/")[0].split(":")[0]
    text = re.sub(r"\.[^.]+$", "", text)
    text = re.sub(r"[^A-Za-z0-9]+", "_", text).strip("_")
    return text.upper()


def secret_value_for(secret: dict[str, Any] | None) -> str:
    if not secret:
        return ""
    env_name = secret.get("envName")
    return os.environ.get(str(env_name), "") if env_name else ""


def find_secret_by_name_or_env(name: str) -> dict[str, Any] | None:
    wanted = normalize_key(name)
    for secret in read_secrets_metadata():
        if normalize_key(secret.get("name")) == wanted or normalize_key(secret.get("envName")) == wanted:
            return secret
    return None


def find_web_credentials(site: str) -> dict[str, Any]:
    key = normalize_key(site)
    secrets = read_secrets_metadata()

    def is_for_site(secret: dict[str, Any]) -> bool:
        return key in normalize_key(secret.get("name")) or key in normalize_key(secret.get("envName"))

    def is_user(secret: dict[str, Any]) -> bool:
        name = normalize_key(secret.get("name"))
        env = normalize_key(secret.get("envName"))
        type_name = str(secret.get("type") or "").lower()
        return type_name == "username" or "USER" in name or "USER" in env

    def is_pass(secret: dict[str, Any]) -> bool:
        name = normalize_key(secret.get("name"))
        env = normalize_key(secret.get("envName"))
        type_name = str(secret.get("type") or "").lower()
        return type_name == "password" or "PASS" in name or "PASS" in env

    user = next((secret for secret in secrets if is_for_site(secret) and is_user(secret)), None)
    password = next((secret for secret in secrets if is_for_site(secret) and is_pass(secret)), None)
    username_value = secret_value_for(user)
    password_value = secret_value_for(password)
    return {
        "site": site,
        "usernameEnv": user.get("envName") if user else None,
        "passwordEnv": password.get("envName") if password else None,
        "username": username_value,
        "password": password_value,
        "found": bool(username_value and password_value),
    }


@mcp.tool()
def secrets_status() -> dict[str, Any]:
    """Show AutoOC secrets vault status without revealing secret values."""
    secrets = [secret for secret in read_secrets_metadata() if "error" not in secret]
    return {"vaultPath": str(VAULT_PATH), "secretsPath": str(SECRETS_PATH), "secretsCount": len(secrets)}


@mcp.tool()
def list_secret_envs() -> list[dict[str, Any]]:
    """List AutoOC secret names and environment variable names without revealing values."""
    return read_secrets_metadata()


@mcp.tool()
def mcp_header_template() -> dict[str, Any]:
    """Return a headers template mapping AutoOC secret names to {env:...} references."""
    headers: dict[str, str] = {}
    for secret in read_secrets_metadata():
        name = secret.get("name")
        env_name = secret.get("envName")
        if name and env_name:
            headers[str(name)] = "{env:" + str(env_name) + "}"
    return {"headers": headers}


@mcp.tool()
def get_secret_value(name: str) -> dict[str, Any]:
    """Return one AutoOC secret value by secret name or env var. Use only when the task explicitly needs the credential."""
    secret = find_secret_by_name_or_env(name)
    if not secret:
        return {"found": False}
    value = secret_value_for(secret)
    return {"found": bool(value), "name": secret.get("name"), "envName": secret.get("envName"), "value": value}


@mcp.tool()
def get_web_credentials(site: str) -> dict[str, Any]:
    """Return username and password for a website from AutoOC secrets."""
    return find_web_credentials(site)


if __name__ == "__main__":
    mcp.run(transport="stdio")
`;
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

  if (task.scheduleType === "once") {
    if (task.status !== "pending") return false;
    const target = new Date(`${task.scheduleDate}T${task.scheduleTime}:00`);
    return now >= target;
  }

  if (task.scheduleType === "daily") {
    return isDayScheduleDue(now, task.scheduleTime, task.lastRun);
  }

  if (task.scheduleType === "weekly") {
    if (!task.scheduleDays.includes(now.getDay())) return false;
    return isDayScheduleDue(now, task.scheduleTime, task.lastRun);
  }

  if (task.scheduleType === "monthly") {
    const monthDays = task.scheduleMonthDays || [];
    if (!monthDays.includes(now.getDate())) return false;
    return isDayScheduleDue(now, task.scheduleTime, task.lastRun);
  }

  if (task.scheduleType === "interval") {
    const value = task.scheduleIntervalValue ?? 10;
    const unit = task.scheduleIntervalUnit ?? "minutes";
    const ms = intervalToMs(value, unit);
    if (!task.lastRun) return true;
    return now.getTime() - new Date(task.lastRun).getTime() >= ms;
  }

  return false;
}

function isWorkflowDue(wf: Workflow): boolean {
  if (wf.status === "running") return false;
  if (wf.steps.length === 0) return false;
  if (wf.scheduleType === "manual") return false;

  const now = new Date();

  if (wf.scheduleType === "once") {
    if (wf.status !== "pending") return false;
    const target = new Date(`${wf.scheduleDate || ""}T${wf.scheduleTime || "00:00"}:00`);
    return now >= target;
  }

  if (wf.scheduleType === "daily") {
    return isDayScheduleDue(now, wf.scheduleTime || "00:00", wf.lastRun);
  }

  if (wf.scheduleType === "weekly") {
    const days = wf.scheduleDays || [];
    if (!days.includes(now.getDay())) return false;
    return isDayScheduleDue(now, wf.scheduleTime || "00:00", wf.lastRun);
  }

  if (wf.scheduleType === "monthly") {
    const monthDays = wf.scheduleMonthDays || [];
    if (!monthDays.includes(now.getDate())) return false;
    return isDayScheduleDue(now, wf.scheduleTime || "00:00", wf.lastRun);
  }

  if (wf.scheduleType === "interval") {
    const value = wf.scheduleIntervalValue ?? 10;
    const unit = wf.scheduleIntervalUnit ?? "minutes";
    const ms = intervalToMs(value, unit);
    if (!wf.lastRun) return true;
    return now.getTime() - new Date(wf.lastRun).getTime() >= ms;
  }

  return false;
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default class AutoOCPlugin extends Plugin {
  settings!: AutoOCSettings;
  secretStore!: SecretStore;
  view?: AutoOCView;
  availableModels: { value: string; label: string }[] = FALLBACK_MODELS;
  availableAgents: { value: string; label: string }[] = FALLBACK_AGENTS;
  private visualBuilders = new Set<VisualBuilderModal>();
  private taskUpdatedCallbacks = new Set<(task: ScheduledTask) => void>();
  private workflowUpdatedCallbacks = new Set<(workflow: Workflow) => void>();
  // Map taskId -> child process, so we can kill running tasks
  private runningProcesses = new Map<string, ReturnType<typeof spawn>>();
  private dueCheckInProgress = false;
  // Workflows that have been manually stopped; checked in step callbacks to abort chaining
  private stoppingWorkflows = new Set<string>();

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
      id: "open-visual-builder",
      name: "Open AutoOC Visual Builder",
      callback: () => this.openVisualBuilder(),
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

    // Scheduler: check every 5 seconds so interval schedules (seconds/minutes/hours) are responsive
    this.registerInterval(
      window.setInterval(() => this.runDueAll(), 5_000)
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

  // Open the visual builder as a centered, near-fullscreen modal. The
  // visual builder is a standalone HTML/JS app that we host in an
  // iframe; it communicates with the plugin through postMessage so the
  // user can edit visually and apply changes back to the settings.
  openVisualBuilder(): void {
    new VisualBuilderModal(this.app, this).open();
  }

  registerVisualBuilder(modal: VisualBuilderModal): void {
    this.visualBuilders.add(modal);
  }

  unregisterVisualBuilder(modal: VisualBuilderModal): void {
    this.visualBuilders.delete(modal);
  }

  syncVisualBuilders(): void {
    for (const modal of this.visualBuilders) modal.sendState();
  }

  onTaskUpdated(callback: (task: ScheduledTask) => void): () => void {
    this.taskUpdatedCallbacks.add(callback);
    return () => this.taskUpdatedCallbacks.delete(callback);
  }

  onWorkflowUpdated(callback: (workflow: Workflow) => void): () => void {
    this.workflowUpdatedCallbacks.add(callback);
    return () => this.workflowUpdatedCallbacks.delete(callback);
  }

  emitTaskUpdated(task: ScheduledTask): void {
    for (const callback of this.taskUpdatedCallbacks) callback(task);
    this.syncVisualBuilders();
  }

  emitWorkflowUpdated(workflow: Workflow): void {
    for (const callback of this.workflowUpdatedCallbacks) callback(workflow);
    this.syncVisualBuilders();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    const vaultBasePath = (this.app.vault.adapter as any).basePath || ".";
    this.secretStore = new SecretStore(vaultBasePath);
    try {
      this.secretStore.load();
    } catch (e) {
      new Notice(`AutoOC: could not load secrets vault — ${String(e)}`);
      this.secretStore = new SecretStore(vaultBasePath);
    }
    delete (this.settings as any).chatHistory;
    delete (this.settings as any).chatModel;
    let changed = false;
    for (const task of this.settings.tasks) {
      if (task.status === "running") {
        task.status = "failed";
        task.output = `${task.output || ""}\n[stale running state cleared on plugin load]`;
        changed = true;
      }
      if (!Array.isArray(task.scheduleMonthDays)) {
        task.scheduleMonthDays = [];
        changed = true;
      }
      if (task.scheduleIntervalValue === undefined) {
        task.scheduleIntervalValue = 10;
        changed = true;
      }
      if (task.scheduleIntervalUnit === undefined) {
        task.scheduleIntervalUnit = "minutes";
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
        wf.scheduleMonthDays = [];
        changed = true;
      }
      if (!Array.isArray(wf.scheduleMonthDays)) {
        wf.scheduleMonthDays = [];
        changed = true;
      }
      if (wf.scheduleIntervalValue === undefined) {
        wf.scheduleIntervalValue = 10;
        changed = true;
      }
      if (wf.scheduleIntervalUnit === undefined) {
        wf.scheduleIntervalUnit = "minutes";
        changed = true;
      }
      if (wf.handoffOutput !== true) {
        wf.handoffOutput = true;
        changed = true;
      }
      // v1.4 migration: steps gain id, stepKind, transitions, position.
      if (Array.isArray(wf.steps)) {
        for (let i = 0; i < wf.steps.length; i++) {
          const s = wf.steps[i];
          if (!s.id) { s.id = generateId(); changed = true; }
          if (!s.stepKind) { s.stepKind = "task"; changed = true; }
          if (!s.position) { s.position = { x: 40 + i * 280, y: 60 }; changed = true; }
          // Build linear transitions for legacy steps that don't have any.
          if (!s.transitions || s.transitions.length === 0) {
            const next = wf.steps[i + 1];
            if (next) {
              s.transitions = [{
                toStepId: next.id,
                mode: (s.transitionMode as TransitionMode) || "default",
                evaluatePrompt: s.evaluatePrompt,
                forceContinue: s.forceContinue,
              }];
              changed = true;
            }
          }
        }
      }
    }
    if (!this.settings.defaultModel) {
      this.settings.defaultModel = this.availableModels[0]?.value ?? "";
      changed = true;
    }
    if (this.settings.taskTimeoutSeconds === undefined || (this.settings.taskTimeoutSeconds > 0 && this.settings.taskTimeoutSeconds < 1800)) {
      this.settings.taskTimeoutSeconds = DEFAULT_TASK_TIMEOUT_SECONDS;
      changed = true;
    }
    if (!this.settings.libraryUrl) {
      this.settings.libraryUrl = DEFAULT_SETTINGS.libraryUrl;
      changed = true;
    }
    if (!this.settings.dashboardPositions || typeof this.settings.dashboardPositions !== "object") {
      this.settings.dashboardPositions = {};
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

  getAutoOcMcpPaths(): { vaultBasePath: string; mcpPath: string } {
    const vaultBasePath = (this.app.vault.adapter as any).basePath || ".";
    return {
      vaultBasePath,
      mcpPath: path.join(vaultBasePath, ".obsidian", "plugins", "auto-oc", "autooc-mcp.py"),
    };
  }

  getAutoOcMcpConfigBlock(requireAvailableUv = false): Record<string, any> {
    const { vaultBasePath, mcpPath } = this.getAutoOcMcpPaths();
    const uvBin = requireAvailableUv ? requireUvBin() : resolveUvBinForDisplay();
    return {
      type: "local",
      command: [uvBin, "run", "--script", mcpPath],
      enabled: true,
      env: {
        AUTOOC_VAULT_PATH: vaultBasePath,
      },
    };
  }

  ensureAutoOcMcpServerFile(): string {
    const { mcpPath } = this.getAutoOcMcpPaths();
    fs.mkdirSync(path.dirname(mcpPath), { recursive: true });
    fs.writeFileSync(mcpPath, getAutoOcMcpServerSource(), "utf8");
    return mcpPath;
  }

  async ensureAutoOcMcpEnabled(): Promise<{ changed: boolean; configPath: string; mcpPath: string }> {
    const configPath = getOpencodeConfigPath();
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const mcpPath = this.ensureAutoOcMcpServerFile();
    let data: Record<string, any> = {};
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, "utf8");
        data = raw.trim() ? JSON.parse(raw) : {};
      } catch {
        throw new Error(`Could not read valid JSON from ${configPath}`);
      }
    }

    const nextBlock = this.getAutoOcMcpConfigBlock(true);
    const mcp = data.mcp && typeof data.mcp === "object" && !Array.isArray(data.mcp) ? { ...data.mcp } : {};
    const current = mcp["autooc-mcp"];
    const changed = JSON.stringify(current) !== JSON.stringify(nextBlock);
    if (changed) {
      mcp["autooc-mcp"] = nextBlock;
      data.mcp = mcp;
      if (!data.$schema) data.$schema = "https://opencode.ai/config.json";
      fs.writeFileSync(configPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    }
    return { changed, configPath, mcpPath };
  }

  async saveSettings(refreshView = true) {
    await this.saveData(this.settings);
    if (refreshView) this.view?.refresh();
  }

  getSecretsEnv(profile = "default"): Record<string, string> {
    if (!this.secretStore?.isSecureStorageAvailable()) return {};
    try {
      return this.secretStore.getEnv(profile);
    } catch (e) {
      new Notice(`AutoOC: could not load secrets for environment — ${String(e)}`);
      return {};
    }
  }

  redactSecrets(text: string): string {
    if (!text || !this.secretStore?.isSecureStorageAvailable()) return text;
    let redacted = text;
    for (const value of this.secretStore.getRedactionValues()) {
      redacted = redacted.split(value).join("[secret:redacted]");
    }
    return redacted;
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
    return args.map(commandPreviewArg).join(" ");
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
      const safeCwd = cwd.replace(/'/g, "''");
      const secretEnv = this.getSecretsEnv();

      const psScript = [
        ...psUtf8Prelude(),
        `$env:USERPROFILE = '${process.env.USERPROFILE}'`,
        `$env:APPDATA     = '${process.env.APPDATA}'`,
        `$env:LOCALAPPDATA= '${process.env.LOCALAPPDATA}'`,
        `$env:PATH        = '${process.env.PATH}'`,
        `$env:HOME        = '${process.env.USERPROFILE}'`,
        ...buildPowerShellEnvLines(secretEnv),
        `Set-Location -LiteralPath '${safeCwd}'`,
        `$outTmp = [System.IO.Path]::GetTempFileName()`,
        `$errTmp = [System.IO.Path]::GetTempFileName()`,
        `$bin = ${psSingleQuoted(bin)}`,
        `$argList = @('run','-m',${psSingleQuoted(model)},'--agent',${psSingleQuoted(agent)},'--dangerously-skip-permissions','--',${psSingleQuoted(prompt)})`,
        `& $bin @argList > $outTmp 2> $errTmp`,
        `$exitCode = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 }`,
        `$stdout = Get-Content $outTmp -Raw -Encoding UTF8 -ErrorAction SilentlyContinue`,
        `$stderr = Get-Content $errTmp -Raw -Encoding UTF8 -ErrorAction SilentlyContinue`,
        `Remove-Item $outTmp,$errTmp -ErrorAction SilentlyContinue`,
        `$combined = ($stdout + $(if($stderr){"\n" + $stderr}else{""})).Trim()`,
        `[System.IO.File]::WriteAllText('${outFile.replace(/'/g, "''")}', "\nDONE:" + $exitCode + "\n" + $combined)`,
      ].join("\n");

      const psFile = path.join(tmpDir, `autooc-eval-${evalId}.ps1`);
      writeUtf8BomFile(psFile, psScript);
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
        resolve({ output: this.redactSecrets(normalizeCommandOutput(output)), exitCode });
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

    if ((effectiveTask.taskKind || "opencode") === "code") {
      await this.runCodeTask(effectiveTask, onComplete);
      return;
    }

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
    const taskCwd = effectiveTask.workingDirectory || this.settings.workingDirectory || vaultBasePath;
    const secretEnv = this.getSecretsEnv();

    if (effectiveTask.interactiveTerminal) {
      const current = this.settings.tasks[idx];
      current.status = "running";
      current.lastRun = new Date().toISOString();
      current.output = "[opening interactive OpenCode CLI...]";
      this.view?.resetDashboardTaskShift(task.id);
      await this.saveSettings();

      try {
        let prompt = effectiveTask.prompt;
        if (effectiveTask.useRalphLoop) {
          prompt = `/ralph-loop ${prompt}`;
        }
        const bin = resolveOpencodeBin(this.settings.opencodePath);
        const args = ["-m", effectiveTask.model, "--agent", this.getEffectiveAgent(effectiveTask.agent), "--prompt", prompt];
        openOpencodeCli(bin, taskCwd, secretEnv, args);
        current.status = "completed";
        current.output = "[opened interactive OpenCode CLI with preloaded prompt]";
        await this.saveSettings();
        new Notice(`AutoOC: opened CLI task "${task.name}".`);
        if (onComplete) await onComplete(current, 0);
      } catch (e) {
        current.status = "failed";
        current.output = `[AutoOC] Could not open interactive OpenCode CLI: ${String(e)}`;
        this.view?.startGradualSink(task.id);
        await this.saveSettings();
        new Notice(`AutoOC: could not open CLI task "${task.name}".`);
        if (onComplete) await onComplete(current, -1);
      }
      return;
    }

    this.settings.tasks[idx].status = "running";
    this.settings.tasks[idx].lastRun = new Date().toISOString();
    this.settings.tasks[idx].output = "[starting detached process…]\n";
    this.view?.resetDashboardTaskShift(task.id);
    await this.saveSettings();

    new Notice(`AutoOC: running "${task.name}"…`);

    const args = this.buildArgs(effectiveTask);
    const bin = args[0]; // opencode.cmd full path
    let prompt = effectiveTask.prompt;
    if (effectiveTask.useRalphLoop) {
      prompt = `/ralph-loop ${prompt}`;
    }
    const model = effectiveTask.model;
    const preparedPrompt = prompt
      .replace(/\r?\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

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
      ...psUtf8Prelude(),
      `$env:USERPROFILE = '${process.env.USERPROFILE}'`,
      `$env:APPDATA     = '${process.env.APPDATA}'`,
      `$env:LOCALAPPDATA= '${process.env.LOCALAPPDATA}'`,
      `$env:PATH        = '${process.env.PATH}'`,
      `$env:HOME        = '${process.env.USERPROFILE}'`,
      ...buildPowerShellEnvLines(secretEnv),
      `Set-Location -LiteralPath '${safeCwd}'`,
      gitCmds ? gitCmds : "",
      `$prompt = Get-Content '${promptFile.replace(/'/g, "''")}' -Raw -Encoding UTF8`,
      `$bin = ${psSingleQuoted(bin)}`,
      `$argList = @('run','-m',${psSingleQuoted(model)},'--agent',${psSingleQuoted(this.getEffectiveAgent(effectiveTask.agent))},'--dangerously-skip-permissions','--',$prompt)`,
      `& $bin @argList > '${outFile.replace(/'/g, "''")}' 2> '${errFile.replace(/'/g, "''")}'`,
      `$exitCode = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 }`,
      `[System.IO.File]::WriteAllText('${doneFile.replace(/'/g, "''")}', [string]$exitCode, [System.Text.Encoding]::UTF8)`,
    ].filter(line => line !== "").join("\n");

    const psScriptFile = require("path").join(tmpDir, `autooc-${task.id}.ps1`);
    writeUtf8BomFile(psScriptFile, psScript);

    // Launch completely silently via wscript.exe VBScript — zero window flash
    launchHiddenPS(psScriptFile);
    this.runningProcesses.set(task.id, { kill: () => { /* best-effort */ } } as any);

    const timeoutSeconds = this.settings.taskTimeoutSeconds ?? DEFAULT_TASK_TIMEOUT_SECONDS;
    const timeoutEnabled = timeoutSeconds > 0;
    const timeoutMs = timeoutSeconds * 1000;
    const startedAt = Date.now();
    let timeoutWarned = false;

    // Poll the output file every 3 s
    const pollHandle = setInterval(async () => {
      const t = this.settings.tasks.find((x) => x.id === task.id);
      if (!t) { clearInterval(pollHandle); return; }

      // Soft timeout: warn once, but keep polling because OpenCode may still finish successfully.
      if (timeoutEnabled && !timeoutWarned && Date.now() - startedAt > timeoutMs) {
        timeoutWarned = true;
        t.output += `\n[⏱ timeout warning: ${timeoutSeconds}s exceeded; still waiting for final result]`;
        await this.saveSettings(false);
        new Notice(`AutoOC: ⏱ "${task.name}" exceeded ${timeoutSeconds}s; still waiting.`);
      }

      if (!fs.existsSync(doneFile)) {
        // Still running — heartbeat dot
        t.output += ".";
        this.view?.nudgeDashboardTask(task.id, "up");
        await this.saveSettings(false);
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
      const normalized = this.redactSecrets(formatTaskOutput(stdout, stderr));

      t.output = normalized || "(no output)";
      if (exitCode !== 0) {
        t.status = "failed";
        t.output += `\n[exit code: ${exitCode}]`;
        this.view?.startGradualSink(task.id);
        new Notice(`AutoOC: ❌ "${task.name}" failed (code ${exitCode}).`);
      } else {
        t.status = task.scheduleType === "daily" || task.scheduleType === "weekly" || task.scheduleType === "monthly" || task.scheduleType === "interval" ? "pending" : "completed";
        new Notice(`AutoOC: ✅ "${task.name}" completed.`);
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

  async runCodeTask(
    task: ScheduledTask,
    onComplete?: (task: ScheduledTask, exitCode: number) => Promise<void>,
  ) {
    const idx = this.settings.tasks.findIndex((t) => t.id === task.id);
    if (idx === -1) return;
    const current = this.settings.tasks[idx];
    const code = current.code || current.prompt || "";
    if (!code.trim()) {
      current.status = "failed";
      current.lastRun = new Date().toISOString();
      current.output = "[AutoOC] Code task not launched: code is empty.";
      await this.saveSettings();
      new Notice(`AutoOC: "${current.name}" has empty code.`);
      if (onComplete) await onComplete(current, -1);
      return;
    }

    const vaultBasePath = (this.app.vault.adapter as any).basePath || ".";
    current.status = "running";
    current.lastRun = new Date().toISOString();
    current.output = "[running code task...]\n";
    this.view?.resetDashboardTaskShift(current.id);
    await this.saveSettings();
    new Notice(`AutoOC: running code task "${current.name}"...`);

    try {
      const vm = require("vm");
      const inputVar = current.codeInputVar || "input";
      const outputVar = current.codeOutputVar || "output";
      const defaultCwd = current.workingDirectory || this.settings.workingDirectory || vaultBasePath;
      const resolveInVault = (p: string) => {
        const resolved = path.resolve(vaultBasePath, p || ".");
        const root = path.resolve(vaultBasePath);
        if (resolved !== root && !resolved.startsWith(root + path.sep)) {
          throw new Error(`Path escapes vault: ${p}`);
        }
        return resolved;
      };
      const readText = (p: string) => fs.readFileSync(p, "utf8");
      const writeText = (p: string, content: any) => {
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, String(content), "utf8");
        return p;
      };
      const sandbox: Record<string, any> = {
        input: "",
        outputs: {},
        JSON,
        Math,
        Date,
        String,
        Number,
        Boolean,
        Array,
        Object,
        RegExp,
        console: { log: (...args: any[]) => { current.output += args.map(String).join(" ") + "\n"; } },
      };
      if (current.codeAllowVault) {
        sandbox.vault = {
          read: (p: string) => readText(resolveInVault(p)),
          write: (p: string, content: any) => writeText(resolveInVault(p), content),
          append: (p: string, content: any) => { const f = resolveInVault(p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.appendFileSync(f, String(content), "utf8"); return f; },
          exists: (p: string) => fs.existsSync(resolveInVault(p)),
          list: (p = ".") => fs.readdirSync(resolveInVault(p)),
        };
      }
      if (current.codeAllowFiles) {
        sandbox.files = {
          read: (p: string) => readText(path.isAbsolute(p) ? path.resolve(p) : path.resolve(defaultCwd, p)),
          write: (p: string, content: any) => writeText(path.isAbsolute(p) ? path.resolve(p) : path.resolve(defaultCwd, p), content),
          append: (p: string, content: any) => { const f = path.isAbsolute(p) ? path.resolve(p) : path.resolve(defaultCwd, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.appendFileSync(f, String(content), "utf8"); return f; },
          exists: (p: string) => fs.existsSync(path.isAbsolute(p) ? path.resolve(p) : path.resolve(defaultCwd, p)),
          list: (p = ".") => fs.readdirSync(path.isAbsolute(p) ? path.resolve(p) : path.resolve(defaultCwd, p)),
        };
      }
      if (current.codeAllowTerminal) {
        const { execSync } = require("child_process");
        sandbox.terminal = {
          run: (command: string, options: { cwd?: string; timeoutMs?: number } = {}) => execSync(String(command), {
            cwd: options.cwd ? (path.isAbsolute(options.cwd) ? options.cwd : path.resolve(defaultCwd, options.cwd)) : defaultCwd,
            timeout: Math.min(Math.max(options.timeoutMs || 30_000, 1_000), 600_000),
            encoding: "utf8",
          }),
        };
      }

      const context = vm.createContext(sandbox);
      const preamble = `var ${inputVar} = input; var ${outputVar} = "";`;
      const result = vm.runInContext(preamble + "\n" + code + "\n;" + outputVar, context, { timeout: 900_000 });
      const out = String(result == null ? "" : result);
      current.output = (current.output || "") + out;
      current.status = current.scheduleType === "daily" || current.scheduleType === "weekly" || current.scheduleType === "monthly" || current.scheduleType === "interval" ? "pending" : "completed";
      new Notice(`AutoOC: ✅ code task "${current.name}" completed.`);
      if (this.settings.logsEnabled) {
        saveLogToFile(vaultBasePath, current.id, current.output || "(no output)");
        cleanupOldLogs(vaultBasePath, current.id, this.settings.maxLogsPerTask);
        cleanupLogsByAge(vaultBasePath, current.id, this.settings.logRetentionDays);
      }
      await this.saveSettings();
      if (onComplete) await onComplete(current, 0);
    } catch (err) {
      current.status = "failed";
      current.output = (current.output || "") + `[code error: ${String(err)}]`;
      this.view?.startGradualSink(current.id);
      if (this.settings.logsEnabled) {
        saveLogToFile(vaultBasePath, current.id, current.output);
        cleanupOldLogs(vaultBasePath, current.id, this.settings.maxLogsPerTask);
        cleanupLogsByAge(vaultBasePath, current.id, this.settings.logRetentionDays);
      }
      await this.saveSettings();
      new Notice(`AutoOC: ❌ code task "${current.name}" failed.`);
      if (onComplete) await onComplete(current, -1);
    }
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

  async killWorkflow(id: string) {
    const wf = this.settings.workflows.find((w) => w.id === id);
    if (!wf) return;

    this.stoppingWorkflows.add(id);

    // Stop the currently running task in the workflow, if any
    if (wf.status === "running" && wf.currentStep >= 0 && wf.currentStep < wf.steps.length) {
      const currentStep = wf.steps[wf.currentStep];
      const currentTask = this.settings.tasks.find((t) => t.id === currentStep?.taskId);
      if (currentTask?.status === "running") {
        await this.killTask(currentTask.id);
      }
    }

    if (wf.status === "running") {
      wf.status = "failed";
      const stepLabel = wf.currentStep >= 0 ? ` at step ${wf.currentStep + 1}/${wf.steps.length}` : "";
      wf.steps.forEach((step) => {
        const task = this.settings.tasks.find((t) => t.id === step.taskId);
        if (task && task.status === "running") {
          task.status = "failed";
          task.output += "\n[workflow stopped manually]";
        }
      });
      await this.saveSettings();
      new Notice(`AutoOC: ⏹ Workflow "${wf.name}" stopped${stepLabel}.`);
    }

    this.stoppingWorkflows.delete(id);
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
    this.syncVisualBuilders();
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

  workflowTaskIds(workflow: Workflow): string[] {
    return Array.from(new Set(workflow.steps.map((step) => step.taskId).filter(Boolean) as string[]));
  }

  workflowTaskIdsUsedOnlyBy(workflowId: string): string[] {
    const workflow = this.settings.workflows.find((w) => w.id === workflowId);
    if (!workflow) return [];
    const taskIds = this.workflowTaskIds(workflow);
    return taskIds.filter((taskId) => !this.settings.workflows.some(
      (other) => other.id !== workflowId && other.steps.some((step) => step.taskId === taskId)
    ));
  }

  async deleteWorkflow(id: string, deleteWorkflowTasks = false) {
    const taskIdsToDelete = deleteWorkflowTasks ? this.workflowTaskIdsUsedOnlyBy(id) : [];
    if (taskIdsToDelete.length > 0) {
      this.settings.tasks = this.settings.tasks.filter((task) => !taskIdsToDelete.includes(task.id));
    }
    this.settings.workflows = this.settings.workflows.filter((w) => w.id !== id);
    await this.saveSettings();
    this.syncVisualBuilders();
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

  ensureUniqueTaskName(name: string): string {
    const existing = new Set(this.settings.tasks.map((t) => t.name));
    let candidate = name;
    let i = 1;
    while (existing.has(candidate)) {
      candidate = `${name} (imported ${i})`;
      i++;
    }
    return candidate;
  }

  ensureUniqueWorkflowName(name: string): string {
    const existing = new Set(this.settings.workflows.map((w) => w.name));
    let candidate = name;
    let i = 1;
    while (existing.has(candidate)) {
      candidate = `${name} (imported ${i})`;
      i++;
    }
    return candidate;
  }

  buildExportJson(
    tasks: ScheduledTask[],
    workflows: Workflow[],
    name?: string,
    description?: string
  ): string {
    const taskExportIdMap = new Map<string, string>();
    const exportTasks = tasks.map((t, i) => {
      const exportId = `task-${i}`;
      taskExportIdMap.set(t.id, exportId);
      return toExportTask(t, exportId);
    });
    const exportWorkflows = workflows.map((w, i) =>
      toExportWorkflow(w, `wf-${i}`, taskExportIdMap)
    );

    const data: AutoOCExportFile = {
      autoOCExport: {
        schemaVersion: "1.4.0",
        exportedAt: new Date().toISOString(),
        pluginVersion: this.manifest.version,
        name,
        description,
      },
      tasks: exportTasks,
      workflows: exportWorkflows,
    };

    return JSON.stringify(data, null, 2);
  }

  async exportToFile(
    tasks: ScheduledTask[],
    workflows: Workflow[],
    name?: string,
    description?: string
  ): Promise<void> {
    const json = this.buildExportJson(tasks, workflows, name, description);

    try {
      // @ts-ignore — Electron API available on desktop Obsidian
      const electron = window.require("electron");
      const result = await electron.remote.dialog.showSaveDialog({
        defaultPath: `autooc-export-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "JSON files", extensions: ["json"] }],
        title: "Export AutoOC tasks and workflows",
      });
      if (result.canceled || !result.filePath) return;
      fs.writeFileSync(result.filePath, json, "utf8");
      new Notice(
        `AutoOC: exported ${tasks.length} task(s) and ${workflows.length} workflow(s).`
      );
    } catch (e) {
      new Notice(`AutoOC: export failed — ${String(e)}`);
    }
  }

  buildExportSelectionPayload(
    selectedTaskIds: Set<string>,
    selectedWorkflowIds: Set<string>
  ): {
    tasks: ScheduledTask[];
    workflows: Workflow[];
    referencedTaskIds: Set<string>;
  } {
    const tasks = this.settings.tasks.filter((t) => selectedTaskIds.has(t.id));
    const workflows = this.settings.workflows.filter((w) => selectedWorkflowIds.has(w.id));

    // Workflows always need their referenced tasks to be importable.
    const referencedTaskIds = new Set<string>();
    for (const wf of workflows) {
      for (const step of wf.steps) {
        if (step.taskId) referencedTaskIds.add(step.taskId);
      }
    }
    const autoIncludedTasks = this.settings.tasks.filter(
      (t) => referencedTaskIds.has(t.id) && !selectedTaskIds.has(t.id)
    );

    return {
      tasks: [...tasks, ...autoIncludedTasks],
      workflows,
      referencedTaskIds,
    };
  }

  async importFromFile(filePath: string): Promise<{
    tasksImported: number;
    workflowsImported: number;
  }> {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw) as AutoOCExportFile;
    return this.importFromData(data);
  }

  async importFromData(data: AutoOCExportFile): Promise<{
    tasksImported: number;
    workflowsImported: number;
  }> {
    if (!data.autoOCExport) {
      throw new Error("Invalid AutoOC export file (missing autoOCExport header).");
    }
    // Accept both 1.0 (legacy) and 1.4.x (current) schema versions.
    const sv = data.autoOCExport.schemaVersion;
    if (sv !== "1.0" && sv !== "1.4.0") {
      throw new Error(`Unsupported AutoOC export schema version: ${sv}.`);
    }

    const exportIdToTaskId = new Map<string, string>();
    let tasksImported = 0;

    for (const et of data.tasks || []) {
      const importedTaskKind = et.taskKind || "opencode";
      const task: ScheduledTask = {
        id: generateId(),
        taskKind: importedTaskKind,
        name: this.ensureUniqueTaskName(et.name),
        area: et.area ?? "",
        prompt: importedTaskKind === "code" ? (et.code || et.prompt || "") : et.prompt,
        model: importedTaskKind === "code" ? "" : this.getEffectiveDefaultModel(),
        agent: importedTaskKind === "code" ? "" : this.getEffectiveAgent(et.agent),
        useRalphLoop: importedTaskKind === "opencode" ? (et.useRalphLoop ?? false) : false,
        scheduleType: et.scheduleType ?? "manual",
        scheduleTime: et.scheduleTime ?? nowTimeString(),
        scheduleDate: et.scheduleDate ?? "",
        scheduleDays: et.scheduleDays ?? [],
        scheduleMonthDays: et.scheduleMonthDays ?? [],
        scheduleIntervalValue: et.scheduleIntervalValue ?? 10,
        scheduleIntervalUnit: et.scheduleIntervalUnit ?? "minutes",
        status: "pending",
        lastRun: "",
        output: "",
        createdAt: new Date().toISOString(),
        branch: importedTaskKind === "code" ? "" : et.branch,
        createBranch: importedTaskKind === "code" ? false : et.createBranch,
        interactiveTerminal: importedTaskKind === "opencode" ? (et.interactiveTerminal ?? this.settings.defaultInteractiveTerminal) : undefined,
        code: et.code,
        codeLang: et.codeLang,
        codeInputVar: et.codeInputVar,
        codeOutputVar: et.codeOutputVar,
        codeAllowVault: et.codeAllowVault,
        codeAllowFiles: et.codeAllowFiles,
        codeAllowTerminal: et.codeAllowTerminal,
      };
      this.settings.tasks.push(task);
      exportIdToTaskId.set(et.exportId, task.id);
      tasksImported++;
    }

    let workflowsImported = 0;
    for (const ew of data.workflows || []) {
      const exportIdToStepId = new Map<string, string>();
      const steps: WorkflowStep[] = [];
      // First pass: create all steps so we can resolve the transition targets in
      // a second pass (since the transition target references step ids, not
      // indices).
      const legacySteps: WorkflowStep[] = [];
      let legacyNextIndex = 0;
      for (const s of ew.steps || []) {
        const stepKind: StepKind = (s as any).stepKind || "task";
        const step: WorkflowStep = {
          id: (s as any).id || generateId(),
          stepKind,
          name: (s as any).name,
          area: (s as any).area || ew.area || "",
          taskId: (s as any).taskExportId ? exportIdToTaskId.get((s as any).taskExportId) : undefined,
          transitionMode: (s as any).transitionMode,
          evaluatePrompt: (s as any).evaluatePrompt,
          forceContinue: (s as any).forceContinue,
          delayValue: (s as any).delayValue,
          delayUnit: (s as any).delayUnit,
          code: (s as any).code,
          codeLang: (s as any).codeLang,
          codeInputVar: (s as any).codeInputVar,
          codeOutputVar: (s as any).codeOutputVar,
          codeAllowVault: (s as any).codeAllowVault,
          codeAllowFiles: (s as any).codeAllowFiles,
          codeAllowTerminal: (s as any).codeAllowTerminal,
          transitions: (s as any).transitions,
          position: (s as any).position,
        };
        // Legacy: if no transitions are present but stepKind is "task", build
        // a default linear transition to the next step.
        if ((!step.transitions || step.transitions.length === 0) && stepKind === "task") {
          step.transitions = undefined; // resolved later
          legacySteps.push(step);
        } else {
          steps.push(step);
        }
        exportIdToStepId.set(step.id, step.id);
      }

      // Resolve legacy linear transitions: each task step points to the next.
      if (legacySteps.length > 0) {
        for (let i = 0; i < legacySteps.length; i++) {
          const cur = legacySteps[i];
          const next = legacySteps[i + 1];
          if (next) {
            cur.transitions = [{
              toStepId: next.id,
              mode: (cur.transitionMode as TransitionMode) || "default",
              evaluatePrompt: cur.evaluatePrompt,
              forceContinue: cur.forceContinue,
            }];
          }
          steps.push(cur);
        }
        // Steps need to be in DAG order: do a topological sort if transitions
        // reference step ids. For now, just keep the original order if all
        // transitions point forward.
      }

      // For delay/code steps without transitions, attempt to wire them to
      // the next legacy step in order. This preserves the visual builder
      // output where users have alternating task/delay/code steps.
      if (steps.length > 0 && steps.every((s) => !s.transitions || s.transitions.length === 0)) {
        for (let i = 0; i < steps.length - 1; i++) {
          steps[i].transitions = [{
            toStepId: steps[i + 1].id,
            mode: (steps[i].transitionMode as TransitionMode) || "default",
            evaluatePrompt: steps[i].evaluatePrompt,
            forceContinue: steps[i].forceContinue,
          }];
        }
      }

      if (steps.length === 0) continue;

      const workflow: Workflow = {
        id: generateId(),
        name: this.ensureUniqueWorkflowName(ew.name),
        area: ew.area ?? "",
        description: ew.description ?? "",
        steps,
        status: "pending",
        currentStep: -1,
        createdAt: new Date().toISOString(),
        handoffBranch: ew.handoffBranch ?? false,
        handoffOutput: ew.handoffOutput ?? true,
        scheduleType: ew.scheduleType ?? "manual",
        scheduleTime: ew.scheduleTime ?? nowTimeString(),
        scheduleDate: ew.scheduleDate ?? "",
        scheduleDays: ew.scheduleDays ?? [],
        scheduleMonthDays: ew.scheduleMonthDays ?? [],
        scheduleIntervalValue: ew.scheduleIntervalValue ?? 10,
        scheduleIntervalUnit: ew.scheduleIntervalUnit ?? "minutes",
      };
      this.settings.workflows.push(workflow);
      workflowsImported++;
    }

    await this.saveSettings();
    return { tasksImported, workflowsImported };
  }

  async runWorkflow(workflow: Workflow) {
    const idx = this.settings.workflows.findIndex((w) => w.id === workflow.id);
    if (idx === -1) return;
    const wf = this.settings.workflows[idx];

    if (wf.steps.length === 0) {
      new Notice(`AutoOC: Workflow "${wf.name}" has no steps.`);
      return;
    }

    // Validate: every task step must reference a real task.
    for (let i = 0; i < wf.steps.length; i++) {
      const step = wf.steps[i];
      if (step.stepKind === "task" && !this.settings.tasks.find((t) => t.id === step.taskId)) {
        new Notice(`AutoOC: Workflow "${wf.name}" — step ${i + 1} references a deleted task.`);
        return;
      }
    }

    // Initialize the runtime context that flows between steps.
    (this as any).workflowRuntime = (this as any).workflowRuntime || new Map();
    (this as any).workflowRuntime.set(wf.id, {
      stepOutputs: new Map<string, string>(),
      stepIndex: 0,
    });

    wf.status = "running";
    wf.currentStep = 0;
    wf.lastRun = new Date().toISOString();
    wf.steps.forEach((step) => {
      step.status = "pending";
      step.output = "";
      step.lastRun = "";
    });
    await this.saveSettings();
    new Notice(`AutoOC: ⚡ Starting workflow "${wf.name}" (${wf.steps.length} steps)...`);

    // Find the entry step: one with no incoming transitions, or the first step.
    const entryStep = this.findEntryStep(wf);
    if (!entryStep) {
      wf.status = "failed";
      await this.saveSettings();
      new Notice(`AutoOC: Workflow "${wf.name}" has no reachable entry step.`);
      return;
    }
    await this.runWorkflowStepById(wf.id, entryStep.id);
  }

  // Find the entry step: a step that has no incoming transitions from any other
  // step in the workflow. If multiple are candidates, picks the one with the
  // smallest position.x (visual order). Falls back to the first step.
  findEntryStep(wf: Workflow): WorkflowStep | null {
    if (wf.steps.length === 0) return null;
    const incoming = new Set<string>();
    for (const s of wf.steps) {
      for (const t of s.transitions || []) {
        incoming.add(t.toStepId);
      }
    }
    const candidates = wf.steps.filter((s) => !incoming.has(s.id));
    if (candidates.length === 0) return wf.steps[0];
    candidates.sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0));
    return candidates[0];
  }

  async runWorkflowStepById(workflowId: string, stepId: string): Promise<void> {
    const wfIdx = this.settings.workflows.findIndex((w) => w.id === workflowId);
    if (wfIdx === -1) return;
    const wf = this.settings.workflows[wfIdx];
    if (!wf || wf.status !== "running") return;
    const stepIdx = wf.steps.findIndex((s) => s.id === stepId);
    if (stepIdx === -1) {
      wf.status = "failed";
      new Notice(`AutoOC: Workflow "${wf.name}" — step ${stepId} not found.`);
      await this.saveSettings();
      return;
    }
    if (this.stoppingWorkflows.has(workflowId)) return;
    await this.runWorkflowStep(wfIdx, stepIdx);
  }

  // Resolve the next step from a list of transitions. For each transition:
  // - "force" / "default": follow unconditionally if the previous step
  //   succeeded (force ignores failure, default requires success).
  // - "eval": call the model to decide.
  // - "conditional": evaluate the JS `condition` against the runtime
  //   context (input = last output, outputs = map of stepId → output).
  // Returns the target step id, or null if the workflow should stop.
  async resolveNextStep(
    wf: Workflow,
    currentStep: WorkflowStep,
    currentStepIndex: number,
    lastOutput: string,
    lastSucceeded: boolean,
    transitions: WorkflowTransition[]
  ): Promise<{ nextStepId: string | null; reason: string }> {
    if (!transitions || transitions.length === 0) {
      // Default: linear +1 if it exists.
      const next = wf.steps[currentStepIndex + 1];
      if (next) return { nextStepId: next.id, reason: "linear" };
      return { nextStepId: null, reason: "end" };
    }
    for (const t of transitions) {
      const target = wf.steps.find((s) => s.id === t.toStepId);
      if (!target) continue;
      if (t.mode === "force" || t.forceContinue) {
        return { nextStepId: t.toStepId, reason: "force" };
      }
      if (t.mode === "default") {
        if (lastSucceeded) return { nextStepId: t.toStepId, reason: "default" };
        continue;
      }
      if (t.mode === "eval") {
        new Notice(`AutoOC: Evaluating transition for "${wf.name}" → ${target.id}...`);
        try {
          const cwd = this.settings.workingDirectory || (this.app.vault.adapter as any).basePath || ".";
          const model = this.availableModels[0]?.value || this.settings.defaultModel || "opencode/default";
          const prompt = t.evaluatePrompt?.trim() || "Did the previous step complete successfully? If it is safe to continue, reply YES. Otherwise reply NO.";
          const evalFullPrompt = `${prompt}\n\nPrevious step output:\n---\n${lastOutput}\n---\n\nReply ONLY with YES or NO.`;
          const evalResult = await this.evaluateWithOpencode(evalFullPrompt, model, cwd);
          const isYes = /\bYES\b/i.test(evalResult.output) && !/\bNO\b/i.test(evalResult.output);
          if (isYes) {
            return { nextStepId: t.toStepId, reason: "eval:yes" };
          }
        } catch (err) {
          new Notice(`AutoOC: eval error — ${String(err)}`);
        }
        continue;
      }
      if (t.mode === "conditional") {
        try {
          const ok = this.evaluateCondition(t.condition || "", lastOutput, this.getRuntimeOutputs(wf.id));
          if (ok) return { nextStepId: t.toStepId, reason: "conditional:true" };
        } catch (err) {
          new Notice(`AutoOC: condition error — ${String(err)}`);
        }
        continue;
      }
    }
    return { nextStepId: null, reason: "no-match" };
  }

  getRuntimeOutputs(workflowId: string): Record<string, string> {
    const rt = (this as any).workflowRuntime;
    if (!rt) return {};
    const ctx = rt.get(workflowId);
    if (!ctx) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of ctx.stepOutputs.entries()) out[k] = v;
    return out;
  }

  // Run a JavaScript condition expression against a runtime context.
  // Variables exposed: input (last step output), outputs (map of stepId → output),
  // workflow (object with name/id), step (current step), require (Node require).
  evaluateCondition(expression: string, input: string, outputs: Record<string, string>): boolean {
    if (!expression || !expression.trim()) return false;
    const vm = require("vm");
    const sandbox = {
      input: input || "",
      outputs,
      String,
      Number,
      Boolean,
      Array,
      Object,
      JSON,
      Math,
      Date,
      RegExp,
      console: { log: () => {} },
    };
    vm.createContext(sandbox);
    const src = expression.trim().startsWith("return") ? `(function(){ ${expression} })()` : `(${expression})`;
    const result = vm.runInContext(src, sandbox, { timeout: 500 });
    return !!result;
  }

  async runWorkflowStep(wfIdx: number, stepIndex: number) {
    const wf = this.settings.workflows[wfIdx];
    if (!wf || wf.status !== "running") return;
    const step = wf.steps[stepIndex];
    if (!step) {
      wf.status = "completed";
      await this.saveSettings();
      return;
    }
    step.status = "running";
    step.lastRun = new Date().toISOString();
    step.output = "";
    await this.saveSettings();

    // Record the current step in the runtime.
    const rt = (this as any).workflowRuntime.get(wf.id);
    if (rt) rt.stepIndex = stepIndex;

    // Dispatch by stepKind.
    if (step.stepKind === "delay") {
      await this.runDelayStep(wf, step, stepIndex);
      return;
    }
    if (step.stepKind === "code") {
      await this.runCodeStep(wf, step, stepIndex);
      return;
    }

    // Default: task step.
    await this.runTaskStep(wf, step, stepIndex);
  }

  async runDelayStep(wf: Workflow, step: WorkflowStep, stepIndex: number) {
    const value = Math.max(0, step.delayValue || 0);
    const unit = step.delayUnit || "seconds";
    const ms = value * (unit === "hours" ? 3600_000 : unit === "minutes" ? 60_000 : 1000);
    const ctx = (this as any).workflowRuntime.get(wf.id);
    if (ctx) ctx.stepOutputs.set(step.id, `[delay ${value} ${unit}]`);
    new Notice(`AutoOC: ⏱ Waiting ${value} ${unit} in "${wf.name}"...`);
    if (this.stoppingWorkflows.has(wf.id)) {
      await this.completeStep(wf, step, stepIndex, true, "[delay skipped: workflow stopped]");
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
    await this.completeStep(wf, step, stepIndex, true, `[delay ${value} ${unit}]`);
  }

  async runCodeStep(wf: Workflow, step: WorkflowStep, stepIndex: number) {
    const ctx = (this as any).workflowRuntime.get(wf.id);
    const inputVar = step.codeInputVar || "input";
    const outputVar = step.codeOutputVar || "output";
    const inputVal = (ctx && ctx.stepOutputs.size > 0) ? Array.from(ctx.stepOutputs.values()).pop() : "";
    const outputs: Record<string, string> = {};
    if (ctx) for (const [k, v] of ctx.stepOutputs.entries()) outputs[k] = v;
    const vm = require("vm");
    const vaultBase = (this.app.vault.adapter as any).basePath || ".";
    const defaultCwd = this.settings.workingDirectory || vaultBase;
    const resolveInVault = (p: string) => {
      const resolved = path.resolve(vaultBase, p || ".");
      const root = path.resolve(vaultBase);
      if (resolved !== root && !resolved.startsWith(root + path.sep)) {
        throw new Error(`Path escapes vault: ${p}`);
      }
      return resolved;
    };
    const readText = (p: string) => fs.readFileSync(p, "utf8");
    const writeText = (p: string, content: any) => {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, String(content), "utf8");
      return p;
    };
    const sandbox: Record<string, any> = {
      input: inputVal,
      outputs,
      String, Number, Boolean, Array, Object, JSON, Math, Date, RegExp,
      console: { log: () => {} },
    };
    if (step.codeAllowVault) {
      sandbox.vault = {
        basePath: vaultBase,
        resolve: (p: string) => resolveInVault(p),
        read: (p: string) => readText(resolveInVault(p)),
        write: (p: string, content: any) => writeText(resolveInVault(p), content),
        append: (p: string, content: any) => {
          const full = resolveInVault(p);
          fs.mkdirSync(path.dirname(full), { recursive: true });
          fs.appendFileSync(full, String(content), "utf8");
          return full;
        },
        exists: (p: string) => fs.existsSync(resolveInVault(p)),
        list: (p = ".") => fs.readdirSync(resolveInVault(p)),
      };
    }
    if (step.codeAllowFiles) {
      sandbox.files = {
        cwd: defaultCwd,
        resolve: (p: string) => path.isAbsolute(p) ? path.resolve(p) : path.resolve(defaultCwd, p || "."),
        read: (p: string) => readText(path.isAbsolute(p) ? path.resolve(p) : path.resolve(defaultCwd, p)),
        write: (p: string, content: any) => writeText(path.isAbsolute(p) ? path.resolve(p) : path.resolve(defaultCwd, p), content),
        append: (p: string, content: any) => {
          const full = path.isAbsolute(p) ? path.resolve(p) : path.resolve(defaultCwd, p);
          fs.mkdirSync(path.dirname(full), { recursive: true });
          fs.appendFileSync(full, String(content), "utf8");
          return full;
        },
        exists: (p: string) => fs.existsSync(path.isAbsolute(p) ? path.resolve(p) : path.resolve(defaultCwd, p)),
        list: (p = ".") => fs.readdirSync(path.isAbsolute(p) ? path.resolve(p) : path.resolve(defaultCwd, p)),
      };
    }
    if (step.codeAllowTerminal) {
      const { execSync } = require("child_process");
      sandbox.terminal = {
        run: (command: string, options: { cwd?: string; timeoutMs?: number } = {}) => execSync(String(command), {
          cwd: options.cwd ? (path.isAbsolute(options.cwd) ? options.cwd : path.resolve(defaultCwd, options.cwd)) : defaultCwd,
          timeout: Math.min(Math.max(options.timeoutMs || 30_000, 1_000), 600_000),
          encoding: "utf8",
        }),
      };
    }
    try {
      const context = vm.createContext(sandbox);
      const code = step.code || "";
      // Expose the configured variable names by aliasing `input` and `outputs`.
      // We prepend a small preamble so the user can name their input/output
      // variables freely while we still inject the standard ones.
      const preamble = `var ${inputVar} = input; var ${outputVar} = "";`;
      const result = vm.runInContext(preamble + "\n" + code + "\n;" + outputVar, context, { timeout: 900_000 });
      const out = String(result == null ? "" : result);
      if (ctx) ctx.stepOutputs.set(step.id, out);
      new Notice(`AutoOC: ⚙ Code step completed in "${wf.name}" (${out.length} chars)`);
      await this.completeStep(wf, step, stepIndex, true, out);
    } catch (err) {
      const msg = `[code error: ${String(err)}]`;
      if (ctx) ctx.stepOutputs.set(step.id, msg);
      new Notice(`AutoOC: ❌ Code step failed in "${wf.name}" — ${String(err)}`);
      await this.completeStep(wf, step, stepIndex, false, msg);
    }
  }

  async runTaskStep(wf: Workflow, step: WorkflowStep, stepIndex: number) {
    const taskIdx = this.settings.tasks.findIndex((t) => t.id === step.taskId);
    if (taskIdx === -1) {
      wf.status = "failed";
      new Notice(`AutoOC: Workflow "${wf.name}" failed — task not found at step ${stepIndex + 1}.`);
      await this.saveSettings();
      return;
    }
    const task = this.settings.tasks[taskIdx];
    const taskOverrides: Partial<Pick<ScheduledTask, "prompt" | "branch" | "createBranch">> = {};

    // Apply handoff from the most recent task/code step in the runtime.
    if (wf.handoffOutput) {
      const ctx = (this as any).workflowRuntime.get(wf.id);
      if (ctx && ctx.stepOutputs.size > 0) {
        const previousOutput: string = String(Array.from(ctx.stepOutputs.values()).pop() || "");
        const cleanOutput = extractContextForHandoff(previousOutput);
        if (cleanOutput) {
          const contextBlock = ` Previous step output to use as context: ${cleanOutput} End of previous step output.`;
          taskOverrides.prompt = `${task.prompt}${contextBlock}`;
        }
      }
    }

    wf.currentStep = stepIndex;
    await this.saveSettings();

    await this.runTask(task, async (completedTask, exitCode) => {
      const currentWf = this.settings.workflows.find((w) => w.id === wf.id);
      if (!currentWf || currentWf.status !== "running" || this.stoppingWorkflows.has(currentWf.id)) return;
      const currentStep = currentWf.steps[stepIndex];
      const lastOutput = completedTask.output || "";
      const ctx = (this as any).workflowRuntime.get(currentWf.id);
      if (ctx) ctx.stepOutputs.set(currentStep.id, lastOutput);
      const lastSucceeded = exitCode === 0 && completedTask.status !== "failed";

      const transitions = currentStep.transitions && currentStep.transitions.length > 0
        ? currentStep.transitions
        : (() => {
            // Legacy fallback: synthesize a single transition from the
            // current step to the next step in array order using the
            // transitionMode field.
            const next = currentWf.steps[stepIndex + 1];
            if (!next) return [];
            const mode = (currentStep.transitionMode as TransitionMode) || "default";
            return [{
              toStepId: next.id,
              mode,
              evaluatePrompt: currentStep.evaluatePrompt,
              forceContinue: currentStep.forceContinue,
            } as WorkflowTransition];
          })();

      const { nextStepId, reason } = await this.resolveNextStep(
        currentWf,
        currentStep,
        stepIndex,
        lastOutput,
        lastSucceeded,
        transitions
      );

      if (!nextStepId) {
        const failedByTask = !lastSucceeded;
        currentWf.status = failedByTask ? "failed" : "completed";
        completedTask.output += failedByTask
          ? `\n[Workflow failed at step ${stepIndex + 1}/${currentWf.steps.length}]`
          : `\n[Workflow completed at step ${stepIndex + 1}/${currentWf.steps.length}]`;
        new Notice(
          failedByTask
            ? `AutoOC: ❌ Workflow "${currentWf.name}" failed at step ${stepIndex + 1}/${currentWf.steps.length}.`
            : `AutoOC: ✅ Workflow "${currentWf.name}" completed at step ${stepIndex + 1}/${currentWf.steps.length}.`
        );
        // Clear runtime context for this workflow.
        (this as any).workflowRuntime.delete(currentWf.id);
        await this.saveSettings();
        return;
      }

      const nextIdx = currentWf.steps.findIndex((s) => s.id === nextStepId);
      if (nextIdx === -1) {
        currentWf.status = "failed";
        new Notice(`AutoOC: ❌ Workflow "${currentWf.name}" — transition target ${nextStepId} not found.`);
        await this.saveSettings();
        return;
      }

      currentWf.currentStep = nextIdx;
      await this.saveSettings();
      new Notice(`AutoOC: ⚡ Workflow "${currentWf.name}" → step ${nextIdx + 1}/${currentWf.steps.length} (${reason})`);
      setTimeout(() => {
        this.runWorkflowStepById(currentWf.id, nextStepId);
      }, 200);
    }, taskOverrides);
  }

  // Complete a non-task step and move to the next one.
  async completeStep(wf: Workflow, step: WorkflowStep, stepIndex: number, succeeded: boolean, output: string) {
    const ctx = (this as any).workflowRuntime.get(wf.id);
    if (ctx) ctx.stepOutputs.set(step.id, output);
    step.status = succeeded ? "completed" : "failed";
    step.output = output;
    step.lastRun = new Date().toISOString();
    const transitions = step.transitions && step.transitions.length > 0
      ? step.transitions
      : (() => {
          const wfRef = this.settings.workflows.find((w) => w.id === wf.id);
          if (!wfRef) return [];
          const next = wfRef.steps[stepIndex + 1];
          if (!next) return [];
          return [{ toStepId: next.id, mode: "default" as TransitionMode }];
        })();

    const { nextStepId, reason } = await this.resolveNextStep(
      wf, step, stepIndex, output, succeeded, transitions
    );

    if (!nextStepId) {
      const wfRef = this.settings.workflows.find((w) => w.id === wf.id);
      if (wfRef) {
        wfRef.status = succeeded ? "completed" : "failed";
        await this.saveSettings();
        new Notice(succeeded
          ? `AutoOC: ✅ Workflow "${wfRef.name}" completed.`
          : `AutoOC: ❌ Workflow "${wfRef.name}" failed.`);
      }
      (this as any).workflowRuntime.delete(wf.id);
      return;
    }
    const wfRef = this.settings.workflows.find((w) => w.id === wf.id);
    if (wfRef) {
      const nextIdx = wfRef.steps.findIndex((s) => s.id === nextStepId);
      if (nextIdx >= 0) {
        wfRef.currentStep = nextIdx;
        await this.saveSettings();
        new Notice(`AutoOC: ⚡ Workflow "${wfRef.name}" → step ${nextIdx + 1}/${wfRef.steps.length} (${reason})`);
        setTimeout(() => this.runWorkflowStepById(wf.id, nextStepId), 200);
      }
    }
  }
}

// ─── Sidebar View ─────────────────────────────────────────────────────────────

class AutoOCView extends ItemView {
  private plugin: AutoOCPlugin;
  private filterText: string = "";
  private filterStatus: string = "all";
  private filterArea: string = "all";
  private currentTab: "dashboard" | "tasks" | "workflows" | "secrets" = "dashboard";
  private expandedTasks: Set<string> = new Set();
  private expandedWorkflows: Set<string> = new Set();
  private dashboardPositions: Map<string, { x: number; y: number; size?: number; sizePx?: number }> = new Map();
  // Accumulated drift per task, in physical px relative to the map's own
  // height (NOT a %-of-immediate-parent value) — keeps rise/sink distance
  // visually consistent whether a task bubble sits loose on the map or is
  // nested two levels deep inside an area/workflow ring.
  private dashboardTaskShift: Map<string, number> = new Map();
  private sinkIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private dashboardTaskDriftDirection: Map<string, "up" | "down"> = new Map();
  private dashboardLayoutSignature: string = "";
  private showDashboardKpis: boolean = false;
  // Watches the map's real rendered size so bubble sizing (task bubbles are
  // fixed px, capped to fit their parent) gets recomputed when the pane is
  // resized. Percentage-based left/top/width already reflow for free via
  // CSS, but nothing else in this view listens for layout size changes, so
  // without this, shrinking the canvas leaves stale px sizes that overflow
  // their now-smaller container.
  private dashboardResizeObserver: ResizeObserver | null = null;
  private unsubscribeTaskUpdated?: () => void;
  private unsubscribeWorkflowUpdated?: () => void;
  // Set right before a resize-triggered render so renderDashboard's settle+fit
  // pass runs even though the task/workflow structure didn't change (normally
  // that pass is skipped on unchanged layouts to avoid redoing work every
  // render — see the guard in renderDashboard).
  private forceDashboardFitOnNextRender = false;

  constructor(leaf: WorkspaceLeaf, plugin: AutoOCPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  private loadDashboardPositions() {
    this.dashboardPositions.clear();
    const saved = this.plugin.settings.dashboardPositions;
    if (saved) {
      for (const [key, pos] of Object.entries(saved)) {
        this.dashboardPositions.set(key, pos);
      }
    }
  }

  private async persistDashboardPositions() {
    const obj: Record<string, { x: number; y: number; size?: number; sizePx?: number }> = {};
    this.dashboardPositions.forEach((pos, key) => { obj[key] = pos; });
    this.plugin.settings.dashboardPositions = obj;
    await this.plugin.saveSettings(false);
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "AutoOC Scheduler"; }
  getIcon() { return "workflow"; }

  async onOpen() {
    this.unsubscribeTaskUpdated = this.plugin.onTaskUpdated((task) => this.updateTaskNameDom(task));
    this.unsubscribeWorkflowUpdated = this.plugin.onWorkflowUpdated((workflow) => this.updateWorkflowNameDom(workflow));
    this.loadDashboardPositions();
    this.render();
  }
  async onClose() {
    this.unsubscribeTaskUpdated?.();
    this.unsubscribeWorkflowUpdated?.();
    this.unsubscribeTaskUpdated = undefined;
    this.unsubscribeWorkflowUpdated = undefined;
    await this.persistDashboardPositions();
    this.dashboardResizeObserver?.disconnect();
    this.dashboardResizeObserver = null;
    this.sinkIntervals.forEach((iv) => clearInterval(iv));
    this.sinkIntervals.clear();
    this.dashboardTaskDriftDirection.clear();
  }
  refresh() { this.render(); }

  private updateTaskNameDom(task: ScheduledTask) {
    const usageCount = this.plugin.settings.workflows.reduce((count, workflow) => {
      return count + workflow.steps.filter((step) => step.taskId === task.id).length;
    }, 0);
    this.containerEl.querySelectorAll<HTMLElement>(`[data-auto-oc-task-id="${task.id}"]`).forEach((el) => {
      el.querySelector<HTMLElement>(".auto-oc-task-name")?.setText(task.name);
      const label = el.querySelector<HTMLElement>(".auto-oc-dashboard-hover-label");
      if (label) label.setText(task.name);
      if (el.classList.contains("auto-oc-dashboard-task-bubble")) {
        el.setAttr("aria-label", `Task: ${task.name}. Status: ${task.status}. Usage count: ${usageCount}. Press Enter to open in Tasks.`);
      }
    });
  }

  private updateWorkflowNameDom(workflow: Workflow) {
    const area = workflow.area?.trim() || "No area";
    this.containerEl.querySelectorAll<HTMLElement>(`[data-auto-oc-workflow-id="${workflow.id}"]`).forEach((el) => {
      el.querySelector<HTMLElement>(".auto-oc-task-name")?.setText(workflow.name);
      const label = el.querySelector<HTMLElement>(".auto-oc-dashboard-hover-label");
      if (label) label.setText(workflow.name);
      if (el.classList.contains("auto-oc-dashboard-workflow-bubble")) {
        el.setAttr("aria-label", `Workflow: ${workflow.name}. Area: ${area}. Status: ${workflow.status}. Press Enter to open in WorkFlows.`);
      }
    });
  }

  resetDashboardTaskShift(taskId: string) {
    const existing = this.sinkIntervals.get(taskId);
    if (existing) { clearInterval(existing); this.sinkIntervals.delete(taskId); }
    this.dashboardTaskDriftDirection.delete(taskId);
    this.dashboardTaskShift.delete(taskId);
  }

  nudgeDashboardTask(taskId: string, direction: "up" | "down", amountPct = 1.8, maxShiftPct = 18) {
    void taskId;
    void direction;
    void amountPct;
    void maxShiftPct;
    // Do not move persisted/dashboard positions automatically. Status-driven
    // drift fights pointer drag and the collision solver when tasks remain
    // running/failed, producing the visible micro-loop and center collapse.
  }

  // Mirrors the class-selector check used inside renderDashboard's drag/collision
  // closures, so drift-driven nudges (heartbeat rise, gradual sink) can reuse the
  // same sibling-push behavior as manual dragging without needing access to
  // renderDashboard's local scope.
  private isDashboardBubbleEl(el: Element): el is HTMLElement {
    return el instanceof HTMLElement && (
      el.classList.contains("auto-oc-dashboard-area-bubble")
      || el.classList.contains("auto-oc-dashboard-workflow-bubble")
      || el.classList.contains("auto-oc-dashboard-task-bubble")
    );
  }

  // Task bubbles render at a fixed physical px diameter (see TASK_BUBBLE_PX
  // in renderDashboard), not a %, so their width never means "this task's
  // saved size" — persisting it would just re-inject a stray px number where
  // a % is expected next render (area/workflow top-level layout reuses
  // saved.size as a %). Only area/workflow bubbles have a meaningful size to
  // remember across renders/drags.
  private parseBubbleSizeForSave(bubble: HTMLElement): number | undefined {
    if (bubble.classList.contains("auto-oc-dashboard-task-bubble")) return undefined;
    return parseFloat(bubble.style.width || "0") || undefined;
  }

  private parseBubbleSizePxForSave(bubble: HTMLElement): number | undefined {
    if (bubble.classList.contains("auto-oc-dashboard-task-bubble")) return undefined;
    const width = bubble.getBoundingClientRect().width;
    return Number.isFinite(width) && width > 0 ? Math.round(width * 100) / 100 : undefined;
  }

  private clampDashboardBubbleToParent(bubble: HTMLElement) {
    const parent = bubble.offsetParent as HTMLElement | null;
    if (!parent) return;
    const bounds = parent.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return;
    const rect = bubble.getBoundingClientRect();
    const widthPct = (rect.width / bounds.width) * 100;
    const heightPct = (rect.height / bounds.height) * 100;
    let leftPct = ((rect.left - bounds.left) / bounds.width) * 100;
    let topPct = ((rect.top - bounds.top) / bounds.height) * 100;

    if (this.isDashboardBubbleEl(parent)) {
      const parentRadius = Math.min(bounds.width, bounds.height) / 2;
      const bubbleRadius = rect.width / 2;
      const parentCenterX = bounds.left + bounds.width / 2;
      const parentCenterY = bounds.top + bounds.height / 2;
      const bubbleCenterX = rect.left + rect.width / 2;
      const bubbleCenterY = rect.top + rect.height / 2;
      let dx = bubbleCenterX - parentCenterX;
      let dy = bubbleCenterY - parentCenterY;
      let distance = Math.hypot(dx, dy);
      const maxDistance = Math.max(0, parentRadius - bubbleRadius * 0.88);
      if (distance > maxDistance) {
        if (distance < 0.01) { dx = 1; dy = 0; distance = 1; }
        const nextCenterX = parentCenterX + (dx / distance) * maxDistance;
        const nextCenterY = parentCenterY + (dy / distance) * maxDistance;
        leftPct = ((nextCenterX - bubbleRadius - bounds.left) / bounds.width) * 100;
        topPct = ((nextCenterY - bubbleRadius - bounds.top) / bounds.height) * 100;
      }
    }

    bubble.style.left = `${Math.max(0, Math.min(100 - widthPct, leftPct))}%`;
    bubble.style.top = `${Math.max(0, Math.min(100 - heightPct, topPct))}%`;
  }

  // Same "push siblings out of the way" behavior used while dragging a bubble
  // (attachBubbleDrag's resolveSiblingCollisions), but callable from outside
  // renderDashboard's scope so drift ticks can trigger it too.
  private resolveDashboardSiblingCollisions(el: HTMLElement) {
    const parent = el.offsetParent as HTMLElement | null;
    if (!parent) return;
    const bounds = parent.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return;
    const bubbles = Array.from(parent.children).filter((child): child is HTMLElement => this.isDashboardBubbleEl(child));
    let frontier = new Set<HTMLElement>([el]);

    for (let pass = 0; pass < 5 && frontier.size > 0; pass++) {
      const nextFrontier = new Set<HTMLElement>();
      for (const a of frontier) {
        for (const b of bubbles) {
          if (a === b) continue;
          const aRect = a.getBoundingClientRect();
          const bRect = b.getBoundingClientRect();
          const aRadius = aRect.width / 2;
          const bRadius = bRect.width / 2;
          const aCenterX = aRect.left + aRadius;
          const aCenterY = aRect.top + aRect.height / 2;
          const bCenterX = bRect.left + bRadius;
          const bCenterY = bRect.top + bRect.height / 2;
          let dx = bCenterX - aCenterX;
          let dy = bCenterY - aCenterY;
          let distance = Math.hypot(dx, dy);
          const minDistance = aRadius + bRadius + 4;
          if (distance >= minDistance) continue;
          if (distance < 0.01) {
            const angle = ((bubbles.indexOf(a) + bubbles.indexOf(b) + pass) / Math.max(bubbles.length, 1)) * Math.PI * 2;
            dx = Math.cos(angle);
            dy = Math.sin(angle);
            distance = 1;
          }
          const push = (minDistance - distance) * 1.05;
          const moveBubble = (bubble: HTMLElement, rect: DOMRect, amount: number) => {
            if (amount === 0) return;
            const nextLeftPx = rect.left - bounds.left + (dx / distance) * amount;
            const nextTopPx = rect.top - bounds.top + (dy / distance) * amount;
            const nextLeftPct = (nextLeftPx / bounds.width) * 100;
            const nextTopPct = (nextTopPx / bounds.height) * 100;
            const widthPct = (rect.width / bounds.width) * 100;
            const heightPct = (rect.height / bounds.height) * 100;
            bubble.style.left = `${Math.max(0, Math.min(100 - widthPct, nextLeftPct))}%`;
            bubble.style.top = `${Math.max(0, Math.min(100 - heightPct, nextTopPct))}%`;
          };
          moveBubble(b, bRect, push);
          this.clampDashboardBubbleToParent(b);
          const nextARect = a.getBoundingClientRect();
          const nextBRect = b.getBoundingClientRect();
          const nextARadius = nextARect.width / 2;
          const nextBRadius = nextBRect.width / 2;
          const nextDx = nextBRect.left + nextBRadius - (nextARect.left + nextARadius);
          const nextDy = nextBRect.top + nextBRect.height / 2 - (nextARect.top + nextARect.height / 2);
          const nextDistance = Math.max(Math.hypot(nextDx, nextDy), 1);
          const residual = minDistance - nextDistance;
          if (residual > 0.5) {
            moveBubble(a, nextARect, -residual * 0.55);
            this.clampDashboardBubbleToParent(a);
          }
          nextFrontier.add(b);
        }
      }
      frontier = nextFrontier;
    }

    bubbles.forEach((bubble) => {
      const key = bubble.getAttribute("data-dashboard-key");
      if (!key) return;
      this.dashboardPositions.set(key, {
        x: parseFloat(bubble.style.left || "0"),
        y: parseFloat(bubble.style.top || "0"),
        size: this.parseBubbleSizeForSave(bubble),
        sizePx: this.parseBubbleSizePxForSave(bubble),
      });
    });
  }

  // Same all-pairs, multi-pass settle used when a manual drag is released
  // (renderDashboard's settleBubbleCollisions), ported so drift ticks can
  // call it too. The chained push above only resolves collisions along the
  // path from the moved bubble; this catches any remaining overlap between
  // siblings that weren't directly touched — e.g. two tasks that each drifted
  // independently (both running) and happened to end up on top of each other.
  private settleDashboardBubbleCollisions(parent: HTMLElement, passes = 10) {
    const bubbles = Array.from(parent.children).filter((child): child is HTMLElement => this.isDashboardBubbleEl(child));
    const bounds = parent.getBoundingClientRect();
    if (bubbles.length < 2 || bounds.width === 0 || bounds.height === 0) return;

    for (let pass = 0; pass < passes; pass++) {
      let movedAny = false;
      for (let i = 0; i < bubbles.length; i++) {
        for (let j = i + 1; j < bubbles.length; j++) {
          const a = bubbles[i];
          const b = bubbles[j];
          const aRect = a.getBoundingClientRect();
          const bRect = b.getBoundingClientRect();
          const aRadius = aRect.width / 2;
          const bRadius = bRect.width / 2;
          const aCenterX = aRect.left + aRadius;
          const aCenterY = aRect.top + aRect.height / 2;
          const bCenterX = bRect.left + bRadius;
          const bCenterY = bRect.top + bRect.height / 2;
          let dx = bCenterX - aCenterX;
          let dy = bCenterY - aCenterY;
          let distance = Math.hypot(dx, dy);
          const minDistance = aRadius + bRadius + 2;
          if (distance >= minDistance) continue;
          if (distance < 0.01) {
            const angle = ((i + j + pass) / Math.max(bubbles.length, 1)) * Math.PI * 2;
            dx = Math.cos(angle);
            dy = Math.sin(angle);
            distance = 1;
          }
          const push = (minDistance - distance) * 0.75;
          const moveBubble = (bubble: HTMLElement, rect: DOMRect, amount: number) => {
            const nextLeftPx = rect.left - bounds.left + (dx / distance) * amount;
            const nextTopPx = rect.top - bounds.top + (dy / distance) * amount;
            const nextLeftPct = (nextLeftPx / bounds.width) * 100;
            const nextTopPct = (nextTopPx / bounds.height) * 100;
            const widthPct = (rect.width / bounds.width) * 100;
            const heightPct = (rect.height / bounds.height) * 100;
            bubble.style.left = `${Math.max(0, Math.min(100 - widthPct, nextLeftPct))}%`;
            bubble.style.top = `${Math.max(0, Math.min(100 - heightPct, nextTopPct))}%`;
            this.clampDashboardBubbleToParent(bubble);
          };
          moveBubble(a, aRect, -push);
          moveBubble(b, bRect, push);
          movedAny = true;
        }
      }
      if (!movedAny) break;
    }

    bubbles.forEach((bubble) => {
      const key = bubble.getAttribute("data-dashboard-key");
      if (!key) return;
      this.dashboardPositions.set(key, {
        x: parseFloat(bubble.style.left || "0"),
        y: parseFloat(bubble.style.top || "0"),
        size: this.parseBubbleSizeForSave(bubble),
        sizePx: this.parseBubbleSizePxForSave(bubble),
      });
    });
  }

  private startDashboardTaskDrift(taskId: string, direction: "up" | "down", stepPct = 6, maxPct = 50) {
    const existing = this.sinkIntervals.get(taskId);
    if (existing) { clearInterval(existing); this.sinkIntervals.delete(taskId); }
    this.dashboardTaskDriftDirection.delete(taskId);
    this.dashboardTaskShift.delete(taskId);
    void direction;
    void stepPct;
    void maxPct;
  }

  startGradualSink(taskId: string, stepPct = 6, maxPct = 50) {
    void stepPct;
    void maxPct;
    this.resetDashboardTaskShift(taskId);
  }

  private syncDashboardTaskDrift(tasks: ScheduledTask[]) {
    const activeTaskIds = new Set(tasks.map((task) => task.id));
    tasks.forEach((task) => this.resetDashboardTaskShift(task.id));
    Array.from(this.sinkIntervals.keys()).forEach((taskId) => {
      if (activeTaskIds.has(taskId)) return;
      const existing = this.sinkIntervals.get(taskId);
      if (existing) clearInterval(existing);
      this.sinkIntervals.delete(taskId);
      this.dashboardTaskDriftDirection.delete(taskId);
      this.dashboardTaskShift.delete(taskId);
    });
  }

  // Re-renders the dashboard whenever the map's real pixel size changes
  // (e.g. the user resizes the sidebar/pane). Bubble positions/widths that
  // are %-based reflow for free via CSS, but task bubbles are deliberately
  // fixed px (capped to fit their parent — see taskBubbleSizeForParent), so
  // without this, shrinking the canvas leaves stale sizes that no longer
  // fit their now-smaller area/workflow ring. Debounced and gated on an
  // actual size delta to avoid feedback loops (this same re-render recreates
  // the map and re-attaches a fresh observer every time).
  private watchDashboardMapResize(map: HTMLElement) {
    this.dashboardResizeObserver?.disconnect();
    this.dashboardResizeObserver = null;
    void map;
  }

  // Purely decorative "aquarium" ambience behind the bubbles: soft caustic
  // light rays, small rising bubbles, and drifting dust motes. Everything is
  // pointer-events:none and lives in its own layer (z-index 0, below the
  // area/workflow/task bubbles at 1/4/8/9), so it never affects drag,
  // collision, or positioning logic. Positions/timings are derived from a
  // deterministic hash (not Math.random()) so the layer doesn't reshuffle
  // itself on every re-render.
  private createDashboardAmbientLayer(map: HTMLElement) {
    const ambient = map.createDiv("auto-oc-dashboard-ambient");
    const seededRandom = (seed: string) => {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
      return (Math.abs(hash) % 1000) / 1000;
    };

    // Two soft caustic light rays, slow diagonal drift
    for (let i = 0; i < 2; i++) {
      const ray = ambient.createDiv(`auto-oc-dashboard-ambient-ray${i === 1 ? " auto-oc-dashboard-ambient-ray-alt" : ""}`);
      ray.style.top = `${-20 + seededRandom(`ray-top-${i}`) * 28}%`;
    }

    // Small bubbles rising from the bottom, staggered depth via size/opacity/speed
    const bubbleCount = 10;
    for (let i = 0; i < bubbleCount; i++) {
      const seed = `ambient-bubble-${i}`;
      const size = 3 + seededRandom(`${seed}-size`) * 7; // 3–10px
      const left = seededRandom(`${seed}-left`) * 96; // 0–96%
      const duration = 14 + seededRandom(`${seed}-dur`) * 12; // 14–26s
      const delay = -(seededRandom(`${seed}-delay`) * duration); // stagger start point
      const opacity = 0.05 + seededRandom(`${seed}-op`) * 0.13; // 0.05–0.18

      const bubble = ambient.createDiv("auto-oc-dashboard-ambient-bubble");
      bubble.style.left = `${left}%`;
      bubble.style.width = `${size}px`;
      bubble.style.height = `${size}px`;
      bubble.style.opacity = `${opacity}`;
      bubble.style.animationDuration = `${duration}s`;
      bubble.style.animationDelay = `${delay}s`;
    }

    // Tiny drifting dust/plankton motes
    const dustCount = 8;
    for (let i = 0; i < dustCount; i++) {
      const seed = `ambient-dust-${i}`;
      const size = 1 + seededRandom(`${seed}-size`); // 1–2px
      const left = seededRandom(`${seed}-left`) * 96;
      const top = seededRandom(`${seed}-top`) * 90;
      const duration = 20 + seededRandom(`${seed}-dur`) * 10; // 20–30s
      const delay = -(seededRandom(`${seed}-delay`) * duration);
      const opacity = 0.04 + seededRandom(`${seed}-op`) * 0.04; // 0.04–0.08

      const dust = ambient.createDiv("auto-oc-dashboard-ambient-dust");
      dust.style.left = `${left}%`;
      dust.style.top = `${top}%`;
      dust.style.width = `${size}px`;
      dust.style.height = `${size}px`;
      dust.style.opacity = `${opacity}`;
      dust.style.animationDuration = `${duration}s`;
      dust.style.animationDelay = `${delay}s`;
    }
  }

  private openCli() {
    new OpenCodeCliModal(this.app, this.plugin).open();
  }

  private openTaskInList(task: ScheduledTask) {
    this.currentTab = "tasks";
    this.filterText = "";
    this.filterStatus = "all";
    this.expandedTasks.add(task.id);
    this.render();
    window.setTimeout(() => {
      this.containerEl.querySelector<HTMLElement>(`[data-auto-oc-task-id="${task.id}"]`)?.scrollIntoView({ block: "center" });
    }, 0);
  }

  private openWorkflowInList(workflow: Workflow) {
    this.currentTab = "workflows";
    this.expandedWorkflows.add(workflow.id);
    this.render();
    window.setTimeout(() => {
      this.containerEl.querySelector<HTMLElement>(`[data-auto-oc-workflow-id="${workflow.id}"]`)?.scrollIntoView({ block: "center" });
    }, 0);
  }

  render() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("auto-oc-view");

    // ── Row 0: extension header (title + version + update controls) ──
    this.renderHeader(containerEl);

    // ── Tab bar ──
    // The tab bar is split into multiple rows:
    //   Row 1 (left-aligned): the navigation tabs (Dashboard / Tasks /
    //                         WorkFlows / Visual Builder / OpenCode CLI)
    //   Row 2: creation button on the left, Export/Import on the right.
    //          The creation button is contextual to the active tab:
    //          "+ New Task" for Tasks, "+ New Workflow" for WorkFlows.
    const tabBar = containerEl.createDiv("auto-oc-tab-bar");

    // Row 1: navigation tabs
    const navRow = tabBar.createDiv("auto-oc-tab-row auto-oc-tab-row-nav");
    const btnDashboard = navRow.createEl("button", {
      text: "Dashboard",
      cls: "auto-oc-tab-btn",
    });
    btnDashboard.onclick = () => { this.currentTab = "dashboard"; this.render(); };

    const btnTasks = navRow.createEl("button", {
      text: "📋 Tasks",
      cls: "auto-oc-tab-btn",
    });
    btnTasks.onclick = () => { this.currentTab = "tasks"; this.render(); };

    const btnWorkflows = navRow.createEl("button", {
      text: "🔗 WorkFlows",
      cls: "auto-oc-tab-btn",
    });
    btnWorkflows.onclick = () => { this.currentTab = "workflows"; this.render(); };

    const btnSecrets = navRow.createEl("button", {
      text: "🔒 Secrets",
      cls: "auto-oc-tab-btn",
    });
    btnSecrets.title = "Manage local secrets injected into OpenCode as temporary environment variables";
    btnSecrets.onclick = () => { this.currentTab = "secrets"; this.render(); };

    const btnVisualBuilder = navRow.createEl("button", {
      text: "✨ WF Visual Builder",
      cls: "auto-oc-tab-btn",
    });
    btnVisualBuilder.title = "Open the n8n-style visual workflow builder (loads and saves to this extension)";
    btnVisualBuilder.onclick = () => this.plugin.openVisualBuilder();

    const btnPrompt = navRow.createEl("button", {
      text: "📝 WF Builder Prompt",
      cls: "auto-oc-tab-btn",
    });
    btnPrompt.title = "Copy this prompt to create your workflow";
    btnPrompt.onclick = async () => {
      try {
        await copyTextToClipboard(AUTOOC_WORKFLOW_PROMPT);
        new Notice("AutoOC: workflow creation prompt copied to clipboard.");
      } catch (err) {
        new Notice(`AutoOC: could not copy prompt — ${String(err)}`);
      }
    };

    const btnCli = navRow.createEl("button", {
      text: "💻 OpenCode CLI",
      cls: "auto-oc-tab-btn",
    });
    btnCli.onclick = () => this.openCli();

    // Row 2: creation button (left) + spacer + import/export (right).
    // The creation button is contextual to the active tab.
    const toolsRow = tabBar.createDiv("auto-oc-tab-row auto-oc-tab-row-tools");
    if (this.currentTab === "tasks") {
      const btnNewTask = toolsRow.createEl("button", {
        text: "+ New Task",
        cls: "auto-oc-btn-primary",
      });
      btnNewTask.onclick = () => new CreateTaskModal(this.app, this.plugin).open();
    } else if (this.currentTab === "workflows") {
      const btnNewWorkflow = toolsRow.createEl("button", {
        text: "+ New Workflow",
        cls: "auto-oc-btn-primary",
      });
      btnNewWorkflow.onclick = () => new CreateWorkflowModal(this.app, this.plugin).open();
    } else if (this.currentTab === "secrets") {
      const btnNewSecret = toolsRow.createEl("button", {
        text: "+ New Secret",
        cls: "auto-oc-btn-primary",
      });
      btnNewSecret.onclick = () => this.openSecretEditor();
    }
    const toolsSpacer = toolsRow.createDiv("auto-oc-tab-spacer");
    toolsSpacer.style.flex = "1";
    const btnExport = toolsRow.createEl("button", {
      text: "📤 Export",
      cls: "auto-oc-tab-btn",
    });
    btnExport.title = "Export tasks and workflows to JSON";
    btnExport.onclick = () => new ExportModal(this.app, this.plugin).open();

    const btnImport = toolsRow.createEl("button", {
      text: "📥 Import",
      cls: "auto-oc-tab-btn",
    });
    btnImport.title = "Import tasks and workflows from JSON";
    btnImport.onclick = () => new ImportModal(this.app, this.plugin).open();

    // Highlight active tab
    if (this.currentTab === "dashboard") btnDashboard.addClass("active");
    else if (this.currentTab === "tasks") btnTasks.addClass("active");
    else if (this.currentTab === "workflows") btnWorkflows.addClass("active");
    else if (this.currentTab === "secrets") btnSecrets.addClass("active");

    // ── Content ──
    if (this.currentTab === "dashboard") {
      this.renderDashboard(containerEl);
    } else if (this.currentTab === "workflows") {
      this.renderWorkflows(containerEl);
    } else if (this.currentTab === "secrets") {
      this.renderSecrets(containerEl);
    } else {
      this.renderTasks(containerEl);
    }
  }

  private async ensureSecretsUnlocked(): Promise<boolean> {
    const store = this.plugin.secretStore;
    if (!store.hasPin()) {
      const created = await new SecretsPinModal(this.app, store, "create").openAndWait();
      if (created) this.render();
      return created;
    }
    if (store.isUnlocked()) return true;
    return new SecretsPinModal(this.app, store, "unlock").openAndWait();
  }

  private async openSecretEditor(secret?: SecretRecord): Promise<void> {
    if (!await this.ensureSecretsUnlocked()) return;
    new SecretEditModal(this.app, this.plugin, secret, () => this.render()).open();
  }

  private async revealSecret(secret: SecretRecord): Promise<void> {
    if (!await this.ensureSecretsUnlocked()) return;
    try {
      const value = this.plugin.secretStore.decryptValue(secret);
      new SecretRevealModal(this.app, secret, value).open();
    } catch (e) {
      new Notice(`AutoOC: could not reveal secret — ${String(e)}`);
    }
  }

  private async copySecretValue(secret: SecretRecord): Promise<void> {
    if (!await this.ensureSecretsUnlocked()) return;
    try {
      await copyTextToClipboard(this.plugin.secretStore.decryptValue(secret));
      new Notice(`AutoOC: copied ${secret.name}.`);
    } catch (e) {
      new Notice(`AutoOC: could not copy secret — ${String(e)}`);
    }
  }

  private async deleteSecret(secret: SecretRecord): Promise<void> {
    if (!await this.ensureSecretsUnlocked()) return;
    const confirmed = await new ConfirmModal(this.app, `Delete secret "${secret.name}"?`, "This cannot be undone.").openAndWait();
    if (!confirmed) return;
    this.plugin.secretStore.delete(secret.id);
    new Notice(`AutoOC: deleted secret ${secret.name}.`);
    this.render();
  }

  private async resetSecretsPin(): Promise<void> {
    const confirmed = await new ConfirmModal(
      this.app,
      "Reset Secrets PIN?",
      "This only removes the UI PIN. Encrypted secrets are kept. You can create a new PIN afterwards."
    ).openAndWait();
    if (!confirmed) return;
    this.plugin.secretStore.resetPin();
    new Notice("AutoOC: Secrets PIN reset. Secrets were kept.");
    this.render();
  }

  private async copyAutoOcMcpInstallJson(): Promise<void> {
    const snippet = {
      "autooc-mcp": this.plugin.getAutoOcMcpConfigBlock(),
    };
    await copyTextToClipboard(JSON.stringify(snippet, null, 2));
    new Notice("AutoOC: autooc-mcp install JSON copied.");
  }

  private async installAutoOcMcpInOpenCode(): Promise<void> {
    try {
      const result = await this.plugin.ensureAutoOcMcpEnabled();
      new Notice(
        result.changed
          ? `AutoOC: autooc-mcp installed at ${result.configPath}. Restart OpenCode.`
          : `AutoOC: autooc-mcp was already configured at ${result.configPath}.`
      );
    } catch (e) {
      new Notice(`AutoOC: could not install autooc-mcp — ${String(e)}`);
    }
  }

  private async copyUvInstallCommand(): Promise<void> {
    await copyTextToClipboard(getUvInstallCommand());
    new Notice("AutoOC: uv install command copied.");
  }

  private renderSecrets(containerEl: HTMLElement): void {
    const section = containerEl.createDiv("auto-oc-section auto-oc-secrets-section");
    section.createEl("h4", { text: "Secrets" });
    section.createEl("p", {
      text: "Paste values normally; AutoOC encrypts them when saving and injects them into OpenCode as temporary env vars.",
      cls: "setting-item-description",
    });

    const uvStatus = describeUvStatus();
    if (!uvStatus.available) {
      const uvWarning = section.createDiv("auto-oc-secrets-runtime-warning");
      uvWarning.createEl("strong", { text: "autooc-mcp needs uv" });
      uvWarning.createEl("p", {
        text: "uv is not installed or AutoOC cannot find it. Install uv before using the autooc-mcp installer.",
      });
      const copyUv = uvWarning.createEl("button", { text: "Copy uv install command", cls: "auto-oc-btn-secondary" });
      copyUv.onclick = () => this.copyUvInstallCommand();
    }

    if (!this.plugin.secretStore.isSecureStorageAvailable()) {
      section.createEl("p", {
        text: "Secure storage is not available on this system. Secrets cannot be created or revealed.",
        cls: "setting-item-description auto-oc-update-error",
      });
      return;
    }

    const actions = section.createDiv("auto-oc-task-actions");
    actions.addClass("auto-oc-secrets-toolbar");
    const lockBtn = actions.createEl("button", { text: "Lock", cls: "auto-oc-btn-secondary" });
    lockBtn.onclick = () => { this.plugin.secretStore.lock(); this.render(); };
    const resetBtn = actions.createEl("button", { text: "Reset PIN", cls: "auto-oc-btn-secondary" });
    resetBtn.onclick = () => this.resetSecretsPin();

    if (!this.plugin.secretStore.hasPin()) {
      section.createEl("p", {
        text: "No UI PIN is set yet. Create one before managing secrets.",
        cls: "setting-item-description",
      });
      const btn = section.createEl("button", { text: "Create PIN", cls: "auto-oc-btn-primary" });
      btn.onclick = () => this.ensureSecretsUnlocked();
      return;
    }

    if (!this.plugin.secretStore.isUnlocked()) {
      section.createEl("p", { text: "Secrets are locked.", cls: "setting-item-description" });
      const btn = section.createEl("button", { text: "Unlock Secrets", cls: "auto-oc-btn-primary" });
      btn.onclick = async () => { if (await this.ensureSecretsUnlocked()) this.render(); };
      return;
    }

    const installMcpBtn = actions.createEl("button", { text: "Install autooc-mcp in OpenCode", cls: "auto-oc-btn-primary" });
    installMcpBtn.title = "Write autooc-mcp into the global OpenCode config and create the local MCP server file.";
    installMcpBtn.onclick = () => this.installAutoOcMcpInOpenCode();

    const copyMcpBtn = actions.createEl("button", { text: "Copy autooc-mcp install JSON", cls: "auto-oc-btn-secondary" });
    copyMcpBtn.title = "Copy the OpenCode/harness config block that installs the local autooc-mcp server.";
    copyMcpBtn.onclick = () => this.copyAutoOcMcpInstallJson();

    const secrets = this.plugin.secretStore.list();
    if (secrets.length === 0) {
      section.createEl("p", { text: "No secrets yet. Use + New Secret to add one.", cls: "setting-item-description" });
      return;
    }

    const tableWrap = section.createDiv("auto-oc-secrets-table-wrap");
    const table = tableWrap.createEl("table", { cls: "auto-oc-secrets-table" });
    const thead = table.createEl("thead");
    const headRow = thead.createEl("tr");
    ["Name", "Env Var", "Type", "Profile", "Updated", "Actions"].forEach((h) => headRow.createEl("th", { text: h }));
    const tbody = table.createEl("tbody");
    for (const secret of secrets) {
      const row = tbody.createEl("tr");
      row.createEl("td", { text: secret.name, cls: "auto-oc-secret-name" });
      row.createEl("td", { text: secret.envName, cls: "auto-oc-secret-env" });
      const typeTd = row.createEl("td");
      typeTd.createSpan({ text: secret.type, cls: "auto-oc-secret-chip" });
      const profileTd = row.createEl("td");
      profileTd.createSpan({ text: secret.profile || "default", cls: "auto-oc-secret-chip auto-oc-secret-profile" });
      row.createEl("td", { text: secret.updatedAt ? new Date(secret.updatedAt).toLocaleString() : "" });
      const actionTd = row.createEl("td", { cls: "auto-oc-secrets-actions-cell" });
      const actionWrap = actionTd.createDiv("auto-oc-secrets-actions");
      const reveal = actionWrap.createEl("button", { text: "Reveal" });
      reveal.onclick = () => this.revealSecret(secret);
      const copyValue = actionWrap.createEl("button", { text: "Copy value" });
      copyValue.onclick = () => this.copySecretValue(secret);
      const copyEnv = actionWrap.createEl("button", { text: "Copy env" });
      copyEnv.onclick = async () => { await copyTextToClipboard(secret.envName); new Notice("AutoOC: env var copied."); };
      const edit = actionWrap.createEl("button", { text: "Edit" });
      edit.onclick = () => this.openSecretEditor(secret);
      const del = actionWrap.createEl("button", { text: "Delete", cls: "auto-oc-secret-danger" });
      del.onclick = () => this.deleteSecret(secret);
    }
  }

  // Renders the extension header at the top of the panel: title,
  // version, check-updates button, and a status pill when an update
  // is available or in progress. This was previously rendered inside
  // each tab's view; extracting it here keeps the title and update
  // controls visible at all times.
  private renderHeader(containerEl: HTMLElement): void {
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
  }

  private renderDashboard(containerEl: HTMLElement) {
    const statuses: TaskStatus[] = ["pending", "running", "completed", "failed"];
    const tasks = this.plugin.settings.tasks;
    const workflows = this.plugin.settings.workflows;

    if (tasks.length === 0 && workflows.length === 0) {
      const empty = containerEl.createDiv("auto-oc-empty auto-oc-dashboard-empty");
      empty.createEl("div", { text: "No activity yet", cls: "auto-oc-dashboard-empty-title" });
      empty.createEl("div", { text: "Create tasks and workflows to see scheduler KPIs here." });
      return;
    }

    const taskCounts = Object.fromEntries(statuses.map((status) => [status, tasks.filter((task) => task.status === status).length])) as Record<TaskStatus, number>;
    const workflowCounts = Object.fromEntries(statuses.map((status) => [status, workflows.filter((workflow) => workflow.status === status).length])) as Record<WorkflowStatus, number>;
    const taskUsage = new Map<string, number>();
    workflows.forEach((workflow) => {
      workflow.steps.forEach((step) => {
        if (step.taskId) taskUsage.set(step.taskId, (taskUsage.get(step.taskId) || 0) + 1);
      });
    });
    const totalReferences = Array.from(taskUsage.values()).reduce((sum, count) => sum + count, 0);
    const mostUsed = tasks.reduce<{ name: string; count: number } | null>((best, task) => {
      const count = taskUsage.get(task.id) || 0;
      if (!best || count > best.count) return { name: task.name, count };
      return best;
    }, null);
    const unusedTasks = tasks.filter((task) => !taskUsage.has(task.id)).length;

    const taskFailCounts = new Map<string, number>();
    tasks.forEach((task) => {
      let fails = 0;
      const out = task.output || "";
      const exitMatch = out.match(/\[exit code:\s*(-?\d+)\]/g);
      if (exitMatch) fails = exitMatch.length;
      if (task.status === "failed") fails = Math.max(fails, 1);
      if (fails > 0) taskFailCounts.set(task.id, fails);
    });

    const dashboard = containerEl.createDiv("auto-oc-dashboard");
    const kpis = dashboard.createDiv(this.showDashboardKpis ? "auto-oc-dashboard-kpis" : "auto-oc-dashboard-kpis auto-oc-dashboard-kpis-hidden");
    const addKpi = (label: string, value: string | number, cls?: string) => {
      const kpi = kpis.createDiv("auto-oc-dashboard-kpi");
      kpi.createEl("span", { text: label, cls: "auto-oc-dashboard-kpi-label" });
      kpi.createEl("strong", { text: String(value), cls });
    };

    addKpi("Tasks", tasks.length);
    statuses.forEach((status) => addKpi(`Tasks ${status}`, taskCounts[status], status === "running" ? "auto-oc-stat-running" : status === "failed" ? "auto-oc-stat-failed" : undefined));
    addKpi("Workflows", workflows.length);
    statuses.forEach((status) => addKpi(`Workflows ${status}`, workflowCounts[status], status === "running" ? "auto-oc-stat-running" : status === "failed" ? "auto-oc-stat-failed" : undefined));
    addKpi("Task refs", totalReferences);
    addKpi("Most used", mostUsed && mostUsed.count > 0 ? `${mostUsed.name} (${mostUsed.count})` : "None");
    addKpi("Unused tasks", unusedTasks);

    const map = dashboard.createDiv("auto-oc-dashboard-map");
    this.createDashboardAmbientLayer(map);
    this.watchDashboardMapResize(map);
    const btnToggleKpis = map.createEl("button", {
      text: this.showDashboardKpis ? "Hide metrics" : "Show metrics",
      cls: "auto-oc-dashboard-kpi-toggle",
    });
    btnToggleKpis.onclick = () => {
      this.showDashboardKpis = !this.showDashboardKpis;
      this.render();
    };
    const areaName = (value?: string) => value?.trim() || "No area";
    const layoutSignature = JSON.stringify({
      tasks: tasks.map((task) => ({ id: task.id, area: areaName(task.area) })).sort((a, b) => a.id.localeCompare(b.id)),
      workflows: workflows.map((workflow) => ({
        id: workflow.id,
        area: areaName(workflow.area),
        steps: workflow.steps.map((step) => step.taskId || step.id),
      })).sort((a, b) => a.id.localeCompare(b.id)),
    });
    const layoutChanged = layoutSignature !== this.dashboardLayoutSignature;
    if (layoutChanged) this.dashboardLayoutSignature = layoutSignature;
    const areaNames = Array.from(new Set([
      ...workflows.map((workflow) => areaName(workflow.area)),
      ...tasks.map((task) => areaName(task.area)),
    ])).sort((a, b) => a.localeCompare(b));
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const mapRect = map.getBoundingClientRect();
    const mapWidthPx = Math.max(mapRect.width || 0, 520);
    const pctFromPx = (px: number, parentPx: number, minPct: number, maxPct: number) => {
      const pct = (px / Math.max(parentPx, 1)) * 100;
      return Math.max(minPct, Math.min(maxPct, pct));
    };
    const areaSizeForContent = (contentWeight: number) => {
      const px = Math.min(260, Math.max(120, 92 + Math.sqrt(Math.max(contentWeight, 1)) * 42));
      return { px, pct: pctFromPx(px, mapWidthPx, 1, 36) };
    };
    const workflowSizePxForTasks = (taskCount: number) => {
      return Math.min(190, Math.max(92, 72 + Math.sqrt(Math.max(taskCount, 1)) * 34));
    };
    const workflowSizePctForParent = (taskCount: number, parent: HTMLElement) => {
      const parentWidth = parent.getBoundingClientRect().width || mapWidthPx;
      return pctFromPx(workflowSizePxForTasks(taskCount), parentWidth, 1, 78);
    };
    // Every task/step bubble renders at the same physical diameter,
    // regardless of usage, status, or nesting depth. Containers must adapt
    // around tasks; tasks should not shrink based on the current container.
    const TASK_BUBBLE_PX = 30;
    const taskBubbleSizeForParent = (parent: HTMLElement) => {
      const rect = parent.getBoundingClientRect();
      const parentDiameter = rect.height || rect.width || 0;
      if (parentDiameter <= 0) return { px: TASK_BUBBLE_PX, pct: 12 };
      const px = TASK_BUBBLE_PX;
      return { px, pct: (px / parentDiameter) * 100 };
    };
    const setBubbleRect = (el: HTMLElement, x: number, y: number, size: number) => {
      el.style.left = `${x}%`;
      el.style.top = `${y}%`;
      el.style.width = `${size}%`;
      el.style.height = "";
    };
    const saveBubblePosition = (bubble: HTMLElement) => {
      const key = bubble.getAttribute("data-dashboard-key");
      if (!key) return;
      this.dashboardPositions.set(key, {
        x: parseFloat(bubble.style.left || "0"),
        y: parseFloat(bubble.style.top || "0"),
        size: this.parseBubbleSizeForSave(bubble),
        sizePx: this.parseBubbleSizePxForSave(bubble),
      });
    };
    const saveBubbleTreePositions = (parent: HTMLElement) => {
      const bubbles = Array.from(parent.querySelectorAll<HTMLElement>(".auto-oc-dashboard-area-bubble, .auto-oc-dashboard-workflow-bubble, .auto-oc-dashboard-task-bubble"));
      bubbles.forEach(saveBubblePosition);
    };
    const addLabel = (el: HTMLElement, name: string, ariaLabel = name) => {
      el.tabIndex = 0;
      el.setAttr("aria-label", ariaLabel);
      el.createDiv("auto-oc-dashboard-hover-label").setText(name);
    };
    const addBubbleVisual = (el: HTMLElement) => {
      el.createDiv("auto-oc-dashboard-bubble-visual");
    };
    const isDashboardBubble = (el: HTMLElement) => {
      return el.classList.contains("auto-oc-dashboard-area-bubble")
        || el.classList.contains("auto-oc-dashboard-workflow-bubble")
        || el.classList.contains("auto-oc-dashboard-task-bubble");
    };
    const withDashboardMeasuring = <T>(fn: () => T): T => {
      map.addClass("auto-oc-dashboard-measuring");
      try {
        return fn();
      } finally {
        map.removeClass("auto-oc-dashboard-measuring");
      }
    };
    const clampBubbleToParent = (bubble: HTMLElement) => {
      const parent = bubble.offsetParent as HTMLElement | null;
      if (!parent) return;
      const bounds = parent.getBoundingClientRect();
      const rect = bubble.getBoundingClientRect();
      const widthPct = (rect.width / bounds.width) * 100;
      const heightPct = (rect.height / bounds.height) * 100;
      let leftPct = ((rect.left - bounds.left) / bounds.width) * 100;
      let topPct = ((rect.top - bounds.top) / bounds.height) * 100;

      if (isDashboardBubble(parent)) {
        const parentRadius = Math.min(bounds.width, bounds.height) / 2;
        const bubbleRadius = rect.width / 2;
        const parentCenterX = bounds.left + bounds.width / 2;
        const parentCenterY = bounds.top + bounds.height / 2;
        const bubbleCenterX = rect.left + rect.width / 2;
        const bubbleCenterY = rect.top + rect.height / 2;
        let dx = bubbleCenterX - parentCenterX;
        let dy = bubbleCenterY - parentCenterY;
        let distance = Math.hypot(dx, dy);
        const maxDistance = Math.max(0, parentRadius - bubbleRadius * 0.88);
        if (distance > maxDistance) {
          if (distance < 0.01) {
            dx = 1;
            dy = 0;
            distance = 1;
          }
          const nextCenterX = parentCenterX + (dx / distance) * maxDistance;
          const nextCenterY = parentCenterY + (dy / distance) * maxDistance;
          leftPct = ((nextCenterX - bubbleRadius - bounds.left) / bounds.width) * 100;
          topPct = ((nextCenterY - bubbleRadius - bounds.top) / bounds.height) * 100;
        }
      }

      bubble.style.left = `${Math.max(0, Math.min(100 - widthPct, leftPct))}%`;
      bubble.style.top = `${Math.max(0, Math.min(100 - heightPct, topPct))}%`;
    };
    const fitContainerToChildren = (container: HTMLElement) => {
      return withDashboardMeasuring(() => {
      if (!isDashboardBubble(container)) return;
      const parent = container.offsetParent as HTMLElement | null;
      if (!parent) return;
      const children = Array.from(container.children).filter((child): child is HTMLElement => child instanceof HTMLElement && isDashboardBubble(child));
      if (children.length === 0) return;

      const parentRect = parent.getBoundingClientRect();
      const childRects = children.map((child) => ({ child, rect: child.getBoundingClientRect() }));
      const padding = 12;
      const minX = Math.min(...childRects.map(({ rect }) => rect.left)) - padding;
      const maxX = Math.max(...childRects.map(({ rect }) => rect.right)) + padding;
      const minY = Math.min(...childRects.map(({ rect }) => rect.top)) - padding;
      const maxY = Math.max(...childRects.map(({ rect }) => rect.bottom)) + padding;
      const diameterPx = Math.max(maxX - minX, maxY - minY, ...childRects.map(({ rect }) => rect.width + padding * 2));
      const oldCenters = childRects.map(({ child, rect }) => ({
        child,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        width: rect.width,
        height: rect.height,
      }));
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const sizePx = Math.min(parentRect.width * 0.96, Math.max(44, diameterPx));
      container.style.left = `${((centerX - sizePx / 2 - parentRect.left) / parentRect.width) * 100}%`;
      container.style.top = `${((centerY - sizePx / 2 - parentRect.top) / parentRect.height) * 100}%`;
      container.style.width = `${sizePx}px`;
      clampBubbleToParent(container);

      const nextRect = container.getBoundingClientRect();
      oldCenters.forEach(({ child, centerX: childCenterX, centerY: childCenterY, width, height }) => {
        child.style.left = `${((childCenterX - width / 2 - nextRect.left) / nextRect.width) * 100}%`;
        child.style.top = `${((childCenterY - height / 2 - nextRect.top) / nextRect.height) * 100}%`;
        clampBubbleToParent(child);
      });
      saveBubbleTreePositions(parent);
      void this.persistDashboardPositions();
      });
    };
    const settleBubbleCollisions = (parent: HTMLElement, passes = 10) => {
      return withDashboardMeasuring(() => {
      const bubbles = Array.from(parent.children).filter((child): child is HTMLElement => child instanceof HTMLElement && isDashboardBubble(child));
      const bounds = parent.getBoundingClientRect();
      if (bubbles.length < 2 || bounds.width === 0 || bounds.height === 0) return;

      for (let pass = 0; pass < passes; pass++) {
        let movedAny = false;
        for (let i = 0; i < bubbles.length; i++) {
          for (let j = i + 1; j < bubbles.length; j++) {
            const a = bubbles[i];
            const b = bubbles[j];
            const aRect = a.getBoundingClientRect();
            const bRect = b.getBoundingClientRect();
            const aRadius = aRect.width / 2;
            const bRadius = bRect.width / 2;
            const aCenterX = aRect.left + aRadius;
            const aCenterY = aRect.top + aRect.height / 2;
            const bCenterX = bRect.left + bRadius;
            const bCenterY = bRect.top + bRect.height / 2;
            let dx = bCenterX - aCenterX;
            let dy = bCenterY - aCenterY;
            let distance = Math.hypot(dx, dy);
            const minDistance = aRadius + bRadius + 2;
            if (distance >= minDistance) continue;
            if (distance < 0.01) {
              const angle = ((i + j + pass) / Math.max(bubbles.length, 1)) * Math.PI * 2;
              dx = Math.cos(angle);
              dy = Math.sin(angle);
              distance = 1;
            }
            const push = (minDistance - distance) * 0.75;
            const moveBubble = (bubble: HTMLElement, rect: DOMRect, amount: number) => {
              const nextLeftPx = rect.left - bounds.left + (dx / distance) * amount;
              const nextTopPx = rect.top - bounds.top + (dy / distance) * amount;
              const nextLeftPct = (nextLeftPx / bounds.width) * 100;
              const nextTopPct = (nextTopPx / bounds.height) * 100;
              const widthPct = (rect.width / bounds.width) * 100;
              const heightPct = (rect.height / bounds.height) * 100;
              bubble.style.left = `${Math.max(0, Math.min(100 - widthPct, nextLeftPct))}%`;
              bubble.style.top = `${Math.max(0, Math.min(100 - heightPct, nextTopPct))}%`;
              clampBubbleToParent(bubble);
            };
            moveBubble(a, aRect, -push);
            moveBubble(b, bRect, push);
            movedAny = true;
          }
        }
        if (!movedAny) break;
      }
      saveBubbleTreePositions(parent);
      void this.persistDashboardPositions();
      });
    };
    const hasBubbleOverlap = (parent: HTMLElement) => {
      const bubbles = Array.from(parent.children).filter((child): child is HTMLElement => child instanceof HTMLElement && isDashboardBubble(child));
      for (let i = 0; i < bubbles.length; i++) {
        for (let j = i + 1; j < bubbles.length; j++) {
          const aRect = bubbles[i].getBoundingClientRect();
          const bRect = bubbles[j].getBoundingClientRect();
          const aRadius = aRect.width / 2;
          const bRadius = bRect.width / 2;
          const distance = Math.hypot(
            bRect.left + bRadius - (aRect.left + aRadius),
            bRect.top + bRect.height / 2 - (aRect.top + aRect.height / 2),
          );
          if (distance < aRadius + bRadius + 2) return true;
        }
      }
      return false;
    };
    const attachBubbleDrag = (el: HTMLElement, onClick?: () => void) => {
      let startX = 0;
      let startY = 0;
      let startLeft = 0;
      let startTop = 0;
      let moved = false;
      let parentRect: DOMRect | null = null;
      let pointerId: number | null = null;

      const resolveSiblingCollisions = () => {
        const parent = el.offsetParent as HTMLElement | null;
        if (!parent) return;
        const bounds = parent.getBoundingClientRect();
        const bubbles = Array.from(parent.children).filter((child): child is HTMLElement => {
          return child instanceof HTMLElement && isDashboardBubble(child);
        });
        let frontier = new Set<HTMLElement>([el]);

        for (let pass = 0; pass < 5 && frontier.size > 0; pass++) {
          const nextFrontier = new Set<HTMLElement>();
          for (const a of frontier) {
            for (const b of bubbles) {
              if (a === b) continue;
              const aRect = a.getBoundingClientRect();
              const bRect = b.getBoundingClientRect();
              const aRadius = aRect.width / 2;
              const bRadius = bRect.width / 2;
              const aCenterX = aRect.left + aRadius;
              const aCenterY = aRect.top + aRect.height / 2;
              const bCenterX = bRect.left + bRadius;
              const bCenterY = bRect.top + bRect.height / 2;
              let dx = bCenterX - aCenterX;
              let dy = bCenterY - aCenterY;
              let distance = Math.hypot(dx, dy);
              const minDistance = aRadius + bRadius + 4;
              if (distance >= minDistance) continue;
              if (distance < 0.01) {
                const angle = ((bubbles.indexOf(a) + bubbles.indexOf(b) + pass) / Math.max(bubbles.length, 1)) * Math.PI * 2;
                dx = Math.cos(angle);
                dy = Math.sin(angle);
                distance = 1;
              }

              const push = (minDistance - distance) * 1.05;
              const moveBubble = (bubble: HTMLElement, rect: DOMRect, amount: number) => {
                if (amount === 0) return;
                const nextLeftPx = rect.left - bounds.left + (dx / distance) * amount;
                const nextTopPx = rect.top - bounds.top + (dy / distance) * amount;
                const nextLeftPct = (nextLeftPx / bounds.width) * 100;
                const nextTopPct = (nextTopPx / bounds.height) * 100;
                const widthPct = (rect.width / bounds.width) * 100;
                const heightPct = (rect.height / bounds.height) * 100;
                bubble.style.left = `${Math.max(0, Math.min(100 - widthPct, nextLeftPct))}%`;
                bubble.style.top = `${Math.max(0, Math.min(100 - heightPct, nextTopPct))}%`;
              };
              moveBubble(b, bRect, push);
              clampBubbleToParent(b);
              nextFrontier.add(b);
            }
          }
          frontier = nextFrontier;
        }
      };

      el.onpointerdown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        pointerId = event.pointerId;
        startX = event.clientX;
        startY = event.clientY;
        startLeft = parseFloat(el.style.left || "0");
        startTop = parseFloat(el.style.top || "0");
        parentRect = (el.offsetParent as HTMLElement | null)?.getBoundingClientRect() || null;
        moved = false;
        el.addClass("auto-oc-dashboard-dragging");
        (el.offsetParent as HTMLElement | null)?.addClass("auto-oc-dashboard-colliding");
        el.style.zIndex = "30";
        el.setPointerCapture(event.pointerId);
      };
      el.onpointermove = (event: PointerEvent) => {
        if (pointerId !== event.pointerId || !parentRect) return;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        const bubbleRect = el.getBoundingClientRect();
        const widthPct = (bubbleRect.width / parentRect.width) * 100;
        const heightPct = (bubbleRect.height / parentRect.height) * 100;
        const nextLeft = startLeft + (dx / parentRect.width) * 100;
        const nextTop = startTop + (dy / parentRect.height) * 100;
        el.style.left = `${Math.max(0, Math.min(100 - widthPct, nextLeft))}%`;
        el.style.top = `${Math.max(0, Math.min(100 - heightPct, nextTop))}%`;
        resolveSiblingCollisions();
      };
      el.onpointerup = (event: PointerEvent) => {
        if (pointerId !== event.pointerId) return;
        const parent = el.offsetParent as HTMLElement | null;
        event.preventDefault();
        event.stopPropagation();
        el.releasePointerCapture(event.pointerId);
        el.removeClass("auto-oc-dashboard-dragging");
        parent?.removeClass("auto-oc-dashboard-colliding");
        el.style.zIndex = "";
        pointerId = null;
        parentRect = null;
        if (parent) {
          settleBubbleCollisions(parent, 24);
          if (isDashboardBubble(parent)) {
            fitContainerToChildren(parent);
            const grandParent = parent.offsetParent as HTMLElement | null;
            if (grandParent && isDashboardBubble(grandParent)) fitContainerToChildren(grandParent);
          }
        }
        if (!moved && onClick) onClick();
      };
      el.onpointercancel = (event: PointerEvent) => {
        if (pointerId !== event.pointerId) return;
        el.removeClass("auto-oc-dashboard-dragging");
        (el.offsetParent as HTMLElement | null)?.removeClass("auto-oc-dashboard-colliding");
        el.style.zIndex = "";
        pointerId = null;
        parentRect = null;
      };
      el.onkeydown = (event: KeyboardEvent) => {
        if (event.key !== "Enter" || !onClick) return;
        event.preventDefault();
        event.stopPropagation();
        onClick();
      };
    };
    const layoutTopLevel = (items: { key: string; size: number; maxPx?: number }[]) => {
      const jitterForKey = (key: string, axis: number) => {
        let hash = 0;
        for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i) + axis * 131) | 0;
        return ((Math.abs(hash) % 1000) / 1000 - 0.5) * 10;
      };
      const count = Math.max(items.length, 1);
      const cols = count <= 1 ? 1 : count <= 4 ? 2 : Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);
      const gap = 4;
      const cellWidth = (100 - gap * (cols + 1)) / cols;
      const cellHeight = (100 - gap * (rows + 1)) / rows;
      return items.map((item, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const size = Math.min(item.size, cellWidth, cellHeight);
        const saved = this.dashboardPositions.get(item.key);
        if (saved) {
          return {
            ...item,
            size,
            x: Math.max(0, Math.min(100 - size, saved.x)),
            y: Math.max(0, Math.min(100 - size, saved.y)),
          };
        }
        const jitterX = Math.max(-cellWidth * 0.18, Math.min(cellWidth * 0.18, jitterForKey(item.key, 0)));
        const jitterY = Math.max(-cellHeight * 0.18, Math.min(cellHeight * 0.18, jitterForKey(item.key, 1)));
        return {
          ...item,
          size,
          x: Math.max(0, Math.min(100 - size, gap + col * (cellWidth + gap) + (cellWidth - size) / 2 + jitterX)),
          y: Math.max(0, Math.min(100 - size, gap + row * (cellHeight + gap) + (cellHeight - size) / 2 + jitterY)),
        };
      });
    };
    const createAreaBubble = (name: string, x: number, y: number, size: number, maxPx?: number) => {
      const areaBubble = map.createDiv("auto-oc-dashboard-area-bubble");
      areaBubble.setAttr("data-dashboard-key", `area:${name}`);
      setBubbleRect(areaBubble, x, y, size);
      const saved = this.dashboardPositions.get(`area:${name}`);
      const widthPx = saved?.sizePx ?? maxPx;
      if (widthPx) areaBubble.style.width = `${widthPx}px`;
      addBubbleVisual(areaBubble);
      areaBubble.setAttr("aria-label", `Area: ${name}`);
      areaBubble.tabIndex = 0;

      const areaLabel = areaBubble.createDiv("auto-oc-dashboard-area-label");
      areaLabel.setText(name);
      areaBubble.createDiv("auto-oc-dashboard-hover-label").setText(name);
      attachBubbleDrag(areaBubble);
      clampBubbleToParent(areaBubble);
      return areaBubble;
    };

    const createTaskBubble = (parent: HTMLElement, task: ScheduledTask, x: number, y: number, size: number, extraCls = "", positionKey = `task:${task.id}`) => {
      // All task bubbles render at the same size regardless of usage/failure
      // history — only their position drifts based on activity, not their size.
      const taskBubble = parent.createDiv(`auto-oc-dashboard-task-bubble auto-oc-dashboard-task-${task.status} auto-oc-dashboard-task-md ${extraCls}`.trim());
      taskBubble.setAttr("data-auto-oc-task-id", task.id);
      taskBubble.setAttr("data-dashboard-key", positionKey);
      taskBubble.setAttr("data-usage-count", String(taskUsage.get(task.id) || 0));
      addBubbleVisual(taskBubble);
      const saved = this.dashboardPositions.get(positionKey);
      let posX = saved?.x ?? x;
      let posY = saved?.y ?? y;
      if (!saved) {
        const usage = taskUsage.get(task.id) || 0;
        const fails = taskFailCounts.get(task.id) || 0;
        const usageLift = Math.min(usage * 1.2, 14);
        const failDrop = Math.min(fails * 1.5, 12);
        posY = Math.max(0, Math.min(100 - size, posY - usageLift + failDrop));
      }
      setBubbleRect(taskBubble, posX, posY, size);
      // Hard-override to a fixed physical diameter regardless of what % the
      // caller's radial-layout math assumed, and regardless of any later
      // parent resize (fitContainerToChildren changes container size but
      // never touches child width%, which would otherwise make % sizing
      // drift away from "uniform" after the container grows/shrinks).
      // Capped to the immediate parent's own real size — a task bubble
      // bigger than its own workflow/area ring would overflow past its
      // border and visually bleed into whatever neighboring bubble happens
      // to be nearby, looking like it belongs to the wrong container.
      const finalPx = taskBubbleSizeForParent(parent).px;
      taskBubble.style.width = `${finalPx}px`;
      taskBubble.style.height = `${finalPx}px`;
      const usageCount = taskUsage.get(task.id) || 0;
      addLabel(taskBubble, task.name, `Task: ${task.name}. Status: ${task.status}. Usage count: ${usageCount}. Press Enter to open in Tasks.`);
      attachBubbleDrag(taskBubble, () => this.openTaskInList(task));
      clampBubbleToParent(taskBubble);
    };

    const configuredAreaNames = areaNames.filter((name) => name !== "No area");
    const topLevelItems: { key: string; size: number; maxPx?: number }[] = [];
    configuredAreaNames.forEach((name) => {
      const areaWorkflows = workflows.filter((workflow) => areaName(workflow.area) === name);
      const looseTasks = tasks.filter((task) => !taskUsage.has(task.id) && areaName(task.area) === name);
      const contentWeight = looseTasks.length + areaWorkflows.reduce((sum, workflow) => {
        return sum + Math.max(1, workflow.steps.filter((step) => step.taskId && taskById.has(step.taskId)).length);
      }, 0);
      const areaSize = areaSizeForContent(contentWeight);
      topLevelItems.push({ key: `area:${name}`, size: areaSize.pct, maxPx: areaSize.px });
    });
    const noAreaWorkflows = workflows.filter((workflow) => areaName(workflow.area) === "No area");
    const noAreaLooseTasks = tasks.filter((task) => !taskUsage.has(task.id) && areaName(task.area) === "No area");
    noAreaWorkflows.forEach((workflow) => {
      const taskSteps = workflow.steps.filter((step) => step.taskId && taskById.has(step.taskId));
      const workflowPx = workflowSizePxForTasks(taskSteps.length);
      topLevelItems.push({ key: `workflow:${workflow.id}`, size: pctFromPx(workflowPx, mapWidthPx, 1, 30), maxPx: workflowPx });
    });
    noAreaLooseTasks.forEach((task) => topLevelItems.push({ key: `task:${task.id}`, size: taskBubbleSizeForParent(map).pct }));
    const topLevelLayout = new Map(layoutTopLevel(topLevelItems).map((item) => [item.key, item]));

    configuredAreaNames.forEach((name) => {
      const areaLayout = topLevelLayout.get(`area:${name}`);
      if (!areaLayout) return;
      const areaBubble = createAreaBubble(name, areaLayout.x, areaLayout.y, areaLayout.size, areaLayout.maxPx);
      const areaWorkflows = workflows.filter((workflow) => areaName(workflow.area) === name);
      const looseTasks = tasks.filter((task) => !taskUsage.has(task.id) && areaName(task.area) === name);
      if (looseTasks.some((task) => task.status === "running") || areaWorkflows.some((workflow) => workflow.status === "running" || workflow.steps.some((step) => taskById.get(step.taskId || "")?.status === "running"))) {
        areaBubble.addClass("auto-oc-dashboard-has-running");
      }
      if (looseTasks.some((task) => task.status === "failed") || areaWorkflows.some((workflow) => workflow.status === "failed" || workflow.steps.some((step) => taskById.get(step.taskId || "")?.status === "failed"))) {
        areaBubble.addClass("auto-oc-dashboard-has-failed");
      }
      const areaWorkflowCount = Math.max(areaWorkflows.length, 1);
      areaWorkflows.forEach((workflow, workflowIndex) => {
        const taskSteps = workflow.steps.filter((step) => step.taskId && taskById.has(step.taskId));
        const angle = -Math.PI / 2 + (workflowIndex * Math.PI * 2) / areaWorkflowCount;
        const workflowSize = workflowSizePctForParent(taskSteps.length, areaBubble);
        const workflowRadius = areaWorkflowCount === 1 ? 0 : Math.max(0, 46 - workflowSize / 2);
        const workflowX = 50 + Math.cos(angle) * workflowRadius - workflowSize / 2;
        const workflowY = 50 + Math.sin(angle) * workflowRadius - workflowSize / 2;
        const workflowBubble = areaBubble.createDiv(`auto-oc-dashboard-workflow-bubble auto-oc-dashboard-workflow-${workflow.status}`);
        workflowBubble.setAttr("data-auto-oc-workflow-id", workflow.id);
        addBubbleVisual(workflowBubble);
        if (taskSteps.some((step) => taskById.get(step.taskId || "")?.status === "running")) workflowBubble.addClass("auto-oc-dashboard-has-running");
        if (taskSteps.some((step) => taskById.get(step.taskId || "")?.status === "failed")) workflowBubble.addClass("auto-oc-dashboard-has-failed");
        const workflowKey = `area:${name}:workflow:${workflow.id}`;
        workflowBubble.setAttr("data-dashboard-key", workflowKey);
        const savedWorkflow = this.dashboardPositions.get(workflowKey);
        setBubbleRect(workflowBubble, savedWorkflow?.x ?? workflowX, savedWorkflow?.y ?? workflowY, workflowSize);
        workflowBubble.style.width = `${savedWorkflow?.sizePx ?? workflowSizePxForTasks(taskSteps.length)}px`;
        addLabel(workflowBubble, workflow.name, `Workflow: ${workflow.name}. Area: ${name}. Status: ${workflow.status}. Press Enter to open in WorkFlows.`);
        attachBubbleDrag(workflowBubble, () => this.openWorkflowInList(workflow));
        clampBubbleToParent(workflowBubble);

        const taskCount = Math.max(taskSteps.length, 1);
        taskSteps.forEach((step, stepIndex) => {
          const task = taskById.get(step.taskId!);
          if (!task) return;
          const taskAngle = -Math.PI / 2 + (stepIndex * Math.PI * 2) / taskCount;
          const taskSize = taskBubbleSizeForParent(workflowBubble).pct;
          const radius = taskCount === 1 ? 0 : Math.max(0, 45 - taskSize / 2);
          const taskX = 50 + Math.cos(taskAngle) * radius - taskSize / 2;
          const taskY = 50 + Math.sin(taskAngle) * radius - taskSize / 2;
          createTaskBubble(workflowBubble, task, taskX, taskY, taskSize, "auto-oc-dashboard-task-used", `${workflowKey}:task:${task.id}:${stepIndex}`);
        });
      });

      const looseCount = Math.max(looseTasks.length, 1);
      looseTasks.forEach((task, taskIndex) => {
        const angle = -Math.PI / 2 + (taskIndex * Math.PI * 2) / looseCount;
        const taskSize = taskBubbleSizeForParent(areaBubble).pct;
        const radius = looseCount === 1 ? 0 : Math.max(0, 45 - taskSize / 2);
        const taskX = 50 + Math.cos(angle) * radius - taskSize / 2;
        const taskY = 50 + Math.sin(angle) * radius - taskSize / 2;
        createTaskBubble(areaBubble, task, taskX, taskY, taskSize, "auto-oc-dashboard-task-loose", `area:${name}:task:${task.id}`);
      });
    });

    noAreaWorkflows.forEach((workflow) => {
      const taskSteps = workflow.steps.filter((step) => step.taskId && taskById.has(step.taskId));
      const workflowSize = pctFromPx(workflowSizePxForTasks(taskSteps.length), mapWidthPx, 1, 30);
      const workflowLayout = topLevelLayout.get(`workflow:${workflow.id}`);
      if (!workflowLayout) return;
      const workflowBubble = map.createDiv(`auto-oc-dashboard-workflow-bubble auto-oc-dashboard-workflow-${workflow.status}`);
      workflowBubble.setAttr("data-auto-oc-workflow-id", workflow.id);
      addBubbleVisual(workflowBubble);
      if (taskSteps.some((step) => taskById.get(step.taskId || "")?.status === "running")) workflowBubble.addClass("auto-oc-dashboard-has-running");
      if (taskSteps.some((step) => taskById.get(step.taskId || "")?.status === "failed")) workflowBubble.addClass("auto-oc-dashboard-has-failed");
      workflowBubble.setAttr("data-dashboard-key", `workflow:${workflow.id}`);
      const savedWorkflow = this.dashboardPositions.get(`workflow:${workflow.id}`);
      setBubbleRect(workflowBubble, workflowLayout.x, workflowLayout.y, workflowSize);
      workflowBubble.style.width = `${savedWorkflow?.sizePx ?? workflowLayout.maxPx ?? workflowSizePxForTasks(taskSteps.length)}px`;
      addLabel(workflowBubble, workflow.name, `Workflow: ${workflow.name}. Area: No area. Status: ${workflow.status}. Press Enter to open in WorkFlows.`);
      attachBubbleDrag(workflowBubble, () => this.openWorkflowInList(workflow));
      clampBubbleToParent(workflowBubble);

      const taskCount = Math.max(taskSteps.length, 1);
      taskSteps.forEach((step, stepIndex) => {
        const task = taskById.get(step.taskId!);
        if (!task) return;
        const taskAngle = -Math.PI / 2 + (stepIndex * Math.PI * 2) / taskCount;
        const taskSize = taskBubbleSizeForParent(workflowBubble).pct;
        const radius = taskCount === 1 ? 0 : Math.max(0, 45 - taskSize / 2);
        const taskX = 50 + Math.cos(taskAngle) * radius - taskSize / 2;
        const taskY = 50 + Math.sin(taskAngle) * radius - taskSize / 2;
        createTaskBubble(workflowBubble, task, taskX, taskY, taskSize, "auto-oc-dashboard-task-used", `workflow:${workflow.id}:task:${task.id}:${stepIndex}`);
      });
    });

    noAreaLooseTasks.forEach((task) => {
      const taskLayout = topLevelLayout.get(`task:${task.id}`);
      if (!taskLayout) return;
      const taskSize = taskBubbleSizeForParent(map).pct;
      createTaskBubble(map, task, taskLayout.x, taskLayout.y, taskSize, "auto-oc-dashboard-task-loose");
    });

    this.syncDashboardTaskDrift(tasks);

    this.forceDashboardFitOnNextRender = false;
    return;
  }

  private renderTasks(containerEl: HTMLElement) {
    // The extension header (title + version + check-updates) and the
    // "+ New Task" button are rendered by `render()` so they sit at
    // the top of the panel, not duplicated per tab.

    const tasks = this.plugin.settings.tasks;
    const renderTaskResults = (root: HTMLElement) => {
      root.empty();

      // ── Stats bar ──
      const stats = root.createDiv("auto-oc-stats");
      const running = tasks.filter((t) => t.status === "running").length;
      const completed = tasks.filter((t) => t.status === "completed").length;
      const failed = tasks.filter((t) => t.status === "failed").length;
      stats.createEl("span", { text: `${tasks.length} tasks` });
      if (running > 0) stats.createEl("span", { text: `🟡 ${running} running`, cls: "auto-oc-stat-running" });
      if (failed > 0) stats.createEl("span", { text: `🔴 ${failed} failed`, cls: "auto-oc-stat-failed" });
      if (completed > 0) stats.createEl("span", { text: `🟢 ${completed} completed` });

      // ── Task list ──
      const filteredTasks = tasks.filter(t => {
        const area = t.area?.trim() || "No area";
        const matchesText = t.name.toLowerCase().includes(this.filterText) ||
                            t.prompt.toLowerCase().includes(this.filterText) ||
                            area.toLowerCase().includes(this.filterText);
        const matchesStatus = this.filterStatus === "all" || t.status === this.filterStatus;
        const matchesArea = this.filterArea === "all" || area === this.filterArea;
        return matchesText && matchesStatus && matchesArea;
      });

      if (filteredTasks.length === 0) {
        root.createEl("p", {
          text: this.filterText || this.filterStatus !== "all" || this.filterArea !== "all"
                ? "No tasks match your filters."
                : "No tasks scheduled. Create one with \"+New Task\".",
          cls: "auto-oc-empty",
        });
        return;
      }

      const list = root.createDiv("auto-oc-list");
      for (const task of [...filteredTasks].reverse()) {
        this.renderTaskCard(list, task);
      }
    };

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
      renderTaskResults(resultsRoot);
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
      renderTaskResults(resultsRoot);
    };

    const areaSelect = filterBar.createEl("select", {
      cls: "auto-oc-status-select",
    });
    const areaOptions = ["all", ...getConfiguredAreaNames(this.plugin.settings), "No area"];
    Array.from(new Set(areaOptions)).forEach((area) => {
      const opt = areaSelect.createEl("option");
      opt.value = area;
      opt.text = area === "all" ? "All areas" : area;
    });
    areaSelect.value = areaOptions.includes(this.filterArea) ? this.filterArea : "all";
    this.filterArea = areaSelect.value;
    areaSelect.onchange = () => {
      this.filterArea = areaSelect.value;
      renderTaskResults(resultsRoot);
    };

    const resultsRoot = containerEl.createDiv("auto-oc-filter-results");
    renderTaskResults(resultsRoot);
  }

  private renderTaskCard(parent: HTMLElement, task: ScheduledTask) {
    const card = parent.createDiv(`auto-oc-card auto-oc-status-${task.status}`);
    card.setAttr("data-auto-oc-task-id", task.id);
    
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
    const isExpanded = this.expandedTasks.has(task.id);
    details.style.display = isExpanded ? "block" : "none";

    const meta = details.createDiv("auto-oc-card-meta");
    const modelLabel = this.plugin.availableModels.find((m) => m.value === task.model)?.label ?? task.model;
    meta.createEl("span", { text: `🗂 ${task.area?.trim() || "No area"}` });
    if ((task.taskKind || "opencode") === "code") {
      meta.createEl("span", { text: "{ } Code task" });
    } else {
      if (task.interactiveTerminal) meta.createEl("span", { text: "CLI task" });
      meta.createEl("span", { text: `🤖 ${modelLabel}` });
      meta.createEl("span", { text: `⚙️ ${this.plugin.getEffectiveAgent(task.agent)}` });
    }

    let scheduleText = "";
    if (task.scheduleType === "manual") {
      scheduleText = "▶ Manual only";
    } else if (task.scheduleType === "once") {
      scheduleText = `📅 ${task.scheduleDate} ${task.scheduleTime}`;
    } else if (task.scheduleType === "daily") {
      scheduleText = `🔁 Every day at ${task.scheduleTime}`;
    } else if (task.scheduleType === "weekly") {
      const days = task.scheduleDays.map((d) => DAY_NAMES[d]).join(", ");
      scheduleText = `🔁 ${days || "no days"} at ${task.scheduleTime}`;
    } else if (task.scheduleType === "interval") {
      const value = task.scheduleIntervalValue ?? 10;
      const unit = task.scheduleIntervalUnit ?? "minutes";
      scheduleText = `🔁 Every ${value} ${unit}`;
    } else {
      const days = (task.scheduleMonthDays || []).join(", ");
      scheduleText = `🔁 Day ${days || "no days"} of each month at ${task.scheduleTime}`;
    }
    meta.createEl("span", { text: scheduleText });

    if (task.lastRun) {
      meta.createEl("span", { text: `⏱ Last: ${formatDateTime(task.lastRun)}` });
    }

    if (task.useRalphLoop) {
      meta.createEl("span", { text: "♻️ Ralph Loop active", cls: "auto-oc-ralph-badge" });
    }

    const preview = details.createDiv((task.taskKind || "opencode") === "code" ? "auto-oc-code-preview-wrap" : "auto-oc-prompt-preview");
    if ((task.taskKind || "opencode") === "code") {
      renderCodePreview(preview, task.code || task.prompt || "", 500);
    } else {
      preview.createEl("span", {
        text: task.prompt.slice(0, 140) + (task.prompt.length > 140 ? "…" : ""),
      });
    }

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
    btnLog.title = task.output ? "" : "No output yet";
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
      if (isHidden) {
        this.expandedTasks.add(task.id);
      } else {
        this.expandedTasks.delete(task.id);
      }
    };
  }

  // ── Workflows rendering ──────────────────────────────────────────────────

  private renderWorkflows(containerEl: HTMLElement) {
    // The extension header (title + version + check-updates) and the
    // "+ New Workflow" button are rendered by `render()` so they sit
    // at the top of the panel, not duplicated per tab.

    // A short reminder of how workflows work.
    const help = containerEl.createDiv("auto-oc-workflow-panel-help");
    help.createSpan({
      text: "Workflows run tasks in order using their own schedule. Per-step transitions decide whether the next task starts: success, force, or AI decides.",
    });

    const workflows = this.plugin.settings.workflows;
    const renderWorkflowResults = (root: HTMLElement) => {
      root.empty();

      const stats = root.createDiv("auto-oc-stats");
      const completed = workflows.filter((w) => w.status === "completed").length;
      const running = workflows.filter((w) => w.status === "running").length;
      const failed = workflows.filter((w) => w.status === "failed").length;
      stats.createEl("span", { text: `${workflows.length} workflows` });
      if (running > 0) stats.createEl("span", { text: `🟡 ${running} running`, cls: "auto-oc-stat-running" });
      if (failed > 0) stats.createEl("span", { text: `🔴 ${failed} failed`, cls: "auto-oc-stat-failed" });
      if (completed > 0) stats.createEl("span", { text: `🟢 ${completed} completed` });

      const filteredWorkflows = workflows.filter((workflow) => {
        const area = workflow.area?.trim() || "No area";
        const stepText = workflow.steps.map((step) => {
          if (step.stepKind === "code") return step.code || "code";
          if (step.stepKind === "delay") return `${step.delayValue ?? 5} ${step.delayUnit ?? "minutes"}`;
          const task = this.plugin.settings.tasks.find((candidate) => candidate.id === step.taskId);
          return task ? `${task.name} ${task.prompt} ${task.area || ""}` : "";
        }).join(" ");
        const haystack = `${workflow.name} ${workflow.description || ""} ${area} ${stepText}`.toLowerCase();
        const matchesText = haystack.includes(this.filterText);
        const matchesStatus = this.filterStatus === "all" || workflow.status === this.filterStatus;
        const matchesArea = this.filterArea === "all" || area === this.filterArea;
        return matchesText && matchesStatus && matchesArea;
      });

      if (filteredWorkflows.length === 0) {
        root.createEl("p", {
          text: this.filterText || this.filterStatus !== "all" || this.filterArea !== "all"
            ? "No workflows match your filters."
            : "No workflows yet. Chain tasks together with \"+ New Workflow\".",
          cls: "auto-oc-empty",
        });
        return;
      }

      const list = root.createDiv("auto-oc-list");
      for (const wf of [...filteredWorkflows].reverse()) {
        this.renderWorkflowCard(list, wf);
      }
    };

    const filterBar = containerEl.createDiv("auto-oc-filter-bar");
    const searchInput = filterBar.createEl("input", {
      type: "text",
      placeholder: "🔍 Search workflows...",
      cls: "auto-oc-search-input",
    });
    searchInput.value = this.filterText;
    searchInput.oninput = () => {
      this.filterText = searchInput.value.toLowerCase();
      renderWorkflowResults(resultsRoot);
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
      renderWorkflowResults(resultsRoot);
    };

    const areaSelect = filterBar.createEl("select", {
      cls: "auto-oc-status-select",
    });
    const areaOptions = ["all", ...getConfiguredAreaNames(this.plugin.settings), "No area"];
    Array.from(new Set(areaOptions)).forEach((area) => {
      const opt = areaSelect.createEl("option");
      opt.value = area;
      opt.text = area === "all" ? "All areas" : area;
    });
    areaSelect.value = areaOptions.includes(this.filterArea) ? this.filterArea : "all";
    this.filterArea = areaSelect.value;
    areaSelect.onchange = () => {
      this.filterArea = areaSelect.value;
      renderWorkflowResults(resultsRoot);
    };

    const resultsRoot = containerEl.createDiv("auto-oc-filter-results");
    renderWorkflowResults(resultsRoot);
  }

  private renderWorkflowCard(parent: HTMLElement, workflow: Workflow) {
    const card = parent.createDiv(`auto-oc-card auto-oc-status-${workflow.status}`);
    card.setAttr("data-auto-oc-workflow-id", workflow.id);
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
    const isExpandedWf = this.expandedWorkflows.has(workflow.id);
    details.style.display = isExpandedWf ? "block" : "none";

    const areaMeta = details.createDiv("auto-oc-card-meta");
    areaMeta.createEl("span", { text: `🗂 ${workflow.area?.trim() || "No area"}` });

    // Description
    if (workflow.description) {
      const desc = details.createDiv("auto-oc-prompt-preview");
      desc.createEl("span", { text: workflow.description.slice(0, 200) });
    }

    // Steps list with task details/actions
    const stepsDiv = details.createDiv("auto-oc-workflow-steps-mini");
    const stepLabel = (step: WorkflowStep): string => {
      if (step.name?.trim()) return step.name.trim();
      if (step.stepKind === "code") return "{ } Code";
      if (step.stepKind === "delay") return `⏱ ${step.delayValue ?? 5} ${step.delayUnit ?? "minutes"}`;
      const t = this.plugin.settings.tasks.find((task) => task.id === step.taskId);
      return t ? t.name : "(deleted task)";
    };
    const transitionModeLabel = (mode?: TransitionMode): string => {
      if (mode === "force") return "force";
      if (mode === "eval") return "AI";
      if (mode === "conditional") return "condition";
      return "default";
    };
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      const task = this.plugin.settings.tasks.find((t) => t.id === step.taskId);
      const stepName = stepLabel(step);
      const stepItem = stepsDiv.createDiv("auto-oc-workflow-task-detail");
      const isCurrent = workflow.status === "running" && workflow.currentStep === i;
      const isDone = workflow.currentStep > i || (workflow.status === "completed" && workflow.currentStep >= i);
      const icon = isDone ? "✅" : isCurrent ? "⏳" : "⬜";

      const stepHeader = stepItem.createDiv("auto-oc-workflow-task-header");
      stepHeader.createSpan({
        text: `${icon} Step ${i + 1}: ${stepName}`,
        cls: "auto-oc-workflow-task-title",
      });
      if (step.stepKind !== "task" && step.status) {
        stepHeader.createSpan({
          text: step.status,
          cls: `auto-oc-badge auto-oc-badge-${step.status}`,
        });
      }
      if (task) {
        stepHeader.createSpan({
          text: task.status,
          cls: `auto-oc-badge auto-oc-badge-${task.status}`,
        });
      }
      const stepArea = step.area?.trim() || workflow.area?.trim();
      if (stepArea) {
        stepHeader.createSpan({
          text: `🗂 ${stepArea}`,
          cls: "auto-oc-workflow-transition-label",
        });
      }

      const transitions = step.transitions && step.transitions.length > 0
        ? step.transitions
        : (workflow.steps[i + 1]
            ? [{ toStepId: workflow.steps[i + 1].id, mode: (step.transitionMode as TransitionMode) || "default" }]
            : []);
      if (transitions.length > 0) {
        const transitionSummary = transitions
          .map((transition) => {
            const target = workflow.steps.find((candidate) => candidate.id === transition.toStepId);
            return `→ ${target ? stepLabel(target) : "missing step"} [${transitionModeLabel(transition.mode)}]`;
          })
          .join(" · ");
        stepHeader.createSpan({
          text: ` ${transitionSummary}`,
          cls: "auto-oc-workflow-transition-label",
        });
      }

      if (!task) {
        if (step.stepKind === "code") {
          const codePreview = stepItem.createDiv("auto-oc-code-preview-wrap");
          renderCodePreview(codePreview, step.code || "// empty code step", 500);
          const stepActions = stepItem.createDiv("auto-oc-workflow-task-actions");
          const btnCodeLog = stepActions.createEl("button", {
            text: "📄 Log",
            cls: "auto-oc-btn-output",
          });
          btnCodeLog.disabled = !step.output;
          btnCodeLog.onclick = (e) => {
            e.stopPropagation();
            new TextPreviewModal(this.app, `Code step ${i + 1} output`, step.output || "").open();
          };
          const btnEditCode = stepActions.createEl("button", {
            text: "✏️ Edit Code",
            cls: "auto-oc-btn-edit",
          });
          btnEditCode.onclick = (e) => {
            e.stopPropagation();
            new EditWorkflowStepModal(this.app, this.plugin, workflow, step).open();
          };
        } else if (step.stepKind === "delay") {
          const stepMeta = stepItem.createDiv("auto-oc-workflow-task-meta");
          stepMeta.createSpan({ text: `Pauses for ${step.delayValue ?? 5} ${step.delayUnit ?? "minutes"}` });
          const stepActions = stepItem.createDiv("auto-oc-workflow-task-actions");
          const btnDelayLog = stepActions.createEl("button", {
            text: "📄 Log",
            cls: "auto-oc-btn-output",
          });
          btnDelayLog.disabled = !step.output;
          btnDelayLog.onclick = (e) => {
            e.stopPropagation();
            new TextPreviewModal(this.app, `Delay step ${i + 1} output`, step.output || "").open();
          };
          const btnEditDelay = stepActions.createEl("button", {
            text: "✏️ Edit Delay",
            cls: "auto-oc-btn-edit",
          });
          btnEditDelay.onclick = (e) => {
            e.stopPropagation();
            new EditWorkflowStepModal(this.app, this.plugin, workflow, step).open();
          };
        }
        continue;
      }

      const taskMeta = stepItem.createDiv("auto-oc-workflow-task-meta");
      const modelLabel = this.plugin.availableModels.find((m) => m.value === task.model)?.label ?? task.model;
      if ((task.taskKind || "opencode") === "code") {
        taskMeta.createSpan({ text: "{ } Code task" });
      } else {
        taskMeta.createSpan({ text: `🤖 ${modelLabel || "(no model)"}` });
        taskMeta.createSpan({ text: `⚙️ ${this.plugin.getEffectiveAgent(task.agent)}` });
      }
      if (task.branch) taskMeta.createSpan({ text: `🌿 ${task.branch}${task.createBranch ? " (create)" : ""}` });
      if (task.workingDirectory) taskMeta.createSpan({ text: `📂 ${task.workingDirectory}` });
      if (task.lastRun) taskMeta.createSpan({ text: `⏱ ${formatDateTime(task.lastRun)}` });

      const promptPreview = stepItem.createDiv("auto-oc-workflow-task-prompt");
      if ((task.taskKind || "opencode") === "code") {
        promptPreview.removeClass("auto-oc-workflow-task-prompt");
        promptPreview.addClass("auto-oc-code-preview-wrap");
        renderCodePreview(promptPreview, task.code || task.prompt || "", 500);
      } else {
        promptPreview.createSpan({
          text: task.prompt.slice(0, 180) + (task.prompt.length > 180 ? "…" : ""),
        });
      }

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
    const wfScheduleMonthDays = workflow.scheduleMonthDays || [];
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
      } else if (wfScheduleType === "monthly") {
        const days = wfScheduleMonthDays.join(", ");
        schedMeta.createEl("span", { text: `🔁 Day ${days || "no days"} of each month at ${wfScheduleTime}` });
      } else if (wfScheduleType === "interval") {
        const value = workflow.scheduleIntervalValue ?? 10;
        const unit = workflow.scheduleIntervalUnit ?? "minutes";
        schedMeta.createEl("span", { text: `🔁 Every ${value} ${unit}` });
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

    if (workflow.status === "running") {
      const btnStop = actions.createEl("button", {
        text: "⏹ Stop",
        cls: "auto-oc-btn-stop",
      });
      btnStop.title = "Stop workflow now";
      btnStop.onclick = async (e) => {
        e.stopPropagation();
        btnStop.disabled = true;
        btnStop.textContent = "Stopping…";
        await this.plugin.killWorkflow(workflow.id);
      };
    }

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
      if (!confirm(`Delete workflow "${workflow.name}"?`)) return;
      const workflowTaskIds = this.plugin.workflowTaskIds(workflow);
      const taskIdsOnlyUsedHere = this.plugin.workflowTaskIdsUsedOnlyBy(workflow.id);
      let deleteWorkflowTasks = false;
      if (workflowTaskIds.length > 0) {
        const sharedCount = workflowTaskIds.length - taskIdsOnlyUsedHere.length;
        const sharedNote = sharedCount > 0
          ? `\n\n${sharedCount} task(s) are also used by other workflows and will be kept.`
          : "";
        deleteWorkflowTasks = taskIdsOnlyUsedHere.length > 0 && confirm(
          `Also delete ${taskIdsOnlyUsedHere.length} task(s) used only by this workflow?${sharedNote}`
        );
      }
      await this.plugin.deleteWorkflow(workflow.id, deleteWorkflowTasks);
    };

    summary.onclick = () => {
      const isHidden = details.style.display === "none";
      details.style.display = isHidden ? "block" : "none";
      card.classList.toggle("expanded", isHidden);
      if (isHidden) {
        this.expandedWorkflows.add(workflow.id);
      } else {
        this.expandedWorkflows.delete(workflow.id);
      }
    };
  }
}

// ─── Visual Builder View ──────────────────────────────────────────────────────
//
// Hosts the standalone HTML visual builder (util/ui_workflow_builder) inside
// an iframe. The iframe talks to the extension through `postMessage`:
//   1. On load, the iframe posts {type:"ready"}.
//   2. The view responds with {type:"load", state: {tasks, workflows}}.
//   3. The user edits and posts {type:"apply", state: {...}}.
//   4. The view merges the state into the plugin's settings.
//
// We intentionally run the visual builder as an iframe (rather than inlining
// its HTML/JS) so the same code can be opened in a regular browser and remain
// fully self-contained — useful for designing on machines without Obsidian.

class VisualBuilderModal extends Modal {
  private plugin: AutoOCPlugin;
  private iframe: HTMLIFrameElement | null = null;
  private ready: boolean = false;
  private isDirty: boolean = false;
  // Tracks the in-flight settings mutation; the modal closes on success
  // if the user clicked "Apply and close".
  private closeAfterApply: boolean = false;

  constructor(app: App, plugin: AutoOCPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl, modalEl, titleEl } = this;
    this.plugin.registerVisualBuilder(this);
    contentEl.empty();
    // Hide the default Obsidian modal title — we render our own
    // toolbar at the top of the content area instead. Hiding the title
    // gives the visual builder more vertical space.
    if (titleEl && (titleEl as HTMLElement).style) {
      (titleEl as HTMLElement).style.display = "none";
    }
    // Resize the modal to be a near-fullscreen, centered window. This
    // gives the visual builder a comfortable working area, unlike the
    // cramped sidebar leaf it lived in before.
    setAutoOCModalFullscreen(this);
    preventBackdropClose(this);

    // ── Toolbar ──
    const toolbar = contentEl.createDiv("auto-oc-visual-toolbar");
    const titleSpan = toolbar.createSpan("toolbar-title");
    titleSpan.textContent = "✨ WF Visual Builder";
    titleSpan.style.fontSize = "13px";
    const btnReload = toolbar.createEl("button", { text: "Reload state" });
    btnReload.onclick = () => this.sendState();
    const btnSave = toolbar.createEl("button", { text: "Apply" });
    btnSave.title = "Apply the changes from the visual builder back to AutoOC without closing this window";
    btnSave.onclick = () => {
      this.closeAfterApply = false;
      this.requestApply();
    };
    const btnApply = toolbar.createEl("button", { text: "Apply and close" });
    btnApply.title = "Apply the changes from the visual builder back to AutoOC and close this window";
    btnApply.addClass("mod-cta");
    btnApply.onclick = () => {
      this.closeAfterApply = true;
      this.requestApply();
    };
    const spacer = toolbar.createDiv("toolbar-spacer");
    const hint = toolbar.createSpan("toolbar-hint");
    hint.textContent = "Drag a Task / Delay / Code from the left, connect ports to wire transitions, click an edge to change its mode (Default / Force / AI / Conditional), then Apply.";
    contentEl.appendChild(toolbar);

    // ── iframe ──
    const iframeWrap = contentEl.createDiv("auto-oc-visual-iframe-wrap");
    const iframe = iframeWrap.createEl("iframe");
    // Explicit dimensions in case the stylesheet didn't load yet
    // (e.g. when the modal is first opened) so the iframe doesn't
    // render at its default 300x150 placeholder size.
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.style.display = "block";
    iframe.style.flex = "1 1 auto";
    iframe.srcdoc = visualBuilderHtml;
    this.iframe = iframe;

    // Listen for postMessage from the iframe. We register a `this`-bound
    // handler so we can unregister it in onClose.
    this.messageHandler = (ev: MessageEvent) => {
      const data = ev.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "ready") {
        this.ready = true;
        this.sendState();
      } else if (data.type === "apply") {
        this.applyExternalState(data.state).then(() => {
          if (this.closeAfterApply) this.close();
        });
      } else if (data.type === "refresh-agents") {
        const cwd = this.plugin.settings.workingDirectory || (this.app.vault.adapter as any).basePath || ".";
        this.plugin.refreshAgents(cwd);
        new Notice(`AutoOC: ${this.plugin.availableAgents.length} agents loaded from project/global config.`);
        this.sendMeta();
      } else if (data.type === "refresh-models") {
        this.plugin.refreshModels();
        new Notice("AutoOC: models updated.");
        this.sendMeta();
      } else if (data.type === "log") {
        // eslint-disable-next-line no-console
        console.log("[VisualBuilder]", data.message);
      }
    };
    window.addEventListener("message", this.messageHandler);
  }

  // Stored so we can unregister it in onClose.
  private messageHandler?: (ev: MessageEvent) => void;

  onClose() {
    this.plugin.unregisterVisualBuilder(this);
    if (this.messageHandler) {
      window.removeEventListener("message", this.messageHandler);
      this.messageHandler = undefined;
    }
    this.iframe = null;
    this.ready = false;
    // Refresh the underlying AutoOC view so changes appear immediately.
    this.plugin.view?.refresh();
  }

  // Send the current tasks/workflows to the iframe.
  sendState() {
    if (!this.iframe || !this.iframe.contentWindow) return;
    const payload = {
      type: "load",
      state: {
        tasks: this.plugin.settings.tasks,
        workflows: this.plugin.settings.workflows,
        meta: {
          availableAgents: this.plugin.availableAgents,
          availableModels: this.plugin.availableModels,
          pluginVersion: this.plugin.manifest.version,
        },
      },
    };
    try {
      this.iframe.contentWindow.postMessage(payload, "*");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("VisualBuilder postMessage failed:", e);
    }
  }

  sendMeta() {
    if (!this.iframe || !this.iframe.contentWindow) return;
    const payload = {
      type: "meta",
      meta: {
        availableAgents: this.plugin.availableAgents,
        availableModels: this.plugin.availableModels,
        pluginVersion: this.plugin.manifest.version,
      },
    };
    try {
      this.iframe.contentWindow.postMessage(payload, "*");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("VisualBuilder postMessage failed:", e);
    }
  }

  // Ask the iframe to send back the current state.
  requestApply() {
    if (!this.iframe || !this.iframe.contentWindow) return;
    this.iframe.contentWindow.postMessage({ type: "request-apply" }, "*");
  }

  // Replace tasks/workflows with the values provided by the iframe. Smart-merge:
  // for tasks/workflows that already exist in the extension, keep runtime state
  // (status, lastRun, output) and any field the iframe did not send (workingDirectory
  // and the Git branch fields live in the classic modal, not the VB property panel).
  // This means editing a task in the visual builder no longer wipes the last
  // execution log or the "currently running" indicator.
  async applyExternalState(state: any) {
    if (!state || !Array.isArray(state.tasks) || !Array.isArray(state.workflows)) {
      new Notice("Visual Builder: invalid state payload.");
      return;
    }
    const oldTasks = this.plugin.settings.tasks;
    const oldWorkflows = this.plugin.settings.workflows;
    const oldTaskById = new Map(oldTasks.map((task) => [task.id, task]));
    const oldWorkflowById = new Map(oldWorkflows.map((workflow) => [workflow.id, workflow]));
    const newTasks: ScheduledTask[] = state.tasks.map((t: any) => {
      const existing = oldTasks.find((x) => x.id === t.id);
      const id = (existing ? t.id : t.id || generateId());
      // Editing should never launch a task by making an already-completed
      // one-shot item pending again. Preserve runtime state; Play or the next
      // real schedule tick is responsible for execution.
      const status = existing?.status || "pending";
      const lastRun = existing?.lastRun || "";
      const output = existing?.output || "";
      return {
        id,
        taskKind: t.taskKind || existing?.taskKind || "opencode",
        name: t.name || "Unnamed",
        area: t.area !== undefined ? (t.area || "") : (existing?.area || ""),
        prompt: t.prompt || "",
        model: t.model || this.plugin.getEffectiveDefaultModel(),
        agent: t.agent || this.plugin.getEffectiveAgent(),
        useRalphLoop: t.useRalphLoop !== undefined ? !!t.useRalphLoop : (existing?.useRalphLoop ?? false),
        scheduleType: t.scheduleType || "manual",
        scheduleTime: t.scheduleTime || "09:00",
        scheduleDate: t.scheduleDate || "",
        scheduleDays: Array.isArray(t.scheduleDays) ? t.scheduleDays : [],
        scheduleMonthDays: Array.isArray(t.scheduleMonthDays) ? t.scheduleMonthDays : [],
        scheduleIntervalValue: typeof t.scheduleIntervalValue === "number" ? t.scheduleIntervalValue : (existing?.scheduleIntervalValue ?? 10),
        scheduleIntervalUnit: t.scheduleIntervalUnit || existing?.scheduleIntervalUnit || "minutes",
        status,
        lastRun,
        output,
        createdAt: existing?.createdAt || t.createdAt || new Date().toISOString(),
        // Preserve classic-only fields when older Visual Builder payloads do
        // not send them.
        workingDirectory: t.workingDirectory !== undefined ? t.workingDirectory : (existing?.workingDirectory ?? ""),
        branch: t.branch !== undefined ? (t.branch || "") : (existing?.branch || ""),
        createBranch: t.createBranch !== undefined ? !!t.createBranch : (existing?.createBranch ?? false),
        interactiveTerminal: t.interactiveTerminal !== undefined ? !!t.interactiveTerminal : existing?.interactiveTerminal,
        code: t.code !== undefined ? t.code : existing?.code,
        codeLang: t.codeLang !== undefined ? t.codeLang : existing?.codeLang,
        codeInputVar: t.codeInputVar !== undefined ? t.codeInputVar : existing?.codeInputVar,
        codeOutputVar: t.codeOutputVar !== undefined ? t.codeOutputVar : existing?.codeOutputVar,
        codeAllowVault: t.codeAllowVault !== undefined ? !!t.codeAllowVault : existing?.codeAllowVault,
        codeAllowFiles: t.codeAllowFiles !== undefined ? !!t.codeAllowFiles : existing?.codeAllowFiles,
        codeAllowTerminal: t.codeAllowTerminal !== undefined ? !!t.codeAllowTerminal : existing?.codeAllowTerminal,
      };
    });
    const newWorkflows: Workflow[] = state.workflows.map((w: any) => {
      const existing = oldWorkflows.find((x) => x.id === w.id);
      const id = (existing ? w.id : w.id || generateId());
      // Editing should not make a completed one-shot workflow pending again.
      // Preserve runtime state; Play or the next real schedule tick launches it.
      const status = existing?.status || "pending";
      const currentStep = existing?.currentStep ?? -1;
      return {
        id,
        name: w.name || "Unnamed",
        area: w.area !== undefined ? (w.area || "") : (existing?.area || ""),
        description: w.description || "",
        steps: (w.steps || []).map((s: any, i: number) => {
          const oldStep = existing?.steps.find((x) => x.id === s.id);
          return {
            id: s.id || generateId(),
            stepKind: s.stepKind || "task",
            name: s.name,
            area: s.area || w.area || existing?.area || "",
            taskId: s.taskId,
            transitionMode: s.transitionMode,
            evaluatePrompt: s.evaluatePrompt,
            forceContinue: s.forceContinue,
            delayValue: s.delayValue,
            delayUnit: s.delayUnit,
            code: s.code,
            codeLang: s.codeLang,
            codeInputVar: s.codeInputVar,
            codeOutputVar: s.codeOutputVar,
            codeAllowVault: s.codeAllowVault,
            codeAllowFiles: s.codeAllowFiles,
            codeAllowTerminal: s.codeAllowTerminal,
            // Preserve per-step runtime state (lastRun, output, status) so
            // a user editing a non-running step in the VB does not lose
            // its captured log/output.
            status: oldStep?.status,
            lastRun: oldStep?.lastRun,
            output: oldStep?.output,
            transitions: s.transitions,
            position: s.position || { x: 40 + i * 280, y: 60 },
          };
        }),
        status,
        currentStep,
        createdAt: existing?.createdAt || w.createdAt || new Date().toISOString(),
        lastRun: existing?.lastRun,
        handoffBranch: t_or_undef(w.handoffBranch, existing?.handoffBranch ?? false),
        handoffOutput: t_or_undef(w.handoffOutput, existing?.handoffOutput ?? true) !== false,
        scheduleType: w.scheduleType || "manual",
        scheduleTime: w.scheduleTime || "09:00",
        scheduleDate: w.scheduleDate || "",
        scheduleDays: Array.isArray(w.scheduleDays) ? w.scheduleDays : [],
        scheduleMonthDays: Array.isArray(w.scheduleMonthDays) ? w.scheduleMonthDays : [],
        scheduleIntervalValue: typeof w.scheduleIntervalValue === "number" ? w.scheduleIntervalValue : (existing?.scheduleIntervalValue ?? 10),
        scheduleIntervalUnit: w.scheduleIntervalUnit || existing?.scheduleIntervalUnit || "minutes",
      };
    });
    const renamedTasks = newTasks.filter((task) => oldTaskById.get(task.id)?.name !== undefined && oldTaskById.get(task.id)?.name !== task.name);
    const renamedWorkflows = newWorkflows.filter((workflow) => oldWorkflowById.get(workflow.id)?.name !== undefined && oldWorkflowById.get(workflow.id)?.name !== workflow.name);
    this.plugin.settings.tasks = newTasks;
    this.plugin.settings.workflows = newWorkflows;
    await this.plugin.saveSettings(false);
    this.plugin.view?.refresh();
    renamedTasks.forEach((task) => this.plugin.emitTaskUpdated(task));
    renamedWorkflows.forEach((workflow) => this.plugin.emitWorkflowUpdated(workflow));
    new Notice(`AutoOC: applied ${newTasks.length} task(s) and ${newWorkflows.length} workflow(s) from Visual Builder.`);
  }
}

class ConfirmModal extends Modal {
  private resolve?: (value: boolean) => void;

  constructor(app: App, private titleText: string, private bodyText: string) {
    super(app);
  }

  openAndWait(): Promise<boolean> {
    this.open();
    return new Promise((resolve) => { this.resolve = resolve; });
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("auto-oc-modal");
    setupModalX(this);
    contentEl.createEl("h3", { text: this.titleText });
    contentEl.createEl("p", { text: this.bodyText, cls: "setting-item-description" });
    new Setting(contentEl)
      .addButton((btn) => btn.setButtonText("Cancel").onClick(() => { this.resolve?.(false); this.close(); }))
      .addButton((btn) => btn.setButtonText("Confirm").setWarning().onClick(() => { this.resolve?.(true); this.close(); }));
  }

  onClose() {
    this.resolve?.(false);
    this.resolve = undefined;
    this.contentEl.empty();
  }
}

class SecretsPinModal extends Modal {
  private resolve?: (value: boolean) => void;
  private settled = false;
  private pin = "";
  private confirmPin = "";

  constructor(app: App, private store: SecretStore, private mode: "create" | "unlock") {
    super(app);
  }

  openAndWait(): Promise<boolean> {
    this.open();
    return new Promise((resolve) => { this.resolve = resolve; });
  }

  private finish(value: boolean): void {
    this.settled = true;
    this.resolve?.(value);
    this.close();
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("auto-oc-modal");
    setupModalX(this);
    preventBackdropClose(this);
    contentEl.createEl("h3", { text: this.mode === "create" ? "Create Secrets PIN" : "Unlock Secrets" });
    contentEl.createEl("p", {
      text: this.mode === "create"
        ? "This PIN protects the Secrets UI. It can be reset without deleting encrypted secrets."
        : "Enter the Secrets UI PIN.",
      cls: "setting-item-description",
    });

    new Setting(contentEl)
      .setName("PIN")
      .addText((text) => {
        text.inputEl.type = "password";
        text.inputEl.addClass("auto-oc-modal-input");
        text.onChange((v) => (this.pin = v));
        window.setTimeout(() => text.inputEl.focus(), 50);
      });

    if (this.mode === "create") {
      new Setting(contentEl)
        .setName("Confirm PIN")
        .addText((text) => {
          text.inputEl.type = "password";
          text.inputEl.addClass("auto-oc-modal-input");
          text.onChange((v) => (this.confirmPin = v));
        });
    }

    new Setting(contentEl)
      .addButton((btn) => btn.setButtonText("Cancel").onClick(() => this.finish(false)))
      .addButton((btn) => btn.setButtonText(this.mode === "create" ? "Create PIN" : "Unlock").setCta().onClick(() => {
        if (this.pin.length < 4) {
          new Notice("AutoOC: PIN must be at least 4 characters.");
          return;
        }
        if (this.mode === "create") {
          if (this.pin !== this.confirmPin) {
            new Notice("AutoOC: PIN confirmation does not match.");
            return;
          }
          this.store.setPin(this.pin);
          new Notice("AutoOC: Secrets PIN created.");
          this.finish(true);
          return;
        }
        if (!this.store.verifyPin(this.pin)) {
          new Notice("AutoOC: incorrect PIN.");
          return;
        }
        this.finish(true);
      }));
  }

  onClose() {
    if (!this.settled) this.resolve?.(false);
    this.resolve = undefined;
    this.contentEl.empty();
  }
}

class SecretEditModal extends Modal {
  private draft: { name: string; envName: string; type: SecretType; profile: string; value: string; notes: string };

  constructor(app: App, private plugin: AutoOCPlugin, private secret: SecretRecord | undefined, private onSaved: () => void) {
    super(app);
    this.draft = {
      name: secret?.name || "",
      envName: secret?.envName || "",
      type: secret?.type || "token",
      profile: secret?.profile || "default",
      value: "",
      notes: secret?.notes || "",
    };
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("auto-oc-modal");
    setAutoOCModalSize(this, 720);
    setupModalX(this);
    preventBackdropClose(this);
    contentEl.createEl("h3", { text: this.secret ? "Edit Secret" : "New Secret" });

    new Setting(contentEl)
      .setName("Name")
      .setDesc("Human-readable name, for example jira-token or web-login-password.")
      .addText((text) => {
        text.inputEl.addClass("auto-oc-modal-input");
        text.setValue(this.draft.name).onChange((v) => {
          this.draft.name = v;
          if (!this.secret && !this.draft.envName.trim()) this.draft.envName = normalizeEnvName(v);
        });
        window.setTimeout(() => text.inputEl.focus(), 50);
      });

    new Setting(contentEl)
      .setName("Environment variable")
      .setDesc("Use this in opencode MCP config as {env:NAME}.")
      .addText((text) => {
        text.inputEl.addClass("auto-oc-modal-input");
        text.setPlaceholder("AUTOOC_JIRA_TOKEN").setValue(this.draft.envName).onChange((v) => (this.draft.envName = v));
      });

    new Setting(contentEl)
      .setName("Type")
      .addDropdown((dd) => {
        for (const type of SECRET_TYPES) dd.addOption(type, type);
        dd.setValue(this.draft.type);
        dd.onChange((v) => (this.draft.type = v as SecretType));
      });

    new Setting(contentEl)
      .setName("Profile")
      .setDesc("default is always injected. Other profiles are reserved for future per-task selection.")
      .addText((text) => {
        text.inputEl.addClass("auto-oc-modal-input");
        text.setValue(this.draft.profile).onChange((v) => (this.draft.profile = v || "default"));
      });

    new Setting(contentEl)
      .setName(this.secret ? "New value" : "Value")
      .setDesc(this.secret
        ? "Paste the new password/token as plain text. AutoOC encrypts it when you save. Leave empty to keep the current value."
        : "Paste the password/token as plain text. AutoOC encrypts it when you save; the table never shows it."
      )
      .addTextArea((ta) => {
        ta.inputEl.addClass("auto-oc-modal-textarea");
        ta.inputEl.rows = 4;
        ta.inputEl.spellcheck = false;
        ta.setValue(this.draft.value).onChange((v) => (this.draft.value = v));
      });

    new Setting(contentEl)
      .setName("Notes")
      .addText((text) => {
        text.inputEl.addClass("auto-oc-modal-input");
        text.setValue(this.draft.notes).onChange((v) => (this.draft.notes = v));
      });

    new Setting(contentEl)
      .addButton((btn) => btn.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((btn) => btn.setButtonText("Save Secret").setCta().onClick(() => {
        if (!this.draft.name.trim()) {
          new Notice("AutoOC: secret name is required.");
          return;
        }
        if (!this.secret && !this.draft.value) {
          new Notice("AutoOC: secret value is required.");
          return;
        }
        try {
          this.plugin.secretStore.upsert({
            id: this.secret?.id,
            name: this.draft.name,
            envName: this.draft.envName || this.draft.name,
            type: this.draft.type,
            profile: this.draft.profile || "default",
            value: this.draft.value || undefined,
            notes: this.draft.notes,
          });
          new Notice("AutoOC: secret saved.");
          this.onSaved();
          this.close();
        } catch (e) {
          new Notice(`AutoOC: could not save secret — ${String(e)}`);
        }
      }));
  }

  onClose() {
    this.contentEl.empty();
  }
}

class SecretRevealModal extends Modal {
  constructor(app: App, private secret: SecretRecord, private value: string) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("auto-oc-modal");
    setupModalX(this);
    contentEl.createEl("h3", { text: `Secret: ${this.secret.name}` });
    contentEl.createEl("p", { text: this.secret.envName, cls: "setting-item-description" });
    const textarea = contentEl.createEl("textarea", { cls: "auto-oc-modal-textarea" });
    textarea.value = this.value;
    textarea.readOnly = true;
    textarea.rows = 4;
    textarea.style.width = "100%";
    new Setting(contentEl)
      .addButton((btn) => btn.setButtonText("Copy value").onClick(async () => {
        await copyTextToClipboard(this.value);
        new Notice("AutoOC: secret copied.");
      }))
      .addButton((btn) => btn.setButtonText("Close").onClick(() => this.close()));
  }

  onClose() {
    this.value = "";
    this.contentEl.empty();
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
            taskKind: "opencode",
            prompt: "",
            model: plugin.getEffectiveDefaultModel(),
            agent: plugin.getEffectiveAgent(),
            useRalphLoop: false,
            interactiveTerminal: plugin.settings.defaultInteractiveTerminal,
            scheduleType: "manual",
            scheduleTime: nowTimeString(),
            scheduleDate: todayString(),
            scheduleDays: [],
            scheduleMonthDays: [],
            scheduleIntervalValue: 10,
            scheduleIntervalUnit: "minutes",
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
    const taskKind = (this.draft.taskKind || "opencode") as TaskKind;
    const taskType = taskKind === "opencode" && this.draft.interactiveTerminal ? "cli" : taskKind;
    headerBar.createEl("h3", {
      text: this.editTask ? "Edit Task" : "New Task",
    });

    if (!this.editTask) {
      new Setting(contentEl)
        .setName("Task type")
        .setDesc("Choose whether this task asks OpenCode to work, or runs local JavaScript directly.")
        .addDropdown((dd) => {
          dd.addOption("opencode", "OpenCode task");
          dd.addOption("code", "Code task");
          dd.addOption("cli", "CLI task");
          dd.setValue(taskType);
          dd.onChange((v) => {
            this.draft.taskKind = v === "code" ? "code" : "opencode";
            this.draft.interactiveTerminal = v === "cli";
            if (v === "code" && !this.draft.code) {
              this.draft.code = "// Set output to pass data forward\noutput = input;";
            }
            this.onOpen();
          });
        });
    } else {
      new Setting(contentEl)
        .setName("Task type")
        .setDesc(taskKind === "code" ? "Code task" : this.draft.interactiveTerminal ? "CLI task" : "OpenCode task");
    }

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
      .setName("Area")
      .setDesc("Optional dashboard grouping area")
      .addText((text) => {
        text.inputEl.addClass("auto-oc-modal-input");
        text
          .setPlaceholder("No area")
          .setValue(this.draft.area ?? "")
          .onChange((v) => (this.draft.area = v.trim()));
        renderAreaSuggestions(contentEl, text.inputEl, getConfiguredAreaNames(this.plugin.settings), (area) => {
          this.draft.area = area;
        });
      });

    if (taskKind === "code") {
      const initialCode = this.draft.code ?? "// Set output to pass data forward\noutput = input;";
      new Setting(contentEl)
        .setName("JavaScript code")
        .setDesc("Available variables: input, outputs, JSON, Math, Date, String, Number, Boolean, Array, Object, RegExp. Set output to return data.")
        .addTextArea((ta) => {
          ta.setValue(initialCode).onChange((v) => (this.draft.code = v));
          ta.inputEl.addClass("auto-oc-modal-textarea");
          setupCodeTextarea(ta.inputEl);
          ta.inputEl.rows = 12;
          ta.inputEl.style.width = "100%";
        });

      new Setting(contentEl)
        .setName("Variables")
        .setDesc("Input variable starts empty for scheduled runs; output variable is saved as task output")
        .addText((text) => {
          text.inputEl.addClass("auto-oc-modal-input");
          text.setPlaceholder("input").setValue(this.draft.codeInputVar || "input").onChange((v) => (this.draft.codeInputVar = v || "input"));
        })
        .addText((text) => {
          text.inputEl.addClass("auto-oc-modal-input");
          text.setPlaceholder("output").setValue(this.draft.codeOutputVar || "output").onChange((v) => (this.draft.codeOutputVar = v || "output"));
        });
    } else {
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
    }

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
    if (taskKind === "opencode") {
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
    }

    if (taskKind === "opencode") {
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

    } else {
      contentEl.createDiv("auto-oc-modal-section-title").setText("Code permissions");
      new Setting(contentEl)
        .setName("Vault API")
        .setDesc("Expose vault.read/write/append/exists/list, confined to this Obsidian vault.")
        .addToggle((tog) => {
          tog.setValue(!!this.draft.codeAllowVault);
          tog.onChange((v) => (this.draft.codeAllowVault = v));
        });
      new Setting(contentEl)
        .setName("Local files API")
        .setDesc("Expose files.read/write/append/exists/list for local paths. Relative paths use Project Path or the vault root.")
        .addToggle((tog) => {
          tog.setValue(!!this.draft.codeAllowFiles);
          tog.onChange((v) => (this.draft.codeAllowFiles = v));
        });
      new Setting(contentEl)
        .setName("Terminal API")
        .setDesc("Expose terminal.run(command, { cwd, timeoutMs }).")
        .addToggle((tog) => {
          tog.setValue(!!this.draft.codeAllowTerminal);
          tog.onChange((v) => (this.draft.codeAllowTerminal = v));
        });
    }

    new Setting(contentEl)
      .setName("Schedule Type")
      .addDropdown((dd) => {
        dd.addOption("manual", "Manual (run only when I press play)");
        dd.addOption("once", "Once (specific date and time)");
        dd.addOption("daily", "Daily (fixed time)");
        dd.addOption("weekly", "Weekdays");
        dd.addOption("monthly", "Monthly (days of month)");
        dd.addOption("interval", "Interval (every X seconds/minutes/hours)");
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

    // Month days — only for 'monthly'
    if (this.draft.scheduleType === "monthly") {
      new Setting(contentEl)
        .setName("Days of month")
        .setDesc("Numbers from 1 to 31 separated by comma, semicolon, or spaces. Example: 1, 15, 31")
        .addText((text) => {
          text.inputEl.addClass("auto-oc-modal-input");
          text
            .setPlaceholder("1, 15, 31")
            .setValue((this.draft.scheduleMonthDays ?? []).join(", "))
            .onChange((v) => {
              const parsed = parseMonthDays(v);
              this.draft.scheduleMonthDays = parsed ?? [];
            });
        });
    }

    // Interval — only for 'interval'
    if (this.draft.scheduleType === "interval") {
      new Setting(contentEl)
        .setName("Interval")
        .setDesc("Run the task repeatedly every X units")
        .addText((text) => {
          text.inputEl.addClass("auto-oc-modal-input");
          text.inputEl.type = "number";
          text.inputEl.min = "1";
          text
            .setPlaceholder("10")
            .setValue(String(this.draft.scheduleIntervalValue ?? 10))
            .onChange((v) => {
              const n = parseInt(v, 10);
              this.draft.scheduleIntervalValue = isNaN(n) || n < 1 ? 1 : n;
            });
        })
        .addDropdown((dd) => {
          dd.addOption("seconds", "Seconds");
          dd.addOption("minutes", "Minutes");
          dd.addOption("hours", "Hours");
          dd.setValue(this.draft.scheduleIntervalUnit ?? "minutes");
          dd.onChange((v) => (this.draft.scheduleIntervalUnit = v as IntervalUnit));
        });
    }

    if (this.draft.scheduleType !== "manual" && this.draft.scheduleType !== "interval") {
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
          const savingTaskKind = (this.draft.taskKind || "opencode") as TaskKind;
          if (savingTaskKind === "opencode" && !this.draft.prompt?.trim()) {
            new Notice("Prompt is required.");
            return;
          }
          if (savingTaskKind === "code" && !(this.draft.code || "").trim()) {
            new Notice("Code is required.");
            return;
          }
          if (savingTaskKind === "opencode" && !(this.draft.model ?? "").trim()) {
            new Notice("You must select a model.");
            return;
          }
          if (
            this.draft.scheduleType !== "manual" &&
            this.draft.scheduleType !== "interval" &&
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
          if (
            this.draft.scheduleType === "monthly" &&
            (this.draft.scheduleMonthDays ?? []).length === 0
          ) {
            new Notice("Enter one or more valid days of the month from 1 to 31, separated by comma or semicolon.");
            return;
          }

          let updatedTask: ScheduledTask | null = null;
          let areaChanged = false;
          if (this.editTask) {
            const idx = this.plugin.settings.tasks.findIndex(
              (t) => t.id === this.editTask!.id
            );
            if (idx !== -1) {
              const existing = this.plugin.settings.tasks[idx];
              const previousArea = existing.area?.trim() || "";
              this.plugin.settings.tasks[idx] = {
                ...this.editTask,
                ...(this.draft as ScheduledTask),
                prompt: savingTaskKind === "code" ? (this.draft.code || "") : (this.draft.prompt || ""),
                taskKind: savingTaskKind,
                status: existing.status,
                lastRun: existing.lastRun,
                output: existing.output,
              };
              updatedTask = this.plugin.settings.tasks[idx];
              areaChanged = previousArea !== (updatedTask.area?.trim() || "");
            }
          } else {
            const task: ScheduledTask = {
              id: generateId(),
              taskKind: savingTaskKind,
              name: this.draft.name!,
              prompt: savingTaskKind === "code" ? (this.draft.code || "") : this.draft.prompt!,
              model: savingTaskKind === "code" ? "" : this.draft.model!,
              area: this.draft.area ?? "",
              agent: savingTaskKind === "code" ? "" : this.plugin.getEffectiveAgent(this.draft.agent),
              useRalphLoop: savingTaskKind === "opencode" ? (this.draft.useRalphLoop ?? false) : false,
              scheduleType: this.draft.scheduleType ?? "manual",
              scheduleTime: this.draft.scheduleTime ?? nowTimeString(),
              scheduleDate: this.draft.scheduleDate ?? "",
              scheduleDays: this.draft.scheduleDays ?? [],
              scheduleMonthDays: this.draft.scheduleMonthDays ?? [],
              scheduleIntervalValue: this.draft.scheduleIntervalValue ?? 10,
              scheduleIntervalUnit: this.draft.scheduleIntervalUnit ?? "minutes",
              status: "pending",
              lastRun: "",
              output: "",
              createdAt: new Date().toISOString(),
              workingDirectory: this.draft.workingDirectory,
              branch: savingTaskKind === "opencode" ? this.draft.branch : "",
              createBranch: savingTaskKind === "opencode" ? this.draft.createBranch : false,
              interactiveTerminal: savingTaskKind === "opencode" ? !!this.draft.interactiveTerminal : undefined,
              code: savingTaskKind === "code" ? this.draft.code : undefined,
              codeLang: savingTaskKind === "code" ? "javascript" : undefined,
              codeInputVar: savingTaskKind === "code" ? (this.draft.codeInputVar || "input") : undefined,
              codeOutputVar: savingTaskKind === "code" ? (this.draft.codeOutputVar || "output") : undefined,
              codeAllowVault: savingTaskKind === "code" ? !!this.draft.codeAllowVault : undefined,
              codeAllowFiles: savingTaskKind === "code" ? !!this.draft.codeAllowFiles : undefined,
              codeAllowTerminal: savingTaskKind === "code" ? !!this.draft.codeAllowTerminal : undefined,
            };
            this.plugin.settings.tasks.push(task);

          }

          await this.plugin.saveSettings(!this.editTask);
          if (updatedTask) {
            if (areaChanged) this.plugin.view?.render();
            this.plugin.emitTaskUpdated(updatedTask);
          }
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

class EditWorkflowStepModal extends Modal {
  private plugin: AutoOCPlugin;
  private workflow: Workflow;
  private step: WorkflowStep;
  private draft: WorkflowStep;

  constructor(app: App, plugin: AutoOCPlugin, workflow: Workflow, step: WorkflowStep) {
    super(app);
    this.plugin = plugin;
    this.workflow = workflow;
    this.step = step;
    this.draft = { ...step };
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("auto-oc-modal");
    setAutoOCModalSize(this, 760);
    preventBackdropClose(this);

    contentEl.createEl("h3", {
      text: this.step.stepKind === "delay" ? "Edit Delay Step" : "Edit Code Step",
    });

    new Setting(contentEl)
      .setName("Step name")
      .setDesc("Optional label used in this workflow")
      .addText((text) => {
        text.inputEl.addClass("auto-oc-modal-input");
        text
          .setPlaceholder(this.step.stepKind === "delay" ? "Delay" : "Code")
          .setValue(this.draft.name || "")
          .onChange((v) => (this.draft.name = v.trim()));
      });

    new Setting(contentEl)
      .setName("Area")
      .setDesc("Defaults to the workflow area")
      .addText((text) => {
        text.inputEl.addClass("auto-oc-modal-input");
        text
          .setPlaceholder(this.workflow.area?.trim() || "No area")
          .setValue(this.draft.area || this.workflow.area || "")
          .onChange((v) => (this.draft.area = v.trim()));
      });

    if (this.step.stepKind === "delay") {
      new Setting(contentEl)
        .setName("Delay")
        .setDesc("Pause the workflow before continuing")
        .addText((text) => {
          text.inputEl.addClass("auto-oc-modal-input");
          text.inputEl.type = "number";
          text.inputEl.min = "0";
          text.setValue(String(this.draft.delayValue ?? 5)).onChange((v) => {
            const n = parseInt(v, 10);
            this.draft.delayValue = isNaN(n) || n < 0 ? 0 : n;
          });
        })
        .addDropdown((dd) => {
          dd.addOption("seconds", "Seconds");
          dd.addOption("minutes", "Minutes");
          dd.addOption("hours", "Hours");
          dd.setValue(this.draft.delayUnit || "minutes");
          dd.onChange((v) => (this.draft.delayUnit = v as IntervalUnit));
        });
    } else {
      const initialCode = this.draft.code || "";
      new Setting(contentEl)
        .setName("JavaScript code")
        .setDesc("Available variables: input, outputs, JSON, Math, Date, String, Number, Boolean, Array, Object, RegExp. Set output to pass data forward.")
        .addTextArea((text) => {
          text.inputEl.addClass("auto-oc-modal-textarea");
          setupCodeTextarea(text.inputEl);
          text.inputEl.rows = 12;
          text.setValue(initialCode).onChange((v) => (this.draft.code = v));
        });

      new Setting(contentEl)
        .setName("Variables")
        .setDesc("Input variable receives previous step output; output variable is returned to the next step")
        .addText((text) => {
          text.inputEl.addClass("auto-oc-modal-input");
          text.setPlaceholder("input").setValue(this.draft.codeInputVar || "input").onChange((v) => (this.draft.codeInputVar = v || "input"));
        })
        .addText((text) => {
          text.inputEl.addClass("auto-oc-modal-input");
          text.setPlaceholder("output").setValue(this.draft.codeOutputVar || "output").onChange((v) => (this.draft.codeOutputVar = v || "output"));
        });

      contentEl.createDiv("auto-oc-modal-section-title").setText("Code permissions");

      new Setting(contentEl)
        .setName("Vault API")
        .setDesc("Expose vault.read/write/append/exists/list, confined to this Obsidian vault.")
        .addToggle((tog) => {
          tog.setValue(!!this.draft.codeAllowVault);
          tog.onChange((v) => (this.draft.codeAllowVault = v));
        });

      new Setting(contentEl)
        .setName("Local files API")
        .setDesc("Expose files.read/write/append/exists/list for local paths. Relative paths use AutoOC working directory or the vault root.")
        .addToggle((tog) => {
          tog.setValue(!!this.draft.codeAllowFiles);
          tog.onChange((v) => (this.draft.codeAllowFiles = v));
        });

      new Setting(contentEl)
        .setName("Terminal API")
        .setDesc("Expose terminal.run(command, { cwd, timeoutMs }). Commands run from AutoOC working directory or the vault root by default.")
        .addToggle((tog) => {
          tog.setValue(!!this.draft.codeAllowTerminal);
          tog.onChange((v) => (this.draft.codeAllowTerminal = v));
        });

      contentEl.createEl("p", {
        text: "Code steps run in a VM sandbox. Extra capabilities are only exposed when enabled above: vault, files, and terminal.",
        cls: "setting-item-description auto-oc-workflow-section-help",
      });
    }

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("Save Step")
        .setCta()
        .onClick(async () => {
          if (!this.draft.area?.trim()) this.draft.area = this.workflow.area || "";
          Object.assign(this.step, this.draft);
          const wfIdx = this.plugin.settings.workflows.findIndex((w) => w.id === this.workflow.id);
          if (wfIdx !== -1) {
            const stepIdx = this.plugin.settings.workflows[wfIdx].steps.findIndex((s) => s.id === this.step.id);
            if (stepIdx !== -1) {
              this.plugin.settings.workflows[wfIdx].steps[stepIdx] = { ...this.step };
            }
          }
          await this.plugin.saveSettings();
          this.plugin.view?.refresh();
          new Notice("AutoOC: workflow step saved.");
          this.close();
        })
    );
  }

  onClose() {
    this.contentEl.empty();
  }
}

class CreateWorkflowModal extends Modal {
  private plugin: AutoOCPlugin;
  private editWorkflow?: Workflow;
  private draft: Partial<Workflow>;
  private selectedSteps: WorkflowStep[];      // Ordered list
  private stepConfigs: Record<string, { transitionMode?: "default" | "force" | "eval"; evaluatePrompt?: string; forceContinue?: boolean }>;

  constructor(app: App, plugin: AutoOCPlugin, editWorkflow?: Workflow) {
    super(app);
    this.plugin = plugin;
    this.editWorkflow = editWorkflow;
    this.draft = editWorkflow
      ? { ...editWorkflow }
      : { name: "", description: "", handoffBranch: false, handoffOutput: true, scheduleType: "manual", scheduleTime: nowTimeString(), scheduleDate: todayString(), scheduleDays: [], scheduleMonthDays: [], scheduleIntervalValue: 10, scheduleIntervalUnit: "minutes" };
    this.selectedSteps = editWorkflow
      ? editWorkflow.steps.map((s, i) => ({
          ...s,
          id: s.id || generateId(),
          stepKind: s.stepKind || "task",
          area: s.area || editWorkflow.area || "",
          transitions: [...(s.transitions || [])],
          position: s.position || { x: 60 + i * 280, y: 60 },
        }))
      : [];
    this.stepConfigs = {};
    if (editWorkflow) {
      for (const step of editWorkflow.steps) {
        this.stepConfigs[step.id] = {
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
    guideList.createEl("li", { text: "Task schedules are ignored inside a workflow. A task can be reused even if its own schedule is manual, once, daily, weekly, monthly, completed, or pending." });
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
      .setName("Area")
      .setDesc("Optional dashboard grouping area")
      .addText((text) => {
        text.inputEl.addClass("auto-oc-modal-input");
        text
          .setPlaceholder("No area")
          .setValue(this.draft.area ?? "")
          .onChange((v) => {
            const previousArea = this.draft.area?.trim() || "";
            const nextArea = v.trim();
            this.draft.area = nextArea;
            this.selectedSteps.forEach((step) => {
              if (!step.area?.trim() || step.area.trim() === previousArea) step.area = nextArea;
            });
          });
        renderAreaSuggestions(contentEl, text.inputEl, getConfiguredAreaNames(this.plugin.settings), (area) => {
          this.draft.area = area;
          this.selectedSteps.forEach((step) => {
            if (!step.area?.trim()) step.area = area;
          });
        });
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
        dd.addOption("monthly", "Monthly (days of month)");
        dd.addOption("interval", "Interval (every X seconds/minutes/hours)");
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

    if (this.draft.scheduleType === "monthly") {
      new Setting(contentEl)
        .setName("Days of month")
        .setDesc("Numbers from 1 to 31 separated by comma, semicolon, or spaces. Example: 1, 15, 31")
        .addText((text) => {
          text.inputEl.addClass("auto-oc-modal-input");
          text
            .setPlaceholder("1, 15, 31")
            .setValue((this.draft.scheduleMonthDays ?? []).join(", "))
            .onChange((v) => {
              const parsed = parseMonthDays(v);
              this.draft.scheduleMonthDays = parsed ?? [];
            });
        });
    }

    // Interval — only for 'interval'
    if (this.draft.scheduleType === "interval") {
      new Setting(contentEl)
        .setName("Interval")
        .setDesc("Run the workflow repeatedly every X units")
        .addText((text) => {
          text.inputEl.addClass("auto-oc-modal-input");
          text.inputEl.type = "number";
          text.inputEl.min = "1";
          text
            .setPlaceholder("10")
            .setValue(String(this.draft.scheduleIntervalValue ?? 10))
            .onChange((v) => {
              const n = parseInt(v, 10);
              this.draft.scheduleIntervalValue = isNaN(n) || n < 1 ? 1 : n;
            });
        })
        .addDropdown((dd) => {
          dd.addOption("seconds", "Seconds");
          dd.addOption("minutes", "Minutes");
          dd.addOption("hours", "Hours");
          dd.setValue(this.draft.scheduleIntervalUnit ?? "minutes");
          dd.onChange((v) => (this.draft.scheduleIntervalUnit = v as IntervalUnit));
        });
    }

    if (this.draft.scheduleType !== "manual" && this.draft.scheduleType !== "interval") {
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
          if (this.selectedSteps.length < 2) {
            new Notice("A workflow needs at least 2 steps.");
            return;
          }
          if (
            this.draft.scheduleType !== "manual" &&
            this.draft.scheduleType !== "interval" &&
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
          if (
            this.draft.scheduleType === "monthly" &&
            (this.draft.scheduleMonthDays ?? []).length === 0
          ) {
            new Notice("Enter one or more valid days of the month from 1 to 31, separated by comma or semicolon.");
            return;
          }

          const steps: WorkflowStep[] = this.selectedSteps.map((src, idx) => {
            const config = this.stepConfigs[src.id] || {};
            const workflowArea = this.draft.area?.trim() || "";
            const step: WorkflowStep = {
              ...src,
              id: src.id || generateId(),
              stepKind: src.stepKind || "task",
              name: src.name?.trim() || undefined,
              area: src.area?.trim() || workflowArea,
              transitions: [],
              position: { x: 60 + idx * 280, y: 60 },
              transitionMode: config.transitionMode || "default",
              evaluatePrompt: config.evaluatePrompt,
              forceContinue: config.forceContinue,
            };
            return step;
          });
          // Wire linear transitions between consecutive steps.
          for (let i = 0; i < steps.length - 1; i++) {
            steps[i].transitions = [{
              toStepId: steps[i + 1].id,
              mode: (steps[i].transitionMode || "default") as TransitionMode,
              evaluatePrompt: steps[i].evaluatePrompt,
              forceContinue: steps[i].forceContinue,
            }];
          }

          let updatedWorkflow: Workflow | null = null;
          let areaChanged = false;
          if (this.editWorkflow) {
            const idx = this.plugin.settings.workflows.findIndex(
              (w) => w.id === this.editWorkflow!.id
            );
            if (idx !== -1) {
              const existing = this.plugin.settings.workflows[idx];
              const previousArea = existing.area?.trim() || "";
              this.plugin.settings.workflows[idx] = {
                ...this.editWorkflow,
                name: this.draft.name!,
                area: this.draft.area ?? "",
                description: this.draft.description,
                steps,
                handoffBranch: this.draft.handoffBranch ?? false,
                handoffOutput: this.draft.handoffOutput ?? false,
                status: existing.status,
                currentStep: existing.currentStep,
                lastRun: existing.lastRun,
                scheduleType: this.draft.scheduleType ?? "manual",
                scheduleTime: this.draft.scheduleTime ?? nowTimeString(),
                scheduleDate: this.draft.scheduleDate ?? "",
                scheduleDays: this.draft.scheduleDays ?? [],
                scheduleMonthDays: this.draft.scheduleMonthDays ?? [],
                scheduleIntervalValue: this.draft.scheduleIntervalValue ?? 10,
                scheduleIntervalUnit: this.draft.scheduleIntervalUnit ?? "minutes",
              };
              updatedWorkflow = this.plugin.settings.workflows[idx];
              areaChanged = previousArea !== (updatedWorkflow.area?.trim() || "");
            }
          } else {
            const workflow: Workflow = {
              id: generateId(),
              name: this.draft.name!,
              area: this.draft.area ?? "",
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
              scheduleMonthDays: this.draft.scheduleMonthDays ?? [],
              scheduleIntervalValue: this.draft.scheduleIntervalValue ?? 10,
              scheduleIntervalUnit: this.draft.scheduleIntervalUnit ?? "minutes",
            };
            this.plugin.settings.workflows.push(workflow);
          }

          await this.plugin.saveSettings(!this.editWorkflow);
          if (updatedWorkflow) {
            if (areaChanged) this.plugin.view?.render();
            this.plugin.emitWorkflowUpdated(updatedWorkflow);
          }
          new Notice(`Workflow "${this.draft.name}" saved.`);
          this.close();
        })
    );
  }

  private workflowStepLabel(step: WorkflowStep): string {
    if (step.name?.trim()) return step.name.trim();
    return this.defaultWorkflowStepName(step);
  }

  private defaultWorkflowStepName(step: WorkflowStep, index?: number): string {
    if (step.stepKind === "code") return "{ } Code";
    if (step.stepKind === "delay") return `⏱ ${step.delayValue ?? 5} ${step.delayUnit ?? "minutes"}`;
    const task = this.plugin.settings.tasks.find((t) => t.id === step.taskId);
    return task ? `${(task.taskKind || "opencode") === "code" ? "{ }" : "📌"} ${task.name}` : "❌ Deleted task";
  }

  private renderStepsList(container: HTMLElement) {
    container.empty();

    if (this.selectedSteps.length === 0) {
      container.createEl("p", {
        text: "No steps added yet. Add a task, code, or delay step below.",
        cls: "auto-oc-empty",
      });
    }

    for (let i = 0; i < this.selectedSteps.length; i++) {
      const step = this.selectedSteps[i];
      if (!step.id) step.id = generateId();
      const task = step.stepKind === "task" ? this.plugin.settings.tasks.find((t) => t.id === step.taskId) : undefined;
      const config = this.stepConfigs[step.id] || {};

      const stepEl = container.createDiv("auto-oc-workflow-step-item");
      const isLast = i === this.selectedSteps.length - 1;

      // Header row
      const header = stepEl.createDiv("auto-oc-workflow-step-header");
      header.createEl("span", {
        text: `Step ${i + 1}`,
        cls: "auto-oc-workflow-step-num",
      });
      header.createEl("span", {
        text: this.workflowStepLabel(step),
        cls: step.stepKind === "task" && !task ? "auto-oc-workflow-step-err" : "",
      });

      if (!isLast) {
        header.createEl("span", { text: "→", cls: "auto-oc-workflow-step-arrow" });
        header.createEl("span", {
          text: `Step ${i + 2}`,
          cls: "auto-oc-workflow-step-num",
        });
        header.createEl("span", { text: this.workflowStepLabel(this.selectedSteps[i + 1]) });
      }

      // Remove button
      const btnRemove = header.createEl("button", {
        text: "✖",
        cls: "auto-oc-btn-delete-small",
      });
      btnRemove.style.marginLeft = "auto";
      btnRemove.onclick = () => {
        this.selectedSteps.splice(i, 1);
        delete this.stepConfigs[step.id];
        this.renderStepsList(container);
      };

      new Setting(stepEl)
        .setName("Step name")
        .setDesc("Optional label used in this workflow")
        .addText((text) => {
          text.inputEl.addClass("auto-oc-modal-input");
          text
            .setPlaceholder(this.defaultWorkflowStepName(step, i))
            .setValue(step.name || "")
            .onChange((v) => {
              step.name = v.trim();
            });
        });

      new Setting(stepEl)
        .setName("Area")
        .setDesc("Defaults to the workflow area")
        .addText((text) => {
          text.inputEl.addClass("auto-oc-modal-input");
          text
            .setPlaceholder(this.draft.area?.trim() || "No area")
            .setValue(step.area || this.draft.area || "")
            .onChange((v) => (step.area = v.trim()));
        });

      if (step.stepKind === "code") {
        const initialCode = step.code || "";
        new Setting(stepEl)
          .setName("JavaScript code")
          .setDesc("Runs inside the workflow. Previous output is available as the input variable; assign the output variable to pass data forward.")
          .addTextArea((text) => {
            text.inputEl.addClass("auto-oc-modal-textarea");
            setupCodeTextarea(text.inputEl);
            text.inputEl.rows = 6;
            text.setValue(initialCode).onChange((v) => (step.code = v));
          });
        new Setting(stepEl)
          .setName("Variables")
          .setDesc("Input and output variable names")
          .addText((text) => {
            text.inputEl.addClass("auto-oc-modal-input");
            text.setPlaceholder("input").setValue(step.codeInputVar || "input").onChange((v) => (step.codeInputVar = v || "input"));
          })
          .addText((text) => {
            text.inputEl.addClass("auto-oc-modal-input");
            text.setPlaceholder("output").setValue(step.codeOutputVar || "output").onChange((v) => (step.codeOutputVar = v || "output"));
          });
        new Setting(stepEl)
          .setName("Code permissions")
          .setDesc("Expose optional APIs to this code step")
          .addToggle((tog) => {
            tog.setTooltip("Vault API");
            tog.setValue(!!step.codeAllowVault);
            tog.onChange((v) => (step.codeAllowVault = v));
            tog.toggleEl.insertAdjacentHTML("afterend", `<span class="auto-oc-day-label">Vault</span>`);
          })
          .addToggle((tog) => {
            tog.setTooltip("Local files API");
            tog.setValue(!!step.codeAllowFiles);
            tog.onChange((v) => (step.codeAllowFiles = v));
            tog.toggleEl.insertAdjacentHTML("afterend", `<span class="auto-oc-day-label">Files</span>`);
          })
          .addToggle((tog) => {
            tog.setTooltip("Terminal API");
            tog.setValue(!!step.codeAllowTerminal);
            tog.onChange((v) => (step.codeAllowTerminal = v));
            tog.toggleEl.insertAdjacentHTML("afterend", `<span class="auto-oc-day-label">Terminal</span>`);
          });
      } else if (step.stepKind === "delay") {
        new Setting(stepEl)
          .setName("Delay")
          .setDesc("Pause the workflow before continuing")
          .addText((text) => {
            text.inputEl.addClass("auto-oc-modal-input");
            text.inputEl.type = "number";
            text.inputEl.min = "0";
            text.setValue(String(step.delayValue ?? 5)).onChange((v) => {
              const n = parseInt(v, 10);
              step.delayValue = isNaN(n) || n < 0 ? 0 : n;
            });
          })
          .addDropdown((dd) => {
            dd.addOption("seconds", "Seconds");
            dd.addOption("minutes", "Minutes");
            dd.addOption("hours", "Hours");
            dd.setValue(step.delayUnit || "minutes");
            dd.onChange((v) => (step.delayUnit = v as IntervalUnit));
          });
      }

      // Transition config (only if not last)
      if (!isLast) {
        const transConfig = stepEl.createDiv("auto-oc-workflow-transition");
        const nextStep = this.selectedSteps[i + 1];

        const transitionHeader = transConfig.createDiv("auto-oc-workflow-transition-header");
        transitionHeader.createSpan({
          text: `Transition: Step ${i + 1} → Step ${i + 2}`,
          cls: "auto-oc-workflow-transition-title",
        });
        transitionHeader.createSpan({
          text: `After «${this.workflowStepLabel(step)}» finishes, decide whether «${this.workflowStepLabel(nextStep)}» starts.`,
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
          this.stepConfigs[step.id] = this.stepConfigs[step.id] || {};
          if (modeSel.value === "force") {
            this.stepConfigs[step.id].transitionMode = "force";
            this.stepConfigs[step.id].forceContinue = true;
            this.stepConfigs[step.id].evaluatePrompt = undefined;
          } else if (modeSel.value === "eval") {
            this.stepConfigs[step.id].transitionMode = "eval";
            this.stepConfigs[step.id].forceContinue = undefined;
            this.stepConfigs[step.id].evaluatePrompt = this.stepConfigs[step.id].evaluatePrompt ?? defaultEvalPrompt;
          } else {
            this.stepConfigs[step.id].transitionMode = "default";
            this.stepConfigs[step.id].forceContinue = undefined;
            this.stepConfigs[step.id].evaluatePrompt = undefined;
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
            text: `Write the condition here. OpenCode will receive this text plus the output of «${this.workflowStepLabel(step)}». It must answer YES to start «${this.workflowStepLabel(nextStep)}».`,
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
            { label: "Errors?", prompt: "Did the previous task complete without errors or failures? Look for error messages, stack traces, or exit codes in the output. If no errors were found, reply YES. If there were errors, reply NO." },
            { label: "Tests OK?", prompt: "Were all tests executed successfully? Check the output for test failures, assertion errors, or test suite crashes. If all tests passed, reply YES. If any test failed, reply NO." },
            { label: "Build OK?", prompt: "Was the build successful? Check for compilation errors, linker errors, or build failures. If the build completed without errors, reply YES. Otherwise reply NO." },
            { label: "Work left?", prompt: "Based on the output, is there remaining work that requires a follow-up step? Look for TODO comments, unfinished tasks, or incomplete implementations. If more work is needed, reply YES. If the task is fully complete, reply NO." },
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
                this.stepConfigs[step.id] = this.stepConfigs[step.id] || {};
                this.stepConfigs[step.id].evaluatePrompt = p.prompt;
                previewCode.textContent = `${p.prompt}\n\nPrevious step output:\n---\n[output of «${this.workflowStepLabel(step)}» appears here]\n---\n\nReply ONLY with YES or NO.`;
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
          previewCode.textContent = `${currentEvalText}\n\nPrevious step output:\n---\n[output of «${this.workflowStepLabel(step)}» appears here]\n---\n\nReply ONLY with YES or NO.`;
          evalTextarea.oninput = () => {
            this.stepConfigs[step.id] = this.stepConfigs[step.id] || {};
            this.stepConfigs[step.id].evaluatePrompt = evalTextarea.value;
            previewCode.textContent = `${evalTextarea.value || "(your prompt)"}\n\nPrevious step output:\n---\n[output of «${this.workflowStepLabel(step)}» appears here]\n---\n\nReply ONLY with YES or NO.`;
          };
        }
      }

      // Connector arrow
      if (!isLast) {
        stepEl.createDiv("auto-oc-workflow-connector");
      }
    }

    // Add step buttons
    const addDiv = container.createDiv("auto-oc-workflow-add-step");
    const selectedTaskIds = this.selectedSteps.map((s) => s.taskId).filter(Boolean) as string[];
    const tasks = this.plugin.settings.tasks.filter(
      (t) => !selectedTaskIds.includes(t.id)
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
            (t) => !prevIds.has(t.id) && !selectedTaskIds.includes(t.id)
          );
          if (newTasks.length > 0) {
            // Add the most recently created task
            const newest = newTasks[newTasks.length - 1];
            this.selectedSteps.push({ id: generateId(), stepKind: "task", taskId: newest.id, area: this.draft.area || newest.area || "", transitions: [], position: { x: 0, y: 0 } });
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
          const task = this.plugin.settings.tasks.find((t) => t.id === sel.value);
          this.selectedSteps.push({ id: generateId(), stepKind: "task", taskId: sel.value, area: this.draft.area || task?.area || "", transitions: [], position: { x: 0, y: 0 } });
          this.renderStepsList(container);
        }
      };
    }

    const btnCode = addDiv.createEl("button", {
      text: "➕ Add Code Step",
      cls: "auto-oc-btn-secondary",
    });
    btnCode.title = "Add a JavaScript code step to this workflow";
    btnCode.onclick = () => {
      this.selectedSteps.push({
        id: generateId(),
        stepKind: "code",
        name: "Code",
        area: this.draft.area || "",
        code: "// input is the previous step's output\n// Set output to the value passed to the next step\noutput = String(input).toUpperCase();",
        codeLang: "javascript",
        codeInputVar: "input",
        codeOutputVar: "output",
        transitions: [],
        position: { x: 0, y: 0 },
      });
      this.renderStepsList(container);
    };

    const btnDelay = addDiv.createEl("button", {
      text: "➕ Add Delay Step",
      cls: "auto-oc-btn-secondary",
    });
    btnDelay.title = "Add a delay step to this workflow";
    btnDelay.onclick = () => {
      this.selectedSteps.push({
        id: generateId(),
        stepKind: "delay",
        name: "Delay",
        area: this.draft.area || "",
        delayValue: 5,
        delayUnit: "minutes",
        transitions: [],
        position: { x: 0, y: 0 },
      });
      this.renderStepsList(container);
    };
  }

  onClose() {
    this.contentEl.empty();
  }
}

// ─── Export / Import Modals ───────────────────────────────────────────────────

class ExportModal extends Modal {
  private plugin: AutoOCPlugin;
  private selectedTaskIds = new Set<string>();
  private selectedWorkflowIds = new Set<string>();
  private name = "";
  private description = "";

  constructor(app: App, plugin: AutoOCPlugin) {
    super(app);
    this.plugin = plugin;
    // Default to selecting everything
    for (const t of plugin.settings.tasks) this.selectedTaskIds.add(t.id);
    for (const w of plugin.settings.workflows) this.selectedWorkflowIds.add(w.id);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("auto-oc-modal");
    setAutoOCModalSize(this, 720);
    preventBackdropClose(this);

    contentEl.createEl("h3", { text: "📤 Export Tasks & Workflows" });
    contentEl.createEl("p", {
      text: "Select the items you want to share. Selected workflows automatically include their referenced tasks so the file remains importable on another machine.",
      cls: "setting-item-description",
    });

    new Setting(contentEl)
      .setName("Export name (optional)")
      .addText((text) => {
        text.setPlaceholder("My tasks").onChange((v) => (this.name = v));
      });

    new Setting(contentEl)
      .setName("Description (optional)")
      .addText((text) => {
        text.setPlaceholder("Shared AutoOC configuration").onChange((v) => (this.description = v));
      });

    // ── Tasks section ──
    contentEl.createDiv("auto-oc-modal-section-title").setText("📋 Tasks");
    const taskActions = contentEl.createDiv("auto-oc-export-actions");
    taskActions.style.display = "flex";
    taskActions.style.gap = "8px";
    taskActions.style.marginBottom = "8px";

    const taskList = contentEl.createDiv("auto-oc-export-list");
    const renderTaskList = () => {
      taskList.empty();
      if (this.plugin.settings.tasks.length === 0) {
        taskList.createEl("p", { text: "No tasks available.", cls: "auto-oc-empty" });
        return;
      }
      for (const task of this.plugin.settings.tasks) {
        const row = taskList.createDiv("auto-oc-export-item");
        const label = row.createEl("label", { cls: "auto-oc-export-label" });
        const cb = label.createEl("input");
        cb.type = "checkbox";
        cb.checked = this.selectedTaskIds.has(task.id);
        cb.onchange = () => {
          if (cb.checked) this.selectedTaskIds.add(task.id);
          else this.selectedTaskIds.delete(task.id);
          updateSummary();
        };
        label.createSpan({ text: ` ${task.name}` });
        label.title = task.prompt.slice(0, 120) + (task.prompt.length > 120 ? "…" : "");
      }
    };
    renderTaskList();

    const addSelectBtn = (parent: HTMLElement, text: string, all: boolean, isTask: boolean) => {
      parent.createEl("button", {
        text,
        cls: "auto-oc-btn-secondary",
      }).onclick = () => {
        const source = isTask ? this.plugin.settings.tasks : this.plugin.settings.workflows;
        for (const item of source) {
          const set = isTask ? this.selectedTaskIds : this.selectedWorkflowIds;
          if (all) set.add(item.id);
          else set.delete(item.id);
        }
        if (isTask) renderTaskList();
        else renderWorkflowList();
        updateSummary();
      };
    };
    addSelectBtn(taskActions, "Select all", true, true);
    addSelectBtn(taskActions, "Deselect all", false, true);

    // ── Workflows section ──
    contentEl.createDiv("auto-oc-modal-section-title").setText("🔗 Workflows");
    const wfActions = contentEl.createDiv("auto-oc-export-actions");
    wfActions.style.display = "flex";
    wfActions.style.gap = "8px";
    wfActions.style.marginBottom = "8px";

    const workflowList = contentEl.createDiv("auto-oc-export-list");
    const renderWorkflowList = () => {
      workflowList.empty();
      if (this.plugin.settings.workflows.length === 0) {
        workflowList.createEl("p", { text: "No workflows available.", cls: "auto-oc-empty" });
        return;
      }
      for (const wf of this.plugin.settings.workflows) {
        const row = workflowList.createDiv("auto-oc-export-item");
        const label = row.createEl("label", { cls: "auto-oc-export-label" });
        const cb = label.createEl("input");
        cb.type = "checkbox";
        cb.checked = this.selectedWorkflowIds.has(wf.id);
        cb.onchange = () => {
          if (cb.checked) this.selectedWorkflowIds.add(wf.id);
          else this.selectedWorkflowIds.delete(wf.id);
          updateSummary();
        };
        label.createSpan({ text: ` ${wf.name}` });
        const stepNames = wf.steps
          .map((s) => {
            if (s.stepKind === "code") return "{ } Code";
            if (s.stepKind === "delay") return `⏱ ${s.delayValue ?? 5} ${s.delayUnit ?? "minutes"}`;
            return this.plugin.settings.tasks.find((t) => t.id === s.taskId)?.name ?? "?";
          })
          .join(" → ");
        label.title = wf.description
          ? `${wf.description}\n${stepNames}`
          : stepNames;
      }
    };
    renderWorkflowList();

    addSelectBtn(wfActions, "Select all", true, false);
    addSelectBtn(wfActions, "Deselect all", false, false);

    // ── Summary & save ──
    const summary = contentEl.createDiv("auto-oc-export-summary");
    summary.style.marginTop = "16px";
    summary.style.fontSize = "0.85rem";
    summary.style.color = "var(--text-muted)";
    const updateSummary = () => {
      const payload = this.plugin.buildExportSelectionPayload(
        this.selectedTaskIds,
        this.selectedWorkflowIds
      );
      const explicitTasks = this.plugin.settings.tasks.filter((t) =>
        this.selectedTaskIds.has(t.id)
      ).length;
      const autoTasks = payload.tasks.length - explicitTasks;
      summary.textContent =
        `Will export ${explicitTasks} selected task(s)` +
        (autoTasks > 0 ? ` + ${autoTasks} task(s) required by workflows` : "") +
        ` and ${payload.workflows.length} selected workflow(s).`;
    };
    updateSummary();

    const btnRow = contentEl.createDiv("auto-oc-export-actions");
    btnRow.style.display = "flex";
    btnRow.style.gap = "8px";
    btnRow.style.marginTop = "12px";

    const getPayload = () =>
      this.plugin.buildExportSelectionPayload(
        this.selectedTaskIds,
        this.selectedWorkflowIds
      );

    const btnCopy = btnRow.createEl("button", {
      text: "📋 Copy JSON",
      cls: "auto-oc-btn-secondary",
    });
    btnCopy.onclick = async () => {
      const payload = getPayload();
      if (payload.tasks.length === 0 && payload.workflows.length === 0) {
        new Notice("AutoOC: nothing selected to export.");
        return;
      }
      const json = this.plugin.buildExportJson(
        payload.tasks,
        payload.workflows,
        this.name,
        this.description
      );
      try {
        await navigator.clipboard.writeText(json);
        new Notice("AutoOC: JSON copied to clipboard.");
      } catch (e) {
        new Notice(`AutoOC: could not copy — ${String(e)}`);
      }
    };

    const btnSave = btnRow.createEl("button", {
      text: "💾 Save JSON…",
      cls: "auto-oc-btn-primary",
    });
    btnSave.onclick = async () => {
      const payload = getPayload();
      if (payload.tasks.length === 0 && payload.workflows.length === 0) {
        new Notice("AutoOC: nothing selected to export.");
        return;
      }
      await this.plugin.exportToFile(
        payload.tasks,
        payload.workflows,
        this.name,
        this.description
      );
      this.close();
    };
  }

  onClose() {
    this.contentEl.empty();
  }
}

class ImportModal extends Modal {
  private plugin: AutoOCPlugin;
  private filePath: string | null = null;
  private previewData: AutoOCExportFile | null = null;
  private previewEl: HTMLElement | null = null;
  private sourceMode: "file" | "library" | "paste" = "file";
  private libraryEntries: LibraryEntry[] = [];
  private libraryError: string | null = null;
  private selectedLibraryFile: string | null = null;
  private pastedJson = "";
  // Last validation result (errors + warnings). Rendered in the
  // preview so the user can see exactly what's wrong with the file.
  private lastValidation: { ok: boolean; errors: string[]; warnings: string[] } | null = null;

  constructor(app: App, plugin: AutoOCPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("auto-oc-modal");
    setAutoOCModalSize(this, 720);
    preventBackdropClose(this);

    contentEl.createEl("h3", { text: "📥 Import Tasks & Workflows" });
    contentEl.createEl("p", {
      text: "Import from a local JSON file, paste JSON directly, or browse the shared library configured in settings. Imported items use this system's default model and agent when the saved agent is unavailable. Duplicate names are renamed automatically.",
      cls: "setting-item-description",
    });

    // ── Source tabs ──
    const tabBar = contentEl.createDiv("auto-oc-tab-bar");
    const btnFile = tabBar.createEl("button", {
      text: "📁 From file",
      cls: "auto-oc-tab-btn",
    });
    const btnPaste = tabBar.createEl("button", {
      text: "📋 Paste JSON",
      cls: "auto-oc-tab-btn",
    });
    const btnLibrary = tabBar.createEl("button", {
      text: "🌐 Browse library",
      cls: "auto-oc-tab-btn",
    });

    const panel = contentEl.createDiv("auto-oc-import-panel");

    const renderPanel = () => {
      btnFile.toggleClass("active", this.sourceMode === "file");
      btnPaste.toggleClass("active", this.sourceMode === "paste");
      btnLibrary.toggleClass("active", this.sourceMode === "library");
      panel.empty();
      if (this.sourceMode === "file") {
        this.renderFilePanel(panel);
      } else if (this.sourceMode === "paste") {
        this.renderPastePanel(panel);
      } else {
        this.renderLibraryPanel(panel);
      }
    };

    btnFile.onclick = () => { this.sourceMode = "file"; renderPanel(); };
    btnPaste.onclick = () => { this.sourceMode = "paste"; renderPanel(); };
    btnLibrary.onclick = () => { this.sourceMode = "library"; renderPanel(); };

    // Common preview area
    this.previewEl = contentEl.createDiv("auto-oc-import-preview");
    this.previewEl.style.marginTop = "16px";

    // Import actions
    const btnRow = contentEl.createDiv("auto-oc-import-actions");
    btnRow.style.display = "flex";
    btnRow.style.gap = "8px";
    btnRow.style.marginTop = "16px";

    const btnImport = btnRow.createEl("button", {
      text: "Import",
      cls: "auto-oc-btn-primary",
    });
    btnImport.disabled = !this.previewData;
    btnImport.onclick = async () => {
      if (!this.previewData) return;
      btnImport.disabled = true;
      btnImport.textContent = "Importing…";
      try {
        const result = await this.plugin.importFromData(this.previewData);
        new Notice(
          `AutoOC: imported ${result.tasksImported} task(s) and ${result.workflowsImported} workflow(s).`
        );
        this.close();
      } catch (e) {
        new Notice(`AutoOC: import failed — ${String(e)}`);
        btnImport.disabled = false;
        btnImport.textContent = "Import";
      }
    };

    const btnCancel = btnRow.createEl("button", {
      text: "Cancel",
      cls: "auto-oc-btn-secondary",
    });
    btnCancel.onclick = () => this.close();

    (this as any)._importBtn = btnImport;
    renderPanel();
    this.renderPreview();
  }

  private renderFilePanel(panel: HTMLElement) {
    new Setting(panel)
      .setName("JSON file")
      .setDesc("Choose an AutoOC export file")
      .addButton((btn) =>
        btn.setButtonText("Choose file…").onClick(async () => {
          const chosen = await this.chooseFile();
          if (chosen) {
            this.filePath = chosen;
            this.selectedLibraryFile = null;
            await this.loadFilePreview();
          }
        })
      )
      .addText((text) => {
        text.setDisabled(true);
        text.inputEl.addClass("auto-oc-modal-input");
        text.setValue(this.filePath ?? "");
      });
  }

  private renderPastePanel(panel: HTMLElement) {
    panel.createEl("p", {
      text: "Paste an AutoOC JSON export below. The preview will update automatically when the JSON is valid.",
      cls: "setting-item-description",
    });

    const textarea = panel.createEl("textarea", {
      cls: "auto-oc-modal-textarea auto-oc-import-paste",
    });
    textarea.value = this.pastedJson;
    textarea.rows = 12;
    textarea.spellcheck = false;
    textarea.placeholder = '{\n  "autoOCExport": { ... },\n  "tasks": [ ... ],\n  "workflows": [ ... ]\n}';
    textarea.style.width = "100%";
    textarea.style.fontFamily = "var(--font-monospace)";
    textarea.style.fontSize = "0.8rem";

    const parse = () => {
      this.pastedJson = textarea.value.trim();
      if (!this.pastedJson) {
        this.previewData = null;
        this.renderPreview();
        this.updateImportButton();
        return;
      }
      try {
        const data = JSON.parse(this.pastedJson);
        const result = this.validateExport(data);
        this.lastValidation = result;
        if (!result.ok) {
          this.previewData = null;
          new Notice(`AutoOC: pasted JSON has ${result.errors.length} error(s) — see the preview panel.`, 8000);
        } else {
          this.previewData = data;
          this.filePath = null;
          this.selectedLibraryFile = null;
          if (result.warnings.length > 0) {
            new Notice(`AutoOC: parsed ${data.tasks?.length ?? 0} task(s), ${data.workflows?.length ?? 0} workflow(s) with ${result.warnings.length} warning(s).`, 6000);
          } else {
            new Notice(`AutoOC: parsed ${data.tasks?.length ?? 0} task(s), ${data.workflows?.length ?? 0} workflow(s).`);
          }
        }
      } catch (e) {
        this.previewData = null;
        this.lastValidation = { ok: false, errors: [`Could not parse JSON: ${String(e)}`], warnings: [] };
        new Notice(`AutoOC: could not parse JSON — ${String(e)}`, 8000);
      }
      this.renderPreview();
      this.updateImportButton();
    };

    textarea.oninput = parse;

    const actions = panel.createDiv("auto-oc-import-paste-actions");
    actions.style.display = "flex";
    actions.style.gap = "8px";
    actions.style.marginTop = "8px";

    const btnClear = actions.createEl("button", {
      text: "Clear",
      cls: "auto-oc-btn-secondary",
    });
    btnClear.onclick = () => {
      textarea.value = "";
      this.pastedJson = "";
      this.previewData = null;
      this.renderPreview();
      this.updateImportButton();
    };

    const btnFormat = actions.createEl("button", {
      text: "Format JSON",
      cls: "auto-oc-btn-secondary",
    });
    btnFormat.onclick = () => {
      try {
        const parsed = JSON.parse(textarea.value);
        const formatted = JSON.stringify(parsed, null, 2);
        textarea.value = formatted;
        this.pastedJson = formatted;
        parse();
      } catch (e) {
        new Notice(`AutoOC: cannot format — ${String(e)}`);
      }
    };
  }

  private renderLibraryPanel(panel: HTMLElement) {
    panel.empty();

    const loadRow = panel.createDiv("auto-oc-import-library-load");
    loadRow.style.display = "flex";
    loadRow.style.gap = "8px";
    loadRow.style.marginBottom = "12px";

    const resolvedUrl = normalizeLibraryUrl(this.plugin.settings.libraryUrl);
    const btnLoad = loadRow.createEl("button", {
      text: "🔄 Load library",
      cls: "auto-oc-btn-secondary",
    });
    btnLoad.title = `Source: ${resolvedUrl}`;
    btnLoad.onclick = async () => {
      btnLoad.disabled = true;
      btnLoad.textContent = "Loading…";
      await this.loadLibraryIndex();
      this.renderLibraryPanel(panel);
    };

    const listContainer = panel.createDiv("auto-oc-import-library-list");
    if (this.libraryError) {
      listContainer.createEl("p", {
        text: `Could not load library: ${this.libraryError}`,
        cls: "auto-oc-empty",
      });
      return;
    }
    if (this.libraryEntries.length === 0) {
      listContainer.createEl("p", {
        text: "No library entries loaded yet. Click Load library.",
        cls: "auto-oc-empty",
      });
      return;
    }

    listContainer.createEl("p", {
      text: `${this.libraryEntries.length} item(s) available:`,
      cls: "setting-item-description",
    });

    for (const entry of this.libraryEntries) {
      const row = listContainer.createDiv("auto-oc-import-library-item");
      row.style.padding = "6px 0";
      const isSelected = this.selectedLibraryFile === entry.file;
      const btn = row.createEl("button", {
        text: isSelected ? "✓ " + entry.name : entry.name,
        cls: isSelected ? "auto-oc-btn-primary" : "auto-oc-btn-secondary",
      });
      btn.style.width = "100%";
      btn.style.textAlign = "left";
      btn.title = entry.description ?? entry.file;
      btn.onclick = async () => {
        this.selectedLibraryFile = entry.file;
        await this.loadLibraryFile(entry.file);
        this.renderLibraryPanel(panel);
      };
      if (entry.description) {
        row.createEl("div", {
          text: entry.description,
          cls: "setting-item-description",
        });
      }
    }
  }

  private async chooseFile(): Promise<string | null> {
    try {
      // @ts-ignore — Electron API available on desktop Obsidian
      const electron = window.require("electron");
      const result = await electron.remote.dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [{ name: "JSON files", extensions: ["json"] }],
        title: "Import AutoOC tasks and workflows",
      });
      if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
      }
    } catch (e) {
      new Notice(`AutoOC: file picker failed — ${String(e)}`);
    }
    return null;
  }

  private async loadFilePreview() {
    if (!this.filePath) return;
    try {
      const raw = fs.readFileSync(this.filePath, "utf8");
      const data = JSON.parse(raw) as AutoOCExportFile;
      this.validateExport(data);
      const result = this.validateExport(data);
      this.lastValidation = result;
      if (!result.ok) {
        this.previewData = null;
        new Notice(`AutoOC: file has ${result.errors.length} error(s) — see the preview panel.`, 8000);
      } else {
        this.previewData = data;
        if (result.warnings.length > 0) {
          new Notice(`AutoOC: loaded ${data.tasks?.length ?? 0} task(s), ${data.workflows?.length ?? 0} workflow(s) with ${result.warnings.length} warning(s).`, 6000);
        } else {
          new Notice(`AutoOC: loaded ${data.tasks?.length ?? 0} task(s), ${data.workflows?.length ?? 0} workflow(s).`);
        }
      }
    } catch (e) {
      this.previewData = null;
      new Notice(`AutoOC: could not read file — ${String(e)}`, 8000);
    }
    this.renderPreview();
    this.updateImportButton();
  }

  private async loadLibraryIndex() {
    this.libraryError = null;
    this.libraryEntries = [];
    try {
      const url = noCacheUrl(getLibraryIndexUrl(this.plugin.settings.libraryUrl));
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as LibraryIndex;
      if (!data.library || !Array.isArray(data.library)) {
        throw new Error("Invalid library index.");
      }
      this.libraryEntries = data.library;
    } catch (e) {
      this.libraryError = String(e);
      new Notice(`AutoOC: library load failed — ${String(e)}`);
    }
  }

  private async loadLibraryFile(fileName: string) {
    try {
      const url = noCacheUrl(getLibraryFileUrl(this.plugin.settings.libraryUrl, fileName));
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json());
      const result = this.validateExport(data);
      this.lastValidation = result;
      if (!result.ok) {
        this.previewData = null;
        new Notice(`AutoOC: "${fileName}" has ${result.errors.length} error(s) — see the preview panel.`, 8000);
      } else {
        this.previewData = data;
        if (result.warnings.length > 0) {
          new Notice(`AutoOC: loaded "${fileName}" — ${data.tasks?.length ?? 0} task(s), ${data.workflows?.length ?? 0} workflow(s) with ${result.warnings.length} warning(s).`, 6000);
        } else {
          new Notice(`AutoOC: loaded "${fileName}" — ${data.tasks?.length ?? 0} task(s), ${data.workflows?.length ?? 0} workflow(s).`);
        }
      }
    } catch (e) {
      this.previewData = null;
      new Notice(`AutoOC: could not load file — ${String(e)}`, 8000);
    }
    this.renderPreview();
    this.updateImportButton();
  }

  // Validate an imported JSON. Collects ALL issues before throwing so
  // the user gets a complete diagnostic in one Notice instead of
  // fixing one error at a time. The shape and rules mirror what
  // `importFromData` expects.
  private validateExport(data: any): { ok: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data || typeof data !== "object") {
      return { ok: false, errors: ["The file is not a JSON object."], warnings: [] };
    }
    if (!data.autoOCExport || typeof data.autoOCExport !== "object") {
      return { ok: false, errors: ["Missing `autoOCExport` header at the root of the JSON."], warnings: [] };
    }
    const sv = data.autoOCExport.schemaVersion;
    const SUPPORTED = ["1.0", "1.4.0"];
    if (!sv) {
      errors.push("`autoOCExport.schemaVersion` is missing. Expected one of: " + SUPPORTED.join(", "));
    } else if (!SUPPORTED.includes(sv)) {
      errors.push("Unsupported `schemaVersion`: \"" + sv + "\". Expected one of: " + SUPPORTED.join(", "));
    }
    if (!Array.isArray(data.tasks)) {
      errors.push("`tasks` must be an array (can be empty).");
    }
    if (!Array.isArray(data.workflows)) {
      errors.push("`workflows` must be an array (can be empty).");
    }

    // Validate tasks
    const taskExportIds = new Set<string>();
    if (Array.isArray(data.tasks)) {
      const seenNames = new Set<string>();
      data.tasks.forEach((t: any, i: number) => {
        const where = "task[" + i + "]";
        if (!t || typeof t !== "object") { errors.push(where + " is not an object."); return; }
        if (typeof t.exportId !== "string" || !t.exportId.trim()) {
          errors.push(where + ".exportId is missing or empty.");
        } else {
          if (taskExportIds.has(t.exportId)) {
            errors.push(where + ".exportId \"" + t.exportId + "\" is duplicated.");
          }
          taskExportIds.add(t.exportId);
        }
        if (typeof t.name !== "string" || !t.name.trim()) {
          errors.push(where + ".name is missing or empty.");
        } else if (seenNames.has(t.name)) {
          warnings.push(where + ".name \"" + t.name + "\" is duplicated; imports will rename automatically.");
        } else {
          seenNames.add(t.name);
        }
        if (typeof t.prompt !== "string" || !t.prompt.trim()) {
          errors.push(where + ".prompt is missing or empty.");
        }
        const validSchedules = ["manual", "once", "daily", "weekly", "monthly", "interval"];
        if (t.scheduleType && !validSchedules.includes(t.scheduleType)) {
          errors.push(where + ".scheduleType \"" + t.scheduleType + "\" is invalid. Expected: " + validSchedules.join(", "));
        }
        if (t.scheduleType === "once" && (!t.scheduleDate || !/^\d{4}-\d{2}-\d{2}$/.test(t.scheduleDate))) {
          warnings.push(where + ": scheduleType is 'once' but scheduleDate is empty or not YYYY-MM-DD.");
        }
        if (t.scheduleType === "weekly" && (!Array.isArray(t.scheduleDays) || t.scheduleDays.length === 0)) {
          warnings.push(where + ": scheduleType is 'weekly' but scheduleDays is empty.");
        }
        if (Array.isArray(t.scheduleDays)) {
          t.scheduleDays.forEach((d: any) => {
            if (typeof d !== "number" || d < 0 || d > 6) {
              errors.push(where + ".scheduleDays contains an invalid value: " + JSON.stringify(d) + " (must be 0-6).");
            }
          });
        }
        if (Array.isArray(t.scheduleMonthDays)) {
          t.scheduleMonthDays.forEach((d: any) => {
            if (typeof d !== "number" || d < 1 || d > 31) {
              errors.push(where + ".scheduleMonthDays contains an invalid value: " + JSON.stringify(d) + " (must be 1-31).");
            }
          });
        }
      });
    }

    // Validate workflows. We do this in two passes:
    //   1. Collect all step ids so transitions can resolve them
    //   2. Validate each step's structure and its transitions
    // Doing it in one pass would incorrectly flag forward references
    // (step N's transition to step N+1) as broken.
    if (Array.isArray(data.workflows)) {
      data.workflows.forEach((w: any, wi: number) => {
        const wwhere = "workflow[" + wi + "]";
        if (!w || typeof w !== "object") { errors.push(wwhere + " is not an object."); return; }
        if (typeof w.name !== "string" || !w.name.trim()) {
          errors.push(wwhere + ".name is missing or empty.");
        }
        if (!Array.isArray(w.steps)) {
          errors.push(wwhere + ".steps must be an array.");
          return;
        }
        const steps = w.steps as any[];

        // Pass 1: collect step ids and report duplicates / missing ids.
        const stepIds = new Set<string>();
        steps.forEach((s: any, i: number) => {
          const swhere = wwhere + ".steps[" + i + "]";
          if (!s || typeof s !== "object") { return; }
          if (typeof s.id !== "string" || !s.id.trim()) {
            errors.push(swhere + ".id is missing or empty.");
          } else {
            if (stepIds.has(s.id)) {
              errors.push(swhere + ".id \"" + s.id + "\" is duplicated within the workflow.");
            }
            stepIds.add(s.id);
          }
        });

        // Pass 2: validate each step's structure and its transitions.
        steps.forEach((s: any, i: number) => {
          const swhere = wwhere + ".steps[" + i + "]";
          if (!s || typeof s !== "object") { return; }
          const kind = s.stepKind || "task";
          if (!["task", "delay", "code"].includes(kind)) {
            errors.push(swhere + ".stepKind \"" + kind + "\" is invalid. Expected: task, delay, or code.");
          }
          if (kind === "task") {
            if (typeof s.taskExportId !== "string" || !s.taskExportId.trim()) {
              errors.push(swhere + " (task) is missing taskExportId.");
            } else if (!taskExportIds.has(s.taskExportId)) {
              errors.push(swhere + " (task) references taskExportId \"" + s.taskExportId + "\" which is not defined in `tasks`.");
            }
          }
          if (kind === "delay") {
            if (typeof s.delayValue !== "number" || s.delayValue < 0) {
              errors.push(swhere + " (delay) is missing or has an invalid delayValue (must be a non-negative number).");
            }
            if (s.delayUnit && !["seconds", "minutes", "hours"].includes(s.delayUnit)) {
              errors.push(swhere + ".delayUnit \"" + s.delayUnit + "\" is invalid. Expected: seconds, minutes, hours.");
            }
          }
          if (kind === "code") {
            if (typeof s.code !== "string" || !s.code.trim()) {
              errors.push(swhere + " (code) is missing the `code` field.");
            }
            if (s.codeLang && s.codeLang !== "javascript") {
              warnings.push(swhere + ".codeLang is \"" + s.codeLang + "\"; only 'javascript' is currently supported.");
            }
          }
          if (s.transitions !== undefined && !Array.isArray(s.transitions)) {
            errors.push(swhere + ".transitions must be an array.");
          }
          if (Array.isArray(s.transitions)) {
            const validModes = ["default", "force", "eval", "conditional"];
            s.transitions.forEach((t: any, ti: number) => {
              const twhere = swhere + ".transitions[" + ti + "]";
              if (!t || typeof t !== "object") { errors.push(twhere + " is not an object."); return; }
              if (typeof t.toStepId !== "string" || !t.toStepId.trim()) {
                errors.push(twhere + ".toStepId is missing.");
              } else if (!stepIds.has(t.toStepId)) {
                errors.push(twhere + ".toStepId \"" + t.toStepId + "\" references a step that doesn't exist in this workflow.");
              }
              if (t.mode && !validModes.includes(t.mode)) {
                errors.push(twhere + ".mode \"" + t.mode + "\" is invalid. Expected: " + validModes.join(", "));
              }
              if (t.mode === "eval" && (typeof t.evaluatePrompt !== "string" || !t.evaluatePrompt.trim())) {
                errors.push(twhere + " (eval) is missing evaluatePrompt.");
              }
              if (t.mode === "conditional" && (typeof t.condition !== "string" || !t.condition.trim())) {
                errors.push(twhere + " (conditional) is missing the `condition` expression.");
              }
            });
          }
        });
        // Entry step check: at least one step must have no incoming transitions.
        const incoming = new Set<string>();
        steps.forEach((s: any) => {
          (s.transitions || []).forEach((t: any) => incoming.add(t.toStepId));
        });
        const entryCandidates = steps.filter((s: any) => s.id && !incoming.has(s.id));
        if (steps.length > 0 && entryCandidates.length === 0) {
          errors.push(wwhere + " has no entry step (every step is the target of a transition).");
        }
      });
    }

    return { ok: errors.length === 0, errors, warnings };
  }

  private updateImportButton() {
    const btnImport = (this as any)._importBtn as HTMLButtonElement | undefined;
    if (btnImport) {
      btnImport.disabled = !this.previewData;
      btnImport.textContent = "Import";
    }
  }

  private renderPreview() {
    if (!this.previewEl) return;
    this.previewEl.empty();

    // If the last validation produced errors, show them — the user
    // will see exactly why the import is blocked and where to fix it.
    if (this.lastValidation && this.lastValidation.errors.length > 0 && !this.previewData) {
      const errBox = this.previewEl.createDiv("auto-oc-import-errors");
      errBox.style.background = "rgba(224, 108, 117, 0.12)";
      errBox.style.border = "1px solid var(--background-modifier-error, #e06c75)";
      errBox.style.padding = "10px 12px";
      errBox.style.borderRadius = "6px";
      errBox.style.color = "var(--text-error, #e06c75)";
      const title = errBox.createEl("div", { text: `❌ ${this.lastValidation.errors.length} error(s) found — fix them before importing` });
      title.style.fontWeight = "600";
      title.style.marginBottom = "6px";
      const list = errBox.createEl("ul", { cls: "auto-oc-import-error-list" });
      list.style.margin = "0";
      list.style.paddingLeft = "20px";
      this.lastValidation.errors.forEach((msg) => {
        list.createEl("li", { text: msg });
      });
    }

    if (!this.previewData) {
      if (!this.lastValidation || this.lastValidation.errors.length === 0) {
        this.previewEl.createEl("p", {
          text: "No valid export loaded yet.",
          cls: "auto-oc-empty",
        });
      }
      return;
    }

    const box = this.previewEl.createDiv("auto-oc-import-preview-box");
    box.style.background = "var(--background-secondary)";
    box.style.padding = "12px";
    box.style.borderRadius = "6px";

    const meta = this.previewData.autoOCExport;
    if (meta.name) {
      box.createEl("div", { text: `Name: ${meta.name}`, cls: "setting-item-description" });
    }
    if (meta.description) {
      box.createEl("div", { text: meta.description, cls: "setting-item-description" });
    }
    box.createEl("div", {
      text: `Exported: ${formatDateTime(meta.exportedAt)} · Schema: ${meta.schemaVersion}`,
      cls: "setting-item-description",
    });

    const counts = box.createEl("ul", { cls: "auto-oc-import-counts" });
    counts.style.marginTop = "8px";
    counts.style.marginBottom = "0";
    counts.createEl("li", { text: `${this.previewData.tasks?.length ?? 0} task(s)` });
    counts.createEl("li", { text: `${this.previewData.workflows?.length ?? 0} workflow(s)` });

    // Warnings (non-blocking)
    if (this.lastValidation && this.lastValidation.warnings.length > 0) {
      const warnBox = box.createDiv("auto-oc-import-warnings");
      warnBox.style.marginTop = "10px";
      warnBox.style.padding = "8px 10px";
      warnBox.style.background = "rgba(216, 166, 87, 0.10)";
      warnBox.style.border = "1px solid rgba(216, 166, 87, 0.4)";
      warnBox.style.borderRadius = "6px";
      warnBox.style.color = "var(--text-warning, #d8a657)";
      warnBox.createEl("div", {
        text: `⚠ ${this.lastValidation.warnings.length} warning(s)`,
        attr: { style: "font-weight:600;margin-bottom:4px" },
      });
      const wlist = warnBox.createEl("ul", { cls: "auto-oc-import-warn-list" });
      wlist.style.margin = "0";
      wlist.style.paddingLeft = "20px";
      this.lastValidation.warnings.forEach((msg) => {
        wlist.createEl("li", { text: msg });
      });
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
        `Status: ${latest.status}` +
        (latest.lastRun ? `  |  Started: ${formatDateTime(latest.lastRun)}` : "") +
        (isRunning ? "  ⏳" : "");
      this.statusEl.className =
        "auto-oc-log-status auto-oc-badge-" + latest.status;
    }

    if (this.renderEl) {
      const newContent = latest.output || "(no output yet…)";
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

class TextPreviewModal extends Modal {
  constructor(app: App, private titleText: string, private bodyText: string) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: this.titleText });
    const pre = contentEl.createEl("pre", { cls: "auto-oc-output-pre" });
    pre.textContent = this.bodyText || "(empty)";
    new Setting(contentEl).addButton((btn) =>
      btn.setButtonText("Copy").onClick(() => {
        navigator.clipboard.writeText(this.bodyText || "");
        new Notice("Output copied.");
      })
    );
  }

  onClose() {
    this.contentEl.empty();
  }
}

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
      openOpencodeCli(bin, cwd, this.plugin.getSecretsEnv());
      new Notice(`AutoOC: opened OpenCode CLI in ${cwd}`);
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
          ...psUtf8Prelude(),
          `$env:USERPROFILE = '${process.env.USERPROFILE}'`,
          `$env:APPDATA     = '${process.env.APPDATA}'`,
          `$env:LOCALAPPDATA= '${process.env.LOCALAPPDATA}'`,
          `$env:PATH        = '${process.env.PATH}'`,
          `$env:HOME        = '${process.env.USERPROFILE}'`,
          `$outTmp = [System.IO.Path]::GetTempFileName()`,
          `$errTmp = [System.IO.Path]::GetTempFileName()`,
          `$bin = ${psSingleQuoted(bin)}`,
          `$argList = @('run','-m',${psSingleQuoted(model)},'--dangerously-skip-permissions','--','di hola')`,
          `& $bin @argList > $outTmp 2> $errTmp`,
          `$exitCode = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 }`,
          `$out = (Get-Content $outTmp -Raw -Encoding UTF8 -ErrorAction SilentlyContinue).Trim()`,
          `Remove-Item $outTmp,$errTmp -ErrorAction SilentlyContinue`,
          `[System.IO.File]::WriteAllText('${outFile.replace(/'/g, "''")}', $out + "\nDONE:" + $exitCode)`,
        ].join("\n");

        const psFile = path.join(osTmp, "autooc-diag.ps1");
        writeUtf8BomFile(psFile, psScript);
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
            this.logEl.textContent = normalized || "(no output)";
            this.logEl.textContent += exitCode === 0 ? "\n\n[\u2705 completed]" : `\n\n[\u274c code ${exitCode}]`;
          }
        }, 2000);
      })
    );

    this.logEl = contentEl.createEl("pre", { cls: "auto-oc-output-pre auto-oc-log-pre" });
    this.logEl.textContent = "(output will appear here…)";
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
          .setPlaceholder("C:\\path\\to\\your\\project")
          .setValue(this.plugin.settings.workingDirectory)
          .onChange(async (v) => {
            this.plugin.settings.workingDirectory = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Default CLI task mode")
      .setDesc("New OpenCode tasks open an interactive terminal by default.")
      .addToggle((tog) =>
        tog
          .setValue(!!this.plugin.settings.defaultInteractiveTerminal)
          .onChange(async (v) => {
            this.plugin.settings.defaultInteractiveTerminal = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Shared Library URL")
      .setDesc(
        `GitHub repo or raw URL used by the Import → Browse Library feature. GitHub URLs like https://github.com/user/repo are converted automatically.\nResolved: ${normalizeLibraryUrl(this.plugin.settings.libraryUrl)}`
      )
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.libraryUrl)
          .setValue(this.plugin.settings.libraryUrl)
          .onChange(async (v) => {
            this.plugin.settings.libraryUrl = v.trim();
            await this.plugin.saveSettings();
            this.display();
          })
      );

    new Setting(containerEl)
      .setName("Task Timeout (seconds)")
      .setDesc("Soft warning time. If OpenCode exceeds this time, AutoOC warns but keeps waiting for the final result. Default 7200 s (2 h). Use 0 to disable timeout warnings.")
      .addText((text) =>
        text
          .setPlaceholder(String(DEFAULT_TASK_TIMEOUT_SECONDS))
          .setValue(String(this.plugin.settings.taskTimeoutSeconds ?? DEFAULT_TASK_TIMEOUT_SECONDS))
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
