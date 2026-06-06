/**
 * SessionList component.
 *
 * Displays a scrollable list of chat conversations for a given book,
 * sorted by most recently updated. Includes a "New Chat" button at
 * the top and an empty state when no conversations exist.
 *
 * @example
 * ```tsx
 * <SessionList
 *   bookId="abc123"
 *   onNewChat={() => startNewConversation()}
 * />
 * ```
 */

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { Plus } from "lucide-react";
import { Button } from "@/components/primitives";
import { SessionItem } from "./SessionItem";
import { useChatStore } from "@/stores/useChatStore";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SessionListProps {
  /** ID of the current book to filter conversations */
  bookId: string;
  /** Called when the user clicks the "New Chat" button */
  onNewChat: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SessionList({ bookId, onNewChat }: SessionListProps) {
  // Select store state with useShallow to prevent infinite re-renders
  // on the conversations array selector
  const { conversations, currentConversationId, setCurrentConversation, renameConversation, deleteConversation } =
    useChatStore(
      useShallow((state) => ({
        conversations: state.conversations,
        currentConversationId: state.currentConversationId,
        setCurrentConversation: state.setCurrentConversation,
        renameConversation: state.renameConversation,
        deleteConversation: state.deleteConversation,
      })),
    );

  // Filter by bookId and sort by updatedAt descending (newest first)
  // Memoize to avoid re-sorting on every render
  const bookConversations = useMemo(
    () =>
      conversations
        .filter((c) => c.bookId === bookId)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations, bookId],
  );

  return (
    <div className="flex flex-col h-full">
      {/* New Chat button */}
      <div className="px-3 pt-3 pb-2">
        <Button
          variant="primary"
          size="md"
          className="w-full flex items-center justify-center gap-1.5"
          onClick={onNewChat}
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Conversation list */}
      {bookConversations.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 text-center">
          <p className="m-0 text-sm text-text-muted dark:text-text-muted-dark">
            No conversations yet
          </p>
        </div>
      ) : (
        <nav className="flex-1 overflow-y-auto flex flex-col gap-0.5 px-1.5 pb-3">
          {bookConversations.map((conv) => (
            <SessionItem
              key={conv.id}
              title={conv.title}
              updatedAt={conv.updatedAt}
              isActive={conv.id === currentConversationId}
              onRename={(newTitle) => renameConversation(conv.id, newTitle)}
              onDelete={() => deleteConversation(conv.id)}
              onClick={() => setCurrentConversation(conv.id)}
            />
          ))}
        </nav>
      )}
    </div>
  );
}
