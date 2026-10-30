import { catalogTransaction } from "./catalog-transaction";
import { executionCoordinator, type ExecutionAdmission } from "./execution-coordinator";
import { assertWorkflowDependencies } from "./retired-dependency";
import { samePhysicalPath } from "./path-identity";
import * as fs from "fs";
import { acquireExecutionLease, type ExecutionLease } from "./execution-lease";
import { ExecutionJournal, checkpointUncertainties, type RunCheckpoint } from "./execution-journal";
import { prepareWorkflowDefinition, type PreparedWorkflow } from "./workflow-definition";
import { findWorkflowEntry } from "./workflow-routing";
import { advanceWorkflowSession } from "./workflow-session";
import { executeCode } from "./code-runtime";
import { runWithVaultMutations, type VaultMutationBatchFactory } from "./code-vault-mutations";
import { workflowDelay, waitForWorkflowDelay } from "./workflow-delay";
import { workflowTaskPrompt } from "./workflow-handoff";
import { reconcileWorkflowTask } from "./workflow-recovery";
import type { WorkflowSessionHost } from "./workflow-session";
import type { CodexApprovalRequest } from "./codex-client";
import { prepareTaskBranch, verifyWorkflowBranch } from "./workflow-branch";
import { awaitWorkflowApproval } from "./workflow-approval";


// Transient display snapshot, never a durable result or a routing input.
export interface WorkflowTaskOutput {
  runId: string;
  workflowId: string;
  taskId: string;
  stepId: string;
  stepIndex: number;
  output: string;
}

export interface WorkflowTaskAdapter {
  supports(task: Readonly<Record<string, any>>): boolean;
  reconcile?(task: Readonly<Record<string, any>>,threadId:string,turnId:string):Promise<{threadId:string;turnId:string;status:string;output:string}>;
  execute(task: Readonly<Record<string, any>>, prompt: string, signal?: AbortSignal, recordThread?: (threadId:string,turnId?:string)=>Promise<void>, interaction?: {approve:(request:CodexApprovalRequest,signal?:AbortSignal)=>Promise<boolean>;onOutput?:(output:string)=>void}): Promise<{succeeded:boolean;output:string;cancelled?:boolean}>;
}

export function supportsSharedWorkflow(definition:PreparedWorkflow,tasks?:WorkflowTaskAdapter):boolean {
  assertWorkflowDependencies(definition.workflow, definition.tasks);
  return !definition.workflow.requiresAutoOCSecrets &&
    !definition.tasks.some(task=>task.requiresAutoOCSecrets) &&
    !definition.workflow.steps.some((step:any)=>!["code","delay","task"].includes(step.stepKind || "task")) &&
    definition.tasks.every(task=>!!tasks?.supports(task));
}

// First host adapter: Code/delay workflows, no Obsidian lifecycle or scheduling.
// Callers must authorize the vault/capabilities before entering this adapter.
// Unsupported task/model steps are rejected before creating a run.
export async function runCodeWorkflowHost(options: {
  definition: PreparedWorkflow;
  runtimeDirectory: string;
  vaultBase: string;
  signal?: AbortSignal;
  resumeRunId?: string;
  reconcile?: boolean;
  maxSteps?: number;
  tasks?: WorkflowTaskAdapter;
  evaluate?: WorkflowSessionHost["evaluate"];
  redact: (text: string) => string;
  onCheckpoint?: (checkpoint:RunCheckpoint) => Promise<void>;
  onTaskOutput?: (event:WorkflowTaskOutput) => void;
  lease?: ExecutionLease;
  admission?: ExecutionAdmission;
  vaultMutations?: VaultMutationBatchFactory;
}): Promise<RunCheckpoint> {
  assertWorkflowDependencies(options.definition.workflow, options.definition.tasks);
  const definition = prepareWorkflowDefinition(options.definition.workflow, options.definition.tasks as Array<{id:string}>, options.definition.settings);
  if (definition.hash !== options.definition.hash) throw new Error("Workflow definition changed");
  if (options.reconcile && !options.resumeRunId) throw new Error("Reconciliation requires an existing run identity");
  if (options.maxSteps !== undefined && (!Number.isSafeInteger(options.maxSteps) || options.maxSteps < 1)) throw new Error("Invalid execution step limit");
  const steps = definition.workflow.steps;
  if (definition.tasks.some(task => !options.tasks?.supports(task))) throw new Error("No adapter for referenced workflow task");
  if (!supportsSharedWorkflow(definition,options.tasks)) throw new Error("Unsupported step, task or model evaluation in this host");
  if(steps.some((step:any)=>step.transitionMode==="eval" || step.transitions?.some((t:any)=>t.mode==="eval")) && !options.evaluate) throw new Error("Model evaluation adapter is required");
  const entry = findWorkflowEntry(steps);
  if (!entry) throw new Error("Workflow has no entry step");
  const lease = options.lease || acquireExecutionLease(options.runtimeDirectory);
  const ownsLease = !options.lease;
  let ownedAdmission: ExecutionAdmission | undefined;
  let failed = false;
  let failure: unknown;
  // Protect every operation after acquisition, including admission preflight.
  try {
    lease.assertOwned();
    if (!samePhysicalPath(options.runtimeDirectory,lease.directory)) throw new Error("Execution lease belongs to another runtime");
    const admission=options.admission || executionCoordinator(lease).admit(definition,options.vaultBase,options.resumeRunId);
    if (!options.admission) ownedAdmission = admission;
    admission.assertOwned(lease,definition);
    if(!options.admission) {
      const publish=options.onCheckpoint;
      options={...options,onCheckpoint:async checkpoint=>{admission.bind(checkpoint);await publish?.(checkpoint);admission.confirm(checkpoint);}};
    }
    const resumed = options.resumeRunId === undefined ? undefined : ExecutionJournal.open(lease, options.resumeRunId, definition.hash);
    if (resumed?.snapshot().phase === "abandoned") throw new Error("Abandoned execution cannot be resumed; inspect its unknown outcome before starting new work");
    if (resumed && resumed.snapshot().workflowId !== definition.workflow.id) throw new Error("Execution belongs to another workflow");
    if(resumed)admission.bind(resumed.snapshot());
    // Reject changed branches before beginning a step or advancing a durable
    // result. A denied resume must leave its checkpoint recoverable unchanged.
    if (resumed && definition.workflow.handoffBranch && ["ready","in_flight"].includes(resumed.snapshot().phase)) {
      verifyWorkflowBranch(resumed,options.vaultBase);
    }
    if(resumed && ["completed","failed"].includes(resumed.snapshot().phase)) {
      // An already terminal resume performs no effect, but its confirmed
      // projection still resolves the provisional admission of this call.
      const state=resumed.snapshot();
      await options.onCheckpoint?.(state);
      return state;
    }
    if (resumed?.snapshot().phase === "in_flight" && !resumed.snapshot().steps.slice(-1)[0].result) {
      if (!options.reconcile || !options.tasks?.reconcile) throw new Error("Interrupted execution requires reconciliation; cannot replay effects");
      const step = steps.find(step => step.id === resumed.snapshot().nextStepId) as any;
      const task = definition.tasks.find(task => task.id === step?.taskId);
      if (!task) throw new Error("Interrupted step has no recoverable task");
      const result = await reconcileWorkflowTask(resumed,definition,(thread,turn)=>options.tasks!.reconcile!(task,thread,turn),{
        redact:options.redact,evaluate:options.evaluate || (async()=>{throw new Error("Model evaluation unavailable");}),onTransitionError:()=>{},
      });
      await options.onCheckpoint?.(JSON.parse(JSON.stringify(result)));
      return result;
    }
    if (options.reconcile && resumed) {
      await options.onCheckpoint?.(resumed.snapshot());
      return resumed.snapshot();
    }
    // A released OS lock does not prove an earlier run finished. Preserve and
    // surface unresolved checkpoints across the vault, not only this workflow.
    // Read-only reconciliation above may observe an existing result, but no
    // new effects may overlap any other unfinished execution.
    const journal=await catalogTransaction(lease.directory+"/journal-admission",async()=>{
    for (const file of fs.readdirSync(lease.directory)) {
      if (!/^[a-f0-9-]+\.json$/.test(file)) continue;
      if (fs.lstatSync(lease.directory + "/" + file).isSymbolicLink()) throw new Error("Execution checkpoint cannot be a link");
      const prior = JSON.parse(fs.readFileSync(lease.directory + "/" + file, "utf8"));
      ExecutionJournal.open(lease, file.slice(0, -5), prior.definitionHash);
      const resolved=prior.phase==='abandoned' || prior.disposition || ["completed","failed"].includes(prior.phase) && !checkpointUncertainties(prior).length;
      if (prior.runId !== options.resumeRunId && !admission.knows(prior.runId) && !resolved) {
        throw new Error(`Previous execution requires continuation or reconciliation (run ${prior.runId}, workflow ${prior.workflowId}, step ${prior.nextStepId}). No new task was started.`);
      }
    }
    const journal = resumed || await ExecutionJournal.create(lease, definition.workflow.id, definition.hash, entry.id);
    admission.bind(journal.snapshot());
    return journal;
    });
    return await advanceWorkflowSession(journal, definition, {
      async execute(step:any, input, outputs, signal) {
        admission.assertOwned(lease,definition);
        if(definition.workflow.handoffBranch)verifyWorkflowBranch(journal,options.vaultBase);
        if (!step.stepKind || step.stepKind === "task") {
          const task = definition.tasks.find(task => task.id === step.taskId);
          if (!task || !options.tasks) throw new Error("Workflow task adapter is unavailable");
          const stepIndex = journal.snapshot().steps.length - 1;
          await prepareTaskBranch(journal,task,task.workingDirectory || definition.settings.workingDirectory || options.vaultBase,options.vaultBase,!!definition.workflow.handoffBranch);
          const completed = journal.snapshot().steps.filter(item => item.status !== "in_flight");
          const previous = completed[completed.length - 1];
          const prompt = workflowTaskPrompt(task.prompt || "", definition.workflow,
            previous ? {stepId:previous.stepId,output:previous.output || ""} : undefined);
          let observing = true;
          try {
            return await options.tasks.execute(task, prompt, signal, async(threadId,turnId) => {
              await journal.recordCodexThread(step.id, threadId,turnId,stepIndex);
              await options.onCheckpoint?.(journal.snapshot());
            },{
              approve:(request,lifetime)=>awaitWorkflowApproval(journal,options.runtimeDirectory,request,options.redact,lifetime || signal,options.onCheckpoint),
              onOutput:options.onTaskOutput ? output=>{
                if (!observing || signal?.aborted) return;
                lease.assertOwned();
                const state = journal.snapshot();
                if (state.phase !== "in_flight" || state.steps.length - 1 !== stepIndex || state.steps[stepIndex].stepId !== step.id) return;
                options.onTaskOutput!({runId:state.runId,workflowId:state.workflowId,taskId:task.id,stepId:step.id,stepIndex,output:options.redact(output)});
              } : undefined,
            });
          } finally { observing = false; }
        }
        if (step.stepKind === "delay") {
          const spec = workflowDelay(step.delayValue, step.delayUnit);
          try { await waitForWorkflowDelay(spec.milliseconds, signal); }
          catch(error) {
            if (signal?.aborted && (error as Error).name === "AbortError") {
              return {succeeded:false,cancelled:true,output:"[delay cancelled; no external effects]"};
            }
            throw error;
          }
          return {succeeded:true, output:spec.output};
        }
        try {
          const output = await runWithVaultMutations(options.vaultMutations, onVaultMutation => executeCode({...step,code:step.code || "",vaultBase:options.vaultBase,cwd:definition.settings.workingDirectory || options.vaultBase,input,outputs,onVaultMutation}));
          return {succeeded:true,output};
        } catch (error) { return {succeeded:false,output:`[code error: ${String(error)}]`}; }
      },
      evaluate:options.evaluate || (async()=>{throw new Error("Model evaluation is not supported by this host");}),
      redact:options.redact,
      onTransitionError:()=>{},
      onCheckpoint:options.onCheckpoint,
    }, {signal:options.signal, maxSteps:options.maxSteps});
  } catch (error) {
    failed = true;
    failure = error;
    throw error;
  } finally {
    const cleanupErrors: unknown[] = [];
    try { ownedAdmission?.finish(); } catch (error) { cleanupErrors.push(error); }
    // Admission cleanup must never prevent the identity-checked release.
    try { if (ownsLease) lease.release(); } catch (error) { cleanupErrors.push(error); }
    if (cleanupErrors.length) {
      const errors = failed ? [failure, ...cleanupErrors] : cleanupErrors;
      throw Object.assign(new Error(`Workflow resource cleanup failed: ${errors.map(String).join('; ')}`), {
        cause: failed ? failure : cleanupErrors[0], errors,
      });
    }
  }
}
