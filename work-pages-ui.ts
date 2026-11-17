import { App, Modal, Notice, Setting } from "obsidian";
import { randomUUID } from "crypto";
import type { FinishWorkReview } from "./finish-work";
import type { DiscardWorkReview } from "./discard-work";
import type { DashboardItem } from "./dashboard-areas";
import { mergeReviewCommand, mergeEditorUri, type MergeReview, type MergeCommand } from "./merge-review";
import { createPageWorktree, describePageFolder, inspectWorktreePreparation, prepareWorktreeIgnore, pageChanges, selectWorkPage, readWorkspaceGitState, registerWorkPage,
  type WorkPage, type WorkPageSettings, type WorktreePreparation, type PageRun } from "./work-pages";

export interface WorkPagesHost {
  settings: WorkPageSettings & {workingDirectory: string; tasks: {id:string;name:string;disabled?:boolean}[]; workflows:{id:string;name:string;disabled?:boolean}[]};
  saveSettings(refreshView?: boolean): Promise<void>;
  isLifecycleStopped(): boolean;
  assertPagesEditable(): void;
  reservePagePreparation(): () => void;
  runWorkPage(pageId: string, sourceId: string, task: boolean, runId?: string, reconcile?: boolean): Promise<unknown>;
  stopWorkPage(run: PageRun): Promise<unknown>;
  pageRunOutput(run: PageRun): string;
  ownsExecution(workflowId: string, runId: string): boolean;
  confirmPageTerminal(id: string): Promise<void>;
  pageTerminalState?(claimId: string): "tracked" | "exited" | "unknown";
  hasPageTerminal?(pageId: string): boolean;
  showPageTerminal?(pageId: string): Promise<void>;
  reviewPageFinish(pageId: string): Promise<FinishWorkReview>;
  reviewPageMerge(pageId:string,targetDirectory?:string):Promise<MergeReview>;
  finishWorkPage(pageId: string, reviewHash: string, removeWorktree: boolean, sessionsClosed: boolean): Promise<void>;
  reviewPageDiscard(pageId:string):Promise<DiscardWorkReview>;
  discardWorkPage(pageId:string,reviewHash:string,branchName:string,confirmed:boolean):Promise<void>;
  deleteWorkPage(page:WorkPage):Promise<void>;
  redactSecrets(text: string): string;
}

function errorText(host: WorkPagesHost, error: unknown) { return host.redactSecrets(error instanceof Error ? error.message : String(error)); }
function action(parent: HTMLElement, label: string, host: WorkPagesHost, perform: () => Promise<unknown>, disabled = false) {
  const button = parent.createEl("button", {text:label}); button.disabled = disabled;
  button.onclick = async () => {
    if (button.disabled || host.isLifecycleStopped()) return;
    button.disabled = true;
    try { await perform(); } catch (error) { new Notice(errorText(host,error)); }
    finally { button.disabled = disabled; }
  };
  return button;
}
async function saveField<K extends keyof WorkPageSettings>(host: WorkPagesHost, key: K, value: WorkPageSettings[K]) {
  const settings: WorkPageSettings = host.settings;
  const previous = settings[key]; settings[key] = value;
  try { await host.saveSettings(); }
  catch (error) { const current: WorkPageSettings = host.settings; if (current[key] === value) current[key] = previous; throw error; }
}

/** Overview has no execution folder: opening this selector never launches a CLI. */
export function openCliWorkspaceSelector(app:App,host:WorkPagesHost,open:(page?:WorkPage)=>void):void {
  if(host.isLifecycleStopped())return;
  const modal=new Modal(app);
  let closed=false;
  const mainDirectory=()=>host.settings.workingDirectory?.trim() || (app.vault.adapter as any).basePath || "";
  const pageContext=(page:WorkPage)=>JSON.stringify([page.id,page.directory,page.kind,page.repository,page.branch]);
  modal.onOpen=()=>{
    modal.modalEl.addClass("auto-oc-work-page-dialog");
    const root=modal.contentEl;root.addClass("auto-oc-finish-modal");
    const header=root.createDiv("auto-oc-finish-header");
    header.createEl("h3",{text:"Choose CLI workspace"});
    header.createEl("p",{text:"Choose where to open a CLI. Existing live terminals are reused in their own workspace.",cls:"auto-oc-finish-context"});
    const body=root.createDiv("auto-oc-finish-body"),feedback=body.createEl("p");feedback.setAttr("role","alert");
    const add=(name:string,directory:string,page?:WorkPage)=>{
      const row=body.createDiv("auto-oc-page-row"),context=page? pageContext(page):undefined;
      row.createEl("h4",{text:name});row.createEl("p",{text:directory,cls:"auto-oc-cli-path"});
      if(page?.branch)row.createEl("p",{text:"Branch: "+page.branch,cls:"setting-item-description"});
      const button=row.createEl("button",{text:"Use workspace"});
      button.onclick=()=>{
        if(closed||host.isLifecycleStopped())return;
        try {
          let current:WorkPage|undefined;
          if(page) {
            current=selectWorkPage(host.settings,page.id);
            if(!current||current.archived||current.worktreeRemoval||pageContext(current)!==context)throw new Error("This workspace changed or is unavailable. Close the selector and choose again.");
          } else if(directory!==mainDirectory())throw new Error("The Main workspace folder changed. Close the selector and choose again.");
          open(current?{...current}:undefined);modal.close();
        } catch(error) {feedback.setText(errorText(host,error));}
      };
    };
    add("Main workspace",mainDirectory());
    for(const page of host.settings.workPages||[])if(!page.archived&&!page.worktreeRemoval)add(page.name,page.directory,{...page});
    const footer=root.createDiv("auto-oc-finish-footer");
    footer.createEl("button",{text:"Cancel"}).onclick=()=>modal.close();
  };
  modal.onClose=()=>{closed=true;modal.contentEl.empty();};
  modal.open();
}

export function addWorkPageSettings(parent: HTMLElement, host: WorkPagesHost) {
  new Setting(parent).setName("Git worktrees (developers)").setDesc("Enable creating and linking Git worktrees in work pages. Off by default. Enabling this does not create folders or change .gitignore. Existing pages remain accessible when disabled.")
    .addToggle(toggle => toggle.setValue(host.settings.worktreesEnabled === true).onChange(async value => {
      toggle.setDisabled(true);
      try { await saveField(host, "worktreesEnabled", value); }
      catch (error) { new Notice(errorText(host,error)); }
      finally { toggle.setValue(host.settings.worktreesEnabled === true); toggle.setDisabled(false); }
    }));
  new Setting(parent).setName("Worktree preparation notices").setDesc("Show the folder and .gitignore notice again for all projects on this installation.")
    .addButton(button => button.setButtonText("Reset notices").onClick(async () => {
      try { await saveField(host, "worktreeNoticeDismissed", []); new Notice("Worktree notices restored."); }
      catch (error) { new Notice(errorText(host,error)); }
    }));
}

class PreparationModal extends Modal {
  private accepted = false;
  constructor(app: App, private preparation: WorktreePreparation, private answer: (remember: boolean | undefined) => void) { super(app); }
  onOpen() {
    const root = this.contentEl;
    root.createEl("h3", {text:"Prepare worktrees in this project"});
    root.createEl("p", {text:"Worktree folders: " + this.preparation.directory});
    root.createEl("p", {text:this.preparation.excluded
      ? "This folder is already ignored. No .gitignore edit is needed."
      : "AutoOC will add /.autooc/worktrees/ to " + this.preparation.ignoreFile + ", preserving existing rules. This change will not be staged or committed automatically."});
    let remember = false;
    new Setting(root).setName("Don't show this notice again for this project").addToggle(toggle => toggle.setValue(false).onChange(value => remember = value));
    root.createEl("button", {text:"Continue"}).onclick = () => { this.accepted = true; this.answer(remember); this.close(); };
    root.createEl("button", {text:"Cancel"}).onclick = () => this.close();
  }
  onClose() { if (!this.accepted) this.answer(undefined); this.contentEl.empty(); }
}

class NewPageModal extends Modal {
  private busy = false;
  private closed = false;
  constructor(app: App, private host: WorkPagesHost, private select: (id: string) => void) { super(app); }
  onOpen() {
    const root = this.contentEl, host = this.host;
    root.createEl("h3", {text:"New page"});
    let name = "", objective = "", mode = "folder", directory = host.settings.workingDirectory || (this.app.vault.adapter as any).basePath || "";
    let branch = "", base = "HEAD";
    new Setting(root).setName("Name").setDesc("Your page label, such as Login fix or Payments. It can differ from the branch and folder names.")
      .addText(input => input.onChange(value => name = value));
    new Setting(root).setName("Objective").setDesc("Included in AI task prompts for this page. Global definitions are kept.")
      .addTextArea(input => input.onChange(value => objective = value));
    const extra = root.createDiv();
    const drawExtra = () => {
      extra.empty();
      new Setting(extra).setName(mode === "create" ? "Repository folder" : "Existing folder").addText(input => input.setValue(directory).onChange(value => directory = value.trim()));
      if (mode === "create") {
        new Setting(extra).setName("New branch").addText(input => input.setValue(branch).setPlaceholder("feat/my-work").onChange(value => branch = value.trim()));
        new Setting(extra).setName("Base branch or commit").addText(input => input.setValue(base).onChange(value => base = value.trim()));
      }
    };
    new Setting(root).setName("Environment").addDropdown(dropdown => {
      dropdown.addOption("folder","Existing folder");
      if (host.settings.worktreesEnabled === true) dropdown.addOption("link","Existing Git worktree").addOption("create","New Git worktree");
      dropdown.onChange(value => {mode=value; drawExtra();});
    });
    const environmentHelp = root.createEl("p",{cls:"setting-item-description"});
    environmentHelp.setText(host.settings.worktreesEnabled === true
      ? "Existing folder uses that folder directly; it does not create a branch or isolate files. Choose New Git worktree for a separate folder and branch. Every page shows all tasks and workflows automatically."
      : "Existing folder does not create a branch or isolate files. For parallel development, enable Settings → Execution → Git worktrees (developers), then choose New Git worktree. Every page shows all tasks and workflows automatically.");
    drawExtra();
    const feedback = root.createEl("p"); feedback.setAttr("role", "alert");
    const create = root.createEl("button", {text:"Create page", cls:"mod-cta"});
    create.onclick = async () => {
      if (this.busy || this.closed || host.isLifecycleStopped()) return;
      this.busy = true; create.disabled = true;
      let createdDirectory: string | undefined, preparedIgnore = false;
      let release: (()=>void) | undefined;
      try {
        release = host.reservePagePreparation();
        if (!name.trim()) throw new Error("Enter a page name.");
        if (mode !== "folder" && host.settings.worktreesEnabled !== true) throw new Error("Enable worktrees in Settings first.");
        const id = randomUUID();
        let environment: Awaited<ReturnType<typeof describePageFolder>>;
        if (mode === "create") {
          let preparation = await inspectWorktreePreparation(directory);
          const savedPreference = host.settings.worktreeNoticeDismissed?.includes(preparation.preferenceKey);
          const remember = savedPreference ? true : await new Promise<boolean|undefined>(resolve => new PreparationModal(this.app,preparation,resolve).open());
          if (remember === undefined || this.closed || host.isLifecycleStopped()) return;
          preparation = await prepareWorktreeIgnore(preparation); preparedIgnore = true;
          if (remember && !savedPreference) await saveField(host,"worktreeNoticeDismissed",[...(host.settings.worktreeNoticeDismissed || []),preparation.preferenceKey]);
          environment = await createPageWorktree(preparation,id,branch,base); createdDirectory = environment.directory;
        } else environment = await describePageFolder(directory,mode === "link");
        if (host.isLifecycleStopped()) throw new Error("AutoOC closed during preparation.");
        const page: WorkPage = {id,name:name.trim(),objective,...environment,workflowIds:[],taskIds:[]};
        await registerWorkPage(host.settings,page,()=>host.saveSettings());
        this.select(page.id); this.close();
      } catch (error) {
        feedback.setText(errorText(host,error) + (createdDirectory ? " Worktree retained at " + createdDirectory + ". Link this existing worktree after resolving the error." : preparedIgnore ? " The confirmed .gitignore preparation is retained." : ""));
      } finally { release?.(); this.busy = false; create.disabled = false; }
    };
    root.createEl("button", {text:"Cancel"}).onclick = () => { if (!this.busy) this.close(); };
  }
  onClose() { this.closed = true; this.contentEl.empty(); }
}

class MergeReviewModal extends Modal {
  private busy=false;
  private closed=false;
  private target?:string;
  constructor(app:App,private host:WorkPagesHost,private pageId:string,private finished:()=>void){super(app);}
  onOpen(){void this.refresh();}
  private async refresh() {
    if(this.busy||this.closed||this.host.isLifecycleStopped())return;
    this.busy=true;
    const root=this.contentEl,host=this.host;
    this.modalEl.addClass("auto-oc-work-page-dialog");root.empty();root.addClass("auto-oc-finish-modal");
    const header=root.createDiv("auto-oc-finish-header");header.createEl("h3",{text:"Merge review"});
    const loading=header.createEl("p",{text:"Checking branches and conflicts...",cls:"auto-oc-finish-context"});
    try {
      const review=await host.reviewPageMerge(this.pageId,this.target);
      if(this.closed||host.isLifecycleStopped())return;
      this.target=review.target?.directory;
      loading.setText("Source: "+review.source.branch+" · "+review.source.head.slice(0,8));
      header.createEl("p",{text:review.source.directory,cls:"auto-oc-finish-path"});
      const body=root.createDiv("auto-oc-finish-body");
      new Setting(body).setName("Target branch").setDesc("Choose a checked-out local branch in this repository. AutoOC does not switch branches.").addDropdown(dropdown=>{
        review.targets.forEach(t=>dropdown.addOption(t.directory,t.branch+" · "+t.directory));
        if(this.target)dropdown.setValue(this.target);
        dropdown.onChange(value=>{this.target=value;void this.refresh();});
      });
      if(review.target)body.createEl("p",{text:"Target folder: "+review.target.directory+" · "+review.target.head.slice(0,8),cls:"auto-oc-finish-path"});
      const labels:Record<MergeReview["state"],string>={blocked:"Review blocked",ready:"Ready to merge",conflicts:"Conflicts found",resolved:"Ready to complete merge",integrated:"Integration verified",unavailable:"Preview unavailable"};
      const badge=body.createEl("p",{text:labels[review.state],cls:"auto-oc-merge-state auto-oc-merge-"+review.state});badge.setAttr("role","status");
      body.createEl("p",{text:review.inProgress?"Actual merge in progress in the target folder.":"Pre-merge review. Working files and branches have not been changed by this review."});
      for(const blocker of review.blockers)body.createEl("p",{text:host.redactSecrets(blocker),cls:"mod-warning"});
      if(review.details)body.createEl("pre",{text:host.redactSecrets(review.details),cls:"auto-oc-merge-details"});
      if(review.target) {
        const target=review.target;
        const tools=body.createDiv("auto-oc-page-actions");
        action(tools,"Open target in VS Code",host,async()=>{await require("electron").shell.openExternal(mergeEditorUri(target.directory));});
        action(tools,"Copy target path",host,async()=>{require("electron").clipboard.writeText(target.directory);new Notice("Target path copied.");});
        body.createEl("p",{text:"VS Code must be installed. For another editor, copy the target path. Resolve conflicts in the target folder; Current is the target branch and Incoming is the source.",cls:"setting-item-description"});
        if(review.conflicts.length) {
          body.createEl("h4",{text:(review.inProgress?"Unresolved files":"Predicted conflict files")+" ("+review.conflicts.length+")"});
          for(const file of review.conflicts.slice(0,150)) {
            const row=body.createDiv("auto-oc-merge-file");row.createEl("code",{text:file});
            action(row,"Open target file",host,async()=>{await require("electron").shell.openExternal(mergeEditorUri(target.directory,file));});
          }
          if(review.conflicts.length>150)body.createEl("p",{text:"Showing the first 150 files. Review all conflicts in your Git tool."});
          if(!review.inProgress)body.createEl("p",{text:"These are predictions. Conflict markers appear only after you start the merge. Some renamed or deleted paths may not exist in the target folder."});
        }
      }
      body.createEl("h4",{text:"Next step"});
      body.createEl("p",{text:review.state==="integrated"
        ? "Review your tests, then use Finish work to archive the page and optionally remove the clean worktree. The branch and history are kept. Squash and rebased integrations cannot be verified automatically."
        : review.inProgress ? "Resolve each conflict in the target folder, review the result, stage the resolved files and run your tests. Recheck conflicts before completing the merge. Closing this dialog leaves the Git merge in progress."
        : "Pause schedules and close running tasks, CLIs and services in both folders. Copy the command into your own terminal to start the merge. It stops before creating the merge commit, even for a fast-forward. Return here and recheck conflicts."});
      body.createEl("p",{text:"Commands are copied, never executed by AutoOC. External Git work does not reserve AutoOC execution; keep schedules and other writers paused until the merge is finished or aborted.",cls:"setting-item-description"});
      const commands=body.createDiv("auto-oc-page-actions");
      const fresh=async()=>{
        const current=await host.reviewPageMerge(this.pageId,review.target?.directory);
        if(this.closed||host.isLifecycleStopped())throw new Error("Merge review closed. Reopen it before continuing.");
        if(this.target!==review.target?.directory)throw new Error("Target selection changed. Review the selected target before continuing.");
        if(current.hash!==review.hash||current.blockers.length) {await this.refresh();throw new Error("Workspace or activity changed. Read the updated review before continuing.");}
        return current;
      };
      const copy=(label:string,operation:MergeCommand)=>action(commands,label,host,async()=>{
        const command=mergeReviewCommand(await fresh(),operation);
        require("electron").clipboard.writeText(command);new Notice("Command copied for "+(process.platform==="win32"?"PowerShell":"a POSIX shell")+". Review it before running.");
      });
      if(!review.blockers.length) {
        if(!review.inProgress&&["ready","conflicts"].includes(review.state))copy("Copy merge command","start");
        if(review.state==="resolved")copy("Copy complete command","complete");
        if(review.inProgress&&["resolved","conflicts"].includes(review.state)) {
          copy("Copy abort command","abort");
          body.createEl("p",{text:"Abort cancels this Git merge and can discard conflict-resolution edits. Save anything you want to keep before running it.",cls:"setting-item-description"});
        }
      }
      const footer=root.createDiv("auto-oc-finish-footer"),buttons=footer.createDiv("auto-oc-page-actions");
      if(review.state==="integrated"&&!review.blockers.length)action(buttons,"Finish work",host,async()=>{
        const current=await fresh();if(current.state!=="integrated")throw new Error("Integration is no longer verified.");
        this.close();new FinishWorkModal(this.app,host,this.pageId,this.finished).open();
      });
      buttons.createEl("button",{text:"Recheck conflicts"}).onclick=()=>this.refresh();
      buttons.createEl("button",{text:"Close"}).onclick=()=>this.close();
    } catch(error) {if(!this.closed){loading.setText(errorText(host,error));root.createEl("button",{text:"Retry review"}).onclick=()=>{this.target=undefined;return this.refresh();};root.createEl("button",{text:"Close"}).onclick=()=>this.close();}}
    finally{this.busy=false;}
  }
  onClose(){this.closed=true;this.contentEl.empty();}
}

class TextModal extends Modal {
  constructor(app:App, private title:string, private text:string) {super(app);}
  onOpen() { this.contentEl.createEl("h3",{text:this.title}); this.contentEl.createEl("pre",{text:this.text,cls:"auto-oc-page-output"}); }
  onClose() {this.contentEl.empty();}
}

/** Render as text, never HTML: source changes can contain arbitrary markup. */
export function renderPageDiff(parent:HTMLElement, text:string) {
  const legend = parent.createEl("p",{text:"+ Added lines · − Removed lines · @@ Line ranges",cls:"auto-oc-diff-legend"});
  legend.setAttr("aria-label","Diff legend: added lines are green, removed lines are red");
  const pre = parent.createEl("pre",{cls:"auto-oc-page-diff"}); pre.setAttr("tabindex","0");
  pre.setAttr("aria-label","Git changes preview");
  const lines = text.slice(0,160000).split(/\r?\n/), limit = 1200;
  for (const line of lines.slice(0,limit)) {
    const kind = /^(diff --git |index |--- |\+\+\+ |new file |deleted file |rename )/.test(line) ? "file" :
      line.startsWith("@@") ? "hunk" : line.startsWith("+") ? "added" : line.startsWith("-") ? "removed" : "context";
    pre.createEl("span",{text:line + "\n",cls:"auto-oc-diff-line auto-oc-diff-" + kind});
  }
  if (lines.length > limit || text.length > 160000) parent.createEl("p",{text:"Preview shortened. Review all changes in your Git tool before removing the worktree.",cls:"mod-warning"});
}

class ChangesModal extends Modal {
  constructor(app:App, private title:string, private text:string) {super(app);}
  onOpen() {
    this.contentEl.createEl("h3",{text:this.title});
    this.contentEl.createEl("p",{text:"This is a read-only preview. To close this page, return to it and choose Finish work → Archive page. No merge is performed here."});
    renderPageDiff(this.contentEl,this.text);
    this.contentEl.createEl("button",{text:"Close preview",cls:"mod-cta"}).onclick = ()=>this.close();
  }
  onClose() {this.contentEl.empty();}
}

class DeletePageModal extends Modal {
  private busy=false;
  private closed=false;
  constructor(app:App,private host:WorkPagesHost,private page:WorkPage,private finished:()=>void){super(app);}
  onOpen(){
    const root=this.contentEl,page=this.page,host=this.host;
    this.modalEl.addClass("auto-oc-work-page-dialog");root.addClass("auto-oc-finish-modal");
    const header=root.createDiv("auto-oc-finish-header");header.createEl("h3",{text:"Delete page"});
    header.createEl("p",{text:page.name,cls:"auto-oc-finish-context"});
    header.createEl("p",{text:page.directory,cls:"auto-oc-finish-path"});
    const body=root.createDiv("auto-oc-finish-body");
    body.createEl("p",{text:"Remove this archived page from AutoOC and Overview? Its folder, files, Git branches, tasks and workflows will stay unchanged."});
    body.createEl("p",{text:"This removes the page configuration. To use this folder again, create a new page."});
    const blocker=!page.archived ? "Archive this page before deleting it."
      : page.worktreeRemoval ? "This page keeps worktree removal evidence and cannot be deleted."
      : host.settings.pageRuns?.some(run=>run.pageId===page.id) ? "This page has run history. Keep it archived to retain access to its logs." : "";
    const footer=root.createDiv("auto-oc-finish-footer");
    footer.createEl("p",{text:blocker || "Only this archived page will be deleted. All files are kept.",cls:"auto-oc-finish-status"});
    const feedback=footer.createEl("p");feedback.setAttr("role","alert");
    const buttons=footer.createDiv("auto-oc-page-actions");
    const accept=buttons.createEl("button",{text:"Delete page",cls:"mod-warning"});accept.disabled=!!blocker;
    accept.onclick=async()=>{
      if(this.busy || this.closed || accept.disabled || host.isLifecycleStopped())return;
      this.busy=true;accept.disabled=true;
      try{await host.deleteWorkPage(page);this.close();this.finished();new Notice("Page deleted. Folder, files and branches kept.");}
      catch(e){feedback.setText(errorText(host,e)+" Reopen Overview to check the page before trying again.");}
      finally{this.busy=false;}
    };
    buttons.createEl("button",{text:"Cancel"}).onclick=()=>{if(!this.busy)this.close();};
  }
  onClose(){this.closed=true;this.contentEl.empty();}
}

class DiscardWorkModal extends Modal {
  private busy=false;
  private closed=false;
  constructor(app:App,private host:WorkPagesHost,private pageId:string,private finished:()=>void){super(app);}
  onOpen(){void this.refresh();}
  private async refresh(){
    if(this.busy || this.closed)return;
    this.busy=true;const root=this.contentEl,host=this.host;
    this.modalEl.addClass("auto-oc-work-page-dialog");
    root.empty();root.addClass("auto-oc-finish-modal");
    const header=root.createDiv("auto-oc-finish-header");
    header.createEl("h3",{text:"Discard work"});
    const loading=header.createEl("p",{text:"Reviewing the worktree, local files and commits…",cls:"auto-oc-finish-context"});
    try{
      const review=await host.reviewPageDiscard(this.pageId);
      if(this.closed || host.isLifecycleStopped())return;
      const page=selectWorkPage(host.settings,this.pageId);
      loading.setText(page.name+" · "+page.branch);
      header.createEl("p",{text:page.directory,cls:"auto-oc-finish-path"});
      const body=root.createDiv("auto-oc-finish-body");
      body.createEl("p",{text:review.stage==="branch-only"
        ? "The folder is already gone. Confirm to delete only the reviewed local branch."
        : "This deletes the worktree folder, ALL its files (including untracked and ignored files such as .env), and its local branch. Unlike Archive page, this cannot be restored from AutoOC.",cls:"mod-warning"});
      body.createEl("p",{text:"Page history is kept. No merge or remote branch deletion is performed. Preserve anything you need before continuing."});
      if(page.worktreeRemoval)body.createEl("p",{text:"An earlier discard was interrupted. Close its Git process and all sessions first. This is a new explicit confirmation, not an automatic retry.",cls:"mod-warning"});
      body.createEl("p",{text:`${review.fileCount} files in the folder · ${review.commitCount} commits since the comparison base.`});
      body.createEl("p",{text:"Deleting this local branch may leave commits without a local branch reference. Other local or remote copies are not removed."});
      const commits=body.createEl("details");commits.createEl("summary",{text:"Review commits"});
      commits.createEl("pre",{text:host.redactSecrets(review.commits || "No commits since the comparison base."),cls:"auto-oc-page-output"});
      if(review.commitCount>50)commits.createEl("p",{text:"Showing the latest 50 commits. Review the complete branch in your Git tool."});
      const diff=body.createEl("details");diff.createEl("summary",{text:"Review files and diff"});renderPageDiff(diff,host.redactSecrets(review.changes));
      let typed="",confirmed=false,accept:HTMLButtonElement,status:HTMLElement;
      const update=()=>{
        if(!accept)return;
        accept.disabled=this.busy || !!review.blockers.length || typed!==page.branch || !confirmed;
        status.setText(this.busy ? "Discarding — wait for the outcome." : review.blockers.length ? review.blockers.join("\n")
          : typed!==page.branch ? "Type the exact branch name to confirm: "+page.branch
          : !confirmed ? "Confirm data loss and that all processes using this folder have ended."
          : "Ready to permanently discard the reviewed worktree and local branch.");
      };
      new Setting(body).setName("Type the branch name to discard").setDesc(page.branch || "")
        .addText(input=>input.setPlaceholder(page.branch || "").onChange(value=>{typed=value;update();}));
      new Setting(body).setName("I accept losing these files and the local branch, and have closed all sessions, services and previous Git processes")
        .addToggle(toggle=>toggle.setValue(false).onChange(value=>{confirmed=value;update();}));
      const footer=root.createDiv("auto-oc-finish-footer");
      status=footer.createEl("p",{cls:"auto-oc-finish-status"});status.setAttr("role","status");
      const feedback=footer.createEl("p");feedback.setAttr("role","alert");
      const buttons=footer.createDiv("auto-oc-page-actions");
      accept=buttons.createEl("button",{text:review.stage==="branch-only"?"Discard remaining branch":"Discard worktree and branch",cls:"mod-warning"});
      accept.onclick=async()=>{
        if(this.busy || accept.disabled || this.closed || host.isLifecycleStopped())return;
        this.busy=true;update();
        try{await host.discardWorkPage(page.id,review.hash,typed,confirmed);this.close();this.finished();new Notice("Worktree and local branch discarded. Page history kept.");}
        catch(e){feedback.setText(errorText(host,e)+" Use Check discard to inspect any pending outcome. Nothing is retried automatically.");}
        finally{this.busy=false;update();}
      };
      buttons.createEl("button",{text:"Refresh review"}).onclick=()=>this.refresh();
      buttons.createEl("button",{text:"Cancel"}).onclick=()=>{if(!this.busy)this.close();};
      this.busy=false;update();
    }catch(e){if(!this.closed){
      loading.setText("Could not review discard: "+errorText(host,e));
      root.createEl("button",{text:"Retry review"}).onclick=()=>this.refresh();
      root.createEl("button",{text:"Cancel"}).onclick=()=>this.close();
    }}finally{this.busy=false;}
  }
  onClose(){this.closed=true;this.contentEl.empty();}
}

class FinishWorkModal extends Modal {
  private busy = false;
  private closed = false;
  constructor(app:App, private host:WorkPagesHost, private pageId:string, private finished:()=>void) { super(app); }
  onOpen() { void this.refresh(); }
  private async refresh() {
    if (this.busy || this.closed) return;
    this.busy = true;
    const root = this.contentEl, host = this.host;
    this.modalEl.addClass("auto-oc-work-page-dialog");
    root.empty(); root.addClass("auto-oc-finish-modal");
    const header=root.createDiv("auto-oc-finish-header");
    header.createEl("h3",{text:"Finish work"});
    const loading = header.createEl("p",{text:"Checking activity and changes…",cls:"auto-oc-finish-context"});
    try {
      const review = await host.reviewPageFinish(this.pageId);
      if (this.closed || host.isLifecycleStopped()) return;
      const page = selectWorkPage(host.settings,this.pageId);
      loading.setText(page.name + " · " + (page.kind === "worktree" ? page.branch : "Existing folder"));
      header.createEl("p",{text:page.directory,cls:"auto-oc-finish-path"});
      const body = root.createDiv("auto-oc-finish-body");
      body.createEl("p",{text:page.kind === "folder"
        ? "This page uses an existing folder. Archive page closes the page and keeps all files. It does not delete or merge any Git branch."
        : "Archive page closes this workspace and keeps its folder, branch, commits and history. Use Merge review for guided integration in your Git tool. Removing the folder is optional."});
      if(page.kind==="worktree"&&!page.worktreeRemoval)action(body,"Merge review",host,async()=>{this.close();new MergeReviewModal(this.app,host,page.id,this.finished).open();});
      if(page.kind === "folder") {
        const guidance=body.createDiv("auto-oc-finish-guidance");
        guidance.createEl("strong",{text:"Discard work is unavailable for this page."});
        guidance.createEl("p",{text:"No independent worktree was created. This applies even if you have not made any changes."});
        guidance.createEl("p",{text:host.settings.worktreesEnabled === true
          ? "For a separate folder and branch, choose New Git worktree when creating a page."
          : "For a separate folder and branch, enable Settings → Execution → Git worktrees (developers), then create a New Git worktree page."});
      }
      body.createEl("h4",{text:"1. End sessions and runs"});
      body.createEl("p",{text:review.archiveBlockers.length ? review.archiveBlockers.join("\n") : "Ready to archive. No reserved sessions or pending executions were found.",cls:review.archiveBlockers.length ? "mod-warning" : ""});
      if (review.archiveBlockers.length) body.createEl("p",{text:"Close the listed terminals, stop active runs and review unconfirmed sessions on their pages, then click Refresh review. Activity in another page can also block closing."});
      const active = (host.settings.pageRuns || []).filter(run=>run.pageId === page.id && host.ownsExecution(run.workflowId,run.runId));
      for (const run of active) action(body,"Stop " + run.name,host,async()=>{await host.stopWorkPage(run);await this.refresh();});
      terminalClaims(body,this.app,host,page.id);
      if (host.hasPageTerminal?.(page.id) && !host.settings.pageTerminalClaims?.some(c=>c.pageId===page.id)) action(body,"Open terminal",host,()=>host.showPageTerminal!(page.id));
      body.createEl("h4",{text:"2. Review changes"});
      const changes = body.createEl("details",{cls:"auto-oc-finish-changes"});
      changes.createEl("summary",{text:"Show diff · optional when keeping the folder"});
      renderPageDiff(changes,host.redactSecrets(review.changes));
      body.createEl("h4",{text:"3. Choose what to keep"});
      body.createEl("p",{text:"Default: keep the folder. The page moves to Overview, where you can restore it. Local changes do not prevent archiving."});
      let remove = false, sessionsClosed = false;
      let confirm: HTMLButtonElement, status:HTMLElement;
      const update = () => {
        if (!confirm) return;
        confirm.setText(remove ? "Archive and remove worktree" : "Archive page");
        confirm.disabled = this.busy || !!review.archiveBlockers.length || remove && (!sessionsClosed || !!review.removalBlockers.length);
        status.setText(this.busy ? "Saving — wait for confirmation." : review.archiveBlockers.length
          ? "Cannot archive yet: " + review.archiveBlockers.join(" ")
          : remove && !sessionsClosed ? "Confirm that external sessions and services have ended to remove the folder."
          : remove && review.removalBlockers.length ? review.removalBlockers.join(" ")
          : remove ? "Ready: archive the page and remove its clean worktree folder. Branch and history stay."
          : "Ready: archive this page and keep all files. No merge or deletion.");
      };
      if (page.kind === "worktree") {
        new Setting(body).setName("Remove worktree folder").setDesc("Optional. Keeps the branch, commits and page history. The folder cannot be restored from this page after removal.")
          .addToggle(toggle=>toggle.setValue(false).setDisabled(!!review.removalBlockers.length).onChange(value=>{remove=value;update();}));
        if (review.removalBlockers.length) body.createEl("p",{text:"Folder removal is unavailable: " + review.removalBlockers.join("\n") + " You can still archive and keep the folder once sessions have ended.",cls:"setting-item-description"});
        new Setting(body).setName("I closed external sessions and services using this worktree")
          .addToggle(toggle=>toggle.setValue(false).onChange(value=>{sessionsClosed=value;update();}));
      }
      const footer = root.createDiv("auto-oc-finish-footer");
      status = footer.createEl("p",{cls:"auto-oc-finish-status"}); status.setAttr("role","status");
      const feedback = footer.createEl("p"); feedback.setAttr("role","alert");
      const buttons = footer.createDiv("auto-oc-page-actions");
      confirm = buttons.createEl("button",{text:"Archive page",cls:"mod-cta"});
      confirm.onclick = async () => {
        if (this.busy || confirm.disabled || this.closed || host.isLifecycleStopped()) return;
        this.busy = true; update();
        try { await host.finishWorkPage(page.id,review.hash,remove,sessionsClosed); this.close(); this.finished(); new Notice(remove ? "Page archived. Worktree folder removed; branch and history kept." : "Page archived. All files kept. Restore it from Overview."); }
        catch (error) { feedback.setText(errorText(host,error) + " Refresh the review. If removal is pending, use Check removal on the page."); }
        finally { this.busy = false; update(); }
      };
      buttons.createEl("button",{text:"Refresh review"}).onclick = () => this.refresh();
      buttons.createEl("button",{text:"Cancel"}).onclick = () => {if (!this.busy) this.close();};
      if(page.kind === "worktree") buttons.createEl("button",{text:"Discard work…",cls:"mod-warning"}).onclick=()=>{
        if(this.busy)return;this.close();new DiscardWorkModal(this.app,host,page.id,this.finished).open();
      };
      this.busy = false; update();
    } catch (error) { if (!this.closed) {
      loading.setText("Could not check this page: " + errorText(host,error));
      root.createEl("button",{text:"Retry review"}).onclick = ()=>this.refresh();
      root.createEl("button",{text:"Cancel"}).onclick = ()=>this.close();
    } }
    finally {this.busy = false;}
  }
  onClose() {this.closed = true;this.contentEl.empty();}
}
function terminalClaims(parent:HTMLElement, app:App, host:WorkPagesHost, pageId?:string, openPage?:(id:string)=>void) {
  for (const claim of (host.settings.pageTerminalClaims || []).filter(item => !pageId || item.pageId === pageId)) {
    const row = parent.createDiv("auto-oc-page-row");
    const state = host.pageTerminalState?.(claim.id) || "unknown";
    row.createEl("p", {text:"CLI · " + (state === "tracked" ? "session reserved" : state === "exited" ? "ended · reservation pending" : "completion unconfirmed") + " · " + claim.directory});
    if (openPage) {
      row.createEl("button", {text:"Open page"}).onclick = () => openPage(claim.pageId);
      continue;
    }
    if (host.hasPageTerminal?.(claim.pageId)) action(row,"Open terminal",host,()=>host.showPageTerminal!(claim.pageId));
    if (state === "tracked") continue;
    action(row,"Confirm session ended",host,async () => {
      await new Promise<void>(resolve => {
        const modal = new Modal(app);
        modal.contentEl.createEl("p",{text:"Close the CLI and any processes it started first, including external or detached windows. Confirming releases the folder for new work; it does not stop any process."});
        modal.contentEl.createEl("button",{text:"I closed the session — release folder"}).onclick = async () => {
          try { await host.confirmPageTerminal(claim.id); modal.close(); resolve(); }
          catch (error) {new Notice(errorText(host,error));}
        };
        modal.contentEl.createEl("button",{text:"Cancel"}).onclick = () => modal.close();
        modal.onClose = () => {modal.contentEl.empty(); resolve();}; modal.open();
      });
    });
  }
}
function runs(parent:HTMLElement, app:App, host:WorkPagesHost, pageId?:string, openPage?:(id:string)=>void, source?:{id:string;task:boolean}) {
  const history = (host.settings.pageRuns || []).filter(run => (!pageId || run.pageId === pageId) &&
    (!source || run.sourceId === source.id && run.task === source.task)).slice().reverse();
  for (const run of history) {
    const row = parent.createDiv("auto-oc-page-row"), active = host.ownsExecution(run.workflowId,run.runId);
    row.createEl("p",{text:(pageId ? "" : (host.settings.workPages?.find(p=>p.id===run.pageId)?.name || run.pageId) + " · ") + run.name + " · " + run.phase + (run.uncertain ? " · outcome needs review" : "")});
    row.createEl("small",{text:run.runId});
    action(row,"Log",host,async()=>new TextModal(app,run.name,host.pageRunOutput(run)).open());
    if (openPage) {
      row.createEl("button", {text:"Open page"}).onclick = () => openPage(run.pageId);
      continue;
    }
    if (active) action(row,"Stop",host,()=>host.stopWorkPage(run));
    else if (!["completed","failed","abandoned"].includes(run.phase) || run.uncertain) {
      action(row,"Continue",host,()=>host.runWorkPage(run.pageId,run.sourceId,run.task,run.runId,false),run.uncertain);
      action(row,"Reconcile",host,()=>host.runWorkPage(run.pageId,run.sourceId,run.task,run.runId,true));
    }
  }
  if (!history.length) parent.createEl("p",{text:"No page runs yet."});
}

function itemSource(item:DashboardItem) {
  return {id:item.workflowId || item.id,task:!item.workflowId && item.kind !== "workflow"};
}
export function showPageItemHistory(app:App,host:WorkPagesHost,pageId:string,item:DashboardItem,history:boolean) {
  const source = itemSource(item), modal = new Modal(app);
  modal.contentEl.createEl("h3",{text:(history ? "Page history · " : "Page log · ") + item.name});
  if (history) runs(modal.contentEl,app,host,pageId,undefined,source);
  else {
    const run = (host.settings.pageRuns || []).filter(run=>run.pageId === pageId && run.sourceId === source.id && run.task === source.task).at(-1);
    try { modal.contentEl.createEl("pre",{text:run ? host.pageRunOutput(run) : "No runs in this page yet.",cls:"auto-oc-page-output"}); }
    catch (error) { modal.contentEl.createEl("p",{text:errorText(host,error)}); }
  }
  modal.contentEl.createEl("button",{text:"Close"}).onclick = ()=>modal.close(); modal.open();
}
export function openPageItemControls(app:App,host:WorkPagesHost,pageId:string,item:DashboardItem,edit:()=>void) {
  const page = selectWorkPage(host.settings,pageId), source = itemSource(item), modal = new Modal(app);
  const definition = (source.task ? host.settings.tasks : host.settings.workflows).find(entry=>entry.id === source.id);
  modal.contentEl.createEl("h3",{text:definition?.name || item.name});
  modal.contentEl.createEl("p",{text:"Run in " + page.name + " · " + page.directory});
  modal.contentEl.createEl("p",{text:"All tasks and workflows are available automatically. This page keeps its own runs and results. Editing a definition updates the shared catalog; schedules still run in Main workspace."});
  if (item.workflowId) modal.contentEl.createEl("p",{text:"This selection is a workflow step. Run the complete workflow here; running a single step is available only in Main workspace."});
  action(modal.contentEl,source.task ? "Run task here" : "Run workflow here",host,async()=>{
    await host.runWorkPage(pageId,source.id,source.task);modal.close();
  },!!page.archived || !!page.worktreeRemoval || !definition || !!definition.disabled);
  modal.contentEl.createEl("button",{text:"Edit shared definition"}).onclick = ()=>{modal.close();edit();};
  runs(modal.contentEl,app,host,pageId,undefined,source);
  modal.contentEl.createEl("button",{text:"Close"}).onclick = ()=>modal.close();modal.open();
}

function renderMainWorkspace(parent:HTMLElement, app:App, host:WorkPagesHost) {
  const workingDirectory = () => host.settings.workingDirectory?.trim() || (app.vault.adapter as any).basePath || "";
  const context = parent.createDiv("auto-oc-workspace-context");
  const header = context.createDiv("auto-oc-workspace-context-header");
  header.createEl("span", {text:"Main workspace",cls:"auto-oc-workspace-name"});
  const branch = header.createEl("span", {text:"Branch: checking…",cls:"auto-oc-workspace-branch"});
  branch.setAttr("aria-live", "polite");
  const refresh = header.createEl("button", {text:"↻",cls:"auto-oc-workspace-refresh"});
  refresh.title = "Refresh branch";
  refresh.setAttr("aria-label", "Refresh branch");
  const folder = context.createEl("span", {cls:"auto-oc-workspace-path"});
  folder.setAttr("tabindex", "0");
  const update = async () => {
    if (refresh.disabled || host.isLifecycleStopped()) return;
    refresh.disabled = true;
    const directory = workingDirectory();
    folder.setText(directory || "No working folder configured.");
    folder.title = (directory ? directory + "\n" : "") + "Default working folder. Tasks with their own folder keep that setting.";
    branch.setText("Branch: checking…"); branch.title = "";
    try {
      if (!directory) { branch.setText("Branch: no working folder configured"); return; }
      const state = await readWorkspaceGitState(directory);
      if (host.isLifecycleStopped()) return;
      if (directory !== workingDirectory()) { branch.setText("Branch: working folder changed; refresh to update"); return; }
      const description = state.kind === "branch" ? "Branch: " + state.branch :
        state.kind === "detached" ? "Detached HEAD: " + state.commit : "Branch: not a Git repository";
      branch.setText(description); branch.title = description;
    } catch (error) {
      if (!host.isLifecycleStopped()) { branch.setText("Branch: unavailable"); branch.title = errorText(host,error); }
    } finally { refresh.disabled = false; }
  };
  refresh.onclick = update;
  void update();
}

/** Returns true when it rendered a page; false keeps the historical main dashboard. */
export function renderWorkPages(parent:HTMLElement, app:App, host:WorkPagesHost, selected:string, select:(id:string)=>void, openCli:(page:WorkPage)=>void,
  renderCatalog?:(parent:HTMLElement,page:WorkPage)=>void):boolean {
  const nav = parent.createDiv("auto-oc-page-tabs"); nav.setAttr("aria-label","Work pages");
  const entries = [{id:"main",name:"Main workspace"},...(host.settings.workPages || [])];
  for (const page of entries.filter(page=>!("archived" in page && page.archived) || page.id === selected)) {
    const button = nav.createEl("button",{text:page.name + (("archived" in page && page.archived) ? " (archived)" : "")});
    button.setAttr("aria-pressed",String(page.id === selected)); button.onclick = () => select(page.id);
  }
  if (selected !== "general") nav.createEl("button",{text:"+ New page"}).onclick = () => new NewPageModal(app,host,select).open();
  if (selected === "main") { renderMainWorkspace(parent,app,host); terminalClaims(parent,app,host,"main"); return false; }
  if (selected === "general") {
    parent.createEl("h3",{text:"Overview"});
    parent.createEl("p",{text:"View activity and logs here. Use CLI to choose a workspace, or open a page to run workflows and manage its sessions. Import updates the shared task and workflow catalog; schedules run in Main workspace."});
    for (const page of entries) {
      const row = parent.createDiv("auto-oc-page-row");
      row.createEl("h4",{text:page.name + (("archived" in page && page.archived) ? " (archived)" : "")});
      const directory = "directory" in page ? page.directory : host.settings.workingDirectory?.trim() || (app.vault.adapter as any).basePath || "";
      row.createEl("p",{text:directory,cls:"auto-oc-cli-path"});
      row.createEl("button",{text:"Open page"}).onclick = () => select(page.id);
      if("archived" in page && page.archived) {
        row.createEl("button",{text:"Delete page"}).onclick=()=>new DeletePageModal(app,host,JSON.parse(JSON.stringify(page)),()=>select("general")).open();
      }
    }
    parent.createEl("h4",{text:"Page executions"});
    runs(parent,app,host,undefined,select); terminalClaims(parent,app,host,undefined,select); return true;
  }
  const page = selectWorkPage(host.settings,selected);
  parent.createEl("h3",{text:page.name});
  parent.createEl("p",{text:page.objective || "No objective set."});
  parent.createEl("p",{text:page.directory,cls:"auto-oc-cli-path"});
  if (page.branch) parent.createEl("p",{text:"Branch: " + page.branch});
  if (page.kind === "folder") parent.createEl("p",{text:"Existing folder · no separate worktree or branch was created. Files are shared with anyone using this folder.",cls:"setting-item-description"});
  const controls = parent.createDiv("auto-oc-page-actions");
  if(page.archived) action(controls,"Delete page",host,async()=>new DeletePageModal(app,host,JSON.parse(JSON.stringify(page)),()=>select("general")).open());
  action(controls,"CLI in this page",host,async()=>openCli({...page}),!!page.archived);
  if (host.hasPageTerminal?.(page.id) && !host.settings.pageTerminalClaims?.some(c=>c.pageId===page.id)) {
    action(controls,"Open terminal",host,()=>host.showPageTerminal!(page.id));
  }
  action(controls,"Changes",host,async()=>new ChangesModal(app,"Changes · "+page.name,host.redactSecrets(await pageChanges(page))).open(),!!page.worktreeRemoval);
  if(page.kind==="worktree"&&!page.worktreeRemoval)action(controls,"Merge review",host,async()=>new MergeReviewModal(app,host,page.id,()=>select("main")).open());
  if(page.kind === "worktree" && (!page.worktreeRemoval || page.worktreeRemoval.mode === "discard" && page.worktreeRemoval.status === "pending")) {
    action(controls,"Discard work",host,async()=>new DiscardWorkModal(app,host,page.id,()=>select("main")).open()).addClass("mod-warning");
  }
  if (page.worktreeRemoval) {
    const discarded=page.worktreeRemoval.mode === "discard";
    parent.createEl("p",{text:page.worktreeRemoval.status === "removed"
      ? discarded ? "Worktree and local branch discarded. Page history kept." : "Worktree removed. Branch and page history kept."
      : discarded ? "Discard needs review. Use Check discard before any further action. Execution stays blocked." : "Worktree removal needs review. Execution stays blocked until its outcome is checked."});
    if (page.worktreeRemoval.status === "pending") {
      action(controls,discarded?"Check discard":"Check removal",host,()=>host.finishWorkPage(page.id,"check-removal",false,false));
      action(controls,"Keep worktree after review",host,async()=>{
        const modal = new Modal(app);
        modal.contentEl.createEl("h3",{text:"Review interrupted removal"});
        modal.contentEl.createEl("p",{text:page.directory,cls:"auto-oc-cli-path"});
        modal.contentEl.createEl("p",{text:"Close the previous Git process and any session using this folder first. AutoOC will verify the original worktree, branch and commit. An intact folder stays archived; if removal already completed, that outcome is recorded. This never retries removal or recreates files."});
        let confirmed = false;
        new Setting(modal.contentEl).setName("I reviewed the folder and closed the previous Git process and sessions")
          .addToggle(toggle=>toggle.setValue(false).onChange(value=>{confirmed=value;accept.disabled=!value;}));
        const accept = action(modal.contentEl,"Confirm reviewed outcome",host,async()=>{
          if (!confirmed) return;
          await host.finishWorkPage(page.id,"check-removal",false,true);modal.close();
        },true);
        modal.contentEl.createEl("button",{text:"Cancel"}).onclick = ()=>modal.close();
        modal.open();
      });
    }
  } else {
    action(controls,"Finish work",host,async()=>new FinishWorkModal(app,host,page.id,()=>select("main")).open());
    if (page.archived) action(controls,"Restore page",host,async()=>{
      host.assertPagesEditable();
      const current = selectWorkPage(host.settings,page.id);
      if (current.worktreeRemoval) throw new Error("This worktree is unavailable. Keep its page history and link a new environment instead.");
      await describePageFolder(current.directory,current.kind === "worktree");
      host.assertPagesEditable();
      await saveField(host,"workPages",host.settings.workPages!.map(p=>p.id===page.id?{...p,archived:false}:p));
    });
  }
  parent.createEl("p",{text:"All tasks and workflows from Main workspace are available here automatically. Results belong to this page. Edits are shared; schedules run in Main workspace.",cls:"setting-item-description"});
  renderCatalog?.(parent,page);
  const history = parent.createEl("details"); history.createEl("summary",{text:"Page executions"});
  runs(history,app,host,page.id);
  terminalClaims(parent,app,host,page.id);
  return true;
}
