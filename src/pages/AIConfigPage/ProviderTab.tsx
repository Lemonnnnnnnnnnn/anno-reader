/**
 * ProviderTab component.
 *
 * Manages AI provider configuration: listing, adding, editing, and deleting providers.
 * Displays a form for provider details (name, type, base URL, API key, model, etc.)
 * and a list of configured providers with set-as-default functionality.
 */

import { useAIConfigStore } from "@/stores/useAIConfigStore";
import type { ProviderType } from "@/lib/ai/types";
import { Button } from "@/components/primitives";
import { useProviderForm } from "./hooks";

export function ProviderTab() {
  const { config, removeProvider, setSelectedProvider } = useAIConfigStore();
  const { showForm, setShowForm, editingId, form, setForm, resetForm, handleEdit, handleSave } =
    useProviderForm();

  return (
    <div className="flex flex-col gap-4" role="tabpanel" aria-label="Provider configuration">
      {/* Provider List */}
      {config.providers.length === 0 && !showForm && (
        <p className="text-sm text-text-secondary text-center py-8">
          No providers configured. Add one to get started.
        </p>
      )}

      {config.providers.map((provider) => (
        <div
          key={provider.id}
          className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md p-4 flex items-center justify-between"
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-sans font-medium text-text dark:text-text-dark">
                {provider.name}
              </span>
              {config.selectedProviderId === provider.id && (
                <span className="text-xs font-sans px-1.5 py-0.5 bg-accent dark:bg-accent-dark text-white rounded">
                  Default
                </span>
              )}
            </div>
            <span className="text-xs font-sans text-text-secondary dark:text-text-secondary-dark">
              {provider.type} &middot; {provider.model} &middot; {provider.baseUrl}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {config.selectedProviderId !== provider.id && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedProvider(provider.id)}
              >
                Set as Default
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => handleEdit(provider)}>
              Edit
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => removeProvider(provider.id)}
            >
              Delete
            </Button>
          </div>
        </div>
      ))}

      {/* Add / Edit Form */}
      {showForm && (
        <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md p-4 flex flex-col gap-3">
          <h3 className="text-sm font-sans font-medium text-text dark:text-text-dark m-0">
            {editingId ? "Edit Provider" : "Add Provider"}
          </h3>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-sans text-text-secondary dark:text-text-secondary-dark">Name</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="px-3 py-1.5 text-sm font-sans bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md outline-none focus:border-accent dark:focus:border-accent-dark text-text dark:text-text-dark"
              placeholder="My OpenAI Provider"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-sans text-text-secondary dark:text-text-secondary-dark">Type</span>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as ProviderType })}
              className="px-3 py-1.5 text-sm font-sans bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md outline-none focus:border-accent dark:focus:border-accent-dark text-text dark:text-text-dark"
            >
              <option value="openai">OpenAI</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-sans text-text-secondary dark:text-text-secondary-dark">Base URL</span>
            <input
              type="text"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              className="px-3 py-1.5 text-sm font-sans bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md outline-none focus:border-accent dark:focus:border-accent-dark text-text dark:text-text-dark"
              placeholder="https://api.openai.com/v1"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-sans text-text-secondary dark:text-text-secondary-dark">API Key</span>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              className="px-3 py-1.5 text-sm font-sans bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md outline-none focus:border-accent dark:focus:border-accent-dark text-text dark:text-text-dark"
              placeholder="sk-..."
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-sans text-text-secondary dark:text-text-secondary-dark">Model</span>
            <input
              type="text"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              className="px-3 py-1.5 text-sm font-sans bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md outline-none focus:border-accent dark:focus:border-accent-dark text-text dark:text-text-dark"
              placeholder="gpt-4o"
            />
          </label>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={resetForm}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>
              {editingId ? "Save" : "Add"}
            </Button>
          </div>
        </div>
      )}

      {!showForm && (
        <Button variant="secondary" onClick={() => setShowForm(true)}>
          Add Provider
        </Button>
      )}
    </div>
  );
}
