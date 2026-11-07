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
  const load = sourceLoader({ fs: fakeFs, child_process: childProcess, os: { ...os, platform: () => platform } }, {
    process: { platform, pid: process.pid, env: { ...process.env } },
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
    const runner = Buffer.from(observer.match(/'-EncodedCommand', '([A-Za-z0-9+/=]+)'/)[1], 'base64').toString('utf16le');
    const attempt = observer.match(/attempt = '([a-f0-9]+)'/)[1];
    const stateFile = observer.match(/Set-Content -LiteralPath '((?:[^']|'')*state\.json)'/)[1].replace(/''/g, "'");
    return { observer, runner, attempt, stateFile, directory: path.dirname(stateFile) };
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
  return { cwd, auxiliary, control, calls, probes, versions, timers, intervals, writes, load, launch,
    Uncertain, directories, scripts, state, request, start };
}

async function flush() { await new Promise(resolve => setImmediate(resolve)); }

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
