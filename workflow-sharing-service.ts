import {randomUUID} from "crypto";
import {promises as fs} from "fs";
import * as path from "path";
import {ShareStore,shareHash,shareSummary,captureSharePayload,linkedHash,projectAdvertisement,reviewSharedVersion,applySharedVersion,type ShareCatalog,type ShareConnection,type SharePlan,type ShareRevision} from "./workflow-sharing";

export interface SharingHost {
  catalog:()=>ShareCatalog;
  runtimeDirectory:()=>string;
  transaction:<T>(operation:()=>Promise<T>)=>Promise<T>;
  save:(validate?:()=>void)=>Promise<void>;
  assertReady:(plan?:SharePlan)=>void;
  validate:(candidate:ShareCatalog,plan:SharePlan)=>void;
  refresh:()=>void;
  notify:(message:string)=>void;
}
export type SharingRequest = {action:"status"|"connect"|"publish"|"review"|"apply"|"distribute";[key:string]:any};
export interface SharingCommand {command:"share-workflows";request:SharingRequest;workflowId?:never;taskId?:never;pageId?:never;stepId?:never;runId?:never;}
const fields:Record<string,string[]>={status:[],connect:["directory","projectName","allowPush"],publish:["bundleId","workflowIds","taskIds","name","note","expectedParent"],review:["bundleId","revision","hash","mapping"],apply:["bundleId","revision","hash","mapping","reviewHash","replaceLocal","acceptPermissions"],distribute:["bundleId","revision","hash","targets","replaceLocal"]};
const isObject=(v:any)=>!!v&&typeof v==="object"&&!Array.isArray(v);
export function validSharingCommand(v:any):v is SharingCommand {
  const r=v?.request,allowed=fields[r?.action];
  if(v?.command!=="share-workflows"||!isObject(r)||!allowed||Object.keys(r).some(k=>k!=="action"&&!allowed.includes(k))||["workflowId","taskId","pageId","stepId","runId"].some(k=>v[k]!==undefined))return false;
  if(Buffer.byteLength(JSON.stringify(r))>48000)return false;
  if(r.action==="status")return true;
  if(r.action==="connect")return typeof r.directory==="string"&&path.isAbsolute(r.directory)&&typeof r.projectName==="string"&&r.projectName.trim().length>0&&r.projectName.length<=200&&typeof r.allowPush==="boolean";
  const hash=(s:any)=>typeof s==="string"&&/^[a-f0-9]{64}$/.test(s),id=(s:any)=>typeof s==="string"&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(s);
  if(r.action==="publish")return (r.bundleId===undefined||id(r.bundleId))&&(r.expectedParent===null||hash(r.expectedParent))&&typeof r.name==="string"&&!!r.name.trim()&&r.name.length<=200&&typeof r.note==="string"&&!!r.note.trim()&&r.note.length<=2000&&[r.workflowIds,r.taskIds].every(a=>Array.isArray(a)&&a.length<=1000&&a.every(s=>typeof s==="string"&&!!s&&s.length<=256));
  if(!id(r.bundleId)||!Number.isSafeInteger(r.revision)||r.revision<1||!hash(r.hash))return false;
  if(r.action==="distribute")return typeof r.replaceLocal==="boolean"&&Array.isArray(r.targets)&&r.targets.length>0&&r.targets.length<=100&&new Set(r.targets.map((t:any)=>t.projectId)).size===r.targets.length&&r.targets.every((t:any)=>isObject(t)&&Object.keys(t).every(k=>["projectId","localHash"].includes(k))&&id(t.projectId)&&hash(t.localHash));
  if(r.mapping!==undefined&&(!isObject(r.mapping)||Object.keys(r.mapping).length>1000||!Object.entries(r.mapping).every(([k,val])=>/^(task|workflow):[a-f0-9-]{36}$/.test(k)&&typeof val==="string"&&val.length>0&&val.length<=256)))return false;
  return r.action==="review"||hash(r.reviewHash)&&typeof r.replaceLocal==="boolean"&&typeof r.acceptPermissions==="boolean";
}
const summary=shareSummary;

export class WorkflowSharingService {
  private tail:Promise<any>=Promise.resolve();private stopped=false;private polling=false;private notified=new Set<string>();
  lastError="";
  constructor(private host:SharingHost){}
  close(){this.stopped=true;}
  async drain(){await this.tail;}
  private check(){if(this.stopped)throw new Error("Workflow sharing is closed");this.host.assertReady();}
  private serial<T>(operation:()=>Promise<T>):Promise<T> {const task=this.tail.then(()=>{this.check();return operation();});this.tail=task.catch(()=>{});return task;}
  private connection():ShareConnection {const c=this.host.catalog().workflowSharing;if(!c)throw new Error("Connect a shared folder in Settings first");if(c.installationId!==shareHash(path.resolve(this.host.runtimeDirectory())))throw new Error("This connection was copied from another installation; reconnect this project to give it its own identity");return c;}
  private async store():Promise<ShareStore> {const c=this.connection();return ShareStore.connect(c.directory,c.libraryId);}
  private async advertiseSaved(store:ShareStore):Promise<string|undefined> {try{await store.advertise(projectAdvertisement(this.host.catalog()));return undefined;}catch{return "Saved locally; the shared status could not be refreshed. Refresh before distributing.";}}
  private async saveConnection(next:ShareConnection):Promise<void> {
    await this.host.transaction(async()=>{this.check();const c=this.host.catalog(),before=c.workflowSharing;c.workflowSharing=next;const expected=shareHash(next);
      try{await this.host.save(()=>{this.check();if(shareHash(c.workflowSharing)!==expected)throw new Error("Sharing settings changed while saving");});}catch(e){if(c.workflowSharing===next)c.workflowSharing=before;throw e;}
    });
  }
  async execute(request:SharingRequest):Promise<any> {
    if(!validSharingCommand({command:"share-workflows",request}))throw new Error("Invalid sharing request; see CLI help");
    return this.serial(()=>this.executeOwned(request));
  }
  private async executeOwned(r:SharingRequest):Promise<any> {
    if(r.action==="connect") {
      const before=this.host.catalog().workflowSharing,store=await ShareStore.connect(r.directory);
      if(before&&before.libraryId!==store.libraryId&&Object.keys(before.bindings).length)throw new Error("This project already has linked collections in another library");
      const installationId=shareHash(path.resolve(this.host.runtimeDirectory()));
      const next:ShareConnection={directory:store.directory,libraryId:store.libraryId,projectId:before?.libraryId===store.libraryId&&before.installationId===installationId?before.projectId:randomUUID(),installationId,projectName:r.projectName.trim(),allowPush:r.allowPush,bindings:before?.libraryId===store.libraryId?before.bindings:{}};
      await this.saveConnection(next);const warning=await this.advertiseSaved(store);return {action:r.action,connected:true,libraryId:next.libraryId,projectId:next.projectId,warning};
    }
    if(r.action==="status"&&!this.host.catalog().workflowSharing)return {action:"status",connected:false};
    const store=await this.store(),c=this.connection();
    if(r.action==="status")return this.status(store);
    if(r.action==="publish") {
      const binding=r.bundleId?c.bindings[r.bundleId]:undefined;
      if(r.bundleId&&!binding)throw new Error("Link the collection before publishing from this project");
      if((binding?.hash||null)!==r.expectedParent)throw new Error("Review the installed version before publishing");
      const captured=captureSharePayload(this.host.catalog(),r.workflowIds,r.taskIds,binding),before=shareHash(captured),bundleId=r.bundleId||randomUUID();
      for(const other of Object.values(c.bindings))if(other.bundleId!==bundleId)for(const [key,local] of Object.entries(captured.map))if(Object.entries(other.map).some(([k,v])=>k.startsWith(key.split(":")[0]+":")&&v===local))throw new Error("A selected definition already belongs to another collection; publish its existing collection");
      const version=await store.publish({bundleId,expectedParent:r.expectedParent,name:r.name,note:r.note,publisher:c.projectId,payload:captured.payload});
      // Publication is already durable. Never pretend it was rolled back if the local save fails.
      try {
        await this.host.transaction(async()=>{
          this.check();if(this.connection()!==c||shareHash(captureSharePayload(this.host.catalog(),r.workflowIds,r.taskIds,{bundleId,revision:version.revision,hash:version.hash,map:captured.map,baseline:shareHash(captured.payload)}))!==before)throw new Error("Local definitions changed during publication");
          const old=c.bindings,next={...old,[bundleId]:{bundleId,revision:version.revision,hash:version.hash,map:captured.map,baseline:shareHash(captured.payload)}};c.bindings=next;
          try{await this.host.save(()=>{this.check();if(c.bindings!==next)throw new Error("Publication binding changed");});}catch(e){if(c.bindings===next)c.bindings=old;throw e;}
        });
      }catch{throw new Error(`Version ${version.revision} was published (${bundleId}); local linking needs review. Do not publish again; open the library and link this version.`);}
      const warning=await this.advertiseSaved(store);return {action:r.action,published:true,...summary(version),warning};
    }
    const version=await store.version(r.bundleId,r.revision,r.hash);
    if(r.action==="review") {
      const plan=reviewSharedVersion(this.host.catalog(),version,r.mapping);
      return {action:r.action,...summary(version),mapping:plan.map,reviewHash:plan.reviewHash,localHash:plan.localHash,modified:plan.modified,permissions:plan.permissions,changes:plan.changes,dependents:plan.dependents.map(w=>({id:w,name:this.host.catalog().workflows.find(i=>i.id===w)?.name}))};
    }
    if(r.action==="apply") {
      const plan=reviewSharedVersion(this.host.catalog(),version,r.mapping);if(plan.reviewHash!==r.reviewHash)throw new Error("Review changed; review this version again");
      await this.apply(plan,r.replaceLocal,r.acceptPermissions);const warning=await this.advertiseSaved(store);return {action:r.action,applied:true,bundleId:version.bundleId,revision:version.revision,hash:version.hash,warning};
    }
    if(!c.bindings[version.bundleId]||c.bindings[version.bundleId].hash!==version.hash)throw new Error("Install or publish this version here before distributing it");
    const results:any[]=[];
    for(const target of r.targets){this.check();try{const d=await store.send({source:c.projectId,target:target.projectId,bundleId:version.bundleId,revision:version.revision,hash:version.hash,expectedLocalHash:target.localHash,replaceLocal:r.replaceLocal});results.push({projectId:target.projectId,deliveryId:d.id,state:"pending"});}catch(e){results.push({projectId:target.projectId,state:"rejected",message:String((e as Error).message)});}}
    return {action:r.action,deliveries:results};
  }
  private async status(store:ShareStore):Promise<any> {
    const c=this.connection();await store.advertise(projectAdvertisement(this.host.catalog()));
    const collections=await store.heads();
    const projects=await store.projects(),deliveries:any[]=[];
    for(const d of (await store.deliveries()).filter(d=>d.source===c.projectId||d.target===c.projectId).slice(-100))deliveries.push({...d,receipt:await store.receipt(d)});
    return {action:"status",connected:true,connection:{directory:c.directory,libraryId:c.libraryId,projectId:c.projectId,projectName:c.projectName,allowPush:c.allowPush},installed:projectAdvertisement(this.host.catalog()).bindings,collections,projects,deliveries};
  }
  async definitionPreview(bundleId:string,revision:number,hash:string):Promise<ShareRevision>{return this.serial(async()=>{const store=await this.store();return store.version(bundleId,revision,hash);});}
  private async apply(plan:SharePlan,replaceLocal:boolean,acceptPermissions:boolean):Promise<void> {
    await this.host.transaction(async()=>{
      this.check();const catalog=this.host.catalog();
      await applySharedVersion({catalog,assertReady:p=>{this.check();this.host.assertReady(p);},validate:this.host.validate,save:this.host.save,backup:async p=>{
        const directory=path.join(this.host.runtimeDirectory(),"sharing-backups");await fs.mkdir(directory,{recursive:true});const stat=await fs.lstat(directory);if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error("Unsafe sharing backup directory");
        const backup={schema:1,bundleId:p.version.bundleId,revision:p.version.revision,reviewHash:p.reviewHash,createdAt:new Date().toISOString(),binding:catalog.workflowSharing?.bindings[p.version.bundleId],definitions:p.changes.map(change=>({kind:change.kind,item:(change.kind==="task"?catalog.tasks:catalog.workflows).find(i=>i.id===change.id)}))};
        const file=path.join(directory,randomUUID()+".json"),handle=await fs.open(file,"wx",0o600);try{await handle.writeFile(JSON.stringify(backup));await handle.sync();}finally{await handle.close();}
      }},plan,{replaceLocal,acceptPermissions});
    });
    try{this.host.refresh();}catch{/* Persisted success is independent of view refresh. */}
  }
  /** One poll at a time; offline and closed peers keep their delivery pending. */
  async poll():Promise<void> {
    if(this.stopped||this.polling||!this.host.catalog().workflowSharing)return;this.polling=true;
    try{await this.serial(async()=>{
      const store=await this.store(),c=this.connection();await store.advertise(projectAdvertisement(this.host.catalog()));
      for(const version of await store.heads()) {const b=c.bindings[version.bundleId];if(b&&version.revision>b.revision&&!this.notified.has(version.hash)){this.notified.add(version.hash);this.host.notify(`Shared workflows: ${version.name} version ${version.revision} is available. Open Shared workflows to review.`);}}
      for(const d of await store.deliveries(c.projectId)) {
        this.check();const receipt=await store.receipt(d);if(receipt&&receipt.state!=="pending")continue;
        if(!c.allowPush){await store.acknowledge(d,"rejected","Distribution is disabled in the target project");continue;}
        const binding=c.bindings[d.bundleId];if(!binding){await store.acknowledge(d,"review","Link this collection locally first");continue;}
        if(binding.hash===d.hash&&binding.revision===d.revision){await store.acknowledge(d,"applied","Version is installed");continue;}
        try {
          if(linkedHash(this.host.catalog(),binding)!==d.expectedLocalHash){await store.acknowledge(d,"review","Local definitions changed after the sender's review");continue;}
          const version=await store.version(d.bundleId,d.revision,d.hash),plan=reviewSharedVersion(this.host.catalog(),version);
          if(plan.permissions||plan.modified&&!d.replaceLocal){await store.acknowledge(d,"review","Local changes, permissions or engine require review in the target project");continue;}
          try{this.host.assertReady(plan);}catch{if(!receipt)await store.acknowledge(d,"pending","Waiting for affected executions or catalog maintenance");continue;}
          await this.apply(plan,d.replaceLocal,false);await store.acknowledge(d,"applied","Version installed; local settings and history preserved");
        }catch{await store.acknowledge(d,"review","Update needs local review; inspect Shared workflows and the saved catalog before retrying");}
      }
      await store.advertise(projectAdvertisement(this.host.catalog()));this.lastError="";
    });}catch(e){this.lastError=(e as Error).message;}finally{this.polling=false;}
  }
}
