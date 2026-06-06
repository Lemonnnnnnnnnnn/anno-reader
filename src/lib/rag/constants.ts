/**
 * Constants for the RAG module.
 * Centralizes chunking limits, search defaults, and system prompts.
 */

// ---------------------------------------------------------------------------
// Chunking Limits
// ---------------------------------------------------------------------------

/** Maximum character length for a single chunk. */
export const MAX_CHUNK_LENGTH = 500;

/** Minimum character length — chunks shorter than this are discarded. */
export const MIN_CHUNK_LENGTH = 50;

// ---------------------------------------------------------------------------
// Search Defaults
// ---------------------------------------------------------------------------

/** Maximum number of chunks returned per search query. */
export const SEARCH_LIMIT = 10;

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

/**
 * System prompt template for RAG-augmented chat responses.
 * Placeholders: {bookTitle}, {bookAuthor}, {context}
 */
export const SYSTEM_PROMPT_TEMPLATE = `You are a helpful assistant answering questions about a specific book. Use the provided context from the book to answer the user's question. If the context doesn't contain enough information, say so.

Book: {bookTitle}
Author: {bookAuthor}

Relevant passages from the book:
{context}`;
