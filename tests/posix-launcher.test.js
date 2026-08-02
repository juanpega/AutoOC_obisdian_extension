// Cross-platform launcher tests: POSIX hidden launcher, shell quoting,
// Linux terminal fallback, and AppleScript escaping. Run on all platforms
// (several tests skip themselves on Windows).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const mainSource = fs.readFileSync(require.resolve("../main.js"), "utf8");

function extractFunction(name) {
  const start = mainSource.indexOf(`function ${name}(`);
  assert.ok(start !== -1, `function ${name} should exist in main.js`);
  const source = mainSource.slice(start, mainSource.indexOf("\nfunction ", start));
  return source;
}

const psSingleQuotedSource = mainSource.match(/function psSingleQuoted\([^)]*\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(psSingleQuotedSource, "psSingleQuoted should exist in main.js");
const shSingleQuotedSource = mainSource.match(/function shSingleQuoted\([^)]*\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(shSingleQuotedSource, "shSingleQuoted should exist in main.js");
const shSingleQuoted = new Function(`${shSingleQuotedSource}; return shSingleQuoted;`)();

test("buildPosixLaunchCommand shell-quotes cwd, env values, and args", () => {
  const source = extractFunction("buildPosixLaunchCommand");
  const build = new Function("shSingleQuoted", `${source}; return buildPosixLaunchCommand;`)(shSingleQuoted);

  const command = build("/usr/local/bin/opencode", "/Users/name/My Vault", { API_KEY: "a b$c" }, ["-m", "gpt"]);
  assert.equal(
    command,
    `cd '/Users/name/My Vault' && API_KEY='a b$c' '/usr/local/bin/opencode' '-m' 'gpt'`
  );
});

test("buildPosixLaunchCommand keeps apostrophes safe in cwd", () => {
  const source = extractFunction("buildPosixLaunchCommand");
  const build = new Function("shSingleQuoted", `${source}; return buildPosixLaunchCommand;`)(shSingleQuoted);

  const command = build("opencode", "/Users/o'brien/Vault", {}, []);
  assert.equal(command, `cd '/Users/o'\\''brien/Vault' && 'opencode'`);
});

test("appleScriptQuoted escapes only AppleScript string metacharacters", () => {
  const source = extractFunction("appleScriptQuoted");
  const appleScriptQuoted = new Function(`${source}; return appleScriptQuoted;`)();

  assert.equal(appleScriptQuoted(`cd '/Users/name/My Vault'`), `"cd '/Users/name/My Vault'"`);
  assert.equal(appleScriptQuoted(`cd 'a"b'`), `"cd 'a\\"b'"`);
  assert.equal(appleScriptQuoted(`cd 'a\\b'`), `"cd 'a\\\\b'"`);
});

test("launchHiddenSh spawns /bin/sh fully detached with ignored stdio", () => {
  const source = extractFunction("launchHiddenSh");
  const spawnCalls = [];
  const child = { pid: 4242, unref() {}, kill() {}, on() { return this; } };
  const launchHiddenSh = new Function("require", "process", `${source}; return launchHiddenSh;`)((request) => {
    if (request === "fs") {
      return {
        chmodSync() {},
        unlinkSync() {},
        existsSync() { return false; },
        readFileSync() { return Buffer.from(""); },
      };
    }
    if (request === "child_process") return { spawn(...args) { spawnCalls.push(args); return child; } };
    throw new Error(`Unexpected module: ${request}`);
  }, { kill() {} });
  const originalSetTimeout = global.setTimeout;
  global.setTimeout = () => ({ unref() {} });
  try {
    const handle = launchHiddenSh("/tmp/autooc-task.sh", "/tmp/autooc-task.pid");
    assert.equal(spawnCalls.length, 1);
    assert.equal(spawnCalls[0][0], "/bin/sh");
    assert.deepEqual(spawnCalls[0][1], ["/tmp/autooc-task.sh"]);
    assert.equal(spawnCalls[0][2].detached, true);
    assert.equal(spawnCalls[0][2].stdio, "ignore");
    handle.onError(() => {});
    handle.kill();
    handle.cleanup(true);
  } finally {
    global.setTimeout = originalSetTimeout;
  }
});

test("launchHiddenSh surfaces spawn errors through onError", () => {
  const source = extractFunction("launchHiddenSh");
  const child = {
    pid: 4242,
    unref() {},
    kill() {},
    on(event, callback) {
      if (event === "error") this.errorCallback = callback;
      return this;
    },
    emitError(error) { return this.errorCallback?.(error); },
  };
  const launchHiddenSh = new Function("require", "process", `${source}; return launchHiddenSh;`)((request) => {
    if (request === "fs") {
      return {
        chmodSync() {},
        unlinkSync() {},
        existsSync() { return false; },
        readFileSync() { return Buffer.from(""); },
      };
    }
    if (request === "child_process") return { spawn() { return child; } };
    throw new Error(`Unexpected module: ${request}`);
  }, { kill() {} });
  const originalSetTimeout = global.setTimeout;
  global.setTimeout = () => ({ unref() {} });
  try {
    const seen = [];
    const handle = launchHiddenSh("/tmp/autooc-task.sh", "/tmp/autooc-task.pid");
    handle.onError((error) => seen.push(error));
    child.emitError(new Error("/bin/sh unavailable"));
    assert.equal(seen.length, 1);
    assert.match(seen[0].message, /\/bin\/sh unavailable/);
  } finally {
    global.setTimeout = originalSetTimeout;
  }
});

test("resolveLinuxTerminal honors configured terminal, falls back through emulators", (t) => {
  if (process.platform === "win32") t.skip("Linux terminal detection is POSIX-only");

  const start = mainSource.indexOf("LINUX_TERMINAL_CANDIDATES");
  assert.ok(start !== -1, "LINUX_TERMINAL_CANDIDATES should exist in main.js");
  const source = mainSource.slice(start, mainSource.indexOf("\nfunction openOpencodeCli", start));
  const available = new Set(["konsole"]);
  const resolveLinuxTerminal = new Function("require", "shSingleQuoted", `${source}; return resolveLinuxTerminal;`)((request) => {
    if (request === "child_process") {
      return {
        execSync(cmd) {
          const match = String(cmd).match(/command -v '([^']+)'/);
          if (match && available.has(match[1])) return Buffer.from(match[1]);
          throw new Error("command not found");
        },
      };
    }
    throw new Error(`Unexpected module: ${request}`);
  }, shSingleQuoted);

  assert.equal(resolveLinuxTerminal().cmd, "konsole");
  assert.equal(resolveLinuxTerminal("konsole").cmd, "konsole");
  assert.equal(resolveLinuxTerminal("no-such-terminal"), null);
  available.clear();
  assert.equal(resolveLinuxTerminal(), null);
});
