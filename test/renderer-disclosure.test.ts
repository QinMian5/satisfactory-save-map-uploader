// abstract: Static tests for first-run disclosure UI copy and controls.
// out_of_scope: Browser layout, Electron IPC execution, and visual regression testing.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RENDERER_LANGUAGE_COPY } from "../src/renderer/i18n.js";
import { getMapUrlForLanguage } from "../src/shared/language.js";

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
    expect(renderer).toContain("Disable uploads");
    expect(renderer).toContain('getMapUrlForLanguage("zh-CN")');
    expect(RENDERER_LANGUAGE_COPY["zh-CN"].consent.warningDescription).toContain(
      getMapUrlForLanguage("zh-CN"),
    );
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

    expect(renderer).toContain("Currently opened save");
    expect(renderer).toContain("Start automatic upload");
    expect(renderer).toContain("Pause watching");
    expect(renderer).toContain("Upload latest save");
    expect(renderer).toContain("Scan the save folder and upload new saves automatically.");
    expect(renderer).toContain("Stop automatic monitoring. Manual uploads remain available.");
    expect(renderer).toContain("Upload the newest detected save to update the map once.");
    expect(renderer).toContain("Stops future uploads and exits the app.");
    expect(renderer).toContain("@radix-ui/react-tooltip");
    expect(renderer).not.toContain("StatusCard");
    expect(renderer).not.toContain("PanelDisclosure");
    expect(renderer).not.toContain("Waiting for new saves");
    expect(renderer).not.toContain("Watcher stopped");
    expect(renderer).not.toContain("Last map update");
    expect(renderer).not.toContain("Latest save");
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
    expect(renderer).not.toContain("Upload permission is revoked");
    expect(renderer).not.toContain("Allow uploads again");
  });

  it("keeps the dashboard header to a single title", async () => {
    const [dashboard, i18n] = await Promise.all([
      readFile("src/renderer/views/dashboard-view.tsx", "utf8"),
      readFile("src/renderer/i18n.ts", "utf8"),
    ]);

    expect(dashboard).toContain("copy.dashboard.title");
    expect(i18n).toContain("Map watcher");
    expect(dashboard.match(/<CommandTooltip/g)?.length).toBe(4);
    expect(dashboard).not.toContain("Permission");
    expect(dashboard).not.toContain("app-kicker");
    expect(dashboard).not.toContain("Satisfactory Save Map Watcher");
  });

  it("places disable uploads below the current save summary", async () => {
    const dashboard = await readFile("src/renderer/views/dashboard-view.tsx", "utf8");
    const commandSectionStart = dashboard.indexOf("aria-label={copy.dashboard.commandsLabel}");
    const currentSaveSummary = dashboard.indexOf(
      "<SummaryCard label={copy.dashboard.currentSaveLabel}",
    );
    const disableDialog = dashboard.indexOf("<AlertDialog>");

    expect(commandSectionStart).toBeGreaterThan(-1);
    expect(currentSaveSummary).toBeGreaterThan(commandSectionStart);
    expect(disableDialog).toBeGreaterThan(currentSaveSummary);
    expect(dashboard.slice(commandSectionStart, currentSaveSummary)).not.toContain(
      "copy.dashboard.disable",
    );
  });

  it("keeps the disable confirmation inside the left toolbar", async () => {
    const [dashboard, css] = await Promise.all([
      readFile("src/renderer/views/dashboard-view.tsx", "utf8"),
      readFile("src/renderer/styles.css", "utf8"),
    ]);

    expect(css).toContain("--layout-sidebar-width: 300px;");
    expect(dashboard).toContain("w-[var(--layout-sidebar-width)]");
    expect(dashboard).toContain("left-4");
    expect(dashboard).toContain("w-[calc(var(--layout-sidebar-width)_-_32px)]");
    expect(dashboard).toContain("translate-x-0");
  });

  it("makes disabling uploads revoke permission and exit the app", async () => {
    const [dashboard, hook, i18n] = await Promise.all([
      readFile("src/renderer/views/dashboard-view.tsx", "utf8"),
      readFile("src/renderer/hooks/use-satisfactory-app.ts", "utf8"),
      readFile("src/renderer/i18n.ts", "utf8"),
    ]);

    expect(i18n).toContain("Disable uploads and exit?");
    expect(i18n).toContain("This stops future uploads and exits the app.");
    expect(dashboard).toContain("commands.disableUploadsAndExit");
    expect(dashboard).toContain("<AlertDialogCancel>{copy.dashboard.cancel}</AlertDialogCancel>");
    expect(dashboard).toContain("copy.dashboard.confirm");
    expect(dashboard).not.toContain(">Disable uploads</AlertDialogAction>");
    expect(hook).toContain("disableUploadsAndExit");
    expect(hook.indexOf("await window.satisfactoryApp.revokeThirdPartyUpload()")).toBeLessThan(
      hook.indexOf("await window.satisfactoryApp.declineThirdPartyUpload()"),
    );
  });
});
