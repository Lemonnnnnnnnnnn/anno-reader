/**
 * Types for the font extraction module.
 * Handles font extraction from EPUB files and conversion to data URIs.
 */

/** Supported font formats */
export type FontFormat = "woff2" | "woff" | "truetype" | "opentype";

/** A font extracted from an EPUB file */
export interface ExtractedFont {
  /** Original resource ID from the EPUB manifest */
  id: string;
  /** Font family name (extracted from filename or resource ID) */
  family: string;
  /** Font format for @font-face src descriptor */
  format: FontFormat;
  /** Font data as a base64 data URI */
  dataUrl: string;
  /** Font weight (e.g., "normal", "bold", "400") */
  weight?: string;
  /** Font style (e.g., "normal", "italic") */
  style?: string;
}

/** Options for font extraction */
export interface FontExtractionOptions {
  /** Whether to attempt extracting weight/style from filename (default: true) */
  inferMetadata?: boolean;
  /** Custom font family name override */
  fontFamily?: string;
}
