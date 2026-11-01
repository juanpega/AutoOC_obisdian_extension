import { Setting } from "obsidian";

interface BubbleSettings {
  dashboardTaskBubbleSize?: string;
  dashboardTaskBubbleDiameter?: number;
}
const validDiameter = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 16 && value <= 80;

export function dashboardTaskDiameter(settings: BubbleSettings): number {
  if (validDiameter(settings.dashboardTaskBubbleDiameter)) return settings.dashboardTaskBubbleDiameter;
  switch (settings.dashboardTaskBubbleSize) {
    case "sm": return 24;
    case "lg": return 38;
    case "xl": return 48;
    default: return 30;
  }
}

/** Preview locally; save only an explicit Apply or Reset, not each keystroke. */
export function addDashboardBubbleSizeSetting(container: HTMLElement, host: {settings: BubbleSettings; saveSettings(): Promise<void>}) {
  let input: HTMLInputElement, apply: HTMLButtonElement, reset: HTMLButtonElement;
  let saving = false;
  const row = new Setting(container).setName("Task and step bubble size")
    .setDesc("Exact diameter in pixels (16–80). Preview changes below; Apply updates the Dashboard.");
  row.addText(text => {
    input = text.inputEl;
    input.type = "number"; input.min = "16"; input.max = "80"; input.step = "1";
    input.style.width = "80px";
    input.setAttribute("aria-label", "Task and step bubble size in pixels");
    text.setValue(String(dashboardTaskDiameter(host.settings))).onChange(() => preview());
  });
  row.addButton(button => {
    apply = button.buttonEl;
    button.setButtonText("Apply").setCta().onClick(() => save());
  });
  row.addButton(button => {
    reset = button.buttonEl;
    button.setButtonText("Reset to default").onClick(() => {
      if (saving) return;
      input.value = "30"; preview(); return save();
    });
  });
  const sample = container.createDiv("auto-oc-bubble-size-preview");
  sample.createSpan({text:"Preview"});
  const bubble = sample.createDiv({cls:"auto-oc-bubble-size-sample", attr:{"aria-hidden":"true"}});
  const feedback = sample.createSpan({attr:{role:"status", "aria-live":"polite"}});
  const value = () => input.value.trim() ? Number(input.value) : NaN;
  function preview() {
    const diameter = value(), valid = validDiameter(diameter);
    input.setAttribute("aria-invalid", String(!valid));
    apply.disabled = saving || !valid || diameter === dashboardTaskDiameter(host.settings);
    if (valid) {
      bubble.style.width = bubble.style.height = `${diameter}px`;
      feedback.setText(`${diameter} px`);
    } else feedback.setText("Enter a whole number from 16 to 80.");
  }
  async function save() {
    const diameter = value();
    if (saving || !validDiameter(diameter)) return;
    saving = true; input.disabled = apply.disabled = reset.disabled = true;
    const previous = host.settings.dashboardTaskBubbleDiameter;
    host.settings.dashboardTaskBubbleDiameter = diameter;
    try {
      await host.saveSettings();
      feedback.setText(`Saved: ${diameter} px`);
    } catch {
      if (host.settings.dashboardTaskBubbleDiameter === diameter) {
        if (previous === undefined) delete host.settings.dashboardTaskBubbleDiameter;
        else host.settings.dashboardTaskBubbleDiameter = previous;
      }
      feedback.setText("Could not save the size. Your previous size is kept. Try Apply again.");
    } finally {
      saving = false; input.disabled = reset.disabled = false;
      apply.disabled = value() === dashboardTaskDiameter(host.settings);
    }
  }
  input!.addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); void save(); }
  });
  preview();
}
