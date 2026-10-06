/** @vitest-environment happy-dom */
import { expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { renderToStaticMarkup } from "react-dom/server";
import { NoteColor } from "../noteColor";
import { MarkdownView } from "../../MarkdownView";

it("saves, reloads and clears a color while preserving bold text", () => {
  const editor = new Editor({ extensions: [StarterKit, Markdown, NoteColor], content: "**hello** world", contentType: "markdown" });
  try {
    editor.commands.setTextSelection({ from: 1, to: 6 });
    editor.commands.setMark("noteColor", { color: "red" });
    const saved = editor.getMarkdown();
    editor.commands.setContent(saved, { contentType: "markdown" });
    editor.commands.setTextSelection({ from: 1, to: 6 });
    expect(editor.isActive("noteColor", { color: "red" })).toBe(true);
    expect(editor.isActive("bold")).toBe(true);
    editor.commands.unsetMark("noteColor");
    expect(editor.getMarkdown()).toBe("**hello** world");
  } finally { editor.destroy(); }
});

it("renders only approved color classes and removes unsafe HTML attributes", () => {
  const html = renderToStaticMarkup(<MarkdownView content={'A <span data-note-color="red" onclick="alert(1)" style="color:red">**hello**</span><script>alert(2)</script>'} />);
  expect(html).toContain('class="text-red-600 dark:text-red-400"');
  expect(html).toContain("<strong>hello</strong>");
  expect(html).not.toMatch(/onclick|style=|script|alert/);
});
