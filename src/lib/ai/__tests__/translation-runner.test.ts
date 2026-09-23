/**
 * Tests for the shared streaming translation runner.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AIServiceError } from "../service";
import type { AIConfig, AIProvider } from "../types";

const { mockTranslateStream, mockCacheTranslation } = vi.hoisted(() => ({
  mockTranslateStream: vi.fn(),
  mockCacheTranslation: vi.fn(),
}));

vi.mock("../translation", () => ({
  translationService: {
    translateStream: mockTranslateStream,
    cacheTranslation: mockCacheTranslation,
  },
}));

import { runTranslationStream } from "../translation-runner";

const provider: AIProvider = {
  id: "test-openai",
  name: "Test OpenAI",
  type: "openai",
  baseUrl: "https://example.test/v1",
  apiKey: "sk-test",
  model: "gpt-4o",
  enabled: true,
};

const config = {
  providers: [provider],
  selectedProviderId: provider.id,
  contextConfig: { modules: [] },
  roles: [],
  selectedRoleId: null,
} as unknown as AIConfig;

function streamOf(chunks: string[]): AsyncIterable<string> {
  return (async function* () {
    for (const chunk of chunks) yield chunk;
  })();
}

function resolveStream(chunks: string[]): void {
  mockTranslateStream.mockResolvedValue({ textStream: streamOf(chunks), provider });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runTranslationStream", () => {
  it("accumulates chunks, reports them, and caches the finished translation", async () => {
    const events: string[] = [];
    resolveStream(["你", "好"]);

    const result = await runTranslationStream({
      text: "hello",
      targetLanguage: "Chinese",
      config,
      onStreamStart: () => events.push("start"),
      onChunk: (accumulated) => events.push(`chunk:${accumulated}`),
    });

    expect(result).toEqual({ translation: "你好", provider });
    // onStreamStart fires before the first chunk
    expect(events).toEqual(["start", "chunk:你", "chunk:你好"]);
    expect(mockCacheTranslation).toHaveBeenCalledTimes(1);
    expect(mockCacheTranslation).toHaveBeenCalledWith("hello", "Chinese", "你好", provider);
  });

  it("passes context and options through to the service", async () => {
    resolveStream(["x"]);

    await runTranslationStream({
      text: "text",
      targetLanguage: "Chinese",
      config,
      chapterText: "chapter",
      offset: 3,
      selectionSentence: "sentence",
      force: true,
    });

    expect(mockTranslateStream).toHaveBeenCalledWith(
      "text",
      "Chinese",
      config,
      expect.objectContaining({ force: true }),
      "chapter",
      3,
      "sentence",
    );
  });

  it("retries retryable failures", async () => {
    const onRetry = vi.fn();
    mockTranslateStream
      .mockRejectedValueOnce(new AIServiceError("NETWORK_ERROR", "boom", true))
      .mockResolvedValueOnce({ textStream: streamOf(["ok"]), provider });

    const result = await runTranslationStream({
      text: "text",
      targetLanguage: "Chinese",
      config,
      onRetry,
    });

    expect(result.translation).toBe("ok");
    expect(mockTranslateStream).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ code: "NETWORK_ERROR" }),
    );
  });

  it("does not retry non-retryable failures", async () => {
    mockTranslateStream.mockRejectedValue(new AIServiceError("AUTH_ERROR", "bad key"));

    await expect(
      runTranslationStream({ text: "text", targetLanguage: "Chinese", config }),
    ).rejects.toMatchObject({ code: "AUTH_ERROR" });

    expect(mockTranslateStream).toHaveBeenCalledTimes(1);
  });

  it("honours maxRetries", async () => {
    mockTranslateStream.mockRejectedValue(new AIServiceError("API_ERROR", "5xx", true));

    await expect(
      runTranslationStream({
        text: "text",
        targetLanguage: "Chinese",
        config,
        maxRetries: 1,
      }),
    ).rejects.toMatchObject({ code: "API_ERROR" });

    expect(mockTranslateStream).toHaveBeenCalledTimes(2);
  });

  it("keeps the text accumulated so far when aborted mid-stream", async () => {
    const controller = new AbortController();
    resolveStream(["one", "two", "three"]);

    const result = await runTranslationStream({
      text: "text",
      targetLanguage: "Chinese",
      config,
      abortSignal: controller.signal,
      onChunk: (accumulated) => {
        if (accumulated === "one") controller.abort();
      },
    });

    expect(result.translation).toBe("one");
    expect(mockCacheTranslation).toHaveBeenCalledWith("text", "Chinese", "one", provider);
  });
});
