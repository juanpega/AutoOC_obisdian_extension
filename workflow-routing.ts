import * as vm from "vm";

// Shared by the Obsidian host and the forthcoming packaged runtime.
// This module has no dependency on Obsidian, settings or credentials.
export interface RoutingTransition {
  toStepId: string;
  mode: string;
  forceContinue?: boolean;
  condition?: string;
  evaluatePrompt?: string;
}

export interface RoutingStep {
  id: string;
  stepKind?: string;
  transitionMode?: string;
  evaluatePrompt?: string;
  forceContinue?: boolean;
  position?: { x: number; y: number };
  transitions?: RoutingTransition[];
}

// Older task steps carry a transition on the step itself. Code and delay
// steps historically use a success-only linear transition when none is set.
export function workflowStepTransitions(steps: RoutingStep[], index: number): RoutingTransition[] {
  const step = steps[index];
  if (!step) throw new Error("Workflow step is absent");
  if (step.transitions?.length) return step.transitions;
  const next = steps[index + 1];
  if (!next) return [];
  if (step.stepKind === "code" || step.stepKind === "delay") return [{toStepId:next.id,mode:"default"}];
  return [{toStepId:next.id,mode:step.transitionMode || "default",evaluatePrompt:step.evaluatePrompt,forceContinue:step.forceContinue}];
}

export function findWorkflowEntry<T extends RoutingStep>(steps: T[]): T | null {
  if (!steps.length) return null;
  const incoming = new Set(steps.flatMap(step => (step.transitions || []).map(t => t.toStepId)));
  const candidates = steps.filter(step => !incoming.has(step.id));
  if (!candidates.length) return steps[0];
  return candidates.sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0))[0];
}

export function evaluateWorkflowCondition(expression: string, input: string, outputs: Record<string, string>): boolean {
  if (!expression || !expression.trim()) return false;
  const sandbox = {
    input: input || "", outputs,
    String, Number, Boolean, Array, Object, JSON, Math, Date, RegExp,
    console: { log: () => {} },
  };
  const source = expression.trim().startsWith("return") ? `(function(){ ${expression} })()` : `(${expression})`;
  return !!vm.runInNewContext(source, sandbox, { timeout: 500 });
}

export async function resolveWorkflowTransition(
  steps: RoutingStep[], index: number, input: string, succeeded: boolean,
  transitions: RoutingTransition[], outputs: Record<string, string>,
  host: {
    evaluate: (transition: RoutingTransition, target: RoutingStep, input: string) => Promise<string>;
    onError: (kind: "eval" | "condition", error: unknown) => void;
  },
): Promise<{ nextStepId: string | null; reason: string }> {
  // Preserve the existing public routing contract. completeStep supplies a
  // default transition for ordinary linear execution, including failure gates.
  if (!transitions?.length) {
    const next = steps[index + 1];
    return { nextStepId: next?.id ?? null, reason: next ? "linear" : "end" };
  }
  for (const transition of transitions) {
    const target = steps.find(step => step.id === transition.toStepId);
    if (!target) continue;
    if (transition.mode === "force" || transition.forceContinue) return { nextStepId: target.id, reason: "force" };
    if (transition.mode === "default") {
      if (succeeded) return { nextStepId: target.id, reason: "default" };
    } else if (transition.mode === "eval") {
      try {
        const response = await host.evaluate(transition, target, input);
        if (/\bYES\b/i.test(response) && !/\bNO\b/i.test(response)) return { nextStepId: target.id, reason: "eval:yes" };
      } catch (error) { host.onError("eval", error); }
    } else if (transition.mode === "conditional") {
      try {
        if (evaluateWorkflowCondition(transition.condition || "", input, outputs)) return { nextStepId: target.id, reason: "conditional:true" };
      } catch (error) { host.onError("condition", error); }
    }
  }
  return { nextStepId: null, reason: "no-match" };
}
