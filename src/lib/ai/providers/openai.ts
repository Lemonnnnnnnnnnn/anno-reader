import type { AIProvider } from "../types";
import type {
  AITranslationService,
  TranslationRequest,
  TranslationResponse,
} from "../service";
import { AIServiceError } from "../service";

/**
 * OpenAI-compatible provider for AI translation.
 * Works with OpenAI API and any compatible API (DeepSeek, etc.)
 */
export class OpenAIProvider implements AITranslationService {
  async translate(
    request: TranslationRequest,
    provider: AIProvider
  ): Promise<TranslationResponse> {
    const { text, systemMessage, userMessage } = request;

    try {
      const response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: userMessage },
          ],
          max_tokens: provider.maxTokens,
          temperature: provider.temperature,
        }),
      });

      if (!response.ok) {
        await this.handleApiError(response);
      }

      const data = await response.json();
      const translation = data.choices?.[0]?.message?.content?.trim() ?? "";

      if (!translation) {
        throw new AIServiceError("API_ERROR", "Empty translation response");
      }

      return {
        translation,
        originalText: text,
        provider,
        cached: false,
      };
    } catch (error) {
      if (error instanceof AIServiceError) throw error;

      // Network or other errors
      throw new AIServiceError(
        "NETWORK_ERROR",
        `Failed to connect to provider: ${error instanceof Error ? error.message : "Unknown error"}`,
        true
      );
    }
  }

  async testConnection(provider: AIProvider): Promise<boolean> {
    try {
      const response = await fetch(`${provider.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async handleApiError(response: Response): Promise<never> {
    const status = response.status;

    if (status === 401 || status === 403) {
      throw new AIServiceError(
        "AUTH_ERROR",
        "Invalid API key or unauthorized access"
      );
    }
    if (status === 429) {
      throw new AIServiceError("RATE_LIMITED", "Rate limit exceeded", true);
    }
    if (status >= 500) {
      throw new AIServiceError(
        "API_ERROR",
        `Server error: ${status}`,
        true
      );
    }

    const body = await response.text().catch(() => "Unknown error");
    throw new AIServiceError("API_ERROR", `API error ${status}: ${body}`);
  }
}
