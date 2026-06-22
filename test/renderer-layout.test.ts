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

  it("keeps App as a thin React composition root", async () => {
    const app = await readFile("src/renderer/App.tsx", "utf8");

    expect(app).toContain("useSatisfactoryApp");
    expect(app).toContain("DashboardView");
    expect(app).toContain("ConsentView");
    expect(app).toContain("LockedView");
    expect(app).toContain("LoadingView");
    expect(app).not.toContain("window.satisfactoryApp");
    expect(app).not.toContain("window.confirm");
    expect(app).not.toContain("CARD_CLASS");
    expect(app).not.toContain("<details");
    expect(app).not.toContain("<summary");
  });

  it("keeps Electron IPC access in a renderer hook instead of presentational views", async () => {
    const hook = await readFile("src/renderer/hooks/use-satisfactory-app.ts", "utf8");
    const views = await Promise.all(
      ["dashboard-view.tsx", "consent-view.tsx", "locked-view.tsx", "loading-view.tsx"].map(
        (file) => readFile(path.join("src/renderer/views", file), "utf8"),
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
      "src/renderer/components/ui/scroll-area.tsx",
      "src/renderer/components/ui/separator.tsx",
    ]) {
      await expect(readFile(primitive, "utf8")).resolves.toBeTruthy();
    }

    expect(renderer).toContain("@radix-ui/react-alert-dialog");
    expect(renderer).toContain("@radix-ui/react-collapsible");
    expect(renderer).toContain("@radix-ui/react-scroll-area");
    expect(renderer).toContain("@radix-ui/react-separator");
    expect(renderer).not.toContain("<details");
    expect(renderer).not.toContain("<summary");
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
