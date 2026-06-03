import { describe, it, expect, vi, beforeEach } from "vitest";
import { TranslationService } from "@/lib/ai/translation";
import { ContextService } from "@/lib/ai/context";
import { TranslationCache } from "@/lib/ai/cache";
import { AIErrorHandler } from "@/lib/ai/error-handler";
import { AIServiceError } from "@/lib/ai/service";
import type { AIConfig, AIProvider, ContextModule, AIPrompt, AIRole } from "@/lib/ai/types";
import { DEFAULT_TRANSLATION_PROMPT, BUILTIN_SENTENCE_CONTEXT } from "@/lib/ai/types";

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
  ...BUILTIN_SENTENCE_CONTEXT,
};

const testRole: AIRole = {
  id: "test-translator",
  name: "Test Translator",
  systemMessage: "You are a translator. Translate the text to {targetLanguage}.",
  userMessageTemplate: "Translate: {selectedText}",
  variables: [
    { name: "selectedText", description: "Text to translate", defaultValue: "", isRequired: true },
    { name: "targetLanguage", description: "Target language", defaultValue: "Chinese", isRequired: true },
  ],
  isDefault: true,
  isEnabled: true,
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
    roles: [testRole],
    selectedRoleId: testRole.id,
    ...overrides,
  };
}

const selectedText = "The quick brown fox jumps over the lazy dog.";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AI Translation Integration", () => {
  // ---- Test 1: Context extraction + prompt rendering --------------------

  describe("Context extraction", () => {
    it("should use selected text as context when no chapterText", async () => {
      const contextService = new ContextService();

      const contextData = await contextService.getContext(
        selectedText,
        null,
        [testContextModule],
      );

      expect(contextData.text).toBe(selectedText);
      expect(contextData.metadata.selectedText).toBe(selectedText);
      expect(contextData.source).toBe(testContextModule.id);
    });
  });

  // ---- Test 2: Prompt rendering ----------------------------------------

  describe("Prompt rendering", () => {
    it("should render prompt template with variables", () => {
      const prompt = testPrompt;
      let rendered = prompt.content;
      for (const variable of prompt.variables) {
        const value = ({ selectedText, targetLanguage: "Chinese" } as Record<string, string>)[variable.name] ?? variable.defaultValue;
        rendered = rendered.replace(new RegExp(`\\{${variable.name}\\}`, "g"), value);
      }

      expect(rendered).toContain(selectedText);
      expect(rendered).toContain("Chinese");
      expect(rendered).not.toContain("{selectedText}");
      expect(rendered).not.toContain("{targetLanguage}");
    });
  });

  // ---- Test 3: Cache integration ---------------------------------------

  describe("Cache integration", () => {
    it("should store and retrieve cached results", () => {
      const cache = new TranslationCache();
      const response = {
        translation: "缓存测试",
        originalText: selectedText,
        provider: testProvider,
        cached: false,
      };

      cache.set(selectedText, "Chinese", response);

      expect(cache.has(selectedText, "Chinese")).toBe(true);
      const cached = cache.get(selectedText, "Chinese");
      expect(cached).toBeDefined();
      expect(cached!.translation).toBe("缓存测试");
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
    it("should throw on no provider configured", async () => {
      const service = new TranslationService();
      const config = makeConfig({ selectedProviderId: null });

      await expect(
        service.translate(selectedText, "Chinese", config),
      ).rejects.toThrow(AIServiceError);
    });

    it("should throw on no role configured", async () => {
      const service = new TranslationService();
      const config = makeConfig({ selectedRoleId: null });

      await expect(
        service.translate(selectedText, "Chinese", config),
      ).rejects.toThrow(AIServiceError);
    });
  });

  // ---- Test 5: AIErrorHandler ------------------------------------------

  describe("AIErrorHandler", () => {
    it("should classify errors correctly", () => {
      const handler = new AIErrorHandler();

      const networkError = handler.classifyError(new Error("network timeout"));
      expect(networkError.code).toBe("NETWORK_ERROR");
      expect(networkError.retryable).toBe(true);

      const timeoutError = handler.classifyError(new Error("request timeout"));
      expect(timeoutError.code).toBe("TIMEOUT");
      expect(timeoutError.retryable).toBe(true);
    });

    it("should return user-friendly messages", () => {
      const handler = new AIErrorHandler();

      const authError = new AIServiceError("AUTH_ERROR", "Invalid key");
      expect(handler.getUserMessage(authError)).toContain("API密钥");

      const rateError = new AIServiceError("RATE_LIMITED", "Too many");
      expect(handler.getUserMessage(rateError)).toContain("频繁");

      const unknownError = new Error("something");
      expect(handler.getUserMessage(unknownError)).toContain("未知错误");
    });

    it("should retry with withRetry", async () => {
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
