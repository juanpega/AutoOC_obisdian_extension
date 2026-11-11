import * as fs from "fs";
import * as path from "path";
import type { PreparedWorkflow } from "./workflow-definition";
import { prepareWorkflowDefinition } from "./workflow-definition";
import { workflowClosure } from "./workflow-nesting";
import { standaloneTaskWorkflow } from "./standalone-task";
import { physicalPath, isWithinPhysicalPath } from "./path-identity";
import { assertWorkflowEnabled } from "./catalog-availability";
import { selectWorkPage, pageExecutionId, pageIdentityHash, assertNoPageTerminal, verifyWorkPageEnvironment, type WorkPage, type PageRun } from "./work-pages";
import { SettingsWriter, atomicSettingsWrite } from "./settings-writer";
import { catalogTransaction } from "./catalog-transaction";
import { resolveInstalledWorkflowLocation, ensureInstalledWorkflowRuntime } from "./installed-workflow-location";
import { acquireExecutionLease } from "./execution-lease";
import { executionCoordinator } from "./execution-coordinator";
import { runCodeWorkflowHost } from "./code-workflow-host";
import { createWorkflowTaskAdapter } from "./workflow-task-adapters";
import { createWorkflowEvaluator } from "./workflow-evaluation";
import { preflightInstalledWorkflow } from "./workflow-preflight";
import { checkpointUncertainties, readExecutionCheckpoint } from "./execution-journal";
import { readStopRequest } from "./workflow-stop";
import type { InstalledWorkflowOptions } from "./installed-workflow-host";

const runtimeFields = new Set(["status", "lastRun", "output", "currentStep", "runtimeExecution", "legacyExecution", "codeExecution", "lastCodexThreadId", "lastCodexTurnId", "pendingCodexApproval"]);
const clean = (item: any) => Object.fromEntries(Object.entries(item).filter(([key]) => !runtimeFields.has(key)));
// The terminal default only initializes new tasks. Existing tasks keep their explicit mode,
// matching the actual CLI adapters, including legacy OpenCode tasks without taskKind.
const interactivePageTask = (task: Record<string,any>) => task.taskKind === "cli" || task.interactiveTerminal === true;

export function preparePageDefinition(config: any, page: WorkPage, sourceId: string, task: boolean): PreparedWorkflow {
  const root = task ? standaloneTaskWorkflow(sourceId) : config.workflows.find((w: any) => w.id === sourceId);
  if (!root) throw new Error("Workflow no longer exists");
  assertWorkflowEnabled(root, config.tasks, config.workflows);
  const workflows = [root, ...workflowClosure(root, config.workflows)];
  const taskIds = new Set(workflows.flatMap(w => w.steps).filter(s => s.taskId && (!s.stepKind || s.stepKind === "task")).map(s => s.taskId));
  const directory = physicalPath(page.directory);
  const mappedId = (id: string) => pageExecutionId(page.id, id);
  const tasks = config.tasks.filter((t: any) => taskIds.has(t.id)).map((t: any) => {
    if (t.workingDirectory && !isWithinPhysicalPath(directory, t.workingDirectory)) throw new Error("Task '" + t.name + "' has a fixed folder outside this page. Edit its global folder explicitly to inherit the page.");
    if (t.branch || t.createBranch) throw new Error("This task changes Git branches. Use a workflow that works on the page's existing branch.");
    return { ...clean(t), id: mappedId(t.id), workingDirectory: t.workingDirectory || directory,
      prompt: page.objective || page.requirementFile ? (page.objective ? "Page objective:\n" + page.objective + "\n\n" : "") +
        (page.requirementFile ? "Requirement " + page.requirementId + ": read " + page.requirementFile.path + " (SHA256 " + page.requirementFile.sha256 + ").\n\n" : "") + (t.prompt || "") : t.prompt };
  });
  const mapped = workflows.map(w => {
    if (w.handoffBranch) throw new Error("Branch handoff is not supported in page runs yet. The worktree already owns its branch.");
    return { ...clean(w), id: mappedId(w.id), steps: w.steps.map((s: any) => ({ ...clean(s), taskId: s.taskId ? mappedId(s.taskId) : undefined, workflowId: s.workflowId ? mappedId(s.workflowId) : undefined })) } as any;
  });
  const interactive = tasks.filter(interactivePageTask), onlyStep = mapped[0].steps[0];
  if (interactive.length && (mapped.length !== 1 || mapped[0].steps.length !== 1 || !onlyStep.taskId || onlyStep.stepKind && onlyStep.stepKind !== "task")) {
    throw new Error("Run an interactive CLI as a standalone page task or one-step workflow. Its launch does not confirm completion; subsequent page work must wait for the session to end.");
  }
  mapped[0].id = pageExecutionId(page.id, sourceId, task);
  if (task) {
    mapped[0].name = config.tasks.find((item:any)=>item.id===sourceId)?.name || "Standalone task";
    mapped[0].concurrency = config.tasks.find((item:any)=>item.id===sourceId)?.concurrency;
  }
  // Included in the fingerprint: scope never follows the currently visible tab.
  mapped[0].workPage = { id: page.id, identity: pageIdentityHash(page), directory, objective: page.objective };
  return prepareWorkflowDefinition(mapped[0], tasks, { ...config, workingDirectory: directory, workflows: mapped.slice(1) });
}

export async function runPageWorkflow(options: InstalledWorkflowOptions) {
  if (!options.pageId || options.pageId === "main" || options.stepId) throw new Error("Page execution requires a page and a complete task or workflow");
  const location = resolveInstalledWorkflowLocation(options.vault, options.installationDirectory);
  const reader = options.catalogWriter || new SettingsWriter();
  ensureInstalledWorkflowRuntime(location);
  const owned = options.lease ? undefined : acquireExecutionLease(location.runtimeDirectory);
  const lease = options.lease || owned!;
  if (physicalPath(lease.directory) !== physicalPath(location.runtimeDirectory)) { owned?.release(); throw new Error("Lease belongs to another installation"); }
  const coordinator = executionCoordinator(lease);
  let admission: ReturnType<typeof coordinator.admit> | undefined;
  const controller = new AbortController(), abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  let timer: ReturnType<typeof setInterval> | undefined;
  try {
    const definitions = path.join(location.runtimeDirectory, "page-definitions");
    if (fs.existsSync(definitions) && fs.lstatSync(definitions).isSymbolicLink()) throw new Error("Page definitions cannot be a link");
    fs.mkdirSync(definitions, {recursive:true});
    const prepared = await catalogTransaction(location.configurationFile, async () => {
      lease.assertOwned();
      const config: any = await reader.loadAsync(location.configurationFile);
      const page = selectWorkPage(config, options.pageId!);
      if (page.worktreeRemoval) throw new Error("This worktree has been removed or its removal needs review. Page history remains available.");
      if (page.archived && !options.resumeRunId) throw new Error("Restore this page before starting work");
      assertNoPageTerminal(config, page.directory, true);
      if ([...config.tasks, ...config.workflows].some((item: any) => item.status === "running" && !coordinator.knows(item.runtimeExecution?.runId))) throw new Error("Catalog has unresolved running activity");
      await verifyWorkPageEnvironment(page);
      const sourceId = options.taskId || options.workflowId!, task = !!options.taskId;
      let definition: PreparedWorkflow;
      if (options.resumeRunId) {
        if (!/^[a-f0-9-]+$/.test(options.resumeRunId)) throw new Error("Invalid page run identity");
        const snapshotPath = path.join(definitions, options.resumeRunId + ".json");
        if (fs.lstatSync(snapshotPath).isSymbolicLink()) throw new Error("Page definition cannot be a link");
        const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
        if (snapshot.pageId !== page.id || snapshot.sourceId !== sourceId || snapshot.task !== task || snapshot.pageIdentity !== pageIdentityHash(page)) throw new Error("Page execution context changed");
        definition = snapshot.definition;
        const checkpoint = readExecutionCheckpoint(location.runtimeDirectory, options.resumeRunId);
        if (checkpoint.workflowId !== pageExecutionId(page.id, sourceId, task) || checkpoint.definitionHash !== definition.hash) throw new Error("Page snapshot does not match its journal");
        if (!options.reconcile) {
          const current = task ? standaloneTaskWorkflow(sourceId) : config.workflows.find((w: any) => w.id === sourceId);
          if (!current) throw new Error("Original workflow was removed");
          assertWorkflowEnabled(current, config.tasks, config.workflows);
        }
      } else definition = preparePageDefinition(config, page, sourceId, task);
      preflightInstalledWorkflow(definition, page.directory);
      // Page-scoped Code uses its own filesystem-backed vault; never app.vault of the host.
      const terminal = { destination: config.cliTerminalDestination === "integrated" ? "integrated" as const : "external" as const, launch: options.launchInteractiveTerminal };
      if (terminal.destination === "integrated" && !terminal.launch && definition.tasks.some(interactivePageTask)) throw new Error("Integrated CLI tasks need the open Obsidian plugin");
      admission = coordinator.admit(definition, page.directory, options.resumeRunId, { directory: physicalPath(page.directory), worktree: page.kind === "worktree" });
      if (config.pageTerminalClaims?.length && admission.resources.exclusive) throw new Error("Exclusive execution must wait for page terminals to finish.");
      return { page: { ...page }, sourceId, task, definition, terminal };
    });
    const { page, sourceId, task, definition, terminal } = prepared;
    let activeRunId = options.resumeRunId;
    if (terminal.launch) {
      const launch = terminal.launch;
      terminal.launch = request => {
        if (!activeRunId) throw new Error("Page terminal requires a durable execution identity");
        return launch({...request, label: page.name + " · " + request.label,
          page:{pageId:page.id,claimId:"page-cli-" + activeRunId}});
      };
    }
    const acknowledged = activeRunId ? readStopRequest(location.runtimeDirectory, activeRunId) : undefined;
    let stopError: unknown;
    timer = setInterval(() => {
      if (!activeRunId) return;
      try { const request = readStopRequest(location.runtimeDirectory, activeRunId); if (request && request !== acknowledged) abort(); }
      catch (error) { stopError = error; abort(); }
    }, 100); timer.unref?.();
    const result = await runCodeWorkflowHost({
      definition, runtimeDirectory: location.runtimeDirectory, vaultBase: page.directory, lease, admission,
      resumeRunId: options.resumeRunId, reconcile: options.reconcile, maxSteps: options.maxSteps,
      signal: controller.signal, redact: options.redact, onTaskOutput: options.onTaskOutput,
      tasks: createWorkflowTaskAdapter(definition, page.directory, undefined, terminal),
      evaluate: createWorkflowEvaluator(definition, page.directory, controller.signal),
      onCheckpoint: async checkpoint => {
        admission!.bind(checkpoint); activeRunId = checkpoint.runId;
        const snapshotPath = path.join(definitions, checkpoint.runId + ".json");
        if (!fs.existsSync(snapshotPath)) {
          await atomicSettingsWrite(snapshotPath, { pageId: page.id, sourceId, task, pageIdentity: pageIdentityHash(page), definition });
        }
        await catalogTransaction(location.configurationFile, async transaction => {
          lease.assertOwned();
          const baseline = options.catalogVersion?.() || coordinator.catalogVersion;
          if (baseline?.textHash && baseline.textHash === baseline.valueHash) await reader.adoptConfirmed(location.configurationFile, baseline, () => true);
          const current: any = await reader.loadAsync(location.configurationFile);
          if (pageIdentityHash(selectWorkPage(current, page.id)) !== pageIdentityHash(page)) throw new Error("Page changed during execution; checkpoint preserved");
          const row: PageRun = { pageId: page.id, sourceId, task, runId: checkpoint.runId, workflowId: checkpoint.workflowId,
            name: definition.workflow.name || sourceId, phase: checkpoint.phase, revision: checkpoint.revision, createdAt: checkpoint.createdAt || "",
            uncertain: checkpointUncertainties(checkpoint).length > 0 };
          const previous = (current.pageRuns || []).find((run: PageRun) => run.runId === row.runId);
          if (previous && previous.revision > row.revision) throw new Error("Stale page progress");
          const next = { ...current, pageRuns: [...(current.pageRuns || []).filter((run: PageRun) => run.runId !== row.runId), row] };
          const interactive = definition.tasks.some(interactivePageTask);
          if (interactive && checkpoint.phase === "in_flight" && !checkpoint.steps[checkpoint.steps.length-1]?.result) {
            const id = "page-cli-" + checkpoint.runId;
            if (!(current.pageTerminalClaims || []).some((claim:any)=>claim.id===id)) {
              next.pageTerminalClaims = [...(current.pageTerminalClaims || []),{id,pageId:page.id,directory:page.directory,createdAt:new Date().toISOString(),exclusive:admission!.resources.exclusive}];
            }
          }
          await reader.save(location.configurationFile, () => next);
          const version = reader.confirmedVersion(location.configurationFile); coordinator.catalogVersion = version;
          await options.onCheckpoint?.(checkpoint, { catalog: next, version, runId: row.runId, workflowId: row.workflowId, revision: row.revision }, undefined, transaction);
          admission!.confirm(checkpoint);
        });
      },
    });
    if (stopError) throw stopError;
    return result;
  } finally {
    if (timer) clearInterval(timer);
    options.signal?.removeEventListener("abort", abort);
    admission?.finish(); owned?.release();
  }
}
