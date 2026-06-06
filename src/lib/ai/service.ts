import type { AIProvider } from "./types";

/**
 * Request to translate text via AI.
 */
export interface TranslationRequest {
  /** The text to translate */
  text: string;
  /** Surrounding context for better translation */
  context: string;
  /** Target language for translation */
  targetLanguage: string;
  /** System message to set AI behavior */
  systemMessage: string;
  /** User message with context and text to translate */
  userMessage: string;
}

/**
 * Response from AI translation.
 */
export interface TranslationResponse {
  /** The translated text */
  translation: string;
  /** The original text that was translated */
  originalText: string;
  /** The provider used for translation */
  provider: AIProvider;
  /** Whether this result was served from cache */
  cached: boolean;
}

/**
 * Response from streaming AI translation.
 */
export interface StreamingTranslationResponse {
  /** Async iterable of translated text chunks */
  textStream: AsyncIterable<string>;
  /** The provider used for translation */
  provider: AIProvider;
}

/**
 * Error codes for AI service failures.
 */
export type AIServiceErrorCode =
  | "NETWORK_ERROR"
  | "API_ERROR"
  | "AUTH_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "UNKNOWN_ERROR";

/**
 * Structured error from AI service operations.
 */
export class AIServiceError extends Error {
  code: AIServiceErrorCode;
  retryable: boolean;

  constructor(code: AIServiceErrorCode, message: string, retryable = false) {
    super(message);
    this.name = "AIServiceError";
    this.code = code;
    this.retryable = retryable;
  }
}

/**
 * Interface for AI translation service implementations.
 * Each provider (OpenAI, DeepSeek, etc.) implements this interface.
 */
export interface AITranslationService {
  /** Translate text using the provider */
  translate(
    request: TranslationRequest,
    provider: AIProvider
  ): Promise<TranslationResponse>;

  /** Translate text with streaming response (optional, for providers that support it) */
  translateStream?(
    request: TranslationRequest,
    provider: AIProvider,
    options?: { abortSignal?: AbortSignal; onError?: (error: Error) => void }
  ): Promise<StreamingTranslationResponse>;

  /** Test if a provider configuration is valid */
  testConnection(provider: AIProvider): Promise<boolean>;
}
