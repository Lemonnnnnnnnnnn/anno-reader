import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { BookshelfPage } from "./pages/BookshelfPage";
import { ReaderPage } from "./pages/ReaderPage";

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/bookshelf" element={<BookshelfPage />} />
          <Route path="/reader" element={<ReaderPage />} />
          <Route path="/" element={<Navigate to="/bookshelf" replace />} />
          <Route path="*" element={<Navigate to="/bookshelf" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
