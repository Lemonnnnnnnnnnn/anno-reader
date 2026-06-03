import { describe, it, expect, vi } from "vitest";
import { ContextService } from "../context";
import type { ContextModule } from "../types";
import type { DictionaryAggregator, AggregatedDictionaryResult } from "@/lib/dictionaries";

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

function makeAggregator(
  searchFn: (word: string) => Promise<AggregatedDictionaryResult>,
): DictionaryAggregator {
  return {
    search: vi.fn(searchFn),
    registerProvider: vi.fn(),
    searchSingle: vi.fn(),
  } as unknown as DictionaryAggregator;
}

function makeEtymResult(word: string, etymology: string): AggregatedDictionaryResult {
  return {
    word,
    results: [
      {
        source: "etymonline",
        word,
        found: true,
        data: { items: [{ etymology }] },
      },
    ],
    successCount: 1,
    errors: [],
    duration: 50,
  };
}

function makeVocabularyResult(word: string): AggregatedDictionaryResult {
  return {
    word,
    results: [
      {
        source: "vocabulary",
        word,
        found: true,
        data: { short: "brief def", long: "extended def" },
      },
    ],
    successCount: 1,
    errors: [],
    duration: 60,
  };
}

function makeEmptyAggResult(word: string): AggregatedDictionaryResult {
  return {
    word,
    results: [],
    successCount: 0,
    errors: [],
    duration: 10,
  };
}

// ---------------------------------------------------------------------------
// ContextService — getContext()
// ---------------------------------------------------------------------------

describe("ContextService", () => {
  describe("getContext()", () => {
    it("returns selected text with a sentence module when no chapterText", async () => {
      const service = new ContextService();
      const modules = [makeModule({ type: "sentence" })];
      const selectedText = "She walked through the garden";

      const result = await service.getContext(selectedText, null, modules);

      expect(result.text).toBe(selectedText);
      expect(result.metadata.selectedText).toBe(selectedText);
      expect(result.metadata.moduleCount).toBe("1");
      expect(result.source).toBe("mod-sentence");
    });

    it("extracts the sentence containing selected text from chapterText for sentence module", async () => {
      const service = new ContextService();
      const modules = [makeModule({ type: "sentence" })];
      const selectedText = "walked through the garden";
      const chapterText = "It was a beautiful morning. She walked through the garden and admired the flowers. The birds were singing in the trees.";

      const result = await service.getContext(selectedText, chapterText, modules);

      expect(result.text).toContain("walked through the garden");
      expect(result.text).toContain("admired the flowers");
      expect(result.source).toBe("mod-sentence");
    });

    it("returns module content with a custom module", async () => {
      const service = new ContextService();
      const customContent = "This is a glossary of literary terms.";
      const modules = [
        makeModule({ type: "custom", content: customContent }),
      ];

      const result = await service.getContext("anything", null, modules);

      expect(result.text).toBe(customContent);
      expect(result.source).toBe("mod-custom");
    });

    it("combines context from multiple enabled modules", async () => {
      const service = new ContextService();
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
      const service = new ContextService();
      const modules = [
        makeModule({ type: "sentence", isEnabled: false }),
      ];

      const result = await service.getContext("test", null, modules);

      expect(result.text).toBe("");
      expect(result.metadata.moduleCount).toBe("0");
      expect(result.source).toBe("");
    });

    it("ignores disabled modules and only processes enabled ones", async () => {
      const service = new ContextService();
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
      const service = new ContextService();
      const modules = [makeModule({ type: "sentence" })];
      const selectedText = "short";
      // Create a chapter with very long sentences
      const longSentence = "word ".repeat(200); // ~1000 chars
      const chapterText = `First sentence here. ${selectedText} in context. ${longSentence}`;

      const result = await service.getContext(selectedText, chapterText, modules);

      expect(result.text.length).toBeLessThanOrEqual(500);
    });

    it("returns empty text for dictionary module without aggregator", async () => {
      const service = new ContextService();
      const modules = [makeModule({ type: "dictionary" })];

      const result = await service.getContext("test", null, modules);

      expect(result.text).toBe("");
      expect(result.metadata.moduleCount).toBe("1");
      expect(result.source).toBe("mod-dictionary");
    });

    it("queries aggregator for dictionary module", async () => {
      const aggregator = makeAggregator(async (word) =>
        makeEtymResult(word, `Origin of ${word} from Latin.`),
      );
      const service = new ContextService(aggregator);
      const modules = [makeModule({ type: "dictionary" })];

      const result = await service.getContext("hello", null, modules);

      expect(result.text).toContain("[Etymology]");
      expect(result.text).toContain("Origin of hello from Latin.");
      expect(aggregator.search).toHaveBeenCalledWith("hello");
    });

    it("formats Vocabulary.com dictionary results", async () => {
      const aggregator = makeAggregator(async (word) =>
        makeVocabularyResult(word),
      );
      const service = new ContextService(aggregator);
      const modules = [makeModule({ type: "dictionary" })];

      const result = await service.getContext("hello", null, modules);

      expect(result.text).toContain("[Definition]");
      expect(result.text).toContain("brief def");
      expect(result.text).toContain("extended def");
    });

    it("caps dictionary context at 1500 characters", async () => {
      const longDefinition = "word ".repeat(500); // ~2500 chars
      const aggregator = makeAggregator(async (word) =>
        makeEtymResult(word, longDefinition),
      );
      const service = new ContextService(aggregator);
      const modules = [makeModule({ type: "dictionary" })];

      const result = await service.getContext("test", null, modules);

      expect(result.text.length).toBeLessThanOrEqual(1500);
    });

    it("gracefully handles dictionary aggregator failure", async () => {
      const aggregator = makeAggregator(async () => {
        throw new Error("Network error");
      });
      const service = new ContextService(aggregator);
      const modules = [
        makeModule({ type: "dictionary", id: "dict" }),
        makeModule({ type: "custom", id: "ctx", content: "Fallback context." }),
      ];

      const result = await service.getContext("test", null, modules);

      // Dictionary failure should not prevent other modules
      expect(result.text).toContain("Fallback context.");
      // Dictionary part should be empty
      expect(result.text).not.toContain("[Etymology]");
      expect(result.text).not.toContain("[Definition]");
    });

    it("returns null dictionary context when aggregator returns no results", async () => {
      const aggregator = makeAggregator(async (word) =>
        makeEmptyAggResult(word),
      );
      const service = new ContextService(aggregator);
      const modules = [makeModule({ type: "dictionary" })];

      const result = await service.getContext("test", null, modules);

      expect(result.text).toBe("");
    });

    it("combines dictionary and sentence context", async () => {
      const aggregator = makeAggregator(async (word) =>
        makeEtymResult(word, `Etymology of ${word}.`),
      );
      const service = new ContextService(aggregator);
      const modules = [
        makeModule({ type: "sentence", id: "sent" }),
        makeModule({ type: "dictionary", id: "dict" }),
      ];

      const result = await service.getContext("walked", "She walked.", modules);

      // Should contain both sentence context and dictionary context
      expect(result.text).toContain("walked");
      expect(result.text).toContain("[Etymology]");
      expect(result.text).toContain("\n\n");
    });

    it("returns a Promise from getContext", () => {
      const service = new ContextService();
      const modules = [makeModule({ type: "sentence" })];
      const result = service.getContext("test", null, modules);

      expect(result).toBeInstanceOf(Promise);
    });

    it("extracts the sentence containing selected text from chapter text", async () => {
      const service = new ContextService();
      const modules = [makeModule({ type: "sentence" })];
      const selectedText = "She walked through the garden";
      const chapterText =
        "The sun was shining. She walked through the garden. Birds were singing.";

      const result = await service.getContext(selectedText, chapterText, modules);

      expect(result.text).toContain("garden");
      expect(result.source).toBe("mod-sentence");
    });
  });
});
