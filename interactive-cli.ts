import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawn } from "child_process";
import { openOpencodeCli, psSingleQuoted } from "./cli-launchers";
import { resolveCodexBin } from "./codex-client";
import { assertOpenCode2 } from "./opencode-version";

export type InteractiveCliProvider = "opencode" | "opencode2" | "codex" | "copilot" | "claude";
export interface InteractiveCliSettings {
  opencodePath: string;
  opencode2Path?: string;
  codexPath: string;
  copilotPath: string;
  claudePath?: string;
  cliLauncherEnabled?: Partial<Record<InteractiveCliProvider, boolean>>;
  cliTerminalDestination?: "integrated" | "external";
  workingDirectory: string;
  linuxTerminal?: string;
}
export const INTERACTIVE_CLIS = [
  { id: "opencode", label: "OpenCode 1 CLI", pathKey: "opencodePath" },
  { id: "opencode2", label: "OpenCode 2 CLI", pathKey: "opencode2Path" },
  { id: "codex", label: "Codex CLI", pathKey: "codexPath" },
  { id: "copilot", label: "GitHub Copilot CLI", pathKey: "copilotPath" },
  { id: "claude", label: "Claude Code CLI", pathKey: "claudePath" },
] as const;

function executable(file: string): boolean {
  try {
    if (!path.isAbsolute(file) || !fs.statSync(file).isFile()) return false;
    if (process.platform === "win32" && !/\.(exe|cmd|bat|ps1)$/i.test(file)) return false;
    fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch { return false; }
}

export function resolveInteractiveCli(provider: InteractiveCliProvider, configured?: string): string | undefined {
  const defaultCommand = provider === "opencode2" ? "opencode" : provider;
  const requested = (configured?.trim() || defaultCommand).replace(/^~(?=[/\\])/, os.homedir());
  if (path.isAbsolute(requested)) return executable(requested) ? requested : undefined;
  // A command name or an absolute executable path, never a shell command line.
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(requested)) return undefined;
  const directories = (process.env.PATH || process.env.Path || "").split(path.delimiter)
    .map(value => value.trim().replace(/^"|"$/g, "")).filter(value => path.isAbsolute(value));
  if (requested === defaultCommand) {
    const home = os.homedir();
    directories.push(path.join(home, ".local", "bin"), path.join(home, ".npm-global", "bin"), path.join(home, ".bun", "bin"), path.join(home, "bin"));
    if (process.platform === "win32") {
      if (process.env.APPDATA) directories.push(path.join(process.env.APPDATA, "npm"));
    } else directories.push("/opt/homebrew/bin", "/usr/local/bin");
    if (provider === "claude") directories.push(path.join(home, ".claude", "local"));
  }
  const extensions = process.platform === "win32" && !path.extname(requested) ? [".exe", ".cmd", ".bat", ".ps1"] : [""];
  for (const directory of directories) for (const extension of extensions) {
    const file = path.join(directory, requested + extension);
    if (executable(file)) return file;
  }
  // The desktop distribution also includes a CLI binary. Invoke its CLI entry,
  // never `app` or a desktop deep link. Explicit invalid paths do not fall back.
  if (provider === "codex" && requested === provider) {
    const fallback = resolveCodexBin("codex");
    if (executable(fallback)) return fallback;
  }
  return undefined;
}

export function configuredInteractiveClis(settings: InteractiveCliSettings) {
  return INTERACTIVE_CLIS.filter(cli => settings.cliLauncherEnabled?.[cli.id] !== false).map(cli => ({
    ...cli, executable: resolveInteractiveCli(cli.id, settings[cli.pathKey]),
  }));
}

export function windowsInteractiveCliScripts(bin: string, cwd: string, label: string) {
  const runner = [
    "$ErrorActionPreference = 'Stop'",
    `$Host.UI.RawUI.WindowTitle = ${psSingleQuoted(label)}`,
    `Set-Location -LiteralPath ${psSingleQuoted(cwd)}`,
    `& ${psSingleQuoted(bin)}`,
  ].join("\n");
  const encoded = Buffer.from(runner, "utf16le").toString("base64");
  const helper = [
    "$ErrorActionPreference = 'Stop'",
    "$ProgressPreference = 'SilentlyContinue'",
    "try {",
    `  $terminal = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList @('-NoLogo', '-NoExit', '-EncodedCommand', '${encoded}') -WorkingDirectory ${psSingleQuoted(cwd)} -WindowStyle Normal -PassThru`,
    "  [Console]::Out.WriteLine('AUTOOC_TERMINAL_PID=' + $terminal.Id)",
    "} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }",
  ].join("\n");
  return { runner, helper };
}

export function prepareInteractiveCli(provider: InteractiveCliProvider, cwd: string, settings: InteractiveCliSettings) {
  const cli = INTERACTIVE_CLIS.find(item => item.id === provider);
  if (!cli || settings.cliLauncherEnabled?.[provider] === false) throw new Error("This CLI is disabled. Enable it in AutoOC Settings.");
  const bin = resolveInteractiveCli(provider, settings[cli.pathKey]);
  if (!bin) throw new Error(`${cli.label} was not found. Check its executable path in AutoOC Settings.`);
  if (!path.isAbsolute(cwd)) throw new Error("Choose an absolute project folder.");
  try { if (!fs.statSync(cwd).isDirectory()) throw new Error(); }
  catch { throw new Error(`Folder does not exist: ${cwd}`); }
  if (!["win32", "darwin", "linux"].includes(process.platform)) throw new Error("Interactive CLIs require Windows, macOS or Linux.");
  return { cli, bin, cwd };
}

export async function launchInteractiveCli(provider: InteractiveCliProvider, cwd: string, settings: InteractiveCliSettings): Promise<void> {
  const { cli, bin } = prepareInteractiveCli(provider, cwd, settings);
  if (provider === "opencode2") await assertOpenCode2(bin);
  if (process.platform !== "win32") return new Promise((resolve, reject) => {
    try { openOpencodeCli(bin, cwd, {}, [], { linuxTerminal: settings.linuxTerminal, onLaunched: resolve, onError: reject }); }
    catch (error) { reject(error); }
  });
  return new Promise((resolve, reject) => {
    // A hidden, short-lived helper opens a real interactive console with its own
    // input/output handles. Redirecting the CLI itself to NUL would break its TUI.
    const { helper } = windowsInteractiveCliScripts(bin, cwd, cli.label);
    const windowsRoot = process.env.SystemRoot || process.env.WINDIR || "C:\\Windows";
    const powershell = path.join(path.isAbsolute(windowsRoot) ? windowsRoot : "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    // Only Start-Process detaches the visible terminal. A detached hidden
    // PowerShell helper can exit 0 without evaluating its command on Windows.
    const child = spawn(powershell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(helper, "utf16le").toString("base64")],
      { cwd, detached: false, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let receipt = "", diagnostic = "";
    child.stdout?.on("data", chunk => { receipt = (receipt + chunk.toString()).slice(-1024); });
    child.stderr?.on("data", chunk => { diagnostic = (diagnostic + chunk.toString()).slice(-2048); });
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (error) reject(error); else resolve();
    };
    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* The helper may already have exited. */ }
      finish(new Error("Terminal launch could not be confirmed. Check for an open window before trying again."));
    }, 15000);
    timer.unref?.();
    child.once("error", error => finish(error));
    child.once("close", code => {
      const confirmed = code === 0 && /^AUTOOC_TERMINAL_PID=[1-9]\d*\r?$/m.test(receipt);
      finish(confirmed ? undefined : new Error(code === 0
        ? `Terminal launch could not be confirmed for ${cli.label}. Check for an open window before trying again.`
        : `Could not open ${cli.label} terminal (launcher exit ${code ?? "unknown"}).${diagnostic.trim() ? " " + diagnostic.trim() : ""}`));
    });
  });
}
