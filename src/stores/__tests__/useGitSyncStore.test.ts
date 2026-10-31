import { describe, it, expect, beforeEach, vi } from "vitest";
import { useGitSyncStore } from "@/stores/useGitSyncStore";
import type { GitStatus, SyncResult } from "@/lib/git";

// ---------------------------------------------------------------------------
// Mocks for storage config and git IPC
// ---------------------------------------------------------------------------

vi.mock("@/lib/storage/config", () => ({
  readConfig: vi.fn(),
  writeConfig: vi.fn(),
}));

vi.mock("@/lib/git", () => ({
  getGitStatus: vi.fn(),
  syncGit: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockReadConfig = (await import("@/lib/storage/config")).readConfig as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockWriteConfig = (await import("@/lib/storage/config")).writeConfig as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetGitStatus = (await import("@/lib/git")).getGitStatus as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSyncGit = (await import("@/lib/git")).syncGit as any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStatus(overrides: Partial<GitStatus> = {}): GitStatus {
  return {
    is_repo: true,
    remote: "git@github.com:user/data.git",
    remote_protocol: "ssh",
    branch: "master",
    ahead: 0,
    behind: 0,
    has_changes: false,
    ...overrides,
  };
}

const OK_RESULT: SyncResult = {
  success: true,
  message: "Synced successfully: Sync at {datetime}",
  conflicts: [],
};

function resetStore() {
  useGitSyncStore.setState({
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
  });
}

/** Point the store at a data dir as if loadConfig had run. */
function primeStore(dataDir = "/test/data") {
  useGitSyncStore.setState({ dataDir, isLoaded: true });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useGitSyncStore", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  // -- Default state -------------------------------------------------------

  describe("default state", () => {
    it("has auto sync disabled by default", () => {
      expect(useGitSyncStore.getState().autoSyncEnabled).toBe(false);
    });

    it("defaults to a 30 minute interval", () => {
      expect(useGitSyncStore.getState().intervalMinutes).toBe(30);
    });

    it("is not loaded and idle initially", () => {
      const state = useGitSyncStore.getState();
      expect(state.isLoaded).toBe(false);
      expect(state.isSyncing).toBe(false);
      expect(state.lastSyncAt).toBeNull();
      expect(state.lastAutoSyncAt).toBeNull();
    });
  });

  // -- loadConfig ----------------------------------------------------------

  describe("loadConfig", () => {
    it("loads git sync settings from disk", async () => {
      mockReadConfig.mockResolvedValue({
        dataDir: "/test/data",
        gitSync: { autoSyncEnabled: true, intervalMinutes: 15 },
      });

      await useGitSyncStore.getState().loadConfig();

      const state = useGitSyncStore.getState();
      expect(state.isLoaded).toBe(true);
      expect(state.dataDir).toBe("/test/data");
      expect(state.autoSyncEnabled).toBe(true);
      expect(state.intervalMinutes).toBe(15);
    });

    it("uses defaults when config file does not exist", async () => {
      mockReadConfig.mockResolvedValue(null);

      await useGitSyncStore.getState().loadConfig();

      const state = useGitSyncStore.getState();
      expect(state.isLoaded).toBe(true);
      expect(state.autoSyncEnabled).toBe(false);
      expect(state.intervalMinutes).toBe(30);
    });

    it("sets isLoaded even on error", async () => {
      mockReadConfig.mockRejectedValue(new Error("disk error"));

      await useGitSyncStore.getState().loadConfig();

      expect(useGitSyncStore.getState().isLoaded).toBe(true);
    });

    it("falls back to defaults for a partial gitSync section", async () => {
      // readConfig sanitizes in production; the store must tolerate a partial
      // object regardless.
      mockReadConfig.mockResolvedValue({
        dataDir: "/test/data",
        gitSync: { intervalMinutes: 60 },
      });

      await useGitSyncStore.getState().loadConfig();

      const state = useGitSyncStore.getState();
      expect(state.autoSyncEnabled).toBe(false);
      expect(state.intervalMinutes).toBe(60);
    });
  });

  // -- setAutoSyncEnabled / setIntervalMinutes ------------------------------

  describe("setAutoSyncEnabled", () => {
    it("persists gitSync while preserving other config fields", async () => {
      primeStore();
      mockReadConfig.mockResolvedValue({
        dataDir: "/test/data",
        proxy: { enabled: true, address: "127.0.0.1", port: "7890" },
        gitSync: { autoSyncEnabled: false, intervalMinutes: 30 },
      });

      useGitSyncStore.getState().setAutoSyncEnabled(true);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockWriteConfig).toHaveBeenCalledWith({
        dataDir: "/test/data",
        proxy: { enabled: true, address: "127.0.0.1", port: "7890" },
        gitSync: { autoSyncEnabled: true, intervalMinutes: 30 },
      });
    });

    it("does not throw when persist fails", async () => {
      primeStore();
      mockReadConfig.mockRejectedValue(new Error("read error"));

      expect(() =>
        useGitSyncStore.getState().setAutoSyncEnabled(true),
      ).not.toThrow();
      expect(useGitSyncStore.getState().autoSyncEnabled).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  describe("setIntervalMinutes", () => {
    it("persists the interval", async () => {
      primeStore();
      useGitSyncStore.setState({ autoSyncEnabled: true });
      mockReadConfig.mockResolvedValue({
        dataDir: "/test/data",
        proxy: { enabled: false, address: "", port: "" },
        gitSync: { autoSyncEnabled: true, intervalMinutes: 30 },
      });

      useGitSyncStore.getState().setIntervalMinutes(10);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockWriteConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          gitSync: { autoSyncEnabled: true, intervalMinutes: 10 },
        }),
      );
    });
  });

  // -- runSync (auto) -------------------------------------------------------

  describe("runSync auto pre-checks", () => {
    beforeEach(() => primeStore());

    it("skips when there is no data dir", async () => {
      useGitSyncStore.setState({ dataDir: "" });

      const result = await useGitSyncStore.getState().runSync("auto");

      expect(result).toBeNull();
      expect(mockGetGitStatus).not.toHaveBeenCalled();
      expect(mockSyncGit).not.toHaveBeenCalled();
    });

    it("skips when directory is not a git repo", async () => {
      mockGetGitStatus.mockResolvedValue(makeStatus({ is_repo: false }));

      const result = await useGitSyncStore.getState().runSync("auto");

      expect(result).toBeNull();
      expect(mockSyncGit).not.toHaveBeenCalled();
    });

    it("skips when there is no remote", async () => {
      mockGetGitStatus.mockResolvedValue(
        makeStatus({ remote: null, remote_protocol: null, has_changes: true }),
      );

      const result = await useGitSyncStore.getState().runSync("auto");

      expect(result).toBeNull();
      expect(mockSyncGit).not.toHaveBeenCalled();
    });

    it("skips when there is nothing to do (clean, in sync)", async () => {
      mockGetGitStatus.mockResolvedValue(makeStatus());

      const result = await useGitSyncStore.getState().runSync("auto");

      expect(result).toBeNull();
      expect(mockSyncGit).not.toHaveBeenCalled();
      expect(useGitSyncStore.getState().isSyncing).toBe(false);
    });

    it("runs when there are local changes", async () => {
      mockGetGitStatus.mockResolvedValue(makeStatus({ has_changes: true }));
      mockSyncGit.mockResolvedValue(OK_RESULT);

      const result = await useGitSyncStore.getState().runSync("auto");

      expect(mockSyncGit).toHaveBeenCalledWith(
        "/test/data",
        "Sync at {datetime}",
      );
      expect(result).toEqual(OK_RESULT);
      expect(useGitSyncStore.getState().isSyncing).toBe(false);
    });

    it("runs when local commits are unpushed (ahead)", async () => {
      mockGetGitStatus.mockResolvedValue(makeStatus({ ahead: 2 }));
      mockSyncGit.mockResolvedValue(OK_RESULT);

      await useGitSyncStore.getState().runSync("auto");

      expect(mockSyncGit).toHaveBeenCalledTimes(1);
    });

    it("runs when remote has new commits (behind)", async () => {
      mockGetGitStatus.mockResolvedValue(makeStatus({ behind: 3 }));
      mockSyncGit.mockResolvedValue(OK_RESULT);

      await useGitSyncStore.getState().runSync("auto");

      expect(mockSyncGit).toHaveBeenCalledTimes(1);
    });
  });

  // -- runSync (manual) -----------------------------------------------------

  describe("runSync manual", () => {
    beforeEach(() => primeStore());

    it("runs even when the repo is clean and in sync", async () => {
      mockGetGitStatus.mockResolvedValue(makeStatus());
      mockSyncGit.mockResolvedValue(OK_RESULT);

      const result = await useGitSyncStore.getState().runSync("manual");

      // Manual sync skips the pre-check entirely — getGitStatus untouched.
      expect(mockGetGitStatus).not.toHaveBeenCalled();
      expect(mockSyncGit).toHaveBeenCalledTimes(1);
      expect(result).toEqual(OK_RESULT);
    });
  });

  // -- runSync result recording ---------------------------------------------

  describe("runSync result recording", () => {
    beforeEach(() => primeStore());

    it("records a successful auto sync with trigger and timestamp", async () => {
      mockGetGitStatus.mockResolvedValue(makeStatus({ has_changes: true }));
      mockSyncGit.mockResolvedValue(OK_RESULT);
      const before = Date.now();

      await useGitSyncStore.getState().runSync("auto");

      const state = useGitSyncStore.getState();
      expect(state.lastSyncTrigger).toBe("auto");
      expect(state.lastSyncSuccess).toBe(true);
      expect(state.lastSyncMessage).toBe(OK_RESULT.message);
      expect(state.lastSyncConflicts).toEqual([]);
      expect(state.lastSyncAt).toBeGreaterThanOrEqual(before);
      expect(state.lastAutoSyncAt).toBe(state.lastSyncAt);
    });

    it("records a conflict failure from the backend", async () => {
      mockGetGitStatus.mockResolvedValue(makeStatus({ has_changes: true }));
      const conflictResult: SyncResult = {
        success: false,
        message: "Pull failed",
        conflicts: ["entries/book1/notes.json"],
      };
      mockSyncGit.mockResolvedValue(conflictResult);

      await useGitSyncStore.getState().runSync("auto");

      const state = useGitSyncStore.getState();
      expect(state.lastSyncSuccess).toBe(false);
      expect(state.lastSyncMessage).toBe("Pull failed");
      expect(state.lastSyncConflicts).toEqual(["entries/book1/notes.json"]);
    });

    it("records a thrown error as a failed sync and never rejects", async () => {
      mockGetGitStatus.mockResolvedValue(makeStatus({ has_changes: true }));
      mockSyncGit.mockRejectedValue("Failed to push: network down");

      const result = await useGitSyncStore.getState().runSync("auto");

      expect(result).toBeNull();
      const state = useGitSyncStore.getState();
      expect(state.lastSyncSuccess).toBe(false);
      expect(state.lastSyncMessage).toBe("Failed to push: network down");
      expect(state.isSyncing).toBe(false);
    });

    it("does not update lastAutoSyncAt on manual sync", async () => {
      mockSyncGit.mockResolvedValue(OK_RESULT);

      await useGitSyncStore.getState().runSync("manual");

      const state = useGitSyncStore.getState();
      expect(state.lastSyncTrigger).toBe("manual");
      expect(state.lastAutoSyncAt).toBeNull();
    });

    it("refuses a second run while a sync is in flight", async () => {
      mockGetGitStatus.mockResolvedValue(makeStatus({ has_changes: true }));
      let release!: (value: SyncResult) => void;
      mockSyncGit.mockReturnValue(
        new Promise<SyncResult>((resolve) => {
          release = resolve;
        }),
      );

      const first = useGitSyncStore.getState().runSync("auto");
      const second = await useGitSyncStore.getState().runSync("auto");

      expect(second).toBeNull();
      expect(mockSyncGit).toHaveBeenCalledTimes(1);

      release(OK_RESULT);
      await first;
      expect(useGitSyncStore.getState().isSyncing).toBe(false);
    });
  });
});
