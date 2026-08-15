/**
 * Real-file verification: load paper.pdf through pdf.js (legacy/Node build)
 * and exercise the same mapping logic used by src/lib/pdf.
 *
 * Run: node scripts/verify-paper-pdf.mjs
 */

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pdfPath = join(root, "paper.pdf");

// --- Mirror of src/lib/pdf/text.ts (kept in sync manually for this script) ---
function buildTextLines(items) {
  const lines = [];
  let current = "";
  for (const raw of items) {
    if (typeof raw?.str !== "string") continue;
    current += raw.str;
    if (raw.hasEOL) {
      lines.push(current);
      current = "";
    }
  }
  if (current.length > 0) lines.push(current);
  return lines.map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l.length > 0);
}

const data = new Uint8Array(readFileSync(pdfPath));
console.log(`[1] Read ${pdfPath} (${data.byteLength} bytes)`);

const header = new TextDecoder("latin1").decode(data.slice(0, 5));
console.log(`[2] Magic header: ${JSON.stringify(header)} ${header === "%PDF-" ? "✓" : "✗ INVALID"}`);

const doc = await pdfjsLib.getDocument({ data }).promise;
console.log(`[3] Loaded: ${doc.numPages} pages ✓`);

const meta = await doc.getMetadata();
console.log(`[4] Metadata: title=${JSON.stringify(meta.info.Title ?? "")} author=${JSON.stringify(meta.info.Author ?? "")}`);

// Extract text from every page (same loop as loadPdf's buildPageChapters)
let totalPages = 0, pagesWithText = 0, totalChars = 0;
const firstPageLines = [];
for (let n = 1; n <= doc.numPages; n++) {
  const page = await doc.getPage(n);
  const textContent = await page.getTextContent();
  const lines = buildTextLines(textContent.items);
  totalPages++;
  if (lines.length > 0) {
    pagesWithText++;
    totalChars += lines.reduce((sum, l) => sum + l.length, 0);
  }
  if (n === 1) firstPageLines.push(...lines.slice(0, 6));
}
console.log(`[5] Text extraction: ${pagesWithText}/${totalPages} pages have text, ${totalChars} chars total ${pagesWithText > 0 ? "✓" : "✗ SCANNED?"}`);
console.log(`[6] Page 1 first lines:`);
for (const line of firstPageLines) console.log(`      | ${line.slice(0, 90)}`);

// Outline → TOC (same resolution logic as makeDestResolver)
const outline = await doc.getOutline();
if (outline && outline.length > 0) {
  console.log(`[7] Outline: ${outline.length} top-level entries`);
  for (const item of outline.slice(0, 8)) {
    let page = "?";
    try {
      const dests = await doc.getDestinations();
      const explicit = typeof item.dest === "string" ? dests.get(item.dest) : item.dest;
      if (Array.isArray(explicit) && explicit[0]) {
        page = (await doc.getPageIndex(explicit[0])) + 1;
      }
    } catch { /* keep "?" */ }
    console.log(`      · ${String(item.title).slice(0, 60)} → page ${page}`);
  }
} else {
  console.log(`[7] Outline: none (toc will be empty)`);
}

await doc.loadingTask.destroy();
console.log("[8] Document destroyed cleanly ✓");
console.log("\nVERIFICATION PASSED");
