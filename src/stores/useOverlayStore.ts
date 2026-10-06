import { create } from "zustand";

/** Tracks all mounted open dialogs, including nested Modal/Drawer pairs. */
export const useOverlayStore = create<{ openCount: number }>(() => ({ openCount: 0 }));

export function registerOpenOverlay() {
  useOverlayStore.setState((state) => ({ openCount: state.openCount + 1 }));
  let released = false;
  return () => {
    if (released) return;
    released = true;
    useOverlayStore.setState((state) => ({ openCount: state.openCount - 1 }));
  };
}
