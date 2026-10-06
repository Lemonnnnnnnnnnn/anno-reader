import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VirtuosoMockContext } from "react-virtuoso";
import { AnnotationDrawer } from "..";
import { useBookStore } from "@/stores/useBookStore";
import { updateNote, setNoteStarred } from "@/lib/annotations";

vi.mock("@/lib/annotations", () => ({ updateNote: vi.fn(), deleteNote: vi.fn(), deleteHighlight: vi.fn(), setNoteStarred: vi.fn() }));
vi.mock("@/components/AnnotationDetailPanel", () => ({ AnnotationDetailPanel: () => null }));
let container: HTMLDivElement;
let root: Root;
const chapters = [{ id: "chapter", title: "Chapter", href: "chapter.html", content: "", cssContent: [] }];
const onNavigate = vi.fn();
async function render(open = true) {
  await act(async () => {
    root.render(<VirtuosoMockContext.Provider value={{ viewportHeight: 600, itemHeight: 150 }}>
      <AnnotationDrawer open={open} onClose={() => undefined} onNavigate={onNavigate} chapters={chapters} />
    </VirtuosoMockContext.Provider>);
  });
}
async function click(element: Element) {
  await act(async () => { element.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
}
function button(prefix: string) {
  const element = Array.from(container.querySelectorAll("button")).find(el => el.textContent?.trim().startsWith(prefix));
  if (!element) throw new Error(`Missing button ${prefix}`);
  return element;
}
async function input(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  useBookStore.setState({
    currentBook: { id: "book", title: "Book", author: "Author", coverUrl: null, filePath: "book.epub", lastOpened: 0 },
    notes: Array.from({ length: 500 }, (_, i) => ({ id: `note-${i}`, bookId: "book", chapterHref: "chapter.html", cfiRange: "range", text: `Quote ${i}`, content: i === 0 ? "needle in the last note" : "Long content ".repeat(1000), createdAt: i })),
    highlights: Array.from({ length: 500 }, (_, i) => ({ id: `highlight-${i}`, bookId: "book", chapterHref: "chapter.html", cfiRange: "range", text: `Highlight ${i}`, color: "yellow", createdAt: i })),
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await render();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("virtualized annotations", () => {
  it("marks notes and filters important notes together with search", async () => {
    vi.mocked(setNoteStarred).mockImplementation(async (id, starred) => {
      useBookStore.setState(state => ({ notes: state.notes.map(note => note.id === id ? { ...note, starred } : note) }));
    });
    await click(container.querySelector('[aria-label="Star note"]')!);
    expect(setNoteStarred).toHaveBeenCalledWith("note-499", true, "book");
    await click(container.querySelector('[aria-label="Filter starred notes"]')!);
    expect(container.querySelector('[aria-label="Filter starred notes"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("Notes (500)");
    expect(container.querySelectorAll('[title="Edit note"]')).toHaveLength(1);
    await input(container.querySelector("input")!, "needle");
    expect(container.textContent).toContain("No matching notes");
    await input(container.querySelector("input")!, "");
    await click(container.querySelector('[aria-label="Unstar note"]')!);
    expect(container.textContent).toContain("No starred notes yet");
    await click(button("Highlights"));
    expect(container.querySelector('[aria-label="Filter starred notes"]')).toBeNull();
  });
  it("mounts only a small visible subset of 500 notes and highlights", async () => {
    const mounted = container.querySelectorAll('[title="Edit note"]').length;
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(20);
    expect(container.textContent).toContain("Notes (500)");
    await click(button("Highlights"));
    expect(container.querySelectorAll('[title="Delete highlight"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[title="Delete highlight"]').length).toBeLessThan(20);
  });

  it("searches the entire dataset, including notes outside the visible range", async () => {
    await input(container.querySelector("input")!, "needle");
    expect(container.textContent).toContain("Notes (1)");
    expect(container.textContent).toContain("needle in the last note");
  });

  it("retains unsaved drafts after cards unmount and saves the complete text", async () => {
    await click(container.querySelector('[title="Edit note"]')!);
    await input(container.querySelector("textarea")!, "Unsaved draft");
    await click(button("Highlights"));
    expect(container.querySelector("textarea")).toBeNull();
    await click(button("Notes"));
    expect(container.querySelector("textarea")?.value).toBe("Unsaved draft");
    await click(button("Save"));
    expect(updateNote).toHaveBeenCalledWith("note-499", "Unsaved draft", "book");
  });

  it("does not mount cards while closed", async () => {
    await render(false);
    expect(container.querySelectorAll('[title="Edit note"]').length).toBe(0);
  });
});
