const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, requireDependency = () => ({})) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('require', 'module', 'exports', source)(requireDependency, module, module.exports);
  return module.exports;
}

// Load the real catalog without launching or resolving installed CLIs.
const catalog = load('interactive-cli.ts');
const openCode = load('opencode-profile.ts');
const { interactiveCliTaskArgs: args, isInteractiveCliProvider } = load('interactive-cli-profile.ts', id => {
  if (id === './interactive-cli') return catalog;
  if (id === './opencode-profile') return openCode;
  throw Error(`Unexpected dependency: ${id}`);
});
const instruction = 'Read the UTF-8 file "C:\\Task files\\request.txt"; $(literal) & do not inline it.';

test('validates providers using the interactive catalog, excluding App and background modes', () => {
  for (const { id } of catalog.INTERACTIVE_CLIS) assert.equal(isInteractiveCliProvider(id), true);
  for (const value of ['opencode1', 'codex-app', 'background', '', 'CODEX', null, undefined, {}, 1]) {
    assert.equal(isInteractiveCliProvider(value), false);
    assert.throws(() => args(value, '', '', instruction), /provider/i);
  }
});

test('reuses both OpenCode interactive profiles and preserves agent and instruction literals', () => {
  for (const [provider, major] of [['opencode', 1], ['opencode2', 2]]) {
    assert.deepEqual(args(provider, 'vendor/model', 'custom agent', instruction),
      openCode.openCodeInteractiveArgs(major, 'vendor/model', 'custom agent', instruction));
    assert.deepEqual(args(provider, '', '', instruction), [
      ...(major === 2 ? ['mini', '--standalone'] : []), '--prompt', instruction,
    ]);
    assert.deepEqual(args(provider, '', 'build', instruction), [
      ...(major === 2 ? ['mini', '--standalone'] : []), '--agent', 'build', '--prompt', instruction,
    ]);
  }
});

test('Codex and Claude use positional instructions; Copilot explicitly stays interactive', () => {
  assert.deepEqual(args('codex', 'exact-model', '', instruction), ['--model', 'exact-model', '--', instruction]);
  assert.deepEqual(args('claude', 'exact-model', '', instruction), ['--model', 'exact-model', '--', instruction]);
  assert.deepEqual(args('copilot', 'exact-model', '', instruction), ['--model', 'exact-model', '--interactive', instruction]);
  for (const provider of ['codex', 'claude', 'copilot']) {
    assert.deepEqual(args(provider, '', '', instruction),
      provider === 'copilot' ? ['--interactive', instruction] : ['--', instruction]);
    assert.throws(() => args(provider, '', 'build', instruction), /agent/i);
  }
});

test('Codex effort is an optional literal config value, never another config key or flag', () => {
  for (const effort of ['high', 'xhigh', 'custom"\nkey="value']) {
    assert.deepEqual(args('codex', '', '', instruction, effort), [
      '--config', `model_reasoning_effort=${JSON.stringify(effort)}`, '--', instruction,
    ]);
  }
  assert.deepEqual(args('codex', '', '', instruction, ''), ['--', instruction]);
  for (const provider of catalog.INTERACTIVE_CLIS.map(cli => cli.id).filter(id => id !== 'codex')) {
    assert.deepEqual(args(provider, '', '', instruction, 'high'), args(provider, '', '', instruction));
  }
});

test('argv contains only interactive selectors and literal values, with no permission overrides', () => {
  for (const { id } of catalog.INTERACTIVE_CLIS) {
    const result = args(id, '', '', instruction);
    assert.equal(result.filter(value => value === instruction).length, 1);
    assert.equal(result.some(value => /^(?:--auto|--full-auto|--dangerously|--allow-all|--yolo|--approve|--sandbox|--permission|--ask-for-approval)/.test(value)), false);
    assert.equal(result.includes('-p'), false);
  }
  for (const provider of ['codex', 'claude']) {
    assert.deepEqual(args(provider, '', '', '--dangerously-literal.txt'), ['--', '--dangerously-literal.txt']);
  }
});
