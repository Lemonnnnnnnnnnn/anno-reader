import { create } from "zustand";
import { readConfig, writeConfig } from "@/lib/storage/config";
import type { ProxyConfig } from "@/lib/storage/config";

export interface ProxyConfigStore {
  enabled: boolean;
  address: string;
  port: string;
  isLoaded: boolean;

  setEnabled: (enabled: boolean) => void;
  setAddress: (address: string) => void;
  setPort: (port: string) => void;

  loadConfig: () => Promise<void>;
}

/**
 * Helper to persist proxy config after a state mutation.
 * Fire-and-forget — logs errors but doesn't block UI.
 */
function persistAfterSet(get: () => ProxyConfigStore) {
  (async () => {
    const config = await readConfig();
    if (!config) return;

    const updated: ProxyConfig = {
      enabled: get().enabled,
      address: get().address,
      port: get().port,
    };

    await writeConfig({ ...config, proxy: updated });
  })().catch((err) => {
    console.error("Failed to persist proxy config:", err);
  });
}

const DEFAULT_PROXY: ProxyConfig = {
  enabled: false,
  address: "",
  port: "",
};

export const useProxyConfigStore = create<ProxyConfigStore>((set, get) => ({
  ...DEFAULT_PROXY,
  isLoaded: false,

  setEnabled: (enabled) => {
    set({ enabled });
    persistAfterSet(get);
  },

  setAddress: (address) => {
    set({ address });
    persistAfterSet(get);
  },

  setPort: (port) => {
    set({ port });
    persistAfterSet(get);
  },

  loadConfig: async () => {
    try {
      const config = await readConfig();
      if (!config) {
        set({ isLoaded: true });
        return;
      }

      set({
        enabled: config.proxy.enabled,
        address: config.proxy.address,
        port: config.proxy.port,
        isLoaded: true,
      });
    } catch (err) {
      console.error("Failed to load proxy config:", err);
      set({ isLoaded: true });
    }
  },
}));
