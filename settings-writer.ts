import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

// One writer per plugin. Serialize only when its previous write has finished.
export class SettingsWriter {
  private tail: Promise<void> = Promise.resolve();
  private observed = new Map<string, string | null>();
  private pending = 0;
  get hasPendingWrites(): boolean { return this.pending > 0; }

  // Read exactly the version against which subsequent writes are compared.
  // A missing file is distinct from an existing empty/null configuration.
  load(file: string): unknown {
    const value = readSettingsVersion(file);
    this.observed.set(path.resolve(file), value);
    return value === null ? null : JSON.parse(value);
  }

  save(file: string, snapshot: () => unknown): Promise<void> {
    this.pending++;
    const operation = this.tail.then(async () => {
      file = path.resolve(file);
      await fs.promises.mkdir(path.dirname(file), {recursive:true});
      const lock = file + ".write-lock";
      const token = randomUUID();
      // Never steal a stale lock: a dead writer needs explicit recovery.
      const descriptor = fs.openSync(lock, "wx", 0o600);
      try { fs.writeFileSync(descriptor, token); fs.fsyncSync(descriptor); }
      finally { fs.closeSync(descriptor); }
      try {
        const current = readSettingsVersion(file);
        if (this.observed.has(file) && this.observed.get(file) !== current) {
          throw new Error("AutoOC configuration changed externally; reload before saving");
        }
        const serialized = JSON.stringify(snapshot());
        if (serialized === undefined) throw new Error("Settings are not serializable");
        await atomicSettingsWrite(file, JSON.parse(serialized));
        this.observed.set(file, serialized);
      } finally {
        if (fs.lstatSync(lock).isSymbolicLink() || fs.readFileSync(lock,"utf8") !== token) {
          throw new Error("Settings write lock ownership changed");
        }
        fs.unlinkSync(lock);
      }
    });
    const tracked = operation.finally(() => { this.pending--; });
    this.tail = tracked.catch(() => {});
    return tracked;
  }
}

function readSettingsVersion(file: string): string | null {
  try {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Configuration must be a regular file");
    try { return JSON.stringify(JSON.parse(fs.readFileSync(file,"utf8"))); }
    catch { throw new Error("Cannot read valid AutoOC configuration"); }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function atomicSettingsWrite(file: string, data: unknown, io = fs.promises): Promise<void> {
  const text = JSON.stringify(data, null, 2);
  if (text === undefined) throw new Error("Settings are not serializable");
  const temp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  await io.mkdir(path.dirname(file), { recursive: true });
  let handle: Awaited<ReturnType<typeof io.open>> | undefined;
  try {
    handle = await io.open(temp, "wx", 0o600);
    await handle.writeFile(text, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    // Windows may briefly deny replacement while another reader has the file
    // open. Retry only the atomic rename, never the snapshot or workflow effect.
    const baseline = await io.readFile(file).catch(error => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    for (let attempt = 0; ; attempt++) {
      try { await io.rename(temp, file); break; }
      catch (error) {
        if (process.platform !== "win32" || !["EPERM", "EBUSY"].includes((error as NodeJS.ErrnoException).code || "") || attempt >= 4) throw error;
        await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
        const current = await io.readFile(file).catch(readError => {
          if (readError.code === "ENOENT") return null;
          throw readError;
        });
        if (baseline === null ? current !== null : current === null || !baseline.equals(current)) {
          throw new Error("AutoOC configuration changed during replacement; reload before saving");
        }
      }
    }
  } finally {
    if (handle) await handle.close().catch(() => {});
    // Only this write's own temporary file; never remove the previous settings.
    await io.unlink(temp).catch(() => {});
  }
}
