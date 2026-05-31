import type { AIConfig, AIProvider, AIRole } from "./types";
import type { TranslationRequest, TranslationResponse, PreviewData } from "./service";
import { AIServiceError } from "./service";
import { OpenAIProvider } from "./providers/openai";
import { ContextService } from "./context";
import { RoleService } from "./role";
import { TranslationCache } from "./cache";
import type { DictionaryAggregator } from "@/lib/dictionaries";

/**
 * Core translation service that orchestrates context extraction,
 * prompt rendering, and provider API calls.
 */
export class TranslationService {
  private provider: OpenAIProvider;
  private roleService: RoleService;
  private cache: TranslationCache;
  private dictionaryAggregator: DictionaryAggregator | null = null;
  private dictionaryAggregatorPromise: Promise<DictionaryAggregator> | null =
    null;

  constructor() {
    this.provider = new OpenAIProvider();
    this.roleService = new RoleService();
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
    const { systemMessage, userMessage } = this.roleService.buildMessagesWithContext(
      role,
      text,
      contextData.debug?.dictionary?.results?.map(r => JSON.stringify(r)).join("\n") || "",
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
    const { systemMessage, userMessage } = this.roleService.buildMessagesWithContext(
      role,
      text,
      contextData.debug?.dictionary?.results?.map(r => JSON.stringify(r)).join("\n") || "",
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
}
