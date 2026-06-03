/**
 * Chat persistence layer using Tauri filesystem plugin.
 *
 * Stores conversations as a single JSON file in the app's data directory
 * under a "chat" subdirectory.
 */

import {
  readTextFile,
  writeTextFile,
  mkdir,
  exists,
} from "@tauri-apps/plugin-fs";
import { readConfig } from "@/lib/storage/config";
import type { ChatConversation } from "./types";

/** Subdirectory within app data for chat files */
const CHAT_DIR = "chat";

/** Filename for the conversations file */
const CONVERSATIONS_FILE = "conversations.json";

/**
 * Ensure the chat directory exists within the configured data directory.
 *
 * @returns The full path to the chat directory.
 * @throws If the data directory is not configured.
 */
export async function ensureChatDir(): Promise<string> {
  const config = await readConfig();
  if (!config) {
    throw new Error("Data directory not configured");
  }

  const chatDir = `${config.dataDir}/${CHAT_DIR}`;
  const dirExists = await exists(chatDir);
  if (!dirExists) {
    await mkdir(chatDir, { recursive: true });
  }

  return chatDir;
}

/**
 * Get the full path to the conversations JSON file.
 */
async function getConversationsPath(): Promise<string> {
  const chatDir = await ensureChatDir();
  return `${chatDir}/${CONVERSATIONS_FILE}`;
}

/**
 * Load all conversations from disk.
 *
 * @returns Array of persisted conversations, or an empty array if no file exists
 *          or the file contains invalid JSON.
 * @throws If the data directory is not configured.
 */
export async function loadConversations(): Promise<ChatConversation[]> {
  const filePath = await getConversationsPath();

  const fileExists = await exists(filePath);
  if (!fileExists) {
    return [];
  }

  const json = await readTextFile(filePath);
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as ChatConversation[];
  } catch {
    // Corrupted file — treat as empty
    return [];
  }
}

/**
 * Save all conversations to disk.
 *
 * @param conversations - The conversations array to persist.
 * @throws If the data directory is not configured or the write fails.
 */
export async function saveConversations(
  conversations: ChatConversation[],
): Promise<void> {
  const filePath = await getConversationsPath();
  const json = JSON.stringify(conversations, null, 2);
  await writeTextFile(filePath, json);
}
