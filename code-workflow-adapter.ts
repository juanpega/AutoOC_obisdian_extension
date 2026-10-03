import { executeCodeTask } from "./code-task";
import type { WorkflowTaskAdapter } from "./code-workflow-host";

export function createCodeWorkflowAdapter(vaultBase:string,workingDirectory = vaultBase):WorkflowTaskAdapter {
  const supports = (task:Readonly<Record<string,any>>) => task.taskKind === "code";
  return {
    supports,
    async execute(task,_prompt,signal) {
      if (!supports(task)) throw new Error("Unsupported Code task");
      if (signal?.aborted) throw new Error("Code task cancelled before execution");
      if (!(task.code || task.prompt || "").trim()) return {succeeded:false,output:"[AutoOC] Code task not launched: code is empty."};
      let output = "[running code task...]\n";
      try {
        const result = executeCodeTask({...task,vaultBase,cwd:task.workingDirectory || workingDirectory,
          log:(...args)=>{output += args.map(String).join(" ")+"\n";}});
        output += result;
        return {succeeded:true,output};
      } catch (error) {
        return {succeeded:false,output:output+`[code error: ${String(error)}]`};
      }
    },
  };
}
