/**
 * Tests for PDF link annotation helpers.
 *
 * @vitest-environment node
 */

import { describe, it, expect } from "vitest";
import {
  normalizeLinkRect,
  parseDestPoint,
  zoomTypeName,
  isLinkAnnotation,
} from "../links";

describe("normalizeLinkRect", () => {
  it("normalizes rectangles given in any corner order", () => {
    expect(normalizeLinkRect([10, 20, 110, 50])).toEqual({
      left: 10,
      top: 20,
      width: 100,
      height: 30,
    });
    // pdf.js emits [x1,y1,x2,y2] with y flipped — corners may be reversed
    expect(normalizeLinkRect([110, 50, 10, 20])).toEqual({
      left: 10,
      top: 20,
      width: 100,
      height: 30,
    });
  });

  it("handles degenerate (zero-area) rectangles", () => {
    expect(normalizeLinkRect([5, 5, 5, 5])).toEqual({
      left: 5,
      top: 5,
      width: 0,
      height: 0,
    });
  });
});

describe("zoomTypeName", () => {
  it("accepts plain strings", () => {
    expect(zoomTypeName("XYZ")).toBe("XYZ");
    expect(zoomTypeName("FitH")).toBe("FitH");
  });

  it("accepts pdf.js name objects ({ name: 'XYZ' })", () => {
    expect(zoomTypeName({ name: "XYZ" })).toBe("XYZ");
    expect(zoomTypeName({ name: "Fit" })).toBe("Fit");
  });

  it("returns null for other shapes", () => {
    expect(zoomTypeName(undefined)).toBeNull();
    expect(zoomTypeName(null)).toBeNull();
    expect(zoomTypeName(42)).toBeNull();
    expect(zoomTypeName({})).toBeNull();
  });
});

describe("parseDestPoint", () => {
  it("extracts XYZ coordinates (left, top)", () => {
    const dest = [{ num: 3, gen: 0 }, "XYZ", 70.9, 751.4, 0];
    expect(parseDestPoint(dest)).toEqual({ left: 70.9, top: 751.4 });
  });

  it("handles name-object zoom types from real PDFs", () => {
    // pdf.js resolves /XYZ name objects to { name: "XYZ" } in some paths
    const dest = [{ num: 3, gen: 0 }, { name: "XYZ" }, 70.9, 751.4, 0];
    expect(parseDestPoint(dest)).toEqual({ left: 70.9, top: 751.4 });
  });

  it("tolerates missing XYZ coordinates", () => {
    const dest = [{ num: 3, gen: 0 }, "XYZ", null, null, null];
    expect(parseDestPoint(dest)).toEqual({ left: null, top: null });
  });

  it("treats Fit-family destinations as page top", () => {
    expect(parseDestPoint([{ num: 3, gen: 0 }, "Fit"])).toEqual({
      left: null,
      top: null,
    });
    expect(parseDestPoint([{ num: 3, gen: 0 }, { name: "FitH" }, 500])).toEqual({
      left: null,
      top: null,
    });
  });
});

describe("isLinkAnnotation", () => {
  it("matches the Link subtype only", () => {
    expect(isLinkAnnotation({ subtype: "Link" })).toBe(true);
    expect(isLinkAnnotation({ subtype: "Widget" })).toBe(false);
    expect(isLinkAnnotation({})).toBe(false);
  });
});
