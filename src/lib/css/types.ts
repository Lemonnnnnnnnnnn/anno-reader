/**
 * Types for the CSS injection module.
 * Handles CSS extraction from EPUBs and injection into the reader iframe.
 */

/** A parsed stylesheet reference found in EPUB chapter HTML */
export interface EpubStyleSheet {
  /** The resolved href path within the EPUB zip (e.g., "OEBPS/Styles/style.css") */
  href: string;
  /** The CSS content as a string */
  content: string;
  /** Whether this was an inline <style> block or external <link> */
  source: "inline" | "external";
}

/** Options for CSS injection into the iframe */
export interface CssInjectionOptions {
  /** Base/reader CSS to apply (always injected first) */
  baseCss: string;
  /** EPUB-extracted CSS to inject after base CSS */
  epubCss: string[];
  /** @font-face CSS rules for EPUB fonts (injected before epubCss) */
  fontFaceCss?: string;
  /** Whether to scope EPUB CSS to prevent conflicts with reader defaults (default: true) */
  isolateEpubCss?: boolean;
}

/** Result of building an iframe srcdoc with CSS */
export interface SrcdocResult {
  /** The complete HTML string for iframe srcdoc attribute */
  html: string;
  /** Number of CSS stylesheets injected */
  stylesheetCount: number;
  /** Whether EPUB CSS was isolated with namespace scoping */
  wasIsolated: boolean;
}
