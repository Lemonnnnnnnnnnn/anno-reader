/**
 * Etymonline dictionary provider.
 *
 * Fetches and parses etymologies from https://www.etymonline.com.
 * Uses three parsing strategies to handle different page layouts:
 *   1. Modern entries (React-era, `section.max-w-none` layout)
 *   2. Legacy items (older `[class*="word--"]` layout)
 *   3. Search cards (search results page fallback)
 *
 * NOTE: CORS blocks cross-origin requests from the browser at runtime.
 * The logic is implemented for environments where CORS is relaxed
 * (e.g. Tauri webview, server-side, or a proxy).
 */

import type { DictionaryConfig, EtymonlineResult, EtymonlineResultItem } from "../types";
import { DictionaryError, handleFetchError, handleNoResult, handleParseError } from "../errors";
import { fetchWithTimeout, getHTML, getText, parseHTML } from "../helpers";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOURCE = "etymonline";
const BASE_URL = "https://www.etymonline.com";
const DEFAULT_MAX_RESULTS = 4;
const DEFAULT_TIMEOUT = 10_000;

// ---------------------------------------------------------------------------
// Default Config
// ---------------------------------------------------------------------------

/**
 * Return default configuration for the Etymonline provider.
 */
export function getDefaultConfig(): DictionaryConfig {
  return {
    id: SOURCE,
    name: "Etymonline",
    enabled: true,
    timeout: DEFAULT_TIMEOUT,
    maxResults: DEFAULT_MAX_RESULTS,
  };
}

// ---------------------------------------------------------------------------
// Parsing Strategies
// ---------------------------------------------------------------------------

/**
 * Strategy 1 — Modern entries.
 *
 * Targets the current Etymonline layout built with `section.max-w-none`.
 * Each entry section contains an `<h2>` title and definition text.
 *
 * @returns Parsed items (may be empty if layout doesn't match)
 */
function parseModernEntries(doc: Document, maxResults: number): EtymonlineResultItem[] {
  const sections = doc.querySelectorAll("section.max-w-none");
  const items: EtymonlineResultItem[] = [];

  for (const section of sections) {
    if (items.length >= maxResults) break;

    const title = getText(section, "h2");
    const definition = getHTML(section);

    if (!title || !definition) continue;

    items.push({ etymology: definition });
  }

  return items;
}

/**
 * Strategy 2 — Legacy items.
 *
 * Targets the older Etymonline layout using `[class*="word--"]` containers
 * with BEM-style child selectors for name and definition.
 *
 * NOTE: Etymonline uses the typo "defination" in the actual class name.
 *
 * @returns Parsed items (may be empty if layout doesn't match)
 */
function parseLegacyItems(doc: Document, maxResults: number): EtymonlineResultItem[] {
  const wordElements = doc.querySelectorAll('[class*="word--"]');
  const items: EtymonlineResultItem[] = [];

  for (const wordEl of wordElements) {
    if (items.length >= maxResults) break;

    const title = getText(wordEl, '[class*="word__name--"]');
    const definition = getHTML(wordEl, '[class*="word__defination--"]');

    if (!title || !definition) continue;

    items.push({ etymology: definition });
  }

  return items;
}

/**
 * Strategy 3 — Search cards.
 *
 * Falls back to the search results page (`/search?q=word`).
 * Each result is an `<a>` card with a prose section for the definition.
 *
 * @returns Parsed items (may be empty if no search results)
 */
function parseSearchCards(doc: Document, maxResults: number): EtymonlineResultItem[] {
  const cards = doc.querySelectorAll("a.w-full.group[href]");
  const items: EtymonlineResultItem[] = [];

  for (const card of cards) {
    if (items.length >= maxResults) break;

    const title = getText(card, "[id]");
    const definition = getHTML(card, 'section[class*="prose"]');

    if (!title || !definition) continue;

    items.push({ etymology: definition });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Fetch Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch a URL and return parsed Document.
 * Throws DictionaryError on failure.
 */
async function fetchAndParse(url: string, timeout: number): Promise<Document> {
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

  try {
    return parseHTML(html);
  } catch (err) {
    throw handleParseError(err, SOURCE);
  }
}

/**
 * Run all three parsing strategies against a Document, returning items.
 */
function extractItems(doc: Document, maxResults: number): EtymonlineResultItem[] {
  // Strategy 1: modern entries
  let items = parseModernEntries(doc, maxResults);

  // Strategy 2: legacy items
  if (items.length === 0) {
    items = parseLegacyItems(doc, maxResults);
  }

  return items;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search Etymonline for a word's etymology.
 *
 * Flow:
 * 1. Fetch `https://www.etymonline.com/word/{word}` (direct entry page)
 * 2. Try Strategy 1 (modern) then Strategy 2 (legacy) on the result
 * 3. If no items found, fetch `https://www.etymonline.com/search?q={word}`
 * 4. Try Strategy 3 (search cards) on the search results page
 * 5. If still nothing, throw NOT_FOUND
 *
 * @param word - The word to look up
 * @param config - Provider configuration
 * @returns Etymonline result with parsed items
 * @throws DictionaryError on fetch/parse failure or if word not found
 */
export async function search(
  word: string,
  config: DictionaryConfig,
): Promise<EtymonlineResult> {
  const maxResults = config.maxResults ?? DEFAULT_MAX_RESULTS;
  const timeout = config.timeout ?? DEFAULT_TIMEOUT;
  const encodedWord = encodeURIComponent(word);

  // --- Direct word page ---
  const wordUrl = `${BASE_URL}/word/${encodedWord}`;
  let doc: Document;
  try {
    doc = await fetchAndParse(wordUrl, timeout);
  } catch (err) {
    // If fetch failed, try search page before giving up
    if (err instanceof DictionaryError && err.code === "FETCH_FAILED") {
      return searchFallback(encodedWord, maxResults, timeout, word);
    }
    throw err;
  }

  let items = extractItems(doc, maxResults);

  // --- Search page fallback ---
  if (items.length === 0) {
    return searchFallback(encodedWord, maxResults, timeout, word);
  }

  return {
    source: SOURCE,
    word,
    found: true,
    data: { items },
  };
}

/**
 * Fetch the search results page and parse with Strategy 3.
 */
async function searchFallback(
  encodedWord: string,
  maxResults: number,
  timeout: number,
  word: string,
): Promise<EtymonlineResult> {
  const searchUrl = `${BASE_URL}/search?q=${encodedWord}`;
  let searchDoc: Document;
  try {
    searchDoc = await fetchAndParse(searchUrl, timeout);
  } catch (err) {
    // If search also failed, surface the original fetch error or throw NOT_FOUND
    if (err instanceof DictionaryError) {
      throw err;
    }
    throw handleFetchError(err, SOURCE);
  }

  const items = parseSearchCards(searchDoc, maxResults);

  if (items.length === 0) {
    throw handleNoResult(SOURCE);
  }

  return {
    source: SOURCE,
    word,
    found: true,
    data: { items },
  };
}
