import { describe, it, expect, beforeEach, vi } from "vitest";
import { useChatStore } from "@/stores/useChatStore";
import type { ChatMessage, ChatConversation } from "@/lib/chat/types";

// ---------------------------------------------------------------------------
// Mocks for chat persistence module
// ---------------------------------------------------------------------------

vi.mock("@/lib/chat/persistence", () => ({
  loadConversations: vi.fn(),
  saveConversations: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockLoadConversations = (await import("@/lib/chat/persistence"))
  .loadConversations as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSaveConversations = (await import("@/lib/chat/persistence"))
  .saveConversations as any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore() {
  useChatStore.setState({
    conversations: [],
    currentConversationId: null,
    messages: [],
    isLoaded: false,
  });
}

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
    id: `conv-${now}`,
    messages: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useChatStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  // -- Default state -------------------------------------------------------

  describe("default state", () => {
    it("has empty conversations", () => {
      expect(useChatStore.getState().conversations).toEqual([]);
    });

    it("has null currentConversationId", () => {
      expect(useChatStore.getState().currentConversationId).toBeNull();
    });

    it("has empty messages", () => {
      expect(useChatStore.getState().messages).toEqual([]);
    });

    it("isLoaded is false", () => {
      expect(useChatStore.getState().isLoaded).toBe(false);
    });
  });

  // -- createConversation ---------------------------------------------------

  describe("createConversation", () => {
    it("creates a conversation with the given id", () => {
      useChatStore.getState().createConversation("conv-1");

      const { conversations } = useChatStore.getState();
      expect(conversations).toHaveLength(1);
      expect(conversations[0].id).toBe("conv-1");
      expect(conversations[0].messages).toEqual([]);
    });

    it("sets the new conversation as current", () => {
      useChatStore.getState().createConversation("conv-1");

      expect(useChatStore.getState().currentConversationId).toBe("conv-1");
      expect(useChatStore.getState().messages).toEqual([]);
    });

    it("appends when a conversation already exists", () => {
      useChatStore.getState().createConversation("conv-1");
      useChatStore.getState().createConversation("conv-2");

      const { conversations } = useChatStore.getState();
      expect(conversations).toHaveLength(2);
      expect(conversations[1].id).toBe("conv-2");
      expect(useChatStore.getState().currentConversationId).toBe("conv-2");
    });

    it("triggers persistence", async () => {
      mockSaveConversations.mockResolvedValue(undefined);

      useChatStore.getState().createConversation("conv-1");

      // persistAfterSet is fire-and-forget; wait a tick
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockSaveConversations).toHaveBeenCalledOnce();
      expect(mockSaveConversations).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: "conv-1" }),
        ]),
      );
    });
  });

  // -- addMessage ----------------------------------------------------------

  describe("addMessage", () => {
    it("adds a message to the current conversation", () => {
      useChatStore.getState().createConversation("conv-1");
      const msg = makeMessage({ id: "msg-1", content: "Hi there" });

      useChatStore.getState().addMessage(msg);

      const { conversations, messages } = useChatStore.getState();
      expect(conversations[0].messages).toHaveLength(1);
      expect(conversations[0].messages[0].id).toBe("msg-1");
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("Hi there");
    });

    it("appends multiple messages in order", () => {
      useChatStore.getState().createConversation("conv-1");
      const msg1 = makeMessage({ id: "msg-1", content: "First" });
      const msg2 = makeMessage({ id: "msg-2", content: "Second" });

      useChatStore.getState().addMessage(msg1);
      useChatStore.getState().addMessage(msg2);

      const { messages } = useChatStore.getState();
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe("First");
      expect(messages[1].content).toBe("Second");
    });

    it("does nothing if no conversation is selected", () => {
      const msg = makeMessage();
      useChatStore.getState().addMessage(msg);

      expect(useChatStore.getState().conversations).toHaveLength(0);
      expect(useChatStore.getState().messages).toEqual([]);
    });

    it("only affects the current conversation", () => {
      useChatStore.getState().createConversation("conv-1");
      useChatStore.getState().createConversation("conv-2");

      // Switch back to conv-1
      useChatStore.getState().setCurrentConversation("conv-1");
      const msg = makeMessage({ id: "msg-1" });
      useChatStore.getState().addMessage(msg);

      expect(useChatStore.getState().conversations[0].messages).toHaveLength(1);
      // conv-2 (index 1 after sorting by creation) has no messages
      expect(useChatStore.getState().conversations[1].messages).toHaveLength(0);
    });

    it("updates updatedAt on the conversation", () => {
      useChatStore.getState().createConversation("conv-1");
      const before = useChatStore.getState().conversations[0].updatedAt;

      // Small delay to ensure timestamp difference
      useChatStore.getState().addMessage(makeMessage());

      const after = useChatStore.getState().conversations[0].updatedAt;
      expect(after).toBeGreaterThanOrEqual(before);
    });

    it("triggers persistence", async () => {
      mockSaveConversations.mockResolvedValue(undefined);

      useChatStore.getState().createConversation("conv-1");
      useChatStore.getState().addMessage(makeMessage());

      await new Promise((resolve) => setTimeout(resolve, 0));

      // createConversation + addMessage = 2 persist calls
      expect(mockSaveConversations).toHaveBeenCalledTimes(2);
    });
  });

  // -- deleteConversation ---------------------------------------------------

  describe("deleteConversation", () => {
    it("removes the conversation", () => {
      useChatStore.getState().createConversation("conv-1");
      useChatStore.getState().deleteConversation("conv-1");

      expect(useChatStore.getState().conversations).toHaveLength(0);
    });

    it("clears currentConversationId if the deleted one was active", () => {
      useChatStore.getState().createConversation("conv-1");
      useChatStore.getState().deleteConversation("conv-1");

      expect(useChatStore.getState().currentConversationId).toBeNull();
      expect(useChatStore.getState().messages).toEqual([]);
    });

    it("selects the first remaining conversation if the active one is deleted", () => {
      useChatStore.getState().createConversation("conv-1");
      useChatStore.getState().createConversation("conv-2");
      useChatStore.getState().deleteConversation("conv-2");

      expect(useChatStore.getState().currentConversationId).toBe("conv-1");
    });

    it("preserves currentConversationId if a different one is deleted", () => {
      useChatStore.getState().createConversation("conv-1");
      useChatStore.getState().createConversation("conv-2");
      useChatStore.getState().deleteConversation("conv-1");

      expect(useChatStore.getState().currentConversationId).toBe("conv-2");
    });

    it("is a no-op if the id does not exist", () => {
      useChatStore.getState().createConversation("conv-1");
      useChatStore.getState().deleteConversation("nonexistent");

      expect(useChatStore.getState().conversations).toHaveLength(1);
    });

    it("triggers persistence", async () => {
      mockSaveConversations.mockResolvedValue(undefined);

      useChatStore.getState().createConversation("conv-1");
      useChatStore.getState().deleteConversation("conv-1");

      await new Promise((resolve) => setTimeout(resolve, 0));

      // createConversation + deleteConversation = 2 persist calls
      expect(mockSaveConversations).toHaveBeenCalledTimes(2);
    });
  });

  // -- setCurrentConversation -----------------------------------------------

  describe("setCurrentConversation", () => {
    it("sets the current conversation id", () => {
      useChatStore.getState().createConversation("conv-1");
      useChatStore.getState().createConversation("conv-2");

      useChatStore.getState().setCurrentConversation("conv-1");

      expect(useChatStore.getState().currentConversationId).toBe("conv-1");
    });

    it("updates messages to the selected conversation", () => {
      useChatStore.getState().createConversation("conv-1");
      useChatStore.getState().addMessage(makeMessage({ id: "msg-1" }));
      useChatStore.getState().createConversation("conv-2");

      // conv-2 is now active and has no messages
      expect(useChatStore.getState().messages).toEqual([]);

      useChatStore.getState().setCurrentConversation("conv-1");
      expect(useChatStore.getState().messages).toHaveLength(1);
      expect(useChatStore.getState().messages[0].id).toBe("msg-1");
    });

    it("can clear selection with null", () => {
      useChatStore.getState().createConversation("conv-1");
      useChatStore.getState().setCurrentConversation(null);

      expect(useChatStore.getState().currentConversationId).toBeNull();
      expect(useChatStore.getState().messages).toEqual([]);
    });

    it("sets empty messages for a nonexistent conversation", () => {
      useChatStore.getState().setCurrentConversation("nonexistent");

      expect(useChatStore.getState().currentConversationId).toBe("nonexistent");
      expect(useChatStore.getState().messages).toEqual([]);
    });
  });

  // -- Persistence: loadConversations ---------------------------------------

  describe("loadConversations", () => {
    it("loads conversations from disk", async () => {
      const saved: ChatConversation[] = [
        makeConversation({
          id: "conv-saved",
          messages: [makeMessage({ id: "msg-saved" })],
        }),
      ];
      mockLoadConversations.mockResolvedValue(saved);

      await useChatStore.getState().loadConversations();

      const { conversations, isLoaded } = useChatStore.getState();
      expect(isLoaded).toBe(true);
      expect(conversations).toHaveLength(1);
      expect(conversations[0].id).toBe("conv-saved");
    });

    it("sets isLoaded when file does not exist (empty array)", async () => {
      mockLoadConversations.mockResolvedValue([]);

      await useChatStore.getState().loadConversations();

      const { conversations, isLoaded } = useChatStore.getState();
      expect(isLoaded).toBe(true);
      expect(conversations).toEqual([]);
    });

    it("sets isLoaded even on error", async () => {
      mockLoadConversations.mockRejectedValue(new Error("disk error"));

      await useChatStore.getState().loadConversations();

      expect(useChatStore.getState().isLoaded).toBe(true);
    });
  });

  // -- Persistence: persistConversations ------------------------------------

  describe("persistConversations", () => {
    it("saves current conversations to disk", async () => {
      mockSaveConversations.mockResolvedValue(undefined);

      useChatStore.getState().createConversation("conv-1");
      await useChatStore.getState().persistConversations();

      expect(mockSaveConversations).toHaveBeenCalled();
      const savedData = mockSaveConversations.mock.calls.at(-1)[0];
      expect(savedData).toHaveLength(1);
      expect(savedData[0].id).toBe("conv-1");
    });
  });
});
