import {createHash} from "crypto";
import {workflowEditSizeError} from "./workflow-edit";

export interface TaskEditCommand {
  command:"edit-task";
  taskId:string;
  expectedHash:string;
  changes:{name?:string;prompt?:string};
  workflowId?:never;
  runId?:never;
}
export interface TaskEditResult {taskId:string;definitionHash:string;}
export function validTaskEdit(value:any):value is TaskEditCommand {
  if(!value || value.command!=="edit-task" || typeof value.taskId!=="string" || !value.taskId.length || value.taskId.length>256 || /[\0\r\n]/.test(value.taskId) ||
    typeof value.expectedHash!=="string" || !/^[a-f0-9]{64}$/.test(value.expectedHash) ||
    ["workflowId","runId","stepId","pageId"].some(key=>value[key]!==undefined))return false;
  const c=value.changes;
  return !!c && typeof c==="object" && !Array.isArray(c) && Object.keys(c).length>0 &&
    Object.keys(c).every(key=>["name","prompt"].includes(key) && typeof c[key]==="string") &&
    (c.name===undefined || !!c.name.trim()) && !workflowEditSizeError(value);
}
// Editable text only: no credentials, history, permissions or execution settings.
export function taskEditDefinition(task:any):any {return {id:task.id,name:task.name,prompt:task.prompt};}
export function taskEditHash(task:any):string {return createHash("sha256").update(JSON.stringify(taskEditDefinition(task))).digest("hex");}
export async function applyTaskEdit(host:{settings:any;assertIdle:()=>void;save:(validate:()=>void)=>Promise<void>},command:TaskEditCommand):Promise<TaskEditResult> {
  const sizeError=workflowEditSizeError(command);if(sizeError)throw new Error(sizeError);
  if(!validTaskEdit(command))throw new Error("Invalid task edit; only name and prompt are supported");
  host.assertIdle();
  const matches=host.settings.tasks.filter((task:any)=>task.id===command.taskId);
  if(matches.length!==1)throw new Error("Task identity is missing or ambiguous");
  const task=matches[0];
  if(taskEditHash(task)!==command.expectedHash)throw new Error("Task edit conflict; export the current definition before editing again");
  const edits=Object.entries(command.changes).map(([key,after])=>({key,after,before:task[key],had:Object.prototype.hasOwnProperty.call(task,key)}));
  for(const edit of edits)task[edit.key]=edit.after;
  const expected=taskEditHash(task);
  const validate=()=>{
    host.assertIdle();
    if(!host.settings.tasks.includes(task) || taskEditHash(task)!==expected)throw new Error("Task edit conflict during save; local changes preserved");
  };
  try {await host.save(validate);}
  catch(error){for(const edit of edits)if(task[edit.key]===edit.after){if(edit.had)task[edit.key]=edit.before;else delete task[edit.key];}throw error;}
  validate();
  return {taskId:task.id,definitionHash:expected};
}
