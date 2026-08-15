/**
 * Tests for the import dispatcher (importBook) and PDF import flow.
 *
 * All IO boundaries are mocked: dialog, file reading, data-dir copy,
 * bookshelf persistence, and the pdf/epub parsers.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ParsedEpub } from "@/lib/epub/types";
import type { PdfBook } from "@/lib/pdf/types";

// --- Mocks (hoisted) ---

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  copyFile: vi.fn(),
  mkdir: vi.fn(),
  exists: vi.fn(async () => true),
}));

vi.mock("@/lib/storage/config", () => ({
  readConfig: vi.fn(async () => ({ dataDir: "/data" })),
  isDataDirValid: vi.fn(async () => true),
}));

vi.mock("@/lib/bookshelf", () => ({
  addEntry: vi.fn(async () => undefined),
}));

vi.mock("../fileReader", () => ({
  readFileAsArrayBuffer: vi.fn(async () => new TextEncoder().encode("%PDF-1.7 fake").buffer),
}));

vi.mock("@/lib/pdf", () => ({
  loadPdf: vi.fn(),
  destroyPdfDocument: vi.fn(async () => undefined),
  titleFromFilePath: vi.fn((p: string) => p.replace(/\.pdf$/i, "")),
}));

vi.mock("@/lib/epub", () => ({
  loadEpub: vi.fn(),
}));

import { importBook } from "../importBook";
import { EpubImportError, ImportErrorCode } from "../errors";
import { open } from "@tauri-apps/plugin-dialog";
import { copyFile } from "@tauri-apps/plugin-fs";
import { addEntry } from "@/lib/bookshelf";
import { loadPdf } from "@/lib/pdf";
import { readFileAsArrayBuffer } from "../fileReader";
import { useBookStore } from "@/stores/useBookStore";
/** A minimal parsed-epub-shaped object for the PDF mock. */
function fakeParsedPdf(): ParsedEpub {
  return {
    metadata: { title: "My Paper", author: "Alice", language: "", identifier: "" },
    coverUrl: null,
    chapters: [
      { id: "page-1", title: "Page 1", href: "page-1", content: "<p>x</p>", cssContent: [] },
    ],
    toc: [],
    resources: {},
    opfFolder: "",
    manifestHrefs: {},
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(open).mockResolvedValue("C:\\docs\\paper.pdf");
  vi.mocked(copyFile).mockResolvedValue(undefined);
  useBookStore.setState({ currentBook: null });
});

describe("importBook dispatch", () => {
  it("routes .pdf files to the PDF importer", async () => {
    const parsed = fakeParsedPdf();
    vi.mocked(loadPdf).mockResolvedValue({
      parsed,
      document: { numPages: 1 },
    } as unknown as PdfBook);

    const { book } = await importBook();

    expect(loadPdf).toHaveBeenCalledTimes(1);
    expect(book.format).toBe("pdf");
    expect(book.title).toBe("My Paper");
    // Copy destination uses the .pdf extension
    expect(copyFile).toHaveBeenCalledWith(
      "C:\\docs\\paper.pdf",
      expect.stringContaining("book.pdf"),
    );
    // Bookshelf entry includes the format
    expect(addEntry).toHaveBeenCalledWith(
      expect.objectContaining({ format: "pdf", type: "book" }),
    );
    // Store registered the book
    expect(useBookStore.getState().currentBook?.id).toBe(book.id);
  });

  it("rejects unsupported extensions", async () => {
    vi.mocked(open).mockResolvedValue("C:\\docs\\file.txt");

    await expect(importBook()).rejects.toThrow(EpubImportError);
    await expect(importBook()).rejects.toMatchObject({
      code: ImportErrorCode.InvalidFileType,
    });
  });

  it("propagates dialog cancellation untouched", async () => {
    vi.mocked(open).mockResolvedValue(null);

    await expect(importBook()).rejects.toMatchObject({
      code: ImportErrorCode.Cancelled,
    });
  });

  it("rejects PDFs whose magic header is missing (via loadPdf validation)", async () => {
    // loadPdf mock simulates the magic-check failure for wrong content
    vi.mocked(loadPdf).mockRejectedValue(
      new EpubImportError(ImportErrorCode.InvalidFileType, "bad magic"),
    );
    vi.mocked(readFileAsArrayBuffer).mockResolvedValue(
      new TextEncoder().encode("PK zip archive").buffer as ArrayBuffer,
    );

    await expect(importBook()).rejects.toMatchObject({
      code: ImportErrorCode.InvalidFileType,
    });
  });
});
