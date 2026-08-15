/**
 * Positioning wiring test for PdfViewer + ReaderOverlays.
 *
 * Contract: the absolutely-positioned overlays (selection toolbar,
 * highlight popover) must render INSIDE the container element
 * (pdfPageWrap) that the selection rects are computed against
 * (toContainerRect). If they render at the viewer root instead, the
 * toolbar drifts by the page's offset within the viewer (scroll, zoom,
 * summary card) — a different wrong position on every selection.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { EpubChapterInfo } from "@/lib/epub/types";
import { useBookStore } from "@/stores/useBookStore";

// --- Lightweight mocks for PdfViewer internals ---

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

// Cut the heavy ChapterRenderer chain; only extractPlainText is used
vi.mock("../../ChapterRenderer", () => ({
  ChapterRenderer: () => <div />,
  extractPlainText: (html: string) => html.replace(/<[^>]*>/g, " "),
}));

// Heavy overlay children of ReaderOverlays (not under test)
vi.mock("@/components/AnnotationDetailDrawer", () => ({
  AnnotationDetailDrawer: () => <div data-testid="note-drawer" />,
}));
vi.mock("@/components/HighlightPopover", () => ({
  HighlightPopover: () => <div data-testid="highlight-popover" />,
}));
vi.mock("@/components/AITranslationPanel", () => ({
  AITranslationPanel: () => <div data-testid="translation-panel" />,
}));

// speechSynthesis is unavailable in happy-dom
vi.mock("@/hooks/useTTS", () => ({
  useTTS: () => ({ speak: vi.fn(), isSpeaking: false }),
}));

import { PdfViewer } from "../index";

const chapters: EpubChapterInfo[] = [
  { id: "page-1", title: "Page 1", href: "page-1", content: "<p>hello world</p>", cssContent: [] },
  { id: "page-2", title: "Page 2", href: "page-2", content: "<p>bye</p>", cssContent: [] },
];

const fakeDoc = {
  numPages: 2,
  getPage: async () => ({ getViewport: () => ({ width: 600, height: 800 }) }),
} as unknown as PDFDocumentProxy;

beforeEach(() => {
  // ResizeObserver may be missing in happy-dom
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
      ...useBookStore.getState().ui,
      currentChapter: "page-1",
      currentChapterIndex: 0,
      pendingScrollCfi: null,
    },
  });
});

function postSelection(top: number) {
  window.postMessage(
    {
      type: "text-selection",
      text: "hello",
      rect: { top, left: 50, bottom: top + 20, right: 150, width: 100, height: 20 },
      startOffset: 0,
      endOffset: 5,
    },
    "*",
  );
}

describe("PdfViewer overlay positioning", () => {
  it("renders the selection toolbar inside the positioning container (pdfPageWrap)", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    await act(async () => {
      createRoot(container).render(
        <PdfViewer document={fakeDoc} chapters={chapters} />,
      );
    });

    // Selection → toolbar appears
    await act(async () => {
      postSelection(100);
      await new Promise((r) => setTimeout(r, 0));
    });

    const toolbar = document.querySelector("[data-selection-toolbar]");
    expect(toolbar).not.toBeNull();

    // THE wiring contract: the absolutely-positioned toolbar must be a
    // descendant of the container its coordinates are relative to
    const pageWrap = toolbar!.closest(".pdfPageWrap");
    expect(pageWrap).not.toBeNull();
    expect(pageWrap!.querySelector("canvas")).not.toBeNull(); // it is the page wrap

    // Position derives deterministically from the rect: top = rect.top + 24
    expect(toolbar!.style.position).toBe("absolute");
    expect(toolbar!.style.top).toBe("124px");
  });

  it("updates the toolbar position deterministically on a new selection", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    await act(async () => {
      createRoot(container).render(
        <PdfViewer document={fakeDoc} chapters={chapters} />,
      );
    });

    // First selection
    await act(async () => {
      postSelection(100);
      await new Promise((r) => setTimeout(r, 0));
    });
    const toolbar = document.querySelector("[data-selection-toolbar]")!;
    expect(toolbar.style.top).toBe("124px");

    // Second selection at a different spot — same math, no drift term
    await act(async () => {
      postSelection(300);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(toolbar.style.top).toBe("324px");
    expect(toolbar.closest(".pdfPageWrap")).not.toBeNull();
  });
});
