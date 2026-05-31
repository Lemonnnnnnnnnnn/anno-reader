/**
 * DOM extraction utilities for dictionary lookups.
 * Uses native browser APIs — no external dependencies.
 */

import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

/** Whether running in Tauri environment */
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Extract text content from a DOM element.
 *
 * @param parent - Root element to search within
 * @param selector - CSS selector to find target element (omit to use parent directly)
 * @param transform - Optional function to transform the extracted text
 * @returns Extracted text, or empty string if not found
 */
export function getText(
  parent: ParentNode,
  selector?: string,
  transform?: (text: string) => string,
): string {
  const el = selector ? parent.querySelector(selector) : parent;
  if (!el) return "";
  const text = el.textContent?.trim() ?? "";
  return transform ? transform(text) : text;
}

/**
 * Extract innerHTML from a DOM element with optional tag/attribute filtering.
 * Strips `<script>` and `<style>` tags for safety.
 *
 * @param parent - Root element to search within
 * @param selector - CSS selector (omit to use parent)
 * @param options.allowedTags - If provided, only these tag names are kept
 * @param options.allowedAttributes - If provided, only these attributes are kept
 * @returns Inner HTML string
 */
export function getHTML(
  parent: ParentNode,
  selector?: string,
  options?: { allowedTags?: string[]; allowedAttributes?: string[] },
): string {
  const el = selector ? parent.querySelector(selector) : parent;
  if (!el) return "";

  let html = ("innerHTML" in el ? (el as HTMLElement).innerHTML : "") ?? "";

  // Strip script and style tags and their contents
  html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<style[\s\S]*?<\/style>/gi, "");

  if (options?.allowedTags) {
    const keep = new Set(options.allowedTags.map((t) => t.toLowerCase()));
    html = html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match: string, tag: string) => {
      return keep.has(tag.toLowerCase()) ? match : "";
    });
  }

  if (options?.allowedAttributes) {
    const keep = new Set(options.allowedAttributes.map((a) => a.toLowerCase()));
    html = html.replace(/\s+([a-zA-Z-]+)=("[^"]*"|'[^']*'|[^\s>]*)/g, (_match: string, attr: string, value: string) => {
      return keep.has(attr.toLowerCase()) ? ` ${attr}=${value}` : "";
    });
  }

  return html;
}

/**
 * Convert a relative URL to an absolute URL.
 *
 * @param baseUrl - Absolute base URL
 * @param relativeUrl - Relative URL to resolve
 * @returns Absolute URL string, or the original relativeUrl if resolution fails
 */
export function resolveRelativeUrl(baseUrl: string, relativeUrl: string): string {
  if (!relativeUrl) return "";
  try {
    return new URL(relativeUrl, baseUrl).href;
  } catch {
    return relativeUrl;
  }
}

/**
 * Fetch with timeout enforcement.
 *
 * Uses Tauri's HTTP plugin in Tauri environment (bypasses CORS),
 * falls back to browser fetch in development/SSR.
 *
 * @param url - URL to fetch
 * @param options - Standard RequestInit plus optional timeout in ms (default 10000)
 * @returns Response promise
 * @throws Error on timeout
 */
export async function fetchWithTimeout(
  url: string,
  options?: RequestInit & { timeout?: number },
): Promise<Response> {
  const { timeout = 10000, ...fetchOptions } = options ?? {};

  // Use Tauri HTTP plugin when available (bypasses CORS)
  if (isTauri) {
    try {
      const response = await tauriFetch(url, {
        ...fetchOptions,
        timeout,
        // Tauri expects headers as Record<string, string>
        headers: normalizeHeaders(fetchOptions.headers),
      });
      return response;
    } catch (err) {
      if (err instanceof Error && err.message.includes("timeout")) {
        throw new Error(`Fetch timed out after ${timeout}ms: ${url}`);
      }
      throw err;
    }
  }

  // Fallback: browser fetch with AbortController
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Fetch timed out after ${timeout}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Normalize HeadersInit to Record<string, string> for Tauri HTTP plugin.
 */
function normalizeHeaders(
  headers?: HeadersInit,
): Record<string, string> | undefined {
  if (!headers) return undefined;

  if (headers instanceof Headers) {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return headers as Record<string, string>;
}

/**
 * Parse an HTML string into a Document.
 *
 * @param html - Raw HTML string
 * @returns Parsed Document (never null — falls back to empty document)
 */
export function parseHTML(html: string): Document {
  if (!html) return new DOMParser().parseFromString("", "text/html");
  return new DOMParser().parseFromString(html, "text/html");
}
