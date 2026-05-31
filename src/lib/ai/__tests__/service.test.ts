import { describe, it, expect } from "vitest";
import {
  AIServiceError,
  type TranslationRequest,
  type TranslationResponse,
  type AIServiceErrorCode,
  type AITranslationService,
} from "../service";
import type { AIProvider } from "../types";

describe("TranslationRequest", () => {
  it("should have all required fields", () => {
    const request: TranslationRequest = {
      text: "Hello world",
      context: "Hello world",
      targetLanguage: "Chinese",
      systemMessage: "You are a professional translator.",
      userMessage: "Text to translate:\nHello world",
    };

    expect(request.text).toBe("Hello world");
    expect(request.context).toBe("Hello world");
    expect(request.targetLanguage).toBe("Chinese");
    expect(request.systemMessage).toBe("You are a professional translator.");
    expect(request.userMessage).toBe("Text to translate:\nHello world");
  });
});

describe("TranslationResponse", () => {
  it("should have all required fields", () => {
    const provider: AIProvider = {
      id: "test-provider",
      name: "Test Provider",
      type: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test",
      model: "gpt-4o",
      maxTokens: 4096,
      temperature: 0.7,
      enabled: true,
    };

    const response: TranslationResponse = {
      translation: "你好世界",
      originalText: "Hello world",
      provider,
      cached: false,
    };

    expect(response.translation).toBe("你好世界");
    expect(response.originalText).toBe("Hello world");
    expect(response.provider).toBe(provider);
    expect(response.cached).toBe(false);
  });
});

describe("AIServiceError", () => {
  it("should be throwable with code, message, and retryable", () => {
    const error = new AIServiceError("NETWORK_ERROR", "Connection failed", true);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AIServiceError);
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.message).toBe("Connection failed");
    expect(error.retryable).toBe(true);
  });

  it("should default retryable to false", () => {
    const error = new AIServiceError("API_ERROR", "Invalid request");

    expect(error.retryable).toBe(false);
  });

  it("should have correct name property", () => {
    const error = new AIServiceError("AUTH_ERROR", "Invalid API key");

    expect(error.name).toBe("AIServiceError");
  });
});

describe("AIServiceErrorCode", () => {
  it("should include all expected error codes", () => {
    const expectedCodes: AIServiceErrorCode[] = [
      "NETWORK_ERROR",
      "API_ERROR",
      "AUTH_ERROR",
      "RATE_LIMITED",
      "TIMEOUT",
      "UNKNOWN_ERROR",
    ];

    // Type-level check: all values should be assignable to AIServiceErrorCode
    for (const code of expectedCodes) {
      const errorCode: AIServiceErrorCode = code;
      expect(errorCode).toBe(code);
    }

    expect(expectedCodes).toHaveLength(6);
  });
});

describe("AITranslationService", () => {
  it("should be implementable with translate and testConnection methods", () => {
    // Compile-time check: a mock implementation should satisfy the interface
    const mockService: AITranslationService = {
      translate: async (request, provider) => ({
        translation: "translated",
        originalText: request.text,
        provider,
        cached: false,
      }),
      testConnection: async () => true,
    };

    expect(mockService.translate).toBeDefined();
    expect(mockService.testConnection).toBeDefined();
    expect(typeof mockService.translate).toBe("function");
    expect(typeof mockService.testConnection).toBe("function");
  });
});
