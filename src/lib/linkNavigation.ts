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
 *     navigateToChapter(msg.filePath, msg.fragment);
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
  /** The chapter file path (null if fragment-only link) */
  filePath: string | null;
  /** The fragment identifier without # (null if no fragment) */
  fragment: string | null;
  /** True if the link targets the current chapter (fragment-only) */
  isSameChapter: boolean;
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

    var filePath = null;
    var fragment = null;
    var isSameChapter = false;

    var hashIndex = href.indexOf('#');
    if (href.charAt(0) === '#') {
      isSameChapter = true;
      fragment = href.slice(1);
    } else if (hashIndex !== -1) {
      filePath = href.substring(0, hashIndex);
      fragment = href.substring(hashIndex + 1);
    } else {
      filePath = href;
    }

    window.parent.postMessage({
      type: 'link-click',
      href: href,
      filePath: filePath,
      fragment: fragment,
      isSameChapter: isSameChapter
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
