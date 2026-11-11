import * as os from "os";
import { readCliVersion, readOpenCodeOutput } from "./opencode-version";

/** Explicit local diagnostics only; never starts a thread or authenticates. */
export async function inspectCodexCli(bin: string): Promise<{ version: string; appServer: boolean }> {
  const version = await readCliVersion(bin);
  const help = await readOpenCodeOutput(bin, ["--help"], os.tmpdir(), 10000, 65536);
  return { version, appServer: /^\s*app-server(?:\s|$)/m.test(help) &&
    !(process.platform === "win32" && /\.(cmd|bat|ps1)$/i.test(bin)) };
}
