/**
 * AnnotationDetailPanel component.
 *
 * Note detail panel with edit and delete actions. The container is
 * switchable via `variant`: a right-side drawer (default) or a centered
 * modal dialog. Both share the same content, pinned footer, and behavior.
 *
 * The note is always live-editable: a Tiptap markdown editor seeded from the
 * stored note, with changes autosaved on a short debounce (no manual save).
 * Pending edits are flushed when the note changes, the panel closes, or AI
 * chat mode opens.
 *
 * Features:
 * - View and edit note content (Markdown, autosaved)
 * - Delete notes with confirmation
 * - AI chat mode for discussing note content
 *
 * @example
 * ```tsx
 * <AnnotationDetailPanel
 *   noteId={activeNoteId}
 *   onClose={() => setActiveNoteId(null)}
 *   variant={noteDetailLayout}
 * />
 * ```
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useBookStore } from "@/stores/useBookStore";
import { Drawer, Modal, Button } from "@/components/primitives";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { ChatPanel } from "@/components/chat";
import { Trash2, MessageSquare, Volume2 } from "lucide-react";
import { deleteNote, updateNote } from "@/lib/annotations";
import { useTTS } from "@/hooks/useTTS";
import { useChatStreaming } from "@/lib/chat/streaming";
import type { ChatMessage } from "@/lib/chat/types";

/** Idle time after the last keystroke before changes are persisted. */
const AUTOSAVE_DELAY_MS = 600;

type SaveStatus = "idle" | "saving" | "saved" | "error";

export type NoteDetailVariant = "drawer" | "modal";

interface AnnotationDetailPanelProps {
  /** ID of the note to display, or null if closed */
  noteId: string | null;
  /** Callback when the panel should close */
  onClose: () => void;
  /** Container style: right-side drawer (default) or centered modal */
  variant?: NoteDetailVariant;
}

export function AnnotationDetailPanel({
  noteId,
  onClose,
  variant = "drawer",
}: AnnotationDetailPanelProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [chatMode, setChatMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

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

  // Read the quoted book passage aloud. speak() toggles playback.
  const { speak, stop, isSpeaking } = useTTS(note?.text ?? "");

  // Stop playback whenever the panel closes or switches notes — the footer
  // control is not rendered in those states, so audio can't run uncontrolled.
  useEffect(() => {
    stop();
  }, [noteId, stop]);

  // Autoplay the quoted section when a note opens. Runs after the stop
  // effect above, so switching notes stops the previous audio before this
  // starts the new one.
  useEffect(() => {
    if (note) {
      void speak();
    }
    // Only trigger on open / note switch, not on every speak re-creation.
  }, [note?.id]);

  // --- Live editing with debounced autosave --------------------------------
  // Edits update these refs immediately and hit disk after AUTOSAVE_DELAY_MS
  // of idle time. Saves are serialized through saveChainRef so an older,
  // slower write can never overwrite a newer one, and identical content is
  // never written twice.
  const noteIdRef = useRef<string | null>(noteId);
  const bookIdRef = useRef<string | null>(currentBook?.id ?? null);
  const latestContentRef = useRef<string | undefined>(undefined);
  const savedContentRef = useRef<string | undefined>(undefined);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deletedRef = useRef(false);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  const flushSave = useCallback((): Promise<void> => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const id = noteIdRef.current;
    const bookId = bookIdRef.current;
    const content = latestContentRef.current;
    if (!id || !bookId || content === undefined || deletedRef.current) {
      return saveChainRef.current;
    }
    if (content === savedContentRef.current) {
      return saveChainRef.current;
    }
    setSaveStatus("saving");
    saveChainRef.current = saveChainRef.current.then(async () => {
      try {
        await updateNote(id, content, bookId);
        savedContentRef.current = content;
        setSaveStatus("saved");
      } catch (err) {
        console.error("[AnnotationDetailPanel] autosave failed:", err);
        setSaveStatus("error");
      }
    });
    return saveChainRef.current;
  }, []);

  const scheduleSave = useCallback(
    (markdown: string) => {
      latestContentRef.current = markdown;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        void flushSave();
      }, AUTOSAVE_DELAY_MS);
    },
    [flushSave],
  );

  // Reset per-note state and the save baseline whenever the open note
  // changes.
  useEffect(() => {
    noteIdRef.current = noteId;
    bookIdRef.current = currentBook?.id ?? null;
    latestContentRef.current = undefined;
    savedContentRef.current = undefined;
    deletedRef.current = false;
    setConfirmDelete(false);
    setChatMode(false);
    chatReset([]);
    setSaveStatus("idle");
  }, [noteId, currentBook, chatReset]);

  // Persist pending edits when the note changes, the panel closes, or the
  // editor unmounts (AI chat opens). Cleanup runs before the reset effect
  // above updates the refs, so this flushes with the previous note's values.
  useEffect(() => {
    return () => {
      void flushSave();
    };
  }, [noteId, chatMode, flushSave]);

  const handleDelete = useCallback(async () => {
    if (!noteId || !currentBook) return;
    // Drop pending autosaves — the note is about to be removed.
    deletedRef.current = true;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
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

    stop();
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
  }, [note, buildChatSystemMessage, chatReset, stop]);

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

  const noteFooter = !chatMode && (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
        {confirmDelete ? (
          <>
            <span className="text-xs text-text-secondary dark:text-text-secondary-dark mr-2">
              Delete this note?
            </span>
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
              onClick={speak}
              title={isSpeaking ? "Stop speaking" : "Listen to section"}
            >
              <Volume2
                size={16}
                className={isSpeaking ? "text-accent dark:text-accent-dark" : ""}
              />
            </Button>
            <Button variant="icon" onClick={handleDeleteClick} title="Delete note">
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

      <div className="flex items-center gap-2">
        {saveStatus === "saving" && (
          <span className="text-[0.72rem] text-text-muted dark:text-text-muted-dark">
            Saving…
          </span>
        )}
        {saveStatus === "saved" && (
          <span className="text-[0.72rem] text-text-muted dark:text-text-muted-dark">
            Saved
          </span>
        )}
        {saveStatus === "error" && (
          <span className="text-[0.72rem] text-error dark:text-error">
            Save failed
          </span>
        )}
        <span className="text-[0.72rem] text-text-muted dark:text-text-muted-dark">
          {new Date(note.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );

  const title = chatMode ? "AI Chat" : "Note Detail";

  const noteContent = (
    <div className="flex flex-col gap-3 font-serif">
      {/* Quoted original text */}
      <div className="border-l-2 border-accent dark:border-accent-dark pl-3">
        <p className="m-0 text-xs text-text-secondary dark:text-text-secondary-dark italic leading-snug overflow-hidden text-ellipsis line-clamp-3">
          &ldquo;{note.text}&rdquo;
        </p>
      </div>

      {/* Note content: always live-editable, autosaved on idle */}
      <MarkdownEditor
        key={note.id}
        initialContent={note.content}
        onChange={scheduleSave}
        onSubmit={() => {
          void flushSave();
          onClose();
        }}
        placeholder="Write your note..."
      />
    </div>
  );

  const chatContent = (
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
  );

  // The drawer fills the viewport height, so ChatPanel can size itself with
  // h-full. The modal body grows with its content, so chat needs an explicit
  // bounded height.
  const chatInModal = <div className="h-[60vh]">{chatContent}</div>;

  if (variant === "modal") {
    return (
      <Modal
        open={!!noteId}
        onClose={onClose}
        title={title}
        size="wide"
        footer={noteFooter}
      >
        {chatMode ? chatInModal : noteContent}
      </Modal>
    );
  }

  return (
    <Drawer open={!!noteId} onClose={onClose} title={title} footer={noteFooter}>
      {chatMode ? chatContent : noteContent}
    </Drawer>
  );
}
