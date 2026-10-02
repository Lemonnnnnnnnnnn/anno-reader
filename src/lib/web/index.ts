import { fetch as httpFetch } from "@tauri-apps/plugin-http";
import { mkdir, writeTextFile, remove } from "@tauri-apps/plugin-fs";
import { readConfig } from "@/lib/storage/config";
import { addEntry } from "@/lib/bookshelf";
import type { BookMetadata } from "@/stores/useBookStore";
import type { ParsedEpub } from "@/lib/epub";
import { arrayBufferToDataUrl } from "@/lib/images/convert";

export interface WebSnapshot {
  version: 1;
  sourceUrl: string;
  capturedAt: number;
  title: string;
  author: string;
  language: string;
  content: string;
}

export function validateWebUrl(value: string): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error("Please enter a valid HTTP or HTTPS URL."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Only HTTP or HTTPS URLs without embedded credentials are supported.");
  }
  url.hash = "";
  return url.href;
}

const allowedTags = new Set("article section div p span h1 h2 h3 h4 h5 h6 blockquote pre code ul ol li dl dt dd table thead tbody tfoot tr th td caption strong em b i u s del sup sub br hr a img figure figcaption".split(" "));
const rasterData = /^data:image\/(png|jpeg|gif|webp|avif);base64,[a-z0-9+/=]+$/i;

/** Rebuild from an allowlist: never retain scripts, styles, event handlers or embedded documents. */
function cleanContent(root: Element, baseUrl: string, offline: boolean): string {
  const output = document.createElement("div");
  function append(node: Node, parent: Element): void {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.appendChild(document.createTextNode(node.textContent ?? ""));
      return;
    }
    if (!(node instanceof Element)) return;
    const tag = node.tagName.toLowerCase();
    if (["script", "style", "iframe", "object", "embed", "svg", "math", "form", "input", "button", "select", "textarea", "link", "meta", "base", "noscript", "template", "nav", "aside"].includes(tag)) return;
    const target = allowedTags.has(tag) ? document.createElement(tag) : parent;
    if (target !== parent) {
      if (tag === "a") {
        try { target.setAttribute("href", validateWebUrl(new URL(node.getAttribute("href") ?? "", baseUrl).href)); } catch { /* plain text link */ }
      }
      if (tag === "img") {
        const src = node.getAttribute("src") || node.getAttribute("data-src") || "";
        target.setAttribute("alt", node.getAttribute("alt") ?? "");
        if (rasterData.test(src)) target.setAttribute("src", src);
        else if (!offline && src) {
          try { target.setAttribute("src", validateWebUrl(new URL(src, baseUrl).href)); } catch { /* discard unsafe image */ }
        }
        if (!target.hasAttribute("src")) return;
      }
      if (["th", "td"].includes(tag)) {
        for (const attr of ["colspan", "rowspan"]) {
          const value = node.getAttribute(attr);
          if (value && /^[1-9][0-9]?$/.test(value)) target.setAttribute(attr, value);
        }
      }
      parent.appendChild(target);
    }
    for (const child of Array.from(node.childNodes)) append(child, target);
  }
  for (const child of Array.from(root.childNodes)) append(child, output);
  return output.innerHTML;
}

export function extractWebArticle(html: string, sourceUrl: string): WebSnapshot {
  const url = validateWebUrl(sourceUrl);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const title = doc.querySelector('meta[property="og:title"]')?.getAttribute("content")?.trim()
    || doc.querySelector("h1")?.textContent?.trim() || doc.title.trim() || new URL(url).hostname;
  const author = doc.querySelector('meta[name="author"]')?.getAttribute("content")?.trim() || new URL(url).hostname;
  doc.querySelectorAll('nav, aside, footer, script, style, noscript, [hidden], [aria-hidden="true"]').forEach(el => el.remove());
  const candidates = Array.from(doc.querySelectorAll('article, main, [role="main"]'));
  const root = candidates.sort((a, b) => (b.textContent?.length ?? 0) - (a.textContent?.length ?? 0))[0] || doc.body;
  const content = cleanContent(root, url, false);
  const text = new DOMParser().parseFromString(content, "text/html").body.textContent?.trim();
  if (!text || text.length < 40) throw new Error("No readable article found. This page may require login or JavaScript.");
  return { version: 1, sourceUrl: url, capturedAt: Date.now(), title, author, language: doc.documentElement.lang || "", content };
}

const MAX_HTML = 5 * 1024 * 1024;
const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_IMAGES_TOTAL = 20 * 1024 * 1024;

async function getResponse(url: string): Promise<Response> {
  const response = await httpFetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Request failed (HTTP ${response.status}).`);
  }
  return response;
}

async function readLimited(response: Response, limit: number): Promise<ArrayBuffer> {
  if (Number(response.headers.get("content-length")) > limit) {
    await response.body?.cancel();
    throw new Error("Download exceeds the size limit.");
  }
  if (!response.body) return new ArrayBuffer(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error("Download exceeds the size limit.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  return buffer.buffer;
}

/** Persist once. Opening a snapshot never requests the source page or images. */
export async function importWebSnapshot(value: string): Promise<BookMetadata> {
  const sourceUrl = validateWebUrl(value);
  const config = await readConfig();
  if (!config?.dataDir) throw new Error("Data directory not configured.");
  const response = await getResponse(sourceUrl);
  const mime = response.headers.get("content-type") || "";
  if (mime && !/text\/html|application\/xhtml\+xml/i.test(mime)) {
    await response.body?.cancel();
    throw new Error("This URL does not return an HTML page.");
  }
  const bytes = await readLimited(response, MAX_HTML);
  const charset = /charset=["']?([^;\s"']+)/i.exec(mime)?.[1] || "utf-8";
  const snapshot = extractWebArticle(new TextDecoder(charset).decode(bytes), response.url || sourceUrl);
  const doc = new DOMParser().parseFromString(snapshot.content, "text/html");
  let totalBytes = 0;
  let count = 0;
  const cached = new Map<string, string>();
  for (const img of Array.from(doc.querySelectorAll("img"))) {
    const src = img.getAttribute("src") || "";
    try {
      if (!rasterData.test(src)) {
        let data = cached.get(src);
        if (!data) {
          if (++count > 40 || totalBytes >= MAX_IMAGES_TOTAL) throw new Error("Image budget exceeded");
          const image = await getResponse(src);
          const type = (image.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
          if (!/^image\/(png|jpeg|gif|webp|avif)$/.test(type)) {
            await image.body?.cancel();
            throw new Error("Unsupported image type");
          }
          const buffer = await readLimited(image, Math.min(MAX_IMAGE, MAX_IMAGES_TOTAL - totalBytes));
          totalBytes += buffer.byteLength;
          if (buffer.byteLength > MAX_IMAGE || totalBytes > MAX_IMAGES_TOTAL) throw new Error("Image too large");
          data = arrayBufferToDataUrl(buffer, type);
          cached.set(src, data);
        }
        img.setAttribute("src", data);
      } else {
        totalBytes += Math.ceil(src.length * 0.75);
        if (totalBytes > MAX_IMAGES_TOTAL) throw new Error("Image budget exceeded");
      }
    } catch {
      const placeholder = doc.createElement("p");
      placeholder.textContent = `[Image not saved${img.alt ? `: ${img.alt}` : ""}]`;
      img.replaceWith(placeholder);
    }
  }
  snapshot.content = cleanContent(doc.body, snapshot.sourceUrl, true);
  const id = crypto.randomUUID();
  const filePath = `entries/${id}/book.web.json`;
  const dir = `${config.dataDir}/entries/${id}`;
  await mkdir(dir, { recursive: true });
  const book: BookMetadata = {
    id, title: snapshot.title, author: snapshot.author, coverUrl: null, filePath,
    format: "web", lastOpened: snapshot.capturedAt, sourceUrl: snapshot.sourceUrl, capturedAt: snapshot.capturedAt,
  };
  try {
    await writeTextFile(`${config.dataDir}/${filePath}`, JSON.stringify(snapshot));
    await addEntry({ ...book, type: "book", addedAt: snapshot.capturedAt });
  } catch (error) {
    await remove(dir, { recursive: true }).catch(() => undefined);
    throw error;
  }
  return book;
}

export function loadWebSnapshot(json: string): ParsedEpub {
  const value: unknown = JSON.parse(json);
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1
    || !("content" in value) || typeof value.content !== "string"
    || !("title" in value) || typeof value.title !== "string"
    || !("author" in value) || typeof value.author !== "string"
    || !("language" in value) || typeof value.language !== "string"
    || !("sourceUrl" in value) || typeof value.sourceUrl !== "string"
    || !("capturedAt" in value) || typeof value.capturedAt !== "number") throw new Error("Invalid webpage snapshot.");
  const sourceUrl = validateWebUrl(value.sourceUrl);
  const doc = new DOMParser().parseFromString(value.content, "text/html");
  return {
    metadata: { title: value.title, author: value.author, language: value.language, identifier: sourceUrl },
    coverUrl: null,
    chapters: [{ id: "article", title: value.title, href: "article.html", content: cleanContent(doc.body, sourceUrl, true), cssContent: [] }],
    toc: [{ title: value.title, href: "article.html" }], resources: {}, opfFolder: "", manifestHrefs: {},
  };
}
