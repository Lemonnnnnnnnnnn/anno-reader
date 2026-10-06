/**
 * Tests for the quick-translate entry in the selection toolbar.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";

vi.mock("@/hooks/useTTS", () => ({
  useTTS: () => ({ speak: vi.fn(), isSpeaking: false }),
}));

vi.mock("@/lib/annotations", () => ({
  createNote: vi.fn(async () => ({ id: "note_1" })),
  createHighlight: vi.fn(async () => ({ id: "highlight_1" })),
}));

import { TextSelectionToolbar } from "..";
import { useBookStore } from "@/stores/useBookStore";
import { createHighlight } from "@/lib/annotations";
import { HIGHLIGHT_COLORS } from "../constants";
import { Modal, Drawer } from "@/components/primitives";
import { useOverlayStore } from "@/stores/useOverlayStore";

const QUICK_TITLE = "Translate and save as note";

let container: HTMLDivElement;
let root: Root;

function renderToolbar(props: {
  onTranslate?: (data: unknown) => void;
  onQuickTranslate?: (data: unknown) => void;
}) {
  const positionTarget = document.createElement("div");
  document.body.appendChild(positionTarget);
  act(() => {
    root.render(
      <TextSelectionToolbar
        containerRef={{ current: positionTarget }}
        chapterHref="chapter1.xhtml"
        {...props}
      />,
    );
  });
}

function postSelection() {
  // postMessage is delivered asynchronously — let it land before asserting.
  return act(async () => {
    window.postMessage(
      {
        type: "text-selection",
        text: "heterogeneous",
        rect: { top: 10, left: 10, bottom: 30, right: 110, width: 100, height: 20 },
        startOffset: 0,
        endOffset: 5,
        sentence: "A heterogeneous system.",
        paragraph: "Paragraph.",
      },
      "*",
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function click(title: string) {
  const button = container.querySelector(`button[title="${title}"]`);
  expect(button).not.toBeNull();
  act(() => {
    button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("TextSelectionToolbar quick translate", () => {
  it.each([Modal, Drawer])("dismisses selection when an overlay opens and requires a fresh selection after closing", async (Overlay) => {
    const render = (open: boolean) => act(() => root.render(<>
      <TextSelectionToolbar containerRef={{ current: container }} chapterHref="chapter1.xhtml" />
      <Overlay open={open} onClose={() => {}} title="Test">Content</Overlay>
    </>));
    render(false);
    await postSelection();
    expect(container.querySelector("[data-selection-toolbar]")).not.toBeNull();
    click("Add note to selection");
    expect(container.querySelector("textarea")).not.toBeNull();
    render(true);
    expect(container.querySelector("[data-selection-toolbar]")).toBeNull();
    await postSelection();
    expect(container.querySelector("[data-selection-toolbar]")).toBeNull();
    render(false);
    expect(container.querySelector("[data-selection-toolbar]")).toBeNull();
    await postSelection();
    expect(container.querySelector("[data-selection-toolbar]")).not.toBeNull();
    expect(container.querySelector("textarea")).toBeNull();
  });

  it("continues suppressing selection until all nested overlays close, and cleans up on unmount", async () => {
    const render = (modal: boolean, drawer: boolean) => act(() => root.render(<>
      <TextSelectionToolbar containerRef={{ current: container }} chapterHref="chapter1.xhtml" />
      <Drawer open={drawer} onClose={() => {}}><Modal open={modal} onClose={() => {}}>Content</Modal></Drawer>
    </>));
    render(true, true);
    expect(useOverlayStore.getState().openCount).toBe(2);
    render(false, true);
    expect(useOverlayStore.getState().openCount).toBe(1);
    await postSelection();
    expect(container.querySelector("[data-selection-toolbar]")).toBeNull();
    act(() => root.render(null));
    expect(useOverlayStore.getState().openCount).toBe(0);
  });

  it("passes the selection to onQuickTranslate and closes the toolbar", async () => {
    const onQuickTranslate = vi.fn();
    const onTranslate = vi.fn();
    renderToolbar({ onQuickTranslate, onTranslate });
    await postSelection();

    click(QUICK_TITLE);

    expect(onQuickTranslate).toHaveBeenCalledWith({
      selectedText: "heterogeneous",
      chapterHref: "chapter1.xhtml",
      startOffset: 0,
      endOffset: 5,
      sentence: "A heterogeneous system.",
      paragraph: "Paragraph.",
    });
    // The Drawer entry stays untouched
    expect(onTranslate).not.toHaveBeenCalled();
    expect(container.querySelector(`button[title="${QUICK_TITLE}"]`)).toBeNull();
  });

  it("keeps the translate button opening the translation panel", async () => {
    const onQuickTranslate = vi.fn();
    const onTranslate = vi.fn();
    renderToolbar({ onQuickTranslate, onTranslate });
    await postSelection();

    click("Translate selection");

    expect(onTranslate).toHaveBeenCalledWith(
      expect.objectContaining({ selectedText: "heterogeneous", startOffset: 0, endOffset: 5 }),
    );
    expect(onQuickTranslate).not.toHaveBeenCalled();
  });

  it("hides the quick translate button when no handler is provided", async () => {
    renderToolbar({});
    await postSelection();

    expect(container.querySelector(`button[title="${QUICK_TITLE}"]`)).toBeNull();
    expect(container.querySelector('button[title="Translate selection"]')).not.toBeNull();
  });
});

describe("TextSelectionToolbar highlight", () => {
  const DEFAULT_COLOR = HIGHLIGHT_COLORS[0].value;

  beforeEach(() => {
    localStorage.clear();
    vi.mocked(createHighlight).mockClear();
    useBookStore.setState({
      currentBook: {
        id: "book-1",
        title: "Test Book",
        author: "Author",
        coverUrl: null,
        filePath: "/books/test.epub",
        lastOpened: 0,
      },
    });
  });

  afterEach(() => {
    useBookStore.setState({ currentBook: null });
  });

  async function createViaToolbar() {
    renderToolbar({});
    await postSelection();
    click("Highlight selection");
    // createHighlight is async — let it resolve and the toolbar close.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it("creates a highlight in one click with the default color", async () => {
    await createViaToolbar();

    expect(createHighlight).toHaveBeenCalledWith(
      "book-1",
      "chapter1.xhtml",
      expect.anything(),
      "heterogeneous",
      DEFAULT_COLOR,
    );
    expect(localStorage.getItem("last-highlight-color")).toBe(DEFAULT_COLOR);
    // Toolbar closes after creation
    expect(container.querySelector('button[title="Highlight selection"]')).toBeNull();
  });

  it("reuses the previously used color", async () => {
    localStorage.setItem("last-highlight-color", "#bfdbfe");

    await createViaToolbar();

    expect(createHighlight).toHaveBeenCalledWith(
      "book-1",
      "chapter1.xhtml",
      expect.anything(),
      "heterogeneous",
      "#bfdbfe",
    );
  });

  it("falls back to the default color when the stored value is stale", async () => {
    localStorage.setItem("last-highlight-color", "#not-a-palette-color");

    await createViaToolbar();

    expect(createHighlight).toHaveBeenCalledWith(
      "book-1",
      "chapter1.xhtml",
      expect.anything(),
      "heterogeneous",
      DEFAULT_COLOR,
    );
  });
});
