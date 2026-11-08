/*! @xterm/xterm
Copyright (c) 2017-2019, The xterm.js authors (https://github.com/xtermjs/xterm.js)
Copyright (c) 2014-2016, SourceLair Private Company (https://www.sourcelair.com)
Copyright (c) 2012-2013, Christopher Jeffrey (https://github.com/chjj/)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/
/*! @xterm/addon-fit
Copyright (c) 2019, The xterm.js authors (https://github.com/xtermjs/xterm.js)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// autooc-runtime.ts
var autooc_runtime_exports = {};
__export(autooc_runtime_exports, {
  RELEASE_DESCRIPTOR: () => RELEASE_DESCRIPTOR,
  RELEASE_FILES: () => RELEASE_FILES,
  abandonInstalledExecution: () => abandonInstalledExecution,
  acquireExecutionLease: () => acquireExecutionLease,
  answerWorkflowApproval: () => answerWorkflowApproval,
  combineWorkflowTaskAdapters: () => combineWorkflowTaskAdapters,
  createCodeWorkflowAdapter: () => createCodeWorkflowAdapter,
  createCodexWorkflowAdapter: () => createCodexWorkflowAdapter,
  createWorkflowEvaluator: () => createWorkflowEvaluator,
  createWorkflowTaskAdapter: () => createWorkflowTaskAdapter,
  disposeTerminalExecution: () => disposeTerminalExecution,
  executionCoordinator: () => executionCoordinator,
  inspectTerminalExecution: () => inspectTerminalExecution,
  installRelease: () => installRelease,
  maintainRelease: () => maintainRelease,
  persistWorkflowProgress: () => persistWorkflowProgress,
  prepareWorkflowDefinition: () => prepareWorkflowDefinition,
  readExecutionLeaseOwner: () => readExecutionLeaseOwner,
  recoverExecutionLease: () => recoverExecutionLease,
  requestWorkflowStop: () => requestWorkflowStop,
  resolveInstalledWorkflowLocation: () => resolveInstalledWorkflowLocation,
  runCodeWorkflowHost: () => runCodeWorkflowHost,
  runInstalledWorkflow: () => runInstalledWorkflow,
  validateConcurrency: () => validateConcurrency,
  verifyRelease: () => verifyRelease
});
module.exports = __toCommonJS(autooc_runtime_exports);

// workflow-definition.ts
var import_crypto2 = require("crypto");

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
      await new Promise((resolve8) => (0, import_timers.setImmediate)(resolve8));
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
  const expand = (workflow, path26, returnId, enterId, inheritedBranch = false) => {
    const ids = new Map(workflow.steps.map((step) => [step.id, path26.length ? internal([...path26, step.id]) : step.id]));
    const entries = new Map(workflow.steps.map((step) => [step.id, step.stepKind === "workflow" ? internal([...path26, step.id, "enter"]) : ids.get(step.id)]));
    for (const [index, source] of workflow.steps.entries()) {
      const id = ids.get(source.id);
      const scope = { workflow, path: path26, localId: source.id, rootStepId: path26[0] || source.id, returnId, enterId, handoffBranch: inheritedBranch || !!workflow.handoffBranch };
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
        const childEntry = expand(child, [...path26, source.id], id, entryId, scope.handoffBranch);
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
  const clean = (w) => ({ ...withoutRuntime(w), steps: w.steps.map((s) => withoutRuntime(s)) });
  return canonical({ workflow: clean(workflow), ...children.length ? { workflows: children.map(clean) } : {}, tasks: selected, settings: effectiveSettings });
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
  const digest = (0, import_crypto2.createHash)("sha256");
  for (const part of encodeCapturedJson(captureJsonStructure(payload, 0))) digest.update(part, "utf8");
  const hash = digest.digest("hex");
  return freeze({ ...withAvailability(payload, workflow, tasks, settings.workflows), hash, admissionSettings: concurrencySettings(settings) });
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
  const relative6 = path.relative(physicalPath(root), physicalPath(location));
  return relative6 !== ".." && !relative6.startsWith(".." + path.sep) && !path.isAbsolute(relative6);
}

// catalog-transaction.ts
var path2 = __toESM(require("path"));
var tails = /* @__PURE__ */ new Map();
var owners = /* @__PURE__ */ new WeakMap();
function catalogTransaction(file, operation, transaction) {
  const key = path2.join(physicalPath(path2.dirname(file)), path2.basename(file));
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

// execution-coordinator.ts
var fs4 = __toESM(require("fs"));
var path5 = __toESM(require("path"));
var import_child_process2 = require("child_process");

// execution-journal.ts
var fs3 = __toESM(require("fs"));
var path4 = __toESM(require("path"));
var import_crypto4 = require("crypto");
var import_util2 = require("util");

// settings-writer.ts
var fs2 = __toESM(require("fs"));
var path3 = __toESM(require("path"));
var import_crypto3 = require("crypto");
var import_string_decoder = require("string_decoder");
var import_perf_hooks2 = require("perf_hooks");
var import_timers2 = require("timers");
var import_child_process = require("child_process");
var uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
async function settingsProcessStart(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return null;
  try {
    if (process.platform === "linux") {
      const text = await fs2.promises.readFile(`/proc/${pid}/stat`, "utf8");
      const ticks = text.slice(text.lastIndexOf(")") + 2).split(" ")[19];
      const boot = (await fs2.promises.readFile("/proc/sys/kernel/random/boot_id", "utf8")).trim();
      return /^\d+$/.test(ticks) ? `linux:${boot}:${ticks}` : null;
    }
    const systemRoot = process.env.SystemRoot || "C:\\Windows";
    if (process.platform === "win32" && !path3.isAbsolute(systemRoot)) return null;
    const executable2 = process.platform === "win32" ? path3.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe") : "/bin/ps";
    const args = process.platform === "win32" ? ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToUniversalTime().Ticks.ToString()`] : ["-p", String(pid), "-o", "lstart="];
    if (process.platform !== "win32" && process.platform !== "darwin") return null;
    const value = await new Promise((resolve8, reject) => (0, import_child_process.execFile)(
      executable2,
      args,
      { windowsHide: true, timeout: 5e3, maxBuffer: 4096 },
      (error, stdout) => error ? reject(error) : resolve8(stdout.trim())
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
function parseSettingsWriteLock(text) {
  if (uuid.test(text)) return { token: text, legacy: true };
  let value;
  try {
    value = JSON.parse(text);
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
  const stat = fs2.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 16384) throw new Error("Unsafe settings write lock");
  return parseSettingsWriteLock(fs2.readFileSync(file, "utf8")).token;
}
function assertNoSettingsRecovery(directory) {
  try {
    fs2.lstatSync(path3.join(directory, "runtime", "lease-recovery.lock"));
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  throw new Error("Settings recovery guard requires reconciliation");
}
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
  if (path3.basename(file) !== "data.json") return;
  const directory = path3.dirname(file), runtime = path3.join(directory, "runtime"), ownerFile = path3.join(runtime, "execution.lock", "owner.json");
  let ownerText;
  try {
    ownerText = regularIntentText(ownerFile);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  const owner = JSON.parse(ownerText);
  const ownerDirectoryIdentity = settingsDirectoryIdentity(path3.dirname(ownerFile));
  let ownerStat = fs2.lstatSync(ownerFile);
  if (owner?.schemaVersion !== 1 || owner.pid !== process.pid || !/^[a-f0-9-]{36}$/.test(owner.token || "") || !Number.isFinite(Date.parse(owner.createdAt))) throw new Error("Settings writer does not own the execution lease");
  const leaseOwner = { schemaVersion: 1, token: owner.token, pid: owner.pid, createdAt: owner.createdAt };
  const intent = { schemaVersion: 1, token, directoryIdentity: settingsDirectoryIdentity(directory), runtimeIdentity: settingsDirectoryIdentity(runtime), owner: leaseOwner, originalHash };
  const intentFile = file + ".write-intent", updateFile = intentFile + "." + token + ".tmp";
  let published;
  const assertOwned = () => {
    const currentOwnerStat = fs2.lstatSync(ownerFile);
    if (currentOwnerStat.dev !== ownerStat.dev || currentOwnerStat.ino !== ownerStat.ino || currentOwnerStat.size !== ownerStat.size || currentOwnerStat.mtimeMs !== ownerStat.mtimeMs || currentOwnerStat.ctimeMs !== ownerStat.ctimeMs || settingsDirectoryIdentity(path3.dirname(ownerFile)) !== ownerDirectoryIdentity || regularIntentText(ownerFile) !== ownerText || settingsWriteLockToken(file + ".write-lock") !== token || settingsDirectoryIdentity(directory) !== intent.directoryIdentity || settingsDirectoryIdentity(runtime) !== intent.runtimeIdentity) throw new Error("Settings intent ownership changed");
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
        await new Promise((resolve8) => setTimeout(resolve8, 50 * (attempt + 1)));
      }
    }
  };
  const publishOwnerAnchor = async (hash) => {
    assertOwned();
    const next = JSON.parse(ownerText);
    if (hash) next.settingsWriteIntent = { token, sha256: hash };
    else delete next.settingsWriteIntent;
    const nextText = JSON.stringify(next), temporary = path3.join(path3.dirname(ownerFile), "owner.settings-intent." + token + ".tmp");
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
    await publishOwnerAnchor((0, import_crypto3.createHash)("sha256").update(text, "utf8").digest("hex"));
  };
  await publish(true);
  return {
    async prepared(temporary, preparedHash) {
      intent.temporary = path3.basename(temporary);
      if (preparedHash) intent.preparedHash = preparedHash;
      await publish();
    },
    async finish() {
      assertOwned();
      const current = await settingsFingerprint(file);
      if (current !== intent.originalHash && current !== intent.preparedHash || fs2.existsSync(updateFile) || intent.temporary && fs2.existsSync(path3.join(directory, intent.temporary))) throw new Error("Settings write evidence retained for recovery");
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
    for (const [file, version] of this.observed) fork.observed.set(file, { ...version });
    for (const [file, value] of this.cached) fork.cached.set(file, cloneJsonStructure(value));
    return fork;
  }
  confirmedVersion(file) {
    const version = this.observed.get(path3.resolve(file));
    if (!version) throw new Error("Catalog has no confirmed version");
    return { ...version };
  }
  adoptConfirmed(file, version, accept) {
    this.pending++;
    const operation = this.tail.then(async () => {
      if (!version.textHash || !/^[a-f0-9]{64}$/.test(version.textHash) || version.valueHash !== version.textHash || await settingsFingerprint(file) !== version.textHash) {
        throw new Error("AutoOC confirmed catalog changed externally; reload before saving");
      }
      if (!accept()) throw new Error("AutoOC settings changed while loading; reload before saving");
      this.observed.set(path3.resolve(file), { ...version });
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
    const text = readSettingsText(file);
    const value = parseSettings(text);
    const hash = (source) => (0, import_crypto3.createHash)("sha256").update(source, "utf8").digest("hex");
    this.observed.set(path3.resolve(file), {
      textHash: text === null ? null : hash(text),
      valueHash: text === null ? null : hash(JSON.stringify(value, null, 2))
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
      let text = await readSettingsTextAsync(file);
      const value = text === null ? null : await parseCooperatively(text);
      const missing = text === null, textHash = missing ? null : await hashTextCooperatively(text);
      text = null;
      const version = { textHash, valueHash: missing ? null : await hashJsonCooperatively(value) };
      if (!accept()) throw new Error("AutoOC settings changed while loading; reload before saving");
      this.observed.set(file, version);
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
      file = path3.resolve(file);
      await fs2.promises.mkdir(path3.dirname(file), { recursive: true });
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
      const descriptor = fs2.openSync(lock, "wx", 384);
      let lockStat;
      let intent;
      try {
        lockStat = fs2.fstatSync(descriptor);
        fs2.writeFileSync(descriptor, lockText);
        await new Promise((resolve8, reject) => fs2.fsync(descriptor, (error) => error ? reject(error) : resolve8()));
      } finally {
        fs2.closeSync(descriptor);
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
        if (fs2.lstatSync(lock).isSymbolicLink() || fs2.readFileSync(lock, "utf8") !== lockText) {
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
          assertNoSettingsRecovery(path3.dirname(file));
          if (fs2.lstatSync(lock).isSymbolicLink() || fs2.readFileSync(lock, "utf8") !== lockText) {
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
          const currentLock = fs2.lstatSync(lock);
          if (currentLock.isSymbolicLink() || currentLock.dev !== lockStat.dev || currentLock.ino !== lockStat.ino || currentLock.birthtimeMs !== lockStat.birthtimeMs || fs2.readFileSync(lock, "utf8") !== lockText) {
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
    return new Promise((resolve8) => (0, import_timers2.setImmediate)(() => {
      started = import_perf_hooks2.performance.now();
      resolve8();
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
    const buffer = Buffer.allocUnsafe(256 * 1024), hash = (0, import_crypto3.createHash)("sha256"), budget = ioBudget();
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
        await new Promise((resolve8) => (0, import_timers2.setImmediate)(resolve8));
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
        await new Promise((resolve8) => (0, import_timers2.setImmediate)(resolve8));
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
  await io.mkdir(path3.dirname(file), { recursive: true });
  let handle;
  const hash = (0, import_crypto3.createHash)("sha256");
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
        await new Promise((resolve8) => setTimeout(resolve8, 50 * (attempt + 1)));
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
function readExecutionCheckpoint(directory, runId) {
  if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error("Invalid execution identity");
  const file = path4.join(directory, runId + ".json");
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
    const d = state.abandonment, snapshot = path4.join(directory, d.snapshot);
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
    const snapshot = path4.join(directory, d.snapshot), stat2 = fs3.lstatSync(snapshot);
    if (!stat2.isFile() || stat2.isSymbolicLink() || stat2.nlink !== 1) throw new Error("Unsafe disposition snapshot");
    const original = fs3.readFileSync(snapshot);
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
  constructor(lease, file, state) {
    this.lease = lease;
    this.file = file;
    this.state = state;
  }
  static async create(lease, workflowId, definitionHash, entryStep) {
    lease.assertOwned();
    const state = { schemaVersion: 1, runId: (0, import_crypto4.randomUUID)(), workflowId, definitionHash, revision: 0, createdAt: (/* @__PURE__ */ new Date()).toISOString(), phase: "ready", nextStepId: entryStep, steps: [] };
    validateExecutionCheckpoint(state);
    const file = path4.join(lease.directory, state.runId + ".json");
    if (fs3.existsSync(file)) throw new Error("Execution identity already exists");
    await atomicSettingsWrite(file, state);
    lease.assertOwned();
    return new _ExecutionJournal(lease, file, state);
  }
  static open(lease, runId, definitionHash) {
    lease.assertOwned();
    if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error("Invalid execution identity");
    const file = path4.join(lease.directory, runId + ".json");
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
      const snapshot = `disposition-${state.runId}-${state.revision}.snapshot`, file = path4.join(this.lease.directory, snapshot);
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
          const snapshot = path4.join(this.lease.directory, d.snapshot), stat2 = fs3.lstatSync(snapshot);
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

// execution-coordinator.ts
function resources(definition, vault) {
  const { workflow, tasks, settings } = definition;
  const workflows = [workflow, ...definition.workflows || []];
  for (const item of [...workflows, ...tasks]) validateConcurrency(item);
  const standalone = workflow.id.startsWith("@task:");
  const policy = (standalone ? tasks[0]?.concurrency : workflow.concurrency) ?? concurrencySettings(definition.admissionSettings || {}).defaultConcurrency;
  const result = { exclusive: policy === "exclusive" || workflows.some((w) => !!w.handoffBranch || w.concurrency === "exclusive"), sharedWorkspace: policy === "parallel" && !workflows.some((w) => w.concurrency === "independent"), tasks: new Set(tasks.map((t) => t.id)), workflows: new Set(workflows.map((w) => w.id)), directories: [], repositories: /* @__PURE__ */ new Set() };
  for (const item of [...workflows.flatMap((w) => w.steps).filter((s) => s.stepKind === "code"), ...tasks]) {
    if (item.branch || workflow.handoffBranch) result.exclusive = true;
    if (item.interactiveTerminal || item.taskKind === void 0 && item.stepKind !== "code" && settings.defaultInteractiveTerminal) result.exclusive = true;
    if (item.stepKind === "code" || item.taskKind === "code") {
      if (!result.sharedWorkspace && (item.codeAllowVault || item.codeAllowFiles || item.codeAllowTerminal)) result.exclusive = true;
      continue;
    }
    const directory = physicalPath(item.workingDirectory || settings.workingDirectory || vault);
    result.directories.push(directory);
    let parent = directory, gitRoot;
    for (; ; ) {
      if (fs4.existsSync(path5.join(parent, ".git"))) {
        gitRoot = parent;
        break;
      }
      const next = path5.dirname(parent);
      if (next === parent) break;
      parent = next;
    }
    if (gitRoot) {
      const common = (0, import_child_process2.execFileSync)("git", ["-c", `safe.directory=${gitRoot.replace(/\\/g, "/")}`, "rev-parse", "--git-common-dir"], { cwd: gitRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true }).trim();
      result.repositories.add(physicalPath(path5.resolve(gitRoot, common)));
    }
  }
  if (!result.sharedWorkspace && workflows.some((w) => w.steps.some((s) => s.transitionMode === "eval" || s.transitions?.some((t) => t.mode === "eval")))) result.exclusive = true;
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
    const current = resources(definition, this.vault);
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
  admit(definition, vault, resumeRunId) {
    this.lease.assertOwned();
    const requested = resources(definition, vault);
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
      if (!canShareWorkspace(requested, current.resources) && (requested.directories.some((a) => current.resources.directories.some((b) => isWithinPhysicalPath(a, b) || isWithinPhysicalPath(b, a))) || [...requested.repositories].some((a) => [...current.resources.repositories].some((b) => samePhysicalPath(a, b))))) throw new Error("Execution resource is occupied (workspace or Git repository)");
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
var fs7 = __toESM(require("fs"));

// execution-lease.ts
var fs5 = __toESM(require("fs"));
var path6 = __toESM(require("path"));
var import_crypto5 = require("crypto");
function acquireExecutionLease(runtimeDirectory) {
  const root = fs5.realpathSync(runtimeDirectory);
  if (fs5.existsSync(path6.join(root, "update-pending.json"))) throw new Error("Incomplete plugin update requires recovery before execution");
  const recovery = path6.join(root, "lease-recovery.lock");
  if (fs5.existsSync(recovery)) throw new Error("Execution lease recovery is in progress");
  const lock = path6.join(root, "execution.lock");
  const ownerPath = path6.join(lock, "owner.json");
  const token = (0, import_crypto5.randomUUID)();
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
  const root = fs5.realpathSync(runtimeDirectory), lock = path6.join(root, "execution.lock"), file = path6.join(lock, "owner.json");
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
  const root = fs5.realpathSync(runtimeDirectory), guard = path6.join(root, "lease-recovery.lock");
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
    if (fs5.existsSync(path6.join(root, archived))) throw new Error("Recovery archive already exists");
    fs5.renameSync(path6.join(root, "execution.lock"), path6.join(root, archived));
    return { recovered: true, archived, executionsResumed: false };
  } finally {
    fs5.rmdirSync(guard);
  }
}

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
  const fs26 = require("fs");
  const path26 = require("path");
  const vm2 = require("vm");
  const vaultBase = options.vaultBase;
  const defaultCwd = options.cwd;
  const resolveInVault = (p) => {
    const root = fs26.realpathSync(vaultBase);
    const resolved = path26.resolve(root, p || ".");
    if (resolved !== root && !resolved.startsWith(root + path26.sep)) {
      throw new Error(`Path escapes vault: ${p}`);
    }
    let current = root;
    for (const component of path26.relative(root, resolved).split(path26.sep).filter(Boolean)) {
      current = path26.join(current, component);
      try {
        if (fs26.lstatSync(current).isSymbolicLink()) throw new Error("Linked vault paths are unsupported");
      } catch (error) {
        if (error.code === "ENOENT") break;
        throw error;
      }
    }
    return resolved;
  };
  const readText = (p) => fs26.readFileSync(p, "utf8");
  const writeText = (p, content) => {
    fs26.mkdirSync(path26.dirname(p), { recursive: true });
    fs26.writeFileSync(p, String(content), "utf8");
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
        fs26.mkdirSync(path26.dirname(full), { recursive: true });
        fs26.appendFileSync(full, String(content), "utf8");
        options.onVaultMutation?.({ path: full, operation: "append" });
        return full;
      },
      exists: (p) => fs26.existsSync(resolveInVault(p)),
      list: (p = ".") => fs26.readdirSync(resolveInVault(p))
    };
  }
  if (options.codeAllowFiles) {
    sandbox.files = {
      cwd: defaultCwd,
      resolve: (p) => path26.isAbsolute(p) ? path26.resolve(p) : path26.resolve(defaultCwd, p || "."),
      read: (p) => readText(path26.isAbsolute(p) ? path26.resolve(p) : path26.resolve(defaultCwd, p)),
      write: (p, content) => writeText(path26.isAbsolute(p) ? path26.resolve(p) : path26.resolve(defaultCwd, p), content),
      append: (p, content) => {
        const full = path26.isAbsolute(p) ? path26.resolve(p) : path26.resolve(defaultCwd, p);
        fs26.mkdirSync(path26.dirname(full), { recursive: true });
        fs26.appendFileSync(full, String(content), "utf8");
        return full;
      },
      exists: (p) => fs26.existsSync(path26.isAbsolute(p) ? path26.resolve(p) : path26.resolve(defaultCwd, p)),
      list: (p = ".") => fs26.readdirSync(path26.isAbsolute(p) ? path26.resolve(p) : path26.resolve(defaultCwd, p))
    };
  }
  if (options.codeAllowTerminal) {
    const { execSync } = require("child_process");
    sandbox.terminal = {
      run: (command, options2 = {}) => execSync(String(command), {
        cwd: options2.cwd ? path26.isAbsolute(options2.cwd) ? options2.cwd : path26.resolve(defaultCwd, options2.cwd) : defaultCwd,
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
  const fs26 = require("fs");
  const path26 = require("path");
  const directories = (process.env.PATH || process.env.Path || "").split(path26.delimiter).map((directory) => directory.trim().replace(/^"|"$/g, "")).filter((directory) => path26.isAbsolute(directory));
  if (process.platform === "win32") {
    for (const base of [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]]) {
      if (base && path26.isAbsolute(base)) directories.push(path26.join(base, "nodejs"));
    }
  } else directories.push("/opt/homebrew/bin", "/usr/local/bin", "/usr/bin");
  for (const directory of directories) {
    const file = path26.join(directory, process.platform === "win32" ? "node.exe" : "node");
    try {
      if (fs26.statSync(file).isFile()) {
        fs26.accessSync(file, fs26.constants.X_OK);
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
  const closedPromise = new Promise((resolve8) => child.once("close", () => {
    closed = true;
    resolve8();
  }));
  child.stderr?.on("data", (chunk) => {
    diagnostic = (diagnostic + String(chunk)).slice(-2e3);
  });
  const stop = () => {
    if (!child.pid || closed || child.exitCode !== null || child.signalCode !== null) return;
    if (signal?.aborted && process.platform === "win32") {
      const path26 = require("path");
      const system = process.env.SystemRoot || "C:\\Windows";
      const killer = spawn4(path26.join(system, "System32", "taskkill.exe"), ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
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
    return await new Promise((resolve8, reject) => {
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
          else if (message.type === "result") resolve8(message.output);
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
  return new Promise((resolve8, reject) => {
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
          resolve8();
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
async function reconcileWorkflowTask(journal, definition, read, host) {
  const state = journal.snapshot();
  const verified = prepareWorkflowDefinition(definition.workflow, definition.tasks, { ...definition.settings, workflows: definition.workflows });
  const plan = workflowExecutionPlan(verified);
  if (verified.hash !== definition.hash || state.definitionHash !== verified.hash || state.workflowId !== verified.workflow.id) throw new Error("Recovery definition mismatch");
  if (state.phase !== "in_flight") return state;
  const step = state.steps[state.steps.length - 1];
  if (!step.codexThreadId || !step.codexTurnId) throw new Error("Exact Codex identity is unavailable; manual reconciliation required");
  const result = await read(step.codexThreadId, step.codexTurnId);
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
var path7 = __toESM(require("path"));
var import_child_process3 = require("child_process");
function validateBranchOptions(task) {
  if (task.branch !== void 0 && typeof task.branch !== "string") throw new Error("Branch must be a string");
  if (task.createBranch !== void 0 && typeof task.createBranch !== "boolean") throw new Error("createBranch must be boolean");
  if (task.createBranch && !task.branch?.trim()) throw new Error("Creating a branch requires its name");
  if (task.branch?.trim()) {
    try {
      (0, import_child_process3.execFileSync)("git", ["check-ref-format", "--branch", task.branch], { stdio: "ignore", windowsHide: true });
    } catch {
      throw new Error("Invalid Git branch name");
    }
    if (task.branch.startsWith("-") || task.branch.includes("@{")) throw new Error("Invalid Git branch name");
  }
}
function git(cwd, args) {
  try {
    const output = (0, import_child_process3.execFileSync)("git", ["-c", `safe.directory=${cwd.replace(/\\/g, "/")}`, ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    return args.includes("-z") ? output : output.trim();
  } catch {
    throw new Error("Git branch operation failed; working tree preserved, no forced checkout or cleanup");
  }
}
function branchRepository(cwd, vault) {
  const directory = physicalPath(git(physicalPath(cwd), ["rev-parse", "--show-toplevel"]));
  if (!isWithinPhysicalPath(vault, directory)) throw new Error("Git repository is outside the selected vault");
  const metadata = physicalPath(git(directory, ["rev-parse", "--absolute-git-dir"]));
  const common = physicalPath(path7.resolve(directory, git(directory, ["rev-parse", "--git-common-dir"])));
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
var fs6 = __toESM(require("fs"));
var path8 = __toESM(require("path"));
var import_crypto6 = require("crypto");
function responseFile(directory, runId, token) {
  if (!/^[a-f0-9-]+$/.test(token)) throw new Error("Invalid approval identity");
  return path8.join(directory, `${runId}-${token}.approval.json`);
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
  fs6.writeFileSync(responseFile(directory, runId, token), JSON.stringify({ runId, token, approved }), { encoding: "utf8", flag: "wx", mode: 384 });
  return { runId, approval: token, decision: approved ? "approve" : "deny", recorded: true };
}
async function awaitWorkflowApproval(journal, directory, request, redact, signal, onCheckpoint) {
  const token = (0, import_crypto6.randomUUID)(), runId = journal.snapshot().runId;
  const ownerToken = readExecutionLeaseOwner(directory).token;
  await journal.recordApproval({ token, ownerToken, requestId: request.requestId, kind: request.kind, summary: redact(request.summary) });
  await onCheckpoint?.(journal.snapshot());
  const file = responseFile(directory, runId, token);
  const approved = await new Promise((resolve8, reject) => {
    const finish = (error, value) => {
      clearInterval(timer);
      signal?.removeEventListener("abort", abort);
      error ? reject(error) : resolve8(value);
    };
    const abort = () => finish(new Error("Approval interrupted; execution requires reconciliation"));
    const timer = setInterval(() => {
      try {
        if (!fs6.existsSync(file)) return;
        const stat = fs6.lstatSync(file);
        if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Invalid approval response file");
        const response = JSON.parse(fs6.readFileSync(file, "utf8"));
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
function supportsSharedWorkflow(definition, tasks) {
  assertWorkflowDependencies(definition.workflow, definition.tasks, definition.workflows);
  return !definition.workflow.requiresAutoOCSecrets && !definition.tasks.some((task) => task.requiresAutoOCSecrets) && ![definition.workflow, ...definition.workflows || []].some((w) => w.steps.some((step) => !["code", "delay", "task", "workflow"].includes(step.stepKind || "task"))) && definition.tasks.every((task) => !!tasks?.supports(task));
}
async function runCodeWorkflowHost(options) {
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
      const publish = options.onCheckpoint;
      options = { ...options, onCheckpoint: async (checkpoint) => {
        admission.bind(checkpoint);
        await publish?.(checkpoint);
        admission.confirm(checkpoint);
      } };
    }
    const resumed = options.resumeRunId === void 0 ? void 0 : ExecutionJournal.open(lease, options.resumeRunId, definition.hash);
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
      for (const file of fs7.readdirSync(lease.directory)) {
        if (!/^[a-f0-9-]+\.json$/.test(file)) continue;
        if (fs7.lstatSync(lease.directory + "/" + file).isSymbolicLink()) throw new Error("Execution checkpoint cannot be a link");
        const prior = JSON.parse(fs7.readFileSync(lease.directory + "/" + file, "utf8"));
        ExecutionJournal.open(lease, file.slice(0, -5), prior.definitionHash);
        const resolved = prior.phase === "abandoned" || prior.disposition || ["completed", "failed"].includes(prior.phase) && !checkpointUncertainties(prior).length;
        if (prior.runId !== options.resumeRunId && !resolved && !admission.permitsPending(prior)) {
          throw new Error(`Previous execution requires continuation or reconciliation (run ${prior.runId}, workflow ${prior.workflowId}, step ${prior.nextStepId}). No new task was started.`);
        }
      }
      const journal2 = resumed || await ExecutionJournal.create(lease, definition.workflow.id, definition.hash, entry.id);
      admission.bind(journal2.snapshot());
      return journal2;
    });
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

// task-history.ts
var fs8 = __toESM(require("fs"));
var path9 = __toESM(require("path"));
function regularDirectory(directory) {
  if (!fs8.existsSync(directory)) fs8.mkdirSync(directory);
  const stat = fs8.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Task history requires regular directories");
}
function persistTaskHistory(vault, workflow, checkpoint, settings) {
  if (settings.logsEnabled === false) return;
  const root = fs8.realpathSync(vault);
  const touched = /* @__PURE__ */ new Set();
  for (const [index, observed] of checkpoint.steps.entries()) {
    const step = workflow.steps.find((item) => item.id === observed.stepId);
    if (!step?.taskId || step.stepKind && step.stepKind !== "task" || observed.status === "in_flight" || !observed.startedAt) continue;
    if (!/^[a-zA-Z0-9_-]+$/.test(step.taskId)) throw new Error("Unsafe task history identity");
    let directory = root;
    for (const part of [".opencode", "logs", step.taskId]) {
      directory = path9.join(directory, part);
      regularDirectory(directory);
    }
    const date = new Date(observed.startedAt), pad = (n) => String(n).padStart(2, "0");
    const timestamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, "0")}`;
    const file = path9.join(directory, `${timestamp}_${checkpoint.runId}_${String(index).padStart(6, "0")}.log`);
    const content = `Run: ${checkpoint.runId}
Step: ${observed.stepId}
Status: ${observed.status}
Started: ${observed.startedAt}
Finished: ${observed.finishedAt || "unknown"}

${observed.output || "(no output)"}`;
    try {
      fs8.writeFileSync(file, content, { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const stat = fs8.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || fs8.readFileSync(file, "utf8") !== content) throw new Error("Task history conflicts with durable output");
    }
    touched.add(directory);
  }
  for (const directory of touched) {
    const files2 = fs8.readdirSync(directory).filter((name) => name.endsWith(".log") && name !== "latest.log").sort();
    const max = settings.maxLogsPerTask ?? 50, days = settings.logRetentionDays ?? 30;
    const retained = [];
    for (const name of files2) {
      const file = path9.join(directory, name), stat2 = fs8.lstatSync(file);
      if (!stat2.isFile() || stat2.isSymbolicLink()) throw new Error("Task history requires regular files");
      const match = name.match(/^(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})/);
      const date = match ? Date.parse(`${match[1]}T${match[2]}:${match[3]}:${match[4]}`) : NaN;
      if (days > 0 && date < Date.now() - days * 864e5) fs8.unlinkSync(file);
      else retained.push(name);
    }
    while (max > 0 && retained.length > max) fs8.unlinkSync(path9.join(directory, retained.shift()));
    const latest = path9.join(directory, "latest.log");
    const stat = fs8.lstatSync(latest, { throwIfNoEntry: false });
    if (stat) {
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Task history latest must be a regular file");
    }
    if (retained.length) fs8.writeFileSync(latest, fs8.readFileSync(path9.join(directory, retained[retained.length - 1])));
  }
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

// workflow-catalog-progress.ts
async function persistWorkflowProgress(options) {
  return catalogTransaction(options.configurationFile, async (transaction) => {
    const durable = readExecutionCheckpoint(options.runtimeDirectory, options.expectedRunId);
    if (JSON.stringify(durable) !== JSON.stringify(options.checkpoint)) {
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
    if (virtual && (virtual.id !== durable.workflowId || config.workflows.some((workflow2) => workflow2.id === virtual.id))) throw new Error("Standalone task identity mismatch");
    if (virtual && config.tasks.filter((task) => task.id === options.taskId).length !== 1) throw new Error("Missing or ambiguous task in catalog");
    const matches = virtual ? [virtual] : config.workflows.filter((workflow2) => workflow2.id === durable.workflowId);
    if (matches.length !== 1) throw new Error("Missing or ambiguous workflow in catalog");
    let workflow = virtual ? { ...virtual, runtimeExecution: config.tasks.find((task) => task.id === options.taskId).runtimeExecution } : matches[0];
    if (options.stepId) {
      if (virtual) throw new Error("A code step requires its parent workflow identity");
      workflow = selectCodeStep(workflow, options.stepId);
    }
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
    const preserveLegacy = !virtual && !options.stepId && matches[0].legacyExecution && matches[0].runtimeExecution?.runId === durable.runId;
    if (preserveLegacy) {
      validateProgressBinding(matches[0], durable, options.expectedRunId);
      if (!["completed", "failed", "abandoned"].includes(durable.phase)) throw new Error("Legacy workflow overlaps an unfinished shared run");
    }
    const projected = preserveLegacy ? matches[0] : { ...projectWorkflowProgress(workflow, config.tasks, config, durable, options.expectedRunId), legacyExecution: void 0 };
    const observedTasks = /* @__PURE__ */ new Map();
    const executionSteps = workflowExecutionPlan({ workflow, workflows: workflowClosure(workflow, config.workflows) }).steps;
    for (const [stepIndex, observed] of durable.steps.entries()) {
      const step = executionSteps.find((item) => item.id === observed.stepId);
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
    const replacement = options.stepId ? { ...matches[0], steps: matches[0].steps.map((step) => step.id === options.stepId ? {
      ...step,
      codeExecution: {
        runtimeExecution: projected.runtimeExecution,
        status: projected.status,
        output: projected.steps[0].output,
        lastRun: projected.steps[0].lastRun || durable.createdAt
      }
    } : step) } : projected;
    const next = { ...config, tasks, workflows: virtual ? config.workflows : config.workflows.map((workflow2) => workflow2 === matches[0] ? replacement : workflow2) };
    await writer.save(options.configurationFile, () => next);
    if (options.vaultBase) persistTaskHistory(options.vaultBase, { ...workflow, steps: executionSteps }, durable, config);
    const confirmed = {
      catalog: next,
      version: writer.confirmedVersion(options.configurationFile),
      runId: durable.runId,
      workflowId: durable.workflowId,
      revision: durable.revision
    };
    await options.onCommitted?.(confirmed, transaction);
    return confirmed;
  });
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

// installed-workflow-host.ts
var fs20 = __toESM(require("fs"));
var path21 = __toESM(require("path"));

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
var import_child_process4 = require("child_process");
var import_string_decoder2 = require("string_decoder");
var fs9 = __toESM(require("fs"));
var os = __toESM(require("os"));
var path10 = __toESM(require("path"));
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
    return new Promise((resolve8, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex RPC request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve8, reject, timer });
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
  if (os.platform() !== "win32" || !path10.isAbsolute(bin) || !/^codex\.(cmd|bat|ps1)$/i.test(path10.basename(bin))) return bin;
  try {
    if (!fs9.statSync(bin).isFile()) return bin;
  } catch {
    return bin;
  }
  const target = process.arch === "x64" ? "x86_64-pc-windows-msvc" : process.arch === "arm64" ? "aarch64-pc-windows-msvc" : void 0;
  if (!target) return bin;
  const scope = path10.join(path10.dirname(bin), "node_modules", "@openai");
  const platformPackage = `codex-win32-${process.arch}`;
  const vendors = [
    path10.join(scope, "codex", "node_modules", "@openai", platformPackage, "vendor"),
    path10.join(scope, platformPackage, "vendor"),
    path10.join(scope, "codex", "vendor")
  ];
  for (const vendor of vendors) for (const directory of ["bin", "codex"]) {
    const candidate = path10.join(vendor, target, directory, "codex.exe");
    try {
      if (fs9.statSync(candidate).isFile()) return candidate;
    } catch {
    }
  }
  return bin;
}
function resolveCodexBin(configured = "codex") {
  if (configured.trim() && configured.trim() !== "codex") return resolveCodexNativeBin(configured.trim());
  const candidates = [];
  if (os.platform() === "win32") {
    const localAppData = process.env.LOCALAPPDATA || "";
    const desktopBinRoot = path10.join(localAppData, "OpenAI", "Codex", "bin");
    try {
      const versionDirs = fs9.readdirSync(desktopBinRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path10.join(desktopBinRoot, entry.name, "codex.exe")).filter((candidate) => fs9.existsSync(candidate)).sort((a, b) => fs9.statSync(b).mtimeMs - fs9.statSync(a).mtimeMs);
      candidates.push(...versionDirs);
    } catch {
    }
    candidates.push(
      path10.join(localAppData, "OpenAI", "Codex", "codex.exe"),
      path10.join(process.env.APPDATA || "", "npm", "codex.cmd")
    );
  } else {
    const userHome = process.env.HOME || "";
    candidates.push(
      path10.join(userHome, ".local", "bin", "codex"),
      path10.join(userHome, ".npm-global", "bin", "codex"),
      "/opt/homebrew/bin/codex",
      "/usr/local/bin/codex"
    );
  }
  return resolveCodexNativeBin(candidates.find((candidate) => candidate && fs9.existsSync(candidate)) || configured || "codex");
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
  return new Promise((resolve8, reject) => {
    const child = (0, import_child_process4.spawn)(launcher.bin, launcher.args, {
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
      if (code === 0) resolve8();
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
    this.child = (0, import_child_process4.spawn)(this.bin, ["app-server"], {
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
    const completion = new Promise((resolve8, reject) => {
      this.completionResolve = resolve8;
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
var fs10 = __toESM(require("fs"));
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
    const cwd = fs10.realpathSync(task.workingDirectory || definition.settings.workingDirectory || vaultBase);
    if (!fs10.statSync(cwd).isDirectory()) throw new Error("Codex working directory is unavailable");
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
var fs16 = __toESM(require("fs"));
var path17 = __toESM(require("path"));

// interactive-cli-task.ts
var fs14 = __toESM(require("fs"));
var path15 = __toESM(require("path"));

// interactive-cli.ts
var fs13 = __toESM(require("fs"));
var path14 = __toESM(require("path"));
var os4 = __toESM(require("os"));

// cli-launchers.ts
var fs12 = __toESM(require("fs"));
var path12 = __toESM(require("path"));
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
var import_child_process5 = require("child_process");

// execution-files.ts
var fs11 = __toESM(require("fs"));
var path11 = __toESM(require("path"));
var AUXILIARY_COMPLETION = "autooc-cleanup.json";
var files = {
  interactive: ["prompt.txt", "state.json", ".gitignore"],
  runtime: ["stdout.txt", "stderr.txt", "done.txt", "process.pid", "instruction.txt", "input.txt", "launch.ps1", "launch.sh", "launch.vbs"]
};
function directoryOnly(directory) {
  const stat = fs11.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("AutoOC auxiliary directory is redirected or invalid");
}
function validateDirectory(directory, kind) {
  const root = path11.dirname(directory);
  if (path11.basename(root) !== "auxiliary" || path11.basename(path11.dirname(root)) !== ".autooc" || !new RegExp(`^${kind}-[A-Za-z0-9]{6}$`).test(path11.basename(directory))) {
    throw new Error("Invalid AutoOC auxiliary directory");
  }
  for (const location of [path11.dirname(root), root, directory]) directoryOnly(location);
}
function auxiliaryCompletionRecord(directory, kind) {
  return JSON.stringify({ schemaVersion: 1, kind, directory: path11.basename(directory), completed: true });
}
function cleanCompleted(directory, kind) {
  validateDirectory(directory, kind);
  const marker = path11.join(directory, AUXILIARY_COMPLETION);
  const stat = fs11.lstatSync(marker);
  if (!stat.isFile() || stat.isSymbolicLink()) return;
  const receipt = JSON.parse(fs11.readFileSync(marker, "utf8").replace(/^\uFEFF/, ""));
  if (receipt.schemaVersion !== 1 || receipt.kind !== kind || receipt.directory !== path11.basename(directory) || receipt.completed !== true) return;
  for (const name of files[kind]) {
    try {
      fs11.unlinkSync(path11.join(directory, name));
    } catch (error) {
      if (error.code !== "ENOENT") return;
    }
  }
  if (fs11.readdirSync(directory).some((name) => name !== AUXILIARY_COMPLETION)) return;
  fs11.unlinkSync(marker);
  fs11.rmdirSync(directory);
}
function completeAuxiliaryDirectory(directory, kind) {
  try {
    validateDirectory(directory, kind);
    fs11.writeFileSync(path11.join(directory, AUXILIARY_COMPLETION), auxiliaryCompletionRecord(directory, kind), { encoding: "utf8", flag: "wx", mode: 384 });
  } catch (error) {
    if (error.code !== "EEXIST") {
      console.warn("AutoOC: auxiliary cleanup pending");
      return;
    }
  }
  try {
    cleanCompleted(directory, kind);
  } catch {
  }
}
function createAuxiliaryDirectory(cwd, kind) {
  const container = path11.join(path11.resolve(cwd), ".autooc");
  const root = path11.join(container, "auxiliary");
  for (const directory of [container, root]) {
    try {
      fs11.mkdirSync(directory, { mode: 448 });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    directoryOnly(directory);
  }
  const ignore = path11.join(root, ".gitignore");
  try {
    fs11.writeFileSync(ignore, "*\n", { encoding: "utf8", flag: "wx", mode: 384 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const stat = fs11.lstatSync(ignore);
    if (!stat.isFile() || stat.isSymbolicLink() || fs11.readFileSync(ignore, "utf8") !== "*\n") throw new Error("AutoOC auxiliary ignore rules conflict");
  }
  for (const name of fs11.readdirSync(root)) {
    const previousKind = /^(interactive|runtime)-[A-Za-z0-9]{6}$/.exec(name)?.[1];
    if (previousKind) {
      try {
        cleanCompleted(path11.join(root, name), previousKind);
      } catch {
      }
    }
  }
  return fs11.mkdtempSync(path11.join(root, `${kind}-`));
}

// cli-launchers.ts
function resolveOpencodeBin(configured) {
  const requested = configured?.trim();
  if (requested && requested !== "opencode") return requested;
  const candidates = [];
  const extensions = os2.platform() === "win32" ? [".exe", ".cmd", ".bat"] : [""];
  for (const entry of (process.env.PATH || process.env.Path || "").split(path12.delimiter)) {
    const directory = entry.trim().replace(/^"|"$/g, "");
    if (!path12.isAbsolute(directory)) continue;
    for (const extension of extensions) candidates.push(path12.join(directory, `opencode${extension}`));
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
  const { accessSync: accessSync2, statSync: statSync7, constants: constants2 } = require("fs");
  for (const candidate of candidates) {
    try {
      accessSync2(candidate, constants2.X_OK);
      if (!statSync7(candidate).isFile()) continue;
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
    const launcher = (0, import_child_process5.spawn)(
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
    const launcher = (0, import_child_process5.spawn)("osascript", ["-e", script], { detached: true, stdio: "ignore" });
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
    const launcher = (0, import_child_process5.spawn)(terminal.cmd, [...terminal.args, "sh", "-lc", command], { detached: true, stdio: "ignore" });
    launcher.on?.("error", (error) => options.onError?.(error));
    launcher.on?.("spawn", () => options.onLaunched?.());
    launcher.unref();
    return;
  }
}
function openOpencodeCliLongPromptWindows(bin, cwd, env, model, agent, prompt, options = {}) {
  const attempt = crypto.randomBytes(16).toString("hex");
  let directory;
  try {
    directory = createAuxiliaryDirectory(cwd, "interactive");
  } catch (error) {
    options.onError?.(error instanceof Error ? error : new Error(String(error)));
    return;
  }
  const promptFile = path12.join(directory, "prompt.txt");
  const stateFile = path12.join(directory, "state.json");
  const ignoreFile = path12.join(directory, ".gitignore");
  const cleanup = () => completeAuxiliaryDirectory(directory, "interactive");
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
    fs12.writeFileSync(ignoreFile, "*\n", { encoding: "utf8", flag: "wx" });
    fs12.writeFileSync(promptFile, prompt, { encoding: "utf8", flag: "wx" });
    const instruction = `Read the full task prompt from ${path12.relative(path12.resolve(cwd), promptFile).split(path12.sep).join("/")} and follow it exactly.`;
    const completionFile = path12.join(directory, AUXILIARY_COMPLETION);
    const completion = `  ${psSingleQuoted(auxiliaryCompletionRecord(directory, "interactive"))} | Set-Content -LiteralPath ${psSingleQuoted(completionFile)} -Encoding UTF8`;
    const checkDirectory = `function Test-AutoOCAuxiliary { $item = Get-Item -LiteralPath ${psSingleQuoted(directory)} -Force -ErrorAction SilentlyContinue; for ($i = 0; $i -lt 3; $i++) { if ($null -eq $item -or -not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { return $false }; $item = Get-Item -LiteralPath $item.Parent.FullName -Force -ErrorAction SilentlyContinue }; return $true }`;
    const runner = [
      "$ErrorActionPreference = 'Stop'",
      checkDirectory,
      `Set-Location -LiteralPath ${psSingleQuoted(path12.resolve(cwd))}`,
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
      `  $session = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList @('-NoLogo', '-NoProfile', '-EncodedCommand', '${encodedRunner}') -WorkingDirectory ${psSingleQuoted(path12.resolve(cwd))} -PassThru`,
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
      `    try { if (@([System.IO.Directory]::GetFileSystemEntries(${psSingleQuoted(directory)})).Count -eq 1 -and (Test-Path -LiteralPath ${psSingleQuoted(completionFile)})) { Remove-Item -LiteralPath ${psSingleQuoted(completionFile)}; [System.IO.Directory]::Delete(${psSingleQuoted(directory)}, $false) } } catch { }`,
      "  }",
      "}"
    ].join("\n");
    const encodedObserver = Buffer.from(observer, "utf16le").toString("base64");
    if (encodedObserver.length > 3e4 || encodedRunner.length > 3e4) throw new Error("Interactive launcher configuration exceeds Windows command-line limit");
    const readState = () => {
      let state;
      try {
        state = JSON.parse(fs12.readFileSync(stateFile, "utf8").replace(/^\uFEFF/, ""));
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
    const launcher = (0, import_child_process5.spawn)("powershell.exe", ["-NoLogo", "-NoProfile", "-EncodedCommand", encodedObserver], {
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
  const fs26 = require("fs");
  const launcherFile = psScriptFile.replace(/\.ps1$/, ".vbs");
  const effectivePidFile = pidFile || psScriptFile.replace(/\.ps1$/, ".pid");
  const quotedPsScriptFile = psScriptFile.replace(/"/g, '""');
  const launcherScript = `Set sh = CreateObject("WScript.Shell")\r
sh.Run "powershell.exe -NoLogo -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File ""${quotedPsScriptFile}""", 0, False\r
`;
  fs26.writeFileSync(launcherFile, launcherScript, "utf8");
  const { spawn: spawn4 } = require("child_process");
  const child = spawn4("wscript.exe", [launcherFile], { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
  const launcherTimer = setTimeout(() => {
    try {
      fs26.unlinkSync(launcherFile);
    } catch {
    }
  }, 1e4);
  const scriptTimer = setTimeout(() => {
    try {
      fs26.unlinkSync(psScriptFile);
    } catch {
    }
  }, 6e5);
  const cleanup = (removeScript = false) => {
    clearTimeout(launcherTimer);
    clearTimeout(scriptTimer);
    try {
      fs26.unlinkSync(launcherFile);
    } catch {
    }
    if (removeScript) {
      try {
        fs26.unlinkSync(psScriptFile);
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
      const pid = fs26.existsSync(effectivePidFile) ? String(fs26.readFileSync(effectivePidFile, "utf8")).trim() : "";
      if (/^\d+$/.test(pid) && pid !== String(child.pid || "")) {
        const killer = spawn4("taskkill.exe", ["/PID", pid, "/T", "/F"], { detached: true, stdio: "ignore", windowsHide: true });
        killer.unref();
      }
    } catch {
    }
    cleanup(true);
    try {
      fs26.unlinkSync(effectivePidFile);
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
  const fs26 = require("fs");
  const { spawn: spawn4 } = require("child_process");
  const effectivePidFile = pidFile || shScriptFile.replace(/\.sh$/, ".pid");
  try {
    fs26.chmodSync(shScriptFile, 448);
  } catch {
  }
  const child = spawn4("/bin/sh", [shScriptFile], { detached: true, stdio: "ignore" });
  child.unref();
  const scriptTimer = setTimeout(() => {
    try {
      fs26.unlinkSync(shScriptFile);
    } catch {
    }
  }, 6e5);
  const cleanup = (removeScript = false) => {
    clearTimeout(scriptTimer);
    if (removeScript) {
      try {
        fs26.unlinkSync(shScriptFile);
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
      const pid = fs26.existsSync(effectivePidFile) ? String(fs26.readFileSync(effectivePidFile, "utf8")).trim() : "";
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
      fs26.unlinkSync(effectivePidFile);
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
  fs12.writeFileSync(filePath, Buffer.concat([Buffer.from([239, 187, 191]), Buffer.from(content, "utf8")]));
}
function psUtf8Prelude() {
  return [
    `$utf8NoBom = New-Object System.Text.UTF8Encoding($false)`,
    `[Console]::OutputEncoding = $utf8NoBom`,
    `$OutputEncoding = $utf8NoBom`
  ];
}

// opencode-version.ts
var import_child_process6 = require("child_process");
var path13 = __toESM(require("path"));
var os3 = __toESM(require("os"));
function parseOpenCodeVersion(text) {
  const match = text.trim().match(/^(?:opencode\s+)?v?(\d+)\.(\d+)\.(\d+)(?:[-+][\w.-]+)?$/i);
  return match ? { version: match[0], major: Number(match[1]) } : void 0;
}
function readOpenCodeOutput(bin, args, cwd, timeout, maxBuffer) {
  if (!bin || !path13.isAbsolute(bin) && !/^[\w.-]+$/.test(bin)) throw new Error("Choose an absolute OpenCode executable path or a command name without arguments.");
  let command = bin;
  if (process.platform === "win32" && !/\.exe$/i.test(bin)) {
    command = path13.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    const invocation = [bin, ...args].map((value) => `'${value.replace(/'/g, "''")}'`).join(" ");
    const script = `$ErrorActionPreference = 'Stop'; [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); & ${invocation}; exit $LASTEXITCODE`;
    args = ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")];
  }
  return new Promise((resolve8, reject) => (0, import_child_process6.execFile)(
    command,
    args,
    { cwd, windowsHide: true, timeout, maxBuffer, encoding: "utf8" },
    (error, stdout) => error ? reject(error) : resolve8(stdout)
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
    if (!path14.isAbsolute(file) || !fs13.statSync(file).isFile()) return false;
    if (process.platform === "win32" && !/\.(exe|cmd|bat|ps1)$/i.test(file)) return false;
    fs13.accessSync(file, fs13.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
function resolveInteractiveCli(provider, configured) {
  const defaultCommand = provider === "opencode2" ? "opencode" : provider;
  const requested = (configured?.trim() || defaultCommand).replace(/^~(?=[/\\])/, os4.homedir());
  if (path14.isAbsolute(requested)) return executable(requested) ? requested : void 0;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(requested)) return void 0;
  const directories = (process.env.PATH || process.env.Path || "").split(path14.delimiter).map((value) => value.trim().replace(/^"|"$/g, "")).filter((value) => path14.isAbsolute(value));
  if (requested === defaultCommand) {
    const home = os4.homedir();
    directories.push(path14.join(home, ".local", "bin"), path14.join(home, ".npm-global", "bin"), path14.join(home, ".bun", "bin"), path14.join(home, "bin"));
    if (process.platform === "win32") {
      if (process.env.APPDATA) directories.push(path14.join(process.env.APPDATA, "npm"));
    } else directories.push("/opt/homebrew/bin", "/usr/local/bin");
    if (provider === "claude") directories.push(path14.join(home, ".claude", "local"));
  }
  const extensions = process.platform === "win32" && !path14.extname(requested) ? [".exe", ".cmd", ".bat", ".ps1"] : [""];
  for (const directory of directories) for (const extension of extensions) {
    const file = path14.join(directory, requested + extension);
    if (executable(file)) return file;
  }
  if (provider === "codex" && requested === provider) {
    const fallback = resolveCodexBin("codex");
    if (executable(fallback)) return fallback;
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
  if (!path15.isAbsolute(cwd) || !fs14.statSync(cwd).isDirectory()) throw new Error("CLI task requires an existing absolute project directory.");
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
    await new Promise((resolve8, reject) => openOpencodeCliLongPromptWindows(
      request.bin,
      request.cwd,
      {},
      request.model,
      request.agent,
      request.prompt,
      { onLaunched: resolve8, onError: reject, promptArgs: argsForPrompt }
    ));
    return;
  }
  if (!["linux", "darwin"].includes(process.platform)) throw new Error("Interactive CLI tasks require Windows, macOS or Linux.");
  if (process.platform === "linux" && !resolveLinuxTerminal(linuxTerminal)) throw new Error("No supported Linux terminal is available. Nothing was launched.");
  const directory = createAuxiliaryDirectory(request.cwd, "interactive");
  const promptFile = path15.join(directory, "prompt.txt"), scriptFile = path15.join(directory, "launch.sh");
  let scriptWritten = false;
  const cleanupBeforeLaunch = () => {
    for (const parent of [path15.dirname(path15.dirname(directory)), path15.dirname(directory), directory]) {
      const stat = fs14.lstatSync(parent);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("CLI auxiliary directory changed; input preserved.");
    }
    if (scriptWritten) fs14.unlinkSync(scriptFile);
    completeAuxiliaryDirectory(directory, "interactive");
  };
  try {
    fs14.writeFileSync(promptFile, request.prompt, { encoding: "utf8", flag: "wx", mode: 384 });
    const instruction = `Read ${path15.relative(request.cwd, promptFile).split(path15.sep).join("/")} as UTF-8 and follow its instructions.`;
    const q = shSingleQuoted;
    const command = [request.bin, ...argsForPrompt(instruction)].map(q).join(" ");
    const script = [
      "#!/bin/sh",
      "cleanup() {",
      "  status=$?",
      `  if [ -d ${q(directory)} ] && [ ! -L ${q(directory)} ] && [ ! -L ${q(path15.dirname(directory))} ] && [ ! -L ${q(path15.dirname(path15.dirname(directory)))} ]; then`,
      `    rm -f -- ${q(promptFile)} ${q(scriptFile)}`,
      `    printf '%s' ${q(auxiliaryCompletionRecord(directory, "interactive"))} > ${q(path15.join(directory, AUXILIARY_COMPLETION))}`,
      "  fi",
      '  exit "$status"',
      "}",
      "trap cleanup EXIT",
      command
    ].join("\n") + "\n";
    fs14.writeFileSync(scriptFile, script, { encoding: "utf8", flag: "wx", mode: 448 });
    scriptWritten = true;
    if (request.signal?.aborted) {
      throw new Error("CLI task cancelled before launch.");
    }
  } catch (error) {
    cleanupBeforeLaunch();
    throw error;
  }
  await new Promise((resolve8, reject) => {
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
        resolve8();
      }, onError: failed });
    } catch (error) {
      failed(error);
    }
  });
}

// copilot-client.ts
var import_child_process7 = require("child_process");
var fs15 = __toESM(require("fs"));
var os5 = __toESM(require("os"));
var path16 = __toESM(require("path"));
function resolveCopilotBin(configured = "copilot") {
  const value = configured.trim() || "copilot";
  const nativeFromShim = (shim) => {
    const npmRoot = path16.join(path16.dirname(shim), "node_modules", "@github");
    const packageName = `copilot-${process.platform}-${process.arch}`;
    const executable2 = process.platform === "win32" ? "copilot.exe" : "copilot";
    return [
      path16.join(npmRoot, "copilot", "node_modules", "@github", packageName, executable2),
      path16.join(npmRoot, packageName, executable2)
    ].find((candidate) => fs15.existsSync(candidate));
  };
  if (value !== "copilot") {
    return /\.(cmd|bat|ps1)$/i.test(value) ? nativeFromShim(value) || value : value;
  }
  const home = os5.homedir();
  const dirs = [
    ...(process.env.PATH || "").split(path16.delimiter),
    path16.join(home, ".local", "bin"),
    path16.join(home, ".npm-global", "bin"),
    ...process.platform === "win32" ? [path16.join(process.env.APPDATA || path16.join(home, "AppData", "Roaming"), "npm")] : ["/opt/homebrew/bin", "/usr/local/bin"]
  ];
  for (const dir of dirs.filter(Boolean)) {
    for (const extension of process.platform === "win32" ? [".exe", ".cmd", ".ps1"] : [""]) {
      const candidate = path16.join(dir.replace(/^"|"$/g, ""), `copilot${extension}`);
      if (fs15.existsSync(candidate)) return nativeFromShim(candidate) || candidate;
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
    return new Promise((resolve8) => {
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
            fs15.unlinkSync(path16.join(promptDir, "task.txt"));
            fs15.rmdirSync(promptDir);
          } catch {
          }
        }
        resolve8(result);
      };
      this.finish = finish;
      try {
        let args;
        if (prompt.length > 12e3) {
          promptDir = fs15.mkdtempSync(path16.join(os5.tmpdir(), "autooc-copilot-"));
          const promptFile = path16.join(promptDir, "task.txt");
          fs15.writeFileSync(promptFile, prompt, { encoding: "utf8", mode: 384 });
          args = buildCopilotArgs(`Read the UTF-8 file ${JSON.stringify(promptFile)} and carry out the complete task instructions it contains.`, options);
          args.push("--add-dir", promptDir);
        } else {
          args = buildCopilotArgs(prompt, options);
        }
        this.child = (0, import_child_process7.spawn)(this.bin, args, {
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
      const killer = (0, import_child_process7.spawn)("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
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
function normalizeCommandOutput(text) {
  if (!text) return "";
  const cleaned = text.replace(/\x1B\[[0-9;]*[A-Za-z]/g, "");
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
      if (path17.isAbsolute(bin) && !fs16.existsSync(bin)) return { succeeded: false, output: "[interactive OpenCode executable is unavailable; nothing was launched]" };
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
      await new Promise((resolve8, reject) => {
        const options = { onLaunched: resolve8, onError: reject, linuxTerminal: definition.settings.linuxTerminal, opencodeMajor: major };
        if (process.platform === "win32") openOpencodeCliLongPromptWindows(bin, taskCwd, {}, model, task.forceModel ? "" : agent, prompt, options);
        else openOpencodeCli(bin, taskCwd, {}, openCodeInteractiveArgs(major, model, task.forceModel ? "" : agent, prompt), options);
      });
      return { succeeded: true, output: "[opened interactive OpenCode CLI with preloaded prompt; interactive task result is not observed]" };
    }
    const folder = createAuxiliaryDirectory(taskCwd, "runtime");
    const outFile = path17.join(folder, "stdout.txt"), errFile = path17.join(folder, "stderr.txt"), doneFile = path17.join(folder, "done.txt");
    const pidFile = path17.join(folder, "process.pid"), promptFile = path17.join(folder, "instruction.txt"), full = path17.join(folder, "input.txt");
    const scriptFile = path17.join(folder, "launch" + scriptExt());
    let handle;
    let known = false, launchAttempted = false;
    try {
      fs16.writeFileSync(full, prompt, { encoding: "utf8", mode: 384 });
      fs16.writeFileSync(promptFile, `Read the complete task prompt and workflow context from the workspace file at ${full} and follow it exactly.`, { encoding: "utf8", mode: 384 });
      const script = buildOpenCodeScript({ pidFile, secretEnv: {}, safeCwd: taskCwd.replace(/'/g, "''"), gitCmds: "", bin, model, effectiveAgent: agent, effectiveTask: task, promptFile, outFile, errFile, doneFile, taskCwd, major });
      if (process.platform === "win32") writeUtf8BomFile(scriptFile, script);
      else fs16.writeFileSync(scriptFile, script, { mode: 384 });
      launchAttempted = true;
      const launched = handle = launchHidden(scriptFile, pidFile);
      const result = await new Promise((resolve8, reject) => {
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
        const read = (file) => fs16.existsSync(file) ? decodeCommandBuffer(fs16.readFileSync(file)) : "";
        let lastOutput = "", nextOutputAt = 0;
        const timer = setInterval(() => {
          try {
            if (timeout > 0 && Date.now() - started > timeout) {
              abort();
              return;
            }
            const completed = fs16.existsSync(doneFile);
            if (!completed && (!interaction?.onOutput || Date.now() < nextOutputAt)) return;
            const output = formatTaskOutput(read(outFile), read(errFile));
            if (output !== lastOutput) {
              lastOutput = output;
              interaction?.onOutput?.(output);
            }
            nextOutputAt = Date.now() + 500;
            if (!completed) return;
            const exit = fs16.readFileSync(doneFile, "utf8").replace(/^\uFEFF/, "").trim();
            if (!/^-?\d+$/.test(exit)) throw new Error("Invalid OpenCode completion marker");
            known = true;
            finish();
            resolve8({ succeeded: exit === "0", output: output || "(no output)" });
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

// workflow-stop.ts
var fs17 = __toESM(require("fs"));
var path18 = __toESM(require("path"));
var import_crypto7 = require("crypto");
function readStopRequest(directory, runId) {
  if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error("Invalid execution identity");
  const file = path18.join(directory, runId + ".stop.json");
  try {
    const stat = fs17.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Invalid stop request file");
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  let value;
  try {
    value = JSON.parse(fs17.readFileSync(file, "utf8"));
  } catch {
    throw new Error("Invalid stop request");
  }
  if (value.schemaVersion !== 1 || value.runId !== runId || !/^[a-f0-9-]+$/.test(value.requestId || "")) throw new Error("Invalid stop request identity");
  return value.requestId;
}
async function requestWorkflowStop(directory, runId) {
  const stat = fs17.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Invalid runtime directory");
  const state = readExecutionCheckpoint(directory, runId);
  if (["completed", "failed", "abandoned"].includes(state.phase)) return { runId, requested: false, phase: state.phase };
  readStopRequest(directory, runId);
  const requestId = (0, import_crypto7.randomUUID)();
  await atomicSettingsWrite(path18.join(directory, runId + ".stop.json"), { schemaVersion: 1, runId, requestId });
  return { runId, requestId, requested: true, phase: state.phase };
}

// workflow-preflight.ts
var fs18 = __toESM(require("fs"));
var path19 = __toESM(require("path"));
function preflightInstalledWorkflow(definition, vault) {
  assertWorkflowDependencies(definition.workflow, definition.tasks, definition.workflows);
  const root = physicalPath(vault);
  const checkDirectory = (value) => {
    if (value !== void 0 && typeof value !== "string") throw new Error("Invalid working directory");
    const configured = value || root;
    if (!path19.isAbsolute(configured)) throw new Error("Working directory must be absolute");
    const directory = physicalPath(configured);
    if (!isWithinPhysicalPath(root, directory)) throw new Error("Working directory is outside the selected vault");
    if (!fs18.statSync(directory).isDirectory()) throw new Error("Working directory is unavailable");
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

// installed-workflow-location.ts
var fs19 = __toESM(require("fs"));
var path20 = __toESM(require("path"));
function regularDirectory2(directory) {
  const stat = fs19.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Installation must use regular directories");
}
function optionalStat(file) {
  try {
    return fs19.lstatSync(file);
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
function resolveInstalledWorkflowLocation(vaultPath, installationDirectory) {
  if (!path20.isAbsolute(vaultPath)) throw new Error("Explicit absolute vault required");
  const vault = physicalPath(vaultPath);
  regularDirectory2(vault);
  let relative6 = path20.join(".obsidian", "plugins", "auto-oc");
  if (installationDirectory !== void 0) {
    if (typeof installationDirectory !== "string" || !installationDirectory || installationDirectory.includes("\0") || installationDirectory.split(/[\\/]/).some((part) => part === "." || part === "..")) {
      throw new Error("Invalid installation location");
    }
    if (process.platform === "win32" && path20.isAbsolute(installationDirectory)) {
      let inspected = path20.parse(installationDirectory).root;
      for (const part of installationDirectory.slice(inspected.length).split(/[\\/]/)) {
        if (!part || part.includes(":")) throw new Error("Invalid installation component");
        inspected = path20.join(inspected, part);
        regularDirectory2(inspected);
      }
      relative6 = path20.relative(vault, physicalPath(inspected));
    } else {
      relative6 = path20.isAbsolute(installationDirectory) ? path20.relative(path20.resolve(vaultPath), installationDirectory) : installationDirectory;
    }
    if (!relative6 || path20.isAbsolute(relative6) || relative6.split(/[\\/]/).some((part) => part === ".." || part.includes(":"))) {
      throw new Error("Installation must remain inside the vault");
    }
  }
  let directory = vault;
  for (const part of relative6.split(/[\\/]/)) {
    if (!part) throw new Error("Invalid installation component");
    directory = path20.join(directory, part);
    regularDirectory2(directory);
  }
  directory = physicalPath(directory);
  if (!isWithinPhysicalPath(vault, directory)) throw new Error("Installation must remain inside the vault");
  const configurationFile = path20.join(directory, "data.json");
  const configStat = optionalStat(configurationFile);
  if (configStat && (configStat.isSymbolicLink() || !configStat.isFile())) throw new Error("Configuration must be a regular file");
  const runtimeDirectory = path20.join(directory, "runtime");
  const runtimeStat = optionalStat(runtimeDirectory);
  if (runtimeStat && (runtimeStat.isSymbolicLink() || !runtimeStat.isDirectory())) throw new Error("Invalid runtime directory");
  return { vault, installationDirectory: directory, configurationFile, runtimeDirectory };
}
function ensureInstalledWorkflowRuntime(location) {
  const current = resolveInstalledWorkflowLocation(location.vault, location.installationDirectory);
  if (current.runtimeDirectory !== location.runtimeDirectory) throw new Error("Installation location changed");
  try {
    fs19.mkdirSync(current.runtimeDirectory);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  regularDirectory2(current.runtimeDirectory);
}

// installed-workflow-host.ts
var preparingInstallations = /* @__PURE__ */ new Set();
async function runInstalledWorkflow(options) {
  if (!path21.isAbsolute(options.vault) || !!options.workflowId === !!options.taskId) throw new Error("Explicit vault and exactly one workflow or task identity required");
  if (options.stepId !== void 0 && (!options.workflowId || !options.stepId)) throw new Error("A code step requires its parent workflow identity");
  if (options.newExecution && (options.resumeRunId || options.reconcile)) throw new Error("New execution cannot also resume or reconcile");
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
    if (!options.lease && fs20.existsSync(runtimeDirectory)) ownedLease = acquireExecutionLease(runtimeDirectory);
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
        onCheckpoint: async (checkpoint) => {
          admission?.bind(checkpoint);
          activeRunId = checkpoint.runId;
          checkStop();
          const catalog = await persistWorkflowProgress({
            configurationFile,
            runtimeDirectory,
            checkpoint,
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

// execution-abandonment.ts
var fs21 = __toESM(require("fs"));
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
      if (fs21.existsSync(location.configurationFile + ".write-lock") || fs21.readdirSync(location.installationDirectory).some((name) => name.startsWith("data.json.") && name.endsWith(".tmp")) || fs21.readdirSync(location.runtimeDirectory).some((name) => name.endsWith(".tmp") || name.endsWith(".write-lock"))) throw new Error("Unfinished write requires reconciliation");
      const config = JSON.parse(fs21.readFileSync(location.configurationFile, "utf8"));
      if (["tasks", "workflows"].some((kind) => !Array.isArray(config[kind]) || config[kind].some((entry) => entry.status === "running" || entry.pendingCodexApproval))) throw new Error("Active execution requires reconciliation");
      for (const name of fs21.readdirSync(location.runtimeDirectory)) {
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

// release-maintenance.ts
var fs24 = __toESM(require("fs"));
var path24 = __toESM(require("path"));
var import_crypto9 = require("crypto");

// execution-idle.ts
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

// package-maintenance.ts
var fs22 = __toESM(require("fs"));
var path22 = __toESM(require("path"));
function assertPackageMaintenanceSafe(directory) {
  const runtime = path22.join(directory, "runtime");
  if (fs22.existsSync(path22.join(runtime, "update-pending.json"))) throw new Error("Incomplete plugin update requires recovery");
  if (fs22.readdirSync(directory).some((name) => name === "data.json.write-lock" || name === "data.json.write-intent" || name.startsWith("data.json.") && name.endsWith(".tmp")) || fs22.readdirSync(runtime).some((name) => name.endsWith(".tmp") || name.endsWith(".write-lock"))) {
    throw new Error("Unfinished write requires reconciliation before package maintenance");
  }
}

// release-update.ts
var fs23 = __toESM(require("fs"));
var path23 = __toESM(require("path"));
var import_crypto8 = require("crypto");
var RELEASE_FILES = ["main.js", "manifest.json", "styles.css", "autooc-cli.cjs", "autooc-runtime.cjs", "skills/autooc-runtime/SKILL.md"];
var RELEASE_DESCRIPTOR = "release-integrity.json";
function verifyRelease(files2, expectedVersion) {
  const descriptor = JSON.parse(files2[RELEASE_DESCRIPTOR]?.toString("utf8") || "null");
  if (descriptor?.schemaVersion !== 1 || descriptor.version !== expectedVersion || !descriptor.sha256 || Object.keys(descriptor.sha256).sort().join() !== [...RELEASE_FILES].sort().join() || Object.keys(files2).sort().join() !== [...RELEASE_FILES, RELEASE_DESCRIPTOR].sort().join()) {
    throw new Error("Incomplete or incompatible AutoOC release");
  }
  for (const file of RELEASE_FILES) {
    if (!Buffer.isBuffer(files2[file]) || (0, import_crypto8.createHash)("sha256").update(files2[file]).digest("hex") !== descriptor.sha256[file]) {
      throw new Error(`Release integrity mismatch: ${file}`);
    }
  }
  const manifest = JSON.parse(files2["manifest.json"].toString("utf8"));
  if (manifest.id !== "auto-oc" || manifest.version !== expectedVersion) throw new Error("Release manifest identity mismatch");
}
function regularPath(root, relative6, create = false) {
  let current = root;
  const parts = relative6.split("/");
  for (let i = 0; i < parts.length; i++) {
    current = path23.join(current, parts[i]);
    let stat;
    try {
      stat = fs23.lstatSync(current);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (stat && (stat.isSymbolicLink() || (i < parts.length - 1 ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1))) {
      throw new Error(`Unsafe release destination: ${relative6}`);
    }
    if (!stat && i < parts.length - 1 && create) fs23.mkdirSync(current);
  }
  return current;
}
function installRelease(options) {
  const { files: files2, version, lease } = options;
  verifyRelease(files2, version);
  const directory = fs23.realpathSync(options.directory);
  if (fs23.lstatSync(options.directory).isSymbolicLink() || path23.join(directory, "runtime") !== lease.directory) throw new Error("Update lease belongs to another installation");
  lease.assertOwned();
  const marker = path23.join(lease.directory, "update-pending.json");
  if (fs23.existsSync(marker)) throw new Error("Previous update requires recovery");
  assertPackageMaintenanceSafe(directory);
  const names = [...RELEASE_FILES, RELEASE_DESCRIPTOR];
  for (const name of names) regularPath(directory, name);
  const backup = path23.join(lease.directory, `update-backup-${(0, import_crypto8.randomUUID)()}`);
  fs23.mkdirSync(backup);
  const previous = /* @__PURE__ */ new Map();
  for (const name of names) {
    const source = regularPath(directory, name);
    const bytes = fs23.existsSync(source) ? fs23.readFileSync(source) : void 0;
    previous.set(name, bytes);
    if (bytes) {
      const target = path23.join(backup, name);
      fs23.mkdirSync(path23.dirname(target), { recursive: true });
      fs23.writeFileSync(target, bytes, { flag: "wx" });
    }
  }
  const record = { schemaVersion: 1, version, backup: path23.basename(backup), files: names, absent: names.filter((name) => !previous.has(name) || previous.get(name) === void 0) };
  fs23.writeFileSync(path23.join(backup, "recovery.json"), JSON.stringify(record));
  const fd = fs23.openSync(marker, "wx");
  try {
    fs23.writeFileSync(fd, JSON.stringify(record));
    fs23.fsyncSync(fd);
  } finally {
    fs23.closeSync(fd);
  }
  const written = [];
  try {
    for (const name of names) {
      lease.assertOwned();
      const target = regularPath(directory, name, true);
      written.push(name);
      fs23.writeFileSync(target, files2[name]);
    }
    const installed = Object.fromEntries(names.map((name) => [name, fs23.readFileSync(regularPath(directory, name))]));
    verifyRelease(installed, version);
    fs23.unlinkSync(marker);
    return { version, backup, installed: names };
  } catch (error) {
    for (const name of written.reverse()) {
      const target = regularPath(directory, name);
      const bytes = previous.get(name);
      if (bytes !== void 0) fs23.writeFileSync(target, bytes);
      else if (fs23.existsSync(target)) fs23.unlinkSync(target);
    }
    fs23.unlinkSync(marker);
    throw error;
  }
}

// release-maintenance.ts
async function maintainRelease(options) {
  const names = [...RELEASE_FILES, RELEASE_DESCRIPTOR];
  const regular = (file) => {
    const stat = fs24.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error("Unsafe maintenance file");
    return fs24.readFileSync(file);
  };
  const source = physicalPath(options.sourceDirectory), files2 = {};
  for (const name of names) {
    let current = source;
    for (const part of name.split("/").slice(0, -1)) {
      current = path24.join(current, part);
      if (fs24.lstatSync(current).isSymbolicLink() || !fs24.statSync(current).isDirectory()) throw new Error("Unsafe package directory");
    }
    files2[name] = regular(path24.join(source, name));
  }
  verifyRelease(files2, options.version);
  const location = resolveInstalledWorkflowLocation(options.vault), identity = dispositionLocation(location);
  if (source === location.installationDirectory) throw new Error("Run maintenance from a separate extracted package");
  let abandonmentEvidence;
  const assertContext = () => {
    const current = dispositionLocation(resolveInstalledWorkflowLocation(options.vault));
    if (JSON.stringify(current) !== JSON.stringify(identity)) throw new Error("Maintenance installation identity changed");
    assertPackageMaintenanceSafe(location.installationDirectory);
    const catalog = JSON.parse(regular(location.configurationFile).toString("utf8"));
    if (["tasks", "workflows"].some((k) => !Array.isArray(catalog[k]))) throw new Error("Invalid maintenance catalog");
    const checkpoints = new Map(fs24.readdirSync(location.runtimeDirectory).filter((n) => /^[a-zA-Z0-9-]+\.json$/.test(n)).map((name) => {
      const state = readExecutionCheckpoint(location.runtimeDirectory, name.slice(0, -5));
      return [state.runId, state];
    }));
    const evidence = /* @__PURE__ */ new Map();
    for (const state of checkpoints.values()) if (state.abandonment) for (const name of [state.runId + ".json", state.abandonment.snapshot]) {
      evidence.set(name, regular(path24.join(location.runtimeDirectory, name)));
    }
    if (abandonmentEvidence && (evidence.size !== abandonmentEvidence.size || [...evidence].some(([name, bytes]) => !abandonmentEvidence.get(name)?.equals(bytes)))) throw new Error("Abandonment evidence changed during maintenance");
    abandonmentEvidence ??= evidence;
    assertIdleCatalog(Object.fromEntries(["tasks", "workflows"].map((kind) => [kind, catalog[kind].filter((entry) => {
      const binding = entry.runtimeExecution;
      return binding && (!checkpoints.has(binding.runId) || checkpoints.get(binding.runId).phase === "abandoned");
    })])), checkpoints);
  };
  assertContext();
  if (fs24.existsSync(path24.join(location.runtimeDirectory, "execution.lock"))) throw new Error("Unload AutoOC normally; execution reservation is present");
  const executions = fs24.readdirSync(location.runtimeDirectory).filter((n) => /^[a-zA-Z0-9-]+\.json$/.test(n)).sort().map((name) => {
    const state = readExecutionCheckpoint(location.runtimeDirectory, name.slice(0, -5));
    if (["ready", "in_flight"].includes(state.phase)) return { runId: state.runId, workflowId: state.workflowId, phase: state.phase, revision: state.revision, causes: [], disposition: void 0, requiresReconciliation: true };
    return inspectTerminalExecution({ vault: location.vault, runId: state.runId });
  });
  const installedVersion = JSON.parse(regular(path24.join(location.installationDirectory, "manifest.json")).toString("utf8")).version;
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
    backup = path24.join(location.runtimeDirectory, "maintenance-backup-" + (0, import_crypto9.randomUUID)());
    fs24.mkdirSync(backup, { mode: 448 });
    const hashes = {};
    const save = (relative6, bytes) => {
      lease.assertOwned();
      const target = path24.join(backup, relative6);
      fs24.mkdirSync(path24.dirname(target), { recursive: true, mode: 448 });
      const fd = fs24.openSync(target, "wx", 384);
      try {
        fs24.writeFileSync(fd, bytes);
        fs24.fsyncSync(fd);
      } finally {
        fs24.closeSync(fd);
      }
      const digest = (b) => (0, import_crypto9.createHash)("sha256").update(b).digest("hex");
      if (digest(regular(target)) !== digest(bytes)) throw new Error("Maintenance backup verification failed");
      hashes[relative6] = digest(bytes);
    };
    for (const name of names) save(name, regular(path24.join(location.installationDirectory, name)));
    const catalog = regular(location.configurationFile);
    save("data.json", catalog);
    const journals = fs24.readdirSync(location.runtimeDirectory).filter((n) => /^[a-zA-Z0-9-]+\.json$/.test(n) || /^(abandonment|disposition)-[a-zA-Z0-9-]+\.snapshot$/.test(n));
    for (const name of journals) save("runtime/" + name, regular(path24.join(location.runtimeDirectory, name)));
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

// terminal-session-host.ts
var http = __toESM(require("http"));

// terminal-pty.ts
var import_node_crypto = require("node:crypto");
var import_node_fs = require("node:fs");
var import_node_module = require("node:module");
var import_node_os = require("node:os");
var path25 = __toESM(require("node:path"));
var import_node_zlib = require("node:zlib");
var TERMINAL_SUPPORT = Object.freeze({
  package: "node-pty",
  version: "1.1.0",
  license: "MIT",
  url: "https://registry.npmjs.org/node-pty/-/node-pty-1.1.0.tgz",
  integrity: "sha512-20JqtutY6JPXTUnL0ij1uad7Qe1baT46lyolh2sSENDd4sTzKZ4nmAFkeAARDKwmlLjPx6XKRlwRUxwjOy+lUg=="
});
var DIRECTORY = "node-pty-1.1.0-win32-x64";
var ARCHIVE = "source.tgz";
var MAX_DOWNLOAD = 48 * 1024 * 1024;
var MAX_UNPACKED = 96 * 1024 * 1024;
function supportedHost() {
  if (process.platform !== "win32" || process.arch !== "x64") {
    throw new Error(`Terminal PTY: solo Windows x64 esta soportado; host ${process.platform}/${process.arch}. No se descargara ni compilara otro binario.`);
  }
  const version = (0, import_node_os.release)().split(".").map(Number);
  if (version[0] < 10 || !Number.isFinite(version[2]) || version[2] < 18309) {
    throw new Error(`Terminal PTY: se requiere Windows build 18309 o posterior (recomendado Windows 10 1903+/11); actual ${(0, import_node_os.release)()}.`);
  }
  if (Number(process.versions.napi || 0) < 8) {
    throw new Error("Terminal PTY: se requiere Node-API >= 8. Actualiza el instalador de Obsidian/Electron, no solo la aplicacion.");
  }
}
async function directoryWithoutLink(directory) {
  const stat = await import_node_fs.promises.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`Terminal PTY: se esperaba un directorio real sin enlaces: ${directory}`);
  }
}
async function supportRoot(pluginDirectory, create) {
  supportedHost();
  if (!path25.isAbsolute(pluginDirectory)) throw new Error("Terminal PTY: pluginDirectory debe ser una ruta absoluta.");
  const plugin = await import_node_fs.promises.realpath(pluginDirectory);
  await directoryWithoutLink(plugin);
  const root = path25.join(plugin, "terminal-support");
  if (create) await import_node_fs.promises.mkdir(root).catch((error) => {
    if (error.code !== "EEXIST") throw error;
  });
  try {
    await directoryWithoutLink(root);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("Terminal PTY: soporte no instalado. Usa el boton opt-in que llama installTerminalSupport(pluginDirectory).");
    }
    throw error;
  }
  return root;
}
async function contents(archive) {
  if (archive.length > MAX_DOWNLOAD || `sha512-${(0, import_node_crypto.createHash)("sha512").update(archive).digest("base64")}` !== TERMINAL_SUPPORT.integrity) {
    throw new Error("Terminal PTY: integridad SHA-512 del paquete incorrecta; no se ejecutara su contenido.");
  }
  const tar = await new Promise((resolve8, reject) => {
    (0, import_node_zlib.gunzip)(archive, { maxOutputLength: MAX_UNPACKED }, (error, data) => error ? reject(error) : resolve8(data));
  });
  const result = /* @__PURE__ */ new Map();
  const field = (header, start, end) => header.subarray(start, end).toString("utf8").split("\0")[0];
  for (let offset = 0; offset + 512 <= tar.length; ) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = field(header, 0, 100);
    const sizeText = field(header, 124, 136).trim();
    const checksumText = field(header, 148, 156).trim();
    let checksum = 0;
    for (let i = 0; i < 512; i++) checksum += i >= 148 && i < 156 ? 32 : header[i];
    const size = parseInt(sizeText, 8);
    if (!/^[0-7]+$/.test(sizeText) || !/^[0-7]+$/.test(checksumText) || checksum !== parseInt(checksumText, 8) || header[156] !== 48 || field(header, 345, 500) || !name.startsWith("package/") || !/^package\/[a-zA-Z0-9_./-]+$/.test(name) || name.split("/").some((part) => !part || part === "." || part === "..") || offset + 512 + size > tar.length) {
      throw new Error("Terminal PTY: formato tar no admitido; no se extraeran enlaces ni rutas arbitrarias.");
    }
    const relative6 = name.slice("package/".length);
    const selected = relative6 === "package.json" || relative6 === "LICENSE" || relative6.startsWith("lib/") && relative6.endsWith(".js") && !relative6.endsWith(".test.js") || relative6 === "deps/winpty/LICENSE" || relative6 === "prebuilds/win32-x64/conpty.node" || relative6 === "prebuilds/win32-x64/conpty_console_list.node" || relative6.startsWith("prebuilds/win32-x64/conpty/");
    if (selected) {
      if (result.has(relative6)) throw new Error("Terminal PTY: entrada duplicada en tar.");
      result.set(relative6, tar.subarray(offset + 512, offset + 512 + size));
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  for (const required of [
    "package.json",
    "LICENSE",
    "lib/index.js",
    "lib/worker/conoutSocketWorker.js",
    "prebuilds/win32-x64/conpty.node",
    "prebuilds/win32-x64/conpty/conpty.dll",
    "prebuilds/win32-x64/conpty/OpenConsole.exe"
  ]) {
    if (!result.has(required)) throw new Error(`Terminal PTY: paquete incompleto, falta ${required}.`);
  }
  const metadata = JSON.parse(result.get("package.json").toString("utf8"));
  if (metadata.name !== TERMINAL_SUPPORT.package || metadata.version !== TERMINAL_SUPPORT.version || metadata.license !== "MIT") {
    throw new Error("Terminal PTY: identidad/licencia del paquete inesperada.");
  }
  return result;
}
async function readRegular(file, maxSize) {
  const stat = await import_node_fs.promises.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxSize) {
    throw new Error(`Terminal PTY: fichero no admitido: ${file}`);
  }
  return import_node_fs.promises.readFile(file);
}
async function verify(directory) {
  await directoryWithoutLink(directory);
  const files2 = await contents(await readRegular(path25.join(directory, ARCHIVE), MAX_DOWNLOAD));
  const directories = /* @__PURE__ */ new Set();
  for (const name of files2.keys()) {
    let parent = path25.posix.dirname(name);
    while (parent !== ".") {
      directories.add(parent);
      parent = path25.posix.dirname(parent);
    }
  }
  async function walk(relative6) {
    for (const entry of await import_node_fs.promises.readdir(path25.join(directory, relative6), { withFileTypes: true })) {
      const name = relative6 ? `${relative6}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Terminal PTY: enlace no admitido: ${name}`);
      if (entry.isDirectory() && directories.has(name)) await walk(name);
      else if (entry.isFile() && (files2.has(name) || name === ARCHIVE)) continue;
      else throw new Error(`Terminal PTY: contenido inesperado: ${name}. No se reparara ni borrara automaticamente.`);
    }
  }
  await walk("");
  for (const [name, expected] of files2) {
    const actual = await readRegular(path25.join(directory, name), expected.length);
    if (!actual.equals(expected)) throw new Error(`Terminal PTY: fichero alterado: ${name}. Restaura el soporte original y reinicia Obsidian.`);
  }
}
async function verifyTerminalSupport(pluginDirectory) {
  const root = await supportRoot(pluginDirectory, false);
  const directory = path25.join(root, DIRECTORY);
  try {
    await verify(directory);
  } catch (error) {
    throw new Error(`Terminal PTY: soporte ausente, incompleto o alterado. Usa la instalacion opt-in si no existe; no se reparara automaticamente. ${String(error)}`);
  }
  return directory;
}
async function loadTerminalPty(pluginDirectory) {
  const directory = await verifyTerminalSupport(pluginDirectory);
  let nativeRequire = (0, import_node_module.createRequire)(path25.join(directory, "package.json"));
  if (process.type === "renderer") {
    try {
      const obsidianRequire = window.require;
      const remote = obsidianRequire?.("electron")?.remote;
      if (typeof remote?.require !== "function") throw new Error("electron.remote.require no disponible");
      nativeRequire = remote.require("node:module").createRequire(path25.join(directory, "package.json"));
    } catch (error) {
      throw new Error(`Terminal PTY: el renderer requiere el puente electron.remote de Obsidian para ejecutar node-pty/workers en main. No se creara ningun PTY ni se habilitaran permisos nuevos. ${String(error)}`);
    }
  }
  let conpty;
  let backend;
  try {
    conpty = nativeRequire(path25.join(directory, "prebuilds/win32-x64/conpty.node"));
    backend = nativeRequire(path25.join(directory, "lib/index.js"));
    if (typeof backend.spawn !== "function") throw new Error("Falta spawn en node-pty.");
  } catch (error) {
    throw new Error(`Terminal PTY: no se pudo cargar el prebuild Node-API Windows x64 (Electron ${process.versions.electron || "no disponible"}, Node ${process.versions.node}, N-API ${process.versions.napi}). Comprueba el instalador de Obsidian y el runtime Microsoft Visual C++ 2015-2022 x64; no se intentara node-gyp. ${String(error)}`);
  }
  return {
    spawn(file, args, options) {
      if (!file || file.includes("\0") || !Array.isArray(args) || args.some((arg) => typeof arg !== "string" || arg.includes("\0"))) {
        throw new Error("Terminal PTY: ejecutable/argumentos invalidos; usa un ejecutable real, no un archivo .cmd como shell.");
      }
      const dimensions = (cols, rows) => {
        if (![cols, rows].every((n) => Number.isInteger(n) && n > 0 && n <= 32767)) {
          throw new Error("Terminal PTY: cols/rows deben ser enteros entre 1 y 32767.");
        }
      };
      dimensions(options.cols, options.rows);
      if (!path25.isAbsolute(options.cwd) || options.cwd.includes("\0") || !options.name || options.name.includes("\0")) {
        throw new Error("Terminal PTY: cwd absoluto y name no vacio son obligatorios.");
      }
      const env = { ...options.env };
      if (Object.entries(env).some(([key, value]) => !key || key.includes("=") || key.includes("\0") || typeof value !== "string" || value.includes("\0")) || !Object.keys(env).some((key) => key.toLowerCase() === "systemroot" && env[key])) {
        throw new Error("Terminal PTY: env debe contener solo strings validos e incluir SystemRoot (necesario para PowerShell). No se hereda process.env implicitamente.");
      }
      let terminal;
      try {
        terminal = backend.spawn(file, [...args], { ...options, env, useConpty: true, useConptyDll: true });
      } catch (error) {
        throw new Error(`Terminal PTY: no se pudo iniciar el proceso. Comprueba ejecutable, cwd y permisos. ${String(error)}`);
      }
      const agent = terminal._agent;
      const listeners = /* @__PURE__ */ new Set();
      let stopping = false;
      let exited = false;
      let nativeExitCode;
      let shutdownRequested = false;
      let inputClosed = false;
      let outputClosed = false;
      let stop;
      let cleanup;
      let resolveStop;
      let rejectStop;
      let deadline;
      let drain;
      const finish = (exitCode) => {
        if (cleanup || exited) return;
        nativeExitCode = exitCode;
        clearInterval(observe);
        if (drain) clearTimeout(drain);
        cleanup = (async () => {
          terminal._deferreds = [];
          if (!inputClosed) {
            agent.inSocket.destroy();
            inputClosed = true;
          }
          if (!outputClosed) {
            agent.outSocket.destroy();
            outputClosed = true;
          }
          const connection = agent._conoutSocketWorker;
          connection._drainTimeout?.close();
          await connection._worker.terminate();
          exited = true;
        })();
        void cleanup.then(() => {
          if (deadline) clearTimeout(deadline);
          resolveStop?.();
          const current = [...listeners];
          listeners.clear();
          for (const listener of current) {
            try {
              listener({ exitCode });
            } catch (error) {
              console.error("Terminal PTY: error en onExit.", error);
            }
          }
        }, (error) => {
          cleanup = void 0;
          if (deadline) clearTimeout(deadline);
          const failure = new Error(`Terminal PTY: salida nativa confirmada, pero fallo el cleanup de sockets/worker: ${String(error)}`);
          rejectStop?.(failure);
          console.error(failure);
        });
      };
      const observeExit = () => {
        const code = agent.exitCode;
        if (typeof code !== "number" || !Number.isFinite(code) || nativeExitCode !== void 0) return;
        nativeExitCode = code;
        clearInterval(observe);
        if (stopping) finish(code);
        else if (!drain) drain = setTimeout(() => finish(code), 1e3);
      };
      const observe = setInterval(observeExit, 25);
      return {
        get pid() {
          return terminal.pid;
        },
        write(data) {
          if (!stopping && nativeExitCode === void 0) terminal.write(data);
        },
        resize(cols, rows) {
          dimensions(cols, rows);
          if (!stopping && nativeExitCode === void 0) terminal.resize(cols, rows);
        },
        kill() {
          if (exited) return Promise.resolve();
          if (stop) return stop;
          stop = new Promise((resolve8, reject) => {
            resolveStop = resolve8;
            rejectStop = reject;
          });
          const attempt = stop;
          void attempt.catch(() => {
            if (stop === attempt) stop = void 0;
          });
          deadline = setTimeout(() => rejectStop(new Error("Terminal PTY: parada no confirmada en 5 s. Se conserva la observacion del proceso propio; no asumir que termino ni matar por PID.")), 5e3);
          if (nativeExitCode !== void 0) {
            finish(nativeExitCode);
            return attempt;
          }
          if (!agent || agent._useConpty !== true || agent._useConptyDll !== true || agent._ptyNative !== conpty || !Number.isInteger(agent._pty) || agent._pty <= 0 || agent.innerPid !== terminal.pid || terminal.pid <= 0 || terminal.pid === process.pid || typeof agent.kill !== "function" || !Array.isArray(terminal._deferreds) || typeof agent._conoutSocketWorker?._worker?.terminate !== "function") {
            clearTimeout(deadline);
            rejectStop(new Error("Terminal PTY: contrato privado node-pty 1.1.0 incompatible; no se puede confirmar una parada segura. No se ha matado ningun PID."));
            return attempt;
          }
          stopping = true;
          terminal._deferreds = [];
          try {
            if (!shutdownRequested && agent.exitCode === void 0) {
              shutdownRequested = true;
              agent.kill();
            }
            observeExit();
          } catch (error) {
            clearTimeout(deadline);
            rejectStop(new Error(`Terminal PTY: fallo el cierre ConPTY de la instancia propia; parada no confirmada. ${String(error)}`));
          }
          return attempt;
        },
        onData: (listener) => terminal.onData(listener),
        onExit(listener) {
          if (!exited) listeners.add(listener);
          return { dispose() {
            listeners.delete(listener);
          } };
        }
      };
    }
  };
}

// terminal-session-host.ts
function notifyParent(message) {
  if (process.connected) process.send?.(message, () => {
  });
}
var page = `<!doctype html><html lang="es"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AutoOC \xB7 Terminal independiente</title><link rel="stylesheet" href="/terminal.css">
<style>html,body{height:100%;margin:0;background:#181818;color:#eee;font:14px system-ui}
body{display:flex;flex-direction:column}header{padding:10px;display:flex;gap:16px;align-items:center}
#terminal{flex:1;min-height:0;padding:8px}button{font:inherit}#status{flex:1}</style>
<header><span id="status" role="status">Conectando\u2026</span><button id="stop">Detener sesi\xF3n</button></header>
<div id="terminal" aria-label="Terminal AutoOC"></div>
<script src="/terminal.js"></script><script src="/fit.js"></script><script src="/client.js"></script></html>`;
var browserClient = `"use strict";
const token = location.hash.slice(1);
const status = document.getElementById('status');
const terminal = new Terminal({cursorBlink:true,screenReaderMode:true,scrollback:5000});
const fit = new FitAddon.FitAddon(); terminal.loadAddon(fit); terminal.open(document.getElementById('terminal'));
let sequence=0, exited=false, busy=false;
let inputQueue=Promise.resolve();
async function command(action, body={}) {
  const response=await fetch('/'+action,{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error(await response.text()); return response.json();
}
function resize(){fit.fit();void command('resize',{cols:terminal.cols,rows:terminal.rows}).catch(()=>{});}
new ResizeObserver(resize).observe(document.getElementById('terminal'));
terminal.onData(data=>{if(!exited)inputQueue=inputQueue.then(async()=>{
  for(const part of data.match(/[\\s\\S]{1,4096}/gu)||[])await command('input',{data:part});
}).catch(()=>status.textContent='Env\xEDo de entrada no confirmado; no se ha reintentado.');});
document.getElementById('stop').onclick=async()=>{
  if(!confirm('\xBFDetener la ejecuci\xF3n? Cerrar esta pesta\xF1a solo desconecta la vista.'))return;
  try{await command('stop');}catch(error){status.textContent=error.message;}
};
async function poll(){
  if(busy||exited)return;busy=true;
  try{
    const state=await command('poll',{sequence});
    if(state.gap)terminal.write('\\r\\n[Salida anterior truncada]\\r\\n');
    for(const entry of state.entries){terminal.write(entry.data);sequence=entry.sequence;}
    exited=state.exited;
    if(exited){terminal.write('\\r\\n[Proceso finalizado: '+state.exitCode+']\\r\\n');status.textContent='Sesi\xF3n finalizada';}
    else{await command('external-ready');status.textContent=state.retained?'Independiente de Obsidian \xB7 cerrar esta pesta\xF1a no detiene la sesi\xF3n':'Conectada \xB7 esperando confirmaci\xF3n de AutoOC';}
  }catch(error){status.textContent='Sin conexi\xF3n: '+error.message;}finally{busy=false;}
}
resize();terminal.focus();void poll();setInterval(poll,100);
`;
async function runTerminalSessionHost(config) {
  if (!/^[a-f0-9]{64}$/.test(config.token)) throw new Error("Invalid terminal session token");
  let cancelled = false;
  process.on("message", (message) => {
    if (message?.type === "cancel") cancelled = true;
  });
  const backend = await loadTerminalPty(config.pluginDirectory);
  if (cancelled || !process.connected) {
    if (config.auxiliaryDirectory) completeAuxiliaryDirectory(config.auxiliaryDirectory, "interactive");
    throw new Error("Terminal startup cancelled before spawn");
  }
  const pty = backend.spawn(config.file, config.args, config.options);
  let retained = false, exited = false, exitCode, sequence = 0, bytes = 0;
  let externalReady = 0;
  const entries = [];
  const remember = (data) => {
    for (let offset = 0; offset < data.length; offset += 16384) {
      const part = data.slice(offset, offset + 16384);
      entries.push({ sequence: ++sequence, data: part });
      bytes += part.length;
    }
    while (bytes > 1024 * 1024 && entries.length > 1) bytes -= entries.shift().data.length;
  };
  pty.onData(remember);
  pty.onExit((event) => {
    exited = true;
    exitCode = event.exitCode;
    if (config.auxiliaryDirectory) completeAuxiliaryDirectory(config.auxiliaryDirectory, "interactive");
    setTimeout(() => process.exit(0), 3e4);
  });
  process.on("disconnect", () => {
    if (!retained) void pty.kill().catch(() => {
      console.error("AutoOC terminal cleanup is unconfirmed");
    });
  });
  const server = http.createServer(async (request, response) => {
    const address2 = server.address();
    const authority = typeof address2 === "object" && address2 ? `127.0.0.1:${address2.port}` : "";
    const reply = (code, body) => {
      response.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify(body));
    };
    if (request.headers.host !== authority || request.headers.origin && request.headers.origin !== `http://${authority}`) {
      reply(403, "Forbidden origin");
      return;
    }
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    const assets = {
      "/": ["text/html; charset=utf-8", page],
      "/client.js": ["text/javascript", browserClient],
      "/terminal.js": ["text/javascript", '!function(e,t){if("object"==typeof exports&&"object"==typeof module)module.exports=t();else if("function"==typeof define&&define.amd)define([],t);else{var i=t();for(var s in i)("object"==typeof exports?exports:e)[s]=i[s]}}(globalThis,(()=>(()=>{"use strict";var e={4567:function(e,t,i){var s=this&&this.__decorate||function(e,t,i,s){var r,n=arguments.length,o=n<3?t:null===s?s=Object.getOwnPropertyDescriptor(t,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)o=Reflect.decorate(e,t,i,s);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(o=(n<3?r(o):n>3?r(t,i,o):r(t,i))||o);return n>3&&o&&Object.defineProperty(t,i,o),o},r=this&&this.__param||function(e,t){return function(i,s){t(i,s,e)}};Object.defineProperty(t,"__esModule",{value:!0}),t.AccessibilityManager=void 0;const n=i(9042),o=i(9924),a=i(844),h=i(4725),c=i(2585),l=i(3656);let d=t.AccessibilityManager=class extends a.Disposable{constructor(e,t,i,s){super(),this._terminal=e,this._coreBrowserService=i,this._renderService=s,this._rowColumns=new WeakMap,this._liveRegionLineCount=0,this._charsToConsume=[],this._charsToAnnounce="",this._accessibilityContainer=this._coreBrowserService.mainDocument.createElement("div"),this._accessibilityContainer.classList.add("xterm-accessibility"),this._rowContainer=this._coreBrowserService.mainDocument.createElement("div"),this._rowContainer.setAttribute("role","list"),this._rowContainer.classList.add("xterm-accessibility-tree"),this._rowElements=[];for(let e=0;e<this._terminal.rows;e++)this._rowElements[e]=this._createAccessibilityTreeNode(),this._rowContainer.appendChild(this._rowElements[e]);if(this._topBoundaryFocusListener=e=>this._handleBoundaryFocus(e,0),this._bottomBoundaryFocusListener=e=>this._handleBoundaryFocus(e,1),this._rowElements[0].addEventListener("focus",this._topBoundaryFocusListener),this._rowElements[this._rowElements.length-1].addEventListener("focus",this._bottomBoundaryFocusListener),this._refreshRowsDimensions(),this._accessibilityContainer.appendChild(this._rowContainer),this._liveRegion=this._coreBrowserService.mainDocument.createElement("div"),this._liveRegion.classList.add("live-region"),this._liveRegion.setAttribute("aria-live","assertive"),this._accessibilityContainer.appendChild(this._liveRegion),this._liveRegionDebouncer=this.register(new o.TimeBasedDebouncer(this._renderRows.bind(this))),!this._terminal.element)throw new Error("Cannot enable accessibility before Terminal.open");this._terminal.element.insertAdjacentElement("afterbegin",this._accessibilityContainer),this.register(this._terminal.onResize((e=>this._handleResize(e.rows)))),this.register(this._terminal.onRender((e=>this._refreshRows(e.start,e.end)))),this.register(this._terminal.onScroll((()=>this._refreshRows()))),this.register(this._terminal.onA11yChar((e=>this._handleChar(e)))),this.register(this._terminal.onLineFeed((()=>this._handleChar("\\n")))),this.register(this._terminal.onA11yTab((e=>this._handleTab(e)))),this.register(this._terminal.onKey((e=>this._handleKey(e.key)))),this.register(this._terminal.onBlur((()=>this._clearLiveRegion()))),this.register(this._renderService.onDimensionsChange((()=>this._refreshRowsDimensions()))),this.register((0,l.addDisposableDomListener)(document,"selectionchange",(()=>this._handleSelectionChange()))),this.register(this._coreBrowserService.onDprChange((()=>this._refreshRowsDimensions()))),this._refreshRows(),this.register((0,a.toDisposable)((()=>{this._accessibilityContainer.remove(),this._rowElements.length=0})))}_handleTab(e){for(let t=0;t<e;t++)this._handleChar(" ")}_handleChar(e){this._liveRegionLineCount<21&&(this._charsToConsume.length>0?this._charsToConsume.shift()!==e&&(this._charsToAnnounce+=e):this._charsToAnnounce+=e,"\\n"===e&&(this._liveRegionLineCount++,21===this._liveRegionLineCount&&(this._liveRegion.textContent+=n.tooMuchOutput)))}_clearLiveRegion(){this._liveRegion.textContent="",this._liveRegionLineCount=0}_handleKey(e){this._clearLiveRegion(),/\\p{Control}/u.test(e)||this._charsToConsume.push(e)}_refreshRows(e,t){this._liveRegionDebouncer.refresh(e,t,this._terminal.rows)}_renderRows(e,t){const i=this._terminal.buffer,s=i.lines.length.toString();for(let r=e;r<=t;r++){const e=i.lines.get(i.ydisp+r),t=[],n=e?.translateToString(!0,void 0,void 0,t)||"",o=(i.ydisp+r+1).toString(),a=this._rowElements[r];a&&(0===n.length?(a.innerText="\xA0",this._rowColumns.set(a,[0,1])):(a.textContent=n,this._rowColumns.set(a,t)),a.setAttribute("aria-posinset",o),a.setAttribute("aria-setsize",s))}this._announceCharacters()}_announceCharacters(){0!==this._charsToAnnounce.length&&(this._liveRegion.textContent+=this._charsToAnnounce,this._charsToAnnounce="")}_handleBoundaryFocus(e,t){const i=e.target,s=this._rowElements[0===t?1:this._rowElements.length-2];if(i.getAttribute("aria-posinset")===(0===t?"1":`${this._terminal.buffer.lines.length}`))return;if(e.relatedTarget!==s)return;let r,n;if(0===t?(r=i,n=this._rowElements.pop(),this._rowContainer.removeChild(n)):(r=this._rowElements.shift(),n=i,this._rowContainer.removeChild(r)),r.removeEventListener("focus",this._topBoundaryFocusListener),n.removeEventListener("focus",this._bottomBoundaryFocusListener),0===t){const e=this._createAccessibilityTreeNode();this._rowElements.unshift(e),this._rowContainer.insertAdjacentElement("afterbegin",e)}else{const e=this._createAccessibilityTreeNode();this._rowElements.push(e),this._rowContainer.appendChild(e)}this._rowElements[0].addEventListener("focus",this._topBoundaryFocusListener),this._rowElements[this._rowElements.length-1].addEventListener("focus",this._bottomBoundaryFocusListener),this._terminal.scrollLines(0===t?-1:1),this._rowElements[0===t?1:this._rowElements.length-2].focus(),e.preventDefault(),e.stopImmediatePropagation()}_handleSelectionChange(){if(0===this._rowElements.length)return;const e=document.getSelection();if(!e)return;if(e.isCollapsed)return void(this._rowContainer.contains(e.anchorNode)&&this._terminal.clearSelection());if(!e.anchorNode||!e.focusNode)return void console.error("anchorNode and/or focusNode are null");let t={node:e.anchorNode,offset:e.anchorOffset},i={node:e.focusNode,offset:e.focusOffset};if((t.node.compareDocumentPosition(i.node)&Node.DOCUMENT_POSITION_PRECEDING||t.node===i.node&&t.offset>i.offset)&&([t,i]=[i,t]),t.node.compareDocumentPosition(this._rowElements[0])&(Node.DOCUMENT_POSITION_CONTAINED_BY|Node.DOCUMENT_POSITION_FOLLOWING)&&(t={node:this._rowElements[0].childNodes[0],offset:0}),!this._rowContainer.contains(t.node))return;const s=this._rowElements.slice(-1)[0];if(i.node.compareDocumentPosition(s)&(Node.DOCUMENT_POSITION_CONTAINED_BY|Node.DOCUMENT_POSITION_PRECEDING)&&(i={node:s,offset:s.textContent?.length??0}),!this._rowContainer.contains(i.node))return;const r=({node:e,offset:t})=>{const i=e instanceof Text?e.parentNode:e;let s=parseInt(i?.getAttribute("aria-posinset"),10)-1;if(isNaN(s))return console.warn("row is invalid. Race condition?"),null;const r=this._rowColumns.get(i);if(!r)return console.warn("columns is null. Race condition?"),null;let n=t<r.length?r[t]:r.slice(-1)[0]+1;return n>=this._terminal.cols&&(++s,n=0),{row:s,column:n}},n=r(t),o=r(i);if(n&&o){if(n.row>o.row||n.row===o.row&&n.column>=o.column)throw new Error("invalid range");this._terminal.select(n.column,n.row,(o.row-n.row)*this._terminal.cols-n.column+o.column)}}_handleResize(e){this._rowElements[this._rowElements.length-1].removeEventListener("focus",this._bottomBoundaryFocusListener);for(let e=this._rowContainer.children.length;e<this._terminal.rows;e++)this._rowElements[e]=this._createAccessibilityTreeNode(),this._rowContainer.appendChild(this._rowElements[e]);for(;this._rowElements.length>e;)this._rowContainer.removeChild(this._rowElements.pop());this._rowElements[this._rowElements.length-1].addEventListener("focus",this._bottomBoundaryFocusListener),this._refreshRowsDimensions()}_createAccessibilityTreeNode(){const e=this._coreBrowserService.mainDocument.createElement("div");return e.setAttribute("role","listitem"),e.tabIndex=-1,this._refreshRowDimensions(e),e}_refreshRowsDimensions(){if(this._renderService.dimensions.css.cell.height){this._accessibilityContainer.style.width=`${this._renderService.dimensions.css.canvas.width}px`,this._rowElements.length!==this._terminal.rows&&this._handleResize(this._terminal.rows);for(let e=0;e<this._terminal.rows;e++)this._refreshRowDimensions(this._rowElements[e])}}_refreshRowDimensions(e){e.style.height=`${this._renderService.dimensions.css.cell.height}px`}};t.AccessibilityManager=d=s([r(1,c.IInstantiationService),r(2,h.ICoreBrowserService),r(3,h.IRenderService)],d)},3614:(e,t)=>{function i(e){return e.replace(/\\r?\\n/g,"\\r")}function s(e,t){return t?"\x1B[200~"+e+"\x1B[201~":e}function r(e,t,r,n){e=s(e=i(e),r.decPrivateModes.bracketedPasteMode&&!0!==n.rawOptions.ignoreBracketedPasteMode),r.triggerDataEvent(e,!0),t.value=""}function n(e,t,i){const s=i.getBoundingClientRect(),r=e.clientX-s.left-10,n=e.clientY-s.top-10;t.style.width="20px",t.style.height="20px",t.style.left=`${r}px`,t.style.top=`${n}px`,t.style.zIndex="1000",t.focus()}Object.defineProperty(t,"__esModule",{value:!0}),t.rightClickHandler=t.moveTextAreaUnderMouseCursor=t.paste=t.handlePasteEvent=t.copyHandler=t.bracketTextForPaste=t.prepareTextForTerminal=void 0,t.prepareTextForTerminal=i,t.bracketTextForPaste=s,t.copyHandler=function(e,t){e.clipboardData&&e.clipboardData.setData("text/plain",t.selectionText),e.preventDefault()},t.handlePasteEvent=function(e,t,i,s){e.stopPropagation(),e.clipboardData&&r(e.clipboardData.getData("text/plain"),t,i,s)},t.paste=r,t.moveTextAreaUnderMouseCursor=n,t.rightClickHandler=function(e,t,i,s,r){n(e,t,i),r&&s.rightClickSelect(e),t.value=s.selectionText,t.select()}},7239:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.ColorContrastCache=void 0;const s=i(1505);t.ColorContrastCache=class{constructor(){this._color=new s.TwoKeyMap,this._css=new s.TwoKeyMap}setCss(e,t,i){this._css.set(e,t,i)}getCss(e,t){return this._css.get(e,t)}setColor(e,t,i){this._color.set(e,t,i)}getColor(e,t){return this._color.get(e,t)}clear(){this._color.clear(),this._css.clear()}}},3656:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.addDisposableDomListener=void 0,t.addDisposableDomListener=function(e,t,i,s){e.addEventListener(t,i,s);let r=!1;return{dispose:()=>{r||(r=!0,e.removeEventListener(t,i,s))}}}},3551:function(e,t,i){var s=this&&this.__decorate||function(e,t,i,s){var r,n=arguments.length,o=n<3?t:null===s?s=Object.getOwnPropertyDescriptor(t,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)o=Reflect.decorate(e,t,i,s);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(o=(n<3?r(o):n>3?r(t,i,o):r(t,i))||o);return n>3&&o&&Object.defineProperty(t,i,o),o},r=this&&this.__param||function(e,t){return function(i,s){t(i,s,e)}};Object.defineProperty(t,"__esModule",{value:!0}),t.Linkifier=void 0;const n=i(3656),o=i(8460),a=i(844),h=i(2585),c=i(4725);let l=t.Linkifier=class extends a.Disposable{get currentLink(){return this._currentLink}constructor(e,t,i,s,r){super(),this._element=e,this._mouseService=t,this._renderService=i,this._bufferService=s,this._linkProviderService=r,this._linkCacheDisposables=[],this._isMouseOut=!0,this._wasResized=!1,this._activeLine=-1,this._onShowLinkUnderline=this.register(new o.EventEmitter),this.onShowLinkUnderline=this._onShowLinkUnderline.event,this._onHideLinkUnderline=this.register(new o.EventEmitter),this.onHideLinkUnderline=this._onHideLinkUnderline.event,this.register((0,a.getDisposeArrayDisposable)(this._linkCacheDisposables)),this.register((0,a.toDisposable)((()=>{this._lastMouseEvent=void 0,this._activeProviderReplies?.clear()}))),this.register(this._bufferService.onResize((()=>{this._clearCurrentLink(),this._wasResized=!0}))),this.register((0,n.addDisposableDomListener)(this._element,"mouseleave",(()=>{this._isMouseOut=!0,this._clearCurrentLink()}))),this.register((0,n.addDisposableDomListener)(this._element,"mousemove",this._handleMouseMove.bind(this))),this.register((0,n.addDisposableDomListener)(this._element,"mousedown",this._handleMouseDown.bind(this))),this.register((0,n.addDisposableDomListener)(this._element,"mouseup",this._handleMouseUp.bind(this)))}_handleMouseMove(e){this._lastMouseEvent=e;const t=this._positionFromMouseEvent(e,this._element,this._mouseService);if(!t)return;this._isMouseOut=!1;const i=e.composedPath();for(let e=0;e<i.length;e++){const t=i[e];if(t.classList.contains("xterm"))break;if(t.classList.contains("xterm-hover"))return}this._lastBufferCell&&t.x===this._lastBufferCell.x&&t.y===this._lastBufferCell.y||(this._handleHover(t),this._lastBufferCell=t)}_handleHover(e){if(this._activeLine!==e.y||this._wasResized)return this._clearCurrentLink(),this._askForLink(e,!1),void(this._wasResized=!1);this._currentLink&&this._linkAtPosition(this._currentLink.link,e)||(this._clearCurrentLink(),this._askForLink(e,!0))}_askForLink(e,t){this._activeProviderReplies&&t||(this._activeProviderReplies?.forEach((e=>{e?.forEach((e=>{e.link.dispose&&e.link.dispose()}))})),this._activeProviderReplies=new Map,this._activeLine=e.y);let i=!1;for(const[s,r]of this._linkProviderService.linkProviders.entries())if(t){const t=this._activeProviderReplies?.get(s);t&&(i=this._checkLinkProviderResult(s,e,i))}else r.provideLinks(e.y,(t=>{if(this._isMouseOut)return;const r=t?.map((e=>({link:e})));this._activeProviderReplies?.set(s,r),i=this._checkLinkProviderResult(s,e,i),this._activeProviderReplies?.size===this._linkProviderService.linkProviders.length&&this._removeIntersectingLinks(e.y,this._activeProviderReplies)}))}_removeIntersectingLinks(e,t){const i=new Set;for(let s=0;s<t.size;s++){const r=t.get(s);if(r)for(let t=0;t<r.length;t++){const s=r[t],n=s.link.range.start.y<e?0:s.link.range.start.x,o=s.link.range.end.y>e?this._bufferService.cols:s.link.range.end.x;for(let e=n;e<=o;e++){if(i.has(e)){r.splice(t--,1);break}i.add(e)}}}}_checkLinkProviderResult(e,t,i){if(!this._activeProviderReplies)return i;const s=this._activeProviderReplies.get(e);let r=!1;for(let t=0;t<e;t++)this._activeProviderReplies.has(t)&&!this._activeProviderReplies.get(t)||(r=!0);if(!r&&s){const e=s.find((e=>this._linkAtPosition(e.link,t)));e&&(i=!0,this._handleNewLink(e))}if(this._activeProviderReplies.size===this._linkProviderService.linkProviders.length&&!i)for(let e=0;e<this._activeProviderReplies.size;e++){const s=this._activeProviderReplies.get(e)?.find((e=>this._linkAtPosition(e.link,t)));if(s){i=!0,this._handleNewLink(s);break}}return i}_handleMouseDown(){this._mouseDownLink=this._currentLink}_handleMouseUp(e){if(!this._currentLink)return;const t=this._positionFromMouseEvent(e,this._element,this._mouseService);t&&this._mouseDownLink===this._currentLink&&this._linkAtPosition(this._currentLink.link,t)&&this._currentLink.link.activate(e,this._currentLink.link.text)}_clearCurrentLink(e,t){this._currentLink&&this._lastMouseEvent&&(!e||!t||this._currentLink.link.range.start.y>=e&&this._currentLink.link.range.end.y<=t)&&(this._linkLeave(this._element,this._currentLink.link,this._lastMouseEvent),this._currentLink=void 0,(0,a.disposeArray)(this._linkCacheDisposables))}_handleNewLink(e){if(!this._lastMouseEvent)return;const t=this._positionFromMouseEvent(this._lastMouseEvent,this._element,this._mouseService);t&&this._linkAtPosition(e.link,t)&&(this._currentLink=e,this._currentLink.state={decorations:{underline:void 0===e.link.decorations||e.link.decorations.underline,pointerCursor:void 0===e.link.decorations||e.link.decorations.pointerCursor},isHovered:!0},this._linkHover(this._element,e.link,this._lastMouseEvent),e.link.decorations={},Object.defineProperties(e.link.decorations,{pointerCursor:{get:()=>this._currentLink?.state?.decorations.pointerCursor,set:e=>{this._currentLink?.state&&this._currentLink.state.decorations.pointerCursor!==e&&(this._currentLink.state.decorations.pointerCursor=e,this._currentLink.state.isHovered&&this._element.classList.toggle("xterm-cursor-pointer",e))}},underline:{get:()=>this._currentLink?.state?.decorations.underline,set:t=>{this._currentLink?.state&&this._currentLink?.state?.decorations.underline!==t&&(this._currentLink.state.decorations.underline=t,this._currentLink.state.isHovered&&this._fireUnderlineEvent(e.link,t))}}}),this._linkCacheDisposables.push(this._renderService.onRenderedViewportChange((e=>{if(!this._currentLink)return;const t=0===e.start?0:e.start+1+this._bufferService.buffer.ydisp,i=this._bufferService.buffer.ydisp+1+e.end;if(this._currentLink.link.range.start.y>=t&&this._currentLink.link.range.end.y<=i&&(this._clearCurrentLink(t,i),this._lastMouseEvent)){const e=this._positionFromMouseEvent(this._lastMouseEvent,this._element,this._mouseService);e&&this._askForLink(e,!1)}}))))}_linkHover(e,t,i){this._currentLink?.state&&(this._currentLink.state.isHovered=!0,this._currentLink.state.decorations.underline&&this._fireUnderlineEvent(t,!0),this._currentLink.state.decorations.pointerCursor&&e.classList.add("xterm-cursor-pointer")),t.hover&&t.hover(i,t.text)}_fireUnderlineEvent(e,t){const i=e.range,s=this._bufferService.buffer.ydisp,r=this._createLinkUnderlineEvent(i.start.x-1,i.start.y-s-1,i.end.x,i.end.y-s-1,void 0);(t?this._onShowLinkUnderline:this._onHideLinkUnderline).fire(r)}_linkLeave(e,t,i){this._currentLink?.state&&(this._currentLink.state.isHovered=!1,this._currentLink.state.decorations.underline&&this._fireUnderlineEvent(t,!1),this._currentLink.state.decorations.pointerCursor&&e.classList.remove("xterm-cursor-pointer")),t.leave&&t.leave(i,t.text)}_linkAtPosition(e,t){const i=e.range.start.y*this._bufferService.cols+e.range.start.x,s=e.range.end.y*this._bufferService.cols+e.range.end.x,r=t.y*this._bufferService.cols+t.x;return i<=r&&r<=s}_positionFromMouseEvent(e,t,i){const s=i.getCoords(e,t,this._bufferService.cols,this._bufferService.rows);if(s)return{x:s[0],y:s[1]+this._bufferService.buffer.ydisp}}_createLinkUnderlineEvent(e,t,i,s,r){return{x1:e,y1:t,x2:i,y2:s,cols:this._bufferService.cols,fg:r}}};t.Linkifier=l=s([r(1,c.IMouseService),r(2,c.IRenderService),r(3,h.IBufferService),r(4,c.ILinkProviderService)],l)},9042:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.tooMuchOutput=t.promptLabel=void 0,t.promptLabel="Terminal input",t.tooMuchOutput="Too much output to announce, navigate to rows manually to read"},3730:function(e,t,i){var s=this&&this.__decorate||function(e,t,i,s){var r,n=arguments.length,o=n<3?t:null===s?s=Object.getOwnPropertyDescriptor(t,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)o=Reflect.decorate(e,t,i,s);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(o=(n<3?r(o):n>3?r(t,i,o):r(t,i))||o);return n>3&&o&&Object.defineProperty(t,i,o),o},r=this&&this.__param||function(e,t){return function(i,s){t(i,s,e)}};Object.defineProperty(t,"__esModule",{value:!0}),t.OscLinkProvider=void 0;const n=i(511),o=i(2585);let a=t.OscLinkProvider=class{constructor(e,t,i){this._bufferService=e,this._optionsService=t,this._oscLinkService=i}provideLinks(e,t){const i=this._bufferService.buffer.lines.get(e-1);if(!i)return void t(void 0);const s=[],r=this._optionsService.rawOptions.linkHandler,o=new n.CellData,a=i.getTrimmedLength();let c=-1,l=-1,d=!1;for(let t=0;t<a;t++)if(-1!==l||i.hasContent(t)){if(i.loadCell(t,o),o.hasExtendedAttrs()&&o.extended.urlId){if(-1===l){l=t,c=o.extended.urlId;continue}d=o.extended.urlId!==c}else-1!==l&&(d=!0);if(d||-1!==l&&t===a-1){const i=this._oscLinkService.getLinkData(c)?.uri;if(i){const n={start:{x:l+1,y:e},end:{x:t+(d||t!==a-1?0:1),y:e}};let o=!1;if(!r?.allowNonHttpProtocols)try{const e=new URL(i);["http:","https:"].includes(e.protocol)||(o=!0)}catch(e){o=!0}o||s.push({text:i,range:n,activate:(e,t)=>r?r.activate(e,t,n):h(0,t),hover:(e,t)=>r?.hover?.(e,t,n),leave:(e,t)=>r?.leave?.(e,t,n)})}d=!1,o.hasExtendedAttrs()&&o.extended.urlId?(l=t,c=o.extended.urlId):(l=-1,c=-1)}}t(s)}};function h(e,t){if(confirm(`Do you want to navigate to ${t}?\\n\\nWARNING: This link could potentially be dangerous`)){const e=window.open();if(e){try{e.opener=null}catch{}e.location.href=t}else console.warn("Opening link blocked as opener could not be cleared")}}t.OscLinkProvider=a=s([r(0,o.IBufferService),r(1,o.IOptionsService),r(2,o.IOscLinkService)],a)},6193:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.RenderDebouncer=void 0,t.RenderDebouncer=class{constructor(e,t){this._renderCallback=e,this._coreBrowserService=t,this._refreshCallbacks=[]}dispose(){this._animationFrame&&(this._coreBrowserService.window.cancelAnimationFrame(this._animationFrame),this._animationFrame=void 0)}addRefreshCallback(e){return this._refreshCallbacks.push(e),this._animationFrame||(this._animationFrame=this._coreBrowserService.window.requestAnimationFrame((()=>this._innerRefresh()))),this._animationFrame}refresh(e,t,i){this._rowCount=i,e=void 0!==e?e:0,t=void 0!==t?t:this._rowCount-1,this._rowStart=void 0!==this._rowStart?Math.min(this._rowStart,e):e,this._rowEnd=void 0!==this._rowEnd?Math.max(this._rowEnd,t):t,this._animationFrame||(this._animationFrame=this._coreBrowserService.window.requestAnimationFrame((()=>this._innerRefresh())))}_innerRefresh(){if(this._animationFrame=void 0,void 0===this._rowStart||void 0===this._rowEnd||void 0===this._rowCount)return void this._runRefreshCallbacks();const e=Math.max(this._rowStart,0),t=Math.min(this._rowEnd,this._rowCount-1);this._rowStart=void 0,this._rowEnd=void 0,this._renderCallback(e,t),this._runRefreshCallbacks()}_runRefreshCallbacks(){for(const e of this._refreshCallbacks)e(0);this._refreshCallbacks=[]}}},3236:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.Terminal=void 0;const s=i(3614),r=i(3656),n=i(3551),o=i(9042),a=i(3730),h=i(1680),c=i(3107),l=i(5744),d=i(2950),_=i(1296),u=i(428),f=i(4269),v=i(5114),p=i(8934),g=i(3230),m=i(9312),S=i(4725),C=i(6731),b=i(8055),w=i(8969),y=i(8460),E=i(844),k=i(6114),L=i(8437),D=i(2584),R=i(7399),x=i(5941),A=i(9074),B=i(2585),T=i(5435),M=i(4567),O=i(779);class P extends w.CoreTerminal{get onFocus(){return this._onFocus.event}get onBlur(){return this._onBlur.event}get onA11yChar(){return this._onA11yCharEmitter.event}get onA11yTab(){return this._onA11yTabEmitter.event}get onWillOpen(){return this._onWillOpen.event}constructor(e={}){super(e),this.browser=k,this._keyDownHandled=!1,this._keyDownSeen=!1,this._keyPressHandled=!1,this._unprocessedDeadKey=!1,this._accessibilityManager=this.register(new E.MutableDisposable),this._onCursorMove=this.register(new y.EventEmitter),this.onCursorMove=this._onCursorMove.event,this._onKey=this.register(new y.EventEmitter),this.onKey=this._onKey.event,this._onRender=this.register(new y.EventEmitter),this.onRender=this._onRender.event,this._onSelectionChange=this.register(new y.EventEmitter),this.onSelectionChange=this._onSelectionChange.event,this._onTitleChange=this.register(new y.EventEmitter),this.onTitleChange=this._onTitleChange.event,this._onBell=this.register(new y.EventEmitter),this.onBell=this._onBell.event,this._onFocus=this.register(new y.EventEmitter),this._onBlur=this.register(new y.EventEmitter),this._onA11yCharEmitter=this.register(new y.EventEmitter),this._onA11yTabEmitter=this.register(new y.EventEmitter),this._onWillOpen=this.register(new y.EventEmitter),this._setup(),this._decorationService=this._instantiationService.createInstance(A.DecorationService),this._instantiationService.setService(B.IDecorationService,this._decorationService),this._linkProviderService=this._instantiationService.createInstance(O.LinkProviderService),this._instantiationService.setService(S.ILinkProviderService,this._linkProviderService),this._linkProviderService.registerLinkProvider(this._instantiationService.createInstance(a.OscLinkProvider)),this.register(this._inputHandler.onRequestBell((()=>this._onBell.fire()))),this.register(this._inputHandler.onRequestRefreshRows(((e,t)=>this.refresh(e,t)))),this.register(this._inputHandler.onRequestSendFocus((()=>this._reportFocus()))),this.register(this._inputHandler.onRequestReset((()=>this.reset()))),this.register(this._inputHandler.onRequestWindowsOptionsReport((e=>this._reportWindowsOptions(e)))),this.register(this._inputHandler.onColor((e=>this._handleColorEvent(e)))),this.register((0,y.forwardEvent)(this._inputHandler.onCursorMove,this._onCursorMove)),this.register((0,y.forwardEvent)(this._inputHandler.onTitleChange,this._onTitleChange)),this.register((0,y.forwardEvent)(this._inputHandler.onA11yChar,this._onA11yCharEmitter)),this.register((0,y.forwardEvent)(this._inputHandler.onA11yTab,this._onA11yTabEmitter)),this.register(this._bufferService.onResize((e=>this._afterResize(e.cols,e.rows)))),this.register((0,E.toDisposable)((()=>{this._customKeyEventHandler=void 0,this.element?.parentNode?.removeChild(this.element)})))}_handleColorEvent(e){if(this._themeService)for(const t of e){let e,i="";switch(t.index){case 256:e="foreground",i="10";break;case 257:e="background",i="11";break;case 258:e="cursor",i="12";break;default:e="ansi",i="4;"+t.index}switch(t.type){case 0:const s=b.color.toColorRGB("ansi"===e?this._themeService.colors.ansi[t.index]:this._themeService.colors[e]);this.coreService.triggerDataEvent(`${D.C0.ESC}]${i};${(0,x.toRgbString)(s)}${D.C1_ESCAPED.ST}`);break;case 1:if("ansi"===e)this._themeService.modifyColors((e=>e.ansi[t.index]=b.channels.toColor(...t.color)));else{const i=e;this._themeService.modifyColors((e=>e[i]=b.channels.toColor(...t.color)))}break;case 2:this._themeService.restoreColor(t.index)}}}_setup(){super._setup(),this._customKeyEventHandler=void 0}get buffer(){return this.buffers.active}focus(){this.textarea&&this.textarea.focus({preventScroll:!0})}_handleScreenReaderModeOptionChange(e){e?!this._accessibilityManager.value&&this._renderService&&(this._accessibilityManager.value=this._instantiationService.createInstance(M.AccessibilityManager,this)):this._accessibilityManager.clear()}_handleTextAreaFocus(e){this.coreService.decPrivateModes.sendFocus&&this.coreService.triggerDataEvent(D.C0.ESC+"[I"),this.element.classList.add("focus"),this._showCursor(),this._onFocus.fire()}blur(){return this.textarea?.blur()}_handleTextAreaBlur(){this.textarea.value="",this.refresh(this.buffer.y,this.buffer.y),this.coreService.decPrivateModes.sendFocus&&this.coreService.triggerDataEvent(D.C0.ESC+"[O"),this.element.classList.remove("focus"),this._onBlur.fire()}_syncTextArea(){if(!this.textarea||!this.buffer.isCursorInViewport||this._compositionHelper.isComposing||!this._renderService)return;const e=this.buffer.ybase+this.buffer.y,t=this.buffer.lines.get(e);if(!t)return;const i=Math.min(this.buffer.x,this.cols-1),s=this._renderService.dimensions.css.cell.height,r=t.getWidth(i),n=this._renderService.dimensions.css.cell.width*r,o=this.buffer.y*this._renderService.dimensions.css.cell.height,a=i*this._renderService.dimensions.css.cell.width;this.textarea.style.left=a+"px",this.textarea.style.top=o+"px",this.textarea.style.width=n+"px",this.textarea.style.height=s+"px",this.textarea.style.lineHeight=s+"px",this.textarea.style.zIndex="-5"}_initGlobal(){this._bindKeys(),this.register((0,r.addDisposableDomListener)(this.element,"copy",(e=>{this.hasSelection()&&(0,s.copyHandler)(e,this._selectionService)})));const e=e=>(0,s.handlePasteEvent)(e,this.textarea,this.coreService,this.optionsService);this.register((0,r.addDisposableDomListener)(this.textarea,"paste",e)),this.register((0,r.addDisposableDomListener)(this.element,"paste",e)),k.isFirefox?this.register((0,r.addDisposableDomListener)(this.element,"mousedown",(e=>{2===e.button&&(0,s.rightClickHandler)(e,this.textarea,this.screenElement,this._selectionService,this.options.rightClickSelectsWord)}))):this.register((0,r.addDisposableDomListener)(this.element,"contextmenu",(e=>{(0,s.rightClickHandler)(e,this.textarea,this.screenElement,this._selectionService,this.options.rightClickSelectsWord)}))),k.isLinux&&this.register((0,r.addDisposableDomListener)(this.element,"auxclick",(e=>{1===e.button&&(0,s.moveTextAreaUnderMouseCursor)(e,this.textarea,this.screenElement)})))}_bindKeys(){this.register((0,r.addDisposableDomListener)(this.textarea,"keyup",(e=>this._keyUp(e)),!0)),this.register((0,r.addDisposableDomListener)(this.textarea,"keydown",(e=>this._keyDown(e)),!0)),this.register((0,r.addDisposableDomListener)(this.textarea,"keypress",(e=>this._keyPress(e)),!0)),this.register((0,r.addDisposableDomListener)(this.textarea,"compositionstart",(()=>this._compositionHelper.compositionstart()))),this.register((0,r.addDisposableDomListener)(this.textarea,"compositionupdate",(e=>this._compositionHelper.compositionupdate(e)))),this.register((0,r.addDisposableDomListener)(this.textarea,"compositionend",(()=>this._compositionHelper.compositionend()))),this.register((0,r.addDisposableDomListener)(this.textarea,"input",(e=>this._inputEvent(e)),!0)),this.register(this.onRender((()=>this._compositionHelper.updateCompositionElements())))}open(e){if(!e)throw new Error("Terminal requires a parent element.");if(e.isConnected||this._logService.debug("Terminal.open was called on an element that was not attached to the DOM"),this.element?.ownerDocument.defaultView&&this._coreBrowserService)return void(this.element.ownerDocument.defaultView!==this._coreBrowserService.window&&(this._coreBrowserService.window=this.element.ownerDocument.defaultView));this._document=e.ownerDocument,this.options.documentOverride&&this.options.documentOverride instanceof Document&&(this._document=this.optionsService.rawOptions.documentOverride),this.element=this._document.createElement("div"),this.element.dir="ltr",this.element.classList.add("terminal"),this.element.classList.add("xterm"),e.appendChild(this.element);const t=this._document.createDocumentFragment();this._viewportElement=this._document.createElement("div"),this._viewportElement.classList.add("xterm-viewport"),t.appendChild(this._viewportElement),this._viewportScrollArea=this._document.createElement("div"),this._viewportScrollArea.classList.add("xterm-scroll-area"),this._viewportElement.appendChild(this._viewportScrollArea),this.screenElement=this._document.createElement("div"),this.screenElement.classList.add("xterm-screen"),this.register((0,r.addDisposableDomListener)(this.screenElement,"mousemove",(e=>this.updateCursorStyle(e)))),this._helperContainer=this._document.createElement("div"),this._helperContainer.classList.add("xterm-helpers"),this.screenElement.appendChild(this._helperContainer),t.appendChild(this.screenElement),this.textarea=this._document.createElement("textarea"),this.textarea.classList.add("xterm-helper-textarea"),this.textarea.setAttribute("aria-label",o.promptLabel),k.isChromeOS||this.textarea.setAttribute("aria-multiline","false"),this.textarea.setAttribute("autocorrect","off"),this.textarea.setAttribute("autocapitalize","off"),this.textarea.setAttribute("spellcheck","false"),this.textarea.tabIndex=0,this._coreBrowserService=this.register(this._instantiationService.createInstance(v.CoreBrowserService,this.textarea,e.ownerDocument.defaultView??window,this._document??"undefined"!=typeof window?window.document:null)),this._instantiationService.setService(S.ICoreBrowserService,this._coreBrowserService),this.register((0,r.addDisposableDomListener)(this.textarea,"focus",(e=>this._handleTextAreaFocus(e)))),this.register((0,r.addDisposableDomListener)(this.textarea,"blur",(()=>this._handleTextAreaBlur()))),this._helperContainer.appendChild(this.textarea),this._charSizeService=this._instantiationService.createInstance(u.CharSizeService,this._document,this._helperContainer),this._instantiationService.setService(S.ICharSizeService,this._charSizeService),this._themeService=this._instantiationService.createInstance(C.ThemeService),this._instantiationService.setService(S.IThemeService,this._themeService),this._characterJoinerService=this._instantiationService.createInstance(f.CharacterJoinerService),this._instantiationService.setService(S.ICharacterJoinerService,this._characterJoinerService),this._renderService=this.register(this._instantiationService.createInstance(g.RenderService,this.rows,this.screenElement)),this._instantiationService.setService(S.IRenderService,this._renderService),this.register(this._renderService.onRenderedViewportChange((e=>this._onRender.fire(e)))),this.onResize((e=>this._renderService.resize(e.cols,e.rows))),this._compositionView=this._document.createElement("div"),this._compositionView.classList.add("composition-view"),this._compositionHelper=this._instantiationService.createInstance(d.CompositionHelper,this.textarea,this._compositionView),this._helperContainer.appendChild(this._compositionView),this._mouseService=this._instantiationService.createInstance(p.MouseService),this._instantiationService.setService(S.IMouseService,this._mouseService),this.linkifier=this.register(this._instantiationService.createInstance(n.Linkifier,this.screenElement)),this.element.appendChild(t);try{this._onWillOpen.fire(this.element)}catch{}this._renderService.hasRenderer()||this._renderService.setRenderer(this._createRenderer()),this.viewport=this._instantiationService.createInstance(h.Viewport,this._viewportElement,this._viewportScrollArea),this.viewport.onRequestScrollLines((e=>this.scrollLines(e.amount,e.suppressScrollEvent,1))),this.register(this._inputHandler.onRequestSyncScrollBar((()=>this.viewport.syncScrollArea()))),this.register(this.viewport),this.register(this.onCursorMove((()=>{this._renderService.handleCursorMove(),this._syncTextArea()}))),this.register(this.onResize((()=>this._renderService.handleResize(this.cols,this.rows)))),this.register(this.onBlur((()=>this._renderService.handleBlur()))),this.register(this.onFocus((()=>this._renderService.handleFocus()))),this.register(this._renderService.onDimensionsChange((()=>this.viewport.syncScrollArea()))),this._selectionService=this.register(this._instantiationService.createInstance(m.SelectionService,this.element,this.screenElement,this.linkifier)),this._instantiationService.setService(S.ISelectionService,this._selectionService),this.register(this._selectionService.onRequestScrollLines((e=>this.scrollLines(e.amount,e.suppressScrollEvent)))),this.register(this._selectionService.onSelectionChange((()=>this._onSelectionChange.fire()))),this.register(this._selectionService.onRequestRedraw((e=>this._renderService.handleSelectionChanged(e.start,e.end,e.columnSelectMode)))),this.register(this._selectionService.onLinuxMouseSelection((e=>{this.textarea.value=e,this.textarea.focus(),this.textarea.select()}))),this.register(this._onScroll.event((e=>{this.viewport.syncScrollArea(),this._selectionService.refresh()}))),this.register((0,r.addDisposableDomListener)(this._viewportElement,"scroll",(()=>this._selectionService.refresh()))),this.register(this._instantiationService.createInstance(c.BufferDecorationRenderer,this.screenElement)),this.register((0,r.addDisposableDomListener)(this.element,"mousedown",(e=>this._selectionService.handleMouseDown(e)))),this.coreMouseService.areMouseEventsActive?(this._selectionService.disable(),this.element.classList.add("enable-mouse-events")):this._selectionService.enable(),this.options.screenReaderMode&&(this._accessibilityManager.value=this._instantiationService.createInstance(M.AccessibilityManager,this)),this.register(this.optionsService.onSpecificOptionChange("screenReaderMode",(e=>this._handleScreenReaderModeOptionChange(e)))),this.options.overviewRulerWidth&&(this._overviewRulerRenderer=this.register(this._instantiationService.createInstance(l.OverviewRulerRenderer,this._viewportElement,this.screenElement))),this.optionsService.onSpecificOptionChange("overviewRulerWidth",(e=>{!this._overviewRulerRenderer&&e&&this._viewportElement&&this.screenElement&&(this._overviewRulerRenderer=this.register(this._instantiationService.createInstance(l.OverviewRulerRenderer,this._viewportElement,this.screenElement)))})),this._charSizeService.measure(),this.refresh(0,this.rows-1),this._initGlobal(),this.bindMouse()}_createRenderer(){return this._instantiationService.createInstance(_.DomRenderer,this,this._document,this.element,this.screenElement,this._viewportElement,this._helperContainer,this.linkifier)}bindMouse(){const e=this,t=this.element;function i(t){const i=e._mouseService.getMouseReportCoords(t,e.screenElement);if(!i)return!1;let s,r;switch(t.overrideType||t.type){case"mousemove":r=32,void 0===t.buttons?(s=3,void 0!==t.button&&(s=t.button<3?t.button:3)):s=1&t.buttons?0:4&t.buttons?1:2&t.buttons?2:3;break;case"mouseup":r=0,s=t.button<3?t.button:3;break;case"mousedown":r=1,s=t.button<3?t.button:3;break;case"wheel":if(e._customWheelEventHandler&&!1===e._customWheelEventHandler(t))return!1;if(0===e.viewport.getLinesScrolled(t))return!1;r=t.deltaY<0?0:1,s=4;break;default:return!1}return!(void 0===r||void 0===s||s>4)&&e.coreMouseService.triggerMouseEvent({col:i.col,row:i.row,x:i.x,y:i.y,button:s,action:r,ctrl:t.ctrlKey,alt:t.altKey,shift:t.shiftKey})}const s={mouseup:null,wheel:null,mousedrag:null,mousemove:null},n={mouseup:e=>(i(e),e.buttons||(this._document.removeEventListener("mouseup",s.mouseup),s.mousedrag&&this._document.removeEventListener("mousemove",s.mousedrag)),this.cancel(e)),wheel:e=>(i(e),this.cancel(e,!0)),mousedrag:e=>{e.buttons&&i(e)},mousemove:e=>{e.buttons||i(e)}};this.register(this.coreMouseService.onProtocolChange((e=>{e?("debug"===this.optionsService.rawOptions.logLevel&&this._logService.debug("Binding to mouse events:",this.coreMouseService.explainEvents(e)),this.element.classList.add("enable-mouse-events"),this._selectionService.disable()):(this._logService.debug("Unbinding from mouse events."),this.element.classList.remove("enable-mouse-events"),this._selectionService.enable()),8&e?s.mousemove||(t.addEventListener("mousemove",n.mousemove),s.mousemove=n.mousemove):(t.removeEventListener("mousemove",s.mousemove),s.mousemove=null),16&e?s.wheel||(t.addEventListener("wheel",n.wheel,{passive:!1}),s.wheel=n.wheel):(t.removeEventListener("wheel",s.wheel),s.wheel=null),2&e?s.mouseup||(s.mouseup=n.mouseup):(this._document.removeEventListener("mouseup",s.mouseup),s.mouseup=null),4&e?s.mousedrag||(s.mousedrag=n.mousedrag):(this._document.removeEventListener("mousemove",s.mousedrag),s.mousedrag=null)}))),this.coreMouseService.activeProtocol=this.coreMouseService.activeProtocol,this.register((0,r.addDisposableDomListener)(t,"mousedown",(e=>{if(e.preventDefault(),this.focus(),this.coreMouseService.areMouseEventsActive&&!this._selectionService.shouldForceSelection(e))return i(e),s.mouseup&&this._document.addEventListener("mouseup",s.mouseup),s.mousedrag&&this._document.addEventListener("mousemove",s.mousedrag),this.cancel(e)}))),this.register((0,r.addDisposableDomListener)(t,"wheel",(e=>{if(!s.wheel){if(this._customWheelEventHandler&&!1===this._customWheelEventHandler(e))return!1;if(!this.buffer.hasScrollback){const t=this.viewport.getLinesScrolled(e);if(0===t)return;const i=D.C0.ESC+(this.coreService.decPrivateModes.applicationCursorKeys?"O":"[")+(e.deltaY<0?"A":"B");let s="";for(let e=0;e<Math.abs(t);e++)s+=i;return this.coreService.triggerDataEvent(s,!0),this.cancel(e,!0)}return this.viewport.handleWheel(e)?this.cancel(e):void 0}}),{passive:!1})),this.register((0,r.addDisposableDomListener)(t,"touchstart",(e=>{if(!this.coreMouseService.areMouseEventsActive)return this.viewport.handleTouchStart(e),this.cancel(e)}),{passive:!0})),this.register((0,r.addDisposableDomListener)(t,"touchmove",(e=>{if(!this.coreMouseService.areMouseEventsActive)return this.viewport.handleTouchMove(e)?void 0:this.cancel(e)}),{passive:!1}))}refresh(e,t){this._renderService?.refreshRows(e,t)}updateCursorStyle(e){this._selectionService?.shouldColumnSelect(e)?this.element.classList.add("column-select"):this.element.classList.remove("column-select")}_showCursor(){this.coreService.isCursorInitialized||(this.coreService.isCursorInitialized=!0,this.refresh(this.buffer.y,this.buffer.y))}scrollLines(e,t,i=0){1===i?(super.scrollLines(e,t,i),this.refresh(0,this.rows-1)):this.viewport?.scrollLines(e)}paste(e){(0,s.paste)(e,this.textarea,this.coreService,this.optionsService)}attachCustomKeyEventHandler(e){this._customKeyEventHandler=e}attachCustomWheelEventHandler(e){this._customWheelEventHandler=e}registerLinkProvider(e){return this._linkProviderService.registerLinkProvider(e)}registerCharacterJoiner(e){if(!this._characterJoinerService)throw new Error("Terminal must be opened first");const t=this._characterJoinerService.register(e);return this.refresh(0,this.rows-1),t}deregisterCharacterJoiner(e){if(!this._characterJoinerService)throw new Error("Terminal must be opened first");this._characterJoinerService.deregister(e)&&this.refresh(0,this.rows-1)}get markers(){return this.buffer.markers}registerMarker(e){return this.buffer.addMarker(this.buffer.ybase+this.buffer.y+e)}registerDecoration(e){return this._decorationService.registerDecoration(e)}hasSelection(){return!!this._selectionService&&this._selectionService.hasSelection}select(e,t,i){this._selectionService.setSelection(e,t,i)}getSelection(){return this._selectionService?this._selectionService.selectionText:""}getSelectionPosition(){if(this._selectionService&&this._selectionService.hasSelection)return{start:{x:this._selectionService.selectionStart[0],y:this._selectionService.selectionStart[1]},end:{x:this._selectionService.selectionEnd[0],y:this._selectionService.selectionEnd[1]}}}clearSelection(){this._selectionService?.clearSelection()}selectAll(){this._selectionService?.selectAll()}selectLines(e,t){this._selectionService?.selectLines(e,t)}_keyDown(e){if(this._keyDownHandled=!1,this._keyDownSeen=!0,this._customKeyEventHandler&&!1===this._customKeyEventHandler(e))return!1;const t=this.browser.isMac&&this.options.macOptionIsMeta&&e.altKey;if(!t&&!this._compositionHelper.keydown(e))return this.options.scrollOnUserInput&&this.buffer.ybase!==this.buffer.ydisp&&this.scrollToBottom(),!1;t||"Dead"!==e.key&&"AltGraph"!==e.key||(this._unprocessedDeadKey=!0);const i=(0,R.evaluateKeyboardEvent)(e,this.coreService.decPrivateModes.applicationCursorKeys,this.browser.isMac,this.options.macOptionIsMeta);if(this.updateCursorStyle(e),3===i.type||2===i.type){const t=this.rows-1;return this.scrollLines(2===i.type?-t:t),this.cancel(e,!0)}return 1===i.type&&this.selectAll(),!!this._isThirdLevelShift(this.browser,e)||(i.cancel&&this.cancel(e,!0),!i.key||!!(e.key&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&1===e.key.length&&e.key.charCodeAt(0)>=65&&e.key.charCodeAt(0)<=90)||(this._unprocessedDeadKey?(this._unprocessedDeadKey=!1,!0):(i.key!==D.C0.ETX&&i.key!==D.C0.CR||(this.textarea.value=""),this._onKey.fire({key:i.key,domEvent:e}),this._showCursor(),this.coreService.triggerDataEvent(i.key,!0),!this.optionsService.rawOptions.screenReaderMode||e.altKey||e.ctrlKey?this.cancel(e,!0):void(this._keyDownHandled=!0))))}_isThirdLevelShift(e,t){const i=e.isMac&&!this.options.macOptionIsMeta&&t.altKey&&!t.ctrlKey&&!t.metaKey||e.isWindows&&t.altKey&&t.ctrlKey&&!t.metaKey||e.isWindows&&t.getModifierState("AltGraph");return"keypress"===t.type?i:i&&(!t.keyCode||t.keyCode>47)}_keyUp(e){this._keyDownSeen=!1,this._customKeyEventHandler&&!1===this._customKeyEventHandler(e)||(function(e){return 16===e.keyCode||17===e.keyCode||18===e.keyCode}(e)||this.focus(),this.updateCursorStyle(e),this._keyPressHandled=!1)}_keyPress(e){let t;if(this._keyPressHandled=!1,this._keyDownHandled)return!1;if(this._customKeyEventHandler&&!1===this._customKeyEventHandler(e))return!1;if(this.cancel(e),e.charCode)t=e.charCode;else if(null===e.which||void 0===e.which)t=e.keyCode;else{if(0===e.which||0===e.charCode)return!1;t=e.which}return!(!t||(e.altKey||e.ctrlKey||e.metaKey)&&!this._isThirdLevelShift(this.browser,e)||(t=String.fromCharCode(t),this._onKey.fire({key:t,domEvent:e}),this._showCursor(),this.coreService.triggerDataEvent(t,!0),this._keyPressHandled=!0,this._unprocessedDeadKey=!1,0))}_inputEvent(e){if(e.data&&"insertText"===e.inputType&&(!e.composed||!this._keyDownSeen)&&!this.optionsService.rawOptions.screenReaderMode){if(this._keyPressHandled)return!1;this._unprocessedDeadKey=!1;const t=e.data;return this.coreService.triggerDataEvent(t,!0),this.cancel(e),!0}return!1}resize(e,t){e!==this.cols||t!==this.rows?super.resize(e,t):this._charSizeService&&!this._charSizeService.hasValidSize&&this._charSizeService.measure()}_afterResize(e,t){this._charSizeService?.measure(),this.viewport?.syncScrollArea(!0)}clear(){if(0!==this.buffer.ybase||0!==this.buffer.y){this.buffer.clearAllMarkers(),this.buffer.lines.set(0,this.buffer.lines.get(this.buffer.ybase+this.buffer.y)),this.buffer.lines.length=1,this.buffer.ydisp=0,this.buffer.ybase=0,this.buffer.y=0;for(let e=1;e<this.rows;e++)this.buffer.lines.push(this.buffer.getBlankLine(L.DEFAULT_ATTR_DATA));this._onScroll.fire({position:this.buffer.ydisp,source:0}),this.viewport?.reset(),this.refresh(0,this.rows-1)}}reset(){this.options.rows=this.rows,this.options.cols=this.cols;const e=this._customKeyEventHandler;this._setup(),super.reset(),this._selectionService?.reset(),this._decorationService.reset(),this.viewport?.reset(),this._customKeyEventHandler=e,this.refresh(0,this.rows-1)}clearTextureAtlas(){this._renderService?.clearTextureAtlas()}_reportFocus(){this.element?.classList.contains("focus")?this.coreService.triggerDataEvent(D.C0.ESC+"[I"):this.coreService.triggerDataEvent(D.C0.ESC+"[O")}_reportWindowsOptions(e){if(this._renderService)switch(e){case T.WindowsOptionsReportType.GET_WIN_SIZE_PIXELS:const e=this._renderService.dimensions.css.canvas.width.toFixed(0),t=this._renderService.dimensions.css.canvas.height.toFixed(0);this.coreService.triggerDataEvent(`${D.C0.ESC}[4;${t};${e}t`);break;case T.WindowsOptionsReportType.GET_CELL_SIZE_PIXELS:const i=this._renderService.dimensions.css.cell.width.toFixed(0),s=this._renderService.dimensions.css.cell.height.toFixed(0);this.coreService.triggerDataEvent(`${D.C0.ESC}[6;${s};${i}t`)}}cancel(e,t){if(this.options.cancelEvents||t)return e.preventDefault(),e.stopPropagation(),!1}}t.Terminal=P},9924:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.TimeBasedDebouncer=void 0,t.TimeBasedDebouncer=class{constructor(e,t=1e3){this._renderCallback=e,this._debounceThresholdMS=t,this._lastRefreshMs=0,this._additionalRefreshRequested=!1}dispose(){this._refreshTimeoutID&&clearTimeout(this._refreshTimeoutID)}refresh(e,t,i){this._rowCount=i,e=void 0!==e?e:0,t=void 0!==t?t:this._rowCount-1,this._rowStart=void 0!==this._rowStart?Math.min(this._rowStart,e):e,this._rowEnd=void 0!==this._rowEnd?Math.max(this._rowEnd,t):t;const s=Date.now();if(s-this._lastRefreshMs>=this._debounceThresholdMS)this._lastRefreshMs=s,this._innerRefresh();else if(!this._additionalRefreshRequested){const e=s-this._lastRefreshMs,t=this._debounceThresholdMS-e;this._additionalRefreshRequested=!0,this._refreshTimeoutID=window.setTimeout((()=>{this._lastRefreshMs=Date.now(),this._innerRefresh(),this._additionalRefreshRequested=!1,this._refreshTimeoutID=void 0}),t)}}_innerRefresh(){if(void 0===this._rowStart||void 0===this._rowEnd||void 0===this._rowCount)return;const e=Math.max(this._rowStart,0),t=Math.min(this._rowEnd,this._rowCount-1);this._rowStart=void 0,this._rowEnd=void 0,this._renderCallback(e,t)}}},1680:function(e,t,i){var s=this&&this.__decorate||function(e,t,i,s){var r,n=arguments.length,o=n<3?t:null===s?s=Object.getOwnPropertyDescriptor(t,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)o=Reflect.decorate(e,t,i,s);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(o=(n<3?r(o):n>3?r(t,i,o):r(t,i))||o);return n>3&&o&&Object.defineProperty(t,i,o),o},r=this&&this.__param||function(e,t){return function(i,s){t(i,s,e)}};Object.defineProperty(t,"__esModule",{value:!0}),t.Viewport=void 0;const n=i(3656),o=i(4725),a=i(8460),h=i(844),c=i(2585);let l=t.Viewport=class extends h.Disposable{constructor(e,t,i,s,r,o,h,c){super(),this._viewportElement=e,this._scrollArea=t,this._bufferService=i,this._optionsService=s,this._charSizeService=r,this._renderService=o,this._coreBrowserService=h,this.scrollBarWidth=0,this._currentRowHeight=0,this._currentDeviceCellHeight=0,this._lastRecordedBufferLength=0,this._lastRecordedViewportHeight=0,this._lastRecordedBufferHeight=0,this._lastTouchY=0,this._lastScrollTop=0,this._wheelPartialScroll=0,this._refreshAnimationFrame=null,this._ignoreNextScrollEvent=!1,this._smoothScrollState={startTime:0,origin:-1,target:-1},this._onRequestScrollLines=this.register(new a.EventEmitter),this.onRequestScrollLines=this._onRequestScrollLines.event,this.scrollBarWidth=this._viewportElement.offsetWidth-this._scrollArea.offsetWidth||15,this.register((0,n.addDisposableDomListener)(this._viewportElement,"scroll",this._handleScroll.bind(this))),this._activeBuffer=this._bufferService.buffer,this.register(this._bufferService.buffers.onBufferActivate((e=>this._activeBuffer=e.activeBuffer))),this._renderDimensions=this._renderService.dimensions,this.register(this._renderService.onDimensionsChange((e=>this._renderDimensions=e))),this._handleThemeChange(c.colors),this.register(c.onChangeColors((e=>this._handleThemeChange(e)))),this.register(this._optionsService.onSpecificOptionChange("scrollback",(()=>this.syncScrollArea()))),setTimeout((()=>this.syncScrollArea()))}_handleThemeChange(e){this._viewportElement.style.backgroundColor=e.background.css}reset(){this._currentRowHeight=0,this._currentDeviceCellHeight=0,this._lastRecordedBufferLength=0,this._lastRecordedViewportHeight=0,this._lastRecordedBufferHeight=0,this._lastTouchY=0,this._lastScrollTop=0,this._coreBrowserService.window.requestAnimationFrame((()=>this.syncScrollArea()))}_refresh(e){if(e)return this._innerRefresh(),void(null!==this._refreshAnimationFrame&&this._coreBrowserService.window.cancelAnimationFrame(this._refreshAnimationFrame));null===this._refreshAnimationFrame&&(this._refreshAnimationFrame=this._coreBrowserService.window.requestAnimationFrame((()=>this._innerRefresh())))}_innerRefresh(){if(this._charSizeService.height>0){this._currentRowHeight=this._renderDimensions.device.cell.height/this._coreBrowserService.dpr,this._currentDeviceCellHeight=this._renderDimensions.device.cell.height,this._lastRecordedViewportHeight=this._viewportElement.offsetHeight;const e=Math.round(this._currentRowHeight*this._lastRecordedBufferLength)+(this._lastRecordedViewportHeight-this._renderDimensions.css.canvas.height);this._lastRecordedBufferHeight!==e&&(this._lastRecordedBufferHeight=e,this._scrollArea.style.height=this._lastRecordedBufferHeight+"px")}const e=this._bufferService.buffer.ydisp*this._currentRowHeight;this._viewportElement.scrollTop!==e&&(this._ignoreNextScrollEvent=!0,this._viewportElement.scrollTop=e),this._refreshAnimationFrame=null}syncScrollArea(e=!1){if(this._lastRecordedBufferLength!==this._bufferService.buffer.lines.length)return this._lastRecordedBufferLength=this._bufferService.buffer.lines.length,void this._refresh(e);this._lastRecordedViewportHeight===this._renderService.dimensions.css.canvas.height&&this._lastScrollTop===this._activeBuffer.ydisp*this._currentRowHeight&&this._renderDimensions.device.cell.height===this._currentDeviceCellHeight||this._refresh(e)}_handleScroll(e){if(this._lastScrollTop=this._viewportElement.scrollTop,!this._viewportElement.offsetParent)return;if(this._ignoreNextScrollEvent)return this._ignoreNextScrollEvent=!1,void this._onRequestScrollLines.fire({amount:0,suppressScrollEvent:!0});const t=Math.round(this._lastScrollTop/this._currentRowHeight)-this._bufferService.buffer.ydisp;this._onRequestScrollLines.fire({amount:t,suppressScrollEvent:!0})}_smoothScroll(){if(this._isDisposed||-1===this._smoothScrollState.origin||-1===this._smoothScrollState.target)return;const e=this._smoothScrollPercent();this._viewportElement.scrollTop=this._smoothScrollState.origin+Math.round(e*(this._smoothScrollState.target-this._smoothScrollState.origin)),e<1?this._coreBrowserService.window.requestAnimationFrame((()=>this._smoothScroll())):this._clearSmoothScrollState()}_smoothScrollPercent(){return this._optionsService.rawOptions.smoothScrollDuration&&this._smoothScrollState.startTime?Math.max(Math.min((Date.now()-this._smoothScrollState.startTime)/this._optionsService.rawOptions.smoothScrollDuration,1),0):1}_clearSmoothScrollState(){this._smoothScrollState.startTime=0,this._smoothScrollState.origin=-1,this._smoothScrollState.target=-1}_bubbleScroll(e,t){const i=this._viewportElement.scrollTop+this._lastRecordedViewportHeight;return!(t<0&&0!==this._viewportElement.scrollTop||t>0&&i<this._lastRecordedBufferHeight)||(e.cancelable&&e.preventDefault(),!1)}handleWheel(e){const t=this._getPixelsScrolled(e);return 0!==t&&(this._optionsService.rawOptions.smoothScrollDuration?(this._smoothScrollState.startTime=Date.now(),this._smoothScrollPercent()<1?(this._smoothScrollState.origin=this._viewportElement.scrollTop,-1===this._smoothScrollState.target?this._smoothScrollState.target=this._viewportElement.scrollTop+t:this._smoothScrollState.target+=t,this._smoothScrollState.target=Math.max(Math.min(this._smoothScrollState.target,this._viewportElement.scrollHeight),0),this._smoothScroll()):this._clearSmoothScrollState()):this._viewportElement.scrollTop+=t,this._bubbleScroll(e,t))}scrollLines(e){if(0!==e)if(this._optionsService.rawOptions.smoothScrollDuration){const t=e*this._currentRowHeight;this._smoothScrollState.startTime=Date.now(),this._smoothScrollPercent()<1?(this._smoothScrollState.origin=this._viewportElement.scrollTop,this._smoothScrollState.target=this._smoothScrollState.origin+t,this._smoothScrollState.target=Math.max(Math.min(this._smoothScrollState.target,this._viewportElement.scrollHeight),0),this._smoothScroll()):this._clearSmoothScrollState()}else this._onRequestScrollLines.fire({amount:e,suppressScrollEvent:!1})}_getPixelsScrolled(e){if(0===e.deltaY||e.shiftKey)return 0;let t=this._applyScrollModifier(e.deltaY,e);return e.deltaMode===WheelEvent.DOM_DELTA_LINE?t*=this._currentRowHeight:e.deltaMode===WheelEvent.DOM_DELTA_PAGE&&(t*=this._currentRowHeight*this._bufferService.rows),t}getBufferElements(e,t){let i,s="";const r=[],n=t??this._bufferService.buffer.lines.length,o=this._bufferService.buffer.lines;for(let t=e;t<n;t++){const e=o.get(t);if(!e)continue;const n=o.get(t+1)?.isWrapped;if(s+=e.translateToString(!n),!n||t===o.length-1){const e=document.createElement("div");e.textContent=s,r.push(e),s.length>0&&(i=e),s=""}}return{bufferElements:r,cursorElement:i}}getLinesScrolled(e){if(0===e.deltaY||e.shiftKey)return 0;let t=this._applyScrollModifier(e.deltaY,e);return e.deltaMode===WheelEvent.DOM_DELTA_PIXEL?(t/=this._currentRowHeight+0,this._wheelPartialScroll+=t,t=Math.floor(Math.abs(this._wheelPartialScroll))*(this._wheelPartialScroll>0?1:-1),this._wheelPartialScroll%=1):e.deltaMode===WheelEvent.DOM_DELTA_PAGE&&(t*=this._bufferService.rows),t}_applyScrollModifier(e,t){const i=this._optionsService.rawOptions.fastScrollModifier;return"alt"===i&&t.altKey||"ctrl"===i&&t.ctrlKey||"shift"===i&&t.shiftKey?e*this._optionsService.rawOptions.fastScrollSensitivity*this._optionsService.rawOptions.scrollSensitivity:e*this._optionsService.rawOptions.scrollSensitivity}handleTouchStart(e){this._lastTouchY=e.touches[0].pageY}handleTouchMove(e){const t=this._lastTouchY-e.touches[0].pageY;return this._lastTouchY=e.touches[0].pageY,0!==t&&(this._viewportElement.scrollTop+=t,this._bubbleScroll(e,t))}};t.Viewport=l=s([r(2,c.IBufferService),r(3,c.IOptionsService),r(4,o.ICharSizeService),r(5,o.IRenderService),r(6,o.ICoreBrowserService),r(7,o.IThemeService)],l)},3107:function(e,t,i){var s=this&&this.__decorate||function(e,t,i,s){var r,n=arguments.length,o=n<3?t:null===s?s=Object.getOwnPropertyDescriptor(t,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)o=Reflect.decorate(e,t,i,s);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(o=(n<3?r(o):n>3?r(t,i,o):r(t,i))||o);return n>3&&o&&Object.defineProperty(t,i,o),o},r=this&&this.__param||function(e,t){return function(i,s){t(i,s,e)}};Object.defineProperty(t,"__esModule",{value:!0}),t.BufferDecorationRenderer=void 0;const n=i(4725),o=i(844),a=i(2585);let h=t.BufferDecorationRenderer=class extends o.Disposable{constructor(e,t,i,s,r){super(),this._screenElement=e,this._bufferService=t,this._coreBrowserService=i,this._decorationService=s,this._renderService=r,this._decorationElements=new Map,this._altBufferIsActive=!1,this._dimensionsChanged=!1,this._container=document.createElement("div"),this._container.classList.add("xterm-decoration-container"),this._screenElement.appendChild(this._container),this.register(this._renderService.onRenderedViewportChange((()=>this._doRefreshDecorations()))),this.register(this._renderService.onDimensionsChange((()=>{this._dimensionsChanged=!0,this._queueRefresh()}))),this.register(this._coreBrowserService.onDprChange((()=>this._queueRefresh()))),this.register(this._bufferService.buffers.onBufferActivate((()=>{this._altBufferIsActive=this._bufferService.buffer===this._bufferService.buffers.alt}))),this.register(this._decorationService.onDecorationRegistered((()=>this._queueRefresh()))),this.register(this._decorationService.onDecorationRemoved((e=>this._removeDecoration(e)))),this.register((0,o.toDisposable)((()=>{this._container.remove(),this._decorationElements.clear()})))}_queueRefresh(){void 0===this._animationFrame&&(this._animationFrame=this._renderService.addRefreshCallback((()=>{this._doRefreshDecorations(),this._animationFrame=void 0})))}_doRefreshDecorations(){for(const e of this._decorationService.decorations)this._renderDecoration(e);this._dimensionsChanged=!1}_renderDecoration(e){this._refreshStyle(e),this._dimensionsChanged&&this._refreshXPosition(e)}_createElement(e){const t=this._coreBrowserService.mainDocument.createElement("div");t.classList.add("xterm-decoration"),t.classList.toggle("xterm-decoration-top-layer","top"===e?.options?.layer),t.style.width=`${Math.round((e.options.width||1)*this._renderService.dimensions.css.cell.width)}px`,t.style.height=(e.options.height||1)*this._renderService.dimensions.css.cell.height+"px",t.style.top=(e.marker.line-this._bufferService.buffers.active.ydisp)*this._renderService.dimensions.css.cell.height+"px",t.style.lineHeight=`${this._renderService.dimensions.css.cell.height}px`;const i=e.options.x??0;return i&&i>this._bufferService.cols&&(t.style.display="none"),this._refreshXPosition(e,t),t}_refreshStyle(e){const t=e.marker.line-this._bufferService.buffers.active.ydisp;if(t<0||t>=this._bufferService.rows)e.element&&(e.element.style.display="none",e.onRenderEmitter.fire(e.element));else{let i=this._decorationElements.get(e);i||(i=this._createElement(e),e.element=i,this._decorationElements.set(e,i),this._container.appendChild(i),e.onDispose((()=>{this._decorationElements.delete(e),i.remove()}))),i.style.top=t*this._renderService.dimensions.css.cell.height+"px",i.style.display=this._altBufferIsActive?"none":"block",e.onRenderEmitter.fire(i)}}_refreshXPosition(e,t=e.element){if(!t)return;const i=e.options.x??0;"right"===(e.options.anchor||"left")?t.style.right=i?i*this._renderService.dimensions.css.cell.width+"px":"":t.style.left=i?i*this._renderService.dimensions.css.cell.width+"px":""}_removeDecoration(e){this._decorationElements.get(e)?.remove(),this._decorationElements.delete(e),e.dispose()}};t.BufferDecorationRenderer=h=s([r(1,a.IBufferService),r(2,n.ICoreBrowserService),r(3,a.IDecorationService),r(4,n.IRenderService)],h)},5871:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.ColorZoneStore=void 0,t.ColorZoneStore=class{constructor(){this._zones=[],this._zonePool=[],this._zonePoolIndex=0,this._linePadding={full:0,left:0,center:0,right:0}}get zones(){return this._zonePool.length=Math.min(this._zonePool.length,this._zones.length),this._zones}clear(){this._zones.length=0,this._zonePoolIndex=0}addDecoration(e){if(e.options.overviewRulerOptions){for(const t of this._zones)if(t.color===e.options.overviewRulerOptions.color&&t.position===e.options.overviewRulerOptions.position){if(this._lineIntersectsZone(t,e.marker.line))return;if(this._lineAdjacentToZone(t,e.marker.line,e.options.overviewRulerOptions.position))return void this._addLineToZone(t,e.marker.line)}if(this._zonePoolIndex<this._zonePool.length)return this._zonePool[this._zonePoolIndex].color=e.options.overviewRulerOptions.color,this._zonePool[this._zonePoolIndex].position=e.options.overviewRulerOptions.position,this._zonePool[this._zonePoolIndex].startBufferLine=e.marker.line,this._zonePool[this._zonePoolIndex].endBufferLine=e.marker.line,void this._zones.push(this._zonePool[this._zonePoolIndex++]);this._zones.push({color:e.options.overviewRulerOptions.color,position:e.options.overviewRulerOptions.position,startBufferLine:e.marker.line,endBufferLine:e.marker.line}),this._zonePool.push(this._zones[this._zones.length-1]),this._zonePoolIndex++}}setPadding(e){this._linePadding=e}_lineIntersectsZone(e,t){return t>=e.startBufferLine&&t<=e.endBufferLine}_lineAdjacentToZone(e,t,i){return t>=e.startBufferLine-this._linePadding[i||"full"]&&t<=e.endBufferLine+this._linePadding[i||"full"]}_addLineToZone(e,t){e.startBufferLine=Math.min(e.startBufferLine,t),e.endBufferLine=Math.max(e.endBufferLine,t)}}},5744:function(e,t,i){var s=this&&this.__decorate||function(e,t,i,s){var r,n=arguments.length,o=n<3?t:null===s?s=Object.getOwnPropertyDescriptor(t,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)o=Reflect.decorate(e,t,i,s);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(o=(n<3?r(o):n>3?r(t,i,o):r(t,i))||o);return n>3&&o&&Object.defineProperty(t,i,o),o},r=this&&this.__param||function(e,t){return function(i,s){t(i,s,e)}};Object.defineProperty(t,"__esModule",{value:!0}),t.OverviewRulerRenderer=void 0;const n=i(5871),o=i(4725),a=i(844),h=i(2585),c={full:0,left:0,center:0,right:0},l={full:0,left:0,center:0,right:0},d={full:0,left:0,center:0,right:0};let _=t.OverviewRulerRenderer=class extends a.Disposable{get _width(){return this._optionsService.options.overviewRulerWidth||0}constructor(e,t,i,s,r,o,h){super(),this._viewportElement=e,this._screenElement=t,this._bufferService=i,this._decorationService=s,this._renderService=r,this._optionsService=o,this._coreBrowserService=h,this._colorZoneStore=new n.ColorZoneStore,this._shouldUpdateDimensions=!0,this._shouldUpdateAnchor=!0,this._lastKnownBufferLength=0,this._canvas=this._coreBrowserService.mainDocument.createElement("canvas"),this._canvas.classList.add("xterm-decoration-overview-ruler"),this._refreshCanvasDimensions(),this._viewportElement.parentElement?.insertBefore(this._canvas,this._viewportElement);const c=this._canvas.getContext("2d");if(!c)throw new Error("Ctx cannot be null");this._ctx=c,this._registerDecorationListeners(),this._registerBufferChangeListeners(),this._registerDimensionChangeListeners(),this.register((0,a.toDisposable)((()=>{this._canvas?.remove()})))}_registerDecorationListeners(){this.register(this._decorationService.onDecorationRegistered((()=>this._queueRefresh(void 0,!0)))),this.register(this._decorationService.onDecorationRemoved((()=>this._queueRefresh(void 0,!0))))}_registerBufferChangeListeners(){this.register(this._renderService.onRenderedViewportChange((()=>this._queueRefresh()))),this.register(this._bufferService.buffers.onBufferActivate((()=>{this._canvas.style.display=this._bufferService.buffer===this._bufferService.buffers.alt?"none":"block"}))),this.register(this._bufferService.onScroll((()=>{this._lastKnownBufferLength!==this._bufferService.buffers.normal.lines.length&&(this._refreshDrawHeightConstants(),this._refreshColorZonePadding())})))}_registerDimensionChangeListeners(){this.register(this._renderService.onRender((()=>{this._containerHeight&&this._containerHeight===this._screenElement.clientHeight||(this._queueRefresh(!0),this._containerHeight=this._screenElement.clientHeight)}))),this.register(this._optionsService.onSpecificOptionChange("overviewRulerWidth",(()=>this._queueRefresh(!0)))),this.register(this._coreBrowserService.onDprChange((()=>this._queueRefresh(!0)))),this._queueRefresh(!0)}_refreshDrawConstants(){const e=Math.floor(this._canvas.width/3),t=Math.ceil(this._canvas.width/3);l.full=this._canvas.width,l.left=e,l.center=t,l.right=e,this._refreshDrawHeightConstants(),d.full=0,d.left=0,d.center=l.left,d.right=l.left+l.center}_refreshDrawHeightConstants(){c.full=Math.round(2*this._coreBrowserService.dpr);const e=this._canvas.height/this._bufferService.buffer.lines.length,t=Math.round(Math.max(Math.min(e,12),6)*this._coreBrowserService.dpr);c.left=t,c.center=t,c.right=t}_refreshColorZonePadding(){this._colorZoneStore.setPadding({full:Math.floor(this._bufferService.buffers.active.lines.length/(this._canvas.height-1)*c.full),left:Math.floor(this._bufferService.buffers.active.lines.length/(this._canvas.height-1)*c.left),center:Math.floor(this._bufferService.buffers.active.lines.length/(this._canvas.height-1)*c.center),right:Math.floor(this._bufferService.buffers.active.lines.length/(this._canvas.height-1)*c.right)}),this._lastKnownBufferLength=this._bufferService.buffers.normal.lines.length}_refreshCanvasDimensions(){this._canvas.style.width=`${this._width}px`,this._canvas.width=Math.round(this._width*this._coreBrowserService.dpr),this._canvas.style.height=`${this._screenElement.clientHeight}px`,this._canvas.height=Math.round(this._screenElement.clientHeight*this._coreBrowserService.dpr),this._refreshDrawConstants(),this._refreshColorZonePadding()}_refreshDecorations(){this._shouldUpdateDimensions&&this._refreshCanvasDimensions(),this._ctx.clearRect(0,0,this._canvas.width,this._canvas.height),this._colorZoneStore.clear();for(const e of this._decorationService.decorations)this._colorZoneStore.addDecoration(e);this._ctx.lineWidth=1;const e=this._colorZoneStore.zones;for(const t of e)"full"!==t.position&&this._renderColorZone(t);for(const t of e)"full"===t.position&&this._renderColorZone(t);this._shouldUpdateDimensions=!1,this._shouldUpdateAnchor=!1}_renderColorZone(e){this._ctx.fillStyle=e.color,this._ctx.fillRect(d[e.position||"full"],Math.round((this._canvas.height-1)*(e.startBufferLine/this._bufferService.buffers.active.lines.length)-c[e.position||"full"]/2),l[e.position||"full"],Math.round((this._canvas.height-1)*((e.endBufferLine-e.startBufferLine)/this._bufferService.buffers.active.lines.length)+c[e.position||"full"]))}_queueRefresh(e,t){this._shouldUpdateDimensions=e||this._shouldUpdateDimensions,this._shouldUpdateAnchor=t||this._shouldUpdateAnchor,void 0===this._animationFrame&&(this._animationFrame=this._coreBrowserService.window.requestAnimationFrame((()=>{this._refreshDecorations(),this._animationFrame=void 0})))}};t.OverviewRulerRenderer=_=s([r(2,h.IBufferService),r(3,h.IDecorationService),r(4,o.IRenderService),r(5,h.IOptionsService),r(6,o.ICoreBrowserService)],_)},2950:function(e,t,i){var s=this&&this.__decorate||function(e,t,i,s){var r,n=arguments.length,o=n<3?t:null===s?s=Object.getOwnPropertyDescriptor(t,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)o=Reflect.decorate(e,t,i,s);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(o=(n<3?r(o):n>3?r(t,i,o):r(t,i))||o);return n>3&&o&&Object.defineProperty(t,i,o),o},r=this&&this.__param||function(e,t){return function(i,s){t(i,s,e)}};Object.defineProperty(t,"__esModule",{value:!0}),t.CompositionHelper=void 0;const n=i(4725),o=i(2585),a=i(2584);let h=t.CompositionHelper=class{get isComposing(){return this._isComposing}constructor(e,t,i,s,r,n){this._textarea=e,this._compositionView=t,this._bufferService=i,this._optionsService=s,this._coreService=r,this._renderService=n,this._isComposing=!1,this._isSendingComposition=!1,this._compositionPosition={start:0,end:0},this._dataAlreadySent=""}compositionstart(){this._isComposing=!0,this._compositionPosition.start=this._textarea.value.length,this._compositionView.textContent="",this._dataAlreadySent="",this._compositionView.classList.add("active")}compositionupdate(e){this._compositionView.textContent=e.data,this.updateCompositionElements(),setTimeout((()=>{this._compositionPosition.end=this._textarea.value.length}),0)}compositionend(){this._finalizeComposition(!0)}keydown(e){if(this._isComposing||this._isSendingComposition){if(229===e.keyCode)return!1;if(16===e.keyCode||17===e.keyCode||18===e.keyCode)return!1;this._finalizeComposition(!1)}return 229!==e.keyCode||(this._handleAnyTextareaChanges(),!1)}_finalizeComposition(e){if(this._compositionView.classList.remove("active"),this._isComposing=!1,e){const e={start:this._compositionPosition.start,end:this._compositionPosition.end};this._isSendingComposition=!0,setTimeout((()=>{if(this._isSendingComposition){let t;this._isSendingComposition=!1,e.start+=this._dataAlreadySent.length,t=this._isComposing?this._textarea.value.substring(e.start,e.end):this._textarea.value.substring(e.start),t.length>0&&this._coreService.triggerDataEvent(t,!0)}}),0)}else{this._isSendingComposition=!1;const e=this._textarea.value.substring(this._compositionPosition.start,this._compositionPosition.end);this._coreService.triggerDataEvent(e,!0)}}_handleAnyTextareaChanges(){const e=this._textarea.value;setTimeout((()=>{if(!this._isComposing){const t=this._textarea.value,i=t.replace(e,"");this._dataAlreadySent=i,t.length>e.length?this._coreService.triggerDataEvent(i,!0):t.length<e.length?this._coreService.triggerDataEvent(`${a.C0.DEL}`,!0):t.length===e.length&&t!==e&&this._coreService.triggerDataEvent(t,!0)}}),0)}updateCompositionElements(e){if(this._isComposing){if(this._bufferService.buffer.isCursorInViewport){const e=Math.min(this._bufferService.buffer.x,this._bufferService.cols-1),t=this._renderService.dimensions.css.cell.height,i=this._bufferService.buffer.y*this._renderService.dimensions.css.cell.height,s=e*this._renderService.dimensions.css.cell.width;this._compositionView.style.left=s+"px",this._compositionView.style.top=i+"px",this._compositionView.style.height=t+"px",this._compositionView.style.lineHeight=t+"px",this._compositionView.style.fontFamily=this._optionsService.rawOptions.fontFamily,this._compositionView.style.fontSize=this._optionsService.rawOptions.fontSize+"px";const r=this._compositionView.getBoundingClientRect();this._textarea.style.left=s+"px",this._textarea.style.top=i+"px",this._textarea.style.width=Math.max(r.width,1)+"px",this._textarea.style.height=Math.max(r.height,1)+"px",this._textarea.style.lineHeight=r.height+"px"}e||setTimeout((()=>this.updateCompositionElements(!0)),0)}}};t.CompositionHelper=h=s([r(2,o.IBufferService),r(3,o.IOptionsService),r(4,o.ICoreService),r(5,n.IRenderService)],h)},9806:(e,t)=>{function i(e,t,i){const s=i.getBoundingClientRect(),r=e.getComputedStyle(i),n=parseInt(r.getPropertyValue("padding-left")),o=parseInt(r.getPropertyValue("padding-top"));return[t.clientX-s.left-n,t.clientY-s.top-o]}Object.defineProperty(t,"__esModule",{value:!0}),t.getCoords=t.getCoordsRelativeToElement=void 0,t.getCoordsRelativeToElement=i,t.getCoords=function(e,t,s,r,n,o,a,h,c){if(!o)return;const l=i(e,t,s);return l?(l[0]=Math.ceil((l[0]+(c?a/2:0))/a),l[1]=Math.ceil(l[1]/h),l[0]=Math.min(Math.max(l[0],1),r+(c?1:0)),l[1]=Math.min(Math.max(l[1],1),n),l):void 0}},9504:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.moveToCellSequence=void 0;const s=i(2584);function r(e,t,i,s){const r=e-n(e,i),a=t-n(t,i),l=Math.abs(r-a)-function(e,t,i){let s=0;const r=e-n(e,i),a=t-n(t,i);for(let n=0;n<Math.abs(r-a);n++){const a="A"===o(e,t)?-1:1,h=i.buffer.lines.get(r+a*n);h?.isWrapped&&s++}return s}(e,t,i);return c(l,h(o(e,t),s))}function n(e,t){let i=0,s=t.buffer.lines.get(e),r=s?.isWrapped;for(;r&&e>=0&&e<t.rows;)i++,s=t.buffer.lines.get(--e),r=s?.isWrapped;return i}function o(e,t){return e>t?"A":"B"}function a(e,t,i,s,r,n){let o=e,a=t,h="";for(;o!==i||a!==s;)o+=r?1:-1,r&&o>n.cols-1?(h+=n.buffer.translateBufferLineToString(a,!1,e,o),o=0,e=0,a++):!r&&o<0&&(h+=n.buffer.translateBufferLineToString(a,!1,0,e+1),o=n.cols-1,e=o,a--);return h+n.buffer.translateBufferLineToString(a,!1,e,o)}function h(e,t){const i=t?"O":"[";return s.C0.ESC+i+e}function c(e,t){e=Math.floor(e);let i="";for(let s=0;s<e;s++)i+=t;return i}t.moveToCellSequence=function(e,t,i,s){const o=i.buffer.x,l=i.buffer.y;if(!i.buffer.hasScrollback)return function(e,t,i,s,o,l){return 0===r(t,s,o,l).length?"":c(a(e,t,e,t-n(t,o),!1,o).length,h("D",l))}(o,l,0,t,i,s)+r(l,t,i,s)+function(e,t,i,s,o,l){let d;d=r(t,s,o,l).length>0?s-n(s,o):t;const _=s,u=function(e,t,i,s,o,a){let h;return h=r(i,s,o,a).length>0?s-n(s,o):t,e<i&&h<=s||e>=i&&h<s?"C":"D"}(e,t,i,s,o,l);return c(a(e,d,i,_,"C"===u,o).length,h(u,l))}(o,l,e,t,i,s);let d;if(l===t)return d=o>e?"D":"C",c(Math.abs(o-e),h(d,s));d=l>t?"D":"C";const _=Math.abs(l-t);return c(function(e,t){return t.cols-e}(l>t?e:o,i)+(_-1)*i.cols+1+((l>t?o:e)-1),h(d,s))}},1296:function(e,t,i){var s=this&&this.__decorate||function(e,t,i,s){var r,n=arguments.length,o=n<3?t:null===s?s=Object.getOwnPropertyDescriptor(t,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)o=Reflect.decorate(e,t,i,s);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(o=(n<3?r(o):n>3?r(t,i,o):r(t,i))||o);return n>3&&o&&Object.defineProperty(t,i,o),o},r=this&&this.__param||function(e,t){return function(i,s){t(i,s,e)}};Object.defineProperty(t,"__esModule",{value:!0}),t.DomRenderer=void 0;const n=i(3787),o=i(2550),a=i(2223),h=i(6171),c=i(6052),l=i(4725),d=i(8055),_=i(8460),u=i(844),f=i(2585),v="xterm-dom-renderer-owner-",p="xterm-rows",g="xterm-fg-",m="xterm-bg-",S="xterm-focus",C="xterm-selection";let b=1,w=t.DomRenderer=class extends u.Disposable{constructor(e,t,i,s,r,a,l,d,f,g,m,S,w){super(),this._terminal=e,this._document=t,this._element=i,this._screenElement=s,this._viewportElement=r,this._helperContainer=a,this._linkifier2=l,this._charSizeService=f,this._optionsService=g,this._bufferService=m,this._coreBrowserService=S,this._themeService=w,this._terminalClass=b++,this._rowElements=[],this._selectionRenderModel=(0,c.createSelectionRenderModel)(),this.onRequestRedraw=this.register(new _.EventEmitter).event,this._rowContainer=this._document.createElement("div"),this._rowContainer.classList.add(p),this._rowContainer.style.lineHeight="normal",this._rowContainer.setAttribute("aria-hidden","true"),this._refreshRowElements(this._bufferService.cols,this._bufferService.rows),this._selectionContainer=this._document.createElement("div"),this._selectionContainer.classList.add(C),this._selectionContainer.setAttribute("aria-hidden","true"),this.dimensions=(0,h.createRenderDimensions)(),this._updateDimensions(),this.register(this._optionsService.onOptionChange((()=>this._handleOptionsChanged()))),this.register(this._themeService.onChangeColors((e=>this._injectCss(e)))),this._injectCss(this._themeService.colors),this._rowFactory=d.createInstance(n.DomRendererRowFactory,document),this._element.classList.add(v+this._terminalClass),this._screenElement.appendChild(this._rowContainer),this._screenElement.appendChild(this._selectionContainer),this.register(this._linkifier2.onShowLinkUnderline((e=>this._handleLinkHover(e)))),this.register(this._linkifier2.onHideLinkUnderline((e=>this._handleLinkLeave(e)))),this.register((0,u.toDisposable)((()=>{this._element.classList.remove(v+this._terminalClass),this._rowContainer.remove(),this._selectionContainer.remove(),this._widthCache.dispose(),this._themeStyleElement.remove(),this._dimensionsStyleElement.remove()}))),this._widthCache=new o.WidthCache(this._document,this._helperContainer),this._widthCache.setFont(this._optionsService.rawOptions.fontFamily,this._optionsService.rawOptions.fontSize,this._optionsService.rawOptions.fontWeight,this._optionsService.rawOptions.fontWeightBold),this._setDefaultSpacing()}_updateDimensions(){const e=this._coreBrowserService.dpr;this.dimensions.device.char.width=this._charSizeService.width*e,this.dimensions.device.char.height=Math.ceil(this._charSizeService.height*e),this.dimensions.device.cell.width=this.dimensions.device.char.width+Math.round(this._optionsService.rawOptions.letterSpacing),this.dimensions.device.cell.height=Math.floor(this.dimensions.device.char.height*this._optionsService.rawOptions.lineHeight),this.dimensions.device.char.left=0,this.dimensions.device.char.top=0,this.dimensions.device.canvas.width=this.dimensions.device.cell.width*this._bufferService.cols,this.dimensions.device.canvas.height=this.dimensions.device.cell.height*this._bufferService.rows,this.dimensions.css.canvas.width=Math.round(this.dimensions.device.canvas.width/e),this.dimensions.css.canvas.height=Math.round(this.dimensions.device.canvas.height/e),this.dimensions.css.cell.width=this.dimensions.css.canvas.width/this._bufferService.cols,this.dimensions.css.cell.height=this.dimensions.css.canvas.height/this._bufferService.rows;for(const e of this._rowElements)e.style.width=`${this.dimensions.css.canvas.width}px`,e.style.height=`${this.dimensions.css.cell.height}px`,e.style.lineHeight=`${this.dimensions.css.cell.height}px`,e.style.overflow="hidden";this._dimensionsStyleElement||(this._dimensionsStyleElement=this._document.createElement("style"),this._screenElement.appendChild(this._dimensionsStyleElement));const t=`${this._terminalSelector} .${p} span { display: inline-block; height: 100%; vertical-align: top;}`;this._dimensionsStyleElement.textContent=t,this._selectionContainer.style.height=this._viewportElement.style.height,this._screenElement.style.width=`${this.dimensions.css.canvas.width}px`,this._screenElement.style.height=`${this.dimensions.css.canvas.height}px`}_injectCss(e){this._themeStyleElement||(this._themeStyleElement=this._document.createElement("style"),this._screenElement.appendChild(this._themeStyleElement));let t=`${this._terminalSelector} .${p} { color: ${e.foreground.css}; font-family: ${this._optionsService.rawOptions.fontFamily}; font-size: ${this._optionsService.rawOptions.fontSize}px; font-kerning: none; white-space: pre}`;t+=`${this._terminalSelector} .${p} .xterm-dim { color: ${d.color.multiplyOpacity(e.foreground,.5).css};}`,t+=`${this._terminalSelector} span:not(.xterm-bold) { font-weight: ${this._optionsService.rawOptions.fontWeight};}${this._terminalSelector} span.xterm-bold { font-weight: ${this._optionsService.rawOptions.fontWeightBold};}${this._terminalSelector} span.xterm-italic { font-style: italic;}`;const i=`blink_underline_${this._terminalClass}`,s=`blink_bar_${this._terminalClass}`,r=`blink_block_${this._terminalClass}`;t+=`@keyframes ${i} { 50% {  border-bottom-style: hidden; }}`,t+=`@keyframes ${s} { 50% {  box-shadow: none; }}`,t+=`@keyframes ${r} { 0% {  background-color: ${e.cursor.css};  color: ${e.cursorAccent.css}; } 50% {  background-color: inherit;  color: ${e.cursor.css}; }}`,t+=`${this._terminalSelector} .${p}.${S} .xterm-cursor.xterm-cursor-blink.xterm-cursor-underline { animation: ${i} 1s step-end infinite;}${this._terminalSelector} .${p}.${S} .xterm-cursor.xterm-cursor-blink.xterm-cursor-bar { animation: ${s} 1s step-end infinite;}${this._terminalSelector} .${p}.${S} .xterm-cursor.xterm-cursor-blink.xterm-cursor-block { animation: ${r} 1s step-end infinite;}${this._terminalSelector} .${p} .xterm-cursor.xterm-cursor-block { background-color: ${e.cursor.css}; color: ${e.cursorAccent.css};}${this._terminalSelector} .${p} .xterm-cursor.xterm-cursor-block:not(.xterm-cursor-blink) { background-color: ${e.cursor.css} !important; color: ${e.cursorAccent.css} !important;}${this._terminalSelector} .${p} .xterm-cursor.xterm-cursor-outline { outline: 1px solid ${e.cursor.css}; outline-offset: -1px;}${this._terminalSelector} .${p} .xterm-cursor.xterm-cursor-bar { box-shadow: ${this._optionsService.rawOptions.cursorWidth}px 0 0 ${e.cursor.css} inset;}${this._terminalSelector} .${p} .xterm-cursor.xterm-cursor-underline { border-bottom: 1px ${e.cursor.css}; border-bottom-style: solid; height: calc(100% - 1px);}`,t+=`${this._terminalSelector} .${C} { position: absolute; top: 0; left: 0; z-index: 1; pointer-events: none;}${this._terminalSelector}.focus .${C} div { position: absolute; background-color: ${e.selectionBackgroundOpaque.css};}${this._terminalSelector} .${C} div { position: absolute; background-color: ${e.selectionInactiveBackgroundOpaque.css};}`;for(const[i,s]of e.ansi.entries())t+=`${this._terminalSelector} .${g}${i} { color: ${s.css}; }${this._terminalSelector} .${g}${i}.xterm-dim { color: ${d.color.multiplyOpacity(s,.5).css}; }${this._terminalSelector} .${m}${i} { background-color: ${s.css}; }`;t+=`${this._terminalSelector} .${g}${a.INVERTED_DEFAULT_COLOR} { color: ${d.color.opaque(e.background).css}; }${this._terminalSelector} .${g}${a.INVERTED_DEFAULT_COLOR}.xterm-dim { color: ${d.color.multiplyOpacity(d.color.opaque(e.background),.5).css}; }${this._terminalSelector} .${m}${a.INVERTED_DEFAULT_COLOR} { background-color: ${e.foreground.css}; }`,this._themeStyleElement.textContent=t}_setDefaultSpacing(){const e=this.dimensions.css.cell.width-this._widthCache.get("W",!1,!1);this._rowContainer.style.letterSpacing=`${e}px`,this._rowFactory.defaultSpacing=e}handleDevicePixelRatioChange(){this._updateDimensions(),this._widthCache.clear(),this._setDefaultSpacing()}_refreshRowElements(e,t){for(let e=this._rowElements.length;e<=t;e++){const e=this._document.createElement("div");this._rowContainer.appendChild(e),this._rowElements.push(e)}for(;this._rowElements.length>t;)this._rowContainer.removeChild(this._rowElements.pop())}handleResize(e,t){this._refreshRowElements(e,t),this._updateDimensions(),this.handleSelectionChanged(this._selectionRenderModel.selectionStart,this._selectionRenderModel.selectionEnd,this._selectionRenderModel.columnSelectMode)}handleCharSizeChanged(){this._updateDimensions(),this._widthCache.clear(),this._setDefaultSpacing()}handleBlur(){this._rowContainer.classList.remove(S),this.renderRows(0,this._bufferService.rows-1)}handleFocus(){this._rowContainer.classList.add(S),this.renderRows(this._bufferService.buffer.y,this._bufferService.buffer.y)}handleSelectionChanged(e,t,i){if(this._selectionContainer.replaceChildren(),this._rowFactory.handleSelectionChanged(e,t,i),this.renderRows(0,this._bufferService.rows-1),!e||!t)return;this._selectionRenderModel.update(this._terminal,e,t,i);const s=this._selectionRenderModel.viewportStartRow,r=this._selectionRenderModel.viewportEndRow,n=this._selectionRenderModel.viewportCappedStartRow,o=this._selectionRenderModel.viewportCappedEndRow;if(n>=this._bufferService.rows||o<0)return;const a=this._document.createDocumentFragment();if(i){const i=e[0]>t[0];a.appendChild(this._createSelectionElement(n,i?t[0]:e[0],i?e[0]:t[0],o-n+1))}else{const i=s===n?e[0]:0,h=n===r?t[0]:this._bufferService.cols;a.appendChild(this._createSelectionElement(n,i,h));const c=o-n-1;if(a.appendChild(this._createSelectionElement(n+1,0,this._bufferService.cols,c)),n!==o){const e=r===o?t[0]:this._bufferService.cols;a.appendChild(this._createSelectionElement(o,0,e))}}this._selectionContainer.appendChild(a)}_createSelectionElement(e,t,i,s=1){const r=this._document.createElement("div"),n=t*this.dimensions.css.cell.width;let o=this.dimensions.css.cell.width*(i-t);return n+o>this.dimensions.css.canvas.width&&(o=this.dimensions.css.canvas.width-n),r.style.height=s*this.dimensions.css.cell.height+"px",r.style.top=e*this.dimensions.css.cell.height+"px",r.style.left=`${n}px`,r.style.width=`${o}px`,r}handleCursorMove(){}_handleOptionsChanged(){this._updateDimensions(),this._injectCss(this._themeService.colors),this._widthCache.setFont(this._optionsService.rawOptions.fontFamily,this._optionsService.rawOptions.fontSize,this._optionsService.rawOptions.fontWeight,this._optionsService.rawOptions.fontWeightBold),this._setDefaultSpacing()}clear(){for(const e of this._rowElements)e.replaceChildren()}renderRows(e,t){const i=this._bufferService.buffer,s=i.ybase+i.y,r=Math.min(i.x,this._bufferService.cols-1),n=this._optionsService.rawOptions.cursorBlink,o=this._optionsService.rawOptions.cursorStyle,a=this._optionsService.rawOptions.cursorInactiveStyle;for(let h=e;h<=t;h++){const e=h+i.ydisp,t=this._rowElements[h],c=i.lines.get(e);if(!t||!c)break;t.replaceChildren(...this._rowFactory.createRow(c,e,e===s,o,a,r,n,this.dimensions.css.cell.width,this._widthCache,-1,-1))}}get _terminalSelector(){return`.${v}${this._terminalClass}`}_handleLinkHover(e){this._setCellUnderline(e.x1,e.x2,e.y1,e.y2,e.cols,!0)}_handleLinkLeave(e){this._setCellUnderline(e.x1,e.x2,e.y1,e.y2,e.cols,!1)}_setCellUnderline(e,t,i,s,r,n){i<0&&(e=0),s<0&&(t=0);const o=this._bufferService.rows-1;i=Math.max(Math.min(i,o),0),s=Math.max(Math.min(s,o),0),r=Math.min(r,this._bufferService.cols);const a=this._bufferService.buffer,h=a.ybase+a.y,c=Math.min(a.x,r-1),l=this._optionsService.rawOptions.cursorBlink,d=this._optionsService.rawOptions.cursorStyle,_=this._optionsService.rawOptions.cursorInactiveStyle;for(let o=i;o<=s;++o){const u=o+a.ydisp,f=this._rowElements[o],v=a.lines.get(u);if(!f||!v)break;f.replaceChildren(...this._rowFactory.createRow(v,u,u===h,d,_,c,l,this.dimensions.css.cell.width,this._widthCache,n?o===i?e:0:-1,n?(o===s?t:r)-1:-1))}}};t.DomRenderer=w=s([r(7,f.IInstantiationService),r(8,l.ICharSizeService),r(9,f.IOptionsService),r(10,f.IBufferService),r(11,l.ICoreBrowserService),r(12,l.IThemeService)],w)},3787:function(e,t,i){var s=this&&this.__decorate||function(e,t,i,s){var r,n=arguments.length,o=n<3?t:null===s?s=Object.getOwnPropertyDescriptor(t,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)o=Reflect.decorate(e,t,i,s);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(o=(n<3?r(o):n>3?r(t,i,o):r(t,i))||o);return n>3&&o&&Object.defineProperty(t,i,o),o},r=this&&this.__param||function(e,t){return function(i,s){t(i,s,e)}};Object.defineProperty(t,"__esModule",{value:!0}),t.DomRendererRowFactory=void 0;const n=i(2223),o=i(643),a=i(511),h=i(2585),c=i(8055),l=i(4725),d=i(4269),_=i(6171),u=i(3734);let f=t.DomRendererRowFactory=class{constructor(e,t,i,s,r,n,o){this._document=e,this._characterJoinerService=t,this._optionsService=i,this._coreBrowserService=s,this._coreService=r,this._decorationService=n,this._themeService=o,this._workCell=new a.CellData,this._columnSelectMode=!1,this.defaultSpacing=0}handleSelectionChanged(e,t,i){this._selectionStart=e,this._selectionEnd=t,this._columnSelectMode=i}createRow(e,t,i,s,r,a,h,l,_,f,p){const g=[],m=this._characterJoinerService.getJoinedCharacters(t),S=this._themeService.colors;let C,b=e.getNoBgTrimmedLength();i&&b<a+1&&(b=a+1);let w=0,y="",E=0,k=0,L=0,D=!1,R=0,x=!1,A=0;const B=[],T=-1!==f&&-1!==p;for(let M=0;M<b;M++){e.loadCell(M,this._workCell);let b=this._workCell.getWidth();if(0===b)continue;let O=!1,P=M,I=this._workCell;if(m.length>0&&M===m[0][0]){O=!0;const t=m.shift();I=new d.JoinedCellData(this._workCell,e.translateToString(!0,t[0],t[1]),t[1]-t[0]),P=t[1]-1,b=I.getWidth()}const H=this._isCellInSelection(M,t),F=i&&M===a,W=T&&M>=f&&M<=p;let U=!1;this._decorationService.forEachDecorationAtCell(M,t,void 0,(e=>{U=!0}));let N=I.getChars()||o.WHITESPACE_CELL_CHAR;if(" "===N&&(I.isUnderline()||I.isOverline())&&(N="\xA0"),A=b*l-_.get(N,I.isBold(),I.isItalic()),C){if(w&&(H&&x||!H&&!x&&I.bg===E)&&(H&&x&&S.selectionForeground||I.fg===k)&&I.extended.ext===L&&W===D&&A===R&&!F&&!O&&!U){I.isInvisible()?y+=o.WHITESPACE_CELL_CHAR:y+=N,w++;continue}w&&(C.textContent=y),C=this._document.createElement("span"),w=0,y=""}else C=this._document.createElement("span");if(E=I.bg,k=I.fg,L=I.extended.ext,D=W,R=A,x=H,O&&a>=M&&a<=P&&(a=M),!this._coreService.isCursorHidden&&F&&this._coreService.isCursorInitialized)if(B.push("xterm-cursor"),this._coreBrowserService.isFocused)h&&B.push("xterm-cursor-blink"),B.push("bar"===s?"xterm-cursor-bar":"underline"===s?"xterm-cursor-underline":"xterm-cursor-block");else if(r)switch(r){case"outline":B.push("xterm-cursor-outline");break;case"block":B.push("xterm-cursor-block");break;case"bar":B.push("xterm-cursor-bar");break;case"underline":B.push("xterm-cursor-underline")}if(I.isBold()&&B.push("xterm-bold"),I.isItalic()&&B.push("xterm-italic"),I.isDim()&&B.push("xterm-dim"),y=I.isInvisible()?o.WHITESPACE_CELL_CHAR:I.getChars()||o.WHITESPACE_CELL_CHAR,I.isUnderline()&&(B.push(`xterm-underline-${I.extended.underlineStyle}`)," "===y&&(y="\xA0"),!I.isUnderlineColorDefault()))if(I.isUnderlineColorRGB())C.style.textDecorationColor=`rgb(${u.AttributeData.toColorRGB(I.getUnderlineColor()).join(",")})`;else{let e=I.getUnderlineColor();this._optionsService.rawOptions.drawBoldTextInBrightColors&&I.isBold()&&e<8&&(e+=8),C.style.textDecorationColor=S.ansi[e].css}I.isOverline()&&(B.push("xterm-overline")," "===y&&(y="\xA0")),I.isStrikethrough()&&B.push("xterm-strikethrough"),W&&(C.style.textDecoration="underline");let $=I.getFgColor(),j=I.getFgColorMode(),z=I.getBgColor(),K=I.getBgColorMode();const q=!!I.isInverse();if(q){const e=$;$=z,z=e;const t=j;j=K,K=t}let V,G,X,J=!1;switch(this._decorationService.forEachDecorationAtCell(M,t,void 0,(e=>{"top"!==e.options.layer&&J||(e.backgroundColorRGB&&(K=50331648,z=e.backgroundColorRGB.rgba>>8&16777215,V=e.backgroundColorRGB),e.foregroundColorRGB&&(j=50331648,$=e.foregroundColorRGB.rgba>>8&16777215,G=e.foregroundColorRGB),J="top"===e.options.layer)})),!J&&H&&(V=this._coreBrowserService.isFocused?S.selectionBackgroundOpaque:S.selectionInactiveBackgroundOpaque,z=V.rgba>>8&16777215,K=50331648,J=!0,S.selectionForeground&&(j=50331648,$=S.selectionForeground.rgba>>8&16777215,G=S.selectionForeground)),J&&B.push("xterm-decoration-top"),K){case 16777216:case 33554432:X=S.ansi[z],B.push(`xterm-bg-${z}`);break;case 50331648:X=c.channels.toColor(z>>16,z>>8&255,255&z),this._addStyle(C,`background-color:#${v((z>>>0).toString(16),"0",6)}`);break;default:q?(X=S.foreground,B.push(`xterm-bg-${n.INVERTED_DEFAULT_COLOR}`)):X=S.background}switch(V||I.isDim()&&(V=c.color.multiplyOpacity(X,.5)),j){case 16777216:case 33554432:I.isBold()&&$<8&&this._optionsService.rawOptions.drawBoldTextInBrightColors&&($+=8),this._applyMinimumContrast(C,X,S.ansi[$],I,V,void 0)||B.push(`xterm-fg-${$}`);break;case 50331648:const e=c.channels.toColor($>>16&255,$>>8&255,255&$);this._applyMinimumContrast(C,X,e,I,V,G)||this._addStyle(C,`color:#${v($.toString(16),"0",6)}`);break;default:this._applyMinimumContrast(C,X,S.foreground,I,V,G)||q&&B.push(`xterm-fg-${n.INVERTED_DEFAULT_COLOR}`)}B.length&&(C.className=B.join(" "),B.length=0),F||O||U?C.textContent=y:w++,A!==this.defaultSpacing&&(C.style.letterSpacing=`${A}px`),g.push(C),M=P}return C&&w&&(C.textContent=y),g}_applyMinimumContrast(e,t,i,s,r,n){if(1===this._optionsService.rawOptions.minimumContrastRatio||(0,_.treatGlyphAsBackgroundColor)(s.getCode()))return!1;const o=this._getContrastCache(s);let a;if(r||n||(a=o.getColor(t.rgba,i.rgba)),void 0===a){const e=this._optionsService.rawOptions.minimumContrastRatio/(s.isDim()?2:1);a=c.color.ensureContrastRatio(r||t,n||i,e),o.setColor((r||t).rgba,(n||i).rgba,a??null)}return!!a&&(this._addStyle(e,`color:${a.css}`),!0)}_getContrastCache(e){return e.isDim()?this._themeService.colors.halfContrastCache:this._themeService.colors.contrastCache}_addStyle(e,t){e.setAttribute("style",`${e.getAttribute("style")||""}${t};`)}_isCellInSelection(e,t){const i=this._selectionStart,s=this._selectionEnd;return!(!i||!s)&&(this._columnSelectMode?i[0]<=s[0]?e>=i[0]&&t>=i[1]&&e<s[0]&&t<=s[1]:e<i[0]&&t>=i[1]&&e>=s[0]&&t<=s[1]:t>i[1]&&t<s[1]||i[1]===s[1]&&t===i[1]&&e>=i[0]&&e<s[0]||i[1]<s[1]&&t===s[1]&&e<s[0]||i[1]<s[1]&&t===i[1]&&e>=i[0])}};function v(e,t,i){for(;e.length<i;)e=t+e;return e}t.DomRendererRowFactory=f=s([r(1,l.ICharacterJoinerService),r(2,h.IOptionsService),r(3,l.ICoreBrowserService),r(4,h.ICoreService),r(5,h.IDecorationService),r(6,l.IThemeService)],f)},2550:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.WidthCache=void 0,t.WidthCache=class{constructor(e,t){this._flat=new Float32Array(256),this._font="",this._fontSize=0,this._weight="normal",this._weightBold="bold",this._measureElements=[],this._container=e.createElement("div"),this._container.classList.add("xterm-width-cache-measure-container"),this._container.setAttribute("aria-hidden","true"),this._container.style.whiteSpace="pre",this._container.style.fontKerning="none";const i=e.createElement("span");i.classList.add("xterm-char-measure-element");const s=e.createElement("span");s.classList.add("xterm-char-measure-element"),s.style.fontWeight="bold";const r=e.createElement("span");r.classList.add("xterm-char-measure-element"),r.style.fontStyle="italic";const n=e.createElement("span");n.classList.add("xterm-char-measure-element"),n.style.fontWeight="bold",n.style.fontStyle="italic",this._measureElements=[i,s,r,n],this._container.appendChild(i),this._container.appendChild(s),this._container.appendChild(r),this._container.appendChild(n),t.appendChild(this._container),this.clear()}dispose(){this._container.remove(),this._measureElements.length=0,this._holey=void 0}clear(){this._flat.fill(-9999),this._holey=new Map}setFont(e,t,i,s){e===this._font&&t===this._fontSize&&i===this._weight&&s===this._weightBold||(this._font=e,this._fontSize=t,this._weight=i,this._weightBold=s,this._container.style.fontFamily=this._font,this._container.style.fontSize=`${this._fontSize}px`,this._measureElements[0].style.fontWeight=`${i}`,this._measureElements[1].style.fontWeight=`${s}`,this._measureElements[2].style.fontWeight=`${i}`,this._measureElements[3].style.fontWeight=`${s}`,this.clear())}get(e,t,i){let s=0;if(!t&&!i&&1===e.length&&(s=e.charCodeAt(0))<256){if(-9999!==this._flat[s])return this._flat[s];const t=this._measure(e,0);return t>0&&(this._flat[s]=t),t}let r=e;t&&(r+="B"),i&&(r+="I");let n=this._holey.get(r);if(void 0===n){let s=0;t&&(s|=1),i&&(s|=2),n=this._measure(e,s),n>0&&this._holey.set(r,n)}return n}_measure(e,t){const i=this._measureElements[t];return i.textContent=e.repeat(32),i.offsetWidth/32}}},2223:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.TEXT_BASELINE=t.DIM_OPACITY=t.INVERTED_DEFAULT_COLOR=void 0;const s=i(6114);t.INVERTED_DEFAULT_COLOR=257,t.DIM_OPACITY=.5,t.TEXT_BASELINE=s.isFirefox||s.isLegacyEdge?"bottom":"ideographic"},6171:(e,t)=>{function i(e){return 57508<=e&&e<=57558}function s(e){return e>=128512&&e<=128591||e>=127744&&e<=128511||e>=128640&&e<=128767||e>=9728&&e<=9983||e>=9984&&e<=10175||e>=65024&&e<=65039||e>=129280&&e<=129535||e>=127462&&e<=127487}Object.defineProperty(t,"__esModule",{value:!0}),t.computeNextVariantOffset=t.createRenderDimensions=t.treatGlyphAsBackgroundColor=t.allowRescaling=t.isEmoji=t.isRestrictedPowerlineGlyph=t.isPowerlineGlyph=t.throwIfFalsy=void 0,t.throwIfFalsy=function(e){if(!e)throw new Error("value must not be falsy");return e},t.isPowerlineGlyph=i,t.isRestrictedPowerlineGlyph=function(e){return 57520<=e&&e<=57527},t.isEmoji=s,t.allowRescaling=function(e,t,r,n){return 1===t&&r>Math.ceil(1.5*n)&&void 0!==e&&e>255&&!s(e)&&!i(e)&&!function(e){return 57344<=e&&e<=63743}(e)},t.treatGlyphAsBackgroundColor=function(e){return i(e)||function(e){return 9472<=e&&e<=9631}(e)},t.createRenderDimensions=function(){return{css:{canvas:{width:0,height:0},cell:{width:0,height:0}},device:{canvas:{width:0,height:0},cell:{width:0,height:0},char:{width:0,height:0,left:0,top:0}}}},t.computeNextVariantOffset=function(e,t,i=0){return(e-(2*Math.round(t)-i))%(2*Math.round(t))}},6052:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.createSelectionRenderModel=void 0;class i{constructor(){this.clear()}clear(){this.hasSelection=!1,this.columnSelectMode=!1,this.viewportStartRow=0,this.viewportEndRow=0,this.viewportCappedStartRow=0,this.viewportCappedEndRow=0,this.startCol=0,this.endCol=0,this.selectionStart=void 0,this.selectionEnd=void 0}update(e,t,i,s=!1){if(this.selectionStart=t,this.selectionEnd=i,!t||!i||t[0]===i[0]&&t[1]===i[1])return void this.clear();const r=e.buffers.active.ydisp,n=t[1]-r,o=i[1]-r,a=Math.max(n,0),h=Math.min(o,e.rows-1);a>=e.rows||h<0?this.clear():(this.hasSelection=!0,this.columnSelectMode=s,this.viewportStartRow=n,this.viewportEndRow=o,this.viewportCappedStartRow=a,this.viewportCappedEndRow=h,this.startCol=t[0],this.endCol=i[0])}isCellSelected(e,t,i){return!!this.hasSelection&&(i-=e.buffer.active.viewportY,this.columnSelectMode?this.startCol<=this.endCol?t>=this.startCol&&i>=this.viewportCappedStartRow&&t<this.endCol&&i<=this.viewportCappedEndRow:t<this.startCol&&i>=this.viewportCappedStartRow&&t>=this.endCol&&i<=this.viewportCappedEndRow:i>this.viewportStartRow&&i<this.viewportEndRow||this.viewportStartRow===this.viewportEndRow&&i===this.viewportStartRow&&t>=this.startCol&&t<this.endCol||this.viewportStartRow<this.viewportEndRow&&i===this.viewportEndRow&&t<this.endCol||this.viewportStartRow<this.viewportEndRow&&i===this.viewportStartRow&&t>=this.startCol)}}t.createSelectionRenderModel=function(){return new i}},456:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.SelectionModel=void 0,t.SelectionModel=class{constructor(e){this._bufferService=e,this.isSelectAllActive=!1,this.selectionStartLength=0}clearSelection(){this.selectionStart=void 0,this.selectionEnd=void 0,this.isSelectAllActive=!1,this.selectionStartLength=0}get finalSelectionStart(){return this.isSelectAllActive?[0,0]:this.selectionEnd&&this.selectionStart&&this.areSelectionValuesReversed()?this.selectionEnd:this.selectionStart}get finalSelectionEnd(){if(this.isSelectAllActive)return[this._bufferService.cols,this._bufferService.buffer.ybase+this._bufferService.rows-1];if(this.selectionStart){if(!this.selectionEnd||this.areSelectionValuesReversed()){const e=this.selectionStart[0]+this.selectionStartLength;return e>this._bufferService.cols?e%this._bufferService.cols==0?[this._bufferService.cols,this.selectionStart[1]+Math.floor(e/this._bufferService.cols)-1]:[e%this._bufferService.cols,this.selectionStart[1]+Math.floor(e/this._bufferService.cols)]:[e,this.selectionStart[1]]}if(this.selectionStartLength&&this.selectionEnd[1]===this.selectionStart[1]){const e=this.selectionStart[0]+this.selectionStartLength;return e>this._bufferService.cols?[e%this._bufferService.cols,this.selectionStart[1]+Math.floor(e/this._bufferService.cols)]:[Math.max(e,this.selectionEnd[0]),this.selectionEnd[1]]}return this.selectionEnd}}areSelectionValuesReversed(){const e=this.selectionStart,t=this.selectionEnd;return!(!e||!t)&&(e[1]>t[1]||e[1]===t[1]&&e[0]>t[0])}handleTrim(e){return this.selectionStart&&(this.selectionStart[1]-=e),this.selectionEnd&&(this.selectionEnd[1]-=e),this.selectionEnd&&this.selectionEnd[1]<0?(this.clearSelection(),!0):(this.selectionStart&&this.selectionStart[1]<0&&(this.selectionStart[1]=0),!1)}}},428:function(e,t,i){var s=this&&this.__decorate||function(e,t,i,s){var r,n=arguments.length,o=n<3?t:null===s?s=Object.getOwnPropertyDescriptor(t,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)o=Reflect.decorate(e,t,i,s);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(o=(n<3?r(o):n>3?r(t,i,o):r(t,i))||o);return n>3&&o&&Object.defineProperty(t,i,o),o},r=this&&this.__param||function(e,t){return function(i,s){t(i,s,e)}};Object.defineProperty(t,"__esModule",{value:!0}),t.CharSizeService=void 0;const n=i(2585),o=i(8460),a=i(844);let h=t.CharSizeService=class extends a.Disposable{get hasValidSize(){return this.width>0&&this.height>0}constructor(e,t,i){super(),this._optionsService=i,this.width=0,this.height=0,this._onCharSizeChange=this.register(new o.EventEmitter),this.onCharSizeChange=this._onCharSizeChange.event;try{this._measureStrategy=this.register(new d(this._optionsService))}catch{this._measureStrategy=this.register(new l(e,t,this._optionsService))}this.register(this._optionsService.onMultipleOptionChange(["fontFamily","fontSize"],(()=>this.measure())))}measure(){const e=this._measureStrategy.measure();e.width===this.width&&e.height===this.height||(this.width=e.width,this.height=e.height,this._onCharSizeChange.fire())}};t.CharSizeService=h=s([r(2,n.IOptionsService)],h);class c extends a.Disposable{constructor(){super(...arguments),this._result={width:0,height:0}}_validateAndSet(e,t){void 0!==e&&e>0&&void 0!==t&&t>0&&(this._result.width=e,this._result.height=t)}}class l extends c{constructor(e,t,i){super(),this._document=e,this._parentElement=t,this._optionsService=i,this._measureElement=this._document.createElement("span"),this._measureElement.classList.add("xterm-char-measure-element"),this._measureElement.textContent="W".repeat(32),this._measureElement.setAttribute("aria-hidden","true"),this._measureElement.style.whiteSpace="pre",this._measureElement.style.fontKerning="none",this._parentElement.appendChild(this._measureElement)}measure(){return this._measureElement.style.fontFamily=this._optionsService.rawOptions.fontFamily,this._measureElement.style.fontSize=`${this._optionsService.rawOptions.fontSize}px`,this._validateAndSet(Number(this._measureElement.offsetWidth)/32,Number(this._measureElement.offsetHeight)),this._result}}class d extends c{constructor(e){super(),this._optionsService=e,this._canvas=new OffscreenCanvas(100,100),this._ctx=this._canvas.getContext("2d");const t=this._ctx.measureText("W");if(!("width"in t&&"fontBoundingBoxAscent"in t&&"fontBoundingBoxDescent"in t))throw new Error("Required font metrics not supported")}measure(){this._ctx.font=`${this._optionsService.rawOptions.fontSize}px ${this._optionsService.rawOptions.fontFamily}`;const e=this._ctx.measureText("W");return this._validateAndSet(e.width,e.fontBoundingBoxAscent+e.fontBoundingBoxDescent),this._result}}},4269:function(e,t,i){var s=this&&this.__decorate||function(e,t,i,s){var r,n=arguments.length,o=n<3?t:null===s?s=Object.getOwnPropertyDescriptor(t,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)o=Reflect.decorate(e,t,i,s);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(o=(n<3?r(o):n>3?r(t,i,o):r(t,i))||o);return n>3&&o&&Object.defineProperty(t,i,o),o},r=this&&this.__param||function(e,t){return function(i,s){t(i,s,e)}};Object.defineProperty(t,"__esModule",{value:!0}),t.CharacterJoinerService=t.JoinedCellData=void 0;const n=i(3734),o=i(643),a=i(511),h=i(2585);class c extends n.AttributeData{constructor(e,t,i){super(),this.content=0,this.combinedData="",this.fg=e.fg,this.bg=e.bg,this.combinedData=t,this._width=i}isCombined(){return 2097152}getWidth(){return this._width}getChars(){return this.combinedData}getCode(){return 2097151}setFromCharData(e){throw new Error("not implemented")}getAsCharData(){return[this.fg,this.getChars(),this.getWidth(),this.getCode()]}}t.JoinedCellData=c;let l=t.CharacterJoinerService=class e{constructor(e){this._bufferService=e,this._characterJoiners=[],this._nextCharacterJoinerId=0,this._workCell=new a.CellData}register(e){const t={id:this._nextCharacterJoinerId++,handler:e};return this._characterJoiners.push(t),t.id}deregister(e){for(let t=0;t<this._characterJoiners.length;t++)if(this._characterJoiners[t].id===e)return this._characterJoiners.splice(t,1),!0;return!1}getJoinedCharacters(e){if(0===this._characterJoiners.length)return[];const t=this._bufferService.buffer.lines.get(e);if(!t||0===t.length)return[];const i=[],s=t.translateToString(!0);let r=0,n=0,a=0,h=t.getFg(0),c=t.getBg(0);for(let e=0;e<t.getTrimmedLength();e++)if(t.loadCell(e,this._workCell),0!==this._workCell.getWidth()){if(this._workCell.fg!==h||this._workCell.bg!==c){if(e-r>1){const e=this._getJoinedRanges(s,a,n,t,r);for(let t=0;t<e.length;t++)i.push(e[t])}r=e,a=n,h=this._workCell.fg,c=this._workCell.bg}n+=this._workCell.getChars().length||o.WHITESPACE_CELL_CHAR.length}if(this._bufferService.cols-r>1){const e=this._getJoinedRanges(s,a,n,t,r);for(let t=0;t<e.length;t++)i.push(e[t])}return i}_getJoinedRanges(t,i,s,r,n){const o=t.substring(i,s);let a=[];try{a=this._characterJoiners[0].handler(o)}catch(e){console.error(e)}for(let t=1;t<this._characterJoiners.length;t++)try{const i=this._characterJoiners[t].handler(o);for(let t=0;t<i.length;t++)e._mergeRanges(a,i[t])}catch(e){console.error(e)}return this._stringRangesToCellRanges(a,r,n),a}_stringRangesToCellRanges(e,t,i){let s=0,r=!1,n=0,a=e[s];if(a){for(let h=i;h<this._bufferService.cols;h++){const i=t.getWidth(h),c=t.getString(h).length||o.WHITESPACE_CELL_CHAR.length;if(0!==i){if(!r&&a[0]<=n&&(a[0]=h,r=!0),a[1]<=n){if(a[1]=h,a=e[++s],!a)break;a[0]<=n?(a[0]=h,r=!0):r=!1}n+=c}}a&&(a[1]=this._bufferService.cols)}}static _mergeRanges(e,t){let i=!1;for(let s=0;s<e.length;s++){const r=e[s];if(i){if(t[1]<=r[0])return e[s-1][1]=t[1],e;if(t[1]<=r[1])return e[s-1][1]=Math.max(t[1],r[1]),e.splice(s,1),e;e.splice(s,1),s--}else{if(t[1]<=r[0])return e.splice(s,0,t),e;if(t[1]<=r[1])return r[0]=Math.min(t[0],r[0]),e;t[0]<r[1]&&(r[0]=Math.min(t[0],r[0]),i=!0)}}return i?e[e.length-1][1]=t[1]:e.push(t),e}};t.CharacterJoinerService=l=s([r(0,h.IBufferService)],l)},5114:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.CoreBrowserService=void 0;const s=i(844),r=i(8460),n=i(3656);class o extends s.Disposable{constructor(e,t,i){super(),this._textarea=e,this._window=t,this.mainDocument=i,this._isFocused=!1,this._cachedIsFocused=void 0,this._screenDprMonitor=new a(this._window),this._onDprChange=this.register(new r.EventEmitter),this.onDprChange=this._onDprChange.event,this._onWindowChange=this.register(new r.EventEmitter),this.onWindowChange=this._onWindowChange.event,this.register(this.onWindowChange((e=>this._screenDprMonitor.setWindow(e)))),this.register((0,r.forwardEvent)(this._screenDprMonitor.onDprChange,this._onDprChange)),this._textarea.addEventListener("focus",(()=>this._isFocused=!0)),this._textarea.addEventListener("blur",(()=>this._isFocused=!1))}get window(){return this._window}set window(e){this._window!==e&&(this._window=e,this._onWindowChange.fire(this._window))}get dpr(){return this.window.devicePixelRatio}get isFocused(){return void 0===this._cachedIsFocused&&(this._cachedIsFocused=this._isFocused&&this._textarea.ownerDocument.hasFocus(),queueMicrotask((()=>this._cachedIsFocused=void 0))),this._cachedIsFocused}}t.CoreBrowserService=o;class a extends s.Disposable{constructor(e){super(),this._parentWindow=e,this._windowResizeListener=this.register(new s.MutableDisposable),this._onDprChange=this.register(new r.EventEmitter),this.onDprChange=this._onDprChange.event,this._outerListener=()=>this._setDprAndFireIfDiffers(),this._currentDevicePixelRatio=this._parentWindow.devicePixelRatio,this._updateDpr(),this._setWindowResizeListener(),this.register((0,s.toDisposable)((()=>this.clearListener())))}setWindow(e){this._parentWindow=e,this._setWindowResizeListener(),this._setDprAndFireIfDiffers()}_setWindowResizeListener(){this._windowResizeListener.value=(0,n.addDisposableDomListener)(this._parentWindow,"resize",(()=>this._setDprAndFireIfDiffers()))}_setDprAndFireIfDiffers(){this._parentWindow.devicePixelRatio!==this._currentDevicePixelRatio&&this._onDprChange.fire(this._parentWindow.devicePixelRatio),this._updateDpr()}_updateDpr(){this._outerListener&&(this._resolutionMediaMatchList?.removeListener(this._outerListener),this._currentDevicePixelRatio=this._parentWindow.devicePixelRatio,this._resolutionMediaMatchList=this._parentWindow.matchMedia(`screen and (resolution: ${this._parentWindow.devicePixelRatio}dppx)`),this._resolutionMediaMatchList.addListener(this._outerListener))}clearListener(){this._resolutionMediaMatchList&&this._outerListener&&(this._resolutionMediaMatchList.removeListener(this._outerListener),this._resolutionMediaMatchList=void 0,this._outerListener=void 0)}}},779:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.LinkProviderService=void 0;const s=i(844);class r extends s.Disposable{constructor(){super(),this.linkProviders=[],this.register((0,s.toDisposable)((()=>this.linkProviders.length=0)))}registerLinkProvider(e){return this.linkProviders.push(e),{dispose:()=>{const t=this.linkProviders.indexOf(e);-1!==t&&this.linkProviders.splice(t,1)}}}}t.LinkProviderService=r},8934:function(e,t,i){var s=this&&this.__decorate||function(e,t,i,s){var r,n=arguments.length,o=n<3?t:null===s?s=Object.getOwnPropertyDescriptor(t,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)o=Reflect.decorate(e,t,i,s);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(o=(n<3?r(o):n>3?r(t,i,o):r(t,i))||o);return n>3&&o&&Object.defineProperty(t,i,o),o},r=this&&this.__param||function(e,t){return function(i,s){t(i,s,e)}};Object.defineProperty(t,"__esModule",{value:!0}),t.MouseService=void 0;const n=i(4725),o=i(9806);let a=t.MouseService=class{constructor(e,t){this._renderService=e,this._charSizeService=t}getCoords(e,t,i,s,r){return(0,o.getCoords)(window,e,t,i,s,this._charSizeService.hasValidSize,this._renderService.dimensions.css.cell.width,this._renderService.dimensions.css.cell.height,r)}getMouseReportCoords(e,t){const i=(0,o.getCoordsRelativeToElement)(window,e,t);if(this._charSizeService.hasValidSize)return i[0]=Math.min(Math.max(i[0],0),this._renderService.dimensions.css.canvas.width-1),i[1]=Math.min(Math.max(i[1],0),this._renderService.dimensions.css.canvas.height-1),{col:Math.floor(i[0]/this._renderService.dimensions.css.cell.width),row:Math.floor(i[1]/this._renderService.dimensions.css.cell.height),x:Math.floor(i[0]),y:Math.floor(i[1])}}};t.MouseService=a=s([r(0,n.IRenderService),r(1,n.ICharSizeService)],a)},3230:function(e,t,i){var s=this&&this.__decorate||function(e,t,i,s){var r,n=arguments.length,o=n<3?t:null===s?s=Object.getOwnPropertyDescriptor(t,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)o=Reflect.decorate(e,t,i,s);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(o=(n<3?r(o):n>3?r(t,i,o):r(t,i))||o);return n>3&&o&&Object.defineProperty(t,i,o),o},r=this&&this.__param||function(e,t){return function(i,s){t(i,s,e)}};Object.defineProperty(t,"__esModule",{value:!0}),t.RenderService=void 0;const n=i(6193),o=i(4725),a=i(8460),h=i(844),c=i(7226),l=i(2585);let d=t.RenderService=class extends h.Disposable{get dimensions(){return this._renderer.value.dimensions}constructor(e,t,i,s,r,o,l,d){super(),this._rowCount=e,this._charSizeService=s,this._renderer=this.register(new h.MutableDisposable),this._pausedResizeTask=new c.DebouncedIdleTask,this._observerDisposable=this.register(new h.MutableDisposable),this._isPaused=!1,this._needsFullRefresh=!1,this._isNextRenderRedrawOnly=!0,this._needsSelectionRefresh=!1,this._canvasWidth=0,this._canvasHeight=0,this._selectionState={start:void 0,end:void 0,columnSelectMode:!1},this._onDimensionsChange=this.register(new a.EventEmitter),this.onDimensionsChange=this._onDimensionsChange.event,this._onRenderedViewportChange=this.register(new a.EventEmitter),this.onRenderedViewportChange=this._onRenderedViewportChange.event,this._onRender=this.register(new a.EventEmitter),this.onRender=this._onRender.event,this._onRefreshRequest=this.register(new a.EventEmitter),this.onRefreshRequest=this._onRefreshRequest.event,this._renderDebouncer=new n.RenderDebouncer(((e,t)=>this._renderRows(e,t)),l),this.register(this._renderDebouncer),this.register(l.onDprChange((()=>this.handleDevicePixelRatioChange()))),this.register(o.onResize((()=>this._fullRefresh()))),this.register(o.buffers.onBufferActivate((()=>this._renderer.value?.clear()))),this.register(i.onOptionChange((()=>this._handleOptionsChanged()))),this.register(this._charSizeService.onCharSizeChange((()=>this.handleCharSizeChanged()))),this.register(r.onDecorationRegistered((()=>this._fullRefresh()))),this.register(r.onDecorationRemoved((()=>this._fullRefresh()))),this.register(i.onMultipleOptionChange(["customGlyphs","drawBoldTextInBrightColors","letterSpacing","lineHeight","fontFamily","fontSize","fontWeight","fontWeightBold","minimumContrastRatio","rescaleOverlappingGlyphs"],(()=>{this.clear(),this.handleResize(o.cols,o.rows),this._fullRefresh()}))),this.register(i.onMultipleOptionChange(["cursorBlink","cursorStyle"],(()=>this.refreshRows(o.buffer.y,o.buffer.y,!0)))),this.register(d.onChangeColors((()=>this._fullRefresh()))),this._registerIntersectionObserver(l.window,t),this.register(l.onWindowChange((e=>this._registerIntersectionObserver(e,t))))}_registerIntersectionObserver(e,t){if("IntersectionObserver"in e){const i=new e.IntersectionObserver((e=>this._handleIntersectionChange(e[e.length-1])),{threshold:0});i.observe(t),this._observerDisposable.value=(0,h.toDisposable)((()=>i.disconnect()))}}_handleIntersectionChange(e){this._isPaused=void 0===e.isIntersecting?0===e.intersectionRatio:!e.isIntersecting,this._isPaused||this._charSizeService.hasValidSize||this._charSizeService.measure(),!this._isPaused&&this._needsFullRefresh&&(this._pausedResizeTask.flush(),this.refreshRows(0,this._rowCount-1),this._needsFullRefresh=!1)}refreshRows(e,t,i=!1){this._isPaused?this._needsFullRefresh=!0:(i||(this._isNextRenderRedrawOnly=!1),this._renderDebouncer.refresh(e,t,this._rowCount))}_renderRows(e,t){this._renderer.value&&(e=Math.min(e,this._rowCount-1),t=Math.min(t,this._rowCount-1),this._renderer.value.renderRows(e,t),this._needsSelectionRefresh&&(this._renderer.value.handleSelectionChanged(this._selectionState.start,this._selectionState.end,this._selectionState.columnSelectMode),this._needsSelectionRefresh=!1),this._isNextRenderRedrawOnly||this._onRenderedViewportChange.fire({start:e,end:t}),this._onRender.fire({start:e,end:t}),this._isNextRenderRedrawOnly=!0)}resize(e,t){this._rowCount=t,this._fireOnCanvasResize()}_handleOptionsChanged(){this._renderer.value&&(this.refreshRows(0,this._rowCount-1),this._fireOnCanvasResize())}_fireOnCanvasResize(){this._renderer.value&&(this._renderer.value.dimensions.css.canvas.width===this._canvasWidth&&this._renderer.value.dimensions.css.canvas.height===this._canvasHeight||this._onDimensionsChange.fire(this._renderer.value.dimensions))}hasRenderer(){return!!this._renderer.value}setRenderer(e){this._renderer.value=e,this._renderer.value&&(this._renderer.value.onRequestRedraw((e=>this.refreshRows(e.start,e.end,!0))),this._needsSelectionRefresh=!0,this._fullRefresh())}addRefreshCallback(e){return this._renderDebouncer.addRefreshCallback(e)}_fullRefresh(){this._isPaused?this._needsFullRefresh=!0:this.refreshRows(0,this._rowCount-1)}clearTextureAtlas(){this._renderer.value&&(this._renderer.value.clearTextureAtlas?.(),this._fullRefresh())}handleDevicePixelRatioChange(){this._charSizeService.measure(),this._renderer.value&&(this._renderer.value.handleDevicePixelRatioChange(),this.refreshRows(0,this._rowCount-1))}handleResize(e,t){this._renderer.value&&(this._isPaused?this._pausedResizeTask.set((()=>this._renderer.value?.handleResize(e,t))):this._renderer.value.handleResize(e,t),this._fullRefresh())}handleCharSizeChanged(){this._renderer.value?.handleCharSizeChanged()}handleBlur(){this._renderer.value?.handleBlur()}handleFocus(){this._renderer.value?.handleFocus()}handleSelectionChanged(e,t,i){this._selectionState.start=e,this._selectionState.end=t,this._selectionState.columnSelectMode=i,this._renderer.value?.handleSelectionChanged(e,t,i)}handleCursorMove(){this._renderer.value?.handleCursorMove()}clear(){this._renderer.value?.clear()}};t.RenderService=d=s([r(2,l.IOptionsService),r(3,o.ICharSizeService),r(4,l.IDecorationService),r(5,l.IBufferService),r(6,o.ICoreBrowserService),r(7,o.IThemeService)],d)},9312:function(e,t,i){var s=this&&this.__decorate||function(e,t,i,s){var r,n=arguments.length,o=n<3?t:null===s?s=Object.getOwnPropertyDescriptor(t,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)o=Reflect.decorate(e,t,i,s);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(o=(n<3?r(o):n>3?r(t,i,o):r(t,i))||o);return n>3&&o&&Object.defineProperty(t,i,o),o},r=this&&this.__param||function(e,t){return function(i,s){t(i,s,e)}};Object.defineProperty(t,"__esModule",{value:!0}),t.SelectionService=void 0;const n=i(9806),o=i(9504),a=i(456),h=i(4725),c=i(8460),l=i(844),d=i(6114),_=i(4841),u=i(511),f=i(2585),v=String.fromCharCode(160),p=new RegExp(v,"g");let g=t.SelectionService=class extends l.Disposable{constructor(e,t,i,s,r,n,o,h,d){super(),this._element=e,this._screenElement=t,this._linkifier=i,this._bufferService=s,this._coreService=r,this._mouseService=n,this._optionsService=o,this._renderService=h,this._coreBrowserService=d,this._dragScrollAmount=0,this._enabled=!0,this._workCell=new u.CellData,this._mouseDownTimeStamp=0,this._oldHasSelection=!1,this._oldSelectionStart=void 0,this._oldSelectionEnd=void 0,this._onLinuxMouseSelection=this.register(new c.EventEmitter),this.onLinuxMouseSelection=this._onLinuxMouseSelection.event,this._onRedrawRequest=this.register(new c.EventEmitter),this.onRequestRedraw=this._onRedrawRequest.event,this._onSelectionChange=this.register(new c.EventEmitter),this.onSelectionChange=this._onSelectionChange.event,this._onRequestScrollLines=this.register(new c.EventEmitter),this.onRequestScrollLines=this._onRequestScrollLines.event,this._mouseMoveListener=e=>this._handleMouseMove(e),this._mouseUpListener=e=>this._handleMouseUp(e),this._coreService.onUserInput((()=>{this.hasSelection&&this.clearSelection()})),this._trimListener=this._bufferService.buffer.lines.onTrim((e=>this._handleTrim(e))),this.register(this._bufferService.buffers.onBufferActivate((e=>this._handleBufferActivate(e)))),this.enable(),this._model=new a.SelectionModel(this._bufferService),this._activeSelectionMode=0,this.register((0,l.toDisposable)((()=>{this._removeMouseDownListeners()})))}reset(){this.clearSelection()}disable(){this.clearSelection(),this._enabled=!1}enable(){this._enabled=!0}get selectionStart(){return this._model.finalSelectionStart}get selectionEnd(){return this._model.finalSelectionEnd}get hasSelection(){const e=this._model.finalSelectionStart,t=this._model.finalSelectionEnd;return!(!e||!t||e[0]===t[0]&&e[1]===t[1])}get selectionText(){const e=this._model.finalSelectionStart,t=this._model.finalSelectionEnd;if(!e||!t)return"";const i=this._bufferService.buffer,s=[];if(3===this._activeSelectionMode){if(e[0]===t[0])return"";const r=e[0]<t[0]?e[0]:t[0],n=e[0]<t[0]?t[0]:e[0];for(let o=e[1];o<=t[1];o++){const e=i.translateBufferLineToString(o,!0,r,n);s.push(e)}}else{const r=e[1]===t[1]?t[0]:void 0;s.push(i.translateBufferLineToString(e[1],!0,e[0],r));for(let r=e[1]+1;r<=t[1]-1;r++){const e=i.lines.get(r),t=i.translateBufferLineToString(r,!0);e?.isWrapped?s[s.length-1]+=t:s.push(t)}if(e[1]!==t[1]){const e=i.lines.get(t[1]),r=i.translateBufferLineToString(t[1],!0,0,t[0]);e&&e.isWrapped?s[s.length-1]+=r:s.push(r)}}return s.map((e=>e.replace(p," "))).join(d.isWindows?"\\r\\n":"\\n")}clearSelection(){this._model.clearSelection(),this._removeMouseDownListeners(),this.refresh(),this._onSelectionChange.fire()}refresh(e){this._refreshAnimationFrame||(this._refreshAnimationFrame=this._coreBrowserService.window.requestAnimationFrame((()=>this._refresh()))),d.isLinux&&e&&this.selectionText.length&&this._onLinuxMouseSelection.fire(this.selectionText)}_refresh(){this._refreshAnimationFrame=void 0,this._onRedrawRequest.fire({start:this._model.finalSelectionStart,end:this._model.finalSelectionEnd,columnSelectMode:3===this._activeSelectionMode})}_isClickInSelection(e){const t=this._getMouseBufferCoords(e),i=this._model.finalSelectionStart,s=this._model.finalSelectionEnd;return!!(i&&s&&t)&&this._areCoordsInSelection(t,i,s)}isCellInSelection(e,t){const i=this._model.finalSelectionStart,s=this._model.finalSelectionEnd;return!(!i||!s)&&this._areCoordsInSelection([e,t],i,s)}_areCoordsInSelection(e,t,i){return e[1]>t[1]&&e[1]<i[1]||t[1]===i[1]&&e[1]===t[1]&&e[0]>=t[0]&&e[0]<i[0]||t[1]<i[1]&&e[1]===i[1]&&e[0]<i[0]||t[1]<i[1]&&e[1]===t[1]&&e[0]>=t[0]}_selectWordAtCursor(e,t){const i=this._linkifier.currentLink?.link?.range;if(i)return this._model.selectionStart=[i.start.x-1,i.start.y-1],this._model.selectionStartLength=(0,_.getRangeLength)(i,this._bufferService.cols),this._model.selectionEnd=void 0,!0;const s=this._getMouseBufferCoords(e);return!!s&&(this._selectWordAt(s,t),this._model.selectionEnd=void 0,!0)}selectAll(){this._model.isSelectAllActive=!0,this.refresh(),this._onSelectionChange.fire()}selectLines(e,t){this._model.clearSelection(),e=Math.max(e,0),t=Math.min(t,this._bufferService.buffer.lines.length-1),this._model.selectionStart=[0,e],this._model.selectionEnd=[this._bufferService.cols,t],this.refresh(),this._onSelectionChange.fire()}_handleTrim(e){this._model.handleTrim(e)&&this.refresh()}_getMouseBufferCoords(e){const t=this._mouseService.getCoords(e,this._screenElement,this._bufferService.cols,this._bufferService.rows,!0);if(t)return t[0]--,t[1]--,t[1]+=this._bufferService.buffer.ydisp,t}_getMouseEventScrollAmount(e){let t=(0,n.getCoordsRelativeToElement)(this._coreBrowserService.window,e,this._screenElement)[1];const i=this._renderService.dimensions.css.canvas.height;return t>=0&&t<=i?0:(t>i&&(t-=i),t=Math.min(Math.max(t,-50),50),t/=50,t/Math.abs(t)+Math.round(14*t))}shouldForceSelection(e){return d.isMac?e.altKey&&this._optionsService.rawOptions.macOptionClickForcesSelection:e.shiftKey}handleMouseDown(e){if(this._mouseDownTimeStamp=e.timeStamp,(2!==e.button||!this.hasSelection)&&0===e.button){if(!this._enabled){if(!this.shouldForceSelection(e))return;e.stopPropagation()}e.preventDefault(),this._dragScrollAmount=0,this._enabled&&e.shiftKey?this._handleIncrementalClick(e):1===e.detail?this._handleSingleClick(e):2===e.detail?this._handleDoubleClick(e):3===e.detail&&this._handleTripleClick(e),this._addMouseDownListeners(),this.refresh(!0)}}_addMouseDownListeners(){this._screenElement.ownerDocument&&(this._screenElement.ownerDocument.addEventListener("mousemove",this._mouseMoveListener),this._screenElement.ownerDocument.addEventListener("mouseup",this._mouseUpListener)),this._dragScrollIntervalTimer=this._coreBrowserService.window.setInterval((()=>this._dragScroll()),50)}_removeMouseDownListeners(){this._screenElement.ownerDocument&&(this._screenElement.ownerDocument.removeEventListener("mousemove",this._mouseMoveListener),this._screenElement.ownerDocument.removeEventListener("mouseup",this._mouseUpListener)),this._coreBrowserService.window.clearInterval(this._dragScrollIntervalTimer),this._dragScrollIntervalTimer=void 0}_handleIncrementalClick(e){this._model.selectionStart&&(this._model.selectionEnd=this._getMouseBufferCoords(e))}_handleSingleClick(e){if(this._model.selectionStartLength=0,this._model.isSelectAllActive=!1,this._activeSelectionMode=this.shouldColumnSelect(e)?3:0,this._model.selectionStart=this._getMouseBufferCoords(e),!this._model.selectionStart)return;this._model.selectionEnd=void 0;const t=this._bufferService.buffer.lines.get(this._model.selectionStart[1]);t&&t.length!==this._model.selectionStart[0]&&0===t.hasWidth(this._model.selectionStart[0])&&this._model.selectionStart[0]++}_handleDoubleClick(e){this._selectWordAtCursor(e,!0)&&(this._activeSelectionMode=1)}_handleTripleClick(e){const t=this._getMouseBufferCoords(e);t&&(this._activeSelectionMode=2,this._selectLineAt(t[1]))}shouldColumnSelect(e){return e.altKey&&!(d.isMac&&this._optionsService.rawOptions.macOptionClickForcesSelection)}_handleMouseMove(e){if(e.stopImmediatePropagation(),!this._model.selectionStart)return;const t=this._model.selectionEnd?[this._model.selectionEnd[0],this._model.selectionEnd[1]]:null;if(this._model.selectionEnd=this._getMouseBufferCoords(e),!this._model.selectionEnd)return void this.refresh(!0);2===this._activeSelectionMode?this._model.selectionEnd[1]<this._model.selectionStart[1]?this._model.selectionEnd[0]=0:this._model.selectionEnd[0]=this._bufferService.cols:1===this._activeSelectionMode&&this._selectToWordAt(this._model.selectionEnd),this._dragScrollAmount=this._getMouseEventScrollAmount(e),3!==this._activeSelectionMode&&(this._dragScrollAmount>0?this._model.selectionEnd[0]=this._bufferService.cols:this._dragScrollAmount<0&&(this._model.selectionEnd[0]=0));const i=this._bufferService.buffer;if(this._model.selectionEnd[1]<i.lines.length){const e=i.lines.get(this._model.selectionEnd[1]);e&&0===e.hasWidth(this._model.selectionEnd[0])&&this._model.selectionEnd[0]<this._bufferService.cols&&this._model.selectionEnd[0]++}t&&t[0]===this._model.selectionEnd[0]&&t[1]===this._model.selectionEnd[1]||this.refresh(!0)}_dragScroll(){if(this._model.selectionEnd&&this._model.selectionStart&&this._dragScrollAmount){this._onRequestScrollLines.fire({amount:this._dragScrollAmount,suppressScrollEvent:!1});const e=this._bufferService.buffer;this._dragScrollAmount>0?(3!==this._activeSelectionMode&&(this._model.selectionEnd[0]=this._bufferService.cols),this._model.selectionEnd[1]=Math.min(e.ydisp+this._bufferService.rows,e.lines.length-1)):(3!==this._activeSelectionMode&&(this._model.selectionEnd[0]=0),this._model.selectionEnd[1]=e.ydisp),this.refresh()}}_handleMouseUp(e){const t=e.timeStamp-this._mouseDownTimeStamp;if(this._removeMouseDownListeners(),this.selectionText.length<=1&&t<500&&e.altKey&&this._optionsService.rawOptions.altClickMovesCursor){if(this._bufferService.buffer.ybase===this._bufferService.buffer.ydisp){const t=this._mouseService.getCoords(e,this._element,this._bufferService.cols,this._bufferService.rows,!1);if(t&&void 0!==t[0]&&void 0!==t[1]){const e=(0,o.moveToCellSequence)(t[0]-1,t[1]-1,this._bufferService,this._coreService.decPrivateModes.applicationCursorKeys);this._coreService.triggerDataEvent(e,!0)}}}else this._fireEventIfSelectionChanged()}_fireEventIfSelectionChanged(){const e=this._model.finalSelectionStart,t=this._model.finalSelectionEnd,i=!(!e||!t||e[0]===t[0]&&e[1]===t[1]);i?e&&t&&(this._oldSelectionStart&&this._oldSelectionEnd&&e[0]===this._oldSelectionStart[0]&&e[1]===this._oldSelectionStart[1]&&t[0]===this._oldSelectionEnd[0]&&t[1]===this._oldSelectionEnd[1]||this._fireOnSelectionChange(e,t,i)):this._oldHasSelection&&this._fireOnSelectionChange(e,t,i)}_fireOnSelectionChange(e,t,i){this._oldSelectionStart=e,this._oldSelectionEnd=t,this._oldHasSelection=i,this._onSelectionChange.fire()}_handleBufferActivate(e){this.clearSelection(),this._trimListener.dispose(),this._trimListener=e.activeBuffer.lines.onTrim((e=>this._handleTrim(e)))}_convertViewportColToCharacterIndex(e,t){let i=t;for(let s=0;t>=s;s++){const r=e.loadCell(s,this._workCell).getChars().length;0===this._workCell.getWidth()?i--:r>1&&t!==s&&(i+=r-1)}return i}setSelection(e,t,i){this._model.clearSelection(),this._removeMouseDownListeners(),this._model.selectionStart=[e,t],this._model.selectionStartLength=i,this.refresh(),this._fireEventIfSelectionChanged()}rightClickSelect(e){this._isClickInSelection(e)||(this._selectWordAtCursor(e,!1)&&this.refresh(!0),this._fireEventIfSelectionChanged())}_getWordAt(e,t,i=!0,s=!0){if(e[0]>=this._bufferService.cols)return;const r=this._bufferService.buffer,n=r.lines.get(e[1]);if(!n)return;const o=r.translateBufferLineToString(e[1],!1);let a=this._convertViewportColToCharacterIndex(n,e[0]),h=a;const c=e[0]-a;let l=0,d=0,_=0,u=0;if(" "===o.charAt(a)){for(;a>0&&" "===o.charAt(a-1);)a--;for(;h<o.length&&" "===o.charAt(h+1);)h++}else{let t=e[0],i=e[0];0===n.getWidth(t)&&(l++,t--),2===n.getWidth(i)&&(d++,i++);const s=n.getString(i).length;for(s>1&&(u+=s-1,h+=s-1);t>0&&a>0&&!this._isCharWordSeparator(n.loadCell(t-1,this._workCell));){n.loadCell(t-1,this._workCell);const e=this._workCell.getChars().length;0===this._workCell.getWidth()?(l++,t--):e>1&&(_+=e-1,a-=e-1),a--,t--}for(;i<n.length&&h+1<o.length&&!this._isCharWordSeparator(n.loadCell(i+1,this._workCell));){n.loadCell(i+1,this._workCell);const e=this._workCell.getChars().length;2===this._workCell.getWidth()?(d++,i++):e>1&&(u+=e-1,h+=e-1),h++,i++}}h++;let f=a+c-l+_,v=Math.min(this._bufferService.cols,h-a+l+d-_-u);if(t||""!==o.slice(a,h).trim()){if(i&&0===f&&32!==n.getCodePoint(0)){const t=r.lines.get(e[1]-1);if(t&&n.isWrapped&&32!==t.getCodePoint(this._bufferService.cols-1)){const t=this._getWordAt([this._bufferService.cols-1,e[1]-1],!1,!0,!1);if(t){const e=this._bufferService.cols-t.start;f-=e,v+=e}}}if(s&&f+v===this._bufferService.cols&&32!==n.getCodePoint(this._bufferService.cols-1)){const t=r.lines.get(e[1]+1);if(t?.isWrapped&&32!==t.getCodePoint(0)){const t=this._getWordAt([0,e[1]+1],!1,!1,!0);t&&(v+=t.length)}}return{start:f,length:v}}}_selectWordAt(e,t){const i=this._getWordAt(e,t);if(i){for(;i.start<0;)i.start+=this._bufferService.cols,e[1]--;this._model.selectionStart=[i.start,e[1]],this._model.selectionStartLength=i.length}}_selectToWordAt(e){const t=this._getWordAt(e,!0);if(t){let i=e[1];for(;t.start<0;)t.start+=this._bufferService.cols,i--;if(!this._model.areSelectionValuesReversed())for(;t.start+t.length>this._bufferService.cols;)t.length-=this._bufferService.cols,i++;this._model.selectionEnd=[this._model.areSelectionValuesReversed()?t.start:t.start+t.length,i]}}_isCharWordSeparator(e){return 0!==e.getWidth()&&this._optionsService.rawOptions.wordSeparator.indexOf(e.getChars())>=0}_selectLineAt(e){const t=this._bufferService.buffer.getWrappedRangeForLine(e),i={start:{x:0,y:t.first},end:{x:this._bufferService.cols-1,y:t.last}};this._model.selectionStart=[0,t.first],this._model.selectionEnd=void 0,this._model.selectionStartLength=(0,_.getRangeLength)(i,this._bufferService.cols)}};t.SelectionService=g=s([r(3,f.IBufferService),r(4,f.ICoreService),r(5,h.IMouseService),r(6,f.IOptionsService),r(7,h.IRenderService),r(8,h.ICoreBrowserService)],g)},4725:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.ILinkProviderService=t.IThemeService=t.ICharacterJoinerService=t.ISelectionService=t.IRenderService=t.IMouseService=t.ICoreBrowserService=t.ICharSizeService=void 0;const s=i(8343);t.ICharSizeService=(0,s.createDecorator)("CharSizeService"),t.ICoreBrowserService=(0,s.createDecorator)("CoreBrowserService"),t.IMouseService=(0,s.createDecorator)("MouseService"),t.IRenderService=(0,s.createDecorator)("RenderService"),t.ISelectionService=(0,s.createDecorator)("SelectionService"),t.ICharacterJoinerService=(0,s.createDecorator)("CharacterJoinerService"),t.IThemeService=(0,s.createDecorator)("ThemeService"),t.ILinkProviderService=(0,s.createDecorator)("LinkProviderService")},6731:function(e,t,i){var s=this&&this.__decorate||function(e,t,i,s){var r,n=arguments.length,o=n<3?t:null===s?s=Object.getOwnPropertyDescriptor(t,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)o=Reflect.decorate(e,t,i,s);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(o=(n<3?r(o):n>3?r(t,i,o):r(t,i))||o);return n>3&&o&&Object.defineProperty(t,i,o),o},r=this&&this.__param||function(e,t){return function(i,s){t(i,s,e)}};Object.defineProperty(t,"__esModule",{value:!0}),t.ThemeService=t.DEFAULT_ANSI_COLORS=void 0;const n=i(7239),o=i(8055),a=i(8460),h=i(844),c=i(2585),l=o.css.toColor("#ffffff"),d=o.css.toColor("#000000"),_=o.css.toColor("#ffffff"),u=o.css.toColor("#000000"),f={css:"rgba(255, 255, 255, 0.3)",rgba:4294967117};t.DEFAULT_ANSI_COLORS=Object.freeze((()=>{const e=[o.css.toColor("#2e3436"),o.css.toColor("#cc0000"),o.css.toColor("#4e9a06"),o.css.toColor("#c4a000"),o.css.toColor("#3465a4"),o.css.toColor("#75507b"),o.css.toColor("#06989a"),o.css.toColor("#d3d7cf"),o.css.toColor("#555753"),o.css.toColor("#ef2929"),o.css.toColor("#8ae234"),o.css.toColor("#fce94f"),o.css.toColor("#729fcf"),o.css.toColor("#ad7fa8"),o.css.toColor("#34e2e2"),o.css.toColor("#eeeeec")],t=[0,95,135,175,215,255];for(let i=0;i<216;i++){const s=t[i/36%6|0],r=t[i/6%6|0],n=t[i%6];e.push({css:o.channels.toCss(s,r,n),rgba:o.channels.toRgba(s,r,n)})}for(let t=0;t<24;t++){const i=8+10*t;e.push({css:o.channels.toCss(i,i,i),rgba:o.channels.toRgba(i,i,i)})}return e})());let v=t.ThemeService=class extends h.Disposable{get colors(){return this._colors}constructor(e){super(),this._optionsService=e,this._contrastCache=new n.ColorContrastCache,this._halfContrastCache=new n.ColorContrastCache,this._onChangeColors=this.register(new a.EventEmitter),this.onChangeColors=this._onChangeColors.event,this._colors={foreground:l,background:d,cursor:_,cursorAccent:u,selectionForeground:void 0,selectionBackgroundTransparent:f,selectionBackgroundOpaque:o.color.blend(d,f),selectionInactiveBackgroundTransparent:f,selectionInactiveBackgroundOpaque:o.color.blend(d,f),ansi:t.DEFAULT_ANSI_COLORS.slice(),contrastCache:this._contrastCache,halfContrastCache:this._halfContrastCache},this._updateRestoreColors(),this._setTheme(this._optionsService.rawOptions.theme),this.register(this._optionsService.onSpecificOptionChange("minimumContrastRatio",(()=>this._contrastCache.clear()))),this.register(this._optionsService.onSpecificOptionChange("theme",(()=>this._setTheme(this._optionsService.rawOptions.theme))))}_setTheme(e={}){const i=this._colors;if(i.foreground=p(e.foreground,l),i.background=p(e.background,d),i.cursor=p(e.cursor,_),i.cursorAccent=p(e.cursorAccent,u),i.selectionBackgroundTransparent=p(e.selectionBackground,f),i.selectionBackgroundOpaque=o.color.blend(i.background,i.selectionBackgroundTransparent),i.selectionInactiveBackgroundTransparent=p(e.selectionInactiveBackground,i.selectionBackgroundTransparent),i.selectionInactiveBackgroundOpaque=o.color.blend(i.background,i.selectionInactiveBackgroundTransparent),i.selectionForeground=e.selectionForeground?p(e.selectionForeground,o.NULL_COLOR):void 0,i.selectionForeground===o.NULL_COLOR&&(i.selectionForeground=void 0),o.color.isOpaque(i.selectionBackgroundTransparent)){const e=.3;i.selectionBackgroundTransparent=o.color.opacity(i.selectionBackgroundTransparent,e)}if(o.color.isOpaque(i.selectionInactiveBackgroundTransparent)){const e=.3;i.selectionInactiveBackgroundTransparent=o.color.opacity(i.selectionInactiveBackgroundTransparent,e)}if(i.ansi=t.DEFAULT_ANSI_COLORS.slice(),i.ansi[0]=p(e.black,t.DEFAULT_ANSI_COLORS[0]),i.ansi[1]=p(e.red,t.DEFAULT_ANSI_COLORS[1]),i.ansi[2]=p(e.green,t.DEFAULT_ANSI_COLORS[2]),i.ansi[3]=p(e.yellow,t.DEFAULT_ANSI_COLORS[3]),i.ansi[4]=p(e.blue,t.DEFAULT_ANSI_COLORS[4]),i.ansi[5]=p(e.magenta,t.DEFAULT_ANSI_COLORS[5]),i.ansi[6]=p(e.cyan,t.DEFAULT_ANSI_COLORS[6]),i.ansi[7]=p(e.white,t.DEFAULT_ANSI_COLORS[7]),i.ansi[8]=p(e.brightBlack,t.DEFAULT_ANSI_COLORS[8]),i.ansi[9]=p(e.brightRed,t.DEFAULT_ANSI_COLORS[9]),i.ansi[10]=p(e.brightGreen,t.DEFAULT_ANSI_COLORS[10]),i.ansi[11]=p(e.brightYellow,t.DEFAULT_ANSI_COLORS[11]),i.ansi[12]=p(e.brightBlue,t.DEFAULT_ANSI_COLORS[12]),i.ansi[13]=p(e.brightMagenta,t.DEFAULT_ANSI_COLORS[13]),i.ansi[14]=p(e.brightCyan,t.DEFAULT_ANSI_COLORS[14]),i.ansi[15]=p(e.brightWhite,t.DEFAULT_ANSI_COLORS[15]),e.extendedAnsi){const s=Math.min(i.ansi.length-16,e.extendedAnsi.length);for(let r=0;r<s;r++)i.ansi[r+16]=p(e.extendedAnsi[r],t.DEFAULT_ANSI_COLORS[r+16])}this._contrastCache.clear(),this._halfContrastCache.clear(),this._updateRestoreColors(),this._onChangeColors.fire(this.colors)}restoreColor(e){this._restoreColor(e),this._onChangeColors.fire(this.colors)}_restoreColor(e){if(void 0!==e)switch(e){case 256:this._colors.foreground=this._restoreColors.foreground;break;case 257:this._colors.background=this._restoreColors.background;break;case 258:this._colors.cursor=this._restoreColors.cursor;break;default:this._colors.ansi[e]=this._restoreColors.ansi[e]}else for(let e=0;e<this._restoreColors.ansi.length;++e)this._colors.ansi[e]=this._restoreColors.ansi[e]}modifyColors(e){e(this._colors),this._onChangeColors.fire(this.colors)}_updateRestoreColors(){this._restoreColors={foreground:this._colors.foreground,background:this._colors.background,cursor:this._colors.cursor,ansi:this._colors.ansi.slice()}}};function p(e,t){if(void 0!==e)try{return o.css.toColor(e)}catch{}return t}t.ThemeService=v=s([r(0,c.IOptionsService)],v)},6349:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.CircularList=void 0;const s=i(8460),r=i(844);class n extends r.Disposable{constructor(e){super(),this._maxLength=e,this.onDeleteEmitter=this.register(new s.EventEmitter),this.onDelete=this.onDeleteEmitter.event,this.onInsertEmitter=this.register(new s.EventEmitter),this.onInsert=this.onInsertEmitter.event,this.onTrimEmitter=this.register(new s.EventEmitter),this.onTrim=this.onTrimEmitter.event,this._array=new Array(this._maxLength),this._startIndex=0,this._length=0}get maxLength(){return this._maxLength}set maxLength(e){if(this._maxLength===e)return;const t=new Array(e);for(let i=0;i<Math.min(e,this.length);i++)t[i]=this._array[this._getCyclicIndex(i)];this._array=t,this._maxLength=e,this._startIndex=0}get length(){return this._length}set length(e){if(e>this._length)for(let t=this._length;t<e;t++)this._array[t]=void 0;this._length=e}get(e){return this._array[this._getCyclicIndex(e)]}set(e,t){this._array[this._getCyclicIndex(e)]=t}push(e){this._array[this._getCyclicIndex(this._length)]=e,this._length===this._maxLength?(this._startIndex=++this._startIndex%this._maxLength,this.onTrimEmitter.fire(1)):this._length++}recycle(){if(this._length!==this._maxLength)throw new Error("Can only recycle when the buffer is full");return this._startIndex=++this._startIndex%this._maxLength,this.onTrimEmitter.fire(1),this._array[this._getCyclicIndex(this._length-1)]}get isFull(){return this._length===this._maxLength}pop(){return this._array[this._getCyclicIndex(this._length---1)]}splice(e,t,...i){if(t){for(let i=e;i<this._length-t;i++)this._array[this._getCyclicIndex(i)]=this._array[this._getCyclicIndex(i+t)];this._length-=t,this.onDeleteEmitter.fire({index:e,amount:t})}for(let t=this._length-1;t>=e;t--)this._array[this._getCyclicIndex(t+i.length)]=this._array[this._getCyclicIndex(t)];for(let t=0;t<i.length;t++)this._array[this._getCyclicIndex(e+t)]=i[t];if(i.length&&this.onInsertEmitter.fire({index:e,amount:i.length}),this._length+i.length>this._maxLength){const e=this._length+i.length-this._maxLength;this._startIndex+=e,this._length=this._maxLength,this.onTrimEmitter.fire(e)}else this._length+=i.length}trimStart(e){e>this._length&&(e=this._length),this._startIndex+=e,this._length-=e,this.onTrimEmitter.fire(e)}shiftElements(e,t,i){if(!(t<=0)){if(e<0||e>=this._length)throw new Error("start argument out of range");if(e+i<0)throw new Error("Cannot shift elements in list beyond index 0");if(i>0){for(let s=t-1;s>=0;s--)this.set(e+s+i,this.get(e+s));const s=e+t+i-this._length;if(s>0)for(this._length+=s;this._length>this._maxLength;)this._length--,this._startIndex++,this.onTrimEmitter.fire(1)}else for(let s=0;s<t;s++)this.set(e+s+i,this.get(e+s))}}_getCyclicIndex(e){return(this._startIndex+e)%this._maxLength}}t.CircularList=n},1439:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.clone=void 0,t.clone=function e(t,i=5){if("object"!=typeof t)return t;const s=Array.isArray(t)?[]:{};for(const r in t)s[r]=i<=1?t[r]:t[r]&&e(t[r],i-1);return s}},8055:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.contrastRatio=t.toPaddedHex=t.rgba=t.rgb=t.css=t.color=t.channels=t.NULL_COLOR=void 0;let i=0,s=0,r=0,n=0;var o,a,h,c,l;function d(e){const t=e.toString(16);return t.length<2?"0"+t:t}function _(e,t){return e<t?(t+.05)/(e+.05):(e+.05)/(t+.05)}t.NULL_COLOR={css:"#00000000",rgba:0},function(e){e.toCss=function(e,t,i,s){return void 0!==s?`#${d(e)}${d(t)}${d(i)}${d(s)}`:`#${d(e)}${d(t)}${d(i)}`},e.toRgba=function(e,t,i,s=255){return(e<<24|t<<16|i<<8|s)>>>0},e.toColor=function(t,i,s,r){return{css:e.toCss(t,i,s,r),rgba:e.toRgba(t,i,s,r)}}}(o||(t.channels=o={})),function(e){function t(e,t){return n=Math.round(255*t),[i,s,r]=l.toChannels(e.rgba),{css:o.toCss(i,s,r,n),rgba:o.toRgba(i,s,r,n)}}e.blend=function(e,t){if(n=(255&t.rgba)/255,1===n)return{css:t.css,rgba:t.rgba};const a=t.rgba>>24&255,h=t.rgba>>16&255,c=t.rgba>>8&255,l=e.rgba>>24&255,d=e.rgba>>16&255,_=e.rgba>>8&255;return i=l+Math.round((a-l)*n),s=d+Math.round((h-d)*n),r=_+Math.round((c-_)*n),{css:o.toCss(i,s,r),rgba:o.toRgba(i,s,r)}},e.isOpaque=function(e){return 255==(255&e.rgba)},e.ensureContrastRatio=function(e,t,i){const s=l.ensureContrastRatio(e.rgba,t.rgba,i);if(s)return o.toColor(s>>24&255,s>>16&255,s>>8&255)},e.opaque=function(e){const t=(255|e.rgba)>>>0;return[i,s,r]=l.toChannels(t),{css:o.toCss(i,s,r),rgba:t}},e.opacity=t,e.multiplyOpacity=function(e,i){return n=255&e.rgba,t(e,n*i/255)},e.toColorRGB=function(e){return[e.rgba>>24&255,e.rgba>>16&255,e.rgba>>8&255]}}(a||(t.color=a={})),function(e){let t,a;try{const e=document.createElement("canvas");e.width=1,e.height=1;const i=e.getContext("2d",{willReadFrequently:!0});i&&(t=i,t.globalCompositeOperation="copy",a=t.createLinearGradient(0,0,1,1))}catch{}e.toColor=function(e){if(e.match(/#[\\da-f]{3,8}/i))switch(e.length){case 4:return i=parseInt(e.slice(1,2).repeat(2),16),s=parseInt(e.slice(2,3).repeat(2),16),r=parseInt(e.slice(3,4).repeat(2),16),o.toColor(i,s,r);case 5:return i=parseInt(e.slice(1,2).repeat(2),16),s=parseInt(e.slice(2,3).repeat(2),16),r=parseInt(e.slice(3,4).repeat(2),16),n=parseInt(e.slice(4,5).repeat(2),16),o.toColor(i,s,r,n);case 7:return{css:e,rgba:(parseInt(e.slice(1),16)<<8|255)>>>0};case 9:return{css:e,rgba:parseInt(e.slice(1),16)>>>0}}const h=e.match(/rgba?\\(\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})\\s*(,\\s*(0|1|\\d?\\.(\\d+))\\s*)?\\)/);if(h)return i=parseInt(h[1]),s=parseInt(h[2]),r=parseInt(h[3]),n=Math.round(255*(void 0===h[5]?1:parseFloat(h[5]))),o.toColor(i,s,r,n);if(!t||!a)throw new Error("css.toColor: Unsupported css format");if(t.fillStyle=a,t.fillStyle=e,"string"!=typeof t.fillStyle)throw new Error("css.toColor: Unsupported css format");if(t.fillRect(0,0,1,1),[i,s,r,n]=t.getImageData(0,0,1,1).data,255!==n)throw new Error("css.toColor: Unsupported css format");return{rgba:o.toRgba(i,s,r,n),css:e}}}(h||(t.css=h={})),function(e){function t(e,t,i){const s=e/255,r=t/255,n=i/255;return.2126*(s<=.03928?s/12.92:Math.pow((s+.055)/1.055,2.4))+.7152*(r<=.03928?r/12.92:Math.pow((r+.055)/1.055,2.4))+.0722*(n<=.03928?n/12.92:Math.pow((n+.055)/1.055,2.4))}e.relativeLuminance=function(e){return t(e>>16&255,e>>8&255,255&e)},e.relativeLuminance2=t}(c||(t.rgb=c={})),function(e){function t(e,t,i){const s=e>>24&255,r=e>>16&255,n=e>>8&255;let o=t>>24&255,a=t>>16&255,h=t>>8&255,l=_(c.relativeLuminance2(o,a,h),c.relativeLuminance2(s,r,n));for(;l<i&&(o>0||a>0||h>0);)o-=Math.max(0,Math.ceil(.1*o)),a-=Math.max(0,Math.ceil(.1*a)),h-=Math.max(0,Math.ceil(.1*h)),l=_(c.relativeLuminance2(o,a,h),c.relativeLuminance2(s,r,n));return(o<<24|a<<16|h<<8|255)>>>0}function a(e,t,i){const s=e>>24&255,r=e>>16&255,n=e>>8&255;let o=t>>24&255,a=t>>16&255,h=t>>8&255,l=_(c.relativeLuminance2(o,a,h),c.relativeLuminance2(s,r,n));for(;l<i&&(o<255||a<255||h<255);)o=Math.min(255,o+Math.ceil(.1*(255-o))),a=Math.min(255,a+Math.ceil(.1*(255-a))),h=Math.min(255,h+Math.ceil(.1*(255-h))),l=_(c.relativeLuminance2(o,a,h),c.relativeLuminance2(s,r,n));return(o<<24|a<<16|h<<8|255)>>>0}e.blend=function(e,t){if(n=(255&t)/255,1===n)return t;const a=t>>24&255,h=t>>16&255,c=t>>8&255,l=e>>24&255,d=e>>16&255,_=e>>8&255;return i=l+Math.round((a-l)*n),s=d+Math.round((h-d)*n),r=_+Math.round((c-_)*n),o.toRgba(i,s,r)},e.ensureContrastRatio=function(e,i,s){const r=c.relativeLuminance(e>>8),n=c.relativeLuminance(i>>8);if(_(r,n)<s){if(n<r){const n=t(e,i,s),o=_(r,c.relativeLuminance(n>>8));if(o<s){const t=a(e,i,s);return o>_(r,c.relativeLuminance(t>>8))?n:t}return n}const o=a(e,i,s),h=_(r,c.relativeLuminance(o>>8));if(h<s){const n=t(e,i,s);return h>_(r,c.relativeLuminance(n>>8))?o:n}return o}},e.reduceLuminance=t,e.increaseLuminance=a,e.toChannels=function(e){return[e>>24&255,e>>16&255,e>>8&255,255&e]}}(l||(t.rgba=l={})),t.toPaddedHex=d,t.contrastRatio=_},8969:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.CoreTerminal=void 0;const s=i(844),r=i(2585),n=i(4348),o=i(7866),a=i(744),h=i(7302),c=i(6975),l=i(8460),d=i(1753),_=i(1480),u=i(7994),f=i(9282),v=i(5435),p=i(5981),g=i(2660);let m=!1;class S extends s.Disposable{get onScroll(){return this._onScrollApi||(this._onScrollApi=this.register(new l.EventEmitter),this._onScroll.event((e=>{this._onScrollApi?.fire(e.position)}))),this._onScrollApi.event}get cols(){return this._bufferService.cols}get rows(){return this._bufferService.rows}get buffers(){return this._bufferService.buffers}get options(){return this.optionsService.options}set options(e){for(const t in e)this.optionsService.options[t]=e[t]}constructor(e){super(),this._windowsWrappingHeuristics=this.register(new s.MutableDisposable),this._onBinary=this.register(new l.EventEmitter),this.onBinary=this._onBinary.event,this._onData=this.register(new l.EventEmitter),this.onData=this._onData.event,this._onLineFeed=this.register(new l.EventEmitter),this.onLineFeed=this._onLineFeed.event,this._onResize=this.register(new l.EventEmitter),this.onResize=this._onResize.event,this._onWriteParsed=this.register(new l.EventEmitter),this.onWriteParsed=this._onWriteParsed.event,this._onScroll=this.register(new l.EventEmitter),this._instantiationService=new n.InstantiationService,this.optionsService=this.register(new h.OptionsService(e)),this._instantiationService.setService(r.IOptionsService,this.optionsService),this._bufferService=this.register(this._instantiationService.createInstance(a.BufferService)),this._instantiationService.setService(r.IBufferService,this._bufferService),this._logService=this.register(this._instantiationService.createInstance(o.LogService)),this._instantiationService.setService(r.ILogService,this._logService),this.coreService=this.register(this._instantiationService.createInstance(c.CoreService)),this._instantiationService.setService(r.ICoreService,this.coreService),this.coreMouseService=this.register(this._instantiationService.createInstance(d.CoreMouseService)),this._instantiationService.setService(r.ICoreMouseService,this.coreMouseService),this.unicodeService=this.register(this._instantiationService.createInstance(_.UnicodeService)),this._instantiationService.setService(r.IUnicodeService,this.unicodeService),this._charsetService=this._instantiationService.createInstance(u.CharsetService),this._instantiationService.setService(r.ICharsetService,this._charsetService),this._oscLinkService=this._instantiationService.createInstance(g.OscLinkService),this._instantiationService.setService(r.IOscLinkService,this._oscLinkService),this._inputHandler=this.register(new v.InputHandler(this._bufferService,this._charsetService,this.coreService,this._logService,this.optionsService,this._oscLinkService,this.coreMouseService,this.unicodeService)),this.register((0,l.forwardEvent)(this._inputHandler.onLineFeed,this._onLineFeed)),this.register(this._inputHandler),this.register((0,l.forwardEvent)(this._bufferService.onResize,this._onResize)),this.register((0,l.forwardEvent)(this.coreService.onData,this._onData)),this.register((0,l.forwardEvent)(this.coreService.onBinary,this._onBinary)),this.register(this.coreService.onRequestScrollToBottom((()=>this.scrollToBottom()))),this.register(this.coreService.onUserInput((()=>this._writeBuffer.handleUserInput()))),this.register(this.optionsService.onMultipleOptionChange(["windowsMode","windowsPty"],(()=>this._handleWindowsPtyOptionChange()))),this.register(this._bufferService.onScroll((e=>{this._onScroll.fire({position:this._bufferService.buffer.ydisp,source:0}),this._inputHandler.markRangeDirty(this._bufferService.buffer.scrollTop,this._bufferService.buffer.scrollBottom)}))),this.register(this._inputHandler.onScroll((e=>{this._onScroll.fire({position:this._bufferService.buffer.ydisp,source:0}),this._inputHandler.markRangeDirty(this._bufferService.buffer.scrollTop,this._bufferService.buffer.scrollBottom)}))),this._writeBuffer=this.register(new p.WriteBuffer(((e,t)=>this._inputHandler.parse(e,t)))),this.register((0,l.forwardEvent)(this._writeBuffer.onWriteParsed,this._onWriteParsed))}write(e,t){this._writeBuffer.write(e,t)}writeSync(e,t){this._logService.logLevel<=r.LogLevelEnum.WARN&&!m&&(this._logService.warn("writeSync is unreliable and will be removed soon."),m=!0),this._writeBuffer.writeSync(e,t)}input(e,t=!0){this.coreService.triggerDataEvent(e,t)}resize(e,t){isNaN(e)||isNaN(t)||(e=Math.max(e,a.MINIMUM_COLS),t=Math.max(t,a.MINIMUM_ROWS),this._bufferService.resize(e,t))}scroll(e,t=!1){this._bufferService.scroll(e,t)}scrollLines(e,t,i){this._bufferService.scrollLines(e,t,i)}scrollPages(e){this.scrollLines(e*(this.rows-1))}scrollToTop(){this.scrollLines(-this._bufferService.buffer.ydisp)}scrollToBottom(){this.scrollLines(this._bufferService.buffer.ybase-this._bufferService.buffer.ydisp)}scrollToLine(e){const t=e-this._bufferService.buffer.ydisp;0!==t&&this.scrollLines(t)}registerEscHandler(e,t){return this._inputHandler.registerEscHandler(e,t)}registerDcsHandler(e,t){return this._inputHandler.registerDcsHandler(e,t)}registerCsiHandler(e,t){return this._inputHandler.registerCsiHandler(e,t)}registerOscHandler(e,t){return this._inputHandler.registerOscHandler(e,t)}_setup(){this._handleWindowsPtyOptionChange()}reset(){this._inputHandler.reset(),this._bufferService.reset(),this._charsetService.reset(),this.coreService.reset(),this.coreMouseService.reset()}_handleWindowsPtyOptionChange(){let e=!1;const t=this.optionsService.rawOptions.windowsPty;t&&void 0!==t.buildNumber&&void 0!==t.buildNumber?e=!!("conpty"===t.backend&&t.buildNumber<21376):this.optionsService.rawOptions.windowsMode&&(e=!0),e?this._enableWindowsWrappingHeuristics():this._windowsWrappingHeuristics.clear()}_enableWindowsWrappingHeuristics(){if(!this._windowsWrappingHeuristics.value){const e=[];e.push(this.onLineFeed(f.updateWindowsModeWrappedState.bind(null,this._bufferService))),e.push(this.registerCsiHandler({final:"H"},(()=>((0,f.updateWindowsModeWrappedState)(this._bufferService),!1)))),this._windowsWrappingHeuristics.value=(0,s.toDisposable)((()=>{for(const t of e)t.dispose()}))}}}t.CoreTerminal=S},8460:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.runAndSubscribe=t.forwardEvent=t.EventEmitter=void 0,t.EventEmitter=class{constructor(){this._listeners=[],this._disposed=!1}get event(){return this._event||(this._event=e=>(this._listeners.push(e),{dispose:()=>{if(!this._disposed)for(let t=0;t<this._listeners.length;t++)if(this._listeners[t]===e)return void this._listeners.splice(t,1)}})),this._event}fire(e,t){const i=[];for(let e=0;e<this._listeners.length;e++)i.push(this._listeners[e]);for(let s=0;s<i.length;s++)i[s].call(void 0,e,t)}dispose(){this.clearListeners(),this._disposed=!0}clearListeners(){this._listeners&&(this._listeners.length=0)}},t.forwardEvent=function(e,t){return e((e=>t.fire(e)))},t.runAndSubscribe=function(e,t){return t(void 0),e((e=>t(e)))}},5435:function(e,t,i){var s=this&&this.__decorate||function(e,t,i,s){var r,n=arguments.length,o=n<3?t:null===s?s=Object.getOwnPropertyDescriptor(t,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)o=Reflect.decorate(e,t,i,s);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(o=(n<3?r(o):n>3?r(t,i,o):r(t,i))||o);return n>3&&o&&Object.defineProperty(t,i,o),o},r=this&&this.__param||function(e,t){return function(i,s){t(i,s,e)}};Object.defineProperty(t,"__esModule",{value:!0}),t.InputHandler=t.WindowsOptionsReportType=void 0;const n=i(2584),o=i(7116),a=i(2015),h=i(844),c=i(482),l=i(8437),d=i(8460),_=i(643),u=i(511),f=i(3734),v=i(2585),p=i(1480),g=i(6242),m=i(6351),S=i(5941),C={"(":0,")":1,"*":2,"+":3,"-":1,".":2},b=131072;function w(e,t){if(e>24)return t.setWinLines||!1;switch(e){case 1:return!!t.restoreWin;case 2:return!!t.minimizeWin;case 3:return!!t.setWinPosition;case 4:return!!t.setWinSizePixels;case 5:return!!t.raiseWin;case 6:return!!t.lowerWin;case 7:return!!t.refreshWin;case 8:return!!t.setWinSizeChars;case 9:return!!t.maximizeWin;case 10:return!!t.fullscreenWin;case 11:return!!t.getWinState;case 13:return!!t.getWinPosition;case 14:return!!t.getWinSizePixels;case 15:return!!t.getScreenSizePixels;case 16:return!!t.getCellSizePixels;case 18:return!!t.getWinSizeChars;case 19:return!!t.getScreenSizeChars;case 20:return!!t.getIconTitle;case 21:return!!t.getWinTitle;case 22:return!!t.pushTitle;case 23:return!!t.popTitle;case 24:return!!t.setWinLines}return!1}var y;!function(e){e[e.GET_WIN_SIZE_PIXELS=0]="GET_WIN_SIZE_PIXELS",e[e.GET_CELL_SIZE_PIXELS=1]="GET_CELL_SIZE_PIXELS"}(y||(t.WindowsOptionsReportType=y={}));let E=0;class k extends h.Disposable{getAttrData(){return this._curAttrData}constructor(e,t,i,s,r,h,_,f,v=new a.EscapeSequenceParser){super(),this._bufferService=e,this._charsetService=t,this._coreService=i,this._logService=s,this._optionsService=r,this._oscLinkService=h,this._coreMouseService=_,this._unicodeService=f,this._parser=v,this._parseBuffer=new Uint32Array(4096),this._stringDecoder=new c.StringToUtf32,this._utf8Decoder=new c.Utf8ToUtf32,this._workCell=new u.CellData,this._windowTitle="",this._iconName="",this._windowTitleStack=[],this._iconNameStack=[],this._curAttrData=l.DEFAULT_ATTR_DATA.clone(),this._eraseAttrDataInternal=l.DEFAULT_ATTR_DATA.clone(),this._onRequestBell=this.register(new d.EventEmitter),this.onRequestBell=this._onRequestBell.event,this._onRequestRefreshRows=this.register(new d.EventEmitter),this.onRequestRefreshRows=this._onRequestRefreshRows.event,this._onRequestReset=this.register(new d.EventEmitter),this.onRequestReset=this._onRequestReset.event,this._onRequestSendFocus=this.register(new d.EventEmitter),this.onRequestSendFocus=this._onRequestSendFocus.event,this._onRequestSyncScrollBar=this.register(new d.EventEmitter),this.onRequestSyncScrollBar=this._onRequestSyncScrollBar.event,this._onRequestWindowsOptionsReport=this.register(new d.EventEmitter),this.onRequestWindowsOptionsReport=this._onRequestWindowsOptionsReport.event,this._onA11yChar=this.register(new d.EventEmitter),this.onA11yChar=this._onA11yChar.event,this._onA11yTab=this.register(new d.EventEmitter),this.onA11yTab=this._onA11yTab.event,this._onCursorMove=this.register(new d.EventEmitter),this.onCursorMove=this._onCursorMove.event,this._onLineFeed=this.register(new d.EventEmitter),this.onLineFeed=this._onLineFeed.event,this._onScroll=this.register(new d.EventEmitter),this.onScroll=this._onScroll.event,this._onTitleChange=this.register(new d.EventEmitter),this.onTitleChange=this._onTitleChange.event,this._onColor=this.register(new d.EventEmitter),this.onColor=this._onColor.event,this._parseStack={paused:!1,cursorStartX:0,cursorStartY:0,decodedLength:0,position:0},this._specialColors=[256,257,258],this.register(this._parser),this._dirtyRowTracker=new L(this._bufferService),this._activeBuffer=this._bufferService.buffer,this.register(this._bufferService.buffers.onBufferActivate((e=>this._activeBuffer=e.activeBuffer))),this._parser.setCsiHandlerFallback(((e,t)=>{this._logService.debug("Unknown CSI code: ",{identifier:this._parser.identToString(e),params:t.toArray()})})),this._parser.setEscHandlerFallback((e=>{this._logService.debug("Unknown ESC code: ",{identifier:this._parser.identToString(e)})})),this._parser.setExecuteHandlerFallback((e=>{this._logService.debug("Unknown EXECUTE code: ",{code:e})})),this._parser.setOscHandlerFallback(((e,t,i)=>{this._logService.debug("Unknown OSC code: ",{identifier:e,action:t,data:i})})),this._parser.setDcsHandlerFallback(((e,t,i)=>{"HOOK"===t&&(i=i.toArray()),this._logService.debug("Unknown DCS code: ",{identifier:this._parser.identToString(e),action:t,payload:i})})),this._parser.setPrintHandler(((e,t,i)=>this.print(e,t,i))),this._parser.registerCsiHandler({final:"@"},(e=>this.insertChars(e))),this._parser.registerCsiHandler({intermediates:" ",final:"@"},(e=>this.scrollLeft(e))),this._parser.registerCsiHandler({final:"A"},(e=>this.cursorUp(e))),this._parser.registerCsiHandler({intermediates:" ",final:"A"},(e=>this.scrollRight(e))),this._parser.registerCsiHandler({final:"B"},(e=>this.cursorDown(e))),this._parser.registerCsiHandler({final:"C"},(e=>this.cursorForward(e))),this._parser.registerCsiHandler({final:"D"},(e=>this.cursorBackward(e))),this._parser.registerCsiHandler({final:"E"},(e=>this.cursorNextLine(e))),this._parser.registerCsiHandler({final:"F"},(e=>this.cursorPrecedingLine(e))),this._parser.registerCsiHandler({final:"G"},(e=>this.cursorCharAbsolute(e))),this._parser.registerCsiHandler({final:"H"},(e=>this.cursorPosition(e))),this._parser.registerCsiHandler({final:"I"},(e=>this.cursorForwardTab(e))),this._parser.registerCsiHandler({final:"J"},(e=>this.eraseInDisplay(e,!1))),this._parser.registerCsiHandler({prefix:"?",final:"J"},(e=>this.eraseInDisplay(e,!0))),this._parser.registerCsiHandler({final:"K"},(e=>this.eraseInLine(e,!1))),this._parser.registerCsiHandler({prefix:"?",final:"K"},(e=>this.eraseInLine(e,!0))),this._parser.registerCsiHandler({final:"L"},(e=>this.insertLines(e))),this._parser.registerCsiHandler({final:"M"},(e=>this.deleteLines(e))),this._parser.registerCsiHandler({final:"P"},(e=>this.deleteChars(e))),this._parser.registerCsiHandler({final:"S"},(e=>this.scrollUp(e))),this._parser.registerCsiHandler({final:"T"},(e=>this.scrollDown(e))),this._parser.registerCsiHandler({final:"X"},(e=>this.eraseChars(e))),this._parser.registerCsiHandler({final:"Z"},(e=>this.cursorBackwardTab(e))),this._parser.registerCsiHandler({final:"`"},(e=>this.charPosAbsolute(e))),this._parser.registerCsiHandler({final:"a"},(e=>this.hPositionRelative(e))),this._parser.registerCsiHandler({final:"b"},(e=>this.repeatPrecedingCharacter(e))),this._parser.registerCsiHandler({final:"c"},(e=>this.sendDeviceAttributesPrimary(e))),this._parser.registerCsiHandler({prefix:">",final:"c"},(e=>this.sendDeviceAttributesSecondary(e))),this._parser.registerCsiHandler({final:"d"},(e=>this.linePosAbsolute(e))),this._parser.registerCsiHandler({final:"e"},(e=>this.vPositionRelative(e))),this._parser.registerCsiHandler({final:"f"},(e=>this.hVPosition(e))),this._parser.registerCsiHandler({final:"g"},(e=>this.tabClear(e))),this._parser.registerCsiHandler({final:"h"},(e=>this.setMode(e))),this._parser.registerCsiHandler({prefix:"?",final:"h"},(e=>this.setModePrivate(e))),this._parser.registerCsiHandler({final:"l"},(e=>this.resetMode(e))),this._parser.registerCsiHandler({prefix:"?",final:"l"},(e=>this.resetModePrivate(e))),this._parser.registerCsiHandler({final:"m"},(e=>this.charAttributes(e))),this._parser.registerCsiHandler({final:"n"},(e=>this.deviceStatus(e))),this._parser.registerCsiHandler({prefix:"?",final:"n"},(e=>this.deviceStatusPrivate(e))),this._parser.registerCsiHandler({intermediates:"!",final:"p"},(e=>this.softReset(e))),this._parser.registerCsiHandler({intermediates:" ",final:"q"},(e=>this.setCursorStyle(e))),this._parser.registerCsiHandler({final:"r"},(e=>this.setScrollRegion(e))),this._parser.registerCsiHandler({final:"s"},(e=>this.saveCursor(e))),this._parser.registerCsiHandler({final:"t"},(e=>this.windowOptions(e))),this._parser.registerCsiHandler({final:"u"},(e=>this.restoreCursor(e))),this._parser.registerCsiHandler({intermediates:"\'",final:"}"},(e=>this.insertColumns(e))),this._parser.registerCsiHandler({intermediates:"\'",final:"~"},(e=>this.deleteColumns(e))),this._parser.registerCsiHandler({intermediates:\'"\',final:"q"},(e=>this.selectProtected(e))),this._parser.registerCsiHandler({intermediates:"$",final:"p"},(e=>this.requestMode(e,!0))),this._parser.registerCsiHandler({prefix:"?",intermediates:"$",final:"p"},(e=>this.requestMode(e,!1))),this._parser.setExecuteHandler(n.C0.BEL,(()=>this.bell())),this._parser.setExecuteHandler(n.C0.LF,(()=>this.lineFeed())),this._parser.setExecuteHandler(n.C0.VT,(()=>this.lineFeed())),this._parser.setExecuteHandler(n.C0.FF,(()=>this.lineFeed())),this._parser.setExecuteHandler(n.C0.CR,(()=>this.carriageReturn())),this._parser.setExecuteHandler(n.C0.BS,(()=>this.backspace())),this._parser.setExecuteHandler(n.C0.HT,(()=>this.tab())),this._parser.setExecuteHandler(n.C0.SO,(()=>this.shiftOut())),this._parser.setExecuteHandler(n.C0.SI,(()=>this.shiftIn())),this._parser.setExecuteHandler(n.C1.IND,(()=>this.index())),this._parser.setExecuteHandler(n.C1.NEL,(()=>this.nextLine())),this._parser.setExecuteHandler(n.C1.HTS,(()=>this.tabSet())),this._parser.registerOscHandler(0,new g.OscHandler((e=>(this.setTitle(e),this.setIconName(e),!0)))),this._parser.registerOscHandler(1,new g.OscHandler((e=>this.setIconName(e)))),this._parser.registerOscHandler(2,new g.OscHandler((e=>this.setTitle(e)))),this._parser.registerOscHandler(4,new g.OscHandler((e=>this.setOrReportIndexedColor(e)))),this._parser.registerOscHandler(8,new g.OscHandler((e=>this.setHyperlink(e)))),this._parser.registerOscHandler(10,new g.OscHandler((e=>this.setOrReportFgColor(e)))),this._parser.registerOscHandler(11,new g.OscHandler((e=>this.setOrReportBgColor(e)))),this._parser.registerOscHandler(12,new g.OscHandler((e=>this.setOrReportCursorColor(e)))),this._parser.registerOscHandler(104,new g.OscHandler((e=>this.restoreIndexedColor(e)))),this._parser.registerOscHandler(110,new g.OscHandler((e=>this.restoreFgColor(e)))),this._parser.registerOscHandler(111,new g.OscHandler((e=>this.restoreBgColor(e)))),this._parser.registerOscHandler(112,new g.OscHandler((e=>this.restoreCursorColor(e)))),this._parser.registerEscHandler({final:"7"},(()=>this.saveCursor())),this._parser.registerEscHandler({final:"8"},(()=>this.restoreCursor())),this._parser.registerEscHandler({final:"D"},(()=>this.index())),this._parser.registerEscHandler({final:"E"},(()=>this.nextLine())),this._parser.registerEscHandler({final:"H"},(()=>this.tabSet())),this._parser.registerEscHandler({final:"M"},(()=>this.reverseIndex())),this._parser.registerEscHandler({final:"="},(()=>this.keypadApplicationMode())),this._parser.registerEscHandler({final:">"},(()=>this.keypadNumericMode())),this._parser.registerEscHandler({final:"c"},(()=>this.fullReset())),this._parser.registerEscHandler({final:"n"},(()=>this.setgLevel(2))),this._parser.registerEscHandler({final:"o"},(()=>this.setgLevel(3))),this._parser.registerEscHandler({final:"|"},(()=>this.setgLevel(3))),this._parser.registerEscHandler({final:"}"},(()=>this.setgLevel(2))),this._parser.registerEscHandler({final:"~"},(()=>this.setgLevel(1))),this._parser.registerEscHandler({intermediates:"%",final:"@"},(()=>this.selectDefaultCharset())),this._parser.registerEscHandler({intermediates:"%",final:"G"},(()=>this.selectDefaultCharset()));for(const e in o.CHARSETS)this._parser.registerEscHandler({intermediates:"(",final:e},(()=>this.selectCharset("("+e))),this._parser.registerEscHandler({intermediates:")",final:e},(()=>this.selectCharset(")"+e))),this._parser.registerEscHandler({intermediates:"*",final:e},(()=>this.selectCharset("*"+e))),this._parser.registerEscHandler({intermediates:"+",final:e},(()=>this.selectCharset("+"+e))),this._parser.registerEscHandler({intermediates:"-",final:e},(()=>this.selectCharset("-"+e))),this._parser.registerEscHandler({intermediates:".",final:e},(()=>this.selectCharset("."+e))),this._parser.registerEscHandler({intermediates:"/",final:e},(()=>this.selectCharset("/"+e)));this._parser.registerEscHandler({intermediates:"#",final:"8"},(()=>this.screenAlignmentPattern())),this._parser.setErrorHandler((e=>(this._logService.error("Parsing error: ",e),e))),this._parser.registerDcsHandler({intermediates:"$",final:"q"},new m.DcsHandler(((e,t)=>this.requestStatusString(e,t))))}_preserveStack(e,t,i,s){this._parseStack.paused=!0,this._parseStack.cursorStartX=e,this._parseStack.cursorStartY=t,this._parseStack.decodedLength=i,this._parseStack.position=s}_logSlowResolvingAsync(e){this._logService.logLevel<=v.LogLevelEnum.WARN&&Promise.race([e,new Promise(((e,t)=>setTimeout((()=>t("#SLOW_TIMEOUT")),5e3)))]).catch((e=>{if("#SLOW_TIMEOUT"!==e)throw e;console.warn("async parser handler taking longer than 5000 ms")}))}_getCurrentLinkId(){return this._curAttrData.extended.urlId}parse(e,t){let i,s=this._activeBuffer.x,r=this._activeBuffer.y,n=0;const o=this._parseStack.paused;if(o){if(i=this._parser.parse(this._parseBuffer,this._parseStack.decodedLength,t))return this._logSlowResolvingAsync(i),i;s=this._parseStack.cursorStartX,r=this._parseStack.cursorStartY,this._parseStack.paused=!1,e.length>b&&(n=this._parseStack.position+b)}if(this._logService.logLevel<=v.LogLevelEnum.DEBUG&&this._logService.debug("parsing data"+("string"==typeof e?` "${e}"`:` "${Array.prototype.map.call(e,(e=>String.fromCharCode(e))).join("")}"`),"string"==typeof e?e.split("").map((e=>e.charCodeAt(0))):e),this._parseBuffer.length<e.length&&this._parseBuffer.length<b&&(this._parseBuffer=new Uint32Array(Math.min(e.length,b))),o||this._dirtyRowTracker.clearRange(),e.length>b)for(let t=n;t<e.length;t+=b){const n=t+b<e.length?t+b:e.length,o="string"==typeof e?this._stringDecoder.decode(e.substring(t,n),this._parseBuffer):this._utf8Decoder.decode(e.subarray(t,n),this._parseBuffer);if(i=this._parser.parse(this._parseBuffer,o))return this._preserveStack(s,r,o,t),this._logSlowResolvingAsync(i),i}else if(!o){const t="string"==typeof e?this._stringDecoder.decode(e,this._parseBuffer):this._utf8Decoder.decode(e,this._parseBuffer);if(i=this._parser.parse(this._parseBuffer,t))return this._preserveStack(s,r,t,0),this._logSlowResolvingAsync(i),i}this._activeBuffer.x===s&&this._activeBuffer.y===r||this._onCursorMove.fire();const a=this._dirtyRowTracker.end+(this._bufferService.buffer.ybase-this._bufferService.buffer.ydisp),h=this._dirtyRowTracker.start+(this._bufferService.buffer.ybase-this._bufferService.buffer.ydisp);h<this._bufferService.rows&&this._onRequestRefreshRows.fire(Math.min(h,this._bufferService.rows-1),Math.min(a,this._bufferService.rows-1))}print(e,t,i){let s,r;const n=this._charsetService.charset,o=this._optionsService.rawOptions.screenReaderMode,a=this._bufferService.cols,h=this._coreService.decPrivateModes.wraparound,d=this._coreService.modes.insertMode,u=this._curAttrData;let f=this._activeBuffer.lines.get(this._activeBuffer.ybase+this._activeBuffer.y);this._dirtyRowTracker.markDirty(this._activeBuffer.y),this._activeBuffer.x&&i-t>0&&2===f.getWidth(this._activeBuffer.x-1)&&f.setCellFromCodepoint(this._activeBuffer.x-1,0,1,u);let v=this._parser.precedingJoinState;for(let g=t;g<i;++g){if(s=e[g],s<127&&n){const e=n[String.fromCharCode(s)];e&&(s=e.charCodeAt(0))}const t=this._unicodeService.charProperties(s,v);r=p.UnicodeService.extractWidth(t);const i=p.UnicodeService.extractShouldJoin(t),m=i?p.UnicodeService.extractWidth(v):0;if(v=t,o&&this._onA11yChar.fire((0,c.stringFromCodePoint)(s)),this._getCurrentLinkId()&&this._oscLinkService.addLineToLink(this._getCurrentLinkId(),this._activeBuffer.ybase+this._activeBuffer.y),this._activeBuffer.x+r-m>a)if(h){const e=f;let t=this._activeBuffer.x-m;for(this._activeBuffer.x=m,this._activeBuffer.y++,this._activeBuffer.y===this._activeBuffer.scrollBottom+1?(this._activeBuffer.y--,this._bufferService.scroll(this._eraseAttrData(),!0)):(this._activeBuffer.y>=this._bufferService.rows&&(this._activeBuffer.y=this._bufferService.rows-1),this._activeBuffer.lines.get(this._activeBuffer.ybase+this._activeBuffer.y).isWrapped=!0),f=this._activeBuffer.lines.get(this._activeBuffer.ybase+this._activeBuffer.y),m>0&&f instanceof l.BufferLine&&f.copyCellsFrom(e,t,0,m,!1);t<a;)e.setCellFromCodepoint(t++,0,1,u)}else if(this._activeBuffer.x=a-1,2===r)continue;if(i&&this._activeBuffer.x){const e=f.getWidth(this._activeBuffer.x-1)?1:2;f.addCodepointToCell(this._activeBuffer.x-e,s,r);for(let e=r-m;--e>=0;)f.setCellFromCodepoint(this._activeBuffer.x++,0,0,u)}else if(d&&(f.insertCells(this._activeBuffer.x,r-m,this._activeBuffer.getNullCell(u)),2===f.getWidth(a-1)&&f.setCellFromCodepoint(a-1,_.NULL_CELL_CODE,_.NULL_CELL_WIDTH,u)),f.setCellFromCodepoint(this._activeBuffer.x++,s,r,u),r>0)for(;--r;)f.setCellFromCodepoint(this._activeBuffer.x++,0,0,u)}this._parser.precedingJoinState=v,this._activeBuffer.x<a&&i-t>0&&0===f.getWidth(this._activeBuffer.x)&&!f.hasContent(this._activeBuffer.x)&&f.setCellFromCodepoint(this._activeBuffer.x,0,1,u),this._dirtyRowTracker.markDirty(this._activeBuffer.y)}registerCsiHandler(e,t){return"t"!==e.final||e.prefix||e.intermediates?this._parser.registerCsiHandler(e,t):this._parser.registerCsiHandler(e,(e=>!w(e.params[0],this._optionsService.rawOptions.windowOptions)||t(e)))}registerDcsHandler(e,t){return this._parser.registerDcsHandler(e,new m.DcsHandler(t))}registerEscHandler(e,t){return this._parser.registerEscHandler(e,t)}registerOscHandler(e,t){return this._parser.registerOscHandler(e,new g.OscHandler(t))}bell(){return this._onRequestBell.fire(),!0}lineFeed(){return this._dirtyRowTracker.markDirty(this._activeBuffer.y),this._optionsService.rawOptions.convertEol&&(this._activeBuffer.x=0),this._activeBuffer.y++,this._activeBuffer.y===this._activeBuffer.scrollBottom+1?(this._activeBuffer.y--,this._bufferService.scroll(this._eraseAttrData())):this._activeBuffer.y>=this._bufferService.rows?this._activeBuffer.y=this._bufferService.rows-1:this._activeBuffer.lines.get(this._activeBuffer.ybase+this._activeBuffer.y).isWrapped=!1,this._activeBuffer.x>=this._bufferService.cols&&this._activeBuffer.x--,this._dirtyRowTracker.markDirty(this._activeBuffer.y),this._onLineFeed.fire(),!0}carriageReturn(){return this._activeBuffer.x=0,!0}backspace(){if(!this._coreService.decPrivateModes.reverseWraparound)return this._restrictCursor(),this._activeBuffer.x>0&&this._activeBuffer.x--,!0;if(this._restrictCursor(this._bufferService.cols),this._activeBuffer.x>0)this._activeBuffer.x--;else if(0===this._activeBuffer.x&&this._activeBuffer.y>this._activeBuffer.scrollTop&&this._activeBuffer.y<=this._activeBuffer.scrollBottom&&this._activeBuffer.lines.get(this._activeBuffer.ybase+this._activeBuffer.y)?.isWrapped){this._activeBuffer.lines.get(this._activeBuffer.ybase+this._activeBuffer.y).isWrapped=!1,this._activeBuffer.y--,this._activeBuffer.x=this._bufferService.cols-1;const e=this._activeBuffer.lines.get(this._activeBuffer.ybase+this._activeBuffer.y);e.hasWidth(this._activeBuffer.x)&&!e.hasContent(this._activeBuffer.x)&&this._activeBuffer.x--}return this._restrictCursor(),!0}tab(){if(this._activeBuffer.x>=this._bufferService.cols)return!0;const e=this._activeBuffer.x;return this._activeBuffer.x=this._activeBuffer.nextStop(),this._optionsService.rawOptions.screenReaderMode&&this._onA11yTab.fire(this._activeBuffer.x-e),!0}shiftOut(){return this._charsetService.setgLevel(1),!0}shiftIn(){return this._charsetService.setgLevel(0),!0}_restrictCursor(e=this._bufferService.cols-1){this._activeBuffer.x=Math.min(e,Math.max(0,this._activeBuffer.x)),this._activeBuffer.y=this._coreService.decPrivateModes.origin?Math.min(this._activeBuffer.scrollBottom,Math.max(this._activeBuffer.scrollTop,this._activeBuffer.y)):Math.min(this._bufferService.rows-1,Math.max(0,this._activeBuffer.y)),this._dirtyRowTracker.markDirty(this._activeBuffer.y)}_setCursor(e,t){this._dirtyRowTracker.markDirty(this._activeBuffer.y),this._coreService.decPrivateModes.origin?(this._activeBuffer.x=e,this._activeBuffer.y=this._activeBuffer.scrollTop+t):(this._activeBuffer.x=e,this._activeBuffer.y=t),this._restrictCursor(),this._dirtyRowTracker.markDirty(this._activeBuffer.y)}_moveCursor(e,t){this._restrictCursor(),this._setCursor(this._activeBuffer.x+e,this._activeBuffer.y+t)}cursorUp(e){const t=this._activeBuffer.y-this._activeBuffer.scrollTop;return t>=0?this._moveCursor(0,-Math.min(t,e.params[0]||1)):this._moveCursor(0,-(e.params[0]||1)),!0}cursorDown(e){const t=this._activeBuffer.scrollBottom-this._activeBuffer.y;return t>=0?this._moveCursor(0,Math.min(t,e.params[0]||1)):this._moveCursor(0,e.params[0]||1),!0}cursorForward(e){return this._moveCursor(e.params[0]||1,0),!0}cursorBackward(e){return this._moveCursor(-(e.params[0]||1),0),!0}cursorNextLine(e){return this.cursorDown(e),this._activeBuffer.x=0,!0}cursorPrecedingLine(e){return this.cursorUp(e),this._activeBuffer.x=0,!0}cursorCharAbsolute(e){return this._setCursor((e.params[0]||1)-1,this._activeBuffer.y),!0}cursorPosition(e){return this._setCursor(e.length>=2?(e.params[1]||1)-1:0,(e.params[0]||1)-1),!0}charPosAbsolute(e){return this._setCursor((e.params[0]||1)-1,this._activeBuffer.y),!0}hPositionRelative(e){return this._moveCursor(e.params[0]||1,0),!0}linePosAbsolute(e){return this._setCursor(this._activeBuffer.x,(e.params[0]||1)-1),!0}vPositionRelative(e){return this._moveCursor(0,e.params[0]||1),!0}hVPosition(e){return this.cursorPosition(e),!0}tabClear(e){const t=e.params[0];return 0===t?delete this._activeBuffer.tabs[this._activeBuffer.x]:3===t&&(this._activeBuffer.tabs={}),!0}cursorForwardTab(e){if(this._activeBuffer.x>=this._bufferService.cols)return!0;let t=e.params[0]||1;for(;t--;)this._activeBuffer.x=this._activeBuffer.nextStop();return!0}cursorBackwardTab(e){if(this._activeBuffer.x>=this._bufferService.cols)return!0;let t=e.params[0]||1;for(;t--;)this._activeBuffer.x=this._activeBuffer.prevStop();return!0}selectProtected(e){const t=e.params[0];return 1===t&&(this._curAttrData.bg|=536870912),2!==t&&0!==t||(this._curAttrData.bg&=-536870913),!0}_eraseInBufferLine(e,t,i,s=!1,r=!1){const n=this._activeBuffer.lines.get(this._activeBuffer.ybase+e);n.replaceCells(t,i,this._activeBuffer.getNullCell(this._eraseAttrData()),r),s&&(n.isWrapped=!1)}_resetBufferLine(e,t=!1){const i=this._activeBuffer.lines.get(this._activeBuffer.ybase+e);i&&(i.fill(this._activeBuffer.getNullCell(this._eraseAttrData()),t),this._bufferService.buffer.clearMarkers(this._activeBuffer.ybase+e),i.isWrapped=!1)}eraseInDisplay(e,t=!1){let i;switch(this._restrictCursor(this._bufferService.cols),e.params[0]){case 0:for(i=this._activeBuffer.y,this._dirtyRowTracker.markDirty(i),this._eraseInBufferLine(i++,this._activeBuffer.x,this._bufferService.cols,0===this._activeBuffer.x,t);i<this._bufferService.rows;i++)this._resetBufferLine(i,t);this._dirtyRowTracker.markDirty(i);break;case 1:for(i=this._activeBuffer.y,this._dirtyRowTracker.markDirty(i),this._eraseInBufferLine(i,0,this._activeBuffer.x+1,!0,t),this._activeBuffer.x+1>=this._bufferService.cols&&(this._activeBuffer.lines.get(i+1).isWrapped=!1);i--;)this._resetBufferLine(i,t);this._dirtyRowTracker.markDirty(0);break;case 2:for(i=this._bufferService.rows,this._dirtyRowTracker.markDirty(i-1);i--;)this._resetBufferLine(i,t);this._dirtyRowTracker.markDirty(0);break;case 3:const e=this._activeBuffer.lines.length-this._bufferService.rows;e>0&&(this._activeBuffer.lines.trimStart(e),this._activeBuffer.ybase=Math.max(this._activeBuffer.ybase-e,0),this._activeBuffer.ydisp=Math.max(this._activeBuffer.ydisp-e,0),this._onScroll.fire(0))}return!0}eraseInLine(e,t=!1){switch(this._restrictCursor(this._bufferService.cols),e.params[0]){case 0:this._eraseInBufferLine(this._activeBuffer.y,this._activeBuffer.x,this._bufferService.cols,0===this._activeBuffer.x,t);break;case 1:this._eraseInBufferLine(this._activeBuffer.y,0,this._activeBuffer.x+1,!1,t);break;case 2:this._eraseInBufferLine(this._activeBuffer.y,0,this._bufferService.cols,!0,t)}return this._dirtyRowTracker.markDirty(this._activeBuffer.y),!0}insertLines(e){this._restrictCursor();let t=e.params[0]||1;if(this._activeBuffer.y>this._activeBuffer.scrollBottom||this._activeBuffer.y<this._activeBuffer.scrollTop)return!0;const i=this._activeBuffer.ybase+this._activeBuffer.y,s=this._bufferService.rows-1-this._activeBuffer.scrollBottom,r=this._bufferService.rows-1+this._activeBuffer.ybase-s+1;for(;t--;)this._activeBuffer.lines.splice(r-1,1),this._activeBuffer.lines.splice(i,0,this._activeBuffer.getBlankLine(this._eraseAttrData()));return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.y,this._activeBuffer.scrollBottom),this._activeBuffer.x=0,!0}deleteLines(e){this._restrictCursor();let t=e.params[0]||1;if(this._activeBuffer.y>this._activeBuffer.scrollBottom||this._activeBuffer.y<this._activeBuffer.scrollTop)return!0;const i=this._activeBuffer.ybase+this._activeBuffer.y;let s;for(s=this._bufferService.rows-1-this._activeBuffer.scrollBottom,s=this._bufferService.rows-1+this._activeBuffer.ybase-s;t--;)this._activeBuffer.lines.splice(i,1),this._activeBuffer.lines.splice(s,0,this._activeBuffer.getBlankLine(this._eraseAttrData()));return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.y,this._activeBuffer.scrollBottom),this._activeBuffer.x=0,!0}insertChars(e){this._restrictCursor();const t=this._activeBuffer.lines.get(this._activeBuffer.ybase+this._activeBuffer.y);return t&&(t.insertCells(this._activeBuffer.x,e.params[0]||1,this._activeBuffer.getNullCell(this._eraseAttrData())),this._dirtyRowTracker.markDirty(this._activeBuffer.y)),!0}deleteChars(e){this._restrictCursor();const t=this._activeBuffer.lines.get(this._activeBuffer.ybase+this._activeBuffer.y);return t&&(t.deleteCells(this._activeBuffer.x,e.params[0]||1,this._activeBuffer.getNullCell(this._eraseAttrData())),this._dirtyRowTracker.markDirty(this._activeBuffer.y)),!0}scrollUp(e){let t=e.params[0]||1;for(;t--;)this._activeBuffer.lines.splice(this._activeBuffer.ybase+this._activeBuffer.scrollTop,1),this._activeBuffer.lines.splice(this._activeBuffer.ybase+this._activeBuffer.scrollBottom,0,this._activeBuffer.getBlankLine(this._eraseAttrData()));return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop,this._activeBuffer.scrollBottom),!0}scrollDown(e){let t=e.params[0]||1;for(;t--;)this._activeBuffer.lines.splice(this._activeBuffer.ybase+this._activeBuffer.scrollBottom,1),this._activeBuffer.lines.splice(this._activeBuffer.ybase+this._activeBuffer.scrollTop,0,this._activeBuffer.getBlankLine(l.DEFAULT_ATTR_DATA));return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop,this._activeBuffer.scrollBottom),!0}scrollLeft(e){if(this._activeBuffer.y>this._activeBuffer.scrollBottom||this._activeBuffer.y<this._activeBuffer.scrollTop)return!0;const t=e.params[0]||1;for(let e=this._activeBuffer.scrollTop;e<=this._activeBuffer.scrollBottom;++e){const i=this._activeBuffer.lines.get(this._activeBuffer.ybase+e);i.deleteCells(0,t,this._activeBuffer.getNullCell(this._eraseAttrData())),i.isWrapped=!1}return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop,this._activeBuffer.scrollBottom),!0}scrollRight(e){if(this._activeBuffer.y>this._activeBuffer.scrollBottom||this._activeBuffer.y<this._activeBuffer.scrollTop)return!0;const t=e.params[0]||1;for(let e=this._activeBuffer.scrollTop;e<=this._activeBuffer.scrollBottom;++e){const i=this._activeBuffer.lines.get(this._activeBuffer.ybase+e);i.insertCells(0,t,this._activeBuffer.getNullCell(this._eraseAttrData())),i.isWrapped=!1}return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop,this._activeBuffer.scrollBottom),!0}insertColumns(e){if(this._activeBuffer.y>this._activeBuffer.scrollBottom||this._activeBuffer.y<this._activeBuffer.scrollTop)return!0;const t=e.params[0]||1;for(let e=this._activeBuffer.scrollTop;e<=this._activeBuffer.scrollBottom;++e){const i=this._activeBuffer.lines.get(this._activeBuffer.ybase+e);i.insertCells(this._activeBuffer.x,t,this._activeBuffer.getNullCell(this._eraseAttrData())),i.isWrapped=!1}return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop,this._activeBuffer.scrollBottom),!0}deleteColumns(e){if(this._activeBuffer.y>this._activeBuffer.scrollBottom||this._activeBuffer.y<this._activeBuffer.scrollTop)return!0;const t=e.params[0]||1;for(let e=this._activeBuffer.scrollTop;e<=this._activeBuffer.scrollBottom;++e){const i=this._activeBuffer.lines.get(this._activeBuffer.ybase+e);i.deleteCells(this._activeBuffer.x,t,this._activeBuffer.getNullCell(this._eraseAttrData())),i.isWrapped=!1}return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop,this._activeBuffer.scrollBottom),!0}eraseChars(e){this._restrictCursor();const t=this._activeBuffer.lines.get(this._activeBuffer.ybase+this._activeBuffer.y);return t&&(t.replaceCells(this._activeBuffer.x,this._activeBuffer.x+(e.params[0]||1),this._activeBuffer.getNullCell(this._eraseAttrData())),this._dirtyRowTracker.markDirty(this._activeBuffer.y)),!0}repeatPrecedingCharacter(e){const t=this._parser.precedingJoinState;if(!t)return!0;const i=e.params[0]||1,s=p.UnicodeService.extractWidth(t),r=this._activeBuffer.x-s,n=this._activeBuffer.lines.get(this._activeBuffer.ybase+this._activeBuffer.y).getString(r),o=new Uint32Array(n.length*i);let a=0;for(let e=0;e<n.length;){const t=n.codePointAt(e)||0;o[a++]=t,e+=t>65535?2:1}let h=a;for(let e=1;e<i;++e)o.copyWithin(h,0,a),h+=a;return this.print(o,0,h),!0}sendDeviceAttributesPrimary(e){return e.params[0]>0||(this._is("xterm")||this._is("rxvt-unicode")||this._is("screen")?this._coreService.triggerDataEvent(n.C0.ESC+"[?1;2c"):this._is("linux")&&this._coreService.triggerDataEvent(n.C0.ESC+"[?6c")),!0}sendDeviceAttributesSecondary(e){return e.params[0]>0||(this._is("xterm")?this._coreService.triggerDataEvent(n.C0.ESC+"[>0;276;0c"):this._is("rxvt-unicode")?this._coreService.triggerDataEvent(n.C0.ESC+"[>85;95;0c"):this._is("linux")?this._coreService.triggerDataEvent(e.params[0]+"c"):this._is("screen")&&this._coreService.triggerDataEvent(n.C0.ESC+"[>83;40003;0c")),!0}_is(e){return 0===(this._optionsService.rawOptions.termName+"").indexOf(e)}setMode(e){for(let t=0;t<e.length;t++)switch(e.params[t]){case 4:this._coreService.modes.insertMode=!0;break;case 20:this._optionsService.options.convertEol=!0}return!0}setModePrivate(e){for(let t=0;t<e.length;t++)switch(e.params[t]){case 1:this._coreService.decPrivateModes.applicationCursorKeys=!0;break;case 2:this._charsetService.setgCharset(0,o.DEFAULT_CHARSET),this._charsetService.setgCharset(1,o.DEFAULT_CHARSET),this._charsetService.setgCharset(2,o.DEFAULT_CHARSET),this._charsetService.setgCharset(3,o.DEFAULT_CHARSET);break;case 3:this._optionsService.rawOptions.windowOptions.setWinLines&&(this._bufferService.resize(132,this._bufferService.rows),this._onRequestReset.fire());break;case 6:this._coreService.decPrivateModes.origin=!0,this._setCursor(0,0);break;case 7:this._coreService.decPrivateModes.wraparound=!0;break;case 12:this._optionsService.options.cursorBlink=!0;break;case 45:this._coreService.decPrivateModes.reverseWraparound=!0;break;case 66:this._logService.debug("Serial port requested application keypad."),this._coreService.decPrivateModes.applicationKeypad=!0,this._onRequestSyncScrollBar.fire();break;case 9:this._coreMouseService.activeProtocol="X10";break;case 1e3:this._coreMouseService.activeProtocol="VT200";break;case 1002:this._coreMouseService.activeProtocol="DRAG";break;case 1003:this._coreMouseService.activeProtocol="ANY";break;case 1004:this._coreService.decPrivateModes.sendFocus=!0,this._onRequestSendFocus.fire();break;case 1005:this._logService.debug("DECSET 1005 not supported (see #2507)");break;case 1006:this._coreMouseService.activeEncoding="SGR";break;case 1015:this._logService.debug("DECSET 1015 not supported (see #2507)");break;case 1016:this._coreMouseService.activeEncoding="SGR_PIXELS";break;case 25:this._coreService.isCursorHidden=!1;break;case 1048:this.saveCursor();break;case 1049:this.saveCursor();case 47:case 1047:this._bufferService.buffers.activateAltBuffer(this._eraseAttrData()),this._coreService.isCursorInitialized=!0,this._onRequestRefreshRows.fire(0,this._bufferService.rows-1),this._onRequestSyncScrollBar.fire();break;case 2004:this._coreService.decPrivateModes.bracketedPasteMode=!0}return!0}resetMode(e){for(let t=0;t<e.length;t++)switch(e.params[t]){case 4:this._coreService.modes.insertMode=!1;break;case 20:this._optionsService.options.convertEol=!1}return!0}resetModePrivate(e){for(let t=0;t<e.length;t++)switch(e.params[t]){case 1:this._coreService.decPrivateModes.applicationCursorKeys=!1;break;case 3:this._optionsService.rawOptions.windowOptions.setWinLines&&(this._bufferService.resize(80,this._bufferService.rows),this._onRequestReset.fire());break;case 6:this._coreService.decPrivateModes.origin=!1,this._setCursor(0,0);break;case 7:this._coreService.decPrivateModes.wraparound=!1;break;case 12:this._optionsService.options.cursorBlink=!1;break;case 45:this._coreService.decPrivateModes.reverseWraparound=!1;break;case 66:this._logService.debug("Switching back to normal keypad."),this._coreService.decPrivateModes.applicationKeypad=!1,this._onRequestSyncScrollBar.fire();break;case 9:case 1e3:case 1002:case 1003:this._coreMouseService.activeProtocol="NONE";break;case 1004:this._coreService.decPrivateModes.sendFocus=!1;break;case 1005:this._logService.debug("DECRST 1005 not supported (see #2507)");break;case 1006:case 1016:this._coreMouseService.activeEncoding="DEFAULT";break;case 1015:this._logService.debug("DECRST 1015 not supported (see #2507)");break;case 25:this._coreService.isCursorHidden=!0;break;case 1048:this.restoreCursor();break;case 1049:case 47:case 1047:this._bufferService.buffers.activateNormalBuffer(),1049===e.params[t]&&this.restoreCursor(),this._coreService.isCursorInitialized=!0,this._onRequestRefreshRows.fire(0,this._bufferService.rows-1),this._onRequestSyncScrollBar.fire();break;case 2004:this._coreService.decPrivateModes.bracketedPasteMode=!1}return!0}requestMode(e,t){const i=this._coreService.decPrivateModes,{activeProtocol:s,activeEncoding:r}=this._coreMouseService,o=this._coreService,{buffers:a,cols:h}=this._bufferService,{active:c,alt:l}=a,d=this._optionsService.rawOptions,_=e=>e?1:2,u=e.params[0];return f=u,v=t?2===u?4:4===u?_(o.modes.insertMode):12===u?3:20===u?_(d.convertEol):0:1===u?_(i.applicationCursorKeys):3===u?d.windowOptions.setWinLines?80===h?2:132===h?1:0:0:6===u?_(i.origin):7===u?_(i.wraparound):8===u?3:9===u?_("X10"===s):12===u?_(d.cursorBlink):25===u?_(!o.isCursorHidden):45===u?_(i.reverseWraparound):66===u?_(i.applicationKeypad):67===u?4:1e3===u?_("VT200"===s):1002===u?_("DRAG"===s):1003===u?_("ANY"===s):1004===u?_(i.sendFocus):1005===u?4:1006===u?_("SGR"===r):1015===u?4:1016===u?_("SGR_PIXELS"===r):1048===u?1:47===u||1047===u||1049===u?_(c===l):2004===u?_(i.bracketedPasteMode):0,o.triggerDataEvent(`${n.C0.ESC}[${t?"":"?"}${f};${v}$y`),!0;var f,v}_updateAttrColor(e,t,i,s,r){return 2===t?(e|=50331648,e&=-16777216,e|=f.AttributeData.fromColorRGB([i,s,r])):5===t&&(e&=-50331904,e|=33554432|255&i),e}_extractColor(e,t,i){const s=[0,0,-1,0,0,0];let r=0,n=0;do{if(s[n+r]=e.params[t+n],e.hasSubParams(t+n)){const i=e.getSubParams(t+n);let o=0;do{5===s[1]&&(r=1),s[n+o+1+r]=i[o]}while(++o<i.length&&o+n+1+r<s.length);break}if(5===s[1]&&n+r>=2||2===s[1]&&n+r>=5)break;s[1]&&(r=1)}while(++n+t<e.length&&n+r<s.length);for(let e=2;e<s.length;++e)-1===s[e]&&(s[e]=0);switch(s[0]){case 38:i.fg=this._updateAttrColor(i.fg,s[1],s[3],s[4],s[5]);break;case 48:i.bg=this._updateAttrColor(i.bg,s[1],s[3],s[4],s[5]);break;case 58:i.extended=i.extended.clone(),i.extended.underlineColor=this._updateAttrColor(i.extended.underlineColor,s[1],s[3],s[4],s[5])}return n}_processUnderline(e,t){t.extended=t.extended.clone(),(!~e||e>5)&&(e=1),t.extended.underlineStyle=e,t.fg|=268435456,0===e&&(t.fg&=-268435457),t.updateExtended()}_processSGR0(e){e.fg=l.DEFAULT_ATTR_DATA.fg,e.bg=l.DEFAULT_ATTR_DATA.bg,e.extended=e.extended.clone(),e.extended.underlineStyle=0,e.extended.underlineColor&=-67108864,e.updateExtended()}charAttributes(e){if(1===e.length&&0===e.params[0])return this._processSGR0(this._curAttrData),!0;const t=e.length;let i;const s=this._curAttrData;for(let r=0;r<t;r++)i=e.params[r],i>=30&&i<=37?(s.fg&=-50331904,s.fg|=16777216|i-30):i>=40&&i<=47?(s.bg&=-50331904,s.bg|=16777216|i-40):i>=90&&i<=97?(s.fg&=-50331904,s.fg|=16777224|i-90):i>=100&&i<=107?(s.bg&=-50331904,s.bg|=16777224|i-100):0===i?this._processSGR0(s):1===i?s.fg|=134217728:3===i?s.bg|=67108864:4===i?(s.fg|=268435456,this._processUnderline(e.hasSubParams(r)?e.getSubParams(r)[0]:1,s)):5===i?s.fg|=536870912:7===i?s.fg|=67108864:8===i?s.fg|=1073741824:9===i?s.fg|=2147483648:2===i?s.bg|=134217728:21===i?this._processUnderline(2,s):22===i?(s.fg&=-134217729,s.bg&=-134217729):23===i?s.bg&=-67108865:24===i?(s.fg&=-268435457,this._processUnderline(0,s)):25===i?s.fg&=-536870913:27===i?s.fg&=-67108865:28===i?s.fg&=-1073741825:29===i?s.fg&=2147483647:39===i?(s.fg&=-67108864,s.fg|=16777215&l.DEFAULT_ATTR_DATA.fg):49===i?(s.bg&=-67108864,s.bg|=16777215&l.DEFAULT_ATTR_DATA.bg):38===i||48===i||58===i?r+=this._extractColor(e,r,s):53===i?s.bg|=1073741824:55===i?s.bg&=-1073741825:59===i?(s.extended=s.extended.clone(),s.extended.underlineColor=-1,s.updateExtended()):100===i?(s.fg&=-67108864,s.fg|=16777215&l.DEFAULT_ATTR_DATA.fg,s.bg&=-67108864,s.bg|=16777215&l.DEFAULT_ATTR_DATA.bg):this._logService.debug("Unknown SGR attribute: %d.",i);return!0}deviceStatus(e){switch(e.params[0]){case 5:this._coreService.triggerDataEvent(`${n.C0.ESC}[0n`);break;case 6:const e=this._activeBuffer.y+1,t=this._activeBuffer.x+1;this._coreService.triggerDataEvent(`${n.C0.ESC}[${e};${t}R`)}return!0}deviceStatusPrivate(e){if(6===e.params[0]){const e=this._activeBuffer.y+1,t=this._activeBuffer.x+1;this._coreService.triggerDataEvent(`${n.C0.ESC}[?${e};${t}R`)}return!0}softReset(e){return this._coreService.isCursorHidden=!1,this._onRequestSyncScrollBar.fire(),this._activeBuffer.scrollTop=0,this._activeBuffer.scrollBottom=this._bufferService.rows-1,this._curAttrData=l.DEFAULT_ATTR_DATA.clone(),this._coreService.reset(),this._charsetService.reset(),this._activeBuffer.savedX=0,this._activeBuffer.savedY=this._activeBuffer.ybase,this._activeBuffer.savedCurAttrData.fg=this._curAttrData.fg,this._activeBuffer.savedCurAttrData.bg=this._curAttrData.bg,this._activeBuffer.savedCharset=this._charsetService.charset,this._coreService.decPrivateModes.origin=!1,!0}setCursorStyle(e){const t=e.params[0]||1;switch(t){case 1:case 2:this._optionsService.options.cursorStyle="block";break;case 3:case 4:this._optionsService.options.cursorStyle="underline";break;case 5:case 6:this._optionsService.options.cursorStyle="bar"}const i=t%2==1;return this._optionsService.options.cursorBlink=i,!0}setScrollRegion(e){const t=e.params[0]||1;let i;return(e.length<2||(i=e.params[1])>this._bufferService.rows||0===i)&&(i=this._bufferService.rows),i>t&&(this._activeBuffer.scrollTop=t-1,this._activeBuffer.scrollBottom=i-1,this._setCursor(0,0)),!0}windowOptions(e){if(!w(e.params[0],this._optionsService.rawOptions.windowOptions))return!0;const t=e.length>1?e.params[1]:0;switch(e.params[0]){case 14:2!==t&&this._onRequestWindowsOptionsReport.fire(y.GET_WIN_SIZE_PIXELS);break;case 16:this._onRequestWindowsOptionsReport.fire(y.GET_CELL_SIZE_PIXELS);break;case 18:this._bufferService&&this._coreService.triggerDataEvent(`${n.C0.ESC}[8;${this._bufferService.rows};${this._bufferService.cols}t`);break;case 22:0!==t&&2!==t||(this._windowTitleStack.push(this._windowTitle),this._windowTitleStack.length>10&&this._windowTitleStack.shift()),0!==t&&1!==t||(this._iconNameStack.push(this._iconName),this._iconNameStack.length>10&&this._iconNameStack.shift());break;case 23:0!==t&&2!==t||this._windowTitleStack.length&&this.setTitle(this._windowTitleStack.pop()),0!==t&&1!==t||this._iconNameStack.length&&this.setIconName(this._iconNameStack.pop())}return!0}saveCursor(e){return this._activeBuffer.savedX=this._activeBuffer.x,this._activeBuffer.savedY=this._activeBuffer.ybase+this._activeBuffer.y,this._activeBuffer.savedCurAttrData.fg=this._curAttrData.fg,this._activeBuffer.savedCurAttrData.bg=this._curAttrData.bg,this._activeBuffer.savedCharset=this._charsetService.charset,!0}restoreCursor(e){return this._activeBuffer.x=this._activeBuffer.savedX||0,this._activeBuffer.y=Math.max(this._activeBuffer.savedY-this._activeBuffer.ybase,0),this._curAttrData.fg=this._activeBuffer.savedCurAttrData.fg,this._curAttrData.bg=this._activeBuffer.savedCurAttrData.bg,this._charsetService.charset=this._savedCharset,this._activeBuffer.savedCharset&&(this._charsetService.charset=this._activeBuffer.savedCharset),this._restrictCursor(),!0}setTitle(e){return this._windowTitle=e,this._onTitleChange.fire(e),!0}setIconName(e){return this._iconName=e,!0}setOrReportIndexedColor(e){const t=[],i=e.split(";");for(;i.length>1;){const e=i.shift(),s=i.shift();if(/^\\d+$/.exec(e)){const i=parseInt(e);if(D(i))if("?"===s)t.push({type:0,index:i});else{const e=(0,S.parseColor)(s);e&&t.push({type:1,index:i,color:e})}}}return t.length&&this._onColor.fire(t),!0}setHyperlink(e){const t=e.split(";");return!(t.length<2)&&(t[1]?this._createHyperlink(t[0],t[1]):!t[0]&&this._finishHyperlink())}_createHyperlink(e,t){this._getCurrentLinkId()&&this._finishHyperlink();const i=e.split(":");let s;const r=i.findIndex((e=>e.startsWith("id=")));return-1!==r&&(s=i[r].slice(3)||void 0),this._curAttrData.extended=this._curAttrData.extended.clone(),this._curAttrData.extended.urlId=this._oscLinkService.registerLink({id:s,uri:t}),this._curAttrData.updateExtended(),!0}_finishHyperlink(){return this._curAttrData.extended=this._curAttrData.extended.clone(),this._curAttrData.extended.urlId=0,this._curAttrData.updateExtended(),!0}_setOrReportSpecialColor(e,t){const i=e.split(";");for(let e=0;e<i.length&&!(t>=this._specialColors.length);++e,++t)if("?"===i[e])this._onColor.fire([{type:0,index:this._specialColors[t]}]);else{const s=(0,S.parseColor)(i[e]);s&&this._onColor.fire([{type:1,index:this._specialColors[t],color:s}])}return!0}setOrReportFgColor(e){return this._setOrReportSpecialColor(e,0)}setOrReportBgColor(e){return this._setOrReportSpecialColor(e,1)}setOrReportCursorColor(e){return this._setOrReportSpecialColor(e,2)}restoreIndexedColor(e){if(!e)return this._onColor.fire([{type:2}]),!0;const t=[],i=e.split(";");for(let e=0;e<i.length;++e)if(/^\\d+$/.exec(i[e])){const s=parseInt(i[e]);D(s)&&t.push({type:2,index:s})}return t.length&&this._onColor.fire(t),!0}restoreFgColor(e){return this._onColor.fire([{type:2,index:256}]),!0}restoreBgColor(e){return this._onColor.fire([{type:2,index:257}]),!0}restoreCursorColor(e){return this._onColor.fire([{type:2,index:258}]),!0}nextLine(){return this._activeBuffer.x=0,this.index(),!0}keypadApplicationMode(){return this._logService.debug("Serial port requested application keypad."),this._coreService.decPrivateModes.applicationKeypad=!0,this._onRequestSyncScrollBar.fire(),!0}keypadNumericMode(){return this._logService.debug("Switching back to normal keypad."),this._coreService.decPrivateModes.applicationKeypad=!1,this._onRequestSyncScrollBar.fire(),!0}selectDefaultCharset(){return this._charsetService.setgLevel(0),this._charsetService.setgCharset(0,o.DEFAULT_CHARSET),!0}selectCharset(e){return 2!==e.length?(this.selectDefaultCharset(),!0):("/"===e[0]||this._charsetService.setgCharset(C[e[0]],o.CHARSETS[e[1]]||o.DEFAULT_CHARSET),!0)}index(){return this._restrictCursor(),this._activeBuffer.y++,this._activeBuffer.y===this._activeBuffer.scrollBottom+1?(this._activeBuffer.y--,this._bufferService.scroll(this._eraseAttrData())):this._activeBuffer.y>=this._bufferService.rows&&(this._activeBuffer.y=this._bufferService.rows-1),this._restrictCursor(),!0}tabSet(){return this._activeBuffer.tabs[this._activeBuffer.x]=!0,!0}reverseIndex(){if(this._restrictCursor(),this._activeBuffer.y===this._activeBuffer.scrollTop){const e=this._activeBuffer.scrollBottom-this._activeBuffer.scrollTop;this._activeBuffer.lines.shiftElements(this._activeBuffer.ybase+this._activeBuffer.y,e,1),this._activeBuffer.lines.set(this._activeBuffer.ybase+this._activeBuffer.y,this._activeBuffer.getBlankLine(this._eraseAttrData())),this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop,this._activeBuffer.scrollBottom)}else this._activeBuffer.y--,this._restrictCursor();return!0}fullReset(){return this._parser.reset(),this._onRequestReset.fire(),!0}reset(){this._curAttrData=l.DEFAULT_ATTR_DATA.clone(),this._eraseAttrDataInternal=l.DEFAULT_ATTR_DATA.clone()}_eraseAttrData(){return this._eraseAttrDataInternal.bg&=-67108864,this._eraseAttrDataInternal.bg|=67108863&this._curAttrData.bg,this._eraseAttrDataInternal}setgLevel(e){return this._charsetService.setgLevel(e),!0}screenAlignmentPattern(){const e=new u.CellData;e.content=1<<22|"E".charCodeAt(0),e.fg=this._curAttrData.fg,e.bg=this._curAttrData.bg,this._setCursor(0,0);for(let t=0;t<this._bufferService.rows;++t){const i=this._activeBuffer.ybase+this._activeBuffer.y+t,s=this._activeBuffer.lines.get(i);s&&(s.fill(e),s.isWrapped=!1)}return this._dirtyRowTracker.markAllDirty(),this._setCursor(0,0),!0}requestStatusString(e,t){const i=this._bufferService.buffer,s=this._optionsService.rawOptions;return(e=>(this._coreService.triggerDataEvent(`${n.C0.ESC}${e}${n.C0.ESC}\\\\`),!0))(\'"q\'===e?`P1$r${this._curAttrData.isProtected()?1:0}"q`:\'"p\'===e?\'P1$r61;1"p\':"r"===e?`P1$r${i.scrollTop+1};${i.scrollBottom+1}r`:"m"===e?"P1$r0m":" q"===e?`P1$r${{block:2,underline:4,bar:6}[s.cursorStyle]-(s.cursorBlink?1:0)} q`:"P0$r")}markRangeDirty(e,t){this._dirtyRowTracker.markRangeDirty(e,t)}}t.InputHandler=k;let L=class{constructor(e){this._bufferService=e,this.clearRange()}clearRange(){this.start=this._bufferService.buffer.y,this.end=this._bufferService.buffer.y}markDirty(e){e<this.start?this.start=e:e>this.end&&(this.end=e)}markRangeDirty(e,t){e>t&&(E=e,e=t,t=E),e<this.start&&(this.start=e),t>this.end&&(this.end=t)}markAllDirty(){this.markRangeDirty(0,this._bufferService.rows-1)}};function D(e){return 0<=e&&e<256}L=s([r(0,v.IBufferService)],L)},844:(e,t)=>{function i(e){for(const t of e)t.dispose();e.length=0}Object.defineProperty(t,"__esModule",{value:!0}),t.getDisposeArrayDisposable=t.disposeArray=t.toDisposable=t.MutableDisposable=t.Disposable=void 0,t.Disposable=class{constructor(){this._disposables=[],this._isDisposed=!1}dispose(){this._isDisposed=!0;for(const e of this._disposables)e.dispose();this._disposables.length=0}register(e){return this._disposables.push(e),e}unregister(e){const t=this._disposables.indexOf(e);-1!==t&&this._disposables.splice(t,1)}},t.MutableDisposable=class{constructor(){this._isDisposed=!1}get value(){return this._isDisposed?void 0:this._value}set value(e){this._isDisposed||e===this._value||(this._value?.dispose(),this._value=e)}clear(){this.value=void 0}dispose(){this._isDisposed=!0,this._value?.dispose(),this._value=void 0}},t.toDisposable=function(e){return{dispose:e}},t.disposeArray=i,t.getDisposeArrayDisposable=function(e){return{dispose:()=>i(e)}}},1505:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.FourKeyMap=t.TwoKeyMap=void 0;class i{constructor(){this._data={}}set(e,t,i){this._data[e]||(this._data[e]={}),this._data[e][t]=i}get(e,t){return this._data[e]?this._data[e][t]:void 0}clear(){this._data={}}}t.TwoKeyMap=i,t.FourKeyMap=class{constructor(){this._data=new i}set(e,t,s,r,n){this._data.get(e,t)||this._data.set(e,t,new i),this._data.get(e,t).set(s,r,n)}get(e,t,i,s){return this._data.get(e,t)?.get(i,s)}clear(){this._data.clear()}}},6114:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.isChromeOS=t.isLinux=t.isWindows=t.isIphone=t.isIpad=t.isMac=t.getSafariVersion=t.isSafari=t.isLegacyEdge=t.isFirefox=t.isNode=void 0,t.isNode="undefined"!=typeof process&&"title"in process;const i=t.isNode?"node":navigator.userAgent,s=t.isNode?"node":navigator.platform;t.isFirefox=i.includes("Firefox"),t.isLegacyEdge=i.includes("Edge"),t.isSafari=/^((?!chrome|android).)*safari/i.test(i),t.getSafariVersion=function(){if(!t.isSafari)return 0;const e=i.match(/Version\\/(\\d+)/);return null===e||e.length<2?0:parseInt(e[1])},t.isMac=["Macintosh","MacIntel","MacPPC","Mac68K"].includes(s),t.isIpad="iPad"===s,t.isIphone="iPhone"===s,t.isWindows=["Windows","Win16","Win32","WinCE"].includes(s),t.isLinux=s.indexOf("Linux")>=0,t.isChromeOS=/\\bCrOS\\b/.test(i)},6106:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.SortedList=void 0;let i=0;t.SortedList=class{constructor(e){this._getKey=e,this._array=[]}clear(){this._array.length=0}insert(e){0!==this._array.length?(i=this._search(this._getKey(e)),this._array.splice(i,0,e)):this._array.push(e)}delete(e){if(0===this._array.length)return!1;const t=this._getKey(e);if(void 0===t)return!1;if(i=this._search(t),-1===i)return!1;if(this._getKey(this._array[i])!==t)return!1;do{if(this._array[i]===e)return this._array.splice(i,1),!0}while(++i<this._array.length&&this._getKey(this._array[i])===t);return!1}*getKeyIterator(e){if(0!==this._array.length&&(i=this._search(e),!(i<0||i>=this._array.length)&&this._getKey(this._array[i])===e))do{yield this._array[i]}while(++i<this._array.length&&this._getKey(this._array[i])===e)}forEachByKey(e,t){if(0!==this._array.length&&(i=this._search(e),!(i<0||i>=this._array.length)&&this._getKey(this._array[i])===e))do{t(this._array[i])}while(++i<this._array.length&&this._getKey(this._array[i])===e)}values(){return[...this._array].values()}_search(e){let t=0,i=this._array.length-1;for(;i>=t;){let s=t+i>>1;const r=this._getKey(this._array[s]);if(r>e)i=s-1;else{if(!(r<e)){for(;s>0&&this._getKey(this._array[s-1])===e;)s--;return s}t=s+1}}return t}}},7226:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.DebouncedIdleTask=t.IdleTaskQueue=t.PriorityTaskQueue=void 0;const s=i(6114);class r{constructor(){this._tasks=[],this._i=0}enqueue(e){this._tasks.push(e),this._start()}flush(){for(;this._i<this._tasks.length;)this._tasks[this._i]()||this._i++;this.clear()}clear(){this._idleCallback&&(this._cancelCallback(this._idleCallback),this._idleCallback=void 0),this._i=0,this._tasks.length=0}_start(){this._idleCallback||(this._idleCallback=this._requestCallback(this._process.bind(this)))}_process(e){this._idleCallback=void 0;let t=0,i=0,s=e.timeRemaining(),r=0;for(;this._i<this._tasks.length;){if(t=Date.now(),this._tasks[this._i]()||this._i++,t=Math.max(1,Date.now()-t),i=Math.max(t,i),r=e.timeRemaining(),1.5*i>r)return s-t<-20&&console.warn(`task queue exceeded allotted deadline by ${Math.abs(Math.round(s-t))}ms`),void this._start();s=r}this.clear()}}class n extends r{_requestCallback(e){return setTimeout((()=>e(this._createDeadline(16))))}_cancelCallback(e){clearTimeout(e)}_createDeadline(e){const t=Date.now()+e;return{timeRemaining:()=>Math.max(0,t-Date.now())}}}t.PriorityTaskQueue=n,t.IdleTaskQueue=!s.isNode&&"requestIdleCallback"in window?class extends r{_requestCallback(e){return requestIdleCallback(e)}_cancelCallback(e){cancelIdleCallback(e)}}:n,t.DebouncedIdleTask=class{constructor(){this._queue=new t.IdleTaskQueue}set(e){this._queue.clear(),this._queue.enqueue(e)}flush(){this._queue.flush()}}},9282:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.updateWindowsModeWrappedState=void 0;const s=i(643);t.updateWindowsModeWrappedState=function(e){const t=e.buffer.lines.get(e.buffer.ybase+e.buffer.y-1),i=t?.get(e.cols-1),r=e.buffer.lines.get(e.buffer.ybase+e.buffer.y);r&&i&&(r.isWrapped=i[s.CHAR_DATA_CODE_INDEX]!==s.NULL_CELL_CODE&&i[s.CHAR_DATA_CODE_INDEX]!==s.WHITESPACE_CELL_CODE)}},3734:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.ExtendedAttrs=t.AttributeData=void 0;class i{constructor(){this.fg=0,this.bg=0,this.extended=new s}static toColorRGB(e){return[e>>>16&255,e>>>8&255,255&e]}static fromColorRGB(e){return(255&e[0])<<16|(255&e[1])<<8|255&e[2]}clone(){const e=new i;return e.fg=this.fg,e.bg=this.bg,e.extended=this.extended.clone(),e}isInverse(){return 67108864&this.fg}isBold(){return 134217728&this.fg}isUnderline(){return this.hasExtendedAttrs()&&0!==this.extended.underlineStyle?1:268435456&this.fg}isBlink(){return 536870912&this.fg}isInvisible(){return 1073741824&this.fg}isItalic(){return 67108864&this.bg}isDim(){return 134217728&this.bg}isStrikethrough(){return 2147483648&this.fg}isProtected(){return 536870912&this.bg}isOverline(){return 1073741824&this.bg}getFgColorMode(){return 50331648&this.fg}getBgColorMode(){return 50331648&this.bg}isFgRGB(){return 50331648==(50331648&this.fg)}isBgRGB(){return 50331648==(50331648&this.bg)}isFgPalette(){return 16777216==(50331648&this.fg)||33554432==(50331648&this.fg)}isBgPalette(){return 16777216==(50331648&this.bg)||33554432==(50331648&this.bg)}isFgDefault(){return 0==(50331648&this.fg)}isBgDefault(){return 0==(50331648&this.bg)}isAttributeDefault(){return 0===this.fg&&0===this.bg}getFgColor(){switch(50331648&this.fg){case 16777216:case 33554432:return 255&this.fg;case 50331648:return 16777215&this.fg;default:return-1}}getBgColor(){switch(50331648&this.bg){case 16777216:case 33554432:return 255&this.bg;case 50331648:return 16777215&this.bg;default:return-1}}hasExtendedAttrs(){return 268435456&this.bg}updateExtended(){this.extended.isEmpty()?this.bg&=-268435457:this.bg|=268435456}getUnderlineColor(){if(268435456&this.bg&&~this.extended.underlineColor)switch(50331648&this.extended.underlineColor){case 16777216:case 33554432:return 255&this.extended.underlineColor;case 50331648:return 16777215&this.extended.underlineColor;default:return this.getFgColor()}return this.getFgColor()}getUnderlineColorMode(){return 268435456&this.bg&&~this.extended.underlineColor?50331648&this.extended.underlineColor:this.getFgColorMode()}isUnderlineColorRGB(){return 268435456&this.bg&&~this.extended.underlineColor?50331648==(50331648&this.extended.underlineColor):this.isFgRGB()}isUnderlineColorPalette(){return 268435456&this.bg&&~this.extended.underlineColor?16777216==(50331648&this.extended.underlineColor)||33554432==(50331648&this.extended.underlineColor):this.isFgPalette()}isUnderlineColorDefault(){return 268435456&this.bg&&~this.extended.underlineColor?0==(50331648&this.extended.underlineColor):this.isFgDefault()}getUnderlineStyle(){return 268435456&this.fg?268435456&this.bg?this.extended.underlineStyle:1:0}getUnderlineVariantOffset(){return this.extended.underlineVariantOffset}}t.AttributeData=i;class s{get ext(){return this._urlId?-469762049&this._ext|this.underlineStyle<<26:this._ext}set ext(e){this._ext=e}get underlineStyle(){return this._urlId?5:(469762048&this._ext)>>26}set underlineStyle(e){this._ext&=-469762049,this._ext|=e<<26&469762048}get underlineColor(){return 67108863&this._ext}set underlineColor(e){this._ext&=-67108864,this._ext|=67108863&e}get urlId(){return this._urlId}set urlId(e){this._urlId=e}get underlineVariantOffset(){const e=(3758096384&this._ext)>>29;return e<0?4294967288^e:e}set underlineVariantOffset(e){this._ext&=536870911,this._ext|=e<<29&3758096384}constructor(e=0,t=0){this._ext=0,this._urlId=0,this._ext=e,this._urlId=t}clone(){return new s(this._ext,this._urlId)}isEmpty(){return 0===this.underlineStyle&&0===this._urlId}}t.ExtendedAttrs=s},9092:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.Buffer=t.MAX_BUFFER_SIZE=void 0;const s=i(6349),r=i(7226),n=i(3734),o=i(8437),a=i(4634),h=i(511),c=i(643),l=i(4863),d=i(7116);t.MAX_BUFFER_SIZE=4294967295,t.Buffer=class{constructor(e,t,i){this._hasScrollback=e,this._optionsService=t,this._bufferService=i,this.ydisp=0,this.ybase=0,this.y=0,this.x=0,this.tabs={},this.savedY=0,this.savedX=0,this.savedCurAttrData=o.DEFAULT_ATTR_DATA.clone(),this.savedCharset=d.DEFAULT_CHARSET,this.markers=[],this._nullCell=h.CellData.fromCharData([0,c.NULL_CELL_CHAR,c.NULL_CELL_WIDTH,c.NULL_CELL_CODE]),this._whitespaceCell=h.CellData.fromCharData([0,c.WHITESPACE_CELL_CHAR,c.WHITESPACE_CELL_WIDTH,c.WHITESPACE_CELL_CODE]),this._isClearing=!1,this._memoryCleanupQueue=new r.IdleTaskQueue,this._memoryCleanupPosition=0,this._cols=this._bufferService.cols,this._rows=this._bufferService.rows,this.lines=new s.CircularList(this._getCorrectBufferLength(this._rows)),this.scrollTop=0,this.scrollBottom=this._rows-1,this.setupTabStops()}getNullCell(e){return e?(this._nullCell.fg=e.fg,this._nullCell.bg=e.bg,this._nullCell.extended=e.extended):(this._nullCell.fg=0,this._nullCell.bg=0,this._nullCell.extended=new n.ExtendedAttrs),this._nullCell}getWhitespaceCell(e){return e?(this._whitespaceCell.fg=e.fg,this._whitespaceCell.bg=e.bg,this._whitespaceCell.extended=e.extended):(this._whitespaceCell.fg=0,this._whitespaceCell.bg=0,this._whitespaceCell.extended=new n.ExtendedAttrs),this._whitespaceCell}getBlankLine(e,t){return new o.BufferLine(this._bufferService.cols,this.getNullCell(e),t)}get hasScrollback(){return this._hasScrollback&&this.lines.maxLength>this._rows}get isCursorInViewport(){const e=this.ybase+this.y-this.ydisp;return e>=0&&e<this._rows}_getCorrectBufferLength(e){if(!this._hasScrollback)return e;const i=e+this._optionsService.rawOptions.scrollback;return i>t.MAX_BUFFER_SIZE?t.MAX_BUFFER_SIZE:i}fillViewportRows(e){if(0===this.lines.length){void 0===e&&(e=o.DEFAULT_ATTR_DATA);let t=this._rows;for(;t--;)this.lines.push(this.getBlankLine(e))}}clear(){this.ydisp=0,this.ybase=0,this.y=0,this.x=0,this.lines=new s.CircularList(this._getCorrectBufferLength(this._rows)),this.scrollTop=0,this.scrollBottom=this._rows-1,this.setupTabStops()}resize(e,t){const i=this.getNullCell(o.DEFAULT_ATTR_DATA);let s=0;const r=this._getCorrectBufferLength(t);if(r>this.lines.maxLength&&(this.lines.maxLength=r),this.lines.length>0){if(this._cols<e)for(let t=0;t<this.lines.length;t++)s+=+this.lines.get(t).resize(e,i);let n=0;if(this._rows<t)for(let s=this._rows;s<t;s++)this.lines.length<t+this.ybase&&(this._optionsService.rawOptions.windowsMode||void 0!==this._optionsService.rawOptions.windowsPty.backend||void 0!==this._optionsService.rawOptions.windowsPty.buildNumber?this.lines.push(new o.BufferLine(e,i)):this.ybase>0&&this.lines.length<=this.ybase+this.y+n+1?(this.ybase--,n++,this.ydisp>0&&this.ydisp--):this.lines.push(new o.BufferLine(e,i)));else for(let e=this._rows;e>t;e--)this.lines.length>t+this.ybase&&(this.lines.length>this.ybase+this.y+1?this.lines.pop():(this.ybase++,this.ydisp++));if(r<this.lines.maxLength){const e=this.lines.length-r;e>0&&(this.lines.trimStart(e),this.ybase=Math.max(this.ybase-e,0),this.ydisp=Math.max(this.ydisp-e,0),this.savedY=Math.max(this.savedY-e,0)),this.lines.maxLength=r}this.x=Math.min(this.x,e-1),this.y=Math.min(this.y,t-1),n&&(this.y+=n),this.savedX=Math.min(this.savedX,e-1),this.scrollTop=0}if(this.scrollBottom=t-1,this._isReflowEnabled&&(this._reflow(e,t),this._cols>e))for(let t=0;t<this.lines.length;t++)s+=+this.lines.get(t).resize(e,i);this._cols=e,this._rows=t,this._memoryCleanupQueue.clear(),s>.1*this.lines.length&&(this._memoryCleanupPosition=0,this._memoryCleanupQueue.enqueue((()=>this._batchedMemoryCleanup())))}_batchedMemoryCleanup(){let e=!0;this._memoryCleanupPosition>=this.lines.length&&(this._memoryCleanupPosition=0,e=!1);let t=0;for(;this._memoryCleanupPosition<this.lines.length;)if(t+=this.lines.get(this._memoryCleanupPosition++).cleanupMemory(),t>100)return!0;return e}get _isReflowEnabled(){const e=this._optionsService.rawOptions.windowsPty;return e&&e.buildNumber?this._hasScrollback&&"conpty"===e.backend&&e.buildNumber>=21376:this._hasScrollback&&!this._optionsService.rawOptions.windowsMode}_reflow(e,t){this._cols!==e&&(e>this._cols?this._reflowLarger(e,t):this._reflowSmaller(e,t))}_reflowLarger(e,t){const i=(0,a.reflowLargerGetLinesToRemove)(this.lines,this._cols,e,this.ybase+this.y,this.getNullCell(o.DEFAULT_ATTR_DATA));if(i.length>0){const s=(0,a.reflowLargerCreateNewLayout)(this.lines,i);(0,a.reflowLargerApplyNewLayout)(this.lines,s.layout),this._reflowLargerAdjustViewport(e,t,s.countRemoved)}}_reflowLargerAdjustViewport(e,t,i){const s=this.getNullCell(o.DEFAULT_ATTR_DATA);let r=i;for(;r-- >0;)0===this.ybase?(this.y>0&&this.y--,this.lines.length<t&&this.lines.push(new o.BufferLine(e,s))):(this.ydisp===this.ybase&&this.ydisp--,this.ybase--);this.savedY=Math.max(this.savedY-i,0)}_reflowSmaller(e,t){const i=this.getNullCell(o.DEFAULT_ATTR_DATA),s=[];let r=0;for(let n=this.lines.length-1;n>=0;n--){let h=this.lines.get(n);if(!h||!h.isWrapped&&h.getTrimmedLength()<=e)continue;const c=[h];for(;h.isWrapped&&n>0;)h=this.lines.get(--n),c.unshift(h);const l=this.ybase+this.y;if(l>=n&&l<n+c.length)continue;const d=c[c.length-1].getTrimmedLength(),_=(0,a.reflowSmallerGetNewLineLengths)(c,this._cols,e),u=_.length-c.length;let f;f=0===this.ybase&&this.y!==this.lines.length-1?Math.max(0,this.y-this.lines.maxLength+u):Math.max(0,this.lines.length-this.lines.maxLength+u);const v=[];for(let e=0;e<u;e++){const e=this.getBlankLine(o.DEFAULT_ATTR_DATA,!0);v.push(e)}v.length>0&&(s.push({start:n+c.length+r,newLines:v}),r+=v.length),c.push(...v);let p=_.length-1,g=_[p];0===g&&(p--,g=_[p]);let m=c.length-u-1,S=d;for(;m>=0;){const e=Math.min(S,g);if(void 0===c[p])break;if(c[p].copyCellsFrom(c[m],S-e,g-e,e,!0),g-=e,0===g&&(p--,g=_[p]),S-=e,0===S){m--;const e=Math.max(m,0);S=(0,a.getWrappedLineTrimmedLength)(c,e,this._cols)}}for(let t=0;t<c.length;t++)_[t]<e&&c[t].setCell(_[t],i);let C=u-f;for(;C-- >0;)0===this.ybase?this.y<t-1?(this.y++,this.lines.pop()):(this.ybase++,this.ydisp++):this.ybase<Math.min(this.lines.maxLength,this.lines.length+r)-t&&(this.ybase===this.ydisp&&this.ydisp++,this.ybase++);this.savedY=Math.min(this.savedY+u,this.ybase+t-1)}if(s.length>0){const e=[],t=[];for(let e=0;e<this.lines.length;e++)t.push(this.lines.get(e));const i=this.lines.length;let n=i-1,o=0,a=s[o];this.lines.length=Math.min(this.lines.maxLength,this.lines.length+r);let h=0;for(let c=Math.min(this.lines.maxLength-1,i+r-1);c>=0;c--)if(a&&a.start>n+h){for(let e=a.newLines.length-1;e>=0;e--)this.lines.set(c--,a.newLines[e]);c++,e.push({index:n+1,amount:a.newLines.length}),h+=a.newLines.length,a=s[++o]}else this.lines.set(c,t[n--]);let c=0;for(let t=e.length-1;t>=0;t--)e[t].index+=c,this.lines.onInsertEmitter.fire(e[t]),c+=e[t].amount;const l=Math.max(0,i+r-this.lines.maxLength);l>0&&this.lines.onTrimEmitter.fire(l)}}translateBufferLineToString(e,t,i=0,s){const r=this.lines.get(e);return r?r.translateToString(t,i,s):""}getWrappedRangeForLine(e){let t=e,i=e;for(;t>0&&this.lines.get(t).isWrapped;)t--;for(;i+1<this.lines.length&&this.lines.get(i+1).isWrapped;)i++;return{first:t,last:i}}setupTabStops(e){for(null!=e?this.tabs[e]||(e=this.prevStop(e)):(this.tabs={},e=0);e<this._cols;e+=this._optionsService.rawOptions.tabStopWidth)this.tabs[e]=!0}prevStop(e){for(null==e&&(e=this.x);!this.tabs[--e]&&e>0;);return e>=this._cols?this._cols-1:e<0?0:e}nextStop(e){for(null==e&&(e=this.x);!this.tabs[++e]&&e<this._cols;);return e>=this._cols?this._cols-1:e<0?0:e}clearMarkers(e){this._isClearing=!0;for(let t=0;t<this.markers.length;t++)this.markers[t].line===e&&(this.markers[t].dispose(),this.markers.splice(t--,1));this._isClearing=!1}clearAllMarkers(){this._isClearing=!0;for(let e=0;e<this.markers.length;e++)this.markers[e].dispose(),this.markers.splice(e--,1);this._isClearing=!1}addMarker(e){const t=new l.Marker(e);return this.markers.push(t),t.register(this.lines.onTrim((e=>{t.line-=e,t.line<0&&t.dispose()}))),t.register(this.lines.onInsert((e=>{t.line>=e.index&&(t.line+=e.amount)}))),t.register(this.lines.onDelete((e=>{t.line>=e.index&&t.line<e.index+e.amount&&t.dispose(),t.line>e.index&&(t.line-=e.amount)}))),t.register(t.onDispose((()=>this._removeMarker(t)))),t}_removeMarker(e){this._isClearing||this.markers.splice(this.markers.indexOf(e),1)}}},8437:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.BufferLine=t.DEFAULT_ATTR_DATA=void 0;const s=i(3734),r=i(511),n=i(643),o=i(482);t.DEFAULT_ATTR_DATA=Object.freeze(new s.AttributeData);let a=0;class h{constructor(e,t,i=!1){this.isWrapped=i,this._combined={},this._extendedAttrs={},this._data=new Uint32Array(3*e);const s=t||r.CellData.fromCharData([0,n.NULL_CELL_CHAR,n.NULL_CELL_WIDTH,n.NULL_CELL_CODE]);for(let t=0;t<e;++t)this.setCell(t,s);this.length=e}get(e){const t=this._data[3*e+0],i=2097151&t;return[this._data[3*e+1],2097152&t?this._combined[e]:i?(0,o.stringFromCodePoint)(i):"",t>>22,2097152&t?this._combined[e].charCodeAt(this._combined[e].length-1):i]}set(e,t){this._data[3*e+1]=t[n.CHAR_DATA_ATTR_INDEX],t[n.CHAR_DATA_CHAR_INDEX].length>1?(this._combined[e]=t[1],this._data[3*e+0]=2097152|e|t[n.CHAR_DATA_WIDTH_INDEX]<<22):this._data[3*e+0]=t[n.CHAR_DATA_CHAR_INDEX].charCodeAt(0)|t[n.CHAR_DATA_WIDTH_INDEX]<<22}getWidth(e){return this._data[3*e+0]>>22}hasWidth(e){return 12582912&this._data[3*e+0]}getFg(e){return this._data[3*e+1]}getBg(e){return this._data[3*e+2]}hasContent(e){return 4194303&this._data[3*e+0]}getCodePoint(e){const t=this._data[3*e+0];return 2097152&t?this._combined[e].charCodeAt(this._combined[e].length-1):2097151&t}isCombined(e){return 2097152&this._data[3*e+0]}getString(e){const t=this._data[3*e+0];return 2097152&t?this._combined[e]:2097151&t?(0,o.stringFromCodePoint)(2097151&t):""}isProtected(e){return 536870912&this._data[3*e+2]}loadCell(e,t){return a=3*e,t.content=this._data[a+0],t.fg=this._data[a+1],t.bg=this._data[a+2],2097152&t.content&&(t.combinedData=this._combined[e]),268435456&t.bg&&(t.extended=this._extendedAttrs[e]),t}setCell(e,t){2097152&t.content&&(this._combined[e]=t.combinedData),268435456&t.bg&&(this._extendedAttrs[e]=t.extended),this._data[3*e+0]=t.content,this._data[3*e+1]=t.fg,this._data[3*e+2]=t.bg}setCellFromCodepoint(e,t,i,s){268435456&s.bg&&(this._extendedAttrs[e]=s.extended),this._data[3*e+0]=t|i<<22,this._data[3*e+1]=s.fg,this._data[3*e+2]=s.bg}addCodepointToCell(e,t,i){let s=this._data[3*e+0];2097152&s?this._combined[e]+=(0,o.stringFromCodePoint)(t):2097151&s?(this._combined[e]=(0,o.stringFromCodePoint)(2097151&s)+(0,o.stringFromCodePoint)(t),s&=-2097152,s|=2097152):s=t|1<<22,i&&(s&=-12582913,s|=i<<22),this._data[3*e+0]=s}insertCells(e,t,i){if((e%=this.length)&&2===this.getWidth(e-1)&&this.setCellFromCodepoint(e-1,0,1,i),t<this.length-e){const s=new r.CellData;for(let i=this.length-e-t-1;i>=0;--i)this.setCell(e+t+i,this.loadCell(e+i,s));for(let s=0;s<t;++s)this.setCell(e+s,i)}else for(let t=e;t<this.length;++t)this.setCell(t,i);2===this.getWidth(this.length-1)&&this.setCellFromCodepoint(this.length-1,0,1,i)}deleteCells(e,t,i){if(e%=this.length,t<this.length-e){const s=new r.CellData;for(let i=0;i<this.length-e-t;++i)this.setCell(e+i,this.loadCell(e+t+i,s));for(let e=this.length-t;e<this.length;++e)this.setCell(e,i)}else for(let t=e;t<this.length;++t)this.setCell(t,i);e&&2===this.getWidth(e-1)&&this.setCellFromCodepoint(e-1,0,1,i),0!==this.getWidth(e)||this.hasContent(e)||this.setCellFromCodepoint(e,0,1,i)}replaceCells(e,t,i,s=!1){if(s)for(e&&2===this.getWidth(e-1)&&!this.isProtected(e-1)&&this.setCellFromCodepoint(e-1,0,1,i),t<this.length&&2===this.getWidth(t-1)&&!this.isProtected(t)&&this.setCellFromCodepoint(t,0,1,i);e<t&&e<this.length;)this.isProtected(e)||this.setCell(e,i),e++;else for(e&&2===this.getWidth(e-1)&&this.setCellFromCodepoint(e-1,0,1,i),t<this.length&&2===this.getWidth(t-1)&&this.setCellFromCodepoint(t,0,1,i);e<t&&e<this.length;)this.setCell(e++,i)}resize(e,t){if(e===this.length)return 4*this._data.length*2<this._data.buffer.byteLength;const i=3*e;if(e>this.length){if(this._data.buffer.byteLength>=4*i)this._data=new Uint32Array(this._data.buffer,0,i);else{const e=new Uint32Array(i);e.set(this._data),this._data=e}for(let i=this.length;i<e;++i)this.setCell(i,t)}else{this._data=this._data.subarray(0,i);const t=Object.keys(this._combined);for(let i=0;i<t.length;i++){const s=parseInt(t[i],10);s>=e&&delete this._combined[s]}const s=Object.keys(this._extendedAttrs);for(let t=0;t<s.length;t++){const i=parseInt(s[t],10);i>=e&&delete this._extendedAttrs[i]}}return this.length=e,4*i*2<this._data.buffer.byteLength}cleanupMemory(){if(4*this._data.length*2<this._data.buffer.byteLength){const e=new Uint32Array(this._data.length);return e.set(this._data),this._data=e,1}return 0}fill(e,t=!1){if(t)for(let t=0;t<this.length;++t)this.isProtected(t)||this.setCell(t,e);else{this._combined={},this._extendedAttrs={};for(let t=0;t<this.length;++t)this.setCell(t,e)}}copyFrom(e){this.length!==e.length?this._data=new Uint32Array(e._data):this._data.set(e._data),this.length=e.length,this._combined={};for(const t in e._combined)this._combined[t]=e._combined[t];this._extendedAttrs={};for(const t in e._extendedAttrs)this._extendedAttrs[t]=e._extendedAttrs[t];this.isWrapped=e.isWrapped}clone(){const e=new h(0);e._data=new Uint32Array(this._data),e.length=this.length;for(const t in this._combined)e._combined[t]=this._combined[t];for(const t in this._extendedAttrs)e._extendedAttrs[t]=this._extendedAttrs[t];return e.isWrapped=this.isWrapped,e}getTrimmedLength(){for(let e=this.length-1;e>=0;--e)if(4194303&this._data[3*e+0])return e+(this._data[3*e+0]>>22);return 0}getNoBgTrimmedLength(){for(let e=this.length-1;e>=0;--e)if(4194303&this._data[3*e+0]||50331648&this._data[3*e+2])return e+(this._data[3*e+0]>>22);return 0}copyCellsFrom(e,t,i,s,r){const n=e._data;if(r)for(let r=s-1;r>=0;r--){for(let e=0;e<3;e++)this._data[3*(i+r)+e]=n[3*(t+r)+e];268435456&n[3*(t+r)+2]&&(this._extendedAttrs[i+r]=e._extendedAttrs[t+r])}else for(let r=0;r<s;r++){for(let e=0;e<3;e++)this._data[3*(i+r)+e]=n[3*(t+r)+e];268435456&n[3*(t+r)+2]&&(this._extendedAttrs[i+r]=e._extendedAttrs[t+r])}const o=Object.keys(e._combined);for(let s=0;s<o.length;s++){const r=parseInt(o[s],10);r>=t&&(this._combined[r-t+i]=e._combined[r])}}translateToString(e,t,i,s){t=t??0,i=i??this.length,e&&(i=Math.min(i,this.getTrimmedLength())),s&&(s.length=0);let r="";for(;t<i;){const e=this._data[3*t+0],i=2097151&e,a=2097152&e?this._combined[t]:i?(0,o.stringFromCodePoint)(i):n.WHITESPACE_CELL_CHAR;if(r+=a,s)for(let e=0;e<a.length;++e)s.push(t);t+=e>>22||1}return s&&s.push(t),r}}t.BufferLine=h},4841:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.getRangeLength=void 0,t.getRangeLength=function(e,t){if(e.start.y>e.end.y)throw new Error(`Buffer range end (${e.end.x}, ${e.end.y}) cannot be before start (${e.start.x}, ${e.start.y})`);return t*(e.end.y-e.start.y)+(e.end.x-e.start.x+1)}},4634:(e,t)=>{function i(e,t,i){if(t===e.length-1)return e[t].getTrimmedLength();const s=!e[t].hasContent(i-1)&&1===e[t].getWidth(i-1),r=2===e[t+1].getWidth(0);return s&&r?i-1:i}Object.defineProperty(t,"__esModule",{value:!0}),t.getWrappedLineTrimmedLength=t.reflowSmallerGetNewLineLengths=t.reflowLargerApplyNewLayout=t.reflowLargerCreateNewLayout=t.reflowLargerGetLinesToRemove=void 0,t.reflowLargerGetLinesToRemove=function(e,t,s,r,n){const o=[];for(let a=0;a<e.length-1;a++){let h=a,c=e.get(++h);if(!c.isWrapped)continue;const l=[e.get(a)];for(;h<e.length&&c.isWrapped;)l.push(c),c=e.get(++h);if(r>=a&&r<h){a+=l.length-1;continue}let d=0,_=i(l,d,t),u=1,f=0;for(;u<l.length;){const e=i(l,u,t),r=e-f,o=s-_,a=Math.min(r,o);l[d].copyCellsFrom(l[u],f,_,a,!1),_+=a,_===s&&(d++,_=0),f+=a,f===e&&(u++,f=0),0===_&&0!==d&&2===l[d-1].getWidth(s-1)&&(l[d].copyCellsFrom(l[d-1],s-1,_++,1,!1),l[d-1].setCell(s-1,n))}l[d].replaceCells(_,s,n);let v=0;for(let e=l.length-1;e>0&&(e>d||0===l[e].getTrimmedLength());e--)v++;v>0&&(o.push(a+l.length-v),o.push(v)),a+=l.length-1}return o},t.reflowLargerCreateNewLayout=function(e,t){const i=[];let s=0,r=t[s],n=0;for(let o=0;o<e.length;o++)if(r===o){const i=t[++s];e.onDeleteEmitter.fire({index:o-n,amount:i}),o+=i-1,n+=i,r=t[++s]}else i.push(o);return{layout:i,countRemoved:n}},t.reflowLargerApplyNewLayout=function(e,t){const i=[];for(let s=0;s<t.length;s++)i.push(e.get(t[s]));for(let t=0;t<i.length;t++)e.set(t,i[t]);e.length=t.length},t.reflowSmallerGetNewLineLengths=function(e,t,s){const r=[],n=e.map(((s,r)=>i(e,r,t))).reduce(((e,t)=>e+t));let o=0,a=0,h=0;for(;h<n;){if(n-h<s){r.push(n-h);break}o+=s;const c=i(e,a,t);o>c&&(o-=c,a++);const l=2===e[a].getWidth(o-1);l&&o--;const d=l?s-1:s;r.push(d),h+=d}return r},t.getWrappedLineTrimmedLength=i},5295:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.BufferSet=void 0;const s=i(8460),r=i(844),n=i(9092);class o extends r.Disposable{constructor(e,t){super(),this._optionsService=e,this._bufferService=t,this._onBufferActivate=this.register(new s.EventEmitter),this.onBufferActivate=this._onBufferActivate.event,this.reset(),this.register(this._optionsService.onSpecificOptionChange("scrollback",(()=>this.resize(this._bufferService.cols,this._bufferService.rows)))),this.register(this._optionsService.onSpecificOptionChange("tabStopWidth",(()=>this.setupTabStops())))}reset(){this._normal=new n.Buffer(!0,this._optionsService,this._bufferService),this._normal.fillViewportRows(),this._alt=new n.Buffer(!1,this._optionsService,this._bufferService),this._activeBuffer=this._normal,this._onBufferActivate.fire({activeBuffer:this._normal,inactiveBuffer:this._alt}),this.setupTabStops()}get alt(){return this._alt}get active(){return this._activeBuffer}get normal(){return this._normal}activateNormalBuffer(){this._activeBuffer!==this._normal&&(this._normal.x=this._alt.x,this._normal.y=this._alt.y,this._alt.clearAllMarkers(),this._alt.clear(),this._activeBuffer=this._normal,this._onBufferActivate.fire({activeBuffer:this._normal,inactiveBuffer:this._alt}))}activateAltBuffer(e){this._activeBuffer!==this._alt&&(this._alt.fillViewportRows(e),this._alt.x=this._normal.x,this._alt.y=this._normal.y,this._activeBuffer=this._alt,this._onBufferActivate.fire({activeBuffer:this._alt,inactiveBuffer:this._normal}))}resize(e,t){this._normal.resize(e,t),this._alt.resize(e,t),this.setupTabStops(e)}setupTabStops(e){this._normal.setupTabStops(e),this._alt.setupTabStops(e)}}t.BufferSet=o},511:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.CellData=void 0;const s=i(482),r=i(643),n=i(3734);class o extends n.AttributeData{constructor(){super(...arguments),this.content=0,this.fg=0,this.bg=0,this.extended=new n.ExtendedAttrs,this.combinedData=""}static fromCharData(e){const t=new o;return t.setFromCharData(e),t}isCombined(){return 2097152&this.content}getWidth(){return this.content>>22}getChars(){return 2097152&this.content?this.combinedData:2097151&this.content?(0,s.stringFromCodePoint)(2097151&this.content):""}getCode(){return this.isCombined()?this.combinedData.charCodeAt(this.combinedData.length-1):2097151&this.content}setFromCharData(e){this.fg=e[r.CHAR_DATA_ATTR_INDEX],this.bg=0;let t=!1;if(e[r.CHAR_DATA_CHAR_INDEX].length>2)t=!0;else if(2===e[r.CHAR_DATA_CHAR_INDEX].length){const i=e[r.CHAR_DATA_CHAR_INDEX].charCodeAt(0);if(55296<=i&&i<=56319){const s=e[r.CHAR_DATA_CHAR_INDEX].charCodeAt(1);56320<=s&&s<=57343?this.content=1024*(i-55296)+s-56320+65536|e[r.CHAR_DATA_WIDTH_INDEX]<<22:t=!0}else t=!0}else this.content=e[r.CHAR_DATA_CHAR_INDEX].charCodeAt(0)|e[r.CHAR_DATA_WIDTH_INDEX]<<22;t&&(this.combinedData=e[r.CHAR_DATA_CHAR_INDEX],this.content=2097152|e[r.CHAR_DATA_WIDTH_INDEX]<<22)}getAsCharData(){return[this.fg,this.getChars(),this.getWidth(),this.getCode()]}}t.CellData=o},643:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.WHITESPACE_CELL_CODE=t.WHITESPACE_CELL_WIDTH=t.WHITESPACE_CELL_CHAR=t.NULL_CELL_CODE=t.NULL_CELL_WIDTH=t.NULL_CELL_CHAR=t.CHAR_DATA_CODE_INDEX=t.CHAR_DATA_WIDTH_INDEX=t.CHAR_DATA_CHAR_INDEX=t.CHAR_DATA_ATTR_INDEX=t.DEFAULT_EXT=t.DEFAULT_ATTR=t.DEFAULT_COLOR=void 0,t.DEFAULT_COLOR=0,t.DEFAULT_ATTR=256|t.DEFAULT_COLOR<<9,t.DEFAULT_EXT=0,t.CHAR_DATA_ATTR_INDEX=0,t.CHAR_DATA_CHAR_INDEX=1,t.CHAR_DATA_WIDTH_INDEX=2,t.CHAR_DATA_CODE_INDEX=3,t.NULL_CELL_CHAR="",t.NULL_CELL_WIDTH=1,t.NULL_CELL_CODE=0,t.WHITESPACE_CELL_CHAR=" ",t.WHITESPACE_CELL_WIDTH=1,t.WHITESPACE_CELL_CODE=32},4863:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.Marker=void 0;const s=i(8460),r=i(844);class n{get id(){return this._id}constructor(e){this.line=e,this.isDisposed=!1,this._disposables=[],this._id=n._nextId++,this._onDispose=this.register(new s.EventEmitter),this.onDispose=this._onDispose.event}dispose(){this.isDisposed||(this.isDisposed=!0,this.line=-1,this._onDispose.fire(),(0,r.disposeArray)(this._disposables),this._disposables.length=0)}register(e){return this._disposables.push(e),e}}t.Marker=n,n._nextId=1},7116:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.DEFAULT_CHARSET=t.CHARSETS=void 0,t.CHARSETS={},t.DEFAULT_CHARSET=t.CHARSETS.B,t.CHARSETS[0]={"`":"\u25C6",a:"\u2592",b:"\u2409",c:"\u240C",d:"\u240D",e:"\u240A",f:"\xB0",g:"\xB1",h:"\u2424",i:"\u240B",j:"\u2518",k:"\u2510",l:"\u250C",m:"\u2514",n:"\u253C",o:"\u23BA",p:"\u23BB",q:"\u2500",r:"\u23BC",s:"\u23BD",t:"\u251C",u:"\u2524",v:"\u2534",w:"\u252C",x:"\u2502",y:"\u2264",z:"\u2265","{":"\u03C0","|":"\u2260","}":"\xA3","~":"\xB7"},t.CHARSETS.A={"#":"\xA3"},t.CHARSETS.B=void 0,t.CHARSETS[4]={"#":"\xA3","@":"\xBE","[":"ij","\\\\":"\xBD","]":"|","{":"\xA8","|":"f","}":"\xBC","~":"\xB4"},t.CHARSETS.C=t.CHARSETS[5]={"[":"\xC4","\\\\":"\xD6","]":"\xC5","^":"\xDC","`":"\xE9","{":"\xE4","|":"\xF6","}":"\xE5","~":"\xFC"},t.CHARSETS.R={"#":"\xA3","@":"\xE0","[":"\xB0","\\\\":"\xE7","]":"\xA7","{":"\xE9","|":"\xF9","}":"\xE8","~":"\xA8"},t.CHARSETS.Q={"@":"\xE0","[":"\xE2","\\\\":"\xE7","]":"\xEA","^":"\xEE","`":"\xF4","{":"\xE9","|":"\xF9","}":"\xE8","~":"\xFB"},t.CHARSETS.K={"@":"\xA7","[":"\xC4","\\\\":"\xD6","]":"\xDC","{":"\xE4","|":"\xF6","}":"\xFC","~":"\xDF"},t.CHARSETS.Y={"#":"\xA3","@":"\xA7","[":"\xB0","\\\\":"\xE7","]":"\xE9","`":"\xF9","{":"\xE0","|":"\xF2","}":"\xE8","~":"\xEC"},t.CHARSETS.E=t.CHARSETS[6]={"@":"\xC4","[":"\xC6","\\\\":"\xD8","]":"\xC5","^":"\xDC","`":"\xE4","{":"\xE6","|":"\xF8","}":"\xE5","~":"\xFC"},t.CHARSETS.Z={"#":"\xA3","@":"\xA7","[":"\xA1","\\\\":"\xD1","]":"\xBF","{":"\xB0","|":"\xF1","}":"\xE7"},t.CHARSETS.H=t.CHARSETS[7]={"@":"\xC9","[":"\xC4","\\\\":"\xD6","]":"\xC5","^":"\xDC","`":"\xE9","{":"\xE4","|":"\xF6","}":"\xE5","~":"\xFC"},t.CHARSETS["="]={"#":"\xF9","@":"\xE0","[":"\xE9","\\\\":"\xE7","]":"\xEA","^":"\xEE",_:"\xE8","`":"\xF4","{":"\xE4","|":"\xF6","}":"\xFC","~":"\xFB"}},2584:(e,t)=>{var i,s,r;Object.defineProperty(t,"__esModule",{value:!0}),t.C1_ESCAPED=t.C1=t.C0=void 0,function(e){e.NUL="\\0",e.SOH="",e.STX="",e.ETX="",e.EOT="",e.ENQ="",e.ACK="",e.BEL="\x07",e.BS="\\b",e.HT="\\t",e.LF="\\n",e.VT="\\v",e.FF="\\f",e.CR="\\r",e.SO="",e.SI="",e.DLE="",e.DC1="",e.DC2="",e.DC3="",e.DC4="",e.NAK="",e.SYN="",e.ETB="",e.CAN="",e.EM="",e.SUB="",e.ESC="\x1B",e.FS="",e.GS="",e.RS="",e.US="",e.SP=" ",e.DEL="\x7F"}(i||(t.C0=i={})),function(e){e.PAD="\x80",e.HOP="\x81",e.BPH="\x82",e.NBH="\x83",e.IND="\x84",e.NEL="\x85",e.SSA="\x86",e.ESA="\x87",e.HTS="\x88",e.HTJ="\x89",e.VTS="\x8A",e.PLD="\x8B",e.PLU="\x8C",e.RI="\x8D",e.SS2="\x8E",e.SS3="\x8F",e.DCS="\x90",e.PU1="\x91",e.PU2="\x92",e.STS="\x93",e.CCH="\x94",e.MW="\x95",e.SPA="\x96",e.EPA="\x97",e.SOS="\x98",e.SGCI="\x99",e.SCI="\x9A",e.CSI="\x9B",e.ST="\x9C",e.OSC="\x9D",e.PM="\x9E",e.APC="\x9F"}(s||(t.C1=s={})),function(e){e.ST=`${i.ESC}\\\\`}(r||(t.C1_ESCAPED=r={}))},7399:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.evaluateKeyboardEvent=void 0;const s=i(2584),r={48:["0",")"],49:["1","!"],50:["2","@"],51:["3","#"],52:["4","$"],53:["5","%"],54:["6","^"],55:["7","&"],56:["8","*"],57:["9","("],186:[";",":"],187:["=","+"],188:[",","<"],189:["-","_"],190:[".",">"],191:["/","?"],192:["`","~"],219:["[","{"],220:["\\\\","|"],221:["]","}"],222:["\'",\'"\']};t.evaluateKeyboardEvent=function(e,t,i,n){const o={type:0,cancel:!1,key:void 0},a=(e.shiftKey?1:0)|(e.altKey?2:0)|(e.ctrlKey?4:0)|(e.metaKey?8:0);switch(e.keyCode){case 0:"UIKeyInputUpArrow"===e.key?o.key=t?s.C0.ESC+"OA":s.C0.ESC+"[A":"UIKeyInputLeftArrow"===e.key?o.key=t?s.C0.ESC+"OD":s.C0.ESC+"[D":"UIKeyInputRightArrow"===e.key?o.key=t?s.C0.ESC+"OC":s.C0.ESC+"[C":"UIKeyInputDownArrow"===e.key&&(o.key=t?s.C0.ESC+"OB":s.C0.ESC+"[B");break;case 8:o.key=e.ctrlKey?"\\b":s.C0.DEL,e.altKey&&(o.key=s.C0.ESC+o.key);break;case 9:if(e.shiftKey){o.key=s.C0.ESC+"[Z";break}o.key=s.C0.HT,o.cancel=!0;break;case 13:o.key=e.altKey?s.C0.ESC+s.C0.CR:s.C0.CR,o.cancel=!0;break;case 27:o.key=s.C0.ESC,e.altKey&&(o.key=s.C0.ESC+s.C0.ESC),o.cancel=!0;break;case 37:if(e.metaKey)break;a?(o.key=s.C0.ESC+"[1;"+(a+1)+"D",o.key===s.C0.ESC+"[1;3D"&&(o.key=s.C0.ESC+(i?"b":"[1;5D"))):o.key=t?s.C0.ESC+"OD":s.C0.ESC+"[D";break;case 39:if(e.metaKey)break;a?(o.key=s.C0.ESC+"[1;"+(a+1)+"C",o.key===s.C0.ESC+"[1;3C"&&(o.key=s.C0.ESC+(i?"f":"[1;5C"))):o.key=t?s.C0.ESC+"OC":s.C0.ESC+"[C";break;case 38:if(e.metaKey)break;a?(o.key=s.C0.ESC+"[1;"+(a+1)+"A",i||o.key!==s.C0.ESC+"[1;3A"||(o.key=s.C0.ESC+"[1;5A")):o.key=t?s.C0.ESC+"OA":s.C0.ESC+"[A";break;case 40:if(e.metaKey)break;a?(o.key=s.C0.ESC+"[1;"+(a+1)+"B",i||o.key!==s.C0.ESC+"[1;3B"||(o.key=s.C0.ESC+"[1;5B")):o.key=t?s.C0.ESC+"OB":s.C0.ESC+"[B";break;case 45:e.shiftKey||e.ctrlKey||(o.key=s.C0.ESC+"[2~");break;case 46:o.key=a?s.C0.ESC+"[3;"+(a+1)+"~":s.C0.ESC+"[3~";break;case 36:o.key=a?s.C0.ESC+"[1;"+(a+1)+"H":t?s.C0.ESC+"OH":s.C0.ESC+"[H";break;case 35:o.key=a?s.C0.ESC+"[1;"+(a+1)+"F":t?s.C0.ESC+"OF":s.C0.ESC+"[F";break;case 33:e.shiftKey?o.type=2:e.ctrlKey?o.key=s.C0.ESC+"[5;"+(a+1)+"~":o.key=s.C0.ESC+"[5~";break;case 34:e.shiftKey?o.type=3:e.ctrlKey?o.key=s.C0.ESC+"[6;"+(a+1)+"~":o.key=s.C0.ESC+"[6~";break;case 112:o.key=a?s.C0.ESC+"[1;"+(a+1)+"P":s.C0.ESC+"OP";break;case 113:o.key=a?s.C0.ESC+"[1;"+(a+1)+"Q":s.C0.ESC+"OQ";break;case 114:o.key=a?s.C0.ESC+"[1;"+(a+1)+"R":s.C0.ESC+"OR";break;case 115:o.key=a?s.C0.ESC+"[1;"+(a+1)+"S":s.C0.ESC+"OS";break;case 116:o.key=a?s.C0.ESC+"[15;"+(a+1)+"~":s.C0.ESC+"[15~";break;case 117:o.key=a?s.C0.ESC+"[17;"+(a+1)+"~":s.C0.ESC+"[17~";break;case 118:o.key=a?s.C0.ESC+"[18;"+(a+1)+"~":s.C0.ESC+"[18~";break;case 119:o.key=a?s.C0.ESC+"[19;"+(a+1)+"~":s.C0.ESC+"[19~";break;case 120:o.key=a?s.C0.ESC+"[20;"+(a+1)+"~":s.C0.ESC+"[20~";break;case 121:o.key=a?s.C0.ESC+"[21;"+(a+1)+"~":s.C0.ESC+"[21~";break;case 122:o.key=a?s.C0.ESC+"[23;"+(a+1)+"~":s.C0.ESC+"[23~";break;case 123:o.key=a?s.C0.ESC+"[24;"+(a+1)+"~":s.C0.ESC+"[24~";break;default:if(!e.ctrlKey||e.shiftKey||e.altKey||e.metaKey)if(i&&!n||!e.altKey||e.metaKey)!i||e.altKey||e.ctrlKey||e.shiftKey||!e.metaKey?e.key&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&e.keyCode>=48&&1===e.key.length?o.key=e.key:e.key&&e.ctrlKey&&("_"===e.key&&(o.key=s.C0.US),"@"===e.key&&(o.key=s.C0.NUL)):65===e.keyCode&&(o.type=1);else{const t=r[e.keyCode],i=t?.[e.shiftKey?1:0];if(i)o.key=s.C0.ESC+i;else if(e.keyCode>=65&&e.keyCode<=90){const t=e.ctrlKey?e.keyCode-64:e.keyCode+32;let i=String.fromCharCode(t);e.shiftKey&&(i=i.toUpperCase()),o.key=s.C0.ESC+i}else if(32===e.keyCode)o.key=s.C0.ESC+(e.ctrlKey?s.C0.NUL:" ");else if("Dead"===e.key&&e.code.startsWith("Key")){let t=e.code.slice(3,4);e.shiftKey||(t=t.toLowerCase()),o.key=s.C0.ESC+t,o.cancel=!0}}else e.keyCode>=65&&e.keyCode<=90?o.key=String.fromCharCode(e.keyCode-64):32===e.keyCode?o.key=s.C0.NUL:e.keyCode>=51&&e.keyCode<=55?o.key=String.fromCharCode(e.keyCode-51+27):56===e.keyCode?o.key=s.C0.DEL:219===e.keyCode?o.key=s.C0.ESC:220===e.keyCode?o.key=s.C0.FS:221===e.keyCode&&(o.key=s.C0.GS)}return o}},482:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.Utf8ToUtf32=t.StringToUtf32=t.utf32ToString=t.stringFromCodePoint=void 0,t.stringFromCodePoint=function(e){return e>65535?(e-=65536,String.fromCharCode(55296+(e>>10))+String.fromCharCode(e%1024+56320)):String.fromCharCode(e)},t.utf32ToString=function(e,t=0,i=e.length){let s="";for(let r=t;r<i;++r){let t=e[r];t>65535?(t-=65536,s+=String.fromCharCode(55296+(t>>10))+String.fromCharCode(t%1024+56320)):s+=String.fromCharCode(t)}return s},t.StringToUtf32=class{constructor(){this._interim=0}clear(){this._interim=0}decode(e,t){const i=e.length;if(!i)return 0;let s=0,r=0;if(this._interim){const i=e.charCodeAt(r++);56320<=i&&i<=57343?t[s++]=1024*(this._interim-55296)+i-56320+65536:(t[s++]=this._interim,t[s++]=i),this._interim=0}for(let n=r;n<i;++n){const r=e.charCodeAt(n);if(55296<=r&&r<=56319){if(++n>=i)return this._interim=r,s;const o=e.charCodeAt(n);56320<=o&&o<=57343?t[s++]=1024*(r-55296)+o-56320+65536:(t[s++]=r,t[s++]=o)}else 65279!==r&&(t[s++]=r)}return s}},t.Utf8ToUtf32=class{constructor(){this.interim=new Uint8Array(3)}clear(){this.interim.fill(0)}decode(e,t){const i=e.length;if(!i)return 0;let s,r,n,o,a=0,h=0,c=0;if(this.interim[0]){let s=!1,r=this.interim[0];r&=192==(224&r)?31:224==(240&r)?15:7;let n,o=0;for(;(n=63&this.interim[++o])&&o<4;)r<<=6,r|=n;const h=192==(224&this.interim[0])?2:224==(240&this.interim[0])?3:4,l=h-o;for(;c<l;){if(c>=i)return 0;if(n=e[c++],128!=(192&n)){c--,s=!0;break}this.interim[o++]=n,r<<=6,r|=63&n}s||(2===h?r<128?c--:t[a++]=r:3===h?r<2048||r>=55296&&r<=57343||65279===r||(t[a++]=r):r<65536||r>1114111||(t[a++]=r)),this.interim.fill(0)}const l=i-4;let d=c;for(;d<i;){for(;!(!(d<l)||128&(s=e[d])||128&(r=e[d+1])||128&(n=e[d+2])||128&(o=e[d+3]));)t[a++]=s,t[a++]=r,t[a++]=n,t[a++]=o,d+=4;if(s=e[d++],s<128)t[a++]=s;else if(192==(224&s)){if(d>=i)return this.interim[0]=s,a;if(r=e[d++],128!=(192&r)){d--;continue}if(h=(31&s)<<6|63&r,h<128){d--;continue}t[a++]=h}else if(224==(240&s)){if(d>=i)return this.interim[0]=s,a;if(r=e[d++],128!=(192&r)){d--;continue}if(d>=i)return this.interim[0]=s,this.interim[1]=r,a;if(n=e[d++],128!=(192&n)){d--;continue}if(h=(15&s)<<12|(63&r)<<6|63&n,h<2048||h>=55296&&h<=57343||65279===h)continue;t[a++]=h}else if(240==(248&s)){if(d>=i)return this.interim[0]=s,a;if(r=e[d++],128!=(192&r)){d--;continue}if(d>=i)return this.interim[0]=s,this.interim[1]=r,a;if(n=e[d++],128!=(192&n)){d--;continue}if(d>=i)return this.interim[0]=s,this.interim[1]=r,this.interim[2]=n,a;if(o=e[d++],128!=(192&o)){d--;continue}if(h=(7&s)<<18|(63&r)<<12|(63&n)<<6|63&o,h<65536||h>1114111)continue;t[a++]=h}}return a}}},225:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.UnicodeV6=void 0;const s=i(1480),r=[[768,879],[1155,1158],[1160,1161],[1425,1469],[1471,1471],[1473,1474],[1476,1477],[1479,1479],[1536,1539],[1552,1557],[1611,1630],[1648,1648],[1750,1764],[1767,1768],[1770,1773],[1807,1807],[1809,1809],[1840,1866],[1958,1968],[2027,2035],[2305,2306],[2364,2364],[2369,2376],[2381,2381],[2385,2388],[2402,2403],[2433,2433],[2492,2492],[2497,2500],[2509,2509],[2530,2531],[2561,2562],[2620,2620],[2625,2626],[2631,2632],[2635,2637],[2672,2673],[2689,2690],[2748,2748],[2753,2757],[2759,2760],[2765,2765],[2786,2787],[2817,2817],[2876,2876],[2879,2879],[2881,2883],[2893,2893],[2902,2902],[2946,2946],[3008,3008],[3021,3021],[3134,3136],[3142,3144],[3146,3149],[3157,3158],[3260,3260],[3263,3263],[3270,3270],[3276,3277],[3298,3299],[3393,3395],[3405,3405],[3530,3530],[3538,3540],[3542,3542],[3633,3633],[3636,3642],[3655,3662],[3761,3761],[3764,3769],[3771,3772],[3784,3789],[3864,3865],[3893,3893],[3895,3895],[3897,3897],[3953,3966],[3968,3972],[3974,3975],[3984,3991],[3993,4028],[4038,4038],[4141,4144],[4146,4146],[4150,4151],[4153,4153],[4184,4185],[4448,4607],[4959,4959],[5906,5908],[5938,5940],[5970,5971],[6002,6003],[6068,6069],[6071,6077],[6086,6086],[6089,6099],[6109,6109],[6155,6157],[6313,6313],[6432,6434],[6439,6440],[6450,6450],[6457,6459],[6679,6680],[6912,6915],[6964,6964],[6966,6970],[6972,6972],[6978,6978],[7019,7027],[7616,7626],[7678,7679],[8203,8207],[8234,8238],[8288,8291],[8298,8303],[8400,8431],[12330,12335],[12441,12442],[43014,43014],[43019,43019],[43045,43046],[64286,64286],[65024,65039],[65056,65059],[65279,65279],[65529,65531]],n=[[68097,68099],[68101,68102],[68108,68111],[68152,68154],[68159,68159],[119143,119145],[119155,119170],[119173,119179],[119210,119213],[119362,119364],[917505,917505],[917536,917631],[917760,917999]];let o;t.UnicodeV6=class{constructor(){if(this.version="6",!o){o=new Uint8Array(65536),o.fill(1),o[0]=0,o.fill(0,1,32),o.fill(0,127,160),o.fill(2,4352,4448),o[9001]=2,o[9002]=2,o.fill(2,11904,42192),o[12351]=1,o.fill(2,44032,55204),o.fill(2,63744,64256),o.fill(2,65040,65050),o.fill(2,65072,65136),o.fill(2,65280,65377),o.fill(2,65504,65511);for(let e=0;e<r.length;++e)o.fill(0,r[e][0],r[e][1]+1)}}wcwidth(e){return e<32?0:e<127?1:e<65536?o[e]:function(e,t){let i,s=0,r=t.length-1;if(e<t[0][0]||e>t[r][1])return!1;for(;r>=s;)if(i=s+r>>1,e>t[i][1])s=i+1;else{if(!(e<t[i][0]))return!0;r=i-1}return!1}(e,n)?0:e>=131072&&e<=196605||e>=196608&&e<=262141?2:1}charProperties(e,t){let i=this.wcwidth(e),r=0===i&&0!==t;if(r){const e=s.UnicodeService.extractWidth(t);0===e?r=!1:e>i&&(i=e)}return s.UnicodeService.createPropertyValue(0,i,r)}}},5981:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.WriteBuffer=void 0;const s=i(8460),r=i(844);class n extends r.Disposable{constructor(e){super(),this._action=e,this._writeBuffer=[],this._callbacks=[],this._pendingData=0,this._bufferOffset=0,this._isSyncWriting=!1,this._syncCalls=0,this._didUserInput=!1,this._onWriteParsed=this.register(new s.EventEmitter),this.onWriteParsed=this._onWriteParsed.event}handleUserInput(){this._didUserInput=!0}writeSync(e,t){if(void 0!==t&&this._syncCalls>t)return void(this._syncCalls=0);if(this._pendingData+=e.length,this._writeBuffer.push(e),this._callbacks.push(void 0),this._syncCalls++,this._isSyncWriting)return;let i;for(this._isSyncWriting=!0;i=this._writeBuffer.shift();){this._action(i);const e=this._callbacks.shift();e&&e()}this._pendingData=0,this._bufferOffset=2147483647,this._isSyncWriting=!1,this._syncCalls=0}write(e,t){if(this._pendingData>5e7)throw new Error("write data discarded, use flow control to avoid losing data");if(!this._writeBuffer.length){if(this._bufferOffset=0,this._didUserInput)return this._didUserInput=!1,this._pendingData+=e.length,this._writeBuffer.push(e),this._callbacks.push(t),void this._innerWrite();setTimeout((()=>this._innerWrite()))}this._pendingData+=e.length,this._writeBuffer.push(e),this._callbacks.push(t)}_innerWrite(e=0,t=!0){const i=e||Date.now();for(;this._writeBuffer.length>this._bufferOffset;){const e=this._writeBuffer[this._bufferOffset],s=this._action(e,t);if(s){const e=e=>Date.now()-i>=12?setTimeout((()=>this._innerWrite(0,e))):this._innerWrite(i,e);return void s.catch((e=>(queueMicrotask((()=>{throw e})),Promise.resolve(!1)))).then(e)}const r=this._callbacks[this._bufferOffset];if(r&&r(),this._bufferOffset++,this._pendingData-=e.length,Date.now()-i>=12)break}this._writeBuffer.length>this._bufferOffset?(this._bufferOffset>50&&(this._writeBuffer=this._writeBuffer.slice(this._bufferOffset),this._callbacks=this._callbacks.slice(this._bufferOffset),this._bufferOffset=0),setTimeout((()=>this._innerWrite()))):(this._writeBuffer.length=0,this._callbacks.length=0,this._pendingData=0,this._bufferOffset=0),this._onWriteParsed.fire()}}t.WriteBuffer=n},5941:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.toRgbString=t.parseColor=void 0;const i=/^([\\da-f])\\/([\\da-f])\\/([\\da-f])$|^([\\da-f]{2})\\/([\\da-f]{2})\\/([\\da-f]{2})$|^([\\da-f]{3})\\/([\\da-f]{3})\\/([\\da-f]{3})$|^([\\da-f]{4})\\/([\\da-f]{4})\\/([\\da-f]{4})$/,s=/^[\\da-f]+$/;function r(e,t){const i=e.toString(16),s=i.length<2?"0"+i:i;switch(t){case 4:return i[0];case 8:return s;case 12:return(s+s).slice(0,3);default:return s+s}}t.parseColor=function(e){if(!e)return;let t=e.toLowerCase();if(0===t.indexOf("rgb:")){t=t.slice(4);const e=i.exec(t);if(e){const t=e[1]?15:e[4]?255:e[7]?4095:65535;return[Math.round(parseInt(e[1]||e[4]||e[7]||e[10],16)/t*255),Math.round(parseInt(e[2]||e[5]||e[8]||e[11],16)/t*255),Math.round(parseInt(e[3]||e[6]||e[9]||e[12],16)/t*255)]}}else if(0===t.indexOf("#")&&(t=t.slice(1),s.exec(t)&&[3,6,9,12].includes(t.length))){const e=t.length/3,i=[0,0,0];for(let s=0;s<3;++s){const r=parseInt(t.slice(e*s,e*s+e),16);i[s]=1===e?r<<4:2===e?r:3===e?r>>4:r>>8}return i}},t.toRgbString=function(e,t=16){const[i,s,n]=e;return`rgb:${r(i,t)}/${r(s,t)}/${r(n,t)}`}},5770:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.PAYLOAD_LIMIT=void 0,t.PAYLOAD_LIMIT=1e7},6351:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.DcsHandler=t.DcsParser=void 0;const s=i(482),r=i(8742),n=i(5770),o=[];t.DcsParser=class{constructor(){this._handlers=Object.create(null),this._active=o,this._ident=0,this._handlerFb=()=>{},this._stack={paused:!1,loopPosition:0,fallThrough:!1}}dispose(){this._handlers=Object.create(null),this._handlerFb=()=>{},this._active=o}registerHandler(e,t){void 0===this._handlers[e]&&(this._handlers[e]=[]);const i=this._handlers[e];return i.push(t),{dispose:()=>{const e=i.indexOf(t);-1!==e&&i.splice(e,1)}}}clearHandler(e){this._handlers[e]&&delete this._handlers[e]}setHandlerFallback(e){this._handlerFb=e}reset(){if(this._active.length)for(let e=this._stack.paused?this._stack.loopPosition-1:this._active.length-1;e>=0;--e)this._active[e].unhook(!1);this._stack.paused=!1,this._active=o,this._ident=0}hook(e,t){if(this.reset(),this._ident=e,this._active=this._handlers[e]||o,this._active.length)for(let e=this._active.length-1;e>=0;e--)this._active[e].hook(t);else this._handlerFb(this._ident,"HOOK",t)}put(e,t,i){if(this._active.length)for(let s=this._active.length-1;s>=0;s--)this._active[s].put(e,t,i);else this._handlerFb(this._ident,"PUT",(0,s.utf32ToString)(e,t,i))}unhook(e,t=!0){if(this._active.length){let i=!1,s=this._active.length-1,r=!1;if(this._stack.paused&&(s=this._stack.loopPosition-1,i=t,r=this._stack.fallThrough,this._stack.paused=!1),!r&&!1===i){for(;s>=0&&(i=this._active[s].unhook(e),!0!==i);s--)if(i instanceof Promise)return this._stack.paused=!0,this._stack.loopPosition=s,this._stack.fallThrough=!1,i;s--}for(;s>=0;s--)if(i=this._active[s].unhook(!1),i instanceof Promise)return this._stack.paused=!0,this._stack.loopPosition=s,this._stack.fallThrough=!0,i}else this._handlerFb(this._ident,"UNHOOK",e);this._active=o,this._ident=0}};const a=new r.Params;a.addParam(0),t.DcsHandler=class{constructor(e){this._handler=e,this._data="",this._params=a,this._hitLimit=!1}hook(e){this._params=e.length>1||e.params[0]?e.clone():a,this._data="",this._hitLimit=!1}put(e,t,i){this._hitLimit||(this._data+=(0,s.utf32ToString)(e,t,i),this._data.length>n.PAYLOAD_LIMIT&&(this._data="",this._hitLimit=!0))}unhook(e){let t=!1;if(this._hitLimit)t=!1;else if(e&&(t=this._handler(this._data,this._params),t instanceof Promise))return t.then((e=>(this._params=a,this._data="",this._hitLimit=!1,e)));return this._params=a,this._data="",this._hitLimit=!1,t}}},2015:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.EscapeSequenceParser=t.VT500_TRANSITION_TABLE=t.TransitionTable=void 0;const s=i(844),r=i(8742),n=i(6242),o=i(6351);class a{constructor(e){this.table=new Uint8Array(e)}setDefault(e,t){this.table.fill(e<<4|t)}add(e,t,i,s){this.table[t<<8|e]=i<<4|s}addMany(e,t,i,s){for(let r=0;r<e.length;r++)this.table[t<<8|e[r]]=i<<4|s}}t.TransitionTable=a;const h=160;t.VT500_TRANSITION_TABLE=function(){const e=new a(4095),t=Array.apply(null,Array(256)).map(((e,t)=>t)),i=(e,i)=>t.slice(e,i),s=i(32,127),r=i(0,24);r.push(25),r.push.apply(r,i(28,32));const n=i(0,14);let o;for(o in e.setDefault(1,0),e.addMany(s,0,2,0),n)e.addMany([24,26,153,154],o,3,0),e.addMany(i(128,144),o,3,0),e.addMany(i(144,152),o,3,0),e.add(156,o,0,0),e.add(27,o,11,1),e.add(157,o,4,8),e.addMany([152,158,159],o,0,7),e.add(155,o,11,3),e.add(144,o,11,9);return e.addMany(r,0,3,0),e.addMany(r,1,3,1),e.add(127,1,0,1),e.addMany(r,8,0,8),e.addMany(r,3,3,3),e.add(127,3,0,3),e.addMany(r,4,3,4),e.add(127,4,0,4),e.addMany(r,6,3,6),e.addMany(r,5,3,5),e.add(127,5,0,5),e.addMany(r,2,3,2),e.add(127,2,0,2),e.add(93,1,4,8),e.addMany(s,8,5,8),e.add(127,8,5,8),e.addMany([156,27,24,26,7],8,6,0),e.addMany(i(28,32),8,0,8),e.addMany([88,94,95],1,0,7),e.addMany(s,7,0,7),e.addMany(r,7,0,7),e.add(156,7,0,0),e.add(127,7,0,7),e.add(91,1,11,3),e.addMany(i(64,127),3,7,0),e.addMany(i(48,60),3,8,4),e.addMany([60,61,62,63],3,9,4),e.addMany(i(48,60),4,8,4),e.addMany(i(64,127),4,7,0),e.addMany([60,61,62,63],4,0,6),e.addMany(i(32,64),6,0,6),e.add(127,6,0,6),e.addMany(i(64,127),6,0,0),e.addMany(i(32,48),3,9,5),e.addMany(i(32,48),5,9,5),e.addMany(i(48,64),5,0,6),e.addMany(i(64,127),5,7,0),e.addMany(i(32,48),4,9,5),e.addMany(i(32,48),1,9,2),e.addMany(i(32,48),2,9,2),e.addMany(i(48,127),2,10,0),e.addMany(i(48,80),1,10,0),e.addMany(i(81,88),1,10,0),e.addMany([89,90,92],1,10,0),e.addMany(i(96,127),1,10,0),e.add(80,1,11,9),e.addMany(r,9,0,9),e.add(127,9,0,9),e.addMany(i(28,32),9,0,9),e.addMany(i(32,48),9,9,12),e.addMany(i(48,60),9,8,10),e.addMany([60,61,62,63],9,9,10),e.addMany(r,11,0,11),e.addMany(i(32,128),11,0,11),e.addMany(i(28,32),11,0,11),e.addMany(r,10,0,10),e.add(127,10,0,10),e.addMany(i(28,32),10,0,10),e.addMany(i(48,60),10,8,10),e.addMany([60,61,62,63],10,0,11),e.addMany(i(32,48),10,9,12),e.addMany(r,12,0,12),e.add(127,12,0,12),e.addMany(i(28,32),12,0,12),e.addMany(i(32,48),12,9,12),e.addMany(i(48,64),12,0,11),e.addMany(i(64,127),12,12,13),e.addMany(i(64,127),10,12,13),e.addMany(i(64,127),9,12,13),e.addMany(r,13,13,13),e.addMany(s,13,13,13),e.add(127,13,0,13),e.addMany([27,156,24,26],13,14,0),e.add(h,0,2,0),e.add(h,8,5,8),e.add(h,6,0,6),e.add(h,11,0,11),e.add(h,13,13,13),e}();class c extends s.Disposable{constructor(e=t.VT500_TRANSITION_TABLE){super(),this._transitions=e,this._parseStack={state:0,handlers:[],handlerPos:0,transition:0,chunkPos:0},this.initialState=0,this.currentState=this.initialState,this._params=new r.Params,this._params.addParam(0),this._collect=0,this.precedingJoinState=0,this._printHandlerFb=(e,t,i)=>{},this._executeHandlerFb=e=>{},this._csiHandlerFb=(e,t)=>{},this._escHandlerFb=e=>{},this._errorHandlerFb=e=>e,this._printHandler=this._printHandlerFb,this._executeHandlers=Object.create(null),this._csiHandlers=Object.create(null),this._escHandlers=Object.create(null),this.register((0,s.toDisposable)((()=>{this._csiHandlers=Object.create(null),this._executeHandlers=Object.create(null),this._escHandlers=Object.create(null)}))),this._oscParser=this.register(new n.OscParser),this._dcsParser=this.register(new o.DcsParser),this._errorHandler=this._errorHandlerFb,this.registerEscHandler({final:"\\\\"},(()=>!0))}_identifier(e,t=[64,126]){let i=0;if(e.prefix){if(e.prefix.length>1)throw new Error("only one byte as prefix supported");if(i=e.prefix.charCodeAt(0),i&&60>i||i>63)throw new Error("prefix must be in range 0x3c .. 0x3f")}if(e.intermediates){if(e.intermediates.length>2)throw new Error("only two bytes as intermediates are supported");for(let t=0;t<e.intermediates.length;++t){const s=e.intermediates.charCodeAt(t);if(32>s||s>47)throw new Error("intermediate must be in range 0x20 .. 0x2f");i<<=8,i|=s}}if(1!==e.final.length)throw new Error("final must be a single byte");const s=e.final.charCodeAt(0);if(t[0]>s||s>t[1])throw new Error(`final must be in range ${t[0]} .. ${t[1]}`);return i<<=8,i|=s,i}identToString(e){const t=[];for(;e;)t.push(String.fromCharCode(255&e)),e>>=8;return t.reverse().join("")}setPrintHandler(e){this._printHandler=e}clearPrintHandler(){this._printHandler=this._printHandlerFb}registerEscHandler(e,t){const i=this._identifier(e,[48,126]);void 0===this._escHandlers[i]&&(this._escHandlers[i]=[]);const s=this._escHandlers[i];return s.push(t),{dispose:()=>{const e=s.indexOf(t);-1!==e&&s.splice(e,1)}}}clearEscHandler(e){this._escHandlers[this._identifier(e,[48,126])]&&delete this._escHandlers[this._identifier(e,[48,126])]}setEscHandlerFallback(e){this._escHandlerFb=e}setExecuteHandler(e,t){this._executeHandlers[e.charCodeAt(0)]=t}clearExecuteHandler(e){this._executeHandlers[e.charCodeAt(0)]&&delete this._executeHandlers[e.charCodeAt(0)]}setExecuteHandlerFallback(e){this._executeHandlerFb=e}registerCsiHandler(e,t){const i=this._identifier(e);void 0===this._csiHandlers[i]&&(this._csiHandlers[i]=[]);const s=this._csiHandlers[i];return s.push(t),{dispose:()=>{const e=s.indexOf(t);-1!==e&&s.splice(e,1)}}}clearCsiHandler(e){this._csiHandlers[this._identifier(e)]&&delete this._csiHandlers[this._identifier(e)]}setCsiHandlerFallback(e){this._csiHandlerFb=e}registerDcsHandler(e,t){return this._dcsParser.registerHandler(this._identifier(e),t)}clearDcsHandler(e){this._dcsParser.clearHandler(this._identifier(e))}setDcsHandlerFallback(e){this._dcsParser.setHandlerFallback(e)}registerOscHandler(e,t){return this._oscParser.registerHandler(e,t)}clearOscHandler(e){this._oscParser.clearHandler(e)}setOscHandlerFallback(e){this._oscParser.setHandlerFallback(e)}setErrorHandler(e){this._errorHandler=e}clearErrorHandler(){this._errorHandler=this._errorHandlerFb}reset(){this.currentState=this.initialState,this._oscParser.reset(),this._dcsParser.reset(),this._params.reset(),this._params.addParam(0),this._collect=0,this.precedingJoinState=0,0!==this._parseStack.state&&(this._parseStack.state=2,this._parseStack.handlers=[])}_preserveStack(e,t,i,s,r){this._parseStack.state=e,this._parseStack.handlers=t,this._parseStack.handlerPos=i,this._parseStack.transition=s,this._parseStack.chunkPos=r}parse(e,t,i){let s,r=0,n=0,o=0;if(this._parseStack.state)if(2===this._parseStack.state)this._parseStack.state=0,o=this._parseStack.chunkPos+1;else{if(void 0===i||1===this._parseStack.state)throw this._parseStack.state=1,new Error("improper continuation due to previous async handler, giving up parsing");const t=this._parseStack.handlers;let n=this._parseStack.handlerPos-1;switch(this._parseStack.state){case 3:if(!1===i&&n>-1)for(;n>=0&&(s=t[n](this._params),!0!==s);n--)if(s instanceof Promise)return this._parseStack.handlerPos=n,s;this._parseStack.handlers=[];break;case 4:if(!1===i&&n>-1)for(;n>=0&&(s=t[n](),!0!==s);n--)if(s instanceof Promise)return this._parseStack.handlerPos=n,s;this._parseStack.handlers=[];break;case 6:if(r=e[this._parseStack.chunkPos],s=this._dcsParser.unhook(24!==r&&26!==r,i),s)return s;27===r&&(this._parseStack.transition|=1),this._params.reset(),this._params.addParam(0),this._collect=0;break;case 5:if(r=e[this._parseStack.chunkPos],s=this._oscParser.end(24!==r&&26!==r,i),s)return s;27===r&&(this._parseStack.transition|=1),this._params.reset(),this._params.addParam(0),this._collect=0}this._parseStack.state=0,o=this._parseStack.chunkPos+1,this.precedingJoinState=0,this.currentState=15&this._parseStack.transition}for(let i=o;i<t;++i){switch(r=e[i],n=this._transitions.table[this.currentState<<8|(r<160?r:h)],n>>4){case 2:for(let s=i+1;;++s){if(s>=t||(r=e[s])<32||r>126&&r<h){this._printHandler(e,i,s),i=s-1;break}if(++s>=t||(r=e[s])<32||r>126&&r<h){this._printHandler(e,i,s),i=s-1;break}if(++s>=t||(r=e[s])<32||r>126&&r<h){this._printHandler(e,i,s),i=s-1;break}if(++s>=t||(r=e[s])<32||r>126&&r<h){this._printHandler(e,i,s),i=s-1;break}}break;case 3:this._executeHandlers[r]?this._executeHandlers[r]():this._executeHandlerFb(r),this.precedingJoinState=0;break;case 0:break;case 1:if(this._errorHandler({position:i,code:r,currentState:this.currentState,collect:this._collect,params:this._params,abort:!1}).abort)return;break;case 7:const o=this._csiHandlers[this._collect<<8|r];let a=o?o.length-1:-1;for(;a>=0&&(s=o[a](this._params),!0!==s);a--)if(s instanceof Promise)return this._preserveStack(3,o,a,n,i),s;a<0&&this._csiHandlerFb(this._collect<<8|r,this._params),this.precedingJoinState=0;break;case 8:do{switch(r){case 59:this._params.addParam(0);break;case 58:this._params.addSubParam(-1);break;default:this._params.addDigit(r-48)}}while(++i<t&&(r=e[i])>47&&r<60);i--;break;case 9:this._collect<<=8,this._collect|=r;break;case 10:const c=this._escHandlers[this._collect<<8|r];let l=c?c.length-1:-1;for(;l>=0&&(s=c[l](),!0!==s);l--)if(s instanceof Promise)return this._preserveStack(4,c,l,n,i),s;l<0&&this._escHandlerFb(this._collect<<8|r),this.precedingJoinState=0;break;case 11:this._params.reset(),this._params.addParam(0),this._collect=0;break;case 12:this._dcsParser.hook(this._collect<<8|r,this._params);break;case 13:for(let s=i+1;;++s)if(s>=t||24===(r=e[s])||26===r||27===r||r>127&&r<h){this._dcsParser.put(e,i,s),i=s-1;break}break;case 14:if(s=this._dcsParser.unhook(24!==r&&26!==r),s)return this._preserveStack(6,[],0,n,i),s;27===r&&(n|=1),this._params.reset(),this._params.addParam(0),this._collect=0,this.precedingJoinState=0;break;case 4:this._oscParser.start();break;case 5:for(let s=i+1;;s++)if(s>=t||(r=e[s])<32||r>127&&r<h){this._oscParser.put(e,i,s),i=s-1;break}break;case 6:if(s=this._oscParser.end(24!==r&&26!==r),s)return this._preserveStack(5,[],0,n,i),s;27===r&&(n|=1),this._params.reset(),this._params.addParam(0),this._collect=0,this.precedingJoinState=0}this.currentState=15&n}}}t.EscapeSequenceParser=c},6242:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.OscHandler=t.OscParser=void 0;const s=i(5770),r=i(482),n=[];t.OscParser=class{constructor(){this._state=0,this._active=n,this._id=-1,this._handlers=Object.create(null),this._handlerFb=()=>{},this._stack={paused:!1,loopPosition:0,fallThrough:!1}}registerHandler(e,t){void 0===this._handlers[e]&&(this._handlers[e]=[]);const i=this._handlers[e];return i.push(t),{dispose:()=>{const e=i.indexOf(t);-1!==e&&i.splice(e,1)}}}clearHandler(e){this._handlers[e]&&delete this._handlers[e]}setHandlerFallback(e){this._handlerFb=e}dispose(){this._handlers=Object.create(null),this._handlerFb=()=>{},this._active=n}reset(){if(2===this._state)for(let e=this._stack.paused?this._stack.loopPosition-1:this._active.length-1;e>=0;--e)this._active[e].end(!1);this._stack.paused=!1,this._active=n,this._id=-1,this._state=0}_start(){if(this._active=this._handlers[this._id]||n,this._active.length)for(let e=this._active.length-1;e>=0;e--)this._active[e].start();else this._handlerFb(this._id,"START")}_put(e,t,i){if(this._active.length)for(let s=this._active.length-1;s>=0;s--)this._active[s].put(e,t,i);else this._handlerFb(this._id,"PUT",(0,r.utf32ToString)(e,t,i))}start(){this.reset(),this._state=1}put(e,t,i){if(3!==this._state){if(1===this._state)for(;t<i;){const i=e[t++];if(59===i){this._state=2,this._start();break}if(i<48||57<i)return void(this._state=3);-1===this._id&&(this._id=0),this._id=10*this._id+i-48}2===this._state&&i-t>0&&this._put(e,t,i)}}end(e,t=!0){if(0!==this._state){if(3!==this._state)if(1===this._state&&this._start(),this._active.length){let i=!1,s=this._active.length-1,r=!1;if(this._stack.paused&&(s=this._stack.loopPosition-1,i=t,r=this._stack.fallThrough,this._stack.paused=!1),!r&&!1===i){for(;s>=0&&(i=this._active[s].end(e),!0!==i);s--)if(i instanceof Promise)return this._stack.paused=!0,this._stack.loopPosition=s,this._stack.fallThrough=!1,i;s--}for(;s>=0;s--)if(i=this._active[s].end(!1),i instanceof Promise)return this._stack.paused=!0,this._stack.loopPosition=s,this._stack.fallThrough=!0,i}else this._handlerFb(this._id,"END",e);this._active=n,this._id=-1,this._state=0}}},t.OscHandler=class{constructor(e){this._handler=e,this._data="",this._hitLimit=!1}start(){this._data="",this._hitLimit=!1}put(e,t,i){this._hitLimit||(this._data+=(0,r.utf32ToString)(e,t,i),this._data.length>s.PAYLOAD_LIMIT&&(this._data="",this._hitLimit=!0))}end(e){let t=!1;if(this._hitLimit)t=!1;else if(e&&(t=this._handler(this._data),t instanceof Promise))return t.then((e=>(this._data="",this._hitLimit=!1,e)));return this._data="",this._hitLimit=!1,t}}},8742:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.Params=void 0;const i=2147483647;class s{static fromArray(e){const t=new s;if(!e.length)return t;for(let i=Array.isArray(e[0])?1:0;i<e.length;++i){const s=e[i];if(Array.isArray(s))for(let e=0;e<s.length;++e)t.addSubParam(s[e]);else t.addParam(s)}return t}constructor(e=32,t=32){if(this.maxLength=e,this.maxSubParamsLength=t,t>256)throw new Error("maxSubParamsLength must not be greater than 256");this.params=new Int32Array(e),this.length=0,this._subParams=new Int32Array(t),this._subParamsLength=0,this._subParamsIdx=new Uint16Array(e),this._rejectDigits=!1,this._rejectSubDigits=!1,this._digitIsSub=!1}clone(){const e=new s(this.maxLength,this.maxSubParamsLength);return e.params.set(this.params),e.length=this.length,e._subParams.set(this._subParams),e._subParamsLength=this._subParamsLength,e._subParamsIdx.set(this._subParamsIdx),e._rejectDigits=this._rejectDigits,e._rejectSubDigits=this._rejectSubDigits,e._digitIsSub=this._digitIsSub,e}toArray(){const e=[];for(let t=0;t<this.length;++t){e.push(this.params[t]);const i=this._subParamsIdx[t]>>8,s=255&this._subParamsIdx[t];s-i>0&&e.push(Array.prototype.slice.call(this._subParams,i,s))}return e}reset(){this.length=0,this._subParamsLength=0,this._rejectDigits=!1,this._rejectSubDigits=!1,this._digitIsSub=!1}addParam(e){if(this._digitIsSub=!1,this.length>=this.maxLength)this._rejectDigits=!0;else{if(e<-1)throw new Error("values lesser than -1 are not allowed");this._subParamsIdx[this.length]=this._subParamsLength<<8|this._subParamsLength,this.params[this.length++]=e>i?i:e}}addSubParam(e){if(this._digitIsSub=!0,this.length)if(this._rejectDigits||this._subParamsLength>=this.maxSubParamsLength)this._rejectSubDigits=!0;else{if(e<-1)throw new Error("values lesser than -1 are not allowed");this._subParams[this._subParamsLength++]=e>i?i:e,this._subParamsIdx[this.length-1]++}}hasSubParams(e){return(255&this._subParamsIdx[e])-(this._subParamsIdx[e]>>8)>0}getSubParams(e){const t=this._subParamsIdx[e]>>8,i=255&this._subParamsIdx[e];return i-t>0?this._subParams.subarray(t,i):null}getSubParamsAll(){const e={};for(let t=0;t<this.length;++t){const i=this._subParamsIdx[t]>>8,s=255&this._subParamsIdx[t];s-i>0&&(e[t]=this._subParams.slice(i,s))}return e}addDigit(e){let t;if(this._rejectDigits||!(t=this._digitIsSub?this._subParamsLength:this.length)||this._digitIsSub&&this._rejectSubDigits)return;const s=this._digitIsSub?this._subParams:this.params,r=s[t-1];s[t-1]=~r?Math.min(10*r+e,i):e}}t.Params=s},5741:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.AddonManager=void 0,t.AddonManager=class{constructor(){this._addons=[]}dispose(){for(let e=this._addons.length-1;e>=0;e--)this._addons[e].instance.dispose()}loadAddon(e,t){const i={instance:t,dispose:t.dispose,isDisposed:!1};this._addons.push(i),t.dispose=()=>this._wrappedAddonDispose(i),t.activate(e)}_wrappedAddonDispose(e){if(e.isDisposed)return;let t=-1;for(let i=0;i<this._addons.length;i++)if(this._addons[i]===e){t=i;break}if(-1===t)throw new Error("Could not dispose an addon that has not been loaded");e.isDisposed=!0,e.dispose.apply(e.instance),this._addons.splice(t,1)}}},8771:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.BufferApiView=void 0;const s=i(3785),r=i(511);t.BufferApiView=class{constructor(e,t){this._buffer=e,this.type=t}init(e){return this._buffer=e,this}get cursorY(){return this._buffer.y}get cursorX(){return this._buffer.x}get viewportY(){return this._buffer.ydisp}get baseY(){return this._buffer.ybase}get length(){return this._buffer.lines.length}getLine(e){const t=this._buffer.lines.get(e);if(t)return new s.BufferLineApiView(t)}getNullCell(){return new r.CellData}}},3785:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.BufferLineApiView=void 0;const s=i(511);t.BufferLineApiView=class{constructor(e){this._line=e}get isWrapped(){return this._line.isWrapped}get length(){return this._line.length}getCell(e,t){if(!(e<0||e>=this._line.length))return t?(this._line.loadCell(e,t),t):this._line.loadCell(e,new s.CellData)}translateToString(e,t,i){return this._line.translateToString(e,t,i)}}},8285:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.BufferNamespaceApi=void 0;const s=i(8771),r=i(8460),n=i(844);class o extends n.Disposable{constructor(e){super(),this._core=e,this._onBufferChange=this.register(new r.EventEmitter),this.onBufferChange=this._onBufferChange.event,this._normal=new s.BufferApiView(this._core.buffers.normal,"normal"),this._alternate=new s.BufferApiView(this._core.buffers.alt,"alternate"),this._core.buffers.onBufferActivate((()=>this._onBufferChange.fire(this.active)))}get active(){if(this._core.buffers.active===this._core.buffers.normal)return this.normal;if(this._core.buffers.active===this._core.buffers.alt)return this.alternate;throw new Error("Active buffer is neither normal nor alternate")}get normal(){return this._normal.init(this._core.buffers.normal)}get alternate(){return this._alternate.init(this._core.buffers.alt)}}t.BufferNamespaceApi=o},7975:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.ParserApi=void 0,t.ParserApi=class{constructor(e){this._core=e}registerCsiHandler(e,t){return this._core.registerCsiHandler(e,(e=>t(e.toArray())))}addCsiHandler(e,t){return this.registerCsiHandler(e,t)}registerDcsHandler(e,t){return this._core.registerDcsHandler(e,((e,i)=>t(e,i.toArray())))}addDcsHandler(e,t){return this.registerDcsHandler(e,t)}registerEscHandler(e,t){return this._core.registerEscHandler(e,t)}addEscHandler(e,t){return this.registerEscHandler(e,t)}registerOscHandler(e,t){return this._core.registerOscHandler(e,t)}addOscHandler(e,t){return this.registerOscHandler(e,t)}}},7090:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.UnicodeApi=void 0,t.UnicodeApi=class{constructor(e){this._core=e}register(e){this._core.unicodeService.register(e)}get versions(){return this._core.unicodeService.versions}get activeVersion(){return this._core.unicodeService.activeVersion}set activeVersion(e){this._core.unicodeService.activeVersion=e}}},744:function(e,t,i){var s=this&&this.__decorate||function(e,t,i,s){var r,n=arguments.length,o=n<3?t:null===s?s=Object.getOwnPropertyDescriptor(t,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)o=Reflect.decorate(e,t,i,s);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(o=(n<3?r(o):n>3?r(t,i,o):r(t,i))||o);return n>3&&o&&Object.defineProperty(t,i,o),o},r=this&&this.__param||function(e,t){return function(i,s){t(i,s,e)}};Object.defineProperty(t,"__esModule",{value:!0}),t.BufferService=t.MINIMUM_ROWS=t.MINIMUM_COLS=void 0;const n=i(8460),o=i(844),a=i(5295),h=i(2585);t.MINIMUM_COLS=2,t.MINIMUM_ROWS=1;let c=t.BufferService=class extends o.Disposable{get buffer(){return this.buffers.active}constructor(e){super(),this.isUserScrolling=!1,this._onResize=this.register(new n.EventEmitter),this.onResize=this._onResize.event,this._onScroll=this.register(new n.EventEmitter),this.onScroll=this._onScroll.event,this.cols=Math.max(e.rawOptions.cols||0,t.MINIMUM_COLS),this.rows=Math.max(e.rawOptions.rows||0,t.MINIMUM_ROWS),this.buffers=this.register(new a.BufferSet(e,this))}resize(e,t){this.cols=e,this.rows=t,this.buffers.resize(e,t),this._onResize.fire({cols:e,rows:t})}reset(){this.buffers.reset(),this.isUserScrolling=!1}scroll(e,t=!1){const i=this.buffer;let s;s=this._cachedBlankLine,s&&s.length===this.cols&&s.getFg(0)===e.fg&&s.getBg(0)===e.bg||(s=i.getBlankLine(e,t),this._cachedBlankLine=s),s.isWrapped=t;const r=i.ybase+i.scrollTop,n=i.ybase+i.scrollBottom;if(0===i.scrollTop){const e=i.lines.isFull;n===i.lines.length-1?e?i.lines.recycle().copyFrom(s):i.lines.push(s.clone()):i.lines.splice(n+1,0,s.clone()),e?this.isUserScrolling&&(i.ydisp=Math.max(i.ydisp-1,0)):(i.ybase++,this.isUserScrolling||i.ydisp++)}else{const e=n-r+1;i.lines.shiftElements(r+1,e-1,-1),i.lines.set(n,s.clone())}this.isUserScrolling||(i.ydisp=i.ybase),this._onScroll.fire(i.ydisp)}scrollLines(e,t,i){const s=this.buffer;if(e<0){if(0===s.ydisp)return;this.isUserScrolling=!0}else e+s.ydisp>=s.ybase&&(this.isUserScrolling=!1);const r=s.ydisp;s.ydisp=Math.max(Math.min(s.ydisp+e,s.ybase),0),r!==s.ydisp&&(t||this._onScroll.fire(s.ydisp))}};t.BufferService=c=s([r(0,h.IOptionsService)],c)},7994:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.CharsetService=void 0,t.CharsetService=class{constructor(){this.glevel=0,this._charsets=[]}reset(){this.charset=void 0,this._charsets=[],this.glevel=0}setgLevel(e){this.glevel=e,this.charset=this._charsets[e]}setgCharset(e,t){this._charsets[e]=t,this.glevel===e&&(this.charset=t)}}},1753:function(e,t,i){var s=this&&this.__decorate||function(e,t,i,s){var r,n=arguments.length,o=n<3?t:null===s?s=Object.getOwnPropertyDescriptor(t,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)o=Reflect.decorate(e,t,i,s);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(o=(n<3?r(o):n>3?r(t,i,o):r(t,i))||o);return n>3&&o&&Object.defineProperty(t,i,o),o},r=this&&this.__param||function(e,t){return function(i,s){t(i,s,e)}};Object.defineProperty(t,"__esModule",{value:!0}),t.CoreMouseService=void 0;const n=i(2585),o=i(8460),a=i(844),h={NONE:{events:0,restrict:()=>!1},X10:{events:1,restrict:e=>4!==e.button&&1===e.action&&(e.ctrl=!1,e.alt=!1,e.shift=!1,!0)},VT200:{events:19,restrict:e=>32!==e.action},DRAG:{events:23,restrict:e=>32!==e.action||3!==e.button},ANY:{events:31,restrict:e=>!0}};function c(e,t){let i=(e.ctrl?16:0)|(e.shift?4:0)|(e.alt?8:0);return 4===e.button?(i|=64,i|=e.action):(i|=3&e.button,4&e.button&&(i|=64),8&e.button&&(i|=128),32===e.action?i|=32:0!==e.action||t||(i|=3)),i}const l=String.fromCharCode,d={DEFAULT:e=>{const t=[c(e,!1)+32,e.col+32,e.row+32];return t[0]>255||t[1]>255||t[2]>255?"":`\x1B[M${l(t[0])}${l(t[1])}${l(t[2])}`},SGR:e=>{const t=0===e.action&&4!==e.button?"m":"M";return`\x1B[<${c(e,!0)};${e.col};${e.row}${t}`},SGR_PIXELS:e=>{const t=0===e.action&&4!==e.button?"m":"M";return`\x1B[<${c(e,!0)};${e.x};${e.y}${t}`}};let _=t.CoreMouseService=class extends a.Disposable{constructor(e,t){super(),this._bufferService=e,this._coreService=t,this._protocols={},this._encodings={},this._activeProtocol="",this._activeEncoding="",this._lastEvent=null,this._onProtocolChange=this.register(new o.EventEmitter),this.onProtocolChange=this._onProtocolChange.event;for(const e of Object.keys(h))this.addProtocol(e,h[e]);for(const e of Object.keys(d))this.addEncoding(e,d[e]);this.reset()}addProtocol(e,t){this._protocols[e]=t}addEncoding(e,t){this._encodings[e]=t}get activeProtocol(){return this._activeProtocol}get areMouseEventsActive(){return 0!==this._protocols[this._activeProtocol].events}set activeProtocol(e){if(!this._protocols[e])throw new Error(`unknown protocol "${e}"`);this._activeProtocol=e,this._onProtocolChange.fire(this._protocols[e].events)}get activeEncoding(){return this._activeEncoding}set activeEncoding(e){if(!this._encodings[e])throw new Error(`unknown encoding "${e}"`);this._activeEncoding=e}reset(){this.activeProtocol="NONE",this.activeEncoding="DEFAULT",this._lastEvent=null}triggerMouseEvent(e){if(e.col<0||e.col>=this._bufferService.cols||e.row<0||e.row>=this._bufferService.rows)return!1;if(4===e.button&&32===e.action)return!1;if(3===e.button&&32!==e.action)return!1;if(4!==e.button&&(2===e.action||3===e.action))return!1;if(e.col++,e.row++,32===e.action&&this._lastEvent&&this._equalEvents(this._lastEvent,e,"SGR_PIXELS"===this._activeEncoding))return!1;if(!this._protocols[this._activeProtocol].restrict(e))return!1;const t=this._encodings[this._activeEncoding](e);return t&&("DEFAULT"===this._activeEncoding?this._coreService.triggerBinaryEvent(t):this._coreService.triggerDataEvent(t,!0)),this._lastEvent=e,!0}explainEvents(e){return{down:!!(1&e),up:!!(2&e),drag:!!(4&e),move:!!(8&e),wheel:!!(16&e)}}_equalEvents(e,t,i){if(i){if(e.x!==t.x)return!1;if(e.y!==t.y)return!1}else{if(e.col!==t.col)return!1;if(e.row!==t.row)return!1}return e.button===t.button&&e.action===t.action&&e.ctrl===t.ctrl&&e.alt===t.alt&&e.shift===t.shift}};t.CoreMouseService=_=s([r(0,n.IBufferService),r(1,n.ICoreService)],_)},6975:function(e,t,i){var s=this&&this.__decorate||function(e,t,i,s){var r,n=arguments.length,o=n<3?t:null===s?s=Object.getOwnPropertyDescriptor(t,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)o=Reflect.decorate(e,t,i,s);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(o=(n<3?r(o):n>3?r(t,i,o):r(t,i))||o);return n>3&&o&&Object.defineProperty(t,i,o),o},r=this&&this.__param||function(e,t){return function(i,s){t(i,s,e)}};Object.defineProperty(t,"__esModule",{value:!0}),t.CoreService=void 0;const n=i(1439),o=i(8460),a=i(844),h=i(2585),c=Object.freeze({insertMode:!1}),l=Object.freeze({applicationCursorKeys:!1,applicationKeypad:!1,bracketedPasteMode:!1,origin:!1,reverseWraparound:!1,sendFocus:!1,wraparound:!0});let d=t.CoreService=class extends a.Disposable{constructor(e,t,i){super(),this._bufferService=e,this._logService=t,this._optionsService=i,this.isCursorInitialized=!1,this.isCursorHidden=!1,this._onData=this.register(new o.EventEmitter),this.onData=this._onData.event,this._onUserInput=this.register(new o.EventEmitter),this.onUserInput=this._onUserInput.event,this._onBinary=this.register(new o.EventEmitter),this.onBinary=this._onBinary.event,this._onRequestScrollToBottom=this.register(new o.EventEmitter),this.onRequestScrollToBottom=this._onRequestScrollToBottom.event,this.modes=(0,n.clone)(c),this.decPrivateModes=(0,n.clone)(l)}reset(){this.modes=(0,n.clone)(c),this.decPrivateModes=(0,n.clone)(l)}triggerDataEvent(e,t=!1){if(this._optionsService.rawOptions.disableStdin)return;const i=this._bufferService.buffer;t&&this._optionsService.rawOptions.scrollOnUserInput&&i.ybase!==i.ydisp&&this._onRequestScrollToBottom.fire(),t&&this._onUserInput.fire(),this._logService.debug(`sending data "${e}"`,(()=>e.split("").map((e=>e.charCodeAt(0))))),this._onData.fire(e)}triggerBinaryEvent(e){this._optionsService.rawOptions.disableStdin||(this._logService.debug(`sending binary "${e}"`,(()=>e.split("").map((e=>e.charCodeAt(0))))),this._onBinary.fire(e))}};t.CoreService=d=s([r(0,h.IBufferService),r(1,h.ILogService),r(2,h.IOptionsService)],d)},9074:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.DecorationService=void 0;const s=i(8055),r=i(8460),n=i(844),o=i(6106);let a=0,h=0;class c extends n.Disposable{get decorations(){return this._decorations.values()}constructor(){super(),this._decorations=new o.SortedList((e=>e?.marker.line)),this._onDecorationRegistered=this.register(new r.EventEmitter),this.onDecorationRegistered=this._onDecorationRegistered.event,this._onDecorationRemoved=this.register(new r.EventEmitter),this.onDecorationRemoved=this._onDecorationRemoved.event,this.register((0,n.toDisposable)((()=>this.reset())))}registerDecoration(e){if(e.marker.isDisposed)return;const t=new l(e);if(t){const e=t.marker.onDispose((()=>t.dispose()));t.onDispose((()=>{t&&(this._decorations.delete(t)&&this._onDecorationRemoved.fire(t),e.dispose())})),this._decorations.insert(t),this._onDecorationRegistered.fire(t)}return t}reset(){for(const e of this._decorations.values())e.dispose();this._decorations.clear()}*getDecorationsAtCell(e,t,i){let s=0,r=0;for(const n of this._decorations.getKeyIterator(t))s=n.options.x??0,r=s+(n.options.width??1),e>=s&&e<r&&(!i||(n.options.layer??"bottom")===i)&&(yield n)}forEachDecorationAtCell(e,t,i,s){this._decorations.forEachByKey(t,(t=>{a=t.options.x??0,h=a+(t.options.width??1),e>=a&&e<h&&(!i||(t.options.layer??"bottom")===i)&&s(t)}))}}t.DecorationService=c;class l extends n.Disposable{get isDisposed(){return this._isDisposed}get backgroundColorRGB(){return null===this._cachedBg&&(this.options.backgroundColor?this._cachedBg=s.css.toColor(this.options.backgroundColor):this._cachedBg=void 0),this._cachedBg}get foregroundColorRGB(){return null===this._cachedFg&&(this.options.foregroundColor?this._cachedFg=s.css.toColor(this.options.foregroundColor):this._cachedFg=void 0),this._cachedFg}constructor(e){super(),this.options=e,this.onRenderEmitter=this.register(new r.EventEmitter),this.onRender=this.onRenderEmitter.event,this._onDispose=this.register(new r.EventEmitter),this.onDispose=this._onDispose.event,this._cachedBg=null,this._cachedFg=null,this.marker=e.marker,this.options.overviewRulerOptions&&!this.options.overviewRulerOptions.position&&(this.options.overviewRulerOptions.position="full")}dispose(){this._onDispose.fire(),super.dispose()}}},4348:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.InstantiationService=t.ServiceCollection=void 0;const s=i(2585),r=i(8343);class n{constructor(...e){this._entries=new Map;for(const[t,i]of e)this.set(t,i)}set(e,t){const i=this._entries.get(e);return this._entries.set(e,t),i}forEach(e){for(const[t,i]of this._entries.entries())e(t,i)}has(e){return this._entries.has(e)}get(e){return this._entries.get(e)}}t.ServiceCollection=n,t.InstantiationService=class{constructor(){this._services=new n,this._services.set(s.IInstantiationService,this)}setService(e,t){this._services.set(e,t)}getService(e){return this._services.get(e)}createInstance(e,...t){const i=(0,r.getServiceDependencies)(e).sort(((e,t)=>e.index-t.index)),s=[];for(const t of i){const i=this._services.get(t.id);if(!i)throw new Error(`[createInstance] ${e.name} depends on UNKNOWN service ${t.id}.`);s.push(i)}const n=i.length>0?i[0].index:t.length;if(t.length!==n)throw new Error(`[createInstance] First service dependency of ${e.name} at position ${n+1} conflicts with ${t.length} static arguments`);return new e(...[...t,...s])}}},7866:function(e,t,i){var s=this&&this.__decorate||function(e,t,i,s){var r,n=arguments.length,o=n<3?t:null===s?s=Object.getOwnPropertyDescriptor(t,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)o=Reflect.decorate(e,t,i,s);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(o=(n<3?r(o):n>3?r(t,i,o):r(t,i))||o);return n>3&&o&&Object.defineProperty(t,i,o),o},r=this&&this.__param||function(e,t){return function(i,s){t(i,s,e)}};Object.defineProperty(t,"__esModule",{value:!0}),t.traceCall=t.setTraceLogger=t.LogService=void 0;const n=i(844),o=i(2585),a={trace:o.LogLevelEnum.TRACE,debug:o.LogLevelEnum.DEBUG,info:o.LogLevelEnum.INFO,warn:o.LogLevelEnum.WARN,error:o.LogLevelEnum.ERROR,off:o.LogLevelEnum.OFF};let h,c=t.LogService=class extends n.Disposable{get logLevel(){return this._logLevel}constructor(e){super(),this._optionsService=e,this._logLevel=o.LogLevelEnum.OFF,this._updateLogLevel(),this.register(this._optionsService.onSpecificOptionChange("logLevel",(()=>this._updateLogLevel()))),h=this}_updateLogLevel(){this._logLevel=a[this._optionsService.rawOptions.logLevel]}_evalLazyOptionalParams(e){for(let t=0;t<e.length;t++)"function"==typeof e[t]&&(e[t]=e[t]())}_log(e,t,i){this._evalLazyOptionalParams(i),e.call(console,(this._optionsService.options.logger?"":"xterm.js: ")+t,...i)}trace(e,...t){this._logLevel<=o.LogLevelEnum.TRACE&&this._log(this._optionsService.options.logger?.trace.bind(this._optionsService.options.logger)??console.log,e,t)}debug(e,...t){this._logLevel<=o.LogLevelEnum.DEBUG&&this._log(this._optionsService.options.logger?.debug.bind(this._optionsService.options.logger)??console.log,e,t)}info(e,...t){this._logLevel<=o.LogLevelEnum.INFO&&this._log(this._optionsService.options.logger?.info.bind(this._optionsService.options.logger)??console.info,e,t)}warn(e,...t){this._logLevel<=o.LogLevelEnum.WARN&&this._log(this._optionsService.options.logger?.warn.bind(this._optionsService.options.logger)??console.warn,e,t)}error(e,...t){this._logLevel<=o.LogLevelEnum.ERROR&&this._log(this._optionsService.options.logger?.error.bind(this._optionsService.options.logger)??console.error,e,t)}};t.LogService=c=s([r(0,o.IOptionsService)],c),t.setTraceLogger=function(e){h=e},t.traceCall=function(e,t,i){if("function"!=typeof i.value)throw new Error("not supported");const s=i.value;i.value=function(...e){if(h.logLevel!==o.LogLevelEnum.TRACE)return s.apply(this,e);h.trace(`GlyphRenderer#${s.name}(${e.map((e=>JSON.stringify(e))).join(", ")})`);const t=s.apply(this,e);return h.trace(`GlyphRenderer#${s.name} return`,t),t}}},7302:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.OptionsService=t.DEFAULT_OPTIONS=void 0;const s=i(8460),r=i(844),n=i(6114);t.DEFAULT_OPTIONS={cols:80,rows:24,cursorBlink:!1,cursorStyle:"block",cursorWidth:1,cursorInactiveStyle:"outline",customGlyphs:!0,drawBoldTextInBrightColors:!0,documentOverride:null,fastScrollModifier:"alt",fastScrollSensitivity:5,fontFamily:"courier-new, courier, monospace",fontSize:15,fontWeight:"normal",fontWeightBold:"bold",ignoreBracketedPasteMode:!1,lineHeight:1,letterSpacing:0,linkHandler:null,logLevel:"info",logger:null,scrollback:1e3,scrollOnUserInput:!0,scrollSensitivity:1,screenReaderMode:!1,smoothScrollDuration:0,macOptionIsMeta:!1,macOptionClickForcesSelection:!1,minimumContrastRatio:1,disableStdin:!1,allowProposedApi:!1,allowTransparency:!1,tabStopWidth:8,theme:{},rescaleOverlappingGlyphs:!1,rightClickSelectsWord:n.isMac,windowOptions:{},windowsMode:!1,windowsPty:{},wordSeparator:" ()[]{}\',\\"`",altClickMovesCursor:!0,convertEol:!1,termName:"xterm",cancelEvents:!1,overviewRulerWidth:0};const o=["normal","bold","100","200","300","400","500","600","700","800","900"];class a extends r.Disposable{constructor(e){super(),this._onOptionChange=this.register(new s.EventEmitter),this.onOptionChange=this._onOptionChange.event;const i={...t.DEFAULT_OPTIONS};for(const t in e)if(t in i)try{const s=e[t];i[t]=this._sanitizeAndValidateOption(t,s)}catch(e){console.error(e)}this.rawOptions=i,this.options={...i},this._setupOptions(),this.register((0,r.toDisposable)((()=>{this.rawOptions.linkHandler=null,this.rawOptions.documentOverride=null})))}onSpecificOptionChange(e,t){return this.onOptionChange((i=>{i===e&&t(this.rawOptions[e])}))}onMultipleOptionChange(e,t){return this.onOptionChange((i=>{-1!==e.indexOf(i)&&t()}))}_setupOptions(){const e=e=>{if(!(e in t.DEFAULT_OPTIONS))throw new Error(`No option with key "${e}"`);return this.rawOptions[e]},i=(e,i)=>{if(!(e in t.DEFAULT_OPTIONS))throw new Error(`No option with key "${e}"`);i=this._sanitizeAndValidateOption(e,i),this.rawOptions[e]!==i&&(this.rawOptions[e]=i,this._onOptionChange.fire(e))};for(const t in this.rawOptions){const s={get:e.bind(this,t),set:i.bind(this,t)};Object.defineProperty(this.options,t,s)}}_sanitizeAndValidateOption(e,i){switch(e){case"cursorStyle":if(i||(i=t.DEFAULT_OPTIONS[e]),!function(e){return"block"===e||"underline"===e||"bar"===e}(i))throw new Error(`"${i}" is not a valid value for ${e}`);break;case"wordSeparator":i||(i=t.DEFAULT_OPTIONS[e]);break;case"fontWeight":case"fontWeightBold":if("number"==typeof i&&1<=i&&i<=1e3)break;i=o.includes(i)?i:t.DEFAULT_OPTIONS[e];break;case"cursorWidth":i=Math.floor(i);case"lineHeight":case"tabStopWidth":if(i<1)throw new Error(`${e} cannot be less than 1, value: ${i}`);break;case"minimumContrastRatio":i=Math.max(1,Math.min(21,Math.round(10*i)/10));break;case"scrollback":if((i=Math.min(i,4294967295))<0)throw new Error(`${e} cannot be less than 0, value: ${i}`);break;case"fastScrollSensitivity":case"scrollSensitivity":if(i<=0)throw new Error(`${e} cannot be less than or equal to 0, value: ${i}`);break;case"rows":case"cols":if(!i&&0!==i)throw new Error(`${e} must be numeric, value: ${i}`);break;case"windowsPty":i=i??{}}return i}}t.OptionsService=a},2660:function(e,t,i){var s=this&&this.__decorate||function(e,t,i,s){var r,n=arguments.length,o=n<3?t:null===s?s=Object.getOwnPropertyDescriptor(t,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)o=Reflect.decorate(e,t,i,s);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(o=(n<3?r(o):n>3?r(t,i,o):r(t,i))||o);return n>3&&o&&Object.defineProperty(t,i,o),o},r=this&&this.__param||function(e,t){return function(i,s){t(i,s,e)}};Object.defineProperty(t,"__esModule",{value:!0}),t.OscLinkService=void 0;const n=i(2585);let o=t.OscLinkService=class{constructor(e){this._bufferService=e,this._nextId=1,this._entriesWithId=new Map,this._dataByLinkId=new Map}registerLink(e){const t=this._bufferService.buffer;if(void 0===e.id){const i=t.addMarker(t.ybase+t.y),s={data:e,id:this._nextId++,lines:[i]};return i.onDispose((()=>this._removeMarkerFromLink(s,i))),this._dataByLinkId.set(s.id,s),s.id}const i=e,s=this._getEntryIdKey(i),r=this._entriesWithId.get(s);if(r)return this.addLineToLink(r.id,t.ybase+t.y),r.id;const n=t.addMarker(t.ybase+t.y),o={id:this._nextId++,key:this._getEntryIdKey(i),data:i,lines:[n]};return n.onDispose((()=>this._removeMarkerFromLink(o,n))),this._entriesWithId.set(o.key,o),this._dataByLinkId.set(o.id,o),o.id}addLineToLink(e,t){const i=this._dataByLinkId.get(e);if(i&&i.lines.every((e=>e.line!==t))){const e=this._bufferService.buffer.addMarker(t);i.lines.push(e),e.onDispose((()=>this._removeMarkerFromLink(i,e)))}}getLinkData(e){return this._dataByLinkId.get(e)?.data}_getEntryIdKey(e){return`${e.id};;${e.uri}`}_removeMarkerFromLink(e,t){const i=e.lines.indexOf(t);-1!==i&&(e.lines.splice(i,1),0===e.lines.length&&(void 0!==e.data.id&&this._entriesWithId.delete(e.key),this._dataByLinkId.delete(e.id)))}};t.OscLinkService=o=s([r(0,n.IBufferService)],o)},8343:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.createDecorator=t.getServiceDependencies=t.serviceRegistry=void 0;const i="di$target",s="di$dependencies";t.serviceRegistry=new Map,t.getServiceDependencies=function(e){return e[s]||[]},t.createDecorator=function(e){if(t.serviceRegistry.has(e))return t.serviceRegistry.get(e);const r=function(e,t,n){if(3!==arguments.length)throw new Error("@IServiceName-decorator can only be used to decorate a parameter");!function(e,t,r){t[i]===t?t[s].push({id:e,index:r}):(t[s]=[{id:e,index:r}],t[i]=t)}(r,e,n)};return r.toString=()=>e,t.serviceRegistry.set(e,r),r}},2585:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.IDecorationService=t.IUnicodeService=t.IOscLinkService=t.IOptionsService=t.ILogService=t.LogLevelEnum=t.IInstantiationService=t.ICharsetService=t.ICoreService=t.ICoreMouseService=t.IBufferService=void 0;const s=i(8343);var r;t.IBufferService=(0,s.createDecorator)("BufferService"),t.ICoreMouseService=(0,s.createDecorator)("CoreMouseService"),t.ICoreService=(0,s.createDecorator)("CoreService"),t.ICharsetService=(0,s.createDecorator)("CharsetService"),t.IInstantiationService=(0,s.createDecorator)("InstantiationService"),function(e){e[e.TRACE=0]="TRACE",e[e.DEBUG=1]="DEBUG",e[e.INFO=2]="INFO",e[e.WARN=3]="WARN",e[e.ERROR=4]="ERROR",e[e.OFF=5]="OFF"}(r||(t.LogLevelEnum=r={})),t.ILogService=(0,s.createDecorator)("LogService"),t.IOptionsService=(0,s.createDecorator)("OptionsService"),t.IOscLinkService=(0,s.createDecorator)("OscLinkService"),t.IUnicodeService=(0,s.createDecorator)("UnicodeService"),t.IDecorationService=(0,s.createDecorator)("DecorationService")},1480:(e,t,i)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.UnicodeService=void 0;const s=i(8460),r=i(225);class n{static extractShouldJoin(e){return 0!=(1&e)}static extractWidth(e){return e>>1&3}static extractCharKind(e){return e>>3}static createPropertyValue(e,t,i=!1){return(16777215&e)<<3|(3&t)<<1|(i?1:0)}constructor(){this._providers=Object.create(null),this._active="",this._onChange=new s.EventEmitter,this.onChange=this._onChange.event;const e=new r.UnicodeV6;this.register(e),this._active=e.version,this._activeProvider=e}dispose(){this._onChange.dispose()}get versions(){return Object.keys(this._providers)}get activeVersion(){return this._active}set activeVersion(e){if(!this._providers[e])throw new Error(`unknown Unicode version "${e}"`);this._active=e,this._activeProvider=this._providers[e],this._onChange.fire(e)}register(e){this._providers[e.version]=e}wcwidth(e){return this._activeProvider.wcwidth(e)}getStringCellWidth(e){let t=0,i=0;const s=e.length;for(let r=0;r<s;++r){let o=e.charCodeAt(r);if(55296<=o&&o<=56319){if(++r>=s)return t+this.wcwidth(o);const i=e.charCodeAt(r);56320<=i&&i<=57343?o=1024*(o-55296)+i-56320+65536:t+=this.wcwidth(i)}const a=this.charProperties(o,i);let h=n.extractWidth(a);n.extractShouldJoin(a)&&(h-=n.extractWidth(i)),t+=h,i=a}return t}charProperties(e,t){return this._activeProvider.charProperties(e,t)}}t.UnicodeService=n}},t={};function i(s){var r=t[s];if(void 0!==r)return r.exports;var n=t[s]={exports:{}};return e[s].call(n.exports,n,n.exports,i),n.exports}var s={};return(()=>{var e=s;Object.defineProperty(e,"__esModule",{value:!0}),e.Terminal=void 0;const t=i(9042),r=i(3236),n=i(844),o=i(5741),a=i(8285),h=i(7975),c=i(7090),l=["cols","rows"];class d extends n.Disposable{constructor(e){super(),this._core=this.register(new r.Terminal(e)),this._addonManager=this.register(new o.AddonManager),this._publicOptions={...this._core.options};const t=e=>this._core.options[e],i=(e,t)=>{this._checkReadonlyOptions(e),this._core.options[e]=t};for(const e in this._core.options){const s={get:t.bind(this,e),set:i.bind(this,e)};Object.defineProperty(this._publicOptions,e,s)}}_checkReadonlyOptions(e){if(l.includes(e))throw new Error(`Option "${e}" can only be set in the constructor`)}_checkProposedApi(){if(!this._core.optionsService.rawOptions.allowProposedApi)throw new Error("You must set the allowProposedApi option to true to use proposed API")}get onBell(){return this._core.onBell}get onBinary(){return this._core.onBinary}get onCursorMove(){return this._core.onCursorMove}get onData(){return this._core.onData}get onKey(){return this._core.onKey}get onLineFeed(){return this._core.onLineFeed}get onRender(){return this._core.onRender}get onResize(){return this._core.onResize}get onScroll(){return this._core.onScroll}get onSelectionChange(){return this._core.onSelectionChange}get onTitleChange(){return this._core.onTitleChange}get onWriteParsed(){return this._core.onWriteParsed}get element(){return this._core.element}get parser(){return this._parser||(this._parser=new h.ParserApi(this._core)),this._parser}get unicode(){return this._checkProposedApi(),new c.UnicodeApi(this._core)}get textarea(){return this._core.textarea}get rows(){return this._core.rows}get cols(){return this._core.cols}get buffer(){return this._buffer||(this._buffer=this.register(new a.BufferNamespaceApi(this._core))),this._buffer}get markers(){return this._checkProposedApi(),this._core.markers}get modes(){const e=this._core.coreService.decPrivateModes;let t="none";switch(this._core.coreMouseService.activeProtocol){case"X10":t="x10";break;case"VT200":t="vt200";break;case"DRAG":t="drag";break;case"ANY":t="any"}return{applicationCursorKeysMode:e.applicationCursorKeys,applicationKeypadMode:e.applicationKeypad,bracketedPasteMode:e.bracketedPasteMode,insertMode:this._core.coreService.modes.insertMode,mouseTrackingMode:t,originMode:e.origin,reverseWraparoundMode:e.reverseWraparound,sendFocusMode:e.sendFocus,wraparoundMode:e.wraparound}}get options(){return this._publicOptions}set options(e){for(const t in e)this._publicOptions[t]=e[t]}blur(){this._core.blur()}focus(){this._core.focus()}input(e,t=!0){this._core.input(e,t)}resize(e,t){this._verifyIntegers(e,t),this._core.resize(e,t)}open(e){this._core.open(e)}attachCustomKeyEventHandler(e){this._core.attachCustomKeyEventHandler(e)}attachCustomWheelEventHandler(e){this._core.attachCustomWheelEventHandler(e)}registerLinkProvider(e){return this._core.registerLinkProvider(e)}registerCharacterJoiner(e){return this._checkProposedApi(),this._core.registerCharacterJoiner(e)}deregisterCharacterJoiner(e){this._checkProposedApi(),this._core.deregisterCharacterJoiner(e)}registerMarker(e=0){return this._verifyIntegers(e),this._core.registerMarker(e)}registerDecoration(e){return this._checkProposedApi(),this._verifyPositiveIntegers(e.x??0,e.width??0,e.height??0),this._core.registerDecoration(e)}hasSelection(){return this._core.hasSelection()}select(e,t,i){this._verifyIntegers(e,t,i),this._core.select(e,t,i)}getSelection(){return this._core.getSelection()}getSelectionPosition(){return this._core.getSelectionPosition()}clearSelection(){this._core.clearSelection()}selectAll(){this._core.selectAll()}selectLines(e,t){this._verifyIntegers(e,t),this._core.selectLines(e,t)}dispose(){super.dispose()}scrollLines(e){this._verifyIntegers(e),this._core.scrollLines(e)}scrollPages(e){this._verifyIntegers(e),this._core.scrollPages(e)}scrollToTop(){this._core.scrollToTop()}scrollToBottom(){this._core.scrollToBottom()}scrollToLine(e){this._verifyIntegers(e),this._core.scrollToLine(e)}clear(){this._core.clear()}write(e,t){this._core.write(e,t)}writeln(e,t){this._core.write(e),this._core.write("\\r\\n",t)}paste(e){this._core.paste(e)}refresh(e,t){this._verifyIntegers(e,t),this._core.refresh(e,t)}reset(){this._core.reset()}clearTextureAtlas(){this._core.clearTextureAtlas()}loadAddon(e){this._addonManager.loadAddon(this,e)}static get strings(){return t}_verifyIntegers(...e){for(const t of e)if(t===1/0||isNaN(t)||t%1!=0)throw new Error("This API only accepts integers")}_verifyPositiveIntegers(...e){for(const t of e)if(t&&(t===1/0||isNaN(t)||t%1!=0||t<0))throw new Error("This API only accepts positive integers")}}e.Terminal=d})(),s})()));\n//# sourceMappingURL=xterm.js.map'],
      "/fit.js": ["text/javascript", '!function(e,t){"object"==typeof exports&&"object"==typeof module?module.exports=t():"function"==typeof define&&define.amd?define([],t):"object"==typeof exports?exports.FitAddon=t():e.FitAddon=t()}(self,(()=>(()=>{"use strict";var e={};return(()=>{var t=e;Object.defineProperty(t,"__esModule",{value:!0}),t.FitAddon=void 0,t.FitAddon=class{activate(e){this._terminal=e}dispose(){}fit(){const e=this.proposeDimensions();if(!e||!this._terminal||isNaN(e.cols)||isNaN(e.rows))return;const t=this._terminal._core;this._terminal.rows===e.rows&&this._terminal.cols===e.cols||(t._renderService.clear(),this._terminal.resize(e.cols,e.rows))}proposeDimensions(){if(!this._terminal)return;if(!this._terminal.element||!this._terminal.element.parentElement)return;const e=this._terminal._core,t=e._renderService.dimensions;if(0===t.css.cell.width||0===t.css.cell.height)return;const r=0===this._terminal.options.scrollback?0:e.viewport.scrollBarWidth,i=window.getComputedStyle(this._terminal.element.parentElement),o=parseInt(i.getPropertyValue("height")),s=Math.max(0,parseInt(i.getPropertyValue("width"))),n=window.getComputedStyle(this._terminal.element),l=o-(parseInt(n.getPropertyValue("padding-top"))+parseInt(n.getPropertyValue("padding-bottom"))),a=s-(parseInt(n.getPropertyValue("padding-right"))+parseInt(n.getPropertyValue("padding-left")))-r;return{cols:Math.max(2,Math.floor(a/t.css.cell.width)),rows:Math.max(1,Math.floor(l/t.css.cell.height))}}}})(),e})()));\n//# sourceMappingURL=addon-fit.js.map'],
      "/terminal.css": ["text/css", `/**
 * Copyright (c) 2014 The xterm.js authors. All rights reserved.
 * Copyright (c) 2012-2013, Christopher Jeffrey (MIT License)
 * https://github.com/chjj/term.js
 * @license MIT
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Originally forked from (with the author's permission):
 *   Fabrice Bellard's javascript vt100 for jslinux:
 *   http://bellard.org/jslinux/
 *   Copyright (c) 2011 Fabrice Bellard
 *   The original design remains. The terminal itself
 *   has been extended to include xterm CSI codes, among
 *   other features.
 */

/**
 *  Default styles for xterm.js
 */

.xterm {
    cursor: text;
    position: relative;
    user-select: none;
    -ms-user-select: none;
    -webkit-user-select: none;
}

.xterm.focus,
.xterm:focus {
    outline: none;
}

.xterm .xterm-helpers {
    position: absolute;
    top: 0;
    /**
     * The z-index of the helpers must be higher than the canvases in order for
     * IMEs to appear on top.
     */
    z-index: 5;
}

.xterm .xterm-helper-textarea {
    padding: 0;
    border: 0;
    margin: 0;
    /* Move textarea out of the screen to the far left, so that the cursor is not visible */
    position: absolute;
    opacity: 0;
    left: -9999em;
    top: 0;
    width: 0;
    height: 0;
    z-index: -5;
    /** Prevent wrapping so the IME appears against the textarea at the correct position */
    white-space: nowrap;
    overflow: hidden;
    resize: none;
}

.xterm .composition-view {
    /* TODO: Composition position got messed up somewhere */
    background: #000;
    color: #FFF;
    display: none;
    position: absolute;
    white-space: nowrap;
    z-index: 1;
}

.xterm .composition-view.active {
    display: block;
}

.xterm .xterm-viewport {
    /* On OS X this is required in order for the scroll bar to appear fully opaque */
    background-color: #000;
    overflow-y: scroll;
    cursor: default;
    position: absolute;
    right: 0;
    left: 0;
    top: 0;
    bottom: 0;
}

.xterm .xterm-screen {
    position: relative;
}

.xterm .xterm-screen canvas {
    position: absolute;
    left: 0;
    top: 0;
}

.xterm .xterm-scroll-area {
    visibility: hidden;
}

.xterm-char-measure-element {
    display: inline-block;
    visibility: hidden;
    position: absolute;
    top: 0;
    left: -9999em;
    line-height: normal;
}

.xterm.enable-mouse-events {
    /* When mouse events are enabled (eg. tmux), revert to the standard pointer cursor */
    cursor: default;
}

.xterm.xterm-cursor-pointer,
.xterm .xterm-cursor-pointer {
    cursor: pointer;
}

.xterm.column-select.focus {
    /* Column selection mode */
    cursor: crosshair;
}

.xterm .xterm-accessibility:not(.debug),
.xterm .xterm-message {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    right: 0;
    z-index: 10;
    color: transparent;
    pointer-events: none;
}

.xterm .xterm-accessibility-tree:not(.debug) *::selection {
  color: transparent;
}

.xterm .xterm-accessibility-tree {
  user-select: text;
  white-space: pre;
}

.xterm .live-region {
    position: absolute;
    left: -9999px;
    width: 1px;
    height: 1px;
    overflow: hidden;
}

.xterm-dim {
    /* Dim should not apply to background, so the opacity of the foreground color is applied
     * explicitly in the generated class and reset to 1 here */
    opacity: 1 !important;
}

.xterm-underline-1 { text-decoration: underline; }
.xterm-underline-2 { text-decoration: double underline; }
.xterm-underline-3 { text-decoration: wavy underline; }
.xterm-underline-4 { text-decoration: dotted underline; }
.xterm-underline-5 { text-decoration: dashed underline; }

.xterm-overline {
    text-decoration: overline;
}

.xterm-overline.xterm-underline-1 { text-decoration: overline underline; }
.xterm-overline.xterm-underline-2 { text-decoration: overline double underline; }
.xterm-overline.xterm-underline-3 { text-decoration: overline wavy underline; }
.xterm-overline.xterm-underline-4 { text-decoration: overline dotted underline; }
.xterm-overline.xterm-underline-5 { text-decoration: overline dashed underline; }

.xterm-strikethrough {
    text-decoration: line-through;
}

.xterm-screen .xterm-decoration-container .xterm-decoration {
	z-index: 6;
	position: absolute;
}

.xterm-screen .xterm-decoration-container .xterm-decoration.xterm-decoration-top-layer {
	z-index: 7;
}

.xterm-decoration-overview-ruler {
    z-index: 8;
    position: absolute;
    top: 0;
    right: 0;
    pointer-events: none;
}

.xterm-decoration-top {
    z-index: 2;
    position: relative;
}
`]
    };
    if (request.method === "GET" && Object.prototype.hasOwnProperty.call(assets, request.url || "")) {
      const [type, body] = assets[request.url];
      response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
      response.end(body);
      return;
    }
    if (request.method !== "POST" || request.headers.authorization !== `Bearer ${config.token}`) {
      reply(403, "Forbidden");
      return;
    }
    try {
      let body = "";
      request.setEncoding("utf8");
      for await (const chunk of request) {
        body += chunk.toString();
        if (Buffer.byteLength(body) > 65536) {
          reply(413, "Request too large");
          return;
        }
      }
      const value = JSON.parse(body);
      switch (request.url) {
        case "/poll": {
          if (!Number.isSafeInteger(value.sequence) || value.sequence < 0) throw new Error("Invalid sequence");
          reply(200, {
            entries: entries.filter((entry) => entry.sequence > value.sequence),
            exited,
            exitCode,
            retained,
            gap: entries.length > 0 && value.sequence < entries[0].sequence - 1
          });
          return;
        }
        case "/input":
          if (typeof value.data !== "string" || value.data.length > 32768) throw new Error("Invalid input");
          if (!exited) pty.write(value.data);
          break;
        case "/resize":
          if (![value.cols, value.rows].every((n) => Number.isInteger(n) && n > 0 && n <= 32767)) throw new Error("Invalid size");
          if (!exited) pty.resize(value.cols, value.rows);
          break;
        case "/external-ready":
          externalReady = Date.now();
          break;
        case "/detach":
          if (exited || Date.now() - externalReady > 5e3) {
            reply(409, "External terminal is not connected");
            return;
          }
          retained = true;
          notifyParent({ type: "retained" });
          break;
        case "/stop":
          await pty.kill();
          break;
        default:
          reply(404, "Not found");
          return;
      }
      reply(200, { retained });
    } catch {
      reply(400, "Terminal operation failed; do not assume the process stopped");
    }
  });
  server.requestTimeout = 1e4;
  server.headersTimeout = 1e4;
  server.maxConnections = 32;
  await new Promise((resolve8, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve8());
  });
  const address = server.address();
  notifyParent({ type: "ready", port: address.port, pid: pty.pid });
}
function startTerminalSessionHost() {
  process.once("message", (config) => {
    void runTerminalSessionHost(config).catch(() => {
      notifyParent({ type: "failed" });
      process.exitCode = 1;
      if (process.connected) process.disconnect();
    });
  });
}

// autooc-runtime.ts
if (require.main === module && process.argv[2] === "--autooc-terminal-host") startTerminalSessionHost();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  RELEASE_DESCRIPTOR,
  RELEASE_FILES,
  abandonInstalledExecution,
  acquireExecutionLease,
  answerWorkflowApproval,
  combineWorkflowTaskAdapters,
  createCodeWorkflowAdapter,
  createCodexWorkflowAdapter,
  createWorkflowEvaluator,
  createWorkflowTaskAdapter,
  disposeTerminalExecution,
  executionCoordinator,
  inspectTerminalExecution,
  installRelease,
  maintainRelease,
  persistWorkflowProgress,
  prepareWorkflowDefinition,
  readExecutionLeaseOwner,
  recoverExecutionLease,
  requestWorkflowStop,
  resolveInstalledWorkflowLocation,
  runCodeWorkflowHost,
  runInstalledWorkflow,
  validateConcurrency,
  verifyRelease
});
