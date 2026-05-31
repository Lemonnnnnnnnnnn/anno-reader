import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { OpenAIProvider } from "../providers/openai";
import { AIServiceError } from "../service";
import type { AIProvider } from "../types";
import type { TranslationRequest } from "../service";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockProvider: AIProvider = {
  id: "test-openai",
  name: "Test OpenAI",
  type: "openai",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "sk-test-key",
  model: "gpt-4o",
  maxTokens: 4096,
  temperature: 0.7,
  enabled: true,
};

const mockRequest: TranslationRequest = {
  text: "Hello world",
  context: "A greeting",
  targetLanguage: "Chinese",
  promptId: "default-translation",
};

function mockResponseOk(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function mockResponseError(status: number, body = "Error"): Response {
  return {
    ok: false,
    status,
    json: async () => ({ error: body }),
    text: async () => body,
  } as Response;
}

describe("OpenAIProvider", () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenAIProvider();
  });

  describe("translate()", () => {
    it("should construct correct API request with URL, headers, and body", async () => {
      mockFetch.mockResolvedValue(
        mockResponseOk({
          choices: [{ message: { content: "你好世界" } }],
        })
      );

      await provider.translate(mockRequest, mockProvider);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];

      // Verify URL
      expect(url).toBe("https://api.openai.com/v1/chat/completions");

      // Verify method
      expect(options.method).toBe("POST");

      // Verify headers
      expect(options.headers).toEqual({
        "Content-Type": "application/json",
        Authorization: "Bearer sk-test-key",
      });

      // Verify body
      const body = JSON.parse(options.body);
      expect(body.model).toBe("gpt-4o");
      expect(body.max_tokens).toBe(4096);
      expect(body.temperature).toBe(0.7);
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe("system");
      expect(body.messages[1].role).toBe("user");
    });

    it("should include context in user message when provided", async () => {
      mockFetch.mockResolvedValue(
        mockResponseOk({
          choices: [{ message: { content: "你好世界" } }],
        })
      );

      await provider.translate(mockRequest, mockProvider);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userMessage = body.messages[1].content;

      expect(userMessage).toContain("Context:");
      expect(userMessage).toContain("A greeting");
      expect(userMessage).toContain("Text to translate:");
      expect(userMessage).toContain("Hello world");
    });

    it("should omit context section when context is empty", async () => {
      mockFetch.mockResolvedValue(
        mockResponseOk({
          choices: [{ message: { content: "你好世界" } }],
        })
      );

      const requestNoContext = { ...mockRequest, context: "" };
      await provider.translate(requestNoContext, mockProvider);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userMessage = body.messages[1].content;

      expect(userMessage).not.toContain("Context:");
      expect(userMessage).toBe("Text to translate:\nHello world");
    });

    it("should return translation on successful response", async () => {
      mockFetch.mockResolvedValue(
        mockResponseOk({
          choices: [{ message: { content: "你好世界" } }],
        })
      );

      const result = await provider.translate(mockRequest, mockProvider);

      expect(result.translation).toBe("你好世界");
      expect(result.originalText).toBe("Hello world");
      expect(result.provider).toBe(mockProvider);
      expect(result.cached).toBe(false);
    });

    it("should throw API_ERROR for empty translation response", async () => {
      mockFetch.mockResolvedValue(
        mockResponseOk({
          choices: [{ message: { content: "" } }],
        })
      );

      await expect(
        provider.translate(mockRequest, mockProvider)
      ).rejects.toThrow(AIServiceError);

      try {
        await provider.translate(mockRequest, mockProvider);
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("API_ERROR");
        expect((error as AIServiceError).message).toBe(
          "Empty translation response"
        );
        expect((error as AIServiceError).retryable).toBe(false);
      }
    });

    it("should throw API_ERROR for null choices response", async () => {
      mockFetch.mockResolvedValue(
        mockResponseOk({
          choices: [],
        })
      );

      await expect(
        provider.translate(mockRequest, mockProvider)
      ).rejects.toThrow(AIServiceError);
    });

    it("should throw AUTH_ERROR for 401 response", async () => {
      mockFetch.mockResolvedValue(mockResponseError(401));

      await expect(
        provider.translate(mockRequest, mockProvider)
      ).rejects.toThrow(AIServiceError);

      try {
        await provider.translate(mockRequest, mockProvider);
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("AUTH_ERROR");
        expect((error as AIServiceError).message).toBe(
          "Invalid API key or unauthorized access"
        );
        expect((error as AIServiceError).retryable).toBe(false);
      }
    });

    it("should throw AUTH_ERROR for 403 response", async () => {
      mockFetch.mockResolvedValue(mockResponseError(403));

      try {
        await provider.translate(mockRequest, mockProvider);
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("AUTH_ERROR");
        expect((error as AIServiceError).retryable).toBe(false);
      }
    });

    it("should throw RATE_LIMITED for 429 response (retryable)", async () => {
      mockFetch.mockResolvedValue(mockResponseError(429));

      try {
        await provider.translate(mockRequest, mockProvider);
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("RATE_LIMITED");
        expect((error as AIServiceError).message).toBe("Rate limit exceeded");
        expect((error as AIServiceError).retryable).toBe(true);
      }
    });

    it("should throw API_ERROR for 500 response (retryable)", async () => {
      mockFetch.mockResolvedValue(mockResponseError(500));

      try {
        await provider.translate(mockRequest, mockProvider);
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("API_ERROR");
        expect((error as AIServiceError).message).toBe("Server error: 500");
        expect((error as AIServiceError).retryable).toBe(true);
      }
    });

    it("should throw API_ERROR for 502 response (retryable)", async () => {
      mockFetch.mockResolvedValue(mockResponseError(502));

      try {
        await provider.translate(mockRequest, mockProvider);
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("API_ERROR");
        expect((error as AIServiceError).message).toBe("Server error: 502");
        expect((error as AIServiceError).retryable).toBe(true);
      }
    });

    it("should throw API_ERROR for 400 response (non-retryable)", async () => {
      mockFetch.mockResolvedValue(mockResponseError(400, "Bad request"));

      try {
        await provider.translate(mockRequest, mockProvider);
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("API_ERROR");
        expect((error as AIServiceError).message).toBe(
          "API error 400: Bad request"
        );
        expect((error as AIServiceError).retryable).toBe(false);
      }
    });

    it("should throw NETWORK_ERROR for network failure (retryable)", async () => {
      mockFetch.mockRejectedValue(new Error("fetch failed"));

      try {
        await provider.translate(mockRequest, mockProvider);
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("NETWORK_ERROR");
        expect((error as AIServiceError).message).toContain(
          "Failed to connect to provider"
        );
        expect((error as AIServiceError).message).toContain("fetch failed");
        expect((error as AIServiceError).retryable).toBe(true);
      }
    });

    it("should handle non-Error thrown by fetch", async () => {
      mockFetch.mockRejectedValue("string error");

      try {
        await provider.translate(mockRequest, mockProvider);
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("NETWORK_ERROR");
        expect((error as AIServiceError).message).toContain("Unknown error");
        expect((error as AIServiceError).retryable).toBe(true);
      }
    });

    it("should re-throw AIServiceError from handleApiError without wrapping", async () => {
      mockFetch.mockResolvedValue(mockResponseError(401));

      try {
        await provider.translate(mockRequest, mockProvider);
      } catch (error) {
        // Should be the exact same error, not wrapped in another NETWORK_ERROR
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("AUTH_ERROR");
      }
    });
  });

  describe("testConnection()", () => {
    it("should return true for 200 response", async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 } as Response);

      const result = await provider.testConnection(mockProvider);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.openai.com/v1/models",
        {
          headers: {
            Authorization: "Bearer sk-test-key",
          },
        }
      );
    });

    it("should return false for non-200 response", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401 } as Response);

      const result = await provider.testConnection(mockProvider);

      expect(result).toBe(false);
    });

    it("should return false for network error", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await provider.testConnection(mockProvider);

      expect(result).toBe(false);
    });
  });
});
