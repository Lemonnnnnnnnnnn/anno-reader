import { useState, useEffect, useCallback } from "react";
import { Button, TextArea, Icon, ErrorBanner } from "@/components/primitives";
import { TranslationService } from "@/lib/ai/translation";
import { useBookStore } from "@/stores/useBookStore";
import { useAIConfigStore } from "@/stores/useAIConfigStore";
import { createNote } from "@/lib/annotations";

interface AITranslationPanelProps {
  selectedText: string;
  chapterText: string | null;
  chapterHref: string;
  cfiRange: string;
  startOffset: number;
  endOffset: number;
  onClose: () => void;
}

export type PanelStatus = "loading" | "success" | "error";

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
  onClose,
  onRetry,
  onAddNote,
}: {
  status: PanelStatus;
  selectedText: string;
  translationText: string;
  setTranslationText: (v: string) => void;
  error: string | null;
  isSaving: boolean;
  onClose: () => void;
  onRetry: () => void;
  onAddNote: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative w-full max-w-lg mx-4 bg-surface rounded-lg shadow-xl border border-border flex flex-col max-h-[80vh]">
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

          {/* Translation area */}
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
 * Stateful wrapper — mounts, auto-translates, wires up store actions.
 */
export function AITranslationPanel({
  selectedText,
  chapterText,
  chapterHref,
  cfiRange,
  onClose,
}: AITranslationPanelProps) {
  const [status, setStatus] = useState<PanelStatus>("loading");
  const [translationText, setTranslationText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const currentBook = useBookStore((s) => s.currentBook);
  const config = useAIConfigStore((s) => s.config);

  const translate = useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      const service = new TranslationService();
      const response = await service.translate(
        selectedText,
        "Chinese",
        config,
        chapterText,
      );
      setTranslationText(response.translation);
      setStatus("success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Translation failed";
      setError(message);
      setStatus("error");
    }
  }, [selectedText, chapterText, config]);

  useEffect(() => {
    translate();
  }, [translate]);

  const handleAddNote = async () => {
    if (!currentBook) return;
    setIsSaving(true);
    try {
      await createNote(
        currentBook.id,
        chapterHref,
        cfiRange,
        selectedText,
        translationText,
      );
      onClose();
    } catch {
      setError("Failed to save note");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AITranslationPanelView
      status={status}
      selectedText={selectedText}
      translationText={translationText}
      setTranslationText={setTranslationText}
      error={error}
      isSaving={isSaving}
      onClose={onClose}
      onRetry={translate}
      onAddNote={handleAddNote}
    />
  );
}
