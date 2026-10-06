/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ChapterProgressRail } from "../ChapterProgressRail";
import { usePreferencesStore } from "@/stores/usePreferencesStore";

vi.mock("@/lib/css", () => ({ injectCssIntoIframe: vi.fn() }));
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  usePreferencesStore.getState().setHideReadingScrollbar(true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

it.each([false, true])("drags progress for iframe=%s, clamps endpoints, and stops on cancellation", async (iframe) => {
  const target = iframe ? document.createElement("iframe") : document.createElement("div");
  document.body.append(target);
  const scrollEl = iframe ? (target as HTMLIFrameElement).contentDocument!.documentElement : target;
  if (iframe) Object.defineProperty((target as HTMLIFrameElement).contentDocument, "scrollingElement", { value: scrollEl });
  Object.defineProperties(scrollEl, { scrollHeight: { value: 2000 }, clientHeight: { value: 1000 } });
  await act(async () => root.render(<ChapterProgressRail target={target} chapterTitle="Test" chapterNumber={1} />));
  const track = container.querySelector("svg")!;
  vi.spyOn(track, "getBoundingClientRect").mockReturnValue({ top: 100, height: 208 } as DOMRect);
  track.setPointerCapture = vi.fn();
  track.hasPointerCapture = vi.fn(() => true);
  track.releasePointerCapture = vi.fn();
  async function pointer(type: string, clientY: number) {
    await act(async () => track.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientY })));
  }
  await pointer("pointerdown", 204);
  expect(scrollEl.scrollTop).toBe(500);
  expect(container.querySelector('[role="slider"]')?.getAttribute("aria-valuenow")).toBe("50");
  expect(track.setPointerCapture).toHaveBeenCalledWith(1);
  await pointer("pointermove", 1000);
  expect(scrollEl.scrollTop).toBe(1000);
  await pointer("pointermove", 0);
  expect(scrollEl.scrollTop).toBe(0);
  await pointer("pointercancel", 0);
  expect(track.releasePointerCapture).toHaveBeenCalledWith(1);
  await pointer("pointermove", 204);
  expect(scrollEl.scrollTop).toBe(0);
  target.remove();
});

it("supports keyboard seeking without bubbling into chapter navigation", async () => {
  const target = document.createElement("div");
  Object.defineProperties(target, { scrollHeight: { value: 2000 }, clientHeight: { value: 1000 } });
  await act(async () => root.render(<ChapterProgressRail target={target} chapterTitle="Test" chapterNumber={1} isPdf />));
  const slider = container.querySelector('[role="slider"]')!;
  const navigation = vi.fn();
  document.addEventListener("keydown", navigation);
  await act(async () => slider.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true })));
  expect(target.scrollTop).toBe(1000);
  await act(async () => slider.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true })));
  expect(target.scrollTop).toBe(990);
  expect(navigation).not.toHaveBeenCalled();
  document.removeEventListener("keydown", navigation);
});
