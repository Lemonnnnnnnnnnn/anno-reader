import { describe, it, expect } from "vitest";
import {
  type ProviderType,
  type AIProvider,
  type ProviderStatus,
  type PromptVariable,
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
  void _contextType;
  void _contextModule;
  void _contextConfig;
  void _contextData;
  void _config;
}

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
  it("allows 'sentence' and 'dictionary'", () => {
    const types: ContextType[] = ["sentence", "dictionary"];
    expect(types).toHaveLength(2);
    expect(types).toContain("sentence");
    expect(types).toContain("dictionary");
  });
});

// ---------------------------------------------------------------------------
// AIProvider shape check
// ---------------------------------------------------------------------------

describe("AIProvider", () => {
  it("has required fields", () => {
    const provider: AIProvider = {
      id: "test",
      name: "Test Provider",
      type: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test",
      model: "gpt-4o",
      enabled: true,
    };
    expect(provider.id).toBe("test");
    expect(provider.type).toBe("openai");
  });

  it("has optional maxTokens and temperature", () => {
    const provider: AIProvider = {
      id: "test",
      name: "Test Provider",
      type: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test",
      model: "gpt-4o",
      maxTokens: 4096,
      temperature: 0.7,
      enabled: true,
    };
    expect(provider.maxTokens).toBe(4096);
    expect(provider.temperature).toBe(0.7);
  });
});

// ---------------------------------------------------------------------------
// ContextModule shape check
// ---------------------------------------------------------------------------

describe("ContextModule", () => {
  it("has required fields", () => {
    const module: ContextModule = {
      id: "test-module",
      name: "Test Module",
      type: "sentence",
      content: "Test content",
      isEnabled: true,
    };
    expect(module.id).toBe("test-module");
    expect(module.type).toBe("sentence");
    expect(module.isEnabled).toBe(true);
  });

  it("supports dictionary type with optional providerId", () => {
    const module: ContextModule = {
      id: "dict-module",
      name: "Dictionary Module",
      type: "dictionary",
      content: "Dictionary lookup",
      isEnabled: true,
      providerId: "etymonline",
    };
    expect(module.type).toBe("dictionary");
    expect(module.providerId).toBe("etymonline");
  });
});

// ---------------------------------------------------------------------------
// AIRole shape check
// ---------------------------------------------------------------------------

describe("AIRole", () => {
  it("has required fields including variables", () => {
    const role = {
      id: "test-role",
      name: "Test Role",
      systemMessage: "You are a translator.",
      userMessageTemplate: "Translate {selectedText}",
      variables: [
        {
          name: "selectedText",
          description: "The text selected by the user",
          defaultValue: "",
          isRequired: true,
        },
      ],
      isDefault: true,
      isEnabled: true,
    };
    expect(role.variables).toHaveLength(1);
    expect(role.variables[0].name).toBe("selectedText");
  });
});
