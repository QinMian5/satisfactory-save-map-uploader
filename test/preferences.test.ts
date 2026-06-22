// abstract: Tests for user preferences persistence and safe defaults.
// out_of_scope: Electron app paths, renderer UI, and upload authorization orchestration.

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_USER_PREFERENCES, PreferencesService } from "../src/services/preferences.js";

const tempRoots: string[] = [];

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "satisfactory-prefs-test-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("PreferencesService", () => {
  it("uses safe defaults when preferences do not exist", async () => {
    const service = new PreferencesService(await createTempRoot());

    await expect(service.load()).resolves.toEqual({
      preferences: DEFAULT_USER_PREFERENCES,
      warning: null,
    });
  });

  it("loads a valid accepted disclosure configuration", async () => {
    const root = await createTempRoot();
    const service = new PreferencesService(root);
    await service.save({
      schemaVersion: 1,
      thirdPartyUploadDisclosureVersion: 1,
      autoStartWatcher: true,
      acceptedAt: "2026-06-20T00:00:00.000Z",
    });

    await expect(service.load()).resolves.toEqual({
      preferences: {
        schemaVersion: 1,
        thirdPartyUploadDisclosureVersion: 1,
        autoStartWatcher: true,
        acceptedAt: "2026-06-20T00:00:00.000Z",
      },
      warning: null,
    });
  });

  it("keeps an old disclosure version readable so authorization can reject it", async () => {
    const root = await createTempRoot();
    const service = new PreferencesService(root);
    await service.save({
      schemaVersion: 1,
      thirdPartyUploadDisclosureVersion: 0,
      autoStartWatcher: true,
      acceptedAt: "2026-06-20T00:00:00.000Z",
    });

    const result = await service.load();

    expect(result.preferences.thirdPartyUploadDisclosureVersion).toBe(0);
    expect(result.preferences.autoStartWatcher).toBe(true);
  });

  it("falls back to safe defaults for invalid JSON and field types", async () => {
    const invalidJsonRoot = await createTempRoot();
    const invalidJsonService = new PreferencesService(invalidJsonRoot, {
      readFile: vi.fn().mockResolvedValue("{not json"),
    });

    await expect(invalidJsonService.load()).resolves.toMatchObject({
      preferences: DEFAULT_USER_PREFERENCES,
      warning: expect.stringContaining("Invalid preferences"),
    });

    const invalidShapeService = new PreferencesService(await createTempRoot(), {
      readFile: vi.fn().mockResolvedValue(
        JSON.stringify({
          schemaVersion: 1,
          thirdPartyUploadDisclosureVersion: "1",
          autoStartWatcher: "yes",
        }),
      ),
    });

    await expect(invalidShapeService.load()).resolves.toMatchObject({
      preferences: DEFAULT_USER_PREFERENCES,
      warning: expect.stringContaining("Invalid preferences"),
    });
  });

  it("writes normalized UTF-8 preferences through a temporary file and rename", async () => {
    const root = await createTempRoot();
    const writes: string[] = [];
    const renames: string[] = [];
    const service = new PreferencesService(root, {
      writeFile: async (filePath, contents, encoding) => {
        writes.push(`${path.basename(filePath)}:${encoding}:${contents.includes("extra")}`);
      },
      rename: async (from, to) => {
        renames.push(`${path.basename(from)}->${path.basename(to)}`);
      },
    });

    await service.save({
      schemaVersion: 1,
      thirdPartyUploadDisclosureVersion: 1,
      autoStartWatcher: true,
      acceptedAt: null,
      extra: "ignored",
    } as never);

    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain("utf8:false");
    expect(renames).toEqual([
      expect.stringMatching(/^preferences\.json\.\d+\..*\.tmp->preferences\.json$/),
    ]);
  });

  it("reports write failures without creating an authorized configuration", async () => {
    const service = new PreferencesService(await createTempRoot(), {
      writeFile: vi.fn().mockRejectedValue(new Error("disk full")),
    });

    await expect(
      service.save({
        schemaVersion: 1,
        thirdPartyUploadDisclosureVersion: 1,
        autoStartWatcher: true,
        acceptedAt: null,
      }),
    ).rejects.toThrow("Could not save preferences");
  });

  it("uses the configured directory instead of the repository or working directory", async () => {
    const root = await createTempRoot();
    const service = new PreferencesService(root);

    await service.save({
      schemaVersion: 1,
      thirdPartyUploadDisclosureVersion: null,
      autoStartWatcher: false,
      acceptedAt: null,
    });

    const saved = await readFile(path.join(root, "preferences.json"), "utf8");
    expect(saved).toContain('"schemaVersion": 1');
  });
});
