import {createHash, randomUUID} from "crypto";
import {promises as fs} from "fs";
import * as path from "path";
import {workflowClosure} from "./workflow-nesting";
import {findWorkflowEntry, workflowStepTransitions} from "./workflow-routing";

export type ShareKind = "task" | "workflow";
export type ShareItem = {id:string;name:string;[key:string]:any};
export interface ShareCatalog {tasks:ShareItem[];workflows:ShareItem[];workflowSharing?:ShareConnection;[key:string]:any;}
export interface ShareBinding {bundleId:string;revision:number;hash:string;map:Record<string,string>;baseline:string;}
export interface ShareConnection {directory:string;libraryId:string;projectId:string;projectName:string;installationId:string;allowPush:boolean;bindings:Record<string,ShareBinding>;}
export interface SharePayload {tasks:ShareItem[];workflows:ShareItem[];}
export interface ShareRevision {schema:1;libraryId:string;bundleId:string;revision:number;parent:string|null;name:string;note:string;publisher:string;createdAt:string;payload:SharePayload;hash:string;}
export type ShareHead=Omit<ShareRevision,"payload"> & {tasks:Array<{id:string;name:string}>;workflows:Array<{id:string;name:string}>};
export function shareSummary(v:ShareRevision):ShareHead {const {payload,...metadata}=v;return {...metadata,tasks:payload.tasks.map(t=>({id:t.id,name:t.name})),workflows:payload.workflows.map(w=>({id:w.id,name:w.name}))};}
export interface ShareProject {schema:1;libraryId:string;projectId:string;name:string;allowPush:boolean;updatedAt:string;bindings:Array<{bundleId:string;revision:number;hash:string;localHash:string;modified:boolean}>;}
export interface ShareDelivery {schema:1;libraryId:string;id:string;source:string;target:string;bundleId:string;revision:number;hash:string;expectedLocalHash:string;replaceLocal:boolean;createdAt:string;}
export interface ShareReceipt {schema:1;id:string;target:string;state:"applied"|"pending"|"review"|"rejected";message:string;updatedAt:string;}
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const digest=/^[a-f0-9]{64}$/;
const MAX_BYTES=16*1024*1024;
const TASK_FIELDS="name area taskKind cliProvider prompt code codeLang codeInputVar codeOutputVar codeAllowVault codeAllowFiles codeAllowTerminal copilotAllowAllTools requiresAutoOCSecrets useRalphLoop interactiveTerminal concurrency".split(" ");
const WORKFLOW_FIELDS="name area description handoffBranch handoffOutput concurrency requiresAutoOCSecrets".split(" ");
const STEP_FIELDS="id name area stepKind taskId workflowId transitionMode evaluatePrompt forceContinue delayValue delayUnit code codeLang codeInputVar codeOutputVar codeAllowVault codeAllowFiles codeAllowTerminal requiresAutoOCSecrets disabled position".split(" ");
const EDGE_FIELDS="toStepId mode evaluatePrompt condition conditionLang forceContinue".split(" ");
const RIGHTS="codeAllowVault codeAllowFiles codeAllowTerminal copilotAllowAllTools requiresAutoOCSecrets handoffBranch interactiveTerminal".split(" ");
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
function canonical(v:any):any {return Array.isArray(v)?v.map(canonical):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,canonical(v[k])])):v;}
export function shareHash(v:any):string {return createHash("sha256").update(JSON.stringify(canonical(v))).digest("hex");}
function pick(v:any,fields:string[]):any {return Object.fromEntries(fields.filter(k=>v[k]!==undefined).map(k=>[k,clone(v[k])]));}
function id(v:string):string {if(!uuid.test(v))throw new Error("Invalid shared identity");return v;}
function boundedText(v:any,label:string,max=200):string {if(typeof v!=="string"||!v.trim()||v.length>max)throw new Error(`Invalid ${label}`);return v;}
export const shareKey=(kind:ShareKind,identity:string)=>`${kind}:${identity}`;
const entries=(p:SharePayload):Array<{kind:ShareKind;item:ShareItem}>=>[...p.tasks.map(item=>({kind:"task" as const,item})),...p.workflows.map(item=>({kind:"workflow" as const,item}))];
const list=(c:ShareCatalog|SharePayload,k:ShareKind)=>k==="task"?c.tasks:c.workflows;
function unique(c:ShareCatalog|SharePayload,k:ShareKind,identity:string):ShareItem {const found=list(c,k).filter(i=>i.id===identity);if(found.length!==1)throw new Error(`Missing or ambiguous ${k}: ${identity}`);return found[0];}

/** Allowlisted definitions only. Runtime data and local execution preferences never leave the project. */
export function portableItem(item:ShareItem,kind:ShareKind,identity=item.id,refs:Record<string,string>={}):ShareItem {
  const result={id:identity,...pick(item,kind==="task"?TASK_FIELDS:WORKFLOW_FIELDS)};
  if(kind==="task")result.taskKind ||= "opencode";
  else result.steps=(item.steps||[]).map((step:any)=>{
    const out=pick(step,STEP_FIELDS);out.stepKind ||= "task";
    if(out.taskId)out.taskId=refs[shareKey("task",out.taskId)]||out.taskId;
    if(out.workflowId)out.workflowId=refs[shareKey("workflow",out.workflowId)]||out.workflowId;
    if(step.transitions!==undefined)out.transitions=step.transitions.map((edge:any)=>pick(edge,EDGE_FIELDS));
    return out;
  });
  return result;
}
export function validateSharePayload(payload:SharePayload):void {
  if(!payload||!Array.isArray(payload.tasks)||!Array.isArray(payload.workflows)||!entries(payload).length||entries(payload).length>1000)throw new Error("Invalid shared collection (1–1000 definitions required)");
  for(const kind of ["task","workflow"] as const) {
    const ids=new Set<string>();
    for(const item of list(payload,kind)) {
      if(!item||!uuid.test(item.id)||ids.has(item.id))throw new Error("Invalid or duplicate shared identity");ids.add(item.id);
      boundedText(item.name,"definition name");
      if(shareHash(item)!==shareHash(portableItem(item,kind)))throw new Error("Unsupported or private fields in shared definition");
      for(const field of RIGHTS)if(item[field]!==undefined&&typeof item[field]!=="boolean")throw new Error("Invalid shared permissions");
      if(kind==="task"&&!['opencode','opencode2','codex','copilot','code','cli'].includes(item.taskKind))throw new Error("Unsupported shared task engine");
      if(kind==="workflow") {
        if(!Array.isArray(item.steps)||!item.steps.length||item.steps.length>1000)throw new Error("Invalid shared workflow steps");
        workflowClosure(item as any,payload.workflows as any);findWorkflowEntry(item.steps);
        const steps=new Set(item.steps.map((s:any)=>s.id));
        item.steps.forEach((s:any,i:number)=>{
          if(!["task","code","delay","workflow"].includes(s.stepKind))throw new Error("Unsupported shared step");
          if(s.stepKind==="task")unique(payload,"task",s.taskId);
          if(s.stepKind==="workflow")unique(payload,"workflow",s.workflowId);
          for(const field of RIGHTS)if(s[field]!==undefined&&typeof s[field]!=="boolean")throw new Error("Invalid shared step permissions");
          for(const edge of workflowStepTransitions(item.steps,i))if(!steps.has(edge.toStepId))throw new Error("Shared transition points to a missing step");
        });
      }
    }
  }
  if(Buffer.byteLength(JSON.stringify(payload))>MAX_BYTES-65536)throw new Error("Shared collection exceeds 16 MiB; split the collection");
}
export function captureSharePayload(catalog:ShareCatalog,workflowIds:string[],taskIds:string[],binding?:ShareBinding):{payload:SharePayload;map:Record<string,string>} {
  const workflows=new Map<string,ShareItem>(),tasks=new Set(taskIds);
  for(const wid of workflowIds){const w=unique(catalog,"workflow",wid);for(const child of [w,...workflowClosure(w as any,catalog.workflows as any)])workflows.set(child.id,child as ShareItem);}
  for(const w of workflows.values())for(const s of w.steps)if((s.stepKind||"task")==="task")tasks.add(s.taskId);
  const selected=[...Array.from(tasks).map(tid=>({kind:"task" as const,item:unique(catalog,"task",tid)})),...Array.from(workflows.values()).map(item=>({kind:"workflow" as const,item}))];
  const map:Record<string,string>={},reverse:Record<string,string>={};
  for(const {kind,item} of selected){const key=Object.keys(binding?.map||{}).find(k=>k.startsWith(kind+":")&&binding!.map[k]===item.id)||shareKey(kind,randomUUID());map[key]=item.id;reverse[shareKey(kind,item.id)]=key.slice(kind.length+1);}
  if(binding&&Object.keys(binding.map).some(k=>!map[k]))throw new Error("This pilot retains all linked definitions; unlink a collection before removing its members");
  const payload:SharePayload={tasks:[],workflows:[]};
  for(const {kind,item} of selected)list(payload,kind).push(portableItem(item,kind,reverse[shareKey(kind,item.id)],reverse));
  payload.tasks.sort((a,b)=>a.id.localeCompare(b.id));payload.workflows.sort((a,b)=>a.id.localeCompare(b.id));validateSharePayload(payload);
  return {payload,map};
}
export function linkedPayload(catalog:ShareCatalog,binding:ShareBinding):SharePayload {
  const reverse=Object.fromEntries(Object.entries(binding.map).map(([k,v])=>[shareKey(k.startsWith("task:")?"task":"workflow",v),k.slice(k.indexOf(":")+1)]));
  const result:SharePayload={tasks:[],workflows:[]};
  for(const [key,local] of Object.entries(binding.map)){const kind=key.startsWith("task:")?"task":"workflow";list(result,kind).push(portableItem(unique(catalog,kind,local),kind,key.slice(kind.length+1),reverse));}
  result.tasks.sort((a,b)=>a.id.localeCompare(b.id));result.workflows.sort((a,b)=>a.id.localeCompare(b.id));return result;
}
export function linkedHash(catalog:ShareCatalog,binding:ShareBinding):string {return shareHash(linkedPayload(catalog,binding));}
export function projectAdvertisement(catalog:ShareCatalog):ShareProject {
  const c=catalog.workflowSharing!;
  return {schema:1,libraryId:c.libraryId,projectId:c.projectId,name:c.projectName,allowPush:c.allowPush,updatedAt:new Date().toISOString(),bindings:Object.values(c.bindings).map(b=>{
    let localHash="";try{localHash=linkedHash(catalog,b);}catch{/* Missing local definitions require local review. */}
    return {bundleId:b.bundleId,revision:b.revision,hash:b.hash,localHash,modified:localHash!==b.baseline};
  })};
}
function revisionHash(v:ShareRevision):string {const {hash,...rest}=v;return shareHash(rest);}
function validateRevision(v:ShareRevision,libraryId:string,bundleId?:string,revision?:number):void {
  if(v?.schema!==1||v.libraryId!==libraryId||!uuid.test(v.bundleId)||bundleId&&v.bundleId!==bundleId||!Number.isSafeInteger(v.revision)||v.revision<1||revision&&v.revision!==revision||!uuid.test(v.publisher)||!(v.parent===null||digest.test(v.parent))||v.hash!==revisionHash(v))throw new Error("Invalid or changed shared version");
  boundedText(v.name,"collection name");boundedText(v.note,"release note",2000);validateSharePayload(v.payload);
}

/** Filesystem transport. Immutable versions + exclusive publication lock. No lock stealing. */
export class ShareStore {
  private constructor(readonly directory:string,readonly libraryId:string){}
  static async connect(directory:string,expectedId?:string):Promise<ShareStore> {
    if(!path.isAbsolute(directory)||directory.includes("\0"))throw new Error("Choose an absolute shared folder");
    if(!expectedId)await fs.mkdir(directory,{recursive:true});
    const stat=await fs.lstat(directory);if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error("Shared folder must be a real directory");
    const root=await fs.realpath(directory),file=path.join(root,"autooc-library.json");
    if(!expectedId){try{await fs.writeFile(file,JSON.stringify({schema:1,id:randomUUID()}),{flag:"wx",mode:0o600});}catch(e){if((e as any).code!=="EEXIST")throw e;}}
    const manifest=await ShareStore.read(file);
    if(manifest.schema!==1||!uuid.test(manifest.id)||expectedId&&manifest.id!==expectedId)throw new Error("Shared library identity changed");
    return new ShareStore(root,manifest.id);
  }
  private static async read(file:string):Promise<any> {
    const handle=await fs.open(file,"r");try{const s=await handle.stat(),l=await fs.lstat(file);if(!s.isFile()||l.isSymbolicLink()||s.nlink!==1||s.size>MAX_BYTES)throw new Error("Unsafe or oversized shared file");const bytes=await handle.readFile();if(bytes.length>MAX_BYTES)throw new Error("Shared file exceeds 16 MiB");return JSON.parse(bytes.toString("utf8"));}finally{await handle.close();}
  }
  private async check():Promise<void> {const s=await fs.lstat(this.directory);if(!s.isDirectory()||s.isSymbolicLink()||(await ShareStore.read(path.join(this.directory,"autooc-library.json"))).id!==this.libraryId)throw new Error("Shared library identity changed");}
  private async folder(name:string):Promise<string> {await this.check();const dir=path.join(this.directory,name);try{await fs.mkdir(dir);}catch(e){if((e as any).code!=="EEXIST")throw e;}const s=await fs.lstat(dir);if(!s.isDirectory()||s.isSymbolicLink())throw new Error("Unsafe shared directory");return dir;}
  private async replace(folder:string,name:string,value:any):Promise<void> {
    const dir=await this.folder(folder),target=path.join(dir,name),temp=path.join(dir,randomUUID()+".tmp");const bytes=JSON.stringify(value);
    if(Buffer.byteLength(bytes)>MAX_BYTES)throw new Error("Shared record exceeds 16 MiB");
    const h=await fs.open(temp,"wx",0o600);try{await h.writeFile(bytes);await h.sync();}finally{await h.close();}
    try{await this.check();await fs.rename(temp,target);}finally{await fs.unlink(temp).catch(()=>{});}
  }
  private async readRecord(folder:string,name:string):Promise<any|undefined>{const dir=await this.folder(folder);try{return await ShareStore.read(path.join(dir,name));}catch(e){if((e as any).code==="ENOENT")return undefined;throw e;}}
  private async records(folder:string):Promise<any[]> {const dir=await this.folder(folder),names=(await fs.readdir(dir)).filter(n=>n.endsWith(".json"));if(names.length>2000)throw new Error("Shared folder needs archival (more than 2000 records)");const result:any[]=[];for(const n of names){if(!/^[a-f0-9-]+\.json$/.test(n))throw new Error("Invalid shared record name");result.push(await ShareStore.read(path.join(dir,n)));}return result;}
  async heads():Promise<ShareHead[]> {
    const values=await this.records("heads");
    for(const v of values)if(v.schema!==1||v.libraryId!==this.libraryId||!uuid.test(v.bundleId)||!digest.test(v.hash)||!Number.isSafeInteger(v.revision)||v.revision<1||typeof v.name!=="string"||typeof v.note!=="string"||![v.tasks,v.workflows].every(items=>Array.isArray(items)&&items.length<=1000&&items.every((i:any)=>uuid.test(i.id)&&typeof i.name==="string")))throw new Error("Invalid shared collection index");
    return values;
  }
  async latest(bundleId:string):Promise<ShareRevision|undefined> {id(bundleId);const head=(await this.heads()).find(v=>v.bundleId===bundleId);return head?this.version(bundleId,head.revision,head.hash):undefined;}
  async version(bundleId:string,revision:number,hash:string):Promise<ShareRevision> {
    id(bundleId);if(!Number.isSafeInteger(revision)||revision<1||!digest.test(hash))throw new Error("Invalid shared version selector");
    const v=await this.readRecord("versions",`${bundleId}-${revision}.json`);if(!v)throw new Error("Shared version is missing");validateRevision(v,this.libraryId,bundleId,revision);if(v.hash!==hash)throw new Error("Shared version changed");return v;
  }
  async publish(input:{bundleId:string;expectedParent:string|null;name:string;note:string;publisher:string;payload:SharePayload}):Promise<ShareRevision> {
    id(input.bundleId);id(input.publisher);validateSharePayload(input.payload);boundedText(input.name,"collection name");boundedText(input.note,"release note",2000);
    await this.check();const lock=path.join(this.directory,"publish.lock");
    try{await fs.mkdir(lock);}catch(e){if((e as any).code==="EEXIST")throw new Error("A publication is in progress or interrupted; inspect publish.lock before retrying");throw e;}
    try {
      const previous=await this.latest(input.bundleId);if((previous?.hash||null)!==input.expectedParent)throw new Error("A newer version exists; review it before publishing");
      const value:ShareRevision={schema:1,libraryId:this.libraryId,bundleId:input.bundleId,revision:(previous?.revision||0)+1,parent:input.expectedParent,name:input.name.trim(),note:input.note.trim(),publisher:input.publisher,createdAt:new Date().toISOString(),payload:clone(input.payload),hash:""};value.hash=revisionHash(value);
      if(await this.readRecord("versions",`${value.bundleId}-${value.revision}.json`))throw new Error("Shared version already exists; publication is never overwritten");
      await this.replace("versions",`${value.bundleId}-${value.revision}.json`,value);
      await this.replace("heads",value.bundleId+".json",shareSummary(value));return value;
    }finally{await fs.rmdir(lock);}
  }
  async advertise(project:ShareProject):Promise<void> {id(project.projectId);if(project.libraryId!==this.libraryId)throw new Error("Wrong project library");await this.replace("projects",project.projectId+".json",project);}
  async projects():Promise<ShareProject[]> {const values=await this.records("projects");for(const v of values)if(v.schema!==1||v.libraryId!==this.libraryId||!uuid.test(v.projectId)||typeof v.name!=="string"||typeof v.allowPush!=="boolean"||!Array.isArray(v.bindings))throw new Error("Invalid project advertisement");return values;}
  async send(input:Omit<ShareDelivery,"schema"|"libraryId"|"id"|"createdAt">):Promise<ShareDelivery> {
    id(input.source);id(input.target);id(input.bundleId);if(!digest.test(input.expectedLocalHash)||typeof input.replaceLocal!=="boolean")throw new Error("Review the target's current definitions before distribution");
    await this.version(input.bundleId,input.revision,input.hash);
    const project=(await this.projects()).find(p=>p.projectId===input.target),binding=project?.bindings.find(b=>b.bundleId===input.bundleId);
    if(!project?.allowPush||!binding||binding.localHash!==input.expectedLocalHash)throw new Error("Target is not linked, does not allow distribution, or changed; refresh it first");
    if(binding.modified&&!input.replaceLocal)throw new Error("Target has local changes; explicitly select replacement");
    const d:ShareDelivery={...input,schema:1,libraryId:this.libraryId,id:randomUUID(),createdAt:new Date().toISOString()};await this.replace("deliveries",d.id+".json",d);return d;
  }
  async deliveries(target?:string):Promise<ShareDelivery[]> {const values=await this.records("deliveries");for(const d of values)if(d.schema!==1||d.libraryId!==this.libraryId||![d.id,d.source,d.target,d.bundleId].every(v=>uuid.test(v))||!digest.test(d.hash)||!digest.test(d.expectedLocalHash)||!Number.isSafeInteger(d.revision)||d.revision<1||typeof d.replaceLocal!=="boolean")throw new Error("Invalid distribution request");return values.filter(d=>!target||d.target===target);}
  async receipt(delivery:ShareDelivery):Promise<ShareReceipt|undefined> {const r=await this.readRecord("receipts",id(delivery.id)+".json");if(r&&(r.schema!==1||r.id!==delivery.id||r.target!==delivery.target||!["applied","pending","review","rejected"].includes(r.state)))throw new Error("Invalid distribution receipt");return r;}
  async acknowledge(d:ShareDelivery,state:ShareReceipt["state"],message:string):Promise<void> {await this.replace("receipts",id(d.id)+".json",{schema:1,id:d.id,target:d.target,state,message:message.slice(0,500),updatedAt:new Date().toISOString()});}
}

export interface SharePlan {version:ShareRevision;map:Record<string,string>;reviewHash:string;localHash:string;modified:boolean;permissions:boolean;changes:Array<{kind:ShareKind;id:string;name:string;action:"create"|"replace"|"unchanged"}>;dependents:string[];}
export function reviewSharedVersion(catalog:ShareCatalog,version:ShareRevision,mapping:Record<string,string>={}):SharePlan {
  const c=catalog.workflowSharing;if(!c||c.libraryId!==version.libraryId)throw new Error("Connect this project to the collection's library first");
  validateRevision(version,c.libraryId);const binding=c.bindings[version.bundleId],map:Record<string,string>={};
  if(binding&&version.revision<binding.revision)throw new Error("An older version cannot replace a newer installation; publish a new revision to revert");
  if(binding&&version.revision===binding.revision&&version.hash!==binding.hash)throw new Error("Installed version identity changed");
  if(binding&&Object.keys(binding.map).some(k=>!entries(version.payload).some(({kind,item})=>shareKey(kind,item.id)===k)))throw new Error("Collection removal requires local review; pilot does not delete definitions");
  for(const key of Object.keys(mapping))if(!entries(version.payload).some(({kind,item})=>shareKey(kind,item.id)===key))throw new Error("Unknown explicit mapping");
  let permissions=false;const changes:SharePlan["changes"]=[],before:any[]=[];
  for(const {kind,item} of entries(version.payload)) {
    const key=shareKey(kind,item.id),known=binding?.map[key],explicit=mapping[key];
    if(known&&explicit&&known!==explicit)throw new Error("A linked identity cannot be remapped");
    const generated="shared-"+shareHash([c.projectId,version.bundleId,key]).slice(0,32),local=known||explicit||generated;
    if(Object.entries(map).some(([k,v])=>k.startsWith(kind+":")&&v===local))throw new Error("Two definitions cannot replace the same local identity");
    for(const b of Object.values(c.bindings))if(b.bundleId!==version.bundleId&&b.map[key]===local||b.bundleId!==version.bundleId&&Object.entries(b.map).some(([k,v])=>k.startsWith(kind+":")&&v===local))throw new Error("Definition already belongs to another collection");
    const old=list(catalog,kind).find(i=>i.id===local);
    if((known||explicit&&explicit!==generated)&&!old)throw new Error("Linked definition is missing; review it locally");
    if(!known&&!explicit&&old)throw new Error("Unlinked deterministic identity already exists");
    if(!old&&!known&&list(catalog,kind).some(i=>i.name===item.name))throw new Error(`Choose the existing ${kind} explicitly to avoid duplicating ${item.name}`);
    map[key]=local;before.push([key,old||null]);
    const changed=!old||shareHash(portableItem(old,kind,item.id))!==shareHash(item);
    const raised=(a:any,b:any)=>RIGHTS.some(k=>a[k]===true&&b?.[k]!==true);
    if(raised(item,old)||kind==="task"&&(!old||item.taskKind!==(old.taskKind||"opencode")||item.cliProvider!==old.cliProvider))permissions=true;
    if(kind==="workflow")for(const step of item.steps)if(raised(step,old?.steps?.find((s:any)=>s.id===step.id)))permissions=true;
    changes.push({kind,id:local,name:item.name,action:!old?"create":changed?"replace":"unchanged"});
  }
  const affectedTasks=new Set(changes.filter(v=>v.kind==="task").map(v=>v.id)),affectedWorkflows=new Set(changes.filter(v=>v.kind==="workflow").map(v=>v.id));
  let expanded=true;while(expanded){expanded=false;for(const w of catalog.workflows)if(!affectedWorkflows.has(w.id)&&w.steps?.some((s:any)=>affectedTasks.has(s.taskId)||affectedWorkflows.has(s.workflowId))){affectedWorkflows.add(w.id);expanded=true;}}
  const dependents=[...affectedWorkflows].filter(w=>!changes.some(v=>v.kind==="workflow"&&v.id===w));
  const reverse=Object.fromEntries(Object.entries(map).map(([key,local])=>[shareKey(key.startsWith("task:")?"task":"workflow",local),key.slice(key.indexOf(":")+1)]));
  for(const {kind,item} of entries(version.payload)){
    const change=changes.find(c=>c.kind===kind&&c.id===map[shareKey(kind,item.id)])!;
    if(change.action!=="create")change.action=shareHash(portableItem(unique(catalog,kind,change.id),kind,item.id,reverse))===shareHash(item)?"unchanged":"replace";
  }
  const localHash=binding?linkedHash(catalog,binding):shareHash(before);
  return {version,map,localHash,modified:!!binding&&localHash!==binding.baseline,permissions,changes,dependents,reviewHash:shareHash({version:version.hash,connection:{...c,bindings:c.bindings},before,map,dependents:dependents.map(w=>portableItem(unique(catalog,"workflow",w),"workflow"))})};
}
export function sharedCandidate(catalog:ShareCatalog,plan:SharePlan):ShareCatalog {
  const next={...catalog,tasks:[...catalog.tasks],workflows:[...catalog.workflows],workflowSharing:clone(catalog.workflowSharing!)};
  for(const {kind,item} of entries(plan.version.payload)) {
    const local=plan.map[shareKey(kind,item.id)],old=list(catalog,kind).find(i=>i.id===local),fresh:any={...(old||{id:local,status:"pending",createdAt:new Date().toISOString(),scheduleType:"manual",disabled:true,model:"",agent:"",output:"",lastRun:""})};
    for(const field of kind==="task"?TASK_FIELDS:WORKFLOW_FIELDS)delete fresh[field];
    Object.assign(fresh,pick(item,kind==="task"?TASK_FIELDS:WORKFLOW_FIELDS));
    if(kind==="workflow")fresh.steps=item.steps.map((s:any)=>{
      const prior=old?.steps?.find((p:any)=>p.id===s.id),step={...(prior||{status:"pending"})};
      for(const field of [...STEP_FIELDS,"transitions"])delete step[field];Object.assign(step,clone(s));
      if(step.taskId)step.taskId=plan.map[shareKey("task",step.taskId)];
      if(step.workflowId)step.workflowId=plan.map[shareKey("workflow",step.workflowId)];return step;
    });
    const target=list(next,kind),index=target.findIndex(i=>i.id===local);if(index<0)target.push(fresh);else target[index]=fresh;
  }
  const binding:ShareBinding={bundleId:plan.version.bundleId,revision:plan.version.revision,hash:plan.version.hash,map:plan.map,baseline:""};binding.baseline=linkedHash(next,binding);next.workflowSharing!.bindings[binding.bundleId]=binding;return next;
}

export interface ShareApplyHost {catalog:ShareCatalog;assertReady:(plan:SharePlan)=>void;validate:(candidate:ShareCatalog,plan:SharePlan)=>void;backup:(plan:SharePlan)=>Promise<void>;save:(validate:()=>void)=>Promise<void>;}
/** Caller owns the catalog transaction and pauses admission for the short save boundary. */
export async function applySharedVersion(host:ShareApplyHost,plan:SharePlan,options:{replaceLocal:boolean;acceptPermissions:boolean}):Promise<ShareBinding> {
  const current=reviewSharedVersion(host.catalog,plan.version,plan.map);
  if(current.reviewHash!==plan.reviewHash)throw new Error("Definitions changed since review; review again");
  if(current.modified&&!options.replaceLocal)throw new Error("Local changes require explicit replacement");
  if(current.permissions&&!options.acceptPermissions)throw new Error("New permissions or engine require review in this project");
  host.assertReady(current);const next=sharedCandidate(host.catalog,current);host.validate(next,current);await host.backup(current);
  if(reviewSharedVersion(host.catalog,plan.version,plan.map).reviewHash!==plan.reviewHash)throw new Error("Definitions changed while preparing backup");
  host.assertReady(current);
  const c=host.catalog,old={tasks:c.tasks,workflows:c.workflows,workflowSharing:c.workflowSharing};Object.assign(c,next);
  const savedConnection=shareHash(c.workflowSharing);
  const installed=current.changes.map(change=>({...change,item:unique(c,change.kind,change.id),fingerprint:shareHash(unique(c,change.kind,change.id))}));
  const validate=()=>{host.assertReady(current);if(shareHash(c.workflowSharing)!==savedConnection||installed.some(i=>shareHash(unique(c,i.kind,i.id))!==i.fingerprint))throw new Error("Shared definitions changed during save");};
  try{await host.save(validate);}catch(e){
    // Restore only unchanged replacements owned by this operation. Preserve any
    // later editor changes and unrelated additions, even when the save failed.
    for(const kind of ["task","workflow"] as const){
      const restore=list(c,kind).flatMap(item=>{const ours=installed.find(i=>i.kind===kind&&i.id===item.id);if(!ours||item!==ours.item||shareHash(item)!==ours.fingerprint)return [item];const prior=(kind==="task"?old.tasks:old.workflows).find(i=>i.id===item.id);return prior?[prior]:[];});
      if(kind==="task")c.tasks=restore;else c.workflows=restore;
    }
    if(c.workflowSharing===next.workflowSharing&&shareHash(c.workflowSharing)===savedConnection)c.workflowSharing=old.workflowSharing;
    throw e;
  }
  return c.workflowSharing!.bindings[plan.version.bundleId];
}
