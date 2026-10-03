import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { readExecutionCheckpoint, type ExecutionJournal, type RunCheckpoint } from "./execution-journal";
import type { CodexApprovalRequest } from "./codex-client";
import { readExecutionLeaseOwner } from "./execution-lease";

function responseFile(directory:string,runId:string,token:string) {
  if(!/^[a-f0-9-]+$/.test(token))throw new Error("Invalid approval identity");
  return path.join(directory,`${runId}-${token}.approval.json`);
}

// A separate explicit command answers only the exact currently pending request.
// Responses remain as evidence; neither prompts nor model output authorize one.
export function answerWorkflowApproval(directory:string,runId:string,token:string,approved:boolean) {
  if(typeof approved!=="boolean")throw new Error("Explicit approval decision required");
  const state=readExecutionCheckpoint(directory,runId),step=state.steps.slice(-1)[0];
  if(state.phase!=="in_flight" || step?.approval?.token!==token || step.result)throw new Error("Approval is no longer pending");
  const owner=readExecutionLeaseOwner(directory);
  if(owner.token!==step.approval.ownerToken)throw new Error("Approval owner changed; reconcile execution");
  try {process.kill(owner.pid,0);} catch {throw new Error("Approval owner is unavailable; reconcile execution");}
  fs.writeFileSync(responseFile(directory,runId,token),JSON.stringify({runId,token,approved}),{encoding:"utf8",flag:"wx",mode:0o600});
  return {runId,approval:token,decision:approved?"approve":"deny",recorded:true};
}

export async function awaitWorkflowApproval(journal:ExecutionJournal,directory:string,request:CodexApprovalRequest,
  redact:(text:string)=>string,signal?:AbortSignal,onCheckpoint?:(state:RunCheckpoint)=>Promise<void>):Promise<boolean> {
  const token=randomUUID(),runId=journal.snapshot().runId;
  const ownerToken=readExecutionLeaseOwner(directory).token;
  await journal.recordApproval({token,ownerToken,requestId:request.requestId,kind:request.kind,summary:redact(request.summary)});
  await onCheckpoint?.(journal.snapshot());
  const file=responseFile(directory,runId,token);
  const approved=await new Promise<boolean>((resolve,reject)=>{
    const finish=(error?:Error,value?:boolean)=>{clearInterval(timer);signal?.removeEventListener("abort",abort);error?reject(error):resolve(value!);};
    const abort=()=>finish(new Error("Approval interrupted; execution requires reconciliation"));
    const timer=setInterval(()=>{
      try {
        if(!fs.existsSync(file))return;
        const stat=fs.lstatSync(file);if(stat.isSymbolicLink() || !stat.isFile())throw new Error("Invalid approval response file");
        const response=JSON.parse(fs.readFileSync(file,"utf8"));
        if(response.runId!==runId || response.token!==token || typeof response.approved!=="boolean")throw new Error("Approval response identity mismatch");
        finish(undefined,response.approved);
      } catch {finish(new Error("Cannot read matching approval response"));}
    },100);
    signal?.addEventListener("abort",abort,{once:true});if(signal?.aborted)abort();
  });
  await journal.recordApproval();
  await onCheckpoint?.(journal.snapshot());
  return approved;
}
