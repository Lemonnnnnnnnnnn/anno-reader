/**
 * Status chip for background "quick translate" runs.
 *
 * Deliberately unobtrusive: a small pill in the bottom-right corner of the
 * reading area that reports the run and fades away on its own. It never
 * accepts pointer events, so it cannot swallow a selection click, and it stays
 * below drawers (z-40 vs z-50) so opening a panel covers it.
 */

import { useEffect, useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { useQuickTranslateStore } from "@/stores/useQuickTranslateStore";

/** How long each outcome stays fully visible before fading out. */
const HOLD_MS = { saved: 1400, error: 2600 };
/** Fade duration, kept in sync with the opacity transition class. */
const FADE_MS = 400;

const STATUS_TEXT = {
  translating: "Translating…",
  saved: "Note saved",
  error: "Translation failed",
};

export function QuickTranslateChip() {
  const status = useQuickTranslateStore((s) => s.status);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (status === "idle" || status === "translating") {
      setFading(false);
      return;
    }

    // Capture the run this dismissal belongs to: a newer run must not be
    // dismissed by this timer.
    const runId = useQuickTranslateStore.getState().runId;
    const hold = HOLD_MS[status];
    const fadeTimer = setTimeout(() => setFading(true), hold);
    const dismissTimer = setTimeout(
      () => useQuickTranslateStore.getState().dismiss(runId),
      hold + FADE_MS,
    );

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(dismissTimer);
    };
  }, [status]);

  if (status === "idle") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 right-4 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full border border-border dark:border-border-dark bg-surface dark:bg-surface-dark shadow-md text-xs font-sans text-text-secondary dark:text-text-secondary-dark pointer-events-none transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      {status === "translating" && (
        <span className="w-3 h-3 shrink-0 rounded-full border-[1.5px] border-border dark:border-border-dark border-t-transparent animate-spin" />
      )}
      {status === "saved" && (
        <Check size={12} className="shrink-0 text-accent dark:text-accent-dark" />
      )}
      {status === "error" && <AlertCircle size={12} className="shrink-0 text-error" />}
      <span>{STATUS_TEXT[status]}</span>
    </div>
  );
}
