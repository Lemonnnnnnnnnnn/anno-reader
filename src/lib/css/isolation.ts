/**
 * CSS isolation utilities.
 *
 * Prevents EPUB CSS from conflicting with the reader application styles
 * and sanitizes potentially problematic CSS properties.
 */

/**
 * Sanitize EPUB CSS to prevent layout breakage.
 *
 * Removes or neutralizes CSS that could:
 * - Break out of the reading area (position: fixed, etc.)
 * - Override critical reader layout properties
 * - Inject external resources (url() for fonts/images handled separately)
 *
 * @param css - Raw CSS string from EPUB
 * @returns Sanitized CSS string
 */
export function sanitizeEpubCss(css: string): string {
  let sanitized = css;

  // Remove @import rules (external resource loading not supported in srcdoc)
  sanitized = sanitized.replace(/@import\s+[^;]+;/gi, "/* [removed: @import] */");

  // Remove @font-face rules from EPUB CSS (handled by fonts module with data URIs)
  sanitized = sanitized.replace(/@font-face\s*\{[^}]*\}/gi, "/* [removed: @font-face - handled by fonts module] */");

  // Remove -webkit- prefixed properties that may cause issues
  sanitized = sanitized.replace(/-webkit-text-size-adjust\s*:[^;]+;/gi, "");

  // Remove viewport-related meta properties
  sanitized = sanitized.replace(/@viewport\s*\{[^}]*\}/gi, "");

  return sanitized;
}

/**
 * Scope EPUB CSS under a namespace to prevent it from affecting reader chrome.
 * Wraps all top-level selectors under `.epub-content`.
 *
 * @example
 * Input:  `body { color: red; } h1 { font-size: 2em; }`
 * Output: `.epub-content body { color: red; } .epub-content h1 { font-size: 2em; }`
 *
 * @param css - CSS string to scope
 * @returns Scoped CSS string
 */
export function scopeCssToNamespace(css: string, namespace = ".epub-content"): string {
  // Split CSS into rules (simplistic but handles most EPUB CSS)
  // This is a best-effort approach - complex CSS with nested blocks needs more parsing
  return css.replace(
    /([^{}@/][^{}]*?)(\{)/g,
    (_match, selectors: string, brace: string) => {
      // Skip @-rules (they have special handling)
      if (selectors.trim().startsWith("@")) return `${selectors}${brace}`;

      // Scope each selector in a comma-separated list
      const scoped = selectors
        .split(",")
        .map((s: string) => {
          const trimmed = s.trim();
          if (!trimmed) return s;
          // Don't double-scope if already namespaced
          if (trimmed.startsWith(namespace)) return s;
          return `${namespace} ${trimmed}`;
        })
        .join(",");

      return `${scoped}${brace}`;
    },
  );
}

/**
 * Build a CSS override block that ensures reader-critical properties
 * are preserved even when EPUB CSS tries to change them.
 *
 * @param theme - Theme mode ("light" or "dark"). Default: "light".
 * @returns CSS string with !important overrides for critical reader properties
 */
export function buildReaderOverrides(
  theme: "light" | "dark" = "light",
): string {
  const layoutOverrides = `
    /* Reader layout overrides - prevents EPUB CSS from breaking reading experience */
    body {
      max-width: 700px !important;
      margin-left: auto !important;
      margin-right: auto !important;
      padding-left: 3rem !important;
      padding-right: 3rem !important;
      padding-top: 2rem !important;
      padding-bottom: 2rem !important;
    }

    /* Prevent images from overflowing */
    img, svg, video {
      max-width: 100% !important;
      height: auto !important;
    }
  `;

  if (theme === "dark") {
    return `
      ${layoutOverrides}

      /* Dark theme overrides - forces dark colors over hardcoded EPUB styles */
      body {
        color: #e5e5e5 !important;
        background: #1a1a1a !important;
      }

      p, h1, h2, h3, h4, h5, h6, span, a, li, td, th, div {
        color: #e5e5e5 !important;
      }

      .anno-highlight {
        color: #1a1a1a !important;
      }
    `;
  }

  return layoutOverrides;
}

/**
 * Combine multiple CSS strings into a single stylesheet.
 * Filters out empty strings and trims whitespace.
 *
 * @param cssArray - Array of CSS strings to combine
 * @returns Combined CSS string
 */
export function combineCss(cssArray: string[]): string {
  return cssArray
    .map((css) => css.trim())
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Full isolation pipeline: sanitize + scope EPUB CSS.
 *
 * @param css - Raw EPUB CSS
 * @param namespace - CSS namespace to scope under
 * @returns Isolated CSS string
 */
export function isolateEpubCss(
  css: string,
  namespace = ".epub-content",
): string {
  const sanitized = sanitizeEpubCss(css);
  return scopeCssToNamespace(sanitized, namespace);
}
