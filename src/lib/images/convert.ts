/**
 * Image conversion utilities for EPUB content.
 *
 * Provides functions for converting images to base64 data URLs,
 * with support for various image formats and error handling.
 */

import type { EpubResource } from "epubix";

/** Supported image MIME types */
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/tiff",
]);

/** Map file extensions to MIME types */
const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
};

/**
 * Convert an image resource to a base64 data URL.
 *
 * @param resource - The EPUB resource containing image data
 * @returns Data URL string (e.g., "data:image/jpeg;base64,...")
 * @throws {Error} If the resource is not an image or cannot be converted
 */
export function convertImageToDataUrl(resource: EpubResource): string {
  if (!resource.type.startsWith("image/")) {
    throw new Error(`Resource is not an image: ${resource.type}`);
  }

  if (!isSupportedImageType(resource.type)) {
    throw new Error(`Unsupported image type: ${resource.type}`);
  }

  const result = buildDataUrl(resource);
  if (!result) {
    throw new Error(`Failed to convert image resource: ${resource.id}`);
  }

  return result;
}

/**
 * Convert an ArrayBuffer to a base64 data URL with the given MIME type.
 *
 * @param buffer - The image data as an ArrayBuffer
 * @param mimeType - The MIME type of the image
 * @returns Data URL string
 */
export function arrayBufferToDataUrl(buffer: ArrayBuffer, mimeType: string): string {
  const base64 = arrayBufferToBase64(buffer);
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Convert a base64 string to a data URL.
 *
 * @param base64 - The base64 encoded image data
 * @param mimeType - The MIME type of the image
 * @returns Data URL string
 */
export function base64ToDataUrl(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Extract MIME type from a data URL.
 *
 * @param dataUrl - The data URL to parse
 * @returns The MIME type, or null if parsing fails
 */
export function extractMimeTypeFromDataUrl(dataUrl: string): string | null {
  const match = dataUrl.match(/^data:([^;]+);base64,/);
  return match ? match[1] : null;
}

/**
 * Guess MIME type from a file path or URL.
 *
 * @param path - The file path or URL
 * @returns The guessed MIME type, or "image/jpeg" as default
 */
export function guessMimeType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext && ext in EXTENSION_TO_MIME) {
    return EXTENSION_TO_MIME[ext];
  }
  return "image/jpeg";
}

/**
 * Check if a MIME type is a supported image type.
 *
 * @param mimeType - The MIME type to check
 * @returns True if the type is supported
 */
export function isSupportedImageType(mimeType: string): boolean {
  return SUPPORTED_IMAGE_TYPES.has(mimeType.toLowerCase());
}

/**
 * Check if a string is a data URL.
 *
 * @param str - The string to check
 * @returns True if the string is a data URL
 */
export function isDataUrl(str: string): boolean {
  return str.startsWith("data:");
}

/**
 * Check if a string is an external URL (http/https).
 *
 * @param str - The string to check
 * @returns True if the string is an external URL
 */
export function isExternalUrl(str: string): boolean {
  return str.startsWith("http://") || str.startsWith("https://");
}

/**
 * Validate that a data URL contains valid image data.
 *
 * @param dataUrl - The data URL to validate
 * @returns True if the data URL appears to be a valid image
 */
export function isValidImageDataUrl(dataUrl: string): boolean {
  if (!isDataUrl(dataUrl)) {
    return false;
  }

  const mimeType = extractMimeTypeFromDataUrl(dataUrl);
  if (!mimeType) {
    return false;
  }

  return isSupportedImageType(mimeType);
}

/**
 * Calculate the approximate size of a base64 encoded string in bytes.
 *
 * @param base64 - The base64 string
 * @returns Approximate size in bytes
 */
export function estimateBase64Size(base64: string): number {
  // Remove data URL prefix if present
  const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, "");
  // Base64 encodes 3 bytes into 4 characters
  return Math.floor((cleanBase64.length * 3) / 4);
}

// --- Internal helpers ---

/** Build a data URL from an image resource */
function buildDataUrl(resource: EpubResource): string | null {
  try {
    const mimeType = resource.type;

    if (typeof resource.content === "string") {
      // Content is already base64 encoded
      return `data:${mimeType};base64,${resource.content}`;
    }

    if (resource.content instanceof ArrayBuffer) {
      // Convert ArrayBuffer to base64
      const base64 = arrayBufferToBase64(resource.content);
      return `data:${mimeType};base64,${base64}`;
    }

    // Check if it's a Uint8Array (common in epubix)
    if (
      resource.content &&
      typeof resource.content === "object" &&
      "buffer" in resource.content
    ) {
      const buffer = (resource.content as Uint8Array).buffer;
      const base64 = arrayBufferToBase64(buffer);
      return `data:${mimeType};base64,${base64}`;
    }

    return null;
  } catch {
    return null;
  }
}

/** Convert ArrayBuffer to base64 string */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
