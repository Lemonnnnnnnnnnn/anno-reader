/**
 * Unit tests for RAG parsed-epub-cache module.
 *
 * Tests: setParsedEpub, getParsedEpub, clearParsedEpub,
 *        getChapterText, getAllChapterTexts
 * Covers: cache lifecycle, missing data, HTML extraction.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  setParsedEpub,
  getParsedEpub,
  clearParsedEpub,
  getChapterText,
  getAllChapterTexts,
} from "@/lib/rag/parsed-epub-cache";
import type { ParsedEpub } from "@/lib/epub/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeParsedEpub(overrides?: Partial<ParsedEpub>): ParsedEpub {
  return {
    metadata: {
      title: "Test Book",
      author: "Test Author",
      language: "en",
      identifier: "test-123",
    },
    coverUrl: null,
    chapters: [
      {
        id: "ch-1",
        title: "Chapter 1",
        href: "Text/ch1.xhtml",
        content: "<p>This is chapter one content with enough text for testing.</p>",
        cssContent: [],
      },
      {
        id: "ch-2",
        title: "Chapter 2",
        href: "Text/ch2.xhtml",
        content: "<p>Chapter two has <em>emphasis</em> and <strong>bold</strong> text.</p>",
        cssContent: [],
      },
    ],
    toc: [],
    resources: {},
    opfFolder: "OEBPS",
    manifestHrefs: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parsed-epub-cache", () => {
  // Clear cache before each test to ensure isolation
  beforeEach(() => {
    clearParsedEpub();
  });

  // =========================================================================
  // Cache lifecycle
  // =========================================================================

  describe("cache lifecycle", () => {
    it("should return null when no epub is cached", () => {
      expect(getParsedEpub()).toBeNull();
    });

    it("should store and retrieve a ParsedEpub", () => {
      const epub = makeParsedEpub();
      setParsedEpub(epub);

      const cached = getParsedEpub();
      expect(cached).not.toBeNull();
      expect(cached!.metadata.title).toBe("Test Book");
      expect(cached!.chapters).toHaveLength(2);
    });

    it("should clear the cached epub", () => {
      setParsedEpub(makeParsedEpub());
      expect(getParsedEpub()).not.toBeNull();

      clearParsedEpub();
      expect(getParsedEpub()).toBeNull();
    });

    it("should replace cached epub on second set", () => {
      setParsedEpub(makeParsedEpub({ metadata: { title: "First", author: "A", language: "en", identifier: "1" } }));
      expect(getParsedEpub()!.metadata.title).toBe("First");

      setParsedEpub(makeParsedEpub({ metadata: { title: "Second", author: "B", language: "en", identifier: "2" } }));
      expect(getParsedEpub()!.metadata.title).toBe("Second");
    });
  });

  // =========================================================================
  // getChapterText
  // =========================================================================

  describe("getChapterText", () => {
    it("should return null when no epub is cached", () => {
      expect(getChapterText("ch-1")).toBeNull();
    });

    it("should return null for a non-existent chapter ID", () => {
      setParsedEpub(makeParsedEpub());
      expect(getChapterText("non-existent")).toBeNull();
    });

    it("should extract plain text from chapter HTML", () => {
      setParsedEpub(makeParsedEpub());
      const text = getChapterText("ch-1");

      expect(text).not.toBeNull();
      expect(text).toContain("This is chapter one content");
      expect(text).not.toContain("<p>");
    });

    it("should strip HTML tags and extract text content", () => {
      setParsedEpub(makeParsedEpub());
      const text = getChapterText("ch-2");

      expect(text).not.toBeNull();
      expect(text).toContain("Chapter two has");
      expect(text).toContain("emphasis");
      expect(text).toContain("bold");
      expect(text).not.toContain("<em>");
      expect(text).not.toContain("<strong>");
    });
  });

  // =========================================================================
  // getAllChapterTexts
  // =========================================================================

  describe("getAllChapterTexts", () => {
    it("should return empty array when no epub is cached", () => {
      expect(getAllChapterTexts()).toEqual([]);
    });

    it("should return plain text for all chapters in order", () => {
      setParsedEpub(makeParsedEpub());
      const texts = getAllChapterTexts();

      expect(texts).toHaveLength(2);
      expect(texts[0].id).toBe("ch-1");
      expect(texts[0].title).toBe("Chapter 1");
      expect(texts[0].text).toContain("chapter one content");
      expect(texts[1].id).toBe("ch-2");
      expect(texts[1].title).toBe("Chapter 2");
      expect(texts[1].text).toContain("Chapter two has");
    });

    it("should handle epub with no chapters", () => {
      setParsedEpub(makeParsedEpub({ chapters: [] }));
      expect(getAllChapterTexts()).toEqual([]);
    });

    it("should handle chapters with empty content", () => {
      setParsedEpub(
        makeParsedEpub({
          chapters: [
            {
              id: "empty-ch",
              title: "Empty",
              href: "Text/empty.xhtml",
              content: "",
              cssContent: [],
            },
          ],
        }),
      );

      const texts = getAllChapterTexts();
      expect(texts).toHaveLength(1);
      expect(texts[0].id).toBe("empty-ch");
      expect(texts[0].text).toBe("");
    });

    it("should handle chapters with CJK content", () => {
      setParsedEpub(
        makeParsedEpub({
          chapters: [
            {
              id: "cjk-ch",
              title: "中文章节",
              href: "Text/cjk.xhtml",
              content: "<p>这是一段中文内容，用于测试CJK文本处理。</p>",
              cssContent: [],
            },
          ],
        }),
      );

      const texts = getAllChapterTexts();
      expect(texts).toHaveLength(1);
      expect(texts[0].title).toBe("中文章节");
      expect(texts[0].text).toContain("这是一段中文内容");
    });
  });
});
