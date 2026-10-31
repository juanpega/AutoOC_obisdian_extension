import { App, Modal, Notice, Setting } from "obsidian";
import { bulkSelectionIssues, type BulkAction, type BulkCatalog, type BulkSelection, type CatalogKind } from "./catalog-bulk";

interface BulkHost {
  settings: BulkCatalog;
  getDefinitionStartState(kind: CatalogKind, id: string): string;
  applyBulkSelection(selection: BulkSelection[], action: BulkAction): Promise<void>;
}

export class BulkCatalogModal extends Modal {
  private saving = false;
  // Modal.open() owns `selection` for restoring the editor's DOM selection.
  constructor(app: App, private host: BulkHost, private selectedItems: BulkSelection[], private action: BulkAction,
    private onSaved: () => void) { super(app); }

  onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("auto-oc-modal");
    const deleting = this.action.type === "delete";
    const availability = this.action.type === "availability";
    const disabling = this.action.type === "availability" && this.action.disabled;
    root.createEl("h3", { text: availability ? `${disabling ? "Disable" : "Enable"} selected items?` : deleting ? "Delete selected items?" : "Change area for selected items" });
    root.createEl("p", { text: deleting
      ? "Only the items listed below will be deleted, including their saved output and history in the catalog. Other tasks are kept when deleting a workflow. Execution records on disk are retained. This cannot be undone. Export a copy first if you want to keep these definitions."
      : availability ? disabling
        ? "Keeps these items, their schedules, output and history. Disabled items cannot run manually or on a schedule. Workflows that use a disabled task cannot start until it is enabled again. Disabling a workflow does not disable its reusable tasks."
        : "Allows these items to run again. Their saved schedules become active immediately and may start work on the next scheduler check."
      : "Updates the area of every item listed below. Workflow steps and unselected tasks keep their own areas." });
    const review = root.createEl("ul", { cls: "auto-oc-bulk-review" });
    for (const item of this.selectedItems) review.createEl("li", { text: `${item.kind === "task" ? "Task" : "Workflow"}: ${item.name}` });
    let area = this.action.type === "area" ? this.action.area : "";
    if (this.action.type === "area") {
      let input: HTMLInputElement;
      new Setting(root).setName("Area").setDesc("Choose an existing area or type a new one. Leave empty to remove the area.")
        .addText(text => {
          input = text.inputEl;
          text.setValue(area).setPlaceholder("No area").onChange(value => { area = value; });
        });
      const suggestions = root.createDiv("auto-oc-area-suggestions");
      const names = new Set([...this.host.settings.tasks, ...this.host.settings.workflows].map(item => item.area?.trim()).filter(Boolean));
      for (const name of [...names].sort()) suggestions.createEl("button", { text: name! }).onclick = () => { area = name!; input!.value = area; };
    }
    const issues = bulkSelectionIssues(this.host.settings, this.selectedItems, this.action, (kind, id) => this.host.getDefinitionStartState(kind, id));
    const feedback = root.createDiv("auto-oc-bulk-feedback");
    feedback.setAttr("role", "alert");
    for (const issue of issues) feedback.createEl("p", { text: issue });
    new Setting(root)
      .addButton(button => button.setButtonText("Cancel").onClick(() => { if (!this.saving) this.close(); }))
      .addButton(button => {
        button.setButtonText(availability ? `${disabling ? "Disable" : "Enable"} ${this.selectedItems.length} items` : deleting ? `Delete ${this.selectedItems.length} items` : "Apply area").setDisabled(issues.length > 0);
        if (deleting) button.setWarning(); else button.setCta();
        button.onClick(async () => {
          if (this.saving) return;
          this.saving = true;
          button.setDisabled(true);
          try {
            await this.host.applyBulkSelection(this.selectedItems, this.action.type === "area" ? { type: "area", area } : this.action);
          } catch (error) {
            feedback.empty();
            feedback.createEl("p", { text: `No bulk changes were confirmed. ${error instanceof Error ? error.message : String(error)}` });
            this.saving = false;
            button.setDisabled(false);
            return;
          }
          this.saving = false;
          this.close();
          new Notice(availability ? `${disabling ? "Disabled" : "Enabled"} ${this.selectedItems.length} items.` : deleting ? `Deleted ${this.selectedItems.length} items.` : `Updated the area of ${this.selectedItems.length} items.`);
          this.onSaved();
        });
      });
  }

  onClose() { this.contentEl.empty(); }
}
