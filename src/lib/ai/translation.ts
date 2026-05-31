import type { AIConfig, AIProvider } from "./types";
import type { TranslationRequest, TranslationResponse } from "./service";
import { AIServiceError } from "./service";
import { OpenAIProvider } from "./providers/openai";
import { ContextService } from "./context";
import { PromptService } from "./prompts";
import { TranslationCache } from "./cache";

/**
 * Core translation service that orchestrates context extraction,
 * prompt rendering, and provider API calls.
 */
export class TranslationService {
  private provider: OpenAIProvider;
  private contextService: ContextService;
  private promptService: PromptService;
  private cache: TranslationCache;

  constructor() {
    this.provider = new OpenAIProvider();
    this.contextService = new ContextService();
    this.promptService = new PromptService();
    this.cache = new TranslationCache();
  }

  /**
   * Translate text using the configured AI provider.
   *
   * @param text - The text to translate
   * @param fullContext - The full chapter text for context extraction
   * @param targetLanguage - Target language (e.g., "Chinese")
   * @param config - AI configuration with provider and prompt settings
   * @returns Translation response with the translated text
   */
  async translate(
    text: string,
    fullContext: string,
    targetLanguage: string,
    config: AIConfig,
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

    // Extract context
    const contextData = this.contextService.getContext(
      text,
      fullContext,
      config.contextConfig.modules,
    );

    // Get and render prompt
    const prompt = this.promptService.getDefaultPrompt(config.prompts);
    if (!prompt) {
      throw new AIServiceError("UNKNOWN_ERROR", "No prompt template configured");
    }

    const renderedPrompt = this.promptService.renderPrompt(
      prompt.content,
      prompt.variables,
      {
        selectedText: text,
        context: contextData.text,
        targetLanguage,
      },
    );

    // Build translation request
    const request: TranslationRequest = {
      text,
      context: contextData.text,
      targetLanguage,
      promptId: prompt.id,
    };

    // Call provider
    const response = await this.provider.translate(request, provider);

    // Store in cache
    this.cache.set(text, targetLanguage, response);

    return response;
  }

  /**
   * Translate with automatic retry on transient failures.
   */
  async translateWithRetry(
    text: string,
    fullContext: string,
    targetLanguage: string,
    config: AIConfig,
    maxRetries = 3,
  ): Promise<TranslationResponse> {
    let lastError: AIServiceError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.translate(text, fullContext, targetLanguage, config);
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

  private getSelectedProvider(config: AIConfig): AIProvider | undefined {
    if (!config.selectedProviderId) return undefined;
    return config.providers.find(
      (p) => p.id === config.selectedProviderId && p.enabled,
    );
  }
}
