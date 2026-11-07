import * as fs from "fs";
import * as path from "path";
import { INTERACTIVE_CLIS, resolveInteractiveCli } from "./interactive-cli";
import { interactiveCliTaskArgs, isInteractiveCliProvider } from "./interactive-cli-profile";
import { isOpenCodeTask } from "./opencode-profile";
import { assertOpenCode2 } from "./opencode-version";
import { openOpencodeCli, openOpencodeCliLongPromptWindows, shSingleQuoted, resolveLinuxTerminal } from "./cli-launchers";
import { createAuxiliaryDirectory, completeAuxiliaryDirectory, auxiliaryCompletionRecord, AUXILIARY_COMPLETION } from "./execution-files";
import type { InteractiveTaskTerminalRequest } from "./interactive-task-terminal";

export function getCliTaskValidationError(task: Readonly<Record<string, any>>): string | null {
  if (task.taskKind !== "cli") return task.cliProvider !== undefined ? "cliProvider is only valid for taskKind cli." : null;
  if (!isInteractiveCliProvider(task.cliProvider)) return "CLI tasks require a known cliProvider: opencode, opencode2, codex, copilot, or claude.";
  if (task.interactiveTerminal !== true) return "CLI tasks require interactiveTerminal: true.";
  if (typeof task.prompt !== "string" || !task.prompt.trim()) return "CLI tasks require a non-empty prompt.";
  for (const field of ["codeAllowVault", "codeAllowFiles", "codeAllowTerminal", "copilotAllowAllTools", "useRalphLoop", "createBranch"]) {
    if (task[field] !== undefined && task[field] !== false) return `${field} is not supported for interactive CLI tasks.`;
  }
  if (task.branch !== undefined && task.branch !== "") return "branch is not supported for interactive CLI tasks.";
  if (task.model !== undefined && typeof task.model !== "string") return "CLI model must be a string when provided.";
  if (task.agent !== undefined && (typeof task.agent !== "string" || (task.agent !== "" && !isOpenCodeTask(task.cliProvider)))) return "agent is only supported for OpenCode CLI providers.";
  if (task.forceModel !== undefined && typeof task.forceModel !== "boolean") return "forceModel must be a boolean when provided.";
  if (task.reasoningEffort !== undefined && (task.cliProvider !== "codex" || typeof task.reasoningEffort !== "string" || !task.reasoningEffort.trim())) return "reasoningEffort is only valid as a non-empty string for the Codex CLI provider.";
  return null;
}

export function prepareCliTask(task:Readonly<Record<string,any>>, settings:Readonly<Record<string,any>>, cwd:string, prompt:string, signal?:AbortSignal):InteractiveTaskTerminalRequest {
  const error = getCliTaskValidationError(task);
  if (error) throw new Error(error);
  if (task.taskKind !== "cli") throw new Error("Expected an interactive CLI task.");
  if (signal?.aborted) throw new Error("CLI task cancelled before launch.");
  if (!path.isAbsolute(cwd) || !fs.statSync(cwd).isDirectory()) throw new Error("CLI task requires an existing absolute project directory.");
  if (!prompt.trim()) throw new Error("CLI task prompt must be nonempty.");
  const cli = INTERACTIVE_CLIS.find(cli=>cli.id === task.cliProvider)!;
  // Menu visibility never disables a scheduled task; the executable still must exist.
  const bin = resolveInteractiveCli(cli.id, settings[cli.pathKey]);
  if (!bin) throw new Error(`${cli.label} executable was not found. Check AutoOC Settings.`);
  return {provider:cli.id,bin,cwd,label:task.name || cli.label,major:cli.id === "opencode2" ? 2 : 1,
    model:task.model || "",agent:task.forceModel ? "" : task.agent || "",prompt,reasoningEffort:task.reasoningEffort,signal};
}

export async function launchExternalCliTask(request:InteractiveTaskTerminalRequest, linuxTerminal?:string):Promise<void> {
  if (!request.provider || !isInteractiveCliProvider(request.provider)) throw new Error("A CLI task provider is required.");
  if (request.signal?.aborted) throw new Error("CLI task cancelled before launch.");
  if (request.provider === "opencode2") await assertOpenCode2(request.bin);
  if (request.signal?.aborted) throw new Error("CLI task cancelled before launch.");
  const argsForPrompt = (instruction:string)=>interactiveCliTaskArgs(request.provider!,request.model,request.agent,instruction,request.reasoningEffort);
  if (process.platform === "win32") {
    await new Promise<void>((resolve,reject)=>openOpencodeCliLongPromptWindows(request.bin,request.cwd,{},request.model,request.agent,request.prompt,
      {onLaunched:resolve,onError:reject,promptArgs:argsForPrompt}));
    return;
  }
  if (!["linux", "darwin"].includes(process.platform)) throw new Error("Interactive CLI tasks require Windows, macOS or Linux.");
  if (process.platform === "linux" && !resolveLinuxTerminal(linuxTerminal)) throw new Error("No supported Linux terminal is available. Nothing was launched.");
  // The visible shell owns the prompt until its CLI exits, even after Node exits.
  const directory = createAuxiliaryDirectory(request.cwd,"interactive");
  const promptFile = path.join(directory,"prompt.txt"), scriptFile = path.join(directory,"launch.sh");
  let scriptWritten = false;
  const cleanupBeforeLaunch = () => {
    for (const parent of [path.dirname(path.dirname(directory)),path.dirname(directory),directory]) {
      const stat = fs.lstatSync(parent);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("CLI auxiliary directory changed; input preserved.");
    }
    if (scriptWritten) fs.unlinkSync(scriptFile);
    completeAuxiliaryDirectory(directory,"interactive");
  };
  try {
  fs.writeFileSync(promptFile,request.prompt,{encoding:"utf8",flag:"wx",mode:0o600});
  const instruction = `Read ${path.relative(request.cwd,promptFile).split(path.sep).join("/")} as UTF-8 and follow its instructions.`;
  const q = shSingleQuoted;
  const command = [request.bin,...argsForPrompt(instruction)].map(q).join(" ");
  const script = ["#!/bin/sh", "cleanup() {", "  status=$?",
    `  if [ -d ${q(directory)} ] && [ ! -L ${q(directory)} ] && [ ! -L ${q(path.dirname(directory))} ] && [ ! -L ${q(path.dirname(path.dirname(directory)))} ]; then`,
    `    rm -f -- ${q(promptFile)} ${q(scriptFile)}`,
    `    printf '%s' ${q(auxiliaryCompletionRecord(directory,"interactive"))} > ${q(path.join(directory,AUXILIARY_COMPLETION))}`,
    "  fi", "  exit \"$status\"", "}", "trap cleanup EXIT", command].join("\n") + "\n";
  fs.writeFileSync(scriptFile,script,{encoding:"utf8",flag:"wx",mode:0o700});
  scriptWritten = true;
  if (request.signal?.aborted) {
    throw new Error("CLI task cancelled before launch.");
  }
  } catch (error) { cleanupBeforeLaunch(); throw error; }
  // Node's spawn error proves the terminal process was not created. After a
  // spawn acknowledgement, only the visible script may clean its prompt.
  await new Promise<void>((resolve,reject)=>{
    let acknowledged = false;
    const failed = (error:Error) => {
      if (acknowledged) return;
      try { cleanupBeforeLaunch(); reject(error); } catch (cleanup) { reject(cleanup); }
    };
    try { openOpencodeCli("/bin/sh",request.cwd,{},[scriptFile],{linuxTerminal,onLaunched:()=>{acknowledged=true;resolve();},onError:failed}); }
    catch (error) { failed(error as Error); }
  });
}
