/**
 * Image resolution module for EPUB content.
 *
 * Provides functions for resolving image paths in EPUB chapters,
 * converting images to base64 data URLs, and handling missing images.
 *
 * @example
 * ```ts
 * import { resolveImagePaths, convertImageToDataUrl } from "@/lib/images";
 *
 * // Resolve all images in chapter HTML
 * const resolvedHtml = resolveImagePaths(chapter.content, epub.resources, {
 *   opfFolder: epub.opfFolder,
 *   chapterHref: chapter.href,
 * });
 *
 * // Convert a single image resource to data URL
 * const dataUrl = convertImageToDataUrl(imageResource);
 * ```
 */

// Types
export type {
  ResolvedImage,
  ImageResolutionOptions,
  ImageCacheEntry,
} from "./types";

// Image resolution
export {
  resolveImagePaths,
  resolveImageFromResources,
  buildDataUrlFromResource,
  createFallbackPlaceholder,
  clearImageCache,
  getImageCacheStats,
} from "./resolve";

// Image conversion
export {
  convertImageToDataUrl,
  arrayBufferToDataUrl,
  base64ToDataUrl,
  extractMimeTypeFromDataUrl,
  guessMimeType,
  isSupportedImageType,
  isDataUrl,
  isExternalUrl,
  isValidImageDataUrl,
  estimateBase64Size,
} from "./convert";
