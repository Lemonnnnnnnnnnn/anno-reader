import { describe, it, expect, vi, beforeEach } from "vitest";
import { TranslationService } from "../translation";
import { AIServiceError } from "../service";
import type { AIConfig, AIProvider, AIPrompt, PromptVariable, ContextData } from "../types";
import type { TranslationResponse } from "../service";

// Mock implementations shared across tests — defined at module scope
// so vi.mock factories can reference them.
const mockTranslate = vi.fn();
const mockGetContext = vi.fn();
const mockGetDefaultPrompt = vi.fn();
const mockRenderPrompt = vi.fn();

vi.mock("../providers/openai", () => ({
  OpenAIProvider: class {
    translate = mockTranslate;
  },
}));

vi.mock("../context", () => ({
  ContextService: class {
    getContext = mockGetContext;
  },
}));

vi.mock("../prompts", () => ({
  PromptService: class {
    getDefaultPrompt = mockGetDefaultPrompt;
    renderPrompt = mockRenderPrompt;
  },
}));

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

const mockPromptVariable: PromptVariable = {
  name: "selectedText",
  description: "The text selected by the user",
  defaultValue: "",
  isRequired: true,
};

const mockPrompt: AIPrompt = {
  id: "default-translation",
  name: "Translation",
  content: "Translate {selectedText} to {targetLanguage}.",
  variables: [mockPromptVariable],
  isDefault: true,
  isEnabled: true,
};

const mockContextData: ContextData = {
  text: "Hello world",
  metadata: { selectedText: "Hello world", moduleCount: "1" },
  source: "builtin-sentence",
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
  prompts: [mockPrompt],
  roles: [
    {
      id: "reading-assistant",
      name: "阅读助手",
      systemMessage: "You are a reading assistant.",
      userMessageTemplate: "Translate {selectedText}",
      variables: [
        { name: "selectedText", description: "The text selected by the user", defaultValue: "", isRequired: true },
      ],
      isDefault: true,
      isEnabled: true,
    },
  ],
  selectedRoleId: "reading-assistant",
};

const mockResponse: TranslationResponse = {
  translation: "你好世界",
  originalText: "Hello world",
  provider: mockProvider,
  cached: false,
};

describe("TranslationService", () => {
  let service: TranslationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TranslationService();
  });

  describe("translate()", () => {
    it("should call provider with correct request", async () => {
      mockGetContext.mockResolvedValue(mockContextData);
      mockGetDefaultPrompt.mockReturnValue(mockPrompt);
      mockRenderPrompt
        .mockReturnValueOnce("You are a professional translator. Translate the following text to Chinese.")
        .mockReturnValueOnce("Translate Hello world to Chinese.");
      mockTranslate.mockResolvedValue(mockResponse);

      const result = await service.translate("Hello world", "Chinese", mockConfig);

      expect(result).toEqual(mockResponse);
      expect(mockTranslate).toHaveBeenCalledTimes(1);
      expect(mockTranslate).toHaveBeenCalledWith(
        {
          text: "Hello world",
          context: "Hello world",
          targetLanguage: "Chinese",
          systemMessage: "You are a professional translator. Translate the following text to Chinese.",
          userMessage: "Text to translate:\nHello world",
        },
        mockProvider,
      );
    });

    it("should extract context from selected text", async () => {
      mockGetContext.mockResolvedValue(mockContextData);
      mockGetDefaultPrompt.mockReturnValue(mockPrompt);
      mockRenderPrompt.mockReturnValue("rendered");
      mockTranslate.mockResolvedValue(mockResponse);

      await service.translate("Hello world", "Chinese", mockConfig);

      expect(mockGetContext).toHaveBeenCalledTimes(1);
      expect(mockGetContext).toHaveBeenCalledWith(
        "Hello world",
        null,
        mockConfig.contextConfig.modules,
      );
    });

    it("should pass chapterText to context service", async () => {
      mockGetContext.mockResolvedValue(mockContextData);
      mockGetDefaultPrompt.mockReturnValue(mockPrompt);
      mockRenderPrompt.mockReturnValue("rendered");
      mockTranslate.mockResolvedValue(mockResponse);

      const chapterText = "It was a beautiful morning. Hello world in the garden.";
      await service.translate("Hello world", "Chinese", mockConfig, chapterText);

      expect(mockGetContext).toHaveBeenCalledWith(
        "Hello world",
        chapterText,
        mockConfig.contextConfig.modules,
      );
    });

    it("should render system message with target language", async () => {
      mockGetContext.mockResolvedValue(mockContextData);
      mockGetDefaultPrompt.mockReturnValue(mockPrompt);
      mockRenderPrompt.mockReturnValue("rendered system message");
      mockTranslate.mockResolvedValue(mockResponse);

      await service.translate("Hello world", "Chinese", mockConfig);

      expect(mockRenderPrompt).toHaveBeenCalledTimes(1);
      // First call is for system message
      expect(mockRenderPrompt).toHaveBeenCalledWith(
        expect.stringContaining("{targetLanguage}"),
        expect.arrayContaining([
          expect.objectContaining({ name: "targetLanguage" }),
        ]),
        { targetLanguage: "Chinese" },
      );
    });

    it("should throw when no provider configured", async () => {
      const configNoProvider: AIConfig = {
        ...mockConfig,
        selectedProviderId: null,
      };

      try {
        await service.translate("Hello world", "Chinese", configNoProvider);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("UNKNOWN_ERROR");
        expect((error as AIServiceError).message).toBe("No AI provider configured");
      }
    });

    it("should throw when provider is disabled", async () => {
      const disabledProvider = { ...mockProvider, enabled: false };
      const configDisabled: AIConfig = {
        ...mockConfig,
        providers: [disabledProvider],
      };

      try {
        await service.translate("Hello world", "Chinese", configDisabled);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("UNKNOWN_ERROR");
        expect((error as AIServiceError).message).toBe("No AI provider configured");
      }
    });
  });

  describe("translateWithRetry()", () => {
    it("should return on first successful attempt", async () => {
      mockGetContext.mockResolvedValue(mockContextData);
      mockGetDefaultPrompt.mockReturnValue(mockPrompt);
      mockRenderPrompt.mockReturnValue("rendered");
      mockTranslate.mockResolvedValue(mockResponse);

      const result = await service.translateWithRetry("Hello world", "Chinese", mockConfig);

      expect(result).toEqual(mockResponse);
      expect(mockTranslate).toHaveBeenCalledTimes(1);
    });

    it("should retry on retryable errors", async () => {
      const retryableError = new AIServiceError("RATE_LIMITED", "Rate limit exceeded", true);

      mockGetContext.mockResolvedValue(mockContextData);
      mockGetDefaultPrompt.mockReturnValue(mockPrompt);
      mockRenderPrompt.mockReturnValue("rendered");
      mockTranslate
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce(mockResponse);

      const result = await service.translateWithRetry("Hello world", "Chinese", mockConfig, 3);

      expect(result).toEqual(mockResponse);
      expect(mockTranslate).toHaveBeenCalledTimes(3);
    });

    it("should NOT retry on non-retryable errors", async () => {
      const nonRetryableError = new AIServiceError("AUTH_ERROR", "Invalid API key", false);

      mockGetContext.mockResolvedValue(mockContextData);
      mockGetDefaultPrompt.mockReturnValue(mockPrompt);
      mockRenderPrompt.mockReturnValue("rendered");
      mockTranslate.mockRejectedValue(nonRetryableError);

      try {
        await service.translateWithRetry("Hello world", "Chinese", mockConfig, 3);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        expect((error as AIServiceError).code).toBe("AUTH_ERROR");
      }

      // Should only be called once — no retry
      expect(mockTranslate).toHaveBeenCalledTimes(1);
    });

    it("should throw after max retries exhausted", async () => {
      const retryableError = new AIServiceError("NETWORK_ERROR", "Connection failed", true);

      mockGetContext.mockResolvedValue(mockContextData);
      mockGetDefaultPrompt.mockReturnValue(mockPrompt);
      mockRenderPrompt.mockReturnValue("rendered");
      mockTranslate.mockRejectedValue(retryableError);

      try {
        await service.translateWithRetry("Hello world", "Chinese", mockConfig, 2);
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
      mockGetDefaultPrompt.mockReturnValue(mockPrompt);
      mockRenderPrompt.mockReturnValue("rendered");
      mockTranslate.mockRejectedValue(genericError);

      await expect(
        service.translateWithRetry("Hello world", "Chinese", mockConfig, 3),
      ).rejects.toThrow("Something unexpected");

      expect(mockTranslate).toHaveBeenCalledTimes(1);
    });

    it("should use exponential backoff between retries", async () => {
      const retryableError = new AIServiceError("RATE_LIMITED", "Rate limit exceeded", true);

      mockGetContext.mockResolvedValue(mockContextData);
      mockGetDefaultPrompt.mockReturnValue(mockPrompt);
      mockRenderPrompt.mockReturnValue("rendered");

      // Fail twice, succeed on third
      mockTranslate
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce(mockResponse);

      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

      await service.translateWithRetry("Hello world", "Chinese", mockConfig, 3);

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
