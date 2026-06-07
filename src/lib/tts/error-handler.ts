/**
 * Error classification and user-friendly messages for the TTS module.
 */

import { TTSServiceError, type TTSErrorCode } from "./service";

// ---------------------------------------------------------------------------
// Error Messages
// ---------------------------------------------------------------------------

/**
 * User-friendly error messages for each error code.
 */
export const ERROR_MESSAGES: Record<TTSErrorCode, string> = {
  NETWORK_ERROR: "无法连接到TTS服务，请检查网络连接",
  AUTH_ERROR: "API密钥无效，请检查配置",
  PROVIDER_ERROR: "TTS服务返回错误，请稍后重试",
  RATE_LIMITED: "请求过于频繁，请稍后重试",
  TIMEOUT: "请求超时，请稍后重试",
  UNKNOWN_ERROR: "发生未知错误",
};

// ---------------------------------------------------------------------------
// Error Classification
// ---------------------------------------------------------------------------

/**
 * Classify an unknown error into a TTSServiceError.
 */
export function classifyError(error: unknown): TTSServiceError {
  if (error instanceof TTSServiceError) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("network") || message.includes("fetch")) {
      return new TTSServiceError("NETWORK_ERROR", error.message, true);
    }
    if (message.includes("timeout")) {
      return new TTSServiceError("TIMEOUT", error.message, true);
    }
    if (message.includes("unauthorized") || message.includes("401")) {
      return new TTSServiceError("AUTH_ERROR", error.message);
    }
    if (message.includes("429") || message.includes("rate limit")) {
      return new TTSServiceError("RATE_LIMITED", error.message, true);
    }
  }

  return new TTSServiceError(
    "UNKNOWN_ERROR",
    error instanceof Error ? error.message : "Unknown error"
  );
}

// ---------------------------------------------------------------------------
// User-Friendly Messages
// ---------------------------------------------------------------------------

/**
 * Get a user-friendly message for a given error code.
 */
export function getErrorMessage(code: TTSErrorCode): string {
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.UNKNOWN_ERROR;
}

// ---------------------------------------------------------------------------
// Combined Handler
// ---------------------------------------------------------------------------

/**
 * Classify an unknown error and return a user-friendly message.
 */
export function handleTTSError(error: unknown): TTSServiceError {
  const classified = classifyError(error);
  classified.message = getErrorMessage(classified.code);
  return classified;
}
