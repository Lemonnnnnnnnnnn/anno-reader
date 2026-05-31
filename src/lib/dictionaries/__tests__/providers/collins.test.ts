/**
 * Tests for Collins COBUILD dictionary provider.
 *
 * Covers:
 * - Primary source success (English page)
 * - Secondary source fallback (Chinese-English page)
 * - cibaFirst option (reversed source order)
 * - Section parsing (data-type-block, definitions, examples, register)
 * - Skipped sections (Video, Trends)
 * - Error handling (NOT_FOUND, network errors, 403 Cloudflare)
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { search, getDefaultConfig } from "../../providers/collins";
import { DictionaryError } from "../../errors";
import type { DictionaryConfig } from "../../types";

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// HTML Templates
// ---------------------------------------------------------------------------

/** Minimal Collins page with a single definition section */
function singleSectionHTML(word: string): string {
  return `
    <html><body>
      <div data-type-block="English">
        <span class="pron">/${word}ˈfoʊ/</span>
        <span class="pos">noun</span>
        <div class="sense">
          <span class="def">a word used as an example</span>
          <div class="examples"><span class="cit"><span class="quote">this is an ${word} example</span></span></div>
        </div>
      </div>
    </body></html>
  `;
}

/** Collins page with multiple sections and register labels */
function multiSectionHTML(): string {
  return `
    <html><body>
      <div data-type-block="English">
        <span class="pos">noun</span>
        <div class="sense">
          <span class="def">a salutation or greeting</span>
          <span class="labels"><span class="usage-label">(informal)</span></span>
          <div class="examples"><span class="cit"><span class="quote">hello there, Katie!</span></span></div>
        </div>
        <div class="sense">
          <span class="def">an exclamation of surprise</span>
        </div>
      </div>
      <div data-type-block="American">
        <span class="pron">/həˈloʊ/</span>
        <span class="pos">exclamation</span>
        <div class="sense">
          <span class="def">used as a greeting</span>
          <div class="examples"><span class="cit"><span class="quote">hello, how are you?</span></span></div>
        </div>
      </div>
    </body></html>
  `;
}

/** Collins page with Video and Trends sections that should be skipped */
function withSkippedSectionsHTML(): string {
  return `
    <html><body>
      <div data-type-block="Video">
        <div class="sense"><span class="def">video content should be skipped</span></div>
      </div>
      <div data-type-block="English">
        <span class="pos">noun</span>
        <div class="sense">
          <span class="def">a real definition</span>
        </div>
      </div>
      <div data-type-block="Trends">
        <div class="sense"><span class="def">trends content should be skipped</span></div>
      </div>
      <div data-type-block="英语词汇表">
        <div class="sense"><span class="def">Chinese vocab list should be skipped</span></div>
      </div>
      <div data-type-block="趋势">
        <div class="sense"><span class="def">Chinese trends should be skipped</span></div>
      </div>
    </body></html>
  `;
}

/** Empty Collins page — no definition sections at all */
function emptyHTML(): string {
  return `
    <html><body>
      <div class="no-results">No results found</div>
    </body></html>
  `;
}

/** Collins page with fallback to .content when no .sense blocks exist */
function fallbackContentHTML(): string {
  return `
    <html><body>
      <div data-type-block="English">
        <span class="pos">verb</span>
        <div class="content">
          <span class="pron">/test/</span>
          <span class="pos">verb</span>
          to carry out a test
        </div>
      </div>
    </body></html>
  `;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockResponseOk(html: string): Response {
  return {
    ok: true,
    status: 200,
    text: async () => html,
    json: async () => ({}),
  } as unknown as Response;
}

function mockResponseError(status: number): Response {
  return {
    ok: false,
    status,
    text: async () => `HTTP ${status}`,
    json: async () => ({ error: `HTTP ${status}` }),
  } as unknown as Response;
}

function makeConfig(options?: Record<string, unknown>): DictionaryConfig {
  return {
    ...getDefaultConfig(),
    ...(options && { options }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Collins provider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // =========================================================================
  // Primary source success
  // =========================================================================

  describe("primary source success", () => {
    it("should fetch from English page and return parsed sections", async () => {
      mockFetch.mockResolvedValue(mockResponseOk(singleSectionHTML("test")));

      const result = await search("test", makeConfig());

      expect(result.source).toBe("collins");
      expect(result.word).toBe("test");
      expect(result.found).toBe(true);
      expect(result.data.sections).toHaveLength(1);
      expect(result.data.sections[0].definition).toBe(
        "a word used as an example",
      );
    });

    it("should call fetch with correct English URL", async () => {
      mockFetch.mockResolvedValue(mockResponseOk(singleSectionHTML("hello")));

      await search("hello", makeConfig());

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe(
        "https://www.collinsdictionary.com/dictionary/english/hello",
      );
    });

    it("should encode multi-word queries with hyphens", async () => {
      mockFetch.mockResolvedValue(mockResponseOk(singleSectionHTML("ice-cream")));

      await search("ice cream", makeConfig());

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe(
        "https://www.collinsdictionary.com/dictionary/english/ice-cream",
      );
    });

    it("should trim whitespace from word before encoding", async () => {
      mockFetch.mockResolvedValue(mockResponseOk(singleSectionHTML("test")));

      await search("  test  ", makeConfig());

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe(
        "https://www.collinsdictionary.com/dictionary/english/test",
      );
    });
  });

  // =========================================================================
  // Secondary source fallback
  // =========================================================================

  describe("secondary source fallback", () => {
    it("should fall back to Chinese-English page when primary fails", async () => {
      // First call (English) returns 403, second call (Chinese-English) succeeds
      mockFetch
        .mockResolvedValueOnce(mockResponseError(403))
        .mockResolvedValueOnce(mockResponseOk(singleSectionHTML("hello")));

      const result = await search("hello", makeConfig());

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.found).toBe(true);
      expect(result.data.sections).toHaveLength(1);

      // Verify second call was to Chinese-English URL
      const [fallbackUrl] = mockFetch.mock.calls[1];
      expect(fallbackUrl).toBe(
        "https://www.collinsdictionary.com/zh/dictionary/english/hello",
      );
    });

    it("should fall back when primary throws network error", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(mockResponseOk(singleSectionHTML("test")));

      const result = await search("test", makeConfig());

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.found).toBe(true);
    });

    it("should throw NOT_FOUND immediately when primary returns empty page", async () => {
      mockFetch.mockResolvedValue(mockResponseOk(emptyHTML()));

      await expect(search("xyznonexistent", makeConfig())).rejects.toThrow(
        DictionaryError,
      );

      // NOT_FOUND should not try fallback source
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should throw FETCH_FAILED when both sources fail", async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponseError(403))
        .mockResolvedValueOnce(mockResponseError(403));

      await expect(search("test", makeConfig())).rejects.toThrow(
        DictionaryError,
      );

      try {
        await search("test", makeConfig());
      } catch (error) {
        expect(error).toBeInstanceOf(DictionaryError);
        expect((error as DictionaryError).code).toBe("FETCH_FAILED");
      }
    });

    it("should throw last DictionaryError when both sources return HTTP errors", async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponseError(500))
        .mockResolvedValueOnce(mockResponseError(502));

      try {
        await search("test", makeConfig());
      } catch (error) {
        expect(error).toBeInstanceOf(DictionaryError);
        expect((error as DictionaryError).code).toBe("FETCH_FAILED");
        expect((error as DictionaryError).message).toContain("502");
      }
    });
  });

  // =========================================================================
  // cibaFirst option
  // =========================================================================

  describe("cibaFirst option", () => {
    it("should try Chinese-English page first when cibaFirst is true", async () => {
      mockFetch.mockResolvedValue(mockResponseOk(singleSectionHTML("hello")));

      await search("hello", makeConfig({ cibaFirst: true }));

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe(
        "https://www.collinsdictionary.com/zh/dictionary/english/hello",
      );
    });

    it("should fall back to English page when cibaFirst primary fails", async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponseError(403))
        .mockResolvedValueOnce(mockResponseOk(singleSectionHTML("hello")));

      const result = await search("hello", makeConfig({ cibaFirst: true }));

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.found).toBe(true);

      // First call was Chinese-English (cibaFirst)
      expect(mockFetch.mock.calls[0][0]).toBe(
        "https://www.collinsdictionary.com/zh/dictionary/english/hello",
      );
      // Second call was English (fallback)
      expect(mockFetch.mock.calls[1][0]).toBe(
        "https://www.collinsdictionary.com/dictionary/english/hello",
      );
    });

    it("should default to cibaFirst false when not specified", async () => {
      mockFetch.mockResolvedValue(mockResponseOk(singleSectionHTML("test")));

      await search("test", makeConfig());

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/dictionary/english/");
      expect(url).not.toContain("/zh/");
    });
  });

  // =========================================================================
  // Section parsing
  // =========================================================================

  describe("section parsing", () => {
    it("should extract definition from .sense > .def", async () => {
      mockFetch.mockResolvedValue(mockResponseOk(singleSectionHTML("test")));

      const result = await search("test", makeConfig());

      expect(result.data.sections[0].definition).toBe(
        "a word used as an example",
      );
    });

    it("should extract example from .examples .cit .quote", async () => {
      mockFetch.mockResolvedValue(mockResponseOk(singleSectionHTML("test")));

      const result = await search("test", makeConfig());

      expect(result.data.sections[0].example).toBe(
        "this is an test example",
      );
    });

    it("should extract register from .labels .usage-label", async () => {
      mockFetch.mockResolvedValue(mockResponseOk(multiSectionHTML()));

      const result = await search("hello", makeConfig());

      expect(result.data.sections[0].register).toBe("informal");
    });

    it("should extract part of speech", async () => {
      mockFetch.mockResolvedValue(mockResponseOk(multiSectionHTML()));

      const result = await search("hello", makeConfig());

      expect(result.data.sections[0].partOfSpeech).toBe("noun");
    });

    it("should parse multiple sections from a single page", async () => {
      mockFetch.mockResolvedValue(mockResponseOk(multiSectionHTML()));

      const result = await search("hello", makeConfig());

      // 3 definitions total: 2 from "English" section, 1 from "American"
      expect(result.data.sections).toHaveLength(3);
      expect(result.data.sections[0].definition).toBe(
        "a salutation or greeting",
      );
      expect(result.data.sections[1].definition).toBe(
        "an exclamation of surprise",
      );
      expect(result.data.sections[2].definition).toBe("used as a greeting");
    });

    it("should handle sections without example or register", async () => {
      mockFetch.mockResolvedValue(mockResponseOk(multiSectionHTML()));

      const result = await search("hello", makeConfig());

      // Second sense has no example or register
      expect(result.data.sections[1].example).toBeUndefined();
      expect(result.data.sections[1].register).toBeUndefined();
    });

    it("should strip brackets from register labels", async () => {
      const html = `
        <html><body>
          <div data-type-block="English">
            <span class="pos">adjective</span>
            <div class="sense">
              <span class="def">relating to formality</span>
              <span class="labels"><span class="usage-label">(formal)</span></span>
            </div>
          </div>
        </body></html>
      `;
      mockFetch.mockResolvedValue(mockResponseOk(html));

      const result = await search("formal", makeConfig());

      expect(result.data.sections[0].register).toBe("formal");
    });

    it("should use fallback .content extraction when no .sense blocks exist", async () => {
      mockFetch.mockResolvedValue(mockResponseOk(fallbackContentHTML()));

      const result = await search("test", makeConfig());

      expect(result.data.sections).toHaveLength(1);
      expect(result.data.sections[0].definition).toContain(
        "to carry out a test",
      );
    });
  });

  // =========================================================================
  // Skipped sections
  // =========================================================================

  describe("skipped sections", () => {
    it("should skip Video sections", async () => {
      mockFetch.mockResolvedValue(
        mockResponseOk(withSkippedSectionsHTML()),
      );

      const result = await search("test", makeConfig());

      // Only the "English" section should be parsed
      expect(result.data.sections).toHaveLength(1);
      expect(result.data.sections[0].definition).toBe("a real definition");
    });

    it("should skip Trends sections", async () => {
      const html = `
        <html><body>
          <div data-type-block="Trends">
            <div class="sense"><span class="def">trend data</span></div>
          </div>
          <div data-type-block="English">
            <span class="pos">noun</span>
            <div class="sense"><span class="def">actual definition</span></div>
          </div>
        </body></html>
      `;
      mockFetch.mockResolvedValue(mockResponseOk(html));

      const result = await search("test", makeConfig());

      expect(result.data.sections).toHaveLength(1);
      expect(result.data.sections[0].definition).toBe("actual definition");
    });

    it("should skip Chinese vocabulary list sections (英语词汇表)", async () => {
      const html = `
        <html><body>
          <div data-type-block="英语词汇表">
            <div class="sense"><span class="def">vocab list entry</span></div>
          </div>
          <div data-type-block="English">
            <span class="pos">noun</span>
            <div class="sense"><span class="def">real definition</span></div>
          </div>
        </body></html>
      `;
      mockFetch.mockResolvedValue(mockResponseOk(html));

      const result = await search("test", makeConfig());

      expect(result.data.sections).toHaveLength(1);
    });

    it("should skip Chinese trends sections (趋势)", async () => {
      const html = `
        <html><body>
          <div data-type-block="趋势">
            <div class="sense"><span class="def">趋势内容</span></div>
          </div>
          <div data-type-block="English">
            <span class="pos">noun</span>
            <div class="sense"><span class="def">actual definition</span></div>
          </div>
        </body></html>
      `;
      mockFetch.mockResolvedValue(mockResponseOk(html));

      const result = await search("test", makeConfig());

      expect(result.data.sections).toHaveLength(1);
    });

    it("should skip sections with empty data-type-block", async () => {
      const html = `
        <html><body>
          <div data-type-block="">
            <div class="sense"><span class="def">should be skipped</span></div>
          </div>
          <div data-type-block="English">
            <span class="pos">noun</span>
            <div class="sense"><span class="def">real definition</span></div>
          </div>
        </body></html>
      `;
      mockFetch.mockResolvedValue(mockResponseOk(html));

      const result = await search("test", makeConfig());

      expect(result.data.sections).toHaveLength(1);
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  describe("error handling", () => {
    it("should throw DictionaryError with NOT_FOUND when page has no sections", async () => {
      mockFetch.mockResolvedValue(mockResponseOk(emptyHTML()));

      await expect(search("xyznonexistent", makeConfig())).rejects.toThrow(
        DictionaryError,
      );

      try {
        await search("xyznonexistent", makeConfig());
      } catch (error) {
        expect(error).toBeInstanceOf(DictionaryError);
        expect((error as DictionaryError).code).toBe("NOT_FOUND");
        expect((error as DictionaryError).source).toBe("collins");
        expect((error as DictionaryError).retryable).toBe(false);
      }
    });

    it("should throw NOT_FOUND only once — not try fallback for genuine missing words", async () => {
      mockFetch.mockResolvedValue(mockResponseOk(emptyHTML()));

      try {
        await search("xyznonexistent", makeConfig());
      } catch {
        // Expected
      }

      // Should NOT try fallback — word genuinely doesn't exist
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should throw DictionaryError with FETCH_FAILED on network error", async () => {
      mockFetch.mockRejectedValue(new Error("fetch failed"));

      await expect(search("test", makeConfig())).rejects.toThrow(
        DictionaryError,
      );

      try {
        await search("test", makeConfig());
      } catch (error) {
        expect(error).toBeInstanceOf(DictionaryError);
        expect((error as DictionaryError).code).toBe("FETCH_FAILED");
        expect((error as DictionaryError).source).toBe("collins");
        expect((error as DictionaryError).retryable).toBe(true);
      }
    });

    it("should throw DictionaryError with FETCH_FAILED on 403 Cloudflare", async () => {
      mockFetch.mockResolvedValue(mockResponseError(403));

      await expect(search("test", makeConfig())).rejects.toThrow(
        DictionaryError,
      );

      try {
        await search("test", makeConfig());
      } catch (error) {
        expect(error).toBeInstanceOf(DictionaryError);
        expect((error as DictionaryError).code).toBe("FETCH_FAILED");
        expect((error as DictionaryError).message).toContain("403");
        expect((error as DictionaryError).message).toContain("Cloudflare");
        expect((error as DictionaryError).retryable).toBe(true);
      }
    });

    it("should throw FETCH_FAILED for 500 server error", async () => {
      mockFetch.mockResolvedValue(mockResponseError(500));

      try {
        await search("test", makeConfig());
      } catch (error) {
        expect(error).toBeInstanceOf(DictionaryError);
        expect((error as DictionaryError).code).toBe("FETCH_FAILED");
        expect((error as DictionaryError).message).toContain("500");
      }
    });

    it("should handle non-Error thrown by fetch", async () => {
      mockFetch.mockRejectedValue("string error");

      try {
        await search("test", makeConfig());
      } catch (error) {
        expect(error).toBeInstanceOf(DictionaryError);
        expect((error as DictionaryError).code).toBe("FETCH_FAILED");
        expect((error as DictionaryError).message).toContain("string error");
      }
    });
  });

  // =========================================================================
  // getDefaultConfig
  // =========================================================================

  describe("getDefaultConfig()", () => {
    it("should return correct default configuration", () => {
      const config = getDefaultConfig();

      expect(config.id).toBe("collins");
      expect(config.name).toBe("Collins COBUILD");
      expect(config.enabled).toBe(true);
      expect(config.timeout).toBe(10_000);
      expect(config.options?.cibaFirst).toBe(false);
    });
  });
});
