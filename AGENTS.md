# PROJECT KNOWLEDGE BASE

**Generated:** 2026-05-30
**Commit:** 57cd5ba
**Branch:** master

## OVERVIEW

Minimalist EPUB reader desktop app. Tauri 2 (Rust) backend + React 19 + TypeScript frontend. Single-book reading with annotations.

## STRUCTURE

```
anno-reader/
├── src/                    # Frontend (React/TypeScript)
│   ├── components/         # UI components (8 files)
│   ├── lib/                # Domain modules → see src/lib/AGENTS.md
│   ├── stores/             # Zustand global state (useBookStore.ts)
│   └── main.tsx            # React entry
├── src-tauri/              # Backend (Rust/Tauri)
│   ├── src/
│   │   ├── main.rs         # Binary entry → calls lib::run()
│   │   └── lib.rs          # Tauri builder + plugin registration
│   ├── capabilities/       # Permission declarations
│   └── tauri.conf.json     # App config (window, build, bundle)
├── index.html              # Vite HTML shell
├── vite.config.ts          # Vite + Vitest + Tauri dev config
└── package.json            # Scripts: dev, build, test, tauri
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| UI components | `src/components/` | ReaderLayout is main orchestrator |
| Shared primitives | `src/components/primitives/` | Button, TextArea, Icon, ErrorBanner |
| Tailwind config | `tailwind.config.ts` | Design tokens, colors, fonts |
| EPUB parsing | `src/lib/epub/` | Wraps epubix library |
| File import | `src/lib/import/` | Tauri dialog + fs plugins |
| Annotations | `src/lib/annotations/` | Notes + highlights persistence |
| Reading progress | `src/lib/progress/` | Auto-save on scroll/navigation |
| CSS injection | `src/lib/css/` | EPUB style isolation |
| Image handling | `src/lib/images/` | Base64 conversion |
| Font extraction | `src/lib/fonts/` | Custom (epubix doesn't extract) |
| Metadata/cover | `src/lib/metadata/` | 4-level cover fallback |
| Text selection | `src/lib/selection.ts` | Iframe postMessage pattern |
| Global state | `src/stores/useBookStore.ts` | Zustand store |
| Rust commands | `src-tauri/src/lib.rs` | Register new commands here |
| Tauri permissions | `src-tauri/capabilities/default.json` | Add plugin permissions |

## BOOTSTRAP FLOW

```
main.rs → lib.rs::run() → Tauri window (1200×800)
  → index.html → main.tsx → App.tsx
    → ErrorBoundary → ReaderLayout (Zustand store)
      → importEpub() → loadEpub() → ChapterRenderer (iframe)
```

## CONVENTIONS

- **Path alias**: `@/*` → `src/*`
- **State**: Zustand 5 with `useShallow` for filtered arrays (CRITICAL: prevents infinite loops)
- **EPUB rendering**: iframe srcdoc for CSS isolation
- **Iframe communication**: `window.parent.postMessage` pattern
- **Persistence**: JSON files via Tauri fs plugin
- **Styling**: Tailwind CSS with centralized design tokens
- **Design tokens**: Defined in `tailwind.config.ts` (colors, fonts)
- **Shared primitives**: `src/components/primitives/` (Button, TextArea, Icon, ErrorBanner)
- **No CSS modules**: Project uses Tailwind exclusively

## ANTI-PATTERNS (THIS PROJECT)

- **DO NOT** use Zustand `.filter()` in selectors without `useShallow` — causes infinite re-render loop
- **DO NOT** use epubix for EPUB 3 cover detection — use direct OPF parsing (see `metadata/cover.ts`)
- **DO NOT** remove `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` from main.rs
- **DO NOT** add CSS modules — project uses Tailwind exclusively
- **NEVER** suppress TypeScript errors with `as any` or `@ts-ignore`
- **DO NOT** use inline styles — prefer Tailwind utility classes and design tokens

## UNIQUE PATTERNS

- **Iframe script injection**: Scripts are string templates injected before `</body>` in srcdoc
- **Pseudo-CFI ranges**: `epubcfi(/6/4[chap01]!/4/2:start,end)` — character offsets, not real EPUB CFI
- **Selection detection**: Injected script → postMessage → parent toolbar positioning
- **Cover fallback**: 4-level strategy (epubix → OPF properties → heuristic ID → metadata path)
- **vestigial code**: `greet` command in lib.rs is dead template code

## COMMANDS

```bash
bun run dev          # Vite dev server (port 1420)
bun run build        # tsc + vite build
bun run test         # vitest run
bun run test:watch   # vitest watch mode
bun run tauri dev    # Full Tauri dev (frontend + Rust)
bun run tauri build  # Production bundle
cargo check          # Rust type check (in src-tauri/)
```

## KNOWN ISSUES

- epubix doesn't extract fonts — custom extraction in `lib/fonts/`
- epubix EPUB 3 cover detection broken — direct OPF parsing workaround
- CSP disabled (`"csp": null`) in tauri.conf.json

## TEST SETUP

- Framework: Vitest + jsdom
- Location: `src/__tests__/`
- Pattern: `*.test.ts`
- Run: `bun run test`
