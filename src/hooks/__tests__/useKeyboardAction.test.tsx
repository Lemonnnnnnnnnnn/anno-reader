/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useKeyboardAction } from "../useKeyboardAction";
import { useKeyboardStore } from "@/stores/useKeyboardStore";
import { registerOpenOverlay } from "@/stores/useOverlayStore";

it("updates bindings immediately, protects inputs/overlays and handles modified iframe keys", async () => {
  vi.spyOn(KeyboardEvent.prototype, "getModifierState").mockReturnValue(false);
  useKeyboardStore.getState().resetBindings();
  const called = vi.fn();
  function Probe() { useKeyboardAction("translate", called); return null; }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<Probe />));
  function press(key = "t", modifiers: KeyboardEventInit = { altKey: true }) {
    document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...modifiers }));
    document.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, ...modifiers }));
  }
  await act(async () => press());
  expect(called).toHaveBeenCalledTimes(1);
  await act(async () => { useKeyboardStore.getState().setBinding("translate", ["Ctrl+u"]); });
  await act(async () => press());
  expect(called).toHaveBeenCalledTimes(1);
  await act(async () => press("u", { ctrlKey: true }));
  expect(called).toHaveBeenCalledTimes(2);
  const input = document.createElement("textarea");
  document.body.append(input);
  input.focus();
  await act(async () => press("u", { ctrlKey: true }));
  expect(called).toHaveBeenCalledTimes(2);
  input.remove();
  let close!: () => void;
  await act(async () => { close = registerOpenOverlay(); });
  await act(async () => press("u", { ctrlKey: true }));
  expect(called).toHaveBeenCalledTimes(2);
  await act(async () => close());
  await act(async () => window.dispatchEvent(new MessageEvent("message", { data: { type: "iframe-keydown", key: "u", ctrlKey: true } })));
  expect(called).toHaveBeenCalledTimes(3);
  await act(async () => root.unmount());
  container.remove();
  useKeyboardStore.getState().resetBindings();
  vi.restoreAllMocks();
});
