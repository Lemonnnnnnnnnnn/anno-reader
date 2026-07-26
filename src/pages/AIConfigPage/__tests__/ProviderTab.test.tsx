/**
 * Tests for ProviderTab UI — connection-test button and status display.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { ProviderTab } from "../ProviderTab";

// Mock store — starts empty so the Add form is the path we exercise.
const { mockAddProvider, mockUpdateProvider, mockTestConnection } = vi.hoisted(() => ({
  mockAddProvider: vi.fn(),
  mockUpdateProvider: vi.fn(),
  mockTestConnection: vi.fn(),
}));
vi.mock("@/stores/useAIConfigStore", () => ({
  useAIConfigStore: () => ({
    config: {
      providers: [],
      selectedProviderId: null,
    },
    addProvider: mockAddProvider,
    updateProvider: mockUpdateProvider,
    removeProvider: vi.fn(),
    setSelectedProvider: vi.fn(),
  }),
}));

// Mock the OpenAIProvider so no real network call happens.
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
  mockTestConnection.mockResolvedValue({ ok: true });
});

afterEach(() => {
  if (container) {
    document.body.removeChild(container);
    container = null;
  }
});

function render() {
  const root = createRoot(container!);
  act(() => {
    root.render(<ProviderTab />);
  });
  return root;
}

/** Query a button whose text content matches the given label. */
function findButton(label: RegExp | string) {
  const buttons = Array.from(container!.querySelectorAll("button"));
  const matcher =
    typeof label === "string"
      ? (txt: string) => txt === label
      : (txt: string) => label.test(txt);
  return buttons.find((b) => matcher(b.textContent?.trim() ?? "")) ?? null;
}

/** Click a button via React's event delegation (works with createRoot). */
function click(el: Element) {
  el.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true }),
  );
}

/** Set an input value through React's synthetic event path. */
function setType(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("ProviderTab — connection test button", () => {
  it("renders a Test button when the Add form is open", () => {
    render();

    const addBtn = findButton("Add Provider");
    expect(addBtn).not.toBeNull();
    act(() => {
      click(addBtn!);
    });

    // The Add form is now open — Test button should be present
    expect(findButton(/^Test$/)).not.toBeNull();
  });

  it("shows a success status when the connection succeeds", async () => {
    render();
    act(() => {
      click(findButton("Add Provider")!);
    });

    // Fill in the API key so Test is enabled (baseUrl has a default)
    const apiKeyInput = container!.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    act(() => {
      setType(apiKeyInput, "sk-test");
    });

    await act(async () => {
      click(findButton(/^Test$/)!);
    });

    expect(mockTestConnection).toHaveBeenCalledTimes(1);
    // Success message should be rendered
    expect(container!.textContent).toMatch(/Connected/i);
    expect(container!.textContent).toMatch(/valid/i);
  });

  it("shows a failure status with the provider's error reason", async () => {
    mockTestConnection.mockResolvedValue({
      ok: false,
      error: "Authentication failed (HTTP 401) — check the API key",
    });
    render();
    act(() => {
      click(findButton("Add Provider")!);
    });

    const apiKeyInput = container!.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    act(() => {
      setType(apiKeyInput, "sk-bad");
    });

    await act(async () => {
      click(findButton(/^Test$/)!);
    });

    expect(container!.textContent).toMatch(/HTTP 401/);
    expect(container!.textContent).toMatch(/API key/i);
  });
});
