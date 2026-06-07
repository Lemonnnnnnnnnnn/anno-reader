/**
 * TTSConfigPage component.
 *
 * Configuration page for Text-to-Speech providers.
 * Lists configured TTS providers and allows adding new ones.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTTSConfigStore } from "@/stores/useTTSConfigStore";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/primitives";
import { ProviderList } from "./ProviderList";
import { MiMoProviderForm } from "./MiMoProviderForm";
import type { TTSProvider } from "@/lib/tts/types";

export function TTSConfigPage() {
  const navigate = useNavigate();
  const { isLoaded, loadConfig, addProvider, updateProvider } = useTTSConfigStore();
  const [showForm, setShowForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<TTSProvider | undefined>(undefined);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleEdit = (provider: TTSProvider) => {
    setEditingProvider(provider);
    setShowForm(true);
  };

  const handleSave = (provider: TTSProvider) => {
    if (editingProvider) {
      updateProvider(editingProvider.id, provider);
    } else {
      addProvider(provider);
    }
    setShowForm(false);
    setEditingProvider(undefined);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingProvider(undefined);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg dark:bg-bg-dark text-text dark:text-text-dark font-serif">
      {/* Header */}
      <header className="shrink-0 bg-surface dark:bg-surface-dark border-b border-border dark:border-border-dark">
        <div className="flex items-center gap-3 px-6 py-4 max-w-[1200px] mx-auto w-full">
          <Button variant="icon" onClick={() => navigate("/settings")} aria-label="Go back">
            <ArrowLeft size={18} />
          </Button>
          <h1 className="text-xl font-semibold text-text dark:text-text-dark tracking-tight m-0">
            TTS 配置
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-[800px] mx-auto flex flex-col gap-6">
          {/* Provider List Section */}
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-text dark:text-text-dark m-0">
              语音引擎
            </h2>

            {!isLoaded && (
              <p className="text-sm text-text-secondary dark:text-text-secondary-dark text-center py-8">
                加载中...
              </p>
            )}

            {isLoaded && !showForm && (
              <ProviderList onEdit={handleEdit} />
            )}

            {showForm && (
              <MiMoProviderForm
                provider={editingProvider}
                onSave={handleSave}
                onCancel={handleCancel}
              />
            )}

            {/* Add Provider Button */}
            {!showForm && (
              <Button
                variant="secondary"
                disabled={!isLoaded}
                onClick={() => {
                  setEditingProvider(undefined);
                  setShowForm(true);
                }}
              >
                添加语音引擎
              </Button>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
