import { SettingsWriter } from "./settings-writer";
import { readExecutionCheckpoint, type RunCheckpoint } from "./execution-journal";
import { projectWorkflowProgress } from "./workflow-progress";
import { standaloneTaskWorkflow } from "./standalone-task";

// Called by the owning host after journal persistence, before advancing.
// Read the current catalog on every boundary so unrelated edits are retained;
// the writer rejects a concurrent change between that read and replacement.
export async function persistWorkflowProgress(options: {
  configurationFile: string;
  runtimeDirectory: string;
  checkpoint: RunCheckpoint;
  expectedRunId: string;
  replaceCompletedRunId?: string;
  taskId?: string;
}): Promise<void> {
  const durable = readExecutionCheckpoint(options.runtimeDirectory, options.expectedRunId);
  if (JSON.stringify(durable) !== JSON.stringify(options.checkpoint)) {
    throw new Error("Catalog progress does not match the durable checkpoint");
  }
  const writer = new SettingsWriter();
  const config: any = writer.load(options.configurationFile);
  if (!config || !Array.isArray(config.tasks) || !Array.isArray(config.workflows)) {
    throw new Error("Invalid AutoOC catalog");
  }
  const virtual = options.taskId ? standaloneTaskWorkflow(options.taskId) : undefined;
  if (virtual && (virtual.id !== durable.workflowId || config.workflows.some((workflow:any)=>workflow.id === virtual.id))) throw new Error("Standalone task identity mismatch");
  if (virtual && config.tasks.filter((task:any)=>task.id === options.taskId).length !== 1) throw new Error("Missing or ambiguous task in catalog");
  const matches = virtual ? [virtual] : config.workflows.filter((workflow:any) => workflow.id === durable.workflowId);
  if (matches.length !== 1) throw new Error("Missing or ambiguous workflow in catalog");
  // Persist only observed progress, never an assertion of ongoing activity.
  let workflow = matches[0];
  if (options.replaceCompletedRunId && workflow.runtimeExecution?.runId === options.replaceCompletedRunId && durable.runId !== options.replaceCompletedRunId) {
    const previous = readExecutionCheckpoint(options.runtimeDirectory,options.replaceCompletedRunId);
    if (previous.workflowId !== durable.workflowId || !["completed","failed"].includes(previous.phase)) {
      throw new Error("Cannot replace an unfinished execution");
    }
    workflow = {...workflow};
    delete workflow.runtimeExecution;
  }
  const projected = projectWorkflowProgress(workflow, config.tasks, config, durable, options.expectedRunId);
  const observedTasks = new Map<string,{stepId:string;observed:RunCheckpoint["steps"][number]}>();
  for (const observed of durable.steps) {
    const step = workflow.steps.find((item:any)=>item.id === observed.stepId);
    if (step?.taskId && (!step.stepKind || step.stepKind === "task")) {
      observedTasks.set(step.taskId,{stepId:step.id,observed});
    }
  }
  const tasks = config.tasks.map((task:any)=>{
    const item = observedTasks.get(task.id);
    if (!item) return task;
    const previous = task.runtimeExecution;
    if (previous?.runId === durable.runId && previous.revision > durable.revision) throw new Error("Stale task progress");
    if (previous && previous.runId !== durable.runId) {
      // Reopening an old terminal journal must not overwrite a later task run.
      if (item.observed.status !== "in_flight") return task;
      const prior = readExecutionCheckpoint(options.runtimeDirectory,previous.runId);
      if (!["completed","failed"].includes(prior.phase)) throw new Error("Task belongs to an unfinished execution");
    }
    return {...task,status:item.observed.status === "in_flight" ? "pending" : item.observed.status,
      ...(item.observed.startedAt ? {lastRun:item.observed.startedAt} : {}),
      output:item.observed.output || "",
      ...(item.observed.codexThreadId ? {lastCodexThreadId:item.observed.codexThreadId} : {}),
      ...(item.observed.codexTurnId ? {lastCodexTurnId:item.observed.codexTurnId} : {}),
      pendingCodexApproval:item.observed.approval ? {...item.observed.approval,requestId:item.observed.approval.token} : undefined,
      runtimeExecution:{runId:durable.runId,workflowId:durable.workflowId,stepId:item.stepId,revision:durable.revision,
        requiresReconciliation:item.observed.status === "in_flight"}};
  });
  const next = {...config, tasks, workflows:virtual ? config.workflows : config.workflows.map((workflow:any) => workflow === matches[0] ? projected : workflow)};
  await writer.save(options.configurationFile, () => next);
}
