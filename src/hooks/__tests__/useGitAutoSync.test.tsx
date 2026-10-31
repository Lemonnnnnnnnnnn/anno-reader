/**
 * Startup + periodic behavior of the auto-sync hook.
 *
 * The git layer is mocked; the hook runs against the REAL sync store and
 * the REAL runSync, so assertions observe actual sync attempts through
 * getGitStatus/syncGit. Fake timers make the interval deterministic.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGitSyncStore } from "@/stores/useGitSyncStore";
import { useGitAutoSync } from "../useGitAutoSync";
import { getGitStatus, syncGit } from "@/lib/git";
import { stopAutoSync } from "@/lib/git/autoSync";
import type { GitStatus, SyncResult } from "@/lib/git/types";

vi.mock("@/lib/git", () => ({
  getGitStatus: vi.fn(),
  syncGit: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: vi.fn() }));

const mockGetGitStatus = vi.mocked(getGitStatus);
const mockSyncGit = vi.mocked(syncGit);

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

function makeStatus(overrides: Partial<GitStatus> = {}): GitStatus {
  return {
    is_repo: true,
    remote: "git@github.com:user/data.git",
    remote_protocol: "ssh",
    branch: "main",
    ahead: 0,
    behind: 0,
    has_changes: true,
    ...overrides,
  };
}

const OK_RESULT: SyncResult = { success: true, message: "", conflicts: [] };

function primeStore(overrides: Record<string, unknown> = {}) {
  useGitSyncStore.setState({
    dataDir: "D:/data",
    autoSyncEnabled: true,
    intervalMinutes: 30,
    isLoaded: true,
    isSyncing: false,
    ...overrides,
  });
}

function Probe() {
  useGitAutoSync();
  return null;
}

const INTERVAL_MS = 30 * 60_000;

describe("useGitAutoSync", () => {
  let root: ReturnType<typeof createRoot>;
  const container = document.createElement("div");

  beforeEach(() => {
    vi.useFakeTimers();
    mockGetGitStatus.mockResolvedValue(makeStatus());
    mockSyncGit.mockResolvedValue(OK_RESULT);
  });

  afterEach(() => {
    act(() => root?.unmount());
    stopAutoSync();
    primeStore({ autoSyncEnabled: false, isLoaded: false, dataDir: "" });
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("syncs immediately at startup, then once per interval", async () => {
    primeStore();
    root = createRoot(container);
    await act(async () => {
      root.render(<Probe />);
    });

    // Startup sync fired without waiting for the first interval
    expect(mockGetGitStatus).toHaveBeenCalledTimes(1);
    expect(mockSyncGit).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(INTERVAL_MS);
    });
    expect(mockGetGitStatus).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(INTERVAL_MS);
    });
    expect(mockGetGitStatus).toHaveBeenCalledTimes(3);
  });

  it("does not sync when periodic backup is disabled", async () => {
    primeStore({ autoSyncEnabled: false });
    root = createRoot(container);
    await act(async () => {
      root.render(<Probe />);
    });

    await act(async () => {
      vi.advanceTimersByTime(INTERVAL_MS);
    });
    expect(mockGetGitStatus).not.toHaveBeenCalled();
  });

  it("enabling mid-session fires the startup sync once", async () => {
    primeStore({ autoSyncEnabled: false });
    root = createRoot(container);
    await act(async () => {
      root.render(<Probe />);
    });
    expect(mockGetGitStatus).not.toHaveBeenCalled();

    await act(async () => {
      useGitSyncStore.setState({ autoSyncEnabled: true });
    });
    expect(mockGetGitStatus).toHaveBeenCalledTimes(1);

    // Interval edits afterwards only restart the timer — no extra sync
    await act(async () => {
      useGitSyncStore.setState({ intervalMinutes: 10 });
    });
    expect(mockGetGitStatus).toHaveBeenCalledTimes(1);
  });

  it("changing the interval does not repeat the startup sync", async () => {
    primeStore();
    root = createRoot(container);
    await act(async () => {
      root.render(<Probe />);
    });
    expect(mockGetGitStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      useGitSyncStore.setState({ intervalMinutes: 10 });
    });
    expect(mockGetGitStatus).toHaveBeenCalledTimes(1);

    // Timer restarted with the new interval (10 min, not 30)
    await act(async () => {
      vi.advanceTimersByTime(10 * 60_000);
    });
    expect(mockGetGitStatus).toHaveBeenCalledTimes(2);
  });
});
