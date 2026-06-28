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

## Release

Version numbers are synchronized across `package.json` and `src-tauri/Cargo.toml`. The `tauri.conf.json` reads the version from `Cargo.toml` automatically.

```bash
# 1. Bump version (updates both package.json and Cargo.toml)
bun run bump 0.2.0

# 2. Commit
git add -A
git commit -m "chore: bump version to 0.2.0"

# 3. Tag and push (triggers CI build + release)
git tag v0.2.0
git push && git push --tags
```

GitHub Actions will:
- Verify tag version matches code versions
- Build for Windows, macOS (universal), and Linux
- Create a draft release with all binaries
- Publish the release after all builds complete
