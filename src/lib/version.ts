/**
 * App version helpers.
 *
 * The version is resolved from the Tauri runtime (falls back to the
 * package.json version when the Tauri IPC is unavailable, e.g. in tests
 * or plain-browser dev mode).
 */

import { getVersion } from "@tauri-apps/api/app";
import { version as pkgVersion } from "../../package.json";

let cached: string | null = null;

export async function getAppVersion(): Promise<string> {
  if (cached) return cached;
  try {
    cached = (await getVersion()) || pkgVersion;
  } catch {
    cached = pkgVersion;
  }
  return cached;
}
