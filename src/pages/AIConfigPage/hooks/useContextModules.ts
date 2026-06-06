/**
 * Hook for context module toggling in AssistantTab.
 *
 * Manages enabling/disabling sentence context and dictionary modules
 * via the AI config store.
 */

import { useAIConfigStore } from "@/stores/useAIConfigStore";

export function useContextModules() {
  const { config, updateContextConfig } = useAIConfigStore();
  const { modules } = config.contextConfig;

  const sentenceModules = modules.filter((m) => m.type === "sentence");
  const dictionaryModules = modules.filter((m) => m.type === "dictionary");

  const toggleModule = (moduleId: string) => {
    updateContextConfig({
      modules: modules.map((m) =>
        m.id === moduleId ? { ...m, isEnabled: !m.isEnabled } : m,
      ),
    });
  };

  const toggleDictionary = (moduleId: string) => {
    updateContextConfig({
      modules: modules.map((m) =>
        m.id === moduleId ? { ...m, isEnabled: !m.isEnabled } : m,
      ),
    });
  };

  return {
    modules,
    sentenceModules,
    dictionaryModules,
    toggleModule,
    toggleDictionary,
  };
}
