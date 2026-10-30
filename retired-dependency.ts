// Compatibility metadata is retained even though the integrated store is gone.
// Check the entire reachable definition before any task, Code or Git effects.
export function autoOCDependencyError(item: { id?: string; requiresAutoOCSecrets?: unknown }): string | undefined {
  if (item.requiresAutoOCSecrets === undefined || item.requiresAutoOCSecrets === false) return;
  const identity = typeof item.id === "string" ? item.id : "definition";
  return typeof item.requiresAutoOCSecrets !== "boolean"
    ? `Invalid AutoOC secrets dependency declaration (${identity}); requiresAutoOCSecrets must be boolean`
    : `AutoOC Secrets was retired (${identity}); adapt this definition before execution`;
}

export function assertNoRetiredDependency(item: { id?: string; requiresAutoOCSecrets?: unknown }): void {
  const error = autoOCDependencyError(item);
  if (error) throw new Error(error);
}

export function assertWorkflowDependencies(workflow: { id?: string; requiresAutoOCSecrets?: unknown; steps?: any[] }, tasks: any[]): void {
  assertNoRetiredDependency(workflow);
  for (const step of workflow.steps || []) {
    assertNoRetiredDependency(step);
    if (step.stepKind === "task" || !step.stepKind && step.taskId) {
      const task = tasks.find(item => item.id === step.taskId);
      if (task) assertNoRetiredDependency(task);
    }
  }
}
