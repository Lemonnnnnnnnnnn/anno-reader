import type { AIProvider } from "./types";
import type { DictionaryResult, AggregatedDictionaryError } from "@/lib/dictionaries";

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
 * Dictionary query debug information.
 */
export interface DictionaryDebugInfo {
  /** Results from each dictionary provider */
  results: DictionaryResult[];
  /** Errors from failed providers */
  errors: AggregatedDictionaryError[];
  /** Total query duration in milliseconds */
  duration: number;
}

/**
 * Preview data shown before sending to LLM.
 * Contains all context and prompt information for debugging.
 */
export interface PreviewData {
  /** The selected text to translate */
  selectedText: string;
  /** Target language */
  targetLanguage: string;
  /** The rendered prompt template */
  renderedPrompt: string;
  /** System message sent to LLM */
  systemMessage: string;
  /** User message sent to LLM */
  userMessage: string;
  /** Dictionary query results (if dictionary modules enabled) */
  dictionary?: DictionaryDebugInfo;
  /** Which context modules were used */
  contextSources: string[];
  /** Sentence context extracted */
  sentenceContext?: string;
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
