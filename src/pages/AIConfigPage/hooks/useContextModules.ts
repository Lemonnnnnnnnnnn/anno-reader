/**
 * Hook for context module toggling in AssistantTab.
 *
 * Manages enabling/disabling sentence context and dictionary modules
 * via the AI config store.
 */

import { useAIConfigStore } from "@/stores/useAIConfigStore";

export function useContextModules() {
  const { config, updateContextConfig } = useAIConfigStore();
  const { modules, selectedModuleIds } = config.contextConfig;

  const sentenceModules = modules.filter((m) => m.type === "sentence");
  const dictionaryModules = modules.filter((m) => m.type === "dictionary");

  const toggleModule = (moduleId: string) => {
    const isSelected = selectedModuleIds.includes(moduleId);
    const nextEnabled = !isSelected;
    updateContextConfig({
      selectedModuleIds: isSelected
        ? selectedModuleIds.filter((id) => id !== moduleId)
        : [...selectedModuleIds, moduleId],
      modules: modules.map((m) =>
        m.id === moduleId ? { ...m, isEnabled: nextEnabled } : m,
      ),
    });
  };

  const toggleDictionary = (moduleId: string) => {
    const updatedModules = modules.map((m) =>
      m.id === moduleId ? { ...m, isEnabled: !m.isEnabled } : m,
    );
    updateContextConfig({ modules: updatedModules });
  };

  return {
    modules,
    selectedModuleIds,
    sentenceModules,
    dictionaryModules,
    toggleModule,
    toggleDictionary,
  };
}
