import { useState } from "react";
import { Button, ErrorBanner, Modal } from "@/components/primitives";
import { importWebSnapshot } from "@/lib/web";
import type { BookMetadata } from "@/stores/useBookStore";

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: (book: BookMetadata) => Promise<void>;
}

export function ImportWebDialog({ open, onClose, onImported }: Props) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const book = await importWebSnapshot(url);
      await onImported(book);
      setUrl("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={() => { if (!busy) { setError(null); onClose(); } }} title="Import Webpage">
      <form onSubmit={submit} className="flex flex-col gap-4 font-sans">
        <label className="flex flex-col gap-2 text-sm">
          Webpage URL
          <input type="url" required autoFocus value={url} onChange={e => setUrl(e.target.value)} disabled={busy}
            placeholder="https://example.com/article"
            className="w-full rounded-md border border-border dark:border-border-dark bg-bg dark:bg-bg-dark text-text dark:text-text-dark px-3 py-2" />
        </label>
        <p className="m-0 text-xs text-text-secondary dark:text-text-secondary-dark">
          Save a fixed copy of the article and available images for offline reading and annotations.
          Pages requiring login or JavaScript may not be supported. Import again to save a separate copy.
        </p>
        {error && <ErrorBanner message={error} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? "Saving snapshot..." : "Save Snapshot"}</Button>
        </div>
      </form>
    </Modal>
  );
}
