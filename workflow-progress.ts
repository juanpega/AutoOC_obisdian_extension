import { validateExecutionCheckpoint, checkpointUncertainties, type RunCheckpoint } from "./execution-journal";
import { prepareWorkflowDefinition, prepareWorkflowDefinitionAsync } from "./workflow-definition";
import { cloneJsonStructure } from "./cooperative-json";
import { workflowExecutionPlan, workflowClosure } from "./workflow-nesting";

// The catalog binding identifies the historical run independently of the
// editable definition. Check it before deciding how to project that run.
export function validateProgressBinding(workflow:any,checkpoint:RunCheckpoint,expectedRunId:string) {
  validateExecutionCheckpoint(checkpoint);
  if (checkpoint.runId !== expectedRunId || checkpoint.workflowId !== workflow.id) throw new Error("Progress identity or definition mismatch");
  const previous = workflow.runtimeExecution;
  if (previous && (previous.runId !== checkpoint.runId || !Number.isSafeInteger(previous.revision) || previous.revision < 0 || previous.revision > checkpoint.revision)) throw new Error("Stale progress cannot replace current execution");
  if (previous && (previous.workflowId !== undefined && previous.workflowId !== checkpoint.workflowId || previous.definitionHash !== undefined && previous.definitionHash !== checkpoint.definitionHash)) throw new Error("Progress binding identity mismatch");
}

// Read-only recovery keeps edited definitions visible without resuming old work.
// Execution and progress publication still require the original definition.
export function recoverWorkflowProgress(workflow:any,tasks:any[],settings:Record<string,any>,checkpoint:RunCheckpoint,expectedRunId:string,activelyExecuting=false) {
  validateProgressBinding(workflow,checkpoint,expectedRunId);
  const terminal = ["completed","failed","abandoned"].includes(checkpoint.phase);
  if (activelyExecuting) return projectWorkflowProgress(workflow,tasks,settings,checkpoint,expectedRunId,true);
  let currentHash:string|undefined;
  // An edited terminal definition can be incomplete. Only definition preparation
  // is optional here; checkpoint and binding errors above are never suppressed.
  try { currentHash = prepareWorkflowDefinition(workflow,tasks,settings).hash; } catch { /* Validate on the next explicit execution. */ }
  return recoverPreparedProgress(workflow,checkpoint,currentHash,false,settings.workflows);
}

export async function recoverWorkflowProgressAsync(workflow:any,tasks:any[],settings:Record<string,any>,checkpoint:RunCheckpoint,expectedRunId:string,activelyExecuting=false) {
  // Neither a caller mutation nor later projection can alter this operation's
  // entry snapshot. Never catch identity, checkpoint or publication errors.
  workflow=cloneJsonStructure(workflow);checkpoint=cloneJsonStructure(checkpoint);
  validateProgressBinding(workflow,checkpoint,expectedRunId);
  let currentHash:string|undefined;
  try { currentHash=(await prepareWorkflowDefinitionAsync(workflow,tasks,settings)).hash; }
  catch (error) { if(activelyExecuting)throw error; }
  if(activelyExecuting && currentHash!==checkpoint.definitionHash)throw new Error("Progress identity or definition mismatch");
  return recoverPreparedProgress(workflow,checkpoint,currentHash,activelyExecuting,settings.workflows);
}

function recoverPreparedProgress(workflow:any,checkpoint:RunCheckpoint,currentHash:string|undefined,activelyExecuting=false,workflows:any[] = []) {
  const terminal=["completed","failed","abandoned"].includes(checkpoint.phase);
  if (currentHash === checkpoint.definitionHash) return projectPreparedProgress(workflow,checkpoint,activelyExecuting,workflows);
  return {...workflow,
    ...(checkpoint.createdAt ? {lastRun:checkpoint.createdAt} : {}),
    status:terminal ? checkpoint.phase : 'pending',currentStep:0,
    runtimeExecution:{runId:checkpoint.runId,workflowId:checkpoint.workflowId,definitionHash:checkpoint.definitionHash,
      revision:checkpoint.revision,phase:checkpoint.phase,abandonment:checkpoint.abandonment,disposition:checkpoint.disposition,terminalUncertainty:checkpointUncertainties(checkpoint).length>0,requiresReconciliation:!terminal,definitionChanged:true,
      historicalSteps:cloneJsonStructure(checkpoint.steps)},
    // A hash alone cannot prove that a reused step ID still means the same task.
    steps:workflow.steps.map((step:any)=>{const {lastRun,output,status,...definition}=step;return {...definition,status:'pending',output:''};}),
  };
}

// Pure projection: preserve definitions and never infer a live process from a
// durable in-flight marker. Only an owning host can pass activelyExecuting.
export function projectWorkflowProgress(workflow:any,tasks:any[],settings:Record<string,any>,checkpoint:RunCheckpoint,expectedRunId:string,activelyExecuting=false) {
  validateProgressBinding(workflow,checkpoint,expectedRunId);
  const definition = prepareWorkflowDefinition(workflow,tasks,settings);
  if (checkpoint.definitionHash !== definition.hash) throw new Error("Progress identity or definition mismatch");
  return projectPreparedProgress(workflow,checkpoint,activelyExecuting,definition.workflows);
}

function projectPreparedProgress(workflow:any,checkpoint:RunCheckpoint,activelyExecuting=false,workflows:any[] = []) {
  const plan=workflowExecutionPlan({workflow,workflows:workflowClosure(workflow,workflows)});
  const last = new Map<string,RunCheckpoint["steps"][number]>();
  for(const step of checkpoint.steps) {
    const scope=plan.scopes.get(step.stepId);
    if(!scope)throw new Error("Progress contains an unknown step");
    const internal=scope.path.length>0 || scope.boundary === "enter";
    last.set(scope.rootStepId,internal ? {...step,status:checkpoint.phase === "failed" ? "failed" : "in_flight",output:checkpoint.phase === "failed" ? step.output : ""} : step);
  }
  if (checkpoint.nextStepId && !plan.scopes.has(checkpoint.nextStepId)) throw new Error("Progress next step is absent");
  const targetId = checkpoint.nextStepId || checkpoint.steps[checkpoint.steps.length-1]?.stepId;
  const target = plan.scopes.get(targetId!)?.rootStepId;
  return {...workflow,
    ...(checkpoint.createdAt ? {lastRun:checkpoint.createdAt} : {}),
    status:checkpoint.phase==='abandoned'?'abandoned':checkpoint.phase==='completed'?'completed':checkpoint.phase==='failed'?'failed':activelyExecuting?'running':'pending',
    currentStep:Math.max(0,workflow.steps.findIndex((step:any)=>step.id===target)),
    runtimeExecution:{runId:checkpoint.runId,definitionHash:checkpoint.definitionHash,revision:checkpoint.revision,phase:checkpoint.phase,abandonment:checkpoint.abandonment,disposition:checkpoint.disposition,terminalUncertainty:checkpointUncertainties(checkpoint).length>0,requiresReconciliation:checkpoint.phase==='in_flight'&&!activelyExecuting},
    steps:workflow.steps.map((step:any)=>{
      const observed = last.get(step.id);
      return {...step,...(observed?.startedAt ? {lastRun:observed.startedAt} : {}),status:observed?.status==='in_flight'?(checkpoint.phase==='abandoned'?'abandoned':activelyExecuting?'running':'pending'):observed?.status || 'pending',output:observed?.output || ''};
    }),
  };
}
