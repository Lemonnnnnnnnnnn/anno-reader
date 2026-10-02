// @vitest-environment-options {"settings":{"disableIframePageLoading":true,"disableJavaScriptFileLoading":true,"disableCSSFileLoading":true}}
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetch as httpFetch } from "@tauri-apps/plugin-http";
import { writeTextFile, remove } from "@tauri-apps/plugin-fs";
import { addEntry, entryToBookMetadata } from "@/lib/bookshelf";
import { extractWebArticle, importWebSnapshot, loadWebSnapshot, validateWebUrl } from "../index";

vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ mkdir: vi.fn(), writeTextFile: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/storage/config", () => ({ readConfig: vi.fn(async () => ({ dataDir: "/data" })) }));
vi.mock("@/lib/bookshelf", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/bookshelf")>(), addEntry: vi.fn() }));

const paragraph = "This is the saved article with enough text to support selections and annotations across sessions.";
const page = `<html lang="en"><head><title>Article</title><meta name="author" content="Alice"></head><body><nav>Menu</nav><article><h1>Article</h1><p>${paragraph}</p><img src="/image.png" alt="Diagram"></article><footer>Footer</footer></body></html>`;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(writeTextFile).mockResolvedValue(undefined);
  vi.mocked(remove).mockResolvedValue(undefined);
  vi.mocked(addEntry).mockResolvedValue(undefined);
});

describe("web snapshots", () => {
  it("rejects non-web URLs and embedded credentials", () => {
    for (const url of ["javascript:alert(1)", "file:///tmp/a", "https://user:pass@example.com", "nonsense"]) {
      expect(() => validateWebUrl(url)).toThrow();
    }
  });

  it("extracts article metadata and removes executable content and surrounding navigation", () => {
    const result = extractWebArticle(page.replace("</article>", `<script>alert(1)</script><iframe srcdoc="unsafe"></iframe><svg onload="alert(1)"></svg><a href="javascript:alert(1)" onclick="alert(1)">Link</a><p style="background:url(https://evil.test)" onmouseover="alert(1)">Safe</p></article>`), "https://example.com/story");
    expect(result.title).toBe("Article");
    expect(result.author).toBe("Alice");
    expect(result.content).toContain(paragraph);
    expect(result.content).toContain('src="https://example.com/image.png"');
    expect(result.content).not.toMatch(/script|iframe|svg|onclick|onmouseover|style=|javascript:|Menu|Footer/);
  });

  it("rejects empty dynamic pages", () => {
    expect(() => extractWebArticle("<body><div id='app'></div><script>load()</script></body>", "https://example.com")).toThrow("No readable article");
  });

  it("saves images inline, preserves source metadata and reloads without requests", async () => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(new Response(page, { headers: { "content-type": "text/html" } }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } }));
    const book = await importWebSnapshot("https://example.com/story");
    const [path, json] = vi.mocked(writeTextFile).mock.calls[0];
    expect(path).toBe(`/data/${book.filePath}`);
    expect(book.format).toBe("web");
    expect(json).toContain("data:image/png;base64,AQID");
    const parsed = loadWebSnapshot(json);
    expect(parsed.chapters[0].href).toBe("article.html");
    expect(parsed.chapters[0].content).toContain(paragraph);
    expect(loadWebSnapshot(json).chapters[0].content).toBe(parsed.chapters[0].content);
    expect(httpFetch).toHaveBeenCalledTimes(2);
    const entry = vi.mocked(addEntry).mock.calls[0][0];
    expect(entryToBookMetadata(entry)).toMatchObject({ sourceUrl: book.sourceUrl, capturedAt: book.capturedAt });
  });

  it("records a missing image without leaving a remote dependency", async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(new Response(page, { headers: { "content-type": "text/html" } })).mockRejectedValueOnce(new Error("offline"));
    await importWebSnapshot("https://example.com/story");
    const parsed = loadWebSnapshot(vi.mocked(writeTextFile).mock.calls[0][1]);
    expect(parsed.chapters[0].content).toContain("Image not saved: Diagram");
    expect(parsed.chapters[0].content).not.toContain("<img");
  });

  it("sanitizes tampered snapshots on load and rejects unknown schemas", () => {
    const snapshot = extractWebArticle(page, "https://example.com/story");
    snapshot.content += '<script>alert(1)</script><img src="https://tracker.test/image">';
    expect(loadWebSnapshot(JSON.stringify(snapshot)).chapters[0].content).not.toMatch(/script|<img/);
    expect(() => loadWebSnapshot('{"version":2}')).toThrow("Invalid webpage snapshot");
  });

  it("cleans up a snapshot when persistence fails", async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(new Response(`<article><p>${paragraph}</p></article>`, { headers: { "content-type": "text/html" } }));
    vi.mocked(writeTextFile).mockRejectedValueOnce(new Error("Disk full"));
    await expect(importWebSnapshot("https://example.com/story")).rejects.toThrow("Disk full");
    expect(addEntry).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith(expect.stringMatching(/^\/data\/entries\//), { recursive: true });
  });

  it("rejects failed requests, non-HTML pages and oversized downloads before persisting", async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(new Response("Denied", { status: 403 }));
    await expect(importWebSnapshot("https://example.com")).rejects.toThrow("HTTP 403");
    vi.mocked(httpFetch).mockResolvedValueOnce(new Response("PDF", { headers: { "content-type": "application/pdf" } }));
    await expect(importWebSnapshot("https://example.com")).rejects.toThrow("HTML page");
    vi.mocked(httpFetch).mockResolvedValueOnce(new Response(page, { headers: { "content-type": "text/html", "content-length": "99999999" } }));
    await expect(importWebSnapshot("https://example.com")).rejects.toThrow("size limit");
    expect(writeTextFile).not.toHaveBeenCalled();
  });
});
