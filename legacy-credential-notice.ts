import { Modal, Setting, type App } from "obsidian";
import type { LegacyMaskingIssue } from "./legacy-output-redaction";

const explanations = {
  "storage-unavailable": "This device cannot currently access the secure storage used to read the old credentials.",
  "decryption-failed": "Some old credentials could not be decrypted with the secure storage available on this device.",
  "invalid-store": "The historical credential file is incomplete or has an unsupported structure.",
  "unreadable-store": "The historical credential file could not be read. Check that this operating-system account can access it, then retry.",
};

export class LegacyCredentialNoticeModal extends Modal {
  private message = "";
  constructor(app: App, private host: {
    review: () => LegacyMaskingIssue | undefined;
    acknowledge: (id: string) => void;
    onClosed?: () => void;
  }) { super(app); }

  onOpen(): void {
    const root = this.contentEl; root.empty();
    root.createEl("h2", {text: "Legacy credential notice"});
    let issue: LegacyMaskingIssue | undefined;
    try { issue = this.host.review(); }
    catch { root.createEl("p", {text: "The current installation could not be checked. Close this dialog and try again after AutoOC finishes loading."}); return; }
    if (!issue) {
      root.createEl("p", {text: "No legacy credential issue was found. Available historical values are masked automatically; an empty or absent historical store needs no action."});
    } else {
      root.createEl("p", {text: explanations[issue.reason]});
      root.createEl("p", {text: "This notice does not block task execution. It concerns the retired Secrets feature, not your CLI sign-in. AutoOC cannot automatically hide every unreadable old value in task output."});
      root.createEl("p", {text: "To restore masking, retry with the original operating-system account and its secure storage available. If the file is damaged, recover a known-good copy from your own backup. AutoOC cannot reconstruct encrypted values."});
      root.createEl("p", {text: "You can keep the historical file and dismiss this reminder on this device. This only dismisses the reminder: AutoOC continues checking and masking the values it can read. Tasks, workflows, history and the historical file stay unchanged. A changed file or a different problem needs a new review."});
      if (issue.acknowledged) root.createEl("p", {text: "Reminder dismissed on this device. Masking of some old values is still unavailable."});
      if (!issue.dismissible) root.createEl("p", {text: "The reminder cannot be saved until the file can be read and identified."});
    }
    if (this.message) root.createEl("p", {text: this.message});
    const controls = new Setting(root);
    controls.settingEl.style.display = "block";
    controls.controlEl.style.flexWrap = "wrap";
    controls.addButton(button => button.setButtonText("Try reading again").onClick(() => {
      this.message = ""; this.onOpen();
    }));
    if (issue && !issue.acknowledged) {
      const reviewed = issue;
      controls.addButton(button => button.setButtonText("Keep file and dismiss reminder").setDisabled(!reviewed.dismissible).onClick(() => {
        try { this.host.acknowledge(reviewed.id); this.message = "Reminder preference saved. No task was started."; }
        catch { this.message = "The file changed or the local preference could not be saved. Try reading again; the historical file has not been changed."; }
        this.onOpen();
      }));
    }
    controls.addButton(button => button.setButtonText("Close").onClick(() => this.close()));
  }

  onClose(): void { this.contentEl.empty(); this.host.onClosed?.(); }
}
