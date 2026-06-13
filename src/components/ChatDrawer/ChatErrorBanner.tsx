/**
 * ChatErrorBanner component.
 *
 * Type-aware error UI that adapts based on the error code:
 * - AUTH_ERROR: Config guidance pointing to AI Settings
 * - NETWORK_ERROR: Network check message with retry button
 * - RATE_LIMITED: Wait hint with retry button
 * - Default: Generic error with retry button
 */

import { Settings, RefreshCw, Clock } from "lucide-react";
import { Button, ErrorBanner } from "@/components/primitives";
import type { AIServiceErrorCode } from "@/lib/ai/service";

interface ChatErrorBannerProps {
  /** Error message to display */
  error: string;
  /** Classified error code for type-aware UI */
  errorCode: AIServiceErrorCode | null;
  /** Retry the last failed request */
  onRetry: () => void;
}

/**
 * Error banner with type-aware UI: config guidance, retry button, or wait hint.
 */
export function ChatErrorBanner({
  error,
  errorCode,
  onRetry,
}: ChatErrorBannerProps) {
  if (errorCode === "AUTH_ERROR") {
    return (
      <div className="py-2 px-3 space-y-2">
        <div className="flex items-center gap-2 text-error">
          <Settings className="h-4 w-4 shrink-0" />
          <span className="text-sm font-sans">
            No AI provider configured. Please set up a provider in AI Settings.
          </span>
        </div>
      </div>
    );
  }

  if (errorCode === "NETWORK_ERROR") {
    return (
      <div className="py-2 px-3 space-y-2">
        <ErrorBanner message="Network error. Please check your connection." />
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  if (errorCode === "RATE_LIMITED") {
    return (
      <div className="py-2 px-3 space-y-2">
        <div className="flex items-center gap-2 text-text-secondary dark:text-text-secondary-dark">
          <Clock className="h-4 w-4 shrink-0" />
          <span className="text-sm font-sans">
            Too many requests. Please wait a moment and try again.
          </span>
        </div>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  // Default: generic error with retry
  return (
    <div className="py-2 px-3 space-y-2">
      <ErrorBanner message={error} />
      <Button variant="secondary" size="sm" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        Retry
      </Button>
    </div>
  );
}
