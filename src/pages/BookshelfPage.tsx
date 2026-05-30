/**
 * BookshelfPage component.
 *
 * Wraps BookshelfView with data loading and navigation logic.
 */

import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useBookshelfStore } from "@/stores/useBookshelfStore";
import { BookshelfView } from "@/components/BookshelfView";
import type { BookshelfItem } from "@/lib/bookshelf";

export function BookshelfPage() {
  const navigate = useNavigate();
  const loadBooks = useBookshelfStore((state) => state.loadBooks);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const handleBookSelect = useCallback(
    (_book: BookshelfItem) => {
      navigate("/reader");
    },
    [navigate]
  );

  return <BookshelfView onBookSelect={handleBookSelect} />;
}
