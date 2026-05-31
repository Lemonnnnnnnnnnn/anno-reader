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

// ---------------------------------------------------------------------------
// ContextService — getContext()
// ---------------------------------------------------------------------------

describe("ContextService", () => {
  const service = new ContextService();

  describe("getContext()", () => {
    it("returns selected text with a sentence module", () => {
      const modules = [makeModule({ type: "sentence" })];
      const selectedText = "She walked through the garden";

      const result = service.getContext(selectedText, modules);

      expect(result.text).toBe(selectedText);
      expect(result.metadata.selectedText).toBe(selectedText);
      expect(result.metadata.moduleCount).toBe("1");
      expect(result.source).toBe("mod-sentence");
    });

    it("returns module content with a custom module", () => {
      const customContent = "This is a glossary of literary terms.";
      const modules = [
        makeModule({ type: "custom", content: customContent }),
      ];

      const result = service.getContext("anything", modules);

      expect(result.text).toBe(customContent);
      expect(result.source).toBe("mod-custom");
    });

    it("combines context from multiple enabled modules", () => {
      const modules = [
        makeModule({ type: "sentence", id: "s1" }),
        makeModule({
          type: "custom",
          id: "c1",
          content: "Glossary data here.",
        }),
      ];

      const selectedText = "birds were singing";
      const result = service.getContext(selectedText, modules);

      // Sentence module contributes the selected text
      expect(result.text).toContain(selectedText);
      // Custom module contributes its content
      expect(result.text).toContain("Glossary data here.");
      // They are separated by double newline
      expect(result.text).toContain("\n\n");
      expect(result.metadata.moduleCount).toBe("2");
      expect(result.source).toBe("s1,c1");
    });

    it("returns empty context when no modules are enabled", () => {
      const modules = [
        makeModule({ type: "sentence", isEnabled: false }),
      ];

      const result = service.getContext("test", modules);

      expect(result.text).toBe("");
      expect(result.metadata.moduleCount).toBe("0");
      expect(result.source).toBe("");
    });

    it("ignores disabled modules and only processes enabled ones", () => {
      const modules = [
        makeModule({ type: "sentence", isEnabled: false, id: "disabled" }),
        makeModule({
          type: "custom",
          isEnabled: true,
          id: "enabled",
          content: "Only this one.",
        }),
      ];

      const result = service.getContext("test", modules);

      expect(result.text).toBe("Only this one.");
      expect(result.source).toBe("enabled");
      expect(result.metadata.moduleCount).toBe("1");
    });
  });
});
