import { areHotkeysEqual, formatForDisplay, matchesKeyboardEvent, normalizeHotkey, parseHotkey, validateHotkey } from "@tanstack/react-hotkeys";

export const KEYBOARD_ACTIONS = [
  { id: "translate", label: "打开通用翻译", scope: "navigation", defaults: ["Alt+t"] },
  { id: "settings", label: "打开设置", scope: "navigation", defaults: ["Alt+,"] },
  { id: "toc", label: "打开目录", scope: "navigation", defaults: ["Alt+o"] },
  { id: "annotations", label: "打开笔记", scope: "navigation", defaults: ["Alt+n"] },
  { id: "dictionary", label: "打开词典", scope: "navigation", defaults: ["Alt+d"] },
  { id: "chat", label: "打开 AI Chat", scope: "navigation", defaults: ["Alt+c"] },
  { id: "previousChapter", label: "上一章 / 页", scope: "navigation", defaults: ["ArrowLeft"] },
  { id: "nextChapter", label: "下一章 / 页", scope: "navigation", defaults: ["ArrowRight"] },
  { id: "scrollDown", label: "向下滚动", scope: "navigation", defaults: ["j", "ArrowDown"] },
  { id: "scrollUp", label: "向上滚动", scope: "navigation", defaults: ["k", "ArrowUp"] },
  { id: "selectionNote", label: "划词：添加笔记", scope: "selection", defaults: [] },
  { id: "selectionHighlight", label: "划词：高亮", scope: "selection", defaults: [] },
  { id: "selectionTranslate", label: "划词：AI 翻译", scope: "selection", defaults: [] },
  { id: "selectionQuickTranslate", label: "划词：翻译并保存笔记", scope: "selection", defaults: [] },
  { id: "selectionAskAI", label: "划词：询问 AI", scope: "selection", defaults: [] },
  { id: "selectionSpeak", label: "划词：朗读 / 停止", scope: "selection", defaults: [] },
  { id: "submit", label: "提交翻译 / 保存笔记", scope: "form", defaults: ["Mod+Enter"] },
  { id: "sendChat", label: "发送聊天消息", scope: "chat", defaults: ["Enter"] },
] as const;

export type KeyboardAction = typeof KEYBOARD_ACTIONS[number]["id"];
const FIXED_ACTION_IDS = new Set<KeyboardAction>(["submit", "sendChat", "previousChapter", "nextChapter", "scrollDown", "scrollUp"]);
export function isCustomizableAction(id: KeyboardAction) { return !FIXED_ACTION_IDS.has(id); }
export const CUSTOMIZABLE_KEYBOARD_ACTIONS = KEYBOARD_ACTIONS.filter((action) => isCustomizableAction(action.id));
export const FIXED_KEYBOARD_ACTIONS = KEYBOARD_ACTIONS.filter((action) => !isCustomizableAction(action.id));
export type KeyBindings = Record<KeyboardAction, string[]>;
export interface KeyboardInput {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
  repeat?: boolean;
}

export function defaultKeyBindings(): KeyBindings {
  return Object.fromEntries(KEYBOARD_ACTIONS.map((action) => [action.id, [...action.defaults]])) as KeyBindings;
}

export function normalizeShortcut(value: string): string | null {
  const validation = validateHotkey(value);
  if (!validation.valid || validation.warnings.some((warning) => warning.startsWith("Unknown key:"))) return null;
  const normalized = normalizeHotkey(value);
  if (["Escape", "Tab"].includes(parseHotkey(normalized).key ?? "")) return null;
  return normalized;
}

export function shortcutMatches(shortcut: string, event: KeyboardInput): boolean {
  if (event.isComposing) return false;
  const normalized = normalizeShortcut(shortcut);
  if (!normalized) return false;
  const keyboardEvent = event instanceof KeyboardEvent ? event : new KeyboardEvent("keydown", event);
  return matchesKeyboardEvent(keyboardEvent, parseHotkey(normalized));
}

export function shortcutsOverlap(a: string, b: string): boolean {
  return (["windows", "mac", "linux"] as const).some((platform) => areHotkeysEqual(parseHotkey(a, platform), parseHotkey(b, platform), platform));
}

export function conflictingAction(bindings: KeyBindings, id: KeyboardAction, shortcut: string) {
  const scope = KEYBOARD_ACTIONS.find((action) => action.id === id)!.scope;
  return KEYBOARD_ACTIONS.find((action) => action.id !== id
    && (action.scope === scope || (["navigation", "selection"].includes(scope) && ["navigation", "selection"].includes(action.scope)))
    && bindings[action.id].some((binding) => shortcutsOverlap(binding, shortcut)));
}

export function isTypingTarget(target: EventTarget | null = document.activeElement): boolean {
  return target instanceof HTMLElement && (!!target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])") || target.isContentEditable);
}

export function displayShortcut(shortcut: string): string {
  return formatForDisplay(shortcut);
}
