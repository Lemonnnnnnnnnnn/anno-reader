/**
 * Cover image extraction with EPUB 3 fallback strategies.
 *
 * Implements a 4-level fallback for cover detection:
 * 1. epubix's built-in getCoverImageData() (EPUB 2 meta[name=cover])
 * 2. OPF manifest item with properties="cover-image" (EPUB 3 spec)
 * 3. Manifest resource with "cover" in the ID (heuristic fallback)
 * 4. Cover path from OPF metadata
 *
 * Note: epubix does NOT parse the `properties` attribute from OPF
 * manifest items, so Strategy 2 re-parses the OPF XML directly.
 */

import { loadEpubBook, type Epub } from "epubix";
import type { CoverResult } from "./types";

/** Reusable "not found" result to avoid repeated object allocation */
const NOT_FOUND: CoverResult = { found: false, dataUrl: null, mimeType: null };

/**
 * Extract the cover image from an already-loaded Epub instance.
 * Returns a structured CoverResult with data URL and MIME type.
 *
 * @param epub - A loaded epubix Epub instance
 * @returns CoverResult with dataUrl if found, or { found: false, ... }
 */
export async function getCoverFromEpub(epub: Epub): Promise<CoverResult> {
  // Strategy 1: Use epubix's built-in cover extraction (EPUB 2 <meta name="cover">)
  try {
    const coverData = await epub.getCoverImageData();
    if (coverData) {
      const mimeType = extractMimeTypeFromDataUrl(coverData);
      return { found: true, dataUrl: coverData, mimeType };
    }
  } catch {
    // Fall through to next strategy
  }

  // Strategy 2: Parse OPF for EPUB 3 properties="cover-image" attribute
  // epubix doesn't expose manifest properties, so we parse the OPF XML directly.
  try {
    const result = await findCoverFromOpfProperties(epub);
    if (result.found) return result;
  } catch {
    // Fall through to next strategy
  }

  // Strategy 3: Heuristic — look for image resources with "cover" in the ID
  try {
    const resources = epub.resources;
    for (const [, resource] of Object.entries(resources)) {
      if (
        resource.type.startsWith("image/") &&
        typeof resource.content === "string"
      ) {
        const id = resource.id.toLowerCase();
        if (id.includes("cover")) {
          return {
            found: true,
            dataUrl: `data:${resource.type};base64,${resource.content}`,
            mimeType: resource.type,
          };
        }
      }
    }
  } catch {
    // Fall through to next strategy
  }

  // Strategy 4: Try to extract cover from the cover path in metadata
  try {
    const coverPath = epub.metadata.cover;
    if (coverPath) {
      const coverBuffer = await epub.getFile(coverPath);
      if (coverBuffer) {
        const mimeType = guessMimeType(coverPath);
        const base64 = arrayBufferToBase64(coverBuffer);
        return {
          found: true,
          dataUrl: `data:${mimeType};base64,${base64}`,
          mimeType,
        };
      }
    }
  } catch {
    // No cover available
  }

  return NOT_FOUND;
}

/**
 * Parse the OPF file to find a manifest item with properties="cover-image"
 * (EPUB 3 spec), then resolve it from epub resources or the zip directly.
 *
 * This is necessary because epubix does not parse the `properties` attribute
 * from OPF manifest items — only `id`, `href`, and `media-type` are extracted.
 */
async function findCoverFromOpfProperties(epub: Epub): Promise<CoverResult> {
  // 1. Read META-INF/container.xml to locate the OPF file
  const containerBuffer = await epub.getFile("META-INF/container.xml");
  if (!containerBuffer) {
    return NOT_FOUND;
  }

  const containerXml = new TextDecoder().decode(containerBuffer);
  const containerDoc = new DOMParser().parseFromString(
    containerXml,
    "application/xml"
  );
  const rootfilePath = containerDoc
    .querySelector("rootfile")
    ?.getAttribute("full-path");
  if (!rootfilePath) {
    return NOT_FOUND;
  }

  // 2. Read and parse the OPF file
  const opfBuffer = await epub.getFile(rootfilePath);
  if (!opfBuffer) {
    return NOT_FOUND;
  }

  const opfXml = new TextDecoder().decode(opfBuffer);
  const opfDoc = new DOMParser().parseFromString(opfXml, "application/xml");

  // 3. Find the manifest item with properties="cover-image"
  const manifestItems = opfDoc.querySelectorAll("manifest > item");
  let coverId: string | null = null;
  let coverHref: string | null = null;
  let coverMediaType: string | null = null;

  for (const item of manifestItems) {
    const properties = item.getAttribute("properties") || "";
    if (properties.split(/\s+/).includes("cover-image")) {
      coverId = item.getAttribute("id");
      coverHref = item.getAttribute("href");
      coverMediaType = item.getAttribute("media-type") || null;
      break;
    }
  }

  if (!coverId) {
    return NOT_FOUND;
  }

  // 4. Try epub.resources first (already loaded as base64 by epubix)
  const resource = epub.resources[coverId];
  if (resource && typeof resource.content === "string") {
    const mimeType = coverMediaType || resource.type;
    return {
      found: true,
      dataUrl: `data:${mimeType};base64,${resource.content}`,
      mimeType,
    };
  }

  // 5. Fallback: fetch the image directly from the zip archive
  if (coverHref) {
    const opfFolder = rootfilePath.substring(
      0,
      rootfilePath.lastIndexOf("/") + 1
    );
    const fullPath = opfFolder + coverHref;
    const imageBuffer = await epub.getFile(fullPath);
    if (imageBuffer) {
      const mimeType = coverMediaType || guessMimeType(coverHref);
      const base64 = arrayBufferToBase64(imageBuffer);
      return {
        found: true,
        dataUrl: `data:${mimeType};base64,${base64}`,
        mimeType,
      };
    }
  }

  return NOT_FOUND;
}

/**
 * Extract cover image directly from an EPUB ArrayBuffer.
 * Loads the EPUB and applies the 4-level fallback strategy.
 *
 * @param arrayBuffer - The EPUB file as an ArrayBuffer
 * @returns CoverResult with dataUrl if found, or { found: false, ... }
 */
export async function getCoverAsDataUrl(
  arrayBuffer: ArrayBuffer
): Promise<CoverResult> {
  let epub: Epub;
  try {
    epub = await loadEpubBook(arrayBuffer);
  } catch {
    return NOT_FOUND;
  }

  return getCoverFromEpub(epub);
}

// --- Internal helpers ---

/** Extract MIME type from a data URL like "data:image/jpeg;base64,..." */
function extractMimeTypeFromDataUrl(dataUrl: string): string | null {
  const match = dataUrl.match(/^data:([^;]+);/);
  return match ? match[1] : null;
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
