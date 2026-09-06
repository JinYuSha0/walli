import type { RetryPolicy } from "@langchain/langgraph";

export type PersistentRetryOptions = {
  maxAttempts?: number;
  initialInterval?: number;
  backoffFactor?: number;
  maxInterval?: number;
  jitter?: boolean;
};

export const DEFAULT_PERSISTENT_RETRY_OPTIONS = {
  maxAttempts: 8,
  initialInterval: 1_000,
  backoffFactor: 2,
  maxInterval: 60 * 60_000,
  jitter: true,
} satisfies Required<PersistentRetryOptions>;

export const normalizePersistentRetryOptions = (
  options: PersistentRetryOptions = {},
): Required<PersistentRetryOptions> => {
  const finite = (value: number | undefined, fallback: number) =>
    value !== undefined && Number.isFinite(value) ? value : fallback;
  const maxAttempts = Math.max(
    1,
    Math.trunc(finite(options.maxAttempts, DEFAULT_PERSISTENT_RETRY_OPTIONS.maxAttempts)),
  );
  const initialInterval = Math.max(
    0,
    Math.trunc(finite(options.initialInterval, DEFAULT_PERSISTENT_RETRY_OPTIONS.initialInterval)),
  );
  const backoffFactor = Math.max(
    1,
    finite(options.backoffFactor, DEFAULT_PERSISTENT_RETRY_OPTIONS.backoffFactor),
  );
  const maxInterval = Math.max(
    initialInterval,
    Math.trunc(finite(options.maxInterval, DEFAULT_PERSISTENT_RETRY_OPTIONS.maxInterval)),
  );

  return {
    maxAttempts,
    initialInterval,
    backoffFactor,
    maxInterval,
    jitter: options.jitter ?? DEFAULT_PERSISTENT_RETRY_OPTIONS.jitter,
  };
};

export const calculateRetryDelay = (
  attemptCount: number,
  options: Required<PersistentRetryOptions>,
  random: () => number = Math.random,
): number => {
  const exponentialDelay = Math.min(
    options.maxInterval,
    options.initialInterval * options.backoffFactor ** Math.max(0, attemptCount - 1),
  );
  if (!options.jitter || exponentialDelay === 0) return exponentialDelay;
  return Math.floor(random() * (exponentialDelay + 1));
};

export class RetryableError extends Error {
  override readonly name = "RetryableError";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export class NonRetryableError extends Error {
  override readonly name = "NonRetryableError";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

/** Retry every ordinary node exception unless the business code explicitly opts out. */
export const isRetryableError = (error: unknown): boolean => {
  if (error instanceof NonRetryableError) return false;
  if (error instanceof Error && error.name === "AbortError") return false;
  return true;
};

/** Generic, in-invocation retry policy for LangGraph node exceptions. */
export const nodeRetryPolicy = {
  maxAttempts: 3,
  initialInterval: 500,
  backoffFactor: 2,
  maxInterval: 5_000,
  jitter: true,
  retryOn: isRetryableError,
  logWarning: true,
} satisfies RetryPolicy;
