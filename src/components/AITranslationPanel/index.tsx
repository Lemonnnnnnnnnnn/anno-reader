import { Button, ErrorBanner, Drawer } from "@/components/primitives";
import { Loader2, Volume2 } from "lucide-react";
import { Streamdown } from "streamdown";
import { useTranslation, useNoteSaving } from "./hooks";
import { useTTS } from "@/hooks/useTTS";
import type { PanelStatus } from "./hooks";

interface AITranslationPanelProps {
  selectedText: string;
  chapterText: string | null;
  chapterHref: string;
  cfiRange: string;
  startOffset: number;
  endOffset: number;
  /** The sentence containing the selection (for AI context) */
  sentence?: string;
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
  isOpen = true,
  onClose,
  onRetry,
  onAddNote,
  onStop,
  isTTSAvailable,
  isSpeaking,
  onSpeak,
}: {
  status: PanelStatus;
  selectedText: string;
  translationText: string;
  streamingText: string;
  error: string | null;
  isSaving: boolean;
  isOpen?: boolean;
  onClose: () => void;
  onRetry: () => void;
  onAddNote: () => void;
  onStop: () => void;
  isTTSAvailable: boolean;
  isSpeaking: boolean;
  onSpeak: () => void;
}) {
  return (
    <Drawer open={isOpen} onClose={onClose} title="AI Translation">
      <div className="flex flex-col h-full">
        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Original text */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-text-secondary dark:text-text-secondary-dark font-sans">
                Original
              </label>
              {isTTSAvailable && (
                <button
                  onClick={onSpeak}
                  className={`p-1 rounded transition-opacity ${
                    isSpeaking ? "opacity-100" : "opacity-50 hover:opacity-75"
                  }`}
                  title={isSpeaking ? "Stop speaking" : "Listen"}
                >
                  <Volume2 size={14} className="text-text-secondary dark:text-text-secondary-dark" />
                </button>
              )}
            </div>
            <p className="text-sm text-text dark:text-text-dark bg-bg dark:bg-bg-dark rounded-md p-3 font-serif leading-relaxed">
              {selectedText}
            </p>
          </div>

          {/* Loading state */}
          {status === "loading" && (
            <div className="flex items-center gap-2 py-6 justify-center">
              <Loader2 className="animate-spin h-5 w-5 text-text-secondary dark:text-text-secondary-dark" />
              <span className="text-sm text-text-secondary dark:text-text-secondary-dark font-sans">
                Translating…
              </span>
            </div>
          )}

          {/* Streaming state */}
          {status === "streaming" && (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-text-secondary dark:text-text-secondary-dark mb-1 font-sans">
                Translation
              </label>
              <div className="text-sm text-text dark:text-text-dark font-serif leading-relaxed">
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
              <label className="block text-xs font-medium text-text-secondary dark:text-text-secondary-dark mb-1 font-sans">
                Translation
              </label>
              <div className="text-sm text-text dark:text-text-dark font-serif leading-relaxed">
                <Streamdown mode="static" isAnimating={false}>
                  {translationText}
                </Streamdown>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-end gap-2 pt-3 mt-2 border-t border-border dark:border-border-dark">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
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
 * Stateful wrapper — mounts, auto-translates, wires up store actions.
 */
export function AITranslationPanel({
  selectedText,
  chapterText,
  chapterHref,
  cfiRange,
  startOffset,
  sentence,
  isOpen = true,
  onClose,
}: AITranslationPanelProps) {
  const {
    status,
    translationText,
    streamingText,
    error,
    setError,
    translate,
    stopTranslation,
  } = useTranslation({ selectedText, chapterText, offset: startOffset, selectionSentence: sentence });

  const { isSaving, handleAddNote } = useNoteSaving({
    chapterHref,
    cfiRange,
    selectedText,
    translationText,
    onClose,
    onError: setError,
  });

  const { speak, isSpeaking } = useTTS(selectedText);

  return (
    <AITranslationPanelView
      status={status}
      selectedText={selectedText}
      translationText={translationText}
      streamingText={streamingText}
      error={error}
      isSaving={isSaving}
      isOpen={isOpen}
      onClose={onClose}
      onRetry={translate}
      onAddNote={handleAddNote}
      onStop={stopTranslation}
      isTTSAvailable={true}
      isSpeaking={isSpeaking}
      onSpeak={speak}
    />
  );
}
