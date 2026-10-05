import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

export interface ExecutionLease {
  readonly directory: string;
  token: string;
  assertOwned(): void;
  release(): void;
}

// Both hosts must acquire this lease before executing or migrating run state.
// An abandoned lease is retained for explicit reconciliation, never stolen on
// the basis of age or PID alone (PIDs can be reused).
export function acquireExecutionLease(runtimeDirectory: string): ExecutionLease {
  const root = fs.realpathSync(runtimeDirectory);
  if (fs.existsSync(path.join(root, "update-pending.json"))) throw new Error("Incomplete plugin update requires recovery before execution");
  const recovery = path.join(root,"lease-recovery.lock");
  if (fs.existsSync(recovery)) throw new Error("Execution lease recovery is in progress");
  const lock = path.join(root, "execution.lock");
  const ownerPath = path.join(lock, "owner.json");
  const token = randomUUID();
  fs.mkdirSync(lock); // Atomic exclusion. EEXIST includes incomplete owners.
  if (fs.existsSync(recovery)) {
    fs.rmdirSync(lock); // Our just-created, empty reservation only.
    throw new Error("Execution lease recovery is in progress");
  }
  try {
    const fd = fs.openSync(ownerPath, "wx", 0o600);
    try {
      fs.writeFileSync(fd, JSON.stringify({schemaVersion:1, token, pid:process.pid, createdAt:new Date().toISOString()}));
      fs.fsyncSync(fd);
    } finally { fs.closeSync(fd); }
  } catch (error) {
    // Preserve an incomplete owner as evidence; automatic cleanup could hide
    // whether another process observed this execution reservation.
    throw error;
  }
  let released = false;
  const assertOwned = () => {
    if (released) throw new Error("Execution lease already released");
    if (fs.lstatSync(lock).isSymbolicLink() || fs.realpathSync(lock) !== lock) throw new Error("Execution lease directory changed");
    if (fs.lstatSync(ownerPath).isSymbolicLink()) throw new Error("Execution lease owner changed");
    const owner = JSON.parse(fs.readFileSync(ownerPath, "utf8"));
    if (owner.token !== token || owner.pid !== process.pid || owner.schemaVersion !== 1) throw new Error("Execution lease ownership changed");
  };
  return {
    directory: root,
    token,
    assertOwned,
    release() {
      assertOwned();
      fs.unlinkSync(ownerPath);
      fs.rmdirSync(lock); // Only our empty directory; never recurse.
      released = true;
    },
  };
}

export function readExecutionLeaseOwner(runtimeDirectory:string) {
  const root=fs.realpathSync(runtimeDirectory),lock=path.join(root,"execution.lock"),file=path.join(lock,"owner.json");
  if (fs.lstatSync(lock).isSymbolicLink() || fs.realpathSync(lock)!==lock || fs.lstatSync(file).isSymbolicLink()) throw new Error("Invalid execution lease paths");
  let owner:any;
  try {owner=JSON.parse(fs.readFileSync(file,"utf8"));} catch {throw new Error("Incomplete execution lease owner; manual reconciliation required");}
  if (owner?.schemaVersion!==1 || !/^[a-f0-9-]{36}$/.test(owner.token || "") || !Number.isSafeInteger(owner.pid) || owner.pid<=0 || !Number.isFinite(Date.parse(owner.createdAt))) throw new Error("Invalid execution lease owner");
  return {schemaVersion:1,token:owner.token as string,pid:owner.pid as number,createdAt:owner.createdAt as string};
}

// Explicit identity-bound recovery, never an automatic age/PID-based retry.
// Only archive the reservation after the OS proves its owner is absent. The
// unchanged journals still block every uncertain effect, including children
// which may outlive that owner. This operation never resumes an execution.
export function recoverExecutionLease(runtimeDirectory:string,expectedToken:string,assertSafe?:()=>void) {
  const root=fs.realpathSync(runtimeDirectory),guard=path.join(root,"lease-recovery.lock");
  fs.mkdirSync(guard);
  try {
    const owner=readExecutionLeaseOwner(root);
    if (owner.token!==expectedToken) throw new Error("Execution lease recovery identity changed");
    let absent=false;
    try {process.kill(owner.pid,0);} catch(error) {absent=(error as NodeJS.ErrnoException).code==='ESRCH';}
    if (!absent) throw new Error("Execution lease owner is live or cannot be verified absent");
    // Automatic callers must prove inactivity while holding the recovery guard.
    // The explicit CLI recovery contract remains identity-bound and unchanged.
    assertSafe?.();
    if (JSON.stringify(readExecutionLeaseOwner(root))!==JSON.stringify(owner)) throw new Error("Execution lease changed during recovery");
    const archived=`abandoned-lease-${owner.token}`;
    if (fs.existsSync(path.join(root,archived))) throw new Error("Recovery archive already exists");
    fs.renameSync(path.join(root,"execution.lock"),path.join(root,archived));
    return {recovered:true,archived,executionsResumed:false};
  } finally {fs.rmdirSync(guard);}
}
