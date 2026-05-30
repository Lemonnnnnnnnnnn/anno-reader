/**
 * Configuration check hook for ReaderPage.
 * Checks if data directory is configured and valid on mount.
 * Returns config state and completion handler for DataDirSetup.
 */

import { useState, useEffect, useCallback } from "react";
import { readConfig, isDataDirValid } from "@/lib/storage/config";

export function useConfig() {
  const [configReady, setConfigReady] = useState<boolean | null>(null);

  // Check config on mount to determine if DataDirSetup is needed
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

  // Called when DataDirSetup completes — verify config then transition
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

  return { configReady, handleConfigComplete };
}
