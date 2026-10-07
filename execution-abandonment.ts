import { resolveInstalledWorkflowLocation } from './installed-workflow-location';
import { acquireExecutionLease, type ExecutionLease } from './execution-lease';
import { samePhysicalPath } from './path-identity';
import { ExecutionJournal, readExecutionCheckpoint } from './execution-journal';

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
