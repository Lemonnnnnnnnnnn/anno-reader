/**
 * AnnotationPanel component.
 *
 * Side panel that displays all notes and highlights for the current book.
 * Provides management UI for editing note content and deleting annotations.
 *
 * @example
 * ```tsx
 * <AnnotationPanel open={true} onClose={() => setOpen(false)} />
 * ```
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useBookStore, type Note } from "@/stores/useBookStore";
import {
  deleteNote,
  updateNote,
  deleteHighlight,
} from "@/lib/annotations";

interface AnnotationPanelProps {
  /** Whether the panel is visible */
  open: boolean;
  /** Callback to close the panel */
  onClose: () => void;
}

type TabType = "notes" | "highlights";

export function AnnotationPanel({ open, onClose }: AnnotationPanelProps) {
  const currentBook = useBookStore((state) => state.currentBook);
  const notes = useBookStore((state) => state.notes);
  const highlights = useBookStore((state) => state.highlights);
  const [tab, setTab] = useState<TabType>("notes");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  // Filter annotations for the current book
  const bookNotes = currentBook
    ? notes.filter((n) => n.bookId === currentBook.id)
    : [];
  const bookHighlights = currentBook
    ? highlights.filter((h) => h.bookId === currentBook.id)
    : [];

  // Sort by creation time (newest first)
  const sortedNotes = [...bookNotes].sort((a, b) => b.createdAt - a.createdAt);
  const sortedHighlights = [...bookHighlights].sort(
    (a, b) => b.createdAt - a.createdAt,
  );

  // Focus edit input when entering edit mode
  useEffect(() => {
    if (editingNoteId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingNoteId]);

  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      if (!currentBook) return;
      await deleteNote(noteId, currentBook.id);
    },
    [currentBook],
  );

  const handleDeleteHighlight = useCallback(
    async (highlightId: string) => {
      if (!currentBook) return;
      await deleteHighlight(highlightId, currentBook.id);
    },
    [currentBook],
  );

  const handleStartEdit = useCallback((note: Note) => {
    setEditingNoteId(note.id);
    setEditText(note.content);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingNoteId || !currentBook) return;
    await updateNote(editingNoteId, editText, currentBook.id);
    setEditingNoteId(null);
    setEditText("");
  }, [editingNoteId, editText, currentBook]);

  const handleCancelEdit = useCallback(() => {
    setEditingNoteId(null);
    setEditText("");
  }, []);

  if (!open) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Annotations</h2>
          <button style={styles.closeButton} onClick={onClose} title="Close">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={styles.tabBar}>
          <button
            style={{
              ...styles.tab,
              ...(tab === "notes" ? styles.tabActive : {}),
            }}
            onClick={() => setTab("notes")}
          >
            Notes ({bookNotes.length})
          </button>
          <button
            style={{
              ...styles.tab,
              ...(tab === "highlights" ? styles.tabActive : {}),
            }}
            onClick={() => setTab("highlights")}
          >
            Highlights ({bookHighlights.length})
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {tab === "notes" && (
            <>
              {sortedNotes.length === 0 ? (
                <div style={styles.empty}>
                  <p style={styles.emptyText}>No notes yet</p>
                  <p style={styles.emptyHint}>
                    Select text in the chapter and click "Note" to add one
                  </p>
                </div>
              ) : (
                sortedNotes.map((note) => (
                  <div key={note.id} style={styles.card}>
                    <div style={styles.cardHeader}>
                      <span style={styles.cardSource}>"{truncate(note.text, 60)}"</span>
                      <div style={styles.cardActions}>
                        <button
                          style={styles.iconButton}
                          onClick={() => handleStartEdit(note)}
                          title="Edit note"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                        </button>
                        <button
                          style={styles.iconButton}
                          onClick={() => handleDeleteNote(note.id)}
                          title="Delete note"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {editingNoteId === note.id ? (
                      <div style={styles.editContainer}>
                        <textarea
                          ref={editInputRef}
                          style={styles.editInput}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                              e.preventDefault();
                              handleSaveEdit();
                            }
                            if (e.key === "Escape") {
                              handleCancelEdit();
                            }
                          }}
                          rows={3}
                        />
                        <div style={styles.editActions}>
                          <button
                            style={styles.cancelBtn}
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </button>
                          <button
                            style={styles.saveBtn}
                            onClick={handleSaveEdit}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p style={styles.cardContent}>{note.content}</p>
                    )}
                    <span style={styles.cardTime}>
                      {formatTime(note.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </>
          )}

          {tab === "highlights" && (
            <>
              {sortedHighlights.length === 0 ? (
                <div style={styles.empty}>
                  <p style={styles.emptyText}>No highlights yet</p>
                  <p style={styles.emptyHint}>
                    Select text in the chapter and click "Highlight" to add one
                  </p>
                </div>
              ) : (
                sortedHighlights.map((hl) => (
                  <div key={hl.id} style={styles.card}>
                    <div style={styles.cardHeader}>
                      <div style={styles.highlightBadge}>
                        <span
                          style={{
                            ...styles.colorDot,
                            background: hl.color,
                          }}
                        />
                        <span style={styles.cardSource}>
                          "{truncate(hl.text, 60)}"
                        </span>
                      </div>
                      <button
                        style={styles.iconButton}
                        onClick={() => handleDeleteHighlight(hl.id)}
                        title="Delete highlight"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                    <span style={styles.cardTime}>
                      {formatTime(hl.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
      {/* Click outside to close */}
      <div style={styles.backdrop} onClick={onClose} />
    </div>
  );
}

/** Truncate text to a max length with ellipsis */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
}

/** Format timestamp to a readable date string */
function formatTime(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// --- Design tokens ---

const colors = {
  surface: "#ffffff",
  surfaceHover: "#f9fafb",
  bg: "#f6f6f6",
  text: "#0f0f0f",
  textSecondary: "#6b7280",
  textMuted: "#9ca3af",
  border: "#e5e5e5",
  accent: "#374151",
  accentHover: "#1f2937",
  error: "#dc2626",
  shadow: "rgba(0, 0, 0, 0.1)",
} as const;

const spacing = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
} as const;

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 200,
    display: "flex",
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    background: "transparent",
  },
  panel: {
    position: "relative",
    width: "360px",
    maxWidth: "90vw",
    height: "100%",
    background: colors.surface,
    borderLeft: `1px solid ${colors.border}`,
    boxShadow: `-4px 0 24px ${colors.shadow}`,
    display: "flex",
    flexDirection: "column",
    zIndex: 1,
    fontFamily:
      "'Literata', 'Georgia', 'Iowan Old Style', 'Palatino Linotype', 'Noto Serif', serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${spacing.md} ${spacing.lg}`,
    borderBottom: `1px solid ${colors.border}`,
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: "1rem",
    fontWeight: 600,
    color: colors.text,
    letterSpacing: "-0.01em",
  },
  closeButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    background: "transparent",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    color: colors.textSecondary,
    transition: "background 0.12s",
    padding: 0,
  },
  tabBar: {
    display: "flex",
    borderBottom: `1px solid ${colors.border}`,
    flexShrink: 0,
  },
  tab: {
    flex: 1,
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: "0.8rem",
    fontWeight: 500,
    color: colors.textSecondary,
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    cursor: "pointer",
    transition: "color 0.12s, border-color 0.12s",
    fontFamily: "inherit",
  },
  tabActive: {
    color: colors.text,
    borderBottomColor: colors.accent,
  },
  content: {
    flex: 1,
    overflowY: "auto",
    padding: spacing.md,
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: `${spacing.xl} ${spacing.lg}`,
    textAlign: "center",
    gap: spacing.xs,
  },
  emptyText: {
    margin: 0,
    fontSize: "0.9rem",
    fontWeight: 500,
    color: colors.textSecondary,
  },
  emptyHint: {
    margin: 0,
    fontSize: "0.8rem",
    color: colors.textMuted,
    lineHeight: 1.5,
  },
  card: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    background: colors.bg,
    borderRadius: "6px",
    border: `1px solid ${colors.border}`,
  },
  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  highlightBadge: {
    display: "flex",
    alignItems: "center",
    gap: spacing.xs,
    flex: 1,
    minWidth: 0,
  },
  colorDot: {
    display: "inline-block",
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    flexShrink: 0,
    border: `1px solid ${colors.border}`,
  },
  cardSource: {
    fontSize: "0.78rem",
    color: colors.textSecondary,
    fontStyle: "italic",
    lineHeight: 1.4,
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  } as React.CSSProperties,
  cardActions: {
    display: "flex",
    gap: "2px",
    flexShrink: 0,
  },
  iconButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    background: "transparent",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    color: colors.textMuted,
    transition: "color 0.12s, background 0.12s",
    padding: 0,
  },
  cardContent: {
    margin: 0,
    fontSize: "0.85rem",
    color: colors.text,
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  cardTime: {
    display: "block",
    fontSize: "0.72rem",
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  editContainer: {
    display: "flex",
    flexDirection: "column",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  editInput: {
    width: "100%",
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: "0.825rem",
    fontFamily: "inherit",
    lineHeight: "1.5",
    color: colors.text,
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: "5px",
    resize: "vertical",
    outline: "none",
    minHeight: "60px",
    boxSizing: "border-box",
  },
  editActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: spacing.xs,
  },
  cancelBtn: {
    padding: "4px 10px",
    fontSize: "0.78rem",
    fontWeight: 500,
    color: colors.textSecondary,
    background: "transparent",
    border: `1px solid ${colors.border}`,
    borderRadius: "4px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  saveBtn: {
    padding: "4px 12px",
    fontSize: "0.78rem",
    fontWeight: 500,
    color: colors.surface,
    background: colors.accent,
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
};
