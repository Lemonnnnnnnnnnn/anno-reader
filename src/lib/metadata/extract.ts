/**
 * Main metadata extraction from EPUB files.
 *
 * Wraps the lower-level epub parser to provide a clean, single-call
 * metadata extraction API that returns title, author, language,
 * identifier, and cover image as a base64 data URI.
 */

import { loadEpubBook, type Epub } from "epubix";
import { getCoverFromEpub } from "./cover";
import type { ExtractedMetadata } from "./types";

const DEFAULT_TITLE = "Unknown Title";
const DEFAULT_AUTHOR = "Unknown Author";

/**
 * Extract all book metadata from an already-loaded Epub instance.
 * Combines text metadata extraction with cover image retrieval.
 *
 * @param epub - A loaded epubix Epub instance
 * @returns ExtractedMetadata with all fields populated
 */
export async function extractMetadataFromEpub(
  epub: Epub
): Promise<ExtractedMetadata> {
  const title = epub.metadata.title ?? DEFAULT_TITLE;
  const author = epub.metadata.author ?? DEFAULT_AUTHOR;
  const language = epub.metadata.language ?? "";
  const identifier = epub.metadata.identifier ?? "";

  const cover = await getCoverFromEpub(epub);

  return {
    title,
    author,
    language,
    identifier,
    coverUrl: cover.dataUrl,
  };
}

/**
 * Extract all book metadata directly from an EPUB ArrayBuffer.
 * This is the main entry point for metadata extraction.
 *
 * Loads the EPUB, extracts title, author, language, identifier,
 * and cover image (with EPUB 3 fallback), returning everything
 * in a single ExtractedMetadata object.
 *
 * @param arrayBuffer - The EPUB file as an ArrayBuffer
 * @returns ExtractedMetadata with all fields populated
 * @throws {Error} If the file cannot be loaded as an EPUB
 */
export async function extractBookMetadata(
  arrayBuffer: ArrayBuffer
): Promise<ExtractedMetadata> {
  let epub: Epub;
  try {
    epub = await loadEpubBook(arrayBuffer);
  } catch (err) {
    throw new Error(
      `Failed to load EPUB for metadata extraction: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return extractMetadataFromEpub(epub);
}
