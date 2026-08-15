/**
 * Guards the pdf.js text layer CSS contract.
 *
 * pdf.js v6 computes each span's font-size through a CSS custom-property
 * chain that requires caller-provided --total-scale-factor (set in
 * usePdfPage). If these rules are removed, spans render at inherited
 * font-size and misalign with the canvas glyphs — text selection breaks
 * ("visible text can't be selected"). This test pins the required rules.
 *
 * @vitest-environment node
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const appCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../App.css"),
  "utf8",
);

describe("pdf text layer CSS", () => {
  it("defines the --total-scale-factor font-size chain", () => {
    expect(appCss).toContain("--text-scale-factor: calc(var(--total-scale-factor");
    expect(appCss).toMatch(/--min-font-size:\s*1/);
  });

  it("sizes pdf.js spans from --font-height", () => {
    expect(appCss).toContain(
      "font-size: calc(var(--text-scale-factor) * var(--font-height))",
    );
  });

  it("applies the horizontal fitting transform", () => {
    expect(appCss).toContain("scaleX(var(--scale-x))");
    expect(appCss).toContain("rotate(var(--rotate))");
  });

  it("marks annotation spans as nested (not direct children)", () => {
    // The official rule must only target direct children so injected
    // .anno-highlight/.anno-note spans inherit the scaled font-size
    expect(appCss).toContain(".pdfTextLayer > :not(.markedContent)");
  });

  it("keeps text layer spans selectable with transparent color", () => {
    expect(appCss).toContain(".pdfTextLayer :is(span, br)");
    expect(appCss).toMatch(/user-select:\s*text/);
  });

  it("gives note underlines an explicit visible color (text layer is transparent)", () => {
    // text-decoration defaults to currentColor; the text layer is
    // color: transparent, which would draw an invisible underline
    expect(appCss).toMatch(/\.pdfTextLayer \.anno-note\s*\{[^}]*text-decoration-color:\s*#374151/s);
    expect(appCss).toMatch(/\.dark \.pdfTextLayer \.anno-note\s*\{[^}]*text-decoration-color:\s*#60a5fa/s);
  });

  it("keeps the link layer non-interactive except for anchors", () => {
    // Layer must be pointer-events:none so selection drags pass through;
    // anchors re-enable interaction
    expect(appCss).toMatch(/\.pdfLinkLayer\s*\{[^}]*pointer-events:\s*none/s);
    expect(appCss).toMatch(/\.pdfLinkLayer \.pdfLinkAnchor\s*\{[^}]*pointer-events:\s*auto/s);
  });
});
