/**
 * Tests for the useTheme hook.
 *
 * Verifies that the hook synchronizes the Zustand ui.theme state
 * to document.documentElement.classList by toggling the 'dark' class.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createElement } from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { useBookStore } from "../stores/useBookStore";
import useTheme from "../hooks/useTheme";

// Helper component that renders the hook
function ThemeConsumer() {
  useTheme();
  return null;
}

let root: Root | null = null;

function renderThemeConsumer() {
  root = createRoot(document.createElement("div"));
  act(() => {
    root!.render(createElement(ThemeConsumer));
  });
}

function cleanup() {
  act(() => {
    root?.unmount();
  });
  root = null;
}

describe("useTheme", () => {
  beforeEach(() => {
    cleanup();
    // Reset theme to light before each test
    useBookStore.setState({ ui: { ...useBookStore.getState().ui, theme: "light" } });
    // Clear the dark class from <html>
    document.documentElement.classList.remove("dark");
  });

  it("applies 'dark' class when theme is 'dark'", () => {
    useBookStore.setState({ ui: { ...useBookStore.getState().ui, theme: "dark" } });

    renderThemeConsumer();

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("does not apply 'dark' class when theme is 'light'", () => {
    useBookStore.setState({ ui: { ...useBookStore.getState().ui, theme: "light" } });

    renderThemeConsumer();

    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("updates DOM when theme changes from light to dark", () => {
    useBookStore.setState({ ui: { ...useBookStore.getState().ui, theme: "light" } });

    renderThemeConsumer();

    expect(document.documentElement.classList.contains("dark")).toBe(false);

    // Change theme — Zustand triggers re-render which fires useEffect
    act(() => {
      useBookStore.setState({ ui: { ...useBookStore.getState().ui, theme: "dark" } });
    });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("updates DOM when theme changes from dark to light", () => {
    useBookStore.setState({ ui: { ...useBookStore.getState().ui, theme: "dark" } });

    renderThemeConsumer();

    expect(document.documentElement.classList.contains("dark")).toBe(true);

    // Change theme
    act(() => {
      useBookStore.setState({ ui: { ...useBookStore.getState().ui, theme: "light" } });
    });

    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
