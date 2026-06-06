import type { ContextModule, ContextData } from "./types";
import type { DictionaryAggregator } from "@/lib/dictionaries";

/** Maximum character length for sentence context. */
const MAX_SENTENCE_CONTEXT_CHARS = 500;

/** Maximum character length for dictionary context. */
const MAX_DICTIONARY_CONTEXT_CHARS = 1500;

/**
 * Extract context data based on selected text and available modules.
 * Pure function replacement for the former ContextService class.
 *
 * @param selectedText - The text the user selected
 * @param chapterText - Plain text content of the current chapter (null if unavailable)
 * @param modules - Available context modules
 * @param dictionaryAggregator - Dictionary aggregator instance (null if unavailable)
 * @param offset - Character offset within chapterText for position-based sentence matching
 * @param selectionSentence - The sentence containing the selection (from iframe DOM)
 * @returns Combined context data from all enabled modules
 */
export async function getContext(
  selectedText: string,
  chapterText: string | null,
  modules: ContextModule[],
  dictionaryAggregator: DictionaryAggregator | null,
  offset?: number,
  selectionSentence?: string,
): Promise<ContextData> {
  const enabledModules = modules.filter((m) => m.isEnabled);
  const contextParts: string[] = [];
  const dictionaryParts: string[] = [];

  for (const module of enabledModules) {
    switch (module.type) {
      case "sentence": {
        // Use selection context directly if available (most reliable)
        const sentenceContext = selectionSentence
          ?? extractSentenceContext(selectedText, chapterText, offset);
        contextParts.push(sentenceContext);
        break;
      }
      case "dictionary": {
        const formatted = await queryDictionary(
          selectedText,
          dictionaryAggregator,
          module.providerId,
        );
        if (formatted) {
          dictionaryParts.push(formatted);
        }
        break;
      }
    }
  }

  const dictionaryText =
    dictionaryParts.length > 0 ? dictionaryParts.join("\n\n") : undefined;

  return {
    text: contextParts.join("\n\n"),
    metadata: {
      selectedText,
      moduleCount: enabledModules.length.toString(),
    },
    source: enabledModules.map((m) => m.id).join(","),
    dictionaryText,
  };
}

/**
 * Query dictionary aggregator and return formatted context text.
 */
async function queryDictionary(
  selectedText: string,
  dictionaryAggregator: DictionaryAggregator | null,
  providerId?: string,
): Promise<string | null> {
  if (!dictionaryAggregator) {
    return null;
  }

  try {
    const result = providerId
      ? await dictionaryAggregator.searchSingle(selectedText, providerId)
      : await dictionaryAggregator.search(selectedText);

    const results = providerId ? [result] : result.results;
    if (results.length === 0) {
      return null;
    }

    const formatted = formatDictionaryResults(results);
    if (!formatted) {
      return null;
    }

    // Cap at MAX_DICTIONARY_CONTEXT_CHARS
    return formatted.length > MAX_DICTIONARY_CONTEXT_CHARS
      ? formatted.slice(0, MAX_DICTIONARY_CONTEXT_CHARS)
      : formatted;
  } catch (error) {
    // Graceful degradation: log warning, continue without dictionary context
    console.warn(
      `[getContext] Dictionary lookup failed for "${selectedText}":`,
      error,
    );
    return null;
  }
}

/**
 * Format dictionary results into a readable text for translation context.
 */
function formatDictionaryResults(results: import("@/lib/dictionaries").DictionaryResult[]): string {
  const parts: string[] = [];

  for (const result of results) {
    if (!result.found) continue;

    switch (result.source) {
      case "etymonline": {
        const etymResult = result as import("@/lib/dictionaries").EtymonlineResult;
        const items = etymResult.data.items;
        if (items.length === 0) break;

        const etymParts = items.map((item) => {
          const clean = stripHTML(item.etymology);
          if (item.firstUse) {
            return `${clean} (first use: ${item.firstUse})`;
          }
          return clean;
        });
        parts.push(`[Etymology] ${etymParts.join("; ")}`);
        break;
      }
      case "vocabulary": {
        const vocabResult = result as import("@/lib/dictionaries").VocabularyResult;
        const { short, long } = vocabResult.data;
        const defParts: string[] = [];
        if (short) defParts.push(short);
        if (long) defParts.push(long);
        if (defParts.length === 0) break;
        parts.push(`[Definition] ${defParts.join("; ")}`);
        break;
      }
    }
  }

  return parts.join("\n");
}

/**
 * Strip HTML tags from a string.
 */
function stripHTML(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * Extract surrounding sentences from chapter text.
 * Finds the selectedText within sentences, then returns the containing sentence.
 * Falls back to selectedText when chapterText is null.
 * Caps result at MAX_SENTENCE_CONTEXT_CHARS characters.
 */
function extractSentenceContext(
  selectedText: string,
  chapterText: string | null,
  offset?: number,
): string {
  if (!chapterText) {
    return selectedText;
  }

  // Split chapter text into sentences
  const sentenceRegex = /[^.!?\u3002\uff01\uff1f]+[.!?\u3002\uff01\uff1f]+/g;
  const sentences: string[] = [];
  const sentenceRanges: Array<{ start: number; end: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = sentenceRegex.exec(chapterText)) !== null) {
    sentences.push(match[0].trim());
    sentenceRanges.push({ start: match.index, end: match.index + match[0].length });
  }

  if (sentences.length === 0) {
    return selectedText;
  }

  // Find which sentence contains the selected text
  let selectedIndex = -1;

  if (offset !== undefined) {
    // Use offset to find the sentence that contains this character position
    selectedIndex = sentenceRanges.findIndex(
      (range) => offset >= range.start && offset < range.end,
    );
  }

  // Fallback: find first sentence containing the selected text
  if (selectedIndex === -1) {
    selectedIndex = sentences.findIndex((s) => s.includes(selectedText));
  }

  if (selectedIndex === -1) {
    return selectedText;
  }

  // Get only the current sentence
  const context = sentences[selectedIndex];

  // Cap at MAX_SENTENCE_CONTEXT_CHARS
  if (context.length > MAX_SENTENCE_CONTEXT_CHARS) {
    return context.slice(0, MAX_SENTENCE_CONTEXT_CHARS);
  }

  return context;
}
