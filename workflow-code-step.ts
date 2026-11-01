import { readExecutionCheckpoint, type RunCheckpoint } from "./execution-journal";
import { projectWorkflowProgress, recoverWorkflowProgress, validateProgressBinding } from "./workflow-progress";

/** An isolated run retains the parent identity for admission, but never marks
 * the whole workflow complete or overwrites its last full-run checkpoint. */
export function selectCodeStep(workflow: any, stepId: string, historical = false): any {
  const matches = workflow.steps.filter((step: any) => step.id === stepId);
  if (matches.length !== 1 || !historical && matches[0].stepKind !== "code") throw new Error("Missing or ambiguous code step");
  const step = matches[0];
  return {
    id: workflow.id, name: `${workflow.name} · ${step.name || step.id}`,
    concurrency: workflow.concurrency, disabled: workflow.disabled,
    requiresAutoOCSecrets: workflow.requiresAutoOCSecrets,
    isolatedCodeStep: stepId,
    runtimeExecution: step.codeExecution?.runtimeExecution,
    steps: [{...step, transitions: [], transitionMode: undefined, evaluatePrompt: undefined, forceContinue: undefined}],
  };
}

export function projectCodeStepRun(workflow: any, stepId: string, tasks: any[], settings: any, checkpoint: RunCheckpoint, active = false, recover = false): any {
  const selected = selectCodeStep(workflow, stepId, recover);
  const projected = recover
    ? recoverWorkflowProgress(selected, tasks, settings, checkpoint, checkpoint.runId, active)
    : projectWorkflowProgress(selected, tasks, settings, checkpoint, checkpoint.runId, active);
  const observed = checkpoint.steps.filter(step => step.stepId === stepId).pop();
  if (checkpoint.steps.some(step => step.stepId !== stepId)) throw new Error("Isolated execution contains another step");
  return {...projected.steps[0], codeExecution: {
    runtimeExecution: projected.runtimeExecution,
    status: projected.status, output: observed?.output || "",
    lastRun: observed?.startedAt || checkpoint.createdAt,
  }};
}

export function codeStepDisplay(step: any): {status: string; output: string; lastRun?: string} {
  const solo = step.codeExecution;
  return solo && (!step.lastRun || solo.lastRun >= step.lastRun)
    ? {status: solo.status, output: solo.output || "", lastRun: solo.lastRun}
    : {status: step.status || "pending", output: step.output || "", lastRun: step.lastRun};
}

export function readCodeStepCheckpoint(runtime: string, workflow: any, stepId: string): RunCheckpoint | undefined {
  const selected = selectCodeStep(workflow, stepId), binding = selected.runtimeExecution;
  if (!binding) return undefined;
  const checkpoint = readExecutionCheckpoint(runtime, binding.runId);
  validateProgressBinding(selected, checkpoint, binding.runId);
  if (checkpoint.steps.some(step => step.stepId !== stepId)) throw new Error("Isolated execution contains another step");
  return checkpoint;
}
