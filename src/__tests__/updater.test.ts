/**
 * Tests for update checking (src/lib/updater.ts + useUpdateStore).
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockProxyFetch = vi.fn();
vi.mock("@/lib/proxy/fetch", () => ({
  proxyFetch: (...args: unknown[]) => mockProxyFetch(...args),
}));

vi.mock("@/lib/version", () => ({
  getAppVersion: vi.fn().mockResolvedValue("0.4.6"),
}));

import {
  normalizeTag,
  isNewerVersion,
  fetchLatestRelease,
  shouldSilentCheck,
  markSilentCheckDone,
  SILENT_CHECK_INTERVAL_MS,
} from "@/lib/updater";
import { useUpdateStore } from "@/stores/useUpdateStore";

// ── normalizeTag ─────────────────────────────────────────────────────

describe("normalizeTag", () => {
  it("strips a lowercase v prefix", () => {
    expect(normalizeTag("v0.4.6")).toBe("0.4.6");
  });

  it("strips an uppercase V prefix", () => {
    expect(normalizeTag("V1.2.3")).toBe("1.2.3");
  });

  it("leaves a bare version untouched", () => {
    expect(normalizeTag("0.5.0")).toBe("0.5.0");
  });
});

// ── isNewerVersion ───────────────────────────────────────────────────

describe("isNewerVersion", () => {
  it.each([
    ["0.4.7", "0.4.6", true],
    ["0.5.0", "0.4.6", true],
    ["1.0.0", "0.99.99", true],
    ["0.4.10", "0.4.9", true],
    ["0.4.6", "0.4.6", false],
    ["0.4.5", "0.4.6", false],
    ["0.3.9", "0.4.6", false],
    // numeric comparison, not lexicographic ("10" > "9")
    ["0.4.9", "0.4.10", false],
    // missing segments padded with zero
    ["0.4", "0.4.0", false],
    ["0.4.1", "0.4", true],
    // pre-release ordering (semver: prerelease < release)
    ["0.5.0-beta.1", "0.4.6", true],
    ["0.5.0-beta.1", "0.5.0", false],
    ["0.5.0", "0.5.0-beta.1", true],
    ["0.5.0-beta.2", "0.5.0-beta.1", true],
    ["0.5.0-beta.10", "0.5.0-beta.9", true],
    ["0.5.0-beta.1", "0.5.0-alpha.2", true],
    ["0.5.0-rc.1", "0.5.0-beta.2", true],
    // invalid inputs never count as newer
    ["", "0.4.6", false],
    ["not-a-version", "0.4.6", false],
    ["0.4.6", "", false],
  ])("%s vs %s → %s", (latest, current, expected) => {
    expect(isNewerVersion(latest, current)).toBe(expected);
  });
});

// ── fetchLatestRelease ───────────────────────────────────────────────

describe("fetchLatestRelease", () => {
  it("parses tag_name and html_url from the GitHub API response", async () => {
    mockProxyFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          tag_name: "v0.5.0",
          html_url: "https://github.com/o/r/releases/tag/v0.5.0",
        }),
        { status: 200 },
      ),
    );

    const release = await fetchLatestRelease();
    expect(release).toEqual({
      version: "0.5.0",
      releaseUrl: "https://github.com/o/r/releases/tag/v0.5.0",
    });
    expect(mockProxyFetch).toHaveBeenCalledWith(
      expect.stringContaining("/releases/latest"),
      expect.objectContaining({ headers: { Accept: "application/vnd.github+json" } }),
    );
  });

  it("falls back to the repo URL when html_url is missing", async () => {
    mockProxyFetch.mockResolvedValue(
      new Response(JSON.stringify({ tag_name: "v1.0.0" }), { status: 200 }),
    );

    const release = await fetchLatestRelease();
    expect(release.releaseUrl).toBe("https://github.com/Lemonnnnnnnnnnn/anno-reader");
  });

  it("throws on non-OK responses", async () => {
    mockProxyFetch.mockResolvedValue(new Response("rate limited", { status: 403 }));
    await expect(fetchLatestRelease()).rejects.toThrow("GitHub API 请求失败 (403)");
  });

  it("throws when tag_name is missing", async () => {
    mockProxyFetch.mockResolvedValue(
      new Response(JSON.stringify({ foo: "bar" }), { status: 200 }),
    );
    await expect(fetchLatestRelease()).rejects.toThrow("无法解析");
  });
});

// ── silent check throttle ────────────────────────────────────────────

describe("silent check throttle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns true when no check has been recorded", () => {
    expect(shouldSilentCheck()).toBe(true);
  });

  it("returns false within the throttle window", () => {
    markSilentCheckDone();
    expect(shouldSilentCheck()).toBe(false);
  });

  it("returns true once the interval has elapsed", () => {
    markSilentCheckDone(Date.now() - SILENT_CHECK_INTERVAL_MS - 1000);
    expect(shouldSilentCheck()).toBe(true);
  });
});

// ── useUpdateStore ───────────────────────────────────────────────────

describe("useUpdateStore.checkUpdate", () => {
  const release = (version: string) =>
    new Response(
      JSON.stringify({
        tag_name: `v${version}`,
        html_url: `https://github.com/o/r/releases/tag/v${version}`,
      }),
      { status: 200 },
    );

  beforeEach(() => {
    localStorage.clear();
    mockProxyFetch.mockReset();
    useUpdateStore.setState({
      status: "idle",
      latestVersion: null,
      releaseUrl: null,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sets available with release info when a newer version exists", async () => {
    mockProxyFetch.mockResolvedValue(release("0.5.0"));

    await useUpdateStore.getState().checkUpdate();

    const state = useUpdateStore.getState();
    expect(state.status).toBe("available");
    expect(state.latestVersion).toBe("0.5.0");
    expect(state.releaseUrl).toBe("https://github.com/o/r/releases/tag/v0.5.0");
    expect(localStorage.getItem("update.lastCheckAt")).not.toBeNull();
  });

  it("sets up-to-date when the latest release matches the current version", async () => {
    mockProxyFetch.mockResolvedValue(release("0.4.6"));

    await useUpdateStore.getState().checkUpdate();

    const state = useUpdateStore.getState();
    expect(state.status).toBe("up-to-date");
    expect(state.releaseUrl).toBeNull();
  });

  it("surfaces errors on a manual check", async () => {
    mockProxyFetch.mockResolvedValue(new Response("nope", { status: 500 }));

    await useUpdateStore.getState().checkUpdate();

    const state = useUpdateStore.getState();
    expect(state.status).toBe("error");
    expect(state.error).toContain("500");
  });

  it("skips a silent check within the throttle window", async () => {
    markSilentCheckDone();

    await useUpdateStore.getState().checkUpdate({ silent: true });

    expect(mockProxyFetch).not.toHaveBeenCalled();
    expect(useUpdateStore.getState().status).toBe("idle");
  });

  it("runs a silent check after the throttle window and records it", async () => {
    mockProxyFetch.mockResolvedValue(release("0.5.0"));
    markSilentCheckDone(Date.now() - SILENT_CHECK_INTERVAL_MS - 1000);

    await useUpdateStore.getState().checkUpdate({ silent: true });

    const state = useUpdateStore.getState();
    expect(state.status).toBe("available");
    expect(localStorage.getItem("update.lastCheckAt")).not.toBeNull();
  });

  it("keeps the idle status (no error) when a silent check fails", async () => {
    mockProxyFetch.mockResolvedValue(new Response("offline", { status: 500 }));

    await useUpdateStore.getState().checkUpdate({ silent: true });

    const state = useUpdateStore.getState();
    expect(state.status).toBe("idle");
    expect(state.error).toBeNull();
  });

  it("keeps an existing available badge when a silent refresh fails", async () => {
    mockProxyFetch.mockResolvedValue(release("0.5.0"));
    await useUpdateStore.getState().checkUpdate();
    expect(useUpdateStore.getState().status).toBe("available");

    markSilentCheckDone(Date.now() - SILENT_CHECK_INTERVAL_MS - 1000);
    mockProxyFetch.mockResolvedValue(new Response("offline", { status: 500 }));
    await useUpdateStore.getState().checkUpdate({ silent: true });

    const state = useUpdateStore.getState();
    expect(state.status).toBe("available");
    expect(state.latestVersion).toBe("0.5.0");
  });

  it("ignores a manual check while another check is in flight", async () => {
    let resolveFetch: (r: Response) => void = () => {};
    mockProxyFetch.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const first = useUpdateStore.getState().checkUpdate();
    const second = useUpdateStore.getState().checkUpdate();
    expect(useUpdateStore.getState().status).toBe("checking");

    resolveFetch(release("0.5.0"));
    await Promise.all([first, second]);

    expect(useUpdateStore.getState().status).toBe("available");
    expect(mockProxyFetch).toHaveBeenCalledTimes(1);
  });
});
