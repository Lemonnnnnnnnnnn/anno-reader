/**
 * AnnotationDetailDrawer component.
 *
 * Drawer-based panel that displays full note detail with edit and delete
 * actions. Uses the Drawer component as a container for consistent
 * right-side panel behavior.
 *
 * Features:
 * - View and edit note content (Markdown)
 * - Delete notes with confirmation
 * - AI chat mode for discussing note content
 *
 * @example
 * ```tsx
 * <AnnotationDetailDrawer
 *   noteId={activeNoteId}
 *   onClose={() => setActiveNoteId(null)}
 * />
 * ```
 */

import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useBookStore } from "@/stores/useBookStore";
import { Drawer, Button, TextArea } from "@/components/primitives";
import { ChatPanel } from "@/components/chat";
import { Pencil, Trash2, MessageSquare } from "lucide-react";
import { deleteNote, updateNote } from "@/lib/annotations";
import { useChatStreaming } from "@/lib/chat/streaming";
import type { ChatMessage } from "@/lib/chat/types";

interface AnnotationDetailDrawerProps {
  /** ID of the note to display, or null if closed */
  noteId: string | null;
  /** Callback when the panel should close */
  onClose: () => void;
}

export function AnnotationDetailDrawer({ noteId, onClose }: AnnotationDetailDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [chatMode, setChatMode] = useState(false);

  // Get note data from store
  const note = useBookStore((state) =>
    noteId ? state.notes.find((n) => n.id === noteId) ?? null : null
  );
  const currentBook = useBookStore((state) => state.currentBook);

  // Chat streaming state
  const {
    messages: chatMessages,
    streamingText: chatStreamingText,
    status: chatStatus,
    sendChatMessage,
    stopStreaming: chatStopStreaming,
    reset: chatReset,
  } = useChatStreaming();

  const isChatStreaming = chatStatus === "loading" || chatStatus === "streaming";

  // Reset state when note changes
  useEffect(() => {
    setIsEditing(false);
    setEditText("");
    setConfirmDelete(false);
    setChatMode(false);
    chatReset([]);
  }, [noteId, chatReset]);

  const handleStartEdit = useCallback(() => {
    if (!note) return;
    setEditText(note.content);
    setIsEditing(true);
  }, [note]);

  const handleSaveEdit = useCallback(async () => {
    if (!noteId || !currentBook || !editText.trim()) return;
    await updateNote(noteId, editText.trim(), currentBook.id);
    setIsEditing(false);
    setEditText("");
  }, [noteId, currentBook, editText]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditText("");
  }, []);

  const handleDelete = useCallback(async () => {
    if (!noteId || !currentBook) return;
    await deleteNote(noteId, currentBook.id);
    onClose();
  }, [noteId, currentBook, onClose]);

  const handleDeleteClick = useCallback(() => {
    if (confirmDelete) {
      handleDelete();
    } else {
      setConfirmDelete(true);
    }
  }, [confirmDelete, handleDelete]);

  const handleCancelDelete = useCallback(() => {
    setConfirmDelete(false);
  }, [confirmDelete]);

  // Build system message for chat context
  const buildChatSystemMessage = useCallback(() => {
    if (!note) return "";

    const parts = [
      "You are a helpful reading assistant discussing annotations and notes.",
      "The user has written a note while reading a book and wants to discuss it.",
      "Help them explore ideas, clarify their thoughts, suggest improvements, or answer questions about the note.",
      "",
      "## Selected text from the book",
      `"${note.text}"`,
      "",
      "## User's note",
      note.content,
    ];

    if (currentBook?.title) {
      parts.push("", `## Book: ${currentBook.title}`);
      if (currentBook.author) {
        parts.push(`**Author:** ${currentBook.author}`);
      }
    }

    return parts.join("\n");
  }, [note, currentBook]);

  // Enter chat mode
  const handleEnterChat = useCallback(() => {
    if (!note) return;

    const systemMsg = buildChatSystemMessage();

    // Seed with the note context as initial exchange
    const seedMessages: ChatMessage[] = [
      {
        id: crypto.randomUUID(),
        role: "user",
        content: `I'd like to discuss this note about: "${note.text.slice(0, 100)}${note.text.length > 100 ? "…" : ""}"`,
        createdAt: Date.now(),
      },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `I can see you've written a note about this passage. Your note says:\n\n> ${note.content}\n\nWhat would you like to discuss about it? I can help you:\n- Explore the idea further\n- Clarify or refine your thoughts\n- Find connections to other concepts\n- Suggest improvements to the note`,
        createdAt: Date.now(),
      },
    ];

    chatReset(seedMessages);
    setChatSystemMessage(systemMsg);
    setChatMode(true);
  }, [note, buildChatSystemMessage, chatReset]);

  // Store system message for chat sends
  const [chatSystemMessage, setChatSystemMessage] = useState("");

  // Exit chat mode
  const handleExitChat = useCallback(() => {
    chatStopStreaming();
    chatReset([]);
    setChatMode(false);
  }, [chatStopStreaming, chatReset]);

  // Send chat message with system context
  const handleChatSend = useCallback(
    (content: string) => {
      void sendChatMessage(content, chatSystemMessage);
    },
    [sendChatMessage, chatSystemMessage],
  );

  if (!note) return null;

  return (
    <Drawer open={!!noteId} onClose={onClose} title={chatMode ? "AI Chat" : "Note Detail"}>
      {chatMode ? (
        <ChatPanel
          messages={chatMessages}
          streamingText={chatStreamingText}
          status={chatStatus}
          isStreaming={isChatStreaming}
          onSend={handleChatSend}
          onStop={chatStopStreaming}
          onClose={onClose}
          contextText={note.text}
          inputPlaceholder="Ask about this note…"
          footer={
            <div className="shrink-0 flex items-center justify-between gap-2 pt-2 mt-1 border-t border-border dark:border-border-dark">
              <Button variant="secondary" size="sm" onClick={handleExitChat}>
                Back to Note
              </Button>
              <div className="flex items-center gap-2">
                {isChatStreaming && (
                  <Button variant="secondary" size="sm" onClick={chatStopStreaming}>
                    Stop
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          }
        />
      ) : (
        <div className="flex-1 flex flex-col gap-4 font-serif min-h-0 h-full">
          {/* Quoted original text */}
          <div className="border-l-2 border-accent dark:border-accent-dark pl-3">
            <p className="m-0 text-xs text-text-secondary dark:text-text-secondary-dark italic leading-snug overflow-hidden text-ellipsis line-clamp-3">
              &ldquo;{note.text}&rdquo;
            </p>
          </div>

          {/* Note content */}
          {isEditing ? (
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              <TextArea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onSubmit={handleSaveEdit}
                onCancel={handleCancelEdit}
                className="flex-1 min-h-0"
                placeholder="Write your note..."
              />
              <div className="flex justify-end gap-2 shrink-0">
                <Button variant="secondary" size="sm" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={!editText.trim()}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-text dark:text-text-dark leading-relaxed break-words markdown-note">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
            </div>
          )}

          {/* Actions */}
          {!isEditing && (
            <div className="flex items-center justify-between pt-2 border-t border-border dark:border-border-dark">
              <div className="flex items-center gap-1">
                {confirmDelete ? (
                  <>
                    <span className="text-xs text-text-secondary dark:text-text-secondary-dark mr-2">Delete this note?</span>
                    <Button variant="secondary" size="sm" onClick={handleCancelDelete}>
                      Cancel
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleDeleteClick}>
                      Delete
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="icon"
                      onClick={handleStartEdit}
                      title="Edit note"
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      variant="icon"
                      onClick={handleDeleteClick}
                      title="Delete note"
                    >
                      <Trash2 size={16} />
                    </Button>
                    <Button
                      variant="icon"
                      onClick={handleEnterChat}
                      title="Chat with AI about this note"
                    >
                      <MessageSquare size={16} />
                    </Button>
                  </>
                )}
              </div>

              {/* Timestamp */}
              <span className="text-[0.72rem] text-text-muted dark:text-text-muted-dark">
                {new Date(note.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
