import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";

const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;

export interface SharedExternalIdentity { provider: string; project?: string; task?: string; }

/** Resolve only an executable, never a shell expression or a cwd-relative entry. */
export function resolveSharedWindowsTerminal(): string {
  if (process.platform !== "win32") throw new Error("Shared external terminal requires Windows and Windows Terminal (wt.exe).");
  const directories = (process.env.PATH || process.env.Path || "").split(path.delimiter)
    .map(value => value.trim().replace(/^"|"$/g, "")).filter(value => path.isAbsolute(value));
  const local = process.env.LOCALAPPDATA;
  const aliases = local && path.isAbsolute(local) ? path.join(local, "Microsoft", "WindowsApps") : undefined;
  if (aliases) directories.push(aliases);
  for (const directory of directories) {
    const candidate = path.join(directory, "wt.exe");
    try { if (fs.statSync(candidate).isFile()) return candidate; }
    catch (error) {
      // App Execution Aliases are reparse points. Node can deny following a
      // valid alias even though Windows can execute it. Limit this exception to
      // the user's known alias directory, with independent entry/link evidence;
      // arbitrary permission errors or broken/missing paths are not success.
      if (aliases && path.resolve(directory).toLowerCase() === path.resolve(aliases).toLowerCase()
          && ["EACCES", "EPERM"].includes((error as NodeJS.ErrnoException).code || "")) {
        try {
          if (fs.lstatSync(candidate).isSymbolicLink()
              && fs.readdirSync(directory).some(name => name.toLowerCase() === "wt.exe")) return candidate;
        } catch { /* Unproven alias: continue without launching a probe. */ }
      }
    }
  }
  throw new Error("Windows Terminal (wt.exe) was not found. Install/enable its app execution alias and add it to PATH, or choose another terminal destination. Nothing was launched.");
}

/**
 * wt is a router, not the session parent. An attempt-scoped, current-user-only
 * pipe transfers the launching observer's environment in memory and identifies
 * the actual runner. No secrets are serialized in scripts/files/command lines.
 */
export function sharedWindowsTerminalScripts(input: SharedExternalIdentity & {
  terminal: string; cwd: string; attempt: string; runner: string; runnerFile: string;
}) {
  const canonical = fs.realpathSync(input.cwd).replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  const color = "#" + createHash("sha256").update(canonical).digest("hex").slice(0, 6);
  // Terminal has its own semicolon parser, even with shell:false. Display-only
  // data is deliberately restricted; launch data stays in the owned runner file.
  const display = (value: string) => value.replace(/[^\p{L}\p{N} ._()-]/gu, "_").slice(0, 70);
  const title = [input.project || path.basename(input.cwd), input.provider, input.task].filter(Boolean).map(value => display(value!)).join(" - ");
  const pipeName = `autooc-terminal-${input.attempt}`;
  // Disposing the attempt pipe releases an outstanding read/write on timeout.
  // Never include exception messages or transferred data in diagnostics.
  const boundedHandshake = [
    "function Wait-AutoOCHandshake($task) {",
    "  if (-not $task.Wait(5000)) { $script:autoocErrorCode = 'handshake-timeout'; throw 'AutoOC handshake timed out' }",
    "  $task.GetAwaiter().GetResult()",
    "}",
  ].join("\n");
  const runnerPrefix = [
    boundedHandshake,
    `$pipe = New-Object IO.Pipes.NamedPipeClientStream('.', '${pipeName}', [IO.Pipes.PipeDirection]::InOut, [IO.Pipes.PipeOptions]::Asynchronous)`,
    "try {",
    "  $pipe.Connect(10000)",
    "  $writer = New-Object IO.StreamWriter($pipe); $writer.AutoFlush = $true",
    "  $reader = New-Object IO.StreamReader($pipe)",
    // Windows PowerShell exposes VoidTaskResult for non-generic write tasks.
    // Discard only write results; reads and the CLI's own stdout must survive.
    "  $null = Wait-AutoOCHandshake ($writer.WriteLineAsync([string]$PID))",
    "  $environment = (Wait-AutoOCHandshake ($reader.ReadLineAsync())) | ConvertFrom-Json",
    "  if ($null -eq $environment) { throw 'AutoOC environment handoff failed' }",
    "  foreach ($key in @([Environment]::GetEnvironmentVariables('Process').Keys)) { [Environment]::SetEnvironmentVariable([string]$key, $null, 'Process') }",
    "  foreach ($entry in $environment.PSObject.Properties) { [Environment]::SetEnvironmentVariable($entry.Name, [string]$entry.Value, 'Process') }",
    "  $null = Wait-AutoOCHandshake ($writer.WriteLineAsync('environment-applied'))",
    "} catch { Write-Error 'AutoOC: shared terminal environment handshake failed' -ErrorAction Continue; throw 'AutoOC shared handshake failed'",
    "} finally { $pipe.Dispose() }",
  ].join("\n");
  const runnerScript = `$ErrorActionPreference = 'Stop'\n${runnerPrefix}\n${input.runner}`;
  // Only a tiny literal-path invocation is encoded to bypass wt's semicolon
  // grammar. The actual runner is readable source, without nested compression.
  const invocation = Buffer.from(`& ${quote(input.runnerFile)}`, "utf16le").toString("base64");
  const observerLaunch = [
    boundedHandshake,
    "  $stage = 'dispatch'; Report 'pending' $false",
    "  $security = New-Object IO.Pipes.PipeSecurity",
    "  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User",
    "  $security.SetAccessRuleProtection($true, $false)",
    "  $security.AddAccessRule((New-Object IO.Pipes.PipeAccessRule($sid, 'FullControl', 'Allow')))",
    `  $pipe = New-Object IO.Pipes.NamedPipeServerStream('${pipeName}', [IO.Pipes.PipeDirection]::InOut, 1, [IO.Pipes.PipeTransmissionMode]::Byte, [IO.Pipes.PipeOptions]::Asynchronous, 4096, 4096, $security)`,
    "  try {",
    "    $connection = $pipe.BeginWaitForConnection($null, $null)",
    // The encoded literal path protects spaces, quotes and wt semicolons.
    // cwd/bin/CLI argv never pass through Terminal's command grammar.
    `    $router = Start-Process -FilePath ${quote(input.terminal)} -ArgumentList @('-w', 'AutoOC', 'new-tab', '--title', ${quote('"' + title + '"')}, '--tabColor', '${color}', '--suppressApplicationTitle', 'powershell.exe', '-NoLogo', '-NoProfile', '-EncodedCommand', '${invocation}') -PassThru -ErrorAction Stop`,
    "    $dispatched = $true",
    "    $stage = 'runner-connect'; Report 'pending' $false",
    "    if (-not $connection.AsyncWaitHandle.WaitOne(10000)) { $autoocErrorCode = 'handshake-timeout'; throw 'AutoOC runner did not connect; check Windows Terminal' }",
    "    $pipe.EndWaitForConnection($connection)",
    "    $stage = 'runner-identity'; Report 'pending' $false",
    "    $reader = New-Object IO.StreamReader($pipe)",
    "    $sessionId = 0",
    "    if (-not [int]::TryParse((Wait-AutoOCHandshake ($reader.ReadLineAsync())), [ref]$sessionId) -or $sessionId -le 0) { throw 'Invalid AutoOC runner identity' }",
    "    $session = Get-Process -Id $sessionId -ErrorAction Stop",
    "    $stage = 'environment-handoff'; Report 'pending' $false",
    "    $writer = New-Object IO.StreamWriter($pipe); $writer.AutoFlush = $true",
    "    $environment = @{}; foreach ($entry in [Environment]::GetEnvironmentVariables('Process').GetEnumerator()) { $environment[[string]$entry.Key] = [string]$entry.Value }",
    "    $null = Wait-AutoOCHandshake ($writer.WriteLineAsync(($environment | ConvertTo-Json -Compress)))",
    "    $stage = 'environment-ack'; Report 'pending' $false",
    "    if ((Wait-AutoOCHandshake ($reader.ReadLineAsync())) -cne 'environment-applied') { throw 'AutoOC environment acknowledgement failed' }",
    "  } finally { $pipe.Dispose() }",
  ].join("\n");
  return { color, title, runnerPrefix, observerLaunch, runnerScript };
}
