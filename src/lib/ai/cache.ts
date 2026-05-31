import type { TranslationResponse } from "./service";

/**
 * Simple in-memory cache for translation results.
 * Uses a Map with text+language as key.
 */
export class TranslationCache {
  private cache = new Map<string, TranslationResponse>();

  /**
   * Generate a cache key from text and target language.
   */
  private getKey(text: string, targetLanguage: string): string {
    return `${text}::${targetLanguage}`;
  }

  /**
   * Get a cached translation result.
   *
   * @param text - The original text
   * @param targetLanguage - The target language
   * @returns Cached response or undefined
   */
  get(text: string, targetLanguage: string): TranslationResponse | undefined {
    return this.cache.get(this.getKey(text, targetLanguage));
  }

  /**
   * Store a translation result in cache.
   *
   * @param text - The original text
   * @param targetLanguage - The target language
   * @param response - The translation response to cache
   */
  set(
    text: string,
    targetLanguage: string,
    response: TranslationResponse
  ): void {
    this.cache.set(this.getKey(text, targetLanguage), response);
  }

  /**
   * Check if a translation is cached.
   */
  has(text: string, targetLanguage: string): boolean {
    return this.cache.has(this.getKey(text, targetLanguage));
  }

  /**
   * Clear all cached translations.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the number of cached items.
   */
  get size(): number {
    return this.cache.size;
  }
}
