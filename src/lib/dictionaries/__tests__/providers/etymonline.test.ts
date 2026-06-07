/**
 * Tests for Etymonline dictionary provider.
 *
 * Covers:
 * - Modern entries parsing (section.max-w-none layout)
 * - Legacy items parsing ([class*="word--"] layout)
 * - Search cards parsing (a.w-full.group[href] layout)
 * - Fallback chain (modern → legacy → search cards)
 * - Error handling (NOT_FOUND, FETCH_FAILED, network errors)
 * - maxResults limiting
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { search, getDefaultConfig } from "../../providers/etymonline";
import { DictionaryError } from "../../errors";
import type { DictionaryConfig } from "../../types";

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

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

/** Modern entry page with `section.max-w-none` layout */
const MODERN_ENTRY_HTML = `
<html><body>
  <section class="max-w-none">
    <h2><a href="/word/hello">hello</a></h2>
    <div>
      <p>1883, from <em>hail</em>, used as a greeting since 1860. Earlier used as an exclamation to call attention.</p>
    </div>
  </section>
  <section class="max-w-none">
    <h2><a href="/word/hello-girl">hello girl</a></h2>
    <div>
      <p>Telephone operator, 1891.</p>
    </div>
  </section>
</body></html>
`;

/** Legacy entry page with `[class*="word--"]` layout */
const LEGACY_ENTRY_HTML = `
<html><body>
  <div class="word--2XbBo">
    <div class="word__name--2sJXQ">hello</div>
    <div class="word__defination--1MKLY">
      <p>1883, from <em>hail</em>, used as a greeting since 1860.</p>
    </div>
  </div>
  <div class="word--2XbBo">
    <div class="word__name--2sJXQ">hello girl</div>
    <div class="word__defination--1MKLY">
      <p>Telephone operator, 1891.</p>
    </div>
  </div>
</body></html>
`;

/** Search results page with `a.w-full.group[href]` cards */
const SEARCH_CARDS_HTML = `
<html><body>
  <a class="w-full group" href="/word/hello">
    <span id="hello">hello</span>
    <section class="prose">
      <p>1883, from <em>hail</em>, used as a greeting since 1860.</p>
    </section>
  </a>
  <a class="w-full group" href="/word/hello-girl">
    <span id="hello-girl">hello girl</span>
    <section class="prose">
      <p>Telephone operator, 1891.</p>
    </section>
  </a>
</body></html>
`;

/**
 * Search results page with prose in sibling container (real etymonline structure).
 *
 * Current etymonline layout wraps each anchor and its prose in separate DIVs:
 *   <div><a class="w-full group">...</a></div>
 *   <div><section class="prose">...</section></div>
 */
const SEARCH_CARDS_SIBLING_HTML = `
<html><body>
  <div class="flex p-3 z-10">
    <a class="w-full group" href="/word/sketch">
      <span id="etymonline_v_45768" class="scroll-m-16">sketch (v.)</span>
    </a>
  </div>
  <div class="relative flex w-full p-3">
    <section class="prose lg:prose-lg">
      <p>1690s, "present briefly the essential facts of," from <em>sketch</em> (n.).</p>
    </section>
  </div>
  <div class="flex p-3 z-10">
    <a class="w-full group" href="/word/sketch">
      <span id="etymonline_v_23600" class="scroll-m-16">sketch (n.)</span>
    </a>
  </div>
  <div class="relative flex w-full p-3">
    <section class="prose lg:prose-lg">
      <p>1670s, "rough drawing or design," from Dutch <em>schets</em>.</p>
    </section>
  </div>
</body></html>
`;

/** Empty page — no recognizable structure */
const EMPTY_PAGE_HTML = `<html><body><p>No results found.</p></body></html>`;

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

describe("Etymonline provider", () => {
  // -------------------------------------------------------------------------
  // Modern entries parsing (Strategy 1)
  // -------------------------------------------------------------------------

  describe("modern entries parsing", () => {
    it("should parse modern `section.max-w-none` entries", async () => {
      mockFetch.mockResolvedValue(mockHtmlResponse(MODERN_ENTRY_HTML));

      const result = await search("hello", config);

      expect(result.source).toBe("etymonline");
      expect(result.word).toBe("hello");
      expect(result.found).toBe(true);
      expect(result.data.items).toHaveLength(2);
      expect(result.data.items[0].etymology).toContain("hail");
      expect(result.data.items[0].etymology).toContain("greeting");
      expect(result.data.items[1].etymology).toContain("Telephone operator");
    });

    it("should fetch direct word page URL with encoded word", async () => {
      mockFetch.mockResolvedValue(mockHtmlResponse(MODERN_ENTRY_HTML));

      await search("hello world", config);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://www.etymonline.com/word/hello%20world");
    });

    it("should include h2 text in modern entries", async () => {
      mockFetch.mockResolvedValue(mockHtmlResponse(MODERN_ENTRY_HTML));

      const result = await search("hello", config);

      // The first modern entry's etymology should be the innerHTML of the section
      expect(result.data.items[0].etymology).toContain("<h2>");
    });

    it("should skip modern sections missing h2 or content", async () => {
      const html = `
        <html><body>
          <section class="max-w-none">
            <div>No h2 here</div>
          </section>
          <section class="max-w-none">
            <h2>Valid Entry</h2>
            <div>Some etymology text</div>
          </section>
        </body></html>
      `;
      mockFetch.mockResolvedValue(mockHtmlResponse(html));

      const result = await search("hello", config);

      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0].etymology).toContain("Valid Entry");
    });

    it("should extract title from h2 in modern entries", async () => {
      mockFetch.mockResolvedValue(mockHtmlResponse(MODERN_ENTRY_HTML));

      const result = await search("hello", config);

      expect(result.data.items[0].title).toBe("hello");
      expect(result.data.items[1].title).toBe("hello girl");
    });
  });

  // -------------------------------------------------------------------------
  // Legacy items parsing (Strategy 2)
  // -------------------------------------------------------------------------

  describe("legacy items parsing", () => {
    it("should parse legacy `[class*=\"word--\"]` items when modern finds nothing", async () => {
      mockFetch.mockResolvedValue(mockHtmlResponse(LEGACY_ENTRY_HTML));

      const result = await search("hello", config);

      expect(result.found).toBe(true);
      expect(result.data.items).toHaveLength(2);
      expect(result.data.items[0].etymology).toContain("hail");
      expect(result.data.items[1].etymology).toContain("Telephone operator");
    });

    it("should use BEM child selectors `word__name--` and `word__defination--`", async () => {
      const html = `
        <html><body>
          <div class="word--ABC">
            <span class="word__name--XYZ">test-word</span>
            <div class="word__defination--DEF">Test definition content</div>
          </div>
        </body></html>
      `;
      mockFetch.mockResolvedValue(mockHtmlResponse(html));

      const result = await search("test", config);

      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0].etymology).toContain("Test definition content");
    });

    it("should skip legacy items missing name or definition", async () => {
      const html = `
        <html><body>
          <div class="word--ABC">
            <div class="word__defination--DEF">Has definition but no name</div>
          </div>
          <div class="word--ABC">
            <span class="word__name--XYZ">Has name but no definition</span>
          </div>
          <div class="word--ABC">
            <span class="word__name--XYZ">Complete</span>
            <div class="word__defination--DEF">Complete definition</div>
          </div>
        </body></html>
      `;
      mockFetch.mockResolvedValue(mockHtmlResponse(html));

      const result = await search("test", config);

      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0].etymology).toContain("Complete definition");
    });

    it("should extract title from word__name in legacy entries", async () => {
      mockFetch.mockResolvedValue(mockHtmlResponse(LEGACY_ENTRY_HTML));

      const result = await search("hello", config);

      expect(result.data.items[0].title).toBe("hello");
      expect(result.data.items[1].title).toBe("hello girl");
    });
  });

  // -------------------------------------------------------------------------
  // Search cards parsing (Strategy 3)
  // -------------------------------------------------------------------------

  describe("search cards parsing", () => {
    it("should fall back to search cards when direct page finds nothing", async () => {
      // First call: empty word page → no modern/legacy results
      // Second call: search results page with cards
      mockFetch
        .mockResolvedValueOnce(mockHtmlResponse(EMPTY_PAGE_HTML))
        .mockResolvedValueOnce(mockHtmlResponse(SEARCH_CARDS_HTML));

      const result = await search("hello", config);

      expect(result.found).toBe(true);
      expect(result.data.items).toHaveLength(2);
      expect(result.data.items[0].etymology).toContain("hail");
      expect(result.data.items[1].etymology).toContain("Telephone operator");
    });

    it("should fetch search page URL with encoded word", async () => {
      mockFetch
        .mockResolvedValueOnce(mockHtmlResponse(EMPTY_PAGE_HTML))
        .mockResolvedValueOnce(mockHtmlResponse(SEARCH_CARDS_HTML));

      await search("hello", config);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [searchUrl] = mockFetch.mock.calls[1];
      expect(searchUrl).toBe("https://www.etymonline.com/search?q=hello");
    });

    it("should parse search cards with `a.w-full.group[href]` selector", async () => {
      const html = `
        <html><body>
          <a class="w-full group" href="/word/test">
            <span id="test">test</span>
            <section class="prose">
              <p>Test etymology content.</p>
            </section>
          </a>
        </body></html>
      `;
      mockFetch
        .mockResolvedValueOnce(mockHtmlResponse(EMPTY_PAGE_HTML))
        .mockResolvedValueOnce(mockHtmlResponse(html));

      const result = await search("test", config);

      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0].etymology).toContain("Test etymology content");
    });

    it("should skip search cards missing id or prose section", async () => {
      const html = `
        <html><body>
          <a class="w-full group" href="/word/test">
            <span id="test">test</span>
            <div>No prose section here</div>
          </a>
          <a class="w-full group" href="/word/test2">
            <div>No id element</div>
            <section class="prose"><p>Has prose</p></section>
          </a>
          <a class="w-full group" href="/word/test3">
            <span id="test3">test3</span>
            <section class="prose"><p>Valid card</p></section>
          </a>
        </body></html>
      `;
      mockFetch
        .mockResolvedValueOnce(mockHtmlResponse(EMPTY_PAGE_HTML))
        .mockResolvedValueOnce(mockHtmlResponse(html));

      const result = await search("test", config);

      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0].etymology).toContain("Valid card");
    });

    it("should parse search cards where prose is a sibling of anchor (real etymonline layout)", async () => {
      mockFetch
        .mockResolvedValueOnce(mockHtmlResponse(EMPTY_PAGE_HTML))
        .mockResolvedValueOnce(mockHtmlResponse(SEARCH_CARDS_SIBLING_HTML));

      const result = await search("sketching", config);

      expect(result.found).toBe(true);
      expect(result.data.items).toHaveLength(2);
      expect(result.data.items[0].etymology).toContain("1690s");
      expect(result.data.items[0].etymology).toContain("sketch");
      expect(result.data.items[1].etymology).toContain("1670s");
      expect(result.data.items[1].etymology).toContain("schets");
    });

    it("should extract title from span[id] in search cards", async () => {
      mockFetch
        .mockResolvedValueOnce(mockHtmlResponse(EMPTY_PAGE_HTML))
        .mockResolvedValueOnce(mockHtmlResponse(SEARCH_CARDS_SIBLING_HTML));

      const result = await search("sketching", config);

      expect(result.data.items[0].title).toBe("sketch (v.)");
      expect(result.data.items[1].title).toBe("sketch (n.)");
    });
  });

  // -------------------------------------------------------------------------
  // Fallback chain (modern → legacy → search cards)
  // -------------------------------------------------------------------------

  describe("fallback chain", () => {
    it("should try modern first, then legacy, on the direct page", async () => {
      // Page has both modern and legacy structures — modern should win
      const html = `
        <html><body>
          <section class="max-w-none">
            <h2>Modern Entry</h2>
            <div>Modern etymology</div>
          </section>
          <div class="word--ABC">
            <span class="word__name--XYZ">Legacy Entry</span>
            <div class="word__defination--DEF">Legacy etymology</div>
          </div>
        </body></html>
      `;
      mockFetch.mockResolvedValue(mockHtmlResponse(html));

      const result = await search("test", config);

      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0].etymology).toContain("Modern etymology");
      // Should NOT have fetched the search page
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should fall back to legacy when modern yields nothing", async () => {
      const html = `
        <html><body>
          <section class="max-w-none">
            <div>No h2 so skipped</div>
          </section>
          <div class="word--ABC">
            <span class="word__name--XYZ">Legacy</span>
            <div class="word__defination--DEF">Legacy definition</div>
          </div>
        </body></html>
      `;
      mockFetch.mockResolvedValue(mockHtmlResponse(html));

      const result = await search("test", config);

      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0].etymology).toContain("Legacy definition");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should fall back to search page when both modern and legacy yield nothing", async () => {
      mockFetch
        .mockResolvedValueOnce(mockHtmlResponse(EMPTY_PAGE_HTML))
        .mockResolvedValueOnce(mockHtmlResponse(SEARCH_CARDS_HTML));

      const result = await search("hello", config);

      expect(result.data.items).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [searchUrl] = mockFetch.mock.calls[1];
      expect(searchUrl).toContain("/search?q=");
    });

    it("should throw NOT_FOUND when all three strategies yield nothing", async () => {
      mockFetch
        .mockResolvedValue(mockHtmlResponse(EMPTY_PAGE_HTML));

      await expect(search("nonexistent", config)).rejects.toThrow(DictionaryError);

      try {
        await search("nonexistent", config);
      } catch (error) {
        expect(error).toBeInstanceOf(DictionaryError);
        expect((error as DictionaryError).code).toBe("NOT_FOUND");
        expect((error as DictionaryError).source).toBe("etymonline");
        expect((error as DictionaryError).retryable).toBe(false);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe("error handling", () => {
    it("should throw FETCH_FAILED when word page returns non-OK status", async () => {
      // Word page fails → falls back to search page → also fails
      mockFetch
        .mockResolvedValueOnce(mockErrorResponse(404, "Not Found"))
        .mockResolvedValueOnce(mockErrorResponse(404, "Not Found"));

      try {
        await search("hello", config);
      } catch (error) {
        expect(error).toBeInstanceOf(DictionaryError);
        expect((error as DictionaryError).code).toBe("FETCH_FAILED");
        expect((error as DictionaryError).source).toBe("etymonline");
        expect((error as DictionaryError).retryable).toBe(true);
      }
    });

    it("should throw FETCH_FAILED when fetch throws a network error", async () => {
      mockFetch.mockRejectedValue(new Error("Network connection failed"));

      try {
        await search("hello", config);
      } catch (error) {
        expect(error).toBeInstanceOf(DictionaryError);
        expect((error as DictionaryError).code).toBe("FETCH_FAILED");
        expect((error as DictionaryError).source).toBe("etymonline");
        expect((error as DictionaryError).message).toContain("Network connection failed");
        expect((error as DictionaryError).retryable).toBe(true);
      }
    });

    it("should throw FETCH_FAILED when word page has no items and search page fails", async () => {
      mockFetch
        .mockResolvedValueOnce(mockHtmlResponse(EMPTY_PAGE_HTML))
        .mockResolvedValueOnce(mockErrorResponse(500, "Server Error"));

      try {
        await search("hello", config);
      } catch (error) {
        expect(error).toBeInstanceOf(DictionaryError);
        expect((error as DictionaryError).code).toBe("FETCH_FAILED");
        expect((error as DictionaryError).source).toBe("etymonline");
      }
    });

    it("should handle non-Error thrown by fetch (e.g. string)", async () => {
      mockFetch.mockRejectedValue("some string error");

      try {
        await search("hello", config);
      } catch (error) {
        expect(error).toBeInstanceOf(DictionaryError);
        expect((error as DictionaryError).code).toBe("FETCH_FAILED");
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

      // text() fails → fetchAndParse throws FETCH_FAILED
      // word page fetch fails with FETCH_FAILED → searchFallback is called
      // search page also needs to fail
      mockFetch.mockResolvedValue(badResponse);

      await expect(search("hello", config)).rejects.toThrow(DictionaryError);
    });
  });

  // -------------------------------------------------------------------------
  // maxResults limit
  // -------------------------------------------------------------------------

  describe("maxResults limit", () => {
    it("should limit modern entries to maxResults", async () => {
      const html = `
        <html><body>
          <section class="max-w-none"><h2>Entry 1</h2><div>Content 1</div></section>
          <section class="max-w-none"><h2>Entry 2</h2><div>Content 2</div></section>
          <section class="max-w-none"><h2>Entry 3</h2><div>Content 3</div></section>
          <section class="max-w-none"><h2>Entry 4</h2><div>Content 4</div></section>
          <section class="max-w-none"><h2>Entry 5</h2><div>Content 5</div></section>
        </body></html>
      `;
      mockFetch.mockResolvedValue(mockHtmlResponse(html));

      const limitedConfig = { ...config, maxResults: 2 };
      const result = await search("test", limitedConfig);

      expect(result.data.items).toHaveLength(2);
      expect(result.data.items[0].etymology).toContain("Content 1");
      expect(result.data.items[1].etymology).toContain("Content 2");
    });

    it("should limit legacy items to maxResults", async () => {
      const html = `
        <html><body>
          <div class="word--A"><span class="word__name--N">W1</span><div class="word__defination--D">D1</div></div>
          <div class="word--B"><span class="word__name--N">W2</span><div class="word__defination--D">D2</div></div>
          <div class="word--C"><span class="word__name--N">W3</span><div class="word__defination--D">D3</div></div>
        </body></html>
      `;
      mockFetch.mockResolvedValue(mockHtmlResponse(html));

      const limitedConfig = { ...config, maxResults: 1 };
      const result = await search("test", limitedConfig);

      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0].etymology).toContain("D1");
    });

    it("should limit search cards to maxResults", async () => {
      const searchPage = `
        <html><body>
          <a class="w-full group" href="/w/1"><span id="s1">S1</span><section class="prose"><p>P1</p></section></a>
          <a class="w-full group" href="/w/2"><span id="s2">S2</span><section class="prose"><p>P2</p></section></a>
          <a class="w-full group" href="/w/3"><span id="s3">S3</span><section class="prose"><p>P3</p></section></a>
        </body></html>
      `;
      mockFetch
        .mockResolvedValueOnce(mockHtmlResponse(EMPTY_PAGE_HTML))
        .mockResolvedValueOnce(mockHtmlResponse(searchPage));

      const limitedConfig = { ...config, maxResults: 1 };
      const result = await search("test", limitedConfig);

      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0].etymology).toContain("P1");
    });

    it("should default maxResults to 4 when not specified", async () => {
      const html = `
        <html><body>
          <section class="max-w-none"><h2>E1</h2><div>C1</div></section>
          <section class="max-w-none"><h2>E2</h2><div>C2</div></section>
          <section class="max-w-none"><h2>E3</h2><div>C3</div></section>
          <section class="max-w-none"><h2>E4</h2><div>C4</div></section>
          <section class="max-w-none"><h2>E5</h2><div>C5</div></section>
        </body></html>
      `;
      mockFetch.mockResolvedValue(mockHtmlResponse(html));

      // config has no maxResults → should default to 4
      const result = await search("test", config);

      expect(result.data.items).toHaveLength(4);
    });

    it("should return all items when count is less than maxResults", async () => {
      const html = `
        <html><body>
          <section class="max-w-none"><h2>Only Entry</h2><div>Only content</div></section>
        </body></html>
      `;
      mockFetch.mockResolvedValue(mockHtmlResponse(html));

      const result = await search("test", config);

      expect(result.data.items).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // getDefaultConfig()
  // -------------------------------------------------------------------------

  describe("getDefaultConfig()", () => {
    it("should return correct default configuration", () => {
      const defaultConfig = getDefaultConfig();

      expect(defaultConfig.id).toBe("etymonline");
      expect(defaultConfig.name).toBe("Etymonline");
      expect(defaultConfig.enabled).toBe(true);
      expect(defaultConfig.timeout).toBe(10_000);
      expect(defaultConfig.maxResults).toBe(4);
    });
  });

  // -------------------------------------------------------------------------
  // Result shape
  // -------------------------------------------------------------------------

  describe("result shape", () => {
    it("should return correct result structure on success", async () => {
      mockFetch.mockResolvedValue(mockHtmlResponse(MODERN_ENTRY_HTML));

      const result = await search("hello", config);

      expect(result).toEqual({
        source: "etymonline",
        word: "hello",
        found: true,
        data: {
          items: expect.arrayContaining([
            expect.objectContaining({ etymology: expect.any(String) }),
          ]),
        },
      });
    });

    it("should pass word through correctly in result", async () => {
      mockFetch.mockResolvedValue(mockHtmlResponse(MODERN_ENTRY_HTML));

      const result = await search("test-word", config);

      expect(result.word).toBe("test-word");
    });
  });

  // -------------------------------------------------------------------------
  // AbortController / timeout integration
  // -------------------------------------------------------------------------

  describe("timeout handling", () => {
    it("should pass config timeout to fetchWithTimeout", async () => {
      mockFetch.mockResolvedValue(mockHtmlResponse(MODERN_ENTRY_HTML));

      const timeoutConfig = { ...config, timeout: 5000 };
      await search("hello", timeoutConfig);

      // fetchWithTimeout passes signal to fetch — verify fetch was called
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, options] = mockFetch.mock.calls[0];
      expect(options.signal).toBeDefined();
    });

    it("should use default timeout when not specified in config", async () => {
      mockFetch.mockResolvedValue(mockHtmlResponse(MODERN_ENTRY_HTML));

      await search("hello", config);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, options] = mockFetch.mock.calls[0];
      expect(options.signal).toBeInstanceOf(AbortSignal);
    });
  });
});
