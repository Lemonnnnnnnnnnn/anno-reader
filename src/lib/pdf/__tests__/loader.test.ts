/**
 * Tests for the PDF loader (ParsedEpub mapping).
 *
 * pdfjs-dist is mocked at module level; loadPdf is exercised through
 * the real mapping logic (chapters, TOC, metadata, validation).
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PDFDocumentProxy } from "pdfjs-dist";

/** Build a fake pdf.js page with configurable text items. */
function fakePage(items: unknown[]) {
  return {
    getTextContent: async () => ({ items }),
    getViewport: ({ scale }: { scale?: number }) => ({
      width: 600 * (scale ?? 1),
      height: 800 * (scale ?? 1),
    }),
    render: () => ({ promise: Promise.resolve() }),
  };
}

/** Build a fake PDFDocumentProxy. */
function fakeDoc(overrides: Partial<Record<string, unknown>> = {}) {
  const pages = [
    fakePage([{ str: "Title of paper", hasEOL: true }]),
    fakePage([
      { str: "First ", hasEOL: false },
      { str: "line", hasEOL: true },
      { str: "Second line", hasEOL: true },
    ]),
    fakePage([]), // scanned page (no text)
  ];
  return {
    numPages: 3,
    getPage: async (n: number) => pages[n - 1],
    getMetadata: async () => ({
      info: { Title: "My Paper", Author: "Alice & Bob" },
    }),
    getOutline: async () => [
      { title: "Intro", dest: "sec1", items: [] },
      { title: "Results", dest: "sec2", items: [] },
    ],
    getDestinations: async () =>
      new Map([
        ["sec1", [{ num: 0, gen: 0 }]],
        ["sec2", [{ num: 2, gen: 0 }]],
      ]),
    getPageIndex: async (ref: { num: number }) => ref.num,
    loadingTask: { destroy: async () => undefined },
    ...overrides,
  } as unknown as PDFDocumentProxy;
}

vi.mock("pdfjs-dist", () => ({
  getDocument: vi.fn(() => ({
    promise: Promise.resolve(fakeDoc()),
  })),
  GlobalWorkerOptions: { workerSrc: "" },
}));

import {
  loadPdf,
  validatePdfMagic,
  titleFromFilePath,
  PdfFormatError,
  PdfNoPagesError,
} from "../loader";
import { getDocument } from "pdfjs-dist";

function pdfBytes(text = "%PDF-1.7 fake") {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDocument).mockImplementation(
    () =>
      ({
        promise: Promise.resolve(fakeDoc()),
      }) as unknown as ReturnType<typeof getDocument>,
  );
});

describe("validatePdfMagic", () => {
  it("accepts buffers starting with %PDF-", () => {
    expect(() => validatePdfMagic(pdfBytes())).not.toThrow();
  });

  it("rejects non-PDF buffers", () => {
    expect(() => validatePdfMagic(pdfBytes("PK\x03\x04zip"))).toThrow(PdfFormatError);
  });

  it("rejects empty buffers", () => {
    expect(() => validatePdfMagic(new ArrayBuffer(0))).toThrow(PdfFormatError);
  });
});

describe("titleFromFilePath", () => {
  it("derives title from filename without extension", () => {
    expect(titleFromFilePath("C:\\docs\\My Paper.pdf")).toBe("My Paper");
    expect(titleFromFilePath("/home/user/paper.PDF")).toBe("paper");
  });

  it("falls back to Untitled PDF for bare extension", () => {
    expect(titleFromFilePath(".pdf")).toBe("Untitled PDF");
  });
});

describe("loadPdf", () => {
  it("maps pages to chapters with page hrefs and titles", async () => {
    const { parsed } = await loadPdf(pdfBytes(), { extractContent: true });

    expect(parsed.chapters).toHaveLength(3);
    expect(parsed.chapters[0]).toMatchObject({
      id: "page-1",
      href: "page-1",
      title: "Page 1",
    });
    expect(parsed.chapters[2].href).toBe("page-3");
  });

  it("builds chapter content from page text and leaves scanned pages empty", async () => {
    const { parsed } = await loadPdf(pdfBytes(), { extractContent: true });

    expect(parsed.chapters[1].content).toContain("<p>First line</p>");
    expect(parsed.chapters[1].content).toContain("<p>Second line</p>");
    // Page 3 has no text items
    expect(parsed.chapters[2].content).not.toContain("<p>");
  });

  it("skips content extraction when extractContent is false", async () => {
    const { parsed } = await loadPdf(pdfBytes(), { extractContent: false });
    expect(parsed.chapters.every((ch) => ch.content === "")).toBe(true);
  });

  it("maps metadata with pdf.js info", async () => {
    const { parsed } = await loadPdf(pdfBytes(), { extractContent: false });
    expect(parsed.metadata).toMatchObject({
      title: "My Paper",
      author: "Alice & Bob",
    });
  });

  it("resolves outline to TOC via named destinations", async () => {
    const { parsed } = await loadPdf(pdfBytes(), { extractContent: false });
    expect(parsed.toc).toEqual([
      { title: "Intro", href: "page-1" },
      { title: "Results", href: "page-3" },
    ]);
  });

  it("does not generate a cover unless requested", async () => {
    const { parsed } = await loadPdf(pdfBytes(), { generateCover: false });
    expect(parsed.coverUrl).toBeNull();
  });

  it("uses empty ParsedEpub resource maps", async () => {
    const { parsed } = await loadPdf(pdfBytes(), { extractContent: false });
    expect(parsed.resources).toEqual({});
    expect(parsed.manifestHrefs).toEqual({});
    expect(parsed.opfFolder).toBe("");
  });

  it("throws PdfNoPagesError for zero-page documents", async () => {
    vi.mocked(getDocument).mockImplementation(
      () =>
        ({
          promise: Promise.resolve(fakeDoc({ numPages: 0 })),
        }) as unknown as ReturnType<typeof getDocument>,
    );
    await expect(loadPdf(pdfBytes())).rejects.toThrow(PdfNoPagesError);
  });

  it("wraps pdf.js parse failures in PdfFormatError", async () => {
    vi.mocked(getDocument).mockImplementation(
      () =>
        ({
          promise: Promise.reject(new Error("Invalid PDF structure")),
        }) as unknown as ReturnType<typeof getDocument>,
    );
    await expect(loadPdf(pdfBytes())).rejects.toThrow(PdfFormatError);
  });

  it("rejects non-PDF magic before touching pdf.js", async () => {
    await expect(loadPdf(pdfBytes("not a pdf"))).rejects.toThrow(PdfFormatError);
    expect(getDocument).not.toHaveBeenCalled();
  });

  it("returns the live document handle alongside the parsed view", async () => {
    const { document } = await loadPdf(pdfBytes(), { extractContent: false });
    expect(document.numPages).toBe(3);
  });
});
