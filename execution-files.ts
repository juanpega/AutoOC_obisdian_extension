import * as fs from 'fs';
import * as path from 'path';

export type AuxiliaryKind = 'interactive' | 'runtime';
export const AUXILIARY_COMPLETION = 'autooc-cleanup.json';
const files: Record<AuxiliaryKind, string[]> = {
  interactive: ['prompt.txt', 'state.json', '.gitignore'],
  runtime: ['stdout.txt', 'stderr.txt', 'done.txt', 'process.pid', 'instruction.txt', 'input.txt', 'launch.ps1', 'launch.sh', 'launch.vbs'],
};

function directoryOnly(directory: string): void {
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('AutoOC auxiliary directory is redirected or invalid');
}

function validateDirectory(directory: string, kind: AuxiliaryKind): void {
  const root = path.dirname(directory);
  if (path.basename(root) !== 'auxiliary' || path.basename(path.dirname(root)) !== '.autooc' ||
      !new RegExp(`^${kind}-[A-Za-z0-9]{6}$`).test(path.basename(directory))) {
    throw new Error('Invalid AutoOC auxiliary directory');
  }
  for (const location of [path.dirname(root), root, directory]) directoryOnly(location);
}

export function auxiliaryCompletionRecord(directory: string, kind: AuxiliaryKind): string {
  return JSON.stringify({schemaVersion: 1, kind, directory: path.basename(directory), completed: true});
}

// Only a confirmed completion (or a failure before launch) writes this receipt.
// Time, a dead host or a directory name alone never authorize cleanup.
function cleanCompleted(directory: string, kind: AuxiliaryKind): void {
  validateDirectory(directory, kind);
  const marker = path.join(directory, AUXILIARY_COMPLETION);
  const stat = fs.lstatSync(marker);
  if (!stat.isFile() || stat.isSymbolicLink()) return;
  const receipt = JSON.parse(fs.readFileSync(marker, 'utf8').replace(/^\uFEFF/, ''));
  if (receipt.schemaVersion !== 1 || receipt.kind !== kind || receipt.directory !== path.basename(directory) || receipt.completed !== true) return;
  for (const name of files[kind]) {
    try { fs.unlinkSync(path.join(directory, name)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return; }
  }
  // Unexpected files belong to neither this cleanup nor a recursive sweep.
  if (fs.readdirSync(directory).some(name => name !== AUXILIARY_COMPLETION)) return;
  fs.unlinkSync(marker);
  fs.rmdirSync(directory);
}

export function completeAuxiliaryDirectory(directory: string, kind: AuxiliaryKind): void {
  try {
    validateDirectory(directory, kind);
    fs.writeFileSync(path.join(directory, AUXILIARY_COMPLETION), auxiliaryCompletionRecord(directory, kind), {encoding: 'utf8', flag: 'wx', mode: 0o600});
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      console.warn('AutoOC: auxiliary cleanup pending');
      return;
    }
  }
  try { cleanCompleted(directory, kind); } catch { /* Retry the completion receipt on a later launch. */ }
}

export function createAuxiliaryDirectory(cwd: string, kind: AuxiliaryKind): string {
  const container = path.join(path.resolve(cwd), '.autooc');
  const root = path.join(container, 'auxiliary');
  for (const directory of [container, root]) {
    try { fs.mkdirSync(directory, {mode: 0o700}); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    directoryOnly(directory);
  }
  // Ignore only this namespace; never rewrite project or existing AutoOC rules.
  const ignore = path.join(root, '.gitignore');
  try { fs.writeFileSync(ignore, '*\n', {encoding: 'utf8', flag: 'wx', mode: 0o600}); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const stat = fs.lstatSync(ignore);
    if (!stat.isFile() || stat.isSymbolicLink() || fs.readFileSync(ignore, 'utf8') !== '*\n') throw new Error('AutoOC auxiliary ignore rules conflict');
  }
  for (const name of fs.readdirSync(root)) {
    const previousKind = /^(interactive|runtime)-[A-Za-z0-9]{6}$/.exec(name)?.[1] as AuxiliaryKind | undefined;
    if (previousKind) {
      try { cleanCompleted(path.join(root, name), previousKind); } catch { /* Active, uncertain, redirected or unreadable: preserve. */ }
    }
  }
  return fs.mkdtempSync(path.join(root, `${kind}-`));
}
