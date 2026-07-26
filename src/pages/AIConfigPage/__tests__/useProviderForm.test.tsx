/**
 * Tests for useProviderForm hook — focuses on the connection-test flow.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { useProviderForm } from "../hooks/useProviderForm";

// Capture the hook's return value via a tiny consumer component.
let captured!: ReturnType<typeof useProviderForm>;
function Probe() {
  captured = useProviderForm();
  return null;
}

// Mock store
vi.mock("@/stores/useAIConfigStore", () => ({
  useAIConfigStore: () => ({
    addProvider: vi.fn(),
    updateProvider: vi.fn(),
  }),
}));

// Mock the OpenAIProvider used inside the hook — vi.hoisted so the mock
// function exists when the hoisted vi.mock factory runs.
const { mockTestConnection } = vi.hoisted(() => ({
  mockTestConnection: vi.fn(),
}));
vi.mock("@/lib/ai/providers/openai", () => ({
  OpenAIProvider: class {
    testConnection = mockTestConnection;
  },
}));

let container: HTMLDivElement | null;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  vi.clearAllMocks();
});

afterEach(() => {
  if (container) {
    document.body.removeChild(container);
    container = null;
  }
});

function renderProbe() {
  const root = createRoot(container!);
  act(() => {
    root.render(<Probe />);
  });
  return root;
}

describe("useProviderForm — connection test", () => {
  it("is idle initially and Test is callable", () => {
    renderProbe();
    expect(captured.test.status).toBe("idle");
  });

  it("reports success when testConnection resolves ok", async () => {
    mockTestConnection.mockResolvedValue({ ok: true });
    renderProbe();

    // Fill required fields then open the form
    act(() => {
      captured.setForm({
        ...captured.form,
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test",
      });
    });

    await act(async () => {
      await captured.handleTest();
    });

    expect(mockTestConnection).toHaveBeenCalledTimes(1);
    expect(captured.test.status).toBe("success");
    expect(captured.test.error).toBeUndefined();
  });

  it("reports error with reason when testConnection resolves !ok", async () => {
    mockTestConnection.mockResolvedValue({
      ok: false,
      error: "Authentication failed (HTTP 401) — check the API key",
    });
    renderProbe();

    act(() => {
      captured.setForm({
        ...captured.form,
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-bad",
      });
    });

    await act(async () => {
      await captured.handleTest();
    });

    expect(captured.test.status).toBe("error");
    expect(captured.test.error).toMatch(/HTTP 401/);
  });

  it("short-circuits with a validation error when fields are missing", async () => {
    renderProbe();
    await act(async () => {
      await captured.handleTest();
    });

    expect(mockTestConnection).not.toHaveBeenCalled();
    expect(captured.test.status).toBe("error");
    expect(captured.test.error).toMatch(/required/i);
  });

  it("clears stale test status when the form changes", async () => {
    mockTestConnection.mockResolvedValue({ ok: true });
    renderProbe();

    act(() => {
      captured.setForm({
        ...captured.form,
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test",
      });
    });
    await act(async () => {
      await captured.handleTest();
    });
    expect(captured.test.status).toBe("success");

    // Change the form — status should reset to idle
    act(() => {
      captured.setForm({ ...captured.form, apiKey: "sk-changed" });
    });
    expect(captured.test.status).toBe("idle");
  });
});
