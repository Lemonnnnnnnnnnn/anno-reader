/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TranslationButton } from "../TranslationButton";

const { translatePlain, navigate, config } = vi.hoisted(() => ({
  translatePlain: vi.fn(),
  navigate: vi.fn(),
  config: {
    selectedProviderId: "deepseek",
    providers: [{ id: "deepseek", name: "DeepSeek", model: "deepseek-chat", baseUrl: "https://api.deepseek.com", enabled: true }],
  },
}));
vi.mock("@/stores/useAIConfigStore", () => ({
  useAIConfigStore: (selector: (state: { config: typeof config }) => unknown) => selector({ config }),
}));
vi.mock("@/lib/ai/translation", () => ({ translationService: { translatePlain } }));
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));

describe("standalone translator", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.removeItem("plainTranslationThinking");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<TranslationButton />));
    await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
    await act(async () => {
      const input = document.querySelector("textarea")!;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "Hello");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  function button(label: string) {
    return [...document.querySelectorAll("button")].find((item) => item.textContent === label)!;
  }

  it("submits with Ctrl+Enter from the input and other dialog controls, keeping Enter for newlines", async () => {
    translatePlain.mockImplementation(async () => ({ textStream: (async function* () { yield "你好"; })() }));
    const input = document.querySelector("textarea")!;
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })));
    expect(translatePlain).not.toHaveBeenCalled();
    for (const target of [input, document.querySelector('[aria-label="思考设置"]')!]) {
      await act(async () => target.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true, cancelable: true })));
    }
    expect(translatePlain).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe("你好");
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, isComposing: true, bubbles: true })));
    expect(translatePlain).toHaveBeenCalledTimes(2);
  });

  it("streams translation and offers thinking levels without a compatibility selector", async () => {
    translatePlain.mockResolvedValue({ textStream: (async function* () { yield "你"; yield "好"; })() });
    await act(async () => button("翻译").click());
    expect(translatePlain).toHaveBeenCalledWith("Hello", "Chinese", config.providers[0], "none", expect.any(AbortSignal));
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe("你好");
    expect(document.body.textContent).not.toContain("兼容方式");
    for (const mode of ["default", "low", "high", "max"]) {
      await act(async () => {
        const select = document.querySelector<HTMLSelectElement>('[aria-label="思考设置"]')!;
        select.value = mode;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      translatePlain.mockResolvedValue({ textStream: (async function* () { yield "Hello"; })() });
      await act(async () => button("翻译").click());
      expect(translatePlain).toHaveBeenLastCalledWith("Hello", "Chinese", config.providers[0], mode, expect.any(AbortSignal));
    }
  });

  it("aborts a pending request when the dialog closes and ignores its late result", async () => {
    let resolve!: (value: { textStream: AsyncIterable<string> }) => void;
    translatePlain.mockImplementation(() => new Promise((done) => { resolve = done; }));
    await act(async () => button("翻译").click());
    const signal: AbortSignal = translatePlain.mock.calls[0][4];
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Close dialog"]')!.click());
    expect(signal.aborted).toBe(true);
    await act(async () => resolve({ textStream: (async function* () { yield "过期结果"; })() }));
    await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
    expect(document.querySelector('[aria-live="polite"]')?.textContent).not.toContain("过期结果");
    expect(button("翻译").disabled).toBe(false);
  });
});
