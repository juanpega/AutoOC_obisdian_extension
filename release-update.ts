import * as fs from "fs";
import * as path from "path";
import { createHash, randomUUID } from "crypto";
import type { ExecutionLease } from "./execution-lease";
import { assertIdleJournals } from "./execution-idle";

export const RELEASE_FILES = ["main.js", "manifest.json", "styles.css", "autooc-cli.cjs", "autooc-runtime.cjs", "skills/autooc-runtime/SKILL.md"] as const;
export const RELEASE_DESCRIPTOR = "release-integrity.json";

export function verifyRelease(files: Record<string, Buffer>, expectedVersion: string): void {
  const descriptor = JSON.parse(files[RELEASE_DESCRIPTOR]?.toString("utf8") || "null");
  if (descriptor?.schemaVersion !== 1 || descriptor.version !== expectedVersion ||
      !descriptor.sha256 || Object.keys(descriptor.sha256).sort().join() !== [...RELEASE_FILES].sort().join() ||
      Object.keys(files).sort().join() !== [...RELEASE_FILES, RELEASE_DESCRIPTOR].sort().join()) {
    throw new Error("Incomplete or incompatible AutoOC release");
  }
  for (const file of RELEASE_FILES) {
    if (!Buffer.isBuffer(files[file]) || createHash("sha256").update(files[file]).digest("hex") !== descriptor.sha256[file]) {
      throw new Error(`Release integrity mismatch: ${file}`);
    }
  }
  const manifest = JSON.parse(files["manifest.json"].toString("utf8"));
  if (manifest.id !== "auto-oc" || manifest.version !== expectedVersion) throw new Error("Release manifest identity mismatch");
}

// Download everything before writing. Hashes reject mixed revisions if main
// changes between requests; they do not replace trust in the configured origin.
export async function downloadRelease(baseUrl: string, version: string, fetcher: typeof fetch = fetch) {
  const entries = await Promise.all([...RELEASE_FILES, RELEASE_DESCRIPTOR].map(async file => {
    const response = await fetcher(`${baseUrl}/${file}?t=${Date.now()}`, { cache: "reload", signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`${file} HTTP ${response.status}`);
    return [file, Buffer.from(await response.arrayBuffer())] as const;
  }));
  const files = Object.fromEntries(entries);
  verifyRelease(files, version);
  return files;
}

function regularPath(root: string, relative: string, create = false): string {
  let current = root;
  const parts = relative.split("/");
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    let stat: fs.Stats | undefined;
    try { stat = fs.lstatSync(current); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    if (stat && (stat.isSymbolicLink() || (i < parts.length - 1 ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1))) {
      throw new Error(`Unsafe release destination: ${relative}`);
    }
    if (!stat && i < parts.length - 1 && create) fs.mkdirSync(current);
  }
  return current;
}

export function hasCompleteInstalledRelease(directory: string, version: string): boolean {
  try {
    const root = fs.realpathSync(directory);
    const files = Object.fromEntries([...RELEASE_FILES, RELEASE_DESCRIPTOR].map(name => [name, fs.readFileSync(regularPath(root, name))]));
    verifyRelease(files, version);
    return true;
  } catch { return false; }
}

// The caller owns the same lease as both execution hosts. A durable marker
// blocks restart after process death; artifacts only, never data.json/secrets.
export function installRelease(options: {
  directory: string; version: string; files: Record<string, Buffer>; lease: ExecutionLease;
}) {
  const { files, version, lease } = options;
  verifyRelease(files, version);
  const directory = fs.realpathSync(options.directory);
  if (fs.lstatSync(options.directory).isSymbolicLink() || path.join(directory, "runtime") !== lease.directory) throw new Error("Update lease belongs to another installation");
  lease.assertOwned();
  const marker = path.join(lease.directory, "update-pending.json");
  if (fs.existsSync(marker)) throw new Error("Previous update requires recovery");
  assertIdleJournals(lease.directory);
  const names = [...RELEASE_FILES, RELEASE_DESCRIPTOR];
  for (const name of names) regularPath(directory, name);
  const backup = path.join(lease.directory, `update-backup-${randomUUID()}`);
  fs.mkdirSync(backup);
  const previous = new Map<string, Buffer | undefined>();
  for (const name of names) {
    const source = regularPath(directory, name);
    const bytes = fs.existsSync(source) ? fs.readFileSync(source) : undefined;
    previous.set(name, bytes);
    if (bytes) {
      const target = path.join(backup, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, bytes, { flag: "wx" });
    }
  }
  const record = { schemaVersion: 1, version, backup: path.basename(backup), files: names, absent: names.filter(name => !previous.has(name) || previous.get(name) === undefined) };
  fs.writeFileSync(path.join(backup, "recovery.json"), JSON.stringify(record));
  const fd = fs.openSync(marker, "wx");
  try { fs.writeFileSync(fd, JSON.stringify(record)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const written: string[] = [];
  try {
    for (const name of names) {
      lease.assertOwned();
      const target = regularPath(directory, name, true);
      written.push(name);
      fs.writeFileSync(target, files[name]);
    }
    const installed = Object.fromEntries(names.map(name => [name, fs.readFileSync(regularPath(directory, name))]));
    verifyRelease(installed, version);
    fs.unlinkSync(marker);
    return { version, backup, installed: names };
  } catch (error) {
    // If rollback fails, retain the marker and backup; do not permit execution.
    for (const name of written.reverse()) {
      const target = regularPath(directory, name);
      const bytes = previous.get(name);
      if (bytes !== undefined) fs.writeFileSync(target, bytes);
      else if (fs.existsSync(target)) fs.unlinkSync(target);
    }
    fs.unlinkSync(marker);
    throw error;
  }
}
