/**
 * Unit tests for RAG search module.
 *
 * Tests: sanitizeFTS5Query, searchAndAssembleContext
 * Covers: reserved FTS5 characters, empty input, CJK text,
 *         context assembly, empty results fallback.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { sanitizeFTS5Query } from "@/lib/rag/search";

// Mock the indexer module (Tauri invoke calls)
vi.mock("@/lib/rag/indexer", () => ({
  searchBook: vi.fn(),
}));

import { searchAndAssembleContext } from "@/lib/rag/search";
import { searchBook } from "@/lib/rag/indexer";
import { SYSTEM_PROMPT_TEMPLATE } from "@/lib/rag/constants";
import type { SearchResult } from "@/lib/rag/types";

// ---------------------------------------------------------------------------
// sanitizeFTS5Query
// ---------------------------------------------------------------------------

describe("sanitizeFTS5Query", () => {
  it("should wrap a simple query in double quotes", () => {
    expect(sanitizeFTS5Query("hello")).toBe('"hello"');
  });

  it("should escape internal double quotes by doubling them", () => {
    expect(sanitizeFTS5Query('say "hello"')).toBe('"say ""hello"""');
  });

  it("should handle FTS5 reserved characters safely", () => {
    // These characters (*, OR, AND, NOT, NEAR, ^) would cause FTS5 syntax
    // errors if not quoted. Wrapping in quotes makes them literal.
    const reserved = "test * OR AND NOT NEAR ^";
    const result = sanitizeFTS5Query(reserved);
    expect(result).toBe(`"${reserved}"`);
  });

  it("should handle empty string", () => {
    expect(sanitizeFTS5Query('')).toBe('""');
  });

  it("should handle CJK text", () => {
    const query = "这本书的主题是什么";
    expect(sanitizeFTS5Query(query)).toBe(`"${query}"`);
  });

  it("should handle multiple internal double quotes", () => {
    expect(sanitizeFTS5Query('a "b" c "d"')).toBe('"a ""b"" c ""d"""');
  });

  it("should handle single quotes (not special for FTS5)", () => {
    expect(sanitizeFTS5Query("it's")).toBe('"it\'s"');
  });

  it("should handle text with newlines", () => {
    expect(sanitizeFTS5Query("line1\nline2")).toBe('"line1\nline2"');
  });
});

// ---------------------------------------------------------------------------
// searchAndAssembleContext
// ---------------------------------------------------------------------------

describe("searchAndAssembleContext", () => {
  const mockSearchBook = vi.mocked(searchBook);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return fallback system message when no chunks found", async () => {
    mockSearchBook.mockResolvedValue({
      chunks: [],
      query: '"test"',
      totalResults: 0,
    });

    const result = await searchAndAssembleContext(
      "book-1",
      "test question",
      "My Book",
      "Author Name",
    );

    expect(result.chunks).toEqual([]);
    expect(result.systemMessage).toContain("My Book");
    expect(result.systemMessage).toContain("Author Name");
    expect(result.systemMessage).toContain(
      "(No relevant passages found in the book.)",
    );
  });

  it("should assemble context from search results grouped by chapter", async () => {
    mockSearchBook.mockResolvedValue({
      chunks: [
        {
          bookId: "book-1",
          chapterId: "ch-1",
          chapterTitle: "Chapter 1",
          chunkText: "Passage A from chapter 1.",
          rank: 0,
        },
        {
          bookId: "book-1",
          chapterId: "ch-1",
          chapterTitle: "Chapter 1",
          chunkText: "Passage B from chapter 1.",
          rank: 1,
        },
        {
          bookId: "book-1",
          chapterId: "ch-2",
          chapterTitle: "Chapter 2",
          chunkText: "Passage from chapter 2.",
          rank: 2,
        },
      ],
      query: '"test"',
      totalResults: 3,
    });

    const result = await searchAndAssembleContext(
      "book-1",
      "test question",
      "My Book",
      "Author Name",
    );

    expect(result.chunks).toHaveLength(3);
    // System message should contain chapter headers and passages
    expect(result.systemMessage).toContain("[Chapter 1]");
    expect(result.systemMessage).toContain("Passage A from chapter 1.");
    expect(result.systemMessage).toContain("Passage B from chapter 1.");
    expect(result.systemMessage).toContain("[Chapter 2]");
    expect(result.systemMessage).toContain("Passage from chapter 2.");
    expect(result.systemMessage).toContain("My Book");
    expect(result.systemMessage).toContain("Author Name");
  });

  it("should sanitize the query before searching", async () => {
    mockSearchBook.mockResolvedValue({
      chunks: [],
      query: '"test"',
      totalResults: 0,
    });

    await searchAndAssembleContext(
      "book-1",
      'test "quotes"',
      "My Book",
      "Author",
    );

    // The query should be sanitized (wrapped in quotes, internal quotes escaped)
    expect(mockSearchBook).toHaveBeenCalledWith(
      "book-1",
      '"test ""quotes"""',
    );
  });

  it("should handle CJK query and results", async () => {
    mockSearchBook.mockResolvedValue({
      chunks: [
        {
          bookId: "book-1",
          chapterId: "ch-1",
          chapterTitle: "第一章",
          chunkText: "这是关于主题的一段文字。",
          rank: 0,
        },
      ],
      query: '"主题"',
      totalResults: 1,
    });

    const result = await searchAndAssembleContext(
      "book-1",
      "主题是什么",
      "中文书",
      "作者",
    );

    expect(result.chunks).toHaveLength(1);
    expect(result.systemMessage).toContain("[第一章]");
    expect(result.systemMessage).toContain("这是关于主题的一段文字。");
  });

  it("should propagate errors from searchBook", async () => {
    mockSearchBook.mockRejectedValue(new Error("FTS5 database error"));

    await expect(
      searchAndAssembleContext("book-1", "query", "Book", "Author"),
    ).rejects.toThrow("FTS5 database error");
  });
});
