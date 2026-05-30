/**
 * CSS extraction from EPUB chapter HTML and resources.
 *
 * Parses chapter HTML to find <link> and <style> elements,
 * resolves external stylesheet paths, and fetches content from EPUB resources.
 */

import type { EpubStyleSheet } from "./types";
import type { EpubResource } from "epubix";

/**
 * Extract all CSS from a chapter's HTML content and EPUB resources.
 *
 * Scans the chapter HTML for:
 * - `<link rel="stylesheet" href="...">` tags → resolved against EPUB resources
 * - `<style>` blocks → extracted inline
 *
 * @param htmlContent - The raw HTML content of the chapter
 * @param resources - The EPUB's resource map (from epub.resources)
 * @param chapterHref - The chapter's href for resolving relative paths (e.g., "Text/chapter1.xhtml")
 * @param opfFolder - The OPF base folder for path resolution (e.g., "OEBPS/")
 * @returns Array of extracted stylesheets
 */
export function extractCssFromChapter(
  htmlContent: string,
  resources: Record<string, EpubResource>,
  chapterHref: string,
  opfFolder: string,
): EpubStyleSheet[] {
  const stylesheets: EpubStyleSheet[] = [];

  // Extract inline <style> blocks
  const inlineStyles = extractInlineStyles(htmlContent);
  stylesheets.push(...inlineStyles);

  // Extract external <link> stylesheet references
  const externalStyles = extractExternalStyles(htmlContent, resources, chapterHref, opfFolder);
  stylesheets.push(...externalStyles);

  return stylesheets;
}

/**
 * Extract CSS content strings from a chapter (convenience function).
 * Returns just the CSS text, ready for injection.
 *
 * @param htmlContent - The raw HTML content of the chapter
 * @param resources - The EPUB's resource map
 * @param chapterHref - The chapter's href for resolving relative paths
 * @param opfFolder - The OPF base folder
 * @returns Array of CSS content strings
 */
export function extractCssStrings(
  htmlContent: string,
  resources: Record<string, EpubResource>,
  chapterHref: string,
  opfFolder: string,
): string[] {
  return extractCssFromChapter(htmlContent, resources, chapterHref, opfFolder).map(
    (s) => s.content,
  );
}

/**
 * Extract all CSS resources from an EPUB (for global stylesheet injection).
 * Useful for stylesheets that apply across all chapters.
 *
 * @param resources - The EPUB's resource map
 * @returns Array of CSS content strings from resources with type "text/css"
 */
export function extractAllCssFromResources(
  resources: Record<string, EpubResource>,
): EpubStyleSheet[] {
  const stylesheets: EpubStyleSheet[] = [];

  for (const [_id, resource] of Object.entries(resources)) {
    if (resource.type === "text/css" && typeof resource.content === "string") {
      stylesheets.push({
        href: resource.id,
        content: resource.content,
        source: "external",
      });
    }
  }

  return stylesheets;
}

// --- Internal helpers ---

/** Regex to match <style> tags and capture their content */
const STYLE_TAG_RE = /<style[^>]*>([\s\S]*?)<\/style>/gi;

/** Regex to match <link rel="stylesheet" href="..."> tags */
const LINK_STYLE_RE = /<link[^>]+rel\s*=\s*["']stylesheet["'][^>]+href\s*=\s*["']([^"']+)["'][^>]*>/gi;

/** Also match <link> tags where href comes before rel */
const LINK_STYLE_RE_ALT = /<link[^>]+href\s*=\s*["']([^"']+)["'][^>]+rel\s*=\s*["']stylesheet["'][^>]*>/gi;

/**
 * Extract inline <style> block content from HTML.
 */
function extractInlineStyles(htmlContent: string): EpubStyleSheet[] {
  const styles: EpubStyleSheet[] = [];
  let match: RegExpExecArray | null;

  STYLE_TAG_RE.lastIndex = 0;
  while ((match = STYLE_TAG_RE.exec(htmlContent)) !== null) {
    const cssContent = match[1].trim();
    if (cssContent) {
      styles.push({
        href: "",
        content: cssContent,
        source: "inline",
      });
    }
  }

  return styles;
}

/**
 * Extract external <link rel="stylesheet"> references and resolve their content
 * from EPUB resources.
 */
function extractExternalStyles(
  htmlContent: string,
  resources: Record<string, EpubResource>,
  chapterHref: string,
  opfFolder: string,
): EpubStyleSheet[] {
  const styles: EpubStyleSheet[] = [];
  const seenHrefs = new Set<string>();

  // Collect hrefs from both regex patterns
  const hrefs = collectStylesheetHrefs(htmlContent);

  for (const href of hrefs) {
    const normalizedHref = normalizeHref(href);
    if (seenHrefs.has(normalizedHref)) continue;
    seenHrefs.add(normalizedHref);

    // Try to find the CSS content in resources
    const cssContent = resolveCssFromResources(href, resources, chapterHref, opfFolder);
    if (cssContent) {
      styles.push({
        href: normalizedHref,
        content: cssContent,
        source: "external",
      });
    }
  }

  return styles;
}

/**
 * Collect all stylesheet href values from <link> tags in HTML.
 */
function collectStylesheetHrefs(htmlContent: string): string[] {
  const hrefs: string[] = [];
  let match: RegExpExecArray | null;

  // Pattern 1: rel before href
  LINK_STYLE_RE.lastIndex = 0;
  while ((match = LINK_STYLE_RE.exec(htmlContent)) !== null) {
    hrefs.push(match[1]);
  }

  // Pattern 2: href before rel
  LINK_STYLE_RE_ALT.lastIndex = 0;
  while ((match = LINK_STYLE_RE_ALT.exec(htmlContent)) !== null) {
    hrefs.push(match[1]);
  }

  return hrefs;
}

/**
 * Resolve a CSS href to its content from EPUB resources.
 * Tries multiple resolution strategies:
 * 1. Direct match by resource ID
 * 2. Match by normalized path
 * 3. Match against href field in manifest
 */
function resolveCssFromResources(
  cssHref: string,
  resources: Record<string, EpubResource>,
  chapterHref: string,
  opfFolder: string,
): string | null {
  const normalizedCssPath = normalizeHref(cssHref);
  const resolvedPath = resolveRelativeHref(cssHref, chapterHref, opfFolder);

  for (const [_id, resource] of Object.entries(resources)) {
    if (resource.type !== "text/css" || typeof resource.content !== "string") continue;

    // Strategy 1: Direct ID match
    if (resource.id === normalizedCssPath || resource.id === cssHref) {
      return resource.content;
    }

    // Strategy 2: Normalized path match against resource ID
    if (normalizeHref(resource.id) === normalizedCssPath) {
      return resource.content;
    }

    // Strategy 3: Match against resolved absolute path
    if (resolvedPath && normalizeHref(resource.id) === normalizeHref(resolvedPath)) {
      return resource.content;
    }
  }

  return null;
}

/**
 * Resolve a relative href against a chapter's location within the EPUB.
 *
 * @example
 * resolveRelativeHref("../Styles/main.css", "Text/chapter1.xhtml", "OEBPS/")
 * // → "OEBPS/Styles/main.css"
 */
function resolveRelativeHref(
  cssHref: string,
  chapterHref: string,
  opfFolder: string,
): string | null {
  // If already absolute (starts with /), use as-is
  if (cssHref.startsWith("/")) {
    return cssHref.slice(1);
  }

  // Get the directory of the chapter within the OPF folder
  const chapterDir = chapterHref.includes("/")
    ? chapterHref.substring(0, chapterHref.lastIndexOf("/"))
    : "";

  // Resolve relative path
  const baseDir = chapterDir ? `${opfFolder}${chapterDir}` : opfFolder;
  const resolved = resolvePath(baseDir, cssHref);

  return resolved;
}

/**
 * Simple path resolution for EPUB internal paths.
 * Handles ./ and ../ segments.
 */
function resolvePath(base: string, relative: string): string {
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
 * Normalize an href for comparison (strip leading ./ and ../, lowercase).
 */
function normalizeHref(href: string): string {
  return href.replace(/^(\.\.?\/)+/, "").toLowerCase();
}
