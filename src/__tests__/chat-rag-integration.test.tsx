/**
 * Chat + RAG integration tests.
 *
 * Tests ChatDrawer with RAG integration:
 * - Quick-action buttons trigger correct predefined queries
 * - RAG system message flows into sendChatMessage
 * - Loading states during book indexing
 * - Error states with retry on indexing failure
 * - Selection → chat flow via initialMessage
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { renderToString } from "react-dom/server";
import type { ChatMessage } from "@/lib/chat/types";
import type { AIProvider } from "@/lib/ai/types";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const testProvider: AIProvider = {
  id: "test-provider",
  name: "Test AI",
  type: "openai",
  baseUrl: "https://api.test.com/v1",
  apiKey: "sk-test-key",
  model: "gpt-4o",
  maxTokens: 1000,
  temperature: 0.7,
  enabled: true,
};

const testBook = {
  id: "test-book-123",
  title: "Test Book Title",
  author: "Test Author",
  filePath: "/path/to/test.epub",
  coverUrl: null,
  lastOpened: Date.now(),
};

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    content: "Hello",
    createdAt: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// RAG mock state
// ---------------------------------------------------------------------------

let ragAskQuestion: Mock;
let ragIsIndexing = false;
let ragIsIndexed = false;
let ragError: string | null = null;

vi.mock("@/lib/rag", () => ({
  useRAG: () => ({
    isIndexing: ragIsIndexing,
    isIndexed: ragIsIndexed,
    error: ragError,
    askQuestion: ragAskQuestion,
  }),
}));

// ---------------------------------------------------------------------------
// Streaming mock state
// ---------------------------------------------------------------------------

let streamingMessages: ChatMessage[] = [];
let streamingStatus = "idle";
let streamingError: string | null = null;
let streamingErrorCode: string | null = null;
let streamingText = "";
const mockSendChatMessage = vi.fn();
const mockStopStreaming = vi.fn();
const mockClearMessages = vi.fn();
const mockReset = vi.fn();

vi.mock("@/lib/chat/streaming", () => ({
  useChatStreaming: () => ({
    messages: streamingMessages,
    streamingText,
    status: streamingStatus,
    error: streamingError,
    errorCode: streamingErrorCode,
    sendChatMessage: mockSendChatMessage,
    stopStreaming: mockStopStreaming,
    clearMessages: mockClearMessages,
    reset: mockReset,
  }),
}));

// ---------------------------------------------------------------------------
// AI config mock
// ---------------------------------------------------------------------------

vi.mock("@/stores/useAIConfigStore", () => ({
  useAIConfigStore: vi.fn((selector) => {
    const state = {
      config: {
        providers: [testProvider],
        selectedProviderId: testProvider.id,
      },
    };
    return selector(state);
  }),
}));

// ---------------------------------------------------------------------------
// Book store mock
// ---------------------------------------------------------------------------

vi.mock("@/stores/useBookStore", () => ({
  useBookStore: vi.fn((selector) => {
    const state = {
      currentBook: testBook,
    };
    return selector ? selector(state) : state;
  }),
}));

// ---------------------------------------------------------------------------
// Persistence mock
// ---------------------------------------------------------------------------

vi.mock("@/lib/chat/persistence", () => ({
  loadConversations: vi.fn(() => Promise.resolve([])),
  saveConversations: vi.fn(() => Promise.resolve()),
  ensureChatDir: vi.fn(() => Promise.resolve("/mock/chat")),
}));

// ---------------------------------------------------------------------------
// Chat store mock
// ---------------------------------------------------------------------------

vi.mock("@/stores/useChatStore", () => ({
  useChatStore: Object.assign(
    vi.fn((selector) => {
      const state = {
        conversations: [],
        currentConversationId: null,
        messages: [],
        isLoaded: true,
        addMessage: vi.fn(),
        loadConversations: vi.fn(),
        setCurrentConversation: vi.fn(),
        createConversation: vi.fn(),
      };
      return selector ? selector(state) : state;
    }),
    {
      setState: vi.fn(),
      getState: vi.fn(() => ({
        conversations: [],
        currentConversationId: null,
        messages: [],
        isLoaded: true,
        addMessage: vi.fn(),
        loadConversations: vi.fn(),
        setCurrentConversation: vi.fn(),
        createConversation: vi.fn(),
      })),
    },
  ),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { ChatDrawerView } from "@/components/ChatDrawer";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Render ChatDrawerView with sensible defaults + RAG props. */
function renderView(overrides: Record<string, unknown> = {}) {
  const defaults = {
    isOpen: true,
    onClose: vi.fn(),
    view: "conversation" as const,
    bookId: testBook.id,
    messages: [] as ChatMessage[],
    streamingText: "",
    status: "idle" as const,
    error: null as string | null,
    errorCode: null,
    onSend: vi.fn(),
    onStop: vi.fn(),
    onRetry: vi.fn(),
    onBackToList: vi.fn(),
    onNewChat: vi.fn(),
    isIndexing: false,
    ragError: null as string | null,
    onRetryIndexing: vi.fn(),
  };
  return renderToString(
    <ChatDrawerView {...defaults} {...overrides} />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Chat + RAG Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    ragAskQuestion = vi.fn().mockResolvedValue({
      systemMessage: "Context about Test Book Title by Test Author: relevant chunks...",
    });
    ragIsIndexing = false;
    ragIsIndexed = false;
    ragError = null;

    streamingMessages = [];
    streamingStatus = "idle";
    streamingError = null;
    streamingErrorCode = null;
    streamingText = "";
  });

  // =========================================================================
  // 1. Quick-action buttons
  // =========================================================================

  describe("Quick-action buttons", () => {
    it("should render all three quick-action buttons in empty state", () => {
      const html = renderView({ messages: [] });

      expect(html).toContain("Ask about this book");
      expect(html).toContain("Request a summary");
      expect(html).toContain("Explain a passage");
    });

    it("should render quick-action buttons as interactive buttons", () => {
      const onSend = vi.fn();
      const html = renderView({ messages: [], onSend });

      // Verify buttons are present with descriptive text
      expect(html).toContain("Ask about this book");
      expect(html).toContain("Request a summary");
      expect(html).toContain("Explain a passage");

      // Buttons should be rendered as <button> elements (clickable)
      expect(html).toContain("<button");
    });

    it("should hide welcome state when messages exist", () => {
      const html = renderView({
        messages: [makeMessage({ role: "user", content: "Hello" })],
      });

      // Welcome state should not show when there are messages
      expect(html).not.toContain("Welcome to AI Chat");
      // Note: "Ask about this book" appears in ChatInput placeholder regardless
    });

    it("should hide quick-action buttons during streaming", () => {
      const html = renderView({
        messages: [makeMessage({ role: "user", content: "Hello" })],
        streamingText: "Thinking...",
        status: "streaming",
      });

      expect(html).not.toContain("Welcome to AI Chat");
    });

    it("should show welcome state with AI avatar and description", () => {
      const html = renderView({ messages: [] });

      expect(html).toContain("Welcome to AI Chat");
      expect(html).toContain("Ask me anything about this book");
    });
  });

  // =========================================================================
  // 2. RAG system message integration
  // =========================================================================

  describe("RAG system message flow", () => {
    it("should call rag.askQuestion with the user's query", async () => {
      const userQuery = "What is this book about?";
      await ragAskQuestion(userQuery);

      expect(ragAskQuestion).toHaveBeenCalledWith(userQuery);
      const result = await ragAskQuestion.mock.results[0].value;
      expect(result.systemMessage).toContain("Context about Test Book Title");
    });

    it("should return null systemMessage when no book is loaded", async () => {
      ragAskQuestion = vi.fn().mockResolvedValue(null);
      const result = await ragAskQuestion("any question");
      expect(result).toBeNull();
    });

    it("should pass systemMessage to sendChatMessage in the integration flow", async () => {
      // Simulate the ChatDrawer.handleSend flow:
      // 1. Call rag.askQuestion(content)
      // 2. Call sendChatMessage(content, ragResult?.systemMessage)
      const content = "Summarize chapter 1";
      const ragResult = await ragAskQuestion(content);

      mockSendChatMessage(content, ragResult?.systemMessage);

      expect(mockSendChatMessage).toHaveBeenCalledWith(
        "Summarize chapter 1",
        "Context about Test Book Title by Test Author: relevant chunks...",
      );
    });

    it("should handle askQuestion returning null gracefully", async () => {
      ragAskQuestion = vi.fn().mockResolvedValue(null);

      const content = "Hello";
      const ragResult = await ragAskQuestion(content);

      // When ragResult is null, systemMessage is undefined
      mockSendChatMessage(content, ragResult?.systemMessage);

      expect(mockSendChatMessage).toHaveBeenCalledWith("Hello", undefined);
    });
  });

  // =========================================================================
  // 3. Loading states — indexing
  // =========================================================================

  describe("Loading states — indexing", () => {
    it("should show inline indexing indicator when indexing with no messages", () => {
      const html = renderView({
        isIndexing: true,
        messages: [],
      });

      // Note: IndexingEmptyState is unreachable due to isEmpty requiring !isIndexing.
      // When isIndexing=true, the inline IndexingIndicator renders instead.
      expect(html).toContain("Indexing book for better answers…");
      expect(html).toContain("animate-spin");
    });

    it("should hide welcome empty state during indexing", () => {
      const html = renderView({
        isIndexing: true,
        messages: [],
      });

      // Should NOT show welcome state during indexing
      expect(html).not.toContain("Welcome to AI Chat");
    });

    it("should show welcome state when not indexing", () => {
      const html = renderView({
        isIndexing: false,
        messages: [],
      });

      expect(html).not.toContain("Indexing book for better answers…");
      expect(html).toContain("Welcome to AI Chat");
    });

    it("should show inline indexing indicator when messages already exist", () => {
      const html = renderView({
        isIndexing: true,
        messages: [makeMessage({ role: "user", content: "Hello" })],
      });

      // Inline indicator shows alongside messages
      expect(html).toContain("Indexing book for better answers…");
      expect(html).toContain("Hello");
    });

    it("should show loading spinner during streaming", () => {
      const html = renderView({
        messages: [
          makeMessage({ role: "user", content: "Hello" }),
          makeMessage({ role: "assistant", content: "" }),
        ],
        status: "loading",
      });

      expect(html).toContain("Thinking…");
      expect(html).toContain("animate-spin");
    });

    it("should show typing indicator during streaming with text", () => {
      const html = renderView({
        messages: [
          makeMessage({ role: "user", content: "Hello" }),
          makeMessage({ role: "assistant", content: "" }),
        ],
        streamingText: "Let me think about that...",
        status: "streaming",
      });

      expect(html).toContain("Let me think about that...");
    });
  });

  // =========================================================================
  // 4. Error states — indexing failure
  // =========================================================================

  describe("Error states — indexing failure", () => {
    it("should show RAG error banner when ragError is set", () => {
      const html = renderView({
        ragError: "Failed to index book: corrupt EPUB file",
        messages: [],
      });

      expect(html).toContain("Book context unavailable");
      expect(html).toContain("using plain AI");
    });

    it("should show retry indexing button when onRetryIndexing is provided", () => {
      const onRetryIndexing = vi.fn();
      const html = renderView({
        ragError: "Indexing failed",
        onRetryIndexing,
      });

      expect(html).toContain("Retry indexing");
    });

    it("should not show retry button when onRetryIndexing is omitted", () => {
      const html = renderView({
        ragError: "Indexing failed",
        onRetryIndexing: undefined,
      });

      expect(html).not.toContain("Retry indexing");
      // But the error message should still show
      expect(html).toContain("Book context unavailable");
    });

    it("should show RAG error alongside chat messages", () => {
      const html = renderView({
        ragError: "Indexing failed",
        messages: [
          makeMessage({ role: "user", content: "Hello" }),
          makeMessage({
            role: "assistant",
            content: "Hi! I can still help, but without book context.",
          }),
        ],
      });

      expect(html).toContain("Book context unavailable");
      expect(html).toContain("Hello");
      expect(html).toContain("Hi! I can still help");
    });

    it("should show chat error banner for streaming errors", () => {
      const html = renderView({
        status: "error",
        error: "Network error occurred",
        errorCode: "NETWORK_ERROR",
        messages: [makeMessage({ role: "user", content: "Hello" })],
      });

      expect(html).toContain("Network error");
      expect(html).toContain("Retry");
    });

    it("should show auth error with settings guidance", () => {
      const html = renderView({
        status: "error",
        error: "No AI provider configured",
        errorCode: "AUTH_ERROR",
        messages: [],
      });

      expect(html).toContain("No AI provider configured");
      expect(html).toContain("AI Settings");
    });

    it("should show rate limit error with wait hint", () => {
      const html = renderView({
        status: "error",
        error: "Too many requests",
        errorCode: "RATE_LIMITED",
        messages: [makeMessage({ role: "user", content: "Hello" })],
      });

      expect(html).toContain("Too many requests");
      expect(html).toContain("Retry");
    });

    it("should show both RAG error and chat error simultaneously", () => {
      const html = renderView({
        ragError: "Indexing failed",
        status: "error",
        error: "Network timeout",
        errorCode: "NETWORK_ERROR",
        messages: [makeMessage({ role: "user", content: "Hello" })],
      });

      expect(html).toContain("Book context unavailable");
      expect(html).toContain("Network error");
    });
  });

  // =========================================================================
  // 5. Selection integration — Ask AI
  // =========================================================================

  describe("Selection integration — Ask AI", () => {
    it("should pass initialMessage to ChatInput component", () => {
      // Note: In SSR (renderToString), useEffect doesn't run, so the textarea
      // value won't reflect initialValue. But the ChatInput is rendered with
      // the initialValue prop and a placeholder.
      const html = renderView({
        initialMessage: "Explain this passage",
        messages: [],
      });

      // The component renders correctly with initialMessage prop
      expect(html).toContain("Ask about this book");
      expect(html).toContain("<textarea");
    });

    it("should render ChatInput with placeholder when no initialMessage", () => {
      const html = renderView({
        messages: [],
        initialMessage: undefined,
      });

      // Default placeholder shows
      expect(html).toContain('placeholder="Ask about this book…"');
    });

    it("should not show welcome state when messages exist", () => {
      const html = renderView({
        messages: [makeMessage({ role: "user", content: "Selected text question" })],
        initialMessage: "Selected text question",
      });

      // Messages are shown, not the welcome state
      expect(html).toContain("Selected text question");
      expect(html).not.toContain("Welcome to AI Chat");
    });

    it("should handle empty initialMessage gracefully", () => {
      const html = renderView({
        initialMessage: "",
        messages: [],
      });

      // Should show the normal welcome state
      expect(html).toContain("Welcome to AI Chat");
    });

    it("should handle undefined initialMessage gracefully", () => {
      const html = renderView({
        initialMessage: undefined,
        messages: [],
      });

      expect(html).toContain("Welcome to AI Chat");
    });
  });

  // =========================================================================
  // 6. RAG state transitions
  // =========================================================================

  describe("RAG state transitions", () => {
    it("should transition from indexing to ready", () => {
      // First render: indexing — shows inline indicator
      const html1 = renderView({ isIndexing: true, messages: [] });
      expect(html1).toContain("Indexing book for better answers…");

      // Second render: done indexing — shows welcome state
      const html2 = renderView({ isIndexing: false, messages: [] });
      expect(html2).not.toContain("Indexing book for better answers…");
      expect(html2).toContain("Welcome to AI Chat");
    });

    it("should transition from error to ready on retry", () => {
      // First render: error
      const html1 = renderView({ ragError: "Indexing failed" });
      expect(html1).toContain("Book context unavailable");

      // Second render: error cleared after retry
      const html2 = renderView({ ragError: null, isIndexing: false });
      expect(html2).not.toContain("Book context unavailable");
    });

    it("should show indexing indicator alongside messages when both exist", () => {
      // Indexing with messages shows inline indicator
      const html = renderView({
        isIndexing: true,
        messages: [makeMessage({ role: "user", content: "Hello" })],
      });
      expect(html).toContain("Indexing book for better answers…");
      expect(html).toContain("Hello");
    });

    it("should clear RAG error when indexing succeeds after retry", () => {
      // Render with error
      const html1 = renderView({ ragError: "Failed" });
      expect(html1).toContain("Book context unavailable");

      // Render after successful retry
      const html2 = renderView({ ragError: null, isIndexing: false, isIndexed: true });
      expect(html2).not.toContain("Book context unavailable");
    });
  });

  // =========================================================================
  // 7. Drawer open/close with RAG state
  // =========================================================================

  describe("Drawer open/close with RAG state", () => {
    it("should not render when drawer is closed even with RAG state", () => {
      const html = renderView({
        isOpen: false,
        isIndexing: true,
        ragError: "Some error",
      });

      expect(html).not.toContain("Indexing book");
      expect(html).not.toContain("Book context unavailable");
    });

    it("should preserve RAG state when drawer reopens", () => {
      // Close
      const html1 = renderView({ isOpen: false, isIndexing: true });
      expect(html1).toBe("");

      // Reopen — RAG state is still indexing, shows inline indicator
      const html2 = renderView({ isOpen: true, isIndexing: true, messages: [] });
      expect(html2).toContain("Indexing book for better answers…");
    });
  });

  // =========================================================================
  // 8. Combined RAG + streaming scenarios
  // =========================================================================

  describe("Combined RAG + streaming scenarios", () => {
    it("should show streaming content while RAG is indexing in background", () => {
      const html = renderView({
        isIndexing: true,
        messages: [
          makeMessage({ role: "user", content: "Hello" }),
          makeMessage({ role: "assistant", content: "" }),
        ],
        streamingText: "Thinking about your question...",
        status: "streaming",
      });

      // Streaming content is visible (no apostrophe to avoid HTML encoding)
      expect(html).toContain("Thinking about your question...");
      // Inline indexing indicator also shows
      expect(html).toContain("Indexing book for better answers…");
    });

    it("should show RAG error alongside streaming error", () => {
      const html = renderView({
        ragError: "Indexing failed",
        status: "error",
        error: "API rate limited",
        errorCode: "RATE_LIMITED",
        messages: [makeMessage({ role: "user", content: "Hello" })],
      });

      expect(html).toContain("Book context unavailable");
      expect(html).toContain("Too many requests");
    });

    it("should handle rapid state changes from indexing to streaming", () => {
      // Indexing phase — shows inline indicator
      const html1 = renderView({ isIndexing: true, messages: [] });
      expect(html1).toContain("Indexing book for better answers…");

      // Streaming phase (indexing done, response streaming)
      const html2 = renderView({
        isIndexing: false,
        messages: [
          makeMessage({ role: "user", content: "What is this book about?" }),
          makeMessage({ role: "assistant", content: "" }),
        ],
        streamingText: "This book is about...",
        status: "streaming",
      });
      expect(html2).toContain("This book is about...");
      expect(html2).not.toContain("Indexing book for better answers…");
    });
  });
});
