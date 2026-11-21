// Error metadata only. Arbitrary messages, paths, values and function names are private.
export const failureStages = ["execution", "catalog-validation", "catalog-read", "catalog-projection", "catalog-save", "task-history", "host-publication", "host-adoption", "host-render", "receipt-publication"] as const;
export type FailureStage = typeof failureStages[number];
const stages = new WeakMap<object, FailureStage>();
const names = ["Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError", "AbortError"];
const codes = ["EACCES", "EPERM", "EBUSY", "EIO", "ENOSPC", "ENOENT", "EEXIST", "EMFILE", "EINVAL", "ETIMEDOUT", "EPIPE"];
const reasons: Record<string, string> = {
  "Catalog progress does not match the durable checkpoint": "checkpoint_mismatch",
  "Progress identity or definition mismatch": "definition_mismatch",
  "Stale progress cannot replace current execution": "stale_progress",
  "AutoOC confirmed catalog changed externally; reload before saving": "confirmed_catalog_changed",
  "AutoOC configuration changed externally; reload before saving": "catalog_changed",
  "AutoOC configuration changed during preparation; reload before saving": "catalog_changed_during_preparation",
  "AutoOC configuration changed during replacement; reload before saving": "catalog_changed_during_replacement",
  "Configuration changed while reading": "catalog_changed_during_read",
  "Configuration identity changed while reading": "catalog_identity_changed",
  "Settings write lock ownership changed": "settings_lock_changed",
  "Settings intent ownership changed": "settings_intent_owner_changed",
  "Settings write evidence retained for recovery": "settings_recovery_required",
  "Catalog has no confirmed version": "catalog_version_missing",
  "AutoOC settings changed while loading; reload before saving": "settings_changed_during_load",
  "AutoOC settings changed during recovery; reload before saving": "settings_changed_during_recovery",
  "AutoOC settings changed during execution; local edits preserved; reload before continuing": "settings_changed_during_execution",
  "Confirmed catalog progress identity mismatch": "host_progress_identity_mismatch",
  "CLI receipt identity changed": "receipt_identity_changed",
  "CLI publication temporary identity changed": "receipt_temporary_changed",
};
const sourceFiles = ["main.js", "main.ts", "autooc-runtime.cjs", "autooc-cli.cjs", "settings-writer.ts", "workflow-catalog-progress.ts", "cli-plugin-requests.ts", "workflow-session.ts", "installed-workflow-host.ts"];
export interface ExecutionFailure {
  stage: FailureStage; name: string; code?: string; reason: string;
  frames: Array<{file: string; line: number; column: number}>;
}

export function markExecutionFailure(error: unknown, stage: FailureStage): void {
  if (error && (typeof error === "object" || typeof error === "function") && !stages.has(error)) stages.set(error, stage);
}
export async function withFailureStage<T>(stage: FailureStage, operation: () => T | Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) { markExecutionFailure(error, stage); throw error; }
}

export function describeExecutionFailure(error: unknown): ExecutionFailure {
  const result: ExecutionFailure = {stage: "execution", name: "Error", reason: "unclassified", frames: []};
  // Error accessors and cross-realm thrown values are untrusted too.
  try {
    if (!error || typeof error !== "object") return result;
    result.stage = stages.get(error) || "execution";
    const value = error as {name?: unknown; code?: unknown; message?: unknown; stack?: unknown};
    const name = value.name;
    if (typeof name === "string" && names.includes(name)) result.name = name;
    const code = value.code;
    if (typeof code === "string" && codes.includes(code)) result.code = code;
    const message = value.message;
    if (typeof message === "string" && Object.prototype.hasOwnProperty.call(reasons, message)) result.reason = reasons[message];
    const stack = value.stack;
    if (typeof stack === "string") for (const line of stack.slice(0, 16384).split("\n").slice(1)) {
      const match = line.match(/[\\/](main\.(?:js|ts)|autooc-(?:runtime|cli)\.cjs|settings-writer\.ts|workflow-catalog-progress\.ts|cli-plugin-requests\.ts|workflow-session\.ts|installed-workflow-host\.ts):(\d+):(\d+)\)?$/);
      if (match && result.frames.length < 8) result.frames.push({file: match[1], line: Number(match[2]), column: Number(match[3])});
    }
  } catch { /* The original failure must remain the outcome. */ }
  return result;
}

// Also apply the allowlist on reads: disk diagnostics are data, not trusted output.
export function readExecutionFailure(value: any): ExecutionFailure | undefined {
  if (!value || !failureStages.includes(value.stage) || !names.includes(value.name) ||
      !["unclassified", ...Object.values(reasons)].includes(value.reason)) return undefined;
  return {stage: value.stage, name: value.name, reason: value.reason,
    ...(codes.includes(value.code) ? {code: value.code} : {}),
    frames: Array.isArray(value.frames) ? value.frames.slice(0, 8).filter((f: any) => f && sourceFiles.includes(f.file) &&
      Number.isSafeInteger(f.line) && f.line > 0 && Number.isSafeInteger(f.column) && f.column > 0)
      .map((f: any) => ({file: f.file, line: f.line, column: f.column})) : []};
}
