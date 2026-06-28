/**
 * File reading utilities for EPUB import.
 *
 * Handles reading files from disk with appropriate error handling
 * for missing files, permission issues, and other I/O failures.
 * Supports both absolute paths and relative paths (resolved against dataDir).
 */

import { readFile } from "@tauri-apps/plugin-fs";
import { readConfig } from "@/lib/storage/config";
import { EpubImportError, ImportErrorCode } from "./errors";

/**
 * Check if a path is absolute (Windows drive letter or Unix root).
 */
function isAbsolutePath(path: string): boolean {
  return /^[A-Za-z]:\\/.test(path) || path.startsWith("/");
}

/**
 * Resolve a file path against the configured data directory.
 * Absolute paths are returned as-is; relative paths are prefixed with dataDir.
 */
async function resolvePath(path: string): Promise<string> {
  if (isAbsolutePath(path)) {
    return path;
  }

  const config = await readConfig();
  if (!config?.dataDir) {
    throw new EpubImportError(
      ImportErrorCode.FileReadError,
      "Data directory not configured — cannot resolve relative path"
    );
  }

  return `${config.dataDir}/${path}`;
}

/**
 * Read a file from disk and return it as an ArrayBuffer.
 *
 * @param path - Absolute or relative path to the file.
 *              Relative paths are resolved against the configured dataDir.
 * @returns The file contents as an ArrayBuffer.
 * @throws {EpubImportError} If the file cannot be read.
 */
export async function readFileAsArrayBuffer(path: string): Promise<ArrayBuffer> {
  const resolvedPath = await resolvePath(path);
  let bytes: Uint8Array;

  try {
    bytes = await readFile(resolvedPath);
  } catch (err) {
    // Provide more specific error messages based on the error
    const errMsg = err instanceof Error ? err.message : String(err);

    if (errMsg.includes("not found") || errMsg.includes("No such file")) {
      throw new EpubImportError(
        ImportErrorCode.FileReadError,
        `File not found: ${resolvedPath}`,
        err
      );
    }

    if (errMsg.includes("permission") || errMsg.includes("Permission denied")) {
      throw new EpubImportError(
        ImportErrorCode.FileReadError,
        `Permission denied: ${resolvedPath}`,
        err
      );
    }

    throw new EpubImportError(
      ImportErrorCode.FileReadError,
      `Failed to read file: ${resolvedPath}`,
      err
    );
  }

  return bytes.buffer;
}
