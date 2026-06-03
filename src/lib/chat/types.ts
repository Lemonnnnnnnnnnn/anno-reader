/**
 * Types for the chat module.
 * These types define chat messages, conversations, and state management.
 */

// ---------------------------------------------------------------------------
// Message Types
// ---------------------------------------------------------------------------

/** Message role in a conversation. */
export type ChatRole = "user" | "assistant";

/**
 * A single chat message.
 */
export interface ChatMessage {
  /** Unique message identifier */
  id: string;
  /** Role of the message sender */
  role: ChatRole;
  /** Message content */
  content: string;
  /** Unix timestamp when the message was created */
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Conversation Types
// ---------------------------------------------------------------------------

/**
 * A chat conversation containing multiple messages.
 */
export interface ChatConversation {
  /** Unique conversation identifier */
  id: string;
  /** Ordered list of messages in this conversation */
  messages: ChatMessage[];
  /** Unix timestamp when the conversation was created */
  createdAt: number;
  /** Unix timestamp when the conversation was last updated */
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// State Types
// ---------------------------------------------------------------------------

/**
 * Root state object for the chat feature.
 * Manages conversations and tracks the active one.
 */
export interface ChatState {
  /** All chat conversations */
  conversations: ChatConversation[];
  /** ID of the currently active conversation, null if none selected */
  currentConversationId: string | null;
}
