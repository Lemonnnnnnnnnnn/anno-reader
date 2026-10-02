/**
 * Update check against GitHub Releases.
 *
 * Strategy (manual-update flow): fetch the latest published release,
 * compare its tag against the running version, and let the UI open the
 * release page for a manual download. Requests go through proxyFetch so
 * the user's proxy config applies (api.github.com is often unreachable
 * without one).
 */

import { proxyFetch } from "@/lib/proxy/fetch";

export const REPO_OWNER = "Lemonnnnnnnnnnn";
export const REPO_NAME = "anno-reader";
export const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;
export const LATEST_RELEASE_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

/** Minimum interval between silent (startup) checks. */
export const SILENT_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const LAST_CHECK_KEY = "update.lastCheckAt";

export interface LatestRelease {
  /** Version from the release tag, without the leading "v". */
  version: string;
  /** GitHub release page the user can download installers from. */
  releaseUrl: string;
}

/** Strip the leading "v"/"V" from a release tag ("v0.4.6" → "0.4.6"). */
export function normalizeTag(tag: string): string {
  return tag.replace(/^[vV]/, "");
}

interface ParsedVersion {
  core: number[];
  /** Dot-separated pre-release identifiers, or null for a release. */
  pre: string[] | null;
}

function parseVersion(v: string): ParsedVersion | null {
  const m = /^v?(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.-]+))?$/.exec(v.trim());
  if (!m) return null;
  return {
    core: m[1].split(".").map(Number),
    pre: m[2] ? m[2].split(".") : null,
  };
}

/**
 * True when `latest` is strictly newer than `current` (semver-ish,
 * following semver pre-release precedence: 1.0.0-beta.1 < 1.0.0).
 * Unparseable inputs never count as newer.
 */
export function isNewerVersion(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;

  const len = Math.max(a.core.length, b.core.length);
  for (let i = 0; i < len; i++) {
    const x = a.core[i] ?? 0;
    const y = b.core[i] ?? 0;
    if (x !== y) return x > y;
  }

  if (!a.pre && !b.pre) return false;
  if (!a.pre) return true; // release beats prerelease on the same core
  if (!b.pre) return false;

  const n = Math.max(a.pre.length, b.pre.length);
  for (let i = 0; i < n; i++) {
    const x = a.pre[i];
    const y = b.pre[i];
    if (x === undefined) return false; // smaller identifier set is older
    if (y === undefined) return true;
    const xNum = /^\d+$/.test(x);
    const yNum = /^\d+$/.test(y);
    if (xNum && yNum) {
      const d = Number(x) - Number(y);
      if (d !== 0) return d > 0;
    } else if (xNum !== yNum) {
      return yNum; // numeric identifiers have lower precedence
    } else if (x !== y) {
      return x > y;
    }
  }
  return false;
}

/** Fetch the latest published release (drafts and prereleases excluded by GitHub). */
export async function fetchLatestRelease(): Promise<LatestRelease> {
  const res = await proxyFetch(LATEST_RELEASE_API_URL, {
    headers: { Accept: "application/vnd.github+json" },
  });

  if (!res.ok) {
    throw new Error(`GitHub API 请求失败 (${res.status})`);
  }

  const data = await res.json();
  if (!data || typeof data.tag_name !== "string") {
    throw new Error("GitHub 返回了无法解析的版本信息");
  }

  return {
    version: normalizeTag(data.tag_name),
    releaseUrl: typeof data.html_url === "string" ? data.html_url : REPO_URL,
  };
}

/** True when enough time has passed since the last successful check. */
export function shouldSilentCheck(now = Date.now()): boolean {
  try {
    const last = Number(localStorage.getItem(LAST_CHECK_KEY));
    return !Number.isFinite(last) || now - last >= SILENT_CHECK_INTERVAL_MS;
  } catch {
    return true;
  }
}

/** Record a successful check so silent checks stay throttled. */
export function markSilentCheckDone(now = Date.now()): void {
  try {
    localStorage.setItem(LAST_CHECK_KEY, String(now));
  } catch {
    // Non-fatal: without persistence silent checks just run every startup.
  }
}
