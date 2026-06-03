import { Button, ErrorBanner } from "@/components/primitives";
import { Loader2 } from "lucide-react";
import { Streamdown } from "streamdown";
import type { PreviewData } from "@/lib/ai/service";
import { Drawer } from "@/components/Drawer";
import { useTranslation, useNoteSaving } from "./hooks";
import type { PanelStatus } from "./hooks";

interface AITranslationPanelProps {
  selectedText: string;
  chapterText: string | null;
  chapterHref: string;
  cfiRange: string;
  startOffset: number;
  endOffset: number;
  isOpen?: boolean;
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
  streamingText,
  error,
  isSaving,
  previewData,
  isOpen = true,
  onClose,
  onRetry,
  onAddNote,
  onTranslate,
  onPreview: _onPreview,
  onStop,
}: {
  status: PanelStatus;
  selectedText: string;
  translationText: string;
  streamingText: string;
  error: string | null;
  isSaving: boolean;
  previewData: PreviewData | null;
  isOpen?: boolean;
  onClose: () => void;
  onRetry: () => void;
  onAddNote: () => void;
  onTranslate: () => void;
  onPreview: () => void;
  onStop: () => void;
}) {
  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="AI Translation">
      <div className="flex flex-col h-full">
        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto space-y-4">
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
              <Loader2 className="animate-spin h-5 w-5 text-text-secondary" />
              <span className="text-sm text-text-secondary font-sans">
                Translating…
              </span>
            </div>
          )}

          {/* Streaming state */}
          {status === "streaming" && (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-text-secondary mb-1 font-sans">
                Translation
              </label>
              <div className="text-sm text-text font-serif leading-relaxed">
                <Streamdown mode="streaming" isAnimating={true}>
                  {streamingText}
                </Streamdown>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={onStop}
              >
                Stop
              </Button>
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
              <div className="text-sm text-text font-serif leading-relaxed">
                <Streamdown mode="static" isAnimating={false}>
                  {translationText}
                </Streamdown>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-end gap-2 pt-3 mt-2 border-t border-border">
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
    </Drawer>
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
  isOpen = true,
  onClose,
}: AITranslationPanelProps) {
  const {
    status,
    translationText,
    streamingText,
    error,
    setError,
    previewData,
    translate,
    stopTranslation,
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
      streamingText={streamingText}
      error={error}
      isSaving={isSaving}
      previewData={previewData}
      isOpen={isOpen}
      onClose={onClose}
      onRetry={preview}
      onAddNote={handleAddNote}
      onTranslate={translate}
      onPreview={preview}
      onStop={stopTranslation}
    />
  );
}
