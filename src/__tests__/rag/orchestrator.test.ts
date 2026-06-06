/**
 * Unit tests for RAG orchestrator module.
 *
 * Tests: indexBookFromCache, askQuestion pipeline
 * Covers: indexing from cache, auto-index on first query,
 *         skip indexing when already indexed, error propagation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all dependencies before importing the module under test
vi.mock("@/lib/rag/chunker", () => ({
  chunkBook: vi.fn(),
}));

vi.mock("@/lib/rag/indexer", () => ({
  indexBook: vi.fn(),
  bookIndexExists: vi.fn(),
}));

vi.mock("@/lib/rag/parsed-epub-cache", () => ({
  getAllChapterTexts: vi.fn(),
}));

vi.mock("@/lib/rag/search", () => ({
  searchAndAssembleContext: vi.fn(),
}));

import { indexBookFromCache, askQuestion } from "@/lib/rag/orchestrator";
import { chunkBook } from "@/lib/rag/chunker";
import { indexBook, bookIndexExists } from "@/lib/rag/indexer";
import { getAllChapterTexts } from "@/lib/rag/parsed-epub-cache";
import { searchAndAssembleContext } from "@/lib/rag/search";
import type { ChunkInput, ChunkResult } from "@/lib/rag/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChapters() {
  return [
    { id: "ch-1", title: "Chapter 1", text: "A".repeat(100) },
    { id: "ch-2", title: "Chapter 2", text: "B".repeat(100) },
  ];
}

function makeChunks(): ChunkInput[] {
  return [
    {
      bookId: "book-1",
      chapterId: "ch-1",
      chapterTitle: "Chapter 1",
      chunkText: "A".repeat(100),
      position: 0,
    },
  ];
}

function makeSearchResult() {
  return {
    systemMessage: "System message with context",
    chunks: [
      {
        bookId: "book-1",
        chapterId: "ch-1",
        chapterTitle: "Chapter 1",
        chunkText: "Relevant passage.",
        rank: 0,
      },
    ] as ChunkResult[],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("indexBookFromCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw when parsed EPUB cache is empty", async () => {
    vi.mocked(getAllChapterTexts).mockReturnValue([]);

    await expect(indexBookFromCache("book-1")).rejects.toThrow(
      /no chapters in parsed EPUB cache/,
    );
  });

  it("should throw when chunking produces no chunks", async () => {
    vi.mocked(getAllChapterTexts).mockReturnValue(makeChapters());
    vi.mocked(chunkBook).mockReturnValue([]);

    await expect(indexBookFromCache("book-1")).rejects.toThrow(
      /chunking produced no chunks/,
    );
  });

  it("should chunk and index when cache has chapters", async () => {
    const chapters = makeChapters();
    const chunks = makeChunks();

    vi.mocked(getAllChapterTexts).mockReturnValue(chapters);
    vi.mocked(chunkBook).mockReturnValue(chunks);
    vi.mocked(indexBook).mockResolvedValue(undefined);

    await indexBookFromCache("book-1");

    expect(chunkBook).toHaveBeenCalledWith("book-1", chapters);
    expect(indexBook).toHaveBeenCalledWith("book-1", chunks);
  });
});

describe("askQuestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should skip indexing when book is already indexed", async () => {
    vi.mocked(bookIndexExists).mockResolvedValue(true);
    vi.mocked(searchAndAssembleContext).mockResolvedValue(makeSearchResult());

    const result = await askQuestion(
      "book-1",
      "What is the theme?",
      "My Book",
      "Author",
    );

    expect(bookIndexExists).toHaveBeenCalledWith("book-1");
    expect(getAllChapterTexts).not.toHaveBeenCalled();
    expect(result.systemMessage).toBe("System message with context");
  });

  it("should index from cache when book is not yet indexed", async () => {
    const chapters = makeChapters();
    const chunks = makeChunks();

    vi.mocked(bookIndexExists).mockResolvedValue(false);
    vi.mocked(getAllChapterTexts).mockReturnValue(chapters);
    vi.mocked(chunkBook).mockReturnValue(chunks);
    vi.mocked(indexBook).mockResolvedValue(undefined);
    vi.mocked(searchAndAssembleContext).mockResolvedValue(makeSearchResult());

    const result = await askQuestion(
      "book-1",
      "What is the theme?",
      "My Book",
      "Author",
    );

    // Should have indexed
    expect(getAllChapterTexts).toHaveBeenCalled();
    expect(chunkBook).toHaveBeenCalledWith("book-1", chapters);
    expect(indexBook).toHaveBeenCalledWith("book-1", chunks);
    // Then searched
    expect(searchAndAssembleContext).toHaveBeenCalledWith(
      "book-1",
      "What is the theme?",
      "My Book",
      "Author",
    );
    expect(result.systemMessage).toBe("System message with context");
  });

  it("should propagate indexing errors", async () => {
    vi.mocked(bookIndexExists).mockResolvedValue(false);
    vi.mocked(getAllChapterTexts).mockReturnValue([]);

    await expect(
      askQuestion("book-1", "query", "Book", "Author"),
    ).rejects.toThrow(/no chapters in parsed EPUB cache/);
  });

  it("should propagate search errors", async () => {
    vi.mocked(bookIndexExists).mockResolvedValue(true);
    vi.mocked(searchAndAssembleContext).mockRejectedValue(
      new Error("Search failed"),
    );

    await expect(
      askQuestion("book-1", "query", "Book", "Author"),
    ).rejects.toThrow("Search failed");
  });

  it("should pass bookId, query, title, and author to search", async () => {
    vi.mocked(bookIndexExists).mockResolvedValue(true);
    vi.mocked(searchAndAssembleContext).mockResolvedValue(makeSearchResult());

    await askQuestion("book-42", "Who is Alice?", "Wonderland", "Carroll");

    expect(searchAndAssembleContext).toHaveBeenCalledWith(
      "book-42",
      "Who is Alice?",
      "Wonderland",
      "Carroll",
    );
  });
});
