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

// ---------------------------------------------------------------------------
// Sentence context extraction
//
// PDF pages carry no paragraph structure — only line-wrapped visual lines —
// so a single line is usually a sentence FRAGMENT. To give the AI the same
// full-sentence context the EPUB path gets from the DOM, the lines are
// joined into a flow and split on sentence terminators before extracting
// the sentence (or paragraph) containing the selection.
// ---------------------------------------------------------------------------

/** Sentence terminators — kept in sync with extractSentenceContext in lib/ai/context.ts. */
const SENTENCE_TERMINATORS = ".!?\u3002\uff01\uff1f";

/** Quotes/brackets that may follow a terminator and still close the sentence. */
const SENTENCE_CLOSERS = "\"'\u201d\u2019)]\u300b\uff09";

/** Max sentence length — mirrors MAX_SENTENCE_CONTEXT_CHARS in lib/ai/context.ts. */
const MAX_SENTENCE_CONTEXT_CHARS = 500;

/** A sentence span within the joined line flow. */
interface SentenceSpan {
  start: number;
  end: number;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isTerminator(ch: string): boolean {
  return SENTENCE_TERMINATORS.includes(ch);
}

function isCloser(ch: string): boolean {
  return SENTENCE_CLOSERS.includes(ch);
}

/**
 * Merge line-end hyphenations created by joining lines with spaces
 * ("exam- ple" → "example"). In-line hyphens ("well-known") are never
 * followed by a space in a single line, so they are left untouched.
 */
function dehyphenate(text: string): string {
  return text.replace(/([A-Za-z])- /g, "$1");
}

/**
 * Drop spaces between adjacent CJK characters — CJK text uses no spaces,
 * so any space there is a line-join artifact. Display-only cleanup: the
 * flow used for selection matching always keeps the spaces.
 */
const CJK_CHAR = "\\u4e00-\\u9fff\\u3040-\\u30ff\\u3000-\\u303f\\uff00-\\uffef";
const cjkJoinSpaceRegex = new RegExp(`([${CJK_CHAR}]) +(?=[${CJK_CHAR}])`, "g");

function dropCjkJoinSpaces(text: string): string {
  return text.replace(cjkJoinSpaceRegex, "$1");
}

/** Split the joined line flow into sentence spans (whitespace included, trimmed later). */
function splitSentences(flow: string): SentenceSpan[] {
  const spans: SentenceSpan[] = [];
  let start = 0;

  for (let i = 0; i < flow.length; i++) {
    if (!isTerminator(flow[i])) continue;
    let end = i + 1;
    while (end < flow.length && isCloser(flow[end])) end++;
    if (flow.slice(start, end).trim().length > 0) {
      spans.push({ start, end });
    }
    start = end;
  }
  // Trailing fragment without a terminator (sentence may continue on the next page)
  if (flow.slice(start).trim().length > 0) {
    spans.push({ start, end: flow.length });
  }
  return spans;
}

/**
 * Locate the (whitespace-normalized) selection within the joined line flow.
 * Selections spanning lines contain newlines that normalize to the same
 * single spaces the flow is built from.
 */
function findSelectionInFlow(
  selectedText: string,
  flow: string,
): { start: number; end: number } | null {
  const needle = normalizeWhitespace(selectedText);
  if (!needle) return null;
  const idx = flow.indexOf(needle);
  if (idx === -1) return null;
  return { start: idx, end: idx + needle.length };
}

/** First line fully containing the selection (legacy fallback). */
function findContainingLine(
  selectedText: string,
  lines: readonly string[],
): string | null {
  const needle = selectedText.trim();
  if (!needle) return null;
  for (const line of lines) {
    if (line.includes(needle)) return line;
  }
  return null;
}

/** Extract, tidy (hyphenation / CJK join spaces), and cap a sentence span. */
function spanToContext(flow: string, span: SentenceSpan): string {
  const text = dropCjkJoinSpaces(dehyphenate(flow.slice(span.start, span.end).trim()));
  return text.length > MAX_SENTENCE_CONTEXT_CHARS
    ? text.slice(0, MAX_SENTENCE_CONTEXT_CHARS)
    : text;
}

/**
 * Find sentence context for a selection: the full sentence containing it,
 * assembled ACROSS line breaks (with line-end hyphenation merged). Falls
 * back to the containing line, then to the selection itself.
 */
export function findSentenceContext(
  selectedText: string,
  lines: readonly string[],
): string {
  const needle = selectedText.trim();
  if (!needle) return needle;

  const flow = normalizeWhitespace(lines.join(" "));
  const selection = findSelectionInFlow(selectedText, flow);
  const spans = splitSentences(flow);

  if (selection) {
    const span = spans.find(
      (s) => selection.start >= s.start && selection.start < s.end,
    );
    if (span) {
      return spanToContext(flow, span);
    }
  }

  return findContainingLine(selectedText, lines) ?? needle;
}

/**
 * Find paragraph-ish context: the containing sentence plus one sentence
 * on each side (PDF pages have no paragraph markers — a sentence window
 * is the closest reliable proxy).
 */
export function findParagraphContext(
  selectedText: string,
  lines: readonly string[],
): string {
  const needle = selectedText.trim();
  if (!needle) return needle;

  const flow = normalizeWhitespace(lines.join(" "));
  const selection = findSelectionInFlow(selectedText, flow);
  const spans = splitSentences(flow);

  if (selection) {
    const idx = spans.findIndex(
      (s) => selection.start >= s.start && selection.start < s.end,
    );
    if (idx !== -1) {
      return dropCjkJoinSpaces(
        dehyphenate(flow.slice(spans[Math.max(0, idx - 1)].start, spans[Math.min(spans.length - 1, idx + 1)].end).trim()),
      );
    }
  }

  return findContainingLine(selectedText, lines) ?? needle;
}
