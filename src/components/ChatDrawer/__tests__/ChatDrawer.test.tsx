/**
 * Tests for ChatDrawer.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import { ChatDrawerView, ChatDrawer } from "..";
import type { ChatMessage } from "@/lib/chat/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMessage(
  overrides: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    content: "Hello",
    createdAt: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockStopStreaming = vi.fn();
const mockSendChatMessage = vi.fn();
const mockLoadConversations = vi.fn();
const mockCreateConversation = vi.fn();
const mockAddMessage = vi.fn();

vi.mock("@/stores/useChatStore", () => ({
  useChatStore: () => ({
    messages: [],
    addMessage: mockAddMessage,
    loadConversations: mockLoadConversations,
    isLoaded: true,
    currentConversationId: null,
    createConversation: mockCreateConversation,
    conversations: [],
  }),
}));

vi.mock("@/lib/chat/streaming", () => ({
  useChatStreaming: () => ({
    messages: [],
    streamingText: "",
    status: "idle",
    error: null,
    errorCode: null,
    sendChatMessage: mockSendChatMessage,
    stopStreaming: mockStopStreaming,
    clearMessages: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// View defaults
// ---------------------------------------------------------------------------

const viewDefaults = {
  isOpen: true,
  onClose: vi.fn(),
  messages: [],
  streamingText: "",
  status: "idle" as const,
  error: null,
  errorCode: null,
  onSend: vi.fn(),
  onStop: vi.fn(),
  onRetry: vi.fn(),
};

// ---------------------------------------------------------------------------
// ChatDrawerView tests
// ---------------------------------------------------------------------------

describe("ChatDrawerView", () => {
  it("renders with the drawer title 'AI Chat'", () => {
    const html = renderToString(<ChatDrawerView {...viewDefaults} />);

    expect(html).toContain("AI Chat");
  });

  it("renders the welcome empty state when no messages", () => {
    const html = renderToString(
      <ChatDrawerView {...viewDefaults} messages={[]} />,
    );

    expect(html).toContain("Welcome to AI Chat");
    expect(html).toContain("Ask me anything about this book");
  });

  it("shows usage tips in empty state", () => {
    const html = renderToString(
      <ChatDrawerView {...viewDefaults} messages={[]} />,
    );

    expect(html).toContain("Ask about this book");
    expect(html).toContain("Request a summary");
    expect(html).toContain("Explain a passage");
  });

  it("renders user messages", () => {
    const messages = [makeMessage({ role: "user", content: "Hello AI" })];
    const html = renderToString(
      <ChatDrawerView {...viewDefaults} messages={messages} />,
    );

    expect(html).toContain("Hello AI");
  });

  it("renders assistant messages", () => {
    const messages = [
      makeMessage({ role: "assistant", content: "Hi there!" }),
    ];
    const html = renderToString(
      <ChatDrawerView {...viewDefaults} messages={messages} />,
    );

    expect(html).toContain("Hi there!");
  });

  it("shows loading indicator when status is loading", () => {
    const html = renderToString(
      <ChatDrawerView {...viewDefaults} status="loading" />,
    );

    expect(html).toContain("animate-spin");
    expect(html).toContain("Thinking…");
  });

  it("does not show loading indicator when status is idle", () => {
    const html = renderToString(
      <ChatDrawerView {...viewDefaults} status="idle" />,
    );

    expect(html).not.toContain("Thinking…");
  });

  it("shows error banner when status is error", () => {
    const html = renderToString(
      <ChatDrawerView
        {...viewDefaults}
        status="error"
        error="Network error"
      />,
    );

    expect(html).toContain("Network error");
  });

  it("does not show error banner when status is idle", () => {
    const html = renderToString(
      <ChatDrawerView
        {...viewDefaults}
        status="idle"
        error="Should not show"
      />,
    );

    expect(html).not.toContain("Should not show");
  });

  it("renders close button via Drawer", () => {
    const html = renderToString(<ChatDrawerView {...viewDefaults} />);

    expect(html).toContain('aria-label="Close drawer"');
  });

  it("shows streaming text for the last message during streaming", () => {
    const messages = [
      makeMessage({ id: "u1", role: "user", content: "Hi" }),
      makeMessage({ id: "a1", role: "assistant", content: "" }),
    ];
    const html = renderToString(
      <ChatDrawerView
        {...viewDefaults}
        messages={messages}
        status="streaming"
        streamingText="Hello from AI"
      />,
    );

    expect(html).toContain("Hello from AI");
  });

  it("does not show welcome state when messages exist", () => {
    const messages = [makeMessage({ content: "Test" })];
    const html = renderToString(
      <ChatDrawerView {...viewDefaults} messages={messages} />,
    );

    expect(html).not.toContain("Welcome to AI Chat");
  });

  it("shows typing indicator during streaming", () => {
    const messages = [
      makeMessage({ id: "u1", role: "user", content: "Hi" }),
      makeMessage({ id: "a1", role: "assistant", content: "" }),
    ];
    const html = renderToString(
      <ChatDrawerView
        {...viewDefaults}
        messages={messages}
        status="streaming"
        streamingText="Hello"
      />,
    );

    expect(html).toContain("animate-bounce");
  });

  it("does not show typing indicator when idle", () => {
    const html = renderToString(
      <ChatDrawerView {...viewDefaults} status="idle" />,
    );

    expect(html).not.toContain("animate-bounce");
  });

  it("disables input during streaming", () => {
    const html = renderToString(
      <ChatDrawerView {...viewDefaults} status="streaming" streamingText="Hi" />,
    );

    expect(html).toContain("disabled");
  });

  // -----------------------------------------------------------------------
  // Error handling tests
  // -----------------------------------------------------------------------

  it("shows config guidance for AUTH_ERROR (no API key)", () => {
    const html = renderToString(
      <ChatDrawerView
        {...viewDefaults}
        status="error"
        error="No AI provider configured"
        errorCode="AUTH_ERROR"
      />,
    );

    expect(html).toContain("No AI provider configured");
    expect(html).toContain("AI Settings");
  });

  it("shows retry button for NETWORK_ERROR", () => {
    const html = renderToString(
      <ChatDrawerView
        {...viewDefaults}
        status="error"
        error="Network error"
        errorCode="NETWORK_ERROR"
      />,
    );

    expect(html).toContain("Network error");
    expect(html).toContain("Retry");
  });

  it("shows wait message for RATE_LIMITED", () => {
    const html = renderToString(
      <ChatDrawerView
        {...viewDefaults}
        status="error"
        error="Rate limited"
        errorCode="RATE_LIMITED"
      />,
    );

    expect(html).toContain("Too many requests");
    expect(html).toContain("Retry");
  });

  it("shows retry button for generic errors", () => {
    const html = renderToString(
      <ChatDrawerView
        {...viewDefaults}
        status="error"
        error="Something went wrong"
        errorCode={null}
      />,
    );

    expect(html).toContain("Something went wrong");
    expect(html).toContain("Retry");
  });

  it("does not show error banner when error is null even if status is error", () => {
    const html = renderToString(
      <ChatDrawerView
        {...viewDefaults}
        status="error"
        error={null}
        errorCode="NETWORK_ERROR"
      />,
    );

    expect(html).not.toContain("Retry");
  });
});

// ---------------------------------------------------------------------------
// ChatDrawer (stateful) tests
// ---------------------------------------------------------------------------

describe("ChatDrawer (stateful)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the drawer with title", () => {
    const html = renderToString(
      <ChatDrawer isOpen={true} onClose={vi.fn()} />,
    );

    expect(html).toContain("AI Chat");
  });

  it("renders welcome empty state on initial mount", () => {
    const html = renderToString(
      <ChatDrawer isOpen={true} onClose={vi.fn()} />,
    );

    expect(html).toContain("Welcome to AI Chat");
  });

  it("renders close button", () => {
    const html = renderToString(
      <ChatDrawer isOpen={true} onClose={vi.fn()} />,
    );

    expect(html).toContain('aria-label="Close drawer"');
  });

  it("renders the input area", () => {
    const html = renderToString(
      <ChatDrawer isOpen={true} onClose={vi.fn()} />,
    );

    expect(html).toContain("Ask about this book…");
  });
});
