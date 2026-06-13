/**
 * WelcomeEmptyState component.
 *
 * Empty state shown when there are no messages in the conversation.
 * Displays an AI avatar, welcome message, and quick-start tips that
 * pre-fill the chat input with common prompts.
 */

import { Bot, BookOpen, Lightbulb, HelpCircle } from "lucide-react";

interface WelcomeEmptyStateProps {
  /** Called when a quick-start tip is clicked */
  onSend: (content: string) => void;
}

/**
 * Welcome empty state — shown when there are no messages.
 */
export function WelcomeEmptyState({ onSend }: WelcomeEmptyStateProps) {
  const tips = [
    { icon: BookOpen, text: "Ask about this book", prompt: "Please introduce the main themes and content of this book." },
    { icon: Lightbulb, text: "Request a summary", prompt: "Please provide a comprehensive summary of this book." },
    { icon: HelpCircle, text: "Explain a passage", prompt: "Please explain the current chapter's main content and key points." },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
      {/* AI avatar */}
      <div className="w-12 h-12 rounded-full bg-accent/10 dark:bg-accent-dark/10 flex items-center justify-center mb-4">
        <Bot className="h-6 w-6 text-accent dark:text-accent-dark" />
      </div>

      {/* Welcome message */}
      <h3 className="text-base font-medium text-text dark:text-text-dark font-sans mb-1">
        Welcome to AI Chat
      </h3>
      <p className="text-sm text-text-secondary dark:text-text-secondary-dark font-sans text-center mb-6">
        Ask me anything about this book
      </p>

      {/* Usage tips */}
      <div className="flex flex-col gap-2 w-full max-w-[240px]">
        {tips.map(({ icon: Icon, text, prompt }) => (
          <button
            key={text}
            type="button"
            onClick={() => onSend(prompt)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-alt dark:bg-surface-alt-dark cursor-pointer transition-colors hover:bg-border/40 dark:hover:bg-border-dark/40 active:bg-border/60 dark:active:bg-border-dark/60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent dark:focus-visible:outline-accent-dark"
          >
            <Icon className="h-4 w-4 text-text-secondary dark:text-text-secondary-dark shrink-0" />
            <span className="text-sm text-text-secondary dark:text-text-secondary-dark font-sans">
              {text}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
