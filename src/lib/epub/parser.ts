import { loadEpubBook, splitHref, type Epub } from "epubix";
import type {
  EpubMetadata,
  EpubChapterInfo,
  EpubTocEntry,
  ParsedEpub,
  LoadEpubOptions,
} from "./types";
import { extractCssStrings } from "@/lib/css/extract";

// Re-export types for convenience
export type {
  EpubMetadata,
  EpubChapterInfo,
  EpubTocEntry,
  ParsedEpub,
  LoadEpubOptions,
};

/**
 * Load and parse an EPUB file from an ArrayBuffer.
 * This is the main entry point for the EPUB parser.
 *
 * @param arrayBuffer - The EPUB file as an ArrayBuffer
 * @param options - Optional loading configuration
 * @returns A fully parsed EPUB structure
 * @throws {Error} If the file is corrupt or cannot be parsed
 */
export async function loadEpub(
  arrayBuffer: ArrayBuffer,
  options: LoadEpubOptions = {}
): Promise<ParsedEpub> {
  const { extractContent = true } = options;

  let epub: Epub;
  try {
    epub = await loadEpubBook(arrayBuffer);
  } catch (err) {
    throw new Error(
      `Failed to load EPUB: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const metadata = extractMetadata(epub);
  const coverUrl = await extractCover(epub);
  const chapters = extractContent ? extractChapters(epub) : [];
  const toc = extractToc(epub);
  const resources = epub.resources;
  const opfFolder = epub.opfFolder || "";
  const manifestHrefs = await extractManifestHrefs(epub);

  return { metadata, coverUrl, chapters, toc, resources, opfFolder, manifestHrefs };
}

/**
 * Extract metadata from a loaded EPUB.
 */
export function extractMetadata(epub: Epub): EpubMetadata {
  return {
    title: epub.metadata.title ?? "Unknown Title",
    author: epub.metadata.author ?? "Unknown Author",
    language: epub.metadata.language ?? "",
    identifier: epub.metadata.identifier ?? "",
  };
}

/**
 * Extract cover image from a loaded EPUB as a data URL.
 * Handles EPUB 3 cover detection issues with multiple fallback strategies:
 * 1. Try epubix's built-in getCoverImageData()
 * 2. Look for manifest item with properties="cover-image" (EPUB 3)
 * 3. Look for cover image referenced in metadata
 *
 * @returns Data URL (e.g., "data:image/jpeg;base64,...") or null if no cover found
 */
export async function extractCover(epub: Epub): Promise<string | null> {
  // Strategy 1: Use epubix's built-in cover extraction
  try {
    const coverData = await epub.getCoverImageData();
    if (coverData) {
      return coverData;
    }
  } catch {
    // Fall through to next strategy
  }

  // Strategy 2: Look for cover-image in manifest resources (EPUB 3)
  try {
    const resources = epub.resources;
    for (const [_id, resource] of Object.entries(resources)) {
      if (resource.type.startsWith("image/") && typeof resource.content === "string") {
        // Check if this looks like a cover (by ID or type)
        const id = resource.id.toLowerCase();
        if (id.includes("cover")) {
          const mimeType = resource.type;
          return `data:${mimeType};base64,${resource.content}`;
        }
      }
    }
  } catch {
    // Fall through to next strategy
  }

  // Strategy 3: Try to extract cover from the cover path in metadata
  try {
    const coverPath = epub.metadata.cover;
    if (coverPath) {
      const coverBuffer = await epub.getFile(coverPath);
      if (coverBuffer) {
        const mimeType = guessMimeType(coverPath);
        const base64 = arrayBufferToBase64(coverBuffer);
        return `data:${mimeType};base64,${base64}`;
      }
    }
  } catch {
    // No cover available
  }

  return null;
}

/**
 * Extract all chapters from a loaded EPUB in spine (reading) order.
 * Also extracts CSS content for each chapter from linked stylesheets and inline styles.
 */
export function extractChapters(epub: Epub): EpubChapterInfo[] {
  const opfFolder = epub.opfFolder || "";

  return epub.chapters.map((ch) => {
    const cssContent = extractCssStrings(
      ch.content,
      epub.resources,
      ch.href,
      opfFolder,
    );

    return {
      id: ch.id,
      title: ch.title || `Chapter`,
      href: ch.href,
      content: ch.content,
      cssContent,
    };
  });
}

/**
 * Extract the table of contents from a loaded EPUB.
 * Handles both EPUB 2 (NCX) and EPUB 3 (Nav) formats.
 */
export function extractToc(epub: Epub): EpubTocEntry[] {
  return epub.toc.map(convertTocEntry);
}

/**
 * Resolve a TOC href to a specific chapter and optional anchor fragment.
 * This handles the common mismatch between TOC hrefs and chapter hrefs.
 *
 * @param epub - A loaded Epub instance
 * @param href - The href from a TOC entry (may include fragment, e.g., "chapter1.html#section2")
 * @returns The matching chapter and fragment, or null if not found
 */
export function resolveHref(
  epub: Epub,
  href: string
): { chapter: EpubChapterInfo | null; fragment: string | null } {
  const { path, fragment } = splitHref(href);
  const opfFolder = epub.opfFolder || "";

  // Try direct match via epubix's resolver
  try {
    const result = epub.getChapterByHref(href);
    if (result?.chapter) {
      const cssContent = extractCssStrings(
        result.chapter.content,
        epub.resources,
        result.chapter.href,
        opfFolder,
      );

      return {
        chapter: {
          id: result.chapter.id,
          title: result.chapter.title,
          href: result.chapter.href,
          content: result.chapter.content,
          cssContent,
        },
        fragment: fragment ?? null,
      };
    }
  } catch {
    // Fall through to manual search
  }

  // Manual fallback: search chapters by normalized path
  const normalizedSearch = normalizePath(path ?? href);
  for (const ch of epub.chapters) {
    if (normalizePath(ch.href) === normalizedSearch) {
      const cssContent = extractCssStrings(
        ch.content,
        epub.resources,
        ch.href,
        opfFolder,
      );

      return {
        chapter: {
          id: ch.id,
          title: ch.title,
          href: ch.href,
          content: ch.content,
          cssContent,
        },
        fragment: fragment ?? null,
      };
    }
  }

  return { chapter: null, fragment: fragment ?? null };
}

// --- Internal helpers ---

/**
 * Extract manifest href mapping from the EPUB OPF file.
 * Maps normalized file paths to manifest resource IDs.
 * This is needed because epubix only indexes resources by ID, not by href.
 */
async function extractManifestHrefs(epub: Epub): Promise<Record<string, string>> {
  const manifestHrefs: Record<string, string> = {};

  try {
    // Read META-INF/container.xml to locate the OPF file
    const containerBuffer = await epub.getFile("META-INF/container.xml");
    if (!containerBuffer) return manifestHrefs;

    const containerXml = new TextDecoder().decode(containerBuffer);
    const containerDoc = new DOMParser().parseFromString(containerXml, "application/xml");
    const rootfilePath = containerDoc.querySelector("rootfile")?.getAttribute("full-path");
    if (!rootfilePath) return manifestHrefs;

    // Read and parse the OPF file
    const opfBuffer = await epub.getFile(rootfilePath);
    if (!opfBuffer) return manifestHrefs;

    const opfXml = new TextDecoder().decode(opfBuffer);
    const opfDoc = new DOMParser().parseFromString(opfXml, "application/xml");

    // Extract opfFolder for path resolution
    const opfFolder = rootfilePath.substring(0, rootfilePath.lastIndexOf("/") + 1);

    // Parse manifest items and build href -> id mapping
    const manifestItems = opfDoc.querySelectorAll("manifest > item");
    for (const item of manifestItems) {
      const id = item.getAttribute("id");
      const href = item.getAttribute("href");
      if (id && href) {
        // Normalize the full path (opfFolder + href)
        const fullPath = opfFolder + href;
        const normalizedPath = normalizePath(fullPath);
        manifestHrefs[normalizedPath] = id;

        // Also store without opfFolder for relative path matching
        const normalizedHref = normalizePath(href);
        manifestHrefs[normalizedHref] = id;
      }
    }
  } catch {
    // If parsing fails, return empty mapping
  }

  return manifestHrefs;
}

/** Recursively convert epubix TocEntry to our EpubTocEntry */
function convertTocEntry(entry: { title: string; href: string; children?: { title: string; href: string; children?: unknown }[] }): EpubTocEntry {
  return {
    title: entry.title,
    href: entry.href,
    children: entry.children?.map((child) => convertTocEntry(child as { title: string; href: string; children?: { title: string; href: string; children?: unknown }[] })),
  };
}

/** Guess MIME type from file extension */
function guessMimeType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    case "webp":
      return "image/webp";
    case "jpg":
    case "jpeg":
    default:
      return "image/jpeg";
  }
}

/** Convert ArrayBuffer to base64 string */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Normalize a path for comparison (strip leading ./ and ../) */
function normalizePath(path: string): string {
  return path.replace(/^\.?\.?\//, "").toLowerCase();
}
