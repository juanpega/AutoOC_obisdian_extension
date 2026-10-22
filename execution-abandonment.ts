import { resolveInstalledWorkflowLocation } from './installed-workflow-location';
import { acquireExecutionLease, type ExecutionLease } from './execution-lease';
import { samePhysicalPath } from './path-identity';
import { ExecutionJournal, readExecutionCheckpoint, checkpointUncertainties, dispositionLocation } from './execution-journal';
import * as fs from 'fs';
import * as path from 'path';

export function inspectTerminalExecution(options:{vault:string;runId:string;installationDirectory?:string}) {
  const location=resolveInstalledWorkflowLocation(options.vault,options.installationDirectory);
  const identity=dispositionLocation(location),state=readExecutionCheckpoint(location.runtimeDirectory,options.runId);
  return {...identity,runId:state.runId,workflowId:state.workflowId,definitionHash:state.definitionHash,
    revision:state.revision,phase:state.phase,causes:checkpointUncertainties(state),disposition:state.disposition};
}

export async function disposeTerminalExecution(options:ReturnType<typeof inspectTerminalExecution> & {
  reason:string;acknowledgedUnknownEffects:boolean;lease?:ExecutionLease
}) {
  const location=resolveInstalledWorkflowLocation(options.vault,options.installationDirectory);
  const lease=options.lease || acquireExecutionLease(location.runtimeDirectory);
  try {
    lease.assertOwned();
    if(!samePhysicalPath(lease.directory,location.runtimeDirectory))throw new Error('Disposition lease identity mismatch');
    const observed=inspectTerminalExecution(options);
    for(const key of ['vault','installationDirectory','runtimeDirectory','vaultIdentity','installationIdentity','runtimeIdentity','workflowId','runId','definitionHash'] as const) {
      if(observed[key]!==options[key])throw new Error('Disposition observed identity changed; inspect again');
    }
    if(observed.revision!==options.revision || JSON.stringify(observed.causes)!==JSON.stringify(options.causes))throw new Error('Execution revision or uncertainty changed; inspect again');
    const assertQuiescent=()=>{
      lease.assertOwned();
      const current=dispositionLocation(resolveInstalledWorkflowLocation(options.vault,options.installationDirectory));
      if(Object.entries(current).some(([key,value])=>(options as any)[key]!==value))throw new Error('Disposition installation identity changed');
      if(fs.existsSync(location.configurationFile+'.write-lock') || fs.readdirSync(location.installationDirectory).some(name=>name.startsWith('data.json.') && name.endsWith('.tmp')) ||
        fs.readdirSync(location.runtimeDirectory).some(name=>name.endsWith('.tmp') || name.endsWith('.write-lock')))throw new Error('Unfinished write requires reconciliation');
      const config=JSON.parse(fs.readFileSync(location.configurationFile,'utf8'));
      if(['tasks','workflows'].some(kind=>!Array.isArray(config[kind]) || config[kind].some((entry:any)=>entry.status==='running' || entry.pendingCodexApproval)))throw new Error('Active execution requires reconciliation');
      for(const name of fs.readdirSync(location.runtimeDirectory)) {
        if(!/^[a-zA-Z0-9-]+\.json$/.test(name))continue;
        const state=readExecutionCheckpoint(location.runtimeDirectory,name.slice(0,-5));
        if(['ready','in_flight'].includes(state.phase))throw new Error('Active or unfinished execution requires reconciliation');
      }
    };
    assertQuiescent();
    const journal=ExecutionJournal.open(lease,options.runId,options.definitionHash);
    await journal.disposeTerminal(options.revision,options.reason,options.acknowledgedUnknownEffects,location);
    assertQuiescent();
    return readExecutionCheckpoint(location.runtimeDirectory,options.runId);
  } finally {if(!options.lease)lease.release();}
}

// Human disposition, not an observed provider result. CLI callers acquire an
// exclusive lease; an idle plugin may supply its own. Never steals ownership.
export async function abandonInstalledExecution(options:{vault:string;runId:string;workflowId:string;revision:number;reason:string;acknowledgedUnknownEffects:boolean;lease?:ExecutionLease;installationDirectory?:string}) {
  if(!Number.isSafeInteger(options.revision) || options.revision<0)throw new Error('Exact observed revision is required');
  const location=resolveInstalledWorkflowLocation(options.vault,options.installationDirectory);
  const lease=options.lease || acquireExecutionLease(location.runtimeDirectory);
  try {
    lease.assertOwned();
    if(!samePhysicalPath(lease.directory,location.runtimeDirectory))throw new Error('Lease belongs to another installation runtime');
    const state=readExecutionCheckpoint(location.runtimeDirectory,options.runId);
    if(state.workflowId!==options.workflowId)throw new Error('Execution belongs to another workflow or task');
    const journal=ExecutionJournal.open(lease,state.runId,state.definitionHash);
    await journal.abandon(options.revision,options.reason,options.acknowledgedUnknownEffects);
    return journal.snapshot();
  } finally {if(!options.lease)lease.release();}
}
