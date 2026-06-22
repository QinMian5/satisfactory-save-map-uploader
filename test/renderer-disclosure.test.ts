// abstract: Static tests for first-run disclosure UI copy and controls.
// out_of_scope: Browser layout, Electron IPC execution, and visual regression testing.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function readRendererText(): Promise<string> {
  const files = await collectFiles("src/renderer");
  const text = await Promise.all(
    files
      .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"))
      .map((file) => readFile(file, "utf8")),
  );
  return text.join("\n");
}

async function collectFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(root, entry.name);
      return entry.isDirectory() ? collectFiles(fullPath) : [fullPath];
    }),
  );
  return files.flat();
}

describe("renderer disclosure UI", () => {
  it("contains explicit third-party upload authorization copy and choices", async () => {
    const renderer = await readRendererText();

    expect(renderer).toContain("Allow uploads");
    expect(renderer).toContain("Not now, exit");
    expect(renderer).toContain("Allow uploads again");
    expect(renderer).toContain("Disable uploads");
    expect(renderer).toContain("https://satisfactory-calculator.com/zh/interactive-map");
    expect(renderer).toContain("file contents");
    expect(renderer).toContain("IP address");
    expect(renderer).toMatch(/not\s+affiliated/i);
  });

  it("does not claim saves stay local or are only processed locally", async () => {
    const renderer = await readRendererText();

    expect(renderer).not.toMatch(/only processed locally/i);
    expect(renderer).not.toMatch(/stay local/i);
    expect(renderer).not.toMatch(/never sends? .*third[- ]party/i);
  });

  it("keeps diagnostic fields out of the primary dashboard copy", async () => {
    const renderer = await readRendererText();

    expect(renderer).toContain("Latest save");
    expect(renderer).toContain("Permission");
    expect(renderer).toContain("Start watching");
    expect(renderer).toContain("Pause watching");
    expect(renderer).toContain("Upload latest save");
    expect(renderer).not.toContain("StatusCard");
    expect(renderer).not.toContain("Waiting for new saves");
    expect(renderer).not.toContain("Watcher stopped");
    expect(renderer).not.toContain("Last map update");
    expect(renderer).not.toContain("Upload now");
    expect(renderer).not.toContain("Troubleshooting details");
    expect(renderer).not.toContain("Activity log");
    expect(renderer).not.toContain("Privacy & permissions");
    expect(renderer).not.toContain("This app can provide selected save files");
    expect(renderer).not.toContain("Open map");
    expect(renderer).not.toContain("Updates one Satisfactory Calculator map session.");
    expect(renderer).not.toContain("The save directory has not been checked yet.");
    expect(renderer).not.toContain("Upload a save to update the map.");
    expect(renderer).not.toContain("Open troubleshooting details");
    expect(renderer).not.toContain("Upload status");
    expect(renderer).not.toContain("Upload started");
    expect(renderer).not.toContain("Upload finished");
    expect(renderer).not.toContain("Last result");
    expect(renderer).not.toContain("Privacy status");
    expect(renderer).not.toContain("Permission storage");
  });

  it("keeps the dashboard header to a single title", async () => {
    const dashboard = await readFile("src/renderer/views/dashboard-view.tsx", "utf8");

    expect(dashboard).toContain("Map watcher");
    expect(dashboard).not.toContain("app-kicker");
    expect(dashboard).not.toContain("Satisfactory Save Map Watcher");
  });
});
