import { ItemView, Modal, Notice, Plugin, WorkspaceLeaf } from "obsidian";
import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import * as fs from "fs";
import * as path from "path";
import { psSingleQuoted } from "./cli-launchers";
import { INTERACTIVE_CLIS, prepareInteractiveCli, type InteractiveCliProvider, type InteractiveCliSettings } from "./interactive-cli";
import { interactiveCliTaskArgs } from "./interactive-cli-profile";
import { installTerminalSupport, verifyTerminalSupport, type IDisposable } from "./terminal-pty";
import { createTerminalSession, type IndependentTerminal } from "./terminal-session";
import { assertOpenCode2 } from "./opencode-version";
import { InteractiveTerminalLaunchUncertainError, type InteractiveTaskTerminalRequest, type TerminalPageContext } from "./interactive-task-terminal";
import { createAuxiliaryDirectory, completeAuxiliaryDirectory } from "./execution-files";

export const TERMINAL_VIEW_TYPE = "auto-oc-terminals";

interface TerminalHost extends Plugin {
  settings: InteractiveCliSettings;
  isLifecycleStopped(): boolean;
  pageTerminalExited?(page: TerminalPageContext): Promise<void>;
}

interface Session {
  id: number;
  label: string;
  cwd: string;
  terminal: Terminal;
  fit: FitAddon;
  element: HTMLElement;
  pty: IndependentTerminal;
  subscriptions: IDisposable[];
  opened: boolean;
  exited: boolean;
  exitCode?: number;
  closing?: Promise<boolean>;
  cleanup?: () => void;
  detaching?: boolean;
  page?: TerminalPageContext;
  pageExitNotified?: boolean;
}

export function integratedCliCommand(bin: string, args: string[] = []): { file: string; args: string[] } {
  if (process.platform !== "win32") return { file: bin, args: [...args] };
  if (/\.exe$/i.test(bin)) return { file: bin, args: [...args] };
  // npm shims and PowerShell scripts need a real shell, never interpolation in cmd.exe.
  const file = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const command = `& ${[bin, ...args].map(psSingleQuoted).join(" ")}; if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE } elseif (!$?) { exit 1 }`;
  return { file, args: ["-NoLogo", "-NoProfile", "-EncodedCommand", Buffer.from(command, "utf16le").toString("base64")] };
}

class CloseTerminalModal extends Modal {
  constructor(app: TerminalHost["app"], private label: string, private confirm: () => Promise<void>) { super(app); }
  onOpen() {
    this.contentEl.createEl("h3", { text: "Stop terminal session?" });
    this.contentEl.createEl("p", { text: `${this.label} is still running. Closing it stops the terminal and may interrupt work. Changes already made by the CLI are not undone.` });
    const actions = this.contentEl.createDiv("auto-oc-cli-modal-buttons");
    const cancel = actions.createEl("button", { text: "Keep running" });
    cancel.onclick = () => this.close();
    actions.createEl("button", { text: "Stop and close", cls: "mod-warning" }).onclick = async () => {
      await this.confirm(); this.close();
    };
    cancel.focus();
  }
  onClose() { this.contentEl.empty(); }
}

export class IntegratedTerminals {
  readonly sessions: Session[] = [];
  activeId?: number;
  private sequence = 0;
  private generation = 0;
  private disposed = false;
  private opening = false;
  private openingAbort?: AbortController;
  private openingQueue: Promise<void> = Promise.resolve();
  private queuedTasks = 0;
  private stoppingAll = false;
  private pendingCleanup = new Set<IndependentTerminal>();
  private pendingCleanupCallbacks = new Map<IndependentTerminal, () => void>();
  private listeners = new Set<(focus: boolean) => void>();

  constructor(private host: TerminalHost, private newSession: (pageId?: string) => void) {
    host.registerView(TERMINAL_VIEW_TYPE, leaf => new TerminalView(leaf, this));
    host.addCommand({ id: "show-cli-terminals", name: "Show integrated CLI terminals", callback: () => {
      void this.show().catch(error => new Notice(String(error)));
    } });
    host.addCommand({ id: "retry-cli-terminal-cleanup", name: "Retry failed terminal cleanup", callback: () => {
      void this.retryPendingCleanup().catch(error => new Notice(String(error), 15000));
    } });
  }

  private pluginDirectory(): string {
    const base = (this.host.app.vault.adapter as any).basePath;
    if (!base || !this.host.manifest.dir) throw new Error("AutoOC terminal installation directory is unavailable.");
    return path.resolve(base, this.host.manifest.dir);
  }

  async installSupport(): Promise<void> {
    this.assertOpen();
    await installTerminalSupport(this.pluginDirectory());
  }

  private assertOpen() {
    if (this.disposed || this.host.isLifecycleStopped()) throw new Error("AutoOC has closed. Reopen it before using integrated terminals.");
    if (this.stoppingAll) throw new Error("Terminal sessions are stopping. Wait before launching another session.");
  }

  async open(provider: InteractiveCliProvider, cwd: string, label?: string, page?: TerminalPageContext): Promise<void> {
    this.assertOpen();
    if (this.opening || this.queuedTasks > 0) throw new Error("A terminal is already opening. Wait before launching another session.");
    const operation = this.openSession(provider, cwd, undefined, label, page && {...page});
    this.openingQueue = operation.catch(() => {});
    return operation;
  }

  public async openTask(request: InteractiveTaskTerminalRequest): Promise<void> {
    this.assertOpen();
    const snapshot = { ...request, page: request.page && {...request.page} };
    const generation = this.generation;
    this.queuedTasks++;
    const pending = this.openingQueue.then(() => {
      this.assertOpen();
      if (generation !== this.generation) throw new Error("Terminal opening was cancelled while sessions were stopping.");
      if (snapshot.signal?.aborted) throw new Error("Terminal opening was cancelled.");
      return this.openSession(snapshot.provider || (snapshot.major === 2 ? "opencode2" : "opencode"), snapshot.cwd, snapshot);
    }).finally(() => { this.queuedTasks--; });
    this.openingQueue = pending.catch(() => {});
    return pending;
  }

  private async openSession(provider: InteractiveCliProvider, cwd: string, request?: InteractiveTaskTerminalRequest, label?: string, page = request?.page): Promise<void> {
    this.assertOpen();
    if (this.opening) throw new Error("A terminal is already opening. Wait before launching another session.");
    if (page && this.sessions.some(s => s.page?.pageId === page.pageId && !s.exited)) throw new Error("This page already has a terminal. Open its existing session.");
    if (this.sessions.length >= 12) throw new Error("Close a terminal before opening another (12 sessions maximum).");
    this.opening = true;
    const openingAbort = this.openingAbort = new AbortController();
    const cancelOpening = () => openingAbort.abort();
    request?.signal?.addEventListener("abort", cancelOpening, { once: true });
    if (request?.signal?.aborted) cancelOpening();
    const generation = this.generation;
    let session: Session | undefined;
    let terminal: Terminal | undefined;
    let pty: IndependentTerminal | undefined;
    let auxiliaryDirectory: string | undefined;
    let hostOwnsAuxiliary = false;
    let spawnAttempted = false;
    const cleanup = () => {
      if (auxiliaryDirectory && !hostOwnsAuxiliary) {
        completeAuxiliaryDirectory(auxiliaryDirectory, "interactive");
        auxiliaryDirectory = undefined;
      }
    };
    const assertOpening = () => {
      this.assertOpen();
      if (generation !== this.generation) throw new Error("Terminal opening was cancelled while sessions were stopping.");
      if (request?.signal?.aborted) throw new Error("Terminal opening was cancelled.");
    };
    const previousActive = this.activeId;
    try {
      assertOpening();
      if (request && !request.bin.trim()) throw new Error("A task terminal requires an explicit executable.");
      const selectedCli = INTERACTIVE_CLIS.find(cli=>cli.id === provider);
      if (!selectedCli) throw new Error("Unknown interactive CLI provider.");
      const settings = request ? { ...this.host.settings, cliLauncherEnabled: undefined,
        [selectedCli.pathKey]: request.bin } : this.host.settings;
      const { cli, bin } = prepareInteractiveCli(provider, cwd, settings);
      if (provider === "opencode2") await assertOpenCode2(bin);
      assertOpening();
      await verifyTerminalSupport(this.pluginDirectory());
      assertOpening();
      await this.show();
      assertOpening();
      const element = document.createElement("div");
      element.className = "auto-oc-terminal-screen";
      // Browser-only modules are needed for a session, not for plugin startup.
      const { Terminal } = require("@xterm/xterm") as typeof import("@xterm/xterm");
      const { FitAddon } = require("@xterm/addon-fit") as typeof import("@xterm/addon-fit");
      terminal = new Terminal({ cursorBlink: true, scrollback: 5000, fontSize: 14, allowProposedApi: false,
        screenReaderMode: true, fontFamily: "var(--font-monospace)" });
      const fit = new FitAddon(); terminal.loadAddon(fit);
      const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
      env.TERM = "xterm-256color"; env.COLORTERM = "truecolor";
      let args: string[] = [];
      if (request) {
        auxiliaryDirectory = createAuxiliaryDirectory(cwd, "interactive");
        const promptFile = path.join(auxiliaryDirectory, "prompt.txt");
        fs.writeFileSync(promptFile, request.prompt, { encoding: "utf8", flag: "wx", mode: 0o600 });
        const relativePrompt = path.relative(cwd, promptFile).split(path.sep).join("/");
        const instruction = `Read ${relativePrompt} as UTF-8 and follow its instructions.`;
        args = interactiveCliTaskArgs(provider, request.model, request.agent, instruction, request.reasoningEffort);
      }
      const command = integratedCliCommand(bin, args);
      assertOpening();
      // A throwing spawn may already have created a native process without returning its handle.
      spawnAttempted = true;
      pty = await createTerminalSession({ pluginDirectory: this.pluginDirectory(), file: command.file, args: command.args,
        options: { cwd, env, cols: 100, rows: 30, name: "xterm-256color" }, auxiliaryDirectory }, openingAbort.signal);
      hostOwnsAuxiliary = true;
      this.pendingCleanup.add(pty);
      if (request) this.pendingCleanupCallbacks.set(pty, cleanup);
      assertOpening();
      session = { id: ++this.sequence, label: request?.label ?? label ?? cli.label, cwd, terminal, fit, element, pty, subscriptions: [], opened: false, exited: false, cleanup: request ? cleanup : undefined, page };
      const current = session;
      current.subscriptions.push(pty.onData(data => current.terminal.write(data)));
      current.subscriptions.push(pty.onExit(({ exitCode }) => {
        current.exited = true; current.exitCode = exitCode;
        current.cleanup?.();
        this.notifyPageExit(current);
        current.terminal.write(`\r\n\x1b[90m[Process exited: ${exitCode}]\x1b[0m\r\n`);
        this.changed();
      }));
      current.subscriptions.push(terminal.onData(data => { if (!current.exited) current.pty.write(data); }));
      current.subscriptions.push(terminal.onResize(({ cols, rows }) => {
        if (!current.exited) { try { current.pty.resize(cols, rows); } catch (error) { new Notice(`Terminal resize failed: ${String(error)}`); } }
      }));
      // Let the terminal receive editing/navigation keys instead of Obsidian hotkeys.
      element.addEventListener("keydown", event => event.stopPropagation());
      assertOpening();
      this.sessions.push(current); this.activeId = current.id; this.changed(true);
      assertOpening();
      this.pendingCleanup.delete(pty);
      this.pendingCleanupCallbacks.delete(pty);
    } catch (error) {
      // Roll back publication too: xterm.open may throw inside a view listener.
      if (session) {
        const index = this.sessions.indexOf(session);
        if (index >= 0) this.sessions.splice(index, 1);
        this.activeId = previousActive;
      }
      if (session) for (const subscription of session.subscriptions) subscription.dispose();
      let cleanupError: unknown;
      try {
        if (pty) {
          await pty.kill();
          pty.disconnect();
          cleanup();
          this.pendingCleanup.delete(pty);
          this.pendingCleanupCallbacks.delete(pty);
        } else if (!spawnAttempted) cleanup();
      }
      catch (failure) { cleanupError = failure; }
      finally { terminal?.dispose(); session?.element.remove(); }
      this.changed();
      if (cleanupError) throw new InteractiveTerminalLaunchUncertainError(`${String(error)} Terminal cleanup is unconfirmed (PID ${pty?.pid}); AutoOC still tracks it. Use Retry failed terminal cleanup. ${String(cleanupError)}`);
      if (spawnAttempted && !pty && auxiliaryDirectory) throw new InteractiveTerminalLaunchUncertainError(`${String(error)} Terminal launch is unconfirmed; prompt evidence was retained at ${auxiliaryDirectory}. Check for a running terminal before retrying.`);
      throw error;
    } finally {
      request?.signal?.removeEventListener("abort", cancelOpening);
      this.opening = false; this.openingAbort = undefined;
    }
  }

  async show(): Promise<void> {
    this.assertOpen();
    const workspace = this.host.app.workspace;
    let leaf = workspace.getLeavesOfType(TERMINAL_VIEW_TYPE)[0];
    if (!leaf) { leaf = workspace.getLeaf("tab"); await leaf.setViewState({ type: TERMINAL_VIEW_TYPE, active: true }); }
    await workspace.revealLeaf(leaf);
  }

  add() { this.assertOpen(); this.newSession(this.sessions.find(s=>s.id === this.activeId)?.page?.pageId); }
  subscribe(listener: (focus: boolean) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private changed(focus = false) { for (const listener of this.listeners) listener(focus); }
  select(id: number) { this.activeId = id; this.changed(true); }

  pageSession(pageId: string) {
    const matches = this.sessions.filter(s => s.page?.pageId === pageId);
    return matches.find(s => !s.exited) || matches[matches.length - 1];
  }

  async focusPage(pageId: string, reveal = true): Promise<boolean> {
    this.assertOpen();
    const session = this.pageSession(pageId);
    if (!session) return false;
    this.activeId = session.id;
    // Selecting a page must not steal keyboard focus from the dashboard.
    this.changed(reveal);
    if (reveal) await this.show();
    return true;
  }

  private notifyPageExit(session: Session) {
    if (!session.page || session.pageExitNotified) return;
    session.pageExitNotified = true;
    void this.host.pageTerminalExited?.({...session.page}).catch(() => {
      new Notice("Terminal ended, but its folder reservation could not be saved. Review the page before starting new work.", 10000);
    });
  }

  async detach(id: number): Promise<void> {
    this.assertOpen();
    const session = this.sessions.find(item => item.id === id);
    if (!session || session.exited || session.closing || session.detaching) return;
    session.detaching = true; this.changed();
    try {
      const shell = require("electron").shell;
      await session.pty.detach(url => shell.openExternal(url));
      new Notice("Terminal connected outside Obsidian. You can restart Obsidian or AutoOC without stopping this session.", 10000);
    } finally { session.detaching = false; this.changed(); }
  }

  async requestClose(id: number) {
    const session = this.sessions.find(item => item.id === id);
    if (!session) return;
    if (session.exited) await this.close(id);
    else new CloseTerminalModal(this.host.app, session.label, async () => { await this.close(id); }).open();
  }

  private close(id: number): Promise<boolean> {
    const index = this.sessions.findIndex(session => session.id === id);
    if (index < 0) return Promise.resolve(true);
    const session = this.sessions[index];
    if (session.closing) return session.closing;
    if (session.detaching) return Promise.resolve(false);
    session.closing = (async () => {
      try { await session.pty.kill(); }
      catch (error) { new Notice(`Terminal could not be stopped (PID ${session.pty.pid}); session kept for inspection. ${String(error)}`, 15000); return false; }
      session.exited = true;
      this.notifyPageExit(session);
      session.cleanup?.();
      session.pty.disconnect();
      for (const subscription of session.subscriptions) subscription.dispose();
      session.terminal.dispose(); session.element.remove();
      const currentIndex = this.sessions.indexOf(session);
      if (currentIndex < 0) return true;
      this.sessions.splice(currentIndex, 1);
      if (this.activeId === id) this.activeId = this.sessions[Math.min(currentIndex, this.sessions.length - 1)]?.id;
      this.changed();
      return true;
    })().finally(() => { session.closing = undefined; });
    return session.closing;
  }

  get hasPendingCleanup() { return this.pendingCleanup.size > 0; }
  get hasRunningSessions() { return this.opening || this.queuedTasks > 0 || this.hasPendingCleanup || this.sessions.some(session => session.detaching || (!session.exited && !session.pty.detached)); }

  async retryPendingCleanup(): Promise<void> {
    const results = await Promise.all([...this.pendingCleanup].map(async pty => {
      try {
        await pty.kill();
        pty.disconnect();
        this.pendingCleanupCallbacks.get(pty)?.();
        this.pendingCleanupCallbacks.delete(pty);
        this.pendingCleanup.delete(pty);
        return true;
      }
      catch { return false; }
    }));
    this.changed();
    if (results.some(value => !value)) throw new Error("AutoOC still tracks terminal processes whose cleanup is unconfirmed. The window must remain open; no process was killed by PID.");
  }

  async stopAll(): Promise<void> {
    this.generation++;
    this.openingAbort?.abort();
    this.stoppingAll = true;
    try {
      // Released sessions belong to the independent host, not plugin lifecycle.
      const [closed] = await Promise.all([Promise.all(this.sessions.filter(session => !session.pty.detached).map(session => this.close(session.id))), this.retryPendingCleanup()]);
      if (closed.some(value => !value)) throw new Error("Some AutoOC terminal processes could not be stopped. Their sessions and observers have been retained; do not assume their work ended.");
    } finally { this.stoppingAll = false; }
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    await this.stopAll();
    for (const session of this.sessions) {
      for (const subscription of session.subscriptions) subscription.dispose();
      session.pty.disconnect();
      session.terminal.dispose(); session.element.remove();
    }
    this.sessions.length = 0;
    this.listeners.clear();
    for (const leaf of this.host.app.workspace.getLeavesOfType(TERMINAL_VIEW_TYPE)) {
      if (leaf.view instanceof TerminalView && leaf.view.manager === this) leaf.detach();
    }
  }
}

class TerminalView extends ItemView {
  private unsubscribe?: () => void;
  private observer?: ResizeObserver;
  private tabs!: HTMLElement;
  private screen!: HTMLElement;
  private status!: HTMLElement;
  private redraw!: HTMLButtonElement;
  private frame?: number;
  private repaintRequested = false;

  constructor(leaf: WorkspaceLeaf, readonly manager: IntegratedTerminals) { super(leaf); }
  getViewType() { return TERMINAL_VIEW_TYPE; }
  getDisplayText() { return "AutoOC Terminals"; }
  getIcon() { return "terminal"; }

  async onOpen() {
    const root = this.contentEl; root.empty(); root.addClass("auto-oc-terminals");
    const terminalCss = require("@xterm/xterm/css/xterm.css") as string;
    root.createEl("style", { text: terminalCss });
    const toolbar = root.createDiv("auto-oc-terminal-toolbar");
    this.tabs = toolbar.createDiv("auto-oc-terminal-tabs");
    this.tabs.setAttr("role", "tablist"); this.tabs.setAttr("aria-label", "CLI sessions");
    this.redraw = toolbar.createEl("button", { text: "↻", attr: {
      "aria-label": "Redraw active terminal", title: "Redraw active terminal without restarting the session or clearing its history",
    } });
    this.redraw.onclick = () => this.fit(true);
    const add = toolbar.createEl("button", { text: "+", attr: { "aria-label": "New CLI session", title: "New CLI session" } });
    add.onclick = () => this.manager.add();
    this.status = root.createDiv("auto-oc-terminal-status");
    this.screen = root.createDiv("auto-oc-terminal-host");
    this.unsubscribe = this.manager.subscribe(focus => this.render(focus));
    this.observer = new ResizeObserver(() => this.fit()); this.observer.observe(this.screen);
    this.registerEvent(this.app.workspace.on("css-change", () => this.fit()));
    this.render();
  }

  private render(focus = false) {
    this.tabs.empty();
    const active = this.manager.sessions.find(session => session.id === this.manager.activeId);
    this.redraw.disabled = !active;
    for (const session of this.manager.sessions) {
      const group = this.tabs.createDiv("auto-oc-terminal-tab");
      group.toggleClass("is-active", session === active);
      const label = `${session.label} ${session.id}${session.exited ? ` (exited ${session.exitCode})` : ""}`;
      const tab = group.createEl("button", { text: label, attr: { role: "tab", "aria-selected": String(session === active), title: session.cwd, "aria-controls": `auto-oc-terminal-${session.id}` } });
      tab.id = `auto-oc-terminal-tab-${session.id}`;
      tab.tabIndex = session === active ? 0 : -1;
      tab.onclick = () => this.manager.select(session.id);
      tab.onkeydown = event => {
        const sessions = this.manager.sessions, index = sessions.indexOf(session);
        const next = event.key === "ArrowRight" ? (index + 1) % sessions.length : event.key === "ArrowLeft" ? (index + sessions.length - 1) % sessions.length : event.key === "Home" ? 0 : event.key === "End" ? sessions.length - 1 : -1;
        if (next < 0) return;
        event.preventDefault(); this.manager.select(sessions[next].id);
        this.tabs.querySelector<HTMLButtonElement>(`#auto-oc-terminal-tab-${sessions[next].id}`)?.focus();
      };
      if (!session.exited) {
        const external = group.createEl("button", { text: session.detaching ? "Connecting…" : "↗", attr: {
          "aria-label": `Open ${label} outside Obsidian`, title: "Open the same session outside Obsidian so it survives restarting Obsidian or AutoOC",
        } });
        external.disabled = !!session.detaching || !!session.closing;
        external.onclick = () => { void this.manager.detach(session.id).catch(error => new Notice(String(error), 15000)); };
      }
      group.createEl("button", { text: "x", attr: { "aria-label": `Close ${label}`, title: "Close session" } }).onclick = () => this.manager.requestClose(session.id);
    }
    if (!active) {
      this.screen.replaceChildren();
      this.status.setText(this.manager.hasPendingCleanup ? "Terminal cleanup is unconfirmed. Retry cleanup before closing Obsidian." : "Independent CLI sessions. No scheduled tasks are started here.");
      const empty = this.screen.createDiv("auto-oc-terminal-empty");
      empty.createEl("h3", { text: "Your CLI, inside Obsidian" });
      empty.createEl("p", { text: "Launch a configured harness in a project folder. Each session gets its own terminal tab." });
      empty.createEl("button", { text: "New CLI session", cls: "mod-cta" }).onclick = () => this.manager.add();
      if (this.manager.hasPendingCleanup) empty.createEl("button", { text: "Retry failed terminal cleanup" }).onclick = () => {
        void this.manager.retryPendingCleanup().catch(error => new Notice(String(error), 15000));
      };
      return;
    }
    this.status.setText(`${active.exited ? `Exited (${active.exitCode})` : active.pty.detached ? "Running outside Obsidian · input is in the external window" : "Running"} | ${active.cwd}`);
    this.status.title = active.cwd;
    active.element.id = `auto-oc-terminal-${active.id}`;
    active.element.setAttr("role", "tabpanel"); active.element.setAttr("aria-labelledby", `auto-oc-terminal-tab-${active.id}`);
    if (active.element.parentElement !== this.screen) {
      this.screen.replaceChildren(); this.screen.append(active.element);
    }
    if (!active.opened) { active.terminal.open(active.element); active.opened = true; }
    this.fit(); if (focus) active.terminal.focus();
  }

  private fit(repaint = false) {
    // Resize/theme events may coalesce with a manual redraw: retain that intent.
    this.repaintRequested = this.repaintRequested || repaint;
    if (this.frame !== undefined) window.cancelAnimationFrame(this.frame);
    this.frame = window.requestAnimationFrame(() => {
      this.frame = undefined;
      const active = this.manager.sessions.find(session => session.id === this.manager.activeId);
      if (!active?.opened || !this.screen.isConnected || this.screen.clientWidth < 20 || this.screen.clientHeight < 20) return;
      const styles = this.screen.ownerDocument.defaultView!.getComputedStyle(this.contentEl);
      active.terminal.options.fontFamily = styles.getPropertyValue("--font-monospace").trim() || "monospace";
      active.terminal.options.theme = { background: styles.getPropertyValue("--background-primary").trim(), foreground: styles.getPropertyValue("--text-normal").trim(), cursor: styles.getPropertyValue("--text-accent").trim(), selectionBackground: styles.getPropertyValue("--text-selection").trim() };
      try {
        if (this.repaintRequested) active.terminal.clearTextureAtlas();
        active.fit.fit();
        if (this.repaintRequested) {
          active.terminal.refresh(0, active.terminal.rows - 1);
          this.repaintRequested = false;
          active.terminal.focus();
        }
      } catch (error) {
        console.warn("AutoOC terminal fit failed", error);
        if (this.repaintRequested) new Notice("Terminal redraw failed. The session was not restarted; try again when the panel is visible.");
      }
    });
  }

  async onClose() {
    this.unsubscribe?.(); this.observer?.disconnect();
    if (this.frame !== undefined) window.cancelAnimationFrame(this.frame);
    this.repaintRequested = false;
    // The manager owns sessions: closing a workspace leaf only hides them.
    for (const session of this.manager.sessions) session.element.remove();
    this.contentEl.empty();
  }
}
