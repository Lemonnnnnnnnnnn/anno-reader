/**
 * Chapter summaries persistence layer using Tauri filesystem plugin.
 *
 * Stores summaries as a JSON file in the app's local data directory.
 * Each entry gets its own summaries file in entries/{id}/annotations/summaries.json.
 */

import {
  readTextFile,
  writeTextFile,
  exists,
  remove,
} from "@tauri-apps/plugin-fs";
import { getAnnotationsDir } from "@/lib/bookshelf/persistence";
import type { SummaryData } from "./types";

/**
 * Get the file path for an entry's summaries file.
 */
async function getSummariesFilePath(entryId: string): Promise<string> {
  const dir = await getAnnotationsDir(entryId);
  return `${dir}/summaries.json`;
}

/**
 * Save all summaries for an entry to a JSON file.
 */
export async function saveSummariesToFile(
  entryId: string,
  summaries: SummaryData[],
): Promise<void> {
  const filePath = await getSummariesFilePath(entryId);
  const json = JSON.stringify(summaries, null, 2);
  await writeTextFile(filePath, json);
}

/**
 * Load all summaries for an entry from a JSON file.
 */
export async function loadSummariesFromFile(
  entryId: string,
): Promise<SummaryData[]> {
  const filePath = await getSummariesFilePath(entryId);
  const fileExists = await exists(filePath);

  if (!fileExists) {
    return [];
  }

  const json = await readTextFile(filePath);
  try {
    const data = JSON.parse(json) as SummaryData[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Delete an entry's summaries file.
 */
export async function deleteSummariesFile(entryId: string): Promise<void> {
  const filePath = await getSummariesFilePath(entryId);
  const fileExists = await exists(filePath);
  if (fileExists) {
    await remove(filePath);
  }
}
