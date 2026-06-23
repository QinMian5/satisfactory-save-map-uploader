// abstract: Static tests for the React/Tailwind renderer shell.
// out_of_scope: Browser rendering, Electron WebContentsView placement, and visual regression testing.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function readRendererText(): Promise<string> {
  const files = await collectFiles("src/renderer");
  const text = await Promise.all(
    files
      .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx") || file.endsWith(".css"))
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

describe("renderer React shell", () => {
  it("keeps HTML as a React mount shell without legacy control IDs", async () => {
    const html = await readFile("src/renderer/index.html", "utf8");

    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('<script type="module" src="/index.tsx"></script>');
    expect(
      html.match(
        /<body>\s*<div id="root"><\/div>\s*<script type="module" src="\/index.tsx"><\/script>\s*<\/body>/,
      ),
    ).toBeTruthy();
    expect(html).not.toContain("acceptConsentButton");
    expect(html).not.toContain("dashboardView");
    expect(html).not.toContain("uploadButton");
  });

  it("mounts the React app from the renderer entry", async () => {
    const entry = await readFile("src/renderer/index.tsx", "utf8");

    expect(entry).toContain("createRoot");
    expect(entry).toContain("<App />");
  });

  it("uses Tailwind as the renderer stylesheet entry", async () => {
    const css = await readFile("src/renderer/styles.css", "utf8");

    expect(css).toContain('@import "tailwindcss"');
    expect(css).toContain("@theme");
    expect(css).toContain("--color-background");
  });

  it("uses FICSIT Orange as the primary theme color without replacing semantic states", async () => {
    const css = await readFile("src/renderer/styles.css", "utf8");

    expect(css).toContain("--color-primary: #fa9549;");
    expect(css).toContain("--color-primary-foreground: #18211d;");
    expect(css).toContain("--color-primary-hover: #e77d23;");
    expect(css).toContain("--color-background: #f4f2ee;");
    expect(css).toContain("--color-destructive: #8f3128;");
    expect(css).toContain("--color-success: #2d6f40;");
  });

  it("keeps App as a thin React composition root", async () => {
    const app = await readFile("src/renderer/App.tsx", "utf8");

    expect(app).toContain("useSatisfactoryApp");
    expect(app).toContain("DashboardView");
    expect(app).toContain("ConsentView");
    expect(app).toContain("LoadingView");
    expect(app).not.toContain("LockedView");
    expect(app).not.toContain("getLockedViewModel");
    expect(app).not.toContain("window.satisfactoryApp");
    expect(app).not.toContain("window.confirm");
    expect(app).not.toContain("CARD_CLASS");
    expect(app).not.toContain("<details");
    expect(app).not.toContain("<summary");
  });

  it("keeps Electron IPC access in a renderer hook instead of presentational views", async () => {
    const hook = await readFile("src/renderer/hooks/use-satisfactory-app.ts", "utf8");
    const views = await Promise.all(
      ["dashboard-view.tsx", "consent-view.tsx", "loading-view.tsx"].map((file) =>
        readFile(path.join("src/renderer/views", file), "utf8"),
      ),
    );

    expect(hook).toContain("window.satisfactoryApp");
    for (const view of views) {
      expect(view).not.toContain("window.satisfactoryApp");
    }
  });

  it("uses shadcn-style primitives instead of native browser controls for app UI", async () => {
    const renderer = await readRendererText();

    for (const primitive of [
      "src/renderer/components/ui/card.tsx",
      "src/renderer/components/ui/alert.tsx",
      "src/renderer/components/ui/alert-dialog.tsx",
      "src/renderer/components/ui/collapsible.tsx",
      "src/renderer/components/ui/dropdown-menu.tsx",
      "src/renderer/components/ui/separator.tsx",
      "src/renderer/components/ui/tooltip.tsx",
    ]) {
      await expect(readFile(primitive, "utf8")).resolves.toBeTruthy();
    }

    expect(renderer).toContain("@radix-ui/react-alert-dialog");
    expect(renderer).toContain("@radix-ui/react-collapsible");
    expect(renderer).toContain("@radix-ui/react-dropdown-menu");
    expect(renderer).toContain("@radix-ui/react-separator");
    expect(renderer).toContain("@radix-ui/react-tooltip");
    expect(renderer).toContain("Globe");
    expect(renderer).not.toContain("Languages");
    expect(renderer).not.toContain("<details");
    expect(renderer).not.toContain("<summary");
    expect(renderer).not.toContain("<select");
  });

  it("exposes a localized dashboard command for opening the save folder", async () => {
    const dashboard = await readFile("src/renderer/views/dashboard-view.tsx", "utf8");
    const hook = await readFile("src/renderer/hooks/use-satisfactory-app.ts", "utf8");
    const [enCopy, zhCopy] = await Promise.all([
      readFile("src/renderer/i18n/en.ts", "utf8"),
      readFile("src/renderer/i18n/zh-cn.ts", "utf8"),
    ]);

    expect(dashboard).toContain("FolderOpen");
    expect(dashboard).toContain("openSaveFolder");
    expect(hook).toContain("openSaveFolder");
    expect(enCopy).toContain("Open save folder");
    expect(zhCopy).toContain("打开存档文件夹");
  });

  it("places the open save folder command above the current save summary", async () => {
    const dashboard = await readFile("src/renderer/views/dashboard-view.tsx", "utf8");
    const openSaveFolderButton = dashboard.indexOf("commands.openSaveFolder()");
    const currentSaveSummary = dashboard.indexOf(
      "<SummaryCard label={copy.dashboard.currentSaveLabel}",
    );

    expect(openSaveFolderButton).toBeGreaterThan(-1);
    expect(currentSaveSummary).toBeGreaterThan(openSaveFolderButton);
  });

  it("uses the sidebar column spacing instead of an extra dashboard button group", async () => {
    const dashboard = await readFile("src/renderer/views/dashboard-view.tsx", "utf8");
    const copy = await readFile("src/renderer/i18n/types.ts", "utf8");

    expect(dashboard).not.toContain("aria-label={copy.dashboard.commandsLabel}");
    expect(dashboard).not.toContain('className="flex flex-col gap-2"');
    expect(copy).not.toContain("commandsLabel");
  });

  it("syncs document language metadata from the selected app language", async () => {
    const app = await readFile("src/renderer/App.tsx", "utf8");

    expect(app).toContain("document.documentElement.lang = language");
    expect(app).toContain("document.title = copy.documentTitle");
  });

  it("uses a filled destructive button variant for dangerous actions", async () => {
    const button = await readFile("src/renderer/components/ui/button.tsx", "utf8");

    expect(button).toContain(
      'destructive:\n          "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90"',
    );
    expect(button).not.toContain('destructive:\n          "border-destructive-border bg-card');
  });

  it("keeps hard-coded color values in Tailwind theme tokens instead of JSX classes", async () => {
    const files = await collectFiles("src/renderer");
    const tsxFiles = files.filter((file) => file.endsWith(".tsx"));

    for (const file of tsxFiles) {
      const source = await readFile(file, "utf8");
      expect(source, file).not.toMatch(/\[#(?:[0-9a-fA-F]{3}){1,2}\]/);
    }
  });
});
