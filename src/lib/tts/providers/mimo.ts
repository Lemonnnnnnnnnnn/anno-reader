/**
 * MiMo TTS provider implementation.
 * Uses the MiMo API for text-to-speech synthesis.
 */

import type { TTSProvider, TTSVoice, SynthesizeRequest, SynthesizeResponse } from "../types";
import type { TTSService } from "../service";
import { TTSServiceError } from "../service";
import { classifyError } from "../error-handler";
import { MIMO_VOICES } from "../constants";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIMO_API_URL = "https://api.xiaomimimo.com/v1/chat/completions";
const DEFAULT_MODEL = "mimo-v2.5-tts";

// ---------------------------------------------------------------------------
// Helper: base64 → ArrayBuffer
// ---------------------------------------------------------------------------

/**
 * Decode a base64 string into an ArrayBuffer.
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// ---------------------------------------------------------------------------
// MiMo TTS Provider
// ---------------------------------------------------------------------------

/**
 * MiMo TTS provider.
 * Synthesizes speech via the MiMo chat completions API with audio output.
 */
export class MiMoProvider implements TTSService {
  async synthesize(
    request: SynthesizeRequest,
    provider: TTSProvider,
  ): Promise<SynthesizeResponse> {
    try {
      const response = await fetch(MIMO_API_URL, {
        method: "POST",
        headers: {
          "api-key": provider.apiKey ?? "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: provider.model || DEFAULT_MODEL,
          messages: [{ role: "assistant", content: request.text }],
          audio: {
            format: "wav",
            voice: provider.voice,
          },
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 401 || status === 403) {
          throw new TTSServiceError("AUTH_ERROR", `Authentication failed: ${status}`);
        }
        if (status === 429) {
          throw new TTSServiceError("RATE_LIMITED", "Rate limited by MiMo API", true);
        }
        if (status >= 500) {
          throw new TTSServiceError("PROVIDER_ERROR", `MiMo API error: ${status}`, true);
        }
        throw new TTSServiceError("PROVIDER_ERROR", `MiMo API error: ${status}`);
      }

      const data = await response.json();
      const audioBase64 = data.choices?.[0]?.message?.audio;

      if (!audioBase64) {
        throw new TTSServiceError("PROVIDER_ERROR", "No audio data in MiMo response");
      }

      return {
        audio: base64ToArrayBuffer(audioBase64),
        format: "wav",
      };
    } catch (error) {
      if (error instanceof TTSServiceError) {
        throw error;
      }
      throw classifyError(error);
    }
  }

  async testConnection(provider: TTSProvider): Promise<boolean> {
    try {
      await this.synthesize({ text: "test", provider }, provider);
      return true;
    } catch {
      return false;
    }
  }

  async getVoices(_provider: TTSProvider): Promise<TTSVoice[]> {
    return MIMO_VOICES;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/** Shared MiMo provider instance. */
export const mimoProvider = new MiMoProvider();
