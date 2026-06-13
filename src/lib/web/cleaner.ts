/**
 * HTML content cleaner for web reader.
 *
 * Strips non-content elements (scripts, navigation, ads)
 * and extracts the main readable content from a web page.
 */

/**
 * Tags that carry no reading content and should be removed entirely.
 */
const STRIP_TAGS = ["script", "style", "nav", "header", "footer", "aside", "noscript", "iframe", "svg"];

/**
 * Substrings in class/id that indicate non-content (ads, sidebar, etc.).
 */
const AD_SUBSTRINGS = [
  "ad",
  "ads",
  "advert",
  "popup",
  "modal",
  "overlay",
  "sidebar",
  "widget",
  "comment",
  "social",
  "share",
  "related",
  "recommend",
  "breadcrumb",
  "menu",
  "cookie",
  "consent",
  "newsletter",
  "signup",
  "subscribe",
];

/**
 * Class/id substrings that indicate main content area.
 */
const MAIN_CONTENT_MARKERS = [
  "article",
  "post",
  "content",
  "entry",
  "story",
  "post-body",
  "post-content",
  "article-body",
  "article-content",
  "entry-content",
  "page-content",
  "main-content",
];

/**
 * Result of cleaning HTML content.
 */
export interface CleanResult {
  /** Cleaned HTML with only the main content */
  html: string;
  /** Plain text extracted from the cleaned content */
  plainText: string;
}

/**
 * Remove all instances of a tag and its content from HTML.
 */
function removeTags(html: string, tag: string): string {
  const pattern = new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, "gi");
  return html.replace(pattern, "");
}

/**
 * Check if a class or id value contains ad/non-content keywords.
 */
function isAdElement(classAttr: string, idAttr: string): boolean {
  const combined = `${classAttr} ${idAttr}`.toLowerCase();
  return AD_SUBSTRINGS.some((sub) => combined.includes(sub));
}

/**
 * Score a content block by text length. Used to select the largest
 * content container when no semantic markers are found.
 */
function textLength(html: string): number {
  return html.replace(/<[^>]*>/g, "").trim().length;
}

/**
 * Extract the main content area from HTML.
 *
 * Tries `<article>`, `<main>`, content-identified divs, then
 * falls back to the largest div.
 */
function extractMainContent(html: string): string {
  // Try <article> tag first — strongest semantic signal
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch && textLength(articleMatch[1]) > 200) {
    return articleMatch[1];
  }

  // Try <main> tag
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch && textLength(mainMatch[1]) > 200) {
    return mainMatch[1];
  }

  // Try divs with content-related class/id
  const divPattern = /<div[^>]*>/gi;
  let bestContent = "";
  let bestLength = 0;
  let match: RegExpExecArray | null;

  while ((match = divPattern.exec(html)) !== null) {
    const divOpen = match[0];
    const classMatch = divOpen.match(/class="([^"]*)"/);
    const idMatch = divOpen.match(/id="([^"]*)"/);
    const classVal = classMatch ? classMatch[1] : "";
    const idVal = idMatch ? idMatch[1] : "";

    if (!MAIN_CONTENT_MARKERS.some((m) => classVal.includes(m) || idVal.includes(m))) {
      continue;
    }

    // Find the matching closing tag using nesting depth
    const startIdx = match.index + divOpen.length;
    let depth = 1;
    let pos = startIdx;
    const closePattern = /<\/div>|<div[^>]*>/gi;
    closePattern.lastIndex = pos;

    while (depth > 0) {
      const next = closePattern.exec(html);
      if (!next) break;
      if (next[0].startsWith("</")) {
        depth--;
      } else {
        depth++;
      }
      if (depth === 0) {
        const candidate = html.substring(startIdx, next.index);
        const len = textLength(candidate);
        if (len > bestLength) {
          bestLength = len;
          bestContent = candidate;
        }
      }
    }
  }

  if (bestContent) {
    return bestContent;
  }

  // Fallback: find the largest div by nesting
  const allDivs = /<div[^>]*>/gi;
  let largestContent = "";
  let largestLength = 0;
  let divMatch: RegExpExecArray | null;

  while ((divMatch = allDivs.exec(html)) !== null) {
    const openTag = divMatch[0];
    const startIdx = divMatch.index + openTag.length;
    let depth = 1;
    const closePattern = /<\/div>|<div[^>]*>/gi;
    closePattern.lastIndex = startIdx;

    while (depth > 0) {
      const next = closePattern.exec(html);
      if (!next) break;
      if (next[0].startsWith("</")) {
        depth--;
      } else {
        depth++;
      }
      if (depth === 0) {
        const candidate = html.substring(startIdx, next.index);
        const len = textLength(candidate);
        if (len > largestLength) {
          largestLength = len;
          largestContent = candidate;
        }
      }
    }
  }

  return largestContent || html;
}

/**
 * Strip non-content tags from HTML.
 */
function stripUnwantedTags(html: string): string {
  let cleaned = html;
  for (const tag of STRIP_TAGS) {
    cleaned = removeTags(cleaned, tag);
  }
  return cleaned;
}

/**
 * Remove elements whose class or id indicates ad/non-content.
 *
 * Uses regex to find opening tags with class/id, checks for
 * ad-related substrings, and removes the element and its children.
 */
function stripAdElements(html: string): string {
  // Match divs/spans/sections with class or id attributes
  return html.replace(
    /<(div|span|section|aside)[^>]*>/gi,
    (match, tag: string) => {
      const classMatch = match.match(/class="([^"]*)"/);
      const idMatch = match.match(/id="([^"]*)"/);
      const classVal = classMatch ? classMatch[1] : "";
      const idVal = idMatch ? idMatch[1] : "";

      if (!isAdElement(classVal, idVal)) {
        return match;
      }

      // Find matching close tag and remove everything
      const openPattern = new RegExp(`<${tag}[^>]*>`, "gi");
      const closePattern = new RegExp(`</${tag}>`, "gi");

      // Count nesting from this point
      openPattern.lastIndex = 0;
      closePattern.lastIndex = 0;

      // Simple approach: remove from this tag to its close
      const startIdx = html.indexOf(match);
      if (startIdx === -1) return match;

      let depth = 0;
      let pos = startIdx;
      const scan = new RegExp(`<${tag}[^>]*>|</${tag}>`, "gi");
      scan.lastIndex = pos;

      let endPos = -1;
      let scanMatch: RegExpExecArray | null;
      while ((scanMatch = scan.exec(html)) !== null) {
        if (scanMatch[0].startsWith("</")) {
          depth--;
          if (depth === 0) {
            endPos = scanMatch.index + scanMatch[0].length;
            break;
          }
        } else {
          depth++;
        }
      }

      if (endPos > startIdx) {
        return html.substring(0, startIdx) + html.substring(endPos);
      }

      return match;
    },
  );
}

/**
 * Remove all HTML tags, leaving only text content.
 */
function stripAllTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ");
}

/**
 * Normalize whitespace: collapse runs and trim.
 */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Clean HTML content from a web page.
 *
 * Removes non-content elements (scripts, navigation, ads),
 * extracts the main content area, and returns both cleaned
 * HTML and plain text.
 *
 * @param html - Raw HTML content from a fetched web page
 * @returns Cleaned HTML and extracted plain text
 */
export function cleanHtml(html: string): CleanResult {
  // Step 1: Remove unwanted tags (script, style, nav, etc.)
  let cleaned = stripUnwantedTags(html);

  // Step 2: Remove ad/non-content elements by class/id
  cleaned = stripAdElements(cleaned);

  // Step 3: Extract main content area
  cleaned = extractMainContent(cleaned);

  // Step 4: Clean remaining HTML — remove remaining non-content attributes
  // Keep only href, src, alt, title attributes
  cleaned = cleaned.replace(/<([a-z][a-z0-9]*)\s+[^>]*>/gi, (match, tag) => {
    const href = match.match(/\shref="([^"]*)"/i);
    const src = match.match(/\ssrc="([^"]*)"/i);
    const alt = match.match(/\salt="([^"]*)"/i);
    const title = match.match(/\stitle="([^"]*)"/i);

    const attrs = [
      href ? `href="${href[1]}"` : "",
      src ? `src="${src[1]}"` : "",
      alt ? `alt="${alt[1]}"` : "",
      title ? `title="${title[1]}"` : "",
    ]
      .filter(Boolean)
      .join(" ");

    return attrs ? `<${tag} ${attrs}>` : `<${tag}>`;
  });

  // Step 5: Extract plain text
  const plainText = normalizeWhitespace(stripAllTags(cleaned));

  return {
    html: cleaned.trim(),
    plainText,
  };
}
