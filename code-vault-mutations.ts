// Host-only callbacks: never part of task definitions or the Code sandbox.
export interface VaultMutation {
  path: string;
  operation: "write" | "append";
}

export interface VaultMutationBatch {
  record: (mutation: VaultMutation) => void;
  flush: () => Promise<void>;
}

export type VaultMutationBatchFactory = () => VaultMutationBatch;

// Keep the interpreter synchronous, but settle durable mutations before a host
// reports completion (including scripts that throw after a successful write).
export async function runWithVaultMutations<T>(
  factory: VaultMutationBatchFactory | undefined,
  execute: (record: VaultMutationBatch["record"] | undefined) => T,
): Promise<T> {
  const batch = factory?.();
  let result!: T;
  let failed = false;
  let original: unknown;
  try { result = execute(batch?.record); }
  catch (error) { failed = true; original = error; }
  try { await batch?.flush(); }
  catch (refreshError) {
    if (!failed) throw refreshError;
    const combined = new Error(`${String(original)}; ${String(refreshError)}`);
    (combined as Error & { cause?: unknown }).cause = original;
    throw combined;
  }
  if (failed) throw original;
  return result;
}
