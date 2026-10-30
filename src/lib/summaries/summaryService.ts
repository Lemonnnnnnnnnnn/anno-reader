/**
 * Chapter summary AI service.
 *
 * Generates a streaming summary of a chapter's content using the configured
 * AI provider. Reuses the chat streaming primitive (`sendMessage`) for
 * provider/calling consistency, with a system prompt shaped by the user's
 * summary preferences (output language, detail level) and length protection
 * for long chapters.
 */

import { sendMessage } from "@/lib/chat/streaming";
import { useAIConfigStore } from "@/stores/useAIConfigStore";
import { AIServiceError } from "@/lib/ai/service";
import type { ChatMessage } from "@/lib/chat/types";
import {
  DEFAULT_SUMMARY_PREFERENCES,
  type SummaryPreferences,
  type SummaryLanguage,
  type SummaryDetail,
} from "./types";

/** Per-language instruction for the summary output language. */
const LANGUAGE_INSTRUCTIONS: Record<SummaryLanguage, string> = {
  auto: "- 总结语言与章节正文保持一致：正文是英文就用英文，是中文就用中文，不要混译。",
  chinese:
    "- 用简体中文撰写总结。专有名词（人名、地名、术语）可保留原文，并在首次出现时附上中文译名。",
  english:
    "- Write the summary in English. Keep proper nouns (names, places, terms) faithful to the original text.",
};

/** Per-detail-level instruction for summary structure and depth. */
const DETAIL_INSTRUCTIONS: Record<SummaryDetail, string> = {
  brief: `- 先给一句话核心概述，再用 3-6 条要点列出关键情节、人物动向或核心论点。
- 语言简练，不要照抄原文大段内容，不要添加原文中没有的事实。`,
  detailed: `- 先用一小段（2-3 句）概述本章主旨，再按章节内部结构分成 2-4 个小节（可用加粗小标题），每节用 2-4 条要点展开。
- 保留关键细节、人物动机或论证过程，但不要照抄原文大段内容，不要添加原文中没有的事实。`,
};

/**
 * Build the system prompt for summary generation from the user's
 * preferences. Exported for testing.
 */
export function buildSummarySystemPrompt(prefs: SummaryPreferences): string {
  const language = prefs.language ?? DEFAULT_SUMMARY_PREFERENCES.language;
  const detail = prefs.detail ?? DEFAULT_SUMMARY_PREFERENCES.detail;

  return `你是一位专业的阅读助手。请根据用户提供的整章正文，写一份本章总结。

要求：
${DETAIL_INSTRUCTIONS[detail]}
- 如果章节包含明显的结构（如场景切换、论据推进），按结构组织要点。
- 用 Markdown 输出。
${LANGUAGE_INSTRUCTIONS[language]}
- 只输出总结正文，不要加「总结」「本章总结」之类的标题（界面已提供）。`;
}

/** Maximum chapter text length (in characters) sent to the model. */
const MAX_CHAPTER_CHARS = 60000;

/** Options for {@link generateSummaryStream}. */
export interface GenerateSummaryOptions {
  /** Plain text content of the chapter to summarize. */
  chapterText: string;
  /** Optional chapter title for context. */
  chapterTitle?: string | null;
  /** Override the persisted summary preferences for this generation. */
  preferences?: Partial<SummaryPreferences>;
  /** AbortSignal to cancel the stream. */
  abortSignal?: AbortSignal;
  /** Callback invoked on each streamed chunk with the accumulated text. */
  onChunk?: (accumulated: string) => void;
  /** Callback invoked when the stream completes with the full text. */
  onComplete?: (fullText: string) => void;
  /** Callback invoked if an error occurs. */
  onError?: (error: Error) => void;
}

/**
 * Build the user message body, truncating very long chapters and noting it.
 */
function buildUserMessage(
  chapterText: string,
  chapterTitle?: string | null,
): string {
  const titleLine =
    chapterTitle && chapterTitle.trim()
      ? `章节标题：${chapterTitle.trim()}\n\n`
      : "";

  let body = chapterText;
  if (body.length > MAX_CHAPTER_CHARS) {
    body =
      body.slice(0, MAX_CHAPTER_CHARS) +
      "\n\n（注：本章正文过长，已截断仅总结前半部分）";
  }

  return `${titleLine}以下是本章正文，请生成总结：\n\n${body}`;
}

/**
 * Stream a chapter summary from the configured AI provider.
 *
 * Resolves with the full summary text on completion. Errors are normalized
 * to `AIServiceError` (rethrown) and also reported via `onError`. The caller
 * is responsible for persistence — this function only produces text.
 *
 * @returns The full summary text.
 */
export async function generateSummaryStream(
  options: GenerateSummaryOptions,
): Promise<string> {
  const {
    chapterText,
    chapterTitle,
    preferences,
    abortSignal,
    onChunk,
    onComplete,
    onError,
  } = options;

  const config = useAIConfigStore.getState().config;
  const provider = config.providers.find(
    (p) => p.id === config.selectedProviderId && p.enabled,
  );

  if (!provider) {
    const err = new AIServiceError(
      "AUTH_ERROR",
      "未配置可用的 AI 服务商，请先在 AI 设置中配置并启用一个服务商。",
    );
    onError?.(err);
    throw err;
  }

  const prefs: SummaryPreferences = {
    ...DEFAULT_SUMMARY_PREFERENCES,
    ...config.summaryPreferences,
    ...preferences,
  };

  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: buildUserMessage(chapterText, chapterTitle),
    createdAt: Date.now(),
  };

  try {
    const result = await sendMessage([userMessage], provider, {
      system: buildSummarySystemPrompt(prefs),
      abortSignal,
      onChunk: (_chunk, accumulated) => {
        onChunk?.(accumulated);
      },
      onError: (err) => {
        onError?.(err);
      },
    });

    onComplete?.(result.content);
    return result.content;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    const finalError =
      err instanceof Error ? err : new AIServiceError("UNKNOWN_ERROR", String(err));
    onError?.(finalError);
    throw finalError;
  }
}
