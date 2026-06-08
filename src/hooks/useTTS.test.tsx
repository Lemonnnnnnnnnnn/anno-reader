/**
 * Tests for the useTTS hook.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createElement } from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { useTTS } from "./useTTS";

const mockSpeechSynthesis = {
  speaking: false,
  getVoices: vi.fn(() => []),
  speak: vi.fn((utterance: SpeechSynthesisUtterance) => {
    mockSpeechSynthesis.speaking = true;
    activeUtterance = utterance;
  }),
  cancel: vi.fn(() => {
    mockSpeechSynthesis.speaking = false;
  }),
};

let activeUtterance: SpeechSynthesisUtterance | null = null;
let latestState: ReturnType<typeof useTTS> | null = null;
let root: Root | null = null;

class MockSpeechSynthesisUtterance extends EventTarget {
  text: string;
  pitch = 1;
  rate = 1;
  voice: SpeechSynthesisVoice | null = null;

  constructor(text: string) {
    super();
    this.text = text;
  }
}

function TTSConsumer() {
  latestState = useTTS("Selected text");
  return null;
}

function renderTTSConsumer() {
  root = createRoot(document.createElement("div"));
  act(() => {
    root!.render(createElement(TTSConsumer));
  });
}

function cleanup() {
  act(() => {
    root?.unmount();
  });
  root = null;
  latestState = null;
  activeUtterance = null;
}

describe("useTTS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    mockSpeechSynthesis.speaking = false;
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: mockSpeechSynthesis,
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: MockSpeechSynthesisUtterance,
    });
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
      configurable: true,
      value: MockSpeechSynthesisUtterance,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("resets speaking state when browser speech ends naturally", async () => {
    renderTTSConsumer();

    await act(async () => {
      await latestState!.speak();
    });

    expect(latestState!.isSpeaking).toBe(true);

    act(() => {
      mockSpeechSynthesis.speaking = false;
      activeUtterance!.dispatchEvent(new Event("end"));
    });

    expect(latestState!.isSpeaking).toBe(false);
  });
});
