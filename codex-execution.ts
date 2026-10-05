import type { CodexAppServerClient, CodexRunResult } from "./codex-client";

export interface CodexExecutionRequest {
  prompt: string;
  model?: string;
  reasoningEffort?: string;
  interactive?: boolean;
}

// Both hosts supply the same App Server client. Its approval callback remains
// owned by the host; this adapter never grants permissions or opens a UI.
export async function executeCodexTask(
  client: Pick<CodexAppServerClient, "run">,
  request: CodexExecutionRequest,
): Promise<CodexRunResult> {
  if (!request.prompt?.trim()) throw new Error("Codex task prompt is empty");
  return await client.run(request.prompt, request.model || undefined,
    request.reasoningEffort || undefined, request.interactive ? "on-request" : "never");
}
