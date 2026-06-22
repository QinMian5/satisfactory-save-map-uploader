// abstract: Tests for packaged local Electron/CDP integration-test configuration validation.
// out_of_scope: Real Electron BrowserWindow execution and HTTP fixture server behavior.

import { mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseIntegrationUploadConfig } from "../src/main/integration-test-upload.js";

async function createFixtureRoot(): Promise<string> {
  const root = path.join(tmpdir(), `satisfactory-integration-config-${process.pid}-${Date.now()}`);
  await mkdir(root, { recursive: true });
  return realpath(root);
}

describe("integration upload config", () => {
  it("accepts only absolute test files and result files inside the declared temp root", async () => {
    const root = await createFixtureRoot();
    const savePath = path.join(root, "synthetic.sav");
    const resultPath = path.join(root, "result.json");
    await writeFile(savePath, "SAFE_LOCAL_SYNTHETIC_SAV_TEST", "utf8");

    const config = await parseIntegrationUploadConfig([
      "--integration-test-upload",
      `--integration-root=${root}`,
      "--integration-url=http://127.0.0.1:49152/fixture?token=abc12345",
      `--integration-save=${savePath}`,
      `--integration-result=${resultPath}`,
      "--integration-token=abc12345",
    ]);

    expect(config).toMatchObject({
      root,
      targetUrl: "http://127.0.0.1:49152/fixture?token=abc12345",
      savePath,
      resultPath,
      token: "abc12345",
    });
    await rm(root, { recursive: true, force: true });
  });

  it("rejects non-loopback, credentialed, mismatched-token, relative, and escaping inputs", async () => {
    const root = await createFixtureRoot();
    const savePath = path.join(root, "synthetic.sav");
    const resultPath = path.join(root, "result.json");
    await writeFile(savePath, "SAFE_LOCAL_SYNTHETIC_SAV_TEST", "utf8");

    const base = [
      "--integration-test-upload",
      `--integration-root=${root}`,
      "--integration-url=http://127.0.0.1:49152/fixture?token=abc12345",
      `--integration-save=${savePath}`,
      `--integration-result=${resultPath}`,
      "--integration-token=abc12345",
    ];

    await expect(
      parseIntegrationUploadConfig(
        base.map((arg) =>
          arg.startsWith("--integration-url=")
            ? "--integration-url=https://satisfactory-calculator.com/zh/interactive-map?token=abc12345"
            : arg,
        ),
      ),
    ).rejects.toThrow("Integration URL must use http.");

    await expect(
      parseIntegrationUploadConfig(
        base.map((arg) =>
          arg.startsWith("--integration-url=")
            ? "--integration-url=http://user:pass@127.0.0.1:49152/fixture?token=abc12345"
            : arg,
        ),
      ),
    ).rejects.toThrow("Integration URL must not include credentials.");

    await expect(
      parseIntegrationUploadConfig(
        base.map((arg) =>
          arg.startsWith("--integration-url=")
            ? "--integration-url=http://localhost:49152/fixture?token=abc12345"
            : arg,
        ),
      ),
    ).rejects.toThrow("Integration URL host must be 127.0.0.1.");

    await expect(
      parseIntegrationUploadConfig(
        base.map((arg) =>
          arg.startsWith("--integration-url=")
            ? "--integration-url=http://127.0.0.1:49152/fixture?token=wrong"
            : arg,
        ),
      ),
    ).rejects.toThrow("Integration URL token does not match.");

    await expect(
      parseIntegrationUploadConfig(
        base.map((arg) =>
          arg.startsWith("--integration-save=") ? "--integration-save=foo.sav" : arg,
        ),
      ),
    ).rejects.toThrow("Integration path must be absolute.");

    await expect(
      parseIntegrationUploadConfig(
        base.map((arg) =>
          arg.startsWith("--integration-result=")
            ? `--integration-result=${path.join(root, "..", "escaped.json")}`
            : arg,
        ),
      ),
    ).rejects.toThrow("Integration path must stay under the integration root.");

    await rm(root, { recursive: true, force: true });
  });
});
