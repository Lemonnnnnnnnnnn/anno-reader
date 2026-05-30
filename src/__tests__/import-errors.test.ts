/**
 * Tests for the EPUB import error handling module.
 *
 * Verifies that error codes, user-friendly messages, and error
 * handling logic work correctly for various failure scenarios.
 *
 * @vitest-environment node
 */

import { describe, it, expect } from "vitest";
import {
  EpubImportError,
  ImportErrorCode,
  ERROR_MESSAGES,
} from "@/lib/import/errors";

describe("EpubImportError", () => {
  it("should create error with code and message", () => {
    const error = new EpubImportError(
      ImportErrorCode.ParseError,
      "Test error message"
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(EpubImportError);
    expect(error.code).toBe(ImportErrorCode.ParseError);
    expect(error.message).toBe("Test error message");
    expect(error.name).toBe("EpubImportError");
  });

  it("should preserve cause when provided", () => {
    const originalError = new Error("Original error");
    const error = new EpubImportError(
      ImportErrorCode.FileReadError,
      "Wrapped error",
      originalError
    );

    expect(error.cause).toBe(originalError);
  });

  it("should set userMessage from ERROR_MESSAGES", () => {
    const error = new EpubImportError(
      ImportErrorCode.ParseError,
      "Technical message"
    );

    expect(error.userMessage).toBe(ERROR_MESSAGES[ImportErrorCode.ParseError]);
  });

  it("should detect cancellation errors", () => {
    const cancelledError = new EpubImportError(
      ImportErrorCode.Cancelled,
      "User cancelled"
    );
    const otherError = new EpubImportError(
      ImportErrorCode.ParseError,
      "Parse failed"
    );

    expect(cancelledError.isCancellation).toBe(true);
    expect(otherError.isCancellation).toBe(false);
  });

  it("should create from unknown error via static method", () => {
    const originalError = new Error("Original error");
    const error = EpubImportError.fromError(originalError);

    expect(error.code).toBe(ImportErrorCode.ImportFailed);
    expect(error.message).toBe("Original error");
    expect(error.cause).toBe(originalError);
  });

  it("should create from non-Error value via static method", () => {
    const error = EpubImportError.fromError("string error");

    expect(error.code).toBe(ImportErrorCode.ImportFailed);
    expect(error.message).toBe("string error");
  });

  it("should use custom code in fromError", () => {
    const error = EpubImportError.fromError(
      new Error("test"),
      ImportErrorCode.ParseError
    );

    expect(error.code).toBe(ImportErrorCode.ParseError);
  });
});

describe("ImportErrorCode", () => {
  it("should have all required error codes", () => {
    expect(ImportErrorCode.Cancelled).toBe("CANCELLED");
    expect(ImportErrorCode.NoFileSelected).toBe("NO_FILE_SELECTED");
    expect(ImportErrorCode.InvalidFileType).toBe("INVALID_FILE_TYPE");
    expect(ImportErrorCode.FileReadError).toBe("FILE_READ_ERROR");
    expect(ImportErrorCode.ParseError).toBe("PARSE_ERROR");
    expect(ImportErrorCode.MissingMetadata).toBe("MISSING_METADATA");
    expect(ImportErrorCode.NoChapters).toBe("NO_CHAPTERS");
    expect(ImportErrorCode.ResourceError).toBe("RESOURCE_ERROR");
    expect(ImportErrorCode.FileTooLarge).toBe("FILE_TOO_LARGE");
    expect(ImportErrorCode.ImportFailed).toBe("IMPORT_FAILED");
  });
});

describe("ERROR_MESSAGES", () => {
  it("should have a message for every error code", () => {
    const codes = Object.values(ImportErrorCode);

    codes.forEach((code) => {
      expect(ERROR_MESSAGES[code]).toBeDefined();
      expect(ERROR_MESSAGES[code].length).toBeGreaterThan(0);
    });
  });

  it("should have user-friendly messages (no technical jargon)", () => {
    // Check that messages don't contain technical terms that would confuse users
    const technicalTerms = ["null", "undefined", "exception", "stack", "trace"];

    Object.values(ERROR_MESSAGES).forEach((message) => {
      technicalTerms.forEach((term) => {
        expect(message.toLowerCase()).not.toContain(term);
      });
    });
  });

  it("should have actionable messages where appropriate", () => {
    // Messages for recoverable errors should suggest actions
    const actionableCodes = [
      ImportErrorCode.InvalidFileType,
      ImportErrorCode.ParseError,
      ImportErrorCode.FileTooLarge,
    ];

    actionableCodes.forEach((code) => {
      const message = ERROR_MESSAGES[code];
      // Should contain words like "try", "please", or "select"
      const hasAction = /try|please|select/i.test(message);
      expect(hasAction).toBe(true);
    });
  });
});

describe("Error handling edge cases", () => {
  it("should handle circular error causes", () => {
    const error1 = new EpubImportError(
      ImportErrorCode.ParseError,
      "Error 1"
    );
    const error2 = new EpubImportError(
      ImportErrorCode.FileReadError,
      "Error 2",
      error1
    );

    // Should not throw when accessing properties
    expect(error2.cause).toBe(error1);
    expect((error2.cause as EpubImportError).code).toBe(ImportErrorCode.ParseError);
  });

  it("should handle very long error messages", () => {
    const longMessage = "A".repeat(10000);
    const error = new EpubImportError(
      ImportErrorCode.ImportFailed,
      longMessage
    );

    expect(error.message).toBe(longMessage);
    expect(error.userMessage).toBe(ERROR_MESSAGES[ImportErrorCode.ImportFailed]);
  });

  it("should handle special characters in error messages", () => {
    const specialMessage = 'File not found: C:\\Users\\test\\file.epub';
    const error = new EpubImportError(
      ImportErrorCode.FileReadError,
      specialMessage
    );

    expect(error.message).toBe(specialMessage);
  });

  it("should maintain prototype chain for instanceof checks", () => {
    const error = new EpubImportError(
      ImportErrorCode.ParseError,
      "Test"
    );

    expect(error instanceof Error).toBe(true);
    expect(error instanceof EpubImportError).toBe(true);
  });
});
