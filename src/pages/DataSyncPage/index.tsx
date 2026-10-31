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
import { Toggle } from "@/components/primitives/Toggle";
import {
  readConfig,
  writeConfig,
  ensureDataSubdirs,
  DEFAULT_CONFIG,
  MIN_INTERVAL_MINUTES,
  MAX_INTERVAL_MINUTES,
} from "@/lib/storage/config";
import { getGitStatus } from "@/lib/git";
import type { GitStatus } from "@/lib/git";
import { useGitSyncStore } from "@/stores/useGitSyncStore";

/** Format a sync timestamp as a short local time for status lines. */
function formatSyncTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

export function DataSyncPage() {
  const navigate = useNavigate();

  // Data directory state
  const [dataDir, setDataDir] = useState<string>("");
  const [switching, setSwitching] = useState(false);

  // Git state
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [loadingGit, setLoadingGit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Git sync store — shared by manual and auto sync
  const autoSyncEnabled = useGitSyncStore((s) => s.autoSyncEnabled);
  const intervalMinutes = useGitSyncStore((s) => s.intervalMinutes);
  const setAutoSyncEnabled = useGitSyncStore((s) => s.setAutoSyncEnabled);
  const setIntervalMinutes = useGitSyncStore((s) => s.setIntervalMinutes);
  const runSync = useGitSyncStore((s) => s.runSync);
  const isSyncing = useGitSyncStore((s) => s.isSyncing);
  const lastSyncAt = useGitSyncStore((s) => s.lastSyncAt);
  const lastSyncTrigger = useGitSyncStore((s) => s.lastSyncTrigger);
  const lastAutoSyncAt = useGitSyncStore((s) => s.lastAutoSyncAt);
  const lastSyncSuccess = useGitSyncStore((s) => s.lastSyncSuccess);
  const lastSyncMessage = useGitSyncStore((s) => s.lastSyncMessage);
  const lastSyncConflicts = useGitSyncStore((s) => s.lastSyncConflicts);

  // Interval field — kept as raw text while editing, committed on blur
  const [intervalInput, setIntervalInput] = useState<string>(() =>
    String(intervalMinutes),
  );
  useEffect(() => {
    setIntervalInput(String(intervalMinutes));
  }, [intervalMinutes]);

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
        await writeConfig({ ...DEFAULT_CONFIG, dataDir: selected });
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

  // Run git sync (manual trigger — the store guards against concurrent runs)
  const handleSync = useCallback(async () => {
    setError(null);
    const result = await runSync("manual");

    // Refresh ahead/behind/dirty indicators after a successful sync
    if (result?.success && dataDir) {
      await loadGitStatus(dataDir);
    }
  }, [runSync, dataDir, loadGitStatus]);

  // Commit the interval field on blur; invalid input reverts to the
  // persisted value.
  const handleIntervalBlur = useCallback(() => {
    const parsed = Number.parseInt(intervalInput, 10);
    if (
      Number.isInteger(parsed) &&
      parsed >= MIN_INTERVAL_MINUTES &&
      parsed <= MAX_INTERVAL_MINUTES
    ) {
      if (parsed !== intervalMinutes) {
        setIntervalMinutes(parsed);
      }
    } else {
      setIntervalInput(String(intervalMinutes));
    }
  }, [intervalInput, intervalMinutes, setIntervalMinutes]);

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
            数据与同步
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
                    disabled={isSyncing}
                    className="w-full flex items-center justify-center"
                  >
                    {isSyncing ? (
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

            {/* Auto sync settings */}
            {gitStatus?.is_repo && (
              <div className="p-4 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-sans text-text dark:text-text-dark">
                      自动备份
                    </span>
                    <span className="text-xs text-text-muted dark:text-text-muted-dark">
                      按固定间隔自动执行同步(提交 → 拉取 → 推送)
                    </span>
                  </div>
                  <Toggle
                    checked={autoSyncEnabled}
                    onChange={setAutoSyncEnabled}
                    label="启用自动备份"
                    disabled={!gitStatus.remote}
                  />
                </div>

                <label className="flex items-center gap-2">
                  <span className="text-xs font-sans text-text-secondary dark:text-text-secondary-dark shrink-0">
                    同步间隔(分钟)
                  </span>
                  <input
                    type="text"
                    value={intervalInput}
                    onChange={(e) => setIntervalInput(e.target.value)}
                    onBlur={handleIntervalBlur}
                    disabled={!gitStatus.remote}
                    className="w-20 px-2 py-1 text-sm font-sans bg-bg dark:bg-bg-dark border border-border dark:border-border-dark rounded-md outline-none focus:border-accent dark:focus:border-accent-dark text-text dark:text-text-dark disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </label>

                {gitStatus.remote ? (
                  lastAutoSyncAt !== null ? (
                    <p className="text-xs text-text-muted dark:text-text-muted-dark m-0">
                      上次自动同步:{formatSyncTime(lastAutoSyncAt)}
                    </p>
                  ) : (
                    <p className="text-xs text-text-muted dark:text-text-muted-dark m-0">
                      自动备份尚未执行;仅在仓库有远端且有变更时才会运行。
                    </p>
                  )
                ) : (
                  <p className="text-xs text-text-muted dark:text-text-muted-dark m-0">
                    需要先配置远端仓库(origin)才能启用自动备份。
                  </p>
                )}
              </div>
            )}

            {/* Sync result */}
            {lastSyncAt !== null && (
              <div
                className={`p-4 rounded-md border ${
                  lastSyncSuccess
                    ? "bg-success/5 dark:bg-success-dark/5 border-success/20 dark:border-success-dark/20"
                    : "bg-error/5 dark:bg-error-dark/5 border-error/20 dark:border-error-dark/20"
                }`}
              >
                <div className="flex items-start gap-2">
                  {lastSyncSuccess ? (
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
                      {lastSyncMessage}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-text-muted dark:text-text-muted-dark">
                      <span>
                        {formatSyncTime(lastSyncAt)} ·{" "}
                        {lastSyncTrigger === "auto" ? "自动" : "手动"}
                      </span>
                    </span>
                    {lastSyncConflicts.length > 0 && (
                      <ul className="text-xs text-error dark:text-error-dark m-0 pl-4 list-disc">
                        {lastSyncConflicts.map((file: string, i: number) => (
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
