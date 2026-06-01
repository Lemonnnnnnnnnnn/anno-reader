/**
 * ErrorBoundary component.
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs them, and displays a fallback UI instead of crashing the
 * entire application.
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <ReaderLayout />
 * </ErrorBoundary>
 * ```
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/primitives";

interface ErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode;
  /** Optional fallback UI to render on error */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  /** Whether an error has been caught */
  hasError: boolean;
  /** The caught error, if any */
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to console (could be extended to error reporting service)
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="flex items-center justify-center h-screen w-screen bg-bg font-serif">
          <div className="flex flex-col items-center text-center p-8 max-w-[480px] bg-surface rounded-lg border border-border shadow-lg">
            <CircleAlert size={48} className="text-error mb-4" />
            <h2 className="text-xl font-semibold text-text mb-2">Something went wrong</h2>
            <p className="text-sm text-text-secondary leading-relaxed mb-4">
              An unexpected error occurred. This might be due to a corrupt
              file or an issue with the application.
            </p>
            {this.state.error && (
              <details className="w-full mb-4 text-left">
                <summary className="text-xs text-text-muted cursor-pointer py-1">
                  Technical details
                </summary>
                <pre className="text-xs text-error bg-error-bg p-3 rounded overflow-auto max-h-[120px] mt-2 whitespace-pre-wrap break-word">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="flex gap-3">
              <Button variant="primary" onClick={this.handleReset}>
                Try Again
              </Button>
              <Button
                variant="secondary"
                onClick={() => window.location.reload()}
              >
                Reload App
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
