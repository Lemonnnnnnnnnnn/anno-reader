import { create } from "zustand";
import type { AIConfig, AIProvider, AIPrompt, ContextConfig, AIRole } from "@/lib/ai/types";
import { DEFAULT_TRANSLATION_PROMPT, BUILTIN_SENTENCE_CONTEXT, BUILTIN_DICTIONARY_MODULES, BUILTIN_ROLES } from "@/lib/ai/constants";
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

  // Role actions
  addRole: (role: AIRole) => void;
  updateRole: (id: string, updates: Partial<AIRole>) => void;
  removeRole: (id: string) => void;
  setSelectedRole: (id: string | null) => void;

  // Persistence actions
  persistConfig: () => Promise<void>;
  loadConfig: () => Promise<void>;
}

const DEFAULT_CONFIG: AIConfig = {
  providers: [],
  selectedProviderId: null,
  contextConfig: {
    modules: [BUILTIN_SENTENCE_CONTEXT, ...BUILTIN_DICTIONARY_MODULES],
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
  roles: BUILTIN_ROLES,
  selectedRoleId: BUILTIN_ROLES.find(r => r.isDefault)?.id ?? null,
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

  // Role actions
  addRole: (role) => {
    set((state) => ({
      config: {
        ...state.config,
        roles: [...state.config.roles, role],
      },
    }));
    persistAfterSet(get);
  },

  updateRole: (id, updates) => {
    set((state) => ({
      config: {
        ...state.config,
        roles: state.config.roles.map((r) =>
          r.id === id ? { ...r, ...updates } : r
        ),
      },
    }));
    persistAfterSet(get);
  },

  removeRole: (id) => {
    set((state) => ({
      config: {
        ...state.config,
        roles: state.config.roles.filter((r) => r.id !== id),
        selectedRoleId:
          state.config.selectedRoleId === id ? null : state.config.selectedRoleId,
      },
    }));
    persistAfterSet(get);
  },

  setSelectedRole: (id) => {
    set((state) => ({
      config: { ...state.config, selectedRoleId: id },
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

      // Merge context modules: always keep built-in modules, apply user's enabled/disabled state
      const builtinModuleIds = new Set(
        DEFAULT_CONFIG.contextConfig.modules.map((m) => m.id),
      );

      // Build map of user's module states (enabled/disabled)
      const userModuleStates = new Map(
        (parsed.contextConfig?.modules ?? []).map((m) => [m.id, m.isEnabled]),
      );

      // Built-in modules: keep defaults, apply user's state if exists
      const mergedBuiltinModules = DEFAULT_CONFIG.contextConfig.modules.map(
        (m) => ({
          ...m,
          isEnabled: userModuleStates.has(m.id)
            ? userModuleStates.get(m.id)!
            : m.isEnabled,
        }),
      );

      // User's custom modules (non-built-in)
      const customModules = (parsed.contextConfig?.modules ?? []).filter(
        (m) => !builtinModuleIds.has(m.id),
      );

      const mergedModules = [...mergedBuiltinModules, ...customModules];

      // Merge selectedModuleIds: keep user's selection, ensure built-in IDs are valid
      const userSelectedIds = parsed.contextConfig?.selectedModuleIds ?? [];
      const validSelectedIds = userSelectedIds.filter((id) =>
        mergedModules.some((m) => m.id === id),
      );

      // If no valid selection, default to sentence context
      const selectedModuleIds =
        validSelectedIds.length > 0
          ? validSelectedIds
          : [BUILTIN_SENTENCE_CONTEXT.id];

      const merged: AIConfig = {
        ...DEFAULT_CONFIG,
        ...parsed,
        contextConfig: {
          modules: mergedModules,
          selectedModuleIds,
        },
        prompts: parsed.prompts ?? DEFAULT_CONFIG.prompts,
        roles: parsed.roles ?? DEFAULT_CONFIG.roles,
        selectedRoleId: parsed.selectedRoleId ?? DEFAULT_CONFIG.selectedRoleId,
      };

      set({ config: merged, isLoaded: true });
    } catch (err) {
      console.error("Failed to load AI config:", err);
      set({ isLoaded: true });
    }
  },
}));
