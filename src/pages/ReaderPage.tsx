/**
 * ReaderPage component.
 *
 * Wraps ReaderLayout with navigation logic.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBookStore } from "@/stores/useBookStore";
import { ReaderLayout } from "@/components/ReaderLayout";

export function ReaderPage() {
  const navigate = useNavigate();
  const currentBook = useBookStore((state) => state.currentBook);

  // Redirect to bookshelf if no book is loaded
  useEffect(() => {
    if (!currentBook) {
      navigate("/bookshelf", { replace: true });
    }
  }, [currentBook, navigate]);

  if (!currentBook) {
    return null;
  }

  return <ReaderLayout />;
}
