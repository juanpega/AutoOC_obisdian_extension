import * as path from 'node:path';
import type { IDisposable, Pty, TerminalPty, TerminalPtyOptions } from './terminal-pty';

interface PosixTerminal {
    readonly pid: number;
    write(data: string): void;
    resize(cols: number, rows: number): void;
    kill(signal?: string): void;
    onData(listener: (data: string) => void): IDisposable;
    onExit(listener: (event: { exitCode: number; signal?: number }) => void): IDisposable;
    // Pinned node-pty 1.1.0: onExit follows native waitpid AND socket close.
    // Its queued writer also needs disposal after that confirmation.
    _writeStream: { dispose(): void };
}

export function createPosixTerminalBackend(backend: {
    spawn(file: string, args: string[], options: TerminalPtyOptions): PosixTerminal;
}): TerminalPty {
    if (typeof backend?.spawn !== 'function') throw new Error('Terminal PTY: falta spawn en node-pty.');
    return {
        spawn(file, args, options): Pty {
            if (!file || file.includes('\0') || !Array.isArray(args) || args.some(arg => typeof arg !== 'string' || arg.includes('\0'))) {
                throw new Error('Terminal PTY: ejecutable/argumentos invalidos.');
            }
            const dimensions = (cols: number, rows: number) => {
                if (![cols, rows].every(n => Number.isInteger(n) && n > 0 && n <= 32767)) {
                    throw new Error('Terminal PTY: cols/rows deben ser enteros entre 1 y 32767.');
                }
            };
            dimensions(options.cols, options.rows);
            if (!path.isAbsolute(options.cwd) || options.cwd.includes('\0') || !options.name || options.name.includes('\0')) {
                throw new Error('Terminal PTY: cwd absoluto y name no vacio son obligatorios.');
            }
            const env = { ...options.env };
            if (Object.entries(env).some(([key, value]) => !key || key.includes('=') || key.includes('\0') || typeof value !== 'string' || value.includes('\0'))) {
                throw new Error('Terminal PTY: env debe contener solo strings validos.');
            }
            const terminal = backend.spawn(file, [...args], { ...options, env });
            const listeners = new Set<(event: { exitCode: number; signal?: number }) => void>();
            let nativeExit: { exitCode: number; signal?: number } | undefined;
            let exited = false, stopping = false, signalSent = false;
            let cleanup: Promise<void> | undefined, stop: Promise<void> | undefined;
            let resolveStop: (() => void) | undefined, rejectStop: ((error: Error) => void) | undefined;
            let deadline: ReturnType<typeof setTimeout> | undefined;
            let exitSubscription: IDisposable;
            const finish = () => {
                if (!nativeExit || exited || cleanup) return;
                cleanup = Promise.resolve().then(() => {
                    terminal._writeStream.dispose();
                    exitSubscription.dispose();
                    exited = true;
                    if (deadline) clearTimeout(deadline);
                    resolveStop?.();
                    const event = nativeExit!;
                    const current = [...listeners]; listeners.clear();
                    for (const listener of current) {
                        try { listener(event); } catch (error) { console.error('Terminal PTY: error en onExit.', error); }
                    }
                });
                void cleanup.catch(error => {
                    cleanup = undefined;
                    if (deadline) clearTimeout(deadline);
                    const failure = new Error(`Terminal PTY: salida nativa confirmada, pero fallo el cleanup: ${String(error)}`);
                    rejectStop?.(failure);
                    console.error(failure);
                });
            };
            exitSubscription = terminal.onExit(event => {
                if (nativeExit || !Number.isFinite(event.exitCode)) return;
                nativeExit = { ...event }; finish();
            });
            return {
                get pid() { return terminal.pid; },
                write(data) { if (!stopping && !nativeExit) terminal.write(data); },
                resize(cols, rows) { dimensions(cols, rows); if (!stopping && !nativeExit) terminal.resize(cols, rows); },
                onData: listener => terminal.onData(listener),
                onExit(listener) {
                    if (!exited) listeners.add(listener);
                    return { dispose() { listeners.delete(listener); } };
                },
                kill() {
                    if (exited) return Promise.resolve();
                    if (stop) return stop;
                    stopping = true;
                    stop = new Promise<void>((resolve, reject) => { resolveStop = resolve; rejectStop = reject; });
                    const attempt = stop;
                    void attempt.catch(() => { if (stop === attempt) stop = undefined; });
                    deadline = setTimeout(() => rejectStop!(new Error('Terminal PTY: parada no confirmada en 5 s. Se conserva la observacion; no asumir que termino.')), 5000);
                    if (nativeExit) finish();
                    else if (!signalSent) {
                        // Only the owned live node-pty instance receives SIGHUP.
                        // Never repeat a signal after timeout or a native exit.
                        signalSent = true;
                        try { terminal.kill('SIGHUP'); }
                        catch (error) {
                            clearTimeout(deadline);
                            rejectStop!(new Error(`Terminal PTY: parada no confirmada: ${String(error)}`));
                        }
                    }
                    return attempt;
                },
            };
        },
    };
}
