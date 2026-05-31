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
    if (error instanceof AIServiceError) {
      return error;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes("network") || message.includes("fetch")) {
        return new AIServiceError("NETWORK_ERROR", error.message, true);
      }
      if (message.includes("timeout")) {
        return new AIServiceError("TIMEOUT", error.message, true);
      }
      if (message.includes("unauthorized") || message.includes("401")) {
        return new AIServiceError("AUTH_ERROR", error.message);
      }
    }

    return new AIServiceError(
      "UNKNOWN_ERROR",
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  /**
   * Execute an operation with automatic retry and error handling.
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    onRetry?: (attempt: number, error: AIServiceError) => void
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

        // Exponential backoff: 500ms, 1000ms, 2000ms
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * Math.pow(2, attempt))
        );
      }
    }

    throw lastError;
  }
}
