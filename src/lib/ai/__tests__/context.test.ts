import { describe, it, expect } from "vitest";
import { ContextService } from "../context";
import type { ContextModule } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeModule(
  overrides: Partial<ContextModule> & { type: ContextModule["type"] },
): ContextModule {
  return {
    id: `mod-${overrides.type}`,
    name: `${overrides.type} module`,
    content: "",
    isEnabled: true,
    ...overrides,
  };
}

const FULL_TEXT = [
  "First paragraph about the weather.",
  "It was a sunny day and the birds were singing in the trees.",
  "",
  "Second paragraph about the protagonist.",
  "She walked through the garden, admiring the flowers.",
  "",
  "Third paragraph about the setting.",
  "The old castle stood on the hill, overlooking the village.",
].join("\n");

// ---------------------------------------------------------------------------
// ContextService — getContext()
// ---------------------------------------------------------------------------

describe("ContextService", () => {
  const service = new ContextService();

  describe("getContext()", () => {
    it("extracts surrounding paragraph text with a paragraph module", () => {
      const modules = [makeModule({ type: "paragraph" })];
      const selectedText = "She walked through the garden";

      const result = service.getContext(selectedText, FULL_TEXT, modules);

      // The algorithm treats sentence-ending punctuation + \n as a paragraph
      // boundary, so "protagonist.\n" is a boundary — only the second line is
      // extracted as the paragraph containing the selection.
      expect(result.text).toBe(
        "She walked through the garden, admiring the flowers.",
      );
      expect(result.metadata.selectedText).toBe(selectedText);
      expect(result.metadata.moduleCount).toBe("1");
      expect(result.source).toBe("mod-paragraph");
    });

    it("returns full text with a chapter module", () => {
      const modules = [makeModule({ type: "chapter" })];
      const selectedText = "birds were singing";

      const result = service.getContext(selectedText, FULL_TEXT, modules);

      expect(result.text).toBe(FULL_TEXT);
      expect(result.metadata.moduleCount).toBe("1");
      expect(result.source).toBe("mod-chapter");
    });

    it("returns module content with a custom module", () => {
      const customContent = "This is a glossary of literary terms.";
      const modules = [
        makeModule({ type: "custom", content: customContent }),
      ];

      const result = service.getContext("anything", FULL_TEXT, modules);

      expect(result.text).toBe(customContent);
      expect(result.source).toBe("mod-custom");
    });

    it("combines context from multiple enabled modules", () => {
      const modules = [
        makeModule({ type: "paragraph", id: "p1" }),
        makeModule({
          type: "custom",
          id: "c1",
          content: "Glossary data here.",
        }),
      ];

      // Select text within a paragraph bounded by sentence-ending + \n on
      // the left and \n\n on the right.
      const result = service.getContext(
        "birds were singing",
        FULL_TEXT,
        modules,
      );

      // Paragraph module contributes the paragraph containing the selection
      expect(result.text).toContain(
        "It was a sunny day and the birds were singing in the trees.",
      );
      // Custom module contributes its content
      expect(result.text).toContain("Glossary data here.");
      // They are separated by double newline
      expect(result.text).toContain("\n\n");
      expect(result.metadata.moduleCount).toBe("2");
      expect(result.source).toBe("p1,c1");
    });

    it("returns empty context when no modules are enabled", () => {
      const modules = [
        makeModule({ type: "paragraph", isEnabled: false }),
        makeModule({ type: "chapter", isEnabled: false }),
      ];

      const result = service.getContext("test", FULL_TEXT, modules);

      expect(result.text).toBe("");
      expect(result.metadata.moduleCount).toBe("0");
      expect(result.source).toBe("");
    });

    it("ignores disabled modules and only processes enabled ones", () => {
      const modules = [
        makeModule({ type: "paragraph", isEnabled: false, id: "disabled" }),
        makeModule({
          type: "custom",
          isEnabled: true,
          id: "enabled",
          content: "Only this one.",
        }),
      ];

      const result = service.getContext("test", FULL_TEXT, modules);

      expect(result.text).toBe("Only this one.");
      expect(result.source).toBe("enabled");
      expect(result.metadata.moduleCount).toBe("1");
    });
  });

  // -------------------------------------------------------------------------
  // extractParagraphContext (tested via getContext with paragraph module)
  // -------------------------------------------------------------------------

  describe("extractParagraphContext (via paragraph module)", () => {
    it("handles text at the start of content", () => {
      const modules = [makeModule({ type: "paragraph" })];
      const selectedText = "First paragraph about the weather";

      const result = service.getContext(selectedText, FULL_TEXT, modules);

      expect(result.text).toContain("First paragraph about the weather.");
    });

    it("handles text at the end of content", () => {
      const text = "Opening line.\n\nFinal paragraph with the old castle.";
      const modules = [makeModule({ type: "paragraph" })];

      const result = service.getContext("old castle", text, modules);

      expect(result.text).toContain(
        "Final paragraph with the old castle.",
      );
    });

    it("returns selected text when not found in fullText", () => {
      const modules = [makeModule({ type: "paragraph" })];

      const result = service.getContext(
        "completely absent text",
        FULL_TEXT,
        modules,
      );

      expect(result.text).toBe("completely absent text");
    });

    it("returns empty string when selectedText is empty", () => {
      const modules = [makeModule({ type: "paragraph" })];

      const result = service.getContext("", FULL_TEXT, modules);

      expect(result.text).toBe("");
    });

    it("returns empty string when fullText is empty", () => {
      const modules = [makeModule({ type: "paragraph" })];

      const result = service.getContext("some text", "", modules);

      expect(result.text).toBe("");
    });

    it("returns empty string when both inputs are empty", () => {
      const modules = [makeModule({ type: "paragraph" })];

      const result = service.getContext("", "", modules);

      expect(result.text).toBe("");
    });

    it("respects double-newline paragraph boundaries", () => {
      const text = "Para one content here.\n\nPara two content here.";
      const modules = [makeModule({ type: "paragraph" })];

      const result = service.getContext("Para two", text, modules);

      expect(result.text).toBe("Para two content here.");
    });

    it("respects sentence-ending single-newline boundaries", () => {
      // Single newline after sentence-ending punctuation should count as paragraph break
      const text =
        "First sentence ends here.\nSecond paragraph begins here.";
      const modules = [makeModule({ type: "paragraph" })];

      const result = service.getContext("Second paragraph", text, modules);

      expect(result.text).toContain("Second paragraph begins here.");
    });
  });
});
