/**
 * WebPageRenderer component.
 *
 * Renders web page content inside an iframe for CSS isolation,
 * following the same pattern as ChapterRenderer but for web content.
 * Uses ContentSource for unified content representation and
 * ContentRef for annotation tracking.
 *
 * @example
 * ```tsx
 * <WebPageRenderer
 *   contentSource={webPage}
 *   contentRef={{ collectionId: "web-collection", sourceId: "https://example.com" }}
 *   onAskAI={handleAskAI}
 * />
 * ```
 */

import { useMemo } from "react";
import { useBookStore } from "@/stores/useBookStore";
import { buildSrcdoc } from "@/lib/css";
import { VerticalScroller } from "./VerticalScroller";
import type { ContentSource, ContentRef } from "@/lib/content/types";

interface WebPageRendererProps {
  /** Content source to render */
  contentSource: ContentSource;
  /** Content reference for annotation tracking */
  contentRef: ContentRef;
  /** Callback to expose the iframe element ref to parent components */
  onIframeRef?: (ref: HTMLIFrameElement | null) => void;
  /** Callback when user clicks "Ask AI" in selection toolbar */
  onAskAI?: (selectedText: string) => void;
  /** Callback when an inline link is clicked */
  onLinkClick?: (href: string) => void;
  /** Whether link navigation has a previous location to return to */
  canGoBack?: boolean;
  /** Callback when user clicks the link-navigation back button */
  onLinkBack?: () => void;
}

/**
 * Build srcdoc for web page content.
 * Uses the web page's own CSS (if any) without EPUB-specific processing.
 */
function buildWebSrcdoc(html: string, css: string | undefined, theme: "light" | "dark"): string {
  const { html: srcdoc } = buildSrcdoc(html, {
    epubCss: css ? [css] : [],
    isolateEpubCss: false,
    theme,
  });
  return srcdoc;
}

export function WebPageRenderer({
  contentSource,
  contentRef,
  onIframeRef,
  onAskAI,
  onLinkClick,
  canGoBack,
  onLinkBack,
}: WebPageRendererProps) {
  const theme = useBookStore((state) => state.ui.theme);

  const srcdoc = useMemo(
    () => buildWebSrcdoc(contentSource.html, contentSource.css, theme),
    [contentSource.html, contentSource.css, theme],
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <VerticalScroller
        srcdoc={srcdoc}
        chapterText={contentSource.plainText}
        chapterIndex={0}
        chapterHref={contentRef.sourceId}
        title={contentSource.title}
        onIframeRef={onIframeRef}
        onAskAI={onAskAI}
        onLinkClick={onLinkClick}
        canGoBack={canGoBack}
        onLinkBack={onLinkBack}
      />
    </div>
  );
}
