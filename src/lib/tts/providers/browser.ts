/**
 * Browser Speech Synthesis TTS provider.
 * Uses the Web Speech API (SpeechSynthesis) built into modern browsers.
 */

import type { SynthesizeRequest, SynthesizeResponse, TTSProvider, TTSVoice } from "../types";
import type { TTSService } from "../service";
import { TTSServiceError } from "../service";

// ---------------------------------------------------------------------------
// Browser Provider Implementation
// ---------------------------------------------------------------------------

/**
 * TTS provider using the browser's built-in SpeechSynthesis API.
 *
 * Note: Browser TTS plays audio directly through speakers.
 * It does not return raw audio data — the `SynthesizeResponse.audio`
 * field will be an empty ArrayBuffer.
 */
class BrowserProvider implements TTSService {
  private endCallbacks: Set<() => void> = new Set();

  /**
   * Synthesize text using browser SpeechSynthesis.
   *
   * Creates a `SpeechSynthesisUtterance` and speaks it immediately.
   * Since browser TTS plays directly, the returned audio buffer is empty.
   */
  async synthesize(
    request: SynthesizeRequest,
    _provider: TTSProvider
  ): Promise<SynthesizeResponse> {
    const synth = this.getSynth();

    const utterance = new SpeechSynthesisUtterance(request.text);
    utterance.addEventListener("end", () => this.notifyEnd());
    utterance.addEventListener("error", () => this.notifyEnd());

    // Apply voice if specified in options
    if (request.options?.pitch !== undefined) {
      utterance.pitch = request.options.pitch;
    }
    if (request.options?.speed !== undefined) {
      utterance.rate = request.options.speed;
    }

    // Find matching voice if provider has one configured
    const voices = synth.getVoices();
    const targetVoice = _provider.voice;
    if (targetVoice && targetVoice !== "default") {
      const matched = voices.find(
        (v) => v.voiceURI === targetVoice || v.name === targetVoice
      );
      if (matched) {
        utterance.voice = matched;
      }
    }

    // Speak the utterance
    synth.speak(utterance);

    // Browser TTS doesn't return audio data
    return {
      audio: new ArrayBuffer(0),
      format: undefined,
      duration: undefined,
    };
  }

  /**
   * Test if browser SpeechSynthesis is available.
   */
  async testConnection(_provider: TTSProvider): Promise<boolean> {
    try {
      return typeof window !== "undefined" && "speechSynthesis" in window;
    } catch {
      return false;
    }
  }

  /**
   * Get available voices from the browser.
   *
   * Note: `getVoices()` may return an empty array on first call.
   * Voices populate asynchronously in some browsers.
   * The caller should retry if the array is empty.
   */
  async getVoices(_provider: TTSProvider): Promise<TTSVoice[]> {
    const synth = this.getSynth();
    const browserVoices = synth.getVoices();

    if (browserVoices.length === 0) {
      throw new TTSServiceError(
        "PROVIDER_ERROR",
        "浏览器语音列表为空，请稍后重试（语音可能正在加载中）"
      );
    }

    return browserVoices.map((v) => ({
      id: v.voiceURI,
      name: v.name,
      language: v.lang,
      gender: "neutral" as const,
    }));
  }

  /**
   * Stop current playback.
   */
  stopPlayback(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Subscribe to browser utterance completion.
   */
  onEnd(callback: () => void): () => void {
    this.endCallbacks.add(callback);
    return () => {
      this.endCallbacks.delete(callback);
    };
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  /**
   * Get the SpeechSynthesis instance or throw if unavailable.
   */
  private getSynth(): SpeechSynthesis {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      throw new TTSServiceError(
        "PROVIDER_ERROR",
        "当前环境不支持浏览器语音合成"
      );
    }
    return window.speechSynthesis;
  }

  private notifyEnd(): void {
    for (const callback of this.endCallbacks) {
      callback();
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton Export
// ---------------------------------------------------------------------------

/** Singleton instance of the browser TTS provider. */
export const browserProvider = new BrowserProvider();
