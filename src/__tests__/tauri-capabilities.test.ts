/**
 * Tests for the Tauri capability declarations.
 *
 * The fs plugin needs one granted permission per command. A command the app
 * uses but does not grant fails at runtime only, and the call sites swallow it
 * (e.g. book copying falls back to reading the original file), so a missing
 * grant silently degrades the app. These tests pin the grants that had to be
 * discovered the hard way.
 *
 * @vitest-environment node
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface ScopedPermission {
  identifier: string;
  allow?: { path: string }[];
}

type Permission = string | ScopedPermission;

const capabilitiesPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../src-tauri/capabilities/default.json",
);
const { permissions } = JSON.parse(readFileSync(capabilitiesPath, "utf8")) as {
  permissions: Permission[];
};

/** Find a capability entry that carries a path scope, by permission identifier. */
function scopedPermission(identifier: string): ScopedPermission | undefined {
  return permissions.find(
    (permission): permission is ScopedPermission =>
      typeof permission !== "string" && permission.identifier === identifier,
  );
}

describe("capabilities/default.json", () => {
  it("grants fs:allow-copy-file an unrestricted path scope", () => {
    // copyBookToDataDir() copies imported books from wherever the user picked
    // them into the (user-selected) data directory. Without this grant the copy
    // only rides on the appLocalData-scoped write permission set, which fails
    // for any data dir outside appLocalData — every import then silently
    // falls back to reading the original file.
    expect(scopedPermission("fs:allow-copy-file")?.allow).toEqual([{ path: "**" }]);
  });
});
