const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { EventEmitter } = require('node:events');
const ts = require('typescript');

const compile = file => ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const backendSource = compile('interactive-cli.ts'), uiSource = compile('interactive-cli-ui.ts');
const quoteSource = fs.readFileSync(path.join(__dirname, '../cli-launchers.ts'), 'utf8').match(/export function psSingleQuoted[\s\S]*?\n}/)[0];
const quote = vm.runInNewContext(ts.transpileModule(quoteSource.replace('export ', ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText + '; psSingleQuoted');

test('Codex shared settings resolve npm shims to the matching native app-server binary on Windows', () => {
  const source = fs.readFileSync(path.join(__dirname, '../codex-client.ts'), 'utf8');
  const selected = ['resolveCodexNativeBin', 'resolveCodexBin'].map(name => source.match(new RegExp(`(?:export )?function ${name}[\\s\\S]*?\\n}`))[0].replace('export ', '')).join('\n');
  const compiled = ts.transpileModule(selected, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const files = new Set(); let platform = 'win32', arch = 'x64';
  const context = { path: path.win32, os: { platform: () => platform }, process: { env: {}, get arch() { return arch; } },
    fs: { existsSync: file => files.has(file), readdirSync: () => [], statSync(file) { return { isFile: () => files.has(file) }; } } };
  const resolve = vm.runInNewContext(compiled + '; resolveCodexBin', context);
  const shim = 'C:\\npm\\codex.cmd', base = 'C:\\npm\\node_modules\\@openai';
  for (const relative of [
    'codex\\node_modules\\@openai\\codex-win32-x64\\vendor\\x86_64-pc-windows-msvc\\bin\\codex.exe',
    'codex-win32-x64\\vendor\\x86_64-pc-windows-msvc\\bin\\codex.exe',
    'codex\\vendor\\x86_64-pc-windows-msvc\\codex\\codex.exe',
  ]) {
    const native = path.win32.join(base, relative); files.clear(); files.add(native); files.add(shim); files.add('C:\\npm\\codex.ps1');
    assert.equal(resolve(shim), native); assert.equal(resolve('C:\\npm\\codex.ps1'), native);
    assert.equal(resolve('C:\\npm\\custom-wrapper.cmd'), 'C:\\npm\\custom-wrapper.cmd');
    assert.equal(resolve('C:\\explicit\\codex.exe'), 'C:\\explicit\\codex.exe');
    assert.equal(resolve('C:\\npm\\codex.bat'), 'C:\\npm\\codex.bat');
  }
  files.clear(); assert.equal(resolve(shim), shim);
  arch = 'arm64';
  const arm = path.win32.join(base, 'codex-win32-arm64\\vendor\\aarch64-pc-windows-msvc\\bin\\codex.exe');
  files.add(arm); files.add(shim); assert.equal(resolve(shim), arm);
  platform = 'linux'; assert.equal(resolve(shim), shim);
});

function backend(platform = 'win32', files = []) {
  const calls = [], children = [], timers = [], probes = [];
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const home = platform === 'win32' ? 'C:\\Users\\Tester' : '/home/tester';
  const folder = platform === 'win32' ? 'C:\\Vault' : '/vault';
  const directories = new Set([folder]), existing = new Set(files), denied = new Set();
  const env = { PATH: platform === 'win32' ? 'C:\\Tools' : '/tools', APPDATA: 'C:\\Users\\Tester\\AppData\\Roaming' };
  const module = { exports: {} };
  let fallback = '', posixError;
  vm.runInNewContext(backendSource, { module, exports: module.exports, Buffer,
    process: { platform, env },
    setTimeout(callback) { const timer = { callback, unref() {} }; timers.push(timer); return timer; },
    clearTimeout(timer) { timer.cleared = true; },
    require(id) {
      if (id === 'path') return paths;
      if (id === 'os') return { homedir: () => home };
      if (id === 'fs') return { constants: { X_OK: 1 },
        statSync(file) { probes.push(file); if (!existing.has(file) && !directories.has(file)) throw Error('missing'); return { isFile: () => existing.has(file), isDirectory: () => directories.has(file) }; },
        accessSync(file) { if (denied.has(file)) throw Error('not executable'); },
      };
      if (id === './codex-client') return { resolveCodexBin: () => fallback };
      if (id === './opencode-version') return { assertOpenCode2: async () => {} };
      if (id === './cli-launchers') return { psSingleQuoted: quote, openOpencodeCli(...args) {
        calls.push(args); if (posixError) args[4].onError(posixError); else args[4].onLaunched();
      } };
      if (id === 'child_process') return { spawn(...args) {
        calls.push(args); const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.unref = () => {};
        child.kill = () => { child.killed = true; }; children.push(child); return child;
      } };
      throw Error(`Unexpected dependency: ${id}`);
    },
  });
  const settings = { opencodePath: 'opencode', codexPath: 'codex', copilotPath: 'copilot', workingDirectory: '' };
  return { ...module.exports, settings, calls, children, timers, probes, env, existing, denied, directories, folder,
    fallback(value) { fallback = value; }, posixError(value) { posixError = value; } };
}

test('CLIs including separate OpenCode versions resolve from PATH and respect menu preferences', () => {
  const h = backend('win32', ['opencode', 'codex', 'copilot', 'claude'].map(name => `C:\\Tools\\${name}.exe`));
  assert.deepEqual(Array.from(h.configuredInteractiveClis(h.settings), cli => [cli.id, !!cli.executable]), [
    ['opencode', true], ['opencode2', true], ['codex', true], ['copilot', true], ['claude', true],
  ]);
  h.settings.cliLauncherEnabled = { codex: false };
  assert.deepEqual(Array.from(h.configuredInteractiveClis(h.settings), cli => cli.id), ['opencode', 'opencode2', 'copilot', 'claude']);
  assert.equal(h.calls.length, 0);
});

test('explicit paths remain authoritative and cannot contain arguments or fall back silently', () => {
  const h = backend('win32', ['C:\\Tools\\codex.exe', 'C:\\Custom Folder\\codex.cmd']);
  assert.equal(h.resolveInteractiveCli('codex', 'C:\\Custom Folder\\codex.cmd'), 'C:\\Custom Folder\\codex.cmd');
  for (const invalid of ['C:\\missing\\codex.exe', 'codex --full-auto', '.\\codex.exe', 'codex; echo unsafe']) {
    assert.equal(h.resolveInteractiveCli('codex', invalid), undefined);
  }
  assert.equal(h.calls.length, 0);
});

test('discovery ignores relative PATH entries, directories and non-executable files', () => {
  const h = backend('linux', ['/valid/claude', '/denied/claude']);
  h.env.PATH = '.::relative:/directory:/denied:/valid'; h.denied.add('/denied/claude'); h.directories.add('/directory/claude');
  assert.equal(h.resolveInteractiveCli('claude'), '/valid/claude');
  assert.ok(h.probes.every(file => path.posix.isAbsolute(file)));
  h.existing.add('/home/tester/.local/bin/claude'); h.env.PATH = '/missing';
  assert.equal(h.resolveInteractiveCli('claude'), '/home/tester/.local/bin/claude');
});

test('active PATH wins over fallback installations; Codex desktop binary is only a final CLI fallback', () => {
  const h = backend('win32', ['C:\\Tools\\codex.cmd', 'C:\\Desktop\\codex.exe']);
  h.fallback('C:\\Desktop\\codex.exe');
  assert.equal(h.resolveInteractiveCli('codex'), 'C:\\Tools\\codex.cmd');
  h.existing.delete('C:\\Tools\\codex.cmd');
  assert.equal(h.resolveInteractiveCli('codex'), 'C:\\Desktop\\codex.exe');
  assert.equal(h.resolveInteractiveCli('codex', 'C:\\missing\\codex.exe'), undefined);
});

test('Windows launches bare interactive CLIs in a visible console through a hidden helper', async () => {
  for (const provider of ['opencode', 'codex', 'copilot', 'claude']) {
    const h = backend('win32', [`C:\\Tools\\${provider}.exe`]);
    const before = JSON.stringify(h.settings);
    const pending = h.launchInteractiveCli(provider, h.folder, h.settings);
    const [executable, args, options] = h.calls[0];
    assert.equal(executable, 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
    assert.equal(options.windowsHide, true); assert.equal(options.detached, false); assert.deepEqual(Array.from(options.stdio), ['ignore','pipe','pipe']);
    const helper = Buffer.from(args.at(-1), 'base64').toString('utf16le');
    assert.match(helper, /Start-Process.*-WindowStyle Normal/);
    const encoded = helper.match(/'-EncodedCommand', '([A-Za-z0-9+/=]+)'/)[1];
    const runner = Buffer.from(encoded, 'base64').toString('utf16le');
    assert.ok(runner.endsWith(`& 'C:\\Tools\\${provider}.exe'`));
    assert.match(runner, /Set-Location -LiteralPath 'C:\\Vault'/);
    assert.doesNotMatch(runner, /app-server|codex:\/\/|--prompt|--full-auto|dangerously|--allow-all/);
    h.children[0].stdout.emit('data', Buffer.from('AUTOOC_TERMINAL_PID=1234\r\n')); h.children[0].emit('close', 0); await pending;
    assert.equal(h.timers[0].cleared, true); assert.equal(JSON.stringify(h.settings), before);
  }
});

test('Windows folder and executable quoting preserves apostrophes, Unicode and shell metacharacters', () => {
  const h = backend(), cwd = "C:\\O'Brien\\á & $(evil); %TEMP%", bin = "C:\\Tools & Other\\O'Brien\\codex.cmd";
  const { runner, helper } = h.windowsInteractiveCliScripts(bin, cwd, 'Codex CLI');
  assert.ok(runner.includes(`Set-Location -LiteralPath ${quote(cwd)}`));
  assert.ok(runner.endsWith(`& ${quote(bin)}`));
  assert.ok(helper.includes(`-WorkingDirectory ${quote(cwd)}`));
  assert.doesNotMatch(helper, /cmd\.exe| -Command /);
});

test('real PowerShell parses the launcher paths as literals and forwards a separate encoded interactive command', { skip: process.platform !== 'win32' }, () => {
  const h = backend(), cwd = "C:\\O'Brien\\á & $(Write-Output unsafe); %TEMP%", bin = "C:\\Tools & Other\\O'Brien\\codex.cmd";
  const { helper } = h.windowsInteractiveCliScripts(bin, cwd, 'Codex CLI');
  // Replace Start-Process before evaluating the helper: no terminal or provider
  // is started. Parse, but never execute, the captured interactive command.
  const script = `[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
function Start-Process {
  param($FilePath, [string[]]$ArgumentList, $WorkingDirectory, $WindowStyle, [switch]$PassThru)
  $script:captured = @{ folder = $WorkingDirectory; style = $WindowStyle; args = $ArgumentList }; [pscustomobject]@{Id=1234}
}
${helper}
$runner = [Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($captured.args[-1]))
$tokens = $null; $parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseInput($runner, [ref]$tokens, [ref]$parseErrors)
$commands = $ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.CommandAst] }, $true)
$captured['errors'] = @($parseErrors).Count
$captured['commands'] = @($commands | ForEach-Object { @{ elements = @($_.CommandElements | ForEach-Object { $_.Value }) } })
$captured | ConvertTo-Json -Depth 8 -Compress`;
  const result = require('node:child_process').spawnSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(result.status, 0, result.stderr || String(result.error));
  const parsed = JSON.parse(result.stdout.replace(/^\uFEFF/, '').replace(/^AUTOOC_TERMINAL_PID=\d+\r?\n/m, ''));
  assert.equal(parsed.folder, cwd); assert.equal(parsed.style, 'Normal'); assert.equal(parsed.errors, 0);
  assert.deepEqual(parsed.args.slice(0, 3), ['-NoLogo', '-NoExit', '-EncodedCommand']);
  assert.equal(parsed.commands.length, 2);
  assert.equal(parsed.commands[0].elements.at(-1), cwd); assert.deepEqual(parsed.commands[1].elements, [bin]);
});

test('disabled or missing providers and invalid folders never create a process', async () => {
  const h = backend('win32', ['C:\\Tools\\codex.exe']);
  h.settings.cliLauncherEnabled = { codex: false };
  await assert.rejects(h.launchInteractiveCli('codex', h.folder, h.settings), /disabled/);
  h.settings.cliLauncherEnabled.codex = true;
  await assert.rejects(h.launchInteractiveCli('claude', h.folder, h.settings), /not found/);
  await assert.rejects(h.launchInteractiveCli('codex', '.', h.settings), /absolute/);
  await assert.rejects(h.launchInteractiveCli('codex', 'C:\\missing', h.settings), /does not exist/);
  assert.equal(h.calls.length, 0);
});

test('launcher failure and uncertain timeout are surfaced without retrying or killing a CLI session', async () => {
  for (const outcome of ['error', 'exit', 'timeout']) {
    const h = backend('win32', ['C:\\Tools\\codex.exe']);
    const pending = h.launchInteractiveCli('codex', h.folder, h.settings);
    if (outcome === 'error') h.children[0].emit('error', Error('spawn failed'));
    else if (outcome === 'exit') h.children[0].emit('close', 1);
    else h.timers[0].callback();
    await assert.rejects(pending, outcome === 'timeout' ? /Check for an open window/ : /failed|Could not open/);
    assert.equal(h.calls.length, 1);
    assert.equal(h.children[0].killed === true, outcome === 'timeout');
    h.children[0].emit('close', 0);
  }
});

test('Windows requires a terminal creation receipt even when the helper exits successfully', async () => {
  const h = backend('win32', ['C:\\Tools\\codex.exe']);
  const pending = h.launchInteractiveCli('codex', h.folder, h.settings);
  h.children[0].emit('close', 0);
  await assert.rejects(pending, /could not be confirmed.*Codex CLI/);
  assert.equal(h.calls.length, 1);
  assert.notEqual(h.children[0].killed, true);
});

test('Windows waits for drained receipt output and surfaces launcher diagnostics', async () => {
  const h = backend('win32', ['C:\\Tools\\opencode.exe']);
  const pending = h.launchInteractiveCli('opencode', h.folder, h.settings);
  h.children[0].emit('exit', 0); // stdout may still be buffered at process exit.
  h.children[0].stdout.emit('data', Buffer.from('AUTOOC_TERMINAL_'));
  h.children[0].stdout.emit('data', Buffer.from('PID=42\r\n'));
  h.children[0].emit('close', 0); await pending;
  const failed = h.launchInteractiveCli('opencode', h.folder, h.settings);
  h.children[1].stderr.emit('data', Buffer.from('Terminal could not be created'));
  h.children[1].emit('close', 1);
  await assert.rejects(failed, /Terminal could not be created/);
});

test('real Windows helper evaluates its command and confirms creation with production spawn options', {skip:process.platform !== 'win32'}, async () => {
  const realFs = require('node:fs'), os = require('node:os'), cp = require('node:child_process');
  const directory = realFs.mkdtempSync(path.join(os.tmpdir(), 'autooc-cli-helper-'));
  try {
    const bin = path.join(directory, 'codex.exe'); realFs.writeFileSync(bin, 'synthetic, never executed');
    const module = {exports:{}}, calls = [];
    vm.runInNewContext(backendSource, {module,exports:module.exports,process,Buffer,setTimeout,clearTimeout,
      require(id) {
        if (id === './codex-client') return {resolveCodexBin: () => bin};
        if (id === './opencode-version') return {assertOpenCode2: async () => {}};
        if (id === './cli-launchers') return {psSingleQuoted:quote};
        if (id !== 'child_process') return require(id);
        return {spawn(executable,args,options) {
          calls.push(options);
          // Only replace Start-Process: run the real helper/transport without
          // opening a terminal, authenticating a provider or launching work.
          const helper = Buffer.from(args.at(-1),'base64').toString('utf16le');
          const substitute = `function Start-Process { param($FilePath,$ArgumentList,$WorkingDirectory,$WindowStyle,[switch]$PassThru); [pscustomobject]@{Id=4242} }\n`;
          return cp.spawn(executable,[...args.slice(0,-1),Buffer.from(substitute+helper,'utf16le').toString('base64')],options);
        }};
      }});
    await module.exports.launchInteractiveCli('codex',directory,{codexPath:bin,workingDirectory:''});
    assert.equal(calls.length,1); assert.equal(calls[0].detached,false); assert.equal(calls[0].windowsHide,true);
  } finally {
    assert.equal(path.dirname(realFs.realpathSync(directory)),realFs.realpathSync(os.tmpdir()));
    assert.match(path.basename(directory),/^autooc-cli-helper-/);
    realFs.rmSync(directory,{recursive:true,force:true});
  }
});

test('macOS and Linux use the shared terminal launcher with no prompt or execution arguments', async () => {
  for (const platform of ['darwin', 'linux']) {
    const h = backend(platform, ['/tools/claude']); h.settings.linuxTerminal = 'konsole';
    await h.launchInteractiveCli('claude', h.folder, h.settings);
    assert.equal(h.calls[0][0], '/tools/claude'); assert.equal(h.calls[0][1], '/vault');
    assert.equal(h.calls[0][3].length, 0); assert.equal(h.calls[0][4].linuxTerminal, 'konsole');
    h.posixError(Error('no terminal'));
    await assert.rejects(h.launchInteractiveCli('claude', h.folder, h.settings), /no terminal/);
  }
});

function ui(files = ['C:\\Tools\\codex.exe']) {
  const h = backend('win32', files), launches = [], notices = [], opened = [], saved = [];
  let picker = async () => ({ canceled: true }), launch = async (...args) => { launches.push(args); };
  let detectVersion = async () => ({version:'2.0.21',major:2});
  class Element {
    constructor(text = '') { this.textContent = text; this.children = []; this.attrs = {}; }
    createEl(tag, opts = {}) { const child = new Element(opts.text); child.tag = tag; this.children.push(child); return child; }
    createDiv() { return this.createEl('div'); } empty() { this.children = []; } addClass() {}
    setText(value) { this.textContent = value; } setAttr(key, value) { this.attrs[key] = value; }
    all() { return [this, ...this.children.flatMap(child => child.all())]; }
  }
  class Control {
    constructor(el) { this.el = this.inputEl = el; el.options = {}; }
    setValue(value) { this.el.value = value; return this; } setPlaceholder() { return this; }
    setButtonText(value) { this.el.textContent = value; return this; }
    setDisabled(value) { this.el.disabled = value; return this; }
    addOption(key, value) { this.el.options[key] = value; return this; }
    onChange(fn) { this.el.change = fn; return this; } onClick(fn) { this.el.onclick = fn; return this; }
  }
  class Setting {
    constructor(parent) { this.el = parent.createDiv(); } setName(name) { this.el.name = name; return this; }
    setDesc(text) { this.el.description = text; return this; }
    addText(fn) { fn(new Control(this.el.createEl('input'))); return this; }
    addToggle(fn) { fn(new Control(this.el.createEl('toggle'))); return this; }
    addButton(fn) { fn(new Control(this.el.createEl('button'))); return this; }
    addDropdown(fn) { fn(new Control(this.el.createEl('select'))); return this; }
  }
  class Modal {
    constructor(app) { this.app = app; this.contentEl = new Element(); }
    open() { opened.push(this); this.onOpen(); } close() { this.didClose = true; this.onClose(); }
  }
  const module = { exports: {} };
  vm.runInNewContext(uiSource, { module, exports: module.exports, console,
    window: { require: () => ({ remote: { dialog: { showOpenDialog: (...args) => picker(...args) } } }) },
    require: id => id === 'obsidian' ? { Modal, Setting, Notice: class { constructor(text) { notices.push(text); } } }
      : { ...h, detectOpenCodeVersion: (...args) => detectVersion(...args), launchInteractiveCli: (...args) => launch(...args) },
  });
  const settingsOpened = [], app = { vault: { adapter: { basePath: h.folder } }, setting: { open() { settingsOpened.push('open'); }, openTabById(id) { settingsOpened.push(id); } } };
  const host = { settings: h.settings, manifest: { id: 'auto-oc' }, isLifecycleStopped: () => false,
    saveSettings: async () => { saved.push(JSON.stringify(host.settings)); } };
  const modal = selected => { const m = new module.exports.CliLauncherModal(app, host, () => {}, selected); m.open(); return m; };
  const button = (m, label) => m.contentEl.all().find(el => el.tag === 'button' && el.textContent.includes(label));
  return { ...h, ...module.exports, Element, app, host, saved, opened, launches, notices, modal, button, settingsOpened,
    picker(fn) { picker = fn; }, launch(fn) { launch = fn; }, detect(fn) { detectVersion = fn; } };
}

test('picker opens the selected direct CLI in the configured folder without saving or running tasks', async () => {
  const h = ui(['C:\\Tools\\codex.exe', 'C:\\Tools\\claude.exe']); h.host.settings.workingDirectory = 'C:\\Another Project';
  const m = h.modal(), select = m.contentEl.all().find(el => el.tag === 'select');
  assert.deepEqual(Object.keys(select.options), ['codex', 'claude']);
  select.change('claude'); await h.button(m, 'Open in project').onclick();
  assert.equal(h.launches[0][0], 'claude'); assert.equal(h.launches[0][1], 'C:\\Another Project');
  assert.equal(m.didClose, true); assert.equal(h.saved.length, 0);
});

test('missing Codex shortcut requires choosing another CLI explicitly, rather than silently substituting one', () => {
  const h = ui(['C:\\Tools\\opencode.exe']), m = h.modal('codex');
  assert.equal(h.button(m, 'Open in project').disabled, true);
  assert.ok(m.contentEl.all().some(el => el.textContent.includes('Codex CLI is unavailable')));
  m.contentEl.all().find(el => el.tag === 'select').change('opencode');
  assert.equal(h.button(m, 'Open in project').disabled, false);
});

test('empty picker offers Settings; Configure CLIs opens the AutoOC settings tab', async () => {
  const h = ui([]), m = h.modal();
  assert.equal(h.button(m, 'Open in project').disabled, true); assert.equal(h.button(m, 'Choose folder').disabled, true);
  assert.ok(m.contentEl.all().some(el => el.textContent.includes('No configured CLI')));
  h.openCliLauncher(h.app, h.host);
  h.button(h.opened.at(-1), 'Configure CLIs').onclick();
  assert.deepEqual(h.settingsOpened, ['open', 'auto-oc']); assert.equal(h.launches.length, 0);
});

test('folder picker cancellation and a modal closed while selecting a folder never launch', async () => {
  const h = ui(), m = h.modal(); await h.button(m, 'Choose folder').onclick(); assert.equal(h.launches.length, 0);
  let answer; h.picker(() => new Promise(resolve => { answer = resolve; }));
  const choosing = h.button(m, 'Choose folder').onclick(); m.close();
  answer({ canceled: false, filePaths: ['C:\\Selected'] }); await choosing;
  assert.equal(h.launches.length, 0);
});

test('folder selection launches once, failures remain visible, and a stopped plugin cannot launch', async () => {
  const h = ui(); h.picker(async () => ({ canceled: false, filePaths: ['C:\\Selected'] }));
  const first = h.modal(); await h.button(first, 'Choose folder').onclick(); assert.equal(h.launches[0][1], 'C:\\Selected');
  h.launch(async () => { throw Error('Executable was removed. Check Settings.'); });
  const m = h.modal(); await h.button(m, 'Open in project').onclick();
  assert.ok(m.contentEl.all().find(el => el.attrs.role === 'alert').textContent.includes('Check Settings'));
  assert.ok(!m.didClose); assert.equal(h.button(m, 'Open in project').disabled, false);
  h.host.isLifecycleStopped = () => true; await h.button(m, 'Open in project').onclick();
  assert.match(m.contentEl.all().find(el => el.attrs.role === 'alert').textContent, /AutoOC has closed/);
});

test('repeated clicks while launching cannot open duplicate terminals', async () => {
  const h = ui(); let finish, launches = 0;
  h.launch(() => { launches++; return new Promise(resolve => { finish = resolve; }); });
  const m = h.modal(), button = h.button(m, 'Open in project');
  const opening = button.onclick(); await button.onclick(); assert.equal(launches, 1); assert.equal(button.disabled, true);
  finish(); await opening;
});

test('Settings reuse engine paths, save Claude configuration and roll back failed preferences', async () => {
  const h = ui(['C:\\Tools\\claude.exe']); h.host.settings.tasks = [{ id: 'preserve' }]; h.host.settings.workflows = [{ id: 'keep' }];
  const root = new h.Element(); h.addInteractiveCliSettings(root, h.host);
  const row = name => root.all().find(el => el.name === name);
  await row('Claude Code CLI executable').children.find(el => el.tag === 'input').change('C:\\Custom\\claude.exe');
  assert.equal(h.host.settings.claudePath, 'C:\\Custom\\claude.exe');
  await row('Claude Code CLI executable').children.find(el => el.tag === 'button').onclick();
  assert.equal(h.host.settings.claudePath, 'C:\\Tools\\claude.exe');
  await row('Show Codex CLI').children[0].change(false); assert.equal(h.host.settings.cliLauncherEnabled.codex, false);
  await row('Codex CLI executable').children.find(el => el.tag === 'input').change('C:\\Codex\\codex.exe');
  assert.equal(h.host.settings.codexPath, 'C:\\Codex\\codex.exe');
  h.host.saveSettings = async () => { throw Error('write failure'); };
  await row('Show Codex CLI').children[0].change(true); assert.equal(h.host.settings.cliLauncherEnabled.codex, false);
  await row('Codex CLI executable').children.find(el => el.tag === 'input').change('C:\\Broken\\codex.exe');
  assert.equal(h.host.settings.codexPath, 'C:\\Codex\\codex.exe'); assert.equal(h.notices.length, 2);
  assert.deepEqual(h.host.settings.tasks, [{ id: 'preserve' }]); assert.deepEqual(h.host.settings.workflows, [{ id: 'keep' }]);
  assert.equal(h.launches.length, 0);
});

test('toolbar uses one CLI picker and the legacy Codex command routes to Codex CLI', () => {
  const main = fs.readFileSync(path.join(__dirname, '../main.ts'), 'utf8');
  assert.match(main, /text: "💻 CLI"/); assert.doesNotMatch(main, /text: "✦ ChatGPT \/ Codex"|new CodexAppModal|new OpenCodeCliModal/);
  assert.match(main, /id: "open-chatgpt-codex",\s*name: "Open Codex CLI",\s*callback: \(\) => openCliLauncher\(this.app, this, "codex"\)/);
});

test('OpenCode version checks explain mismatches without changing tasks or executable settings',async()=>{
  const h=ui(['C:\\Tools\\opencode.exe']),root=new h.Element();
  h.host.settings.tasks=[{id:'old',taskKind:'opencode'}];h.host.settings.opencode2Path='C:\\Tools\\opencode.exe';
  const before=JSON.stringify(h.host.settings);h.addInteractiveCliSettings(root,h.host);
  const old=root.all().find(el=>el.name==='OpenCode 1 CLI executable'),modern=root.all().find(el=>el.name==='OpenCode 2 CLI executable');
  const button=row=>row.children.find(el=>el.textContent==='Check version');
  await button(old).onclick();assert.match(old.description,/Choose the matching OpenCode CLI/);
  await button(modern).onclick();assert.match(modern.description,/compatible with OpenCode 2/);
  h.detect(async()=>{throw Error('Could not check the OpenCode version');});
  await button(modern).onclick();assert.match(modern.description,/Could not check/);assert.equal(button(modern).disabled,false);
  assert.equal(JSON.stringify(h.host.settings),before);assert.equal(h.saved.length,0);assert.equal(h.launches.length,0);
});
