/**
 * DictionaryDrawer component.
 *
 * Side drawer that provides dictionary lookup using Vocabulary.com
 * and Etymonline. Search is triggered on Enter key or button click.
 *
 * @example
 * ```tsx
 * <DictionaryDrawer
 *   open={isDrawerOpen}
 *   onClose={() => setIsDrawerOpen(false)}
 * />
 * ```
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Drawer, Button } from "@/components/primitives";
import { Search, Loader2, AlertCircle } from "lucide-react";
import {
  createDefaultAggregator,
  type DictionaryAggregator,
  type AggregatedDictionaryResult,
  type VocabularyResult,
  type EtymonlineResult,
} from "@/lib/dictionaries";

interface DictionaryDrawerProps {
  /** Whether the drawer is visible */
  open: boolean;
  /** Callback when the drawer should close */
  onClose: () => void;
}

export function DictionaryDrawer({ open, onClose }: DictionaryDrawerProps) {
  const [word, setWord] = useState("");
  const [result, setResult] = useState<AggregatedDictionaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aggregatorRef = useRef<DictionaryAggregator | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when drawer opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Reset state when drawer closes
  useEffect(() => {
    if (!open) {
      setWord("");
      setResult(null);
      setError(null);
    }
  }, [open]);

  const handleSearch = useCallback(async () => {
    const trimmed = word.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Lazily initialize aggregator on first search
      if (!aggregatorRef.current) {
        aggregatorRef.current = await createDefaultAggregator();
      }

      const searchResult = await aggregatorRef.current.search(trimmed);
      setResult(searchResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Search failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [word]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSearch();
      }
    },
    [handleSearch],
  );

  // Filter results by source
  const vocabularyResult = result?.results.find(
    (r): r is VocabularyResult => r.source === "vocabulary",
  );
  const etymonlineResult = result?.results.find(
    (r): r is EtymonlineResult => r.source === "etymonline",
  );

  return (
    <Drawer open={open} onClose={onClose} side="right" title="Dictionary">
      {/* Search input */}
      <div className="flex gap-2 mb-4">
        <input
          ref={inputRef}
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a word..."
          className="flex-1 px-3 py-2 text-sm border border-border dark:border-border-dark rounded-md bg-surface dark:bg-surface-dark text-text dark:text-text-dark placeholder:text-text-muted dark:placeholder:text-text-muted-dark focus:outline-none focus:border-accent dark:focus:border-accent-dark"
        />
        <Button
          variant="primary"
          size="md"
          onClick={handleSearch}
          disabled={loading || !word.trim()}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        </Button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-text-muted dark:text-text-muted-dark" />
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <AlertCircle size={16} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300 m-0">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && !loading && !error && (
        <div className="flex flex-col gap-4">
          {/* Vocabulary.com result */}
          {vocabularyResult && vocabularyResult.found && (
            <div className="border border-border dark:border-border-dark rounded-lg p-3 bg-surface-alt dark:bg-surface-alt-dark">
              <h3 className="text-xs font-medium text-text-muted dark:text-text-muted-dark mb-2 uppercase tracking-wide">
                Vocabulary.com
              </h3>
              <p className="text-sm text-text dark:text-text-dark m-0 leading-relaxed">
                {vocabularyResult.data.short}
              </p>
              {vocabularyResult.data.long && vocabularyResult.data.long !== vocabularyResult.data.short && (
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-2 m-0 leading-relaxed">
                  {vocabularyResult.data.long}
                </p>
              )}
            </div>
          )}

          {/* Etymonline result */}
          {etymonlineResult && etymonlineResult.found && (
            <div className="border border-border dark:border-border-dark rounded-lg p-3 bg-surface-alt dark:bg-surface-alt-dark">
              <h3 className="text-xs font-medium text-text-muted dark:text-text-muted-dark mb-2 uppercase tracking-wide">
                Etymonline
              </h3>
              {etymonlineResult.data.items.map((item, index) => (
                <div
                  key={index}
                  className="text-sm text-text dark:text-text-dark leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: item.etymology }}
                />
              ))}
            </div>
          )}

          {/* No results found */}
          {result.successCount === 0 && result.errors.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-text-muted dark:text-text-muted-dark m-0">
                No results found for &ldquo;{result.word}&rdquo;
              </p>
            </div>
          )}

          {/* Partial errors */}
          {result.errors.length > 0 && result.successCount > 0 && (
            <div className="flex items-start gap-2 p-2 text-xs text-text-muted dark:text-text-muted-dark">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>
                Some dictionaries failed:{" "}
                {result.errors.map((e) => e.source).join(", ")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search size={32} className="text-text-muted dark:text-text-muted-dark mb-3" />
          <p className="text-sm text-text-muted dark:text-text-muted-dark m-0">
            Type a word and press Enter to look it up
          </p>
        </div>
      )}
    </Drawer>
  );
}
