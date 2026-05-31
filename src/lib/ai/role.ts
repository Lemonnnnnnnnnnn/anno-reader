/**
 * Service for managing AI roles and building messages.
 * Responsible for rendering role templates with context data.
 */

import type { AIRole } from "./types";
import { PromptService } from "./prompts";
import { BUILTIN_ROLES } from "./constants";

/**
 * RoleService manages AI roles and builds messages for translation requests.
 */
export class RoleService {
  private promptService: PromptService;

  constructor() {
    this.promptService = new PromptService();
  }

  /**
   * Get a role by ID from a list of roles.
   *
   * @param roles - List of available roles
   * @param roleId - ID of the role to find
   * @returns The role if found, undefined otherwise
   */
  getRole(roles: AIRole[], roleId: string): AIRole | undefined {
    return roles.find((r) => r.id === roleId);
  }

  /**
   * Get the default role from a list of roles.
   *
   * @param roles - List of available roles
   * @returns The default role if found, undefined otherwise
   */
  getDefaultRole(roles: AIRole[]): AIRole | undefined {
    return roles.find((r) => r.isDefault);
  }

  /**
   * Get all built-in roles.
   *
   * @returns Array of built-in roles
   */
  getBuiltinRoles(): AIRole[] {
    return [...BUILTIN_ROLES];
  }

  /**
   * Build system and user messages using a role template.
   *
   * @param role - The role to use for message generation
   * @param values - Variable values to interpolate into the template
   * @returns Object with systemMessage and userMessage
   */
  buildMessages(
    role: AIRole,
    values: Record<string, string>,
  ): { systemMessage: string; userMessage: string } {
    const systemMessage = role.systemMessage;
    const userMessage = this.promptService.renderPrompt(
      role.userMessageTemplate,
      role.variables,
      values,
    );

    return { systemMessage, userMessage };
  }

  /**
   * Build messages with context data.
   *
   * @param role - The role to use for message generation
   * @param selectedText - The text selected by the user
   * @param dictionaryResults - Dictionary query results (optional)
   * @param context - Surrounding context (optional)
   * @returns Object with systemMessage and userMessage
   */
  buildMessagesWithContext(
    role: AIRole,
    selectedText: string,
    dictionaryResults: string = "",
    context: string = "",
  ): { systemMessage: string; userMessage: string } {
    const values: Record<string, string> = {
      selectedText,
      dictionaryResults: dictionaryResults || "无词典查询结果",
      context: context || "无上下文",
    };

    return this.buildMessages(role, values);
  }

  /**
   * Validate that all required variables have values.
   *
   * @param role - The role to validate
   * @param values - Variable values to check
   * @returns Object with valid flag and list of missing variables
   */
  validateVariables(
    role: AIRole,
    values: Record<string, string>,
  ): { valid: boolean; missing: string[] } {
    return this.promptService.validateVariables(role.variables, values);
  }
}
