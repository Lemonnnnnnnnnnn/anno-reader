/**
 * TypingIndicator component.
 *
 * Three animated dots shown during AI streaming to indicate the assistant
 * is composing a response.
 */

import { Bot } from "lucide-react";

/**
 * Typing indicator — three animated dots for streaming state.
 */
export function TypingIndicator() {
  return (
    <div className="flex items-start gap-2 py-2 px-3">
      <div className="shrink-0 w-6 h-6 rounded-full bg-surface-alt dark:bg-surface-alt-dark flex items-center justify-center">
        <Bot className="h-3.5 w-3.5 text-text-secondary dark:text-text-secondary-dark" />
      </div>
      <div className="flex items-center gap-1 px-3 py-2 bg-surface-alt dark:bg-surface-alt-dark rounded-lg rounded-bl-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-text-muted dark:bg-text-muted-dark animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-text-muted dark:bg-text-muted-dark animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-text-muted dark:bg-text-muted-dark animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}
