/**
 * UrlInput component.
 *
 * URL input field with loading state and error display for web page fetching.
 * Triggers fetch on Enter key or button click. Integrates with the web fetcher
 * module for proxy-aware HTTP requests.
 *
 * @example
 * ```tsx
 * <UrlInput onFetchComplete={(webPage) => console.log(webPage.title)} />
 * ```
 */

import { useState, useCallback, useRef } from "react";
import { Button, ErrorBanner } from "@/components/primitives";
import { fetchWebPage } from "@/lib/web/fetcher";
import type { WebPage } from "@/lib/web/types";
import { Globe, Loader2 } from "lucide-react";

interface UrlInputProps {
  /** Callback fired when fetch completes successfully */
  onFetchComplete?: (page: WebPage) => void;
  /** Placeholder text for the input field */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Validate that a string is a plausible HTTP/HTTPS URL.
 */
function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function UrlInput({
  onFetchComplete,
  placeholder = "Enter URL (https://...)",
  className = "",
}: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFetch = useCallback(async () => {
    const trimmed = url.trim();

    if (!trimmed) {
      setError("Please enter a URL");
      return;
    }

    if (!isValidUrl(trimmed)) {
      setError("Please enter a valid HTTP or HTTPS URL");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const page = await fetchWebPage(trimmed);
      onFetchComplete?.(page);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch page"
      );
    } finally {
      setLoading(false);
    }
  }, [url, onFetchComplete]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !loading) {
        e.preventDefault();
        handleFetch();
      }
    },
    [loading, handleFetch]
  );

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Input row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Globe
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted dark:text-text-muted-dark"
          />
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={loading}
            className="w-full pl-9 pr-3 py-2 text-sm bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md text-text dark:text-text-dark placeholder:text-text-muted dark:placeholder:text-text-muted-dark focus:outline-none focus:ring-1 focus:ring-accent dark:focus:ring-accent-dark disabled:opacity-60 transition-colors"
            aria-label="URL input"
          />
        </div>
        <Button
          variant="primary"
          onClick={handleFetch}
          loading={loading}
          disabled={loading || !url.trim()}
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <Loader2 size={14} className="animate-spin" />
              Fetching...
            </span>
          ) : (
            "Fetch"
          )}
        </Button>
      </div>

      {/* Error message */}
      {error && <ErrorBanner message={error} />}
    </div>
  );
}
