/**
 * Types for the AI translation module.
 * These types define provider configuration, prompt templates,
 * context modules, and the root AI configuration.
 */

// ---------------------------------------------------------------------------
// Provider Types
// ---------------------------------------------------------------------------

/** Supported AI provider types. */
export type ProviderType = "openai";

/**
 * Configuration for a single AI provider.
 * Stores connection details, model selection, and generation parameters.
 */
export interface AIProvider {
  /** Unique provider identifier */
  id: string;
  /** Human-readable provider name */
  name: string;
  /** Provider backend type */
  type: ProviderType;
  /** API base URL (e.g. https://api.openai.com/v1) */
  baseUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Model identifier (e.g. gpt-4o) */
  model: string;
  /** Maximum tokens per request */
  maxTokens: number;
  /** Sampling temperature (0–2) */
  temperature: number;
  /** Whether this provider is active */
  enabled: boolean;
}

/**
 * Runtime connectivity status for a provider.
 */
export interface ProviderStatus {
  /** Whether the provider is currently reachable */
  isConnected: boolean;
  /** Unix timestamp of last connectivity check, null if never checked */
  lastChecked: number | null;
  /** Error message from the last failed check, null if OK */
  errorMessage: string | null;
}

// ---------------------------------------------------------------------------
// Prompt Types
// ---------------------------------------------------------------------------

/**
 * A single variable that can be interpolated into a prompt template.
 */
export interface PromptVariable {
  /** Variable name used in template placeholders (e.g. "selectedText") */
  name: string;
  /** Human-readable description of what this variable represents */
  description: string;
  /** Default value if the variable is not supplied */
  defaultValue: string;
  /** Whether this variable must be provided before sending */
  isRequired: boolean;
}

/**
 * A user-configurable AI prompt stored in settings.
 */
export interface AIPrompt {
  /** Unique prompt identifier */
  id: string;
  /** Display name */
  name: string;
  /** Prompt template content with {variable} placeholders */
  content: string;
  /** Interpolatable variables */
  variables: PromptVariable[];
  /** Whether this is the default prompt for its category */
  isDefault: boolean;
  /** Whether this prompt is active and selectable */
  isEnabled: boolean;
}

/**
 * A built-in or system prompt template.
 * Differs from AIPrompt by having a category instead of isDefault/isEnabled.
 */
export interface PromptTemplate {
  /** Unique template identifier */
  id: string;
  /** Display name */
  name: string;
  /** Template content with {variable} placeholders */
  content: string;
  /** Interpolatable variables */
  variables: PromptVariable[];
  /** Functional category (e.g. "translation", "summarization") */
  category: string;
}

// ---------------------------------------------------------------------------
// Context Types
// ---------------------------------------------------------------------------

/** Types of context that can be supplied alongside a translation request. */
export type ContextType = "sentence" | "dictionary" | "custom";

/**
 * A context module that provides surrounding text or metadata
 * to improve translation quality.
 */
export interface ContextModule {
  /** Unique module identifier */
  id: string;
  /** Display name */
  name: string;
  /** How the context is sourced */
  type: ContextType;
  /** Description or instructions for this context module */
  content: string;
  /** Whether this module is active */
  isEnabled: boolean;
  /** For dictionary type: specific provider ID to query (optional) */
  providerId?: string;
}

/**
 * Configuration for which context modules are available and selected.
 */
export interface ContextConfig {
  /** All available context modules */
  modules: ContextModule[];
  /** IDs of currently selected modules */
  selectedModuleIds: string[];
}

/**
 * Debug information from dictionary query.
 */
export interface DictionaryDebugInfo {
  /** Results from each dictionary provider */
  results: import("@/lib/dictionaries").DictionaryResult[];
  /** Errors from failed providers */
  errors: import("@/lib/dictionaries").AggregatedDictionaryError[];
  /** Total query duration in milliseconds */
  duration: number;
}

/**
 * Resolved context data ready to be injected into a prompt.
 */
export interface ContextData {
  /** The context text content */
  text: string;
  /** Arbitrary key-value metadata (e.g. chapter title, word count) */
  metadata: Record<string, string>;
  /** Which module or source produced this context */
  source: string;
  /** Debug information (optional, for preview mode) */
  debug?: {
    /** Dictionary query results */
    dictionary?: DictionaryDebugInfo;
    /** Sentence context before truncation */
    sentenceContext?: string;
  };
}

// ---------------------------------------------------------------------------
// AI Config (root)
// ---------------------------------------------------------------------------

/**
 * Root configuration object for the AI translation feature.
 * Persisted as a JSON file in the app's data directory.
 */
export interface AIConfig {
  /** All configured providers */
  providers: AIProvider[];
  /** ID of the currently active provider, null if none selected */
  selectedProviderId: string | null;
  /** Context module configuration */
  contextConfig: ContextConfig;
  /** User-configured prompts */
  prompts: AIPrompt[];
}

// ---------------------------------------------------------------------------
// Built-in Constants
// ---------------------------------------------------------------------------

/** Default translation prompt template with standard variables. */
export const DEFAULT_TRANSLATION_PROMPT: PromptTemplate = {
  id: "default-translation",
  name: "Translation",
  content:
    "Translate the following text to {targetLanguage}. Provide a concise interpretation that captures the meaning and nuance in context, not just a literal translation.\n\nText to translate:\n{selectedText}",
  variables: [
    {
      name: "selectedText",
      description: "The text selected by the user",
      defaultValue: "",
      isRequired: true,
    },
    {
      name: "targetLanguage",
      description: "Target language for translation",
      defaultValue: "Chinese",
      isRequired: true,
    },
  ],
  category: "translation",
};

/** Built-in context module that uses the selected sentence as context. */
export const BUILTIN_SENTENCE_CONTEXT: ContextModule = {
  id: "builtin-sentence",
  name: "Sentence Context",
  type: "sentence",
  content: "Extracts the surrounding paragraph from chapter text for richer context.",
  isEnabled: true,
};

/** Built-in dictionary context modules. */
export const BUILTIN_DICTIONARY_MODULES: ContextModule[] = [
  {
    id: "builtin-etymonline",
    name: "Etymonline (词源)",
    type: "dictionary",
    content: "Etymology and word origins from Etymonline",
    isEnabled: true,
    providerId: "etymonline",
  },
  {
    id: "builtin-vocabulary",
    name: "Vocabulary.com",
    type: "dictionary",
    content: "Definitions from Vocabulary.com dictionary",
    isEnabled: true,
    providerId: "vocabulary",
  },
];
