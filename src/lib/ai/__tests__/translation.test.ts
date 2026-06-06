/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TranslationService } from "../translation";
import { AIServiceError } from "../service";
import type {
  AIConfig,
  AIProvider,
  AIRole,
  ContextData,
} from "../types";
import type {
  TranslationResponse,
} from "../service";

// ---------------------------------------------------------------------------
// Mocks — defined at module scope so vi.mock factories can reference them.
// ---------------------------------------------------------------------------

const mockTranslate = vi.fn();
const mockTranslateStream = vi.fn();
const mockGetContext = vi.fn();
const mockCreateDefaultAggregator = vi.fn().mockResolvedValue({});

vi.mock("../providers/openai", () => ({
  OpenAIProvider: class {
    translate = mockTranslate;
    translateStream = mockTranslateStream;
  },
}));

vi.mock("../context", () => ({
  ContextService: class {
    getContext = mockGetContext;
  },
}));

vi.mock("@/lib/dictionaries", () => ({
  createDefaultAggregator: (...args: unknown[]) =>
    mockCreateDefaultAggregator(...args),
}));

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

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

const mockRole: AIRole = {
  id: "test-role",
  name: "Test Role",
  systemMessage: "Test system",
  userMessageTemplate: "Translate {selectedText}",
  variables: [
    {
      name: "selectedText",
      description: "The text selected by the user",
      defaultValue: "",
      isRequired: true,
    },
  ],
  isDefault: true,
  isEnabled: true,
};

const mockContextData: ContextData = {
  text: "Hello world",
  metadata: { selectedText: "Hello world", moduleCount: "1" },
  source: "builtin-sentence",
  dictionaryText: "hello: 你好\nworld: 世界",
};

const mockConfig: AIConfig = {
  providers: [mockProvider],
  selectedProviderId: "test-openai",
  contextConfig: {
    modules: [
      {
        id: "builtin-sentence",
        name: "Sentence Context",
        type: "sentence",
        content: "Uses selected text as context",
        isEnabled: true,
      },
    ],
    selectedModuleIds: ["builtin-sentence"],
  },
  prompts: [],
  roles: [mockRole],
  selectedRoleId: "test-role",
};

const mockResponse: TranslationResponse = {
  translation: "你好世界",
  originalText: "Hello world",
  provider: mockProvider,
  cached: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TranslationService", () => {
  let service: TranslationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TranslationService();
  });

  // =========================================================================
  // translate()
  // =========================================================================
  describe("translate()", () => {
    it("should call provider with correct request (system from role, user rendered from template)", async () => {
      mockGetContext.mockResolvedValue(mockContextData);
      mockTranslate.mockResolvedValue(mockResponse);

      const result = await service.translate(
        "Hello world",
        "Chinese",
        mockConfig,
      );

      expect(result).toEqual(mockResponse);
      expect(mockTranslate).toHaveBeenCalledTimes(1);
      expect(mockTranslate).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "Hello world",
          context: "Hello world",
          targetLanguage: "Chinese",
          systemMessage: "Test system",
          userMessage: "Translate Hello world",
        }),
        mockProvider,
      );
    });

    it("should extract context from selected text", async () => {
      mockGetContext.mockResolvedValue(mockContextData);
      mockTranslate.mockResolvedValue(mockResponse);

      await service.translate("Hello world", "Chinese", mockConfig);

      expect(mockGetContext).toHaveBeenCalledTimes(1);
      expect(mockGetContext).toHaveBeenCalledWith(
        "Hello world",
        null,
        mockConfig.contextConfig.modules,
        false,
        undefined,
      );
    });

    it("should pass chapterText to context service", async () => {
      mockGetContext.mockResolvedValue(mockContextData);
      mockTranslate.mockResolvedValue(mockResponse);

      const chapterText =
        "It was a beautiful morning. Hello world in the garden.";
      await service.translate(
        "Hello world",
        "Chinese",
        mockConfig,
        chapterText,
      );

      expect(mockGetContext).toHaveBeenCalledWith(
        "Hello world",
        chapterText,
        mockConfig.contextConfig.modules,
        false,
        undefined,
      );
    });

    it("should use role system message directly (not rendered)", async () => {
      mockGetContext.mockResolvedValue(mockContextData);
      mockTranslate.mockResolvedValue(mockResponse);

      await service.translate("Hello world", "Chinese", mockConfig);

      const callArgs = mockTranslate.mock.calls[0][0];
      // systemMessage = role.systemMessage (no template interpolation)
      expect(callArgs.systemMessage).toBe("Test system");
    });

    it("should throw when no provider configured", async () => {
      const configNoProvider: AIConfig = {
        ...mockConfig,
        selectedProviderId: null,
      };

      await expect(
        service.translate("Hello world", "Chinese", configNoProvider),
      ).rejects.toThrow(AIServiceError);

      try {
        await service.translate("Hello world", "Chinese", configNoProvider);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("UNKNOWN_ERROR");
        expect((error as AIServiceError).message).toBe(
          "No AI provider configured",
        );
      }
    });

    it("should throw when provider is disabled", async () => {
      const disabledProvider = { ...mockProvider, enabled: false };
      const configDisabled: AIConfig = {
        ...mockConfig,
        providers: [disabledProvider],
      };

      await expect(
        service.translate("Hello world", "Chinese", configDisabled),
      ).rejects.toThrow(AIServiceError);

      try {
        await service.translate("Hello world", "Chinese", configDisabled);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("UNKNOWN_ERROR");
        expect((error as AIServiceError).message).toBe(
          "No AI provider configured",
        );
      }
    });

    it("should throw when no role configured", async () => {
      const configNoRole: AIConfig = {
        ...mockConfig,
        selectedRoleId: null,
      };

      await expect(
        service.translate("Hello world", "Chinese", configNoRole),
      ).rejects.toThrow(AIServiceError);

      try {
        await service.translate("Hello world", "Chinese", configNoRole);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("UNKNOWN_ERROR");
        expect((error as AIServiceError).message).toBe(
          "No AI role configured",
        );
      }
    });

    it("should return cached result on second call", async () => {
      mockGetContext.mockResolvedValue(mockContextData);
      mockTranslate.mockResolvedValue(mockResponse);

      // First call — hits provider
      const first = await service.translate(
        "Hello world",
        "Chinese",
        mockConfig,
      );
      expect(first.cached).toBe(false);
      expect(mockTranslate).toHaveBeenCalledTimes(1);

      // Second call — should hit cache
      const second = await service.translate(
        "Hello world",
        "Chinese",
        mockConfig,
      );
      expect(second.cached).toBe(true);
      expect(second.translation).toBe("你好世界");
      // Provider should NOT be called again
      expect(mockTranslate).toHaveBeenCalledTimes(1);
    });

    it("should pass dictionaryText to buildMessagesWithContext and render in user message", async () => {
      mockGetContext.mockResolvedValue(mockContextData);
      mockTranslate.mockResolvedValue(mockResponse);

      // Create a role template that includes {dictionaryResults}
      const dictRole: AIRole = {
        ...mockRole,
        id: "dict-role",
        userMessageTemplate:
          "Translate {selectedText}\nDictionary: {dictionaryResults}",
        variables: [
          ...mockRole.variables,
          {
            name: "dictionaryResults",
            description: "Dictionary query results",
            defaultValue: "",
            isRequired: false,
          },
        ],
      };
      const dictConfig: AIConfig = {
        ...mockConfig,
        roles: [dictRole],
        selectedRoleId: "dict-role",
      };

      await service.translate("Hello world", "Chinese", dictConfig);

      expect(mockTranslate).toHaveBeenCalledTimes(1);
      const callArgs = mockTranslate.mock.calls[0][0];
      // userMessage should include the rendered dictionary text from mockContextData
      expect(callArgs.userMessage).toContain("hello: 你好");
      expect(callArgs.userMessage).toContain("world: 世界");
      expect(callArgs.userMessage).not.toContain("{dictionaryResults}");
    });
  });

  // =========================================================================
  // translateStream()
  // =========================================================================
  describe("translateStream()", () => {
    it("should call provider translateStream with correct request", async () => {
      mockGetContext.mockResolvedValue(mockContextData);
      const mockTextStream = (async function* () {
        yield "你好";
        yield "世界";
      })();
      mockTranslateStream.mockResolvedValue({
        textStream: mockTextStream,
        provider: mockProvider,
      });

      await service.translateStream("Hello world", "Chinese", mockConfig);

      expect(mockTranslateStream).toHaveBeenCalledTimes(1);
      expect(mockTranslateStream).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "Hello world",
          context: "Hello world",
          targetLanguage: "Chinese",
          systemMessage: "Test system",
          userMessage: "Translate Hello world",
        }),
        mockProvider,
        undefined,
      );
    });

    it("should return StreamingTranslationResponse with textStream", async () => {
      mockGetContext.mockResolvedValue(mockContextData);
      const chunks = ["你好", "世界"];
      const mockTextStream = (async function* () {
        for (const c of chunks) yield c;
      })();
      mockTranslateStream.mockResolvedValue({
        textStream: mockTextStream,
        provider: mockProvider,
      });

      const result = await service.translateStream(
        "Hello world",
        "Chinese",
        mockConfig,
      );

      expect(result.provider).toBe(mockProvider);

      // Consume the AsyncIterable to verify real streaming behavior
      const collected: string[] = [];
      for await (const chunk of result.textStream) {
        collected.push(chunk);
      }
      expect(collected).toEqual(["你好", "世界"]);
    });

    it("should return cached result as single-yield AsyncIterable", async () => {
      mockGetContext.mockResolvedValue(mockContextData);
      mockTranslate.mockResolvedValue(mockResponse);

      // Prime the cache via translate()
      await service.translate("Hello world", "Chinese", mockConfig);

      // Now stream — should hit cache
      const result = await service.translateStream(
        "Hello world",
        "Chinese",
        mockConfig,
      );

      // Should NOT have called translateStream (cache hit)
      expect(mockTranslateStream).not.toHaveBeenCalled();

      // Consume the stream — should yield the cached translation
      const collected: string[] = [];
      for await (const chunk of result.textStream) {
        collected.push(chunk);
      }
      expect(collected).toEqual(["你好世界"]);
    });

    it("should pass options to provider", async () => {
      mockGetContext.mockResolvedValue(mockContextData);
      const controller = new AbortController();
      const onError = vi.fn();
      mockTranslateStream.mockResolvedValue({
        textStream: (async function* () {})(),
        provider: mockProvider,
      });

      await service.translateStream("Hello world", "Chinese", mockConfig, {
        abortSignal: controller.signal,
        onError,
      });

      expect(mockTranslateStream).toHaveBeenCalledWith(
        expect.anything(),
        mockProvider,
        { abortSignal: controller.signal, onError },
      );
    });

    it("should throw when no provider configured", async () => {
      const configNoProvider: AIConfig = {
        ...mockConfig,
        selectedProviderId: null,
      };

      await expect(
        service.translateStream("Hello world", "Chinese", configNoProvider),
      ).rejects.toThrow(AIServiceError);
    });
  });

  // =========================================================================
  // previewTranslate()
  // =========================================================================
  describe("previewTranslate()", () => {
    it("should return preview data without calling provider", async () => {
      mockGetContext.mockResolvedValue(mockContextData);

      const result = await service.previewTranslate(
        "Hello world",
        "Chinese",
        mockConfig,
      );

      expect(result.selectedText).toBe("Hello world");
      expect(result.targetLanguage).toBe("Chinese");
      expect(result.systemMessage).toBe("Test system");
      expect(result.userMessage).toBe("Translate Hello world");
      expect(result.contextSources).toEqual(["Sentence Context"]);

      // Should NOT call provider
      expect(mockTranslate).not.toHaveBeenCalled();
      expect(mockTranslateStream).not.toHaveBeenCalled();
    });

    it("should throw when no provider configured", async () => {
      const configNoProvider: AIConfig = {
        ...mockConfig,
        selectedProviderId: null,
      };

      await expect(
        service.previewTranslate("Hello world", "Chinese", configNoProvider),
      ).rejects.toThrow(AIServiceError);
    });
  });

  // =========================================================================
  // translateWithRetry()
  // =========================================================================
  describe("translateWithRetry()", () => {
    it("should return on first successful attempt", async () => {
      mockGetContext.mockResolvedValue(mockContextData);
      mockTranslate.mockResolvedValue(mockResponse);

      const result = await service.translateWithRetry(
        "Hello world",
        "Chinese",
        mockConfig,
      );

      expect(result).toEqual(mockResponse);
      expect(mockTranslate).toHaveBeenCalledTimes(1);
    });

    it("should retry on retryable errors", async () => {
      const retryableError = new AIServiceError(
        "RATE_LIMITED",
        "Rate limit exceeded",
        true,
      );

      mockGetContext.mockResolvedValue(mockContextData);
      mockTranslate
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce(mockResponse);

      const result = await service.translateWithRetry(
        "Hello world",
        "Chinese",
        mockConfig,
        3,
      );

      expect(result).toEqual(mockResponse);
      expect(mockTranslate).toHaveBeenCalledTimes(3);
    });

    it("should NOT retry on non-retryable errors", async () => {
      const nonRetryableError = new AIServiceError(
        "AUTH_ERROR",
        "Invalid API key",
        false,
      );

      mockGetContext.mockResolvedValue(mockContextData);
      mockTranslate.mockRejectedValue(nonRetryableError);

      try {
        await service.translateWithRetry(
          "Hello world",
          "Chinese",
          mockConfig,
          3,
        );
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("AUTH_ERROR");
      }

      // Should only be called once — no retry
      expect(mockTranslate).toHaveBeenCalledTimes(1);
    });

    it("should throw after max retries exhausted", async () => {
      const retryableError = new AIServiceError(
        "NETWORK_ERROR",
        "Connection failed",
        true,
      );

      mockGetContext.mockResolvedValue(mockContextData);
      mockTranslate.mockRejectedValue(retryableError);

      try {
        await service.translateWithRetry(
          "Hello world",
          "Chinese",
          mockConfig,
          2,
        );
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("NETWORK_ERROR");
      }

      // maxRetries=2 → attempts: 0, 1, 2 = 3 calls total
      expect(mockTranslate).toHaveBeenCalledTimes(3);
    });

    it("should re-throw non-AIServiceError without retrying", async () => {
      const genericError = new Error("Something unexpected");

      mockGetContext.mockResolvedValue(mockContextData);
      mockTranslate.mockRejectedValue(genericError);

      await expect(
        service.translateWithRetry(
          "Hello world",
          "Chinese",
          mockConfig,
          3,
        ),
      ).rejects.toThrow("Something unexpected");

      expect(mockTranslate).toHaveBeenCalledTimes(1);
    });

    it("should use exponential backoff between retries", async () => {
      const retryableError = new AIServiceError(
        "RATE_LIMITED",
        "Rate limit exceeded",
        true,
      );

      mockGetContext.mockResolvedValue(mockContextData);

      // Fail twice, succeed on third
      mockTranslate
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce(mockResponse);

      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

      await service.translateWithRetry(
        "Hello world",
        "Chinese",
        mockConfig,
        3,
      );

      // Should have called setTimeout twice (for 2 retries)
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2);

      // First retry: 100ms * 2^0 = 100ms
      expect(setTimeoutSpy.mock.calls[0][1]).toBe(100);
      // Second retry: 100ms * 2^1 = 200ms
      expect(setTimeoutSpy.mock.calls[1][1]).toBe(200);

      setTimeoutSpy.mockRestore();
    });
  });
});
