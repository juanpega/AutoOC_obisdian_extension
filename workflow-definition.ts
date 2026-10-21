import { createHash } from "crypto";
import type { RoutingStep } from "./workflow-routing";
import { effectiveExecutionSettings } from "./execution-defaults";
import { captureJsonStructure, encodeCapturedJson } from "./cooperative-json";
import { setImmediate } from "timers";
import { performance } from "perf_hooks";

const runtimeFields = new Set(["status", "lastRun", "output", "createdAt", "currentStep", "lastCodexThreadId", "lastCodexTurnId", "pendingCodexApproval", "runtimeExecution", "legacyExecution"]);

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
function definitionPayload(workflow: {id:string;steps:RoutingStep[]}, tasks: Array<{id:string}>, settings: Record<string, any>) {
  if (!workflow.id || !workflow.steps.length || new Set(workflow.steps.map(s => s.id)).size !== workflow.steps.length) throw new Error("Invalid workflow identity or steps");
  const refs = [...new Set(workflow.steps.filter((s:any) => s.stepKind === "task" || !s.stepKind && s.taskId).map((s:any) => s.taskId))];
  const selected = refs.map(id => {
    const matches = tasks.filter(t => t.id === id);
    if (!id || matches.length !== 1) throw new Error("Missing or ambiguous referenced task");
    return withoutRuntime(matches[0]);
  });
  return canonical({workflow:{...withoutRuntime(workflow),steps:workflow.steps.map(s => withoutRuntime(s as any))},tasks:selected,settings:effectiveExecutionSettings(settings)});
}

export function prepareWorkflowDefinition(workflow: {id:string;steps:RoutingStep[]}, tasks: Array<{id:string}>, settings: Record<string, any>): PreparedWorkflow {
  const payload = definitionPayload(workflow,tasks,settings);
  // Keep the historical compact canonical bytes, without allocating a whole
  // encoded copy of code/prompts on every validation and progress projection.
  const digest = createHash("sha256");
  for (const part of encodeCapturedJson(captureJsonStructure(payload, 0))) digest.update(part, "utf8");
  const hash = digest.digest("hex");
  return freeze({...payload,hash});
}

// Capture and detach the effective structure before the first yield. Strings
// are immutable references; canonical copies are frozen without freezing the
// editable catalog. The compact byte stream is EXACTLY the historical hash.
export async function prepareWorkflowDefinitionAsync(workflow: {id:string;steps:RoutingStep[]}, tasks: Array<{id:string}>, settings: Record<string,any>): Promise<PreparedWorkflow> {
  const payload = freeze(definitionPayload(workflow,tasks,settings));
  const captured = captureJsonStructure(payload,0), digest = createHash("sha256");
  // Also yield for many small definitions whose aggregate would monopolize a
  // turn even though no individual definition exhausts the slice budget.
  await new Promise<void>(resolve=>setImmediate(resolve));
  let deadline=performance.now()+4;
  for (const part of encodeCapturedJson(captured)) {
    digest.update(part,"utf8");
    if (performance.now()>=deadline) {
      await new Promise<void>(resolve=>setImmediate(resolve));
      deadline=performance.now()+4;
    }
  }
  return Object.freeze({...payload,hash:digest.digest("hex")});
}
