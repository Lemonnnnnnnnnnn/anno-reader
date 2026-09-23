/**
 * Tests for the ReaderPage chrome.
 *
 * Verifies:
 * - The reader opens in immersive mode (chrome hidden, exit affordance shown)
 * - Leaving immersive mode — via Esc or the floating button — restores the
 *   header navigation
 * - ChatDrawer integration: MessageSquare button, drawer props, initial state
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
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

const { mockSetTheme, bookStoreState } = vi.hoisted(() => {
  const setTheme = vi.fn();
  // One stable state object: selectors run on every render, so returning a
  // fresh object would make zustand re-render forever.
  return {
    mockSetTheme: setTheme,
    bookStoreState: {
      currentBook: { title: "Test Book", author: "Author", coverUrl: "" },
      ui: {
        currentChapter: "ch1",
        currentChapterIndex: 0,
        theme: "light",
        scrollPosition: 0,
        pendingScrollCfi: null,
        pendingScrollAnchor: null,
        pendingScrollY: null,
        fontSize: 18,
        pdfZoom: 1,
        pdfNavigation: null,
      },
      setTheme,
      setCurrentChapter: vi.fn(),
      setScrollPosition: vi.fn(),
      setPendingScrollCfi: vi.fn(),
      setPendingScrollAnchor: vi.fn(),
      setPendingScrollY: vi.fn(),
    },
  };
});

vi.mock("@/stores/useBookStore", () => ({
  useBookStore: (selector: (s: typeof bookStoreState) => unknown) =>
    selector(bookStoreState),
}));

vi.mock("@/hooks/useTheme", () => ({ default: vi.fn() }));

vi.mock("@/pages/ReaderPage/hooks", () => ({
  useRouteGuard: () => "book",
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
  scrollToAnchor: vi.fn(),
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

const EXIT_IMMERSIVE = 'button[title="Exit immersive mode (Esc)"]';

let container: HTMLDivElement;
let root: Root;

function renderReaderPage(): HTMLDivElement {
  act(() => {
    root.render(
      <MemoryRouter>
        <ReaderPage />
      </MemoryRouter>,
    );
  });
  return container;
}

function leaveImmersiveMode(): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  });
}

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

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ReaderPage immersive mode", () => {
  it("opens in immersive mode, hiding the reader chrome", () => {
    renderReaderPage();

    expect(container.querySelector(EXIT_IMMERSIVE)).not.toBeNull();
    expect(container.querySelector('button[title="Back to bookshelf"]')).toBeNull();
    expect(container.querySelector("header")).toBeNull();
    expect(container.querySelector("footer")).toBeNull();
  });

  it("restores the chrome on Escape", () => {
    renderReaderPage();
    leaveImmersiveMode();

    expect(container.querySelector(EXIT_IMMERSIVE)).toBeNull();
    expect(container.querySelector('button[title="Back to bookshelf"]')).not.toBeNull();
    expect(container.querySelector("header")).not.toBeNull();
  });

  it("restores the chrome from the floating exit button", () => {
    renderReaderPage();

    const exitButton = container.querySelector(EXIT_IMMERSIVE);
    act(() => {
      exitButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector(EXIT_IMMERSIVE)).toBeNull();
    expect(container.querySelector('button[title="Immersive mode"]')).not.toBeNull();
  });
});

describe("ChatDrawer integration in ReaderPage", () => {
  it("renders MessageSquare button in navigation bar", () => {
    renderReaderPage();
    leaveImmersiveMode();

    expect(container.querySelector('button[title="AI Chat"]')).not.toBeNull();
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
    renderReaderPage();
    leaveImmersiveMode();

    for (const title of [
      "Table of Contents",
      "Annotations",
      "Dictionary",
      "Settings",
      "AI Chat",
    ]) {
      expect(container.querySelector(`button[title="${title}"]`)).not.toBeNull();
    }
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
