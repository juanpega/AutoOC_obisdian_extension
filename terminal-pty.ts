/**
 * Soporte PTY opt-in, independiente del bundle y de CodeSpace.
 * Origen MIT: https://github.com/microsoft/node-pty (paquete npm oficial).
 * No ejecutar npm install: los prebuilds Node-API ya estan en el tarball.
 * La UI debe pedir consentimiento antes de installTerminalSupport(), y matar
 * sus PTY al cerrar vistas/descargar el plugin. No es un sandbox de comandos.
 */
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { get } from 'node:https';
import { createRequire } from 'node:module';
import { release } from 'node:os';
import * as path from 'node:path';
import { gunzip } from 'node:zlib';
import type { Socket } from 'node:net';
import type { Worker } from 'node:worker_threads';
import { createPosixTerminalBackend } from './terminal-pty-posix';

export interface IDisposable { dispose(): void; }

export interface Pty {
    readonly pid: number;
    write(data: string): void;
    resize(cols: number, rows: number): void;
    /** Confirma salida nativa y cleanup en 5 s; tras rechazo permite reintentar solo lo pendiente. */
    kill(): Promise<void>;
    onData(listener: (data: string) => void): IDisposable;
    onExit(listener: (event: { exitCode: number; signal?: number }) => void): IDisposable;
}

export interface TerminalPtyOptions {
    cwd: string;
    env: Record<string, string>;
    cols: number;
    rows: number;
    name: string;
}

export interface TerminalPty {
    spawn(file: string, args: string[], options: TerminalPtyOptions): Pty;
}

/**
 * Adaptador PRIVADO exclusivamente para el tarball fijado node-pty 1.1.0.
 * WindowsTerminal.kill/_deferreds esperan el primer data, no solo conexion.
 * WindowsPtyAgent.kill con DLL cierra por el handle HPCON/hShell propio (no PID),
 * pero su cleanup del worker tambien espera data. No actualizar el pin sin
 * volver a verificar kill antes de data, salida natural silenciosa y workers.
 */
interface WindowsPty110 {
    readonly pid: number;
    write(data: string): void;
    resize(cols: number, rows: number): void;
    onData(listener: (data: string) => void): IDisposable;
    _deferreds: unknown[];
    _agent: {
        _useConpty: boolean;
        _useConptyDll: boolean;
        _ptyNative: unknown;
        _pty: number;
        readonly innerPid: number;
        readonly exitCode: number | undefined;
        kill(): void;
        readonly inSocket: Socket;
        readonly outSocket: Socket;
        _conoutSocketWorker: {
            _worker: Worker;
            _drainTimeout?: { close(): unknown };
        };
    };
}

// Pin de confianza del codigo, NO obtenido del registro durante la instalacion.
export const TERMINAL_SUPPORT = Object.freeze({
    package: 'node-pty',
    version: '1.1.0',
    license: 'MIT',
    url: 'https://registry.npmjs.org/node-pty/-/node-pty-1.1.0.tgz',
    integrity: 'sha512-20JqtutY6JPXTUnL0ij1uad7Qe1baT46lyolh2sSENDd4sTzKZ4nmAFkeAARDKwmlLjPx6XKRlwRUxwjOy+lUg==',
});

// Both Darwin architectures are shipped together: Obsidian and the independent
// Node host can have different architectures when Rosetta is in use.
function supportDirectory(): string {
    return process.platform === 'darwin' ? 'node-pty-1.1.0-darwin' : 'node-pty-1.1.0-win32-x64';
}
const DARWIN_FILES = ['darwin-arm64', 'darwin-x64'].flatMap(host =>
    [`prebuilds/${host}/pty.node`, `prebuilds/${host}/spawn-helper`]);
const ARCHIVE = 'source.tgz';
const MAX_DOWNLOAD = 48 * 1024 * 1024;
const MAX_UNPACKED = 96 * 1024 * 1024;

function supportedHost(): void {
    if (!(process.platform === 'win32' && process.arch === 'x64') &&
        !(process.platform === 'darwin' && ['x64', 'arm64'].includes(process.arch))) {
        throw new Error(`Terminal PTY: soporta Windows x64 y macOS Intel/Apple Silicon; host ${process.platform}/${process.arch}. No se descargara ni compilara otro binario.`);
    }
    const version = release().split('.').map(Number);
    // node-pty 1.1.0 usa este umbral para seleccionar ConPTY, incluso con useConpty.
    if (process.platform === 'win32' && (version[0] < 10 || !Number.isFinite(version[2]) || version[2] < 18309)) {
        throw new Error(`Terminal PTY: se requiere Windows build 18309 o posterior (recomendado Windows 10 1903+/11); actual ${release()}.`);
    }
    if (Number(process.versions.napi || 0) < 8) {
        throw new Error('Terminal PTY: se requiere Node-API >= 8. Actualiza el instalador de Obsidian/Electron, no solo la aplicacion.');
    }
}

async function directoryWithoutLink(directory: string): Promise<void> {
    const stat = await fs.lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new Error(`Terminal PTY: se esperaba un directorio real sin enlaces: ${directory}`);
    }
}

async function supportRoot(pluginDirectory: string, create: boolean): Promise<string> {
    supportedHost();
    if (!path.isAbsolute(pluginDirectory)) throw new Error('Terminal PTY: pluginDirectory debe ser una ruta absoluta.');
    // Permite una boveda enlazada, pero ancla el soporte a su destino real.
    const plugin = await fs.realpath(pluginDirectory);
    await directoryWithoutLink(plugin);
    const root = path.join(plugin, 'terminal-support');
    if (create) await fs.mkdir(root).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'EEXIST') throw error;
    });
    try {
        await directoryWithoutLink(root);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error('Terminal PTY: soporte no instalado. Usa el boton opt-in que llama installTerminalSupport(pluginDirectory).');
        }
        throw error;
    }
    return root;
}

function download(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const request = get(TERMINAL_SUPPORT.url, { headers: { 'User-Agent': 'AutoOC-terminal-support' } }, response => {
            if (response.statusCode !== 200) {
                response.resume();
                request.destroy(new Error(`Terminal PTY: npm respondio HTTP ${response.statusCode}; no se permiten redirecciones.`));
                return;
            }
            const chunks: Buffer[] = [];
            let size = 0;
            response.on('data', (chunk: Buffer) => {
                size += chunk.length;
                if (size > MAX_DOWNLOAD) request.destroy(new Error('Terminal PTY: descarga demasiado grande.'));
                else chunks.push(chunk);
            });
            response.on('error', reject);
            response.on('aborted', () => reject(new Error('Terminal PTY: descarga interrumpida.')));
            response.on('end', () => resolve(Buffer.concat(chunks)));
        });
        const timer = setTimeout(() => request.destroy(new Error('Terminal PTY: timeout de descarga (120 s). Comprueba acceso HTTPS a registry.npmjs.org.')), 120_000);
        request.on('error', reject);
        request.on('close', () => clearTimeout(timer));
    });
}

/** Parser deliberadamente restringido al tar npm fijado: solo ficheros regulares. */
async function contents(archive: Buffer): Promise<Map<string, Buffer>> {
    if (archive.length > MAX_DOWNLOAD ||
        `sha512-${createHash('sha512').update(archive).digest('base64')}` !== TERMINAL_SUPPORT.integrity) {
        throw new Error('Terminal PTY: integridad SHA-512 del paquete incorrecta; no se ejecutara su contenido.');
    }
    const tar = await new Promise<Buffer>((resolve, reject) => {
        gunzip(archive, { maxOutputLength: MAX_UNPACKED }, (error, data) => error ? reject(error) : resolve(data));
    });
    const result = new Map<string, Buffer>();
    const field = (header: Buffer, start: number, end: number) => header.subarray(start, end).toString('utf8').split('\0')[0];
    for (let offset = 0; offset + 512 <= tar.length;) {
        const header = tar.subarray(offset, offset + 512);
        if (header.every(byte => byte === 0)) break;
        const name = field(header, 0, 100);
        const sizeText = field(header, 124, 136).trim();
        const checksumText = field(header, 148, 156).trim();
        let checksum = 0;
        for (let i = 0; i < 512; i++) checksum += i >= 148 && i < 156 ? 32 : header[i];
        const size = parseInt(sizeText, 8);
        if (!/^[0-7]+$/.test(sizeText) || !/^[0-7]+$/.test(checksumText) ||
            checksum !== parseInt(checksumText, 8) || header[156] !== 48 ||
            field(header, 345, 500) || !name.startsWith('package/') ||
            !/^package\/[a-zA-Z0-9_./-]+$/.test(name) ||
            name.split('/').some(part => !part || part === '.' || part === '..') ||
            offset + 512 + size > tar.length) {
            throw new Error('Terminal PTY: formato tar no admitido; no se extraeran enlaces ni rutas arbitrarias.');
        }
        const relative = name.slice('package/'.length);
        const selected = relative === 'package.json' || relative === 'LICENSE' ||
            (relative.startsWith('lib/') && relative.endsWith('.js') && !relative.endsWith('.test.js')) ||
            (process.platform === 'darwin' ? DARWIN_FILES.includes(relative) :
            relative === 'deps/winpty/LICENSE' ||
            relative === 'prebuilds/win32-x64/conpty.node' ||
            relative === 'prebuilds/win32-x64/conpty_console_list.node' ||
            relative.startsWith('prebuilds/win32-x64/conpty/'));
        if (selected) {
            if (result.has(relative)) throw new Error('Terminal PTY: entrada duplicada en tar.');
            result.set(relative, tar.subarray(offset + 512, offset + 512 + size));
        }
        offset += 512 + Math.ceil(size / 512) * 512;
    }
    for (const required of ['package.json', 'LICENSE', 'lib/index.js', ...(process.platform === 'darwin'
        ? ['lib/unixTerminal.js', ...DARWIN_FILES] : ['lib/worker/conoutSocketWorker.js',
        'prebuilds/win32-x64/conpty.node', 'prebuilds/win32-x64/conpty/conpty.dll',
        'prebuilds/win32-x64/conpty/OpenConsole.exe'])]) {
        if (!result.has(required)) throw new Error(`Terminal PTY: paquete incompleto, falta ${required}.`);
    }
    const metadata = JSON.parse(result.get('package.json')!.toString('utf8'));
    if (metadata.name !== TERMINAL_SUPPORT.package || metadata.version !== TERMINAL_SUPPORT.version || metadata.license !== 'MIT') {
        throw new Error('Terminal PTY: identidad/licencia del paquete inesperada.');
    }
    return result;
}

async function readRegular(file: string, maxSize: number): Promise<Buffer> {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxSize) {
        throw new Error(`Terminal PTY: fichero no admitido: ${file}`);
    }
    return fs.readFile(file);
}

async function verify(directory: string): Promise<void> {
    await directoryWithoutLink(directory);
    const files = await contents(await readRegular(path.join(directory, ARCHIVE), MAX_DOWNLOAD));
    // Rechaza extras (incluidos build/Release y node_modules) que podrian desviar require().
    const directories = new Set<string>();
    for (const name of files.keys()) {
        let parent = path.posix.dirname(name);
        while (parent !== '.') {
            directories.add(parent);
            parent = path.posix.dirname(parent);
        }
    }
    async function walk(relative: string): Promise<void> {
        for (const entry of await fs.readdir(path.join(directory, relative), { withFileTypes: true })) {
            const name = relative ? `${relative}/${entry.name}` : entry.name;
            if (entry.isSymbolicLink()) throw new Error(`Terminal PTY: enlace no admitido: ${name}`);
            if (entry.isDirectory() && directories.has(name)) await walk(name);
            else if (entry.isFile() && (files.has(name) || name === ARCHIVE)) continue;
            else throw new Error(`Terminal PTY: contenido inesperado: ${name}. No se reparara ni borrara automaticamente.`);
        }
    }
    await walk('');
    for (const [name, expected] of files) {
        const actual = await readRegular(path.join(directory, name), expected.length);
        if (!actual.equals(expected)) throw new Error(`Terminal PTY: fichero alterado: ${name}. Restaura el soporte original y reinicia Obsidian.`);
        if (process.platform === 'darwin' && name.endsWith('/spawn-helper') &&
            !((await fs.lstat(path.join(directory, name))).mode & 0o111)) {
            throw new Error(`Terminal PTY: falta permiso de ejecucion en ${name}. Revisa los permisos del soporte instalado.`);
        }
    }
}

/** Solo llamar desde una accion humana explicita; nunca desde load/onload. */
export async function installTerminalSupport(pluginDirectory: string): Promise<void> {
    const root = await supportRoot(pluginDirectory, true);
    const target = path.join(root, supportDirectory());
    try {
        await fs.lstat(target);
        await verify(target);
        return;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        // ENOENT interno no autoriza sustituir una instalacion incompleta.
        try {
            await fs.lstat(target);
            throw new Error('Terminal PTY: instalacion incompleta. Conservala para diagnostico; no se sobrescribira.');
        } catch (check) {
            if ((check as NodeJS.ErrnoException).code !== 'ENOENT') throw check;
        }
    }
    const archive = await download();
    const files = await contents(archive);
    const staging = await fs.mkdtemp(path.join(root, '.install-'));
    try {
        for (const [name, data] of files) {
            const destination = path.join(staging, name);
            await fs.mkdir(path.dirname(destination), { recursive: true });
            await fs.writeFile(destination, data, { flag: 'wx' });
            // The pinned 1.1.0 tarball ships Darwin helpers as 0644. Only these
            // two verified files need execution permission; never run npm scripts.
            if (process.platform === 'darwin' && name.endsWith('/spawn-helper')) await fs.chmod(destination, 0o755);
        }
        await fs.writeFile(path.join(staging, ARCHIVE), archive, { flag: 'wx' });
        await verify(staging);
        try {
            await fs.rename(staging, target);
        } catch (error) {
            if (!['EEXIST', 'ENOTEMPTY', 'EPERM'].includes((error as NodeJS.ErrnoException).code || '')) throw error;
            // Otra llamada pudo publicar exactamente el mismo soporte mientras descargabamos.
            await verify(target);
        }
    } finally {
        // Solo elimina el staging privado de esta llamada; nunca soporte instalado/ajeno.
        await fs.rm(staging, { recursive: true, force: true });
    }
}

/** Preflight local sin cargar modulos nativos ni crear procesos. */
export async function verifyTerminalSupport(pluginDirectory: string): Promise<string> {
    const root = await supportRoot(pluginDirectory, false);
    const directory = path.join(root, supportDirectory());
    try {
        await verify(directory);
    } catch (error) {
        throw new Error(`Terminal PTY: soporte ausente, incompleto o alterado. Usa la instalacion opt-in si no existe; no se reparara automaticamente. ${String(error)}`);
    }
    return directory;
}

/** Carga local y offline. No descarga, instala, compila ni inicia una shell. */
export async function loadTerminalPty(pluginDirectory: string): Promise<TerminalPty> {
    const directory = await verifyTerminalSupport(pluginDirectory);
    // createRequire evita que esbuild integre JS nativo/workers o resuelva otro node-pty.
    let nativeRequire: (id: string) => any = createRequire(path.join(directory, 'package.json'));
    if ((process as NodeJS.Process & { type?: string }).type === 'renderer') {
        // Electron renderer no admite worker_threads.Worker. Usar SOLO el puente
        // ya proporcionado por Obsidian; no instalar/habilitar remote ni hacer eval.
        try {
            const obsidianRequire = (window as Window & { require?: (id: string) => any }).require;
            const remote = obsidianRequire?.('electron')?.remote;
            if (typeof remote?.require !== 'function') throw new Error('electron.remote.require no disponible');
            nativeRequire = remote.require('node:module').createRequire(path.join(directory, 'package.json'));
        } catch (error) {
            throw new Error(`Terminal PTY: el renderer requiere el puente electron.remote de Obsidian para ejecutar node-pty/workers en main. No se creara ningun PTY ni se habilitaran permisos nuevos. ${String(error)}`);
        }
    }
    if (process.platform === 'darwin') {
        try {
            nativeRequire(path.join(directory, `prebuilds/darwin-${process.arch}/pty.node`));
            return createPosixTerminalBackend(nativeRequire(path.join(directory, 'lib/index.js')));
        } catch (error) {
            throw new Error(`Terminal PTY: no se pudo cargar el soporte macOS ${process.arch} (Node ${process.versions.node}, N-API ${process.versions.napi}). Comprueba Node.js 18+ y los permisos de spawn-helper. No se intentara node-gyp. ${String(error)}`);
        }
    }
    let conpty: unknown;
    let backend: { spawn(file: string, args: string[], options: TerminalPtyOptions & { useConpty: boolean; useConptyDll: boolean }): WindowsPty110 };
    try {
        conpty = nativeRequire(path.join(directory, 'prebuilds/win32-x64/conpty.node'));
        backend = nativeRequire(path.join(directory, 'lib/index.js'));
        if (typeof backend.spawn !== 'function') throw new Error('Falta spawn en node-pty.');
    } catch (error) {
        throw new Error(`Terminal PTY: no se pudo cargar el prebuild Node-API Windows x64 (Electron ${process.versions.electron || 'no disponible'}, Node ${process.versions.node}, N-API ${process.versions.napi}). Comprueba el instalador de Obsidian y el runtime Microsoft Visual C++ 2015-2022 x64; no se intentara node-gyp. ${String(error)}`);
    }
    return {
        spawn(file, args, options) {
            if (!file || file.includes('\0') || !Array.isArray(args) || args.some(arg => typeof arg !== 'string' || arg.includes('\0'))) {
                throw new Error('Terminal PTY: ejecutable/argumentos invalidos; usa un ejecutable real, no un archivo .cmd como shell.');
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
            if (Object.entries(env).some(([key, value]) => !key || key.includes('=') || key.includes('\0') || typeof value !== 'string' || value.includes('\0')) ||
                !Object.keys(env).some(key => key.toLowerCase() === 'systemroot' && env[key])) {
                throw new Error('Terminal PTY: env debe contener solo strings validos e incluir SystemRoot (necesario para PowerShell). No se hereda process.env implicitamente.');
            }
            let terminal: WindowsPty110;
            try {
                // ConPTY distribuido evita child_process.fork con Obsidian.exe como Node.
                terminal = backend.spawn(file, [...args], { ...options, env, useConpty: true, useConptyDll: true });
            } catch (error) {
                throw new Error(`Terminal PTY: no se pudo iniciar el proceso. Comprueba ejecutable, cwd y permisos. ${String(error)}`);
            }
            const agent = terminal._agent;
            const listeners = new Set<(event: { exitCode: number; signal?: number }) => void>();
            let stopping = false;
            let exited = false;
            let nativeExitCode: number | undefined;
            let shutdownRequested = false;
            let inputClosed = false;
            let outputClosed = false;
            let stop: Promise<void> | undefined;
            let cleanup: Promise<void> | undefined;
            let resolveStop: (() => void) | undefined;
            let rejectStop: ((error: Error) => void) | undefined;
            let deadline: ReturnType<typeof setTimeout> | undefined;
            let drain: ReturnType<typeof setTimeout> | undefined;
            // exitCode solo se escribe en _$onProcessExit, desde el callback nativo
            // que espera el HANDLE del proceso. Nunca inferir salida por kill/PID/socket.
            const finish = (exitCode: number) => {
                if (cleanup || exited) return;
                nativeExitCode = exitCode;
                clearInterval(observe);
                if (drain) clearTimeout(drain);
                cleanup = (async () => {
                    // Reasignar: a traves de remote las arrays se reciben por copia.
                    terminal._deferreds = [];
                    if (!inputClosed) { agent.inSocket.destroy(); inputClosed = true; }
                    if (!outputClosed) { agent.outSocket.destroy(); outputClosed = true; }
                    // No esperar data ni dispose(): termina el worker de ESTA instancia.
                    const connection = agent._conoutSocketWorker;
                    // close() se ejecuta en el host del timer, tambien via remote.
                    connection._drainTimeout?.close();
                    await connection._worker.terminate();
                    exited = true;
                })();
                void cleanup.then(() => {
                    if (deadline) clearTimeout(deadline);
                    resolveStop?.();
                    // Notifica una sola vez y solo despues de confirmacion nativa/cleanup.
                    const current = [...listeners];
                    listeners.clear();
                    for (const listener of current) {
                        try { listener({ exitCode }); }
                        catch (error) { console.error('Terminal PTY: error en onExit.', error); }
                    }
                }, error => {
                    // Salida nativa sigue confirmada. Solo una nueva llamada a kill
                    // reintentara el cleanup fallido, nunca el cierre ConPTY.
                    cleanup = undefined;
                    if (deadline) clearTimeout(deadline);
                    const failure = new Error(`Terminal PTY: salida nativa confirmada, pero fallo el cleanup de sockets/worker: ${String(error)}`);
                    rejectStop?.(failure);
                    console.error(failure);
                });
            };
            const observeExit = () => {
                const code = agent.exitCode;
                if (typeof code !== 'number' || !Number.isFinite(code) || nativeExitCode !== undefined) return;
                nativeExitCode = code;
                clearInterval(observe);
                if (stopping) finish(code);
                // En salida natural deja drenar la salida como upstream (1000 ms),
                // incluso si nunca llega data/close al socket del renderer.
                else if (!drain) drain = setTimeout(() => finish(code), 1000);
            };
            const observe = setInterval(observeExit, 25);
            return {
                get pid() { return terminal.pid; },
                write(data) { if (!stopping && nativeExitCode === undefined) terminal.write(data); },
                resize(cols, rows) { dimensions(cols, rows); if (!stopping && nativeExitCode === undefined) terminal.resize(cols, rows); },
                kill() {
                    if (exited) return Promise.resolve();
                    if (stop) return stop;
                    stop = new Promise<void>((resolve, reject) => { resolveStop = resolve; rejectStop = reject; });
                    const attempt = stop;
                    // Compartir intentos en curso, pero no memorizar un rechazo para siempre.
                    void attempt.catch(() => { if (stop === attempt) stop = undefined; });
                    deadline = setTimeout(() => rejectStop!(new Error('Terminal PTY: parada no confirmada en 5 s. Se conserva la observacion del proceso propio; no asumir que termino ni matar por PID.')), 5000);
                    if (nativeExitCode !== undefined) {
                        finish(nativeExitCode);
                        return attempt;
                    }
                    // Validar la identidad del adaptador; nunca caer en kill por PID ni
                    // WindowsTerminal.kill como fallback si cambia la forma privada.
                    if (!agent || agent._useConpty !== true || agent._useConptyDll !== true ||
                        agent._ptyNative !== conpty || !Number.isInteger(agent._pty) || agent._pty <= 0 ||
                        agent.innerPid !== terminal.pid || terminal.pid <= 0 || terminal.pid === process.pid ||
                        typeof agent.kill !== 'function' || !Array.isArray(terminal._deferreds) ||
                        typeof agent._conoutSocketWorker?._worker?.terminate !== 'function') {
                        clearTimeout(deadline);
                        rejectStop!(new Error('Terminal PTY: contrato privado node-pty 1.1.0 incompatible; no se puede confirmar una parada segura. No se ha matado ningun PID.'));
                        return attempt;
                    }
                    stopping = true;
                    terminal._deferreds = [];
                    try {
                        if (!shutdownRequested && agent.exitCode === undefined) {
                            // Marcar ANTES del efecto: un error puede dejar el cierre incierto.
                            shutdownRequested = true;
                            agent.kill();
                        }
                        observeExit();
                    } catch (error) {
                        clearTimeout(deadline);
                        rejectStop!(new Error(`Terminal PTY: fallo el cierre ConPTY de la instancia propia; parada no confirmada. ${String(error)}`));
                    }
                    return attempt;
                },
                onData: listener => terminal.onData(listener),
                onExit(listener) {
                    if (!exited) listeners.add(listener);
                    return { dispose() { listeners.delete(listener); } };
                },
            };
        },
    };
}
