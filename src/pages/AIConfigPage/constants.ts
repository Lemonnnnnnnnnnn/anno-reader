/**
 * Shared constants for AIConfigPage.
 *
 * Contains default form values and tab definitions used across
 * ProviderTab and AssistantTab components.
 */

import type { AIProvider, AIRole, ProviderType } from "@/lib/ai/types";

export type TabId = "provider" | "assistant";

export const TABS: { id: TabId; label: string }[] = [
  { id: "provider", label: "Provider" },
  { id: "assistant", label: "Assistant" },
];

export const EMPTY_PROVIDER: Omit<AIProvider, "id"> = {
  name: "",
  type: "openai" as ProviderType,
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o",
  enabled: true,
};

export const EMPTY_ROLE: Omit<AIRole, "id"> = {
  name: "",
  systemMessage: "",
  userMessageTemplate: "",
  variables: [],
  isDefault: false,
  isEnabled: true,
};
