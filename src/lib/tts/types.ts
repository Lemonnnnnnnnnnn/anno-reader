/**
 * Types for the Text-to-Speech module.
 */

// ---------------------------------------------------------------------------
// Provider Types
// ---------------------------------------------------------------------------

/** Supported TTS provider types. */
export type TTSProviderType = "mimo" | "browser";

/**
 * Configuration for a single TTS provider.
 * Stores connection details and voice settings.
 */
export interface TTSProvider {
  /** Unique provider identifier */
  id: string;
  /** Human-readable provider name */
  name: string;
  /** Provider backend type */
  type: TTSProviderType;
  /** API base URL (optional, for remote providers) */
  baseUrl?: string;
  /** API key for authentication (optional, for remote providers) */
  apiKey?: string;
  /** Model identifier (optional, for providers that support model selection) */
  model?: string;
  /** Default voice for this provider */
  voice: string;
  /** Default language code (e.g. "en", "zh") */
  language?: string;
  /** Whether this provider is active */
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Voice Types
// ---------------------------------------------------------------------------

/**
 * A single voice available from a TTS provider.
 */
export interface TTSVoice {
  /** Voice identifier used in synthesis requests */
  id: string;
  /** Human-readable voice name */
  name: string;
  /** Language code (e.g. "en", "zh") */
  language: string;
  /** Voice gender */
  gender: "male" | "female" | "neutral";
}

// ---------------------------------------------------------------------------
// Config Types
// ---------------------------------------------------------------------------

/**
 * Root configuration object for the TTS feature.
 * Persisted as a JSON file in the app's data directory.
 */
export interface TTSConfig {
  /** All configured TTS providers */
  providers: TTSProvider[];
  /** ID of the currently active provider */
  selectedProviderId: string | null;
}

// ---------------------------------------------------------------------------
// Synthesis Types
// ---------------------------------------------------------------------------

/**
 * Options for a single synthesis request.
 */
export interface SynthesizeOptions {
  /** Playback speed multiplier (0.5 – 2.0) */
  speed?: number;
  /** Pitch adjustment in semitones (-12 – 12) */
  pitch?: number;
  /** Volume gain in dB (-10 – 10) */
  volume?: number;
}

/**
 * Request to synthesize text into audio.
 */
export interface SynthesizeRequest {
  /** Text to synthesize */
  text: string;
  /** Provider to use for synthesis */
  provider: TTSProvider;
  /** Optional synthesis options */
  options?: SynthesizeOptions;
}

/**
 * Response from a synthesis request.
 */
export interface SynthesizeResponse {
  /** Raw audio data as ArrayBuffer */
  audio: ArrayBuffer;
  /** Duration in seconds (if known) */
  duration?: number;
  /** Audio format (e.g. "mp3", "wav", "ogg") */
  format?: string;
}
