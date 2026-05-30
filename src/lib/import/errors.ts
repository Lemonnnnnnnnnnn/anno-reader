/**
 * Error types for the EPUB import module.
 *
 * Provides structured error handling with user-friendly messages
 * and programmatic error codes for different failure scenarios.
 */

/** Error codes for import failures */
export enum ImportErrorCode {
  /** User cancelled the file dialog */
  Cancelled = "CANCELLED",
  /** No file was selected */
  NoFileSelected = "NO_FILE_SELECTED",
  /** Selected file is not an EPUB */
  InvalidFileType = "INVALID_FILE_TYPE",
  /** File could not be read from disk */
  FileReadError = "FILE_READ_ERROR",
  /** EPUB parsing failed (corrupt or invalid structure) */
  ParseError = "PARSE_ERROR",
  /** EPUB is missing required metadata (title, author) */
  MissingMetadata = "MISSING_METADATA",
  /** EPUB has no readable chapters */
  NoChapters = "NO_CHAPTERS",
  /** EPUB contains missing or corrupt resources */
  ResourceError = "RESOURCE_ERROR",
  /** File is too large to process */
  FileTooLarge = "FILE_TOO_LARGE",
  /** Generic import failure */
  ImportFailed = "IMPORT_FAILED",
}

/**
 * User-friendly error messages for each error code.
 * These messages are safe to display directly to users.
 */
export const ERROR_MESSAGES: Record<ImportErrorCode, string> = {
  [ImportErrorCode.Cancelled]: "Import cancelled.",
  [ImportErrorCode.NoFileSelected]: "No file was selected. Please try again.",
  [ImportErrorCode.InvalidFileType]:
    "The selected file is not a valid EPUB. Please select an .epub file.",
  [ImportErrorCode.FileReadError]:
    "Could not read the file. It may be locked, missing, or you may not have permission to access it.",
  [ImportErrorCode.ParseError]:
    "This file appears to be corrupt or is not a valid EPUB. Please try a different file.",
  [ImportErrorCode.MissingMetadata]:
    "The EPUB file is missing required information (title or author). The file may be incomplete.",
  [ImportErrorCode.NoChapters]:
    "This EPUB contains no readable chapters. Please try a different file.",
  [ImportErrorCode.ResourceError]:
    "Some resources in this EPUB are missing or corrupt. The book may not display correctly.",
  [ImportErrorCode.FileTooLarge]:
    "The file is too large to process. Please try a smaller EPUB file.",
  [ImportErrorCode.ImportFailed]:
    "An unexpected error occurred while importing the file. Please try again.",
};

/**
 * Custom error class for EPUB import failures.
 * Provides structured error codes for programmatic handling
 * and user-friendly messages for display.
 */
export class EpubImportError extends Error {
  readonly code: ImportErrorCode;
  readonly cause?: unknown;
  readonly userMessage: string;

  constructor(code: ImportErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "EpubImportError";
    this.code = code;
    this.cause = cause;
    this.userMessage = ERROR_MESSAGES[code] || ERROR_MESSAGES[ImportErrorCode.ImportFailed];
  }

  /**
   * Create an EpubImportError from an unknown error.
   * Attempts to preserve the original error as the cause.
   */
  static fromError(err: unknown, code: ImportErrorCode = ImportErrorCode.ImportFailed): EpubImportError {
    const message = err instanceof Error ? err.message : String(err);
    return new EpubImportError(code, message, err);
  }

  /**
   * Check if this error is a user cancellation (not a real error).
   */
  get isCancellation(): boolean {
    return this.code === ImportErrorCode.Cancelled;
  }
}
