/**
 * Tests for PDF sentence/paragraph context extraction (textLayerDom).
 *
 * PDF pages only carry line-wrapped visual lines, so context must be
 * assembled across line breaks: full containing sentence for `sentence`,
 * sentence ± 1 for `paragraph`, with line-end hyphenation merged.
 */
import { describe, it, expect } from "vitest";
import {
  findSentenceContext,
  findParagraphContext,
} from "@/components/PdfViewer/textLayerDom";

describe("findSentenceContext (PDF)", () => {
  it("assembles a sentence spanning multiple lines", () => {
    const lines = [
      "This is the first",
      "sentence which spans",
      "multiple lines here.",
      "Second sentence.",
    ];

    // A word in the middle line — the OLD behavior returned just one line
    const sentence = findSentenceContext("spans", lines);
    expect(sentence).toBe("This is the first sentence which spans multiple lines here.");
  });

  it("merges line-end hyphenation", () => {
    const lines = ["The infor-", "mation is clear.", "Next one."];

    expect(findSentenceContext("clear", lines)).toBe("The information is clear.");
  });

  it("locates selections spanning lines (newline inside selection)", () => {
    const lines = ["One two three", "four five six.", "Seven eight."];

    // sel.toString() across lines contains a newline
    expect(findSentenceContext("three\nfour", lines)).toBe("One two three four five six.");
  });

  it("keeps the terminator and trailing closers", () => {
    const lines = ['He said "stop."', "Then he left."];

    expect(findSentenceContext("left", lines)).toBe("Then he left.");
    expect(findSentenceContext("stop", lines)).toBe('He said "stop."');
  });

  it("supports CJK terminators", () => {
    const lines = ["这是第一", "句的内容。", "第二句在这里。"];

    expect(findSentenceContext("内容", lines)).toBe("这是第一句的内容。");
  });

  it("caps runaway sentences at 500 chars", () => {
    // One unterminated "sentence" of 600 words
    const longLine = Array.from({ length: 600 }, (_, i) => `word${i}`).join(" ");
    const lines = [longLine];

    const sentence = findSentenceContext("word5", lines);
    expect(sentence.length).toBe(500);
    expect(sentence.startsWith("word0")).toBe(true);
  });

  it("falls back to the selection when it is not on the page", () => {
    const lines = ["Unrelated text."];

    expect(findSentenceContext("not present", lines)).toBe("not present");
  });

  it("returns trimmed selection for empty input", () => {
    expect(findSentenceContext("   ", ["line"])).toBe("");
  });
});

describe("findParagraphContext (PDF)", () => {
  const lines = [
    "First sentence.",
    "Second sentence is",
    "the one with the selection.",
    "Third sentence.",
    "Fourth sentence.",
  ];

  it("returns the containing sentence plus one on each side", () => {
    const paragraph = findParagraphContext("selection", lines);
    expect(paragraph).toBe(
      "First sentence. Second sentence is the one with the selection. Third sentence.",
    );
  });

  it("clamps at page boundaries (first sentence)", () => {
    const paragraph = findParagraphContext("First", lines);
    expect(paragraph).toBe(
      "First sentence. Second sentence is the one with the selection.",
    );
  });

  it("clamps at page boundaries (last sentence)", () => {
    const paragraph = findParagraphContext("Fourth", lines);
    expect(paragraph).toBe("Third sentence. Fourth sentence.");
  });

  it("merges line-end hyphenation", () => {
    const hyphenLines = ["Some exam-", "ple text here.", "After."];

    expect(findParagraphContext("text", hyphenLines)).toBe(
      "Some example text here. After.",
    );
  });

  it("falls back to the selection when not found", () => {
    expect(findParagraphContext("missing", lines)).toBe("missing");
  });
});
