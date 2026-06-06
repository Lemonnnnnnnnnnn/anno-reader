import type { AIConfig, AIProvider, AIRole, PromptVariable } from "./types";
import type { TranslationRequest, TranslationResponse, StreamingTranslationResponse } from "./service";
import { AIServiceError } from "./service";
import { OpenAIProvider } from "./providers/openai";
import { getContext } from "./context";
import { TranslationCache } from "./cache";
import type { DictionaryAggregator } from "@/lib/dictionaries";

/**
 * Core translation service that orchestrates context extraction,
 * prompt rendering, and provider API calls.
 *
 * Singleton instance exported as `translationService`.
 */
class TranslationService {
  private provider: OpenAIProvider;
  private cache: TranslationCache;
  private dictionaryAggregator: DictionaryAggregator | null = null;
  private dictionaryAggregatorPromise: Promise<DictionaryAggregator> | null = null;

  constructor() {
    this.provider = new OpenAIProvider();
    this.cache = new TranslationCache();
  }

  /**
   * Lazy-initialize the DictionaryAggregator.
   * Uses dynamic import to avoid circular dependencies.
   * Caches the promise so multiple calls share the same initialization.
   */
  private async getDictionaryAggregator(): Promise<DictionaryAggregator> {
    if (this.dictionaryAggregator) {
      return this.dictionaryAggregator;
    }

    if (!this.dictionaryAggregatorPromise) {
      this.dictionaryAggregatorPromise = (async () => {
        const { createDefaultAggregator } = await import(
          "@/lib/dictionaries"
        );
        const aggregator = await createDefaultAggregator();
        this.dictionaryAggregator = aggregator;
        this.dictionaryAggregatorPromise = null;
        return aggregator;
      })();
    }

    return this.dictionaryAggregatorPromise;
  }

  /**
   * Translate text with streaming response.
   *
   * Orchestrates cache check → provider/role/context resolution → provider streaming call.
   * Does NOT cache streaming results (caller should cache on completion).
   *
   * @param text - The text to translate
   * @param targetLanguage - Target language (e.g., "Chinese")
   * @param config - AI configuration with provider and prompt settings
   * @param options - Optional abort signal and error callback
   * @param chapterText - Plain text content of the current chapter
   * @returns Streaming response with textStream and provider info
   */
  async translateStream(
    text: string,
    targetLanguage: string,
    config: AIConfig,
    options?: { abortSignal?: AbortSignal; onError?: (error: Error) => void },
    chapterText?: string,
    offset?: number,
    selectionSentence?: string,
    selectionParagraph?: string,
  ): Promise<StreamingTranslationResponse> {
    // 1. Check cache — wrap as single-yield AsyncIterable if hit
    const cached = this.cache.get(text, targetLanguage);
    if (cached) {
      const cachedText = cached.translation;
      return {
        textStream: (async function* () { yield cachedText; })(),
        provider: cached.provider,
      };
    }

    // 2. Get selected provider
    const provider = this.getSelectedProvider(config);
    if (!provider) {
      throw new AIServiceError("UNKNOWN_ERROR", "No AI provider configured");
    }

    // 3. Get selected role
    const role = this.getSelectedRole(config);
    if (!role) {
      throw new AIServiceError("UNKNOWN_ERROR", "No AI role configured");
    }

    // 4. Get dictionary aggregator if needed
    const hasDictionaryModule = config.contextConfig.modules.some(
      (m) => m.type === "dictionary" && m.isEnabled,
    );
    let dictionaryAggregator: DictionaryAggregator | null = null;
    if (hasDictionaryModule) {
      try {
        dictionaryAggregator = await this.getDictionaryAggregator();
      } catch (error) {
        console.warn("[TranslationService] Dictionary aggregator init failed:", error);
      }
    }

    // 5. Get context using pure function
    const contextData = await getContext(
      text,
      chapterText ?? null,
      config.contextConfig.modules,
      dictionaryAggregator,
      offset,
      selectionSentence,
    );

    // 6. Build messages using role
    const { systemMessage, userMessage } = this.buildMessagesWithContext(
      role,
      text,
      contextData.dictionaryText || "",
      contextData.text,
    );

    // 7. Build request and call provider streaming
    const request: TranslationRequest = {
      text,
      context: contextData.text,
      targetLanguage,
      systemMessage,
      userMessage,
    };

    const result = await this.provider.translateStream(request, provider, options);
    return result;
  }

  /**
   * Cache a streaming translation result after stream completion.
   * Called by the hook after accumulating the full translation text.
   */
  cacheTranslation(
    text: string,
    targetLanguage: string,
    translation: string,
    provider: AIProvider,
  ): void {
    const response: TranslationResponse = {
      translation,
      originalText: text,
      provider,
      cached: false,
    };
    this.cache.set(text, targetLanguage, response);
  }

  private getSelectedProvider(config: AIConfig): AIProvider | undefined {
    if (!config.selectedProviderId) return undefined;
    return config.providers.find(
      (p) => p.id === config.selectedProviderId && p.enabled,
    );
  }

  private getSelectedRole(config: AIConfig): AIRole | undefined {
    if (!config.selectedRoleId) return undefined;
    return config.roles.find((r) => r.id === config.selectedRoleId && r.isEnabled);
  }

  /**
   * Build system and user messages using a role template with context data.
   * Simple string replacement for {variable} placeholders.
   */
  private buildMessagesWithContext(
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

    // Simple template replacement
    let userMessage = role.userMessageTemplate;
    for (const variable of role.variables) {
      const value = values[variable.name] ?? variable.defaultValue;
      userMessage = userMessage.replace(new RegExp(`\\{${variable.name}\\}`, "g"), value);
    }

    return {
      systemMessage: role.systemMessage,
      userMessage,
    };
  }
}

/** Singleton translation service instance. */
export const translationService = new TranslationService();
