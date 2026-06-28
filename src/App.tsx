import "./App.css";
import { useEffect, useState, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DataDirSetup } from "./components/DataDirSetup";
import { BookshelfPage } from "./pages/BookshelfPage";
import { ReaderPage } from "./pages/ReaderPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AIConfigPage } from "./pages/AIConfigPage";
import { DataSyncPage } from "./pages/DataSyncPage";
import { useAIConfigStore } from "./stores/useAIConfigStore";
import { useProxyConfigStore } from "./stores/useProxyConfigStore";
import { readConfig, isDataDirValid } from "./lib/storage/config";

function App() {
  const loadAIConfig = useAIConfigStore((s) => s.loadConfig);
  const loadProxyConfig = useProxyConfigStore((s) => s.loadConfig);

  // Global config check — show DataDirSetup if no valid config
  const [configReady, setConfigReady] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkConfig() {
      try {
        const config = await readConfig();
        if (cancelled) return;

        if (!config) {
          setConfigReady(false);
          return;
        }

        const valid = await isDataDirValid(config.dataDir);
        if (cancelled) return;

        setConfigReady(valid);
      } catch {
        if (!cancelled) setConfigReady(false);
      }
    }

    checkConfig();
    return () => { cancelled = true; };
  }, []);

  const handleConfigComplete = useCallback(async () => {
    try {
      const config = await readConfig();
      if (config && (await isDataDirValid(config.dataDir))) {
        setConfigReady(true);
      } else {
        setConfigReady(false);
      }
    } catch {
      setConfigReady(false);
    }
  }, []);

  useEffect(() => {
    loadAIConfig();
    loadProxyConfig();
  }, [loadAIConfig, loadProxyConfig]);

  // Loading state while checking config
  if (configReady === null) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-bg dark:bg-bg-dark">
        <div className="w-8 h-8 border-2 border-border dark:border-border-dark border-t-accent dark:border-t-accent-dark rounded-full animate-spin" />
      </div>
    );
  }

  // No valid config — show DataDirSetup
  if (!configReady) {
    return <DataDirSetup onComplete={handleConfigComplete} />;
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/bookshelf" element={<BookshelfPage />} />
          <Route path="/reader" element={<ReaderPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/ai-config" element={<AIConfigPage />} />
          <Route path="/data-sync" element={<DataSyncPage />} />
          <Route path="/" element={<Navigate to="/bookshelf" replace />} />
          <Route path="*" element={<Navigate to="/bookshelf" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
