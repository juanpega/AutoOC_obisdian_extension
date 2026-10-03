// One set of effective execution defaults for the plugin and Node host.
export const EXECUTION_DEFAULTS = Object.freeze({
  opencodePath: "opencode",
  codexPath: "codex",
  copilotPath: "copilot",
  defaultCopilotModel: "",
  defaultAiEngine: "opencode" as const,
  defaultModel: "",
  defaultCodexModel: "",
  defaultCodexReasoningEffort: "medium",
  defaultAgent: "build",
  workingDirectory: "",
  cmdTemplate: '{opencode} run --model {model} -- "{prompt}"',
  taskTimeoutSeconds: 7200,
  defaultInteractiveTerminal: false,
  linuxTerminal: "",
});

export function effectiveExecutionSettings(settings:Record<string,any>):Record<string,any> {
  return Object.fromEntries(Object.entries(EXECUTION_DEFAULTS).map(([key,value]) =>
    [key, settings[key] === undefined ? value : settings[key]]));
}
