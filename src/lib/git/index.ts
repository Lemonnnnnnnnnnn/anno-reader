/**
 * Git sync service — wraps Tauri IPC commands.
 */

import { invoke } from "@tauri-apps/api/core";
import type { GitStatus, SyncResult } from "./types";

export type { GitStatus, SyncResult } from "./types";

/**
 * Get git status for the given directory.
 * Returns GitStatus with repo info, remote, branch, and ahead/behind counts.
 */
export async function getGitStatus(dataDir: string): Promise<GitStatus> {
  return invoke<GitStatus>("git_status", { dataDir });
}

/**
 * Fetch from origin (best-effort) and return git status with fresh
 * ahead/behind counts.
 *
 * getGitStatus reads the locally cached origin/<branch> ref, which stays
 * stale until something fetches — remote-only changes are invisible to it.
 * Use this before deciding a periodic sync has nothing to do.
 */
export async function getGitStatusAfterFetch(
  dataDir: string
): Promise<GitStatus> {
  return invoke<GitStatus>("git_fetch_status", { dataDir });
}

/**
 * Sync git repository: pull (fast-fail) -> add . -> commit -> push.
 *
 * @param dataDir - The data directory path.
 * @param messageTemplate - Commit message template with {datetime}, {date}, {time} placeholders.
 * @returns SyncResult with success status, message, and any conflict file list.
 */
export async function syncGit(
  dataDir: string,
  messageTemplate?: string
): Promise<SyncResult> {
  return invoke<SyncResult>("git_sync", {
    dataDir,
    messageTemplate: messageTemplate ?? null,
  });
}
