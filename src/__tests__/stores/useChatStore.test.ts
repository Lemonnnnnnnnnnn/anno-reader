/**
 * Tests for chat store's per-book conversation cleanup.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatConversation } from "@/lib/chat/types";

// Mock chat persistence module
vi.mock("@/lib/chat/persistence", () => ({
  loadConversations: vi.fn(),
  saveConversations: vi.fn(),
}));

const { useChatStore } = await import("@/stores/useChatStore");
const { saveConversations } = await import("@/lib/chat/persistence");

function makeConversation(
  id: string,
  bookId: string,
  messages: { id: string }[] = [],
): ChatConversation {
  const now = Date.now();
  return {
    id,
    title: `Conversation ${id}`,
    bookId,
    messages: messages as ChatConversation["messages"],
    createdAt: now,
    updatedAt: now,
  };
}

describe("useChatStore.deleteConversationsByBook", () => {
  const conversations = [
    makeConversation("conv-1", "book-a"),
    makeConversation("conv-2", "book-b"),
    makeConversation("conv-3", "book-a"),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      conversations: [...conversations],
      currentConversationId: null,
      messages: [],
      isLoaded: true,
    });
  });

  it("removes only conversations of the given book", () => {
    useChatStore.getState().deleteConversationsByBook("book-a");

    const state = useChatStore.getState();
    expect(state.conversations.map((c) => c.id)).toEqual(["conv-2"]);
    expect(state.currentConversationId).toBeNull();
  });

  it("persists the filtered conversations", async () => {
    useChatStore.getState().deleteConversationsByBook("book-a");

    // persistAfterSet is fire-and-forget; flush the microtask queue
    await Promise.resolve();

    expect(saveConversations).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "conv-2" })])
    );
    expect(saveConversations).toHaveBeenCalledTimes(1);
  });

  it("selects the first remaining conversation when the active one is removed", () => {
    useChatStore.setState({
      currentConversationId: "conv-1",
      messages: conversations[0].messages,
    });

    useChatStore.getState().deleteConversationsByBook("book-a");

    const state = useChatStore.getState();
    expect(state.currentConversationId).toBe("conv-2");
    expect(state.messages).toEqual(conversations[1].messages);
  });

  it("does nothing when no conversation matches the book", () => {
    useChatStore.getState().deleteConversationsByBook("book-unknown");

    const state = useChatStore.getState();
    expect(state.conversations).toHaveLength(3);
    expect(saveConversations).not.toHaveBeenCalled();
  });
});
