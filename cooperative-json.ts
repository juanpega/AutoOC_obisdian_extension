// Keep the JSON format, but yield to input/timers inside large individual fields.
// No workers, extra distribution files, or synchronous fallback on errors.
import { createHash } from "crypto";
import { setImmediate } from "timers";
import { performance } from "perf_hooks";
import { types } from "util";
const CHUNK = 16 * 1024;
const invalid = () => new SyntaxError("Cannot read valid AutoOC configuration");

async function run<T>(work: Generator<void, T, void>): Promise<T> {
  let deadline = performance.now() + 4;
  for (;;) {
    const next = work.next();
    if (next.done) return next.value;
    if (performance.now() >= deadline) {
      await new Promise<void>(resolve => setImmediate(resolve));
      deadline = performance.now() + 4;
    }
  }
}

export async function parseCooperatively(text: string): Promise<any> {
  let offset = 0, budget = CHUNK;
  // Repeated code/text fields must not repeatedly allocate decoded chunks.
  // This cache belongs only to this parse, is bounded in UTF-16 bytes, and
  // shares immutable strings only. Stored JSON and mutable objects are intact.
  const decoded = new Map<string, string>();
  let decodedSize = 0;
  const strings = new Map<string, string>();
  let stringsSize = 0;
  function decode(source: string): string {
    const previous = decoded.get(source);
    if (previous !== undefined) return previous;
    const value: string = JSON.parse('"' + source + '"');
    const size = 2 * (source.length + value.length);
    if (decodedSize + size <= 1024 * 1024 && decoded.size < 1024) {
      decoded.set(source, value);
      decodedSize += size;
    }
    return value;
  }
  function* step(): Generator<void, void, void> {
    if (--budget <= 0) { budget = CHUNK; yield; }
  }
  function* whitespace(): Generator<void, void, void> {
    while (offset < text.length && /[\x20\t\r\n]/.test(text[offset])) {
      offset++; yield* step();
    }
  }
  function* string(): Generator<void, string, void> {
    if (text[offset++] !== '"') throw invalid();
    const start = offset, boundaries: number[] = [];
    let chunkStart = start;
    while (offset < text.length) {
      const char = text.charCodeAt(offset++);
      if (char === 34) {
        const end = offset - 1, length = end - start;
        // Reuse before decoding/joining, not after allocating another full
        // field. A hit is byte-for-byte identical to previously valid JSON.
        // Bound lookup work and both caches, including their entry counts.
        const encoded = length >= CHUNK && length <= 4 * 1024 * 1024 ? text.slice(start, end) : undefined;
        const previous = encoded === undefined ? undefined : strings.get(encoded);
        if (previous !== undefined) return previous;
        const pieces: string[] = [];
        chunkStart = start;
        for (const boundary of boundaries) {
          pieces.push(decode(text.slice(chunkStart, boundary)));
          chunkStart = boundary;
          yield;
        }
        pieces.push(decode(text.slice(chunkStart, end)));
        const value = pieces.join("");
        const size = encoded === undefined ? 0 : 2 * (encoded.length + value.length);
        if (encoded !== undefined && strings.size < 1024 && stringsSize + size <= 16 * 1024 * 1024) {
          strings.set(encoded, value);
          stringsSize += size;
        }
        return value;
      }
      if (char < 32) throw invalid();
      if (char === 92) {
        // Keep complete escapes in a chunk; JSON.parse validates their grammar.
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
  type Frame = {array: boolean; result: any; state: "first" | "key" | "value" | "separator"; key?: string};
  const stack: Frame[] = [];
  let root: any;
  function accept(item: any) {
    const parent = stack[stack.length - 1];
    if (!parent) { root = item; return; }
    if (parent.array) parent.result.push(item);
    else Object.defineProperty(parent.result, parent.key!, {value:item,writable:true,enumerable:true,configurable:true});
    parent.state = "separator";
  }
  function* value(): Generator<void, void, void> {
    yield* whitespace();
    const char = text[offset];
    if (char === '"') { accept(yield* string()); return; }
    if (char === "{" || char === "[") {
      const array = char === "[", result = array ? [] : {};
      accept(result); offset++;
      stack.push({array,result,state:"first"});
      return;
    }
    const start = offset;
    while (offset < text.length && !/[\x20\t\r\n,\]}]/.test(text[offset])) {
      offset++; yield* step();
    }
    if (offset === start) throw invalid();
    accept(JSON.parse(text.slice(start, offset)));
  }
  try {
    return await run((function* () {
      yield* value();
      while (stack.length) {
        yield* step(); yield* whitespace();
        const frame = stack[stack.length - 1], end = frame.array ? "]" : "}";
        if (frame.state === "first" && text[offset] === end) { offset++; stack.pop(); continue; }
        if (frame.state === "separator") {
          const separator = text[offset++];
          if (separator === end) { stack.pop(); continue; }
          if (separator !== ",") throw invalid();
          frame.state = frame.array ? "value" : "key";
          continue;
        }
        if (!frame.array && (frame.state === "first" || frame.state === "key")) {
          frame.key = yield* string(); yield* whitespace();
          if (text[offset++] !== ":") throw invalid();
          frame.state = "value";
          continue;
        }
        yield* value();
      }
      yield* whitespace();
      if (offset !== text.length) throw invalid();
      return root;
    })());
  } catch { throw invalid(); }
}

export function captureJsonStructure(value: unknown, space: 0 | 2 = 2): {skeleton: string; strings: string[]} {
  // Capture the structure synchronously at the queue's snapshot boundary. Large
  // immutable strings are retained by reference, never cloned or encoded here.
  // Native JSON handles toJSON, undefined, non-finite values, order and cycles.
  const strings: string[] = [];
  const skeleton = JSON.stringify(value, (_key, item) => {
    // JSON unboxes String objects AFTER calling the replacer. Capture their
    // native ToString value now, including other realms and custom conversion,
    // so a user string can never masquerade as one of our internal markers.
    if (types.isStringObject(item)) item = String(item);
    if (typeof item !== "string") return item;
    const index = strings.push(item) - 1;
    return `@autooc-string-${index}`;
  }, space);
  if (skeleton === undefined) throw new Error("Settings are not serializable");
  return {skeleton, strings};
}

export function matchesJsonStructure(value: unknown, captured: ReturnType<typeof captureJsonStructure>): boolean {
  const current = captureJsonStructure(value);
  return current.skeleton === captured.skeleton && current.strings.length === captured.strings.length &&
    current.strings.every((item, index) => item === captured.strings[index]);
}

// Clone only the JSON structure; immutable large strings are shared. This
// prevents UI mutations from aliasing a catalog confirmed by the writer.
export function cloneJsonStructure(value: unknown): any {
  return cloneCapturedJson(captureJsonStructure(value));
}

export function cloneCapturedJson({skeleton, strings}: ReturnType<typeof captureJsonStructure>): any {
  return JSON.parse(skeleton, (_key, item) => typeof item === "string" && /^@autooc-string-\d+$/.test(item)
    ? strings[Number(item.slice(15))] : item);
}

export function encodeCapturedJson({skeleton, strings}: ReturnType<typeof captureJsonStructure>): Generator<string, void, void> {
  return (function* () {
    // Every string value is a marker. A matching property key is left intact.
    const markers = /"@autooc-string-(\d+)"(?!\s*:)/g;
    let previous = 0, match: RegExpExecArray | null;
    while ((match = markers.exec(skeleton))) {
      yield skeleton.slice(previous, match.index);
      yield '"';
      const source = strings[Number(match[1])];
      for (let start = 0; start < source.length;) {
        let end = Math.min(start + CHUNK, source.length);
        // Preserve paired surrogates across chunk boundaries (well-formed JSON).
        if (end < source.length && source.charCodeAt(end - 1) >= 0xd800 && source.charCodeAt(end - 1) <= 0xdbff &&
            source.charCodeAt(end) >= 0xdc00 && source.charCodeAt(end) <= 0xdfff) end--;
        yield JSON.stringify(source.slice(start, end)).slice(1, -1);
        start = end;
      }
      yield '"';
      previous = markers.lastIndex;
    }
    yield skeleton.slice(previous);
  })();
}

async function consume(parts: Generator<string, void, void>, accept: (part: string) => void): Promise<void> {
  await run((function* () {
    for (const part of parts) { accept(part); yield; }
  })());
}

export async function stringifyCooperatively(value: unknown): Promise<string> {
  const source = encodeCapturedJson(captureJsonStructure(value)), parts: string[] = [];
  await consume(source, part => parts.push(part));
  return parts.join("");
}

export async function hashJsonCooperatively(value: unknown): Promise<string> {
  const source = encodeCapturedJson(captureJsonStructure(value)), hash = createHash("sha256");
  await consume(source, part => { hash.update(part, "utf8"); });
  return hash.digest("hex");
}

export async function hashTextCooperatively(text: string): Promise<string> {
  const hash = createHash("sha256");
  await consume((function* () {
    for (let start = 0; start < text.length;) {
      let end = Math.min(start + CHUNK, text.length);
      if (end < text.length && text.charCodeAt(end - 1) >= 0xd800 && text.charCodeAt(end - 1) <= 0xdbff &&
          text.charCodeAt(end) >= 0xdc00 && text.charCodeAt(end) <= 0xdfff) end--;
      yield text.slice(start, end);
      start = end;
    }
  })(), part => { hash.update(part, "utf8"); });
  return hash.digest("hex");
}
