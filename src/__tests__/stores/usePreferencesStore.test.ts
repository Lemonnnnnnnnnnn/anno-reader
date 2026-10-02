/**
 * Tests for the usePreferencesStore (display preferences).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

describe("usePreferencesStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("defaults to the drawer layout", async () => {
    const { usePreferencesStore } = await import("@/stores/usePreferencesStore");
    expect(usePreferencesStore.getState().noteDetailLayout).toBe("drawer");
  });

  it("reads the persisted layout on startup", async () => {
    localStorage.setItem("noteDetailLayout", "modal");
    const { usePreferencesStore } = await import("@/stores/usePreferencesStore");
    expect(usePreferencesStore.getState().noteDetailLayout).toBe("modal");
  });

  it("falls back to drawer on an unknown stored value", async () => {
    localStorage.setItem("noteDetailLayout", "floating");
    const { usePreferencesStore } = await import("@/stores/usePreferencesStore");
    expect(usePreferencesStore.getState().noteDetailLayout).toBe("drawer");
  });

  it("persists the layout when it is changed", async () => {
    const { usePreferencesStore } = await import("@/stores/usePreferencesStore");
    usePreferencesStore.getState().setNoteDetailLayout("modal");

    expect(usePreferencesStore.getState().noteDetailLayout).toBe("modal");
    expect(localStorage.getItem("noteDetailLayout")).toBe("modal");
  });

  it("still works when localStorage is unavailable", async () => {
    vi.stubGlobal("localStorage", undefined);
    const { usePreferencesStore } = await import("@/stores/usePreferencesStore");

    expect(usePreferencesStore.getState().noteDetailLayout).toBe("drawer");
    expect(() =>
      usePreferencesStore.getState().setNoteDetailLayout("modal"),
    ).not.toThrow();
    expect(usePreferencesStore.getState().noteDetailLayout).toBe("modal");

    vi.unstubAllGlobals();
  });
});

describe("usePreferencesStore chat layout", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("defaults to the modal layout", async () => {
    const { usePreferencesStore } = await import("@/stores/usePreferencesStore");
    expect(usePreferencesStore.getState().chatLayout).toBe("modal");
  });

  it("reads the persisted chat layout on startup", async () => {
    localStorage.setItem("chatLayout", "drawer");
    const { usePreferencesStore } = await import("@/stores/usePreferencesStore");
    expect(usePreferencesStore.getState().chatLayout).toBe("drawer");
  });

  it("persists the chat layout when it is changed", async () => {
    const { usePreferencesStore } = await import("@/stores/usePreferencesStore");
    usePreferencesStore.getState().setChatLayout("drawer");

    expect(usePreferencesStore.getState().chatLayout).toBe("drawer");
    expect(localStorage.getItem("chatLayout")).toBe("drawer");
  });
});
