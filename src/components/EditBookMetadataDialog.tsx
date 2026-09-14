/**
 * EditBookMetadataDialog component.
 *
 * Modal form for editing a book's metadata: title, author, and cover image.
 * Cover is picked via the native file dialog and stored as a base64 data URL,
 * matching the format used during import.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { Modal, Button } from "@/components/primitives";
import { Book } from "lucide-react";
import {
  arrayBufferToDataUrl,
  guessMimeType,
} from "@/lib/images/convert";
import type { BookMetadata } from "@/stores/useBookStore";

interface EditBookMetadataDialogProps {
  /** Book being edited; null hides the dialog */
  book: BookMetadata | null;
  /** Called when the dialog should close without saving */
  onClose: () => void;
  /** Called with the edited fields when the user saves */
  onSave: (updates: Partial<BookMetadata>) => Promise<void>;
}

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp"];

export function EditBookMetadataDialog({
  book,
  onClose,
  onSave,
}: EditBookMetadataDialogProps) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Sync form state when a different book is opened
  useEffect(() => {
    if (book) {
      setTitle(book.title);
      setAuthor(book.author);
      setCoverUrl(book.coverUrl);
      setError(null);
      setSaving(false);
    }
  }, [book]);

  // Focus the title field when the dialog opens
  useEffect(() => {
    if (book) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [book]);

  const handlePickCover = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "Image", extensions: IMAGE_EXTENSIONS }],
      });
      if (!selected || typeof selected !== "string") return;

      const data = await readFile(selected);
      const buffer = data instanceof Uint8Array ? data.buffer : data;
      setCoverUrl(arrayBufferToDataUrl(buffer, guessMimeType(selected)));
      setError(null);
    } catch (err) {
      console.error("Failed to load cover image:", err);
      setError("Failed to load the selected image");
    }
  }, []);

  const handleRemoveCover = useCallback(() => {
    setCoverUrl(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!book || !title.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        author: author.trim(),
        coverUrl,
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save";
      setError(message);
      setSaving(false);
    }
  }, [book, title, author, coverUrl, saving, onSave, onClose]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave],
  );

  return (
    <Modal open={book !== null} onClose={onClose} title="Edit Metadata">
      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <div className="flex gap-4">
          {/* Cover preview + actions */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div className="w-[96px] h-[144px] rounded-md overflow-hidden bg-bg dark:bg-bg-dark border border-border dark:border-border-dark flex items-center justify-center">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={title || "Book cover"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Book size={32} className="text-text-muted dark:text-text-muted-dark" />
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="secondary" size="sm" type="button" onClick={handlePickCover}>
                Change
              </Button>
              {coverUrl && (
                <Button variant="secondary" size="sm" type="button" onClick={handleRemoveCover}>
                  Remove
                </Button>
              )}
            </div>
          </div>

          {/* Title / Author fields */}
          <div className="flex flex-col gap-3 flex-1 min-w-0">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-sans text-text-secondary dark:text-text-secondary-dark">
                Title
              </span>
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                required
                className="w-full text-sm font-sans text-text dark:text-text-dark bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md px-2.5 py-1.5 outline-none focus:border-accent dark:focus:border-accent-dark"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-sans text-text-secondary dark:text-text-secondary-dark">
                Author
              </span>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full text-sm font-sans text-text dark:text-text-dark bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md px-2.5 py-1.5 outline-none focus:border-accent dark:focus:border-accent-dark"
              />
            </label>
            {book?.filePath && (
              <p
                className="m-0 text-[0.7rem] font-sans text-text-muted dark:text-text-muted-dark truncate"
                title={book.filePath}
              >
                {book.filePath}
              </p>
            )}
          </div>
        </div>

        {error && (
          <p className="m-0 mt-3 text-xs font-sans text-error dark:text-error-dark">
            {error}
          </p>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} disabled={!title.trim()}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
