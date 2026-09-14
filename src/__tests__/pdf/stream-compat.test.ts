/**
 * Tests for the ReadableStream asyncIterator compatibility patch.
 *
 * Simulates the broken WKWebView (no Symbol.asyncIterator on
 * ReadableStream.prototype) by deleting the native property, then
 * verifies the patch restores for-await-over-stream support.
 */

import { describe, it, expect, afterEach } from "vitest";
import { ensureReadableStreamAsyncIterator } from "@/lib/pdf/stream-compat";

const ASYNC_ITERATOR = Symbol.asyncIterator;
const proto = ReadableStream.prototype as unknown as Record<symbol, unknown>;

describe("ensureReadableStreamAsyncIterator", () => {
  afterEach(() => {
    delete proto[ASYNC_ITERATOR];
  });

  it("installs a working async iterator when the platform lacks one", async () => {
    delete proto[ASYNC_ITERATOR];

    ensureReadableStreamAsyncIterator();

    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue("a");
        controller.enqueue("b");
        controller.close();
      },
    });

    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(["a", "b"]);
  });

  it("keeps an existing implementation untouched", () => {
    const sentinel = function () {
      return this;
    };
    proto[ASYNC_ITERATOR] = sentinel;

    ensureReadableStreamAsyncIterator();

    expect(proto[ASYNC_ITERATOR]).toBe(sentinel);
  });

  it("does not throw when ReadableStream is unavailable", () => {
    const original = globalThis.ReadableStream;
    // @ts-expect-error intentionally simulating a legacy global scope
    delete globalThis.ReadableStream;
    try {
      expect(() => ensureReadableStreamAsyncIterator()).not.toThrow();
    } finally {
      globalThis.ReadableStream = original;
    }
  });
});
