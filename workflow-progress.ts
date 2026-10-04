import { validateExecutionCheckpoint, type RunCheckpoint } from "./execution-journal";
import { prepareWorkflowDefinition } from "./workflow-definition";

// The catalog binding identifies the historical run independently of the
// editable definition. Check it before deciding how to project that run.
export function validateProgressBinding(workflow:any,checkpoint:RunCheckpoint,expectedRunId:string) {
  validateExecutionCheckpoint(checkpoint);
  if (checkpoint.runId !== expectedRunId || checkpoint.workflowId !== workflow.id) throw new Error("Progress identity or definition mismatch");
  const previous = workflow.runtimeExecution;
  if (previous && (previous.runId !== checkpoint.runId || !Number.isSafeInteger(previous.revision) || previous.revision < 0 || previous.revision > checkpoint.revision)) throw new Error("Stale progress cannot replace current execution");
  if (previous && (previous.workflowId !== undefined && previous.workflowId !== checkpoint.workflowId || previous.definitionHash !== undefined && previous.definitionHash !== checkpoint.definitionHash)) throw new Error("Progress binding identity mismatch");
}

// Read-only catalog recovery is the only place where a terminal journal may
// differ from today's definition. An unfinished run always takes the strict path.
export function recoverWorkflowProgress(workflow:any,tasks:any[],settings:Record<string,any>,checkpoint:RunCheckpoint,expectedRunId:string,activelyExecuting=false) {
  validateProgressBinding(workflow,checkpoint,expectedRunId);
  if (!["completed","failed"].includes(checkpoint.phase)) return projectWorkflowProgress(workflow,tasks,settings,checkpoint,expectedRunId,activelyExecuting);
  let currentHash:string|undefined;
  // An edited terminal definition can be incomplete. Only definition preparation
  // is optional here; checkpoint and binding errors above are never suppressed.
  try { currentHash = prepareWorkflowDefinition(workflow,tasks,settings).hash; } catch { /* Validate on the next explicit execution. */ }
  if (currentHash === checkpoint.definitionHash) return projectWorkflowProgress(workflow,tasks,settings,checkpoint,expectedRunId);
  return {...workflow,
    ...(checkpoint.createdAt ? {lastRun:checkpoint.createdAt} : {}),
    status:checkpoint.phase,currentStep:0,
    runtimeExecution:{runId:checkpoint.runId,workflowId:checkpoint.workflowId,definitionHash:checkpoint.definitionHash,
      revision:checkpoint.revision,phase:checkpoint.phase,requiresReconciliation:false,definitionChanged:true,
      historicalSteps:JSON.parse(JSON.stringify(checkpoint.steps))},
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
  const last = new Map(checkpoint.steps.map(step=>[step.stepId,step]));
  if (checkpoint.steps.some(step=>!workflow.steps.some((known:any)=>known.id===step.stepId))) throw new Error("Progress contains an unknown step");
  if (checkpoint.nextStepId && !workflow.steps.some((known:any)=>known.id===checkpoint.nextStepId)) throw new Error("Progress next step is absent");
  const target = checkpoint.nextStepId || checkpoint.steps[checkpoint.steps.length-1]?.stepId;
  return {...workflow,
    ...(checkpoint.createdAt ? {lastRun:checkpoint.createdAt} : {}),
    status:checkpoint.phase==='completed'?'completed':checkpoint.phase==='failed'?'failed':activelyExecuting?'running':'pending',
    currentStep:Math.max(0,workflow.steps.findIndex((step:any)=>step.id===target)),
    runtimeExecution:{runId:checkpoint.runId,definitionHash:checkpoint.definitionHash,revision:checkpoint.revision,phase:checkpoint.phase,requiresReconciliation:checkpoint.phase==='in_flight'&&!activelyExecuting},
    steps:workflow.steps.map((step:any)=>{
      const observed = last.get(step.id);
      return {...step,...(observed?.startedAt ? {lastRun:observed.startedAt} : {}),status:observed?.status==='in_flight'?(activelyExecuting?'running':'pending'):observed?.status || 'pending',output:observed?.output || ''};
    }),
  };
}
