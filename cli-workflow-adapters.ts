import * as fs from "fs";
import * as path from "path";
import type { PreparedWorkflow } from "./workflow-definition";
import type { WorkflowTaskAdapter } from "./code-workflow-host";
import { CopilotCliClient, resolveCopilotBin } from "./copilot-client";
import { buildOpenCodeScript } from "./opencode-script";
import { formatTaskOutput, decodeCommandBuffer } from "./command-output";
import { resolveOpencodeBin, launchHidden, writeUtf8BomFile, scriptExt, openOpencodeCli, openOpencodeCliLongPromptWindows } from "./cli-launchers";

export function createCopilotWorkflowAdapter(definition:PreparedWorkflow,vault:string):WorkflowTaskAdapter {
  const supports=(task:Readonly<Record<string,any>>)=>task.taskKind==='copilot' && !task.interactiveTerminal && !task.branch && !task.createBranch && (task.copilotAllowAllTools===undefined || typeof task.copilotAllowAllTools==='boolean');
  return {supports,async execute(task,prompt,signal) {
    if (!supports(task)) throw new Error("Unsupported Copilot task");
    if (signal?.aborted) throw new Error("Copilot cancelled before launch");
    const client=new CopilotCliClient(resolveCopilotBin(definition.settings.copilotPath),task.workingDirectory || definition.settings.workingDirectory || vault);
    const abort=()=>client.dispose();
    signal?.addEventListener('abort',abort,{once:true});
    try {
      const result=await client.run(prompt,{model:task.model || definition.settings.defaultCopilotModel,allowAllTools:task.copilotAllowAllTools===true,timeoutMs:Math.max(0,definition.settings.taskTimeoutSeconds)*1000});
      if (signal?.aborted || /timed out/.test(result.error)) throw new Error("Copilot outcome is uncertain; reconcile before continuing");
      return {succeeded:result.exitCode===0,output:result.output+(result.error?`\n[Copilot error: ${result.error}]`:'')};
    } finally {signal?.removeEventListener('abort',abort);client.dispose();}
  }};
}

export function createOpenCodeWorkflowAdapter(definition:PreparedWorkflow,vault:string):WorkflowTaskAdapter {
  const supports=(task:Readonly<Record<string,any>>)=>(!task.taskKind || task.taskKind==='opencode');
  return {supports,async execute(task,prompt,signal) {
    if(!supports(task)) throw new Error("Unsupported OpenCode task");
    if(signal?.aborted) throw new Error("OpenCode cancelled before launch");
    const taskCwd=task.workingDirectory || definition.settings.workingDirectory || vault;
    const model=task.model || definition.settings.defaultModel;
    if(!prompt.trim() || !model?.trim()) return {succeeded:false,output:'[OpenCode requires a nonempty prompt and model]'};
    const bin=resolveOpencodeBin(definition.settings.opencodePath);
    const agent=task.agent || definition.settings.defaultAgent || 'build';
    if(task.useRalphLoop) prompt='/ralph-loop '+prompt;
    if(task.interactiveTerminal) {
      // Completion describes the OS launch acknowledgement, never the result
      // of the human's interactive session, matching the plugin's contract.
      await new Promise<void>((resolve,reject)=>{
        const options={onLaunched:resolve,onError:reject,linuxTerminal:definition.settings.linuxTerminal};
        if(process.platform==='win32') openOpencodeCliLongPromptWindows(bin,taskCwd,{},model,task.forceModel?'':agent,prompt,options);
        else openOpencodeCli(bin,taskCwd,{},['-m',model,...(task.forceModel?[]:['--agent',agent]),'--prompt',prompt],options);
      });
      return {succeeded:true,output:'[opened interactive OpenCode CLI with preloaded prompt; interactive task result is not observed]'};
    }
    // Exclusive task-local files preserve the complete input and avoid clashes
    // between clients/tasks. The launcher and script are shared with Obsidian.
    const folder=fs.mkdtempSync(path.join(taskCwd,'.autooc-runtime-'));
    const outFile=path.join(folder,'stdout.txt'),errFile=path.join(folder,'stderr.txt'),doneFile=path.join(folder,'done.txt');
    const pidFile=path.join(folder,'process.pid'),promptFile=path.join(folder,'instruction.txt'),full=path.join(folder,'input.txt');
    const scriptFile=path.join(folder,'launch'+scriptExt());
    fs.writeFileSync(full,prompt,{encoding:'utf8',mode:0o600});
    fs.writeFileSync(promptFile,`Read the complete task prompt and workflow context from the workspace file at ${full} and follow it exactly.`,{encoding:'utf8',mode:0o600});
    const script=buildOpenCodeScript({pidFile,secretEnv:{},safeCwd:taskCwd.replace(/'/g,"''"),gitCmds:'',bin,model,effectiveAgent:agent,effectiveTask:task,promptFile,outFile,errFile,doneFile,taskCwd});
    if(process.platform==='win32') writeUtf8BomFile(scriptFile,script);else fs.writeFileSync(scriptFile,script,{mode:0o600});
    const handle=launchHidden(scriptFile,pidFile);
    let known=false;
    try {
      const result=await new Promise<{succeeded:boolean;output:string}>((resolve,reject)=>{
        let ended=false;
        const finish=(error?:Error)=>{if(ended)return;ended=true;clearInterval(timer);signal?.removeEventListener('abort',abort);if(error)reject(error);};
        const abort=()=>{handle.kill();finish(new Error('OpenCode interrupted; effects require reconciliation'));};
        const started=Date.now(),timeout=Number(definition.settings.taskTimeoutSeconds)*1000;
        const timer=setInterval(()=>{
          try {
            if(timeout>0 && Date.now()-started>timeout) {abort();return;}
            if(!fs.existsSync(doneFile))return;
            const exit=fs.readFileSync(doneFile,'utf8').replace(/^\uFEFF/,'').trim();
            if(!/^-?\d+$/.test(exit))throw new Error('Invalid OpenCode completion marker');
            const read=(file:string)=>fs.existsSync(file)?decodeCommandBuffer(fs.readFileSync(file)):'';
            const output=formatTaskOutput(read(outFile),read(errFile));
            known=true;finish();resolve({succeeded:exit==='0',output:output || '(no output)'});
          } catch(error) {finish(error as Error);}
        },100);
        handle.onError(error=>finish(error));
        signal?.addEventListener('abort',abort,{once:true});
        if(signal?.aborted)abort();
      });
      return result;
    } finally {
      handle.cleanup(known);
      // Never erase uncertain process evidence or another execution's files.
      if(known) {
        for(const file of [outFile,errFile,doneFile,pidFile,promptFile,full,scriptFile]) {try {fs.unlinkSync(file);} catch(error) {if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}
        fs.rmdirSync(folder);
      }
    }
  }};
}
