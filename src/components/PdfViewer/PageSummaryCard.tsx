/**
 * PageSummaryCard component.
 *
 * React/Tailwind counterpart of the iframe-injected chapter summary card
 * (lib/summaries/injectSummaryButton.ts) for PDF pages. Provides the
 * same trigger → streaming card → persisted summary lifecycle.
 */

import { Sparkles, X, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  // Idle with no persisted summary → show the trigger button
  if (status === "idle" && !hasSummary) {
    return (
      <button
        onClick={onRun}
        className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-full border border-border dark:border-border-dark bg-surface dark:bg-surface-dark text-text dark:text-text-dark hover:bg-border/40 dark:hover:bg-border-dark/40 transition-colors cursor-pointer"
        title="Generate an AI summary of this page"
      >
        <Sparkles size={14} />
        AI Summary
      </button>
    );
  }

  const streaming = status === "streaming";

  return (
    <div className="w-full max-w-[720px] rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-surface-dark p-3 px-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary dark:text-text-secondary-dark">
          Page Summary
        </span>
        <div className="flex items-center gap-2">
          {streaming ? (
            <span className="inline-flex items-center gap-2 text-xs text-text-secondary dark:text-text-secondary-dark">
              <span className="w-3 h-3 border-[1.5px] border-border dark:border-border-dark border-t-transparent rounded-full animate-spin" />
              Generating…
            </span>
          ) : (
            <button
              onClick={onRun}
              className="inline-flex items-center gap-1 text-xs text-text-secondary dark:text-text-secondary-dark hover:text-text dark:hover:text-text-dark cursor-pointer"
              title="Regenerate summary"
            >
              <RefreshCw size={12} />
              Regenerate
            </button>
          )}
          <button
            onClick={onDismiss}
            className="text-text-secondary dark:text-text-secondary-dark hover:text-text dark:hover:text-text-dark cursor-pointer"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {status === "error" ? (
        <p className="text-sm text-error dark:text-error m-0">{error}</p>
      ) : streaming ? (
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-text dark:text-text-dark m-0">
          {content}
          <span className="inline-block w-1.5 h-4 ml-0.5 align-text-bottom bg-accent dark:bg-accent-dark animate-pulse" />
        </p>
      ) : (
        <div className="text-sm text-text dark:text-text-dark leading-relaxed break-words markdown-note">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
