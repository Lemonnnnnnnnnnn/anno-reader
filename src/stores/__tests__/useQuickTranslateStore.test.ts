/**
 * Tests for the quick-translate status store.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useQuickTranslateStore } from "../useQuickTranslateStore";

beforeEach(() => {
  useQuickTranslateStore.setState({ status: "idle", runId: 0 });
});

describe("useQuickTranslateStore", () => {
  it("claims the chip on begin and returns the new run id", () => {
    const first = useQuickTranslateStore.getState().begin();
    expect(first).toBe(1);
    expect(useQuickTranslateStore.getState().status).toBe("translating");

    const second = useQuickTranslateStore.getState().begin();
    expect(second).toBe(2);
    expect(useQuickTranslateStore.getState().runId).toBe(2);
  });

  it("applies the outcome of the current run", () => {
    const runId = useQuickTranslateStore.getState().begin();

    useQuickTranslateStore.getState().settle(runId, "saved");
    expect(useQuickTranslateStore.getState().status).toBe("saved");

    useQuickTranslateStore.getState().dismiss(runId);
    expect(useQuickTranslateStore.getState().status).toBe("idle");
  });

  it("ignores stale runs", () => {
    const staleRunId = useQuickTranslateStore.getState().begin();
    useQuickTranslateStore.getState().begin(); // newer run takes over the chip

    useQuickTranslateStore.getState().settle(staleRunId, "error");
    expect(useQuickTranslateStore.getState().status).toBe("translating");

    useQuickTranslateStore.getState().dismiss(staleRunId);
    expect(useQuickTranslateStore.getState().status).toBe("translating");
  });
});
