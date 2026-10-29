// Presentation travels beside checkpoints; it is never journaled or hashed.
export interface ExecutionPresentation {
  workflowName?: string;
  executionKind: "workflow" | "task";
}

export function executionPresentation(workflow: {id:string; name?:unknown}, taskId?:string): ExecutionPresentation {
  if (workflow.name !== undefined && typeof workflow.name !== "string" || (taskId !== undefined && workflow.id !== `@task:${taskId}`)) {
    throw new Error("Invalid execution presentation identity");
  }
  return {...(typeof workflow.name === "string" ? {workflowName:workflow.name} : {}), executionKind:taskId === undefined ? "workflow" : "task"};
}

// Old hosts omit both fields; legacy nameless definitions omit the name. Copy only
// these two fields even when the input contains a complete private checkpoint.
export function presentationFields(value: Partial<ExecutionPresentation>): Partial<ExecutionPresentation> {
  if (value.workflowName === undefined && value.executionKind === undefined) return {};
  if (value.workflowName !== undefined && typeof value.workflowName !== "string" || !["workflow", "task"].includes(value.executionKind!)) {
    throw new Error("Invalid execution presentation metadata");
  }
  return {...(value.workflowName !== undefined ? {workflowName:value.workflowName} : {}), executionKind:value.executionKind};
}
