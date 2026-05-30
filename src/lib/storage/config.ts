/**
 * Configuration persistence for user-selected data directory.
 *
 * Stores app config as JSON in the app's local data directory.
 */

import {
  readTextFile,
  writeTextFile,
  exists,
  mkdir,
} from "@tauri-apps/plugin-fs";
import { appLocalDataDir } from "@tauri-apps/api/path";

/** App configuration — user-selected data directory and UI preferences. */
export interface AppConfig {
  dataDir: string;
  showTocSidebar: boolean;
  showNotesSidebar: boolean;
}

/** Default configuration — used to fill missing fields for backward compatibility. */
export const DEFAULT_CONFIG: AppConfig = {
  dataDir: "",
  showTocSidebar: true,
  showNotesSidebar: true,
};

/** Configuration filename within appLocalDataDir */
const CONFIG_FILE = "config.json";

/**
 * Read the app config from disk.
 *
 * @returns The persisted config, or null if no config file exists.
 * @throws If the file exists but cannot be read or parsed.
 */
export async function readConfig(): Promise<AppConfig | null> {
  const baseDir = await appLocalDataDir();
  const configPath = `${baseDir}/${CONFIG_FILE}`;

  const fileExists = await exists(configPath);
  if (!fileExists) {
    return null;
  }

  const json = await readTextFile(configPath);
  try {
    const parsed = JSON.parse(json) as Partial<AppConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return null;
  }
}

/**
 * Write the app config to disk.
 *
 * @param config - The config to persist.
 */
export async function writeConfig(config: AppConfig): Promise<void> {
  const baseDir = await appLocalDataDir();
  const configPath = `${baseDir}/${CONFIG_FILE}`;
  const json = JSON.stringify(config, null, 2);
  await writeTextFile(configPath, json);
}

/**
 * Check if a data directory exists and is accessible.
 *
 * @param dataDir - The directory path to validate.
 * @returns True if the directory exists.
 */
export async function isDataDirValid(dataDir: string): Promise<boolean> {
  return exists(dataDir);
}

/**
 * Create required subdirectories within the data directory.
 *
 * Creates: progress/, notes/, highlights/
 *
 * @param dataDir - The root data directory.
 */
export async function ensureDataSubdirs(dataDir: string): Promise<void> {
  const subdirs = ["progress", "notes", "highlights"];

  for (const subdir of subdirs) {
    const dirPath = `${dataDir}/${subdir}`;
    const dirExists = await exists(dirPath);
    if (!dirExists) {
      await mkdir(dirPath, { recursive: true });
    }
  }
}
