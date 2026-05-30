/**
 * BookMetadata component.
 *
 * Displays book metadata including cover image, title, author,
 * language, and identifier. Reads current book data from the
 * Zustand store.
 */

import { useBookStore } from "@/stores/useBookStore";

export function BookMetadata() {
  const currentBook = useBookStore((state) => state.currentBook);

  if (!currentBook) {
    return null;
  }

  return (
    <div style={styles.container}>
      {currentBook.coverUrl && (
        <img
          src={currentBook.coverUrl}
          alt={`Cover of ${currentBook.title}`}
          style={styles.cover}
        />
      )}
      <div style={styles.info}>
        <h2 style={styles.title}>{currentBook.title}</h2>
        <p style={styles.author}>{currentBook.author}</p>
      </div>
    </div>
  );
}

/**
 * Detailed metadata display component.
 *
 * Shows all extracted metadata fields including language
 * and identifier, in addition to title, author, and cover.
 */
export function BookMetadataDetail() {
  const currentBook = useBookStore((state) => state.currentBook);

  if (!currentBook) {
    return null;
  }

  return (
    <div style={styles.container}>
      {currentBook.coverUrl && (
        <img
          src={currentBook.coverUrl}
          alt={`Cover of ${currentBook.title}`}
          style={styles.cover}
        />
      )}
      <div style={styles.info}>
        <h2 style={styles.title}>{currentBook.title}</h2>
        <p style={styles.author}>{currentBook.author}</p>
        <div style={styles.details}>
          <DetailRow label="Title" value={currentBook.title} />
          <DetailRow label="Author" value={currentBook.author} />
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div style={styles.detailRow}>
      <span style={styles.detailLabel}>{label}</span>
      <span style={styles.detailValue}>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    gap: "1rem",
    padding: "1rem",
    alignItems: "flex-start",
  },
  cover: {
    width: "120px",
    height: "auto",
    borderRadius: "4px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
    flexShrink: 0,
  },
  info: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    minWidth: 0,
  },
  title: {
    margin: 0,
    fontSize: "1.25rem",
    fontWeight: 600,
    lineHeight: 1.3,
  },
  author: {
    margin: 0,
    fontSize: "0.95rem",
    color: "#666",
  },
  details: {
    marginTop: "0.75rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  detailRow: {
    display: "flex",
    gap: "0.5rem",
    fontSize: "0.85rem",
  },
  detailLabel: {
    fontWeight: 500,
    color: "#444",
    minWidth: "70px",
  },
  detailValue: {
    color: "#666",
  },
};
