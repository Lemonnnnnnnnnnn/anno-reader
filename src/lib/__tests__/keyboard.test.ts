/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KEYBOARD_ACTIONS, conflictingAction, defaultKeyBindings, normalizeShortcut, shortcutMatches } from "../keyboard";
import { matchesAction, useKeyboardStore } from "@/stores/useKeyboardStore";

beforeEach(() => {
  // happy-dom incorrectly reports AltGraph whenever Alt is pressed.
  vi.spyOn(KeyboardEvent.prototype, "getModifierState").mockReturnValue(false);
  localStorage.clear();
  useKeyboardStore.getState().resetBindings();
  useKeyboardStore.getState().setRecording(false);
});
afterEach(() => vi.restoreAllMocks());

describe("keyboard settings", () => {
  it("ships collision-free defaults and preserves arrow/vim alternatives", () => {
    const defaults = defaultKeyBindings();
    for (const action of KEYBOARD_ACTIONS) {
      for (const key of defaults[action.id]) expect(conflictingAction(defaults, action.id, key)).toBeUndefined();
    }
    expect(defaults.scrollDown).toEqual(["j", "ArrowDown"]);
    expect(defaults.submit).toEqual(["Mod+Enter"]);
  });

  it("supports modifiers, IME protection and rejects reserved keys", () => {
    expect(shortcutMatches("Ctrl+Shift+t", { key: "T", ctrlKey: true, shiftKey: true })).toBe(true);
    expect(shortcutMatches("j", { key: "j", ctrlKey: true })).toBe(false);
    expect(shortcutMatches("j", { key: "j", isComposing: true })).toBe(false);
    expect(normalizeShortcut("Escape")).toBeNull();
    expect(normalizeShortcut("Tab")).toBeNull();
    expect(normalizeShortcut("invalid-key")).toBeNull();
  });

  it("detects cross-platform Mod collisions, allows separate input contexts, persists and disables", () => {
    const store = useKeyboardStore.getState();
    expect(store.setBinding("translate", ["Ctrl+Shift+u"])).toBeNull();
    expect(store.setBinding("chat", ["Mod+Shift+u"])).toContain("冲突");
    expect(store.setBinding("submit", ["Enter"])).toContain("固定");
    expect(store.setBinding("nextChapter", ["x"])).toContain("固定");
    expect(store.setBinding("scrollDown", [])).toContain("固定");
    expect(useKeyboardStore.getState().bindings.submit).toEqual(["Mod+Enter"]);
    expect(JSON.parse(localStorage.getItem("keyboardBindings")!).translate).toEqual(["Mod+Shift+U"]);
    expect(matchesAction("translate", { key: "U", ctrlKey: true, shiftKey: true })).toBe(true);
    store.setEnabled("translate", false);
    expect(matchesAction("translate", { key: "U", ctrlKey: true, shiftKey: true })).toBe(false);
    expect(useKeyboardStore.getState().bindings.translate).toEqual(["Mod+Shift+U"]);
    store.setEnabled("translate", true);
    expect(matchesAction("translate", { key: "U", ctrlKey: true, shiftKey: true })).toBe(true);
    store.resetBindings();
    expect(matchesAction("translate", { key: "t", altKey: true })).toBe(true);
    store.setRecording(true);
    expect(matchesAction("translate", { key: "t", altKey: true })).toBe(false);
  });
});
