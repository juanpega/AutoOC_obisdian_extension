import { App, Modal, Notice, Setting } from "obsidian";
import { randomUUID } from "crypto";
import * as path from "path";
import type { FinishWorkReview, BlockingPageSession } from "./finish-work";
import type { WorktreeFile } from "./worktree-changes";
import type { DiscardWorkReview } from "./discard-work";
import type { DashboardItem } from "./dashboard-areas";
import { mergeEditorUri, type MergeReview, type MergeCommand } from "./merge-review";
import { createPageWorktree, describePageFolder, inspectWorktreePreparation, prepareWorktreeIgnore, pageChanges, selectWorkPage, readWorkspaceGitState, registerWorkPage, assertPageDirectoryAvailable, pageDeletionBlockers, type PagePreparationScope,
  type WorkPage, type WorkPageSettings, type WorktreePreparation, type PageRun } from "./work-pages";

export interface WorkPagesHost {
  settings: WorkPageSettings & {workingDirectory: string; tasks: {id:string;name:string;disabled?:boolean;taskKind?:string;interactiveTerminal?:boolean;workingDirectory?:string}[]; workflows:{id:string;name:string;disabled?:boolean}[]};
  saveSettings(refreshView?: boolean): Promise<void>;
  isLifecycleStopped(): boolean;
  assertPagesEditable(): void;
  reservePagePreparation(scope?:PagePreparationScope): () => void;
  runWorkPage(pageId: string, sourceId: string, task: boolean, runId?: string, reconcile?: boolean): Promise<unknown>;
  stopWorkPage(run: PageRun): Promise<unknown>;
  pageRunOutput(run: PageRun): string;
  ownsExecution(workflowId: string, runId: string): boolean;
  confirmPageTerminal(id: string): Promise<void>;
  pageTerminalState?(claimId: string): "tracked" | "exited" | "unknown";
  hasPageTerminal?(pageId: string): boolean;
  showPageTerminal?(pageId: string): Promise<void>;
  pageBlockingSessions?(pageId?:string):BlockingPageSession[];
  subscribePageReview?(listener:()=>void):()=>void;
  openBlockingPageSession?(id:string,close?:boolean):Promise<void>;
  reviewPageFinish(pageId: string): Promise<FinishWorkReview>;
  reviewPageMerge(pageId:string,targetDirectory?:string):Promise<MergeReview>;
  executePageMerge(pageId:string,targetDirectory:string,reviewHash:string,action:MergeCommand,abortConfirmed?:boolean):Promise<{review:MergeReview;output:string}>;
  finishWorkPage(pageId: string, reviewHash: string, removeWorktree: boolean, sessionsClosed: boolean): Promise<void>;
  reviewPageDiscard(pageId:string):Promise<DiscardWorkReview>;
  discardWorkPage(pageId:string,reviewHash:string,branchName:string,confirmed:boolean):Promise<void>;
  deleteWorkPage(page:WorkPage):Promise<void>;
  redactSecrets(text: string): string;
}

function errorText(host: WorkPagesHost, error: unknown) { return host.redactSecrets(error instanceof Error ? error.message : String(error)); }
/** Refresh live dialogs after saved state/native terminal changes and returning from external Git tools. */
function watchPageReview(host:WorkPagesHost,refresh:()=>Promise<void>,busy:()=>boolean,blocked:()=>boolean):()=>void {
  let closed=false,timer:ReturnType<typeof setTimeout>|undefined,poll:ReturnType<typeof setTimeout>|undefined;
  const schedule=()=>{
    if(closed || host.isLifecycleStopped())return;
    if(timer)clearTimeout(timer);
    timer=setTimeout(()=>{timer=undefined;if(closed || host.isLifecycleStopped())return;if(busy()){schedule();return;}void refresh();},150);
  };
  const unsubscribe=host.subscribePageReview?.(schedule);
  const currentWindow=typeof window!=="undefined"?window:undefined;
  currentWindow?.addEventListener?.("focus",schedule);
  // External writers (including a helper in Main) do not emit plugin events.
  // Recheck blocked reviews only; never reset an actionable confirmation on a timer.
  const check=()=>{if(closed || host.isLifecycleStopped())return;if(blocked()&&!busy())void refresh();poll=setTimeout(check,5000);};
  poll=setTimeout(check,5000);
  return ()=>{closed=true;if(timer)clearTimeout(timer);if(poll)clearTimeout(poll);unsubscribe?.();currentWindow?.removeEventListener?.("focus",schedule);};
}
function integrationSummary(parent:HTMLElement,review:MergeReview) {
  const verified=review.integration==="verified" || review.integration===undefined && review.state==="integrated";
  parent.createEl("p",{text:verified?"Already integrated":"Integration not verified",cls:"auto-oc-merge-state auto-oc-merge-"+(verified?"integrated":"blocked")}).setAttr("role","status");
  if(verified)parent.createEl("p",{text:`${review.source.branch} (${review.source.head.slice(0,8)}) is already included in ${review.target?.branch} (${review.target?.head.slice(0,8)}). No repeated merge or commit of local plugin configuration is needed. Pending files and session closure are separate checks; this does not verify your tests.`});
  return verified;
}

export function renderPendingFiles(parent:HTMLElement,host:Pick<WorkPagesHost,"redactSecrets">,files:WorktreeFile[],title:string) {
  parent.createEl("h4",{text:title+" ("+files.length+")"});
  if(!files.length){parent.createEl("p",{text:"No pending files reported by Git."});return;}
  parent.createEl("p",{text:"Local configuration is identified by known paths (.obsidian and local .env files). This is informational: files are preserved and still count when checking merge or removal safety.",cls:"setting-item-description"});
  for(const category of ["project","local-configuration"] as const) {
    const group=files.filter(file=>file.category===category);if(!group.length)continue;
    parent.createEl("h5",{text:(category==="project"?"Product / other project files":"Local configuration")+" ("+group.length+")"});
    for(const file of group.slice(0,100)) {
      const row=parent.createDiv("auto-oc-merge-file");
      row.createEl("code",{text:host.redactSecrets(file.originalPath?file.originalPath+" → "+file.path:file.path)});
      row.createEl("span",{text:file.indexStatus==="?"?" — Untracked":file.indexStatus==="!"?" — Ignored":` — Index: ${file.indexStatus.trim() || "unchanged"}; working tree: ${file.worktreeStatus.trim() || "unchanged"}`});
    }
    if(group.length>100)parent.createEl("p",{text:`Showing 100 of ${group.length} files in this group. Review the complete status in your Git tool.`,cls:"mod-warning"});
  }
}

function reviewSessions(host:WorkPagesHost,pageId?:string):BlockingPageSession[] {
  return host.pageBlockingSessions?.(pageId) || (host.settings.pageTerminalClaims || []).filter(claim=>!pageId || claim.pageId===pageId).map(claim=>({
    id:"claim:"+claim.id,claimId:claim.id,pageId:claim.pageId,pageName:claim.pageId==="main"?"Main workspace":host.settings.workPages?.find(page=>page.id===claim.pageId)?.name || claim.pageId,
    label:"CLI session",directory:claim.directory,state:host.pageTerminalState?.(claim.id) || "unknown",createdAt:claim.createdAt} as BlockingPageSession));
}
function blockingSessions(parent:HTMLElement,app:App,host:WorkPagesHost,navigate:()=>void,refresh:()=>Promise<void>,pageId?:string) {
  const sessions=reviewSessions(host,pageId);
  if(!sessions.length)return;
  parent.createEl("h4",{text:pageId?"Sessions blocking this page":"Sessions blocking Git operations"});
  for(const session of sessions) {
    const row=parent.createDiv("auto-oc-page-row");
    row.createEl("strong",{text:host.redactSecrets(session.pageName+" — "+session.label)});
    row.createEl("p",{text:host.redactSecrets(session.directory),cls:"auto-oc-cli-path"});
    row.createEl("small",{text:session.id+(session.createdAt?" — "+session.createdAt:"")});
    row.createEl("p",{text:session.state==="tracked"?"Session still observed / opening":session.state==="exited"?"Process ended; reservation still pending":"External or unobserved session; completion unconfirmed"});
    if(session.sessionId!==undefined && host.openBlockingPageSession) {
      action(row,"Open this terminal",host,async()=>{await host.openBlockingPageSession!(session.id);navigate();});
      action(row,"Close this session…",host,async()=>{await host.openBlockingPageSession!(session.id,true);});
    }
    if(session.claimId && session.state!=="tracked")action(row,"Confirm this session ended…",host,async()=>{
      const modal=new Modal(app);
      modal.contentEl.createEl("h3",{text:host.redactSecrets(session.pageName+" — "+session.label)});
      modal.contentEl.createEl("p",{text:session.claimId+" — "+host.redactSecrets(session.directory)});
      modal.contentEl.createEl("p",{text:"Close this CLI and any processes it started, including external windows and services. Confirmation releases only this reservation; it does not stop a process."});
      action(modal.contentEl,"I closed this session — release reservation",host,async()=>{await host.confirmPageTerminal(session.claimId!);modal.close();await refresh();});
      modal.contentEl.createEl("button",{text:"Cancel"}).onclick=()=>modal.close();modal.open();
    });
  }
}
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
        const id = randomUUID();
        const scope=mode === "create" ? await inspectWorktreePreparation(directory) : undefined;
        release = host.reservePagePreparation(scope ? {directory:path.join(scope.directory,id),repository:scope.repository,creating:true} : {directory});
        assertPageDirectoryAvailable(host.settings);
        if (!name.trim()) throw new Error("Enter a page name.");
        if (mode !== "folder" && host.settings.worktreesEnabled !== true) throw new Error("Enable worktrees in Settings first.");
        let environment: Awaited<ReturnType<typeof describePageFolder>>;
        if (mode === "create") {
          let preparation = scope!;
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

function mergeFooterGuidance(review:MergeReview,redact:(text:string)=>string):string {
  const brief=(text:string)=>{const clean=redact(text).replace(/\s+/g," ").trim();return clean.length>180?clean.slice(0,180)+"… (see review details)":clean;};
  if(review.integration==="verified" || review.integration===undefined && review.state==="integrated")
    return "Integration verified. No repeated merge or commit is needed. Archiving is independent and preserves files and branches.";
  if(review.blockers.length)
    return "Cannot proceed: "+brief(review.blockers[0])+(review.blockers.length>1?" (+"+(review.blockers.length-1)+" more in details)":"")+". Resolve the blocker, then choose Recheck conflicts.";
  if(!review.target)return "No target folder available. Choose a checked-out local branch in this repository, then choose Recheck conflicts.";
  if(review.state==="blocked" || review.state==="unavailable")
    return "Merge review unavailable: "+brief(review.details || "Git could not establish merge readiness")+". Check the target folder and Git status, then choose Recheck conflicts.";
  if(review.state==="resolved")return review.completionBlockers?.length
    ? "Complete merge is blocked: "+brief(review.completionBlockers[0])+". Resolve completion blockers in the target folder, run tests, then choose Recheck conflicts."
    : "Complete merge creates the merge commit in the target folder. Review the staged result and run tests first. Closing leaves the merge in progress.";
  if(review.inProgress)return "Resolve conflicts and stage resolved files in the target folder, run tests, then choose Recheck conflicts. Closing leaves the merge in progress.";
  return "Start merge applies changes in the target folder and stops before creating the merge commit. Review the result and run tests, then choose Complete merge.";
}

class MergeReviewModal extends Modal {
  private busy=false;
  private refreshing=false;
  private reviewGeneration=0;
  private blocked=false;
  private closed=false;
  private stopWatching?:()=>void;
  private target?:string;
  private feedback="";
  private reviewStamp?:string;
  private reviewStatus?:HTMLElement;
  private reviewBody?:HTMLElement;
  private reviewTarget?:string;
  private footerGuidance="";
  constructor(app:App,private host:WorkPagesHost,private pageId:string,private finished:()=>void){super(app);}
  onOpen(){this.stopWatching=watchPageReview(this.host,()=>this.refresh(undefined,true),()=>this.busy||this.refreshing,()=>this.blocked);void this.refresh();}
  private async refresh(observed?:MergeReview,background=false) {
    if(this.busy||background&&this.refreshing||this.closed||this.host.isLifecycleStopped())return;
    const generation=++this.reviewGeneration;
    this.refreshing=true;
    if(!background)this.busy=true;
    const root=this.contentEl,host=this.host;
    this.modalEl.addClass("auto-oc-work-page-dialog");root.addClass("auto-oc-finish-modal");
    // Keep the current review mounted while Git runs. Emptying it here collapses
    // the dialog on every blocked-review poll and loses the reader's position.
    if(!this.reviewStatus) {
      const header=root.createDiv("auto-oc-finish-header");header.createEl("h3",{text:"Merge review"});
      this.reviewStatus=header.createEl("p",{cls:"auto-oc-finish-context"});
    }
    let loading=this.reviewStatus;
    loading.setText("Checking branches and conflicts...");
    const focused=root.ownerDocument?.activeElement as HTMLElement|null;
    const controls=(background?[]:Array.from(root.querySelectorAll<HTMLButtonElement|HTMLSelectElement|HTMLInputElement>("button, select, input")))
      .map(control=>({control,disabled:control.disabled}));
    controls.forEach(({control})=>{control.disabled=true;});
    try {
      const review=observed || await host.reviewPageMerge(this.pageId,this.target);
      if(this.closed||host.isLifecycleStopped()||generation!==this.reviewGeneration)return;
      const integratedReview=review.integration==="verified" || review.integration===undefined && review.state==="integrated";
      const stamp=JSON.stringify([review,reviewSessions(host,integratedReview?this.pageId:undefined),selectWorkPage(host.settings,this.pageId)?.archived]);
      if(background && stamp===this.reviewStamp) {
        loading.setText(this.footerGuidance);
        controls.forEach(({control,disabled})=>{control.disabled=disabled;});
        if(focused?.isConnected && controls.some(({control})=>control===focused) &&
          (!root.ownerDocument.activeElement || root.ownerDocument.activeElement===root.ownerDocument.body))focused.focus({preventScroll:true});
        return; // Preserve scroll, focus and explicit confirmation when nothing changed.
      }
      const scrollTop=this.reviewTarget===review.target?.directory?this.reviewBody?.scrollTop || 0:0;
      root.empty();
      const header=root.createDiv("auto-oc-finish-header");header.createEl("h3",{text:"Merge review"});
      loading=header.createEl("p",{cls:"auto-oc-finish-context"});
      this.reviewStatus=loading;
      this.target=review.target?.directory;
      loading.setText("Source: "+review.source.branch+" · "+review.source.head.slice(0,8));
      header.createEl("p",{text:review.source.directory,cls:"auto-oc-finish-path"});
      const body=root.createDiv("auto-oc-finish-body");
      new Setting(body).setName("Target branch").setDesc("Choose a checked-out local branch in this repository. AutoOC does not switch branches.").addDropdown(dropdown=>{
        review.targets.forEach(t=>dropdown.addOption(t.directory,t.branch+" · "+t.directory));
        if(this.target)dropdown.setValue(this.target);
        dropdown.onChange(value=>{if(this.busy)return;this.target=value;this.feedback="";void this.refresh();});
      });
      if(review.target)body.createEl("p",{text:"Target folder: "+review.target.directory+" · "+review.target.head.slice(0,8),cls:"auto-oc-finish-path"});
      const integrated=integrationSummary(body,review);
      this.blocked=!integrated && (!!review.blockers.length || review.state==="blocked" || review.state==="unavailable");
      const labels:Record<MergeReview["state"],string>={blocked:"Action blocked",ready:"Ready to merge",conflicts:"Conflicts found",resolved:"Ready to complete merge",integrated:"Integration verified",unavailable:"Preview unavailable"};
      const badge=body.createEl("p",{text:labels[review.state],cls:"auto-oc-merge-state auto-oc-merge-"+review.state});badge.setAttr("role","status");
      body.createEl("p",{text:review.inProgress?"Actual merge in progress in the target folder.":integrated?"Committed integration is verified. No Git operation is needed to establish it.":"Pre-merge review. Working files and branches have not been changed by this review."});
      if(!integrated)for(const blocker of review.blockers)body.createEl("p",{text:host.redactSecrets(blocker),cls:"mod-warning"});
      for(const blocker of review.completionBlockers || [])body.createEl("p",{text:host.redactSecrets(blocker),cls:"mod-warning"});
      if(this.feedback)body.createEl("pre",{text:host.redactSecrets(this.feedback),cls:"auto-oc-merge-details"}).setAttr("role","status");
      if(review.details)body.createEl("pre",{text:host.redactSecrets(review.details),cls:"auto-oc-merge-details"});
      blockingSessions(body,this.app,host,()=>this.close(),()=>this.refresh(),integrated?this.pageId:undefined);
      renderPendingFiles(body,host,review.sourceFiles || [],"Pending files in source");
      renderPendingFiles(body,host,review.targetFiles || [],"Pending files in target");
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
        ? "You can review archiving independently of integration. Archiving preserves files and branches. Removing a worktree is a separate action after archiving; discarding its branch has its own loss confirmation."
        : review.inProgress ? "Resolve each conflict in the target folder, review the result, stage the resolved files and run your tests. Recheck conflicts before completing the merge. Closing this dialog leaves the Git merge in progress."
        : "Start merge applies the source commit in the target folder and stops before creating the merge commit, even for a fast-forward. Review the result and run your tests, then choose Complete merge."});
      body.createEl("p",{text:"AutoOC runs Git and prevents new AutoOC work during each operation. Keep schedules paused and external tasks, CLIs and services stopped in both folders until the merge is complete or aborted.",cls:"setting-item-description"});
      const footer=root.createDiv("auto-oc-finish-footer");
      this.footerGuidance=mergeFooterGuidance(review,text=>host.redactSecrets(text));
      const progress=footer.createEl("p",{text:this.footerGuidance,cls:"auto-oc-finish-status"});progress.setAttr("role","status");
      this.reviewStatus=progress;
      const commands=footer.createDiv("auto-oc-page-actions");
      const execute=(label:string,operation:MergeCommand,confirmed=()=>false)=>{
        const button=commands.createEl("button",{text:label,cls:operation==="abort"?"mod-warning":"mod-cta"});
        button.onclick=async()=>{
          if(this.busy||this.closed||host.isLifecycleStopped()||button.disabled)return;
          // A user action supersedes an automatic read. Git revalidates the
          // displayed hash under the mutation reservation before any effect.
          this.reviewGeneration++;this.refreshing=false;
          this.busy=true;
          root.querySelectorAll<HTMLButtonElement|HTMLSelectElement|HTMLInputElement>("button, select, input").forEach(control=>{control.disabled=true;});
          progress.setText(label+" in progress. Wait for Git to finish.");
          let updated:MergeReview|undefined;
          try {
            const result=await host.executePageMerge(this.pageId,review.target!.directory,review.hash,operation,confirmed());
            updated=result.review;
            const message=operation==="abort"?"Merge aborted.":result.review.state==="integrated"?"Merge completed. Integration verified."
              :result.review.state==="conflicts"?"Merge started. Resolve the conflicts in the target folder.":"Merge started. Review the result before completing it.";
            this.feedback=message+(result.output?"\n\n"+result.output:"");new Notice(message);
          } catch(error) {this.feedback=errorText(host,error);new Notice(this.feedback);}
          finally {this.busy=false;if(!this.closed&&!host.isLifecycleStopped())await this.refresh(updated);}
        };
        return button;
      };
      if(!review.blockers.length) {
        if(!review.inProgress&&["ready","conflicts"].includes(review.state))execute("Start merge","start");
        if(review.state==="resolved")execute("Complete merge","complete").disabled=!!review.completionBlockers?.length;
        if(review.inProgress&&["resolved","conflicts"].includes(review.state)) {
          let confirmed=false;
          const abort=execute("Abort merge","abort",()=>confirmed);abort.disabled=true;
          new Setting(body).setName("I accept discarding conflict-resolution edits when aborting")
            .setDesc("Save any resolution edits you want to keep before aborting this merge.")
            .addToggle(toggle=>toggle.setValue(false).onChange(value=>{if(this.busy)return;confirmed=value;abort.disabled=!value;}));
        }
      }
      const buttons=footer.createDiv("auto-oc-page-actions");
      if(!selectWorkPage(host.settings,this.pageId).archived)action(buttons,"Review archiving",host,async()=>{
        this.close();new FinishWorkModal(this.app,host,this.pageId,this.finished).open();
      });
      buttons.createEl("button",{text:"Recheck conflicts"}).onclick=()=>this.refresh();
      buttons.createEl("button",{text:"Close"}).onclick=()=>{if(!this.busy)this.close();};
      body.scrollTop=scrollTop;this.reviewBody=body;this.reviewTarget=this.target;this.reviewStamp=stamp;
    } catch(error) {if(!this.closed&&generation===this.reviewGeneration){
      this.reviewStamp=undefined;this.blocked=true;
      // Retain the last review for context, but never enable its stale Git actions.
      root.querySelectorAll<HTMLButtonElement|HTMLSelectElement|HTMLInputElement>("button, select, input").forEach(control=>{control.disabled=true;});
      let footer=root.querySelectorAll<HTMLElement>(".auto-oc-finish-footer")[0];
      if(!footer)footer=root.createDiv("auto-oc-finish-footer");
      footer.empty();
      loading=footer.createEl("p",{cls:"auto-oc-finish-status"});loading.setAttr("role","status");
      this.reviewStatus=loading;
      const diagnostic=errorText(host,error).replace(/\s+/g," ").trim();
      this.footerGuidance="";
      loading.setText("Review failed: "+(diagnostic.length>180?diagnostic.slice(0,180)+"…":diagnostic)+". Readiness is unverified. Check Git and the target folder, then choose Retry review.");
      loading.title=diagnostic;
      loading.createEl("button",{text:"Retry review"}).onclick=()=>{this.target=undefined;return this.refresh();};
      loading.createEl("button",{text:"Close"}).onclick=()=>this.close();
    }}
    finally{if(generation===this.reviewGeneration){this.refreshing=false;if(!background)this.busy=false;}}
  }
  onClose(){this.closed=true;this.stopWatching?.();this.contentEl.empty();}
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
    this.contentEl.createEl("p",{text:"This is a read-only preview. To close this page, return to it and choose Archive page. No merge is performed here."});
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
    body.createEl("p",{text:"The page leaves the workspace list. Its history and completed removal evidence stay available in Deleted page history. To use a remaining folder again, create a new page."});
    const blocker=pageDeletionBlockers(host.settings,page).join("\n");
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
  private blocked=false;
  private closed=false;
  private stopWatching?:()=>void;
  constructor(app:App,private host:WorkPagesHost,private pageId:string,private finished:()=>void){super(app);}
  onOpen(){this.stopWatching=watchPageReview(this.host,()=>this.refresh(),()=>this.busy,()=>this.blocked);void this.refresh();}
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
      this.blocked=!!review.blockers.length;
      const page=selectWorkPage(host.settings,this.pageId);
      loading.setText(page.name+" · "+page.branch);
      header.createEl("p",{text:page.directory,cls:"auto-oc-finish-path"});
      const body=root.createDiv("auto-oc-finish-body");
      blockingSessions(body,this.app,host,()=>this.close(),()=>this.refresh(),page.id);
      body.createEl("p",{text:review.stage==="branch-only"
        ? "The folder is already gone. Confirm to delete only the reviewed local branch."
        : "This deletes the worktree folder, ALL its files (including untracked and ignored files such as .env), and its local branch. Unlike Archive page, this cannot be restored from AutoOC.",cls:"mod-warning"});
      body.createEl("p",{text:"Page history is kept. No merge or remote branch deletion is performed. Preserve anything you need before continuing."});
      if(page.worktreeRemoval)body.createEl("p",{text:"An earlier discard was interrupted. Close its Git process and sessions using this worktree first. This is a new explicit confirmation, not an automatic retry.",cls:"mod-warning"});
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
      new Setting(body).setName("I accept losing these files and the local branch, and have closed sessions, services and Git processes using this worktree")
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
  onClose(){this.closed=true;this.stopWatching?.();this.contentEl.empty();}
}

class FinishWorkModal extends Modal {
  private busy=false;
  private blocked=false;
  private closed=false;
  private stopWatching?:()=>void;
  constructor(app:App,private host:WorkPagesHost,private pageId:string,private finished:()=>void,private removeOnly=false){super(app);}
  onOpen(){this.stopWatching=watchPageReview(this.host,()=>this.refresh(),()=>this.busy,()=>this.blocked);void this.refresh();}
  private async refresh(){
    if(this.busy || this.closed)return;
    this.busy=true;
    const root=this.contentEl,host=this.host;
    this.modalEl.addClass("auto-oc-work-page-dialog");root.empty();root.addClass("auto-oc-finish-modal");
    const header=root.createDiv("auto-oc-finish-header");
    header.createEl("h3",{text:this.removeOnly?"Remove worktree folder":"Archive page"});
    const loading=header.createEl("p",{text:"Checking integration, activity and files.",cls:"auto-oc-finish-context"});
    try{
      const page=selectWorkPage(host.settings,this.pageId);
      let integration:MergeReview|undefined,integrationError="";
      if(page.kind==="worktree" && !page.worktreeRemoval && host.reviewPageMerge){
        try{integration=await host.reviewPageMerge(page.id);}catch(error){integrationError=errorText(host,error);}
      }
      const review=await host.reviewPageFinish(page.id);
      if(this.closed || host.isLifecycleStopped())return;
      this.blocked=!!review.archiveBlockers.length || this.removeOnly && !!review.removalBlockers.length;
      loading.setText(page.name+" — "+(page.kind==="worktree"?page.branch:"Existing folder"));
      header.createEl("p",{text:page.directory,cls:"auto-oc-finish-path"});
      const body=root.createDiv("auto-oc-finish-body");
      if(integration)integrationSummary(body,integration);
      else if(integrationError)body.createEl("p",{text:"Integration could not be checked: "+integrationError+" Archiving does not certify integration.",cls:"mod-warning"});
      body.createEl("p",{text:this.removeOnly
        ? "Remove only this archived page's clean worktree folder. Its branch, commits and page history remain. This does not perform a merge or delete the branch."
        : page.kind==="folder"?"This page uses an existing folder. Archive page closes the page and keeps all files. It does not delete or merge any Git branch."
        : "Archive page preserves the folder, branch, commits and history, including pending local configuration. Integration and worktree/branch removal are separate actions."});
      if(page.kind==="worktree" && !page.worktreeRemoval)action(body,"Merge review",host,async()=>{this.close();new MergeReviewModal(this.app,host,page.id,this.finished).open();});
      if(page.kind==="folder"){
        body.createEl("strong",{text:"Discard work is unavailable for this page."});
        body.createEl("p",{text:"No independent worktree was created. This applies even if you have not made any changes."});
        body.createEl("p",{text:"For a separate folder and branch, enable Settings > Execution > Git worktrees (developers), then create a New Git worktree page."});
      }
      body.createEl("h4",{text:"Sessions and runs"});
      body.createEl("p",{text:review.archiveBlockers.length?review.archiveBlockers.join("\n"):"No blocking sessions or pending executions were found. Independent Main helpers may stay open.",cls:review.archiveBlockers.length?"mod-warning":""});
      blockingSessions(body,this.app,host,()=>this.close(),()=>this.refresh(),page.id);
      const active=(host.settings.pageRuns || []).filter(run=>host.ownsExecution(run.workflowId,run.runId));
      for(const run of active){
        const pageName=host.settings.workPages?.find(p=>p.id===run.pageId)?.name || run.pageId;
        body.createEl("p",{text:host.redactSecrets(pageName+" — "+run.name+" — "+run.runId)});
        action(body,"Stop "+run.name,host,async()=>{await host.stopWorkPage(run);await this.refresh();});
      }
      renderPendingFiles(body,host,review.files || [],"Pending files in this page");
      const changes=body.createEl("details",{cls:"auto-oc-finish-changes"});
      changes.createEl("summary",{text:"Show diff — optional when keeping the folder"});
      renderPageDiff(changes,host.redactSecrets(review.changes));
      if(this.removeOnly && review.removalBlockers.length)body.createEl("p",{text:"Folder removal is unavailable: "+review.removalBlockers.join("\n"),cls:"mod-warning"});
      if(!this.removeOnly)body.createEl("p",{text:"Local changes do not prevent archiving. The page moves to Overview and can be restored. Remove worktree becomes available as a separate action on the archived page."});
      let sessionsClosed=false,confirm:HTMLButtonElement,status:HTMLElement;
      const update=()=>{
        if(!confirm)return;
        const modeBlock=this.removeOnly?(!page.archived || page.kind!=="worktree" || !!page.worktreeRemoval || !!review.removalBlockers.length || !sessionsClosed):!!page.archived;
        confirm.disabled=this.busy || !!review.archiveBlockers.length || modeBlock;
        status.setText(this.busy?"Saving — wait for confirmation.":review.archiveBlockers.length?"Cannot continue yet: "+review.archiveBlockers.join(" ")
          :this.removeOnly&&!page.archived?"Archive the page first. No files have been removed."
          :this.removeOnly&&review.removalBlockers.length?review.removalBlockers.join(" ")
          :this.removeOnly&&!sessionsClosed?"Confirm that external sessions and services have ended before removing the folder."
          :this.removeOnly?"Ready to remove the clean worktree folder. Branch and history stay."
          :page.archived?"This page is already archived.":"Ready to archive. All files and branches stay; no merge or deletion.");
      };
      if(this.removeOnly)new Setting(body).setName("I closed external sessions and services using this worktree")
        .addToggle(toggle=>toggle.setValue(false).onChange(value=>{sessionsClosed=value;update();}));
      const footer=root.createDiv("auto-oc-finish-footer");
      status=footer.createEl("p",{cls:"auto-oc-finish-status"});status.setAttr("role","status");
      const feedback=footer.createEl("p");feedback.setAttr("role","alert");
      const buttons=footer.createDiv("auto-oc-page-actions");
      confirm=buttons.createEl("button",{text:this.removeOnly?"Remove worktree folder":"Archive page",cls:this.removeOnly?"mod-warning":"mod-cta"});
      confirm.onclick=async()=>{
        if(this.busy || confirm.disabled || this.closed || host.isLifecycleStopped())return;
        this.busy=true;update();
        try{
          await host.finishWorkPage(page.id,review.hash,this.removeOnly,this.removeOnly&&sessionsClosed);
          this.close();this.finished();new Notice(this.removeOnly?"Worktree folder removed. Branch and page history kept.":"Page archived. All files kept. Restore it from Overview.");
        }catch(error){feedback.setText(errorText(host,error)+" Refresh the review. If removal is pending, use Check removal on the page.");}
        finally{this.busy=false;update();}
      };
      buttons.createEl("button",{text:"Refresh review"}).onclick=()=>this.refresh();
      buttons.createEl("button",{text:"Cancel"}).onclick=()=>{if(!this.busy)this.close();};
      this.busy=false;update();
    }catch(error){if(!this.closed){
      loading.setText("Could not check this page: "+errorText(host,error));
      root.createEl("button",{text:"Retry review"}).onclick=()=>this.refresh();
      root.createEl("button",{text:"Cancel"}).onclick=()=>this.close();
    }}finally{this.busy=false;}
  }
  onClose(){this.closed=true;this.stopWatching?.();this.contentEl.empty();}
}

const terminalClaimRegions = new WeakMap<HTMLElement,()=>void>();
const pageContentRegions = new WeakMap<HTMLElement,()=>void>();
/** Page-owned regions only: never replace the mounted Dashboard or history disclosure. */
export function refreshWorkPageContent(parent:HTMLElement):void {
  for(const region of Array.from(parent.querySelectorAll<HTMLElement>(".auto-oc-page-refresh-region")))pageContentRegions.get(region)?.();
}
function pageContentRegion(region:HTMLElement, signature:()=>unknown, render:()=>void, fallback?:HTMLElement) {
  region.addClass("auto-oc-page-refresh-region");
  let previous:string|undefined;
  const refresh=()=>{
    const next=JSON.stringify(signature() ?? null);
    if(next===previous)return;
    const focused=region.ownerDocument?.activeElement as HTMLElement|null;
    const hadFocus=!!focused && region.contains(focused);
    const key=hadFocus?focused.getAttribute("data-page-focus"):null;
    region.empty();render();
    // Keys use Page/run identity, not row position or user-controlled CSS selectors.
    const controls=Array.from(region.querySelectorAll<HTMLElement>("button"));
    for(const control of controls)if(!control.getAttribute("data-page-focus"))control.setAttr("data-page-focus",control.textContent || "");
    previous=next;
    if(hadFocus) {
      const enabled=controls.filter(control=>!(control as HTMLButtonElement).disabled);
      (enabled.find(control=>control.getAttribute("data-page-focus")===key) || fallback || enabled[0])?.focus({preventScroll:true});
    }
  };
  pageContentRegions.set(region,refresh);refresh();
}
/** Refresh session summaries without rebuilding the Dashboard or its open dialogs. */
export function refreshWorkPageTerminals(parent:HTMLElement):void {
  for(const region of Array.from(parent.querySelectorAll<HTMLElement>(".auto-oc-terminal-claims")))terminalClaimRegions.get(region)?.();
}
function terminalClaims(parent:HTMLElement, app:App, host:WorkPagesHost, pageId?:string, openPage?:(id:string)=>void) {
  const region=parent.createDiv("auto-oc-terminal-claims");
  let previous:string|undefined;
  const refresh=()=>{
    const claims=(host.settings.pageTerminalClaims || []).filter(item=>!pageId || item.pageId===pageId);
    const next=JSON.stringify(claims.map(claim=>[claim,host.pageTerminalState?.(claim.id),host.hasPageTerminal?.(claim.pageId)]));
    if(next===previous)return;
    region.empty();renderTerminalClaims(region,app,host,pageId,openPage);previous=next;
  };
  terminalClaimRegions.set(region,refresh);refresh();
}
function renderTerminalClaims(parent:HTMLElement, app:App, host:WorkPagesHost, pageId?:string, openPage?:(id:string)=>void) {
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
          try { await host.confirmPageTerminal(claim.id); terminalClaimRegions.get(parent)?.(); modal.close(); resolve(); }
          catch (error) {new Notice(errorText(host,error));}
        };
        modal.contentEl.createEl("button",{text:"Cancel"}).onclick = () => modal.close();
        modal.onClose = () => {modal.contentEl.empty(); resolve();}; modal.open();
      });
    });
  }
}
function runs(parent:HTMLElement, app:App, host:WorkPagesHost, pageId?:string, openPage?:(id:string)=>void, source?:{id:string;task:boolean}) {
  const deletedIds=new Set((host.settings.deletedWorkPages || []).map(entry=>entry.page.id));
  const history = (host.settings.pageRuns || []).filter(run => (!pageId || run.pageId === pageId) &&
    (pageId || !deletedIds.has(run.pageId)) &&
    (!source || run.sourceId === source.id && run.task === source.task)).slice().reverse();
  for (const run of history) {
    const row = parent.createDiv("auto-oc-page-row"), active = host.ownsExecution(run.workflowId,run.runId);
    row.createEl("p",{text:(pageId ? "" : (host.settings.workPages?.find(p=>p.id===run.pageId)?.name || run.pageId) + " · ") + run.name + " · " + run.phase + (run.uncertain ? " · outcome needs review" : "")});
    row.createEl("small",{text:run.runId});
    action(row,"Log",host,async()=>new TextModal(app,run.name,host.pageRunOutput(run)).open());
    if(deletedIds.has(run.pageId))continue;
    if (openPage) {
      row.createEl("button", {text:"Open page"}).onclick = () => openPage(run.pageId);
      continue;
    }
    if (active) action(row,"Stop",host,()=>host.stopWorkPage(run));
    else if (!["completed","failed","abandoned"].includes(run.phase) || run.uncertain) {
      action(row,"Continue",host,()=>host.runWorkPage(run.pageId,run.sourceId,run.task,run.runId,false),run.uncertain);
      action(row,"Reconcile",host,()=>host.runWorkPage(run.pageId,run.sourceId,run.task,run.runId,true));
    }
    for(const button of Array.from(row.querySelectorAll<HTMLElement>("button")))button.setAttr("data-page-focus",JSON.stringify([run.pageId,run.workflowId,run.runId,button.textContent]));
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
  const selectedTask=host.settings.tasks.find(task=>task.id===(item.taskId || (source.task?source.id:undefined)));
  const standaloneInteractive=!!item.workflowId && item.kind==="task" && !!selectedTask && (selectedTask.taskKind==="cli" || selectedTask.interactiveTerminal===true);
  if (item.workflowId) modal.contentEl.createEl("p",{text:standaloneInteractive
    ? "Run this interactive task on its own to open its agent in this page folder. Other workflow steps will not run; the session must end before more work starts here."
    : "This selection is a workflow step. Run the complete workflow here; running a single step is available only in Main workspace."});
  if(selectedTask?.workingDirectory)modal.contentEl.createEl("p",{text:"Fixed task folder: "+selectedTask.workingDirectory+". If it is outside this page, execution is blocked. Leave the shared task folder empty when it should inherit the selected page."});
  const feedback=modal.contentEl.createEl("p");feedback.setAttr("role","alert");
  const run=async(id:string,task:boolean)=>{
    feedback.setText("");
    try {await host.runWorkPage(pageId,id,task);modal.close();}
    catch(error){feedback.setText(errorText(host,error));throw error;}
  };
  if(standaloneInteractive)action(modal.contentEl,"Run this task only",host,()=>run(selectedTask!.id,true),
    !!page.archived || !!page.worktreeRemoval || !!item.disabled || !definition || !!definition.disabled || !!selectedTask!.disabled);
  action(modal.contentEl,source.task ? "Run task here" : "Run workflow here",host,async()=>{
    await run(source.id,source.task);
  },!!page.archived || !!page.worktreeRemoval || !definition || !!definition.disabled);
  modal.contentEl.createEl("button",{text:"Edit shared definition"}).onclick = ()=>{modal.close();edit();};
  runs(modal.contentEl,app,host,pageId,undefined,source);
  if(standaloneInteractive){modal.contentEl.createEl("h4",{text:"Standalone task runs in this page"});runs(modal.contentEl,app,host,pageId,undefined,{id:selectedTask!.id,task:true});}
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
  pageContentRegion(nav,()=>host.settings.workPages?.map(page=>[page.id,page.name,page.archived]),()=>{
    const currentEntries = [{id:"main",name:"Main workspace"},...(host.settings.workPages || [])];
    for (const page of currentEntries.filter(page=>!("archived" in page && page.archived) || page.id === selected)) {
      const button = nav.createEl("button",{text:page.name + (("archived" in page && page.archived) ? " (archived)" : "")});
      button.setAttr("data-page-focus",page.id);
      button.setAttr("aria-pressed",String(page.id === selected)); button.onclick = () => select(page.id);
    }
    if (selected !== "general") nav.createEl("button",{text:"+ New page"}).onclick = () => new NewPageModal(app,host,select).open();
  });
  if (selected === "main") { renderMainWorkspace(parent,app,host); terminalClaims(parent,app,host,"main"); return false; }
  if (selected === "general") {
    parent.createEl("h3",{text:"Overview"});
    parent.createEl("p",{text:"View activity and logs here. Use CLI to choose a workspace, or open a page to run workflows and manage its sessions. Import updates the shared task and workflow catalog; schedules run in Main workspace."});
    if(host.settings.deletedWorkPages?.length)action(parent,"Deleted page history",host,async()=>{
      const modal=new Modal(app);modal.modalEl.addClass("auto-oc-work-page-dialog");
      modal.contentEl.createEl("h3",{text:"Deleted page history"});
      modal.contentEl.createEl("p",{text:"Read-only records. These pages cannot run tasks or be restored. Their files and branches were not changed by Delete page."});
      for(const entry of host.settings.deletedWorkPages || []) {
        const row=modal.contentEl.createEl("details");
        row.createEl("summary",{text:entry.page.name+" - "+entry.deletedAt});
        row.createEl("p",{text:entry.page.directory});
        if(entry.page.worktreeRemoval)row.createEl("p",{text:entry.page.worktreeRemoval.mode==="discard"?"Worktree and branch removal confirmed.":"Worktree removal confirmed; branch kept."});
        runs(row,app,host,entry.page.id);
      }
      modal.contentEl.createEl("button",{text:"Close"}).onclick=()=>modal.close();modal.open();
    });
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
  const shell=parent.createDiv();
  pageContentRegion(shell,()=>[host.settings.workPages?.find(page=>page.id===selected),host.hasPageTerminal?.(selected),
    host.settings.pageTerminalClaims?.some(claim=>claim.pageId===selected)],()=>{
    const current=host.settings.workPages?.find(page=>page.id===selected);
    if(current)renderPageControls(shell,app,host,current,select,openCli,()=>refreshWorkPageContent(parent));
  });
  parent.createEl("p",{text:"All tasks and workflows from Main workspace are available here automatically. Results belong to this page. Edits are shared; schedules run in Main workspace.",cls:"setting-item-description"});
  renderCatalog?.(parent,page);
  const history = parent.createEl("details"), summary=history.createEl("summary",{text:"Page executions"});
  const content=history.createDiv();
  pageContentRegion(content,()=>[
    (host.settings.pageRuns || []).filter(run=>run.pageId===selected).map(run=>[run,host.ownsExecution(run.workflowId,run.runId)]),
    host.settings.deletedWorkPages?.some(entry=>entry.page.id===selected)
  ],()=>runs(content,app,host,selected),summary);
  terminalClaims(parent,app,host,page.id);
  return true;
}

function renderPageControls(parent:HTMLElement,app:App,host:WorkPagesHost,page:WorkPage,select:(id:string)=>void,
  openCli:(page:WorkPage)=>void,refresh:()=>void) {
  parent.createEl("h3",{text:page.name});
  parent.createEl("p",{text:page.objective || "No objective set."});
  parent.createEl("p",{text:page.directory,cls:"auto-oc-cli-path"});
  if (page.branch) parent.createEl("p",{text:"Branch: " + page.branch});
  if (page.kind === "folder") parent.createEl("p",{text:"Existing folder · no separate worktree or branch was created. Files are shared with anyone using this folder.",cls:"setting-item-description"});
  const controls = parent.createDiv("auto-oc-page-actions");
  if(page.archived) action(controls,"Delete page",host,async()=>new DeletePageModal(app,host,JSON.parse(JSON.stringify(page)),()=>select("general")).open());
  action(controls,"CLI in this page",host,async()=>openCli({...page}),!!page.archived || !!page.worktreeRemoval);
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
    if(!page.archived)action(controls,"Archive page",host,async()=>new FinishWorkModal(app,host,page.id,()=>select("main")).open());
    if(page.archived && page.kind==="worktree")action(controls,"Remove worktree",host,async()=>new FinishWorkModal(app,host,page.id,()=>select("main"),true).open());
    if (page.archived) action(controls,"Restore page",host,async()=>{
      host.assertPagesEditable();
      const current = {...selectWorkPage(host.settings,page.id)};
      if (current.worktreeRemoval) throw new Error("This worktree is unavailable. Keep its page history and link a new environment instead.");
      await describePageFolder(current.directory,current.kind === "worktree");
      host.assertPagesEditable();
      const latest = selectWorkPage(host.settings,page.id);
      if (latest.worktreeRemoval || latest.directory !== current.directory || latest.kind !== current.kind)
        throw new Error("This page changed while its folder was checked. Review the page before restoring it.");
      await saveField(host,"workPages",host.settings.workPages!.map(p=>p.id===page.id?{...p,archived:false}:p));
      refresh();
    });
  }
}
