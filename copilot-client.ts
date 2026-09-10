import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export interface CopilotRunOptions {
  model?: string;
  allowAllTools?: boolean;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

export interface CopilotRunResult {
  output: string;
  error: string;
  exitCode: number;
}

// Prefer the native npm optional dependency on Windows: spawning an npm .cmd
// through a shell would reinterpret prompt quotes, newlines and metacharacters.
export function resolveCopilotBin(configured = "copilot"): string {
  const value = configured.trim() || "copilot";
  const nativeFromShim = (shim: string): string | undefined => {
    const npmRoot = path.join(path.dirname(shim), "node_modules", "@github");
    const packageName = `copilot-${process.platform}-${process.arch}`;
    const executable = process.platform === "win32" ? "copilot.exe" : "copilot";
    return [
      path.join(npmRoot, "copilot", "node_modules", "@github", packageName, executable),
      path.join(npmRoot, packageName, executable),
    ].find((candidate) => fs.existsSync(candidate));
  };
  if (value !== "copilot") {
    return /\.(cmd|bat|ps1)$/i.test(value) ? nativeFromShim(value) || value : value;
  }
  const home = os.homedir();
  const dirs = [
    ...(process.env.PATH || "").split(path.delimiter),
    path.join(home, ".local", "bin"),
    path.join(home, ".npm-global", "bin"),
    ...(process.platform === "win32"
      ? [path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "npm")]
      : ["/opt/homebrew/bin", "/usr/local/bin"]),
  ];
  for (const dir of dirs.filter(Boolean)) {
    for (const extension of process.platform === "win32" ? [".exe", ".cmd", ".ps1"] : [""]) {
      const candidate = path.join(dir.replace(/^"|"$/g, ""), `copilot${extension}`);
      if (fs.existsSync(candidate)) return nativeFromShim(candidate) || candidate;
    }
  }
  return value;
}

export function buildCopilotArgs(prompt: string, options: CopilotRunOptions = {}): string[] {
  if (!prompt.trim()) throw new Error("Copilot task prompt is empty.");
  const args = ["--prompt", prompt, "--silent", "--stream", "on", "--no-color", "--no-ask-user", "--no-auto-update"];
  if (options.model?.trim()) args.push("--model", options.model.trim());
  if (options.allowAllTools === true) {
    args.push("--allow-all-tools");
  } else {
    // Restrict the actual exposed tools, including when the user's CLI config
    // grants broader permissions. Reading is sufficient for analysis tasks.
    args.push("--available-tools", "view", "glob", "grep", "--allow-tool=read");
  }
  return args;
}

/** One process per task, with streaming output and process-tree cancellation. */
export class CopilotCliClient {
  private child?: ChildProcessWithoutNullStreams;
  private finish?: (result: CopilotRunResult) => void;
  private disposed = false;

  constructor(
    private readonly bin: string,
    private readonly cwd: string,
    private readonly onOutput: (output: string) => void = () => {},
  ) {}

  run(prompt: string, options: CopilotRunOptions = {}): Promise<CopilotRunResult> {
    if (this.disposed || this.child) return Promise.reject(new Error("Copilot client is no longer available."));
    if (process.platform === "win32" && /\.(cmd|bat|ps1)$/i.test(this.bin)) {
      return Promise.reject(new Error("Select the native copilot.exe executable, or reinstall @github/copilot with optional dependencies enabled."));
    }
    return new Promise((resolve) => {
      let output = "";
      let error = "";
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let promptDir: string | undefined;
      const finish = (result: CopilotRunResult) => {
        if (settled) return;
        settled = true;
        this.finish = undefined;
        if (timer) clearTimeout(timer);
        if (promptDir) {
          try { fs.unlinkSync(path.join(promptDir, "task.txt")); fs.rmdirSync(promptDir); } catch { /* best effort */ }
        }
        resolve(result);
      };
      this.finish = finish;
      try {
        let args: string[];
        if (prompt.length > 12000) {
          promptDir = fs.mkdtempSync(path.join(os.tmpdir(), "autooc-copilot-"));
          const promptFile = path.join(promptDir, "task.txt");
          fs.writeFileSync(promptFile, prompt, { encoding: "utf8", mode: 0o600 });
          args = buildCopilotArgs(`Read the UTF-8 file ${JSON.stringify(promptFile)} and carry out the complete task instructions it contains.`, options);
          args.push("--add-dir", promptDir);
        } else {
          args = buildCopilotArgs(prompt, options);
        }
        this.child = spawn(this.bin, args, {
          cwd: this.cwd,
          env: { ...process.env, ...options.env },
          stdio: "pipe",
          shell: false,
          windowsHide: true,
          detached: process.platform !== "win32",
        });
        this.child.stdout.setEncoding("utf8");
        this.child.stderr.setEncoding("utf8");
        this.child.stdout.on("data", (chunk: string) => {
          if (settled) return;
          output += chunk;
          this.onOutput(output);
        });
        this.child.stderr.on("data", (chunk: string) => { if (!settled) error += chunk; });
        this.child.once("error", (failure) => finish({ output, error: failure.message, exitCode: -1 }));
        this.child.once("close", (code) => finish({ output: output.trim(), error: error.trim(), exitCode: code ?? -1 }));
        this.child.stdin.on("error", () => { /* process may exit before EOF */ });
        this.child.stdin.end();
        if (options.timeoutMs && options.timeoutMs > 0) {
          timer = setTimeout(() => {
            this.killTree();
            finish({ output, error: `Copilot task timed out after ${options.timeoutMs! / 1000} seconds.`, exitCode: -1 });
          }, options.timeoutMs);
        }
      } catch (failure) {
        finish({ output, error: String(failure), exitCode: -1 });
      }
    });
  }

  private killTree(): void {
    const child = this.child;
    if (!child?.pid || child.exitCode !== null) return;
    if (process.platform === "win32") {
      const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      killer.on("error", () => { try { child.kill(); } catch { /* already exited */ } });
    } else {
      try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch { /* already exited */ } }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.killTree();
    this.finish?.({ output: "", error: "Copilot task cancelled.", exitCode: -1 });
  }
}

export function checkCopilotInstallation(bin: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ["--version"], { cwd, windowsHide: true, shell: false, stdio: "pipe" });
    let output = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("Copilot version check timed out.")); }, 15000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output.trim());
      else reject(new Error(output.trim() || `Copilot exited with code ${code}.`));
    });
    child.stdin.end();
  });
}
