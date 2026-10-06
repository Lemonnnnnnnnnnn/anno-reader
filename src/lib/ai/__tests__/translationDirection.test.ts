import { describe, expect, it } from "vitest";
import { detectTranslationTarget } from "../translationDirection";

describe("automatic translation direction", () => {
  it.each([
    ["Hello, world!", "Chinese"],
    ["你好，世界！", "English"],
    ["繁體中文測試", "English"],
    ["Hello 世界", "Chinese"],
    ["这是一个中文句子 hello", "English"],
    ["你好 https://example.com/very-long-path", "English"],
    ["https://example.com/hello", null],
    ["12345 ! 😀", null],
    ["", null],
  ])("detects %s as %s target", (text, expected) => {
    expect(detectTranslationTarget(text)).toBe(expected);
  });
});
