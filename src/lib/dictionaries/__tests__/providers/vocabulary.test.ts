/**
 * Tests for Vocabulary.com dictionary provider.
 *
 * Covers:
 * - Happy path: word found with both short and long definitions
 * - Partial result: word found with only short definition
 * - Not found: HTML without .short element
 * - Network error: fetch rejects
 * - URL encoding: correct URL construction for special characters
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { search, getDefaultConfig } from "../../providers/vocabulary";
import { DictionaryError } from "../../errors";
import type { DictionaryConfig } from "../../types";

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: (...args: unknown[]) => mockFetch(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockHtmlResponse(html: string): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => html,
  } as Response;
}

function mockErrorResponse(status: number, statusText = "Error"): Response {
  return {
    ok: false,
    status,
    statusText,
    text: async () => statusText,
  } as Response;
}

// ---------------------------------------------------------------------------
// Realistic HTML Snippets
// ---------------------------------------------------------------------------

/** Page with both .short and .long definitions */
const FULL_ENTRY_HTML = `
<html><body>
  <div class="short">A quick definition of the word.</div>
  <div class="long">An extended definition providing more detail about the word's usage, history, and nuances.</div>
</body></html>
`;

/** Page with only .short definition (no .long) */
const SHORT_ONLY_HTML = `
<html><body>
  <div class="short">A quick definition only.</div>
</body></html>
`;

/** Page without .short element — word not found */
const NOT_FOUND_HTML = `
<html><body>
  <div class="other">No relevant content here.</div>
</body></html>
`;

// ---------------------------------------------------------------------------
// Default config for tests
// ---------------------------------------------------------------------------

let config: DictionaryConfig;

beforeEach(() => {
  vi.clearAllMocks();
  config = getDefaultConfig();
});

// ===========================================================================
// Tests
// ===========================================================================

describe("Vocabulary.com provider", () => {
  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  describe("happy path", () => {
    it("should return short and long definitions when both are present", async () => {
      mockFetch.mockResolvedValue(mockHtmlResponse(FULL_ENTRY_HTML));

      const result = await search("example", config);

      expect(result.source).toBe("vocabulary");
      expect(result.word).toBe("example");
      expect(result.found).toBe(true);
      expect(result.data.short).toBe("A quick definition of the word.");
      expect(result.data.long).toBe(
        "An extended definition providing more detail about the word's usage, history, and nuances.",
      );
    });

    it("should return correct result structure", async () => {
      mockFetch.mockResolvedValue(mockHtmlResponse(FULL_ENTRY_HTML));

      const result = await search("example", config);

      expect(result).toEqual({
        source: "vocabulary",
        word: "example",
        found: true,
        data: {
          short: "A quick definition of the word.",
          long: "An extended definition providing more detail about the word's usage, history, and nuances.",
        },
      });
    });
  });

  // -------------------------------------------------------------------------
  // Partial result
  // -------------------------------------------------------------------------

  describe("partial result", () => {
    it("should return short only with long as empty string when .long is absent", async () => {
      mockFetch.mockResolvedValue(mockHtmlResponse(SHORT_ONLY_HTML));

      const result = await search("example", config);

      expect(result.found).toBe(true);
      expect(result.data.short).toBe("A quick definition only.");
      expect(result.data.long).toBe("");
    });
  });

  // -------------------------------------------------------------------------
  // Not found
  // -------------------------------------------------------------------------

  describe("not found", () => {
    it("should throw NOT_FOUND when HTML has no .short element", async () => {
      mockFetch.mockResolvedValue(mockHtmlResponse(NOT_FOUND_HTML));

      await expect(search("nonexistent", config)).rejects.toThrow(DictionaryError);

      try {
        await search("nonexistent", config);
      } catch (error) {
        expect(error).toBeInstanceOf(DictionaryError);
        expect((error as DictionaryError).code).toBe("NOT_FOUND");
        expect((error as DictionaryError).source).toBe("vocabulary");
        expect((error as DictionaryError).retryable).toBe(false);
      }
    });

    it("should throw NOT_FOUND when .short is empty", async () => {
      const html = `
        <html><body>
          <div class="short">  </div>
        </body></html>
      `;
      mockFetch.mockResolvedValue(mockHtmlResponse(html));

      await expect(search("empty", config)).rejects.toThrow(DictionaryError);
    });
  });

  // -------------------------------------------------------------------------
  // Network error
  // -------------------------------------------------------------------------

  describe("network error", () => {
    it("should throw FETCH_FAILED when fetch rejects with an error", async () => {
      mockFetch.mockRejectedValue(new Error("Network connection failed"));

      await expect(search("hello", config)).rejects.toThrow(DictionaryError);

      try {
        await search("hello", config);
      } catch (error) {
        expect(error).toBeInstanceOf(DictionaryError);
        expect((error as DictionaryError).code).toBe("FETCH_FAILED");
        expect((error as DictionaryError).source).toBe("vocabulary");
        expect((error as DictionaryError).message).toContain("Network connection failed");
        expect((error as DictionaryError).retryable).toBe(true);
      }
    });

    it("should throw FETCH_FAILED when response is non-OK", async () => {
      mockFetch.mockResolvedValue(mockErrorResponse(404, "Not Found"));

      try {
        await search("hello", config);
      } catch (error) {
        expect(error).toBeInstanceOf(DictionaryError);
        expect((error as DictionaryError).code).toBe("FETCH_FAILED");
        expect((error as DictionaryError).source).toBe("vocabulary");
        expect((error as DictionaryError).retryable).toBe(true);
      }
    });

    it("should throw FETCH_FAILED when response.text() fails", async () => {
      const badResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => {
          throw new Error("Body read error");
        },
      } as unknown as Response;
      mockFetch.mockResolvedValue(badResponse);

      await expect(search("hello", config)).rejects.toThrow(DictionaryError);

      try {
        await search("hello", config);
      } catch (error) {
        expect(error).toBeInstanceOf(DictionaryError);
        expect((error as DictionaryError).code).toBe("FETCH_FAILED");
        expect((error as DictionaryError).retryable).toBe(true);
      }
    });

    it("should handle non-Error thrown by fetch", async () => {
      mockFetch.mockRejectedValue("some string error");

      try {
        await search("hello", config);
      } catch (error) {
        expect(error).toBeInstanceOf(DictionaryError);
        expect((error as DictionaryError).code).toBe("FETCH_FAILED");
        expect((error as DictionaryError).retryable).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // URL encoding
  // -------------------------------------------------------------------------

  describe("URL encoding", () => {
    it("should construct correct URL for simple word", async () => {
      mockFetch.mockResolvedValue(mockHtmlResponse(FULL_ENTRY_HTML));

      await search("hello", config);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://www.vocabulary.com/dictionary/hello");
    });

    it("should URL-encode spaces in multi-word queries", async () => {
      mockFetch.mockResolvedValue(mockHtmlResponse(FULL_ENTRY_HTML));

      await search("ice cream", config);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://www.vocabulary.com/dictionary/ice%20cream");
    });

    it("should URL-encode special characters", async () => {
      mockFetch.mockResolvedValue(mockHtmlResponse(FULL_ENTRY_HTML));

      await search("fish & chips", config);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://www.vocabulary.com/dictionary/fish%20%26%20chips");
    });

    it("should normalize multiple spaces before encoding", async () => {
      mockFetch.mockResolvedValue(mockHtmlResponse(FULL_ENTRY_HTML));

      await search("ice   cream", config);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://www.vocabulary.com/dictionary/ice%20cream");
    });
  });

  // -------------------------------------------------------------------------
  // getDefaultConfig()
  // -------------------------------------------------------------------------

  describe("getDefaultConfig()", () => {
    it("should return correct default configuration", () => {
      const defaultConfig = getDefaultConfig();

      expect(defaultConfig.id).toBe("vocabulary");
      expect(defaultConfig.name).toBe("Vocabulary.com");
      expect(defaultConfig.enabled).toBe(true);
      expect(defaultConfig.timeout).toBe(10_000);
    });
  });

  // -------------------------------------------------------------------------
  // Pass-through word
  // -------------------------------------------------------------------------

  describe("pass-through word", () => {
    it("should pass word through correctly in result", async () => {
      mockFetch.mockResolvedValue(mockHtmlResponse(FULL_ENTRY_HTML));

      const result = await search("test-word", config);

      expect(result.word).toBe("test-word");
    });
  });
});
