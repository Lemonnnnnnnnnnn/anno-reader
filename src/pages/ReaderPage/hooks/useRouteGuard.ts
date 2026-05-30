/**
 * Route guard hook for ReaderPage.
 * Redirects to /bookshelf if no book is loaded.
 * Returns currentBook for conditional rendering.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBookStore } from "@/stores/useBookStore";

export function useRouteGuard() {
  const navigate = useNavigate();
  const currentBook = useBookStore((state) => state.currentBook);

  // Redirect to bookshelf if no book is loaded
  useEffect(() => {
    if (!currentBook) {
      navigate("/bookshelf", { replace: true });
    }
  }, [currentBook, navigate]);

  return currentBook;
}
