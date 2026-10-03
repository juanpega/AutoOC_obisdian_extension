import { executeCodexTask } from "./codex-execution";
import { CodexAppServerClient, resolveCodexBin, openCodexThread, type CodexApprovalRequest } from "./codex-client";
import * as fs from "fs";
import type { PreparedWorkflow } from "./workflow-definition";
import type { WorkflowTaskAdapter } from "./code-workflow-host";

// Client creation is supplied by the authorized host, including directory,
// credentials, approval callbacks and durable thread/turn observations.
export function codexWorkflowAdapter(createClient: (task: Readonly<Record<string, any>>, callbacks: {onThreadCreated: (ids:{threadId:string})=>Promise<void>;onStarted:(ids:{threadId:string;turnId:string})=>Promise<void>;onApproval:(request:CodexApprovalRequest)=>Promise<void>}) => Pick<CodexAppServerClient, "run" | "dispose" | "interrupt"> & Partial<Pick<CodexAppServerClient,"resolveApproval">>,
  defaults: {model?:string;reasoningEffort?:string} = {}): WorkflowTaskAdapter {
  return {
    supports: task => task.taskKind === "codex" && (task.interactiveTerminal===undefined || typeof task.interactiveTerminal==="boolean"),
    async execute(task, prompt, signal, recordThread, interaction) {
      if (task.taskKind !== "codex") throw new Error("Unsupported autonomous Codex task");
      if(task.interactiveTerminal!==undefined && typeof task.interactiveTerminal!=="boolean")throw new Error("interactiveTerminal must be boolean");
      if(task.interactiveTerminal && !interaction)throw new Error("Interactive Codex requires an approval channel");
      if (signal?.aborted) throw new Error("Codex execution cancelled before launch");
      const lifetime=new AbortController();
      let approvalError:unknown;
      const client = createClient(task, {onThreadCreated: async ({threadId}) => {
        if (!recordThread) throw new Error("Durable Codex identity recorder is required");
        await recordThread(threadId);
      },onStarted:async ({threadId,turnId})=>{
        if (!recordThread) throw new Error("Durable Codex identity recorder is required");
        await recordThread(threadId,turnId);
      },onApproval:async request=>{
        try {
          const approved=task.interactiveTerminal ? await interaction!.approve(request,lifetime.signal) : false;
          if(!lifetime.signal.aborted && !client.resolveApproval?.(request.requestId,approved))throw new Error("Codex approval is no longer active");
        } catch(error) {approvalError=error;await client.interrupt();}
      }});
      const abort = () => { lifetime.abort();void client.interrupt().catch(() => {}); };
      signal?.addEventListener("abort", abort, {once:true});
      try {
        const result = await executeCodexTask(client, {prompt, model:task.model || defaults.model,
          reasoningEffort:task.reasoningEffort || defaults.reasoningEffort || "medium", interactive:!!task.interactiveTerminal});
        if(approvalError)throw approvalError;
        if (signal?.aborted) throw new Error("Codex execution cancelled; reconcile its outcome");
        return {succeeded:result.status === "completed",output:result.output || result.error || "(no output)",...(result.status==="interrupted"?{cancelled:true}:{})};
      } finally { lifetime.abort();signal?.removeEventListener("abort", abort); client.dispose(); }
    },
  };
}

// Internal authorized-host factory. Credentials remain in the Codex profile;
// it does not read or export AutoOC's Electron-encrypted secret store.
export function createCodexWorkflowAdapter(definition:PreparedWorkflow,vaultBase:string):WorkflowTaskAdapter {
  const directory=(task:Readonly<Record<string,any>>)=>{
    const cwd=fs.realpathSync(task.workingDirectory || definition.settings.workingDirectory || vaultBase);
    if(!fs.statSync(cwd).isDirectory())throw new Error("Codex working directory is unavailable");
    return cwd;
  };
  const create=(task:Readonly<Record<string,any>>,callbacks:ConstructorParameters<typeof CodexAppServerClient>[2])=>{
    const bin=resolveCodexBin(definition.settings.codexPath);
    const client=new CodexAppServerClient(bin,directory(task),{...callbacks,
      onStarted:async ids=>{await callbacks?.onStarted?.(ids);if(task.interactiveTerminal)await openCodexThread(ids.threadId);},
      onApproval:request=>{if(callbacks?.onApproval)callbacks.onApproval(request);else client.resolveApproval(request.requestId,false);}});
    return client;
  };
  const adapter=codexWorkflowAdapter(create,{model:definition.settings.defaultCodexModel,reasoningEffort:definition.settings.defaultCodexReasoningEffort});
  adapter.reconcile=async(task,threadId,turnId)=>{
    const client=create(task,{});
    try{return await client.readExistingResult(threadId,turnId);}finally{client.dispose();}
  };
  return adapter;
}
