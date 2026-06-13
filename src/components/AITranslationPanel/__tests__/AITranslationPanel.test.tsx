/**
 * Tests for AITranslationPanel.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { AITranslationPanelView, AITranslationPanel } from "..";

// Default props for the view component
const viewDefaults = {
  selectedText: "Hello world this is selected text",
  translationText: "",
  streamingText: "",
  error: null,
  isSaving: false,
  previewData: null,
  isOpen: true,
  onClose: vi.fn(),
  onRetry: vi.fn(),
  onAddNote: vi.fn(),
  onTranslate: vi.fn(),
  onPreview: vi.fn(),
  onStop: vi.fn(),
  isTTSAvailable: false,
  isSpeaking: false,
  onSpeak: vi.fn(),
  // Chat continuation props
  chatMode: false,
  onEnterChat: vi.fn(),
  onExitChat: vi.fn(),
  chatMessages: [],
  chatStreamingText: "",
  chatStatus: "idle" as const,
  onChatSend: vi.fn(),
  onChatStop: vi.fn(),
};

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

describe("AITranslationPanelView", () => {
  it("renders with selected text", () => {
    const html = renderToString(
      <AITranslationPanelView {...viewDefaults} status="loading" />,
    );

    expect(html).toContain("Hello world this is selected text");
  });

  it("shows loading state with spinner", () => {
    const html = renderToString(
      <AITranslationPanelView {...viewDefaults} status="loading" />,
    );

    expect(html).toContain("animate-spin");
    expect(html).toContain("Translating…");
  });

  it("shows translation result in success state", () => {
    const html = renderToString(
      <AITranslationPanelView
        {...viewDefaults}
        status="success"
        translationText="你好世界"
      />,
    );

    expect(html).toContain("Translation");
    expect(html).toContain("你好世界");
  });

  it("shows error state with retry button", () => {
    const html = renderToString(
      <AITranslationPanelView
        {...viewDefaults}
        status="error"
        error="Network error"
      />,
    );

    expect(html).toContain("Network error");
    expect(html).toContain(">Retry<");
  });

  it("shows default error message when error is null", () => {
    const html = renderToString(
      <AITranslationPanelView {...viewDefaults} status="error" />,
    );

    expect(html).toContain("Translation failed");
  });

  it("renders close button that calls onClose", () => {
    const onClose = vi.fn();
    const html = renderToString(
      <AITranslationPanelView
        {...viewDefaults}
        status="loading"
        onClose={onClose}
      />,
    );

    expect(html).toContain(">Close<");
    expect(html).toContain('aria-label="Close drawer"');
  });

  it("shows Add as Note button in success state", () => {
    const html = renderToString(
      <AITranslationPanelView {...viewDefaults} status="success" />,
    );

    expect(html).toContain(">Add as Note<");
  });

  it("does not show Add as Note button in loading state", () => {
    const html = renderToString(
      <AITranslationPanelView {...viewDefaults} status="loading" />,
    );

    expect(html).not.toContain("Add as Note");
  });

  it("does not show Add as Note button in error state", () => {
    const html = renderToString(
      <AITranslationPanelView {...viewDefaults} status="error" />,
    );

    expect(html).not.toContain("Add as Note");
  });

  it("does not show loading spinner in success state", () => {
    const html = renderToString(
      <AITranslationPanelView {...viewDefaults} status="success" />,
    );

    expect(html).not.toContain("animate-spin");
    expect(html).not.toContain("Translating…");
  });

  it("does not show retry button in loading state", () => {
    const html = renderToString(
      <AITranslationPanelView {...viewDefaults} status="loading" />,
    );

    expect(html).not.toContain(">Retry<");
  });
});

describe("AITranslationPanel (stateful)", () => {
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
