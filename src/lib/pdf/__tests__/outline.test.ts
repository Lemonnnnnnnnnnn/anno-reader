/**
 * Tests for PDF outline → EPUB TOC mapping.
 *
 * @vitest-environment node
 */

import { describe, it, expect } from "vitest";
import { outlineToToc, type RawOutlineItem } from "../outline";

/** Resolver that maps dests to pages from a lookup table. */
function resolverFrom(map: Record<string, number | null>) {
  return async (dest: unknown) =>
    typeof dest === "string" ? (map[dest] ?? null) : null;
}

describe("outlineToToc", () => {
  it("maps flat outlines to page hrefs", async () => {
    const outline: RawOutlineItem[] = [
      { title: "Introduction", dest: "intro" },
      { title: "Methods", dest: "methods" },
    ];
    const toc = await outlineToToc(outline, resolverFrom({ intro: 1, methods: 5 }));
    expect(toc).toEqual([
      { title: "Introduction", href: "page-1" },
      { title: "Methods", href: "page-5" },
    ]);
  });

  it("preserves nested children", async () => {
    const outline: RawOutlineItem[] = [
      {
        title: "Part I",
        dest: "p1",
        items: [{ title: "Chapter 1", dest: "c1" }],
      },
    ];
    const toc = await outlineToToc(outline, resolverFrom({ p1: 1, c1: 3 }));
    expect(toc).toEqual([
      {
        title: "Part I",
        href: "page-1",
        children: [{ title: "Chapter 1", href: "page-3" }],
      },
    ]);
  });

  it("drops entries whose dest cannot be resolved", async () => {
    const outline: RawOutlineItem[] = [
      { title: "OK", dest: "ok" },
      { title: "Broken", dest: "missing" },
      { title: "", dest: "ok" }, // empty title also dropped
    ];
    const toc = await outlineToToc(outline, resolverFrom({ ok: 2 }));
    expect(toc).toEqual([{ title: "OK", href: "page-2" }]);
  });

  it("caps nesting depth at 3 levels", async () => {
    const deep: RawOutlineItem = { title: "L1", dest: "d", items: [] };
    let node = deep;
    for (let i = 2; i <= 6; i++) {
      const child: RawOutlineItem = { title: `L${i}`, dest: "d", items: [] };
      node.items = [child];
      node = child;
    }
    const toc = await outlineToToc([deep], resolverFrom({ d: 1 }));

    let depth = 0;
    let entry = toc[0];
    while (entry) {
      depth++;
      entry = entry.children?.[0];
    }
    expect(depth).toBe(3);
  });

  it("returns empty for null outline", async () => {
    expect(await outlineToToc(null, resolverFrom({}))).toEqual([]);
  });

  it("omits children key when there are no children", async () => {
    const toc = await outlineToToc(
      [{ title: "Solo", dest: "s" }],
      resolverFrom({ s: 1 }),
    );
    expect(toc[0]).not.toHaveProperty("children");
  });
});
