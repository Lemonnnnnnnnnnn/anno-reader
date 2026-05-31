/**
 * Tests for AIConfigPage.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

// Mock the store
const mockAddProvider = vi.fn();
const mockUpdateProvider = vi.fn();
const mockRemoveProvider = vi.fn();
const mockSetSelectedProvider = vi.fn();
const mockUpdateContextConfig = vi.fn();
const mockSetSelectedRole = vi.fn();

let mockConfig = {
  providers: [] as Array<{
    id: string;
    name: string;
    type: string;
    baseUrl: string;
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
    enabled: boolean;
  }>,
  selectedProviderId: null as string | null,
  contextConfig: {
    modules: [
      {
        id: "builtin-sentence",
        name: "Sentence Context",
        type: "sentence",
        content: "Extracts the surrounding paragraph from chapter text for richer context.",
        isEnabled: true,
      },
    ],
    selectedModuleIds: ["builtin-sentence"],
  },
  prompts: [
    {
      id: "default-translation",
      name: "Translation",
      content: "Translate the following text to {targetLanguage}.",
      variables: [
        { name: "selectedText", description: "The text selected by the user", defaultValue: "", isRequired: true },
        { name: "context", description: "The surrounding paragraph context", defaultValue: "", isRequired: false },
        { name: "targetLanguage", description: "Target language for translation", defaultValue: "Chinese", isRequired: true },
      ],
      isDefault: true,
      isEnabled: true,
    },
  ],
  roles: [
    {
      id: "reading-assistant",
      name: "阅读助手",
      systemMessage: "你是一个专业的阅读助手。",
      userMessageTemplate: "## 待翻译文本\n{selectedText}",
      variables: [
        { name: "selectedText", description: "The text selected by the user", defaultValue: "", isRequired: true },
      ],
      isDefault: true,
      isEnabled: true,
    },
    {
      id: "translator",
      name: "翻译助手",
      systemMessage: "你是一个专业的翻译助手。",
      userMessageTemplate: "## 待翻译文本\n{selectedText}",
      variables: [
        { name: "selectedText", description: "The text selected by the user", defaultValue: "", isRequired: true },
      ],
      isDefault: false,
      isEnabled: true,
    },
  ],
  selectedRoleId: "reading-assistant" as string | null,
};

vi.mock("@/stores/useAIConfigStore", () => ({
  useAIConfigStore: () => ({
    config: mockConfig,
    addProvider: mockAddProvider,
    updateProvider: mockUpdateProvider,
    removeProvider: mockRemoveProvider,
    setSelectedProvider: mockSetSelectedProvider,
    updateContextConfig: mockUpdateContextConfig,
    setSelectedRole: mockSetSelectedRole,
  }),
}));

// Import after mocks
import { AIConfigPage } from "..";

describe("AIConfigPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig = {
      providers: [],
      selectedProviderId: null,
      contextConfig: {
        modules: [
          {
            id: "builtin-sentence",
            name: "Sentence Context",
            type: "sentence",
            content: "Extracts the surrounding paragraph from chapter text for richer context.",
            isEnabled: true,
          },
        ],
        selectedModuleIds: ["builtin-sentence"],
      },
      prompts: [
        {
          id: "default-translation",
          name: "Translation",
          content: "Translate the following text to {targetLanguage}.",
          variables: [
            { name: "selectedText", description: "The text selected by the user", defaultValue: "", isRequired: true },
            { name: "context", description: "The surrounding paragraph context", defaultValue: "", isRequired: false },
            { name: "targetLanguage", description: "Target language for translation", defaultValue: "Chinese", isRequired: true },
          ],
          isDefault: true,
          isEnabled: true,
        },
      ],
      roles: [
        {
          id: "reading-assistant",
          name: "阅读助手",
          systemMessage: "你是一个专业的阅读助手。",
          userMessageTemplate: "## 待翻译文本\n{selectedText}",
          variables: [
            { name: "selectedText", description: "The text selected by the user", defaultValue: "", isRequired: true },
          ],
          isDefault: true,
          isEnabled: true,
        },
        {
          id: "translator",
          name: "翻译助手",
          systemMessage: "你是一个专业的翻译助手。",
          userMessageTemplate: "## 待翻译文本\n{selectedText}",
          variables: [
            { name: "selectedText", description: "The text selected by the user", defaultValue: "", isRequired: true },
          ],
          isDefault: false,
          isEnabled: true,
        },
      ],
      selectedRoleId: "reading-assistant",
    };
  });

  it("renders the page header", () => {
    const html = renderToString(<AIConfigPage />);

    expect(html).toContain("AI Configuration");
  });

  it("renders Provider and Assistant tabs", () => {
    const html = renderToString(<AIConfigPage />);

    expect(html).toContain(">Provider<");
    expect(html).toContain(">Assistant<");
  });

  it("renders the back button", () => {
    const html = renderToString(<AIConfigPage />);

    expect(html).toContain('aria-label="Go back"');
  });

  it("shows Provider tab content by default", () => {
    const html = renderToString(<AIConfigPage />);

    // Provider tab should be active (has aria-selected="true")
    expect(html).toContain('aria-selected="true"');
    // Provider tab panel should be rendered
    expect(html).toContain('aria-label="Provider configuration"');
    // Should show the Add Provider button
    expect(html).toContain(">Add Provider<");
  });

  it("shows empty state when no providers configured", () => {
    const html = renderToString(<AIConfigPage />);

    expect(html).toContain("No providers configured");
  });

  it("renders provider list when providers exist", () => {
    mockConfig.providers = [
      {
        id: "provider-1",
        name: "My OpenAI",
        type: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test",
        model: "gpt-4o",
        maxTokens: 2048,
        temperature: 0.3,
        enabled: true,
      },
    ];

    const html = renderToString(<AIConfigPage />);

    expect(html).toContain("My OpenAI");
    expect(html).toContain("gpt-4o");
    expect(html).toContain(">Edit<");
    expect(html).toContain(">Delete<");
  });

  it("shows Default badge for selected provider", () => {
    mockConfig.providers = [
      {
        id: "provider-1",
        name: "My OpenAI",
        type: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test",
        model: "gpt-4o",
        maxTokens: 2048,
        temperature: 0.3,
        enabled: true,
      },
    ];
    mockConfig.selectedProviderId = "provider-1";

    const html = renderToString(<AIConfigPage />);

    expect(html).toContain(">Default<");
  });

  it("shows Set as Default button for non-default providers", () => {
    mockConfig.providers = [
      {
        id: "provider-1",
        name: "My OpenAI",
        type: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test",
        model: "gpt-4o",
        maxTokens: 2048,
        temperature: 0.3,
        enabled: true,
      },
      {
        id: "provider-2",
        name: "Another Provider",
        type: "openai",
        baseUrl: "https://api.example.com/v1",
        apiKey: "sk-test2",
        model: "gpt-3.5-turbo",
        maxTokens: 1024,
        temperature: 0.5,
        enabled: true,
      },
    ];
    mockConfig.selectedProviderId = "provider-1";

    const html = renderToString(<AIConfigPage />);

    // Second provider should have Set as Default button
    expect(html).toContain("Another Provider");
    expect(html).toContain(">Set as Default<");
  });

  it("renders Assistant tab button", () => {
    const html = renderToString(<AIConfigPage />);

    expect(html).toContain(">Assistant<");
  });

  it("renders provider form inputs when Add Provider is shown", () => {
    const html = renderToString(<AIConfigPage />);

    // The Add Provider button should be visible
    expect(html).toContain(">Add Provider<");
  });
});

// Test individual tab components by importing them through the page
// We need a wrapper to test tab switching since SSR can't handle useState clicks
describe("AIConfigPage - Tab Content Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Provider tab shows provider configuration panel", () => {
    const html = renderToString(<AIConfigPage />);

    // Provider tab is active by default
    expect(html).toContain('aria-label="Provider configuration"');
    expect(html).toContain(">Add Provider<");
  });

  it("Provider tab shows empty state message", () => {
    const html = renderToString(<AIConfigPage />);

    expect(html).toContain("No providers configured. Add one to get started.");
  });

  it("Assistant tab content is not rendered when Provider tab is active", () => {
    const html = renderToString(<AIConfigPage />);

    // Assistant panel should not be in DOM when Provider is active
    expect(html).not.toContain('aria-label="Assistant configuration"');
  });
});
