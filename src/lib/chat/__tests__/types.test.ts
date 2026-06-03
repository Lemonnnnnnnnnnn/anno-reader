import { describe, it, expect } from "vitest";
import {
  type ChatRole,
  type ChatMessage,
  type ChatConversation,
  type ChatState,
} from "../types";

// ---------------------------------------------------------------------------
// Type-level export checks (compile-time only, no runtime cost)
// ---------------------------------------------------------------------------

// If these assignments compile, the types are exported correctly.
// They are unused by design — they exist purely for type checking.
{
  const _role: ChatRole = "user";
  const _message: ChatMessage = {} as ChatMessage;
  const _conversation: ChatConversation = {} as ChatConversation;
  const _state: ChatState = {} as ChatState;

  // Suppress unused warnings — these are compile-time-only checks
  void _role;
  void _message;
  void _conversation;
  void _state;
}

// ---------------------------------------------------------------------------
// ChatRole literal check
// ---------------------------------------------------------------------------

describe("ChatRole", () => {
  it("allows 'user' and 'assistant'", () => {
    const roles: ChatRole[] = ["user", "assistant"];
    expect(roles).toHaveLength(2);
    expect(roles).toContain("user");
    expect(roles).toContain("assistant");
  });
});

// ---------------------------------------------------------------------------
// ChatMessage
// ---------------------------------------------------------------------------

describe("ChatMessage", () => {
  it("has the correct shape", () => {
    const message: ChatMessage = {
      id: "msg-1",
      role: "user",
      content: "Hello",
      createdAt: Date.now(),
    };

    expect(typeof message.id).toBe("string");
    expect(["user", "assistant"]).toContain(message.role);
    expect(typeof message.content).toBe("string");
    expect(typeof message.createdAt).toBe("number");
  });

  it("accepts 'user' role", () => {
    const message: ChatMessage = {
      id: "msg-1",
      role: "user",
      content: "Hello",
      createdAt: Date.now(),
    };
    expect(message.role).toBe("user");
  });

  it("accepts 'assistant' role", () => {
    const message: ChatMessage = {
      id: "msg-1",
      role: "assistant",
      content: "Hi there!",
      createdAt: Date.now(),
    };
    expect(message.role).toBe("assistant");
  });
});

// ---------------------------------------------------------------------------
// ChatConversation
// ---------------------------------------------------------------------------

describe("ChatConversation", () => {
  it("has the correct shape", () => {
    const now = Date.now();
    const conversation: ChatConversation = {
      id: "conv-1",
      messages: [
        {
          id: "msg-1",
          role: "user",
          content: "Hello",
          createdAt: now,
        },
        {
          id: "msg-2",
          role: "assistant",
          content: "Hi!",
          createdAt: now + 1000,
        },
      ],
      createdAt: now,
      updatedAt: now + 1000,
    };

    expect(typeof conversation.id).toBe("string");
    expect(Array.isArray(conversation.messages)).toBe(true);
    expect(conversation.messages).toHaveLength(2);
    expect(typeof conversation.createdAt).toBe("number");
    expect(typeof conversation.updatedAt).toBe("number");
  });

  it("can have empty messages array", () => {
    const conversation: ChatConversation = {
      id: "conv-1",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(conversation.messages).toHaveLength(0);
  });

  it("contains valid ChatMessage objects", () => {
    const now = Date.now();
    const conversation: ChatConversation = {
      id: "conv-1",
      messages: [
        { id: "msg-1", role: "user", content: "Test", createdAt: now },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const msg = conversation.messages[0];
    expect(typeof msg.id).toBe("string");
    expect(["user", "assistant"]).toContain(msg.role);
    expect(typeof msg.content).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// ChatState
// ---------------------------------------------------------------------------

describe("ChatState", () => {
  it("has the correct shape", () => {
    const state: ChatState = {
      conversations: [],
      currentConversationId: null,
    };

    expect(Array.isArray(state.conversations)).toBe(true);
    expect(state.currentConversationId).toBeNull();
  });

  it("can hold conversations", () => {
    const now = Date.now();
    const state: ChatState = {
      conversations: [
        {
          id: "conv-1",
          messages: [
            { id: "msg-1", role: "user", content: "Hello", createdAt: now },
          ],
          createdAt: now,
          updatedAt: now,
        },
      ],
      currentConversationId: "conv-1",
    };

    expect(state.conversations).toHaveLength(1);
    expect(state.currentConversationId).toBe("conv-1");
  });

  it("currentConversationId can be null", () => {
    const state: ChatState = {
      conversations: [],
      currentConversationId: null,
    };
    expect(state.currentConversationId).toBeNull();
  });

  it("currentConversationId can be a string", () => {
    const state: ChatState = {
      conversations: [],
      currentConversationId: "conv-123",
    };
    expect(state.currentConversationId).toBe("conv-123");
  });
});
