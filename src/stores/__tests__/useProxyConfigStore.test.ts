import { describe, it, expect, beforeEach, vi } from "vitest";
import { useProxyConfigStore } from "@/stores/useProxyConfigStore";

// ---------------------------------------------------------------------------
// Mocks for Tauri fs APIs and storage config
// ---------------------------------------------------------------------------

vi.mock("@/lib/storage/config", () => ({
  readConfig: vi.fn(),
  writeConfig: vi.fn(),
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
const mockWriteConfig = (await import("@/lib/storage/config")).writeConfig as any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore() {
  useProxyConfigStore.setState({
    enabled: false,
    address: "",
    port: "",
    isLoaded: false,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useProxyConfigStore", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  // -- Default state -------------------------------------------------------

  describe("default config", () => {
    it("has proxy disabled by default", () => {
      expect(useProxyConfigStore.getState().enabled).toBe(false);
    });

    it("has empty address by default", () => {
      expect(useProxyConfigStore.getState().address).toBe("");
    });

    it("has empty port by default", () => {
      expect(useProxyConfigStore.getState().port).toBe("");
    });

    it("is not loaded initially", () => {
      expect(useProxyConfigStore.getState().isLoaded).toBe(false);
    });
  });

  // -- setEnabled ----------------------------------------------------------

  describe("setEnabled", () => {
    it("sets enabled to true", () => {
      useProxyConfigStore.getState().setEnabled(true);
      expect(useProxyConfigStore.getState().enabled).toBe(true);
    });

    it("sets enabled to false", () => {
      useProxyConfigStore.getState().setEnabled(true);
      useProxyConfigStore.getState().setEnabled(false);
      expect(useProxyConfigStore.getState().enabled).toBe(false);
    });

    it("persists config after setting enabled", async () => {
      mockReadConfig.mockResolvedValue({
        dataDir: "/test/data",
        proxy: { enabled: false, address: "", port: "" },
      });

      useProxyConfigStore.getState().setEnabled(true);

      // Wait for fire-and-forget async persist
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockWriteConfig).toHaveBeenCalledWith({
        dataDir: "/test/data",
        proxy: { enabled: true, address: "", port: "" },
      });
    });
  });

  // -- setAddress ----------------------------------------------------------

  describe("setAddress", () => {
    it("sets the address", () => {
      useProxyConfigStore.getState().setAddress("127.0.0.1");
      expect(useProxyConfigStore.getState().address).toBe("127.0.0.1");
    });

    it("persists config after setting address", async () => {
      mockReadConfig.mockResolvedValue({
        dataDir: "/test/data",
        proxy: { enabled: false, address: "", port: "" },
      });

      useProxyConfigStore.getState().setAddress("192.168.1.1");

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockWriteConfig).toHaveBeenCalledWith({
        dataDir: "/test/data",
        proxy: { enabled: false, address: "192.168.1.1", port: "" },
      });
    });
  });

  // -- setPort -------------------------------------------------------------

  describe("setPort", () => {
    it("sets the port", () => {
      useProxyConfigStore.getState().setPort("8080");
      expect(useProxyConfigStore.getState().port).toBe("8080");
    });

    it("persists config after setting port", async () => {
      mockReadConfig.mockResolvedValue({
        dataDir: "/test/data",
        proxy: { enabled: false, address: "", port: "" },
      });

      useProxyConfigStore.getState().setPort("3128");

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockWriteConfig).toHaveBeenCalledWith({
        dataDir: "/test/data",
        proxy: { enabled: false, address: "", port: "3128" },
      });
    });
  });

  // -- loadConfig ----------------------------------------------------------

  describe("loadConfig", () => {
    it("loads proxy config from disk", async () => {
      mockReadConfig.mockResolvedValue({
        dataDir: "/test/data",
        proxy: { enabled: true, address: "127.0.0.1", port: "8080" },
      });

      await useProxyConfigStore.getState().loadConfig();

      const state = useProxyConfigStore.getState();
      expect(state.isLoaded).toBe(true);
      expect(state.enabled).toBe(true);
      expect(state.address).toBe("127.0.0.1");
      expect(state.port).toBe("8080");
    });

    it("uses defaults when config file does not exist", async () => {
      mockReadConfig.mockResolvedValue(null);

      await useProxyConfigStore.getState().loadConfig();

      const state = useProxyConfigStore.getState();
      expect(state.isLoaded).toBe(true);
      expect(state.enabled).toBe(false);
      expect(state.address).toBe("");
      expect(state.port).toBe("");
    });

    it("sets isLoaded even on error", async () => {
      mockReadConfig.mockRejectedValue(new Error("disk error"));

      await useProxyConfigStore.getState().loadConfig();

      expect(useProxyConfigStore.getState().isLoaded).toBe(true);
    });

    it("merges with defaults for missing proxy fields (backward compatibility)", async () => {
      // Simulate a config file written before proxy support (no proxy field)
      const partialConfig = {
        dataDir: "/test/data",
        // proxy field missing entirely
      };

      mockReadConfig.mockResolvedValue(partialConfig);

      await useProxyConfigStore.getState().loadConfig();

      const state = useProxyConfigStore.getState();
      expect(state.isLoaded).toBe(true);
      // Should fall back to defaults — readConfig merges defaults in config.ts
      expect(state.enabled).toBe(false);
      expect(state.address).toBe("");
      expect(state.port).toBe("");
    });

    it("loads config when readConfig returns partially merged proxy (backward compat)", async () => {
      // readConfig (config.ts) already merges { ...DEFAULT_CONFIG.proxy, ...parsed.proxy }
      // so by the time the store sees it, missing fields are filled with defaults.
      const mergedConfig = {
        dataDir: "/test/data",
        proxy: {
          enabled: true,
          address: "", // filled by readConfig's merge
          port: "", // filled by readConfig's merge
        },
      };

      mockReadConfig.mockResolvedValue(mergedConfig);

      await useProxyConfigStore.getState().loadConfig();

      const state = useProxyConfigStore.getState();
      expect(state.isLoaded).toBe(true);
      expect(state.enabled).toBe(true);
      expect(state.address).toBe("");
      expect(state.port).toBe("");
    });
  });

  // -- persist failure handling --------------------------------------------

  describe("persist failure handling", () => {
    it("does not throw when readConfig fails during setEnabled", async () => {
      mockReadConfig.mockRejectedValue(new Error("read error"));

      expect(() => {
        useProxyConfigStore.getState().setEnabled(true);
      }).not.toThrow();

      // State should still be updated
      expect(useProxyConfigStore.getState().enabled).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    it("does not throw when writeConfig fails during setEnabled", async () => {
      mockReadConfig.mockResolvedValue({
        dataDir: "/test/data",
        proxy: { enabled: false, address: "", port: "" },
      });
      mockWriteConfig.mockRejectedValue(new Error("write error"));

      expect(() => {
        useProxyConfigStore.getState().setEnabled(true);
      }).not.toThrow();

      expect(useProxyConfigStore.getState().enabled).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });
});
