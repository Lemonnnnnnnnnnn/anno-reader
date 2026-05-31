/**
 * Types for the dictionary lookup module.
 * These types define provider configuration, search results,
 * and aggregated results for multiple dictionary sources.
 */

import type { DictionaryError } from "./errors";

// ---------------------------------------------------------------------------
// Provider Types
// ---------------------------------------------------------------------------

/** Supported dictionary provider types. */
export type DictionaryProviderType = "etymonline" | "vocabulary";

/**
 * Configuration for a single dictionary provider.
 * Stores connection details, search parameters, and provider-specific options.
 */
export interface DictionaryConfig {
  /** Unique provider identifier */
  id: string;
  /** Human-readable provider name */
  name: string;
  /** Whether this provider is active */
  enabled: boolean;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Maximum results to return per search */
  maxResults?: number;
  /** Arbitrary provider-specific configuration */
  options?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Result Types
// ---------------------------------------------------------------------------

/**
 * Base result from a dictionary provider search.
 * All provider-specific results extend this interface.
 */
export interface DictionaryResult {
  /** The dictionary source name (e.g. "etymonline", "vocabulary") */
  source: string;
  /** The word that was looked up */
  word: string;
  /** Whether the word was found in this dictionary */
  found: boolean;
  /** Source-specific data payload */
  data: unknown;
}

/**
 * A single etymology item from Etymonline.
 */
export interface EtymonlineResultItem {
  /** The word's etymology */
  etymology: string;
  /** The first known use date/period */
  firstUse?: string;
  /** Related words or forms */
  relatedWords?: string[];
}

/**
 * Result from the Etymonline dictionary provider.
 */
export interface EtymonlineResult extends DictionaryResult {
  source: "etymonline";
  data: {
    items: EtymonlineResultItem[];
  };
}

/**
 * Result from the Vocabulary.com dictionary provider.
 */
export interface VocabularyResult extends DictionaryResult {
  source: "vocabulary";
  data: {
    short: string;
    long: string;
  };
}

// ---------------------------------------------------------------------------
// Aggregated Result
// ---------------------------------------------------------------------------

/**
 * Error entry associated with a specific provider in an aggregated result.
 */
export interface AggregatedDictionaryError {
  /** The provider source that errored */
  source: string;
  /** The error that occurred */
  error: DictionaryError;
}

/**
 * Combined result from querying multiple dictionary providers.
 */
export interface AggregatedDictionaryResult {
  /** The word that was looked up */
  word: string;
  /** Results from each successful provider */
  results: DictionaryResult[];
  /** Number of providers that returned results successfully */
  successCount: number;
  /** Errors from providers that failed */
  errors: AggregatedDictionaryError[];
  /** Total query duration in milliseconds */
  duration: number;
}

// ---------------------------------------------------------------------------
// Search Function Type
// ---------------------------------------------------------------------------

/**
 * Signature for a dictionary provider search function.
 * Each provider implements this to search for a word.
 */
export type DictionarySearchFunction = (
  word: string,
  config: DictionaryConfig
) => Promise<DictionaryResult>;
