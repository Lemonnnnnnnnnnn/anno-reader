/**
 * Text selection detection for EPUB reader iframes.
 *
 * Provides a script that gets injected into the chapter iframe srcdoc
 * to detect text selection. When the user selects text, the script posts
 * a message to the parent window with the selected text and position data.
 *
 * The parent-side TextSelectionToolbar component listens for these messages
 * and displays an action toolbar near the selection.
 *
 * @example
 * ```ts
 * import { SELECTION_DETECTOR_SCRIPT, type SelectionMessage } from "@/lib/selection";
 *
 * // Inject into srcdoc (see VerticalScroller integration)
 * const srcdocWithSelection = injectSelectionScript(srcdoc);
 *
 * // In parent component, listen for selection messages:
 * window.addEventListener("message", (e) => {
 *   if (e.data?.type === "text-selection") {
 *     const msg = e.data as SelectionMessage;
 *     console.log(msg.text, msg.rect);
 *   }
 * });
 * ```
 */

/**
 * Message shape posted from the iframe when text is selected.
 * The rect coordinates are relative to the iframe viewport.
 */
export interface SelectionMessage {
  /** Message type discriminator */
  type: "text-selection";
  /** The selected text content */
  text: string;
  /** Bounding rect of the selection, relative to iframe viewport */
  rect: {
    top: number;
    left: number;
    bottom: number;
    right: number;
    width: number;
    height: number;
  };
  /** Character offset of selection start within document body text */
  startOffset: number;
  /** Character offset of selection end within document body text */
  endOffset: number;
}

/**
 * Message posted when the user clears their selection (empty selection).
 */
export interface SelectionClearedMessage {
  type: "text-selection-cleared";
}

/**
 * Generate a CFI-like range identifier from selection offsets.
 * Since we don't have epub.js CFI generation, this creates a stable
 * positional identifier based on character offsets within the chapter.
 *
 * @param chapterHref - The chapter href
 * @param startOffset - Start character offset in the body text
 * @param endOffset - End character offset in the body text
 * @returns A pseudo-CFI range string
 */
export function generateCfiRange(
  _chapterHref: string,
  startOffset: number,
  endOffset: number,
): string {
  // Use a simple positional format: epubcfi pseudo-range
  // This is unique per selection and stable within a chapter
  return `epubcfi(/6/4[chap01]!/4/2:${startOffset},${endOffset})`;
}

/**
 * Script injected into the iframe srcdoc to detect text selection.
 *
 * Listens for `mouseup` events and checks if there's a non-empty
 * text selection. If so, posts a `text-selection` message to the
 * parent window with the selected text and bounding rect.
 *
 * Also listens for `mousedown` to detect when selection is cleared.
 */
export const SELECTION_DETECTOR_SCRIPT = `
<script>
(function() {
  function getTextOffset(root, targetNode, offset) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var currentOffset = 0;
    while (walker.nextNode()) {
      if (walker.currentNode === targetNode) {
        return currentOffset + offset;
      }
      currentOffset += walker.currentNode.textContent.length;
    }
    return currentOffset;
  }

  function handleSelection() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      return;
    }

    var text = sel.toString().trim();
    if (!text || text.length === 0) return;

    var range = sel.getRangeAt(0);
    var rect = range.getBoundingClientRect();

    // Calculate text offsets relative to body
    var body = document.body;
    var startOffset = getTextOffset(body, range.startContainer, range.startOffset);
    var endOffset = getTextOffset(body, range.endContainer, range.endOffset);

    window.parent.postMessage({
      type: 'text-selection',
      text: text,
      rect: {
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right,
        width: rect.width,
        height: rect.height
      },
      startOffset: startOffset,
      endOffset: endOffset
    }, '*');
  }

  function handleClear() {
    setTimeout(function() {
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        window.parent.postMessage({
          type: 'text-selection-cleared'
        }, '*');
      }
    }, 200);
  }

  document.addEventListener('mouseup', function(e) {
    setTimeout(handleSelection, 10);
  });

  document.addEventListener('mousedown', function(e) {
    handleClear();
  });
})();
</script>`;

/**
 * Inject the selection detector script into an srcdoc HTML string.
 * Appends the script just before the closing </body> tag.
 *
 * @param srcdoc - The iframe srcdoc HTML string
 * @returns The srcdoc with the selection detector script injected
 */
export function injectSelectionScript(srcdoc: string): string {
  const closingBody = "</body>";
  const idx = srcdoc.lastIndexOf(closingBody);
  if (idx === -1) {
    return srcdoc + SELECTION_DETECTOR_SCRIPT;
  }
  return srcdoc.slice(0, idx) + SELECTION_DETECTOR_SCRIPT + srcdoc.slice(idx);
}
