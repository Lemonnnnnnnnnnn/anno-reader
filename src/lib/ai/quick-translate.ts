/**
 * Background "quick translate" — translate a selection without opening the
 * translation panel and record the result as a note.
 *
 * Runs outside React so the request survives the selection being cleared.
 * Progress is reported through useQuickTranslateStore for the status chip.
 */

import { generateCfiRange } from "@/lib/selection";
import { createNote, getNotesForChapter, updateNote } from "@/lib/annotations";
import { useQuickTranslateStore } from "@/stores/useQuickTranslateStore";
import { runTranslationStream } from "./translation-runner";
import type { AIConfig } from "./types";

export interface QuickTranslateParams {
  /** Book the selection belongs to */
  bookId: string;
  /** Chapter (EPUB) or page (PDF) href */
  chapterHref: string;
  /** The selected text */
  selectedText: string;
  /** Selection offsets within the chapter text */
  startOffset: number;
  endOffset: number;
  /** Sentence containing the selection (AI context) */
  sentence?: string;
  /** Plain text of the chapter/page (AI context) */
  chapterText: string | null;
  /** AI configuration snapshot */
  config: AIConfig;
}

/**
 * Translate the selection and store it as a note, without any confirmation
 * step. Re-translating the same selection updates the existing note instead
 * of adding a duplicate.
 *
 * @returns The id of the created/updated note, or null when the run failed.
 */
export async function quickTranslateSelectionToNote({
  bookId,
  chapterHref,
  selectedText,
  startOffset,
  endOffset,
  sentence,
  chapterText,
  config,
}: QuickTranslateParams): Promise<string | null> {
  const runId = useQuickTranslateStore.getState().begin();

  try {
    const cfiRange = generateCfiRange(chapterHref, startOffset, endOffset);

    const { translation } = await runTranslationStream({
      text: selectedText,
      targetLanguage: "Chinese",
      config,
      chapterText,
      offset: startOffset,
      selectionSentence: sentence,
    });

    if (!translation.trim()) {
      throw new Error("Empty translation");
    }

    // Checked after the request so a repeated run converges on one note
    // instead of racing the check.
    const existing = getNotesForChapter(chapterHref, bookId).find(
      (note) => note.cfiRange === cfiRange,
    );

    let noteId: string;
    if (existing) {
      await updateNote(existing.id, translation, bookId);
      noteId = existing.id;
    } else {
      const note = await createNote(bookId, chapterHref, cfiRange, selectedText, translation);
      noteId = note.id;
    }

    useQuickTranslateStore.getState().settle(runId, "saved");
    return noteId;
  } catch (err) {
    console.error("[quickTranslate] translation failed:", err);
    useQuickTranslateStore.getState().settle(runId, "error");
    return null;
  }
}
