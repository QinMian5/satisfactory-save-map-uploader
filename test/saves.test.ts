// abstract: Tests for Satisfactory save root resolution and latest-save discovery.
// out_of_scope: File watching, browser upload automation, and game save parsing.

import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findLatestSave, getDefaultSaveRoot } from "../src/saves.js";

const tempRoots: string[] = [];

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "satisfactory-save-test-"));
  tempRoots.push(root);
  return root;
}

async function writeFileWithMtime(filePath: string, mtime: Date): Promise<void> {
  await writeFile(filePath, "save");
  await utimes(filePath, mtime, mtime);
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("getDefaultSaveRoot", () => {
  it("uses LOCALAPPDATA to build the Satisfactory save root", () => {
    const root = getDefaultSaveRoot({ LOCALAPPDATA: "C:\\Users\\Ada\\AppData\\Local" });

    expect(root).toBe("C:\\Users\\Ada\\AppData\\Local\\FactoryGame\\Saved\\SaveGames");
  });

  it("throws a clear error when LOCALAPPDATA is missing", () => {
    expect(() => getDefaultSaveRoot({})).toThrow("LOCALAPPDATA is not set");
  });
});

describe("findLatestSave", () => {
  it("recursively returns the most recently modified .sav file", async () => {
    const root = await createTempRoot();
    const nested = path.join(root, "account-a");
    await mkdir(nested, { recursive: true });
    const olderSave = path.join(root, "old.sav");
    const latestSave = path.join(nested, "latest.sav");
    await writeFileWithMtime(olderSave, new Date("2026-01-01T00:00:00.000Z"));
    await writeFileWithMtime(latestSave, new Date("2026-01-02T00:00:00.000Z"));

    await expect(findLatestSave(root)).resolves.toBe(latestSave);
  });

  it("ignores non-save files", async () => {
    const root = await createTempRoot();
    const save = path.join(root, "factory.sav");
    const text = path.join(root, "notes.txt");
    await writeFileWithMtime(save, new Date("2026-01-01T00:00:00.000Z"));
    await writeFileWithMtime(text, new Date("2026-01-03T00:00:00.000Z"));

    await expect(findLatestSave(root)).resolves.toBe(save);
  });

  it("ignores Satisfactory server manager metadata saves", async () => {
    const root = await createTempRoot();
    const save = path.join(root, "factory.sav");
    const serverManager = path.join(root, "ServerManager_V2.sav");
    await writeFileWithMtime(save, new Date("2026-01-01T00:00:00.000Z"));
    await writeFileWithMtime(serverManager, new Date("2026-01-03T00:00:00.000Z"));

    await expect(findLatestSave(root)).resolves.toBe(save);
  });

  it("returns null when no save files exist", async () => {
    const root = await createTempRoot();
    await writeFile(path.join(root, "notes.txt"), "not a save");

    await expect(findLatestSave(root)).resolves.toBeNull();
  });
});
