/**
 * Notes persistence layer using Tauri filesystem plugin.
 *
 * Stores notes as JSON files in the app's local data directory.
 * Each entry gets its own notes file in entries/{id}/annotations/notes.json.
 */

import {
  readTextFile,
  writeTextFile,
  exists,
  remove,
} from "@tauri-apps/plugin-fs";
import { getAnnotationsDir } from "@/lib/bookshelf/persistence";
import type { NoteData, HighlightData } from "./types";

/**
 * Get the file path for an entry's notes file.
 */
async function getNotesFilePath(entryId: string): Promise<string> {
  const dir = await getAnnotationsDir(entryId);
  return `${dir}/notes.json`;
}

/**
 * Save all notes for an entry to a JSON file.
 */
export async function saveNotesToFile(
  entryId: string,
  notes: NoteData[]
): Promise<void> {
  const filePath = await getNotesFilePath(entryId);
  const json = JSON.stringify(notes, null, 2);
  await writeTextFile(filePath, json);
}

/**
 * Load all notes for an entry from a JSON file.
 */
export async function loadNotesFromFile(
  entryId: string
): Promise<NoteData[]> {
  const filePath = await getNotesFilePath(entryId);
  const fileExists = await exists(filePath);

  if (!fileExists) {
    return [];
  }

  const json = await readTextFile(filePath);
  try {
    const data = JSON.parse(json) as NoteData[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Delete an entry's notes file.
 */
export async function deleteNotesFile(entryId: string): Promise<void> {
  const filePath = await getNotesFilePath(entryId);
  const fileExists = await exists(filePath);
  if (fileExists) {
    await remove(filePath);
  }
}

/**
 * Get the file path for an entry's highlights file.
 */
async function getHighlightsFilePath(entryId: string): Promise<string> {
  const dir = await getAnnotationsDir(entryId);
  return `${dir}/highlights.json`;
}

/**
 * Save all highlights for an entry to a JSON file.
 */
export async function saveHighlightsToFile(
  entryId: string,
  highlights: HighlightData[]
): Promise<void> {
  const filePath = await getHighlightsFilePath(entryId);
  const json = JSON.stringify(highlights, null, 2);
  await writeTextFile(filePath, json);
}

/**
 * Load all highlights for an entry from a JSON file.
 */
export async function loadHighlightsFromFile(
  entryId: string
): Promise<HighlightData[]> {
  const filePath = await getHighlightsFilePath(entryId);
  const fileExists = await exists(filePath);

  if (!fileExists) {
    return [];
  }

  const json = await readTextFile(filePath);
  try {
    const data = JSON.parse(json) as HighlightData[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Delete an entry's highlights file.
 */
export async function deleteHighlightsFile(entryId: string): Promise<void> {
  const filePath = await getHighlightsFilePath(entryId);
  const fileExists = await exists(filePath);
  if (fileExists) {
    await remove(filePath);
  }
}
