var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// autooc-cli.ts
var fs33 = __toESM(require("fs"));
var path33 = __toESM(require("path"));

// execution-journal.ts
var fs4 = __toESM(require("fs"));
var path4 = __toESM(require("path"));
var import_crypto4 = require("crypto");

// path-identity.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
function physicalPath(location) {
  return process.platform === "win32" ? fs.realpathSync.native(location) : fs.realpathSync(location);
}
function samePhysicalPath(left, right) {
  return path.relative(physicalPath(left), physicalPath(right)) === "";
}
function isWithinPhysicalPath(root, location) {
  const relative7 = path.relative(physicalPath(root), physicalPath(location));
  return relative7 !== ".." && !relative7.startsWith(".." + path.sep) && !path.isAbsolute(relative7);
}

// execution-journal.ts
var import_util2 = require("util");

// settings-writer.ts
var fs3 = __toESM(require("fs"));
var path3 = __toESM(require("path"));
var import_crypto3 = require("crypto");
var import_string_decoder = require("string_decoder");
var import_perf_hooks3 = require("perf_hooks");
var import_timers2 = require("timers");
var import_child_process = require("child_process");

// execution-timing.ts
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));
var import_crypto = require("crypto");
var import_perf_hooks = require("perf_hooks");
var phases = ["queue", "settingsQueue", "settingsSave", "code", "provider", "evaluation"];
var idPattern = /^[a-zA-Z0-9-]{1,256}$/;
function safeFile(file) {
  try {
    const stat = fs2.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 524288) throw new Error("Unsafe timing file");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
function publish(context) {
  if (context.failed || !fs2.existsSync(context.runtime) || !context.value.requestId && !context.value.runId) return;
  context.value.updatedAt = Date.now();
  context.pending = JSON.stringify(context.value);
  if (context.writing) return;
  context.writing = true;
  context.tail = (async () => {
    while (context.pending !== void 0) {
      const bytes = context.pending;
      context.pending = void 0;
      const root = fs2.realpathSync(context.runtime), stat = fs2.lstatSync(context.runtime);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Unsafe timing directory");
      const directory2 = path2.join(root, "timings");
      try {
        fs2.mkdirSync(directory2, { mode: 448 });
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
      const directoryStat = fs2.lstatSync(directory2);
      if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink() || fs2.realpathSync(directory2) !== directory2) throw new Error("Unsafe timing directory");
      const file = path2.join(directory2, "timing-" + context.value.attemptId + ".json"), temp = file + "." + (0, import_crypto.randomUUID)() + ".tmp";
      safeFile(file);
      try {
        await fs2.promises.writeFile(temp, bytes, { flag: "wx", mode: 384 });
        safeFile(file);
        await fs2.promises.rename(temp, file);
      } finally {
        try {
          await fs2.promises.unlink(temp);
        } catch {
        }
      }
    }
  })().catch(() => {
    context.failed = true;
  }).finally(() => {
    context.writing = false;
    if (context.pending !== void 0 && !context.failed) publish(context);
  });
}
function startPhaseTiming(phase, stepId, context) {
  if (!context) return () => {
  };
  const metric = context.value.phases[phase] ||= { count: 0, totalMs: 0, maxMs: 0, active: 0 };
  let span;
  if (stepId && stepId.length <= 256) {
    if (context.value.spans.length < 256) {
      span = { phase, stepId, index: context.value.spans.length, startedAt: Date.now(), active: true };
      context.value.spans.push(span);
    } else context.value.droppedSpans++;
  }
  const started = import_perf_hooks.performance.now();
  let ended = false;
  metric.active++;
  publish(context);
  return () => {
    if (ended) return;
    ended = true;
    const elapsed = Math.max(0, import_perf_hooks.performance.now() - started);
    metric.active--;
    metric.count++;
    metric.totalMs += elapsed;
    metric.maxMs = Math.max(metric.maxMs, elapsed);
    if (span) {
      span.durationMs = elapsed;
      span.active = false;
    }
    publish(context);
  };
}
function bindTimingRun(runId, context) {
  if (!context) return;
  if (!idPattern.test(runId) || context.value.runId && context.value.runId !== runId) {
    context.failed = true;
    return;
  }
  context.value.runId = runId;
  publish(context);
}
async function withExecutionTiming(runtime, identity2, operation, existing) {
  runtime = fs2.existsSync(runtime) ? fs2.realpathSync(runtime) : path2.resolve(runtime);
  if (existing?.runtime === runtime) return operation(existing);
  const now = Date.now(), value = { schemaVersion: 1, attemptId: (0, import_crypto.randomUUID)(), requestId: identity2.requestId, runId: identity2.runId, startedAt: now, updatedAt: now, finished: false, phases: {}, spans: [], droppedSpans: 0 };
  if (identity2.queueMs !== void 0 && Number.isFinite(identity2.queueMs) && identity2.queueMs >= 0) value.phases.queue = { count: 1, totalMs: identity2.queueMs, maxMs: identity2.queueMs, active: 0 };
  const context = { runtime, value, tail: Promise.resolve(), failed: false, writing: false };
  publish(context);
  try {
    return await operation(context);
  } finally {
    value.finished = true;
    publish(context);
    while (context.writing || context.pending !== void 0 && !context.failed) await context.tail;
  }
}
function readExecutionTimings(runtime, selector) {
  if (!selector.requestId && !selector.runId) return [];
  if (!fs2.existsSync(runtime)) return [];
  if (!fs2.lstatSync(runtime).isDirectory() || fs2.lstatSync(runtime).isSymbolicLink()) throw new Error("Unsafe timing directory");
  const directory2 = path2.join(fs2.realpathSync(runtime), "timings");
  if (!fs2.existsSync(directory2)) return [];
  const stat = fs2.lstatSync(directory2);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs2.realpathSync(directory2) !== directory2) throw new Error("Unsafe timing directory");
  const result = [];
  for (const name of fs2.readdirSync(directory2)) {
    if (!/^timing-[a-f0-9-]{36}\.json$/.test(name)) continue;
    const file = path2.join(directory2, name);
    safeFile(file);
    let value;
    try {
      value = JSON.parse(fs2.readFileSync(file, "utf8"));
    } catch {
      continue;
    }
    if (value?.schemaVersion !== 1 || name !== "timing-" + value.attemptId + ".json" || typeof value.finished !== "boolean" || !Number.isFinite(value.startedAt) || !Number.isFinite(value.updatedAt) || value.requestId !== void 0 && !idPattern.test(value.requestId) || value.runId !== void 0 && !idPattern.test(value.runId)) continue;
    if (selector.requestId ? value.requestId !== selector.requestId : value.runId !== selector.runId) continue;
    const metrics = {};
    for (const phase of phases) {
      const metric = value.phases?.[phase];
      if (metric && [metric.count, metric.totalMs, metric.maxMs, metric.active].every((n) => Number.isFinite(n) && n >= 0)) metrics[phase] = { count: metric.count, totalMs: metric.totalMs, maxMs: metric.maxMs, active: metric.active };
    }
    const spans = Array.isArray(value.spans) ? value.spans.slice(0, 256).filter((s) => s && phases.includes(s.phase) && typeof s.stepId === "string" && s.stepId.length <= 256 && Number.isSafeInteger(s.index) && s.index >= 0 && Number.isFinite(s.startedAt) && typeof s.active === "boolean" && (s.durationMs === void 0 || Number.isFinite(s.durationMs) && s.durationMs >= 0)).map((s) => ({ phase: s.phase, stepId: s.stepId, index: s.index, startedAt: s.startedAt, active: s.active, ...s.durationMs === void 0 ? {} : { durationMs: s.durationMs } })) : [];
    result.push({ schemaVersion: 1, attemptId: value.attemptId, requestId: value.requestId, runId: value.runId, startedAt: value.startedAt, updatedAt: value.updatedAt, finished: value.finished, phases: metrics, spans, droppedSpans: Number.isSafeInteger(value.droppedSpans) && value.droppedSpans >= 0 ? value.droppedSpans : 0 });
  }
  return result.sort((a, b) => a.startedAt - b.startedAt);
}

// cooperative-json.ts
var import_crypto2 = require("crypto");
var import_timers = require("timers");
var import_perf_hooks2 = require("perf_hooks");
var import_util = require("util");
var CHUNK = 16 * 1024;
var invalid = () => new SyntaxError("Cannot read valid AutoOC configuration");
async function run(work) {
  let deadline = import_perf_hooks2.performance.now() + 4;
  for (; ; ) {
    const next = work.next();
    if (next.done) return next.value;
    if (import_perf_hooks2.performance.now() >= deadline) {
      await new Promise((resolve11) => (0, import_timers.setImmediate)(resolve11));
      deadline = import_perf_hooks2.performance.now() + 4;
    }
  }
}
async function parseCooperatively(text2) {
  let offset = 0, budget = CHUNK;
  const decoded = /* @__PURE__ */ new Map();
  let decodedSize = 0;
  const strings = /* @__PURE__ */ new Map();
  let stringsSize = 0;
  function decode(source) {
    const previous = decoded.get(source);
    if (previous !== void 0) return previous;
    const value2 = JSON.parse('"' + source + '"');
    const size = 2 * (source.length + value2.length);
    if (decodedSize + size <= 1024 * 1024 && decoded.size < 1024) {
      decoded.set(source, value2);
      decodedSize += size;
    }
    return value2;
  }
  function* step() {
    if (--budget <= 0) {
      budget = CHUNK;
      yield;
    }
  }
  function* whitespace() {
    while (offset < text2.length && /[\x20\t\r\n]/.test(text2[offset])) {
      offset++;
      yield* step();
    }
  }
  function* string() {
    if (text2[offset++] !== '"') throw invalid();
    const start = offset, boundaries = [];
    let chunkStart = start;
    while (offset < text2.length) {
      const char = text2.charCodeAt(offset++);
      if (char === 34) {
        const end = offset - 1, length = end - start;
        const encoded = length >= CHUNK && length <= 4 * 1024 * 1024 ? text2.slice(start, end) : void 0;
        const previous = encoded === void 0 ? void 0 : strings.get(encoded);
        if (previous !== void 0) return previous;
        const pieces = [];
        chunkStart = start;
        for (const boundary of boundaries) {
          pieces.push(decode(text2.slice(chunkStart, boundary)));
          chunkStart = boundary;
          yield;
        }
        pieces.push(decode(text2.slice(chunkStart, end)));
        const value2 = pieces.join("");
        const size = encoded === void 0 ? 0 : 2 * (encoded.length + value2.length);
        if (encoded !== void 0 && strings.size < 1024 && stringsSize + size <= 16 * 1024 * 1024) {
          strings.set(encoded, value2);
          stringsSize += size;
        }
        return value2;
      }
      if (char < 32) throw invalid();
      if (char === 92) {
        if (text2[offset] === "u") offset += 5;
        else offset++;
      }
      if (offset - chunkStart >= CHUNK) {
        boundaries.push(offset);
        chunkStart = offset;
        yield;
      }
    }
    throw invalid();
  }
  const stack = [];
  let root;
  function accept(item) {
    const parent = stack[stack.length - 1];
    if (!parent) {
      root = item;
      return;
    }
    if (parent.array) parent.result.push(item);
    else Object.defineProperty(parent.result, parent.key, { value: item, writable: true, enumerable: true, configurable: true });
    parent.state = "separator";
  }
  function* value() {
    yield* whitespace();
    const char = text2[offset];
    if (char === '"') {
      accept(yield* string());
      return;
    }
    if (char === "{" || char === "[") {
      const array = char === "[", result = array ? [] : {};
      accept(result);
      offset++;
      stack.push({ array, result, state: "first" });
      return;
    }
    const start = offset;
    while (offset < text2.length && !/[\x20\t\r\n,\]}]/.test(text2[offset])) {
      offset++;
      yield* step();
    }
    if (offset === start) throw invalid();
    accept(JSON.parse(text2.slice(start, offset)));
  }
  try {
    return await run(function* () {
      yield* value();
      while (stack.length) {
        yield* step();
        yield* whitespace();
        const frame = stack[stack.length - 1], end = frame.array ? "]" : "}";
        if (frame.state === "first" && text2[offset] === end) {
          offset++;
          stack.pop();
          continue;
        }
        if (frame.state === "separator") {
          const separator = text2[offset++];
          if (separator === end) {
            stack.pop();
            continue;
          }
          if (separator !== ",") throw invalid();
          frame.state = frame.array ? "value" : "key";
          continue;
        }
        if (!frame.array && (frame.state === "first" || frame.state === "key")) {
          frame.key = yield* string();
          yield* whitespace();
          if (text2[offset++] !== ":") throw invalid();
          frame.state = "value";
          continue;
        }
        yield* value();
      }
      yield* whitespace();
      if (offset !== text2.length) throw invalid();
      return root;
    }());
  } catch {
    throw invalid();
  }
}
function captureJsonStructure(value, space = 2) {
  const strings = [];
  const skeleton = JSON.stringify(value, (_key, item) => {
    if (import_util.types.isStringObject(item)) item = String(item);
    if (typeof item !== "string") return item;
    const index = strings.push(item) - 1;
    return `@autooc-string-${index}`;
  }, space);
  if (skeleton === void 0) throw new Error("Settings are not serializable");
  return { skeleton, strings };
}
function cloneJsonStructure(value) {
  return cloneCapturedJson(captureJsonStructure(value));
}
function cloneCapturedJson({ skeleton, strings }) {
  return JSON.parse(skeleton, (_key, item) => typeof item === "string" && /^@autooc-string-\d+$/.test(item) ? strings[Number(item.slice(15))] : item);
}
function encodeCapturedJson({ skeleton, strings }) {
  return function* () {
    const markers = /"@autooc-string-(\d+)"(?!\s*:)/g;
    let previous = 0, match;
    while (match = markers.exec(skeleton)) {
      yield skeleton.slice(previous, match.index);
      yield '"';
      const source = strings[Number(match[1])];
      for (let start = 0; start < source.length; ) {
        let end = Math.min(start + CHUNK, source.length);
        if (end < source.length && source.charCodeAt(end - 1) >= 55296 && source.charCodeAt(end - 1) <= 56319 && source.charCodeAt(end) >= 56320 && source.charCodeAt(end) <= 57343) end--;
        yield JSON.stringify(source.slice(start, end)).slice(1, -1);
        start = end;
      }
      yield '"';
      previous = markers.lastIndex;
    }
    yield skeleton.slice(previous);
  }();
}
async function consume(parts, accept) {
  await run(function* () {
    for (const part of parts) {
      accept(part);
      yield;
    }
  }());
}
async function hashJsonCooperatively(value) {
  const source = encodeCapturedJson(captureJsonStructure(value)), hash3 = (0, import_crypto2.createHash)("sha256");
  await consume(source, (part) => {
    hash3.update(part, "utf8");
  });
  return hash3.digest("hex");
}
async function hashTextCooperatively(text2) {
  const hash3 = (0, import_crypto2.createHash)("sha256");
  await consume(function* () {
    for (let start = 0; start < text2.length; ) {
      let end = Math.min(start + CHUNK, text2.length);
      if (end < text2.length && text2.charCodeAt(end - 1) >= 55296 && text2.charCodeAt(end - 1) <= 56319 && text2.charCodeAt(end) >= 56320 && text2.charCodeAt(end) <= 57343) end--;
      yield text2.slice(start, end);
      start = end;
    }
  }(), (part) => {
    hash3.update(part, "utf8");
  });
  return hash3.digest("hex");
}

// settings-writer.ts
var uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
async function settingsProcessStart(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return null;
  try {
    if (process.platform === "linux") {
      const text2 = await fs3.promises.readFile(`/proc/${pid}/stat`, "utf8");
      const ticks = text2.slice(text2.lastIndexOf(")") + 2).split(" ")[19];
      const boot = (await fs3.promises.readFile("/proc/sys/kernel/random/boot_id", "utf8")).trim();
      return /^\d+$/.test(ticks) ? `linux:${boot}:${ticks}` : null;
    }
    const systemRoot = process.env.SystemRoot || "C:\\Windows";
    if (process.platform === "win32" && !path3.isAbsolute(systemRoot)) return null;
    const executable2 = process.platform === "win32" ? path3.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe") : "/bin/ps";
    const args = process.platform === "win32" ? ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToUniversalTime().Ticks.ToString()`] : ["-p", String(pid), "-o", "lstart="];
    if (process.platform !== "win32" && process.platform !== "darwin") return null;
    const value = await new Promise((resolve11, reject) => (0, import_child_process.execFile)(
      executable2,
      args,
      { windowsHide: true, timeout: 5e3, maxBuffer: 4096 },
      (error, stdout) => error ? reject(error) : resolve11(stdout.trim())
    ));
    if (process.platform === "win32") return /^\d{15,20}$/.test(value) ? `windows:${value}` : null;
    return /^[A-Za-z]{3} [A-Za-z]{3}\s+\d{1,2} \d{2}:\d{2}:\d{2} \d{4}$/.test(value) ? `darwin:${value}` : null;
  } catch {
    return null;
  }
}
var processStartKey = Symbol.for("autooc.settings.process-start.v1");
function ownProcessStart() {
  const host = process;
  return host[processStartKey] ||= settingsProcessStart(process.pid);
}
function parseSettingsWriteLock(text2) {
  if (uuid.test(text2)) return { token: text2, legacy: true };
  let value;
  try {
    value = JSON.parse(text2);
  } catch {
    throw new Error("Incomplete settings write lock identity");
  }
  if (value?.schemaVersion !== 1 || !uuid.test(value.token) || !uuid.test(value.transactionId) || !Number.isSafeInteger(value.pid) || value.pid <= 0 || typeof value.directoryIdentity !== "string" || !/^[0-9]+:[0-9]+:[0-9.]+$/.test(value.directoryIdentity) || !(value.processStart === null || typeof value.processStart === "string" && /^(?:linux:[a-f0-9-]{36}:\d+|windows:\d{15,20}|darwin:[A-Za-z]{3} [A-Za-z]{3}\s+\d{1,2} \d{2}:\d{2}:\d{2} \d{4})$/.test(value.processStart))) {
    throw new Error("Incomplete settings write lock identity");
  }
  return {
    schemaVersion: 1,
    token: value.token,
    transactionId: value.transactionId,
    pid: value.pid,
    processStart: value.processStart,
    directoryIdentity: value.directoryIdentity
  };
}
function settingsWriteLockToken(file) {
  const stat = fs3.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 16384) throw new Error("Unsafe settings write lock");
  return parseSettingsWriteLock(fs3.readFileSync(file, "utf8")).token;
}
function assertNoSettingsRecovery(directory2) {
  try {
    fs3.lstatSync(path3.join(directory2, "runtime", "lease-recovery.lock"));
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  throw new Error("Settings recovery guard requires reconciliation");
}
function settingsDirectoryIdentity(directory2) {
  const stat = fs3.lstatSync(directory2);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Unsafe settings directory");
  return `${stat.dev}:${stat.ino}:${stat.birthtimeMs}`;
}
function regularIntentText(file) {
  const stat = fs3.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 16384) throw new Error("Unsafe settings write intent");
  return fs3.readFileSync(file, "utf8");
}
async function beginSettingsWriteIntent(file, token, originalHash) {
  if (path3.basename(file) !== "data.json") return;
  const directory2 = path3.dirname(file), runtime = path3.join(directory2, "runtime"), ownerFile = path3.join(runtime, "execution.lock", "owner.json");
  let ownerText;
  try {
    ownerText = regularIntentText(ownerFile);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  const owner = JSON.parse(ownerText);
  const ownerDirectoryIdentity = settingsDirectoryIdentity(path3.dirname(ownerFile));
  let ownerStat = fs3.lstatSync(ownerFile);
  if (owner?.schemaVersion !== 1 || owner.pid !== process.pid || !/^[a-f0-9-]{36}$/.test(owner.token || "") || !Number.isFinite(Date.parse(owner.createdAt))) throw new Error("Settings writer does not own the execution lease");
  const leaseOwner = { schemaVersion: 1, token: owner.token, pid: owner.pid, createdAt: owner.createdAt };
  const intent = { schemaVersion: 1, token, directoryIdentity: settingsDirectoryIdentity(directory2), runtimeIdentity: settingsDirectoryIdentity(runtime), owner: leaseOwner, originalHash };
  const intentFile = file + ".write-intent", updateFile = intentFile + "." + token + ".tmp";
  let published;
  const assertOwned = () => {
    const currentOwnerStat = fs3.lstatSync(ownerFile);
    if (currentOwnerStat.dev !== ownerStat.dev || currentOwnerStat.ino !== ownerStat.ino || currentOwnerStat.size !== ownerStat.size || currentOwnerStat.mtimeMs !== ownerStat.mtimeMs || currentOwnerStat.ctimeMs !== ownerStat.ctimeMs || settingsDirectoryIdentity(path3.dirname(ownerFile)) !== ownerDirectoryIdentity || regularIntentText(ownerFile) !== ownerText || settingsWriteLockToken(file + ".write-lock") !== token || settingsDirectoryIdentity(directory2) !== intent.directoryIdentity || settingsDirectoryIdentity(runtime) !== intent.runtimeIdentity) throw new Error("Settings intent ownership changed");
    if (published !== void 0 && regularIntentText(intentFile) !== published) throw new Error("Settings write intent changed");
  };
  const replaceMetadata = async (from, to) => {
    for (let attempt = 0; ; attempt++) {
      assertOwned();
      try {
        await fs3.promises.rename(from, to);
        return;
      } catch (error) {
        if (process.platform !== "win32" || !["EPERM", "EBUSY", "EACCES"].includes(error.code || "") || attempt >= 4) throw error;
        await new Promise((resolve11) => setTimeout(resolve11, 50 * (attempt + 1)));
      }
    }
  };
  const publishOwnerAnchor = async (hash3) => {
    assertOwned();
    const next = JSON.parse(ownerText);
    if (hash3) next.settingsWriteIntent = { token, sha256: hash3 };
    else delete next.settingsWriteIntent;
    const nextText = JSON.stringify(next), temporary = path3.join(path3.dirname(ownerFile), "owner.settings-intent." + token + ".tmp");
    const handle = await fs3.promises.open(temporary, "wx", 384);
    try {
      await handle.writeFile(nextText, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    assertOwned();
    await replaceMetadata(temporary, ownerFile);
    ownerText = nextText;
    ownerStat = fs3.lstatSync(ownerFile);
  };
  const publish2 = async (initial = false) => {
    assertOwned();
    const text2 = JSON.stringify(intent), target = initial ? intentFile : updateFile;
    const handle = await fs3.promises.open(target, "wx", 384);
    try {
      await handle.writeFile(text2, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    assertOwned();
    if (!initial) await replaceMetadata(updateFile, intentFile);
    published = text2;
    await publishOwnerAnchor((0, import_crypto3.createHash)("sha256").update(text2, "utf8").digest("hex"));
  };
  await publish2(true);
  return {
    async prepared(temporary, preparedHash) {
      intent.temporary = path3.basename(temporary);
      if (preparedHash) intent.preparedHash = preparedHash;
      await publish2();
    },
    async finish() {
      assertOwned();
      const current = await settingsFingerprint(file);
      if (current !== intent.originalHash && current !== intent.preparedHash || fs3.existsSync(updateFile) || intent.temporary && fs3.existsSync(path3.join(directory2, intent.temporary))) throw new Error("Settings write evidence retained for recovery");
      assertOwned();
      await publishOwnerAnchor();
      await fs3.promises.unlink(intentFile);
    }
  };
}
var SettingsWriter = class _SettingsWriter {
  constructor() {
    this.tail = Promise.resolve();
    this.observed = /* @__PURE__ */ new Map();
    this.cached = /* @__PURE__ */ new Map();
    this.pending = 0;
    this.transactions = /* @__PURE__ */ new Set();
  }
  // Register host transactions synchronously, before their queued I/O begins.
  // Updates/unload must see these saves even while another session publishes.
  trackTransaction(operation) {
    this.transactions.add(operation);
    void operation.then(() => this.transactions.delete(operation), () => this.transactions.delete(operation));
    return operation;
  }
  async drain() {
    while (this.transactions.size) await Promise.all([...this.transactions]);
    await this.tail;
    if (this.writeFailure) throw this.writeFailure;
  }
  get hasPendingWrites() {
    return this.pending > 0 || this.transactions.size > 0;
  }
  fork() {
    const fork = new _SettingsWriter();
    for (const [file, version2] of this.observed) fork.observed.set(file, { ...version2 });
    for (const [file, value] of this.cached) fork.cached.set(file, cloneJsonStructure(value));
    return fork;
  }
  confirmedVersion(file) {
    const version2 = this.observed.get(path3.resolve(file));
    if (!version2) throw new Error("Catalog has no confirmed version");
    return { ...version2 };
  }
  adoptConfirmed(file, version2, accept) {
    this.pending++;
    const operation = this.tail.then(async () => {
      if (!version2.textHash || !/^[a-f0-9]{64}$/.test(version2.textHash) || version2.valueHash !== version2.textHash || await settingsFingerprint(file) !== version2.textHash) {
        throw new Error("AutoOC confirmed catalog changed externally; reload before saving");
      }
      if (!accept()) throw new Error("AutoOC settings changed while loading; reload before saving");
      this.observed.set(path3.resolve(file), { ...version2 });
      this.cached.delete(path3.resolve(file));
    });
    const tracked = operation.finally(() => {
      this.pending--;
    });
    this.tail = tracked.then(() => {
    }, () => {
    });
    return tracked;
  }
  async assertUnchanged(file) {
    const observed = this.observed.get(path3.resolve(file));
    if (!observed || await settingsFingerprint(file) !== observed.textHash) {
      throw new Error("AutoOC configuration changed during preflight; reload before execution");
    }
  }
  // Read exactly the version against which subsequent writes are compared.
  // A missing file is distinct from an existing empty/null configuration.
  load(file) {
    const text2 = readSettingsText(file);
    const value = parseSettings(text2);
    const hash3 = (source) => (0, import_crypto3.createHash)("sha256").update(source, "utf8").digest("hex");
    this.observed.set(path3.resolve(file), {
      textHash: text2 === null ? null : hash3(text2),
      valueHash: text2 === null ? null : hash3(JSON.stringify(value, null, 2))
    });
    this.cached.set(path3.resolve(file), cloneJsonStructure(value));
    return value;
  }
  // Share the write queue: a late load cannot change the baseline of an
  // in-flight save. The caller may reject publication after a local edit.
  loadAsync(file, accept = () => true) {
    this.pending++;
    const operation = this.tail.then(async () => {
      file = path3.resolve(file);
      const observed = this.observed.get(file);
      if (observed && this.cached.has(file) && await settingsFingerprint(file) === observed.textHash) {
        if (!accept()) throw new Error("AutoOC settings changed while loading; reload before saving");
        return cloneJsonStructure(this.cached.get(file));
      }
      let text2 = await readSettingsTextAsync(file);
      const value = text2 === null ? null : await parseCooperatively(text2);
      const missing = text2 === null, textHash = missing ? null : await hashTextCooperatively(text2);
      text2 = null;
      const version2 = { textHash, valueHash: missing ? null : await hashJsonCooperatively(value) };
      if (!accept()) throw new Error("AutoOC settings changed while loading; reload before saving");
      this.observed.set(file, version2);
      this.cached.set(file, cloneJsonStructure(value));
      return value;
    });
    const tracked = operation.finally(() => {
      this.pending--;
    });
    this.tail = tracked.then(() => {
    }, () => {
    });
    return tracked;
  }
  save(file, snapshot, validate, timing) {
    const queued = startPhaseTiming("settingsQueue", void 0, timing);
    let saved;
    this.pending++;
    const operation = this.tail.then(async () => {
      queued();
      saved = startPhaseTiming("settingsSave", void 0, timing);
      file = path3.resolve(file);
      await fs3.promises.mkdir(path3.dirname(file), { recursive: true });
      assertNoSettingsRecovery(path3.dirname(file));
      const processStart = await ownProcessStart();
      assertNoSettingsRecovery(path3.dirname(file));
      const lock = file + ".write-lock";
      const token = (0, import_crypto3.randomUUID)();
      const lockText = JSON.stringify({
        schemaVersion: 1,
        token,
        transactionId: (0, import_crypto3.randomUUID)(),
        pid: process.pid,
        processStart,
        directoryIdentity: settingsDirectoryIdentity(path3.dirname(file))
      });
      const descriptor = fs3.openSync(lock, "wx", 384);
      let lockStat;
      let intent;
      try {
        lockStat = fs3.fstatSync(descriptor);
        fs3.writeFileSync(descriptor, lockText);
        await new Promise((resolve11, reject) => fs3.fsync(descriptor, (error) => error ? reject(error) : resolve11()));
      } finally {
        fs3.closeSync(descriptor);
      }
      try {
        assertNoSettingsRecovery(path3.dirname(file));
        const observed = this.observed.get(file), currentHash = await settingsFingerprint(file);
        if (!observed || observed.textHash !== currentHash) {
          const current = await readSettingsTextAsync(file);
          const currentValue = current === null ? null : await parseCooperatively(current);
          if (observed && (observed.textHash === null || current === null || observed.valueHash !== await hashJsonCooperatively(currentValue))) {
            throw new Error("AutoOC configuration changed externally; reload before saving");
          }
        }
        validate?.();
        intent = await beginSettingsWriteIntent(file, token, currentHash);
        const captured = captureJsonStructure(snapshot());
        if (fs3.lstatSync(lock).isSymbolicLink() || fs3.readFileSync(lock, "utf8") !== lockText) {
          throw new Error("Settings write lock ownership changed");
        }
        if (await settingsFingerprint(file) !== currentHash) {
          throw new Error("AutoOC configuration changed during preparation; reload before saving");
        }
        const nextHash = await atomicSettingsTextWrite(file, encodeCapturedJson(captured), fs3.promises, async () => {
          validate?.();
          if (await settingsFingerprint(file) !== currentHash) {
            throw new Error("AutoOC configuration changed during replacement; reload before saving");
          }
          assertNoSettingsRecovery(path3.dirname(file));
          if (fs3.lstatSync(lock).isSymbolicLink() || fs3.readFileSync(lock, "utf8") !== lockText) {
            throw new Error("Settings write lock ownership changed");
          }
          validate?.();
        }, intent?.prepared);
        this.observed.set(file, { textHash: nextHash, valueHash: nextHash });
        this.cached.set(file, cloneCapturedJson(captured));
      } finally {
        try {
          await intent?.finish();
        } finally {
          const currentLock = fs3.lstatSync(lock);
          if (currentLock.isSymbolicLink() || currentLock.dev !== lockStat.dev || currentLock.ino !== lockStat.ino || currentLock.birthtimeMs !== lockStat.birthtimeMs || fs3.readFileSync(lock, "utf8") !== lockText) {
            throw new Error("Settings write lock ownership changed");
          }
          fs3.unlinkSync(lock);
        }
      }
    });
    const tracked = operation.finally(() => {
      this.pending--;
    });
    void tracked.then(() => saved?.(), () => saved?.());
    this.tail = tracked.catch((error) => {
      this.writeFailure = error;
    });
    return tracked;
  }
};
function ioBudget() {
  let started = import_perf_hooks3.performance.now();
  return () => {
    if (import_perf_hooks3.performance.now() - started < 4) return;
    return new Promise((resolve11) => (0, import_timers2.setImmediate)(() => {
      started = import_perf_hooks3.performance.now();
      resolve11();
    }));
  };
}
function sameSettingsFile(before, after) {
  return after.isFile() && before.dev === after.dev && before.ino === after.ino && before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs;
}
async function settingsFingerprint(file) {
  let handle;
  let inspected = false;
  try {
    const stat = await fs3.promises.lstat(file);
    inspected = true;
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Configuration must be a regular file");
    handle = await fs3.promises.open(file, "r");
    const opened = await handle.stat();
    if (!sameSettingsFile(stat, opened)) throw new Error("Configuration identity changed while reading");
    const buffer = Buffer.allocUnsafe(256 * 1024), hash3 = (0, import_crypto3.createHash)("sha256"), budget = ioBudget();
    let total = 0;
    for (; ; ) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (!bytesRead) {
        const after = await handle.stat();
        const current = await fs3.promises.lstat(file);
        if (total !== opened.size || !sameSettingsFile(opened, after) || current.isSymbolicLink() || !sameSettingsFile(opened, current)) throw new Error("Configuration changed while reading");
        return hash3.digest("hex");
      }
      total += bytesRead;
      if (total > opened.size) throw new Error("Configuration changed while reading");
      hash3.update(buffer.subarray(0, bytesRead));
      const pause = budget();
      if (pause) await pause;
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      if (!inspected) return null;
      throw new Error("Configuration changed while reading");
    }
    throw error;
  } finally {
    await handle?.close();
  }
}
async function readSettingsTextAsync(file) {
  let inspected = false;
  try {
    const stat = await fs3.promises.lstat(file);
    inspected = true;
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Configuration must be a regular file");
    const handle = await fs3.promises.open(file, "r");
    try {
      const opened = await handle.stat();
      if (!sameSettingsFile(stat, opened)) throw new Error("Configuration identity changed while reading");
      let bytes = Buffer.allocUnsafe(opened.size);
      const budget = ioBudget();
      for (let offset = 0; offset < bytes.length; ) {
        const { bytesRead } = await handle.read(bytes, offset, Math.min(256 * 1024, bytes.length - offset), null);
        if (!bytesRead) throw new Error("Configuration changed while reading");
        offset += bytesRead;
        const pause = budget();
        if (pause) await pause;
      }
      const after = await handle.stat();
      const afterRead = await fs3.promises.lstat(file);
      if (!sameSettingsFile(opened, after) || afterRead.isSymbolicLink() || !sameSettingsFile(opened, afterRead)) throw new Error("Configuration changed while reading");
      if (bytes.length <= 256 * 1024) return bytes.toString("utf8");
      const isAscii = require("buffer").isAscii;
      let ascii = true;
      for (let offset = 0; offset < bytes.length; offset += 256 * 1024) {
        const slice = bytes.subarray(offset, offset + 256 * 1024);
        if (isAscii ? !isAscii(slice) : slice.some((byte) => byte > 127)) {
          ascii = false;
          break;
        }
        await new Promise((resolve11) => (0, import_timers2.setImmediate)(resolve11));
      }
      if (ascii) {
        const final2 = await handle.stat();
        const current2 = await fs3.promises.lstat(file);
        if (!sameSettingsFile(opened, final2) || current2.isSymbolicLink() || !sameSettingsFile(opened, current2)) throw new Error("Configuration changed while reading");
        return bytes.toString("utf8");
      }
      const decoder = new import_string_decoder.StringDecoder("utf8"), parts = [];
      for (let offset = 0; offset < bytes.length; offset += 256 * 1024) {
        parts.push(decoder.write(bytes.subarray(offset, offset + 256 * 1024)));
        await new Promise((resolve11) => (0, import_timers2.setImmediate)(resolve11));
      }
      parts.push(decoder.end());
      bytes = void 0;
      const final = await handle.stat();
      const current = await fs3.promises.lstat(file);
      if (!sameSettingsFile(opened, final) || current.isSymbolicLink() || !sameSettingsFile(opened, current)) throw new Error("Configuration changed while reading");
      return parts.join("");
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      if (!inspected) return null;
      throw new Error("Configuration changed while reading");
    }
    throw error;
  }
}
function readSettingsText(file) {
  try {
    const stat = fs3.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Configuration must be a regular file");
    try {
      return fs3.readFileSync(file, "utf8");
    } catch {
      throw new Error("Cannot read valid AutoOC configuration");
    }
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
function parseSettings(text2) {
  if (text2 === null) return null;
  try {
    return JSON.parse(text2);
  } catch {
    throw new Error("Cannot read valid AutoOC configuration");
  }
}
async function atomicSettingsWrite(file, data, io = fs3.promises, beforeReplace, timing) {
  const finished = startPhaseTiming("settingsSave", void 0, timing);
  try {
    const text2 = JSON.stringify(data, null, 2);
    if (text2 === void 0) throw new Error("Settings are not serializable");
    await atomicSettingsTextWrite(file, text2, io, beforeReplace);
  } finally {
    finished();
  }
}
async function atomicSettingsTextWrite(file, text2, io = fs3.promises, beforeReplace, prepared) {
  const temp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  await io.mkdir(path3.dirname(file), { recursive: true });
  let handle;
  const hash3 = (0, import_crypto3.createHash)("sha256");
  try {
    await prepared?.(temp);
    handle = await io.open(temp, "wx", 384);
    const parts = typeof text2 === "string" ? [text2] : text2;
    let batch = [], size = 0;
    const flush = async () => {
      const part = batch.join("");
      batch = [];
      size = 0;
      hash3.update(part, "utf8");
      await handle.writeFile(part, "utf8");
    };
    for (const part of parts) for (let start = 0; start < part.length; ) {
      let end = Math.min(start + 64 * 1024, part.length);
      if (end < part.length && part.charCodeAt(end - 1) >= 55296 && part.charCodeAt(end - 1) <= 56319 && part.charCodeAt(end) >= 56320 && part.charCodeAt(end) <= 57343) end--;
      const chunk = part.slice(start, end);
      batch.push(chunk);
      size += chunk.length;
      start = end;
      if (size >= 64 * 1024) await flush();
    }
    if (size) await flush();
    await handle.sync();
    await handle.close();
    handle = void 0;
    await prepared?.(temp, hash3.copy().digest("hex"));
    const baseline = beforeReplace ? void 0 : await io.readFile(file).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    for (let attempt = 0; ; attempt++) {
      await beforeReplace?.();
      try {
        await io.rename(temp, file);
        break;
      } catch (error) {
        if (process.platform !== "win32" || !["EPERM", "EBUSY"].includes(error.code || "") || attempt >= 4) throw error;
        await new Promise((resolve11) => setTimeout(resolve11, 50 * (attempt + 1)));
        if (beforeReplace) continue;
        const current = await io.readFile(file).catch((readError) => {
          if (readError.code === "ENOENT") return null;
          throw readError;
        });
        if (baseline == null ? current !== null : current === null || !baseline.equals(current)) {
          throw new Error("AutoOC configuration changed during replacement; reload before saving");
        }
      }
    }
    return hash3.digest("hex");
  } finally {
    if (handle) await handle.close().catch(() => {
    });
    await io.unlink(temp).catch(() => {
    });
  }
}

// execution-journal.ts
var writes = /* @__PURE__ */ new Map();
function checkpointUncertainties(state) {
  return state.steps.flatMap((step, index) => [
    ...step.status === "in_flight" ? [`${index}:in_flight`] : [],
    ...step.approval ? [`${index}:approval`] : [],
    ...step.result?.cancelled ? [`${index}:cancelled`] : [],
    ...(step.evaluations || []).filter((e) => e.status !== "completed").map((e) => `${index}:evaluation:${e.key}`)
  ]);
}
function directoryIdentity(directory2) {
  const stat = fs4.lstatSync(directory2);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Unsafe disposition directory");
  return `${stat.dev}:${stat.ino}:${stat.birthtimeMs}`;
}
function dispositionLocation(location) {
  const vault = physicalPath(location.vault), installationDirectory = physicalPath(location.installationDirectory), runtimeDirectory = physicalPath(location.runtimeDirectory);
  if (path4.relative(installationDirectory, runtimeDirectory) !== "runtime" || path4.relative(vault, installationDirectory).split(path4.sep).includes("..")) throw new Error("Disposition location mismatch");
  let current = vault;
  for (const part of path4.relative(vault, runtimeDirectory).split(path4.sep)) {
    current = path4.join(current, part);
    directoryIdentity(current);
  }
  return { vault, installationDirectory, runtimeDirectory, vaultIdentity: directoryIdentity(vault), installationIdentity: directoryIdentity(installationDirectory), runtimeIdentity: directoryIdentity(runtimeDirectory) };
}
function validateExecutionCheckpoint(value) {
  const validDate = (date) => date === void 0 || typeof date === "string" && Number.isFinite(Date.parse(date));
  if (!value || value.schemaVersion !== 1 || !/^[a-zA-Z0-9-]+$/.test(value.runId || "") || typeof value.workflowId !== "string" || !value.workflowId || !/^[a-f0-9]{64}$/.test(value.definitionHash || "") || !Number.isSafeInteger(value.revision) || value.revision < 0 || !["ready", "in_flight", "completed", "failed", "abandoned"].includes(value.phase) || !(value.nextStepId === null || typeof value.nextStepId === "string" && value.nextStepId.length > 0) || !Array.isArray(value.steps) || !validDate(value.createdAt)) throw new Error("Invalid execution checkpoint");
  for (const [index, step] of value.steps.entries()) {
    if (step?.branch && (typeof step.branch.directory !== "string" || !path4.isAbsolute(step.branch.directory) || typeof step.branch.name !== "string" || !step.branch.name)) throw new Error("Invalid branch checkpoint");
    if (step?.result && (typeof step.result.succeeded !== "boolean" || typeof step.result.output !== "string" || step.result.cancelled !== void 0 && (typeof step.result.cancelled !== "boolean" || step.result.cancelled && step.result.succeeded))) throw new Error("Invalid observed result");
    if (step?.evaluations !== void 0 && (!step.result || !Array.isArray(step.evaluations) || new Set(step.evaluations.map((e) => e.key)).size !== step.evaluations.length || step.evaluations.some((e) => typeof e.key !== "string" || !["in_flight", "completed"].includes(e.status) || e.status === "completed" && typeof e.output !== "string"))) throw new Error("Invalid evaluation checkpoint");
    if (step?.approval && (step.status !== "in_flight" || !/^[a-f0-9-]+$/.test(step.approval.token) || !/^[a-f0-9-]+$/.test(step.approval.ownerToken) || !["string", "number"].includes(typeof step.approval.requestId) || !["command", "file-change", "permissions"].includes(step.approval.kind) || typeof step.approval.summary !== "string")) throw new Error("Invalid approval checkpoint");
    if (!validDate(step?.startedAt)) throw new Error("Invalid step timestamp");
    if (!validDate(step?.finishedAt) || step?.finishedAt !== void 0 && (step.status === "in_flight" || !step.startedAt || Date.parse(step.finishedAt) < Date.parse(step.startedAt))) throw new Error("Invalid step finish timestamp");
    if (step?.codexThreadId !== void 0 && (typeof step.codexThreadId !== "string" || !step.codexThreadId.trim())) throw new Error("Invalid Codex identity");
    if (step?.codexTurnId !== void 0 && (!step.codexThreadId || typeof step.codexTurnId !== "string" || !step.codexTurnId.trim())) throw new Error("Invalid Codex turn identity");
    if (!step || typeof step.stepId !== "string" || !step.stepId || !["in_flight", "completed", "failed"].includes(step.status) || step.status !== "in_flight" && typeof step.output !== "string" || step.status === "in_flight" && (index !== value.steps.length - 1 || step.output !== void 0))
      throw new Error("Invalid step checkpoint");
  }
  const last = value.steps[value.steps.length - 1];
  if (value.disposition !== void 0) {
    const d = value.disposition;
    if (!["failed", "completed"].includes(value.phase) || typeof d.at !== "string" || !validDate(d.at) || typeof d.reason !== "string" || !d.reason.trim() || d.reason.length > 1e3 || d.outcome !== "unknown" || d.acknowledgedUnknownEffects !== true || d.previousRevision !== value.revision - 1 || d.snapshot !== `disposition-${value.runId}-${d.previousRevision}.snapshot` || !/^[a-f0-9]{64}$/.test(d.snapshotHash || "") || d.runId !== value.runId || d.workflowId !== value.workflowId || d.definitionHash !== value.definitionHash || !["vault", "installationDirectory", "runtimeDirectory"].every((key) => typeof d[key] === "string" && path4.isAbsolute(d[key])) || !["vaultIdentity", "installationIdentity", "runtimeIdentity"].every((key) => typeof d[key] === "string" && d[key]) || !checkpointUncertainties(value).length || JSON.stringify(d.causes) !== JSON.stringify(checkpointUncertainties(value))) throw new Error("Invalid terminal disposition");
  }
  const abandoned = value.phase === "abandoned", decision = value.abandonment;
  if (abandoned ? !decision || typeof decision.at !== "string" || !validDate(decision.at) || typeof decision.reason !== "string" || !decision.reason.trim() || decision.reason.length > 1e3 || decision.outcome !== "unknown" || decision.acknowledgedUnknownEffects !== true || !["ready", "in_flight"].includes(decision.previousPhase) || typeof decision.previousNextStepId !== "string" || !decision.previousNextStepId || !Number.isSafeInteger(decision.previousRevision) || decision.previousRevision !== value.revision - 1 || decision.snapshot !== `abandonment-${value.runId}-${decision.previousRevision}.snapshot` || decision.previousPhase === "in_flight" !== (last?.status === "in_flight") || decision.previousPhase === "in_flight" && decision.previousNextStepId !== last?.stepId : decision !== void 0) throw new Error("Invalid abandonment decision");
  if (!abandoned && value.phase === "in_flight" !== (last?.status === "in_flight") || value.phase === "in_flight" && value.nextStepId !== last.stepId || ["ready", "in_flight"].includes(value.phase) && value.nextStepId === null || ["completed", "failed", "abandoned"].includes(value.phase) && value.nextStepId !== null)
    throw new Error("Inconsistent execution checkpoint");
}
function readExecutionCheckpoint(directory2, runId) {
  if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error("Invalid execution identity");
  const file = path4.join(directory2, runId + ".json");
  const stat = fs4.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1) throw new Error("Execution checkpoint must be a regular file");
  let state;
  try {
    state = JSON.parse(fs4.readFileSync(file, "utf8"));
  } catch {
    throw new Error("Cannot read valid execution checkpoint");
  }
  validateExecutionCheckpoint(state);
  if (state.runId !== runId) throw new Error("Execution identity changed");
  if (state.abandonment) {
    const d = state.abandonment, snapshot = path4.join(directory2, d.snapshot);
    let prior;
    try {
      const stat2 = fs4.lstatSync(snapshot);
      if (!stat2.isFile() || stat2.isSymbolicLink() || stat2.nlink !== 1) throw new Error("Unsafe abandonment snapshot");
      prior = JSON.parse(fs4.readFileSync(snapshot, "utf8"));
      validateExecutionCheckpoint(prior);
    } catch {
      throw new Error("Missing, unsafe or invalid abandonment snapshot");
    }
    const { abandonment, ...expected } = state;
    expected.phase = d.previousPhase;
    expected.nextStepId = d.previousNextStepId;
    expected.revision = d.previousRevision;
    if (!(0, import_util2.isDeepStrictEqual)(prior, expected)) throw new Error("Abandonment snapshot does not match checkpoint");
  }
  if (state.disposition) {
    const d = state.disposition, location = dispositionLocation(d);
    if (physicalPath(directory2) !== location.runtimeDirectory || Object.entries(location).some(([key, value]) => d[key] !== value)) throw new Error("Disposition installation identity changed");
    const snapshot = path4.join(directory2, d.snapshot), stat2 = fs4.lstatSync(snapshot);
    if (!stat2.isFile() || stat2.isSymbolicLink() || stat2.nlink !== 1) throw new Error("Unsafe disposition snapshot");
    const original = fs4.readFileSync(snapshot);
    if ((0, import_crypto4.createHash)("sha256").update(original).digest("hex") !== d.snapshotHash) throw new Error("Disposition snapshot changed");
    const prior = JSON.parse(original.toString("utf8"));
    validateExecutionCheckpoint(prior);
    const { disposition, ...expected } = state;
    expected.revision--;
    if (JSON.stringify(prior) !== JSON.stringify(expected)) throw new Error("Disposition snapshot does not match checkpoint");
  }
  return state;
}
var ExecutionJournal = class _ExecutionJournal {
  constructor(lease, file, state, timing) {
    this.lease = lease;
    this.file = file;
    this.state = state;
    this.timing = timing;
  }
  static async create(lease, workflowId, definitionHash, entryStep, timing) {
    lease.assertOwned();
    const state = { schemaVersion: 1, runId: (0, import_crypto4.randomUUID)(), workflowId, definitionHash, revision: 0, createdAt: (/* @__PURE__ */ new Date()).toISOString(), phase: "ready", nextStepId: entryStep, steps: [] };
    validateExecutionCheckpoint(state);
    const file = path4.join(lease.directory, state.runId + ".json");
    if (fs4.existsSync(file)) throw new Error("Execution identity already exists");
    await atomicSettingsWrite(file, state, fs4.promises, void 0, timing);
    lease.assertOwned();
    return new _ExecutionJournal(lease, file, state, timing);
  }
  static open(lease, runId, definitionHash, timing) {
    lease.assertOwned();
    if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error("Invalid execution identity");
    const file = path4.join(lease.directory, runId + ".json");
    if (fs4.lstatSync(file).isSymbolicLink()) throw new Error("Execution checkpoint cannot be a link");
    const state = readExecutionCheckpoint(lease.directory, runId);
    if (state.runId !== runId || state.definitionHash !== definitionHash) throw new Error("Execution identity or definition changed");
    return new _ExecutionJournal(lease, file, state, timing);
  }
  snapshot() {
    return JSON.parse(JSON.stringify(this.state));
  }
  disposeTerminal(expectedRevision, reason, acknowledgedUnknownEffects, location) {
    return this.update((state, original) => {
      if (state.revision !== expectedRevision) throw new Error("Execution revision changed; inspect again");
      if (state.disposition) throw new Error("Terminal execution already disposed");
      if (!["failed", "completed"].includes(state.phase) || !checkpointUncertainties(state).length) throw new Error("No terminal uncertainty to dispose");
      if (acknowledgedUnknownEffects !== true) throw new Error("Explicit acknowledgement of unknown effects is required");
      if (typeof reason !== "string" || !reason.trim() || reason.length > 1e3) throw new Error("A concise disposition reason is required");
      const identity2 = dispositionLocation(location);
      if (identity2.runtimeDirectory !== physicalPath(this.lease.directory)) throw new Error("Disposition lease identity mismatch");
      const snapshot = `disposition-${state.runId}-${state.revision}.snapshot`, file = path4.join(this.lease.directory, snapshot);
      if (fs4.existsSync(file)) {
        const stat = fs4.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || fs4.readFileSync(file, "utf8") !== original) throw new Error("Disposition snapshot changed");
      } else {
        const fd = fs4.openSync(file, "wx", 384);
        try {
          fs4.writeFileSync(fd, original);
          fs4.fsyncSync(fd);
        } finally {
          fs4.closeSync(fd);
        }
      }
      this.lease.assertOwned();
      state.disposition = {
        ...identity2,
        at: (/* @__PURE__ */ new Date()).toISOString(),
        reason: reason.trim(),
        outcome: "unknown",
        acknowledgedUnknownEffects: true,
        previousRevision: state.revision,
        snapshot,
        snapshotHash: (0, import_crypto4.createHash)("sha256").update(original).digest("hex"),
        workflowId: state.workflowId,
        runId: state.runId,
        definitionHash: state.definitionHash,
        causes: checkpointUncertainties(state)
      };
    });
  }
  abandon(expectedRevision, reason, acknowledgedUnknownEffects) {
    return this.update((state) => {
      if (state.revision !== expectedRevision) throw new Error("Execution revision changed; inspect again");
      if (!["ready", "in_flight"].includes(state.phase)) throw new Error("Execution is already terminal");
      if (acknowledgedUnknownEffects !== true) throw new Error("Explicit acknowledgement of unknown effects is required");
      if (typeof reason !== "string" || !reason.trim() || reason.length > 1e3) throw new Error("A concise abandonment reason is required");
      const snapshot = `abandonment-${state.runId}-${state.revision}.snapshot`, file = path4.join(this.lease.directory, snapshot);
      const original = JSON.stringify(state);
      if (fs4.existsSync(file)) {
        const stat = fs4.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || fs4.readFileSync(file, "utf8") !== original) throw new Error("Abandonment snapshot changed");
      } else {
        const fd = fs4.openSync(file, "wx", 384);
        try {
          fs4.writeFileSync(fd, original);
          fs4.fsyncSync(fd);
        } finally {
          fs4.closeSync(fd);
        }
      }
      state.abandonment = {
        at: (/* @__PURE__ */ new Date()).toISOString(),
        reason: reason.trim(),
        outcome: "unknown",
        acknowledgedUnknownEffects: true,
        previousPhase: state.phase,
        previousNextStepId: state.nextStepId,
        previousRevision: state.revision,
        snapshot
      };
      state.phase = "abandoned";
      state.nextStepId = null;
    });
  }
  update(change) {
    const operation = (writes.get(this.file) || Promise.resolve()).then(async () => {
      this.lease.assertOwned();
      if (fs4.lstatSync(this.file).isSymbolicLink()) throw new Error("Execution checkpoint cannot be a link");
      const previous = fs4.readFileSync(this.file, "utf8");
      if (JSON.stringify(JSON.parse(previous)) !== JSON.stringify(this.state)) throw new Error("Execution checkpoint changed");
      const next = this.snapshot();
      if (next.disposition) throw new Error("Terminal execution already disposed; historical evidence is immutable");
      change(next, previous);
      next.revision++;
      validateExecutionCheckpoint(next);
      await atomicSettingsWrite(this.file, next, fs4.promises, async () => {
        this.lease.assertOwned();
        const stat = fs4.lstatSync(this.file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || fs4.readFileSync(this.file, "utf8") !== previous) throw new Error("Execution checkpoint changed before publication");
        if (next.disposition) {
          const d = next.disposition;
          if (Object.entries(dispositionLocation(d)).some(([key, value]) => d[key] !== value)) throw new Error("Disposition identity changed");
          const snapshot = path4.join(this.lease.directory, d.snapshot), stat2 = fs4.lstatSync(snapshot);
          if (!stat2.isFile() || stat2.isSymbolicLink() || stat2.nlink !== 1 || fs4.readFileSync(snapshot, "utf8") !== previous) throw new Error("Disposition snapshot changed before publication");
        }
      }, this.timing);
      this.lease.assertOwned();
      this.state = next;
    });
    const settled = operation.catch(() => {
    });
    writes.set(this.file, settled);
    void settled.then(() => {
      if (writes.get(this.file) === settled) writes.delete(this.file);
    });
    return operation;
  }
  begin(stepId) {
    return this.update((state) => {
      if (state.phase !== "ready" || state.nextStepId !== stepId) throw new Error("Step is not ready; reconcile any interrupted execution first");
      state.phase = "in_flight";
      state.steps.push({ stepId, status: "in_flight", startedAt: (/* @__PURE__ */ new Date()).toISOString() });
    });
  }
  recordCodexThread(stepId, threadId, turnId, expectedStepIndex) {
    return this.update((state) => {
      if (expectedStepIndex !== void 0 && expectedStepIndex !== state.steps.length - 1) throw new Error("Codex step occurrence changed");
      const step = state.steps[state.steps.length - 1];
      if (state.phase !== "in_flight" || step?.stepId !== stepId) throw new Error("No matching step in flight");
      if (step.codexThreadId && step.codexThreadId !== threadId) throw new Error("Codex execution identity changed");
      step.codexThreadId = threadId;
      if (turnId !== void 0) {
        if (step.codexTurnId && step.codexTurnId !== turnId) throw new Error("Codex turn identity changed");
        step.codexTurnId = turnId;
      }
    });
  }
  finish(stepId, succeeded, redactedOutput, nextStepId) {
    return this.update((state) => {
      const step = state.steps[state.steps.length - 1];
      if (state.phase !== "in_flight" || step?.stepId !== stepId) throw new Error("No matching step in flight");
      step.status = succeeded ? "completed" : "failed";
      step.output = redactedOutput;
      if (step.startedAt) step.finishedAt = new Date(Math.max(Date.now(), Date.parse(step.startedAt))).toISOString();
      delete step.approval;
      state.nextStepId = nextStepId;
      state.phase = nextStepId !== null ? "ready" : succeeded ? "completed" : "failed";
    });
  }
  recordBranch(branch) {
    return this.update((state) => {
      this.current(state).branch = branch;
    });
  }
  recordResult(result) {
    return this.update((state) => {
      const step = this.current(state);
      if (step.result) throw new Error("Result already observed");
      step.result = result;
      delete step.approval;
    });
  }
  recordEvaluation(key, output) {
    return this.update((state) => {
      const step = this.current(state);
      if (!step.result) throw new Error("Observe task result before evaluation");
      const entries = step.evaluations ||= [], entry = entries.find((e) => e.key === key);
      if (output === void 0) {
        if (entry) throw new Error("Evaluation already started");
        entries.push({ key, status: "in_flight" });
      } else {
        if (!entry || entry.status !== "in_flight") throw new Error("Evaluation is not in flight");
        entry.status = "completed";
        entry.output = output;
      }
    });
  }
  recordApproval(approval) {
    return this.update((state) => {
      const step = this.current(state);
      if (approval && step.approval) throw new Error("Approval already pending");
      step.approval = approval;
    });
  }
  current(state) {
    const step = state.steps[state.steps.length - 1];
    if (state.phase !== "in_flight" || step?.status !== "in_flight") throw new Error("No step in flight");
    return step;
  }
};

// installed-workflow-location.ts
var fs5 = __toESM(require("fs"));
var path5 = __toESM(require("path"));
function regularDirectory(directory2) {
  const stat = fs5.lstatSync(directory2);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Installation must use regular directories");
}
function optionalStat(file) {
  try {
    return fs5.lstatSync(file);
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
function resolveInstalledWorkflowLocation(vaultPath, installationDirectory) {
  if (!path5.isAbsolute(vaultPath)) throw new Error("Explicit absolute vault required");
  const vault = physicalPath(vaultPath);
  regularDirectory(vault);
  let relative7 = path5.join(".obsidian", "plugins", "auto-oc");
  if (installationDirectory !== void 0) {
    if (typeof installationDirectory !== "string" || !installationDirectory || installationDirectory.includes("\0") || installationDirectory.split(/[\\/]/).some((part) => part === "." || part === "..")) {
      throw new Error("Invalid installation location");
    }
    if (process.platform === "win32" && path5.isAbsolute(installationDirectory)) {
      let inspected = path5.parse(installationDirectory).root;
      for (const part of installationDirectory.slice(inspected.length).split(/[\\/]/)) {
        if (!part || part.includes(":")) throw new Error("Invalid installation component");
        inspected = path5.join(inspected, part);
        regularDirectory(inspected);
      }
      relative7 = path5.relative(vault, physicalPath(inspected));
    } else {
      relative7 = path5.isAbsolute(installationDirectory) ? path5.relative(path5.resolve(vaultPath), installationDirectory) : installationDirectory;
    }
    if (!relative7 || path5.isAbsolute(relative7) || relative7.split(/[\\/]/).some((part) => part === ".." || part.includes(":"))) {
      throw new Error("Installation must remain inside the vault");
    }
  }
  let directory2 = vault;
  for (const part of relative7.split(/[\\/]/)) {
    if (!part) throw new Error("Invalid installation component");
    directory2 = path5.join(directory2, part);
    regularDirectory(directory2);
  }
  directory2 = physicalPath(directory2);
  if (!isWithinPhysicalPath(vault, directory2)) throw new Error("Installation must remain inside the vault");
  const configurationFile = path5.join(directory2, "data.json");
  const configStat = optionalStat(configurationFile);
  if (configStat && (configStat.isSymbolicLink() || !configStat.isFile())) throw new Error("Configuration must be a regular file");
  const runtimeDirectory = path5.join(directory2, "runtime");
  const runtimeStat = optionalStat(runtimeDirectory);
  if (runtimeStat && (runtimeStat.isSymbolicLink() || !runtimeStat.isDirectory())) throw new Error("Invalid runtime directory");
  return { vault, installationDirectory: directory2, configurationFile, runtimeDirectory };
}
function ensureInstalledWorkflowRuntime(location) {
  const current = resolveInstalledWorkflowLocation(location.vault, location.installationDirectory);
  if (current.runtimeDirectory !== location.runtimeDirectory) throw new Error("Installation location changed");
  try {
    fs5.mkdirSync(current.runtimeDirectory);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  regularDirectory(current.runtimeDirectory);
}

// execution-lease.ts
var fs6 = __toESM(require("fs"));
var path6 = __toESM(require("path"));
var import_crypto5 = require("crypto");
function acquireExecutionLease(runtimeDirectory) {
  const root = fs6.realpathSync(runtimeDirectory);
  if (fs6.existsSync(path6.join(root, "update-pending.json"))) throw new Error("Incomplete plugin update requires recovery before execution");
  const recovery = path6.join(root, "lease-recovery.lock");
  if (fs6.existsSync(recovery)) throw new Error("Execution lease recovery is in progress");
  const lock = path6.join(root, "execution.lock");
  const ownerPath = path6.join(lock, "owner.json");
  const token = (0, import_crypto5.randomUUID)();
  fs6.mkdirSync(lock);
  if (fs6.existsSync(recovery)) {
    fs6.rmdirSync(lock);
    throw new Error("Execution lease recovery is in progress");
  }
  try {
    const fd = fs6.openSync(ownerPath, "wx", 384);
    try {
      fs6.writeFileSync(fd, JSON.stringify({ schemaVersion: 1, token, pid: process.pid, createdAt: (/* @__PURE__ */ new Date()).toISOString() }));
      fs6.fsyncSync(fd);
    } finally {
      fs6.closeSync(fd);
    }
  } catch (error) {
    throw error;
  }
  let released = false;
  const assertOwned = () => {
    if (released) throw new Error("Execution lease already released");
    if (fs6.lstatSync(lock).isSymbolicLink() || fs6.realpathSync(lock) !== lock) throw new Error("Execution lease directory changed");
    if (fs6.lstatSync(ownerPath).isSymbolicLink()) throw new Error("Execution lease owner changed");
    const owner = JSON.parse(fs6.readFileSync(ownerPath, "utf8"));
    if (owner.token !== token || owner.pid !== process.pid || owner.schemaVersion !== 1) throw new Error("Execution lease ownership changed");
  };
  return {
    directory: root,
    token,
    assertOwned,
    release() {
      assertOwned();
      fs6.unlinkSync(ownerPath);
      fs6.rmdirSync(lock);
      released = true;
    }
  };
}
function readExecutionLeaseOwner(runtimeDirectory) {
  const root = fs6.realpathSync(runtimeDirectory), lock = path6.join(root, "execution.lock"), file = path6.join(lock, "owner.json");
  if (fs6.lstatSync(lock).isSymbolicLink() || fs6.realpathSync(lock) !== lock || fs6.lstatSync(file).isSymbolicLink()) throw new Error("Invalid execution lease paths");
  let owner;
  try {
    owner = JSON.parse(fs6.readFileSync(file, "utf8"));
  } catch {
    throw new Error("Incomplete execution lease owner; manual reconciliation required");
  }
  if (owner?.schemaVersion !== 1 || !/^[a-f0-9-]{36}$/.test(owner.token || "") || !Number.isSafeInteger(owner.pid) || owner.pid <= 0 || !Number.isFinite(Date.parse(owner.createdAt))) throw new Error("Invalid execution lease owner");
  return { schemaVersion: 1, token: owner.token, pid: owner.pid, createdAt: owner.createdAt };
}
function recoverExecutionLease(runtimeDirectory, expectedToken, assertSafe) {
  const root = fs6.realpathSync(runtimeDirectory), guard = path6.join(root, "lease-recovery.lock");
  fs6.mkdirSync(guard);
  try {
    const owner = readExecutionLeaseOwner(root);
    if (owner.token !== expectedToken) throw new Error("Execution lease recovery identity changed");
    let absent = false;
    try {
      process.kill(owner.pid, 0);
    } catch (error) {
      absent = error.code === "ESRCH";
    }
    if (!absent) throw new Error("Execution lease owner is live or cannot be verified absent");
    assertSafe?.();
    if (JSON.stringify(readExecutionLeaseOwner(root)) !== JSON.stringify(owner)) throw new Error("Execution lease changed during recovery");
    const archived = `abandoned-lease-${owner.token}`;
    if (fs6.existsSync(path6.join(root, archived))) throw new Error("Recovery archive already exists");
    fs6.renameSync(path6.join(root, "execution.lock"), path6.join(root, archived));
    return { recovered: true, archived, executionsResumed: false };
  } finally {
    fs6.rmdirSync(guard);
  }
}

// execution-abandonment.ts
var fs7 = __toESM(require("fs"));
function inspectTerminalExecution(options) {
  const location = resolveInstalledWorkflowLocation(options.vault, options.installationDirectory);
  const identity2 = dispositionLocation(location), state = readExecutionCheckpoint(location.runtimeDirectory, options.runId);
  return {
    ...identity2,
    runId: state.runId,
    workflowId: state.workflowId,
    definitionHash: state.definitionHash,
    revision: state.revision,
    phase: state.phase,
    causes: checkpointUncertainties(state),
    disposition: state.disposition
  };
}
async function disposeTerminalExecution(options) {
  const location = resolveInstalledWorkflowLocation(options.vault, options.installationDirectory);
  const lease = options.lease || acquireExecutionLease(location.runtimeDirectory);
  try {
    lease.assertOwned();
    if (!samePhysicalPath(lease.directory, location.runtimeDirectory)) throw new Error("Disposition lease identity mismatch");
    const observed = inspectTerminalExecution(options);
    for (const key of ["vault", "installationDirectory", "runtimeDirectory", "vaultIdentity", "installationIdentity", "runtimeIdentity", "workflowId", "runId", "definitionHash"]) {
      if (observed[key] !== options[key]) throw new Error("Disposition observed identity changed; inspect again");
    }
    if (observed.revision !== options.revision || JSON.stringify(observed.causes) !== JSON.stringify(options.causes)) throw new Error("Execution revision or uncertainty changed; inspect again");
    const assertQuiescent = () => {
      lease.assertOwned();
      const current = dispositionLocation(resolveInstalledWorkflowLocation(options.vault, options.installationDirectory));
      if (Object.entries(current).some(([key, value]) => options[key] !== value)) throw new Error("Disposition installation identity changed");
      if (fs7.existsSync(location.configurationFile + ".write-lock") || fs7.readdirSync(location.installationDirectory).some((name) => name.startsWith("data.json.") && name.endsWith(".tmp")) || fs7.readdirSync(location.runtimeDirectory).some((name) => name.endsWith(".tmp") || name.endsWith(".write-lock"))) throw new Error("Unfinished write requires reconciliation");
      const config = JSON.parse(fs7.readFileSync(location.configurationFile, "utf8"));
      if (["tasks", "workflows"].some((kind) => !Array.isArray(config[kind]) || config[kind].some((entry) => entry.status === "running" || entry.pendingCodexApproval))) throw new Error("Active execution requires reconciliation");
      for (const name of fs7.readdirSync(location.runtimeDirectory)) {
        if (!/^[a-zA-Z0-9-]+\.json$/.test(name)) continue;
        const state = readExecutionCheckpoint(location.runtimeDirectory, name.slice(0, -5));
        if (["ready", "in_flight"].includes(state.phase)) throw new Error("Active or unfinished execution requires reconciliation");
      }
    };
    assertQuiescent();
    const journal = ExecutionJournal.open(lease, options.runId, options.definitionHash);
    await journal.disposeTerminal(options.revision, options.reason, options.acknowledgedUnknownEffects, location);
    assertQuiescent();
    return readExecutionCheckpoint(location.runtimeDirectory, options.runId);
  } finally {
    if (!options.lease) lease.release();
  }
}
async function abandonInstalledExecution(options) {
  if (!Number.isSafeInteger(options.revision) || options.revision < 0) throw new Error("Exact observed revision is required");
  const location = resolveInstalledWorkflowLocation(options.vault, options.installationDirectory);
  const lease = options.lease || acquireExecutionLease(location.runtimeDirectory);
  try {
    lease.assertOwned();
    if (!samePhysicalPath(lease.directory, location.runtimeDirectory)) throw new Error("Lease belongs to another installation runtime");
    const state = readExecutionCheckpoint(location.runtimeDirectory, options.runId);
    if (state.workflowId !== options.workflowId) throw new Error("Execution belongs to another workflow or task");
    const journal = ExecutionJournal.open(lease, state.runId, state.definitionHash);
    await journal.abandon(options.revision, options.reason, options.acknowledgedUnknownEffects);
    return journal.snapshot();
  } finally {
    if (!options.lease) lease.release();
  }
}

// workflow-stop.ts
var fs8 = __toESM(require("fs"));
var path7 = __toESM(require("path"));
var import_crypto6 = require("crypto");
function readStopRequest(directory2, runId) {
  if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error("Invalid execution identity");
  const file = path7.join(directory2, runId + ".stop.json");
  try {
    const stat = fs8.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Invalid stop request file");
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  let value;
  try {
    value = JSON.parse(fs8.readFileSync(file, "utf8"));
  } catch {
    throw new Error("Invalid stop request");
  }
  if (value.schemaVersion !== 1 || value.runId !== runId || !/^[a-f0-9-]+$/.test(value.requestId || "")) throw new Error("Invalid stop request identity");
  return value.requestId;
}
async function requestWorkflowStop(directory2, runId) {
  const stat = fs8.lstatSync(directory2);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Invalid runtime directory");
  const state = readExecutionCheckpoint(directory2, runId);
  if (["completed", "failed", "abandoned"].includes(state.phase)) return { runId, requested: false, phase: state.phase };
  readStopRequest(directory2, runId);
  const requestId2 = (0, import_crypto6.randomUUID)();
  await atomicSettingsWrite(path7.join(directory2, runId + ".stop.json"), { schemaVersion: 1, runId, requestId: requestId2 });
  return { runId, requestId: requestId2, requested: true, phase: state.phase };
}

// workflow-definition.ts
var import_crypto7 = require("crypto");

// opencode-profile.ts
var OPENCODE2_DEFAULTS = Object.freeze({
  opencode2Path: "opencode",
  defaultOpencode2Model: "",
  defaultOpencode2Agent: "build"
});
function isOpenCodeTask(kind) {
  return !kind || kind === "opencode" || kind === "opencode2";
}
function openCodeRunArgs(major, model, agent, forceModel = false) {
  if (major === 2) return [
    "run",
    "--standalone",
    "--print-logs",
    "--log-level",
    "info",
    "--auto",
    "--model",
    model,
    ...forceModel ? [] : ["--agent", agent]
  ];
  return [
    "run",
    "--print-logs",
    "--log-level",
    "INFO",
    "--auto",
    "-m",
    model,
    ...forceModel ? [] : ["--agent", agent],
    "--dangerously-skip-permissions"
  ];
}
function openCodeInteractiveArgs(major, model, agent, prompt) {
  return [
    ...major === 2 ? ["mini", "--standalone"] : [],
    "-m",
    model,
    ...agent ? ["--agent", agent] : [],
    "--prompt",
    prompt
  ];
}

// execution-defaults.ts
var EXECUTION_DEFAULTS = Object.freeze({
  opencodePath: "opencode",
  codexPath: "codex",
  copilotPath: "copilot",
  defaultCopilotModel: "",
  defaultAiEngine: "opencode",
  defaultModel: "",
  defaultCodexModel: "",
  defaultCodexReasoningEffort: "medium",
  defaultAgent: "build",
  workingDirectory: "",
  cmdTemplate: '{opencode} run --model {model} -- "{prompt}"',
  taskTimeoutSeconds: 7200,
  defaultInteractiveTerminal: false,
  linuxTerminal: ""
});
function effectiveExecutionSettings(settings, includeOpenCode2 = false) {
  const effective = Object.fromEntries(Object.entries(EXECUTION_DEFAULTS).map(([key, value]) => [key, settings[key] === void 0 ? value : settings[key]]));
  if (includeOpenCode2) Object.assign(effective, Object.fromEntries(Object.entries(OPENCODE2_DEFAULTS).map(([key, value]) => [key, settings[key] === void 0 ? value : settings[key]])));
  return effective;
}

// execution-concurrency-settings.ts
function validateConcurrency(item) {
  if (item.concurrency !== void 0 && !["exclusive", "independent", "parallel"].includes(item.concurrency)) {
    throw new Error("Invalid concurrency policy");
  }
}
function concurrencySettings(settings) {
  const defaultConcurrency = settings.defaultConcurrency === void 0 ? "parallel" : settings.defaultConcurrency;
  validateConcurrency({ concurrency: defaultConcurrency });
  const maxConcurrentExecutions = settings.maxConcurrentExecutions === void 0 ? 0 : settings.maxConcurrentExecutions;
  if (!Number.isSafeInteger(maxConcurrentExecutions) || maxConcurrentExecutions < 0) {
    throw new Error("Maximum simultaneous runs must be a whole number of zero or more");
  }
  return { defaultConcurrency, maxConcurrentExecutions };
}

// workflow-routing.ts
var vm = __toESM(require("vm"));
function workflowStepTransitions(steps, index) {
  const step = steps[index];
  if (!step) throw new Error("Workflow step is absent");
  if (step.transitions?.length) return step.transitions;
  const next = steps[index + 1];
  if (!next) return [];
  if (step.stepKind === "code" || step.stepKind === "delay") return [{ toStepId: next.id, mode: "default" }];
  return [{ toStepId: next.id, mode: step.transitionMode || "default", evaluatePrompt: step.evaluatePrompt, forceContinue: step.forceContinue }];
}
function findWorkflowEntry(steps) {
  if (!steps.length) return null;
  const incoming = new Set(steps.flatMap((step) => (step.transitions || []).map((t) => t.toStepId)));
  const candidates = steps.filter((step) => !incoming.has(step.id));
  if (!candidates.length) return steps[0];
  return candidates.sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0))[0];
}
function evaluateWorkflowCondition(expression, input, outputs) {
  if (!expression || !expression.trim()) return false;
  const sandbox = {
    input: input || "",
    outputs,
    String,
    Number,
    Boolean,
    Array,
    Object,
    JSON,
    Math,
    Date,
    RegExp,
    console: { log: () => {
    } }
  };
  const source = expression.trim().startsWith("return") ? `(function(){ ${expression} })()` : `(${expression})`;
  return !!vm.runInNewContext(source, sandbox, { timeout: 500 });
}
async function resolveWorkflowTransition(steps, index, input, succeeded, transitions, outputs, host) {
  if (!transitions?.length) {
    const next = steps[index + 1];
    return { nextStepId: next?.id ?? null, reason: next ? "linear" : "end" };
  }
  for (const transition of transitions) {
    const target = steps.find((step) => step.id === transition.toStepId);
    if (!target) continue;
    if (transition.mode === "force" || transition.forceContinue) return { nextStepId: target.id, reason: "force" };
    if (transition.mode === "default") {
      if (succeeded) return { nextStepId: target.id, reason: "default" };
    } else if (transition.mode === "eval") {
      try {
        const response = await host.evaluate(transition, target, input);
        if (/\bYES\b/i.test(response) && !/\bNO\b/i.test(response)) return { nextStepId: target.id, reason: "eval:yes" };
      } catch (error) {
        host.onError("eval", error);
      }
    } else if (transition.mode === "conditional") {
      try {
        if (evaluateWorkflowCondition(transition.condition || "", input, outputs)) return { nextStepId: target.id, reason: "conditional:true" };
      } catch (error) {
        host.onError("condition", error);
      }
    }
  }
  return { nextStepId: null, reason: "no-match" };
}

// workflow-nesting.ts
var MAX_WORKFLOW_DEPTH = 16;
var MAX_PLAN_STEPS = 1e4;
function workflowClosure(root, catalog = []) {
  const found = /* @__PURE__ */ new Map();
  let visits = 0;
  const visit = (workflow, ancestors) => {
    if (++visits > MAX_PLAN_STEPS) throw new Error(`Expanded workflow exceeds ${MAX_PLAN_STEPS} invocations`);
    if (ancestors.includes(workflow.id)) throw new Error(`Workflow nesting cycle: ${[...ancestors, workflow.id].join(" -> ")}`);
    if (ancestors.length >= MAX_WORKFLOW_DEPTH) throw new Error(`Workflow nesting exceeds ${MAX_WORKFLOW_DEPTH} levels`);
    if (!workflow.id || !Array.isArray(workflow.steps) || !workflow.steps.length || workflow.steps.some((step) => !step || typeof step.id !== "string" || !step.id) || new Set(workflow.steps.map((step) => step.id)).size !== workflow.steps.length) throw new Error("Invalid workflow identity or steps");
    for (const step of workflow.steps) {
      if (step.stepKind !== "workflow") continue;
      const matches = catalog.filter((item) => item.id === step.workflowId);
      if (typeof step.workflowId !== "string" || !step.workflowId || matches.length !== 1) throw new Error(`Missing or ambiguous referenced workflow (${step.workflowId || step.id})`);
      const child = matches[0];
      visit(child, [...ancestors, workflow.id]);
      found.set(child.id, child);
    }
  };
  visit(root, []);
  return [...found.values()];
}
function workflowExecutionPlan(definition) {
  const root = definition.workflow;
  const scopes = /* @__PURE__ */ new Map(), steps = [];
  const used = new Set(root.steps.map((step) => step.id));
  const internal = (parts) => {
    let id = `@nested:${JSON.stringify(parts)}`;
    while (used.has(id)) id = "@" + id;
    used.add(id);
    return id;
  };
  const expand = (workflow, path34, returnId, enterId, inheritedBranch = false) => {
    const ids = new Map(workflow.steps.map((step) => [step.id, path34.length ? internal([...path34, step.id]) : step.id]));
    const entries = new Map(workflow.steps.map((step) => [step.id, step.stepKind === "workflow" ? internal([...path34, step.id, "enter"]) : ids.get(step.id)]));
    for (const [index, source] of workflow.steps.entries()) {
      const id = ids.get(source.id);
      const scope = { workflow, path: path34, localId: source.id, rootStepId: path34[0] || source.id, returnId, enterId, handoffBranch: inheritedBranch || !!workflow.handoffBranch };
      const transitions = workflowStepTransitions(workflow.steps, index).map((edge) => {
        if (!entries.has(edge.toStepId)) throw new Error("Workflow transition references a missing step");
        return { ...edge, toStepId: entries.get(edge.toStepId) };
      });
      if (source.stepKind === "workflow") {
        const child = definition.workflows?.find((item) => item.id === source.workflowId);
        if (!child) throw new Error("Referenced workflow is unavailable");
        const entryId = entries.get(source.id);
        scopes.set(entryId, { ...scope, boundary: "enter" });
        const entryStep = { id: entryId, stepKind: "workflow", transitions: [] };
        steps.push(entryStep);
        const childEntry = expand(child, [...path34, source.id], id, entryId, scope.handoffBranch);
        entryStep.transitions = [{ toStepId: childEntry, mode: "default" }];
        scopes.set(id, { ...scope, boundary: "return" });
      } else scopes.set(id, scope);
      steps.push({ ...source, id, transitions });
      if (steps.length > MAX_PLAN_STEPS) throw new Error(`Expanded workflow exceeds ${MAX_PLAN_STEPS} steps`);
    }
    return entries.get(findWorkflowEntry(workflow.steps).id);
  };
  const entry = expand(root, []);
  return { steps, entry, scopes };
}
function workflowStepContext(plan, stepId, state) {
  const scope = plan.scopes.get(stepId);
  let start = 0;
  if (scope.enterId) {
    for (let i = state.steps.length - 1; i >= 0; i--) if (state.steps[i].stepId === scope.enterId) {
      start = i + 1;
      break;
    }
  }
  const outputs = /* @__PURE__ */ Object.create(null);
  let previous;
  for (const item of state.steps.slice(start)) {
    const known = plan.scopes.get(item.stepId);
    if (item.status === "in_flight" || !known || known.boundary === "enter" || JSON.stringify(known.path) !== JSON.stringify(scope.path)) continue;
    outputs[known.localId] = item.output || "";
    previous = { stepId: known.localId, output: item.output || "" };
  }
  const input = previous?.output ?? (scope.enterId ? state.steps[start - 1]?.output || "" : "");
  return { scope, outputs, input, previous: previous || (scope.enterId ? { stepId: "workflow input", output: input } : void 0) };
}
function workflowPlanNext(plan, stepId, next) {
  return next || plan.scopes.get(stepId)?.returnId || null;
}

// workflow-definition.ts
var runtimeFields = /* @__PURE__ */ new Set(["disabled", "codeExecution", "status", "lastRun", "output", "createdAt", "currentStep", "lastCodexThreadId", "lastCodexTurnId", "pendingCodexApproval", "runtimeExecution", "legacyExecution"]);
function withoutRuntime(value) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !runtimeFields.has(key)));
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== void 0).map((key) => [key, canonical(value[key])]));
  return value;
}
function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function definitionPayload(workflow, tasks, settings) {
  if (!workflow.id || !workflow.steps.length || new Set(workflow.steps.map((s) => s.id)).size !== workflow.steps.length) throw new Error("Invalid workflow identity or steps");
  const children = workflow.steps.some((s) => s.stepKind === "workflow") ? workflowClosure(workflow, settings.workflows || []) : [];
  const refs = [...new Set([workflow, ...children].flatMap((w) => w.steps).filter((s) => s.stepKind === "task" || !s.stepKind && s.taskId).map((s) => s.taskId))];
  const selected = refs.map((id) => {
    const matches = tasks.filter((t) => t.id === id);
    if (!id || matches.length !== 1) throw new Error("Missing or ambiguous referenced task");
    return withoutRuntime(matches[0]);
  });
  const usesOpenCode2 = selected.some((task) => task.taskKind === "opencode2" || task.taskKind === "cli" && task.cliProvider === "opencode2") || settings.defaultAiEngine === "opencode2";
  const effectiveSettings = effectiveExecutionSettings(settings, usesOpenCode2);
  if (selected.some((task) => task.taskKind === "cli" && task.cliProvider === "claude")) effectiveSettings.claudePath = settings.claudePath || "claude";
  const clean2 = (w) => ({ ...withoutRuntime(w), steps: w.steps.map((s) => withoutRuntime(s)) });
  return canonical({ workflow: clean2(workflow), ...children.length ? { workflows: children.map(clean2) } : {}, tasks: selected, settings: effectiveSettings });
}
function withAvailability(payload, workflow, tasks, catalog = []) {
  return {
    ...payload,
    ...payload.workflows ? { workflows: payload.workflows.map((child) => withAvailability({ workflow: child, tasks: [] }, catalog.find((w) => w.id === child.id), [], []).workflow) } : {},
    workflow: {
      ...payload.workflow,
      ...workflow.disabled !== void 0 ? { disabled: workflow.disabled } : {},
      steps: payload.workflow.steps.map((step) => {
        const source = workflow.steps.find((item) => item.id === step.id);
        return { ...step, ...source?.disabled !== void 0 ? { disabled: source.disabled } : {} };
      })
    },
    tasks: payload.tasks.map((task) => {
      const source = tasks.find((item) => item.id === task.id);
      return { ...task, ...source?.disabled !== void 0 ? { disabled: source.disabled } : {} };
    })
  };
}
function prepareWorkflowDefinition(workflow, tasks, settings) {
  const payload = definitionPayload(workflow, tasks, settings);
  const digest = (0, import_crypto7.createHash)("sha256");
  for (const part of encodeCapturedJson(captureJsonStructure(payload, 0))) digest.update(part, "utf8");
  const hash3 = digest.digest("hex");
  return freeze({ ...withAvailability(payload, workflow, tasks, settings.workflows), hash: hash3, admissionSettings: concurrencySettings(settings) });
}

// workflow-progress.ts
function validateProgressBinding(workflow, checkpoint, expectedRunId) {
  validateExecutionCheckpoint(checkpoint);
  if (checkpoint.runId !== expectedRunId || checkpoint.workflowId !== workflow.id) throw new Error("Progress identity or definition mismatch");
  const previous = workflow.runtimeExecution;
  if (previous && (previous.runId !== checkpoint.runId || !Number.isSafeInteger(previous.revision) || previous.revision < 0 || previous.revision > checkpoint.revision)) throw new Error("Stale progress cannot replace current execution");
  if (previous && (previous.workflowId !== void 0 && previous.workflowId !== checkpoint.workflowId || previous.definitionHash !== void 0 && previous.definitionHash !== checkpoint.definitionHash)) throw new Error("Progress binding identity mismatch");
}
function projectWorkflowProgress(workflow, tasks, settings, checkpoint, expectedRunId, activelyExecuting = false) {
  validateProgressBinding(workflow, checkpoint, expectedRunId);
  const definition = prepareWorkflowDefinition(workflow, tasks, settings);
  if (checkpoint.definitionHash !== definition.hash) throw new Error("Progress identity or definition mismatch");
  return projectPreparedProgress(workflow, checkpoint, activelyExecuting, definition.workflows);
}
function projectPreparedProgress(workflow, checkpoint, activelyExecuting = false, workflows = []) {
  const plan = workflowExecutionPlan({ workflow, workflows: workflowClosure(workflow, workflows) });
  const last = /* @__PURE__ */ new Map();
  for (const step of checkpoint.steps) {
    const scope = plan.scopes.get(step.stepId);
    if (!scope) throw new Error("Progress contains an unknown step");
    const internal = scope.path.length > 0 || scope.boundary === "enter";
    last.set(scope.rootStepId, internal ? { ...step, status: checkpoint.phase === "failed" ? "failed" : "in_flight", output: checkpoint.phase === "failed" ? step.output : "" } : step);
  }
  if (checkpoint.nextStepId && !plan.scopes.has(checkpoint.nextStepId)) throw new Error("Progress next step is absent");
  const targetId = checkpoint.nextStepId || checkpoint.steps[checkpoint.steps.length - 1]?.stepId;
  const target = plan.scopes.get(targetId)?.rootStepId;
  return {
    ...workflow,
    ...checkpoint.createdAt ? { lastRun: checkpoint.createdAt } : {},
    status: checkpoint.phase === "abandoned" ? "abandoned" : checkpoint.phase === "completed" ? "completed" : checkpoint.phase === "failed" ? "failed" : activelyExecuting ? "running" : "pending",
    currentStep: Math.max(0, workflow.steps.findIndex((step) => step.id === target)),
    runtimeExecution: { runId: checkpoint.runId, definitionHash: checkpoint.definitionHash, revision: checkpoint.revision, phase: checkpoint.phase, abandonment: checkpoint.abandonment, disposition: checkpoint.disposition, terminalUncertainty: checkpointUncertainties(checkpoint).length > 0, requiresReconciliation: checkpoint.phase === "in_flight" && !activelyExecuting },
    steps: workflow.steps.map((step) => {
      const observed = last.get(step.id);
      return { ...step, ...observed?.startedAt ? { lastRun: observed.startedAt } : {}, status: observed?.status === "in_flight" ? checkpoint.phase === "abandoned" ? "abandoned" : activelyExecuting ? "running" : "pending" : observed?.status || "pending", output: observed?.output || "" };
    })
  };
}

// standalone-task.ts
function standaloneTaskWorkflow(taskId) {
  if (!taskId) throw new Error("Explicit task identity required");
  return { id: `@task:${taskId}`, name: "Standalone task", steps: [{ id: "task", stepKind: "task", taskId }] };
}

// workflow-approval.ts
var fs9 = __toESM(require("fs"));
var path8 = __toESM(require("path"));
var import_crypto8 = require("crypto");
function responseFile(directory2, runId, token) {
  if (!/^[a-f0-9-]+$/.test(token)) throw new Error("Invalid approval identity");
  return path8.join(directory2, `${runId}-${token}.approval.json`);
}
function answerWorkflowApproval(directory2, runId, token, approved) {
  if (typeof approved !== "boolean") throw new Error("Explicit approval decision required");
  const state = readExecutionCheckpoint(directory2, runId), step = state.steps.slice(-1)[0];
  if (state.phase !== "in_flight" || step?.approval?.token !== token || step.result) throw new Error("Approval is no longer pending");
  const owner = readExecutionLeaseOwner(directory2);
  if (owner.token !== step.approval.ownerToken) throw new Error("Approval owner changed; reconcile execution");
  try {
    process.kill(owner.pid, 0);
  } catch {
    throw new Error("Approval owner is unavailable; reconcile execution");
  }
  fs9.writeFileSync(responseFile(directory2, runId, token), JSON.stringify({ runId, token, approved }), { encoding: "utf8", flag: "wx", mode: 384 });
  return { runId, approval: token, decision: approved ? "approve" : "deny", recorded: true };
}
async function awaitWorkflowApproval(journal, directory2, request, redact, signal, onCheckpoint) {
  const token = (0, import_crypto8.randomUUID)(), runId = journal.snapshot().runId;
  const ownerToken = readExecutionLeaseOwner(directory2).token;
  await journal.recordApproval({ token, ownerToken, requestId: request.requestId, kind: request.kind, summary: redact(request.summary) });
  await onCheckpoint?.(journal.snapshot());
  const file = responseFile(directory2, runId, token);
  const approved = await new Promise((resolve11, reject) => {
    const finish = (error, value) => {
      clearInterval(timer);
      signal?.removeEventListener("abort", abort);
      error ? reject(error) : resolve11(value);
    };
    const abort = () => finish(new Error("Approval interrupted; execution requires reconciliation"));
    const timer = setInterval(() => {
      try {
        if (!fs9.existsSync(file)) return;
        const stat = fs9.lstatSync(file);
        if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Invalid approval response file");
        const response = JSON.parse(fs9.readFileSync(file, "utf8"));
        if (response.runId !== runId || response.token !== token || typeof response.approved !== "boolean") throw new Error("Approval response identity mismatch");
        finish(void 0, response.approved);
      } catch {
        finish(new Error("Cannot read matching approval response"));
      }
    }, 100);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
  await journal.recordApproval();
  await onCheckpoint?.(journal.snapshot());
  return approved;
}

// execution-presentation.ts
function executionPresentation(workflow, taskId) {
  if (workflow.name !== void 0 && typeof workflow.name !== "string" || taskId !== void 0 && workflow.id !== `@task:${taskId}`) {
    throw new Error("Invalid execution presentation identity");
  }
  const presentation = {
    ...typeof workflow.name === "string" ? { workflowName: workflow.name } : {},
    executionKind: taskId === void 0 ? "workflow" : "task",
    ...workflow.isolatedCodeStep !== void 0 ? { stepId: workflow.isolatedCodeStep } : {}
  };
  presentationFields(presentation);
  return presentation;
}
function presentationFields(value) {
  if (value.workflowName === void 0 && value.executionKind === void 0 && value.stepId === void 0) return {};
  if (value.workflowName !== void 0 && typeof value.workflowName !== "string" || !["workflow", "task"].includes(value.executionKind)) {
    throw new Error("Invalid execution presentation metadata");
  }
  if (value.stepId !== void 0 && (value.executionKind !== "workflow" || typeof value.stepId !== "string" || !value.stepId || value.stepId.length > 256 || /[\0\r\n]/.test(value.stepId))) throw new Error("Invalid code step presentation identity");
  return {
    ...value.workflowName !== void 0 ? { workflowName: value.workflowName } : {},
    executionKind: value.executionKind,
    ...value.stepId !== void 0 ? { stepId: value.stepId } : {}
  };
}

// cli-plugin-requests.ts
var fs13 = __toESM(require("fs"));
var path14 = __toESM(require("path"));
var import_crypto12 = require("crypto");
var import_perf_hooks4 = require("perf_hooks");
var import_timers3 = require("timers");

// workflow-edit.ts
var import_crypto9 = require("crypto");
var object = (value) => value && typeof value === "object" && !Array.isArray(value);
var only = (value, keys) => object(value) && Object.keys(value).every((key) => keys.includes(key));
function validWorkflowEdit(value) {
  if (!object(value) || value.command !== "edit-workflow" || typeof value.workflowId !== "string" || !value.workflowId.length || value.workflowId.length > 256 || /[\0\r\n]/.test(value.workflowId) || typeof value.expectedHash !== "string" || !/^[a-f0-9]{64}$/.test(value.expectedHash) || value.taskId !== void 0 || value.runId !== void 0) return false;
  const c = value.changes;
  if (!only(c, ["name", "description", "stepChanges"]) || !Object.keys(c).length) return false;
  if (["name", "description"].some((key) => c[key] !== void 0 && typeof c[key] !== "string")) return false;
  if (c.name !== void 0 && !c.name.trim()) return false;
  if (c.stepChanges !== void 0) {
    if (!Array.isArray(c.stepChanges) || !c.stepChanges.length || c.stepChanges.length > 1e3) return false;
    const ids = /* @__PURE__ */ new Set();
    for (const step of c.stepChanges) {
      if (!only(step, ["id", "name", "code", "evaluatePrompt"]) || typeof step.id !== "string" || !step.id || ids.has(step.id) || Object.keys(step).length < 2) return false;
      if (["name", "code", "evaluatePrompt"].some((key) => step[key] !== void 0 && typeof step[key] !== "string")) return false;
      ids.add(step.id);
    }
  }
  return Buffer.byteLength(JSON.stringify(value.changes), "utf8") <= 58e3;
}
function workflowEditDefinition(workflow) {
  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    steps: (workflow.steps || []).map((step) => ({ id: step.id, name: step.name, code: step.code, evaluatePrompt: step.evaluatePrompt }))
  };
}
function workflowEditHash(workflow) {
  return (0, import_crypto9.createHash)("sha256").update(JSON.stringify(workflowEditDefinition(workflow))).digest("hex");
}

// execution-coordinator.ts
var fs10 = __toESM(require("fs"));
var path10 = __toESM(require("path"));
var import_child_process3 = require("child_process");

// workspace-conflicts.ts
var path9 = __toESM(require("path"));
var import_child_process2 = require("child_process");
function independentGitWorkspaces(a, b) {
  try {
    a = physicalPath(a);
    b = physicalPath(b);
    if (samePhysicalPath(a, b)) return false;
    const git2 = (cwd, ...args) => (0, import_child_process2.execFileSync)(
      "git",
      ["-c", "safe.directory=" + cwd.replace(/\\/g, "/"), ...args],
      { cwd, encoding: "utf8", windowsHide: true, timeout: 5e3, stdio: ["ignore", "pipe", "pipe"] }
    ).trim();
    const identity2 = (cwd) => ({
      root: physicalPath(git2(cwd, "rev-parse", "--show-toplevel")),
      common: physicalPath(path9.resolve(cwd, git2(cwd, "rev-parse", "--git-common-dir"))),
      gitDir: physicalPath(path9.resolve(cwd, git2(cwd, "rev-parse", "--git-dir")))
    });
    const left = identity2(a), right = identity2(b);
    if (!samePhysicalPath(a, left.root) || !samePhysicalPath(b, right.root) || !samePhysicalPath(left.common, right.common) || samePhysicalPath(left.gitDir, right.gitDir)) return false;
    const roots = git2(a, "worktree", "list", "--porcelain", "-z").split("\0").filter((field) => field.startsWith("worktree ")).map((field) => field.slice(9));
    if (![a, b].every((root) => roots.some((entry) => samePhysicalPath(entry, root)))) return false;
    const parent = isWithinPhysicalPath(a, b) ? a : isWithinPhysicalPath(b, a) ? b : void 0;
    if (parent) {
      const child = parent === a ? b : a;
      git2(parent, "check-ignore", "--quiet", "--", path9.relative(parent, child).replace(/\\/g, "/") + "/");
    }
    return true;
  } catch {
    return false;
  }
}

// execution-coordinator.ts
var admissionDiagnostics = /* @__PURE__ */ new Set([
  "A shared workflow is already executing",
  "A shared workflow is already executing; definition is already starting",
  "A shared workflow is already executing; definition or referenced task is reserved",
  "Execution outcome requires continuation or reconciliation; reservation retained",
  "Exclusive execution must finish before shared execution",
  "Execution resource is occupied (workspace or Git repository)",
  "Concurrent execution limit reached (2)",
  "Catalog has unresolved running activity; verify its owner before execution"
]);
function executionAdmissionDiagnostic(error) {
  if (error?.name === "DisabledExecutionError") return "Selected task, workflow or step is disabled. Inspect list/status and enable it in AutoOC before running.";
  const message = error?.message;
  return typeof message === "string" && (admissionDiagnostics.has(message) || /^Concurrent execution limit reached \([1-9][0-9]{0,15}\)$/.test(message)) ? message : void 0;
}
function resources(definition, vault, workspace) {
  const { workflow, tasks, settings } = definition;
  const workflows = [workflow, ...definition.workflows || []];
  for (const item of [...workflows, ...tasks]) validateConcurrency(item);
  const standalone = workflow.id.startsWith("@task:");
  const policy = (standalone ? tasks[0]?.concurrency : workflow.concurrency) ?? concurrencySettings(definition.admissionSettings || {}).defaultConcurrency;
  const result = { exclusive: policy === "exclusive" || workflows.some((w) => !!w.handoffBranch || w.concurrency === "exclusive"), sharedWorkspace: policy === "parallel" && !workflows.some((w) => w.concurrency === "independent"), tasks: new Set(tasks.map((t) => t.id)), workflows: new Set(workflows.map((w) => w.id)), directories: [], repositories: /* @__PURE__ */ new Set() };
  if (workspace) {
    result.workspace = workspace;
    result.sharedWorkspace = false;
    result.directories.push(physicalPath(workspace.directory));
  }
  for (const item of [...workflows.flatMap((w) => w.steps).filter((s) => s.stepKind === "code"), ...tasks]) {
    if (item.branch || workflow.handoffBranch) result.exclusive = true;
    if (item.interactiveTerminal || item.taskKind === void 0 && item.stepKind !== "code" && settings.defaultInteractiveTerminal) result.exclusive = true;
    if (item.stepKind === "code" || item.taskKind === "code") {
      if (!workspace && (item.codeAllowVault || item.codeAllowFiles || item.codeAllowTerminal)) result.directories.push(physicalPath(vault));
      if (!workspace && !result.sharedWorkspace && (item.codeAllowVault || item.codeAllowFiles || item.codeAllowTerminal)) result.exclusive = true;
      continue;
    }
    const directory2 = physicalPath(item.workingDirectory || settings.workingDirectory || vault);
    result.directories.push(directory2);
    let parent = directory2, gitRoot;
    for (; ; ) {
      if (fs10.existsSync(path10.join(parent, ".git"))) {
        gitRoot = parent;
        break;
      }
      const next = path10.dirname(parent);
      if (next === parent) break;
      parent = next;
    }
    if (gitRoot) {
      const common = (0, import_child_process3.execFileSync)("git", ["-c", `safe.directory=${gitRoot.replace(/\\/g, "/")}`, "rev-parse", "--git-common-dir"], { cwd: gitRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true }).trim();
      result.repositories.add(physicalPath(path10.resolve(gitRoot, common)));
    }
  }
  if (!workspace && workflows.some((w) => w.steps.some((s) => s.transitionMode === "eval" || s.transitions?.some((t) => t.mode === "eval")))) {
    result.directories.push(physicalPath(vault));
    if (!result.sharedWorkspace) result.exclusive = true;
  }
  return result;
}
function canShareWorkspace(a, b) {
  return !a.exclusive && !b.exclusive && a.sharedWorkspace && b.sharedWorkspace;
}
var coordinators = /* @__PURE__ */ new WeakMap();
function executionCoordinator(lease) {
  let value = coordinators.get(lease);
  if (!value) {
    value = new ExecutionCoordinator(lease);
    coordinators.set(lease, value);
  }
  return value;
}
var ExecutionAdmission = class {
  constructor(coordinator, definition, resources2, vault) {
    this.coordinator = coordinator;
    this.definition = definition;
    this.resources = resources2;
    this.vault = vault;
    this.advancing = true;
    this.confirmedTerminal = false;
  }
  assertOwned(lease, definition) {
    this.coordinator.assertOwned(this, lease);
    if (this.definition.hash !== definition.hash) throw new Error("Admission definition changed");
    const current = resources(definition, this.vault, this.resources.workspace);
    if (JSON.stringify(current.directories) !== JSON.stringify(this.resources.directories) || JSON.stringify([...current.repositories]) !== JSON.stringify([...this.resources.repositories])) throw new Error("Execution resource identity changed; reservation retained");
  }
  bind(checkpoint) {
    this.assertOwned(this.coordinator.lease, this.definition);
    if (checkpoint.workflowId !== this.definition.workflow.id || checkpoint.definitionHash !== this.definition.hash || this.runId && this.runId !== checkpoint.runId) throw new Error("Admission checkpoint identity changed");
    this.runId = checkpoint.runId;
  }
  knows(runId) {
    return this.coordinator.knows(runId);
  }
  permitsPending(checkpoint) {
    return this.coordinator.permitsPending(this, checkpoint);
  }
  confirm(checkpoint) {
    this.bind(checkpoint);
    this.confirmedTerminal = ["completed", "failed", "abandoned"].includes(checkpoint.phase) && !checkpointUncertainties(checkpoint).length;
  }
  finish() {
    this.coordinator.finish(this);
  }
};
var ExecutionCoordinator = class {
  constructor(lease) {
    this.lease = lease;
    this.sessions = /* @__PURE__ */ new Set();
  }
  assertOwned(session, lease) {
    lease.assertOwned();
    if (lease !== this.lease || !this.sessions.has(session) || !session.advancing) throw new Error("Execution admission is not owned");
  }
  knows(runId) {
    return [...this.sessions].some((s) => s.runId === runId && s.advancing);
  }
  permitsPending(admission, checkpoint) {
    this.assertOwned(admission, this.lease);
    const known = [...this.sessions].find((s) => s.runId === checkpoint.runId && s.definition.workflow.id === checkpoint.workflowId && s.definition.hash === checkpoint.definitionHash);
    if (!known) return false;
    if (known.advancing) return true;
    return canShareWorkspace(admission.resources, known.resources) && ![...admission.resources.workflows].some((id) => known.resources.workflows.has(id)) && ![...admission.resources.tasks].some((id) => known.resources.tasks.has(id));
  }
  admit(definition, vault, resumeRunId, workspace) {
    this.lease.assertOwned();
    const requested = resources(definition, vault, workspace);
    for (const session2 of this.sessions) {
      if (session2.advancing || !session2.runId) continue;
      try {
        const state = readExecutionCheckpoint(this.lease.directory, session2.runId);
        if (state.workflowId === session2.definition.workflow.id && state.definitionHash === session2.definition.hash && (state.disposition || state.phase === "abandoned")) this.sessions.delete(session2);
      } catch {
      }
    }
    const previous = [...this.sessions].find((s) => s.runId === resumeRunId && !!resumeRunId);
    if (previous && !previous.advancing && previous.definition.hash === definition.hash) {
      previous.advancing = true;
      previous.confirmedTerminal = false;
      return previous;
    }
    for (const current of this.sessions) {
      if ([...requested.workflows].some((id) => current.resources.workflows.has(id)) || [...requested.tasks].some((id) => current.resources.tasks.has(id))) throw new Error("A shared workflow is already executing; definition or referenced task is reserved");
      if (!current.advancing && !canShareWorkspace(requested, current.resources)) throw new Error("Execution outcome requires continuation or reconciliation; reservation retained");
      if (requested.exclusive || current.resources.exclusive) throw new Error("Exclusive execution must finish before shared execution");
      const overlaps = requested.directories.some((a) => current.resources.directories.some((b) => isWithinPhysicalPath(a, b) || isWithinPhysicalPath(b, a)));
      const sharesRepository = [...requested.repositories].some((a) => [...current.resources.repositories].some((b) => samePhysicalPath(a, b)));
      const separateWorktrees = (overlaps || sharesRepository) && requested.workspace && current.resources.workspace && independentGitWorkspaces(requested.workspace.directory, current.resources.workspace.directory);
      if (!canShareWorkspace(requested, current.resources) && !separateWorktrees && (overlaps || sharesRepository)) throw new Error("Execution resource is occupied (workspace or Git repository)");
    }
    const limit = concurrencySettings(definition.admissionSettings || {}).maxConcurrentExecutions;
    if (limit > 0 && this.sessions.size >= limit) throw new Error(`Concurrent execution limit reached (${limit})`);
    const session = new ExecutionAdmission(this, definition, requested, vault);
    this.sessions.add(session);
    return session;
  }
  finish(session) {
    session.advancing = false;
    if (!session.runId || session.confirmedTerminal) this.sessions.delete(session);
  }
};

// work-pages.ts
var fs11 = __toESM(require("fs"));
var path12 = __toESM(require("path"));
var import_crypto10 = require("crypto");
var import_child_process4 = require("child_process");

// catalog-transaction.ts
var path11 = __toESM(require("path"));
var tails = /* @__PURE__ */ new Map();
var owners = /* @__PURE__ */ new WeakMap();
function catalogTransaction(file, operation, transaction) {
  const key = path11.join(physicalPath(path11.dirname(file)), path11.basename(file));
  if (transaction) {
    const current = owners.get(transaction);
    if (!current?.active || current.key !== key) return Promise.reject(new Error("Invalid or expired catalog transaction"));
    return operation(transaction);
  }
  const result = (tails.get(key) || Promise.resolve()).then(async () => {
    const state = { key, active: true };
    const owner = Object.freeze({});
    owners.set(owner, state);
    try {
      return await operation(owner);
    } finally {
      state.active = false;
    }
  });
  const tail = result.then(() => {
  }, () => {
  });
  tails.set(key, tail);
  void tail.then(() => {
    if (tails.get(key) === tail) tails.delete(key);
  });
  return result;
}

// work-pages.ts
var WORKTREE_FOLDER = ".autooc/worktrees";
var WORKTREE_IGNORE = "/.autooc/worktrees/";
function validateWorkPages(settings) {
  if (settings.worktreesEnabled !== void 0 && typeof settings.worktreesEnabled !== "boolean") throw new Error("Invalid worktree preference");
  if (settings.workPages !== void 0 && !Array.isArray(settings.workPages)) throw new Error("Invalid work pages; existing data has been preserved");
  const ids = /* @__PURE__ */ new Set();
  for (const page of settings.workPages || []) {
    if (!page || !/^[a-zA-Z0-9-]{1,80}$/.test(page.id) || ["main", "general"].includes(page.id) || ids.has(page.id) || typeof page.name !== "string" || !page.name.trim() || typeof page.objective !== "string" || typeof page.directory !== "string" || !path12.isAbsolute(page.directory) || !["folder", "worktree"].includes(page.kind) || !Array.isArray(page.workflowIds) || !Array.isArray(page.taskIds) || [...page.workflowIds, ...page.taskIds].some((id) => typeof id !== "string" || !id)) {
      throw new Error("Invalid work page; existing data has been preserved");
    }
    ids.add(page.id);
    if (page.requirementId !== void 0 && (typeof page.requirementId !== "string" || !page.requirementId.trim() || page.requirementId.length > 200) || page.requirementFile !== void 0 && (!page.requirementId || page.requirementFile?.path !== ".autooc/requirement.md" || !/^[a-f0-9]{64}$/.test(page.requirementFile?.sha256))) throw new Error("Invalid page requirement metadata");
    const removal = page.worktreeRemoval;
    if (removal && (removal.mode !== void 0 && removal.mode !== "discard" || removal.mode === "discard" && (!removal.proof?.discard || !/^[a-f0-9]{64}$/.test(removal.proof.discard.treeHash) || !/^[a-f0-9]{40,64}$/.test(removal.proof.discard.comparisonBase)) || removal.mode !== "discard" && removal.proof?.discard !== void 0)) throw new Error("Invalid discard evidence; existing data has been preserved");
    if (removal !== void 0 && (!removal || page.kind !== "worktree" || page.archived !== true || !["pending", "removed"].includes(removal.status) || typeof removal.token !== "string" || !/^[a-f0-9-]{36}$/.test(removal.token) || typeof removal.ownerToken !== "string" || !/^[a-f0-9-]{36}$/.test(removal.ownerToken) || typeof removal.requestedAt !== "string" || !Number.isFinite(Date.parse(removal.requestedAt)) || removal.status === "removed" && (typeof removal.completedAt !== "string" || !Number.isFinite(Date.parse(removal.completedAt))) || !removal.proof || ["directory", "repository", "commonDirectory", "gitDirectory"].some((key) => typeof removal.proof[key] !== "string" || !path12.isAbsolute(removal.proof[key])) || ["branch", "head", "directoryIdentity", "gitIdentity"].some((key) => typeof removal.proof[key] !== "string" || !removal.proof[key]) || removal.proof.directory !== page.directory || removal.proof.repository !== page.repository || removal.proof.branch !== page.branch)) {
      throw new Error("Invalid worktree removal evidence; existing data has been preserved");
    }
  }
  for (const key of ["pageRuns", "pageTerminalClaims", "worktreeNoticeDismissed"]) {
    if (settings[key] !== void 0 && !Array.isArray(settings[key])) throw new Error("Invalid " + key + "; existing data has been preserved");
  }
  if (settings.worktreeNoticeDismissed?.some((key) => typeof key !== "string" || !key)) throw new Error("Invalid worktree notice preferences");
  if (settings.pageTerminalClaims?.some((claim) => !claim || typeof claim.id !== "string" || !claim.id || typeof claim.pageId !== "string" || typeof claim.directory !== "string" || !path12.isAbsolute(claim.directory) || typeof claim.createdAt !== "string" || claim.exclusive !== void 0 && typeof claim.exclusive !== "boolean")) throw new Error("Invalid page terminal reservations; existing data has been preserved");
  if (settings.pageRuns?.some((run2) => !run2 || typeof run2.runId !== "string" || !/^[a-f0-9-]+$/.test(run2.runId) || typeof run2.pageId !== "string" || typeof run2.sourceId !== "string" || typeof run2.task !== "boolean" || typeof run2.workflowId !== "string" || typeof run2.name !== "string" || typeof run2.createdAt !== "string" || typeof run2.uncertain !== "boolean" || !Number.isSafeInteger(run2.revision) || run2.revision < 0 || !["ready", "in_flight", "completed", "failed", "abandoned"].includes(run2.phase))) throw new Error("Invalid page history; existing data has been preserved");
}
function selectWorkPage(settings, id) {
  validateWorkPages(settings);
  const matches = (settings.workPages || []).filter((page) => page.id === id);
  if (matches.length !== 1) throw new Error("Work page is missing or ambiguous");
  return matches[0];
}
async function registerWorkPage(settings, page, save) {
  validateWorkPages(settings);
  validateWorkPages({ workPages: [page] });
  const previous = settings.workPages, existing = previous?.find((item) => item.id === page.id);
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(page)) throw new Error("Page ID already exists with different settings");
    return;
  }
  if (previous?.some((item) => physicalPath(item.directory) === physicalPath(page.directory))) throw new Error("Another page already uses this folder");
  const next = [...previous || [], page];
  settings.workPages = next;
  try {
    await save();
  } catch (error) {
    if (settings.workPages === next) settings.workPages = previous;
    throw error;
  }
}
function pageExecutionId(pageId, sourceId, task = false) {
  return "@page:" + pageId + ":" + (task ? "task:" : "workflow:") + sourceId;
}
function normalizePageSelection(id) {
  if (id === void 0 || id === "main") return void 0;
  if (typeof id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(id) || id === "general") throw new Error("Invalid page ID; use pages --vault to list workspaces. Overview cannot execute work.");
  return id;
}
function summarizeWorkPages(settings, vault) {
  validateWorkPages(settings);
  return [
    { id: "main", name: "Main workspace", directory: settings.workingDirectory?.trim() || vault, kind: "main", archived: false },
    ...(settings.workPages || []).map(({ id, name, directory: directory2, kind, branch, archived, worktreeRemoval, requirementId, requirementFile }) => ({ id, name, directory: directory2, kind, branch, archived: !!archived, ...worktreeRemoval ? { worktreeRemoval: worktreeRemoval.status } : {}, ...requirementId ? { requirementId, requirementFile: requirementFile?.path } : {} }))
  ];
}
function directoriesOverlap(a, b) {
  return isWithinPhysicalPath(a, b) || isWithinPhysicalPath(b, a);
}
function assertNoPageTerminal(settings, directory2, scopedWorkspace = false) {
  for (const claim of settings.pageTerminalClaims || []) {
    if (!claim || typeof claim.directory !== "string") throw new Error("Invalid terminal reservation; review existing sessions");
    if (claim.exclusive) throw new Error("An exclusive page terminal reserves execution. Close its session before starting another writer.");
    if (directoriesOverlap(claim.directory, directory2) && !(scopedWorkspace && independentGitWorkspaces(claim.directory, directory2))) throw new Error("A page terminal reserves this folder. Close the session and confirm its completion in the page before starting another writer.");
  }
}
function gitIn(directory2, args) {
  return new Promise((resolve11, reject) => (0, import_child_process4.execFile)(
    "git",
    ["-c", "safe.directory=" + directory2.replace(/\\/g, "/"), ...args],
    { cwd: directory2, encoding: "utf8", windowsHide: true, timeout: 3e4, maxBuffer: 4 * 1024 * 1024 },
    (error, stdout, stderr) => error ? reject(Object.assign(new Error("Git: " + String(stderr || error.message).trim()), { gitExitCode: error.code })) : resolve11(stdout.trim())
  ));
}
function regularPath(root, relative7) {
  let current = root;
  for (const part of relative7.split("/")) {
    current = path12.join(current, part);
    try {
      if (fs11.lstatSync(current).isSymbolicLink()) throw new Error("Worktree preparation cannot follow symbolic links");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}
async function inspectWorktreePreparation(project) {
  const repository = physicalPath(await gitIn(physicalPath(project), ["rev-parse", "--show-toplevel"]));
  regularPath(repository, WORKTREE_FOLDER);
  regularPath(repository, ".gitignore");
  const ignoreFile = path12.join(repository, ".gitignore");
  if (fs11.existsSync(ignoreFile) && !fs11.statSync(ignoreFile).isFile()) throw new Error(".gitignore is not a regular file");
  if ((await gitIn(repository, ["ls-files", "--", WORKTREE_FOLDER])).length) throw new Error("The worktree folder contains tracked files. .gitignore cannot untrack them; review the location first.");
  let excluded = false;
  try {
    excluded = !!await gitIn(repository, ["check-ignore", "--no-index", "--", WORKTREE_FOLDER + "/autooc-probe"]);
  } catch (error) {
    if (error.gitExitCode !== 1) throw error;
  }
  const directory2 = path12.join(repository, WORKTREE_FOLDER);
  return { repository, ignoreFile, directory: directory2, excluded, preferenceKey: repository + "\n" + directory2 + "\n" + WORKTREE_IGNORE };
}
async function prepareWorktreeIgnore(observed) {
  return catalogTransaction(observed.ignoreFile, async () => {
    const current = await inspectWorktreePreparation(observed.repository);
    if (current.preferenceKey !== observed.preferenceKey) throw new Error("Worktree location changed; review it again");
    if (current.excluded) return current;
    const exists = fs11.existsSync(current.ignoreFile);
    const before = exists ? fs11.readFileSync(current.ignoreFile) : Buffer.alloc(0);
    const text2 = before.toString("utf8"), newline = text2.includes("\r\n") ? "\r\n" : "\n";
    const addition = (before.length && !text2.endsWith("\n") ? newline : "") + WORKTREE_IGNORE + newline;
    const temporary = current.ignoreFile + ".autooc-" + (0, import_crypto10.randomUUID)() + ".tmp";
    const bytes = Buffer.concat([before, Buffer.from(addition, "utf8")]);
    fs11.writeFileSync(temporary, bytes, { flag: "wx", mode: exists ? fs11.statSync(current.ignoreFile).mode : 384 });
    regularPath(current.repository, ".gitignore");
    if (exists !== fs11.existsSync(current.ignoreFile) || exists && !fs11.readFileSync(current.ignoreFile).equals(before)) {
      throw new Error(".gitignore changed during preparation; original edits and the prepared temporary file were preserved. Review and retry.");
    }
    if (exists) fs11.renameSync(temporary, current.ignoreFile);
    else {
      fs11.writeFileSync(current.ignoreFile, bytes, { flag: "wx", mode: 384 });
      fs11.unlinkSync(temporary);
    }
    const verified = await inspectWorktreePreparation(current.repository);
    if (!verified.excluded) throw new Error("Worktree folder is not effectively ignored; no worktree was created");
    return verified;
  });
}
async function createPageWorktree(prepared, pageId, branch, base) {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(pageId) || !branch.trim() || !base.trim()) throw new Error("A page ID, branch and base are required");
  return catalogTransaction(path12.join(prepared.repository, ".autooc-worktree-preparation"), async () => {
    const verified = await inspectWorktreePreparation(prepared.repository);
    if (!verified.excluded || verified.preferenceKey !== prepared.preferenceKey) throw new Error("Prepare the worktree location first");
    await gitIn(verified.repository, ["check-ref-format", "--branch", branch]);
    const baseCommit = await gitIn(verified.repository, ["rev-parse", "--verify", "--end-of-options", base + "^{commit}"]);
    regularPath(verified.repository, WORKTREE_FOLDER);
    fs11.mkdirSync(verified.directory, { recursive: true });
    const directory2 = path12.join(verified.directory, pageId);
    if (fs11.existsSync(directory2)) throw new Error("Page folder already exists; link it instead");
    await gitIn(verified.repository, ["worktree", "add", "-b", branch, "--", directory2, baseCommit]);
    return { kind: "worktree", directory: physicalPath(directory2), repository: verified.repository, branch, baseCommit };
  });
}
async function describePageFolder(directory2, worktree) {
  if (!path12.isAbsolute(directory2)) throw new Error("Choose an absolute folder path");
  const resolved = physicalPath(directory2);
  if (!fs11.statSync(resolved).isDirectory()) throw new Error("The selected path is not a folder");
  if (!worktree) return { directory: resolved, kind: "folder" };
  const top = physicalPath(await gitIn(resolved, ["rev-parse", "--show-toplevel"]));
  if (top !== resolved || !fs11.statSync(path12.join(top, ".git")).isFile()) throw new Error("Select the root of an existing linked worktree");
  const common = physicalPath(path12.resolve(top, await gitIn(top, ["rev-parse", "--git-common-dir"])));
  const branch = await gitIn(top, ["branch", "--show-current"]);
  if (!branch) throw new Error("The worktree must have an attached branch");
  const primary = (await gitIn(top, ["worktree", "list", "--porcelain", "-z"])).split("\0").find((field) => field.startsWith("worktree "));
  if (!primary) throw new Error("The worktree repository is unavailable");
  const repository = physicalPath(primary.slice(9));
  if (physicalPath(path12.resolve(repository, await gitIn(repository, ["rev-parse", "--git-common-dir"]))) !== common) throw new Error("The worktree repository changed; review it again");
  return { kind: "worktree", directory: resolved, repository, branch };
}
async function verifyWorkPageEnvironment(page) {
  if (physicalPath(page.directory) !== page.directory || !fs11.statSync(page.directory).isDirectory()) throw new Error("Page folder is unavailable or changed");
  if (page.requirementFile) {
    validateWorkPages({ workPages: [page] });
    regularPath(page.directory, ".autooc/requirement.md");
    const file = path12.join(page.directory, page.requirementFile.path), stat = fs11.lstatSync(file);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 16e4 || (0, import_crypto10.createHash)("sha256").update(fs11.readFileSync(file)).digest("hex") !== page.requirementFile.sha256) throw new Error("Page requirement snapshot changed; preserve its original contents before running");
  }
  if (page.kind !== "worktree") return;
  if (!page.repository || !page.branch) throw new Error("Worktree identity is incomplete");
  const top = physicalPath(await gitIn(page.directory, ["rev-parse", "--show-toplevel"]));
  if (top !== page.directory || !fs11.lstatSync(path12.join(top, ".git")).isFile()) throw new Error("Page is no longer the root of a linked worktree");
  const common = physicalPath(path12.resolve(page.directory, await gitIn(page.directory, ["rev-parse", "--git-common-dir"])));
  const expected = physicalPath(path12.resolve(page.repository, await gitIn(page.repository, ["rev-parse", "--git-common-dir"])));
  if (common !== expected || await gitIn(page.directory, ["branch", "--show-current"]) !== page.branch) throw new Error("Page repository or branch changed; review its environment before continuing");
}
function pageIdentityHash(page) {
  const identity2 = [page.id, physicalPath(page.directory), page.kind, page.repository, page.branch];
  if (page.requirementId !== void 0 || page.requirementFile !== void 0) identity2.push({ requirementId: page.requirementId, requirementFile: page.requirementFile });
  return (0, import_crypto10.createHash)("sha256").update(JSON.stringify(identity2)).digest("hex");
}

// page-creation.ts
var fs12 = __toESM(require("fs"));
var path13 = __toESM(require("path"));
var import_crypto11 = require("crypto");
var requestId = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/;
var hash = (text2) => (0, import_crypto11.createHash)("sha256").update(text2).digest("hex");
var ownKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every((key) => keys.includes(key));
var text = (value, max, empty = false) => typeof value === "string" && value.length <= max && !value.includes("\0") && (empty || !!value.trim());
function validPageCreationRequest(value) {
  if (!ownKeys(value, ["requestId", "name", "objective", "requirementId", "requirementText", "mode", "repository", "branch", "base", "directory", "allowGitignoreUpdate", "launch"]) || typeof value.requestId !== "string" || !requestId.test(value.requestId) || !text(value.name, 200) || !["create", "link", "folder"].includes(value.mode) || value.objective !== void 0 && !text(value.objective, 16e3, true) || value.requirementId !== void 0 && !text(value.requirementId, 200) || value.requirementText !== void 0 && (!text(value.requirementText, 4e4) || !value.requirementId) || value.allowGitignoreUpdate !== void 0 && typeof value.allowGitignoreUpdate !== "boolean") return false;
  const absolute = (v) => text(v, 4096) && path13.isAbsolute(v) && !/[\r\n]/.test(v);
  if (value.mode === "create") {
    if (!absolute(value.repository) || !text(value.branch, 240) || !text(value.base, 240) || value.directory !== void 0 || /[\r\n]/.test(value.branch + value.base) || value.branch.startsWith("-") || value.base.startsWith("-")) return false;
  } else if (!absolute(value.directory) || value.repository !== void 0 || value.branch !== void 0 || value.base !== void 0 || value.allowGitignoreUpdate === true) return false;
  if (value.launch !== void 0 && (!ownKeys(value.launch, ["workflowId", "taskId"]) || !(text(value.launch.workflowId, 256) && value.launch.taskId === void 0 || text(value.launch.taskId, 256) && value.launch.workflowId === void 0))) return false;
  if (value.launch && /[\r\n]/.test(value.launch.workflowId || value.launch.taskId)) return false;
  return Buffer.byteLength(JSON.stringify(value), "utf8") <= 6e4;
}
function readPageCreationRequest(file) {
  if (!path13.isAbsolute(file)) throw new Error("Page request requires an absolute JSON file");
  const value = readJSON(file, 6e4);
  if (!validPageCreationRequest(value)) throw new Error("Invalid page creation request; inspect help for supported fields");
  return value;
}
function readJSON(file, max = 2e5) {
  const stat = fs12.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > max) throw new Error("Unsafe page request file");
  try {
    return JSON.parse(fs12.readFileSync(file, "utf8"));
  } catch {
    throw new Error("Invalid page request JSON");
  }
}
function directory(runtime, create = false) {
  const target = path13.join(runtime, "page-requests");
  if (create && !fs12.existsSync(target)) fs12.mkdirSync(target, { mode: 448 });
  if (fs12.existsSync(target)) {
    const stat = fs12.lstatSync(target);
    if (stat.isSymbolicLink() || !stat.isDirectory() || physicalPath(target) !== target) throw new Error("Unsafe page request directory");
  }
  return target;
}
function fileFor(runtime, id, create = false) {
  if (!requestId.test(id)) throw new Error("Invalid page request ID");
  return path13.join(directory(runtime, create), hash(id) + ".json");
}
function readRecord(file) {
  const value = readJSON(file);
  if (value?.schemaVersion !== 1 || !validPageCreationRequest(value.request) || value.requestId !== value.request.requestId || value.requestHash !== hash(JSON.stringify(normalize(value.request))) || !/^[a-f0-9-]{36}$/.test(value.pageId) || !/^[a-f0-9-]{36}$/.test(value.owner) || !Array.isArray(value.waitForRuns) || value.waitForRuns.some((id) => !text(id, 256) || !/^[a-f0-9-]+$/.test(id)) || !["queued", "preparing", "environment", "created", "launching", "completed", "blocked", "needs-review"].includes(value.stage)) throw new Error("Invalid durable page request; evidence preserved");
  if (value.page) {
    validateWorkPages({ workPages: [value.page] });
    if (value.page.id !== value.pageId) throw new Error("Page request identity changed");
  }
  return value;
}
function normalize(value) {
  return {
    requestId: value.requestId,
    name: value.name.trim(),
    objective: value.objective || "",
    requirementId: value.requirementId,
    requirementText: value.requirementText,
    mode: value.mode,
    repository: value.repository,
    branch: value.branch,
    base: value.base,
    directory: value.directory,
    allowGitignoreUpdate: value.allowGitignoreUpdate === true,
    launch: value.launch ? { workflowId: value.launch.workflowId, taskId: value.launch.taskId } : void 0
  };
}
function summary(record2) {
  return {
    requestId: record2.requestId,
    pageId: record2.pageId,
    status: record2.stage,
    created: record2.registered === true,
    requirementId: record2.request.requirementId,
    directory: record2.page?.directory,
    branch: record2.page?.branch,
    baseCommit: record2.page?.baseCommit,
    requirementFile: record2.page?.requirementFile?.path,
    errorCode: record2.errorCode,
    launchRunId: record2.launchRunId,
    launchPhase: record2.launchPhase,
    waitForRuns: record2.waitForRuns
  };
}
function inspectPageCreation(runtime, id) {
  return summary(readRecord(fileFor(runtime, id)));
}
function createPageCreationService(host) {
  host.lease.assertOwned();
  if (physicalPath(host.lease.directory) !== physicalPath(host.location.runtimeDirectory)) throw new Error("Page creation lease belongs to another installation");
  const pending = /* @__PURE__ */ new Set();
  let active, activeFile, closed = false;
  const controller = new AbortController();
  const assertOpen = () => {
    if (closed) throw new Error("Page creation host is closed");
    host.assertOpen();
    host.lease.assertOwned();
  };
  const save = async (file, record2) => {
    host.lease.assertOwned();
    directory(host.lease.directory);
    await atomicSettingsWrite(file, record2);
  };
  async function submit(value) {
    assertOpen();
    if (!validPageCreationRequest(value)) throw new Error("Invalid page creation request");
    const request = normalize(value), requestHash = hash(JSON.stringify(request));
    const file = fileFor(host.lease.directory, request.requestId, true);
    if (activeFile === file) {
      const current = readRecord(file);
      if (current.requestHash !== requestHash) throw new Error("Page request ID already used with different parameters");
      return summary(current);
    }
    return catalogTransaction(file, async () => {
      assertOpen();
      if (fs12.existsSync(file)) {
        const previous = readRecord(file);
        if (previous.requestHash !== requestHash) throw new Error("Page request ID already used with different parameters");
        if (previous.owner !== host.lease.token && ["preparing", "launching"].includes(previous.stage)) {
          previous.stage = "needs-review";
          previous.errorCode = "OPERATION_OUTCOME_UNCERTAIN";
          await save(file, previous);
        }
        if (["queued", "environment", "created"].includes(previous.stage) && !(previous.stage === "created" && !request.launch)) {
          previous.owner = host.lease.token;
          await save(file, previous);
          pending.add(file);
        }
        return summary(previous);
      }
      const waitForRuns = host.activeRuns();
      for (const id of waitForRuns) readExecutionCheckpoint(host.lease.directory, id);
      const record2 = {
        schemaVersion: 1,
        requestId: request.requestId,
        requestHash,
        pageId: (0, import_crypto11.randomUUID)(),
        owner: host.lease.token,
        request,
        stage: "queued",
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        waitForRuns
      };
      await save(file, record2);
      pending.add(file);
      return summary(record2);
    });
  }
  async function perform(file) {
    const record2 = readRecord(file), request = record2.request;
    if (record2.owner !== host.lease.token) throw new Error("Page request belongs to another owner");
    for (const id of record2.waitForRuns) {
      const parent = readExecutionCheckpoint(host.lease.directory, id);
      if (parent.phase !== "completed" || checkpointUncertainties(parent).length) {
        record2.stage = "blocked";
        record2.errorCode = "PARENT_NOT_COMPLETED";
        await save(file, record2);
        pending.delete(file);
        return;
      }
    }
    let release;
    try {
      assertOpen();
      release = host.reserve();
      let config = await host.catalog();
      validateWorkPages(config);
      if (request.mode !== "folder" && config.worktreesEnabled !== true) throw new PageCreationError("WORKTREES_DISABLED");
      if (request.launch) {
        const entries = request.launch.taskId ? config.tasks : config.workflows;
        const id = request.launch.taskId || request.launch.workflowId;
        if (!Array.isArray(entries) || entries.filter((item) => item.id === id).length !== 1 || entries.find((item) => item.id === id).disabled) throw new PageCreationError("LAUNCH_UNAVAILABLE");
      }
      if (record2.stage === "queued") {
        let preparation;
        let environment;
        if (request.mode === "create") {
          preparation = await inspectWorktreePreparation(request.repository);
          await gitIn(preparation.repository, ["check-ref-format", "--branch", request.branch]);
          const base = await gitIn(preparation.repository, ["rev-parse", "--verify", "--end-of-options", request.base + "^{commit}"]);
          if ((await gitIn(preparation.repository, ["branch", "--list", request.branch])).trim() || fs12.existsSync(path13.join(preparation.directory, record2.pageId))) throw new PageCreationError("ENVIRONMENT_COLLISION");
          if (!preparation.excluded && !request.allowGitignoreUpdate && !config.worktreeNoticeDismissed?.includes(preparation.preferenceKey)) throw new PageCreationError("GITIGNORE_APPROVAL_REQUIRED");
          record2.stage = "preparing";
          await save(file, record2);
          assertOpen();
          if (!preparation.excluded) preparation = await prepareWorktreeIgnore(preparation);
          environment = await createPageWorktree(preparation, record2.pageId, request.branch, base);
        } else {
          environment = await describePageFolder(request.directory, request.mode === "link");
          record2.stage = "preparing";
          await save(file, record2);
        }
        if ((config.workPages || []).some((page) => physicalPath(page.directory) === environment.directory)) throw new PageCreationError("PAGE_DIRECTORY_IN_USE");
        record2.page = {
          id: record2.pageId,
          name: request.name,
          objective: request.objective || "",
          ...environment,
          workflowIds: [],
          taskIds: [],
          ...request.requirementId ? { requirementId: request.requirementId } : {}
        };
        record2.stage = "environment";
        await save(file, record2);
      }
      if (record2.stage === "environment") {
        assertOpen();
        await verifyWorkPageEnvironment(record2.page);
        if (request.requirementText !== void 0) {
          const relative7 = ".autooc/requirement.md", folder = path13.join(record2.page.directory, ".autooc"), target = path13.join(record2.page.directory, relative7);
          if (!fs12.existsSync(folder)) fs12.mkdirSync(folder);
          if (fs12.lstatSync(folder).isSymbolicLink() || !fs12.statSync(folder).isDirectory()) throw new PageCreationError("UNSAFE_REQUIREMENT_PATH");
          const digest = hash(request.requirementText);
          if (fs12.existsSync(target)) {
            const stat = fs12.lstatSync(target);
            if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 16e4 || hash(fs12.readFileSync(target, "utf8")) !== digest) throw new PageCreationError("REQUIREMENT_FILE_CONFLICT");
          } else {
            const fd = fs12.openSync(target, "wx", 384);
            try {
              fs12.writeFileSync(fd, request.requirementText);
              fs12.fsyncSync(fd);
            } finally {
              fs12.closeSync(fd);
            }
          }
          record2.page.requirementFile = { path: relative7, sha256: digest };
          await save(file, record2);
        }
        await verifyWorkPageEnvironment(record2.page);
        await host.register(record2.page);
        record2.registered = true;
        record2.stage = "created";
        record2.errorCode = void 0;
        await save(file, record2);
      }
      release();
      release = void 0;
      if (request.launch && record2.stage === "created") {
        assertOpen();
        record2.stage = "launching";
        await save(file, record2);
        const workflowId = pageExecutionId(record2.pageId, request.launch.taskId || request.launch.workflowId, !!request.launch.taskId);
        const state = await host.launch(request.launch, record2.pageId, controller.signal, async (state2) => {
          if (state2.workflowId !== workflowId || record2.launchRunId && record2.launchRunId !== state2.runId) throw new Error("Page launch identity changed");
          record2.launchRunId = state2.runId;
          record2.launchPhase = state2.phase;
          await save(file, record2);
        });
        if (state.workflowId !== workflowId || record2.launchRunId !== state.runId) throw new Error("Page launch was not durably observed");
        record2.launchPhase = state.phase;
        record2.stage = ["completed", "failed"].includes(state.phase) && !checkpointUncertainties(state).length ? "completed" : "needs-review";
        if (record2.stage === "needs-review") record2.errorCode = "LAUNCH_NOT_TERMINAL";
        await save(file, record2);
      }
      pending.delete(file);
    } catch (error) {
      record2.errorCode = error instanceof PageCreationError ? error.code : "PAGE_OPERATION_FAILED";
      if (record2.stage === "queued") record2.stage = "blocked";
      else if (record2.stage !== "environment" && record2.stage !== "created") record2.stage = "needs-review";
      await save(file, record2);
      pending.delete(file);
    } finally {
      release?.();
    }
  }
  async function poll() {
    if (closed || active || !pending.size || host.busy()) return;
    assertOpen();
    const file = pending.values().next().value;
    activeFile = file;
    active = Promise.resolve().then(() => catalogTransaction(file, () => perform(file))).finally(() => {
      active = void 0;
      activeFile = void 0;
    });
    void active.catch(() => {
    });
  }
  let failure;
  async function checkedPoll() {
    if (failure) throw failure;
    await poll();
    if (active) void active.catch((error) => {
      failure = error;
    });
  }
  return {
    submit,
    poll: checkedPoll,
    get hasPendingWork() {
      return !!active || !!failure;
    },
    close() {
      closed = true;
      controller.abort();
    },
    async drain() {
      await active;
      if (failure) throw failure;
    },
    async flush() {
      while (!closed && pending.size && !host.busy()) {
        await checkedPoll();
        await active;
        if (failure) throw failure;
      }
    }
  };
}
var PageCreationError = class extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
};
var pageCreationHelp = {
  create: "create-page --vault <absolute path> --request <absolute JSON file>",
  inspect: "inspect-page-request --vault <absolute path> --request-id <stable ID>",
  fields: "requestId, name, objective?, requirementId?, requirementText?, mode: create|link|folder; create requires repository/branch/base, others require directory; allowGitignoreUpdate defaults false; optional launch object selecting exactly one existing workflowId or taskId.",
  behavior: "With an active owner returns a durable queued receipt and reserved pageId; inspect until created before using --page. Optional launch runs once after current runs complete successfully and resources are idle. Without an owner runs in the foreground. No work is replayed after restart: inspect and resubmit the identical request only for queued/environment/created states. needs-review requires inspecting retained effects, never a new request as retry.",
  requirement: "Explicit requirementText is snapshotted at .autooc/requirement.md in the page and hash-checked before running; Code can read it with explicit vault permission. No implicit copy of uncommitted files.",
  preparation: `Worktrees must already be enabled. New worktrees live in ${WORKTREE_FOLDER}/<pageId>; adding ${WORKTREE_IGNORE} to .gitignore requires explicit request consent or that project's saved preference. Approval errors require a reviewed new request; no branch, staging or commit is changed implicitly.`
};

// cli-plugin-requests.ts
function executionSummary(state, presentation = state) {
  const { runId, workflowId, phase, revision, nextStepId } = state;
  return { runId, workflowId, phase, revision, nextStepId, ...presentationFields(presentation) };
}
var uuid2 = /^[a-f0-9-]{36}$/;
function regularDirectory2(directory2) {
  const stat = fs13.lstatSync(directory2);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs13.realpathSync(directory2) !== directory2) throw new Error("Unsafe CLI request directory");
}
function read(file) {
  const stat = fs13.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 65536) throw new Error("Unsafe CLI request file");
  return JSON.parse(fs13.readFileSync(file, "utf8"));
}
function write(file, value) {
  const fd = fs13.openSync(file, "wx", 384);
  try {
    fs13.writeFileSync(fd, JSON.stringify(value));
    fs13.fsyncSync(fd);
  } finally {
    fs13.closeSync(fd);
  }
}
async function replace(file, value, check, asyncFlush = true) {
  const temp = file + "." + (0, import_crypto12.randomUUID)() + ".tmp";
  check();
  const deadline = import_perf_hooks4.performance.now() + 2e3;
  let lastError;
  const bytes = JSON.stringify(value);
  let owned;
  const sameTemporary = () => {
    if (!owned || !fs13.existsSync(temp)) return false;
    const current = fs13.lstatSync(temp);
    return current.isFile() && !current.isSymbolicLink() && current.nlink === 1 && current.dev === owned.dev && current.ino === owned.ino;
  };
  try {
    const fd = fs13.openSync(temp, "wx", 384);
    try {
      owned = fs13.fstatSync(fd);
      fs13.writeFileSync(fd, bytes);
      if (asyncFlush) await new Promise((resolve11, reject) => fs13.fsync(fd, (error) => error ? reject(error) : resolve11()));
      else fs13.fsyncSync(fd);
    } finally {
      fs13.closeSync(fd);
    }
    for (let attempt = 0; ; attempt++) {
      if (attempt > 0 && import_perf_hooks4.performance.now() >= deadline) throw lastError;
      if (!sameTemporary() || fs13.readFileSync(temp, "utf8") !== bytes) throw new Error("CLI publication temporary identity changed");
      check();
      if (fs13.existsSync(file)) read(file);
      try {
        fs13.renameSync(temp, file);
        return;
      } catch (error) {
        lastError = error;
        if (!["EPERM", "EACCES", "EBUSY"].includes(error.code || "") || attempt >= 12 || import_perf_hooks4.performance.now() >= deadline) throw error;
        await new Promise((resolve11) => (0, import_timers3.setTimeout)(resolve11, Math.min(20 * (attempt + 1), 100)));
      }
    }
  } finally {
    if (sameTemporary() && fs13.statSync(temp).size === Buffer.byteLength(bytes) && fs13.readFileSync(temp, "utf8") === bytes) fs13.unlinkSync(temp);
  }
}
function validCommand(value) {
  if (value?.command === "create-page") return validPageCreationRequest(value.request) && ["workflowId", "taskId", "stepId", "pageId", "runId"].every((key) => value[key] === void 0);
  if (value?.command === "edit-workflow") return value.pageId === void 0 && validWorkflowEdit(value);
  try {
    if (value?.pageId !== void 0 && (normalizePageSelection(value.pageId) !== value.pageId || value.stepId !== void 0)) return false;
  } catch {
    return false;
  }
  const id = (v) => typeof v === "string" && v.length > 0 && v.length <= 256 && !/[\0\r\n]/.test(v);
  return value && ["run", "resume", "reconcile"].includes(value.command) && (id(value.workflowId) && value.taskId === void 0 || id(value.taskId) && value.workflowId === void 0) && (value.stepId === void 0 || id(value.stepId) && id(value.workflowId) && value.taskId === void 0) && (value.command === "run" ? value.runId === void 0 : typeof value.runId === "string" && value.runId.length <= 256 && /^[a-zA-Z0-9-]+$/.test(value.runId));
}
function createPluginRequestHost(lease, execute, edit, getConcurrency = () => ({}), capabilities = {}) {
  lease.assertOwned();
  const root = fs13.realpathSync(lease.directory), directory2 = path14.join(root, "cli-" + lease.token);
  fs13.mkdirSync(directory2, { mode: 448 });
  regularDirectory2(directory2);
  const descriptor = path14.join(directory2, "host");
  let heartbeatAt = Date.now();
  let publishedLimit = concurrencySettings(getConcurrency()).maxConcurrentExecutions;
  const hostDescriptor = () => ({ protocol: 1, owner: lease.token, pid: process.pid, heartbeatAt, requestInspection: 1, phaseTimings: 1, workflowEditing: !!edit, concurrentExecutions: publishedLimit, sharedWorkspaceConcurrency: true, codeStepSelection: true, nestedWorkflows: 1, ...capabilities.pageSelection ? { pageSelection: 1 } : {}, ...capabilities.pages ? { pageCreation: 1 } : {} });
  write(descriptor, hostDescriptor());
  let closed = false;
  let failure, polling, pagePolling;
  const active = /* @__PURE__ */ new Map();
  const seen = /* @__PURE__ */ new Set();
  const check = () => {
    regularDirectory2(directory2);
    lease.assertOwned();
  };
  const checkDescriptor = () => {
    check();
    const previous = read(descriptor);
    if (previous.protocol !== 1 || previous.owner !== lease.token || previous.pid !== process.pid) throw new Error("CLI host identity changed");
  };
  const receipt = (id, value) => {
    const file = path14.join(directory2, id + ".receipt");
    return replace(file, { protocol: 1, owner: lease.token, id, ...value }, () => {
      check();
      if (fs13.existsSync(file)) {
        const previous = read(file);
        if (previous.protocol !== 1 || previous.owner !== lease.token || previous.id !== id) throw new Error("CLI receipt identity changed");
      }
    });
  };
  const close = () => {
    if (closed) return;
    closed = true;
    for (const execution of active.values()) execution.controller.abort();
    capabilities.pages?.close();
    check();
    if (fs13.existsSync(descriptor)) {
      checkDescriptor();
      fs13.unlinkSync(descriptor);
    }
  };
  const fail = () => {
    failure ||= new Error("CLI receipt publication failed; inspect status and receipt; do not launch again");
    try {
      close();
    } catch {
    }
  };
  const pollOnce = async () => {
    if (closed) return;
    check();
    const nextLimit = concurrencySettings(getConcurrency()).maxConcurrentExecutions;
    if (Date.now() - heartbeatAt >= 1e3 || publishedLimit !== nextLimit) {
      heartbeatAt = Date.now();
      publishedLimit = nextLimit;
      try {
        await replace(descriptor, hostDescriptor(), () => {
          checkDescriptor();
          if (closed) throw new Error("CLI host is closed");
        });
      } catch (error) {
        if (closed) return;
        throw error;
      }
    }
    if (closed) return;
    for (const execution of active.values()) if (fs13.existsSync(path14.join(directory2, execution.id + ".cancel"))) {
      read(path14.join(directory2, execution.id + ".cancel"));
      execution.controller.abort();
    }
    for (const name of fs13.readdirSync(directory2)) {
      if (!name.endsWith(".request")) continue;
      const id = name.slice(0, -8);
      if (!uuid2.test(id)) continue;
      if (seen.has(id) || fs13.existsSync(path14.join(directory2, id + ".receipt"))) continue;
      seen.add(id);
      let request;
      try {
        request = read(path14.join(directory2, name));
      } catch {
        await receipt(id, { status: "rejected", error: "Invalid CLI request" });
        continue;
      }
      if (!request || request.protocol !== 1 || request.owner !== lease.token || request.id !== id || !validCommand(request) || !Number.isFinite(request.expiresAt) || request.expiresAt < Date.now() || request.expiresAt > Date.now() + 6e4 || fs13.existsSync(path14.join(directory2, id + ".cancel"))) {
        await receipt(id, { status: "rejected", error: "Expired, cancelled or invalid CLI request" });
        continue;
      }
      if (closed) return;
      if (request.command === "create-page" && !capabilities.pages) {
        await receipt(id, { status: "rejected", error: "Loaded AutoOC does not support page creation" });
        continue;
      }
      if (request.pageId && !capabilities.pageSelection) {
        await receipt(id, { status: "rejected", error: "Loaded AutoOC does not support page selection; reload the updated plugin." });
        continue;
      }
      const definition = JSON.stringify(request.command === "create-page" ? ["create-page", request.request.requestId] : [request.pageId || "main", request.taskId ? "task" : "workflow", request.taskId || request.workflowId]);
      const duplicate = [...active.values()].some((e) => e.definition === definition);
      const limit = concurrencySettings(getConcurrency()).maxConcurrentExecutions;
      const busy = duplicate && request.command !== "create-page" ? "AutoOC is already executing this CLI definition" : request.command !== "create-page" && limit > 0 && active.size >= limit ? `Concurrent execution limit reached (${limit})` : [...active.values()].some((e) => e.editing) || request.command === "edit-workflow" && active.size ? "Workflow editing requires exclusive execution" : void 0;
      if (busy) {
        await receipt(id, { status: "rejected", error: busy });
        continue;
      }
      const execution = { id, controller: new AbortController(), editing: request.command === "edit-workflow", definition, done: void 0 };
      active.set(id, execution);
      let checkpoint;
      const receivedAt = Date.now();
      const submittedAt = Number.isFinite(request.submittedAt) && request.submittedAt <= receivedAt && request.submittedAt >= request.expiresAt - 6e4 ? request.submittedAt : request.expiresAt - 3e4;
      const timing = { submittedAt, receivedAt, queueMs: Math.max(0, receivedAt - submittedAt) };
      const publish2 = (value) => receipt(id, { timing, ...value, updatedAt: Date.now() });
      const accepted = publish2({ status: "accepted" });
      execution.done = (async () => {
        let publications = Promise.resolve();
        let acceptingProgress = true;
        try {
          await accepted;
          if (closed) throw new Error("CLI host closed before execution");
          if (Date.now() >= request.expiresAt || fs13.existsSync(path14.join(directory2, id + ".cancel"))) {
            await publish2({ status: "rejected", error: "Expired or cancelled before execution" });
            return;
          }
          if (request.command === "create-page") {
            const result2 = await capabilities.pages.submit(request.request);
            await publish2({ status: "completed", pageResult: result2 });
            return;
          }
          if (request.command === "edit-workflow") {
            if (!edit) throw new Error("Workflow editing unsupported");
            const result2 = await edit(request);
            await publish2({ status: "completed", editResult: result2 });
            return;
          }
          const result = await withExecutionTiming(root, { requestId: id, runId: request.runId, queueMs: timing.queueMs }, (context) => execute(request, execution.controller.signal, (state, presentation) => {
            if (!acceptingProgress) return Promise.resolve();
            const next = executionSummary(state, presentation);
            checkpoint = next;
            bindTimingRun(next.runId, context);
            publications = publications.then(() => publish2({ status: "running", checkpoint: next }));
            void publications.catch(() => {
            });
            return publications;
          }, context));
          acceptingProgress = false;
          await publications;
          await publish2({ status: "completed", checkpoint: executionSummary(result) });
        } catch (error) {
          acceptingProgress = false;
          await publications.catch(() => {
          });
          try {
            await publish2({ status: "failed", checkpoint, error: request.command === "edit-workflow" ? "Workflow edit failed; keep Obsidian open and inspect this request" : executionAdmissionDiagnostic(error) || "Plugin execution or receipt publication failed; inspect the recorded request and run; do not launch again" });
          } catch {
            fail();
          }
        } finally {
          if (active.get(id) === execution) active.delete(id);
        }
      })();
      await accepted.catch(() => {
      });
    }
    if (!closed && capabilities.pages && !pagePolling) {
      pagePolling = capabilities.pages.poll().catch(() => {
        fail();
      }).finally(() => {
        pagePolling = void 0;
      });
    }
  };
  const poll = () => {
    if (failure) return Promise.reject(failure);
    if (polling) return polling;
    polling = pollOnce().catch(() => {
      fail();
      throw failure;
    }).finally(() => {
      polling = void 0;
    });
    return polling;
  };
  return { directory: directory2, poll, close, get hasPendingWork() {
    return !!polling || !!pagePolling || active.size > 0 || !!failure || !!capabilities.pages?.hasPendingWork;
  }, async drain() {
    await polling;
    await pagePolling;
    await Promise.all([...active.values()].map((e) => e.done));
    await capabilities.pages?.drain();
    if (failure) throw failure;
  } };
}
async function requestPluginExecution(runtime, command, signal, onProgress, onSubmitted) {
  return requestPluginCommand(runtime, command, signal, onProgress, onSubmitted);
}
async function requestPluginWorkflowEdit(runtime, command) {
  const result = await requestPluginCommand(runtime, command);
  if (!result) throw new Error("Enable AutoOC in Obsidian to edit workflows through its owner; do not edit data.json directly");
  return result;
}
async function requestPluginPageCreation(runtime, request) {
  return requestPluginCommand(runtime, { command: "create-page", request });
}
async function requestPluginCommand(runtime, command, signal, onProgress, onSubmitted) {
  if (!fs13.existsSync(path14.join(runtime, "execution.lock"))) return void 0;
  const root = fs13.realpathSync(runtime);
  regularDirectory2(root);
  const owner = readExecutionLeaseOwner(root), directory2 = path14.join(root, "cli-" + owner.token);
  if (!fs13.existsSync(directory2)) throw new Error("AutoOC execution is reserved; the owner does not support CLI requests. Inspect status before retrying");
  const waitDeadline = import_perf_hooks4.performance.now() + 24 * 60 * 60 * 1e3;
  const check = () => {
    regularDirectory2(directory2);
    const current = readExecutionLeaseOwner(root);
    if (current.token !== owner.token || current.pid !== owner.pid) throw new Error("CLI request owner changed");
    const host = read(path14.join(directory2, "host"));
    if (host.protocol !== 1 || host.owner !== owner.token || host.pid !== owner.pid) throw new Error("Invalid CLI request host");
    if (command.command === "create-page" && host.pageCreation !== 1) throw new Error("Loaded AutoOC does not support page creation; reload a compatible plugin");
    if (command.command === "edit-workflow" && host.workflowEditing !== true) throw new Error("Loaded AutoOC does not support workflow editing; reload the updated plugin once, keeping Obsidian open");
    if ("stepId" in command && command.stepId !== void 0 && host.codeStepSelection !== true) throw new Error("Loaded AutoOC does not support code step selection; reload the updated plugin before running this step");
    if ("pageId" in command && command.pageId !== void 0 && host.pageSelection !== 1) throw new Error("Loaded AutoOC does not support page selection; reload the updated plugin before running this page");
    if (host.heartbeatAt !== void 0) {
      if (!Number.isFinite(host.heartbeatAt) || host.heartbeatAt > Date.now() + 6e4 || Date.now() - host.heartbeatAt > 3e4)
        throw new Error("CLI host heartbeat expired; terminal publication is uncertain");
    }
    process.kill(owner.pid, 0);
  };
  check();
  if (signal?.aborted) throw new Error("CLI request cancelled before submission");
  const id = (0, import_crypto12.randomUUID)(), submittedAt = Date.now(), expiresAt = submittedAt + 3e4;
  const file = path14.join(directory2, id + ".request"), resultFile = path14.join(directory2, id + ".receipt");
  if (!validCommand(command)) throw new Error("Invalid CLI command");
  if (Buffer.byteLength(JSON.stringify(command), "utf8") > 6e4) throw new Error("Workflow edit payload exceeds 60KB; split the edit into smaller patches");
  try {
    await replace(file, { protocol: 1, owner: owner.token, id, submittedAt, expiresAt, ...command }, check, false);
  } catch {
    throw new PluginRequestError("CLI submission outcome is uncertain; inspect this requestId; do not launch again", id);
  }
  onSubmitted?.(id);
  let observedPresentation;
  let accepted = false, lastProgress = "", runId = "runId" in command ? command.runId : void 0;
  let outcome = "unknown";
  for (; ; ) {
    try {
      regularDirectory2(directory2);
      if (fs13.existsSync(resultFile)) {
        const result = read(resultFile);
        if (result.protocol !== 1 || result.owner !== owner.token || result.id !== id) throw new Error("CLI receipt identity changed");
        if (!["accepted", "running", "completed", "rejected", "failed"].includes(result.status)) throw new Error("Invalid CLI receipt status");
        if (result.status === "rejected") outcome = "not-accepted";
        const checkpoint = result.checkpoint;
        if (command.command === "create-page") {
          if (result.status === "completed") {
            if (result.pageResult?.requestId !== command.request.requestId || !/^[a-f0-9-]{36}$/.test(result.pageResult?.pageId) || typeof result.pageResult?.created !== "boolean") throw new Error("Invalid page creation receipt");
            return result.pageResult;
          }
          if (result.status === "rejected" || result.status === "failed") throw new Error(result.error);
        }
        if (command.command === "edit-workflow") {
          if (result.status === "completed") {
            if (result.editResult?.workflowId !== command.workflowId || !/^[a-f0-9]{64}$/.test(result.editResult?.definitionHash)) throw new Error("Invalid workflow edit receipt");
            return result.editResult;
          }
          if (result.status === "rejected" || result.status === "failed") throw new Error(result.error);
        }
        const expectedWorkflowId = "pageId" in command && command.pageId ? pageExecutionId(command.pageId, command.taskId || command.workflowId, !!command.taskId) : command.taskId ? "@task:" + command.taskId : command.workflowId;
        if (checkpoint && (typeof checkpoint.runId !== "string" || !/^[a-zA-Z0-9-]+$/.test(checkpoint.runId) || checkpoint.workflowId !== expectedWorkflowId || "runId" in command && command.runId && checkpoint.runId !== command.runId || !Number.isSafeInteger(checkpoint.revision) || checkpoint.revision < 0 || !["ready", "in_flight", "completed", "failed", "abandoned"].includes(checkpoint.phase) || !(checkpoint.nextStepId === null || typeof checkpoint.nextStepId === "string"))) throw new Error("Invalid CLI receipt checkpoint");
        if (checkpoint) {
          if (runId && checkpoint.runId !== runId) throw new Error("CLI receipt run identity changed");
          const metadata = presentationFields(checkpoint);
          const serializedMetadata = JSON.stringify(metadata);
          if (observedPresentation !== void 0 && serializedMetadata !== observedPresentation) throw new Error("CLI receipt presentation changed");
          observedPresentation = serializedMetadata;
          if (metadata.executionKind !== void 0 && metadata.executionKind !== (command.taskId ? "task" : "workflow")) throw new Error("CLI receipt execution kind mismatch");
          if (metadata.stepId !== ("stepId" in command ? command.stepId : void 0)) throw new Error("CLI receipt code step identity mismatch");
        }
        if (result.checkpoint) {
          runId = result.checkpoint.runId;
          const serialized = JSON.stringify(result.checkpoint);
          if (serialized !== lastProgress) {
            lastProgress = serialized;
            onProgress?.(executionSummary(result.checkpoint));
          }
        }
        if (result.status === "completed") {
          if (!checkpoint) throw new Error("Missing CLI result checkpoint");
          return executionSummary(checkpoint);
        }
        if (result.status === "rejected" || result.status === "failed") throw new Error(result.error);
        accepted = true;
      }
      if (signal?.aborted) {
        write(path14.join(directory2, id + ".cancel"), { id });
        throw new Error("CLI wait interrupted; cooperative cancellation requested");
      }
      check();
      if (import_perf_hooks4.performance.now() >= waitDeadline) throw new Error("CLI wait deadline reached; execution outcome is uncertain");
      if (!accepted && Date.now() > expiresAt) throw new Error("CLI request expired before acceptance");
    } catch (error) {
      const reason = error instanceof Error && !error.code ? error.message : "CLI request host is unavailable";
      throw new PluginRequestError(`${reason}. Request ${id}${runId ? `, run ${runId}` : ""}; inspect status and receipt using inspect-request or follow with this identity; do not launch again`, id, runId, outcome);
    }
    await new Promise((resolve11) => (0, import_timers3.setTimeout)(resolve11, 100));
  }
}
var PluginRequestError = class extends Error {
  constructor(message, requestId2, runId, state = "unknown") {
    super(message);
    this.requestId = requestId2;
    this.runId = runId;
    this.state = state;
    this.name = "PluginRequestError";
  }
};
function availableHost(root, directory2, owner) {
  try {
    const lease = readExecutionLeaseOwner(root), host = read(path14.join(directory2, "host"));
    if (lease.token !== owner || host.protocol !== 1 || host.owner !== owner || host.pid !== lease.pid || !Number.isFinite(host.heartbeatAt) || host.heartbeatAt > Date.now() + 6e4 || Date.now() - host.heartbeatAt > 3e4) return false;
    process.kill(lease.pid, 0);
    return true;
  } catch {
    return false;
  }
}
function inspectPluginRequest(runtime, selector) {
  if (!!selector.requestId === !!selector.runId || selector.requestId !== void 0 && !uuid2.test(selector.requestId) || selector.runId !== void 0 && !/^[a-zA-Z0-9-]{1,256}$/.test(selector.runId)) throw new Error("Select exactly one valid requestId or runId");
  const unknown = { state: "unknown", acceptance: "unknown", hostAvailable: false, ...selector.requestId ? { requestId: selector.requestId } : { runId: selector.runId } };
  if (!fs13.existsSync(runtime)) return unknown;
  const root = fs13.realpathSync(runtime);
  regularDirectory2(root);
  const matches = [];
  for (const name of fs13.readdirSync(root)) {
    if (!name.startsWith("cli-") || !uuid2.test(name.slice(4))) continue;
    const directory2 = path14.join(root, name), owner = name.slice(4);
    regularDirectory2(directory2);
    const names2 = selector.requestId ? [selector.requestId + ".request"] : fs13.readdirSync(directory2).filter((n) => n.endsWith(".receipt") && uuid2.test(n.slice(0, -8))).map((n) => n.slice(0, -8) + ".request");
    for (const file of names2) {
      const id = file.slice(0, -8), requestPath = path14.join(directory2, file), receiptPath = path14.join(directory2, id + ".receipt");
      if (!fs13.existsSync(requestPath)) {
        if (selector.requestId && fs13.existsSync(receiptPath)) throw new Error("CLI receipt has no matching request");
        continue;
      }
      const request = read(requestPath), receipt = fs13.existsSync(receiptPath) ? read(receiptPath) : void 0;
      if (request?.protocol !== 1 || request.owner !== owner || request.id !== id || !validCommand(request) || !Number.isFinite(request.expiresAt)) throw new Error("Invalid CLI request identity");
      if (receipt && (receipt.protocol !== 1 || receipt.owner !== owner || receipt.id !== id || !["accepted", "running", "completed", "rejected", "failed"].includes(receipt.status))) throw new Error("Invalid CLI receipt identity");
      const checkpoint = receipt?.checkpoint;
      if (checkpoint) {
        const workflowId = request.pageId ? pageExecutionId(request.pageId, request.taskId || request.workflowId, !!request.taskId) : request.taskId ? "@task:" + request.taskId : request.workflowId;
        if (typeof checkpoint.runId !== "string" || !/^[a-zA-Z0-9-]{1,256}$/.test(checkpoint.runId) || checkpoint.workflowId !== workflowId || request.runId && checkpoint.runId !== request.runId || !Number.isSafeInteger(checkpoint.revision) || checkpoint.revision < 0 || !["ready", "in_flight", "completed", "failed", "abandoned"].includes(checkpoint.phase) || !(checkpoint.nextStepId === null || typeof checkpoint.nextStepId === "string")) throw new Error("Invalid CLI receipt checkpoint");
        const presentation = presentationFields(checkpoint);
        if (presentation.executionKind !== void 0 && presentation.executionKind !== (request.taskId ? "task" : "workflow") || presentation.stepId !== request.stepId) throw new Error("CLI receipt presentation mismatch");
      }
      if (selector.requestId || (checkpoint?.runId || request.runId) === selector.runId) matches.push({ directory: directory2, owner, id, request, receipt });
    }
  }
  if (selector.requestId && matches.length > 1) throw new Error("Ambiguous CLI request identity");
  matches.sort((a, b) => (b.request.submittedAt ?? b.request.expiresAt ?? 0) - (a.request.submittedAt ?? a.request.expiresAt ?? 0));
  const selected = matches[0];
  let result = { ...unknown };
  if (selected) {
    const { directory: directory2, owner, id, request, receipt } = selected;
    result.requestId = id;
    result.runId = receipt?.checkpoint?.runId || request.runId;
    if (selector.runId) result.requestIds = matches.map((m) => m.id);
    result.hostAvailable = availableHost(root, directory2, owner);
    result.receiptStatus = receipt?.status;
    result.acceptance = !receipt ? "pending" : receipt.status === "rejected" ? "rejected" : "accepted";
    result.state = receipt?.status === "rejected" ? "not-accepted" : receipt?.status === "completed" ? "finished" : receipt && receipt.status !== "failed" && result.hostAvailable ? "running" : "unknown";
    if (receipt?.checkpoint) result.checkpoint = executionSummary(receipt.checkpoint);
    const timing = receipt?.timing;
    if (timing && [timing.submittedAt, timing.receivedAt, timing.queueMs].every((n) => Number.isFinite(n) && n >= 0)) result.timing = { submittedAt: timing.submittedAt, receivedAt: timing.receivedAt, queueMs: timing.queueMs };
  }
  if (result.runId && fs13.existsSync(path14.join(root, result.runId + ".json"))) {
    const state = readExecutionCheckpoint(root, result.runId);
    if (result.checkpoint && (state.workflowId !== result.checkpoint.workflowId || state.revision < result.checkpoint.revision)) throw new Error("CLI receipt and journal disagree");
    result.checkpoint = executionSummary(state, result.checkpoint);
    const terminal = ["completed", "failed"].includes(state.phase) && checkpointUncertainties(state).length === 0;
    result.resultAvailable = terminal;
    if (terminal && (selector.runId || result.acceptance !== "rejected")) result.state = "finished";
    else if (!(selector.requestId && result.acceptance === "rejected") && (checkpointUncertainties(state).length > 0 || !result.hostAvailable || state.phase === "abandoned")) result.state = "unknown";
    if (selector.includeOutput && terminal) result.result = { phase: state.phase, steps: state.steps.map((s) => ({ stepId: s.stepId, output: s.result?.output ?? s.output, succeeded: s.result?.succeeded })) };
  }
  try {
    result.diagnostics = readExecutionTimings(root, selector);
  } catch {
    result.diagnosticsUnavailable = true;
  }
  return result;
}
async function followPluginRequest(runtime, selector, options = {}) {
  const timeout = options.timeoutMs ?? 3e4;
  if (!Number.isSafeInteger(timeout) || timeout < 0 || timeout > 864e5) throw new Error("Follow timeout must be between 0 and 86400000 ms");
  const deadline = import_perf_hooks4.performance.now() + timeout;
  let previous = "";
  for (; ; ) {
    const result = inspectPluginRequest(runtime, selector), serialized = JSON.stringify(result);
    if (serialized !== previous) {
      previous = serialized;
      options.onProgress?.(result);
    }
    if (["finished", "not-accepted"].includes(result.state)) return result;
    if (options.signal?.aborted) return { ...result, interrupted: true };
    if (import_perf_hooks4.performance.now() >= deadline) return { ...result, waitTimedOut: true };
    await new Promise((resolve11) => (0, import_timers3.setTimeout)(resolve11, Math.min(200, Math.max(1, deadline - import_perf_hooks4.performance.now()))));
  }
}

// catalog-availability.ts
function taskDisabledReason(task) {
  return task?.disabled === true ? `Task "${task.name || task.id}" is disabled. Enable it before running.` : void 0;
}
function workflowDisabledReason(workflow, tasks, workflows = []) {
  if (workflow.steps?.some((step) => step.stepKind === "workflow")) {
    try {
      for (const child of workflowClosure(workflow, workflows)) {
        const reason = workflowDisabledReason({ ...child, steps: child.steps.filter((step) => step.stepKind !== "workflow") }, tasks);
        if (reason) return reason;
      }
    } catch {
    }
  }
  if (workflow.disabled === true) return `Workflow "${workflow.name || workflow.id}" is disabled. Enable it before running.`;
  for (const step of workflow.steps || []) {
    if (step.disabled === true) return `Step "${step.name || step.id}" is disabled. Enable it before running.`;
    if (step.stepKind && step.stepKind !== "task") continue;
    const reason = taskDisabledReason(tasks.find((task) => task.id === step.taskId));
    if (reason) return reason;
  }
  return void 0;
}
function assertWorkflowEnabled(workflow, tasks, workflows = []) {
  const reason = workflowDisabledReason(workflow, tasks, workflows);
  if (reason) throw Object.assign(new Error(reason), { name: "DisabledExecutionError" });
}

// workflow-code-step.ts
function selectCodeStep(workflow, stepId, historical = false) {
  const matches = workflow.steps.filter((step2) => step2.id === stepId);
  if (matches.length !== 1 || !historical && matches[0].stepKind !== "code") throw new Error("Missing or ambiguous code step");
  const step = matches[0];
  return {
    id: workflow.id,
    name: `${workflow.name} \xB7 ${step.name || step.id}`,
    concurrency: workflow.concurrency,
    disabled: workflow.disabled,
    requiresAutoOCSecrets: workflow.requiresAutoOCSecrets,
    isolatedCodeStep: stepId,
    runtimeExecution: step.codeExecution?.runtimeExecution,
    steps: [{ ...step, transitions: [], transitionMode: void 0, evaluatePrompt: void 0, forceContinue: void 0 }]
  };
}
function codeStepDisplay(step) {
  const solo = step.codeExecution;
  return solo && (!step.lastRun || solo.lastRun >= step.lastRun) ? { status: solo.status, output: solo.output || "", lastRun: solo.lastRun } : { status: step.status || "pending", output: step.output || "", lastRun: step.lastRun };
}
function readCodeStepCheckpoint(runtime, workflow, stepId) {
  const selected = selectCodeStep(workflow, stepId), binding = selected.runtimeExecution;
  if (!binding) return void 0;
  const checkpoint = readExecutionCheckpoint(runtime, binding.runId);
  validateProgressBinding(selected, checkpoint, binding.runId);
  if (checkpoint.steps.some((step) => step.stepId !== stepId)) throw new Error("Isolated execution contains another step");
  return checkpoint;
}

// page-workflow.ts
var fs24 = __toESM(require("fs"));
var path25 = __toESM(require("path"));

// retired-dependency.ts
function autoOCDependencyError(item) {
  if (item.requiresAutoOCSecrets === void 0 || item.requiresAutoOCSecrets === false) return;
  const identity2 = typeof item.id === "string" ? item.id : "definition";
  return typeof item.requiresAutoOCSecrets !== "boolean" ? `Invalid AutoOC secrets dependency declaration (${identity2}); requiresAutoOCSecrets must be boolean` : `AutoOC Secrets was retired (${identity2}); adapt this definition before execution`;
}
function assertNoRetiredDependency(item) {
  const error = autoOCDependencyError(item);
  if (error) throw new Error(error);
}
function assertWorkflowDependencies(workflow, tasks, workflows = []) {
  if (workflow.steps?.some((step) => step.stepKind === "workflow")) for (const child of workflowClosure(workflow, workflows)) {
    assertWorkflowDependencies({ ...child, steps: child.steps.filter((step) => step.stepKind !== "workflow") }, tasks);
  }
  assertNoRetiredDependency(workflow);
  for (const step of workflow.steps || []) {
    assertNoRetiredDependency(step);
    if (step.stepKind === "task" || !step.stepKind && step.taskId) {
      const task = tasks.find((item) => item.id === step.taskId);
      if (task) assertNoRetiredDependency(task);
    }
  }
}

// code-workflow-host.ts
var fs14 = __toESM(require("fs"));

// workflow-session.ts
async function advanceWorkflowSession(journal, definition, host, options = {}) {
  const verified = prepareWorkflowDefinition(definition.workflow, definition.tasks, { ...definition.settings, workflows: definition.workflows });
  const checkpoint = journal.snapshot();
  if (verified.hash !== definition.hash || checkpoint.definitionHash !== verified.hash || checkpoint.workflowId !== verified.workflow.id) throw new Error("Workflow definition does not match execution checkpoint");
  const plan = workflowExecutionPlan(verified), steps = plan.steps;
  if (new Set(steps.map((step) => step.id)).size !== steps.length) throw new Error("Duplicate workflow step identity");
  const limit = options.maxSteps ?? 1e4;
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("Invalid execution step limit");
  await host.onCheckpoint?.(journal.snapshot());
  for (let count = 0; count < limit; count++) {
    const state = journal.snapshot();
    const observed = state.phase === "in_flight" ? state.steps[state.steps.length - 1].result : void 0;
    if (state.phase === "in_flight" && !observed && !plan.scopes.get(state.nextStepId)?.boundary) throw new Error("Interrupted step requires reconciliation before continuation");
    if (!["ready", "in_flight"].includes(state.phase) || options.signal?.aborted) return state;
    const index = steps.findIndex((step2) => step2.id === state.nextStepId);
    if (index < 0) throw new Error("Checkpoint step is absent from workflow definition");
    const step = steps[index];
    const { outputs, input, scope } = workflowStepContext(plan, step.id, state);
    if (state.phase === "ready") {
      await journal.begin(step.id);
      try {
        await host.onCheckpoint?.(journal.snapshot());
      } catch (error) {
        await journal.finish(step.id, false, "[progress publication failed before step effects]", null);
        throw error;
      }
      if (options.signal?.aborted) {
        await journal.finish(step.id, false, "[cancelled before step effects]", null);
        await host.onCheckpoint?.(journal.snapshot());
        return journal.snapshot();
      }
    }
    const last = state.steps.filter((item) => item.status !== "in_flight").slice(-1)[0];
    const result = observed || (scope.boundary === "enter" ? { succeeded: true, output: input } : scope.boundary === "return" ? { succeeded: last?.status === "completed", output: last?.output || "", cancelled: last?.result?.cancelled } : await host.execute(step, input, outputs, options.signal));
    if (typeof result.succeeded !== "boolean" || typeof result.output !== "string") throw new Error("Invalid execution result");
    if (result.cancelled !== void 0 && (typeof result.cancelled !== "boolean" || result.cancelled && result.succeeded)) throw new Error("Invalid cancellation result");
    const output = observed ? result.output : host.redact(result.output);
    if (typeof output !== "string") throw new Error("Invalid redacted output");
    if (!observed) await journal.recordResult({ ...result, output });
    if (result.cancelled) {
      await journal.finish(step.id, false, output, null);
      await host.onCheckpoint?.(journal.snapshot());
      return journal.snapshot();
    }
    if (options.signal?.aborted) {
      await host.onCheckpoint?.(journal.snapshot());
      return journal.snapshot();
    }
    outputs[scope.localId] = output;
    const transitions = step.transitions || [];
    const next = await resolveWorkflowTransition(steps, index, output, result.succeeded, transitions, outputs, {
      evaluate: async (transition, target, input2) => {
        if (options.signal?.aborted) throw new Error("Workflow cancelled before evaluation");
        const key = String(transitions.indexOf(transition));
        const saved = journal.snapshot().steps.slice(-1)[0].evaluations?.find((entry) => entry.key === key);
        if (saved?.status === "completed") return saved.output;
        if (saved) throw new Error("Interrupted evaluation requires reconciliation; it cannot be replayed");
        await journal.recordEvaluation(key);
        await host.onCheckpoint?.(journal.snapshot());
        if (options.signal?.aborted) throw new Error("Workflow cancelled before evaluation effects");
        const response = host.redact(await host.evaluate(transition, target, input2));
        await journal.recordEvaluation(key, response);
        return response;
      },
      onError: (kind, error) => {
        host.onTransitionError(kind, error);
        if (kind === "eval") throw error;
      }
    });
    if (options.signal?.aborted) return journal.snapshot();
    await journal.finish(step.id, result.succeeded, output, workflowPlanNext(plan, step.id, next.nextStepId));
    await host.onCheckpoint?.(journal.snapshot());
  }
  return journal.snapshot();
}

// code-runtime.ts
function executeCode(options) {
  const fs34 = require("fs");
  const path34 = require("path");
  const vm2 = require("vm");
  const vaultBase = options.vaultBase;
  const defaultCwd = options.cwd;
  const resolveInVault = (p) => {
    const root = fs34.realpathSync(vaultBase);
    const resolved = path34.resolve(root, p || ".");
    if (resolved !== root && !resolved.startsWith(root + path34.sep)) {
      throw new Error(`Path escapes vault: ${p}`);
    }
    let current = root;
    for (const component of path34.relative(root, resolved).split(path34.sep).filter(Boolean)) {
      current = path34.join(current, component);
      try {
        if (fs34.lstatSync(current).isSymbolicLink()) throw new Error("Linked vault paths are unsupported");
      } catch (error) {
        if (error.code === "ENOENT") break;
        throw error;
      }
    }
    return resolved;
  };
  const readText = (p) => fs34.readFileSync(p, "utf8");
  const writeText = (p, content) => {
    fs34.mkdirSync(path34.dirname(p), { recursive: true });
    fs34.writeFileSync(p, String(content), "utf8");
    return p;
  };
  const sandbox = {
    input: options.input ?? "",
    outputs: options.outputs || {},
    String,
    Number,
    Boolean,
    Array,
    Object,
    JSON,
    Math,
    Date,
    RegExp,
    console: { log: options.log || (() => {
    }) }
  };
  if (options.codeAllowVault) {
    sandbox.vault = {
      basePath: vaultBase,
      resolve: (p) => resolveInVault(p),
      read: (p) => readText(resolveInVault(p)),
      write: (p, content) => {
        const full = writeText(resolveInVault(p), content);
        options.onVaultMutation?.({ path: full, operation: "write" });
        return full;
      },
      append: (p, content) => {
        const full = resolveInVault(p);
        fs34.mkdirSync(path34.dirname(full), { recursive: true });
        fs34.appendFileSync(full, String(content), "utf8");
        options.onVaultMutation?.({ path: full, operation: "append" });
        return full;
      },
      exists: (p) => fs34.existsSync(resolveInVault(p)),
      list: (p = ".") => fs34.readdirSync(resolveInVault(p))
    };
  }
  if (options.codeAllowFiles) {
    sandbox.files = {
      cwd: defaultCwd,
      resolve: (p) => path34.isAbsolute(p) ? path34.resolve(p) : path34.resolve(defaultCwd, p || "."),
      read: (p) => readText(path34.isAbsolute(p) ? path34.resolve(p) : path34.resolve(defaultCwd, p)),
      write: (p, content) => writeText(path34.isAbsolute(p) ? path34.resolve(p) : path34.resolve(defaultCwd, p), content),
      append: (p, content) => {
        const full = path34.isAbsolute(p) ? path34.resolve(p) : path34.resolve(defaultCwd, p);
        fs34.mkdirSync(path34.dirname(full), { recursive: true });
        fs34.appendFileSync(full, String(content), "utf8");
        return full;
      },
      exists: (p) => fs34.existsSync(path34.isAbsolute(p) ? path34.resolve(p) : path34.resolve(defaultCwd, p)),
      list: (p = ".") => fs34.readdirSync(path34.isAbsolute(p) ? path34.resolve(p) : path34.resolve(defaultCwd, p))
    };
  }
  if (options.codeAllowTerminal) {
    const { execSync } = require("child_process");
    sandbox.terminal = {
      run: (command, options2 = {}) => execSync(String(command), {
        cwd: options2.cwd ? path34.isAbsolute(options2.cwd) ? options2.cwd : path34.resolve(defaultCwd, options2.cwd) : defaultCwd,
        timeout: Math.min(Math.max(options2.timeoutMs || 3e4, 1e3), 6e5),
        encoding: "utf8",
        windowsHide: true
      })
    };
  }
  if (options.exposePaths === false) {
    if (sandbox.vault) {
      delete sandbox.vault.basePath;
      delete sandbox.vault.resolve;
    }
    if (sandbox.files) {
      delete sandbox.files.cwd;
      delete sandbox.files.resolve;
    }
  }
  const inputVar = options.codeInputVar || "input";
  const outputVar = options.codeOutputVar || "output";
  const preamble = `var ${inputVar} = input; var ${outputVar} = "";`;
  const result = vm2.runInNewContext(preamble + "\n" + options.code + "\n;" + outputVar, sandbox, { timeout: 9e5 });
  return String(result == null ? "" : result);
}
function codeNodeExecutable() {
  if (!process.versions.electron) return process.execPath;
  const fs34 = require("fs");
  const path34 = require("path");
  const directories = (process.env.PATH || process.env.Path || "").split(path34.delimiter).map((directory2) => directory2.trim().replace(/^"|"$/g, "")).filter((directory2) => path34.isAbsolute(directory2));
  if (process.platform === "win32") {
    for (const base of [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]]) {
      if (base && path34.isAbsolute(base)) directories.push(path34.join(base, "nodejs"));
    }
  } else directories.push("/opt/homebrew/bin", "/usr/local/bin", "/usr/bin");
  for (const directory2 of directories) {
    const file = path34.join(directory2, process.platform === "win32" ? "node.exe" : "node");
    try {
      if (fs34.statSync(file).isFile()) {
        fs34.accessSync(file, fs34.constants.X_OK);
        return file;
      }
    } catch {
    }
  }
  throw new Error("Code tasks need Node.js 18 or later. Install Node.js and restart Obsidian, then try again.");
}
async function executeCodeAsync(options, signal) {
  if (signal?.aborted) throw new Error("Code execution stopped; external effects may be unconfirmed");
  const { log, onVaultMutation } = options;
  const data = {
    vaultBase: options.vaultBase,
    cwd: options.cwd,
    code: options.code,
    input: options.input,
    outputs: options.outputs,
    codeInputVar: options.codeInputVar,
    codeOutputVar: options.codeOutputVar,
    codeAllowVault: options.codeAllowVault,
    codeAllowFiles: options.codeAllowFiles,
    codeAllowTerminal: options.codeAllowTerminal,
    exposePaths: options.exposePaths
  };
  const workerSource = `
    const {parentPort, workerData} = require('worker_threads');
    const execute = ${executeCode.toString()};
    try {
      const output = execute({...workerData,
        log: (...args) => parentPort.postMessage({type:'log', text:args.map(String).join(' ')}),
        onVaultMutation: mutation => parentPort.postMessage({type:'mutation', mutation})});
      parentPort.postMessage({type:'result', output});
    } catch(error) { parentPort.postMessage({type:'error', text:String(error),
      name: typeof error?.name === 'string' ? error.name : 'Error',
      message: typeof error?.message === 'string' ? error.message : String(error)}); }
  `;
  const source = `
    if (Number(process.versions.node.split('.')[0]) < 18) throw Error('Code tasks need Node.js 18 or later');
    const {Worker} = require('worker_threads');
    process.on('disconnect', () => process.exit(1));
    const send = message => { if (process.connected) process.send(message); else process.exit(1); };
    process.once('message', data => {
      const worker = new Worker(${JSON.stringify(workerSource)}, {eval:true,workerData:data});
      let finished = false;
      const finish = message => {
        if (finished) return; finished = true;
        if (process.connected) process.send(message, () => process.exit(0)); else process.exit(1);
      };
      worker.on('message', message => message.type === 'result' || message.type === 'error' ? finish(message) : send(message));
      worker.once('error', error => finish({type:'error',text:String(error),name:error.name,message:error.message}));
      worker.once('exit', code => { if (!finished) finish({type:'error',text:'Code runner exited without a result ('+code+')',name:'Error',message:'Code runner exited without a result'}); });
    });
    send({type:'ready'});
  `;
  const { spawn: spawn4 } = require("child_process");
  const child = spawn4(codeNodeExecutable(), ["-e", source], {
    cwd: options.cwd,
    windowsHide: true,
    detached: process.platform !== "win32",
    // Electron and the installed Node can use different V8 serialization versions.
    stdio: ["ignore", "ignore", "pipe", "ipc"],
    serialization: "json"
  });
  let closed = false, diagnostic = "", startupTimer;
  const closedPromise = new Promise((resolve11) => child.once("close", () => {
    closed = true;
    resolve11();
  }));
  child.stderr?.on("data", (chunk) => {
    diagnostic = (diagnostic + String(chunk)).slice(-2e3);
  });
  const stop = () => {
    if (!child.pid || closed || child.exitCode !== null || child.signalCode !== null) return;
    if (signal?.aborted && process.platform === "win32") {
      const path34 = require("path");
      const system = process.env.SystemRoot || "C:\\Windows";
      const killer = spawn4(path34.join(system, "System32", "taskkill.exe"), ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      const fallback = () => {
        if (!closed) child.kill("SIGKILL");
      };
      const timer = setTimeout(fallback, 2e3);
      killer.once("error", () => {
        clearTimeout(timer);
        fallback();
      });
      killer.once("close", () => {
        clearTimeout(timer);
        fallback();
      });
    } else if (signal?.aborted && process.platform !== "win32") {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    } else child.kill("SIGKILL");
  };
  let abort;
  try {
    return await new Promise((resolve11, reject) => {
      abort = () => reject(new Error("Code execution stopped; commands already started may still have effects"));
      signal?.addEventListener("abort", abort, { once: true });
      child.once("error", reject);
      child.once("close", (code) => reject(new Error(`Code runner exited without a result (${code}). ${diagnostic}`)));
      startupTimer = setTimeout(() => reject(new Error("The code runner did not start. Check your Node.js installation.")), 3e4);
      child.on("message", (message) => {
        try {
          if (message.type === "ready") {
            clearTimeout(startupTimer);
            child.send(data, (error) => {
              if (error) reject(error);
            });
          } else if (message.type === "log") log?.(message.text);
          else if (message.type === "mutation") onVaultMutation?.(message.mutation);
          else if (message.type === "result") resolve11(message.output);
          else if (message.type === "error") {
            const error = new Error(message.message);
            error.name = message.name;
            error.toString = () => message.text;
            reject(error);
          }
        } catch (error) {
          reject(error);
        }
      });
      if (signal?.aborted) abort();
    });
  } finally {
    clearTimeout(startupTimer);
    if (abort) signal?.removeEventListener("abort", abort);
    stop();
    await closedPromise;
  }
}

// code-vault-mutations.ts
async function runWithVaultMutations(factory, execute) {
  const batch = factory?.();
  let result;
  let failed = false;
  let original;
  try {
    result = await execute(batch?.record);
  } catch (error) {
    failed = true;
    original = error;
  }
  try {
    await batch?.flush();
  } catch (refreshError) {
    if (!failed) throw refreshError;
    const combined = new Error(`${String(original)}; ${String(refreshError)}`);
    combined.cause = original;
    throw combined;
  }
  if (failed) throw original;
  return result;
}

// workflow-delay.ts
function workflowDelay(value = 0, unit = "seconds") {
  if (!Number.isFinite(value)) throw new Error("Invalid workflow delay");
  const amount = Math.max(0, value);
  const milliseconds = amount * (unit === "hours" ? 36e5 : unit === "minutes" ? 6e4 : 1e3);
  if (!Number.isSafeInteger(Math.ceil(milliseconds))) throw new Error("Workflow delay is too large");
  return { milliseconds, output: `[delay ${amount} ${unit}]` };
}
function waitForWorkflowDelay(milliseconds, signal) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return Promise.reject(new Error("Invalid workflow delay"));
  return new Promise((resolve11, reject) => {
    let timer;
    let remaining = milliseconds;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      const error = new Error("Workflow delay cancelled");
      error.name = "AbortError";
      reject(error);
    };
    const schedule = () => {
      const chunk = Math.min(remaining, 2147483647);
      remaining -= chunk;
      timer = setTimeout(() => {
        if (remaining > 0) schedule();
        else {
          cleanup();
          resolve11();
        }
      }, chunk);
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
    schedule();
  });
}

// workflow-handoff.ts
function extractSection(output, title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = output.match(
    new RegExp(`(?:^|\\r?\\n)## ${escaped}\\s*(?:\\r?\\n)+([\\s\\S]*?)(?=(?:\\r?\\n){2}---(?:\\r?\\n){2}## |$)`)
  );
  return match ? match[1].trim() : "";
}
function extractContextForHandoff(output) {
  const cleaned = output;
  if (!cleaned) return "";
  const response = cleaned.startsWith("## Response\n") || cleaned.startsWith("## Response\r\n") ? extractSection(cleaned, "Response") : "";
  const touchedFiles = extractSection(cleaned, "Touched files");
  const parts = [];
  if (response) {
    parts.push(`PRIMARY HANDOFF INPUT \u2014 use this as the main input for the current task:

${response}`);
    if (touchedFiles) {
      parts.push(`DIAGNOSTIC ONLY \u2014 touched files (do not re-read unless the current task explicitly asks):

${touchedFiles}`);
    }
  } else {
    const primary = cleaned;
    parts.push(`PRIMARY HANDOFF INPUT \u2014 use this as the main input for the current task:

${primary}`);
  }
  return parts.join("\n\n");
}
function workflowTaskPrompt(prompt, workflow, previous) {
  if (!workflow.handoffOutput || !previous) return prompt;
  const previousStep = workflow.steps.find((s) => s.id === previous.stepId);
  const sourceLine = previousStep ? `Source: step "${previousStep.name || previous.stepId}" (${previousStep.stepKind}${previousStep.taskId ? ` -> task ${previousStep.taskId}` : ""})` : `Source: step ${previous.stepId}`;
  const cleanOutput = previousStep?.stepKind === "code" ? `PRIMARY HANDOFF INPUT \u2014 use this as the main input for the current task:

${previous.output}` : extractContextForHandoff(String(previous.output || ""));
  const contextBlock = [
    "",
    "=== WORKFLOW HANDOFF CONTEXT ===",
    sourceLine,
    "The previous step's output below is the PRIMARY INPUT for this task.",
    "Touched files are DIAGNOSTIC ONLY \u2014 do not re-read them unless this task explicitly asks.",
    "",
    cleanOutput || String(previous.output || "").trim(),
    "=== END WORKFLOW HANDOFF CONTEXT ==="
  ].join("\n");
  return `${prompt}
${contextBlock}`;
}

// workflow-recovery.ts
async function reconcileWorkflowTask(journal, definition, read2, host) {
  const state = journal.snapshot();
  const verified = prepareWorkflowDefinition(definition.workflow, definition.tasks, { ...definition.settings, workflows: definition.workflows });
  const plan = workflowExecutionPlan(verified);
  if (verified.hash !== definition.hash || state.definitionHash !== verified.hash || state.workflowId !== verified.workflow.id) throw new Error("Recovery definition mismatch");
  if (state.phase !== "in_flight") return state;
  const step = state.steps[state.steps.length - 1];
  if (!step.codexThreadId || !step.codexTurnId) throw new Error("Exact Codex identity is unavailable; manual reconciliation required");
  const result = await read2(step.codexThreadId, step.codexTurnId);
  if (result.threadId !== step.codexThreadId || result.turnId !== step.codexTurnId) throw new Error("Recovery execution identity mismatch");
  if (!["completed", "failed", "interrupted"].includes(result.status)) return state;
  if (typeof result.output !== "string") throw new Error("Recovery output is unavailable");
  const index = plan.steps.findIndex((item) => item.id === step.stepId);
  if (index < 0) throw new Error("Recovery step is missing");
  const output = host.redact(result.output);
  if (typeof output !== "string") throw new Error("Invalid redacted recovery output");
  const { outputs, scope } = workflowStepContext(plan, step.stepId, state);
  outputs[scope.localId] = output;
  const succeeded = result.status === "completed";
  await journal.recordResult({ succeeded, output, cancelled: result.status === "interrupted" });
  if (result.status === "interrupted") {
    await journal.finish(step.stepId, false, output, null);
    return journal.snapshot();
  }
  const transitions = plan.steps[index].transitions || [];
  if (transitions.some((t) => t.mode === "eval")) return journal.snapshot();
  const next = await resolveWorkflowTransition(
    plan.steps,
    index,
    output,
    succeeded,
    transitions,
    { ...outputs },
    { evaluate: async () => {
      throw new Error("Reconciliation cannot launch a model evaluation");
    }, onError: host.onTransitionError.bind(host) }
  );
  await journal.finish(step.stepId, succeeded, output, workflowPlanNext(plan, step.stepId, next.nextStepId));
  return journal.snapshot();
}

// workflow-branch.ts
var path15 = __toESM(require("path"));
var import_child_process5 = require("child_process");
function validateBranchOptions(task) {
  if (task.branch !== void 0 && typeof task.branch !== "string") throw new Error("Branch must be a string");
  if (task.createBranch !== void 0 && typeof task.createBranch !== "boolean") throw new Error("createBranch must be boolean");
  if (task.createBranch && !task.branch?.trim()) throw new Error("Creating a branch requires its name");
  if (task.branch?.trim()) {
    try {
      (0, import_child_process5.execFileSync)("git", ["check-ref-format", "--branch", task.branch], { stdio: "ignore", windowsHide: true });
    } catch {
      throw new Error("Invalid Git branch name");
    }
    if (task.branch.startsWith("-") || task.branch.includes("@{")) throw new Error("Invalid Git branch name");
  }
}
function git(cwd, args) {
  try {
    const output = (0, import_child_process5.execFileSync)("git", ["-c", `safe.directory=${cwd.replace(/\\/g, "/")}`, ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    return args.includes("-z") ? output : output.trim();
  } catch {
    throw new Error("Git branch operation failed; working tree preserved, no forced checkout or cleanup");
  }
}
function branchRepository(cwd, vault) {
  const directory2 = physicalPath(git(physicalPath(cwd), ["rev-parse", "--show-toplevel"]));
  if (!isWithinPhysicalPath(vault, directory2)) throw new Error("Git repository is outside the selected vault");
  const metadata = physicalPath(git(directory2, ["rev-parse", "--absolute-git-dir"]));
  const common = physicalPath(path15.resolve(directory2, git(directory2, ["rev-parse", "--git-common-dir"])));
  if (!isWithinPhysicalPath(vault, metadata) || !isWithinPhysicalPath(vault, common)) throw new Error("Git metadata is outside the selected vault");
  return directory2;
}
function preflightTaskBranch(task, cwd, vault) {
  if (!task.branch?.trim() || task.createBranch) return;
  const directory2 = branchRepository(cwd, vault);
  if (git(directory2, ["branch", "--show-current"]) === task.branch) return;
  const untracked = git(directory2, ["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean);
  const target = git(directory2, ["ls-tree", "-r", "--name-only", "-z", task.branch]).split("\0").filter(Boolean);
  const collision = untracked.some((file) => target.some((name) => name === file || name.startsWith(file + "/") || file.startsWith(name + "/")));
  if (git(directory2, ["status", "--porcelain", "--untracked-files=no"]) || collision) {
    throw new Error("Git Branch cannot switch while the working tree has uncommitted changes. Clear Git Branch to use the current branch, or commit/stash your work first. No task was started.");
  }
}
async function prepareTaskBranch(journal, task, cwd, vault, handoff) {
  validateBranchOptions(task);
  const state = journal.snapshot();
  const previous = handoff ? [...state.steps].reverse().find((step) => step.branch)?.branch : void 0;
  if (!previous && !task.branch?.trim() && !handoff) return;
  const directory2 = branchRepository(cwd, vault);
  if (previous) {
    if (!samePhysicalPath(branchRepository(previous.directory, vault), directory2) || git(directory2, ["branch", "--show-current"]) !== previous.name) throw new Error("Workflow branch changed; reconcile before continuation");
  } else if (task.branch?.trim()) {
    const name2 = task.createBranch ? `${task.branch}-${state.runId.slice(0, 8)}-${state.steps.length}` : task.branch;
    git(directory2, task.createBranch ? ["checkout", "-b", name2] : ["checkout", name2]);
  }
  const name = git(directory2, ["branch", "--show-current"]);
  if (!name) throw new Error("Workflow branch requires an attached Git branch");
  await journal.recordBranch({ directory: directory2, name });
}
function verifyWorkflowBranch(journal, vault) {
  const branch = [...journal.snapshot().steps].reverse().find((step) => step.branch)?.branch;
  if (branch && git(branchRepository(branch.directory, vault), ["branch", "--show-current"]) !== branch.name) throw new Error("Workflow branch changed; reconcile before continuation");
}

// code-workflow-host.ts
function supportsSharedWorkflow(definition, tasks) {
  assertWorkflowDependencies(definition.workflow, definition.tasks, definition.workflows);
  return !definition.workflow.requiresAutoOCSecrets && !definition.tasks.some((task) => task.requiresAutoOCSecrets) && ![definition.workflow, ...definition.workflows || []].some((w) => w.steps.some((step) => !["code", "delay", "task", "workflow"].includes(step.stepKind || "task"))) && definition.tasks.every((task) => !!tasks?.supports(task));
}
async function runCodeWorkflowHost(options) {
  return withExecutionTiming(options.runtimeDirectory, { runId: options.resumeRunId }, (timing) => executeTimedWorkflow({ ...options, timing, onCheckpoint: (checkpoint) => options.onCheckpoint?.(checkpoint, timing) || Promise.resolve() }), options.timing);
}
async function executeTimedWorkflow(options) {
  if (!options.reconcile) assertWorkflowEnabled(options.definition.workflow, options.definition.tasks, options.definition.workflows);
  assertWorkflowDependencies(options.definition.workflow, options.definition.tasks, options.definition.workflows);
  const definition = prepareWorkflowDefinition(options.definition.workflow, options.definition.tasks, { ...options.definition.settings, workflows: options.definition.workflows });
  if (definition.hash !== options.definition.hash) throw new Error("Workflow definition changed");
  if (options.reconcile && !options.resumeRunId) throw new Error("Reconciliation requires an existing run identity");
  if (options.maxSteps !== void 0 && (!Number.isSafeInteger(options.maxSteps) || options.maxSteps < 1)) throw new Error("Invalid execution step limit");
  const plan = workflowExecutionPlan(definition), steps = plan.steps;
  if (definition.tasks.some((task) => !options.tasks?.supports(task))) throw new Error("No adapter for referenced workflow task");
  if (!supportsSharedWorkflow(definition, options.tasks)) throw new Error("Unsupported step, task or model evaluation in this host");
  if (steps.some((step) => step.transitionMode === "eval" || step.transitions?.some((t) => t.mode === "eval")) && !options.evaluate) throw new Error("Model evaluation adapter is required");
  const entry = steps.find((step) => step.id === plan.entry);
  if (!entry) throw new Error("Workflow has no entry step");
  const lease = options.lease || acquireExecutionLease(options.runtimeDirectory);
  const ownsLease = !options.lease;
  let ownedAdmission;
  let failed = false;
  let failure;
  try {
    lease.assertOwned();
    if (!samePhysicalPath(options.runtimeDirectory, lease.directory)) throw new Error("Execution lease belongs to another runtime");
    const admission = options.admission || executionCoordinator(lease).admit(definition, options.vaultBase, options.resumeRunId);
    if (!options.admission) ownedAdmission = admission;
    admission.assertOwned(lease, definition);
    if (!options.admission) {
      const publish2 = options.onCheckpoint;
      options = { ...options, onCheckpoint: async (checkpoint) => {
        admission.bind(checkpoint);
        await publish2?.(checkpoint);
        admission.confirm(checkpoint);
      } };
    }
    const resumed = options.resumeRunId === void 0 ? void 0 : ExecutionJournal.open(lease, options.resumeRunId, definition.hash, options.timing);
    if (resumed) bindTimingRun(resumed.snapshot().runId, options.timing);
    if (resumed?.snapshot().phase === "abandoned") throw new Error("Abandoned execution cannot be resumed; inspect its unknown outcome before starting new work");
    if (resumed && resumed.snapshot().workflowId !== definition.workflow.id) throw new Error("Execution belongs to another workflow");
    if (resumed) admission.bind(resumed.snapshot());
    if (resumed && [definition.workflow, ...definition.workflows || []].some((w) => w.handoffBranch) && ["ready", "in_flight"].includes(resumed.snapshot().phase)) {
      verifyWorkflowBranch(resumed, options.vaultBase);
    }
    if (resumed && ["completed", "failed"].includes(resumed.snapshot().phase)) {
      const state = resumed.snapshot();
      await options.onCheckpoint?.(state);
      return state;
    }
    if (resumed?.snapshot().phase === "in_flight" && !resumed.snapshot().steps.slice(-1)[0].result && !plan.scopes.get(resumed.snapshot().nextStepId)?.boundary) {
      if (!options.reconcile || !options.tasks?.reconcile) throw new Error("Interrupted execution requires reconciliation; cannot replay effects");
      const step = steps.find((step2) => step2.id === resumed.snapshot().nextStepId);
      const task = definition.tasks.find((task2) => task2.id === step?.taskId);
      if (!task) throw new Error("Interrupted step has no recoverable task");
      const result = await reconcileWorkflowTask(resumed, definition, (thread, turn) => options.tasks.reconcile(task, thread, turn), {
        redact: options.redact,
        evaluate: options.evaluate || (async () => {
          throw new Error("Model evaluation unavailable");
        }),
        onTransitionError: () => {
        }
      });
      await options.onCheckpoint?.(JSON.parse(JSON.stringify(result)));
      return result;
    }
    if (options.reconcile && resumed) {
      await options.onCheckpoint?.(resumed.snapshot());
      return resumed.snapshot();
    }
    const journal = await catalogTransaction(lease.directory + "/journal-admission", async () => {
      for (const file of fs14.readdirSync(lease.directory)) {
        if (!/^[a-f0-9-]+\.json$/.test(file)) continue;
        if (fs14.lstatSync(lease.directory + "/" + file).isSymbolicLink()) throw new Error("Execution checkpoint cannot be a link");
        const prior = JSON.parse(fs14.readFileSync(lease.directory + "/" + file, "utf8"));
        ExecutionJournal.open(lease, file.slice(0, -5), prior.definitionHash);
        const resolved = prior.phase === "abandoned" || prior.disposition || ["completed", "failed"].includes(prior.phase) && !checkpointUncertainties(prior).length;
        if (prior.runId !== options.resumeRunId && !resolved && !admission.permitsPending(prior)) {
          throw new Error(`Previous execution requires continuation or reconciliation (run ${prior.runId}, workflow ${prior.workflowId}, step ${prior.nextStepId}). No new task was started.`);
        }
      }
      const journal2 = resumed || await ExecutionJournal.create(lease, definition.workflow.id, definition.hash, entry.id, options.timing);
      admission.bind(journal2.snapshot());
      return journal2;
    });
    bindTimingRun(journal.snapshot().runId, options.timing);
    return await advanceWorkflowSession(journal, definition, {
      async execute(step, input, outputs, signal) {
        admission.assertOwned(lease, definition);
        const context = workflowStepContext(plan, step.id, journal.snapshot());
        const workflow = context.scope.workflow;
        if ([definition.workflow, ...definition.workflows || []].some((w) => w.handoffBranch)) verifyWorkflowBranch(journal, options.vaultBase);
        if (!step.stepKind || step.stepKind === "task") {
          const task = definition.tasks.find((task2) => task2.id === step.taskId);
          if (!task || !options.tasks) throw new Error("Workflow task adapter is unavailable");
          const stepIndex = journal.snapshot().steps.length - 1;
          await prepareTaskBranch(journal, task, task.workingDirectory || definition.settings.workingDirectory || options.vaultBase, options.vaultBase, context.scope.handoffBranch);
          const prompt = workflowTaskPrompt(task.prompt || "", workflow, context.previous);
          let observing = true;
          const providerFinished = startPhaseTiming(task.taskKind === "code" ? "code" : "provider", step.id, options.timing);
          try {
            return await options.tasks.execute(task, prompt, signal, async (threadId, turnId) => {
              await journal.recordCodexThread(step.id, threadId, turnId, stepIndex);
              await options.onCheckpoint?.(journal.snapshot());
            }, {
              approve: (request, lifetime) => awaitWorkflowApproval(journal, options.runtimeDirectory, request, options.redact, lifetime || signal, options.onCheckpoint),
              onOutput: options.onTaskOutput ? (output) => {
                if (!observing || signal?.aborted) return;
                lease.assertOwned();
                const state = journal.snapshot();
                if (state.phase !== "in_flight" || state.steps.length - 1 !== stepIndex || state.steps[stepIndex].stepId !== step.id) return;
                options.onTaskOutput({ runId: state.runId, workflowId: state.workflowId, taskId: task.id, stepId: step.id, stepIndex, output: options.redact(output) });
              } : void 0
            });
          } finally {
            observing = false;
            providerFinished();
          }
        }
        if (step.stepKind === "delay") {
          const spec = workflowDelay(step.delayValue, step.delayUnit);
          try {
            await waitForWorkflowDelay(spec.milliseconds, signal);
          } catch (error) {
            if (signal?.aborted && error.name === "AbortError") {
              return { succeeded: false, cancelled: true, output: "[delay cancelled; no external effects]" };
            }
            throw error;
          }
          return { succeeded: true, output: spec.output };
        }
        const codeFinished = startPhaseTiming("code", step.id, options.timing);
        try {
          let liveLog = "";
          const output = await runWithVaultMutations(options.vaultMutations, (onVaultMutation) => executeCodeAsync({
            ...step,
            code: step.code || "",
            vaultBase: options.vaultBase,
            cwd: definition.settings.workingDirectory || options.vaultBase,
            input,
            outputs,
            onVaultMutation,
            log: (...args) => {
              liveLog = (liveLog + args.map(String).join(" ") + "\n").slice(-12e3);
              const state = journal.snapshot();
              if (!signal?.aborted) options.onTaskOutput?.({ runId: state.runId, workflowId: state.workflowId, taskId: "", stepId: step.id, stepIndex: state.steps.length - 1, output: options.redact(liveLog) });
            }
          }, signal));
          return { succeeded: true, output };
        } catch (error) {
          return { succeeded: false, cancelled: signal?.aborted || void 0, output: `[code error: ${String(error)}]` };
        } finally {
          codeFinished();
        }
      },
      evaluate: async (...args) => {
        const finished = startPhaseTiming("evaluation", void 0, options.timing);
        try {
          if (!options.evaluate) throw new Error("Model evaluation is not supported by this host");
          return await options.evaluate(...args);
        } finally {
          finished();
        }
      },
      redact: options.redact,
      onTransitionError: () => {
      },
      onCheckpoint: options.onCheckpoint
    }, { signal: options.signal, maxSteps: options.maxSteps });
  } catch (error) {
    failed = true;
    failure = error;
    throw error;
  } finally {
    const cleanupErrors = [];
    try {
      ownedAdmission?.finish();
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      if (ownsLease) lease.release();
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (cleanupErrors.length) {
      const errors = failed ? [failure, ...cleanupErrors] : cleanupErrors;
      throw Object.assign(new Error(`Workflow resource cleanup failed: ${errors.map(String).join("; ")}`), {
        cause: failed ? failure : cleanupErrors[0],
        errors
      });
    }
  }
}

// code-workflow-adapter.ts
function createCodeWorkflowAdapter(vaultBase, workingDirectory = vaultBase, vaultMutations) {
  const supports = (task) => task.taskKind === "code";
  return {
    supports,
    async execute(task, _prompt, signal, _recordThread, interaction) {
      if (!supports(task)) throw new Error("Unsupported Code task");
      if (signal?.aborted) throw new Error("Code task cancelled before execution");
      if (!(task.code || task.prompt || "").trim()) return { succeeded: false, output: "[AutoOC] Code task not launched: code is empty." };
      let output = "[running code task...]\n";
      try {
        const result = await runWithVaultMutations(vaultMutations, (onVaultMutation) => executeCodeAsync({
          ...task,
          code: task.code || task.prompt || "",
          exposePaths: false,
          vaultBase,
          cwd: task.workingDirectory || workingDirectory,
          onVaultMutation,
          log: (...args) => {
            output += args.map(String).join(" ") + "\n";
            interaction?.onOutput?.(output);
          }
        }, signal));
        output += result;
        return { succeeded: true, output };
      } catch (error) {
        return { succeeded: false, cancelled: signal?.aborted || void 0, output: output + `[code error: ${String(error)}]` };
      }
    }
  };
}

// codex-execution.ts
async function executeCodexTask(client, request) {
  if (!request.prompt?.trim()) throw new Error("Codex task prompt is empty");
  return await client.run(
    request.prompt,
    request.model || void 0,
    request.reasoningEffort || void 0,
    request.interactive ? "on-request" : "never"
  );
}

// codex-client.ts
var import_child_process6 = require("child_process");
var import_string_decoder2 = require("string_decoder");
var fs15 = __toESM(require("fs"));
var os = __toESM(require("os"));
var path16 = __toESM(require("path"));
function codexResultOutput(messages, status) {
  const transcript = messages.map((item) => item.text).filter(Boolean).join("\n\n").trim();
  const finals = messages.filter((item) => item.completed && item.phase === "final_answer");
  const output = status === "completed" && finals.length ? finals.map((item) => item.text).join("\n\n").trim() : transcript;
  return { output, ...output !== transcript ? { transcript } : {} };
}
var JsonLineRpcPeer = class {
  constructor(writeLine, onMessage) {
    this.writeLine = writeLine;
    this.onMessage = onMessage;
    this.buffer = "";
    // stdout may split a UTF-8 character across data events. Keep bytes per peer.
    this.decoder = new import_string_decoder2.StringDecoder("utf8");
    this.nextId = 1;
    this.pending = /* @__PURE__ */ new Map();
  }
  feed(chunk) {
    this.buffer += typeof chunk === "string" ? chunk : this.decoder.write(chunk);
    while (true) {
      const newline = this.buffer.indexOf("\n");
      if (newline < 0) return;
      const raw = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!raw) continue;
      let message;
      try {
        message = JSON.parse(raw);
      } catch {
        continue;
      }
      if (message.id !== void 0 && !message.method && (message.result !== void 0 || message.error)) {
        const pending = this.pending.get(message.id);
        if (!pending) continue;
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error) {
          pending.reject(new Error(message.error.message || `Codex RPC error ${message.error.code ?? "unknown"}`));
        } else {
          pending.resolve(message.result);
        }
        continue;
      }
      this.onMessage(message);
    }
  }
  request(method, params = {}, timeoutMs = 3e4) {
    const id = this.nextId++;
    return new Promise((resolve11, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex RPC request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve11, reject, timer });
      this.writeLine(JSON.stringify({ id, method, params }) + "\n");
    });
  }
  notify(method, params = {}) {
    this.writeLine(JSON.stringify({ method, params }) + "\n");
  }
  respond(id, result) {
    this.writeLine(JSON.stringify({ id, result }) + "\n");
  }
  rejectAll(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
};
function resolveCodexNativeBin(bin) {
  if (os.platform() !== "win32" || !path16.isAbsolute(bin) || !/^codex\.(cmd|bat|ps1)$/i.test(path16.basename(bin))) return bin;
  try {
    if (!fs15.statSync(bin).isFile()) return bin;
  } catch {
    return bin;
  }
  const target = process.arch === "x64" ? "x86_64-pc-windows-msvc" : process.arch === "arm64" ? "aarch64-pc-windows-msvc" : void 0;
  if (!target) return bin;
  const scope = path16.join(path16.dirname(bin), "node_modules", "@openai");
  const platformPackage = `codex-win32-${process.arch}`;
  const vendors = [
    path16.join(scope, "codex", "node_modules", "@openai", platformPackage, "vendor"),
    path16.join(scope, platformPackage, "vendor"),
    path16.join(scope, "codex", "vendor")
  ];
  for (const vendor of vendors) for (const directory2 of ["bin", "codex"]) {
    const candidate = path16.join(vendor, target, directory2, "codex.exe");
    try {
      if (fs15.statSync(candidate).isFile()) return candidate;
    } catch {
    }
  }
  return bin;
}
function resolveCodexBin(configured = "codex") {
  const requested = (configured.trim() || "codex").replace(/^~(?=[/\\])/, os.homedir());
  if (path16.isAbsolute(requested)) return resolveCodexNativeBin(requested);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(requested)) return "";
  const windows = os.platform() === "win32";
  const extensions = windows && !path16.extname(requested) ? [".exe", ".cmd", ".bat", ".ps1"] : [""];
  const directories = (process.env.PATH || process.env.Path || "").split(path16.delimiter).map((value) => value.trim().replace(/^"|"$/g, "")).filter((directory2) => path16.isAbsolute(directory2));
  const candidates = [];
  const addDirectory = (directory2) => {
    if (path16.isAbsolute(directory2)) for (const extension of extensions) candidates.push(path16.join(directory2, requested + extension));
  };
  directories.forEach(addDirectory);
  if (requested === "codex") {
    const home = os.homedir();
    [
      path16.join(home, ".local", "bin"),
      path16.join(home, ".npm-global", "bin"),
      path16.join(home, ".bun", "bin"),
      path16.join(home, "bin")
    ].forEach(addDirectory);
    if (windows && process.env.APPDATA) addDirectory(path16.join(process.env.APPDATA, "npm"));
    if (!windows) ["/opt/homebrew/bin", "/usr/local/bin"].forEach(addDirectory);
  }
  if (windows && requested === "codex") {
    const localAppData = process.env.LOCALAPPDATA || "";
    const desktopBinRoot = path16.join(localAppData, "OpenAI", "Codex", "bin");
    try {
      const versionDirs = (path16.isAbsolute(desktopBinRoot) ? fs15.readdirSync(desktopBinRoot, { withFileTypes: true }) : []).filter((entry) => entry.isDirectory()).map((entry) => path16.join(desktopBinRoot, entry.name, "codex.exe")).filter((candidate) => fs15.existsSync(candidate)).sort((a, b) => fs15.statSync(b).mtimeMs - fs15.statSync(a).mtimeMs);
      candidates.push(...versionDirs);
    } catch {
    }
    if (path16.isAbsolute(localAppData)) candidates.push(path16.join(localAppData, "OpenAI", "Codex", "codex.exe"));
  }
  const selected = candidates.find((candidate) => {
    try {
      if (!fs15.statSync(candidate).isFile()) return false;
      fs15.accessSync(candidate, fs15.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
  return selected ? resolveCodexNativeBin(selected) : "";
}
function buildCodexThreadUrl(threadId) {
  return `codex://threads/${encodeURIComponent(threadId)}`;
}
function openCodexThread(threadId) {
  if (!threadId?.trim()) throw new Error("Exact Codex thread identity is required");
  return openCodexUrl(buildCodexThreadUrl(threadId));
}
function openCodexUrl(url) {
  const launcher = process.platform === "win32" ? {
    bin: "powershell.exe",
    args: [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      Buffer.from("$ErrorActionPreference = 'Stop'\nStart-Process -FilePath $env:AUTOOC_CODEX_URL", "utf16le").toString("base64")
    ],
    env: { ...process.env, AUTOOC_CODEX_URL: url }
  } : process.platform === "darwin" ? { bin: "open", args: [url], env: process.env } : { bin: "xdg-open", args: [url], env: process.env };
  return new Promise((resolve11, reject) => {
    const child = (0, import_child_process6.spawn)(launcher.bin, launcher.args, {
      detached: false,
      stdio: "ignore",
      windowsHide: true,
      env: launcher.env
    });
    let settled = false;
    child.once("error", (error) => {
      settled = true;
      reject(error);
    });
    child.once("close", (code) => {
      if (settled) return;
      if (code === 0) resolve11();
      else reject(new Error(`ChatGPT/Codex URL launcher exited with code ${code ?? "unknown"}`));
    });
  });
}
var CodexAppServerClient = class {
  constructor(bin, cwd, callbacks = {}) {
    this.bin = bin;
    this.cwd = cwd;
    this.callbacks = callbacks;
    this.child = null;
    this.peer = null;
    this.initialized = false;
    this.disposed = false;
    this.stderr = "";
    this.output = "";
    this.agentMessages = /* @__PURE__ */ new Map();
    this.threadId = "";
    this.turnId = "";
    this.approvals = /* @__PURE__ */ new Map();
    this.reconcileTimer = null;
    this.reconciling = false;
  }
  async initialize() {
    if (this.initialized) return;
    if (!this.bin) throw new Error("Codex CLI was not found. Set its executable in AutoOC Settings > Harnesses > Codex CLI.");
    if (process.platform === "win32" && /\.(cmd|bat|ps1)$/i.test(this.bin)) {
      throw new Error(`Codex background execution requires a native App Server executable. No native binary was found for ${this.bin}. Update this Codex CLI installation or select its codex.exe in Settings; no alternative installation was started.`);
    }
    this.child = (0, import_child_process6.spawn)(this.bin, ["app-server"], {
      cwd: this.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    this.peer = new JsonLineRpcPeer(
      (line) => this.child?.stdin.write(line),
      (message) => void this.handleMessage(message)
    );
    this.child.stdout.on("data", (chunk) => this.peer?.feed(chunk));
    this.child.stderr.on("data", (chunk) => {
      this.stderr = (this.stderr + chunk.toString()).slice(-2e4);
      this.callbacks.onDiagnostic?.(chunk.toString());
    });
    this.child.on("error", (error) => this.fail(error));
    this.child.on("exit", (code, signal) => {
      if (!this.disposed) {
        const detail = this.stderr.trim();
        this.fail(new Error(`Codex App Server exited (${signal || (code ?? "unknown")})${detail ? `: ${detail}` : ""}`));
      }
    });
    await this.peer.request("initialize", {
      clientInfo: { name: "auto-oc", title: "AutoOC", version: "1.5.11" },
      capabilities: {}
    }, 15e3);
    this.peer.notify("initialized");
    this.initialized = true;
  }
  async listModels() {
    await this.initialize();
    const response = await this.peer.request("model/list", { limit: 100, includeHidden: false });
    return (response?.data || []).map((model) => ({
      value: model.model || model.id,
      label: model.displayName || model.model || model.id,
      defaultReasoningEffort: model.defaultReasoningEffort,
      supportedReasoningEfforts: (model.supportedReasoningEfforts || []).map((entry) => entry.reasoningEffort || entry.value || entry),
      isDefault: !!model.isDefault
    }));
  }
  async createThread(name) {
    await this.initialize();
    const response = await this.peer.request("thread/start", {
      cwd: this.cwd,
      approvalPolicy: "on-request",
      sandbox: "workspace-write",
      ephemeral: false,
      serviceName: "AutoOC"
    });
    const threadId = response?.thread?.id || "";
    if (!threadId) throw new Error("Codex did not return a thread id");
    if (name) {
      await this.peer.request("thread/inject_items", {
        threadId,
        items: [{
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "" }]
        }]
      });
      await this.peer.request("thread/name/set", { threadId, name });
    }
    return threadId;
  }
  async run(prompt, model, effort, approvalPolicy = "on-request", options = {}) {
    await this.initialize();
    let draftConfig;
    if (options.toolsDisabled) {
      const current = await this.peer.request("config/read", { includeLayers: false });
      if (!current?.config || typeof current.config !== "object") throw new Error("Codex could not verify draft-only configuration. Update its CLI and try again.");
      draftConfig = {
        "features.apps": false,
        "features.shell_tool": false,
        "features.unified_exec": false,
        "features.multi_agent": false,
        "tools.view_image": false,
        web_search: "disabled",
        mcp_servers: Object.fromEntries(Object.keys(current.config.mcp_servers || {}).map((name) => [name, { enabled: false }]))
      };
    }
    this.output = "";
    this.agentMessages.clear();
    this.turnId = "";
    const threadResponse = await this.peer.request("thread/start", {
      cwd: this.cwd,
      model: model || null,
      approvalPolicy,
      sandbox: options.sandbox || "workspace-write",
      ephemeral: options.ephemeral === true,
      ...draftConfig ? { config: draftConfig } : {},
      serviceName: "AutoOC"
    });
    this.threadId = threadResponse?.thread?.id || "";
    if (!this.threadId) throw new Error("Codex did not return a thread id");
    await this.callbacks.onThreadCreated?.({ threadId: this.threadId });
    const completion = new Promise((resolve11, reject) => {
      this.completionResolve = resolve11;
      this.completionReject = reject;
    });
    void completion.catch(() => {
    });
    let turnResponse;
    try {
      turnResponse = await this.peer.request("turn/start", {
        threadId: this.threadId,
        input: [{ type: "text", text: prompt }],
        model: model || null,
        effort: effort || null,
        approvalPolicy,
        cwd: this.cwd
      });
    } catch (error) {
      this.completionResolve = void 0;
      this.completionReject = void 0;
      throw error;
    }
    this.turnId = turnResponse?.turn?.id || "";
    if (!this.turnId) throw new Error("Codex did not return a turn id");
    await this.callbacks.onStarted?.({ threadId: this.threadId, turnId: this.turnId });
    if (this.completionResolve) {
      this.reconcileTimer = setInterval(() => {
        void this.reconcileTurn();
      }, 3e4);
      this.reconcileTimer.unref?.();
    }
    return completion;
  }
  stopReconciliation() {
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
    this.reconcileTimer = null;
  }
  async reconcileTurn() {
    if (this.disposed || this.reconciling || !this.completionResolve || !this.peer || !this.turnId) return;
    this.reconciling = true;
    const threadId = this.threadId, turnId = this.turnId;
    try {
      const turn = await this.readExistingTurn(threadId, turnId);
      if (this.disposed || !this.completionResolve || threadId !== this.threadId || turnId !== this.turnId) return;
      if (!turn || !["completed", "failed", "interrupted"].includes(turn.status)) return;
      for (const item of turn.items || []) {
        if (item.type === "agentMessage") this.handleMessage({ method: "item/completed", params: { threadId, item } });
      }
      this.handleMessage({ method: "turn/completed", params: { threadId, turn } });
    } catch {
      this.callbacks.onDiagnostic?.("[AutoOC] Could not reconcile Codex turn; retaining current state.\n");
    } finally {
      this.reconciling = false;
    }
  }
  // Read only: reconnecting must never create a new thread or start a turn.
  // Absence/mismatch is uncertainty, not evidence that effects did not occur.
  async readExistingTurn(threadId, turnId) {
    if (!threadId?.trim() || !turnId?.trim()) throw new Error("Exact Codex thread and turn identities are required");
    await this.initialize();
    let result;
    try {
      result = await this.peer.request("thread/read", { threadId, includeTurns: true }, 15e3);
    } catch (error) {
      if (!/^thread not loaded(?::|$)/i.test(String(error.message))) throw error;
      result = await this.peer.request("thread/resume", { threadId }, 15e3);
    }
    if (result?.thread?.id !== threadId) throw new Error("Codex thread identity mismatch");
    const matches = result.thread.turns?.filter((turn) => turn.id === turnId);
    if (!Array.isArray(matches) || matches.length !== 1) throw new Error("Exact Codex turn is unavailable");
    return matches[0];
  }
  async readExistingResult(threadId, turnId) {
    const turn = await this.readExistingTurn(threadId, turnId);
    const messages = /* @__PURE__ */ new Map();
    for (const item of turn.items || []) if (item.type === "agentMessage" && typeof item.text === "string") {
      messages.set(String(item.id || "legacy"), { text: item.text, phase: item.phase, completed: true });
    }
    const status = String(turn.status || "unknown");
    return { ...codexResultOutput([...messages.values()], status), threadId, turnId, status, error: turn.error?.message || turn.error?.additionalDetails };
  }
  getIds() {
    return { threadId: this.threadId, turnId: this.turnId };
  }
  resolveApproval(requestId2, approved) {
    const approval = this.approvals.get(requestId2);
    if (!approval || !this.peer) return false;
    this.approvals.delete(requestId2);
    if (approval.kind === "permissions") {
      this.peer.respond(requestId2, {
        permissions: approved ? approval.params.permissions || {} : {},
        scope: "turn"
      });
    } else {
      this.peer.respond(requestId2, { decision: approved ? "accept" : "decline" });
    }
    return true;
  }
  async interrupt() {
    if (this.peer && this.threadId && this.turnId) {
      try {
        await this.peer.request("turn/interrupt", { threadId: this.threadId, turnId: this.turnId }, 5e3);
      } catch {
      }
    }
    this.dispose();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stopReconciliation();
    this.peer?.rejectAll(new Error("Codex client closed"));
    this.completionReject?.(new Error("Codex client closed"));
    this.completionReject = void 0;
    this.completionResolve = void 0;
    this.child?.kill();
    this.child = null;
  }
  handleMessage(message) {
    if (message.id !== void 0 && message.method) {
      const approval = this.toApproval(message);
      if (approval) {
        this.approvals.set(message.id, approval);
        this.callbacks.onApproval?.(approval);
      } else {
        this.peer?.respond(message.id, {});
      }
      return;
    }
    if (message.method === "item/agentMessage/delta") {
      const delta = String(message.params?.delta || "");
      if (delta) {
        const id = String(message.params?.itemId || "legacy");
        const item = this.agentMessages.get(id) || { text: "", completed: false };
        if (!item.completed) {
          item.text += delta;
          this.agentMessages.set(id, item);
          this.publishAgentMessages();
        }
      }
      return;
    }
    if (message.method === "item/started" || message.method === "item/completed") {
      const item = message.params?.item;
      if (item?.type === "agentMessage" && typeof item.text === "string") {
        const id = String(item.id || "legacy");
        const previous = this.agentMessages.get(id);
        const completed = message.method === "item/completed";
        this.agentMessages.set(id, {
          text: completed ? item.text : previous?.text ?? item.text,
          phase: item.phase ?? previous?.phase,
          completed: completed || !!previous?.completed
        });
        this.publishAgentMessages();
      }
      return;
    }
    if (message.method === "turn/completed") {
      const turn = message.params?.turn || {};
      if (message.params?.threadId && message.params.threadId !== this.threadId) return;
      if (this.turnId && turn.id && turn.id !== this.turnId) return;
      this.stopReconciliation();
      const status = String(turn.status || "completed");
      const error = turn.error?.message || turn.error?.additionalDetails || void 0;
      this.completionResolve?.({
        ...codexResultOutput([...this.agentMessages.values()], status),
        threadId: this.threadId,
        turnId: turn.id || this.turnId,
        status,
        error
      });
      this.completionResolve = void 0;
      this.completionReject = void 0;
    }
  }
  publishAgentMessages() {
    this.output = [...this.agentMessages.values()].map((item) => item.text).filter(Boolean).join("\n\n");
    this.callbacks.onOutput?.(this.output);
  }
  toApproval(message) {
    const method = message.method || "";
    const params = message.params || {};
    let kind;
    if (method === "item/commandExecution/requestApproval") kind = "command";
    else if (method === "item/fileChange/requestApproval") kind = "file-change";
    else if (method === "item/permissions/requestApproval") kind = "permissions";
    else return null;
    const summary2 = String(params.reason || params.command || (kind === "command" ? "Codex wants to run a command" : kind === "file-change" ? "Codex wants to change files" : "Codex requests additional permissions"));
    return { requestId: message.id, method, kind, summary: summary2, params };
  }
  fail(error) {
    this.stopReconciliation();
    this.peer?.rejectAll(error);
    this.completionReject?.(error);
    this.completionReject = void 0;
    this.completionResolve = void 0;
  }
};

// codex-workflow-adapter.ts
var fs16 = __toESM(require("fs"));
function codexWorkflowAdapter(createClient, defaults = {}) {
  return {
    supports: (task) => task.taskKind === "codex" && (task.interactiveTerminal === void 0 || typeof task.interactiveTerminal === "boolean"),
    async execute(task, prompt, signal, recordThread, interaction) {
      if (task.taskKind !== "codex") throw new Error("Unsupported autonomous Codex task");
      if (task.interactiveTerminal !== void 0 && typeof task.interactiveTerminal !== "boolean") throw new Error("interactiveTerminal must be boolean");
      if (task.interactiveTerminal && !interaction) throw new Error("Interactive Codex requires an approval channel");
      if (signal?.aborted) throw new Error("Codex execution cancelled before launch");
      const lifetime = new AbortController();
      let approvalError;
      const client = createClient(task, { onThreadCreated: async ({ threadId }) => {
        if (!recordThread) throw new Error("Durable Codex identity recorder is required");
        await recordThread(threadId);
      }, onStarted: async ({ threadId, turnId }) => {
        if (!recordThread) throw new Error("Durable Codex identity recorder is required");
        await recordThread(threadId, turnId);
      }, onApproval: async (request) => {
        try {
          const approved = task.interactiveTerminal ? await interaction.approve(request, lifetime.signal) : false;
          if (!lifetime.signal.aborted && !client.resolveApproval?.(request.requestId, approved)) throw new Error("Codex approval is no longer active");
        } catch (error) {
          approvalError = error;
          await client.interrupt();
        }
      } });
      const abort = () => {
        lifetime.abort();
        void client.interrupt().catch(() => {
        });
      };
      signal?.addEventListener("abort", abort, { once: true });
      try {
        const result = await executeCodexTask(client, {
          prompt,
          model: task.model || defaults.model,
          reasoningEffort: task.reasoningEffort || defaults.reasoningEffort || "medium",
          interactive: !!task.interactiveTerminal
        });
        if (approvalError) throw approvalError;
        if (signal?.aborted) throw new Error("Codex execution cancelled; reconcile its outcome");
        return { succeeded: result.status === "completed", output: result.output || result.error || "(no output)", ...result.status === "interrupted" ? { cancelled: true } : {} };
      } finally {
        lifetime.abort();
        signal?.removeEventListener("abort", abort);
        client.dispose();
      }
    }
  };
}
function createCodexWorkflowAdapter(definition, vaultBase) {
  const directory2 = (task) => {
    const cwd = fs16.realpathSync(task.workingDirectory || definition.settings.workingDirectory || vaultBase);
    if (!fs16.statSync(cwd).isDirectory()) throw new Error("Codex working directory is unavailable");
    return cwd;
  };
  const create = (task, callbacks) => {
    const bin = resolveCodexBin(definition.settings.codexPath);
    const client = new CodexAppServerClient(bin, directory2(task), {
      ...callbacks,
      onStarted: async (ids) => {
        await callbacks?.onStarted?.(ids);
        if (task.interactiveTerminal) await openCodexThread(ids.threadId);
      },
      onApproval: (request) => {
        if (callbacks?.onApproval) callbacks.onApproval(request);
        else client.resolveApproval(request.requestId, false);
      }
    });
    return client;
  };
  const adapter = codexWorkflowAdapter(create, { model: definition.settings.defaultCodexModel, reasoningEffort: definition.settings.defaultCodexReasoningEffort });
  adapter.reconcile = async (task, threadId, turnId) => {
    const client = create(task, {});
    try {
      return await client.readExistingResult(threadId, turnId);
    } finally {
      client.dispose();
    }
  };
  return adapter;
}

// cli-workflow-adapters.ts
var fs22 = __toESM(require("fs"));
var path23 = __toESM(require("path"));

// interactive-cli-task.ts
var fs20 = __toESM(require("fs"));
var path21 = __toESM(require("path"));

// interactive-cli.ts
var fs19 = __toESM(require("fs"));
var path20 = __toESM(require("path"));
var os4 = __toESM(require("os"));

// cli-launchers.ts
var fs18 = __toESM(require("fs"));
var path18 = __toESM(require("path"));
var os2 = __toESM(require("os"));

// interactive-task-terminal.ts
var InteractiveTerminalLaunchUncertainError = class extends Error {
  constructor() {
    super(...arguments);
    this.code = "AUTOOC_TERMINAL_UNCERTAIN";
  }
};

// cli-launchers.ts
var crypto = __toESM(require("crypto"));
var import_child_process7 = require("child_process");

// execution-files.ts
var fs17 = __toESM(require("fs"));
var path17 = __toESM(require("path"));
var AUXILIARY_COMPLETION = "autooc-cleanup.json";
var files = {
  interactive: ["prompt.txt", "state.json", ".gitignore"],
  runtime: ["stdout.txt", "stderr.txt", "done.txt", "process.pid", "instruction.txt", "input.txt", "launch.ps1", "launch.sh", "launch.vbs"]
};
function directoryOnly(directory2) {
  const stat = fs17.lstatSync(directory2);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("AutoOC auxiliary directory is redirected or invalid");
}
function validateDirectory(directory2, kind) {
  const root = path17.dirname(directory2);
  if (path17.basename(root) !== "auxiliary" || path17.basename(path17.dirname(root)) !== ".autooc" || !new RegExp(`^${kind}-[A-Za-z0-9]{6}$`).test(path17.basename(directory2))) {
    throw new Error("Invalid AutoOC auxiliary directory");
  }
  for (const location of [path17.dirname(root), root, directory2]) directoryOnly(location);
}
function auxiliaryCompletionRecord(directory2, kind) {
  return JSON.stringify({ schemaVersion: 1, kind, directory: path17.basename(directory2), completed: true });
}
function cleanCompleted(directory2, kind) {
  validateDirectory(directory2, kind);
  const marker = path17.join(directory2, AUXILIARY_COMPLETION);
  const stat = fs17.lstatSync(marker);
  if (!stat.isFile() || stat.isSymbolicLink()) return;
  const receipt = JSON.parse(fs17.readFileSync(marker, "utf8").replace(/^\uFEFF/, ""));
  if (receipt.schemaVersion !== 1 || receipt.kind !== kind || receipt.directory !== path17.basename(directory2) || receipt.completed !== true) return;
  for (const name of files[kind]) {
    try {
      fs17.unlinkSync(path17.join(directory2, name));
    } catch (error) {
      if (error.code !== "ENOENT") return;
    }
  }
  if (fs17.readdirSync(directory2).some((name) => name !== AUXILIARY_COMPLETION)) return;
  fs17.unlinkSync(marker);
  fs17.rmdirSync(directory2);
}
function completeAuxiliaryDirectory(directory2, kind) {
  try {
    validateDirectory(directory2, kind);
    fs17.writeFileSync(path17.join(directory2, AUXILIARY_COMPLETION), auxiliaryCompletionRecord(directory2, kind), { encoding: "utf8", flag: "wx", mode: 384 });
  } catch (error) {
    if (error.code !== "EEXIST") {
      console.warn("AutoOC: auxiliary cleanup pending");
      return;
    }
  }
  try {
    cleanCompleted(directory2, kind);
  } catch {
  }
}
function createAuxiliaryDirectory(cwd, kind) {
  const container = path17.join(path17.resolve(cwd), ".autooc");
  const root = path17.join(container, "auxiliary");
  for (const directory2 of [container, root]) {
    try {
      fs17.mkdirSync(directory2, { mode: 448 });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    directoryOnly(directory2);
  }
  const ignore = path17.join(root, ".gitignore");
  try {
    fs17.writeFileSync(ignore, "*\n", { encoding: "utf8", flag: "wx", mode: 384 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const stat = fs17.lstatSync(ignore);
    if (!stat.isFile() || stat.isSymbolicLink() || fs17.readFileSync(ignore, "utf8") !== "*\n") throw new Error("AutoOC auxiliary ignore rules conflict");
  }
  for (const name of fs17.readdirSync(root)) {
    const previousKind = /^(interactive|runtime)-[A-Za-z0-9]{6}$/.exec(name)?.[1];
    if (previousKind) {
      try {
        cleanCompleted(path17.join(root, name), previousKind);
      } catch {
      }
    }
  }
  return fs17.mkdtempSync(path17.join(root, `${kind}-`));
}

// cli-launchers.ts
function resolveOpencodeBin(configured) {
  const requested = configured?.trim();
  if (requested && requested !== "opencode") return requested;
  const candidates = [];
  const extensions = os2.platform() === "win32" ? [".exe", ".cmd", ".bat"] : [""];
  for (const entry of (process.env.PATH || process.env.Path || "").split(path18.delimiter)) {
    const directory2 = entry.trim().replace(/^"|"$/g, "");
    if (!path18.isAbsolute(directory2)) continue;
    for (const extension of extensions) candidates.push(path18.join(directory2, `opencode${extension}`));
  }
  if (os2.platform() === "win32") {
    candidates.push(`${process.env.APPDATA}\\npm\\opencode.cmd`);
  } else {
    const home = process.env.HOME || "";
    candidates.push(
      `${home}/.bun/bin/opencode`,
      `${home}/.local/bin/opencode`,
      `${home}/.npm-global/bin/opencode`,
      `${home}/bin/opencode`,
      "/opt/homebrew/bin/opencode",
      "/usr/local/bin/opencode"
    );
  }
  const { accessSync: accessSync3, statSync: statSync11, constants: constants3 } = require("fs");
  for (const candidate of candidates) {
    try {
      accessSync3(candidate, constants3.X_OK);
      if (!statSync11(candidate).isFile()) continue;
      return candidate;
    } catch {
    }
  }
  return requested || "opencode";
}
function psSingleQuoted(value) {
  return `'${value.replace(/'/g, "''")}'`;
}
function shSingleQuoted(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
function buildPowerShellEnvLines(env) {
  return Object.entries(env).filter(([key]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)).map(([key, value]) => `$env:${key} = ${psSingleQuoted(value)}`);
}
function isWindows() {
  return process.platform === "win32";
}
function scriptExt() {
  return isWindows() ? ".ps1" : ".sh";
}
function buildShEnvLines(env) {
  return Object.entries(env).filter(([key]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)).map(([key, value]) => `export ${key}=${shSingleQuoted(value)}`);
}
function buildPosixLaunchCommand(bin, cwd, env, args) {
  const envPrefix = Object.entries(env).filter(([key]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)).map(([key, value]) => `${key}=${shSingleQuoted(value)}`).join(" ");
  return `cd ${shSingleQuoted(cwd)} && ${envPrefix ? `${envPrefix} ` : ""}${[bin, ...args].map(shSingleQuoted).join(" ")}`;
}
function appleScriptQuoted(value) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
var LINUX_TERMINAL_CANDIDATES = [
  { cmd: "x-terminal-emulator", args: ["-e"] },
  { cmd: "gnome-terminal", args: ["--"] },
  { cmd: "konsole", args: ["-e"] },
  { cmd: "xfce4-terminal", args: ["-e"] },
  { cmd: "lxterminal", args: ["-e"] },
  { cmd: "alacritty", args: ["-e"] },
  { cmd: "xterm", args: ["-e"] }
];
function commandExists(cmd) {
  try {
    const { execSync } = require("child_process");
    execSync(`command -v ${shSingleQuoted(cmd)}`, { stdio: "ignore", timeout: 5e3 });
    return true;
  } catch {
    return false;
  }
}
function resolveLinuxTerminal(configured) {
  if (configured && configured.trim()) {
    const parts = configured.trim().split(/\s+/);
    const cmd = parts.shift();
    if (commandExists(cmd)) return { cmd, args: [...parts, "-e"] };
    return null;
  }
  for (const candidate of LINUX_TERMINAL_CANDIDATES) {
    if (commandExists(candidate.cmd)) return candidate;
  }
  return null;
}
function openOpencodeCli(bin, cwd, env = {}, args = [], options = {}) {
  if (isWindows()) {
    const envScript = buildPowerShellEnvLines(env).join("; ");
    const runCommand = args.length > 0 ? `$bin = ${psSingleQuoted(bin)}; $argList = @(${args.map(psSingleQuoted).join(",")}); & $bin @argList` : `& ${psSingleQuoted(bin)}`;
    const command2 = `${envScript ? `${envScript}; ` : ""}Set-Location -LiteralPath ${psSingleQuoted(cwd)}; ${runCommand}`;
    const launcher = (0, import_child_process7.spawn)(
      "cmd.exe",
      ["/c", "start", "OpenCode CLI", "/D", cwd, "powershell.exe", "-NoLogo", "-NoExit", "-Command", command2],
      { detached: true, stdio: "ignore", windowsHide: false }
    );
    launcher.on?.("error", (error) => options.onError?.(error));
    launcher.on?.("spawn", () => options.onLaunched?.());
    launcher.unref();
    return;
  }
  const command = buildPosixLaunchCommand(bin, cwd, env, args);
  if (process.platform === "darwin") {
    const script = `tell application "Terminal" to do script ${appleScriptQuoted(command)}`;
    const launcher = (0, import_child_process7.spawn)("osascript", ["-e", script], { detached: true, stdio: "ignore" });
    launcher.on?.("error", (error) => options.onError?.(error));
    launcher.on?.("spawn", () => options.onLaunched?.());
    launcher.unref();
    return;
  }
  if (process.platform === "linux") {
    const terminal = resolveLinuxTerminal(options.linuxTerminal);
    if (!terminal) {
      throw new Error(
        "no supported Linux terminal emulator found (tried x-terminal-emulator, gnome-terminal, konsole, xfce4-terminal, lxterminal, alacritty, xterm)"
      );
    }
    const launcher = (0, import_child_process7.spawn)(terminal.cmd, [...terminal.args, "sh", "-lc", command], { detached: true, stdio: "ignore" });
    launcher.on?.("error", (error) => options.onError?.(error));
    launcher.on?.("spawn", () => options.onLaunched?.());
    launcher.unref();
    return;
  }
}
function openOpencodeCliLongPromptWindows(bin, cwd, env, model, agent, prompt, options = {}) {
  const attempt = crypto.randomBytes(16).toString("hex");
  let directory2;
  try {
    directory2 = createAuxiliaryDirectory(cwd, "interactive");
  } catch (error) {
    options.onError?.(error instanceof Error ? error : new Error(String(error)));
    return;
  }
  const promptFile = path18.join(directory2, "prompt.txt");
  const stateFile = path18.join(directory2, "state.json");
  const ignoreFile = path18.join(directory2, ".gitignore");
  const cleanup = () => completeAuxiliaryDirectory(directory2, "interactive");
  let settled = false;
  let poll;
  let timeout;
  const finish = (error) => {
    if (settled) return;
    settled = true;
    if (timeout) clearTimeout(timeout);
    poll?.unref?.();
    if (error) options.onError?.(error);
    else options.onLaunched?.();
  };
  const stopPolling = () => {
    if (poll) clearInterval(poll);
  };
  try {
    fs18.writeFileSync(ignoreFile, "*\n", { encoding: "utf8", flag: "wx" });
    fs18.writeFileSync(promptFile, prompt, { encoding: "utf8", flag: "wx" });
    const instruction = `Read the full task prompt from ${path18.relative(path18.resolve(cwd), promptFile).split(path18.sep).join("/")} and follow it exactly.`;
    const completionFile = path18.join(directory2, AUXILIARY_COMPLETION);
    const completion = `  ${psSingleQuoted(auxiliaryCompletionRecord(directory2, "interactive"))} | Set-Content -LiteralPath ${psSingleQuoted(completionFile)} -Encoding UTF8`;
    const checkDirectory = `function Test-AutoOCAuxiliary { $item = Get-Item -LiteralPath ${psSingleQuoted(directory2)} -Force -ErrorAction SilentlyContinue; for ($i = 0; $i -lt 3; $i++) { if ($null -eq $item -or -not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { return $false }; $item = Get-Item -LiteralPath $item.Parent.FullName -Force -ErrorAction SilentlyContinue }; return $true }`;
    const runner = [
      "$ErrorActionPreference = 'Stop'",
      checkDirectory,
      `Set-Location -LiteralPath ${psSingleQuoted(path18.resolve(cwd))}`,
      "try {",
      `  $target = Get-Command -Name ${psSingleQuoted(bin)} -CommandType Application,ExternalScript -ErrorAction Stop | Select-Object -First 1`,
      `  $cliArgs = @(${options.promptArgs ? options.promptArgs(instruction).map(psSingleQuoted).join(", ") : `${options.opencodeMajor === 2 ? "'mini', '--standalone', " : ""}'-m', ${psSingleQuoted(model)}${agent ? `, '--agent', ${psSingleQuoted(agent)}` : ""}, '--prompt', ${psSingleQuoted(instruction)}`})`,
      "  & $target.Source @cliArgs",
      "  exit $LASTEXITCODE",
      "} catch { Write-Error 'AutoOC: interactive CLI invocation failed' -ErrorAction Continue; exit 1 }",
      "finally {",
      `  if (Test-AutoOCAuxiliary) { Remove-Item -LiteralPath ${psSingleQuoted(promptFile)} -ErrorAction SilentlyContinue }`,
      // The standalone Node host exits after startup confirmation. Windows may
      // then stop its hidden observer, so the visible runner leaves a completion
      // receipt for cleanup on the next launch if that observer cannot finish.
      `  if ((Test-AutoOCAuxiliary) -and -not (Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue)) {`,
      completion,
      "  }",
      "}"
    ].join("\n");
    const encodedRunner = Buffer.from(runner, "utf16le").toString("base64");
    const observer = [
      "$ErrorActionPreference = 'Stop'",
      checkDirectory,
      "$session = $null; $confirmed = $false",
      `function Report($status, $ended) { if (-not (Test-AutoOCAuxiliary)) { throw 'AutoOC auxiliary directory changed' }; @{ attempt = ${psSingleQuoted(attempt)}; status = $status; ended = $ended; confirmed = $confirmed } | ConvertTo-Json -Compress | Set-Content -LiteralPath ${psSingleQuoted(stateFile)} -Encoding UTF8 }`,
      "try {",
      `  $session = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList @('-NoLogo', '-NoProfile', '-EncodedCommand', '${encodedRunner}') -WorkingDirectory ${psSingleQuoted(path18.resolve(cwd))} -PassThru`,
      "  while (-not $session.HasExited) {",
      "    if (-not $confirmed) {",
      "      $all = @(Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,Name)",
      "      $parents = @($session.Id)",
      "      for ($depth = 0; $depth -lt 16 -and $parents.Count -gt 0; $depth++) {",
      "        $children = @($all | Where-Object { $parents -contains $_.ParentProcessId })",
      "        if (@($children | Where-Object { $_.Name -notmatch '^(powershell|pwsh|cmd|conhost|OpenConsole)\\.exe$' }).Count -gt 0) { $confirmed = $true; Report 'started' $false; break }",
      "        $parents = @($children | ForEach-Object { $_.ProcessId })",
      "      }",
      "    }",
      "    Start-Sleep -Milliseconds 100; $session.Refresh()",
      "  }",
      "  Report 'ended' $true",
      "} catch {",
      "  Report 'error' ($null -eq $session)",
      "  if ($null -ne $session) { $session.WaitForExit(); Report 'error' $true }",
      "} finally {",
      // The observer is the last writer of state.json. If the Node host has
      // exited, it owns final cleanup; the runner leaves a receipt as fallback.
      `  if ($null -ne $session -and $session.HasExited -and -not (Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue) -and (Test-AutoOCAuxiliary)) {`,
      completion,
      `    Remove-Item -LiteralPath ${psSingleQuoted(promptFile)}, ${psSingleQuoted(stateFile)}, ${psSingleQuoted(ignoreFile)} -ErrorAction SilentlyContinue`,
      `    try { if (@([System.IO.Directory]::GetFileSystemEntries(${psSingleQuoted(directory2)})).Count -eq 1 -and (Test-Path -LiteralPath ${psSingleQuoted(completionFile)})) { Remove-Item -LiteralPath ${psSingleQuoted(completionFile)}; [System.IO.Directory]::Delete(${psSingleQuoted(directory2)}, $false) } } catch { }`,
      "  }",
      "}"
    ].join("\n");
    const encodedObserver = Buffer.from(observer, "utf16le").toString("base64");
    if (encodedObserver.length > 3e4 || encodedRunner.length > 3e4) throw new Error("Interactive launcher configuration exceeds Windows command-line limit");
    const readState = () => {
      let state;
      try {
        state = JSON.parse(fs18.readFileSync(stateFile, "utf8").replace(/^\uFEFF/, ""));
      } catch {
        return;
      }
      if (state.attempt !== attempt) return;
      if (state.status === "error") finish(new InteractiveTerminalLaunchUncertainError("Interactive CLI launcher failed; check the session and Windows process inspection availability"));
      else if (state.confirmed === true && (state.status === "started" || state.status === "ended")) finish();
      else if (state.status === "ended") finish(new InteractiveTerminalLaunchUncertainError("Interactive CLI exited without confirmed startup"));
      if (state.ended === true && (state.status === "ended" || state.status === "error")) {
        stopPolling();
        cleanup();
      }
    };
    poll = setInterval(readState, 100);
    timeout = setTimeout(() => finish(new InteractiveTerminalLaunchUncertainError("Interactive CLI startup was not confirmed within 30 seconds; prompt retained until session exit")), 3e4);
    const launcher = (0, import_child_process7.spawn)("powershell.exe", ["-NoLogo", "-NoProfile", "-EncodedCommand", encodedObserver], {
      // A detached hidden PowerShell can exit without executing its command on
      // Windows. The observer does not need a new process group; unref below
      // releases the host after confirmation while its visible session runs.
      detached: false,
      stdio: "ignore",
      windowsHide: true,
      env: { ...process.env, ...env }
    });
    launcher.on?.("error", () => {
      stopPolling();
      cleanup();
      finish(new Error("Could not start the interactive CLI observer"));
    });
    launcher.on?.("exit", () => {
      readState();
      stopPolling();
      finish(new InteractiveTerminalLaunchUncertainError("Interactive CLI observer exited without startup confirmation; prompt retained"));
    });
    launcher.unref();
  } catch (error) {
    stopPolling();
    cleanup();
    finish(error instanceof Error ? error : new Error(String(error)));
  }
}
function launchHiddenPS(psScriptFile, pidFile) {
  const fs34 = require("fs");
  const launcherFile = psScriptFile.replace(/\.ps1$/, ".vbs");
  const effectivePidFile = pidFile || psScriptFile.replace(/\.ps1$/, ".pid");
  const quotedPsScriptFile = psScriptFile.replace(/"/g, '""');
  const launcherScript = `Set sh = CreateObject("WScript.Shell")\r
sh.Run "powershell.exe -NoLogo -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File ""${quotedPsScriptFile}""", 0, False\r
`;
  fs34.writeFileSync(launcherFile, launcherScript, "utf8");
  const { spawn: spawn4 } = require("child_process");
  const child = spawn4("wscript.exe", [launcherFile], { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
  const launcherTimer = setTimeout(() => {
    try {
      fs34.unlinkSync(launcherFile);
    } catch {
    }
  }, 1e4);
  const scriptTimer = setTimeout(() => {
    try {
      fs34.unlinkSync(psScriptFile);
    } catch {
    }
  }, 6e5);
  const cleanup = (removeScript = false) => {
    clearTimeout(launcherTimer);
    clearTimeout(scriptTimer);
    try {
      fs34.unlinkSync(launcherFile);
    } catch {
    }
    if (removeScript) {
      try {
        fs34.unlinkSync(psScriptFile);
      } catch {
      }
    }
  };
  const kill = () => {
    let killedChildTree = false;
    if (child.pid) {
      try {
        const killer = spawn4("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { detached: true, stdio: "ignore", windowsHide: true });
        killer.unref();
        killedChildTree = true;
      } catch {
      }
    }
    if (!killedChildTree) {
      try {
        child.kill();
      } catch {
      }
    }
    try {
      const pid = fs34.existsSync(effectivePidFile) ? String(fs34.readFileSync(effectivePidFile, "utf8")).trim() : "";
      if (/^\d+$/.test(pid) && pid !== String(child.pid || "")) {
        const killer = spawn4("taskkill.exe", ["/PID", pid, "/T", "/F"], { detached: true, stdio: "ignore", windowsHide: true });
        killer.unref();
      }
    } catch {
    }
    cleanup(true);
    try {
      fs34.unlinkSync(effectivePidFile);
    } catch {
    }
  };
  const callbacks = [];
  let launchError = null;
  child.on?.("error", (error) => {
    launchError = error;
    cleanup(true);
    callbacks.forEach((callback) => callback(error));
  });
  return {
    kill,
    cleanup,
    onError: (callback) => {
      if (launchError) callback(launchError);
      else callbacks.push(callback);
    }
  };
}
function launchHiddenSh(shScriptFile, pidFile) {
  const fs34 = require("fs");
  const { spawn: spawn4 } = require("child_process");
  const effectivePidFile = pidFile || shScriptFile.replace(/\.sh$/, ".pid");
  try {
    fs34.chmodSync(shScriptFile, 448);
  } catch {
  }
  const child = spawn4("/bin/sh", [shScriptFile], { detached: true, stdio: "ignore" });
  child.unref();
  const scriptTimer = setTimeout(() => {
    try {
      fs34.unlinkSync(shScriptFile);
    } catch {
    }
  }, 6e5);
  const cleanup = (removeScript = false) => {
    clearTimeout(scriptTimer);
    if (removeScript) {
      try {
        fs34.unlinkSync(shScriptFile);
      } catch {
      }
    }
  };
  const kill = () => {
    let killedChildTree = false;
    if (child.pid) {
      try {
        process.kill(-child.pid, "SIGKILL");
        killedChildTree = true;
      } catch {
      }
    }
    if (!killedChildTree) {
      try {
        child.kill("SIGKILL");
      } catch {
      }
    }
    try {
      const pid = fs34.existsSync(effectivePidFile) ? String(fs34.readFileSync(effectivePidFile, "utf8")).trim() : "";
      if (/^\d+$/.test(pid) && pid !== String(child.pid || "")) {
        try {
          process.kill(-Number(pid), "SIGKILL");
        } catch {
        }
        try {
          process.kill(Number(pid), "SIGKILL");
        } catch {
        }
      }
    } catch {
    }
    cleanup(true);
    try {
      fs34.unlinkSync(effectivePidFile);
    } catch {
    }
  };
  const callbacks = [];
  let launchError = null;
  child.on?.("error", (error) => {
    launchError = error;
    cleanup(true);
    callbacks.forEach((callback) => callback(error));
  });
  return {
    kill,
    cleanup,
    onError: (callback) => {
      if (launchError) callback(launchError);
      else callbacks.push(callback);
    }
  };
}
function launchHidden(scriptFile, pidFile) {
  return isWindows() ? launchHiddenPS(scriptFile, pidFile) : launchHiddenSh(scriptFile, pidFile);
}
function writeUtf8BomFile(filePath, content) {
  fs18.writeFileSync(filePath, Buffer.concat([Buffer.from([239, 187, 191]), Buffer.from(content, "utf8")]));
}
function psUtf8Prelude() {
  return [
    `$utf8NoBom = New-Object System.Text.UTF8Encoding($false)`,
    `[Console]::OutputEncoding = $utf8NoBom`,
    `$OutputEncoding = $utf8NoBom`
  ];
}

// opencode-version.ts
var import_child_process8 = require("child_process");
var path19 = __toESM(require("path"));
var os3 = __toESM(require("os"));
function parseOpenCodeVersion(text2) {
  const match = text2.trim().match(/^(?:opencode\s+)?v?(\d+)\.(\d+)\.(\d+)(?:[-+][\w.-]+)?$/i);
  return match ? { version: match[0], major: Number(match[1]) } : void 0;
}
function readOpenCodeOutput(bin, args, cwd, timeout, maxBuffer) {
  if (!bin || !path19.isAbsolute(bin) && !/^[\w.-]+$/.test(bin)) throw new Error("Choose an absolute OpenCode executable path or a command name without arguments.");
  let command = bin;
  if (process.platform === "win32" && !/\.exe$/i.test(bin)) {
    command = path19.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    const invocation = [bin, ...args].map((value) => `'${value.replace(/'/g, "''")}'`).join(" ");
    const script = `$ErrorActionPreference = 'Stop'; [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); & ${invocation}; exit $LASTEXITCODE`;
    args = ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")];
  }
  return new Promise((resolve11, reject) => (0, import_child_process8.execFile)(
    command,
    args,
    { cwd, windowsHide: true, timeout, maxBuffer, encoding: "utf8" },
    (error, stdout) => error ? reject(error) : resolve11(stdout)
  ));
}
async function detectOpenCodeVersion(bin) {
  const output = await readOpenCodeOutput(bin, ["--version"], os3.tmpdir(), 1e4, 65536).catch(() => {
    throw new Error("Could not check the OpenCode version. Check its executable path in AutoOC Settings.");
  });
  const detected = parseOpenCodeVersion(output);
  if (!detected) throw new Error("The executable did not report a supported OpenCode version. Check its path in AutoOC Settings.");
  return detected;
}
async function assertOpenCode2(bin) {
  const detected = await detectOpenCodeVersion(bin);
  if (detected.major !== 2) throw new Error(`OpenCode 2 CLI requires version 2.x; detected ${detected.version}. Select its executable in AutoOC Settings, or use an OpenCode 1 task. Nothing was launched.`);
}

// interactive-cli.ts
var INTERACTIVE_CLIS = [
  { id: "opencode", label: "OpenCode 1 CLI", pathKey: "opencodePath" },
  { id: "opencode2", label: "OpenCode 2 CLI", pathKey: "opencode2Path" },
  { id: "codex", label: "Codex CLI", pathKey: "codexPath" },
  { id: "copilot", label: "GitHub Copilot CLI", pathKey: "copilotPath" },
  { id: "claude", label: "Claude Code CLI", pathKey: "claudePath" }
];
function executable(file) {
  try {
    if (!path20.isAbsolute(file) || !fs19.statSync(file).isFile()) return false;
    if (process.platform === "win32" && !/\.(exe|cmd|bat|ps1)$/i.test(file)) return false;
    fs19.accessSync(file, fs19.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
function resolveInteractiveCli(provider, configured) {
  if (provider === "codex") {
    const selected = resolveCodexBin(configured);
    return selected && executable(selected) ? selected : void 0;
  }
  const defaultCommand = provider === "opencode2" ? "opencode" : provider;
  const requested = (configured?.trim() || defaultCommand).replace(/^~(?=[/\\])/, os4.homedir());
  if (path20.isAbsolute(requested)) return executable(requested) ? requested : void 0;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(requested)) return void 0;
  const directories = (process.env.PATH || process.env.Path || "").split(path20.delimiter).map((value) => value.trim().replace(/^"|"$/g, "")).filter((value) => path20.isAbsolute(value));
  if (requested === defaultCommand) {
    const home = os4.homedir();
    directories.push(path20.join(home, ".local", "bin"), path20.join(home, ".npm-global", "bin"), path20.join(home, ".bun", "bin"), path20.join(home, "bin"));
    if (process.platform === "win32") {
      if (process.env.APPDATA) directories.push(path20.join(process.env.APPDATA, "npm"));
    } else directories.push("/opt/homebrew/bin", "/usr/local/bin");
    if (provider === "claude") directories.push(path20.join(home, ".claude", "local"));
  }
  const extensions = process.platform === "win32" && !path20.extname(requested) ? [".exe", ".cmd", ".bat", ".ps1"] : [""];
  for (const directory2 of directories) for (const extension of extensions) {
    const file = path20.join(directory2, requested + extension);
    if (executable(file)) return file;
  }
  return void 0;
}

// interactive-cli-profile.ts
function isInteractiveCliProvider(value) {
  return INTERACTIVE_CLIS.some((cli) => cli.id === value);
}
function interactiveCliTaskArgs(provider, model, agent, instruction, reasoningEffort) {
  if (!isInteractiveCliProvider(provider)) throw new Error("Unsupported interactive CLI provider.");
  if (provider === "opencode" || provider === "opencode2") {
    const args2 = openCodeInteractiveArgs(provider === "opencode2" ? 2 : 1, model, agent, instruction);
    if (!model) args2.splice(args2.indexOf("-m"), 2);
    return args2;
  }
  if (agent) throw new Error(`Interactive CLI agent selection is only supported for OpenCode, not ${provider}.`);
  const args = model ? ["--model", model] : [];
  if (provider === "copilot") return [...args, "--interactive", instruction];
  if (provider === "codex" && reasoningEffort) {
    args.push("--config", `model_reasoning_effort=${JSON.stringify(reasoningEffort)}`);
  }
  return [...args, "--", instruction];
}

// interactive-cli-task.ts
function getCliTaskValidationError(task) {
  if (task.taskKind !== "cli") return task.cliProvider !== void 0 ? "cliProvider is only valid for taskKind cli." : null;
  if (!isInteractiveCliProvider(task.cliProvider)) return "CLI tasks require a known cliProvider: opencode, opencode2, codex, copilot, or claude.";
  if (task.interactiveTerminal !== true) return "CLI tasks require interactiveTerminal: true.";
  if (typeof task.prompt !== "string" || !task.prompt.trim()) return "CLI tasks require a non-empty prompt.";
  for (const field of ["codeAllowVault", "codeAllowFiles", "codeAllowTerminal", "copilotAllowAllTools", "useRalphLoop", "createBranch"]) {
    if (task[field] !== void 0 && task[field] !== false) return `${field} is not supported for interactive CLI tasks.`;
  }
  if (task.branch !== void 0 && task.branch !== "") return "branch is not supported for interactive CLI tasks.";
  if (task.model !== void 0 && typeof task.model !== "string") return "CLI model must be a string when provided.";
  if (task.agent !== void 0 && (typeof task.agent !== "string" || task.agent !== "" && !isOpenCodeTask(task.cliProvider))) return "agent is only supported for OpenCode CLI providers.";
  if (task.forceModel !== void 0 && typeof task.forceModel !== "boolean") return "forceModel must be a boolean when provided.";
  if (task.reasoningEffort !== void 0 && (task.cliProvider !== "codex" || typeof task.reasoningEffort !== "string" || !task.reasoningEffort.trim())) return "reasoningEffort is only valid as a non-empty string for the Codex CLI provider.";
  return null;
}
function prepareCliTask(task, settings, cwd, prompt, signal) {
  const error = getCliTaskValidationError(task);
  if (error) throw new Error(error);
  if (task.taskKind !== "cli") throw new Error("Expected an interactive CLI task.");
  if (signal?.aborted) throw new Error("CLI task cancelled before launch.");
  if (!path21.isAbsolute(cwd) || !fs20.statSync(cwd).isDirectory()) throw new Error("CLI task requires an existing absolute project directory.");
  if (!prompt.trim()) throw new Error("CLI task prompt must be nonempty.");
  const cli = INTERACTIVE_CLIS.find((cli2) => cli2.id === task.cliProvider);
  const bin = resolveInteractiveCli(cli.id, settings[cli.pathKey]);
  if (!bin) throw new Error(`${cli.label} executable was not found. Check AutoOC Settings.`);
  return {
    provider: cli.id,
    bin,
    cwd,
    label: task.name || cli.label,
    major: cli.id === "opencode2" ? 2 : 1,
    model: task.model || "",
    agent: task.forceModel ? "" : task.agent || "",
    prompt,
    reasoningEffort: task.reasoningEffort,
    signal
  };
}
async function launchExternalCliTask(request, linuxTerminal) {
  if (!request.provider || !isInteractiveCliProvider(request.provider)) throw new Error("A CLI task provider is required.");
  if (request.signal?.aborted) throw new Error("CLI task cancelled before launch.");
  if (request.provider === "opencode2") await assertOpenCode2(request.bin);
  if (request.signal?.aborted) throw new Error("CLI task cancelled before launch.");
  const argsForPrompt = (instruction) => interactiveCliTaskArgs(request.provider, request.model, request.agent, instruction, request.reasoningEffort);
  if (process.platform === "win32") {
    await new Promise((resolve11, reject) => openOpencodeCliLongPromptWindows(
      request.bin,
      request.cwd,
      {},
      request.model,
      request.agent,
      request.prompt,
      { onLaunched: resolve11, onError: reject, promptArgs: argsForPrompt }
    ));
    return;
  }
  if (!["linux", "darwin"].includes(process.platform)) throw new Error("Interactive CLI tasks require Windows, macOS or Linux.");
  if (process.platform === "linux" && !resolveLinuxTerminal(linuxTerminal)) throw new Error("No supported Linux terminal is available. Nothing was launched.");
  const directory2 = createAuxiliaryDirectory(request.cwd, "interactive");
  const promptFile = path21.join(directory2, "prompt.txt"), scriptFile = path21.join(directory2, "launch.sh");
  let scriptWritten = false;
  const cleanupBeforeLaunch = () => {
    for (const parent of [path21.dirname(path21.dirname(directory2)), path21.dirname(directory2), directory2]) {
      const stat = fs20.lstatSync(parent);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("CLI auxiliary directory changed; input preserved.");
    }
    if (scriptWritten) fs20.unlinkSync(scriptFile);
    completeAuxiliaryDirectory(directory2, "interactive");
  };
  try {
    fs20.writeFileSync(promptFile, request.prompt, { encoding: "utf8", flag: "wx", mode: 384 });
    const instruction = `Read ${path21.relative(request.cwd, promptFile).split(path21.sep).join("/")} as UTF-8 and follow its instructions.`;
    const q = shSingleQuoted;
    const command = [request.bin, ...argsForPrompt(instruction)].map(q).join(" ");
    const script = [
      "#!/bin/sh",
      "cleanup() {",
      "  status=$?",
      `  if [ -d ${q(directory2)} ] && [ ! -L ${q(directory2)} ] && [ ! -L ${q(path21.dirname(directory2))} ] && [ ! -L ${q(path21.dirname(path21.dirname(directory2)))} ]; then`,
      `    rm -f -- ${q(promptFile)} ${q(scriptFile)}`,
      `    printf '%s' ${q(auxiliaryCompletionRecord(directory2, "interactive"))} > ${q(path21.join(directory2, AUXILIARY_COMPLETION))}`,
      "  fi",
      '  exit "$status"',
      "}",
      "trap cleanup EXIT",
      command
    ].join("\n") + "\n";
    fs20.writeFileSync(scriptFile, script, { encoding: "utf8", flag: "wx", mode: 448 });
    scriptWritten = true;
    if (request.signal?.aborted) {
      throw new Error("CLI task cancelled before launch.");
    }
  } catch (error) {
    cleanupBeforeLaunch();
    throw error;
  }
  await new Promise((resolve11, reject) => {
    let acknowledged = false;
    const failed = (error) => {
      if (acknowledged) return;
      try {
        cleanupBeforeLaunch();
        reject(error);
      } catch (cleanup) {
        reject(cleanup);
      }
    };
    try {
      openOpencodeCli("/bin/sh", request.cwd, {}, [scriptFile], { linuxTerminal, onLaunched: () => {
        acknowledged = true;
        resolve11();
      }, onError: failed });
    } catch (error) {
      failed(error);
    }
  });
}

// copilot-client.ts
var import_child_process9 = require("child_process");
var fs21 = __toESM(require("fs"));
var os5 = __toESM(require("os"));
var path22 = __toESM(require("path"));
function resolveCopilotBin(configured = "copilot") {
  const value = configured.trim() || "copilot";
  const nativeFromShim = (shim) => {
    const npmRoot = path22.join(path22.dirname(shim), "node_modules", "@github");
    const packageName = `copilot-${process.platform}-${process.arch}`;
    const executable2 = process.platform === "win32" ? "copilot.exe" : "copilot";
    return [
      path22.join(npmRoot, "copilot", "node_modules", "@github", packageName, executable2),
      path22.join(npmRoot, packageName, executable2)
    ].find((candidate) => fs21.existsSync(candidate));
  };
  if (value !== "copilot") {
    return /\.(cmd|bat|ps1)$/i.test(value) ? nativeFromShim(value) || value : value;
  }
  const home = os5.homedir();
  const dirs = [
    ...(process.env.PATH || "").split(path22.delimiter),
    path22.join(home, ".local", "bin"),
    path22.join(home, ".npm-global", "bin"),
    ...process.platform === "win32" ? [path22.join(process.env.APPDATA || path22.join(home, "AppData", "Roaming"), "npm")] : ["/opt/homebrew/bin", "/usr/local/bin"]
  ];
  for (const dir of dirs.filter(Boolean)) {
    for (const extension of process.platform === "win32" ? [".exe", ".cmd", ".ps1"] : [""]) {
      const candidate = path22.join(dir.replace(/^"|"$/g, ""), `copilot${extension}`);
      if (fs21.existsSync(candidate)) return nativeFromShim(candidate) || candidate;
    }
  }
  return value;
}
function buildCopilotArgs(prompt, options = {}) {
  if (!prompt.trim()) throw new Error("Copilot task prompt is empty.");
  const args = ["--prompt", prompt, "--silent", "--stream", "on", "--no-color", "--no-ask-user", "--no-auto-update"];
  if (options.model?.trim()) args.push("--model", options.model.trim());
  if (options.allowAllTools === true) {
    args.push("--allow-all-tools");
  } else {
    args.push("--available-tools", "view", "glob", "grep", "--allow-tool=read");
  }
  return args;
}
var CopilotCliClient = class {
  constructor(bin, cwd, onOutput = () => {
  }) {
    this.bin = bin;
    this.cwd = cwd;
    this.onOutput = onOutput;
    this.disposed = false;
  }
  run(prompt, options = {}) {
    if (this.disposed || this.child) return Promise.reject(new Error("Copilot client is no longer available."));
    if (process.platform === "win32" && /\.(cmd|bat|ps1)$/i.test(this.bin)) {
      return Promise.reject(new Error("Select the native copilot.exe executable, or reinstall @github/copilot with optional dependencies enabled."));
    }
    return new Promise((resolve11) => {
      let output = "";
      let error = "";
      let settled = false;
      let timer;
      let promptDir;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        this.finish = void 0;
        if (timer) clearTimeout(timer);
        if (promptDir) {
          try {
            fs21.unlinkSync(path22.join(promptDir, "task.txt"));
            fs21.rmdirSync(promptDir);
          } catch {
          }
        }
        resolve11(result);
      };
      this.finish = finish;
      try {
        let args;
        if (prompt.length > 12e3) {
          promptDir = fs21.mkdtempSync(path22.join(os5.tmpdir(), "autooc-copilot-"));
          const promptFile = path22.join(promptDir, "task.txt");
          fs21.writeFileSync(promptFile, prompt, { encoding: "utf8", mode: 384 });
          args = buildCopilotArgs(`Read the UTF-8 file ${JSON.stringify(promptFile)} and carry out the complete task instructions it contains.`, options);
          args.push("--add-dir", promptDir);
        } else {
          args = buildCopilotArgs(prompt, options);
        }
        this.child = (0, import_child_process9.spawn)(this.bin, args, {
          cwd: this.cwd,
          env: { ...process.env, ...options.env },
          stdio: "pipe",
          shell: false,
          windowsHide: true,
          detached: process.platform !== "win32"
        });
        this.child.stdout.setEncoding("utf8");
        this.child.stderr.setEncoding("utf8");
        this.child.stdout.on("data", (chunk) => {
          if (settled) return;
          output += chunk;
          this.onOutput(output);
        });
        this.child.stderr.on("data", (chunk) => {
          if (!settled) error += chunk;
        });
        this.child.once("error", (failure) => finish({ output, error: failure.message, exitCode: -1 }));
        this.child.once("close", (code) => finish({ output: output.trim(), error: error.trim(), exitCode: code ?? -1 }));
        this.child.stdin.on("error", () => {
        });
        this.child.stdin.end();
        if (options.timeoutMs && options.timeoutMs > 0) {
          timer = setTimeout(() => {
            this.killTree();
            finish({ output, error: `Copilot task timed out after ${options.timeoutMs / 1e3} seconds.`, exitCode: -1 });
          }, options.timeoutMs);
        }
      } catch (failure) {
        finish({ output, error: String(failure), exitCode: -1 });
      }
    });
  }
  killTree() {
    const child = this.child;
    if (!child?.pid || child.exitCode !== null) return;
    if (process.platform === "win32") {
      const killer = (0, import_child_process9.spawn)("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      killer.on("error", () => {
        try {
          child.kill();
        } catch {
        }
      });
    } else {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        try {
          child.kill("SIGKILL");
        } catch {
        }
      }
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.killTree();
    this.finish?.({ output: "", error: "Copilot task cancelled.", exitCode: -1 });
  }
};

// opencode-script.ts
function buildOpenCodeScript(options) {
  const { pidFile, secretEnv, safeCwd, gitCmds, bin, model, effectiveAgent, effectiveTask, promptFile, outFile, errFile, doneFile, taskCwd } = options;
  let launchScript;
  const runArgs = openCodeRunArgs(options.major || 1, model, effectiveAgent, !!effectiveTask.forceModel);
  if (isWindows()) {
    launchScript = [
      `try {`,
      `$PID | Set-Content -LiteralPath ${psSingleQuoted(pidFile)} -Encoding ASCII`,
      ...psUtf8Prelude(),
      `$env:USERPROFILE = ${psSingleQuoted(process.env.USERPROFILE || "")}`,
      `$env:APPDATA     = ${psSingleQuoted(process.env.APPDATA || "")}`,
      `$env:LOCALAPPDATA= ${psSingleQuoted(process.env.LOCALAPPDATA || "")}`,
      `$env:PATH        = ${psSingleQuoted(process.env.PATH || "")}`,
      `$env:HOME        = ${psSingleQuoted(process.env.USERPROFILE || "")}`,
      ...buildPowerShellEnvLines(secretEnv),
      `Set-Location -LiteralPath '${safeCwd}' -ErrorAction Stop`,
      gitCmds ? gitCmds : "",
      `$bin = ${psSingleQuoted(bin)}`,
      `$binExt = [System.IO.Path]::GetExtension($bin)`,
      `$psShim = if ($binExt -ieq '.cmd') { [System.IO.Path]::ChangeExtension($bin, '.ps1') } else { '' }`,
      `$nodeScript = ''`,
      `if ($psShim -and [System.IO.File]::Exists($psShim)) {`,
      `$bin = $psShim`,
      `} elseif ($binExt -ieq '.cmd') {`,
      `$cmdText = Get-Content $bin -Raw -Encoding UTF8`,
      `if ($cmdText -match '"([^"]+\\.exe)"\\s+%\\*') {`,
      `$bin = $Matches[1]`,
      `} elseif ($cmdText -match '"%_prog%"\\s+"%dp0%\\\\([^"]+)"\\s+%\\*') {`,
      `$cmdDir = Split-Path -Parent $bin`,
      `$nodeCandidate = Join-Path $cmdDir 'node.exe'`,
      `$bin = if ([System.IO.File]::Exists($nodeCandidate)) { $nodeCandidate } else { 'node' }`,
      `$nodeScript = Join-Path $cmdDir $Matches[1]`,
      `} else {`,
      `throw "Cannot safely parse npm command shim '$bin' for shell-sensitive prompt text."`,
      `}`,
      `}`,
      `$model = ${psSingleQuoted(model)}`,
      `$agent = ${psSingleQuoted(effectiveAgent)}`,
      `$forceModel = ${effectiveTask.forceModel ? "$true" : "$false"}`,
      `$prompt = Get-Content '${promptFile.replace(/'/g, "''")}' -Raw -Encoding UTF8`,
      `$outFile = ${psSingleQuoted(outFile)}`,
      `$errFile = ${psSingleQuoted(errFile)}`,
      `$opencodeArgs = @()`,
      `if ($nodeScript) {`,
      `$opencodeArgs += $nodeScript`,
      `}`,
      `$opencodeArgs += @(${runArgs.map(psSingleQuoted).join(", ")})`,
      `$opencodeArgs += @('--', $prompt)`,
      `& $bin @opencodeArgs 1>> $outFile 2>> $errFile`,
      `$exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }`,
      `[System.IO.File]::WriteAllText('${doneFile.replace(/'/g, "''")}', [string]$exitCode, [System.Text.Encoding]::UTF8)`,
      `} catch {`,
      `[System.IO.File]::WriteAllText('${outFile.replace(/'/g, "''")}', '', [System.Text.Encoding]::UTF8)`,
      `[System.IO.File]::WriteAllText('${errFile.replace(/'/g, "''")}', $_.Exception.ToString(), [System.Text.Encoding]::UTF8)`,
      `[System.IO.File]::WriteAllText('${doneFile.replace(/'/g, "''")}', '-1', [System.Text.Encoding]::UTF8)`,
      `}`
    ].filter((line) => line !== "").join("\n");
  } else {
    const shEnv = {
      ...secretEnv,
      HOME: process.env.HOME || process.env.USERPROFILE || "",
      PATH: process.env.PATH || ""
    };
    launchScript = [
      `echo $$ > ${shSingleQuoted(pidFile)}`,
      ...buildShEnvLines(shEnv),
      `cd ${shSingleQuoted(taskCwd)} || { printf '%s' '-1' > ${shSingleQuoted(doneFile)}; printf '%s' 'cd failed' > ${shSingleQuoted(errFile)}; exit 1; }`,
      gitCmds ? gitCmds : "",
      `bin=${shSingleQuoted(bin)}`,
      `prompt="$(cat ${shSingleQuoted(promptFile)} 2>/dev/null)"`,
      `set -- ${runArgs.map(shSingleQuoted).join(" ")} -- "$prompt"`,
      `"$bin" "$@" >> ${shSingleQuoted(outFile)} 2>> ${shSingleQuoted(errFile)}`,
      `exit_code=$?`,
      `printf '%s' "$exit_code" > ${shSingleQuoted(doneFile)}`
    ].filter((line) => line !== "").join("\n");
  }
  return launchScript;
}

// command-output.ts
function normalizeCommandOutput(text2) {
  if (!text2) return "";
  const cleaned = text2.replace(/\x1B\[[0-9;]*[A-Za-z]/g, "");
  return cleaned.trim();
}
function extractTouchedFiles(trace) {
  const files2 = /* @__PURE__ */ new Set();
  for (const line of trace.split(/\r?\n/)) {
    const match = line.match(/^[←→]\s+(?:Edit|Write|Read)\s+(.+)$/) || line.match(/^Index:\s+(.+)$/);
    if (match?.[1]) files2.add(match[1].trim());
  }
  return [...files2];
}
function formatTaskOutput(stdout, stderr) {
  const cleanStdout = normalizeCommandOutput(stdout);
  const cleanStderr = normalizeCommandOutput(stderr);
  const parts = [];
  if (cleanStdout) {
    parts.push(`## Response

${cleanStdout}`);
  }
  const touchedFiles = extractTouchedFiles(cleanStderr);
  if (touchedFiles.length > 0) {
    parts.push(`## Touched files

${touchedFiles.map((f) => `- ${f}`).join("\n")}`);
  }
  if (cleanStderr) {
    parts.push(`## OpenCode trace

\`\`\`text
${cleanStderr}
\`\`\``);
  }
  return parts.join("\n\n---\n\n").trim();
}
function countReplacementChars(text2) {
  return (text2.match(/�/g) || []).length;
}
function decodeCp850(bytes) {
  const map = {
    128: "\xC7",
    129: "\xFC",
    130: "\xE9",
    131: "\xE2",
    132: "\xE4",
    133: "\xE0",
    134: "\xE5",
    135: "\xE7",
    136: "\xEA",
    137: "\xEB",
    138: "\xE8",
    139: "\xEF",
    140: "\xEE",
    141: "\xEC",
    142: "\xC4",
    143: "\xC5",
    144: "\xC9",
    145: "\xE6",
    146: "\xC6",
    147: "\xF4",
    148: "\xF6",
    149: "\xF2",
    150: "\xFB",
    151: "\xF9",
    152: "\xFF",
    153: "\xD6",
    154: "\xDC",
    155: "\xF8",
    156: "\xA3",
    157: "\xD8",
    158: "\xD7",
    159: "\u0192",
    160: "\xE1",
    161: "\xED",
    162: "\xF3",
    163: "\xFA",
    164: "\xF1",
    165: "\xD1",
    166: "\xAA",
    167: "\xBA",
    168: "\xBF",
    169: "\xAE",
    170: "\xAC",
    171: "\xBD",
    172: "\xBC",
    173: "\xA1",
    174: "\xAB",
    175: "\xBB"
  };
  let out = "";
  for (const byte of bytes) {
    if (byte < 128) out += String.fromCharCode(byte);
    else out += map[byte] ?? String.fromCharCode(byte);
  }
  return out;
}
function decodeWindows1252(bytes) {
  const map = {
    128: "\u20AC",
    130: "\u201A",
    131: "\u0192",
    132: "\u201E",
    133: "\u2026",
    134: "\u2020",
    135: "\u2021",
    136: "\u02C6",
    137: "\u2030",
    138: "\u0160",
    139: "\u2039",
    140: "\u0152",
    142: "\u017D",
    145: "\u2018",
    146: "\u2019",
    147: "\u201C",
    148: "\u201D",
    149: "\u2022",
    150: "\u2013",
    151: "\u2014",
    152: "\u02DC",
    153: "\u2122",
    154: "\u0161",
    155: "\u203A",
    156: "\u0153",
    158: "\u017E",
    159: "\u0178"
  };
  let out = "";
  for (const byte of bytes) {
    if (byte < 128 || byte >= 160) out += String.fromCharCode(byte);
    else out += map[byte] ?? "";
  }
  return out;
}
function decodeCommandBuffer(bytes) {
  if (bytes.length >= 2) {
    if (bytes[0] === 255 && bytes[1] === 254) return bytes.toString("utf16le");
    if (bytes[0] === 254 && bytes[1] === 255) return Buffer.from(bytes).swap16().toString("utf16le");
  }
  if (bytes.length > 4) {
    let oddNulls = 0;
    let evenNulls = 0;
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0) {
        if (i % 2 === 0) evenNulls++;
        else oddNulls++;
      }
    }
    const nullRatio = (oddNulls + evenNulls) / bytes.length;
    if (nullRatio > 0.2 && oddNulls > evenNulls * 4) return bytes.toString("utf16le");
    if (nullRatio > 0.2 && evenNulls > oddNulls * 4) return Buffer.from(bytes).swap16().toString("utf16le");
  }
  const utf8 = bytes.toString("utf8");
  if (countReplacementChars(utf8) === 0) return utf8;
  const win1252 = decodeWindows1252(bytes);
  const cp850 = decodeCp850(bytes);
  return countReplacementChars(win1252) <= countReplacementChars(cp850) ? win1252 : cp850;
}

// cli-workflow-adapters.ts
function createInteractiveCliWorkflowAdapter(definition, vault, terminal) {
  return { supports: (task) => task.taskKind === "cli", async execute(task, prompt, signal) {
    const cwd = task.workingDirectory || definition.settings.workingDirectory || vault;
    const request = prepareCliTask(task, definition.settings, cwd, prompt, signal);
    if (terminal?.destination === "integrated") {
      if (!terminal.launch) throw new Error("Integrated CLI tasks require a loaded Obsidian terminal host. No external terminal was started.");
      await terminal.launch(request);
    } else await launchExternalCliTask(request, definition.settings.linuxTerminal);
    return { succeeded: true, output: "[opened interactive CLI with preloaded prompt; interactive task result is not observed]" };
  } };
}
function createCopilotWorkflowAdapter(definition, vault) {
  const supports = (task) => task.taskKind === "copilot" && !task.interactiveTerminal && !task.branch && !task.createBranch && (task.copilotAllowAllTools === void 0 || typeof task.copilotAllowAllTools === "boolean");
  return { supports, async execute(task, prompt, signal) {
    if (!supports(task)) throw new Error("Unsupported Copilot task");
    if (signal?.aborted) throw new Error("Copilot cancelled before launch");
    const client = new CopilotCliClient(resolveCopilotBin(definition.settings.copilotPath), task.workingDirectory || definition.settings.workingDirectory || vault);
    const abort = () => client.dispose();
    signal?.addEventListener("abort", abort, { once: true });
    try {
      const result = await client.run(prompt, { model: task.model || definition.settings.defaultCopilotModel, allowAllTools: task.copilotAllowAllTools === true, timeoutMs: Math.max(0, definition.settings.taskTimeoutSeconds) * 1e3 });
      if (signal?.aborted || /timed out/.test(result.error)) throw new Error("Copilot outcome is uncertain; reconcile before continuing");
      return { succeeded: result.exitCode === 0, output: result.output + (result.error ? `
[Copilot error: ${result.error}]` : "") };
    } finally {
      signal?.removeEventListener("abort", abort);
      client.dispose();
    }
  } };
}
function createOpenCodeWorkflowAdapter(definition, vault, terminal) {
  const supports = (task) => isOpenCodeTask(task.taskKind);
  return { supports, async execute(task, prompt, signal, _recordThread, interaction) {
    if (!supports(task)) throw new Error("Unsupported OpenCode task");
    if (signal?.aborted) throw new Error("OpenCode cancelled before launch");
    const taskCwd = task.workingDirectory || definition.settings.workingDirectory || vault;
    const major = task.taskKind === "opencode2" ? 2 : 1;
    const model = task.model || (major === 2 ? definition.settings.defaultOpencode2Model : definition.settings.defaultModel);
    if (!prompt.trim() || !model?.trim()) return { succeeded: false, output: "[OpenCode requires a nonempty prompt and model]" };
    const bin = resolveOpencodeBin(major === 2 ? definition.settings.opencode2Path || "opencode" : definition.settings.opencodePath);
    if (major === 2) {
      if (task.useRalphLoop) return { succeeded: false, output: "[Ralph Loop integration is only supported for OpenCode 1 tasks]" };
      try {
        await assertOpenCode2(bin);
      } catch (error) {
        return { succeeded: false, output: `[${error.message}]` };
      }
      if (signal?.aborted) throw new Error("OpenCode cancelled before launch");
    }
    const agent = task.agent || (major === 2 ? definition.settings.defaultOpencode2Agent : definition.settings.defaultAgent) || "build";
    if (task.useRalphLoop) prompt = "/ralph-loop " + prompt;
    if (task.interactiveTerminal) {
      if (path23.isAbsolute(bin) && !fs22.existsSync(bin)) return { succeeded: false, output: "[interactive OpenCode executable is unavailable; nothing was launched]" };
      if (terminal?.destination === "integrated") {
        if (!terminal.launch) throw new Error("Integrated CLI tasks require a loaded Obsidian terminal host. No external terminal was started.");
        await terminal.launch({
          bin,
          cwd: taskCwd,
          label: task.name || `OpenCode ${major} CLI task`,
          major,
          model,
          agent: task.forceModel ? "" : agent,
          prompt,
          signal
        });
        return { succeeded: true, output: "[opened integrated OpenCode CLI with preloaded prompt; interactive task result is not observed]" };
      }
      await new Promise((resolve11, reject) => {
        const options = { onLaunched: resolve11, onError: reject, linuxTerminal: definition.settings.linuxTerminal, opencodeMajor: major };
        if (process.platform === "win32") openOpencodeCliLongPromptWindows(bin, taskCwd, {}, model, task.forceModel ? "" : agent, prompt, options);
        else openOpencodeCli(bin, taskCwd, {}, openCodeInteractiveArgs(major, model, task.forceModel ? "" : agent, prompt), options);
      });
      return { succeeded: true, output: "[opened interactive OpenCode CLI with preloaded prompt; interactive task result is not observed]" };
    }
    const folder = createAuxiliaryDirectory(taskCwd, "runtime");
    const outFile = path23.join(folder, "stdout.txt"), errFile = path23.join(folder, "stderr.txt"), doneFile = path23.join(folder, "done.txt");
    const pidFile = path23.join(folder, "process.pid"), promptFile = path23.join(folder, "instruction.txt"), full = path23.join(folder, "input.txt");
    const scriptFile = path23.join(folder, "launch" + scriptExt());
    let handle;
    let known = false, launchAttempted = false;
    try {
      fs22.writeFileSync(full, prompt, { encoding: "utf8", mode: 384 });
      fs22.writeFileSync(promptFile, `Read the complete task prompt and workflow context from the workspace file at ${full} and follow it exactly.`, { encoding: "utf8", mode: 384 });
      const script = buildOpenCodeScript({ pidFile, secretEnv: {}, safeCwd: taskCwd.replace(/'/g, "''"), gitCmds: "", bin, model, effectiveAgent: agent, effectiveTask: task, promptFile, outFile, errFile, doneFile, taskCwd, major });
      if (process.platform === "win32") writeUtf8BomFile(scriptFile, script);
      else fs22.writeFileSync(scriptFile, script, { mode: 384 });
      launchAttempted = true;
      const launched = handle = launchHidden(scriptFile, pidFile);
      const result = await new Promise((resolve11, reject) => {
        let ended = false;
        const finish = (error) => {
          if (ended) return;
          ended = true;
          clearInterval(timer);
          signal?.removeEventListener("abort", abort);
          if (error) reject(error);
        };
        const abort = () => {
          launched.kill();
          finish(new Error("OpenCode interrupted; effects require reconciliation"));
        };
        const started = Date.now(), timeout = Number(definition.settings.taskTimeoutSeconds) * 1e3;
        const read2 = (file) => fs22.existsSync(file) ? decodeCommandBuffer(fs22.readFileSync(file)) : "";
        let lastOutput = "", nextOutputAt = 0;
        const timer = setInterval(() => {
          try {
            if (timeout > 0 && Date.now() - started > timeout) {
              abort();
              return;
            }
            const completed = fs22.existsSync(doneFile);
            if (!completed && (!interaction?.onOutput || Date.now() < nextOutputAt)) return;
            const output = formatTaskOutput(read2(outFile), read2(errFile));
            if (output !== lastOutput) {
              lastOutput = output;
              interaction?.onOutput?.(output);
            }
            nextOutputAt = Date.now() + 500;
            if (!completed) return;
            const exit = fs22.readFileSync(doneFile, "utf8").replace(/^\uFEFF/, "").trim();
            if (!/^-?\d+$/.test(exit)) throw new Error("Invalid OpenCode completion marker");
            known = true;
            finish();
            resolve11({ succeeded: exit === "0", output: output || "(no output)" });
          } catch (error) {
            finish(error);
          }
        }, 100);
        launched.onError((error) => finish(error));
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) abort();
      });
      return result;
    } finally {
      handle?.cleanup(known);
      if (known || !launchAttempted) completeAuxiliaryDirectory(folder, "runtime");
    }
  } };
}

// workflow-task-adapters.ts
function combineWorkflowTaskAdapters(adapters) {
  const registered = [...adapters];
  const matches = (task) => registered.filter((adapter) => adapter.supports(task));
  const select = (task) => {
    const found = matches(task);
    if (found.length !== 1) throw new Error("Task requires exactly one supported executor");
    return found[0];
  };
  return {
    supports: (task) => matches(task).length === 1,
    execute: (task, prompt, signal, recordThread, interaction) => select(task).execute(task, prompt, signal, recordThread, interaction),
    async reconcile(task, threadId, turnId) {
      const adapter = select(task);
      if (!adapter.reconcile) throw new Error("Task executor cannot reconcile an interrupted execution");
      return await adapter.reconcile(task, threadId, turnId);
    }
  };
}
function createWorkflowTaskAdapter(definition, vaultBase, vaultMutations, terminal) {
  return combineWorkflowTaskAdapters([
    createCodeWorkflowAdapter(vaultBase, definition.settings.workingDirectory || vaultBase, vaultMutations),
    createCodexWorkflowAdapter(definition, vaultBase),
    createCopilotWorkflowAdapter(definition, vaultBase),
    createOpenCodeWorkflowAdapter(definition, vaultBase, terminal),
    createInteractiveCliWorkflowAdapter(definition, vaultBase, terminal)
  ]);
}

// workflow-evaluation.ts
function createWorkflowEvaluator(definition, vault, signal) {
  const adapter = createOpenCodeWorkflowAdapter(definition, vault);
  return async (transition, _target, input) => {
    const instruction = transition.evaluatePrompt?.trim() || "Did the previous step complete successfully? If it is safe to continue, reply YES. Otherwise reply NO.";
    const v2 = definition.settings.defaultAiEngine === "opencode2";
    const result = await adapter.execute(
      {
        taskKind: v2 ? "opencode2" : "opencode",
        model: v2 ? definition.settings.defaultOpencode2Model : definition.settings.defaultModel || "opencode/default",
        agent: v2 ? definition.settings.defaultOpencode2Agent : definition.settings.defaultAgent,
        workingDirectory: definition.settings.workingDirectory || vault
      },
      `${instruction}

Previous step output:
---
${input}
---

Reply ONLY with YES or NO.`,
      signal
    );
    if (!result.succeeded) throw new Error("Transition model evaluation failed; execution requires reconciliation");
    return result.output;
  };
}

// workflow-preflight.ts
var fs23 = __toESM(require("fs"));
var path24 = __toESM(require("path"));
function preflightInstalledWorkflow(definition, vault) {
  assertWorkflowDependencies(definition.workflow, definition.tasks, definition.workflows);
  const root = physicalPath(vault);
  const checkDirectory = (value) => {
    if (value !== void 0 && typeof value !== "string") throw new Error("Invalid working directory");
    const configured = value || root;
    if (!path24.isAbsolute(configured)) throw new Error("Working directory must be absolute");
    const directory2 = physicalPath(configured);
    if (!isWithinPhysicalPath(root, directory2)) throw new Error("Working directory is outside the selected vault");
    if (!fs23.statSync(directory2).isDirectory()) throw new Error("Working directory is unavailable");
  };
  checkDirectory(definition.settings.workingDirectory);
  for (const item of [definition.workflow, ...definition.workflow.steps, ...(definition.workflows || []).flatMap((w) => [w, ...w.steps]), ...definition.tasks]) {
    if (item.workingDirectory !== void 0) checkDirectory(item.workingDirectory);
    if (item.interactiveTerminal !== void 0 && typeof item.interactiveTerminal !== "boolean") throw new Error("interactiveTerminal must be boolean");
    if (item.taskKind === "code" && item.interactiveTerminal === true) throw new Error("Code tasks cannot be interactive");
    validateConcurrency(item);
    validateBranchOptions(item);
    if (item.branch?.trim() || definition.workflow.handoffBranch) branchRepository(item.workingDirectory || definition.settings.workingDirectory || root, root);
    if (definition.workflow.id.startsWith("@task:")) preflightTaskBranch(item, item.workingDirectory || definition.settings.workingDirectory || root, root);
  }
  for (const task of definition.tasks) {
    const cliError = getCliTaskValidationError(task);
    if (cliError) throw new Error(cliError);
    if (task.taskKind === "cli") {
      prepareCliTask(task, definition.settings, task.workingDirectory || definition.settings.workingDirectory || root, task.prompt);
      continue;
    }
    if (task.taskKind === "code") continue;
    if (typeof task.prompt !== "string" || !task.prompt.trim()) throw new Error("Task prompt must be nonempty before execution");
    if (isOpenCodeTask(task.taskKind) && !(task.model || (task.taskKind === "opencode2" ? definition.settings.defaultOpencode2Model : definition.settings.defaultModel))?.trim()) throw new Error("OpenCode model must be selected before execution");
    if (task.taskKind === "opencode2" && task.useRalphLoop) throw new Error("Ralph Loop integration is only supported for OpenCode 1 tasks");
  }
}

// page-workflow.ts
var runtimeFields2 = /* @__PURE__ */ new Set(["status", "lastRun", "output", "currentStep", "runtimeExecution", "legacyExecution", "codeExecution", "lastCodexThreadId", "lastCodexTurnId", "pendingCodexApproval"]);
var clean = (item) => Object.fromEntries(Object.entries(item).filter(([key]) => !runtimeFields2.has(key)));
var interactivePageTask = (task) => task.taskKind === "cli" || task.interactiveTerminal === true;
function preparePageDefinition(config, page, sourceId, task) {
  const root = task ? standaloneTaskWorkflow(sourceId) : config.workflows.find((w) => w.id === sourceId);
  if (!root) throw new Error("Workflow no longer exists");
  assertWorkflowEnabled(root, config.tasks, config.workflows);
  const workflows = [root, ...workflowClosure(root, config.workflows)];
  const taskIds = new Set(workflows.flatMap((w) => w.steps).filter((s) => s.taskId && (!s.stepKind || s.stepKind === "task")).map((s) => s.taskId));
  const directory2 = physicalPath(page.directory);
  const mappedId = (id) => pageExecutionId(page.id, id);
  const tasks = config.tasks.filter((t) => taskIds.has(t.id)).map((t) => {
    if (t.workingDirectory && !isWithinPhysicalPath(directory2, t.workingDirectory)) throw new Error("Task '" + t.name + "' has a fixed folder outside this page. Edit its global folder explicitly to inherit the page.");
    if (t.branch || t.createBranch) throw new Error("This task changes Git branches. Use a workflow that works on the page's existing branch.");
    return {
      ...clean(t),
      id: mappedId(t.id),
      workingDirectory: t.workingDirectory || directory2,
      prompt: page.objective || page.requirementFile ? (page.objective ? "Page objective:\n" + page.objective + "\n\n" : "") + (page.requirementFile ? "Requirement " + page.requirementId + ": read " + page.requirementFile.path + " (SHA256 " + page.requirementFile.sha256 + ").\n\n" : "") + (t.prompt || "") : t.prompt
    };
  });
  const mapped = workflows.map((w) => {
    if (w.handoffBranch) throw new Error("Branch handoff is not supported in page runs yet. The worktree already owns its branch.");
    return { ...clean(w), id: mappedId(w.id), steps: w.steps.map((s) => ({ ...clean(s), taskId: s.taskId ? mappedId(s.taskId) : void 0, workflowId: s.workflowId ? mappedId(s.workflowId) : void 0 })) };
  });
  const interactive = tasks.filter(interactivePageTask), onlyStep = mapped[0].steps[0];
  if (interactive.length && (mapped.length !== 1 || mapped[0].steps.length !== 1 || !onlyStep.taskId || onlyStep.stepKind && onlyStep.stepKind !== "task")) {
    throw new Error("Run an interactive CLI as a standalone page task or one-step workflow. Its launch does not confirm completion; subsequent page work must wait for the session to end.");
  }
  mapped[0].id = pageExecutionId(page.id, sourceId, task);
  if (task) {
    mapped[0].name = config.tasks.find((item) => item.id === sourceId)?.name || "Standalone task";
    mapped[0].concurrency = config.tasks.find((item) => item.id === sourceId)?.concurrency;
  }
  mapped[0].workPage = { id: page.id, identity: pageIdentityHash(page), directory: directory2, objective: page.objective };
  return prepareWorkflowDefinition(mapped[0], tasks, { ...config, workingDirectory: directory2, workflows: mapped.slice(1) });
}
async function runPageWorkflow(options) {
  if (!options.pageId || options.pageId === "main" || options.stepId) throw new Error("Page execution requires a page and a complete task or workflow");
  const location = resolveInstalledWorkflowLocation(options.vault, options.installationDirectory);
  const reader = options.catalogWriter || new SettingsWriter();
  ensureInstalledWorkflowRuntime(location);
  const owned = options.lease ? void 0 : acquireExecutionLease(location.runtimeDirectory);
  const lease = options.lease || owned;
  if (physicalPath(lease.directory) !== physicalPath(location.runtimeDirectory)) {
    owned?.release();
    throw new Error("Lease belongs to another installation");
  }
  const coordinator = executionCoordinator(lease);
  let admission;
  const controller = new AbortController(), abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  let timer;
  try {
    const definitions = path25.join(location.runtimeDirectory, "page-definitions");
    if (fs24.existsSync(definitions) && fs24.lstatSync(definitions).isSymbolicLink()) throw new Error("Page definitions cannot be a link");
    fs24.mkdirSync(definitions, { recursive: true });
    const prepared = await catalogTransaction(location.configurationFile, async () => {
      lease.assertOwned();
      const config = await reader.loadAsync(location.configurationFile);
      const page2 = selectWorkPage(config, options.pageId);
      if (page2.worktreeRemoval) throw new Error("This worktree has been removed or its removal needs review. Page history remains available.");
      if (page2.archived && !options.resumeRunId) throw new Error("Restore this page before starting work");
      assertNoPageTerminal(config, page2.directory, true);
      if ([...config.tasks, ...config.workflows].some((item) => item.status === "running" && !coordinator.knows(item.runtimeExecution?.runId))) throw new Error("Catalog has unresolved running activity");
      await verifyWorkPageEnvironment(page2);
      const sourceId2 = options.taskId || options.workflowId, task2 = !!options.taskId;
      let definition2;
      if (options.resumeRunId) {
        if (!/^[a-f0-9-]+$/.test(options.resumeRunId)) throw new Error("Invalid page run identity");
        const snapshotPath = path25.join(definitions, options.resumeRunId + ".json");
        if (fs24.lstatSync(snapshotPath).isSymbolicLink()) throw new Error("Page definition cannot be a link");
        const snapshot = JSON.parse(fs24.readFileSync(snapshotPath, "utf8"));
        if (snapshot.pageId !== page2.id || snapshot.sourceId !== sourceId2 || snapshot.task !== task2 || snapshot.pageIdentity !== pageIdentityHash(page2)) throw new Error("Page execution context changed");
        definition2 = snapshot.definition;
        const checkpoint = readExecutionCheckpoint(location.runtimeDirectory, options.resumeRunId);
        if (checkpoint.workflowId !== pageExecutionId(page2.id, sourceId2, task2) || checkpoint.definitionHash !== definition2.hash) throw new Error("Page snapshot does not match its journal");
        if (!options.reconcile) {
          const current = task2 ? standaloneTaskWorkflow(sourceId2) : config.workflows.find((w) => w.id === sourceId2);
          if (!current) throw new Error("Original workflow was removed");
          assertWorkflowEnabled(current, config.tasks, config.workflows);
        }
      } else definition2 = preparePageDefinition(config, page2, sourceId2, task2);
      preflightInstalledWorkflow(definition2, page2.directory);
      const terminal2 = { destination: config.cliTerminalDestination === "integrated" ? "integrated" : "external", launch: options.launchInteractiveTerminal };
      if (terminal2.destination === "integrated" && !terminal2.launch && definition2.tasks.some(interactivePageTask)) throw new Error("Integrated CLI tasks need the open Obsidian plugin");
      admission = coordinator.admit(definition2, page2.directory, options.resumeRunId, { directory: physicalPath(page2.directory), worktree: page2.kind === "worktree" });
      if (config.pageTerminalClaims?.length && admission.resources.exclusive) throw new Error("Exclusive execution must wait for page terminals to finish.");
      return { page: { ...page2 }, sourceId: sourceId2, task: task2, definition: definition2, terminal: terminal2 };
    });
    const { page, sourceId, task, definition, terminal } = prepared;
    let activeRunId = options.resumeRunId;
    if (terminal.launch) {
      const launch = terminal.launch;
      terminal.launch = (request) => {
        if (!activeRunId) throw new Error("Page terminal requires a durable execution identity");
        return launch({
          ...request,
          label: page.name + " \xB7 " + request.label,
          page: { pageId: page.id, claimId: "page-cli-" + activeRunId }
        });
      };
    }
    const acknowledged = activeRunId ? readStopRequest(location.runtimeDirectory, activeRunId) : void 0;
    let stopError;
    timer = setInterval(() => {
      if (!activeRunId) return;
      try {
        const request = readStopRequest(location.runtimeDirectory, activeRunId);
        if (request && request !== acknowledged) abort();
      } catch (error) {
        stopError = error;
        abort();
      }
    }, 100);
    timer.unref?.();
    const result = await runCodeWorkflowHost({
      definition,
      runtimeDirectory: location.runtimeDirectory,
      vaultBase: page.directory,
      lease,
      admission,
      timing: options.timing,
      resumeRunId: options.resumeRunId,
      reconcile: options.reconcile,
      maxSteps: options.maxSteps,
      signal: controller.signal,
      redact: options.redact,
      onTaskOutput: options.onTaskOutput,
      tasks: createWorkflowTaskAdapter(definition, page.directory, void 0, terminal),
      evaluate: createWorkflowEvaluator(definition, page.directory, controller.signal),
      onCheckpoint: async (checkpoint, timing) => {
        admission.bind(checkpoint);
        activeRunId = checkpoint.runId;
        const snapshotPath = path25.join(definitions, checkpoint.runId + ".json");
        if (!fs24.existsSync(snapshotPath)) {
          await atomicSettingsWrite(snapshotPath, { pageId: page.id, sourceId, task, pageIdentity: pageIdentityHash(page), definition }, fs24.promises, void 0, timing);
        }
        await catalogTransaction(location.configurationFile, async (transaction) => {
          lease.assertOwned();
          const baseline = options.catalogVersion?.() || coordinator.catalogVersion;
          if (baseline?.textHash && baseline.textHash === baseline.valueHash) await reader.adoptConfirmed(location.configurationFile, baseline, () => true);
          const current = await reader.loadAsync(location.configurationFile);
          if (pageIdentityHash(selectWorkPage(current, page.id)) !== pageIdentityHash(page)) throw new Error("Page changed during execution; checkpoint preserved");
          const row = {
            pageId: page.id,
            sourceId,
            task,
            runId: checkpoint.runId,
            workflowId: checkpoint.workflowId,
            name: definition.workflow.name || sourceId,
            phase: checkpoint.phase,
            revision: checkpoint.revision,
            createdAt: checkpoint.createdAt || "",
            uncertain: checkpointUncertainties(checkpoint).length > 0
          };
          const previous = (current.pageRuns || []).find((run2) => run2.runId === row.runId);
          if (previous && previous.revision > row.revision) throw new Error("Stale page progress");
          const next = { ...current, pageRuns: [...(current.pageRuns || []).filter((run2) => run2.runId !== row.runId), row] };
          const interactive = definition.tasks.some(interactivePageTask);
          if (interactive && checkpoint.phase === "in_flight" && !checkpoint.steps[checkpoint.steps.length - 1]?.result) {
            const id = "page-cli-" + checkpoint.runId;
            if (!(current.pageTerminalClaims || []).some((claim) => claim.id === id)) {
              next.pageTerminalClaims = [...current.pageTerminalClaims || [], { id, pageId: page.id, directory: page.directory, createdAt: (/* @__PURE__ */ new Date()).toISOString(), exclusive: admission.resources.exclusive }];
            }
          }
          await reader.save(location.configurationFile, () => next, void 0, timing);
          const version2 = reader.confirmedVersion(location.configurationFile);
          coordinator.catalogVersion = version2;
          await options.onCheckpoint?.(checkpoint, { catalog: next, version: version2, runId: row.runId, workflowId: row.workflowId, revision: row.revision }, void 0, transaction);
          admission.confirm(checkpoint);
        });
      }
    });
    if (stopError) throw stopError;
    return result;
  } finally {
    if (timer) clearInterval(timer);
    options.signal?.removeEventListener("abort", abort);
    admission?.finish();
    owned?.release();
  }
}

// installed-workflow-host.ts
var fs26 = __toESM(require("fs"));
var path27 = __toESM(require("path"));

// task-history.ts
var fs25 = __toESM(require("fs"));
var path26 = __toESM(require("path"));
function regularDirectory3(directory2) {
  if (!fs25.existsSync(directory2)) fs25.mkdirSync(directory2);
  const stat = fs25.lstatSync(directory2);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Task history requires regular directories");
}
function persistTaskHistory(vault, workflow, checkpoint, settings) {
  if (settings.logsEnabled === false) return;
  const root = fs25.realpathSync(vault);
  const touched = /* @__PURE__ */ new Set();
  for (const [index, observed] of checkpoint.steps.entries()) {
    const step = workflow.steps.find((item) => item.id === observed.stepId);
    if (!step?.taskId || step.stepKind && step.stepKind !== "task" || observed.status === "in_flight" || !observed.startedAt) continue;
    if (!/^[a-zA-Z0-9_-]+$/.test(step.taskId)) throw new Error("Unsafe task history identity");
    let directory2 = root;
    for (const part of [".opencode", "logs", step.taskId]) {
      directory2 = path26.join(directory2, part);
      regularDirectory3(directory2);
    }
    const date = new Date(observed.startedAt), pad = (n) => String(n).padStart(2, "0");
    const timestamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, "0")}`;
    const file = path26.join(directory2, `${timestamp}_${checkpoint.runId}_${String(index).padStart(6, "0")}.log`);
    const content = `Run: ${checkpoint.runId}
Step: ${observed.stepId}
Status: ${observed.status}
Started: ${observed.startedAt}
Finished: ${observed.finishedAt || "unknown"}

${observed.output || "(no output)"}`;
    try {
      fs25.writeFileSync(file, content, { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const stat = fs25.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || fs25.readFileSync(file, "utf8") !== content) throw new Error("Task history conflicts with durable output");
    }
    touched.add(directory2);
  }
  for (const directory2 of touched) {
    const files2 = fs25.readdirSync(directory2).filter((name) => name.endsWith(".log") && name !== "latest.log").sort();
    const max = settings.maxLogsPerTask ?? 50, days = settings.logRetentionDays ?? 30;
    const retained = [];
    for (const name of files2) {
      const file = path26.join(directory2, name), stat2 = fs25.lstatSync(file);
      if (!stat2.isFile() || stat2.isSymbolicLink()) throw new Error("Task history requires regular files");
      const match = name.match(/^(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})/);
      const date = match ? Date.parse(`${match[1]}T${match[2]}:${match[3]}:${match[4]}`) : NaN;
      if (days > 0 && date < Date.now() - days * 864e5) fs25.unlinkSync(file);
      else retained.push(name);
    }
    while (max > 0 && retained.length > max) fs25.unlinkSync(path26.join(directory2, retained.shift()));
    const latest = path26.join(directory2, "latest.log");
    const stat = fs25.lstatSync(latest, { throwIfNoEntry: false });
    if (stat) {
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Task history latest must be a regular file");
    }
    if (retained.length) fs25.writeFileSync(latest, fs25.readFileSync(path26.join(directory2, retained[retained.length - 1])));
  }
}

// workflow-catalog-progress.ts
async function persistWorkflowProgress(options) {
  return catalogTransaction(options.configurationFile, async (transaction) => {
    const durable2 = readExecutionCheckpoint(options.runtimeDirectory, options.expectedRunId);
    if (JSON.stringify(durable2) !== JSON.stringify(options.checkpoint)) {
      throw new Error("Catalog progress does not match the durable checkpoint");
    }
    const writer = options.writer || new SettingsWriter();
    if (options.baseline) {
      const baseline = options.baseline();
      if (baseline.textHash && baseline.textHash === baseline.valueHash) await writer.adoptConfirmed(options.configurationFile, baseline, () => true);
      else await writer.assertUnchanged(options.configurationFile);
    }
    const config = await writer.loadAsync(options.configurationFile);
    if (!config || !Array.isArray(config.tasks) || !Array.isArray(config.workflows)) {
      throw new Error("Invalid AutoOC catalog");
    }
    const virtual = options.taskId ? standaloneTaskWorkflow(options.taskId) : void 0;
    if (virtual && (virtual.id !== durable2.workflowId || config.workflows.some((workflow2) => workflow2.id === virtual.id))) throw new Error("Standalone task identity mismatch");
    if (virtual && config.tasks.filter((task) => task.id === options.taskId).length !== 1) throw new Error("Missing or ambiguous task in catalog");
    const matches = virtual ? [virtual] : config.workflows.filter((workflow2) => workflow2.id === durable2.workflowId);
    if (matches.length !== 1) throw new Error("Missing or ambiguous workflow in catalog");
    let workflow = virtual ? { ...virtual, runtimeExecution: config.tasks.find((task) => task.id === options.taskId).runtimeExecution } : matches[0];
    if (options.stepId) {
      if (virtual) throw new Error("A code step requires its parent workflow identity");
      workflow = selectCodeStep(workflow, options.stepId);
    }
    if (options.replaceCompletedRunId && workflow.runtimeExecution?.runId === options.replaceCompletedRunId && durable2.runId !== options.replaceCompletedRunId) {
      const previous = readExecutionCheckpoint(options.runtimeDirectory, options.replaceCompletedRunId);
      const previousId = virtual && !previous.workflowId.startsWith("@task:") ? workflow.runtimeExecution.workflowId : workflow.id;
      validateProgressBinding({ ...workflow, id: previousId }, previous, options.replaceCompletedRunId);
      if (!virtual && previous.workflowId !== durable2.workflowId || !["completed", "failed", "abandoned"].includes(previous.phase)) {
        throw new Error("Cannot replace an unfinished execution");
      }
      workflow = { ...workflow };
      delete workflow.runtimeExecution;
    }
    const preserveLegacy = !virtual && !options.stepId && matches[0].legacyExecution && matches[0].runtimeExecution?.runId === durable2.runId;
    if (preserveLegacy) {
      validateProgressBinding(matches[0], durable2, options.expectedRunId);
      if (!["completed", "failed", "abandoned"].includes(durable2.phase)) throw new Error("Legacy workflow overlaps an unfinished shared run");
    }
    const projected = preserveLegacy ? matches[0] : { ...projectWorkflowProgress(workflow, config.tasks, config, durable2, options.expectedRunId), legacyExecution: void 0 };
    const observedTasks = /* @__PURE__ */ new Map();
    const executionSteps = workflowExecutionPlan({ workflow, workflows: workflowClosure(workflow, config.workflows) }).steps;
    for (const [stepIndex, observed] of durable2.steps.entries()) {
      const step = executionSteps.find((item) => item.id === observed.stepId);
      if (step?.taskId && (!step.stepKind || step.stepKind === "task")) {
        observedTasks.set(step.taskId, { stepId: step.id, stepIndex, observed });
      }
    }
    const tasks = config.tasks.map((task) => {
      const item = observedTasks.get(task.id);
      if (!item) return task;
      const previous = task.runtimeExecution;
      if (previous?.runId === durable2.runId && previous.revision > durable2.revision) throw new Error("Stale task progress");
      if (task.legacyExecution && previous?.runId === durable2.runId) {
        validateProgressBinding({ id: previous.workflowId, runtimeExecution: previous }, durable2, options.expectedRunId);
        if (!["completed", "failed", "abandoned"].includes(durable2.phase)) throw new Error("Legacy task overlaps an unfinished shared run");
        return task;
      }
      if (previous && previous.runId !== durable2.runId) {
        if (item.observed.status !== "in_flight") return task;
        const prior = readExecutionCheckpoint(options.runtimeDirectory, previous.runId);
        if (!["completed", "failed", "abandoned"].includes(prior.phase)) throw new Error("Task belongs to an unfinished execution");
      }
      return {
        ...task,
        legacyExecution: void 0,
        status: item.observed.status === "in_flight" ? durable2.phase === "abandoned" ? "abandoned" : "pending" : item.observed.status,
        ...item.observed.startedAt ? { lastRun: item.observed.startedAt } : {},
        output: item.observed.output || "",
        ...item.observed.codexThreadId ? { lastCodexThreadId: item.observed.codexThreadId } : {},
        ...item.observed.codexTurnId ? { lastCodexTurnId: item.observed.codexTurnId } : {},
        pendingCodexApproval: durable2.phase !== "abandoned" && item.observed.approval ? { ...item.observed.approval, requestId: item.observed.approval.token } : void 0,
        runtimeExecution: {
          runId: durable2.runId,
          workflowId: durable2.workflowId,
          definitionHash: durable2.definitionHash,
          stepId: item.stepId,
          stepIndex: item.stepIndex,
          revision: durable2.revision,
          finishedAt: item.observed.finishedAt,
          phase: durable2.phase,
          abandonment: durable2.abandonment,
          requiresReconciliation: durable2.phase !== "abandoned" && item.observed.status === "in_flight"
        }
      };
    });
    const replacement = options.stepId ? { ...matches[0], steps: matches[0].steps.map((step) => step.id === options.stepId ? {
      ...step,
      codeExecution: {
        runtimeExecution: projected.runtimeExecution,
        status: projected.status,
        output: projected.steps[0].output,
        lastRun: projected.steps[0].lastRun || durable2.createdAt
      }
    } : step) } : projected;
    const next = { ...config, tasks, workflows: virtual ? config.workflows : config.workflows.map((workflow2) => workflow2 === matches[0] ? replacement : workflow2) };
    await writer.save(options.configurationFile, () => next, void 0, options.timing);
    if (options.vaultBase) persistTaskHistory(options.vaultBase, { ...workflow, steps: executionSteps }, durable2, config);
    const confirmed = {
      catalog: next,
      version: writer.confirmedVersion(options.configurationFile),
      runId: durable2.runId,
      workflowId: durable2.workflowId,
      revision: durable2.revision
    };
    await options.onCommitted?.(confirmed, transaction);
    return confirmed;
  });
}

// installed-workflow-host.ts
var preparingInstallations = /* @__PURE__ */ new Set();
async function runInstalledWorkflow(options) {
  if (!path27.isAbsolute(options.vault) || !!options.workflowId === !!options.taskId) throw new Error("Explicit vault and exactly one workflow or task identity required");
  if (options.stepId !== void 0 && (!options.workflowId || !options.stepId)) throw new Error("A code step requires its parent workflow identity");
  if (options.newExecution && (options.resumeRunId || options.reconcile)) throw new Error("New execution cannot also resume or reconcile");
  if (options.pageId && options.pageId !== "main") return runPageWorkflow(options);
  const location = resolveInstalledWorkflowLocation(options.vault, options.installationDirectory);
  const { vault, configurationFile, runtimeDirectory } = location;
  if (options.lease) {
    options.lease.assertOwned();
    if (!samePhysicalPath(options.lease.directory, runtimeDirectory)) throw new Error("Lease belongs to another installation runtime");
  }
  if (!options.lease && preparingInstallations.has(runtimeDirectory)) throw Object.assign(new Error("Installation already has an advancing session"), { code: "EEXIST" });
  if (!options.lease) preparingInstallations.add(runtimeDirectory);
  let ownedLease;
  let admission;
  try {
    if (!options.lease && fs26.existsSync(runtimeDirectory)) ownedLease = acquireExecutionLease(runtimeDirectory);
    const reader = options.catalogWriter || new SettingsWriter();
    const prepared = await catalogTransaction(configurationFile, async () => {
      let config = await reader.loadAsync(configurationFile);
      if (!config || !Array.isArray(config.tasks) || !Array.isArray(config.workflows)) throw new Error("Invalid AutoOC catalog");
      const coordinator = options.lease ? executionCoordinator(options.lease) : void 0;
      if ([...config.tasks, ...config.workflows].some((item) => item.status === "running" && !coordinator?.knows(item.runtimeExecution?.runId))) {
        throw new Error("Catalog has unresolved running activity; verify its owner before execution");
      }
      const virtual = options.taskId ? standaloneTaskWorkflow(options.taskId) : void 0;
      if (virtual && config.workflows.some((workflow) => workflow.id === virtual.id)) throw new Error("Reserved task identity conflicts with a workflow");
      const matches = virtual ? config.tasks.filter((task) => task.id === options.taskId) : config.workflows.filter((workflow) => workflow.id === options.workflowId);
      if (matches.length !== 1) throw new Error("Missing or ambiguous workflow identity");
      if (options.stepId) matches[0] = selectCodeStep(matches[0], options.stepId);
      if (matches[0].runtimeExecution && matches[0].runtimeExecution.runId !== options.resumeRunId && !options.newExecution) {
        throw new Error("Workflow has a bound execution; select that identity explicitly");
      }
      if (!options.reconcile) assertWorkflowEnabled(virtual || matches[0], config.tasks, config.workflows);
      const definition2 = prepareWorkflowDefinition(virtual || matches[0], config.tasks, config);
      if (config.pageTerminalClaims?.length) {
        assertNoPageTerminal(config, definition2.settings.workingDirectory || vault);
        for (const task of definition2.tasks) assertNoPageTerminal(config, task.workingDirectory || definition2.settings.workingDirectory || vault);
      }
      preflightInstalledWorkflow(definition2, vault);
      const terminal2 = { destination: config.cliTerminalDestination === "integrated" ? "integrated" : "external", launch: options.launchInteractiveTerminal };
      if (!options.reconcile && terminal2.destination === "integrated" && !terminal2.launch && definition2.tasks.some((task) => task.taskKind === "cli" || isOpenCodeTask(task.taskKind) && task.interactiveTerminal)) {
        throw new Error("Integrated CLI tasks require a loaded Obsidian plugin. Open Obsidian or select External window in AutoOC Settings. No workflow steps were started.");
      }
      ensureInstalledWorkflowRuntime(location);
      if (!options.lease && !ownedLease) ownedLease = acquireExecutionLease(runtimeDirectory);
      await reader.assertUnchanged(configurationFile);
      const replaceCompletedRunId2 = options.newExecution ? matches[0].runtimeExecution?.runId : void 0;
      if (replaceCompletedRunId2) {
        const previous = readExecutionCheckpoint(runtimeDirectory, replaceCompletedRunId2);
        const binding = matches[0].runtimeExecution;
        const previousId = virtual && !previous.workflowId.startsWith("@task:") ? binding.workflowId : definition2.workflow.id;
        validateProgressBinding({ id: previousId, runtimeExecution: binding }, previous, replaceCompletedRunId2);
        if (!["completed", "failed", "abandoned"].includes(previous.phase)) {
          throw new Error("Cannot replace an unfinished execution");
        }
      }
      admission = coordinator?.admit(definition2, vault, options.resumeRunId);
      return { definition: definition2, replaceCompletedRunId: replaceCompletedRunId2, terminal: terminal2 };
    });
    const { definition, replaceCompletedRunId, terminal } = prepared;
    const presentation = executionPresentation(definition.workflow, options.taskId);
    let activeRunId = options.resumeRunId;
    const acknowledged = activeRunId ? readStopRequest(runtimeDirectory, activeRunId) : void 0;
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    let stopError;
    const checkStop = () => {
      if (!activeRunId) return;
      try {
        const request = readStopRequest(runtimeDirectory, activeRunId);
        if (request && request !== acknowledged) abort();
      } catch (error) {
        stopError = error;
        abort();
      }
    };
    const timer = setInterval(checkStop, 100);
    timer.unref?.();
    try {
      const result = await runCodeWorkflowHost({
        definition,
        runtimeDirectory,
        vaultBase: vault,
        admission,
        timing: options.timing,
        resumeRunId: options.resumeRunId,
        reconcile: options.reconcile,
        maxSteps: options.maxSteps,
        signal: controller.signal,
        redact: options.redact,
        lease: options.lease || ownedLease,
        vaultMutations: options.vaultMutations,
        onTaskOutput: options.onTaskOutput,
        tasks: createWorkflowTaskAdapter(definition, vault, options.vaultMutations, terminal),
        evaluate: createWorkflowEvaluator(definition, vault, controller.signal),
        onCheckpoint: async (checkpoint, timing) => {
          admission?.bind(checkpoint);
          activeRunId = checkpoint.runId;
          checkStop();
          const catalog = await persistWorkflowProgress({
            configurationFile,
            runtimeDirectory,
            checkpoint,
            timing,
            expectedRunId: checkpoint.runId,
            replaceCompletedRunId,
            taskId: options.taskId,
            stepId: options.stepId,
            vaultBase: vault,
            writer: reader,
            baseline: options.catalogVersion || (() => admission?.coordinator.catalogVersion || reader.confirmedVersion(configurationFile)),
            onCommitted: async (catalog2, transaction) => {
              if (admission) admission.coordinator.catalogVersion = catalog2.version;
              await options.onCheckpoint?.(checkpoint, catalog2, { ...presentation }, transaction);
              admission?.confirm(checkpoint);
            }
          });
        }
      });
      if (stopError) throw stopError;
      return options.includePresentation ? { ...result, ...presentation } : result;
    } finally {
      clearInterval(timer);
      options.signal?.removeEventListener("abort", abort);
    }
  } finally {
    admission?.finish();
    try {
      ownedLease?.release();
    } finally {
      if (!options.lease) preparingInstallations.delete(runtimeDirectory);
    }
  }
}

// execution-idle.ts
var fs27 = __toESM(require("fs"));
var path28 = __toESM(require("path"));
function assertIdleJournals(runtime) {
  if (fs27.existsSync(path28.join(runtime, "update-pending.json"))) throw new Error("Incomplete plugin update requires recovery before execution");
  const checkpoints = /* @__PURE__ */ new Map();
  for (const name of fs27.readdirSync(runtime)) {
    if (name.endsWith(".tmp") || name.endsWith(".write-lock")) throw new Error("Unfinished execution write requires reconciliation");
    if (!/^[a-zA-Z0-9-]+\.json$/.test(name)) continue;
    const state = readExecutionCheckpoint(runtime, name.slice(0, -5));
    if (state.phase === "abandoned" || state.disposition) {
      checkpoints.set(state.runId, state);
      continue;
    }
    if (!["completed", "failed"].includes(state.phase) || state.steps.some((step) => step.status === "in_flight" || step.approval || step.result?.cancelled || step.evaluations?.some((item) => item.status !== "completed"))) {
      throw new Error("Unfinished execution or uncertain effect requires reconciliation");
    }
    checkpoints.set(state.runId, state);
  }
  return checkpoints;
}
function assertIdleCatalog(settings, checkpoints) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) throw new Error("Invalid execution configuration");
  for (const kind of ["tasks", "workflows"]) {
    const entries = settings[kind] ?? [];
    if (!Array.isArray(entries)) throw new Error("Invalid execution catalog");
    for (const entry of entries) {
      if (!entry || typeof entry.id !== "string") throw new Error("Invalid execution entry");
      if (entry.status === "running" || entry.pendingCodexApproval) throw new Error("Active execution requires reconciliation");
      const legacy = entry.legacyExecution;
      if (legacy && (legacy.stopState || (kind === "tasks" ? !Number.isFinite(Date.parse(legacy.finishedAt)) || !["pending", "completed", "failed"].includes(entry.status) : entry.status !== "completed" || !Array.isArray(entry.steps) || entry.steps.some((step) => step.status === "running")))) {
        throw new Error("Legacy execution outcome is unconfirmed");
      }
      const binding = entry.runtimeExecution;
      if (!binding) continue;
      const checkpoint = checkpoints.get(binding.runId);
      if (!checkpoint) throw new Error("Execution binding requires reconciliation");
      validateProgressBinding({ id: kind === "workflows" ? entry.id : binding.workflowId, runtimeExecution: binding }, checkpoint, binding.runId);
      if (checkpoint.abandonment) {
        const d = checkpoint.abandonment;
        if (kind === "tasks" && checkpoint.workflowId.startsWith("@task:") && checkpoint.workflowId !== `@task:${entry.id}`) throw new Error("Abandonment standalone task identity mismatch");
        const prior = binding.revision === d.previousRevision && binding.phase === d.previousPhase;
        const projected = binding.revision === checkpoint.revision && binding.phase === "abandoned" && !binding.requiresReconciliation;
        if (binding.definitionHash !== checkpoint.definitionHash || !prior && !projected) throw new Error("Abandonment binding phase, hash or revision mismatch");
        if (kind === "tasks" || binding.stepId !== void 0 || binding.stepIndex !== void 0) {
          const index = binding.stepIndex;
          const unstartedTask = kind === "tasks" && checkpoint.workflowId === `@task:${entry.id}` && checkpoint.steps.length === 0 && d.previousPhase === "ready" && binding.stepId === "task" && d.previousNextStepId === "task" && (index === void 0 || index === -1);
          if (!unstartedTask && (typeof binding.stepId !== "string" || !checkpoint.steps.some((step) => step.stepId === binding.stepId) || index !== void 0 && (!Number.isSafeInteger(index) || index < 0 || checkpoint.steps[index]?.stepId !== binding.stepId))) {
            throw new Error("Abandonment binding step or index mismatch");
          }
        }
      } else if (binding.requiresReconciliation && !checkpoint.disposition) throw new Error("Execution binding requires reconciliation");
      if (kind === "tasks" && checkpoint.workflowId !== `@task:${entry.id}` && !checkpoint.steps.some((step) => step.stepId === binding.stepId)) {
        throw new Error("Bound task step is absent from its journal");
      }
    }
  }
}

// standalone-pages.ts
var fs28 = __toESM(require("fs"));
async function withPageHost(vault, action, installationDirectory) {
  const location = resolveInstalledWorkflowLocation(vault, installationDirectory);
  ensureInstalledWorkflowRuntime(location);
  const lease = acquireExecutionLease(location.runtimeDirectory), writer = new SettingsWriter();
  let host, timer;
  let abort;
  try {
    let running = false, reserved = false, closed = false, pollFailure;
    const runs = /* @__PURE__ */ new Set(), controller = new AbortController();
    const run2 = async (options) => {
      running = true;
      try {
        return await runInstalledWorkflow({
          ...options,
          lease,
          catalogWriter: writer,
          onCheckpoint: async (state, catalog, presentation, transaction) => {
            runs.add(state.runId);
            await options.onCheckpoint?.(state, catalog, presentation, transaction);
          }
        });
      } finally {
        running = false;
        runs.clear();
      }
    };
    const pages = createPageCreationService({
      lease,
      location,
      busy: () => running || reserved,
      activeRuns: () => {
        if (running && !runs.size) throw new Error("Wait for the foreground execution identity before submitting page creation");
        return [...runs];
      },
      assertOpen: () => {
        lease.assertOwned();
        if (closed || pollFailure) throw new Error("Standalone page host is closed");
      },
      reserve: () => {
        if (running || reserved) throw new Error("Standalone work is active");
        lease.assertOwned();
        assertIdleJournals(location.runtimeDirectory);
        reserved = true;
        return () => {
          reserved = false;
        };
      },
      catalog: async () => {
        const config = await writer.loadAsync(location.configurationFile);
        assertIdleCatalog(config, assertIdleJournals(location.runtimeDirectory));
        if (config.pageTerminalClaims?.length) throw new Error("Page terminals are still reserved");
        return config;
      },
      register: (page) => catalogTransaction(location.configurationFile, async () => {
        const config = await writer.loadAsync(location.configurationFile);
        assertIdleCatalog(config, assertIdleJournals(location.runtimeDirectory));
        await registerWorkPage(config, page, () => writer.save(location.configurationFile, () => config));
        executionCoordinator(lease).catalogVersion = writer.confirmedVersion(location.configurationFile);
      }),
      launch: (selection, pageId, signal, onCheckpoint) => run2({ vault, installationDirectory: location.installationDirectory, ...selection, pageId, newExecution: true, redact: (s) => s, signal, onCheckpoint })
    });
    host = createPluginRequestHost(lease, async () => {
      throw new Error("This foreground owner accepts page preparation requests; use create-page with launch instead of recursive run");
    }, void 0, () => ({}), { pages });
    timer = setInterval(() => {
      void host.poll().catch((error) => {
        pollFailure = error;
        controller.abort();
        host.close();
      });
    }, 50);
    abort = () => {
      controller.abort();
      host.close();
    };
    process.on("SIGINT", abort);
    process.on("SIGTERM", abort);
    try {
      const result = await action((options) => run2({ ...options, signal: options.signal || controller.signal }), pages);
      if (pollFailure) throw pollFailure;
      await host.poll();
      await host.drain();
      await pages.flush();
      return result;
    } finally {
      closed = true;
    }
  } finally {
    if (timer) clearInterval(timer);
    if (abort) {
      process.off("SIGINT", abort);
      process.off("SIGTERM", abort);
    }
    host?.close();
    await host?.drain();
    await writer.drain();
    lease.release();
  }
}
async function runStandaloneWorkflowWithPages(options) {
  const location = resolveInstalledWorkflowLocation(options.vault, options.installationDirectory);
  if (!fs28.existsSync(location.runtimeDirectory) && (!options.pageId || options.pageId === "main")) {
    const config = await new SettingsWriter().loadAsync(location.configurationFile);
    if (!config || !Array.isArray(config.tasks) || !Array.isArray(config.workflows)) throw new Error("Invalid AutoOC catalog");
    let workflow = options.taskId ? standaloneTaskWorkflow(options.taskId) : config.workflows.find((w) => w.id === options.workflowId);
    if (!workflow) throw new Error("Missing workflow identity");
    if (options.stepId) workflow = selectCodeStep(workflow, options.stepId);
    preflightInstalledWorkflow(prepareWorkflowDefinition(workflow, config.tasks, config), location.vault);
  }
  return withPageHost(options.vault, (run2) => run2(options), options.installationDirectory);
}
async function createStandalonePage(vault, request) {
  await withPageHost(vault, async (_run, pages) => {
    await pages.submit(request);
    await pages.flush();
  });
  return inspectPageCreation(resolveInstalledWorkflowLocation(vault).runtimeDirectory, request.requestId);
}

// settings-write-inspection.ts
var fs29 = __toESM(require("fs"));
var path29 = __toESM(require("path"));
var import_crypto13 = require("crypto");
var hash2 = (text2) => (0, import_crypto13.createHash)("sha256").update(text2).digest("hex");
var identity = (s) => `${s.dev}:${s.ino}:${s.birthtimeMs}:${s.size}:${s.mtimeMs}:${s.ctimeMs}`;
var present = (file) => {
  try {
    return fs29.lstatSync(file);
  } catch (e) {
    if (e.code === "ENOENT") return void 0;
    throw e;
  }
};
function regular(file) {
  const stat = fs29.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error("Unsafe settings evidence file");
  return stat;
}
function stableBytes(file) {
  const before = identity(regular(file)), fd = fs29.openSync(file, "r");
  try {
    if (identity(fs29.fstatSync(fd)) !== before) throw new Error("Settings evidence changed before reading");
    const bytes = fs29.readFileSync(fd);
    if (identity(fs29.fstatSync(fd)) !== before || identity(regular(file)) !== before) throw new Error("Settings evidence changed during reading");
    return bytes;
  } finally {
    fs29.closeSync(fd);
  }
}
function small(file) {
  const before = regular(file);
  if (before.size > 16384) throw new Error("Settings metadata exceeds size limit");
  const fd = fs29.openSync(file, "r");
  try {
    if (identity(before) !== identity(fs29.fstatSync(fd))) throw new Error("Settings metadata changed");
    const text2 = fs29.readFileSync(fd, "utf8");
    if (identity(before) !== identity(regular(file))) throw new Error("Settings metadata changed");
    return text2;
  } finally {
    fs29.closeSync(fd);
  }
}
async function record(root, name) {
  const file = path29.join(root, name), stat = present(file);
  if (!stat) return { name, identity: null, sha256: null };
  if (stat.isDirectory() && !stat.isSymbolicLink()) return { name, identity: identity(stat), sha256: null };
  const before = identity(regular(file)), handle = await fs29.promises.open(file, "r");
  try {
    if (identity(await handle.stat()) !== before) throw new Error("Settings evidence changed before reading");
    const digest = (0, import_crypto13.createHash)("sha256"), buffer = Buffer.alloc(256 * 1024);
    for (; ; ) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      digest.update(buffer.subarray(0, bytesRead));
      await new Promise((resolve11) => setImmediate(resolve11));
    }
    if (before !== identity(regular(file)) || before !== identity(await handle.stat())) throw new Error("Settings evidence changed during hashing");
    return { name, identity: before, sha256: digest.digest("hex") };
  } finally {
    await handle.close();
  }
}
function runtimeNames(root, relative7 = "runtime") {
  const directory2 = path29.join(root, relative7), stat = present(directory2);
  if (!stat) return [];
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Unsafe settings runtime directory");
  const result = [];
  for (const name of fs29.readdirSync(directory2).sort()) {
    if (relative7 === "runtime" && (name === "lease-recovery.lock" || name.startsWith("settings-write-explicit-"))) continue;
    if (/secret|credential|^\.env(?:\.|$)/i.test(name)) throw new Error("Unexpected sensitive runtime evidence");
    const next = relative7 + "/" + name, s = fs29.lstatSync(path29.join(root, next));
    if (s.isSymbolicLink()) throw new Error("Linked runtime evidence");
    if (s.isDirectory()) result.push(next, ...runtimeNames(root, next));
    else result.push(next);
    if (result.length > 1e4) throw new Error("Runtime evidence inventory exceeds limit");
  }
  return result;
}
function names(root) {
  return ["data.json", "data.json.write-lock", "data.json.write-intent", ...fs29.readdirSync(root).filter((n) => n.startsWith("data.json.") && n.endsWith(".tmp")).sort(), ...runtimeNames(root)];
}
async function inspectSettingsWrite(vault, ownGuard = false) {
  const location = resolveInstalledWorkflowLocation(vault), root = location.installationDirectory;
  const directoryIdentity2 = settingsDirectoryIdentity(root), runtimeIdentity = present(location.runtimeDirectory) ? settingsDirectoryIdentity(location.runtimeDirectory) : null;
  const blockingReasons = [], inventory = names(root), records = [];
  if (inventory.includes("runtime/update-pending.json")) blockingReasons.push("UPDATE_PENDING");
  if (inventory.some((n) => n.startsWith("runtime/") && (n.endsWith(".tmp") || n.endsWith(".write-lock")))) blockingReasons.push("RUNTIME_WRITE_PENDING");
  for (const name of inventory) {
    try {
      records.push(await record(root, name));
    } catch {
      blockingReasons.push("UNSAFE_OR_UNSTABLE_EVIDENCE:" + name);
    }
  }
  let lock = null;
  try {
    lock = parseSettingsWriteLock(small(location.configurationFile + ".write-lock"));
  } catch {
    blockingReasons.push(present(location.configurationFile + ".write-lock") ? "INCOMPLETE_LOCK_IDENTITY" : "NO_WRITE_LOCK");
  }
  let ownerState = "unknown";
  if (lock) {
    if ("legacy" in lock) blockingReasons.push("LEGACY_LOCK_WITHOUT_PROCESS_START");
    else {
      if (lock.directoryIdentity !== directoryIdentity2) blockingReasons.push("LOCK_INSTALLATION_MISMATCH");
      if (!lock.processStart) blockingReasons.push("PROCESS_START_UNVERIFIABLE");
      try {
        process.kill(lock.pid, 0);
        const current = await settingsProcessStart(lock.pid);
        ownerState = current && current !== lock.processStart ? "pid_reused" : "active_or_unverifiable";
        blockingReasons.push(current && current !== lock.processStart ? "PID_REUSED" : "WRITER_ACTIVE_OR_UNVERIFIABLE");
      } catch (e) {
        if (e.code === "ESRCH") ownerState = "absent";
        else blockingReasons.push("WRITER_ABSENCE_UNVERIFIABLE");
      }
    }
  }
  let catalogIntegrity = false, checkpointCoherence = false;
  try {
    const text2 = await readSettingsTextAsync(location.configurationFile);
    if (text2 === null) throw new Error();
    const catalog = await parseCooperatively(text2);
    if (!Array.isArray(catalog?.tasks) || !Array.isArray(catalog?.workflows)) throw new Error();
    catalogIntegrity = true;
    try {
      assertIdleCatalog(catalog, runtimeIdentity === null ? /* @__PURE__ */ new Map() : assertIdleJournals(location.runtimeDirectory));
      checkpointCoherence = true;
    } catch {
      blockingReasons.push("CATALOG_CHECKPOINT_COHERENCE_UNPROVEN");
    }
  } catch {
    blockingReasons.push("CATALOG_INVALID_OR_MISSING");
  }
  const ownerFile = path29.join(location.runtimeDirectory, "execution.lock", "owner.json");
  if (present(path29.dirname(ownerFile))) {
    if (!present(location.configurationFile + ".write-intent")) blockingReasons.push("EXECUTION_OWNER_BINDING_MISSING");
    try {
      const owner = JSON.parse(small(ownerFile));
      if (!lock || "legacy" in lock || owner.pid !== lock.pid || !Number.isSafeInteger(owner.pid)) throw new Error();
      let absent = false;
      try {
        process.kill(owner.pid, 0);
      } catch (e) {
        absent = e.code === "ESRCH";
      }
      if (!absent) throw new Error();
    } catch {
      blockingReasons.push("EXECUTION_OWNER_ACTIVE_OR_UNVERIFIABLE");
    }
  }
  if (!runtimeIdentity) blockingReasons.push("RUNTIME_MISSING");
  if (present(path29.join(location.runtimeDirectory, "lease-recovery.lock")) && !ownGuard) blockingReasons.push("RECOVERY_ALREADY_PENDING");
  if (present(location.configurationFile + ".write-intent")) {
    try {
      const intent = JSON.parse(small(location.configurationFile + ".write-intent"));
      const owner = JSON.parse(small(ownerFile));
      if (intent.schemaVersion !== 1 || intent.token !== lock?.token || intent.directoryIdentity !== directoryIdentity2 || intent.runtimeIdentity !== runtimeIdentity || JSON.stringify(intent.owner) !== JSON.stringify({ schemaVersion: owner.schemaVersion, token: owner.token, pid: owner.pid, createdAt: owner.createdAt }) || owner.settingsWriteIntent?.token !== intent.token || owner.settingsWriteIntent?.sha256 !== hash2(small(location.configurationFile + ".write-intent")) || !records.some((r) => r.name === "data.json" && (r.sha256 === intent.originalHash || r.sha256 === intent.preparedHash))) throw new Error();
    } catch {
      blockingReasons.push("INTENT_IDENTITY_OR_CATALOG_MISMATCH");
    }
  }
  const temporaries = [];
  for (const r of records.filter((r2) => !r2.name.includes("/") && r2.name.endsWith(".tmp"))) {
    let integrity = "not_checked_size";
    try {
      const target = path29.join(root, r.name);
      if (regular(target).size <= 16 * 1024 * 1024) {
        integrity = "incomplete_or_invalid";
        const text2 = await readSettingsTextAsync(target), value = text2 === null ? null : await parseCooperatively(text2);
        if (text2 !== null) integrity = "valid_json_not_catalog";
        if (Array.isArray(value?.tasks) && Array.isArray(value?.workflows)) integrity = "valid_catalog_unpromoted";
      }
    } catch {
      integrity = "incomplete_or_invalid";
    }
    temporaries.push({ name: r.name, sha256: r.sha256, integrity });
  }
  if (JSON.stringify(inventory) !== JSON.stringify(names(root)) || directoryIdentity2 !== settingsDirectoryIdentity(root) || runtimeIdentity !== (present(location.runtimeDirectory) ? settingsDirectoryIdentity(location.runtimeDirectory) : null)) blockingReasons.push("INSTALLATION_CHANGED");
  for (const prior of records) {
    try {
      if (JSON.stringify(prior) !== JSON.stringify(await record(root, prior.name))) blockingReasons.push("EVIDENCE_CHANGED:" + prior.name);
    } catch {
      blockingReasons.push("EVIDENCE_CHANGED:" + prior.name);
    }
  }
  const evidence = { schemaVersion: 1, vault: location.vault, installationDirectory: root, directoryIdentity: directoryIdentity2, runtimeIdentity, records, temporaries, lock, ownerState, catalogIntegrity, checkpointCoherence };
  return { ...evidence, inspectionHash: hash2(JSON.stringify(evidence)), recoverable: blockingReasons.length === 0, blockingReasons };
}
function readSettingsWriteDecision(file) {
  if (!path29.isAbsolute(file)) throw new Error("Explicit absolute decision file required");
  try {
    return JSON.parse(small(file));
  } catch {
    throw new Error("Invalid settings recovery decision file");
  }
}
function durable(file, text2) {
  const fd = fs29.openSync(file, "wx", 384);
  try {
    fs29.writeFileSync(fd, text2);
    fs29.fsyncSync(fd);
  } finally {
    fs29.closeSync(fd);
  }
}
function syncDirectory(directory2) {
  if (process.platform === "win32") return;
  const fd = fs29.openSync(directory2, "r");
  try {
    fs29.fsyncSync(fd);
  } finally {
    fs29.closeSync(fd);
  }
}
async function recoverSettingsWrite(vault, decision) {
  if (!decision || decision.schemaVersion !== 1 || decision.action !== "recover-settings-write" || typeof decision.reason !== "string" || !decision.reason.trim() || decision.preserveCatalog !== true || decision.executionsResumed !== false || !/^([a-f0-9]{64})$/.test(decision.inspectionHash || "")) throw new Error("Invalid explicit settings recovery decision");
  const initial = await inspectSettingsWrite(vault);
  const matches = (i) => i.recoverable && i.inspectionHash === decision.inspectionHash && decision.vault === i.vault && decision.installationDirectory === i.installationDirectory && decision.token === i.lock?.token && i.lock && "transactionId" in i.lock && decision.transactionId === i.lock.transactionId;
  if (!matches(initial)) throw new Error("Settings recovery decision is stale, mismatched or unsafe");
  const location = resolveInstalledWorkflowLocation(vault), guard = path29.join(location.runtimeDirectory, "lease-recovery.lock");
  fs29.mkdirSync(guard, { mode: 448 });
  const guardIdentity = settingsDirectoryIdentity(guard);
  let archive, committed = false, stage = "exclusion", failureReceiptWritten = false, backupVerified = false;
  const moved = [];
  try {
    const current = await inspectSettingsWrite(vault, true);
    if (!matches(current)) throw new Error("Settings recovery evidence changed under exclusion");
    const verify = () => {
      if (settingsDirectoryIdentity(guard) !== guardIdentity || settingsDirectoryIdentity(location.installationDirectory) !== current.directoryIdentity || settingsDirectoryIdentity(location.runtimeDirectory) !== current.runtimeIdentity) throw new Error("Settings recovery installation changed");
      if (!current.lock || "legacy" in current.lock) throw new Error("Missing structured owner");
      let absent = false;
      try {
        process.kill(current.lock.pid, 0);
      } catch (e) {
        absent = e.code === "ESRCH";
      }
      if (!absent) throw new Error("Settings writer is no longer verifiably absent");
      const expectedNames = names(location.installationDirectory).filter((n) => !moved.includes(n));
      const originalNames = current.records.map((r) => r.name).filter((n) => !moved.includes(n));
      if (JSON.stringify(expectedNames) !== JSON.stringify(originalNames)) throw new Error("Settings recovery inventory changed");
      for (const r of current.records.filter((r2) => !moved.includes(r2.name))) {
        const target = path29.join(location.installationDirectory, r.name), s = present(target);
        if (r.identity === null) {
          if (s) throw new Error("Settings evidence appeared");
          continue;
        }
        if (!s || s.isSymbolicLink() || identity(s) !== r.identity || (r.sha256 === null ? !s.isDirectory() : identity(regular(target)) !== r.identity || hash2(stableBytes(target)) !== r.sha256)) throw new Error("Settings recovery evidence changed");
      }
    };
    verify();
    stage = "archive";
    const targetArchive = path29.join(location.runtimeDirectory, "settings-write-explicit-" + (0, import_crypto13.randomUUID)());
    fs29.mkdirSync(targetArchive, { mode: 448 });
    archive = targetArchive;
    syncDirectory(location.runtimeDirectory);
    durable(path29.join(guard, "settings-recovery.json"), JSON.stringify({ schemaVersion: 1, inspectionHash: current.inspectionHash, archive: path29.basename(archive) }));
    syncDirectory(guard);
    stage = "backup";
    const bytes = stableBytes(location.configurationFile), backup = path29.join(archive, "data.json.backup");
    durable(backup, bytes);
    if (hash2(stableBytes(backup)) !== current.records.find((r) => r.name === "data.json")?.sha256) throw new Error("Settings recovery backup verification failed");
    backupVerified = true;
    syncDirectory(archive);
    verify();
    stage = "archive-evidence";
    const artifacts = current.records.filter((r) => r.identity !== null && r.name !== "data.json" && !r.name.startsWith("runtime/"));
    artifacts.sort((a, b) => Number(a.name === "data.json.write-lock") - Number(b.name === "data.json.write-lock"));
    for (const r of artifacts) {
      verify();
      const target = path29.join(archive, r.name);
      if (present(target)) throw new Error("Settings recovery destination already exists");
      fs29.renameSync(path29.join(location.installationDirectory, r.name), target);
      moved.push(r.name);
      syncDirectory(archive);
      syncDirectory(location.installationDirectory);
      if (hash2(stableBytes(target)) !== r.sha256) throw new Error("Settings recovery archive verification failed");
    }
    verify();
    stage = "receipt";
    durable(path29.join(archive, "receipt.json"), JSON.stringify({ schemaVersion: 1, inspectionHash: current.inspectionHash, backup: "data.json.backup", moved, executionsResumed: false, temporaryPromoted: false }));
    syncDirectory(archive);
    committed = true;
    stage = "release-guard";
    fs29.unlinkSync(path29.join(guard, "settings-recovery.json"));
    syncDirectory(guard);
    fs29.rmdirSync(guard);
    syncDirectory(location.runtimeDirectory);
    return { recovered: true, stage: "completed", archive, backup, moved, executionsResumed: false, temporaryPromoted: false, directorySync: process.platform === "win32" ? "not_supported" : "completed" };
  } catch {
    if (archive) {
      try {
        durable(path29.join(archive, "failure.json"), JSON.stringify({ stage, moved, committed, guardRetained: present(guard) !== void 0 }));
        failureReceiptWritten = true;
      } catch {
      }
    } else {
      try {
        if (settingsDirectoryIdentity(guard) === guardIdentity) fs29.rmdirSync(guard);
      } catch {
      }
    }
    const pending = initial.records.filter((r) => r.identity !== null && r.name !== "data.json" && !r.name.startsWith("runtime/") && !moved.includes(r.name)).map((r) => r.name);
    return { recovered: false, error: "SETTINGS_RECOVERY_FAILED", stage, archive, backup: archive ? path29.join(archive, "data.json.backup") : void 0, backupVerified, moved, pending, committed, failureReceiptWritten, guardRetained: present(guard) !== void 0, executionsResumed: false, temporaryPromoted: false };
  }
}

// release-maintenance.ts
var fs32 = __toESM(require("fs"));
var path32 = __toESM(require("path"));
var import_crypto15 = require("crypto");

// package-maintenance.ts
var fs30 = __toESM(require("fs"));
var path30 = __toESM(require("path"));
function assertPackageMaintenanceSafe(directory2) {
  const runtime = path30.join(directory2, "runtime");
  if (fs30.existsSync(path30.join(runtime, "update-pending.json"))) throw new Error("Incomplete plugin update requires recovery");
  if (fs30.readdirSync(directory2).some((name) => name === "data.json.write-lock" || name === "data.json.write-intent" || name.startsWith("data.json.") && name.endsWith(".tmp")) || fs30.readdirSync(runtime).some((name) => name.endsWith(".tmp") || name.endsWith(".write-lock"))) {
    throw new Error("Unfinished write requires reconciliation before package maintenance");
  }
}

// release-update.ts
var fs31 = __toESM(require("fs"));
var path31 = __toESM(require("path"));
var import_crypto14 = require("crypto");
var RELEASE_FILES = ["main.js", "manifest.json", "styles.css", "autooc-cli.cjs", "autooc-runtime.cjs", "skills/autooc-runtime/SKILL.md"];
var RELEASE_DESCRIPTOR = "release-integrity.json";
function verifyRelease(files2, expectedVersion) {
  const descriptor = JSON.parse(files2[RELEASE_DESCRIPTOR]?.toString("utf8") || "null");
  if (descriptor?.schemaVersion !== 1 || descriptor.version !== expectedVersion || !descriptor.sha256 || Object.keys(descriptor.sha256).sort().join() !== [...RELEASE_FILES].sort().join() || Object.keys(files2).sort().join() !== [...RELEASE_FILES, RELEASE_DESCRIPTOR].sort().join()) {
    throw new Error("Incomplete or incompatible AutoOC release");
  }
  for (const file of RELEASE_FILES) {
    if (!Buffer.isBuffer(files2[file]) || (0, import_crypto14.createHash)("sha256").update(files2[file]).digest("hex") !== descriptor.sha256[file]) {
      throw new Error(`Release integrity mismatch: ${file}`);
    }
  }
  const manifest = JSON.parse(files2["manifest.json"].toString("utf8"));
  if (manifest.id !== "auto-oc" || manifest.version !== expectedVersion) throw new Error("Release manifest identity mismatch");
}
function regularPath2(root, relative7, create = false) {
  let current = root;
  const parts = relative7.split("/");
  for (let i = 0; i < parts.length; i++) {
    current = path31.join(current, parts[i]);
    let stat;
    try {
      stat = fs31.lstatSync(current);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (stat && (stat.isSymbolicLink() || (i < parts.length - 1 ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1))) {
      throw new Error(`Unsafe release destination: ${relative7}`);
    }
    if (!stat && i < parts.length - 1 && create) fs31.mkdirSync(current);
  }
  return current;
}
function installRelease(options) {
  const { files: files2, version: version2, lease } = options;
  verifyRelease(files2, version2);
  const directory2 = fs31.realpathSync(options.directory);
  if (fs31.lstatSync(options.directory).isSymbolicLink() || path31.join(directory2, "runtime") !== lease.directory) throw new Error("Update lease belongs to another installation");
  lease.assertOwned();
  const marker = path31.join(lease.directory, "update-pending.json");
  if (fs31.existsSync(marker)) throw new Error("Previous update requires recovery");
  assertPackageMaintenanceSafe(directory2);
  const names2 = [...RELEASE_FILES, RELEASE_DESCRIPTOR];
  for (const name of names2) regularPath2(directory2, name);
  const backup = path31.join(lease.directory, `update-backup-${(0, import_crypto14.randomUUID)()}`);
  fs31.mkdirSync(backup);
  const previous = /* @__PURE__ */ new Map();
  for (const name of names2) {
    const source = regularPath2(directory2, name);
    const bytes = fs31.existsSync(source) ? fs31.readFileSync(source) : void 0;
    previous.set(name, bytes);
    if (bytes) {
      const target = path31.join(backup, name);
      fs31.mkdirSync(path31.dirname(target), { recursive: true });
      fs31.writeFileSync(target, bytes, { flag: "wx" });
    }
  }
  const record2 = { schemaVersion: 1, version: version2, backup: path31.basename(backup), files: names2, absent: names2.filter((name) => !previous.has(name) || previous.get(name) === void 0) };
  fs31.writeFileSync(path31.join(backup, "recovery.json"), JSON.stringify(record2));
  const fd = fs31.openSync(marker, "wx");
  try {
    fs31.writeFileSync(fd, JSON.stringify(record2));
    fs31.fsyncSync(fd);
  } finally {
    fs31.closeSync(fd);
  }
  const written = [];
  try {
    for (const name of names2) {
      lease.assertOwned();
      const target = regularPath2(directory2, name, true);
      written.push(name);
      fs31.writeFileSync(target, files2[name]);
    }
    const installed = Object.fromEntries(names2.map((name) => [name, fs31.readFileSync(regularPath2(directory2, name))]));
    verifyRelease(installed, version2);
    fs31.unlinkSync(marker);
    return { version: version2, backup, installed: names2 };
  } catch (error) {
    for (const name of written.reverse()) {
      const target = regularPath2(directory2, name);
      const bytes = previous.get(name);
      if (bytes !== void 0) fs31.writeFileSync(target, bytes);
      else if (fs31.existsSync(target)) fs31.unlinkSync(target);
    }
    fs31.unlinkSync(marker);
    throw error;
  }
}

// release-maintenance.ts
function readDecisionFile(file) {
  if (!path32.isAbsolute(file)) throw new Error("Explicit absolute decision file required");
  const stat = fs32.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 1024 * 1024) throw new Error("Decision file must be a regular JSON file of at most 1MB");
  try {
    return JSON.parse(fs32.readFileSync(file, "utf8"));
  } catch {
    throw new Error("Invalid decision JSON");
  }
}
async function maintainRelease(options) {
  const names2 = [...RELEASE_FILES, RELEASE_DESCRIPTOR];
  const regular2 = (file) => {
    const stat = fs32.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error("Unsafe maintenance file");
    return fs32.readFileSync(file);
  };
  const source = physicalPath(options.sourceDirectory), files2 = {};
  for (const name of names2) {
    let current = source;
    for (const part of name.split("/").slice(0, -1)) {
      current = path32.join(current, part);
      if (fs32.lstatSync(current).isSymbolicLink() || !fs32.statSync(current).isDirectory()) throw new Error("Unsafe package directory");
    }
    files2[name] = regular2(path32.join(source, name));
  }
  verifyRelease(files2, options.version);
  const location = resolveInstalledWorkflowLocation(options.vault), identity2 = dispositionLocation(location);
  if (source === location.installationDirectory) throw new Error("Run maintenance from a separate extracted package");
  let abandonmentEvidence;
  const assertContext = () => {
    const current = dispositionLocation(resolveInstalledWorkflowLocation(options.vault));
    if (JSON.stringify(current) !== JSON.stringify(identity2)) throw new Error("Maintenance installation identity changed");
    assertPackageMaintenanceSafe(location.installationDirectory);
    const catalog = JSON.parse(regular2(location.configurationFile).toString("utf8"));
    if (["tasks", "workflows"].some((k) => !Array.isArray(catalog[k]))) throw new Error("Invalid maintenance catalog");
    const checkpoints = new Map(fs32.readdirSync(location.runtimeDirectory).filter((n) => /^[a-zA-Z0-9-]+\.json$/.test(n)).map((name) => {
      const state = readExecutionCheckpoint(location.runtimeDirectory, name.slice(0, -5));
      return [state.runId, state];
    }));
    const evidence = /* @__PURE__ */ new Map();
    for (const state of checkpoints.values()) if (state.abandonment) for (const name of [state.runId + ".json", state.abandonment.snapshot]) {
      evidence.set(name, regular2(path32.join(location.runtimeDirectory, name)));
    }
    if (abandonmentEvidence && (evidence.size !== abandonmentEvidence.size || [...evidence].some(([name, bytes]) => !abandonmentEvidence.get(name)?.equals(bytes)))) throw new Error("Abandonment evidence changed during maintenance");
    abandonmentEvidence ??= evidence;
    assertIdleCatalog(Object.fromEntries(["tasks", "workflows"].map((kind) => [kind, catalog[kind].filter((entry) => {
      const binding = entry.runtimeExecution;
      return binding && (!checkpoints.has(binding.runId) || checkpoints.get(binding.runId).phase === "abandoned");
    })])), checkpoints);
  };
  assertContext();
  if (fs32.existsSync(path32.join(location.runtimeDirectory, "execution.lock"))) throw new Error("Unload AutoOC normally; execution reservation is present");
  const executions = fs32.readdirSync(location.runtimeDirectory).filter((n) => /^[a-zA-Z0-9-]+\.json$/.test(n)).sort().map((name) => {
    const state = readExecutionCheckpoint(location.runtimeDirectory, name.slice(0, -5));
    if (["ready", "in_flight"].includes(state.phase)) return { runId: state.runId, workflowId: state.workflowId, phase: state.phase, revision: state.revision, causes: [], disposition: void 0, requiresReconciliation: true };
    return inspectTerminalExecution({ vault: location.vault, runId: state.runId });
  });
  const installedVersion = JSON.parse(regular2(path32.join(location.installationDirectory, "manifest.json")).toString("utf8")).version;
  if (!options.decisions) return { mode: "inspect", version: options.version, installedVersion, ...identity2, executions, activityVerified: false };
  if (!Array.isArray(options.decisions) || new Set(options.decisions.map((d) => d?.runId)).size !== options.decisions.length) throw new Error("Select distinct individual decisions");
  for (const d of options.decisions) {
    const observed = executions.find((e) => e.runId === d?.runId);
    if (!observed || observed.disposition || !observed.causes.length || Object.keys(observed).some((key) => key !== "disposition" && JSON.stringify(observed[key]) !== JSON.stringify(d[key])) || d.acknowledgedUnknownEffects !== true || typeof d.reason !== "string" || !d.reason.trim() || d.reason.length > 1e3) throw new Error("Decision identity, revision, reason or acknowledgement is invalid; inspect again");
  }
  const lease = acquireExecutionLease(location.runtimeDirectory), applied = [];
  let backup, failure;
  try {
    lease.assertOwned();
    assertContext();
    backup = path32.join(location.runtimeDirectory, "maintenance-backup-" + (0, import_crypto15.randomUUID)());
    fs32.mkdirSync(backup, { mode: 448 });
    const hashes = {};
    const save = (relative7, bytes) => {
      lease.assertOwned();
      const target = path32.join(backup, relative7);
      fs32.mkdirSync(path32.dirname(target), { recursive: true, mode: 448 });
      const fd = fs32.openSync(target, "wx", 384);
      try {
        fs32.writeFileSync(fd, bytes);
        fs32.fsyncSync(fd);
      } finally {
        fs32.closeSync(fd);
      }
      const digest = (b) => (0, import_crypto15.createHash)("sha256").update(b).digest("hex");
      if (digest(regular2(target)) !== digest(bytes)) throw new Error("Maintenance backup verification failed");
      hashes[relative7] = digest(bytes);
    };
    for (const name of names2) save(name, regular2(path32.join(location.installationDirectory, name)));
    const catalog = regular2(location.configurationFile);
    save("data.json", catalog);
    const journals = fs32.readdirSync(location.runtimeDirectory).filter((n) => /^[a-zA-Z0-9-]+\.json$/.test(n) || /^(abandonment|disposition)-[a-zA-Z0-9-]+\.snapshot$/.test(n));
    for (const name of journals) save("runtime/" + name, regular2(path32.join(location.runtimeDirectory, name)));
    save("backup-integrity.json", Buffer.from(JSON.stringify({ version: installedVersion, ...identity2, sha256: hashes })));
    lease.assertOwned();
    assertContext();
    if (!regular2(location.configurationFile).equals(catalog)) throw new Error("Catalog changed before disposition");
    for (const d of options.decisions) {
      const state = await disposeTerminalExecution({ ...d, lease });
      applied.push({ runId: state.runId, revision: state.revision, phase: state.phase, outcome: "unknown" });
    }
    lease.assertOwned();
    assertContext();
    if (!regular2(location.configurationFile).equals(catalog)) throw new Error("Catalog changed during maintenance");
    assertPackageMaintenanceSafe(location.installationDirectory);
    const installed = installRelease({ directory: location.installationDirectory, version: options.version, files: files2, lease });
    return { mode: "installed", ...installed, maintenanceBackup: backup, applied, loadedInObsidian: false, reloadRequired: true };
  } catch (error) {
    const inspectionRequired = [];
    for (const decision of options.decisions) {
      if (applied.some((item) => item.runId === decision.runId)) continue;
      try {
        const state = readExecutionCheckpoint(location.runtimeDirectory, decision.runId), d = state.disposition;
        if (d && d.previousRevision === decision.revision && d.reason === decision.reason.trim() && d.definitionHash === decision.definitionHash && d.vaultIdentity === decision.vaultIdentity && d.installationIdentity === decision.installationIdentity) {
          applied.push({ runId: state.runId, revision: state.revision, phase: state.phase, outcome: "unknown" });
        }
      } catch {
        inspectionRequired.push(decision.runId);
      }
    }
    failure = new Error(JSON.stringify({ error: "Maintenance did not complete", detail: error.message, maintenanceBackup: backup, applied, inspectionRequired, loadedInObsidian: false }));
    throw failure;
  } finally {
    try {
      lease.release();
    } catch (error) {
      throw new Error(JSON.stringify({ error: "Maintenance reservation could not be released", detail: error.message, operationError: failure instanceof Error ? failure.message : void 0, maintenanceBackup: backup, applied, loadedInObsidian: false }));
    }
  }
}

// cli-catalog-summary.ts
function summarizeCliCatalog(config, includeStatus) {
  const status = (value) => ["idle", "pending", "running", "completed", "failed", "cancelled", "abandoned"].includes(value) ? value : "unknown";
  const summarize = (item, reason, recordedStatus = item?.status) => {
    if (!item || typeof item.id !== "string" || typeof item.name !== "string") throw new Error("Invalid catalog entry.");
    return {
      id: item.id,
      name: item.name,
      disabled: item.disabled === true,
      blockedByDisabled: !!reason,
      ...reason ? { disabledReason: reason } : {},
      ...includeStatus ? { recordedStatus: status(recordedStatus) } : {}
    };
  };
  const tasks = config.tasks.map((task) => summarize(task, taskDisabledReason(task)));
  const workflows = config.workflows.map((workflow) => summarize(workflow, workflowDisabledReason(workflow, config.tasks, config.workflows)));
  const codeSteps = config.workflows.flatMap((workflow) => (workflow.steps || []).filter((step) => step.stepKind === "code").map((step) => ({
    ...summarize(
      { id: step.id, name: step.name || step.id, disabled: step.disabled },
      workflowDisabledReason(selectCodeStep(workflow, step.id), config.tasks),
      codeStepDisplay(step).status
    ),
    workflowId: workflow.id,
    workflowName: workflow.name
  })));
  return { tasks, workflows, codeSteps };
}

// autooc-cli.ts
var version = "1.7.26";
async function main(args) {
  const [command, ...rest] = args;
  if (command === "inspect-request" || command === "follow") {
    const values = /* @__PURE__ */ new Map();
    for (let i = 0; i < rest.length; i += 2) {
      const key = rest[i], value = rest[i + 1];
      if (!["--vault", "--request-id", "--run", "--include-output", ...command === "follow" ? ["--timeout-ms"] : []].includes(key) || !value || value.startsWith("--") || values.has(key)) throw new Error("Invalid inspection options; use help");
      values.set(key, value);
    }
    if (!path33.isAbsolute(values.get("--vault") || "") || values.has("--include-output") && values.get("--include-output") !== "true" || values.has("--timeout-ms") && !/^\d+$/.test(values.get("--timeout-ms"))) throw new Error("Inspection requires an absolute vault and valid options");
    const location2 = resolveInstalledWorkflowLocation(values.get("--vault"));
    const selector = { requestId: values.get("--request-id"), runId: values.get("--run"), includeOutput: values.get("--include-output") === "true" };
    const controller = new AbortController(), abort = () => controller.abort();
    process.on("SIGINT", abort);
    process.on("SIGTERM", abort);
    try {
      const result = command === "follow" ? await followPluginRequest(location2.runtimeDirectory, selector, {
        timeoutMs: values.has("--timeout-ms") ? Number(values.get("--timeout-ms")) : void 0,
        signal: controller.signal,
        onProgress: (state) => {
          const { result: output, ...summary3 } = state;
          process.stderr.write(JSON.stringify({ event: "observation", ...summary3 }) + "\n");
        }
      }) : inspectPluginRequest(location2.runtimeDirectory, selector);
      if (result.interrupted) process.exitCode = 130;
      else if (result.state === "unknown" || result.waitTimedOut) process.exitCode = 2;
      else if (result.state === "not-accepted" || result.checkpoint?.phase === "failed") process.exitCode = 1;
      return { version, ...result };
    } finally {
      process.off("SIGINT", abort);
      process.off("SIGTERM", abort);
    }
  }
  if (command === "create-page" || command === "inspect-page-request") {
    const inspect = command === "inspect-page-request";
    if (rest.length !== 4 || rest[0] !== "--vault" || !path33.isAbsolute(rest[1]) || rest[2] !== (inspect ? "--request-id" : "--request")) throw new Error("Use create-page --vault ROOT --request JSON or inspect-page-request --vault ROOT --request-id ID");
    const location2 = resolveInstalledWorkflowLocation(rest[1]);
    if (inspect) return { version, ...inspectPageCreation(location2.runtimeDirectory, rest[3]) };
    const request = readPageCreationRequest(rest[3]);
    const result = await requestPluginPageCreation(location2.runtimeDirectory, request) || await createStandalonePage(rest[1], request);
    if (["blocked", "needs-review", "environment", "preparing", "launching"].includes(result.status) || result.launchPhase === "failed") process.exitCode = 1;
    return { version, ...result };
  }
  if (command === "inspect-settings-write" || command === "recover-settings-write") {
    const inspect = command === "inspect-settings-write";
    if (rest.length !== (inspect ? 2 : 4) || rest[0] !== "--vault" || !path33.isAbsolute(rest[1] || "") || !inspect && (rest[2] !== "--decision" || !path33.isAbsolute(rest[3] || ""))) throw new Error("Use inspect-settings-write --vault <absolute path> or recover-settings-write --vault <absolute path> --decision <absolute JSON file>");
    if (inspect) return { version, ...await inspectSettingsWrite(rest[1]) };
    const result = await recoverSettingsWrite(rest[1], readSettingsWriteDecision(rest[3]));
    if (!result.recovered) process.exitCode = 1;
    return { version, ...result };
  }
  if (command === "maintain-release") {
    if (rest[0] !== "--vault" || !path33.isAbsolute(rest[1] || "") || !(rest.length === 3 && ["--inspect", "--install"].includes(rest[2]) || rest.length === 4 && rest[2] === "--decisions")) throw new Error("Use maintain-release --vault <absolute vault> <--inspect|--install|--decisions absolute-JSON-file>");
    return maintainRelease({ sourceDirectory: __dirname, vault: rest[1], version, decisions: rest[2] === "--decisions" ? readDecisionFile(rest[3]) : rest[2] === "--install" ? [] : void 0 });
  }
  if (command === "inspect-terminal" || command === "dispose-terminal") {
    if (rest.length !== 4 || rest[0] !== "--vault" || !path33.isAbsolute(rest[1]) || rest[2] !== (command === "inspect-terminal" ? "--run" : "--decision")) throw new Error("Use --vault <absolute path> and --run <id> or --decision <absolute JSON file>, in that order");
    if (command === "inspect-terminal") return { version, ...inspectTerminalExecution({ vault: rest[1], runId: rest[3] }) };
    const decision = readDecisionFile(rest[3]);
    if (!decision || Array.isArray(decision) || decision.vault !== resolveInstalledWorkflowLocation(rest[1]).vault) throw new Error("Decision vault identity mismatch");
    const result = await disposeTerminalExecution({ ...decision, lease: void 0 });
    return { version, runId: result.runId, workflowId: result.workflowId, phase: result.phase, revision: result.revision, disposition: result.disposition };
  }
  if (command === "export-workflow" || command === "edit-workflow") {
    const last = command === "export-workflow" ? "--out" : "--patch";
    if (rest.length !== 6 || rest[0] !== "--vault" || rest[2] !== "--workflow" || rest[4] !== last || !path33.isAbsolute(rest[1]) || !path33.isAbsolute(rest[5])) throw new Error("Use --vault <absolute path> --workflow <id> " + last + " <absolute JSON file>, in that order");
    const location2 = resolveInstalledWorkflowLocation(rest[1]);
    if (command === "export-workflow") {
      let catalog;
      try {
        catalog = JSON.parse(fs33.readFileSync(location2.configurationFile, "utf8"));
      } catch {
        throw new Error("Cannot read valid AutoOC configuration");
      }
      const workflows = catalog.workflows?.filter((w) => w.id === rest[3]);
      if (workflows?.length !== 1) throw new Error("Workflow identity is missing or ambiguous");
      const workflow = workflows[0];
      fs33.writeFileSync(rest[5], JSON.stringify({ workflowId: workflow.id, expectedHash: workflowEditHash(workflow), definition: workflowEditDefinition(workflow) }, null, 2), { flag: "wx", mode: 384 });
      return { version, workflowId: workflow.id, expectedHash: workflowEditHash(workflow), exported: true };
    }
    const stat = fs33.lstatSync(rest[5]);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 6e4) throw new Error("Patch must be a regular JSON file of at most 60KB");
    let patch;
    try {
      patch = JSON.parse(fs33.readFileSync(rest[5], "utf8"));
    } catch {
      throw new Error("Invalid workflow patch JSON");
    }
    const edit = { command: "edit-workflow", workflowId: rest[3], expectedHash: patch?.expectedHash, changes: patch?.changes };
    if (!validWorkflowEdit(edit)) throw new Error("Invalid workflow patch; export current definition and use expectedHash plus supported changes");
    return { version, ...await requestPluginWorkflowEdit(location2.runtimeDirectory, edit) };
  }
  if (command === "abandon") {
    const keys = ["--vault", "--workflow", "--run", "--revision", "--reason", "--acknowledge-unknown-effects"];
    if (rest.length !== 12 || keys.some((key, index) => rest[index * 2] !== key) || !/^(0|[1-9]\d*)$/.test(rest[7]) || rest[11] !== "true") {
      throw new Error("Abandon requires --vault, --workflow (use @task:ID for a standalone task), --run, --revision, --reason and --acknowledge-unknown-effects true, in that order");
    }
    const result = await abandonInstalledExecution({ vault: rest[1], workflowId: rest[3], runId: rest[5], revision: Number(rest[7]), reason: rest[9], acknowledgedUnknownEffects: true });
    return { version, runId: result.runId, workflowId: result.workflowId, phase: result.phase, revision: result.revision, abandonment: result.abandonment };
  }
  if (command === "approve" || command === "deny") {
    if (rest.length !== 6 || rest[0] !== "--vault" || !path33.isAbsolute(rest[1]) || rest[2] !== "--run" || rest[4] !== "--approval") throw new Error("Decision requires --vault, --run and exact --approval token");
    let directory2 = fs33.realpathSync(rest[1]);
    for (const part of [".obsidian", "plugins", "auto-oc", "runtime"]) {
      directory2 = path33.join(directory2, part);
      const stat = fs33.lstatSync(directory2);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Invalid runtime directory");
    }
    return { version, ...answerWorkflowApproval(directory2, rest[3], rest[5], command === "approve") };
  }
  if (command === "recover-lease") {
    if (rest.length !== 4 || rest[0] !== "--vault" || !path33.isAbsolute(rest[1]) || rest[2] !== "--owner" || !rest[3]) throw new Error("Lease recovery requires explicit absolute vault and observed --owner identity");
    let directory2 = fs33.realpathSync(rest[1]);
    for (const part of [".obsidian", "plugins", "auto-oc", "runtime"]) {
      directory2 = path33.join(directory2, part);
      const stat = fs33.lstatSync(directory2);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Invalid runtime directory");
    }
    return { version, ...recoverExecutionLease(directory2, rest[3]) };
  }
  if (command === "version" && !rest.length) return { version, experimental: true, capabilities: ["inspect-request", "follow", "list", "status", "pages", "create-page", "inspect-page-request", "run", "resume", "reconcile", "stop", "recover-lease", "inspect-settings-write", "recover-settings-write", "approve", "deny", "abandon", "inspect-terminal", "dispose-terminal", "maintain-release", "export-workflow", "edit-workflow"], taskSelection: true, codeStepSelection: true, nestedWorkflows: 1, catalogAvailability: 1, pageSelection: 1, pageCreation: 1, pluginRequests: 1, requestInspection: 1, phaseTimings: 1, workflowEditing: 1 };
  if (command === "help" && !rest.length) return { requestInspection: "inspect-request|follow --vault ROOT <--request-id UUID|--run ID> [--include-output true]; follow also accepts --timeout-ms (0..86400000, default 30000). Read-only; never executes or cancels work. States: not-accepted, running, finished, unknown. Exit 2 means uncertainty or wait timeout; retain the same identity and do not launch again. Stored output is opt-in; diagnostics contain numeric phase timings only.", pageCreation: pageCreationHelp, usage: "node autooc-cli.cjs <list|status|pages> --vault <absolute-path>", execution: "<run|resume|reconcile|stop> --vault <absolute-path> <--workflow id [--step code-step-id]|--task id> [--run <run-id> for resume/reconcile/stop] [--page <id|main>]", nestedWorkflows: "Workflow steps reference workflowId in the catalog; exports use workflowExportId and schema 1.7.0. Run, stop, reconcile and resume select the parent workflow/run. Child schedules are ignored; cycles and more than 16 levels are rejected.", pages: "pages --vault <absolute path> lists page IDs without creating folders. Omit --page or use --page main for legacy Main workspace behavior, including task-specific folders. Custom --page selects an existing page for run/resume/reconcile/stop; status --vault <absolute path> --page <id> shows its runs. --step is Main workspace only. The current shell folder never selects a page. Plugin delegation requires pageSelection:1; a loaded older plugin is rejected before submission. Standalone execution keeps one owner per installation and requires compatible non-GUI tasks.", catalog: "list/status include disabled, blockedByDisabled, disabledReason and codeSteps; these are availability gates, not proof of readiness or live activity.", codeSteps: "--step selects one Code step with empty input/outputs and preserves the full workflow result. Requires codeStepSelection:true in CLI and loaded host. run/resume reject disabled items; reconcile/stop remain available for the exact recorded execution.", settingsWriteRecovery: "inspect-settings-write --vault <absolute path>; recover-settings-write --vault <absolute path> --decision <absolute JSON file>. Requires reviewed inspectionHash, token, transactionId, reason, preserveCatalog:true and executionsResumed:false. Never resumes or recovers the execution lease.", recovery: "recover-lease --vault <absolute-path> --owner <observed-owner-token>", decision: "<approve|deny> --vault <absolute-path> --run <run-id> --approval <observed-token>", terminalDisposition: "inspect-terminal --vault <absolute vault> --run <id>; dispose-terminal --vault <absolute vault> --decision <absolute JSON file containing the exact inspection plus reason and acknowledgedUnknownEffects:true>. Unload plugin first. Keeps historical phase and unknown outcome.", maintenance: "maintain-release --vault <absolute vault> <--inspect|--install|--decisions absolute-JSON-file> from a separate extracted corrected package; --install preserves all historical runs without resolving them; optional decisions are an array of individually reviewed inspections plus reason and acknowledgedUnknownEffects:true. Backs up and installs under one lease. Never recovers locks.", abandonment: "abandon --vault <absolute-path> --workflow <id or @task:ID> --run <run-id> --revision <observed-revision> --reason <human-decision> --acknowledge-unknown-effects true (close/disable plugin first; preserves unknown outcome, does not stop external processes)", workflowEditing: "export-workflow --vault <absolute-path> --workflow ID --out <new absolute JSON file>; edit-workflow --vault <absolute-path> --workflow ID --patch <absolute JSON file containing expectedHash and changes>. Keep Obsidian open; name/description/existing step text only.", experimental: true, foreground: true };
  if (["run", "resume", "reconcile", "stop"].includes(command)) {
    const values = /* @__PURE__ */ new Map();
    const target = rest.includes("--task") ? "--task" : "--workflow";
    const allowed = command === "run" ? ["--vault", target] : ["--vault", target, "--run"];
    if (rest.includes("--page")) allowed.push("--page");
    if (rest.includes("--step")) {
      if (target !== "--workflow") throw new Error("--step requires --workflow, not --task");
      allowed.push("--step");
    }
    if (rest.length !== allowed.length * 2) throw new Error("Execution requires explicit vault, workflow and recovery identity where applicable");
    for (let index = 0; index < rest.length; index += 2) {
      const key = rest[index], value = rest[index + 1];
      if (!allowed.includes(key) || values.has(key) || !value || value.startsWith("--")) throw new Error("Invalid execution options");
      values.set(key, value);
    }
    const pageId2 = normalizePageSelection(values.get("--page"));
    if (pageId2 && values.has("--step")) throw new Error("Page execution requires a complete workflow or task; --step is only supported in Main workspace.");
    if (command === "stop") {
      if (!path33.isAbsolute(values.get("--vault"))) throw new Error("Explicit absolute vault required");
      let directory2 = fs33.realpathSync(values.get("--vault"));
      for (const part of [".obsidian", "plugins", "auto-oc", "runtime"]) {
        directory2 = path33.join(directory2, part);
        const stat = fs33.lstatSync(directory2);
        if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Invalid runtime directory");
      }
      const state = readExecutionCheckpoint(directory2, values.get("--run"));
      const identity2 = pageId2 ? pageExecutionId(pageId2, values.get(target), target === "--task") : target === "--task" ? standaloneTaskWorkflow(values.get(target)).id : values.get(target);
      if (state.workflowId !== identity2) throw new Error("Execution belongs to another workflow or task");
      if (values.has("--step")) {
        let catalog;
        try {
          catalog = JSON.parse(fs33.readFileSync(path33.join(path33.dirname(directory2), "data.json"), "utf8"));
        } catch {
          throw new Error("Cannot read valid AutoOC configuration");
        }
        const matches = catalog.workflows?.filter((workflow) => workflow.id === identity2);
        if (matches?.length !== 1) throw new Error("Workflow identity is missing or ambiguous");
        const selected = readCodeStepCheckpoint(directory2, matches[0], values.get("--step"));
        if (selected?.runId !== state.runId) throw new Error("Execution does not belong to the selected isolated code step");
      }
      return { version, experimental: true, ...pageId2 ? { pageId: pageId2 } : {}, ...await requestWorkflowStop(directory2, state.runId) };
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    process.on("SIGINT", abort);
    process.on("SIGTERM", abort);
    try {
      const location2 = resolveInstalledWorkflowLocation(values.get("--vault"));
      const progress = (host, state) => process.stderr.write(JSON.stringify({ event: "progress", host, ...pageId2 ? { pageId: pageId2 } : {}, ...executionSummary(state) }) + "\n");
      const delegated = await requestPluginExecution(location2.runtimeDirectory, {
        command,
        workflowId: values.get("--workflow"),
        taskId: values.get("--task"),
        stepId: values.get("--step"),
        runId: values.get("--run"),
        ...pageId2 ? { pageId: pageId2 } : {}
      }, controller.signal, (state) => progress("obsidian", state), (requestId2) => process.stderr.write(JSON.stringify({ event: "submitted", host: "obsidian", requestId: requestId2 }) + "\n"));
      const result = delegated || await runStandaloneWorkflowWithPages({
        vault: values.get("--vault"),
        workflowId: values.get("--workflow"),
        taskId: values.get("--task"),
        stepId: values.get("--step"),
        pageId: pageId2,
        resumeRunId: values.get("--run"),
        newExecution: command === "run",
        reconcile: command === "reconcile",
        signal: controller.signal,
        redact: (text2) => text2,
        includePresentation: true,
        onCheckpoint: async (checkpoint, _catalog, presentation) => {
          progress("standalone", executionSummary(checkpoint, presentation));
        }
      });
      if (controller.signal.aborted) process.exitCode = 130;
      else if (result.phase === "failed") process.exitCode = 1;
      return { version, experimental: true, ...pageId2 ? { pageId: pageId2 } : {}, ...executionSummary(result) };
    } finally {
      process.off("SIGINT", abort);
      process.off("SIGTERM", abort);
    }
  }
  const pageStatus = command === "status" && rest.length === 4 && rest[2] === "--page";
  if (!["list", "status", "pages"].includes(command) || !(rest.length === 2 || pageStatus) || rest[0] !== "--vault" || !path33.isAbsolute(rest[1])) {
    throw new Error("Use help for supported commands; an explicit absolute --vault is required.");
  }
  const pageId = pageStatus ? normalizePageSelection(rest[3]) : void 0;
  const vault = fs33.realpathSync(rest[1]);
  let location = vault;
  for (const part of [".obsidian", "plugins", "auto-oc", "data.json"]) {
    location = path33.join(location, part);
    if (fs33.lstatSync(location).isSymbolicLink()) throw new Error("Linked installation paths are unsupported.");
  }
  if (!fs33.statSync(location).isFile()) throw new Error("Configuration is not a regular file.");
  let config;
  try {
    config = JSON.parse(fs33.readFileSync(location, "utf8"));
  } catch {
    throw new Error("Cannot read valid AutoOC configuration.");
  }
  if (!config || !Array.isArray(config.tasks) || !Array.isArray(config.workflows)) throw new Error("Invalid AutoOC catalog.");
  if (command === "pages") return { version, experimental: true, vault, worktreesEnabled: config.worktreesEnabled === true, pages: summarizeWorkPages(config, vault) };
  const page = pageId ? summarizeWorkPages(config, vault).find((p) => p.id === pageId) : void 0;
  if (pageId && !page) throw new Error("Work page is missing or ambiguous");
  const summary2 = summarizeCliCatalog(config, command === "status");
  let runtime = {};
  if (command === "status") {
    const directory2 = path33.join(path33.dirname(location), "runtime");
    const executions = [];
    let executionLockPresent = false;
    let executionOwner;
    if (fs33.existsSync(directory2)) {
      if (fs33.lstatSync(directory2).isSymbolicLink() || !fs33.statSync(directory2).isDirectory()) throw new Error("Invalid runtime directory");
      executionLockPresent = fs33.existsSync(path33.join(directory2, "execution.lock"));
      if (executionLockPresent) {
        try {
          executionOwner = readExecutionLeaseOwner(directory2);
        } catch {
        }
      }
      for (const file of fs33.readdirSync(directory2).sort()) {
        if (!/^[a-f0-9-]+\.json$/.test(file)) continue;
        const state = readExecutionCheckpoint(directory2, file.slice(0, -5));
        if (pageId && !state.workflowId.startsWith("@page:" + pageId + ":")) continue;
        executions.push({
          runId: state.runId,
          workflowId: state.workflowId,
          phase: state.phase,
          revision: state.revision,
          nextStepId: state.nextStepId,
          completedSteps: state.steps.filter((step) => step.status === "completed").length,
          failedSteps: state.steps.filter((step) => step.status === "failed").length,
          requiresReconciliation: state.phase !== "abandoned" && !state.disposition && (state.phase === "in_flight" || checkpointUncertainties(state).length > 0),
          abandonment: state.abandonment,
          disposition: state.disposition,
          ...state.phase === "in_flight" && state.steps.slice(-1)[0]?.approval ? { pendingApproval: state.steps.slice(-1)[0].approval } : {}
        });
      }
    }
    runtime = { executions, executionLockPresent, ...executionOwner ? { executionOwner } : {} };
  }
  return { version, experimental: true, vault, activityVerified: false, ...page ? { page } : summary2, ...runtime };
}
main(process.argv.slice(2)).then((result) => {
  process.stdout.write(JSON.stringify(result) + "\n");
}).catch((error) => {
  const message = error instanceof Error && !error.code ? error.message : "Cannot read the selected AutoOC installation.";
  const code = error?.code;
  process.stderr.write(JSON.stringify({ error: message, ...error instanceof PluginRequestError ? { requestId: error.requestId, runId: error.runId, state: error.state, nextAction: "inspect-request or follow; do not launch again" } : {}, ...typeof code === "string" && /^[A-Z][A-Z0-9_]+$/.test(code) ? { errorCode: code } : {} }) + "\n");
  process.exitCode = 1;
});
