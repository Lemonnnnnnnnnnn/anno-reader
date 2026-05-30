/**
 * Font injection into chapter content.
 *
 * Generates @font-face CSS rules from extracted fonts and provides
 * utilities for injecting them into chapter HTML.
 */

import type { ExtractedFont } from "./types";

/**
 * Build @font-face CSS rules from extracted fonts.
 *
 * @param fonts - Array of extracted fonts
 * @returns CSS string containing all @font-face rules
 */
export function buildFontFaceCss(fonts: ExtractedFont[]): string {
  if (fonts.length === 0) return "";

  return fonts.map((font) => buildSingleFontFace(font)).join("\n\n");
}

/**
 * Build a single @font-face rule for a font.
 */
function buildSingleFontFace(font: ExtractedFont): string {
  const { family, format, dataUrl, weight, style } = font;

  let rule = `@font-face {
  font-family: '${escapeCssString(family)}';
  src: url('${dataUrl}') format('${format}');
`;

  if (weight) {
    rule += `  font-weight: ${weight};\n`;
  }

  if (style) {
    rule += `  font-style: ${style};\n`;
  }

  rule += "}";
  return rule;
}

/**
 * Inject @font-face CSS into an HTML string.
 *
 * Inserts a <style> block with font-face rules into the <head> of the HTML.
 * If no <head> tag exists, creates one.
 *
 * @param html - The HTML string to inject into
 * @param fontFaceCss - The @font-face CSS rules
 * @returns Modified HTML string with font-face rules injected
 */
export function injectFontFaces(html: string, fontFaceCss: string): string {
  if (!fontFaceCss.trim()) return html;

  const styleBlock = `<style id="epub-fonts">\n${fontFaceCss}\n</style>`;

  // Try to inject into existing <head>
  if (html.includes("<head>")) {
    return html.replace("<head>", `<head>\n  ${styleBlock}`);
  }

  // If no <head>, try to inject before </head>
  if (html.includes("</head>")) {
    return html.replace("</head>", `  ${styleBlock}\n</head>`);
  }

  // If no head tags at all, prepend the style block
  return `${styleBlock}\n${html}`;
}

/**
 * Escape special characters in a CSS string (for font-family names).
 */
function escapeCssString(str: string): string {
  return str.replace(/['"\\]/g, "\\$&");
}
