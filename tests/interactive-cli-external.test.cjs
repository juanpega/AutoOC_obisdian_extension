const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const compiled = new Map();
const providers = ['opencode', 'opencode2', 'codex', 'copilot', 'claude'];
const payload = 'BEGIN \u00f1 \u5de5\u5177 \ud83d\ude80 e\u0301 "\' & $ % `\r\n## Response\r\n'
  + 'opaque \u03bb\r\n'.repeat(7000) + '\r\n## OpenCode trace\r\nEND  ';

// Cache modules before evaluation: interactive-cli and cli-launchers share real
// dependencies, including the error constructor used by instanceof assertions.
function sourceLoader(overrides, globals) {
  const cache = new Map();
  const context = vm.createContext({ Buffer, console, ...globals });
  function load(file) {
    file = path.resolve(root, file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    if (!compiled.has(file)) compiled.set(file, ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
      fileName: file,
    }).outputText);
    const localRequire = name => {
      const builtin = name.replace(/^node:/, '');
      if (Object.hasOwn(overrides, builtin)) return overrides[builtin];
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name + '.ts'));
      return require(name);
    };
    vm.runInContext(`(function(require,module,exports){\n${compiled.get(file)}\n})`, context, { filename: file })(localRequire, module, module.exports);
    return module.exports;
  }
  return load;
}

function harness(t, platform = 'win32') {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'autooc-external-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const calls = [], probes = [], versions = [], timers = [], intervals = [], writes = [];
  const control = { terminal: true, spawnFailure: false, writeHook: undefined };
  const fakeFs = { ...fs, writeFileSync(file, data, options) {
    writes.push({ file, data, options });
    control.writeHook?.(file, data, options);
    return fs.writeFileSync(file, data, options);
  } };
  function timer(list, fn, ms) {
    const value = { fn, ms, active: true, referenced: true, unref() { this.referenced = false; } };
    list.push(value);
    return value;
  }
  const childProcess = {
    spawn(bin, args, options) {
      const child = new EventEmitter();
      child.unref = () => {};
      calls.push({ bin, args: Array.from(args), options, child });
      if (control.spawnFailure) throw Error('synthetic spawn failure');
      return child;
    },
    execSync(command, options) {
      probes.push({ command, options, writes: writes.length });
      if (!control.terminal) throw Error('synthetic terminal unavailable');
      return Buffer.alloc(0);
    },
    execFile(bin, args, options, callback) {
      versions.push({ bin, args: Array.from(args), options, callback });
    },
  };
  const environment = { ...process.env };
  const load = sourceLoader({ fs: fakeFs, child_process: childProcess, os: { ...os, platform: () => platform } }, {
    process: { platform, pid: process.pid, env: environment },
    setTimeout: (fn, ms) => timer(timers, fn, ms),
    setInterval: (fn, ms) => timer(intervals, fn, ms),
    clearTimeout: value => { value.active = false; },
    clearInterval: value => { value.active = false; },
  });
  const { launchExternalCliTask: launch } = load('interactive-cli-task.ts');
  const { InteractiveTerminalLaunchUncertainError: Uncertain } = load('interactive-task-terminal.ts');
  const auxiliary = path.join(cwd, '.autooc', 'auxiliary');
  function directories() {
    return fs.existsSync(auxiliary) ? fs.readdirSync(auxiliary).filter(name => /^interactive-/.test(name)).map(name => path.join(auxiliary, name)) : [];
  }
  function scripts(index = 0) {
    const observer = Buffer.from(calls[index].args.at(-1), 'base64').toString('utf16le');
    const bootstrap = Buffer.from(observer.match(/'-EncodedCommand', '([A-Za-z0-9+/=]+)'/)[1], 'base64').toString('utf16le');
    const file = /^& '((?:[^']|'')+)'$/.exec(bootstrap);
    const compressed = bootstrap.match(/FromBase64String\('([A-Za-z0-9+/=]+)'\)/);
    const runner = file ? fs.readFileSync(file[1].replace(/''/g, "'"), 'utf8')
      : compressed ? require('node:zlib').gunzipSync(Buffer.from(compressed[1], 'base64')).toString('utf16le') : bootstrap;
    const attempt = observer.match(/attempt = '([a-f0-9]+)'/)[1];
    const stateFile = observer.match(/Set-Content -LiteralPath '((?:[^']|'')*state\.json)'/)[1].replace(/''/g, "'");
    return { observer, runner, bootstrap, attempt, stateFile, directory: path.dirname(stateFile) };
  }
  function state(value, index = 0) {
    const script = scripts(index);
    fs.writeFileSync(script.stateFile, '\ufeff' + JSON.stringify({ attempt: script.attempt, ...value }), 'utf8');
    const poll = intervals[index];
    assert.equal(poll.active, true);
    poll.fn();
  }
  function request(provider = 'codex', extra = {}) {
    return { provider, bin: path.join(cwd, "O'Brien \u5de5\u5177", provider + '.exe'), cwd,
      label: 'synthetic task', major: provider === 'opencode2' ? 2 : 1,
      model: '', agent: '', prompt: payload, ...extra };
  }
  function start(requestValue, terminal) {
    const result = { status: 'pending' };
    result.promise = launch(requestValue, terminal).then(() => { result.status = 'launched'; }, error => {
      result.status = 'rejected'; result.error = error;
    });
    return result;
  }
  return { cwd, auxiliary, control, calls, probes, versions, timers, intervals, writes, load, launch, environment,
    Uncertain, directories, scripts, state, request, start };
}

async function flush() { await new Promise(resolve => setImmediate(resolve)); }

// Resolution only: deny every process boundary, and model Windows paths even
// on non-Windows CI. An alias is a reparse point, not a stat-able regular file.
function terminalResolver({ env = {}, stat = 'EACCES', link = true, entries = ['wt.exe'], lstatError, listingError } = {}) {
  const alias = 'C:\\Users\\synthetic\\AppData\\Local\\Microsoft\\WindowsApps\\wt.exe';
  const fail = code => { throw Object.assign(new Error(code), { code }); };
  const load = sourceLoader({
    path: path.win32,
    fs: {
      statSync: () => stat === 'file' ? { isFile: () => true } : stat === 'directory' ? { isFile: () => false } : fail(stat),
      lstatSync: () => lstatError ? fail(lstatError) : { isSymbolicLink: () => link },
      readdirSync: () => listingError ? fail(listingError) : entries,
    },
    child_process: new Proxy({}, { get() { throw Error('Resolution must not launch or probe a process'); } }),
  }, { process: { platform: 'win32', env: { PATH: '', LOCALAPPDATA: 'C:\\Users\\synthetic\\AppData\\Local', ...env } } });
  return { resolve: load('shared-windows-terminal.ts').resolveSharedWindowsTerminal, alias };
}

test('shared resolver accepts a listed user WindowsApps execution alias when stat is denied, without probing wt', () => {
  for (const stat of ['EACCES', 'EPERM']) {
    const h = terminalResolver({ stat });
    assert.equal(h.resolve(), h.alias);
  }
});

test('shared resolver preserves absolute regular executable discovery', () => {
  const h = terminalResolver({ stat: 'file', env: { PATH: '"D:\\Terminal";relative', LOCALAPPDATA: '' } });
  assert.equal(h.resolve(), 'D:\\Terminal\\wt.exe');
});

test('shared resolver rejects missing, unproven, non-alias and invalid paths without treating permission errors as success', () => {
  const cases = [
    { stat: 'ENOENT' }, { stat: 'EIO' }, { stat: 'directory' },
    { link: false }, { entries: [] }, { lstatError: 'EACCES' }, { listingError: 'EACCES' },
    { env: { LOCALAPPDATA: '', PATH: 'D:\\Untrusted' } },
    { env: { LOCALAPPDATA: 'relative', PATH: 'relative;.;wt.exe' } },
    { env: { LOCALAPPDATA: '', PATH: 'relative;.;wt.exe' } },
  ];
  for (const scenario of cases)
    assert.throws(() => terminalResolver(scenario).resolve(), /wt\.exe.*not found/);
});

async function versionChecked(h, provider) {
  if (provider === 'opencode2') {
    assert.equal(h.versions.length, 1);
    assert.deepEqual(h.versions[0].args, ['--version']);
    assert.equal(h.calls.length, 0);
    assert.equal(h.writes.length, 0);
    h.versions[0].callback(null, '2.1.0\n');
    await flush();
  } else assert.equal(h.versions.length, 0);
}

// Expectations are literal contracts, not calls to the profile under test.
function expectedArgs(provider, model, agent, instruction, effort) {
  switch (provider) {
    case 'opencode': return [...(model ? ['-m', model] : []), ...(agent ? ['--agent', agent] : []), '--prompt', instruction];
    case 'opencode2': return ['mini', '--standalone', ...(model ? ['-m', model] : []), ...(agent ? ['--agent', agent] : []), '--prompt', instruction];
    case 'codex': return [...(model ? ['--model', model] : []), ...(effort ? ['--config', `model_reasoning_effort=${JSON.stringify(effort)}`] : []), '--', instruction];
    case 'copilot': return [...(model ? ['--model', model] : []), '--interactive', instruction];
    case 'claude': return [...(model ? ['--model', model] : []), '--', instruction];
    default: throw Error('unexpected test provider');
  }
}

function runnerArgs(runner) {
  const text = runner.match(/^  \$cliArgs = @\((.*)\)$/m)[1];
  const literals = text.match(/'(?:[^']|'')*'/g) || [];
  assert.equal(literals.join(', '), text, 'argv must contain only PowerShell single-quoted literals');
  return literals.map(value => value.slice(1, -1).replace(/''/g, "'"));
}

function noAutoApproval(args) {
  assert.ok(args.every(arg => !/^(?:--auto|--full-auto|--yolo|--allow-all(?:-tools)?|--dangerously.*|--skip-permissions|--permission-mode|--approval-policy|--sandbox)$/.test(arg)));
}

for (const provider of providers) for (const configured of [false, true]) {
  test(`Windows ${provider}: literal profile argv, ${configured ? 'explicit model' : 'native defaults'}, Unicode file handoff and observer acknowledgement`, async t => {
    const h = harness(t);
    const model = configured ? 'model\' " & $() ` \u5de5\u5177' : '';
    const agent = configured && provider.startsWith('opencode') ? 'plan\' & $()' : '';
    const effort = configured && provider === 'codex' ? 'high"\nother=true' : undefined;
    const pending = h.start(h.request(provider, { model, agent, reasoningEffort: effort }));
    await versionChecked(h, provider);
    assert.equal(h.calls.length, 1);
    const { runner, observer, directory } = h.scripts();
    const promptFile = path.join(directory, 'prompt.txt');
    assert.deepEqual(fs.readFileSync(promptFile), Buffer.from(payload, 'utf8'));
    const instruction = `Read the full task prompt from ${path.relative(h.cwd, promptFile).split(path.sep).join('/')} and follow it exactly.`;
    const args = runnerArgs(runner);
    assert.deepEqual(args, expectedArgs(provider, model, agent, instruction, effort));
    noAutoApproval(args);
    if (!configured) assert.ok(!args.includes('--model') && !args.includes('-m'));
    assert.ok(runner.includes(h.request(provider).bin.replace(/'/g, "''")));
    for (const text of [runner, observer, JSON.stringify(h.calls[0].args)]) {
      assert.ok(!text.includes('BEGIN') && !text.includes('opaque') && !text.includes(payload));
    }
    assert.equal(h.calls[0].bin, 'powershell.exe');
    assert.equal(h.calls[0].options.detached, false);
    assert.equal(h.calls[0].options.windowsHide, true);
    assert.match(observer, /Get-CimInstance Win32_Process/);
    assert.match(observer, /Report 'started' \$false/);
    assert.match(observer, /powershell\|pwsh\|cmd\|conhost\|OpenConsole/);
    h.calls[0].child.emit('spawn'); await flush();
    assert.equal(pending.status, 'pending', 'observer spawn alone is not CLI startup');
    h.state({ attempt: 'foreign', status: 'started', confirmed: true }); await flush();
    assert.equal(pending.status, 'pending');
    fs.writeFileSync(h.scripts().stateFile, '{partial'); h.intervals[0].fn(); await flush();
    assert.equal(pending.status, 'pending');
    h.state({ status: 'started', confirmed: false }); await flush();
    assert.equal(pending.status, 'pending');
    h.state({ status: 'started', confirmed: true }); await pending.promise;
    assert.equal(pending.status, 'launched');
    assert.equal(h.timers[0].active, false);
    assert.equal(h.intervals[0].referenced, false);
    assert.deepEqual(fs.readFileSync(promptFile), Buffer.from(payload));
    const foreign = path.join(directory, 'keep.md'); fs.writeFileSync(foreign, 'foreign');
    h.state({ status: 'ended', confirmed: true, ended: true });
    assert.equal(fs.existsSync(promptFile), false);
    assert.equal(fs.readFileSync(foreign, 'utf8'), 'foreign');
    assert.equal(pending.status, 'launched');
  });
}

for (const mode of ['timeout', 'readState error', 'unconfirmed ended', 'observer exit']) {
  test(`Windows ${mode} rejects with the real uncertain class before startup`, async t => {
    const h = harness(t), pending = h.start(h.request());
    const { directory } = h.scripts(), promptFile = path.join(directory, 'prompt.txt');
    if (mode === 'timeout') {
      assert.equal(h.timers[0].ms, 30000); h.timers[0].fn();
    } else if (mode === 'readState error') h.state({ status: 'error', ended: false });
    else if (mode === 'unconfirmed ended') h.state({ status: 'ended', ended: true, confirmed: false });
    else h.calls[0].child.emit('exit', 1);
    await pending.promise;
    assert.equal(pending.status, 'rejected');
    assert.ok(pending.error instanceof h.Uncertain);
    assert.equal(pending.error.code, 'AUTOOC_TERMINAL_UNCERTAIN');
    assert.match(pending.error.message, /confirm|failed/);
    assert.equal(fs.existsSync(promptFile), mode !== 'unconfirmed ended');
    if (mode === 'timeout' || mode === 'readState error') {
      h.state({ status: 'started', confirmed: true }); await flush();
      assert.equal(pending.status, 'rejected');
      assert.deepEqual(fs.readFileSync(promptFile), Buffer.from(payload));
      h.state({ status: 'ended', ended: true, confirmed: true });
      assert.equal(fs.existsSync(promptFile), false);
    }
  });
}

for (const mode of ['throw', 'error event']) {
  test(`Windows known initial spawn failure (${mode}) cleans only its own files`, async t => {
    const h = harness(t), first = h.start(h.request('claude'));
    const firstDirectory = h.scripts().directory;
    const firstPrompt = path.join(firstDirectory, 'prompt.txt');
    fs.writeFileSync(path.join(h.cwd, '.gitignore'), 'original project rules\n');
    h.control.spawnFailure = mode === 'throw';
    const second = h.start(h.request('copilot'));
    const secondDirectory = h.scripts(1).directory;
    if (mode === 'error event') {
      fs.writeFileSync(path.join(secondDirectory, 'keep.md'), 'foreign');
      h.calls[1].child.emit('error', Error('synthetic ENOENT'));
      assert.equal(fs.readFileSync(path.join(secondDirectory, 'keep.md'), 'utf8'), 'foreign');
    }
    await second.promise;
    assert.equal(second.status, 'rejected');
    assert.ok(!(second.error instanceof h.Uncertain), 'known failure is not an uncertain session');
    assert.equal(fs.existsSync(path.join(secondDirectory, 'prompt.txt')), false);
    if (mode === 'throw') assert.equal(fs.existsSync(secondDirectory), false);
    assert.deepEqual(fs.readFileSync(firstPrompt), Buffer.from(payload));
    assert.equal(fs.readFileSync(path.join(h.cwd, '.gitignore'), 'utf8'), 'original project rules\n');
    h.state({ status: 'started', confirmed: true }, 0); await first.promise;
    assert.equal(first.status, 'launched');
  });
}

const shQuote = value => "'" + value.replace(/'/g, "'\\''") + "'";

for (const platform of ['linux', 'darwin']) for (const provider of providers) for (const configured of [false, true]) {
  test(`${platform} ${provider}: ${configured ? 'explicit' : 'default'} argv, owned shell lifetime and late error retention (mock terminal IO)`, async t => {
    const h = harness(t, platform);
    const model = configured ? 'model\' " & $() \u5de5\u5177' : '';
    const agent = configured && provider.startsWith('opencode') ? 'plan\' & $()' : '';
    const effort = configured && provider === 'codex' ? 'high"\nother=true' : undefined;
    const request = h.request(provider, { model, agent, reasoningEffort: effort });
    const pending = h.start(request, 'synthetic-terminal --hold');
    await versionChecked(h, provider);
    const [directory] = h.directories();
    assert.match(path.basename(directory), /^interactive-[A-Za-z0-9]{6}$/);
    const promptFile = path.join(directory, 'prompt.txt'), scriptFile = path.join(directory, 'launch.sh');
    assert.deepEqual(fs.readFileSync(promptFile), Buffer.from(payload));
    const script = fs.readFileSync(scriptFile, 'utf8');
    const instruction = `Read ${path.relative(h.cwd, promptFile).split(path.sep).join('/')} as UTF-8 and follow its instructions.`;
    const args = expectedArgs(provider, model, agent, instruction, effort);
    noAutoApproval(args);
    assert.equal(script.trimEnd().split('\n').at(-1), [request.bin, ...args].map(shQuote).join(' '));
    assert.match(script, /^#!\/bin\/sh\ncleanup\(\) \{\n  status=\$\?/);
    assert.match(script, /exit "\$status"\n}\ntrap cleanup EXIT\n/);
    assert.ok(script.includes(`rm -f -- ${shQuote(promptFile)} ${shQuote(scriptFile)}`));
    assert.ok(script.includes(`> ${shQuote(path.join(directory, 'autooc-cleanup.json'))}`));
    assert.ok(script.includes(shQuote(JSON.stringify({ schemaVersion: 1, kind: 'interactive', directory: path.basename(directory), completed: true }))));
    for (const location of [directory, path.dirname(directory), path.dirname(path.dirname(directory))]) assert.ok(script.includes(`[ ! -L ${shQuote(location)} ]`));
    assert.doesNotMatch(script, /rm -rf|exec /);
    assert.ok(!script.includes('BEGIN') && !JSON.stringify(h.calls[0].args).includes('BEGIN'));
    assert.equal(h.writes.find(write => write.file === promptFile).options.flag, 'wx');
    assert.equal(h.writes.find(write => write.file === scriptFile).options.mode, 0o700);
    assert.equal(fs.existsSync(path.join(directory, 'autooc-cleanup.json')), false);
    if (platform === 'linux') {
      assert.equal(h.probes[0].writes, 0, 'terminal preflight precedes all auxiliary writes');
      assert.match(h.probes[0].command, /synthetic-terminal/);
      assert.equal(h.calls[0].bin, 'synthetic-terminal');
      assert.deepEqual(h.calls[0].args, ['--hold', '-e', 'sh', '-lc',
        `cd ${shQuote(h.cwd)} && '/bin/sh' ${shQuote(scriptFile)}`]);
    } else { assert.equal(h.calls[0].bin, 'osascript'); assert.equal(h.probes.length, 0); }
    await flush(); assert.equal(pending.status, 'pending');
    h.calls[0].child.emit('spawn'); await pending.promise;
    assert.equal(pending.status, 'launched');
    h.calls[0].child.emit('error', Error('synthetic late asynchronous error'));
    h.calls[0].child.emit('exit', 0); await flush();
    assert.deepEqual(fs.readFileSync(promptFile), Buffer.from(payload));
    assert.equal(fs.readFileSync(scriptFile, 'utf8'), script);
    assert.equal(fs.existsSync(path.join(directory, 'autooc-cleanup.json')), false);
  });
}

test('Linux unavailable terminal preflights without creating any files', async t => {
  const h = harness(t, 'linux'); h.control.terminal = false;
  await assert.rejects(h.launch(h.request(), 'missing-terminal'), /No supported Linux terminal/);
  assert.equal(h.probes.length, 1); assert.equal(h.probes[0].writes, 0);
  assert.equal(h.calls.length, 0); assert.equal(h.writes.length, 0);
  assert.deepEqual(fs.readdirSync(h.cwd), []);
});

for (const mode of ['prompt write', 'script write', 'spawn throw', 'spawn error', 'cancel after preparation']) {
  test(`POSIX known ${mode} cleans its own input without touching concurrent or foreign files`, async t => {
    const h = harness(t, 'linux');
    const first = h.start(h.request());
    h.calls[0].child.emit('spawn'); await first.promise;
    const [firstDirectory] = h.directories();
    const controller = new AbortController();
    let ownDirectory;
    h.control.writeHook = file => {
      if (path.basename(file) === 'prompt.txt' || path.basename(file) === 'launch.sh') {
        ownDirectory = path.dirname(file);
        fs.writeFileSync(path.join(ownDirectory, 'keep.md'), 'foreign');
      }
      if (mode === 'prompt write' && path.basename(file) === 'prompt.txt') throw Error('synthetic write failure');
      if (mode === 'script write' && path.basename(file) === 'launch.sh') throw Error('synthetic write failure');
      if (mode === 'cancel after preparation' && path.basename(file) === 'launch.sh') controller.abort();
    };
    h.control.spawnFailure = mode === 'spawn throw';
    const second = h.start(h.request('claude', { signal: controller.signal }));
    if (mode === 'spawn error') h.calls[1].child.emit('error', Error('synthetic spawn failure'));
    await second.promise;
    assert.equal(second.status, 'rejected');
    assert.match(second.error.message, /synthetic|cancelled/);
    assert.equal(h.calls.length, mode.startsWith('spawn') ? 2 : 1);
    assert.equal(fs.existsSync(path.join(ownDirectory, 'prompt.txt')), false);
    assert.equal(fs.existsSync(path.join(ownDirectory, 'launch.sh')), false);
    assert.equal(fs.readFileSync(path.join(ownDirectory, 'keep.md'), 'utf8'), 'foreign');
    const receipt = JSON.parse(fs.readFileSync(path.join(ownDirectory, 'autooc-cleanup.json'), 'utf8'));
    assert.equal(receipt.completed, true); assert.equal(receipt.directory, path.basename(ownDirectory));
    assert.deepEqual(fs.readFileSync(path.join(firstDirectory, 'prompt.txt')), Buffer.from(payload));
    assert.equal(fs.existsSync(path.join(firstDirectory, 'launch.sh')), true);
  });
}

for (const platform of ['win32', 'linux', 'darwin']) for (const phase of ['before version', 'after version']) {
  test(`${platform}: cancellation ${phase} prevents files and terminal launch`, async t => {
    const h = harness(t, platform), controller = new AbortController();
    if (phase === 'before version') controller.abort();
    const pending = h.start(h.request('opencode2', { signal: controller.signal }));
    if (phase === 'after version') {
      assert.equal(h.versions.length, 1);
      controller.abort(); h.versions[0].callback(null, '2.0.0');
    } else assert.equal(h.versions.length, 0);
    await pending.promise;
    assert.equal(pending.status, 'rejected'); assert.match(pending.error.message, /cancelled/);
    assert.equal(h.calls.length, 0); assert.equal(h.probes.length, 0); assert.equal(h.writes.length, 0);
    assert.deepEqual(fs.readdirSync(h.cwd), []);
  });
}

for (const output of ['1.9.0', 'not a version', null]) {
  test(`OpenCode 2 failed version check (${output}) leaves no files`, async t => {
    const h = harness(t), pending = h.start(h.request('opencode2'));
    h.versions[0].callback(output === null ? Error('synthetic version failure') : null, output);
    await pending.promise;
    assert.equal(pending.status, 'rejected'); assert.match(pending.error.message, /version/);
    assert.equal(h.calls.length, 0); assert.equal(h.writes.length, 0);
    assert.deepEqual(fs.readdirSync(h.cwd), []);
  });
}

test('unsupported OS and invalid providers reject without files or processes', async t => {
  for (const provider of [...providers, 'unknown', undefined]) {
    const h = harness(t, 'freebsd'), pending = h.start(h.request(provider, { provider }));
    await versionChecked(h, provider);
    await pending.promise;
    assert.equal(pending.status, 'rejected');
    assert.match(pending.error.message, /require Windows|provider is required/);
    assert.equal(h.calls.length, 0); assert.equal(h.writes.length, 0);
    assert.deepEqual(fs.readdirSync(h.cwd), []);
  }
});

test('Windows prompt size never increases encoded command lines', async t => {
  const h = harness(t);
  const small = h.start(h.request('codex', { prompt: 'small' }));
  const large = h.start(h.request('codex'));
  assert.equal(h.calls[0].args.at(-1).length, h.calls[1].args.at(-1).length);
  assert.equal(h.scripts(0).runner.length, h.scripts(1).runner.length);
  assert.equal(fs.readFileSync(path.join(h.scripts(0).directory, 'prompt.txt'), 'utf8'), 'small');
  assert.deepEqual(fs.readFileSync(path.join(h.scripts(1).directory, 'prompt.txt')), Buffer.from(payload));
  h.state({ status: 'started', confirmed: true }, 0);
  h.state({ status: 'started', confirmed: true }, 1);
  await Promise.all([small.promise, large.promise]);
  assert.equal(small.status, 'launched'); assert.equal(large.status, 'launched');
});

for (const major of [1, 2]) {
  test(`Windows helper without promptArgs preserves legacy OpenCode ${major} arguments`, t => {
    const h = harness(t), results = [];
    const launch = h.load('cli-launchers.ts').openOpencodeCliLongPromptWindows;
    launch('synthetic.exe', h.cwd, {}, 'test/model', 'plan', payload, {
      opencodeMajor: major, onLaunched: () => results.push('ok'), onError: error => results.push(error),
    });
    const { runner, directory } = h.scripts();
    const instruction = `Read the full task prompt from ${path.relative(h.cwd, path.join(directory, 'prompt.txt')).split(path.sep).join('/')} and follow it exactly.`;
    assert.deepEqual(runnerArgs(runner), [...(major === 2 ? ['mini', '--standalone'] : []), '-m', 'test/model', '--agent', 'plan', '--prompt', instruction]);
    h.state({ status: 'started', confirmed: true });
    assert.deepEqual(results, ['ok']);
  });
}

test('Windows helper quotes arbitrary promptArgs callback output as literals and keeps environment out of scripts', t => {
  const h = harness(t), results = [], received = [];
  const literal = "value' ; $(throw 'not executable') ` \u5de5\u5177\r\nnext";
  h.load('cli-launchers.ts').openOpencodeCliLongPromptWindows('synthetic.exe', h.cwd,
    { AUTOOC_SYNTHETIC_TEST_VALUE: 'synthetic-not-a-secret' }, '', '', payload, {
      promptArgs(instruction) { received.push(instruction); return ['--literal', literal, '--', instruction]; },
      onLaunched: () => results.push('ok'), onError: error => results.push(error),
    });
  const { runner, observer } = h.scripts();
  // This callback deliberately includes a newline, so match across lines too.
  const text = runner.match(/  \$cliArgs = @\(([\s\S]*?)\)\n  & \$target/)[1];
  const literals = text.match(/'(?:[^']|'')*'/g);
  assert.equal(literals.join(', '), text);
  assert.deepEqual(literals.map(value => value.slice(1, -1).replace(/''/g, "'")), ['--literal', literal, '--', received[0]]);
  assert.equal(received.length, 1);
  assert.equal(h.calls[0].options.env.AUTOOC_SYNTHETIC_TEST_VALUE, 'synthetic-not-a-secret');
  assert.ok(!runner.includes('synthetic-not-a-secret') && !observer.includes('synthetic-not-a-secret'));
  assert.ok(!runner.includes('BEGIN') && !observer.includes('BEGIN'));
  h.state({ status: 'started', confirmed: true });
  assert.deepEqual(results, ['ok']);
});

test('Windows generated observer and runner parse natively without executing either script', { skip: process.platform !== 'win32' }, async t => {
  const scripts = [];
  for (const provider of providers) {
    const h = harness(t), pending = h.start(h.request(provider, {
      model: 'model\' " & $() \u5de5\u5177', agent: provider.startsWith('opencode') ? 'plan\' & $()' : '',
      reasoningEffort: provider === 'codex' ? 'high"\nother=true' : undefined,
    }));
    await versionChecked(h, provider);
    const generated = h.scripts(); scripts.push(generated.observer, generated.runner);
    h.state({ status: 'started', confirmed: true }); await pending.promise;
    assert.equal(pending.status, 'launched');
  }
  const parser = "$scripts = [Console]::In.ReadToEnd() | ConvertFrom-Json; foreach ($text in $scripts) { $tokens = $null; $errors = $null; [void][System.Management.Automation.Language.Parser]::ParseInput($text, [ref]$tokens, [ref]$errors); if ($errors.Count) { $errors | ForEach-Object { $_.Message }; exit 1 } }; [Console]::Out.Write($scripts.Count)";
  const result = require('node:child_process').spawnSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', parser],
    { input: JSON.stringify(scripts), encoding: 'utf8', windowsHide: true, timeout: 15000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.equal(result.stdout.trim(), '10');
});

for (const platform of ['linux', 'darwin']) {
  test(`shared Windows transport rejects ${platform} before writing or spawning`, t => {
    const h = harness(t, platform), results = [];
    h.load('cli-launchers.ts').openOpencodeCliLongPromptWindows('synthetic.exe', h.cwd, {}, '', '', payload, {
      sharedExternal: { provider: 'Codex CLI' }, onError: error => results.push(error),
    });
    assert.match(results[0]?.message || '', /Shared external terminal requires Windows/);
    assert.equal(h.calls.length, 0); assert.equal(h.writes.length, 0);
  });
}

test('shared transport uses per-attempt runner identity, not the Terminal router PID or inherited window environment', t => {
  const h = harness(t);
  const terminal = path.join(h.cwd, 'wt.exe'); fs.writeFileSync(terminal, 'fake');
  const { sharedWindowsTerminalScripts } = h.load('shared-windows-terminal.ts');
  const first = sharedWindowsTerminalScripts({
    terminal, cwd: h.cwd, project: "Prójèct ; split-pane & ' $ % `\n", provider: 'Codex CLI',
    task: 'Task " ; new-tab', attempt: 'a'.repeat(32), runner: 'RUNNER', runnerFile: path.join(h.cwd, 'runner.ps1'),
  });
  const second = sharedWindowsTerminalScripts({
    terminal, cwd: h.cwd, project: 'other display', provider: 'Claude Code CLI',
    attempt: 'b'.repeat(32), runner: 'RUNNER', runnerFile: path.join(h.cwd, 'runner.ps1'),
  });
  assert.equal(first.color, second.color);
  assert.match(first.color, /^#[a-f0-9]{6}$/);
  assert.doesNotMatch(first.title, /[;"'$%`&\r\n]/);
  assert.match(first.observerLaunch, /'-w', 'AutoOC', 'new-tab'/);
  assert.match(first.observerLaunch, /NamedPipeServerStream/);
  assert.match(first.observerLaunch, /PipeSecurity/);
  assert.match(first.observerLaunch, /WindowsIdentity/);
  assert.match(first.observerLaunch, /EnvironmentVariables/);
  assert.match(first.observerLaunch, /Get-Process -Id/);
  assert.doesNotMatch(first.observerLaunch, /\$session = Start-Process/);
  assert.match(first.runnerPrefix, /NamedPipeClientStream/);
  assert.match(first.runnerPrefix, /GetEnvironmentVariables/);
  assert.match(first.runnerPrefix, /SetEnvironmentVariable/);
  assert.notEqual(first.runnerPrefix, second.runnerPrefix);
});

test('shared handshake reads and writes are bounded and environment application is acknowledged before process inspection', t => {
  const h = harness(t);
  const scripts = h.load('shared-windows-terminal.ts').sharedWindowsTerminalScripts({
    terminal: 'synthetic-wt.exe', cwd: h.cwd, attempt: 'c'.repeat(32), provider: 'Synthetic', runner: '', runnerFile: path.join(h.cwd, 'runner.ps1'),
  });
  for (const script of [scripts.runnerPrefix, scripts.observerLaunch]) {
    assert.doesNotMatch(script, /\.ReadLine\(\)|\.WriteLine\(/);
    assert.match(script, /ReadLineAsync/);
    assert.match(script, /WriteLineAsync/);
    assert.match(script, /\.Wait\(5000\)/);
    assert.match(script, /handshake-timeout/);
    assert.match(script, /finally \{ \$pipe.Dispose\(\) \}/);
  }
  assert.match(scripts.runnerPrefix, /environment-applied/);
  assert.match(scripts.observerLaunch, /environment-ack/);
  assert.match(scripts.observerLaunch, /Report 'pending' \$false/);
});

test('Windows startup diagnostics expose only allowlisted stages/codes and never turn progress into confirmation', async t => {
  const h = harness(t), pending = h.start(h.request());
  const { observer, directory } = h.scripts();
  assert.match(observer, /stage = \$stage/);
  assert.match(observer, /errorCode = \$autoocErrorCode/);
  assert.doesNotMatch(observer, /\$_\.Exception|\$_\.ToString/);
  h.state({ status: 'pending', confirmed: false, stage: 'runner-identity' });
  await flush(); assert.equal(pending.status, 'pending');
  h.state({ status: 'error', ended: false, stage: 'runner-identity', errorCode: 'handshake-timeout', message: 'sensitive-value' });
  await pending.promise;
  assert.ok(pending.error instanceof h.Uncertain);
  assert.match(pending.error.message, /runner-identity.*handshake-timeout/);
  assert.doesNotMatch(pending.error.message, /sensitive-value/);
  assert.ok(fs.existsSync(path.join(directory, 'prompt.txt')));
  assert.equal(h.calls.length, 1);
});

test('Windows timeout retains the last safe stage but ignores arbitrary receipt diagnostics', async t => {
  for (const stage of ['environment-ack', 'sensitive-value']) {
    const h = harness(t), pending = h.start(h.request());
    h.state({ status: 'pending', stage, errorCode: 'sensitive-value' });
    h.timers[0].fn(); await pending.promise;
    assert.doesNotMatch(pending.error.message, /sensitive-value/);
    if (stage === 'environment-ack') assert.match(pending.error.message, /environment-ack/);
    assert.ok(pending.error instanceof h.Uncertain);
    assert.equal(h.calls.length, 1);
  }
});

// Execute only generated pipe code in hidden synthetic PowerShell children.
// No Terminal router, provider, inherited credentials or user window is used.
test('synthetic stage tracing uses constant labels without copying statement values', () => {
  const script = "$pipe = New-Object IO.MemoryStream\n$pipe.Connect(10000)\n$value = 'private-value' | ConvertFrom-Json\n$x | Add-Member NoteProperty X 1";
  const traced = tracePipeScript(script);
  assert.match(traced, /WriteLine\('AUTOOC_TEST_STAGE:new-object'\)\n\$pipe = New-Object/);
  assert.match(traced, /WriteLine\('AUTOOC_TEST_STAGE:pipe-connect'\)\n\$pipe.Connect/);
  assert.match(traced, /WriteLine\('AUTOOC_TEST_STAGE:json-read'\)/);
  assert.match(traced, /WriteLine\('AUTOOC_TEST_STAGE:add-member'\)/);
  assert.equal(traced.split('\n').filter(line => line.includes('AUTOOC_TEST_STAGE:')).some(line => line.includes('private-value')), false);
  assert.equal(traced.split('\n').filter(line => !line.includes('AUTOOC_TEST_STAGE:')).join('\n'), script);
});

// Test-only instrumentation: labels are fixed, never derived from script data.
// Insert before a statement so a child deadline identifies the blocked stage.
const pipeStages = [
  ['new-object', /\bNew-Object\b/],
  ['pipe-connect', /\$pipe\.Connect\(/],
  ['pipe-create-dotnet', /\[IO\.Pipes\.NamedPipeClientStream\]::new/],
  ['identity-write', /\$writer\.WriteLineAsync\(\[string\]\$PID/],
  ['json-read', /\bConvertFrom-Json\b/],
  ['json-write', /\bConvertTo-Json\b/],
  ['add-member', /\bAdd-Member\b/],
  ['module-import', /\bImport-Module\b/],
  ['process-lookup', /\bGet-Process\b/],
  ['connection-wait', /\$connection\.AsyncWaitHandle\.WaitOne/],
];
function tracePipeScript(script) {
  return script.split('\n').map(line => {
    const stages = pipeStages.filter(([, pattern]) => pattern.test(line));
    return stages.map(([stage]) => `[Console]::Out.WriteLine('AUTOOC_TEST_STAGE:${stage}')\n`).join('') + line;
  }).join('\n');
}

function pipeChild(t, script, diagnosticEnvironment = {}) {
  const started = Date.now(), marker = 'AUTOOC_TEST_SCRIPT_STARTED';
  const child = require('node:child_process').spawn(
    path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(`[Console]::Out.WriteLine('${marker}')\n${tracePipeScript(script)}`, 'utf16le').toString('base64')],
    { windowsHide: true, timeout: 15000, env: { SystemRoot: process.env.SystemRoot || 'C:\\Windows', ...diagnosticEnvironment } });
  let stdout = '', stderrBytes = 0;
  child.stdout.on('data', data => { stdout += data; });
  // Retain only a byte count, never exception text or transferred values.
  child.stderr.on('data', data => { stderrBytes += data.length; });
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({
      code, signal, scriptStarted: stdout.startsWith(marker + '\r\n') || stdout.startsWith(marker + '\n'),
      stages: [...stdout.matchAll(/^AUTOOC_TEST_STAGE:([a-z-]+)\r?$/gm)].map(match => match[1]),
      stdout: stdout.replace(new RegExp('^' + marker + '\\r?\\n'), '').replace(/^AUTOOC_TEST_STAGE:[a-z-]+\r?\n/gm, ''),
      stderrBytes, elapsedMs: Date.now() - started,
    }));
  });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  child.stdin.end();
  return { child, done };
}

test('native synthetic PowerShell starts in the isolated environment before pipe work', { skip: process.platform !== 'win32', timeout: 20000 }, async t => {
  const result = await pipeChild(t, "[Console]::Out.WriteLine('ok')").done;
  assert.equal(result.code, 0, JSON.stringify(result));
  assert.equal(result.scriptStarted, true);
  assert.equal(result.stdout.trim(), 'ok');
  assert.equal(result.signal, null);
});

// Bounded clean-runner hypothesis probes, not a production environment change.
// Each child starts afresh; no profile, inherited credentials, provider or router.
for (const [name, script, environment] of [
  ['dotnet pipe construction', "$p = [IO.Pipes.NamedPipeClientStream]::new('.', 'autooc-synthetic-unused', [IO.Pipes.PipeDirection]::InOut, [IO.Pipes.PipeOptions]::Asynchronous); $p.Dispose()", 'minimal'],
  ['New-Object minimal', '$p = New-Object IO.MemoryStream; $p.Dispose()', 'minimal'],
  ['New-Object fixture temp', '$p = New-Object IO.MemoryStream; $p.Dispose()', 'temp'],
  ['New-Object analysis cache disabled', '$p = New-Object IO.MemoryStream; $p.Dispose()', 'no-cache'],
  ['JSON minimal', '$value = \'{"value":1}\' | ConvertFrom-Json; $null = $value | ConvertTo-Json -Compress', 'minimal'],
  ['JSON fixture temp', '$value = \'{"value":1}\' | ConvertFrom-Json; $null = $value | ConvertTo-Json -Compress', 'temp'],
  ['Add-Member minimal', '$value = [pscustomobject]@{ X=1 }; $value | Add-Member NoteProperty Y 2', 'minimal'],
  ['Utility explicit import', "Import-Module ($PSHOME + '\\Modules\\Microsoft.PowerShell.Utility\\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop", 'minimal'],
]) {
  test(`native isolated PowerShell stage probe: ${name}`, { skip: process.platform !== 'win32', timeout: 20000 }, async t => {
    const env = {};
    if (environment === 'temp') {
      const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'autooc-pipe-probe-'));
      t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
      env.TEMP = temp; env.TMP = temp;
    } else if (environment === 'no-cache') {
      env.PSModuleAnalysisCachePath = 'NUL';
    }
    const result = await pipeChild(t, `$ErrorActionPreference='Stop'\n${script}\n[Console]::Out.WriteLine('ok')`, env).done;
    // Successful CI probes are printed too, to compare minimal/control stages.
    t.diagnostic(JSON.stringify({ probe: name, ...result }));
    assert.equal(result.code, 0, JSON.stringify(result));
    assert.equal(result.stdout.trim(), 'ok');
  });
}

for (const mode of ['success', 'literal script success', 'stalled environment', 'invalid environment']) {
  test(`native shared runner pipe: ${mode}`, { skip: process.platform !== 'win32', timeout: 20000 }, async t => {
    const h = harness(t), attempt = require('node:crypto').randomBytes(16).toString('hex');
    const success = mode.endsWith('success');
    const runnerFile = path.join(h.cwd, "O'Brien ; & $ ` 工具", 'runner.ps1');
    const scripts = h.load('shared-windows-terminal.ts').sharedWindowsTerminalScripts({
      terminal: 'never-executed.exe', cwd: h.cwd, attempt, provider: 'Synthetic', runner: "[Console]::Out.WriteLine('ok')", runnerFile,
    });
    const sockets = [];
    let acknowledged = false;
    const server = require('node:net').createServer(socket => {
      sockets.push(socket);
      let buffer = '', sent = false;
      socket.on('error', () => {});
      socket.on('data', data => {
        buffer += data.toString('utf8');
        if (!sent && buffer.includes('\n')) {
          sent = true; buffer = '';
          if (mode !== 'stalled environment') socket.write(success ? '{"AUTOOC_SYNTHETIC":"safe"}\n' : 'invalid-json\n');
        } else if (buffer.includes('environment-applied')) acknowledged = true;
      });
    });
    t.after(() => { sockets.forEach(socket => socket.destroy()); server.close(); });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(`\\\\.\\pipe\\autooc-terminal-${attempt}`, resolve);
    });
    let body = scripts.runnerPrefix + "\n[Console]::Out.WriteLine('ok')";
    if (mode === 'literal script success') {
      fs.mkdirSync(path.dirname(runnerFile));
      fs.writeFileSync(runnerFile, '\ufeff' + scripts.runnerScript);
      body = Buffer.from(scripts.observerLaunch.match(/'-EncodedCommand', '([A-Za-z0-9+/=]+)'/)[1], 'base64').toString('utf16le');
    }
    const script = `$ErrorActionPreference='Stop'\ntry {\n${body}\n} catch { [Console]::Out.WriteLine('failed'); exit 2 }`;
    const result = await pipeChild(t, script).done;
    assert.equal(result.code, success ? 0 : 2, JSON.stringify(result));
    assert.match(result.stdout, success ? /ok/ : /failed/);
    if (success) assert.equal(result.stdout.trim(), 'ok', 'handshake writes must not pollute CLI stdout');
    assert.equal(acknowledged, success);
  });
}

for (const mode of ['success', 'stalled identity', 'stalled environment write', 'stalled acknowledgement']) {
  test(`native shared observer pipe: ${mode}`, { skip: process.platform !== 'win32', timeout: 20000 }, async t => {
    const h = harness(t), attempt = require('node:crypto').randomBytes(16).toString('hex');
    const scripts = h.load('shared-windows-terminal.ts').sharedWindowsTerminalScripts({
      terminal: 'never-executed.exe', cwd: h.cwd, attempt, provider: 'Synthetic', runner: '', runnerFile: path.join(h.cwd, 'runner.ps1'),
    });
    // Replace ONLY native Terminal dispatch. The real pipe/security/handshake
    // code executes, but no session monitoring or launch command executes.
    let launch = scripts.observerLaunch.replace(/^.*\$router = Start-Process.*$/m, '    $router = $null');
    if (mode === 'stalled environment write') {
      launch = launch.replace(/^.*\$environment = @\{\};.*$/m, "    $environment = @{ AUTOOC_SYNTHETIC = ('x' * 1048576) }");
    }
    const script = `$ErrorActionPreference='Stop'; $stage='dispatch'; $autoocErrorCode='stage-failed'\nfunction Report($status,$ended) { [Console]::Out.WriteLine($stage) }\ntry {\n${launch}\n[Console]::Out.WriteLine('ok')\n} catch { [Console]::Out.WriteLine("failed:$stage/$autoocErrorCode"); exit 2 }`;
    const { child, done } = pipeChild(t, script);
    let socket, connected = false, output = '';
    t.after(() => socket?.destroy());
    child.stdout.on('data', data => {
      output += data.toString('utf8');
      if (!connected && output.includes('runner-connect')) {
        connected = true;
        socket = require('node:net').connect(`\\\\.\\pipe\\autooc-terminal-${attempt}`, () => {
          if (mode !== 'stalled identity') socket.write(String(process.pid) + '\n');
          if (mode === 'stalled environment write') socket.pause();
        });
        socket.on('error', () => {});
        let received = false;
        socket.on('data', () => {
          // Deliberately do not retain transferred environment bytes.
          if (!received && mode === 'success') socket.write('environment-applied\n');
          received = true;
        });
      }
    });
    const result = await done;
    assert.equal(result.code, mode === 'success' ? 0 : 2, JSON.stringify(result));
    if (mode === 'success') assert.match(result.stdout, /ok/);
    else assert.match(result.stdout, new RegExp(`failed:${mode === 'stalled identity' ? 'runner-identity' : mode === 'stalled environment write' ? 'environment-handoff' : 'environment-ack'}/handshake-timeout`));
    assert.doesNotMatch(result.stdout, /SystemRoot|safe/);
    assert.doesNotMatch(result.stdout, /VoidTaskResult/);
  });
}

for (const descendant of ['none', 'cmd.exe', 'node.exe']) {
  test(`native observer confirmation requires a CLI descendant, not ${descendant} alone`, { skip: process.platform !== 'win32', timeout: 20000 }, async t => {
    const h = harness(t);
    h.start(h.request());
    const { observer } = h.scripts();
    // Execute the actual monitoring loop with synthetic process metadata only.
    // No observer dispatch, CIM lookup, native CLI or user process is invoked.
    const monitoring = observer.slice(observer.indexOf("  $stage = 'process-inspection'"), observer.indexOf("  $stage = 'session-exit'"));
    assert.ok(monitoring.includes('Get-CimInstance'));
    const script = `
$ErrorActionPreference='Stop'; $confirmed=$false
$session = [pscustomobject]@{ Id=100; HasExited=$false }
$session | Add-Member ScriptMethod Refresh { $this.HasExited=$true }
function Start-Sleep {}
function Get-CimInstance {
  [pscustomobject]@{ ProcessId=101; ParentProcessId=100; Name='cmd.exe' }
  ${descendant === 'none' ? '' : `[pscustomobject]@{ ProcessId=102; ParentProcessId=101; Name='${descendant}' }`}
}
function Report($status,$ended) { [Console]::Out.WriteLine("$status/$confirmed/$ended") }
${monitoring}
[Console]::Out.WriteLine("confirmed=$confirmed")
`;
    const result = await pipeChild(t, script).done;
    assert.equal(result.code, 0, JSON.stringify(result));
    assert.equal(result.stdout.trim().replace(/\r/g, ''), descendant === 'node.exe'
      ? 'pending/False/False\nstarted/True/False\nconfirmed=True'
      : 'pending/False/False\nconfirmed=False');
  });
}

test('cmd-only process-inspection progress remains uncertain after deadline and never retries', async t => {
  const h = harness(t), pending = h.start(h.request());
  const { directory } = h.scripts();
  h.state({ status: 'pending', stage: 'process-inspection', confirmed: false, ended: false });
  await flush();
  assert.equal(pending.status, 'pending');
  h.timers[0].fn(); await pending.promise;
  assert.ok(pending.error instanceof h.Uncertain);
  assert.match(pending.error.message, /last stage: process-inspection/);
  assert.equal(h.calls.length, 1);
  assert.ok(fs.existsSync(path.join(directory, 'prompt.txt')));
});

test('shared readable runner uses an exact literal path, retains uncertain input and cleans only on completion', t => {
  const h = harness(t), results = [];
  const tricky = path.join(h.cwd, "Prójèct O'Brien; & $ ` 工具");
  fs.mkdirSync(tricky);
  const terminal = path.join(h.cwd, 'wt.exe'); fs.writeFileSync(terminal, 'fake'); h.environment.PATH = h.cwd;
  h.load('cli-launchers.ts').openOpencodeCliLongPromptWindows('synthetic.exe', tricky, { AUTOOC_ONLY_IN_MEMORY: 'not-in-source' }, '', '', payload, {
    sharedExternal: { provider: 'Synthetic' }, onError: error => results.push(error),
  });
  const { bootstrap, runner, directory } = h.scripts(), file = path.join(directory, 'runner.ps1');
  assert.equal(bootstrap, "& '" + file.replace(/'/g, "''") + "'");
  assert.doesNotMatch(runner, /GZipStream|FromBase64String|not-in-source|BEGIN/);
  assert.ok(fs.readFileSync(file).subarray(0, 3).equals(Buffer.from([239, 187, 191])));
  assert.equal(h.writes.find(write => write.file === file).options.flag, 'wx');
  h.state({ status: 'error', stage: 'runner-connect', ended: false });
  assert.ok(fs.existsSync(file)); assert.ok(fs.existsSync(path.join(directory, 'prompt.txt')));
  fs.writeFileSync(path.join(directory, 'foreign.txt'), 'preserve');
  h.state({ status: 'error', ended: true });
  assert.equal(fs.existsSync(file), false);
  assert.equal(fs.readFileSync(path.join(directory, 'foreign.txt'), 'utf8'), 'preserve');
  assert.equal(h.calls.length, 1); assert.equal(results.length, 1);
});

test('shared launch retains prompts under uncertain routing, isolates concurrent receipts and parses native scripts', async t => {
  const h = harness(t), results = [[], []];
  fs.writeFileSync(path.join(h.cwd, 'wt.exe'), 'fake');
  h.environment.PATH = h.cwd;
  const launch = h.load('cli-launchers.ts').openOpencodeCliLongPromptWindows;
  for (let i = 0; i < 2; i++) launch("C:\\工具 O'Brien; & % $ `\\cli.exe", h.cwd,
    { AUTOOC_TEST_ENV: `synthetic-${i}` }, '', '', payload + i, {
      sharedExternal: { provider: i ? 'Claude CLI' : 'Codex CLI', task: 'task ; " & $ % `\n' },
      promptArgs: instruction => ['--', instruction],
      onLaunched: () => results[i].push('launched'), onError: error => results[i].push(error),
    });
  assert.equal(h.calls.length, 2);
  const scripts = [h.scripts(0), h.scripts(1)];
  assert.notEqual(scripts[0].attempt, scripts[1].attempt);
  assert.notEqual(scripts[0].directory, scripts[1].directory);
  for (let i = 0; i < 2; i++) {
    assert.ok(h.calls[i].args.at(-1).length < 30000);
    assert.ok(!scripts[i].observer.includes(`synthetic-${i}`));
    assert.ok(!scripts[i].runner.includes(`synthetic-${i}`));
    assert.equal(h.calls[i].options.env.AUTOOC_TEST_ENV, `synthetic-${i}`);
    h.calls[i].child.emit('spawn');
  }
  assert.deepEqual(results, [[], []]);
  h.state({ status: 'started', confirmed: true, attempt: scripts[1].attempt }, 0);
  assert.deepEqual(results, [[], []]);
  h.state({ status: 'started', confirmed: true }, 1);
  assert.deepEqual(results[1], ['launched']);
  h.state({ status: 'error', ended: false }, 0);
  assert.ok(results[0][0] instanceof h.Uncertain);
  assert.equal(fs.existsSync(path.join(scripts[0].directory, 'prompt.txt')), true);
  assert.equal(fs.existsSync(path.join(scripts[1].directory, 'prompt.txt')), true);
  h.state({ status: 'ended', ended: true, confirmed: true }, 1);
  assert.equal(fs.existsSync(path.join(scripts[0].directory, 'prompt.txt')), true);
  assert.equal(fs.existsSync(path.join(scripts[1].directory, 'prompt.txt')), false);
  if (process.platform === 'win32') {
    const parser = "$scripts = [Console]::In.ReadToEnd() | ConvertFrom-Json; foreach ($text in $scripts) { $tokens = $null; $errors = $null; [void][System.Management.Automation.Language.Parser]::ParseInput($text, [ref]$tokens, [ref]$errors); if ($errors.Count) { $errors | ForEach-Object { $_.Message }; exit 1 } }";
    const parsed = require('node:child_process').spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', parser],
      { input: JSON.stringify(scripts.flatMap(script => [script.runner, script.observer, script.bootstrap])), encoding: 'utf8', windowsHide: true, timeout: 15000 });
    assert.ifError(parsed.error); assert.equal(parsed.status, 0, parsed.stderr + parsed.stdout);
  }
});

for (const provider of providers) {
  test(`shared task destination routes ${provider} through exactly one runner with its own prompt`, async t => {
    const h = harness(t);
    fs.writeFileSync(path.join(h.cwd, 'wt.exe'), 'fake'); h.environment.PATH = h.cwd;
    const request = h.request(provider, { model: 'model; " & $ % ` 工具', agent: provider.startsWith('opencode') ? "plan' ;" : '' });
    const pending = h.launch(request, undefined, 'shared-external');
    await versionChecked(h, provider);
    assert.equal(h.calls.length, 1);
    const { observer, runner, directory } = h.scripts();
    assert.match(observer, /NamedPipeServerStream/);
    const instruction = `Read the full task prompt from ${path.relative(h.cwd, path.join(directory, 'prompt.txt')).split(path.sep).join('/')} and follow it exactly.`;
    assert.deepEqual(runnerArgs(runner), expectedArgs(provider, request.model, request.agent, instruction));
    h.state({ status: 'started', confirmed: true }); await pending;
    assert.deepEqual(fs.readFileSync(path.join(directory, 'prompt.txt')), Buffer.from(payload));
  });
}

test('missing Windows Terminal is actionable and creates neither auxiliary input nor processes', t => {
  const h = harness(t), results = [];
  h.environment.PATH = h.cwd; h.environment.LOCALAPPDATA = h.cwd;
  h.load('cli-launchers.ts').openOpencodeCliLongPromptWindows('synthetic.exe', h.cwd, {}, '', '', payload, {
    sharedExternal:{provider:'Synthetic CLI'}, onError:error=>results.push(error),
  });
  assert.match(results[0]?.message || '', /Windows Terminal.*not found.*another terminal destination/);
  assert.equal(h.calls.length,0); assert.equal(h.writes.length,0);
});

for (const mode of ['timeout','observer exit','partial receipt','spawn failure','cancel after preparation']) {
  test(`shared ${mode} preserves ownership and never retries`, t => {
    const h = harness(t), results = [], controller = new AbortController();
    fs.writeFileSync(path.join(h.cwd,'wt.exe'),'fake'); h.environment.PATH = h.cwd;
    h.control.spawnFailure = mode === 'spawn failure';
    if (mode === 'cancel after preparation') h.control.writeHook = file => { if (path.basename(file)==='prompt.txt') controller.abort(); };
    h.load('cli-launchers.ts').openOpencodeCliLongPromptWindows('synthetic.exe',h.cwd,{},'','',payload,{
      sharedExternal:{provider:'Synthetic CLI'},signal:controller.signal,onError:error=>results.push(error),onLaunched:()=>results.push('ok'),
    });
    assert.equal(h.calls.length,mode === 'cancel after preparation' ? 0 : 1);
    if (mode === 'spawn failure' || mode === 'cancel after preparation') {
      assert.equal(results.length,1); assert.ok(!(results[0] instanceof h.Uncertain));
      assert.equal(h.directories().length,0); return;
    }
    const {stateFile,directory} = h.scripts();
    if (mode === 'observer exit') h.calls[0].child.emit('exit',0);
    else {
      if (mode === 'partial receipt') { fs.writeFileSync(stateFile,'{partial'); h.intervals[0].fn(); assert.deepEqual(results,[]); }
      h.timers[0].fn();
    }
    assert.equal(results.length,1); assert.ok(results[0] instanceof h.Uncertain);
    assert.deepEqual(fs.readFileSync(path.join(directory,'prompt.txt')),Buffer.from(payload));
    assert.equal(h.calls.length,1);
  });
}
