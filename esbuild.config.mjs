import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import { readFileSync } from "node:fs";
import { writeReleaseIntegrity } from "./scripts/release-artifacts.mjs";

const prod = process.argv[2] === "production";
const terminalLicenses = ["@xterm/xterm", "@xterm/addon-fit"].map(name =>
  `/*! ${name}\n${readFileSync(new URL(`./node_modules/${name}/LICENSE`, import.meta.url), "utf8")}\n*/`).join("\n");

const context = await esbuild.context({
  entryPoints: ["main.ts"],
  bundle: true,
  loader: { ".css": "text" },
  banner: { js: terminalLicenses },
  external: [
    "node:*",
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
});

const cliContext = await esbuild.context({
  entryPoints: ["autooc-cli.ts"], bundle: true, platform: "node",
  format: "cjs", target: "node18", outfile: "autooc-cli.cjs",
  define: { AUTOOC_VERSION: JSON.stringify(JSON.parse(readFileSync(new URL("./manifest.json", import.meta.url), "utf8")).version) },
});

const runtimeContext = await esbuild.context({
  entryPoints: ["autooc-runtime.ts"], bundle: true, platform: "node",
  format: "cjs", target: "node18", outfile: "autooc-runtime.cjs",
  banner: { js: terminalLicenses },
  define: {
    AUTOOC_TERMINAL_JS: JSON.stringify(readFileSync(new URL("./node_modules/@xterm/xterm/lib/xterm.js", import.meta.url), "utf8")),
    AUTOOC_TERMINAL_FIT_JS: JSON.stringify(readFileSync(new URL("./node_modules/@xterm/addon-fit/lib/addon-fit.js", import.meta.url), "utf8")),
    AUTOOC_TERMINAL_CSS: JSON.stringify(readFileSync(new URL("./node_modules/@xterm/xterm/css/xterm.css", import.meta.url), "utf8")),
  },
});

if (prod) {
  await context.rebuild();
  await cliContext.rebuild();
  await runtimeContext.rebuild();
  writeReleaseIntegrity(process.cwd());
  process.exit(0);
} else {
  await context.watch();
  await cliContext.watch();
  await runtimeContext.watch();
}
