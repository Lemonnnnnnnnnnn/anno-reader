/**
 * Auto-hiding reader chrome.
 *
 * The reader is content-first: the header and footer float over the page and
 * fade in when the pointer reaches the matching window edge, so neither needs
 * a toggle button. Each bar is independent and fades out once the pointer
 * leaves its zone.
 *
 * EPUB chapters render in a full-viewport iframe whose pointermove events are
 * dispatched inside the iframe and never reach this window, so an injected
 * forwarder script (see VerticalScroller / injectPointerScript) relays them
 * as "pointer-move" messages. Both paths feed the same edge-zone logic.
 *
 * @example
 * ```tsx
 * const { headerVisible, footerVisible } = useAutoHideChrome();
 * ```
 */

import { useEffect, useRef, useState } from "react";

/** Distance from a window edge that reveals the matching bar, in px. */
export const EDGE_ZONE = 64;

/**
 * Delay before a bar fades out after the pointer left its zone, in ms.
 * 0 hides as soon as the pointer is gone; a larger value keeps short
 * excursions (crossing the zone on the way to page content) from flickering.
 */
export const HIDE_DELAY_MS = 0;

type ChromePart = "header" | "footer";

export interface ChromeVisibility {
  /** Whether the header bar is showing */
  headerVisible: boolean;
  /** Whether the footer bar is showing */
  footerVisible: boolean;
}

export function useAutoHideChrome(): ChromeVisibility {
  const [visible, setVisible] = useState<Record<ChromePart, boolean>>({
    header: false,
    footer: false,
  });
  const hideTimers = useRef<Record<ChromePart, ReturnType<typeof setTimeout> | null>>({
    header: null,
    footer: null,
  });

  useEffect(() => {
    const timers = hideTimers.current;

    const reveal = (part: ChromePart) => {
      if (timers[part]) {
        clearTimeout(timers[part]);
        timers[part] = null;
      }
      setVisible((prev) => (prev[part] ? prev : { ...prev, [part]: true }));
    };

    const scheduleHide = (part: ChromePart) => {
      if (timers[part]) return;
      timers[part] = setTimeout(() => {
        timers[part] = null;
        setVisible((prev) => (prev[part] ? { ...prev, [part]: false } : prev));
      }, HIDE_DELAY_MS);
    };

    const applyPointerPosition = (clientY: number) => {
      if (clientY <= EDGE_ZONE) reveal("header");
      else scheduleHide("header");

      if (clientY >= window.innerHeight - EDGE_ZONE) reveal("footer");
      else scheduleHide("footer");
    };

    const handlePointerMove = (event: PointerEvent) => {
      applyPointerPosition(event.clientY);
    };

    // Forwarded moves from the chapter iframe. The iframe fills the viewport
    // (header/footer are absolutely positioned and take no layout space), so
    // its clientY maps 1:1 onto this window's coordinates.
    const handleIframePointerMove = (event: MessageEvent) => {
      const data = event.data as { type?: string; clientY?: unknown } | null;
      if (data?.type !== "pointer-move" || typeof data.clientY !== "number") return;
      applyPointerPosition(data.clientY);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("message", handleIframePointerMove);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("message", handleIframePointerMove);
      if (timers.header) clearTimeout(timers.header);
      if (timers.footer) clearTimeout(timers.footer);
      timers.header = null;
      timers.footer = null;
    };
    // The handler captures both constants; listing them re-registers the
    // listener when they are tuned, so an edited value takes effect without
    // the app having to be reloaded.
  }, [EDGE_ZONE, HIDE_DELAY_MS]);

  return { headerVisible: visible.header, footerVisible: visible.footer };
}
