import * as fs from 'fs';
import * as path from 'path';
import {createHash} from 'crypto';
import {readExecutionLeaseOwner,recoverExecutionLeaseAsync} from './execution-lease';
import {readSettingsTextAsync,settingsFingerprint,settingsDirectoryIdentity,type SettingsWriteIntent} from './settings-writer';
import {parseCooperatively,hashTextCooperatively} from './cooperative-json';
import {assertIdleCatalog,assertIdleJournals} from './execution-idle';
import { settingsWriteLockToken } from './settings-writer';

function statFile(file:string){const s=fs.lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1)throw new Error('Unsafe interrupted settings artifact');return s;}
function small(file:string){const s=statFile(file);if(s.size>16384)throw new Error('Oversized settings recovery marker');return fs.readFileSync(file,'utf8');}
function sameFile(a:fs.Stats,b:fs.Stats){return a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;}
const exists=(p:string)=>{try{fs.lstatSync(p);return true;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return false;throw e;}};

// Only new, owner-bound proofs permit automatic recovery. Legacy UUID locks
// and temporaries without a proof keep the existing explicit recovery path.
export async function recoverInterruptedSettingsWrite(directory:string,assertOpen:()=>void=()=>{}) {
  const file=path.join(directory,'data.json'),intentFile=file+'.write-intent',runtime=path.join(directory,'runtime');
  if(!exists(intentFile))return;
  const intentText=small(intentFile),intent=JSON.parse(intentText) as SettingsWriteIntent;
  if(intent.schemaVersion!==1||!/^[a-f0-9-]{36}$/.test(intent.token||'')||!intent.owner||!Number.isSafeInteger(intent.owner.pid)||intent.owner.pid<=0||
    !/^[a-f0-9]{64}$/.test(intent.originalHash||'')||intent.preparedHash!==undefined&&!/^[a-f0-9]{64}$/.test(intent.preparedHash)||
    intent.temporary!==undefined&&!new RegExp(`^data\\.json\\.${intent.owner.pid}\\.[0-9]+\\.[0-9a-f]+\\.tmp$`).test(intent.temporary)||intent.preparedHash&&!intent.temporary)throw new Error('Invalid interrupted settings proof');
  const owner=readExecutionLeaseOwner(runtime);
  if(JSON.stringify(owner)!==JSON.stringify(intent.owner))throw new Error('Interrupted settings owner identity changed');
  const archive=path.join(runtime,'settings-write-recovery-'+intent.token);
  let primaryHash:string|undefined;
  await recoverExecutionLeaseAsync(runtime,owner.token,async currentOwner=>{
    const assertContext=()=>{
      assertOpen();
      const anchor=JSON.parse(small(path.join(runtime,'execution.lock','owner.json'))).settingsWriteIntent;
      if(anchor?.token!==intent.token||anchor?.sha256!==createHash('sha256').update(intentText,'utf8').digest('hex'))throw new Error('Interrupted settings proof is not bound to its execution owner');
      if(settingsDirectoryIdentity(directory)!==intent.directoryIdentity||settingsDirectoryIdentity(runtime)!==intent.runtimeIdentity||
        small(intentFile)!==intentText||JSON.stringify(readExecutionLeaseOwner(runtime))!==JSON.stringify(currentOwner))throw new Error('Interrupted settings installation or proof changed');
      if(exists(file+'.write-lock')&&settingsWriteLockToken(file+'.write-lock')!==intent.token)throw new Error('Interrupted settings lock token changed');
      if(fs.readdirSync(runtime).some(n=>n==='update-pending.json'||n.endsWith('.tmp')||n.endsWith('.write-lock')))throw new Error('Runtime maintenance is unresolved');
    };
    assertContext();
    const primaryStat=statFile(file),text=await readSettingsTextAsync(file);
    if(text===null)throw new Error('Saved catalog is missing');
    primaryHash=await hashTextCooperatively(text);
    if(primaryHash!==intent.originalHash&&primaryHash!==intent.preparedHash)throw new Error('Saved catalog does not match interrupted settings proof');
    const catalog=await parseCooperatively(text);
    if(!Array.isArray(catalog?.tasks)||!Array.isArray(catalog?.workflows))throw new Error('Saved catalog is invalid');
    // All historical uncertainty and disposition/snapshot checks stay strict.
    // This is recovery of a settings write, never reconciliation of execution.
    assertIdleCatalog(catalog,assertIdleJournals(runtime));
    if(await settingsFingerprint(file)!==primaryHash||!sameFile(primaryStat,statFile(file)))throw new Error('Saved catalog changed during recovery');
    const intentUpdate='data.json.write-intent.'+intent.token+'.tmp';
    const allowed=new Set([intent.temporary,intentUpdate]);
    const temporaries=()=>fs.readdirSync(directory).filter(n=>n.startsWith('data.json.')&&n.endsWith('.tmp')).sort();
    const names=temporaries();if(names.some(n=>!allowed.has(n)))throw new Error('Unidentified settings temporary requires explicit recovery');
    const artifacts=[...names,...(exists(file+'.write-lock')?['data.json.write-lock']:[]),'data.json.write-intent'];
    const records:Array<{name:string;stat:fs.Stats;hash:string|null}>=[];
    for(const name of artifacts){const target=path.join(directory,name),stat=statFile(target),hash=await settingsFingerprint(target);if(!sameFile(stat,statFile(target)))throw new Error('Interrupted settings artifact changed');records.push({name,stat,hash});}
    assertContext();
    if(JSON.stringify(temporaries())!==JSON.stringify(names)||exists(archive))throw new Error('Settings recovery state changed or archive exists');
    if(await settingsFingerprint(file)!==primaryHash)throw new Error('Saved catalog changed before archival');
    fs.mkdirSync(archive);const moved:string[]=[];
    try{
      for(const record of records){
        assertOpen();const target=path.join(directory,record.name);
        if(!sameFile(record.stat,statFile(target))||await settingsFingerprint(target)!==record.hash)throw new Error('Interrupted settings artifact changed before archival');
        for(let attempt=0;;attempt++){
          assertOpen();
          if(!sameFile(record.stat,statFile(target)))throw new Error('Interrupted settings artifact identity changed');
          try{await fs.promises.rename(target,path.join(archive,record.name));break;}catch(error){
            if(process.platform!=='win32'||!['EPERM','EBUSY','EACCES'].includes((error as NodeJS.ErrnoException).code||'')||attempt>=4)throw error;
            await new Promise(resolve=>setTimeout(resolve,50*(attempt+1)));
          }
        }
        moved.push(record.name);
      }
      if(await settingsFingerprint(file)!==primaryHash||!sameFile(primaryStat,statFile(file)))throw new Error('Saved catalog changed after archival');
      for(const record of records)if(await settingsFingerprint(path.join(archive,record.name))!==record.hash)throw new Error('Settings recovery archive verification failed');
      assertOpen();
      const receipt={schemaVersion:1,at:new Date().toISOString(),token:intent.token,owner:currentOwner,primaryHash,moved,artifacts:records.map(r=>({name:r.name,hash:r.hash})),temporaryPromoted:false,executionsResumed:false};
      const handle=await fs.promises.open(path.join(archive,'receipt.json'),'wx',0o600);try{await handle.writeFile(JSON.stringify(receipt,null,2));await handle.sync();}finally{await handle.close();}
    }catch(error){
      fs.writeFileSync(path.join(archive,'failure.json'),JSON.stringify({moved,error:String(error)}),{flag:'wx',mode:0o600});throw error;
    }
  });
  return {archive,primaryHash,executionsResumed:false,temporaryPromoted:false};
}
