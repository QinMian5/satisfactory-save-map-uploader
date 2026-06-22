// abstract: Tests for durable third-party upload revocation marker persistence.
// out_of_scope: Runtime consent orchestration, renderer UI, and Electron windows.

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { RevocationMarkerService } from "../src/services/revocation-marker.js";

async function createTempRoot(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "satisfactory-revocation-test-"));
}

describe("RevocationMarkerService", () => {
  it("treats a missing marker as absent and accepted preferences may still be considered", async () => {
    const root = await createTempRoot();
    const service = new RevocationMarkerService(root);

    await expect(service.load()).resolves.toMatchObject({
      status: "absent",
      revoked: false,
      warning: null,
    });

    await rm(root, { recursive: true, force: true });
  });

  it("writes a minimal valid marker atomically and reads it as revoked", async () => {
    const root = await createTempRoot();
    const service = new RevocationMarkerService(root, {
      now: () => new Date("2026-06-20T00:00:00.000Z"),
    });

    await service.markRevoked();

    const marker = await service.load();
    expect(marker).toMatchObject({ status: "present", revoked: true, warning: null });
    await expect(readFile(service.filePath, "utf8")).resolves.toContain('"schemaVersion": 1');

    await rm(root, { recursive: true, force: true });
  });

  it("uses an unauthorized safe default for damaged marker contents", async () => {
    const root = await createTempRoot();
    const service = new RevocationMarkerService(root);
    await writeFile(service.filePath, "{not-json", "utf8");

    await expect(service.load()).resolves.toMatchObject({
      status: "unsafe",
      revoked: true,
      warning: expect.stringContaining("Invalid revocation marker"),
    });

    await rm(root, { recursive: true, force: true });
  });

  it("uses an unauthorized safe default when marker state cannot be read", async () => {
    const service = new RevocationMarkerService("C:\\Temp\\Satisfactory", {
      readFile: vi.fn().mockRejectedValue(new Error("permission denied")),
    });

    await expect(service.load()).resolves.toMatchObject({
      status: "unsafe",
      revoked: true,
      warning: expect.stringContaining("Could not read revocation marker"),
    });
  });

  it("cleans temporary marker files when atomic rename fails", async () => {
    const root = await createTempRoot();
    const written: string[] = [];
    const removed: string[] = [];
    const service = new RevocationMarkerService(root, {
      writeFile: vi.fn(async (filePath) => {
        written.push(filePath);
      }),
      rename: vi.fn().mockRejectedValue(new Error("rename failed")),
      rm: vi.fn(async (filePath) => {
        removed.push(filePath);
      }),
    });

    await expect(service.markRevoked()).rejects.toThrow("Could not save revocation marker");

    expect(written).toHaveLength(1);
    expect(removed).toEqual(written);
    await rm(root, { recursive: true, force: true });
  });

  it("removes and confirms the marker before reporting accept persistence success", async () => {
    const root = await createTempRoot();
    const service = new RevocationMarkerService(root);
    await service.markRevoked();

    await service.clearAndConfirmAbsent();

    await expect(service.load()).resolves.toMatchObject({ status: "absent", revoked: false });
    await rm(root, { recursive: true, force: true });
  });

  it("reports a failed marker delete as an accept-blocking error", async () => {
    const service = new RevocationMarkerService("C:\\Temp\\Satisfactory", {
      rm: vi.fn().mockRejectedValue(new Error("locked")),
    });

    await expect(service.clearAndConfirmAbsent()).rejects.toThrow(
      "Could not clear revocation marker",
    );
  });
});
