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
