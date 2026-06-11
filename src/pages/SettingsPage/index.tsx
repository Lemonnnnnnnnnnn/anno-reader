import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/primitives";
import { ProxySection } from "./ProxySection";

export function SettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg dark:bg-bg-dark text-text dark:text-text-dark font-serif">
      {/* Header */}
      <header className="shrink-0 bg-surface dark:bg-surface-dark border-b border-border dark:border-border-dark">
        <div className="flex items-center gap-3 px-6 py-4 max-w-[1200px] mx-auto w-full">
          <Button variant="icon" onClick={() => navigate(-1)} aria-label="Go back">
            <ArrowLeft size={18} />
          </Button>
          <h1 className="text-xl font-semibold text-text dark:text-text-dark tracking-tight m-0">
            Settings
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-[600px] mx-auto flex flex-col gap-6">
          <ProxySection />
          <button
            onClick={() => navigate("/ai-config")}
            className="w-full px-4 py-3 text-sm font-sans font-medium text-left bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md hover:border-accent dark:hover:border-accent-dark transition-colors cursor-pointer text-text dark:text-text-dark"
          >
            AI 配置
          </button>
        </div>
      </main>
    </div>
  );
}
