# LIB MODULES

Domain-specific modules for EPUB processing. Each module has barrel export (`index.ts`).

## MODULE MAP

| Module | Files | Purpose |
|--------|-------|---------|
| `epub/` | 3 | EPUB parsing (wraps epubix) |
| `import/` | 5 | File selection + validation + orchestration |
| `annotations/` | 3 | Notes + highlights create/restore/persist |
| `progress/` | 4 | Reading position tracking + auto-save |
| `metadata/` | 4 | Title/author extraction + cover (4-level fallback) |
| `css/` | 5 | Extract/inject/isolate EPUB styles |
| `images/` | 4 | Resolve paths + convert to base64 |
| `fonts/` | 4 | Extract + inject fonts (custom, epubix doesn't do this) |
| `selection.ts` | 1 | Text selection detection (injected iframe script) |

## CONVENTIONS

- Each module exports via `index.ts` barrel (except `selection.ts`)
- Types in `types.ts` per module
- Persistence in `persistence.ts` per module
- Tauri APIs imported from `@tauri-apps/plugin-*`

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Parse EPUB | `epub/parser.ts` | Main parsing logic |
| Open file dialog | `import/dialog.ts` | Tauri dialog plugin |
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

## ANTI-PATTERNS

- **DO NOT** use epubix `getCoverImageData()` for EPUB 3 — use direct OPF parsing
- **DO NOT** assume `n.properties` exists on epubix manifest items — it's always undefined
- **DO NOT** import from `@tauri-apps/api` directly — use plugin packages

## KEY TYPES

```typescript
// From stores/useBookStore.ts (shared across modules)
BookMetadata { id, title, author, coverUrl, filePath, lastOpened }
ReadingProgress { bookId, chapterHref, chapterIndex, percentage, scrollOffset }
Note { id, bookId, chapterHref, cfiRange, text, content, createdAt }
Highlight { id, bookId, chapterHref, cfiRange, text, color, createdAt }

// From selection.ts
SelectionMessage { type, text, rect, startOffset, endOffset }

// From import/errors.ts
ImportErrorCode — enum of error codes
EpubImportError — error class with userMessage
```

## CROSS-MODULE FLOWS

```
Import: import/dialog → import/fileReader → epub/parser → stores
Render: epub/parser → css/extract → images/resolve → fonts/extract → css/inject + images/resolve + fonts/inject → iframe srcdoc
Annotate: selection.ts → annotations/index → stores → annotations/persistence
Progress: progress/tracker → stores → progress/persistence
```
