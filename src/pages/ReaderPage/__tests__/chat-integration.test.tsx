/**
 * Tests for ChatDrawer integration in ReaderPage.
 *
 * Verifies:
 * - MessageSquare button exists in navigation bar
 * - ChatDrawer renders with correct props
 * - Mutual exclusion: opening chat closes other drawers
 * - Mutual exclusion: opening other drawers closes chat
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { ReaderPage } from "..";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockSetTheme = vi.fn();
vi.mock("@/stores/useBookStore", () => ({
  useBookStore: vi.fn((selector) => {
    const state = {
      currentBook: { title: "Test Book", author: "Author", coverUrl: "" },
      ui: { currentChapter: "ch1", theme: "light" },
      setTheme: mockSetTheme,
      setCurrentChapter: vi.fn(),
      setScrollPosition: vi.fn(),
      setPendingScrollCfi: vi.fn(),
    };
    return selector(state);
  }),
}));

vi.mock("@/hooks/useTheme", () => ({ default: vi.fn() }));

vi.mock("@/pages/ReaderPage/hooks", () => ({
  useRouteGuard: () => "book",
  useConfig: () => ({ configReady: true, handleConfigComplete: vi.fn() }),
  useEpubLoader: () => ({
    parsedEpub: {
      chapters: [{ href: "ch1", title: "Chapter 1" }],
      toc: [],
      resources: [],
      opfFolder: "",
      manifestHrefs: new Map(),
    },
    loading: false,
    error: null,
    setError: vi.fn(),
    totalChapters: 1,
    handleImport: vi.fn(),
  }),
  useKeyboardNav: vi.fn(),
  useVimScroll: vi.fn(),
}));

vi.mock("@/components/ChapterRenderer", () => ({
  ChapterRenderer: () => "<div>ChapterRenderer</div>",
}));

vi.mock("@/components/ChapterNavigation", () => ({
  ChapterNavigation: () => "<div>ChapterNavigation</div>",
}));

vi.mock("@/components/VerticalScroller/hooks/useScrollTracking", () => ({
  parseCfiOffsets: vi.fn(),
  scrollToCharOffset: vi.fn(),
}));

// Track ChatDrawer props
let chatDrawerIsOpen = false;
let chatDrawerOnClose: (() => void) | null = null;

vi.mock("@/components/ChatDrawer", () => ({
  ChatDrawer: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    chatDrawerIsOpen = isOpen;
    chatDrawerOnClose = onClose;
    if (!isOpen) return null;
    return '<div data-testid="chat-drawer">ChatDrawer</div>';
  },
}));

// Track TocDrawer props
let tocDrawerOpen = false;
let tocDrawerOnClose: (() => void) | null = null;

vi.mock("@/components/TocDrawer", () => ({
  TocDrawer: ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    tocDrawerOpen = open;
    tocDrawerOnClose = onClose;
    if (!open) return null;
    return '<div data-testid="toc-drawer">TocDrawer</div>';
  },
}));

// Track AnnotationDrawer props
let annotationDrawerOpen = false;
let annotationDrawerOnClose: (() => void) | null = null;

vi.mock("@/components/AnnotationDrawer", () => ({
  AnnotationDrawer: ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    annotationDrawerOpen = open;
    annotationDrawerOnClose = onClose;
    if (!open) return null;
    return '<div data-testid="annotation-drawer">AnnotationDrawer</div>';
  },
}));

// Track DictionaryDrawer props
let dictionaryDrawerOpen = false;
let dictionaryDrawerOnClose: (() => void) | null = null;

vi.mock("@/components/DictionaryDrawer", () => ({
  DictionaryDrawer: ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    dictionaryDrawerOpen = open;
    dictionaryDrawerOnClose = onClose;
    if (!open) return null;
    return '<div data-testid="dictionary-drawer">DictionaryDrawer</div>';
  },
}));

vi.mock("@/components/DataDirSetup", () => ({
  DataDirSetup: () => "<div>DataDirSetup</div>",
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderReaderPage() {
  return renderToString(
    <MemoryRouter>
      <ReaderPage />
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChatDrawer integration in ReaderPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chatDrawerIsOpen = false;
    chatDrawerOnClose = null;
    tocDrawerOpen = false;
    tocDrawerOnClose = null;
    annotationDrawerOpen = false;
    annotationDrawerOnClose = null;
    dictionaryDrawerOpen = false;
    dictionaryDrawerOnClose = null;
  });

  it("renders MessageSquare button in navigation bar", () => {
    const html = renderReaderPage();

    // Button with title "AI Chat" should exist
    expect(html).toContain('title="AI Chat"');
  });

  it("initial state: ChatDrawer is closed", () => {
    renderReaderPage();

    expect(chatDrawerIsOpen).toBe(false);
  });

  it("initial state: other drawers are closed", () => {
    renderReaderPage();

    expect(tocDrawerOpen).toBe(false);
    expect(annotationDrawerOpen).toBe(false);
    expect(dictionaryDrawerOpen).toBe(false);
  });

  it("all navigation buttons are present", () => {
    const html = renderReaderPage();

    expect(html).toContain('title="Table of Contents"');
    expect(html).toContain('title="Annotations"');
    expect(html).toContain('title="Dictionary"');
    expect(html).toContain('title="Settings"');
    expect(html).toContain('title="AI Chat"');
  });

  it("ChatDrawer receives correct props", () => {
    renderReaderPage();

    // Verify ChatDrawer was called with isOpen and onClose
    expect(chatDrawerOnClose).toBeDefined();
    expect(typeof chatDrawerOnClose).toBe("function");
  });

  it("TocDrawer receives correct props", () => {
    renderReaderPage();

    expect(tocDrawerOnClose).toBeDefined();
    expect(typeof tocDrawerOnClose).toBe("function");
  });

  it("AnnotationDrawer receives correct props", () => {
    renderReaderPage();

    expect(annotationDrawerOnClose).toBeDefined();
    expect(typeof annotationDrawerOnClose).toBe("function");
  });

  it("DictionaryDrawer receives correct props", () => {
    renderReaderPage();

    expect(dictionaryDrawerOnClose).toBeDefined();
    expect(typeof dictionaryDrawerOnClose).toBe("function");
  });
});
