/**
 * Types for the AI translation module.
 * Simplified: removed AIPrompt, PromptTemplate, custom ContextType.
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
  /** Maximum tokens per request (optional, uses API default if omitted) */
  maxTokens?: number;
  /** Sampling temperature 0–2 (optional, uses API default if omitted) */
  temperature?: number;
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
// Role Types
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
 * An AI role defines how the AI should behave and respond.
 * Contains system message and user message template with {variable} placeholders.
 */
export interface AIRole {
  /** Unique role identifier */
  id: string;
  /** Human-readable role name */
  name: string;
  /** System message that defines AI behavior */
  systemMessage: string;
  /** User message template with {variable} placeholders */
  userMessageTemplate: string;
  /** Interpolatable variables (auto-extracted from template) */
  variables: PromptVariable[];
  /** Whether this is the default role */
  isDefault: boolean;
  /** Whether this role is active and selectable */
  isEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Context Types
// ---------------------------------------------------------------------------

/** Types of context that can be supplied alongside a translation request. */
export type ContextType = "sentence" | "dictionary";

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
  /** Dictionary query results (separate from context text) */
  dictionaryText?: string;
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
  /** Available roles */
  roles: AIRole[];
  /** ID of the currently active role, null if none selected */
  selectedRoleId: string | null;
}

// ---------------------------------------------------------------------------
// Re-export Constants
// ---------------------------------------------------------------------------

export {
  BUILTIN_ROLES,
  READING_ASSISTANT_ROLE,
  TRANSLATOR_ROLE,
} from "./constants";
