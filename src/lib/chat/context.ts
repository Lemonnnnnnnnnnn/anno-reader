/**
 * Chat context building.
 *
 * Chapter context is bound per conversation (a snapshot of href + title
 * taken when the conversation is created or the checkbox is toggled on).
 * At send time the bound chapter's full text is resolved and injected as
 * the request-time system prompt — it never enters the persisted message
 * history, so toggling the checkbox cleanly changes what is sent, and the
 * stable request prefix stays friendly to provider prompt caching.
 */

import type { ChatMessage, ContextChapter } from "./types";

/** A bound chapter with its full text, resolved at send time. */
export interface ChapterContext extends ContextChapter {
  text: string;
}

export interface ChatSystemPromptOptions {
  bookTitle?: string | null;
  bookAuthor?: string | null;
  /** Bound chapter (with text) to inject, or null when unchecked. */
  chapter?: ChapterContext | null;
}

/** Snapshot of what a chat request would send, for the debug panel. */
export interface ChatRequestDebugInfo {
  /** The exact system prompt string sent with the request. */
  system: string;
  /** Conversation history sent alongside the system prompt. */
  messages: ChatMessage[];
  /** Snapshot bound to the conversation (what the checkbox shows). */
  chapterBound: ContextChapter | null;
  /** Whether the bound chapter's text was successfully resolved. */
  chapterResolved: boolean;
  /** Character length of the resolved chapter text (0 when unbound). */
  chapterTextLength: number;
}

/**
 * Rough token estimate (~4 characters per token for mostly-English text;
 * CJK runs heavier, so treat this as a lower bound).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Build the system prompt for a chat request.
 *
 * Without a chapter: reading-assistant persona + book metadata.
 * With a chapter: additionally injects the full chapter text.
 */
export function buildChatSystemPrompt({
  bookTitle,
  bookAuthor,
  chapter,
}: ChatSystemPromptOptions): string {
  const parts: string[] = [
    "You are a helpful reading assistant answering questions about a specific book. " +
      "Answer using the book's content when it is provided and relevant; you may also " +
      "use general knowledge, but make it clear which source you are drawing from.",
  ];

  const bookLines = [
    bookTitle ? `Book: ${bookTitle}` : null,
    bookAuthor ? `Author: ${bookAuthor}` : null,
  ].filter((line): line is string => line !== null);
  if (bookLines.length > 0) {
    parts.push(bookLines.join("\n"));
  }

  if (chapter && chapter.text.trim()) {
    parts.push(
      `Current chapter: ${chapter.title}\n\nFull text of the current chapter:\n${chapter.text}`,
    );
  }

  return parts.join("\n\n");
}
