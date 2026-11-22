import * as fs from "fs";
import * as path from "path";
import {createHash} from "crypto";
import {normalizePageSelection,type WorkPage,type WorkPageSettings} from "./work-pages";
import {workPageRevision,type FinishWorkReview,type BlockingPageSession} from "./finish-work";
import type {MergeReview,MergeCommand} from "./merge-review";
import type {DiscardWorkReview} from "./discard-work";

export type PageReviewKind="merge"|"finish"|"discard"|"delete";
export type PageAction="merge-start"|"merge-complete"|"merge-abort"|"archive"|"remove-worktree"|"discard"|"delete";
export interface PageReviewRequest {pageId:string;kind:PageReviewKind;targetDirectory?:string;}
export interface PageActionRequest {
  pageId:string;action:PageAction;reviewHash:string;targetDirectory?:string;
  sessionsClosed?:boolean;confirmLoss?:boolean;confirmDelete?:boolean;branchName?:string;
}
export interface PageManagementCommand {
  command:"review-page"|"page-action";request:PageReviewRequest|PageActionRequest;
  workflowId?:never;taskId?:never;stepId?:never;pageId?:never;runId?:never;
}
export interface PageManagementResult {
  command:"review-page"|"page-action";pageId:string;kind?:PageReviewKind;action?:PageAction;
  applied?:true;reviewHash?:string;page?:Record<string,unknown>;review?:Record<string,any>;
  sessions?:BlockingPageSession[];output?:string;truncated?:boolean;
}
export interface PageManagementHost {
  settings:WorkPageSettings;
  isLifecycleStopped():boolean;
  redactSecrets(text:string):string;
  pageBlockingSessions(pageId?:string):BlockingPageSession[];
  reviewPageMerge(pageId:string,targetDirectory?:string):Promise<MergeReview>;
  executePageMerge(pageId:string,targetDirectory:string,hash:string,action:MergeCommand,confirmed?:boolean):Promise<{review:MergeReview;output:string}>;
  reviewPageFinish(pageId:string):Promise<FinishWorkReview>;
  finishWorkPage(pageId:string,hash:string,remove:boolean,sessionsClosed:boolean):Promise<void>;
  reviewPageDiscard(pageId:string):Promise<DiscardWorkReview>;
  discardWorkPage(pageId:string,hash:string,branch:string,confirmed:boolean):Promise<void>;
  deleteWorkPage(page:WorkPage):Promise<void>;
}
const kinds:PageReviewKind[]=["merge","finish","discard","delete"];
const actionKinds:Record<PageAction,PageReviewKind>={"merge-start":"merge","merge-complete":"merge","merge-abort":"merge",archive:"finish","remove-worktree":"finish",discard:"discard",delete:"delete"};
const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const object=(value:any)=>!!value&&typeof value==="object"&&!Array.isArray(value);
const text=(value:any,max=8192)=>typeof value==="string"&&value.length>0&&value.length<=max&&!/[\0\r\n]/.test(value);
export function validPageManagementCommand(value:any):value is PageManagementCommand {
  if(!object(value)||!["review-page","page-action"].includes(value.command)||!object(value.request)||
    ["workflowId","taskId","stepId","pageId","runId"].some(key=>value[key]!==undefined))return false;
  const r=value.request;
  try{if(!text(r.pageId,256)||normalizePageSelection(r.pageId)!==r.pageId)return false;}catch{return false;}
  if(r.targetDirectory!==undefined&&(!text(r.targetDirectory)||!path.isAbsolute(r.targetDirectory)))return false;
  if(value.command==="review-page")return kinds.includes(r.kind)&&
    Object.keys(r).every(key=>["pageId","kind",...(r.kind==="merge"?["targetDirectory"]:[])].includes(key));
  if(typeof r.action!=="string"||!Object.prototype.hasOwnProperty.call(actionKinds,r.action)||typeof r.reviewHash!=="string"||!/^[a-f0-9]{64}$/.test(r.reviewHash))return false;
  const extra=r.action.startsWith("merge-")?["targetDirectory",...(r.action==="merge-abort"?["confirmLoss"]:[])]:
    r.action==="remove-worktree"?["sessionsClosed"]:r.action==="discard"?["sessionsClosed","confirmLoss","branchName"]:r.action==="delete"?["confirmDelete"]:[];
  if(!Object.keys(r).every(key=>["pageId","action","reviewHash",...extra].includes(key)))return false;
  return (!r.action.startsWith("merge-")||text(r.targetDirectory)&&path.isAbsolute(r.targetDirectory))&&
    (r.action!=="merge-abort"&&r.action!=="discard"||r.confirmLoss===true)&&
    (r.action!=="remove-worktree"&&r.action!=="discard"||r.sessionsClosed===true)&&
    (r.action!=="discard"||text(r.branchName,1024))&&(r.action!=="delete"||r.confirmDelete===true);
}

export const pageManagementHelp={
  capability:"pageManagement:1 on the CLI and loaded Obsidian owner; no standalone fallback",
  review:"review-page --vault ROOT --page PAGE_ID --kind merge|finish|discard|delete [--target ABSOLUTE_DIRECTORY (merge only)]",
  action:"page-action --vault ROOT --request ABSOLUTE_JSON_FILE",
  request:"{pageId, action, reviewHash}; actions: merge-start, merge-complete, merge-abort, archive, remove-worktree, discard, delete. Merge actions require targetDirectory from the review; merge-abort requires confirmLoss:true; remove-worktree requires sessionsClosed:true; discard requires branchName, confirmLoss:true and sessionsClosed:true; delete requires confirmDelete:true. No force or terminal bypass.",
  recovery:"Keep the returned mailbox requestId. On timeout or failure, inspect-request/follow --vault ROOT --request-id ID --include-output true, then review current state; never resubmit an uncertain mutation. Review hashes bind the Page, Git state, target and observed sessions. Read-only reviews can run during active work; mutations retain the UI guards.",
};
export function parsePageManagementArgs(command:string,args:string[]):{vault:string;command:PageManagementCommand} {
  const allowed=command==="review-page"?["--vault","--page","--kind","--target"]:["--vault","--request"];
  const values=new Map<string,string>();
  for(let i=0;i<args.length;i+=2){const key=args[i],value=args[i+1];if(!allowed.includes(key)||values.has(key)||!value||value.startsWith("--"))throw new Error("Invalid page management options; use help");values.set(key,value);}
  const vault=values.get("--vault") || "";if(!path.isAbsolute(vault))throw new Error("An absolute --vault is required");
  let request:any;
  if(command==="review-page")request={pageId:values.get("--page"),kind:values.get("--kind"),...(values.has("--target")?{targetDirectory:values.get("--target")}: {})};
  else {
    const file=values.get("--request");if(!file||!path.isAbsolute(file))throw new Error("An absolute --request JSON file is required");
    const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>32768)throw new Error("Page action request must be a regular JSON file of at most 32768 bytes");
    request=JSON.parse(fs.readFileSync(file,"utf8"));
  }
  const parsed={command,request};if(!validPageManagementCommand(parsed))throw new Error("Invalid page request or missing explicit confirmation; use help");
  return {vault,command:parsed};
}

// Only this already-redacted error may be put in a public transport receipt.
export class PageManagementError extends Error {}
export async function managePage(host:PageManagementHost,command:PageManagementCommand,blockers:(pageId:string)=>string[]):Promise<PageManagementResult> {
  try {
    if(!validPageManagementCommand(command))throw new Error("Invalid page management command");
    if(host.isLifecycleStopped())throw new Error("AutoOC is stopping; do not retry a pending action");
    const request=command.request;
    const matches=host.settings.workPages?.filter(p=>p.id===request.pageId);
    if(matches?.length!==1)throw new Error("Page identity is missing or ambiguous; list pages again");
    const page:WorkPage=JSON.parse(JSON.stringify(matches[0]));
    const kind=command.command==="review-page"?(request as PageReviewRequest).kind:actionKinds[(request as PageActionRequest).action];
    const review:MergeReview|FinishWorkReview|DiscardWorkReview|{hash:string;blockers:string[]}=
      kind==="merge"?await host.reviewPageMerge(page.id,request.targetDirectory):kind==="finish"?await host.reviewPageFinish(page.id):
      kind==="discard"?await host.reviewPageDiscard(page.id):{hash:workPageRevision(page),blockers:[
        ...blockers(page.id),...(!page.archived?["Archive this page before deleting it"]:[]),
        ...(page.worktreeRemoval?["Keep the worktree removal evidence; this Page cannot be deleted"]:[]),
        ...(host.settings.pageRuns?.some(run=>run.pageId===page.id)?["Keep this Page to retain its run history"]:[])]};
    if(host.isLifecycleStopped()||host.settings.workPages?.filter(p=>p.id===page.id).length!==1||workPageRevision(host.settings.workPages.find(p=>p.id===page.id)!)!==workPageRevision(page))throw new Error("Page changed during review; review again");
    const sessions=host.pageBlockingSessions(kind==="merge"?undefined:page.id);
    const reviewHash=hash([kind,workPageRevision(page),review.hash,kind==="merge"?(review as MergeReview).target:null,sessions]);
    if(command.command==="review-page") {
      const r=review as any;
      const visible=kind==="merge"?{state:r.state,integration:r.integration,inProgress:r.inProgress,source:r.source,target:r.target,targets:r.targets,
        conflicts:r.conflicts,conflictCount:r.conflicts?.length,targetCount:r.targets?.length,blockers:r.blockers,completionBlockers:r.completionBlockers,
        sourceFiles:r.sourceFiles,sourceFileCount:r.sourceFiles?.length,targetFiles:r.targetFiles,targetFileCount:r.targetFiles?.length,details:r.details}:
        kind==="finish"?{archiveBlockers:r.archiveBlockers,removalBlockers:r.removalBlockers,files:r.files,fileCount:r.files?.length,changes:r.changes}:
        kind==="discard"?{blockers:r.blockers,stage:r.stage,fileCount:r.fileCount,commitCount:r.commitCount,changes:r.changes,commits:r.commits}:{blockers:r.blockers};
      return boundedResult(host,{command:command.command,pageId:page.id,kind,reviewHash,
        page:{id:page.id,name:page.name,directory:page.directory,kind:page.kind,branch:page.branch,archived:!!page.archived,worktreeRemoval:page.worktreeRemoval?.status},review:visible,sessions});
    }
    const action=request as PageActionRequest;
    if(action.reviewHash!==reviewHash)throw new Error("Page, Git state, target or sessions changed after review; obtain a new reviewHash");
    let output:string|undefined;
    if(kind==="merge") {
      const result=await host.executePageMerge(page.id,action.targetDirectory!,review.hash,action.action.slice(6) as MergeCommand,action.confirmLoss===true);
      output=result.output;
    } else if(kind==="finish")await host.finishWorkPage(page.id,review.hash,action.action==="remove-worktree",action.sessionsClosed===true);
    else if(kind==="discard")await host.discardWorkPage(page.id,review.hash,action.branchName!,action.confirmLoss===true&&action.sessionsClosed===true);
    else {
      if((review as {blockers:string[]}).blockers.length)throw new Error((review as {blockers:string[]}).blockers.join("\n"));
      await host.deleteWorkPage(page);
    }
    // A successful mutation is not conditional on an additional Git read. Ask
    // for a fresh review separately; its failure cannot erase a durable result.
    return boundedResult(host,{command:command.command,pageId:page.id,action:action.action,applied:true,output});
  } catch(error) {throw new PageManagementError(host.redactSecrets(error instanceof Error?error.message:String(error)).slice(0,4000));}
}

function boundedResult(host:PageManagementHost,result:PageManagementResult):PageManagementResult {
  let truncated=false;
  const visit=(value:any,key=""):any=>{
    if(typeof value==="string"){
      // Opaque identities must remain usable even when displayed content is redacted.
      if(["reviewHash","pageId","id","claimId","branch","directory","targetDirectory","head"].includes(key))return value;
      const redacted=host.redactSecrets(value);if(redacted.length>4000)truncated=true;return redacted.slice(0,4000);
    }
    if(Array.isArray(value)){if(value.length>40)truncated=true;return value.slice(0,40).map(item=>visit(item,key));}
    if(object(value))return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,visit(v,k)]));return value;
  };
  const compact=visit(result) as PageManagementResult;
  if(Buffer.byteLength(JSON.stringify(compact),"utf8")>48000){
    if(compact.review)for(const key of ["files","sourceFiles","targetFiles","conflicts","changes","commits","details","targets"])delete compact.review[key];
    compact.sessions=compact.sessions?.slice(0,5);truncated=true;
  }
  if(truncated)compact.truncated=true;
  if(Buffer.byteLength(JSON.stringify(compact),"utf8")>60000)throw new Error("Page review exceeds the transport limit; inspect the workspace locally");
  return compact;
}
