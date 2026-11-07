import { INTERACTIVE_CLIS } from "./interactive-cli";
import type { InteractiveCliProvider } from "./interactive-cli";
import { openCodeInteractiveArgs } from "./opencode-profile";

export function isInteractiveCliProvider(value: unknown): value is InteractiveCliProvider {
  return INTERACTIVE_CLIS.some(cli => cli.id === value);
}

/**
 * Builds literal argv only; the caller supplies a short pointer to a UTF-8 task
 * file, not its full prompt. Authentication and permissions remain CLI-native.
 * reasoningEffort applies only to Codex; model/client support is checked by Codex.
 */
export function interactiveCliTaskArgs(
  provider: InteractiveCliProvider,
  model: string,
  agent: string,
  instruction: string,
  reasoningEffort?: string,
): string[] {
  if (!isInteractiveCliProvider(provider)) throw new Error("Unsupported interactive CLI provider.");
  if (provider === "opencode" || provider === "opencode2") {
    const args = openCodeInteractiveArgs(provider === "opencode2" ? 2 : 1, model, agent, instruction);
    // The shared helper always emits -m, even when native defaults are wanted.
    if (!model) args.splice(args.indexOf("-m"), 2);
    return args;
  }
  if (agent) throw new Error(`Interactive CLI agent selection is only supported for OpenCode, not ${provider}.`);
  const args = model ? ["--model", model] : [];
  if (provider === "copilot") return [...args, "--interactive", instruction];
  if (provider === "codex" && reasoningEffort) {
    // --config parses TOML; quote the value as one string, not a config fragment.
    args.push("--config", `model_reasoning_effort=${JSON.stringify(reasoningEffort)}`);
  }
  return [...args, "--", instruction];
}
