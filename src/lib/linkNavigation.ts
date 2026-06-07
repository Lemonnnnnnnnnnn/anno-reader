/**
 * Link click interceptor for EPUB reader iframes.
 *
 * Provides a script that gets injected into the chapter iframe srcdoc
 * to intercept link clicks. When the user clicks a link, the script
 * blocks default navigation and posts a message to the parent window
 * with the parsed href information.
 *
 * @example
 * ```ts
 * import { LINK_NAVIGATION_SCRIPT, type LinkClickMessage } from "@/lib/linkNavigation";
 *
 * const srcdocWithLinks = injectLinkNavigationScript(srcdoc);
 *
 * window.addEventListener("message", (e) => {
 *   if (e.data?.type === "link-click") {
 *     const msg = e.data as LinkClickMessage;
 *     navigateToHref(msg.href);
 *   }
 * });
 * ```
 */

/**
 * Message shape posted from the iframe when a link is clicked.
 */
export interface LinkClickMessage {
  /** Message type discriminator */
  type: "link-click";
  /** The full href value from the anchor element */
  href: string;
}

export interface ResolvedEpubLink {
  /** Normalized target chapter path without fragment/query */
  targetPath: string;
  /** Decoded fragment identifier without # */
  fragment: string | null;
}

/**
 * Script injected into the iframe srcdoc to intercept link clicks.
 *
 * Listens for click events in capture phase to intercept before other handlers.
 * Skips external URLs (http, https, mailto, javascript).
 * Posts a parsed link-click message to the parent window.
 */
export const LINK_NAVIGATION_SCRIPT = `
<script>
(function() {
  document.addEventListener('click', function(e) {
    var anchor = e.target.closest('a[href]');
    if (!anchor) return;

    var href = anchor.getAttribute('href');
    if (!href) return;

    if (href.indexOf('http://') === 0 || href.indexOf('https://') === 0 ||
        href.indexOf('mailto:') === 0 || href.indexOf('javascript:') === 0) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    window.parent.postMessage({
      type: 'link-click',
      href: href
    }, '*');
  }, true);
})();
</script>`;

/**
 * Inject the link navigation script into an srcdoc HTML string.
 * Appends the script just before the closing </body> tag.
 *
 * @param srcdoc - The iframe srcdoc HTML string
 * @returns The srcdoc with the link navigation script injected
 */
export function injectLinkNavigationScript(srcdoc: string): string {
  const closingBody = "</body>";
  const idx = srcdoc.lastIndexOf(closingBody);
  if (idx === -1) {
    return srcdoc + LINK_NAVIGATION_SCRIPT;
  }
  return srcdoc.slice(0, idx) + LINK_NAVIGATION_SCRIPT + srcdoc.slice(idx);
}

function decodeFragment(fragment: string): string {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

function normalizeEpubPath(path: string): string {
  const segments = path.replace(/\\/g, "/").split("/");
  const normalized: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      normalized.pop();
      continue;
    }
    normalized.push(segment);
  }

  return normalized.join("/");
}

function splitHash(href: string): { path: string; fragment: string | null } {
  const hashIndex = href.indexOf("#");
  if (hashIndex === -1) {
    return { path: href, fragment: null };
  }

  return {
    path: href.slice(0, hashIndex),
    fragment: decodeFragment(href.slice(hashIndex + 1)),
  };
}

function stripQuery(path: string): string {
  return path.split("?")[0];
}

function dirname(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex === -1 ? "" : normalized.slice(0, slashIndex + 1);
}

export function resolveEpubHref(
  href: string,
  currentChapterHref: string,
): ResolvedEpubLink | null {
  const trimmedHref = href.trim();
  if (!trimmedHref) return null;

  const lowerHref = trimmedHref.toLowerCase();
  if (
    lowerHref.startsWith("http://") ||
    lowerHref.startsWith("https://") ||
    lowerHref.startsWith("mailto:") ||
    lowerHref.startsWith("javascript:")
  ) {
    return null;
  }

  const { path, fragment } = splitHash(trimmedHref);
  const currentPath = normalizeEpubPath(stripQuery(currentChapterHref));
  const targetPath = stripQuery(path);
  const resolvedPath = !targetPath
    ? currentPath
    : targetPath.startsWith("/")
    ? targetPath.slice(1)
    : dirname(currentPath) + targetPath;

  return {
    targetPath: normalizeEpubPath(resolvedPath),
    fragment,
  };
}

export function findChapterIndexByHref(
  chapters: Array<{ href: string }>,
  targetPath: string,
): number {
  const normalizedTarget = normalizeEpubPath(stripQuery(targetPath)).toLowerCase();

  return chapters.findIndex(
    (chapter) =>
      normalizeEpubPath(stripQuery(chapter.href)).toLowerCase() === normalizedTarget,
  );
}
