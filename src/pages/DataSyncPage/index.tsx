/**
 * DataSyncPage component.
 *
 * Settings sub-page for Data Directory management and Git Sync.
 * Displays current data directory path with switch option,
 * and git sync controls when a git repo is detected.
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { open } from "@tauri-apps/plugin-dialog";
import {
  ArrowLeft,
  Folder,
  GitBranch,
  RefreshCw,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button, ErrorBanner } from "@/components/primitives";
import {
  readConfig,
  writeConfig,
  ensureDataSubdirs,
} from "@/lib/storage/config";
import { getGitStatus, syncGit } from "@/lib/git";
import type { GitStatus, SyncResult } from "@/lib/git";
import { DEFAULT_COMMIT_TEMPLATE } from "@/lib/git/types";

export function DataSyncPage() {
  const navigate = useNavigate();

  // Data directory state
  const [dataDir, setDataDir] = useState<string>("");
  const [switching, setSwitching] = useState(false);

  // Git state
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [loadingGit, setLoadingGit] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load current config
  useEffect(() => {
    readConfig().then((config) => {
      if (config) {
        setDataDir(config.dataDir);
        loadGitStatus(config.dataDir);
      }
    });
  }, []);

  // Load git status
  const loadGitStatus = useCallback(async (dir: string) => {
    setLoadingGit(true);
    setError(null);
    try {
      const status = await getGitStatus(dir);
      setGitStatus(status);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to check git status",
      );
    } finally {
      setLoadingGit(false);
    }
  }, []);

  // Switch data directory
  const handleSwitchDir = useCallback(async () => {
    setSwitching(true);
    setError(null);

    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Data Directory",
      });

      if (!selected || typeof selected !== "string") {
        setSwitching(false);
        return;
      }

      const config = await readConfig();
      if (config) {
        await writeConfig({ ...config, dataDir: selected });
      } else {
        await writeConfig({
          dataDir: selected,
          proxy: { enabled: false, address: "", port: "" },
        });
      }
      await ensureDataSubdirs(selected);

      // Reload the page to apply new data dir
      window.location.reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to switch directory",
      );
      setSwitching(false);
    }
  }, []);

  // Run git sync
  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    setError(null);

    try {
      const result = await syncGit(dataDir, DEFAULT_COMMIT_TEMPLATE);
      setSyncResult(result);

      // Reload git status after sync
      if (result.success) {
        await loadGitStatus(dataDir);
      }
    } catch (err) {
      // Tauri invoke() can reject with a plain string, an object, or an
      // Error instance. Preserve as much info as possible for debugging.
      const message =
        typeof err === "string"
          ? err
          : err instanceof Error
            ? err.message
            : typeof err === "object" && err !== null
              ? JSON.stringify(err)
              : "Sync failed";
      console.error("[DataSyncPage] syncGit threw:", err);
      setError(`Sync failed: ${message}`);
    } finally {
      setSyncing(false);
    }
  }, [dataDir, loadGitStatus]);

  // Refresh git status
  const handleRefresh = useCallback(() => {
    loadGitStatus(dataDir);
  }, [dataDir, loadGitStatus]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg dark:bg-bg-dark text-text dark:text-text-dark font-serif">
      {/* Header */}
      <header className="shrink-0 bg-surface dark:bg-surface-dark border-b border-border dark:border-border-dark">
        <div className="flex items-center gap-3 px-6 py-4 max-w-[1200px] mx-auto w-full">
          <Button
            variant="icon"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </Button>
          <h1 className="text-xl font-semibold text-text dark:text-text-dark tracking-tight m-0">
            Data & Sync
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-[600px] mx-auto flex flex-col gap-8">
          {/* Error banner */}
          {error && <ErrorBanner message={error} />}

          {/* Data Directory Section */}
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider m-0">
              Data Directory
            </h2>

            <div className="flex items-center gap-3 p-4 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md">
              <Folder
                size={20}
                className="shrink-0 text-text-muted dark:text-text-muted-dark"
              />
              <span className="flex-1 text-sm font-sans truncate text-text dark:text-text-dark">
                {dataDir || "Not configured"}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSwitchDir}
                disabled={switching}
              >
                {switching ? "Switching..." : "Switch"}
              </Button>
            </div>

            <p className="text-xs text-text-muted dark:text-text-muted-dark m-0">
              Switching will reload the application with the new data directory.
            </p>
          </section>

          {/* Git Sync Section */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider m-0">
                Git Sync
              </h2>
              <Button
                variant="icon"
                onClick={handleRefresh}
                disabled={loadingGit}
                aria-label="Refresh git status"
              >
                <RefreshCw
                  size={16}
                  className={loadingGit ? "animate-spin" : ""}
                />
              </Button>
            </div>

            {/* Git status card */}
            <div className="p-4 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md">
              {loadingGit ? (
                <div className="flex items-center gap-2 text-text-muted dark:text-text-muted-dark">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm font-sans">
                    Checking git status...
                  </span>
                </div>
              ) : !gitStatus?.is_repo ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-text-muted dark:text-text-muted-dark">
                    <GitBranch size={16} />
                    <span className="text-sm font-sans">
                      Not a git repository
                    </span>
                  </div>
                  <p className="text-xs text-text-muted dark:text-text-muted-dark m-0">
                    Initialize a git repo in your data directory to enable sync.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Remote & Branch */}
                  <div className="flex flex-col gap-1">
                    {gitStatus.remote && (
                      <div className="flex items-center gap-2 text-sm font-sans">
                        <span className="text-text-muted dark:text-text-muted-dark">
                          Remote:
                        </span>
                        <span className="text-text dark:text-text-dark truncate">
                          {gitStatus.remote}
                        </span>
                        {gitStatus.remote_protocol && (
                          <span className="text-xs px-1.5 py-0.5 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded">
                            {gitStatus.remote_protocol}
                          </span>
                        )}
                      </div>
                    )}
                    {gitStatus.branch && (
                      <div className="flex items-center gap-2 text-sm font-sans">
                        <GitBranch
                          size={14}
                          className="text-text-muted dark:text-text-muted-dark"
                        />
                        <span className="text-text dark:text-text-dark">
                          {gitStatus.branch}
                        </span>
                        {gitStatus.ahead > 0 && (
                          <span className="text-xs px-1.5 py-0.5 bg-accent/10 dark:bg-accent-dark/10 text-accent dark:text-accent-dark rounded">
                            {gitStatus.ahead} ahead
                          </span>
                        )}
                        {gitStatus.behind > 0 && (
                          <span className="text-xs px-1.5 py-0.5 bg-warning/10 dark:bg-warning-dark/10 text-warning dark:text-warning-dark rounded">
                            {gitStatus.behind} behind
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Changes indicator */}
                  {gitStatus.has_changes && (
                    <div className="flex items-center gap-2 text-xs text-text-muted dark:text-text-muted-dark">
                      <div className="w-2 h-2 rounded-full bg-warning dark:bg-warning-dark" />
                      Uncommitted changes
                    </div>
                  )}

                  {/* Sync button */}
                  <Button
                    variant="primary"
                    onClick={handleSync}
                    disabled={syncing}
                    className="w-full flex items-center justify-center"
                  >
                    {syncing ? (
                      <>
                        <Loader2 size={16} className="animate-spin mr-2" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={16} className="mr-2" />
                        Sync
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Sync result */}
            {syncResult && (
              <div
                className={`p-4 rounded-md border ${
                  syncResult.success
                    ? "bg-success/5 dark:bg-success-dark/5 border-success/20 dark:border-success-dark/20"
                    : "bg-error/5 dark:bg-error-dark/5 border-error/20 dark:border-error-dark/20"
                }`}
              >
                <div className="flex items-start gap-2">
                  {syncResult.success ? (
                    <Check
                      size={16}
                      className="shrink-0 text-success dark:text-success-dark mt-0.5"
                    />
                  ) : (
                    <AlertCircle
                      size={16}
                      className="shrink-0 text-error dark:text-error-dark mt-0.5"
                    />
                  )}
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-sans text-text dark:text-text-dark">
                      {syncResult.message}
                    </span>
                    {syncResult.conflicts.length > 0 && (
                      <ul className="text-xs text-error dark:text-error-dark m-0 pl-4 list-disc">
                        {syncResult.conflicts.map((file: string, i: number) => (
                          <li key={i}>{file}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
