# Anno Reader

Minimalist EPUB reader with AI translation. Built with Tauri 2 (Rust) and React 19.

## Features

- EPUB reading with chapter navigation and progress tracking
- Annotations: highlights and notes with persistence
- AI-powered text translation (OpenAI-compatible providers)

## AI Translation

Select text while reading and get instant translations via a configured AI provider.

**Supported providers:** Any OpenAI-compatible API (OpenAI, DeepSeek, Ollama, etc.)

**Configuration:**
1. Open the AI Config page from the settings panel
2. Add a provider with your API base URL, key, and model name
3. Select the provider and set a default target language

The translation panel appears automatically when you select text in the reader. Translations use surrounding paragraph context for better accuracy, and results are cached in memory for repeated lookups.

For more details on the AI module internals, see `src/lib/ai/README.md`.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
