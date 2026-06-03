/**
 * Test helpers for highlight/annotation TDD.
 *
 * Provides factories for creating test data and lightweight DOM mocks
 * so highlight logic can be tested without a real iframe or EPUB.
 */

import { vi } from "vitest";
import type { Highlight, Note } from "@/stores/useBookStore";
import type { HighlightData } from "@/lib/annotations/types";

// ── parseCfiOffsets ──────────────────────────────────────────────────────────

/**
 * Extract character offsets from a pseudo-CFI range string.
 *
 * Matches the pattern `:start,end)` at the end of strings like:
 *   `epubcfi(/6/4[chap01]!/4/2:10,20)`
 *
 * Logic extracted from `useAnnotationSync.ts` iframe script.
 */
export function parseCfiOffsets(
  cfi: string
): { start: number; end: number } | null {
  const match = cfi.match(/:(\d+),(\d+)\)$/);
  if (!match) return null;
  return { start: parseInt(match[1], 10), end: parseInt(match[2], 10) };
}

// ── createTestHighlight ──────────────────────────────────────────────────────

let _highlightCounter = 0;

/**
 * Create a test Highlight (store shape) with sensible defaults.
 * Every call produces a unique ID unless `overrides.id` is provided.
 */
export function createTestHighlight(
  overrides: Partial<Highlight> = {}
): Highlight {
  _highlightCounter++;
  return {
    id: `hl-test-${_highlightCounter}-${Date.now()}`,
    bookId: "book-test-1",
    chapterHref: "chapter1.xhtml",
    cfiRange: "epubcfi(/6/4[chap01]!/4/2:0,10)",
    text: "sample highlighted text",
    color: "#ffff00",
    createdAt: Date.now(),
    ...overrides,
  };
}

/**
 * Create a test HighlightData (persistence shape) with sensible defaults.
 */
export function createTestHighlightData(
  overrides: Partial<HighlightData> = {}
): HighlightData {
  _highlightCounter++;
  return {
    id: `hld-test-${_highlightCounter}-${Date.now()}`,
    bookId: "book-test-1",
    chapterHref: "chapter1.xhtml",
    cfiRange: "epubcfi(/6/4[chap01]!/4/2:0,10)",
    text: "sample highlighted text",
    color: "#ffff00",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a test Note (store shape) with sensible defaults.
 */
export function createTestNote(overrides: Partial<Note> = {}): Note {
  _highlightCounter++;
  return {
    id: `note-test-${_highlightCounter}-${Date.now()}`,
    bookId: "book-test-1",
    chapterHref: "chapter1.xhtml",
    cfiRange: "epubcfi(/6/4[chap01]!/4/2:0,10)",
    text: "sample noted text",
    content: "sample note content",
    createdAt: Date.now(),
    ...overrides,
  };
}

// ── mockTreeWalker ───────────────────────────────────────────────────────────

export interface MockTextContentNode {
  textContent: string;
  nodeType: number;
  nodeName: string;
}

export interface MockTreeWalker {
  currentNode: MockTextContentNode | null;
  nextNode: ReturnType<typeof vi.fn>;
  /** Programmatically set the nodes this walker returns */
  setNodes: (nodes: string[]) => void;
}

/**
 * Create a mock TreeWalker that iterates over the given text strings.
 *
 * Usage:
 * ```ts
 * const walker = mockTreeWalker(["Hello ", "world"]);
 * walker.nextNode(); // currentNode = { textContent: "Hello " }
 * walker.nextNode(); // currentNode = { textContent: "world" }
 * walker.nextNode(); // currentNode = null (done)
 * ```
 */
export function mockTreeWalker(texts: string[] = []): MockTreeWalker {
  let index = 0;
  const nodes: MockTextContentNode[] = texts.map((t) => ({
    textContent: t,
    nodeType: Node.TEXT_NODE,
    nodeName: "#text",
  }));

  const walker: MockTreeWalker = {
    currentNode: null,
    nextNode: vi.fn(() => {
      if (index < nodes.length) {
        walker.currentNode = nodes[index];
        index++;
        return walker.currentNode;
      }
      walker.currentNode = null;
      return null;
    }),
    setNodes: (newTexts: string[]) => {
      index = 0;
      walker.currentNode = null;
      nodes.length = 0;
      nodes.push(
        ...newTexts.map((t) => ({
          textContent: t,
          nodeType: Node.TEXT_NODE,
          nodeName: "#text",
        }))
      );
    },
  };

  return walker;
}

// ── mockRange ────────────────────────────────────────────────────────────────

export interface MockRange {
  startContainer: { textContent: string } | null;
  startOffset: number;
  endContainer: { textContent: string } | null;
  endOffset: number;
  collapse: ReturnType<typeof vi.fn>;
  setStart: ReturnType<typeof vi.fn>;
  setEnd: ReturnType<typeof vi.fn>;
  selectNodeContents: ReturnType<typeof vi.fn>;
  surroundContents: ReturnType<typeof vi.fn>;
  extractContents: ReturnType<typeof vi.fn>;
  deleteContents: ReturnType<typeof vi.fn>;
  cloneRange: ReturnType<typeof vi.fn>;
  toString: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock DOM Range object.
 *
 * `surroundContents` is pre-configured to throw `Failed to execute
 * 'surroundContents'` by default (matching real browser behavior on partial
 * overlap), so tests can verify error handling. Override via
 * `range.surroundContents.mockImplementation(...)`.
 */
export function mockRange(
  overrides: Partial<MockRange> = {}
): MockRange {
  const range: MockRange = {
    startContainer: null,
    startOffset: 0,
    endContainer: null,
    endOffset: 0,
    collapse: vi.fn(),
    setStart: vi.fn(),
    setEnd: vi.fn(),
    selectNodeContents: vi.fn(),
    surroundContents: vi.fn(() => {
      throw new DOMException(
        "Failed to execute 'surroundContents'",
        "NotFoundError"
      );
    }),
    extractContents: vi.fn(),
    deleteContents: vi.fn(),
    cloneRange: vi.fn(),
    toString: vi.fn(() => ""),
    ...overrides,
  };

  return range;
}

// ── postMessage mock ─────────────────────────────────────────────────────────

export interface MockPostMessage {
  calls: Array<{ type: string; payload: unknown }>;
  lastCall: () => { type: string; payload: unknown } | undefined;
  reset: () => void;
}

/**
 * Create a mock for `window.postMessage` that captures calls
 * for assertion in tests.
 */
export function mockPostMessage(): MockPostMessage {
  const calls: Array<{ type: string; payload: unknown }> = [];

  const mock = vi.fn((message: unknown) => {
    if (
      typeof message === "object" &&
      message !== null &&
      "type" in message
    ) {
      calls.push(message as { type: string; payload: unknown });
    }
  });

  // Attach to window for easy cleanup
  const original = window.postMessage;
  window.postMessage = mock as typeof window.postMessage;

  return {
    calls,
    lastCall: () => calls[calls.length - 1],
    reset: () => {
      calls.length = 0;
      window.postMessage = original;
    },
  };
}
