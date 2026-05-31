/**
 * Hook for provider form state management in ProviderTab.
 *
 * Manages form visibility, editing state, and form data
 * for adding and editing AI providers.
 */

import { useState } from "react";
import { useAIConfigStore } from "@/stores/useAIConfigStore";
import type { AIProvider } from "@/lib/ai/types";
import { EMPTY_PROVIDER } from "../constants";

export function useProviderForm() {
  const { addProvider, updateProvider } = useAIConfigStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_PROVIDER);

  const resetForm = () => {
    setForm(EMPTY_PROVIDER);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (provider: AIProvider) => {
    setEditingId(provider.id);
    setForm({
      name: provider.name,
      type: provider.type,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model: provider.model,
      maxTokens: provider.maxTokens,
      temperature: provider.temperature,
      enabled: provider.enabled,
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;

    if (editingId) {
      updateProvider(editingId, form);
    } else {
      addProvider({ ...form, id: crypto.randomUUID() });
    }
    resetForm();
  };

  return {
    showForm,
    setShowForm,
    editingId,
    form,
    setForm,
    resetForm,
    handleEdit,
    handleSave,
  };
}
