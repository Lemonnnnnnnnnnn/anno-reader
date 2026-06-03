import { describe, it, expect, beforeEach } from "vitest";
import { TranslationCache } from "../cache";
import type { TranslationResponse } from "../service";

function makeResponse(overrides: Partial<TranslationResponse> = {}): TranslationResponse {
  return {
    translation: "translated",
    originalText: "original",
    provider: "openai" as unknown as TranslationResponse["provider"],
    cached: false,
    ...overrides,
  };
}

describe("TranslationCache", () => {
  let cache: TranslationCache;

  beforeEach(() => {
    cache = new TranslationCache();
  });

  it("stores and retrieves a translation", () => {
    const response = makeResponse();
    cache.set("hello", "zh", response);

    expect(cache.get("hello", "zh")).toEqual(response);
  });

  it("returns undefined for cache miss", () => {
    expect(cache.get("missing", "zh")).toBeUndefined();
  });

  it("has() returns true for cached items", () => {
    cache.set("hello", "zh", makeResponse());
    expect(cache.has("hello", "zh")).toBe(true);
  });

  it("has() returns false for non-cached items", () => {
    expect(cache.has("missing", "zh")).toBe(false);
  });

  it("clear() empties the cache", () => {
    cache.set("a", "zh", makeResponse());
    cache.set("b", "ja", makeResponse());
    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.has("a", "zh")).toBe(false);
  });

  it("size reflects the number of cached items", () => {
    expect(cache.size).toBe(0);

    cache.set("a", "zh", makeResponse());
    expect(cache.size).toBe(1);

    cache.set("b", "zh", makeResponse());
    expect(cache.size).toBe(2);
  });

  it("different languages create different cache entries", () => {
    const zhResp = makeResponse({ translation: "你好" });
    const jaResp = makeResponse({ translation: "こんにちは" });

    cache.set("hello", "zh", zhResp);
    cache.set("hello", "ja", jaResp);

    expect(cache.get("hello", "zh")).toEqual(zhResp);
    expect(cache.get("hello", "ja")).toEqual(jaResp);
    expect(cache.size).toBe(2);
  });

  it("different texts create different cache entries", () => {
    cache.set("hello", "zh", makeResponse({ translation: "你好" }));
    cache.set("world", "zh", makeResponse({ translation: "世界" }));

    expect(cache.get("hello", "zh")?.translation).toBe("你好");
    expect(cache.get("world", "zh")?.translation).toBe("世界");
    expect(cache.size).toBe(2);
  });
});
