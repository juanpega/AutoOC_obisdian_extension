import { findWorkflowEntry, workflowStepTransitions, type RoutingStep } from "./workflow-routing";
import type { PreparedWorkflow } from "./workflow-definition";
import type { RunCheckpoint } from "./execution-journal";

export type NestedWorkflow = { id: string; steps: any[]; [key: string]: any };
export const MAX_WORKFLOW_DEPTH = 16;
const MAX_PLAN_STEPS = 10000;

/** Package references are resolved together, independently of their array order. */
export function validateNestedWorkflowExport(data: any): void {
  if (!Array.isArray(data.workflows) || !data.workflows.some((w:any)=>Array.isArray(w?.steps) && w.steps.some((s:any)=>s?.stepKind === "workflow"))) return;
  if (data.autoOCExport?.schemaVersion !== "1.7.0") throw new Error("Nested workflows require export schema 1.7.0");
  const workflows: NestedWorkflow[] = data.workflows.map((w:any)=>({...w,id:w.exportId,steps:w.steps?.map((s:any)=>({...s,workflowId:s.workflowExportId}))}));
  if(workflows.some(w=>typeof w.id!=="string" || !w.id) || new Set(workflows.map(w=>w.id)).size !== workflows.length) throw new Error("Missing or duplicate workflow exportId");
  const tasks=new Set((data.tasks || []).map((t:any)=>t.exportId));
  for(const w of workflows) {
    workflowClosure(w,workflows);
    for(const s of w.steps) if((s.stepKind === "task" || !s.stepKind) && !tasks.has(s.taskExportId)) throw new Error("Missing referenced task in nested workflow package");
  }
}

/** Resolve only reachable definitions. Reuse is allowed; recursive calls are not. */
export function workflowClosure(root: NestedWorkflow, catalog: NestedWorkflow[] = []): NestedWorkflow[] {
  const found = new Map<string, NestedWorkflow>();
  let visits=0;
  const visit = (workflow: NestedWorkflow, ancestors: string[]) => {
    if(++visits>MAX_PLAN_STEPS)throw new Error(`Expanded workflow exceeds ${MAX_PLAN_STEPS} invocations`);
    if (ancestors.includes(workflow.id)) throw new Error(`Workflow nesting cycle: ${[...ancestors, workflow.id].join(" -> ")}`);
    if (ancestors.length >= MAX_WORKFLOW_DEPTH) throw new Error(`Workflow nesting exceeds ${MAX_WORKFLOW_DEPTH} levels`);
    if (!workflow.id || !Array.isArray(workflow.steps) || !workflow.steps.length ||
        workflow.steps.some(step => !step || typeof step.id !== "string" || !step.id) ||
        new Set(workflow.steps.map(step => step.id)).size !== workflow.steps.length) throw new Error("Invalid workflow identity or steps");
    for (const step of workflow.steps) {
      if (step.stepKind !== "workflow") continue;
      const matches = catalog.filter(item => item.id === step.workflowId);
      if (typeof step.workflowId !== "string" || !step.workflowId || matches.length !== 1) throw new Error(`Missing or ambiguous referenced workflow (${step.workflowId || step.id})`);
      const child = matches[0];
      visit(child, [...ancestors, workflow.id]);
      found.set(child.id, child);
    }
  };
  visit(root, []);
  return [...found.values()];
}

export interface ExecutionStep extends RoutingStep {
  [key: string]: any;
}
export interface StepScope {
  workflow: NestedWorkflow;
  path: string[];
  localId: string;
  rootStepId: string;
  handoffBranch: boolean;
  returnId?: string;
  enterId?: string;
  boundary?: "enter" | "return";
}
export interface WorkflowPlan { steps: ExecutionStep[]; entry: string; scopes: Map<string, StepScope>; }

/** Internal boundaries use one journal/lease, so stop and recovery retain exact leaf identities. */
export function workflowExecutionPlan(definition: Pick<PreparedWorkflow, "workflow" | "workflows">): WorkflowPlan {
  const root = definition.workflow as NestedWorkflow;
  const scopes = new Map<string, StepScope>(), steps: ExecutionStep[] = [];
  const used = new Set(root.steps.map(step => step.id));
  const internal = (parts: string[]) => {
    let id = `@nested:${JSON.stringify(parts)}`;
    while (used.has(id)) id = "@" + id;
    used.add(id); return id;
  };
  const expand = (workflow: NestedWorkflow, path: string[], returnId?: string, enterId?: string, inheritedBranch=false): string => {
    const ids = new Map(workflow.steps.map(step => [step.id, path.length ? internal([...path, step.id]) : step.id]));
    const entries = new Map(workflow.steps.map(step => [step.id, step.stepKind === "workflow" ? internal([...path, step.id, "enter"]) : ids.get(step.id)!]));
    for (const [index, source] of workflow.steps.entries()) {
      const id = ids.get(source.id)!;
      const scope: StepScope = { workflow, path, localId: source.id, rootStepId: path[0] || source.id, returnId, enterId, handoffBranch:inheritedBranch || !!workflow.handoffBranch };
      const transitions = workflowStepTransitions(workflow.steps, index).map(edge => {
        if (!entries.has(edge.toStepId)) throw new Error("Workflow transition references a missing step");
        return { ...edge, toStepId: entries.get(edge.toStepId)! };
      });
      if (source.stepKind === "workflow") {
        const child = definition.workflows?.find(item => item.id === source.workflowId) as NestedWorkflow | undefined;
        if (!child) throw new Error("Referenced workflow is unavailable");
        const entryId = entries.get(source.id)!;
        scopes.set(entryId, { ...scope, boundary: "enter" });
        const entryStep: ExecutionStep = { id: entryId, stepKind: "workflow", transitions: [] };
        steps.push(entryStep);
        const childEntry = expand(child, [...path, source.id], id, entryId, scope.handoffBranch);
        entryStep.transitions = [{toStepId:childEntry, mode:"default"}];
        scopes.set(id, { ...scope, boundary: "return" });
      } else scopes.set(id, scope);
      steps.push({...source, id, transitions});
      if (steps.length > MAX_PLAN_STEPS) throw new Error(`Expanded workflow exceeds ${MAX_PLAN_STEPS} steps`);
    }
    return entries.get(findWorkflowEntry(workflow.steps)!.id)!;
  };
  const entry = expand(root, []);
  return { steps, entry, scopes };
}

/** Outputs are local to this invocation, even when the same child is called again. */
export function workflowStepContext(plan: WorkflowPlan, stepId: string, state: RunCheckpoint) {
  const scope = plan.scopes.get(stepId)!;
  let start = 0;
  if (scope.enterId) {
    for (let i = state.steps.length - 1; i >= 0; i--) if (state.steps[i].stepId === scope.enterId) { start = i + 1; break; }
  }
  const outputs: Record<string, string> = Object.create(null);
  let previous: {stepId:string;output:string} | undefined;
  for (const item of state.steps.slice(start)) {
    const known = plan.scopes.get(item.stepId);
    if (item.status === "in_flight" || !known || known.boundary === "enter" || JSON.stringify(known.path) !== JSON.stringify(scope.path)) continue;
    outputs[known.localId] = item.output || "";
    previous = {stepId:known.localId,output:item.output || ""};
  }
  const input = previous?.output ?? (scope.enterId ? state.steps[start - 1]?.output || "" : "");
  return { scope, outputs, input, previous: previous || (scope.enterId ? {stepId:"workflow input",output:input} : undefined) };
}

export function workflowPlanNext(plan: WorkflowPlan, stepId: string, next: string | null): string | null {
  return next || plan.scopes.get(stepId)?.returnId || null;
}
