export type OpenCodeMajor = 1 | 2;

export const OPENCODE2_DEFAULTS = Object.freeze({
  opencode2Path: "opencode",
  defaultOpencode2Model: "",
  defaultOpencode2Agent: "build",
});

export function isOpenCodeTask(kind?: string): boolean {
  return !kind || kind === "opencode" || kind === "opencode2";
}

/** Version 1 retains its historical invocation. Version 2 has a strict parser. */
export function openCodeRunArgs(major: OpenCodeMajor, model: string, agent: string, forceModel = false): string[] {
  if (major === 2) return ["run", "--standalone", "--print-logs", "--log-level", "info", "--auto",
    "--model", model, ...(forceModel ? [] : ["--agent", agent])];
  return ["run", "--print-logs", "--log-level", "INFO", "--auto", "-m", model,
    ...(forceModel ? [] : ["--agent", agent]), "--dangerously-skip-permissions"];
}

export function openCodeInteractiveArgs(major: OpenCodeMajor, model: string, agent: string, prompt: string): string[] {
  // V2's root TUI no longer accepts --model/--agent. mini supports both.
  return [...(major === 2 ? ["mini", "--standalone"] : []), "-m", model,
    ...(agent ? ["--agent", agent] : []), "--prompt", prompt];
}
