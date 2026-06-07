import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAIConfigStore } from "@/stores/useAIConfigStore";
import type { AIProvider, AIRole } from "@/lib/ai/types";

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
// Inline constants matching store's DEFAULT_CONFIG
// ---------------------------------------------------------------------------

const BUILTIN_SENTENCE_MODULE = {
  id: "builtin-sentence",
  name: "Sentence Context",
  type: "sentence" as const,
  content: "Extracts the surrounding paragraph from chapter text for richer context.",
  isEnabled: true,
};

const BUILTIN_ETYMMONLINE_MODULE = {
  id: "builtin-etymonline",
  name: "Etymonline (词源)",
  type: "dictionary" as const,
  content: "Etymology and word origins from Etymonline",
  isEnabled: true,
  providerId: "etymonline",
};

const BUILTIN_VOCABULARY_MODULE = {
  id: "builtin-vocabulary",
  name: "Vocabulary.com",
  type: "dictionary" as const,
  content: "Definitions from Vocabulary.com dictionary",
  isEnabled: true,
  providerId: "vocabulary",
};

const DEFAULT_MODULES = [
  BUILTIN_SENTENCE_MODULE,
  BUILTIN_ETYMMONLINE_MODULE,
  BUILTIN_VOCABULARY_MODULE,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore() {
  useAIConfigStore.setState({
    config: {
      providers: [],
      selectedProviderId: null,
      contextConfig: {
        modules: DEFAULT_MODULES,
      },
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

const SAMPLE_ROLE: AIRole = {
  id: "role-custom",
  name: "Custom Role",
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

    it("includes built-in context modules", () => {
      const { modules } = useAIConfigStore.getState().config.contextConfig;
      expect(modules).toContainEqual(BUILTIN_SENTENCE_MODULE);
      expect(modules).toContainEqual(BUILTIN_ETYMMONLINE_MODULE);
      expect(modules).toContainEqual(BUILTIN_VOCABULARY_MODULE);
    });

    it("has empty roles by default in test fixture", () => {
      const { roles } = useAIConfigStore.getState().config;
      expect(roles).toEqual([]);
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
      useAIConfigStore.getState().updateContextConfig({ modules: [BUILTIN_SENTENCE_MODULE] });
      const { contextConfig } = useAIConfigStore.getState().config;
      expect(contextConfig.modules).toHaveLength(1);
      expect(contextConfig.modules[0].id).toBe("builtin-sentence");
    });
  });

  // -- Role actions --------------------------------------------------------

  describe("addRole", () => {
    it("adds a role to the list", () => {
      useAIConfigStore.getState().addRole(SAMPLE_ROLE);
      const { roles } = useAIConfigStore.getState().config;
      expect(roles).toHaveLength(1);
      expect(roles[0]).toEqual(SAMPLE_ROLE);
    });
  });

  describe("updateRole", () => {
    it("updates fields of a matching role", () => {
      useAIConfigStore.getState().addRole(SAMPLE_ROLE);
      useAIConfigStore.getState().updateRole("role-custom", { name: "Updated" });
      const { roles } = useAIConfigStore.getState().config;
      expect(roles[0].name).toBe("Updated");
      expect(roles[0].id).toBe("role-custom");
    });

    it("does not affect other roles", () => {
      const other: AIRole = { ...SAMPLE_ROLE, id: "role-other", name: "Other" };
      useAIConfigStore.getState().addRole(SAMPLE_ROLE);
      useAIConfigStore.getState().addRole(other);
      useAIConfigStore.getState().updateRole("role-custom", { name: "Updated" });
      const { roles } = useAIConfigStore.getState().config;
      expect(roles[1].name).toBe("Other");
    });
  });

  describe("removeRole", () => {
    it("removes the role from the list", () => {
      useAIConfigStore.getState().addRole(SAMPLE_ROLE);
      expect(useAIConfigStore.getState().config.roles).toHaveLength(1);
      useAIConfigStore.getState().removeRole("role-custom");
      expect(useAIConfigStore.getState().config.roles).toHaveLength(0);
    });
  });

  describe("setSelectedRole", () => {
    it("sets the selected role id", () => {
      useAIConfigStore.getState().addRole(SAMPLE_ROLE);
      useAIConfigStore.getState().setSelectedRole("role-custom");
      expect(useAIConfigStore.getState().config.selectedRoleId).toBe("role-custom");
    });

    it("can clear selection with null", () => {
      useAIConfigStore.getState().addRole(SAMPLE_ROLE);
      useAIConfigStore.getState().setSelectedRole("role-custom");
      useAIConfigStore.getState().setSelectedRole(null);
      expect(useAIConfigStore.getState().config.selectedRoleId).toBeNull();
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

      // addProvider triggers persistAfterSet which calls persistConfig
      // Wait a tick for the async persist to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockWriteTextFile).toHaveBeenCalled();
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
          modules: [BUILTIN_SENTENCE_MODULE],
        },
        roles: [SAMPLE_ROLE],
        selectedRoleId: "role-custom",
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
    });

    it("uses defaults when dataDir is not configured", async () => {
      mockReadConfig.mockResolvedValue(null);

      await useAIConfigStore.getState().loadConfig();

      const { config, isLoaded } = useAIConfigStore.getState();
      expect(isLoaded).toBe(true);
      expect(config.providers).toEqual([]);
    });

    it("merges with defaults for missing fields", async () => {
      const partialConfig = {
        providers: [SAMPLE_PROVIDER],
        // missing contextConfig, roles
      };

      mockReadConfig.mockResolvedValue({ dataDir: "/test/data" });
      mockExists.mockResolvedValue(true);
      mockReadTextFile.mockResolvedValue(JSON.stringify(partialConfig));

      await useAIConfigStore.getState().loadConfig();

      const { config } = useAIConfigStore.getState();
      expect(config.providers).toHaveLength(1);
      // contextConfig should be merged from defaults
      expect(config.contextConfig.modules).toContainEqual(BUILTIN_SENTENCE_MODULE);
    });

    it("sets isLoaded even on error", async () => {
      mockReadConfig.mockRejectedValue(new Error("disk error"));

      await useAIConfigStore.getState().loadConfig();

      expect(useAIConfigStore.getState().isLoaded).toBe(true);
    });
  });
});
