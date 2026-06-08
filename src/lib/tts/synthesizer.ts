/**
 * TTS Synthesizer — orchestrator singleton.
 *
 * Manages provider selection and playback for text-to-speech.
 * Delegates synthesis to the active provider, then plays audio
 * through the appropriate channel (Audio element or SpeechSynthesis).
 */

import { useTTSConfigStore } from "@/stores/useTTSConfigStore";
import { mimoProvider } from "./providers/mimo";
import { browserProvider } from "./providers/browser";
import type { TTSProviderType, SynthesizeRequest } from "./types";
import type { TTSService } from "./service";

// ---------------------------------------------------------------------------
// TTS Synthesizer
// ---------------------------------------------------------------------------

/**
 * Orchestrates TTS synthesis and playback.
 *
 * Provider dispatch:
 * - "browser" → plays via SpeechSynthesis (provider handles playback directly)
 * - "mimo" (and future API providers) → plays via HTMLAudioElement
 */
class TTSSynthesizer {
  /** Map of provider type → service implementation. */
  private providers: Map<TTSProviderType, TTSService> = new Map([
    ["mimo", mimoProvider],
    ["browser", browserProvider],
  ]);

  /** Current Audio element for API-based providers (null when idle). */
  private audioElement: HTMLAudioElement | null = null;

  /** Whether a synthesis + playback cycle is active. */
  private speaking = false;

  /** Callbacks invoked when playback ends (naturally or via stop). */
  private endCallbacks: Set<() => void> = new Set();

  /** Unsubscribe function for the active browser SpeechSynthesis utterance. */
  private unsubscribeBrowserEnd: (() => void) | null = null;

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Synthesize text and play it.
   *
   * 1. Reads the selected provider from the config store.
   * 2. Dispatches to the matching TTSService.
   * 3. Plays audio — either via SpeechSynthesis (browser) or Audio element (API).
   *
   * @param text  The text to speak.
   */
  async synthesize(text: string): Promise<void> {
    const { config } = useTTSConfigStore.getState();
    const provider = config.providers.find(
      (p) => p.id === config.selectedProviderId,
    );

    if (!provider) {
      throw new Error("No TTS provider selected");
    }

    const service = this.getProviderInstance(provider.type);

    const request: SynthesizeRequest = { text, provider };

    if (provider.type === "browser") {
      this.clearBrowserEndSubscription();
      this.speaking = true;
      this.unsubscribeBrowserEnd = browserProvider.onEnd(() => {
        this.speaking = false;
        this.clearBrowserEndSubscription();
        this.notifyEnd();
      });
      try {
        await service.synthesize(request, provider);
      } catch (err) {
        this.speaking = false;
        this.clearBrowserEndSubscription();
        throw err;
      }
      return;
    }

    const response = await service.synthesize(request, provider);

    // API providers return raw audio — play via Audio element.
    await this.playAudioBuffer(response.audio, response.format);
  }

  /**
   * Stop any in-progress playback.
   *
   * Browser: cancels SpeechSynthesis.
   * API providers: pauses and tears down the Audio element.
   */
  stopPlayback(): void {
    const wasSpeaking = this.speaking || this.audioElement !== null || this.isBrowserSpeaking();
    this.clearBrowserEndSubscription();

    // Stop browser speech if active.
    browserProvider.stopPlayback();

    // Stop Audio element if active.
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.audioElement.src = "";
      this.audioElement = null;
    }

    this.speaking = false;
    if (wasSpeaking) {
      this.notifyEnd();
    }
  }

  /**
   * Whether the synthesizer is currently speaking.
   */
  isSpeaking(): boolean {
    // Also check live SpeechSynthesis state for the browser provider.
    if (this.isBrowserSpeaking()) {
      return true;
    }
    return this.speaking;
  }

  /**
   * Subscribe to playback end events.
   *
   * @param callback  Function called when playback ends.
   * @returns An unsubscribe function.
   */
  onEnd(callback: () => void): () => void {
    this.endCallbacks.add(callback);
    return () => {
      this.endCallbacks.delete(callback);
    };
  }

  // -----------------------------------------------------------------------
  // Private Helpers
  // -----------------------------------------------------------------------

  /** Notify all registered end callbacks. */
  private notifyEnd(): void {
    for (const cb of this.endCallbacks) {
      cb();
    }
  }

  private clearBrowserEndSubscription(): void {
    this.unsubscribeBrowserEnd?.();
    this.unsubscribeBrowserEnd = null;
  }

  private isBrowserSpeaking(): boolean {
    return (
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      window.speechSynthesis.speaking
    );
  }

  /**
   * Look up a TTSService by provider type.
   *
   * @param type  The provider type string (e.g. "mimo", "browser").
   * @throws If no service is registered for the given type.
   */
  private getProviderInstance(type: TTSProviderType): TTSService {
    const service = this.providers.get(type);
    if (!service) {
      throw new Error(`No TTS service registered for provider type: ${type}`);
    }
    return service;
  }

  /**
   * Play an audio buffer through an HTMLAudioElement.
   *
   * Creates a Blob URL from the ArrayBuffer, attaches it to an Audio
   * element, and plays. Cleans up the URL when playback finishes.
   *
   * @param audio   Raw audio data.
   * @param format  Audio MIME subtype (e.g. "wav", "mp3"). Defaults to "wav".
   */
  private async playAudioBuffer(
    audio: ArrayBuffer,
    format?: string,
  ): Promise<void> {
    // Tear down any previous Audio element.
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = "";
    }

    const mime = `audio/${format ?? "wav"}`;
    const blob = new Blob([audio], { type: mime });
    const url = URL.createObjectURL(blob);

    const audioEl = new Audio(url);
    this.audioElement = audioEl;
    this.speaking = true;

    audioEl.addEventListener("ended", () => {
      this.speaking = false;
      this.audioElement = null;
      URL.revokeObjectURL(url);
      this.notifyEnd();
    });

    audioEl.addEventListener("error", () => {
      this.speaking = false;
      this.audioElement = null;
      URL.revokeObjectURL(url);
      this.notifyEnd();
    });

    await audioEl.play();
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/** Shared TTS synthesizer instance. */
export const ttsSynthesizer = new TTSSynthesizer();
