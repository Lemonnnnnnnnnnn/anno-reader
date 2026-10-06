import { useLayoutEffect } from "react";
import { registerOpenOverlay } from "@/stores/useOverlayStore";

export function useOverlayPresence(open: boolean) {
  useLayoutEffect(() => {
    if (open) return registerOpenOverlay();
  }, [open]);
}
