import type { VaultMutation } from "./code-vault-mutations";

export interface CodeExecutionOptions {
  vaultBase: string;
  cwd: string;
  code: string;
  input?: unknown;
  outputs?: Record<string, string>;
  codeInputVar?: string;
  codeOutputVar?: string;
  codeAllowVault?: boolean;
  codeAllowFiles?: boolean;
  codeAllowTerminal?: boolean;
  exposePaths?: boolean;
  log?: (...args: unknown[]) => void;
  onVaultMutation?: (mutation: VaultMutation) => void;
}

// Same execution contract for tasks and steps. The caller owns status/history.
// Node vm is an execution context, not a security boundary for untrusted code.
export function executeCode(options: CodeExecutionOptions): string {
  // Keep these dependencies inside the function so the same implementation
  // can execute in a worker, without maintaining a second code interpreter.
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");
  const vm = require("vm") as typeof import("vm");
  const vaultBase = options.vaultBase;
  const defaultCwd = options.cwd;
    const resolveInVault = (p: string) => {
      const root = fs.realpathSync(vaultBase);
      const resolved = path.resolve(root, p || ".");
      if (resolved !== root && !resolved.startsWith(root + path.sep)) {
        throw new Error(`Path escapes vault: ${p}`);
      }
      // Lexical containment alone permits a junction/symlink to redirect the
      // vault capability outside its root. Inspect existing components even
      // when the final file does not exist yet. Reject dangling links too.
      let current = root;
      for (const component of path.relative(root, resolved).split(path.sep).filter(Boolean)) {
        current = path.join(current, component);
        try {
          if (fs.lstatSync(current).isSymbolicLink()) throw new Error("Linked vault paths are unsupported");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") break;
          throw error;
        }
      }
      return resolved;
    };
    const readText = (p: string) => fs.readFileSync(p, "utf8");
    const writeText = (p: string, content: any) => {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, String(content), "utf8");
      return p;
    };
    const sandbox: Record<string, any> = {
      input: options.input ?? "",
      outputs: options.outputs || {},
      String, Number, Boolean, Array, Object, JSON, Math, Date, RegExp,
      console: { log: options.log || (() => {}) },
    };
    if (options.codeAllowVault) {
      sandbox.vault = {
        basePath: vaultBase,
        resolve: (p: string) => resolveInVault(p),
        read: (p: string) => readText(resolveInVault(p)),
        write: (p: string, content: any) => {
          const full = writeText(resolveInVault(p), content);
          options.onVaultMutation?.({path: full, operation: "write"});
          return full;
        },
        append: (p: string, content: any) => {
          const full = resolveInVault(p);
          fs.mkdirSync(path.dirname(full), { recursive: true });
          fs.appendFileSync(full, String(content), "utf8");
          options.onVaultMutation?.({path: full, operation: "append"});
          return full;
        },
        exists: (p: string) => fs.existsSync(resolveInVault(p)),
        list: (p = ".") => fs.readdirSync(resolveInVault(p)),
      };
    }
    if (options.codeAllowFiles) {
      sandbox.files = {
        cwd: defaultCwd,
        resolve: (p: string) => path.isAbsolute(p) ? path.resolve(p) : path.resolve(defaultCwd, p || "."),
        read: (p: string) => readText(path.isAbsolute(p) ? path.resolve(p) : path.resolve(defaultCwd, p)),
        write: (p: string, content: any) => writeText(path.isAbsolute(p) ? path.resolve(p) : path.resolve(defaultCwd, p), content),
        append: (p: string, content: any) => {
          const full = path.isAbsolute(p) ? path.resolve(p) : path.resolve(defaultCwd, p);
          fs.mkdirSync(path.dirname(full), { recursive: true });
          fs.appendFileSync(full, String(content), "utf8");
          return full;
        },
        exists: (p: string) => fs.existsSync(path.isAbsolute(p) ? path.resolve(p) : path.resolve(defaultCwd, p)),
        list: (p = ".") => fs.readdirSync(path.isAbsolute(p) ? path.resolve(p) : path.resolve(defaultCwd, p)),
      };
    }
    if (options.codeAllowTerminal) {
      const { execSync } = require("child_process");
      sandbox.terminal = {
        run: (command: string, options: { cwd?: string; timeoutMs?: number } = {}) => execSync(String(command), {
          cwd: options.cwd ? (path.isAbsolute(options.cwd) ? options.cwd : path.resolve(defaultCwd, options.cwd)) : defaultCwd,
          timeout: Math.min(Math.max(options.timeoutMs || 30_000, 1_000), 600_000),
          encoding: "utf8",
          windowsHide: true,
        }),
      };
    }

  // Standalone code tasks historically do not expose these path helpers.
  if (options.exposePaths === false) {
    if (sandbox.vault) { delete sandbox.vault.basePath; delete sandbox.vault.resolve; }
    if (sandbox.files) { delete sandbox.files.cwd; delete sandbox.files.resolve; }
  }
  const inputVar = options.codeInputVar || "input";
  const outputVar = options.codeOutputVar || "output";
  const preamble = `var ${inputVar} = input; var ${outputVar} = "";`;
  const result = vm.runInNewContext(preamble + "\n" + options.code + "\n;" + outputVar, sandbox, {timeout:900_000});
  return String(result == null ? "" : result);
}

function codeNodeExecutable(): string {
  if (!process.versions.electron) return process.execPath;
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");
  const directories = (process.env.PATH || process.env.Path || "").split(path.delimiter)
    .map(directory => directory.trim().replace(/^"|"$/g, "")).filter(directory => path.isAbsolute(directory));
  if (process.platform === "win32") {
    for (const base of [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]]) {
      if (base && path.isAbsolute(base)) directories.push(path.join(base, "nodejs"));
    }
  } else directories.push("/opt/homebrew/bin", "/usr/local/bin", "/usr/bin");
  for (const directory of directories) {
    const file = path.join(directory, process.platform === "win32" ? "node.exe" : "node");
    try { if (fs.statSync(file).isFile()) { fs.accessSync(file, fs.constants.X_OK); return file; } } catch { /* Try the next installed runtime. */ }
  }
  throw new Error("Code tasks need Node.js 18 or later. Install Node.js and restart Obsidian, then try again.");
}

/** Obsidian's renderer cannot create Node Workers. Run trusted code in an
 * installed Node process instead; its worker keeps the disconnect watchdog
 * responsive even while the code loops. No task source is put on the command
 * line or written to temporary files. Stop cannot undo external effects. */
export async function executeCodeAsync(options: CodeExecutionOptions, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) throw new Error("Code execution stopped; external effects may be unconfirmed");
  const {log, onVaultMutation} = options;
  const data: CodeExecutionOptions = {
    vaultBase:options.vaultBase,cwd:options.cwd,code:options.code,input:options.input,outputs:options.outputs,
    codeInputVar:options.codeInputVar,codeOutputVar:options.codeOutputVar,
    codeAllowVault:options.codeAllowVault,codeAllowFiles:options.codeAllowFiles,codeAllowTerminal:options.codeAllowTerminal,
    exposePaths:options.exposePaths,
  };
  const workerSource = `
    const {parentPort, workerData} = require('worker_threads');
    const execute = ${executeCode.toString()};
    try {
      const output = execute({...workerData,
        log: (...args) => parentPort.postMessage({type:'log', text:args.map(String).join(' ')}),
        onVaultMutation: mutation => parentPort.postMessage({type:'mutation', mutation})});
      parentPort.postMessage({type:'result', output});
    } catch(error) { parentPort.postMessage({type:'error', text:String(error),
      name: typeof error?.name === 'string' ? error.name : 'Error',
      message: typeof error?.message === 'string' ? error.message : String(error)}); }
  `;
  const source = `
    if (Number(process.versions.node.split('.')[0]) < 18) throw Error('Code tasks need Node.js 18 or later');
    const {Worker} = require('worker_threads');
    process.on('disconnect', () => process.exit(1));
    const send = message => { if (process.connected) process.send(message); else process.exit(1); };
    process.once('message', data => {
      const worker = new Worker(${JSON.stringify(workerSource)}, {eval:true,workerData:data});
      let finished = false;
      const finish = message => {
        if (finished) return; finished = true;
        if (process.connected) process.send(message, () => process.exit(0)); else process.exit(1);
      };
      worker.on('message', message => message.type === 'result' || message.type === 'error' ? finish(message) : send(message));
      worker.once('error', error => finish({type:'error',text:String(error),name:error.name,message:error.message}));
      worker.once('exit', code => { if (!finished) finish({type:'error',text:'Code runner exited without a result ('+code+')',name:'Error',message:'Code runner exited without a result'}); });
    });
    send({type:'ready'});
  `;
  const {spawn} = require("child_process") as typeof import("child_process");
  const child = spawn(codeNodeExecutable(), ["-e", source], {
    cwd:options.cwd, windowsHide:true, detached:process.platform !== "win32",
    // Electron and the installed Node can use different V8 serialization versions.
    stdio:["ignore", "ignore", "pipe", "ipc"], serialization:"json",
  });
  let closed = false, diagnostic = "", startupTimer: ReturnType<typeof setTimeout> | undefined;
  const closedPromise = new Promise<void>(resolve => child.once("close", () => {closed=true;resolve();}));
  child.stderr?.on("data", chunk => {diagnostic=(diagnostic+String(chunk)).slice(-2000);});
  const stop = () => {
    if (!child.pid || closed || child.exitCode !== null || child.signalCode !== null) return;
    if (signal?.aborted && process.platform === "win32") {
      const path = require("path") as typeof import("path");
      const system = process.env.SystemRoot || "C:\\Windows";
      const killer = spawn(path.join(system,"System32","taskkill.exe"), ["/PID",String(child.pid),"/T","/F"], {windowsHide:true,stdio:"ignore"});
      const fallback = () => {if (!closed) child.kill("SIGKILL");};
      const timer = setTimeout(fallback,2000);
      killer.once("error", () => {clearTimeout(timer);fallback();});
      killer.once("close", () => {clearTimeout(timer);fallback();});
    } else if (signal?.aborted && process.platform !== "win32") {
      try {process.kill(-child.pid,"SIGKILL");} catch {child.kill("SIGKILL");}
    } else child.kill("SIGKILL");
  };
  let abort: (()=>void) | undefined;
  try {
    return await new Promise<string>((resolve, reject) => {
      abort = () => reject(new Error("Code execution stopped; commands already started may still have effects"));
      signal?.addEventListener("abort", abort, {once:true});
      child.once("error", reject);
      child.once("close", code => reject(new Error(`Code runner exited without a result (${code}). ${diagnostic}`)));
      startupTimer = setTimeout(() => reject(new Error("The code runner did not start. Check your Node.js installation.")),30000);
      child.on("message", (message:any) => {
        try {
          if (message.type === "ready") {clearTimeout(startupTimer);child.send(data, error => {if (error) reject(error);});}
          else if (message.type === "log") log?.(message.text);
          else if (message.type === "mutation") onVaultMutation?.(message.mutation);
          else if (message.type === "result") resolve(message.output);
          else if (message.type === "error") {
            const error = new Error(message.message);
            error.name = message.name;
            // Preserve the original display, including non-Error thrown values.
            error.toString = () => message.text;
            reject(error);
          }
        } catch(error) { reject(error); }
      });
      if (signal?.aborted) abort();
    });
  } finally {
    clearTimeout(startupTimer);
    if (abort) signal?.removeEventListener("abort",abort);
    stop();
    await closedPromise;
  }
}
