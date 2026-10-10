import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { useBookStore } from "@/stores/useBookStore";
import { useEpubLoader } from "../hooks/useEpubLoader";
import { restoreProgress } from "@/lib/progress";

vi.mock("@/lib/import", () => ({
  importBook: vi.fn(),
  EpubImportError: class extends Error {},
  ImportErrorCode: {},
  ensurePersistedCopy: vi.fn(async (book) => book.filePath),
  readFileAsArrayBuffer: vi.fn(async () => new TextEncoder().encode(JSON.stringify({
    version: 1, title: "Saved website", author: "Example", language: "en",
    sourceUrl: "https://example.com", capturedAt: 1, content: "<p>Offline article</p>",
  })).buffer),
}));
vi.mock("@/lib/epub", () => ({ loadEpub: vi.fn() }));
vi.mock("@/lib/pdf", () => ({ loadPdf: vi.fn(), destroyPdfDocument: vi.fn() }));
vi.mock("@/lib/annotations", () => ({ restoreNotes: vi.fn(), restoreHighlights: vi.fn() }));
vi.mock("@/lib/summaries", () => ({ restoreSummaries: vi.fn() }));
vi.mock("@/lib/progress", () => ({
  restoreProgress: vi.fn(async () => null), trackProgress: vi.fn(() => vi.fn()), flushProgress: vi.fn(),
}));

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

const container = document.createElement("div");
let root: ReturnType<typeof createRoot>;
function Probe() {
  const { parsedEpub, error } = useEpubLoader();
  const index = useBookStore(state => state.ui.currentChapterIndex);
  return <p>{error || (parsedEpub ? parsedEpub.chapters[index]?.content ?? "No chapter loaded" : "Loading")}</p>;
}
afterEach(() => { act(() => root.unmount()); vi.clearAllMocks(); });

it.each(["missing", "invalid", "valid"] as const)("opens a synced web snapshot with %s progress after another book", async (progress) => {
  useBookStore.getState().setCurrentChapter("previous.html", 8);
  useBookStore.getState().setBook({
    id: "web", title: "Saved website", author: "Example", coverUrl: null,
    filePath: "entries/web/book.web.json", format: "web", lastOpened: 1,
  });
  vi.mocked(restoreProgress).mockImplementation(async () => {
    if (progress !== "missing") {
      useBookStore.getState().setCurrentChapter("article.html", progress === "invalid" ? 8 : 0);
      useBookStore.getState().setScrollPosition(120);
    }
    return null;
  });
  root = createRoot(container);
  await act(async () => { root.render(<Probe />); });
  expect(container.textContent).toContain("Offline article");
  expect(useBookStore.getState().ui.currentChapter).toBe("article.html");
  expect(useBookStore.getState().ui.scrollPosition).toBe(progress === "valid" ? 120 : 0);
});
