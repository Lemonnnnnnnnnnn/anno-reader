/**
 * Proxy-aware fetch wrapper.
 *
 * Routes requests through a proxy when enabled, using tauriFetch from
 * @tauri-apps/plugin-http. Falls back to standard browser fetch when
 * proxy is disabled.
 *
 * Usage:
 *   import { proxyFetch } from "@/lib/proxy/fetch";
 *   const response = await proxyFetch("https://api.example.com");
 */

import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { useProxyConfigStore } from "@/stores/useProxyConfigStore";
import type { ProxyConfig } from "../storage/config";

/**
 * Whether currently running inside a Tauri webview.
 * Evaluated at call time (not module load) so tests can control the result.
 */
function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
  );
}

/**
 * Create a fetch function that optionally routes through a proxy.
 *
 * - **Proxy disabled** → returns standard browser `fetch`
 * - **Proxy enabled** → returns a wrapper that calls `tauriFetch` with
 *   `proxy: { all: "http://<address>:<port>" }`
 *
 * @param proxyConfig - Proxy configuration (enabled, address, port)
 * @returns A `fetch`-compatible function
 */
export function createProxyFetch(proxyConfig: ProxyConfig): typeof fetch {
  if (!proxyConfig.enabled) {
    return globalThis.fetch.bind(globalThis);
  }

  if (!isTauriRuntime()) {
    // Outside Tauri runtime, proxy via tauriFetch is unavailable
    console.warn(
      "createProxyFetch: proxy enabled but not running in Tauri — falling back to browser fetch",
    );
    return globalThis.fetch.bind(globalThis);
  }

  const proxyUrl = `http://${proxyConfig.address}:${proxyConfig.port}`;

  const proxyFetch: typeof fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    try {
      return await tauriFetch(input as string | URL, {
        ...init,
        proxy: { all: proxyUrl },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Proxy request failed (${proxyUrl}): ${message}`);
    }
  };

  return proxyFetch;
}

/**
 * Convenience fetch that reads proxy config from the store automatically.
 *
 * Use this as a drop-in replacement for `fetch()` — it routes through
 * the proxy when enabled, falls back to browser fetch when disabled.
 *
 * @example
 *   import { proxyFetch } from "@/lib/proxy/fetch";
 *   const response = await proxyFetch("https://api.example.com/data");
 */
export async function proxyFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const { enabled, address, port } = useProxyConfigStore.getState();
  const fetchFn = createProxyFetch({ enabled, address, port });
  return fetchFn(input, init);
}
