/**
 * Tests for PDF text layer DOM helpers.
 * Requires a DOM environment (happy-dom).
 */

import { describe, it, expect } from "vitest";
import {
  getTextNodes,
  getTextOffset,
  wrapRange,
  clearAnnotations,
  parseCfiOffsets,
  toContainerRect,
  findSentenceContext,
  findParagraphContext,
  isInsideFloatingUi,
} from "../textLayerDom";

/** Build a text layer-like element with the given line texts. */
function buildTextLayer(lines: string[]): HTMLElement {
  const root = document.createElement("div");
  for (const line of lines) {
    const span = document.createElement("span");
    span.textContent = line;
    root.appendChild(span);
  }
  return root;
}

describe("getTextNodes", () => {
  it("collects text nodes in document order", () => {
    const root = buildTextLayer(["ab", "cd"]);
    const nodes = getTextNodes(root);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].textContent).toBe("ab");
    expect(nodes[1].textContent).toBe("cd");
  });

  it("skips nodes nested in script/style", () => {
    const root = buildTextLayer(["keep"]);
    const script = document.createElement("script");
    script.textContent = "ignore";
    root.appendChild(script);
    const nodes = getTextNodes(root);
    expect(nodes.map((n) => n.textContent)).toEqual(["keep"]);
  });
});

describe("getTextOffset", () => {
  it("computes offsets across the concatenated stream", () => {
    const root = buildTextLayer(["hello", "world"]);
    const second = getTextNodes(root)[1];
    // Offset 3 within "world" → 5 (stream prefix) + 3
    expect(getTextOffset(root, second, 3)).toBe(8);
  });
});

describe("wrapRange", () => {
  it("wraps a range spanning multiple text nodes", () => {
    const root = buildTextLayer(["hello", "world"]);
    // Wrap "ello" + "wor" → stream offsets 1..8
    wrapRange(root, 1, 8, "anno-highlight", "background-color: yellow;", {
      "highlight-id": "h1",
    });

    const spans = root.querySelectorAll("span.anno-highlight");
    expect(spans).toHaveLength(2);
    expect(spans[0].textContent).toBe("ello");
    expect(spans[1].textContent).toBe("wor");
    expect(spans[0].getAttribute("data-highlight-id")).toBe("h1");
  });

  it("wraps a sub-range inside a single text node", () => {
    const root = buildTextLayer(["abcdef"]);
    wrapRange(root, 2, 4, "anno-note", null, { "note-id": "n1" });

    const note = root.querySelector("span.anno-note");
    expect(note?.textContent).toBe("cd");
    // Original text preserved around the wrap
    expect(root.textContent).toBe("abcdef");
  });

  it("ignores out-of-bounds ranges", () => {
    const root = buildTextLayer(["abc"]);
    expect(() => wrapRange(root, 10, 20, "anno-highlight", null, {})).not.toThrow();
    expect(root.querySelector(".anno-highlight")).toBeNull();
  });

  it("keeps the concatenated text stream stable (offsets survive wrapping)", () => {
    const root = buildTextLayer(["abcdef", "ghijkl"]);
    wrapRange(root, 3, 9, "anno-highlight", null, {});
    const third = getTextNodes(root);
    // Total stream length unchanged
    const total = third.reduce((sum, n) => sum + (n.textContent?.length ?? 0), 0);
    expect(total).toBe(12);
  });
});

describe("clearAnnotations", () => {
  it("unwraps annotation spans and restores text", () => {
    const root = buildTextLayer(["hello", "world"]);
    wrapRange(root, 1, 8, "anno-highlight", null, {});
    expect(root.querySelector(".anno-highlight")).not.toBeNull();

    clearAnnotations(root);
    expect(root.querySelector(".anno-highlight")).toBeNull();
    expect(root.textContent).toBe("helloworld");
  });
});

describe("parseCfiOffsets", () => {
  it("parses the pseudo-CFI range suffix", () => {
    expect(parseCfiOffsets("epubcfi(/6/4[chap01]!/4/2:12,34)")).toEqual({
      start: 12,
      end: 34,
    });
  });

  it("returns null for malformed CFI", () => {
    expect(parseCfiOffsets("nope")).toBeNull();
    expect(parseCfiOffsets("epubcfi(/6/4)")).toBeNull();
  });
});

describe("toContainerRect", () => {
  it("converts viewport-relative rects to container-relative rects", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    viSpyGetBoundingClientRect(container, { top: 100, left: 50 });

    const domRect = {
      top: 150, left: 60, bottom: 170, right: 90, width: 30, height: 20,
    } as DOMRect;
    const rect = toContainerRect(domRect, container);
    expect(rect).toEqual({
      top: 50, left: 10, bottom: 70, right: 40, width: 30, height: 20,
    });

    document.body.removeChild(container);
  });
});

/** Patch getBoundingClientRect on an element (happy-dom default is 0s). */
function viSpyGetBoundingClientRect(
  el: HTMLElement,
  rect: { top: number; left: number },
) {
  el.getBoundingClientRect = () =>
    ({
      top: rect.top,
      left: rect.left,
      bottom: rect.top,
      right: rect.left,
      width: 0,
      height: 0,
      toJSON: () => ({}),
    }) as DOMRect;
}

describe("isInsideFloatingUi", () => {
  it("matches the selection toolbar", () => {
    const toolbar = document.createElement("div");
    toolbar.setAttribute("data-selection-toolbar", "");
    const button = document.createElement("button");
    toolbar.appendChild(button);
    document.body.appendChild(toolbar);

    expect(isInsideFloatingUi(button)).toBe(true);
    expect(isInsideFloatingUi(toolbar)).toBe(true);
    document.body.removeChild(toolbar);
  });

  it("matches the highlight popover", () => {
    const popover = document.createElement("div");
    popover.setAttribute("data-highlight-popover", "");
    const swatch = document.createElement("button");
    popover.appendChild(swatch);
    document.body.appendChild(popover);

    expect(isInsideFloatingUi(swatch)).toBe(true);
    document.body.removeChild(popover);
  });

  it("matches SVG icon targets inside the toolbar (not just HTMLElement)", () => {
    const toolbar = document.createElement("div");
    toolbar.setAttribute("data-selection-toolbar", "");
    document.body.appendChild(toolbar);

    // Toolbar buttons contain lucide SVG icons: e.target is an SVGElement,
    // which is NOT an instance of HTMLElement — regression guard for the
    // "toolbar reopens after AI translate" bug.
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.appendChild(path);
    toolbar.appendChild(svg);

    expect(path instanceof HTMLElement).toBe(false); // premise of the bug
    expect(isInsideFloatingUi(path)).toBe(true);
    expect(isInsideFloatingUi(svg)).toBe(true);

    document.body.removeChild(toolbar);
  });

  it("returns false for page content and null targets", () => {
    expect(isInsideFloatingUi(null)).toBe(false);
    const page = document.createElement("div");
    document.body.appendChild(page);
    expect(isInsideFloatingUi(page)).toBe(false);
    document.body.removeChild(page);
  });
});

describe("findSentenceContext", () => {
  const lines = ["The quick brown", "fox jumps over", "the lazy dog"];

  it("returns the line containing the selection", () => {
    expect(findSentenceContext("fox jumps", lines)).toBe("fox jumps over");
  });

  it("falls back to the selection when not found", () => {
    expect(findSentenceContext("missing", lines)).toBe("missing");
  });
});

describe("findParagraphContext", () => {
  const lines = ["l0", "l1", "l2", "l3", "l4"];

  it("joins the containing line with one neighbor on each side", () => {
    expect(findParagraphContext("l2", lines)).toBe("l1 l2 l3");
  });

  it("clamps at the start of the line array", () => {
    expect(findParagraphContext("l0", lines)).toBe("l0 l1");
  });

  it("clamps at the end of the line array", () => {
    expect(findParagraphContext("l4", lines)).toBe("l3 l4");
  });

  it("falls back to the selection when not found", () => {
    expect(findParagraphContext("nope", lines)).toBe("nope");
  });
});
