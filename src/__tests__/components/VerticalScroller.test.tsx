/**
 * Tests for VerticalScroller highlight-click message handling.
 *
 * Verifies that:
 * - highlight-click postMessage renders HighlightPopover with correct highlight + position
 * - onColorChange calls updateHighlight(), onDelete calls deleteHighlight()
 * - Mutual exclusivity: highlight-click closes note detail panel, and vice versa
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";

// ---------------------------------------------------------------------------
// Mocks — set up before component imports
// ---------------------------------------------------------------------------

// Track mock props passed to HighlightPopover
let lastHighlightPopoverProps: Record<string, unknown> | null = null;

vi.mock("@/components/HighlightPopover", () => ({
  HighlightPopover: (props: Record<string, unknown>) => {
    lastHighlightPopoverProps = props;
    return <div data-testid="highlight-popover" />;
  },
}));

vi.mock("@/components/AnnotationDetailDrawer", () => ({
  AnnotationDetailDrawer: (props: Record<string, unknown>) => (
    <div
      data-testid="annotation-detail-panel"
      data-note-id={(props as { noteId: string | null }).noteId ?? ""}
    />
  ),
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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { VerticalScroller } from "@/components/VerticalScroller";
import { updateHighlight, deleteHighlight } from "@/lib/annotations";
import type { Highlight } from "@/stores/useBookStore";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_HIGHLIGHT: Highlight = {
  id: "hl_test_1",
  bookId: "book_1",
  chapterHref: "chapter1.xhtml",
  cfiRange: "epubcfi(/6/4[chap01]!/4/2:0,10)",
  text: "Some selected text",
  color: "#fde68a",
  createdAt: 1700000000000,
};

const DEFAULT_PROPS = {
  srcdoc: "<html><body>content</body></html>",
  chapterText: "Some chapter text",
  chapterIndex: 0,
  chapterHref: "chapter1.xhtml",
  title: "Chapter 1",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function render(ui: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return {
    container,
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

function dispatchNoteClick(noteId: string) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "note-click", noteId },
      }),
    );
  });
}

function dispatchLinkClick(href: string) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "link-click", href },
      }),
    );
  });
}

// ---------------------------------------------------------------------------
// Mock store state for Highlight lookup
// ---------------------------------------------------------------------------

// We need to mock useBookStore so that the HighlightPopover receives the highlight object.
// The VerticalScroller stores only the highlightId; we need the store to resolve it.
// However, VerticalScroller itself doesn't look up the highlight — it just stores the ID.
// The HighlightPopover lookup happens elsewhere. Let me re-read the implementation plan...

// Actually, looking at the task requirements, VerticalScroller should:
// 1. Store the highlightId from the message
// 2. Look up the highlight from the store
// 3. Pass it to HighlightPopover
// So we need to mock useBookStore with highlights data.

vi.mock("@/stores/useBookStore", () => ({
  useBookStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      highlights: [
        {
          id: "hl_test_1",
          bookId: "book_1",
          chapterHref: "chapter1.xhtml",
          cfiRange: "epubcfi(/6/4[chap01]!/4/2:0,10)",
          text: "Some selected text",
          color: "#fde68a",
          createdAt: 1700000000000,
        },
      ],
      notes: [],
      currentBook: { id: "book_1" },
    }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VerticalScroller - highlight-click handler", () => {
  beforeEach(() => {
    lastHighlightPopoverProps = null;
    vi.mocked(updateHighlight).mockClear();
    vi.mocked(deleteHighlight).mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders HighlightPopover when highlight-click message is received", () => {
    const { container, unmount } = render(
      <VerticalScroller {...DEFAULT_PROPS} />,
    );

    // Initially, no highlight popover
    expect(container.querySelector("[data-testid='highlight-popover']")).toBeNull();

    // Dispatch highlight-click
    dispatchHighlightClick("hl_test_1");

    // HighlightPopover should now be rendered
    const popover = container.querySelector("[data-testid='highlight-popover']");
    expect(popover).not.toBeNull();

    // Should have correct highlight data
    expect(lastHighlightPopoverProps).not.toBeNull();
    expect((lastHighlightPopoverProps as Record<string, unknown>).highlight).toEqual(
      expect.objectContaining({ id: "hl_test_1", color: "#fde68a" }),
    );

    unmount();
  });

  it("positions HighlightPopover based on rect from highlight-click message", () => {
    const { container, unmount } = render(
      <VerticalScroller {...DEFAULT_PROPS} />,
    );

    dispatchHighlightClick("hl_test_1", { top: 200, left: 80 });

    expect(lastHighlightPopoverProps).not.toBeNull();
    const position = (lastHighlightPopoverProps as Record<string, unknown>).position as {
      top: number;
      left: number;
    };
    // Position should be derived from the rect (non-zero)
    expect(position.top).toBeGreaterThan(0);
    expect(position.left).toBeGreaterThan(0);

    unmount();
  });

  it("calls updateHighlight when onColorChange is triggered", async () => {
    const { container, unmount } = render(
      <VerticalScroller {...DEFAULT_PROPS} />,
    );

    dispatchHighlightClick("hl_test_1");

    // Trigger onColorChange callback
    const onColorChange = lastHighlightPopoverProps?.onColorChange as (color: string) => void;
    expect(onColorChange).toBeDefined();

    await act(async () => {
      onColorChange("#bfdbfe");
    });

    expect(updateHighlight).toHaveBeenCalledWith(
      "hl_test_1",
      { color: "#bfdbfe" },
      "book_1",
    );

    unmount();
  });

  it("calls deleteHighlight when onDelete is triggered", async () => {
    const { container, unmount } = render(
      <VerticalScroller {...DEFAULT_PROPS} />,
    );

    dispatchHighlightClick("hl_test_1");

    // Trigger onDelete callback
    const onDelete = lastHighlightPopoverProps?.onDelete as () => void;
    expect(onDelete).toBeDefined();

    await act(async () => {
      onDelete();
    });

    expect(deleteHighlight).toHaveBeenCalledWith("hl_test_1", "book_1");

    unmount();
  });

  it("closes HighlightPopover when onClose is triggered", () => {
    const { container, unmount } = render(
      <VerticalScroller {...DEFAULT_PROPS} />,
    );

    dispatchHighlightClick("hl_test_1");
    expect(container.querySelector("[data-testid='highlight-popover']")).not.toBeNull();

    // Trigger onClose
    const onClose = lastHighlightPopoverProps?.onClose as () => void;
    act(() => {
      onClose();
    });

    // HighlightPopover should be removed
    expect(container.querySelector("[data-testid='highlight-popover']")).toBeNull();

    unmount();
  });
});

describe("VerticalScroller - mutual exclusivity", () => {
  beforeEach(() => {
    lastHighlightPopoverProps = null;
    vi.mocked(updateHighlight).mockClear();
    vi.mocked(deleteHighlight).mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("highlight-click closes the note detail panel", () => {
    const { container, unmount } = render(
      <VerticalScroller {...DEFAULT_PROPS} />,
    );

    // First open the note detail panel
    dispatchNoteClick("note-1");
    const notePanel = container.querySelector("[data-testid='annotation-detail-panel']");
    expect(notePanel).not.toBeNull();
    expect(notePanel?.getAttribute("data-note-id")).toBe("note-1");

    // Now dispatch highlight-click — should close note panel
    dispatchHighlightClick("hl_test_1");

    const notePanelAfter = container.querySelector("[data-testid='annotation-detail-panel']");
    // The note panel should now have empty noteId (closed)
    expect(notePanelAfter?.getAttribute("data-note-id")).toBe("");

    // Highlight popover should be open
    expect(container.querySelector("[data-testid='highlight-popover']")).not.toBeNull();

    unmount();
  });

  it("note-click closes the highlight popover", () => {
    const { container, unmount } = render(
      <VerticalScroller {...DEFAULT_PROPS} />,
    );

    // First open highlight popover
    dispatchHighlightClick("hl_test_1");
    expect(container.querySelector("[data-testid='highlight-popover']")).not.toBeNull();

    // Now dispatch note-click — should close highlight popover
    dispatchNoteClick("note-1");

    // Highlight popover should be removed
    expect(container.querySelector("[data-testid='highlight-popover']")).toBeNull();

    // Note panel should be open
    const notePanel = container.querySelector("[data-testid='annotation-detail-panel']");
    expect(notePanel?.getAttribute("data-note-id")).toBe("note-1");

    unmount();
  });
});

describe("VerticalScroller - link navigation callbacks", () => {
  beforeEach(() => {
    lastHighlightPopoverProps = null;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("forwards link-click messages to the parent callback", () => {
    const onLinkClick = vi.fn();
    const { unmount } = render(
      <VerticalScroller {...DEFAULT_PROPS} onLinkClick={onLinkClick} />,
    );

    dispatchLinkClick("chapter2.xhtml#target");

    expect(onLinkClick).toHaveBeenCalledWith("chapter2.xhtml#target");

    unmount();
  });

  it("renders a controlled back button only when history is available", () => {
    const onLinkBack = vi.fn();
    const { container, unmount } = render(
      <VerticalScroller
        {...DEFAULT_PROPS}
        canGoBack={true}
        onLinkBack={onLinkBack}
      />,
    );

    const backButton = container.querySelector("button[title='Go back']");
    expect(backButton).not.toBeNull();

    act(() => {
      backButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onLinkBack).toHaveBeenCalledTimes(1);

    unmount();
  });
});
