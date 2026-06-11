// deploy.mjs — copia main.js, manifest.json y styles.css a .obsidian/plugins/auto-oc/
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Sube dos niveles: AutoOC_obisdian_extension -> vault root
const vaultRoot = path.resolve(__dirname, "..");
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

console.log("\nPlugin desplegado en:", dest);
console.log("Recarga Obsidian con Ctrl+Shift+P > 'Reload app without saving'");
