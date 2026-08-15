/**
 * usePdfPage hook.
 *
 * Renders one PDF page: canvas painting (pdf.js) + transparent text
 * layer construction (official pdf.js TextLayer). Handles device pixel
 * ratio, render cancellation on page/scale change, and exposes the
 * extracted text lines for selection context.
 */

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { loadPdfjs } from "@/lib/pdf";
import { buildTextLines } from "@/lib/pdf";

export interface UsePdfPageResult {
  /** Ref for the canvas element. */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Ref for the text layer container element. */
  textLayerRef: React.RefObject<HTMLDivElement | null>;
  /** Extracted text lines of the rendered page (context for selection). */
  pageLines: string[];
  /** Whether the page has any extractable text (false = scanned page). */
  hasText: boolean;
  /** Whether a render is currently in progress. */
  rendering: boolean;
  /** Render epoch — increments after every completed render. */
  renderEpoch: number;
  /** Error message when rendering failed. */
  error: string | null;
}

/**
 * Render a single PDF page at the given scale.
 *
 * NOTE on dark mode: pages are always rendered with their original
 * colors; the PdfViewer applies a CSS filter on the canvas in dark mode
 * (`invert(.9) hue-rotate(180deg)`). pdf.js' `pageColors` render option
 * is NOT used: it is implemented via an SVG filter referenced from
 * CanvasRenderingContext2D.filter, which Chromium/WebKit (the Tauri
 * WebViews) do not support — it silently renders the original colors.
 *
 * @param doc - Live pdf.js document handle.
 * @param pageNumber - 1-based page number.
 * @param scale - CSS-pixel scale factor (1 = 72dpi natural size).
 */
export function usePdfPage(
  doc: PDFDocumentProxy | null,
  pageNumber: number,
  scale: number,
): UsePdfPageResult {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);

  const [pageLines, setPageLines] = useState<string[]>([]);
  const [hasText, setHasText] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderEpoch, setRenderEpoch] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!doc || pageNumber < 1 || pageNumber > doc.numPages) {
      setPageLines([]);
      setHasText(false);
      return;
    }

    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;
    let textLayer: { cancel: () => void } | null = null;

    async function renderPage() {
      setRendering(true);
      setError(null);

      let page: PDFPageProxy | null = null;
      try {
        // pdf.js is loaded lazily (browser-only APIs at module scope)
        const pdfjsLib = await loadPdfjs();
        const { TextLayer } = pdfjsLib;

        page = await doc!.getPage(pageNumber);
        if (cancelled) return;

        const canvas = canvasRef.current;
        const textLayerEl = textLayerRef.current;
        if (!canvas || !textLayerEl) return;

        const viewport = page.getViewport({ scale });

        // --- Canvas painting (with device pixel ratio) ---
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context unavailable");
        // White background so transparent PDFs don't render dark; the
        // dark-mode CSS filter inverts this to the app's dark background.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const task = page.render({
          canvas,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        });
        renderTask = task;

        // --- Text extraction (shared by text layer + context) ---
        const textContent = await page.getTextContent();

        // --- Text layer construction ---
        // Clear previous spans (also drops annotation overlays — they are
        // re-applied by the annotation effect after renderEpoch changes)
        textLayerEl.replaceChildren();
        // pdf.js v6 computes span font-size via
        //   calc(var(--total-scale-factor) * ... * var(--font-height))
        // and the official viewer sets --total-scale-factor on the page
        // container. Without it, spans render at inherited font-size and
        // misalign with the canvas glyphs (selection breaks).
        textLayerEl.style.setProperty("--total-scale-factor", String(scale));
        const layer = new TextLayer({
          textContentSource: textContent,
          container: textLayerEl,
          viewport,
        });
        // The constructor emits calc()/round() width/height strings that
        // depend on caller-provided round-step variables; set explicit
        // pixel dimensions instead (the CSS inset:0 also covers this).
        textLayerEl.style.width = `${Math.floor(viewport.width)}px`;
        textLayerEl.style.height = `${Math.floor(viewport.height)}px`;
        textLayer = layer;

        await Promise.all([task.promise, layer.render()]);
        if (cancelled) return;

        const lines = buildTextLines(textContent.items as readonly unknown[]);
        setPageLines(lines.map((l) => l.text));
        setHasText(lines.length > 0);
        setRenderEpoch((e) => e + 1);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        // RenderingCancelledException is expected on rapid page flips
        if (message.includes("cancel")) return;
        console.error("[pdf] Page render failed:", err);
        setError(`Failed to render page ${pageNumber}: ${message}`);
      } finally {
        if (!cancelled) setRendering(false);
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [doc, pageNumber, scale]);

  return { canvasRef, textLayerRef, pageLines, hasText, rendering, renderEpoch, error };
}
