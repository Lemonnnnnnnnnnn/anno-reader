import type { ContextModule, ContextData } from "./types";
import type { DictionaryAggregator } from "@/lib/dictionaries";
import type {
  DictionaryResult,
  EtymonlineResult,
  CollinsResult,
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
   * @returns Combined context data from all enabled modules
   */
  async getContext(
    selectedText: string,
    chapterText: string | null,
    modules: ContextModule[],
  ): Promise<ContextData> {
    const enabledModules = modules.filter((m) => m.isEnabled);
    const contextParts: string[] = [];

    for (const module of enabledModules) {
      switch (module.type) {
        case "sentence": {
          const sentenceContext = this.extractSentenceContext(
            selectedText,
            chapterText,
          );
          contextParts.push(sentenceContext);
          break;
        }
        case "dictionary": {
          const dictionaryContext = await this.queryDictionary(selectedText);
          if (dictionaryContext) {
            contextParts.push(dictionaryContext);
          }
          break;
        }
        case "custom":
          contextParts.push(module.content);
          break;
      }
    }

    return {
      text: contextParts.join("\n\n"),
      metadata: {
        selectedText,
        moduleCount: enabledModules.length.toString(),
      },
      source: enabledModules.map((m) => m.id).join(","),
    };
  }

  /**
   * Query dictionary aggregator for the selected text.
   * Returns formatted dictionary context, or null if no aggregator
   * configured or all queries fail.
   *
   * @param selectedText - The text to look up
   * @returns Formatted dictionary context string, or null
   */
  private async queryDictionary(selectedText: string): Promise<string | null> {
    if (!this.dictionaryAggregator) {
      return null;
    }

    try {
      const result = await this.dictionaryAggregator.search(selectedText);

      if (result.results.length === 0) {
        return null;
      }

      const formatted = this.formatDictionaryResults(result.results);
      if (!formatted) {
        return null;
      }

      // Cap at MAX_DICTIONARY_CONTEXT_CHARS
      if (formatted.length > MAX_DICTIONARY_CONTEXT_CHARS) {
        return formatted.slice(0, MAX_DICTIONARY_CONTEXT_CHARS);
      }

      return formatted;
    } catch (error) {
      // Graceful degradation: log warning, continue without dictionary context
      console.warn(
        `[ContextService] Dictionary lookup failed for "${selectedText}":`,
        error,
      );
      return null;
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
        case "collins": {
          const collinsResult = result as CollinsResult;
          const sections = collinsResult.data.sections;
          if (sections.length === 0) break;

          const defParts = sections.map((s) => {
            let text = s.definition;
            if (s.partOfSpeech) {
              text = `(${s.partOfSpeech}) ${text}`;
            }
            if (s.example) {
              text += ` — e.g. "${s.example}"`;
            }
            return text;
          });
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
   */
  private extractSentenceContext(
    selectedText: string,
    chapterText: string | null,
  ): string {
    if (!chapterText) {
      return selectedText;
    }

    // Split chapter text into sentences
    const sentenceRegex = /[^.!?\u3002\uff01\uff1f]+[.!?\u3002\uff01\uff1f]+/g;
    const sentences: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = sentenceRegex.exec(chapterText)) !== null) {
      sentences.push(match[0].trim());
    }

    if (sentences.length === 0) {
      return selectedText;
    }

    // Find which sentence contains the selected text
    const selectedIndex = sentences.findIndex((s) =>
      s.includes(selectedText),
    );

    if (selectedIndex === -1) {
      return selectedText;
    }

    // Get 1 sentence before and 1 sentence after
    const start = Math.max(0, selectedIndex - 1);
    const end = Math.min(sentences.length - 1, selectedIndex + 1);
    const context = sentences.slice(start, end + 1).join(" ");

    // Cap at MAX_SENTENCE_CONTEXT_CHARS
    if (context.length > MAX_SENTENCE_CONTEXT_CHARS) {
      return context.slice(0, MAX_SENTENCE_CONTEXT_CHARS);
    }

    return context;
  }
}
