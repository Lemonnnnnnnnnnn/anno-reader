/**
 * Wires git sync settings to the auto-sync timer.
 *
 * Mounted once in App so the timer lives across all routes. The effect
 * re-runs whenever enabled/dataDir/interval change, and startAutoSync
 * replaces the old timer — so editing the interval restarts the countdown.
 */

import { useEffect } from "react";
import { useGitSyncStore } from "@/stores/useGitSyncStore";
import { startAutoSync, stopAutoSync } from "@/lib/git/autoSync";

export function useGitAutoSync(): void {
  const isLoaded = useGitSyncStore((s) => s.isLoaded);
  const dataDir = useGitSyncStore((s) => s.dataDir);
  const autoSyncEnabled = useGitSyncStore((s) => s.autoSyncEnabled);
  const intervalMinutes = useGitSyncStore((s) => s.intervalMinutes);
  const runSync = useGitSyncStore((s) => s.runSync);

  useEffect(() => {
    if (!isLoaded || !autoSyncEnabled || !dataDir) {
      stopAutoSync();
      return;
    }

    startAutoSync(intervalMinutes * 60_000, () => {
      void runSync("auto");
    });
    return stopAutoSync;
  }, [isLoaded, dataDir, autoSyncEnabled, intervalMinutes, runSync]);
}
