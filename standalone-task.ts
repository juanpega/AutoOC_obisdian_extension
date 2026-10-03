import { projectWorkflowProgress } from "./workflow-progress";
import type { RunCheckpoint } from "./execution-journal";

// A single task uses the same coordinator, journal and progress projection as
// a workflow. This definition is virtual: never insert it into the catalog.
export function standaloneTaskWorkflow(taskId:string) {
  if (!taskId) throw new Error("Explicit task identity required");
  return {id:`@task:${taskId}`,name:"Standalone task",steps:[{id:"task",stepKind:"task",taskId}]};
}

export function projectStandaloneTask(task:any,tasks:any[],settings:Record<string,any>,checkpoint:RunCheckpoint) {
  const workflow={...standaloneTaskWorkflow(task.id),runtimeExecution:task.runtimeExecution};
  const projected=projectWorkflowProgress(workflow,tasks,settings,checkpoint,task.runtimeExecution.runId);
  const observed=checkpoint.steps[checkpoint.steps.length-1];
  return {...task,status:projected.status,output:observed?.output || '',
    ...(observed?.startedAt ? {lastRun:observed.startedAt} : {}),
    ...(observed?.codexThreadId ? {lastCodexThreadId:observed.codexThreadId} : {}),
    ...(observed?.codexTurnId ? {lastCodexTurnId:observed.codexTurnId} : {}),
    runtimeExecution:{...projected.runtimeExecution,workflowId:workflow.id,stepId:'task',finishedAt:observed?.finishedAt}};
}
