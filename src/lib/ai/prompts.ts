import type { AIPrompt, PromptVariable } from "./types";

/**
 * Service for managing and rendering AI prompt templates.
 */
export class PromptService {
  /**
   * Render a prompt template by replacing {variable} placeholders.
   *
   * @param template - The prompt template content
   * @param variables - Variable definitions with defaults
   * @param values - Actual values to substitute
   * @returns Rendered prompt string
   */
  renderPrompt(
    template: string,
    variables: PromptVariable[],
    values: Record<string, string>,
  ): string {
    let rendered = template;

    for (const variable of variables) {
      const value = values[variable.name] ?? variable.defaultValue;
      const placeholder = `{${variable.name}}`;
      rendered = rendered.replaceAll(placeholder, value);
    }

    return rendered;
  }

  /**
   * Get a prompt by ID from a list of prompts.
   */
  getPrompt(prompts: AIPrompt[], promptId: string): AIPrompt | undefined {
    return prompts.find((p) => p.id === promptId);
  }

  /**
   * Get the default prompt from a list of prompts.
   */
  getDefaultPrompt(prompts: AIPrompt[]): AIPrompt | undefined {
    return prompts.find((p) => p.isDefault);
  }

  /**
   * Validate that all required variables have values.
   */
  validateVariables(
    variables: PromptVariable[],
    values: Record<string, string>,
  ): { valid: boolean; missing: string[] } {
    const missing: string[] = [];

    for (const variable of variables) {
      if (variable.isRequired) {
        const value = values[variable.name] ?? variable.defaultValue;
        if (!value) {
          missing.push(variable.name);
        }
      }
    }

    return { valid: missing.length === 0, missing };
  }
}
