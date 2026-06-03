import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useBookStore } from "@/stores/useBookStore";
import type { ProgressData } from "@/lib/progress/types";

// Mock Tauri fs plugin
vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  exists: vi.fn(),
  mkdir: vi.fn(),
}));

// Mock storage config
vi.mock("@/lib/storage/config", () => ({
  readConfig: vi.fn().mockResolvedValue({ dataDir: "/mock/data" }),
}));

// Import mocked modules
import { readTextFile, writeTextFile, exists } from "@tauri-apps/plugin-fs";

describe("Progress Persistence", () => {
  beforeEach(() => {
    // Reset store to initial state
    useBookStore.setState({
      readingProgress: null,
      ui: {
        currentChapter: null,
        currentChapterIndex: 0,
        scrollPosition: 0,
        pendingScrollCfi: null,
        theme: "light",
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("restoreProgress", () => {
    it("should restore progress from file to Zustand store", async () => {
      // Arrange: Mock saved progress data
      const savedProgress: ProgressData = {
        bookId: "test-book-123",
        filePath: "/path/to/book.epub",
        chapterHref: "Text/chapter3.xhtml",
        chapterIndex: 2,
        scrollOffset: 500,
        percentage: 45,
        lastUpdated: "2026-06-03T10:00:00Z",
      };

      // Mock file exists and returns saved progress
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(readTextFile).mockResolvedValue(JSON.stringify(savedProgress));

      // Act: Call restoreProgress
      const { restoreProgress } = await import("@/lib/progress");
      const result = await restoreProgress("test-book-123", "/path/to/book.epub");

      // Assert: Function returns restored data
      expect(result).toEqual(savedProgress);

      // Assert: Store was updated with restored progress
      const store = useBookStore.getState();
      expect(store.readingProgress).toEqual({
        bookId: "test-book-123",
        chapterHref: "Text/chapter3.xhtml",
        chapterIndex: 2,
        scrollOffset: 500,
        percentage: 45,
      });

      // Assert: UI state was updated
      expect(store.ui.currentChapter).toBe("Text/chapter3.xhtml");
      expect(store.ui.currentChapterIndex).toBe(2);
      expect(store.ui.scrollPosition).toBe(500);
    });

    it("should return null when no saved progress exists", async () => {
      // Arrange: Mock file does not exist
      vi.mocked(exists).mockResolvedValue(false);

      // Act: Call restoreProgress
      const { restoreProgress } = await import("@/lib/progress");
      const result = await restoreProgress("test-book-456", "/path/to/book.epub");

      // Assert: Function returns null
      expect(result).toBeNull();

      // Assert: Store remains unchanged
      const store = useBookStore.getState();
      expect(store.readingProgress).toBeNull();
      expect(store.ui.scrollPosition).toBe(0);
    });
  });

  describe("trackProgress", () => {
    it("should save progress when scroll position changes", async () => {
      // Arrange: Mock writeTextFile to track calls
      const writeMock = vi.mocked(writeTextFile);
      writeMock.mockResolvedValue(undefined);
      vi.mocked(exists).mockResolvedValue(true);

      // Set initial progress in store
      useBookStore.setState({
        readingProgress: {
          bookId: "test-book-123",
          chapterHref: "Text/chapter1.xhtml",
          chapterIndex: 0,
          percentage: 10,
          scrollOffset: 0,
        },
      });

      // Act: Start tracking
      const { trackProgress } = await import("@/lib/progress");
      const cleanup = trackProgress("test-book-123", "/path/to/book.epub", {
        scrollDebounceMs: 0, // No debounce for testing
      });

      // Simulate scroll position change
      useBookStore.getState().setScrollPosition(250);

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: writeTextFile was called with updated progress
      expect(writeMock).toHaveBeenCalled();
      const savedData = JSON.parse(writeMock.mock.calls[0][1] as string);
      expect(savedData.bookId).toBe("test-book-123");
      expect(savedData.scrollOffset).toBe(250);

      // Cleanup
      cleanup();
    });

    it("should save progress when chapter changes", async () => {
      // Arrange: Mock writeTextFile
      const writeMock = vi.mocked(writeTextFile);
      writeMock.mockResolvedValue(undefined);
      vi.mocked(exists).mockResolvedValue(true);

      // Set initial progress in store
      useBookStore.setState({
        readingProgress: {
          bookId: "test-book-123",
          chapterHref: "Text/chapter1.xhtml",
          chapterIndex: 0,
          percentage: 10,
          scrollOffset: 100,
        },
      });

      // Act: Start tracking
      const { trackProgress } = await import("@/lib/progress");
      const cleanup = trackProgress("test-book-123", "/path/to/book.epub");

      // Simulate chapter change
      useBookStore.getState().setCurrentChapter("Text/chapter2.xhtml", 1);

      // Wait for immediate save
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: writeTextFile was called with updated chapter
      expect(writeMock).toHaveBeenCalled();
      const savedData = JSON.parse(writeMock.mock.calls[0][1] as string);
      expect(savedData.chapterHref).toBe("Text/chapter2.xhtml");
      expect(savedData.chapterIndex).toBe(1);

      // Cleanup
      cleanup();
    });
  });
});
