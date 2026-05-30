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
        <div style={styles.container}>
          <div style={styles.content}>
            <div style={styles.icon}>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 style={styles.title}>Something went wrong</h2>
            <p style={styles.message}>
              An unexpected error occurred. This might be due to a corrupt
              file or an issue with the application.
            </p>
            {this.state.error && (
              <details style={styles.details}>
                <summary style={styles.summary}>Technical details</summary>
                <pre style={styles.errorText}>
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div style={styles.actions}>
              <button style={styles.button} onClick={this.handleReset}>
                Try Again
              </button>
              <button
                style={styles.buttonSecondary}
                onClick={() => window.location.reload()}
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Design tokens (aligned with project conventions) ---

const colors = {
  bg: "#f6f6f6",
  surface: "#ffffff",
  text: "#0f0f0f",
  textSecondary: "#6b7280",
  textMuted: "#9ca3af",
  border: "#e5e5e5",
  accent: "#374151",
  error: "#dc2626",
  errorBg: "#fef2f2",
} as const;

const spacing = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
  xxl: "2rem",
} as const;

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    width: "100vw",
    background: colors.bg,
    fontFamily:
      "'Literata', 'Georgia', 'Iowan Old Style', 'Palatino Linotype', 'Noto Serif', serif",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    padding: spacing.xxl,
    maxWidth: "480px",
    background: colors.surface,
    borderRadius: "8px",
    border: `1px solid ${colors.border}`,
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
  },
  icon: {
    color: colors.error,
    marginBottom: spacing.lg,
  },
  title: {
    margin: 0,
    fontSize: "1.25rem",
    fontWeight: 600,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  message: {
    margin: 0,
    fontSize: "0.9rem",
    color: colors.textSecondary,
    lineHeight: 1.5,
    marginBottom: spacing.lg,
  },
  details: {
    width: "100%",
    marginBottom: spacing.lg,
    textAlign: "left",
  },
  summary: {
    fontSize: "0.85rem",
    color: colors.textMuted,
    cursor: "pointer",
    padding: `${spacing.xs} 0`,
  },
  errorText: {
    fontSize: "0.8rem",
    color: colors.error,
    background: colors.errorBg,
    padding: spacing.md,
    borderRadius: "4px",
    overflow: "auto",
    maxHeight: "120px",
    marginTop: spacing.sm,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  actions: {
    display: "flex",
    gap: spacing.md,
  },
  button: {
    padding: `${spacing.sm} ${spacing.lg}`,
    fontSize: "0.875rem",
    fontWeight: 500,
    color: colors.surface,
    background: colors.accent,
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "background 0.15s",
    fontFamily: "inherit",
  },
  buttonSecondary: {
    padding: `${spacing.sm} ${spacing.lg}`,
    fontSize: "0.875rem",
    fontWeight: 500,
    color: colors.textSecondary,
    background: "transparent",
    border: `1px solid ${colors.border}`,
    borderRadius: "6px",
    cursor: "pointer",
    transition: "color 0.15s, border-color 0.15s",
    fontFamily: "inherit",
  },
};
