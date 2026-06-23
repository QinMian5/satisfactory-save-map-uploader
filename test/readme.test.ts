// abstract: Documentation guardrails for user-facing README files.
// out_of_scope: Markdown rendering, release asset availability, and external link checks.

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const userReadmes = ["README.md", "docs/readme/README.zh-CN.md"] as const;

async function readMarkdown(path: string) {
  return readFile(path, "utf8");
}

function collectPnpmScripts(markdown: string) {
  return [...markdown.matchAll(/`pnpm run ([^`\s]+)`/g)].map((match) => match[1]);
}

describe("user-facing README files", () => {
  it("do not use metadata front matter", async () => {
    for (const path of userReadmes) {
      const markdown = await readMarkdown(path);

      expect(markdown).not.toMatch(/^---\r?\n/);
      expect(markdown).not.toContain("abstract:");
      expect(markdown).not.toContain("out_of_scope:");
    }
  });

  it("link between the English and Chinese versions", async () => {
    const english = await readMarkdown("README.md");
    const chinese = await readMarkdown("docs/readme/README.zh-CN.md");

    expect(english).toContain("[简体中文](docs/readme/README.zh-CN.md)");
    expect(chinese).toContain("[English](../../README.md)");
  });

  it("keeps manual validation out of user README files", async () => {
    for (const path of userReadmes) {
      const markdown = await readMarkdown(path);

      expect(markdown).not.toContain("Manual Validation");
      expect(markdown).not.toContain("manual-acceptance");
      expect(markdown).not.toContain("人工验收");
    }
  });

  it("shows repository status without social or vanity badges", async () => {
    const english = await readMarkdown("README.md");

    expect(english).toContain("actions/workflows/ci.yml/badge.svg");
    expect(english).toContain("actions/workflows/release.yml/badge.svg");
    expect(english).toContain("LICENSE");
    expect(english).toContain("Windows");
    expect(english).not.toContain("github/stars");
    expect(english).not.toContain("github/forks");
    expect(english).not.toContain("twitter");
  });

  it("documents only package scripts that exist", async () => {
    const packageJson = JSON.parse(await readMarkdown("package.json"));
    const documentedScripts = new Set<string>();

    for (const path of userReadmes) {
      for (const script of collectPnpmScripts(await readMarkdown(path))) {
        documentedScripts.add(script);
      }
    }

    expect(documentedScripts).toEqual(
      new Set(["dev", "check", "package", "make:installer", "make:portable"]),
    );

    for (const script of documentedScripts) {
      expect(packageJson.scripts).toHaveProperty(script);
    }
  });
});
