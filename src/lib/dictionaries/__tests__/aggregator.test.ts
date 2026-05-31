import { describe, it, expect, vi, beforeEach } from "vitest";
import { DictionaryAggregator } from "../aggregator";
import { DictionaryError } from "../errors";
import type {
  DictionaryConfig,
  DictionaryResult,
  DictionarySearchFunction,
} from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal enabled config for a provider. */
function makeConfig(id: string, overrides?: Partial<DictionaryConfig>): DictionaryConfig {
  return {
    id,
    name: id,
    enabled: true,
    timeout: 5000,
    ...overrides,
  };
}

/** Create a successful DictionaryResult. */
function makeResult(source: string, word = "test"): DictionaryResult {
  return { source, word, found: true, data: { items: [] } };
}

/**
 * Create a mock search function that resolves after `delay` ms.
 * Rejects with `error` if provided.
 */
function mockSearch(
  result: DictionaryResult | Error,
  delay = 0,
): DictionarySearchFunction {
  return vi.fn(async (_word: string, _config: DictionaryConfig) => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    if (result instanceof Error) {
      throw result;
    }
    return result;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DictionaryAggregator", () => {
  let aggregator: DictionaryAggregator;

  beforeEach(() => {
    aggregator = new DictionaryAggregator();
  });

  // =========================================================================
  // registerProvider
  // =========================================================================

  describe("registerProvider()", () => {
    it("should register a provider that can be searched", async () => {
      const result = makeResult("etymonline");
      const searchFn = mockSearch(result);

      aggregator.registerProvider("etymonline", searchFn, makeConfig("etymonline"));

      const agg = await aggregator.search("test");
      expect(agg.results).toHaveLength(1);
      expect(agg.results[0]).toEqual(result);
    });

    it("should overwrite a previously registered provider with the same id", async () => {
      const first = mockSearch(makeResult("dict"));
      const second = mockSearch(makeResult("dict", "updated"));

      aggregator.registerProvider("dict", first, makeConfig("dict"));
      aggregator.registerProvider("dict", second, makeConfig("dict"));

      await aggregator.search("test");
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // search — parallel execution
  // =========================================================================

  describe("search() — parallel execution", () => {
    it("should query all providers in parallel (duration < sum of delays)", async () => {
      // Two providers each taking 200ms — sequential would be ~400ms, parallel ~200ms
      const slowA = mockSearch(makeResult("a"), 200);
      const slowB = mockSearch(makeResult("b"), 200);

      aggregator.registerProvider("a", slowA, makeConfig("a"));
      aggregator.registerProvider("b", slowB, makeConfig("b"));

      const agg = await aggregator.search("test");

      expect(agg.results).toHaveLength(2);
      expect(agg.successCount).toBe(2);
      // Allow some buffer — parallel should be well under 350ms
      expect(agg.duration).toBeLessThan(350);
    });

    it("should return empty results when no providers registered", async () => {
      const agg = await aggregator.search("test");

      expect(agg.results).toHaveLength(0);
      expect(agg.successCount).toBe(0);
      expect(agg.errors).toHaveLength(0);
      expect(agg.word).toBe("test");
    });
  });

  // =========================================================================
  // search — partial failure
  // =========================================================================

  describe("search() — partial failure", () => {
    it("should return successful results and collect errors from failed providers", async () => {
      const successResult = makeResult("good");
      const failError = new DictionaryError("FETCH_FAILED", "Network down", "bad", true);

      aggregator.registerProvider("good", mockSearch(successResult), makeConfig("good"));
      aggregator.registerProvider("bad", mockSearch(failError), makeConfig("bad"));

      const agg = await aggregator.search("test");

      expect(agg.results).toHaveLength(1);
      expect(agg.results[0]).toEqual(successResult);
      expect(agg.successCount).toBe(1);
      expect(agg.errors).toHaveLength(1);
      expect(agg.errors[0].source).toBe("bad");
      expect(agg.errors[0].error).toBeInstanceOf(DictionaryError);
      expect(agg.errors[0].error.code).toBe("FETCH_FAILED");
    });

    it("should return only errors when all providers fail", async () => {
      const errA = new DictionaryError("FETCH_FAILED", "fail-a", "a", true);
      const errB = new DictionaryError("PARSE_FAILED", "fail-b", "b", false);

      aggregator.registerProvider("a", mockSearch(errA), makeConfig("a"));
      aggregator.registerProvider("b", mockSearch(errB), makeConfig("b"));

      const agg = await aggregator.search("test");

      expect(agg.results).toHaveLength(0);
      expect(agg.successCount).toBe(0);
      expect(agg.errors).toHaveLength(2);
    });
  });

  // =========================================================================
  // search — timeout enforcement
  // =========================================================================

  describe("search() — timeout enforcement", () => {
    it("should reject provider that exceeds timeout with TIMEOUT error", async () => {
      // Provider takes 500ms but timeout is 100ms
      const slowSearch = mockSearch(makeResult("slow"), 500);
      aggregator.registerProvider("slow", slowSearch, makeConfig("slow", { timeout: 100 }));

      const agg = await aggregator.search("test");

      expect(agg.results).toHaveLength(0);
      expect(agg.errors).toHaveLength(1);
      expect(agg.errors[0].source).toBe("slow");
      expect(agg.errors[0].error.code).toBe("TIMEOUT");
      expect(agg.errors[0].error.retryable).toBe(true);
    });

    it("should not affect fast providers when a slow one times out", async () => {
      const fastResult = makeResult("fast");
      const fastSearch = mockSearch(fastResult, 10);
      const slowSearch = mockSearch(makeResult("slow"), 500);

      aggregator.registerProvider("fast", fastSearch, makeConfig("fast", { timeout: 5000 }));
      aggregator.registerProvider("slow", slowSearch, makeConfig("slow", { timeout: 100 }));

      const agg = await aggregator.search("test");

      expect(agg.results).toHaveLength(1);
      expect(agg.results[0]).toEqual(fastResult);
      expect(agg.errors).toHaveLength(1);
      expect(agg.errors[0].source).toBe("slow");
    });

    it("should use default 5000ms timeout when config.timeout is not set", async () => {
      const configNoTimeout = {
        id: "default",
        name: "default",
        enabled: true,
        timeout: undefined as unknown as number,
      };
      const fastSearch = mockSearch(makeResult("default"), 10);

      aggregator.registerProvider("default", fastSearch, configNoTimeout);

      const agg = await aggregator.search("test");
      expect(agg.results).toHaveLength(1);
    });
  });

  // =========================================================================
  // search — dictionaryIds filter
  // =========================================================================

  describe("search() — dictionaryIds filter", () => {
    it("should query only specified providers when dictionaryIds given", async () => {
      const searchA = mockSearch(makeResult("a"));
      const searchB = mockSearch(makeResult("b"));
      const searchC = mockSearch(makeResult("c"));

      aggregator.registerProvider("a", searchA, makeConfig("a"));
      aggregator.registerProvider("b", searchB, makeConfig("b"));
      aggregator.registerProvider("c", searchC, makeConfig("c"));

      const agg = await aggregator.search("test", ["a", "c"]);

      expect(agg.results).toHaveLength(2);
      expect(searchA).toHaveBeenCalledTimes(1);
      expect(searchB).not.toHaveBeenCalled();
      expect(searchC).toHaveBeenCalledTimes(1);
    });

    it("should skip unknown provider IDs in the filter", async () => {
      const searchA = mockSearch(makeResult("a"));
      aggregator.registerProvider("a", searchA, makeConfig("a"));

      const agg = await aggregator.search("test", ["a", "nonexistent"]);

      expect(agg.results).toHaveLength(1);
      expect(agg.errors).toHaveLength(0);
    });
  });

  // =========================================================================
  // search — disabled providers
  // =========================================================================

  describe("search() — disabled providers", () => {
    it("should skip disabled providers", async () => {
      const enabledSearch = mockSearch(makeResult("enabled"));
      const disabledSearch = mockSearch(makeResult("disabled"));

      aggregator.registerProvider("enabled", enabledSearch, makeConfig("enabled"));
      aggregator.registerProvider("disabled", disabledSearch, makeConfig("disabled", { enabled: false }));

      const agg = await aggregator.search("test");

      expect(agg.results).toHaveLength(1);
      expect(agg.results[0].source).toBe("enabled");
      expect(disabledSearch).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // searchSingle
  // =========================================================================

  describe("searchSingle()", () => {
    it("should return result from the specified provider", async () => {
      const result = makeResult("etymonline");
      const searchFn = mockSearch(result);

      aggregator.registerProvider("etymonline", searchFn, makeConfig("etymonline"));

      const res = await aggregator.searchSingle("test", "etymonline");

      expect(res).toEqual(result);
      expect(searchFn).toHaveBeenCalledWith("test", expect.objectContaining({ id: "etymonline" }));
    });

    it("should throw when provider is not registered", async () => {
      await expect(aggregator.searchSingle("test", "missing")).rejects.toThrow(
        'Dictionary provider "missing" not registered',
      );
    });

    it("should enforce timeout for single provider", async () => {
      const slowSearch = mockSearch(makeResult("slow"), 500);
      aggregator.registerProvider("slow", slowSearch, makeConfig("slow", { timeout: 100 }));

      await expect(aggregator.searchSingle("test", "slow")).rejects.toThrow(DictionaryError);
      await expect(aggregator.searchSingle("test", "slow")).rejects.toSatisfy(
        (err: DictionaryError) => err.code === "TIMEOUT",
      );
    });

    it("should propagate provider errors as DictionaryError", async () => {
      const fetchError = new DictionaryError("FETCH_FAILED", "Network error", "net", true);
      const searchFn = mockSearch(fetchError);

      aggregator.registerProvider("net", searchFn, makeConfig("net"));

      await expect(aggregator.searchSingle("test", "net")).rejects.toThrow(fetchError);
    });
  });

  // =========================================================================
  // search — error classification
  // =========================================================================

  describe("search() — error classification", () => {
    it("should preserve DictionaryError instances as-is", async () => {
      const dictError = new DictionaryError("PARSE_FAILED", "Bad HTML", "src", false);
      aggregator.registerProvider("src", mockSearch(dictError), makeConfig("src"));

      const agg = await aggregator.search("test");

      expect(agg.errors[0].error).toBe(dictError);
      expect(agg.errors[0].error.code).toBe("PARSE_FAILED");
    });

    it("should wrap plain Error as UNKNOWN_ERROR DictionaryError", async () => {
      const plainError = new Error("Something broke");
      aggregator.registerProvider("src", mockSearch(plainError), makeConfig("src"));

      const agg = await aggregator.search("test");

      expect(agg.errors[0].error).toBeInstanceOf(DictionaryError);
      expect(agg.errors[0].error.code).toBe("UNKNOWN_ERROR");
      expect(agg.errors[0].error.message).toBe("Something broke");
      expect(agg.errors[0].error.retryable).toBe(false);
    });

    it("should wrap non-Error rejection (string) as UNKNOWN_ERROR", async () => {
      const searchFn: DictionarySearchFunction = vi.fn(async () => {
        throw "raw string error"; // eslint-disable-line no-throw-literal
      });
      aggregator.registerProvider("src", searchFn, makeConfig("src"));

      const agg = await aggregator.search("test");

      expect(agg.errors[0].error).toBeInstanceOf(DictionaryError);
      expect(agg.errors[0].error.code).toBe("UNKNOWN_ERROR");
      expect(agg.errors[0].error.message).toBe("raw string error");
    });
  });

  // =========================================================================
  // search — result shape
  // =========================================================================

  describe("search() — result shape", () => {
    it("should include word, successCount, and duration in result", async () => {
      aggregator.registerProvider("a", mockSearch(makeResult("a")), makeConfig("a"));

      const agg = await aggregator.search("hello");

      expect(agg.word).toBe("hello");
      expect(agg.successCount).toBe(1);
      expect(agg.duration).toBeGreaterThanOrEqual(0);
      expect(agg.errors).toHaveLength(0);
    });
  });
});
