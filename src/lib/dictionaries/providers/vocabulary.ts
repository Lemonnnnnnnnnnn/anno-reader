/**
 * Vocabulary.com dictionary provider.
 *
 * Fetches and parses definitions from https://www.vocabulary.com/dictionary/{word}.
 * Extracts two fields following the Saladict pattern:
 *   - `.short` — quick/short definition
 *   - `.long`  — extended definition
 *
 * NOTE: CORS blocks cross-origin requests from the browser at runtime.
 * The logic is implemented for environments where CORS is relaxed
 * (e.g. Tauri webview, server-side, or a proxy).
 */

import type { DictionaryConfig, VocabularyResult } from "../types";
import { handleFetchError, handleNoResult } from "../errors";
import { fetchWithTimeout, getText, parseHTML } from "../helpers";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOURCE = "vocabulary";
const BASE_URL = "https://www.vocabulary.com/dictionary";
const DEFAULT_TIMEOUT = 10_000;

// ---------------------------------------------------------------------------
// Default Config
// ---------------------------------------------------------------------------

/**
 * Return default configuration for the Vocabulary.com provider.
 */
export function getDefaultConfig(): DictionaryConfig {
  return {
    id: SOURCE,
    name: "Vocabulary.com",
    enabled: true,
    timeout: DEFAULT_TIMEOUT,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search Vocabulary.com for a word's definition.
 *
 * Flow:
 * 1. Fetch `https://www.vocabulary.com/dictionary/{word}`
 * 2. Extract `.short` and `.long` text content
 * 3. Throw NOT_FOUND if `.short` is empty
 * 4. Return result with `.long` gracefully degraded to empty string if absent
 *
 * @param word - The word to look up
 * @param config - Provider configuration
 * @returns Vocabulary.com result with short and long definitions
 * @throws DictionaryError on fetch/parse failure or if word not found
 */
export async function search(
  word: string,
  config: DictionaryConfig,
): Promise<VocabularyResult> {
  const timeout = config.timeout ?? DEFAULT_TIMEOUT;
  const normalizedWord = word.replace(/\s+/g, " ");
  const url = `${BASE_URL}/${encodeURIComponent(normalizedWord)}`;

  let response: Response;
  try {
    response = await fetchWithTimeout(url, { timeout });
  } catch (err) {
    throw handleFetchError(err, SOURCE);
  }

  if (!response.ok) {
    throw handleFetchError(
      new Error(`HTTP ${response.status} ${response.statusText}`),
      SOURCE,
    );
  }

  let html: string;
  try {
    html = await response.text();
  } catch (err) {
    throw handleFetchError(err, SOURCE);
  }

  const doc = parseHTML(html);

  const shortDef = getText(doc, ".short");
  const longDef = getText(doc, ".long");

  if (!shortDef) {
    throw handleNoResult(SOURCE);
  }

  return {
    source: SOURCE,
    word,
    found: true,
    data: {
      short: shortDef,
      long: longDef,
    },
  };
}
