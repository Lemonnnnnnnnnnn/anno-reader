/**
 * PDF cover generation.
 *
 * Renders page 1 onto an offscreen canvas at reduced scale and returns
 * a JPEG data URL for the bookshelf / reader header. Failure-tolerant:
 * returns null when canvas rendering is unavailable (e.g. tests).
 */

import type { PDFDocumentProxy } from "pdfjs-dist";

/** Target cover width in CSS pixels (cover is proportional). */
const COVER_WIDTH = 180;

/**
 * Render page 1 of the document as a cover data URL.
 * @returns JPEG data URL, or null on any failure.
 */
export async function renderPdfCover(
  doc: PDFDocumentProxy,
): Promise<string | null> {
  try {
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const scale = COVER_WIDTH / viewport.width;
    const scaled = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(scaled.width);
    canvas.height = Math.ceil(scaled.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // White background so transparent PDFs don't render black
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvas,
      viewport: scaled,
    }).promise;

    return canvas.toDataURL("image/jpeg", 0.75);
  } catch (err) {
    console.warn("[pdf] Failed to generate cover:", err);
    return null;
  }
}
