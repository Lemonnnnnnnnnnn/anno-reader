/**
 * ChapterRenderer component.
 *
 * Renders EPUB chapter HTML content inside an iframe for CSS isolation.
 * The iframe prevents EPUB styles from leaking into the application UI
 * and vice versa. Provides chapter navigation controls via ChapterNavigation.
 *
 * @example
 * ```tsx
 * <ChapterRenderer chapters={parsedEpub.chapters} resources={epub.resources} />
 * ```
 */

import { useMemo } from "react";
import { useBookStore } from "@/stores/useBookStore";
import type { EpubChapterInfo } from "@/lib/epub";
import type { EpubResource } from "epubix";
import { buildSrcdoc, DEFAULT_BASE_CSS } from "@/lib/css";
import { resolveImagePaths } from "@/lib/images";
import { extractFonts, buildFontFaceCss } from "@/lib/fonts";
import { VerticalScroller } from "./VerticalScroller";
import { ChapterNavigation } from "./ChapterNavigation";

interface ChapterRendererProps {
  /** Array of chapters in reading order */
  chapters: EpubChapterInfo[];
  /** EPUB resources map for image resolution (optional) */
  resources?: Record<string, EpubResource>;
  /** OPF folder for path resolution (optional) */
  opfFolder?: string;
  /** Whether to show the built-in chapter navigation header (default: true) */
  showNav?: boolean;
}

export function ChapterRenderer({ chapters, resources, opfFolder, showNav = true }: ChapterRendererProps) {
  const currentChapterIndex = useBookStore(
    (state) => state.ui.currentChapterIndex,
  );

  const currentChapter = chapters[currentChapterIndex] ?? null;

  // Build srcdoc with EPUB CSS and resolved images
  const srcdoc = useMemo(() => {
    if (!currentChapter) return "";

    // Resolve images if resources are available
    let contentWithImages = currentChapter.content;
    if (resources) {
      contentWithImages = resolveImagePaths(currentChapter.content, resources, {
        opfFolder: opfFolder || "",
        chapterHref: currentChapter.href,
        lazyLoad: true,
      });
    }

    // Extract fonts from resources and generate @font-face CSS
    const fonts = resources ? extractFonts(resources) : [];
    const fontFaceCss = fonts.length > 0 ? buildFontFaceCss(fonts) : undefined;

    const { html } = buildSrcdoc(contentWithImages, {
      baseCss: DEFAULT_BASE_CSS,
      epubCss: currentChapter.cssContent,
      fontFaceCss,
      isolateEpubCss: true,
    });

    return html;
  }, [currentChapter, resources, opfFolder]);

  if (!currentChapter) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        <p className="text-base">No chapter loaded</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Chapter navigation header */}
      {showNav && (
        <ChapterNavigation
          chapters={chapters}
          variant="full"
          showChapterInfo
        />
      )}

      {/* Chapter content with vertical scrolling */}
      <VerticalScroller
        srcdoc={srcdoc}
        chapterIndex={currentChapterIndex}
        chapterHref={currentChapter.href}
        title={currentChapter.title || `Chapter ${currentChapterIndex + 1}`}
      />
    </div>
  );
}
