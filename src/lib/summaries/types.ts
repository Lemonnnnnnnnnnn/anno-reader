/**
 * Types for the chapter summaries module.
 * These types represent persisted data,
 * decoupled from the Zustand store shape.
 */

/**
 * Output language for generated summaries.
 * - "auto": match the language of the chapter body
 * - "chinese": always summarize in Simplified Chinese
 * - "english": always summarize in English
 */
export type SummaryLanguage = "auto" | "chinese" | "english";

/** Level of detail for generated summaries. */
export type SummaryDetail = "brief" | "detailed";

/**
 * User preferences applied when generating chapter summaries.
 * Persisted as part of AIConfig (ai-config.json).
 */
export interface SummaryPreferences {
  /** Language of the generated summary */
  language: SummaryLanguage;
  /** How detailed the summary should be */
  detail: SummaryDetail;
}

export const DEFAULT_SUMMARY_PREFERENCES: SummaryPreferences = {
  language: "auto",
  detail: "brief",
};

/**
 * Persisted chapter summary for a single book.
 * Stored as JSON in the app's data directory.
 */
export interface SummaryData {
  /** Unique summary identifier */
  id: string;
  /** Book ID this summary belongs to */
  bookId: string;
  /** Chapter href the summary covers */
  chapterHref: string;
  /** Chapter index (for display) */
  chapterIndex: number;
  /** Chapter title (for display), if available */
  chapterTitle: string | null;
  /** Markdown summary content produced by the AI */
  content: string;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
}
