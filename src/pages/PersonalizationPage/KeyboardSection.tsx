import { useEffect, useRef, useState } from "react";
import { useHotkeyRecorder } from "@tanstack/react-hotkeys";
import { Button, ErrorBanner } from "@/components/primitives";
import { Toggle } from "@/components/primitives/Toggle";
import { KEYBOARD_ACTIONS, CUSTOMIZABLE_KEYBOARD_ACTIONS, conflictingAction, displayShortcut, normalizeShortcut, type KeyboardAction } from "@/lib/keyboard";
import { useKeyboardStore } from "@/stores/useKeyboardStore";

export function KeyboardSection() {
  const bindings = useKeyboardStore((state) => state.bindings);
  const enabled = useKeyboardStore((state) => state.enabled);
  const [recording, setRecording] = useState<{ action: KeyboardAction; index: number } | null>(null);
  const [error, setError] = useState("");
  const recorder = useHotkeyRecorder({
    recordBy: "key",
    ignoreInputs: false,
    validate: (hotkey) => {
      if (!normalizeShortcut(hotkey)) return "Escape 和 Tab 保留用于关闭及焦点导航";
      if (!recording) return false;
      const conflict = conflictingAction(useKeyboardStore.getState().bindings, recording.action, hotkey);
      return conflict ? `与“${conflict.label}”的快捷键冲突` : true;
    },
    onReject: (rejection) => setError(rejection.message),
    onCancel: () => setRecording(null),
    onClear: () => {
      if (recording) useKeyboardStore.getState().setBinding(recording.action, bindings[recording.action].filter((_, index) => index !== recording.index));
      setRecording(null);
      setError("");
    },
    onRecord: (hotkey) => {
      if (!recording) return;
      const current = [...useKeyboardStore.getState().bindings[recording.action]];
      current[recording.index] = hotkey;
      const message = useKeyboardStore.getState().setBinding(recording.action, current);
      setError(message ?? "");
      setRecording(null);
    },
  });
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;

  useEffect(() => {
    if (!recording) return;
    useKeyboardStore.getState().setRecording(true);
    recorderRef.current.startRecording();
    return () => {
      useKeyboardStore.getState().setRecording(false);
      recorderRef.current.stopRecording();
    };
  }, [recording]);

  return <section id="keyboard" className="scroll-mt-6 rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-surface-dark p-5 font-sans">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-medium m-0">Keyboard</h2>
      <Button variant="secondary" size="sm" onClick={() => { setRecording(null); setError(""); useKeyboardStore.getState().resetBindings(); }}>恢复默认</Button>
    </div>
    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">点击按键录入新组合，自动保存。开关只控制快捷键，关闭后保留已设置的按键。</p>
    {recording && <p className="text-sm" role="status">请按下“{KEYBOARD_ACTIONS.find((action) => action.id === recording.action)?.label}”的快捷键，Escape 取消。</p>}
    {error && <ErrorBanner message={error} />}
    <div className="flex flex-col divide-y divide-border dark:divide-border-dark">
      {CUSTOMIZABLE_KEYBOARD_ACTIONS.map((action) => <div key={action.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
        <span className="text-sm">{action.label}</span>
        <div className="flex flex-wrap items-center gap-2">
          {bindings[action.id].map((key, index) => <div key={index} className="flex items-center gap-1">
            <Button variant="secondary" size="sm" className={enabled[action.id] ? "" : "text-text-muted dark:text-text-muted-dark"} aria-label={`修改${action.label}快捷键 ${index + 1}`} onClick={() => { setError(""); setRecording({ action: action.id, index }); }}>{recording?.action === action.id && recording.index === index ? "按下按键…" : <kbd>{displayShortcut(key)}</kbd>}</Button>
          </div>)}
          {!bindings[action.id].length && <Button variant="secondary" size="sm" aria-label={`添加${action.label}快捷键`} onClick={() => { setError(""); setRecording({ action: action.id, index: 0 }); }}>设置快捷键</Button>}
          <Toggle checked={enabled[action.id]} label={`启用${action.label}快捷键`} onChange={(checked) => {
            setRecording(null); setError("");
            if (checked && !bindings[action.id].length) setRecording({ action: action.id, index: 0 });
            else useKeyboardStore.getState().setEnabled(action.id, checked);
          }} />
        </div>
      </div>)}
    </div>
  </section>;
}
