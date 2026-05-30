/**
 * Scroll tracking hook for VerticalScroller.
 *
 * Handles:
 * - Listening for scroll position messages from iframe
 * - Restoring saved scroll position when loading a chapter
 * - Tracking restoration state to avoid feedback loops
 * - Scroll tracker script injection
 */

import { useEffect, useRef, useCallback } from "react";
import { useBookStore } from "@/stores/useBookStore";

// ---------------------------------------------------------------------------
// Scroll tracker script
// ---------------------------------------------------------------------------

/** Message shape posted from the iframe scroll tracker script */
export interface ScrollMessage {
  type: "scroll-position";
  scrollY: number;
  maxScroll: number;
}

/**
 * Script injected into the iframe srcdoc to track scroll position.
 * Uses requestAnimationFrame for smooth, throttled updates.
 * Posts messages to parent window when scroll position changes.
 */
export const SCROLL_TRACKER_SCRIPT = `
<script>
(function() {
  var ticking = false;
  var lastScrollY = 0;

  function postScroll() {
    var scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    var docHeight = document.documentElement.scrollHeight || 0;
    var maxScroll = Math.max(0, docHeight - window.innerHeight);

    // Only post if position actually changed
    if (scrollY !== lastScrollY) {
      lastScrollY = scrollY;
      window.parent.postMessage({
        type: 'scroll-position',
        scrollY: scrollY,
        maxScroll: maxScroll
      }, '*');
    }
    ticking = false;
  }

  window.addEventListener('scroll', function() {
    if (!ticking) {
      window.requestAnimationFrame(postScroll);
      ticking = true;
    }
  }, { passive: true });

  // Post initial position after content loads
  window.addEventListener('load', function() {
    setTimeout(postScroll, 50);
  });
})();
</script>`;

/**
 * Inject the scroll tracker script into an srcdoc HTML string.
 * Appends the script just before the closing </body> tag.
 */
export function injectScrollScript(srcdoc: string): string {
  const closingBody = "</body>";
  const idx = srcdoc.lastIndexOf(closingBody);
  if (idx === -1) {
    // No closing body tag — append at end
    return srcdoc + SCROLL_TRACKER_SCRIPT;
  }
  return srcdoc.slice(0, idx) + SCROLL_TRACKER_SCRIPT + srcdoc.slice(idx);
}

// ---------------------------------------------------------------------------
// useScrollTracking hook
// ---------------------------------------------------------------------------

export function useScrollTracking(chapterHref: string) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const setScrollPosition = useBookStore((state) => state.setScrollPosition);

  // Track whether we're restoring scroll (to avoid feedback loop)
  const isRestoringRef = useRef(false);
  // Track the chapter we last restored for
  const restoredChapterRef = useRef<string | null>(null);

  /**
   * Handle scroll messages from the iframe.
   * Updates the Zustand store with the current scroll position.
   * Skips updates while restoring saved position.
   */
  const handleScrollMessage = useCallback(
    (event: MessageEvent) => {
      const data = event.data as ScrollMessage | undefined;
      if (!data || data.type !== "scroll-position") return;

      // Skip store updates during scroll restoration
      if (isRestoringRef.current) return;

      setScrollPosition(data.scrollY);
    },
    [setScrollPosition],
  );

  // Listen for postMessage from the iframe
  useEffect(() => {
    window.addEventListener("message", handleScrollMessage);
    return () => window.removeEventListener("message", handleScrollMessage);
  }, [handleScrollMessage]);

  /**
   * Restore scroll position after iframe loads.
   * When a chapter with saved progress loads, scroll to the saved position.
   */
  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    // Only restore if we have a saved position and haven't restored for this chapter yet
    const savedPosition = useBookStore.getState().ui.scrollPosition;
    if (savedPosition > 0 && restoredChapterRef.current !== chapterHref) {
      isRestoringRef.current = true;
      restoredChapterRef.current = chapterHref;

      // Small delay to let iframe content fully render and calculate layout
      requestAnimationFrame(() => {
        iframe.contentWindow?.scrollTo({
          top: savedPosition,
          behavior: "auto", // Instant for restoration, not smooth
        });

        // Re-enable scroll tracking after restoration
        setTimeout(() => {
          isRestoringRef.current = false;
        }, 100);
      });
    } else {
      // New chapter without saved position — scroll to top
      restoredChapterRef.current = chapterHref;
    }
  }, [chapterHref]);

  /**
   * Reset restoration tracking when chapter changes.
   * This ensures we attempt restoration for the new chapter.
   */
  useEffect(() => {
    restoredChapterRef.current = null;
  }, [chapterHref]);

  return { iframeRef, handleIframeLoad };
}
