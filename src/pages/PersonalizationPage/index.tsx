/**
 * PersonalizationPage component.
 *
 * Settings sub-page for user-facing display preferences: the Note Detail
 * panel layout (side drawer vs. centered modal) and the AI Chat panel
 * layout.
 */

import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, PanelRight, AppWindow } from "lucide-react";
import { Button } from "@/components/primitives";
import {
  usePreferencesStore,
  type PanelLayout,
} from "@/stores/usePreferencesStore";

const LAYOUT_OPTIONS: Array<{
  value: PanelLayout;
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
    description: "屏幕中央的宽弹窗，空间更大",
    icon: AppWindow,
  },
];

interface LayoutSectionProps {
  /** Section heading */
  title: string;
  /** Currently selected layout */
  value: PanelLayout;
  /** The layout that ships as default (marked with a "默认" badge) */
  defaultLayout: PanelLayout;
  /** Persisted selection change */
  onChange: (layout: PanelLayout) => void;
}

function LayoutSection({
  title,
  value,
  defaultLayout,
  onChange,
}: LayoutSectionProps) {
  return (
    <section>
      <h2 className="text-sm font-sans font-medium text-text-secondary dark:text-text-secondary-dark m-0 mb-2">
        {title}
      </h2>
      <div className="flex flex-col gap-2">
        {LAYOUT_OPTIONS.map((option) => {
          const selected = value === option.value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left border rounded-md transition-colors cursor-pointer ${
                selected
                  ? "border-accent dark:border-accent-dark bg-accent/5 dark:bg-accent-dark/10"
                  : "border-border dark:border-border-dark bg-surface dark:bg-surface-dark hover:border-accent dark:hover:border-accent-dark"
              }`}
            >
              <Icon
                size={18}
                className={
                  selected
                    ? "text-accent dark:text-accent-dark"
                    : "text-text-muted dark:text-text-muted-dark"
                }
              />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-sans font-medium text-text dark:text-text-dark">
                  {option.label}
                  {option.value === defaultLayout && (
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
                <Check
                  size={16}
                  className="text-accent dark:text-accent-dark shrink-0"
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function PersonalizationPage() {
  const navigate = useNavigate();
  const noteDetailLayout = usePreferencesStore((s) => s.noteDetailLayout);
  const setNoteDetailLayout = usePreferencesStore((s) => s.setNoteDetailLayout);
  const chatLayout = usePreferencesStore((s) => s.chatLayout);
  const setChatLayout = usePreferencesStore((s) => s.setChatLayout);

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
        <div className="max-w-[600px] mx-auto flex flex-col gap-8">
          <LayoutSection
            title="Note Detail 展示方式"
            value={noteDetailLayout}
            defaultLayout="drawer"
            onChange={setNoteDetailLayout}
          />

          <LayoutSection
            title="AI Chat 展示方式"
            value={chatLayout}
            defaultLayout="modal"
            onChange={setChatLayout}
          />
        </div>
      </main>
    </div>
  );
}
