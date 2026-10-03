import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import { spawn } from "child_process";

// Resolve the opencode binary. On Windows prefer .cmd so Electron finds it without
// PATH. On macOS/Linux GUI apps (Obsidian) don't inherit the shell PATH, so probe the
// common install locations explicitly before falling back to the bare command name.
export function resolveOpencodeBin(configured: string): string {
  if (configured && configured !== "opencode") return configured;
  const candidates: string[] = [];
  if (os.platform() === "win32") {
    // Common npm global path
    candidates.push(`${process.env.APPDATA}\\npm\\opencode.cmd`);
  } else {
    const home = process.env.HOME || "";
    candidates.push(
      `${home}/.bun/bin/opencode`,
      `${home}/.local/bin/opencode`,
      `${home}/.npm-global/bin/opencode`,
      `${home}/bin/opencode`,
      "/opt/homebrew/bin/opencode",
      "/usr/local/bin/opencode",
    );
  }
  const { accessSync, constants } = require("fs");
  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch { /* ignore */ }
  }
  return configured || "opencode";
}

export function psSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function commandPreviewArg(value: string): string {
  return /^[A-Za-z0-9_@%+=:,./\\-]+$/.test(value) ? value : `"${value.replace(/"/g, '\\"')}"`;
}

export function shSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function buildPowerShellEnvLines(env: Record<string, string>): string[] {
  return Object.entries(env)
    .filter(([key]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
    .map(([key, value]) => `$env:${key} = ${psSingleQuoted(value)}`);
}


export const SAFE_CLI_PROMPT_LENGTH = 7500;

export function isWindows(): boolean {
  return process.platform === "win32";
}

// Detached-script file extension for the current platform: PowerShell on
// Windows, POSIX shell elsewhere.
export function scriptExt(): ".ps1" | ".sh" {
  return isWindows() ? ".ps1" : ".sh";
}

// Environment exports for POSIX shell scripts. Values are single-quoted so
// secrets and paths with shell metacharacters stay literal.
export function buildShEnvLines(env: Record<string, string>): string[] {
  return Object.entries(env)
    .filter(([key]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
    .map(([key, value]) => `export ${key}=${shSingleQuoted(value)}`);
}

// Builds a shell command with every token shell-quoted, so paths and values
// that contain spaces, quotes, or shell metacharacters survive the trip into
// an interactive terminal (previously `cd ${cwd}` failed on spaces on macOS).
export function buildPosixLaunchCommand(bin: string, cwd: string, env: Record<string, string>, args: string[]): string {
  const envPrefix = Object.entries(env)
    .filter(([key]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
    .map(([key, value]) => `${key}=${shSingleQuoted(value)}`)
    .join(" ");
  return `cd ${shSingleQuoted(cwd)} && ${envPrefix ? `${envPrefix} ` : ""}${[bin, ...args].map(shSingleQuoted).join(" ")}`;
}

// AppleScript string literal quoting. The embedded command is already
// shell-quoted by buildPosixLaunchCommand, so only backslashes and double
// quotes need escaping for the AppleScript string itself.
export function appleScriptQuoted(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export const LINUX_TERMINAL_CANDIDATES: Array<{ cmd: string; args: string[] }> = [
  { cmd: "x-terminal-emulator", args: ["-e"] },
  { cmd: "gnome-terminal", args: ["--"] },
  { cmd: "konsole", args: ["-e"] },
  { cmd: "xfce4-terminal", args: ["-e"] },
  { cmd: "lxterminal", args: ["-e"] },
  { cmd: "alacritty", args: ["-e"] },
  { cmd: "xterm", args: ["-e"] },
];

export function commandExists(cmd: string): boolean {
  try {
    const { execSync } = require("child_process");
    execSync(`command -v ${shSingleQuoted(cmd)}`, { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// First available terminal emulator on Linux. A user-configured command is
// tried first, then common emulators, so x-terminal-emulator-only setups keep
// working and distros without it fall back to gnome-terminal/konsole/xterm.
export function resolveLinuxTerminal(configured?: string): { cmd: string; args: string[] } | null {
  if (configured && configured.trim()) {
    const parts = configured.trim().split(/\s+/);
    const cmd = parts.shift() as string;
    if (commandExists(cmd)) return { cmd, args: [...parts, "-e"] };
    return null;
  }
  for (const candidate of LINUX_TERMINAL_CANDIDATES) {
    if (commandExists(candidate.cmd)) return candidate;
  }
  return null;
}

export interface CliLaunchOptions {
  onError?: (error: Error) => void;
  onLaunched?: () => void;
  linuxTerminal?: string;
}

export function openOpencodeCli(
  bin: string,
  cwd: string,
  env: Record<string, string> = {},
  args: string[] = [],
  options: CliLaunchOptions = {},
): void {
  if (isWindows()) {
    const envScript = buildPowerShellEnvLines(env).join("; ");
    const runCommand = args.length > 0
      ? `$bin = ${psSingleQuoted(bin)}; $argList = @(${args.map(psSingleQuoted).join(",")}); & $bin @argList`
      : `& ${psSingleQuoted(bin)}`;
    const command = `${envScript ? `${envScript}; ` : ""}Set-Location -LiteralPath ${psSingleQuoted(cwd)}; ${runCommand}`;
    const launcher = spawn(
      "cmd.exe",
      ["/c", "start", "OpenCode CLI", "/D", cwd, "powershell.exe", "-NoLogo", "-NoExit", "-Command", command],
      { detached: true, stdio: "ignore", windowsHide: false },
    );
    launcher.on?.("error", (error: Error) => options.onError?.(error));
    launcher.on?.("spawn", () => options.onLaunched?.());
    launcher.unref();
    return;
  }

  const command = buildPosixLaunchCommand(bin, cwd, env, args);

  if (process.platform === "darwin") {
    const script = `tell application "Terminal" to do script ${appleScriptQuoted(command)}`;
    const launcher = spawn("osascript", ["-e", script], { detached: true, stdio: "ignore" });
    launcher.on?.("error", (error: Error) => options.onError?.(error));
    launcher.on?.("spawn", () => options.onLaunched?.());
    launcher.unref();
    return;
  }

  if (process.platform === "linux") {
    const terminal = resolveLinuxTerminal(options.linuxTerminal);
    if (!terminal) {
      throw new Error(
        "no supported Linux terminal emulator found (tried x-terminal-emulator, gnome-terminal, konsole, xfce4-terminal, lxterminal, alacritty, xterm)",
      );
    }
    const launcher = spawn(terminal.cmd, [...terminal.args, "sh", "-lc", command], { detached: true, stdio: "ignore" });
    launcher.on?.("error", (error: Error) => options.onError?.(error));
    launcher.on?.("spawn", () => options.onLaunched?.());
    launcher.unref();
    return;
  }
}

export function openOpencodeCliLongPromptWindows(
  bin: string,
  cwd: string,
  env: Record<string, string>,
  model: string,
  agent: string,
  prompt: string,
  options: CliLaunchOptions = {},
): void {
  const promptFile = path.join(cwd, `.autooc-prompt-${crypto.randomBytes(8).toString("hex")}.txt`);
  fs.writeFileSync(promptFile, prompt, "utf8");
  // ponytail: workspace file avoids temp-dir access surprises; one minute is enough after TUI startup.
  setTimeout(() => {
    try {
      fs.unlinkSync(promptFile);
    } catch {
      // ignore cleanup errors
    }
  }, 60 * 1000).unref?.();

  const shortInstruction = `Read the full task prompt from ${promptFile} and follow it exactly.`;
  const envScript = buildPowerShellEnvLines(env).join("; ");
  const agentParts = agent ? `, "--agent", ${psSingleQuoted(agent)}` : "";
  const command =
    `${envScript ? `${envScript}; ` : ""}` +
    `Set-Location -LiteralPath ${psSingleQuoted(cwd)}; ` +
    `$bin = ${psSingleQuoted(bin)}; ` +
    `$argList = @("-m", ${psSingleQuoted(model)}${agentParts}, "--prompt", ${psSingleQuoted(shortInstruction)}); ` +
    `& $bin @argList`;
  const launcher = spawn(
    "cmd.exe",
    ["/c", "start", "OpenCode CLI", "/D", cwd, "powershell.exe", "-NoLogo", "-NoExit", "-Command", command],
    { detached: true, stdio: "ignore", windowsHide: false },
  );
  launcher.on?.("error", (error:Error)=>options.onError?.(error));
  launcher.on?.("spawn", ()=>options.onLaunched?.());
  launcher.unref();
}

export type ProcessHandle = { kill: () => void };

export type HiddenProcessHandle = ProcessHandle & {
  cleanup: (removeScript?: boolean) => void;
  onError: (callback: (error: Error) => void) => void;
};

export function launchHiddenPS(psScriptFile: string, pidFile?: string): HiddenProcessHandle {
  const fs   = require("fs");
  const launcherFile = psScriptFile.replace(/\.ps1$/, ".vbs");
  const effectivePidFile = pidFile || psScriptFile.replace(/\.ps1$/, ".pid");
  const quotedPsScriptFile = psScriptFile.replace(/"/g, '""');
  const launcherScript = `Set sh = CreateObject("WScript.Shell")\r\n` +
    `sh.Run "powershell.exe -NoLogo -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File ""${quotedPsScriptFile}""", 0, False\r\n`;
  fs.writeFileSync(launcherFile, launcherScript, "utf8");
  const { spawn } = require("child_process");
  const child = spawn("wscript.exe", [launcherFile], { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
  // Clean up launcher files after PowerShell has had time to read them. This
  // also limits exposure for launch scripts that contain temporary env vars.
  const launcherTimer = setTimeout(() => { try { fs.unlinkSync(launcherFile); } catch { /* ignore */ } }, 10000);
  // ponytail: 10-minute fallback cleanup so generated ps1 stays available for debugging.
  const scriptTimer = setTimeout(() => { try { fs.unlinkSync(psScriptFile); } catch { /* ignore */ } }, 600000);

  const cleanup = (removeScript = false) => {
    clearTimeout(launcherTimer);
    clearTimeout(scriptTimer);
    try { fs.unlinkSync(launcherFile); } catch { /* ignore */ }
    if (removeScript) {
      try { fs.unlinkSync(psScriptFile); } catch { /* ignore */ }
    }
  };

  const kill = () => {
    let killedChildTree = false;
    if (child.pid) {
      try {
        const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { detached: true, stdio: "ignore", windowsHide: true });
        killer.unref();
        killedChildTree = true;
      } catch { /* ignore */ }
    }
    if (!killedChildTree) {
      try { child.kill(); } catch { /* ignore */ }
    }
    try {
      const pid = fs.existsSync(effectivePidFile) ? String(fs.readFileSync(effectivePidFile, "utf8")).trim() : "";
      if (/^\d+$/.test(pid) && pid !== String(child.pid || "")) {
        const killer = spawn("taskkill.exe", ["/PID", pid, "/T", "/F"], { detached: true, stdio: "ignore", windowsHide: true });
        killer.unref();
      }
    } catch { /* ignore */ }
    cleanup(true);
    try { fs.unlinkSync(effectivePidFile); } catch { /* ignore */ }
  };

  const callbacks: Array<(error: Error) => void> = [];
  let launchError: Error | null = null;
  child.on?.("error", (error: Error) => {
    launchError = error;
    cleanup(true);
    callbacks.forEach((callback) => callback(error));
  });

  return {
    kill,
    cleanup,
    onError: (callback) => {
      if (launchError) callback(launchError);
      else callbacks.push(callback);
    },
  };
}

// POSIX equivalent of launchHiddenPS: runs a shell script fully detached so the
// Electron sandbox does not kill the child. Output capture lives inside the
// script (temp files polled by the caller); cancellation kills the whole process
// group; cleanup removes the script (and pid file) after a timeout or on kill.
export function launchHiddenSh(shScriptFile: string, pidFile?: string): HiddenProcessHandle {
  const fs = require("fs");
  const { spawn } = require("child_process");
  const effectivePidFile = pidFile || shScriptFile.replace(/\.sh$/, ".pid");
  try { fs.chmodSync(shScriptFile, 0o700); } catch { /* ignore */ }
  // detached:true on POSIX puts the child in its own process group, so a single
  // kill(-pid) reaches the shell and every process it spawned (opencode, git…).
  const child = spawn("/bin/sh", [shScriptFile], { detached: true, stdio: "ignore" });
  child.unref();
  // ponytail: 10-minute fallback cleanup so the generated sh stays available for debugging.
  const scriptTimer = setTimeout(() => { try { fs.unlinkSync(shScriptFile); } catch { /* ignore */ } }, 600000);

  const cleanup = (removeScript = false) => {
    clearTimeout(scriptTimer);
    if (removeScript) {
      try { fs.unlinkSync(shScriptFile); } catch { /* ignore */ }
    }
  };

  const kill = () => {
    let killedChildTree = false;
    if (child.pid) {
      try {
        process.kill(-child.pid, "SIGKILL");
        killedChildTree = true;
      } catch { /* ignore */ }
    }
    if (!killedChildTree) {
      try { child.kill("SIGKILL"); } catch { /* ignore */ }
    }
    try {
      const pid = fs.existsSync(effectivePidFile) ? String(fs.readFileSync(effectivePidFile, "utf8")).trim() : "";
      if (/^\d+$/.test(pid) && pid !== String(child.pid || "")) {
        try { process.kill(-Number(pid), "SIGKILL"); } catch { /* ignore */ }
        try { process.kill(Number(pid), "SIGKILL"); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    cleanup(true);
    try { fs.unlinkSync(effectivePidFile); } catch { /* ignore */ }
  };

  const callbacks: Array<(error: Error) => void> = [];
  let launchError: Error | null = null;
  child.on?.("error", (error: Error) => {
    launchError = error;
    cleanup(true);
    callbacks.forEach((callback) => callback(error));
  });

  return {
    kill,
    cleanup,
    onError: (callback) => {
      if (launchError) callback(launchError);
      else callbacks.push(callback);
    },
  };
}

// Cross-platform hidden launcher: PowerShell/VBScript on Windows, detached
// /bin/sh on macOS/Linux.
export function launchHidden(scriptFile: string, pidFile?: string): HiddenProcessHandle {
  return isWindows() ? launchHiddenPS(scriptFile, pidFile) : launchHiddenSh(scriptFile, pidFile);
}

export function writeUtf8BomFile(filePath: string, content: string): void {
  fs.writeFileSync(filePath, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(content, "utf8")]));
}

export function psUtf8Prelude(): string[] {
  return [
    `$utf8NoBom = New-Object System.Text.UTF8Encoding($false)`,
    `[Console]::OutputEncoding = $utf8NoBom`,
    `$OutputEncoding = $utf8NoBom`,
  ];
}
