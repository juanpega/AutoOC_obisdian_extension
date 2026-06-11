// deploy.mjs — copia main.js, manifest.json y styles.css a .obsidian/plugins/auto-oc/
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

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

if (!fs.existsSync(dest)) {
  fs.mkdirSync(dest, { recursive: true });
  console.log("Creado directorio:", dest);
}

const files = ["main.js", "manifest.json", "styles.css"];
for (const f of files) {
  const src = path.join(__dirname, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(dest, f));
    console.log("Copiado:", f, "->", dest);
  } else {
    console.warn("No encontrado:", src);
  }
}

console.log("\nVault usado:", vaultRoot);
console.log("\nPlugin desplegado en:", dest);
console.log("\nUso:");
console.log("  node deploy.mjs \"C:/ruta/a/tu/vault\"");
console.log("  OBSIDIAN_VAULT_PATH=\"C:/ruta/a/tu/vault\" node deploy.mjs");
console.log("Recarga Obsidian con Ctrl+Shift+P > 'Reload app without saving'");
