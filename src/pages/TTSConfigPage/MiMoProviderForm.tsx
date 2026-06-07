/**
 * MiMoProviderForm component.
 *
 * Configuration form for MiMo TTS provider with fields for
 * name, base URL, API key, model, and voice selection.
 */

import { useState } from "react";
import { Button } from "@/components/primitives";
import { MIMO_VOICES } from "@/lib/tts/constants";
import type { TTSProvider } from "@/lib/tts/types";

interface MiMoProviderFormProps {
  /** Existing provider data for editing, or undefined for new provider */
  provider?: TTSProvider;
  /** Called when the form is saved */
  onSave: (provider: TTSProvider) => void;
  /** Called when the form is cancelled */
  onCancel: () => void;
}

const DEFAULT_BASE_URL = "https://api.xiaomimimo.com/v1";
const DEFAULT_MODEL = "mimo-v2.5-tts";

export function MiMoProviderForm({ provider, onSave, onCancel }: MiMoProviderFormProps) {
  const [name, setName] = useState(provider?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? DEFAULT_BASE_URL);
  const [apiKey, setApiKey] = useState(provider?.apiKey ?? "");
  const [model, setModel] = useState(provider?.model ?? DEFAULT_MODEL);
  const [voice, setVoice] = useState(provider?.voice ?? MIMO_VOICES[0].id);

  const handleSave = () => {
    onSave({
      id: provider?.id ?? crypto.randomUUID(),
      name: name.trim(),
      type: "mimo",
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      model: model.trim(),
      voice,
      enabled: provider?.enabled ?? true,
    });
  };

  return (
    <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md p-4 flex flex-col gap-3">
      <h3 className="text-sm font-sans font-medium text-text dark:text-text-dark m-0">
        {provider ? "Edit MiMo Provider" : "Add MiMo Provider"}
      </h3>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-sans text-text-secondary dark:text-text-secondary-dark">
          Name
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="px-3 py-1.5 text-sm font-sans bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md outline-none focus:border-accent dark:focus:border-accent-dark text-text dark:text-text-dark"
          placeholder="MiMo TTS"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-sans text-text-secondary dark:text-text-secondary-dark">
          Base URL
        </span>
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          className="px-3 py-1.5 text-sm font-sans bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md outline-none focus:border-accent dark:focus:border-accent-dark text-text dark:text-text-dark"
          placeholder={DEFAULT_BASE_URL}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-sans text-text-secondary dark:text-text-secondary-dark">
          API Key
        </span>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="px-3 py-1.5 text-sm font-sans bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md outline-none focus:border-accent dark:focus:border-accent-dark text-text dark:text-text-dark"
          placeholder="sk-..."
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-sans text-text-secondary dark:text-text-secondary-dark">
          Model
        </span>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="px-3 py-1.5 text-sm font-sans bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md outline-none focus:border-accent dark:focus:border-accent-dark text-text dark:text-text-dark"
          placeholder={DEFAULT_MODEL}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-sans text-text-secondary dark:text-text-secondary-dark">
          Voice
        </span>
        <select
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          className="px-3 py-1.5 text-sm font-sans bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md outline-none focus:border-accent dark:focus:border-accent-dark text-text dark:text-text-dark"
        >
          {MIMO_VOICES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} ({v.language})
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-2 justify-end pt-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!name.trim()}>
          {provider ? "Save" : "Add"}
        </Button>
      </div>
    </div>
  );
}
