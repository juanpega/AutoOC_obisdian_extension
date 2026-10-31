/** Availability is independent from execution status and historical results. */
export interface Activatable { id?: string; name?: string; disabled?: boolean; }

export function taskDisabledReason(task: Activatable | undefined): string | undefined {
  return task?.disabled === true ? `Task "${task.name || task.id}" is disabled. Enable it before running.` : undefined;
}

export function workflowDisabledReason(workflow: Activatable & { steps?: Array<Activatable & { stepKind?: string; taskId?: string }> }, tasks: Activatable[]): string | undefined {
  if (workflow.disabled === true) return `Workflow "${workflow.name || workflow.id}" is disabled. Enable it before running.`;
  for (const step of workflow.steps || []) {
    if (step.disabled === true) return `Step "${step.name || step.id}" is disabled. Enable it before running.`;
    if (step.stepKind && step.stepKind !== "task") continue;
    const reason = taskDisabledReason(tasks.find(task => task.id === step.taskId));
    if (reason) return reason;
  }
  return undefined;
}

export function assertWorkflowEnabled(workflow: Parameters<typeof workflowDisabledReason>[0], tasks: Activatable[]): void {
  const reason = workflowDisabledReason(workflow, tasks);
  if (reason) throw new Error(reason);
}

export function validateDisabled(item: Activatable): void {
  if (item.disabled !== undefined && typeof item.disabled !== "boolean") throw new Error("Disabled must be a boolean.");
}
