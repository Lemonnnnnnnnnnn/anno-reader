/**
 * Bookshelf module barrel export.
 */

export type {
  BookshelfEntry,
  BookEntry,
  BookshelfData,
  ProgressSummary,
  BookshelfItem,
} from "./types";

export { entryToBookMetadata } from "./types";

export {
  loadBookshelf,
  saveBookshelf,
  addEntry,
  removeEntry,
  updateEntry,
  getAnnotationsDir,
  getProgressPath,
} from "./persistence";
