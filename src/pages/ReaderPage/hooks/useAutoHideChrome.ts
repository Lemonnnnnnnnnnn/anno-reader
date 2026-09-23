/**
 * Auto-hiding reader chrome.
 *
 * The reader is content-first: the header and footer float over the page and
 * fade in when the pointer reaches the matching window edge, so neither needs
 * a toggle button. Each bar is independent and fades out once the pointer
 * leaves its zone.
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

    const handlePointerMove = (event: PointerEvent) => {
      if (event.clientY <= EDGE_ZONE) reveal("header");
      else scheduleHide("header");

      if (event.clientY >= window.innerHeight - EDGE_ZONE) reveal("footer");
      else scheduleHide("footer");
    };

    window.addEventListener("pointermove", handlePointerMove);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
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
