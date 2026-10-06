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
import { KEYBOARD_ACTIONS } from "@/lib/keyboard";
import { parseHotkey } from "@tanstack/react-hotkeys";

const RESTORE_MIN_FRAME_COUNT = 4;
const RESTORE_STABLE_FRAME_COUNT = 3;
const RESTORE_MAX_FRAME_COUNT = 60;

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
// Keyboard forwarder script
// ---------------------------------------------------------------------------

/**
 * Script injected into the iframe srcdoc to forward keyboard events to parent.
 * This allows keyboard navigation (arrow keys, j/k vim keys) to work even
 * when the iframe has focus (e.g., after clicking inside the chapter content).
 *
 * - ArrowLeft/ArrowRight: forwarded for chapter navigation
 * - ArrowUp/ArrowDown: forwarded for scroll control, with default prevented
 *   to avoid double-scrolling (parent handles smooth scrolling)
 * - j/k: forwarded for vim-like scroll control
 * - keyup: forwarded so parent can stop smooth scrolling when key is released
 */
export const KEYBOARD_FORWARDER_SCRIPT = `
<script>
(function() {
  var shortcuts = ${JSON.stringify(KEYBOARD_ACTIONS.filter((action) => action.scope === "navigation" || action.scope === "selection").flatMap((action) => action.defaults.map((binding) => parseHotkey(binding))))};
  var blocked = false;
  window.addEventListener('message', function(e) {
    if (e.source !== window.parent || !e.data || e.data.type !== 'keyboard-config') return;
    shortcuts = e.data.shortcuts;
    blocked = e.data.blocked;
  });
  function isTyping(e) {
    var el = e.target;
    return el && (el.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') || el.isContentEditable);
  }
  function matches(e, shortcut) {
    if (!!e.ctrlKey !== shortcut.ctrl || !!e.metaKey !== shortcut.meta || !!e.altKey !== shortcut.alt || !!e.shiftKey !== shortcut.shift) return false;
    if (shortcut.code) return e.code === shortcut.code;
    var key = e.key === ' ' ? 'Space' : e.key;
    if (key.toLowerCase() === shortcut.key.toLowerCase()) return true;
    // Option/dead-key input may change the produced character on some layouts.
    return e.code && e.code.indexOf('Key') === 0 && e.code.slice(3).toLowerCase() === shortcut.key.toLowerCase() && (e.altKey || e.key === 'Dead');
  }

  window.addEventListener('keydown', function(e) {
    if (blocked || e.isComposing || e.getModifierState('AltGraph') || isTyping(e) || !shortcuts.some(function(shortcut) { return matches(e, shortcut); })) return;
    e.preventDefault();

    window.parent.postMessage({
      type: 'iframe-keydown',
      key: e.key, code: e.code, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, shiftKey: e.shiftKey, repeat: e.repeat
    }, '*');
  });

  window.addEventListener('keyup', function(e) {
    window.parent.postMessage({
      type: 'iframe-keyup',
      key: e.key, code: e.code, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, shiftKey: e.shiftKey
    }, '*');
  });
  window.parent.postMessage({ type: 'iframe-keyboard-ready' }, '*');
})();
</script>`;

/**
 * Inject the keyboard forwarder script into an srcdoc HTML string.
 * Appends the script just before the closing </body> tag.
 */
export function injectKeyboardScript(srcdoc: string): string {
  const closingBody = "</body>";
  const idx = srcdoc.lastIndexOf(closingBody);
  if (idx === -1) {
    // No closing body tag — append at end
    return srcdoc + KEYBOARD_FORWARDER_SCRIPT;
  }
  return srcdoc.slice(0, idx) + KEYBOARD_FORWARDER_SCRIPT + srcdoc.slice(idx);
}

// ---------------------------------------------------------------------------
// Pointer forwarder script
// ---------------------------------------------------------------------------

/** Message shape posted from the iframe pointer forwarder script */
export interface PointerMoveMessage {
  type: "pointer-move";
  clientY: number;
}

/**
 * Script injected into the iframe srcdoc to forward pointer positions.
 *
 * The chapter iframe covers the whole window, so pointermove events over the
 * book content are dispatched inside the iframe and never reach the parent
 * window — where useAutoHideChrome listens to reveal the floating header and
 * footer. This relays each move (throttled to one postMessage per animation
 * frame) so the parent can apply the same edge-zone logic.
 */
export const POINTER_FORWARDER_SCRIPT = `
<script>
(function() {
  var pendingY = null;
  var rafId = 0;

  window.addEventListener('pointermove', function(e) {
    pendingY = e.clientY;
    if (rafId) return;
    rafId = window.requestAnimationFrame(function() {
      rafId = 0;
      window.parent.postMessage({
        type: 'pointer-move',
        clientY: pendingY
      }, '*');
    });
  }, { passive: true });
})();
</script>`;

/**
 * Inject the pointer forwarder script into an srcdoc HTML string.
 * Appends the script just before the closing </body> tag.
 */
export function injectPointerScript(srcdoc: string): string {
  const closingBody = "</body>";
  const idx = srcdoc.lastIndexOf(closingBody);
  if (idx === -1) {
    // No closing body tag — append at end
    return srcdoc + POINTER_FORWARDER_SCRIPT;
  }
  return srcdoc.slice(0, idx) + POINTER_FORWARDER_SCRIPT + srcdoc.slice(idx);
}

// ---------------------------------------------------------------------------
// CFI parsing and scroll helpers
// ---------------------------------------------------------------------------

/**
 * Parse a pseudo-CFI range string to extract start and end character offsets.
 * Format: "epubcfi(/6/4[chap01]!/4/2:100,200)"
 * Returns { start, end } or null if parsing fails.
 */
export function parseCfiOffsets(cfi: string): { start: number; end: number } | null {
  const match = cfi.match(/:(\d+),(\d+)\)$/);
  if (!match) return null;
  return { start: parseInt(match[1], 10), end: parseInt(match[2], 10) };
}

/**
 * Scroll an iframe to the position of text at the given character offset.
 * Uses TreeWalker to find the text node containing the offset, then scrolls to it.
 *
 * @param iframe - The iframe element containing the chapter content
 * @param charOffset - The character offset within the document body text
 * @param behavior - Scroll behavior: 'auto' for instant, 'smooth' for animated
 * @returns true if scroll was successful, false otherwise
 */
export function scrollToCharOffset(
  iframe: HTMLIFrameElement,
  charOffset: number,
  behavior: ScrollBehavior = "smooth",
): boolean {
  const doc = iframe.contentWindow?.document;
  if (!doc?.body) return false;

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
  let currentOffset = 0;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const nodeLen = node.textContent?.length ?? 0;

    if (currentOffset + nodeLen > charOffset) {
      // Found the text node containing our offset
      const range = doc.createRange();
      const localOffset = charOffset - currentOffset;
      range.setStart(node, localOffset);
      range.setEnd(node, Math.min(localOffset + 1, nodeLen));

      // Get the bounding rect of the range
      const rect = range.getBoundingClientRect();
      const iframeRect = iframe.getBoundingClientRect();

      // Calculate the scroll position to center the element in view
      const viewportHeight = iframe.contentWindow?.innerHeight ?? iframeRect.height;
      const targetScrollY = rect.top + (iframe.contentWindow?.scrollY ?? 0) - viewportHeight / 3;

      iframe.contentWindow?.scrollTo({
        top: Math.max(0, targetScrollY),
        behavior,
      });

      return true;
    }

    currentOffset += nodeLen;
  }

  return false;
}

/**
 * Scroll an iframe to the element with the given anchor ID.
 * Uses getElementById with fallback to name attribute lookup.
 *
 * @param iframe - The iframe element containing the chapter content
 * @param anchorId - The element ID or name attribute to scroll to
 * @param behavior - Scroll behavior: 'auto' for instant, 'smooth' for animated
 * @returns true if element was found and scrolled to, false otherwise
 */
export function scrollToAnchor(
  iframe: HTMLIFrameElement,
  anchorId: string,
  behavior: ScrollBehavior = "smooth",
): boolean {
  const doc = iframe.contentWindow?.document;
  if (!doc?.body) return false;

  // Try getElementById first
  let element = doc.getElementById(anchorId);

  // Fallback: try name attribute (EPUBs sometimes use <a name="...">)
  if (!element) {
    element = doc.getElementsByName(anchorId)[0] ?? null;
  }

  if (!element) return false;

  element.scrollIntoView({ behavior, block: "center" });
  return true;
}

function getWindowScrollY(win: Window): number {
  return win.scrollY || win.document.documentElement.scrollTop || 0;
}

function waitForScrollStability(win: Window, onStable: () => void): () => void {
  let frameCount = 0;
  let stableFrameCount = 0;
  let previousScrollY = getWindowScrollY(win);
  let frameId: number | null = null;
  let cancelled = false;

  const check = () => {
    if (cancelled) return;

    const currentScrollY = getWindowScrollY(win);
    frameCount += 1;

    if (Math.abs(currentScrollY - previousScrollY) < 1) {
      stableFrameCount += 1;
    } else {
      stableFrameCount = 0;
      previousScrollY = currentScrollY;
    }

    const waitedLongEnough = frameCount >= RESTORE_MIN_FRAME_COUNT;
    const isStable = stableFrameCount >= RESTORE_STABLE_FRAME_COUNT;
    const hitFrameLimit = frameCount >= RESTORE_MAX_FRAME_COUNT;

    if ((waitedLongEnough && isStable) || hitFrameLimit) {
      onStable();
      return;
    }

    frameId = win.requestAnimationFrame(check);
  };

  frameId = win.requestAnimationFrame(check);

  return () => {
    cancelled = true;
    if (frameId !== null) {
      win.cancelAnimationFrame(frameId);
    }
  };
}

// ---------------------------------------------------------------------------
// useScrollTracking hook
// ---------------------------------------------------------------------------

export function useScrollTracking(chapterHref: string) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const setScrollPosition = useBookStore((state) => state.setScrollPosition);
  const setPendingScrollCfi = useBookStore((state) => state.setPendingScrollCfi);
  const setPendingScrollAnchor = useBookStore((state) => state.setPendingScrollAnchor);
  const setPendingScrollY = useBookStore((state) => state.setPendingScrollY);

  // Track whether we're restoring scroll (to avoid feedback loop)
  const isRestoringRef = useRef(false);
  // Track the chapter we last restored for
  const restoredChapterRef = useRef<string | null>(null);
  const restoreCleanupRef = useRef<(() => void) | null>(null);

  const finishScrollRestore = useCallback(() => {
    isRestoringRef.current = false;
    restoreCleanupRef.current = null;
  }, []);

  const runScrollRestore = useCallback(
    (iframe: HTMLIFrameElement, restore: () => void) => {
      const win = iframe.contentWindow;
      if (!win) {
        finishScrollRestore();
        return;
      }

      restoreCleanupRef.current?.();

      let stabilityCleanup: (() => void) | null = null;
      let frameId: number | null = win.requestAnimationFrame(() => {
        frameId = null;
        restore();
        stabilityCleanup = waitForScrollStability(win, finishScrollRestore);
        restoreCleanupRef.current = () => {
          stabilityCleanup?.();
        };
      });

      restoreCleanupRef.current = () => {
        if (frameId !== null) {
          win.cancelAnimationFrame(frameId);
        }
        stabilityCleanup?.();
      };
    },
    [finishScrollRestore],
  );

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
   * Also handles pending CFI-based navigation from annotations.
   */
  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    // Check for pending CFI scroll (from annotation navigation)
    const { pendingScrollCfi } = useBookStore.getState().ui;
    if (pendingScrollCfi) {
      isRestoringRef.current = true;
      restoredChapterRef.current = chapterHref;

      // Clear the pending CFI immediately to avoid re-processing
      setPendingScrollCfi(null);

      runScrollRestore(iframe, () => {
        const offsets = parseCfiOffsets(pendingScrollCfi);
        if (offsets) {
          // Scroll to the middle of the annotation range
          const midOffset = Math.floor((offsets.start + offsets.end) / 2);
          scrollToCharOffset(iframe, midOffset, "smooth");
        }
      });
      return;
    }

    // Check for pending anchor scroll (from link navigation)
    const { pendingScrollAnchor } = useBookStore.getState().ui;
    if (pendingScrollAnchor) {
      isRestoringRef.current = true;
      restoredChapterRef.current = chapterHref;

      // Clear the pending anchor immediately
      setPendingScrollAnchor(null);

      runScrollRestore(iframe, () => {
        scrollToAnchor(iframe, pendingScrollAnchor, "smooth");
      });
      return;
    }

    // Check for pending scrollY (from link back navigation)
    const { pendingScrollY } = useBookStore.getState().ui;
    if (pendingScrollY !== null && pendingScrollY !== undefined) {
      isRestoringRef.current = true;
      restoredChapterRef.current = chapterHref;

      // Clear the pending scrollY immediately
      setPendingScrollY(null);

      runScrollRestore(iframe, () => {
        iframe.contentWindow?.scrollTo({
          top: pendingScrollY,
          behavior: "smooth",
        });
      });
      return;
    }

    // Otherwise, restore saved scroll position if available
    const savedPosition = useBookStore.getState().ui.scrollPosition;
    if (savedPosition > 0 && restoredChapterRef.current !== chapterHref) {
      isRestoringRef.current = true;
      restoredChapterRef.current = chapterHref;

      runScrollRestore(iframe, () => {
        iframe.contentWindow?.scrollTo({
          top: savedPosition,
          behavior: "auto", // Instant for restoration, not smooth
        });
      });
    } else {
      // New chapter without saved position — scroll to top
      restoredChapterRef.current = chapterHref;
    }
  }, [
    chapterHref,
    runScrollRestore,
    setPendingScrollCfi,
    setPendingScrollAnchor,
    setPendingScrollY,
  ]);

  /**
   * Reset restoration tracking when chapter changes.
   * This ensures we attempt restoration for the new chapter.
   */
  useEffect(() => {
    restoredChapterRef.current = null;

    return () => {
      restoreCleanupRef.current?.();
      restoreCleanupRef.current = null;
      isRestoringRef.current = false;
    };
  }, [chapterHref]);

  return { iframeRef, handleIframeLoad };
}
