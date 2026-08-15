/** Verify link annotations in a PDF via pdf.js (Node, legacy build). */
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("usage: node scripts/check-pdf-links.mjs <path-to-pdf>");
  process.exit(1);
}

const data = new Uint8Array(readFileSync(pdfPath));
const doc = await pdfjsLib.getDocument({ data }).promise;
console.log(`pages: ${doc.numPages}`);

let total = 0, internal = 0, external = 0;
const samples = [];

for (let n = 1; n <= doc.numPages; n++) {
  const page = await doc.getPage(n);
  const annots = await page.getAnnotations();
  for (const a of annots) {
    if (a.subtype !== "Link") continue;
    total++;
    if (a.url || a.unsafeUrl) { external++; continue; }
    if (a.dest) {
      internal++;
      if (samples.length < 8) {
        try {
          const explicit = typeof a.dest === "string" ? await doc.getDestination(a.dest) : a.dest;
          let target = "?";
          if (Array.isArray(explicit) && explicit[0]) {
            const idx = await doc.getPageIndex(explicit[0]);
            target = `page ${idx + 1} ${explicit[1]} [${explicit.slice(2).map(v => (typeof v === "number" ? v.toFixed(1) : v)).join(", ")}]`;
          }
          samples.push(`p${n} ${typeof a.dest === "string" ? `named(${a.dest})` : "explicit"} → ${target}`);
        } catch (e) {
          samples.push(`p${n} dest resolve failed: ${e.message}`);
        }
      }
    }
  }
}
console.log(`links: total=${total} internal=${internal} external=${external}`);
for (const s of samples) console.log(`  · ${s}`);
await doc.loadingTask.destroy();
