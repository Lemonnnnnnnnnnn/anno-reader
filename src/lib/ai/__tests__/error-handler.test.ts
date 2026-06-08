import { describe, it, expect, beforeEach, vi } from "vitest";
import { AIErrorHandler } from "../error-handler";
import { AIServiceError } from "../service";

describe("AIErrorHandler", () => {
  let handler: AIErrorHandler;

  beforeEach(() => {
    handler = new AIErrorHandler();
  });

  describe("getUserMessage", () => {
    it("returns correct message for NETWORK_ERROR", () => {
      const error = new AIServiceError("NETWORK_ERROR", "raw");
      expect(handler.getUserMessage(error)).toBe(
        "无法连接到AI服务，请检查网络连接"
      );
    });

    it("returns correct message for API_ERROR", () => {
      const error = new AIServiceError("API_ERROR", "raw");
      expect(handler.getUserMessage(error)).toBe(
        "AI服务返回错误，请稍后重试"
      );
    });

    it("returns correct message for AUTH_ERROR", () => {
      const error = new AIServiceError("AUTH_ERROR", "raw");
      expect(handler.getUserMessage(error)).toBe(
        "API密钥无效，请检查配置"
      );
    });

    it("returns correct message for RATE_LIMITED", () => {
      const error = new AIServiceError("RATE_LIMITED", "raw");
      expect(handler.getUserMessage(error)).toBe(
        "请求过于频繁，请稍后重试"
      );
    });

    it("returns correct message for TIMEOUT", () => {
      const error = new AIServiceError("TIMEOUT", "raw");
      expect(handler.getUserMessage(error)).toBe(
        "请求超时，请稍后重试"
      );
    });

    it("returns correct message for UNKNOWN_ERROR", () => {
      const error = new AIServiceError("UNKNOWN_ERROR", "raw");
      expect(handler.getUserMessage(error)).toBe("发生未知错误");
    });

    it("returns generic message for non-AIServiceError", () => {
      expect(handler.getUserMessage(new Error("boom"))).toBe("发生未知错误");
    });

    it("returns generic message for non-error values", () => {
      expect(handler.getUserMessage("string")).toBe("发生未知错误");
      expect(handler.getUserMessage(null)).toBe("发生未知错误");
      expect(handler.getUserMessage(undefined)).toBe("发生未知错误");
    });
  });

  describe("classifyError", () => {
    it("returns AIServiceError as-is", () => {
      const original = new AIServiceError("AUTH_ERROR", "bad key");
      expect(handler.classifyError(original)).toBe(original);
    });

    it("classifies network errors", () => {
      const error = handler.classifyError(new Error("Network request failed"));
      expect(error.code).toBe("NETWORK_ERROR");
      expect(error.retryable).toBe(true);
    });

    it("classifies fetch errors as network", () => {
      const error = handler.classifyError(new Error("fetch failed"));
      expect(error.code).toBe("NETWORK_ERROR");
      expect(error.retryable).toBe(true);
    });

    it("classifies timeout errors", () => {
      const error = handler.classifyError(new Error("Connection timeout"));
      expect(error.code).toBe("TIMEOUT");
      expect(error.retryable).toBe(true);
    });

    it("classifies auth errors by keyword", () => {
      const error = handler.classifyError(new Error("Unauthorized access"));
      expect(error.code).toBe("AUTH_ERROR");
      expect(error.retryable).toBe(false);
    });

    it("classifies auth errors by status code", () => {
      const error = handler.classifyError(new Error("HTTP 401"));
      expect(error.code).toBe("AUTH_ERROR");
      expect(error.retryable).toBe(false);
    });

    it("returns UNKNOWN_ERROR for unrecognized errors", () => {
      const error = handler.classifyError(new Error("something weird"));
      expect(error.code).toBe("UNKNOWN_ERROR");
      expect(error.retryable).toBe(false);
    });

    it("handles non-Error values", () => {
      const error = handler.classifyError("string error");
      expect(error.code).toBe("UNKNOWN_ERROR");
      expect(error.message).toBe("string error");
    });
  });

  describe("withRetry", () => {
    it("succeeds on first try", async () => {
      const operation = vi.fn().mockResolvedValue("result");

      const result = await handler.withRetry(operation);

      expect(result).toBe("result");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("retries on retryable errors", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("fetch failed"))
        .mockResolvedValue("success");

      const result = await handler.withRetry(operation, 3);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("does NOT retry on non-retryable errors", async () => {
      const operation = vi
        .fn()
        .mockRejectedValue(new Error("Unauthorized"));

      await expect(handler.withRetry(operation, 3)).rejects.toThrow(
        AIServiceError
      );
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("calls onRetry callback", async () => {
      const onRetry = vi.fn();
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValue("success");

      await handler.withRetry(operation, 3, onRetry);

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ code: "NETWORK_ERROR" })
      );
    });

    it("throws after max retries", async () => {
      const operation = vi
        .fn()
        .mockRejectedValue(new Error("Network error"));

      await expect(handler.withRetry(operation, 2)).rejects.toThrow(
        AIServiceError
      );
      // 1 initial + 2 retries = 3 calls
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("uses exponential backoff timing", async () => {
      vi.useFakeTimers();
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValue("success");

      const promise = handler.withRetry(operation, 3);

      // First retry backoff: 500ms
      await vi.advanceTimersByTimeAsync(500);

      const result = await promise;
      expect(result).toBe("success");

      vi.useRealTimers();
    });
  });
});
