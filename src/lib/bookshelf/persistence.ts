/**
 * Bookshelf persistence layer using Tauri filesystem plugin.
 *
 * Stores bookshelf index as bookshelf.json and each entry's data
 * in entries/{id}/ directory structure.
 */

import {
  readTextFile,
  writeTextFile,
  mkdir,
  exists,
  remove,
} from "@tauri-apps/plugin-fs";
import { readConfig } from "@/lib/storage/config";
import type { BookshelfEntry, BookshelfData } from "./types";

/** Filename for bookshelf index */
const BOOKSHELF_FILE = "bookshelf.json";

/** Subdirectory for entries */
const ENTRIES_DIR = "entries";

/**
 * Get the full path to the bookshelf file.
 */
async function getBookshelfPath(): Promise<string> {
  const config = await readConfig();
  if (!config) {
    throw new Error("Data directory not configured");
  }
  return `${config.dataDir}/${BOOKSHELF_FILE}`;
}

/**
 * Get the full path to the entries directory.
 */
async function getEntriesDir(): Promise<string> {
  const config = await readConfig();
  if (!config) {
    throw new Error("Data directory not configured");
  }
  return `${config.dataDir}/${ENTRIES_DIR}`;
}

/**
 * Get the full path to a specific entry's directory.
 */
async function getEntryDir(entryId: string): Promise<string> {
  const entriesDir = await getEntriesDir();
  return `${entriesDir}/${entryId}`;
}

/**
 * Ensure the entries directory exists.
 */
async function ensureEntriesDir(): Promise<void> {
  const entriesDir = await getEntriesDir();
  const dirExists = await exists(entriesDir);
  if (!dirExists) {
    await mkdir(entriesDir, { recursive: true });
  }
}

/**
 * Load all entries from the bookshelf file.
 */
export async function loadBookshelf(): Promise<BookshelfEntry[]> {
  try {
    const filePath = await getBookshelfPath();
    const fileExists = await exists(filePath);

    if (!fileExists) {
      return [];
    }

    const json = await readTextFile(filePath);
    const data = JSON.parse(json) as BookshelfData;

    return Array.isArray(data.entries) ? data.entries : [];
  } catch (err) {
    console.error("Failed to load bookshelf:", err);
    return [];
  }
}

/**
 * Save all entries to the bookshelf file.
 */
export async function saveBookshelf(entries: BookshelfEntry[]): Promise<void> {
  const config = await readConfig();
  if (!config) {
    throw new Error("Data directory not configured");
  }

  // Ensure data directory exists
  const dirExists = await exists(config.dataDir);
  if (!dirExists) {
    await mkdir(config.dataDir, { recursive: true });
  }

  const filePath = await getBookshelfPath();
  const data: BookshelfData = { entries };
  const json = JSON.stringify(data, null, 2);
  await writeTextFile(filePath, json);
}

/**
 * Add a single entry to the bookshelf.
 */
export async function addEntry(entry: BookshelfEntry): Promise<void> {
  await ensureEntriesDir();

  const entries = await loadBookshelf();
  const existingIndex = entries.findIndex((e) => e.id === entry.id);

  if (existingIndex >= 0) {
    entries[existingIndex] = entry;
  } else {
    entries.push(entry);
  }

  // Create entry directory
  const entryDir = await getEntryDir(entry.id);
  const dirExists = await exists(entryDir);
  if (!dirExists) {
    await mkdir(entryDir, { recursive: true });
  }

  // Save metadata
  const metadataPath = `${entryDir}/metadata.json`;
  await writeTextFile(metadataPath, JSON.stringify(entry, null, 2));

  // Save bookshelf index
  await saveBookshelf(entries);
}

/**
 * Remove a single entry from the bookshelf.
 */
export async function removeEntry(
  entryId: string,
  deleteData: boolean = false
): Promise<void> {
  const entries = await loadBookshelf();
  const filtered = entries.filter((e) => e.id !== entryId);

  if (deleteData) {
    const entryDir = await getEntryDir(entryId);
    const dirExists = await exists(entryDir);
    if (dirExists) {
      await remove(entryDir, { recursive: true });
    }
  }

  await saveBookshelf(filtered);
}

/**
 * Update an entry's metadata in the bookshelf.
 */
export async function updateEntry(
  entryId: string,
  updates: Partial<BookshelfEntry>
): Promise<void> {
  const entries = await loadBookshelf();
  const index = entries.findIndex((e) => e.id === entryId);

  if (index >= 0) {
    entries[index] = { ...entries[index], ...updates } as BookshelfEntry;
    await saveBookshelf(entries);

    // Update metadata file
    const entryDir = await getEntryDir(entryId);
    const dirExists = await exists(entryDir);
    if (dirExists) {
      const metadataPath = `${entryDir}/metadata.json`;
      await writeTextFile(
        metadataPath,
        JSON.stringify(entries[index], null, 2)
      );
    }
  }
}

/**
 * Get the path to an entry's annotations directory.
 * Creates it if it doesn't exist.
 */
export async function getAnnotationsDir(entryId: string): Promise<string> {
  const entryDir = await getEntryDir(entryId);
  const annotationsDir = `${entryDir}/annotations`;

  const dirExists = await exists(annotationsDir);
  if (!dirExists) {
    await mkdir(annotationsDir, { recursive: true });
  }

  return annotationsDir;
}

/**
 * Get the path to an entry's progress file.
 */
export async function getProgressPath(entryId: string): Promise<string> {
  const entryDir = await getEntryDir(entryId);
  return `${entryDir}/progress.json`;
}
