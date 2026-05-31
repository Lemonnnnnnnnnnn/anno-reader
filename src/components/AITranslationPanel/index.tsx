import { Button, TextArea, Icon, ErrorBanner } from "@/components/primitives";
import type { PreviewData } from "@/lib/ai/service";
import { useTranslation, useNoteSaving } from "./hooks";
import type { PanelStatus } from "./hooks";

interface AITranslationPanelProps {
  selectedText: string;
  chapterText: string | null;
  chapterHref: string;
  cfiRange: string;
  startOffset: number;
  endOffset: number;
  onClose: () => void;
}

export type { PanelStatus };

/**
 * Pure view component — exported for direct testing with renderToString.
 */
export function AITranslationPanelView({
  status,
  selectedText,
  translationText,
  setTranslationText,
  error,
  isSaving,
  previewData,
  onClose,
  onRetry,
  onAddNote,
  onTranslate,
  onPreview,
}: {
  status: PanelStatus;
  selectedText: string;
  translationText: string;
  setTranslationText: (v: string) => void;
  error: string | null;
  isSaving: boolean;
  previewData: PreviewData | null;
  onClose: () => void;
  onRetry: () => void;
  onAddNote: () => void;
  onTranslate: () => void;
  onPreview: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative w-full max-w-2xl mx-4 bg-surface rounded-lg shadow-xl border border-border flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="translate" size={18} className="text-text-secondary" />
            <h2 className="text-base font-medium text-text font-sans">
              AI Translation
            </h2>
          </div>
          <Button
            variant="icon"
            onClick={onClose}
            aria-label="Close translation panel"
          >
            <Icon name="close" size={18} />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Original text */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1 font-sans">
              Original
            </label>
            <p className="text-sm text-text bg-bg rounded-md p-3 font-serif leading-relaxed">
              {selectedText}
            </p>
          </div>

          {/* Preview panel */}
          {status === "previewing" && previewData && (
            <PreviewPanel data={previewData} />
          )}

          {/* Loading state */}
          {status === "loading" && (
            <div className="flex items-center gap-2 py-6 justify-center">
              <svg
                className="animate-spin h-5 w-5 text-text-secondary"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="text-sm text-text-secondary font-sans">
                Translating…
              </span>
            </div>
          )}

          {/* Error state */}
          {status === "error" && (
            <div className="space-y-3">
              <ErrorBanner message={error ?? "Translation failed"} />
              <Button
                variant="secondary"
                size="sm"
                onClick={onRetry}
              >
                Retry
              </Button>
            </div>
          )}

          {/* Success state */}
          {status === "success" && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1 font-sans">
                Translation
              </label>
              <TextArea
                value={translationText}
                onChange={(e) => setTranslationText(e.target.value)}
                rows={4}
                aria-label="Translation result"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
          {status === "previewing" && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={onTranslate}
              >
                Skip Preview & Translate
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={onTranslate}
              >
                Translate
              </Button>
            </>
          )}
          {status === "success" && (
            <Button
              variant="primary"
              size="sm"
              onClick={onAddNote}
              loading={isSaving}
            >
              Add as Note
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Preview panel showing dictionary results and prompt before translation.
 */
function PreviewPanel({ data }: { data: PreviewData }) {
  return (
    <div className="space-y-3">
      {/* Context sources */}
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs font-sans text-text-secondary">Context:</span>
        {data.contextSources.map((source) => (
          <span
            key={source}
            className="text-xs font-sans px-2 py-0.5 bg-accent/10 text-accent rounded"
          >
            {source}
          </span>
        ))}
      </div>

      {/* Sentence context */}
      {data.sentenceContext && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-sans text-text-secondary hover:text-text">
            Sentence Context
          </summary>
          <p className="mt-1 text-xs font-sans text-text bg-bg rounded p-2">
            {data.sentenceContext}
          </p>
        </details>
      )}

      {/* Dictionary results */}
      {data.dictionary && (
        <details className="group" open>
          <summary className="cursor-pointer text-xs font-sans text-text-secondary hover:text-text">
            Dictionary Results ({data.dictionary.duration}ms)
            {data.dictionary.errors.length > 0 && (
              <span className="text-red-500 ml-1">
                ({data.dictionary.errors.length} errors)
              </span>
            )}
          </summary>
          <div className="mt-1 space-y-1">
            {data.dictionary.results.map((result, i) => (
              <div
                key={i}
                className="text-xs font-sans bg-bg rounded p-2"
              >
                <span className="font-medium text-text-secondary">
                  [{result.source}]
                </span>{" "}
                {result.found ? (
                  <span className="text-text">
                    {formatDictionaryResult(result)}
                  </span>
                ) : (
                  <span className="text-text-muted italic">not found</span>
                )}
              </div>
            ))}
            {data.dictionary.errors.map((err, i) => (
              <div
                key={`err-${i}`}
                className="text-xs font-sans bg-red-50 text-red-700 rounded p-2"
              >
                [{err.source}] {err.error.message}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Rendered prompt */}
      <details className="group">
        <summary className="cursor-pointer text-xs font-sans text-text-secondary hover:text-text">
          Rendered Prompt
        </summary>
        <pre className="mt-1 text-xs font-mono text-text bg-bg rounded p-2 whitespace-pre-wrap overflow-x-auto">
          {data.renderedPrompt}
        </pre>
      </details>

      {/* LLM Messages */}
      <details className="group">
        <summary className="cursor-pointer text-xs font-sans text-text-secondary hover:text-text">
          LLM Messages (what will be sent)
        </summary>
        <div className="mt-1 space-y-1">
          <div className="text-xs font-sans">
            <span className="font-medium text-accent">system:</span>
            <pre className="mt-0.5 font-mono text-text bg-bg rounded p-2 whitespace-pre-wrap">
              {data.systemMessage}
            </pre>
          </div>
          <div className="text-xs font-sans">
            <span className="font-medium text-accent">user:</span>
            <pre className="mt-0.5 font-mono text-text bg-bg rounded p-2 whitespace-pre-wrap">
              {data.userMessage}
            </pre>
          </div>
        </div>
      </details>
    </div>
  );
}

/**
 * Format a dictionary result for display.
 */
function formatDictionaryResult(result: import("@/lib/dictionaries").DictionaryResult): string {
  if (!result.found) return "";

  switch (result.source) {
    case "etymonline": {
      const data = result.data as { items: { etymology: string; firstUse?: string }[] };
      return data.items
        .map((item) => {
          const clean = item.etymology.replace(/<[^>]*>/g, "").trim();
          return item.firstUse ? `${clean} (${item.firstUse})` : clean;
        })
        .join("; ");
    }
    case "vocabulary": {
      const data = result.data as { short: string; long: string };
      const parts: string[] = [];
      if (data.short) parts.push(data.short);
      if (data.long) parts.push(data.long);
      return parts.join("; ");
    }
    default:
      return JSON.stringify(result.data);
  }
}

/**
 * Stateful wrapper — mounts, auto-translates, wires up store actions.
 */
export function AITranslationPanel({
  selectedText,
  chapterText,
  chapterHref,
  cfiRange,
  onClose,
}: AITranslationPanelProps) {
  const {
    status,
    translationText,
    setTranslationText,
    error,
    setError,
    previewData,
    translate,
    preview,
  } = useTranslation({ selectedText, chapterText });

  const { isSaving, handleAddNote } = useNoteSaving({
    chapterHref,
    cfiRange,
    selectedText,
    translationText,
    onClose,
    onError: setError,
  });

  return (
    <AITranslationPanelView
      status={status}
      selectedText={selectedText}
      translationText={translationText}
      setTranslationText={setTranslationText}
      error={error}
      isSaving={isSaving}
      previewData={previewData}
      onClose={onClose}
      onRetry={preview}
      onAddNote={handleAddNote}
      onTranslate={translate}
      onPreview={preview}
    />
  );
}
