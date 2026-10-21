import { samePhysicalPath } from "./path-identity";
import * as fs from "fs";
import * as path from "path";
import { SettingsWriter } from "./settings-writer";
import { prepareWorkflowDefinition } from "./workflow-definition";
import { createWorkflowTaskAdapter } from "./workflow-task-adapters";
import { runCodeWorkflowHost, type WorkflowTaskOutput } from "./code-workflow-host";
import { persistWorkflowProgress, type PersistedWorkflowCatalog } from "./workflow-catalog-progress";
import { acquireExecutionLease, type ExecutionLease } from "./execution-lease";
import { readExecutionCheckpoint, type RunCheckpoint } from "./execution-journal";
import { readStopRequest } from "./workflow-stop";
import { standaloneTaskWorkflow } from "./standalone-task";
import { preflightInstalledWorkflow } from "./workflow-preflight";
import { validateProgressBinding } from "./workflow-progress";
import { createWorkflowEvaluator } from "./workflow-evaluation";
import type { VaultMutationBatchFactory } from "./code-vault-mutations";
import { resolveInstalledWorkflowLocation, ensureInstalledWorkflowRuntime } from "./installed-workflow-location";

const preparingInstallations = new Set<string>();

// Shared installed-catalog entry point. The caller must authorize this vault
// and its trusted Code capabilities. No discovery by name or implicit retry.
export async function runInstalledWorkflow(options: {
  vault: string;
  installationDirectory?: string;
  workflowId?: string;
  taskId?: string;
  resumeRunId?: string;
  newExecution?: boolean;
  reconcile?: boolean;
  signal?: AbortSignal;
  maxSteps?: number;
  redact: (output:string) => string;
  lease?: ExecutionLease;
  onCheckpoint?: (checkpoint:RunCheckpoint, catalog?:PersistedWorkflowCatalog)=>Promise<void>;
  onTaskOutput?: (event:WorkflowTaskOutput)=>void;
  vaultMutations?: VaultMutationBatchFactory;
  catalogWriter?: SettingsWriter;
}) {
  if (!path.isAbsolute(options.vault) || !!options.workflowId === !!options.taskId) throw new Error("Explicit vault and exactly one workflow or task identity required");
  if (options.newExecution && (options.resumeRunId || options.reconcile)) throw new Error("New execution cannot also resume or reconcile");
  const location = resolveInstalledWorkflowLocation(options.vault, options.installationDirectory);
  const {vault, configurationFile, runtimeDirectory} = location;
  // Reject a foreign reservation before reading the catalog or creating runtime.
  // The caller retains its lease, including on failure.
  if (options.lease) {
    options.lease.assertOwned();
    if (!samePhysicalPath(options.lease.directory,runtimeDirectory)) throw new Error("Lease belongs to another installation runtime");
  }
  // Reserve existing runtimes before cooperative I/O can admit a second caller.
  // New runtimes remain deferred until successful preflight.
  if (preparingInstallations.has(runtimeDirectory)) throw Object.assign(new Error("Installation already has an advancing session"), {code:"EEXIST"});
  preparingInstallations.add(runtimeDirectory);
  let ownedLease: ExecutionLease | undefined;
  try {
  if (!options.lease && fs.existsSync(runtimeDirectory)) ownedLease = acquireExecutionLease(runtimeDirectory);
  const reader = options.catalogWriter || new SettingsWriter();
  let config:any = await reader.loadAsync(configurationFile);
  if (!config || !Array.isArray(config.tasks) || !Array.isArray(config.workflows)) throw new Error("Invalid AutoOC catalog");
  if (config.tasks.some((task:any)=>task.status === "running") || config.workflows.some((workflow:any)=>workflow.status === "running")) {
    throw new Error("Catalog has unresolved running activity; verify its owner before execution");
  }
  const virtual = options.taskId ? standaloneTaskWorkflow(options.taskId) : undefined;
  if (virtual && config.workflows.some((workflow:any)=>workflow.id === virtual.id)) throw new Error("Reserved task identity conflicts with a workflow");
  const matches = virtual ? config.tasks.filter((task:any)=>task.id === options.taskId) : config.workflows.filter((workflow:any)=>workflow.id === options.workflowId);
  if (matches.length !== 1) throw new Error("Missing or ambiguous workflow identity");
  if (matches[0].runtimeExecution && matches[0].runtimeExecution.runId !== options.resumeRunId && !options.newExecution) {
    throw new Error("Workflow has a bound execution; select that identity explicitly");
  }
  const definition = prepareWorkflowDefinition(virtual || matches[0],config.tasks,config);
  preflightInstalledWorkflow(definition,vault);
  ensureInstalledWorkflowRuntime(location);
  if (!options.lease && !ownedLease) ownedLease = acquireExecutionLease(runtimeDirectory);
  await reader.assertUnchanged(configurationFile);
  const replaceCompletedRunId = options.newExecution ? matches[0].runtimeExecution?.runId : undefined;
  if (replaceCompletedRunId) {
    const previous = readExecutionCheckpoint(runtimeDirectory,replaceCompletedRunId);
    const binding=matches[0].runtimeExecution;
    // A task may last have run inside a workflow. Its saved binding identifies
    // that run; a different standalone task's journal can never authorize it.
    const previousId=virtual && !previous.workflowId.startsWith('@task:') ? binding.workflowId : definition.workflow.id;
    validateProgressBinding({id:previousId,runtimeExecution:binding},previous,replaceCompletedRunId);
    if (!["completed","failed","abandoned"].includes(previous.phase)) {
      throw new Error("Cannot replace an unfinished execution");
    }
  }
  // Only the frozen selected definition is needed while the host is suspended.
  // Do not retain unrelated large workflows through every checkpoint.
  config = undefined;
  let activeRunId=options.resumeRunId;
  // An explicit resume acknowledges the old request; a new request still stops it.
  const acknowledged = activeRunId ? readStopRequest(runtimeDirectory,activeRunId) : undefined;
  const controller = new AbortController();
  const abort = ()=>controller.abort();
  options.signal?.addEventListener("abort",abort,{once:true});
  if (options.signal?.aborted) abort();
  let stopError:unknown;
  const checkStop=()=>{
    if (!activeRunId) return;
    try {const request=readStopRequest(runtimeDirectory,activeRunId);if(request && request!==acknowledged) abort();}
    catch(error) {stopError=error;abort();}
  };
  const timer=setInterval(checkStop,100);
  timer.unref?.();
  try {
  const result = await runCodeWorkflowHost({
    definition, runtimeDirectory, vaultBase:vault,
    resumeRunId:options.resumeRunId, reconcile:options.reconcile,
    maxSteps:options.maxSteps, signal:controller.signal, redact:options.redact,
    lease:options.lease || ownedLease,
    vaultMutations:options.vaultMutations,
    onTaskOutput:options.onTaskOutput,
    tasks:createWorkflowTaskAdapter(definition,vault,options.vaultMutations),
    evaluate:createWorkflowEvaluator(definition,vault,controller.signal),
    onCheckpoint:async checkpoint=>{
      activeRunId=checkpoint.runId;
      checkStop();
      const catalog = await persistWorkflowProgress({configurationFile,runtimeDirectory,checkpoint,expectedRunId:checkpoint.runId,replaceCompletedRunId,taskId:options.taskId,vaultBase:vault,writer:reader});
      await options.onCheckpoint?.(checkpoint,catalog);
    },
  });
  if(stopError) throw stopError;
  return result;
  } finally {clearInterval(timer);options.signal?.removeEventListener("abort",abort);}
  } finally {
    try { ownedLease?.release(); } finally { preparingInstallations.delete(runtimeDirectory); }
  }
}
