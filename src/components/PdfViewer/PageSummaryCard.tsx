/**
 * PageSummaryCard component.
 *
 * React/Tailwind counterpart of the iframe-injected chapter summary card
 * (lib/summaries/injectSummaryButton.ts) for PDF pages. Provides the
 * same trigger → streaming card → persisted summary lifecycle, plus a
 * quick language switcher (persists the summary preference and
 * regenerates) and copy-to-clipboard.
 */

import { useEffect, useRef, useState } from "react";
import { Sparkles, X, RefreshCw, Copy, Check } from "lucide-react";
import { MarkdownView } from "@/components/MarkdownView";
import { useAIConfigStore } from "@/stores/useAIConfigStore";
import type { SummaryLanguage } from "@/lib/summaries/types";

const LANGUAGE_OPTIONS: { value: SummaryLanguage; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "chinese", label: "Chinese" },
  { value: "english", label: "English" },
];

interface PageSummaryCardProps {
  status: "idle" | "streaming" | "error";
  content: string;
  hasSummary: boolean;
  error: string | null;
  onRun: () => void;
  onDismiss: () => void;
}

export function PageSummaryCard({
  status,
  content,
  hasSummary,
  error,
  onRun,
  onDismiss,
}: PageSummaryCardProps) {
  const summaryLanguage = useAIConfigStore(
    (s) => s.config.summaryPreferences.language,
  );
  const updateSummaryPreferences = useAIConfigStore(
    (s) => s.updateSummaryPreferences,
  );

  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  // Idle with no persisted summary → show the trigger button
  if (status === "idle" && !hasSummary) {
    return (
      <button
        onClick={onRun}
        className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-full border border-border dark:border-border-dark bg-surface dark:bg-surface-dark text-text dark:text-text-dark hover:bg-border/40 dark:hover:bg-border-dark/40 transition-colors cursor-pointer"
        title="Generate an AI summary of this page"
      >
        <Sparkles size={14} className="text-accent dark:text-accent-dark" />
        AI Summary
      </button>
    );
  }

  const streaming = status === "streaming";

  const handleLanguageChange = (language: SummaryLanguage) => {
    if (language === summaryLanguage) return;
    updateSummaryPreferences({ language });
    // Apply immediately: regenerate the visible summary in the new language.
    if (hasSummary) onRun();
  };

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      if (copiedTimerRef.current !== null) {
        clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — silently ignore.
    }
  };

  const iconBtn =
    "text-text-secondary dark:text-text-secondary-dark hover:text-text dark:hover:text-text-dark cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-default";

  return (
    <div className="w-full max-w-[720px] rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-surface-dark p-3 px-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-secondary dark:text-text-secondary-dark">
          <Sparkles size={12} className="text-accent dark:text-accent-dark" />
          Page Summary
        </span>
        {streaming && (
          <span className="inline-flex items-center gap-2 text-xs text-text-secondary dark:text-text-secondary-dark">
            <span className="w-3 h-3 border-[1.5px] border-border dark:border-border-dark border-t-transparent rounded-full animate-spin" />
            Generating…
          </span>
        )}

        <span className="ml-auto flex items-center gap-1.5">
          <select
            value={summaryLanguage}
            onChange={(e) => handleLanguageChange(e.target.value as SummaryLanguage)}
            disabled={streaming}
            title="Summary language (switching regenerates)"
            aria-label="Summary language"
            className="text-xs px-1.5 py-0.5 rounded-md border border-border dark:border-border-dark bg-transparent text-text-secondary dark:text-text-secondary-dark hover:text-text dark:hover:text-text-dark cursor-pointer disabled:opacity-40 disabled:cursor-default outline-none"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {!streaming && (
            <button
              onClick={() => void handleCopy()}
              disabled={!content}
              className={iconBtn}
              title="Copy summary"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          )}

          {!streaming && (
            <button onClick={onRun} className={iconBtn} title="Regenerate summary">
              <RefreshCw size={12} />
            </button>
          )}

          <button onClick={onDismiss} className={iconBtn} title="Close">
            <X size={14} />
          </button>
        </span>
      </div>

      {status === "error" ? (
        <p className="text-sm text-error dark:text-error m-0">{error}</p>
      ) : streaming ? (
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-text dark:text-text-dark m-0">
          {content}
          <span className="inline-block w-1.5 h-4 ml-0.5 align-text-bottom bg-accent dark:bg-accent-dark animate-pulse" />
        </p>
      ) : (
        <MarkdownView
          className="text-sm text-text dark:text-text-dark leading-relaxed break-words markdown-note"
          content={content}
        />
      )}
    </div>
  );
}
