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
var fs23 = __toESM(require("fs"));
var path21 = __toESM(require("path"));

// execution-journal.ts
var fs3 = __toESM(require("fs"));
var path3 = __toESM(require("path"));
var import_crypto3 = require("crypto");

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
  const relative5 = path.relative(physicalPath(root), physicalPath(location));
  return relative5 !== ".." && !relative5.startsWith(".." + path.sep) && !path.isAbsolute(relative5);
}

// execution-journal.ts
var import_util2 = require("util");

// settings-writer.ts
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));
var import_crypto2 = require("crypto");
var import_string_decoder = require("string_decoder");
var import_perf_hooks2 = require("perf_hooks");
var import_timers2 = require("timers");

// cooperative-json.ts
var import_crypto = require("crypto");
var import_timers = require("timers");
var import_perf_hooks = require("perf_hooks");
var import_util = require("util");
var CHUNK = 16 * 1024;
var invalid = () => new SyntaxError("Cannot read valid AutoOC configuration");
async function run(work) {
  let deadline = import_perf_hooks.performance.now() + 4;
  for (; ; ) {
    const next = work.next();
    if (next.done) return next.value;
    if (import_perf_hooks.performance.now() >= deadline) {
      await new Promise((resolve7) => (0, import_timers.setImmediate)(resolve7));
      deadline = import_perf_hooks.performance.now() + 4;
    }
  }
}
async function parseCooperatively(text) {
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
    while (offset < text.length && /[\x20\t\r\n]/.test(text[offset])) {
      offset++;
      yield* step();
    }
  }
  function* string() {
    if (text[offset++] !== '"') throw invalid();
    const start = offset, boundaries = [];
    let chunkStart = start;
    while (offset < text.length) {
      const char = text.charCodeAt(offset++);
      if (char === 34) {
        const end = offset - 1, length = end - start;
        const encoded = length >= CHUNK && length <= 4 * 1024 * 1024 ? text.slice(start, end) : void 0;
        const previous = encoded === void 0 ? void 0 : strings.get(encoded);
        if (previous !== void 0) return previous;
        const pieces = [];
        chunkStart = start;
        for (const boundary of boundaries) {
          pieces.push(decode(text.slice(chunkStart, boundary)));
          chunkStart = boundary;
          yield;
        }
        pieces.push(decode(text.slice(chunkStart, end)));
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
        if (text[offset] === "u") offset += 5;
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
    const char = text[offset];
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
    while (offset < text.length && !/[\x20\t\r\n,\]}]/.test(text[offset])) {
      offset++;
      yield* step();
    }
    if (offset === start) throw invalid();
    accept(JSON.parse(text.slice(start, offset)));
  }
  try {
    return await run(function* () {
      yield* value();
      while (stack.length) {
        yield* step();
        yield* whitespace();
        const frame = stack[stack.length - 1], end = frame.array ? "]" : "}";
        if (frame.state === "first" && text[offset] === end) {
          offset++;
          stack.pop();
          continue;
        }
        if (frame.state === "separator") {
          const separator = text[offset++];
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
          if (text[offset++] !== ":") throw invalid();
          frame.state = "value";
          continue;
        }
        yield* value();
      }
      yield* whitespace();
      if (offset !== text.length) throw invalid();
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
  const source = encodeCapturedJson(captureJsonStructure(value)), hash = (0, import_crypto.createHash)("sha256");
  await consume(source, (part) => {
    hash.update(part, "utf8");
  });
  return hash.digest("hex");
}
async function hashTextCooperatively(text) {
  const hash = (0, import_crypto.createHash)("sha256");
  await consume(function* () {
    for (let start = 0; start < text.length; ) {
      let end = Math.min(start + CHUNK, text.length);
      if (end < text.length && text.charCodeAt(end - 1) >= 55296 && text.charCodeAt(end - 1) <= 56319 && text.charCodeAt(end) >= 56320 && text.charCodeAt(end) <= 57343) end--;
      yield text.slice(start, end);
      start = end;
    }
  }(), (part) => {
    hash.update(part, "utf8");
  });
  return hash.digest("hex");
}

// settings-writer.ts
function settingsDirectoryIdentity(directory) {
  const stat = fs2.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Unsafe settings directory");
  return `${stat.dev}:${stat.ino}:${stat.birthtimeMs}`;
}
function regularIntentText(file) {
  const stat = fs2.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 16384) throw new Error("Unsafe settings write intent");
  return fs2.readFileSync(file, "utf8");
}
async function beginSettingsWriteIntent(file, token, originalHash) {
  if (path2.basename(file) !== "data.json") return;
  const directory = path2.dirname(file), runtime = path2.join(directory, "runtime"), ownerFile = path2.join(runtime, "execution.lock", "owner.json");
  let ownerText;
  try {
    ownerText = regularIntentText(ownerFile);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  const owner = JSON.parse(ownerText);
  const ownerDirectoryIdentity = settingsDirectoryIdentity(path2.dirname(ownerFile));
  let ownerStat = fs2.lstatSync(ownerFile);
  if (owner?.schemaVersion !== 1 || owner.pid !== process.pid || !/^[a-f0-9-]{36}$/.test(owner.token || "") || !Number.isFinite(Date.parse(owner.createdAt))) throw new Error("Settings writer does not own the execution lease");
  const leaseOwner = { schemaVersion: 1, token: owner.token, pid: owner.pid, createdAt: owner.createdAt };
  const intent = { schemaVersion: 1, token, directoryIdentity: settingsDirectoryIdentity(directory), runtimeIdentity: settingsDirectoryIdentity(runtime), owner: leaseOwner, originalHash };
  const intentFile = file + ".write-intent", updateFile = intentFile + "." + token + ".tmp";
  let published;
  const assertOwned = () => {
    const currentOwnerStat = fs2.lstatSync(ownerFile);
    if (currentOwnerStat.dev !== ownerStat.dev || currentOwnerStat.ino !== ownerStat.ino || currentOwnerStat.size !== ownerStat.size || currentOwnerStat.mtimeMs !== ownerStat.mtimeMs || currentOwnerStat.ctimeMs !== ownerStat.ctimeMs || settingsDirectoryIdentity(path2.dirname(ownerFile)) !== ownerDirectoryIdentity || regularIntentText(ownerFile) !== ownerText || fs2.readFileSync(file + ".write-lock", "utf8") !== token || settingsDirectoryIdentity(directory) !== intent.directoryIdentity || settingsDirectoryIdentity(runtime) !== intent.runtimeIdentity) throw new Error("Settings intent ownership changed");
    if (published !== void 0 && regularIntentText(intentFile) !== published) throw new Error("Settings write intent changed");
  };
  const replaceMetadata = async (from, to) => {
    for (let attempt = 0; ; attempt++) {
      assertOwned();
      try {
        await fs2.promises.rename(from, to);
        return;
      } catch (error) {
        if (process.platform !== "win32" || !["EPERM", "EBUSY", "EACCES"].includes(error.code || "") || attempt >= 4) throw error;
        await new Promise((resolve7) => setTimeout(resolve7, 50 * (attempt + 1)));
      }
    }
  };
  const publishOwnerAnchor = async (hash) => {
    assertOwned();
    const next = JSON.parse(ownerText);
    if (hash) next.settingsWriteIntent = { token, sha256: hash };
    else delete next.settingsWriteIntent;
    const nextText = JSON.stringify(next), temporary = path2.join(path2.dirname(ownerFile), "owner.settings-intent." + token + ".tmp");
    const handle = await fs2.promises.open(temporary, "wx", 384);
    try {
      await handle.writeFile(nextText, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    assertOwned();
    await replaceMetadata(temporary, ownerFile);
    ownerText = nextText;
    ownerStat = fs2.lstatSync(ownerFile);
  };
  const publish = async (initial = false) => {
    assertOwned();
    const text = JSON.stringify(intent), target = initial ? intentFile : updateFile;
    const handle = await fs2.promises.open(target, "wx", 384);
    try {
      await handle.writeFile(text, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    assertOwned();
    if (!initial) await replaceMetadata(updateFile, intentFile);
    published = text;
    await publishOwnerAnchor((0, import_crypto2.createHash)("sha256").update(text, "utf8").digest("hex"));
  };
  await publish(true);
  return {
    async prepared(temporary, preparedHash) {
      intent.temporary = path2.basename(temporary);
      if (preparedHash) intent.preparedHash = preparedHash;
      await publish();
    },
    async finish() {
      assertOwned();
      const current = await settingsFingerprint(file);
      if (current !== intent.originalHash && current !== intent.preparedHash || fs2.existsSync(updateFile) || intent.temporary && fs2.existsSync(path2.join(directory, intent.temporary))) throw new Error("Settings write evidence retained for recovery");
      assertOwned();
      await publishOwnerAnchor();
      await fs2.promises.unlink(intentFile);
    }
  };
}
var SettingsWriter = class _SettingsWriter {
  constructor() {
    this.tail = Promise.resolve();
    this.observed = /* @__PURE__ */ new Map();
    this.cached = /* @__PURE__ */ new Map();
    this.pending = 0;
  }
  async drain() {
    await this.tail;
    if (this.writeFailure) throw this.writeFailure;
  }
  get hasPendingWrites() {
    return this.pending > 0;
  }
  fork() {
    const fork = new _SettingsWriter();
    for (const [file, version2] of this.observed) fork.observed.set(file, { ...version2 });
    for (const [file, value] of this.cached) fork.cached.set(file, cloneJsonStructure(value));
    return fork;
  }
  confirmedVersion(file) {
    const version2 = this.observed.get(path2.resolve(file));
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
      this.observed.set(path2.resolve(file), { ...version2 });
      this.cached.delete(path2.resolve(file));
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
    const observed = this.observed.get(path2.resolve(file));
    if (!observed || await settingsFingerprint(file) !== observed.textHash) {
      throw new Error("AutoOC configuration changed during preflight; reload before execution");
    }
  }
  // Read exactly the version against which subsequent writes are compared.
  // A missing file is distinct from an existing empty/null configuration.
  load(file) {
    const text = readSettingsText(file);
    const value = parseSettings(text);
    const hash = (source) => (0, import_crypto2.createHash)("sha256").update(source, "utf8").digest("hex");
    this.observed.set(path2.resolve(file), {
      textHash: text === null ? null : hash(text),
      valueHash: text === null ? null : hash(JSON.stringify(value, null, 2))
    });
    this.cached.set(path2.resolve(file), cloneJsonStructure(value));
    return value;
  }
  // Share the write queue: a late load cannot change the baseline of an
  // in-flight save. The caller may reject publication after a local edit.
  loadAsync(file, accept = () => true) {
    this.pending++;
    const operation = this.tail.then(async () => {
      file = path2.resolve(file);
      const observed = this.observed.get(file);
      if (observed && this.cached.has(file) && await settingsFingerprint(file) === observed.textHash) {
        if (!accept()) throw new Error("AutoOC settings changed while loading; reload before saving");
        return cloneJsonStructure(this.cached.get(file));
      }
      let text = await readSettingsTextAsync(file);
      const value = text === null ? null : await parseCooperatively(text);
      const missing = text === null, textHash = missing ? null : await hashTextCooperatively(text);
      text = null;
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
  save(file, snapshot, validate) {
    this.pending++;
    const operation = this.tail.then(async () => {
      file = path2.resolve(file);
      await fs2.promises.mkdir(path2.dirname(file), { recursive: true });
      const lock = file + ".write-lock";
      const token = (0, import_crypto2.randomUUID)();
      const descriptor = fs2.openSync(lock, "wx", 384);
      let intent;
      try {
        fs2.writeFileSync(descriptor, token);
        await new Promise((resolve7, reject) => fs2.fsync(descriptor, (error) => error ? reject(error) : resolve7()));
      } finally {
        fs2.closeSync(descriptor);
      }
      try {
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
        if (fs2.lstatSync(lock).isSymbolicLink() || fs2.readFileSync(lock, "utf8") !== token) {
          throw new Error("Settings write lock ownership changed");
        }
        if (await settingsFingerprint(file) !== currentHash) {
          throw new Error("AutoOC configuration changed during preparation; reload before saving");
        }
        const nextHash = await atomicSettingsTextWrite(file, encodeCapturedJson(captured), fs2.promises, async () => {
          validate?.();
          if (await settingsFingerprint(file) !== currentHash) {
            throw new Error("AutoOC configuration changed during replacement; reload before saving");
          }
          if (fs2.lstatSync(lock).isSymbolicLink() || fs2.readFileSync(lock, "utf8") !== token) {
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
          if (fs2.lstatSync(lock).isSymbolicLink() || fs2.readFileSync(lock, "utf8") !== token) {
            throw new Error("Settings write lock ownership changed");
          }
          fs2.unlinkSync(lock);
        }
      }
    });
    const tracked = operation.finally(() => {
      this.pending--;
    });
    this.tail = tracked.catch((error) => {
      this.writeFailure = error;
    });
    return tracked;
  }
};
function ioBudget() {
  let started = import_perf_hooks2.performance.now();
  return () => {
    if (import_perf_hooks2.performance.now() - started < 4) return;
    return new Promise((resolve7) => (0, import_timers2.setImmediate)(() => {
      started = import_perf_hooks2.performance.now();
      resolve7();
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
    const stat = await fs2.promises.lstat(file);
    inspected = true;
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Configuration must be a regular file");
    handle = await fs2.promises.open(file, "r");
    const opened = await handle.stat();
    if (!sameSettingsFile(stat, opened)) throw new Error("Configuration identity changed while reading");
    const buffer = Buffer.allocUnsafe(256 * 1024), hash = (0, import_crypto2.createHash)("sha256"), budget = ioBudget();
    let total = 0;
    for (; ; ) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (!bytesRead) {
        const after = await handle.stat();
        const current = await fs2.promises.lstat(file);
        if (total !== opened.size || !sameSettingsFile(opened, after) || current.isSymbolicLink() || !sameSettingsFile(opened, current)) throw new Error("Configuration changed while reading");
        return hash.digest("hex");
      }
      total += bytesRead;
      if (total > opened.size) throw new Error("Configuration changed while reading");
      hash.update(buffer.subarray(0, bytesRead));
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
    const stat = await fs2.promises.lstat(file);
    inspected = true;
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Configuration must be a regular file");
    const handle = await fs2.promises.open(file, "r");
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
      const afterRead = await fs2.promises.lstat(file);
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
        await new Promise((resolve7) => (0, import_timers2.setImmediate)(resolve7));
      }
      if (ascii) {
        const final2 = await handle.stat();
        const current2 = await fs2.promises.lstat(file);
        if (!sameSettingsFile(opened, final2) || current2.isSymbolicLink() || !sameSettingsFile(opened, current2)) throw new Error("Configuration changed while reading");
        return bytes.toString("utf8");
      }
      const decoder = new import_string_decoder.StringDecoder("utf8"), parts = [];
      for (let offset = 0; offset < bytes.length; offset += 256 * 1024) {
        parts.push(decoder.write(bytes.subarray(offset, offset + 256 * 1024)));
        await new Promise((resolve7) => (0, import_timers2.setImmediate)(resolve7));
      }
      parts.push(decoder.end());
      bytes = void 0;
      const final = await handle.stat();
      const current = await fs2.promises.lstat(file);
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
    const stat = fs2.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Configuration must be a regular file");
    try {
      return fs2.readFileSync(file, "utf8");
    } catch {
      throw new Error("Cannot read valid AutoOC configuration");
    }
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
function parseSettings(text) {
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Cannot read valid AutoOC configuration");
  }
}
async function atomicSettingsWrite(file, data, io = fs2.promises, beforeReplace) {
  const text = JSON.stringify(data, null, 2);
  if (text === void 0) throw new Error("Settings are not serializable");
  await atomicSettingsTextWrite(file, text, io, beforeReplace);
}
async function atomicSettingsTextWrite(file, text, io = fs2.promises, beforeReplace, prepared) {
  const temp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  await io.mkdir(path2.dirname(file), { recursive: true });
  let handle;
  const hash = (0, import_crypto2.createHash)("sha256");
  try {
    await prepared?.(temp);
    handle = await io.open(temp, "wx", 384);
    const parts = typeof text === "string" ? [text] : text;
    let batch = [], size = 0;
    const flush = async () => {
      const part = batch.join("");
      batch = [];
      size = 0;
      hash.update(part, "utf8");
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
    await prepared?.(temp, hash.copy().digest("hex"));
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
        await new Promise((resolve7) => setTimeout(resolve7, 50 * (attempt + 1)));
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
    return hash.digest("hex");
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
function directoryIdentity(directory) {
  const stat = fs3.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Unsafe disposition directory");
  return `${stat.dev}:${stat.ino}:${stat.birthtimeMs}`;
}
function dispositionLocation(location) {
  const vault = physicalPath(location.vault), installationDirectory = physicalPath(location.installationDirectory), runtimeDirectory = physicalPath(location.runtimeDirectory);
  if (path3.relative(installationDirectory, runtimeDirectory) !== "runtime" || path3.relative(vault, installationDirectory).split(path3.sep).includes("..")) throw new Error("Disposition location mismatch");
  let current = vault;
  for (const part of path3.relative(vault, runtimeDirectory).split(path3.sep)) {
    current = path3.join(current, part);
    directoryIdentity(current);
  }
  return { vault, installationDirectory, runtimeDirectory, vaultIdentity: directoryIdentity(vault), installationIdentity: directoryIdentity(installationDirectory), runtimeIdentity: directoryIdentity(runtimeDirectory) };
}
function validateExecutionCheckpoint(value) {
  const validDate = (date) => date === void 0 || typeof date === "string" && Number.isFinite(Date.parse(date));
  if (!value || value.schemaVersion !== 1 || !/^[a-zA-Z0-9-]+$/.test(value.runId || "") || typeof value.workflowId !== "string" || !value.workflowId || !/^[a-f0-9]{64}$/.test(value.definitionHash || "") || !Number.isSafeInteger(value.revision) || value.revision < 0 || !["ready", "in_flight", "completed", "failed", "abandoned"].includes(value.phase) || !(value.nextStepId === null || typeof value.nextStepId === "string" && value.nextStepId.length > 0) || !Array.isArray(value.steps) || !validDate(value.createdAt)) throw new Error("Invalid execution checkpoint");
  for (const [index, step] of value.steps.entries()) {
    if (step?.branch && (typeof step.branch.directory !== "string" || !path3.isAbsolute(step.branch.directory) || typeof step.branch.name !== "string" || !step.branch.name)) throw new Error("Invalid branch checkpoint");
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
    if (!["failed", "completed"].includes(value.phase) || typeof d.at !== "string" || !validDate(d.at) || typeof d.reason !== "string" || !d.reason.trim() || d.reason.length > 1e3 || d.outcome !== "unknown" || d.acknowledgedUnknownEffects !== true || d.previousRevision !== value.revision - 1 || d.snapshot !== `disposition-${value.runId}-${d.previousRevision}.snapshot` || !/^[a-f0-9]{64}$/.test(d.snapshotHash || "") || d.runId !== value.runId || d.workflowId !== value.workflowId || d.definitionHash !== value.definitionHash || !["vault", "installationDirectory", "runtimeDirectory"].every((key) => typeof d[key] === "string" && path3.isAbsolute(d[key])) || !["vaultIdentity", "installationIdentity", "runtimeIdentity"].every((key) => typeof d[key] === "string" && d[key]) || !checkpointUncertainties(value).length || JSON.stringify(d.causes) !== JSON.stringify(checkpointUncertainties(value))) throw new Error("Invalid terminal disposition");
  }
  const abandoned = value.phase === "abandoned", decision = value.abandonment;
  if (abandoned ? !decision || typeof decision.at !== "string" || !validDate(decision.at) || typeof decision.reason !== "string" || !decision.reason.trim() || decision.reason.length > 1e3 || decision.outcome !== "unknown" || decision.acknowledgedUnknownEffects !== true || !["ready", "in_flight"].includes(decision.previousPhase) || typeof decision.previousNextStepId !== "string" || !decision.previousNextStepId || !Number.isSafeInteger(decision.previousRevision) || decision.previousRevision !== value.revision - 1 || decision.snapshot !== `abandonment-${value.runId}-${decision.previousRevision}.snapshot` || decision.previousPhase === "in_flight" !== (last?.status === "in_flight") || decision.previousPhase === "in_flight" && decision.previousNextStepId !== last?.stepId : decision !== void 0) throw new Error("Invalid abandonment decision");
  if (!abandoned && value.phase === "in_flight" !== (last?.status === "in_flight") || value.phase === "in_flight" && value.nextStepId !== last.stepId || ["ready", "in_flight"].includes(value.phase) && value.nextStepId === null || ["completed", "failed", "abandoned"].includes(value.phase) && value.nextStepId !== null)
    throw new Error("Inconsistent execution checkpoint");
}
function readExecutionCheckpoint(directory, runId) {
  if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error("Invalid execution identity");
  const file = path3.join(directory, runId + ".json");
  const stat = fs3.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1) throw new Error("Execution checkpoint must be a regular file");
  let state;
  try {
    state = JSON.parse(fs3.readFileSync(file, "utf8"));
  } catch {
    throw new Error("Cannot read valid execution checkpoint");
  }
  validateExecutionCheckpoint(state);
  if (state.runId !== runId) throw new Error("Execution identity changed");
  if (state.abandonment) {
    const d = state.abandonment, snapshot = path3.join(directory, d.snapshot);
    let prior;
    try {
      const stat2 = fs3.lstatSync(snapshot);
      if (!stat2.isFile() || stat2.isSymbolicLink() || stat2.nlink !== 1) throw new Error("Unsafe abandonment snapshot");
      prior = JSON.parse(fs3.readFileSync(snapshot, "utf8"));
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
    if (physicalPath(directory) !== location.runtimeDirectory || Object.entries(location).some(([key, value]) => d[key] !== value)) throw new Error("Disposition installation identity changed");
    const snapshot = path3.join(directory, d.snapshot), stat2 = fs3.lstatSync(snapshot);
    if (!stat2.isFile() || stat2.isSymbolicLink() || stat2.nlink !== 1) throw new Error("Unsafe disposition snapshot");
    const original = fs3.readFileSync(snapshot);
    if ((0, import_crypto3.createHash)("sha256").update(original).digest("hex") !== d.snapshotHash) throw new Error("Disposition snapshot changed");
    const prior = JSON.parse(original.toString("utf8"));
    validateExecutionCheckpoint(prior);
    const { disposition, ...expected } = state;
    expected.revision--;
    if (JSON.stringify(prior) !== JSON.stringify(expected)) throw new Error("Disposition snapshot does not match checkpoint");
  }
  return state;
}
var ExecutionJournal = class _ExecutionJournal {
  constructor(lease, file, state) {
    this.lease = lease;
    this.file = file;
    this.state = state;
  }
  static async create(lease, workflowId, definitionHash, entryStep) {
    lease.assertOwned();
    const state = { schemaVersion: 1, runId: (0, import_crypto3.randomUUID)(), workflowId, definitionHash, revision: 0, createdAt: (/* @__PURE__ */ new Date()).toISOString(), phase: "ready", nextStepId: entryStep, steps: [] };
    validateExecutionCheckpoint(state);
    const file = path3.join(lease.directory, state.runId + ".json");
    if (fs3.existsSync(file)) throw new Error("Execution identity already exists");
    await atomicSettingsWrite(file, state);
    lease.assertOwned();
    return new _ExecutionJournal(lease, file, state);
  }
  static open(lease, runId, definitionHash) {
    lease.assertOwned();
    if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error("Invalid execution identity");
    const file = path3.join(lease.directory, runId + ".json");
    if (fs3.lstatSync(file).isSymbolicLink()) throw new Error("Execution checkpoint cannot be a link");
    const state = readExecutionCheckpoint(lease.directory, runId);
    if (state.runId !== runId || state.definitionHash !== definitionHash) throw new Error("Execution identity or definition changed");
    return new _ExecutionJournal(lease, file, state);
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
      const identity = dispositionLocation(location);
      if (identity.runtimeDirectory !== physicalPath(this.lease.directory)) throw new Error("Disposition lease identity mismatch");
      const snapshot = `disposition-${state.runId}-${state.revision}.snapshot`, file = path3.join(this.lease.directory, snapshot);
      if (fs3.existsSync(file)) {
        const stat = fs3.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || fs3.readFileSync(file, "utf8") !== original) throw new Error("Disposition snapshot changed");
      } else {
        const fd = fs3.openSync(file, "wx", 384);
        try {
          fs3.writeFileSync(fd, original);
          fs3.fsyncSync(fd);
        } finally {
          fs3.closeSync(fd);
        }
      }
      this.lease.assertOwned();
      state.disposition = {
        ...identity,
        at: (/* @__PURE__ */ new Date()).toISOString(),
        reason: reason.trim(),
        outcome: "unknown",
        acknowledgedUnknownEffects: true,
        previousRevision: state.revision,
        snapshot,
        snapshotHash: (0, import_crypto3.createHash)("sha256").update(original).digest("hex"),
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
      const snapshot = `abandonment-${state.runId}-${state.revision}.snapshot`, file = path3.join(this.lease.directory, snapshot);
      const original = JSON.stringify(state);
      if (fs3.existsSync(file)) {
        const stat = fs3.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || fs3.readFileSync(file, "utf8") !== original) throw new Error("Abandonment snapshot changed");
      } else {
        const fd = fs3.openSync(file, "wx", 384);
        try {
          fs3.writeFileSync(fd, original);
          fs3.fsyncSync(fd);
        } finally {
          fs3.closeSync(fd);
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
      if (fs3.lstatSync(this.file).isSymbolicLink()) throw new Error("Execution checkpoint cannot be a link");
      const previous = fs3.readFileSync(this.file, "utf8");
      if (JSON.stringify(JSON.parse(previous)) !== JSON.stringify(this.state)) throw new Error("Execution checkpoint changed");
      const next = this.snapshot();
      if (next.disposition) throw new Error("Terminal execution already disposed; historical evidence is immutable");
      change(next, previous);
      next.revision++;
      validateExecutionCheckpoint(next);
      await atomicSettingsWrite(this.file, next, fs3.promises, async () => {
        this.lease.assertOwned();
        const stat = fs3.lstatSync(this.file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || fs3.readFileSync(this.file, "utf8") !== previous) throw new Error("Execution checkpoint changed before publication");
        if (next.disposition) {
          const d = next.disposition;
          if (Object.entries(dispositionLocation(d)).some(([key, value]) => d[key] !== value)) throw new Error("Disposition identity changed");
          const snapshot = path3.join(this.lease.directory, d.snapshot), stat2 = fs3.lstatSync(snapshot);
          if (!stat2.isFile() || stat2.isSymbolicLink() || stat2.nlink !== 1 || fs3.readFileSync(snapshot, "utf8") !== previous) throw new Error("Disposition snapshot changed before publication");
        }
      });
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
var fs4 = __toESM(require("fs"));
var path4 = __toESM(require("path"));
function regularDirectory(directory) {
  const stat = fs4.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Installation must use regular directories");
}
function optionalStat(file) {
  try {
    return fs4.lstatSync(file);
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
function resolveInstalledWorkflowLocation(vaultPath, installationDirectory) {
  if (!path4.isAbsolute(vaultPath)) throw new Error("Explicit absolute vault required");
  const vault = physicalPath(vaultPath);
  regularDirectory(vault);
  let relative5 = path4.join(".obsidian", "plugins", "auto-oc");
  if (installationDirectory !== void 0) {
    if (typeof installationDirectory !== "string" || !installationDirectory || installationDirectory.includes("\0") || installationDirectory.split(/[\\/]/).some((part) => part === "." || part === "..")) {
      throw new Error("Invalid installation location");
    }
    if (process.platform === "win32" && path4.isAbsolute(installationDirectory)) {
      let inspected = path4.parse(installationDirectory).root;
      for (const part of installationDirectory.slice(inspected.length).split(/[\\/]/)) {
        if (!part || part.includes(":")) throw new Error("Invalid installation component");
        inspected = path4.join(inspected, part);
        regularDirectory(inspected);
      }
      relative5 = path4.relative(vault, physicalPath(inspected));
    } else {
      relative5 = path4.isAbsolute(installationDirectory) ? path4.relative(path4.resolve(vaultPath), installationDirectory) : installationDirectory;
    }
    if (!relative5 || path4.isAbsolute(relative5) || relative5.split(/[\\/]/).some((part) => part === ".." || part.includes(":"))) {
      throw new Error("Installation must remain inside the vault");
    }
  }
  let directory = vault;
  for (const part of relative5.split(/[\\/]/)) {
    if (!part) throw new Error("Invalid installation component");
    directory = path4.join(directory, part);
    regularDirectory(directory);
  }
  directory = physicalPath(directory);
  if (!isWithinPhysicalPath(vault, directory)) throw new Error("Installation must remain inside the vault");
  const configurationFile = path4.join(directory, "data.json");
  const configStat = optionalStat(configurationFile);
  if (configStat && (configStat.isSymbolicLink() || !configStat.isFile())) throw new Error("Configuration must be a regular file");
  const runtimeDirectory = path4.join(directory, "runtime");
  const runtimeStat = optionalStat(runtimeDirectory);
  if (runtimeStat && (runtimeStat.isSymbolicLink() || !runtimeStat.isDirectory())) throw new Error("Invalid runtime directory");
  return { vault, installationDirectory: directory, configurationFile, runtimeDirectory };
}
function ensureInstalledWorkflowRuntime(location) {
  const current = resolveInstalledWorkflowLocation(location.vault, location.installationDirectory);
  if (current.runtimeDirectory !== location.runtimeDirectory) throw new Error("Installation location changed");
  try {
    fs4.mkdirSync(current.runtimeDirectory);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  regularDirectory(current.runtimeDirectory);
}

// execution-lease.ts
var fs5 = __toESM(require("fs"));
var path5 = __toESM(require("path"));
var import_crypto4 = require("crypto");
function acquireExecutionLease(runtimeDirectory) {
  const root = fs5.realpathSync(runtimeDirectory);
  if (fs5.existsSync(path5.join(root, "update-pending.json"))) throw new Error("Incomplete plugin update requires recovery before execution");
  const recovery = path5.join(root, "lease-recovery.lock");
  if (fs5.existsSync(recovery)) throw new Error("Execution lease recovery is in progress");
  const lock = path5.join(root, "execution.lock");
  const ownerPath = path5.join(lock, "owner.json");
  const token = (0, import_crypto4.randomUUID)();
  fs5.mkdirSync(lock);
  if (fs5.existsSync(recovery)) {
    fs5.rmdirSync(lock);
    throw new Error("Execution lease recovery is in progress");
  }
  try {
    const fd = fs5.openSync(ownerPath, "wx", 384);
    try {
      fs5.writeFileSync(fd, JSON.stringify({ schemaVersion: 1, token, pid: process.pid, createdAt: (/* @__PURE__ */ new Date()).toISOString() }));
      fs5.fsyncSync(fd);
    } finally {
      fs5.closeSync(fd);
    }
  } catch (error) {
    throw error;
  }
  let released = false;
  const assertOwned = () => {
    if (released) throw new Error("Execution lease already released");
    if (fs5.lstatSync(lock).isSymbolicLink() || fs5.realpathSync(lock) !== lock) throw new Error("Execution lease directory changed");
    if (fs5.lstatSync(ownerPath).isSymbolicLink()) throw new Error("Execution lease owner changed");
    const owner = JSON.parse(fs5.readFileSync(ownerPath, "utf8"));
    if (owner.token !== token || owner.pid !== process.pid || owner.schemaVersion !== 1) throw new Error("Execution lease ownership changed");
  };
  return {
    directory: root,
    token,
    assertOwned,
    release() {
      assertOwned();
      fs5.unlinkSync(ownerPath);
      fs5.rmdirSync(lock);
      released = true;
    }
  };
}
function readExecutionLeaseOwner(runtimeDirectory) {
  const root = fs5.realpathSync(runtimeDirectory), lock = path5.join(root, "execution.lock"), file = path5.join(lock, "owner.json");
  if (fs5.lstatSync(lock).isSymbolicLink() || fs5.realpathSync(lock) !== lock || fs5.lstatSync(file).isSymbolicLink()) throw new Error("Invalid execution lease paths");
  let owner;
  try {
    owner = JSON.parse(fs5.readFileSync(file, "utf8"));
  } catch {
    throw new Error("Incomplete execution lease owner; manual reconciliation required");
  }
  if (owner?.schemaVersion !== 1 || !/^[a-f0-9-]{36}$/.test(owner.token || "") || !Number.isSafeInteger(owner.pid) || owner.pid <= 0 || !Number.isFinite(Date.parse(owner.createdAt))) throw new Error("Invalid execution lease owner");
  return { schemaVersion: 1, token: owner.token, pid: owner.pid, createdAt: owner.createdAt };
}
function recoverExecutionLease(runtimeDirectory, expectedToken, assertSafe) {
  const root = fs5.realpathSync(runtimeDirectory), guard = path5.join(root, "lease-recovery.lock");
  fs5.mkdirSync(guard);
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
    if (fs5.existsSync(path5.join(root, archived))) throw new Error("Recovery archive already exists");
    fs5.renameSync(path5.join(root, "execution.lock"), path5.join(root, archived));
    return { recovered: true, archived, executionsResumed: false };
  } finally {
    fs5.rmdirSync(guard);
  }
}

// execution-abandonment.ts
var fs6 = __toESM(require("fs"));
function inspectTerminalExecution(options) {
  const location = resolveInstalledWorkflowLocation(options.vault, options.installationDirectory);
  const identity = dispositionLocation(location), state = readExecutionCheckpoint(location.runtimeDirectory, options.runId);
  return {
    ...identity,
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
      if (fs6.existsSync(location.configurationFile + ".write-lock") || fs6.readdirSync(location.installationDirectory).some((name) => name.startsWith("data.json.") && name.endsWith(".tmp")) || fs6.readdirSync(location.runtimeDirectory).some((name) => name.endsWith(".tmp") || name.endsWith(".write-lock"))) throw new Error("Unfinished write requires reconciliation");
      const config = JSON.parse(fs6.readFileSync(location.configurationFile, "utf8"));
      if (["tasks", "workflows"].some((kind) => !Array.isArray(config[kind]) || config[kind].some((entry) => entry.status === "running" || entry.pendingCodexApproval))) throw new Error("Active execution requires reconciliation");
      for (const name of fs6.readdirSync(location.runtimeDirectory)) {
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

// installed-workflow-host.ts
var fs18 = __toESM(require("fs"));
var path16 = __toESM(require("path"));

// workflow-definition.ts
var import_crypto5 = require("crypto");

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
function effectiveExecutionSettings(settings) {
  return Object.fromEntries(Object.entries(EXECUTION_DEFAULTS).map(([key, value]) => [key, settings[key] === void 0 ? value : settings[key]]));
}

// workflow-definition.ts
var runtimeFields = /* @__PURE__ */ new Set(["status", "lastRun", "output", "createdAt", "currentStep", "lastCodexThreadId", "lastCodexTurnId", "pendingCodexApproval", "runtimeExecution", "legacyExecution"]);
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
  const refs = [...new Set(workflow.steps.filter((s) => s.stepKind === "task" || !s.stepKind && s.taskId).map((s) => s.taskId))];
  const selected = refs.map((id) => {
    const matches = tasks.filter((t) => t.id === id);
    if (!id || matches.length !== 1) throw new Error("Missing or ambiguous referenced task");
    return withoutRuntime(matches[0]);
  });
  return canonical({ workflow: { ...withoutRuntime(workflow), steps: workflow.steps.map((s) => withoutRuntime(s)) }, tasks: selected, settings: effectiveExecutionSettings(settings) });
}
function prepareWorkflowDefinition(workflow, tasks, settings) {
  const payload = definitionPayload(workflow, tasks, settings);
  const digest = (0, import_crypto5.createHash)("sha256");
  for (const part of encodeCapturedJson(captureJsonStructure(payload, 0))) digest.update(part, "utf8");
  const hash = digest.digest("hex");
  return freeze({ ...payload, hash });
}

// code-runtime.ts
var fs7 = __toESM(require("fs"));
var path6 = __toESM(require("path"));
var vm = __toESM(require("vm"));
function executeCode(options) {
  const vaultBase = options.vaultBase;
  const defaultCwd = options.cwd;
  const resolveInVault = (p) => {
    const root = fs7.realpathSync(vaultBase);
    const resolved = path6.resolve(root, p || ".");
    if (resolved !== root && !resolved.startsWith(root + path6.sep)) {
      throw new Error(`Path escapes vault: ${p}`);
    }
    let current = root;
    for (const component of path6.relative(root, resolved).split(path6.sep).filter(Boolean)) {
      current = path6.join(current, component);
      try {
        if (fs7.lstatSync(current).isSymbolicLink()) throw new Error("Linked vault paths are unsupported");
      } catch (error) {
        if (error.code === "ENOENT") break;
        throw error;
      }
    }
    return resolved;
  };
  const readText = (p) => fs7.readFileSync(p, "utf8");
  const writeText = (p, content) => {
    fs7.mkdirSync(path6.dirname(p), { recursive: true });
    fs7.writeFileSync(p, String(content), "utf8");
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
        fs7.mkdirSync(path6.dirname(full), { recursive: true });
        fs7.appendFileSync(full, String(content), "utf8");
        options.onVaultMutation?.({ path: full, operation: "append" });
        return full;
      },
      exists: (p) => fs7.existsSync(resolveInVault(p)),
      list: (p = ".") => fs7.readdirSync(resolveInVault(p))
    };
  }
  if (options.codeAllowFiles) {
    sandbox.files = {
      cwd: defaultCwd,
      resolve: (p) => path6.isAbsolute(p) ? path6.resolve(p) : path6.resolve(defaultCwd, p || "."),
      read: (p) => readText(path6.isAbsolute(p) ? path6.resolve(p) : path6.resolve(defaultCwd, p)),
      write: (p, content) => writeText(path6.isAbsolute(p) ? path6.resolve(p) : path6.resolve(defaultCwd, p), content),
      append: (p, content) => {
        const full = path6.isAbsolute(p) ? path6.resolve(p) : path6.resolve(defaultCwd, p);
        fs7.mkdirSync(path6.dirname(full), { recursive: true });
        fs7.appendFileSync(full, String(content), "utf8");
        return full;
      },
      exists: (p) => fs7.existsSync(path6.isAbsolute(p) ? path6.resolve(p) : path6.resolve(defaultCwd, p)),
      list: (p = ".") => fs7.readdirSync(path6.isAbsolute(p) ? path6.resolve(p) : path6.resolve(defaultCwd, p))
    };
  }
  if (options.codeAllowTerminal) {
    const { execSync } = require("child_process");
    sandbox.terminal = {
      run: (command, options2 = {}) => execSync(String(command), {
        cwd: options2.cwd ? path6.isAbsolute(options2.cwd) ? options2.cwd : path6.resolve(defaultCwd, options2.cwd) : defaultCwd,
        timeout: Math.min(Math.max(options2.timeoutMs || 3e4, 1e3), 6e5),
        encoding: "utf8"
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
  const result = vm.runInNewContext(preamble + "\n" + options.code + "\n;" + outputVar, sandbox, { timeout: 9e5 });
  return String(result == null ? "" : result);
}

// code-task.ts
function executeCodeTask(options) {
  const code = options.code || options.prompt || "";
  if (!code.trim()) throw new Error("Code task not launched: code is empty.");
  return executeCode({ ...options, code, exposePaths: false });
}

// code-vault-mutations.ts
async function runWithVaultMutations(factory, execute) {
  const batch = factory?.();
  let result;
  let failed = false;
  let original;
  try {
    result = execute(batch?.record);
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

// code-workflow-adapter.ts
function createCodeWorkflowAdapter(vaultBase, workingDirectory = vaultBase, vaultMutations) {
  const supports = (task) => task.taskKind === "code";
  return {
    supports,
    async execute(task, _prompt, signal) {
      if (!supports(task)) throw new Error("Unsupported Code task");
      if (signal?.aborted) throw new Error("Code task cancelled before execution");
      if (!(task.code || task.prompt || "").trim()) return { succeeded: false, output: "[AutoOC] Code task not launched: code is empty." };
      let output = "[running code task...]\n";
      try {
        const result = await runWithVaultMutations(vaultMutations, (onVaultMutation) => executeCodeTask({
          ...task,
          vaultBase,
          cwd: task.workingDirectory || workingDirectory,
          onVaultMutation,
          log: (...args) => {
            output += args.map(String).join(" ") + "\n";
          }
        }));
        output += result;
        return { succeeded: true, output };
      } catch (error) {
        return { succeeded: false, output: output + `[code error: ${String(error)}]` };
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
var import_child_process = require("child_process");
var import_string_decoder2 = require("string_decoder");
var fs8 = __toESM(require("fs"));
var os = __toESM(require("os"));
var path7 = __toESM(require("path"));
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
    return new Promise((resolve7, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex RPC request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve7, reject, timer });
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
function resolveCodexBin(configured = "codex") {
  if (configured.trim() && configured.trim() !== "codex") return configured.trim();
  const candidates = [];
  if (os.platform() === "win32") {
    const localAppData = process.env.LOCALAPPDATA || "";
    const desktopBinRoot = path7.join(localAppData, "OpenAI", "Codex", "bin");
    try {
      const versionDirs = fs8.readdirSync(desktopBinRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path7.join(desktopBinRoot, entry.name, "codex.exe")).filter((candidate) => fs8.existsSync(candidate)).sort((a, b) => fs8.statSync(b).mtimeMs - fs8.statSync(a).mtimeMs);
      candidates.push(...versionDirs);
    } catch {
    }
    candidates.push(
      path7.join(localAppData, "OpenAI", "Codex", "codex.exe"),
      path7.join(process.env.APPDATA || "", "npm", "codex.cmd")
    );
  } else {
    const userHome = process.env.HOME || "";
    candidates.push(
      path7.join(userHome, ".local", "bin", "codex"),
      path7.join(userHome, ".npm-global", "bin", "codex"),
      "/opt/homebrew/bin/codex",
      "/usr/local/bin/codex"
    );
  }
  return candidates.find((candidate) => candidate && fs8.existsSync(candidate)) || configured || "codex";
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
  return new Promise((resolve7, reject) => {
    const child = (0, import_child_process.spawn)(launcher.bin, launcher.args, {
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
      if (code === 0) resolve7();
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
    this.child = (0, import_child_process.spawn)(this.bin, ["app-server"], {
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
  async run(prompt, model, effort, approvalPolicy = "on-request") {
    await this.initialize();
    this.output = "";
    this.agentMessages.clear();
    this.turnId = "";
    const threadResponse = await this.peer.request("thread/start", {
      cwd: this.cwd,
      model: model || null,
      approvalPolicy,
      sandbox: "workspace-write",
      ephemeral: false,
      serviceName: "AutoOC"
    });
    this.threadId = threadResponse?.thread?.id || "";
    if (!this.threadId) throw new Error("Codex did not return a thread id");
    await this.callbacks.onThreadCreated?.({ threadId: this.threadId });
    const completion = new Promise((resolve7, reject) => {
      this.completionResolve = resolve7;
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
  resolveApproval(requestId, approved) {
    const approval = this.approvals.get(requestId);
    if (!approval || !this.peer) return false;
    this.approvals.delete(requestId);
    if (approval.kind === "permissions") {
      this.peer.respond(requestId, {
        permissions: approved ? approval.params.permissions || {} : {},
        scope: "turn"
      });
    } else {
      this.peer.respond(requestId, { decision: approved ? "accept" : "decline" });
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
    const summary = String(params.reason || params.command || (kind === "command" ? "Codex wants to run a command" : kind === "file-change" ? "Codex wants to change files" : "Codex requests additional permissions"));
    return { requestId: message.id, method, kind, summary, params };
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
var fs9 = __toESM(require("fs"));
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
  const directory = (task) => {
    const cwd = fs9.realpathSync(task.workingDirectory || definition.settings.workingDirectory || vaultBase);
    if (!fs9.statSync(cwd).isDirectory()) throw new Error("Codex working directory is unavailable");
    return cwd;
  };
  const create = (task, callbacks) => {
    const bin = resolveCodexBin(definition.settings.codexPath);
    const client = new CodexAppServerClient(bin, directory(task), {
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
var fs12 = __toESM(require("fs"));
var path10 = __toESM(require("path"));

// copilot-client.ts
var import_child_process2 = require("child_process");
var fs10 = __toESM(require("fs"));
var os2 = __toESM(require("os"));
var path8 = __toESM(require("path"));
function resolveCopilotBin(configured = "copilot") {
  const value = configured.trim() || "copilot";
  const nativeFromShim = (shim) => {
    const npmRoot = path8.join(path8.dirname(shim), "node_modules", "@github");
    const packageName = `copilot-${process.platform}-${process.arch}`;
    const executable = process.platform === "win32" ? "copilot.exe" : "copilot";
    return [
      path8.join(npmRoot, "copilot", "node_modules", "@github", packageName, executable),
      path8.join(npmRoot, packageName, executable)
    ].find((candidate) => fs10.existsSync(candidate));
  };
  if (value !== "copilot") {
    return /\.(cmd|bat|ps1)$/i.test(value) ? nativeFromShim(value) || value : value;
  }
  const home = os2.homedir();
  const dirs = [
    ...(process.env.PATH || "").split(path8.delimiter),
    path8.join(home, ".local", "bin"),
    path8.join(home, ".npm-global", "bin"),
    ...process.platform === "win32" ? [path8.join(process.env.APPDATA || path8.join(home, "AppData", "Roaming"), "npm")] : ["/opt/homebrew/bin", "/usr/local/bin"]
  ];
  for (const dir of dirs.filter(Boolean)) {
    for (const extension of process.platform === "win32" ? [".exe", ".cmd", ".ps1"] : [""]) {
      const candidate = path8.join(dir.replace(/^"|"$/g, ""), `copilot${extension}`);
      if (fs10.existsSync(candidate)) return nativeFromShim(candidate) || candidate;
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
    return new Promise((resolve7) => {
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
            fs10.unlinkSync(path8.join(promptDir, "task.txt"));
            fs10.rmdirSync(promptDir);
          } catch {
          }
        }
        resolve7(result);
      };
      this.finish = finish;
      try {
        let args;
        if (prompt.length > 12e3) {
          promptDir = fs10.mkdtempSync(path8.join(os2.tmpdir(), "autooc-copilot-"));
          const promptFile = path8.join(promptDir, "task.txt");
          fs10.writeFileSync(promptFile, prompt, { encoding: "utf8", mode: 384 });
          args = buildCopilotArgs(`Read the UTF-8 file ${JSON.stringify(promptFile)} and carry out the complete task instructions it contains.`, options);
          args.push("--add-dir", promptDir);
        } else {
          args = buildCopilotArgs(prompt, options);
        }
        this.child = (0, import_child_process2.spawn)(this.bin, args, {
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
      const killer = (0, import_child_process2.spawn)("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
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

// cli-launchers.ts
var fs11 = __toESM(require("fs"));
var path9 = __toESM(require("path"));
var os3 = __toESM(require("os"));
var crypto = __toESM(require("crypto"));
var import_child_process3 = require("child_process");
function resolveOpencodeBin(configured) {
  if (configured && configured !== "opencode") return configured;
  const candidates = [];
  if (os3.platform() === "win32") {
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
  const { accessSync, constants } = require("fs");
  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
    }
  }
  return configured || "opencode";
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
    const launcher = (0, import_child_process3.spawn)(
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
    const launcher = (0, import_child_process3.spawn)("osascript", ["-e", script], { detached: true, stdio: "ignore" });
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
    const launcher = (0, import_child_process3.spawn)(terminal.cmd, [...terminal.args, "sh", "-lc", command], { detached: true, stdio: "ignore" });
    launcher.on?.("error", (error) => options.onError?.(error));
    launcher.on?.("spawn", () => options.onLaunched?.());
    launcher.unref();
    return;
  }
}
function openOpencodeCliLongPromptWindows(bin, cwd, env, model, agent, prompt, options = {}) {
  const attempt = crypto.randomBytes(16).toString("hex");
  const directory = fs11.mkdtempSync(path9.join(path9.resolve(cwd), ".autooc-interactive-"));
  const promptFile = path9.join(directory, "prompt.txt");
  const stateFile = path9.join(directory, "state.json");
  const ignoreFile = path9.join(directory, ".gitignore");
  const cleanup = () => {
    for (const file of [promptFile, stateFile, ignoreFile]) {
      try {
        fs11.unlinkSync(file);
      } catch (error) {
        if (error.code !== "ENOENT") console.warn("AutoOC: interactive cleanup pending", file);
      }
    }
    try {
      fs11.rmdirSync(directory);
    } catch {
    }
  };
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
    fs11.writeFileSync(ignoreFile, "*\n", { encoding: "utf8", flag: "wx" });
    fs11.writeFileSync(promptFile, prompt, { encoding: "utf8", flag: "wx" });
    const instruction = `Read the full task prompt from ${path9.basename(directory)}/prompt.txt and follow it exactly.`;
    const runner = [
      "$ErrorActionPreference = 'Stop'",
      `Set-Location -LiteralPath ${psSingleQuoted(path9.resolve(cwd))}`,
      "try {",
      `  $target = Get-Command -Name ${psSingleQuoted(bin)} -CommandType Application -ErrorAction Stop | Select-Object -First 1`,
      `  $cliArgs = @('-m', ${psSingleQuoted(model)}${agent ? `, '--agent', ${psSingleQuoted(agent)}` : ""}, '--prompt', ${psSingleQuoted(instruction)})`,
      "  & $target.Source @cliArgs",
      "  exit $LASTEXITCODE",
      "} catch { Write-Error 'AutoOC: interactive CLI invocation failed' -ErrorAction Continue; exit 1 }",
      "finally {",
      `  Remove-Item -LiteralPath ${psSingleQuoted(promptFile)} -ErrorAction SilentlyContinue`,
      // The standalone Node host exits after startup confirmation. Windows may
      // then stop its hidden observer, so the visible runner must own cleanup
      // when that host is gone. Delete only this attempt's known files; never
      // recursively delete a directory that could contain unrelated files.
      `  if (-not (Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue)) {`,
      `    Remove-Item -LiteralPath ${psSingleQuoted(stateFile)}, ${psSingleQuoted(ignoreFile)} -ErrorAction SilentlyContinue`,
      `    try { [System.IO.Directory]::Delete(${psSingleQuoted(directory)}, $false) } catch { }`,
      "  }",
      "}"
    ].join("\n");
    const encodedRunner = Buffer.from(runner, "utf16le").toString("base64");
    const observer = [
      "$ErrorActionPreference = 'Stop'",
      "$session = $null; $confirmed = $false",
      `function Report($status, $ended) { @{ attempt = ${psSingleQuoted(attempt)}; status = $status; ended = $ended; confirmed = $confirmed } | ConvertTo-Json -Compress | Set-Content -LiteralPath ${psSingleQuoted(stateFile)} -Encoding UTF8 }`,
      "try {",
      `  $session = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList @('-NoLogo', '-NoProfile', '-EncodedCommand', '${encodedRunner}') -WorkingDirectory ${psSingleQuoted(path9.resolve(cwd))} -PassThru`,
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
      "}"
    ].join("\n");
    const encodedObserver = Buffer.from(observer, "utf16le").toString("base64");
    if (encodedObserver.length > 3e4 || encodedRunner.length > 3e4) throw new Error("Interactive launcher configuration exceeds Windows command-line limit");
    const readState = () => {
      let state;
      try {
        state = JSON.parse(fs11.readFileSync(stateFile, "utf8").replace(/^\uFEFF/, ""));
      } catch {
        return;
      }
      if (state.attempt !== attempt) return;
      if (state.status === "error") finish(new Error("Interactive CLI launcher failed; check the session and Windows process inspection availability"));
      else if (state.confirmed === true && (state.status === "started" || state.status === "ended")) finish();
      else if (state.status === "ended") finish(new Error("Interactive CLI exited without confirmed startup"));
      if (state.ended === true && (state.status === "ended" || state.status === "error")) {
        stopPolling();
        cleanup();
      }
    };
    poll = setInterval(readState, 100);
    timeout = setTimeout(() => finish(new Error("Interactive CLI startup was not confirmed within 30 seconds; prompt retained until session exit")), 3e4);
    const launcher = (0, import_child_process3.spawn)("powershell.exe", ["-NoLogo", "-NoProfile", "-EncodedCommand", encodedObserver], {
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
      finish(new Error("Interactive CLI observer exited without startup confirmation; prompt retained"));
    });
    launcher.unref();
  } catch (error) {
    stopPolling();
    cleanup();
    finish(error instanceof Error ? error : new Error(String(error)));
  }
}
function launchHiddenPS(psScriptFile, pidFile) {
  const fs24 = require("fs");
  const launcherFile = psScriptFile.replace(/\.ps1$/, ".vbs");
  const effectivePidFile = pidFile || psScriptFile.replace(/\.ps1$/, ".pid");
  const quotedPsScriptFile = psScriptFile.replace(/"/g, '""');
  const launcherScript = `Set sh = CreateObject("WScript.Shell")\r
sh.Run "powershell.exe -NoLogo -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File ""${quotedPsScriptFile}""", 0, False\r
`;
  fs24.writeFileSync(launcherFile, launcherScript, "utf8");
  const { spawn: spawn4 } = require("child_process");
  const child = spawn4("wscript.exe", [launcherFile], { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
  const launcherTimer = setTimeout(() => {
    try {
      fs24.unlinkSync(launcherFile);
    } catch {
    }
  }, 1e4);
  const scriptTimer = setTimeout(() => {
    try {
      fs24.unlinkSync(psScriptFile);
    } catch {
    }
  }, 6e5);
  const cleanup = (removeScript = false) => {
    clearTimeout(launcherTimer);
    clearTimeout(scriptTimer);
    try {
      fs24.unlinkSync(launcherFile);
    } catch {
    }
    if (removeScript) {
      try {
        fs24.unlinkSync(psScriptFile);
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
      const pid = fs24.existsSync(effectivePidFile) ? String(fs24.readFileSync(effectivePidFile, "utf8")).trim() : "";
      if (/^\d+$/.test(pid) && pid !== String(child.pid || "")) {
        const killer = spawn4("taskkill.exe", ["/PID", pid, "/T", "/F"], { detached: true, stdio: "ignore", windowsHide: true });
        killer.unref();
      }
    } catch {
    }
    cleanup(true);
    try {
      fs24.unlinkSync(effectivePidFile);
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
  const fs24 = require("fs");
  const { spawn: spawn4 } = require("child_process");
  const effectivePidFile = pidFile || shScriptFile.replace(/\.sh$/, ".pid");
  try {
    fs24.chmodSync(shScriptFile, 448);
  } catch {
  }
  const child = spawn4("/bin/sh", [shScriptFile], { detached: true, stdio: "ignore" });
  child.unref();
  const scriptTimer = setTimeout(() => {
    try {
      fs24.unlinkSync(shScriptFile);
    } catch {
    }
  }, 6e5);
  const cleanup = (removeScript = false) => {
    clearTimeout(scriptTimer);
    if (removeScript) {
      try {
        fs24.unlinkSync(shScriptFile);
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
      const pid = fs24.existsSync(effectivePidFile) ? String(fs24.readFileSync(effectivePidFile, "utf8")).trim() : "";
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
      fs24.unlinkSync(effectivePidFile);
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
  fs11.writeFileSync(filePath, Buffer.concat([Buffer.from([239, 187, 191]), Buffer.from(content, "utf8")]));
}
function psUtf8Prelude() {
  return [
    `$utf8NoBom = New-Object System.Text.UTF8Encoding($false)`,
    `[Console]::OutputEncoding = $utf8NoBom`,
    `$OutputEncoding = $utf8NoBom`
  ];
}

// opencode-script.ts
function buildOpenCodeScript(options) {
  const { pidFile, secretEnv, safeCwd, gitCmds, bin, model, effectiveAgent, effectiveTask, promptFile, outFile, errFile, doneFile, taskCwd } = options;
  let launchScript;
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
      `$opencodeArgs += @('run', '--print-logs', '--log-level', 'INFO', '--auto', '-m', $model)`,
      `if (-not $forceModel) {`,
      `$opencodeArgs += @('--agent', $agent)`,
      `}`,
      `$opencodeArgs += @('--dangerously-skip-permissions', '--', $prompt)`,
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
    const agentArg = effectiveTask.forceModel ? "" : ` --agent ${shSingleQuoted(effectiveAgent)}`;
    launchScript = [
      `echo $$ > ${shSingleQuoted(pidFile)}`,
      ...buildShEnvLines(shEnv),
      `cd ${shSingleQuoted(taskCwd)} || { printf '%s' '-1' > ${shSingleQuoted(doneFile)}; printf '%s' 'cd failed' > ${shSingleQuoted(errFile)}; exit 1; }`,
      gitCmds ? gitCmds : "",
      `bin=${shSingleQuoted(bin)}`,
      `prompt="$(cat ${shSingleQuoted(promptFile)} 2>/dev/null)"`,
      `set -- --print-logs --log-level INFO --auto -m ${shSingleQuoted(model)}${agentArg} --dangerously-skip-permissions -- "$prompt"`,
      `"$bin" run "$@" >> ${shSingleQuoted(outFile)} 2>> ${shSingleQuoted(errFile)}`,
      `exit_code=$?`,
      `printf '%s' "$exit_code" > ${shSingleQuoted(doneFile)}`
    ].filter((line) => line !== "").join("\n");
  }
  return launchScript;
}

// command-output.ts
function normalizeCommandOutput(text) {
  if (!text) return "";
  const cleaned = text.replace(/\x1B\[[0-9;]*[A-Za-z]/g, "");
  return cleaned.trim();
}
function extractTouchedFiles(trace) {
  const files = /* @__PURE__ */ new Set();
  for (const line of trace.split(/\r?\n/)) {
    const match = line.match(/^[←→]\s+(?:Edit|Write|Read)\s+(.+)$/) || line.match(/^Index:\s+(.+)$/);
    if (match?.[1]) files.add(match[1].trim());
  }
  return [...files];
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
function countReplacementChars(text) {
  return (text.match(/�/g) || []).length;
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
function createOpenCodeWorkflowAdapter(definition, vault) {
  const supports = (task) => !task.taskKind || task.taskKind === "opencode";
  return { supports, async execute(task, prompt, signal, _recordThread, interaction) {
    if (!supports(task)) throw new Error("Unsupported OpenCode task");
    if (signal?.aborted) throw new Error("OpenCode cancelled before launch");
    const taskCwd = task.workingDirectory || definition.settings.workingDirectory || vault;
    const model = task.model || definition.settings.defaultModel;
    if (!prompt.trim() || !model?.trim()) return { succeeded: false, output: "[OpenCode requires a nonempty prompt and model]" };
    const bin = resolveOpencodeBin(definition.settings.opencodePath);
    const agent = task.agent || definition.settings.defaultAgent || "build";
    if (task.useRalphLoop) prompt = "/ralph-loop " + prompt;
    if (task.interactiveTerminal) {
      if (path10.isAbsolute(bin) && !fs12.existsSync(bin)) return { succeeded: false, output: "[interactive OpenCode executable is unavailable; nothing was launched]" };
      await new Promise((resolve7, reject) => {
        const options = { onLaunched: resolve7, onError: reject, linuxTerminal: definition.settings.linuxTerminal };
        if (process.platform === "win32") openOpencodeCliLongPromptWindows(bin, taskCwd, {}, model, task.forceModel ? "" : agent, prompt, options);
        else openOpencodeCli(bin, taskCwd, {}, ["-m", model, ...task.forceModel ? [] : ["--agent", agent], "--prompt", prompt], options);
      });
      return { succeeded: true, output: "[opened interactive OpenCode CLI with preloaded prompt; interactive task result is not observed]" };
    }
    const folder = fs12.mkdtempSync(path10.join(taskCwd, ".autooc-runtime-"));
    const outFile = path10.join(folder, "stdout.txt"), errFile = path10.join(folder, "stderr.txt"), doneFile = path10.join(folder, "done.txt");
    const pidFile = path10.join(folder, "process.pid"), promptFile = path10.join(folder, "instruction.txt"), full = path10.join(folder, "input.txt");
    const scriptFile = path10.join(folder, "launch" + scriptExt());
    fs12.writeFileSync(full, prompt, { encoding: "utf8", mode: 384 });
    fs12.writeFileSync(promptFile, `Read the complete task prompt and workflow context from the workspace file at ${full} and follow it exactly.`, { encoding: "utf8", mode: 384 });
    const script = buildOpenCodeScript({ pidFile, secretEnv: {}, safeCwd: taskCwd.replace(/'/g, "''"), gitCmds: "", bin, model, effectiveAgent: agent, effectiveTask: task, promptFile, outFile, errFile, doneFile, taskCwd });
    if (process.platform === "win32") writeUtf8BomFile(scriptFile, script);
    else fs12.writeFileSync(scriptFile, script, { mode: 384 });
    const handle = launchHidden(scriptFile, pidFile);
    let known = false;
    try {
      const result = await new Promise((resolve7, reject) => {
        let ended = false;
        const finish = (error) => {
          if (ended) return;
          ended = true;
          clearInterval(timer);
          signal?.removeEventListener("abort", abort);
          if (error) reject(error);
        };
        const abort = () => {
          handle.kill();
          finish(new Error("OpenCode interrupted; effects require reconciliation"));
        };
        const started = Date.now(), timeout = Number(definition.settings.taskTimeoutSeconds) * 1e3;
        const read2 = (file) => fs12.existsSync(file) ? decodeCommandBuffer(fs12.readFileSync(file)) : "";
        let lastOutput = "", nextOutputAt = 0;
        const timer = setInterval(() => {
          try {
            if (timeout > 0 && Date.now() - started > timeout) {
              abort();
              return;
            }
            const completed = fs12.existsSync(doneFile);
            if (!completed && (!interaction?.onOutput || Date.now() < nextOutputAt)) return;
            const output = formatTaskOutput(read2(outFile), read2(errFile));
            if (output !== lastOutput) {
              lastOutput = output;
              interaction?.onOutput?.(output);
            }
            nextOutputAt = Date.now() + 500;
            if (!completed) return;
            const exit = fs12.readFileSync(doneFile, "utf8").replace(/^\uFEFF/, "").trim();
            if (!/^-?\d+$/.test(exit)) throw new Error("Invalid OpenCode completion marker");
            known = true;
            finish();
            resolve7({ succeeded: exit === "0", output: output || "(no output)" });
          } catch (error) {
            finish(error);
          }
        }, 100);
        handle.onError((error) => finish(error));
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) abort();
      });
      return result;
    } finally {
      handle.cleanup(known);
      if (known) {
        for (const file of [outFile, errFile, doneFile, pidFile, promptFile, full, scriptFile]) {
          try {
            fs12.unlinkSync(file);
          } catch (error) {
            if (error.code !== "ENOENT") throw error;
          }
        }
        fs12.rmdirSync(folder);
      }
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
function createWorkflowTaskAdapter(definition, vaultBase, vaultMutations) {
  return combineWorkflowTaskAdapters([
    createCodeWorkflowAdapter(vaultBase, definition.settings.workingDirectory || vaultBase, vaultMutations),
    createCodexWorkflowAdapter(definition, vaultBase),
    createCopilotWorkflowAdapter(definition, vaultBase),
    createOpenCodeWorkflowAdapter(definition, vaultBase)
  ]);
}

// retired-dependency.ts
function autoOCDependencyError(item) {
  if (item.requiresAutoOCSecrets === void 0 || item.requiresAutoOCSecrets === false) return;
  const identity = typeof item.id === "string" ? item.id : "definition";
  return typeof item.requiresAutoOCSecrets !== "boolean" ? `Invalid AutoOC secrets dependency declaration (${identity}); requiresAutoOCSecrets must be boolean` : `AutoOC Secrets was retired (${identity}); adapt this definition before execution`;
}
function assertNoRetiredDependency(item) {
  const error = autoOCDependencyError(item);
  if (error) throw new Error(error);
}
function assertWorkflowDependencies(workflow, tasks) {
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

// workflow-routing.ts
var vm2 = __toESM(require("vm"));
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
  return !!vm2.runInNewContext(source, sandbox, { timeout: 500 });
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

// workflow-session.ts
async function advanceWorkflowSession(journal, definition, host, options = {}) {
  const verified = prepareWorkflowDefinition(definition.workflow, definition.tasks, definition.settings);
  const checkpoint = journal.snapshot();
  if (verified.hash !== definition.hash || checkpoint.definitionHash !== verified.hash || checkpoint.workflowId !== verified.workflow.id) throw new Error("Workflow definition does not match execution checkpoint");
  const steps = verified.workflow.steps;
  if (new Set(steps.map((step) => step.id)).size !== steps.length) throw new Error("Duplicate workflow step identity");
  const limit = options.maxSteps ?? 1e4;
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("Invalid execution step limit");
  await host.onCheckpoint?.(journal.snapshot());
  for (let count = 0; count < limit; count++) {
    const state = journal.snapshot();
    const observed = state.phase === "in_flight" ? state.steps[state.steps.length - 1].result : void 0;
    if (state.phase === "in_flight" && !observed) throw new Error("Interrupted step requires reconciliation before continuation");
    if (!["ready", "in_flight"].includes(state.phase) || options.signal?.aborted) return state;
    const index = steps.findIndex((step2) => step2.id === state.nextStepId);
    if (index < 0) throw new Error("Checkpoint step is absent from workflow definition");
    const step = steps[index];
    const outputs = /* @__PURE__ */ Object.create(null);
    for (const previous of state.steps) outputs[previous.stepId] = previous.output || "";
    const input = state.steps.length ? state.steps[state.steps.length - 1].output || "" : "";
    if (!observed) {
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
    const result = observed || await host.execute(step, input, outputs, options.signal);
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
    outputs[step.id] = output;
    const transitions = workflowStepTransitions(steps, index);
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
    await journal.finish(step.id, result.succeeded, output, next.nextStepId);
    await host.onCheckpoint?.(journal.snapshot());
  }
  return journal.snapshot();
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
  return new Promise((resolve7, reject) => {
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
          resolve7();
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
  const verified = prepareWorkflowDefinition(definition.workflow, definition.tasks, definition.settings);
  if (verified.hash !== definition.hash || state.definitionHash !== verified.hash || state.workflowId !== verified.workflow.id) throw new Error("Recovery definition mismatch");
  if (state.phase !== "in_flight") return state;
  const step = state.steps[state.steps.length - 1];
  if (!step.codexThreadId || !step.codexTurnId) throw new Error("Exact Codex identity is unavailable; manual reconciliation required");
  const result = await read2(step.codexThreadId, step.codexTurnId);
  if (result.threadId !== step.codexThreadId || result.turnId !== step.codexTurnId) throw new Error("Recovery execution identity mismatch");
  if (!["completed", "failed", "interrupted"].includes(result.status)) return state;
  if (typeof result.output !== "string") throw new Error("Recovery output is unavailable");
  const index = verified.workflow.steps.findIndex((item) => item.id === step.stepId);
  if (index < 0) throw new Error("Recovery step is missing");
  const output = host.redact(result.output);
  if (typeof output !== "string") throw new Error("Invalid redacted recovery output");
  const outputs = /* @__PURE__ */ Object.create(null);
  for (const item of state.steps) outputs[item.stepId] = item.output || "";
  outputs[step.stepId] = output;
  const succeeded = result.status === "completed";
  await journal.recordResult({ succeeded, output, cancelled: result.status === "interrupted" });
  if (result.status === "interrupted") {
    await journal.finish(step.stepId, false, output, null);
    return journal.snapshot();
  }
  const transitions = workflowStepTransitions(verified.workflow.steps, index);
  if (transitions.some((t) => t.mode === "eval")) return journal.snapshot();
  const next = await resolveWorkflowTransition(
    verified.workflow.steps,
    index,
    output,
    succeeded,
    transitions,
    { ...outputs },
    { evaluate: async () => {
      throw new Error("Reconciliation cannot launch a model evaluation");
    }, onError: host.onTransitionError.bind(host) }
  );
  await journal.finish(step.stepId, succeeded, output, next.nextStepId);
  return journal.snapshot();
}

// workflow-branch.ts
var path11 = __toESM(require("path"));
var import_child_process4 = require("child_process");
function validateBranchOptions(task) {
  if (task.branch !== void 0 && typeof task.branch !== "string") throw new Error("Branch must be a string");
  if (task.createBranch !== void 0 && typeof task.createBranch !== "boolean") throw new Error("createBranch must be boolean");
  if (task.createBranch && !task.branch?.trim()) throw new Error("Creating a branch requires its name");
  if (task.branch?.trim()) {
    try {
      (0, import_child_process4.execFileSync)("git", ["check-ref-format", "--branch", task.branch], { stdio: "ignore", windowsHide: true });
    } catch {
      throw new Error("Invalid Git branch name");
    }
    if (task.branch.startsWith("-") || task.branch.includes("@{")) throw new Error("Invalid Git branch name");
  }
}
function git(cwd, args) {
  try {
    const output = (0, import_child_process4.execFileSync)("git", ["-c", `safe.directory=${cwd.replace(/\\/g, "/")}`, ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    return args.includes("-z") ? output : output.trim();
  } catch {
    throw new Error("Git branch operation failed; working tree preserved, no forced checkout or cleanup");
  }
}
function branchRepository(cwd, vault) {
  const directory = physicalPath(git(physicalPath(cwd), ["rev-parse", "--show-toplevel"]));
  if (!isWithinPhysicalPath(vault, directory)) throw new Error("Git repository is outside the selected vault");
  const metadata = physicalPath(git(directory, ["rev-parse", "--absolute-git-dir"]));
  const common = physicalPath(path11.resolve(directory, git(directory, ["rev-parse", "--git-common-dir"])));
  if (!isWithinPhysicalPath(vault, metadata) || !isWithinPhysicalPath(vault, common)) throw new Error("Git metadata is outside the selected vault");
  return directory;
}
function preflightTaskBranch(task, cwd, vault) {
  if (!task.branch?.trim() || task.createBranch) return;
  const directory = branchRepository(cwd, vault);
  if (git(directory, ["branch", "--show-current"]) === task.branch) return;
  const untracked = git(directory, ["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean);
  const target = git(directory, ["ls-tree", "-r", "--name-only", "-z", task.branch]).split("\0").filter(Boolean);
  const collision = untracked.some((file) => target.some((name) => name === file || name.startsWith(file + "/") || file.startsWith(name + "/")));
  if (git(directory, ["status", "--porcelain", "--untracked-files=no"]) || collision) {
    throw new Error("Git Branch cannot switch while the working tree has uncommitted changes. Clear Git Branch to use the current branch, or commit/stash your work first. No task was started.");
  }
}
async function prepareTaskBranch(journal, task, cwd, vault, handoff) {
  validateBranchOptions(task);
  const state = journal.snapshot();
  const previous = handoff ? [...state.steps].reverse().find((step) => step.branch)?.branch : void 0;
  if (!previous && !task.branch?.trim() && !handoff) return;
  const directory = branchRepository(cwd, vault);
  if (previous) {
    if (!samePhysicalPath(branchRepository(previous.directory, vault), directory) || git(directory, ["branch", "--show-current"]) !== previous.name) throw new Error("Workflow branch changed; reconcile before continuation");
  } else if (task.branch?.trim()) {
    const name2 = task.createBranch ? `${task.branch}-${state.runId.slice(0, 8)}-${state.steps.length}` : task.branch;
    git(directory, task.createBranch ? ["checkout", "-b", name2] : ["checkout", name2]);
  }
  const name = git(directory, ["branch", "--show-current"]);
  if (!name) throw new Error("Workflow branch requires an attached Git branch");
  await journal.recordBranch({ directory, name });
}
function verifyWorkflowBranch(journal, vault) {
  const branch = [...journal.snapshot().steps].reverse().find((step) => step.branch)?.branch;
  if (branch && git(branchRepository(branch.directory, vault), ["branch", "--show-current"]) !== branch.name) throw new Error("Workflow branch changed; reconcile before continuation");
}

// workflow-approval.ts
var fs13 = __toESM(require("fs"));
var path12 = __toESM(require("path"));
var import_crypto6 = require("crypto");
function responseFile(directory, runId, token) {
  if (!/^[a-f0-9-]+$/.test(token)) throw new Error("Invalid approval identity");
  return path12.join(directory, `${runId}-${token}.approval.json`);
}
function answerWorkflowApproval(directory, runId, token, approved) {
  if (typeof approved !== "boolean") throw new Error("Explicit approval decision required");
  const state = readExecutionCheckpoint(directory, runId), step = state.steps.slice(-1)[0];
  if (state.phase !== "in_flight" || step?.approval?.token !== token || step.result) throw new Error("Approval is no longer pending");
  const owner = readExecutionLeaseOwner(directory);
  if (owner.token !== step.approval.ownerToken) throw new Error("Approval owner changed; reconcile execution");
  try {
    process.kill(owner.pid, 0);
  } catch {
    throw new Error("Approval owner is unavailable; reconcile execution");
  }
  fs13.writeFileSync(responseFile(directory, runId, token), JSON.stringify({ runId, token, approved }), { encoding: "utf8", flag: "wx", mode: 384 });
  return { runId, approval: token, decision: approved ? "approve" : "deny", recorded: true };
}
async function awaitWorkflowApproval(journal, directory, request, redact, signal, onCheckpoint) {
  const token = (0, import_crypto6.randomUUID)(), runId = journal.snapshot().runId;
  const ownerToken = readExecutionLeaseOwner(directory).token;
  await journal.recordApproval({ token, ownerToken, requestId: request.requestId, kind: request.kind, summary: redact(request.summary) });
  await onCheckpoint?.(journal.snapshot());
  const file = responseFile(directory, runId, token);
  const approved = await new Promise((resolve7, reject) => {
    const finish = (error, value) => {
      clearInterval(timer);
      signal?.removeEventListener("abort", abort);
      error ? reject(error) : resolve7(value);
    };
    const abort = () => finish(new Error("Approval interrupted; execution requires reconciliation"));
    const timer = setInterval(() => {
      try {
        if (!fs13.existsSync(file)) return;
        const stat = fs13.lstatSync(file);
        if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Invalid approval response file");
        const response = JSON.parse(fs13.readFileSync(file, "utf8"));
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

// code-workflow-host.ts
var advancingLeases = /* @__PURE__ */ new WeakSet();
function supportsSharedWorkflow(definition, tasks) {
  assertWorkflowDependencies(definition.workflow, definition.tasks);
  return !definition.workflow.requiresAutoOCSecrets && !definition.tasks.some((task) => task.requiresAutoOCSecrets) && !definition.workflow.steps.some((step) => !["code", "delay", "task"].includes(step.stepKind || "task")) && definition.tasks.every((task) => !!tasks?.supports(task));
}
async function runCodeWorkflowHost(options) {
  assertWorkflowDependencies(options.definition.workflow, options.definition.tasks);
  const definition = prepareWorkflowDefinition(options.definition.workflow, options.definition.tasks, options.definition.settings);
  if (definition.hash !== options.definition.hash) throw new Error("Workflow definition changed");
  if (options.reconcile && !options.resumeRunId) throw new Error("Reconciliation requires an existing run identity");
  if (options.maxSteps !== void 0 && (!Number.isSafeInteger(options.maxSteps) || options.maxSteps < 1)) throw new Error("Invalid execution step limit");
  const steps = definition.workflow.steps;
  if (definition.tasks.some((task) => !options.tasks?.supports(task))) throw new Error("No adapter for referenced workflow task");
  if (!supportsSharedWorkflow(definition, options.tasks)) throw new Error("Unsupported step, task or model evaluation in this host");
  if (steps.some((step) => step.transitionMode === "eval" || step.transitions?.some((t) => t.mode === "eval")) && !options.evaluate) throw new Error("Model evaluation adapter is required");
  const entry = findWorkflowEntry(steps);
  if (!entry) throw new Error("Workflow has no entry step");
  const lease = options.lease || acquireExecutionLease(options.runtimeDirectory);
  lease.assertOwned();
  if (!samePhysicalPath(options.runtimeDirectory, lease.directory)) throw new Error("Execution lease belongs to another runtime");
  if (advancingLeases.has(lease)) throw new Error("Execution lease already has an advancing session");
  advancingLeases.add(lease);
  try {
    const resumed = options.resumeRunId === void 0 ? void 0 : ExecutionJournal.open(lease, options.resumeRunId, definition.hash);
    if (resumed?.snapshot().phase === "abandoned") throw new Error("Abandoned execution cannot be resumed; inspect its unknown outcome before starting new work");
    if (resumed && resumed.snapshot().workflowId !== definition.workflow.id) throw new Error("Execution belongs to another workflow");
    if (resumed && definition.workflow.handoffBranch && ["ready", "in_flight"].includes(resumed.snapshot().phase)) {
      verifyWorkflowBranch(resumed, options.vaultBase);
    }
    if (resumed?.snapshot().phase === "in_flight" && !resumed.snapshot().steps.slice(-1)[0].result) {
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
    for (const file of fs14.readdirSync(lease.directory)) {
      if (!/^[a-f0-9-]+\.json$/.test(file)) continue;
      if (fs14.lstatSync(lease.directory + "/" + file).isSymbolicLink()) throw new Error("Execution checkpoint cannot be a link");
      const prior = JSON.parse(fs14.readFileSync(lease.directory + "/" + file, "utf8"));
      ExecutionJournal.open(lease, file.slice(0, -5), prior.definitionHash);
      if (prior.runId !== options.resumeRunId && !["completed", "failed", "abandoned"].includes(prior.phase)) {
        throw new Error(`Previous execution requires continuation or reconciliation (run ${prior.runId}, workflow ${prior.workflowId}, step ${prior.nextStepId}). No new task was started.`);
      }
    }
    const journal = resumed || await ExecutionJournal.create(lease, definition.workflow.id, definition.hash, entry.id);
    return await advanceWorkflowSession(journal, definition, {
      async execute(step, input, outputs, signal) {
        if (definition.workflow.handoffBranch) verifyWorkflowBranch(journal, options.vaultBase);
        if (!step.stepKind || step.stepKind === "task") {
          const task = definition.tasks.find((task2) => task2.id === step.taskId);
          if (!task || !options.tasks) throw new Error("Workflow task adapter is unavailable");
          const stepIndex = journal.snapshot().steps.length - 1;
          await prepareTaskBranch(journal, task, task.workingDirectory || definition.settings.workingDirectory || options.vaultBase, options.vaultBase, !!definition.workflow.handoffBranch);
          const completed = journal.snapshot().steps.filter((item) => item.status !== "in_flight");
          const previous = completed[completed.length - 1];
          const prompt = workflowTaskPrompt(
            task.prompt || "",
            definition.workflow,
            previous ? { stepId: previous.stepId, output: previous.output || "" } : void 0
          );
          let observing = true;
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
        try {
          const output = await runWithVaultMutations(options.vaultMutations, (onVaultMutation) => executeCode({ ...step, code: step.code || "", vaultBase: options.vaultBase, cwd: definition.settings.workingDirectory || options.vaultBase, input, outputs, onVaultMutation }));
          return { succeeded: true, output };
        } catch (error) {
          return { succeeded: false, output: `[code error: ${String(error)}]` };
        }
      },
      evaluate: options.evaluate || (async () => {
        throw new Error("Model evaluation is not supported by this host");
      }),
      redact: options.redact,
      onTransitionError: () => {
      },
      onCheckpoint: options.onCheckpoint
    }, { signal: options.signal, maxSteps: options.maxSteps });
  } finally {
    advancingLeases.delete(lease);
    if (!options.lease) lease.release();
  }
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
  return projectPreparedProgress(workflow, checkpoint, activelyExecuting);
}
function projectPreparedProgress(workflow, checkpoint, activelyExecuting = false) {
  const last = new Map(checkpoint.steps.map((step) => [step.stepId, step]));
  if (checkpoint.steps.some((step) => !workflow.steps.some((known) => known.id === step.stepId))) throw new Error("Progress contains an unknown step");
  if (checkpoint.nextStepId && !workflow.steps.some((known) => known.id === checkpoint.nextStepId)) throw new Error("Progress next step is absent");
  const target = checkpoint.nextStepId || checkpoint.steps[checkpoint.steps.length - 1]?.stepId;
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

// task-history.ts
var fs15 = __toESM(require("fs"));
var path13 = __toESM(require("path"));
function regularDirectory2(directory) {
  if (!fs15.existsSync(directory)) fs15.mkdirSync(directory);
  const stat = fs15.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Task history requires regular directories");
}
function persistTaskHistory(vault, workflow, checkpoint, settings) {
  if (settings.logsEnabled === false) return;
  const root = fs15.realpathSync(vault);
  const touched = /* @__PURE__ */ new Set();
  for (const [index, observed] of checkpoint.steps.entries()) {
    const step = workflow.steps.find((item) => item.id === observed.stepId);
    if (!step?.taskId || step.stepKind && step.stepKind !== "task" || observed.status === "in_flight" || !observed.startedAt) continue;
    if (!/^[a-zA-Z0-9_-]+$/.test(step.taskId)) throw new Error("Unsafe task history identity");
    let directory = root;
    for (const part of [".opencode", "logs", step.taskId]) {
      directory = path13.join(directory, part);
      regularDirectory2(directory);
    }
    const date = new Date(observed.startedAt), pad = (n) => String(n).padStart(2, "0");
    const timestamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, "0")}`;
    const file = path13.join(directory, `${timestamp}_${checkpoint.runId}_${String(index).padStart(6, "0")}.log`);
    const content = `Run: ${checkpoint.runId}
Step: ${observed.stepId}
Status: ${observed.status}
Started: ${observed.startedAt}
Finished: ${observed.finishedAt || "unknown"}

${observed.output || "(no output)"}`;
    try {
      fs15.writeFileSync(file, content, { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const stat = fs15.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || fs15.readFileSync(file, "utf8") !== content) throw new Error("Task history conflicts with durable output");
    }
    touched.add(directory);
  }
  for (const directory of touched) {
    const files = fs15.readdirSync(directory).filter((name) => name.endsWith(".log") && name !== "latest.log").sort();
    const max = settings.maxLogsPerTask ?? 50, days = settings.logRetentionDays ?? 30;
    const retained = [];
    for (const name of files) {
      const file = path13.join(directory, name), stat2 = fs15.lstatSync(file);
      if (!stat2.isFile() || stat2.isSymbolicLink()) throw new Error("Task history requires regular files");
      const match = name.match(/^(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})/);
      const date = match ? Date.parse(`${match[1]}T${match[2]}:${match[3]}:${match[4]}`) : NaN;
      if (days > 0 && date < Date.now() - days * 864e5) fs15.unlinkSync(file);
      else retained.push(name);
    }
    while (max > 0 && retained.length > max) fs15.unlinkSync(path13.join(directory, retained.shift()));
    const latest = path13.join(directory, "latest.log");
    const stat = fs15.lstatSync(latest, { throwIfNoEntry: false });
    if (stat) {
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Task history latest must be a regular file");
    }
    if (retained.length) fs15.writeFileSync(latest, fs15.readFileSync(path13.join(directory, retained[retained.length - 1])));
  }
}

// workflow-catalog-progress.ts
async function persistWorkflowProgress(options) {
  const durable = readExecutionCheckpoint(options.runtimeDirectory, options.expectedRunId);
  if (JSON.stringify(durable) !== JSON.stringify(options.checkpoint)) {
    throw new Error("Catalog progress does not match the durable checkpoint");
  }
  const writer = options.writer || new SettingsWriter();
  const config = await writer.loadAsync(options.configurationFile);
  if (!config || !Array.isArray(config.tasks) || !Array.isArray(config.workflows)) {
    throw new Error("Invalid AutoOC catalog");
  }
  const virtual = options.taskId ? standaloneTaskWorkflow(options.taskId) : void 0;
  if (virtual && (virtual.id !== durable.workflowId || config.workflows.some((workflow2) => workflow2.id === virtual.id))) throw new Error("Standalone task identity mismatch");
  if (virtual && config.tasks.filter((task) => task.id === options.taskId).length !== 1) throw new Error("Missing or ambiguous task in catalog");
  const matches = virtual ? [virtual] : config.workflows.filter((workflow2) => workflow2.id === durable.workflowId);
  if (matches.length !== 1) throw new Error("Missing or ambiguous workflow in catalog");
  let workflow = virtual ? { ...virtual, runtimeExecution: config.tasks.find((task) => task.id === options.taskId).runtimeExecution } : matches[0];
  if (options.replaceCompletedRunId && workflow.runtimeExecution?.runId === options.replaceCompletedRunId && durable.runId !== options.replaceCompletedRunId) {
    const previous = readExecutionCheckpoint(options.runtimeDirectory, options.replaceCompletedRunId);
    const previousId = virtual && !previous.workflowId.startsWith("@task:") ? workflow.runtimeExecution.workflowId : workflow.id;
    validateProgressBinding({ ...workflow, id: previousId }, previous, options.replaceCompletedRunId);
    if (!virtual && previous.workflowId !== durable.workflowId || !["completed", "failed", "abandoned"].includes(previous.phase)) {
      throw new Error("Cannot replace an unfinished execution");
    }
    workflow = { ...workflow };
    delete workflow.runtimeExecution;
  }
  const preserveLegacy = !virtual && matches[0].legacyExecution && matches[0].runtimeExecution?.runId === durable.runId;
  if (preserveLegacy) {
    validateProgressBinding(matches[0], durable, options.expectedRunId);
    if (!["completed", "failed", "abandoned"].includes(durable.phase)) throw new Error("Legacy workflow overlaps an unfinished shared run");
  }
  const projected = preserveLegacy ? matches[0] : { ...projectWorkflowProgress(workflow, config.tasks, config, durable, options.expectedRunId), legacyExecution: void 0 };
  const observedTasks = /* @__PURE__ */ new Map();
  for (const [stepIndex, observed] of durable.steps.entries()) {
    const step = workflow.steps.find((item) => item.id === observed.stepId);
    if (step?.taskId && (!step.stepKind || step.stepKind === "task")) {
      observedTasks.set(step.taskId, { stepId: step.id, stepIndex, observed });
    }
  }
  const tasks = config.tasks.map((task) => {
    const item = observedTasks.get(task.id);
    if (!item) return task;
    const previous = task.runtimeExecution;
    if (previous?.runId === durable.runId && previous.revision > durable.revision) throw new Error("Stale task progress");
    if (task.legacyExecution && previous?.runId === durable.runId) {
      validateProgressBinding({ id: previous.workflowId, runtimeExecution: previous }, durable, options.expectedRunId);
      if (!["completed", "failed", "abandoned"].includes(durable.phase)) throw new Error("Legacy task overlaps an unfinished shared run");
      return task;
    }
    if (previous && previous.runId !== durable.runId) {
      if (item.observed.status !== "in_flight") return task;
      const prior = readExecutionCheckpoint(options.runtimeDirectory, previous.runId);
      if (!["completed", "failed", "abandoned"].includes(prior.phase)) throw new Error("Task belongs to an unfinished execution");
    }
    return {
      ...task,
      legacyExecution: void 0,
      status: item.observed.status === "in_flight" ? durable.phase === "abandoned" ? "abandoned" : "pending" : item.observed.status,
      ...item.observed.startedAt ? { lastRun: item.observed.startedAt } : {},
      output: item.observed.output || "",
      ...item.observed.codexThreadId ? { lastCodexThreadId: item.observed.codexThreadId } : {},
      ...item.observed.codexTurnId ? { lastCodexTurnId: item.observed.codexTurnId } : {},
      pendingCodexApproval: durable.phase !== "abandoned" && item.observed.approval ? { ...item.observed.approval, requestId: item.observed.approval.token } : void 0,
      runtimeExecution: {
        runId: durable.runId,
        workflowId: durable.workflowId,
        definitionHash: durable.definitionHash,
        stepId: item.stepId,
        stepIndex: item.stepIndex,
        revision: durable.revision,
        finishedAt: item.observed.finishedAt,
        phase: durable.phase,
        abandonment: durable.abandonment,
        requiresReconciliation: durable.phase !== "abandoned" && item.observed.status === "in_flight"
      }
    };
  });
  const next = { ...config, tasks, workflows: virtual ? config.workflows : config.workflows.map((workflow2) => workflow2 === matches[0] ? projected : workflow2) };
  await writer.save(options.configurationFile, () => next);
  if (options.vaultBase) persistTaskHistory(options.vaultBase, workflow, durable, config);
  return {
    catalog: next,
    version: writer.confirmedVersion(options.configurationFile),
    runId: durable.runId,
    workflowId: durable.workflowId,
    revision: durable.revision
  };
}

// workflow-stop.ts
var fs16 = __toESM(require("fs"));
var path14 = __toESM(require("path"));
var import_crypto7 = require("crypto");
function readStopRequest(directory, runId) {
  if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error("Invalid execution identity");
  const file = path14.join(directory, runId + ".stop.json");
  try {
    const stat = fs16.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Invalid stop request file");
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  let value;
  try {
    value = JSON.parse(fs16.readFileSync(file, "utf8"));
  } catch {
    throw new Error("Invalid stop request");
  }
  if (value.schemaVersion !== 1 || value.runId !== runId || !/^[a-f0-9-]+$/.test(value.requestId || "")) throw new Error("Invalid stop request identity");
  return value.requestId;
}
async function requestWorkflowStop(directory, runId) {
  const stat = fs16.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Invalid runtime directory");
  const state = readExecutionCheckpoint(directory, runId);
  if (["completed", "failed", "abandoned"].includes(state.phase)) return { runId, requested: false, phase: state.phase };
  readStopRequest(directory, runId);
  const requestId = (0, import_crypto7.randomUUID)();
  await atomicSettingsWrite(path14.join(directory, runId + ".stop.json"), { schemaVersion: 1, runId, requestId });
  return { runId, requestId, requested: true, phase: state.phase };
}

// workflow-preflight.ts
var fs17 = __toESM(require("fs"));
var path15 = __toESM(require("path"));
function preflightInstalledWorkflow(definition, vault) {
  assertWorkflowDependencies(definition.workflow, definition.tasks);
  const root = physicalPath(vault);
  const checkDirectory = (value) => {
    if (value !== void 0 && typeof value !== "string") throw new Error("Invalid working directory");
    const configured = value || root;
    if (!path15.isAbsolute(configured)) throw new Error("Working directory must be absolute");
    const directory = physicalPath(configured);
    if (!isWithinPhysicalPath(root, directory)) throw new Error("Working directory is outside the selected vault");
    if (!fs17.statSync(directory).isDirectory()) throw new Error("Working directory is unavailable");
  };
  checkDirectory(definition.settings.workingDirectory);
  for (const item of [definition.workflow, ...definition.workflow.steps, ...definition.tasks]) {
    if (item.workingDirectory !== void 0) checkDirectory(item.workingDirectory);
    if (item.interactiveTerminal !== void 0 && typeof item.interactiveTerminal !== "boolean") throw new Error("interactiveTerminal must be boolean");
    if (item.taskKind === "code" && item.interactiveTerminal === true) throw new Error("Code tasks cannot be interactive");
    validateBranchOptions(item);
    if (item.branch?.trim() || definition.workflow.handoffBranch) branchRepository(item.workingDirectory || definition.settings.workingDirectory || root, root);
    if (definition.workflow.id.startsWith("@task:")) preflightTaskBranch(item, item.workingDirectory || definition.settings.workingDirectory || root, root);
  }
  for (const task of definition.tasks) {
    if (task.taskKind === "code") continue;
    if (typeof task.prompt !== "string" || !task.prompt.trim()) throw new Error("Task prompt must be nonempty before execution");
    if ((!task.taskKind || task.taskKind === "opencode") && !(task.model || definition.settings.defaultModel)?.trim()) throw new Error("OpenCode model must be selected before execution");
  }
}

// workflow-evaluation.ts
function createWorkflowEvaluator(definition, vault, signal) {
  const adapter = createOpenCodeWorkflowAdapter(definition, vault);
  return async (transition, _target, input) => {
    const instruction = transition.evaluatePrompt?.trim() || "Did the previous step complete successfully? If it is safe to continue, reply YES. Otherwise reply NO.";
    const result = await adapter.execute(
      {
        taskKind: "opencode",
        model: definition.settings.defaultModel || "opencode/default",
        agent: definition.settings.defaultAgent,
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

// installed-workflow-host.ts
var preparingInstallations = /* @__PURE__ */ new Set();
async function runInstalledWorkflow(options) {
  if (!path16.isAbsolute(options.vault) || !!options.workflowId === !!options.taskId) throw new Error("Explicit vault and exactly one workflow or task identity required");
  if (options.newExecution && (options.resumeRunId || options.reconcile)) throw new Error("New execution cannot also resume or reconcile");
  const location = resolveInstalledWorkflowLocation(options.vault, options.installationDirectory);
  const { vault, configurationFile, runtimeDirectory } = location;
  if (options.lease) {
    options.lease.assertOwned();
    if (!samePhysicalPath(options.lease.directory, runtimeDirectory)) throw new Error("Lease belongs to another installation runtime");
  }
  if (preparingInstallations.has(runtimeDirectory)) throw Object.assign(new Error("Installation already has an advancing session"), { code: "EEXIST" });
  preparingInstallations.add(runtimeDirectory);
  let ownedLease;
  try {
    if (!options.lease && fs18.existsSync(runtimeDirectory)) ownedLease = acquireExecutionLease(runtimeDirectory);
    const reader = options.catalogWriter || new SettingsWriter();
    let config = await reader.loadAsync(configurationFile);
    if (!config || !Array.isArray(config.tasks) || !Array.isArray(config.workflows)) throw new Error("Invalid AutoOC catalog");
    if (config.tasks.some((task) => task.status === "running") || config.workflows.some((workflow) => workflow.status === "running")) {
      throw new Error("Catalog has unresolved running activity; verify its owner before execution");
    }
    const virtual = options.taskId ? standaloneTaskWorkflow(options.taskId) : void 0;
    if (virtual && config.workflows.some((workflow) => workflow.id === virtual.id)) throw new Error("Reserved task identity conflicts with a workflow");
    const matches = virtual ? config.tasks.filter((task) => task.id === options.taskId) : config.workflows.filter((workflow) => workflow.id === options.workflowId);
    if (matches.length !== 1) throw new Error("Missing or ambiguous workflow identity");
    if (matches[0].runtimeExecution && matches[0].runtimeExecution.runId !== options.resumeRunId && !options.newExecution) {
      throw new Error("Workflow has a bound execution; select that identity explicitly");
    }
    const definition = prepareWorkflowDefinition(virtual || matches[0], config.tasks, config);
    preflightInstalledWorkflow(definition, vault);
    ensureInstalledWorkflowRuntime(location);
    if (!options.lease && !ownedLease) ownedLease = acquireExecutionLease(runtimeDirectory);
    await reader.assertUnchanged(configurationFile);
    const replaceCompletedRunId = options.newExecution ? matches[0].runtimeExecution?.runId : void 0;
    if (replaceCompletedRunId) {
      const previous = readExecutionCheckpoint(runtimeDirectory, replaceCompletedRunId);
      const binding = matches[0].runtimeExecution;
      const previousId = virtual && !previous.workflowId.startsWith("@task:") ? binding.workflowId : definition.workflow.id;
      validateProgressBinding({ id: previousId, runtimeExecution: binding }, previous, replaceCompletedRunId);
      if (!["completed", "failed", "abandoned"].includes(previous.phase)) {
        throw new Error("Cannot replace an unfinished execution");
      }
    }
    config = void 0;
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
        resumeRunId: options.resumeRunId,
        reconcile: options.reconcile,
        maxSteps: options.maxSteps,
        signal: controller.signal,
        redact: options.redact,
        lease: options.lease || ownedLease,
        vaultMutations: options.vaultMutations,
        onTaskOutput: options.onTaskOutput,
        tasks: createWorkflowTaskAdapter(definition, vault, options.vaultMutations),
        evaluate: createWorkflowEvaluator(definition, vault, controller.signal),
        onCheckpoint: async (checkpoint) => {
          activeRunId = checkpoint.runId;
          checkStop();
          const catalog = await persistWorkflowProgress({ configurationFile, runtimeDirectory, checkpoint, expectedRunId: checkpoint.runId, replaceCompletedRunId, taskId: options.taskId, vaultBase: vault, writer: reader });
          await options.onCheckpoint?.(checkpoint, catalog);
        }
      });
      if (stopError) throw stopError;
      return result;
    } finally {
      clearInterval(timer);
      options.signal?.removeEventListener("abort", abort);
    }
  } finally {
    try {
      ownedLease?.release();
    } finally {
      preparingInstallations.delete(runtimeDirectory);
    }
  }
}

// cli-plugin-requests.ts
var fs19 = __toESM(require("fs"));
var path17 = __toESM(require("path"));
var import_crypto9 = require("crypto");
var import_perf_hooks3 = require("perf_hooks");

// workflow-edit.ts
var import_crypto8 = require("crypto");
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
  return (0, import_crypto8.createHash)("sha256").update(JSON.stringify(workflowEditDefinition(workflow))).digest("hex");
}

// cli-plugin-requests.ts
function executionSummary(state) {
  const { runId, workflowId, phase, revision, nextStepId } = state;
  return { runId, workflowId, phase, revision, nextStepId };
}
function regularDirectory3(directory) {
  const stat = fs19.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs19.realpathSync(directory) !== directory) throw new Error("Unsafe CLI request directory");
}
function read(file) {
  const stat = fs19.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 65536) throw new Error("Unsafe CLI request file");
  return JSON.parse(fs19.readFileSync(file, "utf8"));
}
function write(file, value) {
  const fd = fs19.openSync(file, "wx", 384);
  try {
    fs19.writeFileSync(fd, JSON.stringify(value));
    fs19.fsyncSync(fd);
  } finally {
    fs19.closeSync(fd);
  }
}
async function replace(file, value, check, asyncFlush = true) {
  const temp = file + "." + (0, import_crypto9.randomUUID)() + ".tmp";
  check();
  const deadline = import_perf_hooks3.performance.now() + 2e3;
  let lastError;
  const bytes = JSON.stringify(value);
  let owned;
  const sameTemporary = () => {
    if (!owned || !fs19.existsSync(temp)) return false;
    const current = fs19.lstatSync(temp);
    return current.isFile() && !current.isSymbolicLink() && current.nlink === 1 && current.dev === owned.dev && current.ino === owned.ino;
  };
  try {
    const fd = fs19.openSync(temp, "wx", 384);
    try {
      owned = fs19.fstatSync(fd);
      fs19.writeFileSync(fd, bytes);
      if (asyncFlush) await new Promise((resolve7, reject) => fs19.fsync(fd, (error) => error ? reject(error) : resolve7()));
      else fs19.fsyncSync(fd);
    } finally {
      fs19.closeSync(fd);
    }
    for (let attempt = 0; ; attempt++) {
      if (attempt > 0 && import_perf_hooks3.performance.now() >= deadline) throw lastError;
      if (!sameTemporary() || fs19.readFileSync(temp, "utf8") !== bytes) throw new Error("CLI publication temporary identity changed");
      check();
      if (fs19.existsSync(file)) read(file);
      try {
        fs19.renameSync(temp, file);
        return;
      } catch (error) {
        lastError = error;
        if (!["EPERM", "EACCES", "EBUSY"].includes(error.code || "") || attempt >= 12 || import_perf_hooks3.performance.now() >= deadline) throw error;
        await new Promise((resolve7) => setTimeout(resolve7, Math.min(20 * (attempt + 1), 100)));
      }
    }
  } finally {
    if (sameTemporary() && fs19.statSync(temp).size === Buffer.byteLength(bytes) && fs19.readFileSync(temp, "utf8") === bytes) fs19.unlinkSync(temp);
  }
}
function validCommand(value) {
  if (value?.command === "edit-workflow") return validWorkflowEdit(value);
  const id = (v) => typeof v === "string" && v.length > 0 && v.length <= 256 && !/[\0\r\n]/.test(v);
  return value && ["run", "resume", "reconcile"].includes(value.command) && (id(value.workflowId) && value.taskId === void 0 || id(value.taskId) && value.workflowId === void 0) && (value.command === "run" ? value.runId === void 0 : typeof value.runId === "string" && value.runId.length <= 256 && /^[a-zA-Z0-9-]+$/.test(value.runId));
}
async function requestPluginExecution(runtime, command, signal, onProgress) {
  return requestPluginCommand(runtime, command, signal, onProgress);
}
async function requestPluginWorkflowEdit(runtime, command) {
  const result = await requestPluginCommand(runtime, command);
  if (!result) throw new Error("Enable AutoOC in Obsidian to edit workflows through its owner; do not edit data.json directly");
  return result;
}
async function requestPluginCommand(runtime, command, signal, onProgress) {
  if (!fs19.existsSync(path17.join(runtime, "execution.lock"))) return void 0;
  const root = fs19.realpathSync(runtime);
  regularDirectory3(root);
  const owner = readExecutionLeaseOwner(root), directory = path17.join(root, "cli-" + owner.token);
  if (!fs19.existsSync(directory)) throw new Error("AutoOC execution is reserved; the owner does not support CLI requests. Inspect status before retrying");
  const waitDeadline = import_perf_hooks3.performance.now() + 24 * 60 * 60 * 1e3;
  const check = () => {
    regularDirectory3(directory);
    const current = readExecutionLeaseOwner(root);
    if (current.token !== owner.token || current.pid !== owner.pid) throw new Error("CLI request owner changed");
    const host = read(path17.join(directory, "host"));
    if (host.protocol !== 1 || host.owner !== owner.token || host.pid !== owner.pid) throw new Error("Invalid CLI request host");
    if (command.command === "edit-workflow" && host.workflowEditing !== true) throw new Error("Loaded AutoOC does not support workflow editing; reload the updated plugin once, keeping Obsidian open");
    if (host.heartbeatAt !== void 0) {
      if (!Number.isFinite(host.heartbeatAt) || host.heartbeatAt > Date.now() + 6e4 || Date.now() - host.heartbeatAt > 3e4)
        throw new Error("CLI host heartbeat expired; terminal publication is uncertain");
    }
    process.kill(owner.pid, 0);
  };
  check();
  if (signal?.aborted) throw new Error("CLI request cancelled before submission");
  const id = (0, import_crypto9.randomUUID)(), expiresAt = Date.now() + 3e4;
  const file = path17.join(directory, id + ".request"), resultFile = path17.join(directory, id + ".receipt");
  if (!validCommand(command)) throw new Error("Invalid CLI command");
  if (Buffer.byteLength(JSON.stringify(command), "utf8") > 6e4) throw new Error("Workflow edit payload exceeds 60KB; split the edit into smaller patches");
  await replace(file, { protocol: 1, owner: owner.token, id, expiresAt, ...command }, check, false);
  let accepted = false, lastProgress = "", runId = "runId" in command ? command.runId : void 0;
  for (; ; ) {
    try {
      regularDirectory3(directory);
      if (fs19.existsSync(resultFile)) {
        const result = read(resultFile);
        if (result.protocol !== 1 || result.owner !== owner.token || result.id !== id) throw new Error("CLI receipt identity changed");
        if (!["accepted", "running", "completed", "rejected", "failed"].includes(result.status)) throw new Error("Invalid CLI receipt status");
        const checkpoint = result.checkpoint;
        if (command.command === "edit-workflow") {
          if (result.status === "completed") {
            if (result.editResult?.workflowId !== command.workflowId || !/^[a-f0-9]{64}$/.test(result.editResult?.definitionHash)) throw new Error("Invalid workflow edit receipt");
            return result.editResult;
          }
          if (result.status === "rejected" || result.status === "failed") throw new Error(result.error);
        }
        if (checkpoint && (typeof checkpoint.runId !== "string" || !/^[a-zA-Z0-9-]+$/.test(checkpoint.runId) || checkpoint.workflowId !== (command.taskId ? "@task:" + command.taskId : command.workflowId) || "runId" in command && command.runId && checkpoint.runId !== command.runId || !Number.isSafeInteger(checkpoint.revision) || checkpoint.revision < 0 || !["ready", "in_flight", "completed", "failed", "abandoned"].includes(checkpoint.phase) || !(checkpoint.nextStepId === null || typeof checkpoint.nextStepId === "string"))) throw new Error("Invalid CLI receipt checkpoint");
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
        write(path17.join(directory, id + ".cancel"), { id });
        throw new Error("CLI wait interrupted; cooperative cancellation requested");
      }
      check();
      if (import_perf_hooks3.performance.now() >= waitDeadline) throw new Error("CLI wait deadline reached; execution outcome is uncertain");
      if (!accepted && Date.now() > expiresAt) throw new Error("CLI request expired before acceptance");
    } catch (error) {
      const reason = error instanceof Error && !error.code ? error.message : "CLI request host is unavailable";
      throw new Error(`${reason}. Request ${id}${runId ? `, run ${runId}` : ""}; inspect status and receipt before any retry`);
    }
    await new Promise((resolve7) => setTimeout(resolve7, 100));
  }
}

// release-maintenance.ts
var fs22 = __toESM(require("fs"));
var path20 = __toESM(require("path"));
var import_crypto11 = require("crypto");

// execution-idle.ts
var fs20 = __toESM(require("fs"));
var path18 = __toESM(require("path"));
function assertIdleJournals(runtime) {
  if (fs20.existsSync(path18.join(runtime, "update-pending.json"))) throw new Error("Incomplete plugin update requires recovery before execution");
  const checkpoints = /* @__PURE__ */ new Map();
  for (const name of fs20.readdirSync(runtime)) {
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
function assertInstalledExecutionIdle(directory, memorySettings) {
  const checkpoints = assertIdleJournals(path18.join(directory, "runtime"));
  const file = path18.join(directory, "data.json");
  if (fs20.existsSync(file + ".write-lock") || fs20.existsSync(file + ".write-intent") || fs20.readdirSync(directory).some((name) => name.startsWith("data.json.") && name.endsWith(".tmp"))) {
    throw new Error("Unfinished configuration write requires reconciliation");
  }
  let stat;
  try {
    stat = fs20.lstatSync(file);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (stat) {
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error("Unsafe execution configuration");
    assertIdleCatalog(JSON.parse(fs20.readFileSync(file, "utf8")), checkpoints);
  }
  if (memorySettings !== void 0) assertIdleCatalog(memorySettings, checkpoints);
}

// release-update.ts
var fs21 = __toESM(require("fs"));
var path19 = __toESM(require("path"));
var import_crypto10 = require("crypto");
var RELEASE_FILES = ["main.js", "manifest.json", "styles.css", "autooc-cli.cjs", "autooc-runtime.cjs", "skills/autooc-runtime/SKILL.md"];
var RELEASE_DESCRIPTOR = "release-integrity.json";
function verifyRelease(files, expectedVersion) {
  const descriptor = JSON.parse(files[RELEASE_DESCRIPTOR]?.toString("utf8") || "null");
  if (descriptor?.schemaVersion !== 1 || descriptor.version !== expectedVersion || !descriptor.sha256 || Object.keys(descriptor.sha256).sort().join() !== [...RELEASE_FILES].sort().join() || Object.keys(files).sort().join() !== [...RELEASE_FILES, RELEASE_DESCRIPTOR].sort().join()) {
    throw new Error("Incomplete or incompatible AutoOC release");
  }
  for (const file of RELEASE_FILES) {
    if (!Buffer.isBuffer(files[file]) || (0, import_crypto10.createHash)("sha256").update(files[file]).digest("hex") !== descriptor.sha256[file]) {
      throw new Error(`Release integrity mismatch: ${file}`);
    }
  }
  const manifest = JSON.parse(files["manifest.json"].toString("utf8"));
  if (manifest.id !== "auto-oc" || manifest.version !== expectedVersion) throw new Error("Release manifest identity mismatch");
}
function regularPath(root, relative5, create = false) {
  let current = root;
  const parts = relative5.split("/");
  for (let i = 0; i < parts.length; i++) {
    current = path19.join(current, parts[i]);
    let stat;
    try {
      stat = fs21.lstatSync(current);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (stat && (stat.isSymbolicLink() || (i < parts.length - 1 ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1))) {
      throw new Error(`Unsafe release destination: ${relative5}`);
    }
    if (!stat && i < parts.length - 1 && create) fs21.mkdirSync(current);
  }
  return current;
}
function installRelease(options) {
  const { files, version: version2, lease } = options;
  verifyRelease(files, version2);
  const directory = fs21.realpathSync(options.directory);
  if (fs21.lstatSync(options.directory).isSymbolicLink() || path19.join(directory, "runtime") !== lease.directory) throw new Error("Update lease belongs to another installation");
  lease.assertOwned();
  const marker = path19.join(lease.directory, "update-pending.json");
  if (fs21.existsSync(marker)) throw new Error("Previous update requires recovery");
  assertIdleJournals(lease.directory);
  const names = [...RELEASE_FILES, RELEASE_DESCRIPTOR];
  for (const name of names) regularPath(directory, name);
  const backup = path19.join(lease.directory, `update-backup-${(0, import_crypto10.randomUUID)()}`);
  fs21.mkdirSync(backup);
  const previous = /* @__PURE__ */ new Map();
  for (const name of names) {
    const source = regularPath(directory, name);
    const bytes = fs21.existsSync(source) ? fs21.readFileSync(source) : void 0;
    previous.set(name, bytes);
    if (bytes) {
      const target = path19.join(backup, name);
      fs21.mkdirSync(path19.dirname(target), { recursive: true });
      fs21.writeFileSync(target, bytes, { flag: "wx" });
    }
  }
  const record = { schemaVersion: 1, version: version2, backup: path19.basename(backup), files: names, absent: names.filter((name) => !previous.has(name) || previous.get(name) === void 0) };
  fs21.writeFileSync(path19.join(backup, "recovery.json"), JSON.stringify(record));
  const fd = fs21.openSync(marker, "wx");
  try {
    fs21.writeFileSync(fd, JSON.stringify(record));
    fs21.fsyncSync(fd);
  } finally {
    fs21.closeSync(fd);
  }
  const written = [];
  try {
    for (const name of names) {
      lease.assertOwned();
      const target = regularPath(directory, name, true);
      written.push(name);
      fs21.writeFileSync(target, files[name]);
    }
    const installed = Object.fromEntries(names.map((name) => [name, fs21.readFileSync(regularPath(directory, name))]));
    verifyRelease(installed, version2);
    fs21.unlinkSync(marker);
    return { version: version2, backup, installed: names };
  } catch (error) {
    for (const name of written.reverse()) {
      const target = regularPath(directory, name);
      const bytes = previous.get(name);
      if (bytes !== void 0) fs21.writeFileSync(target, bytes);
      else if (fs21.existsSync(target)) fs21.unlinkSync(target);
    }
    fs21.unlinkSync(marker);
    throw error;
  }
}

// release-maintenance.ts
function readDecisionFile(file) {
  if (!path20.isAbsolute(file)) throw new Error("Explicit absolute decision file required");
  const stat = fs22.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 1024 * 1024) throw new Error("Decision file must be a regular JSON file of at most 1MB");
  try {
    return JSON.parse(fs22.readFileSync(file, "utf8"));
  } catch {
    throw new Error("Invalid decision JSON");
  }
}
async function maintainRelease(options) {
  const names = [...RELEASE_FILES, RELEASE_DESCRIPTOR];
  const regular = (file) => {
    const stat = fs22.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error("Unsafe maintenance file");
    return fs22.readFileSync(file);
  };
  const source = physicalPath(options.sourceDirectory), files = {};
  for (const name of names) {
    let current = source;
    for (const part of name.split("/").slice(0, -1)) {
      current = path20.join(current, part);
      if (fs22.lstatSync(current).isSymbolicLink() || !fs22.statSync(current).isDirectory()) throw new Error("Unsafe package directory");
    }
    files[name] = regular(path20.join(source, name));
  }
  verifyRelease(files, options.version);
  const location = resolveInstalledWorkflowLocation(options.vault), identity = dispositionLocation(location);
  if (source === location.installationDirectory) throw new Error("Run maintenance from a separate extracted package");
  let abandonmentEvidence;
  const assertContext = () => {
    const current = dispositionLocation(resolveInstalledWorkflowLocation(options.vault));
    if (JSON.stringify(current) !== JSON.stringify(identity)) throw new Error("Maintenance installation identity changed");
    if (fs22.existsSync(path20.join(location.runtimeDirectory, "update-pending.json"))) throw new Error("Incomplete update requires supported recovery");
    if (fs22.existsSync(location.configurationFile + ".write-lock") || fs22.readdirSync(location.installationDirectory).some((n) => n.startsWith("data.json.") && n.endsWith(".tmp")) || fs22.readdirSync(location.runtimeDirectory).some((n) => n.endsWith(".tmp") || n.endsWith(".write-lock"))) throw new Error("Unfinished write requires reconciliation");
    const catalog = JSON.parse(regular(location.configurationFile).toString("utf8"));
    if (["tasks", "workflows"].some((k) => !Array.isArray(catalog[k]) || catalog[k].some((e) => e.status === "running" || e.pendingCodexApproval))) throw new Error("Active catalog requires reconciliation");
    const checkpoints = new Map(fs22.readdirSync(location.runtimeDirectory).filter((n) => /^[a-zA-Z0-9-]+\.json$/.test(n)).map((name) => {
      const state = readExecutionCheckpoint(location.runtimeDirectory, name.slice(0, -5));
      return [state.runId, state];
    }));
    const evidence = /* @__PURE__ */ new Map();
    for (const state of checkpoints.values()) if (state.abandonment) for (const name of [state.runId + ".json", state.abandonment.snapshot]) {
      evidence.set(name, regular(path20.join(location.runtimeDirectory, name)));
    }
    if (abandonmentEvidence && (evidence.size !== abandonmentEvidence.size || [...evidence].some(([name, bytes]) => !abandonmentEvidence.get(name)?.equals(bytes)))) throw new Error("Abandonment evidence changed during maintenance");
    abandonmentEvidence ??= evidence;
    assertIdleCatalog(Object.fromEntries(["tasks", "workflows"].map((kind) => [kind, catalog[kind].filter((entry) => {
      const binding = entry.runtimeExecution;
      return binding && (!checkpoints.has(binding.runId) || checkpoints.get(binding.runId).phase === "abandoned");
    })])), checkpoints);
  };
  assertContext();
  if (fs22.existsSync(path20.join(location.runtimeDirectory, "execution.lock"))) throw new Error("Unload AutoOC normally; execution reservation is present");
  const executions = fs22.readdirSync(location.runtimeDirectory).filter((n) => /^[a-zA-Z0-9-]+\.json$/.test(n)).sort().map((name) => {
    const state = readExecutionCheckpoint(location.runtimeDirectory, name.slice(0, -5));
    if (["ready", "in_flight"].includes(state.phase)) throw new Error("Unfinished execution requires reconciliation");
    return inspectTerminalExecution({ vault: location.vault, runId: state.runId });
  });
  const installedVersion = JSON.parse(regular(path20.join(location.installationDirectory, "manifest.json")).toString("utf8")).version;
  if (!options.decisions) return { mode: "inspect", version: options.version, installedVersion, ...identity, executions, activityVerified: false };
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
    backup = path20.join(location.runtimeDirectory, "maintenance-backup-" + (0, import_crypto11.randomUUID)());
    fs22.mkdirSync(backup, { mode: 448 });
    const hashes = {};
    const save = (relative5, bytes) => {
      lease.assertOwned();
      const target = path20.join(backup, relative5);
      fs22.mkdirSync(path20.dirname(target), { recursive: true, mode: 448 });
      const fd = fs22.openSync(target, "wx", 384);
      try {
        fs22.writeFileSync(fd, bytes);
        fs22.fsyncSync(fd);
      } finally {
        fs22.closeSync(fd);
      }
      const digest = (b) => (0, import_crypto11.createHash)("sha256").update(b).digest("hex");
      if (digest(regular(target)) !== digest(bytes)) throw new Error("Maintenance backup verification failed");
      hashes[relative5] = digest(bytes);
    };
    for (const name of names) save(name, regular(path20.join(location.installationDirectory, name)));
    const catalog = regular(location.configurationFile);
    save("data.json", catalog);
    const journals = fs22.readdirSync(location.runtimeDirectory).filter((n) => /^[a-zA-Z0-9-]+\.json$/.test(n) || /^(abandonment|disposition)-[a-zA-Z0-9-]+\.snapshot$/.test(n));
    for (const name of journals) save("runtime/" + name, regular(path20.join(location.runtimeDirectory, name)));
    save("backup-integrity.json", Buffer.from(JSON.stringify({ version: installedVersion, ...identity, sha256: hashes })));
    lease.assertOwned();
    assertContext();
    if (!regular(location.configurationFile).equals(catalog)) throw new Error("Catalog changed before disposition");
    for (const d of options.decisions) {
      const state = await disposeTerminalExecution({ ...d, lease });
      applied.push({ runId: state.runId, revision: state.revision, phase: state.phase, outcome: "unknown" });
    }
    lease.assertOwned();
    assertContext();
    if (!regular(location.configurationFile).equals(catalog)) throw new Error("Catalog changed during maintenance");
    assertInstalledExecutionIdle(location.installationDirectory);
    const installed = installRelease({ directory: location.installationDirectory, version: options.version, files, lease });
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

// autooc-cli.ts
var version = "1.6.9";
async function main(args) {
  const [command, ...rest] = args;
  if (command === "maintain-release") {
    if (rest[0] !== "--vault" || !path21.isAbsolute(rest[1] || "") || !(rest.length === 3 && rest[2] === "--inspect" || rest.length === 4 && rest[2] === "--decisions")) throw new Error("Use maintain-release --vault <absolute vault> <--inspect|--decisions absolute-JSON-file>");
    return maintainRelease({ sourceDirectory: __dirname, vault: rest[1], version, decisions: rest[2] === "--decisions" ? readDecisionFile(rest[3]) : void 0 });
  }
  if (command === "inspect-terminal" || command === "dispose-terminal") {
    if (rest.length !== 4 || rest[0] !== "--vault" || !path21.isAbsolute(rest[1]) || rest[2] !== (command === "inspect-terminal" ? "--run" : "--decision")) throw new Error("Use --vault <absolute path> and --run <id> or --decision <absolute JSON file>, in that order");
    if (command === "inspect-terminal") return { version, ...inspectTerminalExecution({ vault: rest[1], runId: rest[3] }) };
    const decision = readDecisionFile(rest[3]);
    if (!decision || Array.isArray(decision) || decision.vault !== resolveInstalledWorkflowLocation(rest[1]).vault) throw new Error("Decision vault identity mismatch");
    const result = await disposeTerminalExecution({ ...decision, lease: void 0 });
    return { version, runId: result.runId, workflowId: result.workflowId, phase: result.phase, revision: result.revision, disposition: result.disposition };
  }
  if (command === "export-workflow" || command === "edit-workflow") {
    const last = command === "export-workflow" ? "--out" : "--patch";
    if (rest.length !== 6 || rest[0] !== "--vault" || rest[2] !== "--workflow" || rest[4] !== last || !path21.isAbsolute(rest[1]) || !path21.isAbsolute(rest[5])) throw new Error("Use --vault <absolute path> --workflow <id> " + last + " <absolute JSON file>, in that order");
    const location2 = resolveInstalledWorkflowLocation(rest[1]);
    if (command === "export-workflow") {
      let catalog;
      try {
        catalog = JSON.parse(fs23.readFileSync(location2.configurationFile, "utf8"));
      } catch {
        throw new Error("Cannot read valid AutoOC configuration");
      }
      const workflows = catalog.workflows?.filter((w) => w.id === rest[3]);
      if (workflows?.length !== 1) throw new Error("Workflow identity is missing or ambiguous");
      const workflow = workflows[0];
      fs23.writeFileSync(rest[5], JSON.stringify({ workflowId: workflow.id, expectedHash: workflowEditHash(workflow), definition: workflowEditDefinition(workflow) }, null, 2), { flag: "wx", mode: 384 });
      return { version, workflowId: workflow.id, expectedHash: workflowEditHash(workflow), exported: true };
    }
    const stat = fs23.lstatSync(rest[5]);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 6e4) throw new Error("Patch must be a regular JSON file of at most 60KB");
    let patch;
    try {
      patch = JSON.parse(fs23.readFileSync(rest[5], "utf8"));
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
    if (rest.length !== 6 || rest[0] !== "--vault" || !path21.isAbsolute(rest[1]) || rest[2] !== "--run" || rest[4] !== "--approval") throw new Error("Decision requires --vault, --run and exact --approval token");
    let directory = fs23.realpathSync(rest[1]);
    for (const part of [".obsidian", "plugins", "auto-oc", "runtime"]) {
      directory = path21.join(directory, part);
      const stat = fs23.lstatSync(directory);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Invalid runtime directory");
    }
    return { version, ...answerWorkflowApproval(directory, rest[3], rest[5], command === "approve") };
  }
  if (command === "recover-lease") {
    if (rest.length !== 4 || rest[0] !== "--vault" || !path21.isAbsolute(rest[1]) || rest[2] !== "--owner" || !rest[3]) throw new Error("Lease recovery requires explicit absolute vault and observed --owner identity");
    let directory = fs23.realpathSync(rest[1]);
    for (const part of [".obsidian", "plugins", "auto-oc", "runtime"]) {
      directory = path21.join(directory, part);
      const stat = fs23.lstatSync(directory);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Invalid runtime directory");
    }
    return { version, ...recoverExecutionLease(directory, rest[3]) };
  }
  if (command === "version" && !rest.length) return { version, experimental: true, capabilities: ["list", "status", "run", "resume", "reconcile", "stop", "recover-lease", "approve", "deny", "abandon", "inspect-terminal", "dispose-terminal", "maintain-release", "export-workflow", "edit-workflow"], taskSelection: true, pluginRequests: 1, workflowEditing: 1 };
  if (command === "help" && !rest.length) return { usage: "node autooc-cli.cjs <list|status> --vault <absolute-path>", execution: "<run|resume|reconcile|stop> --vault <absolute-path> <--workflow id|--task id> [--run <run-id> for resume/reconcile/stop]", recovery: "recover-lease --vault <absolute-path> --owner <observed-owner-token>", decision: "<approve|deny> --vault <absolute-path> --run <run-id> --approval <observed-token>", terminalDisposition: "inspect-terminal --vault <absolute vault> --run <id>; dispose-terminal --vault <absolute vault> --decision <absolute JSON file containing the exact inspection plus reason and acknowledgedUnknownEffects:true>. Unload plugin first. Keeps historical phase and unknown outcome.", maintenance: "maintain-release --vault <absolute vault> <--inspect|--decisions absolute-JSON-file> from a separate extracted corrected package; decisions are an array of individually reviewed inspections plus reason and acknowledgedUnknownEffects:true. Backs up and installs under one lease. Never recovers locks.", abandonment: "abandon --vault <absolute-path> --workflow <id or @task:ID> --run <run-id> --revision <observed-revision> --reason <human-decision> --acknowledge-unknown-effects true (close/disable plugin first; preserves unknown outcome, does not stop external processes)", workflowEditing: "export-workflow --vault <absolute-path> --workflow ID --out <new absolute JSON file>; edit-workflow --vault <absolute-path> --workflow ID --patch <absolute JSON file containing expectedHash and changes>. Keep Obsidian open; name/description/existing step text only.", experimental: true, foreground: true };
  if (["run", "resume", "reconcile", "stop"].includes(command)) {
    const values = /* @__PURE__ */ new Map();
    const target = rest.includes("--task") ? "--task" : "--workflow";
    const allowed = command === "run" ? ["--vault", target] : ["--vault", target, "--run"];
    if (rest.length !== allowed.length * 2) throw new Error("Execution requires explicit vault, workflow and recovery identity where applicable");
    for (let index = 0; index < rest.length; index += 2) {
      const key = rest[index], value = rest[index + 1];
      if (!allowed.includes(key) || values.has(key) || !value || value.startsWith("--")) throw new Error("Invalid execution options");
      values.set(key, value);
    }
    if (command === "stop") {
      if (!path21.isAbsolute(values.get("--vault"))) throw new Error("Explicit absolute vault required");
      let directory = fs23.realpathSync(values.get("--vault"));
      for (const part of [".obsidian", "plugins", "auto-oc", "runtime"]) {
        directory = path21.join(directory, part);
        const stat = fs23.lstatSync(directory);
        if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Invalid runtime directory");
      }
      const state = readExecutionCheckpoint(directory, values.get("--run"));
      const identity = target === "--task" ? standaloneTaskWorkflow(values.get(target)).id : values.get(target);
      if (state.workflowId !== identity) throw new Error("Execution belongs to another workflow or task");
      return { version, experimental: true, ...await requestWorkflowStop(directory, state.runId) };
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    process.on("SIGINT", abort);
    process.on("SIGTERM", abort);
    try {
      const location2 = resolveInstalledWorkflowLocation(values.get("--vault"));
      const delegated = await requestPluginExecution(location2.runtimeDirectory, {
        command,
        workflowId: values.get("--workflow"),
        taskId: values.get("--task"),
        runId: values.get("--run")
      }, controller.signal, (state) => process.stderr.write(JSON.stringify({ event: "progress", host: "obsidian", ...state }) + "\n"));
      const result = delegated || await runInstalledWorkflow({
        vault: values.get("--vault"),
        workflowId: values.get("--workflow"),
        taskId: values.get("--task"),
        resumeRunId: values.get("--run"),
        newExecution: command === "run",
        reconcile: command === "reconcile",
        signal: controller.signal,
        redact: (text) => text
      });
      if (controller.signal.aborted) process.exitCode = 130;
      else if (result.phase === "failed") process.exitCode = 1;
      return { version, experimental: true, runId: result.runId, workflowId: result.workflowId, phase: result.phase, revision: result.revision, nextStepId: result.nextStepId };
    } finally {
      process.off("SIGINT", abort);
      process.off("SIGTERM", abort);
    }
  }
  if (!["list", "status"].includes(command) || rest.length !== 2 || rest[0] !== "--vault" || !path21.isAbsolute(rest[1])) {
    throw new Error("Use help for supported commands; an explicit absolute --vault is required.");
  }
  const vault = fs23.realpathSync(rest[1]);
  let location = vault;
  for (const part of [".obsidian", "plugins", "auto-oc", "data.json"]) {
    location = path21.join(location, part);
    if (fs23.lstatSync(location).isSymbolicLink()) throw new Error("Linked installation paths are unsupported.");
  }
  if (!fs23.statSync(location).isFile()) throw new Error("Configuration is not a regular file.");
  let config;
  try {
    config = JSON.parse(fs23.readFileSync(location, "utf8"));
  } catch {
    throw new Error("Cannot read valid AutoOC configuration.");
  }
  if (!config || !Array.isArray(config.tasks) || !Array.isArray(config.workflows)) throw new Error("Invalid AutoOC catalog.");
  const summarize = (items) => items.map((item) => {
    if (!item || typeof item.id !== "string" || typeof item.name !== "string") throw new Error("Invalid catalog entry.");
    const entry = { id: item.id, name: item.name };
    if (command === "status") entry.recordedStatus = ["idle", "pending", "running", "completed", "failed", "cancelled", "abandoned"].includes(item.status) ? item.status : "unknown";
    return entry;
  });
  let runtime = {};
  if (command === "status") {
    const directory = path21.join(path21.dirname(location), "runtime");
    const executions = [];
    let executionLockPresent = false;
    let executionOwner;
    if (fs23.existsSync(directory)) {
      if (fs23.lstatSync(directory).isSymbolicLink() || !fs23.statSync(directory).isDirectory()) throw new Error("Invalid runtime directory");
      executionLockPresent = fs23.existsSync(path21.join(directory, "execution.lock"));
      if (executionLockPresent) {
        try {
          executionOwner = readExecutionLeaseOwner(directory);
        } catch {
        }
      }
      for (const file of fs23.readdirSync(directory).sort()) {
        if (!/^[a-f0-9-]+\.json$/.test(file)) continue;
        const state = readExecutionCheckpoint(directory, file.slice(0, -5));
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
  return { version, experimental: true, vault, activityVerified: false, tasks: summarize(config.tasks), workflows: summarize(config.workflows), ...runtime };
}
main(process.argv.slice(2)).then((result) => {
  process.stdout.write(JSON.stringify(result) + "\n");
}).catch((error) => {
  const message = error instanceof Error && !error.code ? error.message : "Cannot read the selected AutoOC installation.";
  const code = error?.code;
  process.stderr.write(JSON.stringify({ error: message, ...typeof code === "string" && /^[A-Z][A-Z0-9_]+$/.test(code) ? { errorCode: code } : {} }) + "\n");
  process.exitCode = 1;
});
