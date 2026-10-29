import * as fs from "fs";
import * as path from "path";
import { createHash, randomUUID } from "crypto";
import { StringDecoder } from "string_decoder";
import { performance } from "perf_hooks";
import { setImmediate } from "timers";
import { execFile } from "child_process";
import { captureJsonStructure, cloneCapturedJson, cloneJsonStructure, encodeCapturedJson, hashJsonCooperatively, hashTextCooperatively, parseCooperatively } from "./cooperative-json";

export type ObservedVersion = {textHash: string | null; valueHash: string | null};

export interface SettingsWriteLock {
  schemaVersion: 1; token: string; transactionId: string; pid: number;
  processStart: string | null; directoryIdentity: string;
}
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
// No command line enumeration, shell, or age-based owner inference.
export async function settingsProcessStart(pid: number): Promise<string | null> {
  if (!Number.isSafeInteger(pid) || pid <= 0) return null;
  try {
    if (process.platform === 'linux') {
      const text = await fs.promises.readFile(`/proc/${pid}/stat`, 'utf8');
      const ticks = text.slice(text.lastIndexOf(')') + 2).split(' ')[19];
      const boot = (await fs.promises.readFile('/proc/sys/kernel/random/boot_id', 'utf8')).trim();
      return /^\d+$/.test(ticks) ? `linux:${boot}:${ticks}` : null;
    }
    const systemRoot=process.env.SystemRoot || 'C:\\Windows';
    if(process.platform==='win32'&&!path.isAbsolute(systemRoot))return null;
    const executable = process.platform === 'win32'
      ? path.join(systemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe') : '/bin/ps';
    const args = process.platform === 'win32'
      ? ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToUniversalTime().Ticks.ToString()`]
      : ['-p', String(pid), '-o', 'lstart='];
    if (process.platform !== 'win32' && process.platform !== 'darwin') return null;
    const value = await new Promise<string>((resolve, reject) => execFile(executable, args,
      {windowsHide:true, timeout:5000, maxBuffer:4096}, (error, stdout) => error ? reject(error) : resolve(stdout.trim())));
    if (process.platform === 'win32') return /^\d{15,20}$/.test(value) ? `windows:${value}` : null;
    return /^[A-Za-z]{3} [A-Za-z]{3}\s+\d{1,2} \d{2}:\d{2}:\d{2} \d{4}$/.test(value) ? `darwin:${value}` : null;
  } catch { return null; }
}
// Obsidian can reload this bundle several times in the same Electron process.
// Cache only that process's OS observation, never another writer's liveness.
const processStartKey=Symbol.for('autooc.settings.process-start.v1');
function ownProcessStart():Promise<string|null> {
  const host=process as typeof process & {[processStartKey]?:Promise<string|null>};
  return host[processStartKey] ||= settingsProcessStart(process.pid);
}
export function parseSettingsWriteLock(text: string): SettingsWriteLock | {token:string; legacy:true} {
  if (uuid.test(text)) return {token:text, legacy:true};
  let value:any; try { value=JSON.parse(text); } catch { throw new Error('Incomplete settings write lock identity'); }
  if (value?.schemaVersion!==1 || !uuid.test(value.token) || !uuid.test(value.transactionId) ||
      !Number.isSafeInteger(value.pid) || value.pid<=0 || typeof value.directoryIdentity!=='string' || !/^[0-9]+:[0-9]+:[0-9.]+$/.test(value.directoryIdentity) ||
      !(value.processStart===null || typeof value.processStart==='string' && /^(?:linux:[a-f0-9-]{36}:\d+|windows:\d{15,20}|darwin:[A-Za-z]{3} [A-Za-z]{3}\s+\d{1,2} \d{2}:\d{2}:\d{2} \d{4})$/.test(value.processStart))) {
    throw new Error('Incomplete settings write lock identity');
  }
  return {schemaVersion:1,token:value.token,transactionId:value.transactionId,pid:value.pid,
    processStart:value.processStart,directoryIdentity:value.directoryIdentity};
}
export function settingsWriteLockToken(file: string): string {
  const stat=fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink!==1 || stat.size>16384) throw new Error('Unsafe settings write lock');
  return parseSettingsWriteLock(fs.readFileSync(file,'utf8')).token;
}
export function assertNoSettingsRecovery(directory: string): void {
  try {fs.lstatSync(path.join(directory,'runtime','lease-recovery.lock'));}
  catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
  throw new Error('Settings recovery guard requires reconciliation');
}

export interface SettingsWriteIntent {
  schemaVersion:1; token:string; directoryIdentity:string; runtimeIdentity:string;
  owner:{schemaVersion:1;token:string;pid:number;createdAt:string};
  originalHash:string|null; temporary?:string; preparedHash?:string;
}
export function settingsDirectoryIdentity(directory:string):string {
  const stat=fs.lstatSync(directory);
  if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('Unsafe settings directory');
  return `${stat.dev}:${stat.ino}:${stat.birthtimeMs}`;
}
function regularIntentText(file:string):string {
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>16384)throw new Error('Unsafe settings write intent');
  return fs.readFileSync(file,'utf8');
}
async function beginSettingsWriteIntent(file:string,token:string,originalHash:string|null) {
  // Generic SettingsWriter users retain the legacy lock contract. A recovery
  // proof is issued only by the process holding this installation's lease.
  if(path.basename(file)!=='data.json')return;
  const directory=path.dirname(file),runtime=path.join(directory,'runtime'),ownerFile=path.join(runtime,'execution.lock','owner.json');
  let ownerText:string;
  try{ownerText=regularIntentText(ownerFile);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
  const owner=JSON.parse(ownerText);
  const ownerDirectoryIdentity=settingsDirectoryIdentity(path.dirname(ownerFile));
  let ownerStat=fs.lstatSync(ownerFile);
  if(owner?.schemaVersion!==1||owner.pid!==process.pid||!/^[a-f0-9-]{36}$/.test(owner.token||'')||!Number.isFinite(Date.parse(owner.createdAt)))throw new Error('Settings writer does not own the execution lease');
  const leaseOwner={schemaVersion:1 as const,token:owner.token,pid:owner.pid,createdAt:owner.createdAt};
  const intent:SettingsWriteIntent={schemaVersion:1,token,directoryIdentity:settingsDirectoryIdentity(directory),runtimeIdentity:settingsDirectoryIdentity(runtime),owner:leaseOwner,originalHash};
  const intentFile=file+'.write-intent',updateFile=intentFile+'.'+token+'.tmp';
  let published:string|undefined;
  const assertOwned=()=>{
    const currentOwnerStat=fs.lstatSync(ownerFile);
    if(currentOwnerStat.dev!==ownerStat.dev||currentOwnerStat.ino!==ownerStat.ino||currentOwnerStat.size!==ownerStat.size||currentOwnerStat.mtimeMs!==ownerStat.mtimeMs||currentOwnerStat.ctimeMs!==ownerStat.ctimeMs||settingsDirectoryIdentity(path.dirname(ownerFile))!==ownerDirectoryIdentity||regularIntentText(ownerFile)!==ownerText||settingsWriteLockToken(file+'.write-lock')!==token||settingsDirectoryIdentity(directory)!==intent.directoryIdentity||settingsDirectoryIdentity(runtime)!==intent.runtimeIdentity)throw new Error('Settings intent ownership changed');
    if(published!==undefined&&regularIntentText(intentFile)!==published)throw new Error('Settings write intent changed');
  };
  const replaceMetadata=async(from:string,to:string)=>{
    for(let attempt=0;;attempt++){
      assertOwned();
      try{await fs.promises.rename(from,to);return;}catch(error){
        if(process.platform!=='win32'||!['EPERM','EBUSY','EACCES'].includes((error as NodeJS.ErrnoException).code||'')||attempt>=4)throw error;
        await new Promise(resolve=>setTimeout(resolve,50*(attempt+1)));
      }
    }
  };
  const publishOwnerAnchor=async(hash?:string)=>{
    assertOwned();const next=JSON.parse(ownerText);
    if(hash)next.settingsWriteIntent={token,sha256:hash};else delete next.settingsWriteIntent;
    const nextText=JSON.stringify(next),temporary=path.join(path.dirname(ownerFile),'owner.settings-intent.'+token+'.tmp');
    const handle=await fs.promises.open(temporary,'wx',0o600);
    try{await handle.writeFile(nextText,'utf8');await handle.sync();}finally{await handle.close();}
    assertOwned();await replaceMetadata(temporary,ownerFile);ownerText=nextText;ownerStat=fs.lstatSync(ownerFile);
  };
  const publish=async(initial=false)=>{
    assertOwned();const text=JSON.stringify(intent),target=initial?intentFile:updateFile;
    const handle=await fs.promises.open(target,'wx',0o600);
    try{await handle.writeFile(text,'utf8');await handle.sync();}finally{await handle.close();}
    assertOwned();
    if(!initial)await replaceMetadata(updateFile,intentFile);
    published=text;
    await publishOwnerAnchor(createHash('sha256').update(text,'utf8').digest('hex'));
  };
  await publish(true);
  return {
    async prepared(temporary:string,preparedHash?:string){intent.temporary=path.basename(temporary);if(preparedHash)intent.preparedHash=preparedHash;await publish();},
    async finish(){
      assertOwned();
      const current=await settingsFingerprint(file);
      if((current!==intent.originalHash&&current!==intent.preparedHash)||fs.existsSync(updateFile)||intent.temporary&&fs.existsSync(path.join(directory,intent.temporary)))throw new Error('Settings write evidence retained for recovery');
      assertOwned();await publishOwnerAnchor();await fs.promises.unlink(intentFile);
    }
  };
}

// One writer per plugin. Serialize only when its previous write has finished.
export class SettingsWriter {
  private tail: Promise<void> = Promise.resolve();
  private observed = new Map<string, ObservedVersion>();
  private cached = new Map<string, any>();
  private pending = 0;
  private writeFailure: unknown;
  private transactions = new Set<Promise<unknown>>();

  // Register host transactions synchronously, before their queued I/O begins.
  // Updates/unload must see these saves even while another session publishes.
  trackTransaction<T>(operation:Promise<T>):Promise<T> {
    this.transactions.add(operation);
    void operation.then(()=>this.transactions.delete(operation),()=>this.transactions.delete(operation));
    return operation;
  }

  async drain(): Promise<void> {
    while(this.transactions.size)await Promise.all([...this.transactions]);
    await this.tail;
    if (this.writeFailure) throw this.writeFailure;
  }
  get hasPendingWrites(): boolean { return this.pending > 0 || this.transactions.size > 0; }

  fork(): SettingsWriter {
    const fork = new SettingsWriter();
    for (const [file,version] of this.observed) fork.observed.set(file,{...version});
    for (const [file,value] of this.cached) fork.cached.set(file,cloneJsonStructure(value));
    return fork;
  }

  confirmedVersion(file: string): ObservedVersion {
    const version = this.observed.get(path.resolve(file));
    if (!version) throw new Error("Catalog has no confirmed version");
    return {...version};
  }

  adoptConfirmed(file: string, version: ObservedVersion, accept: () => boolean): Promise<void> {
    this.pending++;
    const operation = this.tail.then(async () => {
      if (!version.textHash || !/^[a-f0-9]{64}$/.test(version.textHash) || version.valueHash !== version.textHash ||
          await settingsFingerprint(file) !== version.textHash) {
        throw new Error("AutoOC confirmed catalog changed externally; reload before saving");
      }
      if (!accept()) throw new Error("AutoOC settings changed while loading; reload before saving");
      this.observed.set(path.resolve(file), {...version});
      this.cached.delete(path.resolve(file));
    });
    const tracked = operation.finally(() => { this.pending--; });
    this.tail = tracked.then(() => {}, () => {});
    return tracked;
  }

  async assertUnchanged(file: string): Promise<void> {
    const observed = this.observed.get(path.resolve(file));
    if (!observed || await settingsFingerprint(file) !== observed.textHash) {
      throw new Error("AutoOC configuration changed during preflight; reload before execution");
    }
  }

  // Read exactly the version against which subsequent writes are compared.
  // A missing file is distinct from an existing empty/null configuration.
  load(file: string): unknown {
    const text = readSettingsText(file);
    const value = parseSettings(text);
    const hash = (source: string) => createHash("sha256").update(source, "utf8").digest("hex");
    this.observed.set(path.resolve(file), {textHash:text === null ? null : hash(text),
      valueHash:text === null ? null : hash(JSON.stringify(value, null, 2))});
    this.cached.set(path.resolve(file),cloneJsonStructure(value));
    return value;
  }

  // Share the write queue: a late load cannot change the baseline of an
  // in-flight save. The caller may reject publication after a local edit.
  loadAsync(file: string, accept: () => boolean = () => true): Promise<any> {
    this.pending++;
    const operation = this.tail.then(async () => {
      file = path.resolve(file);
      const observed = this.observed.get(file);
      if (observed && this.cached.has(file) && await settingsFingerprint(file) === observed.textHash) {
        if (!accept()) throw new Error("AutoOC settings changed while loading; reload before saving");
        return cloneJsonStructure(this.cached.get(file));
      }
      let text = await readSettingsTextAsync(file);
      const value = text === null ? null : await parseCooperatively(text);
      const missing = text === null, textHash = missing ? null : await hashTextCooperatively(text!);
      // Release the encoded input before preparing the semantic fingerprint.
      text = null;
      const version = {textHash, valueHash:missing ? null : await hashJsonCooperatively(value)};
      if (!accept()) throw new Error("AutoOC settings changed while loading; reload before saving");
      this.observed.set(file, version);
      this.cached.set(file,cloneJsonStructure(value));
      return value;
    });
    const tracked = operation.finally(() => { this.pending--; });
    this.tail = tracked.then(() => {}, () => {});
    return tracked;
  }

  save(file: string, snapshot: () => unknown, validate?: () => void): Promise<void> {
    this.pending++;
    const operation = this.tail.then(async () => {
      file = path.resolve(file);
      await fs.promises.mkdir(path.dirname(file), {recursive:true});
      assertNoSettingsRecovery(path.dirname(file));
      const processStart = await ownProcessStart();
      assertNoSettingsRecovery(path.dirname(file));
      const lock = file + ".write-lock";
      const token = randomUUID();
      // Never steal a stale lock: a dead writer needs explicit recovery.
      // Publish the tiny token without yielding an empty lock to observers.
      // Only its durable flush can be slow; wait for it off the input thread
      // before taking a snapshot or touching the catalog.
      const lockText = JSON.stringify({schemaVersion:1, token, transactionId:randomUUID(), pid:process.pid,
        processStart, directoryIdentity:settingsDirectoryIdentity(path.dirname(file))} satisfies SettingsWriteLock);
      const descriptor = fs.openSync(lock, "wx", 0o600);
      let lockStat:fs.Stats;
      let intent:Awaited<ReturnType<typeof beginSettingsWriteIntent>>;
      // Early publication/flush/close failures retain the lock, including an
      // incomplete one. They never authorize automatic recovery or a snapshot.
      try {
        lockStat = fs.fstatSync(descriptor);
        fs.writeFileSync(descriptor, lockText);
        await new Promise<void>((resolve, reject) => fs.fsync(descriptor, error => error ? reject(error) : resolve()));
      } finally { fs.closeSync(descriptor); }
      try {
        assertNoSettingsRecovery(path.dirname(file));
        const observed = this.observed.get(file), currentHash = await settingsFingerprint(file);
        if (!observed || observed.textHash !== currentHash) {
          const current = await readSettingsTextAsync(file);
          const currentValue = current === null ? null : await parseCooperatively(current);
          if (observed && (observed.textHash === null || current === null ||
              observed.valueHash !== await hashJsonCooperatively(currentValue))) {
            throw new Error("AutoOC configuration changed externally; reload before saving");
          }
        }
        validate?.();
        intent=await beginSettingsWriteIntent(file,token,currentHash);
        const captured = captureJsonStructure(snapshot());
        // Async preparation opens a window for an external non-cooperating
        // editor or lock replacement. Verify both before replacing any bytes.
        if (fs.lstatSync(lock).isSymbolicLink() || fs.readFileSync(lock,"utf8") !== lockText) {
          throw new Error("Settings write lock ownership changed");
        }
        if (await settingsFingerprint(file) !== currentHash) {
          throw new Error("AutoOC configuration changed during preparation; reload before saving");
        }
        const nextHash = await atomicSettingsTextWrite(file, encodeCapturedJson(captured), fs.promises, async () => {
          validate?.();
          if (await settingsFingerprint(file) !== currentHash) {
            throw new Error("AutoOC configuration changed during replacement; reload before saving");
          }
          assertNoSettingsRecovery(path.dirname(file));
          if (fs.lstatSync(lock).isSymbolicLink() || fs.readFileSync(lock,"utf8") !== lockText) {
            throw new Error("Settings write lock ownership changed");
          }
          validate?.();
        },intent?.prepared);
        this.observed.set(file, {textHash:nextHash, valueHash:nextHash});
        this.cached.set(file,cloneCapturedJson(captured));
      } finally {
        try{await intent?.finish();}finally{
        const currentLock=fs.lstatSync(lock);
        if (currentLock.isSymbolicLink() || currentLock.dev!==lockStat.dev || currentLock.ino!==lockStat.ino || currentLock.birthtimeMs!==lockStat.birthtimeMs || fs.readFileSync(lock,"utf8") !== lockText) {
          throw new Error("Settings write lock ownership changed");
        }
        fs.unlinkSync(lock);
        }
      }
    });
    const tracked = operation.finally(() => { this.pending--; });
    this.tail = tracked.catch(error => { this.writeFailure = error; });
    return tracked;
  }
}

// Explicit macrotask budget: resolved filesystem promises alone may starve input.
function ioBudget(): () => Promise<void> | undefined {
  let started = performance.now();
  return () => {
    if (performance.now() - started < 4) return;
    return new Promise<void>(resolve => setImmediate(() => {
      started = performance.now();
      resolve();
    }));
  };
}

function sameSettingsFile(before: fs.Stats, after: fs.Stats): boolean {
  return after.isFile() && before.dev === after.dev && before.ino === after.ino &&
    before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs;
}

// Hash bounded bytes; never retain an extra full catalog between operations.
export async function settingsFingerprint(file: string): Promise<string | null> {
  let handle: fs.promises.FileHandle | undefined;
  let inspected = false;
  try {
    const stat = await fs.promises.lstat(file);
    inspected = true;
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Configuration must be a regular file");
    handle = await fs.promises.open(file, "r");
    const opened = await handle.stat();
    if (!sameSettingsFile(stat, opened)) throw new Error("Configuration identity changed while reading");
    const buffer = Buffer.allocUnsafe(256 * 1024), hash = createHash("sha256"), budget = ioBudget();
    let total = 0;
    for (;;) {
      const {bytesRead} = await handle.read(buffer, 0, buffer.length, null);
      if (!bytesRead) {
        const after = await handle.stat();
        const current = await fs.promises.lstat(file);
        if (total !== opened.size || !sameSettingsFile(opened, after) || current.isSymbolicLink() || !sameSettingsFile(opened, current)) throw new Error("Configuration changed while reading");
        return hash.digest("hex");
      }
      total += bytesRead;
      if (total > opened.size) throw new Error("Configuration changed while reading");
      hash.update(buffer.subarray(0, bytesRead));
      const pause = budget();
      if (pause) await pause;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      if (!inspected) return null;
      throw new Error("Configuration changed while reading");
    }
    throw error;
  } finally { await handle?.close(); }
}

export async function readSettingsTextAsync(file: string): Promise<string | null> {
  let inspected = false;
  try {
    const stat = await fs.promises.lstat(file);
    inspected = true;
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Configuration must be a regular file");
    const handle = await fs.promises.open(file, "r");
    try {
      const opened = await handle.stat();
      if (!sameSettingsFile(stat, opened)) throw new Error("Configuration identity changed while reading");
      // Read into external bytes first. UTF8 decoding itself can take hundreds
      // of milliseconds for multibyte catalogs, even when I/O is asynchronous.
      // One full backing buffer; never accumulate chunks and concatenate them.
      let bytes:Buffer|undefined = Buffer.allocUnsafe(opened.size);
      const budget = ioBudget();
      for (let offset = 0; offset < bytes.length;) {
        const {bytesRead} = await handle.read(bytes, offset, Math.min(256 * 1024, bytes.length - offset), null);
        if (!bytesRead) throw new Error("Configuration changed while reading");
        offset += bytesRead;
        const pause = budget();
        if (pause) await pause;
      }
      const after = await handle.stat();
      const afterRead = await fs.promises.lstat(file);
      if (!sameSettingsFile(opened, after) || afterRead.isSymbolicLink() || !sameSettingsFile(opened, afterRead)) throw new Error("Configuration changed while reading");
      if(bytes.length<=256*1024)return bytes.toString("utf8");
      // ASCII has a cheap single native decode and needs no second live text
      // copy. Detect it in bounded byte slices, not by decoding twice. Older
      // Node hosts without isAscii use the same bounded scan cooperatively.
      const isAscii:((input:Uint8Array)=>boolean)|undefined=require("buffer").isAscii;
      let ascii=true;
      for(let offset=0;offset<bytes.length;offset+=256*1024) {
        const slice=bytes.subarray(offset,offset+256*1024);
        if(isAscii ? !isAscii(slice) : slice.some(byte=>byte>127)){ascii=false;break;}
        await new Promise<void>(resolve=>setImmediate(resolve));
      }
      if(ascii) {
        const final=await handle.stat();
        const current=await fs.promises.lstat(file);
        if(!sameSettingsFile(opened,final) || current.isSymbolicLink() || !sameSettingsFile(opened,current))throw new Error("Configuration changed while reading");
        return bytes.toString("utf8");
      }
      const decoder=new StringDecoder("utf8"),parts:string[]=[];
      for(let offset=0;offset<bytes.length;offset+=256*1024) {
        parts.push(decoder.write(bytes.subarray(offset,offset+256*1024)));
        await new Promise<void>(resolve=>setImmediate(resolve));
      }
      parts.push(decoder.end());
      // Do not retain input bytes alongside both the pieces and their joined
      // copy. No cache survives this read; malformed UTF8 has native semantics.
      bytes=undefined;
      const final=await handle.stat();
      const current=await fs.promises.lstat(file);
      if(!sameSettingsFile(opened,final) || current.isSymbolicLink() || !sameSettingsFile(opened,current))throw new Error("Configuration changed while reading");
      return parts.join("");
    } finally { await handle.close(); }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      if (!inspected) return null;
      throw new Error("Configuration changed while reading");
    }
    throw error;
  }
}

function readSettingsText(file: string): string | null {
  try {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Configuration must be a regular file");
    try { return fs.readFileSync(file,"utf8"); }
    catch { throw new Error("Cannot read valid AutoOC configuration"); }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function parseSettings(text: string | null): unknown {
  if (text === null) return null;
  try { return JSON.parse(text); }
  catch { throw new Error("Cannot read valid AutoOC configuration"); }
}

export async function atomicSettingsWrite(file: string, data: unknown, io = fs.promises, beforeReplace?:()=>Promise<void>): Promise<void> {
  const text = JSON.stringify(data, null, 2);
  if (text === undefined) throw new Error("Settings are not serializable");
  await atomicSettingsTextWrite(file, text, io, beforeReplace);
}

// The snapshot has already been serialized once; keep those bytes immutable
// across asynchronous writes and retries without another JSON round trip.
async function atomicSettingsTextWrite(file: string, text: string | Generator<string,void,void>, io = fs.promises, beforeReplace?: () => Promise<void>, prepared?: (temporary:string,hash?:string)=>Promise<void>): Promise<string> {
  const temp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  await io.mkdir(path.dirname(file), { recursive: true });
  let handle: Awaited<ReturnType<typeof io.open>> | undefined;
  const hash = createHash("sha256");
  try {
    await prepared?.(temp);
    handle = await io.open(temp, "wx", 0o600);
    const parts = typeof text === "string" ? [text] : text;
    let batch: string[] = [], size = 0;
    const flush = async () => {
      const part = batch.join(""); batch = []; size = 0;
      hash.update(part, "utf8");
      await handle!.writeFile(part,"utf8");
    };
    for (const part of parts) for (let start = 0; start < part.length;) {
      let end = Math.min(start + 64 * 1024, part.length);
      if (end < part.length && part.charCodeAt(end - 1) >= 0xd800 && part.charCodeAt(end - 1) <= 0xdbff &&
          part.charCodeAt(end) >= 0xdc00 && part.charCodeAt(end) <= 0xdfff) end--;
      const chunk = part.slice(start,end); batch.push(chunk); size += chunk.length;
      start = end;
      if (size >= 64 * 1024) await flush();
    }
    if (size) await flush();
    await handle.sync();
    await handle.close();
    handle = undefined;
    await prepared?.(temp,hash.copy().digest('hex'));
    // Windows may briefly deny replacement while another reader has the file
    // open. Retry only the atomic rename, never the snapshot or workflow effect.
    const baseline = beforeReplace ? undefined : await io.readFile(file).catch(error => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    for (let attempt = 0; ; attempt++) {
      await beforeReplace?.();
      try { await io.rename(temp, file); break; }
      catch (error) {
        if (process.platform !== "win32" || !["EPERM", "EBUSY"].includes((error as NodeJS.ErrnoException).code || "") || attempt >= 4) throw error;
        await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
        if (beforeReplace) continue;
        const current = await io.readFile(file).catch(readError => {
          if (readError.code === "ENOENT") return null;
          throw readError;
        });
        if (baseline == null ? current !== null : current === null || !baseline.equals(current)) {
          throw new Error("AutoOC configuration changed during replacement; reload before saving");
        }
      }
    }
    return hash.digest("hex");
  } finally {
    if (handle) await handle.close().catch(() => {});
    // Only this write's own temporary file; never remove the previous settings.
    await io.unlink(temp).catch(() => {});
  }
}
