# AI Translation Module

Handles AI-powered text translation for selected EPUB content. Uses OpenAI-compatible APIs.

## Structure

```
ai/
├── types.ts            # All type definitions and built-in constants
├── service.ts          # AITranslationService interface + error types
├── translation.ts      # Core orchestrator (context → prompt → provider)
├── context.ts          # ContextService: extracts surrounding text for better translations
├── prompts.ts          # PromptService: renders templates with variable interpolation
├── cache.ts            # TranslationCache: in-memory Map keyed by text+language
├── error-handler.ts    # AIErrorHandler: classifies errors, provides user-friendly messages
└── providers/
    └── openai.ts       # OpenAIProvider: implements AITranslationService for OpenAI-compatible APIs
```

## Data Flow

```
User selects text
  → AITranslationPanel captures selection
  → TranslationService.translate()
    → ContextService.getContext()       # extracts paragraph around selection
    → PromptService.renderPrompt()      # fills {selectedText}, {context}, {targetLanguage}
    → OpenAIProvider.translate()        # POST to /chat/completions
  → Response cached in TranslationCache
  → Panel displays translation
```

## Key Types

| Type | File | Purpose |
|------|------|---------|
| `AIProvider` | types.ts | Provider config (baseUrl, apiKey, model, temperature) |
| `AIPrompt` | types.ts | User-configurable prompt template with variables |
| `ContextModule` | types.ts | Context source (paragraph, chapter, custom text) |
| `AIConfig` | types.ts | Root config persisted as JSON |
| `AITranslationService` | service.ts | Interface all providers implement |
| `TranslationRequest/Response` | service.ts | Request/response contracts |
| `AIServiceError` | service.ts | Classified error with code + retryable flag |

## Configuration

`AIConfig` is the root settings object, stored as a JSON file. It contains:
- `providers[]` — list of configured AI backends
- `selectedProviderId` — which provider is active
- `contextConfig` — which context modules are enabled
- `prompts[]` — user-defined prompt templates

## Adding a New Provider

1. Create `providers/yourprovider.ts`
2. Implement `AITranslationService` (translate + testConnection)
3. Add your type to `ProviderType` union in `types.ts`
4. Register in `translation.ts` constructor
