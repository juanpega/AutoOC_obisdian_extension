import { ExecutionJournal, type RunCheckpoint } from "./execution-journal";
import { resolveWorkflowTransition, workflowStepTransitions, type RoutingStep, type RoutingTransition } from "./workflow-routing";
import { prepareWorkflowDefinition, type PreparedWorkflow } from "./workflow-definition";

export interface WorkflowSessionHost {
  // The adapter must settle only after the actual task result. A launched
  // process is not automatically a completed non-interactive task.
  execute(step: RoutingStep, input: string, outputs: Record<string, string>, signal?: AbortSignal): Promise<{ succeeded: boolean; output: string; cancelled?: boolean }>;
  evaluate(transition: RoutingTransition, target: RoutingStep, input: string): Promise<string>;
  redact(text: string): string;
  onTransitionError(kind: "eval" | "condition", error: unknown): void;
  onCheckpoint?(checkpoint:RunCheckpoint):Promise<void>;
}

// Host-neutral orchestration, with a durable boundary before and after effects.
// No settings writes, GUI, CLI spawning or implicit retry lives in this layer.
export async function advanceWorkflowSession(
  journal: ExecutionJournal, definition: PreparedWorkflow, host: WorkflowSessionHost,
  options: {signal?: AbortSignal; maxSteps?: number} = {},
): Promise<RunCheckpoint> {
  const verified = prepareWorkflowDefinition(definition.workflow, definition.tasks as Array<{id:string}>, definition.settings);
  const checkpoint = journal.snapshot();
  if (verified.hash !== definition.hash || checkpoint.definitionHash !== verified.hash || checkpoint.workflowId !== verified.workflow.id) throw new Error("Workflow definition does not match execution checkpoint");
  const steps = verified.workflow.steps;
  if (new Set(steps.map(step => step.id)).size !== steps.length) throw new Error("Duplicate workflow step identity");
  const limit = options.maxSteps ?? 10000;
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("Invalid execution step limit");
  await host.onCheckpoint?.(journal.snapshot());
  for (let count = 0; count < limit; count++) {
    const state = journal.snapshot();
    const observed=state.phase === "in_flight" ? state.steps[state.steps.length-1].result : undefined;
    if (state.phase === "in_flight" && !observed) throw new Error("Interrupted step requires reconciliation before continuation");
    if (!["ready","in_flight"].includes(state.phase) || options.signal?.aborted) return state;
    const index = steps.findIndex(step => step.id === state.nextStepId);
    if (index < 0) throw new Error("Checkpoint step is absent from workflow definition");
    const step = steps[index];
    const outputs: Record<string, string> = Object.create(null);
    for (const previous of state.steps) outputs[previous.stepId] = previous.output || "";
    const input = state.steps.length ? state.steps[state.steps.length - 1].output || "" : "";
    if(!observed) {
      await journal.begin(step.id);
      try {
        await host.onCheckpoint?.(journal.snapshot());
      } catch (error) {
        // No adapter effects yet. Persist that known boundary; if this write
        // also fails, preserve uncertainty rather than replaying implicitly.
        await journal.finish(step.id, false, "[progress publication failed before step effects]", null);
        throw error;
      }
      if (options.signal?.aborted) {
        await journal.finish(step.id,false,"[cancelled before step effects]",null);
        await host.onCheckpoint?.(journal.snapshot());
        return journal.snapshot();
      }
    }
    // Exceptions (transport loss, crash, abort) leave the checkpoint in flight.
    // Adapters return succeeded:false for a known, observed execution failure.
    const result = observed || await host.execute(step, input, outputs, options.signal);
    if (typeof result.succeeded !== "boolean" || typeof result.output !== "string") throw new Error("Invalid execution result");
    if (result.cancelled !== undefined && (typeof result.cancelled !== "boolean" || result.cancelled && result.succeeded)) throw new Error("Invalid cancellation result");
    const output = observed ? result.output : host.redact(result.output);
    if (typeof output !== "string") throw new Error("Invalid redacted output");
    if(!observed) await journal.recordResult({...result,output});
    if (result.cancelled) {
      // A confirmed cancellation must not follow force-continue transitions.
      await journal.finish(step.id,false,output,null);
      await host.onCheckpoint?.(journal.snapshot());
      return journal.snapshot();
    }
    outputs[step.id] = output;
    const transitions = workflowStepTransitions(steps, index);
    const next = await resolveWorkflowTransition(steps,index,output,result.succeeded,transitions,outputs,{
      evaluate:async(transition,target,input)=>{
        const key=String(transitions.indexOf(transition));
        const saved=journal.snapshot().steps.slice(-1)[0].evaluations?.find(entry=>entry.key===key);
        if(saved?.status==="completed")return saved.output!;
        if(saved)throw new Error("Interrupted evaluation requires reconciliation; it cannot be replayed");
        await journal.recordEvaluation(key);
        await host.onCheckpoint?.(journal.snapshot());
        const response=host.redact(await host.evaluate(transition,target,input));
        await journal.recordEvaluation(key,response);
        return response;
      }, onError:(kind,error)=>{host.onTransitionError(kind,error);if(kind==="eval")throw error;},
    });
    if(options.signal?.aborted) return journal.snapshot();
    await journal.finish(step.id,result.succeeded,output,next.nextStepId);
    await host.onCheckpoint?.(journal.snapshot());
  }
  // Budget exhaustion preserves a ready checkpoint; it is not reported done.
  return journal.snapshot();
}
