/**
 * Font extraction module for EPUB content.
 *
 * Provides functions for extracting fonts from EPUB files,
 * converting them to base64 data URIs, and generating @font-face CSS rules.
 *
 * @example
 * ```ts
 * import { extractFonts, buildFontFaceCss } from "@/lib/fonts";
 *
 * // Extract fonts from EPUB resources
 * const fonts = extractFonts(epub.resources);
 *
 * // Generate @font-face CSS
 * const fontFaceCss = buildFontFaceCss(fonts);
 * ```
 */

// Types
export type { ExtractedFont, FontExtractionOptions, FontFormat } from "./types";

// Font extraction
export { extractFonts, convertFontToDataUrl, isFontResource } from "./extract";

// Font injection
export { buildFontFaceCss, injectFontFaces } from "./inject";
