import type { WorkflowTaskAdapter } from "./code-workflow-host";
import type { PreparedWorkflow } from "./workflow-definition";
import { createCodeWorkflowAdapter } from "./code-workflow-adapter";
import { createCodexWorkflowAdapter } from "./codex-workflow-adapter";
import { createCopilotWorkflowAdapter,createOpenCodeWorkflowAdapter } from "./cli-workflow-adapters";

// Select exactly one implementation. Never fall back to another executor after
// a failure: the first executor may already have performed durable effects.
export function combineWorkflowTaskAdapters(adapters:readonly WorkflowTaskAdapter[]):WorkflowTaskAdapter {
  const registered = [...adapters];
  const matches = (task:Readonly<Record<string,any>>) => registered.filter(adapter=>adapter.supports(task));
  const select = (task:Readonly<Record<string,any>>) => {
    const found = matches(task);
    if (found.length !== 1) throw new Error("Task requires exactly one supported executor");
    return found[0];
  };
  return {
    supports:task=>matches(task).length===1,
    execute:(task,prompt,signal,recordThread,interaction)=>select(task).execute(task,prompt,signal,recordThread,interaction),
    async reconcile(task,threadId,turnId) {
      const adapter = select(task);
      if (!adapter.reconcile) throw new Error("Task executor cannot reconcile an interrupted execution");
      return await adapter.reconcile(task,threadId,turnId);
    },
  };
}

export function createWorkflowTaskAdapter(definition:PreparedWorkflow,vaultBase:string):WorkflowTaskAdapter {
  return combineWorkflowTaskAdapters([
    createCodeWorkflowAdapter(vaultBase,definition.settings.workingDirectory || vaultBase),
    createCodexWorkflowAdapter(definition,vaultBase),
    createCopilotWorkflowAdapter(definition,vaultBase),
    createOpenCodeWorkflowAdapter(definition,vaultBase),
  ]);
}
