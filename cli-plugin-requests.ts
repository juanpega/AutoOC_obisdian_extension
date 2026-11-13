import {presentationFields, type ExecutionPresentation} from "./execution-presentation";
import * as fs from "fs";
import * as path from "path";
import {randomUUID} from "crypto";
import {performance} from "perf_hooks";
import {setInterval as nodeSetInterval, clearInterval as nodeClearInterval, setImmediate as nodeSetImmediate, clearImmediate as nodeClearImmediate, setTimeout} from "timers";
import {readExecutionLeaseOwner, type ExecutionLease} from "./execution-lease";
import {readExecutionCheckpoint, checkpointUncertainties, type RunCheckpoint} from "./execution-journal";
import {validWorkflowEdit, type WorkflowEditCommand, type WorkflowEditResult} from "./workflow-edit";
import {executionAdmissionDiagnostic} from "./execution-coordinator";
import {concurrencySettings} from "./execution-concurrency-settings";
import {pageExecutionId, normalizePageSelection} from "./work-pages";
import {withExecutionTiming,bindTimingRun,readExecutionTimings,type ExecutionTiming,type TimingContext} from "./execution-timing";
import {validPageCreationRequest, type PageCreationRequest, type PageCreationResult, type createPageCreationService} from "./page-creation";

interface PageCreationCommand {
  command:"create-page"; request:PageCreationRequest;
  workflowId?:never;taskId?:never;stepId?:never;pageId?:never;runId?:never;
}

export interface PluginCommand {
  command: "run" | "resume" | "reconcile";
  workflowId?: string;
  taskId?: string;
  stepId?: string;
  runId?: string;
  pageId?: string;
}
export type ExecutionSummary = Pick<RunCheckpoint,"runId"|"workflowId"|"phase"|"revision"|"nextStepId"> & Partial<ExecutionPresentation>;
export function executionSummary(state: ExecutionSummary, presentation: Partial<ExecutionPresentation> = state): ExecutionSummary {
  const {runId,workflowId,phase,revision,nextStepId}=state;
  return {runId,workflowId,phase,revision,nextStepId,...presentationFields(presentation)};
}

// Node timers and filesystem notifications do not depend on DOM visibility.
// The timer remains the fallback because filesystem notifications can coalesce.
export function startPluginRequestPump(host:ReturnType<typeof createPluginRequestHost>, onFailure:()=>void) {
  let stopped=false, wake:NodeJS.Immediate|undefined, watcher:fs.FSWatcher|undefined;
  const tick=()=>{if(!stopped)void host.poll().catch(()=>{stop();onFailure();});};
  const schedule=()=>{if(!stopped && !wake)wake=nodeSetImmediate(()=>{wake=undefined;tick();});};
  const timer=nodeSetInterval(tick,200);timer.unref?.();
  const stop=()=>{if(stopped)return;stopped=true;nodeClearInterval(timer);if(wake)nodeClearImmediate(wake);watcher?.close();};
  try {
    watcher=fs.watch(host.directory,{persistent:false},(_event,file)=>{if(!file || /\.(request|cancel)$/.test(String(file)))schedule();});
    watcher.on('error',()=>{watcher?.close();watcher=undefined;});
  } catch { /* Timer fallback; no change to execution ownership. */ }
  schedule();return stop;
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
  if(value?.command==="create-page")return validPageCreationRequest(value.request) && ["workflowId","taskId","stepId","pageId","runId"].every(key=>value[key]===undefined);
  if(value?.command==="edit-workflow")return value.pageId === undefined && validWorkflowEdit(value);
  try { if (value?.pageId !== undefined && (normalizePageSelection(value.pageId) !== value.pageId || value.stepId !== undefined)) return false; }
  catch { return false; }
  const id=(v:any)=>typeof v==="string" && v.length>0 && v.length<=256 && !/[\0\r\n]/.test(v);
  return value && ["run","resume","reconcile"].includes(value.command) &&
    (id(value.workflowId) && value.taskId===undefined || id(value.taskId) && value.workflowId===undefined) &&
    (value.stepId===undefined || id(value.stepId) && id(value.workflowId) && value.taskId===undefined) &&
    (value.command==="run" ? value.runId===undefined : typeof value.runId==="string" && value.runId.length<=256 && /^[a-zA-Z0-9-]+$/.test(value.runId));
}

// One mailbox per lease. Accepted receipts survive reloads and are never replayed.
// The files carry only IDs/progress, never executable payloads or configuration.
export function createPluginRequestHost(lease:ExecutionLease, execute:(command:PluginCommand,signal:AbortSignal,progress:(state:RunCheckpoint,presentation?:ExecutionPresentation)=>Promise<void>,timing?:TimingContext)=>Promise<RunCheckpoint & Partial<ExecutionPresentation>>, edit?:(command:WorkflowEditCommand)=>Promise<WorkflowEditResult>, getConcurrency:()=>Record<string,any>=()=>({}), capabilities: {pageSelection?: boolean;pages?:ReturnType<typeof createPageCreationService>} = {}) {
  lease.assertOwned();
  const root=fs.realpathSync(lease.directory),directory=path.join(root,"cli-"+lease.token);
  fs.mkdirSync(directory,{mode:0o700});regularDirectory(directory);
  const descriptor=path.join(directory,"host");
  let heartbeatAt=Date.now();
  let publishedLimit=concurrencySettings(getConcurrency()).maxConcurrentExecutions;
  const hostDescriptor=()=>({protocol:1,owner:lease.token,pid:process.pid,heartbeatAt,requestInspection:1,phaseTimings:1,workflowEditing:!!edit,concurrentExecutions:publishedLimit,sharedWorkspaceConcurrency:true,codeStepSelection:true,nestedWorkflows:1,...(capabilities.pageSelection ? {pageSelection:1} : {}),...(capabilities.pages ? {pageCreation:1} : {})});
  write(descriptor,hostDescriptor());
  let closed=false;
  let failure:Error|undefined,polling:Promise<void>|undefined,pagePolling:Promise<void>|undefined;
  const active=new Map<string,{id:string;controller:AbortController;editing:boolean;definition:string;done?:Promise<void>}>();
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
    closed=true;for(const execution of active.values())execution.controller.abort();
    capabilities.pages?.close();
    check();if(fs.existsSync(descriptor)){checkDescriptor();fs.unlinkSync(descriptor);}
  };
  const fail=()=>{
    failure ||= new Error("CLI receipt publication failed; inspect status and receipt; do not launch again");
    // If removing the descriptor also fails, its heartbeat expires. The client
    // reports uncertainty instead of waiting forever or starting another run.
    try {close();} catch { /* Drain still fails and retains the owner's lease. */ }
  };
  const pollOnce=async()=>{
    if(closed)return;
    check();
    const nextLimit=concurrencySettings(getConcurrency()).maxConcurrentExecutions;
    if(Date.now()-heartbeatAt>=1000 || publishedLimit!==nextLimit){
      heartbeatAt=Date.now();
      publishedLimit=nextLimit;
      try {await replace(descriptor,hostDescriptor(),()=>{checkDescriptor();if(closed)throw new Error("CLI host is closed");});}
      catch(error){if(closed)return;throw error;}
    }
    if(closed)return;
    for(const execution of active.values())if(fs.existsSync(path.join(directory,execution.id+".cancel"))) {read(path.join(directory,execution.id+".cancel"));execution.controller.abort();}
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
      if(request.command==="create-page" && !capabilities.pages){await receipt(id,{status:"rejected",error:"Loaded AutoOC does not support page creation"});continue;}
      if (request.pageId && !capabilities.pageSelection) {await receipt(id,{status:"rejected",error:"Loaded AutoOC does not support page selection; reload the updated plugin."});continue;}
      const definition=JSON.stringify(request.command==="create-page" ? ["create-page",request.request.requestId] : [request.pageId || "main",request.taskId ? "task" : "workflow",request.taskId || request.workflowId]);
      const duplicate=[...active.values()].some(e=>e.definition===definition);
      const limit=concurrencySettings(getConcurrency()).maxConcurrentExecutions;
      const busy=duplicate && request.command!=="create-page" ? "AutoOC is already executing this CLI definition" : request.command!=="create-page" && limit>0 && active.size>=limit ? `Concurrent execution limit reached (${limit})` :
        [...active.values()].some(e=>e.editing) || request.command==="edit-workflow" && active.size ? "Workflow editing requires exclusive execution" : undefined;
      if(busy){await receipt(id,{status:"rejected",error:busy});continue;}
      const execution={id,controller:new AbortController(),editing:request.command==="edit-workflow",definition,done:undefined as Promise<void>|undefined};active.set(id,execution);
      let checkpoint:ExecutionSummary|undefined;
      const receivedAt=Date.now();
      const submittedAt=Number.isFinite(request.submittedAt) && request.submittedAt<=receivedAt && request.submittedAt>=request.expiresAt-60000 ? request.submittedAt : request.expiresAt-30000;
      const timing={submittedAt,receivedAt,queueMs:Math.max(0,receivedAt-submittedAt)};
      const publish=(value:object)=>receipt(id,{timing,...value,updatedAt:Date.now()});
      const accepted=publish({status:"accepted"});
      execution.done=(async()=>{
        let publications=Promise.resolve();
        let acceptingProgress=true;
        try {
          await accepted; // durable before invoking any workflow effects
          if(closed)throw new Error("CLI host closed before execution");
          // fsync can itself exceed the admission deadline. Reject without effects.
          if(Date.now()>=request.expiresAt || fs.existsSync(path.join(directory,id+".cancel"))) {
            await publish({status:"rejected",error:"Expired or cancelled before execution"});return;
          }
          if(request.command==="create-page"){
            const result=await capabilities.pages!.submit(request.request);
            await publish({status:"completed",pageResult:result});return;
          }
          if(request.command==="edit-workflow") {
            if(!edit)throw new Error("Workflow editing unsupported");
            const result=await edit(request);
            await publish({status:"completed",editResult:result});
            return;
          }
          const result=await withExecutionTiming(root,{requestId:id,runId:request.runId,queueMs:timing.queueMs},context=>execute(request,execution.controller.signal,(state,presentation)=>{
            if(!acceptingProgress)return Promise.resolve();
            const next=executionSummary(state,presentation);checkpoint=next;bindTimingRun(next.runId,context);
            publications=publications.then(()=>publish({status:"running",checkpoint:next}));
            // Old consumers may not await the callback. Keep it in the ordered
            // chain and observe rejection now, then propagate it at the barrier.
            void publications.catch(()=>{});
            return publications;
          },context));
          acceptingProgress=false;
          await publications;
          await publish({status:"completed",checkpoint:executionSummary(result)});
        } catch (error) {
          acceptingProgress=false;
          await publications.catch(()=>{});
          // Raw provider/filesystem errors can contain secrets. Details stay in the existing runtime evidence.
          try {await publish({status:"failed",checkpoint,error:request.command==="edit-workflow"?"Workflow edit failed; keep Obsidian open and inspect this request":executionAdmissionDiagnostic(error) || "Plugin execution or receipt publication failed; inspect the recorded request and run; do not launch again"});}
          catch {fail();} // An uncertain receipt never authorizes replay.
        } finally {if(active.get(id)===execution)active.delete(id);}
      })();
      // poll completes only after acceptance has either failed or invoked the
      // executor. Terminal work is tracked separately and must drain on close.
      await accepted.catch(()=>{});
    }
    // Page preparation may wait on settings or Git. It must not hold up reception.
    if(!closed && capabilities.pages && !pagePolling) {
      pagePolling=capabilities.pages.poll().catch(()=>{fail();}).finally(()=>{pagePolling=undefined;});
    }
  };
  const poll=():Promise<void>=>{
    if(failure)return Promise.reject(failure);
    if(polling)return polling;
    polling=pollOnce().catch(()=>{fail();throw failure;}).finally(()=>{polling=undefined;});
    return polling;
  };
  return {directory,poll,close, get hasPendingWork(){return !!polling || !!pagePolling || active.size>0 || !!failure || !!capabilities.pages?.hasPendingWork;},async drain(){
    await polling;
    await pagePolling;
    await Promise.all([...active.values()].map(e=>e.done));
    await capabilities.pages?.drain();
    if(failure)throw failure;
  }};
}

// Undefined means there was no owner BEFORE submission. Once submitted, never
// fall back to autonomous execution, even if the plugin exits or a reply is lost.
export async function requestPluginExecution(runtime:string,command:PluginCommand,signal?:AbortSignal,onProgress?:(state:ExecutionSummary)=>void,onSubmitted?:(requestId:string)=>void):Promise<ExecutionSummary|undefined> {
  return requestPluginCommand(runtime,command,signal,onProgress,onSubmitted) as Promise<ExecutionSummary|undefined>;
}
export async function requestPluginWorkflowEdit(runtime:string,command:WorkflowEditCommand):Promise<WorkflowEditResult> {
  const result=await requestPluginCommand(runtime,command);
  if(!result)throw new Error("Enable AutoOC in Obsidian to edit workflows through its owner; do not edit data.json directly");
  return result as WorkflowEditResult;
}
export async function requestPluginPageCreation(runtime:string,request:PageCreationRequest):Promise<PageCreationResult|undefined> {
  return requestPluginCommand(runtime,{command:"create-page",request}) as Promise<PageCreationResult|undefined>;
}
async function requestPluginCommand(runtime:string,command:PluginCommand|WorkflowEditCommand|PageCreationCommand,signal?:AbortSignal,onProgress?:(state:ExecutionSummary)=>void,onSubmitted?:(requestId:string)=>void):Promise<ExecutionSummary|WorkflowEditResult|PageCreationResult|undefined> {
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
    if(command.command==="create-page" && host.pageCreation!==1)throw new Error("Loaded AutoOC does not support page creation; reload a compatible plugin");
    if(command.command==="edit-workflow" && host.workflowEditing!==true)throw new Error("Loaded AutoOC does not support workflow editing; reload the updated plugin once, keeping Obsidian open");
    if('stepId' in command && command.stepId!==undefined && host.codeStepSelection!==true)throw new Error("Loaded AutoOC does not support code step selection; reload the updated plugin before running this step");
    if('pageId' in command && command.pageId!==undefined && host.pageSelection!==1)throw new Error("Loaded AutoOC does not support page selection; reload the updated plugin before running this page");
    if(host.heartbeatAt!==undefined) {
      if(!Number.isFinite(host.heartbeatAt) || host.heartbeatAt>Date.now()+60000 || Date.now()-host.heartbeatAt>30000)
        throw new Error("CLI host heartbeat expired; terminal publication is uncertain");
    }
    process.kill(owner.pid,0);
  };
  check();if(signal?.aborted)throw new Error("CLI request cancelled before submission");
  const id=randomUUID(),submittedAt=Date.now(),expiresAt=submittedAt+30000;
  const file=path.join(directory,id+".request"),resultFile=path.join(directory,id+".receipt");
  if(!validCommand(command))throw new Error("Invalid CLI command");
  if(Buffer.byteLength(JSON.stringify(command),'utf8')>60000)throw new Error("Workflow edit payload exceeds 60KB; split the edit into smaller patches");
  try {await replace(file,{protocol:1,owner:owner.token,id,submittedAt,expiresAt,...command},check,false);}
  catch {throw new PluginRequestError("CLI submission outcome is uncertain; inspect this requestId; do not launch again",id);}
  onSubmitted?.(id);
  let observedPresentation:string|undefined;
  let accepted=false,lastProgress="",runId="runId" in command?command.runId:undefined;
  let outcome:"not-accepted"|"unknown"="unknown";
  for(;;){
    try {
      regularDirectory(directory);
      if(fs.existsSync(resultFile)) {
        const result=read(resultFile);
        if(result.protocol!==1 || result.owner!==owner.token || result.id!==id)throw new Error("CLI receipt identity changed");
        if(!["accepted","running","completed","rejected","failed"].includes(result.status))throw new Error("Invalid CLI receipt status");
        if(result.status==="rejected")outcome="not-accepted";
        const checkpoint=result.checkpoint;
        if(command.command==="create-page"){
          if(result.status==="completed"){
            if(result.pageResult?.requestId!==command.request.requestId || !/^[a-f0-9-]{36}$/.test(result.pageResult?.pageId) || typeof result.pageResult?.created!=="boolean")throw new Error("Invalid page creation receipt");
            return result.pageResult;
          }
          if(result.status==="rejected" || result.status==="failed")throw new Error(result.error);
        }
        if(command.command==="edit-workflow") {
          if(result.status==="completed") {
            if(result.editResult?.workflowId!==command.workflowId || !/^[a-f0-9]{64}$/.test(result.editResult?.definitionHash))throw new Error("Invalid workflow edit receipt");
            return result.editResult;
          }
          if(result.status==="rejected" || result.status==="failed")throw new Error(result.error);
        }
        const expectedWorkflowId = 'pageId' in command && command.pageId ? pageExecutionId(command.pageId,command.taskId || command.workflowId!,!!command.taskId) : command.taskId ? "@task:"+command.taskId : command.workflowId;
        if(checkpoint && (typeof checkpoint.runId!=="string" || !/^[a-zA-Z0-9-]+$/.test(checkpoint.runId) ||
            checkpoint.workflowId!==expectedWorkflowId ||
            "runId" in command && command.runId && checkpoint.runId!==command.runId || !Number.isSafeInteger(checkpoint.revision) || checkpoint.revision<0 ||
            !["ready","in_flight","completed","failed","abandoned"].includes(checkpoint.phase) ||
            !(checkpoint.nextStepId===null || typeof checkpoint.nextStepId==="string")))throw new Error("Invalid CLI receipt checkpoint");
        if(checkpoint) {
          if(runId && checkpoint.runId!==runId)throw new Error("CLI receipt run identity changed");
          const metadata=presentationFields(checkpoint);
          const serializedMetadata=JSON.stringify(metadata);
          if(observedPresentation !== undefined && serializedMetadata !== observedPresentation)throw new Error("CLI receipt presentation changed");
          observedPresentation=serializedMetadata;
          if(metadata.executionKind !== undefined && metadata.executionKind !== (command.taskId ? "task" : "workflow"))throw new Error("CLI receipt execution kind mismatch");
          if(metadata.stepId !== ('stepId' in command ? command.stepId : undefined))throw new Error("CLI receipt code step identity mismatch");
        }
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
      throw new PluginRequestError(`${reason}. Request ${id}${runId ? `, run ${runId}` : ""}; inspect status and receipt using inspect-request or follow with this identity; do not launch again`,id,runId,outcome);
    }
    await new Promise(resolve=>setTimeout(resolve,100));
  }
}

export class PluginRequestError extends Error {
  constructor(message:string,readonly requestId:string,readonly runId?:string,readonly state:"not-accepted"|"unknown"="unknown"){super(message);this.name="PluginRequestError";}
}

export interface RequestInspection {
  state:"not-accepted"|"running"|"finished"|"unknown";
  requestId?:string;runId?:string;requestIds?:string[];
  acceptance:"pending"|"rejected"|"accepted"|"unknown";
  hostAvailable:boolean;receiptStatus?:string;
  checkpoint?:ExecutionSummary;
  resultAvailable?:boolean;
  result?:{phase:RunCheckpoint["phase"];steps:Array<{stepId:string;output?:string;succeeded?:boolean}>};
  timing?:{submittedAt:number;receivedAt:number;queueMs:number};
  diagnostics?:ExecutionTiming[];
  diagnosticsUnavailable?:boolean;
  waitTimedOut?:boolean;interrupted?:boolean;
}
export interface RequestSelector {requestId?:string;runId?:string;includeOutput?:boolean}

function availableHost(root:string,directory:string,owner:string):boolean {
  try {
    const lease=readExecutionLeaseOwner(root),host=read(path.join(directory,"host"));
    if(lease.token!==owner || host.protocol!==1 || host.owner!==owner || host.pid!==lease.pid ||
       !Number.isFinite(host.heartbeatAt) || host.heartbeatAt>Date.now()+60000 || Date.now()-host.heartbeatAt>30000)return false;
    process.kill(lease.pid,0);return true;
  } catch {return false;}
}

// Read every identity from durable evidence, without requiring the old lease to
// remain live. Never repair a receipt, acquire ownership or invoke an executor.
export function inspectPluginRequest(runtime:string,selector:RequestSelector):RequestInspection {
  if(!!selector.requestId===!!selector.runId || selector.requestId!==undefined && !uuid.test(selector.requestId) ||
     selector.runId!==undefined && !/^[a-zA-Z0-9-]{1,256}$/.test(selector.runId))throw new Error("Select exactly one valid requestId or runId");
  const unknown:RequestInspection={state:"unknown",acceptance:"unknown",hostAvailable:false,...(selector.requestId?{requestId:selector.requestId}:{runId:selector.runId})};
  if(!fs.existsSync(runtime))return unknown;
  const root=fs.realpathSync(runtime);regularDirectory(root);
  const matches:Array<{directory:string;owner:string;id:string;request:any;receipt:any}>=[];
  for(const name of fs.readdirSync(root)) {
    if(!name.startsWith("cli-") || !uuid.test(name.slice(4)))continue;
    const directory=path.join(root,name),owner=name.slice(4);regularDirectory(directory);
    const names=selector.requestId ? [selector.requestId+".request"] : fs.readdirSync(directory).filter(n=>n.endsWith(".receipt") && uuid.test(n.slice(0,-8))).map(n=>n.slice(0,-8)+".request");
    for(const file of names) {
      const id=file.slice(0,-8),requestPath=path.join(directory,file),receiptPath=path.join(directory,id+".receipt");
      if(!fs.existsSync(requestPath)) {
        if(selector.requestId && fs.existsSync(receiptPath))throw new Error("CLI receipt has no matching request");
        continue;
      }
      const request=read(requestPath),receipt=fs.existsSync(receiptPath)?read(receiptPath):undefined;
      if(request?.protocol!==1 || request.owner!==owner || request.id!==id || !validCommand(request) || !Number.isFinite(request.expiresAt))throw new Error("Invalid CLI request identity");
      if(receipt && (receipt.protocol!==1 || receipt.owner!==owner || receipt.id!==id || !["accepted","running","completed","rejected","failed"].includes(receipt.status)))throw new Error("Invalid CLI receipt identity");
      const checkpoint=receipt?.checkpoint;
      if(checkpoint) {
        const workflowId=request.pageId ? pageExecutionId(request.pageId,request.taskId || request.workflowId,!!request.taskId) : request.taskId ? "@task:"+request.taskId : request.workflowId;
        if(typeof checkpoint.runId!=="string" || !/^[a-zA-Z0-9-]{1,256}$/.test(checkpoint.runId) || checkpoint.workflowId!==workflowId ||
           request.runId && checkpoint.runId!==request.runId || !Number.isSafeInteger(checkpoint.revision) || checkpoint.revision<0 ||
           !["ready","in_flight","completed","failed","abandoned"].includes(checkpoint.phase) || !(checkpoint.nextStepId===null || typeof checkpoint.nextStepId==="string"))throw new Error("Invalid CLI receipt checkpoint");
        const presentation=presentationFields(checkpoint);
        if(presentation.executionKind!==undefined && presentation.executionKind!==(request.taskId?"task":"workflow") || presentation.stepId!==request.stepId)throw new Error("CLI receipt presentation mismatch");
      }
      if(selector.requestId || (checkpoint?.runId || request.runId)===selector.runId)matches.push({directory,owner,id,request,receipt});
    }
  }
  if(selector.requestId && matches.length>1)throw new Error("Ambiguous CLI request identity");
  // Multiple continuation requests can refer to one run. Prefer the newest
  // request, not the last file enumerated or a historical completed receipt.
  matches.sort((a,b)=>(b.request.submittedAt ?? b.request.expiresAt ?? 0)-(a.request.submittedAt ?? a.request.expiresAt ?? 0));
  const selected=matches[0];
  let result:RequestInspection={...unknown};
  if(selected) {
    const {directory,owner,id,request,receipt}=selected;
    result.requestId=id;result.runId=receipt?.checkpoint?.runId || request.runId;
    if(selector.runId)result.requestIds=matches.map(m=>m.id);
    result.hostAvailable=availableHost(root,directory,owner);
    result.receiptStatus=receipt?.status;
    result.acceptance=!receipt?"pending":receipt.status==="rejected"?"rejected":"accepted";
    result.state=receipt?.status==="rejected"?"not-accepted":receipt?.status==="completed"?"finished":
      receipt && receipt.status!=="failed" && result.hostAvailable?"running":"unknown";
    if(receipt?.checkpoint)result.checkpoint=executionSummary(receipt.checkpoint);
    const timing=receipt?.timing;
    if(timing && [timing.submittedAt,timing.receivedAt,timing.queueMs].every(n=>Number.isFinite(n)&&n>=0))result.timing={submittedAt:timing.submittedAt,receivedAt:timing.receivedAt,queueMs:timing.queueMs};
  }
  if(result.runId && fs.existsSync(path.join(root,result.runId+".json"))) {
    const state=readExecutionCheckpoint(root,result.runId);
    if(result.checkpoint && (state.workflowId!==result.checkpoint.workflowId || state.revision<result.checkpoint.revision))throw new Error("CLI receipt and journal disagree");
    result.checkpoint=executionSummary(state,result.checkpoint);
    const terminal=["completed","failed"].includes(state.phase) && checkpointUncertainties(state).length===0;
    result.resultAvailable=terminal;
    // A journal can recover a terminal result even when receipt publication or
    // its host was lost. An uncertain/abandoned journal never means success.
    if(terminal && (selector.runId || result.acceptance!=="rejected"))result.state="finished";
    else if(!(selector.requestId && result.acceptance==="rejected") && (checkpointUncertainties(state).length>0 || !result.hostAvailable || state.phase==="abandoned"))result.state="unknown";
    if(selector.includeOutput && terminal)result.result={phase:state.phase,steps:state.steps.map(s=>({stepId:s.stepId,output:s.result?.output ?? s.output,succeeded:s.result?.succeeded}))};
  }
  try {result.diagnostics=readExecutionTimings(root,selector);}
  catch {result.diagnosticsUnavailable=true;} // Auxiliary diagnostics cannot hide a durable outcome.
  return result;
}

export async function followPluginRequest(runtime:string,selector:RequestSelector,options:{timeoutMs?:number;signal?:AbortSignal;onProgress?:(result:RequestInspection)=>void}={}):Promise<RequestInspection> {
  const timeout=options.timeoutMs ?? 30000;
  if(!Number.isSafeInteger(timeout) || timeout<0 || timeout>86400000)throw new Error("Follow timeout must be between 0 and 86400000 ms");
  const deadline=performance.now()+timeout;let previous="";
  for(;;) {
    const result=inspectPluginRequest(runtime,selector),serialized=JSON.stringify(result);
    if(serialized!==previous){previous=serialized;options.onProgress?.(result);}
    if(["finished","not-accepted"].includes(result.state))return result;
    if(options.signal?.aborted)return {...result,interrupted:true};
    if(performance.now()>=deadline)return {...result,waitTimedOut:true};
    await new Promise(resolve=>setTimeout(resolve,Math.min(200,Math.max(1,deadline-performance.now()))));
  }
}
