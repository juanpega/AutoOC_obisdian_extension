import * as fs from 'fs';
import * as path from 'path';
import {createHash,randomUUID} from 'crypto';
import {resolveInstalledWorkflowLocation} from './installed-workflow-location';
import {acquireExecutionLease} from './execution-lease';
import {inspectTerminalExecution,disposeTerminalExecution} from './execution-abandonment';
import {readExecutionCheckpoint,dispositionLocation} from './execution-journal';
import {assertInstalledExecutionIdle} from './execution-idle';
import {verifyRelease,installRelease,RELEASE_FILES,RELEASE_DESCRIPTOR} from './release-update';
import {physicalPath} from './path-identity';

export function readDecisionFile(file:string):any {
  if(!path.isAbsolute(file))throw new Error('Explicit absolute decision file required');
  const stat=fs.lstatSync(file);
  if(!stat.isFile() || stat.isSymbolicLink() || stat.nlink!==1 || stat.size>1024*1024)throw new Error('Decision file must be a regular JSON file of at most 1MB');
  try {return JSON.parse(fs.readFileSync(file,'utf8'));} catch {throw new Error('Invalid decision JSON');}
}

// This runs from the extracted NEW package. It never loads the target's old
// CLI/runtime, repairs locks, or executes workflow steps. Human decisions are
// individual, observed objects from --inspect, plus reason and acknowledgement.
export async function maintainRelease(options:{sourceDirectory:string;vault:string;version:string;decisions?:any[]}) {
  const names=[...RELEASE_FILES,RELEASE_DESCRIPTOR];
  const regular=(file:string)=>{
    const stat=fs.lstatSync(file);
    if(!stat.isFile() || stat.isSymbolicLink() || stat.nlink!==1)throw new Error('Unsafe maintenance file');
    return fs.readFileSync(file);
  };
  const source=physicalPath(options.sourceDirectory),files:Record<string,Buffer>={};
  for(const name of names) {
    let current=source;
    for(const part of name.split('/').slice(0,-1)) {
      current=path.join(current,part);
      if(fs.lstatSync(current).isSymbolicLink() || !fs.statSync(current).isDirectory())throw new Error('Unsafe package directory');
    }
    files[name]=regular(path.join(source,name));
  }
  verifyRelease(files,options.version);
  const location=resolveInstalledWorkflowLocation(options.vault),identity=dispositionLocation(location);
  if(source===location.installationDirectory)throw new Error('Run maintenance from a separate extracted package');
  const assertContext=()=>{
    const current=dispositionLocation(resolveInstalledWorkflowLocation(options.vault));
    if(JSON.stringify(current)!==JSON.stringify(identity))throw new Error('Maintenance installation identity changed');
    if(fs.existsSync(path.join(location.runtimeDirectory,'update-pending.json')))throw new Error('Incomplete update requires supported recovery');
    if(fs.existsSync(location.configurationFile+'.write-lock') || fs.readdirSync(location.installationDirectory).some(n=>n.startsWith('data.json.') && n.endsWith('.tmp')) ||
      fs.readdirSync(location.runtimeDirectory).some(n=>n.endsWith('.tmp') || n.endsWith('.write-lock')))throw new Error('Unfinished write requires reconciliation');
    const catalog=JSON.parse(regular(location.configurationFile).toString('utf8'));
    if(['tasks','workflows'].some(k=>!Array.isArray(catalog[k]) || catalog[k].some((e:any)=>e.status==='running' || e.pendingCodexApproval)))throw new Error('Active catalog requires reconciliation');
  };
  assertContext();
  if(fs.existsSync(path.join(location.runtimeDirectory,'execution.lock')))throw new Error('Unload AutoOC normally; execution reservation is present');
  const executions=fs.readdirSync(location.runtimeDirectory).filter(n=>/^[a-zA-Z0-9-]+\.json$/.test(n)).sort().map(name=>{
    const state=readExecutionCheckpoint(location.runtimeDirectory,name.slice(0,-5));
    if(['ready','in_flight'].includes(state.phase))throw new Error('Unfinished execution requires reconciliation');
    return inspectTerminalExecution({vault:location.vault,runId:state.runId});
  });
  const installedVersion=JSON.parse(regular(path.join(location.installationDirectory,'manifest.json')).toString('utf8')).version;
  if(!options.decisions)return {mode:'inspect',version:options.version,installedVersion,...identity,executions,activityVerified:false};
  if(!Array.isArray(options.decisions) || new Set(options.decisions.map(d=>d?.runId)).size!==options.decisions.length)throw new Error('Select distinct individual decisions');
  // Validate the ENTIRE batch before any mutation, including exact observation.
  for(const d of options.decisions) {
    const observed=executions.find(e=>e.runId===d?.runId);
    if(!observed || observed.disposition || !observed.causes.length ||
      Object.keys(observed).some(key=>key!=='disposition' && JSON.stringify((observed as any)[key])!==JSON.stringify(d[key])) ||
      d.acknowledgedUnknownEffects!==true || typeof d.reason!=='string' || !d.reason.trim() || d.reason.length>1000)throw new Error('Decision identity, revision, reason or acknowledgement is invalid; inspect again');
  }
  const lease=acquireExecutionLease(location.runtimeDirectory),applied:object[]=[];
  let backup:string|undefined,failure:unknown;
  try {
    lease.assertOwned();assertContext();
    backup=path.join(location.runtimeDirectory,'maintenance-backup-'+randomUUID());
    fs.mkdirSync(backup,{mode:0o700});
    const hashes:Record<string,string>={};
    const save=(relative:string,bytes:Buffer)=>{
      lease.assertOwned();
      const target=path.join(backup!,relative);fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});
      const fd=fs.openSync(target,'wx',0o600);
      try {fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
      const digest=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
      if(digest(regular(target))!==digest(bytes))throw new Error('Maintenance backup verification failed');
      hashes[relative]=digest(bytes);
    };
    for(const name of names)save(name,regular(path.join(location.installationDirectory,name)));
    const catalog=regular(location.configurationFile);save('data.json',catalog);
    const journals=fs.readdirSync(location.runtimeDirectory).filter(n=>/^[a-zA-Z0-9-]+\.json$/.test(n) || /^(abandonment|disposition)-[a-zA-Z0-9-]+\.snapshot$/.test(n));
    for(const name of journals)save('runtime/'+name,regular(path.join(location.runtimeDirectory,name)));
    save('backup-integrity.json',Buffer.from(JSON.stringify({version:installedVersion,...identity,sha256:hashes})));
    lease.assertOwned();assertContext();
    if(!regular(location.configurationFile).equals(catalog))throw new Error('Catalog changed before disposition');
    for(const d of options.decisions) {
      const state=await disposeTerminalExecution({...d,lease});
      applied.push({runId:state.runId,revision:state.revision,phase:state.phase,outcome:'unknown'});
    }
    lease.assertOwned();assertContext();
    if(!regular(location.configurationFile).equals(catalog))throw new Error('Catalog changed during maintenance');
    assertInstalledExecutionIdle(location.installationDirectory);
    const installed=installRelease({directory:location.installationDirectory,version:options.version,files,lease});
    return {mode:'installed',...installed,maintenanceBackup:backup,applied,loadedInObsidian:false,reloadRequired:true};
  } catch(error) {
    // Decisions already durably recorded remain in history even if installation
    // fails. Never turn a partial batch or failed rollback into global success.
    const inspectionRequired:string[]=[];
    // A postcondition (or lost owner) can fail AFTER the journal became durable
    // but before its API returned. Report that persistence too, when the exact
    // snapshot can still be validated; otherwise require fresh inspection.
    for(const decision of options.decisions) {
      if(applied.some((item:any)=>item.runId===decision.runId))continue;
      try {
        const state=readExecutionCheckpoint(location.runtimeDirectory,decision.runId),d=state.disposition;
        if(d && d.previousRevision===decision.revision && d.reason===decision.reason.trim() &&
          d.definitionHash===decision.definitionHash && d.vaultIdentity===decision.vaultIdentity && d.installationIdentity===decision.installationIdentity) {
          applied.push({runId:state.runId,revision:state.revision,phase:state.phase,outcome:'unknown'});
        }
      } catch {inspectionRequired.push(decision.runId);}
    }
    failure=new Error(JSON.stringify({error:'Maintenance did not complete',detail:(error as Error).message,maintenanceBackup:backup,applied,inspectionRequired,loadedInObsidian:false}));
    throw failure;
  } finally {
    try {lease.release();} catch(error) {
      // release() checks ownership before removing anything; preserve the
      // partial-operation receipt even when a foreign owner now prevents it.
      throw new Error(JSON.stringify({error:'Maintenance reservation could not be released',detail:(error as Error).message,operationError:failure instanceof Error ? failure.message : undefined,maintenanceBackup:backup,applied,loadedInObsidian:false}));
    }
  }
}
