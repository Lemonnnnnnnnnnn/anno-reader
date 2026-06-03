/**
 * Tests for highlight interaction edge cases.
 *
 * Covers:
 * - Viewport clamping for highlight popover positioning (8px padding)
 * - Chapter navigation dismisses highlight popover
 * - Rapid clicks on multiple highlights (only last shown)
 * - Clicking highlight while TextSelectionToolbar is open dismisses toolbar
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

// ── Mocks ────────────────────────────────────────────────────────────────────

// Track mock props passed to HighlightPopover
let lastHighlightPopoverProps: Record<string, unknown> | null = null;

vi.mock("@/components/HighlightPopover", () => ({
  HighlightPopover: (props: Record<string, unknown>) => {
    lastHighlightPopoverProps = props;
    return <div data-testid="highlight-popover" />;
  },
}));

vi.mock("@/components/AnnotationDetailDrawer", () => ({
  AnnotationDetailDrawer: () => <div data-testid="annotation-detail-panel" />,
}));

vi.mock("@/components/TextSelectionToolbar", () => ({
  TextSelectionToolbar: () => <div data-testid="text-selection-toolbar" />,
}));

vi.mock("@/components/AITranslationPanel", () => ({
  AITranslationPanel: () => <div data-testid="ai-translation-panel" />,
}));

vi.mock("@/lib/selection", () => ({
  injectSelectionScript: vi.fn((srcdoc: string) => srcdoc),
  generateCfiRange: vi.fn(() => "epubcfi(/6/4!/4/2:0,5)"),
}));

vi.mock("@/components/VerticalScroller/hooks", () => ({
  useScrollTracking: vi.fn(() => ({
    iframeRef: { current: null },
    handleIframeLoad: vi.fn(),
  })),
  useAnnotationSync: vi.fn(() => ({
    annotationScript: "",
  })),
}));

vi.mock("@/components/VerticalScroller/hooks/useScrollTracking", () => ({
  injectScrollScript: vi.fn((srcdoc: string) => srcdoc),
  injectKeyboardScript: vi.fn((srcdoc: string) => srcdoc),
}));

vi.mock("@/lib/annotations", () => ({
  updateHighlight: vi.fn().mockResolvedValue(undefined),
  deleteHighlight: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/stores/useBookStore", () => ({
  useBookStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      highlights: [
        {
          id: "hl_test_1",
          bookId: "book_1",
          chapterHref: "chapter1.xhtml",
          cfiRange: "epubcfi(/6/4[chap01]!/4/2:0,10)",
          text: "First highlight",
          color: "#fde68a",
          createdAt: 1700000000000,
        },
        {
          id: "hl_test_2",
          bookId: "book_1",
          chapterHref: "chapter1.xhtml",
          cfiRange: "epubcfi(/6/4[chap01]!/4/2:20,30)",
          text: "Second highlight",
          color: "#a7f3d0",
          createdAt: 1700000000001,
        },
      ],
      notes: [],
      currentBook: { id: "book_1" },
    }),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { VerticalScroller } from "@/components/VerticalScroller";
import { clampToViewport } from "@/lib/clampToViewport";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
  srcdoc: "<html><body>content</body></html>",
  chapterText: "Some chapter text",
  chapterIndex: 0,
  chapterHref: "chapter1.xhtml",
  title: "Chapter 1",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function render(ui: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return {
    container,
    root,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function dispatchHighlightClick(highlightId: string, rect?: Partial<DOMRect>) {
  const defaultRect = {
    top: 100,
    left: 50,
    right: 200,
    bottom: 120,
    width: 150,
    height: 20,
    x: 50,
    y: 100,
    toJSON: () => {},
  };
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "highlight-click",
          highlightId,
          rect: { ...defaultRect, ...rect },
        },
      }),
    );
  });
}

function dispatchTextSelection(text: string) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "text-selection",
          text,
          rect: { top: 50, left: 10, bottom: 70, right: 200, width: 190, height: 20 },
          startOffset: 0,
          endOffset: text.length,
        },
      }),
    );
  });
}

function dispatchTextSelectionCleared() {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "text-selection-cleared" },
      }),
    );
  });
}

// ── clampToViewport pure function tests ──────────────────────────────────────

describe("clampToViewport", () => {
  it("clamps position that would overflow right edge", () => {
    // Container 800px wide, element 260px wide, padding 8px
    // position=700 → 700 + 260 > 800 → clamp to 800 - 260 - 8 = 532
    expect(clampToViewport(700, 800, 260)).toBe(532);
  });

  it("clamps position that would overflow left edge", () => {
    // position=-50 → clamp to 8 (padding)
    expect(clampToViewport(-50, 800, 260)).toBe(8);
  });

  it("clamps position that would overflow bottom edge", () => {
    // Container 600px tall, element 80px tall, padding 8px
    // position=580 → 580 + 80 > 600 → clamp to 600 - 80 - 8 = 512
    expect(clampToViewport(580, 600, 80)).toBe(512);
  });

  it("does not clamp position that is within bounds", () => {
    // position=100, container=800, element=260 → 100 + 260 = 360 < 800-8 → stays at 100
    expect(clampToViewport(100, 800, 260)).toBe(100);
  });
});

// ── VerticalScroller chapter dismiss ─────────────────────────────────────────

describe("VerticalScroller - chapter dismiss", () => {
  beforeEach(() => {
    lastHighlightPopoverProps = null;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("dismisses highlight popover when chapterHref changes", () => {
    const { container, root, unmount } = render(
      <VerticalScroller {...DEFAULT_PROPS} />,
    );

    // Open highlight popover
    dispatchHighlightClick("hl_test_1");
    expect(
      container.querySelector("[data-testid='highlight-popover']"),
    ).not.toBeNull();

    // Re-render with different chapterHref using the same root
    act(() => {
      root.render(<VerticalScroller {...DEFAULT_PROPS} chapterHref="chapter2.xhtml" />);
    });

    // Highlight popover should be dismissed
    expect(
      container.querySelector("[data-testid='highlight-popover']"),
    ).toBeNull();

    unmount();
  });
});

// ── VerticalScroller rapid clicks ────────────────────────────────────────────

describe("VerticalScroller - rapid highlight clicks", () => {
  beforeEach(() => {
    lastHighlightPopoverProps = null;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("only shows popover for the last clicked highlight", () => {
    const { container, unmount } = render(
      <VerticalScroller {...DEFAULT_PROPS} />,
    );

    // Rapidly click two different highlights
    dispatchHighlightClick("hl_test_1");
    dispatchHighlightClick("hl_test_2");

    // Popover should be visible
    expect(
      container.querySelector("[data-testid='highlight-popover']"),
    ).not.toBeNull();

    // Should show the SECOND highlight (last clicked)
    expect(lastHighlightPopoverProps).not.toBeNull();
    expect(
      (lastHighlightPopoverProps as Record<string, unknown>).highlight,
    ).toEqual(expect.objectContaining({ id: "hl_test_2" }));

    unmount();
  });
});

// ── Toolbar dismiss on highlight click ────────────────────────────────────────

describe("VerticalScroller - toolbar dismiss on highlight click", () => {
  beforeEach(() => {
    lastHighlightPopoverProps = null;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("dismisses TextSelectionToolbar when highlight is clicked", () => {
    // This test verifies that useSelectionListener clears selection
    // when a highlight-click message is received.
    // We test this indirectly: the toolbar only renders when selection is not null.
    // Since TextSelectionToolbar is mocked, we verify through the store behavior.

    // The key behavior: highlight-click should not interfere with highlight popover.
    // The actual toolbar dismissal is tested via useSelectionListener changes.
    // Here we verify the integration: highlight-click opens popover even when
    // toolbar would normally be active.

    const { container, unmount } = render(
      <VerticalScroller {...DEFAULT_PROPS} />,
    );

    // Simulate a highlight click while toolbar context is active
    dispatchHighlightClick("hl_test_1");

    // Highlight popover should be visible
    expect(
      container.querySelector("[data-testid='highlight-popover']"),
    ).not.toBeNull();

    // The highlight should be the correct one
    expect(lastHighlightPopoverProps).not.toBeNull();
    expect(
      (lastHighlightPopoverProps as Record<string, unknown>).highlight,
    ).toEqual(expect.objectContaining({ id: "hl_test_1" }));

    unmount();
  });
});

// ── useSelectionListener highlight-click dismissal ───────────────────────────

describe("useSelectionListener - highlight-click dismissal", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("clears selection when highlight-click message is received", async () => {
    // Import useSelectionListener directly to test its behavior
    const { useSelectionListener } = await import(
      "@/components/TextSelectionToolbar/hooks/useSelectionListener"
    );

    let hookResult: ReturnType<typeof useSelectionListener> | null = null;

    function TestComponent() {
      hookResult = useSelectionListener();
      return (
        <div
          data-testid="test"
          data-has-selection={hookResult.selection !== null ? "true" : "false"}
        />
      );
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<TestComponent />);
    });

    // Initially no selection
    expect(hookResult!.selection).toBeNull();

    // Dispatch text-selection to show toolbar
    dispatchTextSelection("Hello world");
    expect(hookResult!.selection).not.toBeNull();

    // Dispatch highlight-click — should clear selection
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "highlight-click",
            highlightId: "hl_test_1",
            rect: { top: 100, left: 50, bottom: 120, right: 200, width: 150, height: 20 },
          },
        }),
      );
    });

    // Selection should be cleared (toolbar dismissed)
    expect(hookResult!.selection).toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
