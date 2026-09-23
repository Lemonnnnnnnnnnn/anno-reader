/**
 * Tests for the background quick-translate flow (translate → auto-note).
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { useQuickTranslateStore } from "@/stores/useQuickTranslateStore";
import type { AIConfig } from "../types";

const { mockRunTranslation, mockCreateNote, mockUpdateNote, mockGetNotesForChapter } =
  vi.hoisted(() => ({
    mockRunTranslation: vi.fn(),
    mockCreateNote: vi.fn(),
    mockUpdateNote: vi.fn(),
    mockGetNotesForChapter: vi.fn(),
  }));

vi.mock("../translation-runner", () => ({
  runTranslationStream: mockRunTranslation,
}));

vi.mock("@/lib/annotations", () => ({
  createNote: mockCreateNote,
  updateNote: mockUpdateNote,
  getNotesForChapter: mockGetNotesForChapter,
}));

import { quickTranslateSelectionToNote } from "../quick-translate";

const config = {} as AIConfig;

const PARAMS = {
  bookId: "book_1",
  chapterHref: "chapter1.xhtml",
  selectedText: "heterogeneous",
  startOffset: 0,
  endOffset: 5,
  sentence: "A heterogeneous system.",
  chapterText: "chapter text",
  config,
};

/** generateCfiRange() is position-based and ignores the chapter href. */
const CFI = "epubcfi(/6/4[chap01]!/4/2:0,5)";

beforeEach(() => {
  vi.clearAllMocks();
  useQuickTranslateStore.setState({ status: "idle", runId: 0 });
  mockRunTranslation.mockResolvedValue({ translation: "异构的", provider: { id: "p1" } });
  mockGetNotesForChapter.mockReturnValue([]);
  mockCreateNote.mockResolvedValue({ id: "note_new" });
});

describe("quickTranslateSelectionToNote", () => {
  it("translates with the selection context and stores the result as a note", async () => {
    const noteId = await quickTranslateSelectionToNote(PARAMS);

    expect(mockRunTranslation).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "heterogeneous",
        targetLanguage: "Chinese",
        chapterText: "chapter text",
        offset: 0,
        selectionSentence: "A heterogeneous system.",
        config,
      }),
    );
    expect(mockCreateNote).toHaveBeenCalledWith(
      "book_1",
      "chapter1.xhtml",
      CFI,
      "heterogeneous",
      "异构的",
    );
    expect(noteId).toBe("note_new");
    expect(useQuickTranslateStore.getState().status).toBe("saved");
  });

  it("updates the existing note for the same selection instead of duplicating it", async () => {
    mockGetNotesForChapter.mockReturnValue([{ id: "note_old", cfiRange: CFI }]);

    const noteId = await quickTranslateSelectionToNote(PARAMS);

    expect(mockUpdateNote).toHaveBeenCalledWith("note_old", "异构的", "book_1");
    expect(mockCreateNote).not.toHaveBeenCalled();
    expect(noteId).toBe("note_old");
  });

  it("creates a note when the chapter has notes for other selections only", async () => {
    mockGetNotesForChapter.mockReturnValue([
      { id: "note_other", cfiRange: "epubcfi(/6/4[chap01]!/4/2:9,12)" },
    ]);

    await quickTranslateSelectionToNote(PARAMS);

    expect(mockGetNotesForChapter).toHaveBeenCalledWith("chapter1.xhtml", "book_1");
    expect(mockCreateNote).toHaveBeenCalledTimes(1);
    expect(mockUpdateNote).not.toHaveBeenCalled();
  });

  it("reports failure and writes no note when the translation fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRunTranslation.mockRejectedValue(new Error("No AI provider configured"));

    const noteId = await quickTranslateSelectionToNote(PARAMS);

    expect(noteId).toBeNull();
    expect(mockCreateNote).not.toHaveBeenCalled();
    expect(mockUpdateNote).not.toHaveBeenCalled();
    expect(useQuickTranslateStore.getState().status).toBe("error");
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("treats an empty translation as a failure", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRunTranslation.mockResolvedValue({ translation: "   ", provider: { id: "p1" } });

    expect(await quickTranslateSelectionToNote(PARAMS)).toBeNull();
    expect(mockCreateNote).not.toHaveBeenCalled();
    expect(useQuickTranslateStore.getState().status).toBe("error");
    consoleError.mockRestore();
  });

  it("leaves the chip to a newer run while still storing the note", async () => {
    let release: (value: { translation: string; provider: unknown }) => void = () => {};
    mockRunTranslation.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve as typeof release;
        }),
    );

    const pending = quickTranslateSelectionToNote(PARAMS);
    const newerRunId = useQuickTranslateStore.getState().begin();

    release({ translation: "异构的", provider: { id: "p1" } });
    await pending;

    const state = useQuickTranslateStore.getState();
    expect(state.status).toBe("translating");
    expect(state.runId).toBe(newerRunId);
    expect(mockCreateNote).toHaveBeenCalledTimes(1);
  });
});
