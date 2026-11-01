import { Setting, type App } from "obsidian";

interface BubbleSettings {
  dashboardTaskBubbleSize?: string;
  dashboardTaskBubbleDiameter?: number;
}
const validDiameter = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 10 && value <= 80;

// A visual preference must never serialize or wait for the execution catalog.
// Obsidian scopes this store to the vault. Include the configuration directory
// as well so separate plugin installations in one vault stay independent.
function preferenceStorage(app: App, pluginId: string) {
  const key = `${pluginId}:${app.vault.configDir}:dashboard-task-diameter`;
  if (typeof app.loadLocalStorage === "function" && typeof app.saveLocalStorage === "function") {
    return { read: () => app.loadLocalStorage(key), write: (value: number) => app.saveLocalStorage(key, value) };
  }
  // Compatibility with Obsidian before 1.8.7; its localStorage is shared by vaults.
  const base = (app.vault.adapter as {basePath?: string}).basePath;
  if (!base) throw new Error("Cannot identify the vault for the visual preference");
  const scopedKey = `${key}:${base}`;
  return {
    read: () => JSON.parse(localStorage.getItem(scopedKey) || "null"),
    write: (value: number) => localStorage.setItem(scopedKey, JSON.stringify(value)),
  };
}

export function loadDashboardBubbleDiameter(app: App, pluginId: string, legacy: BubbleSettings): number {
  try {
    const value = preferenceStorage(app, pluginId).read();
    if (validDiameter(value)) return value;
  } catch { /* Keep the existing size if local preferences are unavailable. */ }
  return dashboardTaskDiameter(legacy);
}

export function saveDashboardBubbleDiameter(app: App, pluginId: string, diameter: number): void {
  if (!validDiameter(diameter)) throw new Error("Enter a whole number from 10 to 80.");
  preferenceStorage(app, pluginId).write(diameter);
}

export function applyDashboardBubbleDiameter(root: HTMLElement, diameter: number): void {
  for (const bubble of Array.from(root.querySelectorAll<HTMLElement>(".auto-oc-dashboard-task-bubble"))) {
    bubble.style.width = bubble.style.height = `${diameter}px`;
  }
}

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
export function addDashboardBubbleSizeSetting(container: HTMLElement, host: {
  getDiameter(): number;
  saveDiameter(diameter: number): void | Promise<void>;
  applyDiameter(diameter: number): void;
}) {
  let input: HTMLInputElement, apply: HTMLButtonElement, reset: HTMLButtonElement;
  let saving = false;
  const row = new Setting(container).setName("Task and step bubble size")
    .setDesc("Exact diameter in pixels (10–80). Preview changes below; Apply updates the Dashboard. Saved on this device for this vault.");
  row.addText(text => {
    input = text.inputEl;
    input.type = "number"; input.min = "10"; input.max = "80"; input.step = "1";
    input.style.width = "80px";
    input.setAttribute("aria-label", "Task and step bubble size in pixels");
    text.setValue(String(host.getDiameter())).onChange(() => preview());
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
    apply.disabled = saving || !valid || diameter === host.getDiameter();
    if (valid) {
      bubble.style.width = bubble.style.height = `${diameter}px`;
      feedback.setText(`${diameter} px`);
    } else feedback.setText("Enter a whole number from 10 to 80.");
  }
  async function save() {
    const diameter = value();
    if (saving || !validDiameter(diameter)) return;
    saving = true; input.disabled = apply.disabled = reset.disabled = true;
    apply.setText("Saving…");
    feedback.setText("Saving size…");
    try {
      await host.saveDiameter(diameter);
      feedback.setText(`Saved: ${diameter} px`);
      try { host.applyDiameter(diameter); }
      catch { feedback.setText(`Saved: ${diameter} px. Reopen the Dashboard to refresh its bubbles.`); }
    } catch {
      feedback.setText("Could not save the size. Your previous size is kept. Try Apply again.");
    } finally {
      saving = false; input.disabled = reset.disabled = false;
      apply.setText("Apply");
      apply.disabled = value() === host.getDiameter();
    }
  }
  input!.addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); void save(); }
  });
  preview();
}
