/**
 * Tests for usePdfLinks — /Link annotation extraction and destination
 * resolution against a fake pdf.js document.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PdfLink } from "@/lib/pdf/links";
import { usePdfLinks } from "../hooks/usePdfLinks";

/** Page reference resolving to page index 1 (2nd page). */
const pageRef = { num: 5, gen: 0 };

/**
 * Fake pdf.js document:
 * - page 1 has a named-dest citation link, an explicit-dest TOC link,
 *   and an external URL link (plus a non-Link annotation to be ignored)
 */
function makeFakeDoc() {
  const annotationsByPage = new Map<number, unknown[]>([
    [
      1,
      [
        { id: "cite-32", subtype: "Link", rect: [100, 700, 120, 712], dest: "cite.32" },
        {
          id: "toc-intro",
          subtype: "Link",
          rect: [70, 650, 300, 662],
          dest: [pageRef, { name: "XYZ" }, 70.9, 751.4, 0],
        },
        { id: "doi", subtype: "Link", rect: [200, 100, 400, 110], url: "https://doi.org/10.1000/xyz" },
        { id: "widget-1", subtype: "Widget", rect: [0, 0, 10, 10] },
      ],
    ],
    [2, []],
  ]);

  return {
    numPages: 2,
    getPage: async (n: number) => ({
      getViewport: () => ({
        // Test-friendly transforms: rectangle flips y-pair, point is identity
        convertToViewportRectangle: (r: number[]) => [r[0], r[3], r[2], r[1]],
        convertToViewportPoint: (x: number, y: number) => [x, y] as [number, number],
      }),
      getAnnotations: async () => annotationsByPage.get(n) ?? [],
    }),
    getDestination: async (name: string) => {
      if (name === "cite.32") return [pageRef, "XYZ", 72, 120, 0];
      return null;
    },
    getPageIndex: async (ref: { num: number }) => ref.num - 4,
  } as unknown as PDFDocumentProxy;
}

/** Probe: mount the hook and capture its output. */
function Probe({
  doc,
  pageNumber,
  scale,
  onLinks,
}: {
  doc: PDFDocumentProxy | null;
  pageNumber: number;
  scale: number;
  onLinks: (links: PdfLink[]) => void;
}) {
  const links = usePdfLinks(doc, pageNumber, scale);
  onLinks(links);
  return <div />;
}

function waitFor(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

describe("usePdfLinks", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("extracts internal (named + explicit) and external links", async () => {
    const doc = makeFakeDoc();
    let captured: PdfLink[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);

    await act(async () => {
      createRoot(container).render(
        <Probe doc={doc} pageNumber={1} scale={1} onLinks={(l) => (captured = l)} />,
      );
      await waitFor(20);
    });

    expect(captured).toHaveLength(3); // the Widget annotation is dropped

    const byId = Object.fromEntries(captured.map((l) => [l.id, l]));

    // Named dest resolved via getDestination → page 2 with XYZ position
    expect(byId["cite-32"].url).toBeNull();
    expect(byId["cite-32"].target).toMatchObject({ pageNumber: 2, y: 120 });

    // Explicit dest with a name-object zoom type (real-PDF shape)
    expect(byId["toc-intro"].target).toMatchObject({ pageNumber: 2, y: 751.4 });

    // External URL link carries no internal target
    expect(byId["doi"].url).toBe("https://doi.org/10.1000/xyz");
    expect(byId["doi"].target).toBeNull();
  });

  it("returns empty for null documents", async () => {
    let captured: PdfLink[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);

    await act(async () => {
      createRoot(container).render(
        <Probe doc={null} pageNumber={1} scale={1} onLinks={(l) => (captured = l)} />,
      );
      await waitFor(10);
    });

    expect(captured).toEqual([]);
  });
});
