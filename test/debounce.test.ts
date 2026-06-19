// abstract: Tests for coalescing rapid events into a single async task run.
// out_of_scope: Filesystem watching, save discovery, and browser upload automation.

import { afterEach, describe, expect, it, vi } from "vitest";
import { createDebouncedAsyncTask } from "../src/debounce.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("createDebouncedAsyncTask", () => {
  it("runs once after rapid repeated scheduling", async () => {
    vi.useFakeTimers();
    const task = vi.fn().mockResolvedValue(undefined);
    const schedule = createDebouncedAsyncTask(task, 2_000);

    schedule();
    schedule();
    schedule();

    expect(task).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_999);
    expect(task).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(task).toHaveBeenCalledTimes(1);
  });

  it("runs with the latest task state at execution time", async () => {
    vi.useFakeTimers();
    let latestSave = "first.sav";
    const uploaded: string[] = [];
    const schedule = createDebouncedAsyncTask(async () => {
      uploaded.push(latestSave);
    }, 2_000);

    schedule();
    latestSave = "second.sav";
    schedule();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(uploaded).toEqual(["second.sav"]);
  });
});
