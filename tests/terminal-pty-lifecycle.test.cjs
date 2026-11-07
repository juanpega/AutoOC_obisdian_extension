const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const filename = path.join(__dirname, '..', 'terminal-pty.ts');
const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
assert.equal(source.parseDiagnostics.length, 0);
const loader = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'loadTerminalPty');
assert.ok(loader?.body, 'Production loadTerminalPty must exist');
const returned = loader.body.statements.filter(node => ts.isReturnStatement(node) &&
  node.expression && ts.isObjectLiteralExpression(node.expression));
assert.equal(returned.length, 1, 'Extract the production backend return, not a nested cleanup return');
const backendObject = returned[0].expression;
assert.equal(backendObject.properties.filter(node => ts.isMethodDeclaration(node) && node.name.getText(source) === 'spawn').length, 1);
// Only omit the installer/loader boundary. The entire production spawn and its
// lifecycle closures execute unchanged, with private native references in memory.
const compiled = ts.transpileModule(`module.exports = (${backendObject.getText(source)});`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  reportDiagnostics: true,
});
assert.equal(compiled.diagnostics.length, 0);

async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

function clock() {
  const timers = new Map();
  let now = 0, sequence = 0;
  const add = (callback, delay, interval) => {
    const id = ++sequence;
    timers.set(id, { callback, due: now + delay, interval });
    return id;
  };
  return {
    timers,
    setTimeout: (callback, delay) => add(callback, delay, 0),
    clearTimeout: id => timers.delete(id),
    setInterval: (callback, delay) => add(callback, delay, delay),
    clearInterval: id => timers.delete(id),
    intervals: () => [...timers.values()].filter(timer => timer.interval).length,
    async advance(ms) {
      const target = now + ms;
      for (;;) {
        const next = [...timers].filter(([, timer]) => timer.due <= target)
          .sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
        if (!next) break;
        const [id, timer] = next;
        now = timer.due;
        if (timer.interval) timer.due += timer.interval;
        else timers.delete(id);
        timer.callback();
        await flush();
      }
      now = target;
      await flush();
    },
  };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness(t, { failAt, delayedExit = false, workerGate, nativeError = false } = {}) {
  const time = clock(), conpty = {}, errors = [], exits = [], dataListeners = new Set();
  const calls = { kill: 0, publicKill: 0, input: 0, output: 0, worker: 0, timerClose: 0, writes: 0, resizes: 0, data: 0 };
  let failure = failAt, queued = [{ run() { throw Error('Deferred operation must not run after shutdown'); } }];
  const step = resource => {
    calls[resource]++;
    if (failure === resource) { failure = undefined; throw Error(`Injected ${resource} failure`); }
  };
  const agent = {
    _useConpty: true, _useConptyDll: true, _ptyNative: conpty, _pty: 77, innerPid: 12345,
    exitCode: undefined,
    kill() {
      calls.kill++;
      if (nativeError) throw Error('Uncertain native close');
      if (!delayedExit) this.exitCode = 1;
    },
    inSocket: { destroy() { step('input'); } },
    outSocket: { destroy() { step('output'); } },
    _conoutSocketWorker: {
      _drainTimeout: { close() { calls.timerClose++; } },
      _worker: { async terminate() { step('worker'); if (workerGate) await workerGate.promise; return 0; } },
    },
  };
  const terminal = {
    pid: 12345, _agent: agent,
    // remote arrays are snapshots; only assignment changes the host reference.
    get _deferreds() { return [...queued]; },
    set _deferreds(value) { queued = [...value]; },
    kill() { calls.publicKill++; throw Error('WindowsTerminal.kill must never be used'); },
    write() { calls.writes++; }, resize() { calls.resizes++; },
    onData(listener) { dataListeners.add(listener); return { dispose() { dataListeners.delete(listener); } }; },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled.outputText, {
    module, conpty, path: path.win32,
    backend: { spawn(file, args, options) {
      assert.equal(file, 'node.exe'); assert.equal(args.length, 0);
      assert.equal(options.useConpty, true); assert.equal(options.useConptyDll, true);
      return terminal;
    } },
    process: { pid: 999, kill() { assert.fail('PID-based kills are forbidden'); } },
    console: { error: (...args) => errors.push(args) },
    require(id) { assert.fail(`Unexpected dependency (no network/native I/O allowed): ${id}`); },
    setTimeout: time.setTimeout, clearTimeout: time.clearTimeout,
    setInterval: time.setInterval, clearInterval: time.clearInterval,
  }, { filename: 'terminal-pty.spawn.vm.js', timeout: 1000 });
  const pty = module.exports.spawn('node.exe', [], {
    cwd: 'C:\\Synthetic', env: { SystemRoot: 'C:\\Windows' }, cols: 80, rows: 24, name: 'xterm',
  });
  pty.onExit(event => exits.push(event));
  const subscription = pty.onData(() => { calls.data++; });
  t.after(() => { subscription.dispose(); time.timers.clear(); });
  return { pty, agent, terminal, time, calls, errors, exits,
    queued: () => queued.length,
    emitData(data) { for (const listener of dataListeners) listener(data); },
    assertClean() {
      assert.equal(time.timers.size, 0, 'No pending observation/deadline/drain timers');
      assert.equal(calls.publicKill, 0); assert.equal(exits.length, 1);
    },
  };
}

test('no-data kill closes the owned agent without waiting for public readiness', async t => {
  const h = harness(t);
  const stopping = h.pty.kill();
  assert.strictEqual(h.pty.kill(), stopping, 'Concurrent callers share the current attempt');
  assert.equal(h.calls.kill, 1); assert.equal(h.queued(), 0);
  assert.equal(h.calls.data, 0); assert.equal(h.exits.length, 0);
  h.pty.write('ignored'); h.pty.resize(90, 30);
  assert.equal(h.calls.writes, 0); assert.equal(h.calls.resizes, 0);
  await stopping;
  assert.equal(h.exits[0].exitCode, 1); assert.equal(h.calls.worker, 1);
  await h.pty.kill();
  assert.equal(h.calls.kill, 1); assert.equal(h.calls.data, 0);
  h.assertClean();
});

test('worker termination rejection allows explicit cleanup retry without repeating closed sockets', async t => {
  const h = harness(t, { failAt: 'worker' });
  const first = h.pty.kill();
  await assert.rejects(first, /salida nativa confirmada.*cleanup/);
  assert.equal(h.exits.length, 0); assert.equal(h.errors.length, 1);
  assert.equal(h.time.intervals(), 0, 'Native exit was already confirmed');
  await h.time.advance(10000);
  assert.equal(h.calls.worker, 1, 'No automatic cleanup retry');
  const retry = h.pty.kill();
  assert.notStrictEqual(retry, first);
  await retry;
  assert.equal(h.calls.kill, 1); assert.equal(h.calls.input, 1);
  assert.equal(h.calls.output, 1); assert.equal(h.calls.worker, 2);
  h.assertClean();
});

test('socket failures retry only pending resources and never repeat a successful socket close', async t => {
  for (const resource of ['input', 'output']) {
    const h = harness(t, { failAt: resource });
    await assert.rejects(h.pty.kill(), /cleanup/);
    assert.equal(h.exits.length, 0);
    assert.equal(h.calls.worker, 0, 'Do not discard the draining worker before socket cleanup succeeds');
    const snapshot = { ...h.calls };
    await h.time.advance(10000);
    assert.deepEqual(h.calls, snapshot, 'Retry requires a new explicit kill call');
    await h.pty.kill();
    assert.equal(h.calls.kill, 1);
    assert.equal(h.calls.input, resource === 'input' ? 2 : 1);
    assert.equal(h.calls.output, resource === 'output' ? 2 : 1);
    assert.equal(h.calls.worker, 1);
    h.assertClean();
  }
});

test('silent native exit drains for 1000 ms and permits cleanup retry without any native close', async t => {
  const h = harness(t, { failAt: 'worker' });
  h.agent.exitCode = 7;
  await h.time.advance(25);
  assert.equal(h.time.intervals(), 0);
  await h.time.advance(999);
  assert.equal(h.calls.input, 0); assert.equal(h.exits.length, 0);
  await h.time.advance(1);
  assert.equal(h.calls.worker, 1); assert.equal(h.errors.length, 1);
  assert.equal(h.calls.kill, 0); assert.equal(h.exits.length, 0);
  await h.time.advance(10000);
  assert.equal(h.calls.worker, 1);
  await h.pty.kill();
  assert.equal(h.exits[0].exitCode, 7); assert.equal(h.calls.kill, 0);
  assert.equal(h.calls.input, 1); assert.equal(h.calls.output, 1);
  assert.equal(h.calls.worker, 2); assert.equal(h.calls.data, 0);
  h.assertClean();
});

test('timeouts and uncertain native errors permit explicit waiting retries without a second agent.kill', async t => {
  const h = harness(t, { delayedExit: true });
  const first = h.pty.kill();
  const rejected = assert.rejects(first, /5 s/);
  await h.time.advance(5000); await rejected;
  assert.equal(h.time.intervals(), 1, 'Timeout must retain native observation');
  assert.equal(h.calls.input, 0); assert.equal(h.exits.length, 0);
  const retry = h.pty.kill();
  assert.notStrictEqual(retry, first); assert.equal(h.calls.kill, 1);
  h.agent.exitCode = 1;
  await h.time.advance(25); await retry;
  h.assertClean();

  const gate = deferred(), pending = harness(t, { workerGate: gate });
  const attempt = pending.pty.kill();
  const timedOut = assert.rejects(attempt, /5 s/);
  await pending.time.advance(5000); await timedOut;
  const again = pending.pty.kill();
  assert.equal(pending.calls.worker, 1, 'Reuse an in-flight cleanup after timeout');
  gate.resolve(); await again;
  assert.equal(pending.calls.kill, 1); pending.assertClean();

  const uncertain = harness(t, { nativeError: true });
  await assert.rejects(uncertain.pty.kill(), /parada no confirmada/);
  assert.equal(uncertain.time.intervals(), 1);
  const waiting = uncertain.pty.kill();
  assert.equal(uncertain.calls.kill, 1, 'Do not repeat a native effect whose outcome is uncertain');
  uncertain.agent.exitCode = 1;
  await uncertain.time.advance(25); await waiting;
  uncertain.assertClean();
});

test('onExit fires exactly once after both native confirmation and completed worker cleanup', async t => {
  const gate = deferred(), h = harness(t, { delayedExit: true, workerGate: gate });
  let delivered = 0, disposed = 0;
  h.pty.onExit(() => { throw Error('Listener failure must not prevent another listener'); });
  h.pty.onExit(() => { delivered++; });
  h.pty.onExit(() => { disposed++; }).dispose();
  let settled = false;
  const stopping = h.pty.kill().then(() => { settled = true; });
  await h.time.advance(25);
  assert.equal(h.calls.worker, 0); assert.equal(h.exits.length, 0);
  h.agent.exitCode = 1;
  await h.time.advance(25);
  assert.equal(h.calls.worker, 1); assert.equal(settled, false);
  assert.equal(h.exits.length, 0); assert.equal(delivered, 0);
  gate.resolve(); await stopping;
  assert.equal(settled, true); assert.equal(delivered, 1); assert.equal(disposed, 0);
  assert.equal(h.errors.length, 1);
  await h.pty.kill(); await h.time.advance(10000);
  assert.equal(delivered, 1); assert.equal(h.calls.worker, 1);
  h.assertClean();
});

test('remote reference shapes require pinned native identity and reject unsafe handles before shutdown', async t => {
  const cases = [
    ['_useConpty', false], ['_useConptyDll', false], ['_ptyNative', {}],
    ['_pty', 0], ['_pty', 1.5], ['innerPid', 54321], ['kill', undefined],
  ];
  for (const [key, value] of cases) {
    const h = harness(t), original = h.agent[key];
    h.agent[key] = value;
    await assert.rejects(h.pty.kill(), /contrato privado.*ningun PID/);
    assert.equal(h.calls.kill, 0); assert.equal(h.calls.input, 0);
    assert.equal(h.calls.worker, 0); assert.equal(h.exits.length, 0);
    assert.equal(h.time.intervals(), 1);
    h.agent[key] = original;
    await h.pty.kill(); h.assertClean();
  }
  const h = harness(t), worker = h.agent._conoutSocketWorker._worker;
  h.agent._conoutSocketWorker._worker = {};
  await assert.rejects(h.pty.kill(), /contrato privado/);
  assert.equal(h.calls.kill, 0);
  h.agent._conoutSocketWorker._worker = worker;
  assert.equal(h.queued(), 1);
  await h.pty.kill();
  assert.equal(h.queued(), 0, 'Remote deferred arrays must be replaced, not mutated as local copies');
  assert.equal(h.calls.timerClose, 1, 'Close the timer through its host method');
  h.assertClean();
});
