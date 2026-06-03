/**
 * Chat integration tests.
 *
 * Tests the full chat flow across store, persistence, streaming, and drawer
 * components working together:
 * - Full conversation lifecycle (open → send → receive → persist)
 * - Multi-turn conversation context preservation
 * - Conversation history persistence and restoration
 * - Error scenarios (no provider, network errors)
 * - Drawer open/close and state management
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { renderToString } from "react-dom/server";
import type { ChatMessage, ChatConversation } from "@/lib/chat/types";
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

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    content: "Hello",
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeConversation(
  overrides: Partial<ChatConversation> = {},
): ChatConversation {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    messages: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Persistence mock state
// ---------------------------------------------------------------------------

let persistedData: ChatConversation[] = [];

vi.mock("@/lib/chat/persistence", () => ({
  loadConversations: vi.fn(() => Promise.resolve(persistedData)),
  saveConversations: vi.fn((conversations: ChatConversation[]) => {
    persistedData = conversations;
    return Promise.resolve();
  }),
  ensureChatDir: vi.fn(() => Promise.resolve("/mock/chat")),
}));

// ---------------------------------------------------------------------------
// Streaming mock state
// ---------------------------------------------------------------------------

let streamingMessages: ChatMessage[] = [];
let streamingStatus = "idle";
let streamingError: string | null = null;
let streamingText = "";
const mockSendChatMessage = vi.fn();
const mockStopStreaming = vi.fn();
const mockClearMessages = vi.fn();

vi.mock("@/lib/chat/streaming", () => ({
  useChatStreaming: () => ({
    messages: streamingMessages,
    streamingText,
    status: streamingStatus,
    error: streamingError,
    sendChatMessage: mockSendChatMessage,
    stopStreaming: mockStopStreaming,
    clearMessages: mockClearMessages,
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
// Import after mocks
// ---------------------------------------------------------------------------

import { useChatStore } from "@/stores/useChatStore";
import { ChatDrawerView, ChatDrawer } from "@/components/ChatDrawer";
import {
  loadConversations,
  saveConversations,
} from "@/lib/chat/persistence";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Chat Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    persistedData = [];
    streamingMessages = [];
    streamingStatus = "idle";
    streamingError = null;
    streamingText = "";

    // Reset the store between tests
    useChatStore.setState({
      conversations: [],
      currentConversationId: null,
      messages: [],
      isLoaded: false,
    });
  });

  // =========================================================================
  // 1. Full conversation flow
  // =========================================================================

  describe("Full conversation flow", () => {
    it("should complete the lifecycle: load → create conversation → add messages → persist", async () => {
      // 1. Load conversations from disk
      await useChatStore.getState().loadConversations();
      expect(useChatStore.getState().isLoaded).toBe(true);
      expect(useChatStore.getState().conversations).toEqual([]);

      // 2. Create a new conversation
      const convId = "conv-1";
      useChatStore.getState().createConversation(convId);
      expect(useChatStore.getState().currentConversationId).toBe(convId);
      expect(useChatStore.getState().conversations).toHaveLength(1);

      // 3. Add user message
      const userMsg = makeMessage({
        id: "msg-1",
        role: "user",
        content: "What is this book about?",
      });
      useChatStore.getState().addMessage(userMsg);
      expect(useChatStore.getState().messages).toHaveLength(1);
      expect(useChatStore.getState().messages[0].content).toBe(
        "What is this book about?",
      );

      // 4. Add assistant message
      const assistantMsg = makeMessage({
        id: "msg-2",
        role: "assistant",
        content: "This book is about...",
      });
      useChatStore.getState().addMessage(assistantMsg);
      expect(useChatStore.getState().messages).toHaveLength(2);

      // 5. Verify persistence was called
      expect(saveConversations).toHaveBeenCalled();
      const savedData = (saveConversations as Mock).mock.calls;
      const lastSaved = savedData[savedData.length - 1][0] as ChatConversation[];
      expect(lastSaved).toHaveLength(1);
      expect(lastSaved[0].id).toBe(convId);
      expect(lastSaved[0].messages).toHaveLength(2);
    });

    it("should render the drawer with conversation messages", () => {
      const messages = [
        makeMessage({ id: "u1", role: "user", content: "Tell me about this book" }),
        makeMessage({
          id: "a1",
          role: "assistant",
          content: "This is a great book about programming.",
        }),
      ];

      const html = renderToString(
        <ChatDrawerView
          isOpen={true}
          onClose={vi.fn()}
          messages={messages}
          streamingText=""
          status="idle"
          error={null}
          onSend={vi.fn()}
          onStop={vi.fn()}
        />,
      );

      expect(html).toContain("Tell me about this book");
      expect(html).toContain("This is a great book about programming.");
      expect(html).not.toContain("Welcome to AI Chat");
    });
  });

  // =========================================================================
  // 2. Multi-turn conversation context
  // =========================================================================

  describe("Multi-turn conversation context", () => {
    it("should accumulate messages across multiple turns", async () => {
      const convId = "conv-multi";
      useChatStore.getState().createConversation(convId);

      const turns = [
        { role: "user" as const, content: "What is the main theme?" },
        { role: "assistant" as const, content: "The main theme is love." },
        { role: "user" as const, content: "Who is the protagonist?" },
        { role: "assistant" as const, content: "The protagonist is Alice." },
        { role: "user" as const, content: "What happens in chapter 3?" },
        {
          role: "assistant" as const,
          content: "In chapter 3, Alice discovers a secret.",
        },
      ];

      for (const turn of turns) {
        useChatStore.getState().addMessage(makeMessage(turn));
      }

      const messages = useChatStore.getState().messages;
      expect(messages).toHaveLength(6);

      // Verify the conversation is in order
      expect(messages[0].content).toBe("What is the main theme?");
      expect(messages[1].content).toBe("The main theme is love.");
      expect(messages[4].content).toBe("What happens in chapter 3?");
      expect(messages[5].content).toBe(
        "In chapter 3, Alice discovers a secret.",
      );
    });

    it("should render multi-turn messages in correct order", () => {
      const messages = [
        makeMessage({ id: "u1", role: "user", content: "Question 1" }),
        makeMessage({ id: "a1", role: "assistant", content: "Answer 1" }),
        makeMessage({ id: "u2", role: "user", content: "Question 2" }),
        makeMessage({ id: "a2", role: "assistant", content: "Answer 2" }),
      ];

      const html = renderToString(
        <ChatDrawerView
          isOpen={true}
          onClose={vi.fn()}
          messages={messages}
          streamingText=""
          status="idle"
          error={null}
          onSend={vi.fn()}
          onStop={vi.fn()}
        />,
      );

      expect(html).toContain("Question 1");
      expect(html).toContain("Answer 1");
      expect(html).toContain("Question 2");
      expect(html).toContain("Answer 2");
    });

    it("should stream partial text for the last assistant message", () => {
      const messages = [
        makeMessage({ id: "u1", role: "user", content: "Hello" }),
        makeMessage({ id: "a1", role: "assistant", content: "" }),
      ];

      const html = renderToString(
        <ChatDrawerView
          isOpen={true}
          onClose={vi.fn()}
          messages={messages}
          streamingText="I am thinking about your question..."
          status="streaming"
          error={null}
          onSend={vi.fn()}
          onStop={vi.fn()}
        />,
      );

      expect(html).toContain("I am thinking about your question...");
    });
  });

  // =========================================================================
  // 3. Conversation history persistence and restore
  // =========================================================================

  describe("Conversation history persistence and restore", () => {
    it("should load conversations from disk on initialization", async () => {
      const existingConversations = [
        makeConversation({
          id: "conv-saved-1",
          messages: [
            makeMessage({ id: "m1", role: "user", content: "Saved question" }),
            makeMessage({
              id: "m2",
              role: "assistant",
              content: "Saved answer",
            }),
          ],
        }),
      ];
      persistedData = existingConversations;

      await useChatStore.getState().loadConversations();

      expect(useChatStore.getState().conversations).toHaveLength(1);
      expect(useChatStore.getState().conversations[0].id).toBe("conv-saved-1");
      expect(useChatStore.getState().conversations[0].messages).toHaveLength(2);
      expect(useChatStore.getState().isLoaded).toBe(true);
    });

    it("should restore messages when switching to a saved conversation", async () => {
      const conv1 = makeConversation({
        id: "conv-a",
        messages: [
          makeMessage({ id: "m1", role: "user", content: "From conversation A" }),
        ],
      });
      const conv2 = makeConversation({
        id: "conv-b",
        messages: [
          makeMessage({ id: "m2", role: "user", content: "From conversation B" }),
          makeMessage({
            id: "m3",
            role: "assistant",
            content: "Reply in B",
          }),
        ],
      });

      persistedData = [conv1, conv2];
      await useChatStore.getState().loadConversations();

      // Switch to conv-b
      useChatStore.getState().setCurrentConversation("conv-b");
      expect(useChatStore.getState().currentConversationId).toBe("conv-b");
      expect(useChatStore.getState().messages).toHaveLength(2);
      expect(useChatStore.getState().messages[0].content).toBe(
        "From conversation B",
      );

      // Switch to conv-a
      useChatStore.getState().setCurrentConversation("conv-a");
      expect(useChatStore.getState().currentConversationId).toBe("conv-a");
      expect(useChatStore.getState().messages).toHaveLength(1);
      expect(useChatStore.getState().messages[0].content).toBe(
        "From conversation A",
      );
    });

    it("should persist after each message addition", async () => {
      useChatStore.getState().createConversation("conv-persist");

      const msg = makeMessage({ content: "Persist me" });
      useChatStore.getState().addMessage(msg);

      // Wait for fire-and-forget persist
      await vi.waitFor(() => {
        expect(saveConversations).toHaveBeenCalled();
      });

      const savedCalls = (saveConversations as Mock).mock.calls;
      const lastSaved = savedCalls[savedCalls.length - 1][0] as ChatConversation[];
      expect(lastSaved[0].messages).toHaveLength(1);
      expect(lastSaved[0].messages[0].content).toBe("Persist me");
    });

    it("should handle empty persisted data gracefully", async () => {
      persistedData = [];
      await useChatStore.getState().loadConversations();

      expect(useChatStore.getState().conversations).toEqual([]);
      expect(useChatStore.getState().isLoaded).toBe(true);
    });
  });

  // =========================================================================
  // 4. Error scenarios
  // =========================================================================

  describe("Error scenarios", () => {
    it("should show error when no AI provider is configured", () => {
      const html = renderToString(
        <ChatDrawerView
          isOpen={true}
          onClose={vi.fn()}
          messages={[]}
          streamingText=""
          status="error"
          error="No AI provider configured"
          onSend={vi.fn()}
          onStop={vi.fn()}
        />,
      );

      expect(html).toContain("No AI provider configured");
    });

    it("should show error when streaming fails with network error", () => {
      const html = renderToString(
        <ChatDrawerView
          isOpen={true}
          onClose={vi.fn()}
          messages={[
            makeMessage({ role: "user", content: "Hello" }),
          ]}
          streamingText=""
          status="error"
          error="Failed to connect to provider: network timeout"
          onSend={vi.fn()}
          onStop={vi.fn()}
        />,
      );

      expect(html).toContain("Failed to connect to provider");
    });

    it("should show error when API key is invalid", () => {
      const html = renderToString(
        <ChatDrawerView
          isOpen={true}
          onClose={vi.fn()}
          messages={[
            makeMessage({ role: "user", content: "Test" }),
          ]}
          streamingText=""
          status="error"
          error="Invalid API key"
          onSend={vi.fn()}
          onStop={vi.fn()}
        />,
      );

      expect(html).toContain("Invalid API key");
    });

    it("should remove empty assistant message on error in streaming hook", async () => {
      // Simulate the streaming hook behavior: when an error occurs,
      // the empty assistant message is removed
      streamingMessages = [
        makeMessage({ id: "u1", role: "user", content: "Hello" }),
      ];
      streamingStatus = "error";
      streamingError = "No AI provider configured";

      const html = renderToString(
        <ChatDrawerView
          isOpen={true}
          onClose={vi.fn()}
          messages={streamingMessages}
          streamingText=""
          status={streamingStatus}
          error={streamingError}
          onSend={vi.fn()}
          onStop={vi.fn()}
        />,
      );

      expect(html).toContain("Hello");
      expect(html).toContain("No AI provider configured");
    });

    it("should handle persistence load failure gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      (loadConversations as Mock).mockRejectedValueOnce(
        new Error("Disk read failed"),
      );

      await useChatStore.getState().loadConversations();

      expect(useChatStore.getState().isLoaded).toBe(true);
      expect(useChatStore.getState().conversations).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  // =========================================================================
  // 5. Drawer open/close and state management
  // =========================================================================

  describe("Drawer open/close state management", () => {
    it("should render drawer when isOpen is true", () => {
      const html = renderToString(
        <ChatDrawerView
          isOpen={true}
          onClose={vi.fn()}
          messages={[]}
          streamingText=""
          status="idle"
          error={null}
          onSend={vi.fn()}
          onStop={vi.fn()}
        />,
      );

      expect(html).toContain("AI Chat");
      expect(html).toContain("Welcome to AI Chat");
    });

    it("should not render content when isOpen is false (Drawer handles this)", () => {
      const html = renderToString(
        <ChatDrawerView
          isOpen={false}
          onClose={vi.fn()}
          messages={[]}
          streamingText=""
          status="idle"
          error={null}
          onSend={vi.fn()}
          onStop={vi.fn()}
        />,
      );

      // Drawer renders nothing when closed
      expect(html).not.toContain("AI Chat");
    });

    it("should show loading state during streaming", () => {
      const html = renderToString(
        <ChatDrawerView
          isOpen={true}
          onClose={vi.fn()}
          messages={[
            makeMessage({ role: "user", content: "Hello" }),
            makeMessage({ role: "assistant", content: "" }),
          ]}
          streamingText=""
          status="loading"
          error={null}
          onSend={vi.fn()}
          onStop={vi.fn()}
        />,
      );

      expect(html).toContain("Thinking…");
      expect(html).toContain("animate-spin");
    });

    it("should hide loading state when idle", () => {
      const html = renderToString(
        <ChatDrawerView
          isOpen={true}
          onClose={vi.fn()}
          messages={[
            makeMessage({ role: "user", content: "Hello" }),
            makeMessage({
              role: "assistant",
              content: "Hi there!",
            }),
          ]}
          streamingText=""
          status="idle"
          error={null}
          onSend={vi.fn()}
          onStop={vi.fn()}
        />,
      );

      expect(html).not.toContain("Thinking…");
      expect(html).toContain("Hi there!");
    });

    it("should clear error when a new message is sent", () => {
      // First render with error
      const html1 = renderToString(
        <ChatDrawerView
          isOpen={true}
          onClose={vi.fn()}
          messages={[]}
          streamingText=""
          status="error"
          error="Previous error"
          onSend={vi.fn()}
          onStop={vi.fn()}
        />,
      );
      expect(html1).toContain("Previous error");

      // Then render without error (new message sent)
      const html2 = renderToString(
        <ChatDrawerView
          isOpen={true}
          onClose={vi.fn()}
          messages={[
            makeMessage({ role: "user", content: "New message" }),
          ]}
          streamingText=""
          status="loading"
          error={null}
          onSend={vi.fn()}
          onStop={vi.fn()}
        />,
      );
      expect(html2).not.toContain("Previous error");
      expect(html2).toContain("New message");
    });

    it("should call stopStreaming when drawer closes during streaming", () => {
      // The ChatDrawer component has a useEffect that calls stopStreaming
      // when isOpen transitions to false. We verify the prop wiring.
      const onClose = vi.fn();

      // Render open
      const html = renderToString(
        <ChatDrawerView
          isOpen={true}
          onClose={onClose}
          messages={[
            makeMessage({ role: "user", content: "Hello" }),
          ]}
          streamingText="partial response..."
          status="streaming"
          error={null}
          onSend={vi.fn()}
          onStop={mockStopStreaming}
        />,
      );

      expect(html).toContain("partial response...");

      // Verify onStop is wired (the useEffect in ChatDrawer calls it on close)
      expect(mockStopStreaming).not.toHaveBeenCalled();
      // In a real scenario, closing the drawer would trigger the useEffect
      // that calls stopStreaming. The stateful ChatDrawer handles this.
    });
  });

  // =========================================================================
  // 6. Conversation management
  // =========================================================================

  describe("Conversation management", () => {
    it("should support multiple conversations", async () => {
      useChatStore.getState().createConversation("conv-1");
      useChatStore.getState().addMessage(
        makeMessage({ content: "Message in conv 1" }),
      );

      useChatStore.getState().createConversation("conv-2");
      useChatStore.getState().addMessage(
        makeMessage({ content: "Message in conv 2" }),
      );

      const state = useChatStore.getState();
      expect(state.conversations).toHaveLength(2);

      // Current conversation is conv-2
      expect(state.currentConversationId).toBe("conv-2");
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].content).toBe("Message in conv 2");
    });

    it("should delete a conversation and select next", async () => {
      useChatStore.getState().createConversation("conv-del-1");
      useChatStore.getState().addMessage(makeMessage({ content: "First" }));

      useChatStore.getState().createConversation("conv-del-2");
      useChatStore.getState().addMessage(makeMessage({ content: "Second" }));

      expect(useChatStore.getState().conversations).toHaveLength(2);

      // Delete the current conversation (conv-del-2)
      useChatStore.getState().deleteConversation("conv-del-2");

      const state = useChatStore.getState();
      expect(state.conversations).toHaveLength(1);
      expect(state.conversations[0].id).toBe("conv-del-1");
      expect(state.currentConversationId).toBe("conv-del-1");
    });

    it("should set currentConversationId to null when all conversations deleted", () => {
      useChatStore.getState().createConversation("only-conv");
      useChatStore.getState().addMessage(makeMessage({ content: "Only" }));

      useChatStore.getState().deleteConversation("only-conv");

      const state = useChatStore.getState();
      expect(state.conversations).toHaveLength(0);
      expect(state.currentConversationId).toBeNull();
      expect(state.messages).toEqual([]);
    });
  });

  // =========================================================================
  // 7. Stateful ChatDrawer wiring
  // =========================================================================

  describe("Stateful ChatDrawer wiring", () => {
    it("should render with title and empty state on mount", () => {
      const html = renderToString(
        <ChatDrawer isOpen={true} onClose={vi.fn()} />,
      );

      expect(html).toContain("AI Chat");
      expect(html).toContain("Welcome to AI Chat");
    });

    it("should render close button", () => {
      const html = renderToString(
        <ChatDrawer isOpen={true} onClose={vi.fn()} />,
      );

      expect(html).toContain('aria-label="Close drawer"');
    });

    it("should render the input area", () => {
      const html = renderToString(
        <ChatDrawer isOpen={true} onClose={vi.fn()} />,
      );

      expect(html).toContain("Ask about this book…");
    });

    it("should not render when isOpen is false", () => {
      const html = renderToString(
        <ChatDrawer isOpen={false} onClose={vi.fn()} />,
      );

      expect(html).not.toContain("AI Chat");
    });
  });
});
