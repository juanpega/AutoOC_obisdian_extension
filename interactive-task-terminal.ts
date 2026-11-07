import type { InteractiveCliProvider } from "./interactive-cli";

/** A host-owned terminal launch, separate from durable workflow definitions. */
export interface InteractiveTaskTerminalRequest {
  provider?: InteractiveCliProvider;
  bin: string;
  cwd: string;
  label: string;
  major: 1 | 2;
  model: string;
  agent: string;
  prompt: string;
  reasoningEffort?: string;
  signal?: AbortSignal;
}

export interface InteractiveTaskTerminalOptions {
  destination?: "integrated" | "external";
  launch?: (request: InteractiveTaskTerminalRequest) => Promise<void>;
}

export class InteractiveTerminalLaunchUncertainError extends Error {
  readonly code = "AUTOOC_TERMINAL_UNCERTAIN";
}
