/**
 * Tests for PDF text helpers.
 *
 * @vitest-environment node
 */

import { describe, it, expect } from "vitest";
import {
  buildTextLines,
  buildPageContentHtml,
  escapeHtml,
  linesToPlainText,
  linesToSpacedText,
} from "../text";

/** Build a pdf.js-like text item. */
function item(str: string, hasEOL = false) {
  return { str, hasEOL };
}

describe("buildTextLines", () => {
  it("splits items into lines at hasEOL boundaries", () => {
    const lines = buildTextLines([
      item("Hello "),
      item("world", true),
      item("Second line", true),
    ]);
    expect(lines.map((l) => l.text)).toEqual(["Hello world", "Second line"]);
  });

  it("flushes a trailing line without EOL", () => {
    const lines = buildTextLines([item("A", true), item("trailing")]);
    expect(lines.map((l) => l.text)).toEqual(["A", "trailing"]);
  });

  it("collapses internal whitespace and trims each line", () => {
    const lines = buildTextLines([item("  foo   bar  ", true)]);
    expect(lines).toEqual([{ text: "foo bar" }]);
  });

  it("drops empty lines", () => {
    const lines = buildTextLines([item("   ", true), item("", true), item("x", true)]);
    expect(lines.map((l) => l.text)).toEqual(["x"]);
  });

  it("skips non-TextItem entries (marked content)", () => {
    const lines = buildTextLines([
      { type: "beginMarkedContent" } as unknown,
      item("real", true),
    ]);
    expect(lines.map((l) => l.text)).toEqual(["real"]);
  });
});

describe("escapeHtml", () => {
  it("escapes all HTML-special characters", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("plain text 123")).toBe("plain text 123");
  });
});

describe("buildPageContentHtml", () => {
  it("wraps each line in a <p> inside an html/body shell", () => {
    const html = buildPageContentHtml([{ text: "one" }, { text: "two" }]);
    expect(html).toBe("<html><body><p>one</p>\n<p>two</p></body></html>");
  });

  it("escapes HTML in line text", () => {
    const html = buildPageContentHtml([{ text: "<b>&</b>" }]);
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;&amp;&lt;/b&gt;");
  });
});

describe("linesToPlainText / linesToSpacedText", () => {
  const lines = [{ text: "a" }, { text: "b" }, { text: "c" }];

  it("joins with newlines", () => {
    expect(linesToPlainText(lines)).toBe("a\nb\nc");
  });

  it("joins with spaces", () => {
    expect(linesToSpacedText(lines)).toBe("a b c");
  });
});
