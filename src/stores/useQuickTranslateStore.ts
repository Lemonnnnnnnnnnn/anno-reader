/**
 * Status of the background "quick translate" runs.
 *
 * The chip that reports progress subscribes to this store, and the runs
 * themselves live outside React (see lib/ai/quick-translate.ts) so they
 * survive the selection being cleared. Only the newest run owns the chip:
 * every action takes the run id it belongs to and ignores stale ones.
 *
 * User-facing copy lives in the chip component, not here.
 */

import { create } from "zustand";

export type QuickTranslateStatus = "idle" | "translating" | "saved" | "error";

export interface QuickTranslateStore {
  status: QuickTranslateStatus;
  /** Id of the newest run — stale runs are ignored. */
  runId: number;
  /** Claim the chip and return the new run id. */
  begin: () => number;
  /** Report the outcome of a run. */
  settle: (runId: number, status: "saved" | "error") => void;
  /** Hide the chip again. */
  dismiss: (runId: number) => void;
}

export const useQuickTranslateStore = create<QuickTranslateStore>((set, get) => ({
  status: "idle",
  runId: 0,

  begin: () => {
    const runId = get().runId + 1;
    set({ status: "translating", runId });
    return runId;
  },

  settle: (runId, status) => {
    if (runId !== get().runId) return;
    set({ status });
  },

  dismiss: (runId) => {
    if (runId !== get().runId) return;
    set({ status: "idle" });
  },
}));
