import { create } from "zustand";
import type { TTSConfig } from "@/lib/tts/types";
import { DEFAULT_CONFIG } from "@/lib/tts/constants";

export interface TTSConfigStore {
  config: TTSConfig;
}

export const useTTSConfigStore = create<TTSConfigStore>(() => ({
  config: DEFAULT_CONFIG,
}));
