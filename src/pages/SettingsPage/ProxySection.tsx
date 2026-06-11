/**
 * ProxySection component.
 *
 * Manages proxy configuration: enable/disable toggle, address, and port.
 * Shows inline validation errors and disables save when invalid.
 * Handles graceful degradation when proxy is unreachable.
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { useProxyConfigStore } from "@/stores/useProxyConfigStore";
import {
  validateProxyConfig,
  type ProxyValidationError,
} from "@/lib/proxy/validation";
import { createProxyFetch } from "@/lib/proxy/fetch";

/** URL used to test proxy connectivity. */
const PROXY_TEST_URL = "http://www.gstatic.com/generate_204";

export function ProxySection() {
  const { enabled, address, port, isLoaded, setEnabled, setAddress, setPort, loadConfig } =
    useProxyConfigStore();

  const [touched, setTouched] = useState<{ address: boolean; port: boolean }>({
    address: false,
    port: false,
  });
  const [proxyError, setProxyError] = useState<string | null>(null);

  const config = useMemo(() => ({ enabled, address, port }), [enabled, address, port]);
  const errors = useMemo(() => validateProxyConfig(config), [config]);
  const isValid = errors.length === 0;

  const errorFor = useCallback(
    (field: ProxyValidationError["field"]) =>
      touched[field] ? errors.find((e) => e.field === field)?.message : undefined,
    [touched, errors],
  );

  useEffect(() => {
    if (!isLoaded) {
      loadConfig();
    }
  }, [isLoaded, loadConfig]);

  const handleSave = useCallback(async () => {
    if (!isValid) return;

    setProxyError(null);
    try {
      if (enabled) {
        const proxyUrl = `http://${address.trim()}:${port.trim()}`;
        try {
          const testFetch = createProxyFetch({
            enabled: true,
            address: address.trim(),
            port: port.trim(),
          });
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          await testFetch(PROXY_TEST_URL, {
            method: "HEAD",
            signal: controller.signal,
          });
          clearTimeout(timeout);
        } catch {
          setProxyError(
            `无法连接到代理 ${proxyUrl}，请检查地址和端口`,
          );
          return;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setProxyError(`代理配置失败: ${message}`);
    }
  }, [isValid, enabled, address, port]);

  return (
    <section className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-sans font-medium text-text dark:text-text-dark">
            代理设置
          </span>
          <span className="text-xs font-sans text-text-secondary dark:text-text-secondary-dark">
            通过代理服务器连接网络
          </span>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`
            relative w-11 h-6 rounded-full transition-colors cursor-pointer border-0
            ${enabled ? "bg-accent" : "bg-border"}
          `}
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle proxy"
        >
          <span
            className={`
              absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm
              ${enabled ? "translate-x-5" : "translate-x-0"}
            `}
          />
        </button>
      </div>

      {enabled && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-sans text-text-secondary dark:text-text-secondary-dark">
              代理地址
            </span>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, address: true }))}
              className={`px-3 py-1.5 text-sm font-sans bg-surface dark:bg-surface-dark border rounded-md outline-none focus:border-accent dark:focus:border-accent-dark text-text dark:text-text-dark ${
                errorFor("address")
                  ? "border-red-500 dark:border-red-400"
                  : "border-border dark:border-border-dark"
              }`}
              placeholder="127.0.0.1"
            />
            {errorFor("address") && (
              <span className="text-xs text-red-600 dark:text-red-400">
                {errorFor("address")}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-sans text-text-secondary dark:text-text-secondary-dark">
              代理端口
            </span>
            <input
              type="text"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, port: true }))}
              className={`px-3 py-1.5 text-sm font-sans bg-surface dark:bg-surface-dark border rounded-md outline-none focus:border-accent dark:focus:border-accent-dark text-text dark:text-text-dark ${
                errorFor("port")
                  ? "border-red-500 dark:border-red-400"
                  : "border-border dark:border-border-dark"
              }`}
              placeholder="7890"
            />
            {errorFor("port") && (
              <span className="text-xs text-red-600 dark:text-red-400">
                {errorFor("port")}
              </span>
            )}
          </label>

          {/* Connectivity error */}
          {proxyError && (
            <span className="text-xs text-red-600 dark:text-red-400">
              {proxyError}
            </span>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!isValid}
            className={`self-start px-3 py-1.5 text-sm font-sans font-medium rounded-md transition-colors ${
              isValid
                ? "bg-accent dark:bg-accent-dark text-white hover:bg-accent-hover dark:hover:bg-accent-hover-dark cursor-pointer"
                : "bg-border dark:bg-border-dark text-text-secondary dark:text-text-secondary-dark cursor-not-allowed opacity-60"
            }`}
          >
            保存
          </button>
        </>
      )}
    </section>
  );
}
