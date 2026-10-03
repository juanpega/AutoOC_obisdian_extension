// deploy.mjs — copia main.js, manifest.json y styles.css a .obsidian/plugins/auto-oc/
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { validateReleaseArtifacts } from "./scripts/release-artifacts.mjs";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const defaultVaultRoot = path.resolve(__dirname, "..");

async function resolveVaultRoot() {
  const cliVaultArg = process.argv[2]?.trim();
  const envVaultArg = process.env.OBSIDIAN_VAULT_PATH?.trim();

  if (cliVaultArg) return path.resolve(cliVaultArg);
  if (envVaultArg) return path.resolve(envVaultArg);

  const rl = readline.createInterface({ input, output });
  try {
    console.log("Ruta del vault no especificada.");
    console.log("Pulsa Enter para usar la ruta por defecto o pega otra ruta.");
    console.log("Ruta por defecto:", defaultVaultRoot);
    const answer = await rl.question("Vault de Obsidian: ");
    return answer.trim() ? path.resolve(answer.trim()) : defaultVaultRoot;
  } finally {
    rl.close();
  }
}

const vaultRoot = await resolveVaultRoot();

if (!fs.existsSync(vaultRoot)) {
  console.error("Error: la ruta del vault no existe:", vaultRoot);
  process.exit(1);
}

const dest = path.join(vaultRoot, ".obsidian", "plugins", "auto-oc");
validateReleaseArtifacts(__dirname);
if (fs.existsSync(path.join(dest,"runtime","execution.lock"))) {
  throw new Error("AutoOC has an execution reservation; resolve it before updating the plugin.");
}

let regular = fs.realpathSync(vaultRoot);
for (const part of [".obsidian", "plugins", "auto-oc", "runtime"]) {
  regular = path.join(regular, part);
  if (!fs.existsSync(regular)) fs.mkdirSync(regular);
  if (fs.lstatSync(regular).isSymbolicLink() || !fs.lstatSync(regular).isDirectory()) throw new Error("Linked installation directory is unsupported");
}
const { acquireExecutionLease, installRelease, RELEASE_FILES, RELEASE_DESCRIPTOR } = createRequire(import.meta.url)("./autooc-runtime.cjs");
const lease = acquireExecutionLease(regular);
try {
  const files = Object.fromEntries([...RELEASE_FILES, RELEASE_DESCRIPTOR].map(file => [file, fs.readFileSync(path.join(__dirname, file))]));
  const version = JSON.parse(files["manifest.json"].toString("utf8")).version;
  installRelease({ directory: path.dirname(regular), version, files, lease });
} finally { lease.release(); }

console.log("\nVault usado:", vaultRoot);
console.log("\nPlugin desplegado en:", dest);
console.log("\nUso:");
console.log("  node deploy.mjs \"C:/ruta/a/tu/vault\"");
console.log("  OBSIDIAN_VAULT_PATH=\"C:/ruta/a/tu/vault\" node deploy.mjs");
console.log("Recarga Obsidian con Ctrl+Shift+P > 'Reload app without saving'");
