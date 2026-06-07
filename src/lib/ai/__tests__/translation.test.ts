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
  StreamingTranslationResponse,
} from "../service";

// ---------------------------------------------------------------------------
// Mocks — use vi.hoisted() so they're available in vi.mock() factories
// ---------------------------------------------------------------------------

const { mockTranslateStream, mockGetContext, mockCreateDefaultAggregator } = vi.hoisted(() => ({
  mockTranslateStream: vi.fn(),
  mockGetContext: vi.fn(),
  mockCreateDefaultAggregator: vi.fn().mockResolvedValue({}),
}));

vi.mock("../providers/openai", () => ({
  OpenAIProvider: class {
    translateStream = mockTranslateStream;
  },
}));

vi.mock("../context", () => ({
  getContext: mockGetContext,
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
  },
  roles: [mockRole],
  selectedRoleId: "test-role",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TranslationService", () => {
  let service: InstanceType<typeof TranslationService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TranslationService();
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

      // First call — populates cache via cacheTranslation
      const mockTextStream = (async function* () {
        yield "你好世界";
      })();
      mockTranslateStream.mockResolvedValue({
        textStream: mockTextStream,
        provider: mockProvider,
      });

      const first = await service.translateStream("Hello world", "Chinese", mockConfig);

      // Consume the first stream
      const firstCollected: string[] = [];
      for await (const chunk of first.textStream) {
        firstCollected.push(chunk);
      }

      // Cache the translation
      service.cacheTranslation("Hello world", "Chinese", "你好世界", mockProvider);

      // Now stream again — should hit cache
      const result = await service.translateStream(
        "Hello world",
        "Chinese",
        mockConfig,
      );

      // Should NOT have called translateStream again (cache hit)
      expect(mockTranslateStream).toHaveBeenCalledTimes(1);

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

      try {
        await service.translateStream("Hello world", "Chinese", configNoProvider);
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
        service.translateStream("Hello world", "Chinese", configDisabled),
      ).rejects.toThrow(AIServiceError);

      try {
        await service.translateStream("Hello world", "Chinese", configDisabled);
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
        service.translateStream("Hello world", "Chinese", configNoRole),
      ).rejects.toThrow(AIServiceError);

      try {
        await service.translateStream("Hello world", "Chinese", configNoRole);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("UNKNOWN_ERROR");
        expect((error as AIServiceError).message).toBe(
          "No AI role configured",
        );
      }
    });

    it("should pass dictionaryText to buildMessagesWithContext and render in user message", async () => {
      mockGetContext.mockResolvedValue(mockContextData);

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

      mockTranslateStream.mockResolvedValue({
        textStream: (async function* () { yield "test"; })(),
        provider: mockProvider,
      });

      await service.translateStream("Hello world", "Chinese", dictConfig);

      expect(mockTranslateStream).toHaveBeenCalledTimes(1);
      const callArgs = mockTranslateStream.mock.calls[0][0];
      // userMessage should include the rendered dictionary text from mockContextData
      expect(callArgs.userMessage).toContain("hello: 你好");
      expect(callArgs.userMessage).toContain("world: 世界");
      expect(callArgs.userMessage).not.toContain("{dictionaryResults}");
    });
  });

  // =========================================================================
  // cacheTranslation()
  // =========================================================================
  describe("cacheTranslation()", () => {
    it("should cache a translation result", async () => {
      mockGetContext.mockResolvedValue(mockContextData);

      // First call — should call provider
      mockTranslateStream.mockResolvedValue({
        textStream: (async function* () { yield "你好世界"; })(),
        provider: mockProvider,
      });

      await service.translateStream("Hello world", "Chinese", mockConfig);

      // Cache the translation
      service.cacheTranslation("Hello world", "Chinese", "你好世界", mockProvider);

      // Second call — should hit cache
      const result = await service.translateStream("Hello world", "Chinese", mockConfig);

      // Provider should NOT be called again
      expect(mockTranslateStream).toHaveBeenCalledTimes(1);

      // Should return cached result
      const collected: string[] = [];
      for await (const chunk of result.textStream) {
        collected.push(chunk);
      }
      expect(collected).toEqual(["你好世界"]);
    });
  });
});
