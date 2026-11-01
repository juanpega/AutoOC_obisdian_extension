export type ConcurrencyPolicy = "exclusive" | "independent" | "parallel";
export interface ConcurrencySettings {
  defaultConcurrency: ConcurrencyPolicy;
  /** Zero means no AutoOC admission limit. */
  maxConcurrentExecutions: number;
}

export function validateConcurrency(item: Readonly<Record<string, any>>): void {
  if (item.concurrency !== undefined && !["exclusive", "independent", "parallel"].includes(item.concurrency)) {
    throw new Error("Invalid concurrency policy");
  }
}

export function concurrencySettings(settings: Readonly<Record<string, any>>): ConcurrencySettings {
  const defaultConcurrency = settings.defaultConcurrency === undefined ? "parallel" : settings.defaultConcurrency;
  validateConcurrency({concurrency: defaultConcurrency});
  const maxConcurrentExecutions = settings.maxConcurrentExecutions === undefined ? 0 : settings.maxConcurrentExecutions;
  if (!Number.isSafeInteger(maxConcurrentExecutions) || maxConcurrentExecutions < 0) {
    throw new Error("Maximum simultaneous runs must be a whole number of zero or more");
  }
  return {defaultConcurrency, maxConcurrentExecutions};
}
