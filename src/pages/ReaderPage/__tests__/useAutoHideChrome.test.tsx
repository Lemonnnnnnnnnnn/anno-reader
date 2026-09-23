/**
 * Tests for the auto-hiding reader chrome (hover zones + hide delay).
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { EDGE_ZONE, HIDE_DELAY_MS, useAutoHideChrome } from "../hooks/useAutoHideChrome";

function ChromeProbe() {
  const { headerVisible, footerVisible } = useAutoHideChrome();
  return (
    <div data-testid="chrome" data-header={headerVisible} data-footer={footerVisible} />
  );
}

let container: HTMLDivElement;
let root: Root;

function visible(): { header: boolean; footer: boolean } {
  const probe = container.querySelector('[data-testid="chrome"]')!;
  return {
    header: probe.getAttribute("data-header") === "true",
    footer: probe.getAttribute("data-footer") === "true",
  };
}

/** Dispatch a pointer move at the given viewport y. */
function movePointer(clientY: number) {
  const event = new Event("pointermove");
  Object.defineProperty(event, "clientY", { value: clientY });
  act(() => {
    window.dispatchEvent(event);
  });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<ChromeProbe />);
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("useAutoHideChrome", () => {
  it("starts with both bars hidden", () => {
    expect(visible()).toEqual({ header: false, footer: false });
  });

  it("reveals each bar from its own edge", () => {
    movePointer(EDGE_ZONE - 1);
    expect(visible()).toEqual({ header: true, footer: false });

    movePointer(window.innerHeight - EDGE_ZONE + 1);
    expect(visible().footer).toBe(true);

    advance(HIDE_DELAY_MS);
    expect(visible()).toEqual({ header: false, footer: true });
  });

  it("hides a bar again after the pointer leaves its zone", () => {
    movePointer(0);
    expect(visible().header).toBe(true);

    movePointer(window.innerHeight / 2);
    // Still visible during the grace period
    expect(visible().header).toBe(true);

    advance(HIDE_DELAY_MS);
    expect(visible().header).toBe(false);
  });

  it("keeps a bar visible while the pointer stays inside its zone", () => {
    movePointer(EDGE_ZONE - 1);
    advance(HIDE_DELAY_MS * 3);
    expect(visible().header).toBe(true);
  });

  it("cancels a pending hide when the pointer comes back", () => {
    movePointer(EDGE_ZONE - 1);
    movePointer(window.innerHeight / 2);
    advance(HIDE_DELAY_MS / 2);
    movePointer(EDGE_ZONE - 1);
    advance(HIDE_DELAY_MS);

    expect(visible().header).toBe(true);
  });

  it("stops reacting after unmount", () => {
    act(() => root.unmount());
    movePointer(0);
    expect(container.querySelector('[data-testid="chrome"]')).toBeNull();
  });
});
