import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import { readFileSync } from "node:fs";
import { writeReleaseIntegrity } from "./scripts/release-artifacts.mjs";

const prod = process.argv[2] === "production";

const context = await esbuild.context({
  entryPoints: ["main.ts"],
  bundle: true,
  external: [
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
