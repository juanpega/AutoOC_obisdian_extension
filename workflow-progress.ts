import { validateExecutionCheckpoint, type RunCheckpoint } from "./execution-journal";
import { prepareWorkflowDefinition } from "./workflow-definition";

// Pure projection: preserve definitions and never infer a live process from a
// durable in-flight marker. Only an owning host can pass activelyExecuting.
export function projectWorkflowProgress(workflow:any,tasks:any[],settings:Record<string,any>,checkpoint:RunCheckpoint,expectedRunId:string,activelyExecuting=false) {
  validateExecutionCheckpoint(checkpoint);
  const definition = prepareWorkflowDefinition(workflow,tasks,settings);
  if (checkpoint.runId !== expectedRunId || checkpoint.workflowId !== workflow.id || checkpoint.definitionHash !== definition.hash) throw new Error("Progress identity or definition mismatch");
  const previous = workflow.runtimeExecution;
  if (previous && (previous.runId !== checkpoint.runId || previous.revision > checkpoint.revision)) throw new Error("Stale progress cannot replace current execution");
  const last = new Map(checkpoint.steps.map(step=>[step.stepId,step]));
  if (checkpoint.steps.some(step=>!workflow.steps.some((known:any)=>known.id===step.stepId))) throw new Error("Progress contains an unknown step");
  if (checkpoint.nextStepId && !workflow.steps.some((known:any)=>known.id===checkpoint.nextStepId)) throw new Error("Progress next step is absent");
  const target = checkpoint.nextStepId || checkpoint.steps[checkpoint.steps.length-1]?.stepId;
  return {...workflow,
    ...(checkpoint.createdAt ? {lastRun:checkpoint.createdAt} : {}),
    status:checkpoint.phase==='completed'?'completed':checkpoint.phase==='failed'?'failed':activelyExecuting?'running':'pending',
    currentStep:Math.max(0,workflow.steps.findIndex((step:any)=>step.id===target)),
    runtimeExecution:{runId:checkpoint.runId,revision:checkpoint.revision,phase:checkpoint.phase,requiresReconciliation:checkpoint.phase==='in_flight'&&!activelyExecuting},
    steps:workflow.steps.map((step:any)=>{
      const observed = last.get(step.id);
      return {...step,...(observed?.startedAt ? {lastRun:observed.startedAt} : {}),status:observed?.status==='in_flight'?(activelyExecuting?'running':'pending'):observed?.status || 'pending',output:observed?.output || ''};
    }),
  };
}
