import type { SynthesizeRequest, SynthesizeResponse, TTSProvider, TTSVoice } from "./types";

/**
 * Error codes for TTS service failures.
 */
export type TTSErrorCode =
  | "NETWORK_ERROR"
  | "AUTH_ERROR"
  | "PROVIDER_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "UNKNOWN_ERROR";

/**
 * Structured error from TTS service operations.
 */
export class TTSServiceError extends Error {
  code: TTSErrorCode;
  retryable: boolean;

  constructor(code: TTSErrorCode, message: string, retryable = false) {
    super(message);
    this.name = "TTSServiceError";
    this.code = code;
    this.retryable = retryable;
  }
}

/**
 * Interface for TTS service implementations.
 * Each provider (browser, remote API) implements this interface.
 */
export interface TTSService {
  /** Synthesize text into audio */
  synthesize(
    request: SynthesizeRequest,
    provider: TTSProvider
  ): Promise<SynthesizeResponse>;

  /** Test if a provider configuration is valid */
  testConnection(provider: TTSProvider): Promise<boolean>;

  /** List available voices for a provider */
  getVoices(provider: TTSProvider): Promise<TTSVoice[]>;
}
