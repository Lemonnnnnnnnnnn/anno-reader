import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Icon } from "@/components/primitives";
import { readConfig, writeConfig, DEFAULT_CONFIG } from "@/lib/storage/config";
import type { AppConfig } from "@/lib/storage/config";

export function SettingsPage() {
  const navigate = useNavigate();
  const [showToc, setShowToc] = useState(true);
  const [showNotes, setShowNotes] = useState(true);
  const configRef = useRef<AppConfig | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    readConfig().then((config) => {
      if (config) {
        configRef.current = config;
        setShowToc(config.showTocSidebar);
        setShowNotes(config.showNotesSidebar);
      }
    });
  }, []);

  const persistConfig = useCallback(
    (update: (current: AppConfig) => AppConfig) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(() => {
        const current = configRef.current ?? { ...DEFAULT_CONFIG };
        const next = update(current);
        configRef.current = next;
        writeConfig(next);
      }, 300);
    },
    []
  );

  const handleToggleToc = useCallback(() => {
    setShowToc((prev) => {
      persistConfig((cfg) => ({ ...cfg, showTocSidebar: !prev }));
      return !prev;
    });
  }, [persistConfig]);

  const handleToggleNotes = useCallback(() => {
    setShowNotes((prev) => {
      persistConfig((cfg) => ({ ...cfg, showNotesSidebar: !prev }));
      return !prev;
    });
  }, [persistConfig]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg text-text font-serif">
      {/* Header */}
      <header className="shrink-0 bg-surface border-b border-border">
        <div className="flex items-center gap-3 px-6 py-4 max-w-[1200px] mx-auto w-full">
          <Button variant="icon" onClick={() => navigate(-1)} aria-label="Go back">
            <Icon name="arrow-left" size={18} />
          </Button>
          <h1 className="text-xl font-semibold text-text tracking-tight m-0">
            Settings
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-[600px] mx-auto flex flex-col gap-6">
          {/* TOC sidebar toggle */}
          <div className="flex items-center justify-between p-4 bg-surface rounded-lg border border-border">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-text">
                Show Table of Contents sidebar
              </span>
              <span className="text-xs text-text-secondary">
                Display the chapter navigation panel while reading
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={showToc}
              onClick={handleToggleToc}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                showToc ? "bg-accent" : "bg-border"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  showToc ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Notes sidebar toggle */}
          <div className="flex items-center justify-between p-4 bg-surface rounded-lg border border-border">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-text">
                Show Notes sidebar
              </span>
              <span className="text-xs text-text-secondary">
                Display the notes and highlights panel while reading
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={showNotes}
              onClick={handleToggleNotes}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                showNotes ? "bg-accent" : "bg-border"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  showNotes ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
