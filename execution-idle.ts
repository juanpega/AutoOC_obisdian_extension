import * as fs from "fs";
import * as path from "path";
import { setTimeout as delay } from "timers/promises";
import { performance } from "perf_hooks";
import { readExecutionCheckpoint, type RunCheckpoint } from "./execution-journal";
import { validateProgressBinding } from "./workflow-progress";

// Read-only proof used before automatic recovery, release and installation.
// A terminal label alone does not prove an external effect/evaluation ended.
export function assertIdleJournals(runtime: string): Map<string, RunCheckpoint> {
  if (fs.existsSync(path.join(runtime, "update-pending.json"))) throw new Error("Incomplete plugin update requires recovery before execution");
  const checkpoints = new Map<string, RunCheckpoint>();
  for (const name of fs.readdirSync(runtime)) {
    if (name.endsWith(".tmp") || name.endsWith(".write-lock")) throw new Error("Unfinished execution write requires reconciliation");
    if (!/^[a-zA-Z0-9-]+\.json$/.test(name)) continue;
    const state = readExecutionCheckpoint(runtime, name.slice(0, -5));
    if (!["completed", "failed"].includes(state.phase) || state.steps.some(step =>
      step.status === "in_flight" || step.approval || step.result?.cancelled || step.evaluations?.some(item => item.status !== "completed"))) {
      throw new Error("Unfinished execution or uncertain effect requires reconciliation");
    }
    checkpoints.set(state.runId, state);
  }
  return checkpoints;
}

export function assertIdleCatalog(settings: any, checkpoints: Map<string, RunCheckpoint>): void {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) throw new Error("Invalid execution configuration");
  for (const kind of ["tasks", "workflows"]) {
    const entries = settings[kind] ?? [];
    if (!Array.isArray(entries)) throw new Error("Invalid execution catalog");
    for (const entry of entries) {
      if (!entry || typeof entry.id !== "string") throw new Error("Invalid execution entry");
      if (entry.status === "running" || entry.pendingCodexApproval) throw new Error("Active execution requires reconciliation");
      const legacy = entry.legacyExecution;
      if (legacy && (legacy.stopState || (kind === "tasks"
        ? !Number.isFinite(Date.parse(legacy.finishedAt)) || !["pending", "completed", "failed"].includes(entry.status)
        : entry.status !== "completed" || !Array.isArray(entry.steps) || entry.steps.some((step: any) => step.status === "running")))) {
        throw new Error("Legacy execution outcome is unconfirmed");
      }
      const binding = entry.runtimeExecution;
      if (!binding) continue;
      const checkpoint = checkpoints.get(binding.runId);
      if (!checkpoint || binding.requiresReconciliation) throw new Error("Execution binding requires reconciliation");
      validateProgressBinding({id: kind === "workflows" ? entry.id : binding.workflowId, runtimeExecution: binding}, checkpoint, binding.runId);
      if (kind === "tasks" && checkpoint.workflowId !== `@task:${entry.id}` && !checkpoint.steps.some(step => step.stepId === binding.stepId)) {
        throw new Error("Bound task step is absent from its journal");
      }
    }
  }
}

export function assertInstalledExecutionIdle(directory: string, memorySettings?: unknown): void {
  const checkpoints = assertIdleJournals(path.join(directory, "runtime"));
  const file = path.join(directory, "data.json");
  if (fs.existsSync(file + ".write-lock") || fs.readdirSync(directory).some(name => name.startsWith("data.json.") && name.endsWith(".tmp"))) {
    throw new Error("Unfinished configuration write requires reconciliation");
  }
  let stat: fs.Stats | undefined;
  try { stat = fs.lstatSync(file); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  if (stat) {
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error("Unsafe execution configuration");
    assertIdleCatalog(JSON.parse(fs.readFileSync(file, "utf8")), checkpoints);
  }
  if (memorySettings !== undefined) assertIdleCatalog(memorySettings, checkpoints);
}

// The host does not await the outgoing Dashboard's save. Before taking a
// catalog snapshot, startup may wait for the initial SettingsWriter queue
// (1.6.1 atomic rename) or saveData truncation (1.6.0). This is read-only;
// recovery, release and execution retain their synchronous fail-closed checks.
export async function waitForInstalledCatalog(directory: string, assertOwner: () => void): Promise<() => void> {
  const file = path.join(directory, "data.json");
  const lock = file + ".write-lock";
  const identity = (stat: fs.Stats) => `${stat.dev}:${stat.ino}:${stat.birthtimeMs}`;
  const directoryIdentity = identity(fs.lstatSync(directory));
  let fileIdentity: string | null | undefined;
  let initial = true, writer: { identity: string; token: string; catalog: string | null } | undefined, writerFinished = false;
  const temporaryIdentities = new Map<string, string>();
  const regularStat = (target: string): fs.Stats | undefined => {
    let stat: fs.Stats;
    try { stat = fs.lstatSync(target); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error("Unsafe execution configuration or write marker");
    return stat;
  };
  const checkContext = () => {
    if (identity(fs.lstatSync(directory)) !== directoryIdentity) throw new Error("Installation identity changed during startup");
    assertOwner();
  };
  const pendingWriter = (): boolean => {
    checkContext();
    const stat = regularStat(lock);
    const temporaries = fs.readdirSync(directory).filter(name => name.startsWith("data.json.") && name.endsWith(".tmp"));
    if (stat) {
      const token = fs.readFileSync(lock, "utf8");
      if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(token)) throw new Error("Unsafe configuration write lock token");
      if (!writer) {
        if (!initial) throw new Error("Configuration write started after startup snapshot");
        const catalog = regularStat(file);
        writer = { identity: identity(stat), token, catalog: catalog ? identity(catalog) : null };
      } else if (writerFinished || writer.identity !== identity(stat) || writer.token !== token) {
        // Each queued save gets a NEW lock and UUID. A token change alone is
        // not proof of a queue: require the predecessor's observed temporary
        // inode to have become data.json, and its old path to be absent. This
        // is a read-only, conservative proof of an atomic commit, not recovery
        // of an unknown writer. Missed/unverifiable transitions fail closed.
        const catalog = regularStat(file);
        const catalogIdentity = catalog ? identity(catalog) : null;
        const committed = [...temporaryIdentities].some(([name, id]) =>
          id === catalogIdentity && !regularStat(path.join(directory, name)));
        if (writer.identity === identity(stat) || writer.token === token ||
            catalogIdentity === writer.catalog || !committed) {
          throw new Error("Configuration write lock ownership changed without an observed atomic commit");
        }
        writer = { identity: identity(stat), token, catalog: catalogIdentity };
        writerFinished = false;
        temporaryIdentities.clear();
        // A gap between queued saves is not the final quiescent snapshot.
        // Only this proved transition permits repinning before we return.
        fileIdentity = undefined;
      }
      const after = regularStat(lock);
      if (!after || identity(after) !== writer.identity) throw new Error("Configuration write lock ownership changed");
      // Only the outgoing writer in this renderer can be finishing a save.
      // A foreign/abandoned temporary is not an invitation to recover it.
      for (const name of temporaries) {
        if (!new RegExp(`^data\\.json\\.${process.pid}\\.[0-9]+\\.[0-9a-f]+\\.tmp$`).test(name)) throw new Error("Unsafe configuration temporary writer");
        const temporary = regularStat(path.join(directory, name));
        if (!temporary) continue; // It may have just been atomically renamed.
        const before = temporaryIdentities.get(name);
        if (before && before !== identity(temporary)) throw new Error("Configuration temporary identity changed");
        temporaryIdentities.set(name, identity(temporary));
      }
      regularStat(file);
      initial = false;
      return true;
    }
    if (temporaries.length) throw new Error("Unfinished configuration write requires reconciliation");
    writerFinished = Boolean(writer);
    initial = false;
    return false;
  };
  const read = (): string | null => {
    checkContext();
    if (regularStat(lock) || fs.readdirSync(directory).some(name => name.startsWith("data.json.") && name.endsWith(".tmp"))) {
      throw new Error("Unfinished configuration write requires reconciliation");
    }
    const stat = regularStat(file);
    const currentIdentity = stat ? identity(stat) : null;
    // Pin only after the initial writer has removed its lock and temporaries.
    // Its atomic rename changes the inode legitimately. From this first
    // quiescent snapshot onward even a byte-identical replacement is rejected.
    if (fileIdentity === undefined) fileIdentity = currentIdentity;
    if (fileIdentity !== currentIdentity) throw new Error("Configuration identity changed during startup");
    if (!stat) return null;
    const fd = fs.openSync(file, "r");
    try {
      if (identity(fs.fstatSync(fd)) !== fileIdentity) throw new Error("Configuration identity changed during startup");
      const value = fs.readFileSync(fd, "utf8");
      if (identity(fs.lstatSync(file)) !== fileIdentity) throw new Error("Configuration identity changed during startup");
      return value;
    } finally { fs.closeSync(fd); }
  };
  const startedAt = performance.now();
  const deadline = startedAt + 2_000;
  // A historical Dashboard queues multiple atomic saves. Under native load
  // five legitimate saves exceeded the former 2s TOTAL budget. Allow 10s for
  // that observed queue (5x the old budget), including final stabilization.
  // Never renew this deadline on notifications or commits: a stuck/endless
  // writer still fails closed. Legacy JSON truncation keeps its 2s budget.
  const writerDeadline = startedAt + 10_000;
  let previous: string | null | undefined, stableSince = performance.now();
  // Wake on directory changes as well as the bounded polling fallback. A
  // historical queue can commit several files inside a 25ms polling interval.
  // Notifications never authorize a transition: the inode proof above does.
  let wake: (() => void) | undefined, changed = false;
  const watcher = fs.watch(directory, () => { changed = true; wake?.(); });
  let watchError: Error | undefined;
  watcher.on("error", error => { watchError = error; wake?.(); });
  const wait = async () => {
    if (changed) { changed = false; return; }
    const controller = new AbortController();
    try {
      await Promise.race([
        new Promise<void>(resolve => { wake = resolve; }),
        delay(25, undefined, { signal: controller.signal }).catch(error => {
          if (error.name !== "AbortError") throw error;
        })
      ]);
    } finally { wake = undefined; changed = false; controller.abort(); }
  };
  try { while (true) {
    if (watchError) throw watchError;
    checkContext();
    const checkpoints = assertIdleJournals(path.join(directory, "runtime"));
    if (pendingWriter()) {
      // Atomic writers never truncate the installed catalog. Do not let a
      // finishing UI save hide already persisted uncertainty or corruption.
      const current = regularStat(file);
      if (current) assertIdleCatalog(JSON.parse(fs.readFileSync(file, "utf8")), checkpoints);
      if (performance.now() >= writerDeadline) throw new Error("Unfinished configuration write requires reconciliation; startup wait expired");
      stableSince = performance.now();
      await wait();
      continue;
    }
    const value = read();
    let settings: unknown, valid = true;
    try { settings = value === null ? null : JSON.parse(value); }
    catch (error) { if (!(error instanceof SyntaxError)) throw error; valid = false; }
    // Retry syntax only, never invalid catalogs, uncertain journals or owners.
    if (valid && value !== null) assertIdleCatalog(settings, checkpoints);
    if (!valid || previous !== value) stableSince = performance.now();
    previous = valid ? value : undefined;
    if (writer && performance.now() >= writerDeadline) throw new Error("AutoOC configuration did not become valid and stable during startup; retry after the legacy writer finishes");
    if (valid && performance.now() - stableSince >= 100) {
      return () => {
        const current = read();
        if (current !== value) throw new Error("Configuration changed after startup validation; retry safely");
        assertInstalledExecutionIdle(directory);
      };
    }
    if (performance.now() >= deadline && !writer) throw new Error("AutoOC configuration did not become valid and stable during startup; retry after the legacy writer finishes");
    await wait();
  } } finally { watcher.close(); }
}
