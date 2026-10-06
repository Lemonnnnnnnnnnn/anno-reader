import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/primitives";
import { setNoteStarred } from "@/lib/annotations";
import type { Note } from "@/stores/useBookStore";

export function NoteStarButton({ note }: { note: Note }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const label = note.starred ? "Unstar note" : "Star note";
  return <span className="inline-flex items-center gap-1">
    <Button variant="icon" title={label} aria-label={label} aria-pressed={!!note.starred} disabled={busy}
      className={note.starred ? "text-amber-600 dark:text-amber-400" : ""}
      onClick={async event => {
        event.stopPropagation();
        setBusy(true);
        setError(false);
        try { await setNoteStarred(note.id, !note.starred, note.bookId); }
        catch { setError(true); }
        finally { setBusy(false); }
      }}>
      <Star size={16} className={note.starred ? "fill-current" : ""} />
    </Button>
    {error && <span role="alert" className="text-xs text-red-600 dark:text-red-400">Could not save star. Please retry.</span>}
  </span>;
}
