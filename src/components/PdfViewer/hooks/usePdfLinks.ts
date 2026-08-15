/**
 * usePdfLinks hook.
 *
 * Extracts /Link annotations for the current page and resolves each
 * destination into a renderable link box + navigation target:
 * - external links carry their URL (opened via the opener plugin)
 * - internal links carry { pageNumber, y } (target page + viewport Y),
 *   with named destinations resolved through the document
 *
 * Re-runs when the page or scale changes (boxes are viewport-relative).
 */

import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  isLinkAnnotation,
  normalizeLinkRect,
  parseDestPoint,
  type PdfLink,
  type PdfLinkTarget,
} from "@/lib/pdf/links";

export function usePdfLinks(
  doc: PDFDocumentProxy | null,
  pageNumber: number,
  scale: number,
): PdfLink[] {
  const [links, setLinks] = useState<PdfLink[]>([]);

  useEffect(() => {
    if (!doc || pageNumber < 1 || pageNumber > doc.numPages) {
      setLinks([]);
      return;
    }

    const document_ = doc;
    let cancelled = false;

    /**
     * Resolve a raw dest (named string or explicit array) to a target
     * page + viewport Y, using the target page's viewport at the
     * current scale.
     */
    async function resolveTarget(dest: unknown): Promise<PdfLinkTarget | null> {
      try {
        const explicit =
          typeof dest === "string" ? await document_.getDestination(dest) : dest;
        if (!Array.isArray(explicit) || explicit.length === 0) return null;

        const pageIndex = await document_.getPageIndex(explicit[0] as never);
        const targetPage = await document_.getPage(pageIndex + 1);
        const viewport = targetPage.getViewport({ scale });

        const { left, top } = parseDestPoint(explicit);
        // PDF user space origin is bottom-left; convertToViewportPoint
        // flips to CSS coordinates. Missing coords → page top/left.
        const [, y] = viewport.convertToViewportPoint(left ?? 0, top ?? 0);
        return { pageNumber: pageIndex + 1, y: Math.max(0, y) };
      } catch (err) {
        console.warn("[pdf] Failed to resolve link destination:", dest, err);
        return null;
      }
    }

    async function extract() {
      try {
        const page = await document_.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        const annotations = (await page.getAnnotations()) as Array<{
          id?: string;
          subtype?: string;
          rect?: number[];
          url?: string;
          unsafeUrl?: string;
          dest?: unknown;
        }>;

        const out: PdfLink[] = [];
        for (const [index, a] of annotations.entries()) {
          if (!isLinkAnnotation(a) || !a.rect) continue;

          // pdf.js 6 removed convertToViewportRectangle — convert the two
          // rect corners through the (rotation-aware) point transform
          const [ax, ay] = viewport.convertToViewportPoint(a.rect[0], a.rect[1]);
          const [bx, by] = viewport.convertToViewportPoint(a.rect[2], a.rect[3]);
          const box = normalizeLinkRect([ax, ay, bx, by]);

          if (a.url || a.unsafeUrl) {
            out.push({
              id: a.id ?? `link-${pageNumber}-${index}`,
              rect: box,
              url: a.url ?? a.unsafeUrl ?? null,
              target: null,
            });
            continue;
          }

          if (a.dest) {
            const target = await resolveTarget(a.dest);
            if (target) {
              out.push({
                id: a.id ?? `link-${pageNumber}-${index}`,
                rect: box,
                url: null,
                target,
              });
            }
          }
        }

        if (!cancelled) setLinks(out);
      } catch (err) {
        console.warn("[pdf] Failed to extract link annotations:", err);
        if (!cancelled) setLinks([]);
      }
    }

    void extract();
    return () => {
      cancelled = true;
    };
  }, [doc, pageNumber, scale]);

  return links;
}
