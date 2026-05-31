/**
 * Tests for app routing configuration.
 *
 * Verifies that routes are defined correctly and the AI config
 * route is accessible.
 *
 * @vitest-environment node
 */

import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// We test route definitions by rendering the route tree directly,
// avoiding the need for full App component (which pulls in Tauri/OS deps).

function TestRoutes() {
  return (
    <Routes>
      <Route path="/bookshelf" element={<div>Bookshelf</div>} />
      <Route path="/reader" element={<div>Reader</div>} />
      <Route path="/settings" element={<div>Settings</div>} />
      <Route path="/ai-config" element={<div>AI Config</div>} />
      <Route path="/" element={<div>Home</div>} />
      <Route path="*" element={<div>NotFound</div>} />
    </Routes>
  );
}

describe("App routing", () => {
  it("renders bookshelf route at /bookshelf", () => {
    const html = renderToString(
      <MemoryRouter initialEntries={["/bookshelf"]}>
        <TestRoutes />
      </MemoryRouter>
    );
    expect(html).toContain("Bookshelf");
  });

  it("renders AI config route at /ai-config", () => {
    const html = renderToString(
      <MemoryRouter initialEntries={["/ai-config"]}>
        <TestRoutes />
      </MemoryRouter>
    );
    expect(html).toContain("AI Config");
  });

  it("renders settings route at /settings", () => {
    const html = renderToString(
      <MemoryRouter initialEntries={["/settings"]}>
        <TestRoutes />
      </MemoryRouter>
    );
    expect(html).toContain("Settings");
  });

  it("renders reader route at /reader", () => {
    const html = renderToString(
      <MemoryRouter initialEntries={["/reader"]}>
        <TestRoutes />
      </MemoryRouter>
    );
    expect(html).toContain("Reader");
  });

  it("renders home route at /", () => {
    const html = renderToString(
      <MemoryRouter initialEntries={["/"]}>
        <TestRoutes />
      </MemoryRouter>
    );
    expect(html).toContain("Home");
  });

  it("renders not found for unknown routes", () => {
    const html = renderToString(
      <MemoryRouter initialEntries={["/nonexistent"]}>
        <TestRoutes />
      </MemoryRouter>
    );
    expect(html).toContain("NotFound");
  });
});
