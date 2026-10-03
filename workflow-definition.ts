import { createHash } from "crypto";
import type { RoutingStep } from "./workflow-routing";
import { effectiveExecutionSettings } from "./execution-defaults";

const runtimeFields = new Set(["status", "lastRun", "output", "createdAt", "currentStep", "lastCodexThreadId", "lastCodexTurnId", "pendingCodexApproval", "runtimeExecution"]);

function withoutRuntime(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !runtimeFields.has(key)));
}
function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
  return value;
}
function freeze(value: any): any {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

export interface PreparedWorkflow {
  hash: string;
  workflow: { id: string; steps: RoutingStep[]; [key: string]: any };
  tasks: Array<Record<string, any>>;
  settings: Record<string, any>;
}

// Freeze the effective definition, including referenced tasks and engine
// defaults. Runtime output or an unrelated task cannot invalidate recovery.
export function prepareWorkflowDefinition(workflow: {id:string;steps:RoutingStep[]}, tasks: Array<{id:string}>, settings: Record<string, any>): PreparedWorkflow {
  if (!workflow.id || !workflow.steps.length || new Set(workflow.steps.map(s => s.id)).size !== workflow.steps.length) throw new Error("Invalid workflow identity or steps");
  const refs = [...new Set(workflow.steps.filter((s:any) => s.stepKind === "task" || !s.stepKind && s.taskId).map((s:any) => s.taskId))];
  const selected = refs.map(id => {
    const matches = tasks.filter(t => t.id === id);
    if (!id || matches.length !== 1) throw new Error("Missing or ambiguous referenced task");
    return withoutRuntime(matches[0]);
  });
  const payload = canonical({workflow:{...withoutRuntime(workflow),steps:workflow.steps.map(s => withoutRuntime(s as any))},tasks:selected,settings:effectiveExecutionSettings(settings)});
  const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  return freeze({...payload,hash});
}
