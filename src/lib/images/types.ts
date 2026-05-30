/**
 * Types for the image resolution module.
 */

/** Result of resolving an image path in EPUB content */
export interface ResolvedImage {
  /** Original src attribute from the HTML */
  originalSrc: string;
  /** Resolved data URL (base64) or fallback placeholder */
  dataUrl: string;
  /** Whether the image was successfully resolved */
  resolved: boolean;
  /** MIME type of the image (if resolved) */
  mimeType?: string;
}

/** Options for image resolution */
export interface ImageResolutionOptions {
  /** Base folder for resolving relative paths (epub.opfFolder) */
  opfFolder?: string;
  /** Chapter href for resolving relative paths */
  chapterHref?: string;
  /** Whether to use lazy loading for images (default: true) */
  lazyLoad?: boolean;
  /** Maximum image dimension for resizing (0 = no limit) */
  maxDimension?: number;
  /** Map from normalized file path to manifest resource ID */
  manifestHrefs?: Record<string, string>;
}

/** Cache entry for resolved images */
export interface ImageCacheEntry {
  dataUrl: string;
  mimeType: string;
  timestamp: number;
}
