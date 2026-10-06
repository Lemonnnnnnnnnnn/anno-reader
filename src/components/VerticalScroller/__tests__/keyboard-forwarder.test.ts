/** @vitest-environment happy-dom */
import { afterEach, expect, it, vi } from "vitest";
import { KEYBOARD_FORWARDER_SCRIPT } from "../hooks/useScrollTracking";
import { parseHotkey } from "@tanstack/react-hotkeys";

afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

it("forwards a custom modified shortcut, prevents native handling, and protects typing/overlays", () => {
  const iframe = document.createElement("iframe");
  document.body.append(iframe);
  const child = iframe.contentWindow!;
  const parentMessages = vi.spyOn(child.parent, "postMessage").mockImplementation(() => {});
  const source = KEYBOARD_FORWARDER_SCRIPT.replace(/<\/?script>/g, "");
  new Function("window", source)(child);
  expect(parentMessages).toHaveBeenCalledWith({ type: "iframe-keyboard-ready" }, "*");
  parentMessages.mockClear();
  const configure = (blocked: boolean) => child.dispatchEvent(new MessageEvent("message", {
    source: child.parent,
    data: { type: "keyboard-config", shortcuts: [parseHotkey("Ctrl+Shift+U")], blocked },
  }));
  function press(target: EventTarget = child.document.body, key = "U") {
    const event = new KeyboardEvent("keydown", { key, code: "KeyU", ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true });
    vi.spyOn(event, "getModifierState").mockReturnValue(false);
    target.dispatchEvent(event);
    return event;
  }
  configure(false);
  expect(press().defaultPrevented).toBe(true);
  expect(parentMessages).toHaveBeenCalledWith(expect.objectContaining({ type: "iframe-keydown", key: "U", ctrlKey: true, shiftKey: true }), "*");
  parentMessages.mockClear();
  expect(press(child.document.body, "j").defaultPrevented).toBe(false);
  expect(parentMessages).not.toHaveBeenCalled();
  configure(true);
  expect(press().defaultPrevented).toBe(false);
  expect(parentMessages).not.toHaveBeenCalled();
  configure(false);
  const input = child.document.createElement("textarea");
  child.document.body.append(input);
  expect(press(input).defaultPrevented).toBe(false);
  expect(parentMessages).not.toHaveBeenCalled();
});
