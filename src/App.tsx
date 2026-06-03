import "./App.css";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { BookshelfPage } from "./pages/BookshelfPage";
import { ReaderPage } from "./pages/ReaderPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AIConfigPage } from "./pages/AIConfigPage";
import { useAIConfigStore } from "./stores/useAIConfigStore";

function App() {
  const loadConfig = useAIConfigStore((s) => s.loadConfig);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/bookshelf" element={<BookshelfPage />} />
          <Route path="/reader" element={<ReaderPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/ai-config" element={<AIConfigPage />} />
          <Route path="/" element={<Navigate to="/bookshelf" replace />} />
          <Route path="*" element={<Navigate to="/bookshelf" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
