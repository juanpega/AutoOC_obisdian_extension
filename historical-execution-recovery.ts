import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { dispositionLocation, readExecutionCheckpoint } from './execution-journal';
import { resolveInstalledWorkflowLocation, type InstalledWorkflowLocation } from './installed-workflow-location';
import { type ExecutionLease } from './execution-lease';
import { abandonInstalledExecution } from './execution-abandonment';
import { catalogTransaction } from './catalog-transaction';

function catalogEntries(catalog:any):any[] {
  if (!Array.isArray(catalog.tasks) || !Array.isArray(catalog.workflows)) throw new Error('Catalog is unavailable; review cannot continue');
  return [...catalog.tasks,...catalog.workflows,...catalog.workflows.flatMap((w:any)=>(w.steps || []).map((s:any)=>s.codeExecution).filter(Boolean))];
}

export function catalogReferencesRun(catalog:any,runId:string):boolean {
  return catalogEntries(catalog).some(entry=>entry.runtimeExecution?.runId===runId);
}

export function assertUnboundHistoricalAttempt(catalog:any, runId:string):void {
  const entries=catalogEntries(catalog);
  if(catalogReferencesRun(catalog,runId)) throw new Error('This attempt is linked to a current item; use its recovery controls');
  if(entries.some(entry=>entry.status==='running' || entry.pendingCodexApproval || entry.legacyExecution?.stopState)) throw new Error('An execution may still be active; review it before closing this attempt');
}

export function inspectHistoricalAttempt(location:InstalledWorkflowLocation, workflowId:string, runId:string, catalog:any) {
  assertUnboundHistoricalAttempt(catalog,runId);
  const state=readExecutionCheckpoint(location.runtimeDirectory,runId);
  if(state.workflowId!==workflowId || !['ready','in_flight'].includes(state.phase)) throw new Error('This unfinished attempt is no longer available; review again');
  return {...dispositionLocation(location),workflowId,runId,revision:state.revision,definitionHash:state.definitionHash,
    phase:state.phase,stepCount:state.steps.length,
    checkpointHash:createHash('sha256').update(JSON.stringify(state)).digest('hex')};
}

// This only closes the observed journal. Never project an older attempt over
// the current task, workflow, disabled state, output or execution binding.
export async function closeHistoricalAttempt(observed:ReturnType<typeof inspectHistoricalAttempt>, lease:ExecutionLease,
  reason:string, acknowledgedUnknownEffects:boolean, assertHostIdle:()=>void, beforeEffects:()=>void) {
  const location=resolveInstalledWorkflowLocation(observed.vault,observed.installationDirectory);
  return catalogTransaction(location.configurationFile,async()=>{
    assertHostIdle();lease.assertOwned();
    if(fs.existsSync(location.configurationFile+'.write-lock') || fs.existsSync(location.configurationFile+'.write-intent') ||
      fs.readdirSync(location.installationDirectory).some(n=>n.startsWith('data.json.') && n.endsWith('.tmp')) ||
      fs.readdirSync(location.runtimeDirectory).some(n=>n==='update-pending.json' || n.endsWith('.tmp') || n.endsWith('.write-lock'))) throw new Error('A write or update is pending; wait before reviewing this attempt');
    const catalog=JSON.parse(fs.readFileSync(location.configurationFile,'utf8'));
    const current=inspectHistoricalAttempt(location,observed.workflowId,observed.runId,catalog);
    if(JSON.stringify(current)!==JSON.stringify(observed)) throw new Error('The recorded attempt changed; open its review again');
    if(acknowledgedUnknownEffects!==true || typeof reason!=='string' || !reason.trim() || reason.length>1000) throw new Error('Confirm the unknown outcome and enter a reason of 1–1000 characters');
    assertHostIdle();beforeEffects();
    return abandonInstalledExecution({vault:location.vault,installationDirectory:location.installationDirectory,lease,
      runId:observed.runId,workflowId:observed.workflowId,revision:observed.revision,reason,acknowledgedUnknownEffects});
  });
}
