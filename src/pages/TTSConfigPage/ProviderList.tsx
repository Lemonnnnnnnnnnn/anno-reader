/**
 * ProviderList component.
 *
 * Displays configured TTS providers as cards with set-as-default,
 * edit, and delete actions. Browser SpeechSynthesis is shown as
 * a built-in provider (not editable or deletable).
 */

import { useCallback, useState } from "react";
import { useTTSConfigStore } from "@/stores/useTTSConfigStore";
import { BROWSER_PROVIDER } from "@/lib/tts/constants";
import type { TTSProvider } from "@/lib/tts/types";
import { Button } from "@/components/primitives";

/** Props for the ProviderList component. */
export interface ProviderListProps {
  /** Called when the user wants to edit a provider. */
  onEdit: (provider: TTSProvider) => void;
}

/**
 * Identifies the built-in browser provider.
 * This provider cannot be edited or deleted.
 */
const BROWSER_PROVIDER_ID = BROWSER_PROVIDER.id;

export function ProviderList({ onEdit }: ProviderListProps) {
  const { config, removeProvider, setSelectedProvider } = useTTSConfigStore();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleDelete = useCallback(
    (id: string) => {
      // Prevent deleting the last provider
      if (config.providers.length <= 1) {
        return;
      }

      if (pendingDeleteId === id) {
        // Second click — confirm delete
        removeProvider(id);
        setPendingDeleteId(null);
      } else {
        // First click — show confirmation state
        setPendingDeleteId(id);
      }
    },
    [config.providers.length, pendingDeleteId, removeProvider],
  );

  const handleCancelDelete = useCallback(() => {
    setPendingDeleteId(null);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {config.providers.map((provider) => {
        const isBuiltIn = provider.id === BROWSER_PROVIDER_ID;
        const isDefault = config.selectedProviderId === provider.id;
        const isPendingDelete = pendingDeleteId === provider.id;
        const isLastProvider = config.providers.length <= 1;

        return (
          <div
            key={provider.id}
            className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md p-4 flex items-center justify-between"
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-sans font-medium text-text dark:text-text-dark">
                  {provider.name}
                </span>
                {isBuiltIn && (
                  <span className="text-xs font-sans px-1.5 py-0.5 bg-muted dark:bg-muted-dark text-text-secondary dark:text-text-secondary-dark rounded">
                    内置
                  </span>
                )}
                {isDefault && (
                  <span className="text-xs font-sans px-1.5 py-0.5 bg-accent dark:bg-accent-dark text-white rounded">
                    Default
                  </span>
                )}
              </div>
              <span className="text-xs font-sans text-text-secondary dark:text-text-secondary-dark">
                {provider.type}
                {provider.voice && ` · ${provider.voice}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!isDefault && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedProvider(provider.id)}
                >
                  Set as Default
                </Button>
              )}
              {!isBuiltIn && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onEdit(provider)}
                  >
                    Edit
                  </Button>
                  {isPendingDelete ? (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDelete(provider.id)}
                        disabled={isLastProvider}
                      >
                        Confirm
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleCancelDelete}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDelete(provider.id)}
                      disabled={isLastProvider}
                    >
                      Delete
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}

      {config.providers.length === 0 && (
        <p className="text-sm text-text-secondary text-center py-8">
          No providers configured. Add one to get started.
        </p>
      )}
    </div>
  );
}
