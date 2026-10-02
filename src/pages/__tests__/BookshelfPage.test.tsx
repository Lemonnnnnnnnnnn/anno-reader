import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookshelfPage } from "../BookshelfPage";
import { useBookshelfStore } from "@/stores/useBookshelfStore";
import { useBookStore, type BookMetadata } from "@/stores/useBookStore";
import { loadBookshelf, updateEntry, removeEntry } from "@/lib/bookshelf";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("@/lib/bookshelf/persistence", () => ({
  loadBookshelf: vi.fn(), updateEntry: vi.fn(), removeEntry: vi.fn(), addEntry: vi.fn(),
}));
vi.mock("@/lib/import", () => ({ importBook: vi.fn(), EpubImportError: class extends Error {} }));
vi.mock("@/components/ImportWebDialog", () => ({ ImportWebDialog: () => null }));
vi.mock("@/components/EditBookMetadataDialog", () => ({ EditBookMetadataDialog: () => null }));
vi.mock("@/hooks/useTheme", () => ({ default: vi.fn() }));
vi.mock("@/lib/version", () => ({ getAppVersion: async () => "" }));
vi.mock("@/stores/useUpdateStore", () => ({ useUpdateStore: Object.assign(() => false, { getState: () => ({ checkUpdate: vi.fn() }) }) }));
vi.mock("@/stores/useChatStore", () => ({ useChatStore: () => vi.fn() }));

const books: BookMetadata[] = [
  { id: "old", title: "Older book", author: "Author", coverUrl: null, filePath: "old.epub", lastOpened: 100 },
  { id: "new", title: "Recent website", author: "Site", coverUrl: null, filePath: "book.web.json", format: "web", lastOpened: 300 },
  { id: "archive", title: "Archived PDF", author: "Author", coverUrl: null, filePath: "a.pdf", format: "pdf", lastOpened: 500, archived: true },
];
let container: HTMLDivElement;
let root: Root;
async function click(element: Element) {
  await act(async () => { element.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
}
function button(text: string): HTMLButtonElement {
  const element = Array.from(container.querySelectorAll("button")).find(el => el.textContent?.trim() === text);
  if (!element) throw new Error(`Missing button: ${text}`);
  return element;
}
async function menu(title: string) {
  const card = container.querySelector(`h3[title="${title}"]`)?.closest('[role="button"]');
  if (!card) throw new Error(`Missing card: ${title}`);
  await act(async () => { card.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true })); });
}

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.resetAllMocks();
  vi.mocked(loadBookshelf).mockResolvedValue(books.map(book => ({ ...book, type: "book", addedAt: 1 })));
  vi.mocked(updateEntry).mockResolvedValue(undefined);
  useBookshelfStore.setState({ books: [], loading: false, error: null });
  useBookStore.setState({ currentBook: null });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<BookshelfPage />); });
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("bookshelf recent order and archive", () => {
  it("shows active entries newest first and keeps archived entries in a separate view", async () => {
    expect(Array.from(container.querySelectorAll("h3")).map(el => el.textContent)).toEqual(["Recent website", "Older book"]);
    await click(button("Archived (1)"));
    expect(Array.from(container.querySelectorAll("h3")).map(el => el.textContent)).toEqual(["Archived PDF"]);
  });

  it("persists the viewing time and moves a reopened book ahead of newer entries", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    await click(container.querySelector('h3[title="Older book"]')!);
    expect(updateEntry).toHaveBeenCalledWith("old", { lastOpened: 1000 });
    expect(useBookStore.getState().currentBook?.lastOpened).toBe(1000);
    expect(navigate).toHaveBeenCalledWith("/reader");
    expect(Array.from(container.querySelectorAll("h3")).map(el => el.textContent)).toEqual(["Older book", "Recent website"]);
  });

  it("archives a website without deleting data and restores it with the original viewing time", async () => {
    await menu("Recent website");
    await click(button("Archive"));
    expect(updateEntry).toHaveBeenCalledWith("new", { archived: true });
    expect(container.querySelector('h3[title="Recent website"]')).toBeNull();
    expect(removeEntry).not.toHaveBeenCalled();
    await click(button("Archived (2)"));
    await menu("Recent website");
    await click(button("Restore to Bookshelf"));
    expect(updateEntry).toHaveBeenCalledWith("new", { archived: false });
    await click(button("Bookshelf (2)"));
    expect(container.querySelector('h3[title="Recent website"]')).not.toBeNull();
    expect(useBookshelfStore.getState().books.find(book => book.id === "new")?.lastOpened).toBe(300);
  });

  it("keeps an entry visible and displays an error when archiving fails", async () => {
    vi.mocked(updateEntry).mockRejectedValueOnce(new Error("Disk full"));
    await menu("Older book");
    await click(button("Archive"));
    expect(container.querySelector('h3[title="Older book"]')).not.toBeNull();
    expect(container.textContent).toContain("Disk full");
  });
});
