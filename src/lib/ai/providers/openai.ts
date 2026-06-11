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
import { AIErrorHandler } from "../error-handler";
import { createProxyFetch } from "@/lib/proxy/fetch";
import { useProxyConfigStore } from "@/stores/useProxyConfigStore";

const errorHandler = new AIErrorHandler();

/**
 * Create an AI SDK provider instance from our config shape.
 * Reused per-call to pick up any config changes, including proxy settings.
 */
function createProvider(config: AIProvider) {
  const { enabled, address, port } = useProxyConfigStore.getState();
  const proxyFetch = createProxyFetch({ enabled, address, port });

  return createOpenAICompatible({
    name: config.name,
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
    fetch: proxyFetch,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getCause(error: unknown): unknown {
  return isRecord(error) ? error.cause : undefined;
}

function getStatusCode(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;
  const status = error.statusCode ?? error.status;
  return typeof status === "number" ? status : undefined;
}

function getIsRetryable(error: unknown): boolean {
  if (!isRecord(error)) return false;
  return error.isRetryable === true || error.retryable === true;
}

function getMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function isAbortError(error: unknown): boolean {
  return isRecord(error) && error.name === "AbortError";
}

function isApiCallError(error: unknown): boolean {
  const isInstance =
    typeof APICallError.isInstance === "function" && APICallError.isInstance(error);

  return (
    isInstance ||
    error instanceof APICallError ||
    getStatusCode(error) !== undefined
  );
}

function findApiCallError(
  error: unknown,
  seen = new Set<unknown>(),
): unknown | null {
  if (seen.has(error)) return null;
  seen.add(error);

  if (isApiCallError(error)) {
    return error;
  }

  const cause = getCause(error);
  return cause === undefined ? null : findApiCallError(cause, seen);
}

/**
 * Map AI SDK errors to our domain error codes.
 */
function toAIServiceError(error: unknown): AIServiceError {
  if (error instanceof AIServiceError) {
    return error;
  }

  if (isAbortError(error)) {
    return new AIServiceError("UNKNOWN_ERROR", getMessage(error));
  }

  const apiError = findApiCallError(error);
  if (apiError) {
    const status = getStatusCode(apiError);
    const message = getMessage(apiError);
    if (status === 401 || status === 403) {
      return new AIServiceError("AUTH_ERROR", message);
    }
    if (status === 429) {
      return new AIServiceError("RATE_LIMITED", message, true);
    }
    if (status !== undefined && status >= 500) {
      return new AIServiceError("API_ERROR", message, true);
    }
    return new AIServiceError("API_ERROR", message, getIsRetryable(apiError));
  }

  const classified = errorHandler.classifyError(error);
  if (classified.code !== "UNKNOWN_ERROR") {
    return classified;
  }

  return new AIServiceError(
    "NETWORK_ERROR",
    `Failed to connect to provider: ${getMessage(error)}`,
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
    try {
      const sdkProvider = createProvider(provider);
      const model = sdkProvider.chatModel(provider.model);
      let streamError: Error | null = null;

      const result = streamText({
        model,
        system: request.systemMessage,
        prompt: request.userMessage,
        maxOutputTokens: provider.maxTokens,
        temperature: provider.temperature,
        abortSignal: options?.abortSignal,
        onError: ({ error }) => {
          streamError = error instanceof Error ? error : new Error(String(error));
          options?.onError?.(streamError);
        },
      });

      async function* textStream() {
        try {
          for await (const chunk of result.textStream) {
            yield chunk;
          }
          if (streamError) {
            throw streamError;
          }
        } catch (error) {
          if (isAbortError(error)) {
            throw error;
          }
          throw toAIServiceError(error);
        }
      }

      return {
        textStream: textStream(),
        provider,
      };
    } catch (error) {
      throw toAIServiceError(error);
    }
  }

  async testConnection(provider: AIProvider): Promise<boolean> {
    try {
      const { enabled, address, port } = useProxyConfigStore.getState();
      const proxyFetch = createProxyFetch({ enabled, address, port });

      const response = await proxyFetch(`${provider.baseUrl}/models`, {
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
