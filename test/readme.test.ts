// abstract: Documentation guardrails for user-facing README files.
// out_of_scope: Markdown rendering, release asset availability, and external link checks.

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const userReadmes = ["README.md", "docs/readme/README.zh-CN.md"] as const;
const publicMarkdownFiles = [
  ...userReadmes,
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  "PRIVACY.md",
  "SECURITY.md",
  "docs/manual-acceptance.md",
  "docs/release-policy.md",
  "docs/store-distribution.md",
] as const;

async function readMarkdown(path: string) {
  return readFile(path, "utf8");
}

function collectPnpmScripts(markdown: string) {
  return [...markdown.matchAll(/`pnpm run ([^`\s]+)`/g)].map((match) => match[1]);
}

describe("public documentation", () => {
  it("do not use metadata front matter", async () => {
    for (const path of publicMarkdownFiles) {
      const markdown = await readMarkdown(path);

      expect(markdown).not.toMatch(/^---\r?\n/);
      expect(markdown).not.toContain("abstract:");
      expect(markdown).not.toContain("out_of_scope:");
    }
  });

  it("uses current product naming in public documentation", async () => {
    for (const path of publicMarkdownFiles) {
      const markdown = await readMarkdown(path);

      expect(markdown).not.toContain("Satisfactory Save Map Watcher");
    }
  });

  it("describes the localized map site without hard-coding one language path", async () => {
    const privacy = await readMarkdown("PRIVACY.md");

    expect(privacy).toContain("https://satisfactory-calculator.com");
    expect(privacy).not.toContain("https://satisfactory-calculator.com/zh/interactive-map");
    expect(privacy).not.toContain("https://satisfactory-calculator.com/en/interactive-map");
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

  it("uses current automatic upload labels in manual acceptance steps", async () => {
    const manualAcceptance = await readMarkdown("docs/manual-acceptance.md");

    expect(manualAcceptance).toContain("Start automatic upload");
    expect(manualAcceptance).toContain("Pause automatic upload");
    expect(manualAcceptance).not.toMatch(/\bwatcher\b/i);
    expect(manualAcceptance).not.toMatch(/Click Start(?! automatic upload)/);
    expect(manualAcceptance).not.toMatch(/Click Stop\b/);
  });

  it("provides the minimum contribution templates for public collaboration", async () => {
    const contributing = await readMarkdown("CONTRIBUTING.md");
    const codeOfConduct = await readMarkdown("CODE_OF_CONDUCT.md");
    const pullRequestTemplate = await readMarkdown(".github/PULL_REQUEST_TEMPLATE.md");
    const bugReportTemplate = await readMarkdown(".github/ISSUE_TEMPLATE/bug_report.yml");
    const featureRequestTemplate = await readMarkdown(".github/ISSUE_TEMPLATE/feature_request.yml");

    expect(contributing).toContain("pnpm run check");
    expect(contributing).toContain("type(scope): summary");
    expect(contributing).toContain("Do not attach real save files");
    expect(codeOfConduct).toContain("maintainer");
    expect(pullRequestTemplate).toContain("pnpm run check");
    expect(pullRequestTemplate).toContain("Privacy or upload behavior");
    expect(bugReportTemplate).toContain("Do not upload or attach real save files");
    expect(featureRequestTemplate).toContain("Problem");
  });
});
