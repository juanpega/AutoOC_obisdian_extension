import * as fs from "fs";
import * as path from "path";
import { readExecutionCheckpoint, checkpointUncertainties } from "./execution-journal";
import { inspectTerminalExecution, disposeTerminalExecution } from "./execution-abandonment";
import { runInstalledWorkflow } from "./installed-workflow-host";
import { requestWorkflowStop } from "./workflow-stop";
import { standaloneTaskWorkflow } from "./standalone-task";
import { recoverExecutionLease,readExecutionLeaseOwner } from "./execution-lease";
import { answerWorkflowApproval } from "./workflow-approval";
import { abandonInstalledExecution } from "./execution-abandonment";
import {executionSummary, type ExecutionSummary,requestPluginExecution,requestPluginWorkflowEdit} from "./cli-plugin-requests";
import {workflowEditDefinition,workflowEditHash,validWorkflowEdit} from "./workflow-edit";
import {resolveInstalledWorkflowLocation} from "./installed-workflow-location";
import {inspectSettingsWrite, recoverSettingsWrite, readSettingsWriteDecision} from './settings-write-inspection';
import {maintainRelease,readDecisionFile} from "./release-maintenance";
import {summarizeCliCatalog} from './cli-catalog-summary';
import {readCodeStepCheckpoint} from './workflow-code-step';
import {normalizePageSelection, pageExecutionId, summarizeWorkPages} from './work-pages';
declare const AUTOOC_VERSION: string;
const version = AUTOOC_VERSION;

async function main(args: string[]) {
  const [command, ...rest] = args;
  if(command==='inspect-settings-write'||command==='recover-settings-write') {
    const inspect=command==='inspect-settings-write';
    if(rest.length!==(inspect?2:4)||rest[0]!=='--vault'||!path.isAbsolute(rest[1]||'')||
       !inspect&&(rest[2]!=='--decision'||!path.isAbsolute(rest[3]||'')))throw new Error('Use inspect-settings-write --vault <absolute path> or recover-settings-write --vault <absolute path> --decision <absolute JSON file>');
    if(inspect)return {version,...await inspectSettingsWrite(rest[1])};
    const result=await recoverSettingsWrite(rest[1],readSettingsWriteDecision(rest[3]));
    if(!result.recovered)process.exitCode=1;
    return {version,...result};
  }
  if(command==="maintain-release") {
    if(rest[0]!=="--vault" || !path.isAbsolute(rest[1] || '') || !(rest.length===3 && ["--inspect","--install"].includes(rest[2]) || rest.length===4 && rest[2]==="--decisions"))throw new Error('Use maintain-release --vault <absolute vault> <--inspect|--install|--decisions absolute-JSON-file>');
    return maintainRelease({sourceDirectory:__dirname,vault:rest[1],version,decisions:rest[2]==="--decisions" ? readDecisionFile(rest[3]) : rest[2]==="--install" ? [] : undefined});
  }
  if(command==="inspect-terminal" || command==="dispose-terminal") {
    if(rest.length!==4 || rest[0]!=="--vault" || !path.isAbsolute(rest[1]) || rest[2]!== (command==="inspect-terminal" ? "--run" : "--decision"))throw new Error("Use --vault <absolute path> and --run <id> or --decision <absolute JSON file>, in that order");
    if(command==="inspect-terminal")return {version,...inspectTerminalExecution({vault:rest[1],runId:rest[3]})};
    const decision=readDecisionFile(rest[3]);
    if(!decision || Array.isArray(decision) || decision.vault!==resolveInstalledWorkflowLocation(rest[1]).vault)throw new Error("Decision vault identity mismatch");
    const result=await disposeTerminalExecution({...decision,lease:undefined});
    return {version,runId:result.runId,workflowId:result.workflowId,phase:result.phase,revision:result.revision,disposition:result.disposition};
  }
  if(command==="export-workflow"||command==="edit-workflow") {
    const last=command==="export-workflow"?"--out":"--patch";
    if(rest.length!==6||rest[0]!=="--vault"||rest[2]!=="--workflow"||rest[4]!==last||!path.isAbsolute(rest[1])||!path.isAbsolute(rest[5]))throw new Error("Use --vault <absolute path> --workflow <id> "+last+" <absolute JSON file>, in that order");
    const location=resolveInstalledWorkflowLocation(rest[1]);
    if(command==="export-workflow") {
      let catalog:any;try{catalog=JSON.parse(fs.readFileSync(location.configurationFile,"utf8"));}catch{throw new Error("Cannot read valid AutoOC configuration");}
      const workflows=catalog.workflows?.filter((w:any)=>w.id===rest[3]);
      if(workflows?.length!==1)throw new Error("Workflow identity is missing or ambiguous");
      const workflow=workflows[0];
      fs.writeFileSync(rest[5],JSON.stringify({workflowId:workflow.id,expectedHash:workflowEditHash(workflow),definition:workflowEditDefinition(workflow)},null,2),{flag:"wx",mode:0o600});
      return {version,workflowId:workflow.id,expectedHash:workflowEditHash(workflow),exported:true};
    }
    const stat=fs.lstatSync(rest[5]);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>60000)throw new Error("Patch must be a regular JSON file of at most 60KB");
    let patch:any;try{patch=JSON.parse(fs.readFileSync(rest[5],"utf8"));}catch{throw new Error("Invalid workflow patch JSON");}
    const edit={command:"edit-workflow" as const,workflowId:rest[3],expectedHash:patch?.expectedHash,changes:patch?.changes};
    if(!validWorkflowEdit(edit))throw new Error("Invalid workflow patch; export current definition and use expectedHash plus supported changes");
    return {version,...await requestPluginWorkflowEdit(location.runtimeDirectory,edit)};
  }
  if(command === "abandon") {
    const keys=["--vault","--workflow","--run","--revision","--reason","--acknowledge-unknown-effects"];
    if(rest.length!==12 || keys.some((key,index)=>rest[index*2]!==key) || !/^(0|[1-9]\d*)$/.test(rest[7]) || rest[11]!=="true") {
      throw new Error("Abandon requires --vault, --workflow (use @task:ID for a standalone task), --run, --revision, --reason and --acknowledge-unknown-effects true, in that order");
    }
    const result=await abandonInstalledExecution({vault:rest[1],workflowId:rest[3],runId:rest[5],revision:Number(rest[7]),reason:rest[9],acknowledgedUnknownEffects:true});
    return {version,runId:result.runId,workflowId:result.workflowId,phase:result.phase,revision:result.revision,abandonment:result.abandonment};
  }
  if(command==="approve" || command==="deny") {
    if(rest.length!==6 || rest[0]!=="--vault" || !path.isAbsolute(rest[1]) || rest[2]!=="--run" || rest[4]!=="--approval")throw new Error("Decision requires --vault, --run and exact --approval token");
    let directory=fs.realpathSync(rest[1]);
    for(const part of [".obsidian","plugins","auto-oc","runtime"]) {
      directory=path.join(directory,part);const stat=fs.lstatSync(directory);
      if(stat.isSymbolicLink() || !stat.isDirectory())throw new Error("Invalid runtime directory");
    }
    return {version,...answerWorkflowApproval(directory,rest[3],rest[5],command==="approve")};
  }
  if (command === "recover-lease") {
    if(rest.length!==4 || rest[0]!=="--vault" || !path.isAbsolute(rest[1]) || rest[2]!=="--owner" || !rest[3]) throw new Error("Lease recovery requires explicit absolute vault and observed --owner identity");
    let directory=fs.realpathSync(rest[1]);
    for(const part of [".obsidian","plugins","auto-oc","runtime"]) {
      directory=path.join(directory,part);
      const stat=fs.lstatSync(directory);
      if(stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Invalid runtime directory");
    }
    return {version,...recoverExecutionLease(directory,rest[3])};
  }
  if (command === "version" && !rest.length) return { version, experimental: true, capabilities: ["list", "status", "pages", "run", "resume", "reconcile", "stop", "recover-lease", "inspect-settings-write", "recover-settings-write", "approve", "deny", "abandon","inspect-terminal","dispose-terminal","maintain-release","export-workflow","edit-workflow"], taskSelection:true, codeStepSelection:true, nestedWorkflows:1, catalogAvailability:1, pageSelection:1, pluginRequests:1,workflowEditing:1 };
  if (command === "help" && !rest.length) return { usage: "node autooc-cli.cjs <list|status|pages> --vault <absolute-path>", execution: "<run|resume|reconcile|stop> --vault <absolute-path> <--workflow id [--step code-step-id]|--task id> [--run <run-id> for resume/reconcile/stop] [--page <id|main>]", nestedWorkflows:"Workflow steps reference workflowId in the catalog; exports use workflowExportId and schema 1.7.0. Run, stop, reconcile and resume select the parent workflow/run. Child schedules are ignored; cycles and more than 16 levels are rejected.", pages:"pages --vault <absolute path> lists page IDs without creating folders. Omit --page or use --page main for legacy Main workspace behavior, including task-specific folders. Custom --page selects an existing page for run/resume/reconcile/stop; status --vault <absolute path> --page <id> shows its runs. --step is Main workspace only. The current shell folder never selects a page. Plugin delegation requires pageSelection:1; a loaded older plugin is rejected before submission. Standalone execution keeps one owner per installation and requires compatible non-GUI tasks.", catalog:"list/status include disabled, blockedByDisabled, disabledReason and codeSteps; these are availability gates, not proof of readiness or live activity.", codeSteps:"--step selects one Code step with empty input/outputs and preserves the full workflow result. Requires codeStepSelection:true in CLI and loaded host. run/resume reject disabled items; reconcile/stop remain available for the exact recorded execution.", settingsWriteRecovery:"inspect-settings-write --vault <absolute path>; recover-settings-write --vault <absolute path> --decision <absolute JSON file>. Requires reviewed inspectionHash, token, transactionId, reason, preserveCatalog:true and executionsResumed:false. Never resumes or recovers the execution lease.", recovery:"recover-lease --vault <absolute-path> --owner <observed-owner-token>", decision:"<approve|deny> --vault <absolute-path> --run <run-id> --approval <observed-token>", terminalDisposition:"inspect-terminal --vault <absolute vault> --run <id>; dispose-terminal --vault <absolute vault> --decision <absolute JSON file containing the exact inspection plus reason and acknowledgedUnknownEffects:true>. Unload plugin first. Keeps historical phase and unknown outcome.",maintenance:"maintain-release --vault <absolute vault> <--inspect|--install|--decisions absolute-JSON-file> from a separate extracted corrected package; --install preserves all historical runs without resolving them; optional decisions are an array of individually reviewed inspections plus reason and acknowledgedUnknownEffects:true. Backs up and installs under one lease. Never recovers locks.",abandonment:"abandon --vault <absolute-path> --workflow <id or @task:ID> --run <run-id> --revision <observed-revision> --reason <human-decision> --acknowledge-unknown-effects true (close/disable plugin first; preserves unknown outcome, does not stop external processes)", workflowEditing: "export-workflow --vault <absolute-path> --workflow ID --out <new absolute JSON file>; edit-workflow --vault <absolute-path> --workflow ID --patch <absolute JSON file containing expectedHash and changes>. Keep Obsidian open; name/description/existing step text only.", experimental: true, foreground:true };
  if (["run","resume","reconcile","stop"].includes(command)) {
    const values = new Map<string,string>();
    const target = rest.includes("--task") ? "--task" : "--workflow";
    const allowed = command === "run" ? ["--vault",target] : ["--vault",target,"--run"];
    if (rest.includes('--page')) allowed.push('--page');
    if (rest.includes('--step')) {
      if (target !== '--workflow') throw new Error('--step requires --workflow, not --task');
      allowed.push('--step');
    }
    if (rest.length !== allowed.length*2) throw new Error("Execution requires explicit vault, workflow and recovery identity where applicable");
    for (let index=0;index<rest.length;index+=2) {
      const key=rest[index], value=rest[index+1];
      if (!allowed.includes(key) || values.has(key) || !value || value.startsWith("--")) throw new Error("Invalid execution options");
      values.set(key,value);
    }
    const pageId = normalizePageSelection(values.get('--page'));
    if (pageId && values.has('--step')) throw new Error("Page execution requires a complete workflow or task; --step is only supported in Main workspace.");
    if (command === "stop") {
      if (!path.isAbsolute(values.get("--vault")!)) throw new Error("Explicit absolute vault required");
      let directory=fs.realpathSync(values.get("--vault")!);
      for(const part of [".obsidian","plugins","auto-oc","runtime"]) {
        directory=path.join(directory,part);
        const stat=fs.lstatSync(directory);
        if(stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Invalid runtime directory");
      }
      const state=readExecutionCheckpoint(directory,values.get("--run")!);
      const identity = pageId ? pageExecutionId(pageId,values.get(target)!,target === '--task') : target === "--task" ? standaloneTaskWorkflow(values.get(target)!).id : values.get(target);
      if(state.workflowId!==identity) throw new Error("Execution belongs to another workflow or task");
      if (values.has('--step')) {
        let catalog:any;
        try {catalog=JSON.parse(fs.readFileSync(path.join(path.dirname(directory),'data.json'),'utf8'));}
        catch {throw new Error('Cannot read valid AutoOC configuration');}
        const matches=catalog.workflows?.filter((workflow:any)=>workflow.id===identity);
        if(matches?.length!==1)throw new Error('Workflow identity is missing or ambiguous');
        const selected=readCodeStepCheckpoint(directory,matches[0],values.get('--step')!);
        if(selected?.runId!==state.runId)throw new Error('Execution does not belong to the selected isolated code step');
      }
      return {version,experimental:true,...(pageId ? {pageId} : {}),...await requestWorkflowStop(directory,state.runId)};
    }
    const controller = new AbortController();
    const abort = ()=>controller.abort();
    process.on("SIGINT",abort);process.on("SIGTERM",abort);
    try {
      const location=resolveInstalledWorkflowLocation(values.get("--vault")!);
      const progress=(host:"obsidian"|"standalone",state:ExecutionSummary)=>process.stderr.write(JSON.stringify({event:"progress",host,...(pageId ? {pageId} : {}),...executionSummary(state)})+"\n");
      const delegated=await requestPluginExecution(location.runtimeDirectory,{
        command:command as "run"|"resume"|"reconcile",workflowId:values.get("--workflow"),taskId:values.get("--task"),stepId:values.get('--step'),runId:values.get("--run"),...(pageId ? {pageId} : {})
      },controller.signal,state=>progress("obsidian",state));
      const result = delegated || await runInstalledWorkflow({vault:values.get("--vault")!,workflowId:values.get("--workflow"),taskId:values.get("--task"),
        stepId:values.get('--step'),pageId,resumeRunId:values.get("--run"),newExecution:command === "run",reconcile:command === "reconcile",
        signal:controller.signal,redact:text=>text,includePresentation:true,
        onCheckpoint:async (checkpoint,_catalog,presentation)=>{progress("standalone",executionSummary(checkpoint,presentation));}});
      if (controller.signal.aborted) process.exitCode=130;
      else if (result.phase === "failed") process.exitCode=1;
      return {version,experimental:true,...(pageId ? {pageId} : {}),...executionSummary(result)};
    } finally {process.off("SIGINT",abort);process.off("SIGTERM",abort);}
  }
  // The historical list/status shape is unchanged unless a custom page is selected.
  const pageStatus = command === 'status' && rest.length === 4 && rest[2] === '--page';
  if (!["list", "status", "pages"].includes(command) || !(rest.length === 2 || pageStatus) || rest[0] !== "--vault" || !path.isAbsolute(rest[1])) {
    throw new Error("Use help for supported commands; an explicit absolute --vault is required.");
  }
  const pageId = pageStatus ? normalizePageSelection(rest[3]) : undefined;
  const vault = fs.realpathSync(rest[1]);
  let location = vault;
  for (const part of [".obsidian", "plugins", "auto-oc", "data.json"]) {
    location = path.join(location, part);
    if (fs.lstatSync(location).isSymbolicLink()) throw new Error("Linked installation paths are unsupported.");
  }
  if (!fs.statSync(location).isFile()) throw new Error("Configuration is not a regular file.");
  // Never include parse errors or arbitrary configuration values in diagnostics.
  let config: any;
  try { config = JSON.parse(fs.readFileSync(location, "utf8")); }
  catch { throw new Error("Cannot read valid AutoOC configuration."); }
  if (!config || !Array.isArray(config.tasks) || !Array.isArray(config.workflows)) throw new Error("Invalid AutoOC catalog.");
  if (command === 'pages') return {version,experimental:true,vault,worktreesEnabled:config.worktreesEnabled === true,pages:summarizeWorkPages(config,vault)};
  const page = pageId ? summarizeWorkPages(config,vault).find(p=>p.id === pageId) : undefined;
  if (pageId && !page) throw new Error("Work page is missing or ambiguous");
  const summary = summarizeCliCatalog(config, command === 'status');
  let runtime:object = {};
  if (command === "status") {
    const directory = path.join(path.dirname(location),"runtime");
    const executions:object[] = [];
    let executionLockPresent = false;
    let executionOwner:ReturnType<typeof readExecutionLeaseOwner>|undefined;
    if (fs.existsSync(directory)) {
      if (fs.lstatSync(directory).isSymbolicLink() || !fs.statSync(directory).isDirectory()) throw new Error("Invalid runtime directory");
      executionLockPresent = fs.existsSync(path.join(directory,"execution.lock"));
      if (executionLockPresent) {
        try {executionOwner=readExecutionLeaseOwner(directory);} catch { /* incomplete owner stays blocked */ }
      }
      for (const file of fs.readdirSync(directory).sort()) {
        if (!/^[a-f0-9-]+\.json$/.test(file)) continue;
        const state = readExecutionCheckpoint(directory,file.slice(0,-5));
        if (pageId && !state.workflowId.startsWith('@page:' + pageId + ':')) continue;
        executions.push({runId:state.runId,workflowId:state.workflowId,phase:state.phase,
          revision:state.revision,nextStepId:state.nextStepId,
          completedSteps:state.steps.filter(step=>step.status==='completed').length,
          failedSteps:state.steps.filter(step=>step.status==='failed').length,
          requiresReconciliation:state.phase!=='abandoned' && !state.disposition && (state.phase==='in_flight' || checkpointUncertainties(state).length>0),abandonment:state.abandonment,disposition:state.disposition,
          ...(state.phase==='in_flight' && state.steps.slice(-1)[0]?.approval ? {pendingApproval:state.steps.slice(-1)[0].approval} : {})});
      }
    }
    runtime = {executions,executionLockPresent,...(executionOwner ? {executionOwner} : {})};
  }
  return { version, experimental: true, vault, activityVerified: false, ...(page ? {page} : summary),...runtime };
}

main(process.argv.slice(2)).then(result=>{process.stdout.write(JSON.stringify(result) + "\n");}).catch(error=>{
  // Filesystem errors can include paths; report only stable diagnostics.
  const message = error instanceof Error && !(error as NodeJS.ErrnoException).code ? error.message : "Cannot read the selected AutoOC installation.";
  const code=(error as NodeJS.ErrnoException)?.code;
  process.stderr.write(JSON.stringify({ error: message,...(typeof code==="string" && /^[A-Z][A-Z0-9_]+$/.test(code)?{errorCode:code}:{}) }) + "\n");
  process.exitCode = 1;
});
