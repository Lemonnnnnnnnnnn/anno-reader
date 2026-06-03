import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAIConfigStore } from "@/stores/useAIConfigStore";
import {
  BUILTIN_SENTENCE_CONTEXT,
  DEFAULT_TRANSLATION_PROMPT,
} from "@/lib/ai/types";
import type { AIProvider, AIPrompt } from "@/lib/ai/types";

// ---------------------------------------------------------------------------
// Mocks for Tauri fs APIs
// ---------------------------------------------------------------------------

vi.mock("@/lib/storage/config", () => ({
  readConfig: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  writeTextFile: vi.fn(),
  readTextFile: vi.fn(),
  exists: vi.fn(),
  mkdir: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockReadConfig = (await import("@/lib/storage/config")).readConfig as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockWriteTextFile = (await import("@tauri-apps/plugin-fs")).writeTextFile as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockReadTextFile = (await import("@tauri-apps/plugin-fs")).readTextFile as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockExists = (await import("@tauri-apps/plugin-fs")).exists as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockMkdir = (await import("@tauri-apps/plugin-fs")).mkdir as any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore() {
  useAIConfigStore.setState({
    config: {
      providers: [],
      selectedProviderId: null,
      contextConfig: {
        modules: [BUILTIN_SENTENCE_CONTEXT],
        selectedModuleIds: [BUILTIN_SENTENCE_CONTEXT.id],
      },
      prompts: [
        {
          id: DEFAULT_TRANSLATION_PROMPT.id,
          name: DEFAULT_TRANSLATION_PROMPT.name,
          content: DEFAULT_TRANSLATION_PROMPT.content,
          variables: DEFAULT_TRANSLATION_PROMPT.variables,
          isDefault: true,
          isEnabled: true,
        },
      ],
      roles: [],
      selectedRoleId: null,
    },
  });
}

const SAMPLE_PROVIDER: AIProvider = {
  id: "provider-1",
  name: "My OpenAI",
  type: "openai",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "sk-test",
  model: "gpt-4o",
  maxTokens: 4096,
  temperature: 0.7,
  enabled: true,
};

const SAMPLE_PROMPT: AIPrompt = {
  id: "prompt-custom",
  name: "Custom Prompt",
  content: "Translate {selectedText} to {targetLanguage}",
  variables: [],
  isDefault: false,
  isEnabled: true,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAIConfigStore", () => {
  beforeEach(() => {
    resetStore();
  });

  // -- Default state -------------------------------------------------------

  describe("default config", () => {
    it("has no providers and null selectedProviderId", () => {
      const { providers, selectedProviderId } = useAIConfigStore.getState().config;
      expect(providers).toEqual([]);
      expect(selectedProviderId).toBeNull();
    });

    it("includes BUILTIN_SENTENCE_CONTEXT in modules", () => {
      const { modules, selectedModuleIds } = useAIConfigStore.getState().config.contextConfig;
      expect(modules).toContainEqual(BUILTIN_SENTENCE_CONTEXT);
      expect(selectedModuleIds).toContain(BUILTIN_SENTENCE_CONTEXT.id);
    });

    it("has DEFAULT_TRANSLATION_PROMPT as the default prompt", () => {
      const { prompts } = useAIConfigStore.getState().config;
      expect(prompts).toHaveLength(1);
      expect(prompts[0].id).toBe(DEFAULT_TRANSLATION_PROMPT.id);
      expect(prompts[0].isDefault).toBe(true);
      expect(prompts[0].isEnabled).toBe(true);
    });
  });

  // -- Provider actions ----------------------------------------------------

  describe("addProvider", () => {
    it("adds a provider to the list", () => {
      useAIConfigStore.getState().addProvider(SAMPLE_PROVIDER);
      const { providers } = useAIConfigStore.getState().config;
      expect(providers).toHaveLength(1);
      expect(providers[0]).toEqual(SAMPLE_PROVIDER);
    });

    it("appends multiple providers", () => {
      const second: AIProvider = { ...SAMPLE_PROVIDER, id: "provider-2", name: "Second" };
      useAIConfigStore.getState().addProvider(SAMPLE_PROVIDER);
      useAIConfigStore.getState().addProvider(second);
      const { providers } = useAIConfigStore.getState().config;
      expect(providers).toHaveLength(2);
      expect(providers[1].id).toBe("provider-2");
    });
  });

  describe("updateProvider", () => {
    it("updates fields of a matching provider", () => {
      useAIConfigStore.getState().addProvider(SAMPLE_PROVIDER);
      useAIConfigStore.getState().updateProvider("provider-1", { name: "Renamed" });
      const { providers } = useAIConfigStore.getState().config;
      expect(providers[0].name).toBe("Renamed");
      expect(providers[0].id).toBe("provider-1");
    });

    it("does not affect other providers", () => {
      const other: AIProvider = { ...SAMPLE_PROVIDER, id: "provider-2", name: "Other" };
      useAIConfigStore.getState().addProvider(SAMPLE_PROVIDER);
      useAIConfigStore.getState().addProvider(other);
      useAIConfigStore.getState().updateProvider("provider-1", { name: "Renamed" });
      const { providers } = useAIConfigStore.getState().config;
      expect(providers[1].name).toBe("Other");
    });
  });

  describe("removeProvider", () => {
    it("removes the provider from the list", () => {
      useAIConfigStore.getState().addProvider(SAMPLE_PROVIDER);
      useAIConfigStore.getState().removeProvider("provider-1");
      expect(useAIConfigStore.getState().config.providers).toHaveLength(0);
    });

    it("clears selectedProviderId if the removed provider was selected", () => {
      useAIConfigStore.getState().addProvider(SAMPLE_PROVIDER);
      useAIConfigStore.getState().setSelectedProvider("provider-1");
      useAIConfigStore.getState().removeProvider("provider-1");
      expect(useAIConfigStore.getState().config.selectedProviderId).toBeNull();
    });

    it("preserves selectedProviderId if a different provider was selected", () => {
      const other: AIProvider = { ...SAMPLE_PROVIDER, id: "provider-2", name: "Other" };
      useAIConfigStore.getState().addProvider(SAMPLE_PROVIDER);
      useAIConfigStore.getState().addProvider(other);
      useAIConfigStore.getState().setSelectedProvider("provider-2");
      useAIConfigStore.getState().removeProvider("provider-1");
      expect(useAIConfigStore.getState().config.selectedProviderId).toBe("provider-2");
    });
  });

  describe("setSelectedProvider", () => {
    it("sets the selected provider id", () => {
      useAIConfigStore.getState().addProvider(SAMPLE_PROVIDER);
      useAIConfigStore.getState().setSelectedProvider("provider-1");
      expect(useAIConfigStore.getState().config.selectedProviderId).toBe("provider-1");
    });

    it("can clear selection with null", () => {
      useAIConfigStore.getState().addProvider(SAMPLE_PROVIDER);
      useAIConfigStore.getState().setSelectedProvider("provider-1");
      useAIConfigStore.getState().setSelectedProvider(null);
      expect(useAIConfigStore.getState().config.selectedProviderId).toBeNull();
    });
  });

  // -- Context actions -----------------------------------------------------

  describe("updateContextConfig", () => {
    it("merges partial context config updates", () => {
      useAIConfigStore.getState().updateContextConfig({ selectedModuleIds: [] });
      const { contextConfig } = useAIConfigStore.getState().config;
      expect(contextConfig.selectedModuleIds).toEqual([]);
      // modules should still be intact
      expect(contextConfig.modules).toContainEqual(BUILTIN_SENTENCE_CONTEXT);
    });
  });

  // -- Prompt actions ------------------------------------------------------

  describe("addPrompt", () => {
    it("adds a prompt to the list", () => {
      useAIConfigStore.getState().addPrompt(SAMPLE_PROMPT);
      const { prompts } = useAIConfigStore.getState().config;
      expect(prompts).toHaveLength(2);
      expect(prompts[1]).toEqual(SAMPLE_PROMPT);
    });
  });

  describe("updatePrompt", () => {
    it("updates fields of a matching prompt", () => {
      useAIConfigStore.getState().updatePrompt(DEFAULT_TRANSLATION_PROMPT.id, { name: "Updated" });
      const { prompts } = useAIConfigStore.getState().config;
      expect(prompts[0].name).toBe("Updated");
      expect(prompts[0].id).toBe(DEFAULT_TRANSLATION_PROMPT.id);
    });

    it("does not affect other prompts", () => {
      useAIConfigStore.getState().addPrompt(SAMPLE_PROMPT);
      useAIConfigStore.getState().updatePrompt(DEFAULT_TRANSLATION_PROMPT.id, { name: "Updated" });
      const { prompts } = useAIConfigStore.getState().config;
      expect(prompts[1].name).toBe("Custom Prompt");
    });
  });

  describe("removePrompt", () => {
    it("removes the prompt from the list", () => {
      useAIConfigStore.getState().addPrompt(SAMPLE_PROMPT);
      expect(useAIConfigStore.getState().config.prompts).toHaveLength(2);
      useAIConfigStore.getState().removePrompt("prompt-custom");
      expect(useAIConfigStore.getState().config.prompts).toHaveLength(1);
      expect(useAIConfigStore.getState().config.prompts[0].id).toBe(DEFAULT_TRANSLATION_PROMPT.id);
    });
  });

  describe("setDefaultPrompt", () => {
    it("sets the specified prompt as default and unsets others", () => {
      useAIConfigStore.getState().addPrompt(SAMPLE_PROMPT);
      useAIConfigStore.getState().setDefaultPrompt("prompt-custom");
      const { prompts } = useAIConfigStore.getState().config;
      const custom = prompts.find((p) => p.id === "prompt-custom");
      const defaultPrompt = prompts.find((p) => p.id === DEFAULT_TRANSLATION_PROMPT.id);
      expect(custom?.isDefault).toBe(true);
      expect(defaultPrompt?.isDefault).toBe(false);
    });

    it("works when setting the already-default prompt (no-op for others)", () => {
      useAIConfigStore.getState().setDefaultPrompt(DEFAULT_TRANSLATION_PROMPT.id);
      const { prompts } = useAIConfigStore.getState().config;
      expect(prompts[0].isDefault).toBe(true);
    });
  });

  // -- Persistence actions --------------------------------------------------

  describe("persistConfig", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("writes config to ai-config.json", async () => {
      mockReadConfig.mockResolvedValue({ dataDir: "/test/data" });
      mockExists.mockResolvedValue(true);

      useAIConfigStore.getState().addProvider(SAMPLE_PROVIDER);
      await useAIConfigStore.getState().persistConfig();

      expect(mockWriteTextFile).toHaveBeenCalledOnce();
      const [filePath, content] = mockWriteTextFile.mock.calls[0];
      expect(filePath).toBe("/test/data/ai/ai-config.json");

      const written = JSON.parse(content);
      expect(written.providers).toHaveLength(1);
      expect(written.providers[0].id).toBe("provider-1");
    });

    it("creates ai directory if it does not exist", async () => {
      mockReadConfig.mockResolvedValue({ dataDir: "/test/data" });
      mockExists.mockResolvedValue(false);

      await useAIConfigStore.getState().persistConfig();

      expect(mockMkdir).toHaveBeenCalledWith("/test/data/ai", { recursive: true });
      expect(mockWriteTextFile).toHaveBeenCalledOnce();
    });

    it("throws if dataDir is not configured", async () => {
      mockReadConfig.mockResolvedValue(null);

      await expect(useAIConfigStore.getState().persistConfig()).rejects.toThrow(
        "Data directory not configured"
      );
      expect(mockWriteTextFile).not.toHaveBeenCalled();
    });
  });

  describe("loadConfig", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      resetStore();
    });

    it("loads config from file", async () => {
      const savedConfig = {
        providers: [SAMPLE_PROVIDER],
        selectedProviderId: "provider-1",
        contextConfig: {
          modules: [BUILTIN_SENTENCE_CONTEXT],
          selectedModuleIds: [BUILTIN_SENTENCE_CONTEXT.id],
        },
        prompts: [
          {
            id: DEFAULT_TRANSLATION_PROMPT.id,
            name: DEFAULT_TRANSLATION_PROMPT.name,
            content: DEFAULT_TRANSLATION_PROMPT.content,
            variables: DEFAULT_TRANSLATION_PROMPT.variables,
            isDefault: true,
            isEnabled: true,
          },
        ],
      };

      mockReadConfig.mockResolvedValue({ dataDir: "/test/data" });
      mockExists.mockResolvedValue(true);
      mockReadTextFile.mockResolvedValue(JSON.stringify(savedConfig));

      await useAIConfigStore.getState().loadConfig();

      const { config, isLoaded } = useAIConfigStore.getState();
      expect(isLoaded).toBe(true);
      expect(config.providers).toHaveLength(1);
      expect(config.providers[0].id).toBe("provider-1");
      expect(config.selectedProviderId).toBe("provider-1");
    });

    it("uses defaults when file does not exist", async () => {
      mockReadConfig.mockResolvedValue({ dataDir: "/test/data" });
      mockExists.mockResolvedValue(false);

      await useAIConfigStore.getState().loadConfig();

      const { config, isLoaded } = useAIConfigStore.getState();
      expect(isLoaded).toBe(true);
      expect(config.providers).toEqual([]);
      expect(config.selectedProviderId).toBeNull();
      expect(config.prompts).toHaveLength(1);
      expect(config.prompts[0].id).toBe(DEFAULT_TRANSLATION_PROMPT.id);
    });

    it("uses defaults when dataDir is not configured", async () => {
      mockReadConfig.mockResolvedValue(null);

      await useAIConfigStore.getState().loadConfig();

      const { config, isLoaded } = useAIConfigStore.getState();
      expect(isLoaded).toBe(true);
      expect(config.providers).toEqual([]);
      expect(config.prompts).toHaveLength(1);
    });

    it("merges with defaults for missing fields", async () => {
      const partialConfig = {
        providers: [SAMPLE_PROVIDER],
        // missing contextConfig, prompts
      };

      mockReadConfig.mockResolvedValue({ dataDir: "/test/data" });
      mockExists.mockResolvedValue(true);
      mockReadTextFile.mockResolvedValue(JSON.stringify(partialConfig));

      await useAIConfigStore.getState().loadConfig();

      const { config } = useAIConfigStore.getState();
      expect(config.providers).toHaveLength(1);
      // contextConfig should be merged from defaults
      expect(config.contextConfig.modules).toContainEqual(BUILTIN_SENTENCE_CONTEXT);
      // prompts should fall back to defaults
      expect(config.prompts).toHaveLength(1);
      expect(config.prompts[0].id).toBe(DEFAULT_TRANSLATION_PROMPT.id);
    });

    it("sets isLoaded even on error", async () => {
      mockReadConfig.mockRejectedValue(new Error("disk error"));

      await useAIConfigStore.getState().loadConfig();

      expect(useAIConfigStore.getState().isLoaded).toBe(true);
    });
  });
});
