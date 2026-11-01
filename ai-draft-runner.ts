import { spawn, type ChildProcess } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { CodexAppServerClient, resolveCodexBin } from "./codex-client";
import { CopilotCliClient, resolveCopilotBin } from "./copilot-client";
import { resolveOpencodeBin } from "./cli-launchers";
import { assertOpenCode2 } from "./opencode-version";
import type { DraftEngine } from "./ai-draft";

export interface DraftGenerationRequest {
  engine: DraftEngine;
  prompt: string;
  model?: string;
  reasoningEffort?: string;
  opencodePath?: string;
  opencode2Path?: string;
  codexPath?: string;
  copilotPath?: string;
}

function kill(child?: ChildProcess): void {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    killer.on("error", () => { try { child.kill(); } catch { /* already closed */ } });
  } else {
    try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill(); } catch { /* already closed */ } }
  }
}

/** Independent authoring session: no catalog, scheduler, execution lease or task journal. */
export async function generateDraftText(request: DraftGenerationRequest, signal: AbortSignal, timeoutMs = 180000): Promise<string> {
  if (signal.aborted) throw new Error("Generation cancelled.");
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "autooc-draft-"));
  let dispose = () => {};
  let rejectStopped: (error: Error) => void = () => {};
  let stopReason: Error | undefined;
  const stopped = new Promise<never>((_, reject) => { rejectStopped = reject; });
  const stop = (message: string) => { stopReason = new Error(message); rejectStopped(stopReason); dispose(); };
  const abort = () => stop("Generation cancelled. Your current draft has been kept.");
  const timer = setTimeout(() => stop("Generation timed out. Check your engine connection or try a smaller objective."), timeoutMs);
  signal.addEventListener("abort", abort, { once: true });
  const observe = (text: string) => {
    if (text.length > 1000000) stop("The AI response is too large. Try a smaller objective.");
  };
  // Install the race handlers before any provider can reject synchronously.
  const run = async (): Promise<string> => {
    if (request.engine === "codex") {
      const client = new CodexAppServerClient(resolveCodexBin(request.codexPath), folder, {
        onOutput: observe,
        onApproval: approval => { client.resolveApproval(approval.requestId, false); },
      });
      dispose = () => client.dispose();
      const result = await client.run(request.prompt, request.model, request.reasoningEffort, "never", { sandbox: "read-only", ephemeral: true, toolsDisabled: true });
      if (result.status !== "completed" || result.error) throw new Error(result.error || "Codex did not complete the draft.");
      return result.output;
    }
    if (request.engine === "copilot") {
      const client = new CopilotCliClient(resolveCopilotBin(request.copilotPath), folder, observe);
      dispose = () => client.dispose();
      const result = await client.run(request.prompt, { model: request.model, allowAllTools: false, timeoutMs });
      if (result.exitCode !== 0) throw new Error(result.error || "Copilot did not complete the draft.");
      return result.output;
    }
    const v2 = request.engine === "opencode2";
    let bin = resolveOpencodeBin((v2 ? request.opencode2Path : request.opencodePath) || "opencode");
    if (process.platform === "win32" && /\.(cmd|bat|ps1)$/i.test(bin)) {
      const npmRoot = path.join(path.dirname(bin), "node_modules");
      const candidates = v2 ? [
        path.join(npmRoot, "@opencode", "cli", "bin", "opencode.exe"),
        path.join(npmRoot, "@opencode", "cli", "node_modules", "@opencode", `cli-windows-${process.arch}`, "bin", "opencode.exe"),
        path.join(npmRoot, "@opencode", `cli-windows-${process.arch}`, "bin", "opencode.exe"),
      ] : ["-baseline", ""].flatMap(suffix => [
        path.join(npmRoot, "opencode-ai", "node_modules", `opencode-windows-${process.arch}${suffix}`, "bin", "opencode.exe"),
        path.join(npmRoot, `opencode-windows-${process.arch}${suffix}`, "bin", "opencode.exe"),
      ]);
      const native = candidates.find(candidate => fs.existsSync(candidate));
      if (!native) throw new Error("Select the native OpenCode .exe in AutoOC settings, or reinstall its CLI.");
      bin = native;
    }
    if (v2) await assertOpenCode2(bin);
    if (stopReason) throw stopReason;
    if (signal.aborted) throw new Error("Generation cancelled.");
    const args = ["run", v2 ? "--standalone" : "--pure", "--format", "json", "--print-logs", "--log-level", v2 ? "error" : "ERROR", "--agent", "autooc-draft", ...(request.model ? ["--model", request.model] : [])];
    const permission = { "*": "deny" };
    const permissions = [{ action: "*", resource: "*", effect: "deny" }];
    const instruction = "Return only the requested JSON definition. Never execute its objective.";
    const config = v2 ? { permissions, agents: { "autooc-draft": { mode: "primary", description: "Create an AutoOC JSON draft without tools", permissions, system: instruction } } }
      : { permission, agent: { "autooc-draft": { mode: "primary", description: "Create an AutoOC JSON draft without tools", permission, prompt: instruction } } };
    const env = {
      ...process.env,
      ...(v2 ? {} : { OPENCODE_PERMISSION: JSON.stringify(permission) }),
      OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
      OPENCODE_DISABLE_AUTOUPDATE: "true",
      OPENCODE_DISABLE_CLAUDE_CODE: "true", OPENCODE_DISABLE_LSP_DOWNLOAD: "true",
    };
    // Send the full request through stdin. No shell interpolation, command-line
    // length limit, or file-read tool is needed to obtain the instructions.
    const child = spawn(bin, args,
      { cwd: folder, env, shell: false, windowsHide: true, detached: process.platform !== "win32", stdio: ["pipe", "pipe", "pipe"] });
    dispose = () => kill(child);
    let stdout = "", stderr = "", pendingLine = "";
    child.stdout!.setEncoding("utf8"); child.stderr!.setEncoding("utf8");
    child.stdout!.on("data", chunk => {
      if (stdout.length > 1000000) return;
      stdout += chunk; observe(stdout); pendingLine += chunk;
      const lines = pendingLine.split(/\r?\n/); pendingLine = lines.pop() || "";
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (event.type === "error") stop(event.error?.data?.message || event.error?.message || "OpenCode returned an error.");
        } catch { /* Report malformed output when the CLI closes. */ }
      }
    });
    child.stderr!.on("data", chunk => {
      stderr = (stderr + chunk).slice(-8000);
      // Some API rejections leave `run` retrying without a terminal JSON event.
      // Ignore failures of the optional title agent; report our authoring turn.
      for (const line of stderr.split(/\r?\n/)) {
        if (!line.includes("agent=autooc-draft")) continue;
        const failure = line.match(/AI_APICallError: (.+)/)?.[1]?.replace(/"\s*$/, "");
        if (!failure) continue;
        const hint = /OpenCode \d+\.\d+\.\d+ or newer is required/.test(failure)
          ? "Update the OpenCode CLI or choose another AI engine, such as Codex."
          : /usage limit|quota|credits|balance|rate limit/i.test(failure)
            ? "Choose another AI engine or model, or review your provider's usage limits."
            : "Check the engine's sign-in and model, or choose another AI engine.";
        stop(`${failure}. ${hint}`);
      }
    });
    return new Promise<string>((resolve, reject) => {
      child.on("error", reject);
      child.stdin!.on("error", reject);
      child.on("close", code => {
        if (code !== 0) { reject(new Error(stderr.trim() || "OpenCode did not complete the draft.")); return; }
        try {
          const events = stdout.split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
          const failure = events.find(event => event.type === "error");
          if (failure) throw new Error(failure.error?.data?.message || failure.error?.message || "OpenCode returned an error.");
          resolve(events.filter(event => event.type === "text").map(event => event.part?.text || "").join(""));
        } catch (error) { reject(error); }
      });
      child.stdin!.end(request.prompt, "utf8");
    });
  };
  try { return await Promise.race([stopped, run()]); }
  finally {
    clearTimeout(timer); signal.removeEventListener("abort", abort); dispose();
    // Only our fresh OS temporary directory is removed; nothing is created in the vault.
    try { await fs.promises.rm(folder, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
    catch { /* A provider may still hold its OS temporary directory. Never touch vault files. */ }
  }
}
