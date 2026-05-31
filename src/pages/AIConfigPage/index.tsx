import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAIConfigStore } from "@/stores/useAIConfigStore";
import type { AIProvider, AIRole, ProviderType, PromptVariable } from "@/lib/ai/types";
import { Button, Icon, TextArea } from "@/components/primitives";

type TabId = "provider" | "assistant";

const TABS: { id: TabId; label: string }[] = [
  { id: "provider", label: "Provider" },
  { id: "assistant", label: "Assistant" },
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

export function AIConfigPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("provider");
  const loadConfig = useAIConfigStore((s) => s.loadConfig);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

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
          {activeTab === "assistant" && <AssistantTab />}
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
// Assistant Tab (整合 Context + Role)
// ---------------------------------------------------------------------------

const EMPTY_ROLE: Omit<AIRole, "id"> = {
  name: "",
  systemMessage: "",
  userMessageTemplate: "",
  variables: [],
  isDefault: false,
  isEnabled: true,
};

function AssistantTab() {
  const { config, updateContextConfig, setSelectedRole, addRole, updateRole, removeRole } = useAIConfigStore();
  const { modules, selectedModuleIds } = config.contextConfig;
  const { roles, selectedRoleId } = config;

  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState(EMPTY_ROLE);

  const sentenceModules = modules.filter((m) => m.type === "sentence");
  const dictionaryModules = modules.filter((m) => m.type === "dictionary");

  const resetRoleForm = () => {
    setRoleForm(EMPTY_ROLE);
    setEditingRoleId(null);
    setShowRoleForm(false);
  };

  const handleEditRole = (role: AIRole) => {
    setEditingRoleId(role.id);
    setRoleForm({
      name: role.name,
      systemMessage: role.systemMessage,
      userMessageTemplate: role.userMessageTemplate,
      variables: role.variables,
      isDefault: role.isDefault,
      isEnabled: role.isEnabled,
    });
    setShowRoleForm(true);
  };

  const handleSaveRole = () => {
    if (!roleForm.name.trim() || !roleForm.systemMessage.trim()) return;

    // Extract variables from userMessageTemplate
    const variableRegex = /\{(\w+)\}/g;
    const matches = roleForm.userMessageTemplate.matchAll(variableRegex);
    const variableNames = new Set([...matches].map(m => m[1]));
    
    // Preserve existing variable definitions, add new ones
    const existingVarMap = new Map(roleForm.variables.map(v => [v.name, v]));
    const variables: PromptVariable[] = Array.from(variableNames).map(name => 
      existingVarMap.get(name) || {
        name,
        description: "",
        defaultValue: "",
        isRequired: name === "selectedText",
      }
    );

    if (editingRoleId) {
      updateRole(editingRoleId, { ...roleForm, variables });
    } else {
      addRole({ ...roleForm, variables, id: crypto.randomUUID() });
    }
    resetRoleForm();
  };

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

  return (
    <div className="flex flex-col gap-6" role="tabpanel" aria-label="Assistant configuration">
      {/* 角色选择 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-sans font-semibold text-text m-0">
            角色选择
          </h2>
          {!showRoleForm && (
            <Button variant="secondary" size="sm" onClick={() => setShowRoleForm(true)}>
              添加角色
            </Button>
          )}
        </div>
        <p className="text-xs font-sans text-text-secondary mb-4">
          选择 AI 助手的角色，决定它如何帮助你理解和记录阅读内容。
        </p>

        <div className="flex flex-col gap-3">
          {roles.map((role) => (
            <div
              key={role.id}
              className={`
                bg-surface border rounded-md p-4 transition-all
                ${selectedRoleId === role.id
                  ? "border-accent ring-1 ring-accent"
                  : "border-border"
                }
              `}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`
                    w-4 h-4 rounded-full border-2 flex items-center justify-center mt-1 cursor-pointer
                    ${selectedRoleId === role.id
                      ? "border-accent"
                      : "border-border hover:border-text-secondary"
                    }
                  `}
                  onClick={() => setSelectedRole(role.id)}
                  role="radio"
                  aria-checked={selectedRoleId === role.id}
                >
                  {selectedRoleId === role.id && (
                    <div className="w-2 h-2 rounded-full bg-accent" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-sans font-medium text-text">
                      {role.name}
                    </span>
                    {role.isDefault && (
                      <span className="text-xs font-sans px-1.5 py-0.5 bg-accent/10 text-accent rounded">
                        默认
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-sans text-text-secondary mt-1 m-0 whitespace-pre-wrap line-clamp-2">
                    {role.systemMessage}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="icon"
                    size="sm"
                    onClick={() => handleEditRole(role)}
                    aria-label={`Edit ${role.name}`}
                  >
                    <Icon name="edit" size={14} />
                  </Button>
                  {!role.isDefault && (
                    <Button
                      variant="icon"
                      size="sm"
                      onClick={() => removeRole(role.id)}
                      aria-label={`Delete ${role.name}`}
                    >
                      <Icon name="trash" size={14} />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 角色编辑表单 */}
        {showRoleForm && (
          <div className="bg-surface border border-border rounded-md p-4 flex flex-col gap-3 mt-3">
            <h3 className="text-sm font-sans font-medium text-text m-0">
              {editingRoleId ? "编辑角色" : "添加角色"}
            </h3>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-sans text-text-secondary">角色名称</span>
              <input
                type="text"
                value={roleForm.name}
                onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                className="px-3 py-1.5 text-sm font-sans bg-surface border border-border rounded-md outline-none focus:border-accent"
                placeholder="我的自定义角色"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-sans text-text-secondary">
                系统提示词（定义 AI 的行为和角色）
              </span>
              <TextArea
                value={roleForm.systemMessage}
                onChange={(e) => setRoleForm({ ...roleForm, systemMessage: e.target.value })}
                rows={6}
                placeholder="你是一个专业的阅读助手。你的职责是..."
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-sans text-text-secondary">
                用户消息模板（使用 {"{variableName}"} 作为占位符）
              </span>
              <TextArea
                value={roleForm.userMessageTemplate}
                onChange={(e) => setRoleForm({ ...roleForm, userMessageTemplate: e.target.value })}
                rows={8}
                placeholder={`## 待翻译文本\n{selectedText}\n\n## 词典查询结果\n{dictionaryResults}\n\n## 上下文\n{context}`}
              />
            </label>

            <div className="bg-bg border border-border rounded-md p-3">
              <p className="text-xs font-sans text-text-secondary m-0">
                <strong>可用变量：</strong>
                {"{selectedText}"} (选中文本)、{"{dictionaryResults}"} (词典结果)、{"{context}"} (上下文)
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="secondary" onClick={resetRoleForm}>
                取消
              </Button>
              <Button
                onClick={handleSaveRole}
                disabled={!roleForm.name.trim() || !roleForm.systemMessage.trim()}
              >
                {editingRoleId ? "保存" : "添加"}
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* 上下文模块 */}
      <section>
        <h2 className="text-sm font-sans font-semibold text-text mb-3">
          上下文模块
        </h2>
        <p className="text-xs font-sans text-text-secondary mb-4">
          启用上下文模块，为 AI 提供更多信息以提高理解质量。
        </p>

        {/* Sentence Context */}
        {sentenceModules.map((module) => {
          const isEnabled = selectedModuleIds.includes(module.id);
          return (
            <div
              key={module.id}
              className="bg-surface border border-border rounded-md p-4 flex items-center justify-between mb-3"
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm font-sans font-medium text-text">
                  {module.name}
                </span>
                <span className="text-xs font-sans text-text-secondary">
                  {module.content}
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

        {/* Dictionary Context */}
        {dictionaryModules.length > 0 && (
          <>
            <h3 className="text-xs font-sans font-semibold text-text-secondary mt-4 mb-3">
              词典查询
            </h3>
            {dictionaryModules.map((module) => (
              <div
                key={module.id}
                className="bg-surface border border-border rounded-md p-4 flex items-center justify-between mb-3"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-sans font-medium text-text">
                    {module.name}
                  </span>
                  <span className="text-xs font-sans text-text-secondary">
                    {module.content}
                  </span>
                </div>
                <button
                  onClick={() => toggleDictionary(module.id)}
                  className={`
                    relative w-11 h-6 rounded-full transition-colors cursor-pointer border-0
                    ${module.isEnabled ? "bg-accent" : "bg-border"}
                  `}
                  role="switch"
                  aria-checked={module.isEnabled}
                  aria-label={`Toggle ${module.name}`}
                >
                  <span
                    className={`
                      absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm
                      ${module.isEnabled ? "translate-x-5" : "translate-x-0"}
                    `}
                  />
                </button>
              </div>
            ))}
          </>
        )}

        {modules.length === 0 && (
          <p className="text-sm text-text-secondary text-center py-8">
            No context modules available.
          </p>
        )}
      </section>
    </div>
  );
}
