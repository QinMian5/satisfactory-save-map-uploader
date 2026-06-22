// abstract: User preference JSON persistence with schema validation and safe defaults.
// out_of_scope: Electron app path selection, renderer state, and upload authorization decisions.

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type UserPreferences = {
  schemaVersion: 1;
  thirdPartyUploadDisclosureVersion: number | null;
  autoStartWatcher: boolean;
  acceptedAt: string | null;
};

export type PreferencesLoadResult = {
  preferences: UserPreferences;
  warning: string | null;
};

export type PreferencesFileSystem = {
  readFile?: (filePath: string, encoding: "utf8") => Promise<string>;
  writeFile?: (filePath: string, contents: string, encoding: "utf8") => Promise<void>;
  rename?: (from: string, to: string) => Promise<void>;
  mkdir?: (dirPath: string, options: { recursive: true }) => Promise<unknown>;
  rm?: (filePath: string, options: { force: true }) => Promise<void>;
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  schemaVersion: 1,
  thirdPartyUploadDisclosureVersion: null,
  autoStartWatcher: false,
  acceptedAt: null,
};

const PREFERENCES_FILE_NAME = "preferences.json";

export class PreferencesService {
  readonly filePath: string;
  private readonly userDataPath: string;
  private readonly fs: Required<PreferencesFileSystem>;

  constructor(userDataPath: string, fileSystem: PreferencesFileSystem = {}) {
    this.userDataPath = userDataPath;
    this.filePath = path.join(userDataPath, PREFERENCES_FILE_NAME);
    this.fs = {
      readFile: fileSystem.readFile ?? readFile,
      writeFile: fileSystem.writeFile ?? writeFile,
      rename: fileSystem.rename ?? rename,
      mkdir: fileSystem.mkdir ?? mkdir,
      rm: fileSystem.rm ?? rm,
    };
  }

  async load(): Promise<PreferencesLoadResult> {
    let contents: string;
    try {
      contents = await this.fs.readFile(this.filePath, "utf8");
    } catch (error) {
      if (isMissingFileError(error)) {
        return { preferences: clonePreferences(DEFAULT_USER_PREFERENCES), warning: null };
      }
      return {
        preferences: clonePreferences(DEFAULT_USER_PREFERENCES),
        warning: `Could not read preferences; using safe defaults. ${errorMessage(error)}`,
      };
    }

    try {
      return {
        preferences: parsePreferences(JSON.parse(contents)),
        warning: null,
      };
    } catch (error) {
      return {
        preferences: clonePreferences(DEFAULT_USER_PREFERENCES),
        warning: `Invalid preferences; using safe defaults. ${errorMessage(error)}`,
      };
    }
  }

  async save(preferences: UserPreferences): Promise<void> {
    const normalized = normalizePreferences(preferences);
    const tempPath = path.join(
      this.userDataPath,
      `${PREFERENCES_FILE_NAME}.${process.pid}.${Date.now()}.tmp`,
    );
    const contents = `${JSON.stringify(normalized, null, 2)}\n`;

    try {
      await this.fs.mkdir(this.userDataPath, { recursive: true });
      await this.fs.writeFile(tempPath, contents, "utf8");
      await this.fs.rename(tempPath, this.filePath);
    } catch (error) {
      await this.fs.rm(tempPath, { force: true }).catch(() => undefined);
      throw new Error(`Could not save preferences: ${errorMessage(error)}`);
    }
  }
}

function parsePreferences(value: unknown): UserPreferences {
  if (!isObject(value)) {
    throw new Error("Preferences must be an object.");
  }
  if (value.schemaVersion !== 1) {
    throw new Error("Unsupported preferences schema version.");
  }
  if (
    value.thirdPartyUploadDisclosureVersion !== null &&
    !isNonNegativeInteger(value.thirdPartyUploadDisclosureVersion)
  ) {
    throw new Error("Invalid disclosure version.");
  }
  if (typeof value.autoStartWatcher !== "boolean") {
    throw new Error("Invalid auto-start preference.");
  }
  if (value.acceptedAt !== null && typeof value.acceptedAt !== "string") {
    throw new Error("Invalid accepted timestamp.");
  }

  return normalizePreferences(value as UserPreferences);
}

function normalizePreferences(preferences: UserPreferences): UserPreferences {
  return {
    schemaVersion: 1,
    thirdPartyUploadDisclosureVersion: preferences.thirdPartyUploadDisclosureVersion,
    autoStartWatcher: preferences.autoStartWatcher,
    acceptedAt: preferences.acceptedAt,
  };
}

function clonePreferences(preferences: UserPreferences): UserPreferences {
  return { ...preferences };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 0;
}

function isMissingFileError(error: unknown): boolean {
  return isObject(error) && error.code === "ENOENT";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
