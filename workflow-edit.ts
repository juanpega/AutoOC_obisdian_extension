import {createHash} from "crypto";

export interface WorkflowEditCommand {
  command:"edit-workflow";
  workflowId:string;
  expectedHash:string;
  changes:{name?:string;description?:string;stepChanges?:Array<{id:string;name?:string;code?:string;evaluatePrompt?:string}>};
  taskId?:never;
  runId?:never;
}
export interface WorkflowEditResult {workflowId:string;definitionHash:string;}
const object=(value:any)=>value && typeof value==="object" && !Array.isArray(value);
const only=(value:any,keys:string[])=>object(value)&&Object.keys(value).every(key=>keys.includes(key));
export function validWorkflowEdit(value:any):value is WorkflowEditCommand {
  if(!object(value)||value.command!=="edit-workflow"||typeof value.workflowId!=="string"||!value.workflowId.length||value.workflowId.length>256||/[\0\r\n]/.test(value.workflowId)||
    typeof value.expectedHash!=="string"||!/^[a-f0-9]{64}$/.test(value.expectedHash)||value.taskId!==undefined||value.runId!==undefined)return false;
  const c=value.changes;
  if(!only(c,["name","description","stepChanges"])||!Object.keys(c).length)return false;
  if(["name","description"].some(key=>c[key]!==undefined&&typeof c[key]!=="string"))return false;
  if(c.name!==undefined&&!c.name.trim())return false;
  if(c.stepChanges!==undefined) {
    if(!Array.isArray(c.stepChanges)||!c.stepChanges.length||c.stepChanges.length>1000)return false;
    const ids=new Set();
    for(const step of c.stepChanges) {
      if(!only(step,["id","name","code","evaluatePrompt"])||typeof step.id!=="string"||!step.id||ids.has(step.id)||Object.keys(step).length<2)return false;
      if(["name","code","evaluatePrompt"].some(key=>step[key]!==undefined&&typeof step[key]!=="string"))return false;
      ids.add(step.id);
    }
  }
  return Buffer.byteLength(JSON.stringify(value.changes),"utf8")<=58000;
}
// Deliberately exclude outputs, credentials, runtime bindings and permissions.
// Export only the fields this first editing increment can change.
export function workflowEditDefinition(workflow:any):any {
  return {id:workflow.id,name:workflow.name,description:workflow.description,
    steps:(workflow.steps||[]).map((step:any)=>({id:step.id,name:step.name,code:step.code,evaluatePrompt:step.evaluatePrompt}))};
}
export function workflowEditHash(workflow:any):string {
  return createHash("sha256").update(JSON.stringify(workflowEditDefinition(workflow))).digest("hex");
}
export async function applyWorkflowEdit(host:{settings:any;assertIdle:()=>void;save:(validate:()=>void)=>Promise<void>},command:WorkflowEditCommand):Promise<WorkflowEditResult> {
  if(!validWorkflowEdit(command))throw new Error("Invalid workflow edit; only name, description and existing step text are supported");
  host.assertIdle();
  const matches=host.settings.workflows.filter((w:any)=>w.id===command.workflowId);
  if(matches.length!==1)throw new Error("Workflow identity is missing or ambiguous");
  const workflow=matches[0];
  if(workflowEditHash(workflow)!==command.expectedHash)throw new Error("Workflow edit conflict; export the current definition before editing again");
  const edits:Array<{target:any;key:string;had:boolean;before:any;after:string}>=[];
  const add=(target:any,patch:any,keys:string[])=>{for(const key of keys)if(Object.prototype.hasOwnProperty.call(patch,key))edits.push({target,key,had:Object.prototype.hasOwnProperty.call(target,key),before:target[key],after:patch[key]});};
  add(workflow,command.changes,["name","description"]);
  for(const patch of command.changes.stepChanges||[]) {
    const steps=workflow.steps.filter((s:any)=>s.id===patch.id);
    if(steps.length!==1)throw new Error("Workflow step identity is missing or ambiguous");
    const step=steps[0];
    if(patch.code!==undefined&&step.stepKind!=="code")throw new Error("Code edits require an existing code step");
    add(step,patch,["name","code","evaluatePrompt"]);
  }
  // Use the same live object/save queue as the editor. Unrelated UI changes
  // remain in that queue; rollback touches only fields still equal to ours.
  for(const edit of edits)edit.target[edit.key]=edit.after;
  const expected=workflowEditHash(workflow);
  const validate=()=>{
    host.assertIdle();
    if(!host.settings.workflows.includes(workflow)||workflowEditHash(workflow)!==expected)throw new Error("Workflow edit conflict during save; local changes preserved");
  };
  try {await host.save(validate);}
  catch(error){for(const edit of edits)if(edit.target[edit.key]===edit.after){if(edit.had)edit.target[edit.key]=edit.before;else delete edit.target[edit.key];}throw error;}
  validate();
  return {workflowId:workflow.id,definitionHash:expected};
}
