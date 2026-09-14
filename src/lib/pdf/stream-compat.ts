/**
 * WKWebView compatibility patch for pdf.js 6.x.
 *
 * pdf.js reads page text by async-iterating a ReadableStream
 * (`for await (const value of readableStream)` in getTextContent),
 * which requires `ReadableStream.prototype[Symbol.asyncIterator]`.
 * Some system WebKit builds used by WKWebView do not implement it
 * (verified via a WKWebView probe: Promise.withResolvers exists while
 * Symbol.asyncIterator is missing), so every PDF page render fails
 * with "undefined is not a function (near '...value of readableStream...')".
 *
 * Installs the spec-shaped async iterator (a chunk-yielding getReader
 * loop) when the platform lacks it. No-op on compliant engines, so it
 * is safe to run before every pdf.js load.
 */

export function ensureReadableStreamAsyncIterator(): void {
  if (typeof ReadableStream === "undefined") return;

  const proto = ReadableStream.prototype as unknown as {
    [Symbol.asyncIterator]?: unknown;
  };
  if (typeof proto[Symbol.asyncIterator] === "function") return;

  async function* streamToAsyncIterator(this: ReadableStream) {
    const reader = this.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }

  Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, {
    value: streamToAsyncIterator,
    writable: true,
    enumerable: false,
    configurable: true,
  });
}
