import { Mark } from "@tiptap/core";

import { NOTE_COLORS } from "@/lib/noteColors";
export { NOTE_COLORS } from "@/lib/noteColors";

export const NoteColor = Mark.create({
  name: "noteColor",
  addAttributes() {
    return { color: { default: null, parseHTML: element => element.getAttribute("data-note-color"), rendered: false } };
  },
  parseHTML() {
    return [{ tag: "span[data-note-color]", getAttrs: element => NOTE_COLORS.some(c => c.value === element.getAttribute("data-note-color")) ? null : false }];
  },
  renderHTML({ mark }) {
    const color = NOTE_COLORS.find(c => c.value === mark.attrs.color);
    return ["span", { "data-note-color": color?.value, class: color?.className }, 0];
  },
  markdownTokenizer: {
    name: "noteColor", level: "inline",
    start: src => src.indexOf('<span data-note-color="'),
    tokenize(src, _tokens, lexer) {
      const match = /^<span data-note-color="(red|orange|green|blue|purple)">([\s\S]*?)<\/span>/.exec(src);
      if (!match) return;
      return { type: "noteColor", raw: match[0], color: match[1], tokens: lexer.inlineTokens(match[2]) };
    },
  },
  parseMarkdown: (token, helpers) => helpers.applyMark("noteColor", helpers.parseInline(token.tokens ?? []), { color: token.color }),
  renderMarkdown: (node, helpers) => `<span data-note-color="${node.attrs?.color}">${helpers.renderChildren(node)}</span>`,
});
