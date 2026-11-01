// Presentation travels beside checkpoints; it is never journaled or hashed.
export interface ExecutionPresentation {
  workflowName?: string;
  executionKind: "workflow" | "task";
  stepId?: string;
}

export function executionPresentation(workflow: {id:string; name?:unknown; isolatedCodeStep?:unknown}, taskId?:string): ExecutionPresentation {
  if (workflow.name !== undefined && typeof workflow.name !== "string" || (taskId !== undefined && workflow.id !== `@task:${taskId}`)) {
    throw new Error("Invalid execution presentation identity");
  }
  const presentation: ExecutionPresentation = {...(typeof workflow.name === "string" ? {workflowName:workflow.name} : {}), executionKind:taskId === undefined ? "workflow" : "task",
    ...(workflow.isolatedCodeStep !== undefined ? {stepId: workflow.isolatedCodeStep as string} : {})};
  presentationFields(presentation);
  return presentation;
}

// Old hosts omit both fields; legacy nameless definitions omit the name. Copy only
// these fields even when the input contains a complete private checkpoint.
export function presentationFields(value: Partial<ExecutionPresentation>): Partial<ExecutionPresentation> {
  if (value.workflowName === undefined && value.executionKind === undefined && value.stepId === undefined) return {};
  if (value.workflowName !== undefined && typeof value.workflowName !== "string" || !["workflow", "task"].includes(value.executionKind!)) {
    throw new Error("Invalid execution presentation metadata");
  }
  if (value.stepId !== undefined && (value.executionKind !== 'workflow' || typeof value.stepId !== 'string' || !value.stepId || value.stepId.length > 256 || /[\0\r\n]/.test(value.stepId))) throw new Error('Invalid code step presentation identity');
  return {...(value.workflowName !== undefined ? {workflowName:value.workflowName} : {}), executionKind:value.executionKind,
    ...(value.stepId !== undefined ? {stepId:value.stepId} : {})};
}
