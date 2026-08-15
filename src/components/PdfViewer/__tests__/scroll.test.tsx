/**
 * Scroll behavior tests for PdfViewer.
 *
 * Covers:
 * - saved scroll offset is applied when the page renders (restore on open)
 * - page flip resets the scroll container to the navigation target (0)
 * - container scroll events are reported to the store for persistence
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { EpubChapterInfo } from "@/lib/epub/types";
import { useBookStore } from "@/stores/useBookStore";

// --- Same lightweight mocks as positioning.test.tsx ---

vi.mock("../hooks/usePdfPage", () => ({
  usePdfPage: () => ({
    canvasRef: { current: null },
    textLayerRef: { current: null },
    pageLines: ["hello world"],
    hasText: true,
    rendering: false,
    renderEpoch: 1,
    error: null,
  }),
}));

vi.mock("../hooks/usePdfSelection", () => ({
  usePdfSelection: () => undefined,
}));

vi.mock("../hooks/usePdfAnnotations", () => ({
  usePdfAnnotations: () => undefined,
}));

vi.mock("../hooks/usePageSummary", () => ({
  usePageSummary: () => ({
    status: "idle",
    content: "",
    hasSummary: false,
    error: null,
    run: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock("../PageSummaryCard", () => ({
  PageSummaryCard: () => <div data-testid="summary-card" />,
}));

vi.mock("../../ChapterRenderer", () => ({
  ChapterRenderer: () => <div />,
  extractPlainText: (html: string) => html.replace(/<[^>]*>/g, " "),
}));

vi.mock("@/components/AnnotationDetailDrawer", () => ({
  AnnotationDetailDrawer: () => <div data-testid="note-drawer" />,
}));
vi.mock("@/components/HighlightPopover", () => ({
  HighlightPopover: () => <div data-testid="highlight-popover" />,
}));
vi.mock("@/components/AITranslationPanel", () => ({
  AITranslationPanel: () => <div data-testid="translation-panel" />,
}));
vi.mock("@/hooks/useTTS", () => ({
  useTTS: () => ({ speak: vi.fn(), isSpeaking: false }),
}));

import { PdfViewer } from "../index";

const chapters: EpubChapterInfo[] = [
  { id: "page-1", title: "Page 1", href: "page-1", content: "<p>a</p>", cssContent: [] },
  { id: "page-2", title: "Page 2", href: "page-2", content: "<p>b</p>", cssContent: [] },
];

const fakeDoc = {
  numPages: 2,
  getPage: async () => ({ getViewport: () => ({ width: 600, height: 800 }) }),
} as unknown as PDFDocumentProxy;

/** Render PdfViewer; returns the scroll container via onScrollEl. */
async function renderPdfViewer() {
  let scrollEl: HTMLDivElement | null = null;
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(
      <PdfViewer
        document={fakeDoc}
        chapters={chapters}
        onScrollEl={(el) => {
          scrollEl = el;
        }}
      />,
    );
  });
  return scrollEl!;
}

beforeEach(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  }

  useBookStore.setState({
    currentBook: {
      id: "b1",
      title: "Paper",
      author: "A",
      coverUrl: null,
      filePath: "x.pdf",
      lastOpened: 0,
      format: "pdf",
    },
    highlights: [],
    notes: [],
    summaries: [],
    ui: {
      currentChapter: "page-1",
      currentChapterIndex: 0,
      scrollPosition: 0,
      pendingScrollCfi: null,
      pendingScrollAnchor: null,
      pendingScrollY: null,
      theme: "light",
      fontSize: 18,
      pdfZoom: 1,
    },
  });
});

describe("PdfViewer scroll behavior", () => {
  it("applies the saved scroll offset when the page renders (restore on open)", async () => {
    // Simulate restoreProgress having set a saved offset
    useBookStore.getState().setScrollPosition(500);

    const el = await renderPdfViewer();

    // Applied after the first render completes
    expect(el.scrollTop).toBe(500);
  });

  it("resets the scroll container on page flip (navigation target 0)", async () => {
    useBookStore.getState().setScrollPosition(300);
    const el = await renderPdfViewer();
    expect(el.scrollTop).toBe(300);

    // Simulate ChapterNavigation/useKeyboardNav: chapter + scroll reset
    await act(async () => {
      useBookStore.getState().setCurrentChapter("page-2", 1);
      useBookStore.getState().setScrollPosition(0);
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(el.scrollTop).toBe(0);
  });

  it("reports container scroll to the store (progress persistence)", async () => {
    const el = await renderPdfViewer();

    el.scrollTop = 120;
    await act(async () => {
      el.dispatchEvent(new Event("scroll"));
      await new Promise((r) => setTimeout(r, 30)); // rAF throttle
    });

    expect(useBookStore.getState().ui.scrollPosition).toBe(120);
  });
});
