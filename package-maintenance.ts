import * as fs from 'fs';
import * as path from 'path';

// Package replacement never executes, reconciles or projects a stored run.
// Callers must own the installation lease and stop their own live execution
// handles first. Historical phases are not evidence of a live writer.
export function assertPackageMaintenanceSafe(directory: string): void {
  const runtime = path.join(directory, 'runtime');
  if (fs.existsSync(path.join(runtime, 'update-pending.json'))) throw new Error('Incomplete plugin update requires recovery');
  if (fs.readdirSync(directory).some(name => name === 'data.json.write-lock' || name === 'data.json.write-intent' ||
      name.startsWith('data.json.') && name.endsWith('.tmp')) ||
      fs.readdirSync(runtime).some(name => name.endsWith('.tmp') || name.endsWith('.write-lock'))) {
    throw new Error('Unfinished write requires reconciliation before package maintenance');
  }
}
