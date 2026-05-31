/**
 * Error types for the dictionary lookup module.
 *
 * Provides structured error handling with error codes
 * and programmatic classification for different failure scenarios.
 */

// ---------------------------------------------------------------------------
// Error Codes
// ---------------------------------------------------------------------------

/**
 * Error codes for dictionary lookup failures.
 */
export type DictionaryErrorCode =
  | "FETCH_FAILED"
  | "PARSE_FAILED"
  | "TIMEOUT"
  | "NOT_FOUND"
  | "UNKNOWN_ERROR";

// ---------------------------------------------------------------------------
// Error Class
// ---------------------------------------------------------------------------

/**
 * Structured error from dictionary operations.
 * Includes the error code, which source provider failed,
 * and whether the operation can be retried.
 */
export class DictionaryError extends Error {
  /** Machine-readable error code */
  readonly code: DictionaryErrorCode;
  /** The dictionary source that produced this error */
  readonly source: string;
  /** Whether retrying the operation may succeed */
  readonly retryable: boolean;

  constructor(
    code: DictionaryErrorCode,
    message: string,
    source: string,
    retryable = false
  ) {
    super(message);
    this.name = "DictionaryError";
    this.code = code;
    this.source = source;
    this.retryable = retryable;
  }
}

// ---------------------------------------------------------------------------
// Factory Functions
// ---------------------------------------------------------------------------

/**
 * Create an error for a failed fetch/network request.
 * Retrying may succeed if the network issue is transient.
 */
export function handleFetchError(
  err: unknown,
  source: string
): DictionaryError {
  const message = err instanceof Error ? err.message : String(err);
  return new DictionaryError(
    "FETCH_FAILED",
    `Failed to fetch from ${source}: ${message}`,
    source,
    true
  );
}

/**
 * Create an error for a failed parse/response interpretation.
 * Retrying is unlikely to help unless the upstream data changes.
 */
export function handleParseError(
  err: unknown,
  source: string
): DictionaryError {
  const message = err instanceof Error ? err.message : String(err);
  return new DictionaryError(
    "PARSE_FAILED",
    `Failed to parse response from ${source}: ${message}`,
    source,
    false
  );
}

/**
 * Create an error for a request that exceeded the timeout.
 * Retrying may succeed if the server is temporarily slow.
 */
export function handleTimeout(source: string): DictionaryError {
  return new DictionaryError(
    "TIMEOUT",
    `Request to ${source} timed out`,
    source,
    true
  );
}

/**
 * Create an error when the word was not found in the dictionary.
 * Retrying is unlikely to help for a missing word.
 */
export function handleNoResult(source: string): DictionaryError {
  return new DictionaryError(
    "NOT_FOUND",
    `Word not found in ${source}`,
    source,
    false
  );
}
