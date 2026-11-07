import { App, Modal, Notice, Setting } from "obsidian";
import { INTERACTIVE_CLIS, configuredInteractiveClis, launchInteractiveCli, resolveInteractiveCli, type InteractiveCliProvider, type InteractiveCliSettings } from "./interactive-cli";
import { detectOpenCodeVersion } from "./opencode-version";

interface CliSettingsHost {
  manifest?: { id: string };
  settings: InteractiveCliSettings;
  saveSettings(refreshView?: boolean): Promise<void>;
  isLifecycleStopped(): boolean;
  openIntegratedCli?(provider: InteractiveCliProvider, cwd: string): Promise<void>;
  installCliTerminalSupport?(): Promise<void>;
  showCliTerminals?(): Promise<void>;
}

export function openCliLauncher(app: App, host: CliSettingsHost, selected?: InteractiveCliProvider) {
  new CliLauncherModal(app, host, () => {
    const settings = (app as any).setting;
    if (!settings?.open || !settings?.openTabById || !host.manifest?.id) {
      new Notice("Open Settings → AutoOC → Interactive CLI launchers to configure your CLIs."); return;
    }
    settings.open(); settings.openTabById(host.manifest.id);
  }, selected).open();
}

export function addInteractiveCliSettings(root: HTMLElement, host: CliSettingsHost) {
  root.createEl("h3", { text: "Interactive CLI launchers" });
  root.createEl("p", { text: "Choose which CLIs appear under 💻 CLI. Sessions open in a terminal and use each CLI's own model, sign-in and approval settings. These sessions are independent of scheduled tasks.", cls: "setting-item-description" });
  new Setting(root).setName("CLI terminal destination")
    .setDesc("Where manual CLIs and interactive CLI tasks for all harnesses open, including workflow steps. Background tasks, the Codex app and existing terminals are unchanged. Integrated tasks require Obsidian to be open.")
    .addDropdown(dropdown => {
      let saving = false;
      dropdown.addOption("external", "External window").addOption("integrated", "Integrated in Obsidian")
        .setValue(host.settings.cliTerminalDestination === "integrated" ? "integrated" : "external")
        .onChange(async value => {
          if (saving || host.isLifecycleStopped() || (value !== "integrated" && value !== "external")) {
            dropdown.setValue(host.settings.cliTerminalDestination === "integrated" ? "integrated" : "external"); return;
          }
          const previous = host.settings.cliTerminalDestination;
          saving = true; dropdown.setDisabled(true); host.settings.cliTerminalDestination = value;
          try { await host.saveSettings(false); }
          catch {
            if (host.settings.cliTerminalDestination === value) host.settings.cliTerminalDestination = previous;
            new Notice("Terminal destination could not be saved. Try again.");
          } finally {
            saving = false; dropdown.setDisabled(false);
            dropdown.setValue(host.settings.cliTerminalDestination === "integrated" ? "integrated" : "external");
          }
        });
    });
  if (host.installCliTerminalSupport) {
    const support = new Setting(root).setName("Integrated terminal support")
      .setDesc("Windows x64 only. Runs with your user permissions; closing AutoOC stops its integrated sessions. Explicit download from registry.npmjs.org: node-pty 1.1.0 (MIT), verified against a pinned SHA-512. No npm scripts are run.");
    let installing = false;
    support.addButton(button => button.setButtonText("Download and install terminal support").onClick(async () => {
      if (installing || host.isLifecycleStopped()) return;
      installing = true; button.setDisabled(true); support.setDesc("Installing verified terminal support...");
      try { await host.installCliTerminalSupport!(); support.setDesc("Terminal support is ready. New CLI sessions use the destination selected above."); }
      catch (error) { support.setDesc(`Terminal support could not be installed. ${String(error)}`); }
      finally { installing = false; button.setDisabled(false); }
    }));
    if (host.showCliTerminals) support.addButton(button => button.setButtonText("Show existing terminals").onClick(async () => {
      if (host.isLifecycleStopped()) return;
      try { await host.showCliTerminals!(); }
      catch (error) { new Notice(String(error)); }
    }));
  }
  for (const cli of INTERACTIVE_CLIS) {
    const defaultCommand = cli.id === "opencode2" ? "opencode" : cli.id;
    new Setting(root).setName(`Show ${cli.label}`).setDesc("Include this CLI in the selector when its executable is available.")
      .addToggle(toggle => toggle.setValue(host.settings.cliLauncherEnabled?.[cli.id] !== false).onChange(async enabled => {
        const previous = host.settings.cliLauncherEnabled;
        const updated = { ...previous, [cli.id]: enabled };
        host.settings.cliLauncherEnabled = updated;
        try { await host.saveSettings(false); }
        catch { if (host.settings.cliLauncherEnabled === updated) host.settings.cliLauncherEnabled = previous; toggle.setValue(previous?.[cli.id] !== false); new Notice("CLI preference could not be saved. Try again."); }
      }));
    const row = new Setting(root).setName(`${cli.label} executable`);
    const describe = () => {
      const detected = resolveInteractiveCli(cli.id, host.settings[cli.pathKey]);
      row.setDesc(detected ? `Detected: ${detected}`
        : `Not found. Install ${cli.label} separately or enter its executable path. Use a path or command name without arguments.`);
    };
    let input: HTMLInputElement;
    const savePath = async (value: string) => {
      const previous = host.settings[cli.pathKey];
      const updated = value.trim() || defaultCommand;
      host.settings[cli.pathKey] = updated;
      try { await host.saveSettings(false); }
      catch { if (host.settings[cli.pathKey] === updated) host.settings[cli.pathKey] = previous || defaultCommand; input.value = host.settings[cli.pathKey] || defaultCommand; new Notice("CLI path could not be saved. Try again."); }
      describe();
    };
    row.addText(text => { input = text.inputEl; text.setPlaceholder(defaultCommand).setValue(host.settings[cli.pathKey] || defaultCommand).onChange(savePath); })
      .addButton(button => button.setButtonText("Auto-detect").onClick(async () => {
        const found = resolveInteractiveCli(cli.id);
        if (!found) { new Notice(`${cli.label} was not found. Install it or enter its executable path.`); return; }
        input.value = found; await savePath(found);
      }));
    if (cli.id === "opencode" || cli.id === "opencode2") row.addButton(button => button.setButtonText("Check version").onClick(async () => {
      button.setDisabled(true);
      try {
        const bin = resolveInteractiveCli(cli.id, host.settings[cli.pathKey]);
        if (!bin) throw new Error("Executable not found. Set its full path first.");
        const detected = await detectOpenCodeVersion(bin);
        const expected = cli.id === "opencode2" ? 2 : 1;
        row.setDesc(detected.major === expected ? `Detected ${detected.version} — compatible with ${cli.label}.`
          : `Detected ${detected.version}. Choose the matching OpenCode CLI and task type, or set a different executable. Existing tasks have not been changed.`);
      } catch (error) { row.setDesc((error as Error).message); }
      finally { button.setDisabled(false); }
    }));
    describe();
  }
}

export class CliLauncherModal extends Modal {
  private selected?: InteractiveCliProvider;
  private closed = false;
  private launching = false;
  constructor(app: App, private host: CliSettingsHost, private configure: () => void, selected?: InteractiveCliProvider) {
    super(app); this.selected = selected;
  }

  onOpen() {
    this.closed = false;
    const root = this.contentEl;
    root.empty(); root.addClass("auto-oc-cli-modal");
    root.createEl("h3", { text: "💻 CLI" });
    root.createEl("p", { text: "Choose a configured CLI and the folder to open in its interactive terminal.", cls: "setting-item-description" });
    const configured = configuredInteractiveClis(this.host.settings);
    const available = configured.filter(cli => cli.executable);
    const requested = this.selected;
    if (requested && !available.some(cli => cli.id === requested)) {
      this.selected = undefined;
      root.createEl("p", { text: `${INTERACTIVE_CLIS.find(cli => cli.id === requested)?.label} is unavailable. Enable it and check its path in Settings, or choose another CLI.` });
    } else if (!requested) this.selected = available[0]?.id;
    let updateButtons = () => {};
    if (available.length) new Setting(root).setName("CLI").addDropdown(dropdown => {
      if (!this.selected) dropdown.addOption("", "Choose a CLI");
      for (const cli of available) dropdown.addOption(cli.id, cli.label);
      dropdown.setValue(this.selected || "").onChange(value => {
        this.selected = available.find(cli => cli.id === value)?.id; updateButtons();
      });
    });
    else root.createEl("p", { text: "No configured CLI is available. Open Settings to enable one and set its executable path." });
    const integrated = this.host.settings.cliTerminalDestination === "integrated";
    root.createEl("p", { text: `Terminal: ${integrated ? "Integrated in Obsidian" : "External window"}. Change the destination in AutoOC Settings.`, cls: "setting-item-description" });
    const missing = configured.filter(cli => !cli.executable);
    if (missing.length) root.createEl("p", { text: `Not found: ${missing.map(cli => cli.label).join(", ")}. Configure their paths in Settings.`, cls: "setting-item-description" });
    const feedback = root.createDiv(); feedback.setAttr("role", "alert");
    const defaultCwd = this.host.settings.workingDirectory?.trim() || (this.app.vault.adapter as any).basePath || "";
    root.createEl("p", { text: defaultCwd || "Choose a project folder below.", cls: "setting-item-description auto-oc-cli-path" });
    const buttons = root.createDiv("auto-oc-cli-modal-buttons");
    const open = buttons.createEl("button", { text: "📂 Open in project / vault", cls: "auto-oc-btn-primary" });
    const choose = buttons.createEl("button", { text: "🗀 Choose folder…" });
    updateButtons = () => {
      open.disabled = this.launching || !this.selected || !defaultCwd;
      choose.disabled = this.launching || !this.selected;
    };
    updateButtons();
    const launch = async (cwd: string) => {
      if (this.closed || this.launching || !this.selected) return;
      if (this.host.isLifecycleStopped()) { feedback.setText("AutoOC has closed. Reopen the plugin before launching a CLI."); return; }
      this.launching = true; open.disabled = choose.disabled = true; feedback.setText("Opening terminal…");
      try {
        if (integrated) {
          if (!this.host.openIntegratedCli) throw new Error("Integrated terminals are unavailable. Check AutoOC Settings; no external session was started.");
          await this.host.openIntegratedCli(this.selected, cwd);
        } else await launchInteractiveCli(this.selected, cwd, this.host.settings);
        if (!this.closed) this.close();
      } catch (error) {
        if (!this.closed) feedback.setText(error instanceof Error ? error.message : String(error));
      } finally {
        this.launching = false;
        updateButtons();
      }
    };
    open.onclick = () => launch(defaultCwd);
    choose.onclick = async () => {
      try {
        // Electron's dialog is provided by Obsidian Desktop.
        const electron = (window as any).require("electron");
        const dialog = electron.remote?.dialog || electron.dialog;
        if (!dialog?.showOpenDialog) throw new Error("Folder picker is unavailable. Set the Working Directory in AutoOC Settings.");
        const result = await dialog.showOpenDialog({ properties: ["openDirectory"], title: "Select folder for CLI" });
        if (!result.canceled && result.filePaths?.[0]) await launch(result.filePaths[0]);
      } catch (error) { if (!this.closed) feedback.setText(`Could not choose a folder. ${String(error)}`); }
    };
    buttons.createEl("button", { text: "Configure CLIs" }).onclick = () => { if (!this.launching) { this.configure(); this.close(); } };
    buttons.createEl("button", { text: "Cancel" }).onclick = () => this.close();
  }

  onClose() { this.closed = true; this.contentEl.empty(); }
}
