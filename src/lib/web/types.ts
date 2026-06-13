/**
 * Type definitions for the web reader module.
 *
 * Handles fetching and representing web page content
 * for reading within the app.
 */

/**
 * A fetched web page with full content.
 */
export interface WebPage {
  /** The URL the page was fetched from */
  url: string;
  /** Page title extracted from <title> or og:title */
  title: string;
  /** Raw HTML content */
  html: string;
  /** Extracted plain text content */
  plainText: string;
  /** When the page was fetched */
  fetchedAt: Date;
}

/**
 * Lightweight metadata for a web page (no content).
 */
export interface WebPageMetadata {
  /** The URL the page was fetched from */
  url: string;
  /** Page title extracted from <title> or og:title */
  title: string;
  /** Favicon URL if available */
  favicon?: string;
  /** When the page was fetched */
  fetchedAt: Date;
}

/**
 * Options for fetching a web page.
 */
export interface FetchOptions {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Whether to route through the configured proxy */
  proxy?: boolean;
  /** Custom User-Agent header */
  userAgent?: string;
}
