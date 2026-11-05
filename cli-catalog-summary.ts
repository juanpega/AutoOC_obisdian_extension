import { taskDisabledReason, workflowDisabledReason } from './catalog-availability';
import { codeStepDisplay, selectCodeStep } from './workflow-code-step';

// Metadata only: never spread a catalog entry into public CLI output.
export function summarizeCliCatalog(config: any, includeStatus: boolean) {
  const status = (value: unknown) => ['idle', 'pending', 'running', 'completed', 'failed', 'cancelled', 'abandoned'].includes(value as string) ? value : 'unknown';
  const summarize = (item: any, reason?: string, recordedStatus = item?.status) => {
    if (!item || typeof item.id !== 'string' || typeof item.name !== 'string') throw new Error('Invalid catalog entry.');
    return {id: item.id, name: item.name, disabled: item.disabled === true,
      blockedByDisabled: !!reason, ...(reason ? {disabledReason: reason} : {}),
      ...(includeStatus ? {recordedStatus: status(recordedStatus)} : {})};
  };
  const tasks = config.tasks.map((task: any) => summarize(task, taskDisabledReason(task)));
  const workflows = config.workflows.map((workflow: any) => summarize(workflow, workflowDisabledReason(workflow, config.tasks, config.workflows)));
  const codeSteps = config.workflows.flatMap((workflow: any) => (workflow.steps || [])
    .filter((step: any) => step.stepKind === 'code').map((step: any) => ({
      ...summarize({id: step.id, name: step.name || step.id, disabled: step.disabled},
        workflowDisabledReason(selectCodeStep(workflow, step.id), config.tasks), codeStepDisplay(step).status),
      workflowId: workflow.id, workflowName: workflow.name,
    })));
  return {tasks, workflows, codeSteps};
}
