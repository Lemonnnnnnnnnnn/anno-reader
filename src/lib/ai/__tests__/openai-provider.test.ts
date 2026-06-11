/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAIProvider } from "../providers/openai";
import { AIServiceError } from "../service";
import type { AIProvider } from "../types";
import type { TranslationRequest } from "../service";

// --- AI SDK mocks ---

const mockGenerateText = vi.fn();
const mockStreamText = vi.fn();
const mockChatModel = vi.fn();

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: vi.fn(() => ({
    chatModel: mockChatModel,
  })),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateText: (...args: unknown[]) => mockGenerateText(...args),
    streamText: (...args: unknown[]) => mockStreamText(...args),
  };
});

// Import APICallError AFTER the mock is defined so we get the real class
// (spread from importOriginal) that matches what the production code sees.
import { APICallError } from "ai";

// --- Raw fetch mock (for testConnection) ---

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// --- Test fixtures ---

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
  systemMessage:
    "You are a professional translator. Translate the following text to Chinese.",
  userMessage: "Context:\nA greeting\n\nText to translate:\nHello world",
};

// --- Helpers ---

/** Build an APICallError with a given status code. */
function makeApiCallError(statusCode: number, message = `HTTP ${statusCode}`) {
  // Use the mocked module's APICallError so instanceof checks pass
  // in the production code's toAIServiceError.
  return new APICallError({
    message,
    statusCode,
    url: "https://api.openai.com/v1/chat/completions",
    requestBodyValues: {},
    responseHeaders: {},
    responseBody: "{}",
    isRetryable: false,
    cause: new Error(message),
  });
}

// --- Tests ---

describe("OpenAIProvider", () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenAIProvider();
    mockChatModel.mockReturnValue("mock-model");
  });

  // =========================================================================
  // translate()
  // =========================================================================
  describe("translate()", () => {
    it("should call generateText with correct model, system, prompt, maxOutputTokens, and temperature", async () => {
      mockGenerateText.mockResolvedValue({ text: "你好世界" });

      await provider.translate(mockRequest, mockProvider);

      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      expect(mockGenerateText).toHaveBeenCalledWith({
        model: "mock-model",
        system: mockRequest.systemMessage,
        prompt: mockRequest.userMessage,
        maxOutputTokens: 4096,
        temperature: 0.7,
      });
    });

    it("should create provider and model with correct config", async () => {
      const { createOpenAICompatible } = await import(
        "@ai-sdk/openai-compatible"
      );
      mockGenerateText.mockResolvedValue({ text: "你好世界" });

      await provider.translate(mockRequest, mockProvider);

      expect(createOpenAICompatible).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test OpenAI",
          baseURL: "https://api.openai.com/v1",
          apiKey: "sk-test-key",
        }),
      );
      expect(mockChatModel).toHaveBeenCalledWith("gpt-4o");
    });

    it("should return translation on successful response", async () => {
      mockGenerateText.mockResolvedValue({ text: "你好世界" });

      const result = await provider.translate(mockRequest, mockProvider);

      expect(result.translation).toBe("你好世界");
      expect(result.originalText).toBe("Hello world");
      expect(result.provider).toBe(mockProvider);
      expect(result.cached).toBe(false);
    });

    it("should trim whitespace from translation", async () => {
      mockGenerateText.mockResolvedValue({ text: "  你好世界  " });

      const result = await provider.translate(mockRequest, mockProvider);

      expect(result.translation).toBe("你好世界");
    });

    it("should throw API_ERROR for empty translation response", async () => {
      mockGenerateText.mockResolvedValue({ text: "" });

      await expect(
        provider.translate(mockRequest, mockProvider),
      ).rejects.toThrow(AIServiceError);

      try {
        await provider.translate(mockRequest, mockProvider);
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("API_ERROR");
        expect((error as AIServiceError).message).toBe(
          "Empty translation response",
        );
        expect((error as AIServiceError).retryable).toBe(false);
      }
    });

    it("should throw API_ERROR for whitespace-only translation response", async () => {
      mockGenerateText.mockResolvedValue({ text: "   " });

      await expect(
        provider.translate(mockRequest, mockProvider),
      ).rejects.toThrow(AIServiceError);
    });

    // ----- Error mapping -----

    it("should throw AUTH_ERROR for 401 APICallError", async () => {
      mockGenerateText.mockRejectedValue(makeApiCallError(401, "Unauthorized"));

      try {
        await provider.translate(mockRequest, mockProvider);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("AUTH_ERROR");
        expect((error as AIServiceError).retryable).toBe(false);
      }
    });

    it("should throw AUTH_ERROR for 403 APICallError", async () => {
      mockGenerateText.mockRejectedValue(makeApiCallError(403, "Forbidden"));

      try {
        await provider.translate(mockRequest, mockProvider);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("AUTH_ERROR");
        expect((error as AIServiceError).retryable).toBe(false);
      }
    });

    it("should throw RATE_LIMITED for 429 APICallError (retryable)", async () => {
      mockGenerateText.mockRejectedValue(
        makeApiCallError(429, "Rate limit exceeded"),
      );

      try {
        await provider.translate(mockRequest, mockProvider);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("RATE_LIMITED");
        expect((error as AIServiceError).retryable).toBe(true);
      }
    });

    it("should throw API_ERROR for 500 APICallError (retryable)", async () => {
      mockGenerateText.mockRejectedValue(
        makeApiCallError(500, "Internal Server Error"),
      );

      try {
        await provider.translate(mockRequest, mockProvider);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("API_ERROR");
        expect((error as AIServiceError).retryable).toBe(true);
      }
    });

    it("should throw API_ERROR for 502 APICallError (retryable)", async () => {
      mockGenerateText.mockRejectedValue(
        makeApiCallError(502, "Bad Gateway"),
      );

      try {
        await provider.translate(mockRequest, mockProvider);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("API_ERROR");
        expect((error as AIServiceError).retryable).toBe(true);
      }
    });

    it("should throw API_ERROR for 400 APICallError (non-retryable)", async () => {
      mockGenerateText.mockRejectedValue(
        makeApiCallError(400, "Bad request"),
      );

      try {
        await provider.translate(mockRequest, mockProvider);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("API_ERROR");
        expect((error as AIServiceError).retryable).toBe(false);
      }
    });

    it("should throw NETWORK_ERROR for network failure (retryable)", async () => {
      mockGenerateText.mockRejectedValue(new Error("fetch failed"));

      try {
        await provider.translate(mockRequest, mockProvider);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("NETWORK_ERROR");
        expect((error as AIServiceError).message).toContain("fetch failed");
        expect((error as AIServiceError).retryable).toBe(true);
      }
    });

    it("should handle non-Error thrown by generateText", async () => {
      mockGenerateText.mockRejectedValue("string error");

      try {
        await provider.translate(mockRequest, mockProvider);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("NETWORK_ERROR");
        expect((error as AIServiceError).message).toContain("Unknown error");
        expect((error as AIServiceError).retryable).toBe(true);
      }
    });

    it("should re-throw AIServiceError from toAIServiceError without wrapping", async () => {
      const original = new AIServiceError("AUTH_ERROR", "Invalid API key", false);
      mockGenerateText.mockRejectedValue(original);

      try {
        await provider.translate(mockRequest, mockProvider);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("AUTH_ERROR");
        // Should be the exact same error object, not a new wrapped one
        expect(error).toBe(original);
      }
    });
  });

  // =========================================================================
  // translateStream()
  // =========================================================================
  describe("translateStream()", () => {
    it("should call streamText with correct parameters", async () => {
      const chunks = ["你好", "世界"];
      mockStreamText.mockReturnValue({
        textStream: (async function* () {
          for (const c of chunks) yield c;
        })(),
      });

      await provider.translateStream(mockRequest, mockProvider);

      expect(mockStreamText).toHaveBeenCalledTimes(1);
      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "mock-model",
          system: mockRequest.systemMessage,
          prompt: mockRequest.userMessage,
          maxOutputTokens: 4096,
          temperature: 0.7,
        }),
      );
    });

    it("should return StreamingTranslationResponse with textStream and provider", async () => {
      const chunks = ["你好", "世界"];
      mockStreamText.mockReturnValue({
        textStream: (async function* () {
          for (const c of chunks) yield c;
        })(),
      });

      const result = await provider.translateStream(mockRequest, mockProvider);

      expect(result.provider).toBe(mockProvider);
      expect(result.textStream).toBeDefined();

      // Consume the AsyncIterable to verify it yields correctly
      const collected: string[] = [];
      for await (const chunk of result.textStream) {
        collected.push(chunk);
      }
      expect(collected).toEqual(["你好", "世界"]);
    });

    it("should pass abortSignal to streamText", async () => {
      const controller = new AbortController();
      mockStreamText.mockReturnValue({
        textStream: (async function* () {})(),
      });

      await provider.translateStream(mockRequest, mockProvider, {
        abortSignal: controller.signal,
      });

      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          abortSignal: controller.signal,
        }),
      );
    });

    it("should pass onError callback to streamText", async () => {
      const onError = vi.fn();
      mockStreamText.mockReturnValue({
        textStream: (async function* () {})(),
      });

      await provider.translateStream(mockRequest, mockProvider, {
        onError,
      });

      // Verify onError was passed to streamText
      const callArgs = mockStreamText.mock.calls[0][0];
      expect(callArgs.onError).toBeDefined();
      expect(typeof callArgs.onError).toBe("function");
    });

    it("should wrap non-Error in onError callback as Error", async () => {
      const onError = vi.fn();
      let capturedOnError: ((args: { error: unknown }) => void) | undefined;

      mockStreamText.mockImplementation((opts: Record<string, unknown>) => {
        capturedOnError = opts.onError as (args: { error: unknown }) => void;
        return {
          textStream: (async function* () {})(),
        };
      });

      await provider.translateStream(mockRequest, mockProvider, {
        onError,
      });

      // Simulate streamText calling onError with a non-Error value
      capturedOnError!({ error: "string error" });

      expect(onError).toHaveBeenCalledTimes(1);
      const passedError = onError.mock.calls[0][0];
      expect(passedError).toBeInstanceOf(Error);
      expect(passedError.message).toBe("string error");
    });

    it("should pass Error instances through onError callback unchanged", async () => {
      const onError = vi.fn();
      let capturedOnError: ((args: { error: unknown }) => void) | undefined;

      mockStreamText.mockImplementation((opts: Record<string, unknown>) => {
        capturedOnError = opts.onError as (args: { error: unknown }) => void;
        return {
          textStream: (async function* () {})(),
        };
      });

      await provider.translateStream(mockRequest, mockProvider, {
        onError,
      });

      const originalError = new Error("stream failed");
      capturedOnError!({ error: originalError });

      expect(onError).toHaveBeenCalledWith(originalError);
    });

    it("should map stream iteration network errors to NETWORK_ERROR", async () => {
      mockStreamText.mockReturnValue({
        textStream: (async function* () {
          yield "partial";
          throw new Error("net::ERR_CONNECTION_RESET");
        })(),
      });

      const result = await provider.translateStream(mockRequest, mockProvider);

      await expect(async () => {
        for await (const _chunk of result.textStream) {
          // consume stream
        }
      }).rejects.toSatisfy((error: AIServiceError) => {
        expect(error).toBeInstanceOf(AIServiceError);
        expect(error.code).toBe("NETWORK_ERROR");
        expect(error.retryable).toBe(true);
        return true;
      });
    });

    it("should map stream iteration 429 errors to RATE_LIMITED", async () => {
      mockStreamText.mockReturnValue({
        textStream: (async function* () {
          throw makeApiCallError(429, "Too Many Requests");
        })(),
      });

      const result = await provider.translateStream(mockRequest, mockProvider);

      await expect(async () => {
        for await (const _chunk of result.textStream) {
          // consume stream
        }
      }).rejects.toSatisfy((error: AIServiceError) => {
        expect(error).toBeInstanceOf(AIServiceError);
        expect(error.code).toBe("RATE_LIMITED");
        expect(error.retryable).toBe(true);
        return true;
      });
    });
  });

  // =========================================================================
  // testConnection()
  // =========================================================================
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
        },
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
