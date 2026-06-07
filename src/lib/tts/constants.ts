/**
 * Constants for the Text-to-Speech module.
 * Built-in provider definitions and default configuration.
 */

import type { TTSProvider, TTSVoice, TTSConfig } from "./types";

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
// MiMo TTS Voices
// ---------------------------------------------------------------------------

/** Available MiMo TTS voices for the built-in provider. */
export const MIMO_VOICES: TTSVoice[] = [
  { id: "mimo_default", name: "MiMo默认", language: "zh-CN", gender: "female" },
  { id: "冰糖", name: "冰糖", language: "zh-CN", gender: "female" },
  { id: "茉莉", name: "茉莉", language: "zh-CN", gender: "female" },
  { id: "苏打", name: "苏打", language: "zh-CN", gender: "male" },
  { id: "白桦", name: "白桦", language: "zh-CN", gender: "male" },
  { id: "Mia", name: "Mia", language: "en-US", gender: "female" },
  { id: "Chloe", name: "Chloe", language: "en-US", gender: "female" },
  { id: "Milo", name: "Milo", language: "en-US", gender: "male" },
  { id: "Dean", name: "Dean", language: "en-US", gender: "male" },
];

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

/** Default TTS configuration used when no persisted config exists. */
export const DEFAULT_CONFIG: TTSConfig = {
  providers: [BROWSER_PROVIDER],
  selectedProviderId: "browser-speech",
};
