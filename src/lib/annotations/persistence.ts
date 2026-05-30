/**
 * Notes persistence layer using Tauri filesystem plugin.
 *
 * Stores notes as JSON files in the app's local data directory.
 * Each book gets its own notes file named by book ID.
 */

import {
  readTextFile,
  writeTextFile,
  mkdir,
  exists,
  remove,
} from "@tauri-apps/plugin-fs";
import { readConfig } from "@/lib/storage/config";
import type { NoteData, HighlightData } from "./types";

/** Subdirectory within app data for notes files */
const NOTES_DIR = "notes";

/** Subdirectory within app data for highlights files */
const HIGHLIGHTS_DIR = "highlights";

/**
 * Get the full path to the notes directory.
 * Creates it if it doesn't exist.
 */
async function getNotesDir(): Promise<string> {
  const config = await readConfig();
  if (!config) {
    throw new Error("Data directory not configured");
  }

  const notesDir = `${config.dataDir}/${NOTES_DIR}`;

  const dirExists = await exists(notesDir);
  if (!dirExists) {
    await mkdir(notesDir, { recursive: true });
  }

  return notesDir;
}

/**
 * Get the file path for a book's notes file.
 */
async function getNotesFilePath(bookId: string): Promise<string> {
  const dir = await getNotesDir();
  return `${dir}/${bookId}.json`;
}

/**
 * Save all notes for a book to a JSON file.
 *
 * @param bookId - The book ID to save notes for.
 * @param notes - The notes array to persist.
 * @throws If the file cannot be written.
 */
export async function saveNotesToFile(
  bookId: string,
  notes: NoteData[]
): Promise<void> {
  const filePath = await getNotesFilePath(bookId);
  const json = JSON.stringify(notes, null, 2);
  await writeTextFile(filePath, json);
}

/**
 * Load all notes for a book from a JSON file.
 *
 * @param bookId - The book ID to load notes for.
 * @returns The persisted notes array, or empty array if no notes file exists.
 * @throws If the file exists but cannot be read or parsed.
 */
export async function loadNotesFromFile(
  bookId: string
): Promise<NoteData[]> {
  const filePath = await getNotesFilePath(bookId);

  const fileExists = await exists(filePath);
  if (!fileExists) {
    return [];
  }

  const json = await readTextFile(filePath);
  try {
    const data = JSON.parse(json) as NoteData[];
    return Array.isArray(data) ? data : [];
  } catch {
    // Corrupted file - treat as no notes
    return [];
  }
}

/**
 * Delete a book's notes file.
 *
 * @param bookId - The book ID to delete notes for.
 */
export async function deleteNotesFile(bookId: string): Promise<void> {
  const filePath = await getNotesFilePath(bookId);
  const fileExists = await exists(filePath);
  if (fileExists) {
    await remove(filePath);
  }
}

// --- Highlights persistence ---

/**
 * Get the full path to the highlights directory.
 * Creates it if it doesn't exist.
 */
async function getHighlightsDir(): Promise<string> {
  const config = await readConfig();
  if (!config) {
    throw new Error("Data directory not configured");
  }

  const highlightsDir = `${config.dataDir}/${HIGHLIGHTS_DIR}`;

  const dirExists = await exists(highlightsDir);
  if (!dirExists) {
    await mkdir(highlightsDir, { recursive: true });
  }

  return highlightsDir;
}

/**
 * Get the file path for a book's highlights file.
 */
async function getHighlightsFilePath(bookId: string): Promise<string> {
  const dir = await getHighlightsDir();
  return `${dir}/${bookId}.json`;
}

/**
 * Save all highlights for a book to a JSON file.
 *
 * @param bookId - The book ID to save highlights for.
 * @param highlights - The highlights array to persist.
 * @throws If the file cannot be written.
 */
export async function saveHighlightsToFile(
  bookId: string,
  highlights: HighlightData[]
): Promise<void> {
  const filePath = await getHighlightsFilePath(bookId);
  const json = JSON.stringify(highlights, null, 2);
  await writeTextFile(filePath, json);
}

/**
 * Load all highlights for a book from a JSON file.
 *
 * @param bookId - The book ID to load highlights for.
 * @returns The persisted highlights array, or empty array if no highlights file exists.
 * @throws If the file exists but cannot be read or parsed.
 */
export async function loadHighlightsFromFile(
  bookId: string
): Promise<HighlightData[]> {
  const filePath = await getHighlightsFilePath(bookId);

  const fileExists = await exists(filePath);
  if (!fileExists) {
    return [];
  }

  const json = await readTextFile(filePath);
  try {
    const data = JSON.parse(json) as HighlightData[];
    return Array.isArray(data) ? data : [];
  } catch {
    // Corrupted file - treat as no highlights
    return [];
  }
}

/**
 * Delete a book's highlights file.
 *
 * @param bookId - The book ID to delete highlights for.
 */
export async function deleteHighlightsFile(bookId: string): Promise<void> {
  const filePath = await getHighlightsFilePath(bookId);
  const fileExists = await exists(filePath);
  if (fileExists) {
    await remove(filePath);
  }
}
