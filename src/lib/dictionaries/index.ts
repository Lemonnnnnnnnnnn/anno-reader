/**
 * Dictionary lookup module.
 *
 * Provides unified access to multiple dictionary sources (Etymonline, Collins)
 * with structured error handling and aggregated results.
 *
 * @example
 * ```ts
 * import type { DictionaryConfig } from "./dictionaries";
 * import { DictionaryError, handleFetchError } from "./dictionaries";
 *
 * const config: DictionaryConfig = {
 *   id: "etymonline",
 *   name: "Etymonline",
 *   enabled: true,
 *   timeout: 5000,
 * };
 *
 * // Provider implementations will use search function type:
 * import type { DictionarySearchFunction } from "./dictionaries";
 * ```
 */

export type {
  DictionaryProviderType,
  DictionaryConfig,
  DictionaryResult,
  EtymonlineResult,
  EtymonlineResultItem,
  CollinsResult,
  CollinsSection,
  AggregatedDictionaryResult,
  AggregatedDictionaryError,
  DictionarySearchFunction,
} from "./types";

export {
  DictionaryError,
  handleFetchError,
  handleParseError,
  handleTimeout,
  handleNoResult,
} from "./errors";

export type { DictionaryErrorCode } from "./errors";

export { DictionaryAggregator, createDefaultAggregator } from "./aggregator";
