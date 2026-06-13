/**
 * Progress persistence layer using Tauri filesystem plugin.
 *
 * Stores reading progress as JSON files in the app's local data directory.
 * Each entry gets its own progress file in entries/{id}/progress.json.
 */

import {
  readTextFile,
  writeTextFile,
  exists,
  remove,
} from "@tauri-apps/plugin-fs";
import { getProgressPath } from "@/lib/bookshelf/persistence";
import type { ProgressData } from "./types";

/**
 * Save reading progress to a JSON file.
 */
export async function saveProgressToFile(
  progress: ProgressData
): Promise<void> {
  const filePath = await getProgressPath(progress.bookId);
  const json = JSON.stringify(progress, null, 2);
  await writeTextFile(filePath, json);
}

/**
 * Load reading progress from a JSON file.
 */
export async function loadProgressFromFile(
  entryId: string
): Promise<ProgressData | null> {
  const filePath = await getProgressPath(entryId);
  const fileExists = await exists(filePath);

  if (!fileExists) {
    return null;
  }

  const json = await readTextFile(filePath);
  try {
    const data = JSON.parse(json) as ProgressData;
    return data;
  } catch {
    return null;
  }
}

/**
 * Delete an entry's progress file.
 */
export async function deleteProgressFile(entryId: string): Promise<void> {
  const filePath = await getProgressPath(entryId);
  const fileExists = await exists(filePath);
  if (fileExists) {
    await remove(filePath);
  }
}
