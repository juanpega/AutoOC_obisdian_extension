import { DropdownComponent, Setting, TextComponent } from "obsidian";
import { CatalogKind, OpenCode2Catalog } from "./opencode2-catalog";

export function addOpenCode2Picker(row: Setting, kind: CatalogKind, catalog: OpenCode2Catalog,
  location: () => { executable: string; cwd: string }, value: () => string, change: (value: string) => void) {
  const label = kind === "models" ? "model" : "agent";
  let dropdown: DropdownComponent, manual: TextComponent;
  let shown = location();
  const changedLocation = () => {
    const current = location();
    return shown.executable !== current.executable || shown.cwd !== current.cwd;
  };
  const fill = () => {
    shown = location();
    const choices = catalog.choices(shown.executable, shown.cwd, kind);
    const current = value();
    dropdown.selectEl.empty();
    for (const choice of choices) dropdown.addOption(choice.value, choice.label);
    if (current && !choices.some(choice => choice.value === current)) dropdown.addOption(current, current);
    dropdown.addOption("", "Enter manually…").setValue(current);
    manual.setValue(current);
    manual.inputEl.hidden = !!current;
  };
  row.addDropdown(select => {
    dropdown = select;
    select.selectEl.setAttribute("aria-label", `Select OpenCode 2 ${label}`);
    select.selectEl.addEventListener("focus", () => {
      if (changedLocation()) {
        fill();
        row.setDesc(`Refresh to load OpenCode 2 ${kind} for this project.`);
      }
    });
    select.onChange(selected => {
      manual.inputEl.hidden = !!selected;
      if (selected) { manual.setValue(selected); change(selected); }
      else manual.inputEl.focus();
    });
  }).addText(text => {
    manual = text;
    text.inputEl.setAttribute("aria-label", `Custom OpenCode 2 ${label}`);
    text.setPlaceholder(kind === "models" ? "provider/model" : "Agent ID").onChange(input => change(input.trim()));
  }).addButton(button => button.setButtonText(kind === "models" ? "Refresh Models" : "Refresh Agents").onClick(async () => {
    button.setDisabled(true);
    const { executable, cwd } = location();
    const isCurrent = () => executable === location().executable && cwd === location().cwd;
    row.setDesc(`Loading OpenCode 2 ${kind}…`);
    try {
      const choices = await catalog.refresh(executable, cwd, kind);
      if (isCurrent()) {
        fill();
        row.setDesc(choices.length ? `${choices.length} OpenCode 2 ${kind} available for this project.` :
          kind === "models" ? "OpenCode 2 returned no models. Check the provider connection or enter a model ID." :
          "OpenCode 2 returned no selectable agents. Check the project configuration or enter an agent ID.");
      }
    } catch (error) {
      if (isCurrent()) row.setDesc((error as Error).message);
    } finally {
      button.setDisabled(false);
      if (!isCurrent()) { fill(); row.setDesc(`Refresh to load OpenCode 2 ${kind} for this project.`); }
    }
  }));
  fill();
}
