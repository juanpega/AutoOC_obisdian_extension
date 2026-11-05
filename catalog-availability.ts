/** Availability is independent from execution status and historical results. */
import { workflowClosure, type NestedWorkflow } from "./workflow-nesting";
export interface Activatable { id?: string; name?: string; disabled?: boolean; }

export function taskDisabledReason(task: Activatable | undefined): string | undefined {
  return task?.disabled === true ? `Task "${task.name || task.id}" is disabled. Enable it before running.` : undefined;
}

export function workflowDisabledReason(workflow: Activatable & { steps?: Array<Activatable & { stepKind?: string; taskId?: string }> }, tasks: Activatable[], workflows: NestedWorkflow[] = []): string | undefined {
  if (workflow.steps?.some(step=>step.stepKind === "workflow")) {
    try {
      for (const child of workflowClosure(workflow as NestedWorkflow,workflows)) {
        const reason=workflowDisabledReason({...child,steps:child.steps.filter(step=>step.stepKind!=="workflow")},tasks);
        if(reason)return reason;
      }
    } catch { /* Invalid references are diagnosed by definition validation, not as disabled items. */ }
  }
  if (workflow.disabled === true) return `Workflow "${workflow.name || workflow.id}" is disabled. Enable it before running.`;
  for (const step of workflow.steps || []) {
    if (step.disabled === true) return `Step "${step.name || step.id}" is disabled. Enable it before running.`;
    if (step.stepKind && step.stepKind !== "task") continue;
    const reason = taskDisabledReason(tasks.find(task => task.id === step.taskId));
    if (reason) return reason;
  }
  return undefined;
}

export function assertWorkflowEnabled(workflow: Parameters<typeof workflowDisabledReason>[0], tasks: Activatable[], workflows: NestedWorkflow[] = []): void {
  const reason = workflowDisabledReason(workflow, tasks, workflows);
  if (reason) throw Object.assign(new Error(reason), {name: 'DisabledExecutionError'});
}

export function validateDisabled(item: Activatable): void {
  if (item.disabled !== undefined && typeof item.disabled !== "boolean") throw new Error("Disabled must be a boolean.");
}
