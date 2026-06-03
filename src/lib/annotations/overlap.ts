/**
 * Overlap detection utilities for annotations.
 *
 * Provides functions for parsing CFI ranges, detecting overlaps between
 * character offset ranges, finding overlapping highlights, and merging
 * ranges for auto-merge during annotation operations.
 *
 * All ranges use half-open intervals: [start, end) — end is exclusive.
 */

/** A half-open interval [start, end). */
export type Range = [number, number];

// ── parseCfiRange ─────────────────────────────────────────────────────────────

/**
 * Extract character offsets from a pseudo-CFI range string.
 *
 * Matches the pattern `:start,end)` at the end of strings like:
 *   `epubcfi(/6/4[chap01]!/4/2:10,20)`
 *
 * @returns A `[start, end)` tuple, or `null` if the CFI cannot be parsed.
 */
export function parseCfiRange(cfi: string): Range | null {
  const match = cfi.match(/:(\d+),(\d+)\)$/);
  if (!match) return null;
  return [parseInt(match[1], 10), parseInt(match[2], 10)];
}

// ── hasOverlap ────────────────────────────────────────────────────────────────

/**
 * Check whether two half-open ranges overlap.
 *
 * Adjacent ranges like `[10, 50)` and `[50, 80)` do NOT overlap because
 * the end of one equals the start of the other (no interior intersection).
 *
 * @returns `true` if the ranges share at least one interior point.
 */
export function hasOverlap(a: Range, b: Range): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

// ── findOverlappingHighlights ─────────────────────────────────────────────────

/**
 * Find all highlights in `allHighlights` whose range overlaps with the
 * given highlight's range.
 *
 * Returns highlights that share at least one character offset with the
 * target. The caller can exclude the highlight itself by filtering on `id`.
 *
 * Gracefully returns `[]` if the target's CFI cannot be parsed.
 */
export function findOverlappingHighlights<T extends { cfiRange: string }>(
  highlight: { cfiRange: string },
  allHighlights: T[],
): T[] {
  const targetRange = parseCfiRange(highlight.cfiRange);
  if (!targetRange) return [];

  return allHighlights.filter((candidate) => {
    const candidateRange = parseCfiRange(candidate.cfiRange);
    if (!candidateRange) return false;
    return hasOverlap(targetRange, candidateRange);
  });
}

// ── mergeRanges ───────────────────────────────────────────────────────────────

/**
 * Merge overlapping and adjacent ranges into non-overlapping spans.
 *
 * Adjacent ranges (where one ends exactly where the next starts) are merged
 * into a single continuous span. Input order does not matter — ranges are
 * sorted by start position before merging.
 *
 * @example
 * ```ts
 * mergeRanges([[0, 10], [5, 15], [20, 30]]) // → [[0, 15], [20, 30]]
 * mergeRanges([[0, 10], [10, 20]])           // → [[0, 20]]  (adjacent → merged)
 * ```
 */
export function mergeRanges(ranges: Range[]): Range[] {
  if (ranges.length === 0) return [];

  // Sort by start position
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);

  const merged: Range[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];

    // Merge if overlapping or adjacent
    if (current[0] <= last[1]) {
      last[1] = Math.max(last[1], current[1]);
    } else {
      merged.push(current);
    }
  }

  return merged;
}
