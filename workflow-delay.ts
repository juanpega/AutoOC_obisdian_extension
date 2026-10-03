export function workflowDelay(value = 0, unit = "seconds") {
  if (!Number.isFinite(value)) throw new Error("Invalid workflow delay");
  const amount = Math.max(0, value);
  const milliseconds = amount * (unit === "hours" ? 3600000 : unit === "minutes" ? 60000 : 1000);
  if (!Number.isSafeInteger(Math.ceil(milliseconds))) throw new Error("Workflow delay is too large");
  return { milliseconds, output: `[delay ${amount} ${unit}]` };
}

// Chunk long waits: Node otherwise turns delays over 2^31-1 into ~1ms.
export function waitForWorkflowDelay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return Promise.reject(new Error("Invalid workflow delay"));
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    let remaining = milliseconds;
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); const error = new Error("Workflow delay cancelled"); error.name = "AbortError"; reject(error); };
    const schedule = () => {
      const chunk = Math.min(remaining, 2147483647);
      remaining -= chunk;
      timer = setTimeout(() => { if (remaining > 0) schedule(); else { cleanup(); resolve(); } }, chunk);
    };
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener("abort", abort, {once:true});
    schedule();
  });
}
