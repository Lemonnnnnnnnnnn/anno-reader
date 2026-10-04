import { useEffect, useState } from "react";
import { usePreferencesStore } from "@/stores/usePreferencesStore";
import { injectCssIntoIframe } from "@/lib/css";

export function chapterPercentage(top: number, height: number, viewport: number): number {
  if (height <= 0) return 0;
  const travel = height - viewport;
  return travel <= 0 ? 100 : Math.round(Math.max(0, Math.min(1, top / travel)) * 100);
}

interface Props {
  target: HTMLElement | null;
  chapterTitle: string;
  chapterNumber: number;
  isPdf?: boolean;
}

/** A quiet edge affordance: native scrolling stays intact, only its chrome changes. */
export function ChapterProgressRail({ target, chapterTitle, chapterNumber, isPdf }: Props) {
  const hidden = usePreferencesStore(s => s.hideReadingScrollbar);
  const [percentage, setPercentage] = useState(0);
  useEffect(() => {
    if (!target) return;
    let dispose = () => undefined;
    function attach() {
      dispose();
      const iframe = target instanceof HTMLIFrameElement ? target : null;
      const scrollEl = iframe ? iframe.contentDocument?.scrollingElement : target;
      const eventTarget = iframe ? iframe.contentWindow : target;
      if (!scrollEl || !eventTarget) return;
      if (iframe) {
        injectCssIntoIframe(iframe, hidden
          ? "html, body { scrollbar-width: none !important; } html::-webkit-scrollbar, body::-webkit-scrollbar { display: none !important; }"
          : "", "reading-scrollbar-preference");
      } else target?.classList.toggle("reader-scrollbar-hidden", hidden);
      let frame = 0;
      const update = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => setPercentage(chapterPercentage(scrollEl.scrollTop, scrollEl.scrollHeight, scrollEl.clientHeight)));
      };
      eventTarget.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update);
      const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
      observer?.observe(scrollEl);
      if (iframe?.contentDocument?.body) observer?.observe(iframe.contentDocument.body);
      else if (target?.firstElementChild) observer?.observe(target.firstElementChild);
      update();
      dispose = () => {
        cancelAnimationFrame(frame);
        eventTarget.removeEventListener("scroll", update);
        window.removeEventListener("resize", update);
        observer?.disconnect();
      };
    }
    target.addEventListener("load", attach);
    attach();
    return () => {
      dispose();
      target.removeEventListener("load", attach);
      target.classList.remove("reader-scrollbar-hidden");
    };
  }, [target, hidden, chapterNumber, chapterTitle]);
  if (!hidden) return null;
  return (
    <aside className="group absolute right-0 top-16 bottom-16 z-30 w-8 flex items-center justify-end outline-none" tabIndex={0} aria-label={`${isPdf ? "本页" : "本章"}进度 ${percentage}%`}>
      <div className="pointer-events-none shrink-0 mr-2 flex items-center gap-3 opacity-0 translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 group-focus:opacity-100 group-focus:translate-x-0 motion-reduce:transition-none">
        <div className="w-36 rounded-2xl border border-border/60 dark:border-border-dark/60 bg-surface/90 dark:bg-surface-dark/90 backdrop-blur-md shadow-lg px-4 py-3 text-right">
          <p className="m-0 text-[10px] tracking-widest text-text-muted dark:text-text-muted-dark font-sans">{isPdf ? "本页" : "本章"} · {String(chapterNumber).padStart(2, "0")}</p>
          <p className="m-0 mt-1 text-2xl font-serif text-accent dark:text-accent-dark tabular-nums">{percentage}<span className="text-xs ml-1">%</span></p>
          <p className="m-0 mt-1 text-xs text-text-secondary dark:text-text-secondary-dark line-clamp-2 break-words">{chapterTitle}</p>
          <p className="m-0 mt-2 text-[10px] text-text-muted dark:text-text-muted-dark">{percentage === 100 ? "已抵达末尾" : percentage === 0 ? "从这里开始" : "阅读正在发生"}</p>
        </div>
        <svg width="12" height="208" viewBox="0 0 12 208" className="shrink-0 text-accent dark:text-accent-dark" aria-hidden="true">
          <line x1="6" x2="6" y1="4" y2="204" stroke="currentColor" strokeWidth="2" opacity="0.18" />
          <line x1="6" x2="6" y1="4" y2={4 + percentage * 2} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="6" cy={4 + percentage * 2} r="4" fill="currentColor" />
        </svg>
      </div>
    </aside>
  );
}
