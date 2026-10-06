import { create } from "zustand";
import { KEYBOARD_ACTIONS, conflictingAction, defaultKeyBindings, isCustomizableAction, normalizeShortcut, type KeyboardAction, type KeyBindings, type KeyboardInput, shortcutMatches } from "@/lib/keyboard";

const STORAGE_KEY = "keyboardBindings";
const ENABLED_KEY = "keyboardEnabled";

function defaultEnabled(bindings: KeyBindings): Record<KeyboardAction, boolean> {
  return Object.fromEntries(KEYBOARD_ACTIONS.map((action) => [action.id, bindings[action.id].length > 0])) as Record<KeyboardAction, boolean>;
}

function loadEnabled(bindings: KeyBindings) {
  const enabled = defaultEnabled(bindings);
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(ENABLED_KEY) ?? "null");
    if (stored && typeof stored === "object") for (const action of KEYBOARD_ACTIONS) {
      if (isCustomizableAction(action.id) && Reflect.get(stored, action.id) === false) enabled[action.id] = false;
    }
  } catch { /* Use defaults. */ }
  return enabled;
}

function loadBindings(): KeyBindings {
  const bindings = defaultKeyBindings();
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!stored || typeof stored !== "object") return bindings;
    for (const action of KEYBOARD_ACTIONS) {
      if (!isCustomizableAction(action.id)) continue;
      const values: unknown = Reflect.get(stored, action.id);
      if (!Array.isArray(values) || !values.every((value): value is string => typeof value === "string" && normalizeShortcut(value) !== null)) continue;
      bindings[action.id] = [...new Set(values.map((value) => normalizeShortcut(value)!))];
    }
    // Recover safely from old/corrupt configurations with overlapping commands.
    if (KEYBOARD_ACTIONS.some((action) => bindings[action.id].some((key) => conflictingAction(bindings, action.id, key)))) return defaultKeyBindings();
  } catch { /* Use defaults without browser storage. */ }
  return bindings;
}

function persist(bindings: KeyBindings, enabled: Record<KeyboardAction, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
    localStorage.setItem(ENABLED_KEY, JSON.stringify(enabled));
  } catch { /* Remain usable for this session. */ }
}

interface KeyboardStore {
  bindings: KeyBindings;
  enabled: Record<KeyboardAction, boolean>;
  setEnabled: (action: KeyboardAction, enabled: boolean) => void;
  recording: boolean;
  setRecording: (recording: boolean) => void;
  setBinding: (action: KeyboardAction, shortcuts: string[]) => string | null;
  resetBindings: () => void;
}

const initialBindings = loadBindings();
export const useKeyboardStore = create<KeyboardStore>((set, get) => ({
  bindings: initialBindings,
  enabled: loadEnabled(initialBindings),
  setEnabled: (action, value) => {
    if (!isCustomizableAction(action) || (value && !get().bindings[action].length)) return;
    const enabled = { ...get().enabled, [action]: value };
    persist(get().bindings, enabled);
    set({ enabled });
  },
  recording: false,
  setRecording: (recording) => set({ recording }),
  setBinding: (action, shortcuts) => {
    if (!isCustomizableAction(action)) return "此功能使用固定的默认快捷键";
    const normalized: string[] = [];
    for (const shortcut of shortcuts) {
      const key = normalizeShortcut(shortcut);
      if (!key) return "请选择有效按键；Escape 和 Tab 保留用于关闭及焦点导航";
      const conflict = conflictingAction(get().bindings, action, key);
      if (conflict) return `与“${conflict.label}”的快捷键冲突`;
      if (!normalized.includes(key)) normalized.push(key);
    }
    const bindings = { ...get().bindings, [action]: normalized };
    const enabled = { ...get().enabled, [action]: normalized.length > 0 };
    persist(bindings, enabled);
    set({ bindings, enabled });
    return null;
  },
  resetBindings: () => {
    const bindings = defaultKeyBindings();
    const enabled = defaultEnabled(bindings);
    persist(bindings, enabled);
    set({ bindings, enabled });
  },
}));

export function matchesAction(action: KeyboardAction, event: KeyboardInput) {
  const { bindings, enabled, recording } = useKeyboardStore.getState();
  return !recording && enabled[action] && bindings[action].some((shortcut) => shortcutMatches(shortcut, event));
}
