/**
 * Note position tracking hook for VerticalScroller.
 *
 * Reads note marker positions from the iframe DOM using MutationObserver
 * and debounced position reading. Returns a Map of noteId → offsetTop
 * and the current document height.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useBookStore } from "@/stores/useBookStore";
import { useShallow } from "zustand/shallow";

const DEBOUNCE_MS = 50;
const MARKER_SELECTOR = ".anno-note-marker[data-note-id]";

// ---------------------------------------------------------------------------
// useNotePositions hook
// ---------------------------------------------------------------------------

/**
 * Track vertical positions of note markers inside an iframe.
 *
 * Uses MutationObserver on the iframe body to detect when markers are
 * added/removed, then debounces a position read that builds a Map
 * of noteId → offsetTop values.
 *
 * @param iframeRef  - Ref to the chapter iframe element
 * @param chapterHref - Current chapter href, used to filter notes from store
 * @returns positions Map (noteId → offsetTop in px) and docHeight (scrollHeight)
 */
export function useNotePositions(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  chapterHref: string,
): { positions: Map<string, number>; docHeight: number } {
  const [positions, setPositions] = useState<Map<string, number>>(new Map());
  const [docHeight, setDocHeight] = useState<number>(0);

  // Get notes for the current chapter from Zustand store
  const chapterNotes = useBookStore(
    useShallow((state) =>
      state.notes.filter((n) => n.chapterHref === chapterHref),
    ),
  );

  // Build a Set of valid note IDs for the current chapter for O(1) lookup
  const chapterNoteIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    chapterNoteIds.current = new Set(chapterNotes.map((n) => n.id));
  }, [chapterNotes]);

  // Debounce timer ref — cleared on cleanup
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Read all note marker positions from the iframe DOM.
   * Filters markers to only include notes belonging to the current chapter.
   */
  const readPositions = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    const body = doc?.body;
    if (!body || !doc) return;

    const markers = body.querySelectorAll<HTMLElement>(MARKER_SELECTOR);
    const next = new Map<string, number>();

    for (let i = 0; i < markers.length; i++) {
      const marker = markers[i];
      const noteId = marker.dataset.noteId;
      if (noteId && chapterNoteIds.current.has(noteId)) {
        next.set(noteId, marker.offsetTop);
      }
    }

    setPositions(next);
    setDocHeight(doc.documentElement.scrollHeight);
  }, [iframeRef]);

  /**
   * Debounced position read — schedules a read after DEBOUNCE_MS.
   * Cancels any pending read before scheduling a new one.
   */
  const debouncedRead = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      readPositions();
    }, DEBOUNCE_MS);
  }, [readPositions]);

  // Set up MutationObserver when iframe becomes available
  useEffect(() => {
    const iframe = iframeRef.current;
    const body = iframe?.contentDocument?.body;
    if (!body) return;

    // Initial position read
    readPositions();

    const observer = new MutationObserver(debouncedRead);
    observer.observe(body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [iframeRef, chapterHref, readPositions, debouncedRead]);

  // Re-read positions when the set of chapter notes changes
  // (e.g. note added/removed) — markers may already exist in DOM
  useEffect(() => {
    debouncedRead();
  }, [chapterNotes, debouncedRead]);

  return { positions, docHeight };
}
