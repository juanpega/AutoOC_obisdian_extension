function extractSection(output: string, title: string): string {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = output.match(
    new RegExp(`(?:^|\\r?\\n)## ${escaped}\\s*(?:\\r?\\n)+([\\s\\S]*?)(?=(?:\\r?\\n){2}---(?:\\r?\\n){2}## |$)`)
  );
  return match ? match[1].trim() : "";
}

function extractContextForHandoff(output: string): string {
  const cleaned = output;
  if (!cleaned) return "";

  const response = cleaned.startsWith("## Response\n") || cleaned.startsWith("## Response\r\n") ? extractSection(cleaned, "Response") : "";
  const touchedFiles = extractSection(cleaned, "Touched files");
  const parts: string[] = [];

  if (response) {
    parts.push(`PRIMARY HANDOFF INPUT — use this as the main input for the current task:\n\n${response}`);
    if (touchedFiles) {
      parts.push(`DIAGNOSTIC ONLY — touched files (do not re-read unless the current task explicitly asks):\n\n${touchedFiles}`);
    }
  } else {
    // No explicit Response section: use the cleaned output as the primary input,
    // omitting the OpenCode trace so diagnostics don't leak into the handoff.
    const primary = cleaned;
    parts.push(`PRIMARY HANDOFF INPUT — use this as the main input for the current task:\n\n${primary}`);
  }

  return parts.join("\n\n");
}

export function workflowTaskPrompt(prompt: string, workflow: {handoffOutput?: boolean; steps: Array<{id:string;name?:string;stepKind?:string;taskId?:string}>}, previous?: {stepId:string;output:string}): string {
  if (!workflow.handoffOutput || !previous) return prompt;
  const previousStep = workflow.steps.find(s => s.id === previous.stepId);
  const sourceLine = previousStep
    ? `Source: step "${previousStep.name || previous.stepId}" (${previousStep.stepKind}${previousStep.taskId ? ` -> task ${previousStep.taskId}` : ""})`
    : `Source: step ${previous.stepId}`;
  const cleanOutput = extractContextForHandoff(String(previous.output || ""));
  const contextBlock = ["", "=== WORKFLOW HANDOFF CONTEXT ===", sourceLine,
    "The previous step's output below is the PRIMARY INPUT for this task.",
    "Touched files are DIAGNOSTIC ONLY — do not re-read them unless this task explicitly asks.", "",
    cleanOutput || String(previous.output || "").trim(), "=== END WORKFLOW HANDOFF CONTEXT ==="].join("\n");
  return `${prompt}\n${contextBlock}`;
}
