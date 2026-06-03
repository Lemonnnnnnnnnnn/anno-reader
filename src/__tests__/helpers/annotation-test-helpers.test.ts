/**
 * Tests for annotation test helpers.
 *
 * Verifies that the helper factories and utilities
 * produce correct output for highlight TDD.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  parseCfiOffsets,
  createTestHighlight,
  createTestHighlightData,
  createTestNote,
  mockTreeWalker,
  mockRange,
  mockPostMessage,
} from "./annotation-test-helpers";

// ── parseCfiOffsets ──────────────────────────────────────────────────────────

describe("parseCfiOffsets", () => {
  it("parses valid pseudo-CFI range", () => {
    const result = parseCfiOffsets("epubcfi(/6/4[chap01]!/4/2:10,20)");
    expect(result).toEqual({ start: 10, end: 20 });
  });

  it("parses zero offsets", () => {
    const result = parseCfiOffsets("epubcfi(/6/4[chap01]!/4/2:0,0)");
    expect(result).toEqual({ start: 0, end: 0 });
  });

  it("parses large offsets", () => {
    const result = parseCfiOffsets("epubcfi(/6/4[chap01]!/4/2:99999,100000)");
    expect(result).toEqual({ start: 99999, end: 100000 });
  });

  it("returns null for CFI without offsets", () => {
    const result = parseCfiOffsets("epubcfi(/6/4[chap01]!/4/2)");
    expect(result).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseCfiOffsets("")).toBeNull();
  });

  it("returns null for garbage input", () => {
    expect(parseCfiOffsets("not-a-cfi")).toBeNull();
  });

  it("handles CFI with text content before range", () => {
    const result = parseCfiOffsets("epubcfi(/6/4[chap01]!/4/2/1:5,15)");
    expect(result).toEqual({ start: 5, end: 15 });
  });
});

// ── createTestHighlight ──────────────────────────────────────────────────────

describe("createTestHighlight", () => {
  it("creates highlight with unique ID", () => {
    const h1 = createTestHighlight();
    const h2 = createTestHighlight();
    expect(h1.id).not.toBe(h2.id);
  });

  it("creates highlight with default values", () => {
    const h = createTestHighlight();
    expect(h.bookId).toBe("book-test-1");
    expect(h.chapterHref).toBe("chapter1.xhtml");
    expect(h.color).toBe("#ffff00");
    expect(h.text).toBeTruthy();
    expect(h.cfiRange).toBeTruthy();
    expect(h.createdAt).toBeTypeOf("number");
  });

  it("allows overriding fields", () => {
    const h = createTestHighlight({
      color: "#ff0000",
      text: "custom text",
      bookId: "my-book",
    });
    expect(h.color).toBe("#ff0000");
    expect(h.text).toBe("custom text");
    expect(h.bookId).toBe("my-book");
  });

  it("creates highlight matching store Highlight shape", () => {
    const h = createTestHighlight();
    // Verify all required fields exist
    expect(typeof h.id).toBe("string");
    expect(typeof h.bookId).toBe("string");
    expect(typeof h.chapterHref).toBe("string");
    expect(typeof h.cfiRange).toBe("string");
    expect(typeof h.text).toBe("string");
    expect(typeof h.color).toBe("string");
    expect(typeof h.createdAt).toBe("number");
  });
});

// ── createTestHighlightData ──────────────────────────────────────────────────

describe("createTestHighlightData", () => {
  it("creates HighlightData with ISO string createdAt", () => {
    const h = createTestHighlightData();
    expect(h.createdAt).toBeTypeOf("string");
    // Should be parseable as ISO date
    expect(Number.isNaN(Date.parse(h.createdAt))).toBe(false);
  });

  it("allows overriding fields", () => {
    const h = createTestHighlightData({ color: "#00ff00" });
    expect(h.color).toBe("#00ff00");
  });
});

// ── createTestNote ───────────────────────────────────────────────────────────

describe("createTestNote", () => {
  it("creates Note with content field", () => {
    const n = createTestNote();
    expect(n.content).toBe("sample note content");
    expect(n.text).toBeTruthy();
  });

  it("allows overriding content", () => {
    const n = createTestNote({ content: "my note" });
    expect(n.content).toBe("my note");
  });
});

// ── mockTreeWalker ───────────────────────────────────────────────────────────

describe("mockTreeWalker", () => {
  it("iterates through provided text nodes", () => {
    const walker = mockTreeWalker(["Hello ", "world"]);

    const n1 = walker.nextNode();
    expect(n1).toBeTruthy();
    expect(n1!.textContent).toBe("Hello ");

    const n2 = walker.nextNode();
    expect(n2).toBeTruthy();
    expect(n2!.textContent).toBe("world");

    const n3 = walker.nextNode();
    expect(n3).toBeNull();
  });

  it("updates currentNode on each nextNode call", () => {
    const walker = mockTreeWalker(["a", "b"]);

    walker.nextNode();
    expect(walker.currentNode!.textContent).toBe("a");

    walker.nextNode();
    expect(walker.currentNode!.textContent).toBe("b");
  });

  it("handles empty node list", () => {
    const walker = mockTreeWalker([]);
    expect(walker.nextNode()).toBeNull();
    expect(walker.currentNode).toBeNull();
  });

  it("setNodes resets and allows new iteration", () => {
    const walker = mockTreeWalker(["old"]);
    walker.nextNode();

    walker.setNodes(["new1", "new2"]);
    expect(walker.currentNode).toBeNull();

    const n1 = walker.nextNode();
    expect(n1!.textContent).toBe("new1");

    const n2 = walker.nextNode();
    expect(n2!.textContent).toBe("new2");
  });
});

// ── mockRange ────────────────────────────────────────────────────────────────

describe("mockRange", () => {
  it("creates range with default values", () => {
    const range = mockRange();
    expect(range.startContainer).toBeNull();
    expect(range.startOffset).toBe(0);
    expect(range.endContainer).toBeNull();
    expect(range.endOffset).toBe(0);
  });

  it("surroundContents throws by default (partial overlap)", () => {
    const range = mockRange();
    expect(() => range.surroundContents()).toThrow();
  });

  it("allows overriding surroundContents for success case", () => {
    const range = mockRange({
      surroundContents: vi.fn(() => {
        // Simulate successful surround
        const span = document.createElement("span");
        return span;
      }),
    });
    expect(() => range.surroundContents()).not.toThrow();
  });

  it("all methods are jest mocks for assertion", () => {
    const range = mockRange();
    range.collapse();
    range.setStart(null, 0);
    range.setEnd(null, 0);
    range.selectNodeContents(null);
    range.extractContents();
    range.deleteContents();
    range.cloneRange();
    range.toString();

    expect(range.collapse).toHaveBeenCalled();
    expect(range.setStart).toHaveBeenCalled();
    expect(range.setEnd).toHaveBeenCalled();
    expect(range.selectNodeContents).toHaveBeenCalled();
    expect(range.extractContents).toHaveBeenCalled();
    expect(range.deleteContents).toHaveBeenCalled();
    expect(range.cloneRange).toHaveBeenCalled();
    expect(range.toString).toHaveBeenCalled();
  });
});

// ── mockPostMessage ──────────────────────────────────────────────────────────

describe("mockPostMessage", () => {
  let pm: ReturnType<typeof mockPostMessage>;

  beforeEach(() => {
    pm = mockPostMessage();
  });

  afterEach(() => {
    pm.reset();
  });

  it("captures postMessage calls with type/payload", () => {
    window.postMessage({ type: "selection", payload: { text: "hi" } }, "*");

    expect(pm.calls).toHaveLength(1);
    expect(pm.lastCall()).toEqual({
      type: "selection",
      payload: { text: "hi" },
    });
  });

  it("reset clears captured calls", () => {
    window.postMessage({ type: "test", payload: null }, "*");
    expect(pm.calls).toHaveLength(1);

    pm.reset();
    expect(pm.calls).toHaveLength(0);
  });

  it("ignores non-object messages", () => {
    window.postMessage("string message", "*");
    window.postMessage(42, "*");

    expect(pm.calls).toHaveLength(0);
  });
});
