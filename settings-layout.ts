import type { InteractiveCliProvider } from "./interactive-cli";

/** Navigation/open state is local UI state, never part of the vault catalog. */
export function createSettingsLayout(root: HTMLElement, expanded: Map<string, boolean>, selectedEngine: string) {
  root.addClass("auto-oc-settings");
  const navigation = root.createEl("nav", { cls: "auto-oc-settings-navigation", attr: { "aria-label": "Settings sections" } });
  const section = (parent: HTMLElement, id: string, title: string, description: string, open = true) => {
    const details = parent.createEl("details", { cls: "auto-oc-settings-section" });
    details.open = expanded.get(id) ?? open;
    const summary = details.createEl("summary", { text: title });
    details.addEventListener("toggle", () => expanded.set(id, details.open));
    const body = details.createDiv("auto-oc-settings-section-body");
    if (description) body.createEl("p", { text: description, cls: "setting-item-description" });
    return { details, summary, body };
  };
  const top = (id: string, title: string, description: string) => {
    const item = section(root, id, title, description);
    navigation.createEl("button", { text: title, attr: { type: "button" } }).onclick = () => {
      item.details.open = true; expanded.set(id, true);
      item.summary.focus(); item.summary.scrollIntoView({ block: "start" });
    };
    return item.body;
  };
  const general = top("general", "General", "Defaults for new work. Existing tasks keep their engine and overrides.");
  const harnesses = top("harnesses", "Harnesses", "Each CLI keeps its own executable, authentication and supported capabilities. Expand a harness to configure it.");
  const engines = {} as Record<InteractiveCliProvider, HTMLElement>;
  for (const [id, label] of [["opencode", "OpenCode 1"], ["opencode2", "OpenCode 2"], ["codex", "Codex CLI"], ["copilot", "GitHub Copilot CLI"], ["claude", "Claude Code · interactive CLI"]] as const) {
    engines[id] = section(harnesses, id, label, "", id === selectedEngine).body;
  }
  const terminals = top("terminals", "Terminals", "Shared terminal destination and support for manual sessions and interactive CLI tasks.");
  const execution = top("execution", "Execution", "Scheduling/execution limits do not add permissions or stop work already running.");
  const logging = top("logging", "Logs", "Persistence and retention. Deleting logs still requires confirmation.");
  const library = top("library", "Library", "Source used to browse and import shared task/workflow packages.");
  const maintenance = top("maintenance", "Maintenance", "Review blocked/older attempts and historical notices. Nothing starts automatically.");
  return { general, engines, terminals, execution, logging, library, maintenance };
}
