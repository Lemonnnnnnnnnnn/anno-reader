/**
 * Tests for the quick-translate status chip.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { useQuickTranslateStore } from "@/stores/useQuickTranslateStore";
import { QuickTranslateChip } from "..";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  useQuickTranslateStore.setState({ status: "idle", runId: 0 });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<QuickTranslateChip />);
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("QuickTranslateChip", () => {
  it("renders nothing while idle", () => {
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("shows a spinner while translating", () => {
    act(() => {
      useQuickTranslateStore.getState().begin();
    });

    const chip = container.querySelector('[role="status"]');
    expect(chip?.getAttribute("aria-live")).toBe("polite");
    expect(chip?.textContent).toContain("Translating…");
    expect(chip?.querySelector(".animate-spin")).not.toBeNull();
  });

  it("confirms a saved note and dismisses itself", () => {
    vi.useFakeTimers();
    act(() => {
      const runId = useQuickTranslateStore.getState().begin();
      useQuickTranslateStore.getState().settle(runId, "saved");
    });
    expect(container.textContent).toContain("Note saved");

    act(() => {
      vi.advanceTimersByTime(1400 + 400);
    });

    expect(useQuickTranslateStore.getState().status).toBe("idle");
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("shows a short failure message without offering a retry", () => {
    vi.useFakeTimers();
    act(() => {
      const runId = useQuickTranslateStore.getState().begin();
      useQuickTranslateStore.getState().settle(runId, "error");
    });

    const chip = container.querySelector('[role="status"]');
    expect(chip?.textContent).toContain("Translation failed");
    expect(chip?.querySelector("button")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(2600 + 400);
    });
    expect(useQuickTranslateStore.getState().status).toBe("idle");
  });
});
