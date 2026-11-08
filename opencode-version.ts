import { execFile } from "child_process";
import * as path from "path";
import * as os from "os";

export function parseOpenCodeVersion(text: string): { version: string; major: number } | undefined {
  const match = text.trim().match(/^(?:opencode\s+)?v?(\d+)\.(\d+)\.(\d+)(?:[-+][\w.-]+)?$/i);
  return match ? { version: match[0], major: Number(match[1]) } : undefined;
}

/** Run a read-only CLI query. Quote each argument separately for Windows shims. */
export function readOpenCodeOutput(bin: string, args: string[], cwd: string, timeout: number, maxBuffer: number): Promise<string> {
  if (!bin || !path.isAbsolute(bin) && !/^[\w.-]+$/.test(bin)) throw new Error("Choose an absolute OpenCode executable path or a command name without arguments.");
  let command = bin;
  if (process.platform === "win32" && !/\.exe$/i.test(bin)) {
    command = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    const invocation = [bin, ...args].map(value => `'${value.replace(/'/g, "''")}'`).join(" ");
    const script = `$ErrorActionPreference = 'Stop'; [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); & ${invocation}; exit $LASTEXITCODE`;
    args = ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")];
  }
  return new Promise((resolve, reject) => execFile(command, args,
    { cwd, windowsHide: true, timeout, maxBuffer, encoding: "utf8" },
    (error, stdout) => error ? reject(error) : resolve(stdout)));
}

export async function detectOpenCodeVersion(bin: string): Promise<{ version: string; major: number }> {
  const output = await readOpenCodeOutput(bin, ["--version"], os.tmpdir(), 10000, 65536)
    .catch(() => { throw new Error("Could not check the OpenCode version. Check its executable path in AutoOC Settings."); });
  const detected = parseOpenCodeVersion(output);
  if (!detected) throw new Error("The executable did not report a supported OpenCode version. Check its path in AutoOC Settings.");
  return detected;
}

/** Read-only version check for CLIs whose version format is not OpenCode semver. */
export async function readCliVersion(bin: string): Promise<string> {
  const output = await readOpenCodeOutput(bin, ["--version"], os.tmpdir(), 10000, 65536)
    .catch(() => { throw new Error("Could not check the CLI version. Check its executable path in AutoOC Settings."); });
  const version = output.trim();
  if (!version) throw new Error("The CLI returned an empty version response.");
  return version.slice(0, 256);
}

export async function assertOpenCode2(bin: string): Promise<void> {
  const detected = await detectOpenCodeVersion(bin);
  if (detected.major !== 2) throw new Error(`OpenCode 2 CLI requires version 2.x; detected ${detected.version}. Select its executable in AutoOC Settings, or use an OpenCode 1 task. Nothing was launched.`);
}
