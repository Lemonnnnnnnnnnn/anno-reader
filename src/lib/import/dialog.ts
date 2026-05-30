/**
 * File dialog utilities for EPUB import.
 *
 * Handles opening native file dialogs with EPUB file filtering
 * and appropriate error handling for cancelled dialogs.
 */

import { open } from "@tauri-apps/plugin-dialog";
import { EpubImportError, ImportErrorCode } from "./errors";

/**
 * Open a native file dialog filtered to EPUB files.
 *
 * @returns The absolute path of the selected file.
 * @throws {EpubImportError} If the dialog is cancelled or no file is selected.
 */
export async function openFileDialog(): Promise<string> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [
      {
        name: "EPUB",
        extensions: ["epub"],
      },
    ],
  });

  if (selected === null) {
    throw new EpubImportError(
      ImportErrorCode.Cancelled,
      "File selection was cancelled"
    );
  }

  if (typeof selected !== "string" || selected.length === 0) {
    throw new EpubImportError(
      ImportErrorCode.NoFileSelected,
      "No file was selected"
    );
  }

  return selected;
}
