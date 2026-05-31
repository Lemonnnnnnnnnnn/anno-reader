import { describe, it, expect, vi } from "vitest";
import { ContextService } from "../context";
import type { ContextModule } from "../types";

// Mock DictionaryAggregator for dictionary module tests
vi.mock("@/lib/dictionaries", () => ({
  DictionaryAggregator: vi.fn().mockImplementation(() => ({
    search: vi.fn().mockResolvedValue({
      word: "test",
      results: [],
      successCount: 0,
      errors: [],
      duration: 10,
    }),
  })),
}));

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
    it("returns selected text with a sentence module when no chapterText", async () => {
      const modules = [makeModule({ type: "sentence" })];
      const selectedText = "She walked through the garden";

      const result = await service.getContext(selectedText, null, modules);

      expect(result.text).toBe(selectedText);
      expect(result.metadata.selectedText).toBe(selectedText);
      expect(result.metadata.moduleCount).toBe("1");
      expect(result.source).toBe("mod-sentence");
    });

    it("extracts surrounding sentences from chapterText for sentence module", async () => {
      const modules = [makeModule({ type: "sentence" })];
      const selectedText = "walked through the garden";
      const chapterText = "It was a beautiful morning. She walked through the garden and admired the flowers. The birds were singing in the trees.";

      const result = await service.getContext(selectedText, chapterText, modules);

      expect(result.text).toContain("beautiful morning");
      expect(result.text).toContain("walked through the garden");
      expect(result.text).toContain("birds were singing");
      expect(result.source).toBe("mod-sentence");
    });

    it("returns module content with a custom module", async () => {
      const customContent = "This is a glossary of literary terms.";
      const modules = [
        makeModule({ type: "custom", content: customContent }),
      ];

      const result = await service.getContext("anything", null, modules);

      expect(result.text).toBe(customContent);
      expect(result.source).toBe("mod-custom");
    });

    it("combines context from multiple enabled modules", async () => {
      const modules = [
        makeModule({ type: "sentence", id: "s1" }),
        makeModule({
          type: "custom",
          id: "c1",
          content: "Glossary data here.",
        }),
      ];

      const selectedText = "birds were singing";
      const result = await service.getContext(selectedText, null, modules);

      // Sentence module contributes the selected text
      expect(result.text).toContain(selectedText);
      // Custom module contributes its content
      expect(result.text).toContain("Glossary data here.");
      // They are separated by double newline
      expect(result.text).toContain("\n\n");
      expect(result.metadata.moduleCount).toBe("2");
      expect(result.source).toBe("s1,c1");
    });

    it("returns empty context when no modules are enabled", async () => {
      const modules = [
        makeModule({ type: "sentence", isEnabled: false }),
      ];

      const result = await service.getContext("test", null, modules);

      expect(result.text).toBe("");
      expect(result.metadata.moduleCount).toBe("0");
      expect(result.source).toBe("");
    });

    it("ignores disabled modules and only processes enabled ones", async () => {
      const modules = [
        makeModule({ type: "sentence", isEnabled: false, id: "disabled" }),
        makeModule({
          type: "custom",
          isEnabled: true,
          id: "enabled",
          content: "Only this one.",
        }),
      ];

      const result = await service.getContext("test", null, modules);

      expect(result.text).toBe("Only this one.");
      expect(result.source).toBe("enabled");
      expect(result.metadata.moduleCount).toBe("1");
    });

    it("caps sentence context at 500 characters", async () => {
      const modules = [makeModule({ type: "sentence" })];
      const selectedText = "short";
      // Create a chapter with very long sentences
      const longSentence = "word ".repeat(200); // ~1000 chars
      const chapterText = `First sentence here. ${selectedText} in context. ${longSentence}`;

      const result = await service.getContext(selectedText, chapterText, modules);

      expect(result.text.length).toBeLessThanOrEqual(500);
    });

    it("skips dictionary modules (placeholder)", async () => {
      const modules = [makeModule({ type: "dictionary" })];

      const result = await service.getContext("test", null, modules);

      expect(result.text).toBe("");
      expect(result.metadata.moduleCount).toBe("1");
      expect(result.source).toBe("mod-dictionary");
    });

    it("returns a Promise from getContext", () => {
      const modules = [makeModule({ type: "sentence" })];
      const result = service.getContext("test", null, modules);

      expect(result).toBeInstanceOf(Promise);
    });

    it("extracts sentences containing 'shining' and 'garden' from chapter text", async () => {
      const modules = [makeModule({ type: "sentence" })];
      const selectedText = "She walked through the garden";
      const chapterText =
        "The sun was shining. She walked through the garden. Birds were singing.";

      const result = await service.getContext(selectedText, chapterText, modules);

      expect(result.text).toContain("shining");
      expect(result.text).toContain("garden");
      expect(result.text).toContain("singing");
      expect(result.source).toBe("mod-sentence");
    });
  });
});
