/**
 * Tests for translate mode in TextSelectionToolbar.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";
import { TextSelectionToolbar } from "..";
import type { SelectionState } from "../constants";

// Mock the hooks
const mockHandleTranslate = vi.fn();
const mockHandleCancel = vi.fn();
let mockMode = "default";
let mockSelection: SelectionState | null = {
  text: "Hello world this is selected text",
  rect: { top: 100, left: 50, bottom: 120, right: 200, width: 150, height: 20 },
  startOffset: 0,
  endOffset: 33,
};

vi.mock("../hooks", () => ({
  useSelectionListener: () => ({
    selection: mockSelection,
    mode: mockMode,
    setMode: vi.fn(),
    noteText: "",
    setNoteText: vi.fn(),
    resetSelection: vi.fn(),
  }),
  useToolbarActions: () => ({
    isCreating: false,
    handleAddNote: vi.fn(),
    handleHighlight: vi.fn(),
    handleCreateHighlight: vi.fn(),
    handleTranslate: mockHandleTranslate,
    handleSubmitNote: vi.fn(),
    handleCancel: mockHandleCancel,
  }),
  useToolbarPosition: () => ({
    getToolbarPosition: () => ({ top: "100px", left: "50px", position: "absolute" }),
  }),
}));

describe("TextSelectionToolbar - Translate Mode", () => {
  const defaultProps = {
    containerRef: { current: null } as React.RefObject<HTMLDivElement | null>,
    chapterHref: "chapter1.xhtml",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMode = "default";
    mockSelection = {
      text: "Hello world this is selected text",
      rect: { top: 100, left: 50, bottom: 120, right: 200, width: 150, height: 20 },
      startOffset: 0,
      endOffset: 33,
    };
  });

  it("renders translate button in default mode", () => {
    const html = renderToString(<TextSelectionToolbar {...defaultProps} />);

    expect(html).toContain("Translate selection");
    expect(html).toContain('title="Translate selection"');
  });

  it("renders translate icon with correct title attribute", () => {
    const html = renderToString(<TextSelectionToolbar {...defaultProps} />);

    expect(html).toContain('title="Translate selection"');
  });

  it("shows selected text in translate mode", () => {
    mockMode = "translate";
    const html = renderToString(<TextSelectionToolbar {...defaultProps} />);

    expect(html).toContain("Hello world this is selected text");
  });

  it("shows Close button in translate mode", () => {
    mockMode = "translate";
    const html = renderToString(<TextSelectionToolbar {...defaultProps} />);

    expect(html).toContain("Close");
  });

  it("shows Translate button in translate mode", () => {
    mockMode = "translate";
    const html = renderToString(<TextSelectionToolbar {...defaultProps} />);

    expect(html).toContain(">Translate<");
  });

  it("does not render translate mode content in default mode", () => {
    mockMode = "default";
    const html = renderToString(<TextSelectionToolbar {...defaultProps} />);

    // In default mode, the translate mode section should not be rendered
    // The selection preview shows truncated text, but not the full translate mode UI
    expect(html).not.toContain(">Close<");
    expect(html).not.toContain(">Translate<");
  });

  it("does not render default mode buttons in translate mode", () => {
    mockMode = "translate";
    const html = renderToString(<TextSelectionToolbar {...defaultProps} />);

    // In translate mode, the default buttons (Note, Highlight) should not be rendered
    expect(html).not.toContain(">Note<");
    expect(html).not.toContain(">Highlight<");
  });

  it("returns null when no selection", () => {
    mockSelection = null;
    const html = renderToString(<TextSelectionToolbar {...defaultProps} />);

    expect(html).toBe("");
  });
});
