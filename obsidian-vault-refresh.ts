import * as fs from "fs";
import * as path from "path";
import type { VaultMutationBatch } from "./code-vault-mutations";

// Obsidian 1.13.7: verified against a real FileSystemAdapter. These are
// undocumented capabilities, deliberately isolated and checked at runtime.
interface ReconciliationAdapter {
  queue: (job: () => Promise<void>) => Promise<void>;
  reconcileInternalFile: (relativePath: string) => Promise<void>;
}

export class ObsidianVaultRefresh {
  private stopped = false;
  private pending = new Set<() => void>();

  constructor(private root: string, private adapter: unknown, private timeoutMs = 10_000) {}

  dispose(): void {
    this.stopped = true;
    for (const cancel of this.pending) cancel();
    this.pending.clear();
  }

  createBatch(): VaultMutationBatch {
    const paths = new Set<string>();
    return {
      record: mutation => { paths.add(mutation.path); },
      flush: async () => {
        if (!paths.size) return;
        const files = [...paths];
        paths.clear();
        try { await this.reconcile(files); }
        catch (error) {
          throw new Error(`Vault write persisted; Obsidian refresh not confirmed: ${String(error)}. Do not rerun Code to refresh.`);
        }
      },
    };
  }

  private relativeFile(file: string): string {
    const root = fs.realpathSync(this.root);
    const relative = path.relative(root, file);
    if (!path.isAbsolute(file) || !relative || relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
      throw new Error("Refresh path escapes vault");
    }
    let current = root;
    for (const part of relative.split(path.sep)) {
      current = path.join(current, part);
      if (fs.lstatSync(current).isSymbolicLink()) throw new Error("Linked refresh paths are unsupported");
    }
    return relative.split(path.sep).join("/");
  }

  private async reconcile(files: string[]): Promise<void> {
    if (this.stopped) throw new Error("Plugin unloaded");
    const adapter = this.adapter as Partial<ReconciliationAdapter> | undefined;
    if (typeof adapter?.queue !== "function" || typeof adapter.reconcileInternalFile !== "function") {
      throw new Error("Obsidian adapter reconciliation is unavailable");
    }
    let expired = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancel!: () => void;
    const stop = new Promise<never>((_, reject) => {
      cancel = () => { expired = true; reject(new Error("Plugin unloaded")); };
      this.pending.add(cancel);
      timer = setTimeout(() => { expired = true; reject(new Error("Refresh timed out")); }, this.timeoutMs);
    });
    const check = () => { if (expired || this.stopped) throw new Error("Refresh cancelled"); };
    // Use the adapter's own queue so watcher work and concurrent batches cannot
    // interleave reconciliations. File reconciliation also registers new parents.
    const work = Promise.resolve().then(async () => {
      let completed = false;
      let failed = false;
      let failure: unknown;
      const queued = adapter.queue!(async () => {
        try {
          for (const file of files) {
            check();
            const relative = this.relativeFile(file);
            // Hidden paths retain Obsidian's normal exclusion semantics.
            if (relative.split("/").some(part => part.startsWith("."))) continue;
            await adapter.reconcileInternalFile!(relative);
            check();
          }
          completed = true;
        } catch (error) { failed = true; failure = error; }
      });
      // Do not infer success from a queue that skips work or swallows failures.
      await queued;
      if (failed) throw failure;
      if (!completed) throw new Error("Adapter queue did not confirm reconciliation");
    });
    try { await Promise.race([work, stop]); }
    finally {
      expired = true;
      if (timer) clearTimeout(timer);
      this.pending.delete(cancel);
    }
  }
}
