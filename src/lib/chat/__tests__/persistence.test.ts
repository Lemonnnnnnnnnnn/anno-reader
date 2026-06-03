import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ChatConversation } from "@/lib/chat/types";

// Mock Tauri fs plugin
vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  exists: vi.fn(),
  mkdir: vi.fn(),
}));

// Mock storage config
vi.mock("@/lib/storage/config", () => ({
  readConfig: vi.fn().mockResolvedValue({ dataDir: "/mock/data" }),
}));

// Import mocked modules
import {
  readTextFile,
  writeTextFile,
  exists,
  mkdir,
} from "@tauri-apps/plugin-fs";
import { readConfig } from "@/lib/storage/config";

describe("Chat Persistence", () => {
  beforeEach(() => {
    // Restore default readConfig mock (overridden by "not configured" test)
    vi.mocked(readConfig).mockResolvedValue({ dataDir: "/mock/data" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("ensureChatDir", () => {
    it("should create chat directory if it does not exist", async () => {
      vi.mocked(exists).mockResolvedValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);

      const { ensureChatDir } = await import("@/lib/chat/persistence");
      const dir = await ensureChatDir();

      expect(dir).toBe("/mock/data/chat");
      expect(mkdir).toHaveBeenCalledWith("/mock/data/chat", {
        recursive: true,
      });
    });

    it("should not create directory if it already exists", async () => {
      vi.mocked(exists).mockResolvedValue(true);

      const { ensureChatDir } = await import("@/lib/chat/persistence");
      const dir = await ensureChatDir();

      expect(dir).toBe("/mock/data/chat");
      expect(mkdir).not.toHaveBeenCalled();
    });

    it("should throw if data directory is not configured", async () => {
      vi.mocked(readConfig).mockResolvedValue(null);

      const { ensureChatDir } = await import("@/lib/chat/persistence");
      await expect(ensureChatDir()).rejects.toThrow(
        "Data directory not configured",
      );
    });
  });

  describe("loadConversations", () => {
    it("should return empty array when no file exists", async () => {
      vi.mocked(exists).mockResolvedValue(false);

      const { loadConversations } = await import("@/lib/chat/persistence");
      const result = await loadConversations();

      expect(result).toEqual([]);
    });

    it("should return conversations from file", async () => {
      const savedConversations: ChatConversation[] = [
        {
          id: "conv-1",
          messages: [
            {
              id: "msg-1",
              role: "user",
              content: "Hello",
              createdAt: 1717500000000,
            },
          ],
          createdAt: 1717500000000,
          updatedAt: 1717500000000,
        },
      ];

      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(readTextFile).mockResolvedValue(
        JSON.stringify(savedConversations),
      );

      const { loadConversations } = await import("@/lib/chat/persistence");
      const result = await loadConversations();

      expect(result).toEqual(savedConversations);
    });

    it("should return empty array for invalid JSON", async () => {
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(readTextFile).mockResolvedValue("not valid json {{{");

      const { loadConversations } = await import("@/lib/chat/persistence");
      const result = await loadConversations();

      expect(result).toEqual([]);
    });

    it("should return empty array if JSON is not an array", async () => {
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(readTextFile).mockResolvedValue(
        JSON.stringify({ not: "an array" }),
      );

      const { loadConversations } = await import("@/lib/chat/persistence");
      const result = await loadConversations();

      expect(result).toEqual([]);
    });
  });

  describe("saveConversations", () => {
    it("should write conversations to file", async () => {
      const conversations: ChatConversation[] = [
        {
          id: "conv-1",
          messages: [],
          createdAt: 1717500000000,
          updatedAt: 1717500000000,
        },
      ];

      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(writeTextFile).mockResolvedValue(undefined);

      const { saveConversations } = await import("@/lib/chat/persistence");
      await saveConversations(conversations);

      expect(writeTextFile).toHaveBeenCalledWith(
        "/mock/data/chat/conversations.json",
        JSON.stringify(conversations, null, 2),
      );
    });

    it("should handle empty array", async () => {
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(writeTextFile).mockResolvedValue(undefined);

      const { saveConversations } = await import("@/lib/chat/persistence");
      await saveConversations([]);

      expect(writeTextFile).toHaveBeenCalledWith(
        "/mock/data/chat/conversations.json",
        JSON.stringify([], null, 2),
      );
    });
  });

  describe("round-trip: save → load", () => {
    it("should persist and restore conversations correctly", async () => {
      const conversations: ChatConversation[] = [
        {
          id: "conv-1",
          messages: [
            {
              id: "msg-1",
              role: "user",
              content: "What is EPUB?",
              createdAt: 1717500000000,
            },
            {
              id: "msg-2",
              role: "assistant",
              content:
                "EPUB is an electronic book format.",
              createdAt: 1717500001000,
            },
          ],
          createdAt: 1717500000000,
          updatedAt: 1717500001000,
        },
        {
          id: "conv-2",
          messages: [
            {
              id: "msg-3",
              role: "user",
              content: "Tell me more",
              createdAt: 1717500002000,
            },
          ],
          createdAt: 1717500002000,
          updatedAt: 1717500002000,
        },
      ];

      // Setup: file does not exist yet, then exists after save
      let writtenData: string | undefined;
      vi.mocked(exists).mockResolvedValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(writeTextFile).mockImplementation(async (_path, data) => {
        writtenData = data as string;
      });
      vi.mocked(readTextFile).mockImplementation(async () => writtenData ?? "");

      const { saveConversations, loadConversations } = await import(
        "@/lib/chat/persistence"
      );

      // Act: save
      await saveConversations(conversations);

      // Simulate file now exists for load
      vi.mocked(exists).mockResolvedValue(true);

      // Act: load
      const loaded = await loadConversations();

      // Assert
      expect(loaded).toEqual(conversations);
    });
  });
});
