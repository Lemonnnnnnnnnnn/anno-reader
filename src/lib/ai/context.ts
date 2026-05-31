import type { ContextModule, ContextData } from "./types";

/**
 * Service for extracting context to improve translation quality.
 * Uses the selected text itself as context (sentence-level).
 */
export class ContextService {
  /**
   * Get context data based on selected text and available modules.
   *
   * @param selectedText - The text the user selected
   * @param modules - Available context modules
   * @returns Combined context data from all enabled modules
   */
  getContext(
    selectedText: string,
    modules: ContextModule[],
  ): ContextData {
    const enabledModules = modules.filter((m) => m.isEnabled);
    const contextParts: string[] = [];

    for (const module of enabledModules) {
      switch (module.type) {
        case "sentence":
          contextParts.push(selectedText);
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
}
