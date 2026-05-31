import { describe, it, expect } from "vitest";
import {
  DEFAULT_TRANSLATION_PROMPT,
  BUILTIN_SENTENCE_CONTEXT,
  type ProviderType,
  type AIProvider,
  type ProviderStatus,
  type PromptVariable,
  type AIPrompt,
  type PromptTemplate,
  type ContextType,
  type ContextModule,
  type ContextConfig,
  type ContextData,
  type AIConfig,
} from "../types";

// ---------------------------------------------------------------------------
// Type-level export checks (compile-time only, no runtime cost)
// ---------------------------------------------------------------------------

// If these assignments compile, the types are exported correctly.
// They are unused by design — they exist purely for type checking.
{
  const _providerType: ProviderType = "openai";
  const _provider: AIProvider = {} as AIProvider;
  const _status: ProviderStatus = {} as ProviderStatus;
  const _variable: PromptVariable = {} as PromptVariable;
  const _prompt: AIPrompt = {} as AIPrompt;
  const _template: PromptTemplate = {} as PromptTemplate;
  const _contextType: ContextType = "sentence";
  const _contextModule: ContextModule = {} as ContextModule;
  const _contextConfig: ContextConfig = {} as ContextConfig;
  const _contextData: ContextData = {} as ContextData;
  const _config: AIConfig = {} as AIConfig;

  // Suppress unused warnings — these are compile-time-only checks
  void _providerType;
  void _provider;
  void _status;
  void _variable;
  void _prompt;
  void _template;
  void _contextType;
  void _contextModule;
  void _contextConfig;
  void _contextData;
  void _config;
}

// ---------------------------------------------------------------------------
// DEFAULT_TRANSLATION_PROMPT
// ---------------------------------------------------------------------------

describe("DEFAULT_TRANSLATION_PROMPT", () => {
  it("has the correct id and name", () => {
    expect(DEFAULT_TRANSLATION_PROMPT.id).toBe("default-translation");
    expect(DEFAULT_TRANSLATION_PROMPT.name).toBe("Translation");
  });

  it("has category 'translation'", () => {
    expect(DEFAULT_TRANSLATION_PROMPT.category).toBe("translation");
  });

  it("contains required variable placeholders in content", () => {
    const { content } = DEFAULT_TRANSLATION_PROMPT;
    expect(content).toContain("{selectedText}");
    expect(content).toContain("{targetLanguage}");
  });

  it("defines exactly two variables", () => {
    expect(DEFAULT_TRANSLATION_PROMPT.variables).toHaveLength(2);
  });

  it("has 'selectedText' as a required variable with empty default", () => {
    const v = DEFAULT_TRANSLATION_PROMPT.variables.find(
      (x) => x.name === "selectedText",
    );
    expect(v).toBeDefined();
    expect(v!.isRequired).toBe(true);
    expect(v!.defaultValue).toBe("");
    expect(v!.description).toBe("The text selected by the user");
  });

  it("has 'targetLanguage' as a required variable defaulting to Chinese", () => {
    const v = DEFAULT_TRANSLATION_PROMPT.variables.find(
      (x) => x.name === "targetLanguage",
    );
    expect(v).toBeDefined();
    expect(v!.isRequired).toBe(true);
    expect(v!.defaultValue).toBe("Chinese");
  });

  it("matches the PromptTemplate shape at runtime", () => {
    const t = DEFAULT_TRANSLATION_PROMPT;
    expect(typeof t.id).toBe("string");
    expect(typeof t.name).toBe("string");
    expect(typeof t.content).toBe("string");
    expect(Array.isArray(t.variables)).toBe(true);
    expect(typeof t.category).toBe("string");

    for (const v of t.variables) {
      expect(typeof v.name).toBe("string");
      expect(typeof v.description).toBe("string");
      expect(typeof v.defaultValue).toBe("string");
      expect(typeof v.isRequired).toBe("boolean");
    }
  });
});

// ---------------------------------------------------------------------------
// BUILTIN_SENTENCE_CONTEXT
// ---------------------------------------------------------------------------

describe("BUILTIN_SENTENCE_CONTEXT", () => {
  it("has the correct id", () => {
    expect(BUILTIN_SENTENCE_CONTEXT.id).toBe("builtin-sentence");
  });

  it("has the correct name", () => {
    expect(BUILTIN_SENTENCE_CONTEXT.name).toBe("Sentence Context");
  });

  it("has type 'sentence'", () => {
    expect(BUILTIN_SENTENCE_CONTEXT.type).toBe("sentence");
  });

  it("is enabled by default", () => {
    expect(BUILTIN_SENTENCE_CONTEXT.isEnabled).toBe(true);
  });

  it("has non-empty content description", () => {
    expect(BUILTIN_SENTENCE_CONTEXT.content.length).toBeGreaterThan(0);
  });

  it("matches the ContextModule shape at runtime", () => {
    const m = BUILTIN_SENTENCE_CONTEXT;
    expect(typeof m.id).toBe("string");
    expect(typeof m.name).toBe("string");
    expect(["sentence", "custom"]).toContain(m.type);
    expect(typeof m.content).toBe("string");
    expect(typeof m.isEnabled).toBe("boolean");
  });
});

// ---------------------------------------------------------------------------
// ProviderType literal check
// ---------------------------------------------------------------------------

describe("ProviderType", () => {
  it("only allows 'openai' as a value", () => {
    // Runtime compile-time-only: assigning non-"openai" would fail TS.
    const valid: ProviderType = "openai";
    expect(valid).toBe("openai");
  });
});

// ---------------------------------------------------------------------------
// ContextType literal check
// ---------------------------------------------------------------------------

describe("ContextType", () => {
  it("allows 'sentence' and 'custom'", () => {
    const types: ContextType[] = ["sentence", "custom"];
    expect(types).toHaveLength(2);
    expect(types).toContain("sentence");
    expect(types).toContain("custom");
  });
});
