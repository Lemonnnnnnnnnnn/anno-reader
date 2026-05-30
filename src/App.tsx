import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { BookshelfPage } from "./pages/BookshelfPage";
import { ReaderPage } from "./pages/ReaderPage";
import { SettingsPage } from "./pages/SettingsPage";

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/bookshelf" element={<BookshelfPage />} />
          <Route path="/reader" element={<ReaderPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/" element={<Navigate to="/bookshelf" replace />} />
          <Route path="*" element={<Navigate to="/bookshelf" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
