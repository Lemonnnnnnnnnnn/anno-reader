/**
 * Content provider implementations for EPUB and web content.
 *
 * Adapts domain-specific content (EPUB chapters, web pages) into the
 * unified ContentProvider interface for annotation and rendering.
 */

import type { ParsedEpub, EpubChapterInfo } from "@/lib/epub";
import type { WebPage } from "@/lib/web";
import type { ContentProvider, ContentSource, ContentRef } from "./types";

// --- Helpers ---

/**
 * Strip HTML tags and normalize whitespace to produce plain text.
 */
function extractPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// --- EpubContentProvider ---

/**
 * Adapts a parsed EPUB into the ContentProvider interface.
 *
 * Converts EPUB chapters to ContentSource objects and tracks the
 * currently active chapter by index.
 *
 * @example
 * ```ts
 * const provider = new EpubContentProvider(parsedEpub);
 * const sources = provider.getSources(); // ContentSource[]
 * provider.navigateTo({ collectionId: "book-1", sourceId: "chapter1.xhtml" });
 * ```
 */
export class EpubContentProvider implements ContentProvider {
  private readonly chapters: EpubChapterInfo[];
  private readonly _collectionId: string;
  private currentIndex: number = 0;

  /**
   * @param parsedEpub - The fully parsed EPUB data
   * @param collectionId - Identifier for this book (used in ContentRef)
   */
  constructor(parsedEpub: ParsedEpub, collectionId: string) {
    this.chapters = parsedEpub.chapters;
    this._collectionId = collectionId;
  }

  /** The collection identifier for this provider. */
  get collectionId(): string {
    return this._collectionId;
  }

  getSources(): ContentSource[] {
    return this.chapters.map((ch) => this.chapterToSource(ch));
  }

  getCurrentSource(): ContentSource | null {
    const chapter = this.chapters[this.currentIndex];
    return chapter ? this.chapterToSource(chapter) : null;
  }

  navigateTo(ref: ContentRef): void {
    const index = this.chapters.findIndex((ch) => ch.href === ref.sourceId);
    if (index >= 0) {
      this.currentIndex = index;
    }
  }

  /** Convert an EPUB chapter to a ContentSource. */
  private chapterToSource(chapter: EpubChapterInfo): ContentSource {
    return {
      id: chapter.href,
      title: chapter.title,
      html: chapter.content,
      plainText: extractPlainText(chapter.content),
      css: chapter.cssContent.length > 0 ? chapter.cssContent.join("\n") : undefined,
      type: "epub",
    };
  }
}

// --- WebContentProvider ---

/**
 * Adapts a collection of web pages into the ContentProvider interface.
 *
 * Pages are added individually and tracked by URL. The most recently
 * added page becomes the current source.
 *
 * @example
 * ```ts
 * const provider = new WebContentProvider("reading-list");
 * provider.addPage(fetchedPage);
 * const source = provider.getCurrentSource();
 * ```
 */
export class WebContentProvider implements ContentProvider {
  private readonly pages: WebPage[] = [];
  private readonly _collectionId: string;

  /**
   * @param collectionId - Identifier for this web collection (used in ContentRef)
   */
  constructor(collectionId: string) {
    this._collectionId = collectionId;
  }

  /** The collection identifier for this provider. */
  get collectionId(): string {
    return this._collectionId;
  }

  getSources(): ContentSource[] {
    return this.pages.map((page) => this.pageToSource(page));
  }

  getCurrentSource(): ContentSource | null {
    if (this.pages.length === 0) return null;
    return this.pageToSource(this.pages[this.pages.length - 1]);
  }

  navigateTo(ref: ContentRef): void {
    // For web provider, sourceId is the URL.
    // No state mutation needed — getCurrentSource returns the matching page.
    // We just validate that the page exists.
    const exists = this.pages.some((p) => p.url === ref.sourceId);
    if (!exists) {
      throw new Error(`Web page not found: ${ref.sourceId}`);
    }
  }

  /**
   * Add a fetched web page to this collection.
   * The page becomes the current source.
   */
  addPage(page: WebPage): void {
    // Replace if URL already exists
    const existingIndex = this.pages.findIndex((p) => p.url === page.url);
    if (existingIndex >= 0) {
      this.pages[existingIndex] = page;
    } else {
      this.pages.push(page);
    }
  }

  /** Remove a page by URL. Returns true if removed. */
  removePage(url: string): boolean {
    const index = this.pages.findIndex((p) => p.url === url);
    if (index >= 0) {
      this.pages.splice(index, 1);
      return true;
    }
    return false;
  }

  /** Convert a WebPage to a ContentSource. */
  private pageToSource(page: WebPage): ContentSource {
    return {
      id: page.url,
      title: page.title,
      html: page.html,
      plainText: page.plainText,
      type: "web",
    };
  }
}
