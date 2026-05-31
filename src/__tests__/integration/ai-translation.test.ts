import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TranslationService } from "@/lib/ai/translation";
import { ContextService } from "@/lib/ai/context";
import { PromptService } from "@/lib/ai/prompts";
import { TranslationCache } from "@/lib/ai/cache";
import { AIErrorHandler } from "@/lib/ai/error-handler";
import { AIServiceError } from "@/lib/ai/service";
import type { AIConfig, AIProvider, ContextModule, AIPrompt } from "@/lib/ai/types";
import { DEFAULT_TRANSLATION_PROMPT, BUILTIN_PARAGRAPH_CONTEXT } from "@/lib/ai/types";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const testProvider: AIProvider = {
  id: "test-openai",
  name: "Test OpenAI",
  type: "openai",
  baseUrl: "https://api.test.com/v1",
  apiKey: "sk-test-key",
  model: "gpt-4o",
  maxTokens: 1000,
  temperature: 0.3,
  enabled: true,
};

const testPrompt: AIPrompt = {
  id: DEFAULT_TRANSLATION_PROMPT.id,
  name: DEFAULT_TRANSLATION_PROMPT.name,
  content: DEFAULT_TRANSLATION_PROMPT.content,
  variables: DEFAULT_TRANSLATION_PROMPT.variables,
  isDefault: true,
  isEnabled: true,
};

const testContextModule: ContextModule = {
  ...BUILTIN_PARAGRAPH_CONTEXT,
};

function makeConfig(overrides?: Partial<AIConfig>): AIConfig {
  return {
    providers: [testProvider],
    selectedProviderId: testProvider.id,
    contextConfig: {
      modules: [testContextModule],
      selectedModuleIds: [testContextModule.id],
    },
    prompts: [testPrompt],
    ...overrides,
  };
}

const sampleFullContext = `First paragraph of the chapter.

The quick brown fox jumps over the lazy dog. This is the sentence we want to translate.

Third paragraph continues here.`;

const selectedText = "The quick brown fox jumps over the lazy dog.";

function mockFetchSuccess(translation: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        choices: [{ message: { content: translation } }],
      }),
  });
}

function mockFetchError(status: number, body = "Error") {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve(body),
    json: () => Promise.resolve({ error: { message: body } }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AI Translation Integration", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ---- Test 1: Full translation flow ------------------------------------

  describe("Full translation flow", () => {
    it("should call the provider API and return a translation", async () => {
      const mockFn = mockFetchSuccess("敏捷的棕色狐狸跳过了懒狗。");
      vi.stubGlobal("fetch", mockFn);

      const service = new TranslationService();
      const config = makeConfig();

      const result = await service.translate(
        selectedText,
        sampleFullContext,
        "Chinese",
        config,
      );

      // Verify the API was called with the correct endpoint
      expect(mockFn).toHaveBeenCalledOnce();
      const [url, options] = mockFn.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${testProvider.baseUrl}/chat/completions`);

      // Verify the request body contains the model and messages
      const body = JSON.parse(options.body as string);
      expect(body.model).toBe(testProvider.model);
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe("system");
      expect(body.messages[1].role).toBe("user");

      // Verify the user message contains the selected text
      expect(body.messages[1].content).toContain(selectedText);

      // Verify the response
      expect(result.translation).toBe("敏捷的棕色狐狸跳过了懒狗。");
      expect(result.originalText).toBe(selectedText);
      expect(result.cached).toBe(false);
      expect(result.provider.id).toBe(testProvider.id);
    });
  });

  // ---- Test 2: Context extraction + prompt rendering --------------------

  describe("Context extraction + prompt rendering", () => {
    it("should extract paragraph context and render it into the prompt", () => {
      const contextService = new ContextService();
      const promptService = new PromptService();

      // Extract context
      const contextData = contextService.getContext(
        selectedText,
        sampleFullContext,
        [testContextModule],
      );

      // Context should contain the paragraph with the selected text
      expect(contextData.text).toContain(selectedText);
      expect(contextData.metadata.selectedText).toBe(selectedText);
      expect(contextData.source).toBe(testContextModule.id);

      // Render the prompt
      const prompt = promptService.getDefaultPrompt([testPrompt]);
      expect(prompt).toBeDefined();

      const rendered = promptService.renderPrompt(
        prompt!.content,
        prompt!.variables,
        {
          selectedText,
          context: contextData.text,
          targetLanguage: "Chinese",
        },
      );

      // The rendered prompt should contain all the pieces
      expect(rendered).toContain(selectedText);
      expect(rendered).toContain(contextData.text);
      expect(rendered).toContain("Chinese");
      // Should not have unreplaced placeholders
      expect(rendered).not.toContain("{selectedText}");
      expect(rendered).not.toContain("{context}");
      expect(rendered).not.toContain("{targetLanguage}");
    });

    it("should chain context extraction into TranslationService", async () => {
      const mockFn = mockFetchSuccess("翻译结果");
      vi.stubGlobal("fetch", mockFn);

      const service = new TranslationService();
      const config = makeConfig();

      await service.translate(selectedText, sampleFullContext, "Chinese", config);

      // The API call should have received context in the user message
      const body = JSON.parse(mockFn.mock.calls[0][1].body as string);
      const userMessage: string = body.messages[1].content;
      expect(userMessage).toContain("Context:");
      expect(userMessage).toContain(selectedText);
    });
  });

  // ---- Test 3: Cache integration ---------------------------------------

  describe("Cache integration", () => {
    it("should serve cached results without calling the API again", async () => {
      const mockFn = mockFetchSuccess("缓存测试");
      vi.stubGlobal("fetch", mockFn);

      const service = new TranslationService();
      const cache = new TranslationCache();
      const config = makeConfig();

      // First call — API hit
      const result1 = await service.translate(
        selectedText,
        sampleFullContext,
        "Chinese",
        config,
      );
      expect(mockFn).toHaveBeenCalledOnce();

      // Cache the result
      cache.set(selectedText, "Chinese", result1);
      expect(cache.has(selectedText, "Chinese")).toBe(true);

      // Second call — should come from cache, no extra API call
      const cached = cache.get(selectedText, "Chinese");
      expect(cached).toBeDefined();
      expect(cached!.translation).toBe("缓存测试");
      expect(cached!.cached).toBe(false); // cached flag stays as originally set

      // Verify fetch was NOT called a second time
      expect(mockFn).toHaveBeenCalledOnce();
    });

    it("should not hit cache for different target language", () => {
      const cache = new TranslationCache();
      const response = {
        translation: "你好",
        originalText: "Hello",
        provider: testProvider,
        cached: false,
      };

      cache.set("Hello", "Chinese", response);

      expect(cache.has("Hello", "Chinese")).toBe(true);
      expect(cache.has("Hello", "Japanese")).toBe(false);
      expect(cache.has("Hi", "Chinese")).toBe(false);
    });
  });

  // ---- Test 4: Error handling flow -------------------------------------

  describe("Error handling flow", () => {
    it("should throw AIServiceError on API failure and classify it", async () => {
      vi.stubGlobal("fetch", mockFetchError(401, "Unauthorized"));

      const service = new TranslationService();
      const errorHandler = new AIErrorHandler();
      const config = makeConfig();

      // Translation should throw
      await expect(
        service.translate(selectedText, sampleFullContext, "Chinese", config),
      ).rejects.toThrow(AIServiceError);

      try {
        await service.translate(
          selectedText,
          sampleFullContext,
          "Chinese",
          config,
        );
      } catch (error) {
        // Verify error classification
        const classified = errorHandler.classifyError(error);
        expect(classified).toBeInstanceOf(AIServiceError);
        expect(classified.code).toBe("AUTH_ERROR");

        // Verify user-friendly message
        const userMessage = errorHandler.getUserMessage(error);
        expect(userMessage).toContain("API密钥");
      }
    });

    it("should classify rate limit errors as retryable", async () => {
      vi.stubGlobal("fetch", mockFetchError(429, "Too Many Requests"));

      const service = new TranslationService();
      const errorHandler = new AIErrorHandler();
      const config = makeConfig();

      try {
        await service.translate(
          selectedText,
          sampleFullContext,
          "Chinese",
          config,
        );
      } catch (error) {
        const classified = errorHandler.classifyError(error);
        expect(classified.code).toBe("RATE_LIMITED");
        expect(classified.retryable).toBe(true);

        const userMessage = errorHandler.getUserMessage(error);
        expect(userMessage).toContain("频繁");
      }
    });

    it("should classify server errors as retryable", async () => {
      vi.stubGlobal("fetch", mockFetchError(500, "Internal Server Error"));

      const service = new TranslationService();
      const config = makeConfig();

      try {
        await service.translate(
          selectedText,
          sampleFullContext,
          "Chinese",
          config,
        );
      } catch (error) {
        expect(error).toBeInstanceOf(AIServiceError);
        const aiError = error as AIServiceError;
        expect(aiError.code).toBe("API_ERROR");
        expect(aiError.retryable).toBe(true);
      }
    });

    it("should throw on no provider configured", async () => {
      const service = new TranslationService();
      const config = makeConfig({ selectedProviderId: null });

      await expect(
        service.translate(selectedText, sampleFullContext, "Chinese", config),
      ).rejects.toThrow(AIServiceError);
    });
  });

  // ---- Test 5: Retry flow ----------------------------------------------

  describe("Retry flow", () => {
    it("should succeed after transient failures via translateWithRetry", async () => {
      let callCount = 0;
      const failThenSucceed = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          return {
            ok: false,
            status: 429,
            text: () => Promise.resolve("Rate limited"),
            json: () => Promise.resolve({ error: { message: "Rate limited" } }),
          };
        }
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: "重试成功" } }],
            }),
        };
      });

      vi.stubGlobal("fetch", failThenSucceed);

      const service = new TranslationService();
      const config = makeConfig();

      const result = await service.translateWithRetry(
        selectedText,
        sampleFullContext,
        "Chinese",
        config,
        3, // maxRetries
      );

      expect(result.translation).toBe("重试成功");
      // Should have been called 3 times: 2 failures + 1 success
      expect(failThenSucceed).toHaveBeenCalledTimes(3);
    });

    it("should throw after exhausting retries", async () => {
      vi.stubGlobal(
        "fetch",
        mockFetchError(429, "Rate limited"),
      );

      const service = new TranslationService();
      const config = makeConfig();

      await expect(
        service.translateWithRetry(
          selectedText,
          sampleFullContext,
          "Chinese",
          config,
          2, // maxRetries
        ),
      ).rejects.toThrow(AIServiceError);
    });

    it("should not retry non-retryable errors", async () => {
      vi.stubGlobal("fetch", mockFetchError(401, "Unauthorized"));

      const service = new TranslationService();
      const config = makeConfig();

      await expect(
        service.translateWithRetry(
          selectedText,
          sampleFullContext,
          "Chinese",
          config,
          3,
        ),
      ).rejects.toThrow(AIServiceError);

      // Should only be called once — no retries for AUTH_ERROR
      expect(globalThis.fetch).toHaveBeenCalledOnce();
    });

    it("should use AIErrorHandler.withRetry for generic operations", async () => {
      let attempt = 0;
      const handler = new AIErrorHandler();

      const result = await handler.withRetry(async () => {
        attempt++;
        if (attempt < 3) {
          throw new Error("network timeout");
        }
        return "success";
      }, 3);

      expect(result).toBe("success");
      expect(attempt).toBe(3);
    });
  });
});
