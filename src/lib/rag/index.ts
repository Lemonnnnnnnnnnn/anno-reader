/**
 * RAG (Retrieval-Augmented Generation) module.
 * Provides full-text search over EPUB content using FTS5,
 * enabling context-augmented chat conversations about books.
 */

export type { ChunkInput, ChunkResult, SearchResult, RAGStatus } from "./types";

export {
  MAX_CHUNK_LENGTH,
  MIN_CHUNK_LENGTH,
  SEARCH_LIMIT,
  SYSTEM_PROMPT_TEMPLATE,
} from "./constants";

export {
  setParsedEpub,
  getParsedEpub,
  clearParsedEpub,
  getChapterText,
  getAllChapterTexts,
} from "./parsed-epub-cache";

export { extractPlainText, chunkChapter, chunkBook } from "./chunker";

export {
  indexBook,
  searchBook,
  deleteBookIndex,
  bookIndexExists,
} from "./indexer";

export { sanitizeFTS5Query, searchAndAssembleContext } from "./search";
export type { SearchContextResult } from "./search";

export { indexBookFromCache, askQuestion } from "./orchestrator";

export { useRAG } from "./hooks";
export type { UseRAGReturn } from "./hooks";
