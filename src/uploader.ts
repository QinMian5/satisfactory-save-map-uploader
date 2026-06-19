// abstract: Playwright browser lifecycle and save-file upload automation for the interactive map.
// out_of_scope: Save discovery, filesystem watching, and third-party API reverse engineering.

import {
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  chromium,
  type FileChooser,
  type LaunchOptions,
  type Page,
} from "playwright";

const MAP_URL = "https://satisfactory-calculator.com/zh/interactive-map";
const SAVE_FILE_INPUT_SELECTOR = "#saveGameFileInput";
const UPLOAD_PANEL_SELECTOR = "#dropSaveGame";
const UPLOAD_PROMPT = /点击|拖拽|Click|Drag|upload|save/i;
const CONTROL_TIMEOUT_MS = 10_000;
const MAP_LOAD_TIMEOUT_MS = 60_000;

export function getBrowserLaunchOptions(): LaunchOptions {
  return {
    headless: false,
    args: ["--start-maximized"],
  };
}

export function getBrowserContextOptions(): BrowserContextOptions {
  return {
    viewport: null,
  };
}

export class MapUploader {
  private browser: Browser | undefined;
  private context: BrowserContext | undefined;
  private page: Page | undefined;

  async upload(savePath: string): Promise<void> {
    const page = await this.getPage();
    await page.goto(MAP_URL, { waitUntil: "load", timeout: MAP_LOAD_TIMEOUT_MS });

    if (await this.tryFileInputUpload(page, savePath)) {
      console.log(`Uploaded save: ${savePath}`);
      return;
    }

    if (await this.tryFileChooserUpload(page, savePath)) {
      console.log(`Uploaded save: ${savePath}`);
      return;
    }

    throw new Error(
      "Could not find the map save upload control; the page structure may have changed.",
    );
  }

  async close(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();
    this.page = undefined;
    this.context = undefined;
    this.browser = undefined;
  }

  private async getPage(): Promise<Page> {
    if (!this.browser) {
      this.browser = await chromium.launch(getBrowserLaunchOptions());
    }

    if (!this.context) {
      this.context = await this.browser.newContext(getBrowserContextOptions());
    }

    if (!this.page || this.page.isClosed()) {
      this.page = await this.context.newPage();
    }

    return this.page;
  }

  private async tryFileInputUpload(page: Page, savePath: string): Promise<boolean> {
    const input = page.locator(SAVE_FILE_INPUT_SELECTOR);

    try {
      await input.waitFor({ state: "attached", timeout: CONTROL_TIMEOUT_MS });
      await page.locator(UPLOAD_PANEL_SELECTOR).waitFor({
        state: "visible",
        timeout: CONTROL_TIMEOUT_MS,
      });
    } catch {
      return false;
    }

    const readyPromise = this.waitForMapReady(page, savePath);
    await input.setInputFiles(savePath, { timeout: CONTROL_TIMEOUT_MS });
    await readyPromise;
    return true;
  }

  private async tryFileChooserUpload(page: Page, savePath: string): Promise<boolean> {
    const uploadTarget = page.getByText(UPLOAD_PROMPT).first();
    let chooser: FileChooser;

    try {
      await page.locator(UPLOAD_PANEL_SELECTOR).waitFor({
        state: "visible",
        timeout: CONTROL_TIMEOUT_MS,
      });
      const chooserPromise = page.waitForEvent("filechooser", { timeout: CONTROL_TIMEOUT_MS });
      await uploadTarget.click({ timeout: CONTROL_TIMEOUT_MS });
      chooser = await chooserPromise;
    } catch {
      return false;
    }

    const readyPromise = this.waitForMapReady(page, savePath);
    await chooser.setFiles(savePath);
    await readyPromise;
    return true;
  }

  private async waitForMapReady(page: Page, savePath: string): Promise<void> {
    try {
      await page.locator(UPLOAD_PANEL_SELECTOR).waitFor({
        state: "hidden",
        timeout: MAP_LOAD_TIMEOUT_MS,
      });
    } catch (error) {
      throw new Error(`Selected save file, but the map did not finish loading: ${savePath}`, {
        cause: error,
      });
    }
  }
}
