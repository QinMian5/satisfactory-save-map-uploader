// abstract: Satisfactory save root resolution and latest-save discovery.
// out_of_scope: File watching, browser upload automation, and save-file parsing.

import { readdir, stat } from "node:fs/promises";
import path from "node:path";

type Environment = {
  LOCALAPPDATA?: string;
};

type SaveCandidate = {
  filePath: string;
  modifiedMs: number;
};

export function getDefaultSaveRoot(env: Environment = process.env): string {
  if (!env.LOCALAPPDATA) {
    throw new Error("LOCALAPPDATA is not set; cannot locate Satisfactory saves.");
  }

  return path.join(env.LOCALAPPDATA, "FactoryGame", "Saved", "SaveGames");
}

export async function findLatestSave(root: string): Promise<string | null> {
  const latest = await findLatestSaveCandidate(root);
  return latest?.filePath ?? null;
}

async function findLatestSaveCandidate(root: string): Promise<SaveCandidate | null> {
  const entries = await readdir(root, { withFileTypes: true });
  let latest: SaveCandidate | null = null;

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      const nestedLatest = await findLatestSaveCandidate(entryPath);
      latest = chooseLatest(latest, nestedLatest);
      continue;
    }

    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".sav") {
      continue;
    }

    const metadata = await stat(entryPath);
    latest = chooseLatest(latest, {
      filePath: entryPath,
      modifiedMs: metadata.mtimeMs,
    });
  }

  return latest;
}

function chooseLatest(
  current: SaveCandidate | null,
  candidate: SaveCandidate | null,
): SaveCandidate | null {
  if (!candidate) {
    return current;
  }

  if (!current || candidate.modifiedMs > current.modifiedMs) {
    return candidate;
  }

  return current;
}
