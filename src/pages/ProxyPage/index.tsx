/**
 * ProxyPage component.
 *
 * Settings sub-page for proxy configuration. Wraps the ProxySection
 * form (toggle, address, port, connectivity test) with the standard
 * settings page chrome.
 */

import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/primitives";
import { ProxySection } from "./ProxySection";

export function ProxyPage() {
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
            代理设置
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-[600px] mx-auto flex flex-col gap-6">
          <ProxySection />
        </div>
      </main>
    </div>
  );
}
