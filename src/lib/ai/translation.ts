import type { AIConfig, AIProvider, AIRole, PromptVariable } from "./types";
import type { TranslationRequest, TranslationResponse, StreamingTranslationResponse, PreviewData } from "./service";
import { AIServiceError } from "./service";
import { OpenAIProvider } from "./providers/openai";
import { ContextService } from "./context";
import { TranslationCache } from "./cache";
import type { DictionaryAggregator } from "@/lib/dictionaries";

/**
 * Core translation service that orchestrates context extraction,
 * prompt rendering, and provider API calls.
 */
export class TranslationService {
  private provider: OpenAIProvider;
  private cache: TranslationCache;
  private dictionaryAggregator: DictionaryAggregator | null = null;
  private dictionaryAggregatorPromise: Promise<DictionaryAggregator> | null =
    null;

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
   * Translate text using the configured AI provider.
   *
   * @param text - The text to translate
   * @param targetLanguage - Target language (e.g., "Chinese")
   * @param config - AI configuration with provider and prompt settings
   * @param chapterText - Plain text content of the current chapter (null if unavailable)
   * @returns Translation response with the translated text
   */
  async translate(
    text: string,
    targetLanguage: string,
    config: AIConfig,
    chapterText: string | null = null,
  ): Promise<TranslationResponse> {
    // Check cache first
    const cached = this.cache.get(text, targetLanguage);
    if (cached) {
      return { ...cached, cached: true };
    }

    // Get selected provider
    const provider = this.getSelectedProvider(config);
    if (!provider) {
      throw new AIServiceError("UNKNOWN_ERROR", "No AI provider configured");
    }

    // Get selected role
    const role = this.getSelectedRole(config);
    if (!role) {
      throw new AIServiceError("UNKNOWN_ERROR", "No AI role configured");
    }

    // Initialize dictionary aggregator (if needed) and create context service
    const contextService = await this.getContextService(config);

    // Extract context
    const contextData = await contextService.getContext(
      text,
      chapterText,
      config.contextConfig.modules,
    );

    // Build messages using role
    const { systemMessage, userMessage } = this.buildMessagesWithContext(
      role,
      text,
      contextData.dictionaryText || "",
      contextData.text,
    );

    // Build translation request
    const request: TranslationRequest = {
      text,
      context: contextData.text,
      targetLanguage,
      systemMessage,
      userMessage,
    };

    // Call provider
    const response = await this.provider.translate(request, provider);

    // Store in cache
    this.cache.set(text, targetLanguage, response);

    return response;
  }

  /**
   * Translate text with streaming response.
   *
   * Orchestrates cache check → provider/role/context resolution → provider streaming call.
   * Does NOT cache streaming results (caller should cache on completion).
   * Does NOT retry (stream already started cannot be retried).
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

    // 4. Get context
    const contextService = await this.getContextService(config);
    const contextData = await contextService.getContext(
      text,
      chapterText ?? null,
      config.contextConfig.modules,
    );

    // 5. Build messages
    const { systemMessage, userMessage } = this.buildMessagesWithContext(
      role,
      text,
      contextData.dictionaryText || "",
      contextData.text,
    );

    // 6. Build request and call provider streaming
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

  /**
   * Get preview data without sending to LLM.
   * Shows dictionary results, context, and rendered prompt for debugging.
   *
   * @param text - The text to translate
   * @param targetLanguage - Target language (e.g., "Chinese")
   * @param config - AI configuration with provider and prompt settings
   * @param chapterText - Plain text content of the current chapter (null if unavailable)
   * @returns Preview data with context and prompt information
   */
  async previewTranslate(
    text: string,
    targetLanguage: string,
    config: AIConfig,
    chapterText: string | null = null,
  ): Promise<PreviewData> {
    // Get selected provider
    const provider = this.getSelectedProvider(config);
    if (!provider) {
      throw new AIServiceError("UNKNOWN_ERROR", "No AI provider configured");
    }

    // Get selected role
    const role = this.getSelectedRole(config);
    if (!role) {
      throw new AIServiceError("UNKNOWN_ERROR", "No AI role configured");
    }

    // Initialize dictionary aggregator (if needed) and create context service
    const contextService = await this.getContextService(config);

    // Extract context with debug info
    const contextData = await contextService.getContext(
      text,
      chapterText,
      config.contextConfig.modules,
      true, // includeDebug
    );

    // Build messages using role
    const { systemMessage, userMessage } = this.buildMessagesWithContext(
      role,
      text,
      contextData.dictionaryText || "",
      contextData.text,
    );

    // Get enabled module names
    const enabledModules = config.contextConfig.modules.filter((m) => m.isEnabled);
    const contextSources = enabledModules.map((m) => m.name);

    return {
      selectedText: text,
      targetLanguage,
      renderedPrompt: "", // No longer used - kept for interface compatibility
      systemMessage,
      userMessage,
      dictionary: contextData.debug?.dictionary,
      contextSources,
      sentenceContext: contextData.debug?.sentenceContext,
    };
  }

  /**
   * Translate with automatic retry on transient failures.
   */
  async translateWithRetry(
    text: string,
    targetLanguage: string,
    config: AIConfig,
    maxRetries = 3,
    chapterText: string | null = null,
  ): Promise<TranslationResponse> {
    let lastError: AIServiceError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.translate(text, targetLanguage, config, chapterText);
      } catch (error) {
        if (error instanceof AIServiceError) {
          lastError = error;
          if (!error.retryable || attempt === maxRetries) {
            throw error;
          }
          // Exponential backoff: 100ms, 200ms, 400ms
          await new Promise((resolve) =>
            setTimeout(resolve, 100 * Math.pow(2, attempt)),
          );
        } else {
          throw error;
        }
      }
    }

    throw lastError;
  }

  /**
   * Create a ContextService with the dictionary aggregator if any
   * dictionary modules are enabled.
   *
   * @param config - AI configuration
   * @returns Configured ContextService
   */
  private async getContextService(config: AIConfig): Promise<ContextService> {
    const hasDictionaryModule = config.contextConfig.modules.some(
      (m) => m.type === "dictionary" && m.isEnabled,
    );

    if (!hasDictionaryModule) {
      return new ContextService();
    }

    try {
      const aggregator = await this.getDictionaryAggregator();
      return new ContextService(aggregator);
    } catch (error) {
      // Graceful degradation: if aggregator creation fails, continue without
      console.warn(
        "[TranslationService] Dictionary aggregator initialization failed:",
        error,
      );
      return new ContextService();
    }
  }

  private getSelectedProvider(config: AIConfig): AIProvider | undefined {
    if (!config.selectedProviderId) return undefined;
    return config.providers.find(
      (p) => p.id === config.selectedProviderId && p.enabled,
    );
  }

  /**
   * Get the selected role from config.
   *
   * @param config - AI configuration
   * @returns The selected role or undefined if not found
   */
  private getSelectedRole(config: AIConfig): AIRole | undefined {
    if (!config.selectedRoleId) return undefined;
    return config.roles.find((r) => r.id === config.selectedRoleId && r.isEnabled);
  }

  /**
   * Render a prompt template by replacing {variable} placeholders.
   * Inlined from PromptService to reduce module count.
   */
  private renderPrompt(
    template: string,
    variables: PromptVariable[],
    values: Record<string, string>,
  ): string {
    let rendered = template;
    for (const variable of variables) {
      const value = values[variable.name] ?? variable.defaultValue;
      rendered = rendered.replace(new RegExp(`\\{${variable.name}\\}`, "g"), value);
    }
    return rendered;
  }

  /**
   * Build system and user messages using a role template with context data.
   * Inlined from RoleService to reduce module count.
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
    return {
      systemMessage: role.systemMessage,
      userMessage: this.renderPrompt(role.userMessageTemplate, role.variables, values),
    };
  }
}
