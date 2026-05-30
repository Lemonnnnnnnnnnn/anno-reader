/**
 * Font extraction from EPUB resources.
 *
 * Scans EPUB manifest resources for font files and converts them
 * to base64 data URIs for use in @font-face rules.
 */

import type { EpubResource } from "epubix";
import type { ExtractedFont, FontExtractionOptions, FontFormat } from "./types";

/** MIME types that indicate font resources */
const FONT_MIME_TYPES = new Set([
  "font/otf",
  "font/ttf",
  "font/woff",
  "font/woff2",
  "application/font-woff",
  "application/font-woff2",
  "application/x-font-ttf",
  "application/x-font-otf",
  "application/vnd.ms-opentype",
  "application/x-font-truetype",
]);

/** Map MIME types to CSS font format strings */
const MIME_TO_FORMAT: Record<string, FontFormat> = {
  "font/woff2": "woff2",
  "font/woff": "woff",
  "font/ttf": "truetype",
  "font/otf": "opentype",
  "application/font-woff": "woff",
  "application/font-woff2": "woff2",
  "application/x-font-ttf": "truetype",
  "application/x-font-otf": "opentype",
  "application/vnd.ms-opentype": "opentype",
  "application/x-font-truetype": "truetype",
};

/** Map file extensions to CSS font format strings */
const EXTENSION_TO_FORMAT: Record<string, FontFormat> = {
  woff2: "woff2",
  woff: "woff",
  ttf: "truetype",
  otf: "opentype",
};

/** Common font weight keywords found in filenames */
const WEIGHT_KEYWORDS: Record<string, string> = {
  thin: "100",
  hairline: "100",
  extralight: "200",
  ultralight: "200",
  light: "300",
  regular: "400",
  normal: "400",
  medium: "500",
  semibold: "600",
  demibold: "600",
  bold: "bold",
  extrabold: "800",
  ultrabold: "800",
  black: "900",
  heavy: "900",
};

/**
 * Extract all fonts from EPUB resources.
 *
 * @param resources - The EPUB's resource map (from epub.resources)
 * @param options - Optional extraction configuration
 * @returns Array of extracted fonts with data URIs
 */
export function extractFonts(
  resources: Record<string, EpubResource>,
  options: FontExtractionOptions = {},
): ExtractedFont[] {
  const { inferMetadata = true } = options;
  const fonts: ExtractedFont[] = [];

  for (const [_id, resource] of Object.entries(resources)) {
    if (!isFontResource(resource)) continue;

    const dataUrl = convertFontToDataUrl(resource);
    if (!dataUrl) continue;

    const format = getFontFormat(resource);
    if (!format) continue;

    const family = options.fontFamily || inferFamilyName(resource.id);
    const metadata = inferMetadata ? inferFontMetadata(resource.id) : {};

    fonts.push({
      id: resource.id,
      family,
      format,
      dataUrl,
      ...metadata,
    });
  }

  return fonts;
}

/**
 * Convert a font resource to a base64 data URI.
 *
 * @param resource - The EPUB resource containing font data
 * @returns Data URI string (e.g., "data:font/woff2;base64,...") or null if conversion fails
 */
export function convertFontToDataUrl(resource: EpubResource): string | null {
  try {
    const mimeType = resource.type || guessMimeTypeFromPath(resource.id);

    if (typeof resource.content === "string") {
      // Content is already base64 encoded
      return `data:${mimeType};base64,${resource.content}`;
    }

    if (resource.content instanceof ArrayBuffer) {
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

/**
 * Check if a resource is a font resource.
 */
export function isFontResource(resource: EpubResource): boolean {
  // Check MIME type
  if (FONT_MIME_TYPES.has(resource.type.toLowerCase())) {
    return true;
  }

  // Check file extension as fallback
  const ext = resource.id.split(".").pop()?.toLowerCase();
  return ext ? ext in EXTENSION_TO_FORMAT : false;
}

// --- Internal helpers ---

/**
 * Get the CSS font format for a resource.
 */
function getFontFormat(resource: EpubResource): FontFormat | null {
  // Try MIME type first
  const mimeFormat = MIME_TO_FORMAT[resource.type.toLowerCase()];
  if (mimeFormat) return mimeFormat;

  // Fall back to file extension
  const ext = resource.id.split(".").pop()?.toLowerCase();
  return ext ? EXTENSION_TO_FORMAT[ext] ?? null : null;
}

/**
 * Infer a font family name from a resource ID/path.
 * Strips directory components and extension, normalizes separators.
 */
function inferFamilyName(resourceId: string): string {
  // Get filename without extension
  const filename = resourceId.split("/").pop() ?? resourceId;
  const nameWithoutExt = filename.replace(/\.[^.]+$/, "");

  // Remove common suffixes like -Regular, -Bold, _Italic, etc.
  const cleaned = nameWithoutExt
    .replace(/[-_](Regular|Bold|Italic|Light|Medium|Semibold|Black|Thin|Hairline|Heavy)/gi, "")
    .replace(/[-_](BoldItalic|BoldOblique|LightItalic)/gi, "")
    .replace(/[-_]/g, " ")
    .trim();

  return cleaned || "Unknown Font";
}

/**
 * Infer font weight and style from filename.
 */
function inferFontMetadata(resourceId: string): { weight?: string; style?: string } {
  const filename = resourceId.toLowerCase();
  const metadata: { weight?: string; style?: string } = {};

  // Check for italic/oblique
  if (filename.includes("italic") || filename.includes("oblique")) {
    metadata.style = "italic";
  }

  // Check for weight keywords
  for (const [keyword, weight] of Object.entries(WEIGHT_KEYWORDS)) {
    if (filename.includes(keyword)) {
      metadata.weight = weight;
      break;
    }
  }

  return metadata;
}

/**
 * Guess MIME type from file path/extension.
 */
function guessMimeTypeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "woff2":
      return "font/woff2";
    case "woff":
      return "font/woff";
    case "ttf":
      return "font/ttf";
    case "otf":
      return "font/otf";
    default:
      return "font/woff2";
  }
}

/**
 * Convert ArrayBuffer to base64 string.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
