import { create } from "zustand";
import type { TTSConfig, TTSProvider } from "@/lib/tts/types";
import { DEFAULT_CONFIG } from "@/lib/tts/constants";
import { readConfig } from "@/lib/storage/config";
import { writeTextFile, readTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";

const TTS_CONFIG_FILE = "tts-config.json";

export interface TTSConfigStore {
  config: TTSConfig;
  isLoaded: boolean;

  // Provider actions
  addProvider: (provider: TTSProvider) => void;
  updateProvider: (id: string, updates: Partial<TTSProvider>) => void;
  removeProvider: (id: string) => void;
  setSelectedProvider: (id: string | null) => void;

  // Persistence actions
  persistConfig: () => Promise<void>;
  loadConfig: () => Promise<void>;
}

/**
 * Helper to persist config after a state mutation.
 * Fire-and-forget — logs errors but doesn't block UI.
 */
function persistAfterSet(get: () => TTSConfigStore) {
  get().persistConfig().catch((err) => {
    console.error("Failed to persist TTS config:", err);
  });
}

export const useTTSConfigStore = create<TTSConfigStore>((set, get) => ({
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

  persistConfig: async () => {
    const config = await readConfig();
    if (!config) {
      throw new Error("Data directory not configured");
    }

    const ttsDir = `${config.dataDir}/tts`;
    const dirExists = await exists(ttsDir);
    if (!dirExists) {
      await mkdir(ttsDir, { recursive: true });
    }

    const filePath = `${ttsDir}/${TTS_CONFIG_FILE}`;
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

      const filePath = `${config.dataDir}/tts/${TTS_CONFIG_FILE}`;
      const fileExists = await exists(filePath);
      if (!fileExists) {
        set({ isLoaded: true });
        return;
      }

      const json = await readTextFile(filePath);
      const parsed = JSON.parse(json) as Partial<TTSConfig>;

      // Merge with defaults: keep built-in providers, apply user overrides
      const builtinIds = new Set(DEFAULT_CONFIG.providers.map((p) => p.id));

      // Start with default providers, apply user's enabled/updates for builtins
      const mergedProviders = DEFAULT_CONFIG.providers.map((builtin) => {
        const user = parsed.providers?.find((p) => p.id === builtin.id);
        return user ? { ...builtin, ...user } : builtin;
      });

      // Add user's custom providers (non-built-in)
      for (const p of parsed.providers ?? []) {
        if (!builtinIds.has(p.id)) {
          mergedProviders.push(p);
        }
      }

      const merged: TTSConfig = {
        ...DEFAULT_CONFIG,
        ...parsed,
        providers: mergedProviders,
        selectedProviderId: parsed.selectedProviderId ?? DEFAULT_CONFIG.selectedProviderId,
      };

      set({ config: merged, isLoaded: true });
    } catch (err) {
      console.error("Failed to load TTS config:", err);
      set({ isLoaded: true });
    }
  },
}));
