/**
 * Dictionary aggregator that queries multiple providers in parallel
 * with independent timeouts and structured error handling.
 */

import type {
  DictionaryConfig,
  DictionaryResult,
  DictionarySearchFunction,
  AggregatedDictionaryResult,
  AggregatedDictionaryError,
} from "./types";
import { DictionaryError, handleTimeout } from "./errors";

// ---------------------------------------------------------------------------
// Provider Entry
// ---------------------------------------------------------------------------

interface ProviderEntry {
  searchFn: DictionarySearchFunction;
  config: DictionaryConfig;
}

// ---------------------------------------------------------------------------
// DictionaryAggregator
// ---------------------------------------------------------------------------

/**
 * Orchestrates parallel dictionary lookups across multiple providers.
 *
 * Each provider runs independently with its own timeout. Results are
 * aggregated into a single `AggregatedDictionaryResult` with per-provider
 * error tracking.
 */
export class DictionaryAggregator {
  private providers = new Map<string, ProviderEntry>();

  /**
   * Register a dictionary provider for aggregated searches.
   *
   * @param id - Unique provider identifier
   * @param searchFn - Provider search function
   * @param config - Provider configuration
   */
  registerProvider(
    id: string,
    searchFn: DictionarySearchFunction,
    config: DictionaryConfig,
  ): void {
    this.providers.set(id, { searchFn, config });
  }

  /**
   * Search all registered providers (or a subset) in parallel.
   *
   * Each provider is queried independently with its own timeout.
   * Failed providers are tracked in the errors array without
   * preventing successful results from being returned.
   *
   * @param word - Word to look up
   * @param dictionaryIds - Optional subset of provider IDs to query
   * @returns Aggregated results from all providers
   */
  async search(
    word: string,
    dictionaryIds?: string[],
  ): Promise<AggregatedDictionaryResult> {
    const startTime = Date.now();

    // Determine which providers to query
    const targetIds = dictionaryIds ?? Array.from(this.providers.keys());
    const entries = targetIds
      .map((id) => ({ id, entry: this.providers.get(id) }))
      .filter(
        (item): item is { id: string; entry: ProviderEntry } =>
          item.entry !== undefined && item.entry.config.enabled,
      );

    // Run all providers in parallel with independent timeouts
    const settled = await Promise.allSettled(
      entries.map(({ id, entry }) =>
        this.queryWithTimeout(word, id, entry),
      ),
    );

    // Collect results and errors
    const results: DictionaryResult[] = [];
    const errors: AggregatedDictionaryError[] = [];

    for (let i = 0; i < settled.length; i++) {
      const outcome = settled[i];
      const source = entries[i].id;

      if (outcome.status === "fulfilled") {
        results.push(outcome.value);
      } else {
        errors.push({
          source,
          error: this.toDictionaryError(outcome.reason, source),
        });
      }
    }

    return {
      word,
      results,
      successCount: results.length,
      errors,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Search a single provider by ID.
   *
   * @param word - Word to look up
   * @param dictionaryId - Provider ID to query
   * @returns Result from the provider
   * @throws DictionaryError if provider not found or query fails
   */
  async searchSingle(
    word: string,
    dictionaryId: string,
  ): Promise<DictionaryResult> {
    const entry = this.providers.get(dictionaryId);
    if (!entry) {
      throw new Error(
        `Dictionary provider "${dictionaryId}" not registered`,
      );
    }

    return this.queryWithTimeout(word, dictionaryId, entry);
  }

  // -------------------------------------------------------------------------
  // Internal Helpers
  // -------------------------------------------------------------------------

  /**
   * Execute a provider search with an independent timeout.
   * Uses AbortController to enforce the timeout from the provider config.
   */
  private async queryWithTimeout(
    word: string,
    source: string,
    entry: ProviderEntry,
  ): Promise<DictionaryResult> {
    const timeout = entry.config.timeout ?? 5000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      // Race the provider search against the timeout
      const result = await Promise.race([
        entry.searchFn(word, entry.config),
        this.createTimeoutPromise(source, timeout, controller.signal),
      ]);

      return result;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Create a promise that rejects after the given timeout.
   * Used with Promise.race to enforce provider timeouts.
   */
  private createTimeoutPromise(
    source: string,
    timeout: number,
    signal: AbortSignal,
  ): Promise<never> {
    return new Promise<never>((_, reject) => {
      const onAbort = () => {
        reject(handleTimeout(source));
      };

      if (signal.aborted) {
        onAbort();
        return;
      }

      signal.addEventListener("abort", onAbort, { once: true });

      // Also set a direct timeout as a safety net
      setTimeout(() => {
        reject(handleTimeout(source));
      }, timeout);
    });
  }

  /**
   * Normalize an unknown rejection reason into a DictionaryError.
   */
  private toDictionaryError(reason: unknown, source: string) {
    if (reason instanceof DictionaryError) {
      return reason;
    }

    const message = reason instanceof Error ? reason.message : String(reason);
    return new DictionaryError("UNKNOWN_ERROR", message, source, false);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a DictionaryAggregator with Etymonline and Collins providers
 * registered using their default configurations.
 *
 * @returns Configured aggregator ready for lookups
 */
export async function createDefaultAggregator(): Promise<DictionaryAggregator> {
  const aggregator = new DictionaryAggregator();

  // Import providers dynamically to avoid circular dependencies
  const etymonline = await import("./providers/etymonline");
  const collins = await import("./providers/collins");

  const etymonlineConfig = etymonline.getDefaultConfig();
  const collinsConfig = collins.getDefaultConfig();

  aggregator.registerProvider(
    etymonlineConfig.id,
    etymonline.search,
    etymonlineConfig,
  );

  aggregator.registerProvider(
    collinsConfig.id,
    collins.search,
    collinsConfig,
  );

  return aggregator;
}
