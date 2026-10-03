import type { PreparedWorkflow } from "./workflow-definition";
import type { WorkflowSessionHost } from "./workflow-session";
import { createOpenCodeWorkflowAdapter } from "./cli-workflow-adapters";

export function createWorkflowEvaluator(definition:PreparedWorkflow,vault:string,signal?:AbortSignal):WorkflowSessionHost["evaluate"] {
  const adapter=createOpenCodeWorkflowAdapter(definition,vault);
  return async(transition,_target,input)=>{
    const instruction=transition.evaluatePrompt?.trim() || "Did the previous step complete successfully? If it is safe to continue, reply YES. Otherwise reply NO.";
    const result=await adapter.execute({taskKind:"opencode",model:definition.settings.defaultModel || "opencode/default",
      agent:definition.settings.defaultAgent,workingDirectory:definition.settings.workingDirectory || vault},
      `${instruction}\n\nPrevious step output:\n---\n${input}\n---\n\nReply ONLY with YES or NO.`,signal);
    if(!result.succeeded)throw new Error("Transition model evaluation failed; execution requires reconciliation");
    return result.output;
  };
}
