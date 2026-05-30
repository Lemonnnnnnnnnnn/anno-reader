/**
 * Metadata extraction module for EPUB files.
 *
 * Provides functions for extracting book metadata (title, author,
 * language, identifier) and cover images from EPUB files, with
 * proper EPUB 3 fallback strategies for cover detection.
 *
 * @example
 * ```ts
 * import { extractBookMetadata, getCoverAsDataUrl } from "@/lib/metadata";
 *
 * // Full metadata extraction (from ArrayBuffer)
 * const metadata = await extractBookMetadata(arrayBuffer);
 * console.log(metadata.title, metadata.author);
 * if (metadata.coverUrl) {
 *   imgElement.src = metadata.coverUrl;
 * }
 *
 * // Cover-only extraction
 * const cover = await getCoverAsDataUrl(arrayBuffer);
 * if (cover.found) {
 *   imgElement.src = cover.dataUrl;
 * }
 * ```
 */

// Main extraction functions
export { extractBookMetadata, extractMetadataFromEpub } from "./extract";
export { getCoverAsDataUrl, getCoverFromEpub } from "./cover";

// Types
export type { ExtractedMetadata, CoverResult } from "./types";
