import { App, Modal } from "obsidian";
import * as fs from "fs";
import { readExecutionCheckpoint } from "./execution-journal";

export class CodeStepLogModal extends Modal {
  private timer?: ReturnType<typeof setInterval>;
  constructor(app: App, private title: string, private read: () => {log:string;status:string}) { super(app); }
  onOpen() {
    this.contentEl.createEl("h2", {text:this.title});
    const status = this.contentEl.createEl("p");
    const output = this.contentEl.createEl("pre", {cls:"auto-oc-inline-code-source"});
    const refresh = () => {
      try { const state = this.read(); status.textContent = state.status; output.textContent = state.log || "No output yet."; }
      catch(error) { status.textContent = String(error); if (this.timer) clearInterval(this.timer); }
    };
    refresh(); this.timer = setInterval(refresh, 500);
  }
  onClose() { if (this.timer) clearInterval(this.timer); this.contentEl.empty(); }
}

export class CodeStepHistoryModal extends Modal {
  private closed = false;
  constructor(app: App, private runtime: string, private workflowId: string, private stepId: string, private title: string,
    private openOutput: (title:string, output:string)=>void) { super(app); }
  async onOpen() {
    this.contentEl.createEl("h2", {text:`History · ${this.title}`});
    const status = this.contentEl.createEl("p", {text:"Loading step history…"});
    try {
      const rows: Array<{at:string;runId:string;index:number;status:string}> = [];
      const files = await fs.promises.readdir(this.runtime).catch((error:NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return []; throw error;
      });
      for (const file of files) {
        if (this.closed) return;
        if (!/^[a-f0-9-]+\.json$/.test(file)) continue;
        // Yield between records; never put unrelated outputs in the history DOM.
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        const state = readExecutionCheckpoint(this.runtime, file.slice(0,-5));
        if (state.workflowId !== this.workflowId) continue;
        state.steps.forEach((step,index) => {
          if (step.stepId === this.stepId) rows.push({at:step.startedAt || state.createdAt || "",runId:state.runId,index,status:step.status});
        });
      }
      if (this.closed) return;
      status.textContent = rows.length ? `${rows.length} step attempts` : "No recorded attempts for this step yet.";
      for (const row of rows.sort((a,b)=>b.at.localeCompare(a.at))) {
        const button = this.contentEl.createEl("button", {text:`${new Date(row.at).toLocaleString()} · ${row.status} · View output`, cls:"auto-oc-code-history-entry"});
        button.title = `Execution ${row.runId} · journal step ${row.index+1}`;
        button.onclick = () => {
          try {
            const state = readExecutionCheckpoint(this.runtime, row.runId), step = state.steps[row.index];
            if (state.workflowId !== this.workflowId || step?.stepId !== this.stepId) throw new Error("History identity changed");
            this.openOutput(this.title, step.output || "No output recorded.");
          } catch(error) { status.textContent = String(error); }
        };
      }
    } catch(error) { if (!this.closed) status.textContent = `Could not read step history: ${String(error)}`; }
  }
  onClose() { this.closed = true; this.contentEl.empty(); }
}
