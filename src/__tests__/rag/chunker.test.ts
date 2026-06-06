/**
 * Unit tests for RAG chunker module.
 *
 * Tests: extractPlainText, chunkChapter, chunkBook
 * Covers: empty input, malformed HTML, CJK text, paragraph boundaries,
 *         sentence splitting, long paragraph handling, min/max chunk limits.
 */

import { describe, it, expect } from "vitest";
import {
  extractPlainText,
  chunkChapter,
  chunkBook,
} from "@/lib/rag/chunker";
import { MAX_CHUNK_LENGTH, MIN_CHUNK_LENGTH } from "@/lib/rag/constants";

// ---------------------------------------------------------------------------
// extractPlainText
// ---------------------------------------------------------------------------

describe("extractPlainText", () => {
  it("should return empty string for empty input", () => {
    expect(extractPlainText("")).toBe("");
  });

  it("should extract text from simple HTML", () => {
    const html = "<p>Hello world</p>";
    const result = extractPlainText(html);
    expect(result).toContain("Hello world");
  });

  it("should preserve paragraph boundaries between block elements", () => {
    const html = "<p>First paragraph</p><p>Second paragraph</p>";
    const result = extractPlainText(html);
    expect(result).toContain("First paragraph");
    expect(result).toContain("Second paragraph");
    // Paragraphs separated by \n\n
    expect(result).toMatch(/First paragraph\n\nSecond paragraph/);
  });

  it("should remove script elements", () => {
    const html = "<p>Hello</p><script>alert('xss')</script><p>World</p>";
    const result = extractPlainText(html);
    expect(result).not.toContain("alert");
    expect(result).toContain("Hello");
    expect(result).toContain("World");
  });

  it("should remove style elements", () => {
    const html = "<style>.cls{color:red}</style><p>Content</p>";
    const result = extractPlainText(html);
    expect(result).not.toContain("color:red");
    expect(result).toContain("Content");
  });

  it("should decode HTML entities", () => {
    const html = "<p>&amp; &lt; &gt; &quot; &#39;</p>";
    const result = extractPlainText(html);
    expect(result).toContain("&");
    expect(result).toContain("<");
    expect(result).toContain(">");
  });

  it("should handle CJK text", () => {
    const html = "<p>这是一段中文内容。</p><p>日本語のテキストです。</p>";
    const result = extractPlainText(html);
    expect(result).toContain("这是一段中文内容。");
    expect(result).toContain("日本語のテキストです。");
  });

  it("should handle malformed HTML gracefully", () => {
    const html = "<p>Unclosed paragraph<div>Nested<p>Oops</div>";
    const result = extractPlainText(html);
    // Should not throw, should extract some text
    expect(result).toContain("Unclosed paragraph");
    expect(result).toContain("Nested");
    expect(result).toContain("Oops");
  });

  it("should collapse whitespace within paragraphs", () => {
    const html = "<p>Hello   world\t\ttabs</p>";
    const result = extractPlainText(html);
    expect(result).toBe("Hello world tabs");
  });

  it("should handle headings as block elements", () => {
    const html = "<h1>Title</h1><p>Content</p>";
    const result = extractPlainText(html);
    expect(result).toMatch(/Title\n\nContent/);
  });

  it("should handle nested block elements", () => {
    const html = "<div><p>Inner paragraph</p></div>";
    const result = extractPlainText(html);
    expect(result).toContain("Inner paragraph");
  });

  it("should handle plain text without any tags", () => {
    const html = "Just plain text, no tags.";
    const result = extractPlainText(html);
    expect(result).toContain("Just plain text, no tags.");
  });

  it("should handle empty body", () => {
    const html = "<html><head></head><body></body></html>";
    const result = extractPlainText(html);
    expect(result).toBe("");
  });
});

// ---------------------------------------------------------------------------
// chunkChapter
// ---------------------------------------------------------------------------

describe("chunkChapter", () => {
  const chapterId = "ch-1";
  const chapterTitle = "Chapter 1";

  it("should return empty array for empty text", () => {
    expect(chunkChapter(chapterId, chapterTitle, "")).toEqual([]);
  });

  it("should chunk a single paragraph longer than MIN_CHUNK_LENGTH", () => {
    const text = "A".repeat(MIN_CHUNK_LENGTH + 10);
    const chunks = chunkChapter(chapterId, chapterTitle, text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].chapterId).toBe(chapterId);
    expect(chunks[0].chapterTitle).toBe(chapterTitle);
    expect(chunks[0].chunkText).toBe(text);
    expect(chunks[0].position).toBe(0);
  });

  it("should discard chunks shorter than MIN_CHUNK_LENGTH", () => {
    const text = "Short"; // Well under MIN_CHUNK_LENGTH (50)
    const chunks = chunkChapter(chapterId, chapterTitle, text);
    expect(chunks).toHaveLength(0);
  });

  it("should chunk multiple paragraphs and assign sequential positions", () => {
    const para1 = "A".repeat(MIN_CHUNK_LENGTH + 10);
    const para2 = "B".repeat(MIN_CHUNK_LENGTH + 20);
    const text = `${para1}\n\n${para2}`;
    const chunks = chunkChapter(chapterId, chapterTitle, text);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].position).toBe(0);
    expect(chunks[0].chunkText).toBe(para1);
    expect(chunks[1].position).toBe(1);
    expect(chunks[1].chunkText).toBe(para2);
  });

  it("should split long paragraphs at sentence boundaries", () => {
    // Create a paragraph longer than MAX_CHUNK_LENGTH with sentences
    const sentence = "This is a test sentence with enough words to be valid. ";
    const longPara = sentence.repeat(Math.ceil(MAX_CHUNK_LENGTH / sentence.length) + 2);
    const chunks = chunkChapter(chapterId, chapterTitle, longPara);

    // Should produce multiple chunks
    expect(chunks.length).toBeGreaterThan(1);
    // Each chunk should be at most MAX_CHUNK_LENGTH
    for (const chunk of chunks) {
      expect(chunk.chunkText.length).toBeLessThanOrEqual(MAX_CHUNK_LENGTH);
    }
  });

  it("should handle CJK text with CJK punctuation", () => {
    // CJK text with 。as sentence delimiter
    const sentence = "这是一个足够长的中文句子，用来测试分块功能。";
    // Repeat to exceed MIN_CHUNK_LENGTH
    const text = sentence.repeat(3);
    const chunks = chunkChapter(chapterId, chapterTitle, text);

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    for (const chunk of chunks) {
      expect(chunk.chapterId).toBe(chapterId);
    }
  });

  it("should handle multiple paragraph separators (\\n\\n+)", () => {
    const para1 = "A".repeat(MIN_CHUNK_LENGTH + 10);
    const para2 = "B".repeat(MIN_CHUNK_LENGTH + 10);
    const text = `${para1}\n\n\n\n${para2}`;
    const chunks = chunkChapter(chapterId, chapterTitle, text);

    expect(chunks).toHaveLength(2);
  });

  it("should skip empty paragraphs", () => {
    const para1 = "A".repeat(MIN_CHUNK_LENGTH + 10);
    const text = `${para1}\n\n   \n\n${para1}`;
    const chunks = chunkChapter(chapterId, chapterTitle, text);

    // Only 2 non-empty paragraphs
    expect(chunks).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// chunkBook
// ---------------------------------------------------------------------------

describe("chunkBook", () => {
  const bookId = "book-1";

  it("should return empty array for empty chapters", () => {
    expect(chunkBook(bookId, [])).toEqual([]);
  });

  it("should fill bookId on all chunks", () => {
    const chapters = [
      {
        id: "ch-1",
        title: "Chapter 1",
        text: "A".repeat(MIN_CHUNK_LENGTH + 10),
      },
      {
        id: "ch-2",
        title: "Chapter 2",
        text: "B".repeat(MIN_CHUNK_LENGTH + 10),
      },
    ];
    const chunks = chunkBook(bookId, chapters);

    for (const chunk of chunks) {
      expect(chunk.bookId).toBe(bookId);
    }
  });

  it("should assign positions per chapter (each chapter starts at 0)", () => {
    const chapters = [
      {
        id: "ch-1",
        title: "Chapter 1",
        text: "A".repeat(MIN_CHUNK_LENGTH + 10),
      },
      {
        id: "ch-2",
        title: "Chapter 2",
        text: "B".repeat(MIN_CHUNK_LENGTH + 10),
      },
    ];
    const chunks = chunkBook(bookId, chapters);

    expect(chunks).toHaveLength(2);
    // Each chapter's chunks start at position 0
    expect(chunks[0].position).toBe(0);
    expect(chunks[1].position).toBe(0);
    expect(chunks[0].chapterId).toBe("ch-1");
    expect(chunks[1].chapterId).toBe("ch-2");
  });

  it("should handle chapters with empty text", () => {
    const chapters = [
      { id: "ch-1", title: "Empty", text: "" },
      {
        id: "ch-2",
        title: "Has content",
        text: "A".repeat(MIN_CHUNK_LENGTH + 10),
      },
    ];
    const chunks = chunkBook(bookId, chapters);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].chapterId).toBe("ch-2");
  });

  it("should preserve chapter titles in chunks", () => {
    const chapters = [
      {
        id: "ch-1",
        title: "The Beginning",
        text: "A".repeat(MIN_CHUNK_LENGTH + 10),
      },
    ];
    const chunks = chunkBook(bookId, chapters);

    expect(chunks[0].chapterTitle).toBe("The Beginning");
  });
});
