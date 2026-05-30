import { describe, it, expect } from "vitest";
import { extractMetadata, extractChapters, extractToc } from "@/lib/epub/parser";
import type { EpubMetadata, EpubChapterInfo, EpubTocEntry } from "@/lib/epub/types";

// Mock epubix Epub object for testing
const mockEpub = {
  metadata: {
    title: "Test Book",
    author: "Test Author",
    language: "en",
    identifier: "test-123",
  },
  chapters: [
    {
      id: "ch1",
      title: "Chapter 1",
      href: "chapter1.html",
      content: "<h1>Chapter 1</h1><p>Content here</p>",
    },
    {
      id: "ch2",
      title: "Chapter 2",
      href: "chapter2.html",
      content: "<h1>Chapter 2</h1><p>More content</p>",
    },
  ],
  toc: [
    {
      title: "Introduction",
      href: "chapter1.html",
      children: [
        {
          title: "Section 1.1",
          href: "chapter1.html#section1",
          children: [],
        },
      ],
    },
    {
      title: "Main Content",
      href: "chapter2.html",
      children: [],
    },
  ],
  getCoverImageData: async () => null,
  resources: {},
  getFile: async () => null,
  getChapterByHref: () => null,
};

describe("EPUB Parser", () => {
  describe("extractMetadata", () => {
    it("should extract metadata from epub object", () => {
      const metadata = extractMetadata(mockEpub as any);

      expect(metadata).toEqual({
        title: "Test Book",
        author: "Test Author",
        language: "en",
        identifier: "test-123",
      });
    });

    it("should handle missing metadata with defaults", () => {
      const epubWithMissing = {
        metadata: {
          title: null,
          author: null,
          language: null,
          identifier: null,
        },
      };

      const metadata = extractMetadata(epubWithMissing as any);

      expect(metadata.title).toBe("Unknown Title");
      expect(metadata.author).toBe("Unknown Author");
      expect(metadata.language).toBe("");
      expect(metadata.identifier).toBe("");
    });
  });

  describe("extractChapters", () => {
    it("should extract chapters in order", () => {
      const chapters = extractChapters(mockEpub as any);

      expect(chapters).toHaveLength(2);
      expect(chapters[0].id).toBe("ch1");
      expect(chapters[0].title).toBe("Chapter 1");
      expect(chapters[1].id).toBe("ch2");
    });

    it("should handle chapters without titles", () => {
      const epubNoTitles = {
        chapters: [
          { id: "ch1", title: "", href: "ch1.html", content: "<p>Content</p>" },
        ],
      };

      const chapters = extractChapters(epubNoTitles as any);

      expect(chapters[0].title).toBe("Chapter");
    });
  });

  describe("extractToc", () => {
    it("should extract table of contents entries", () => {
      const toc = extractToc(mockEpub as any);

      expect(toc).toHaveLength(2);
      expect(toc[0].title).toBe("Introduction");
      expect(toc[0].href).toBe("chapter1.html");
    });

    it("should handle nested TOC entries", () => {
      const toc = extractToc(mockEpub as any);

      expect(toc[0].children).toHaveLength(1);
      expect(toc[0].children![0].title).toBe("Section 1.1");
    });
  });
});
