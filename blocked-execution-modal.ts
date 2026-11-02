import {App,Modal} from 'obsidian';
import type {BlockedAttempt,BlockedExecutionInspection} from './blocked-execution-recovery';

export class BlockedExecutionModal extends Modal {
  private generation=0;
  private busy=false;
  constructor(app:App,private inspect:()=>Promise<BlockedExecutionInspection>,
      private reset:(inspection:BlockedExecutionInspection,attempt:BlockedAttempt)=>Promise<boolean>,
      private reconnect:((inspection:BlockedExecutionInspection)=>Promise<boolean>)|undefined,
      private describeError:(error:unknown)=>string,private selectedRunId?:string) {super(app);}
  async onOpen() {
    const generation=++this.generation,root=this.contentEl;
    root.empty();root.createEl('h3',{text:'Resolve blocked executions'});
    root.createEl('p',{text:'Review the saved attempts below. Reset closes only the selected attempt and keeps its history and results. It does not stop external processes or start new work.'});
    const feedback=root.createEl('p',{text:'Reading saved execution information…'});
    const buttons:HTMLButtonElement[]=[];
    const action=(parent:HTMLElement,text:string,run:()=>Promise<boolean>)=>{
      const button=parent.createEl('button',{text});buttons.push(button);
      button.onclick=async()=>{
        if(this.busy)return;this.busy=true;buttons.forEach(b=>b.disabled=true);
        try {if(await run()){this.close();return;}}
        catch(error){feedback.textContent=this.describeError(error);}
        finally {this.busy=false;buttons.forEach(b=>b.disabled=false);}
      };
    };
    try {
      const inspection=await this.inspect();
      if(generation!==this.generation)return;
      feedback.textContent=inspection.attempts.length
        ? 'Check the original terminal and its effects before resetting an attempt.'
        : 'No blocked attempts found. You can refresh this review.';
      if(this.reconnect) {
        root.createEl('p',{text:'To keep the saved attempts and reach their continuation controls, reconnect AutoOC. No task runs automatically.'});
        action(root,'Reconnect execution controls',()=>this.reconnect!(inspection));
      }
      for(const attempt of inspection.attempts) {
        const row=root.createDiv('auto-oc-card');
        row.createEl('h4',{text:attempt.name});
        row.createEl('p',{text:`${attempt.completedSteps} completed step(s) · ${attempt.phase==='ready'?'Saved work pending':attempt.phase==='in_flight'?'Outcome needs review':'Historical outcome needs review'}`});
        row.createEl('p',{text:`Attempt: ${attempt.runId}`});
        if(attempt.runId===this.selectedRunId)row.createEl('p',{text:'Selected attempt'});
        if(attempt.phase==='ready')row.createEl('p',{text:'To keep this progress, use the workflow continuation controls. Continuation requires the original definition. Reset closes this attempt instead.'});
        action(row,attempt.phase==='ready'||attempt.phase==='in_flight'?'Reset this attempt…':'Resolve this review…',()=>this.reset(inspection,attempt));
      }
    }catch(error){if(generation===this.generation)feedback.textContent=this.describeError(error);}
    action(root,'Refresh review',async()=>{await this.onOpen();return false;});
  }
  onClose(){this.generation++;this.contentEl.empty();}
}
