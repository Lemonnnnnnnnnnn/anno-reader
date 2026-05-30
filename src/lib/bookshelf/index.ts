/**
 * Bookshelf module barrel export.
 */

export type { BookshelfItem, ProgressSummary, BookshelfData } from "./types";
export {
  loadBookshelf,
  saveBookshelf,
  addBookToBookshelf,
  removeBookFromBookshelf,
  updateBookInBookshelf,
} from "./persistence";
