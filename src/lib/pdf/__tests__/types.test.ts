/**
 * Tests for PDF module type helpers.
 *
 * @vitest-environment node
 */

import { describe, it, expect } from "vitest";
import { pageHref, pageNumberFromHref, PAGE_HREF_PREFIX } from "../types";

describe("pageHref", () => {
  it("builds 1-based page hrefs", () => {
    expect(pageHref(1)).toBe("page-1");
    expect(pageHref(42)).toBe("page-42");
  });
});

describe("pageNumberFromHref", () => {
  it("round-trips pageHref", () => {
    for (const n of [1, 2, 10, 999]) {
      expect(pageNumberFromHref(pageHref(n))).toBe(n);
    }
  });

  it("returns null for non-page hrefs", () => {
    expect(pageNumberFromHref("chapter1.xhtml")).toBeNull();
    expect(pageNumberFromHref("page-x")).toBeNull();
    expect(pageNumberFromHref("page-0")).toBeNull();
    expect(pageNumberFromHref("page--3")).toBeNull();
  });
});

describe("PAGE_HREF_PREFIX", () => {
  it("matches hrefs produced by pageHref", () => {
    expect(pageHref(7).startsWith(PAGE_HREF_PREFIX)).toBe(true);
  });
});
