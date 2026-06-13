/**
 * Tests for AITranslationPanel.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { AITranslationPanel } from "..";

// Mock external dependencies for the stateful component
const mockTranslate = vi.fn().mockResolvedValue({
  translation: "你好世界这是选定的文本",
  originalText: "Hello world",
});
const mockPreviewTranslate = vi.fn().mockResolvedValue({
  selectedText: "Hello world",
  targetLanguage: "Chinese",
  renderedPrompt: "Translate the following text to Chinese...",
  systemMessage: "You are a professional translator.",
  userMessage: "Text to translate:\nHello world",
  contextSources: [],
});

vi.mock("@/lib/ai/translation", () => ({
  TranslationService: class MockTranslationService {
    translate = mockTranslate;
    previewTranslate = mockPreviewTranslate;
  },
}));

vi.mock("@/lib/annotations", () => ({
  createNote: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/stores/useBookStore", () => ({
  useBookStore: () => ({ currentBook: { id: "book-1" } }),
}));

vi.mock("@/stores/useAIConfigStore", () => ({
  useAIConfigStore: () => ({
    config: {
      providers: [],
      selectedProviderId: null,
      contextConfig: { modules: [], selectedModuleIds: [] },
      prompts: [],
    },
  }),
}));

vi.mock("@/hooks/useTTS", () => ({
  useTTS: () => ({
    speak: vi.fn(),
    stop: vi.fn(),
    isSpeaking: false,
  }),
}));

vi.mock("@/lib/chat/streaming", () => ({
  useChatStreaming: () => ({
    messages: [],
    streamingText: "",
    status: "idle",
    error: null,
    errorCode: null,
    sendChatMessage: vi.fn(),
    stopStreaming: vi.fn(),
    clearMessages: vi.fn(),
    reset: vi.fn(),
  }),
}));

describe("AITranslationPanel", () => {
  it("renders in loading state on mount", () => {
    const html = renderToString(
      <AITranslationPanel
        selectedText="Test text"
        chapterText={null}
        chapterHref="chapter1.xhtml"
        cfiRange="epubcfi(/6/4[chap01]!/4/2:0,5)"
        startOffset={0}
        endOffset={9}
        onClose={vi.fn()}
      />,
    );

    // Initial state is loading (useEffect doesn't fire in SSR)
    expect(html).toContain("animate-spin");
    expect(html).toContain("Translating…");
    expect(html).toContain("Test text");
  });

  it("renders AI Translation header", () => {
    const html = renderToString(
      <AITranslationPanel
        selectedText="Test"
        chapterText={null}
        chapterHref="chapter1.xhtml"
        cfiRange="epubcfi(/6/4[chap01]!/4/2:0,4)"
        startOffset={0}
        endOffset={4}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain("AI Translation");
  });

  it("renders close button", () => {
    const html = renderToString(
      <AITranslationPanel
        selectedText="Test"
        chapterText={null}
        chapterHref="chapter1.xhtml"
        cfiRange="epubcfi(/6/4[chap01]!/4/2:0,4)"
        startOffset={0}
        endOffset={4}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain(">Close<");
  });
});
