import type { InteractiveCliProvider } from "./interactive-cli";

/** Ephemeral host association; never persisted in a workflow definition. */
export interface TerminalPageContext { pageId: string; claimId: string; }

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
  page?: TerminalPageContext;
}

export interface InteractiveTaskTerminalOptions {
  destination?: "integrated" | "external";
  launch?: (request: InteractiveTaskTerminalRequest) => Promise<void>;
}

export class InteractiveTerminalLaunchUncertainError extends Error {
  readonly code = "AUTOOC_TERMINAL_UNCERTAIN";
}
