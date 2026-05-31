import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAIConfigStore } from "@/stores/useAIConfigStore";
import type { AIProvider, AIPrompt, ProviderType } from "@/lib/ai/types";
import { Button, Icon, TextArea } from "@/components/primitives";

type TabId = "provider" | "context" | "prompt";

const TABS: { id: TabId; label: string }[] = [
  { id: "provider", label: "Provider" },
  { id: "context", label: "Context" },
  { id: "prompt", label: "Prompt" },
];

const EMPTY_PROVIDER: Omit<AIProvider, "id"> = {
  name: "",
  type: "openai" as ProviderType,
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o",
  maxTokens: 2048,
  temperature: 0.3,
  enabled: true,
};

const EMPTY_PROMPT: Omit<AIPrompt, "id"> = {
  name: "",
  content: "",
  variables: [],
  isDefault: false,
  isEnabled: true,
};

export function AIConfigPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("provider");

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg text-text font-serif">
      {/* Header */}
      <header className="shrink-0 bg-surface border-b border-border">
        <div className="flex items-center gap-3 px-6 py-4 max-w-[1200px] mx-auto w-full">
          <Button variant="icon" onClick={() => navigate(-1)} aria-label="Go back">
            <Icon name="arrow-left" size={18} />
          </Button>
          <h1 className="text-xl font-semibold text-text tracking-tight m-0">
            AI Configuration
          </h1>
        </div>
      </header>

      {/* Tab Bar */}
      <nav className="shrink-0 bg-surface border-b border-border">
        <div className="flex gap-0 px-6 max-w-[1200px] mx-auto w-full">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-4 py-3 text-sm font-sans font-medium border-b-2 transition-colors cursor-pointer bg-transparent
                ${activeTab === tab.id
                  ? "border-accent text-text"
                  : "border-transparent text-text-secondary hover:text-text"
                }
              `}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Tab Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-[800px] mx-auto flex flex-col gap-6">
          {activeTab === "provider" && <ProviderTab />}
          {activeTab === "context" && <ContextTab />}
          {activeTab === "prompt" && <PromptTab />}
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider Tab
// ---------------------------------------------------------------------------

function ProviderTab() {
  const { config, addProvider, updateProvider, removeProvider, setSelectedProvider } =
    useAIConfigStore();
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
          className="bg-surface border border-border rounded-md p-4 flex items-center justify-between"
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-sans font-medium text-text">
                {provider.name}
              </span>
              {config.selectedProviderId === provider.id && (
                <span className="text-xs font-sans px-1.5 py-0.5 bg-accent text-white rounded">
                  Default
                </span>
              )}
            </div>
            <span className="text-xs font-sans text-text-secondary">
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
        <div className="bg-surface border border-border rounded-md p-4 flex flex-col gap-3">
          <h3 className="text-sm font-sans font-medium text-text m-0">
            {editingId ? "Edit Provider" : "Add Provider"}
          </h3>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-sans text-text-secondary">Name</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="px-3 py-1.5 text-sm font-sans bg-surface border border-border rounded-md outline-none focus:border-accent"
              placeholder="My OpenAI Provider"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-sans text-text-secondary">Type</span>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as ProviderType })}
              className="px-3 py-1.5 text-sm font-sans bg-surface border border-border rounded-md outline-none focus:border-accent"
            >
              <option value="openai">OpenAI</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-sans text-text-secondary">Base URL</span>
            <input
              type="text"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              className="px-3 py-1.5 text-sm font-sans bg-surface border border-border rounded-md outline-none focus:border-accent"
              placeholder="https://api.openai.com/v1"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-sans text-text-secondary">API Key</span>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              className="px-3 py-1.5 text-sm font-sans bg-surface border border-border rounded-md outline-none focus:border-accent"
              placeholder="sk-..."
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-sans text-text-secondary">Model</span>
            <input
              type="text"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              className="px-3 py-1.5 text-sm font-sans bg-surface border border-border rounded-md outline-none focus:border-accent"
              placeholder="gpt-4o"
            />
          </label>

          <div className="flex gap-4">
            <label className="flex flex-col gap-1 flex-1">
              <span className="text-xs font-sans text-text-secondary">Max Tokens</span>
              <input
                type="number"
                value={form.maxTokens}
                onChange={(e) => setForm({ ...form, maxTokens: Number(e.target.value) })}
                className="px-3 py-1.5 text-sm font-sans bg-surface border border-border rounded-md outline-none focus:border-accent"
              />
            </label>

            <label className="flex flex-col gap-1 flex-1">
              <span className="text-xs font-sans text-text-secondary">Temperature</span>
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })}
                className="px-3 py-1.5 text-sm font-sans bg-surface border border-border rounded-md outline-none focus:border-accent"
              />
            </label>
          </div>

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

// ---------------------------------------------------------------------------
// Context Tab
// ---------------------------------------------------------------------------

function ContextTab() {
  const { config, updateContextConfig } = useAIConfigStore();
  const { modules, selectedModuleIds } = config.contextConfig;

  const toggleModule = (moduleId: string) => {
    const isSelected = selectedModuleIds.includes(moduleId);
    updateContextConfig({
      selectedModuleIds: isSelected
        ? selectedModuleIds.filter((id) => id !== moduleId)
        : [...selectedModuleIds, moduleId],
    });
  };

  return (
    <div className="flex flex-col gap-4" role="tabpanel" aria-label="Context configuration">
      <p className="text-sm text-text-secondary">
        Enable context modules to provide surrounding text for better translation quality.
      </p>

      {modules.length === 0 && (
        <p className="text-sm text-text-secondary text-center py-8">
          No context modules available.
        </p>
      )}

      {modules.map((module) => {
        const isEnabled = selectedModuleIds.includes(module.id);
        return (
          <div
            key={module.id}
            className="bg-surface border border-border rounded-md p-4 flex items-center justify-between"
          >
            <div className="flex flex-col gap-1">
              <span className="text-sm font-sans font-medium text-text">
                {module.name}
              </span>
              <span className="text-xs font-sans text-text-secondary">
                {module.content}
              </span>
              <span className="text-xs font-sans text-text-muted">
                Type: {module.type}
              </span>
            </div>
            <button
              onClick={() => toggleModule(module.id)}
              className={`
                relative w-11 h-6 rounded-full transition-colors cursor-pointer border-0
                ${isEnabled ? "bg-accent" : "bg-border"}
              `}
              role="switch"
              aria-checked={isEnabled}
              aria-label={`Toggle ${module.name}`}
            >
              <span
                className={`
                  absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm
                  ${isEnabled ? "translate-x-5" : "translate-x-0"}
                `}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prompt Tab
// ---------------------------------------------------------------------------

function PromptTab() {
  const { config, addPrompt, updatePrompt, removePrompt, setDefaultPrompt } =
    useAIConfigStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_PROMPT);
  const [variableInput, setVariableInput] = useState("");

  const resetForm = () => {
    setForm(EMPTY_PROMPT);
    setEditingId(null);
    setShowForm(false);
    setVariableInput("");
  };

  const handleEdit = (prompt: AIPrompt) => {
    setEditingId(prompt.id);
    setForm({
      name: prompt.name,
      content: prompt.content,
      variables: prompt.variables,
      isDefault: prompt.isDefault,
      isEnabled: prompt.isEnabled,
    });
    setVariableInput(prompt.variables.map((v) => v.name).join(", "));
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.content.trim()) return;

    const variables = variableInput
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .map((name) => ({
        name,
        description: "",
        defaultValue: "",
        isRequired: false,
      }));

    if (editingId) {
      updatePrompt(editingId, { ...form, variables });
    } else {
      addPrompt({ ...form, variables, id: crypto.randomUUID() });
    }
    resetForm();
  };

  return (
    <div className="flex flex-col gap-4" role="tabpanel" aria-label="Prompt configuration">
      {/* Prompt List */}
      {config.prompts.length === 0 && !showForm && (
        <p className="text-sm text-text-secondary text-center py-8">
          No prompts configured. Add one to get started.
        </p>
      )}

      {config.prompts.map((prompt) => (
        <div
          key={prompt.id}
          className="bg-surface border border-border rounded-md p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-sans font-medium text-text">
                {prompt.name}
              </span>
              {prompt.isDefault && (
                <span className="text-xs font-sans px-1.5 py-0.5 bg-accent text-white rounded">
                  Default
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!prompt.isDefault && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDefaultPrompt(prompt.id)}
                >
                  Set as Default
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => handleEdit(prompt)}>
                Edit
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => removePrompt(prompt.id)}
              >
                Delete
              </Button>
            </div>
          </div>
          <p className="text-xs font-sans text-text-secondary whitespace-pre-wrap m-0 line-clamp-3">
            {prompt.content}
          </p>
          {prompt.variables.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {prompt.variables.map((v) => (
                <span
                  key={v.name}
                  className="text-xs font-sans px-1.5 py-0.5 bg-bg border border-border rounded text-text-secondary"
                >
                  {"{" + v.name + "}"}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Add / Edit Form */}
      {showForm && (
        <div className="bg-surface border border-border rounded-md p-4 flex flex-col gap-3">
          <h3 className="text-sm font-sans font-medium text-text m-0">
            {editingId ? "Edit Prompt" : "Add Prompt"}
          </h3>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-sans text-text-secondary">Name</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="px-3 py-1.5 text-sm font-sans bg-surface border border-border rounded-md outline-none focus:border-accent"
              placeholder="My Translation Prompt"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-sans text-text-secondary">
              Content (use {"{variableName}"} for placeholders)
            </span>
            <TextArea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={6}
              placeholder="Translate the following text to {targetLanguage}..."
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-sans text-text-secondary">
              Variables (comma-separated)
            </span>
            <input
              type="text"
              value={variableInput}
              onChange={(e) => setVariableInput(e.target.value)}
              className="px-3 py-1.5 text-sm font-sans bg-surface border border-border rounded-md outline-none focus:border-accent"
              placeholder="selectedText, context, targetLanguage"
            />
          </label>

          <div className="bg-bg border border-border rounded-md p-3">
            <p className="text-xs font-sans text-text-secondary m-0">
              <strong>Variable placeholders:</strong> Use {"{variableName}"} in your prompt
              content. Common variables: {"{selectedText}"} (the text to translate),{" "}
              {"{context}"} (surrounding paragraph), {"{targetLanguage}"} (target language).
            </p>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={resetForm}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.name.trim() || !form.content.trim()}
            >
              {editingId ? "Save" : "Add"}
            </Button>
          </div>
        </div>
      )}

      {!showForm && (
        <Button variant="secondary" onClick={() => setShowForm(true)}>
          Add Prompt
        </Button>
      )}
    </div>
  );
}
