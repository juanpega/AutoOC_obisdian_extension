// package-release.mjs — cross-platform release packaging (Windows, macOS, Linux)
//
// Creates release/auto-oc-<version>.zip containing manifest.json (with the
// release version injected), main.js and styles.css.
//
// Usage:
//   node scripts/package-release.mjs              # version from package.json
//   node scripts/package-release.mjs --version 1.6.0
//
// The zip is produced with native tooling (zip on macOS/Linux,
// Compress-Archive on Windows) so no extra dependencies are required.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { copyReleaseArtifacts, validateReleaseArtifacts } from "./release-artifacts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = (argValue("--version") || "").trim() || process.env.npm_package_version || pkg.version;
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Invalid version: ${version}`);
  process.exit(1);
}

const outDir = argValue("--out") ? path.resolve(argValue("--out")) : path.join(root, "release");
validateReleaseArtifacts(root);
fs.mkdirSync(outDir, { recursive: true });

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const builtVersion=JSON.parse(execFileSync(process.execPath,[path.join(root,"autooc-cli.cjs"),"version"],{encoding:"utf8"})).version;
if (version !== manifest.version || version !== builtVersion || version !== pkg.version) {
  throw new Error("Release version must match package.json, manifest.json and the built CLI. Update versions and rebuild before packaging.");
}
manifest.version = version;

const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), "autooc-release-"));
const zipName = `auto-oc-${version}.zip`;
const zipPath = path.join(outDir, zipName);

try {
  copyReleaseArtifacts(root,buildDir);
  fs.writeFileSync(path.join(buildDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  if (process.platform === "win32") {
    execFileSync(
      "powershell.exe",
      ["-NoProfile", "-Command", `Compress-Archive -Path '${buildDir.replace(/'/g,"''")}\\*' -DestinationPath '${zipPath.replace(/'/g,"''")}' -Force`],
      { stdio: "inherit" },
    );
  } else {
    execFileSync("zip", ["-rq", zipPath, "."], { cwd: buildDir, stdio: "inherit" });
  }
} catch (error) {
  console.error(`Failed to create ${zipPath}: ${error.message}`);
  process.exit(1);
} finally {
  fs.rmSync(buildDir, { recursive: true, force: true });
}

console.log(`Created ${zipPath}`);
