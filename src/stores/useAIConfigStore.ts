import { create } from "zustand";
import type { AIConfig, AIProvider, AIPrompt, ContextConfig } from "@/lib/ai/types";
import { DEFAULT_TRANSLATION_PROMPT, BUILTIN_PARAGRAPH_CONTEXT } from "@/lib/ai/types";
import { readConfig } from "@/lib/storage/config";
import { writeTextFile, readTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";

const AI_CONFIG_FILE = "ai-config.json";

export interface AIConfigStore {
  config: AIConfig;
  isLoaded: boolean;

  // Provider actions
  addProvider: (provider: AIProvider) => void;
  updateProvider: (id: string, updates: Partial<AIProvider>) => void;
  removeProvider: (id: string) => void;
  setSelectedProvider: (id: string | null) => void;

  // Context actions
  updateContextConfig: (config: Partial<ContextConfig>) => void;

  // Prompt actions
  addPrompt: (prompt: AIPrompt) => void;
  updatePrompt: (id: string, updates: Partial<AIPrompt>) => void;
  removePrompt: (id: string) => void;
  setDefaultPrompt: (id: string) => void;

  // Persistence actions
  persistConfig: () => Promise<void>;
  loadConfig: () => Promise<void>;
}

const DEFAULT_CONFIG: AIConfig = {
  providers: [],
  selectedProviderId: null,
  contextConfig: {
    modules: [BUILTIN_PARAGRAPH_CONTEXT],
    selectedModuleIds: [BUILTIN_PARAGRAPH_CONTEXT.id],
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

/**
 * Helper to persist config after a state mutation.
 * Fire-and-forget — logs errors but doesn't block UI.
 */
function persistAfterSet(get: () => AIConfigStore) {
  get().persistConfig().catch((err) => {
    console.error("Failed to persist AI config:", err);
  });
}

export const useAIConfigStore = create<AIConfigStore>((set, get) => ({
  config: DEFAULT_CONFIG,
  isLoaded: false,

  addProvider: (provider) => {
    set((state) => ({
      config: {
        ...state.config,
        providers: [...state.config.providers, provider],
      },
    }));
    persistAfterSet(get);
  },

  updateProvider: (id, updates) => {
    set((state) => ({
      config: {
        ...state.config,
        providers: state.config.providers.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        ),
      },
    }));
    persistAfterSet(get);
  },

  removeProvider: (id) => {
    set((state) => ({
      config: {
        ...state.config,
        providers: state.config.providers.filter((p) => p.id !== id),
        selectedProviderId:
          state.config.selectedProviderId === id ? null : state.config.selectedProviderId,
      },
    }));
    persistAfterSet(get);
  },

  setSelectedProvider: (id) => {
    set((state) => ({
      config: { ...state.config, selectedProviderId: id },
    }));
    persistAfterSet(get);
  },

  updateContextConfig: (contextUpdates) => {
    set((state) => ({
      config: {
        ...state.config,
        contextConfig: { ...state.config.contextConfig, ...contextUpdates },
      },
    }));
    persistAfterSet(get);
  },

  addPrompt: (prompt) => {
    set((state) => ({
      config: {
        ...state.config,
        prompts: [...state.config.prompts, prompt],
      },
    }));
    persistAfterSet(get);
  },

  updatePrompt: (id, updates) => {
    set((state) => ({
      config: {
        ...state.config,
        prompts: state.config.prompts.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        ),
      },
    }));
    persistAfterSet(get);
  },

  removePrompt: (id) => {
    set((state) => ({
      config: {
        ...state.config,
        prompts: state.config.prompts.filter((p) => p.id !== id),
      },
    }));
    persistAfterSet(get);
  },

  setDefaultPrompt: (id) => {
    set((state) => ({
      config: {
        ...state.config,
        prompts: state.config.prompts.map((p) => ({
          ...p,
          isDefault: p.id === id,
        })),
      },
    }));
    persistAfterSet(get);
  },

  persistConfig: async () => {
    const config = await readConfig();
    if (!config) {
      throw new Error("Data directory not configured");
    }

    const aiDir = `${config.dataDir}/ai`;
    const dirExists = await exists(aiDir);
    if (!dirExists) {
      await mkdir(aiDir, { recursive: true });
    }

    const filePath = `${aiDir}/${AI_CONFIG_FILE}`;
    const data = get().config;
    const json = JSON.stringify(data, null, 2);
    await writeTextFile(filePath, json);
  },

  loadConfig: async () => {
    try {
      const config = await readConfig();
      if (!config) {
        set({ isLoaded: true });
        return;
      }

      const filePath = `${config.dataDir}/ai/${AI_CONFIG_FILE}`;
      const fileExists = await exists(filePath);
      if (!fileExists) {
        set({ isLoaded: true });
        return;
      }

      const json = await readTextFile(filePath);
      const parsed = JSON.parse(json) as Partial<AIConfig>;
      const merged: AIConfig = {
        ...DEFAULT_CONFIG,
        ...parsed,
        contextConfig: {
          ...DEFAULT_CONFIG.contextConfig,
          ...(parsed.contextConfig ?? {}),
        },
        prompts: parsed.prompts ?? DEFAULT_CONFIG.prompts,
      };

      set({ config: merged, isLoaded: true });
    } catch (err) {
      console.error("Failed to load AI config:", err);
      set({ isLoaded: true });
    }
  },
}));
