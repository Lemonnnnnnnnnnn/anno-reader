/**
 * TTS Synthesizer — orchestrator singleton.
 *
 * Manages playback for text-to-speech using the browser's SpeechSynthesis API.
 */

import { useTTSConfigStore } from "@/stores/useTTSConfigStore";
import { browserProvider } from "./providers/browser";
import type { SynthesizeRequest } from "./types";

// ---------------------------------------------------------------------------
// TTS Synthesizer
// ---------------------------------------------------------------------------

/**
 * Orchestrates TTS synthesis and playback via browser SpeechSynthesis.
 */
class TTSSynthesizer {
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
   * Synthesize text and play it via browser SpeechSynthesis.
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

    const request: SynthesizeRequest = { text, provider };

    this.clearBrowserEndSubscription();
    this.speaking = true;
    this.unsubscribeBrowserEnd = browserProvider.onEnd(() => {
      this.speaking = false;
      this.clearBrowserEndSubscription();
      this.notifyEnd();
    });
    try {
      await browserProvider.synthesize(request, provider);
    } catch (err) {
      this.speaking = false;
      this.clearBrowserEndSubscription();
      throw err;
    }
  }

  /**
   * Stop any in-progress playback.
   */
  stopPlayback(): void {
    const wasSpeaking = this.speaking || this.isBrowserSpeaking();
    this.clearBrowserEndSubscription();

    browserProvider.stopPlayback();

    this.speaking = false;
    if (wasSpeaking) {
      this.notifyEnd();
    }
  }

  /**
   * Whether the synthesizer is currently speaking.
   */
  isSpeaking(): boolean {
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
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/** Shared TTS synthesizer instance. */
export const ttsSynthesizer = new TTSSynthesizer();
