import * as fs from "fs";
import * as path from "path";
import {createHash, randomUUID} from "crypto";
import type {ExecutionLease} from "./execution-lease";
import type {InstalledWorkflowLocation} from "./installed-workflow-location";
import type {RunCheckpoint} from "./execution-journal";
import {readExecutionCheckpoint, checkpointUncertainties} from "./execution-journal";
import {atomicSettingsWrite} from "./settings-writer";
import {catalogTransaction} from "./catalog-transaction";
import {physicalPath} from "./path-identity";
import {createPageWorktree, describePageFolder, inspectWorktreePreparation, prepareWorktreeIgnore,
  verifyWorkPageEnvironment, validateWorkPages, assertPageDirectoryAvailable, assertPagePreparationTerminals, PageDirectoryError,
  pageExecutionId, gitIn, WORKTREE_FOLDER, WORKTREE_IGNORE, type WorkPage, type PagePreparationScope} from "./work-pages";

export interface PageCreationRequest {
  requestId: string; name: string; objective?: string; requirementId?: string; requirementText?: string;
  mode: "create" | "link" | "folder"; repository?: string; branch?: string; base?: string; directory?: string;
  allowGitignoreUpdate?: boolean;
  launch?: {workflowId?: string; taskId?: string};
}
type Stage = "queued" | "preparing" | "environment" | "created" | "launching" | "completed" | "blocked" | "needs-review";
interface PageCreationRecord {
  schemaVersion: 1; requestId: string; requestHash: string; pageId: string; owner: string;
  request: PageCreationRequest; stage: Stage; createdAt: string; waitForRuns: string[];
  page?: WorkPage; registered?:boolean; errorCode?: string; launchRunId?: string; launchPhase?: string;
  preparedEnvironment?: Pick<WorkPage,"directory"|"repository"|"branch"|"baseCommit"|"kind">;
  registrationOnly?:boolean;
  recoveryHistory?: {at:string;stage:Stage;errorCode?:string}[];
  diagnostic?: {pageId:string;directory:string};
}
export interface PageCreationResult {
  requestId: string; pageId: string; status: Stage; created: boolean; requirementId?: string;
  directory?: string; branch?: string; baseCommit?: string; requirementFile?: string;
  errorCode?: string; launchRunId?: string; launchPhase?: string; waitForRuns: string[];
  diagnostic?: {pageId:string;directory:string};
}
const requestId = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/;
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const ownKeys = (value:any, keys:string[]) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every(key=>keys.includes(key));
const text = (value:any, max:number, empty=false) => typeof value === "string" && value.length<=max && !value.includes("\0") && (empty || !!value.trim());
export function validPageCreationRequest(value:any): value is PageCreationRequest {
  if (!ownKeys(value,["requestId","name","objective","requirementId","requirementText","mode","repository","branch","base","directory","allowGitignoreUpdate","launch"]) ||
      typeof value.requestId!=="string" || !requestId.test(value.requestId) || !text(value.name,200) || !["create","link","folder"].includes(value.mode) ||
      value.objective!==undefined && !text(value.objective,16000,true) || value.requirementId!==undefined && !text(value.requirementId,200) ||
      value.requirementText!==undefined && (!text(value.requirementText,40000) || !value.requirementId) ||
      value.allowGitignoreUpdate!==undefined && typeof value.allowGitignoreUpdate!=="boolean") return false;
  const absolute = (v:any) => text(v,4096) && path.isAbsolute(v) && !/[\r\n]/.test(v);
  if (value.mode==="create") {
    if (!absolute(value.repository) || !text(value.branch,240) || !text(value.base,240) || value.directory!==undefined ||
        /[\r\n]/.test(value.branch+value.base) || value.branch.startsWith("-") || value.base.startsWith("-")) return false;
  } else if (!absolute(value.directory) || value.repository!==undefined || value.branch!==undefined || value.base!==undefined || value.allowGitignoreUpdate===true) return false;
  if (value.launch!==undefined && (!ownKeys(value.launch,["workflowId","taskId"]) ||
      !(text(value.launch.workflowId,256) && value.launch.taskId===undefined || text(value.launch.taskId,256) && value.launch.workflowId===undefined))) return false;
  if(value.launch && /[\r\n]/.test(value.launch.workflowId || value.launch.taskId))return false;
  return Buffer.byteLength(JSON.stringify(value),"utf8")<=60000;
}
export function readPageCreationRequest(file:string):PageCreationRequest {
  if (!path.isAbsolute(file)) throw new Error("Page request requires an absolute JSON file");
  const value=readJSON(file,60000);
  if(!validPageCreationRequest(value)) throw new Error("Invalid page creation request; inspect help for supported fields");
  return value;
}
function readJSON(file:string,max=200000):any {
  const stat=fs.lstatSync(file);
  if(!stat.isFile() || stat.isSymbolicLink() || stat.nlink!==1 || stat.size>max) throw new Error("Unsafe page request file");
  try{return JSON.parse(fs.readFileSync(file,"utf8"));}catch{throw new Error("Invalid page request JSON");}
}
function directory(runtime:string,create=false):string {
  const target=path.join(runtime,"page-requests");
  if(create && !fs.existsSync(target))fs.mkdirSync(target,{mode:0o700});
  if(fs.existsSync(target)){
    const stat=fs.lstatSync(target);
    if(stat.isSymbolicLink() || !stat.isDirectory() || physicalPath(target)!==target)throw new Error("Unsafe page request directory");
  }
  return target;
}
function fileFor(runtime:string,id:string,create=false):string {
  if(!requestId.test(id))throw new Error("Invalid page request ID");
  return path.join(directory(runtime,create),hash(id)+".json");
}
function readRecord(file:string):PageCreationRecord {
  const value=readJSON(file);
  if(value?.schemaVersion!==1 || !validPageCreationRequest(value.request) || value.requestId!==value.request.requestId ||
      value.requestHash!==hash(JSON.stringify(normalize(value.request))) || !/^[a-f0-9-]{36}$/.test(value.pageId) ||
      !/^[a-f0-9-]{36}$/.test(value.owner) || !Array.isArray(value.waitForRuns) || value.waitForRuns.some((id:any)=>!text(id,256) || !/^[a-f0-9-]+$/.test(id)) ||
      !["queued","preparing","environment","created","launching","completed","blocked","needs-review"].includes(value.stage)) throw new Error("Invalid durable page request; evidence preserved");
  if(value.page){validateWorkPages({workPages:[value.page]});if(value.page.id!==value.pageId)throw new Error("Page request identity changed");}
  if(value.registrationOnly!==undefined && typeof value.registrationOnly!=="boolean" ||
      value.recoveryHistory!==undefined && (!Array.isArray(value.recoveryHistory) || value.recoveryHistory.some((item:any)=>!item || !Number.isFinite(Date.parse(item.at)) || !["preparing","needs-review","environment"].includes(item.stage))))throw new Error("Invalid page recovery evidence");
  if(value.preparedEnvironment){
    const intent=value.preparedEnvironment;
    if(value.request.mode!=="create" || intent.kind!=="worktree" || typeof intent.directory!=="string" || !path.isAbsolute(intent.directory) ||
        typeof intent.repository!=="string" || !path.isAbsolute(intent.repository) || intent.branch!==value.request.branch || !/^[a-f0-9]{40,64}$/.test(intent.baseCommit))throw new Error("Invalid page environment intent");
  }
  return value;
}
function normalize(value:PageCreationRequest):PageCreationRequest {
  // Explicit order makes retries independent of JSON key order and omitted defaults.
  return {requestId:value.requestId,name:value.name.trim(),objective:value.objective || "",requirementId:value.requirementId,
    requirementText:value.requirementText,mode:value.mode,repository:value.repository,branch:value.branch,base:value.base,
    directory:value.directory,allowGitignoreUpdate:value.allowGitignoreUpdate===true,
    launch:value.launch ? {workflowId:value.launch.workflowId,taskId:value.launch.taskId} : undefined};
}
function summary(record:PageCreationRecord):PageCreationResult {
  return {requestId:record.requestId,pageId:record.pageId,status:record.stage,created:record.registered===true,
    requirementId:record.request.requirementId,directory:record.page?.directory,branch:record.page?.branch,baseCommit:record.page?.baseCommit,
    requirementFile:record.page?.requirementFile?.path,errorCode:record.errorCode,diagnostic:record.diagnostic,launchRunId:record.launchRunId,launchPhase:record.launchPhase,waitForRuns:record.waitForRuns};
}
export function inspectPageCreation(runtime:string,id:string):PageCreationResult {
  return summary(readRecord(fileFor(runtime,id)));
}
export function readPageRecoveryRequest(runtime:string,id:string):PageCreationRequest {
  return readRecord(fileFor(runtime,id)).request;
}
export interface PageCreationHost {
  lease:ExecutionLease; location:InstalledWorkflowLocation;
  /** Synchronous admission: false means wait, never bypass a live writer. */
  busy():boolean;
  assertOpen():void;
  activeRuns():string[];
  reserve(scope?:PagePreparationScope):()=>void;
  catalog():Promise<any>;
  register(page:WorkPage):Promise<void>;
  launch(request:NonNullable<PageCreationRequest["launch"]>,pageId:string,signal:AbortSignal,progress:(state:RunCheckpoint)=>Promise<void>):Promise<RunCheckpoint>;
}

/** A durable queue owned by the existing runtime. No daemon, catalog copy or recursive executor. */
export function createPageCreationService(host:PageCreationHost) {
  host.lease.assertOwned();
  if(physicalPath(host.lease.directory)!==physicalPath(host.location.runtimeDirectory))throw new Error("Page creation lease belongs to another installation");
  const pending=new Set<string>();
  let active:Promise<void>|undefined,activeFile:string|undefined,closed=false;
  const controller=new AbortController();
  const assertOpen=()=>{if(closed)throw new Error("Page creation host is closed");host.assertOpen();host.lease.assertOwned();};
  const save=async(file:string,record:PageCreationRecord)=>{host.lease.assertOwned();directory(host.lease.directory);await atomicSettingsWrite(file,record);};
  async function submit(value:PageCreationRequest,recover=false):Promise<PageCreationResult> {
    assertOpen();if(!validPageCreationRequest(value))throw new Error("Invalid page creation request");
    const request=normalize(value),requestHash=hash(JSON.stringify(request));
    const file=fileFor(host.lease.directory,request.requestId,true);
    if(activeFile===file){
      const current=readRecord(file);
      if(current.requestHash!==requestHash)throw new Error("Page request ID already used with different parameters");
      return summary(current);
    }
    return catalogTransaction(file,async()=>{
      assertOpen();
      if(fs.existsSync(file)){
        const previous=readRecord(file);
        if(previous.requestHash!==requestHash)throw new Error("Page request ID already used with different parameters");
        if(recover){
          if(previous.registered && ["created","completed"].includes(previous.stage))return summary(previous);
          if(request.mode!=="create" || previous.registered || previous.launchRunId || previous.launchPhase || !["preparing","needs-review","environment"].includes(previous.stage))throw new Error("Only an unregistered worktree creation can be recovered; inspect its retained evidence");
          previous.recoveryHistory=[...(previous.recoveryHistory || []),{at:new Date().toISOString(),stage:previous.stage,errorCode:previous.errorCode}];
          previous.registrationOnly=true;previous.owner=host.lease.token;
          // Recovery never enters queued: Git creation cannot be replayed.
          previous.stage="needs-review";await save(file,previous);pending.add(file);return summary(previous);
        }
        if(previous.owner!==host.lease.token && ["preparing","launching"].includes(previous.stage)){
          previous.stage="needs-review";previous.errorCode="OPERATION_OUTCOME_UNCERTAIN";await save(file,previous);
        }
        if(["queued","environment","created"].includes(previous.stage) && !(previous.stage==="created" && !request.launch)) {
          previous.owner=host.lease.token;await save(file,previous);pending.add(file);
        }
        return summary(previous);
      }
      if(recover)throw new Error("No reserved page request exists to recover");
      const waitForRuns=host.activeRuns();
      for(const id of waitForRuns)readExecutionCheckpoint(host.lease.directory,id);
      const record:PageCreationRecord={schemaVersion:1,requestId:request.requestId,requestHash,pageId:randomUUID(),owner:host.lease.token,
        request,stage:"queued",createdAt:new Date().toISOString(),waitForRuns};
      await save(file,record);pending.add(file);return summary(record);
    });
  }
  async function perform(file:string) {
    const record=readRecord(file),request=record.request;
    if(record.owner!==host.lease.token)throw new Error("Page request belongs to another owner");
    for(const id of record.waitForRuns){
      const parent=readExecutionCheckpoint(host.lease.directory,id);
      if(parent.phase!=="completed" || checkpointUncertainties(parent).length){
        record.stage="blocked";record.errorCode="PARENT_NOT_COMPLETED";await save(file,record);pending.delete(file);return;
      }
    }
    let release:(()=>void)|undefined;
    try {
      const preparedScope=request.mode==="create" ? await inspectWorktreePreparation(request.repository!) : undefined;
      const scope:PagePreparationScope=preparedScope ? {directory:path.join(preparedScope.directory,record.pageId),repository:preparedScope.repository,creating:true} : {directory:request.directory!};
      assertOpen();release=host.reserve(scope);
      let config=await host.catalog();validateWorkPages(config);
      assertPagePreparationTerminals(config,scope);
      assertPageDirectoryAvailable(config,undefined,record.pageId);
      if(request.mode!=="folder" && config.worktreesEnabled!==true)throw new PageCreationError("WORKTREES_DISABLED");
      if(request.launch && !record.registrationOnly){
        const entries=request.launch.taskId ? config.tasks : config.workflows;
        const id=request.launch.taskId || request.launch.workflowId;
        if(!Array.isArray(entries) || entries.filter((item:any)=>item.id===id).length!==1 || entries.find((item:any)=>item.id===id).disabled)throw new PageCreationError("LAUNCH_UNAVAILABLE");
      }
      if(record.stage==="needs-review" && record.registrationOnly){
        const preparation=await inspectWorktreePreparation(request.repository!);
        const directory=path.join(preparation.directory,record.pageId);
        const environment=await describePageFolder(directory,true);
        if(environment.directory!==directory || environment.repository!==preparation.repository || environment.branch!==request.branch)throw new PageCreationError("RECOVERY_ENVIRONMENT_MISMATCH");
        const entries=(await gitIn(preparation.repository,["worktree","list","--porcelain","-z"])).split("\0\0").map(block=>block.split("\0"));
        const matches=entries.filter(fields=>fields.includes("worktree "+directory.replace(/\\/g,"/")) || fields.includes("worktree "+directory));
        if(matches.length!==1 || !matches[0].includes("branch refs/heads/"+request.branch) || matches[0].some(field=>/^(locked|prunable)( |$)/.test(field)))throw new PageCreationError("RECOVERY_REGISTRATION_MISMATCH");
        assertPageDirectoryAvailable(config,directory,record.pageId);
        const page=record.page || {id:record.pageId,name:request.name,objective:request.objective || "",...environment,workflowIds:[],taskIds:[],
          ...(request.requirementId ? {requirementId:request.requirementId} : {})};
        if(page.directory!==directory || page.repository!==environment.repository || page.branch!==request.branch)throw new PageCreationError("RECOVERY_ENVIRONMENT_MISMATCH");
        if(record.preparedEnvironment){
          const intent=record.preparedEnvironment;
          if(intent.directory!==directory || intent.repository!==environment.repository || intent.branch!==request.branch || intent.kind!=="worktree")throw new PageCreationError("RECOVERY_ENVIRONMENT_MISMATCH");
          page.baseCommit=intent.baseCommit;
        }
        await verifyWorkPageEnvironment(page);
        record.page=page;record.stage="environment";await save(file,record);
      }
      if(record.stage==="queued"){
        let preparation:Awaited<ReturnType<typeof inspectWorktreePreparation>>|undefined;
        let environment:Awaited<ReturnType<typeof describePageFolder>>;
        if(request.mode==="create"){
          preparation=await inspectWorktreePreparation(request.repository!);
          await gitIn(preparation.repository,["check-ref-format","--branch",request.branch!]);
          const base=await gitIn(preparation.repository,["rev-parse","--verify","--end-of-options",request.base+"^{commit}"]);
          if((await gitIn(preparation.repository,["branch","--list",request.branch!])).trim() || fs.existsSync(path.join(preparation.directory,record.pageId)))throw new PageCreationError("ENVIRONMENT_COLLISION");
          if(!preparation.excluded && !request.allowGitignoreUpdate && !config.worktreeNoticeDismissed?.includes(preparation.preferenceKey))throw new PageCreationError("GITIGNORE_APPROVAL_REQUIRED");
          // The intent precedes the first effect. A crash here never authorizes replay of Git.
          record.preparedEnvironment={kind:"worktree",directory:path.join(preparation.directory,record.pageId),repository:preparation.repository,branch:request.branch!,baseCommit:base};
          record.stage="preparing";await save(file,record);assertOpen();
          if(!preparation.excluded)preparation=await prepareWorktreeIgnore(preparation);
          environment=await createPageWorktree(preparation,record.pageId,request.branch!,base);
        } else {
          environment=await describePageFolder(request.directory!,request.mode==="link");
          record.stage="preparing";await save(file,record);
        }
        record.page={id:record.pageId,name:request.name,objective:request.objective || "",...environment,workflowIds:[],taskIds:[],
          ...(request.requirementId ? {requirementId:request.requirementId} : {})};
        // Observed Git completion is durable before publishing the page to the catalog.
        record.stage="environment";await save(file,record);
        assertPageDirectoryAvailable(config,environment.directory,record.pageId);
      }
      if(record.stage==="environment"){
        assertPageDirectoryAvailable(config,record.page!.directory,record.pageId);
        assertOpen();await verifyWorkPageEnvironment(record.page!);
        if(request.requirementText!==undefined){
          const relative=".autooc/requirement.md",folder=path.join(record.page!.directory,".autooc"),target=path.join(record.page!.directory,relative);
          if(!fs.existsSync(folder))fs.mkdirSync(folder);
          if(fs.lstatSync(folder).isSymbolicLink() || !fs.statSync(folder).isDirectory())throw new PageCreationError("UNSAFE_REQUIREMENT_PATH");
          const digest=hash(request.requirementText);
          if(fs.existsSync(target)){
            const stat=fs.lstatSync(target);
            if(!stat.isFile() || stat.isSymbolicLink() || stat.nlink!==1 || stat.size>160000 || hash(fs.readFileSync(target,"utf8"))!==digest)throw new PageCreationError("REQUIREMENT_FILE_CONFLICT");
          } else {const fd=fs.openSync(target,"wx",0o600);try{fs.writeFileSync(fd,request.requirementText);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
          record.page!.requirementFile={path:relative,sha256:digest};
          await save(file,record);
        }
        await verifyWorkPageEnvironment(record.page!);
        await host.register(record.page!);
        record.registered=true;record.stage="created";record.errorCode=undefined;record.diagnostic=undefined;await save(file,record);
      }
      release();release=undefined;
      if(request.launch && !record.registrationOnly && record.stage==="created"){
        assertOpen();record.stage="launching";await save(file,record);
        const workflowId=pageExecutionId(record.pageId,request.launch.taskId || request.launch.workflowId!,!!request.launch.taskId);
        const state=await host.launch(request.launch,record.pageId,controller.signal,async state=>{
          if(state.workflowId!==workflowId || record.launchRunId && record.launchRunId!==state.runId)throw new Error("Page launch identity changed");
          record.launchRunId=state.runId;record.launchPhase=state.phase;await save(file,record);
        });
        if(state.workflowId!==workflowId || record.launchRunId!==state.runId)throw new Error("Page launch was not durably observed");
        record.launchPhase=state.phase;
        record.stage=["completed","failed"].includes(state.phase) && !checkpointUncertainties(state).length ? "completed" : "needs-review";
        if(record.stage==="needs-review")record.errorCode="LAUNCH_NOT_TERMINAL";
        await save(file,record);
      }
      pending.delete(file);
    } catch(error) {
      // Never replay a partially observed Git operation or launch. Known environment
      // completion can be resubmitted explicitly to finish registration under a lease.
      record.errorCode=error instanceof PageCreationError || error instanceof PageDirectoryError ? error.code : "PAGE_OPERATION_FAILED";
      record.diagnostic=error instanceof PageDirectoryError ? {pageId:error.pageId,directory:error.directory} : undefined;
      if(record.stage==="queued")record.stage="blocked";
      else if(record.stage!=="environment" && record.stage!=="created")record.stage="needs-review";
      await save(file,record);pending.delete(file);
    } finally {release?.();}
  }
  async function poll():Promise<void> {
    if(closed || active || !pending.size || host.busy())return;
    assertOpen();const file=pending.values().next().value as string;
    activeFile=file;active=Promise.resolve().then(()=>catalogTransaction(file,()=>perform(file))).finally(()=>{active=undefined;activeFile=undefined;});
    // Observe rejection; drain propagates storage failures and preserves the lease.
    void active.catch(()=>{});
  }
  let failure:unknown;
  async function checkedPoll(){if(failure)throw failure;await poll();if(active)void active.catch(error=>{failure=error;});}
  return {submit,poll:checkedPoll,get hasPendingWork(){return !!active || !!failure;},
    close(){closed=true;controller.abort();},async drain(){await active;if(failure)throw failure;},
    async flush(){while(!closed && pending.size && !host.busy()){await checkedPoll();await active;if(failure)throw failure;}}
  };
}
class PageCreationError extends Error {constructor(readonly code:string){super(code);}}

export const pageCreationHelp = {
  recover:"recover-page-request --vault <absolute path> --request-id <original request ID>. Explicitly verify and register an existing worktree using its reserved pageId. Preserves request/history, never creates Git resources or launches work. Requires pageCreationRecovery:1 on the loaded owner.",
  create:"create-page --vault <absolute path> --request <absolute JSON file>",
  inspect:"inspect-page-request --vault <absolute path> --request-id <stable ID>",
  fields:"requestId, name, objective?, requirementId?, requirementText?, mode: create|link|folder; create requires repository/branch/base, others require directory; allowGitignoreUpdate defaults false; optional launch object selecting exactly one existing workflowId or taskId.",
  behavior:"With an active owner returns a durable queued receipt and reserved pageId; inspect until created before using --page. Optional launch runs once after current runs complete successfully and resources are idle. Without an owner runs in the foreground. No work is replayed after restart: inspect and resubmit the identical request only for queued/environment/created states. needs-review requires inspecting retained effects, never a new request as retry.",
  requirement:"Explicit requirementText is snapshotted at .autooc/requirement.md in the page and hash-checked before running; Code can read it with explicit vault permission. No implicit copy of uncommitted files.",
  preparation:`Worktrees must already be enabled. New worktrees live in ${WORKTREE_FOLDER}/<pageId>; adding ${WORKTREE_IGNORE} to .gitignore requires explicit request consent or that project's saved preference. Approval errors require a reviewed new request; no branch, staging or commit is changed implicitly.`
};
