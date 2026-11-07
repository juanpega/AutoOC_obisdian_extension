import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { InteractiveTerminalLaunchUncertainError } from "./interactive-task-terminal";
import * as crypto from "crypto";
import { spawn } from "child_process";
import { createAuxiliaryDirectory, completeAuxiliaryDirectory, auxiliaryCompletionRecord, AUXILIARY_COMPLETION } from './execution-files';

// Honor the selected command on PATH before probing fallback installations.
// GUI apps may have an incomplete PATH, so keep the common install locations.
export function resolveOpencodeBin(configured: string): string {
  const requested = configured?.trim();
  if (requested && requested !== "opencode") return requested;
  const candidates: string[] = [];
  const extensions = os.platform() === "win32" ? [".exe", ".cmd", ".bat"] : [""];
  for (const entry of (process.env.PATH || process.env.Path || "").split(path.delimiter)) {
    const directory = entry.trim().replace(/^"|"$/g, "");
    // Never make the active vault an implicit executable search directory.
    if (!path.isAbsolute(directory)) continue;
    for (const extension of extensions) candidates.push(path.join(directory, `opencode${extension}`));
  }
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
  const { accessSync, statSync, constants } = require("fs");
  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.X_OK);
      if (!statSync(candidate).isFile()) continue;
      return candidate;
    } catch { /* ignore */ }
  }
  return requested || "opencode";
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
  opencodeMajor?: 1 | 2;
  promptArgs?: (instruction: string) => string[];
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
  const attempt = crypto.randomBytes(16).toString("hex");
  let directory: string;
  try { directory = createAuxiliaryDirectory(cwd, 'interactive'); }
  catch (error) { options.onError?.(error instanceof Error ? error : new Error(String(error))); return; }
  const promptFile = path.join(directory, "prompt.txt");
  const stateFile = path.join(directory, "state.json");
  const ignoreFile = path.join(directory, ".gitignore");
  // This owned directory ignores itself in any Git workspace. Never edit the
  // destination's existing ignore rules or sweep files by a shared prefix.
  const cleanup = () => completeAuxiliaryDirectory(directory, 'interactive');
  let settled = false;
  let poll: ReturnType<typeof setInterval> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const finish = (error?: Error) => {
    if (settled) return;
    settled = true;
    if (timeout) clearTimeout(timeout);
    // A standalone CLI awaiting confirmation must stay alive. After settlement
    // only the interactive session owns its lifetime; Electron can keep polling.
    poll?.unref?.();
    if (error) options.onError?.(error);
    else options.onLaunched?.();
  };
  const stopPolling = () => { if (poll) clearInterval(poll); };
  try {
    fs.writeFileSync(ignoreFile, "*\n", { encoding: "utf8", flag: "wx" });
    fs.writeFileSync(promptFile, prompt, { encoding: "utf8", flag: "wx" });
    const instruction = `Read the full task prompt from ${path.relative(path.resolve(cwd), promptFile).split(path.sep).join('/')} and follow it exactly.`;
    const completionFile = path.join(directory, AUXILIARY_COMPLETION);
    const completion = `  ${psSingleQuoted(auxiliaryCompletionRecord(directory, 'interactive'))} | Set-Content -LiteralPath ${psSingleQuoted(completionFile)} -Encoding UTF8`;
    const checkDirectory = `function Test-AutoOCAuxiliary { $item = Get-Item -LiteralPath ${psSingleQuoted(directory)} -Force -ErrorAction SilentlyContinue; for ($i = 0; $i -lt 3; $i++) { if ($null -eq $item -or -not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { return $false }; $item = Get-Item -LiteralPath $item.Parent.FullName -Force -ErrorAction SilentlyContinue }; return $true }`;
    // Values stay in PowerShell literals. Credentials are inherited through the
    // environment, never written into a script or a command-line argument.
    const runner = [
      "$ErrorActionPreference = 'Stop'",
      checkDirectory,
      `Set-Location -LiteralPath ${psSingleQuoted(path.resolve(cwd))}`,
      "try {",
      `  $target = Get-Command -Name ${psSingleQuoted(bin)} -CommandType Application,ExternalScript -ErrorAction Stop | Select-Object -First 1`,
      `  $cliArgs = @(${options.promptArgs ? options.promptArgs(instruction).map(psSingleQuoted).join(", ") : `${options.opencodeMajor === 2 ? "'mini', '--standalone', " : ""}'-m', ${psSingleQuoted(model)}${agent ? `, '--agent', ${psSingleQuoted(agent)}` : ""}, '--prompt', ${psSingleQuoted(instruction)}`})`,
      "  & $target.Source @cliArgs",
      "  exit $LASTEXITCODE",
      "} catch { Write-Error 'AutoOC: interactive CLI invocation failed' -ErrorAction Continue; exit 1 }",
      "finally {",
      `  if (Test-AutoOCAuxiliary) { Remove-Item -LiteralPath ${psSingleQuoted(promptFile)} -ErrorAction SilentlyContinue }`,
      // The standalone Node host exits after startup confirmation. Windows may
      // then stop its hidden observer, so the visible runner leaves a completion
      // receipt for cleanup on the next launch if that observer cannot finish.
      `  if ((Test-AutoOCAuxiliary) -and -not (Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue)) {`,
      completion,
      "  }",
      "}",
    ].join("\n");
    const encodedRunner = Buffer.from(runner, "utf16le").toString("base64");
    // The hidden observer launches ONE visible session. A descendant native
    // process (OpenCode executable or its Node runtime) confirms invocation;
    // starting PowerShell/cmd alone is explicitly insufficient.
    const observer = [
      "$ErrorActionPreference = 'Stop'",
      checkDirectory,
      "$session = $null; $confirmed = $false",
      `function Report($status, $ended) { if (-not (Test-AutoOCAuxiliary)) { throw 'AutoOC auxiliary directory changed' }; @{ attempt = ${psSingleQuoted(attempt)}; status = $status; ended = $ended; confirmed = $confirmed } | ConvertTo-Json -Compress | Set-Content -LiteralPath ${psSingleQuoted(stateFile)} -Encoding UTF8 }`,
      "try {",
      `  $session = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList @('-NoLogo', '-NoProfile', '-EncodedCommand', '${encodedRunner}') -WorkingDirectory ${psSingleQuoted(path.resolve(cwd))} -PassThru`,
      "  while (-not $session.HasExited) {",
      "    if (-not $confirmed) {",
      "      $all = @(Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,Name)",
      "      $parents = @($session.Id)",
      "      for ($depth = 0; $depth -lt 16 -and $parents.Count -gt 0; $depth++) {",
      "        $children = @($all | Where-Object { $parents -contains $_.ParentProcessId })",
      "        if (@($children | Where-Object { $_.Name -notmatch '^(powershell|pwsh|cmd|conhost|OpenConsole)\\.exe$' }).Count -gt 0) { $confirmed = $true; Report 'started' $false; break }",
      "        $parents = @($children | ForEach-Object { $_.ProcessId })",
      "      }",
      "    }",
      "    Start-Sleep -Milliseconds 100; $session.Refresh()",
      "  }",
      "  Report 'ended' $true",
      "} catch {",
      "  Report 'error' ($null -eq $session)",
      "  if ($null -ne $session) { $session.WaitForExit(); Report 'error' $true }",
      "} finally {",
      // The observer is the last writer of state.json. If the Node host has
      // exited, it owns final cleanup; the runner leaves a receipt as fallback.
      `  if ($null -ne $session -and $session.HasExited -and -not (Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue) -and (Test-AutoOCAuxiliary)) {`,
      completion,
      `    Remove-Item -LiteralPath ${psSingleQuoted(promptFile)}, ${psSingleQuoted(stateFile)}, ${psSingleQuoted(ignoreFile)} -ErrorAction SilentlyContinue`,
      `    try { if (@([System.IO.Directory]::GetFileSystemEntries(${psSingleQuoted(directory)})).Count -eq 1 -and (Test-Path -LiteralPath ${psSingleQuoted(completionFile)})) { Remove-Item -LiteralPath ${psSingleQuoted(completionFile)}; [System.IO.Directory]::Delete(${psSingleQuoted(directory)}, $false) } } catch { }`,
      "  }",
      "}",
    ].join("\n");
    const encodedObserver = Buffer.from(observer, "utf16le").toString("base64");
    if (encodedObserver.length > 30000 || encodedRunner.length > 30000) throw new Error("Interactive launcher configuration exceeds Windows command-line limit");
    const readState = () => {
      let state: { attempt?: string; status?: string; ended?: boolean; confirmed?: boolean };
      try { state = JSON.parse(fs.readFileSync(stateFile, "utf8").replace(/^\uFEFF/, "")); }
      catch { return; } // A partial write is retried; it is never a success.
      if (state.attempt !== attempt) return;
      if (state.status === "error") finish(new InteractiveTerminalLaunchUncertainError("Interactive CLI launcher failed; check the session and Windows process inspection availability"));
      else if (state.confirmed === true && (state.status === "started" || state.status === "ended")) finish();
      else if (state.status === "ended") finish(new InteractiveTerminalLaunchUncertainError("Interactive CLI exited without confirmed startup"));
      if (state.ended === true && (state.status === "ended" || state.status === "error")) { stopPolling(); cleanup(); }
    };
    poll = setInterval(readState, 100);
    timeout = setTimeout(() => finish(new InteractiveTerminalLaunchUncertainError("Interactive CLI startup was not confirmed within 30 seconds; prompt retained until session exit")), 30000);
    const launcher = spawn("powershell.exe", ["-NoLogo", "-NoProfile", "-EncodedCommand", encodedObserver], {
      // A detached hidden PowerShell can exit without executing its command on
      // Windows. The observer does not need a new process group; unref below
      // releases the host after confirmation while its visible session runs.
      detached: false, stdio: "ignore", windowsHide: true, env: { ...process.env, ...env },
    });
    launcher.on?.("error", () => { stopPolling(); cleanup(); finish(new Error("Could not start the interactive CLI observer")); });
    launcher.on?.("exit", () => {
      readState();
      stopPolling();
      finish(new InteractiveTerminalLaunchUncertainError("Interactive CLI observer exited without startup confirmation; prompt retained"));
    });
    launcher.unref();
  } catch (error) {
    stopPolling();
    cleanup(); // No session was launched when preparation/spawn throws.
    finish(error instanceof Error ? error : new Error(String(error)));
  }
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
