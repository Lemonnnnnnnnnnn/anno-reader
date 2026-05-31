import type { ContextModule, ContextData } from "./types";

/**
 * Service for extracting context to improve translation quality.
 * Currently supports paragraph context extraction.
 */
export class ContextService {
  /**
   * Get context data based on selected text and available modules.
   *
   * @param selectedText - The text the user selected
   * @param fullText - The full text of the chapter/content
   * @param modules - Available context modules
   * @returns Combined context data from all enabled modules
   */
  getContext(
    selectedText: string,
    fullText: string,
    modules: ContextModule[],
  ): ContextData {
    const enabledModules = modules.filter((m) => m.isEnabled);
    const contextParts: string[] = [];

    for (const module of enabledModules) {
      switch (module.type) {
        case "paragraph":
          contextParts.push(
            this.extractParagraphContext(selectedText, fullText),
          );
          break;
        case "chapter":
          contextParts.push(fullText);
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
   * Extract the paragraph surrounding the selected text.
   * Finds the paragraph boundaries (newlines or sentence endings)
   * around the selection.
   */
  private extractParagraphContext(
    selectedText: string,
    fullText: string,
  ): string {
    if (!selectedText || !fullText) return "";

    const index = fullText.indexOf(selectedText);
    if (index === -1) return selectedText;

    // Find paragraph start (look for double newline or start of text)
    let paraStart = index;
    while (paraStart > 0) {
      if (
        fullText[paraStart - 1] === "\n" &&
        fullText[paraStart - 2] === "\n"
      )
        break;
      if (fullText[paraStart - 1] === "\n") {
        // Single newline - check if it's a paragraph break
        if (
          paraStart - 2 >= 0 &&
          (fullText[paraStart - 2] === "." ||
            fullText[paraStart - 2] === "!" ||
            fullText[paraStart - 2] === "?")
        ) {
          break;
        }
      }
      paraStart--;
    }

    // Find paragraph end
    let paraEnd = index + selectedText.length;
    while (paraEnd < fullText.length) {
      if (fullText[paraEnd] === "\n" && fullText[paraEnd + 1] === "\n") {
        paraEnd += 2;
        break;
      }
      if (fullText[paraEnd] === "\n" && paraEnd + 1 < fullText.length) {
        if (
          paraEnd + 2 < fullText.length &&
          (fullText[paraEnd + 2] === "." ||
            fullText[paraEnd + 2] === "!" ||
            fullText[paraEnd + 2] === "?")
        ) {
          paraEnd += 1;
          break;
        }
      }
      paraEnd++;
    }

    return fullText.slice(paraStart, paraEnd).trim();
  }
}
