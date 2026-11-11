import {createPageCreationService, inspectPageCreation, type PageCreationRequest} from "./page-creation";
import {createPluginRequestHost} from "./cli-plugin-requests";
import {runInstalledWorkflow, type InstalledWorkflowOptions} from "./installed-workflow-host";
import {resolveInstalledWorkflowLocation, ensureInstalledWorkflowRuntime} from "./installed-workflow-location";
import {acquireExecutionLease} from "./execution-lease";
import {assertIdleCatalog, assertIdleJournals} from "./execution-idle";
import {SettingsWriter} from "./settings-writer";
import {catalogTransaction} from "./catalog-transaction";
import {registerWorkPage} from "./work-pages";
import {executionCoordinator} from "./execution-coordinator";
import type {RunCheckpoint} from "./execution-journal";
import * as fs from "fs";
import {prepareWorkflowDefinition} from "./workflow-definition";
import {preflightInstalledWorkflow} from "./workflow-preflight";
import {standaloneTaskWorkflow} from "./standalone-task";
import {selectCodeStep} from "./workflow-code-step";

/** The foreground CLI remains the only owner, including requests made by its tasks. */
async function withPageHost<T>(vault:string,action:(run:(options:InstalledWorkflowOptions)=>Promise<RunCheckpoint>,pages:ReturnType<typeof createPageCreationService>)=>Promise<T>,installationDirectory?:string) {
  const location=resolveInstalledWorkflowLocation(vault,installationDirectory);ensureInstalledWorkflowRuntime(location);
  const lease=acquireExecutionLease(location.runtimeDirectory),writer=new SettingsWriter();
  let host:ReturnType<typeof createPluginRequestHost>|undefined,timer:ReturnType<typeof setInterval>|undefined;
  let abort:(()=>void)|undefined;
  try {
  let running=false,reserved=false,closed=false,pollFailure:unknown;
  const runs=new Set<string>(),controller=new AbortController();
  const run=async(options:InstalledWorkflowOptions)=>{
    running=true;
    try{return await runInstalledWorkflow({...options,lease,catalogWriter:writer,
      onCheckpoint:async(state,catalog,presentation,transaction)=>{runs.add(state.runId);await options.onCheckpoint?.(state,catalog,presentation,transaction);}});}
    finally{running=false;runs.clear();}
  };
  const pages=createPageCreationService({lease,location,busy:()=>running || reserved,activeRuns:()=>{
    if(running && !runs.size)throw new Error("Wait for the foreground execution identity before submitting page creation");return [...runs];
  },
    assertOpen:()=>{lease.assertOwned();if(closed || pollFailure)throw new Error("Standalone page host is closed");},
    reserve:()=>{if(running || reserved)throw new Error("Standalone work is active");lease.assertOwned();assertIdleJournals(location.runtimeDirectory);reserved=true;return()=>{reserved=false;};},
    catalog:async()=>{const config=await writer.loadAsync(location.configurationFile);assertIdleCatalog(config,assertIdleJournals(location.runtimeDirectory));if(config.pageTerminalClaims?.length)throw new Error("Page terminals are still reserved");return config;},
    register:page=>catalogTransaction(location.configurationFile,async()=>{
      const config=await writer.loadAsync(location.configurationFile);
      assertIdleCatalog(config,assertIdleJournals(location.runtimeDirectory));
      await registerWorkPage(config,page,()=>writer.save(location.configurationFile,()=>config));
      executionCoordinator(lease).catalogVersion=writer.confirmedVersion(location.configurationFile);
    }),
    launch:(selection,pageId,signal,onCheckpoint)=>run({vault,installationDirectory:location.installationDirectory,...selection,pageId,newExecution:true,redact:s=>s,signal,onCheckpoint}),
  });
  host=createPluginRequestHost(lease,async()=>{throw new Error("This foreground owner accepts page preparation requests; use create-page with launch instead of recursive run");},undefined,()=>({}),{pages});
  timer=setInterval(()=>{void host!.poll().catch(error=>{pollFailure=error;controller.abort();host!.close();});},50);
  abort=()=>{controller.abort();host!.close();};
  process.on("SIGINT",abort);process.on("SIGTERM",abort);
  try {
    const result=await action(options=>run({...options,signal:options.signal || controller.signal}),pages);
    if(pollFailure)throw pollFailure;
    await host.poll();await host.drain();await pages.flush();
    return result;
  } finally {
    closed=true;
  }
  } finally {
    if(timer)clearInterval(timer);
    if(abort){process.off("SIGINT",abort);process.off("SIGTERM",abort);}
    host?.close();
    // Unconfirmed publication deliberately retains the lease for the official recovery path.
    await host?.drain();await writer.drain();lease.release();
  }
}
export async function runStandaloneWorkflowWithPages(options:InstalledWorkflowOptions){
  const location=resolveInstalledWorkflowLocation(options.vault,options.installationDirectory);
  // Preserve the existing first-run boundary: invalid definitions must not create
  // a runtime merely to advertise a mailbox. The actual host repeats this shared
  // preflight under its lease before allowing any workflow effects.
  if(!fs.existsSync(location.runtimeDirectory) && (!options.pageId || options.pageId==="main")){
    const config=await new SettingsWriter().loadAsync(location.configurationFile);
    if(!config || !Array.isArray(config.tasks) || !Array.isArray(config.workflows))throw new Error("Invalid AutoOC catalog");
    let workflow=options.taskId ? standaloneTaskWorkflow(options.taskId) : config.workflows.find((w:any)=>w.id===options.workflowId);
    if(!workflow)throw new Error("Missing workflow identity");
    if(options.stepId)workflow=selectCodeStep(workflow,options.stepId);
    preflightInstalledWorkflow(prepareWorkflowDefinition(workflow,config.tasks,config),location.vault);
  }
  return withPageHost(options.vault,run=>run(options),options.installationDirectory);
}
export async function createStandalonePage(vault:string,request:PageCreationRequest){
  await withPageHost(vault,async(_run,pages)=>{await pages.submit(request);await pages.flush();});
  return inspectPageCreation(resolveInstalledWorkflowLocation(vault).runtimeDirectory,request.requestId);
}
