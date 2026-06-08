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

/** Check if the user is typing in an input/textarea — don't hijack keys */
function isTypingInInput(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    (el as HTMLElement).isContentEditable
  );
}

/**
 * Build a ScrollTarget that reads/writes the scroll position
 * inside an iframe's content window.
 */
function getIframeScrollTarget(
  iframe: HTMLIFrameElement,
): ScrollTarget | null {
  const win = iframe.contentWindow;
  if (!win) return null;

  return {
    getScrollTop: () => win.scrollY || win.document.documentElement.scrollTop || 0,
    setScrollTop: (top: number) => win.scrollTo({ top, behavior: "auto" }),
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVimScroll(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
) {
  const scrollerRef = useRef<SmoothScroller | null>(null);

  // Lazily create / update the scroller when iframe becomes available
  const getScroller = useCallback((): SmoothScroller | null => {
    const iframe = iframeRef.current;
    if (!iframe) return null;

    const target = getIframeScrollTarget(iframe);
    if (!target) return null;

    if (!scrollerRef.current) {
      scrollerRef.current = new SmoothScroller(target);
    } else {
      scrollerRef.current.updateTarget(target);
    }

    return scrollerRef.current;
  }, [iframeRef]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingInInput()) return;

      const scroller = getScroller();
      if (!scroller) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        scroller.scrollDown();
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        scroller.scrollUp();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "j" || e.key === "k" || e.key === "ArrowUp" || e.key === "ArrowDown") {
        scrollerRef.current?.stopScroll();
      }
    };

    // Handle arrow keys forwarded from iframe via postMessage
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type !== "keydown") return;

      const scroller = getScroller();
      if (!scroller) return;

      if (e.data.key === "ArrowDown") {
        scroller.scrollDown();
      } else if (e.data.key === "ArrowUp") {
        scroller.scrollUp();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("message", handleMessage);
      scrollerRef.current?.stopScroll();
    };
  }, [getScroller]);
}
