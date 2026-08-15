/**
 * pdf.js lazy loader + worker configuration (singleton).
 *
 * pdf.js evaluates browser-only APIs (DOMMatrix etc.) at module scope,
 * so it is imported dynamically. This keeps test environments (which
 * render components without a real canvas) working and avoids loading
 * pdf.js at startup for EPUB-only sessions.
 *
 * The worker URL is a static `?url` import — it resolves to an asset
 * path without evaluating the worker code.
 */

import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type * as PdfjsLib from "pdfjs-dist";

let libPromise: Promise<typeof PdfjsLib> | null = null;

/**
 * Dynamically import pdf.js (once) and configure the worker source.
 *
 * @returns The configured pdf.js module namespace.
 */
export async function loadPdfjs(): Promise<typeof PdfjsLib> {
  if (!libPromise) {
    libPromise = import("pdfjs-dist").then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = workerUrl;
      return lib;
    });
  }
  return libPromise;
}
