/**
 * Common EPUB resource resolution logic.
 *
 * Provides shared utilities for resolving hrefs to EPUB resources (CSS, images, fonts).
 * This module handles the mismatch between manifest IDs (used as resource keys in epubix)
 * and manifest hrefs (used in HTML <link> and <img> tags).
 *
 * @module
 */

import type { EpubResource } from "epubix";

/**
 * Normalize a path for comparison.
 * Strips leading ./ and ../ segments and lowercases for case-insensitive matching.
 *
 * @param path - The path to normalize
 * @returns Normalized path
 *
 * @example
 * normalizePath("./styles/main.css") // → "styles/main.css"
 * normalizePath("../OEBPS/images/cover.jpg") // → "oebps/images/cover.jpg"
 */
export function normalizePath(path: string): string {
  return path.replace(/^(\.\.?\/)+/, "").toLowerCase();
}

/**
 * Resolve a relative href against a chapter's location within the EPUB.
 *
 * @param href - The relative href to resolve (e.g., "../Styles/main.css")
 * @param chapterHref - The chapter's href within the EPUB (e.g., "Text/chapter1.xhtml")
 * @param opfFolder - The OPF base folder (e.g., "OEBPS/")
 * @returns Resolved absolute path within the EPUB, or null if resolution fails
 *
 * @example
 * resolveRelativePath("../Styles/main.css", "Text/chapter1.xhtml", "OEBPS/")
 * // → "OEBPS/Styles/main.css"
 */
export function resolveRelativePath(
  href: string,
  chapterHref: string,
  opfFolder: string,
): string | null {
  // If already absolute (starts with /), use as-is
  if (href.startsWith("/")) {
    return href.slice(1);
  }

  // Get the directory of the chapter within the OPF folder
  const chapterDir = chapterHref.includes("/")
    ? chapterHref.substring(0, chapterHref.lastIndexOf("/"))
    : "";

  // Resolve relative path
  const baseDir = chapterDir ? `${opfFolder}${chapterDir}` : opfFolder;
  return resolvePath(baseDir, href);
}

/**
 * Simple path resolution for EPUB internal paths.
 * Handles ./ and ../ segments in relative paths.
 *
 * @param base - The base directory path
 * @param relative - The relative path to resolve
 * @returns Resolved path
 *
 * @example
 * resolvePath("OEBPS/Text/", "../Styles/main.css") // → "OEBPS/Styles/main.css"
 */
export function resolvePath(base: string, relative: string): string {
  // Combine base and relative
  const combined = base.endsWith("/") ? `${base}${relative}` : `${base}/${relative}`;

  // Split into segments and resolve
  const segments = combined.split("/");
  const resolved: string[] = [];

  for (const segment of segments) {
    if (segment === "." || segment === "") continue;
    if (segment === "..") {
      resolved.pop();
    } else {
      resolved.push(segment);
    }
  }

  return resolved.join("/");
}

/**
 * Find a resource in the EPUB resource map by href.
 *
 * Uses multiple resolution strategies to handle the mismatch between
 * manifest IDs (used as resource keys in epubix) and manifest hrefs
 * (used in HTML <link> and <img> tags):
 *
 * 1. **Manifest href mapping** (most reliable) - Uses the pre-built manifestHrefs map
 * 2. **Direct ID match** - Compares href directly with resource ID
 * 3. **Normalized path match** - Compares normalized paths
 * 4. **Resolved absolute path match** - Resolves relative path and compares
 *
 * @param href - The href to look up (from HTML src/href attribute)
 * @param resources - The EPUB's resource map (from epub.resources)
 * @param chapterHref - The chapter's href for relative path resolution
 * @param opfFolder - The OPF base folder for path resolution
 * @param manifestHrefs - Map from normalized file path to manifest resource ID
 * @param resourceType - Optional MIME type filter (e.g., "text/css", "image/")
 * @returns The matching EpubResource, or null if not found
 *
 * @example
 * const resource = findResourceByHref(
 *   "css/styles.css",
 *   epub.resources,
 *   "Text/chapter1.xhtml",
 *   "OEBPS/",
 *   manifestHrefs,
 *   "text/css"
 * );
 */
export function findResourceByHref(
  href: string,
  resources: Record<string, EpubResource>,
  chapterHref: string,
  opfFolder: string,
  manifestHrefs: Record<string, string> = {},
  resourceType?: string,
): EpubResource | null {
  const normalizedHref = normalizePath(href);
  const resolvedPath = resolveRelativePath(href, chapterHref, opfFolder);

  // Strategy 0: Use manifest href mapping (most reliable)
  // This handles the common case where manifest ID differs from href
  if (resolvedPath) {
    const normalizedResolved = normalizePath(resolvedPath);
    const resourceId = manifestHrefs[normalizedResolved] || manifestHrefs[normalizedHref];
    if (resourceId && resources[resourceId]) {
      const resource = resources[resourceId];
      if (!resourceType || resource.type.startsWith(resourceType)) {
        return resource;
      }
    }
  }

  // Strategy 1-3: Direct matching against resource entries
  for (const [_id, resource] of Object.entries(resources)) {
    // Filter by resource type if specified
    if (resourceType && !resource.type.startsWith(resourceType)) continue;

    // Strategy 1: Direct ID match (exact)
    if (resource.id === normalizedHref || resource.id === href) {
      return resource;
    }

    // Strategy 2: Normalized path match against resource ID
    if (normalizePath(resource.id) === normalizedHref) {
      return resource;
    }

    // Strategy 3: Match against resolved absolute path
    if (resolvedPath && normalizePath(resource.id) === normalizePath(resolvedPath)) {
      return resource;
    }
  }

  return null;
}

/**
 * Extract filename from a path (without extension).
 *
 * @param path - The path to extract filename from
 * @returns The filename, or null if path is empty
 *
 * @example
 * extractFilename("OEBPS/images/cover.jpg") // → "cover"
 */
export function extractFilename(path: string): string | null {
  if (!path) return null;
  const parts = path.split("/");
  const filename = parts[parts.length - 1];
  // Remove extension
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex > 0 ? filename.substring(0, dotIndex) : filename;
}
