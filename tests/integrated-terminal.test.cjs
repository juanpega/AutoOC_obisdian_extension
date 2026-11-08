const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { EventEmitter } = require('node:events');
const ts = require('typescript');

const compile = file => ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const sources = Object.fromEntries(['integrated-terminal.ts', 'interactive-cli.ts', 'interactive-cli-ui.ts', 'terminal-pty.ts', 'cli-launchers.ts', 'opencode-profile.ts', 'interactive-task-terminal.ts', 'interactive-cli-profile.ts']
  .map(file => [file, compile(file)]));

function evaluate(file, dependencies, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(sources[file], { module, exports: module.exports, Buffer, console, ...globals,
    require(id) {
      if (!Object.hasOwn(dependencies, id)) throw Error(`Unexpected dependency: ${id}`);
      return dependencies[id];
    },
  }, { filename: file });
  return module.exports;
}

const taskTerminal = evaluate('interactive-task-terminal.ts', {});

// DOM, Obsidian and xterm doubles exercise ownership, not real GUI rendering.
class Element {
  constructor(tag = 'div', text = '') {
    this.tag = tag; this.textContent = text; this.children = []; this.attrs = {}; this.events = {};
    this.isConnected = true; this.clientWidth = 800; this.clientHeight = 400;
    this.ownerDocument = { defaultView: { getComputedStyle: () => ({ getPropertyValue: () => '' }) } };
  }
  createEl(tag, options = {}) {
    const child = new Element(tag, options.text); child.attrs = { ...options.attr }; this.append(child); return child;
  }
  createDiv() { return this.createEl('div'); }
  append(child) { child.remove(); this.children.push(child); child.parent = this; }
  get parentElement() { return this.parent; }
  remove() {
    if (this.parent) { this.detachments = (this.detachments || 0) + 1; this.parent.children = this.parent.children.filter(child => child !== this); }
    this.parent = undefined;
  }
  empty() { for (const child of [...this.children]) child.remove(); }
  replaceChildren() { this.empty(); }
  addClass() {} toggleClass() {}
  setText(text) { this.textContent = text; }
  setAttr(key, value) { this.attrs[key] = value; }
  addEventListener(name, callback) { this.events[name] = callback; }
  focus() { this.focused = true; }
  all() { return [this, ...this.children.flatMap(child => child.all())]; }
  querySelector(selector) { return this.all().find(child => `#${child.id}` === selector); }
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness() {
  const folder = 'C:\\Vault', binary = 'C:\\Tools\\codex.exe';
  const files = new Set([binary, 'C:\\Tools\\opencode.exe']), directories = new Set([folder]);
  const notices = [], modals = [], terminals = [], ptys = [], spawns = [], installs = [], loads = [], external = [], frames = new Map();
  const env = { PATH: 'C:\\Tools', SystemRoot: 'C:\\Windows', OMIT: undefined };
  const process = { platform: 'win32', env };
  const launchers = evaluate('cli-launchers.ts', {
    child_process: { spawn: (...args) => { external.push(args); throw Error('External launch forbidden'); } },
    './interactive-task-terminal': taskTerminal,
    os: { platform: () => 'win32' }, fs: {}, path: path.win32, crypto: {}, './execution-files': {},
  }, { process });
  const backend = evaluate('interactive-cli.ts', {
    fs: { constants: { X_OK: 1 }, accessSync() {}, statSync(file) {
      if (!files.has(file) && !directories.has(file)) throw Error('ENOENT');
      return { isFile: () => files.has(file), isDirectory: () => directories.has(file) };
    } },
    path: path.win32, os: { homedir: () => 'C:\\Users\\Tester' },
    child_process: { spawn: (...args) => { external.push(args); throw Error('External launch forbidden'); } },
    './cli-launchers': launchers, './codex-client': { resolveCodexBin: () => '' },
    './opencode-version': { assertOpenCode2: async () => {} },
  }, { process });
  class Modal {
    constructor(app) { this.app = app; this.contentEl = new Element(); }
    open() { modals.push(this); this.onOpen(); }
    close() { this.closedByHost = true; this.onClose(); }
  }
  class ItemView {
    constructor(leaf) { this.app = leaf.app; this.contentEl = new Element(); }
    registerEvent() {}
  }
  class Control {
    constructor(el) { this.el = this.inputEl = el; this.el.options = {}; }
    addOption(key, value) { this.el.options[key] = value; return this; }
    setValue(value) { this.el.value = value; return this; }
    setPlaceholder() { return this; }
    setDisabled(value) { this.el.disabled = value; return this; }
    setButtonText(value) { this.el.textContent = value; return this; }
    onClick(fn) { this.el.onclick = fn; return this; }
    onChange(fn) { this.el.change = fn; return this; }
  }
  class Setting {
    constructor(root) { this.el = root.createDiv(); }
    setName(value) { this.el.name = value; return this; }
    setDesc(value) { this.el.description = value; return this; }
    addButton(fn) { fn(new Control(this.el.createEl('button'))); return this; }
    addToggle(fn) { fn(new Control(this.el.createEl('toggle'))); return this; }
    addText(fn) { fn(new Control(this.el.createEl('input'))); return this; }
    addDropdown(fn) { fn(new Control(this.el.createEl('select'))); return this; }
  }
  const obsidian = { Modal, ItemView, Setting, Notice: class { constructor(text) { notices.push(text); } } };
  const subscription = (target, event, fn) => {
    target.on(event, fn);
    const result = { disposed: false, dispose() { result.disposed = true; target.off(event, fn); } };
    target.subscriptions.push(result); return result;
  };
  class Terminal extends EventEmitter {
    constructor(options) { super(); this.options = options; this.subscriptions = []; this.output = []; this.opens = 0; this.disposes = 0; this.rows = 30; this.refreshes = []; this.atlasClears = 0; terminals.push(this); }
    refresh(start, end) { this.refreshes.push([start, end]); }
    clearTextureAtlas() { this.atlasClears++; }
    loadAddon(fit) { this.fit = fit; }
    onData(fn) { return subscription(this, 'input', fn); }
    onResize(fn) { return subscription(this, 'resize', fn); }
    write(data) { this.output.push(data); }
    open(element) { this.opens++; this.element = element; if (faults.render) throw Error('render failed'); }
    focus() { this.focuses = (this.focuses || 0) + 1; }
    dispose() { this.disposes++; }
  }
  const faults = {};
  const native = { spawn(file, args, options) {
    spawns.push({ file, args, options });
    if (faults.spawn) throw Error('spawn failed');
    const pty = new EventEmitter();
    Object.assign(pty, { pid: 1000 + ptys.length, subscriptions: [], writes: [], sizes: [], kills: 0,
      detached: false, disconnects: 0,
      disconnect() { this.disconnects++; },
      async detach(open) {
        await open('http://127.0.0.1:12345/#synthetic-token');
        await faults.detachGate?.promise;
        if (faults.detach) throw Error('external connection unconfirmed');
        this.detached = true;
      },
      write(data) { this.writes.push(data); }, resize(cols, rows) { if (faults.resize) throw Error('resize failed'); this.sizes.push([cols, rows]); },
      async kill() { this.kills++; if (faults.kill) throw Error('kill failed'); await (this.killGate || faults.killGate)?.promise; },
      onData(fn) { return subscription(this, 'data', fn); },
      onExit(fn) { if (faults.subscribe) throw Error('subscribe failed'); return subscription(this, 'exit', fn); },
    }); ptys.push(pty); faults.onSpawn?.(pty); return pty;
  } };
  let stopped = false, factory, version = async () => {}, load = async () => native, reveal = async () => {};
  let leaf, sequence = 0, newSessions = 0;
  const observers = [], leaves = [], commands = [];
  const workspace = {
    getLeavesOfType: () => [...leaves],
    getLeaf() {
      leaf = { app, detaches: 0, detach() {
        this.detaches++; if (this.view) void this.view.onClose();
        const index = leaves.indexOf(this); if (index >= 0) leaves.splice(index, 1);
        if (leaf === this) leaf = leaves.at(-1);
      }, async setViewState(state) {
        if (faults.view) throw Error('view failed');
        assert.equal(state.type, 'auto-oc-terminals'); this.view = factory(this); await this.view.onOpen();
      } }; leaves.push(leaf); return leaf;
    },
    async revealLeaf(value) { await reveal(value); },
    detachLeavesOfType() { for (const item of [...leaves]) item.detach(); },
    on() { return {}; },
  };
  const app = { vault: { adapter: { basePath: folder } }, workspace };
  const host = { app, manifest: { dir: '.obsidian/plugins/auto-oc' },
    settings: { codexPath: binary, opencode2Path: 'C:\\Tools\\opencode.exe', workingDirectory: folder },
    isLifecycleStopped: () => stopped,
    saveSettings: async () => {},
    registerView(type, fn) { assert.equal(type, 'auto-oc-terminals'); factory = fn; }, addCommand(command) { commands.push(command); },
  };
  // Synthetic owned auxiliary directories: no real vault or filesystem writes.
  const auxiliary = [], completed = [], promptFiles = new Map(), writes = [];
  const auxiliaryFiles = {
    createAuxiliaryDirectory(cwd, kind) {
      assert.equal(kind, 'interactive');
      const directory = path.win32.join(cwd, `.autooc-interactive-owned-${auxiliary.length + 1}`);
      auxiliary.push(directory); return directory;
    },
    completeAuxiliaryDirectory(directory, kind) {
      assert.equal(kind, 'interactive'); assert.ok(auxiliary.includes(directory)); completed.push(directory);
      for (const file of promptFiles.keys()) if (path.win32.dirname(file) === directory) promptFiles.delete(file);
    },
  };
  const api = evaluate('integrated-terminal.ts', {
    fs: { writeFileSync(file, data, options) {
      assert.equal(options.encoding, 'utf8'); assert.equal(options.flag, 'wx'); assert.equal(options.mode, 0o600);
      assert.equal(promptFiles.has(file), false); assert.ok(auxiliary.includes(path.win32.dirname(file)));
      const bytes = Buffer.from(data, options.encoding); promptFiles.set(file, bytes); writes.push({ file, bytes, options });
      faults.onPromptWrite?.();
    } },
    './execution-files': auxiliaryFiles,
    './interactive-cli-profile': evaluate('interactive-cli-profile.ts', {
      './interactive-cli': backend, './opencode-profile': evaluate('opencode-profile.ts', {}),
    }),
    './interactive-task-terminal': taskTerminal,
    obsidian, '@xterm/xterm': { Terminal }, '@xterm/addon-fit': { FitAddon: class { fit() { this.calls = (this.calls || 0) + 1; } } },
    '@xterm/xterm/css/xterm.css': '/* test */', path: path.win32,
    './cli-launchers': launchers, './interactive-cli': backend,
    './opencode-version': { assertOpenCode2: (...args) => version(...args) },
    electron: { shell: { openExternal: async url => { external.push(url); } } },
    './terminal-session': { createTerminalSession: async (config, signal) => {
      if (signal.aborted) throw Error('Terminal opening was cancelled while sessions were stopping.');
      const pty = native.spawn(config.file, config.args, config.options);
      if (config.auxiliaryDirectory) {
        let completed = false;
        const finish = () => {
          if (completed) return; completed = true;
          auxiliaryFiles.completeAuxiliaryDirectory(config.auxiliaryDirectory, 'interactive');
        };
        pty.on('exit', finish);
        const kill = pty.kill.bind(pty);
        pty.kill = async () => { await kill(); finish(); };
      }
      return pty;
    } },
    './terminal-pty': { verifyTerminalSupport: async directory => { loads.push(directory); await load(directory); },
      installTerminalSupport: async directory => { installs.push(directory); } },
  }, { process, AbortController, document: { createElement: tag => new Element(tag) },
    ResizeObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} disconnect() { this.disconnected = true; } },
    window: { requestAnimationFrame(fn) { frames.set(++sequence, fn); return sequence; }, cancelAnimationFrame(id) { frames.delete(id); } },
  });
  const manager = new api.IntegratedTerminals(host, () => newSessions++);
  const ui = evaluate('interactive-cli-ui.ts', { obsidian, './interactive-cli': backend, './opencode-version': {} });
  host.openIntegratedCli = (...args) => manager.open(...args);
  host.installCliTerminalSupport = () => manager.installSupport();
  host.showCliTerminals = () => manager.show();
  const button = (root, text) => root.all().find(el => el.tag === 'button' && el.textContent.includes(text));
  return { ...api, manager, host, app, files, directories, folder, binary, env, terminals, ptys, spawns, installs, loads, external,
    notices, modals, faults, observers, frames, button, leaves, commands,
    auxiliary, completed, promptFiles, writes, ptyBackend: native,
    get view() { return leaf?.view; }, get newSessions() { return newSessions; },
    stop() { stopped = true; }, resetLoad() { load = async () => native; },
    setLoad(fn) { load = fn; }, setReveal(fn) { reveal = fn; }, setVersion(fn) { version = fn; },
    hide() { workspace.detachLeavesOfType(); },
    settings() { const root = new Element(); ui.addInteractiveCliSettings(root, host); return root; },
    modal(selected = 'codex') { const modal = new ui.CliLauncherModal(app, host, () => {}, selected); modal.open(); return modal; },
  };
}

test('terminal spacing stays outside the session box measured by FitAddon', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  const screen = css.match(/\.auto-oc-terminal-screen\s*\{([^}]+)\}/)?.[1];
  const host = css.match(/\.auto-oc-terminal-host\s*\{([^}]+)\}/)?.[1];
  assert.ok(screen); assert.ok(host);
  assert.match(screen, /padding:\s*0\s*;/);
  assert.match(host, /padding:\s*8px\s*;/);
  assert.match(host, /box-sizing:\s*border-box\s*;/);
});

test('manual redraw repaints and fits only the active terminal without restarting or sending input', async () => {
  const h = harness(); await h.manager.open('codex', h.folder); await h.manager.open('codex', h.folder);
  const [background, active] = h.manager.sessions;
  active.terminal.write('Keep conversation');
  const refresh = h.view.contentEl.all().find(el => el.attrs['aria-label'] === 'Redraw active terminal');
  assert.equal(refresh.disabled, false); refresh.onclick();
  for (const [id, callback] of [...h.frames]) { h.frames.delete(id); callback(); }
  assert.equal(background.terminal.atlasClears, 0); assert.equal(active.terminal.atlasClears, 1);
  assert.deepEqual(active.terminal.refreshes, [[0, 29]]); assert.equal(active.fit.calls, 1);
  assert.deepEqual(active.terminal.output, ['Keep conversation']);
  assert.equal(h.spawns.length, 2); assert.equal(active.terminal.opens, 1); assert.equal(active.terminal.disposes, 0);
  for (const pty of h.ptys) { assert.equal(pty.kills, 0); assert.deepEqual(pty.writes, []); }
  await h.manager.dispose();
});

test('redraw intent survives resize coalescing and waits for a visible terminal', async () => {
  const h = harness(); await h.manager.open('codex', h.folder);
  const active = h.manager.sessions[0], screen = active.element.parentElement;
  const runFrames = () => { for (const [id, callback] of [...h.frames]) { h.frames.delete(id); callback(); } };
  screen.clientWidth = 0;
  h.view.contentEl.all().find(el => el.attrs['aria-label'] === 'Redraw active terminal').onclick();
  h.observers[0].fn(); runFrames();
  assert.equal(active.terminal.atlasClears, 0);
  screen.clientWidth = 800; h.observers[0].fn(); runFrames();
  assert.equal(active.terminal.atlasClears, 1); assert.deepEqual(active.terminal.refreshes, [[0, 29]]);
  assert.equal(h.spawns.length, 1); assert.equal(h.ptys[0].kills, 0);
  await h.manager.dispose();
});

test('redraw button is disabled without a session and remains usable on exited output', async () => {
  const h = harness(); await h.manager.show();
  const refresh = h.view.contentEl.all().find(el => el.attrs['aria-label'] === 'Redraw active terminal');
  assert.equal(refresh.disabled, true);
  await h.manager.open('codex', h.folder); assert.equal(refresh.disabled, false);
  h.ptys[0].emit('exit', {exitCode:0}); refresh.onclick();
  for (const [id, callback] of [...h.frames]) { h.frames.delete(id); callback(); }
  assert.equal(h.terminals[0].atlasClears, 1); assert.equal(h.spawns.length, 1);
  await h.manager.requestClose(h.manager.activeId); assert.equal(refresh.disabled, true);
  await h.manager.dispose();
});

test('external button transfers the same session and plugin disposal leaves its process running', async () => {
  const h = harness(); await h.manager.open('codex', h.folder);
  const session = h.manager.sessions[0], pty = h.ptys[0];
  assert.ok(h.view.contentEl.all().some(el => el.attrs['aria-label']?.includes('outside Obsidian')));
  await h.manager.detach(session.id);
  assert.equal(h.spawns.length, 1); assert.equal(h.external.length, 1);
  assert.equal(h.manager.sessions[0], session); assert.equal(pty.detached, true);
  assert.equal(h.manager.hasRunningSessions, false);
  await h.manager.stopAll(); assert.equal(pty.kills, 0);
  await h.manager.dispose(); assert.equal(pty.kills, 0); assert.equal(pty.disconnects, 1);
  assert.equal(session.terminal.disposes, 1);
});

test('failed external confirmation preserves the integrated session and unload protection', async () => {
  const h = harness(); await h.manager.open('codex', h.folder); h.faults.detach = true;
  await assert.rejects(h.manager.detach(h.manager.activeId), /unconfirmed/);
  assert.equal(h.ptys[0].detached, false); assert.equal(h.ptys[0].kills, 0);
  assert.equal(h.manager.hasRunningSessions, true); assert.equal(h.spawns.length, 1);
  assert.equal(h.manager.sessions[0].detaching, false);
  await h.manager.dispose(); assert.equal(h.ptys[0].kills, 1);
});

test('unload cannot stop or dispose a session while external handoff is pending', async () => {
  const h = harness(); await h.manager.open('codex', h.folder);
  h.faults.detachGate = deferred();
  const detaching = h.manager.detach(h.manager.activeId);
  assert.equal(h.manager.hasRunningSessions, true);
  await assert.rejects(h.manager.stopAll(), /could not be stopped/);
  assert.equal(h.ptys[0].kills, 0); assert.equal(h.terminals[0].disposes, 0);
  h.faults.detachGate.resolve(); await detaching;
  await h.manager.dispose(); assert.equal(h.ptys[0].kills, 0);
});

test('explicit stop still requires confirmation and stops a released terminal', async () => {
  const h = harness(); await h.manager.open('codex', h.folder);
  await h.manager.detach(h.manager.activeId);
  await h.manager.requestClose(h.manager.activeId); assert.equal(h.ptys[0].kills, 0);
  await h.button(h.modals.at(-1).contentEl, 'Stop and close').onclick();
  assert.equal(h.ptys[0].kills, 1); assert.equal(h.manager.sessions.length, 0);
  await h.manager.dispose();
});

test('integratedCliCommand passes literal .exe paths directly without shell arguments', () => {
  const h = harness();
  for (const bin of [h.binary, "C:\\O'Brien & $HOME; %PATH% [x]\\cli.EXE"]) {
    const command = h.integratedCliCommand(bin);
    assert.equal(command.file, bin); assert.equal(command.args.length, 0);
  }
});

for (const extension of ['cmd', 'ps1']) test(`integratedCliCommand encodes a literal .${extension} invocation in PowerShell`, () => {
  const h = harness(), bin = `C:\\O'Brien & $HOME; %PATH% [x]\\cli.${extension}`;
  const command = h.integratedCliCommand(bin);
  assert.equal(command.file, 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  assert.deepEqual(Array.from(command.args.slice(0, 3)), ['-NoLogo', '-NoProfile', '-EncodedCommand']);
  assert.equal(Buffer.from(command.args[3], 'base64').toString('utf16le'),
    `& 'C:\\O''Brien & $HOME; %PATH% [x]\\cli.${extension}'; if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE } elseif (!$?) { exit 1 }`);
  assert.equal(h.external.length, 0);
});

test('open owns a PTY and routes input, output, resize and exit without external launch or install', async () => {
  const h = harness(); await h.manager.open('codex', h.folder);
  const session = h.manager.sessions[0], terminal = h.terminals[0], pty = h.ptys[0], spawn = h.spawns[0];
  assert.equal(session.cwd, h.folder); assert.equal(h.manager.activeId, session.id);
  assert.equal(spawn.file, h.binary); assert.equal(spawn.options.cwd, h.folder);
  assert.equal(spawn.options.env.TERM, 'xterm-256color'); assert.equal(spawn.options.env.COLORTERM, 'truecolor');
  assert.equal(Object.hasOwn(spawn.options.env, 'OMIT'), false); assert.equal(h.env.TERM, undefined);
  assert.equal(terminal.options.screenReaderMode, true); assert.equal(terminal.options.allowProposedApi, false);
  pty.emit('data', '\x1b[31mhello'); terminal.emit('input', '\x03'); terminal.emit('resize', { cols: 120, rows: 40 });
  assert.deepEqual(terminal.output, ['\x1b[31mhello']); assert.deepEqual(pty.writes, ['\x03']); assert.deepEqual(pty.sizes, [[120, 40]]);
  h.faults.resize = true; terminal.emit('resize', { cols: 80, rows: 24 }); assert.match(h.notices[0], /resize failed/);
  pty.emit('exit', { exitCode: 7 }); terminal.emit('input', 'ignored'); terminal.emit('resize', { cols: 80, rows: 24 });
  assert.equal(session.exited, true); assert.equal(session.exitCode, 7); assert.match(terminal.output.at(-1), /Process exited: 7/);
  assert.deepEqual(pty.writes, ['\x03']); assert.equal(h.installs.length, 0); assert.equal(h.external.length, 0);
  await h.manager.dispose();
});

test('preparation rejects disabled, unknown, missing providers and invalid folders before loading PTY', async () => {
  const h = harness(); h.host.settings.cliLauncherEnabled = { codex: false };
  await assert.rejects(h.manager.open('codex', h.folder), /disabled/);
  await assert.rejects(h.manager.open('unknown', h.folder), /Unknown interactive CLI provider/);
  h.host.settings.cliLauncherEnabled.codex = true; h.files.delete(h.binary);
  await assert.rejects(h.manager.open('codex', h.folder), /not found/);
  h.files.add(h.binary);
  await assert.rejects(h.manager.open('codex', 'relative'), /absolute/);
  await assert.rejects(h.manager.open('codex', 'C:\\Missing'), /Folder does not exist/);
  assert.equal(h.loads.length, 0); assert.equal(h.spawns.length, 0); assert.equal(h.installs.length, 0); assert.equal(h.external.length, 0);
  await h.manager.open('codex', h.folder); await h.manager.dispose();
});

test('OpenCode 2 compatibility failure is checked before PTY loading', async () => {
  const h = harness(), checked = [];
  h.setVersion(async bin => { checked.push(bin); throw Error('requires OpenCode 2'); });
  await assert.rejects(h.manager.open('opencode2', h.folder), /requires OpenCode 2/);
  assert.deepEqual(checked, ['C:\\Tools\\opencode.exe']); assert.equal(h.loads.length, 0); assert.equal(h.external.length, 0);
});

for (const stage of ['load', 'view', 'spawn', 'subscribe']) test(`open ${stage} failure cleans partial resources and allows retry without fallback`, async () => {
  const h = harness();
  if (stage === 'load') h.setLoad(async () => { throw Error('support absent'); }); else h.faults[stage] = true;
  await assert.rejects(h.manager.open('codex', h.folder), /support absent|failed/);
  assert.equal(h.manager.sessions.length, 0); assert.equal(h.external.length, 0); assert.equal(h.installs.length, 0);
  for (const terminal of h.terminals) assert.equal(terminal.disposes, 1);
  for (const pty of h.ptys) { assert.equal(pty.kills, 1); assert.ok(pty.subscriptions.every(item => item.disposed)); }
  h.resetLoad(); h.faults[stage] = false;
  if (stage === 'view') h.hide();
  await h.manager.open('codex', h.folder);
  assert.equal(h.manager.sessions.length, 1); await h.manager.dispose();
});

test('concurrent opens are guarded while backend loading is pending', async () => {
  const h = harness(), gate = deferred(); h.setLoad(() => gate.promise);
  const opening = h.manager.open('codex', h.folder);
  await assert.rejects(h.manager.open('codex', h.folder), /already opening/);
  gate.reject(Error('backend unavailable')); await assert.rejects(opening, /backend unavailable/);
  await assert.rejects(h.manager.open('codex', h.folder), /backend unavailable/);
  assert.equal(h.loads.length, 2); assert.equal(h.spawns.length, 0);
});

test('render failure during open removes the failed session as well as disposing its resources', async () => {
  const h = harness(); h.faults.render = true;
  await assert.rejects(h.manager.open('codex', h.folder), /render failed/);
  assert.equal(h.ptys[0].kills, 1); assert.equal(h.terminals[0].disposes, 1);
  assert.ok(h.ptys[0].subscriptions.every(item => item.disposed));
  assert.equal(h.manager.sessions.length, 0, 'failed open must not leave a disposed terminal registered');
  assert.equal(h.manager.activeId, undefined);
  await h.manager.dispose();
});

test('render failure restores the previously active session without disposing its resources', async () => {
  const h = harness(); await h.manager.open('codex', h.folder);
  const previous = h.manager.sessions[0]; h.faults.render = true;
  await assert.rejects(h.manager.open('codex', h.folder), /render failed/);
  assert.equal(h.manager.sessions.length, 1); assert.equal(h.manager.sessions[0], previous);
  assert.equal(h.manager.activeId, previous.id); assert.equal(previous.element.parentElement !== undefined, true);
  assert.equal(h.ptys[0].kills, 0); assert.equal(h.terminals[0].disposes, 0);
  assert.equal(h.ptys[1].kills, 1); assert.equal(h.terminals[1].disposes, 1);
  await h.manager.dispose();
});

for (const stage of ['load', 'reveal']) test(`dispose during pending ${stage} prevents late process creation`, async () => {
  const h = harness(), gate = deferred(), reached = deferred();
  if (stage === 'load') h.setLoad(() => { reached.resolve(); return gate.promise; });
  else h.setReveal(() => { reached.resolve(); return gate.promise; });
  const opening = h.manager.open('codex', h.folder);
  await reached.promise;
  await h.manager.dispose(); gate.resolve({ spawn() { throw Error('must not spawn'); } });
  await assert.rejects(opening, /AutoOC has closed|opening was cancelled/);
  assert.equal(h.spawns.length, 0); assert.equal(h.manager.sessions.length, 0);
  await assert.rejects(h.manager.show(), /closed/); await assert.rejects(h.manager.installSupport(), /closed/);
  assert.throws(() => h.manager.add(), /closed/);
});

test('stopped host and unavailable plugin directory reject without installing or external fallback', async () => {
  const h = harness(); h.stop();
  await assert.rejects(h.manager.open('codex', h.folder), /closed/);
  assert.equal(h.loads.length, 0);
  const missing = harness(); delete missing.host.manifest.dir;
  await assert.rejects(missing.manager.open('codex', missing.folder), /installation directory is unavailable/);
  assert.equal(missing.loads.length, 0); assert.equal(missing.installs.length, 0); assert.equal(missing.external.length, 0);
});

test('session tabs select by click and keyboard; closing live sessions requires confirmation', async () => {
  const h = harness(); await h.manager.open('codex', h.folder); await h.manager.open('codex', h.folder);
  const [first, second] = h.manager.sessions;
  const tabs = () => h.view.contentEl.all().filter(el => el.attrs.role === 'tab');
  assert.equal(tabs().length, 2); assert.equal(tabs()[1].attrs['aria-selected'], 'true');
  tabs()[0].onclick(); assert.equal(h.manager.activeId, first.id);
  let prevented = false;
  tabs()[0].onkeydown({ key: 'ArrowLeft', preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.equal(h.manager.activeId, second.id); assert.equal(tabs()[1].focused, true);
  tabs()[1].onkeydown({ key: 'Home', preventDefault() {} }); assert.equal(h.manager.activeId, first.id);
  await h.view.contentEl.all().find(el => el.attrs['aria-label']?.startsWith('Close ')).onclick();
  assert.equal(h.ptys[0].kills, 0); assert.equal(h.manager.sessions.length, 2);
  await h.button(h.modals.at(-1).contentEl, 'Keep running').onclick(); assert.equal(h.manager.sessions.length, 2);
  await h.manager.requestClose(first.id); await h.button(h.modals.at(-1).contentEl, 'Stop and close').onclick();
  assert.equal(h.ptys[0].kills, 1); assert.equal(h.terminals[0].disposes, 1); assert.equal(h.manager.activeId, second.id);
  assert.ok(first.subscriptions.every(item => item.disposed));
  h.ptys[1].emit('exit', { exitCode: 0 }); const count = h.modals.length; await h.manager.requestClose(second.id);
  assert.equal(h.modals.length, count); assert.equal(h.manager.sessions.length, 0); assert.equal(h.manager.activeId, undefined);
  await h.manager.requestClose(-1); await h.manager.dispose();
});

test('hide and reopen view preserves PTY, terminal instance and output without restarting', async () => {
  const h = harness(); await h.manager.open('codex', h.folder); const session = h.manager.sessions[0];
  h.hide(); assert.equal(h.ptys[0].kills, 0); assert.equal(h.terminals[0].disposes, 0);
  assert.equal(h.observers[0].disconnected, true); assert.equal(h.frames.size, 0);
  h.ptys[0].emit('data', 'output while hidden'); await h.manager.show();
  assert.equal(h.manager.sessions[0], session); assert.equal(h.spawns.length, 1); assert.equal(h.terminals[0].opens, 1);
  assert.equal(session.element.parent !== undefined, true); assert.deepEqual(h.terminals[0].output, ['output while hidden']);
  h.button(h.view.contentEl, '+').onclick(); assert.equal(h.newSessions, 1); await h.manager.dispose();
});

test('dispose stops all owned sessions once and detaches views', async () => {
  const h = harness(); await h.manager.open('codex', h.folder); await h.manager.open('codex', h.folder);
  await h.manager.dispose(); await h.manager.dispose();
  assert.equal(h.manager.sessions.length, 0); assert.equal(h.view, undefined);
  for (const pty of h.ptys) { assert.equal(pty.kills, 1); assert.ok(pty.subscriptions.every(item => item.disposed)); }
  for (const terminal of h.terminals) { assert.equal(terminal.disposes, 1); assert.ok(terminal.subscriptions.every(item => item.disposed)); }
  await assert.rejects(h.manager.open('codex', h.folder), /closed/);
});

test('failed kill retains session and subscriptions for inspection until an explicit retry', async () => {
  const h = harness(); await h.manager.open('codex', h.folder); h.faults.kill = true;
  await h.manager.requestClose(h.manager.activeId); await h.button(h.modals.at(-1).contentEl, 'Stop and close').onclick();
  assert.equal(h.manager.sessions.length, 1); assert.equal(h.terminals[0].disposes, 0);
  assert.ok(h.ptys[0].subscriptions.every(item => !item.disposed)); assert.match(h.notices[0], /session kept for inspection/);
  h.faults.kill = false; await h.manager.dispose(); assert.equal(h.manager.sessions.length, 0);
});

test('confirmed close waits for kill before releasing the session, subscriptions or modal', async () => {
  const h = harness(); await h.manager.open('codex', h.folder);
  const session = h.manager.sessions[0], gate = deferred(); session.pty.killGate = gate;
  await h.manager.requestClose(session.id);
  const modal = h.modals.at(-1), closing = h.button(modal.contentEl, 'Stop and close').onclick();
  assert.equal(typeof closing.then, 'function'); assert.equal(session.pty.kills, 1);
  assert.equal(h.manager.sessions[0], session); assert.equal(h.manager.activeId, session.id);
  assert.equal(session.terminal.disposes, 0); assert.ok(session.element.parentElement);
  assert.ok(session.subscriptions.every(item => !item.disposed)); assert.equal(modal.closedByHost, undefined);
  session.pty.emit('data', 'still observed during stop');
  assert.equal(session.terminal.output.at(-1), 'still observed during stop');
  gate.resolve(); await closing;
  assert.equal(h.manager.sessions.length, 0); assert.equal(h.manager.activeId, undefined);
  assert.equal(session.terminal.disposes, 1); assert.equal(session.element.parentElement, undefined);
  assert.ok(session.subscriptions.every(item => item.disposed)); assert.equal(modal.closedByHost, true);
  await h.manager.dispose();
});

test('dispose waits for delayed kill and retains session resources and view until confirmation', async () => {
  const h = harness(); await h.manager.open('codex', h.folder);
  const session = h.manager.sessions[0], view = h.view, gate = deferred(); h.faults.killGate = gate;
  const disposing = h.manager.dispose();
  assert.equal(session.pty.kills, 1); assert.equal(h.manager.sessions[0], session);
  assert.equal(h.view, view); assert.equal(h.observers[0].disconnected, undefined);
  assert.ok(session.subscriptions.every(item => !item.disposed)); assert.equal(session.terminal.disposes, 0);
  await assert.rejects(h.manager.open('codex', h.folder), /closed/);
  gate.resolve(); await disposing;
  assert.equal(h.manager.sessions.length, 0); assert.equal(h.view, undefined);
  assert.ok(session.subscriptions.every(item => item.disposed)); assert.equal(session.terminal.disposes, 1);
  assert.equal(h.observers[0].disconnected, true);
});

test('dispose rejection preserves the failed session, observers and resources for inspection', async () => {
  const h = harness(); await h.manager.open('codex', h.folder); await h.manager.open('codex', h.folder);
  const [closed, retained] = h.manager.sessions, view = h.view, gate = deferred(); retained.pty.killGate = gate;
  const disposing = h.manager.dispose();
  const rejected = assert.rejects(disposing, /could not be stopped.*sessions and observers have been retained/);
  gate.reject(Error('stop not confirmed')); await rejected;
  assert.equal(closed.terminal.disposes, 1); assert.ok(closed.subscriptions.every(item => item.disposed));
  assert.equal(h.manager.sessions.length, 1); assert.equal(h.manager.sessions[0], retained);
  assert.equal(h.manager.activeId, retained.id); assert.equal(h.view, view);
  assert.equal(h.observers[0].disconnected, undefined); assert.ok(retained.element.parentElement);
  assert.equal(retained.terminal.disposes, 0); assert.ok(retained.subscriptions.every(item => !item.disposed));
  assert.ok(h.notices.some(text => text.includes(`PID ${retained.pty.pid}`) && text.includes('session kept for inspection')));
  retained.pty.emit('data', 'still observed after failed stop');
  retained.pty.emit('exit', { exitCode: 9 });
  assert.equal(retained.terminal.output[0], 'still observed after failed stop');
  assert.ok(h.view.contentEl.all().some(el => el.textContent.includes('(exited 9)')));
  await assert.rejects(h.manager.show(), /closed/);
  retained.pty.killGate = undefined; await h.manager.dispose();
  assert.equal(h.manager.sessions.length, 0); assert.equal(h.view, undefined);
});

test('background exit updates status without stealing focus or detaching the active terminal element', async () => {
  const h = harness(); await h.manager.open('codex', h.folder); await h.manager.open('codex', h.folder);
  const [background, active] = h.manager.sessions, parent = active.element.parentElement;
  const focusCounts = h.terminals.map(terminal => terminal.focuses || 0);
  const detachments = active.element.detachments || 0;
  h.ptys[0].emit('exit', { exitCode: 4 });
  assert.equal(h.manager.activeId, active.id); assert.equal(background.exited, true);
  assert.ok(h.view.contentEl.all().some(el => el.attrs.role === 'tab' && el.textContent.includes('(exited 4)')));
  assert.deepEqual(h.terminals.map(terminal => terminal.focuses || 0), focusCounts);
  assert.equal(active.element.parentElement, parent); assert.equal(active.element.detachments || 0, detachments);
  assert.equal(active.terminal.opens, 1); assert.equal(active.terminal.disposes, 0);
  await h.manager.dispose();
});

for (const stage of ['render', 'subscribe']) test(`${stage} failure plus kill rejection retains PTY ownership until cleanup retry succeeds`, async () => {
  const h = harness(); h.faults[stage] = true; h.faults.kill = true;
  assert.equal(h.manager.hasRunningSessions, false); assert.equal(h.manager.hasPendingCleanup, false);
  await assert.rejects(h.manager.open('codex', h.folder), error => {
    assert.match(error.message, new RegExp(`${stage} failed`));
    assert.match(error.message, /cleanup is unconfirmed.*AutoOC still tracks it/);
    assert.ok(error.message.includes(`PID ${h.ptys[0].pid}`)); return true;
  });
  const pty = h.ptys[0], terminal = h.terminals[0];
  assert.equal(h.manager.sessions.length, 0); assert.equal(h.manager.activeId, undefined);
  assert.equal(terminal.disposes, 1); assert.equal(terminal.element?.parentElement, undefined);
  assert.ok(pty.subscriptions.length > 0); assert.ok(pty.subscriptions.every(item => item.disposed));
  assert.ok(terminal.subscriptions.every(item => item.disposed));
  assert.equal(h.manager.hasPendingCleanup, true); assert.equal(h.manager.hasRunningSessions, true);
  await assert.rejects(h.manager.retryPendingCleanup(), /still tracks.*cleanup is unconfirmed/);
  assert.equal(pty.kills, 2); assert.equal(h.manager.hasPendingCleanup, true);
  assert.equal(h.manager.hasRunningSessions, true); assert.equal(terminal.disposes, 1);
  const gate = deferred(); pty.killGate = gate; h.faults.kill = false;
  const retry = h.manager.retryPendingCleanup();
  assert.equal(pty.kills, 3); assert.equal(h.manager.hasPendingCleanup, true); assert.equal(h.manager.hasRunningSessions, true);
  gate.resolve(); await retry;
  assert.equal(h.manager.hasPendingCleanup, false); assert.equal(h.manager.hasRunningSessions, false);
  assert.equal(terminal.disposes, 1); assert.equal(h.external.length, 0);
  await h.manager.dispose(); assert.equal(pty.kills, 3);
});

for (const stage of ['render', 'subscribe']) test(`stopAll includes pending PTY cleanup after ${stage} failure and can retry after rejection`, async () => {
  const h = harness(); h.faults[stage] = true; h.faults.kill = true;
  await assert.rejects(h.manager.open('codex', h.folder), /cleanup is unconfirmed/);
  const pending = h.ptys[0]; h.faults[stage] = false; h.faults.kill = false;
  await h.manager.open('codex', h.folder);
  const healthy = h.manager.sessions[0], view = h.view, gate = deferred(); pending.killGate = gate;
  const stopping = h.manager.stopAll();
  const rejected = assert.rejects(stopping, /still tracks.*cleanup is unconfirmed/);
  assert.equal(pending.kills, 2); assert.equal(healthy.pty.kills, 1);
  await assert.rejects(h.manager.open('codex', h.folder), /sessions are stopping/);
  gate.reject(Error('cleanup retry failed')); await rejected;
  assert.equal(h.manager.sessions.length, 0); assert.equal(healthy.terminal.disposes, 1);
  assert.equal(h.manager.hasPendingCleanup, true); assert.equal(h.manager.hasRunningSessions, true);
  assert.equal(h.view, view);
  pending.killGate = undefined; await h.manager.stopAll();
  assert.equal(pending.kills, 3); assert.equal(healthy.pty.kills, 1);
  assert.equal(h.manager.hasPendingCleanup, false); assert.equal(h.manager.hasRunningSessions, false);
  await h.manager.dispose();
});

test('dispose rejects and keeps its leaf while partial-open PTY cleanup remains unconfirmed', async () => {
  const h = harness(); h.faults.subscribe = true; h.faults.kill = true;
  await assert.rejects(h.manager.open('codex', h.folder), /cleanup is unconfirmed/);
  const ownLeaf = h.leaves[0];
  await assert.rejects(h.manager.dispose(), /still tracks.*cleanup is unconfirmed/);
  assert.equal(ownLeaf.detaches, 0); assert.equal(h.manager.hasPendingCleanup, true);
  assert.equal(h.manager.hasRunningSessions, true); assert.equal(h.ptys[0].kills, 2);
  h.faults.kill = false; await h.manager.dispose();
  assert.equal(h.manager.hasPendingCleanup, false); assert.equal(h.manager.hasRunningSessions, false);
  assert.equal(ownLeaf.detaches, 1); assert.equal(h.leaves.length, 0);
});

for (const stage of ['load', 'reveal']) test(`stopAll cancels an opening generation awaiting ${stage} even after stopAll completes`, async () => {
  const h = harness(), reached = deferred(), gate = deferred();
  if (stage === 'load') h.setLoad(() => { reached.resolve(); return gate.promise; });
  else h.setReveal(() => { reached.resolve(); return gate.promise; });
  const opening = h.manager.open('codex', h.folder);
  await reached.promise; assert.equal(h.manager.hasRunningSessions, true);
  await h.manager.stopAll();
  assert.equal(h.spawns.length, 0); assert.equal(h.manager.hasRunningSessions, true);
  gate.resolve({ spawn() { assert.fail('cancelled generation must never spawn'); } });
  await assert.rejects(opening, /opening was cancelled while sessions were stopping/);
  assert.equal(h.spawns.length, 0); assert.equal(h.manager.sessions.length, 0);
  assert.equal(h.manager.hasRunningSessions, false); assert.equal(h.manager.hasPendingCleanup, false);
  h.resetLoad(); h.setReveal(async () => {});
  await h.manager.open('codex', h.folder); assert.equal(h.spawns.length, 1);
  await h.manager.dispose();
});

test('concurrent stopAll and confirmed close share one kill and dispose session resources once', async () => {
  const h = harness(); await h.manager.open('codex', h.folder);
  const session = h.manager.sessions[0], gate = deferred(); session.pty.killGate = gate;
  await h.manager.requestClose(session.id);
  const modal = h.modals.at(-1), closing = h.button(modal.contentEl, 'Stop and close').onclick();
  const stopping = h.manager.stopAll();
  assert.equal(session.pty.kills, 1); assert.equal(session.terminal.disposes, 0);
  assert.ok(session.subscriptions.every(item => !item.disposed));
  gate.resolve(); await Promise.all([closing, stopping]);
  assert.equal(session.pty.kills, 1); assert.equal(session.terminal.disposes, 1);
  assert.equal(h.manager.sessions.length, 0); assert.equal(h.manager.hasRunningSessions, false);
  assert.ok(session.subscriptions.every(item => item.disposed)); assert.equal(modal.closedByHost, true);
  await h.manager.dispose();
});

test('dispose detaches only its own views and preserves successor and unrelated leaves', async () => {
  const h = harness(); await h.manager.open('codex', h.folder);
  const ownLeaf = h.leaves[0], successor = new h.IntegratedTerminals(h.host, () => {});
  const successorLeaf = h.app.workspace.getLeaf('tab');
  await successorLeaf.setViewState({ type: h.TERMINAL_VIEW_TYPE, active: true });
  const unrelatedLeaf = h.app.workspace.getLeaf('tab');
  unrelatedLeaf.view = { manager: h.manager, onClose() { assert.fail('unrelated view must not close'); } };
  assert.equal(ownLeaf.view.manager, h.manager); assert.equal(successorLeaf.view.manager, successor);
  const successorView = successorLeaf.view;
  h.app.workspace.detachLeavesOfType = () => assert.fail('dispose must not detach all leaves of this type');
  await h.manager.dispose();
  assert.equal(ownLeaf.detaches, 1); assert.equal(successorLeaf.detaches, 0); assert.equal(unrelatedLeaf.detaches, 0);
  assert.equal(successorLeaf.view, successorView); assert.equal(h.observers[1].disconnected, undefined);
  assert.deepEqual(h.leaves, [successorLeaf, unrelatedLeaf]);
  await successor.dispose();
  assert.equal(successorLeaf.detaches, 1); assert.equal(unrelatedLeaf.detaches, 0);
  assert.deepEqual(h.leaves, [unrelatedLeaf]);
});

test('session cap rejects a thirteenth launch before loading another backend', async () => {
  const h = harness(); for (let i = 0; i < 12; i++) await h.manager.open('codex', h.folder);
  await assert.rejects(h.manager.open('codex', h.folder), /12 sessions maximum/);
  assert.equal(h.loads.length, 12); assert.equal(h.spawns.length, 12); await h.manager.dispose();
});

test('Settings owns destination and opt-in support; opening Settings or launcher never installs', async () => {
  const h = harness(), modal = h.modal();
  const root = h.settings();
  assert.equal(h.installs.length, 0);
  assert.equal(modal.contentEl.all().some(el => el.tag === 'select' && el.options.integrated), false);
  assert.equal(h.button(modal.contentEl, 'Download and install'), undefined);
  assert.equal(h.button(modal.contentEl, 'Show existing terminals'), undefined);
  assert.ok(modal.contentEl.all().some(el => el.textContent.includes('Terminal: External window')));
  const destination = root.all().find(el => el.tag === 'select' && el.options.integrated);
  assert.equal(destination.value, 'external'); await destination.change('integrated'); assert.equal(h.installs.length, 0);
  await h.button(root, 'Download and install').onclick();
  assert.deepEqual(h.installs, ['C:\\Vault\\.obsidian\\plugins\\auto-oc']); assert.equal(h.spawns.length, 0);
  assert.ok(root.all().some(el => el.description?.includes('Terminal support is ready')));
  await h.manager.dispose();
});

test('launcher integrated failure remains visible and never falls back to external terminal', async () => {
  const h = harness(); h.setLoad(async () => { throw Error('support absent: opt-in required'); });
  h.host.settings.cliTerminalDestination = 'integrated'; const modal = h.modal();
  const open = h.button(modal.contentEl, 'Open in project'); await open.onclick();
  assert.equal(modal.closedByHost, undefined); assert.equal(open.disabled, false);
  assert.ok(modal.contentEl.all().some(el => el.attrs.role === 'alert' && el.textContent.includes('support absent')));
  assert.equal(h.installs.length, 0); assert.equal(h.external.length, 0); assert.equal(h.spawns.length, 0);
});

test('launcher suppresses duplicate integrated launches and keeps its captured destination while pending', async () => {
  const h = harness(), gate = deferred(), attempts = [];
  h.host.openIntegratedCli = (...args) => { attempts.push(args); return gate.promise; };
  h.host.settings.cliTerminalDestination = 'integrated'; const modal = h.modal();
  const open = h.button(modal.contentEl, 'Open in project');
  const first = open.onclick(); await open.onclick(); h.host.settings.cliTerminalDestination = 'external';
  assert.equal(open.disabled, true); assert.equal(attempts.length, 1);
  gate.resolve(); await first; assert.equal(modal.closedByHost, true); assert.equal(h.external.length, 0);
});

function taskRequest(h, overrides = {}) {
  return { bin: 'C:\\Tools\\opencode.exe', cwd: h.folder, label: 'Task terminal', major: 1,
    model: 'provider/task-model', agent: 'build', prompt: 'Complete the task exactly.', ...overrides };
}

for (const [name, major] of [['OpenCode 1', 1], ['OpenCode 2', 2], ['legacy undefined-kind mapped to major 1', 1]]) {
  test(`openTask ${name} uses request options and a short pointer to its full UTF-8 prompt`, async () => {
    const h = harness(), checked = [];
    const request = taskRequest(h, { major, prompt: 'Full task: \u00f1 \u4e2d \ud83d\ude80\n'.repeat(12000),
      model: "provider/model ' & $env:PATH", agent: "agent ' ; $(literal)", label: 'Workflow task label' });
    h.host.settings.opencodePath = 'C:\\Menu\\wrong.exe'; h.host.settings.opencode2Path = 'C:\\Menu\\wrong2.exe';
    h.host.settings.cliLauncherEnabled = { opencode: false, opencode2: false };
    h.setVersion(async bin => { checked.push(bin); });
    const settingsBefore = JSON.stringify(h.host.settings);
    await h.manager.openTask(request);
    assert.deepEqual(checked, major === 2 ? [request.bin] : []);
    const spawn = h.spawns[0], session = h.manager.sessions[0], write = h.writes[0];
    assert.equal(spawn.file, request.bin); assert.equal(spawn.options.cwd, request.cwd); assert.equal(session.label, request.label);
    assert.equal(write.bytes.toString('utf8'), request.prompt); assert.deepEqual(write.bytes, Buffer.from(request.prompt, 'utf8'));
    assert.equal(h.promptFiles.get(write.file), write.bytes);
    assert.equal(path.win32.dirname(write.file), h.auxiliary[0]); assert.equal(path.win32.basename(write.file), 'prompt.txt');
    const pointer = `Read ${path.win32.relative(request.cwd, write.file).split('\\').join('/')} as UTF-8 and follow its instructions.`;
    assert.ok(pointer.length < 256); assert.ok(!pointer.includes(request.prompt));
    assert.deepEqual(Array.from(spawn.args), [...(major === 2 ? ['mini', '--standalone'] : []),
      '-m', request.model, '--agent', request.agent, '--prompt', pointer]);
    assert.equal(JSON.stringify(h.host.settings), settingsBefore); assert.equal(h.completed.length, 0);
    assert.equal(h.installs.length, 0); assert.equal(h.external.length, 0);
    await assert.rejects(h.manager.open(major === 2 ? 'opencode2' : 'opencode', h.folder), /disabled/);
    await h.manager.dispose(); assert.equal(h.promptFiles.size, 0); assert.deepEqual(h.completed, [h.auxiliary[0]]);
  });
}

for (const extension of ['exe', 'cmd', 'ps1']) test(`openTask keeps .${extension} executable and task argv literal without permission bypass`, async () => {
  const h = harness(), bin = `C:\\O'Brien & $HOME; %PATH% [x]\\task.${extension}`; h.files.add(bin);
  const request = taskRequest(h, { bin, model: "provider/a'b; & $HOME %PATH% [x]", agent: "a'b; $(literal)" });
  await h.manager.openTask(request);
  const pointer = `Read ${path.win32.relative(h.folder, h.writes[0].file).split('\\').join('/')} as UTF-8 and follow its instructions.`;
  const expectedArgs = ['-m', request.model, '--agent', request.agent, '--prompt', pointer], spawn = h.spawns[0];
  if (extension === 'exe') {
    assert.equal(spawn.file, bin); assert.deepEqual(Array.from(spawn.args), expectedArgs);
  } else {
    assert.equal(spawn.file, 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
    assert.deepEqual(Array.from(spawn.args.slice(0, 3)), ['-NoLogo', '-NoProfile', '-EncodedCommand']);
    const literal = value => `'${value.replace(/'/g, "''")}'`;
    assert.equal(Buffer.from(spawn.args[3], 'base64').toString('utf16le'),
      `& ${[bin, ...expectedArgs].map(literal).join(' ')}; if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE } elseif (!$?) { exit 1 }`);
  }
  assert.equal(h.external.length, 0); await h.manager.dispose();
});

for (const major of [1, 2]) test(`openTask major ${major} force-model representation agent empty omits agent without bypass flags`, async () => {
  const h = harness(); await h.manager.openTask(taskRequest(h, { major, agent: '' }));
  const args = Array.from(h.spawns[0].args);
  assert.deepEqual(args.slice(0, -1), [...(major === 2 ? ['mini', '--standalone'] : []), '-m', 'provider/task-model', '--prompt']);
  for (const flag of ['--agent', '--auto', '--dangerously-skip-permissions', '--yolo']) assert.equal(args.includes(flag), false);
  await h.manager.dispose();
});

test('openTask snapshots task fields before pending backend load', async () => {
  const h = harness(), gate = deferred(), reached = deferred(), request = taskRequest(h);
  h.setLoad(async () => { reached.resolve(); await gate.promise; return h.ptyBackend; });
  const opening = h.manager.openTask(request); await reached.promise;
  Object.assign(request, { bin: 'C:\\Wrong.exe', label: 'Changed', major: 2, model: 'changed', agent: '', prompt: 'changed', cwd: 'C:\\Wrong' });
  gate.resolve(); await opening;
  assert.equal(h.spawns[0].file, 'C:\\Tools\\opencode.exe'); assert.equal(h.spawns[0].options.cwd, h.folder);
  assert.equal(h.manager.sessions[0].label, 'Task terminal'); assert.equal(h.writes[0].bytes.toString('utf8'), 'Complete the task exactly.');
  assert.deepEqual(Array.from(h.spawns[0].args.slice(0, 4)), ['-m', 'provider/task-model', '--agent', 'build']);
  await h.manager.dispose();
});

test('openTask rejects empty executable or incompatible OpenCode 2 before files or PTY loading', async () => {
  const h = harness(); await assert.rejects(h.manager.openTask(taskRequest(h, { bin: ' ' })), /explicit executable/);
  h.setVersion(async () => { throw Error('wrong OpenCode major'); });
  await assert.rejects(h.manager.openTask(taskRequest(h, { major: 2 })), /wrong OpenCode major/);
  assert.equal(h.loads.length, 0); assert.equal(h.writes.length, 0); assert.equal(h.spawns.length, 0);
  await h.manager.dispose();
});

for (const stage of ['before', 'load', 'reveal', 'prompt', 'spawn']) test(`openTask abort at ${stage} prevents late task publication and cleans only confirmed resources`, async () => {
  const h = harness(), controller = new AbortController(), gate = deferred(), reached = deferred();
  const request = taskRequest(h, { signal: controller.signal });
  if (stage === 'before') controller.abort();
  if (stage === 'load') h.setLoad(async () => { reached.resolve(); await gate.promise; return h.ptyBackend; });
  if (stage === 'reveal') h.setReveal(() => { reached.resolve(); return gate.promise; });
  if (stage === 'prompt') h.faults.onPromptWrite = () => controller.abort();
  if (stage === 'spawn') h.faults.onSpawn = () => controller.abort();
  const opening = h.manager.openTask(request);
  if (stage === 'load' || stage === 'reveal') { await reached.promise; controller.abort(); gate.resolve(); }
  await assert.rejects(opening, /opening was cancelled/);
  assert.equal(h.manager.sessions.length, 0); assert.equal(h.manager.hasRunningSessions, false);
  assert.equal(h.spawns.length, stage === 'spawn' ? 1 : 0); assert.equal(h.promptFiles.size, 0);
  assert.equal(h.completed.length, stage === 'prompt' || stage === 'spawn' ? 1 : 0);
  if (stage === 'before') assert.equal(h.loads.length, 0);
  for (const pty of h.ptys) assert.equal(pty.kills, 1);
  for (const terminal of h.terminals) assert.equal(terminal.disposes, 1);
  await h.manager.dispose();
});

test('task prompt files remain while hidden and are cleaned only for the session whose exit is confirmed', async () => {
  const h = harness(); await h.manager.openTask(taskRequest(h, { prompt: 'First complete prompt' }));
  await h.manager.openTask(taskRequest(h, { prompt: 'Second complete prompt' }));
  const [first, second] = h.writes; h.hide();
  assert.equal(h.promptFiles.size, 2); assert.equal(h.completed.length, 0);
  h.ptys[0].emit('exit', { exitCode: 0 });
  assert.equal(h.promptFiles.has(first.file), false); assert.equal(h.promptFiles.has(second.file), true);
  await h.manager.requestClose(h.manager.sessions[0].id);
  assert.deepEqual(h.completed, [h.auxiliary[0]]);
  await h.manager.dispose(); assert.equal(h.promptFiles.size, 0); assert.deepEqual(h.completed, h.auxiliary);
});

test('task prompt files survive pending or rejected kill and clean after a confirmed stop retry', async () => {
  const h = harness(); await h.manager.openTask(taskRequest(h));
  const gate = deferred(); h.ptys[0].killGate = gate;
  const stopping = h.manager.stopAll(), rejected = assert.rejects(stopping, /could not be stopped/);
  assert.equal(h.promptFiles.size, 1); assert.equal(h.completed.length, 0);
  gate.reject(Error('native stop unconfirmed')); await rejected;
  assert.equal(h.promptFiles.size, 1); assert.equal(h.completed.length, 0); assert.equal(h.manager.sessions.length, 1);
  h.ptys[0].killGate = undefined; await h.manager.stopAll();
  assert.equal(h.promptFiles.size, 0); assert.deepEqual(h.completed, h.auxiliary); await h.manager.dispose();
});

test('throwing task spawn retains prompt evidence instead of assuming no native process exists', async () => {
  const h = harness(); h.faults.spawn = true;
  await assert.rejects(h.manager.openTask(taskRequest(h)), error => {
    assert.match(error.message, /spawn failed.*launch is unconfirmed.*prompt evidence was retained/);
    assert.ok(error.message.includes(h.auxiliary[0])); return true;
  });
  assert.equal(h.spawns.length, 1); assert.equal(h.ptys.length, 0); assert.equal(h.manager.sessions.length, 0);
  assert.equal(h.promptFiles.size, 1); assert.equal(h.completed.length, 0); assert.equal(h.terminals[0].disposes, 1);
  await h.manager.dispose(); assert.equal(h.promptFiles.size, 1); assert.equal(h.completed.length, 0);
});

for (const stage of ['render', 'subscribe', 'abort after spawn']) test(`task ${stage} plus kill error retains its prompt until pending cleanup retry succeeds`, async () => {
  const h = harness(), controller = new AbortController();
  h.faults.kill = true;
  if (stage === 'abort after spawn') h.faults.onSpawn = () => controller.abort(); else h.faults[stage] = true;
  await assert.rejects(h.manager.openTask(taskRequest(h, { signal: controller.signal })), /cleanup is unconfirmed/);
  assert.equal(h.manager.sessions.length, 0); assert.equal(h.terminals[0].disposes, 1);
  assert.equal(h.manager.hasPendingCleanup, true); assert.equal(h.promptFiles.size, 1); assert.equal(h.completed.length, 0);
  await assert.rejects(h.manager.retryPendingCleanup(), /still tracks/);
  assert.equal(h.promptFiles.size, 1); assert.equal(h.completed.length, 0);
  const gate = deferred(); h.faults.kill = false; h.ptys[0].killGate = gate;
  const retry = h.manager.retryPendingCleanup(); assert.equal(h.promptFiles.size, 1); gate.resolve(); await retry;
  assert.equal(h.promptFiles.size, 0); assert.deepEqual(h.completed, h.auxiliary);
  assert.equal(h.manager.hasPendingCleanup, false); assert.equal(h.manager.hasRunningSessions, false);
  await h.manager.dispose(); assert.equal(h.completed.length, 1);
});

test('two simultaneous task opens both succeed sequentially and retain their own request snapshots', async () => {
  const h = harness(), gates = [deferred(), deferred()], reached = [deferred(), deferred()]; let loads = 0;
  h.setLoad(async () => { const index = loads++; reached[index].resolve(); await gates[index].promise; return h.ptyBackend; });
  const secondRequest = taskRequest(h, { label: 'Second task', model: 'second-model', prompt: 'second prompt' });
  const first = h.manager.openTask(taskRequest(h, { label: 'First task', model: 'first-model', prompt: 'first prompt' }));
  const second = h.manager.openTask(secondRequest);
  assert.equal(h.loads.length, 0); assert.equal(h.manager.hasRunningSessions, true);
  await reached[0].promise;
  Object.assign(secondRequest, { model: 'mutated', prompt: 'mutated', label: 'mutated' });
  assert.equal(h.loads.length, 1); assert.equal(h.spawns.length, 0);
  gates[0].resolve(); await first; await reached[1].promise;
  assert.equal(h.spawns.length, 1); assert.equal(h.manager.sessions[0].label, 'First task');
  gates[1].resolve(); await second;
  assert.deepEqual(Array.from(h.manager.sessions, session => session.label), ['First task', 'Second task']);
  assert.deepEqual(h.spawns.map(spawn => spawn.args[1]), ['first-model', 'second-model']);
  assert.deepEqual(h.writes.map(write => write.bytes.toString('utf8')), ['first prompt', 'second prompt']);
  assert.equal(h.manager.hasPendingCleanup, false);
  for (const pty of h.ptys) pty.emit('exit', { exitCode: 0 });
  assert.equal(h.manager.hasRunningSessions, false); await h.manager.dispose();
});

test('tasks wait for a pending manual open and a duplicate manual rejection cannot replace their queue', async () => {
  const h = harness(), manualGate = deferred(), taskGate = deferred(), manualReached = deferred(), taskReached = deferred();
  let loads = 0;
  h.setLoad(async () => {
    loads++;
    if (loads === 1) { manualReached.resolve(); await manualGate.promise; }
    if (loads === 2) { taskReached.resolve(); await taskGate.promise; }
    return h.ptyBackend;
  });
  const manual = h.manager.open('codex', h.folder); await manualReached.promise;
  const first = h.manager.openTask(taskRequest(h, { label: 'Queued one' }));
  const second = h.manager.openTask(taskRequest(h, { label: 'Queued two' }));
  await assert.rejects(h.manager.open('codex', h.folder), /already opening/);
  assert.equal(h.loads.length, 1); assert.equal(h.spawns.length, 0); assert.equal(h.writes.length, 0);
  manualGate.resolve(); await manual; await taskReached.promise;
  assert.equal(h.spawns.length, 1); assert.equal(h.spawns[0].file, h.binary);
  assert.equal(h.manager.sessions.length, 1); assert.equal(h.manager.hasRunningSessions, true);
  await assert.rejects(h.manager.open('codex', h.folder), /already opening/);
  taskGate.resolve(); await Promise.all([first, second]);
  assert.deepEqual(Array.from(h.manager.sessions, session => session.label), ['Codex CLI', 'Queued one', 'Queued two']);
  assert.equal(h.loads.length, 3); assert.equal(h.writes.length, 2);
  await h.manager.dispose(); assert.equal(h.manager.hasRunningSessions, false);
});

test('manual opens cannot overtake task requests queued before their first microtask', async () => {
  const h = harness();
  const first = h.manager.openTask(taskRequest(h, { label: 'First' }));
  const second = h.manager.openTask(taskRequest(h, { label: 'Second' }));
  await assert.rejects(h.manager.open('codex', h.folder), /already opening/);
  await Promise.all([first, second]);
  assert.deepEqual(Array.from(h.manager.sessions, session => session.label), ['First', 'Second']);
  assert.equal(h.spawns.length, 2); await h.manager.dispose();
});

test('an aborted enqueued task never loads, writes or spawns and does not poison the following request', async () => {
  const h = harness(), gate = deferred(), reached = deferred(), controller = new AbortController(); let loads = 0;
  h.setLoad(async () => { if (++loads === 1) { reached.resolve(); await gate.promise; } return h.ptyBackend; });
  const first = h.manager.openTask(taskRequest(h, { label: 'First' })); await reached.promise;
  const cancelled = h.manager.openTask(taskRequest(h, { label: 'Cancelled', prompt: 'must not write', signal: controller.signal }));
  const rejected = assert.rejects(cancelled, /opening was cancelled/);
  const third = h.manager.openTask(taskRequest(h, { label: 'Third' })); controller.abort();
  assert.equal(h.loads.length, 1); gate.resolve(); await Promise.all([first, rejected, third]);
  assert.deepEqual(Array.from(h.manager.sessions, session => session.label), ['First', 'Third']);
  assert.equal(h.loads.length, 2); assert.equal(h.spawns.length, 2); assert.equal(h.writes.length, 2);
  assert.ok(h.writes.every(write => write.bytes.toString('utf8') !== 'must not write'));
  await h.manager.dispose(); assert.equal(h.manager.hasRunningSessions, false);
});

for (const operation of ['stopAll', 'dispose']) {
  for (const stage of ['load', 'reveal']) test(`${operation} invalidates active and enqueued task generations awaiting ${stage}, with no late effects`, async () => {
    const h = harness(), gate = deferred(), reached = deferred();
    if (stage === 'load') h.setLoad(async () => { reached.resolve(); await gate.promise; return h.ptyBackend; });
    else h.setReveal(() => { reached.resolve(); return gate.promise; });
    const active = h.manager.openTask(taskRequest(h, { label: 'Active pending' })); await reached.promise;
    const queued = h.manager.openTask(taskRequest(h, { label: 'Enqueued before stop' }));
    const activeRejected = assert.rejects(active, /opening was cancelled|AutoOC has closed/);
    const queuedRejected = assert.rejects(queued, /opening was cancelled|AutoOC has closed/);
    assert.equal(h.manager.hasRunningSessions, true);
    await h.manager[operation]();
    assert.equal(h.manager.hasRunningSessions, true, 'queued and active requests remain accounted for until settled');
    gate.resolve(); await Promise.all([activeRejected, queuedRejected]);
    assert.equal(h.loads.length, 1); assert.equal(h.spawns.length, 0); assert.equal(h.writes.length, 0);
    assert.equal(h.manager.sessions.length, 0); assert.equal(h.manager.hasRunningSessions, false);
    assert.equal(h.manager.hasPendingCleanup, false);
    assert.equal(h.leaves.length, operation === 'stopAll' && stage === 'reveal' ? 1 : 0);
    if (operation === 'stopAll') {
      h.resetLoad(); h.setReveal(async () => {});
      await h.manager.openTask(taskRequest(h, { label: 'New generation' }));
      assert.equal(h.spawns.length, 1); assert.equal(h.manager.sessions[0].label, 'New generation');
      await h.manager.dispose();
    } else await assert.rejects(h.manager.openTask(taskRequest(h)), /AutoOC has closed/);
  });

  test(`${operation} invalidates tasks queued before any task begins opening`, async () => {
    const h = harness();
    const first = h.manager.openTask(taskRequest(h)), second = h.manager.openTask(taskRequest(h));
    const rejected = [first, second].map(pending => assert.rejects(pending, /sessions are stopping|opening was cancelled|AutoOC has closed/));
    assert.equal(h.loads.length, 0); assert.equal(h.manager.hasRunningSessions, true);
    await h.manager[operation](); await Promise.all(rejected);
    assert.equal(h.loads.length, 0); assert.equal(h.spawns.length, 0); assert.equal(h.writes.length, 0);
    assert.equal(h.manager.hasRunningSessions, false); await h.manager.dispose();
  });
}

for (const stage of ['spawn without handle', 'unconfirmed cleanup']) test(`task ${stage} uses the real uncertain error class and stable code`, async () => {
  const h = harness();
  if (stage === 'spawn without handle') h.faults.spawn = true;
  else { h.faults.subscribe = true; h.faults.kill = true; }
  await assert.rejects(h.manager.openTask(taskRequest(h)), error => {
    assert.ok(error instanceof taskTerminal.InteractiveTerminalLaunchUncertainError);
    assert.equal(error.code, 'AUTOOC_TERMINAL_UNCERTAIN');
    assert.match(error.message, /unconfirmed/); return true;
  });
  assert.equal(h.promptFiles.size, 1); assert.equal(h.completed.length, 0);
  if (stage === 'unconfirmed cleanup') {
    h.faults.kill = false; await h.manager.retryPendingCleanup(); assert.equal(h.promptFiles.size, 0);
  }
  await h.manager.dispose();
});

const taskProviders = ['opencode', 'opencode2', 'codex', 'copilot', 'claude'];

function providerRequest(h, provider, overrides = {}) {
  const bin = `C:\\Task's & tools\\${provider}.exe`; h.files.add(bin);
  return taskRequest(h, { provider, bin, agent: '', label: `${provider} task`, ...overrides });
}

for (const provider of taskProviders) test(`explicit ${provider} task overrides its menu path and visibility with literal owned UTF-8 handoff`, async () => {
  const h = harness(), checked = [];
  const request = providerRequest(h, provider, {
    major: provider === 'opencode2' ? 1 : 2,
    model: "provider/model ' ; $HOME [literal]", prompt: 'Full handoff \u00f1 \u4e2d \ud83d\ude80\n--allow-all; $HOME & %PATH%\n'.repeat(6000),
    agent: provider.startsWith('opencode') ? "agent's & literal" : '',
    reasoningEffort: 'high',
  });
  h.host.settings.cliLauncherEnabled = Object.fromEntries(taskProviders.map(id => [id, false]));
  for (const key of ['opencodePath', 'opencode2Path', 'codexPath', 'copilotPath', 'claudePath']) h.host.settings[key] = 'C:\\Menu\\wrong.exe';
  const before = JSON.stringify(h.host.settings); h.setVersion(async bin => { checked.push(bin); });
  await h.manager.openTask(request);
  assert.deepEqual(checked, provider === 'opencode2' ? [request.bin] : []);
  const spawn = h.spawns[0], write = h.writes[0];
  const pointer = `Read ${path.win32.relative(h.folder, write.file).split('\\').join('/')} as UTF-8 and follow its instructions.`;
  assert.equal(spawn.file, request.bin); assert.equal(spawn.options.cwd, request.cwd);
  assert.equal(h.manager.sessions[0].label, request.label); assert.ok(pointer.length < 256);
  assert.deepEqual(write.bytes, Buffer.from(request.prompt, 'utf8')); assert.equal(h.promptFiles.get(write.file), write.bytes);
  assert.equal(path.win32.dirname(write.file), h.auxiliary[0]); assert.equal(h.completed.length, 0);
  const expected = provider === 'opencode' ? ['-m', request.model, '--agent', request.agent, '--prompt', pointer]
    : provider === 'opencode2' ? ['mini', '--standalone', '-m', request.model, '--agent', request.agent, '--prompt', pointer]
    : provider === 'codex' ? ['--model', request.model, '--config', 'model_reasoning_effort="high"', '--', pointer]
    : provider === 'copilot' ? ['--model', request.model, '--interactive', pointer]
    : ['--model', request.model, '--', pointer];
  assert.deepEqual(Array.from(spawn.args), expected);
  assert.ok(!spawn.args.some(arg => arg.includes(request.prompt) || arg.includes('Full handoff')));
  for (const flag of ['-p', '--allow-all', '--auto', '--dangerously-skip-permissions', '--dangerously-skip-permissions=true', '--yolo']) {
    assert.equal(spawn.args.includes(flag), false);
  }
  assert.equal(JSON.stringify(h.host.settings), before); assert.equal(h.installs.length, 0); assert.equal(h.external.length, 0);
  await assert.rejects(h.manager.open(provider, h.folder), /disabled/);
  // Natural exit and confirmed explicit stop exercise the same ownership contract across providers.
  if (provider === 'codex' || provider === 'opencode2' || provider === 'claude') {
    h.ptys[0].emit('exit', { exitCode: 0 }); assert.equal(h.promptFiles.size, 0);
  } else { assert.equal(h.promptFiles.size, 1); await h.manager.stopAll(); }
  await h.manager.dispose(); assert.equal(h.promptFiles.size, 0); assert.deepEqual(h.completed, h.auxiliary);
});

for (const provider of taskProviders) test(`${provider} task with empty model uses native defaults without placeholder arguments`, async () => {
  const h = harness(); await h.manager.openTask(providerRequest(h, provider, { model: '' }));
  const args = Array.from(h.spawns[0].args), pointer = args.at(-1);
  assert.match(pointer, /^Read .*prompt\.txt as UTF-8 and follow its instructions\.$/);
  const expected = provider === 'opencode' ? ['--prompt', pointer]
    : provider === 'opencode2' ? ['mini', '--standalone', '--prompt', pointer]
    : provider === 'copilot' ? ['--interactive', pointer] : ['--', pointer];
  assert.deepEqual(args, expected); assert.equal(args.includes(''), false);
  assert.equal(args.includes('-m'), false); assert.equal(args.includes('--model'), false); assert.equal(args.includes('--config'), false);
  await h.manager.dispose();
});

test('Codex task optional reasoning is a single quoted TOML value and does not require a model', async () => {
  const h = harness(), effort = 'high"\nother_setting=true\\literal';
  await h.manager.openTask(providerRequest(h, 'codex', { model: '', reasoningEffort: effort }));
  const args = Array.from(h.spawns[0].args);
  assert.deepEqual(args.slice(0, -1), ['--config', `model_reasoning_effort=${JSON.stringify(effort)}`, '--']);
  assert.equal(args.includes('--model'), false); assert.equal(h.promptFiles.size, 1); await h.manager.dispose();
});

for (const provider of ['codex', 'copilot', 'claude']) test(`${provider} rejects an unsupported agent before spawning and cleans its unlaunched handoff`, async () => {
  const h = harness();
  await assert.rejects(h.manager.openTask(providerRequest(h, provider, { agent: 'build' })), /agent selection is only supported for OpenCode/);
  assert.equal(h.spawns.length, 0); assert.equal(h.manager.sessions.length, 0); assert.equal(h.promptFiles.size, 0);
  assert.equal(h.writes.length, 1); assert.deepEqual(h.completed, h.auxiliary);
  assert.equal(h.manager.hasPendingCleanup, false); await h.manager.dispose();
});

for (const [provider, stage] of [['codex', 'load'], ['copilot', 'reveal'], ['claude', 'spawn']]) {
  test(`${provider} task abort during ${stage} preserves cancellation and confirmed cleanup semantics`, async () => {
    const h = harness(), controller = new AbortController(), gate = deferred(), reached = deferred();
    if (stage === 'load') h.setLoad(async () => { reached.resolve(); await gate.promise; return h.ptyBackend; });
    if (stage === 'reveal') h.setReveal(() => { reached.resolve(); return gate.promise; });
    if (stage === 'spawn') h.faults.onSpawn = () => controller.abort();
    const opening = h.manager.openTask(providerRequest(h, provider, { signal: controller.signal }));
    if (stage !== 'spawn') { await reached.promise; controller.abort(); gate.resolve(); }
    await assert.rejects(opening, /opening was cancelled/);
    assert.equal(h.manager.sessions.length, 0); assert.equal(h.manager.hasRunningSessions, false);
    assert.equal(h.spawns.length, stage === 'spawn' ? 1 : 0); assert.equal(h.promptFiles.size, 0);
    assert.equal(h.completed.length, stage === 'spawn' ? 1 : 0);
    if (stage === 'spawn') assert.equal(h.ptys[0].kills, 1);
    assert.equal(h.external.length, 0); await h.manager.dispose();
  });
}

for (const provider of ['codex', 'copilot', 'claude']) test(`${provider} task uncertain launch retains handoff evidence and only confirmed retry may clean it`, async () => {
  const h = harness();
  if (provider === 'codex') h.faults.spawn = true;
  else { h.faults.subscribe = true; h.faults.kill = true; }
  await assert.rejects(h.manager.openTask(providerRequest(h, provider)), error => {
    assert.ok(error instanceof taskTerminal.InteractiveTerminalLaunchUncertainError);
    assert.equal(error.code, 'AUTOOC_TERMINAL_UNCERTAIN'); assert.match(error.message, /unconfirmed/); return true;
  });
  assert.equal(h.promptFiles.size, 1); assert.equal(h.completed.length, 0); assert.equal(h.manager.sessions.length, 0);
  if (provider === 'codex') {
    assert.equal(h.ptys.length, 0); await h.manager.dispose();
    assert.equal(h.promptFiles.size, 1); assert.equal(h.completed.length, 0);
  } else {
    assert.equal(h.manager.hasPendingCleanup, true);
    await assert.rejects(h.manager.retryPendingCleanup(), /still tracks/); assert.equal(h.promptFiles.size, 1);
    h.faults.kill = false; await h.manager.retryPendingCleanup();
    assert.equal(h.promptFiles.size, 0); assert.deepEqual(h.completed, h.auxiliary);
    assert.equal(h.manager.hasPendingCleanup, false); await h.manager.dispose();
  }
});

// All native-loader I/O is injected: no download, disk mutation or native require.
function nativeHarness(options = {}) {
  const requests = [], mutations = [], requires = [], timers = [];
  const missing = () => Object.assign(Error('missing'), { code: 'ENOENT' });
  const directory = { isDirectory: () => true, isSymbolicLink: () => false };
  const root = 'C:\\Plugin\\terminal-support';
  const disk = {
    async realpath(value) { return value; },
    async lstat(value) {
      if (value === 'C:\\Plugin') return directory;
      if (value === root && options.supportExists !== false) return options.linkedRoot
        ? { ...directory, isSymbolicLink: () => true } : directory;
      if (value === path.win32.join(root, 'node-pty-1.1.0-win32-x64') && options.incomplete) return directory;
      throw missing();
    },
    async mkdir(...args) { mutations.push(['mkdir', ...args]); },
    async mkdtemp() { throw Error('Unverified archive reached staging'); },
    async readFile() { throw Error('Unexpected disk read'); },
  };
  const api = evaluate('terminal-pty.ts', {
    'node:crypto': require('node:crypto'), 'node:fs': { promises: disk }, 'node:path': path.win32,
    'node:os': { release: () => options.release || '10.0.22631' },
    'node:zlib': { gunzip() { throw Error('Unverified archive reached decompression'); } },
    'node:module': { createRequire(...args) { requires.push(args); throw Error('Unexpected native loading'); } },
    'node:https': { get(url, headers, callback) {
      const request = new EventEmitter(), response = new EventEmitter();
      request.destroy = error => { request.emit('error', error); request.emit('close'); };
      response.statusCode = options.status || 200; response.resume = () => { response.resumed = true; };
      requests.push({ url, headers, request, response });
      queueMicrotask(() => {
        callback(response);
        if (response.statusCode !== 200 || options.timeout) return;
        if (options.aborted) response.emit('aborted');
        else { response.emit('data', options.body || Buffer.from('not the pinned npm archive')); response.emit('end'); }
        request.emit('close');
      }); return request;
    } },
  }, { process: { platform: options.platform || 'win32', arch: options.arch || 'x64', versions: { napi: options.napi || '8', node: '22.0.0' } },
    setTimeout(callback, delay) { const timer = { callback, delay }; timers.push(timer); return timer; },
    clearTimeout(timer) { timer.cleared = true; },
  });
  return { ...api, requests, mutations, requires, timers };
}

test('PTY trust pin identifies the official MIT node-pty archive and exact SHA-512', () => {
  const h = nativeHarness();
  assert.equal(h.TERMINAL_SUPPORT.url, 'https://registry.npmjs.org/node-pty/-/node-pty-1.1.0.tgz');
  assert.equal(h.TERMINAL_SUPPORT.license, 'MIT'); assert.equal(h.TERMINAL_SUPPORT.version, '1.1.0');
  assert.equal(h.TERMINAL_SUPPORT.integrity, 'sha512-20JqtutY6JPXTUnL0ij1uad7Qe1baT46lyolh2sSENDd4sTzKZ4nmAFkeAARDKwmlLjPx6XKRlwRUxwjOy+lUg==');
  assert.equal(Object.isFrozen(h.TERMINAL_SUPPORT), true);
});

test('local PTY load with missing support is offline and does not install or load native code', async () => {
  for (const supportExists of [true, false]) {
    const h = nativeHarness({ supportExists });
    await assert.rejects(h.loadTerminalPty('C:\\Plugin'), /soporte (ausente|no instalado)/);
    assert.equal(h.requests.length, 0); assert.equal(h.mutations.length, 0); assert.equal(h.requires.length, 0);
  }
});

test('PTY install preserves an incomplete existing installation without repair or download', async () => {
  const h = nativeHarness({ incomplete: true });
  await assert.rejects(h.installTerminalSupport('C:\\Plugin'), /instalacion incompleta.*no se sobrescribira/);
  assert.equal(h.requests.length, 0); assert.equal(h.requires.length, 0);
  assert.ok(h.mutations.every(([operation, value]) => operation === 'mkdir' && value === 'C:\\Plugin\\terminal-support'));
});

test('PTY load rejects a symlinked support directory without native loading or download', async () => {
  const h = nativeHarness({ linkedRoot: true });
  await assert.rejects(h.loadTerminalPty('C:\\Plugin'), /directorio real sin enlaces/);
  assert.equal(h.requests.length, 0); assert.equal(h.mutations.length, 0); assert.equal(h.requires.length, 0);
});

test('PTY install requires an absolute plugin directory before writes or download', async () => {
  const h = nativeHarness();
  await assert.rejects(h.installTerminalSupport('relative'), /ruta absoluta/);
  assert.equal(h.requests.length, 0); assert.equal(h.mutations.length, 0);
});

for (const [options, expected] of [
  [{ platform: 'linux' }, /solo Windows x64/], [{ arch: 'arm64' }, /solo Windows x64/],
  [{ release: '10.0.17763' }, /18309/], [{ napi: '7' }, /Node-API >= 8/],
]) test(`PTY unsupported host ${JSON.stringify(options)} rejects before network or writes`, async () => {
  const h = nativeHarness(options);
  await assert.rejects(h.installTerminalSupport('C:\\Plugin'), expected);
  await assert.rejects(h.loadTerminalPty('C:\\Plugin'), expected);
  assert.equal(h.requests.length, 0); assert.equal(h.mutations.length, 0);
});

for (const [options, expected] of [
  [{}, /integridad SHA-512/], [{ status: 302 }, /HTTP 302.*redirecciones/],
  [{ status: 503 }, /HTTP 503/], [{ aborted: true }, /descarga interrumpida/],
]) test(`PTY install rejects untrusted download ${JSON.stringify(options)} before extraction or native execution`, async () => {
  const h = nativeHarness(options);
  await assert.rejects(h.installTerminalSupport('C:\\Plugin'), expected);
  assert.equal(h.requests.length, 1); assert.equal(h.requires.length, 0);
  assert.ok(h.mutations.every(([operation]) => operation === 'mkdir')); assert.equal(h.timers[0].cleared, true);
});

test('PTY downloader timeout destroys the request and clears its timer without extracting', async () => {
  const h = nativeHarness({ timeout: true }), pending = h.installTerminalSupport('C:\\Plugin');
  // Wait for injected HTTP setup, not for a wall-clock timeout.
  while (!h.requests.length) await Promise.resolve();
  assert.equal(h.timers[0].delay, 120000); h.timers[0].callback();
  await assert.rejects(pending, /timeout de descarga/); assert.equal(h.timers[0].cleared, true); assert.equal(h.requires.length, 0);
});
