/**
 * Image path resolution for EPUB content.
 *
 * Resolves relative image paths in EPUB chapter HTML,
 * looks up images in EPUB resources, and converts them to data URLs.
 */

import type { EpubResource } from "epubix";
import type { ResolvedImage, ImageResolutionOptions, ImageCacheEntry } from "./types";
import { findResourceByHref, normalizePath, resolveRelativePath, extractFilename as extractFilenameBase } from "@/lib/epub/resource-resolver";

/** Regex to match <img> tags and capture src attribute */
const IMG_TAG_RE = /<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi;

/** In-memory cache for resolved images (session-scoped) */
const imageCache = new Map<string, ImageCacheEntry>();

/** Cache TTL: 30 minutes */
const CACHE_TTL = 30 * 60 * 1000;

/**
 * Resolve all image paths in chapter HTML content.
 *
 * Finds all `<img>` tags, resolves their `src` attributes against EPUB resources,
 * and replaces them with base64 data URLs.
 *
 * @param htmlContent - The raw HTML content of the chapter
 * @param resources - The EPUB's resource map (from epub.resources)
 * @param options - Resolution options
 * @returns Modified HTML with resolved image paths
 */
export function resolveImagePaths(
  htmlContent: string,
  resources: Record<string, EpubResource>,
  options: ImageResolutionOptions = {},
): string {
  const { opfFolder = "", chapterHref = "", lazyLoad = true, manifestHrefs = {} } = options;

  // Find all img src attributes
  const imageSrcs = extractImageSrcs(htmlContent);
  if (imageSrcs.length === 0) {
    return htmlContent;
  }

  let resolvedHtml = htmlContent;

  for (const src of imageSrcs) {
    // Skip already-resolved data URLs
    if (src.startsWith("data:")) {
      continue;
    }

    // Skip external URLs (http/https)
    if (src.startsWith("http://") || src.startsWith("https://")) {
      continue;
    }

    // Resolve the image from EPUB resources
    const resolved = resolveImageFromResources(src, resources, chapterHref, opfFolder, manifestHrefs);

    // Replace the src in the HTML
    const escapedSrc = escapeRegex(src);
    const imgTagPattern = new RegExp(
      `(<img[^>]+src\\s*=\\s*["'])${escapedSrc}(["'][^>]*>)`,
      "gi",
    );

    if (resolved.resolved) {
      // Add lazy loading attribute if requested
      let replacement = `$1${resolved.dataUrl}$2`;
      if (lazyLoad && !htmlContent.includes('loading="lazy"')) {
        replacement = `$1${resolved.dataUrl}$2`.replace(
          /(<img[^>]*?)(\/?>)$/,
          '$1 loading="lazy"$2',
        );
      }
      resolvedHtml = resolvedHtml.replace(imgTagPattern, replacement);
    } else {
      // Use fallback placeholder for missing images
      const fallbackDataUrl = createFallbackPlaceholder(src);
      resolvedHtml = resolvedHtml.replace(imgTagPattern, `$1${fallbackDataUrl}$2`);
    }
  }

  return resolvedHtml;
}

/**
 * Resolve a single image path against EPUB resources.
 * Uses common resource resolution plus image-specific fallback strategies.
 *
 * @param src - The image src attribute value
 * @param resources - EPUB resource map
 * @param chapterHref - Chapter's href for relative path resolution
 * @param opfFolder - OPF base folder
 * @param manifestHrefs - Map from normalized file path to manifest resource ID
 * @returns ResolvedImage with data URL or fallback
 */
export function resolveImageFromResources(
  src: string,
  resources: Record<string, EpubResource>,
  chapterHref: string,
  opfFolder: string,
  manifestHrefs: Record<string, string> = {},
): ResolvedImage {
  const normalizedSrc = normalizePath(src);
  const resolvedPath = resolveRelativePath(src, chapterHref, opfFolder);

  // Check cache first
  const cacheKey = resolvedPath || normalizedSrc;
  const cached = getFromCache(cacheKey);
  if (cached) {
    return {
      originalSrc: src,
      dataUrl: cached.dataUrl,
      resolved: true,
      mimeType: cached.mimeType,
    };
  }

  // Strategy 0-3: Use common resource resolution (most reliable)
  const resource = findResourceByHref(src, resources, chapterHref, opfFolder, manifestHrefs, "image/");
  if (resource) {
    const result = buildDataUrlFromResource(resource);
    if (result) {
      addToCache(cacheKey, result.dataUrl, result.mimeType);
      return { originalSrc: src, ...result, resolved: true };
    }
  }

  // Strategy 4-5: Image-specific fallback strategies
  for (const [_id, resource] of Object.entries(resources)) {
    if (!resource.type.startsWith("image/")) continue;

    // Strategy 4: Filename match — resource ID often equals the filename
    // e.g., resource.id="cover.jpg" should match resolvedPath="OEBPS/images/cover.jpg"
    const srcFilename = extractFilename(resolvedPath || normalizedSrc);
    if (srcFilename && resource.id.toLowerCase() === srcFilename.toLowerCase()) {
      const result = buildDataUrlFromResource(resource);
      if (result) {
        addToCache(cacheKey, result.dataUrl, result.mimeType);
        return { originalSrc: src, ...result, resolved: true };
      }
    }

    // Strategy 5: Resource ID contained in path or path contained in resource ID
    // Handles cases like id="images/cover" matching src="images/cover.jpg"
    const normalizedResourceId = normalizePath(resource.id);
    const normalizedResolved = normalizePath(resolvedPath || normalizedSrc);
    if (
      normalizedResolved.includes(normalizedResourceId) ||
      normalizedResourceId.includes(normalizedResolved.replace(/\.[^.]+$/, ""))
    ) {
      const result = buildDataUrlFromResource(resource);
      if (result) {
        addToCache(cacheKey, result.dataUrl, result.mimeType);
        return { originalSrc: src, ...result, resolved: true };
      }
    }
  }

  // Image not found in resources
  return {
    originalSrc: src,
    dataUrl: createFallbackPlaceholder(src),
    resolved: false,
  };
}

/**
 * Convert a single image resource to a base64 data URL.
 *
 * @param resource - The EPUB resource containing image data
 * @returns Object with dataUrl and mimeType, or null if conversion fails
 */
export function buildDataUrlFromResource(
  resource: EpubResource,
): { dataUrl: string; mimeType: string } | null {
  try {
    const mimeType = resource.type;

    if (typeof resource.content === "string") {
      // Content is already base64 encoded
      return {
        dataUrl: `data:${mimeType};base64,${resource.content}`,
        mimeType,
      };
    }

    if (resource.content instanceof ArrayBuffer) {
      // Convert ArrayBuffer to base64
      const base64 = arrayBufferToBase64(resource.content);
      return {
        dataUrl: `data:${mimeType};base64,${base64}`,
        mimeType,
      };
    }

    // Check if it's a Uint8Array (common in epubix)
    if (
      resource.content &&
      typeof resource.content === "object" &&
      "buffer" in resource.content
    ) {
      const buffer = (resource.content as Uint8Array).buffer;
      const base64 = arrayBufferToBase64(buffer);
      return {
        dataUrl: `data:${mimeType};base64,${base64}`,
        mimeType,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Create a fallback placeholder for missing images.
 * Returns a small SVG data URL with the image name.
 */
export function createFallbackPlaceholder(src: string): string {
  const fileName = src.split("/").pop() || "image";
  const truncatedName = fileName.length > 20 ? fileName.slice(0, 17) + "..." : fileName;

  // Create a simple SVG placeholder
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">
    <rect fill="#f3f4f6" width="200" height="150"/>
    <text fill="#9ca3af" font-family="system-ui" font-size="12" text-anchor="middle" x="100" y="70">Image not found</text>
    <text fill="#d1d5db" font-family="system-ui" font-size="10" text-anchor="middle" x="100" y="90">${escapeXml(truncatedName)}</text>
  </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Clear the image cache (useful for memory management).
 */
export function clearImageCache(): void {
  imageCache.clear();
}

/**
 * Get cache statistics.
 */
export function getImageCacheStats(): { size: number; entries: number } {
  let totalSize = 0;
  for (const entry of imageCache.values()) {
    totalSize += entry.dataUrl.length;
  }
  return {
    size: totalSize,
    entries: imageCache.size,
  };
}

// --- Internal helpers ---

/** Extract all img src values from HTML */
function extractImageSrcs(htmlContent: string): string[] {
  const srcs: string[] = [];
  let match: RegExpExecArray | null;

  IMG_TAG_RE.lastIndex = 0;
  while ((match = IMG_TAG_RE.exec(htmlContent)) !== null) {
    srcs.push(match[1]);
  }

  return srcs;
}

/**
 * Extract filename from a path (with extension).
 * Wraps the base utility to keep the original behavior for image matching.
 */
function extractFilename(path: string): string | null {
  if (!path) return null;
  const parts = path.split("/");
  return parts[parts.length - 1] || null;
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

/** Escape special regex characters in a string */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Escape XML special characters */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Get entry from cache if still valid */
function getFromCache(key: string): ImageCacheEntry | null {
  const entry = imageCache.get(key);
  if (!entry) return null;

  // Check if cache entry has expired
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    imageCache.delete(key);
    return null;
  }

  return entry;
}

/** Add entry to cache */
function addToCache(key: string, dataUrl: string, mimeType: string): void {
  imageCache.set(key, {
    dataUrl,
    mimeType,
    timestamp: Date.now(),
  });
}
