/**
 * CSS injection into iframe srcdoc.
 *
 * Builds a complete HTML document with properly layered CSS:
 * 1. Reader base CSS (always first)
 * 2. Reader layout overrides (after EPUB CSS to prevent breakage)
 * 3. EPUB-extracted CSS (middle, scoped if isolation enabled)
 *
 * CSS layering order ensures the reading experience is consistent
 * while still respecting EPUB typography and formatting.
 */

import type { CssInjectionOptions, SrcdocResult } from "./types";
import {
  isolateEpubCss,
  combineCss,
  buildReaderOverrides,
  sanitizeEpubCss,
} from "./isolation";

/**
 * Default base CSS for the reader iframe.
 * Provides clean typography and layout without conflicting with EPUB styles.
 */
export const DEFAULT_BASE_CSS = `
  body {
    margin: 0;
    padding: 2rem 3rem;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 18px;
    line-height: 1.8;
    color: #1a1a1a;
    background: #fafafa;
    max-width: 700px;
    margin-left: auto;
    margin-right: auto;
  }

  img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 1em auto;
    object-fit: contain;
  }

  img[loading="lazy"] {
    opacity: 0;
    transition: opacity 0.3s ease-in-out;
  }

  img.loaded,
  img[loading="lazy"]:not([src^="data:image/svg"]) {
    opacity: 1;
  }

  p {
    margin-bottom: 1em;
  }

  h1, h2, h3, h4, h5, h6 {
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    line-height: 1.3;
  }
`;

/**
 * Build a complete HTML document for iframe srcdoc with layered CSS.
 *
 * CSS injection order:
 * 1. Base reader CSS (typography, layout)
 * 2. EPUB CSS (scoped if isolation enabled)
 * 3. Reader overrides (enforces critical properties with !important)
 *
 * @param htmlContent - The chapter HTML body content
 * @param options - CSS injection configuration
 * @returns SrcdocResult with the complete HTML string
 */
export function buildSrcdoc(
  htmlContent: string,
  options: CssInjectionOptions,
): SrcdocResult {
  const {
    baseCss = DEFAULT_BASE_CSS,
    epubCss = [],
    fontFaceCss,
    isolateEpubCss: shouldIsolate = true,
  } = options;

  // Process EPUB CSS
  const processedEpubCss = epubCss.map((css) =>
    shouldIsolate ? isolateEpubCss(css) : sanitizeEpubCss(css),
  );

  const epubCssCombined = combineCss(processedEpubCss);
  const readerOverrides = buildReaderOverrides();

  // Build the CSS injection order
  // Font-face rules go before EPUB CSS so fonts are available for EPUB styles
  const cssBlocks: string[] = [baseCss];
  if (fontFaceCss) {
    cssBlocks.push(fontFaceCss);
  }
  if (epubCssCombined) {
    cssBlocks.push(epubCssCombined);
  }
  cssBlocks.push(readerOverrides);

  const combinedCss = cssBlocks.join("\n\n");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${combinedCss}</style>
</head>
<body class="epub-content">${htmlContent}</body>
</html>`;

  return {
    html,
    stylesheetCount: 1 + (epubCss.length > 0 ? 1 : 0),
    wasIsolated: shouldIsolate,
  };
}

/**
 * Inject CSS into an existing iframe element (post-render).
 * Useful for dynamically updating styles without re-rendering the iframe.
 *
 * @param iframe - The target iframe element
 * @param cssContent - CSS string to inject
 * @param id - Optional ID for the style element (allows replacement)
 */
export function injectCssIntoIframe(
  iframe: HTMLIFrameElement,
  cssContent: string,
  id = "epub-injected-css",
): void {
  const doc = iframe.contentDocument;
  if (!doc) return;

  // Remove existing injected style with same ID
  const existing = doc.getElementById(id);
  if (existing) {
    existing.remove();
  }

  // Create and inject new style element
  const style = doc.createElement("style");
  style.id = id;
  style.textContent = cssContent;
  doc.head.appendChild(style);
}

/**
 * Inject multiple CSS blocks into an iframe as separate <style> elements.
 * Each block gets a numbered ID for easy removal/replacement.
 *
 * @param iframe - The target iframe element
 * @param cssBlocks - Array of CSS strings to inject
 * @param prefix - ID prefix for the style elements
 */
export function injectMultipleCssIntoIframe(
  iframe: HTMLIFrameElement,
  cssBlocks: string[],
  prefix = "epub-css",
): void {
  const doc = iframe.contentDocument;
  if (!doc) return;

  // Remove all previously injected styles with this prefix
  doc.querySelectorAll(`style[id^="${prefix}"]`).forEach((el) => el.remove());

  // Inject each CSS block
  cssBlocks.forEach((css, index) => {
    if (!css.trim()) return;

    const style = doc.createElement("style");
    style.id = `${prefix}-${index}`;
    style.textContent = css;
    doc.head.appendChild(style);
  });
}
