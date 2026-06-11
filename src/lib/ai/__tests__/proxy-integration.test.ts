/**
 * @vitest-environment node
 *
 * Integration tests for proxy fetch injection into AI provider.
 * Verifies that:
 * - createProvider injects proxy fetch from store
 * - testConnection uses proxy-aware fetch
 * - Proxy config changes take effect immediately on next call
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AIProvider } from "../types";
import type { TranslationRequest } from "../service";

// --- Mocks ---

const mockCreateProxyFetch = vi.fn();
const mockGetState = vi.fn();

vi.mock("@/lib/proxy/fetch", () => ({
  createProxyFetch: (...args: unknown[]) => mockCreateProxyFetch(...args),
}));

vi.mock("@/stores/useProxyConfigStore", () => ({
  useProxyConfigStore: {
    getState: (...args: unknown[]) => mockGetState(...args),
  },
}));

const mockCreateOpenAICompatible = vi.fn();
const mockChatModel = vi.fn();
const mockGenerateText = vi.fn();

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: (...args: unknown[]) =>
    mockCreateOpenAICompatible(...args),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateText: (...args: unknown[]) => mockGenerateText(...args),
  };
});

// Import AFTER mocks
import { OpenAIProvider } from "../providers/openai";

// --- Fixtures ---

const mockProvider: AIProvider = {
  id: "test-openai",
  name: "Test OpenAI",
  type: "openai",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "sk-test-key",
  model: "gpt-4o",
  maxTokens: 4096,
  temperature: 0.7,
  enabled: true,
};

const mockTranslationRequest: TranslationRequest = {
  text: "Hello world",
  context: "A greeting",
  targetLanguage: "Chinese",
  systemMessage: "You are a professional translator.",
  userMessage: "Translate: Hello world",
};

// --- Tests ---

describe("AI proxy integration", () => {
  let provider: OpenAIProvider;
  const mockProxyFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenAIProvider();

    // Default: proxy disabled
    mockGetState.mockReturnValue({
      enabled: false,
      address: "",
      port: "",
    });
    mockCreateProxyFetch.mockReturnValue(mockProxyFetch);
    mockChatModel.mockReturnValue("mock-model");
    mockCreateOpenAICompatible.mockReturnValue({
      chatModel: mockChatModel,
    });
  });

  // =========================================================================
  // createProvider — proxy fetch injection
  // =========================================================================
  describe("createProvider() — proxy fetch injection", () => {
    it("should call useProxyConfigStore.getState() on each translate call", async () => {
      mockGenerateText.mockResolvedValue({ text: "translated" });

      await provider.translate(mockTranslationRequest, mockProvider);

      expect(mockGetState).toHaveBeenCalledTimes(1);
      expect(mockGetState).toHaveBeenCalledWith();
    });

    it("should pass { enabled, address, port } to createProxyFetch", async () => {
      mockGetState.mockReturnValue({
        enabled: true,
        address: "proxy.corp.net",
        port: "3128",
      });
      mockGenerateText.mockResolvedValue({ text: "translated" });

      await provider.translate(mockTranslationRequest, mockProvider);

      expect(mockCreateProxyFetch).toHaveBeenCalledWith({
        enabled: true,
        address: "proxy.corp.net",
        port: "3128",
      });
    });

    it("should pass the proxy fetch function to createOpenAICompatible", async () => {
      mockGetState.mockReturnValue({
        enabled: true,
        address: "10.0.0.1",
        port: "8080",
      });
      mockGenerateText.mockResolvedValue({ text: "translated" });

      await provider.translate(mockTranslationRequest, mockProvider);

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
        expect.objectContaining({
          fetch: mockProxyFetch,
        }),
      );
    });

    it("should still create a fetch even when proxy is disabled", async () => {
      mockGetState.mockReturnValue({
        enabled: false,
        address: "",
        port: "",
      });
      mockGenerateText.mockResolvedValue({ text: "translated" });

      await provider.translate(mockTranslationRequest, mockProvider);

      // createProxyFetch is always called (it decides internally whether to proxy)
      expect(mockCreateProxyFetch).toHaveBeenCalledTimes(1);
      expect(mockCreateProxyFetch).toHaveBeenCalledWith({
        enabled: false,
        address: "",
        port: "",
      });
    });

    it("should pass provider config along with fetch to createOpenAICompatible", async () => {
      mockGenerateText.mockResolvedValue({ text: "translated" });

      await provider.translate(mockTranslationRequest, mockProvider);

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test OpenAI",
          baseURL: "https://api.openai.com/v1",
          apiKey: "sk-test-key",
          fetch: mockProxyFetch,
        }),
      );
    });
  });

  // =========================================================================
  // testConnection — proxy-aware fetch
  // =========================================================================
  describe("testConnection() — proxy-aware fetch", () => {
    it("should read proxy config from store", async () => {
      mockProxyFetch.mockResolvedValue({ ok: true } as Response);

      await provider.testConnection(mockProvider);

      expect(mockGetState).toHaveBeenCalledTimes(1);
    });

    it("should create proxy fetch with store config", async () => {
      mockGetState.mockReturnValue({
        enabled: true,
        address: "proxy.local",
        port: "8080",
      });
      mockProxyFetch.mockResolvedValue({ ok: true } as Response);

      await provider.testConnection(mockProvider);

      expect(mockCreateProxyFetch).toHaveBeenCalledWith({
        enabled: true,
        address: "proxy.local",
        port: "8080",
      });
    });

    it("should call proxy fetch with /models endpoint and auth header", async () => {
      mockGetState.mockReturnValue({
        enabled: true,
        address: "proxy.local",
        port: "8080",
      });
      mockProxyFetch.mockResolvedValue({ ok: true } as Response);

      const result = await provider.testConnection(mockProvider);

      expect(result).toBe(true);
      expect(mockProxyFetch).toHaveBeenCalledWith(
        "https://api.openai.com/v1/models",
        {
          headers: {
            Authorization: "Bearer sk-test-key",
          },
        },
      );
    });

    it("should return true when proxy fetch returns ok", async () => {
      mockProxyFetch.mockResolvedValue({ ok: true, status: 200 } as Response);

      const result = await provider.testConnection(mockProvider);

      expect(result).toBe(true);
    });

    it("should return false when proxy fetch returns non-ok", async () => {
      mockProxyFetch.mockResolvedValue({ ok: false, status: 401 } as Response);

      const result = await provider.testConnection(mockProvider);

      expect(result).toBe(false);
    });

    it("should return false when proxy fetch throws (unreachable proxy)", async () => {
      mockGetState.mockReturnValue({
        enabled: true,
        address: "unreachable",
        port: "9999",
      });
      mockProxyFetch.mockRejectedValue(new Error("ECONNREFUSED"));

      const result = await provider.testConnection(mockProvider);

      expect(result).toBe(false);
    });

    it("should use proxy fetch even when proxy is disabled", async () => {
      mockGetState.mockReturnValue({
        enabled: false,
        address: "",
        port: "",
      });
      mockProxyFetch.mockResolvedValue({ ok: true } as Response);

      await provider.testConnection(mockProvider);

      // createProxyFetch is always called; disabled proxy just passes through
      expect(mockCreateProxyFetch).toHaveBeenCalledWith({
        enabled: false,
        address: "",
        port: "",
      });
    });
  });

  // =========================================================================
  // Proxy config changes — immediate effect
  // =========================================================================
  describe("proxy config changes — immediate effect", () => {
    it("should use new proxy config on next translate call after store change", async () => {
      mockGenerateText.mockResolvedValue({ text: "translated" });

      // First call: no proxy
      mockGetState.mockReturnValue({
        enabled: false,
        address: "",
        port: "",
      });

      await provider.translate(mockTranslationRequest, mockProvider);

      expect(mockCreateProxyFetch).toHaveBeenLastCalledWith({
        enabled: false,
        address: "",
        port: "",
      });

      // Change store: enable proxy
      mockGetState.mockReturnValue({
        enabled: true,
        address: "new-proxy.io",
        port: "443",
      });

      await provider.translate(mockTranslationRequest, mockProvider);

      expect(mockCreateProxyFetch).toHaveBeenLastCalledWith({
        enabled: true,
        address: "new-proxy.io",
        port: "443",
      });
      expect(mockCreateProxyFetch).toHaveBeenCalledTimes(2);
    });

    it("should use new proxy config on next testConnection after store change", async () => {
      mockProxyFetch.mockResolvedValue({ ok: true } as Response);

      // First call: proxy disabled
      mockGetState.mockReturnValue({
        enabled: false,
        address: "",
        port: "",
      });

      await provider.testConnection(mockProvider);

      expect(mockCreateProxyFetch).toHaveBeenLastCalledWith({
        enabled: false,
        address: "",
        port: "",
      });

      // Change store: enable proxy
      mockGetState.mockReturnValue({
        enabled: true,
        address: "corporate-proxy",
        port: "8080",
      });

      await provider.testConnection(mockProvider);

      expect(mockCreateProxyFetch).toHaveBeenLastCalledWith({
        enabled: true,
        address: "corporate-proxy",
        port: "8080",
      });
    });

    it("should reflect address change between translate and testConnection", async () => {
      mockGenerateText.mockResolvedValue({ text: "translated" });
      mockProxyFetch.mockResolvedValue({ ok: true } as Response);

      // translate() with proxy A
      mockGetState.mockReturnValue({
        enabled: true,
        address: "proxy-a.local",
        port: "3128",
      });

      await provider.translate(mockTranslationRequest, mockProvider);

      expect(mockCreateProxyFetch).toHaveBeenLastCalledWith({
        enabled: true,
        address: "proxy-a.local",
        port: "3128",
      });

      // testConnection() with proxy B
      mockGetState.mockReturnValue({
        enabled: true,
        address: "proxy-b.local",
        port: "9090",
      });

      await provider.testConnection(mockProvider);

      expect(mockCreateProxyFetch).toHaveBeenLastCalledWith({
        enabled: true,
        address: "proxy-b.local",
        port: "9090",
      });
    });

    it("should create new proxy fetch instance on each call (no caching)", async () => {
      const fetchA = vi.fn();
      const fetchB = vi.fn();

      mockGenerateText.mockResolvedValue({ text: "translated" });

      // First call returns fetchA
      mockGetState.mockReturnValue({
        enabled: true,
        address: "proxy-a",
        port: "8080",
      });
      mockCreateProxyFetch.mockReturnValueOnce(fetchA);

      await provider.translate(mockTranslationRequest, mockProvider);

      expect(mockCreateOpenAICompatible).toHaveBeenLastCalledWith(
        expect.objectContaining({ fetch: fetchA }),
      );

      // Second call returns fetchB (different config)
      mockGetState.mockReturnValue({
        enabled: true,
        address: "proxy-b",
        port: "9090",
      });
      mockCreateProxyFetch.mockReturnValueOnce(fetchB);

      await provider.translate(mockTranslationRequest, mockProvider);

      expect(mockCreateOpenAICompatible).toHaveBeenLastCalledWith(
        expect.objectContaining({ fetch: fetchB }),
      );

      // Two separate fetch instances created
      expect(fetchA).not.toBe(fetchB);
    });
  });
});
