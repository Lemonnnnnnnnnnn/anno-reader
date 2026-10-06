import { useEffect } from "react";
import { parseHotkey } from "@tanstack/react-hotkeys";
import { KEYBOARD_ACTIONS } from "@/lib/keyboard";
import { useKeyboardStore } from "@/stores/useKeyboardStore";
import { useOverlayStore } from "@/stores/useOverlayStore";

/** Sends current bindings to EPUB/Web iframe keyboard forwarders. */
export function useKeyboardBridge() {
  useEffect(() => {
    const broadcast = () => {
      const { bindings, enabled, recording } = useKeyboardStore.getState();
      const shortcuts = KEYBOARD_ACTIONS.filter((action) => action.scope === "navigation" || action.scope === "selection")
        .flatMap((action) => enabled[action.id] ? bindings[action.id].map((binding) => parseHotkey(binding)) : []);
      for (const iframe of document.querySelectorAll("iframe")) {
        iframe.contentWindow?.postMessage({ type: "keyboard-config", shortcuts, blocked: recording || useOverlayStore.getState().openCount > 0 }, "*");
      }
    };
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "iframe-keyboard-ready") broadcast();
    };
    window.addEventListener("message", onMessage);
    const unsubscribeKeyboard = useKeyboardStore.subscribe(broadcast);
    const unsubscribeOverlay = useOverlayStore.subscribe(broadcast);
    broadcast();
    return () => {
      window.removeEventListener("message", onMessage);
      unsubscribeKeyboard();
      unsubscribeOverlay();
    };
  }, []);
}
