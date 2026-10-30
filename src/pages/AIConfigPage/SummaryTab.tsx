/**
 * SummaryTab component.
 *
 * Chapter summary preferences: output language (follow book / Chinese /
 * English) and level of detail (brief / detailed). Changes are persisted
 * to AIConfig immediately and apply on the next summary generation.
 */

import { useAIConfigStore } from "@/stores/useAIConfigStore";
import type { SummaryLanguage, SummaryDetail } from "@/lib/summaries/types";

const LANGUAGE_OPTIONS: {
  value: SummaryLanguage;
  label: string;
  description: string;
}[] = [
  {
    value: "auto",
    label: "跟随书籍语言",
    description: "正文是英文就用英文总结，是中文就用中文总结。",
  },
  {
    value: "chinese",
    label: "中文",
    description: "始终用简体中文总结，专有名词保留原文并附译名。",
  },
  {
    value: "english",
    label: "English",
    description: "Always summarize in English, keeping proper nouns faithful to the text.",
  },
];

const DETAIL_OPTIONS: {
  value: SummaryDetail;
  label: string;
  description: string;
}[] = [
  {
    value: "brief",
    label: "简洁",
    description: "一句话核心概述 + 3-6 条要点，快速回顾章节内容。",
  },
  {
    value: "detailed",
    label: "详细",
    description: "分节展开，保留关键细节、人物动机与论证过程。",
  },
];

interface PreferenceOption<T extends string> {
  value: T;
  label: string;
  description: string;
}

function PreferenceGroup<T extends string>({
  title,
  hint,
  options,
  selected,
  onSelect,
}: {
  title: string;
  hint: string;
  options: PreferenceOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <section>
      <h2 className="text-sm font-sans font-semibold text-text m-0 mb-1">
        {title}
      </h2>
      <p className="text-xs font-sans text-text-secondary dark:text-text-secondary-dark mb-3 mt-0">
        {hint}
      </p>
      <div className="flex flex-col gap-3">
        {options.map((option) => {
          const isSelected = selected === option.value;
          return (
            <div
              key={option.value}
              className={`
                bg-surface dark:bg-surface-dark border rounded-md p-4 transition-all
                ${isSelected
                  ? "border-accent dark:border-accent-dark ring-1 ring-accent dark:ring-accent-dark"
                  : "border-border dark:border-border-dark"
                }
              `}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`
                    w-4 h-4 rounded-full border-2 flex items-center justify-center mt-1 cursor-pointer shrink-0
                    ${isSelected
                      ? "border-accent dark:border-accent-dark"
                      : "border-border dark:border-border-dark hover:border-text-secondary dark:hover:border-text-secondary-dark"
                    }
                  `}
                  onClick={() => onSelect(option.value)}
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={option.label}
                >
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-accent dark:bg-accent-dark" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-sans font-medium text-text dark:text-text-dark">
                    {option.label}
                  </span>
                  <p className="text-xs font-sans text-text-secondary dark:text-text-secondary-dark mt-1 m-0">
                    {option.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function SummaryTab() {
  const summaryPreferences = useAIConfigStore(
    (s) => s.config.summaryPreferences,
  );
  const updateSummaryPreferences = useAIConfigStore(
    (s) => s.updateSummaryPreferences,
  );

  return (
    <div className="flex flex-col gap-6" role="tabpanel" aria-label="Summary configuration">
      <PreferenceGroup<SummaryLanguage>
        title="总结语言"
        hint="生成章节总结时使用的语言。"
        options={LANGUAGE_OPTIONS}
        selected={summaryPreferences.language}
        onSelect={(language) => updateSummaryPreferences({ language })}
      />

      <PreferenceGroup<SummaryDetail>
        title="总结详略"
        hint="总结内容的详细程度。"
        options={DETAIL_OPTIONS}
        selected={summaryPreferences.detail}
        onSelect={(detail) => updateSummaryPreferences({ detail })}
      />

      <p className="text-xs font-sans text-text-secondary dark:text-text-secondary-dark m-0">
        偏好在下次生成或重新生成总结时生效。在阅读页的总结卡片中切换语言会自动重新生成当前总结。
      </p>
    </div>
  );
}
