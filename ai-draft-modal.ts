import { App, Modal, Setting, type DropdownComponent } from "obsidian";
import { buildDraftPrompt, parseGeneratedDraft, type DraftDefaults, type DraftEngine, type DraftKind, type GeneratedDraft } from "./ai-draft";

export interface AiDraftOptions {
  kind: DraftKind;
  guide: string;
  version: string;
  engine: DraftEngine;
  objective?: string;
  defaults: () => DraftDefaults;
  models?: (engine: DraftEngine) => { value: string; label: string }[];
  generate: (prompt: string, engine: DraftEngine, model: string, signal: AbortSignal) => Promise<string>;
  useDraft: (draft: GeneratedDraft) => void;
  onClosed?: () => void;
}

export class AiDraftModal extends Modal {
  private controller?: AbortController;
  private closed = false;
  private engine: DraftEngine;
  private objective: string;
  private model: string;
  private selectedModels: Partial<Record<DraftEngine, string>> = {};

  constructor(app: App, private readonly options: AiDraftOptions) {
    super(app);
    this.engine = options.engine;
    this.objective = options.objective || "";
    this.model = this.defaultModel();
  }

  private defaultModel(): string {
    const defaults = this.options.defaults();
    return (this.engine === "codex" ? defaults.codexModel : this.engine === "copilot" ? defaults.copilotModel : this.engine === "opencode2" ? defaults.opencode2Model : defaults.model) || "";
  }

  onOpen(): void {
    let invalidate = () => {};
    this.contentEl.addClass("auto-oc-ai-draft");
    this.contentEl.createEl("h2", { text: this.options.kind === "task" ? "Create a task with AI" : "Create a workflow with AI" });
    this.contentEl.createEl("p", { text: "Describe the outcome you want. AI prepares a draft using the WF Builder Prompt, then you finish in the editor. Nothing is saved or scheduled yet." });
    let objectiveInput: HTMLTextAreaElement;
    new Setting(this.contentEl).setName("Objective").setDesc("Include the desired result, useful context and any constraints.")
      .addTextArea(text => {
        objectiveInput = text.inputEl;
        text.inputEl.rows = 7;
        text.inputEl.maxLength = 20000;
        text.setPlaceholder(this.options.kind === "task" ? "Summarize my meeting notes into decisions and next actions…" : "Draft an article, review its accuracy, then prepare a final version…");
        text.setValue(this.objective).onChange(value => { this.objective = value; invalidate(); });
      });
    let engineInput: HTMLSelectElement, modelInput: HTMLInputElement, modelDropdown: DropdownComponent;
    const customValue = "__autooc_custom_model__";
    const fillModels = () => {
      modelDropdown.selectEl.empty();
      modelDropdown.addOption("", "Automatic (CLI default)");
      const models = new Map((this.options.models?.(this.engine) || [])
        .filter(model => model.value.trim() && model.value !== customValue)
        .map(model => [model.value, model.label]));
      if (this.model && !models.has(this.model)) models.set(this.model, this.model);
      for (const [value, label] of models) modelDropdown.addOption(value, label);
      modelDropdown.addOption(customValue, "Other model…");
      modelDropdown.setValue(this.model);
      customModel.settingEl.hidden = true;
      customModel.settingEl.style.display = "none";
      modelInput.value = this.model;
    };
    new Setting(this.contentEl).setName("AI engine").setDesc("Uses your existing CLI sign-in and account.")
      .addDropdown(dropdown => {
        engineInput = dropdown.selectEl;
        dropdown.addOption("opencode", "OpenCode 1").addOption("opencode2", "OpenCode 2").addOption("codex", "Codex CLI (App Server)").addOption("copilot", "GitHub Copilot");
        dropdown.setValue(this.engine).onChange(value => {
          this.selectedModels[this.engine] = this.model;
          this.engine = value as DraftEngine;
          this.model = this.selectedModels[this.engine] ?? this.defaultModel();
          fillModels(); invalidate();
        });
      });
    new Setting(this.contentEl).setName("Model")
      .setDesc("Used to generate the draft and prefill tasks using this engine. Lists models loaded in AutoOC or used by your tasks. You can change each task's model in the editor.")
      .addDropdown(dropdown => {
        modelDropdown = dropdown;
        dropdown.onChange(value => {
          customModel.settingEl.hidden = value !== customValue;
          customModel.settingEl.style.display = value === customValue ? "" : "none";
          if (value === customValue) { modelInput.value = this.model; modelInput.focus(); }
          else this.model = value;
          invalidate();
        });
      });
    const customModel = new Setting(this.contentEl).setName("Other model")
      .setDesc("Enter a model ID available to this engine and your account. Empty uses the CLI default.")
      .addText(text => { modelInput = text.inputEl; text.setValue(this.model).onChange(value => { this.model = value.trim(); invalidate(); }); });
    fillModels();
    const status = this.contentEl.createEl("p", { attr: { role: "status", "aria-live": "polite" } });
    const preview = this.contentEl.createDiv("auto-oc-ai-draft-preview");
    let generateButton: HTMLButtonElement, cancelButton: HTMLButtonElement;
    let result: GeneratedDraft | undefined;
    const actions = new Setting(this.contentEl);
    actions.addButton(button => {
      generateButton = button.buttonEl;
      button.setButtonText("Generate draft").setCta().onClick(async () => {
        if (this.controller || this.closed) return;
        let prompt: string;
        try { prompt = buildDraftPrompt(this.options.guide, this.options.kind, this.objective, this.engine, this.options.version); }
        catch (error) { status.setText((error as Error).message); objectiveInput.focus(); return; }
        result = undefined; preview.empty(); reviewButton.disabled = true;
        const controller = new AbortController(); this.controller = controller;
        generateButton.disabled = engineInput.disabled = modelDropdown.selectEl.disabled = modelInput.disabled = objectiveInput.disabled = true;
        cancelButton.setText("Cancel generation"); status.setText("Generating your draft… This can take up to 3 minutes. You can cancel at any time.");
        try {
          const text = await this.options.generate(prompt, this.engine, this.model, controller.signal);
          if (this.closed || controller.signal.aborted || this.controller !== controller) return;
          const defaults = { ...this.options.defaults(), engine: this.engine };
          if (this.engine === "codex") defaults.codexModel = this.model;
          else if (this.engine === "copilot") defaults.copilotModel = this.model;
          else if (this.engine === "opencode2") defaults.opencode2Model = this.model;
          else defaults.model = this.model;
          result = parseGeneratedDraft(text, this.options.kind, defaults);
          status.setText("Draft ready. Review prompts, steps and permissions in the editor before saving.");
          preview.createEl("h3", { text: result.workflow?.name || result.tasks[0].name });
          if (result.workflow) {
            preview.createEl("p", { text: result.workflow.description });
            const list = preview.createEl("ol");
            for (const step of result.workflow.steps) list.createEl("li", { text: step.name || result.tasks.find(t => t.id === step.taskId)?.name || (step.stepKind === "code" ? "JavaScript step" : "Delay") });
          } else preview.createEl("pre", { text: result.tasks[0].prompt, cls: "auto-oc-ai-draft-prompt" });
          reviewButton.disabled = false;
        } catch (error) {
          if (!this.closed && !controller.signal.aborted) status.setText(`Could not create a draft: ${(error as Error).message}\nCheck the selected engine's installation, sign-in and model, or adjust the objective and try again. Your editor has not changed.`);
        } finally {
          if (this.controller === controller) {
            this.controller = undefined;
            generateButton.disabled = engineInput.disabled = modelDropdown.selectEl.disabled = modelInput.disabled = objectiveInput.disabled = false;
            generateButton.setText("Generate again"); cancelButton.setText("Cancel");
          }
        }
      });
    });
    actions.addButton(button => {
      cancelButton = button.buttonEl;
      button.setButtonText("Cancel").onClick(() => {
        if (!this.controller) { this.close(); return; }
        this.controller.abort();
        status.setText("Generation cancelled. Your editor has not changed. You can change the objective and try again.");
      });
    });
    const reviewButton = this.contentEl.createEl("button", { text: "Review in editor", cls: "mod-cta" });
    reviewButton.disabled = true;
    invalidate = () => {
      if (!result) return;
      result = undefined; reviewButton.disabled = true; preview.empty();
      status.setText("Your request has changed. Generate a new draft to review it.");
    };
    reviewButton.onclick = () => {
      if (!result || this.controller || this.closed) return;
      this.options.useDraft(result); this.close();
    };
    objectiveInput!.focus();
  }

  onClose(): void { this.closed = true; this.controller?.abort(); this.options.onClosed?.(); this.contentEl.empty(); }
}
