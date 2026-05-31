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
  /** ID of the prompt template to use */
  promptId: string;
  /** The fully rendered prompt to send to the provider */
  renderedPrompt: string;
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

  /** Test if a provider configuration is valid */
  testConnection(provider: AIProvider): Promise<boolean>;
}
