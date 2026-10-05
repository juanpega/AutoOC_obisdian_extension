const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const childProcess = require("node:child_process");
const test = require("node:test");
const ts = require("typescript");

const sourcePath = path.resolve(__dirname, "..", "copilot-client.ts");
const mod = new Module(sourcePath, module);
mod.filename = sourcePath;
mod.paths = Module._nodeModulePaths(path.dirname(sourcePath));
const originalRequire = mod.require.bind(mod);
let lastLaunch;
mod.require = (request) => request === "child_process" ? {
  ...childProcess,
  spawn(bin, args, options) {
    if (bin !== "fixture-copilot") return childProcess.spawn(bin, args, options);
    lastLaunch = { args, options };
    return childProcess.spawn(process.execPath, [path.join(__dirname, "fixtures", "copilot-cli.cjs"), ...args], options);
  },
} : originalRequire(request);
mod._compile(ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, sourcePath);
const { buildCopilotArgs, resolveCopilotBin, CopilotCliClient, checkCopilotInstallation } = mod.exports;

test("Copilot arguments keep untrusted prompt/model as literal arguments and restrict tools by default", () => {
  const prompt = 'Español "quoted"\n$(exit) & %PATH% `literal`';
  const args = buildCopilotArgs(prompt, { model: "model & literal" });
  assert.equal(args[1], prompt);
  assert.equal(args[args.indexOf("--model") + 1], "model & literal");
  assert.ok(args.includes("--available-tools"));
  assert.ok(args.includes("--allow-tool=read"));
  assert.ok(!args.includes("--allow-all-tools"));
  assert.ok(!buildCopilotArgs("test").includes("--model"));
  assert.throws(() => buildCopilotArgs("  "), /empty/);
  const allowed = buildCopilotArgs("test", { allowAllTools: true });
  assert.ok(allowed.includes("--allow-all-tools"));
  assert.ok(!allowed.includes("--allow-all-paths"));
  assert.ok(!allowed.includes("--allow-all-urls"));
});

test("Copilot process preserves quotes, newlines, cwd and environment without a shell", async () => {
  const client = new CopilotCliClient("fixture-copilot", os.tmpdir());
  const prompt = 'line one "quoted"\nline two & $(Get-Secret) 🤖';
  const result = await client.run(prompt, { env: { AUTOOC_TEST_VALUE: "fixture-value" } });
  assert.equal(result.exitCode, 0);
  const parsed = JSON.parse(result.output);
  assert.equal(parsed.prompt, prompt);
  assert.equal(fs.realpathSync(parsed.cwd), fs.realpathSync(os.tmpdir()));
  assert.equal(parsed.secret, "fixture-value");
  assert.equal(lastLaunch.options.shell, false);
  assert.equal(lastLaunch.options.windowsHide, true);
  client.dispose();
});

test("Copilot decodes UTF-8 correctly across chunk boundaries", async () => {
  const updates = [];
  const client = new CopilotCliClient("fixture-copilot", os.tmpdir(), (output) => updates.push(output));
  const result = await client.run("UNICODE");
  assert.equal(result.output, "Español 🤖");
  assert.ok(updates.length > 1);
  assert.ok(updates.every((output) => !output.includes("�")));
  client.dispose();
});

test("Copilot reports authentication and executable failures", async () => {
  const client = new CopilotCliClient("fixture-copilot", os.tmpdir());
  const result = await client.run("FAIL");
  assert.equal(result.exitCode, 1);
  assert.match(result.error, /copilot login/);
  client.dispose();
  const missing = new CopilotCliClient(path.join(os.tmpdir(), "missing-autooc-copilot-executable"), os.tmpdir());
  const failure = await missing.run("test");
  assert.equal(failure.exitCode, -1);
  assert.match(failure.error, /ENOENT/);
  missing.dispose();
});

test("Copilot timeout stops a running task and resolves with failure", async () => {
  const client = new CopilotCliClient("fixture-copilot", os.tmpdir());
  const result = await client.run("WAIT", { timeoutMs: 200 });
  assert.equal(result.exitCode, -1);
  assert.match(result.error, /timed out/);
  assert.doesNotMatch(result.output, /Too late/);
  client.dispose();
});

test("Copilot cancellation settles once and ignores subsequent output", async () => {
  let client;
  let updates = 0;
  client = new CopilotCliClient("fixture-copilot", os.tmpdir(), () => { updates++; client.dispose(); });
  const result = await client.run("WAIT");
  assert.equal(result.exitCode, -1);
  assert.match(result.error, /cancelled/);
  assert.equal(updates, 1);
  await assert.rejects(client.run("again"), /no longer available/);
});

test("Copilot long prompts use a private UTF-8 file and remove it after completion", async () => {
  const client = new CopilotCliClient("fixture-copilot", os.tmpdir());
  const prompt = 'Long "prompt" español 🤖\n'.repeat(1500);
  const result = await client.run(prompt);
  assert.equal(result.exitCode, 0);
  const parsed = JSON.parse(result.output);
  assert.equal(parsed.prompt, prompt);
  assert.ok(lastLaunch.args[1].length < 1000);
  assert.equal(fs.existsSync(parsed.file), false);
  assert.equal(fs.existsSync(path.dirname(parsed.file)), false);
  client.dispose();
});

test("Copilot diagnostic checks the executable without sending a prompt", async () => {
  assert.match(await checkCopilotInstallation("fixture-copilot", os.tmpdir()), /fixture 1.0/);
  assert.deepEqual(lastLaunch.args, ["--version"]);
});

test("Copilot resolver respects custom executables and resolves npm shims to native binaries", () => {
  assert.equal(resolveCopilotBin(" /custom/copilot "), "/custom/copilot");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "autooc-copilot-resolver-"));
  try {
    const exe = path.join(dir, "node_modules", "@github", "copilot", "node_modules", "@github", `copilot-${process.platform}-${process.arch}`, process.platform === "win32" ? "copilot.exe" : "copilot");
    fs.mkdirSync(path.dirname(exe), { recursive: true });
    fs.writeFileSync(exe, "fixture");
    assert.equal(resolveCopilotBin(path.join(dir, "copilot.cmd")), exe);
  } finally {
    assert.equal(path.dirname(dir), os.tmpdir());
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
