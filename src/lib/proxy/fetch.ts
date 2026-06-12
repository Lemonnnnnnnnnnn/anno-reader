/**
 * Tauri-aware fetch wrapper.
 *
 * Always uses tauriFetch from @tauri-apps/plugin-http. When proxy is
 * enabled, routes requests through the configured proxy.
 *
 * Usage:
 *   import { proxyFetch } from "@/lib/proxy/fetch";
 *   const response = await proxyFetch("https://api.example.com");
 */

import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { useProxyConfigStore } from "@/stores/useProxyConfigStore";
import type { ProxyConfig } from "../storage/config";

/**
 * Create a fetch function that uses tauriFetch, optionally routing
 * through a proxy when enabled.
 *
 * - **Proxy disabled** → returns `tauriFetch` without proxy config
 * - **Proxy enabled** → returns a wrapper that calls `tauriFetch` with
 *   `proxy: { all: "http://<address>:<port>" }`
 *
 * @param proxyConfig - Proxy configuration (enabled, address, port)
 * @returns A `fetch`-compatible function
 */
export function createProxyFetch(proxyConfig: ProxyConfig): typeof fetch {
  if (!proxyConfig.enabled) {
    return tauriFetch;
  }

  const proxyUrl = `http://${proxyConfig.address}:${proxyConfig.port}`;

  const fetchFn: typeof fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    return tauriFetch(input as string | URL, {
      ...init,
      proxy: { all: proxyUrl },
    });
  };

  return fetchFn;
}

/**
 * Convenience fetch that reads proxy config from the store automatically.
 *
 * Use this as a drop-in replacement for `fetch()` — it always uses
 * tauriFetch, routing through the proxy when enabled.
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
