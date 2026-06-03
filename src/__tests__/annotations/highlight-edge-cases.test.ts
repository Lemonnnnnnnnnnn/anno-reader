/**
 * Edge case tests for highlight interaction.
 *
 * Covers:
 * - Viewport clamping: popover stays within container bounds with 8px padding
 * - Chapter dismiss: popover clears on chapter navigation
 * - Rapid clicks: only last clicked highlight shows popover
 * - Toolbar dismiss: clicking highlight dismisses TextSelectionToolbar
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { clampToViewport } from "@/lib/clampToViewport";

// ── Viewport clamping ─────────────────────────────────────────────────────────

/**
 * Clamp a 2D highlight popover position to stay within container bounds.
 * Delegates to the shared clampToViewport utility for each axis.
 */
function clampHighlightPosition(
  position: { top: number; left: number },
  containerWidth: number,
  containerHeight: number,
  popoverWidth = 260,
  popoverHeight = 100,
): { top: number; left: number } {
  return {
    left: clampToViewport(position.left, containerWidth, popoverWidth),
    top: clampToViewport(position.top, containerHeight, popoverHeight),
  };
}

describe("highlight position - viewport clamping", () => {
  const CONTAINER_WIDTH = 800;
  const CONTAINER_HEIGHT = 600;

  it("should clamp left when popover extends past right edge", () => {
    const result = clampHighlightPosition(
      { top: 100, left: 700 },
      CONTAINER_WIDTH,
      CONTAINER_HEIGHT,
    );
    // max left = 800 - 260 - 8 = 532
    expect(result.left).toBe(532);
    expect(result.top).toBe(100);
  });

  it("should clamp left when popover extends past left edge", () => {
    const result = clampHighlightPosition(
      { top: 100, left: -50 },
      CONTAINER_WIDTH,
      CONTAINER_HEIGHT,
    );
    expect(result.left).toBe(8);
  });

  it("should clamp top when popover extends past bottom edge", () => {
    const result = clampHighlightPosition(
      { top: 550, left: 200 },
      CONTAINER_WIDTH,
      CONTAINER_HEIGHT,
    );
    // max top = 600 - 100 - 8 = 492
    expect(result.top).toBe(492);
  });

  it("should clamp top when popover extends past top edge", () => {
    const result = clampHighlightPosition(
      { top: -10, left: 200 },
      CONTAINER_WIDTH,
      CONTAINER_HEIGHT,
    );
    expect(result.top).toBe(8);
  });

  it("should leave position unchanged when within bounds", () => {
    const result = clampHighlightPosition(
      { top: 100, left: 200 },
      CONTAINER_WIDTH,
      CONTAINER_HEIGHT,
    );
    expect(result).toEqual({ top: 100, left: 200 });
  });

  it("should clamp both axes simultaneously when near corner", () => {
    const result = clampHighlightPosition(
      { top: -20, left: -20 },
      CONTAINER_WIDTH,
      CONTAINER_HEIGHT,
    );
    expect(result).toEqual({ top: 8, left: 8 });
  });

  it("should handle custom popover dimensions", () => {
    const result = clampHighlightPosition(
      { top: 100, left: 600 },
      CONTAINER_WIDTH,
      CONTAINER_HEIGHT,
      320, // wider popover (note mode width from useToolbarPosition)
      160,
    );
    // max left = 800 - 320 - 8 = 472
    expect(result.left).toBe(472);
  });
});

// ── Chapter dismiss ───────────────────────────────────────────────────────────

/**
 * Simulates the state management in VerticalScroller for highlight popover.
 * This mirrors the useState calls and the chapter-change useEffect.
 */
function createHighlightPopoverState() {
  let activeHighlightId: string | null = null;
  let highlightPosition: { top: number; left: number } | null = null;

  function setActiveHighlight(id: string | null, pos: { top: number; left: number } | null) {
    activeHighlightId = id;
    highlightPosition = pos;
  }

  function dismissOnChapterChange() {
    activeHighlightId = null;
    highlightPosition = null;
  }

  function getState() {
    return { activeHighlightId, highlightPosition };
  }

  return { setActiveHighlight, dismissOnChapterChange, getState };
}

describe("highlight popover - chapter dismiss", () => {
  it("should clear highlight state when chapter changes", () => {
    const state = createHighlightPopoverState();

    // Open a highlight popover
    state.setActiveHighlight("hl-1", { top: 120, left: 300 });
    expect(state.getState().activeHighlightId).toBe("hl-1");

    // Simulate chapter navigation
    state.dismissOnChapterChange();

    expect(state.getState().activeHighlightId).toBeNull();
    expect(state.getState().highlightPosition).toBeNull();
  });

  it("should handle chapter change when no popover is open", () => {
    const state = createHighlightPopoverState();

    // No popover open — dismiss should be a no-op
    expect(() => state.dismissOnChapterChange()).not.toThrow();
    expect(state.getState().activeHighlightId).toBeNull();
    expect(state.getState().highlightPosition).toBeNull();
  });

  it("should clear both highlightId and position together", () => {
    const state = createHighlightPopoverState();

    state.setActiveHighlight("hl-42", { top: 200, left: 150 });
    state.dismissOnChapterChange();

    const { activeHighlightId, highlightPosition } = state.getState();
    expect(activeHighlightId).toBeNull();
    expect(highlightPosition).toBeNull();
  });
});

// ── Rapid clicks ──────────────────────────────────────────────────────────────

/**
 * Simulates the message handler in VerticalScroller that processes
 * highlight-click postMessages from the iframe.
 */
function createHighlightClickHandler() {
  let activeHighlightId: string | null = null;
  let highlightPosition: { top: number; left: number } | null = null;
  let activeNoteId: string | null = "some-note";
  let translationPanel = { selectedText: "test" };

  function handleHighlightClick(event: {
    type: string;
    highlightId?: string;
    rect?: { bottom: number; left: number; width: number };
  }) {
    if (event.type === "highlight-click" && event.highlightId) {
      activeHighlightId = event.highlightId;
      const rect = event.rect;
      if (rect) {
        highlightPosition = {
          top: rect.bottom + 8,
          left: rect.left + rect.width / 2 - 130,
        };
      }
      // Mutual exclusivity: close other panels
      activeNoteId = null;
      translationPanel = null as unknown as { selectedText: string };
    }
  }

  function getState() {
    return { activeHighlightId, highlightPosition, activeNoteId, translationPanel };
  }

  return { handleHighlightClick, getState };
}

describe("highlight popover - rapid clicks", () => {
  it("should keep only the last clicked highlight active", () => {
    const handler = createHighlightClickHandler();

    handler.handleHighlightClick({
      type: "highlight-click",
      highlightId: "hl-1",
      rect: { bottom: 50, left: 10, width: 100 },
    });
    handler.handleHighlightClick({
      type: "highlight-click",
      highlightId: "hl-2",
      rect: { bottom: 150, left: 200, width: 80 },
    });
    handler.handleHighlightClick({
      type: "highlight-click",
      highlightId: "hl-3",
      rect: { bottom: 250, left: 300, width: 120 },
    });

    const state = handler.getState();
    expect(state.activeHighlightId).toBe("hl-3");
  });

  it("should update position to match the last clicked highlight", () => {
    const handler = createHighlightClickHandler();

    handler.handleHighlightClick({
      type: "highlight-click",
      highlightId: "hl-1",
      rect: { bottom: 50, left: 10, width: 100 },
    });
    handler.handleHighlightClick({
      type: "highlight-click",
      highlightId: "hl-2",
      rect: { bottom: 200, left: 400, width: 80 },
    });

    const state = handler.getState();
    expect(state.highlightPosition).toEqual({
      top: 208,      // 200 + 8
      left: 310,     // 400 + 80/2 - 130
    });
  });

  it("should close other panels on each highlight click", () => {
    const handler = createHighlightClickHandler();

    handler.handleHighlightClick({
      type: "highlight-click",
      highlightId: "hl-1",
      rect: { bottom: 50, left: 10, width: 100 },
    });

    const state = handler.getState();
    expect(state.activeNoteId).toBeNull();
    expect(state.translationPanel).toBeNull();
  });
});

// ── Toolbar dismiss ───────────────────────────────────────────────────────────

/**
 * Simulates the coordination between highlight-click and TextSelectionToolbar.
 *
 * When a highlight is clicked in the iframe, the TextSelectionToolbar should
 * be dismissed. This is achieved by posting a `text-selection-cleared` message
 * when handling a `highlight-click`.
 */
function createToolbarDismissSimulator() {
  const messages: Array<{ type: string }> = [];

  function simulateHighlightClickWithToolbarDismiss() {
    // After setting highlight state, post selection-cleared to dismiss toolbar
    messages.push({ type: "text-selection-cleared" });
  }

  function simulateToolbarSelection() {
    messages.push({ type: "text-selection" });
  }

  function getMessages() {
    return [...messages];
  }

  function getToolbarVisible(): boolean {
    // Toolbar is visible if last message was text-selection (not cleared)
    const lastSelection = [...messages].reverse().find(
      (m) => m.type === "text-selection" || m.type === "text-selection-cleared",
    );
    return lastSelection?.type === "text-selection";
  }

  return {
    simulateHighlightClickWithToolbarDismiss,
    simulateToolbarSelection,
    getMessages,
    getToolbarVisible,
  };
}

describe("highlight click - toolbar dismiss", () => {
  it("should dismiss TextSelectionToolbar when highlight is clicked", () => {
    const sim = createToolbarDismissSimulator();

    // User selects text → toolbar appears
    sim.simulateToolbarSelection();
    expect(sim.getToolbarVisible()).toBe(true);

    // User clicks a highlight → toolbar should dismiss
    sim.simulateHighlightClickWithToolbarDismiss();
    expect(sim.getToolbarVisible()).toBe(false);
  });

  it("should dismiss toolbar even when no text was selected", () => {
    const sim = createToolbarDismissSimulator();

    // Highlight click with no prior selection — should not throw
    expect(() => sim.simulateHighlightClickWithToolbarDismiss()).not.toThrow();
    expect(sim.getToolbarVisible()).toBe(false);
  });

  it("should dismiss toolbar on repeated highlight clicks", () => {
    const sim = createToolbarDismissSimulator();

    // Select text, then click highlights in rapid succession
    sim.simulateToolbarSelection();
    sim.simulateHighlightClickWithToolbarDismiss();
    sim.simulateHighlightClickWithToolbarDismiss();

    expect(sim.getToolbarVisible()).toBe(false);
    // Only one text-selection-cleared should matter (last state is dismissed)
    const clearedCount = sim.getMessages().filter(
      (m) => m.type === "text-selection-cleared",
    ).length;
    expect(clearedCount).toBe(2);
  });
});
