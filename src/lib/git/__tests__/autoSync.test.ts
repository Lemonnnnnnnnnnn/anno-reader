import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  startAutoSync,
  stopAutoSync,
  isAutoSyncRunning,
} from "@/lib/git/autoSync";

describe("autoSync timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stopAutoSync();
  });

  afterEach(() => {
    stopAutoSync();
    vi.useRealTimers();
  });

  it("fires the tick once per interval", () => {
    const tick = vi.fn();
    const intervalMs = 30 * 60_000;

    startAutoSync(intervalMs, tick);
    expect(tick).not.toHaveBeenCalled();

    vi.advanceTimersByTime(intervalMs);
    expect(tick).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(intervalMs);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it("does not fire before the interval elapses", () => {
    const tick = vi.fn();
    startAutoSync(30 * 60_000, tick);

    vi.advanceTimersByTime(29 * 60_000);
    expect(tick).not.toHaveBeenCalled();
  });

  it("stopAutoSync prevents further ticks", () => {
    const tick = vi.fn();
    startAutoSync(60_000, tick);

    stopAutoSync();
    vi.advanceTimersByTime(10 * 60_000);

    expect(tick).not.toHaveBeenCalled();
  });

  it("restarting replaces the previous timer instead of stacking", () => {
    const tickA = vi.fn();
    const tickB = vi.fn();

    startAutoSync(60_000, tickA);
    startAutoSync(60_000, tickB);
    vi.advanceTimersByTime(5 * 60_000);

    expect(tickA).not.toHaveBeenCalled();
    expect(tickB).toHaveBeenCalledTimes(5);
  });

  it("stopAutoSync is safe to call when nothing is running", () => {
    expect(() => stopAutoSync()).not.toThrow();
    expect(isAutoSyncRunning()).toBe(false);
  });

  it("isAutoSyncRunning reflects timer state", () => {
    expect(isAutoSyncRunning()).toBe(false);

    startAutoSync(60_000, () => {});
    expect(isAutoSyncRunning()).toBe(true);

    stopAutoSync();
    expect(isAutoSyncRunning()).toBe(false);
  });
});
