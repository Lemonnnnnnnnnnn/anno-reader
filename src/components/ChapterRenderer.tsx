/**
 * ChapterRenderer component.
 *
 * Renders EPUB chapter HTML content inside an iframe for CSS isolation.
 * The iframe prevents EPUB styles from leaking into the application UI
 * and vice versa. Provides chapter navigation controls.
 *
 * @example
 * ```tsx
 * <ChapterRenderer chapters={parsedEpub.chapters} resources={epub.resources} />
 * ```
 */

import { useCallback, useMemo } from "react";
import { useBookStore } from "@/stores/useBookStore";
import type { EpubChapterInfo } from "@/lib/epub";
import type { EpubResource } from "epubix";
import { buildSrcdoc, DEFAULT_BASE_CSS } from "@/lib/css";
import { resolveImagePaths } from "@/lib/images";
import { extractFonts, buildFontFaceCss } from "@/lib/fonts";
import { VerticalScroller } from "./VerticalScroller";

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
  const setCurrentChapter = useBookStore((state) => state.setCurrentChapter);

  const currentChapter = chapters[currentChapterIndex] ?? null;
  const totalChapters = chapters.length;

  // Navigate to a specific chapter index
  const goToChapter = useCallback(
    (index: number) => {
      if (index >= 0 && index < totalChapters) {
        const chapter = chapters[index];
        setCurrentChapter(chapter.href, index);
      }
    },
    [chapters, totalChapters, setCurrentChapter],
  );

  // Navigation handlers
  const goToPrevious = useCallback(() => {
    goToChapter(currentChapterIndex - 1);
  }, [currentChapterIndex, goToChapter]);

  const goToNext = useCallback(() => {
    goToChapter(currentChapterIndex + 1);
  }, [currentChapterIndex, goToChapter]);

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
      <div style={styles.empty}>
        <p style={styles.emptyText}>No chapter loaded</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Chapter navigation header */}
      {showNav && (
        <div style={styles.nav}>
        <button
          style={{
            ...styles.navButton,
            ...(currentChapterIndex <= 0 ? styles.navButtonDisabled : {}),
          }}
          onClick={goToPrevious}
          disabled={currentChapterIndex <= 0}
        >
          Previous
        </button>
        <span style={styles.chapterInfo}>
          {currentChapter.title || `Chapter ${currentChapterIndex + 1}`}
          <span style={styles.chapterCount}>
            {" "}
            ({currentChapterIndex + 1} / {totalChapters})
          </span>
        </span>
        <button
          style={{
            ...styles.navButton,
            ...(currentChapterIndex >= totalChapters - 1
              ? styles.navButtonDisabled
              : {}),
          }}
          onClick={goToNext}
          disabled={currentChapterIndex >= totalChapters - 1}
        >
          Next
        </button>
      </div>
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

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.75rem 1rem",
    borderBottom: "1px solid #e5e5e5",
    background: "#fff",
    flexShrink: 0,
  },
  navButton: {
    padding: "0.4rem 1rem",
    fontSize: "0.875rem",
    border: "1px solid #d1d5db",
    borderRadius: "4px",
    background: "#fff",
    cursor: "pointer",
    color: "#374151",
    transition: "background 0.15s",
  },
  navButtonDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
  chapterInfo: {
    fontSize: "0.9rem",
    fontWeight: 500,
    color: "#1f2937",
    textAlign: "center",
  },
  chapterCount: {
    fontWeight: 400,
    color: "#6b7280",
    fontSize: "0.8rem",
  },
  empty: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: "#9ca3af",
  },
  emptyText: {
    fontSize: "1rem",
  },
};
