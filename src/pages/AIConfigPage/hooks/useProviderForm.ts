/**
 * Hook for provider form state management in ProviderTab.
 *
 * Manages form visibility, editing state, and form data
 * for adding and editing AI providers. Also exposes a
 * connection-test action used by the form's Test button.
 */

import { useState } from "react";
import { useAIConfigStore } from "@/stores/useAIConfigStore";
import type { AIProvider } from "@/lib/ai/types";
import { OpenAIProvider } from "@/lib/ai/providers/openai";
import { EMPTY_PROVIDER } from "../constants";

/**
 * Status of the most recent (or in-flight) connection test.
 * - `idle`      — no test has been run since the form last changed
 * - `testing`   — request in flight
 * - `success`   — provider responded ok
 * - `error`     — provider responded with an error or was unreachable
 */
export type TestStatus = "idle" | "testing" | "success" | "error";

export interface TestState {
  status: TestStatus;
  /** Failure reason from the provider, shown when status === "error" */
  error?: string;
}

const IDLE_TEST: TestState = { status: "idle" };

const providerClient = new OpenAIProvider();

export function useProviderForm() {
  const { addProvider, updateProvider } = useAIConfigStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_PROVIDER);
  const [test, setTest] = useState<TestState>(IDLE_TEST);

  const resetForm = () => {
    setForm(EMPTY_PROVIDER);
    setEditingId(null);
    setShowForm(false);
    setTest(IDLE_TEST);
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
    } as typeof form);
    setTest(IDLE_TEST);
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

  // Test the current (possibly unsaved) form values against the provider.
  // Resets any previous result, runs testConnection, and stores the outcome.
  const handleTest = async () => {
    if (!form.baseUrl.trim() || !form.apiKey.trim()) {
      setTest({ status: "error", error: "Base URL and API key are required" });
      return;
    }

    setTest({ status: "testing" });
    try {
      const candidate: AIProvider = {
        ...form,
        id: editingId ?? "__test__",
      } as AIProvider;
      const result = await providerClient.testConnection(candidate);
      setTest(
        result.ok
          ? { status: "success" }
          : { status: "error", error: result.error ?? "Unknown error" },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTest({ status: "error", error: message });
    }
  };

  // Whenever the form changes, clear any stale test result so the
  // displayed status always reflects the current form values.
  const setFormAndClearTest = (next: typeof form) => {
    setForm(next);
    setTest(IDLE_TEST);
  };

  return {
    showForm,
    setShowForm,
    editingId,
    form,
    setForm: setFormAndClearTest,
    resetForm,
    handleEdit,
    handleSave,
    test,
    handleTest,
  };
}
