import { AreaDashboard, createAreaDashboardState, dashboardItems, type DashboardItem } from "./dashboard-areas";
import { setupCodeTextarea, renderCodePreview } from "./code-editor";
import { loadDashboardBubbleDiameter, saveDashboardBubbleDiameter, applyDashboardBubbleDiameter, addDashboardBubbleSizeSetting } from "./dashboard-bubble-settings";
import { taskDisabledReason, workflowDisabledReason, assertWorkflowEnabled, validateDisabled } from "./catalog-availability";
import { addInteractiveCliSettings, openCliLauncher } from "./interactive-cli-ui";
import type { InteractiveCliProvider } from "./interactive-cli";
import type {ExecutionPresentation} from "./execution-presentation";
import { workflowCodeEntries, matchesWorkflowCodeEntry, type WorkflowCodeEntry } from "./workflow-code-entries";
import { applyBulkCatalogAction, captureBulkSelection, type BulkAction, type BulkSelection, type CatalogKind } from "./catalog-bulk";
import { BulkCatalogModal } from "./catalog-bulk-modal";
import { AiDraftModal } from "./ai-draft-modal";
import { generateDraftText } from "./ai-draft-runner";
import { saveGeneratedDefinition, type DraftKind, type GeneratedDraft } from "./ai-draft";
import { executionStatusHelp, ExecutionStatusHelpModal, HistoricalAttemptsModal, type ExecutionHelpSnapshot } from "./execution-status-help";
import { catalogTransaction, type CatalogTransaction } from "./catalog-transaction";
import { inspectBlockedExecutions, assertBlockedInspection, resetBlockedAttempt, type BlockedExecutionInspection, type BlockedAttempt } from "./blocked-execution-recovery";
import { BlockedExecutionModal } from "./blocked-execution-modal";
import { validateConcurrency, type ConcurrencyPolicy } from "./execution-coordinator";
import { assertNoRetiredDependency, assertWorkflowDependencies, autoOCDependencyError } from "./retired-dependency";
import { LegacyOutputRedaction } from "./legacy-output-redaction";
import { LegacyCredentialNoticeModal } from "./legacy-credential-notice";
import { samePhysicalPath } from "./path-identity";
import {recoverInterruptedSettingsWrite} from "./settings-write-recovery";
import {createPluginRequestHost} from "./cli-plugin-requests";
import {applyWorkflowEdit} from "./workflow-edit";
import { buildOpenCodeScript } from "./opencode-script";
import { isOpenCodeTask, openCodeRunArgs, openCodeInteractiveArgs } from "./opencode-profile";
import { assertOpenCode2 } from "./opencode-version";
import { createOpenCodeWorkflowAdapter } from "./cli-workflow-adapters";
import { downloadRelease, installRelease, hasCompleteInstalledRelease, hasCompleteInstalledReleaseAsync } from "./release-update";
import { assertPackageMaintenanceSafe } from "./package-maintenance";
import { readPanelCatalog, type PanelCatalog } from "./panel-catalog";
import { assertInstalledExecutionIdle, assertIdleCatalog, assertIdleJournals, waitForInstalledCatalog } from "./execution-idle";
const PLUGIN_BUILD_VERSION: string = require("./manifest.json").version;
// Survives CommonJS bundle reloads in the same Obsidian renderer. Only the
// original stopped instance can relinquish its own reservation after rechecking
// inactivity; a PID match alone never authorizes recovery.
const stoppedLeaseOwners: Map<string, (runtime: string, maintenance?: boolean) => void> = (() => {
  const key = Symbol.for('autooc.stoppedLeaseOwners.v1');
  if (!(globalThis as any)[key]) (globalThis as any)[key] = new Map();
  return (globalThis as any)[key];
})();
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
import * as http from "http";
import {
  CodexAppServerClient,
  type CodexApprovalRequest,
  type CodexModelOption,
  openCodexApp,
  resolveCodexBin,
} from "./codex-client";
import { CopilotCliClient, checkCopilotInstallation, resolveCopilotBin } from "./copilot-client";
import { workflowTaskPrompt } from "./workflow-handoff";
import { executeCodexTask } from "./codex-execution";
import { executeCode } from "./code-runtime";
import { executeCodeTask } from "./code-task";
import { runWithVaultMutations } from "./code-vault-mutations";
import { ObsidianVaultRefresh } from "./obsidian-vault-refresh";
import { EXECUTION_DEFAULTS } from "./execution-defaults";
import { acquireExecutionLease, readExecutionLeaseOwner, recoverExecutionLease, type ExecutionLease } from "./execution-lease";
import { runInstalledWorkflow } from "./installed-workflow-host";
import { resolveInstalledWorkflowLocation, ensureInstalledWorkflowRuntime, type InstalledWorkflowLocation } from "./installed-workflow-location";
import { answerWorkflowApproval } from "./workflow-approval";
import { standaloneTaskWorkflow,projectStandaloneTask,recoverStandaloneTaskAsync } from "./standalone-task";
import { prepareWorkflowDefinition } from "./workflow-definition";
import { supportsSharedWorkflow, type WorkflowTaskOutput } from "./code-workflow-host";
import { createWorkflowTaskAdapter } from "./workflow-task-adapters";
import { projectWorkflowProgress, recoverWorkflowProgress, recoverWorkflowProgressAsync, validateProgressBinding } from "./workflow-progress";
import { selectCodeStep, projectCodeStepRun, codeStepDisplay, readCodeStepCheckpoint } from "./workflow-code-step";
import { CodeStepLogModal, CodeStepHistoryModal } from "./workflow-code-modals";
import { taskElapsedSeconds } from "./task-history";
import { readExecutionCheckpoint, checkpointUncertainties, type RunCheckpoint } from "./execution-journal";
import { abandonInstalledExecution, inspectTerminalExecution, disposeTerminalExecution } from "./execution-abandonment";
import { inspectHistoricalAttempt, closeHistoricalAttempt, assertUnboundHistoricalAttempt, catalogReferencesRun } from "./historical-execution-recovery";
import { workflowDelay, waitForWorkflowDelay } from "./workflow-delay";
import { observeCheckpoint } from "./checkpoint-observation";
import { SettingsWriter, type ObservedVersion } from "./settings-writer";
import { captureJsonStructure, cloneJsonStructure, matchesJsonStructure, encodeCapturedJson, hashTextCooperatively } from "./cooperative-json";
import { setImmediate as yieldToInput } from "timers";
import { performance as monotonicClock } from "perf_hooks";
import type { PersistedWorkflowCatalog } from "./workflow-catalog-progress";
import { findWorkflowEntry, resolveWorkflowTransition, evaluateWorkflowCondition, workflowStepTransitions } from "./workflow-routing";
import { resolveOpencodeBin, psSingleQuoted, commandPreviewArg, shSingleQuoted, buildPowerShellEnvLines, SAFE_CLI_PROMPT_LENGTH, isWindows, scriptExt, buildShEnvLines, buildPosixLaunchCommand, appleScriptQuoted, LINUX_TERMINAL_CANDIDATES, commandExists, resolveLinuxTerminal, CliLaunchOptions, openOpencodeCli, openOpencodeCliLongPromptWindows, ProcessHandle, HiddenProcessHandle, launchHiddenPS, launchHiddenSh, launchHidden, writeUtf8BomFile, psUtf8Prelude } from "./cli-launchers";

const AUTOOC_WORKFLOW_PROMPT = `You are an expert AutoOC assistant. AutoOC is an Obsidian plugin that automates OpenCode, Codex and GitHub Copilot CLI tasks and workflows. Your goal is to generate valid import-ready AutoOC JSON for tasks and/or workflows.

Always output only one valid JSON object. Do not write explanations outside the final JSON.

Canonical complete export format:
{
  "autoOCExport": {
    "schemaVersion": "1.6.0",
    "exportedAt": "YYYY-MM-DDTHH:mm:ss.sssZ",
    "pluginVersion": "1.7.2",
    "name": "Package name",
    "description": "Short description"
  },
  "tasks": [],
  "workflows": []
}

For complete exports, schemaVersion must be exactly "1.0", "1.4.0", "1.5.0", or "1.6.0". Exports containing Copilot tasks must use "1.6.0"; other new exports should use "1.5.0". exportedAt must be an exact ISO-8601 UTC timestamp in the form YYYY-MM-DDTHH:mm:ss.sssZ.

Available modules:
AutoOC supports DAG workflows with three step kinds:
1. task: runs an OpenCode, Codex or GitHub Copilot CLI task prompt. A workflow may mix all three engines.
2. code: runs trusted JavaScript with explicitly enabled capabilities. Node vm is not a security boundary.
3. delay: pauses the workflow.

Tasks:
A task is reusable and can be referenced by workflows.
Concurrency for tasks and workflows is optional: omit it to inherit the vault setting; "exclusive" runs alone, "independent" requires separate folders and Git repositories, and "parallel" allows shared-vault execution. Parallel runs must use different outputs to avoid overwriting one another. The workflow's policy applies to its steps; shared reusable tasks still cannot run twice at the same time. Concurrency never grants Code or provider permissions. Do not set it unless the user explicitly requests a policy.

Task fields:
- exportId: unique within the JSON, for example "task-0".
- taskKind: "opencode" for OpenCode 1 by default, "opencode2" for OpenCode 2 CLI, "codex" for Codex in ChatGPT, "copilot" for GitHub Copilot CLI, or "code" for a reusable JavaScript task.
- copilotAllowAllTools: optional boolean, only for taskKind "copilot". False or absent exposes only file reading and search tools. True allows tools to edit files and run commands automatically. Enable only when the user requests those permissions. Copilot runs in the background: interactiveTerminal must be false or absent. Copilot uses the branch currently checked out in the selected folder; branch, createBranch, agent, useRalphLoop and reasoningEffort do not apply.
- name: short name, preferably snake_case or kebab-case.
- area: optional grouping area.
- prompt: required, non-empty complete direct instruction for the selected engine. Every task must include it, including taskKind "code"; for code tasks, mirror the code here for compatibility.
- interactiveTerminal: true opens the interactive client for an AI task: OpenCode 1 for taskKind "opencode", OpenCode 2 mini for "opencode2", or the ChatGPT/Codex app for taskKind "codex".
- reasoningEffort: optional for taskKind "codex"; use "minimal", "low", "medium", "high", "xhigh", "max", or "ultra" when requested.
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
- forceModel: true forces the selected model and does not apply the agent; otherwise false.
- branch: optional git branch, usually "".
- createBranch: true/false.
- workingDirectory: optional absolute path where this task should run.

Do not include model or forceModel in importable tasks unless the user explicitly asks for them. AutoOC will use the system default model on import.

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
- transitions: recommended canonical array of transitions for workflow steps. Use [] explicitly for a terminal step that must remain terminal after export and import.

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
The transitions array is the recommended canonical form. Include it on every generated workflow step, using [] for a terminal step that must remain terminal after export and import. The importer validates transitions when provided. The UI importer also accepts a single transition object only for legacy compatibility.

If transitions is missing, it is treated as legacy compatibility: the UI importer uses the legacy transitionMode, evaluatePrompt, and forceContinue fields and fills the missing links as a linear chain in input order.

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

Generation recommendations for clear graphs (not restrictions enforced by the importer):
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
    "schemaVersion": "1.5.0",
    "exportedAt": "2026-07-06T00:00:00.000Z",
    "pluginVersion": "1.7.2",
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
type TaskStatus = "pending" | "running" | "completed" | "failed" | "abandoned";
type IntervalUnit = "seconds" | "minutes" | "hours";
type TaskKind = "opencode" | "opencode2" | "codex" | "copilot" | "code";
type LegacyOwner = { workflowId: string; stepId: string; stepIndex: number; context: object };
type LegacyStopIdentity = { kind: "legacy"; token: string; taskId: string; workflowId?: string; stepId?: string; stepIndex?: number };
type SharedStopIdentity = { kind: "shared"; taskId: string; runId: string; workflowId: string; stepId: string; stepIndex: number };
type TaskStopIdentity = LegacyStopIdentity | SharedStopIdentity;
type LegacyAttempt = { identity: LegacyStopIdentity; task: ScheduledTask; owner?: LegacyOwner; cancelled: boolean;
  handle?: { kill(): unknown }; stopPromise?: Promise<string>; releaseStart?: () => void };
type DefaultAiEngine = "opencode" | "opencode2" | "codex" | "copilot";

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
  disabled?: boolean;
  codeExecution?: {runtimeExecution: any; status: string; output: string; lastRun: string};
  requiresAutoOCSecrets?: boolean;
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
  // legacy visual position retained for import/export compatibility
  position?: { x: number; y: number };
}

interface ScheduledTask {
  disabled?: boolean;
  concurrency?: ConcurrencyPolicy;
  legacyExecution?: LegacyStopIdentity & { startedAt: string; finishedAt?: string; stopState?: "requested" | "unconfirmed" | "error"; stopError?: string };
  id: string;
  taskKind?: TaskKind;
  name: string;
  area?: string;
  prompt: string;
  model: string;
  agent: string;
  forceModel: boolean;
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
  requiresAutoOCSecrets?: boolean; // All hosts reject this retired dependency.
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
  reasoningEffort?: string;
  copilotAllowAllTools?: boolean;
  lastCodexThreadId?: string;
  lastCodexTurnId?: string;
  pendingCodexApproval?: {
    requestId: string | number;
    kind: CodexApprovalRequest["kind"];
    summary: string;
  };
}

type WorkflowStatus = "pending" | "running" | "completed" | "failed" | "abandoned";

interface Workflow {
  disabled?: boolean;
  concurrency?: ConcurrencyPolicy;
  requiresAutoOCSecrets?: boolean;
  legacyExecution?: { token: string };
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
  opencode2Path?: string;
  defaultOpencode2Model?: string;
  defaultOpencode2Agent?: string;
  codexPath: string;
  copilotPath: string;
  claudePath?: string;
  cliLauncherEnabled?: Partial<Record<InteractiveCliProvider, boolean>>;
  defaultCopilotModel: string;
  defaultAiEngine: DefaultAiEngine;
  defaultModel: string;
  defaultCodexModel: string;
  defaultCodexReasoningEffort: string;
  defaultAgent: string;
  workingDirectory: string;
  cmdTemplate: string;
  taskTimeoutSeconds: number;
  defaultInteractiveTerminal: boolean;
  defaultConcurrency?: ConcurrencyPolicy;
  maxConcurrentExecutions?: number;
  logsEnabled: boolean;
  maxLogsPerTask: number;
  logRetentionDays: number;
  libraryUrl: string;
  dashboardPositions?: Record<string, { x: number; y: number; size?: number; sizePx?: number }>;
  dashboardTaskBubbleSize: "sm" | "md" | "lg" | "xl";
  dashboardTaskBubbleDiameter?: number;
  linuxTerminal?: string;
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
interface ExportTask {
  disabled?: boolean;
  concurrency?: ConcurrencyPolicy;
  exportId: string;
  requiresAutoOCSecrets?: boolean;
  taskKind?: TaskKind;
  copilotAllowAllTools?: boolean;
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
  reasoningEffort?: string;
  scheduleType: ScheduleType;
  scheduleTime: string;
  scheduleDate: string;
  scheduleDays: number[];
  scheduleMonthDays: number[];
  scheduleIntervalValue: number;
  scheduleIntervalUnit: IntervalUnit;
  useRalphLoop: boolean;
  forceModel: boolean;
  agent: string;
  branch?: string;
  createBranch?: boolean;
  workingDirectory?: string;
}

interface ExportWorkflowTransition {
  toStepId: string;
  mode: TransitionMode;
  evaluatePrompt?: string;
  condition?: string;
  conditionLang?: "javascript";
  forceContinue?: boolean;
}

function getCopilotTaskValidationError(task: { taskKind?: unknown; copilotAllowAllTools?: unknown; interactiveTerminal?: unknown }): string | null {
  if (task.copilotAllowAllTools !== undefined && (task.taskKind !== "copilot" || typeof task.copilotAllowAllTools !== "boolean")) {
    return "copilotAllowAllTools must be a boolean and is only valid for Copilot tasks.";
  }
  if (task.taskKind === "copilot" && task.interactiveTerminal === true) {
    return "Copilot tasks run in the background; interactiveTerminal must be false.";
  }
  return null;
}

function addCopilotTaskSettings(container: HTMLElement, draft: Partial<ScheduledTask>, defaultModel: string): void {
  new Setting(container)
    .setName("Copilot model")
    .setDesc("Model ID available to your Copilot account. Empty uses the AutoOC default, then the CLI default.")
    .addText((text) => text.setPlaceholder(defaultModel || "Automatic").setValue(draft.model || "")
      .onChange((value) => { draft.model = value.trim(); }));
  new Setting(container)
    .setName("Allow tools automatically")
    .setDesc("Allow Copilot to edit files and run commands without asking. Off exposes only file reading and search tools. Folder and URL permissions remain controlled by Copilot.")
    .addToggle((toggle) => toggle.setValue(draft.copilotAllowAllTools === true)
      .onChange((value) => { draft.copilotAllowAllTools = value; }));
}

function addCopilotGlobalSettings(container: HTMLElement, plugin: AutoOCPlugin): void {
  container.createEl("h3", { text: "GitHub Copilot task defaults" });
  new Setting(container)
    .setName("Test Copilot installation")
    .addButton((button) => button.setButtonText("Detect & test").onClick(async () => {
      try {
        const bin = resolveCopilotBin(plugin.settings.copilotPath);
        const cwd = plugin.settings.workingDirectory || (plugin.app.vault.adapter as any).basePath || ".";
        const version = await checkCopilotInstallation(bin, cwd);
        new Notice(`AutoOC: ${version}\n${bin}\nCLI detected. Account access is checked when a task runs.`, 10000);
      } catch (error) {
        new Notice(`AutoOC: could not start GitHub Copilot CLI — ${String(error)}`, 10000);
      }
    }));
  new Setting(container)
    .setName("Default Copilot model")
    .setDesc("Model ID available to your Copilot account. Empty uses the CLI default; see /model in Copilot for available models.")
    .addText((text) => text.setPlaceholder("Automatic").setValue(plugin.settings.defaultCopilotModel || "")
      .onChange(async (value) => { plugin.settings.defaultCopilotModel = value.trim(); await plugin.saveSettings(); }));
}

interface ExportWorkflowStep {
  disabled?: boolean;
  requiresAutoOCSecrets?: boolean;
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
  disabled?: boolean;
  concurrency?: ConcurrencyPolicy;
  requiresAutoOCSecrets?: boolean;
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
  ...EXECUTION_DEFAULTS,
  tasks: [],
  workflows: [],
  logsEnabled: true,
  maxLogsPerTask: 50,
  logRetentionDays: 30,
  libraryUrl: "https://raw.githubusercontent.com/juanpega/AutoOC_obisdian_extension/main/library",
  dashboardPositions: {},
  dashboardTaskBubbleSize: "md",
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

function toExportTask(task: ScheduledTask, exportId: string): ExportTask {
  return {
    exportId,
    taskKind: task.taskKind,
    concurrency: task.concurrency,
    disabled: task.disabled,
    copilotAllowAllTools: task.taskKind === "copilot" ? task.copilotAllowAllTools === true : undefined,
    requiresAutoOCSecrets: task.requiresAutoOCSecrets,
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
    reasoningEffort: task.reasoningEffort,
    scheduleType: task.scheduleType,
    scheduleTime: task.scheduleTime,
    scheduleDate: task.scheduleDate,
    scheduleDays: task.scheduleDays,
    scheduleMonthDays: task.scheduleMonthDays || [],
    scheduleIntervalValue: task.scheduleIntervalValue ?? 10,
    scheduleIntervalUnit: task.scheduleIntervalUnit ?? "minutes",
    useRalphLoop: task.useRalphLoop,
    forceModel: task.forceModel,
    agent: task.agent,
    branch: task.branch,
    createBranch: task.createBranch,
    workingDirectory: task.workingDirectory,
  };
}

function toExportWorkflow(
  workflow: Workflow,
  exportId: string,
  taskExportIdMap: Map<string, string>
): ExportWorkflow {
  return {
    exportId,
    requiresAutoOCSecrets: workflow.requiresAutoOCSecrets,
    concurrency: workflow.concurrency,
    disabled: workflow.disabled,
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
      disabled: step.disabled,
      requiresAutoOCSecrets: step.requiresAutoOCSecrets,
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
      transitions: step.transitions !== undefined
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

import { normalizeCommandOutput, extractTouchedFiles, formatTaskOutput, formatLogContent, countReplacementChars, decodeCp850, decodeWindows1252, decodeCommandBuffer } from "./command-output";

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
SCRIPT_PATH = Path(__file__).resolve()
VAULT_PATH = Path(os.environ.get("AUTOOC_VAULT_PATH") or SCRIPT_PATH.parents[3])
PLUGIN_DIR = VAULT_PATH / ".obsidian" / "plugins" / "auto-oc"
BRIDGE_PATH = PLUGIN_DIR / "mcp-bridge.json"


def bridge_post(endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
    if not BRIDGE_PATH.exists():
        return {"ok": False, "error": "AutoOC plugin is not running", "vaultPath": str(VAULT_PATH), "bridgePath": str(BRIDGE_PATH)}
    try:
        bridge = json.loads(BRIDGE_PATH.read_text(encoding="utf-8"))
        url = bridge.get("url")
        token = bridge.get("token")
        if not isinstance(url, str) or not isinstance(token, str):
            return {"ok": False, "error": "AutoOC plugin is not running"}
        from urllib.request import Request, urlopen
        request = Request(
            url.rstrip("/") + endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(request, timeout=10) as response:
            result = json.loads(response.read().decode("utf-8"))
        return result if isinstance(result, dict) else {"ok": False, "error": "Invalid bridge response"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def vault_note_path(note_path: str) -> Path | None:
    try:
        candidate = (VAULT_PATH / note_path).resolve()
        vault = VAULT_PATH.resolve()
        if candidate != vault and vault not in candidate.parents:
            return None
        return candidate if candidate.suffix.lower() == ".md" else None
    except Exception:
        return None


@mcp.tool()
def autooc_list(kind: str = "all") -> dict[str, Any]:
    """List AutoOC tasks and/or workflows. kind must be tasks, workflows, or all."""
    if kind not in {"tasks", "workflows", "all"}:
        return {"ok": False, "error": "kind must be tasks, workflows, or all"}
    return bridge_post("/list", {"kind": kind})


@mcp.tool()
def autooc_create(kind: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Create an AutoOC task or workflow from an export object or export file payload."""
    if kind not in {"task", "workflow"}:
        return {"ok": False, "error": "kind must be task or workflow"}
    return bridge_post("/create", {"kind": kind, "payload": payload})


@mcp.tool()
def autooc_export(kind: str = "all", id_or_name: str | None = None) -> dict[str, Any]:
    """Export AutoOC tasks/workflows as reusable import JSON. kind: all, tasks, workflows, task, or workflow."""
    if kind not in {"all", "tasks", "workflows", "task", "workflow"}:
        return {"ok": False, "error": "kind must be all, tasks, workflows, task, or workflow"}
    return bridge_post("/export", {"kind": kind, "idOrName": id_or_name})


@mcp.tool()
def autooc_play(kind: str, id_or_name: str) -> dict[str, Any]:
    """Run an AutoOC task or workflow by id or name."""
    if kind not in {"task", "workflow"}:
        return {"ok": False, "error": "kind must be task or workflow"}
    return bridge_post("/play", {"kind": kind, "idOrName": id_or_name})


@mcp.tool()
def autooc_stop(kind: str, id_or_name: str) -> dict[str, Any]:
    """Stop an AutoOC task or workflow by id or name."""
    if kind not in {"task", "workflow"}:
        return {"ok": False, "error": "kind must be task or workflow"}
    return bridge_post("/stop", {"kind": kind, "idOrName": id_or_name})


@mcp.tool()
def obsidian_note(action: str, path: str | None = None, query: str | None = None) -> dict[str, Any]:
    """Read-only Obsidian markdown access. Supports list, read, and search."""
    try:
        vault = VAULT_PATH.resolve()
        if action == "list":
            notes = [str(note.relative_to(vault)) for note in vault.rglob("*.md") if ".obsidian" not in note.relative_to(vault).parts]
            return {"ok": True, "files": notes[:200], "truncated": len(notes) > 200}
        if action == "read":
            if not path:
                return {"ok": False, "error": "path is required"}
            note = vault_note_path(path)
            if not note or not note.is_file():
                return {"ok": False, "error": "Markdown note not found"}
            content = note.read_text(encoding="utf-8")[:200000]
            return {"ok": True, "path": str(note.relative_to(vault)), "content": content, "truncated": note.stat().st_size > len(content.encode("utf-8"))}
        if action == "search":
            if not query:
                return {"ok": False, "error": "query is required"}
            matches = []
            for note in vault.rglob("*.md"):
                if ".obsidian" in note.relative_to(vault).parts:
                    continue
                if query.lower() in note.read_text(encoding="utf-8").lower():
                    matches.append(str(note.relative_to(vault)))
                    if len(matches) == 200:
                        break
            return {"ok": True, "files": matches, "truncated": len(matches) == 200}
        return {"ok": False, "error": "action must be list, read, or search"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


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
  const match = fileName.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})(?:\.\d{3}_[a-zA-Z0-9-]+_\d+)?\.log$/);
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
  if (task.disabled) return false;
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
  if (wf.disabled) return false;
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
  private bulkCatalogMutationInProgress = false;

  async applyBulkSelection(selection: BulkSelection[], action: BulkAction): Promise<void> {
    const save = async (transaction?:CatalogTransaction) => {
      this.assertLifecycleOpen();
      if (this.updateInProgress || this.workflowEditPending || this.bulkCatalogMutationInProgress) throw new Error("Catalog maintenance is in progress. Try again shortly.");
      this.bulkCatalogMutationInProgress = true;
      try {
        await applyBulkCatalogAction(this.settings, selection, action,
          (kind, id) => this.getDefinitionStartState(kind, id, true),
          validate => this.saveSettings(false, validate, transaction));
      } finally { this.bulkCatalogMutationInProgress = false; }
    };
    const basePath = (this.app.vault.adapter as any).basePath;
    if (basePath) await this.settingsWriter.trackTransaction(catalogTransaction(this.selectedExecutionLocation().configurationFile, save));
    else await save();
    // Publication succeeded even if a view cannot refresh.
    try { this.refreshOpenViews(); } catch { console.warn("AutoOC: Catalog saved; panel refresh failed."); }
  }

  private draftControllers = new Set<AbortController>();
  private draftModals = new Set<AiDraftModal>();

  async saveGeneratedDefinitionDraft(tasks: ScheduledTask[], workflow?: Workflow): Promise<void> {
    this.assertLifecycleOpen();
    const save = async (transaction?:CatalogTransaction) => {
      this.assertLifecycleOpen();
      await saveGeneratedDefinition(this.settings, tasks, workflow, () => this.saveSettings(true, undefined, transaction));
    };
    const basePath = (this.app.vault.adapter as any).basePath;
    if (!basePath) return save();
    return this.settingsWriter.trackTransaction(catalogTransaction(this.selectedExecutionLocation().configurationFile, save));
  }

  openAiDraft(kind: DraftKind, objective: string, useDraft: (draft: GeneratedDraft) => void): AiDraftModal {
    const modal = new AiDraftModal(this.app, {
      kind, guide: AUTOOC_WORKFLOW_PROMPT, version: this.manifest.version,
      engine: this.settings.defaultAiEngine, objective,
      models: engine => [
        ...(engine === "codex" ? this.availableCodexModels : engine === "opencode" ? this.availableModels : []),
        ...this.settings.tasks.filter(task => (task.taskKind || "opencode") === engine && task.model?.trim())
          .map(task => ({ value: task.model, label: task.model })),
      ],
      defaults: () => ({ engine: this.settings.defaultAiEngine, model: this.getEffectiveDefaultModel(), opencode2Model: this.settings.defaultOpencode2Model, opencode2Agent: this.settings.defaultOpencode2Agent,
        codexModel: this.getEffectiveCodexModel(), copilotModel: this.settings.defaultCopilotModel,
        agent: this.getEffectiveAgent(), reasoningEffort: this.settings.defaultCodexReasoningEffort }),
      generate: async (prompt, engine, model, signal) => {
        this.assertLifecycleOpen();
        if (this.draftControllers.size) throw new Error("Another draft is being generated. Finish or cancel it first.");
        const controller = new AbortController();
        const cancel = () => controller.abort();
        signal.addEventListener("abort", cancel, { once: true });
        if (signal.aborted) cancel();
        this.draftControllers.add(controller);
        try {
          return await generateDraftText({ engine, prompt, model, reasoningEffort: this.settings.defaultCodexReasoningEffort,
            opencodePath: this.settings.opencodePath, opencode2Path: this.settings.opencode2Path, codexPath: this.settings.codexPath, copilotPath: this.settings.copilotPath }, controller.signal);
        } catch (error) {
          throw new Error(this.redactSecrets((error as Error).message));
        } finally { this.draftControllers.delete(controller); signal.removeEventListener("abort", cancel); }
      },
      useDraft: draft => { this.assertLifecycleOpen(); useDraft(draft); },
      onClosed: () => { this.draftModals.delete(modal); },
    });
    this.draftModals.add(modal);
    modal.open();
    return modal;
  }
  private legacyAttempts = new Map<string, LegacyAttempt>();
  private settingsWriter = new SettingsWriter();
  private settingsLoadRevision = 0;
  private settingsPublicationState: "ready" | "loading" | "conflict" = "ready";
  private settingsWritableCatalog?: {file:string;version:ObservedVersion};
  settings!: AutoOCSettings;
  private legacyOutputRedaction = new LegacyOutputRedaction(() => {
    new Notice("AutoOC: some old credentials cannot be hidden in output. This notice does not block tasks. Open Settings → AutoOC → Legacy credential notice to review or dismiss the reminder.", 12000);
  }, {
    getItem: key => typeof this.app.loadLocalStorage === "function" ? this.app.loadLocalStorage(key) : localStorage.getItem(key),
    setItem: (key, value) => {
      if (typeof this.app.saveLocalStorage === "function") this.app.saveLocalStorage(key, value);
      else localStorage.setItem(key, value);
    },
  });
  view?: AutoOCView;
  availableModels: { value: string; label: string }[] = FALLBACK_MODELS;
  availableAgents: { value: string; label: string }[] = FALLBACK_AGENTS;
  availableCodexModels: CodexModelOption[] = [];
  private taskUpdatedCallbacks = new Set<(task: ScheduledTask) => void>();
  private workflowUpdatedCallbacks = new Set<(workflow: Workflow) => void>();
  // Map taskId -> child process, so we can kill running tasks
  private runningProcesses = new Map<string, ProcessHandle>();
  private runningCodexClients = new Map<string, CodexAppServerClient>();
  private dueCheckInProgress = false;
  // Workflows that have been manually stopped; checked in step callbacks to abort chaining
  private stoppingWorkflows = new Set<string>();
  private workflowDelayControllers = new Map<string, AbortController>();
  private pluginExecutionLease?: ExecutionLease;
  private cliRequestHost?: ReturnType<typeof createPluginRequestHost>;
  private workflowEditPending = false;
  private cliRequestTimer?: number;
  private pluginExecutionLocation?: InstalledWorkflowLocation;
  private sharedWorkflowExecutions = new Map<string, {workflowId:string;taskId?:string;runId?:string;controller:AbortController;checkpoint?:RunCheckpoint;liveOutput?:WorkflowTaskOutput}>();
  // Compatibility for exclusive maintenance reservations and existing observers.
  private get sharedWorkflowExecution() { return this.sharedWorkflowExecutions?.values().next().value; }
  private set sharedWorkflowExecution(value: {workflowId:string;taskId?:string;runId?:string;controller:AbortController;checkpoint?:RunCheckpoint;liveOutput?:WorkflowTaskOutput} | undefined) {
    this.sharedWorkflowExecutions ||= new Map();
    this.sharedWorkflowExecutions.clear();
    if(value)this.sharedWorkflowExecutions.set(value.workflowId,value);
  }
  private sharedExecution(workflowId?:string,taskId?:string,runId?:string) {
    return [...(this.sharedWorkflowExecutions?.values() || [])].find(e=>(!workflowId || e.workflowId===workflowId) && (!taskId || e.taskId===taskId || e.checkpoint?.steps.some(s=>this.settings.workflows.find(w=>w.id===e.workflowId)?.steps.some(step=>step.id===s.stepId && step.taskId===taskId))) && (!runId || e.runId===runId));
  }
  private sharedSettingsBaseline?: ReturnType<typeof captureJsonStructure>;
  private sharedCompletions = new Set<Promise<unknown>>();
  private mcpBridgeServer?: http.Server;
  private mcpBridgeToken = "";

  // Update-check state
  latestVersion: string | null = null;
  updateAvailable = false;
  updateCheckError: string | null = null;
  updateInProgress = false;
  private lifecycleStopped = false;
  private startupPending = false;
  private startupWaitTimer?: number;
  private startupWaitGeneration = 0;
  private startupWaitingForOwner = false;
  private startupRecoveryDisposed = false;
  private startupRetry?: Promise<void>;
  private settingsRecoveryPromise?: Promise<unknown>;
  private windowCloseDrain?: Promise<void>;
  private observedJournalSnapshot?: string;
  private observationProof?: string;
  private executionAttempted = false;
  private lifecycleTimers = new Set<ReturnType<typeof setTimeout>>();
  private schedulerTimer?: number;
  ready = false;
  startupError: string | null = null;

  private lifecycleTimeout(callback: () => void, milliseconds: number): void {
    const timer = setTimeout(() => {
      this.lifecycleTimers.delete(timer);
      if (!this.lifecycleStopped) callback();
    }, milliseconds);
    this.lifecycleTimers.add(timer);
  }

  private assertLifecycleOpen(): void {
    if (this.lifecycleStopped) throw new Error("AutoOC instance is stopped");
  }

  isLifecycleStopped(): boolean {
    return this.lifecycleStopped;
  }

  private assertExecutionIdle(): void {
    if (this.sharedWorkflowExecution || this.runningProcesses.size || this.runningCodexClients.size ||
        this.workflowDelayControllers.size || this.legacyAttempts.size || this.settingsWriter.hasPendingWrites || this.cliRequestHost?.hasPendingWork) {
      throw new Error("Active execution or pending write requires reconciliation");
    }
    const location = this.selectedExecutionLocation();
    assertInstalledExecutionIdle(location.installationDirectory, this.settings);
  }

  // Releasing this UI's own reservation is safe when it only observed unchanged
  // historical runs. This does not reconcile them or authorize replay/recovery.
  private journalSnapshot(): string {
    const {runtime,names} = this.journalNames();
    return JSON.stringify(names.map(name => {
      readExecutionCheckpoint(runtime, name.slice(0, -5));
      return [name, fs.readFileSync(path.join(runtime, name), 'utf8')];
    }));
  }

  private journalNames() {
    const location = this.selectedExecutionLocation();
    const directory = location.installationDirectory, runtime = location.runtimeDirectory;
    if (fs.existsSync(path.join(directory, 'data.json.write-lock')) || fs.existsSync(path.join(directory,'data.json.write-intent')) || fs.readdirSync(directory).some(name => name.startsWith('data.json.') && name.endsWith('.tmp'))) throw new Error('Unfinished configuration write');
    const names = fs.readdirSync(runtime).sort();
    if (names.some(name => name === 'update-pending.json' || name.endsWith('.tmp') || name.endsWith('.write-lock'))) throw new Error('Unfinished runtime write or update');
    return {runtime,names:names.filter(name => /^[a-zA-Z0-9-]+\.json$/.test(name))};
  }

  private async journalSnapshotAsync(): Promise<string> {
    const {runtime,names}=this.journalNames();
    const entries:string[][]=[],observations:Array<Pick<Awaited<ReturnType<typeof observeCheckpoint>>,"assertUnchanged"|"assertCurrent">>=[];
    for(const name of names) {
      const {text,assertUnchanged,assertCurrent}=await observeCheckpoint(runtime,name.slice(0,-5));
      entries.push([name,text]);observations.push({assertUnchanged,assertCurrent});
      this.assertLifecycleOpen();
    }
    const parts:string[]=[];
    let deadline=monotonicClock.now()+4;
    for(const part of encodeCapturedJson(captureJsonStructure(entries,0))) {
      parts.push(part);
      if(monotonicClock.now()>=deadline) {
        await new Promise<void>(resolve=>yieldToInput(resolve));
        deadline=monotonicClock.now()+4;
      }
    }
    for(const observation of observations)await observation.assertUnchanged();
    const current=this.journalNames();
    if(current.runtime!==runtime || JSON.stringify(current.names)!==JSON.stringify(names))throw new Error("Observed execution state changed");
    for(const observation of observations)observation.assertCurrent();
    this.assertLifecycleOpen();
    return parts.join("");
  }

  private assertPluginCanRelease(): void {
    try { this.assertExecutionIdle(); return; }
    catch (error) {
      if (this.executionAttempted || this.observedJournalSnapshot === undefined || this.startupPending ||
          this.sharedWorkflowExecution || this.runningProcesses.size || this.runningCodexClients.size ||
          this.workflowDelayControllers.size || this.legacyAttempts.size || this.settingsWriter.hasPendingWrites || this.cliRequestHost?.hasPendingWork) throw error;
      if (this.journalSnapshot() !== this.observedJournalSnapshot) throw error;
      const file = this.selectedExecutionLocation().configurationFile;
      for (const settings of [this.settings, JSON.parse(fs.readFileSync(file, 'utf8'))]) {
        // Unbound/legacy activity has no durable journal proving it was only observed.
        if ([...(settings.tasks || []), ...(settings.workflows || [])].some(entry => entry.legacyExecution || entry.pendingCodexApproval)) throw error;
        assertIdleCatalog({tasks:(settings.tasks || []).filter((entry:any) => !entry.runtimeExecution),
          workflows:(settings.workflows || []).filter((entry:any) => !entry.runtimeExecution)}, new Map());
      }
    }
  }

  private observationProofPath(token: string): string {
    return path.join(this.selectedExecutionLocation(false).runtimeDirectory, 'plugin-observation-' + token + '.proof');
  }

  private async recordObservationProof(): Promise<void> {
    const lease = this.pluginExecutionLease!;
    const snapshot=this.observedJournalSnapshot!;
    const journalHash=await hashTextCooperatively(snapshot);
    this.assertLifecycleOpen();
    lease.assertOwned();
    const file = this.observationProofPath(lease.token);
    const fd = fs.openSync(file, 'wx', 0o600);
    try {
      const identity=fs.fstatSync(fd);
      const bytes=JSON.stringify({schemaVersion:1,token:lease.token,journalHash});
      fs.writeFileSync(fd, bytes);
      await new Promise<void>((resolve,reject)=>fs.fsync(fd,error=>error?reject(error):resolve()));
      lease.assertOwned();this.assertLifecycleOpen();
      const current=fs.lstatSync(file);
      if(!current.isFile() || current.isSymbolicLink() || current.nlink!==1 || current.ino!==identity.ino || current.dev!==identity.dev ||
          current.size!==Buffer.byteLength(bytes) || fs.readFileSync(file,"utf8")!==bytes ||
          this.pluginExecutionLease!==lease || this.observedJournalSnapshot!==snapshot)throw new Error("Observation proof identity changed");
    } finally { fs.closeSync(fd); }
    this.observationProof = file;
  }

  private beginExecutionEffects(): void {
    this.assertLifecycleOpen();
    if(this.workflowEditPending)throw new Error("Workflow edit is being saved; wait briefly before starting execution");
    if (this.observationProof) {
      this.pluginExecutionLease!.assertOwned();
      const file = this.observationProof;
      if (fs.existsSync(file)) fs.unlinkSync(file);
      this.observationProof = undefined;
    }
    this.executionAttempted = true;
  }

  private assertClosedObservation(token: string): void {
    const location = this.selectedExecutionLocation(false);
    if (!hasCompleteInstalledRelease(location.installationDirectory, PLUGIN_BUILD_VERSION)) throw new Error('Installed package changed');
    const file = this.observationProofPath(token), stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error('Invalid observation proof');
    const proof = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (proof.schemaVersion !== 1 || proof.token !== token || proof.journalHash !== require('crypto').createHash('sha256').update(this.journalSnapshot()).digest('hex')) throw new Error('Observed execution state changed');
    const settings = JSON.parse(fs.readFileSync(location.configurationFile, 'utf8'));
    if ([...(settings.tasks || []), ...(settings.workflows || [])].some(entry => entry.legacyExecution || entry.pendingCodexApproval)) throw new Error('Execution requires reconciliation');
    assertIdleCatalog({tasks:(settings.tasks || []).filter((entry:any) => !entry.runtimeExecution),
      workflows:(settings.workflows || []).filter((entry:any) => !entry.runtimeExecution)}, new Map());
  }

  private async completeInstalledRelease(): Promise<() => Promise<void>> {
    const location = this.selectedExecutionLocation();
    // Obsidian may reuse its cached 1.6.0 manifest after the legacy updater
    // replaces the files. Trust the physical identity only after verification.
    const manifestFile = path.join(location.installationDirectory, "manifest.json");
    const manifestStat = fs.lstatSync(manifestFile);
    if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.nlink !== 1) throw new Error("Unsafe installed plugin manifest");
    const startingManifest = await fs.promises.readFile(manifestFile);
    const installedManifest = JSON.parse(startingManifest.toString("utf8"));
    if (installedManifest.id !== "auto-oc" || installedManifest.id !== this.manifest.id || installedManifest.version !== PLUGIN_BUILD_VERSION) {
      throw new Error("Installed plugin manifest identity or version differs from the bundle");
    }
    const mainFile = path.join(location.installationDirectory, "main.js");
    const stat = fs.lstatSync(mainFile);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error("Unsafe installed plugin bundle");
    const startingBundle = await fs.promises.readFile(mainFile);
    const completePackage = await hasCompleteInstalledReleaseAsync(location.installationDirectory, PLUGIN_BUILD_VERSION);
    const assertCatalog = await waitForInstalledCatalog(location.installationDirectory, () => {
      this.assertLifecycleOpen();
      this.selectedExecutionLocation();
      for (const [file, bytes] of [[manifestFile, startingManifest], [mainFile, startingBundle]] as const) {
        const current = fs.lstatSync(file);
        if (!current.isFile() || current.isSymbolicLink() || current.nlink !== 1 || !fs.readFileSync(file).equals(bytes)) {
          throw new Error("Installed plugin identity changed during startup");
        }
      }
    }, completePackage, true);
    await assertCatalog();
    if (completePackage) {
      if (!await hasCompleteInstalledReleaseAsync(location.installationDirectory, PLUGIN_BUILD_VERSION)) throw new Error("Installed package changed during startup validation");
      Object.assign(this.manifest, installedManifest);
      return assertCatalog;
    }
    this.assertExecutionIdle();
    this.updateInProgress = true;
    try {
      const files = await downloadRelease(`https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}`, PLUGIN_BUILD_VERSION);
      this.assertLifecycleOpen();
      if (!files["main.js"].equals(startingBundle) || !fs.readFileSync(mainFile).equals(startingBundle)) {
        throw new Error("Bootstrap revision differs from the starting plugin; retry with a coherent release");
      }
      if (!files["manifest.json"].equals(startingManifest) || !fs.readFileSync(manifestFile).equals(startingManifest)) {
        throw new Error("Bootstrap manifest differs from the starting installation");
      }
      this.assertExecutionIdle();
      await assertCatalog();
      installRelease({directory:location.installationDirectory, version:PLUGIN_BUILD_VERSION, files, lease:this.pluginExecutionLease!});
      if (!hasCompleteInstalledRelease(location.installationDirectory, PLUGIN_BUILD_VERSION)) throw new Error("Installed package verification failed");
      Object.assign(this.manifest, installedManifest);
      return assertCatalog;
    } finally {
      this.updateInProgress = fs.existsSync(path.join(location.runtimeDirectory, "update-pending.json"));
    }
  }

  async onload() {
    this.startupPending = true;
    this.registerWindowCloseGuard();
    try {
      try {
        const location=this.selectedExecutionLocation(false);
        if(fs.existsSync(location.configurationFile+'.write-intent')){
          if(!await hasCompleteInstalledReleaseAsync(location.installationDirectory,PLUGIN_BUILD_VERSION))throw new Error('Interrupted settings recovery requires a complete verified package');
          this.settingsRecoveryPromise=recoverInterruptedSettingsWrite(location.installationDirectory,()=>this.assertLifecycleOpen());
          try{
            const recovered=await this.settingsRecoveryPromise;
            if(recovered)new Notice('AutoOC: an interrupted settings save was archived. Your saved catalog was kept; no tasks were resumed.',10000);
          }finally{this.settingsRecoveryPromise=undefined;}
        }
        this.reservePluginExecution();
        const assertCatalog = await this.completeInstalledRelease();
        this.assertLifecycleOpen();
        // The cooperative load records the actual bytes it validated. Publication
        // rejects local edits or unloads that occur during asynchronous work.
        await assertCatalog();
        await this.loadSettings();
        this.assertLifecycleOpen();
        this.observedJournalSnapshot = await this.journalSnapshotAsync();
        // A durable, owner-bound proof covers renderer termination without any
        // unload event. Every execution entry removes it before its first effect.
        await this.recordObservationProof();
      }
      catch (error) {
        if (this.startupRecoveryDisposed) throw error;
        this.startupPending = false;
        // Engine admission failed before registering commands or scheduling work.
        // Keep the panel independent; the observer never adopts a writable catalog.
        if (this.pluginExecutionLease) await this.onunload();
        this.startupRecoveryDisposed = false;
        this.lifecycleStopped = true;
        this.startupError = String(error);
        this.startupWaitingForOwner = this.waitForExecutionOwner();
        this.registerRecoveryInterface();
        return;
      }
      // The MCP bridge is retired. CLI and the distributed skill remain available.
      // Load models asynchronously to avoid blocking startup
      this.lifecycleTimeout(() => {
        this.refreshModels();
        this.refreshAgents();
        void this.refreshCodexModels();
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
        id: "review-older-attempts",
        name: "Review older attempts",
        callback: () => {void this.openHistoricalAttemptsReview().catch(error=>new Notice(this.redactSecrets(String(error))));},
      });
      this.addCommand({id: "resolve-blocked-executions", name: "Resolve blocked executions", callback: () => this.openBlockedExecutionsReview()});

      this.addCommand({
        id: "review-legacy-credential-notice",
        name: "Review legacy credential notice",
        callback: () => this.openLegacyCredentialNotice(),
      });

      this.addCommand({
        id: "create-task",
        name: "Create new AI task",
        callback: () => new CreateTaskModal(this.app, this).open(),
      });

      this.addCommand({
        id: "open-cli",
        name: "Open CLI",
        callback: () => openCliLauncher(this.app, this),
      });

      this.addCommand({
        id: "open-chatgpt-codex",
        name: "Open Codex CLI",
        callback: () => openCliLauncher(this.app, this, "codex"),
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
      this.schedulerTimer = window.setInterval(() => { if (!this.lifecycleStopped) void this.runDueAll(); }, 5_000);
      this.registerInterval(this.schedulerTimer);

      // Initial check only after Obsidian has restored its layout, plus an extra
      // margin so other plugins and the Electron environment settle before launch.
      this.app.workspace.onLayoutReady(() => {
        if (!this.lifecycleStopped) this.lifecycleTimeout(() => { void this.runDueAll(); }, INITIAL_DUE_CHECK_DELAY_MS);
      });

      // Check for plugin updates in the background
      this.lifecycleTimeout(() => { void this.checkForUpdates(true); }, 3_000);
      // Obsidian's quit hook supplies a queue for asynchronous cleanup. DOM
      // unload is too late for a pending settings save in the Electron host.
      if (typeof this.app.workspace.on === 'function') {
        this.registerEvent(this.app.workspace.on('quit', tasks => {
          const cleanup = this.onunload().catch(error => console.warn('AutoOC quit cleanup retained reservation', error));
          tasks.addPromise(cleanup);
        }));
      }
      // Closing a vault window need not emit workspace quit. Start the same
      // guarded cleanup synchronously before Electron destroys that renderer.
      // Pending writes/effects still retain their reservation if not drained.
      this.ready = true;
      this.startCliRequests();
      this.cliRequestTimer = window.setInterval(() => {
        void this.cliRequestHost?.poll().catch(() => {
          if (this.cliRequestTimer !== undefined) window.clearInterval(this.cliRequestTimer);
          this.cliRequestTimer = undefined;
          try { this.cliRequestHost?.close(); } catch { /* Preserve unresolved ownership. */ }
          console.warn("AutoOC CLI request reception stopped; inspect execution ownership before retrying");
        });
      }, 200);
      this.registerInterval(this.cliRequestTimer);
    } catch (error) {
      this.startupPending = false;
      await this.onunload().catch(cleanup => console.warn("AutoOC startup cleanup retained reservation", cleanup));
      // Component.unload also disposes Obsidian's registered views/commands/events.
      // Calling only our lifecycle hook would leave partial host registrations.
      try { this.unload?.(); }
      catch (cleanup) { console.warn("AutoOC host registration cleanup failed", cleanup); }
      new Notice(`AutoOC: startup failed — ${String(error)}`);
      throw error;
    } finally { this.startupPending = false; }
  }

  private registerWindowCloseGuard():void {
    if(typeof window.addEventListener!=='function')return;
    const close=(event:BeforeUnloadEvent)=>{
      const publishingCLI=this.cliRequestHost?.hasPendingWork&&!this.sharedWorkflowExecution&&!this.runningProcesses.size&&!this.runningCodexClients.size&&!this.legacyAttempts.size;
      if(this.settingsWriter.hasPendingWrites||publishingCLI||this.settingsRecoveryPromise){
        // Electron destroys the renderer without awaiting async onunload.
        // Do not turn reload/navigation into window.close(): retain the user's
        // original action and let them retry once durable publication finishes.
        event.preventDefault();(event as any).returnValue=false;
        if(!this.windowCloseDrain){
          new Notice('AutoOC is finishing a save. The window will stay open; close or reload again when saving finishes.',8000);
          this.windowCloseDrain=Promise.all([this.settingsWriter.drain(),publishingCLI?this.cliRequestHost?.drain():undefined,this.settingsRecoveryPromise]).then(()=>{
            new Notice('AutoOC: saving finished. You can close or reload the window.');
          }).catch(error=>{
            console.warn('AutoOC window kept open after save failure',error);
            new Notice('AutoOC could not finish saving. The window was kept open; inspect recovery before retrying.',10000);
          }).finally(()=>{this.windowCloseDrain=undefined;});
        }
        return;
      }
      void this.onunload().catch(error=>console.warn('AutoOC window cleanup retained reservation',error));
    };
    window.addEventListener('beforeunload',close);
    this.register(()=>window.removeEventListener('beforeunload',close));
  }

  async onunload() {
    for (const modal of this.draftModals || []) modal.close();
    this.draftModals?.clear();
    for (const controller of this.draftControllers || []) controller.abort();
    this.draftControllers?.clear();
    const drainingSharedSessions=this.sharedCompletions.size>0;
    this.startupRecoveryDisposed = true;
    this.stopStartupWait();
    this.lifecycleStopped = true;
    this.ready = false;
    if (this.cliRequestTimer !== undefined) window.clearInterval(this.cliRequestTimer);
    this.cliRequestTimer = undefined;
    const closingRequestHost = this.cliRequestHost;
    try { closingRequestHost?.close(); }
    catch { console.warn("AutoOC CLI request host closed with unresolved ownership"); }
    for (const timer of this.lifecycleTimers) clearTimeout(timer);
    this.lifecycleTimers.clear();
    if (this.schedulerTimer !== undefined) window.clearInterval(this.schedulerTimer);
    this.schedulerTimer = undefined;
    this.vaultRefreshStopped = true;
    this.vaultRefresh?.dispose();
    const drainingLease = this.pluginExecutionLease;
    const mayReleaseAfterWrites = !!drainingLease && (this.settingsWriter.hasPendingWrites || closingRequestHost?.hasPendingWork) &&
      !this.startupPending && !this.sharedWorkflowExecution && !this.runningProcesses.size &&
      !this.runningCodexClients.size && !this.workflowDelayControllers.size && !this.legacyAttempts.size;
    let unresolved = this.startupPending;
    if (this.pluginExecutionLease) {
      try { this.assertPluginCanRelease(); }
      catch (error) { unresolved = true; console.warn("AutoOC retained execution reservation", error); }
    }
    for(const execution of this.sharedWorkflowExecutions?.values() || [])execution.controller.abort();
    for (const controller of this.workflowDelayControllers.values()) controller.abort();
    this.workflowDelayControllers.clear();
    // Capture/close only this instance's bridge before relinquishing ownership.
    // Obsidian does not wait for this promise; the synchronous prefix is critical.
    const closingBridge = this.stopMcpBridge();
    void closingBridge.catch(error => console.warn("AutoOC bridge close failed", error));
    // Kill all running processes cleanly when plugin unloads
    for (const [, proc] of this.runningProcesses) {
      proc.kill();
    }
    this.runningProcesses.clear();
    for (const [, client] of this.runningCodexClients) client.dispose();
    this.runningCodexClients.clear();
    if (this.pluginExecutionLease) {
      this.app.workspace.detachLeavesOfType(VIEW_TYPE);
      this.releasePluginExecution(!!unresolved);
    }
    if (mayReleaseAfterWrites || drainingSharedSessions) {
      try {
        const settled=await Promise.allSettled([...this.sharedCompletions]);
        if(settled.some(result=>result.status==="rejected"))throw new Error("Shared execution drain is uncertain; reservation retained");
        await Promise.all([this.settingsWriter.drain(), closingRequestHost?.drain()]);
        if (this.pluginExecutionLease === drainingLease) {
          if(drainingSharedSessions && !this.sharedWorkflowExecutions.size && !this.legacyAttempts.size && !this.runningProcesses.size && !this.runningCodexClients.size && !this.workflowDelayControllers.size && !this.startupPending) {
            assertInstalledExecutionIdle(this.selectedExecutionLocation().installationDirectory);
          } else this.assertPluginCanRelease();
          this.releasePluginExecution(false);
        }
      } catch (error) { console.warn("AutoOC retained execution reservation after pending writes", error); }
    }
    // Retain this host on an uncertain drain so a later release cannot forget
    // its pending publication. No callback may write after lease release.
    if (closingRequestHost && !closingRequestHost.hasPendingWork && this.cliRequestHost === closingRequestHost) this.cliRequestHost = undefined;
    if (this.pluginExecutionLease) {
      const lease = this.pluginExecutionLease;
      stoppedLeaseOwners.set(lease.token, (runtime, maintenance = false) => {
        if (!samePhysicalPath(lease.directory, runtime)) throw new Error('Previous AutoOC installation changed');
        if (!this.lifecycleStopped || this.startupPending || this.sharedCompletions.size || this.pluginExecutionLease !== lease) throw new Error('Previous AutoOC instance is still stopping');
        lease.assertOwned();
        if (maintenance) this.assertPackageUpdateIdle(true);
        else this.assertPluginCanRelease();
        this.releasePluginExecution(false);
      });
    }
    await closingBridge;
  }

  private stopStartupWait(): void {
    this.startupWaitGeneration++;
    if (this.startupWaitTimer !== undefined) window.clearInterval(this.startupWaitTimer);
    this.startupWaitTimer = undefined;
  }

  private waitForExecutionOwner(): boolean {
    try {
      const location = this.selectedExecutionLocation(false);
      const owner = readExecutionLeaseOwner(location.runtimeDirectory);
      // A confirmed external owner may finish normally. Unknown/dead owners
      // still require the existing explicit recovery path.
      if (owner.pid === process.pid) return false;
      process.kill(owner.pid, 0);
      const plugins = (this.app as any).plugins;
      if (!plugins?.disablePlugin || !plugins?.enablePlugin) return false;
      const generation = this.startupWaitGeneration;
      let absentSince: number | undefined;
      this.startupWaitTimer = window.setInterval(async () => {
        if (this.startupRecoveryDisposed || generation !== this.startupWaitGeneration) return;
        try {
          const current = this.selectedExecutionLocation(false);
          if (!samePhysicalPath(current.runtimeDirectory, location.runtimeDirectory)) {
            this.stopStartupWait();
            return;
          }
          try {
            fs.lstatSync(path.join(current.runtimeDirectory, 'execution.lock'));
            absentSince = undefined;
            return;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          }
          const now = Date.now();
          if (absentSince === undefined || now < absentSince) { absentSince = now; return; }
          // Two separate observations avoid reloading during lease handover.
          if (now - absentSince < 500) return;
          this.stopStartupWait();
          await this.retryLoadingAutoOC();
        } catch (error) {
          this.stopStartupWait();
          new Notice('AutoOC: automatic loading stopped. Retry loading AutoOC. ' + String(error));
        }
      }, 1000);
      this.registerInterval(this.startupWaitTimer);
      return true;
    } catch { return false; }
  }

  private retryLoadingAutoOC(): Promise<void> {
    if (this.startupRetry) return this.startupRetry;
    if (this.startupRecoveryDisposed) return Promise.reject(new Error('AutoOC instance is stopped'));
    this.stopStartupWait();
    const plugins = (this.app as any).plugins;
    // Both the manual button and the waiter share one reload. Reloading never
    // removes another owner's reservation or resumes a workflow.
    this.startupRetry = Promise.resolve().then(async () => {
      if (this.startupRecoveryDisposed) throw new Error('AutoOC instance is stopped');
      await plugins.disablePlugin(this.manifest.id);
      await plugins.enablePlugin(this.manifest.id);
    }).finally(() => { this.startupRetry = undefined; });
    return this.startupRetry;
  }

  private registerRecoveryInterface(): void {
    let sameProcessOwner = false;
    try {
      const owner = readExecutionLeaseOwner(this.selectedExecutionLocation(false).runtimeDirectory);
      sameProcessOwner = owner.pid === process.pid && owner.token !== this.pluginExecutionLease?.token;
    } catch { /* Keep the original recovery diagnosis. */ }
    const open = async () => {
      const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
      const leaf = existing || this.app.workspace.getLeaf(true);
      await leaf.setViewState({type: VIEW_TYPE, active: true});
      await this.app.workspace.revealLeaf(leaf);
    };
    this.registerView(VIEW_TYPE, leaf => new AutoOCRecoveryView(leaf, this.startupError!,
      () => this.retryLoadingAutoOC(), this.closedSessionRecovery(), this.startupWaitingForOwner, sameProcessOwner,
      () => readPanelCatalog(this.selectedExecutionLocation(false).configurationFile), async () => {
        await this.checkForUpdates(true);
        if (this.updateCheckError) throw new Error(this.updateCheckError);
        if (this.updateAvailable) await this.updatePlugin();
        else new Notice(`AutoOC: already up to date (v${this.manifest.version}).`);
      }, () => this.openBlockedExecutionsReview()));
    this.addRibbonIcon("workflow", "Open AutoOC", () => { void open(); });
    this.addCommand({id: "open-auto-oc", name: "Open AutoOC", callback: () => { void open(); }});
    this.addCommand({id: "resolve-blocked-executions", name: "Resolve blocked executions", callback: () => this.openBlockedExecutionsReview()});
    new Notice(this.startupWaitingForOwner
      ? "AutoOC is open for consultation while another execution owns the engine."
      : "AutoOC: execution needs attention. Open the panel to consult the saved catalog and the diagnosis.", 10000);
  }

  private closedSessionRecovery(): (() => void) | undefined {
    try {
      const location = this.selectedExecutionLocation(false);
      if (!hasCompleteInstalledRelease(location.installationDirectory, PLUGIN_BUILD_VERSION) ||
          fs.existsSync(path.join(location.runtimeDirectory, 'update-pending.json'))) return;
      // Releasing a dead execution owner cannot repair an unrelated save.
      // Keep consultation available without offering a misleading retry loop.
      assertPackageMaintenanceSafe(location.installationDirectory);
      const owner = readExecutionLeaseOwner(location.runtimeDirectory);
      try { process.kill(owner.pid, 0); return; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') return; }
      // This explicit UI action has the same contract as CLI recover-lease:
      // archive only the exact absent owner; preserve all uncertain run state.
      return () => {
        const current = this.selectedExecutionLocation(false);
        if (!samePhysicalPath(current.runtimeDirectory, location.runtimeDirectory) ||
            !hasCompleteInstalledRelease(current.installationDirectory, PLUGIN_BUILD_VERSION) ||
            fs.existsSync(path.join(current.runtimeDirectory, 'update-pending.json'))) throw new Error('Installation changed; retry loading AutoOC');
        assertPackageMaintenanceSafe(current.installationDirectory);
        recoverExecutionLease(current.runtimeDirectory, owner.token);
      };
    } catch { return; }
  }

  // Reserve the vault for the whole plugin lifetime, including legacy tasks
  // whose asynchronous completion outlives runTask/runWorkflow. The external
  // host uses this same lease, so opening the plugin cannot race its effects.
  private selectedExecutionLocation(requireOwnership = true): InstalledWorkflowLocation {
    const base = (this.app.vault.adapter as any).basePath;
    if (!base) throw new Error("AutoOC execution requires a local vault");
    const configDir = this.app.vault.configDir, id = this.manifest?.id;
    if (!configDir || path.isAbsolute(configDir) || !id || /[\\/:]/.test(id)) throw new Error("Invalid selected installation");
    const location = resolveInstalledWorkflowLocation(base, `${configDir}/plugins/${id}`);
    if (this.pluginExecutionLease) {
      if (requireOwnership) this.pluginExecutionLease.assertOwned();
      if (!this.pluginExecutionLocation || !samePhysicalPath(location.installationDirectory,this.pluginExecutionLocation.installationDirectory) ||
          !samePhysicalPath(this.pluginExecutionLease.directory,location.runtimeDirectory)) {
        throw new Error("Selected installation changed while reserved; reload safely");
      }
    }
    return this.pluginExecutionLocation || location;
  }

  reservePluginExecution() {
    this.assertLifecycleOpen();
    const location = this.selectedExecutionLocation();
    if (this.pluginExecutionLease) return;
    ensureInstalledWorkflowRuntime(location);
    try { this.pluginExecutionLease = acquireExecutionLease(location.runtimeDirectory); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        const owner = readExecutionLeaseOwner(location.runtimeDirectory);
        const relinquish = owner.pid === process.pid ? stoppedLeaseOwners.get(owner.token) : undefined;
        if (relinquish) relinquish(location.runtimeDirectory);
        else recoverExecutionLease(location.runtimeDirectory, owner.token, () => {
          try { assertInstalledExecutionIdle(location.installationDirectory); }
          catch (error) {
            try { this.assertClosedObservation(owner.token); }
            catch { throw error; }
          }
        });
      } catch (recoveryError) {
        // Preserve the public exclusion code while explaining why recovery was denied.
        (recoveryError as NodeJS.ErrnoException).code ||= "EEXIST";
        throw recoveryError;
      }
      this.pluginExecutionLease = acquireExecutionLease(location.runtimeDirectory);
    }
    this.pluginExecutionLocation = location;
  }

  releasePluginExecution(unresolved: boolean) {
    if (!this.pluginExecutionLease) return;
    // kill()/dispose() requests do not prove external effects have stopped.
    if (unresolved || this.cliRequestHost?.hasPendingWork) return;
    this.pluginExecutionLease.release();
    stoppedLeaseOwners.delete(this.pluginExecutionLease.token);
    this.pluginExecutionLease = undefined;
    this.pluginExecutionLocation = undefined;
  }

  isWorkflowExecuting(workflowId:string):boolean {
    if (this.sharedExecution(workflowId)) return true;
    const workflow=this.settings.workflows.find(item=>item.id===workflowId);
    return !!workflow && (!(workflow as any).runtimeExecution || !!workflow.legacyExecution) && workflow.status === "running";
  }

  sharedWorkflowRecoveryMode(workflowId:string, expectedRunId:string):"resume"|"reconcile"|"blocked" {
    const workflow=this.settings.workflows.find(item=>item.id===workflowId);
    const execution=(workflow as any)?.runtimeExecution;
    if (!execution || execution.runId !== expectedRunId) throw new Error("Recovery identity changed; reload the workflow");
    if (!["ready","in_flight"].includes(execution.phase)) throw new Error("Execution does not require recovery");
    const checkpoint=readExecutionCheckpoint(this.selectedExecutionLocation().runtimeDirectory,expectedRunId);
    const recovered=recoverWorkflowProgress(workflow,this.settings.tasks,this.settings,checkpoint,expectedRunId);
    if(recovered.runtimeExecution.definitionChanged)return "blocked";
    if (!["ready","in_flight"].includes(checkpoint.phase)) throw new Error("Execution does not require recovery");
    if (checkpoint.phase === "ready") return "resume";
    const last=checkpoint.steps[checkpoint.steps.length-1];
    if (last.evaluations?.some(item=>item.status === "in_flight")) return "blocked";
    return last.result ? "resume" : "reconcile";
  }

  async recoverSharedWorkflow(workflowId:string, expectedRunId:string) {
    const mode=this.sharedWorkflowRecoveryMode(workflowId,expectedRunId);
    if (mode === "blocked") throw new Error("Interrupted evaluation requires reconciliation; it cannot be replayed");
    return await this.runSharedWorkflow(workflowId,expectedRunId,mode === "reconcile");
  }

  private startCliRequests(): void {
    this.assertLifecycleOpen();
    this.cliRequestHost = createPluginRequestHost(this.pluginExecutionLease!, async (request, signal, progress) => {
      this.assertLifecycleOpen();
      try {
        return await this.runSharedWorkflow(request.taskId ? standaloneTaskWorkflow(request.taskId).id : request.workflowId!,
          request.runId, request.command === "reconcile", request.command === "run", request.taskId, {signal,progress}, request.stepId);
      } catch (error) {
        if (!this.lifecycleStopped) new Notice(`AutoOC: CLI request failed — ${this.redactSecrets(String(error))}`);
        throw error;
      }
    }, async request => {
      const assertIdle=()=>{
        this.assertLifecycleOpen();this.pluginExecutionLease!.assertOwned();
        if(this.updateInProgress || this.bulkCatalogMutationInProgress || this.sharedWorkflowExecution || this.runningProcesses.size || this.runningCodexClients.size || this.workflowDelayControllers.size || this.legacyAttempts.size)throw new Error("Execution active; wait for AutoOC to finish, keeping Obsidian open");
        assertIdleCatalog(this.settings,assertIdleJournals(this.selectedExecutionLocation().runtimeDirectory));
      };
      assertIdle();this.workflowEditPending=true;
      try {
        const result=await applyWorkflowEdit({settings:this.settings,assertIdle,save:validate=>this.saveSettings(false,validate)},request);
        this.refreshOpenViews();return result;
      } finally {this.workflowEditPending=false;}
    },()=>this.settings);
  }

  async runSharedWorkflow(workflowId:string, resumeRunId?:string, reconcile=false, newExecution=false, taskId?:string,
      external?: {signal:AbortSignal;progress:(checkpoint:RunCheckpoint,presentation?:ExecutionPresentation)=>void|Promise<void>}, stepId?:string) {
    const kind = taskId ? "task" : "workflow", id = taskId || workflowId;
    if (this.definitionStarts?.has(`${kind}:${id}`)) throw new Error("A shared workflow is already executing; definition is already starting");
    const pending = this.withDefinitionStart(kind, id,
      release => this.executeSharedWorkflow(workflowId, resumeRunId, reconcile, newExecution, taskId, external, release, stepId));
    this.sharedCompletions.add(pending);
    try { return (await pending)!; }
    finally { this.sharedCompletions.delete(pending); }
  }

  private async executeSharedWorkflow(workflowId:string, resumeRunId?:string, reconcile=false, newExecution=false, taskId?:string,
      external?: {signal:AbortSignal;progress:(checkpoint:RunCheckpoint,presentation?:ExecutionPresentation)=>void|Promise<void>}, releaseStart?: () => void, stepId?:string) {
    if(taskId && workflowId!==standaloneTaskWorkflow(taskId).id)throw new Error("Standalone task identity mismatch");
    let selected = taskId ? standaloneTaskWorkflow(taskId) : this.settings.workflows.find(w => w.id === workflowId);
    if (stepId && selected) selected = selectCodeStep(selected, stepId);
    if (selected) {
      assertWorkflowDependencies(selected, this.settings.tasks);
      if (!reconcile) assertWorkflowEnabled(selected, this.settings.tasks);
    }
    this.beginExecutionEffects();
    this.assertLifecycleOpen();
    if (this.updateInProgress) throw new Error("Plugin update is in progress");
    if (!this.pluginExecutionLease) throw new Error("Plugin execution reservation is required");
    const location = this.selectedExecutionLocation();
    if (this.sharedExecution(workflowId)) throw new Error("A shared workflow is already executing");
    if (Array.from(this.legacyAttempts?.values() || []).some(attempt => !attempt.cancelled) ||
        this.runningProcesses.size || this.runningCodexClients.size || this.workflowDelayControllers.size) {
      throw new Error("Legacy tasks must finish before shared execution");
    }
    const execution = {workflowId,taskId,runId:undefined as string | undefined,controller:new AbortController(),checkpoint:undefined as RunCheckpoint | undefined,liveOutput:undefined as WorkflowTaskOutput | undefined};
    this.sharedWorkflowExecutions.set(workflowId,execution);
    const abort = () => execution.controller.abort();
    external?.signal.addEventListener("abort", abort, {once:true});
    if (external?.signal.aborted) abort();
    let expectedSettings: ReturnType<typeof captureJsonStructure> | undefined;
    let lastCatalog: PersistedWorkflowCatalog | undefined, executionFailed = false;
    try {
      await this.saveSettings(false);
      if(this.sharedSettingsBaseline && !matchesJsonStructure(this.settings,this.sharedSettingsBaseline))throw new Error("AutoOC settings changed during save; local edits preserved; reload before continuing");
      expectedSettings = captureJsonStructure(this.settings);
      this.sharedSettingsBaseline = expectedSettings;
      return await runInstalledWorkflow({
        vault:location.vault, installationDirectory:location.installationDirectory, workflowId:taskId ? undefined : workflowId,taskId,stepId,resumeRunId,reconcile,newExecution,
        lease:this.pluginExecutionLease, signal:execution.controller.signal,includePresentation:!!external,
        catalogWriter:this.settingsWriter.fork(),
        catalogVersion:()=>this.settingsWriter.confirmedVersion(location.configurationFile),
        vaultMutations:()=>this.createVaultMutationBatch(),
        redact:output=>this.redactSecrets(output),
        onTaskOutput:event=>{
          if (this.lifecycleStopped || this.sharedWorkflowExecutions.get(workflowId) !== execution || execution.controller.signal.aborted ||
              event.runId !== execution.runId || event.workflowId !== workflowId) return;
          execution.liveOutput = event;
        },
        onCheckpoint:async (checkpoint,catalog,presentation,transaction)=>{
          if(this.lifecycleStopped) {
            if(catalog)await this.settingsWriter.adoptConfirmed(location.configurationFile,catalog.version,()=>true);
            return;
          }
          if (this.sharedWorkflowExecutions.get(workflowId) !== execution || checkpoint.workflowId !== workflowId) return;
          if (execution.runId && checkpoint.runId !== execution.runId || execution.checkpoint && checkpoint.revision < execution.checkpoint.revision) return;
          if (catalog && (catalog.runId !== checkpoint.runId || catalog.workflowId !== checkpoint.workflowId || catalog.revision !== checkpoint.revision)) {
            throw new Error("Confirmed catalog progress identity mismatch");
          }
          if (!expectedSettings || !matchesJsonStructure(this.settings,this.sharedSettingsBaseline || expectedSettings)) {
            throw new Error("AutoOC settings changed during execution; local edits preserved; reload before continuing");
          }
          execution.runId = checkpoint.runId;
          execution.checkpoint = JSON.parse(JSON.stringify(checkpoint));
          if (catalog) await this.loadSettingsSnapshot(catalog,transaction);
          else await this.loadSettings(transaction);
          lastCatalog = catalog;
          expectedSettings = captureJsonStructure(this.settings);
          this.sharedSettingsBaseline = expectedSettings;
          releaseStart?.();
          if (this.sharedWorkflowExecutions.get(workflowId) !== execution) return;
          this.refreshOpenViews();
          await external?.progress(checkpoint,presentation);
        },
      });
    } catch (error) { executionFailed = true; throw error; }
    finally {
      external?.signal.removeEventListener("abort", abort);
      const stillOwned = this.sharedWorkflowExecutions.get(workflowId) === execution;
      if (stillOwned) this.sharedWorkflowExecutions.delete(workflowId);
      // Reproject the last confirmed snapshot after ownership ends. Do not
      // overwrite a local edit or mask the original execution/storage error.
      if (stillOwned && !this.lifecycleStopped && expectedSettings && matchesJsonStructure(this.settings,this.sharedSettingsBaseline || expectedSettings)) {
        try {
          await catalogTransaction(location.configurationFile,async transaction=>{
            if(lastCatalog && !this.sharedWorkflowExecutions.size && this.sharedSettingsBaseline === expectedSettings) await this.loadSettingsSnapshot(lastCatalog,transaction);
            else await this.loadSettings(transaction);
            this.sharedSettingsBaseline=captureJsonStructure(this.settings);
            this.refreshOpenViews();
          });
        } catch (error) {
          if (!executionFailed) throw error;
          console.warn("AutoOC: final catalog refresh could not be confirmed.");
        }
      }
    }
  }

  ownsExecution(workflowId:string,runId:string):boolean {return this.ownsSharedRun(workflowId,runId);}

  codeStepState(workflowId:string, stepId:string) {
    const workflow = this.settings.workflows.find(item => item.id === workflowId);
    const step = workflow?.steps.find(item => item.id === stepId && item.stepKind === "code");
    if (!workflow || !step) throw new Error("Code step no longer exists. Refresh the panel.");
    const execution = this.sharedExecution(workflowId), checkpoint = execution?.checkpoint;
    const active = checkpoint?.phase === "in_flight" && checkpoint.nextStepId === stepId && this.ownsSharedRun(workflowId, checkpoint.runId);
    const live = active && execution?.liveOutput?.stepId === stepId ? execution.liveOutput.output : undefined;
    return {workflow, step, ...codeStepDisplay(step), ...(active ? {status:"running"} : {}),
      log: live ?? codeStepDisplay(step).output,
      stop: active ? {runId:checkpoint!.runId, stepIndex:checkpoint!.steps.length-1} : undefined};
  }

  openCodeStepHistory(workflowId:string, stepId:string) {
    const {step} = this.codeStepState(workflowId, stepId);
    new CodeStepHistoryModal(this.app, this.selectedExecutionLocation().runtimeDirectory, workflowId, stepId, step.name || "Code step",
      (title, output) => new TextPreviewModal(this.app, title, output).open()).open();
  }

  async runCodeStepOnly(workflowId:string, stepId:string) {
    this.codeStepState(workflowId, stepId);
    return this.runSharedWorkflow(workflowId, undefined, false, true, undefined, undefined, stepId);
  }

  async stopCodeStep(workflowId:string, stepId:string, observed:{runId:string;stepIndex:number}) {
    const state = this.codeStepState(workflowId, stepId);
    if (!state.stop || state.stop.runId !== observed.runId || state.stop.stepIndex !== observed.stepIndex) {
      throw new Error("Step execution changed; refresh before stopping.");
    }
    this.sharedExecution(workflowId, undefined, observed.runId)!.controller.abort();
    new Notice("Stop requested. Commands already started may still have effects.");
  }

  async setCodeStepDisabled(workflowId:string, stepId:string, disabled:boolean) {
    const save = async (transaction?:CatalogTransaction) => {
      this.assertLifecycleOpen();
      if (this.updateInProgress || this.workflowEditPending || this.bulkCatalogMutationInProgress || this.sharedWorkflowExecution || this.definitionStarts.size) throw new Error("Wait for active work or saving to finish.");
      const {step} = this.codeStepState(workflowId, stepId);
      if (this.getDefinitionStartState("workflow", workflowId) !== "available") throw new Error("Wait for the workflow to finish or resolve its interrupted attempt.");
      this.bulkCatalogMutationInProgress = true;
      const previous = step.disabled;
      try { step.disabled = disabled; await this.saveSettings(false, undefined, transaction); }
      catch(error) { step.disabled = previous; throw error; }
      finally { this.bulkCatalogMutationInProgress = false; }
    };
    if ((this.app.vault.adapter as any).basePath) await this.settingsWriter.trackTransaction(catalogTransaction(this.selectedExecutionLocation().configurationFile, save));
    else await save();
    this.refreshOpenViews();
  }

  async resolveCodeStepAttempt(workflowId:string, stepId:string) {
    const location = this.selectedExecutionLocation();
    const {workflow} = this.codeStepState(workflowId, stepId);
    const observed = readCodeStepCheckpoint(location.runtimeDirectory, workflow, stepId);
    if (!observed) return;
    if (["completed", "failed"].includes(observed.phase)) return this.confirmTerminalDisposition(workflowId, observed.runId);
    if (observed.phase === "abandoned") return;
    const modal = new ConfirmModal(this.app, "Close interrupted step attempt?",
      "This keeps the history and records any effects as unknown. It does not repeat the step or undo changes. Verify that external commands have stopped, then enter your reason.", true);
    if (!await modal.openAndWait()) return;
    this.assertLifecycleOpen();
    if (!this.pluginExecutionLease || this.sharedWorkflowExecution || this.definitionStarts.size || this.runningProcesses.size || this.legacyAttempts.size || this.updateInProgress) throw new Error("Wait for active work to finish.");
    const reservation = {workflowId, runId:observed.runId, controller:new AbortController()};
    this.sharedWorkflowExecution = reservation;
    try {
      await this.saveSettings(false);
      await abandonInstalledExecution({vault:location.vault, installationDirectory:location.installationDirectory, workflowId, runId:observed.runId,
        revision:observed.revision, reason:modal.reason, acknowledgedUnknownEffects:true, lease:this.pluginExecutionLease});
    } finally { if (this.sharedWorkflowExecution === reservation) this.sharedWorkflowExecution = undefined; await this.loadSettings(); this.refreshOpenViews(); }
  }

  private ownsSharedRun(workflowId:string, runId:string):boolean {
    if (!this.sharedExecution(workflowId,undefined,runId) || !this.pluginExecutionLease) return false;
    try { this.pluginExecutionLease.assertOwned(); return true; } catch { return false; }
  }

  taskLogOutput(task:ScheduledTask):string {
    const execution=this.sharedExecution((task as any).runtimeExecution?.workflowId,undefined,(task as any).runtimeExecution?.runId),live=execution?.liveOutput,state=execution?.checkpoint;
    const binding=(task as any).runtimeExecution;
    if (!this.lifecycleStopped && live && state?.phase === "in_flight" && task.status === "running" &&
        live.taskId === task.id && live.runId === state.runId && live.workflowId === state.workflowId &&
        live.stepIndex === state.steps.length - 1 && live.stepId === state.steps[live.stepIndex]?.stepId &&
        binding?.runId === live.runId && binding.stepIndex === live.stepIndex && binding.stepId === live.stepId) return live.output;
    return task.output || "";
  }

  // Ephemeral ownership is keyed by canonical identity, never persisted.
  private definitionStarts = new Map<string, symbol>();

  getDefinitionStartState(kind: "task" | "workflow", id: string, ignoreCatalogMutation = false): "available" | "starting" | "active" | "blocked" {
    if (this.bulkCatalogMutationInProgress && !ignoreCatalogMutation) return "starting";
    if (this.definitionStarts?.has(`${kind}:${id}`)) return "starting";
    const item = kind === "task" ? this.settings.tasks.find(t => t.id === id) : this.settings.workflows.find(w => w.id === id);
    if (!item) return "blocked";
    if (kind === "task" ? this.isTaskActive(item as ScheduledTask) : this.isWorkflowExecuting(id)) return "active";
    const binding = (item as any).runtimeExecution;
    if (kind === "workflow" && (item as Workflow).steps.some(step => {
      const run = step.codeExecution?.runtimeExecution;
      return run && run.phase !== "abandoned" && (run.requiresReconciliation || !["completed","failed"].includes(run.phase) || run.terminalUncertainty && !run.disposition);
    })) return "blocked";
    if ((item as ScheduledTask).legacyExecution?.stopState || kind === "workflow" && this.hasUncertainLegacyTask(id) || binding && (binding.requiresReconciliation ||
        !["completed", "failed", "abandoned"].includes(binding.phase) || binding.phase !== "abandoned" && binding.terminalUncertainty && !binding.disposition)) return "blocked";
    return "available";
  }

  definitionDisabledReason(kind: CatalogKind, id: string): string | undefined {
    if (kind === "task") return taskDisabledReason(this.settings.tasks.find(item => item.id === id));
    const workflow = this.settings.workflows.find(item => item.id === id);
    return workflow ? workflowDisabledReason(workflow, this.settings.tasks) : undefined;
  }

  private hasUncertainLegacyTask(workflowId: string): boolean {
    const workflow = this.settings.workflows.find(item => item.id === workflowId);
    return this.settings.tasks.some(task => task.legacyExecution?.workflowId === workflowId && !!task.legacyExecution.stopState &&
      workflow?.steps.some(step => (!step.stepKind || step.stepKind === "task") && step.taskId === task.id));
  }

  configureStartButton(button: HTMLButtonElement, kind: "task" | "workflow", id: string, compact: boolean): void {
    button.setAttr("data-autooc-start-kind", kind);
    button.setAttr("data-autooc-start-id", id);
    button.setAttr("data-autooc-start-compact", String(compact));
    const state = this.getDefinitionStartState(kind, id);
    const disabledReason = this.definitionDisabledReason(kind, id);
    const label = disabledReason || (state === "starting" ? "Iniciando…" : state === "active" ? "Running…" : state === "blocked" ? "Recovery required" : kind === "task" ? "Run" : "Run Workflow");
    button.disabled = !!disabledReason || state !== "available";
    button.textContent = disabledReason ? (compact ? "▶" : "Disabled") : state === "starting" ? "⏳ Iniciando…" : compact ? "▶" : `▶ ${label}`;
    button.title = label;
    button.setAttr("aria-label", label);
    button.setAttr("aria-busy", String(state === "starting"));
  }

  private refreshStartControls(): void {
    // Update only Play controls: no catalog writes, rendering, or dashboard work.
    for (const leaf of this.app?.workspace?.getLeavesOfType?.(VIEW_TYPE) || []) {
      const buttons = leaf.view.containerEl?.querySelectorAll<HTMLButtonElement>("button[data-autooc-start-kind]");
      buttons?.forEach(button => this.configureStartButton(button,
        button.getAttribute("data-autooc-start-kind") as "task" | "workflow",
        button.getAttribute("data-autooc-start-id")!, button.getAttribute("data-autooc-start-compact") === "true"));
    }
  }

  private async withDefinitionStart<T>(kind: "task" | "workflow", id: string, execute: (release: () => void) => Promise<T>, onBusy?: () => Promise<T>): Promise<T | undefined> {
    this.assertLifecycleOpen();
    if (this.bulkCatalogMutationInProgress) throw new Error("Catalog changes are being saved. Try again shortly.");
    if (this.updateInProgress) throw new Error("Plugin update is in progress");
    const key = `${kind}:${id}`;
    this.definitionStarts ||= new Map();
    if (this.definitionStarts.has(key)) return onBusy ? await onBusy() : undefined;
    const token = Symbol(key);
    this.definitionStarts.set(key, token);
    const release = () => {
      if (this.definitionStarts.get(key) === token) this.definitionStarts.delete(key);
    };
    try {
      this.refreshStartControls();
      return await execute(release);
    } finally {
      // Fire-and-forget adapters retain the indicator until their initial save
      // settles. Their attempt already owns exclusion throughout this interval.
      if (kind !== "task" || this.legacyAttempts?.get(id)?.releaseStart !== release) release();
      // A view failure must not mask an execution/storage failure.
      try { this.refreshStartControls(); } catch { console.warn("AutoOC: Play controls could not refresh."); }
    }
  }

  private refreshOpenViews():void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof AutoOCView) leaf.view.refresh();
    }
  }

  getDashboardBubbleDiameter(): number {
    return loadDashboardBubbleDiameter(this.app, this.manifest.id, this.settings);
  }

  saveDashboardBubbleDiameter(diameter: number): void {
    this.assertLifecycleOpen();
    saveDashboardBubbleDiameter(this.app, this.manifest.id, diameter);
  }

  applyDashboardBubbleDiameter(diameter: number): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof AutoOCView) applyDashboardBubbleDiameter(leaf.view.containerEl, diameter);
    }
  }

  private getMcpBridgePath(): string {
    const vaultBasePath = (this.app.vault.adapter as any).basePath || ".";
    return path.join(vaultBasePath, ".obsidian", "plugins", "auto-oc", "mcp-bridge.json");
  }

  private async startMcpBridge(): Promise<void> {
    // Retired in 1.6.2: no listener, descriptor or client configuration changes.
  }

  private async stopMcpBridge(): Promise<void> {
    const server = this.mcpBridgeServer;
    this.mcpBridgeServer = undefined;
    this.mcpBridgeToken = "";
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  private findTaskByIdOrName(idOrName: string): ScheduledTask | undefined {
    return this.settings.tasks.find((task) => task.id === idOrName || task.name === idOrName);
  }

  private isTaskActive(task: ScheduledTask): boolean {
    if (this.sharedExecution(undefined,task.id)) return true;
    const canonical = this.settings.tasks.find((t) => t.id === task.id);
    return !!this.legacyAttempts?.get(task.id) && !this.legacyAttempts.get(task.id)!.cancelled || canonical?.status === "running" || this.runningProcesses.has(task.id);
  }

  private getMcpRawWorkflowReferenceError(payload: unknown): string | null {
    if (!payload || typeof payload !== "object" || "autoOCExport" in payload) return null;
    const steps = (payload as { steps?: unknown }).steps;
    if (!Array.isArray(steps)) return null;
    for (const step of steps) {
      if (!step || typeof step !== "object") continue;
      const s = step as { stepKind?: unknown };
      const stepKind = typeof s.stepKind === "string" ? s.stepKind : "task";
      if (stepKind === "task") {
        return "Raw workflow payload task steps are not supported; send a full AutoOC export with task mappings.";
      }
    }
    return null;
  }

  private isMcpObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  private getMcpScheduleValidationError(prefix: string, payload: Record<string, unknown>): string | null {
    const scheduleTypes: ScheduleType[] = ["manual", "once", "daily", "weekly", "monthly", "interval"];
    const intervalUnits: IntervalUnit[] = ["seconds", "minutes", "hours"];
    if (payload.scheduleType !== undefined && (typeof payload.scheduleType !== "string" || !scheduleTypes.includes(payload.scheduleType as ScheduleType))) {
      return `${prefix}.scheduleType must be one of: ${scheduleTypes.join(", ")}.`;
    }
    if (payload.scheduleTime !== undefined && typeof payload.scheduleTime !== "string") return `${prefix}.scheduleTime must be a string.`;
    if (payload.scheduleDate !== undefined && typeof payload.scheduleDate !== "string") return `${prefix}.scheduleDate must be a string.`;
    if (payload.scheduleDays !== undefined && (!Array.isArray(payload.scheduleDays) || payload.scheduleDays.some((day) => typeof day !== "number" || day < 0 || day > 6))) {
      return `${prefix}.scheduleDays must be an array of numbers from 0 to 6.`;
    }
    if (payload.scheduleMonthDays !== undefined && (!Array.isArray(payload.scheduleMonthDays) || payload.scheduleMonthDays.some((day) => typeof day !== "number" || day < 1 || day > 31))) {
      return `${prefix}.scheduleMonthDays must be an array of numbers from 1 to 31.`;
    }
    if (payload.scheduleIntervalValue !== undefined && (typeof payload.scheduleIntervalValue !== "number" || !Number.isFinite(payload.scheduleIntervalValue))) {
      return `${prefix}.scheduleIntervalValue must be a finite number.`;
    }
    if (payload.scheduleIntervalUnit !== undefined && (typeof payload.scheduleIntervalUnit !== "string" || !intervalUnits.includes(payload.scheduleIntervalUnit as IntervalUnit))) {
      return `${prefix}.scheduleIntervalUnit must be one of: ${intervalUnits.join(", ")}.`;
    }
    return null;
  }

  private getMcpRawTaskPayloadError(payload: Record<string, unknown>): string | null {
    if ("steps" in payload) return "Raw task payloads must not include workflow steps; use kind \"workflow\".";
    const taskKind = typeof payload.taskKind === "string" ? payload.taskKind : "opencode";
    if (!["opencode", "opencode2", "codex", "copilot", "code"].includes(taskKind)) return "payload.taskKind must be opencode, opencode2, codex, copilot, or code.";
    const copilotError = getCopilotTaskValidationError(payload);
    if (copilotError) return copilotError;
    if (payload.reasoningEffort !== undefined && (taskKind !== "codex" || typeof payload.reasoningEffort !== "string" || !payload.reasoningEffort.trim())) {
      return "payload.reasoningEffort is only valid as a non-empty string for taskKind \"codex\".";
    }
    if (payload.interactiveTerminal !== undefined && typeof payload.interactiveTerminal !== "boolean") return "payload.interactiveTerminal must be a boolean when provided.";
    if (taskKind === "code" && payload.interactiveTerminal === true) return "Code tasks cannot use interactiveTerminal.";
    if (typeof payload.name !== "string" || !payload.name.trim()) return "payload.name is required for raw task payloads.";
    if (taskKind === "code") {
      const hasCode = typeof payload.code === "string" && payload.code.trim();
      const hasPrompt = typeof payload.prompt === "string" && payload.prompt.trim();
      if (!hasCode && !hasPrompt) return "payload.code or payload.prompt is required for raw code task payloads.";
    } else if (typeof payload.prompt !== "string" || !payload.prompt.trim()) {
      return "payload.prompt is required for raw task payloads.";
    }
    return this.getMcpScheduleValidationError("payload", payload);
  }

  private getMcpRawWorkflowPayloadError(payload: Record<string, unknown>): string | null {
    if (typeof payload.name !== "string" || !payload.name.trim()) return "payload.name is required for raw workflow payloads.";
    if (!Array.isArray(payload.steps)) return "payload.steps must be a non-empty array for raw workflow payloads.";
    if (payload.steps.length === 0) return "payload.steps must contain at least one step.";
    const scheduleError = this.getMcpScheduleValidationError("payload", payload);
    if (scheduleError) return scheduleError;

    const stepIds = new Set<string>();
    let hasTransitions = false;
    for (let i = 0; i < payload.steps.length; i++) {
      const step = payload.steps[i];
      const prefix = `payload.steps[${i}]`;
      if (!this.isMcpObject(step)) return `${prefix} must be an object.`;
      if (typeof step.id === "string" && step.id.trim()) stepIds.add(step.id);
      const stepKind = typeof step.stepKind === "string" ? step.stepKind : "task";
      if (stepKind === "task") return "Raw workflow payload task steps are not supported; send a full AutoOC export with task mappings.";
      if (stepKind !== "delay" && stepKind !== "code") return `${prefix}.stepKind must be \"delay\" or \"code\" for raw workflow payloads.`;
      if (stepKind === "delay") {
        if (step.delayValue !== undefined && (typeof step.delayValue !== "number" || !Number.isFinite(step.delayValue))) return `${prefix}.delayValue must be a finite number.`;
        if (step.delayUnit !== undefined && (typeof step.delayUnit !== "string" || !["seconds", "minutes", "hours"].includes(step.delayUnit))) return `${prefix}.delayUnit must be one of: seconds, minutes, hours.`;
      }
      if (stepKind === "code" && (typeof step.code !== "string" || !step.code.trim())) return `${prefix}.code is required for raw code workflow steps.`;
      if (step.transitions !== undefined) {
        if (!Array.isArray(step.transitions)) return `${prefix}.transitions must be an array.`;
        if (step.transitions.length > 0) hasTransitions = true;
        for (let j = 0; j < step.transitions.length; j++) {
          const transition = step.transitions[j];
          const transitionPrefix = `${prefix}.transitions[${j}]`;
          if (!this.isMcpObject(transition)) return `${transitionPrefix} must be an object.`;
          if (typeof transition.toStepId !== "string" || !transition.toStepId.trim()) return `${transitionPrefix}.toStepId is required.`;
          if (transition.mode !== "default" && transition.mode !== "force" && transition.mode !== "eval" && transition.mode !== "conditional") {
            return `${transitionPrefix}.mode must be one of: default, force, eval, conditional.`;
          }
        }
      }
    }
    if (hasTransitions) {
      if (stepIds.size !== payload.steps.length) return "Raw workflow steps with transitions must each include a unique string id.";
      for (let i = 0; i < payload.steps.length; i++) {
        const step = payload.steps[i] as Record<string, unknown>;
        for (const transition of (step.transitions as unknown[] | undefined) || []) {
          const toStepId = (transition as { toStepId?: unknown }).toStepId;
          if (typeof toStepId === "string" && !stepIds.has(toStepId)) return `payload.steps[${i}].transitions references unknown step id \"${toStepId}\".`;
        }
      }
    }
    return null;
  }

  private getMcpFullExportKindError(kind: "task" | "workflow", payload: Record<string, unknown>): string | null {
    if (!Array.isArray(payload.tasks)) return "Full AutoOC exports must include a tasks array.";
    if (!Array.isArray(payload.workflows)) return "Full AutoOC exports must include a workflows array.";
    if (kind === "task") {
      if (payload.tasks.length === 0) return "Full task exports must include at least one task.";
      if (payload.workflows.length > 0) return "Full task exports must not include workflows; use kind \"workflow\" for workflow exports.";
    } else {
      if (payload.workflows.length === 0) return "Full workflow exports must include at least one workflow.";
    }
    return null;
  }

  private getMcpCreatePayloadError(kind: "task" | "workflow", payload: unknown): string | null {
    if (!this.isMcpObject(payload)) return "Invalid payload: expected a JSON object.";
    if ("autoOCExport" in payload) return this.getMcpFullExportKindError(kind, payload);
    if (kind === "task") return this.getMcpRawTaskPayloadError(payload);
    const referenceError = this.getMcpRawWorkflowReferenceError(payload);
    return referenceError || this.getMcpRawWorkflowPayloadError(payload);
  }

  private getMcpWorkflowPlayError(workflow: Workflow): { status: number; body: object } | null {
    const wf = this.settings.workflows.find((w) => w.id === workflow.id);
    if (!wf) return { status: 404, body: { ok: false, error: "workflow not found" } };
    if (wf.status === "running") {
      return { status: 409, body: { ok: false, id: wf.id, name: wf.name, status: "conflict", error: `Workflow "${wf.name}" is already running.` } };
    }
    if (wf.steps.length === 0) {
      return { status: 400, body: { ok: false, id: wf.id, name: wf.name, status: "invalid", error: `Workflow "${wf.name}" has no steps.` } };
    }
    const stepIds = new Set<string>();
    for (let i = 0; i < wf.steps.length; i++) {
      const step = wf.steps[i];
      if (typeof step.id !== "string" || !step.id.trim()) {
        return { status: 400, body: { ok: false, id: wf.id, name: wf.name, status: "invalid", error: `Workflow "${wf.name}" — step ${i + 1} must include a unique string id.` } };
      }
      if (stepIds.has(step.id)) {
        return { status: 400, body: { ok: false, id: wf.id, name: wf.name, status: "invalid", error: `Workflow "${wf.name}" — step ${i + 1} duplicates step id "${step.id}".` } };
      }
      stepIds.add(step.id);
      if (step.stepKind === "task" && !this.settings.tasks.find((task) => task.id === step.taskId)) {
        return { status: 404, body: { ok: false, id: wf.id, name: wf.name, status: "invalid", error: `Workflow "${wf.name}" — step ${i + 1} references a deleted task.` } };
      }
    }
    const incoming = new Set<string>();
    for (let i = 0; i < wf.steps.length; i++) {
      const step = wf.steps[i];
      for (const transition of step.transitions || []) {
        if (typeof transition.toStepId !== "string" || !transition.toStepId.trim()) {
          return { status: 400, body: { ok: false, id: wf.id, name: wf.name, status: "invalid", error: `Workflow "${wf.name}" — step ${i + 1} has a transition with a missing target step id.` } };
        }
        if (!stepIds.has(transition.toStepId)) {
          return { status: 400, body: { ok: false, id: wf.id, name: wf.name, status: "invalid", error: `Workflow "${wf.name}" — step ${i + 1} references unknown step id "${transition.toStepId}".` } };
        }
        incoming.add(transition.toStepId);
      }
    }
    if (!wf.steps.some((step) => !incoming.has(step.id))) {
      return { status: 400, body: { ok: false, id: wf.id, name: wf.name, status: "invalid", error: `Workflow "${wf.name}" has no reachable entry step.` } };
    }
    return null;
  }

  private findWorkflowByIdOrName(idOrName: string): Workflow | undefined {
    return this.settings.workflows.find((workflow) => workflow.id === idOrName || workflow.name === idOrName);
  }

  private wrapMcpCreatePayload(kind: string, payload: unknown): AutoOCExportFile | null {
    if (!payload || typeof payload !== "object") return null;
    if ("autoOCExport" in payload) return payload as AutoOCExportFile;
    const autoOCExport = {
      schemaVersion: (payload as ScheduledTask).taskKind === "copilot" ? "1.6.0" : "1.5.0",
      exportedAt: new Date().toISOString(),
      pluginVersion: this.manifest.version,
    };
    return kind === "task"
      ? { autoOCExport, tasks: [{ ...(payload as ScheduledTask), exportId: crypto.randomUUID() }], workflows: [] }
      : { autoOCExport, tasks: [], workflows: [{ ...(payload as Workflow), exportId: crypto.randomUUID() }] };
  }

  private async handleMcpBridgeRequest(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
    const send = (status: number, body: object): void => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(body));
    };
    if (request.method !== "POST") return send(405, { ok: false, error: "POST required" });
    if (request.headers.authorization !== `Bearer ${this.mcpBridgeToken}`) return send(401, { ok: false, error: "Unauthorized" });

    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size <= 1024 * 1024) chunks.push(chunk);
    });
    request.on("error", () => send(400, { ok: false, error: "Invalid request" }));
    request.on("end", async () => {
      if (size > 1024 * 1024) return send(413, { ok: false, error: "Request too large" });
      let body: unknown;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        return send(400, { ok: false, error: "Invalid JSON" });
      }
      if (!body || typeof body !== "object") return send(400, { ok: false, error: "Invalid request" });
      const input = body as { kind?: unknown; payload?: unknown; idOrName?: unknown };
      const kind = input.kind;
      try {
        if (request.url === "/list") {
          if (kind !== "tasks" && kind !== "workflows" && kind !== "all") return send(400, { ok: false, error: "Invalid kind" });
          return send(200, {
            ok: true,
            ...(kind !== "workflows" ? { tasks: this.settings.tasks } : {}),
            ...(kind !== "tasks" ? { workflows: this.settings.workflows } : {}),
          });
        }
        if (request.url === "/create") {
          if (kind !== "task" && kind !== "workflow") return send(400, { ok: false, error: "Invalid kind" });
          const createPayloadError = this.getMcpCreatePayloadError(kind, input.payload);
          if (createPayloadError) return send(400, { ok: false, error: createPayloadError });
          const data = this.wrapMcpCreatePayload(kind, input.payload);
          if (!data) return send(400, { ok: false, error: "Invalid payload" });
          try {
            return send(200, { ok: true, ...(await this.importFromData(data)) });
          } catch (error) {
            return send(400, { ok: false, error: error instanceof Error ? error.message : String(error) });
          }
        }
        if (request.url === "/export") {
          if (kind !== "all" && kind !== "tasks" && kind !== "workflows" && kind !== "task" && kind !== "workflow") return send(400, { ok: false, error: "Invalid kind" });
          const idOrName = typeof input.idOrName === "string" && input.idOrName.trim() ? input.idOrName : undefined;
          let tasks: ScheduledTask[] = [];
          let workflows: Workflow[] = [];
          if (kind === "task") {
            const task = idOrName ? this.findTaskByIdOrName(idOrName) : undefined;
            if (!task) return send(404, { ok: false, error: "task not found" });
            tasks = [task];
          } else if (kind === "workflow") {
            const workflow = idOrName ? this.findWorkflowByIdOrName(idOrName) : undefined;
            if (!workflow) return send(404, { ok: false, error: "workflow not found" });
            const payload = this.buildExportSelectionPayload(new Set(), new Set([workflow.id]));
            tasks = payload.tasks;
            workflows = payload.workflows;
          } else if (kind === "tasks") {
            tasks = this.settings.tasks;
          } else if (kind === "workflows") {
            const payload = this.buildExportSelectionPayload(new Set(), new Set(this.settings.workflows.map((workflow) => workflow.id)));
            tasks = payload.tasks;
            workflows = payload.workflows;
          } else {
            tasks = this.settings.tasks;
            workflows = this.settings.workflows;
          }
          const json = this.buildExportJson(tasks, workflows, idOrName || `AutoOC ${kind} export`);
          return send(200, { ok: true, export: JSON.parse(json) });
        }
        if (kind !== "task" && kind !== "workflow") return send(400, { ok: false, error: "Invalid kind" });
        if (typeof input.idOrName !== "string") return send(400, { ok: false, error: "idOrName is required" });
        const item = kind === "task" ? this.findTaskByIdOrName(input.idOrName) : this.findWorkflowByIdOrName(input.idOrName);
        if (!item) return send(404, { ok: false, error: `${kind} not found` });
        if (request.url === "/play") {
          if (kind === "task") {
            assertNoRetiredDependency(item as ScheduledTask);
            if (this.isTaskActive(item as ScheduledTask)) {
              return send(409, { ok: false, id: item.id, name: item.name, status: "conflict", error: `Task "${item.name}" is already running.` });
            }
            void this.runTask(item as ScheduledTask);
          } else {
            assertWorkflowDependencies(item as Workflow, this.settings.tasks);
            const workflowPlayError = this.getMcpWorkflowPlayError(item as Workflow);
            if (workflowPlayError) return send(workflowPlayError.status, workflowPlayError.body);
            void this.runWorkflow(item as Workflow);
          }
          return send(200, { ok: true, id: item.id, name: item.name, status: "started" });
        }
        if (request.url === "/stop") {
          const status = kind === "task" ? await this.killTask(item.id, this.taskStopIdentity(item as ScheduledTask)) : (await this.killWorkflow(item.id), "stopped");
          return send(200, { ok: true, id: item.id, name: item.name, status });
        }
        return send(404, { ok: false, error: "Unknown endpoint" });
      } catch (error) {
        console.warn("AutoOC MCP bridge request failed", error);
        return send(500, { ok: false, error: "Bridge request failed" });
      }
    });
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

  async refreshCodexModels(showNotice = false): Promise<void> {
    const vaultBasePath = (this.app.vault.adapter as any).basePath || ".";
    const cwd = this.settings.workingDirectory || vaultBasePath;
    const client = new CodexAppServerClient(resolveCodexBin(this.settings.codexPath), cwd);
    try {
      const models = await client.listModels();
      this.availableCodexModels = models;
      const preferred = models.find((model) => model.isDefault) || models[0];
      if (!this.settings.defaultCodexModel || !models.some((model) => model.value === this.settings.defaultCodexModel)) {
        this.settings.defaultCodexModel = preferred?.value || "";
      }
      const selected = models.find((model) => model.value === this.settings.defaultCodexModel) || preferred;
      if (selected?.supportedReasoningEfforts.length && !selected.supportedReasoningEfforts.includes(this.settings.defaultCodexReasoningEffort)) {
        this.settings.defaultCodexReasoningEffort = selected.defaultReasoningEffort || selected.supportedReasoningEfforts[0];
      }
      await this.saveSettings(false);
      this.view?.refresh();
      if (showNotice) new Notice(`AutoOC: ${models.length} Codex models loaded.`);
    } catch (error) {
      if (showNotice) new Notice(`AutoOC: could not connect to Codex — ${String(error)}`);
    } finally {
      client.dispose();
    }
  }

  getEffectiveCodexModel(model?: string): string {
    return model || this.settings.defaultCodexModel || this.availableCodexModels.find((entry) => entry.isDefault)?.value || this.availableCodexModels[0]?.value || "";
  }

  getCodexReasoningEfforts(model?: string): string[] {
    const selected = this.availableCodexModels.find((entry) => entry.value === (model || this.settings.defaultCodexModel));
    return selected?.supportedReasoningEfforts.length
      ? selected.supportedReasoningEfforts
      : ["minimal", "low", "medium", "high", "xhigh"];
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
  }

  emitWorkflowUpdated(workflow: Workflow): void {
    for (const callback of this.workflowUpdatedCallbacks) callback(workflow);
  }

  async loadSettings(transaction?:CatalogTransaction) { return this.loadSettingsSnapshot(undefined,transaction); }

  private async loadSettingsSnapshot(confirmed?: PersistedWorkflowCatalog, transaction?:CatalogTransaction) {
    this.assertLifecycleOpen();
    const revision = ++this.settingsLoadRevision;
    this.settingsPublicationState = "loading";
    let observed = false;
    try { return await this.prepareSettingsSnapshot(revision,confirmed,()=>{observed=true;},transaction); }
    finally {
      if (revision === this.settingsLoadRevision && this.settingsPublicationState === "loading") {
        this.settingsPublicationState = !observed && this.hasWritableCatalogVersion() ? "ready" : "conflict";
      }
    }
  }

  private hasWritableCatalogVersion():boolean {
    const previous=this.settingsWritableCatalog;
    if(!previous)return false;
    try {
      const current=this.settingsWriter.confirmedVersion(previous.file);
      return current.textHash===previous.version.textHash && current.valueHash===previous.version.valueHash;
    } catch { return false; }
  }

  private async prepareSettingsSnapshot(revision:number, confirmed?: PersistedWorkflowCatalog, observed:()=>void=()=>{}, transaction?:CatalogTransaction) {
    const priorSettings = this.settings && captureJsonStructure(this.settings);
    const lease = this.pluginExecutionLease;
    let ownedAtEntry = false;
    try { lease?.assertOwned(); ownedAtEntry = !!lease; } catch { /* Read-only observation after ownership loss remains supported. */ }
    const vaultBasePath = (this.app.vault.adapter as any).basePath || ".";
    const location = (this.app.vault.adapter as any).basePath && this.app.vault.configDir && this.manifest?.id
      ? this.selectedExecutionLocation(false) : undefined;
    const localFile = location?.configurationFile;
    const accept = () => !this.lifecycleStopped && revision === this.settingsLoadRevision &&
      (!priorSettings || matchesJsonStructure(this.settings, priorSettings));
    let loaded: any;
    if (localFile && confirmed) {
      const snapshot = cloneJsonStructure(confirmed.catalog);
      await this.settingsWriter.adoptConfirmed(localFile,confirmed.version,accept);
      loaded = snapshot;
    } else loaded = localFile ? await this.settingsWriter.loadAsync(localFile,accept) : await this.loadData();
    observed();
    this.assertLifecycleOpen();
    if (revision !== this.settingsLoadRevision) throw new Error("AutoOC settings changed while loading; reload before saving");
    const nextSettings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    let validateRecovery = () => {};
    const publish = async () => {
      if (localFile) await this.settingsWriter.assertUnchanged(localFile);
      if (!accept()) throw new Error("AutoOC settings changed during recovery; reload before saving");
      this.assertLifecycleOpen();
      if (lease !== this.pluginExecutionLease) throw new Error("Execution owner changed during recovery");
      if (ownedAtEntry) lease!.assertOwned();
      validateRecovery();
      this.settings = nextSettings;
      this.settingsWritableCatalog = localFile ? {file:localFile,version:this.settingsWriter.confirmedVersion(localFile)} : undefined;
      this.settingsPublicationState = "ready";
    };
    this.legacyOutputRedaction.load(path.join(location?.installationDirectory || path.resolve(vaultBasePath, this.manifest?.dir || path.join(this.app.vault.configDir || ".obsidian", "plugins", this.manifest?.id || "auto-oc")), "secrets.vault.json"), tryGetSafeStorage());
    for (const item of [...nextSettings.tasks, ...nextSettings.workflows, ...nextSettings.workflows.flatMap(w => w.steps || [])]) {
      const error = autoOCDependencyError(item);
      if (error) new Notice(error);
    }
    nextSettings.tasks = nextSettings.tasks.map(task => {
      if (!task.legacyExecution) return task;
      const attempt = this.legacyAttempts?.get(task.id);
      if (attempt && attempt.task.legacyExecution?.token === task.legacyExecution.token) return attempt.task;
      if (task.status !== "running") return task;
      return {...task,status:"failed",pendingCodexApproval:undefined,
        legacyExecution:{...task.legacyExecution,stopState:"unconfirmed"},
        output:`${task.output || ""}\n[legacy owner unavailable; external outcome unconfirmed]`};
    });
    // Bound executions are recovered read-only before legacy migrations can
    // change their definition or turn an unobserved run into a failure.
    if (nextSettings.workflows?.some(wf => (wf as any).runtimeExecution || wf.steps.some(step => step.codeExecution)) || nextSettings.tasks?.some(task=>(task as any).runtimeExecution)) {
      const runtime = (location || this.selectedExecutionLocation()).runtimeDirectory;
      const observations = new Map<string, Awaited<ReturnType<typeof observeCheckpoint>>>();
      validateRecovery = () => { for (const observed of observations.values()) observed.assertCurrent(); };
      const checkpointFor = async (runId:string) => {
        if (!observations.has(runId)) observations.set(runId,await observeCheckpoint(runtime,runId));
        return observations.get(runId)!.checkpoint;
      };
      const recovered: Workflow[] = [];
      for (const wf of nextSettings.workflows) {
        recovered.push(await (async () => {
        const binding = (wf as any).runtimeExecution;
        if (wf.legacyExecution) {
          if (binding) {
            const checkpoint = await checkpointFor(binding.runId);
            validateProgressBinding(wf,checkpoint,binding.runId);
            if (!["completed","failed","abandoned"].includes(checkpoint.phase)) throw new Error("Legacy workflow overlaps an unfinished shared run");
          }
          return wf.status === "running" && !(this as any).workflowRuntime?.has(wf.id) ? {...wf,status:"failed" as const} : wf;
        }
        if (!binding) return wf;
        const checkpoint = await checkpointFor(binding.runId);
        return recoverWorkflowProgressAsync(wf, nextSettings.tasks, nextSettings, checkpoint, binding.runId, this.ownsSharedRun(wf.id,binding.runId));
        })());
      }
      nextSettings.workflows = recovered;
      for (const wf of recovered) {
        for (const step of wf.steps) {
          if (!step.codeExecution) continue;
          const checkpoint = await checkpointFor(step.codeExecution.runtimeExecution.runId);
          step.codeExecution = projectCodeStepRun(wf, step.id, nextSettings.tasks, nextSettings, checkpoint,
            this.ownsSharedRun(wf.id, checkpoint.runId), true).codeExecution;
        }
      }
      const recoveredTasks: ScheduledTask[] = [];
      for (const task of nextSettings.tasks) {
        recoveredTasks.push(await (async () => {
        const binding=(task as any).runtimeExecution;
        if (!binding) return task;
        const checkpoint=await checkpointFor(binding.runId);
        validateProgressBinding({id:binding.workflowId,runtimeExecution:binding},checkpoint,binding.runId);
        if (task.legacyExecution) {
          if (!["completed","failed","abandoned"].includes(checkpoint.phase)) throw new Error("Legacy task overlaps an unfinished shared run");
          return task;
        }
        if (checkpoint.workflowId.startsWith('@task:') && checkpoint.workflowId!==standaloneTaskWorkflow(task.id).id) throw new Error("Standalone task identity mismatch");
        if (binding.workflowId===standaloneTaskWorkflow(task.id).id) {
          return recoverStandaloneTaskAsync(task,nextSettings.tasks,nextSettings,checkpoint,this.ownsSharedRun(binding.workflowId,binding.runId));
        }
        const observed=checkpoint.steps.filter(step=>step.stepId===binding.stepId).pop();
        if (!observed) throw new Error("Bound task step is absent from its journal");
        if (["completed","failed","abandoned"].includes(checkpoint.phase)) {
          // The saved binding, rather than today's workflow steps, identifies
          // this task's historical result even after a step was reassigned.
          return {...task,status:(checkpoint.phase === "abandoned" && observed.status === "in_flight" ? "abandoned" : observed.status) as ScheduledTask["status"],output:observed.output || '',
            ...(observed.startedAt ? {lastRun:observed.startedAt} : {}),
            ...(observed.codexThreadId ? {lastCodexThreadId:observed.codexThreadId} : {}),
            ...(observed.codexTurnId ? {lastCodexTurnId:observed.codexTurnId} : {}),
            pendingCodexApproval:undefined,
            runtimeExecution:{...binding,revision:checkpoint.revision,definitionHash:checkpoint.definitionHash,phase:checkpoint.phase,abandonment:checkpoint.abandonment,disposition:checkpoint.disposition,terminalUncertainty:checkpointUncertainties(checkpoint).length>0,finishedAt:observed.finishedAt,requiresReconciliation:false}};
        }
        const workflow = recovered.find(wf=>wf.id===binding.workflowId && (wf as any).runtimeExecution?.runId===binding.runId);
        const step = workflow?.steps.find(step=>step.id===binding.stepId && step.taskId===task.id);
        if (!step) return task;
        return {...task,status:step.status,runtimeExecution:{...binding,requiresReconciliation:step.status==="pending" && (workflow as any).runtimeExecution.requiresReconciliation}};
        })());
      }
      nextSettings.tasks = recoveredTasks;
      for (const observed of observations.values()) await observed.assertUnchanged();
      await publish();
      return;
    }
    // A confirmed execution snapshot is already migrated. In particular the
    // initial ready checkpoint may not yet bind a task: never migrate its
    // frozen definition or perform a second write inside its publication.
    if(confirmed){await publish();return;}
    delete (nextSettings as any).chatHistory;
    delete (nextSettings as any).chatModel;
    let changed = false;
    for (const task of nextSettings.tasks) {
      if (task.status === "running" && !task.legacyExecution) {
        task.status = "failed";
        task.output = `${task.output || ""}\n[stale running state cleared on plugin load]`;
        changed = true;
      }
      if (task.pendingCodexApproval && !task.legacyExecution) {
        delete task.pendingCodexApproval;
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
    if (!nextSettings.workflows) nextSettings.workflows = [];
    for (const wf of nextSettings.workflows) {
      if (wf.status === "running" && !(this as any).workflowRuntime?.has(wf.id)) {
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
    if (!nextSettings.defaultModel) {
      nextSettings.defaultModel = this.availableModels[0]?.value ?? "";
      changed = true;
    }
    if (!["codex", "opencode", "opencode2", "copilot"].includes(nextSettings.defaultAiEngine)) {
      nextSettings.defaultAiEngine = "opencode";
      changed = true;
    }
    if (nextSettings.taskTimeoutSeconds === undefined || (nextSettings.taskTimeoutSeconds > 0 && nextSettings.taskTimeoutSeconds < 1800)) {
      nextSettings.taskTimeoutSeconds = DEFAULT_TASK_TIMEOUT_SECONDS;
      changed = true;
    }
    if (!nextSettings.libraryUrl) {
      nextSettings.libraryUrl = DEFAULT_SETTINGS.libraryUrl;
      changed = true;
    }
    if (!nextSettings.dashboardPositions || typeof nextSettings.dashboardPositions !== "object") {
      nextSettings.dashboardPositions = {};
      changed = true;
    }
    await publish();
    if (changed) {
      await this.saveSettings(false,undefined,transaction);
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

  async saveSettings(refreshView = true, validate?:()=>void, transaction?:CatalogTransaction) {
    this.assertLifecycleOpen();
    const basePath=(this.app.vault.adapter as any).basePath;
    if(!basePath)return this.saveSettingsWithinTransaction(refreshView,validate);
    return this.settingsWriter.trackTransaction(catalogTransaction(this.selectedExecutionLocation().configurationFile,async()=>{
      await this.saveSettingsWithinTransaction(refreshView,validate);
    },transaction));
  }

  private async saveSettingsWithinTransaction(refreshView = true, validate?:()=>void) {
    // Entry authorized this save before it entered the host queue. Unload
    // drains accepted saves while rejecting all later calls at the entry.
    const basePath = (this.app.vault.adapter as any).basePath;
    const file = basePath ? this.selectedExecutionLocation().configurationFile : undefined;
    // A rejected offside load may already have observed a newer disk version.
    // Never pair that version with old editable settings on a subsequent save.
    if (this.settingsPublicationState !== "ready") {
      if (this.settingsPublicationState !== "loading" || !this.hasWritableCatalogVersion()) throw new Error("AutoOC settings recovery is pending or conflicted; reload before saving");
      // A valid previous catalog may still be saved against its SAME observed
      // version. Its revision cancels the late load; the writer independently
      // rejects an external change. Never authorize a newly observed baseline.
      this.settingsPublicationState = "ready";
    }
    this.settingsLoadRevision++;
    let savedSettings:ReturnType<typeof captureJsonStructure>|undefined;
    if (file) {
      await this.settingsWriter.save(file, () => {savedSettings=captureJsonStructure(this.settings);return this.settings;},validate);
      this.settingsWritableCatalog = {file,version:this.settingsWriter.confirmedVersion(file)};
    } else {
      await this.saveData(this.settings);
    }
    this.sharedSettingsBaseline=savedSettings;
    if (refreshView) this.view?.refresh();
  }

  redactSecrets(text: string): string {
    return this.legacyOutputRedaction?.redact(text) ?? text;
  }

  legacyCredentialNoticeStatus() { return this.legacyOutputRedaction.getIssue(); }

  openLegacyCredentialNotice(onClosed?: () => void): void {
    new LegacyCredentialNoticeModal(this.app, {
      review: () => {
        this.assertLifecycleOpen();
        const vaultBasePath = (this.app.vault.adapter as any).basePath || "";
        const location = this.manifest?.id && vaultBasePath ? this.selectedExecutionLocation(false) : undefined;
        const directory = location?.installationDirectory || path.resolve(vaultBasePath, this.manifest?.dir || path.join(this.app.vault.configDir || ".obsidian", "plugins", this.manifest?.id || "auto-oc"));
        this.legacyOutputRedaction.load(path.join(directory, "secrets.vault.json"), tryGetSafeStorage(), false);
        return this.legacyCredentialNoticeStatus();
      },
      acknowledge: id => { this.assertLifecycleOpen(); this.legacyOutputRedaction.acknowledge(id); },
      onClosed,
    }).open();
  }

  // ── Version / update helpers ────────────────────────────────────────────────

  async checkForUpdates(silent = false): Promise<void> {
    if (this.lifecycleStopped && (!this.startupError || this.startupRecoveryDisposed)) return;
    try {
      this.updateCheckError = null;
      const res = await fetch(noCacheUrl(REMOTE_MANIFEST_URL), { cache: "reload" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (this.lifecycleStopped && (!this.startupError || this.startupRecoveryDisposed)) return;
      const remoteVersion = data?.version;
      if (!remoteVersion || typeof remoteVersion !== "string") {
        throw new Error("Remote manifest has no version");
      }
      this.latestVersion = remoteVersion;
      const comparison = compareVersions(remoteVersion, this.manifest.version);
      const incomplete = !hasCompleteInstalledRelease(this.selectedExecutionLocation(false).installationDirectory, this.manifest.version);
      this.updateAvailable = comparison > 0 || comparison === 0 && !!incomplete;
      this.view?.refresh();
      if (!silent) {
        new Notice(
          this.updateAvailable
            ? `AutoOC: install or repair the complete v${remoteVersion} package.`
            : `AutoOC: already up to date (v${this.manifest.version}).`
        );
      }
    } catch (e) {
      this.updateCheckError = String(e);
      this.view?.refresh();
      if (!silent) new Notice(`AutoOC: update check failed — ${String(e)}`);
    }
  }

  get panelAvailable(): boolean { return this.ready || !!this.startupError && !this.startupRecoveryDisposed; }

  openBlockedExecutionsReview(runId?:string):void {
    if(!this.panelAvailable)throw new Error('AutoOC is still loading or closing');
    new BlockedExecutionModal(this.app,
      () => inspectBlockedExecutions(this.selectedExecutionLocation(false)),
      (inspection,attempt) => this.confirmResetBlockedAttempt(inspection,attempt),
      this.ready ? undefined : async inspection => {
        if(!await new ConfirmModal(this.app,'Reconnect execution controls?',
          'Reconnect AutoOC while keeping every saved attempt. No task will run. Confirm after checking that the original external work has ended. A live external owner or an active save still prevents reconnection.').openAndWait())return false;
        await this.withRecoveryLease(inspection,async()=>{});
        return true;
      },error=>this.redactSecrets(String(error)),runId).open();
  }

  async confirmResetBlockedAttempt(inspection:BlockedExecutionInspection,attempt:BlockedAttempt):Promise<boolean> {
    const modal=new ConfirmModal(this.app,'Reset this blocked attempt?',
      `${attempt.name}. Attempt: ${attempt.runId}. ${attempt.completedSteps} completed step(s) will remain in history. Confirm that the original external work has ended and accept that unverified effects remain unknown. This closes only this attempt; it does not undo changes, mark success, or start new work. A later Run may repeat earlier effects. Enter the reason for closing it.`,true);
    if(!await modal.openAndWait())return false;
    await this.withRecoveryLease(inspection,async(lease,assertIdle)=>{
      await resetBlockedAttempt(inspection,attempt,lease,modal.reason,true,assertIdle);
    });
    new Notice('Attempt closed with unknown outcome. History and results are preserved. Nothing was started.');
    return true;
  }

  // Recovery holds the same admission and shutdown barriers as execution. It
  // can borrow a current idle owner, or reclaim an exact stopped/dead owner;
  // it never treats PID equality alone as authority to release a reservation.
  private async withRecoveryLease(inspection:BlockedExecutionInspection,
      action:(lease:ExecutionLease,assertIdle:()=>void)=>Promise<void>):Promise<void> {
    const assertIdle=()=>{
      if(!this.panelAvailable || this.startupRecoveryDisposed || this.startupPending || this.updateInProgress ||
          this.workflowEditPending || this.sharedWorkflowExecution || this.definitionStarts.size ||
          this.runningProcesses.size || this.runningCodexClients.size || this.workflowDelayControllers.size ||
          this.legacyAttempts.size || this.draftControllers.size || this.settingsWriter.hasPendingWrites || this.cliRequestHost?.hasPendingWork) {
        throw new Error('Active work or saving must finish before recovery. No attempt was reset.');
      }
    };
    assertIdle();
    if(this.bulkCatalogMutationInProgress || this.sharedCompletions.size)throw new Error('Another operation is finishing; refresh the recovery review');
    const consulting=!this.ready;
    const expectedSettings=consulting ? undefined : captureJsonStructure(this.settings);
    this.bulkCatalogMutationInProgress=true;
    const pending=Promise.resolve().then(async()=>{
      assertIdle();
      const location=assertBlockedInspection(inspection,true);
      if(!samePhysicalPath(this.selectedExecutionLocation(false).installationDirectory,location.installationDirectory))throw new Error('Selected installation changed');
      let lease=this.pluginExecutionLease;
      const temporary=consulting || !lease;
      if(!lease) {
        if(inspection.owner) {
          const relinquish=inspection.owner.pid===process.pid ? stoppedLeaseOwners.get(inspection.owner.token) : undefined;
          if(relinquish)relinquish(location.runtimeDirectory,true);
          else recoverExecutionLease(location.runtimeDirectory,inspection.owner.token,()=>{assertIdle();assertBlockedInspection(inspection,true);});
        }
        lease=acquireExecutionLease(location.runtimeDirectory);
      }
      try {
        lease.assertOwned();
        if(!samePhysicalPath(lease.directory,location.runtimeDirectory))throw new Error('Recovery owner belongs to another installation');
        assertIdle();assertBlockedInspection(inspection,false);
        if(!consulting && this.pluginExecutionLease===lease)this.beginExecutionEffects();
        await action(lease,assertIdle);
        if(!consulting && this.panelAvailable && !this.lifecycleStopped) {
          if(!matchesJsonStructure(this.settings,expectedSettings!))throw new Error('Recovery may already be recorded. Local edits were preserved; refresh the review before continuing.');
          await this.loadSettings();this.refreshOpenViews();
        }
      } finally {
        // Temporary recovery performed no provider work. Preserve the lease
        // if a partial write remains; never hide an interrupted publication.
        if(temporary){
          assertPackageMaintenanceSafe(location.installationDirectory);
          if(this.pluginExecutionLease===lease)this.releasePluginExecution(false);
          else lease.release();
        }
      }
    });
    this.sharedCompletions.add(pending);
    try {await pending;}
    finally {this.sharedCompletions.delete(pending);this.bulkCatalogMutationInProgress=false;}
    if(consulting && this.panelAvailable)await this.retryLoadingAutoOC();
  }

  private assertPackageUpdateIdle(stoppedOwner = false): void {
    if (!stoppedOwner && this.lifecycleStopped && (!this.startupError || this.startupRecoveryDisposed)) throw new Error("AutoOC instance is stopped");
    if (this.startupPending || this.bulkCatalogMutationInProgress || this.sharedWorkflowExecution || this.sharedCompletions.size || this.runningProcesses.size ||
        this.runningCodexClients.size || this.workflowDelayControllers.size || this.legacyAttempts.size || this.workflowEditPending ||
        this.settingsWriter.hasPendingWrites || this.cliRequestHost?.hasPendingWork) {
      throw new Error("An active execution or save must finish before updating AutoOC");
    }
    const location = this.selectedExecutionLocation(false);
    this.pluginExecutionLease?.assertOwned();
    assertPackageMaintenanceSafe(location.installationDirectory);
  }

  async updatePlugin(): Promise<void> {
    if (this.updateInProgress || !this.latestVersion) return;
    const targetVersion = this.latestVersion;
    this.updateInProgress = true;
    let maintenanceLease = false;
    try {
      await this.settingsWriter.drain();
      this.assertPackageUpdateIdle();
      if (!confirm("AutoOC will download v" + targetVersion + " and reload the plugin. Tasks, workflows and settings will be preserved.\n\nContinue?")) return;
      if (!this.pluginExecutionLease) {
        const location = this.selectedExecutionLocation(false);
        try { this.pluginExecutionLease = acquireExecutionLease(location.runtimeDirectory); }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
          const owner = readExecutionLeaseOwner(location.runtimeDirectory);
          // Maintenance archives an exact absent reservation, never a run or its
          // unknown effects. A live/unverifiable owner remains exclusive.
          const relinquish = owner.pid === process.pid ? stoppedLeaseOwners.get(owner.token) : undefined;
          if (relinquish) relinquish(location.runtimeDirectory, true);
          else recoverExecutionLease(location.runtimeDirectory, owner.token, () => assertPackageMaintenanceSafe(location.installationDirectory));
          this.pluginExecutionLease = acquireExecutionLease(location.runtimeDirectory);
        }
        this.pluginExecutionLocation = location;
        maintenanceLease = true;
      }
      this.view?.refresh();
      new Notice("AutoOC: downloading update…");
      const files = await downloadRelease("https://raw.githubusercontent.com/" + GITHUB_REPO + "/" + GITHUB_BRANCH, targetVersion);
      await this.settingsWriter.drain();
      this.assertPackageUpdateIdle();
      const pluginDir = path.dirname(this.pluginExecutionLease.directory);
      installRelease({ directory: pluginDir, version: targetVersion, files, lease: this.pluginExecutionLease });
      // No local work can start while updateInProgress is set. Release this
      // maintenance reservation without treating old journals as live work.
      this.lifecycleStopped = true;
      this.ready = false;
      this.startupRecoveryDisposed = true;
      this.stopStartupWait();
      this.cliRequestHost?.close();
      this.releasePluginExecution(false);
      new Notice("AutoOC: updated to v" + targetVersion + ". Reloading plugin…");
      try {
        // @ts-ignore — internal Obsidian API
        await this.app.plugins.disablePlugin(this.manifest.id);
        // @ts-ignore — internal Obsidian API
        await this.app.plugins.enablePlugin(this.manifest.id);
        // @ts-ignore — internal Obsidian API
        const loaded = this.app.plugins.plugins?.[this.manifest.id];
        if (!loaded?.panelAvailable && !loaded?.ready) throw new Error("New plugin panel did not open");
        new Notice("AutoOC: plugin reloaded.");
      } catch {
        new Notice("AutoOC: update saved. Restart Obsidian to finish. Do not uninstall the plugin.", 12000);
      }
    } catch (error) {
      new Notice("AutoOC: update could not finish — " + String(error) + ". Your configuration is preserved; do not uninstall the plugin.", 12000);
    } finally {
      this.updateInProgress = !!this.pluginExecutionLease && fs.existsSync(path.join(this.pluginExecutionLease.directory, "update-pending.json"));
      if (maintenanceLease && this.pluginExecutionLease && !this.updateInProgress) {
        try { this.releasePluginExecution(false); } catch { /* Preserve a changed owner. */ }
      }
      if (!this.lifecycleStopped) this.view?.refresh();
    }
  }

  // Keep CLI options before "--" so prompt text cannot be parsed as opencode flags.
  buildArgs(task: ScheduledTask): string[] {
    if (task.taskKind === "opencode2" && task.interactiveTerminal) return [resolveOpencodeBin(this.settings.opencode2Path || "opencode"),
      ...openCodeInteractiveArgs(2, task.model || this.settings.defaultOpencode2Model || "", task.forceModel ? "" : task.agent || this.settings.defaultOpencode2Agent || "build", task.prompt)];
    if (task.taskKind === "opencode2") return [resolveOpencodeBin(this.settings.opencode2Path || "opencode"),
      ...openCodeRunArgs(2, task.model || this.settings.defaultOpencode2Model || "", task.agent || this.settings.defaultOpencode2Agent || "build", task.forceModel), "--", task.prompt];
    let prompt = task.prompt;
    if (task.useRalphLoop) {
      prompt = `/ralph-loop ${prompt}`;
    }
    const bin = resolveOpencodeBin(this.settings.opencodePath);
    const agent = this.getEffectiveAgent(task.agent);
    // --dangerously-skip-permissions prevents opencode from blocking on tool-approval prompts
    const args = [bin, "run", "-m", task.model];
    if (!task.forceModel) args.push("--agent", agent);
    args.push("--dangerously-skip-permissions", "--", prompt);
    return args;
  }

  // Human-readable command string for the preview modal
  buildCommand(task: ScheduledTask): string {
    const args = this.buildArgs(task);
    return args.map(commandPreviewArg).join(" ");
  }

  // Quick evaluation via same detached PS + polling mechanism. Used for workflow
  // transition validation prompts.
  async evaluateWithOpencode(prompt: string, model: string, cwd: string): Promise<{ output: string; exitCode: number }> {
    if (this.settings.defaultAiEngine === "opencode2") {
      const task = { id: "autooc-evaluation", taskKind: "opencode2", model, agent: this.settings.defaultOpencode2Agent || "build", workingDirectory: cwd };
      const definition = prepareWorkflowDefinition(standaloneTaskWorkflow(task.id), [task], this.settings);
      const result = await createOpenCodeWorkflowAdapter(definition, cwd).execute(task, prompt);
      return { output: this.redactSecrets(result.output), exitCode: result.succeeded ? 0 : -1 };
    }
    return new Promise((resolve) => {
      const fs = require("fs");
      const path = require("path");
      const tmpDir = require("os").tmpdir();
      const evalId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const outFile = path.join(tmpDir, `autooc-eval-${evalId}.txt`);
      const pidFile = path.join(tmpDir, `autooc-eval-${evalId}.pid`);
      const bin = resolveOpencodeBin(this.settings.opencodePath);
      const agent = this.getEffectiveAgent();
      const safeCwd = cwd.replace(/'/g, "''");
      const secretEnv = {};
      let settled = false;
      let hiddenProc: HiddenProcessHandle | null = null;
      const cleanup = (removeScript = true) => {
        hiddenProc?.cleanup(removeScript);
        try { fs.unlinkSync(scriptFile); } catch { /* ignore */ }
        try { fs.unlinkSync(outFile); } catch { /* ignore */ }
        try { fs.unlinkSync(pidFile); } catch { /* ignore */ }
      };

      let launchScript: string;
      if (isWindows()) {
        launchScript = [
          ...psUtf8Prelude(),
          `$env:USERPROFILE = ${psSingleQuoted(process.env.USERPROFILE || "")}`,
          `$env:APPDATA     = ${psSingleQuoted(process.env.APPDATA || "")}`,
          `$env:LOCALAPPDATA= ${psSingleQuoted(process.env.LOCALAPPDATA || "")}`,
          `$env:PATH        = ${psSingleQuoted(process.env.PATH || "")}`,
          `$env:HOME        = ${psSingleQuoted(process.env.USERPROFILE || "")}`,
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
      } else {
        const shEnv: Record<string, string> = {
          ...secretEnv,
          HOME: process.env.HOME || process.env.USERPROFILE || "",
          PATH: process.env.PATH || "",
        };
        launchScript = [
          `echo $$ > ${shSingleQuoted(pidFile)}`,
          ...buildShEnvLines(shEnv),
          `cd ${shSingleQuoted(cwd)} || exit 1`,
          `bin=${shSingleQuoted(bin)}`,
          `out_tmp="$(mktemp)"`,
          `err_tmp="$(mktemp)"`,
          `"$bin" run -m ${shSingleQuoted(model)} --agent ${shSingleQuoted(agent)} --dangerously-skip-permissions -- ${shSingleQuoted(prompt)} > "$out_tmp" 2> "$err_tmp"`,
          `exit_code=$?`,
          `stdout="$(cat "$out_tmp" 2>/dev/null)"`,
          `stderr="$(cat "$err_tmp" 2>/dev/null)"`,
          `rm -f "$out_tmp" "$err_tmp"`,
          `if [ -n "$stderr" ]; then combined="$(printf '%s\n%s' "$stdout" "$stderr")"; else combined="$stdout"; fi`,
          `printf '\nDONE:%s\n%s' "$exit_code" "$combined" > ${shSingleQuoted(outFile)}`,
        ].join("\n");
      }

      const scriptFile = path.join(tmpDir, `autooc-eval-${evalId}${scriptExt()}`);
      if (isWindows()) writeUtf8BomFile(scriptFile, launchScript);
      else fs.writeFileSync(scriptFile, launchScript, "utf8");
      hiddenProc = launchHidden(scriptFile, pidFile);

      const startedAt = Date.now();
      const poll = setInterval(() => {
        if (settled) return;
        if (Date.now() - startedAt > 180000) { // 3 min timeout
          settled = true;
          clearInterval(poll);
          hiddenProc?.kill();
          cleanup(true);
          resolve({ output: "evaluation timeout", exitCode: -1 });
          return;
        }
        if (!fs.existsSync(outFile)) return;
        settled = true;
        clearInterval(poll);
        const raw = fs.readFileSync(outFile, "utf8");
        cleanup(true);
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
  private beginLegacyAttempt(task: ScheduledTask, owner?: LegacyOwner): LegacyAttempt {
    this.beginExecutionEffects();
    this.assertLifecycleOpen();
    this.legacyAttempts ??= new Map();
    const current = this.settings.tasks.find(item => item.id === task.id);
    if (!current || this.sharedWorkflowExecution || this.legacyAttempts.get(task.id) && !this.legacyAttempts.get(task.id)!.cancelled) {
      throw new Error("Task execution changed or is not owned here; refresh or reconcile before stopping.");
    }
    const binding = (current as any).runtimeExecution;
    if (binding) {
      const checkpoint = readExecutionCheckpoint(this.selectedExecutionLocation().runtimeDirectory, binding.runId);
      validateProgressBinding({id:binding.workflowId,runtimeExecution:binding},checkpoint,binding.runId);
      if (!["completed", "failed", "abandoned"].includes(checkpoint.phase)) throw new Error("Shared execution must be reconciled before legacy reuse");
    }
    if (owner && (this as any).workflowRuntime?.get(owner.workflowId) !== owner.context) throw new Error("Workflow execution changed");
    const identity: LegacyStopIdentity = {kind:"legacy", token:require("crypto").randomUUID(), taskId:task.id,
      ...(owner ? {workflowId:owner.workflowId,stepId:owner.stepId,stepIndex:owner.stepIndex} : {})};
    const attempt: LegacyAttempt = {identity,task:current,owner,cancelled:false};
    if (owner) {
      const workflow = this.settings.workflows.find(item => item.id === owner.workflowId);
      if (workflow) workflow.legacyExecution ??= {token:require("crypto").randomUUID()};
    }
    this.legacyAttempts.set(task.id, attempt);
    current.legacyExecution = {...identity,startedAt:new Date().toISOString()};
    delete current.pendingCodexApproval;
    return attempt;
  }

  private isLegacyCurrent(attempt: LegacyAttempt): boolean {
    if (this.lifecycleStopped) return false;
    const current = this.settings.tasks.find(item => item.id === attempt.identity.taskId);
    if (current?.legacyExecution?.token === attempt.identity.token) attempt.task = current;
    return !attempt.cancelled && this.legacyAttempts?.get(attempt.identity.taskId) === attempt &&
      this.settings.tasks.find(item => item.id === attempt.identity.taskId) === attempt.task &&
      attempt.task.legacyExecution?.token === attempt.identity.token &&
      (!attempt.owner || (this as any).workflowRuntime?.get(attempt.owner.workflowId) === attempt.owner.context);
  }

  private finishLegacyStart(attempt: LegacyAttempt): void {
    attempt.releaseStart?.();
    delete attempt.releaseStart;
    try { this.refreshStartControls(); } catch { console.warn("AutoOC: Play controls could not refresh."); }
  }

  private legacyCompletion(attempt: LegacyAttempt, callback?: (task: ScheduledTask, code: number) => Promise<void>) {
    return async (task: ScheduledTask, code: number) => {
      if (!this.isLegacyCurrent(attempt)) return;
      task = attempt.task;
      task.legacyExecution!.finishedAt = new Date().toISOString();
      await this.saveSettings();
      if (!this.isLegacyCurrent(attempt)) return;
      this.legacyAttempts.delete(task.id);
      this.finishLegacyStart(attempt);
      if (callback) await callback(task, code);
    };
  }

  async confirmTerminalDisposition(workflowId:string,runId:string) {
    this.assertLifecycleOpen();
    const location=this.selectedExecutionLocation(),observed=inspectTerminalExecution({vault:location.vault,installationDirectory:location.installationDirectory,runId});
    if(observed.workflowId!==workflowId)throw new Error('Execution identity changed');
    const modal=new ConfirmModal(this.app,'Resolve historical uncertainty?',
      `Workflow: ${workflowId}. Attempt: ${runId}. Revision: ${observed.revision}. Historical phase: ${observed.phase}. External outcome remains UNKNOWN. This records a human disposition only: it does not stop processes, verify termination, mark success, or execute steps. Review this exact attempt and enter your reason.`,true);
    if(!await modal.openAndWait())return;
    this.assertLifecycleOpen();
    if(this.updateInProgress || !this.pluginExecutionLease || this.sharedWorkflowExecution || this.runningProcesses.size || this.runningCodexClients.size || this.workflowDelayControllers.size || this.legacyAttempts.size)throw new Error('An execution is still active; wait for it to finish');
    const reservation={workflowId,runId,controller:new AbortController()};this.sharedWorkflowExecution=reservation;
    try {
      await this.saveSettings(false);this.beginExecutionEffects();
      await disposeTerminalExecution({...observed,lease:this.pluginExecutionLease,reason:modal.reason,acknowledgedUnknownEffects:true});
    } finally {
      if(this.sharedWorkflowExecution===reservation)this.sharedWorkflowExecution=undefined;
      await this.loadSettings();this.refreshOpenViews();
    }
  }

  async openHistoricalAttemptsReview():Promise<void> {
    this.assertLifecycleOpen();
    const {runtime,names}=this.journalNames();
    const rows:Array<{name:string;runId:string;workflowId:string;phase:string}>=[];
    for(const file of names) {
      const {checkpoint}=await observeCheckpoint(runtime,file.slice(0,-5));
      this.assertLifecycleOpen();
      if(!['ready','in_flight'].includes(checkpoint.phase) || catalogReferencesRun(this.settings,checkpoint.runId))continue;
      const task=this.settings.tasks.find(t=>standaloneTaskWorkflow(t.id).id===checkpoint.workflowId);
      const workflow=this.settings.workflows.find(w=>w.id===checkpoint.workflowId);
      rows.push({name:task?.name || workflow?.name || checkpoint.workflowId,runId:checkpoint.runId,workflowId:checkpoint.workflowId,phase:checkpoint.phase});
    }
    new HistoricalAttemptsModal(this.app,rows,(workflowId,runId)=>{
      try {this.openHistoricalExecutionRecovery(workflowId,runId);}
      catch(error){new Notice(this.redactSecrets(String(error)));}
    }).open();
  }

  openHistoricalExecutionRecovery(workflowId:string,runId:string):void {
    this.assertLifecycleOpen();
    const location=this.selectedExecutionLocation();
    const observed=inspectHistoricalAttempt(location,workflowId,runId,this.settings);
    const task=this.settings.tasks.find(t=>standaloneTaskWorkflow(t.id).id===workflowId);
    const workflow=this.settings.workflows.find(w=>w.id===workflowId);
    const snapshot=():ExecutionHelpSnapshot|undefined=>{
      try {
        this.assertLifecycleOpen();
        const current=inspectHistoricalAttempt(this.selectedExecutionLocation(),workflowId,runId,this.settings);
        if(JSON.stringify(current)!==JSON.stringify(observed))return undefined;
        return {name:`Older attempt: ${task?.name || workflow?.name || workflowId}`,status:'pending',runId,phase:observed.phase,owned:false};
      } catch {return undefined;}
    };
    new ExecutionStatusHelpModal(this.app,snapshot,()=>{},this.manifest.version,true,{workflowId,revision:observed.revision,
      closeAttempt:async()=>{
        try {
          const modal=new ConfirmModal(this.app,'Close this old attempt?',
            `Attempt: ${runId}. Revision: ${observed.revision}. Confirm only after checking that its original external process has ended. The outcome remains UNKNOWN. This preserves the current task or workflow and all history. It does not stop processes, undo effects or start another run. Enter why you are closing this attempt.`,true);
          if(!await modal.openAndWait())return false;
          const assertIdle=()=>{
            this.assertLifecycleOpen();this.pluginExecutionLease?.assertOwned();this.selectedExecutionLocation();
            if(!this.pluginExecutionLease || this.updateInProgress || this.workflowEditPending || this.bulkCatalogMutationInProgress ||
              this.sharedWorkflowExecution || this.runningProcesses.size || this.runningCodexClients.size || this.workflowDelayControllers.size ||
              this.legacyAttempts.size || this.settingsWriter.hasPendingWrites || this.cliRequestHost?.hasPendingWork) throw new Error('An execution, save or update is active; wait before closing this attempt');
            assertUnboundHistoricalAttempt(this.settings,runId);
          };
          assertIdle();
          const reservation={workflowId,runId,controller:new AbortController()};
          this.sharedWorkflowExecution=reservation;
          try {
            await closeHistoricalAttempt(observed,this.pluginExecutionLease!,modal.reason,true,()=>{
              this.assertLifecycleOpen();this.selectedExecutionLocation();
              if(this.sharedWorkflowExecution!==reservation || this.updateInProgress || this.workflowEditPending || this.bulkCatalogMutationInProgress || this.settingsWriter.hasPendingWrites) throw new Error('Recovery ownership changed; review again');
              assertUnboundHistoricalAttempt(this.settings,runId);
            },()=>this.beginExecutionEffects());
          } finally {
            if(this.sharedWorkflowExecution===reservation)this.sharedWorkflowExecution=undefined;
            this.refreshOpenViews();
          }
          return true;
        } catch(error) {throw new Error(this.redactSecrets(String(error)));}
      }}).open();
  }

  async confirmAbandonTaskExecution(taskId:string):Promise<void> {
    this.assertLifecycleOpen();
    const task=this.settings.tasks.find(item=>item.id===taskId);
    const binding=(task as any)?.runtimeExecution;
    if(!binding || binding.workflowId!==standaloneTaskWorkflow(taskId).id) throw new Error('Select the owning workflow to resolve this execution');
    const location=this.selectedExecutionLocation();
    const observed=readExecutionCheckpoint(location.runtimeDirectory,binding.runId);
    validateProgressBinding({id:binding.workflowId,runtimeExecution:binding},observed,binding.runId);
    const confirmed=await new ConfirmModal(this.app,'Abandon unfinished attempt?',
      `Task: ${task!.name}. Attempt: ${observed.runId}. Its outcome is unknown. Confirm only after checking that its external process has ended. This preserves all history, does not stop processes, and does not mark success or start another task. Git Branch remains unchanged; clear it in Edit to use the current branch.`).openAndWait();
    if(!confirmed)return;
    this.assertLifecycleOpen();
    if(this.updateInProgress || !this.pluginExecutionLease || this.sharedWorkflowExecution || this.runningProcesses.size || this.runningCodexClients.size || this.workflowDelayControllers.size || this.legacyAttempts.size) throw new Error('An execution is still active; wait for it to finish');
    const current=(this.settings.tasks.find(item=>item.id===taskId) as any)?.runtimeExecution;
    if(current?.runId!==observed.runId || current?.revision!==binding.revision) throw new Error('Execution changed; inspect the task again');
    const reservation={workflowId:observed.workflowId,taskId,runId:observed.runId,controller:new AbortController()};
    this.sharedWorkflowExecution=reservation;
    try {
      await this.saveSettings(false);
      this.beginExecutionEffects();
      await abandonInstalledExecution({vault:location.vault,installationDirectory:location.installationDirectory,
        lease:this.pluginExecutionLease,runId:observed.runId,workflowId:observed.workflowId,revision:observed.revision,
        reason:'Explicit confirmation in the task card; unknown external outcome acknowledged',acknowledgedUnknownEffects:true});
    } finally {
      if(this.sharedWorkflowExecution===reservation)this.sharedWorkflowExecution=undefined;
      await this.loadSettings();
      this.refreshOpenViews();
    }
  }

  async runTask(
    task: ScheduledTask,
    onComplete?: (task: ScheduledTask, exitCode: number) => Promise<void>,
    overrides: Partial<Pick<ScheduledTask, "prompt" | "branch" | "createBranch">> = {},
    owner?: LegacyOwner,
  ) {
    return this.withDefinitionStart("task", task.id,
      release => this.executeTask(task, onComplete, overrides, owner, release),
      onComplete ? () => onComplete(this.busyTaskResult(task), -1) : undefined);
  }

  private busyTaskResult(task: ScheduledTask): ScheduledTask {
    // Completion consumers may mutate their result. Never hand them the owner
    // or its nested execution/definition objects for a rejected request.
    const result: ScheduledTask = JSON.parse(JSON.stringify(task));
    delete result.legacyExecution;
    delete (result as any).runtimeExecution;
    delete result.pendingCodexApproval;
    result.status = "failed";
    result.output = "[AutoOC] Task request rejected: task is already starting or already running.";
    return result;
  }

  private async executeTask(
    task: ScheduledTask,
    onComplete?: (task: ScheduledTask, exitCode: number) => Promise<void>,
    overrides: Partial<Pick<ScheduledTask, "prompt" | "branch" | "createBranch">> = {},
    owner?: LegacyOwner,
    releaseStart?: () => void,
  ) {
    this.assertLifecycleOpen();
    if (this.updateInProgress) throw new Error("Plugin update is in progress");
    const idx = this.settings.tasks.findIndex((t) => t.id === task.id);
    if (idx === -1) return;
    assertNoRetiredDependency(this.settings.tasks[idx]);
    const disabledReason = taskDisabledReason(this.settings.tasks[idx]);
    if (disabledReason) throw new Error(disabledReason);
    if (this.isTaskActive(this.settings.tasks[idx])) {
      new Notice(`AutoOC: Task "${this.settings.tasks[idx].name}" is already running.`);
      if (onComplete) await onComplete(this.busyTaskResult(this.settings.tasks[idx]), -1);
      return;
    }
    const selectedTask = this.settings.tasks[idx];
    const effectiveTask: ScheduledTask = { ...selectedTask, ...overrides };
    assertNoRetiredDependency(effectiveTask);

    const binding=(effectiveTask as any).runtimeExecution;
    if(!owner && binding?.requiresReconciliation) throw new Error(`Unfinished attempt ${binding.runId}. Use Abandon attempt on this task after checking its external process has ended. No new task was started.`);
    if (effectiveTask.legacyExecution?.stopState || binding?.phase !== "abandoned" && binding?.terminalUncertainty && !binding.disposition) {
      throw new Error("Previous task outcome is unconfirmed; recovery is required before starting a new attempt.");
    }

    if (this.pluginExecutionLease && !onComplete && Object.keys(overrides).length === 0) {
      const vault = (this.app.vault.adapter as any).basePath;
      const workflow = standaloneTaskWorkflow(effectiveTask.id);
      const definition = prepareWorkflowDefinition(workflow, this.settings.tasks, this.settings);
      if (supportsSharedWorkflow(definition, createWorkflowTaskAdapter(definition, vault))) {
        const pending=this.executeSharedWorkflow(workflow.id, undefined, false, true, effectiveTask.id, undefined, releaseStart);
        this.sharedCompletions.add(pending);
        try {await pending;}finally{this.sharedCompletions.delete(pending);}
        return;
      }
    }

    if (this.sharedWorkflowExecution) throw new Error("Shared workflow owns the execution reservation");
    const checkedOpenCode2Bin = effectiveTask.taskKind === "opencode2" ? resolveOpencodeBin(this.settings.opencode2Path || "opencode") : undefined;
    if (checkedOpenCode2Bin) {
      if (effectiveTask.useRalphLoop) throw new Error("Ralph Loop integration is only supported for OpenCode 1 tasks.");
      effectiveTask.model ||= this.settings.defaultOpencode2Model || "";
      effectiveTask.agent ||= this.settings.defaultOpencode2Agent || "build";
      await assertOpenCode2(checkedOpenCode2Bin);
      this.assertLifecycleOpen();
      if (this.updateInProgress || this.sharedWorkflowExecution || this.settings.tasks[idx] !== selectedTask || taskDisabledReason(selectedTask) || this.isTaskActive(selectedTask)) {
        throw new Error("Task or execution availability changed while checking the CLI version. Nothing was launched; review the task before trying again.");
      }
    }
    const attempt = this.beginLegacyAttempt(effectiveTask, owner);
    attempt.releaseStart = releaseStart;

    if ((effectiveTask.taskKind || "opencode") === "code") {
      try { await this.runCodeTask(effectiveTask, onComplete, owner, attempt); }
      finally { this.finishLegacyStart(attempt); }
      return;
    }

    if (effectiveTask.taskKind === "codex") {
      void this.runCodexTask(effectiveTask, onComplete, owner, attempt).catch(error => {
        new Notice(this.redactSecrets(`AutoOC: Task could not start. ${String(error)}`), 12000);
      }).finally(() => this.finishLegacyStart(attempt));
      return;
    }

    if (effectiveTask.taskKind === "copilot") {
      void this.runCopilotTask(effectiveTask, onComplete, owner, attempt).catch(error => {
        new Notice(this.redactSecrets(`AutoOC: Task could not start. ${String(error)}`), 12000);
      }).finally(() => this.finishLegacyStart(attempt));
      return;
    }

    delete attempt.releaseStart;
    onComplete = this.legacyCompletion(attempt, onComplete);
    const branchWasProvided = Object.prototype.hasOwnProperty.call(effectiveTask, "branch");
    if (branchWasProvided && typeof effectiveTask.branch !== "string") {
      this.settings.tasks[idx].status = "failed";
      this.settings.tasks[idx].lastRun = new Date().toISOString();
      this.settings.tasks[idx].output = "[AutoOC] Task not launched: branch must be a string when provided.";
      await this.saveSettings();
      new Notice(`AutoOC: "${task.name}" has an invalid branch.`);
      if (onComplete) await onComplete(this.settings.tasks[idx], -1);
      return;
    }
    if (!effectiveTask.branch?.trim()) delete effectiveTask.branch;
    if (effectiveTask.branch) {
      const { isValidGitBranchName } = require("./import-utils");
      if (!isValidGitBranchName(effectiveTask.branch)) {
        this.settings.tasks[idx].status = "failed";
        this.settings.tasks[idx].lastRun = new Date().toISOString();
        this.settings.tasks[idx].output = "[AutoOC] Task not launched: invalid git branch name.";
        await this.saveSettings();
        new Notice(`AutoOC: "${task.name}" has an invalid git branch name.`);
        if (onComplete) await onComplete(this.settings.tasks[idx], -1);
        return;
      }
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
    const secretEnv = {};

    if (effectiveTask.interactiveTerminal) {
      const current = this.settings.tasks[idx];
      let settled = false;
      let cancelled = false;
      // Identity, not just task ID/status, prevents late callbacks from a
      // stopped, deleted or relaunched task from completing another attempt.
      const controller = { kill: () => { cancelled = true; settled = true; } };
      attempt.handle = controller;
      this.runningProcesses.set(task.id, controller);
      const isCurrent = () => this.isLegacyCurrent(attempt) && !settled && this.runningProcesses.get(task.id) === controller &&
        this.settings.tasks.find((candidate) => candidate.id === task.id) === current && current.status === "running";
      const finish = async (error?: Error) => {
        if (!isCurrent()) return;
        settled = true;
        current.status = error ? "failed" : "completed";
        current.output = error
          ? `[AutoOC] Could not open interactive OpenCode CLI: ${String(error)}`
          : "[interactive OpenCode CLI launch confirmed; agent task completion is not tracked]";
        if (error) this.view?.startGradualSink(task.id);
        await this.saveSettings();
        // A stop/delete/relaunch during persistence invalidates continuation.
        if (!this.isLegacyCurrent(attempt) || cancelled || this.settings.tasks.find((candidate) => candidate.id === task.id) !== current ||
          current.status !== (error ? "failed" : "completed") || this.runningProcesses.get(task.id) !== controller) return;
        if (this.runningProcesses.get(task.id) === controller) this.runningProcesses.delete(task.id);
        new Notice(error ? `AutoOC: could not open CLI task "${task.name}".` : `AutoOC: opened CLI task "${task.name}".`);
        if (onComplete) await onComplete(current, error ? -1 : 0);
      };
      current.status = "running";
      current.lastRun = new Date().toISOString();
      current.output = "[opening interactive OpenCode CLI...]";
      this.view?.resetDashboardTaskShift(task.id);
      await this.saveSettings();
      if (!isCurrent()) return;
      this.finishLegacyStart(attempt);

      try {
        let prompt = effectiveTask.prompt;
        if (effectiveTask.useRalphLoop) {
          prompt = `/ralph-loop ${prompt}`;
        }
        const major = effectiveTask.taskKind === "opencode2" ? 2 : 1;
        const bin = checkedOpenCode2Bin || resolveOpencodeBin(this.settings.opencodePath);
        const agent = major === 2 ? effectiveTask.agent || this.settings.defaultOpencode2Agent || "build" : this.getEffectiveAgent(effectiveTask.agent);
        const launchOptions = {
          onError: (error: Error) => { void finish(error); },
          onLaunched: () => { void finish(); },
          linuxTerminal: this.settings.linuxTerminal,
          opencodeMajor: major as 1 | 2,
        };
        if (process.platform === "win32") {
          openOpencodeCliLongPromptWindows(bin, taskCwd, secretEnv, effectiveTask.model, effectiveTask.forceModel ? "" : agent, prompt, launchOptions);
        } else {
          const args = openCodeInteractiveArgs(major, effectiveTask.model, effectiveTask.forceModel ? "" : agent, prompt);
          openOpencodeCli(bin, taskCwd, secretEnv, args, launchOptions);
        }
      } catch (e) {
        await finish(e instanceof Error ? e : new Error(String(e)));
      }
      return;
    }

    this.settings.tasks[idx].status = "running";
    this.settings.tasks[idx].lastRun = new Date().toISOString();
    this.settings.tasks[idx].output = "[starting detached process…]\n";
    this.view?.resetDashboardTaskShift(task.id);
    await this.saveSettings();

    if (!this.isLegacyCurrent(attempt)) return;
    this.finishLegacyStart(attempt);
    new Notice(`AutoOC: running "${task.name}"…`);

    const args = this.buildArgs(effectiveTask);
    const bin = checkedOpenCode2Bin || args[0];
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
    const outFile = require("path").join(tmpDir, `autooc-${task.id}-${attempt.identity.token}.txt`);
    const errFile = require("path").join(tmpDir, `autooc-${task.id}-${attempt.identity.token}.err.txt`);
    const doneFile = require("path").join(tmpDir, `autooc-${task.id}-${attempt.identity.token}.done.txt`);
    const pidFile = require("path").join(tmpDir, `autooc-${task.id}-${attempt.identity.token}.pid`);
    const promptFile = require("path").join(tmpDir, `autooc-${task.id}-${attempt.identity.token}.prompt.txt`);
    const tmpFullPromptFile = require("path").join(tmpDir, `autooc-${task.id}-${attempt.identity.token}.full-prompt.txt`);
    let fullPromptFile = require("path").resolve(taskCwd, `.autooc-${task.id}-${attempt.identity.token}.full-prompt.txt`);
    const fs = require("fs");

    // Clean up any previous temp files
    try { fs.unlinkSync(outFile); } catch { /* ignore */ }
    try { fs.unlinkSync(errFile); } catch { /* ignore */ }
    try { fs.unlinkSync(doneFile); } catch { /* ignore */ }
    try { fs.unlinkSync(pidFile); } catch { /* ignore */ }
    try { fs.unlinkSync(promptFile); } catch { /* ignore */ }
    try { fs.unlinkSync(fullPromptFile); } catch { /* ignore */ }
    try { fs.unlinkSync(tmpFullPromptFile); } catch { /* ignore */ }

    // Long prompts are externalized to avoid command-line length limits; opencode
    // is asked to read the full prompt from the workspace temp file instead.
    // Workflow handoff prompts are always externalized so the full context is
    // passed through the workspace file even when the prompt is short.
    if (preparedPrompt.length > SAFE_CLI_PROMPT_LENGTH || prompt.includes("WORKFLOW HANDOFF CONTEXT")) {
      try {
        fs.writeFileSync(fullPromptFile, prompt, "utf8");
      } catch {
        fullPromptFile = tmpFullPromptFile;
        fs.writeFileSync(fullPromptFile, prompt, "utf8");
      }
      const location = fullPromptFile === tmpFullPromptFile ? "temp file" : "workspace file";
      const shortPrompt = `Read the complete task prompt and workflow context from the ${location} at ${fullPromptFile} and follow it exactly.`;
      fs.writeFileSync(promptFile, shortPrompt, "utf8");
    } else {
      fs.writeFileSync(promptFile, preparedPrompt, "utf8");
    }

    // Resolve working directory: Task override -> Global Setting -> Vault Path
    const safeCwd = taskCwd.replace(/'/g, "''");

    // Git branch logic (platform-specific shell)
    let gitCmds = "";
    if (effectiveTask.branch) {
      if (isWindows()) {
        const safeBranch = psSingleQuoted(effectiveTask.branch);
        if (effectiveTask.createBranch) {
          gitCmds = `$safeBranch = ${safeBranch}; $timestamp = Get-Date -Format "yyyyMMdd-HHmm"; $branchName = $safeBranch + "-$timestamp"; git checkout -b $branchName 2>$null; if ($?) { echo "Created branch $branchName" } else { git checkout $safeBranch }`;
        } else {
          gitCmds = `$safeBranch = ${safeBranch}; git checkout $safeBranch`;
        }
      } else {
        const safeBranch = shSingleQuoted(effectiveTask.branch);
        if (effectiveTask.createBranch) {
          gitCmds = `safe_branch=${safeBranch}\nbranch_name="$safe_branch-$(date +%Y%m%d-%H%M)"\ngit checkout -b "$branch_name" 2>/dev/null\nif [ $? -eq 0 ]; then echo "Created branch $branch_name"; else git checkout "$safe_branch"; fi`;
        } else {
          gitCmds = `git checkout ${safeBranch}`;
        }
      }
    }

    const effectiveAgent = effectiveTask.taskKind === "opencode2" ? effectiveTask.agent || this.settings.defaultOpencode2Agent || "build" : this.getEffectiveAgent(effectiveTask.agent);

    const launchScript = buildOpenCodeScript({pidFile, secretEnv, safeCwd, gitCmds, bin, model, effectiveAgent, effectiveTask, promptFile, outFile, errFile, doneFile, taskCwd, major: effectiveTask.taskKind === "opencode2" ? 2 : 1});

    const scriptFile = require("path").join(tmpDir, `autooc-${task.id}-${attempt.identity.token}${scriptExt()}`);
    if (isWindows()) writeUtf8BomFile(scriptFile, launchScript);
    else fs.writeFileSync(scriptFile, launchScript, "utf8");

    let hiddenProc: HiddenProcessHandle;
    try {
      hiddenProc = launchHidden(scriptFile, pidFile);
    } catch (error) {
      const current = this.settings.tasks[idx];
      current.status = "failed";
      current.lastRun = new Date().toISOString();
      current.output = `[AutoOC] Task launcher failed: ${String(error)}`;
      await this.saveSettings();
      new Notice(`AutoOC: could not launch "${task.name}".`);
      if (onComplete) await onComplete(current, -1);
      return;
    }
    let settled = false;
    let cancelled = false;
    let pollHandle: ReturnType<typeof setInterval> | null = null;
    const wasManuallyStopped = (current: ScheduledTask) => !this.isLegacyCurrent(attempt) || cancelled || current.output.includes("[task stopped manually]");
    const shouldAbortBeforeFinalMutation = (current: ScheduledTask) => wasManuallyStopped(current) || current.status !== "running";
    const cleanupTempFiles = () => {
      hiddenProc.cleanup(true);
      try { fs.unlinkSync(promptFile); } catch { /* ignore */ }
      try { fs.unlinkSync(fullPromptFile); } catch { /* ignore */ }
      try { fs.unlinkSync(tmpFullPromptFile); } catch { /* ignore */ }
      try { fs.unlinkSync(outFile); } catch { /* ignore */ }
      try { fs.unlinkSync(errFile); } catch { /* ignore */ }
      try { fs.unlinkSync(doneFile); } catch { /* ignore */ }
      try { fs.unlinkSync(pidFile); } catch { /* ignore */ }
    };
    const controller = {
      kill: () => {
        cancelled = true;
        settled = true;
        if (pollHandle) {
          clearInterval(pollHandle);
          pollHandle = null;
        }
        hiddenProc.kill();
        cleanupTempFiles();
        if (this.runningProcesses.get(task.id) === controller) this.runningProcesses.delete(task.id);
      },
    };
    attempt.handle = controller;
    this.runningProcesses.set(task.id, controller);
    hiddenProc.onError(async (error) => {
      if (!this.isLegacyCurrent(attempt) || settled) return;
      settled = true;
      if (pollHandle) clearInterval(pollHandle);
      const current = this.settings.tasks.find((candidate) => candidate.id === task.id);
      if (!current || current.status !== "running") return;
      current.status = "failed";
      current.lastRun = new Date().toISOString();
      current.output = `[AutoOC] Task launcher failed: ${String(error)}`;
      cleanupTempFiles();
      if (this.runningProcesses.get(task.id) === controller) this.runningProcesses.delete(task.id);
      await this.saveSettings();
      new Notice(`AutoOC: could not launch "${task.name}".`);
      if (onComplete) await onComplete(current, -1);
    });

    const timeoutSeconds = this.settings.taskTimeoutSeconds ?? DEFAULT_TASK_TIMEOUT_SECONDS;
    const timeoutEnabled = timeoutSeconds > 0;
    const timeoutMs = timeoutSeconds * 1000;
    const startedAt = Date.now();
    let timeoutWarned = false;

    // Poll the output file every 3 s
    pollHandle = setInterval(async () => {
      if (!this.isLegacyCurrent(attempt) || settled || cancelled) return;
      const t = this.settings.tasks.find((x) => x.id === task.id);
      if (!t) {
        settled = true;
        if (pollHandle) clearInterval(pollHandle);
        pollHandle = null;
        cleanupTempFiles();
        if (this.runningProcesses.get(task.id) === controller) this.runningProcesses.delete(task.id);
        return;
      }
      if (t.status !== "running" && !this.runningProcesses.has(task.id)) {
        cancelled = true;
        if (pollHandle) clearInterval(pollHandle);
        pollHandle = null;
        cleanupTempFiles();
        return;
      }

      // Soft timeout: warn once, but keep polling because OpenCode may still finish successfully.
      if (timeoutEnabled && !timeoutWarned && Date.now() - startedAt > timeoutMs) {
        timeoutWarned = true;
        t.output += `\n[⏱ timeout warning: ${timeoutSeconds}s exceeded; still waiting for final result]`;
        await this.saveSettings(false);
        if (!this.isLegacyCurrent(attempt)) return;
        new Notice(`AutoOC: ⏱ "${task.name}" exceeded ${timeoutSeconds}s; still waiting.`);
      }

      if (timeoutEnabled && timeoutWarned && Date.now() - startedAt > timeoutMs + 300_000) {
        if (shouldAbortBeforeFinalMutation(t)) return;
        settled = true;
        if (pollHandle) clearInterval(pollHandle);
        pollHandle = null;
        hiddenProc.kill();
        if (this.runningProcesses.get(task.id) === controller) this.runningProcesses.delete(task.id);
        cleanupTempFiles();

        if (shouldAbortBeforeFinalMutation(t)) return;
        t.status = "failed";
        t.output += `\n[⏱ timed out after ${timeoutSeconds}s + 300s grace; no completion marker was written]`;
        this.view?.startGradualSink(task.id);
        if (wasManuallyStopped(t)) return;
        await this.saveSettings();
        if (wasManuallyStopped(t)) return;
        if (onComplete) await onComplete(t, -1);
        new Notice(`AutoOC: ⏱ "${task.name}" timed out.`);
        return;
      }

      if (!fs.existsSync(doneFile)) {
        const stdout = fs.existsSync(outFile) ? decodeCommandBuffer(fs.readFileSync(outFile)) : "";
        const stderr = fs.existsSync(errFile) ? decodeCommandBuffer(fs.readFileSync(errFile)) : "";
        const normalized = this.redactSecrets(formatTaskOutput(stdout, stderr));
        if (normalized) {
          t.output = `${normalized}\n[running…]`;
        } else if (!t.output.includes("[running…]")) {
          t.output += `${t.output ? "\n" : ""}[running…]`;
        }
        this.view?.nudgeDashboardTask(task.id, "up");
        await this.saveSettings(false);
        return;
      }

      // File exists — read result
      if (settled || shouldAbortBeforeFinalMutation(t)) return;
      settled = true;
      if (pollHandle) clearInterval(pollHandle);
      pollHandle = null;
      if (this.runningProcesses.get(task.id) === controller) this.runningProcesses.delete(task.id);

      const stdout = fs.existsSync(outFile) ? decodeCommandBuffer(fs.readFileSync(outFile)) : "";
      const stderr = fs.existsSync(errFile) ? decodeCommandBuffer(fs.readFileSync(errFile)) : "";
      const exitCodeRaw = fs.readFileSync(doneFile, "utf8").trim();
      cleanupTempFiles();

      if (shouldAbortBeforeFinalMutation(t)) return;

      const exitCode = /^-?\d+$/.test(exitCodeRaw) ? parseInt(exitCodeRaw, 10) : -1;
      const normalized = this.redactSecrets(formatTaskOutput(stdout, stderr));

      if (shouldAbortBeforeFinalMutation(t)) return;
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
        if (wasManuallyStopped(t)) return;
        await this.saveSettings();

      if (wasManuallyStopped(t)) return;
      if (onComplete) {
        await onComplete(t, exitCode);
      }
    }, 3000);
  }

  async runCopilotTask(
    task: ScheduledTask,
    onComplete?: (task: ScheduledTask, exitCode: number) => Promise<void>,
    owner?: LegacyOwner,
    reserved?: LegacyAttempt,
  ): Promise<void> {
    assertNoRetiredDependency(this.settings.tasks.find(t => t.id === task.id) || task);
    const findCurrent = () => this.settings.tasks.find((candidate) => candidate.id === task.id);
    let current = findCurrent();
    if (!current) return;
    const attempt = reserved || this.beginLegacyAttempt(task, owner);
    onComplete = this.legacyCompletion(attempt, onComplete);
    const vaultBasePath = (this.app.vault.adapter as any).basePath || ".";
    const cwd = task.workingDirectory || this.settings.workingDirectory || vaultBasePath;
    const model = task.model?.trim() || this.settings.defaultCopilotModel || "";
    const startedAt = new Date().toISOString();
    let cancelled = false;
    let client: CopilotCliClient | undefined;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    let exitCode = -1;
    const controller = { kill: () => { cancelled = true; client?.dispose(); } };
    current.status = "running";
    current.lastRun = startedAt;
    current.output = "[starting GitHub Copilot CLI task…]\n";
    attempt.handle = controller;
    this.runningProcesses.set(task.id, controller);
    this.view?.resetDashboardTaskShift(task.id);
    try {
      await this.saveSettings();
      if (!this.isLegacyCurrent(attempt) || cancelled) return;
      this.finishLegacyStart(attempt);
      const validationError = getCopilotTaskValidationError(task);
      if (validationError) throw new Error(validationError);
      if (!task.prompt?.trim()) throw new Error("Copilot task prompt is empty.");
      client = this.createCopilotClient(cwd, (output) => {
        const active = findCurrent();
        if (!this.isLegacyCurrent(attempt) || cancelled || !active || active.status !== "running") return;
        active.output = this.redactSecrets(output);
        if (!saveTimer) {
          saveTimer = setTimeout(() => {
            saveTimer = undefined;
            const activeTask = findCurrent();
            if (!this.isLegacyCurrent(attempt) || cancelled || !activeTask || activeTask.status !== "running") return;
            this.emitTaskUpdated(activeTask);
            void this.saveSettings(false);
          }, 750);
        }
      });
      const result = await client.run(task.prompt, {
        model,
        allowAllTools: task.copilotAllowAllTools === true,
        timeoutMs: Math.max(0, this.settings.taskTimeoutSeconds ?? DEFAULT_TASK_TIMEOUT_SECONDS) * 1000,
        env: {},
      });
      current = findCurrent();
      if (!this.isLegacyCurrent(attempt) || cancelled || !current || current.status !== "running") return;
      exitCode = result.exitCode;
      current.output = this.redactSecrets(result.output || (result.exitCode === 0 ? "(no output)" : ""));
      if (result.exitCode !== 0) {
        current.output += `\n[Copilot error: ${this.redactSecrets(result.error || `exit code ${result.exitCode}`)}]`;
      }
      current.status = exitCode === 0
        ? (["daily", "weekly", "monthly", "interval"].includes(task.scheduleType) ? "pending" : "completed")
        : "failed";
    } catch (error) {
      current = findCurrent();
      if (!this.isLegacyCurrent(attempt) || cancelled || !current) return;
      current.status = "failed";
      current.output = `${current.output || ""}\n[Copilot error: ${this.redactSecrets(String(error))}]`;
    } finally {
      if (saveTimer) clearTimeout(saveTimer);
      if (this.runningProcesses.get(task.id) === controller) this.runningProcesses.delete(task.id);
      if (!cancelled) client?.dispose();
    }
    current = findCurrent();
    if (!this.isLegacyCurrent(attempt) || !current || cancelled) return;
    if (current.status === "failed") this.view?.startGradualSink(task.id);
    if (this.settings.logsEnabled) {
      const metadata = `[engine: copilot]\n[model: ${this.redactSecrets(model || "default")}]\n[started: ${startedAt}]\n[finished: ${new Date().toISOString()}]`;
      saveLogToFile(vaultBasePath, task.id, `${metadata}\n\n${current.output}`);
      cleanupOldLogs(vaultBasePath, task.id, this.settings.maxLogsPerTask);
      cleanupLogsByAge(vaultBasePath, task.id, this.settings.logRetentionDays);
    }
    await this.saveSettings();
    if (!this.isLegacyCurrent(attempt)) return;
    this.emitTaskUpdated(current);
    new Notice(`AutoOC: ${exitCode === 0 ? "✅" : "❌"} Copilot task "${task.name}" ${exitCode === 0 ? "completed" : "failed"}.`);
    if (onComplete) await onComplete(current, exitCode);
  }

  createCopilotClient(cwd: string, onOutput: (output: string) => void): CopilotCliClient {
    return new CopilotCliClient(resolveCopilotBin(this.settings.copilotPath), cwd, onOutput);
  }

  async runCodexTask(
    task: ScheduledTask,
    onComplete?: (task: ScheduledTask, exitCode: number) => Promise<void>,
    owner?: LegacyOwner,
    reserved?: LegacyAttempt,
  ): Promise<void> {
    assertNoRetiredDependency(this.settings.tasks.find(t => t.id === task.id) || task);
    const idx = this.settings.tasks.findIndex((candidate) => candidate.id === task.id);
    if (idx === -1) return;
    let current = this.settings.tasks[idx];
    const attempt = reserved || this.beginLegacyAttempt(task, owner);
    onComplete = this.legacyCompletion(attempt, onComplete);
    const isCurrent = () => {
      const owned = this.isLegacyCurrent(attempt);
      if (owned) current = attempt.task;
      return owned;
    };
    if (!task.prompt?.trim()) {
      current.status = "failed";
      current.lastRun = new Date().toISOString();
      current.output = "[AutoOC] Codex task not launched: prompt is empty.";
      await this.saveSettings();
      if (onComplete) await onComplete(current, -1);
      return;
    }

    const vaultBasePath = (this.app.vault.adapter as any).basePath || ".";
    const taskCwd = task.workingDirectory || this.settings.workingDirectory || vaultBasePath;
    const model = this.getEffectiveCodexModel(task.model);
    const reasoningEffort = task.reasoningEffort || this.settings.defaultCodexReasoningEffort || "medium";
    const startedAt = new Date().toISOString();
    let cancelled = false;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    let codexLogOutput = "";
    let client: CodexAppServerClient | undefined;
    const controller = {kill: async () => {
      cancelled = true;
      if (saveTimer) clearTimeout(saveTimer);
      if (this.runningCodexClients.get(task.id) === client) this.runningCodexClients.delete(task.id);
      await client?.interrupt();
    }};
    attempt.handle = controller;
    this.runningProcesses.set(task.id, controller);

    current.status = "running";
    current.lastRun = startedAt;
    current.output = "[starting Codex task…]\n";
    delete current.pendingCodexApproval;
    this.view?.resetDashboardTaskShift(task.id);
    await this.saveSettings();
    if (!isCurrent()) return;
    this.finishLegacyStart(attempt);
    new Notice(`AutoOC: running Codex task "${task.name}"…`);

    const scheduleSave = () => {
      if (saveTimer) return;
      saveTimer = setTimeout(() => {
        saveTimer = null;
        if (!isCurrent()) return;
        void this.saveSettings(false).catch(() => {
          new Notice("AutoOC: could not persist Codex progress; previous settings were preserved.");
        });
      }, 10_000);
    };
    client = this.createCodexClient(taskCwd, {
      onStarted: ({ threadId, turnId }) => {
        if (!isCurrent()) return;
        current.lastCodexThreadId = threadId;
        current.lastCodexTurnId = turnId;
        if (task.interactiveTerminal) {
          const bin = resolveCodexBin(this.settings.codexPath);
          openCodexApp(bin, taskCwd, (error) => {
            new Notice(`AutoOC: Codex started, but ChatGPT could not be opened: ${String(error)}`);
          });
          new Notice(`AutoOC: opened ChatGPT / Codex task "${task.name}".`);
        }
        scheduleSave();
      },
      onOutput: (output) => {
        if (!isCurrent() || cancelled || current.status !== "running") return;
        current.output = this.redactSecrets(output || "[Codex is working…]");
        this.view?.nudgeDashboardTask(task.id, "up");
        this.emitTaskUpdated(current);
        scheduleSave();
      },
      onApproval: (approval) => {
        if (!isCurrent() || cancelled || current.status !== "running") return;
        current.pendingCodexApproval = {
          requestId: approval.requestId,
          kind: approval.kind,
          summary: approval.summary,
        };
        current.output += `${current.output ? "\n" : ""}[waiting for approval: ${approval.summary}]`;
        void this.saveSettings(false);
        this.emitTaskUpdated(current);
        new Notice(`AutoOC: Codex task "${task.name}" needs approval.`);
      },
    });
    this.runningCodexClients.set(task.id, client);

    let exitCode = -1;
    try {
      const result = await executeCodexTask(client, {
        prompt: task.prompt, model, reasoningEffort, interactive: task.interactiveTerminal,
      });
      if (!isCurrent() || cancelled || current.status !== "running") return;
      current.lastCodexThreadId = result.threadId;
      current.lastCodexTurnId = result.turnId;
      delete current.pendingCodexApproval;
      const successful = result.status === "completed";
      exitCode = successful ? 0 : -1;
      const finalOutput = this.redactSecrets(result.output || result.error || "(no output)");
      const metadata = [
        `[engine: codex]`,
        `[model: ${model || "default"}]`,
        `[reasoning: ${reasoningEffort || "default"}]`,
        `[thread: ${result.threadId}]`,
        `[turn: ${result.turnId}]`,
      ].join("\n");
      current.output = finalOutput;
      if (successful) {
        current.status = task.scheduleType === "daily" || task.scheduleType === "weekly" || task.scheduleType === "monthly" || task.scheduleType === "interval" ? "pending" : "completed";
        new Notice(`AutoOC: ✅ Codex task "${task.name}" completed.`);
      } else {
        current.status = "failed";
        current.output += `\n[Codex status: ${result.status}]`;
        this.view?.startGradualSink(task.id);
        new Notice(`AutoOC: ❌ Codex task "${task.name}" failed.`);
      }
      codexLogOutput = `${metadata}\n[started: ${startedAt}]\n[finished: ${new Date().toISOString()}]\n\n${this.redactSecrets(result.transcript || current.output)}`;
    } catch (error) {
      if (!isCurrent() || cancelled || current.output.includes("[task stopped manually]")) return;
      current.status = "failed";
      delete current.pendingCodexApproval;
      current.output = `${current.output || ""}\n[Codex error: ${String(error)}]`.trim();
      const ids = client.getIds();
      codexLogOutput = `[engine: codex]\n[model: ${model || "default"}]\n[reasoning: ${reasoningEffort || "default"}]\n[thread: ${ids.threadId || "unavailable"}]\n[turn: ${ids.turnId || "unavailable"}]\n[started: ${startedAt}]\n[finished: ${new Date().toISOString()}]\n\n${current.output}`;
      this.view?.startGradualSink(task.id);
      new Notice(`AutoOC: ❌ Codex task "${task.name}" failed.`);
    } finally {
      if (saveTimer) clearTimeout(saveTimer);
      if (this.runningCodexClients.get(task.id) === client) this.runningCodexClients.delete(task.id);
      if (this.runningProcesses.get(task.id) === controller) this.runningProcesses.delete(task.id);
      client.dispose();
    }

    if (!isCurrent()) return;
    if (this.settings.logsEnabled) {
      saveLogToFile(vaultBasePath, task.id, codexLogOutput || current.output);
      cleanupOldLogs(vaultBasePath, task.id, this.settings.maxLogsPerTask);
      cleanupLogsByAge(vaultBasePath, task.id, this.settings.logRetentionDays);
    }
    await this.saveSettings();
    if (!isCurrent()) return;
    this.emitTaskUpdated(current);
    if (onComplete) await onComplete(current, exitCode);
  }

  createCodexClient(
    cwd: string,
    callbacks: ConstructorParameters<typeof CodexAppServerClient>[2],
  ): CodexAppServerClient {
    return new CodexAppServerClient(resolveCodexBin(this.settings.codexPath), cwd, callbacks);
  }

  async resolveCodexApproval(taskId: string, approved: boolean): Promise<void> {
    const task = this.settings.tasks.find((candidate) => candidate.id === taskId);
    const execution=(task as any)?.runtimeExecution;
    if(this.sharedWorkflowExecution && execution && task?.pendingCodexApproval) {
      const directory=this.selectedExecutionLocation().runtimeDirectory;
      if (!this.ownsSharedRun(execution.workflowId,execution.runId)) throw new Error("Approval does not belong to the active execution");
      answerWorkflowApproval(directory,execution.runId,String(task.pendingCodexApproval.requestId),approved);
      return;
    }
    const client = this.runningCodexClients.get(taskId);
    const approval = task?.pendingCodexApproval;
    if (!task || !client || !approval) {
      new Notice("AutoOC: this Codex approval is no longer active.");
      return;
    }
    if (!client.resolveApproval(approval.requestId, approved)) {
      new Notice("AutoOC: could not answer the Codex approval.");
      return;
    }
    task.output += `\n[approval ${approved ? "accepted" : "rejected"}]`;
    delete task.pendingCodexApproval;
    await this.saveSettings(false);
    this.emitTaskUpdated(task);
  }

  private vaultRefresh?: ObsidianVaultRefresh;
  private vaultRefreshStopped = false;
  private codeTaskRuns = new Map<string, object>();

  private createVaultMutationBatch() {
    if (this.vaultRefreshStopped) throw new Error("Plugin unloaded before Code execution");
    this.vaultRefresh ??= new ObsidianVaultRefresh((this.app.vault.adapter as any).basePath || ".", this.app.vault.adapter);
    return this.vaultRefresh.createBatch();
  }

  async runCodeTask(
    task: ScheduledTask,
    onComplete?: (task: ScheduledTask, exitCode: number) => Promise<void>,
    owner?: LegacyOwner,
    reserved?: LegacyAttempt,
  ) {
    assertNoRetiredDependency(this.settings.tasks.find(t => t.id === task.id) || task);
    this.assertLifecycleOpen();
    const idx = this.settings.tasks.findIndex((t) => t.id === task.id);
    if (idx === -1) return;
    let current = this.settings.tasks[idx];
    const attempt = reserved || this.beginLegacyAttempt(task, owner);
    onComplete = this.legacyCompletion(attempt, onComplete);
    const isCurrent = () => {
      const owned = this.isLegacyCurrent(attempt);
      if (owned) current = attempt.task;
      return owned;
    };
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
    const execution = {};
    this.codeTaskRuns.set(current.id, execution);
    current.status = "running";
    current.lastRun = new Date().toISOString();
    current.output = "[running code task...]\n";
    this.view?.resetDashboardTaskShift(current.id);
    await this.saveSettings();
    new Notice(`AutoOC: running code task "${current.name}"...`);

    try {
      if (!isCurrent() || this.codeTaskRuns.get(current.id) !== execution || current.status !== "running") return;
      this.finishLegacyStart(attempt);
      const out = await runWithVaultMutations(()=>this.createVaultMutationBatch(), onVaultMutation => executeCodeTask({
        ...current, code, vaultBase: vaultBasePath,
        cwd: current.workingDirectory || this.settings.workingDirectory || vaultBasePath,
        log: (...args) => { if (!isCurrent()) return; current.output += this.redactSecrets(args.map(String).join(" ")) + "\n"; },
        onVaultMutation,
      }));
      if (!isCurrent() || this.codeTaskRuns.get(current.id) !== execution || current.status !== "running") return;
      current.output = this.redactSecrets((current.output || "") + out);
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
      if (!isCurrent() || this.codeTaskRuns.get(current.id) !== execution || current.status !== "running") return;
      current.status = "failed";
      current.output = this.redactSecrets((current.output || "") + `[code error: ${String(err)}]`);
      this.view?.startGradualSink(current.id);
      if (this.settings.logsEnabled) {
        saveLogToFile(vaultBasePath, current.id, current.output);
        cleanupOldLogs(vaultBasePath, current.id, this.settings.maxLogsPerTask);
        cleanupLogsByAge(vaultBasePath, current.id, this.settings.logRetentionDays);
      }
      await this.saveSettings();
      new Notice(`AutoOC: ❌ code task "${current.name}" failed.`);
      if (onComplete) await onComplete(current, -1);
    } finally {
      if (this.codeTaskRuns.get(current.id) === execution) this.codeTaskRuns.delete(current.id);
    }
  }

  taskStopIdentity(task: ScheduledTask): TaskStopIdentity | undefined {
    const attempt = this.legacyAttempts?.get(task.id);
    if (attempt && task.legacyExecution?.token === attempt.identity.token) return {...attempt.identity};
    if (task.legacyExecution) return {...task.legacyExecution};
    const binding = (task as any).runtimeExecution;
    return binding ? {kind:"shared",taskId:task.id,runId:binding.runId,workflowId:binding.workflowId,stepId:binding.stepId,stepIndex:binding.stepIndex} : undefined;
  }

  async killTask(id: string, observed?: TaskStopIdentity) {
    const task = this.settings.tasks.find(item => item.id === id);
    const registered = this.legacyAttempts?.get(id);
    const attempt = task?.legacyExecution?.token === registered?.identity.token ? registered : undefined;
    if (observed?.kind === "legacy" || attempt || task?.legacyExecution) {
      const keys = ["kind", "token", "taskId", "workflowId", "stepId", "stepIndex"] as const;
      if (!observed || observed.kind !== "legacy" || !attempt || !task ||
          task.legacyExecution?.token !== attempt.identity.token || !observed.token || observed.taskId !== id ||
          keys.some(key => observed[key] !== attempt.identity[key]) ||
          attempt.owner && (this as any).workflowRuntime?.get(attempt.owner.workflowId) !== attempt.owner.context && !attempt.cancelled) {
        throw new Error("Task execution changed or is not owned here; refresh or reconcile before stopping.");
      }
      if (attempt.stopPromise) return attempt.stopPromise;
      // Invalidate continuation synchronously, before interruption or persistence can yield.
      attempt.cancelled = true;
      const metadata = task.legacyExecution!;
      metadata.stopState = "requested";
      delete task.pendingCodexApproval;
      task.status = "failed";
      task.output += "\n[stop requested; external outcome unconfirmed]";
      if (attempt.owner) {
        const wf = this.settings.workflows.find(item => item.id === attempt.owner!.workflowId);
        if (wf && (this as any).workflowRuntime?.get(wf.id) === attempt.owner.context) {
          wf.status = "failed";
          (this as any).workflowRuntime.delete(wf.id);
        }
      }
      const handle = attempt.handle;
      if (this.runningProcesses.get(id) === handle) this.runningProcesses.delete(id);
      const ownerWorkflow = attempt.owner ? this.settings.workflows.find(item => item.id === attempt.owner!.workflowId) : undefined;
      const ownerExecution = ownerWorkflow?.legacyExecution;
      attempt.stopPromise = (async () => {
        try { await handle?.kill(); metadata.stopState = "unconfirmed"; }
        catch (error) { metadata.stopState = "error"; metadata.stopError = this.redactSecrets(String(error)); }
        // Metadata belongs to this attempt, not to a replacement task/attempt.
        if (this.legacyAttempts?.get(id) === attempt && task.legacyExecution === metadata) {
          await this.saveSettings();
          if (this.legacyAttempts?.get(id) !== attempt || task.legacyExecution !== metadata ||
              ownerWorkflow?.legacyExecution !== ownerExecution) return "stop-requested";
          new Notice(metadata.stopState === "error" ? `AutoOC: Stop request failed: ${metadata.stopError}. Outcome unconfirmed.` :
            "AutoOC: Stop requested; external outcome unconfirmed. Continuation disabled.");
        }
        return "stop-requested";
      })();
      return attempt.stopPromise;
    }
    const binding = this.taskStopIdentity(task || {id} as ScheduledTask);
    const execution = this.sharedExecution(observed?.workflowId,undefined,observed?.runId) || this.sharedExecution(undefined,id);
    if (observed || binding || execution?.taskId === id) {
      if (observed && observed.kind !== "shared") throw new Error("Task execution changed or is not owned here");
      const checkpoint = execution?.checkpoint;
      const active = checkpoint?.steps[checkpoint.steps.length - 1];
      const step = this.settings.workflows.find(workflow => workflow.id === observed?.workflowId)?.steps.find(step => step.id === observed?.stepId);
      const sameBinding = observed && binding && Object.keys(observed).every(key => (observed as any)[key] === (binding as any)[key]);
      const referencesTask = execution?.taskId === id || step?.taskId === id && (!step.stepKind || step.stepKind === "task");
      if (!observed || observed.taskId !== id || !observed.runId || !observed.workflowId || !observed.stepId || !Number.isSafeInteger(observed.stepIndex) ||
          !sameBinding || !execution || !checkpoint || !this.ownsSharedRun(observed.workflowId, observed.runId) ||
          checkpoint.runId !== observed.runId || checkpoint.workflowId !== observed.workflowId || checkpoint.phase !== "in_flight" ||
          checkpoint.nextStepId !== observed.stepId || active?.stepId !== observed.stepId || active.status !== "in_flight" ||
          checkpoint.steps.length - 1 !== observed.stepIndex || !referencesTask) {
        throw new Error("Task execution changed or is not owned here; refresh or reconcile before stopping.");
      }
      if (!execution.controller.signal.aborted) {
        execution.controller.abort();
        new Notice("AutoOC: Stop requested; awaiting the observed outcome. Reconciliation may be required.");
      }
      return "stop-requested";
    }
    throw new Error("Task execution changed or is not owned here; refresh or reconcile before stopping.");
  }

  async killWorkflow(id: string, expectedRunId?:string) {
    const shared=this.sharedExecution(id);
    if(expectedRunId && shared?.runId!==expectedRunId)throw new Error("Workflow execution changed; refresh before stopping");
    if (shared) {
      shared.controller.abort();
      return;
    }
    const wf = this.settings.workflows.find((w) => w.id === id);
    if (!wf) return;

    const context = (this as any).workflowRuntime?.get(id);
    if (!context) return;
    const startToken = this.definitionStarts?.get(`workflow:${id}`);
    const execution = wf.legacyExecution;
    const stepIndex = wf.currentStep, step = wf.steps[stepIndex];
    const attempt = step?.taskId ? this.legacyAttempts?.get(step.taskId) : undefined;
    const owned = !!attempt && attempt.owner?.context === context && attempt.identity.workflowId === id &&
      attempt.identity.stepId === step?.id && attempt.identity.stepIndex === stepIndex;
    // Invalidate before awaiting a handle. Never sweep tasks by shared taskId.
    wf.status = "failed";
    this.workflowDelayControllers.get(id)?.abort();
    if (owned) await this.killTask(attempt!.identity.taskId, {...attempt!.identity});
    else if ((this as any).workflowRuntime?.get(id) === context) (this as any).workflowRuntime.delete(id);
    if ((this as any).workflowRuntime?.has(id)) return;
    await this.saveSettings();
    if (wf.legacyExecution !== execution || (this as any).workflowRuntime?.has(id)) return;
    if (this.definitionStarts?.get(`workflow:${id}`) === startToken) this.definitionStarts?.delete(`workflow:${id}`);
    this.refreshStartControls();
    new Notice(`AutoOC: Workflow "${wf.name}" continuation stopped; external task outcome may be unconfirmed.`);
  }

  async runDueAll() {
    if (this.lifecycleStopped || this.startupPending || this.updateInProgress || this.bulkCatalogMutationInProgress) return;
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
      if (this.bulkCatalogMutationInProgress) return;
      if (this.definitionDisabledReason("task", dueTasks[i].id)) continue;
      const error = autoOCDependencyError(dueTasks[i]);
      if (error) { new Notice(error); continue; }
      await this.runTask(dueTasks[i]);
      if (i < dueTasks.length - 1) await delay(DUE_LAUNCH_GAP_MS);
    }
  }

  async runDueWorkflows() {
    const dueWorkflows = this.settings.workflows.filter((wf) => isWorkflowDue(wf));
    for (let i = 0; i < dueWorkflows.length; i++) {
      if (this.bulkCatalogMutationInProgress) return;
      if (this.definitionDisabledReason("workflow", dueWorkflows[i].id)) continue;
      try { assertWorkflowDependencies(dueWorkflows[i], this.settings.tasks); }
      catch (error) { new Notice(String(error)); continue; }
      await this.runWorkflow(dueWorkflows[i]);
      if (i < dueWorkflows.length - 1) await delay(DUE_LAUNCH_GAP_MS);
    }
  }

  async deleteTask(id: string) {
    this.settings.tasks = this.settings.tasks.filter((t) => t.id !== id);
    await this.saveSettings();
  }

  async duplicateTask(task: ScheduledTask) {
    const { runtimeExecution, legacyExecution, lastCodexThreadId, lastCodexTurnId,
      pendingCodexApproval, ...definition } = task as ScheduledTask & { runtimeExecution?: unknown };
    const copy: ScheduledTask = {
      ...definition,
      id: generateId(),
      name: `${task.name} (copy)`,
      scheduleDays: [...(task.scheduleDays || [])],
      scheduleMonthDays: [...(task.scheduleMonthDays || [])],
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
  }

  async duplicateWorkflow(workflow: Workflow) {
    const { runtimeExecution, legacyExecution, ...definition } = workflow as Workflow & { runtimeExecution?: unknown };
    const copy: Workflow = {
      ...definition,
      id: generateId(),
      name: `${workflow.name} (copy)`,
      steps: workflow.steps.map((step) => ({
        ...step,
        codeExecution: undefined,
        transitions: step.transitions?.map((transition) => ({ ...transition })),
        position: step.position ? { ...step.position } : undefined,
        status: "pending",
        output: "",
        lastRun: undefined,
      })),
      scheduleDays: [...(workflow.scheduleDays || [])],
      scheduleMonthDays: [...(workflow.scheduleMonthDays || [])],
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
        schemaVersion: tasks.some((task) => task.taskKind === "copilot") ? "1.6.0" : "1.5.0",
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
    // Accept legacy schemas, Codex 1.5 and Copilot 1.6 packages.
    const sv = data.autoOCExport.schemaVersion;
    if (sv !== "1.0" && sv !== "1.4.0" && sv !== "1.5.0" && sv !== "1.6.0") {
      throw new Error(`Unsupported AutoOC export schema version: ${sv}.`);
    }

    for(const item of [...(data.tasks || []),...(data.workflows || [])]) { validateConcurrency(item); validateDisabled(item); }
    for (const workflow of data.workflows || []) for (const step of workflow.steps || []) validateDisabled(step);
    const exportIdToTaskId = new Map<string, string>();
    let tasksImported = 0;

    for (const et of data.tasks || []) {
      const importedTaskKind = et.taskKind || "opencode";
      if (importedTaskKind === "opencode2" && et.useRalphLoop) throw new Error("Ralph Loop integration is only supported for OpenCode 1 tasks.");
      if (!["opencode", "opencode2", "codex", "copilot", "code"].includes(importedTaskKind)) {
        throw new Error(`Unsupported taskKind: ${String(importedTaskKind)}.`);
      }
      const copilotError = getCopilotTaskValidationError(et);
      if (copilotError) throw new Error(`Task "${et.name}": ${copilotError}`);
      if (et.reasoningEffort !== undefined && (importedTaskKind !== "codex" || typeof et.reasoningEffort !== "string" || !et.reasoningEffort.trim())) {
        throw new Error(`Task "${et.name}" has reasoningEffort outside a Codex task.`);
      }
      if (importedTaskKind === "code" && et.interactiveTerminal === true) {
        throw new Error(`Task "${et.name}" cannot combine Code with interactiveTerminal.`);
      }
      const task: ScheduledTask = {
        id: generateId(),
        taskKind: importedTaskKind,
        requiresAutoOCSecrets: et.requiresAutoOCSecrets,
        name: this.ensureUniqueTaskName(et.name),
        area: et.area ?? "",
        prompt: importedTaskKind === "code" ? (et.code || et.prompt || "") : et.prompt,
        model: importedTaskKind === "code" ? "" : importedTaskKind === "copilot" ? this.settings.defaultCopilotModel || "" : importedTaskKind === "codex" ? this.getEffectiveCodexModel() : importedTaskKind === "opencode2" ? this.settings.defaultOpencode2Model || "" : this.getEffectiveDefaultModel(),
        copilotAllowAllTools: importedTaskKind === "copilot" ? et.copilotAllowAllTools === true : undefined,
        agent: importedTaskKind === "opencode2" ? et.agent || this.settings.defaultOpencode2Agent || "build" : importedTaskKind === "opencode" ? this.getEffectiveAgent(et.agent) : "",
        reasoningEffort: importedTaskKind === "codex" ? (et.reasoningEffort || this.settings.defaultCodexReasoningEffort) : undefined,
        useRalphLoop: importedTaskKind === "opencode" ? (et.useRalphLoop ?? false) : false,
        forceModel: isOpenCodeTask(importedTaskKind) ? (et.forceModel ?? false) : false,
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
        concurrency: et.concurrency,
        disabled: et.disabled,
        workingDirectory: et.workingDirectory,
        branch: isOpenCodeTask(importedTaskKind) ? et.branch : "",
        createBranch: isOpenCodeTask(importedTaskKind) ? et.createBranch : false,
        interactiveTerminal: importedTaskKind === "code"
          ? undefined
          : (et.interactiveTerminal ?? (isOpenCodeTask(importedTaskKind) ? this.settings.defaultInteractiveTerminal : false)),
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
      for (const s of ew.steps || []) {
        const stepKind: StepKind = (s as any).stepKind || "task";
        const importedTransitions = (s as { transitions?: unknown }).transitions;
        const hasImportedTransitions = Object.prototype.hasOwnProperty.call(s, "transitions");
        const step: WorkflowStep = {
          id: (s as any).id || generateId(),
          disabled: s.disabled,
          stepKind,
          requiresAutoOCSecrets: s.requiresAutoOCSecrets,
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
          transitions: !hasImportedTransitions
            ? undefined
            : Array.isArray(importedTransitions)
            ? importedTransitions
            : importedTransitions && typeof importedTransitions === "object" && typeof (importedTransitions as { toStepId?: unknown }).toStepId === "string"
              ? [importedTransitions as WorkflowTransition]
              : [],
          position: (s as any).position,
        };
        steps.push(step);
        exportIdToStepId.set(step.id, step.id);
      }

      // Legacy exports omit transitions; fill only those gaps after every step
      // has been retained in its original input position.
      const { applyLegacyLinearTransitions } = require("./import-utils");
      applyLegacyLinearTransitions(steps);

      if (steps.length === 0) continue;

      const workflow: Workflow = {
        id: generateId(),
        requiresAutoOCSecrets: ew.requiresAutoOCSecrets,
        name: this.ensureUniqueWorkflowName(ew.name),
        area: ew.area ?? "",
        description: ew.description ?? "",
        steps,
        status: "pending",
        currentStep: -1,
        createdAt: new Date().toISOString(),
        handoffBranch: ew.handoffBranch ?? false,
        concurrency: ew.concurrency,
        disabled: ew.disabled,
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
    for (const item of [...this.settings.tasks, ...this.settings.workflows, ...this.settings.workflows.flatMap(w => w.steps || [])]) {
      const error = autoOCDependencyError(item);
      if (error) new Notice(error);
    }
    return { tasksImported, workflowsImported };
  }

  async applyWorkflowCheckpoint(checkpoint: RunCheckpoint, expectedRunId: string, activelyExecuting = false) {
    const index = this.settings.workflows.findIndex(w => w.id === checkpoint.workflowId);
    if (index < 0) throw new Error("Workflow for execution progress is absent");
    const projected = projectWorkflowProgress(this.settings.workflows[index], this.settings.tasks, this.settings, checkpoint, expectedRunId, activelyExecuting);
    this.settings.workflows[index] = projected;
    await this.saveSettings();
  }

  async runWorkflow(workflow: Workflow) {
    return this.withDefinitionStart("workflow", workflow.id, release => this.executeWorkflow(workflow, release));
  }

  private async executeWorkflow(workflow: Workflow, releaseStart?: () => void) {
    assertWorkflowEnabled(this.settings.workflows.find(w => w.id === workflow.id) || workflow, this.settings.tasks);
    assertWorkflowDependencies(this.settings.workflows.find(w => w.id === workflow.id) || workflow, this.settings.tasks);
    this.beginExecutionEffects();
    this.assertLifecycleOpen();
    if (this.updateInProgress) throw new Error("Plugin update is in progress");
    const idx = this.settings.workflows.findIndex((w) => w.id === workflow.id);
    if (idx === -1) return;
    const wf = this.settings.workflows[idx];
    const binding = (wf as any).runtimeExecution;
    if (this.hasUncertainLegacyTask(wf.id) || binding?.phase !== "abandoned" && binding?.terminalUncertainty && !binding.disposition) {
      throw new Error("Previous workflow outcome is unconfirmed; recovery is required before starting a new attempt.");
    }

    if (this.settings.workflows.some(item => {
      const execution = (item as any).runtimeExecution;
      return execution && !["completed", "failed", "abandoned"].includes(execution.phase) && !this.ownsSharedRun(item.id,execution.runId);
    })) {
      new Notice("AutoOC: a durable execution requires resume or reconciliation before starting a workflow.");
      return;
    }

    if (wf.status === "running") {
      new Notice(`AutoOC: Workflow "${wf.name}" is already running.`);
      return;
    }

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

    if (this.pluginExecutionLease) {
      const definition=prepareWorkflowDefinition(wf,this.settings.tasks,this.settings);
      const vault=(this.app.vault.adapter as any).basePath;
      if (supportsSharedWorkflow(definition,createWorkflowTaskAdapter(definition,vault))) {
        const pending=this.executeSharedWorkflow(wf.id,undefined,false,true,undefined,undefined,releaseStart);
        this.sharedCompletions.add(pending);
        try {await pending;}finally{this.sharedCompletions.delete(pending);}
        return;
      }
    }

    if (this.sharedWorkflowExecution) throw new Error("Shared workflow owns the execution reservation");
    wf.legacyExecution = {token:require("crypto").randomUUID()};
    // Initialize the runtime context that flows between steps.
    (this as any).workflowRuntime = (this as any).workflowRuntime || new Map();
    const context = {stepOutputs:new Map<string, string>(),stepIndex:0};
    (this as any).workflowRuntime.set(wf.id, context);

    wf.status = "running";
    wf.currentStep = 0;
    wf.lastRun = new Date().toISOString();
    wf.steps.forEach((step) => {
      step.status = "pending";
      step.output = "";
      step.lastRun = "";
    });
    await this.saveSettings();
    if ((this as any).workflowRuntime.get(wf.id) !== context || wf.status !== "running") return;
    releaseStart?.();
    this.refreshStartControls();
    new Notice(`AutoOC: ⚡ Starting workflow "${wf.name}" (${wf.steps.length} steps)...`);

    // Find the entry step: one with no incoming transitions, or the first step.
    const entryStep = this.findEntryStep(wf);
    if (!entryStep) {
      wf.status = "failed";
      await this.saveSettings();
      if ((this as any).workflowRuntime.get(wf.id) !== context) return;
      new Notice(`AutoOC: Workflow "${wf.name}" has no reachable entry step.`);
      return;
    }
    await this.runWorkflowStepById(wf.id, entryStep.id);
  }

  // Find the entry step: a step that has no incoming transitions from any other
  // step in the workflow. If multiple are candidates, picks the one with the
  // smallest position.x (visual order). Falls back to the first step.
  findEntryStep(wf: Workflow): WorkflowStep | null {
    return findWorkflowEntry(wf.steps);
  }

  async runWorkflowStepById(workflowId: string, stepId: string): Promise<void> {
    this.assertLifecycleOpen();
    if (this.updateInProgress) throw new Error("Plugin update is in progress");
    const wfIdx = this.settings.workflows.findIndex((w) => w.id === workflowId);
    if (wfIdx === -1) return;
    const wf = this.settings.workflows[wfIdx];
    if (wf) assertWorkflowDependencies(wf, this.settings.tasks);
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
    return resolveWorkflowTransition(wf.steps, currentStepIndex, lastOutput, lastSucceeded, transitions, this.getRuntimeOutputs(wf.id), {
      evaluate: async (transition, target, input) => {
        new Notice(`AutoOC: Evaluating transition for "${wf.name}" → ${target.id}...`);
        const cwd = this.settings.workingDirectory || (this.app.vault.adapter as any).basePath || ".";
        const model = this.settings.defaultAiEngine === "opencode2" ? this.settings.defaultOpencode2Model || "" : this.availableModels[0]?.value || this.settings.defaultModel || "opencode/default";
        const prompt = transition.evaluatePrompt?.trim() || "Did the previous step complete successfully? If it is safe to continue, reply YES. Otherwise reply NO.";
        const result = await this.evaluateWithOpencode(`${prompt}\n\nPrevious step output:\n---\n${input}\n---\n\nReply ONLY with YES or NO.`, model, cwd);
        return result.output;
      },
      onError: (kind, error) => { new Notice(`AutoOC: ${kind} error — ${String(error)}`); },
    });
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
    return evaluateWorkflowCondition(expression, input, outputs);
  }

  async runWorkflowStep(wfIdx: number, stepIndex: number) {
    if (this.updateInProgress) throw new Error("Plugin update is in progress");
    const wf = this.settings.workflows[wfIdx];
    if (wf) assertWorkflowDependencies(wf, this.settings.tasks);
    if (!wf || wf.status !== "running") return;
    const step = wf.steps[stepIndex];
    if (!step) {
      wf.status = "completed";
      await this.saveSettings();
      return;
    }
    const context = (this as any).workflowRuntime?.get(wf.id);
    step.status = "running";
    step.lastRun = new Date().toISOString();
    step.output = "";
    await this.saveSettings();

    if (!context || (this as any).workflowRuntime?.get(wf.id) !== context || wf.status !== "running") return;

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
    assertWorkflowDependencies(wf, this.settings.tasks);
    const spec = workflowDelay(step.delayValue, step.delayUnit);
    const ctx = (this as any).workflowRuntime.get(wf.id);
    if (this.stoppingWorkflows.has(wf.id) || wf.status !== "running") return;
    this.workflowDelayControllers.get(wf.id)?.abort();
    const controller = new AbortController();
    this.workflowDelayControllers.set(wf.id, controller);
    new Notice(`AutoOC: ⏱ ${spec.output} in "${wf.name}"...`);
    try {
      await waitForWorkflowDelay(spec.milliseconds, controller.signal);
      if (controller.signal.aborted || wf.status !== "running" || (this as any).workflowRuntime.get(wf.id) !== ctx) return;
      await this.completeStep(wf, step, stepIndex, true, spec.output);
    } catch (error) {
      if (!controller.signal.aborted) throw error;
    } finally {
      if (this.workflowDelayControllers.get(wf.id) === controller) this.workflowDelayControllers.delete(wf.id);
    }
  }

  async runCodeStep(wf: Workflow, step: WorkflowStep, stepIndex: number) {
    assertWorkflowDependencies(wf, this.settings.tasks);
    const ctx = (this as any).workflowRuntime.get(wf.id);
    const inputVar = step.codeInputVar || "input";
    const outputVar = step.codeOutputVar || "output";
    const inputVal = (ctx && ctx.stepOutputs.size > 0) ? Array.from(ctx.stepOutputs.values()).pop() : "";
    const outputs: Record<string, string> = {};
    if (ctx) for (const [k, v] of ctx.stepOutputs.entries()) outputs[k] = v;
    try {
      const vaultBase = (this.app.vault.adapter as any).basePath || ".";
      const out = await runWithVaultMutations(()=>this.createVaultMutationBatch(), onVaultMutation => executeCode({
        ...step, vaultBase, cwd: this.settings.workingDirectory || vaultBase,
        code: step.code || "", input: inputVal, outputs,
        codeInputVar: inputVar, codeOutputVar: outputVar,
        onVaultMutation,
      }));
      if ((this as any).workflowRuntime.get(wf.id) !== ctx) return;
      const masked = this.redactSecrets(out);
      if (ctx) ctx.stepOutputs.set(step.id, masked);
      new Notice(`AutoOC: ⚙ Code step completed in "${wf.name}" (${out.length} chars)`);
      await this.completeStep(wf, step, stepIndex, true, masked);
    } catch (err) {
      if ((this as any).workflowRuntime.get(wf.id) !== ctx) return;
      const msg = this.redactSecrets(`[code error: ${String(err)}]`);
      if (ctx) ctx.stepOutputs.set(step.id, msg);
      new Notice(this.redactSecrets(`AutoOC: ❌ Code step failed in "${wf.name}" — ${String(err)}`));
      await this.completeStep(wf, step, stepIndex, false, msg);
    }
  }

  async runTaskStep(wf: Workflow, step: WorkflowStep, stepIndex: number) {
    assertWorkflowDependencies(wf, this.settings.tasks);
    const executionContext = (this as any).workflowRuntime?.get(wf.id);
    const isCurrentExecution = () => executionContext !== undefined &&
      (this as any).workflowRuntime?.get(wf.id) === executionContext &&
      this.settings.workflows.find(w => w.id === wf.id)?.status === "running" &&
      !this.stoppingWorkflows.has(wf.id);
    if (!isCurrentExecution()) return;
    const taskIdx = this.settings.tasks.findIndex((t) => t.id === step.taskId);
    if (taskIdx === -1) {
      wf.status = "failed";
      new Notice(`AutoOC: Workflow "${wf.name}" failed — task not found at step ${stepIndex + 1}.`);
      await this.saveSettings();
      return;
    }
    const task = this.settings.tasks[taskIdx];
    const taskOverrides: Partial<Pick<ScheduledTask, "prompt" | "branch" | "createBranch">> = {};

    const entries = Array.from(executionContext.stepOutputs.entries()) as Array<[string, string]>;
    const previous = entries.length ? entries[entries.length - 1] : undefined;
    if (wf.handoffOutput && previous) {
      taskOverrides.prompt = workflowTaskPrompt(task.prompt, wf, {stepId:previous[0],output:previous[1]});
    }

    wf.currentStep = stepIndex;
    await this.saveSettings();
    if (!isCurrentExecution()) return;
    let resultConsumed = false;
    await this.runTask(task, async (completedTask, exitCode) => {
      if (!isCurrentExecution() || resultConsumed) return;
      resultConsumed = true;
      const currentWf = this.settings.workflows.find((w) => w.id === wf.id);
      if (!currentWf || currentWf.status !== "running" || this.stoppingWorkflows.has(currentWf.id)) return;
      const currentStep = currentWf.steps[stepIndex];
      const lastOutput = completedTask.output || "";
      const ctx = (this as any).workflowRuntime.get(currentWf.id);
      if (ctx) ctx.stepOutputs.set(currentStep.id, lastOutput);
      const lastSucceeded = exitCode === 0 && completedTask.status !== "failed";
      currentStep.status = lastSucceeded ? "completed" : "failed";
      currentStep.output = lastOutput;

      const transitions = workflowStepTransitions(currentWf.steps, stepIndex) as WorkflowTransition[];

      const { nextStepId, reason } = await this.resolveNextStep(
        currentWf,
        currentStep,
        stepIndex,
        lastOutput,
        lastSucceeded,
        transitions
      );
      if (!isCurrentExecution()) return;
      if (this.stoppingWorkflows.has(currentWf.id) || currentWf.status !== "running") return;

      if (!nextStepId) {
        if (this.stoppingWorkflows.has(currentWf.id) || currentWf.status !== "running") return;
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
        if (this.stoppingWorkflows.has(currentWf.id) || currentWf.status !== "running") return;
        currentWf.status = "failed";
        new Notice(`AutoOC: ❌ Workflow "${currentWf.name}" — transition target ${nextStepId} not found.`);
        await this.saveSettings();
        return;
      }

      if (this.stoppingWorkflows.has(currentWf.id) || currentWf.status !== "running") return;
      currentWf.currentStep = nextIdx;
      await this.saveSettings();
      if (!isCurrentExecution()) return;
      if (this.stoppingWorkflows.has(currentWf.id) || currentWf.status !== "running") return;
      new Notice(`AutoOC: ⚡ Workflow "${currentWf.name}" → step ${nextIdx + 1}/${currentWf.steps.length} (${reason})`);
      setTimeout(() => {
        if (!isCurrentExecution()) return;
        this.runWorkflowStepById(currentWf.id, nextStepId);
      }, 200);
    }, taskOverrides, {workflowId:wf.id,stepId:step.id,stepIndex,context:executionContext});
  }

  // Complete a non-task step and move to the next one.
  async completeStep(wf: Workflow, step: WorkflowStep, stepIndex: number, succeeded: boolean, output: string) {
    output = this.redactSecrets(output);
    const ctx = (this as any).workflowRuntime.get(wf.id);
    const isCurrentExecution = () => ctx !== undefined && (this as any).workflowRuntime.get(wf.id) === ctx &&
      this.settings.workflows.find(w => w.id === wf.id)?.status === "running" && !this.stoppingWorkflows.has(wf.id);
    if (!isCurrentExecution()) return;
    if (ctx) ctx.stepOutputs.set(step.id, output);
    step.status = succeeded ? "completed" : "failed";
    step.output = output;
    step.lastRun = new Date().toISOString();
    const transitions = workflowStepTransitions(wf.steps, stepIndex) as WorkflowTransition[];

    const { nextStepId, reason } = await this.resolveNextStep(
      wf, step, stepIndex, output, succeeded, transitions
    );
    if (!isCurrentExecution()) return;

    if (!nextStepId) {
      const wfRef = this.settings.workflows.find((w) => w.id === wf.id);
      if (wfRef) {
        wfRef.status = succeeded ? "completed" : "failed";
        await this.saveSettings();
        // Terminal state permits another run while persistence is pending.
        // Ownership (not running status) controls cleanup and terminal notices.
        if ((this as any).workflowRuntime.get(wf.id) !== ctx) return;
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
        if (!isCurrentExecution()) return;
        new Notice(`AutoOC: ⚡ Workflow "${wfRef.name}" → step ${nextIdx + 1}/${wfRef.steps.length} (${reason})`);
        setTimeout(() => { if (isCurrentExecution()) this.runWorkflowStepById(wf.id, nextStepId); }, 200);
      }
    }
  }
}

// ─── Sidebar View ─────────────────────────────────────────────────────────────

class AutoOCView extends ItemView {
  private selectionMode = false;
  private selectedTaskIds = new Set<string>();
  private selectedWorkflowIds = new Set<string>();
  private updateBulkToolbar?: () => void;

  private renderBulkToolbar(root: HTMLElement, kind: CatalogKind, visibleIds: string[]) {
    const toggle = root.createEl("button", { text: this.selectionMode ? "Hide selection" : "Select items", cls: "auto-oc-selection-toggle" });
    toggle.title = this.selectionMode ? "Hide selection controls and clear selected items" : "Show checkboxes and bulk actions";
    toggle.setAttr("aria-expanded", String(this.selectionMode));
    toggle.onclick = () => {
      this.selectionMode = !this.selectionMode;
      if (!this.selectionMode) { this.selectedTaskIds.clear(); this.selectedWorkflowIds.clear(); }
      this.render();
    };
    this.updateBulkToolbar = undefined;
    if (!this.selectionMode) return;
    // Keep selections across filters and tabs; remove identities no longer in the catalog.
    this.selectedTaskIds ||= new Set();
    this.selectedWorkflowIds ||= new Set();
    const tasks = new Set(this.plugin.settings.tasks.map(item => item.id));
    const workflows = new Set(this.plugin.settings.workflows.map(item => item.id));
    for (const id of this.selectedTaskIds) if (!tasks.has(id)) this.selectedTaskIds.delete(id);
    for (const id of this.selectedWorkflowIds) if (!workflows.has(id)) this.selectedWorkflowIds.delete(id);
    const selected = kind === "task" ? this.selectedTaskIds : this.selectedWorkflowIds;
    const bar = root.createDiv("auto-oc-bulk-toolbar");
    const all = bar.createEl("button", { text: "Select visible" });
    all.disabled = !visibleIds.length;
    all.onclick = () => { for (const id of visibleIds) selected.add(id); this.render(); };
    const clear = bar.createEl("button", { text: "Clear selection" });
    clear.onclick = () => { this.selectedTaskIds.clear(); this.selectedWorkflowIds.clear(); this.render(); };
    const count = bar.createEl("span", { cls: "auto-oc-bulk-count", attr: { "aria-live": "polite" } });
    const area = bar.createEl("button", { text: "Change area" });
    const enable = bar.createEl("button", { text: "Enable selected" });
    const disable = bar.createEl("button", { text: "Disable selected" });
    const remove = bar.createEl("button", { text: "Delete selected", cls: "mod-warning" });
    const exportButton = bar.createEl("button", { text: "Export selected" });
    const open = (action: BulkAction) => {
      const selection = captureBulkSelection(this.plugin.settings, this.selectedTaskIds, this.selectedWorkflowIds);
      new BulkCatalogModal(this.app, this.plugin, selection, action, () => {
        for (const item of selection) (item.kind === "task" ? this.selectedTaskIds : this.selectedWorkflowIds).delete(item.id);
        this.render();
      }).open();
    };
    area.onclick = () => open({ type: "area", area: "" });
    enable.onclick = () => open({ type: "availability", disabled: false });
    disable.onclick = () => open({ type: "availability", disabled: true });
    remove.onclick = () => open({ type: "delete" });
    exportButton.onclick = () => new ExportModal(this.app, this.plugin, this.selectedTaskIds, this.selectedWorkflowIds).open();
    this.updateBulkToolbar = () => {
      const total = this.selectedTaskIds.size + this.selectedWorkflowIds.size;
      const hidden = total - visibleIds.filter(id => selected.has(id)).length;
      count.setText(`${this.selectedTaskIds.size} tasks + ${this.selectedWorkflowIds.size} workflows selected${hidden ? ` (${hidden} outside this list)` : ""}`);
      enable.disabled = disable.disabled = clear.disabled = area.disabled = remove.disabled = exportButton.disabled = total === 0;
    };
    this.updateBulkToolbar();
  }

  private renderSelectionCheckbox(summary: HTMLElement, kind: CatalogKind, item: { id: string; name: string }) {
    if (!this.selectionMode) return;
    const selected = kind === "task" ? (this.selectedTaskIds ||= new Set()) : (this.selectedWorkflowIds ||= new Set());
    const checkbox = summary.createEl("input", { type: "checkbox", cls: "auto-oc-select-item" });
    checkbox.setAttr("aria-label", `Select ${kind}: ${item.name}`);
    checkbox.checked = selected.has(item.id);
    checkbox.onclick = event => event.stopPropagation();
    checkbox.onchange = () => {
      if (checkbox.checked) selected.add(item.id); else selected.delete(item.id);
      this.updateBulkToolbar?.();
    };
  }

  private renderAvailabilityButton(parent: HTMLElement, kind: CatalogKind, item: ScheduledTask | Workflow) {
    const button = parent.createEl("button", { text: item.disabled ? "Enable" : "Disable", cls: "auto-oc-availability-toggle" });
    button.title = item.disabled ? "Enable this item and its saved schedule" : "Disable without deleting configuration or history";
    button.setAttr("aria-label", `${item.disabled ? "Enable" : "Disable"} ${kind}: ${item.name}`);
    button.disabled = this.plugin.getDefinitionStartState(kind, item.id) !== "available";
    button.onclick = async event => {
      event.stopPropagation();
      const selection = captureBulkSelection(this.plugin.settings,
        new Set(kind === "task" ? [item.id] : []), new Set(kind === "workflow" ? [item.id] : []));
      button.disabled = true;
      try {
        await this.plugin.applyBulkSelection(selection, { type: "availability", disabled: !item.disabled });
        this.render();
      } catch (error) {
        button.disabled = false;
        new Notice(`AutoOC: Could not change availability. ${String(error)}`);
      }
    };
  }

  private plugin: AutoOCPlugin;
  private filterText: string = "";
  private filterStatus: string = "all";
  private filterArea: string = "all";
  private taskSource: "all" | "catalog" | "workflow-code" = "all";
  private areaDashboard?: AreaDashboard;
  private areaDashboardState = createAreaDashboardState();
  private currentTab: "dashboard" | "tasks" | "workflows" = "dashboard";
  private expandedTasks: Set<string> = new Set();
  private expandedCodeSteps: Set<string> = new Set();
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

  private async persistDashboardPositions(): Promise<"saved" | "skipped"> {
    if (this.plugin.isLifecycleStopped()) return "skipped";
    const obj: Record<string, { x: number; y: number; size?: number; sizePx?: number }> = {};
    this.dashboardPositions.forEach((pos, key) => { obj[key] = pos; });
    this.plugin.settings.dashboardPositions = obj;
    await this.plugin.saveSettings(false);
    return "saved";
  }

  private async persistDashboardPositionsSafely(): Promise<"saved" | "skipped" | "failed"> {
    try {
      return await this.persistDashboardPositions();
    } catch {
      // Do not log the exception: storage errors may contain configuration data.
      console.warn("AutoOC: Dashboard positions could not be saved.");
      return "failed";
    }
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
    try {
      this.unsubscribeTaskUpdated?.();
      this.unsubscribeWorkflowUpdated?.();
    } finally {
      this.unsubscribeTaskUpdated = undefined;
      this.unsubscribeWorkflowUpdated = undefined;
      this.dashboardResizeObserver?.disconnect();
      this.dashboardResizeObserver = null;
      this.sinkIntervals.forEach((iv) => clearInterval(iv));
      this.sinkIntervals.clear();
      this.dashboardTaskDriftDirection.clear();
    }
    // Stop callbacks synchronously, before waiting for an active instance's write.
    await this.persistDashboardPositionsSafely();
  }
  refresh() {
    if (this.currentTab === "dashboard" && this.areaDashboard?.root.isConnected) this.areaDashboard.update();
    else this.render();
  }

  private updateTaskNameDom(task: ScheduledTask) {
    this.areaDashboard?.update();
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
    this.areaDashboard?.update();
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
    openCliLauncher(this.app, this.plugin);
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
    this.areaDashboard = undefined;
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("auto-oc-view");

    // ── Row 0: extension header (title + version + update controls) ──
    this.renderHeader(containerEl);

    // ── Tab bar ──
    // The tab bar is split into multiple rows:
    //   Row 1 (left-aligned): the navigation tabs (Dashboard / Tasks /
    //                         WorkFlows / CLI)
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

    const btnCli = navRow.createEl("button", {
      text: "💻 CLI",
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

    // ── Content ──
    if (this.currentTab === "dashboard") {
      this.renderDashboard(containerEl);
    } else if (this.currentTab === "workflows") {
      this.renderWorkflows(containerEl);

    } else {
      this.renderTasks(containerEl);
    }
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
    const locate = (item: DashboardItem) => {
      const workflow = this.plugin.settings.workflows.find(wf => wf.id === (item.workflowId || (item.kind === "workflow" ? item.id : "")));
      const step = workflow?.steps.find(entry => entry.id === item.id);
      const task = this.plugin.settings.tasks.find(entry => entry.id === item.taskId);
      return { workflow, step, task };
    };
    const open = (item: DashboardItem) => {
      const { workflow, step, task } = locate(item);
      this.filterText = ""; this.filterArea = this.filterStatus = "all"; this.taskSource = "all";
      if (workflow && step?.stepKind === "code") this.openWorkflowCodeEntry(workflow.id, step.id);
      else if (task) this.openTaskInList(task);
      else if (workflow) this.openWorkflowInList(workflow);
      else { new Notice("This item was removed. Refresh the Dashboard."); this.refresh(); }
    };
    const showLog = (item: DashboardItem, history: boolean) => {
      let { workflow, step, task } = locate(item);
      if (workflow && item.kind === "workflow") {
        step = workflow.steps[workflow.currentStep];
        task = this.plugin.settings.tasks.find(entry => entry.id === step?.taskId);
      }
      if (workflow && step?.stepKind === "code") {
        if (history) this.plugin.openCodeStepHistory(workflow.id, step.id);
        else new CodeStepLogModal(this.app, step.name || "Code step", () => this.plugin.codeStepState(workflow!.id, step!.id)).open();
      } else if (task) {
        if (history) new LogHistoryModal(this.app, task, this.plugin).open();
        else new LiveLogModal(this.app, task, this.plugin).open();
      } else new Notice("No task or Code step log is available for this selection. Open its workflow controls for details.");
    };
    this.areaDashboard = new AreaDashboard(containerEl, this.areaDashboardState, {
      items: () => dashboardItems(this.plugin.settings.tasks, this.plugin.settings.workflows,
        (workflowId, runId) => this.plugin.ownsExecution(workflowId, runId)),
      diameter: () => this.plugin.getDashboardBubbleDiameter(), open,
      log: item => showLog(item, false), history: item => showLog(item, true),
    });
  }

  private renderTasks(containerEl: HTMLElement) {
    // The extension header (title + version + check-updates) and the
    // "+ New Task" button are rendered by `render()` so they sit at
    // the top of the panel, not duplicated per tab.

    const tasks = this.plugin.settings.tasks;
    const codeEntries = workflowCodeEntries(this.plugin.settings.workflows);
    const renderTaskResults = (root: HTMLElement) => {
      root.empty();

      // ── Stats bar ──
      const stats = root.createDiv("auto-oc-stats");
      const running = [...tasks, ...codeEntries].filter((t) => t.status === "running").length;
      const completed = [...tasks, ...codeEntries].filter((t) => t.status === "completed").length;
      const failed = [...tasks, ...codeEntries].filter((t) => t.status === "failed").length;
      stats.createEl("span", { text: `${tasks.length} tasks` });
      if (codeEntries.length) stats.createEl("span", { text: `${codeEntries.length} workflow code steps` });
      if (running > 0) stats.createEl("span", { text: `🟡 ${running} running`, cls: "auto-oc-stat-running" });
      if (failed > 0) stats.createEl("span", { text: `🔴 ${failed} failed`, cls: "auto-oc-stat-failed" });
      if (completed > 0) stats.createEl("span", { text: `🟢 ${completed} completed` });

      // ── Task list ──
      const filteredTasks = tasks.filter(t => {
        const area = t.area?.trim() || "No area";
        const matchesText = t.name.toLowerCase().includes(this.filterText) ||
                            (t.prompt || "").toLowerCase().includes(this.filterText) ||
                            (t.taskKind === "code" && (t.code || "").toLowerCase().includes(this.filterText)) ||
                            area.toLowerCase().includes(this.filterText);
        const matchesStatus = this.filterStatus === "all" || t.status === this.filterStatus;
        const matchesArea = this.filterArea === "all" || area === this.filterArea;
        return this.taskSource !== "workflow-code" && matchesText && matchesStatus && matchesArea;
      });

      const filteredCodeEntries = codeEntries.filter(entry => this.taskSource !== "catalog" && matchesWorkflowCodeEntry(entry, {
        text: this.filterText, status: this.filterStatus, area: this.filterArea,
      }));
      this.renderBulkToolbar(root, "task", filteredTasks.map(item => item.id));
      if (filteredTasks.length === 0 && filteredCodeEntries.length === 0) {
        root.createEl("p", {
          text: this.filterText || this.filterStatus !== "all" || this.filterArea !== "all" || this.taskSource !== "all"
                ? "No tasks or workflow code steps match your filters."
                : "No tasks or workflow code steps yet. Create one with \"+ New Task\" or \"+ New Workflow\".",
          cls: "auto-oc-empty",
        });
        return;
      }

      const list = root.createDiv("auto-oc-list");
      for (const task of [...filteredTasks].reverse()) {
        this.renderTaskCard(list, task);
      }
      if (filteredCodeEntries.length) {
        root.createEl("h3", { text: "Workflow code steps" });
        root.createEl("p", {
          text: "Run, stop, disable and inspect each code step here. Run executes only that step with empty input and outputs. Bulk selection applies to catalog tasks.",
          cls: "setting-item-description",
        });
        const stepList = root.createDiv("auto-oc-list");
        for (const entry of filteredCodeEntries) this.renderWorkflowCodeEntry(stepList, entry);
      }
    };

    // ── Filters Bar ──
    const filterBar = containerEl.createDiv("auto-oc-filter-bar");

    const searchInput = filterBar.createEl("input", {
      type: "text",
      placeholder: "🔍 Search tasks, workflows or code...",
      cls: "auto-oc-search-input",
    });
    searchInput.value = this.filterText;
    searchInput.oninput = () => {
      this.filterText = searchInput.value.toLowerCase();
      renderTaskResults(resultsRoot);
    };

    const sourceSelect = filterBar.createEl("select", { cls: "auto-oc-status-select", attr: { "aria-label": "Task source" } });
    for (const [value, label] of [["all", "All items"], ["catalog", "Catalog tasks"], ["workflow-code", "Workflow code steps"]]) {
      const option = sourceSelect.createEl("option", { text: label });
      option.value = value;
    }
    sourceSelect.value = this.taskSource;
    sourceSelect.onchange = () => {
      this.taskSource = sourceSelect.value as "all" | "catalog" | "workflow-code";
      renderTaskResults(resultsRoot);
    };

    const statusSelect = filterBar.createEl("select", {
      cls: "auto-oc-status-select",
    });
    const statuses = ["all", "pending", "running", "completed", "failed", "abandoned"];
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
    const areaOptions = ["all", ...new Set([...getConfiguredAreaNames(this.plugin.settings), ...codeEntries.map(entry => entry.area).filter(area => area !== "No area")]), "No area"];
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

  private renderWorkflowCodeEntry(parent: HTMLElement, entry: WorkflowCodeEntry<Workflow>) {
    const { workflow, step, stepIndex } = entry;
    const state = this.plugin.codeStepState(workflow.id, step.id);
    const card = parent.createDiv(`auto-oc-card auto-oc-status-${state.status}`);
    // Keep workflow/step identities separate: step IDs may repeat in other workflows.
    card.setAttr("data-auto-oc-code-workflow-id", workflow.id);
    card.setAttr("data-auto-oc-code-step-id", step.id);
    card.addClass("auto-oc-workflow-task-detail");
    card.setAttr("data-auto-oc-owner-workflow-id", workflow.id);
    card.setAttr("data-auto-oc-step-id", step.id);
    const summary = card.createDiv("auto-oc-card-summary");
    if (workflow.disabled || step.disabled) {
      card.addClass("auto-oc-disabled");
      summary.createEl("span", { text: workflow.disabled ? "Workflow disabled" : "Disabled", cls: "auto-oc-badge auto-oc-badge-disabled" });
    }
    summary.createEl("span", { text: entry.name, cls: "auto-oc-task-name" });
    summary.createEl("span", { text: "Code", cls: "auto-oc-task-engine auto-oc-task-engine-code" });
    summary.createEl("span", { text: state.status, cls: `auto-oc-badge auto-oc-badge-${state.status}` });
    const controls = summary.createDiv("auto-oc-card-quick-actions");
    const action = (text:string, label:string, callback:()=>unknown, cls="", target:HTMLElement=controls) => {
      const button = target.createEl("button", {text, cls});
      button.title = label; button.setAttr("aria-label", label);
      button.onclick = async event => {
        event.stopPropagation(); button.disabled = true;
        try { await callback(); }
        catch(error) { new Notice(this.plugin.redactSecrets(`AutoOC: ${String(error)}`), 12000); }
        finally { if (button.isConnected) button.disabled = false; }
      };
      return button;
    };
    const availability = action(step.disabled ? "Enable" : "Disable", step.disabled ? "Enable this code step" : "Disable this code step without deleting it",
      () => this.plugin.setCodeStepDisabled(workflow.id, step.id, !step.disabled), "auto-oc-availability-toggle");
    availability.disabled = this.plugin.getDefinitionStartState("workflow", workflow.id) !== "available";
    const run = action("▶", "Run only this code step (empty input and outputs)",
      () => this.plugin.runCodeStepOnly(workflow.id, step.id), "auto-oc-btn-run");
    run.disabled = !!workflow.disabled || !!step.disabled || this.plugin.getDefinitionStartState("workflow", workflow.id) !== "available";
    if (state.stop) action("⏹", "Stop this step and its current execution",
      () => this.plugin.stopCodeStep(workflow.id, step.id, state.stop!), "auto-oc-btn-stop");
    action("📄", state.stop ? "Live log" : "Log", () => new CodeStepLogModal(this.app, entry.name,
      () => this.plugin.codeStepState(workflow.id, step.id)).open(), "auto-oc-btn-output");
    action("📜", "History", () => this.plugin.openCodeStepHistory(workflow.id, step.id), "auto-oc-btn-history");
    const details = card.createDiv("auto-oc-card-details");
    const key = JSON.stringify([workflow.id, step.id]);
    details.style.display = this.expandedCodeSteps.has(key) ? "block" : "none";
    summary.setAttr("tabindex", "0");
    summary.setAttr("aria-expanded", String(this.expandedCodeSteps.has(key)));
    const toggle = () => {
      if (this.expandedCodeSteps.has(key)) this.expandedCodeSteps.delete(key); else this.expandedCodeSteps.add(key);
      details.style.display = this.expandedCodeSteps.has(key) ? "block" : "none";
      summary.setAttr("aria-expanded", String(this.expandedCodeSteps.has(key)));
    };
    summary.onclick = toggle;
    summary.onkeydown = event => { if (event.target === summary && ["Enter", " "].includes(event.key)) { event.preventDefault(); toggle(); } };
    const meta = details.createDiv("auto-oc-card-meta");
    meta.createEl("span", {text:`🗂 ${entry.area}`});
    meta.createEl("span", {text:`{ } Code · ${workflow.name} · Step ${stepIndex + 1}`});
    meta.createEl("span", {text:"▶ Runs only this step, with empty input and outputs."});
    if (state.lastRun) meta.createEl("span", {text:`⏱ Last: ${formatDateTime(state.lastRun)}`});
    const binding = step.codeExecution?.runtimeExecution;
    if (binding && !state.stop && binding.phase !== "abandoned" && (binding.requiresReconciliation ||
        !["completed","failed"].includes(binding.phase) || binding.terminalUncertainty && !binding.disposition)) {
      details.createEl("p", {text:"This step has an interrupted attempt or unconfirmed effects. Review its log and history before closing the attempt."});
      const resolve = details.createEl("button", {text:"Review interrupted attempt"});
      resolve.onclick = async () => { try { await this.plugin.resolveCodeStepAttempt(workflow.id, step.id); } catch(error) { new Notice(this.plugin.redactSecrets(String(error))); } };
    }
    const addPreview = (label: string, text: string, code = false) => {
      const preview = details.createEl("details", {cls:"auto-oc-card-preview"});
      preview.createEl("summary", { text: label });
      let populated = false;
      preview.ontoggle = () => {
        if (!preview.open || populated) return;
        populated = true;
        // Keep large historical outputs out of the initial list DOM. Use text,
        // never HTML, and direct the user to the workflow for the full content.
        if (code) renderCodePreview(preview, text, 12000);
        else preview.createEl("pre", { text: text.slice(0, 12000), cls: "auto-oc-inline-code-source" });
        if (text.length > 12000) preview.createEl("p", { text: "Preview limited to 12,000 characters. Open the workflow to view the full content." });
      };
    };
    addPreview("View code", step.code || "// Empty code step", true);
    addPreview("View output", state.output || "No output recorded for this step.");
    const actions = details.createDiv("auto-oc-card-actions");
    const detailRun = action("▶ Run", "Run only this code step (empty input and outputs)",
      () => this.plugin.runCodeStepOnly(workflow.id, step.id), "auto-oc-btn-run", actions);
    detailRun.disabled = run.disabled;
    if (state.stop) action("⏹ Stop", "Stop this step and its current execution",
      () => this.plugin.stopCodeStep(workflow.id, step.id, state.stop!), "auto-oc-btn-stop", actions);
    action(state.stop ? "📡 Live Log" : "📄 Log", state.stop ? "Live log" : "Log", () => new CodeStepLogModal(this.app, entry.name,
      () => this.plugin.codeStepState(workflow.id, step.id)).open(), "auto-oc-btn-output", actions);
    action("📜 History", "History", () => this.plugin.openCodeStepHistory(workflow.id, step.id), "auto-oc-btn-history", actions);
    const edit = actions.createEl("button", {text:"Edit Code", cls:"auto-oc-btn-edit"});
    edit.disabled = this.plugin.getDefinitionStartState("workflow", workflow.id) !== "available";
    edit.onclick = () => new EditWorkflowStepModal(this.app, this.plugin, workflow, step).open();
    const open = actions.createEl("button", { text: "Open workflow" });
    open.onclick = () => this.openWorkflowCodeEntry(workflow.id, step.id);
  }

  private openWorkflowCodeEntry(workflowId: string, stepId: string) {
    const workflow = this.plugin.settings.workflows.find(item => item.id === workflowId);
    if (!workflow?.steps.some(step => step.id === stepId && step.stepKind === "code")) {
      new Notice("This workflow code step was removed or changed. Refresh the list to see the current catalog.");
      this.render();
      return;
    }
    this.currentTab = "workflows";
    this.filterText = workflow.name.toLowerCase();
    this.filterArea = this.filterStatus = "all";
    this.expandedWorkflows.add(workflowId);
    this.expandedCodeSteps.add(JSON.stringify([workflowId, stepId]));
    this.render();
    // Match identities without interpolating user-controlled IDs into selectors.
    const steps = this.containerEl?.querySelectorAll<HTMLElement>(".auto-oc-workflow-task-detail");
    const target = steps && Array.from(steps).find(element =>
      element.getAttribute("data-auto-oc-owner-workflow-id") === workflowId && element.getAttribute("data-auto-oc-step-id") === stepId);
    target?.scrollIntoView({ block: "center" });
  }

  private executionHelpContext(item: ScheduledTask | Workflow, kind: "task" | "workflow", expected?: {runId: string; workflowId: string}) {
    const currentItem = () => {
      const current = kind === "task"
        ? this.plugin.settings.tasks.find(entry => entry.id === item.id)
        : this.plugin.settings.workflows.find(entry => entry.id === item.id);
      const binding = (current as any)?.runtimeExecution;
      if (expected && (binding?.runId !== expected.runId || (kind === "workflow" ? current?.id : binding?.workflowId) !== expected.workflowId)) return undefined;
      return current;
    };
    const relatedWorkflow = (current: ScheduledTask | Workflow) => {
      const binding = (current as any).runtimeExecution;
      return kind === "task" && binding ? this.plugin.settings.workflows.find(workflow =>
        workflow.id === binding.workflowId && (workflow as any).runtimeExecution?.runId === binding.runId) : undefined;
    };
    const snapshot = (): ExecutionHelpSnapshot | undefined => {
      const current = currentItem();
      if (!current) return;
      const binding = (current as any).runtimeExecution;
      const workflow = relatedWorkflow(current);
      const attempt = (workflow as any)?.runtimeExecution || binding;
      const owned = !!binding && this.plugin.ownsExecution(kind === "workflow" ? current.id : binding.workflowId, binding.runId);
      let reviewAction: ExecutionHelpSnapshot["reviewAction"];
      if (kind === "task" && !workflow && !owned && current.status !== "running") {
        if (binding?.terminalUncertainty && !binding.disposition && ["failed", "completed"].includes(binding.phase)) {
          reviewAction = "resolve-uncertainty";
        } else if (binding?.workflowId === standaloneTaskWorkflow(current.id).id && ["ready", "in_flight"].includes(binding.phase)) {
          reviewAction = "abandon-attempt";
        }
      } else if (kind === "workflow" && !owned) {
        if (attempt?.terminalUncertainty && !attempt.disposition && ["failed", "completed"].includes(attempt.phase)) {
          reviewAction = "resolve-uncertainty";
        } else if (["ready", "in_flight"].includes(attempt?.phase)) {
          reviewAction = "workflow-controls";
        }
      }
      return { name: current.name, status: current.status, runId: binding?.runId, phase: attempt?.phase,
        owned, reviewAction,
        requiresReconciliation: !!(binding?.requiresReconciliation || attempt?.requiresReconciliation),
        terminalUncertainty: !!(binding?.terminalUncertainty || attempt?.terminalUncertainty),
        disposition: !!attempt?.disposition, workflowName: workflow?.name,
        waitingApproval: !!(current as ScheduledTask).pendingCodexApproval,
        stopUnconfirmed: !!(current as ScheduledTask).legacyExecution?.stopState };
    };
    const showDetails = () => {
      const latest = currentItem();
      if (!latest) return;
      this.filterText = "";
      this.filterStatus = "all";
      this.filterArea = "all";
      this.taskSource = "all";
      const workflow = relatedWorkflow(latest);
      if (workflow) this.openWorkflowInList(workflow);
      else if (kind === "task") this.openTaskInList(latest as ScheduledTask);
      else this.openWorkflowInList(latest as Workflow);
    };
    return { snapshot, showDetails };
  }

  private showTaskStartFailure(task: ScheduledTask, error: unknown) {
    const current = this.plugin.settings.tasks.find(entry => entry.id === task.id);
    const binding = (current as any)?.runtimeExecution;
    const message = String(error);
    const detail = message.replace(/^Error: /, "");
    const previousRun = /^Previous execution requires continuation or reconciliation \(run ([^,\r\n]+), workflow ([^,\r\n]+), step [^)\r\n]*\)\. No new task was started\.$/.exec(detail);
    if (previousRun) {
      const [, runId, workflowId] = previousRun;
      // Admission can be blocked by another task or workflow in this vault.
      // Resolve both identities against the current catalog, never just a name.
      const workflow = this.plugin.settings.workflows.find(entry => entry.id === workflowId && (entry as any).runtimeExecution?.runId === runId);
      const blockingTask = this.plugin.settings.tasks.find(entry =>
        standaloneTaskWorkflow(entry.id).id === workflowId && (entry as any).runtimeExecution?.workflowId === workflowId && (entry as any).runtimeExecution?.runId === runId);
      const target = workflow || blockingTask;
      if (target) {
        const { snapshot, showDetails } = this.executionHelpContext(target, workflow ? "workflow" : "task", {runId, workflowId});
        new ExecutionStatusHelpModal(this.app, snapshot, showDetails, this.plugin.manifest.version, true).open();
        return;
      }
      try {this.plugin.openHistoricalExecutionRecovery(workflowId,runId);return;}
      catch { /* Missing, changed or currently bound journals keep the original diagnostic. */ }
    }
    const unfinished = !!binding?.requiresReconciliation && detail ===
      `Unfinished attempt ${binding.runId}. Use Abandon attempt on this task after checking its external process has ended. No new task was started.`;
    const uncertain = !!binding?.terminalUncertainty && !binding.disposition && detail ===
      "Previous task outcome is unconfirmed; recovery is required before starting a new attempt.";
    // This notice identifies one attempt. Never redirect a stale error to a
    // different run, or reinterpret unrelated launch/provider failures.
    if (current && binding?.runId && binding.workflowId && (unfinished || uncertain)) {
      const { snapshot, showDetails } = this.executionHelpContext(current, "task", {runId: binding.runId, workflowId: binding.workflowId});
      new ExecutionStatusHelpModal(this.app, snapshot, showDetails, this.plugin.manifest.version, true).open();
      return;
    }
    new Notice(this.plugin.redactSecrets(`AutoOC: Task could not start. ${message}`), 12000);
  }

  private renderExecutionStatus(parent: HTMLElement, item: ScheduledTask | Workflow, kind: "task" | "workflow") {
    if (!(item as any).runtimeExecution) return;
    const { snapshot, showDetails } = this.executionHelpContext(item, kind);
    const current = snapshot();
    if (!current) return;
    const help = executionStatusHelp(current);
    if (!help.attention) return;
    const status = parent.createDiv("auto-oc-execution-status");
    status.createEl("span", { text: help.label, cls: help.attention ? "mod-warning" : "auto-oc-task-meta" });
    const button = status.createEl("button", { text: "What can I do?" });
    button.setAttr("aria-label", `Execution help for ${item.name}`);
    button.onclick = event => {
      event.stopPropagation();
      new ExecutionStatusHelpModal(this.app, snapshot, showDetails, this.plugin.manifest.version).open();
    };
  }

  private renderTaskCard(parent: HTMLElement, task: ScheduledTask) {
    const dependencyError = autoOCDependencyError(task);
    if (dependencyError) parent.createEl("p", {text: dependencyError, cls: "mod-warning"});
    const stopIdentity = this.plugin.taskStopIdentity(task);
    const stopTask = async (button: HTMLButtonElement) => {
      button.disabled = true;
      const label = button.textContent;
      try {
        const result = await this.plugin.killTask(task.id, stopIdentity);
        if (result === "stop-requested") button.textContent = "Stop requested…";
      } catch (error) {
        button.disabled = false;
        button.textContent = label;
        new Notice(`AutoOC: ${String(error)}`);
      }
    };
    const card = parent.createDiv(`auto-oc-card auto-oc-status-${task.status}`);
    card.setAttr("data-auto-oc-task-id", task.id);
    if (task.disabled) card.addClass("auto-oc-disabled");
    
    // Summary Bar (Always Visible)
    const summary = card.createDiv("auto-oc-card-summary");
    this.renderSelectionCheckbox(summary, "task", task);
    if (task.disabled) summary.createEl("span", { text: "Disabled", cls: "auto-oc-badge auto-oc-badge-disabled" });
    const title = summary.createEl("span", { text: task.name, cls: "auto-oc-task-name" });
    summary.createEl("span", {
      text: (task.taskKind || "opencode") === "code"
        ? "Code"
        : task.taskKind === "codex"
          ? (task.interactiveTerminal ? "ChatGPT / Codex" : "Codex")
          : task.taskKind === "copilot" ? "GitHub Copilot CLI" : task.taskKind === "opencode2" ? "OpenCode 2 CLI" : task.interactiveTerminal ? "OpenCode 1 CLI" : "OpenCode 1",
      cls: `auto-oc-task-engine auto-oc-task-engine-${task.taskKind || "opencode"}`,
    });
    
    const badge = summary.createEl("span", {
      text: (task as any).runtimeExecution?.disposition ? `${task.status} · human disposition ${(task as any).runtimeExecution.disposition.at} · external outcome unknown` : task.status === "abandoned" ? "abandoned · outcome unknown" : task.legacyExecution?.stopState ? "stop outcome unconfirmed" : task.pendingCodexApproval ? "waiting approval" : task.status !== "running" && (task as any).runtimeExecution?.requiresReconciliation ? "reconciliation required" : task.status,
      cls: `auto-oc-badge auto-oc-badge-${task.status}`,
    });
    this.renderExecutionStatus(summary, task, "task");
    const quickActions = summary.createDiv("auto-oc-card-quick-actions");
    this.renderAvailabilityButton(quickActions, "task", task);
    const btnQuickRun = quickActions.createEl("button", { text: "▶", cls: "auto-oc-btn-run" });
    btnQuickRun.title = task.status === "running" ? "Running" : "Run now";
    this.plugin.configureStartButton(btnQuickRun, "task", task.id, true);
    btnQuickRun.onclick = async (e) => {
      e.stopPropagation();
      try { await this.plugin.runTask(task); }
      catch (error) { this.showTaskStartFailure(task, error); }
    };
    if (task.status === "running") {
      const btnQuickStop = quickActions.createEl("button", { text: "⏹", cls: "auto-oc-btn-stop" });
      btnQuickStop.title = "Terminate process now";
      btnQuickStop.onclick = async (e) => {
        e.stopPropagation();
        await stopTask(btnQuickStop);
      };
    }
    if (task.pendingCodexApproval) {
      const btnApprove = quickActions.createEl("button", { text: "✓", cls: "auto-oc-btn-run" });
      btnApprove.title = task.pendingCodexApproval.summary;
      btnApprove.onclick = async (e) => { e.stopPropagation(); await this.plugin.resolveCodexApproval(task.id, true); };
      const btnReject = quickActions.createEl("button", { text: "✕", cls: "auto-oc-btn-stop" });
      btnReject.title = `Reject: ${task.pendingCodexApproval.summary}`;
      btnReject.onclick = async (e) => { e.stopPropagation(); await this.plugin.resolveCodexApproval(task.id, false); };
    }
    const btnQuickLog = quickActions.createEl("button", { text: "📄", cls: task.status === "running" ? "auto-oc-btn-log-live" : "auto-oc-btn-output" });
    btnQuickLog.title = task.status === "running" ? "Live log" : "Log";
    btnQuickLog.disabled = !task.output && task.status !== "running";
    btnQuickLog.onclick = (e) => {
      e.stopPropagation();
      new LiveLogModal(this.app, task, this.plugin).open();
    };
    const btnQuickHistory = quickActions.createEl("button", { text: "📜", cls: "auto-oc-btn-history" });
    btnQuickHistory.title = "History";
    btnQuickHistory.onclick = (e) => {
      e.stopPropagation();
      try {
        new LogHistoryModal(this.app, task, this.plugin).open();
      } catch (err) {
        new Notice(`AutoOC: could not open history — ${String(err)}`);
      }
    };
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
    const modelLabel = task.taskKind === "codex"
      ? this.plugin.availableCodexModels.find((m) => m.value === task.model)?.label ?? task.model ?? "Automatic"
      : task.taskKind === "copilot" ? task.model || this.plugin.settings.defaultCopilotModel || "Automatic"
        : this.plugin.availableModels.find((m) => m.value === task.model)?.label ?? task.model;
    meta.createEl("span", { text: `🗂 ${task.area?.trim() || "No area"}` });
    if ((task.taskKind || "opencode") === "code") {
      meta.createEl("span", { text: "{ } Code task" });
    } else if (task.taskKind === "codex") {
      meta.createEl("span", { text: `✦ Codex · ${modelLabel || "Automatic"}` });
      if (task.interactiveTerminal) meta.createEl("span", { text: "ChatGPT app task" });
      meta.createEl("span", { text: `🧠 ${task.reasoningEffort || this.plugin.settings.defaultCodexReasoningEffort}` });
    } else if (task.taskKind === "copilot") {
      meta.createEl("span", { text: `GitHub Copilot CLI · ${modelLabel}` });
      meta.createEl("span", { text: task.copilotAllowAllTools ? "Tools allowed automatically" : "Read-only tools" });
    } else {
      if (task.interactiveTerminal) meta.createEl("span", { text: "CLI task" });
      else meta.createEl("span", { text: task.taskKind === "opencode2" ? "OpenCode 2" : "OpenCode 1" });
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

    const terminalBinding=(task as any).runtimeExecution;
    if(terminalBinding && !terminalBinding.disposition && (['ready','in_flight'].includes(terminalBinding.phase) || terminalBinding.terminalUncertainty) && !this.plugin.ownsExecution(terminalBinding.workflowId,terminalBinding.runId)) {
      actions.createEl('button',{text:'Resolve blocked execution…'}).onclick=e=>{e.stopPropagation();this.plugin.openBlockedExecutionsReview(terminalBinding.runId);};
    }
    if(terminalBinding?.terminalUncertainty && !terminalBinding.disposition && ['failed','completed'].includes(terminalBinding.phase) && task.status!=='running') {
      const dispose=actions.createEl('button',{text:'Resolve historical uncertainty'});
      dispose.onclick=async e=>{e.stopPropagation();try {await this.plugin.confirmTerminalDisposition(terminalBinding.workflowId || standaloneTaskWorkflow(task.id).id,terminalBinding.runId);} catch(error) {new Notice(this.plugin.redactSecrets(String(error)));}};
    }
    if ((task as any).runtimeExecution?.workflowId === standaloneTaskWorkflow(task.id).id && ['ready', 'in_flight'].includes((task as any).runtimeExecution?.phase) && task.status !== 'running' && !this.plugin.ownsExecution((task as any).runtimeExecution.workflowId, (task as any).runtimeExecution.runId)) {
      const abandon = actions.createEl('button', {text:'Abandon attempt',cls:'auto-oc-btn-stop'});
      abandon.onclick = async e => {
        e.stopPropagation();
        try { await this.plugin.confirmAbandonTaskExecution(task.id); }
        catch(error) {new Notice(this.plugin.redactSecrets(`AutoOC: ${String(error)}`),12000);}
      };
    }

    const btnRun = actions.createEl("button", {
      text: task.status === "running" ? "⏳ Running…" : "▶ Run",
      cls: "auto-oc-btn-run",
    });
    this.plugin.configureStartButton(btnRun, "task", task.id, false);
    btnRun.onclick = async (e) => {
      e.stopPropagation();
      try { await this.plugin.runTask(task); }
      catch (error) { this.showTaskStartFailure(task, error); }
    };

    if (task.status === "running") {
      const btnStop = actions.createEl("button", {
        text: "⏹ Stop",
        cls: "auto-oc-btn-stop",
      });
      btnStop.title = "Terminate process now";
      btnStop.onclick = async (e) => {
        e.stopPropagation();
        await stopTask(btnStop);
      };
    }
    if (task.pendingCodexApproval) {
      const approval = actions.createDiv("auto-oc-codex-approval");
      approval.createEl("span", { text: `Approval needed: ${task.pendingCodexApproval.summary}` });
      const approve = approval.createEl("button", { text: "✓ Approve", cls: "auto-oc-btn-run" });
      approve.onclick = async (e) => { e.stopPropagation(); await this.plugin.resolveCodexApproval(task.id, true); };
      const reject = approval.createEl("button", { text: "✕ Reject", cls: "auto-oc-btn-stop" });
      reject.onclick = async (e) => { e.stopPropagation(); await this.plugin.resolveCodexApproval(task.id, false); };
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

      this.renderBulkToolbar(root, "workflow", filteredWorkflows.map(item => item.id));
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
    const statuses = ["all", "pending", "running", "completed", "failed", "abandoned"];
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
    try { assertWorkflowDependencies(workflow, this.plugin.settings.tasks); }
    catch (error) { parent.createEl("p", {text: String(error), cls: "mod-warning"}); }
    const card = parent.createDiv(`auto-oc-card auto-oc-status-${workflow.status}`);
    card.setAttr("data-auto-oc-workflow-id", workflow.id);
    if (workflow.disabled) card.addClass("auto-oc-disabled");
    const summary = card.createDiv("auto-oc-card-summary");
    this.renderSelectionCheckbox(summary, "workflow", workflow);
    if (workflow.disabled) summary.createEl("span", { text: "Disabled", cls: "auto-oc-badge auto-oc-badge-disabled" });

    const nameEl = summary.createEl("span", {
      text: workflow.name,
      cls: "auto-oc-task-name",
    });

    const badge = summary.createEl("span", {
      text: (workflow as any).runtimeExecution?.disposition ? `${workflow.status} · human disposition ${(workflow as any).runtimeExecution.disposition.at} · external outcome unknown` : workflow.status === "abandoned" ? "abandoned · outcome unknown" : workflow.status,
      cls: `auto-oc-badge auto-oc-badge-${workflow.status}`,
    });
    this.renderExecutionStatus(summary, workflow, "workflow");
    const quickActions = summary.createDiv("auto-oc-card-quick-actions");
    this.renderAvailabilityButton(quickActions, "workflow", workflow);
    const btnQuickRun = quickActions.createEl("button", { text: "▶", cls: "auto-oc-btn-run" });
    btnQuickRun.title = this.plugin.isWorkflowExecuting(workflow.id) ? "Running" : "Run workflow";
    this.plugin.configureStartButton(btnQuickRun, "workflow", workflow.id, true);
    btnQuickRun.onclick = async (e) => {
      e.stopPropagation();
      try { await this.plugin.runWorkflow(workflow); }
      catch (error) { new Notice(this.plugin.redactSecrets(String(error))); }
    };
    if (this.plugin.isWorkflowExecuting(workflow.id)) {
      const btnQuickStop = quickActions.createEl("button", { text: "⏹", cls: "auto-oc-btn-stop" });
      btnQuickStop.title = "Stop workflow now";
      btnQuickStop.onclick = async (e) => {
        e.stopPropagation();
        btnQuickStop.disabled = true;
        await this.plugin.killWorkflow(workflow.id, (workflow as any).runtimeExecution?.runId);
      };
    }
    const currentTask = this.plugin.settings.tasks.find((task) => task.id === workflow.steps[workflow.currentStep]?.taskId);
    const btnQuickLog = quickActions.createEl("button", { text: "📄", cls: "auto-oc-btn-output" });
    btnQuickLog.title = "Current step log";
    btnQuickLog.disabled = !currentTask || (!currentTask.output && currentTask.status !== "running");
    btnQuickLog.onclick = (e) => {
      e.stopPropagation();
      if (currentTask) new LiveLogModal(this.app, currentTask, this.plugin).open();
    };
    const btnQuickHistory = quickActions.createEl("button", { text: "📜", cls: "auto-oc-btn-history" });
    btnQuickHistory.title = "Current step history";
    btnQuickHistory.disabled = !currentTask;
    btnQuickHistory.onclick = (e) => {
      e.stopPropagation();
      if (currentTask) new LogHistoryModal(this.app, currentTask, this.plugin).open();
    };
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
      if (step.stepKind === "code") {
        this.renderWorkflowCodeEntry(stepsDiv, {workflow, step, stepIndex:i, name:stepLabel(step), area:step.area?.trim() || workflow.area?.trim() || "No area", status:codeStepDisplay(step).status});
        continue;
      }
      const task = this.plugin.settings.tasks.find((t) => t.id === step.taskId);
      const stepName = stepLabel(step);
      const stepItem = stepsDiv.createDiv("auto-oc-workflow-task-detail");
      stepItem.setAttr("data-auto-oc-owner-workflow-id", workflow.id);
      stepItem.setAttr("data-auto-oc-step-id", step.id);
      const isCurrent = this.plugin.isWorkflowExecuting(workflow.id) && workflow.currentStep === i;
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
        if (step.stepKind === "delay") {
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

    const durableExecution=(workflow as any).runtimeExecution;
    if(durableExecution && !durableExecution.disposition && (['ready','in_flight'].includes(durableExecution.phase) || durableExecution.terminalUncertainty) && !this.plugin.isWorkflowExecuting(workflow.id)) {
      actions.createEl('button',{text:'Resolve blocked execution…'}).onclick=e=>{e.stopPropagation();this.plugin.openBlockedExecutionsReview(durableExecution.runId);};
    }
    if(durableExecution?.terminalUncertainty && !durableExecution.disposition && ['failed','completed'].includes(durableExecution.phase) && !this.plugin.isWorkflowExecuting(workflow.id)) {
      const dispose=actions.createEl('button',{text:'Resolve historical uncertainty'});
      dispose.onclick=async e=>{e.stopPropagation();try {await this.plugin.confirmTerminalDisposition(workflow.id,durableExecution.runId);} catch(error) {new Notice(this.plugin.redactSecrets(String(error)));} finally {this.refresh();}};
    }
    const needsRecovery=durableExecution && ["ready","in_flight"].includes(durableExecution.phase);
    if (needsRecovery && !this.plugin.isWorkflowExecuting(workflow.id)) {
      let mode:"resume"|"reconcile"|"blocked"="blocked";
      try {mode=this.plugin.sharedWorkflowRecoveryMode(workflow.id,durableExecution.runId);} catch { /* Invalid or stale evidence cannot authorize continuation. */ }
      const uncertain=mode === "reconcile";
      actions.createEl("span", {text:mode === "blocked" ? durableExecution.definitionChanged
        ? "The workflow definition changed. Review and reset this attempt, or restore the original definition to continue."
        : "Recovery blocked: saved evidence needs reconciliation." : uncertain ? "Previous step needs verification before continuing." : "Saved execution has pending steps."});
      const recover=actions.createEl("button", {text:uncertain ? "Verify previous result" : "Resume saved execution"});
      recover.disabled=mode === "blocked";
      recover.onclick=async(e)=>{
        e.stopPropagation();recover.disabled=true;
        try {await this.plugin.recoverSharedWorkflow(workflow.id,durableExecution.runId);}
        catch(error) {new Notice(this.plugin.redactSecrets(String(error)));}
        finally {this.refresh();}
      };
    }

    const btnRun = actions.createEl("button", {
      text: this.plugin.isWorkflowExecuting(workflow.id) ? "⏳ Running…" : "▶ Run Workflow",
      cls: "auto-oc-btn-run",
    });
    this.plugin.configureStartButton(btnRun, "workflow", workflow.id, false);
    btnRun.onclick = async (e) => {
      e.stopPropagation();
      try { await this.plugin.runWorkflow(workflow); }
      catch (error) { new Notice(this.plugin.redactSecrets(String(error))); }
    };

    if (this.plugin.isWorkflowExecuting(workflow.id)) {
      const btnStop = actions.createEl("button", {
        text: "⏹ Stop",
        cls: "auto-oc-btn-stop",
      });
      btnStop.title = "Stop workflow now";
      btnStop.onclick = async (e) => {
        e.stopPropagation();
        btnStop.disabled = true;
        btnStop.textContent = "Stopping…";
        await this.plugin.killWorkflow(workflow.id, (workflow as any).runtimeExecution?.runId);
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

class ConfirmModal extends Modal {
  private resolve?: (value: boolean) => void;
  reason = '';

  constructor(app: App, private titleText: string, private bodyText: string, private requireReason=false) {
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
    if(this.requireReason)new Setting(contentEl).setName('Reason for this human decision').addTextArea(text=>text.onChange(value=>{this.reason=value;}));
    new Setting(contentEl)
      .addButton((btn) => btn.setButtonText("Cancel").onClick(() => { this.resolve?.(false); this.close(); }))
      .addButton((btn) => btn.setButtonText("Confirm").setWarning().onClick(() => { if(this.requireReason && (!this.reason.trim() || this.reason.length>1000)){new Notice('Enter a reason of 1–1000 characters');return;} this.resolve?.(true); this.close(); }));
  }

  onClose() {
    this.resolve?.(false);
    this.resolve = undefined;
    this.contentEl.empty();
  }
}

// ─── Create / Edit Task Modal ─────────────────────────────────────────────────

class AutoOCRecoveryView extends ItemView {
  private renderGeneration = 0;
  constructor(leaf: WorkspaceLeaf, private reason: string, private retry: () => Promise<void>, private recoverClosedSession?: () => void, private waitingForOwner = false, private sameProcessOwner = false,
    private readCatalog?: () => Promise<PanelCatalog>, private updatePackage?: () => Promise<void>, private reviewBlocked?: () => void) { super(leaf); }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "AutoOC"; }
  getIcon() { return "workflow"; }
  async onOpen() {
    const generation = ++this.renderGeneration;
    this.contentEl.empty();
    this.contentEl.createEl("h2", {text: "AutoOC"});
    this.contentEl.createEl("p", {text: "Consultation mode — browse the saved catalog while execution is unavailable. Editing and scheduling remain paused."});
    if (this.updatePackage) {
      const update = this.contentEl.createEl('button', {text: 'Check for updates'});
      update.onclick = async () => {
        update.disabled = true;
        try { await this.updatePackage!(); }
        catch (error) { new Notice('AutoOC: ' + String(error)); }
        finally { update.disabled = false; }
      };
    }
    const refresh = this.contentEl.createEl('button', {text: 'Refresh saved catalog'});
    refresh.onclick = () => this.onOpen();
    this.contentEl.createEl("h3", {text: "Execution status"});
    this.contentEl.createEl("p", {text: this.waitingForOwner
      ? "Another AutoOC execution owns the engine. Execution availability will be checked automatically when it releases its reservation."
      : this.recoverClosedSession
      ? "A previous session left its execution reservation behind. You can recover the engine here; saved tasks, workflows and history are preserved."
      : "Another execution or an unfinished operation prevents engine activation. The panel remains available; saved tasks and workflows are preserved."});
    const details = this.contentEl.createEl("pre", {text: this.reason});
    details.style.whiteSpace = 'pre-wrap';
    details.style.overflowWrap = 'anywhere';
    this.contentEl.createEl("p", {text: this.waitingForOwner
      ? "The active execution keeps its reservation. No task will be resumed or repeated when this panel loads."
      : this.recoverClosedSession
      ? "Recovery enables the engine without resuming or repeating any task. Interrupted runs keep their recorded state and still need review before continuation."
      : this.sameProcessOwner
      ? "This Obsidian window still holds a previous AutoOC reservation. Open Resolve blocked executions to reconnect the controls or review and reset a saved attempt. Active work must finish first. Your tasks and history are preserved."
      : "Resolve the execution or save reported above before enabling editing and scheduling. Refreshing the catalog and checking for updates do not resume tasks."});
    if(this.reviewBlocked)this.contentEl.createEl('button',{text:'Resolve blocked executions'}).onclick=()=>this.reviewBlocked!();
    if (this.recoverClosedSession) {
      const recover = this.contentEl.createEl('button', {text: 'Recover closed session and open AutoOC'});
      recover.onclick = async () => {
        if (!confirm('Recover the closed session and open AutoOC? The old reservation will be archived. No task will be resumed or repeated, and unfinished runs will remain pending.')) return;
        recover.disabled = true;
        try { this.recoverClosedSession!(); await this.retry(); }
        catch (error) { new Notice('AutoOC: ' + String(error)); recover.disabled = false; }
      };
    }
    const button = this.contentEl.createEl("button", {text: "Retry execution connection"});
    button.onclick = async () => {
      button.disabled = true;
      try { await this.retry(); }
      catch (error) { new Notice('AutoOC: ' + String(error)); button.disabled = false; }
    };
    this.contentEl.createEl('h3', {text: 'Saved catalog'});
    const status = this.contentEl.createEl('p', {text: 'Reading the saved catalog…'});
    try {
      if (!this.readCatalog) throw new Error('Catalog consultation is unavailable');
      const catalog = await this.readCatalog();
      if (generation !== this.renderGeneration) return;
      status.textContent = 'Snapshot of the last saved state. A recorded running or failed status does not prove current activity.';
      for (const [kind, title] of [['tasks', 'Tasks'], ['workflows', 'Workflows']] as const) {
        this.contentEl.createEl('h3', {text: `${title} (${catalog[kind].length})`});
        for (const entry of catalog[kind]) {
          this.contentEl.createEl('p', {text: `${entry.name} — ${entry.status} [${entry.id}]`});
          if (entry.runId) this.contentEl.createEl('small', {text: `Recorded run: ${entry.runId} · ${entry.phase || 'unknown'}`});
        }
      }
    } catch {
      if (generation === this.renderGeneration) status.textContent = 'The saved catalog could not be read safely. No data was changed. Refresh to try again; execution details above remain available.';
    }
  }
  async onClose() { this.renderGeneration++; this.contentEl.empty(); }
}

class CreateTaskModal extends Modal {
  private plugin: AutoOCPlugin;
  private editTask?: ScheduledTask;
  private draft: Partial<ScheduledTask>;
  private focusNameOnNextOpen = true;
  private aiDraftModal?: AiDraftModal;
  private editorClosed = false;
  private generatedDraft = false;
  private savingGeneratedDraft = false;

  constructor(app: App, plugin: AutoOCPlugin, editTask?: ScheduledTask, private readonly saveDraft?: (task: ScheduledTask) => void) {
    super(app);
    this.plugin = plugin;
    this.editTask = editTask;
    this.draft = editTask
      ? (saveDraft ? JSON.parse(JSON.stringify(editTask)) : { ...editTask })
      : {
            name: "",
            taskKind: plugin.settings.defaultAiEngine,
            prompt: "",
            model: plugin.settings.defaultAiEngine === "codex"
              ? plugin.getEffectiveCodexModel()
              : plugin.settings.defaultAiEngine === "copilot" ? plugin.settings.defaultCopilotModel || "" : plugin.settings.defaultAiEngine === "opencode2" ? plugin.settings.defaultOpencode2Model || "" : plugin.getEffectiveDefaultModel(),
            agent: plugin.settings.defaultAiEngine === "opencode2" ? plugin.settings.defaultOpencode2Agent || "build" : plugin.getEffectiveAgent(),
            reasoningEffort: plugin.settings.defaultCodexReasoningEffort,
            useRalphLoop: false,
            forceModel: false,
            interactiveTerminal: isOpenCodeTask(plugin.settings.defaultAiEngine) && plugin.settings.defaultInteractiveTerminal,
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
    const dependencyError = autoOCDependencyError(this.draft);
    if (dependencyError) contentEl.createEl("p", {text: dependencyError, cls: "mod-warning"});
    contentEl.addClass("auto-oc-modal");
    setAutoOCModalSize(this, 900);
    preventBackdropClose(this);
    const shouldFocusName = this.focusNameOnNextOpen;
    this.focusNameOnNextOpen = false;

    // Header with X button
    const headerBar = contentEl.createDiv("auto-oc-modal-header");
    const taskKind = (this.draft.taskKind || "opencode") as TaskKind;
    const taskType = taskKind === "opencode2" && this.draft.interactiveTerminal ? "cli2" : taskKind === "opencode" && this.draft.interactiveTerminal
      ? "cli"
      : taskKind === "codex" && this.draft.interactiveTerminal
        ? "codex-app"
        : taskKind;
    headerBar.createEl("h3", {
      text: this.editTask ? "Edit Task" : "New Task",
    });
    if (!this.editTask) new Setting(contentEl).setName("Start from a description")
      .setDesc("AI prepares a draft. Review and edit it here before creating the task.")
      .addButton(button => button.setButtonText("Create with AI").onClick(() => {
        this.aiDraftModal = this.plugin.openAiDraft("task", this.draft.prompt || this.draft.name || "", generated => {
          if (this.editorClosed) return;
          this.draft = generated.tasks[0] as ScheduledTask;
          this.generatedDraft = true;
          this.focusNameOnNextOpen = true;
          this.onOpen();
        });
      }));
    if (this.saveDraft) contentEl.createEl("p", { text: "This task is part of an unsaved workflow draft. Changes stay in the editor until you create the workflow." });

    new Setting(contentEl)
      .setName("Task type")
      .setDesc("Choose the CLI and version this task uses. OpenCode 1 and OpenCode 2 use separate executable paths in Settings.")
      .addDropdown((dd) => {
        dd.addOption("opencode", "OpenCode 1 task");
        dd.addOption("opencode2", "OpenCode 2 task");
        dd.addOption("codex", "Codex task");
        dd.addOption("codex-app", "ChatGPT / Codex task");
        dd.addOption("copilot", "GitHub Copilot CLI task");
        dd.addOption("code", "Code task");
        dd.addOption("cli", "OpenCode 1 CLI task (interactive)");
        dd.addOption("cli2", "OpenCode 2 CLI task (interactive)");
        dd.setValue(taskType);
        dd.onChange((v) => {
          this.draft.taskKind = v === "opencode2" || v === "cli2" ? "opencode2" : v === "code" ? "code" : v === "copilot" ? "copilot" : (v === "codex" || v === "codex-app") ? "codex" : "opencode";
          this.draft.interactiveTerminal = v === "cli" || v === "cli2" || v === "codex-app";
          if (v === "codex" || v === "codex-app") {
            this.draft.model = "";
            this.draft.reasoningEffort = this.plugin.settings.defaultCodexReasoningEffort;
          } else if (v === "copilot") {
            this.draft.model = this.plugin.settings.defaultCopilotModel || "";
            this.draft.agent = "";
            this.draft.reasoningEffort = undefined;
            this.draft.useRalphLoop = false;
            this.draft.forceModel = false;
            this.draft.branch = "";
            this.draft.createBranch = false;
          } else if (v === "opencode2" || v === "cli2") {
            this.draft.model = this.plugin.settings.defaultOpencode2Model || "";
            this.draft.agent = this.plugin.settings.defaultOpencode2Agent || "build";
            this.draft.useRalphLoop = false;
          } else if (v === "opencode" || v === "cli") {
            this.draft.model = this.plugin.getEffectiveDefaultModel();
          }
          if (v === "code" && !this.draft.code) {
            this.draft.code = "// Set output to pass data forward\noutput = input;";
          }
          this.onOpen();
        });
      });

    new Setting(contentEl)
      .setName("Concurrency")
      .setDesc("Use the vault default, run alone, or allow parallel work in the same vault. Parallel runs can edit the same files, so give them different outputs. " +
        "Separate projects only keeps folder and Git repository checks. Interactive sessions and branch changes run alone. " +
        "The maximum simultaneous runs is set in AutoOC settings. Inside a workflow, the workflow's choice applies.")
      .addDropdown(dd=>dd.addOption("inherit","Use vault default").addOption("exclusive","Run alone").addOption("parallel","Parallel in this vault").addOption("independent","Separate projects only")
        .setValue(this.draft.concurrency || "inherit").onChange(v=>{this.draft.concurrency=v==="inherit" ? undefined : v as ConcurrencyPolicy;}));

    new Setting(contentEl)
      .setName("Name")
      .setDesc("Short task identifier")
      .addText((text) => {
        text.inputEl.addClass("auto-oc-modal-input");
        text
          .setValue(this.draft.name ?? "")
          .onChange((v) => (this.draft.name = v));
        if (shouldFocusName) window.setTimeout(() => text.inputEl.focus(), 50);
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
          setupCodeTextarea(ta.inputEl, this.app);
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
      const promptNotice = contentEl.createDiv("auto-oc-prompt-notice");
      promptNotice.style.display = "none";
      new Setting(contentEl)
        .setName("Prompt / Goal")
        .setDesc(`Text to send to ${taskKind === "copilot" ? "GitHub Copilot CLI" : taskKind === "codex" ? "Codex" : "OpenCode"}`)
        .addTextArea((ta) => {
          const updatePromptNotice = (value: string) => {
            if (taskKind === "opencode" && this.draft.interactiveTerminal && value.length > SAFE_CLI_PROMPT_LENGTH) {
              ta.inputEl.addClass("auto-oc-prompt-too-long");
              promptNotice.setText(
                "On Windows, interactive CLI prompts are kept in an ignored session directory until the CLI exits. Launch confirmation does not mean the agent has finished the task.",
              );
              promptNotice.style.display = "block";
            } else {
              ta.inputEl.removeClass("auto-oc-prompt-too-long");
              promptNotice.setText("");
              promptNotice.style.display = "none";
            }
          };
          ta.setValue(this.draft.prompt ?? "").onChange((v) => {
            this.draft.prompt = v;
            updatePromptNotice(v);
          });
          ta.inputEl.addClass("auto-oc-modal-textarea");
          ta.inputEl.rows = 5;
          ta.inputEl.style.width = "100%";
          ta.inputEl.spellcheck = false;
          updatePromptNotice(this.draft.prompt ?? "");
        });
    }

    contentEl.createDiv("auto-oc-modal-section-title").setText(isOpenCodeTask(taskKind) ? "📂 Workspace & Git" : "📂 Workspace");

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
    if (isOpenCodeTask(taskKind)) {
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
        .setName("Force model")
        .setDesc("Skip --agent so OpenCode uses exactly the selected model.")
        .addToggle((tog) => {
          tog.setValue(this.draft.forceModel ?? false);
          tog.onChange((v) => (this.draft.forceModel = v));
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
    } else if (taskKind === "opencode2") {
      this.draft.model ||= this.plugin.settings.defaultOpencode2Model || "";
      this.draft.agent ||= this.plugin.settings.defaultOpencode2Agent || "build";
      new Setting(contentEl).setName("OpenCode 2 model")
        .setDesc("Enter a provider/model ID from your OpenCode 2 installation. Run opencode models to see its available models.")
        .addText(text => text.setPlaceholder("provider/model").setValue(this.draft.model || this.plugin.settings.defaultOpencode2Model || "")
          .onChange(value => { this.draft.model = value.trim(); }));
      new Setting(contentEl).setName("OpenCode 2 agent").setDesc("Agent configured in OpenCode 2. Default: build.")
        .addText(text => text.setValue(this.draft.agent || this.plugin.settings.defaultOpencode2Agent || "build")
          .onChange(value => { this.draft.agent = value.trim(); }));
      new Setting(contentEl).setName("Force model").setDesc("Omit --agent so the CLI uses the selected model without an agent override.")
        .addToggle(toggle => toggle.setValue(!!this.draft.forceModel).onChange(value => { this.draft.forceModel = value; }));
      contentEl.createEl("p", { text: this.draft.interactiveTerminal
        ? "Opens OpenCode 2 mini with your model, agent and prompt. AutoOC confirms startup; the terminal session remains under your control."
        : "Runs OpenCode 2 with a private server. AutoOC captures the result and waits for completion. Explicitly denied permissions remain denied.", cls: "setting-item-description" });
    } else if (taskKind === "codex") {
      new Setting(contentEl)
        .setName("Codex model")
        .setDesc("Model used by Codex. Automatic uses the current ChatGPT/Codex default.")
        .addDropdown((dd) => {
          dd.addOption("", "Automatic");
          this.plugin.availableCodexModels.forEach((entry) => dd.addOption(entry.value, entry.label));
          const current = this.draft.model ?? this.plugin.settings.defaultCodexModel ?? "";
          if (current && !this.plugin.availableCodexModels.some((entry) => entry.value === current)) dd.addOption(current, current);
          dd.setValue(current);
          dd.onChange((value) => {
            this.draft.model = value;
            const efforts = this.plugin.getCodexReasoningEfforts(value);
            if (!efforts.includes(this.draft.reasoningEffort || "")) this.draft.reasoningEffort = efforts[0];
            this.onOpen();
          });
        })
        .addButton((btn) => btn.setButtonText("🔄 Refresh").onClick(async () => {
          await this.plugin.refreshCodexModels(true);
          this.onOpen();
        }));

      new Setting(contentEl)
        .setName("Reasoning effort")
        .setDesc("How much reasoning Codex should use for this task.")
        .addDropdown((dd) => {
          const efforts = this.plugin.getCodexReasoningEfforts(this.draft.model);
          efforts.forEach((effort) => dd.addOption(effort, effort));
          const current = this.draft.reasoningEffort || this.plugin.settings.defaultCodexReasoningEffort || efforts[0];
          if (current && !efforts.includes(current)) dd.addOption(current, current);
          dd.setValue(current || "");
          dd.onChange((value) => (this.draft.reasoningEffort = value));
        });
    } else if (taskKind === "copilot") {
      addCopilotTaskSettings(contentEl, this.draft, this.plugin.settings.defaultCopilotModel);
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
        .setButtonText(this.saveDraft ? "Apply to workflow draft" : this.editTask ? "Save Changes" : "Create Task")
        .setCta()
        .onClick(async () => {
          if (!this.draft.name?.trim()) {
            new Notice("Name is required.");
            return;
          }
          const savingTaskKind = (this.draft.taskKind || "opencode") as TaskKind;
          if (savingTaskKind !== "code" && !this.draft.prompt?.trim()) {
            new Notice("Prompt is required.");
            return;
          }
          if (savingTaskKind === "code" && !(this.draft.code || "").trim()) {
            new Notice("Code is required.");
            return;
          }
          if (isOpenCodeTask(savingTaskKind) && !(this.draft.model ?? "").trim()) {
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

          if (this.saveDraft) {
            this.saveDraft({ ...this.draft, id: this.editTask?.id || generateId(), name: this.draft.name!,
              status: "pending", lastRun: "", output: "", createdAt: this.draft.createdAt || new Date().toISOString(), taskKind: savingTaskKind,
              prompt: savingTaskKind === "code" ? this.draft.code || "" : this.draft.prompt || "",
            } as ScheduledTask);
            this.close();
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
                disabled: existing.disabled,
                prompt: savingTaskKind === "code" ? (this.draft.code || "") : (this.draft.prompt || ""),
                concurrency: this.draft.concurrency,
                taskKind: savingTaskKind,
                interactiveTerminal: savingTaskKind === "code" ? undefined : !!this.draft.interactiveTerminal,
                reasoningEffort: savingTaskKind === "codex" ? this.draft.reasoningEffort : undefined,
                copilotAllowAllTools: savingTaskKind === "copilot" ? this.draft.copilotAllowAllTools === true : undefined,
                ...(existing ? {runtimeExecution:(existing as any).runtimeExecution,legacyExecution:existing.legacyExecution} : {}),
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
              concurrency: this.draft.concurrency,
              name: this.draft.name!,
              prompt: savingTaskKind === "code" ? (this.draft.code || "") : this.draft.prompt!,
              model: savingTaskKind === "code" ? "" : this.draft.model!,
              area: this.draft.area ?? "",
              agent: savingTaskKind === "opencode2" ? this.draft.agent || this.plugin.settings.defaultOpencode2Agent || "build" : savingTaskKind === "opencode" ? this.plugin.getEffectiveAgent(this.draft.agent) : "",
              reasoningEffort: savingTaskKind === "codex" ? (this.draft.reasoningEffort || this.plugin.settings.defaultCodexReasoningEffort) : undefined,
              copilotAllowAllTools: savingTaskKind === "copilot" ? this.draft.copilotAllowAllTools === true : undefined,
              useRalphLoop: savingTaskKind === "opencode" ? (this.draft.useRalphLoop ?? false) : false,
              forceModel: isOpenCodeTask(savingTaskKind) ? (this.draft.forceModel ?? false) : false,
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
              branch: isOpenCodeTask(savingTaskKind) ? this.draft.branch : "",
              createBranch: isOpenCodeTask(savingTaskKind) ? this.draft.createBranch : false,
              interactiveTerminal: savingTaskKind === "code" ? undefined : !!this.draft.interactiveTerminal,
              code: savingTaskKind === "code" ? this.draft.code : undefined,
              codeLang: savingTaskKind === "code" ? "javascript" : undefined,
              codeInputVar: savingTaskKind === "code" ? (this.draft.codeInputVar || "input") : undefined,
              codeOutputVar: savingTaskKind === "code" ? (this.draft.codeOutputVar || "output") : undefined,
              codeAllowVault: savingTaskKind === "code" ? !!this.draft.codeAllowVault : undefined,
              codeAllowFiles: savingTaskKind === "code" ? !!this.draft.codeAllowFiles : undefined,
              codeAllowTerminal: savingTaskKind === "code" ? !!this.draft.codeAllowTerminal : undefined,
            };
            if (this.generatedDraft) {
              if (this.savingGeneratedDraft) return;
              this.savingGeneratedDraft = true; btn.setDisabled(true);
              try {
                await this.plugin.saveGeneratedDefinitionDraft([task]);
                new Notice(`Task "${task.name}" saved.`); this.close();
              } catch (error) { new Notice(`Could not save the task: ${(error as Error).message}. Your draft is still available.`); }
              finally { this.savingGeneratedDraft = false; btn.setDisabled(false); }
              return;
            }
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
    this.editorClosed = true;
    this.aiDraftModal?.close();
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
    const dependencyError = autoOCDependencyError(this.draft);
    if (dependencyError) contentEl.createEl("p", {text: dependencyError, cls: "mod-warning"});
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
          text.inputEl.rows = 12;
          text.setValue(initialCode).onChange((v) => (this.draft.code = v));
          setupCodeTextarea(text.inputEl, this.app);
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
  private draftTasks: ScheduledTask[] = [];
  private generatedDraft = false;
  private savingGeneratedDraft = false;
  private editorClosed = false;
  private aiDraftModal?: AiDraftModal;
  private draftTaskModal?: CreateTaskModal;

  private availableTasks(): ScheduledTask[] { return [...this.plugin.settings.tasks, ...this.draftTasks]; }
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
    const dependencyError = autoOCDependencyError(this.draft);
    if (dependencyError) contentEl.createEl("p", {text: dependencyError, cls: "mod-warning"});
    contentEl.addClass("auto-oc-modal");
    setAutoOCModalSize(this, 1100);
    preventBackdropClose(this);

    // Header with X button
    const headerBar = contentEl.createDiv("auto-oc-modal-header");
    headerBar.createEl("h3", {
      text: this.editWorkflow ? "Edit Workflow" : "New Workflow",
    });
    if (!this.editWorkflow) new Setting(contentEl).setName("Start from a description")
      .setDesc("AI prepares a sequential workflow and its tasks. Nothing is saved until you create the workflow.")
      .addButton(button => button.setButtonText("Create with AI").onClick(() => {
        this.aiDraftModal = this.plugin.openAiDraft("workflow", this.draft.description || this.draft.name || "", generated => {
          if (this.editorClosed) return;
          this.draft = generated.workflow as Workflow;
          this.selectedSteps = this.draft.steps || [];
          this.draftTasks = generated.tasks as ScheduledTask[];
          this.generatedDraft = true;
          this.stepConfigs = {};
          for (const step of this.selectedSteps) this.stepConfigs[step.id!] = {
            transitionMode: step.transitionMode as "default" | "force" | "eval", evaluatePrompt: step.evaluatePrompt,
          };
          this.onOpen();
        });
      }));
    if (this.generatedDraft) contentEl.createEl("p", {
      text: "AI draft — review each step. Use Edit draft task to change its prompt, model or permissions. Tasks and workflow are saved together only when you click Create Workflow; cancelling discards this draft.",
      cls: "auto-oc-ai-draft-note",
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
      .setName("Concurrency")
      .setDesc("Use the vault default, run alone, or allow parallel work in the same vault. Parallel runs can edit the same files, so give them different outputs. " +
        "Separate projects only keeps folder and Git repository checks. Interactive sessions and branch changes run alone. " +
        "Workflows sharing a reusable task cannot overlap. The steps within this workflow still follow their transitions in order.")
      .addDropdown(dd=>dd.addOption("inherit","Use vault default").addOption("exclusive","Run alone").addOption("parallel","Parallel in this vault").addOption("independent","Separate projects only")
        .setValue(this.draft.concurrency || "inherit").onChange(v=>{this.draft.concurrency=v==="inherit" ? undefined : v as ConcurrencyPolicy;}));

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
                disabled: existing.disabled,
                concurrency: this.draft.concurrency,
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
              concurrency: this.draft.concurrency,
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
            if (this.generatedDraft) {
              if (this.savingGeneratedDraft) return;
              this.savingGeneratedDraft = true; btn.setDisabled(true);
              try {
                await this.plugin.saveGeneratedDefinitionDraft(this.draftTasks, workflow);
                new Notice(`Workflow "${this.draft.name}" and its tasks saved.`);
                this.close();
              } catch (error) { new Notice(`Could not save the workflow: ${(error as Error).message}. Your draft is still available.`); }
              finally { this.savingGeneratedDraft = false; btn.setDisabled(false); }
              return;
            }
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
    const task = this.availableTasks().find((t) => t.id === step.taskId);
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
      const task = step.stepKind === "task" ? this.availableTasks().find((t) => t.id === step.taskId) : undefined;
      const config = this.stepConfigs[step.id] || {};

      const stepEl = container.createDiv("auto-oc-workflow-step-item");
      if (task && this.draftTasks.some(draft => draft.id === task.id)) {
        const edit = stepEl.createEl("button", { text: "Edit draft task" });
        edit.onclick = () => {
          this.draftTaskModal = new CreateTaskModal(this.app, this.plugin, task, updated => {
            if (this.editorClosed) return;
            this.draftTasks = this.draftTasks.map(draft => draft.id === updated.id ? updated : draft);
            this.renderStepsList(container);
          });
          this.draftTaskModal.open();
        };
        stepEl.createEl("p", { text: task.prompt, cls: "auto-oc-ai-draft-prompt" });
      }
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
            text.inputEl.rows = 6;
            text.setValue(initialCode).onChange((v) => (step.code = v));
            setupCodeTextarea(text.inputEl, this.app);
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
    const tasks = this.availableTasks().filter(
      (t) => !selectedTaskIds.includes(t.id)
    );

    // "Create New Task" button — always visible
    const btnCreateTask = addDiv.createEl("button", {
      text: "➕ Create New Task",
      cls: "auto-oc-btn-secondary",
    });
    btnCreateTask.title = "Create a fresh task and auto-add it to this chain";
    btnCreateTask.onclick = async () => {
      if (this.generatedDraft) {
        this.draftTaskModal = new CreateTaskModal(this.app, this.plugin, undefined, task => {
          if (this.editorClosed) return;
          this.draftTasks.push(task);
          this.selectedSteps.push({ id: generateId(), stepKind: "task", taskId: task.id, area: this.draft.area || task.area || "", transitions: [] });
          this.renderStepsList(container);
        });
        this.draftTaskModal.open();
        return;
      }
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
          const newTasks = this.availableTasks().filter(
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
          const task = this.availableTasks().find((t) => t.id === sel.value);
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
    this.editorClosed = true;
    this.aiDraftModal?.close();
    this.draftTaskModal?.close();
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

  constructor(app: App, plugin: AutoOCPlugin, taskIds?: Set<string>, workflowIds?: Set<string>) {
    super(app);
    this.plugin = plugin;
    // Header export still selects everything; bulk export starts from the exact selection.
    for (const t of plugin.settings.tasks) if (!taskIds || taskIds.has(t.id)) this.selectedTaskIds.add(t.id);
    for (const w of plugin.settings.workflows) if (!workflowIds || workflowIds.has(w.id)) this.selectedWorkflowIds.add(w.id);
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
    const SUPPORTED = ["1.0", "1.4.0", "1.5.0", "1.6.0"];
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
        const taskKind = t.taskKind || "opencode";
        if (!["opencode", "opencode2", "codex", "copilot", "code"].includes(taskKind)) {
          errors.push(where + ".taskKind is invalid. Expected opencode, opencode2, codex, copilot, or code.");
        }
        const copilotError = getCopilotTaskValidationError(t);
        if (copilotError) errors.push(where + ": " + copilotError);
        if (t.reasoningEffort !== undefined && (taskKind !== "codex" || typeof t.reasoningEffort !== "string" || !t.reasoningEffort.trim())) {
          errors.push(where + ".reasoningEffort is only valid for Codex tasks.");
        }
        if (t.interactiveTerminal !== undefined && typeof t.interactiveTerminal !== "boolean") {
          errors.push(where + ".interactiveTerminal must be a boolean.");
        } else if (taskKind === "code" && t.interactiveTerminal === true) {
          errors.push(where + ": Code tasks cannot set interactiveTerminal.");
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
          const transitions = Array.isArray(s.transitions)
            ? s.transitions
            : s.transitions && typeof s.transitions === "object" && typeof s.transitions.toStepId === "string"
              ? [s.transitions]
              : [];
          if (s.transitions !== undefined && !Array.isArray(s.transitions) && transitions.length === 0) {
            errors.push(swhere + ".transitions must be an array or a single transition object.");
          }
          if (transitions.length > 0) {
            const validModes = ["default", "force", "eval", "conditional"];
            transitions.forEach((t: any, ti: number) => {
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
          (Array.isArray(s.transitions) ? s.transitions : s.transitions && typeof s.transitions === "object" && typeof s.transitions.toStepId === "string" ? [s.transitions] : []).forEach((t: any) => incoming.add(t.toStepId));
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
      this.task = this.plugin.settings.tasks.find(task => task.id === this.task.id) || this.task;
      if (!this.task.lastRun) { elapsedEl.textContent = ""; return; }
      const secs = taskElapsedSeconds(this.task);
      if (secs === undefined) { elapsedEl.textContent = "⏱ Elapsed time: unavailable"; return; }
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
      const newContent = this.plugin.taskLogOutput(latest) || "(no output yet…)";
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

// ─── Diagnostic Modal ─────────────────────────────────────────────────────────

class DiagnosticModal extends Modal {
  private plugin: AutoOCPlugin;
  private logEl: HTMLPreElement | null = null;
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private hiddenProc: HiddenProcessHandle | null = null;
  private tempFiles: string[] = [];

  constructor(app: App, plugin: AutoOCPlugin) {
    super(app);
    this.plugin = plugin;
  }

  private cleanupDiagnostics(killProcess = false) {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
    if (killProcess) {
      this.hiddenProc?.kill();
    } else {
      this.hiddenProc?.cleanup(true);
    }
    this.hiddenProc = null;
    const fs = require("fs");
    for (const file of this.tempFiles) {
      try { fs.unlinkSync(file); } catch { /* ignore */ }
    }
    this.tempFiles = [];
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
        this.cleanupDiagnostics(true);
        if (this.logEl) this.logEl.textContent = "[launching detached process…]\n";
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
        const pidFile = path.join(osTmp, "autooc-diag.pid");
        try { fs.unlinkSync(outFile); } catch { /* ignore */ }
        try { fs.unlinkSync(pidFile); } catch { /* ignore */ }

        let launchScript: string;
        if (isWindows()) {
          launchScript = [
            ...psUtf8Prelude(),
            `$env:USERPROFILE = ${psSingleQuoted(process.env.USERPROFILE || "")}`,
            `$env:APPDATA     = ${psSingleQuoted(process.env.APPDATA || "")}`,
            `$env:LOCALAPPDATA= ${psSingleQuoted(process.env.LOCALAPPDATA || "")}`,
            `$env:PATH        = ${psSingleQuoted(process.env.PATH || "")}`,
            `$env:HOME        = ${psSingleQuoted(process.env.USERPROFILE || "")}`,
            `$outTmp = [System.IO.Path]::GetTempFileName()`,
            `$errTmp = [System.IO.Path]::GetTempFileName()`,
            `$bin = ${psSingleQuoted(bin)}`,
            `$argList = @('run','-m',${psSingleQuoted(model)},'--dangerously-skip-permissions','--','di hola')`,
          `& $bin @argList > $outTmp 2> $errTmp`,
          `$exitCode = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 }`,
          `$out = (Get-Content $outTmp -Raw -Encoding UTF8 -ErrorAction SilentlyContinue).Trim()`,
          `$err = (Get-Content $errTmp -Raw -Encoding UTF8 -ErrorAction SilentlyContinue).Trim()`,
            `Remove-Item $outTmp,$errTmp -ErrorAction SilentlyContinue`,
            `$combined = ($out + $(if($err){"\n" + $err}else{""})).Trim()`,
            `[System.IO.File]::WriteAllText('${outFile.replace(/'/g, "''")}', $combined + "\nDONE:" + $exitCode)`,
          ].join("\n");
        } else {
          const shEnv: Record<string, string> = {
            HOME: process.env.HOME || process.env.USERPROFILE || "",
            PATH: process.env.PATH || "",
          };
          launchScript = [
            `echo $$ > ${shSingleQuoted(pidFile)}`,
            ...buildShEnvLines(shEnv),
            `bin=${shSingleQuoted(bin)}`,
            `out_tmp="$(mktemp)"`,
            `err_tmp="$(mktemp)"`,
            `"$bin" run -m ${shSingleQuoted(model)} --dangerously-skip-permissions -- 'di hola' > "$out_tmp" 2> "$err_tmp"`,
            `exit_code=$?`,
            `stdout="$(cat "$out_tmp" 2>/dev/null)"`,
            `stderr="$(cat "$err_tmp" 2>/dev/null)"`,
            `rm -f "$out_tmp" "$err_tmp"`,
            `if [ -n "$stderr" ]; then combined="$(printf '%s\n%s' "$stdout" "$stderr")"; else combined="$stdout"; fi`,
            `printf '%s\nDONE:%s' "$combined" "$exit_code" > ${shSingleQuoted(outFile)}`,
          ].join("\n");
        }

        const scriptFile = path.join(osTmp, `autooc-diag${scriptExt()}`);
        if (isWindows()) writeUtf8BomFile(scriptFile, launchScript);
        else fs.writeFileSync(scriptFile, launchScript, "utf8");
        this.tempFiles = [outFile, pidFile, scriptFile];
        if (this.logEl) this.logEl.textContent += `Script: ${scriptFile}\n\n`;

        // Launch hidden as a direct child so diagnostics can be cancelled cleanly.
        this.hiddenProc = launchHidden(scriptFile, pidFile);

        const startedAt = Date.now();
        this.pollHandle = setInterval(() => {
          if (Date.now() - startedAt > 180000) {
            this.cleanupDiagnostics(true);
            if (this.logEl) this.logEl.textContent += "\n\n[timeout]";
            return;
          }
          if (!fs.existsSync(outFile)) {
            if (this.logEl) this.logEl.textContent += ".";
            return;
          }
          if (this.pollHandle) clearInterval(this.pollHandle);
          this.pollHandle = null;
          const raw = fs.readFileSync(outFile, "utf8");
          this.cleanupDiagnostics(false);
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

  onClose() {
    this.cleanupDiagnostics(true);
    this.contentEl.empty();
  }
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

    const credentialIssue = this.plugin.legacyCredentialNoticeStatus();
    if (credentialIssue) new Setting(containerEl).setName("Legacy credential notice")
      .setDesc(credentialIssue.acknowledged
        ? "Reminder dismissed on this device. Some historical values still cannot be hidden in output. You can retry reading them here."
        : "Some historical credentials cannot be read for output masking. This notice does not block tasks. Review it, retry, or dismiss the reminder while keeping the file.")
      .addButton(button => button.setButtonText("Review").onClick(() => this.plugin.openLegacyCredentialNotice(() => this.display())));

    new Setting(containerEl).setName('Resolve blocked executions')
      .setDesc('Review and reset a selected blocked attempt while keeping its history. Nothing starts automatically.')
      .addButton(button=>button.setButtonText('Review').onClick(()=>this.plugin.openBlockedExecutionsReview()));

    new Setting(containerEl).setName('Review older attempts')
      .setDesc('Review unfinished runs left behind by an earlier task or workflow attempt. Keeps current items and history; nothing runs automatically.')
      .addButton(button=>button.setButtonText('Review').onClick(async()=>{
        button.setDisabled(true);
        try {await this.plugin.openHistoricalAttemptsReview();}
        catch(error){new Notice(this.plugin.redactSecrets(String(error)));}
        finally {button.setDisabled(false);}
      }));

    addDashboardBubbleSizeSetting(containerEl, {
      getDiameter: () => this.plugin.getDashboardBubbleDiameter(),
      saveDiameter: diameter => this.plugin.saveDashboardBubbleDiameter(diameter),
      applyDiameter: diameter => this.plugin.applyDashboardBubbleDiameter(diameter),
    });

    new Setting(containerEl).setName("Default concurrency")
      .setDesc("Applies to tasks and workflows set to Use vault default, including existing items without an explicit choice. Parallel runs can share this vault and use the same AI engine. Give them different output files to avoid overwriting each other's work. Changes apply to new runs.")
      .addDropdown(dropdown=>dropdown.addOption("exclusive","Run alone").addOption("parallel","Parallel in this vault").addOption("independent","Separate projects only")
        .setValue(this.plugin.settings.defaultConcurrency || "parallel").onChange(async value=>{
          this.plugin.settings.defaultConcurrency=value as ConcurrencyPolicy;
          try {await this.plugin.saveSettings(false);}
          catch(error){new Notice(this.plugin.redactSecrets(String(error)));}
        }));
    let requestedLimit=String(this.plugin.settings.maxConcurrentExecutions ?? 0);
    new Setting(containerEl).setName("Maximum simultaneous runs")
      .setDesc("Enter 0 for Unlimited, or a whole number such as 4. Counts tasks and workflows together across buttons, schedules and the CLI. Your computer and AI provider still have their own limits. Lowering this value does not stop work already running. There is no automatic queue or retry.")
      .addText(text=>{
        text.inputEl.type="number";text.inputEl.min="0";text.inputEl.step="1";
        text.setValue(requestedLimit).onChange(value=>{requestedLimit=value;});
      })
      .addButton(button=>button.setButtonText("Apply").onClick(async()=>{
        const limit=Number(requestedLimit);
        if(!/^\d+$/.test(requestedLimit) || !Number.isSafeInteger(limit)) {
          new Notice("Enter a whole number of zero or more. Zero means Unlimited.");return;
        }
        button.setDisabled(true);
        try {
          this.plugin.settings.maxConcurrentExecutions=limit;
          await this.plugin.saveSettings(false);
          new Notice(`Maximum simultaneous runs: ${limit===0 ? "Unlimited" : limit}.`);
        } catch(error){new Notice(this.plugin.redactSecrets(String(error)));}
        finally {button.setDisabled(false);}
      }));

    new Setting(containerEl)
      .setName("Default AI engine")
      .setDesc("Engine selected for new AI tasks. Choosing OpenCode 2 also uses its model and agent for workflow AI evaluation. Existing tasks keep their selected engine.")
      .addDropdown((dropdown) => dropdown
        .addOption("opencode", "OpenCode 1")
        .addOption("opencode2", "OpenCode 2")
        .addOption("codex", "Codex / ChatGPT")
        .addOption("copilot", "GitHub Copilot CLI")
        .setValue(this.plugin.settings.defaultAiEngine)
        .onChange(async (value) => {
          if (value === "opencode" || value === "opencode2" || value === "codex" || value === "copilot") {
            this.plugin.settings.defaultAiEngine = value;
            await this.plugin.saveSettings();
          }
        }));

    addInteractiveCliSettings(containerEl, this.plugin);
    containerEl.createEl("h3", { text: "OpenCode 2 task defaults" });
    containerEl.createEl("p", { text: "Select OpenCode 2 in a task's Task type to use these settings. Existing OpenCode 1 tasks keep their engine. The executable path is configured under OpenCode 2 CLI above.", cls: "setting-item-description" });
    new Setting(containerEl).setName("Default OpenCode 2 model").setDesc("Provider/model ID from your OpenCode 2 installation. Required for automated tasks.")
      .addText(text => text.setPlaceholder("provider/model").setValue(this.plugin.settings.defaultOpencode2Model || "").onChange(async value => {
        this.plugin.settings.defaultOpencode2Model = value.trim(); await this.plugin.saveSettings(false);
      }));
    new Setting(containerEl).setName("Default OpenCode 2 agent").setDesc("Agent configured in OpenCode 2. Default: build.")
      .addText(text => text.setValue(this.plugin.settings.defaultOpencode2Agent || "build").onChange(async value => {
        this.plugin.settings.defaultOpencode2Agent = value.trim() || "build"; await this.plugin.saveSettings(false);
      }));
    addCopilotGlobalSettings(containerEl, this.plugin);

    containerEl.createEl("h3", { text: "Codex task defaults" });
    new Setting(containerEl)
      .setName("Default Codex model")
      .setDesc(`${this.plugin.availableCodexModels.length} models loaded from ChatGPT/Codex.`)
      .addDropdown((dropdown) => {
        dropdown.addOption("", "Automatic");
        this.plugin.availableCodexModels.forEach((model) => dropdown.addOption(model.value, model.label));
        const current = this.plugin.settings.defaultCodexModel || "";
        if (current && !this.plugin.availableCodexModels.some((model) => model.value === current)) dropdown.addOption(current, current);
        dropdown.setValue(current).onChange(async (value) => {
          this.plugin.settings.defaultCodexModel = value;
          const efforts = this.plugin.getCodexReasoningEfforts(value);
          if (!efforts.includes(this.plugin.settings.defaultCodexReasoningEffort)) {
            this.plugin.settings.defaultCodexReasoningEffort = efforts[0];
          }
          await this.plugin.saveSettings();
          this.display();
        });
      })
      .addButton((button) => button.setButtonText("🔄 Reload").onClick(async () => {
        await this.plugin.refreshCodexModels(true);
        this.display();
      }));

    new Setting(containerEl)
      .setName("Default Codex reasoning")
      .addDropdown((dropdown) => {
        const efforts = this.plugin.getCodexReasoningEfforts();
        efforts.forEach((effort) => dropdown.addOption(effort, effort));
        const current = this.plugin.settings.defaultCodexReasoningEffort || efforts[0];
        if (current && !efforts.includes(current)) dropdown.addOption(current, current);
        dropdown.setValue(current || "").onChange(async (value) => {
          this.plugin.settings.defaultCodexReasoningEffort = value;
          await this.plugin.saveSettings();
        });
      });

    containerEl.createEl("h3", { text: "CLI folders and terminals" });

    new Setting(containerEl)
      .setName("Working Directory")
      .setDesc(
        "Default folder for interactive CLI sessions and supported tasks. Empty = vault folder."
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

    if (process.platform === "linux") {
      new Setting(containerEl)
        .setName("Linux terminal emulator")
        .setDesc(
          "Command used to open interactive CLI sessions. Empty = auto-detect (x-terminal-emulator, gnome-terminal, konsole, xfce4-terminal, lxterminal, alacritty, xterm)."
        )
        .addText((text) =>
          text
            .setPlaceholder("auto-detect (e.g. konsole)")
            .setValue(this.plugin.settings.linuxTerminal || "")
            .onChange(async (v) => {
              this.plugin.settings.linuxTerminal = v.trim();
              await this.plugin.saveSettings();
            })
        );
    }

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
      .setName("Default OpenCode Model")
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
