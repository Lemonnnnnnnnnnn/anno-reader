/**
 * Tests for usePdfSelection message bridging.
 *
 * Regression guards for toolbar dismissal semantics:
 * - mousedown ANYWHERE outside the floating toolbar posts
 *   "text-selection-cleared" — including empty page space (the text
 *   layer covers the whole page), so clicking blank areas closes the
 *   toolbar.
 * - mousedown inside the floating toolbar does NOT post cleared.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { useRef } from "react";
import { usePdfSelection } from "../hooks/usePdfSelection";

/** Probe: a container with a text layer (one text span). */
function Probe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  usePdfSelection({
    textLayerRef,
    containerRef,
    renderEpoch: 1,
    pageLines: ["hello"],
  });
  return (
    <div ref={containerRef} className="pdfPageWrap">
      <div ref={textLayerRef} className="pdfTextLayer">
        <span>hello</span>
      </div>
    </div>
  );
}

/** Collect posted message types. */
function postedTypes(spy: ReturnType<typeof vi.spyOn>): string[] {
  return spy.mock.calls
    .map((call) => (call[0] as { type?: string } | undefined)?.type)
    .filter((t): t is string => typeof t === "string");
}

function mouseDown(target: Element) {
  target.dispatchEvent(
    new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
  );
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("usePdfSelection mousedown dismissal", () => {
  it("posts text-selection-cleared when clicking empty page space", async () => {
    const postMessage = vi.spyOn(window, "postMessage");

    await act(async () => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      createRoot(container).render(<Probe />);
    });
    postMessage.mockClear(); // drop the mount-time cleared message

    // Click the blank text layer area (between/around text)
    const textLayer = document.querySelector(".pdfTextLayer")!;
    mouseDown(textLayer);

    expect(postedTypes(postMessage)).toContain("text-selection-cleared");
    postMessage.mockRestore();
  });

  it("does NOT post cleared when pressing inside the floating toolbar", async () => {
    const postMessage = vi.spyOn(window, "postMessage");

    await act(async () => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      createRoot(container).render(<Probe />);
    });

    const toolbar = document.createElement("div");
    toolbar.setAttribute("data-selection-toolbar", "");
    const button = document.createElement("button");
    toolbar.appendChild(button);
    document.body.appendChild(toolbar);

    postMessage.mockClear();
    mouseDown(button);

    expect(postedTypes(postMessage)).not.toContain("text-selection-cleared");
    postMessage.mockRestore();
  });
});
