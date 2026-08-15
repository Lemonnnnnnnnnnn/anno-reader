/**
 * Tests for useVimScroll — element scroll container path (PDF viewer).
 *
 * The hook must drive a plain scrollable div (not just an iframe): j/k
 * keys smooth-scroll the element's scrollTop. Regression guard for PDF
 * mode, where no iframe exists.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { useRef } from "react";
import { useVimScroll } from "../hooks/useVimScroll";

/** Test component exposing a scrollable div to the hook. */
function Probe({ divRef }: { divRef: React.RefObject<HTMLDivElement | null> }) {
  useVimScroll(divRef);
  return <div ref={divRef} data-testid="scroller" style={{ height: 200 }} />;
}

function pressKey(key: string) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  return () =>
    window.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
}

function waitFor(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

describe("useVimScroll (element container)", () => {
  it("scrolls down on j and back up on k", async () => {
    const ref = { current: null as HTMLDivElement | null };
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(<Probe divRef={ref} />);
    });
    const el = ref.current!;
    expect(el).toBeTruthy();
    el.scrollTop = 0;

    // --- j: scroll down ---
    let release = pressKey("j");
    await act(async () => {
      await waitFor(350);
    });
    release();
    const afterDown = el.scrollTop;
    expect(afterDown).toBeGreaterThan(0);

    // --- k: scroll back up ---
    release = pressKey("k");
    await act(async () => {
      await waitFor(500);
    });
    release();
    expect(el.scrollTop).toBeLessThan(afterDown);
  });

  it("ignores keys while typing in an input", async () => {
    const ref = { current: null as HTMLDivElement | null };
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(<Probe divRef={ref} />);
    });
    const el = ref.current!;

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    const release = pressKey("j");
    await act(async () => {
      await waitFor(300);
    });
    release();
    expect(el.scrollTop).toBe(0);

    input.remove();
  });

  it("does nothing when no scroll element is set", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    function NullProbe() {
      const ref = useRef<HTMLDivElement>(null);
      useVimScroll(ref);
      return null;
    }
    expect(() => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      root.render(<NullProbe />);
      const release = pressKey("j");
      release();
      root.unmount();
      container.remove();
    }).not.toThrow();
    consoleWarn.mockRestore();
  });
});
