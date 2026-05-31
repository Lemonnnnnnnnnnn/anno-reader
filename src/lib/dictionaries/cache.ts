import type { DictionaryResult } from "./types";

interface CacheEntry {
  result: DictionaryResult;
  lastAccessed: number;
  createdAt: number;
}

/**
 * In-memory LRU cache for dictionary lookup results with TTL expiration.
 * Keyed by composite `${word}::${source}`.
 */
export class DictionaryCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize = 100, ttlMs = 3_600_000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  private getKey(word: string, source: string): string {
    return `${word}::${source}`;
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.createdAt > this.ttlMs;
  }

  private evict(): void {
    if (this.cache.size <= this.maxSize) return;

    // Find the entry with the oldest lastAccessed timestamp
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey !== null) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Get a cached dictionary result. Returns undefined if missing or expired.
   * Updates lastAccessed timestamp for LRU tracking.
   */
  get(word: string, source: string): DictionaryResult | undefined {
    const key = this.getKey(word, source);
    const entry = this.cache.get(key);

    if (!entry) return undefined;

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return undefined;
    }

    // Update access time for LRU
    entry.lastAccessed = Date.now();
    return entry.result;
  }

  /**
   * Store a dictionary result in cache.
   * Evicts oldest entry if maxSize reached.
   */
  set(word: string, source: string, result: DictionaryResult): void {
    const key = this.getKey(word, source);
    const now = Date.now();

    this.cache.set(key, {
      result,
      lastAccessed: now,
      createdAt: now,
    });

    this.evict();
  }

  /**
   * Check if a dictionary result is cached (and not expired).
   */
  has(word: string, source: string): boolean {
    const key = this.getKey(word, source);
    const entry = this.cache.get(key);

    if (!entry) return false;

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the number of cached entries.
   */
  get size(): number {
    return this.cache.size;
  }
}
