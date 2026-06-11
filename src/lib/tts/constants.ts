/**
 * Constants for the Text-to-Speech module.
 * Built-in provider definitions and default configuration.
 */

import type { TTSProvider, TTSConfig } from "./types";

// ---------------------------------------------------------------------------
// Built-in Providers
// ---------------------------------------------------------------------------

/**
 * Browser Speech Synthesis provider.
 * Uses the Web Speech API (SpeechSynthesis) built into Chromium.
 */
export const BROWSER_PROVIDER: TTSProvider = {
  type: "browser",
  id: "browser-speech",
  name: "浏览器语音合成",
  voice: "default",
  enabled: true,
};

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

/** Default TTS configuration used when no persisted config exists. */
export const DEFAULT_CONFIG: TTSConfig = {
  providers: [BROWSER_PROVIDER],
  selectedProviderId: "browser-speech",
};
