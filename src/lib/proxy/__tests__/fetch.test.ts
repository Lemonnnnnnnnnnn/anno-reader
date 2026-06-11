/**
 * Tests for createProxyFetch — proxy-aware fetch wrapper.
 *
 * Comprehensive test suite covering all code paths:
 * - Proxy disabled: returns standard browser fetch
 * - Proxy enabled: returns proxy-aware fetch via tauriFetch
 * - Proxy URL construction: http://address:port
 * - Error handling: tauriFetch failures, non-Error throws
 * - Non-Tauri environment fallback
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ProxyConfig } from "../../storage/config";

// --- Mocks ---

const mockTauriFetch = vi.fn();

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: (...args: unknown[]) => mockTauriFetch(...args),
}));

// Import AFTER vi.mock so it gets the mocked version

import { createProxyFetch } from "../fetch";

// --- Helpers ---

/** Set or clear the Tauri runtime marker on window. */
function setTauriEnvironment(isTauri: boolean) {
  if (isTauri) {
    (window as Record<string, unknown>).__TAURI_INTERNALS__ = {};
  } else {
    delete (window as Record<string, unknown>).__TAURI_INTERNALS__;
  }
}

// --- Fixtures ---

const disabledConfig: ProxyConfig = {
  enabled: false,
  address: "",
  port: "",
};

const disabledWithAddress: ProxyConfig = {
  enabled: false,
  address: "127.0.0.1",
  port: "8080",
};

const enabledConfig: ProxyConfig = {
  enabled: true,
  address: "127.0.0.1",
  port: "8080",
};

const enabledConfigWithHost: ProxyConfig = {
  enabled: true,
  address: "proxy.example.com",
  port: "3128",
};

const emptyEnabledConfig: ProxyConfig = {
  enabled: true,
  address: "",
  port: "",
};

const unreachableProxyConfig: ProxyConfig = {
  enabled: true,
  address: "unreachable.proxy",
  port: "8080",
};

// --- Tests ---

describe("createProxyFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setTauriEnvironment(true);
  });

  afterEach(() => {
    delete (window as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  // =========================================================================
  // Proxy disabled
  // =========================================================================
  describe("proxy disabled", () => {
    it("should return a function (standard browser fetch)", () => {
      const fetchFn = createProxyFetch(disabledConfig);

      expect(typeof fetchFn).toBe("function");
    });

    it("should not call tauriFetch when proxy is disabled", () => {
      createProxyFetch(disabledConfig);

      expect(mockTauriFetch).not.toHaveBeenCalled();
    });

    it("should not route through tauriFetch even with address/port set", () => {
      createProxyFetch(disabledWithAddress);

      expect(mockTauriFetch).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Proxy enabled — non-Tauri environment
  // =========================================================================
  describe("proxy enabled but not in Tauri runtime", () => {
    beforeEach(() => {
      setTauriEnvironment(false);
    });

    it("should fall back to browser fetch with console warning", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const fetchFn = createProxyFetch(enabledConfig);

      expect(typeof fetchFn).toBe("function");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("not running in Tauri"),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("falling back to browser fetch"),
      );

      warnSpy.mockRestore();
    });

    it("should not call tauriFetch when not in Tauri", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});

      createProxyFetch(enabledConfig);

      expect(mockTauriFetch).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Proxy enabled — Tauri runtime
  // =========================================================================
  describe("proxy enabled in Tauri runtime", () => {
    it("should call tauriFetch instead of browser fetch", async () => {
      mockTauriFetch.mockResolvedValue(new Response("proxied"));

      const fetchFn = createProxyFetch(enabledConfig);
      const res = await fetchFn("https://example.com");

      expect(mockTauriFetch).toHaveBeenCalledTimes(1);
      expect(await res.text()).toBe("proxied");
    });

    it("should construct proxy URL as http://address:port", async () => {
      mockTauriFetch.mockResolvedValue(new Response("ok"));

      const fetchFn = createProxyFetch(enabledConfig);
      await fetchFn("https://example.com");

      expect(mockTauriFetch).toHaveBeenCalledWith(
        "https://example.com",
        expect.objectContaining({
          proxy: { all: "http://127.0.0.1:8080" },
        }),
      );
    });

    it("should construct proxy URL with hostname address", async () => {
      mockTauriFetch.mockResolvedValue(new Response("ok"));

      const fetchFn = createProxyFetch(enabledConfigWithHost);
      await fetchFn("https://example.com");

      expect(mockTauriFetch).toHaveBeenCalledWith(
        "https://example.com",
        expect.objectContaining({
          proxy: { all: "http://proxy.example.com:3128" },
        }),
      );
    });

    it("should handle empty address and port in proxy URL", async () => {
      mockTauriFetch.mockResolvedValue(new Response("ok"));

      const fetchFn = createProxyFetch(emptyEnabledConfig);
      await fetchFn("https://example.com");

      expect(mockTauriFetch).toHaveBeenCalledWith(
        "https://example.com",
        expect.objectContaining({
          proxy: { all: "http://:" },
        }),
      );
    });

    it("should forward init options alongside proxy config", async () => {
      mockTauriFetch.mockResolvedValue(new Response("ok"));

      const fetchFn = createProxyFetch(enabledConfig);
      const init: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"key":"value"}',
      };
      await fetchFn("https://api.example.com/chat", init);

      expect(mockTauriFetch).toHaveBeenCalledWith(
        "https://api.example.com/chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: '{"key":"value"}',
          proxy: { all: "http://127.0.0.1:8080" },
        },
      );
    });

    it("should accept URL objects as input", async () => {
      mockTauriFetch.mockResolvedValue(new Response("ok"));

      const fetchFn = createProxyFetch(enabledConfig);
      const url = new URL("https://example.com/path?q=1");
      await fetchFn(url);

      expect(mockTauriFetch).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          proxy: { all: "http://127.0.0.1:8080" },
        }),
      );
    });

    it("should return Response from tauriFetch", async () => {
      const mockResponse = new Response("translated", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
      mockTauriFetch.mockResolvedValue(mockResponse);

      const fetchFn = createProxyFetch(enabledConfig);
      const response = await fetchFn("https://api.example.com/test");

      expect(response).toBe(mockResponse);
      expect(response.status).toBe(200);
    });

    it("should support streaming responses", async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("chunk1"));
          controller.enqueue(new TextEncoder().encode("chunk2"));
          controller.close();
        },
      });
      mockTauriFetch.mockResolvedValue(
        new Response(stream, { status: 200 }),
      );

      const fetchFn = createProxyFetch(enabledConfig);
      const response = await fetchFn("https://api.example.com/stream");

      const reader = response.body!.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      expect(chunks).toHaveLength(2);
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================
  describe("error handling", () => {
    it("should wrap tauriFetch errors with proxy URL", async () => {
      mockTauriFetch.mockRejectedValue(new Error("ECONNREFUSED"));

      const fetchFn = createProxyFetch(enabledConfig);

      await expect(
        fetchFn("https://example.com"),
      ).rejects.toThrow(
        "Proxy request failed (http://127.0.0.1:8080): ECONNREFUSED",
      );
    });

    it("should wrap non-Error throws with String conversion", async () => {
      mockTauriFetch.mockRejectedValue("string error");

      const fetchFn = createProxyFetch(enabledConfig);

      await expect(
        fetchFn("https://example.com"),
      ).rejects.toThrow(
        "Proxy request failed (http://127.0.0.1:8080): string error",
      );
    });

    it("should include proxy URL for unreachable proxy", async () => {
      mockTauriFetch.mockRejectedValue(
        new Error("connect EHOSTUNREACH 10.0.0.1:9090"),
      );

      const fetchFn = createProxyFetch({
        enabled: true,
        address: "10.0.0.1",
        port: "9090",
      });

      await expect(
        fetchFn("https://example.com"),
      ).rejects.toThrow(
        "Proxy request failed (http://10.0.0.1:9090)",
      );
    });

    it("should throw an Error instance (not raw value)", async () => {
      mockTauriFetch.mockRejectedValue(new TypeError("Network error"));

      const fetchFn = createProxyFetch(enabledConfig);

      try {
        await fetchFn("https://example.com");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Proxy request failed");
      }
    });
  });
});
