import * as fs from "fs";
import * as path from "path";
import { physicalPath, isWithinPhysicalPath } from "./path-identity";

export interface InstalledWorkflowLocation {
  vault: string;
  installationDirectory: string;
  configurationFile: string;
  runtimeDirectory: string;
}

function regularDirectory(directory: string): void {
  const stat = fs.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Installation must use regular directories");
}

function optionalStat(file: string): fs.Stats | undefined {
  try { return fs.lstatSync(file); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
}

// Explicit selection only. Validate lexical components before normalization so
// a link/../directory cannot conceal traversal through an unchecked component.
// Reading a location never creates an installation, catalog or runtime.
export function resolveInstalledWorkflowLocation(vaultPath: string, installationDirectory?: string): InstalledWorkflowLocation {
  if (!path.isAbsolute(vaultPath)) throw new Error("Explicit absolute vault required");
  const vault = physicalPath(vaultPath);
  regularDirectory(vault);
  let relative = path.join(".obsidian", "plugins", "auto-oc");
  if (installationDirectory !== undefined) {
    if (typeof installationDirectory !== "string" || !installationDirectory || installationDirectory.includes("\0") ||
        installationDirectory.split(/[\\/]/).some(part => part === "." || part === "..")) {
      throw new Error("Invalid installation location");
    }
    if (process.platform === "win32" && path.isAbsolute(installationDirectory)) {
      // A short name can occur in any component. Inspect the supplied spelling
      // before native resolution, which would otherwise hide junctions.
      let inspected = path.parse(installationDirectory).root;
      for (const part of installationDirectory.slice(inspected.length).split(/[\\/]/)) {
        if (!part || part.includes(":")) throw new Error("Invalid installation component");
        inspected = path.join(inspected, part);
        regularDirectory(inspected);
      }
      relative = path.relative(vault, physicalPath(inspected));
    } else {
      relative = path.isAbsolute(installationDirectory)
        ? path.relative(path.resolve(vaultPath), installationDirectory) : installationDirectory;
    }
    if (!relative || path.isAbsolute(relative) || relative.split(/[\\/]/).some(part => part === ".." || part.includes(":"))) {
      throw new Error("Installation must remain inside the vault");
    }
  }
  let directory = vault;
  for (const part of relative.split(/[\\/]/)) {
    if (!part) throw new Error("Invalid installation component");
    directory = path.join(directory, part);
    regularDirectory(directory);
  }
  directory = physicalPath(directory);
  if (!isWithinPhysicalPath(vault, directory)) throw new Error("Installation must remain inside the vault");
  const configurationFile = path.join(directory, "data.json");
  const configStat = optionalStat(configurationFile);
  if (configStat && (configStat.isSymbolicLink() || !configStat.isFile())) throw new Error("Configuration must be a regular file");
  const runtimeDirectory = path.join(directory, "runtime");
  const runtimeStat = optionalStat(runtimeDirectory);
  if (runtimeStat && (runtimeStat.isSymbolicLink() || !runtimeStat.isDirectory())) throw new Error("Invalid runtime directory");
  return {vault, installationDirectory: directory, configurationFile, runtimeDirectory};
}

// Only execution startup calls this; recovery and queries remain read-only.
export function ensureInstalledWorkflowRuntime(location: InstalledWorkflowLocation): void {
  const current = resolveInstalledWorkflowLocation(location.vault, location.installationDirectory);
  if (current.runtimeDirectory !== location.runtimeDirectory) throw new Error("Installation location changed");
  try { fs.mkdirSync(current.runtimeDirectory); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  regularDirectory(current.runtimeDirectory);
}
