import type { ContextModule, ContextData } from "./types";
import type { DictionaryAggregator } from "@/lib/dictionaries";
import type {
  DictionaryResult,
  EtymonlineResult,
  VocabularyResult,
  AggregatedDictionaryResult,
} from "@/lib/dictionaries";

/** Maximum character length for sentence context. */
const MAX_SENTENCE_CONTEXT_CHARS = 500;

/** Maximum character length for dictionary context. */
const MAX_DICTIONARY_CONTEXT_CHARS = 1500;

/**
 * Service for extracting context to improve translation quality.
 * Extracts surrounding sentences from chapter text for richer context.
 */
export class ContextService {
  private dictionaryAggregator: DictionaryAggregator | null;

  constructor(dictionaryAggregator?: DictionaryAggregator) {
    this.dictionaryAggregator = dictionaryAggregator ?? null;
  }

  /**
   * Get context data based on selected text and available modules.
   *
   * @param selectedText - The text the user selected
   * @param chapterText - Plain text content of the current chapter (null if unavailable)
   * @param modules - Available context modules
   * @param includeDebug - Whether to include debug information (for preview)
   * @param offset - Character offset within chapterText for position-based sentence matching
   * @returns Combined context data from all enabled modules
   */
  async getContext(
    selectedText: string,
    chapterText: string | null,
    modules: ContextModule[],
    includeDebug = false,
    offset?: number,
  ): Promise<ContextData> {
    const enabledModules = modules.filter((m) => m.isEnabled);
    const contextParts: string[] = [];
    const dictionaryParts: string[] = [];
    const debug: ContextData["debug"] = includeDebug ? {} : undefined;

    for (const module of enabledModules) {
      switch (module.type) {
        case "sentence": {
          const sentenceContext = this.extractSentenceContext(
            selectedText,
            chapterText,
            offset,
          );
          if (includeDebug && debug) {
            debug.sentenceContext = sentenceContext;
          }
          contextParts.push(sentenceContext);
          break;
        }
        case "dictionary": {
          const result = await this.queryDictionaryWithDebug(
            selectedText,
            module.providerId,
          );
          if (result.formatted) {
            dictionaryParts.push(result.formatted);
          }
          if (includeDebug && debug && result.raw) {
            // Merge dictionary debug info if multiple dictionary modules
            if (debug.dictionary) {
              debug.dictionary.results.push(...result.raw.results);
              debug.dictionary.errors.push(...result.raw.errors);
              debug.dictionary.duration = Math.max(
                debug.dictionary.duration,
                result.raw.duration,
              );
            } else {
              debug.dictionary = {
                results: result.raw.results,
                errors: result.raw.errors,
                duration: result.raw.duration,
              };
            }
          }
          break;
        }
        case "custom":
          contextParts.push(module.content);
          break;
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
      debug,
    };
  }

  /**
   * Query dictionary aggregator with debug information.
   * Returns both raw result and formatted context.
   *
   * @param selectedText - The text to look up
   * @param providerId - Optional specific provider ID to query
   * @returns Object with formatted text and raw dictionary result
   */
  private async queryDictionaryWithDebug(
    selectedText: string,
    providerId?: string,
  ): Promise<{
    formatted: string | null;
    raw: AggregatedDictionaryResult | null;
  }> {
    if (!this.dictionaryAggregator) {
      return { formatted: null, raw: null };
    }

    try {
      // Query specific provider or all providers
      let result: AggregatedDictionaryResult;
      if (providerId) {
        const singleResult = await this.dictionaryAggregator.searchSingle(
          selectedText,
          providerId,
        );
        result = {
          word: selectedText,
          results: [singleResult],
          successCount: singleResult.found ? 1 : 0,
          errors: [],
          duration: 0,
        };
      } else {
        result = await this.dictionaryAggregator.search(selectedText);
      }

      if (result.results.length === 0) {
        return { formatted: null, raw: result };
      }

      const formatted = this.formatDictionaryResults(result.results);
      if (!formatted) {
        return { formatted: null, raw: result };
      }

      // Cap at MAX_DICTIONARY_CONTEXT_CHARS
      const capped =
        formatted.length > MAX_DICTIONARY_CONTEXT_CHARS
          ? formatted.slice(0, MAX_DICTIONARY_CONTEXT_CHARS)
          : formatted;

      return { formatted: capped, raw: result };
    } catch (error) {
      // Graceful degradation: log warning, continue without dictionary context
      console.warn(
        `[ContextService] Dictionary lookup failed for "${selectedText}":`,
        error,
      );
      return { formatted: null, raw: null };
    }
  }

  /**
   * Format dictionary results into a readable text for translation context.
   */
  private formatDictionaryResults(results: DictionaryResult[]): string {
    const parts: string[] = [];

    for (const result of results) {
      if (!result.found) continue;

      switch (result.source) {
        case "etymonline": {
          const etymResult = result as EtymonlineResult;
          const items = etymResult.data.items;
          if (items.length === 0) break;

          const etymParts = items.map((item) => {
            const clean = this.stripHTML(item.etymology);
            if (item.firstUse) {
              return `${clean} (first use: ${item.firstUse})`;
            }
            return clean;
          });
          parts.push(`[Etymology] ${etymParts.join("; ")}`);
          break;
        }
        case "vocabulary": {
          const vocabResult = result as VocabularyResult;
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
  private stripHTML(html: string): string {
    return html.replace(/<[^>]*>/g, "").trim();
  }

  /**
   * Extract surrounding sentences from chapter text.
   * Finds the selectedText within sentences, then returns 1 sentence before + after.
   * Falls back to selectedText when chapterText is null.
   * Caps result at MAX_SENTENCE_CONTEXT_CHARS characters.
   *
   * @param selectedText - The text the user selected
   * @param chapterText - Plain text content of the current chapter (null if unavailable)
   * @param offset - Character offset within chapterText for position-based sentence matching
   */
  private extractSentenceContext(
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
}
