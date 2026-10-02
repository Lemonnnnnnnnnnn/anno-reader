/**
 * PersonalizationPage component.
 *
 * Settings sub-page for user-facing display preferences. Currently holds
 * the Note Detail panel layout choice (side drawer vs. centered modal).
 */

import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, PanelRight, AppWindow } from "lucide-react";
import { Button } from "@/components/primitives";
import { usePreferencesStore } from "@/stores/usePreferencesStore";
import type { NoteDetailVariant } from "@/components/AnnotationDetailPanel";

const LAYOUT_OPTIONS: Array<{
  value: NoteDetailVariant;
  label: string;
  description: string;
  icon: typeof PanelRight;
}> = [
  {
    value: "drawer",
    label: "侧边抽屉",
    description: "从右侧滑出的窄面板，阅读时可同时看到正文",
    icon: PanelRight,
  },
  {
    value: "modal",
    label: "居中弹窗",
    description: "屏幕中央的宽弹窗，编辑空间更大",
    icon: AppWindow,
  },
];

export function PersonalizationPage() {
  const navigate = useNavigate();
  const noteDetailLayout = usePreferencesStore((s) => s.noteDetailLayout);
  const setNoteDetailLayout = usePreferencesStore((s) => s.setNoteDetailLayout);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg dark:bg-bg-dark text-text dark:text-text-dark font-serif">
      {/* Header */}
      <header className="shrink-0 bg-surface dark:bg-surface-dark border-b border-border dark:border-border-dark">
        <div className="flex items-center gap-3 px-6 py-4 max-w-[1200px] mx-auto w-full">
          <Button variant="icon" onClick={() => navigate(-1)} aria-label="Go back">
            <ArrowLeft size={18} />
          </Button>
          <h1 className="text-xl font-semibold text-text dark:text-text-dark tracking-tight m-0">
            个性化
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-[600px] mx-auto flex flex-col gap-6">
          {/* Note Detail layout */}
          <section>
            <h2 className="text-sm font-sans font-medium text-text-secondary dark:text-text-secondary-dark m-0 mb-2">
              Note Detail 展示方式
            </h2>
            <div className="flex flex-col gap-2">
              {LAYOUT_OPTIONS.map((option) => {
                const selected = noteDetailLayout === option.value;
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => setNoteDetailLayout(option.value)}
                    aria-pressed={selected}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left border rounded-md transition-colors cursor-pointer ${
                      selected
                        ? "border-accent dark:border-accent-dark bg-accent/5 dark:bg-accent-dark/10"
                        : "border-border dark:border-border-dark bg-surface dark:bg-surface-dark hover:border-accent dark:hover:border-accent-dark"
                    }`}
                  >
                    <Icon
                      size={18}
                      className={selected ? "text-accent dark:text-accent-dark" : "text-text-muted dark:text-text-muted-dark"}
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-sans font-medium text-text dark:text-text-dark">
                        {option.label}
                        {option.value === "drawer" && (
                          <span className="ml-2 text-xs font-normal text-text-muted dark:text-text-muted-dark">
                            默认
                          </span>
                        )}
                      </span>
                      <span className="block text-xs font-sans text-text-secondary dark:text-text-secondary-dark mt-0.5">
                        {option.description}
                      </span>
                    </span>
                    {selected && (
                      <Check size={16} className="text-accent dark:text-accent-dark shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs font-sans text-text-muted dark:text-text-muted-dark mt-2 mb-0">
              下次打开 Note Detail 时生效。
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
