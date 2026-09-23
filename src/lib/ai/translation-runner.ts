/**
 * Shared streaming-translation runner.
 *
 * Wraps `TranslationService.translateStream` with the two things every caller
 * needs and must get right:
 *
 * 1. Retry around the *whole* flow including stream consumption — the
 *    provider request is lazy, so failures surface during iteration, not when
 *    `translateStream()` resolves.
 * 2. Writing the finished translation back into the translation cache.
 *
 * Callers that want UI state (the translation panel) pass `onStreamStart`,
 * `onChunk` and `onRetry`; callers that only want the text (background
 * translation) pass nothing.
 */

import { translationService } from "./translation";
import { AIErrorHandler } from "./error-handler";
import type { AIServiceError } from "./service";
import type { AIConfig, AIProvider } from "./types";

const errorHandler = new AIErrorHandler();

export interface RunTranslationParams {
  /** Text to translate */
  text: string;
  /** Target language, e.g. "Chinese" */
  targetLanguage: string;
  /** AI configuration (providers, roles, context modules) */
  config: AIConfig;
  /** Plain text of the current chapter/page, used as context */
  chapterText?: string | null;
  /** Character offset of the selection, used to pick surrounding context */
  offset?: number;
  /** Sentence containing the selection */
  selectionSentence?: string;
  /** Aborts the request; a mid-stream abort keeps the text accumulated so far */
  abortSignal?: AbortSignal;
  /** Called once the provider request is live, before the first chunk */
  onStreamStart?: () => void;
  /** Called per chunk with the full text accumulated so far */
  onChunk?: (accumulated: string) => void;
  /** Called when the provider reports an error mid-stream */
  onStreamError?: (error: Error) => void;
  /** Called before each retry backoff; `attempt` is 1-based */
  onRetry?: (attempt: number, error: AIServiceError) => void;
  /** Bypass the translation cache */
  force?: boolean;
  /** Retries after the first attempt (default: 3) */
  maxRetries?: number;
}

export interface RunTranslationResult {
  /** The accumulated translation */
  translation: string;
  /** Provider that produced it */
  provider: AIProvider;
}

/**
 * Translate text and accumulate the streamed result, retrying retryable
 * failures and caching the finished translation.
 *
 * @throws {AIServiceError} When the provider/role is missing or all retries fail.
 */
export async function runTranslationStream({
  text,
  targetLanguage,
  config,
  chapterText,
  offset,
  selectionSentence,
  abortSignal,
  onStreamStart,
  onChunk,
  onStreamError,
  onRetry,
  force,
  maxRetries = 3,
}: RunTranslationParams): Promise<RunTranslationResult> {
  return errorHandler.withRetry(
    async () => {
      const result = await translationService.translateStream(
        text,
        targetLanguage,
        config,
        { abortSignal, onError: onStreamError, force },
        chapterText ?? undefined,
        offset,
        selectionSentence,
      );

      onStreamStart?.();

      let accumulated = "";
      for await (const chunk of result.textStream) {
        if (abortSignal?.aborted) break;
        accumulated += chunk;
        onChunk?.(accumulated);
      }

      translationService.cacheTranslation(text, targetLanguage, accumulated, result.provider);

      return { translation: accumulated, provider: result.provider };
    },
    maxRetries,
    onRetry,
  );
}
