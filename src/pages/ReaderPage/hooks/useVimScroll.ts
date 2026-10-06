/**
 * Keyboard smooth scrolling hook for ReaderPage.
 *
 * Handles j/k keys and ArrowUp/ArrowDown to smoothly scroll the chapter
 * iframe content.
 * - j / ArrowDown: scroll down
 * - k / ArrowUp: scroll up
 *
 * Based on HMangaMaster's ScrollService + SmoothScroller pattern,
 * adapted for React hooks and iframe-based scrolling.
 */

import { useEffect, useRef, useCallback } from "react";
import { isTypingTarget, type KeyboardInput } from "@/lib/keyboard";
import { matchesAction, useKeyboardStore } from "@/stores/useKeyboardStore";
import { useOverlayStore } from "@/stores/useOverlayStore";

// ---------------------------------------------------------------------------
// SmoothScroller — requestAnimationFrame-based smooth scroll engine
// ---------------------------------------------------------------------------

interface ScrollTarget {
  getScrollTop: () => number;
  setScrollTop: (top: number) => void;
}

class SmoothScroller {
  private target: ScrollTarget;
  private targetScrollPos: number;
  private isScrolling: boolean;
  private scrollDirection: number; // 0: none, 1: down, -1: up
  private scrollAmount: number;
  private scrollDuration: number;
  private frameDuration: number;
  private rafId: number | null = null;

  constructor(target: ScrollTarget, scrollAmount = 48, scrollDuration = 200) {
    this.target = target;
    this.targetScrollPos = target.getScrollTop();
    this.isScrolling = false;
    this.scrollDirection = 0;
    this.scrollAmount = scrollAmount;
    this.scrollDuration = scrollDuration;
    this.frameDuration = 16; // ~60fps
  }

  updateTarget(target: ScrollTarget) {
    this.target = target;
  }

  private animateScroll = () => {
    if (this.scrollDirection === 0) {
      this.isScrolling = false;
      return;
    }

    const currentPos = this.target.getScrollTop();
    const distance = this.targetScrollPos - currentPos;

    // Close enough — snap and check for queued direction
    if (Math.abs(distance) < 0.5) {
      this.target.setScrollTop(this.targetScrollPos);
      this.isScrolling = false;

      // If direction changed mid-animation, continue
      if (this.scrollDirection !== 0) {
        this.startScroll(this.scrollDirection);
      }
      return;
    }

    // Calculate per-frame scroll increment
    const frameCount = this.scrollDuration / this.frameDuration;
    const scrollThisFrame =
      (this.scrollAmount / frameCount) * this.scrollDirection;

    this.target.setScrollTop(currentPos + scrollThisFrame);
    this.rafId = requestAnimationFrame(this.animateScroll);
  };

  startScroll = (direction: number) => {
    this.scrollDirection = direction;
    this.targetScrollPos =
      this.target.getScrollTop() + this.scrollAmount * direction;

    if (!this.isScrolling) {
      this.isScrolling = true;
      this.rafId = requestAnimationFrame(this.animateScroll);
    }
  };

  stopScroll = () => {
    this.scrollDirection = 0;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.isScrolling = false;
  };

  scrollDown = () => this.startScroll(1);
  scrollUp = () => this.startScroll(-1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a ScrollTarget for an iframe (EPUB) or a scrollable element (PDF).
 *
 * - HTMLIFrameElement: reads/writes the scroll position of the iframe's
 *   content window.
 * - Any other HTMLElement (e.g. the PdfViewer scroll container): reads/
 *   writes the element's own scrollTop.
 */
function getScrollTarget(el: HTMLElement): ScrollTarget | null {
  if (el instanceof HTMLIFrameElement) {
    const win = el.contentWindow;
    if (!win) return null;

    return {
      getScrollTop: () => win.scrollY || win.document.documentElement.scrollTop || 0,
      setScrollTop: (top: number) => win.scrollTo({ top, behavior: "auto" }),
    };
  }

  return {
    getScrollTop: () => el.scrollTop,
    setScrollTop: (top: number) => {
      el.scrollTop = top;
    },
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Vim-like smooth scrolling for ReaderPage.
 *
 * @param scrollElRef - Ref to the active scroll container: the chapter
 *        iframe (EPUB) or the PDF page scroll div (PDF). Whoever mounts
 *        last sets the ref (they are never mounted simultaneously).
 */
export function useVimScroll(
  scrollElRef: React.RefObject<HTMLElement | null>,
) {
  const scrollerRef = useRef<SmoothScroller | null>(null);

  // Lazily create / update the scroller when the scroll element is available
  const getScroller = useCallback((): SmoothScroller | null => {
    const el = scrollElRef.current;
    if (!el) return null;

    const target = getScrollTarget(el);
    if (!target) return null;

    if (!scrollerRef.current) {
      scrollerRef.current = new SmoothScroller(target);
    } else {
      scrollerRef.current.updateTarget(target);
    }

    return scrollerRef.current;
  }, [scrollElRef]);

  useEffect(() => {
    const scroll = (event: KeyboardInput) => {
      if (useOverlayStore.getState().openCount > 0 || isTypingTarget()) return false;
      const direction = matchesAction("scrollDown", event) ? 1 : matchesAction("scrollUp", event) ? -1 : 0;
      if (!direction) return false;
      const scroller = getScroller();
      if (!scroller) return false;
      scroller.startScroll(direction);
      return true;
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTypingTarget(e.target)) return;
      if (scroll(e)) e.preventDefault();
    };

    const handleKeyUp = () => {
      scrollerRef.current?.stopScroll();
    };

    // Handle keys forwarded from iframe via postMessage
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "iframe-keydown") {
        if (typeof e.data.key === "string") scroll(e.data);
      } else if (e.data?.type === "iframe-keyup") {
        scrollerRef.current?.stopScroll();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("message", handleMessage);
    const unsubscribeKeyboard = useKeyboardStore.subscribe(() => scrollerRef.current?.stopScroll());
    const unsubscribeOverlay = useOverlayStore.subscribe(() => scrollerRef.current?.stopScroll());

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("message", handleMessage);
      scrollerRef.current?.stopScroll();
      unsubscribeKeyboard();
      unsubscribeOverlay();
    };
  }, [getScroller]);
}
