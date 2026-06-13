/**
 * Web page fetcher using the Tauri proxy-aware fetch wrapper.
 *
 * Fetches raw HTML content from a URL, extracts the page title,
 * and returns a WebPage object. HTML-to-plainText conversion is
 * handled separately by the cleaning module.
 */

import { proxyFetch } from "@/lib/proxy/fetch";
import type { WebPage, FetchOptions } from "./types";

/** Default request timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Fetch a web page and return its content as a {@link WebPage}.
 *
 * @param url - The URL to fetch
 * @param options - Optional fetch configuration (timeout, userAgent)
 * @returns A WebPage with raw HTML, extracted title, and metadata
 * @throws On HTTP errors (non-2xx status) or network/timeout failures
 */
export async function fetchWebPage(
  url: string,
  options?: FetchOptions,
): Promise<WebPage> {
  const timeoutMs = options?.timeout ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {};
    if (options?.userAgent) {
      headers["User-Agent"] = options.userAgent;
    }

    const response = await proxyFetch(url, {
      signal: controller.signal,
      headers,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch page: HTTP ${response.status} ${response.statusText}`,
      );
    }

    const html = await response.text();
    const title = extractTitle(html);

    return {
      url,
      title,
      html,
      plainText: "",
      fetchedAt: new Date(),
    };
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timerId);
  }
}

/**
 * Extract the page title from an HTML string.
 *
 * Looks for the first `<title>` tag content. Falls back to an empty
 * string if no title is found.
 */
function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.trim() ?? "";
}

/**
 * Check whether an error is an AbortError (timeout or manual abort).
 */
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
