/**
 * File reading utilities for EPUB import.
 *
 * Handles reading files from disk with appropriate error handling
 * for missing files, permission issues, and other I/O failures.
 */

import { readFile } from "@tauri-apps/plugin-fs";
import { EpubImportError, ImportErrorCode } from "./errors";

/**
 * Read a file from disk and return it as an ArrayBuffer.
 *
 * @param path - Absolute path to the file.
 * @returns The file contents as an ArrayBuffer.
 * @throws {EpubImportError} If the file cannot be read.
 */
export async function readFileAsArrayBuffer(path: string): Promise<ArrayBuffer> {
  let bytes: Uint8Array;

  try {
    bytes = await readFile(path);
  } catch (err) {
    // Provide more specific error messages based on the error
    const errMsg = err instanceof Error ? err.message : String(err);

    if (errMsg.includes("not found") || errMsg.includes("No such file")) {
      throw new EpubImportError(
        ImportErrorCode.FileReadError,
        `File not found: ${path}`,
        err
      );
    }

    if (errMsg.includes("permission") || errMsg.includes("Permission denied")) {
      throw new EpubImportError(
        ImportErrorCode.FileReadError,
        `Permission denied: ${path}`,
        err
      );
    }

    throw new EpubImportError(
      ImportErrorCode.FileReadError,
      `Failed to read file: ${path}`,
      err
    );
  }

  return bytes.buffer;
}
