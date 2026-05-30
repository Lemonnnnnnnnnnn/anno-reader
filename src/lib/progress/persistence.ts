/**
 * Progress persistence layer using Tauri filesystem plugin.
 *
 * Stores reading progress as JSON files in the app's local data directory.
 * Each book gets its own progress file named by book ID.
 */

import {
  readTextFile,
  writeTextFile,
  mkdir,
  exists,
} from "@tauri-apps/plugin-fs";
import { readConfig } from "@/lib/storage/config";
import type { ProgressData } from "./types";

/** Subdirectory within app data for progress files */
const PROGRESS_DIR = "progress";

/**
 * Get the full path to the progress directory.
 * Creates it if it doesn't exist.
 */
async function getProgressDir(): Promise<string> {
  const config = await readConfig();
  if (!config) {
    throw new Error("Data directory not configured");
  }
  const progressDir = `${config.dataDir}/${PROGRESS_DIR}`;

  const dirExists = await exists(progressDir);
  if (!dirExists) {
    await mkdir(progressDir, { recursive: true });
  }

  return progressDir;
}

/**
 * Get the file path for a book's progress file.
 */
async function getProgressFilePath(bookId: string): Promise<string> {
  const dir = await getProgressDir();
  return `${dir}/${bookId}.json`;
}

/**
 * Save reading progress to a JSON file.
 *
 * @param progress - The progress data to persist.
 * @throws If the file cannot be written.
 */
export async function saveProgressToFile(
  progress: ProgressData
): Promise<void> {
  const filePath = await getProgressFilePath(progress.bookId);
  const json = JSON.stringify(progress, null, 2);
  await writeTextFile(filePath, json);
}

/**
 * Load reading progress from a JSON file.
 *
 * @param bookId - The book ID to load progress for.
 * @returns The persisted progress data, or null if no progress file exists.
 * @throws If the file exists but cannot be read or parsed.
 */
export async function loadProgressFromFile(
  bookId: string
): Promise<ProgressData | null> {
  const filePath = await getProgressFilePath(bookId);

  const fileExists = await exists(filePath);
  if (!fileExists) {
    return null;
  }

  const json = await readTextFile(filePath);
  try {
    const data = JSON.parse(json) as ProgressData;
    return data;
  } catch {
    // Corrupted file - treat as no progress
    return null;
  }
}

/**
 * Delete a book's progress file.
 *
 * @param bookId - The book ID to delete progress for.
 */
export async function deleteProgressFile(bookId: string): Promise<void> {
  const filePath = await getProgressFilePath(bookId);
  const fileExists = await exists(filePath);
  if (fileExists) {
    const { remove } = await import("@tauri-apps/plugin-fs");
    await remove(filePath);
  }
}
