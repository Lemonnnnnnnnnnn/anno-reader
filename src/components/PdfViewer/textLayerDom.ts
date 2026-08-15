/**
 * DOM helpers for the PDF text layer.
 *
 * Mirrors the injected iframe scripts (selection.ts / useAnnotationSync)
 * on the main document: character-offset computation, annotation span
 * wrapping, and selection → postMessage bridging. Offsets are computed
 * over the concatenated text-node stream of the text layer, which is
 * invariant under annotation wrapping (wrapping only splits text nodes).
 */

/** Rect shape used by selection/highlight messages (container-relative). */
export interface MessageRect {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
}

/**
 * Whether an event target lies inside floating reader UI (selection
 * toolbar / highlight popover). Mouse events originating there must not
 * be treated as page interactions: clicking a toolbar button must not
 * re-report the (still-active) browser selection — the delayed mouseup
 * handler would re-post "text-selection" right after the click handler
 * closed the toolbar, making it appear to never close.
 *
 * NOTE: checks `Element`, not `HTMLElement` — toolbar buttons contain
 * SVG icons, and SVGElement is NOT an HTMLElement. Using HTMLElement
 * here silently failed for clicks landing on the icon.
 */
export function isInsideFloatingUi(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return (
    target.closest("[data-selection-toolbar]") !== null ||
    target.closest("[data-highlight-popover]") !== null
  );
}

/** Convert a DOMRect to a rect relative to the given container element. */
export function toContainerRect(rect: DOMRect, container: HTMLElement): MessageRect {
  const containerRect = container.getBoundingClientRect();
  const top = rect.top - containerRect.top;
  const left = rect.left - containerRect.left;
  return {
    top,
    left,
    bottom: rect.bottom - containerRect.top,
    right: rect.right - containerRect.left,
    width: rect.width,
    height: rect.height,
  };
}

/** Collect all text nodes under root in document order. */
export function getTextNodes(root: Node): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node: Node) => {
      let parent = node.parentElement;
      while (parent && parent !== root) {
        const tag = parent.tagName ? parent.tagName.toLowerCase() : "";
        if (tag === "script" || tag === "style" || tag === "noscript") {
          return NodeFilter.FILTER_REJECT;
        }
        parent = parent.parentElement;
      }
      return node.textContent && node.textContent.length > 0
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    },
  });
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }
  return nodes;
}

/**
 * Compute the character offset of (node, offset) within the concatenated
 * text-node stream of root.
 */
export function getTextOffset(root: Node, targetNode: Node, offset: number): number {
  const nodes = getTextNodes(root);
  let current = 0;
  for (const node of nodes) {
    if (node === targetNode) {
      return current + offset;
    }
    current += node.textContent?.length ?? 0;
  }
  return current;
}

/**
 * Wrap [startOffset, endOffset) in the concatenated text stream with a
 * span (className + inline style + data attributes), splitting text
 * nodes as needed. Mirrors the iframe annotation script's wrapRange.
 */
export function wrapRange(
  root: HTMLElement,
  startOffset: number,
  endOffset: number,
  className: string,
  style: string | null,
  dataAttrs: Record<string, string>,
): void {
  const textNodes = getTextNodes(root);

  let totalLength = 0;
  for (const node of textNodes) {
    totalLength += node.textContent?.length ?? 0;
  }
  if (startOffset < 0 || endOffset > totalLength || startOffset >= endOffset) {
    console.warn("[pdf] Invalid annotation offsets:", { startOffset, endOffset, totalLength });
    return;
  }

  let startNode: Text | null = null;
  let startNodeOffset = 0;
  let endNode: Text | null = null;
  let endNodeOffset = 0;
  let currentOffset = 0;

  for (const node of textNodes) {
    const nodeLen = node.textContent?.length ?? 0;

    if (!startNode && currentOffset + nodeLen > startOffset) {
      startNode = node;
      startNodeOffset = startOffset - currentOffset;
    }
    if (currentOffset + nodeLen >= endOffset) {
      endNode = node;
      endNodeOffset = endOffset - currentOffset;
      break;
    }
    currentOffset += nodeLen;
  }
  if (!startNode || !endNode) {
    console.warn("[pdf] Could not resolve annotation nodes for offsets", { startOffset, endOffset });
    return;
  }

  const createSpan = () => {
    const span = document.createElement("span");
    span.className = className;
    if (style) span.setAttribute("style", style);
    for (const [key, value] of Object.entries(dataAttrs)) {
      span.setAttribute(`data-${key}`, value);
    }
    return span;
  };

  // Wrap each affected text node independently (like the iframe script)
  const startIndex = textNodes.indexOf(startNode);
  const endIndex = textNodes.indexOf(endNode);
  for (let i = endIndex; i >= startIndex; i--) {
    const textNode = textNodes[i];
    const from = textNode === startNode ? startNodeOffset : 0;
    const to = textNode === endNode ? endNodeOffset : textNode.textContent?.length ?? 0;
    if (from >= to) continue;

    try {
      const range = document.createRange();
      range.setStart(textNode, from);
      range.setEnd(textNode, to);
      range.surroundContents(createSpan());
    } catch (err) {
      // Range wrapping can fail on complex selections
      console.warn("[pdf] Failed to wrap annotation range:", err);
    }
  }
}

/**
 * Remove all annotation spans from the text layer, restoring the
 * original text-node structure (then normalize to merge text nodes).
 */
export function clearAnnotations(root: HTMLElement): void {
  const spans = root.querySelectorAll(".anno-highlight, .anno-note");
  Array.from(spans)
    .reverse()
    .forEach((span) => {
      const parent = span.parentNode;
      if (!parent) return;
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
      }
      parent.removeChild(span);
    });
  root.normalize();
}

/** Parse the ":start,end)" suffix of a pseudo-CFI range. */
export function parseCfiOffsets(cfi: string): { start: number; end: number } | null {
  const match = cfi.match(/:(\d+),(\d+)\)$/);
  if (!match) return null;
  return { start: parseInt(match[1], 10), end: parseInt(match[2], 10) };
}

/**
 * Find sentence-ish context for a selection: the first extracted line
 * that contains the selected text (PDF lines are short, so the line is
 * a good "sentence" proxy). Falls back to the selection itself.
 */
export function findSentenceContext(
  selectedText: string,
  lines: readonly string[],
): string {
  const needle = selectedText.trim();
  if (!needle) return needle;
  for (const line of lines) {
    if (line.includes(needle)) return line;
  }
  return needle;
}

/**
 * Find paragraph-ish context: the containing line plus its neighbors
 * (up to 3 lines total), joined with spaces.
 */
export function findParagraphContext(
  selectedText: string,
  lines: readonly string[],
): string {
  const needle = selectedText.trim();
  const idx = lines.findIndex((line) => needle && line.includes(needle));
  if (idx === -1) return needle;
  const from = Math.max(0, idx - 1);
  const to = Math.min(lines.length, idx + 2);
  return lines.slice(from, to).join(" ");
}
