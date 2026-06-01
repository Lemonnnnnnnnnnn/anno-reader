/**
 * Constants for the AI translation module.
 * Centralizes all built-in defaults and system messages.
 */

import type { ContextModule, PromptTemplate, AIRole } from "./types";

// ---------------------------------------------------------------------------
// System Messages
// ---------------------------------------------------------------------------

/**
 * Default system message for translation requests.
 * Instructs the AI to act as a professional translator.
 */
export const DEFAULT_SYSTEM_MESSAGE =
  "You are a professional translator. Translate the following text to {targetLanguage}. Use the context if provided for better accuracy.";

// ---------------------------------------------------------------------------
// Prompt Templates
// ---------------------------------------------------------------------------

/** Default translation prompt template with standard variables. */
export const DEFAULT_TRANSLATION_PROMPT: PromptTemplate = {
  id: "default-translation",
  name: "Translation",
  content:
    "Translate the following text to {targetLanguage}. Provide a concise interpretation that captures the meaning and nuance in context, not just a literal translation.\n\nText to translate:\n{selectedText}",
  variables: [
    {
      name: "selectedText",
      description: "The text selected by the user",
      defaultValue: "",
      isRequired: true,
    },
    {
      name: "targetLanguage",
      description: "Target language for translation",
      defaultValue: "Chinese",
      isRequired: true,
    },
  ],
  category: "translation",
};

// ---------------------------------------------------------------------------
// Context Modules
// ---------------------------------------------------------------------------

/** Built-in context module that uses the selected sentence as context. */
export const BUILTIN_SENTENCE_CONTEXT: ContextModule = {
  id: "builtin-sentence",
  name: "Sentence Context",
  type: "sentence",
  content: "Extracts the surrounding paragraph from chapter text for richer context.",
  isEnabled: true,
};

/** Built-in dictionary context modules. */
export const BUILTIN_DICTIONARY_MODULES: ContextModule[] = [
  {
    id: "builtin-etymonline",
    name: "Etymonline (词源)",
    type: "dictionary",
    content: "Etymology and word origins from Etymonline",
    isEnabled: true,
    providerId: "etymonline",
  },
  {
    id: "builtin-vocabulary",
    name: "Vocabulary.com",
    type: "dictionary",
    content: "Definitions from Vocabulary.com dictionary",
    isEnabled: true,
    providerId: "vocabulary",
  },
];

// ---------------------------------------------------------------------------
// Built-in Roles
// ---------------------------------------------------------------------------

/**
 * Reading assistant role - helps understand and summarize text.
 * Designed for users who want to learn and take notes.
 */
export const READING_ASSISTANT_ROLE: AIRole = {
  id: "reading-assistant",
  name: "阅读助手",
  systemMessage: `你是一个专业的阅读助手。你的职责是帮助用户理解和记录阅读内容。

你需要：
1. 翻译文本，保留原文的语气和风格
2. 解释词典查询结果，提供词源和用法
3. 分析上下文，帮助理解文本含义
4. 生成简洁的总结，便于后续复习

不要添加开场白或寒暄，直接输出内容。不要输出'总结'或'笔记'等标题，直接输出笔记内容。`,
  userMessageTemplate: `## 待翻译文本
{selectedText}

## 词典查询结果
{dictionaryResults}

## 上下文
{context}

请直接输出适合记录笔记的总结内容，使用引用格式（>）组织。
不要输出标题，不要输出翻译、词汇分析、上下文分析等section。
直接输出最终的笔记总结。`,
  variables: [
    {
      name: "selectedText",
      description: "The text selected by the user",
      defaultValue: "",
      isRequired: true,
    },
    {
      name: "dictionaryResults",
      description: "Dictionary query results",
      defaultValue: "无词典查询结果",
      isRequired: false,
    },
    {
      name: "context",
      description: "Surrounding context",
      defaultValue: "无上下文",
      isRequired: false,
    },
  ],
  isDefault: true,
  isEnabled: true,
};

/**
 * Translator role - focused on accurate translation.
 * Designed for users who primarily need translation.
 */
export const TRANSLATOR_ROLE: AIRole = {
  id: "translator",
  name: "翻译助手",
  systemMessage: `你是一个专业的翻译助手。你的职责是提供准确、自然的翻译。

你需要：
1. 翻译文本，保留原文的语气和风格
2. 提供直译和意译两种版本
3. 解释翻译选择的原因

请用清晰的方式组织你的回答。`,
  userMessageTemplate: `## 待翻译文本
{selectedText}

## 词典查询结果
{dictionaryResults}

## 上下文
{context}

请提供：
1. **直译**：忠实于原文的翻译
2. **意译**：更自然的表达方式
3. **翻译说明**：解释翻译选择的原因`,
  variables: [
    {
      name: "selectedText",
      description: "The text selected by the user",
      defaultValue: "",
      isRequired: true,
    },
    {
      name: "dictionaryResults",
      description: "Dictionary query results",
      defaultValue: "无词典查询结果",
      isRequired: false,
    },
    {
      name: "context",
      description: "Surrounding context",
      defaultValue: "无上下文",
      isRequired: false,
    },
  ],
  isDefault: false,
  isEnabled: true,
};

/** All built-in roles. */
export const BUILTIN_ROLES: AIRole[] = [
  READING_ASSISTANT_ROLE,
  TRANSLATOR_ROLE,
];
