import { useState, useCallback, useEffect } from "react";
import { Button, TextArea } from "@/components/primitives";
import { ArrowUp, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChatInputProps {
  /** Callback when user sends a message */
  onSend: (message: string) => void;
  /** Whether the input is disabled (e.g., streaming in progress) */
  disabled?: boolean;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Initial value to pre-fill the input (e.g., from "Ask AI" selection) */
  initialValue?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Ask about this book…",
  initialValue,
}: ChatInputProps) {
  const [value, setValue] = useState("");

  // Pre-fill input when initialValue changes (e.g., from "Ask AI" selection)
  useEffect(() => {
    if (initialValue) {
      setValue(initialValue);
    }
  }, [initialValue]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
    },
    [],
  );

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="flex items-end gap-2 p-3 border-t border-border dark:border-border-dark bg-surface dark:bg-surface-dark">
      <TextArea
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="resize-none min-h-[40px] max-h-[160px]"
      />
      <Button
        variant="icon"
        onClick={handleSend}
        disabled={!canSend}
        aria-label="Send message"
        className="shrink-0 mb-1"
      >
        {disabled ? (
          <Loader2 className="h-4 w-4 animate-spin text-text-secondary dark:text-text-secondary-dark" />
        ) : (
          <ArrowUp className="h-4 w-4 text-text dark:text-text-dark" />
        )}
      </Button>
    </div>
  );
}
