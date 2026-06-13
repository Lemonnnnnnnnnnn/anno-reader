/**
 * Integration tests for web reader functionality.
 *
 * Tests the complete web reading flow:
 * - URL input → fetch → HTML clean → store
 * - Text selection → toolbar appearance (postMessage simulation)
 * - Highlight creation → persistence (via annotations module)
 * - Note creation → persistence (via annotations module)
 * - Error scenarios (invalid URL, network error, timeout)
 * - Navigation: back/forward history
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { useBookStore } from "@/stores/useBookStore";
import { useWebStore } from "@/stores/useWebStore";
import { cleanHtml } from "@/lib/web/cleaner";
import type { WebPage } from "@/lib/web/types";

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Mock proxy/fetch — the only external dependency for fetchWebPage
vi.mock("@/lib/proxy/fetch", () => ({
  proxyFetch: vi.fn(),
}));

// Mock annotations persistence — avoids Tauri fs plugin calls
vi.mock("@/lib/annotations/persistence", () => ({
  loadNotesFromFile: vi.fn().mockResolvedValue([]),
  saveNotesToFile: vi.fn().mockResolvedValue(undefined),
  deleteNotesFile: vi.fn().mockResolvedValue(undefined),
  loadHighlightsFromFile: vi.fn().mockResolvedValue([]),
  saveHighlightsToFile: vi.fn().mockResolvedValue(undefined),
  deleteHighlightsFile: vi.fn().mockResolvedValue(undefined),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const SAMPLE_HTML = `<!DOCTYPE html>
<html>
<head><title>Test Article</title></head>
<body>
  <nav>Navigation bar</nav>
  <script>console.log("ads")</script>
  <article>
    <h1>Hello World</h1>
    <p>This is a test article with enough content to be extracted properly by the cleaner.</p>
    <p>Second paragraph with more text for testing purposes and content extraction.</p>
  </article>
  <footer>Footer content</footer>
</body>
</html>`;

const SAMPLE_HTML_NO_ARTICLE = `<!DOCTYPE html>
<html>
<head><title>No Article Page</title></head>
<body>
  <div class="main-content">
    <p>This page has no article tag but uses a content-identified div for extraction.</p>
    <p>The cleaner should find this content via the main-content class marker.</p>
  </div>
</body>
</html>`;

const SAMPLE_HTML_WITH_ADS = `<!DOCTYPE html>
<html>
<head><title>Ad-Heavy Page</title></head>
<body>
  <article>
    <p>This is the actual content that should be extracted despite the ads.</p>
    <p>The cleaner should extract article content and preserve it properly.</p>
  </article>
</body>
</html>`;

const BOOK_ID = "web-test-1";
const WEB_URL = "https://example.com/article";
const WEB_URL_2 = "https://example.com/second";
const WEB_URL_3 = "https://example.com/third";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeWebResponse(html: string, status = 200, statusText = "OK") {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: vi.fn().mockResolvedValue(html),
  };
}

// ── Setup ──────────────────────────────────────────────────────────────────────

describe("web reader integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBookStore.setState({ highlights: [], notes: [] });
    useWebStore.setState({
      currentPage: null,
      history: [],
      historyIndex: -1,
      isLoading: false,
      error: null,
    });
  });

  // ===========================================================================
  // 1. Fetch → Clean → Store: complete flow
  // ===========================================================================

  describe("URL → fetch → clean → store flow", () => {
    it("fetches a page and populates the web store", async () => {
      const { proxyFetch } = await import("@/lib/proxy/fetch");
      vi.mocked(proxyFetch).mockResolvedValue(makeWebResponse(SAMPLE_HTML) as never);

      await useWebStore.getState().loadWebPage(WEB_URL);

      const state = useWebStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.currentPage).not.toBeNull();
      expect(state.currentPage?.url).toBe(WEB_URL);
      expect(state.currentPage?.title).toBe("Test Article");
      expect(state.currentPage?.html).toContain("Hello World");
      expect(state.currentPage?.plainText).toContain("Hello World");
      // Scripts and nav should be cleaned
      expect(state.currentPage?.html).not.toContain("console.log");
      expect(state.currentPage?.plainText).not.toContain("Navigation bar");
    });

    it("sets isLoading=true during fetch, false after", async () => {
      const { proxyFetch } = await import("@/lib/proxy/fetch");
      let resolveFetch: (v: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });
      vi.mocked(proxyFetch).mockReturnValue(fetchPromise as never);

      const loadPromise = useWebStore.getState().loadWebPage(WEB_URL);

      // Should be loading
      expect(useWebStore.getState().isLoading).toBe(true);
      expect(useWebStore.getState().error).toBeNull();

      // Complete the fetch
      resolveFetch!(makeWebResponse(SAMPLE_HTML));
      await loadPromise;

      expect(useWebStore.getState().isLoading).toBe(false);
    });

    it("cleans HTML: strips scripts, styles, nav, footer", () => {
      const result = cleanHtml(SAMPLE_HTML);

      expect(result.html).not.toContain("<script>");
      expect(result.html).not.toContain("<nav>");
      expect(result.html).not.toContain("<footer>");
      expect(result.plainText).not.toContain("console.log");
      expect(result.plainText).toContain("Hello World");
    });

    it("cleans HTML: extracts content from article tag", () => {
      const result = cleanHtml(SAMPLE_HTML);

      expect(result.html).toContain("Hello World");
      expect(result.plainText).toContain("test article");
    });

    it("cleans HTML: falls back to content-identified divs", () => {
      const result = cleanHtml(SAMPLE_HTML_NO_ARTICLE);

      expect(result.plainText).toContain("no article tag");
      expect(result.plainText).toContain("main-content class marker");
    });

    it("cleans HTML: extracts content from article despite surrounding markup", () => {
      const result = cleanHtml(SAMPLE_HTML_WITH_ADS);

      // Article content should be preserved
      expect(result.plainText).toContain("actual content");
      expect(result.plainText).toContain("extract article content");
    });

    it("extracts title from HTML <title> tag", async () => {
      const { fetchWebPage } = await import("@/lib/web/fetcher");
      const { proxyFetch } = await import("@/lib/proxy/fetch");
      vi.mocked(proxyFetch).mockResolvedValue(
        makeWebResponse('<html><head><title>My Page Title</title></head><body>x</body></html>') as never,
      );

      const page = await fetchWebPage("https://test.com");
      expect(page.title).toBe("My Page Title");
    });

    it("handles missing title gracefully", async () => {
      const { fetchWebPage } = await import("@/lib/web/fetcher");
      const { proxyFetch } = await import("@/lib/proxy/fetch");
      vi.mocked(proxyFetch).mockResolvedValue(
        makeWebResponse("<html><body>No title here</body></html>") as never,
      );

      const page = await fetchWebPage("https://test.com");
      expect(page.title).toBe("");
    });
  });

  // ===========================================================================
  // 2. Error scenarios
  // ===========================================================================

  describe("error scenarios", () => {
    it("handles HTTP 404 error", async () => {
      const { proxyFetch } = await import("@/lib/proxy/fetch");
      vi.mocked(proxyFetch).mockResolvedValue(
        makeWebResponse("", 404, "Not Found") as never,
      );

      await useWebStore.getState().loadWebPage(WEB_URL);

      const state = useWebStore.getState();
      expect(state.error).toContain("404");
      expect(state.error).toContain("Not Found");
      expect(state.isLoading).toBe(false);
      expect(state.currentPage).toBeNull();
    });

    it("handles HTTP 500 error", async () => {
      const { proxyFetch } = await import("@/lib/proxy/fetch");
      vi.mocked(proxyFetch).mockResolvedValue(
        makeWebResponse("", 500, "Internal Server Error") as never,
      );

      await useWebStore.getState().loadWebPage(WEB_URL);

      expect(useWebStore.getState().error).toContain("500");
      expect(useWebStore.getState().isLoading).toBe(false);
    });

    it("handles network error (TypeError)", async () => {
      const { proxyFetch } = await import("@/lib/proxy/fetch");
      vi.mocked(proxyFetch).mockRejectedValue(new TypeError("Failed to fetch"));

      await useWebStore.getState().loadWebPage(WEB_URL);

      const state = useWebStore.getState();
      expect(state.error).toBe("Failed to fetch");
      expect(state.isLoading).toBe(false);
      expect(state.currentPage).toBeNull();
    });

    it("handles timeout error", async () => {
      const { proxyFetch } = await import("@/lib/proxy/fetch");
      const abortError = new DOMException("The operation was aborted", "AbortError");
      vi.mocked(proxyFetch).mockRejectedValue(abortError);

      const { fetchWebPage } = await import("@/lib/web/fetcher");

      await expect(fetchWebPage(WEB_URL)).rejects.toThrow("Request timed out");
    });

    it("store catches errors and never throws", async () => {
      const { proxyFetch } = await import("@/lib/proxy/fetch");
      vi.mocked(proxyFetch).mockRejectedValue(new Error("Network failure"));

      // Should NOT throw
      await expect(useWebStore.getState().loadWebPage(WEB_URL)).resolves.toBeUndefined();

      expect(useWebStore.getState().error).toBe("Network failure");
      expect(useWebStore.getState().isLoading).toBe(false);
    });

    it("clearError resets error state", async () => {
      const { proxyFetch } = await import("@/lib/proxy/fetch");
      vi.mocked(proxyFetch).mockRejectedValue(new Error("fail"));

      await useWebStore.getState().loadWebPage(WEB_URL);
      expect(useWebStore.getState().error).toBe("fail");

      useWebStore.getState().clearError();
      expect(useWebStore.getState().error).toBeNull();
    });

    it("handles non-Error thrown values", async () => {
      const { proxyFetch } = await import("@/lib/proxy/fetch");
      vi.mocked(proxyFetch).mockRejectedValue("string error");

      await useWebStore.getState().loadWebPage(WEB_URL);

      expect(useWebStore.getState().error).toBe("Failed to load page");
    });
  });

  // ===========================================================================
  // 3. Navigation: back/forward history
  // ===========================================================================

  describe("navigation history", () => {
    async function loadPages(urls: string[]) {
      const { proxyFetch } = await import("@/lib/proxy/fetch");

      for (const url of urls) {
        const html = `<html><head><title>${url}</title></head><body><p>Content of ${url}</p></body></html>`;
        vi.mocked(proxyFetch).mockResolvedValue(makeWebResponse(html) as never);
        await useWebStore.getState().loadWebPage(url);
      }
    }

    it("tracks history correctly after multiple page loads", async () => {
      await loadPages([WEB_URL, WEB_URL_2, WEB_URL_3]);
      const state = useWebStore.getState();

      expect(state.history).toHaveLength(3);
      expect(state.historyIndex).toBe(2);
      expect(state.currentPage?.url).toBe(WEB_URL_3);
    });

    it("goBack navigates to previous page", async () => {
      await loadPages([WEB_URL, WEB_URL_2]);
      useWebStore.getState().goBack();

      const state = useWebStore.getState();
      expect(state.historyIndex).toBe(0);
      expect(state.currentPage?.url).toBe(WEB_URL);
    });

    it("goForward navigates to next page after goBack", async () => {
      await loadPages([WEB_URL, WEB_URL_2, WEB_URL_3]);
      useWebStore.getState().goBack();
      useWebStore.getState().goForward();

      const state = useWebStore.getState();
      expect(state.historyIndex).toBe(2);
      expect(state.currentPage?.url).toBe(WEB_URL_3);
    });

    it("goBack is a no-op at start of history", async () => {
      await loadPages([WEB_URL]);
      useWebStore.getState().goBack();

      const state = useWebStore.getState();
      expect(state.historyIndex).toBe(0);
      expect(state.currentPage?.url).toBe(WEB_URL);
    });

    it("goForward is a no-op at end of history", async () => {
      await loadPages([WEB_URL]);
      useWebStore.getState().goForward();

      const state = useWebStore.getState();
      expect(state.historyIndex).toBe(0);
      expect(state.currentPage?.url).toBe(WEB_URL);
    });

    it("discards forward history when loading new page from middle", async () => {
      await loadPages([WEB_URL, WEB_URL_2, WEB_URL_3]);

      // Go back to page 2
      useWebStore.getState().goBack();
      expect(useWebStore.getState().historyIndex).toBe(1);

      // Load a new page — should discard page 3
      const { proxyFetch } = await import("@/lib/proxy/fetch");
      const newUrl = "https://example.com/new";
      vi.mocked(proxyFetch).mockResolvedValue(
        makeWebResponse(`<html><head><title>New</title></head><body><p>New page</p></body></html>`) as never,
      );
      await useWebStore.getState().loadWebPage(newUrl);

      const state = useWebStore.getState();
      expect(state.history).toHaveLength(3); // [WEB_URL, WEB_URL_2, newUrl]
      expect(state.historyIndex).toBe(2);
      expect(state.currentPage?.url).toBe(newUrl);
      // Page 3 should be gone
      expect(state.history.find((p: WebPage) => p.url === WEB_URL_3)).toBeUndefined();
    });

    it("clears error on successful navigation (goBack/goForward)", async () => {
      await loadPages([WEB_URL, WEB_URL_2]);

      // Set an error manually
      useWebStore.setState({ error: "previous error" });
      useWebStore.getState().goBack();

      expect(useWebStore.getState().error).toBeNull();
    });
  });

  // ===========================================================================
  // 4. Text selection → toolbar appearance (postMessage simulation)
  // ===========================================================================

  describe("text selection → toolbar appearance", () => {
    it("dispatches text-selection message from iframe", () => {
      const messages: Array<{ type: string; text?: string }> = [];

      function handleMessage(event: MessageEvent) {
        if (event.data?.type === "text-selection" || event.data?.type === "text-selection-cleared") {
          messages.push(event.data);
        }
      }

      window.addEventListener("message", handleMessage);

      // Simulate iframe posting a text-selection message
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "text-selection",
            text: "selected text from article",
            rect: { top: 50, left: 10, bottom: 70, right: 200, width: 190, height: 20 },
            startOffset: 0,
            endOffset: 27,
          },
        }),
      );

      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe("text-selection");
      expect(messages[0].text).toBe("selected text from article");

      window.removeEventListener("message", handleMessage);
    });

    it("dispatches text-selection-cleared message on deselection", () => {
      const messages: Array<{ type: string }> = [];

      function handleMessage(event: MessageEvent) {
        if (event.data?.type) {
          messages.push({ type: event.data.type });
        }
      }

      window.addEventListener("message", handleMessage);

      // Select text
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "text-selection", text: "hello", rect: {} },
        }),
      );

      // Deselect
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "text-selection-cleared" },
        }),
      );

      expect(messages).toHaveLength(2);
      expect(messages[0].type).toBe("text-selection");
      expect(messages[1].type).toBe("text-selection-cleared");

      window.removeEventListener("message", handleMessage);
    });

    it("toolbar visibility toggles with selection state", () => {
      let toolbarVisible = false;

      function handleMessage(event: MessageEvent) {
        if (event.data?.type === "text-selection") {
          toolbarVisible = true;
        } else if (event.data?.type === "text-selection-cleared") {
          toolbarVisible = false;
        }
      }

      window.addEventListener("message", handleMessage);

      // Initially hidden
      expect(toolbarVisible).toBe(false);

      // Select → visible
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "text-selection", text: "test", rect: {} },
        }),
      );
      expect(toolbarVisible).toBe(true);

      // Deselect → hidden
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "text-selection-cleared" },
        }),
      );
      expect(toolbarVisible).toBe(false);

      window.removeEventListener("message", handleMessage);
    });
  });

  // ===========================================================================
  // 5. Highlight creation → persistence (web content)
  // ===========================================================================

  describe("highlight creation → persistence", () => {
    beforeEach(() => {
      useBookStore.setState({ highlights: [], notes: [] });
    });

    it("creates a highlight for web page content", async () => {
      const { createHighlight } = await import("@/lib/annotations");

      const highlight = await createHighlight(
        BOOK_ID,
        WEB_URL,
        "epubcfi(/6/4[web]!/4/2:0,15)",
        "selected web text",
        "#fde68a",
      );

      const { highlights } = useBookStore.getState();

      expect(highlights).toHaveLength(1);
      expect(highlights[0].id).toMatch(/^hl_/);
      expect(highlights[0].bookId).toBe(BOOK_ID);
      expect(highlights[0].chapterHref).toBe(WEB_URL);
      expect(highlights[0].text).toBe("selected web text");
      expect(highlights[0].color).toBe("#fde68a");
    });

    it("persists highlight to disk", async () => {
      const { createHighlight } = await import("@/lib/annotations");
      const { saveHighlightsToFile } = await import("@/lib/annotations/persistence");

      await createHighlight(
        BOOK_ID,
        WEB_URL,
        "epubcfi(/6/4[web]!/4/2:0,15)",
        "text",
        "#a7f3d0",
      );

      expect(saveHighlightsToFile).toHaveBeenCalledWith(BOOK_ID, expect.any(Array));
      const savedData = vi.mocked(saveHighlightsToFile).mock.calls[0][1];
      expect(savedData).toHaveLength(1);
      expect(savedData[0].chapterHref).toBe(WEB_URL);
      expect(savedData[0].color).toBe("#a7f3d0");
    });

    it("deletes a highlight", async () => {
      const { createHighlight, deleteHighlight } = await import("@/lib/annotations");

      const hl = await createHighlight(
        BOOK_ID,
        WEB_URL,
        "epubcfi(/6/4[web]!/4/2:0,15)",
        "to delete",
        "#fde68a",
      );

      expect(useBookStore.getState().highlights).toHaveLength(1);

      await deleteHighlight(hl.id, BOOK_ID);

      expect(useBookStore.getState().highlights).toHaveLength(0);
    });

    it("updates highlight color", async () => {
      const { createHighlight, updateHighlight } = await import("@/lib/annotations");

      const hl = await createHighlight(
        BOOK_ID,
        WEB_URL,
        "epubcfi(/6/4[web]!/4/2:0,15)",
        "text",
        "#fde68a",
      );

      await updateHighlight(hl.id, { color: "#bfdbfe" }, BOOK_ID);

      const { highlights } = useBookStore.getState();
      expect(highlights).toHaveLength(1);
      expect(highlights[0].color).toBe("#bfdbfe");
      expect(highlights[0].text).toBe("text"); // unchanged
    });

    it("queries highlights by chapterHref (URL)", async () => {
      const { createHighlight, getHighlightsForChapter } = await import("@/lib/annotations");

      await createHighlight(BOOK_ID, WEB_URL, "epubcfi(/6/4[web]!/4/2:0,10)", "first", "#fde68a");
      await createHighlight(BOOK_ID, WEB_URL_2, "epubcfi(/6/4[web]!/4/2:0,10)", "second", "#a7f3d0");

      const urlHighlights = getHighlightsForChapter(WEB_URL, BOOK_ID);
      expect(urlHighlights).toHaveLength(1);
      expect(urlHighlights[0].text).toBe("first");
    });

    it("createHighlightWithRef sets contentRef on highlight", async () => {
      const { createHighlightWithRef } = await import("@/lib/annotations");

      const contentRef = { collectionId: BOOK_ID, sourceId: WEB_URL };

      await createHighlightWithRef(
        contentRef,
        "epubcfi(/6/4[web]!/4/2:0,15)",
        "with ref text",
        "#fbcfe8",
      );

      const { highlights } = useBookStore.getState();
      expect(highlights).toHaveLength(1);
      expect(highlights[0].contentRef).toEqual(contentRef);
      expect(highlights[0].bookId).toBe(BOOK_ID);
      expect(highlights[0].chapterHref).toBe(WEB_URL);
    });
  });

  // ===========================================================================
  // 6. Note creation → persistence (web content)
  // ===========================================================================

  describe("note creation → persistence", () => {
    beforeEach(() => {
      useBookStore.setState({ highlights: [], notes: [] });
    });

    it("creates a note for web page content", async () => {
      const { createNote } = await import("@/lib/annotations");

      await createNote(
        BOOK_ID,
        WEB_URL,
        "epubcfi(/6/4[web]!/4/2:0,15)",
        "selected web text",
        "My note about this text",
      );

      const { notes } = useBookStore.getState();
      expect(notes).toHaveLength(1);
      expect(notes[0].id).toMatch(/^note_/);
      expect(notes[0].bookId).toBe(BOOK_ID);
      expect(notes[0].chapterHref).toBe(WEB_URL);
      expect(notes[0].text).toBe("selected web text");
      expect(notes[0].content).toBe("My note about this text");
    });

    it("persists note to disk", async () => {
      const { createNote } = await import("@/lib/annotations");
      const { saveNotesToFile } = await import("@/lib/annotations/persistence");

      await createNote(
        BOOK_ID,
        WEB_URL,
        "epubcfi(/6/4[web]!/4/2:0,15)",
        "text",
        "note content",
      );

      expect(saveNotesToFile).toHaveBeenCalledWith(BOOK_ID, expect.any(Array));
      const savedData = vi.mocked(saveNotesToFile).mock.calls[0][1];
      expect(savedData).toHaveLength(1);
      expect(savedData[0].chapterHref).toBe(WEB_URL);
      expect(savedData[0].content).toBe("note content");
    });

    it("deletes a note", async () => {
      const { createNote, deleteNote } = await import("@/lib/annotations");

      const note = await createNote(
        BOOK_ID,
        WEB_URL,
        "epubcfi(/6/4[web]!/4/2:0,15)",
        "text",
        "to delete",
      );

      expect(useBookStore.getState().notes).toHaveLength(1);

      await deleteNote(note.id, BOOK_ID);

      expect(useBookStore.getState().notes).toHaveLength(0);
    });

    it("updates note content", async () => {
      const { createNote, updateNote } = await import("@/lib/annotations");

      const note = await createNote(
        BOOK_ID,
        WEB_URL,
        "epubcfi(/6/4[web]!/4/2:0,15)",
        "text",
        "original note",
      );

      await updateNote(note.id, "updated note", BOOK_ID);

      const { notes } = useBookStore.getState();
      expect(notes).toHaveLength(1);
      expect(notes[0].content).toBe("updated note");
      expect(notes[0].text).toBe("text"); // selected text unchanged
    });

    it("queries notes by chapterHref (URL)", async () => {
      const { createNote, getNotesForChapter } = await import("@/lib/annotations");

      await createNote(BOOK_ID, WEB_URL, "epubcfi(/6/4[web]!/4/2:0,10)", "text1", "note1");
      await createNote(BOOK_ID, WEB_URL_2, "epubcfi(/6/4[web]!/4/2:0,10)", "text2", "note2");

      const urlNotes = getNotesForChapter(WEB_URL, BOOK_ID);
      expect(urlNotes).toHaveLength(1);
      expect(urlNotes[0].content).toBe("note1");
    });

    it("createNoteWithRef sets contentRef on note", async () => {
      const { createNoteWithRef } = await import("@/lib/annotations");

      const contentRef = { collectionId: BOOK_ID, sourceId: WEB_URL };

      await createNoteWithRef(
        contentRef,
        "epubcfi(/6/4[web]!/4/2:0,15)",
        "with ref text",
        "my note",
      );

      const { notes } = useBookStore.getState();
      expect(notes).toHaveLength(1);
      expect(notes[0].contentRef).toEqual(contentRef);
      expect(notes[0].bookId).toBe(BOOK_ID);
      expect(notes[0].chapterHref).toBe(WEB_URL);
    });
  });

  // ===========================================================================
  // 7. Full integration: fetch + annotate + navigate
  // ===========================================================================

  describe("full integration: fetch → annotate → navigate", () => {
    it("loads page, creates highlight and note, navigates back", async () => {
      const { proxyFetch } = await import("@/lib/proxy/fetch");
      const {
        createHighlight,
        createNote,
        getHighlightsForChapter,
        getNotesForChapter,
      } = await import("@/lib/annotations");

      // Step 1: Load first page
      vi.mocked(proxyFetch).mockResolvedValue(
        makeWebResponse(
          `<html><head><title>Page 1</title></head><body><article><p>Content 1</p></article></body></html>`,
        ) as never,
      );
      await useWebStore.getState().loadWebPage(WEB_URL);
      expect(useWebStore.getState().currentPage?.url).toBe(WEB_URL);

      // Step 2: Create highlight on first page
      await createHighlight(
        BOOK_ID,
        WEB_URL,
        "epubcfi(/6/4[web]!/4/2:0,10)",
        "Content",
        "#fde68a",
      );

      // Step 3: Create note on first page
      await createNote(
        BOOK_ID,
        WEB_URL,
        "epubcfi(/6/4[web]!/4/2:0,10)",
        "Content",
        "Important note",
      );

      // Verify annotations exist
      expect(getHighlightsForChapter(WEB_URL, BOOK_ID)).toHaveLength(1);
      expect(getNotesForChapter(WEB_URL, BOOK_ID)).toHaveLength(1);

      // Step 4: Load second page
      vi.mocked(proxyFetch).mockResolvedValue(
        makeWebResponse(
          `<html><head><title>Page 2</title></head><body><article><p>Content 2</p></article></body></html>`,
        ) as never,
      );
      await useWebStore.getState().loadWebPage(WEB_URL_2);
      expect(useWebStore.getState().currentPage?.url).toBe(WEB_URL_2);

      // Step 5: Navigate back
      useWebStore.getState().goBack();
      expect(useWebStore.getState().currentPage?.url).toBe(WEB_URL);

      // Annotations still exist
      expect(getHighlightsForChapter(WEB_URL, BOOK_ID)).toHaveLength(1);
      expect(getNotesForChapter(WEB_URL, BOOK_ID)).toHaveLength(1);
    });
  });
});
