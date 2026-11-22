import {App,Modal,Setting,Notice} from "obsidian";
import {WorkflowSharingService,type SharingRequest} from "./workflow-sharing-service";
import {shareKey,portableItem,type ShareCatalog} from "./workflow-sharing";

export interface SharingUiHost {catalog:()=>ShareCatalog;service:()=>WorkflowSharingService;}
export class WorkflowSharingModal extends Modal {
  private closed=false;private busy=false;private generation=0;private message?:HTMLElement;
  constructor(app:App,private host:SharingUiHost){super(app);}
  onOpen(){this.modalEl.style.width="min(960px, 95vw)";this.modalEl.style.maxHeight="90vh";this.contentEl.style.overflowY="auto";void this.home();}
  onClose(){this.closed=true;this.generation++;}
  private begin(title:string){this.generation++;this.contentEl.empty();this.contentEl.createEl("h2",{text:title});this.message=this.contentEl.createEl("p",{attr:{role:"status"}});}
  private button(parent:HTMLElement,label:string,action:()=>Promise<void>|void){const b=parent.createEl("button",{text:label});b.onclick=()=>{if(this.busy||this.closed)return;this.busy=true;b.disabled=true;const generation=this.generation;Promise.resolve().then(action).catch(e=>{if(!this.closed&&generation===this.generation)this.message!.setText((e as Error).message);else if(!this.closed)new Notice((e as Error).message);}).finally(()=>{this.busy=false;if(b.isConnected)b.disabled=false;});};return b;}
  private async call(request:SharingRequest){return this.host.service().execute(request);}
  private async home(){
    const generation=this.generation;let status:any;
    try{status=await this.call({action:"status"});}catch(e){status={connected:!!this.host.catalog().workflowSharing,error:(e as Error).message};}
    if(this.closed||generation!==this.generation)return;
    this.begin("Shared workflows · Pilot");
    this.contentEl.createEl("p",{text:"Publish tested changes here, then update linked projects. Local models, folders, schedules and history stay in each project."});
    const c=this.host.catalog().workflowSharing;
    if(c)this.contentEl.createEl("p",{text:`${c.projectName} · ${c.directory}`});
    this.button(this.contentEl,c?"Connection settings":"Connect shared folder",()=>this.connection());
    if(!status.connected)return;
    this.button(this.contentEl,"Refresh",()=>this.home());this.button(this.contentEl,"Publish a collection",()=>this.publish());
    if(status.error){this.message!.setText(status.error);return;}
    for(const v of status.collections){
      const row=this.contentEl.createEl("section");row.createEl("h3",{text:`${v.name} · v${v.revision}`});
      const installed=status.installed.find((b:any)=>b.bundleId===v.bundleId);
      row.createEl("p",{text:`${v.note} · ${v.tasks.length} tasks, ${v.workflows.length} workflows. ${installed?`Installed v${installed.revision}${installed.modified?" · local changes":""}`:"Not linked"}`});
      this.button(row,installed?"Review / update":"Link / import",()=>this.review(v));
      if(installed){this.button(row,"Publish local improvements",()=>this.publish(v));this.button(row,"Apply to other projects…",()=>this.distribute(v,status));}
    }
    if(!status.collections.length)this.contentEl.createEl("p",{text:"No collections published. Publish the first one from the source project."});
    if(status.deliveries.length){this.contentEl.createEl("h3",{text:"Distribution receipts"});for(const d of status.deliveries.slice(-20)){const target=status.projects.find((p:any)=>p.projectId===d.target);this.contentEl.createEl("p",{text:`${target?.name||d.target} · v${d.revision} · ${d.receipt?.state||"pending"}${d.receipt?.message?": "+d.receipt.message:""}`});}}
    this.contentEl.createEl("p",{text:"Closed projects remain pending until their plugin opens. Refresh to see receipts. Network access uses the selected shared folder; no server is opened.",cls:"setting-item-description"});
  }
  private connection(){
    this.begin("Shared folder connection");const current=this.host.catalog().workflowSharing;let directory=current?.directory||"",projectName=current?.projectName||"",allowPush=current?.allowPush||false;
    this.contentEl.createEl("p",{text:"Use the same local folder or network share in both projects. Anyone able to write there can publish workflow code. Connect only a folder you trust."});
    new Setting(this.contentEl).setName("Shared folder (absolute path)").addText(t=>t.setValue(directory).onChange(v=>directory=v));
    new Setting(this.contentEl).setName("Project display name").addText(t=>t.setValue(projectName).onChange(v=>projectName=v));
    new Setting(this.contentEl).setName("Allow distribution from linked projects").setDesc("Allows reviewed versions to be applied here. New permissions and engine changes still require local review.").addToggle(t=>t.setValue(allowPush).onChange(v=>allowPush=v));
    this.button(this.contentEl,"Connect trusted folder",async()=>{await this.call({action:"connect",directory,projectName,allowPush});await this.home();});this.button(this.contentEl,"Back",()=>this.home());
  }
  private publish(existing?:any){
    this.begin(existing?"Publish local improvements":"Publish a collection");const catalog=this.host.catalog(),binding=existing?catalog.workflowSharing?.bindings[existing.bundleId]:undefined;
    let name=existing?.name||"",note="";const taskIds=new Set<string>(),workflowIds=new Set<string>();
    if(binding)for(const [key,local] of Object.entries(binding.map))(key.startsWith("task:")?taskIds:workflowIds).add(local);
    this.contentEl.createEl("p",{text:"Select definitions you have tested. Dependent tasks and child workflows are included. Definitions are published, never executed by publishing. Prompts and code are shared as written: check them for private paths or embedded secrets."});
    new Setting(this.contentEl).setName("Collection name").addText(t=>t.setValue(name).onChange(v=>name=v));
    new Setting(this.contentEl).setName("What changed?").addTextArea(t=>t.onChange(v=>note=v));
    for(const [kind,items,set] of [["Workflow",catalog.workflows,workflowIds],["Task",catalog.tasks,taskIds]] as const){
      this.contentEl.createEl("h3",{text:kind+"s"});for(const item of items)new Setting(this.contentEl).setName(item.name).addToggle(t=>t.setValue(set.has(item.id)).setDisabled(!!binding&&set.has(item.id)).onChange(v=>v?set.add(item.id):set.delete(item.id)));
    }
    this.button(this.contentEl,"Publish version",async()=>{const result=await this.call({action:"publish",...(existing?{bundleId:existing.bundleId}:{}),expectedParent:binding?.hash||null,name,note,taskIds:[...taskIds],workflowIds:[...workflowIds]});new Notice(`Published ${result.name} v${result.revision}`);await this.home();});this.button(this.contentEl,"Back",()=>this.home());
  }
  private async review(v:any){
    const revision=await this.host.service().definitionPreview(v.bundleId,v.revision,v.hash);if(this.closed)return;
    this.begin(`Review ${v.name} · v${v.revision}`);const catalog=this.host.catalog(),binding=catalog.workflowSharing?.bindings[v.bundleId],mapping:Record<string,string>={};
    this.contentEl.createEl("p",{text:"Choose existing definitions explicitly to update them without duplicates. New definitions are disabled and use manual scheduling until you review their local settings."});
    const suggest:Array<()=>boolean>=[];
    if(!binding)this.button(this.contentEl,"Suggest matches by exact name",()=>{let count=0;for(const apply of suggest)if(apply())count++;this.message!.setText(`${count} unique matches suggested. Review each selection and the replacement before applying; ambiguous names remain unselected.`);});
    for(const kind of ["workflow","task"] as const)for(const item of kind==="task"?revision.payload.tasks:revision.payload.workflows){
      const key=shareKey(kind,item.id),known=binding?.map[key],locals=kind==="task"?catalog.tasks:catalog.workflows,hasName=locals.some(i=>i.name===item.name);
      if(known){mapping[key]=known;this.contentEl.createEl("p",{text:`${item.name} → ${locals.find(i=>i.id===known)?.name||"Missing linked definition"}`});}
      else new Setting(this.contentEl).setName(`${kind}: ${item.name}`).addDropdown(d=>{
        d.addOption("",hasName?"Choose the existing definition…":"Create a new definition");for(const local of locals)d.addOption(local.id,local.name);d.onChange(value=>{if(value)mapping[key]=value;else delete mapping[key];});
        suggest.push(()=>{const matches=locals.filter(local=>local.name===item.name);if(matches.length!==1||mapping[key])return false;mapping[key]=matches[0].id;d.setValue(matches[0].id);return true;});
      });
    }
    this.button(this.contentEl,"Review replacement",async()=>{
      const review=await this.call({action:"review",bundleId:v.bundleId,revision:v.revision,hash:v.hash,mapping});
      this.begin(`Confirm ${v.name} · v${v.revision}`);
      for(const change of review.changes)this.contentEl.createEl("p",{text:`${change.action}: ${change.name} (${change.kind})`});
      if(review.dependents.length)this.contentEl.createEl("p",{text:"Other workflows using these definitions: "+review.dependents.map((d:any)=>d.name||d.id).join(", ")});
      const details=this.contentEl.createEl("details");details.createEl("summary",{text:"Inspect current and incoming definitions"});
      const area=details.createEl("textarea");area.readOnly=true;area.style.width="100%";area.style.height="300px";
      area.value=JSON.stringify({current:review.changes.map((change:any)=>{const item=(change.kind==="task"?catalog.tasks:catalog.workflows).find(i=>i.id===change.id);return item?portableItem(item,change.kind):null;}),incoming:revision.payload},null,2);
      let replaceLocal=false,acceptPermissions=false;
      if(review.modified)new Setting(this.contentEl).setName("Replace the reviewed local changes").addToggle(t=>t.onChange(v=>replaceLocal=v));
      if(review.permissions)new Setting(this.contentEl).setName("Accept the reviewed engines and permissions").setDesc("Review the code, prompts and permission fields above before applying.").addToggle(t=>t.onChange(v=>acceptPermissions=v));
      this.contentEl.createEl("p",{text:"Local paths, models, schedules and existing history are retained. A private backup is saved before replacement. No task starts as part of this update."});
      this.button(this.contentEl,"Apply this version",async()=>{await this.call({action:"apply",bundleId:v.bundleId,revision:v.revision,hash:v.hash,mapping:review.mapping,reviewHash:review.reviewHash,replaceLocal,acceptPermissions});await this.home();});this.button(this.contentEl,"Back",()=>this.home());
    });this.button(this.contentEl,"Back",()=>this.home());
  }
  private distribute(v:any,status:any){
    this.begin(`Distribute ${v.name} · v${v.revision}`);const targets=new Map<string,string>();let replaceLocal=false;
    this.contentEl.createEl("p",{text:"Select linked projects. Each applies the version through its own plugin when available. A changed target is held for review; a running affected workflow remains pending."});
    for(const p of status.projects){if(p.projectId===status.connection.projectId)continue;const binding=p.bindings.find((b:any)=>b.bundleId===v.bundleId);if(!binding)continue;
      new Setting(this.contentEl).setName(p.name).setDesc(`v${binding.revision} · ${binding.modified?"Local changes":"No local changes"} · Last seen ${p.updatedAt}${p.allowPush?"":" · Distribution disabled"}`).addToggle(t=>t.setDisabled(!p.allowPush||!binding.localHash).onChange(enabled=>enabled?targets.set(p.projectId,binding.localHash):targets.delete(p.projectId)));
    }
    new Setting(this.contentEl).setName("Replace the local changes shown above").setDesc("Applies only to the observed versions. Later edits still stop the replacement.").addToggle(t=>t.onChange(v=>replaceLocal=v));
    this.button(this.contentEl,"Send to selected projects",async()=>{const result=await this.call({action:"distribute",bundleId:v.bundleId,revision:v.revision,hash:v.hash,replaceLocal,targets:[...targets].map(([projectId,localHash])=>({projectId,localHash}))});await this.home();this.message!.setText(result.deliveries.map((d:any)=>`${d.state}${d.message?": "+d.message:""}`).join(" · "));});this.button(this.contentEl,"Back",()=>this.home());
  }
}
