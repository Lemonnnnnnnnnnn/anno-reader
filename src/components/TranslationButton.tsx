import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Languages } from "lucide-react";
import { Button, ErrorBanner, Modal, TextArea } from "@/components/primitives";
import { useAIConfigStore } from "@/stores/useAIConfigStore";
import { translationService } from "@/lib/ai/translation";
import { detectTranslationTarget, type TranslationDirection } from "@/lib/ai/translationDirection";
import type { TranslationThinking } from "@/lib/ai/service";
import { useKeyboardAction } from "@/hooks/useKeyboardAction";
import { displayShortcut } from "@/lib/keyboard";
import { matchesAction, useKeyboardStore } from "@/stores/useKeyboardStore";

const selectClass = "rounded-md border border-border dark:border-border-dark bg-surface dark:bg-surface-dark text-text dark:text-text-dark p-2 text-sm";
const thinkingStorageKey = "plainTranslationThinking";

function isTranslationThinking(value: string | null): value is TranslationThinking {
  return value === "default" || value === "none" || value === "low" || value === "high" || value === "max";
}

function loadThinking(): TranslationThinking {
  try {
    const value = localStorage.getItem(thinkingStorageKey);
    if (isTranslationThinking(value)) return value;
  } catch { /* Storage may be unavailable; retain the initial preference. */ }
  return "none";
}

/** Header entry shared by bookshelf and reader; independent of book selection. */
export function TranslationButton() {
  const navigate = useNavigate();
  const config = useAIConfigStore((state) => state.config);
  const [open, setOpen] = useState(false);
  useKeyboardAction("translate", () => setOpen(true));
  const submitKeys = useKeyboardStore((state) => state.bindings.submit);
  const [text, setText] = useState("");
  const [target, setTarget] = useState<TranslationDirection>("auto");
  const [providerId, setProviderId] = useState("");
  const [thinking, setThinking] = useState<TranslationThinking>(loadThinking);
  const [translation, setTranslation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const providers = config.providers.filter((provider) => provider.enabled);
  const provider = providers.find((item) => item.id === providerId)
    ?? providers.find((item) => item.id === config.selectedProviderId)
    ?? providers[0];

  useEffect(() => () => requestRef.current?.abort(), []);

  function cancel() {
    requestRef.current?.abort();
    requestRef.current = null;
    setBusy(false);
  }

  function close() {
    cancel();
    setOpen(false);
  }

  async function translate() {
    if (requestRef.current || !provider || !text.trim()) return;
    const targetLanguage = target === "auto" ? detectTranslationTarget(text) : target;
    if (!targetLanguage) {
      setTranslation(text.trim());
      setError("");
      setCopied(false);
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setError("");
    setTranslation("");
    setCopied(false);
    try {
      const result = await translationService.translatePlain(text.trim(), targetLanguage, provider, thinking, controller.signal);
      let output = "";
      for await (const chunk of result.textStream) {
        if (controller.signal.aborted || requestRef.current !== controller) return;
        output += chunk;
        setTranslation(output);
      }
      if (!controller.signal.aborted && !output.trim()) throw new Error("服务未返回译文");
    } catch (cause) {
      if (!controller.signal.aborted && requestRef.current === controller) {
        setError(cause instanceof Error ? cause.message : "翻译失败，请重试");
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setBusy(false);
      }
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(translation);
      setCopied(true);
    } catch {
      setError("复制失败，请手动选中译文复制");
    }
  }

  return <>
    <Button variant="icon" title="翻译" aria-label="翻译" onClick={() => setOpen(true)}>
      <Languages size={16} />
    </Button>
    <Modal open={open} onClose={close} title="翻译" size="wide">
      <div className="flex flex-col gap-4 font-sans" onKeyDown={(event) => {
        if (!event.repeat && matchesAction("submit", event.nativeEvent)) {
          event.preventDefault();
          event.stopPropagation();
          void translate();
        }
      }}>
        {!provider ? <div className="flex flex-col gap-3">
          <p className="text-sm">请先配置并启用 AI 服务，翻译将复用你的 API 配置。</p>
          <Button onClick={() => { close(); navigate("/ai-config"); }}>配置 AI 服务</Button>
        </div> : <>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-sm flex-1">服务
              <select className={selectClass} value={provider.id} disabled={busy} onChange={(event) => setProviderId(event.target.value)}>
                {providers.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.model}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">翻译方向
              <select className={selectClass} value={target} disabled={busy} onChange={(event) => {
                const value = event.target.value;
                if (value === "auto" || value === "Chinese" || value === "English") setTarget(value);
              }}>
                <option value="auto">自动识别</option>
                <option value="Chinese">英文 → 中文</option>
                <option value="English">中文 → 英文</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">思考设置
              <select aria-label="思考设置" className={selectClass} value={thinking} disabled={busy} onChange={(event) => {
                const value = event.target.value;
                if (isTranslationThinking(value)) {
                  setThinking(value);
                  try { localStorage.setItem(thinkingStorageKey, value); }
                  catch { /* The selected preference remains usable for this session. */ }
                }
              }}>
                <option value="default">服务默认</option>
                <option value="none">关闭</option>
                <option value="low">low（少量思考）</option>
                <option value="high">high（深入思考）</option>
                <option value="max">max（最大强度）</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-text-secondary dark:text-text-secondary-dark">始终思考的模型可选 low 以减少等待；若服务不支持所选参数，请选择“服务默认”。</p>
          <label className="flex flex-col gap-2 text-sm">原文
            <TextArea rows={6} value={text} disabled={busy} onChange={(event) => setText(event.target.value)} placeholder="输入或粘贴需要翻译的单词、句子或段落" />
          </label>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-text-secondary dark:text-text-secondary-dark">{submitKeys.map(displayShortcut).join(" / ")}{submitKeys.length ? " 翻译" : ""}</span>
            {busy ? <Button variant="secondary" onClick={cancel}>取消</Button>
              : <Button disabled={!text.trim()} onClick={() => void translate()}>翻译</Button>}
          </div>
          {error && <ErrorBanner message={error} />}
          <div className="flex items-center justify-between">
            <span className="text-sm">译文{busy ? " · 翻译中…" : ""}</span>
            <Button variant="secondary" size="sm" disabled={!translation || busy} onClick={() => void copy()}>{copied ? "已复制" : "复制"}</Button>
          </div>
          <div aria-live="polite" aria-busy={busy} className="min-h-32 max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border dark:border-border-dark p-3 text-sm leading-relaxed select-text">
            {translation || (busy ? "等待译文…" : "译文将显示在这里")}
          </div>
        </>}
      </div>
    </Modal>
  </>;
}
