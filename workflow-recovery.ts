import { ExecutionJournal, type RunCheckpoint } from "./execution-journal";
import { prepareWorkflowDefinition, type PreparedWorkflow } from "./workflow-definition";
import { resolveWorkflowTransition } from "./workflow-routing";
import type { WorkflowSessionHost } from "./workflow-session";
import { workflowExecutionPlan, workflowStepContext, workflowPlanNext } from "./workflow-nesting";

// Only records an observed terminal result of the exact saved Codex turn.
// It does not launch, replay, or automatically advance the next step.
export async function reconcileWorkflowTask(journal: ExecutionJournal, definition: PreparedWorkflow,
  read: (threadId:string,turnId:string)=>Promise<{threadId:string;turnId:string;status:string;output:string}>,
  host: Pick<WorkflowSessionHost,"redact"|"evaluate"|"onTransitionError">): Promise<RunCheckpoint> {
  const state=journal.snapshot();
  const verified=prepareWorkflowDefinition(definition.workflow,definition.tasks as Array<{id:string}>,{...definition.settings,workflows:definition.workflows});
  const plan=workflowExecutionPlan(verified);
  if (verified.hash!==definition.hash || state.definitionHash!==verified.hash || state.workflowId!==verified.workflow.id) throw new Error("Recovery definition mismatch");
  if(state.phase!=="in_flight")return state;
  const step=state.steps[state.steps.length-1];
  if(!step.codexThreadId || !step.codexTurnId)throw new Error("Exact Codex identity is unavailable; manual reconciliation required");
  const result=await read(step.codexThreadId,step.codexTurnId);
  if(result.threadId!==step.codexThreadId || result.turnId!==step.codexTurnId)throw new Error("Recovery execution identity mismatch");
  if(!["completed","failed","interrupted"].includes(result.status))return state;
  if(typeof result.output!=="string")throw new Error("Recovery output is unavailable");
  const index=plan.steps.findIndex(item=>item.id===step.stepId);
  if(index<0)throw new Error("Recovery step is missing");
  const output=host.redact(result.output);
  if(typeof output!=="string")throw new Error("Invalid redacted recovery output");
  const {outputs,scope}=workflowStepContext(plan,step.stepId,state);
  outputs[scope.localId]=output;
  const succeeded=result.status==="completed";
  await journal.recordResult({succeeded,output,cancelled:result.status==="interrupted"});
  if(result.status==="interrupted") {
    await journal.finish(step.stepId,false,output,null);
    return journal.snapshot();
  }
  const transitions=plan.steps[index].transitions || [];
  // Reconciliation observes evidence; new model calls require explicit resume.
  if(transitions.some(t=>t.mode==="eval"))return journal.snapshot();
  const next=await resolveWorkflowTransition(plan.steps,index,output,succeeded,
    transitions,{...outputs},
    {evaluate:async()=>{throw new Error("Reconciliation cannot launch a model evaluation");},onError:host.onTransitionError.bind(host)});
  await journal.finish(step.stepId,succeeded,output,workflowPlanNext(plan,step.stepId,next.nextStepId));
  return journal.snapshot();
}
