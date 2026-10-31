const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');

function resolver(platform, env, files, directories = []) {
  const source = fs.readFileSync(path.join(__dirname, '../cli-launchers.ts'), 'utf8').match(/export function resolveOpencodeBin[\s\S]*?\n}/)[0];
  const compiled = ts.transpileModule(source.replace('export ', ''), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const probes = [];
  const resolve = vm.runInNewContext(compiled + '; resolveOpencodeBin', {
    path: platform === 'win32' ? path.win32 : path.posix,
    os: { platform: () => platform }, process: { env },
    require: id => { assert.equal(id, 'fs'); return { constants: { X_OK: 1 },
      accessSync(file) { probes.push(file); if (!files.includes(file) && !directories.includes(file)) throw Error('missing'); },
      statSync(file) { return { isFile: () => files.includes(file) }; },
    }; },
  });
  return { resolve, probes };
}

test('Windows uses the active PATH installation before an obsolete npm fallback', () => {
  const current = 'C:\\ProgramData\\chocolatey\\bin\\opencode.exe', old = 'C:\\User\\AppData\\npm\\opencode.cmd';
  const h = resolver('win32', { PATH: 'C:\\ProgramData\\chocolatey\\bin;C:\\User\\AppData\\npm', APPDATA: 'C:\\User\\AppData' }, [current, old]);
  assert.equal(h.resolve('opencode'), current);
  assert.equal(h.resolve('C:\\Explicit\\opencode.cmd'), 'C:\\Explicit\\opencode.cmd');
});

test('PATH order, quoted directories and explicit settings remain authoritative', () => {
  const first = 'C:\\CLI One\\opencode.cmd', second = 'C:\\CLI Two\\opencode.exe';
  const h = resolver('win32', { Path: '"C:\\CLI One";C:\\CLI Two', APPDATA: 'C:\\User\\AppData' }, [first, second]);
  assert.equal(h.resolve('opencode'), first);
  assert.equal(h.resolve('custom-command'), 'custom-command');
});

test('GUI fallback still works and does not search relative or empty PATH entries', () => {
  const fallback = 'C:\\User\\AppData\\npm\\opencode.cmd';
  const h = resolver('win32', { PATH: '.;;relative;C:\\empty', APPDATA: 'C:\\User\\AppData' }, [fallback]);
  assert.equal(h.resolve(''), fallback);
  assert.ok(h.probes.every(file => path.win32.isAbsolute(file)));
  assert.equal(resolver('win32', { PATH: '', APPDATA: 'C:\\missing' }, []).resolve('opencode'), 'opencode');
});

test('POSIX respects executable PATH entries, skips directories, and retains GUI fallbacks', () => {
  const h = resolver('linux', { PATH: '/first:/second', HOME: '/home/user' }, ['/second/opencode', '/home/user/.bun/bin/opencode'], ['/first/opencode']);
  assert.equal(h.resolve('opencode'), '/second/opencode');
  assert.equal(resolver('darwin', { PATH: '/empty', HOME: '/home/user' }, ['/home/user/.bun/bin/opencode']).resolve('opencode'), '/home/user/.bun/bin/opencode');
});
