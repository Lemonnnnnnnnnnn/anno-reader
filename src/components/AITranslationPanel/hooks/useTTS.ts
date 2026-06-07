/**
 * TTS hook for AITranslationPanel.
 *
 * Handles:
 * - Speak/stop toggle behavior
 * - Speaking state tracking
 * - Auto-stop on unmount
 */

import { useState, useEffect, useCallback } from "react";
import { ttsSynthesizer } from "@/lib/tts/synthesizer";

export function useTTS(text: string) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const stop = useCallback(() => {
    ttsSynthesizer.stopPlayback();
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(async () => {
    if (isSpeaking) {
      stop();
      return;
    }

    try {
      setIsSpeaking(true);
      await ttsSynthesizer.synthesize(text);
    } catch (err) {
      console.error("TTS speak error:", err);
      setIsSpeaking(false);
    }
  }, [text, isSpeaking, stop]);

  // Auto-stop on unmount
  useEffect(() => () => ttsSynthesizer.stopPlayback(), []);

  return { speak, stop, isSpeaking };
}
