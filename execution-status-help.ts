import { App, Modal, Notice } from "obsidian";

export interface ExecutionHelpSnapshot {
  name: string;
  status: string;
  runId?: string;
  phase?: string;
  owned: boolean;
  requiresReconciliation?: boolean;
  terminalUncertainty?: boolean;
  disposition?: boolean;
  waitingApproval?: boolean;
  stopUnconfirmed?: boolean;
  workflowName?: string;
}

// Presentation only: an absent local owner is not evidence of an orphan process.
// Never use this guidance to admit, resume, stop or modify an execution.
export function executionStatusHelp(s: ExecutionHelpSnapshot) {
  if (s.waitingApproval) return {
    label: "Waiting for your approval", attention: true,
    explanation: "The engine is waiting for your decision on a specific action.",
    next: "Open the details, review the request, and choose approve or reject. You do not need to run the task again.",
  };
  if (s.stopUnconfirmed) return {
    label: "Stop not confirmed", attention: true,
    explanation: "A stop was requested, but the work has not been confirmed as finished.",
    next: "Read the log and check the original window or process before starting another run.",
  };
  if (s.owned) return {
    label: "Run controlled by this window", attention: false,
    explanation: "This window controls this run. A completed task may belong to a workflow that is still progressing.",
    next: "You can read the log. To stop the work, use the task or workflow stop control.",
  };
  if (s.requiresReconciliation || (s.terminalUncertainty && !s.disposition)) return {
    label: "Needs review", attention: true,
    explanation: "The outcome or completion of recorded work could not be confirmed. A completed label on the card does not resolve that uncertainty.",
    next: "Open the run details and read the log. Check its effects and whether the process is still active before using the available review or continuation options. Do not repeat the run just to dismiss this warning.",
  };
  if (s.phase === "ready" || s.phase === "in_flight" || s.status === "running") return {
    label: "Activity not confirmed", attention: true,
    explanation: "A pending or ongoing run is not controlled by this window. It may still be running elsewhere or may have been interrupted; the available information does not distinguish between these cases.",
    next: "Check the window or terminal where you started it. If it is still working, wait. If it has finished, review the log and run options before continuing.",
  };
  if (s.disposition || s.phase === "abandoned") return {
    label: "Closed with unknown outcome", attention: false,
    explanation: "This run was closed with its effects still uncertain. It has not been marked as successful.",
    next: "The history is preserved. Review the previous effects before deciding whether to start another run.",
  };
  if (s.phase === "failed" || s.status === "failed") return {
    label: "Last run failed", attention: true,
    explanation: "The saved run ended with an error. Having no window controlling it is not another failure.",
    next: "Read the log to find the cause and address it before deciding whether to start a new run.",
  };
  if (s.phase === "completed") return {
    label: "Last run completed", attention: false,
    explanation: "The saved run has finished. It no longer needs a window to control it.",
    next: "You do not need to unlock or recover this run. You can read its log or history. Running it again would start new work.",
  };
  return {
    label: "Run information", attention: false,
    explanation: "The available information does not confirm the state of this run.",
    next: "Read the log and history. If you need support, copy the diagnostics from this window; do not delete files to unlock the run.",
  };
}

export class ExecutionStatusHelpModal extends Modal {
  constructor(app: App, private snapshot: () => ExecutionHelpSnapshot | undefined,
    private showDetails: () => void, private version: string) { super(app); }

  onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("auto-oc-execution-help");
    const current = this.snapshot();
    root.createEl("h3", { text: "Execution help" });
    if (!current) {
      root.createEl("p", { text: "This item is no longer available. Close this help window and check the panel again." });
      return;
    }
    const help = executionStatusHelp(current);
    root.createEl("p", { text: current.name });
    if (current.workflowName) root.createEl("p", { text: `Workflow run: ${current.workflowName}` });
    root.createEl("h4", { text: help.label });
    root.createEl("p", { text: help.explanation });
    root.createEl("h4", { text: "What you can do" });
    root.createEl("p", { text: help.next });
    root.createEl("p", { text: "This help reads the information available in the panel. It does not run tasks or change their state.", cls: "setting-item-description" });
    const actions = root.createDiv("auto-oc-card-actions");
    actions.createEl("button", { text: current.workflowName ? "View workflow and options" : "View details and options" }).onclick = () => {
      this.close();
      this.showDetails();
    };
    actions.createEl("button", { text: "Refresh information" }).onclick = () => this.onOpen();
    const technical = root.createEl("details");
    technical.createEl("summary", { text: "Support details" });
    // Deliberate allowlist: never copy prompts, output, tokens, paths or secrets.
    const diagnostic = JSON.stringify({ version: this.version, status: current.status,
      phase: current.phase, runId: current.runId, localControl: current.owned,
      requiresReview: !!current.requiresReconciliation, uncertainOutcome: !!current.terminalUncertainty,
      dispositionRecorded: !!current.disposition, waitingApproval: !!current.waitingApproval,
      stopUnconfirmed: !!current.stopUnconfirmed }, null, 2);
    technical.createEl("pre", { text: diagnostic });
    technical.createEl("button", { text: "Copy diagnostics" }).onclick = async () => {
      try { await navigator.clipboard.writeText(diagnostic); new Notice("Diagnostics copied."); }
      catch { new Notice("Could not copy. You can select the diagnostics text instead."); }
    };
  }

  onClose() { this.contentEl.empty(); }
}
