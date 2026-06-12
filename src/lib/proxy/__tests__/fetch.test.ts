/**
 * Tests for createProxyFetch — tauri-aware fetch wrapper.
 *
 * Comprehensive test suite covering all code paths:
 * - Proxy disabled: returns tauriFetch without proxy config
 * - Proxy enabled: returns tauriFetch with proxy config
 * - Proxy URL construction: http://address:port
 * - Error handling: tauriFetch failures
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProxyConfig } from "../../storage/config";

// --- Mocks ---

const mockTauriFetch = vi.fn();

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: (...args: unknown[]) => mockTauriFetch(...args),
}));

// Import AFTER vi.mock so it gets the mocked version

import { createProxyFetch } from "../fetch";

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

// --- Tests ---

describe("createProxyFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Proxy disabled
  // =========================================================================
  describe("proxy disabled", () => {
    it("should return a function", () => {
      const fetchFn = createProxyFetch(disabledConfig);

      expect(typeof fetchFn).toBe("function");
    });

    it("should call tauriFetch without proxy config when disabled", async () => {
      mockTauriFetch.mockResolvedValue(new Response("ok"));

      const fetchFn = createProxyFetch(disabledConfig);
      await fetchFn("https://example.com");

      expect(mockTauriFetch).toHaveBeenCalledTimes(1);
      expect(mockTauriFetch.mock.calls[0][0]).toBe("https://example.com");
    });

    it("should not route through proxy even with address/port set", async () => {
      mockTauriFetch.mockResolvedValue(new Response("ok"));

      const fetchFn = createProxyFetch(disabledWithAddress);
      await fetchFn("https://example.com");

      expect(mockTauriFetch).toHaveBeenCalledTimes(1);
      expect(mockTauriFetch.mock.calls[0][0]).toBe("https://example.com");
    });
  });

  // =========================================================================
  // Proxy enabled
  // =========================================================================
  describe("proxy enabled", () => {
    it("should call tauriFetch with proxy config", async () => {
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
    it("should propagate tauriFetch errors", async () => {
      mockTauriFetch.mockRejectedValue(new Error("ECONNREFUSED"));

      const fetchFn = createProxyFetch(enabledConfig);

      await expect(
        fetchFn("https://example.com"),
      ).rejects.toThrow("ECONNREFUSED");
    });

    it("should propagate non-Error throws", async () => {
      mockTauriFetch.mockRejectedValue("string error");

      const fetchFn = createProxyFetch(enabledConfig);

      await expect(
        fetchFn("https://example.com"),
      ).rejects.toBe("string error");
    });

    it("should propagate errors when proxy is disabled", async () => {
      mockTauriFetch.mockRejectedValue(new Error("Network error"));

      const fetchFn = createProxyFetch(disabledConfig);

      await expect(
        fetchFn("https://example.com"),
      ).rejects.toThrow("Network error");
    });
  });
});
