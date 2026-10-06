import { useEffect, useRef } from "react";
import { parseHotkey, useHotkeys } from "@tanstack/react-hotkeys";
import { isTypingTarget, type KeyboardAction, type KeyboardInput } from "@/lib/keyboard";
import { matchesAction, useKeyboardStore } from "@/stores/useKeyboardStore";
import { useOverlayStore } from "@/stores/useOverlayStore";
const EMPTY_BINDINGS: string[] = [];

/** Shared parent/EPUB shortcut handling for non-editing commands. */
export function useKeyboardAction(action: KeyboardAction, callback: () => void, enabled = true) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const shortcuts = useKeyboardStore((state) => state.enabled[action] ? state.bindings[action] : EMPTY_BINDINGS);
  const recording = useKeyboardStore((state) => state.recording);
  const overlayOpen = useOverlayStore((state) => state.openCount > 0);
  useHotkeys(enabled && !recording && !overlayOpen ? shortcuts.map((shortcut) => ({
    hotkey: parseHotkey(shortcut),
    callback: (event) => {
      if (!event.repeat && !event.isComposing && !isTypingTarget()) callbackRef.current();
    },
  })) : [], { ignoreInputs: true, preventDefault: true, stopPropagation: false });
  useEffect(() => {
    if (!enabled) return;
    const allowed = (event: KeyboardInput) => !event.repeat && useOverlayStore.getState().openCount === 0 && matchesAction(action, event);
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type !== "iframe-keydown" || typeof data.key !== "string" || isTypingTarget()) return;
      if (allowed(data)) callbackRef.current();
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [action, enabled]);
}
