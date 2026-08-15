# LIB MODULES

Domain-specific modules for EPUB processing. Each module has barrel export (`index.ts`).

## MODULE MAP

| Module | Files | Purpose |
|--------|-------|---------|
| `epub/` | 3 | EPUB parsing (wraps epubix) |
| `pdf/` | 7 | PDF support: pdf.js loading → ParsedEpub mapping (pages as chapters), outline→TOC, cover, text helpers |
| `import/` | 8 | File selection + validation + orchestration; `importBook()` dispatches EPUB/PDF by extension |
| `annotations/` | 3 | Notes + highlights create/restore/persist |
| `progress/` | 4 | Reading position tracking + auto-save |
| `metadata/` | 4 | Title/author extraction + cover (4-level fallback) |
| `css/` | 5 | Extract/inject/isolate EPUB styles |
| `images/` | 4 | Resolve paths + convert to base64 |
| `fonts/` | 4 | Extract + inject fonts (custom, epubix doesn't do this) |
| `selection.ts` | 1 | Text selection detection (injected iframe script) |
| `ai/` | 8 | AI translation: providers, prompts, context, caching |

## CONVENTIONS

- Each module exports via `index.ts` barrel (except `selection.ts`)
- Types in `types.ts` per module
- Persistence in `persistence.ts` per module
- Tauri APIs imported from `@tauri-apps/plugin-*`

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Parse EPUB | `epub/parser.ts` | Main parsing logic |
| Load PDF | `pdf/loader.ts` | `loadPdf()` → ParsedEpub shape (pages as chapters) |
| PDF outline → TOC | `pdf/outline.ts` | Named/explicit dest → page href |
| Import dispatch | `import/importBook.ts` | `importBook()` routes by extension |
| Open file dialog | `import/dialog.ts` | Tauri dialog plugin (EPUB+PDF filter) |
| Validate EPUB | `import/errors.ts` | Error codes + messages |
| Create note | `annotations/index.ts` | `createNote()` |
| Create highlight | `annotations/index.ts` | `createHighlight()` |
| Save progress | `progress/persistence.ts` | JSON file write |
| Track scroll | `progress/tracker.ts` | Scroll position capture |
| Extract cover | `metadata/cover.ts` | 4-level fallback strategy |
| Inject CSS | `css/inject.ts` | Into iframe srcdoc |
| Resolve images | `images/resolve.ts` | Relative → base64 |
| Inject fonts | `fonts/inject.ts` | Into iframe srcdoc |
| Selection script | `selection.ts` | `SELECTION_DETECTOR_SCRIPT` |
| AI translation | `ai/translation.ts` | Core orchestrator |
| AI providers | `ai/providers/` | OpenAI-compatible backends |
| AI prompts | `ai/prompts.ts` | Template rendering |
| AI context | `ai/context.ts` | Surrounding text extraction |

## ANTI-PATTERNS

- **DO NOT** use epubix `getCoverImageData()` for EPUB 3 — use direct OPF parsing
- **DO NOT** assume `n.properties` exists on epubix manifest items — it's always undefined
- **DO NOT** import from `@tauri-apps/api` directly — use plugin packages
- **DO NOT** call AI providers directly — go through `TranslationService.translate()` for caching and retry
- **DO NOT** hardcode prompt variables — use `PromptService.renderPrompt()` with template interpolation

## KEY TYPES

```typescript
// From stores/useBookStore.ts (shared across modules)
BookMetadata { id, title, author, coverUrl, filePath, lastOpened, format? }
ReadingProgress { bookId, chapterHref, chapterIndex, percentage, scrollOffset }
Note { id, bookId, chapterHref, cfiRange, text, content, createdAt }
Highlight { id, bookId, chapterHref, cfiRange, text, color, createdAt }

// From pdf/types.ts — PDF pages map onto chapter hrefs
pageHref(n) = "page-{n}" | pageNumberFromHref(href)

// From selection.ts
SelectionMessage { type, text, rect, startOffset, endOffset }

// From import/errors.ts
ImportErrorCode — enum of error codes
EpubImportError — error class with userMessage
```

## CROSS-MODULE FLOWS

```
Import: import/dialog → import/importBook → (epub/parser | pdf/loader) → bookshelf + stores
Render (EPUB): epub/parser → css/extract → images/resolve → fonts/extract → css/inject → iframe srcdoc
Render (PDF): pdf/loader → PdfViewer (canvas + pdf.js TextLayer) → ReaderOverlays
Annotate: selection (iframe script | PdfViewer selection hook) → annotations/index → stores → annotations/persistence
Progress: progress/tracker → stores → progress/persistence (PDF pages = chapters)
Translate: selection → ai/context → ai/prompts → ai/providers → ai/cache
```
