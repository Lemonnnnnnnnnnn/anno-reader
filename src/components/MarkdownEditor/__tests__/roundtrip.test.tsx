/**
 * Markdown round-trip tests for the Tiptap-based editor layer.
 *
 * The app persists notes as markdown strings, so the editor must load and
 * re-serialize markdown without drifting: save-after-open-without-edit must
 * keep the stored text byte-identical, and an edit must not reformat unrelated
 * parts of the document.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";

const extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    link: { openOnClick: false },
  }),
  Markdown,
  TaskList,
  TaskItem.configure({ nested: true }),
  TableKit.configure({ table: { resizable: false } }),
];

function roundTrip(markdown: string): string {
  const editor = new Editor({
    extensions,
    content: markdown,
    contentType: "markdown",
  });
  try {
    return editor.getMarkdown();
  } finally {
    editor.destroy();
  }
}

// Samples that must round-trip byte-identically: a save without edits must
// not rewrite the stored note.
const EXACT_SAMPLES = [
  "Plain paragraph text.",
  "**bold** and *italic* and ~~strike~~ and `code`",
  "## Heading\n\n### Subheading",
  "- one\n- two\n- three",
  "1. first\n2. second",
  "- [ ] todo\n- [x] done",
  "> quoted line",
  "[link](https://example.com)",
  "---",
  "```js\nconst x = 1;\n```",
  "First paragraph.\n\nSecond paragraph.",
];

// Samples whose syntax the serializer is allowed to normalize (e.g. __bold__
// becomes **bold**, 4-space nested lists become 2-space, table cells get
// space-padded) — but the result must be stable so a second save never
// rewrites it again.
const NORMALIZING_SAMPLES = [
  "__underscore bold__",
  "- a\n    - b",
  "* star bullets",
  "| a | b |\n| --- | --- |\n| 1 | 2 |",
];

describe("MarkdownEditor round-trip", () => {
  it.each(EXACT_SAMPLES)("preserves exactly: %s", (markdown) => {
    expect(roundTrip(markdown)).toBe(markdown);
  });

  it.each(NORMALIZING_SAMPLES)("normalizes then stays stable: %s", (markdown) => {
    const once = roundTrip(markdown);
    const twice = roundTrip(once);
    expect(twice).toBe(once);
  });

  it("preserves a representative real note", () => {
    const note = [
      "## Reading notes",
      "",
      "The author argues that **attention** is the scarcest resource.",
      "",
      "- Key idea 1 with `code`",
      "- Key idea 2",
      "  - nested detail",
      "",
      "> A quote worth keeping",
      "",
      "- [x] Follow up on chapter 3",
      "",
      "See [the paper](https://example.com) for details.",
    ].join("\n");

    const once = roundTrip(note);
    const twice = roundTrip(once);
    expect(once).toBe(note);
    expect(twice).toBe(once);
  });
});
