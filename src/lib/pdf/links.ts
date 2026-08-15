/**
 * PDF link annotation helpers.
 *
 * PDFs DO carry link data: /Subtype /Link annotations on each page
 * (embedded by LaTeX hyperref, Word, etc.). Each annotation is a
 * rectangle in PDF user space plus a destination — an internal GoTo
 * target (explicit dest array or named dest) or an external URL.
 * Chrome's PDFium and Firefox's pdf.js render these as transparent
 * anchor elements over the canvas (the "annotation layer").
 *
 * These helpers convert pdf.js annotation data into viewport-space
 * link boxes and parse destination coordinates.
 */

/** A link box in page viewport (CSS pixel) coordinates. */
export interface PdfLinkBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A resolved internal link target. */
export interface PdfLinkTarget {
  /** 1-based target page number. */
  pageNumber: number;
  /** Target Y in target-page viewport coordinates (px from page top). */
  y: number;
}

/** A processed link annotation ready for rendering. */
export interface PdfLink {
  /** Annotation id (stable per page render). */
  id: string;
  /** Box over the page (viewport coordinates). */
  rect: PdfLinkBox;
  /** External URL, or null for internal links. */
  url: string | null;
  /** Internal target, or null for external links. */
  target: PdfLinkTarget | null;
}

/**
 * Normalize a viewport-space rectangle pair ([x1,y1,x2,y2], any corner
 * order) into a left/top/width/height box.
 */
export function normalizeLinkRect(rect: readonly number[]): PdfLinkBox {
  const [x1, y1, x2, y2] = rect;
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

/**
 * Read the zoom-type name out of an explicit dest array entry.
 * pdf.js resolves PDF name objects (/XYZ) to strings in some paths and
 * to { name: "XYZ" } objects in others — accept both.
 */
export function zoomTypeName(zoomType: unknown): string | null {
  if (typeof zoomType === "string") return zoomType;
  if (
    typeof zoomType === "object" &&
    zoomType !== null &&
    typeof (zoomType as { name?: unknown }).name === "string"
  ) {
    return (zoomType as { name: string }).name;
  }
  return null;
}

/**
 * Parse the display coordinates out of an explicit dest array.
 * Format: [pageRef, zoomType, left?, top?, zoom?]. Only /XYZ carries a
 * position (left, top in PDF user space); /Fit* destinations target the
 * page top.
 * @returns { left, top } in PDF user space, or nulls when not specified.
 */
export function parseDestPoint(
  dest: readonly unknown[],
): { left: number | null; top: number | null } {
  if (zoomTypeName(dest[1]) === "XYZ") {
    const left = typeof dest[2] === "number" ? dest[2] : null;
    const top = typeof dest[3] === "number" ? dest[3] : null;
    return { left, top };
  }
  // /Fit, /FitH, /FitV, ... — treat as top of page
  return { left: null, top: null };
}

/**
 * Classify a raw pdf.js link annotation for processing.
 */
export function isLinkAnnotation(annotation: {
  subtype?: string;
}): boolean {
  return annotation.subtype === "Link";
}
