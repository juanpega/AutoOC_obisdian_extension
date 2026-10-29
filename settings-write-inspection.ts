import * as fs from 'fs';
import * as path from 'path';
import {createHash, randomUUID} from 'crypto';
import {resolveInstalledWorkflowLocation} from './installed-workflow-location';
import {assertIdleCatalog, assertIdleJournals} from './execution-idle';
import {parseSettingsWriteLock, settingsDirectoryIdentity, settingsProcessStart, readSettingsTextAsync} from './settings-writer';
import {parseCooperatively} from './cooperative-json';

const hash = (text:string|Buffer) => createHash('sha256').update(text).digest('hex');
const identity = (s:fs.Stats) => `${s.dev}:${s.ino}:${s.birthtimeMs}:${s.size}:${s.mtimeMs}:${s.ctimeMs}`;
const present = (file:string) => {try {return fs.lstatSync(file);} catch(e) {if((e as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw e;}};
type RecordEntry = {name:string; identity:string|null; sha256:string|null};
function regular(file:string) {
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)throw new Error('Unsafe settings evidence file');
  return stat;
}
function stableBytes(file:string):Buffer {
  const before=identity(regular(file)),fd=fs.openSync(file,'r');
  try {
    if(identity(fs.fstatSync(fd))!==before)throw new Error('Settings evidence changed before reading');
    const bytes=fs.readFileSync(fd);
    if(identity(fs.fstatSync(fd))!==before||identity(regular(file))!==before)throw new Error('Settings evidence changed during reading');
    return bytes;
  }finally{fs.closeSync(fd);}
}
function small(file:string):string {
  const before=regular(file);
  if(before.size>16384)throw new Error('Settings metadata exceeds size limit');
  const fd=fs.openSync(file,'r');
  try {
    if(identity(before)!==identity(fs.fstatSync(fd)))throw new Error('Settings metadata changed');
    const text=fs.readFileSync(fd,'utf8');
    if(identity(before)!==identity(regular(file)))throw new Error('Settings metadata changed');
    return text;
  } finally {fs.closeSync(fd);}
}
async function record(root:string,name:string):Promise<RecordEntry> {
  const file=path.join(root,name),stat=present(file);
  if(!stat)return {name,identity:null,sha256:null};
  if(stat.isDirectory()&&!stat.isSymbolicLink())return {name,identity:identity(stat),sha256:null};
  const before=identity(regular(file)),handle=await fs.promises.open(file,'r');
  try {
    if(identity(await handle.stat())!==before)throw new Error('Settings evidence changed before reading');
    const digest=createHash('sha256'),buffer=Buffer.alloc(256*1024);
    for(;;) {
      const {bytesRead}=await handle.read(buffer,0,buffer.length,null);
      if(!bytesRead)break;
      digest.update(buffer.subarray(0,bytesRead));
      await new Promise<void>(resolve=>setImmediate(resolve));
    }
    if(before!==identity(regular(file))||before!==identity(await handle.stat()))throw new Error('Settings evidence changed during hashing');
    return {name,identity:before,sha256:digest.digest('hex')};
  } finally {await handle.close();}
}
function runtimeNames(root:string,relative='runtime'):string[] {
  const directory=path.join(root,relative),stat=present(directory);
  if(!stat)return [];
  if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('Unsafe settings runtime directory');
  const result:string[]=[];
  for(const name of fs.readdirSync(directory).sort()) {
    // Recovery archives are immutable historical outputs, not live checkpoints.
    if(relative==='runtime'&&(name==='lease-recovery.lock'||name.startsWith('settings-write-explicit-')))continue;
    if(/secret|credential|^\.env(?:\.|$)/i.test(name))throw new Error('Unexpected sensitive runtime evidence');
    const next=relative+'/'+name,s=fs.lstatSync(path.join(root,next));
    if(s.isSymbolicLink())throw new Error('Linked runtime evidence');
    if(s.isDirectory())result.push(next,...runtimeNames(root,next));else result.push(next);
    if(result.length>10000)throw new Error('Runtime evidence inventory exceeds limit');
  }
  return result;
}
function names(root:string) {
  return ['data.json','data.json.write-lock','data.json.write-intent',...fs.readdirSync(root).filter(n=>n.startsWith('data.json.')&&n.endsWith('.tmp')).sort(),...runtimeNames(root)];
}
export async function inspectSettingsWrite(vault:string, ownGuard=false) {
  const location=resolveInstalledWorkflowLocation(vault),root=location.installationDirectory;
  const directoryIdentity=settingsDirectoryIdentity(root),runtimeIdentity=present(location.runtimeDirectory)?settingsDirectoryIdentity(location.runtimeDirectory):null;
  const blockingReasons:string[]=[],inventory=names(root),records:RecordEntry[]=[];
  if(inventory.includes('runtime/update-pending.json'))blockingReasons.push('UPDATE_PENDING');
  if(inventory.some(n=>n.startsWith('runtime/')&&(n.endsWith('.tmp')||n.endsWith('.write-lock'))))blockingReasons.push('RUNTIME_WRITE_PENDING');
  for(const name of inventory) {
    try {records.push(await record(root,name));}catch {blockingReasons.push('UNSAFE_OR_UNSTABLE_EVIDENCE:'+name);}
  }
  let lock:ReturnType<typeof parseSettingsWriteLock>|null=null;
  try {lock=parseSettingsWriteLock(small(location.configurationFile+'.write-lock'));}
  catch {blockingReasons.push(present(location.configurationFile+'.write-lock')?'INCOMPLETE_LOCK_IDENTITY':'NO_WRITE_LOCK');}
  let ownerState='unknown';
  if(lock) {
    if('legacy' in lock)blockingReasons.push('LEGACY_LOCK_WITHOUT_PROCESS_START');
    else {
      if(lock.directoryIdentity!==directoryIdentity)blockingReasons.push('LOCK_INSTALLATION_MISMATCH');
      if(!lock.processStart)blockingReasons.push('PROCESS_START_UNVERIFIABLE');
      try {
        process.kill(lock.pid,0);
        const current=await settingsProcessStart(lock.pid);
        ownerState=current&&current!==lock.processStart?'pid_reused':'active_or_unverifiable';
        blockingReasons.push(current&&current!==lock.processStart?'PID_REUSED':'WRITER_ACTIVE_OR_UNVERIFIABLE');
      } catch(e) {
        if((e as NodeJS.ErrnoException).code==='ESRCH')ownerState='absent';
        else blockingReasons.push('WRITER_ABSENCE_UNVERIFIABLE');
      }
    }
  }
  let catalogIntegrity=false,checkpointCoherence=false;
  try {
    const text=await readSettingsTextAsync(location.configurationFile);
    if(text===null)throw new Error();
    const catalog=await parseCooperatively(text);
    if(!Array.isArray(catalog?.tasks)||!Array.isArray(catalog?.workflows))throw new Error();
    catalogIntegrity=true;
    try {assertIdleCatalog(catalog,runtimeIdentity===null?new Map():assertIdleJournals(location.runtimeDirectory));checkpointCoherence=true;}
    catch {blockingReasons.push('CATALOG_CHECKPOINT_COHERENCE_UNPROVEN');}
  } catch {blockingReasons.push('CATALOG_INVALID_OR_MISSING');}
  // A foreign execution lease can still own writes even when this lock's PID died.
  const ownerFile=path.join(location.runtimeDirectory,'execution.lock','owner.json');
  if(present(path.dirname(ownerFile))) {
    if(!present(location.configurationFile+'.write-intent'))blockingReasons.push('EXECUTION_OWNER_BINDING_MISSING');
    try {
      const owner=JSON.parse(small(ownerFile));
      if(!lock||'legacy' in lock||owner.pid!==lock.pid||!Number.isSafeInteger(owner.pid))throw new Error();
      let absent=false;try {process.kill(owner.pid,0);}catch(e){absent=(e as NodeJS.ErrnoException).code==='ESRCH';}
      if(!absent)throw new Error();
    } catch {blockingReasons.push('EXECUTION_OWNER_ACTIVE_OR_UNVERIFIABLE');}
  }
  if(!runtimeIdentity)blockingReasons.push('RUNTIME_MISSING');
  if(present(path.join(location.runtimeDirectory,'lease-recovery.lock'))&&!ownGuard)blockingReasons.push('RECOVERY_ALREADY_PENDING');
  if(present(location.configurationFile+'.write-intent')) {
    try {
      const intent=JSON.parse(small(location.configurationFile+'.write-intent'));
      const owner=JSON.parse(small(ownerFile));
      if(intent.schemaVersion!==1||intent.token!==lock?.token||intent.directoryIdentity!==directoryIdentity||intent.runtimeIdentity!==runtimeIdentity||
        JSON.stringify(intent.owner)!==JSON.stringify({schemaVersion:owner.schemaVersion,token:owner.token,pid:owner.pid,createdAt:owner.createdAt})||
        owner.settingsWriteIntent?.token!==intent.token||owner.settingsWriteIntent?.sha256!==hash(small(location.configurationFile+'.write-intent'))||
        !records.some(r=>r.name==='data.json'&&(r.sha256===intent.originalHash||r.sha256===intent.preparedHash)))throw new Error();
    } catch {blockingReasons.push('INTENT_IDENTITY_OR_CATALOG_MISMATCH');}
  }
  const temporaries:Array<{name:string;sha256:string|null;integrity:string}>=[];
  for(const r of records.filter(r=>!r.name.includes('/')&&r.name.endsWith('.tmp'))) {
    let integrity='not_checked_size';
    try {
      const target=path.join(root,r.name);
      if(regular(target).size<=16*1024*1024) {
        integrity='incomplete_or_invalid';
        const text=await readSettingsTextAsync(target),value=text===null?null:await parseCooperatively(text);
        if(text!==null)integrity='valid_json_not_catalog';
        if(Array.isArray(value?.tasks)&&Array.isArray(value?.workflows))integrity='valid_catalog_unpromoted';
      }
    } catch {integrity='incomplete_or_invalid';}
    temporaries.push({name:r.name,sha256:r.sha256,integrity});
  }
  // Recheck every observation after asynchronous process/catalog checks.
  if(JSON.stringify(inventory)!==JSON.stringify(names(root))||directoryIdentity!==settingsDirectoryIdentity(root)||
     runtimeIdentity!==(present(location.runtimeDirectory)?settingsDirectoryIdentity(location.runtimeDirectory):null))blockingReasons.push('INSTALLATION_CHANGED');
  for(const prior of records) {
    try {if(JSON.stringify(prior)!==JSON.stringify(await record(root,prior.name)))blockingReasons.push('EVIDENCE_CHANGED:'+prior.name);}
    catch {blockingReasons.push('EVIDENCE_CHANGED:'+prior.name);}
  }
  const evidence={schemaVersion:1,vault:location.vault,installationDirectory:root,directoryIdentity,runtimeIdentity,records,temporaries,lock,ownerState,catalogIntegrity,checkpointCoherence};
  return {...evidence,inspectionHash:hash(JSON.stringify(evidence)),recoverable:blockingReasons.length===0,blockingReasons};
}

export function readSettingsWriteDecision(file:string):unknown {
  if(!path.isAbsolute(file))throw new Error('Explicit absolute decision file required');
  try {return JSON.parse(small(file));}catch {throw new Error('Invalid settings recovery decision file');}
}
function durable(file:string,text:string|Buffer) {
  const fd=fs.openSync(file,'wx',0o600);
  try {fs.writeFileSync(fd,text);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function syncDirectory(directory:string) {
  // Windows does not expose directory fsync through Node. Report this limit.
  if(process.platform==='win32')return;
  const fd=fs.openSync(directory,'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
export async function recoverSettingsWrite(vault:string,decision: any) {
  if(!decision||decision.schemaVersion!==1||decision.action!=='recover-settings-write'||typeof decision.reason!=='string'||!decision.reason.trim()||
    decision.preserveCatalog!==true||decision.executionsResumed!==false||!/^([a-f0-9]{64})$/.test(decision.inspectionHash||''))throw new Error('Invalid explicit settings recovery decision');
  const initial=await inspectSettingsWrite(vault);
  const matches=(i:typeof initial)=>i.recoverable&&i.inspectionHash===decision.inspectionHash&&decision.vault===i.vault&&
    decision.installationDirectory===i.installationDirectory&&decision.token===i.lock?.token&&i.lock&&'transactionId' in i.lock&&decision.transactionId===i.lock.transactionId;
  if(!matches(initial))throw new Error('Settings recovery decision is stale, mismatched or unsafe');
  const location=resolveInstalledWorkflowLocation(vault),guard=path.join(location.runtimeDirectory,'lease-recovery.lock');
  fs.mkdirSync(guard,{mode:0o700});
  const guardIdentity=settingsDirectoryIdentity(guard);
  let archive:string|undefined,committed=false,stage='exclusion',failureReceiptWritten=false,backupVerified=false;
  const moved:string[]=[];
  try {
    const current=await inspectSettingsWrite(vault,true);
    if(!matches(current))throw new Error('Settings recovery evidence changed under exclusion');
    // From this point to completion all I/O is synchronous under the shared
    // guard. Cooperating writers check it both before and after lock creation.
    const verify=()=>{
      if(settingsDirectoryIdentity(guard)!==guardIdentity||settingsDirectoryIdentity(location.installationDirectory)!==current.directoryIdentity||
        settingsDirectoryIdentity(location.runtimeDirectory)!==current.runtimeIdentity)throw new Error('Settings recovery installation changed');
      if(!current.lock||'legacy' in current.lock)throw new Error('Missing structured owner');
      let absent=false;try{process.kill(current.lock.pid,0);}catch(e){absent=(e as NodeJS.ErrnoException).code==='ESRCH';}
      if(!absent)throw new Error('Settings writer is no longer verifiably absent');
      const expectedNames=names(location.installationDirectory).filter(n=>!moved.includes(n));
      const originalNames=current.records.map(r=>r.name).filter(n=>!moved.includes(n));
      if(JSON.stringify(expectedNames)!==JSON.stringify(originalNames))throw new Error('Settings recovery inventory changed');
      for(const r of current.records.filter(r=>!moved.includes(r.name))) {
        const target=path.join(location.installationDirectory,r.name),s=present(target);
        if(r.identity===null){if(s)throw new Error('Settings evidence appeared');continue;}
        if(!s||s.isSymbolicLink()||identity(s)!==r.identity||
          (r.sha256===null?!s.isDirectory():identity(regular(target))!==r.identity||hash(stableBytes(target))!==r.sha256))throw new Error('Settings recovery evidence changed');
      }
    };
    verify();
    stage='archive';
    const targetArchive=path.join(location.runtimeDirectory,'settings-write-explicit-'+randomUUID());
    fs.mkdirSync(targetArchive,{mode:0o700});archive=targetArchive;syncDirectory(location.runtimeDirectory);
    // Guard remains on every partial failure after the durable recovery begins.
    durable(path.join(guard,'settings-recovery.json'),JSON.stringify({schemaVersion:1,inspectionHash:current.inspectionHash,archive:path.basename(archive)}));
    syncDirectory(guard);
    stage='backup';
    const bytes=stableBytes(location.configurationFile),backup=path.join(archive,'data.json.backup');
    durable(backup,bytes);
    if(hash(stableBytes(backup))!==current.records.find(r=>r.name==='data.json')?.sha256)throw new Error('Settings recovery backup verification failed');
    backupVerified=true;
    syncDirectory(archive);verify();
    stage='archive-evidence';
    const artifacts=current.records.filter(r=>r.identity!==null&&r.name!=='data.json'&&!r.name.startsWith('runtime/'));
    // Remove write-lock last; the shared guard remains the partial-failure lock.
    artifacts.sort((a,b)=>Number(a.name==='data.json.write-lock')-Number(b.name==='data.json.write-lock'));
    for(const r of artifacts) {
      verify();const target=path.join(archive,r.name);
      if(present(target))throw new Error('Settings recovery destination already exists');
      fs.renameSync(path.join(location.installationDirectory,r.name),target);moved.push(r.name);
      syncDirectory(archive);syncDirectory(location.installationDirectory);
      if(hash(stableBytes(target))!==r.sha256)throw new Error('Settings recovery archive verification failed');
    }
    verify();
    stage='receipt';
    durable(path.join(archive,'receipt.json'),JSON.stringify({schemaVersion:1,inspectionHash:current.inspectionHash,backup:'data.json.backup',moved,executionsResumed:false,temporaryPromoted:false}));
    syncDirectory(archive);committed=true;
    stage='release-guard';
    fs.unlinkSync(path.join(guard,'settings-recovery.json'));syncDirectory(guard);
    fs.rmdirSync(guard);syncDirectory(location.runtimeDirectory);
    return {recovered:true,stage:'completed',archive,backup,moved,executionsResumed:false,temporaryPromoted:false,directorySync:process.platform==='win32'?'not_supported':'completed'};
  } catch {
    if(archive) {
      try{durable(path.join(archive,'failure.json'),JSON.stringify({stage,moved,committed,guardRetained:present(guard)!==undefined}));failureReceiptWritten=true;}catch{/* preserve guard even if failure receipt cannot be written */}
    } else {
      try{if(settingsDirectoryIdentity(guard)===guardIdentity)fs.rmdirSync(guard);}catch{/* report retained exclusion below */}
    }
    const pending=initial.records.filter(r=>r.identity!==null&&r.name!=='data.json'&&!r.name.startsWith('runtime/')&&!moved.includes(r.name)).map(r=>r.name);
    return {recovered:false,error:'SETTINGS_RECOVERY_FAILED',stage,archive,backup:archive?path.join(archive,'data.json.backup'):undefined,backupVerified,moved,pending,committed,failureReceiptWritten,guardRetained:present(guard)!==undefined,executionsResumed:false,temporaryPromoted:false};
  }
}
