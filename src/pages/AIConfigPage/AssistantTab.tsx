/**
 * AssistantTab component.
 *
 * Manages AI assistant configuration: role selection/management and context
 * module toggling. Displays a list of roles with radio selection, a form
 * for adding/editing roles, and toggle switches for context modules.
 */

import { useAIConfigStore } from "@/stores/useAIConfigStore";
import { Pencil, Trash2 } from "lucide-react";
import { Button, TextArea } from "@/components/primitives";
import { useRoleForm, useContextModules } from "./hooks";

export function AssistantTab() {
  const { config, setSelectedRole, removeRole } = useAIConfigStore();
  const { roles, selectedRoleId } = config;
  const {
    showRoleForm,
    setShowRoleForm,
    editingRoleId,
    roleForm,
    setRoleForm,
    resetRoleForm,
    handleEditRole,
    handleSaveRole,
  } = useRoleForm();
  const {
    modules,
    selectedModuleIds,
    sentenceModules,
    dictionaryModules,
    toggleModule,
    toggleDictionary,
  } = useContextModules();

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
                    <Pencil size={14} />
                  </Button>
                  {!role.isDefault && (
                    <Button
                      variant="icon"
                      size="sm"
                      onClick={() => removeRole(role.id)}
                      aria-label={`Delete ${role.name}`}
                    >
                      <Trash2 size={14} />
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
