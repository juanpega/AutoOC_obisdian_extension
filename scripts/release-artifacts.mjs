import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export const releaseArtifacts = Object.freeze([
  "main.js", "manifest.json", "styles.css",
  "autooc-cli.cjs", "autooc-runtime.cjs", "skills/autooc-runtime/SKILL.md",
  "release-integrity.json",
]);

export function writeReleaseIntegrity(root) {
  const version = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8")).version;
  const sha256 = Object.fromEntries(releaseArtifacts.filter(file => file !== "release-integrity.json").map(file =>
    [file, createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")]));
  fs.writeFileSync(path.join(root, "release-integrity.json"), JSON.stringify({ schemaVersion: 1, version, sha256 }, null, 2) + "\n");
}

export function validateReleaseArtifacts(root) {
  for (const file of releaseArtifacts) {
    const source=path.join(root,file);
    if (!fs.existsSync(source) || !fs.lstatSync(source).isFile()) {
      throw new Error(`Missing required release artifact: ${file} (run npm run build first)`);
    }
  }
  const descriptor = JSON.parse(fs.readFileSync(path.join(root, "release-integrity.json"), "utf8"));
  for (const file of releaseArtifacts.filter(file => file !== "release-integrity.json")) {
    if (createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex") !== descriptor.sha256?.[file]) {
      throw new Error(`Stale release artifact: ${file} (run npm run build first)`);
    }
  }
}

export function copyReleaseArtifacts(root,destination) {
  validateReleaseArtifacts(root);
  for (const file of releaseArtifacts) {
    const target=path.join(destination,file);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(path.join(root,file),target);
  }
}
