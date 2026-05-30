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
import { Button, Icon, ErrorBanner } from "@/components/primitives";

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

      await writeConfig({ dataDir: selected, showTocSidebar: true, showNotesSidebar: true });
      await ensureDataSubdirs(selected);

      onComplete();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to set data directory"
      );
    } finally {
      setLoading(false);
    }
  }, [onComplete]);

  return (
    <div className="flex items-center justify-center h-screen w-screen bg-bg text-text font-serif">
      <div className="flex flex-col items-center gap-4 p-8 text-center max-w-[360px]">
        {/* Folder icon */}
        <Icon name="folder" size={64} className="text-text-muted opacity-50" />

        {/* Title */}
        <h1 className="text-xl font-semibold text-text tracking-tight m-0">
          Select Data Directory
        </h1>

        {/* Subtitle */}
        <p className="text-sm text-text-secondary leading-relaxed m-0">
          Choose where to store your reading progress, notes, and highlights
        </p>

        {/* Error message */}
        {error && <ErrorBanner message={error} />}

        {/* Action button */}
        <Button
          variant="primary"
          loading={loading}
          onClick={handleSelect}
          disabled={loading}
          className="mt-2"
        >
          {loading ? "Setting up..." : "Select Directory"}
        </Button>
      </div>
    </div>
  );
}
