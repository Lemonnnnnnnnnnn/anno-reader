/**
 * HTML-to-text extraction and paragraph-based text chunking for RAG indexing.
 *
 * extractPlainText() converts HTML to plain text while preserving paragraph
 * boundaries (\n\n). chunkChapter() and chunkBook() split text into
 * fixed-length chunks for FTS5 indexing.
 */

import type { ChunkInput } from "./types";
import { MAX_CHUNK_LENGTH, MIN_CHUNK_LENGTH } from "./constants";

// ---------------------------------------------------------------------------
// Block-level elements that create paragraph boundaries
// ---------------------------------------------------------------------------

const BLOCK_ELEMENTS = new Set([
  "address", "article", "aside", "blockquote", "details", "dialog", "dd",
  "div", "dl", "dt", "fieldset", "figcaption", "figure", "footer", "form",
  "h1", "h2", "h3", "h4", "h5", "h6", "header", "hgroup", "hr", "li",
  "main", "nav", "ol", "p", "pre", "section", "table", "ul",
]);

// ---------------------------------------------------------------------------
// HTML-to-Text Extraction
// ---------------------------------------------------------------------------

/**
 * Extract plain text from HTML content using DOMParser.
 * - Removes script, style, head elements
 * - Preserves paragraph boundaries (\n\n) between block-level elements
 * - Normalizes whitespace within paragraphs (collapses spaces/tabs)
 * - Decodes HTML entities (&amp; → &, &lt; → <, etc.)
 * - Handles malformed HTML gracefully
 */
export function extractPlainText(html: string): string {
  if (!html) return ""

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    // Remove elements that shouldn't contribute text
    const removeSelectors = ["script", "style", "head"]
    for (const selector of removeSelectors) {
      const elements = doc.querySelectorAll(selector)
      for (const el of elements) {
        el.remove()
      }
    }

    const body = doc.body
    if (!body) return ""

    // Walk child nodes and insert \n\n before block-level elements
    // to preserve paragraph boundaries for chunking.
    let text = ""
    for (const child of Array.from(body.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = (child as Element).tagName.toLowerCase()
        if (BLOCK_ELEMENTS.has(tag)) {
          text += "\n\n" + (child as Element).textContent
        } else {
          text += (child as Element).textContent
        }
      } else if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent ?? ""
      }
    }

    // Normalize whitespace:
    // 1. Collapse spaces/tabs within text
    // 2. Collapse multiple blank lines to exactly \n\n (paragraph boundary)
    // 3. Collapse single newlines within paragraphs to spaces
    // 4. Trim leading/trailing whitespace
    return text
      .replace(/[ \t]+/g, " ")
      .replace(/(\s*\n\s*){2,}/g, "\n\n")
      .replace(/(?<!\n)\n(?!\n)/g, " ")
      .trim()
  } catch {
    // Malformed HTML or DOMParser unavailable — return empty string
    return ""
  }
}

// ---------------------------------------------------------------------------
// Sentence Splitting
// ---------------------------------------------------------------------------

/** Regex matching one sentence: text ending in ., !, ? or CJK equivalents. */
const SENTENCE_REGEX = /[^.!?\u3002\uff01\uff1f]+[.!?\u3002\uff01\uff1f]\s?/g;

/**
 * Split a paragraph into sentences at punctuation boundaries.
 * Supports CJK punctuation (。！？) in addition to Latin (.!?).
 *
 * Returns an array of trimmed sentence strings.
 * Any trailing text without ending punctuation is included as a final sentence.
 */
function splitSentences(para: string): string[] {
  const sentences: string[] = []
  let match: RegExpExecArray | null

  while ((match = SENTENCE_REGEX.exec(para)) !== null) {
    const s = match[0].trim()
    if (s.length > 0) {
      sentences.push(s)
    }
  }

  // Handle trailing text that doesn't end with punctuation
  if (sentences.length > 0) {
    const lastMatch = SENTENCE_REGEX.lastIndex
    if (lastMatch < para.length) {
      const trailing = para.slice(lastMatch).trim()
      if (trailing.length > 0) {
        sentences.push(trailing)
      }
    }
  }

  return sentences
}

/**
 * Split a long paragraph into chunks that fit within MAX_CHUNK_LENGTH.
 * Strategy: split at sentence boundaries, then join sentences until
 * approaching the limit. Hard-splits any single sentence over the limit.
 */
function splitLongParagraph(para: string): string[] {
  const sentences = splitSentences(para)
  if (sentences.length <= 1) {
    // Single sentence (or no punctuation) — hard-split at character limit
    const chunks: string[] = []
    for (let i = 0; i < para.length; i += MAX_CHUNK_LENGTH) {
      chunks.push(para.slice(i, i + MAX_CHUNK_LENGTH))
    }
    return chunks
  }

  // Accumulate sentences into chunks
  const chunks: string[] = []
  let current = ""

  for (const sentence of sentences) {
    if (current.length + sentence.length + 1 > MAX_CHUNK_LENGTH && current.length > 0) {
      chunks.push(current.trim())
      current = ""
    }
    current += (current ? " " : "") + sentence
  }

  if (current.trim().length > 0) {
    chunks.push(current.trim())
  }

  // Hard-split any chunk still over the limit
  const result: string[] = []
  for (const chunk of chunks) {
    if (chunk.length <= MAX_CHUNK_LENGTH) {
      result.push(chunk)
    } else {
      for (let i = 0; i < chunk.length; i += MAX_CHUNK_LENGTH) {
        result.push(chunk.slice(i, i + MAX_CHUNK_LENGTH))
      }
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Chapter & Book Chunking
// ---------------------------------------------------------------------------

/**
 * Split a chapter's plain text into indexed chunks for FTS5.
 *
 * Strategy:
 * 1. Split at paragraph boundaries (\n\n)
 * 2. For paragraphs over MAX_CHUNK_LENGTH, split at sentence boundaries
 * 3. Discard chunks shorter than MIN_CHUNK_LENGTH
 * 4. Assign sequential position numbers
 *
 * @param chapterId - Unique identifier for the chapter
 * @param chapterTitle - Display title of the chapter
 * @param plainText - Pre-extracted plain text (from extractPlainText)
 * @returns Array of ChunkInput objects with sequential positions
 */
export function chunkChapter(
  chapterId: string,
  chapterTitle: string,
  plainText: string,
): ChunkInput[] {
  if (!plainText) return []

  const paragraphs = plainText.split(/\n\n+/)
  const chunks: ChunkInput[] = []
  let pos = 0

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (trimmed.length === 0) continue

    const segments =
      trimmed.length > MAX_CHUNK_LENGTH
        ? splitLongParagraph(trimmed)
        : [trimmed]

    for (const segment of segments) {
      if (segment.length < MIN_CHUNK_LENGTH) continue
      chunks.push({
        bookId: "", // Filled by chunkBook
        chapterId,
        chapterTitle,
        chunkText: segment,
        position: pos++,
      })
    }
  }

  return chunks
}

/**
 * Chunk an entire book, filling in the bookId on every chunk.
 *
 * Processes chapters sequentially, assigning continuous position numbers
 * across chapter boundaries.
 *
 * @param bookId - Unique identifier for the book
 * @param chapters - Array of { id, title, text } from parsed EPUB cache
 * @returns Flat array of ChunkInput objects for the entire book
 */
export function chunkBook(
  bookId: string,
  chapters: Array<{ id: string; title: string; text: string }>,
): ChunkInput[] {
  const allChunks: ChunkInput[] = []

  for (const chapter of chapters) {
    const chapterChunks = chunkChapter(chapter.id, chapter.title, chapter.text)
    for (const chunk of chapterChunks) {
      chunk.bookId = bookId
      allChunks.push(chunk)
    }
  }

  return allChunks
}
