/**
 * Tests for useTranslation hook.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AIServiceError } from "@/lib/ai/service";
import { AIErrorHandler } from "@/lib/ai/error-handler";

// Mock translation service
const mockTranslateStream = vi.fn();
const mockCacheTranslation = vi.fn();

vi.mock("@/lib/ai/translation", () => ({
  translationService: {
    translateStream: mockTranslateStream,
    cacheTranslation: mockCacheTranslation,
  },
}));

// Mock AI config store
vi.mock("@/stores/useAIConfigStore", () => ({
  useAIConfigStore: () => ({
    config: {
      providers: [{ id: "test", enabled: true }],
      selectedProviderId: "test",
      contextConfig: { modules: [] },
    },
  }),
}));

describe("AIErrorHandler retry integration", () => {
  let errorHandler: AIErrorHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    errorHandler = new AIErrorHandler();
  });

  it("should retry on retryable errors (network error)", async () => {
    const networkError = new AIServiceError(
      "NETWORK_ERROR",
      "fetch failed",
      true,
    );

    // First call fails, second succeeds
    mockTranslateStream
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce({
        textStream: (async function* () {
          yield "你好世界";
        })(),
        provider: { id: "test" },
      });

    let attemptCount = 0;
    const onRetry = vi.fn();

    const operation = async () => {
      attemptCount++;
      return mockTranslateStream("Hello world", "Chinese", {} as any);
    };

    // Use real timers for this test
    vi.useRealTimers();

    const result = await errorHandler.withRetry(operation, 3, onRetry);

    expect(attemptCount).toBe(2);
    expect(mockTranslateStream).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.objectContaining({
      code: "NETWORK_ERROR",
    }));
    expect(result).toBeDefined();
  });

  it("should not retry on non-retryable errors (auth error)", async () => {
    const authError = new AIServiceError(
      "AUTH_ERROR",
      "Invalid API key",
      false,
    );

    mockTranslateStream.mockRejectedValue(authError);

    let attemptCount = 0;
    const operation = async () => {
      attemptCount++;
      return mockTranslateStream("Hello world", "Chinese", {} as any);
    };

    await expect(errorHandler.withRetry(operation, 3)).rejects.toThrow(
      "Invalid API key",
    );

    expect(attemptCount).toBe(1);
    expect(mockTranslateStream).toHaveBeenCalledTimes(1);
  });

  it("should fail after max retries", async () => {
    const networkError = new AIServiceError(
      "NETWORK_ERROR",
      "fetch failed",
      true,
    );

    // All calls fail
    mockTranslateStream.mockRejectedValue(networkError);

    let attemptCount = 0;
    const onRetry = vi.fn();

    const operation = async () => {
      attemptCount++;
      return mockTranslateStream("Hello world", "Chinese", {} as any);
    };

    await expect(errorHandler.withRetry(operation, 3, onRetry)).rejects.toThrow(
      "fetch failed",
    );

    // Should have tried 4 times (initial + 3 retries)
    expect(attemptCount).toBe(4);
    expect(mockTranslateStream).toHaveBeenCalledTimes(4);
    expect(onRetry).toHaveBeenCalledTimes(3);
  });

  it("should show Chinese error message for network errors", () => {
    const networkError = new AIServiceError(
      "NETWORK_ERROR",
      "Connection reset",
      true,
    );
    const message = errorHandler.getUserMessage(networkError);
    expect(message).toBe("无法连接到AI服务，请检查网络连接");

    const authError = new AIServiceError("AUTH_ERROR", "Invalid API key");
    expect(errorHandler.getUserMessage(authError)).toBe(
      "API密钥无效，请检查配置",
    );

    const timeoutError = new AIServiceError("TIMEOUT", "Request timeout", true);
    expect(errorHandler.getUserMessage(timeoutError)).toBe("请求超时，请稍后重试");

    const rateLimitError = new AIServiceError(
      "RATE_LIMITED",
      "Too many requests",
      true,
    );
    expect(errorHandler.getUserMessage(rateLimitError)).toBe(
      "请求过于频繁，请稍后重试",
    );

    const apiError = new AIServiceError("API_ERROR", "Server error", true);
    expect(errorHandler.getUserMessage(apiError)).toBe(
      "AI服务返回错误，请稍后重试",
    );

    const unknownError = new AIServiceError("UNKNOWN_ERROR", "Something weird");
    expect(errorHandler.getUserMessage(unknownError)).toBe("发生未知错误");
  });

  it("should classify network errors as retryable", () => {
    // Network error
    const networkError = new Error("fetch failed");
    const classified = errorHandler.classifyError(networkError);
    expect(classified.code).toBe("NETWORK_ERROR");
    expect(classified.retryable).toBe(true);

    // Another network error pattern
    const networkError2 = new Error("Network request failed");
    const classified2 = errorHandler.classifyError(networkError2);
    expect(classified2.code).toBe("NETWORK_ERROR");
    expect(classified2.retryable).toBe(true);

    // Timeout error
    const timeoutError = new Error("Connection timeout");
    const classifiedTimeout = errorHandler.classifyError(timeoutError);
    expect(classifiedTimeout.code).toBe("TIMEOUT");
    expect(classifiedTimeout.retryable).toBe(true);

    // Auth error
    const authError = new Error("Unauthorized access");
    const classifiedAuth = errorHandler.classifyError(authError);
    expect(classifiedAuth.code).toBe("AUTH_ERROR");
    expect(classifiedAuth.retryable).toBe(false);

    // Unknown error
    const unknownError = new Error("something weird");
    const classifiedUnknown = errorHandler.classifyError(unknownError);
    expect(classifiedUnknown.code).toBe("UNKNOWN_ERROR");
    expect(classifiedUnknown.retryable).toBe(false);
  });

  it("should pass through AIServiceError without re-classifying", () => {
    const original = new AIServiceError("RATE_LIMITED", "Too many requests", true);
    const result = errorHandler.classifyError(original);
    expect(result).toBe(original); // Same reference
    expect(result.code).toBe("RATE_LIMITED");
    expect(result.retryable).toBe(true);
  });
});
