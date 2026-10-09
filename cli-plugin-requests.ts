import * as fs from "fs";
import * as path from "path";
import {randomUUID} from "crypto";
import {readExecutionLeaseOwner, type ExecutionLease} from "./execution-lease";
import type {RunCheckpoint} from "./execution-journal";

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
function replace(file:string,value:unknown):void {
  if(fs.existsSync(file))read(file);
  const temp=file+"."+randomUUID()+".tmp";
  write(temp,value);
  try {fs.renameSync(temp,file);} finally {if(fs.existsSync(temp))fs.unlinkSync(temp);}
}
function validCommand(value:any):boolean {
  const id=(v:any)=>typeof v==="string" && v.length>0 && v.length<=256 && !/[\0\r\n]/.test(v);
  return value && ["run","resume","reconcile"].includes(value.command) &&
    (id(value.workflowId) && value.taskId===undefined || id(value.taskId) && value.workflowId===undefined) &&
    (value.command==="run" ? value.runId===undefined : typeof value.runId==="string" && value.runId.length<=256 && /^[a-zA-Z0-9-]+$/.test(value.runId));
}

// One mailbox per lease. Accepted receipts survive reloads and are never replayed.
// The files carry only IDs/progress, never executable payloads or configuration.
export function createPluginRequestHost(lease:ExecutionLease, execute:(command:PluginCommand,signal:AbortSignal,progress:(state:RunCheckpoint)=>void)=>Promise<RunCheckpoint>) {
  lease.assertOwned();
  const root=fs.realpathSync(lease.directory),directory=path.join(root,"cli-"+lease.token);
  fs.mkdirSync(directory,{mode:0o700});regularDirectory(directory);
  const descriptor=path.join(directory,"host");
  write(descriptor,{protocol:1,owner:lease.token,pid:process.pid});
  let closed=false;
  let active:{id:string;controller:AbortController}|undefined;
  const check=()=>{regularDirectory(directory);lease.assertOwned();};
  const receipt=(id:string,value:object)=>{check();replace(path.join(directory,id+".receipt"),{protocol:1,owner:lease.token,id,...value});};
  const poll=()=>{
    if(closed)return;
    check();
    if(active && fs.existsSync(path.join(directory,active.id+".cancel"))) {read(path.join(directory,active.id+".cancel"));active.controller.abort();}
    for(const name of fs.readdirSync(directory)) {
      if(!name.endsWith(".request"))continue;
      const id=name.slice(0,-8);if(!uuid.test(id))continue;
      if(fs.existsSync(path.join(directory,id+".receipt")))continue;
      let request:any;
      try {request=read(path.join(directory,name));} catch {receipt(id,{status:"rejected",error:"Invalid CLI request"});continue;}
      if(!request || request.protocol!==1 || request.owner!==lease.token || request.id!==id || !validCommand(request) ||
          !Number.isFinite(request.expiresAt) || request.expiresAt<Date.now() || request.expiresAt>Date.now()+60000 ||
          fs.existsSync(path.join(directory,id+".cancel"))) {
        receipt(id,{status:"rejected",error:"Expired, cancelled or invalid CLI request"});continue;
      }
      if(active){receipt(id,{status:"rejected",error:"AutoOC is already executing a CLI request"});continue;}
      const execution={id,controller:new AbortController()};active=execution;
      receipt(id,{status:"accepted"}); // durable before invoking any workflow effects
      let checkpoint:ExecutionSummary|undefined;
      void (async()=>{
        try {
          const result=await execute(request,execution.controller.signal,state=>{
            checkpoint=executionSummary(state);receipt(id,{status:"running",checkpoint});
          });
          receipt(id,{status:"completed",checkpoint:executionSummary(result)});
        } catch {
          // Raw provider/filesystem errors can contain secrets. Details stay in the existing runtime evidence.
          try {receipt(id,{status:"failed",checkpoint,error:"Plugin execution failed; inspect AutoOC and the recorded run before retrying"});} catch { /* An uncertain receipt never authorizes replay. */ }
        } finally {if(active===execution)active=undefined;}
      })();
    }
  };
  return {poll,close(){
    if(closed)return;closed=true;active?.controller.abort();
    check();if(fs.existsSync(descriptor)) {read(descriptor);fs.unlinkSync(descriptor);}
  }};
}

// Undefined means there was no owner BEFORE submission. Once submitted, never
// fall back to autonomous execution, even if the plugin exits or a reply is lost.
export async function requestPluginExecution(runtime:string,command:PluginCommand,signal?:AbortSignal,onProgress?:(state:ExecutionSummary)=>void):Promise<ExecutionSummary|undefined> {
  if(!fs.existsSync(path.join(runtime,"execution.lock")))return undefined;
  const root=fs.realpathSync(runtime);regularDirectory(root);
  const owner=readExecutionLeaseOwner(root),directory=path.join(root,"cli-"+owner.token);
  if(!fs.existsSync(directory))throw new Error("AutoOC execution is reserved; the owner does not support CLI requests. Inspect status before retrying");
  const check=()=>{
    regularDirectory(directory);
    const current=readExecutionLeaseOwner(root);
    if(current.token!==owner.token || current.pid!==owner.pid)throw new Error("CLI request owner changed");
    const host=read(path.join(directory,"host"));
    if(host.protocol!==1 || host.owner!==owner.token || host.pid!==owner.pid)throw new Error("Invalid CLI request host");
    process.kill(owner.pid,0);
  };
  check();if(signal?.aborted)throw new Error("CLI request cancelled before submission");
  const id=randomUUID(),expiresAt=Date.now()+30000;
  const file=path.join(directory,id+".request"),resultFile=path.join(directory,id+".receipt");
  if(!validCommand(command))throw new Error("Invalid CLI command");
  replace(file,{protocol:1,owner:owner.token,id,expiresAt,...command});
  let accepted=false,lastProgress="",runId=command.runId;
  for(;;){
    try {
      regularDirectory(directory);
      if(fs.existsSync(resultFile)) {
        const result=read(resultFile);
        if(result.protocol!==1 || result.owner!==owner.token || result.id!==id)throw new Error("CLI receipt identity changed");
        if(!["accepted","running","completed","rejected","failed"].includes(result.status))throw new Error("Invalid CLI receipt status");
        const checkpoint=result.checkpoint;
        if(checkpoint && (typeof checkpoint.runId!=="string" || !/^[a-zA-Z0-9-]+$/.test(checkpoint.runId) ||
            checkpoint.workflowId!==(command.taskId ? "@task:"+command.taskId : command.workflowId) ||
            command.runId && checkpoint.runId!==command.runId || !Number.isSafeInteger(checkpoint.revision) || checkpoint.revision<0 ||
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
      if(!accepted && Date.now()>expiresAt)throw new Error("CLI request expired before acceptance");
    } catch(error) {
      const reason=error instanceof Error && !(error as NodeJS.ErrnoException).code ? error.message : "CLI request host is unavailable";
      throw new Error(`${reason}. Request ${id}${runId ? `, run ${runId}` : ""}; inspect status and receipt before any retry`);
    }
    await new Promise(resolve=>setTimeout(resolve,100));
  }
}
