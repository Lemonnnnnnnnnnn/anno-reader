/**
 * Tests for ChatDrawer.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import { ChatDrawerView, ChatDrawer, SessionList } from "..";
import { SessionItem } from "../SessionItem";
import type { ChatMessage, ChatConversation } from "@/lib/chat/types";

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
const mockSetCurrentConversation = vi.fn();
const mockRenameConversation = vi.fn();
const mockDeleteConversation = vi.fn();
const mockReset = vi.fn();

let mockStoreState = {
  messages: [] as ChatMessage[],
  addMessage: mockAddMessage,
  loadConversations: mockLoadConversations,
  isLoaded: true,
  currentConversationId: null as string | null,
  createConversation: mockCreateConversation,
  setCurrentConversation: mockSetCurrentConversation,
  renameConversation: mockRenameConversation,
  deleteConversation: mockDeleteConversation,
  conversations: [] as ChatConversation[],
};

vi.mock("@/stores/useChatStore", () => ({
  useChatStore: Object.assign(
    (selector?: (state: typeof mockStoreState) => unknown) =>
      selector ? selector(mockStoreState) : mockStoreState,
    {
      getState: () => mockStoreState,
    },
  ),
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
    reset: mockReset,
  }),
}));

vi.mock("@/stores/useBookStore", () => ({
  useBookStore: (selector?: (state: { currentBook: { id: string } | null }) => unknown) => {
    const state = { currentBook: { id: "test-book" } };
    return selector ? selector(state) : state;
  },
}));

// ---------------------------------------------------------------------------
// View defaults
// ---------------------------------------------------------------------------

const viewDefaults = {
  isOpen: true,
  onClose: vi.fn(),
  view: "conversation" as const,
  bookId: "test-book",
  messages: [],
  streamingText: "",
  status: "idle" as const,
  error: null,
  errorCode: null,
  onSend: vi.fn(),
  onStop: vi.fn(),
  onRetry: vi.fn(),
  onBackToList: vi.fn(),
  onNewChat: vi.fn(),
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
    // Default to an active conversation so the stateful drawer renders
    // conversation view (welcome state + input) rather than the list view.
    mockStoreState.currentConversationId = "active-conv";
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

// ---------------------------------------------------------------------------
// List view toggle tests
// ---------------------------------------------------------------------------

describe("List view toggle", () => {
  it("renders SessionList when view is 'list'", () => {
    const html = renderToString(
      <ChatDrawerView
        {...viewDefaults}
        view="list"
        bookId="test-book"
      />,
    );

    expect(html).toContain("New Chat");
  });

  it("does not render SessionList when view is 'conversation'", () => {
    const html = renderToString(
      <ChatDrawerView
        {...viewDefaults}
        view="conversation"
        bookId="test-book"
      />,
    );

    expect(html).not.toContain("New Chat");
  });

  it("renders 'Back to conversations' button in conversation view", () => {
    const html = renderToString(
      <ChatDrawerView
        {...viewDefaults}
        view="conversation"
      />,
    );

    expect(html).toContain("Back to conversations");
  });

  it("does not render 'Back to conversations' in list view", () => {
    const html = renderToString(
      <ChatDrawerView
        {...viewDefaults}
        view="list"
        bookId="test-book"
      />,
    );

    expect(html).not.toContain("Back to conversations");
  });
});

// ---------------------------------------------------------------------------
// SessionList tests
// ---------------------------------------------------------------------------

describe("SessionList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'New Chat' button", () => {
    const html = renderToString(
      <SessionList bookId="book-1" onNewChat={vi.fn()} />,
    );

    expect(html).toContain("New Chat");
  });

  it("shows empty state when no conversations exist", () => {
    mockStoreState.conversations = [];

    const html = renderToString(
      <SessionList bookId="book-1" onNewChat={vi.fn()} />,
    );

    expect(html).toContain("No conversations yet");
  });

  it("renders conversation titles for matching bookId", () => {
    mockStoreState.conversations = [
      {
        id: "c1",
        title: "Chapter 1 Notes",
        bookId: "book-1",
        messages: [],
        createdAt: 1000,
        updatedAt: 2000,
      },
      {
        id: "c2",
        title: "Plot Discussion",
        bookId: "book-1",
        messages: [],
        createdAt: 3000,
        updatedAt: 4000,
      },
    ];

    const html = renderToString(
      <SessionList bookId="book-1" onNewChat={vi.fn()} />,
    );

    expect(html).toContain("Chapter 1 Notes");
    expect(html).toContain("Plot Discussion");
  });

  it("filters conversations by bookId", () => {
    mockStoreState.conversations = [
      {
        id: "c1",
        title: "Book 1 Chat",
        bookId: "book-1",
        messages: [],
        createdAt: 1000,
        updatedAt: 2000,
      },
      {
        id: "c2",
        title: "Book 2 Chat",
        bookId: "book-2",
        messages: [],
        createdAt: 3000,
        updatedAt: 4000,
      },
    ];

    const html = renderToString(
      <SessionList bookId="book-1" onNewChat={vi.fn()} />,
    );

    expect(html).toContain("Book 1 Chat");
    expect(html).not.toContain("Book 2 Chat");
  });

  it("renders no empty state when conversations exist for bookId", () => {
    mockStoreState.conversations = [
      {
        id: "c1",
        title: "Existing Chat",
        bookId: "book-1",
        messages: [],
        createdAt: 1000,
        updatedAt: 2000,
      },
    ];

    const html = renderToString(
      <SessionList bookId="book-1" onNewChat={vi.fn()} />,
    );

    expect(html).not.toContain("No conversations yet");
  });
});

// ---------------------------------------------------------------------------
// SessionItem tests
// ---------------------------------------------------------------------------

describe("SessionItem", () => {
  it("renders the title", () => {
    const html = renderToString(
      <SessionItem
        title="My Discussion"
        updatedAt={Date.now()}
        isActive={false}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onClick={vi.fn()}
      />,
    );

    expect(html).toContain("My Discussion");
  });

  it("renders rename button with aria-label", () => {
    const html = renderToString(
      <SessionItem
        title="Chat Title"
        updatedAt={Date.now()}
        isActive={false}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onClick={vi.fn()}
      />,
    );

    expect(html).toContain('aria-label="Rename conversation"');
  });

  it("renders delete button with aria-label", () => {
    const html = renderToString(
      <SessionItem
        title="Chat Title"
        updatedAt={Date.now()}
        isActive={false}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onClick={vi.fn()}
      />,
    );

    expect(html).toContain('aria-label="Delete conversation"');
  });

  it("applies active styling when isActive is true", () => {
    const html = renderToString(
      <SessionItem
        title="Active Chat"
        updatedAt={Date.now()}
        isActive={true}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onClick={vi.fn()}
      />,
    );

    expect(html).toContain("bg-accent/10");
  });

  it("does not apply active styling when isActive is false", () => {
    const html = renderToString(
      <SessionItem
        title="Inactive Chat"
        updatedAt={Date.now()}
        isActive={false}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onClick={vi.fn()}
      />,
    );

    expect(html).not.toContain("bg-accent/10");
  });

  it("renders a timestamp", () => {
    const html = renderToString(
      <SessionItem
        title="Chat"
        updatedAt={Date.now()}
        isActive={false}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onClick={vi.fn()}
      />,
    );

    // Today's timestamp should render as a time string (contains :)
    expect(html).toMatch(/\d{1,2}:\d{2}/);
  });
});
