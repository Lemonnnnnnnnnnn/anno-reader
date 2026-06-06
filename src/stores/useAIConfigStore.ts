import { create } from "zustand";
import type { AIConfig, AIProvider, ContextConfig, AIRole } from "@/lib/ai/types";
import { BUILTIN_ROLES } from "@/lib/ai/constants";
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
    modules: [
      {
        id: "builtin-sentence",
        name: "Sentence Context",
        type: "sentence",
        content: "Extracts the surrounding paragraph from chapter text for richer context.",
        isEnabled: true,
      },
      {
        id: "builtin-etymonline",
        name: "Etymonline (词源)",
        type: "dictionary",
        content: "Etymology and word origins from Etymonline",
        isEnabled: true,
        providerId: "etymonline",
      },
      {
        id: "builtin-vocabulary",
        name: "Vocabulary.com",
        type: "dictionary",
        content: "Definitions from Vocabulary.com dictionary",
        isEnabled: true,
        providerId: "vocabulary",
      },
    ],
  },
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
      const mergedModules = DEFAULT_CONFIG.contextConfig.modules.map(
        (m) => ({
          ...m,
          isEnabled: userModuleStates.has(m.id)
            ? userModuleStates.get(m.id)!
            : m.isEnabled,
        }),
      );

      // Add user's custom modules (non-built-in) if any
      for (const m of parsed.contextConfig?.modules ?? []) {
        if (!builtinModuleIds.has(m.id)) {
          mergedModules.push(m);
        }
      }

      const merged: AIConfig = {
        ...DEFAULT_CONFIG,
        ...parsed,
        contextConfig: {
          modules: mergedModules,
        },
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
