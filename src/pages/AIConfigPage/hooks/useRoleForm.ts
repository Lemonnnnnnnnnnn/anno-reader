/**
 * Hook for role form state management in AssistantTab.
 *
 * Manages form visibility, editing state, and form data
 * for adding and editing AI roles. Handles variable extraction
 * from user message templates.
 */

import { useState } from "react";
import { useAIConfigStore } from "@/stores/useAIConfigStore";
import type { AIRole, PromptVariable } from "@/lib/ai/types";
import { EMPTY_ROLE } from "../constants";

export function useRoleForm() {
  const { addRole, updateRole } = useAIConfigStore();
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState(EMPTY_ROLE);

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
    const variableNames = new Set([...matches].map((m) => m[1]));

    // Preserve existing variable definitions, add new ones
    const existingVarMap = new Map(roleForm.variables.map((v) => [v.name, v]));
    const variables: PromptVariable[] = Array.from(variableNames).map(
      (name) =>
        existingVarMap.get(name) || {
          name,
          description: "",
          defaultValue: "",
          isRequired: name === "selectedText",
        },
    );

    if (editingRoleId) {
      updateRole(editingRoleId, { ...roleForm, variables });
    } else {
      addRole({ ...roleForm, variables, id: crypto.randomUUID() });
    }
    resetRoleForm();
  };

  return {
    showRoleForm,
    setShowRoleForm,
    editingRoleId,
    roleForm,
    setRoleForm,
    resetRoleForm,
    handleEditRole,
    handleSaveRole,
  };
}
