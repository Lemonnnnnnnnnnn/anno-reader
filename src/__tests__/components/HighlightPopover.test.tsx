/**
 * Tests for HighlightPopover component.
 *
 * Verifies rendering of color swatches, delete action,
 * current color indication, absolute positioning, and
 * click-outside dismissal.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import type { Highlight } from "@/stores/useBookStore";
import { HIGHLIGHT_COLORS } from "@/components/TextSelectionToolbar/constants";

// Component under test — will be created after tests
import { HighlightPopover } from "@/components/HighlightPopover";

const SAMPLE_HIGHLIGHT: Highlight = {
  id: "hl_test_1",
  bookId: "book_1",
  chapterHref: "chapter1.xhtml",
  cfiRange: "epubcfi(/6/4[chap01]!/4/2:0,10)",
  text: "Some selected text",
  color: "#fde68a",
  createdAt: 1700000000000,
};

const POSITION = { top: 100, left: 200 };

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

describe("HighlightPopover", () => {
  let onColorChange: ReturnType<typeof vi.fn>;
  let onDelete: ReturnType<typeof vi.fn>;
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onColorChange = vi.fn();
    onDelete = vi.fn();
    onClose = vi.fn();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders all 5 color swatches", () => {
    const { container, unmount } = render(
      <HighlightPopover
        highlight={SAMPLE_HIGHLIGHT}
        onColorChange={onColorChange}
        onDelete={onDelete}
        onClose={onClose}
        position={POSITION}
      />,
    );

    const swatches = container.querySelectorAll("button[data-color-swatch]");
    expect(swatches).toHaveLength(HIGHLIGHT_COLORS.length);

    HIGHLIGHT_COLORS.forEach((color, i) => {
      expect(swatches[i].getAttribute("title")).toBe(color.name);
    });

    unmount();
  });

  it("renders a delete button", () => {
    const { container, unmount } = render(
      <HighlightPopover
        highlight={SAMPLE_HIGHLIGHT}
        onColorChange={onColorChange}
        onDelete={onDelete}
        onClose={onClose}
        position={POSITION}
      />,
    );

    const deleteBtn = container.querySelector("button[data-delete]");
    expect(deleteBtn).not.toBeNull();
    expect(deleteBtn!.textContent).toContain("Delete");

    unmount();
  });

  it("visually indicates the current highlight color", () => {
    const { container, unmount } = render(
      <HighlightPopover
        highlight={SAMPLE_HIGHLIGHT}
        onColorChange={onColorChange}
        onDelete={onDelete}
        onClose={onClose}
        position={POSITION}
      />,
    );

    // The highlight color is #fde68a (Yellow, index 0)
    const swatches = container.querySelectorAll("button[data-color-swatch]");
    const activeSwatch = swatches[0] as HTMLElement;
    // Active swatch should have a ring/border indicating selection
    expect(activeSwatch.className).toContain("ring-2");

    unmount();
  });

  it("calls onColorChange with color value when a swatch is clicked", () => {
    const { container, unmount } = render(
      <HighlightPopover
        highlight={SAMPLE_HIGHLIGHT}
        onColorChange={onColorChange}
        onDelete={onDelete}
        onClose={onClose}
        position={POSITION}
      />,
    );

    const swatches = container.querySelectorAll("button[data-color-swatch]");
    // Click Blue (index 2)
    act(() => {
      (swatches[2] as HTMLElement).click();
    });

    expect(onColorChange).toHaveBeenCalledTimes(1);
    expect(onColorChange).toHaveBeenCalledWith("#bfdbfe");

    unmount();
  });

  it("calls onDelete when delete button is clicked", () => {
    const { container, unmount } = render(
      <HighlightPopover
        highlight={SAMPLE_HIGHLIGHT}
        onColorChange={onColorChange}
        onDelete={onDelete}
        onClose={onClose}
        position={POSITION}
      />,
    );

    const deleteBtn = container.querySelector("button[data-delete]")!;
    act(() => {
      (deleteBtn as HTMLElement).click();
    });

    expect(onDelete).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("positions absolutely using the provided position", () => {
    const { container, unmount } = render(
      <HighlightPopover
        highlight={SAMPLE_HIGHLIGHT}
        onColorChange={onColorChange}
        onDelete={onDelete}
        onClose={onClose}
        position={POSITION}
      />,
    );

    const popover = container.firstElementChild as HTMLElement;
    expect(popover.style.position).toBe("absolute");
    expect(popover.style.top).toBe("100px");
    expect(popover.style.left).toBe("200px");

    unmount();
  });

  it("calls onClose when clicking outside the popover", () => {
    const { unmount } = render(
      <HighlightPopover
        highlight={SAMPLE_HIGHLIGHT}
        onColorChange={onColorChange}
        onDelete={onDelete}
        onClose={onClose}
        position={POSITION}
      />,
    );

    // Click on document body (outside the popover)
    act(() => {
      document.body.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true }),
      );
    });

    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("does not call onClose when clicking inside the popover", () => {
    const { container, unmount } = render(
      <HighlightPopover
        highlight={SAMPLE_HIGHLIGHT}
        onColorChange={onColorChange}
        onDelete={onDelete}
        onClose={onClose}
        position={POSITION}
      />,
    );

    const popover = container.firstElementChild as HTMLElement;
    act(() => {
      popover.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true }),
      );
    });

    expect(onClose).not.toHaveBeenCalled();

    unmount();
  });
});
