import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock AI SDK - APICallError must be defined inside the factory (vi.mock is hoisted)
const mockStreamText = vi.fn();

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: vi.fn().mockReturnValue({
    chatModel: vi.fn().mockReturnValue("mock-model"),
  }),
}));

vi.mock("ai", () => {
  class APICallError extends Error {
    statusCode: number;
    isRetryable: boolean;
    constructor(opts: { statusCode: number; message: string; isRetryable?: boolean }) {
      super(opts.message);
      this.name = "APICallError";
      this.statusCode = opts.statusCode;
      this.isRetryable = opts.isRetryable ?? false;
    }
  }
  return {
    streamText: (...args: unknown[]) => mockStreamText(...args),
    APICallError,
  };
});

// Mock Zustand store
const mockConfig = {
  providers: [
    {
      id: "test-provider",
      name: "Test",
      type: "openai" as const,
      baseUrl: "https://api.test.com",
      apiKey: "test-key",
      model: "test-model",
      enabled: true,
      maxTokens: 1024,
      temperature: 0.7,
    },
  ],
  selectedProviderId: "test-provider",
};

vi.mock("@/stores/useAIConfigStore", () => ({
  useAIConfigStore: Object.assign(
    (selector: (s: typeof mockStoreState) => unknown) => selector(mockStoreState),
    { getState: () => mockStoreState },
  ),
}));

const mockStoreState = {
  config: mockConfig,
};

import { sendMessage } from "../streaming";
import type { ChatMessage } from "../types";
import type { AIProvider } from "@/lib/ai/types";
import { APICallError } from "ai";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMessages(...contents: string[]): ChatMessage[] {
  return contents.map((content, i) => ({
    id: `msg-${i}`,
    role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
    content,
    createdAt: Date.now() + i * 1000,
  }));
}

const testProvider: AIProvider = {
  id: "test-provider",
  name: "Test",
  type: "openai",
  baseUrl: "https://api.test.com",
  apiKey: "test-key",
  model: "test-model",
  enabled: true,
  maxTokens: 1024,
  temperature: 0.7,
};

function setupMockStream(chunks: string[]) {
  async function* stream() {
    for (const chunk of chunks) {
      yield chunk;
    }
  }
  mockStreamText.mockReturnValue({ textStream: stream() });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sendMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return accumulated content from stream", async () => {
    setupMockStream(["Hello", " world", "!"]);

    const result = await sendMessage(
      makeMessages("Hi"),
      testProvider,
    );

    expect(result.content).toBe("Hello world!");
    expect(result.provider).toBe(testProvider);
  });

  it("should call streamText with correct params", async () => {
    setupMockStream(["response"]);

    await sendMessage(makeMessages("Hello"), testProvider);

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "mock-model",
        messages: [{ role: "user", content: "Hello" }],
        maxOutputTokens: 1024,
        temperature: 0.7,
      }),
    );
  });

  it("should convert multiple messages to CoreMessage format", async () => {
    setupMockStream(["ok"]);

    await sendMessage(
      makeMessages("Hi", "Hello there", "Follow up"),
      testProvider,
    );

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: "user", content: "Hi" },
          { role: "assistant", content: "Hello there" },
          { role: "user", content: "Follow up" },
        ],
      }),
    );
  });

  it("should call onChunk for each streamed chunk", async () => {
    setupMockStream(["Hi", " there"]);

    const onChunk = vi.fn();
    await sendMessage(makeMessages("Hello"), testProvider, { onChunk });

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, "Hi", "Hi");
    expect(onChunk).toHaveBeenNthCalledWith(2, " there", "Hi there");
  });

  it("should stop accumulating when abort signal is already aborted", async () => {
    setupMockStream(["Hello", " world"]);

    const controller = new AbortController();
    controller.abort();

    const result = await sendMessage(makeMessages("Hi"), testProvider, {
      abortSignal: controller.signal,
    });

    // First chunk is yielded but abort check breaks before appending
    expect(result.content).toBe("");
  });
});

describe("error mapping via sendMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should map 429 APICallError to RATE_LIMITED", async () => {
    // Throw during stream iteration (inside try/catch)
    async function* throwingStream() {
      yield "partial";
      throw new APICallError({
        statusCode: 429,
        message: "Too many requests",
        url: "https://api.test.com/v1/chat/completions",
        requestBodyValues: { model: "gpt-4o" },
      });
    }
    mockStreamText.mockReturnValue({ textStream: throwingStream() });

    await expect(
      sendMessage(makeMessages("Hi"), testProvider),
    ).rejects.toSatisfy((err: Error & { code?: string; retryable?: boolean }) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe("RATE_LIMITED");
      expect(err.retryable).toBe(true);
      return true;
    });
  });

  it("should map 500 APICallError to API_ERROR", async () => {
    async function* throwingStream() {
      yield "partial";
      throw new APICallError({
        statusCode: 500,
        message: "Server error",
        url: "https://api.test.com/v1/chat/completions",
        requestBodyValues: { model: "gpt-4o" },
      });
    }
    mockStreamText.mockReturnValue({ textStream: throwingStream() });

    await expect(
      sendMessage(makeMessages("Hi"), testProvider),
    ).rejects.toSatisfy((err: Error & { code?: string; retryable?: boolean }) => {
      expect(err.code).toBe("API_ERROR");
      expect(err.retryable).toBe(true);
      return true;
    });
  });

  it("should map 401 APICallError to AUTH_ERROR", async () => {
    async function* throwingStream() {
      yield "partial";
      throw new APICallError({
        statusCode: 401,
        message: "Unauthorized",
        url: "https://api.test.com/v1/chat/completions",
        requestBodyValues: { model: "gpt-4o" },
      });
    }
    mockStreamText.mockReturnValue({ textStream: throwingStream() });

    await expect(
      sendMessage(makeMessages("Hi"), testProvider),
    ).rejects.toSatisfy((err: Error & { code?: string }) => {
      expect(err.code).toBe("AUTH_ERROR");
      return true;
    });
  });

  it("should map network errors to NETWORK_ERROR", async () => {
    async function* throwingStream() {
      yield "partial";
      throw new Error("fetch failed");
    }
    mockStreamText.mockReturnValue({ textStream: throwingStream() });

    await expect(
      sendMessage(makeMessages("Hi"), testProvider),
    ).rejects.toSatisfy((err: Error & { code?: string; retryable?: boolean }) => {
      expect(err.code).toBe("NETWORK_ERROR");
      expect(err.retryable).toBe(true);
      return true;
    });
  });
});
