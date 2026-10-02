import { create } from "zustand";
import {
  fetchLatestRelease,
  isNewerVersion,
  markSilentCheckDone,
  shouldSilentCheck,
} from "@/lib/updater";
import { getAppVersion } from "@/lib/version";

export type UpdateStatus =
  | "idle" // not checked yet (or silent check failed — retry next time)
  | "checking"
  | "up-to-date"
  | "available"
  | "error";

interface UpdateStore {
  status: UpdateStatus;
  latestVersion: string | null;
  releaseUrl: string | null;
  error: string | null;

  /**
   * Check GitHub for a newer release.
   *
   * - `silent: true` (startup): throttled to once per 24 h, failures stay
   *   quiet (no error state) so they never bother the user.
   * - `silent: false` (manual button): always runs and surfaces errors.
   */
  checkUpdate: (opts?: { silent?: boolean }) => Promise<void>;
}

export const useUpdateStore = create<UpdateStore>((set, get) => ({
  status: "idle",
  latestVersion: null,
  releaseUrl: null,
  error: null,

  checkUpdate: async ({ silent = false } = {}) => {
    if (get().status === "checking") return;
    if (silent && !shouldSilentCheck()) return;

    const prevStatus = get().status;
    set({ status: "checking" });

    try {
      const release = await fetchLatestRelease();
      const current = await getAppVersion();
      markSilentCheckDone();

      if (isNewerVersion(release.version, current)) {
        set({
          status: "available",
          latestVersion: release.version,
          releaseUrl: release.releaseUrl,
          error: null,
        });
      } else {
        set({
          status: "up-to-date",
          latestVersion: release.version,
          releaseUrl: null,
          error: null,
        });
      }
    } catch (err) {
      console.error("Update check failed:", err);
      if (silent) {
        // Restore the pre-check status so an existing "available" badge
        // survives a failed background refresh.
        set({ status: prevStatus === "checking" ? "idle" : prevStatus });
      } else {
        set({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  },
}));
