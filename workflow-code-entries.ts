import { codeStepDisplay } from "./workflow-code-step";
/** Inline code stays owned by its workflow. */
export interface CodeStepSource {
  id: string;
  stepKind: string;
  name?: string;
  area?: string;
  code?: string;
  status?: string;
  output?: string;
  lastRun?: string;
}
export interface CodeWorkflowSource<S extends CodeStepSource = CodeStepSource> {
  id: string;
  name: string;
  area?: string;
  steps: S[];
}
export interface WorkflowCodeEntry<W extends CodeWorkflowSource = CodeWorkflowSource> {
  workflow: W;
  step: W["steps"][number];
  stepIndex: number;
  name: string;
  area: string;
  status: string;
}

export function workflowCodeEntries<W extends CodeWorkflowSource>(workflows: W[]): WorkflowCodeEntry<W>[] {
  return workflows.flatMap(workflow => workflow.steps.flatMap((step, stepIndex) => step.stepKind === "code" ? [{
    workflow, step, stepIndex,
    name: step.name?.trim() || `Code step ${stepIndex + 1}`,
    area: step.area?.trim() || workflow.area?.trim() || "No area",
    // Workflow completion does not imply that every branch ran.
    status: codeStepDisplay(step).status,
  }] : []));
}

export function matchesWorkflowCodeEntry(entry: WorkflowCodeEntry, filters: { text: string; status: string; area: string }): boolean {
  const searchable = `${entry.name}\n${entry.workflow.name}\n${entry.area}\n${entry.step.code || ""}`.toLowerCase();
  return searchable.includes(filters.text.toLowerCase()) &&
    (filters.status === "all" || entry.status === filters.status) &&
    (filters.area === "all" || entry.area === filters.area);
}
