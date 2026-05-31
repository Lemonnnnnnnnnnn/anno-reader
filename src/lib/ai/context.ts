import type { ContextModule, ContextData } from "./types";

/** Maximum character length for sentence context. */
const MAX_SENTENCE_CONTEXT_CHARS = 500;

/**
 * Service for extracting context to improve translation quality.
 * Extracts surrounding sentences from chapter text for richer context.
 */
export class ContextService {
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
        case "dictionary":
          // Placeholder: dictionary query will be integrated in Task 17
          break;
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
