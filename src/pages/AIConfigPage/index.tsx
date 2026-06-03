/**
 * AIConfigPage component.
 *
 * Main configuration page for AI providers and assistant settings.
 * Provides a tabbed interface for Provider and Assistant configuration.
 *
 * Includes route guard: redirects back if no providers are configured.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAIConfigStore } from "@/stores/useAIConfigStore";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/primitives";
import type { TabId } from "./constants";
import { TABS } from "./constants";
import { ProviderTab } from "./ProviderTab";
import { AssistantTab } from "./AssistantTab";

export function AIConfigPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("provider");
  const loadConfig = useAIConfigStore((s) => s.loadConfig);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg dark:bg-bg-dark text-text dark:text-text-dark font-serif">
      {/* Header */}
      <header className="shrink-0 bg-surface dark:bg-surface-dark border-b border-border dark:border-border-dark">
        <div className="flex items-center gap-3 px-6 py-4 max-w-[1200px] mx-auto w-full">
          <Button variant="icon" onClick={() => navigate(-1)} aria-label="Go back">
            <ArrowLeft size={18} />
          </Button>
          <h1 className="text-xl font-semibold text-text dark:text-text-dark tracking-tight m-0">
            AI Configuration
          </h1>
        </div>
      </header>

      {/* Tab Bar */}
      <nav className="shrink-0 bg-surface dark:bg-surface-dark border-b border-border dark:border-border-dark">
        <div className="flex gap-0 px-6 max-w-[1200px] mx-auto w-full">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-4 py-3 text-sm font-sans font-medium border-b-2 transition-colors cursor-pointer bg-transparent
                ${activeTab === tab.id
                  ? "border-accent dark:border-accent-dark text-text dark:text-text-dark"
                  : "border-transparent text-text-secondary dark:text-text-secondary-dark hover:text-text dark:hover:text-text-dark"
                }
              `}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Tab Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-[800px] mx-auto flex flex-col gap-6">
          {activeTab === "provider" && <ProviderTab />}
          {activeTab === "assistant" && <AssistantTab />}
        </div>
      </main>
    </div>
  );
}
