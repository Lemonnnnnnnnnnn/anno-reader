import { useState, useCallback } from "react";
import { Button, ErrorBanner, TextArea } from "@/components/primitives";
import { Loader2, Volume2 } from "lucide-react";
import { Streamdown } from "streamdown";
import type { PanelStatus } from "./hooks";

interface TranslationModeProps {
  status: PanelStatus;
  selectedText: string;
  translationText: string;
  streamingText: string;
  error: string | null;
  isSaving: boolean;
  onClose: () => void;
  onRetry: () => void;
  onAddNote: () => void;
  onStop: () => void;
  onTranslationChange: (text: string) => void;
  isTTSAvailable: boolean;
  isSpeaking: boolean;
  onSpeak: () => void;
  onEnterChat: () => void;
}

/**
 * Translation mode — shows original text, translation result, and action buttons.
 */
export function TranslationMode({
  status,
  selectedText,
  translationText,
  streamingText,
  error,
  isSaving,
  onClose,
  onRetry,
  onAddNote,
  onStop,
  onTranslationChange,
  isTTSAvailable,
  isSpeaking,
  onSpeak,
  onEnterChat,
}: TranslationModeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(translationText);

  const handleEdit = useCallback(() => {
    setEditedText(translationText);
    setIsEditing(true);
  }, [translationText]);

  const handleSave = useCallback(() => {
    onTranslationChange(editedText);
    setIsEditing(false);
  }, [editedText, onTranslationChange]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  return (
    <>
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto space-y-4 min-h-0 flex flex-col">
        {/* Original text */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-text-secondary dark:text-text-secondary-dark font-sans">
              Original
            </label>
            {isTTSAvailable && (
              <button
                onClick={onSpeak}
                className={`p-1 rounded transition-opacity ${isSpeaking ? "opacity-100" : "opacity-50 hover:opacity-75"
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

        {/* Success state - editable */}
        {status === "success" && (
          <div className="flex-1 flex flex-col min-h-0">
            <label className="block text-xs font-medium text-text-secondary dark:text-text-secondary-dark mb-1 font-sans">
              Translation
            </label>
            {isEditing ? (
              <TextArea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                onSubmit={handleSave}
                onCancel={handleCancel}
                className="flex-1 min-h-0"
              />
            ) : (
              <div className="text-sm text-text dark:text-text-dark font-serif leading-relaxed">
                <Streamdown mode="static" isAnimating={false}>
                  {translationText}
                </Streamdown>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 flex items-center justify-end gap-2 pt-3 mt-2 border-t border-border dark:border-border-dark">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
        {status === "success" && !isEditing && (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleEdit}
            >
              Edit
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onEnterChat}
            >
              Continue Chat
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onAddNote}
              loading={isSaving}
            >
              Add as Note
            </Button>
          </>
        )}
        {isEditing && (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
            >
              Save
            </Button>
          </>
        )}
      </div>
    </>
  );
}
