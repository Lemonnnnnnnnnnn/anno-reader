/**
 * Git sync types for Tauri IPC.
 */

export interface GitStatus {
  is_repo: boolean;
  remote: string | null;
  remote_protocol: string | null; // "ssh" | "https" | "unknown"
  branch: string | null;
  ahead: number;
  behind: number;
  has_changes: boolean;
}

export interface SyncResult {
  success: boolean;
  message: string;
  conflicts: string[];
}

/** Default commit message template */
export const DEFAULT_COMMIT_TEMPLATE = "Sync at {datetime}";

/** Available template variables */
export const TEMPLATE_VARIABLES = {
  "{datetime}": "2026-06-28 10:30:00",
  "{date}": "2026-06-28",
  "{time}": "10:30:00",
} as const;
