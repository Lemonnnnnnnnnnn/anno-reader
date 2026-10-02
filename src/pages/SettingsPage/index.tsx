import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Database,
  Info,
  Palette,
  Sparkles,
  Globe,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/primitives";
import { useUpdateStore } from "@/stores/useUpdateStore";

interface SettingsEntry {
  /** Route path to navigate to */
  to: string;
  /** Entry label */
  label: string;
  icon: LucideIcon;
}

const ENTRIES: SettingsEntry[] = [
  { to: "/personalization", label: "个性化", icon: Palette },
  { to: "/ai-config", label: "AI 配置", icon: Sparkles },
  { to: "/proxy", label: "代理设置", icon: Globe },
  { to: "/data-sync", label: "数据与同步", icon: Database },
  { to: "/about", label: "关于", icon: Info },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const updateAvailable = useUpdateStore((s) => s.status === "available");

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg dark:bg-bg-dark text-text dark:text-text-dark font-serif">
      {/* Header */}
      <header className="shrink-0 bg-surface dark:bg-surface-dark border-b border-border dark:border-border-dark">
        <div className="flex items-center gap-3 px-6 py-4 max-w-[1200px] mx-auto w-full">
          <Button variant="icon" onClick={() => navigate(-1)} aria-label="Go back">
            <ArrowLeft size={18} />
          </Button>
          <h1 className="text-xl font-semibold text-text dark:text-text-dark tracking-tight m-0">
            设置
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-[600px] mx-auto flex flex-col gap-2">
          {ENTRIES.map(({ to, label, icon: Icon }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-sans font-medium text-left bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md hover:border-accent dark:hover:border-accent-dark transition-colors cursor-pointer text-text dark:text-text-dark"
            >
              <Icon size={18} className="text-text-muted dark:text-text-muted-dark shrink-0" />
              <span>{label}</span>
              {to === "/about" && updateAvailable && (
                <span className="text-xs font-medium text-error dark:text-error-dark">
                  有更新
                </span>
              )}
              <ChevronRight
                size={16}
                className="ml-auto text-text-muted dark:text-text-muted-dark shrink-0"
              />
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
