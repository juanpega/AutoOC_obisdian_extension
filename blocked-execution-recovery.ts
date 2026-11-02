import * as fs from 'fs';
import * as path from 'path';
import {createHash} from 'crypto';
import {type InstalledWorkflowLocation, resolveInstalledWorkflowLocation} from './installed-workflow-location';
import {type ExecutionLease, readExecutionLeaseOwner} from './execution-lease';
import {checkpointUncertainties, dispositionLocation, readExecutionCheckpoint} from './execution-journal';
import {observeCheckpoint} from './checkpoint-observation';
import {readSettingsTextAsync} from './settings-writer';
import {parseCooperatively} from './cooperative-json';
import {catalogTransaction} from './catalog-transaction';
import {assertPackageMaintenanceSafe} from './package-maintenance';
import {abandonInstalledExecution, disposeTerminalExecution, inspectTerminalExecution} from './execution-abandonment';

const digest = (text:string) => createHash('sha256').update(text).digest('hex');
export interface BlockedAttempt {
  name:string; runId:string; workflowId:string; revision:number; phase:string;
  completedSteps:number; checkpointHash:string;
}
export interface BlockedExecutionInspection {
  location:ReturnType<typeof dispositionLocation>;
  catalogHash:string;
  owner:ReturnType<typeof readExecutionLeaseOwner> | null;
  attempts:BlockedAttempt[];
}

function ownerAt(location:InstalledWorkflowLocation) {
  return fs.existsSync(path.join(location.runtimeDirectory,'execution.lock'))
    ? readExecutionLeaseOwner(location.runtimeDirectory) : null;
}

// Consultation only. Names and counters cross the UI boundary; prompts, outputs
// and approval payloads do not. A stored phase never establishes live activity.
export async function inspectBlockedExecutions(location:InstalledWorkflowLocation):Promise<BlockedExecutionInspection> {
  assertPackageMaintenanceSafe(location.installationDirectory);
  const identity=dispositionLocation(location), owner=ownerAt(location);
  const text=await readSettingsTextAsync(location.configurationFile);
  if(text===null)throw new Error('Saved catalog is unavailable');
  const catalog=await parseCooperatively(text);
  if(!Array.isArray(catalog?.tasks) || !Array.isArray(catalog?.workflows))throw new Error('Saved catalog is invalid');
  const attempts:BlockedAttempt[]=[];
  for(const file of fs.readdirSync(location.runtimeDirectory).sort()) {
    if(!/^[a-zA-Z0-9-]+\.json$/.test(file))continue;
    const observation=await observeCheckpoint(location.runtimeDirectory,file.slice(0,-5));
    const state=observation.checkpoint;
    if(state.phase==='abandoned' || state.disposition ||
        !['ready','in_flight'].includes(state.phase) && !checkpointUncertainties(state).length)continue;
    const item=catalog.workflows.find((w:any)=>w.id===state.workflowId) ||
      catalog.tasks.find((t:any)=>'@task:'+t.id===state.workflowId);
    attempts.push({name:typeof item?.name==='string'?item.name:'Earlier execution',runId:state.runId,
      workflowId:state.workflowId,revision:state.revision,phase:state.phase,
      completedSteps:state.steps.filter(s=>s.status==='completed').length,checkpointHash:digest(observation.text)});
  }
  const result={location:identity,catalogHash:digest(text),owner,attempts};
  assertBlockedInspection(result,true);
  return result;
}

// Revalidate the physical installation, exact catalog, owner and selected
// checkpoint after confirmation. An old dialog never authorizes a newer run.
export function assertBlockedInspection(observed:BlockedExecutionInspection, checkOwner:boolean, attempt?:BlockedAttempt) {
  const location=resolveInstalledWorkflowLocation(observed.location.vault,observed.location.installationDirectory);
  if(JSON.stringify(dispositionLocation(location))!==JSON.stringify(observed.location))throw new Error('Installation changed; refresh the recovery review');
  assertPackageMaintenanceSafe(location.installationDirectory);
  if(digest(fs.readFileSync(location.configurationFile,'utf8'))!==observed.catalogHash)throw new Error('Saved catalog changed; refresh the recovery review');
  if(checkOwner && JSON.stringify(ownerAt(location))!==JSON.stringify(observed.owner))throw new Error('Execution owner changed; refresh the recovery review');
  for(const selected of attempt?[attempt]:observed.attempts) {
    if(!observed.attempts.includes(selected))throw new Error('Select an observed attempt');
    const state=readExecutionCheckpoint(location.runtimeDirectory,selected.runId);
    if(state.workflowId!==selected.workflowId || state.revision!==selected.revision ||
        digest(fs.readFileSync(path.join(location.runtimeDirectory,selected.runId+'.json'),'utf8'))!==selected.checkpointHash) {
      throw new Error('Attempt changed; refresh the recovery review');
    }
  }
  return location;
}

export async function resetBlockedAttempt(observed:BlockedExecutionInspection, attempt:BlockedAttempt,
    lease:ExecutionLease, reason:string, acknowledgedUnknownEffects:boolean, assertHostIdle:()=>void) {
  if(acknowledgedUnknownEffects!==true || !reason.trim() || reason.length>1000)throw new Error('Confirm the unknown outcome and enter a reason of 1–1000 characters');
  return catalogTransaction(path.join(observed.location.installationDirectory,'data.json'),async()=>{
    assertHostIdle();lease.assertOwned();
    const location=assertBlockedInspection(observed,false,attempt);
    if(fs.realpathSync(lease.directory)!==location.runtimeDirectory)throw new Error('Recovery lease belongs to another installation');
    const options={vault:location.vault,installationDirectory:location.installationDirectory,lease,
      runId:attempt.runId,workflowId:attempt.workflowId,revision:attempt.revision,reason,acknowledgedUnknownEffects};
    if(['ready','in_flight'].includes(attempt.phase))return abandonInstalledExecution(options);
    return disposeTerminalExecution({...inspectTerminalExecution(options),...options});
  });
}
