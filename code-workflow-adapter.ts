import { executeCodeTask } from "./code-task";
import type { WorkflowTaskAdapter } from "./code-workflow-host";
import { runWithVaultMutations, type VaultMutationBatchFactory } from "./code-vault-mutations";

export function createCodeWorkflowAdapter(vaultBase:string,workingDirectory = vaultBase, vaultMutations?:VaultMutationBatchFactory):WorkflowTaskAdapter {
  const supports = (task:Readonly<Record<string,any>>) => task.taskKind === "code";
  return {
    supports,
    async execute(task,_prompt,signal) {
      if (!supports(task)) throw new Error("Unsupported Code task");
      if (signal?.aborted) throw new Error("Code task cancelled before execution");
      if (!(task.code || task.prompt || "").trim()) return {succeeded:false,output:"[AutoOC] Code task not launched: code is empty."};
      let output = "[running code task...]\n";
      try {
        const result = await runWithVaultMutations(vaultMutations, onVaultMutation => executeCodeTask({...task,vaultBase,cwd:task.workingDirectory || workingDirectory,
          onVaultMutation, log:(...args)=>{output += args.map(String).join(" ")+"\n";}}));
        output += result;
        return {succeeded:true,output};
      } catch (error) {
        return {succeeded:false,output:output+`[code error: ${String(error)}]`};
      }
    },
  };
}
