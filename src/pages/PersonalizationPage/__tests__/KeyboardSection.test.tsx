/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { KeyboardSection } from "../KeyboardSection";
import { useKeyboardStore } from "@/stores/useKeyboardStore";

let root: Root;
let container: HTMLDivElement;
beforeEach(async () => {
  vi.spyOn(KeyboardEvent.prototype, "getModifierState").mockReturnValue(false);
  useKeyboardStore.getState().resetBindings();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<KeyboardSection />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  useKeyboardStore.getState().resetBindings();
  vi.restoreAllMocks();
});
async function click(label: string) {
  await act(async () => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
}
async function key(key: string, modifiers: KeyboardEventInit = {}) {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...modifiers }));
    document.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, ...modifiers }));
  });
}

it("records a shortcut using TanStack, persists it, and allows disabling/restoring", async () => {
  await click("修改打开通用翻译快捷键 1");
  expect(useKeyboardStore.getState().recording).toBe(true);
  await key("u", { ctrlKey: true, shiftKey: true });
  expect(useKeyboardStore.getState().bindings.translate).toEqual(["Mod+Shift+U"]);
  expect(useKeyboardStore.getState().recording).toBe(false);
  expect(localStorage.getItem("keyboardBindings")).toContain("Mod+Shift+U");
  await click("启用打开通用翻译快捷键");
  expect(useKeyboardStore.getState().enabled.translate).toBe(false);
  expect(useKeyboardStore.getState().bindings.translate).toEqual(["Mod+Shift+U"]);
  await click("启用打开通用翻译快捷键");
  expect(useKeyboardStore.getState().enabled.translate).toBe(true);
  expect(useKeyboardStore.getState().bindings.translate).toEqual(["Mod+Shift+U"]);
  await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "恢复默认")!.click());
  expect(useKeyboardStore.getState().bindings.translate).toEqual(["Alt+t"]);
});

it("shows fixed shortcuts as reference text and removes uncommon commands and symbol buttons", () => {
  expect(container.textContent).not.toContain("返回书架");
  expect(container.textContent).not.toContain("导入书籍");
  expect(container.textContent).not.toContain("调整字号");
  expect(container.textContent).not.toContain("默认快捷键");
  expect(container.textContent).not.toContain("提交翻译 / 保存笔记");
  expect(container.querySelector('[aria-label*="修改提交翻译"]')).toBeNull();
  expect(container.querySelector('[aria-label*="启用向下滚动"]')).toBeNull();
  expect([...container.querySelectorAll("button")].some((button) => ["+", "×", "修改", "禁用"].includes(button.textContent ?? ""))).toBe(false);
});

it("keeps recording on conflicts, lets Escape cancel, and releases recording on unmount", async () => {
  await click("修改打开通用翻译快捷键 1");
  await key("c", { altKey: true });
  expect(container.textContent).toContain("冲突");
  expect(useKeyboardStore.getState().bindings.translate).toEqual(["Alt+t"]);
  expect(useKeyboardStore.getState().recording).toBe(true);
  await key("Escape");
  expect(useKeyboardStore.getState().recording).toBe(false);
  await click("修改打开通用翻译快捷键 1");
  await act(async () => root.render(null));
  expect(useKeyboardStore.getState().recording).toBe(false);
});
