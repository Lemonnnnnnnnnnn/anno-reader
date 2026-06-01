/**
 * Tests for the Drawer component.
 *
 * Uses renderToString (node env) to avoid jsdom ESM issues.
 * Tests structural rendering; interactivity is covered by integration tests.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";
import { Drawer } from "..";

describe("Drawer", () => {
  it("renders nothing when isOpen is false", () => {
    const html = renderToString(
      <Drawer isOpen={false} onClose={vi.fn()} title="Test">
        <p>Content</p>
      </Drawer>,
    );

    expect(html).toBe("");
  });

  it("renders children when isOpen is true", () => {
    const html = renderToString(
      <Drawer isOpen={true} onClose={vi.fn()} title="Test Title">
        <p>Drawer content here</p>
      </Drawer>,
    );

    expect(html).toContain("Test Title");
    expect(html).toContain("Drawer content here");
  });

  it("renders title in header", () => {
    const html = renderToString(
      <Drawer isOpen={true} onClose={vi.fn()} title="Settings">
        <div />
      </Drawer>,
    );

    expect(html).toContain("Settings");
  });

  it("renders close button with aria-label", () => {
    const html = renderToString(
      <Drawer isOpen={true} onClose={vi.fn()} title="Test">
        <div />
      </Drawer>,
    );

    expect(html).toContain('aria-label="Close drawer"');
  });

  it("renders backdrop overlay", () => {
    const html = renderToString(
      <Drawer isOpen={true} onClose={vi.fn()} title="Test">
        <div />
      </Drawer>,
    );

    expect(html).toContain("bg-black/50");
  });

  it("renders without title when title is not provided", () => {
    const html = renderToString(
      <Drawer isOpen={true} onClose={vi.fn()}>
        <div>Content</div>
      </Drawer>,
    );

    // Close button should still be present
    expect(html).toContain('aria-label="Close drawer"');
    expect(html).toContain("Content");
  });

  it("renders panel with fixed positioning", () => {
    const html = renderToString(
      <Drawer isOpen={true} onClose={vi.fn()} title="Test">
        <div />
      </Drawer>,
    );

    expect(html).toContain("fixed");
    expect(html).toContain("right-0");
  });
});
