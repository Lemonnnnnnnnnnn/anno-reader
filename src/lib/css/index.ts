/**
 * CSS injection module for EPUB content.
 *
 * Provides functions for extracting CSS from EPUB files,
 * injecting it into the reader iframe with proper isolation,
 * and handling CSS conflicts between EPUB and reader styles.
 *
 * @example
 * ```ts
 * import { extractCssFromChapter, buildSrcdoc } from "@/lib/css";
 *
 * // Extract CSS from a chapter
 * const epubCss = extractCssFromChapter(chapter.content, epub.resources, chapter.href, epub.opfFolder);
 *
 * // Build srcdoc with EPUB CSS injected
 * const { html } = buildSrcdoc(chapter.content, { baseCss: DEFAULT_BASE_CSS, epubCss });
 * ```
 */

// Types
export type {
  EpubStyleSheet,
  CssInjectionOptions,
  SrcdocResult,
} from "./types";

// CSS extraction
export {
  extractCssFromChapter,
  extractCssStrings,
  extractAllCssFromResources,
} from "./extract";

// CSS isolation
export {
  sanitizeEpubCss,
  scopeCssToNamespace,
  buildReaderOverrides,
  combineCss,
  isolateEpubCss,
} from "./isolation";

// CSS injection
export {
  DEFAULT_BASE_CSS,
  buildSrcdoc,
  injectCssIntoIframe,
  injectMultipleCssIntoIframe,
} from "./inject";
