/**
 * Tests for highlight click interaction in buildAnnotationScript().
 *
 * Verifies that highlight spans receive a `data-highlight-id` attribute
 * and that clicking a highlight span sends a `highlight-click` postMessage
 * to the parent window, mirroring the note-click pattern.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildAnnotationScript } from "@/components/VerticalScroller/hooks/useAnnotationSync";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Evaluate a script string in the current DOM environment.
 * Sets up document.body with text content, then executes the script via eval.
 */
function evaluateScript(script: string, bodyText: string) {
  document.body.innerHTML = "";
  document.body.textContent = bodyText;
  // Extract the IIFE from the <script> tags and eval it directly
  const jsCode = script.replace(/<\/?script>/g, "");
  // eslint-disable-next-line no-eval
  eval(jsCode);
}

function evaluateScriptWithHtml(script: string, bodyHtml: string) {
  document.body.innerHTML = bodyHtml;
  // Extract the IIFE from the <script> tags and eval it directly
  const jsCode = script.replace(/<\/?script>/g, "");
  // eslint-disable-next-line no-eval
  eval(jsCode);
}

// ── data-highlight-id attribute ───────────────────────────────────────────────

describe("buildAnnotationScript - data-highlight-id", () => {
  it("should include data-highlight-id attribute assignment in generated script", () => {
    const highlights = [
      { id: "hl-1", cfiRange: "epubcfi(/6/4[chap01]!/4/2:0,5)", color: "#ffeb3b" },
    ];
    const script = buildAnnotationScript(highlights, []);

    // The script should set 'data-highlight-id' as a data attribute
    expect(script).toContain("highlight-id");
  });

  it("should create highlight spans with data-highlight-id in DOM", () => {
    const highlights = [
      { id: "hl-abc", cfiRange: "epubcfi(/6/4[chap01]!/4/2:0,5)", color: "#ffeb3b" },
    ];
    const script = buildAnnotationScript(highlights, []);

    // Body text: "Hello World" — first 5 chars = "Hello"
    evaluateScript(script, "Hello World");

    const span = document.querySelector(".anno-highlight");
    expect(span).not.toBeNull();
    expect(span?.getAttribute("data-highlight-id")).toBe("hl-abc");
  });

  it("should set correct highlight-id for each highlight span", () => {
    const highlights = [
      { id: "hl-1", cfiRange: "epubcfi(/6/4[chap01]!/4/2:0,5)", color: "#ffeb3b" },
      { id: "hl-2", cfiRange: "epubcfi(/6/4[chap01]!/4/2:6,11)", color: "#4caf50" },
    ];
    const script = buildAnnotationScript(highlights, []);

    // "Hello World" — "Hello" (0-5), " " (5-6), "World" (6-11)
    evaluateScript(script, "Hello World");

    const spans = document.querySelectorAll(".anno-highlight");
    expect(spans.length).toBe(2);
    expect(spans[0].getAttribute("data-highlight-id")).toBe("hl-1");
    expect(spans[1].getAttribute("data-highlight-id")).toBe("hl-2");
  });

  it("should ignore text inside injected script/style elements when resolving offsets", () => {
    const highlights = [
      { id: "hl-invalid", cfiRange: "epubcfi(/6/4[chap01]!/4/2:0,11)", color: "#ffeb3b" },
    ];
    const script = buildAnnotationScript(highlights, []);

    evaluateScriptWithHtml(
      script,
      "<p>Hello</p><script>document.body.append('hidden text')</script><style>.x{content:'hidden'}</style>",
    );

    expect(document.querySelector(".anno-highlight")).toBeNull();
  });

  it("should wrap cross-element ranges as per-text-node segments without moving element ancestors", () => {
    const highlights = [
      { id: "hl-cross", cfiRange: "epubcfi(/6/4[chap01]!/4/2:3,14)", color: "#ffeb3b" },
    ];
    const script = buildAnnotationScript(highlights, []);

    evaluateScriptWithHtml(script, "<p>Hello <em>brave</em> world</p>");

    const paragraph = document.querySelector("p");
    const emphasis = document.querySelector("em");
    const spans = document.querySelectorAll(".anno-highlight");

    expect(paragraph?.textContent).toBe("Hello brave world");
    expect(emphasis?.textContent).toBe("brave");
    expect(spans.length).toBe(3);
    expect(Array.from(spans).map((span) => span.textContent)).toEqual([
      "lo ",
      "brave",
      " wo",
    ]);
  });
});

// ── highlight-click postMessage ──────────────────────────────────────────────

describe("buildAnnotationScript - highlight-click handler", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should send highlight-click postMessage when highlight span is clicked", () => {
    const postMessageSpy = vi.fn();
    // Mock window.parent.postMessage
    Object.defineProperty(window, "parent", {
      value: { postMessage: postMessageSpy },
      writable: true,
      configurable: true,
    });

    const highlights = [
      { id: "hl-click-1", cfiRange: "epubcfi(/6/4[chap01]!/4/2:0,5)", color: "#ffeb3b" },
    ];
    const script = buildAnnotationScript(highlights, []);

    evaluateScript(script, "Hello World");

    const span = document.querySelector(".anno-highlight") as HTMLElement;
    expect(span).not.toBeNull();

    // Simulate click
    span.click();

    expect(postMessageSpy).toHaveBeenCalledTimes(1);
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "highlight-click",
        highlightId: "hl-click-1",
        rect: expect.objectContaining({
          top: expect.any(Number),
          left: expect.any(Number),
          right: expect.any(Number),
          bottom: expect.any(Number),
          width: expect.any(Number),
          height: expect.any(Number),
        }),
      }),
      "*",
    );
  });

  it("should call e.preventDefault() and e.stopPropagation() on highlight click", () => {
    const postMessageSpy = vi.fn();
    Object.defineProperty(window, "parent", {
      value: { postMessage: postMessageSpy },
      writable: true,
      configurable: true,
    });

    const highlights = [
      { id: "hl-prevent", cfiRange: "epubcfi(/6/4[chap01]!/4/2:0,5)", color: "#ffeb3b" },
    ];
    const script = buildAnnotationScript(highlights, []);

    evaluateScript(script, "Hello World");

    const span = document.querySelector(".anno-highlight") as HTMLElement;

    // Create a custom event to spy on preventDefault/stopPropagation
    const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
    const preventSpy = vi.spyOn(clickEvent, "preventDefault");
    const stopSpy = vi.spyOn(clickEvent, "stopPropagation");

    span.dispatchEvent(clickEvent);

    expect(preventSpy).toHaveBeenCalledTimes(1);
    expect(stopSpy).toHaveBeenCalledTimes(1);
    expect(postMessageSpy).toHaveBeenCalledTimes(1);
  });

  it("should send correct highlightId for different highlight spans", () => {
    const postMessageSpy = vi.fn();
    Object.defineProperty(window, "parent", {
      value: { postMessage: postMessageSpy },
      writable: true,
      configurable: true,
    });

    const highlights = [
      { id: "hl-first", cfiRange: "epubcfi(/6/4[chap01]!/4/2:0,5)", color: "#ffeb3b" },
      { id: "hl-second", cfiRange: "epubcfi(/6/4[chap01]!/4/2:6,11)", color: "#4caf50" },
    ];
    const script = buildAnnotationScript(highlights, []);

    evaluateScript(script, "Hello World");

    const spans = document.querySelectorAll(".anno-highlight");

    // Click first span
    (spans[0] as HTMLElement).click();
    expect(postMessageSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ highlightId: "hl-first" }),
      "*",
    );

    // Click second span
    (spans[1] as HTMLElement).click();
    expect(postMessageSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ highlightId: "hl-second" }),
      "*",
    );

    expect(postMessageSpy).toHaveBeenCalledTimes(2);
  });
});
