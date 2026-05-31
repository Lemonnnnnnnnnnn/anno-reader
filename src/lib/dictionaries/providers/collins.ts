/**
 * Collins COBUILD dictionary provider.
 *
 * Fetches and parses Collins dictionary pages using native DOMParser.
 * Implements a dual-source strategy with fallback between English
 * and Chinese-English versions of the site.
 *
 * **Known limitation**: Collins uses Cloudflare protection which may
 * return 403 responses in browser contexts. CORS also blocks direct
 * fetches from web origins. These are documented limitations — the
 * provider logic is correct but may fail at runtime depending on
 * the execution environment.
 */

import {
  fetchWithTimeout,
  parseHTML,
  getText,
  getHTML,
} from "../helpers";
import {
  DictionaryError,
  handleFetchError,
  handleNoResult,
} from "../errors";
import type {
  DictionaryConfig,
  CollinsResult,
  CollinsSection,
} from "../types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOURCE_NAME = "collins";
const BASE_URL = "https://www.collinsdictionary.com";

/** Sections to skip during parsing */
const SKIP_TYPES = new Set(["Video", "Trends", "英语词汇表", "趋势"]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search Collins COBUILD for a word.
 *
 * Uses a dual-source strategy:
 * 1. Primary: English-only page (`/dictionary/english/{word}`)
 * 2. Fallback: Chinese-English page (`/zh/dictionary/english/{word}`)
 *
 * If `config.options.cibaFirst` is true, the order is reversed
 * (Chinese-English page is tried first).
 *
 * @param word - The word to look up
 * @param config - Provider configuration
 * @returns CollinsResult with parsed sections
 * @throws DictionaryError on fetch/parse failure or if word not found
 */
export async function search(
  word: string,
  config: DictionaryConfig,
): Promise<CollinsResult> {
  const encodedWord = encodeURIComponent(word.trim().replace(/\s+/g, "-"));
  const cibaFirst = (config.options?.cibaFirst as boolean) ?? false;

  // Build source URLs — dual-source strategy with optional order reversal
  const sources: string[] = [
    `${BASE_URL}/dictionary/english/${encodedWord}`,
    `${BASE_URL}/zh/dictionary/english/${encodedWord}`,
  ];
  if (cibaFirst) {
    sources.reverse();
  }

  // Try each source in order; collect last error for reporting
  let lastError: unknown;

  for (const url of sources) {
    try {
      const html = await fetchPage(url, config);
      const doc = parseHTML(html);
      const data = parseCollinsPage(doc, word);

      return {
        source: SOURCE_NAME,
        word,
        found: true,
        data,
      };
    } catch (error) {
      lastError = error;
      // If this is already a DictionaryError from parseCollinsPage (NOT_FOUND),
      // don't try the other source — the word genuinely doesn't exist.
      if (error instanceof DictionaryError && error.code === "NOT_FOUND") {
        throw error;
      }
      // Otherwise, try the next source
    }
  }

  // All sources exhausted — surface the most relevant error
  if (lastError instanceof DictionaryError) {
    throw lastError;
  }
  throw handleFetchError(lastError, SOURCE_NAME);
}

/**
 * Default configuration for the Collins COBUILD provider.
 */
export function getDefaultConfig(): DictionaryConfig {
  return {
    id: SOURCE_NAME,
    name: "Collins COBUILD",
    enabled: true,
    timeout: 10_000,
    options: {
      /** When true, prefer the Chinese-English bilingual page first */
      cibaFirst: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

/**
 * Fetch a Collins dictionary page as raw HTML.
 *
 * @throws DictionaryError on non-2xx responses (403 → FETCH_FAILED)
 */
async function fetchPage(
  url: string,
  config: DictionaryConfig,
): Promise<string> {
  let response: Response;
  try {
    response = await fetchWithTimeout(url, {
      timeout: config.timeout,
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Referer: BASE_URL,
      },
    });
  } catch (error) {
    throw handleFetchError(error, SOURCE_NAME);
  }

  if (!response.ok) {
    throw new DictionaryError(
      "FETCH_FAILED",
      `Collins returned HTTP ${response.status} for ${url}` +
        (response.status === 403
          ? " (likely Cloudflare protection)"
          : ""),
      SOURCE_NAME,
      response.status === 403, // 403 is retryable (might clear later)
    );
  }

  return response.text();
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

/**
 * Parse a Collins dictionary page into structured data.
 *
 * Uses `[data-type-block]` as the primary selector for content sections.
 * Extracts definitions, examples, register labels, pronunciation, and
 * part-of-speech from each section.
 *
 * @throws DictionaryError (NOT_FOUND) if no definition sections are found
 */
function parseCollinsPage(doc: Document, _word: string): CollinsResult["data"] {
  const sections: CollinsSection[] = [];
  let pronunciation: string | undefined;
  let partOfSpeech: string | undefined;

  const sectionElements = doc.querySelectorAll("[data-type-block]");

  for (const sectionEl of Array.from(sectionElements)) {
    const type = sectionEl.getAttribute("data-type-block") || "";

    // Skip non-content sections (Video, Trends, vocabulary lists)
    if (!type || SKIP_TYPES.has(type)) {
      continue;
    }

    // Extract pronunciation from first section that has it
    if (!pronunciation) {
      pronunciation = extractPronunciation(sectionEl) || undefined;
    }

    // Extract part-of-speech from first section that has it
    if (!partOfSpeech) {
      partOfSpeech = extractPartOfSpeech(sectionEl) || undefined;
    }

    // Extract audio URLs (used internally; not in CollinsSection type)
    // const _audio = extractAudio(sectionEl);

    // Extract individual definition blocks within this section
    const definitionBlocks = sectionEl.querySelectorAll(".sense, .gramGrp");
    let hasDefinitions = false;

    for (const senseEl of Array.from(definitionBlocks)) {
      const definition = getText(senseEl, ".def");

      // Skip blocks that have no definition text (e.g. bare gramGrp)
      if (!definition) continue;
      hasDefinitions = true;

      // Register label: "formal", "informal", "literary", etc.
      const register = getText(senseEl, ".labels .usage-label", (t) =>
        t.replace(/[()]/g, "").trim(),
      ) || undefined;

      // Example sentence
      const example = getText(senseEl, ".examples .cit .quote") || undefined;

      sections.push({
        partOfSpeech: partOfSpeech ?? "",
        definition,
        ...(example !== undefined && { example }),
        ...(register !== undefined && { register }),
      });
    }

    // Fallback: if no .sense blocks, try extracting from the section content
    if (!hasDefinitions) {
      const contentEl = sectionEl.querySelector(".content");
      if (contentEl) {
        // Use getHTML to get safe inner content
        const contentHTML = getHTML(contentEl);
        if (contentHTML.trim()) {
          // Strip pronunciation and POS elements from the fallback content
          const cleaned = contentHTML
            .replace(/<span class="pron"[^>]*>[\s\S]*?<\/span>/gi, "")
            .replace(/<span class="pos"[^>]*>[\s\S]*?<\/span>/gi, "")
            .trim();

          if (cleaned) {
            sections.push({
              partOfSpeech: partOfSpeech ?? "",
              definition: cleaned,
            });
          }
        }
      }
    }
  }

  if (sections.length === 0) {
    throw handleNoResult(SOURCE_NAME);
  }

  return { sections };
}

// ---------------------------------------------------------------------------
// Extraction Helpers
// ---------------------------------------------------------------------------

/**
 * Extract pronunciation text from a section element.
 * Looks for `.pron` elements within the section.
 */
function extractPronunciation(sectionEl: Element): string {
  return getText(sectionEl, ".pron", (t) => t.replace(/[/\[\]]/g, "").trim());
}

/**
 * Extract part-of-speech label from a section element.
 * Looks for `.pos` elements (e.g. "noun", "verb", "adjective").
 */
function extractPartOfSpeech(sectionEl: Element): string {
  return getText(sectionEl, ".pos");
}

/**
 * Extract audio URL from a section element.
 *
 * Audio type is inferred from the section's `data-type-block`:
 * - "American" → US pronunciation
 * - Everything else (Learner, English) → UK pronunciation
 *
 * Exported for future use when CollinsSection type gains audio support.
 */
export function extractAudio(
  sectionEl: Element,
): { uk?: string; us?: string } | undefined {
  const audioBtn = sectionEl.querySelector(".pron .audio_play_button");
  if (!audioBtn) return undefined;

  const src = audioBtn.getAttribute("data-src-mp3");
  if (!src) return undefined;

  const type = sectionEl.getAttribute("data-type-block") || "";
  if (type === "American") {
    return { us: src };
  }
  return { uk: src };
}
