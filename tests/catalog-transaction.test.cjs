const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');

const bundle = buildSync({ entryPoints: [path.join(__dirname, '../catalog-transaction.ts')], bundle: true,
  platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
const file = path.join(__dirname, 'synthetic-catalog.json');
const tick = () => new Promise(resolve => setImmediate(resolve));
const gate = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function harness() {
  const module = { exports: {} };
  vm.runInNewContext(bundle, { module, exports: module.exports, process, require(id) {
    assert.ok(!/^(node:)?async_hooks$/.test(id), 'Renderer transactions must not load async_hooks');
    return require(id);
  } });
  return module.exports.catalogTransaction;
}

test('desktop bundle does not load Node async context tracking', () => {
  const source = require('node:fs').readFileSync(path.join(__dirname, '../main.js'), 'utf8');
  assert.doesNotMatch(source, /require\(["'](?:node:)?async_hooks["']\)/);
});

test('explicit nested saves survive awaits while unrelated saves remain queued', async () => {
  const transaction = harness(), entered = gate(), finish = gate(), events = [];
  const first = transaction(file, async owner => {
    events.push('first'); entered.resolve(); await finish.promise;
    await transaction(file, async nested => { assert.equal(nested, owner); events.push('nested'); await tick(); }, owner);
    events.push('published');
  });
  await entered.promise;
  const second = transaction(file, async () => { events.push('second'); });
  await tick(); assert.deepEqual(events, ['first']);
  finish.resolve(); await Promise.all([first, second]);
  assert.deepEqual(events, ['first', 'nested', 'published', 'second']);
});

test('unrelated catalogs can proceed and foreign, forged and expired ownership is rejected', async () => {
  const transaction = harness(); let expired;
  await transaction(file, async owner => {
    expired = owner;
    await assert.rejects(transaction(file + '.other', async () => {}, owner), /Invalid or expired/);
    await assert.rejects(transaction(file, async () => {}, {}), /Invalid or expired/);
    await transaction(file + '.other', async () => {});
  });
  await assert.rejects(transaction(file, async () => {}, expired), /Invalid or expired/);
});

test('failure releases the queue and invalidates ownership without losing the next save', async () => {
  const transaction = harness(); let expired;
  const first = transaction(file, async owner => { expired = owner; await tick(); throw Error('Disk unavailable'); });
  const second = transaction(file, async () => 42);
  await assert.rejects(first, /Disk unavailable/);
  assert.equal(await second, 42);
  await assert.rejects(transaction(file, async () => {}, expired), /Invalid or expired/);
});
