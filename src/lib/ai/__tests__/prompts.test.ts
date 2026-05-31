import { describe, it, expect, beforeEach } from "vitest";
import { PromptService } from "../prompts";
import { DEFAULT_TRANSLATION_PROMPT } from "../types";
import type { AIPrompt, PromptVariable } from "../types";

describe("PromptService", () => {
  let service: PromptService;

  beforeEach(() => {
    service = new PromptService();
  });

  // ---------------------------------------------------------------------------
  // renderPrompt
  // ---------------------------------------------------------------------------

  describe("renderPrompt", () => {
    it("replaces all variables correctly", () => {
      const template = "Translate {selectedText} to {targetLanguage}.";
      const variables: PromptVariable[] = [
        { name: "selectedText", description: "", defaultValue: "", isRequired: true },
        { name: "targetLanguage", description: "", defaultValue: "", isRequired: true },
      ];
      const values = { selectedText: "Hello world", targetLanguage: "French" };

      const result = service.renderPrompt(template, variables, values);

      expect(result).toBe("Translate Hello world to French.");
    });

    it("uses default values when not provided", () => {
      const template = "Translate {selectedText} to {targetLanguage}.";
      const variables: PromptVariable[] = [
        { name: "selectedText", description: "", defaultValue: "default text", isRequired: true },
        { name: "targetLanguage", description: "", defaultValue: "Chinese", isRequired: true },
      ];
      const values = { selectedText: "Hello" };

      const result = service.renderPrompt(template, variables, values);

      expect(result).toBe("Translate Hello to Chinese.");
    });

    it("handles missing optional variables by using default", () => {
      const template = "Context: {context}. Text: {selectedText}.";
      const variables: PromptVariable[] = [
        { name: "context", description: "", defaultValue: "no context", isRequired: false },
        { name: "selectedText", description: "", defaultValue: "", isRequired: true },
      ];
      const values = { selectedText: "Hello" };

      const result = service.renderPrompt(template, variables, values);

      expect(result).toBe("Context: no context. Text: Hello.");
    });

    it("handles template with no variables", () => {
      const template = "Just a plain string with no placeholders.";
      const variables: PromptVariable[] = [];
      const values = {};

      const result = service.renderPrompt(template, variables, values);

      expect(result).toBe("Just a plain string with no placeholders.");
    });
  });

  // ---------------------------------------------------------------------------
  // getDefaultTranslationPrompt
  // ---------------------------------------------------------------------------

  describe("getDefaultTranslationPrompt", () => {
    it("returns the default translation prompt", () => {
      const result = service.getDefaultTranslationPrompt();

      expect(result).toBe(DEFAULT_TRANSLATION_PROMPT);
      expect(result.id).toBe("default-translation");
      expect(result.category).toBe("translation");
    });
  });

  // ---------------------------------------------------------------------------
  // getPrompt
  // ---------------------------------------------------------------------------

  describe("getPrompt", () => {
    const prompts: AIPrompt[] = [
      {
        id: "prompt-1",
        name: "Translation",
        content: "Translate {text}",
        variables: [],
        isDefault: true,
        isEnabled: true,
      },
      {
        id: "prompt-2",
        name: "Summary",
        content: "Summarize {text}",
        variables: [],
        isDefault: false,
        isEnabled: true,
      },
    ];

    it("finds prompt by ID", () => {
      const result = service.getPrompt(prompts, "prompt-2");

      expect(result).toBeDefined();
      expect(result?.name).toBe("Summary");
    });

    it("returns undefined for unknown ID", () => {
      const result = service.getPrompt(prompts, "nonexistent");

      expect(result).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // getDefaultPrompt
  // ---------------------------------------------------------------------------

  describe("getDefaultPrompt", () => {
    it("finds the default prompt", () => {
      const prompts: AIPrompt[] = [
        {
          id: "p1",
          name: "A",
          content: "",
          variables: [],
          isDefault: false,
          isEnabled: true,
        },
        {
          id: "p2",
          name: "B",
          content: "",
          variables: [],
          isDefault: true,
          isEnabled: true,
        },
      ];

      const result = service.getDefaultPrompt(prompts);

      expect(result).toBeDefined();
      expect(result?.id).toBe("p2");
    });

    it("returns undefined if no default", () => {
      const prompts: AIPrompt[] = [
        {
          id: "p1",
          name: "A",
          content: "",
          variables: [],
          isDefault: false,
          isEnabled: true,
        },
      ];

      const result = service.getDefaultPrompt(prompts);

      expect(result).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // validateVariables
  // ---------------------------------------------------------------------------

  describe("validateVariables", () => {
    const variables: PromptVariable[] = [
      { name: "selectedText", description: "", defaultValue: "", isRequired: true },
      { name: "context", description: "", defaultValue: "fallback", isRequired: false },
      { name: "targetLanguage", description: "", defaultValue: "Chinese", isRequired: true },
    ];

    it("returns valid when all required vars are provided", () => {
      const values = { selectedText: "Hello", targetLanguage: "French" };

      const result = service.validateVariables(variables, values);

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it("returns missing for absent required vars", () => {
      const values = { targetLanguage: "French" };

      const result = service.validateVariables(variables, values);

      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(["selectedText"]);
    });

    it("returns valid when defaults fill required vars", () => {
      const values = { selectedText: "Hello" };
      // targetLanguage has defaultValue "Chinese" so it's covered

      const result = service.validateVariables(variables, values);

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });
  });
});
