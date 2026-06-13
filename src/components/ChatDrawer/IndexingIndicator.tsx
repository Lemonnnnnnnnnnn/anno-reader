/**
 * IndexingIndicator component.
 *
 * Subtle inline bar shown while the book is being indexed and messages
 * already exist. Unlike IndexingEmptyState, this is a small non-blocking
 * indicator that doesn't obscure the conversation.
 */

import { Loader2 } from "lucide-react";

/**
 * Indexing indicator — subtle inline bar shown while indexing with messages present.
 */
export function IndexingIndicator() {
  return (
    <div className="flex items-center gap-2 py-1.5 px-3 text-text-muted dark:text-text-muted-dark">
      <Loader2 className="animate-spin h-3.5 w-3.5" />
      <span className="text-xs font-sans">Indexing book for better answers…</span>
    </div>
  );
}
