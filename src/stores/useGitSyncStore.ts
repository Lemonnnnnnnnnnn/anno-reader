import { create } from "zustand";
import { toast } from "sonner";
import { readConfig, writeConfig } from "@/lib/storage/config";
import { getGitStatus, getGitStatusAfterFetch, syncGit } from "@/lib/git";
import type { SyncResult } from "@/lib/git";
import { DEFAULT_COMMIT_TEMPLATE } from "@/lib/git/types";

export type SyncTrigger = "manual" | "auto";

export interface GitSyncStore {
  // Persisted settings
  dataDir: string;
  autoSyncEnabled: boolean;
  intervalMinutes: number;
  isLoaded: boolean;

  // Runtime state — shared by manual and auto sync so the two can never run
  // concurrently (git would fail on index.lock contention).
  isSyncing: boolean;
  lastSyncAt: number | null;
  lastSyncTrigger: SyncTrigger | null;
  lastAutoSyncAt: number | null;
  lastSyncSuccess: boolean | null;
  lastSyncMessage: string | null;
  lastSyncConflicts: string[];
  /** When a sync last pulled remote commits down (drives UI reloads). */
  lastPullAt: number | null;

  setAutoSyncEnabled: (enabled: boolean) => void;
  setIntervalMinutes: (minutes: number) => void;

  loadConfig: () => Promise<void>;

  /**
   * Run a git sync (commit -> pull -> push) and record the outcome.
   *
   * Auto sync performs pre-checks and silently skips when there is nothing
   * to do (no repo, no remote, or no local/remote delta). When nothing
   * local qualifies it fetches first — behind counts read the cached
   * origin/<branch> ref, so remote-only changes are invisible without a
   * fetch. Errors are caught and recorded — never thrown to the UI.
   *
   * @returns The SyncResult, or null when skipped/failed.
   */
  runSync: (trigger: SyncTrigger) => Promise<SyncResult | null>;
}

/**
 * Helper to persist git sync settings after a state mutation.
 * Fire-and-forget — logs errors but doesn't block UI.
 */
function persistAfterSet(get: () => GitSyncStore) {
  (async () => {
    const config = await readConfig();
    if (!config) return;

    await writeConfig({
      ...config,
      gitSync: {
        autoSyncEnabled: get().autoSyncEnabled,
        intervalMinutes: get().intervalMinutes,
      },
    });
  })().catch((err) => {
    console.error("Failed to persist git sync config:", err);
  });
}

/**
 * Extract a readable message from a rejected Tauri invoke(), which can
 * reject with a plain string, an object, or an Error instance.
 */
function errorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) return JSON.stringify(err);
  return "Sync failed";
}

export const useGitSyncStore = create<GitSyncStore>((set, get) => ({
  dataDir: "",
  autoSyncEnabled: false,
  intervalMinutes: 30,
  isLoaded: false,

  isSyncing: false,
  lastSyncAt: null,
  lastSyncTrigger: null,
  lastAutoSyncAt: null,
  lastSyncSuccess: null,
  lastSyncMessage: null,
  lastSyncConflicts: [],
  lastPullAt: null,

  setAutoSyncEnabled: (enabled) => {
    set({ autoSyncEnabled: enabled });
    persistAfterSet(get);
  },

  setIntervalMinutes: (minutes) => {
    set({ intervalMinutes: minutes });
    persistAfterSet(get);
  },

  loadConfig: async () => {
    try {
      const config = await readConfig();
      if (!config) {
        set({ isLoaded: true });
        return;
      }

      set({
        dataDir: config.dataDir,
        // Defensive defaults — readConfig sanitizes gitSync, but the store
        // must not regress to `undefined` if handed a partial config.
        autoSyncEnabled: config.gitSync?.autoSyncEnabled ?? false,
        intervalMinutes: config.gitSync?.intervalMinutes ?? 30,
        isLoaded: true,
      });
    } catch (err) {
      console.error("Failed to load git sync config:", err);
      set({ isLoaded: true });
    }
  },

  runSync: async (trigger) => {
    const { isSyncing, dataDir } = get();
    if (isSyncing || !dataDir) return null;

    set({ isSyncing: true });
    try {
      // Auto sync skips silently when there is nothing to do — no repo, no
      // remote, or no delta in either direction (an empty sync would spawn
      // several git processes every interval for zero effect).
      if (trigger === "auto") {
        let status = await getGitStatus(dataDir);
        const hasRemote = status.is_repo && !!status.remote;
        if (!hasRemote) {
          return null;
        }

        // A local delta is visible without the network; a remote-only delta
        // is not — behind counts read the cached origin/<branch> ref, so
        // check the real remote whenever nothing local qualifies.
        const hasLocalDelta = status.has_changes || status.ahead > 0;
        if (!hasLocalDelta) {
          status = await getGitStatusAfterFetch(dataDir).catch(() => status);
        }

        const hasDelta =
          status.has_changes || status.ahead > 0 || status.behind > 0;
        if (!hasDelta) {
          return null;
        }
      }

      const result = await syncGit(dataDir, DEFAULT_COMMIT_TEMPLATE);
      set({
        lastSyncAt: Date.now(),
        lastSyncTrigger: trigger,
        lastAutoSyncAt: trigger === "auto" ? Date.now() : get().lastAutoSyncAt,
        lastSyncSuccess: result.success,
        lastSyncMessage: result.message,
        lastSyncConflicts: result.conflicts,
        lastPullAt:
          result.success && result.pulled ? Date.now() : get().lastPullAt,
      });

      // Auto backups notify via toast (silent skips never reach here).
      // Manual sync has inline feedback on the Data Sync page instead.
      if (trigger === "auto") {
        if (result.success) {
          // Neutral styling on purpose — a routine backup isn't worth green.
        toast("自动备份完成");
        } else {
          toast.error("自动备份失败", {
            description: result.message,
            duration: 8000,
          });
        }
      }

      return result;
    } catch (err) {
      console.error("[useGitSyncStore] sync failed:", err);
      const message = errorMessage(err);
      set({
        lastSyncAt: Date.now(),
        lastSyncTrigger: trigger,
        lastAutoSyncAt: trigger === "auto" ? Date.now() : get().lastAutoSyncAt,
        lastSyncSuccess: false,
        lastSyncMessage: message,
        lastSyncConflicts: [],
      });

      if (trigger === "auto") {
        toast.error("自动备份失败", { description: message, duration: 8000 });
      }

      return null;
    } finally {
      set({ isSyncing: false });
    }
  },
}));
