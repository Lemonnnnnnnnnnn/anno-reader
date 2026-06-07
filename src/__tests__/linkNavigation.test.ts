import { describe, expect, it } from "vitest";
import { findChapterIndexByHref, resolveEpubHref } from "@/lib/linkNavigation";

const CHAPTERS = [
  { href: "Text/chapter1.xhtml" },
  { href: "Text/chapter2.xhtml" },
  { href: "appendix/notes.xhtml" },
];

describe("linkNavigation", () => {
  it("resolves fragment-only links to the current chapter", () => {
    expect(resolveEpubHref("#section-1", "Text/chapter1.xhtml")).toEqual({
      targetPath: "Text/chapter1.xhtml",
      fragment: "section-1",
    });
  });

  it("resolves same-directory chapter links with fragments", () => {
    expect(resolveEpubHref("chapter2.xhtml#target", "Text/chapter1.xhtml")).toEqual({
      targetPath: "Text/chapter2.xhtml",
      fragment: "target",
    });
  });

  it("resolves parent-directory relative links", () => {
    expect(resolveEpubHref("../appendix/notes.xhtml#n1", "Text/chapter1.xhtml")).toEqual({
      targetPath: "appendix/notes.xhtml",
      fragment: "n1",
    });
  });

  it("strips query strings and decodes fragments", () => {
    expect(resolveEpubHref("chapter2.xhtml?x=1#space%20anchor", "Text/chapter1.xhtml")).toEqual({
      targetPath: "Text/chapter2.xhtml",
      fragment: "space anchor",
    });
  });

  it("ignores external and script links", () => {
    expect(resolveEpubHref("https://example.com", "Text/chapter1.xhtml")).toBeNull();
    expect(resolveEpubHref("mailto:a@example.com", "Text/chapter1.xhtml")).toBeNull();
    expect(resolveEpubHref("javascript:alert(1)", "Text/chapter1.xhtml")).toBeNull();
  });

  it("finds chapters by normalized href", () => {
    expect(findChapterIndexByHref(CHAPTERS, "./Text/../Text/chapter2.xhtml?x=1")).toBe(1);
    expect(findChapterIndexByHref(CHAPTERS, "missing.xhtml")).toBe(-1);
  });
});
