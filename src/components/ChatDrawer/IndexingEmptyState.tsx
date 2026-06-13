/**
 * IndexingEmptyState component.
 *
 * Full-screen loading state shown while the book is being indexed by RAG
 * and no messages exist yet.
 */

import { Loader2 } from "lucide-react";

/**
 * Indexing empty state — shown while book is being indexed and no messages yet.
 */
export function IndexingEmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
      <div className="w-12 h-12 rounded-full bg-accent/10 dark:bg-accent-dark/10 flex items-center justify-center mb-4">
        <Loader2 className="h-6 w-6 text-accent dark:text-accent-dark animate-spin" />
      </div>
      <h3 className="text-base font-medium text-text dark:text-text-dark font-sans mb-1">
        Indexing book…
      </h3>
      <p className="text-sm text-text-secondary dark:text-text-secondary-dark font-sans text-center">
        Analyzing chapters for better context
      </p>
    </div>
  );
}
