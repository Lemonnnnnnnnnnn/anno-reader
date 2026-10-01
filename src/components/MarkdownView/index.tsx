/**
 * Unified markdown rendering layer.
 *
 * Thin wrapper around react-markdown with GFM support so every surface that
 * displays markdown (note detail, note previews, chat messages, AI summaries)
 * goes through one component. Pair with `.markdown-note` styles (App.css) and,
 * for editing, the MarkdownEditor component which loads/stores the same
 * markdown format.
 *
 * @example
 * ```tsx
 * <MarkdownView className="text-sm leading-relaxed markdown-note" content={note.content} />
 * ```
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownViewProps {
  /** Markdown source to render */
  content: string;
  /** Classes for the wrapper element (layout + typography per call site) */
  className?: string;
}

export function MarkdownView({ content, className = "" }: MarkdownViewProps) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
