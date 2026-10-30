/**
 * Tests for the chapter summary AI service: preference-driven prompt
 * building and store preference resolution in generateSummaryStream.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAIConfigStore } from "@/stores/useAIConfigStore";
import {
  buildSummarySystemPrompt,
  generateSummaryStream,
} from "../summaryService";
import { DEFAULT_SUMMARY_PREFERENCES } from "../types";
import type { AIProvider } from "@/lib/ai/types";
import type { ChatMessage } from "@/lib/chat/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSendMessage = vi.fn();

vi.mock("@/lib/chat/streaming", () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));

vi.mock("@/lib/storage/config", () => ({
  readConfig: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  writeTextFile: vi.fn(),
  readTextFile: vi.fn(),
  exists: vi.fn(),
  mkdir: vi.fn(),
}));

const SAMPLE_PROVIDER: AIProvider = {
  id: "provider-1",
  name: "My OpenAI",
  type: "openai",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "sk-test",
  model: "gpt-4o",
  enabled: true,
};

function resetStore(overrides?: Partial<Parameters<typeof configureStore>[0]>) {
  configureStore({ summaryPreferences: undefined, ...overrides });
}

function configureStore({
  summaryPreferences,
  withProvider = true,
}: {
  summaryPreferences?: Partial<{ language: string; detail: string }>;
  withProvider?: boolean;
}) {
  useAIConfigStore.setState({
    config: {
      providers: withProvider ? [SAMPLE_PROVIDER] : [],
      selectedProviderId: withProvider ? SAMPLE_PROVIDER.id : null,
      contextConfig: { modules: [] },
      roles: [],
      selectedRoleId: null,
      summaryPreferences: {
        ...DEFAULT_SUMMARY_PREFERENCES,
        ...(summaryPreferences as object | undefined),
      },
    },
    isLoaded: true,
  });
}

const CHAPTER_TEXT = "It was the best of times, it was the worst of times...";

// ---------------------------------------------------------------------------
// buildSummarySystemPrompt
// ---------------------------------------------------------------------------

describe("buildSummarySystemPrompt", () => {
  it("defaults to auto language + brief detail instructions", () => {
    const prompt = buildSummarySystemPrompt(DEFAULT_SUMMARY_PREFERENCES);
    expect(prompt).toContain("与章节正文保持一致");
    expect(prompt).toContain("3-6 条要点");
  });

  it("requests Simplified Chinese when language is chinese", () => {
    const prompt = buildSummarySystemPrompt({
      language: "chinese",
      detail: "brief",
    });
    expect(prompt).toContain("简体中文");
    expect(prompt).not.toContain("Write the summary in English");
  });

  it("requests English when language is english", () => {
    const prompt = buildSummarySystemPrompt({
      language: "english",
      detail: "brief",
    });
    expect(prompt).toContain("Write the summary in English");
    expect(prompt).not.toContain("与章节正文保持一致");
  });

  it("uses detailed structure instructions when detail is detailed", () => {
    const prompt = buildSummarySystemPrompt({
      language: "auto",
      detail: "detailed",
    });
    expect(prompt).toContain("小节");
    expect(prompt).not.toContain("3-6 条要点");
  });
});

// ---------------------------------------------------------------------------
// generateSummaryStream preference resolution
// ---------------------------------------------------------------------------

describe("generateSummaryStream", () => {
  beforeEach(() => {
    mockSendMessage.mockReset();
    resetStore();
  });

  function lastSystemPrompt(): string {
    const options = mockSendMessage.mock.calls.at(-1)?.[2];
    return options?.system ?? "";
  }

  it("throws AUTH_ERROR when no provider is configured", async () => {
    resetStore({ withProvider: false });

    await expect(
      generateSummaryStream({ chapterText: CHAPTER_TEXT }),
    ).rejects.toThrow("未配置可用的 AI 服务商");
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("uses the persisted store preferences for the system prompt", async () => {
    configureStore({ summaryPreferences: { language: "english" } });
    mockSendMessage.mockResolvedValue({ content: "A faithful summary." });

    const result = await generateSummaryStream({ chapterText: CHAPTER_TEXT });

    expect(result).toBe("A faithful summary.");
    expect(lastSystemPrompt()).toContain("Write the summary in English");
  });

  it("lets per-call preferences override the store", async () => {
    configureStore({ summaryPreferences: { language: "chinese", detail: "brief" } });
    mockSendMessage.mockResolvedValue({ content: "总结内容" });

    await generateSummaryStream({
      chapterText: CHAPTER_TEXT,
      preferences: { detail: "detailed" },
    });

    const prompt = lastSystemPrompt();
    expect(prompt).toContain("简体中文");
    expect(prompt).toContain("小节");
  });

  it("passes the chapter title and truncated body as the user message", async () => {
    mockSendMessage.mockResolvedValue({ content: "ok" });

    await generateSummaryStream({
      chapterText: CHAPTER_TEXT,
      chapterTitle: "Chapter 1",
    });

    const messages = mockSendMessage.mock.calls.at(-1)?.[0] as ChatMessage[];
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toContain("章节标题：Chapter 1");
    expect(messages[0].content).toContain(CHAPTER_TEXT);
  });
});
