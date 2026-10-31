/**
 * Auto-sync timer singleton.
 *
 * Holds the single periodic timer that triggers git auto-sync. Kept outside
 * React so the interval logic is unit-testable with fake timers, and so
 * re-renders never spawn duplicate timers — startAutoSync always replaces
 * any previously running timer.
 */

let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Start (or restart) the auto-sync timer with the given interval.
 * Any previously running timer is cleared first.
 */
export function startAutoSync(intervalMs: number, tick: () => void): void {
  stopAutoSync();
  timer = setInterval(tick, intervalMs);
}

/** Stop the auto-sync timer if running. Safe to call repeatedly. */
export function stopAutoSync(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

/** Whether the auto-sync timer is currently running (for tests/debug). */
export function isAutoSyncRunning(): boolean {
  return timer !== null;
}
