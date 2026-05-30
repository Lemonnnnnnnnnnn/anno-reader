/**
 * DataDirSetup component.
 *
 * Full-screen directory selection UI shown on first launch when no data
 * directory has been configured. Prompts the user to choose a folder
 * where reading progress, notes, and highlights will be stored.
 *
 * @example
 * ```tsx
 * <DataDirSetup onComplete={() => setConfigured(true)} />
 * ```
 */

import { useState, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { writeConfig, ensureDataSubdirs } from "@/lib/storage/config";

export function DataDirSetup({ onComplete }: { onComplete: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Data Directory",
      });

      // User cancelled the dialog
      if (!selected || typeof selected !== "string") {
        setLoading(false);
        return;
      }

      await writeConfig({ dataDir: selected });
      await ensureDataSubdirs(selected);

      onComplete();
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : "Failed to set data directory"
      );
    } finally {
      setLoading(false);
    }
  }, [onComplete]);

  return (
    <div style={styles.layout}>
      <div style={styles.container}>
        {/* Folder icon */}
        <div style={styles.icon}>
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </div>

        {/* Title */}
        <h1 style={styles.title}>Select Data Directory</h1>

        {/* Subtitle */}
        <p style={styles.subtitle}>
          Choose where to store your reading progress, notes, and highlights
        </p>

        {/* Error message */}
        {error && <p style={styles.error}>{error}</p>}

        {/* Action button */}
        <button
          style={{
            ...styles.button,
            ...(loading ? styles.buttonDisabled : {}),
          }}
          onClick={handleSelect}
          disabled={loading}
        >
          {loading ? "Setting up..." : "Select Directory"}
        </button>
      </div>
    </div>
  );
}

// --- Design tokens (aligned with ReaderLayout conventions) ---

const colors = {
  bg: "#f6f6f6",
  surface: "#ffffff",
  text: "#0f0f0f",
  textSecondary: "#6b7280",
  textMuted: "#9ca3af",
  accent: "#374151",
  error: "#dc2626",
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
  layout: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    width: "100vw",
    background: colors.bg,
    color: colors.text,
    fontFamily:
      "'Literata', 'Georgia', 'Iowan Old Style', 'Palatino Linotype', 'Noto Serif', 'Noto Serif CJK SC', serif",
    fontOpticalSizing: "auto",
    fontFeatureSettings: "'kern' 1, 'liga' 1",
  },
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: spacing.lg,
    padding: spacing.xxl,
    textAlign: "center",
    maxWidth: "360px",
  },
  icon: {
    color: colors.textMuted,
    opacity: 0.5,
  },
  title: {
    margin: 0,
    fontSize: "1.25rem",
    fontWeight: 600,
    color: colors.text,
    letterSpacing: "-0.02em",
  },
  subtitle: {
    margin: 0,
    fontSize: "0.9rem",
    color: colors.textSecondary,
    lineHeight: 1.5,
  },
  error: {
    margin: 0,
    fontSize: "0.85rem",
    color: colors.error,
  },
  button: {
    marginTop: spacing.sm,
    padding: `${spacing.md} ${spacing.xl}`,
    fontSize: "0.875rem",
    fontWeight: 500,
    color: colors.surface,
    background: colors.accent,
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "background 0.15s, transform 0.1s",
    letterSpacing: "0.01em",
    boxShadow: "none",
    fontFamily: "inherit",
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
};
