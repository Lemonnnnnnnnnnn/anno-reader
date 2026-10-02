/**
 * ChatDebugModal component.
 *
 * Debug panel for the chat request: shows the exact system prompt that
 * would be sent (persona + book metadata + bound chapter full text), the
 * conversation history, per-section size estimates, and a one-click copy
 * of the request as JSON.
 */

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Modal, Button } from "@/components/primitives";
import { estimateTokens } from "@/lib/chat/context";
import type { ChatRequestDebugInfo } from "@/lib/chat/context";

interface ChatDebugModalProps {
  open: boolean;
  onClose: () => void;
  info: ChatRequestDebugInfo | null;
}

/** Copy text to the clipboard with a fallback for non-secure contexts. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function DebugBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-sans font-medium text-text-secondary dark:text-text-secondary-dark">
        {title}
      </span>
      <pre className="m-0 p-2 text-xs font-mono whitespace-pre-wrap break-words bg-surface-alt dark:bg-surface-alt-dark border border-border dark:border-border-dark rounded-md max-h-64 overflow-y-auto">
        {text}
      </pre>
    </div>
  );
}

export function ChatDebugModal({ open, onClose, info }: ChatDebugModalProps) {
  const [copied, setCopied] = useState(false);

  if (!info) return null;

  const handleCopy = async () => {
    const payload = JSON.stringify(
      { system: info.system, messages: info.messages },
      null,
      2,
    );
    const ok = await copyText(payload);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const stats: Array<[string, string]> = [
    ["System prompt", `${info.system.length} 字符 ≈ ${estimateTokens(info.system)} tokens`],
    ["消息历史", `${info.messages.length} 条`],
    [
      "绑定章节",
      info.chapterBound
        ? `${info.chapterBound.title}${info.chapterResolved ? "" : "（章节文本未能解析）"}`
        : "未绑定",
    ],
    ["章节全文", `${info.chapterTextLength} 字符`],
  ];

  return (
    <Modal open={open} onClose={onClose} title="Chat Debug" size="wide">
      <div className="flex flex-col gap-4 font-sans">
        {/* Size stats */}
        <div className="grid grid-cols-2 gap-2">
          {stats.map(([label, value]) => (
            <div
              key={label}
              className="px-3 py-2 bg-surface-alt dark:bg-surface-alt-dark border border-border dark:border-border-dark rounded-md"
            >
              <p className="m-0 text-[0.7rem] text-text-muted dark:text-text-muted-dark">
                {label}
              </p>
              <p className="m-0 text-sm text-text dark:text-text-dark">{value}</p>
            </div>
          ))}
        </div>

        {/* Request payload */}
        <DebugBlock title="System Prompt（随每次请求发送）" text={info.system} />

        {info.messages.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-sans font-medium text-text-secondary dark:text-text-secondary-dark">
              消息历史
            </span>
            {info.messages.map((msg) => (
              <DebugBlock
                key={msg.id}
                title={msg.role === "user" ? "User" : "Assistant"}
                text={msg.content}
              />
            ))}
          </div>
        ) : (
          <p className="m-0 text-xs text-text-muted dark:text-text-muted-dark">
            尚无消息历史。
          </p>
        )}

        {/* Copy action */}
        <div className="flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleCopy()}
            className="flex items-center gap-1.5"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "已复制" : "复制请求 JSON"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
