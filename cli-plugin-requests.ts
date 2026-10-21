import * as fs from "fs";
import * as path from "path";
import {randomUUID} from "crypto";
import {performance} from "perf_hooks";
import {readExecutionLeaseOwner, type ExecutionLease} from "./execution-lease";
import type {RunCheckpoint} from "./execution-journal";
import {validWorkflowEdit, type WorkflowEditCommand, type WorkflowEditResult} from "./workflow-edit";

export interface PluginCommand {
  command: "run" | "resume" | "reconcile";
  workflowId?: string;
  taskId?: string;
  runId?: string;
}
export type ExecutionSummary = Pick<RunCheckpoint,"runId"|"workflowId"|"phase"|"revision"|"nextStepId">;
export function executionSummary(state: RunCheckpoint): ExecutionSummary {
  const {runId,workflowId,phase,revision,nextStepId}=state;
  return {runId,workflowId,phase,revision,nextStepId};
}
const uuid=/^[a-f0-9-]{36}$/;
function regularDirectory(directory:string):void {
  const stat=fs.lstatSync(directory);
  if(!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(directory)!==directory) throw new Error("Unsafe CLI request directory");
}
function read(file:string):any {
  const stat=fs.lstatSync(file);
  if(!stat.isFile() || stat.isSymbolicLink() || stat.nlink!==1 || stat.size>65536) throw new Error("Unsafe CLI request file");
  return JSON.parse(fs.readFileSync(file,"utf8"));
}
function write(file:string,value:unknown):void {
  const fd=fs.openSync(file,"wx",0o600);
  try {fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
}
// Never remove the destination: readers must see one complete durable value.
// A sharing violation on Windows is retried only for this publication, never
// for workflow effects. Each retry yields and revalidates the lease and path.
async function replace(file:string,value:unknown,check:()=>void,asyncFlush=true):Promise<void> {
  const temp=file+"."+randomUUID()+".tmp";
  check();
  const deadline=performance.now()+2000;
  let lastError:unknown;
  const bytes=JSON.stringify(value);
  let owned:fs.Stats|undefined;
  const sameTemporary=()=>{
    if(!owned || !fs.existsSync(temp))return false;
    const current=fs.lstatSync(temp);
    return current.isFile() && !current.isSymbolicLink() && current.nlink===1 && current.dev===owned.dev && current.ino===owned.ino;
  };
  try {
    // A tiny wx creation/write is indivisible. Only the durable flush leaves
    // the input thread; acceptance still waits for it before any effects.
    const fd=fs.openSync(temp,"wx",0o600);
    try {
      owned=fs.fstatSync(fd);
      fs.writeFileSync(fd,bytes);
      if(asyncFlush)await new Promise<void>((resolve,reject)=>fs.fsync(fd,error=>error?reject(error):resolve()));
      else fs.fsyncSync(fd); // Standalone CLI submission retains its entry boundary.
    } finally {fs.closeSync(fd);}
    for(let attempt=0;;attempt++) {
      if(attempt>0 && performance.now()>=deadline)throw lastError;
      if(!sameTemporary() || fs.readFileSync(temp,"utf8")!==bytes)throw new Error("CLI publication temporary identity changed");
      check();if(fs.existsSync(file))read(file);
      try {fs.renameSync(temp,file);return;}
      catch(error) {
        lastError=error;
        if(!["EPERM","EACCES","EBUSY"].includes((error as NodeJS.ErrnoException).code || "") ||
            attempt>=12 || performance.now()>=deadline)throw error;
        await new Promise(resolve=>setTimeout(resolve,Math.min(20*(attempt+1),100)));
      }
    }
  } finally {
    if(sameTemporary() && fs.statSync(temp).size===Buffer.byteLength(bytes) && fs.readFileSync(temp,"utf8")===bytes)fs.unlinkSync(temp);
  }
}
function validCommand(value:any):boolean {
  if(value?.command==="edit-workflow")return validWorkflowEdit(value);
  const id=(v:any)=>typeof v==="string" && v.length>0 && v.length<=256 && !/[\0\r\n]/.test(v);
  return value && ["run","resume","reconcile"].includes(value.command) &&
    (id(value.workflowId) && value.taskId===undefined || id(value.taskId) && value.workflowId===undefined) &&
    (value.command==="run" ? value.runId===undefined : typeof value.runId==="string" && value.runId.length<=256 && /^[a-zA-Z0-9-]+$/.test(value.runId));
}

// One mailbox per lease. Accepted receipts survive reloads and are never replayed.
// The files carry only IDs/progress, never executable payloads or configuration.
export function createPluginRequestHost(lease:ExecutionLease, execute:(command:PluginCommand,signal:AbortSignal,progress:(state:RunCheckpoint)=>Promise<void>)=>Promise<RunCheckpoint>, edit?:(command:WorkflowEditCommand)=>Promise<WorkflowEditResult>) {
  lease.assertOwned();
  const root=fs.realpathSync(lease.directory),directory=path.join(root,"cli-"+lease.token);
  fs.mkdirSync(directory,{mode:0o700});regularDirectory(directory);
  const descriptor=path.join(directory,"host");
  let heartbeatAt=Date.now();
  const hostDescriptor=()=>({protocol:1,owner:lease.token,pid:process.pid,heartbeatAt,workflowEditing:!!edit});
  write(descriptor,hostDescriptor());
  let closed=false;
  let failure:Error|undefined,polling:Promise<void>|undefined;
  let active:{id:string;controller:AbortController;done?:Promise<void>}|undefined;
  const seen=new Set<string>();
  const check=()=>{regularDirectory(directory);lease.assertOwned();};
  const checkDescriptor=()=>{
    check();const previous=read(descriptor);
    if(previous.protocol!==1 || previous.owner!==lease.token || previous.pid!==process.pid)throw new Error("CLI host identity changed");
  };
  const receipt=(id:string,value:object)=>{
    const file=path.join(directory,id+".receipt");
    return replace(file,{protocol:1,owner:lease.token,id,...value},()=>{
      check();
      if(fs.existsSync(file)) {
        const previous=read(file);
        if(previous.protocol!==1 || previous.owner!==lease.token || previous.id!==id)throw new Error("CLI receipt identity changed");
      }
    });
  };
  const close=()=>{
    if(closed)return;
    closed=true;active?.controller.abort();
    check();if(fs.existsSync(descriptor)){checkDescriptor();fs.unlinkSync(descriptor);}
  };
  const fail=()=>{
    failure ||= new Error("CLI receipt publication failed; inspect status and receipt before retrying");
    // If removing the descriptor also fails, its heartbeat expires. The client
    // reports uncertainty instead of waiting forever or starting another run.
    try {close();} catch { /* Drain still fails and retains the owner's lease. */ }
  };
  const pollOnce=async()=>{
    if(closed)return;
    check();
    if(Date.now()-heartbeatAt>=1000){
      heartbeatAt=Date.now();
      try {await replace(descriptor,hostDescriptor(),()=>{checkDescriptor();if(closed)throw new Error("CLI host is closed");});}
      catch(error){if(closed)return;throw error;}
    }
    if(closed)return;
    if(active && fs.existsSync(path.join(directory,active.id+".cancel"))) {read(path.join(directory,active.id+".cancel"));active.controller.abort();}
    for(const name of fs.readdirSync(directory)) {
      if(!name.endsWith(".request"))continue;
      const id=name.slice(0,-8);if(!uuid.test(id))continue;
      if(seen.has(id) || fs.existsSync(path.join(directory,id+".receipt")))continue;
      seen.add(id);
      let request:any;
      try {request=read(path.join(directory,name));} catch {await receipt(id,{status:"rejected",error:"Invalid CLI request"});continue;}
      if(!request || request.protocol!==1 || request.owner!==lease.token || request.id!==id || !validCommand(request) ||
          !Number.isFinite(request.expiresAt) || request.expiresAt<Date.now() || request.expiresAt>Date.now()+60000 ||
          fs.existsSync(path.join(directory,id+".cancel"))) {
        await receipt(id,{status:"rejected",error:"Expired, cancelled or invalid CLI request"});continue;
      }
      if(closed)return;
      if(active){await receipt(id,{status:"rejected",error:"AutoOC is already executing a CLI request"});continue;}
      const execution:{id:string;controller:AbortController;done?:Promise<void>}={id,controller:new AbortController()};active=execution;
      let checkpoint:ExecutionSummary|undefined;
      const accepted=receipt(id,{status:"accepted"});
      execution.done=(async()=>{
        let publications=Promise.resolve();
        let acceptingProgress=true;
        try {
          await accepted; // durable before invoking any workflow effects
          if(closed)throw new Error("CLI host closed before execution");
          if(request.command==="edit-workflow") {
            if(!edit)throw new Error("Workflow editing unsupported");
            const result=await edit(request);
            await receipt(id,{status:"completed",editResult:result});
            return;
          }
          const result=await execute(request,execution.controller.signal,state=>{
            if(!acceptingProgress)return Promise.resolve();
            const next=executionSummary(state);checkpoint=next;
            publications=publications.then(()=>receipt(id,{status:"running",checkpoint:next}));
            // Old consumers may not await the callback. Keep it in the ordered
            // chain and observe rejection now, then propagate it at the barrier.
            void publications.catch(()=>{});
            return publications;
          });
          acceptingProgress=false;
          await publications;
          await receipt(id,{status:"completed",checkpoint:executionSummary(result)});
        } catch {
          acceptingProgress=false;
          await publications.catch(()=>{});
          // Raw provider/filesystem errors can contain secrets. Details stay in the existing runtime evidence.
          try {await receipt(id,{status:"failed",checkpoint,error:request.command==="edit-workflow"?"Workflow edit failed; keep Obsidian open. Export the current definition, check active execution and inspect this receipt before retrying":"Plugin execution or receipt publication failed; inspect AutoOC and the recorded run before retrying"});}
          catch {fail();} // An uncertain receipt never authorizes replay.
        } finally {if(active===execution)active=undefined;}
      })();
      // poll completes only after acceptance has either failed or invoked the
      // executor. Terminal work is tracked separately and must drain on close.
      await accepted.catch(()=>{});
    }
  };
  const poll=():Promise<void>=>{
    if(failure)return Promise.reject(failure);
    if(polling)return polling;
    polling=pollOnce().catch(()=>{fail();throw failure;}).finally(()=>{polling=undefined;});
    return polling;
  };
  return {poll,close, get hasPendingWork(){return !!polling || !!active || !!failure;},async drain(){
    await polling;
    await active?.done;
    if(failure)throw failure;
  }};
}

// Undefined means there was no owner BEFORE submission. Once submitted, never
// fall back to autonomous execution, even if the plugin exits or a reply is lost.
export async function requestPluginExecution(runtime:string,command:PluginCommand,signal?:AbortSignal,onProgress?:(state:ExecutionSummary)=>void):Promise<ExecutionSummary|undefined> {
  return requestPluginCommand(runtime,command,signal,onProgress) as Promise<ExecutionSummary|undefined>;
}
export async function requestPluginWorkflowEdit(runtime:string,command:WorkflowEditCommand):Promise<WorkflowEditResult> {
  const result=await requestPluginCommand(runtime,command);
  if(!result)throw new Error("Enable AutoOC in Obsidian to edit workflows through its owner; do not edit data.json directly");
  return result as WorkflowEditResult;
}
async function requestPluginCommand(runtime:string,command:PluginCommand|WorkflowEditCommand,signal?:AbortSignal,onProgress?:(state:ExecutionSummary)=>void):Promise<ExecutionSummary|WorkflowEditResult|undefined> {
  if(!fs.existsSync(path.join(runtime,"execution.lock")))return undefined;
  const root=fs.realpathSync(runtime);regularDirectory(root);
  const owner=readExecutionLeaseOwner(root),directory=path.join(root,"cli-"+owner.token);
  if(!fs.existsSync(directory))throw new Error("AutoOC execution is reserved; the owner does not support CLI requests. Inspect status before retrying");
  // Bound the wait even if a live host is stuck after accepting. Expiry is
  // uncertainty, never cancellation, successful completion or permission to replay.
  const waitDeadline=performance.now()+24*60*60*1000;
  const check=()=>{
    regularDirectory(directory);
    const current=readExecutionLeaseOwner(root);
    if(current.token!==owner.token || current.pid!==owner.pid)throw new Error("CLI request owner changed");
    const host=read(path.join(directory,"host"));
    if(host.protocol!==1 || host.owner!==owner.token || host.pid!==owner.pid)throw new Error("Invalid CLI request host");
    if(command.command==="edit-workflow" && host.workflowEditing!==true)throw new Error("Loaded AutoOC does not support workflow editing; reload the updated plugin once, keeping Obsidian open");
    if(host.heartbeatAt!==undefined) {
      if(!Number.isFinite(host.heartbeatAt) || host.heartbeatAt>Date.now()+60000 || Date.now()-host.heartbeatAt>30000)
        throw new Error("CLI host heartbeat expired; terminal publication is uncertain");
    }
    process.kill(owner.pid,0);
  };
  check();if(signal?.aborted)throw new Error("CLI request cancelled before submission");
  const id=randomUUID(),expiresAt=Date.now()+30000;
  const file=path.join(directory,id+".request"),resultFile=path.join(directory,id+".receipt");
  if(!validCommand(command))throw new Error("Invalid CLI command");
  if(Buffer.byteLength(JSON.stringify(command),'utf8')>60000)throw new Error("Workflow edit payload exceeds 60KB; split the edit into smaller patches");
  await replace(file,{protocol:1,owner:owner.token,id,expiresAt,...command},check,false);
  let accepted=false,lastProgress="",runId="runId" in command?command.runId:undefined;
  for(;;){
    try {
      regularDirectory(directory);
      if(fs.existsSync(resultFile)) {
        const result=read(resultFile);
        if(result.protocol!==1 || result.owner!==owner.token || result.id!==id)throw new Error("CLI receipt identity changed");
        if(!["accepted","running","completed","rejected","failed"].includes(result.status))throw new Error("Invalid CLI receipt status");
        const checkpoint=result.checkpoint;
        if(command.command==="edit-workflow") {
          if(result.status==="completed") {
            if(result.editResult?.workflowId!==command.workflowId || !/^[a-f0-9]{64}$/.test(result.editResult?.definitionHash))throw new Error("Invalid workflow edit receipt");
            return result.editResult;
          }
          if(result.status==="rejected" || result.status==="failed")throw new Error(result.error);
        }
        if(checkpoint && (typeof checkpoint.runId!=="string" || !/^[a-zA-Z0-9-]+$/.test(checkpoint.runId) ||
            checkpoint.workflowId!==(command.taskId ? "@task:"+command.taskId : command.workflowId) ||
            "runId" in command && command.runId && checkpoint.runId!==command.runId || !Number.isSafeInteger(checkpoint.revision) || checkpoint.revision<0 ||
            !["ready","in_flight","completed","failed","abandoned"].includes(checkpoint.phase) ||
            !(checkpoint.nextStepId===null || typeof checkpoint.nextStepId==="string")))throw new Error("Invalid CLI receipt checkpoint");
        if(result.checkpoint){
          runId=result.checkpoint.runId;
          const serialized=JSON.stringify(result.checkpoint);
          if(serialized!==lastProgress){lastProgress=serialized;onProgress?.(executionSummary(result.checkpoint));}
        }
        if(result.status==="completed") {
          if(!checkpoint)throw new Error("Missing CLI result checkpoint");
          return executionSummary(checkpoint);
        }
        if(result.status==="rejected" || result.status==="failed")throw new Error(result.error);
        accepted=true;
      }
      if(signal?.aborted) {
        write(path.join(directory,id+".cancel"),{id});
        throw new Error("CLI wait interrupted; cooperative cancellation requested");
      }
      check();
      if(performance.now()>=waitDeadline)throw new Error("CLI wait deadline reached; execution outcome is uncertain");
      if(!accepted && Date.now()>expiresAt)throw new Error("CLI request expired before acceptance");
    } catch(error) {
      const reason=error instanceof Error && !(error as NodeJS.ErrnoException).code ? error.message : "CLI request host is unavailable";
      throw new Error(`${reason}. Request ${id}${runId ? `, run ${runId}` : ""}; inspect status and receipt before any retry`);
    }
    await new Promise(resolve=>setTimeout(resolve,100));
  }
}
