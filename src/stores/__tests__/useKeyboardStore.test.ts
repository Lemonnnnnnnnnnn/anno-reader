/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => { localStorage.clear(); vi.resetModules(); });
afterEach(() => vi.unstubAllGlobals());

it("loads customized bindings and disabled commands after restart", async () => {
  const { useKeyboardStore } = await import("../useKeyboardStore");
  useKeyboardStore.getState().setBinding("translate", ["Ctrl+Shift+U"]);
  useKeyboardStore.getState().setEnabled("translate", false);
  vi.resetModules();
  const reloaded = await import("../useKeyboardStore");
  expect(reloaded.useKeyboardStore.getState().bindings.translate).toEqual(["Mod+Shift+U"]);
  expect(reloaded.useKeyboardStore.getState().enabled.translate).toBe(false);
  reloaded.useKeyboardStore.getState().setEnabled("translate", true);
  expect(reloaded.useKeyboardStore.getState().bindings.translate).toEqual(["Mod+Shift+U"]);
});

it("ignores obsolete actions and custom values for fixed shortcuts", async () => {
  localStorage.setItem("keyboardBindings", JSON.stringify({ translate: ["Ctrl+Shift+U"], bookshelf: ["x"], nextChapter: ["n"], scrollDown: [], submit: ["Enter"] }));
  localStorage.setItem("keyboardEnabled", JSON.stringify({ nextChapter: false, submit: false }));
  const { useKeyboardStore } = await import("../useKeyboardStore");
  const state = useKeyboardStore.getState();
  expect(state.bindings.translate).toEqual(["Mod+Shift+U"]);
  expect(state.bindings).not.toHaveProperty("bookshelf");
  expect(state.bindings.nextChapter).toEqual(["ArrowRight"]);
  expect(state.bindings.scrollDown).toEqual(["j", "ArrowDown"]);
  expect(state.bindings.submit).toEqual(["Mod+Enter"]);
  expect(state.enabled.nextChapter).toBe(true);
  expect(state.enabled.submit).toBe(true);
});

it("recovers from malformed storage and remains usable without localStorage", async () => {
  localStorage.setItem("keyboardBindings", "invalid-json");
  const { useKeyboardStore } = await import("../useKeyboardStore");
  expect(useKeyboardStore.getState().bindings.translate).toEqual(["Alt+t"]);
  vi.stubGlobal("localStorage", undefined);
  expect(() => useKeyboardStore.getState().setBinding("translate", ["Ctrl+Shift+U"])).not.toThrow();
  expect(useKeyboardStore.getState().bindings.translate).toEqual(["Mod+Shift+U"]);
});
