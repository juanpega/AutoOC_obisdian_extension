interface LabelStep {
  stepKind?: string;
  name?: string;
  taskId?: string;
  workflowId?: string;
  delayValue?: number;
  delayUnit?: string;
}
interface NamedItem { id: string; name?: string; }

/** Names are presentation only. Never infer or rewrite a reference from an alias. */
export function workflowStepDisplayName(step: LabelStep, tasks: readonly NamedItem[], workflows: readonly NamedItem[]): string {
  const alias = step.name?.trim();
  if (step.stepKind === "code") return alias || "{ } Code";
  if (step.stepKind === "delay") return alias || `⏱ ${step.delayValue ?? 5} ${step.delayUnit ?? "minutes"}`;
  const child = step.stepKind === "workflow";
  const name = child ? workflows.find(item => item.id === step.workflowId)?.name : tasks.find(item => item.id === step.taskId)?.name;
  const current = name || (child ? "Missing workflow" : "(deleted task)");
  if (alias && alias !== name?.trim()) return `${alias} · ${child ? "Workflow" : "Task"}: ${current}`;
  return child ? `Workflow: ${current}` : current;
}

type LabelChange = { taskId: string } | { workflowId: string };
const bindings = new WeakMap<HTMLElement, { steps: readonly LabelStep[]; update: () => void }>();

/** Weak bindings follow the DOM lifetime; refreshing labels never rebuilds inputs. */
export function bindWorkflowLabel(element: HTMLElement, steps: readonly LabelStep[], update: () => void): void {
  element.setAttribute("data-auto-oc-workflow-label", "");
  bindings.set(element, { steps, update });
  update();
}

export function refreshWorkflowLabels(root: HTMLElement, change?: LabelChange): void {
  root.querySelectorAll<HTMLElement>("[data-auto-oc-workflow-label]").forEach(element => {
    const binding = bindings.get(element);
    if (!binding) return;
    if (!change || binding.steps.some(step => "taskId" in change
      ? (step.stepKind || "task") === "task" && step.taskId === change.taskId
      : step.stepKind === "workflow" && step.workflowId === change.workflowId)) binding.update();
  });
}
