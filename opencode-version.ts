import { execFile } from "child_process";
import * as path from "path";
import * as os from "os";

export function parseOpenCodeVersion(text: string): { version: string; major: number } | undefined {
  const match = text.trim().match(/^(?:opencode\s+)?v?(\d+)\.(\d+)\.(\d+)(?:[-+][\w.-]+)?$/i);
  return match ? { version: match[0], major: Number(match[1]) } : undefined;
}

/** Read-only version probe, never a task or a retry of a task. No shell expansion. */
export async function detectOpenCodeVersion(bin: string): Promise<{ version: string; major: number }> {
  if (!bin || !path.isAbsolute(bin) && !/^[\w.-]+$/.test(bin)) throw new Error("Choose an absolute OpenCode executable path or a command name without arguments.");
  let command = bin, args = ["--version"];
  if (process.platform === "win32" && !/\.exe$/i.test(bin)) {
    command = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    const script = `$ErrorActionPreference = 'Stop'; & '${bin.replace(/'/g, "''")}' --version; exit $LASTEXITCODE`;
    args = ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")];
  }
  const output = await new Promise<string>((resolve, reject) => execFile(command, args,
    { cwd: os.tmpdir(), windowsHide: true, timeout: 10000, maxBuffer: 65536, encoding: "utf8" },
    (error, stdout) => error ? reject(new Error("Could not check the OpenCode version. Check its executable path in AutoOC Settings.")) : resolve(stdout)));
  const detected = parseOpenCodeVersion(output);
  if (!detected) throw new Error("The executable did not report a supported OpenCode version. Check its path in AutoOC Settings.");
  return detected;
}

export async function assertOpenCode2(bin: string): Promise<void> {
  const detected = await detectOpenCodeVersion(bin);
  if (detected.major !== 2) throw new Error(`OpenCode 2 CLI requires version 2.x; detected ${detected.version}. Select its executable in AutoOC Settings, or use an OpenCode 1 task. Nothing was launched.`);
}
