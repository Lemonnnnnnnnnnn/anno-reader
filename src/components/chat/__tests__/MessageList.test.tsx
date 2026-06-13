/**
 * Tests for the MessageList component.
 *
 * Uses renderToString (node env) to avoid jsdom ESM issues.
 * Tests structural rendering; interactivity (scroll) is covered by integration tests.
 *
 * @vitest-environment node
 */

import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { MessageList } from "@/components/chat";
import type { ChatMessage } from "@/lib/chat/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseTime = new Date("2026-01-15T10:30:00").getTime();

const userMessage: ChatMessage = {
  id: "msg-1",
  role: "user",
  content: "What is the meaning of life?",
  createdAt: baseTime,
};

const aiMessage: ChatMessage = {
  id: "msg-2",
  role: "assistant",
  content: "The meaning of life is **42**, according to Douglas Adams.",
  createdAt: baseTime + 2000,
};

const aiMessageWithList: ChatMessage = {
  id: "msg-3",
  role: "assistant",
  content: "Key points:\n- First point\n- Second point\n- Third point",
  createdAt: baseTime + 5000,
};

const messages: ChatMessage[] = [userMessage, aiMessage];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MessageList", () => {
  it("renders empty state when no messages", () => {
    const html = renderToString(<MessageList messages={[]} />);

    expect(html).toContain("Start a conversation...");
  });

  it("renders user and AI messages", () => {
    const html = renderToString(<MessageList messages={messages} />);

    expect(html).toContain("What is the meaning of life?");
    expect(html).toContain("according to Douglas Adams");
  });

  it("renders user message with right alignment", () => {
    const html = renderToString(<MessageList messages={messages} />);

    // items-end class for user message alignment
    expect(html).toContain("items-end");
  });

  it("renders AI message with left alignment", () => {
    const html = renderToString(<MessageList messages={messages} />);

    // items-start class for AI message alignment
    expect(html).toContain("items-start");
  });

  it("renders user message with accent background", () => {
    const html = renderToString(<MessageList messages={[userMessage]} />);

    expect(html).toContain("bg-accent");
  });

  it("renders AI message with surface-alt background", () => {
    const html = renderToString(<MessageList messages={[aiMessage]} />);

    expect(html).toContain("bg-surface-alt");
  });

  it("renders markdown as HTML in AI messages", () => {
    const html = renderToString(<MessageList messages={[aiMessage]} />);

    // **bold** should be rendered as <strong>
    expect(html).toContain("<strong>");
  });

  it("renders user messages as plain text, not markdown", () => {
    const boldUserMsg: ChatMessage = {
      id: "msg-bold",
      role: "user",
      content: "This is **not** bold",
      createdAt: baseTime,
    };
    const html = renderToString(<MessageList messages={[boldUserMsg]} />);

    // User messages should not have <strong> — they use whitespace-pre-wrap
    expect(html).not.toContain("<strong>");
    expect(html).toContain("whitespace-pre-wrap");
  });

  it("renders markdown list in AI messages", () => {
    const html = renderToString(<MessageList messages={[aiMessageWithList]} />);

    expect(html).toContain("<li>");
    expect(html).toContain("First point");
  });

  it("renders timestamp for each message", () => {
    const html = renderToString(<MessageList messages={messages} />);

    // Timestamp should contain time digits (10:30 or 10:32)
    expect(html).toMatch(/\d{1,2}:\d{2}/);
  });

  it("applies markdown-note class to AI message content", () => {
    const html = renderToString(<MessageList messages={[aiMessage]} />);

    expect(html).toContain("markdown-note");
  });

  it("renders data-testid on message list container", () => {
    const html = renderToString(<MessageList messages={messages} />);

    expect(html).toContain('data-testid="message-list"');
  });

  it("renders multiple messages in order", () => {
    const threeMessages = [userMessage, aiMessage, aiMessageWithList];
    const html = renderToString(<MessageList messages={threeMessages} />);

    // Both AI messages should be present
    expect(html).toContain("according to Douglas Adams");
    expect(html).toContain("First point");
  });
});
