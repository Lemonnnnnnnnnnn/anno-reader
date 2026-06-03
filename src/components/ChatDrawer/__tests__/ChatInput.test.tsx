/**
 * Tests for ChatInput component.
 *
 * Verifies that:
 * - Enter sends message and clears input
 * - Shift+Enter inserts newline without sending
 * - Send button triggers send callback
 * - Disabled state prevents sending and shows loading indicator
 * - Empty/whitespace-only messages are not sent
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { ChatInput } from "@/components/ChatDrawer/ChatInput";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function render(ui: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function getTextarea(container: HTMLElement): HTMLTextAreaElement {
  const el = container.querySelector("textarea");
  if (!el) throw new Error("textarea not found");
  return el;
}

function getSendButton(container: HTMLElement): HTMLButtonElement {
  const el = container.querySelector('button[aria-label="Send message"]');
  if (!el) throw new Error("send button not found");
  return el as HTMLButtonElement;
}

function typeText(container: HTMLElement, text: string) {
  const textarea = getTextarea(container);
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  act(() => {
    nativeSetter?.call(textarea, text);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function pressEnter(container: HTMLElement, opts?: { shiftKey?: boolean }) {
  const textarea = getTextarea(container);
  act(() => {
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        shiftKey: opts?.shiftKey ?? false,
        bubbles: true,
      }),
    );
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChatInput", () => {
  let onSend: ReturnType<typeof vi.fn>;
  let container: HTMLElement;
  let unmount: () => void;

  beforeEach(() => {
    // @ts-ignore - Vitest mock type inference issue
    onSend = vi.fn();
    const rendered = render(<ChatInput onSend={onSend} />);
    container = rendered.container;
    unmount = rendered.unmount;
  });

  afterEach(() => {
    unmount();
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  it("renders a textarea and a send button", () => {
    expect(getTextarea(container)).toBeTruthy();
    expect(getSendButton(container)).toBeTruthy();
  });

  it("renders with the default placeholder", () => {
    const textarea = getTextarea(container);
    expect(textarea.placeholder).toBe("Ask about this book…");
  });

  it("renders with a custom placeholder", () => {
    const custom = render(
      <ChatInput onSend={onSend} placeholder="Type here…" />,
    );
    expect(getTextarea(custom.container).placeholder).toBe("Type here…");
    custom.unmount();
  });

  // -------------------------------------------------------------------------
  // Sending with Enter
  // -------------------------------------------------------------------------

  it("sends message on Enter and clears the input", () => {
    typeText(container, "Hello world");
    pressEnter(container);

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("Hello world");
    expect(getTextarea(container).value).toBe("");
  });

  it("trims whitespace before sending", () => {
    typeText(container, "  trimmed message  ");
    pressEnter(container);

    expect(onSend).toHaveBeenCalledWith("trimmed message");
  });

  it("does not send empty or whitespace-only messages", () => {
    typeText(container, "   ");
    pressEnter(container);

    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not send when textarea is empty", () => {
    pressEnter(container);

    expect(onSend).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Shift+Enter (newline)
  // -------------------------------------------------------------------------

  it("does not send on Shift+Enter", () => {
    typeText(container, "line one");
    pressEnter(container, { shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("preserves text after Shift+Enter", () => {
    typeText(container, "line one");
    pressEnter(container, { shiftKey: true });

    // Text should still be in the textarea (not cleared)
    expect(getTextarea(container).value).toBe("line one");
  });

  // -------------------------------------------------------------------------
  // Send button
  // -------------------------------------------------------------------------

  it("sends message when send button is clicked", () => {
    typeText(container, "click send");
    act(() => {
      getSendButton(container).click();
    });

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("click send");
    expect(getTextarea(container).value).toBe("");
  });

  it("disables send button when input is empty", () => {
    const button = getSendButton(container);
    expect(button.disabled).toBe(true);
  });

  it("enables send button when input has text", () => {
    typeText(container, "some text");
    const button = getSendButton(container);
    expect(button.disabled).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Disabled state (streaming in progress)
  // -------------------------------------------------------------------------

  it("disables textarea when disabled prop is true", () => {
    const disabled = render(<ChatInput onSend={onSend} disabled />);
    expect(getTextarea(disabled.container).disabled).toBe(true);
    disabled.unmount();
  });

  it("disables send button when disabled prop is true", () => {
    const disabled = render(<ChatInput onSend={onSend} disabled />);
    expect(getSendButton(disabled.container).disabled).toBe(true);
    disabled.unmount();
  });

  it("does not send when disabled even if Enter is pressed", () => {
    // Re-render with disabled
    unmount();
    const disabled = render(<ChatInput onSend={onSend} disabled />);
    typeText(disabled.container, "should not send");
    pressEnter(disabled.container);

    expect(onSend).not.toHaveBeenCalled();
    disabled.unmount();
  });

  it("shows loading spinner when disabled", () => {
    const disabled = render(<ChatInput onSend={onSend} disabled />);
    const button = getSendButton(disabled.container);
    const spinner = button.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
    disabled.unmount();
  });

  it("shows arrow icon when not disabled", () => {
    const button = getSendButton(container);
    const spinner = button.querySelector(".animate-spin");
    expect(spinner).toBeNull();
  });
});
