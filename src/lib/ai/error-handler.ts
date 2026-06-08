import { AIServiceError, type AIServiceErrorCode } from "./service";

/**
 * User-friendly error messages for each error code.
 */
const ERROR_MESSAGES: Record<AIServiceErrorCode, string> = {
  NETWORK_ERROR: "无法连接到AI服务，请检查网络连接",
  API_ERROR: "AI服务返回错误，请稍后重试",
  AUTH_ERROR: "API密钥无效，请检查配置",
  RATE_LIMITED: "请求过于频繁，请稍后重试",
  TIMEOUT: "请求超时，请稍后重试",
  UNKNOWN_ERROR: "发生未知错误",
};

const NETWORK_ERROR_PATTERNS = [
  "network",
  "fetch",
  "failed to fetch",
  "load failed",
  "err_connection_reset",
  "connection reset",
  "connection refused",
  "connection closed",
  "connection aborted",
  "socket",
  "econnreset",
  "econnrefused",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringProperty(error: unknown, key: string): string | undefined {
  const value = isRecord(error) ? error[key] : undefined;
  return typeof value === "string" ? value : undefined;
}

function getErrorCause(error: unknown): unknown {
  return isRecord(error) ? error.cause : undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorText(error: unknown): string {
  return [
    getStringProperty(error, "name"),
    getStringProperty(error, "code"),
    error instanceof Error ? error.message : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase();
}

function isAbortError(error: unknown): boolean {
  const text = errorText(error);
  return getStringProperty(error, "name") === "AbortError" || text.includes("aborterror");
}

function isNetworkError(error: unknown): boolean {
  const text = errorText(error);
  return NETWORK_ERROR_PATTERNS.some((pattern) => text.includes(pattern));
}

/**
 * Centralized error handler for AI service operations.
 */
export class AIErrorHandler {
  /**
   * Get a user-friendly error message for an error.
   */
  getUserMessage(error: unknown): string {
    if (error instanceof AIServiceError) {
      return ERROR_MESSAGES[error.code] ?? ERROR_MESSAGES.UNKNOWN_ERROR;
    }
    return ERROR_MESSAGES.UNKNOWN_ERROR;
  }

  /**
   * Classify an unknown error into an AIServiceError.
   */
  classifyError(error: unknown): AIServiceError {
    return this.classifyErrorInternal(error, new Set<unknown>());
  }

  private classifyErrorInternal(
    error: unknown,
    seen: Set<unknown>,
  ): AIServiceError {
    if (error instanceof AIServiceError) {
      return error;
    }

    if (seen.has(error)) {
      return new AIServiceError("UNKNOWN_ERROR", getErrorMessage(error));
    }
    seen.add(error);

    if (isAbortError(error)) {
      return new AIServiceError("UNKNOWN_ERROR", getErrorMessage(error));
    }

    const cause = getErrorCause(error);
    if (cause !== undefined) {
      const causeError = this.classifyErrorInternal(cause, seen);
      if (causeError.code !== "UNKNOWN_ERROR" || causeError.retryable) {
        return causeError;
      }
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (isNetworkError(error)) {
        return new AIServiceError("NETWORK_ERROR", error.message, true);
      }
      if (message.includes("timeout")) {
        return new AIServiceError("TIMEOUT", error.message, true);
      }
      if (message.includes("unauthorized") || message.includes("401")) {
        return new AIServiceError("AUTH_ERROR", error.message);
      }
    }

    return new AIServiceError("UNKNOWN_ERROR", getErrorMessage(error));
  }

  /**
   * Execute an operation with automatic retry and error handling.
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    onRetry?: (attempt: number, error: AIServiceError) => void,
  ): Promise<T> {
    let lastError: AIServiceError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = this.classifyError(error);

        if (!lastError.retryable || attempt === maxRetries) {
          throw lastError;
        }

        onRetry?.(attempt + 1, lastError);

        await new Promise((resolve) =>
          setTimeout(resolve, 500 * Math.pow(2, attempt)),
        );
      }
    }

    throw lastError;
  }
}
