import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, streamText, APICallError } from "ai";
import type { AIProvider } from "../types";
import type {
  AITranslationService,
  StreamingTranslationResponse,
  TranslationRequest,
  TranslationResponse,
} from "../service";
import { AIServiceError } from "../service";

/**
 * Create an AI SDK provider instance from our config shape.
 * Reused per-call to pick up any config changes.
 */
function createProvider(config: AIProvider) {
  return createOpenAICompatible({
    name: config.name,
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
  });
}

/**
 * Map AI SDK errors to our domain error codes.
 */
function toAIServiceError(error: unknown): AIServiceError {
  if (error instanceof AIServiceError) {
    return error;
  }

  if (error instanceof APICallError) {
    const status = error.statusCode;
    if (status === 401 || status === 403) {
      return new AIServiceError("AUTH_ERROR", error.message);
    }
    if (status === 429) {
      return new AIServiceError("RATE_LIMITED", error.message, true);
    }
    if (status !== undefined && status >= 500) {
      return new AIServiceError("API_ERROR", error.message, true);
    }
    return new AIServiceError("API_ERROR", error.message, error.isRetryable);
  }

  // Network / abort / unknown
  const message =
    error instanceof Error ? error.message : "Unknown error";
  return new AIServiceError("NETWORK_ERROR",
    `Failed to connect to provider: ${message}`,
    true,
  );
}

/**
 * OpenAI-compatible provider for AI translation.
 * Works with OpenAI API and any compatible API (DeepSeek, Ollama, etc.)
 */
export class OpenAIProvider implements AITranslationService {
  async translate(
    request: TranslationRequest,
    provider: AIProvider,
  ): Promise<TranslationResponse> {
    try {
      const sdkProvider = createProvider(provider);
      const model = sdkProvider.chatModel(provider.model);

      const { text } = await generateText({
        model,
        system: request.systemMessage,
        prompt: request.userMessage,
        maxOutputTokens: provider.maxTokens,
        temperature: provider.temperature,
      });

      const trimmed = text.trim();
      if (!trimmed) {
        throw new AIServiceError("API_ERROR", "Empty translation response");
      }

      return {
        translation: trimmed,
        originalText: request.text,
        provider,
        cached: false,
      };
    } catch (error) {
      throw toAIServiceError(error);
    }
  }

  async translateStream(
    request: TranslationRequest,
    provider: AIProvider,
    options?: { abortSignal?: AbortSignal; onError?: (error: Error) => void },
  ): Promise<StreamingTranslationResponse> {
    const sdkProvider = createProvider(provider);
    const model = sdkProvider.chatModel(provider.model);

    const result = streamText({
      model,
      system: request.systemMessage,
      prompt: request.userMessage,
      maxOutputTokens: provider.maxTokens,
      temperature: provider.temperature,
      abortSignal: options?.abortSignal,
      onError: ({ error }) => {
        options?.onError?.(
          error instanceof Error ? error : new Error(String(error)),
        );
      },
    });

    return {
      textStream: result.textStream,
      provider,
    };
  }

  async testConnection(provider: AIProvider): Promise<boolean> {
    try {
      const response = await fetch(`${provider.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
