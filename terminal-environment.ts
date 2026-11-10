import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';

/** Dock-launched macOS apps often omit Homebrew/user CLI directories from PATH.
 * Preserve explicit order, never execute a shell profile or change global env. */
export function terminalEnvironment(file: string, original: Record<string, string>): Record<string, string> {
    const env = { ...original };
    if (process.platform !== 'darwin') return env;
    const directories = (env.PATH || '').split(':').filter(entry => path.isAbsolute(entry));
    if (path.isAbsolute(file)) {
        directories.push(path.dirname(file));
        try { directories.push(path.dirname(fs.realpathSync(file))); } catch { /* Spawn reports a missing executable. */ }
    }
    const home = os.homedir();
    directories.push('/opt/homebrew/bin', '/usr/local/bin', path.join(home, '.local', 'bin'),
        path.join(home, '.npm-global', 'bin'), path.join(home, '.volta', 'bin'),
        path.join(home, '.bun', 'bin'), path.join(home, 'bin'), '/usr/bin', '/bin', '/usr/sbin', '/sbin');
    env.PATH = [...new Set(directories)].join(':');
    return env;
}
