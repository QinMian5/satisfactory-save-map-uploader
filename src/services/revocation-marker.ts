// abstract: Durable third-party upload revocation marker persistence with safe defaults.
// out_of_scope: Preferences JSON storage, renderer state, and upload authorization decisions.

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type RevocationMarkerStatus = "absent" | "present" | "unsafe";

export type RevocationMarkerLoadResult = {
  status: RevocationMarkerStatus;
  revoked: boolean;
  warning: string | null;
};

export type RevocationMarkerFileSystem = {
  readFile?: (filePath: string, encoding: "utf8") => Promise<string>;
  writeFile?: (filePath: string, contents: string, encoding: "utf8") => Promise<void>;
  rename?: (from: string, to: string) => Promise<void>;
  mkdir?: (dirPath: string, options: { recursive: true }) => Promise<unknown>;
  rm?: (filePath: string, options: { force: true }) => Promise<void>;
};

type RevocationMarker = {
  schemaVersion: 1;
  revoked: true;
  createdAt: string;
};

export const REVOCATION_MARKER_FILE_NAME = "third-party-upload.revoked";

export class RevocationMarkerService {
  readonly filePath: string;
  private readonly userDataPath: string;
  private readonly fs: Required<RevocationMarkerFileSystem>;
  private readonly now: () => Date;

  constructor(
    userDataPath: string,
    fileSystem: RevocationMarkerFileSystem & { now?: () => Date } = {},
  ) {
    this.userDataPath = userDataPath;
    this.filePath = path.join(userDataPath, REVOCATION_MARKER_FILE_NAME);
    this.fs = {
      readFile: fileSystem.readFile ?? readFile,
      writeFile: fileSystem.writeFile ?? writeFile,
      rename: fileSystem.rename ?? rename,
      mkdir: fileSystem.mkdir ?? mkdir,
      rm: fileSystem.rm ?? rm,
    };
    this.now = fileSystem.now ?? (() => new Date());
  }

  async load(): Promise<RevocationMarkerLoadResult> {
    let contents: string;
    try {
      contents = await this.fs.readFile(this.filePath, "utf8");
    } catch (error) {
      if (isMissingFileError(error)) {
        return { status: "absent", revoked: false, warning: null };
      }
      return {
        status: "unsafe",
        revoked: true,
        warning: `Could not read revocation marker; using unauthorized safe default. ${errorMessage(error)}`,
      };
    }

    try {
      parseMarker(JSON.parse(contents));
      return { status: "present", revoked: true, warning: null };
    } catch (error) {
      return {
        status: "unsafe",
        revoked: true,
        warning: `Invalid revocation marker; using unauthorized safe default. ${errorMessage(error)}`,
      };
    }
  }

  async markRevoked(): Promise<void> {
    const tempPath = path.join(
      this.userDataPath,
      `${REVOCATION_MARKER_FILE_NAME}.${process.pid}.${Date.now()}.tmp`,
    );
    const marker: RevocationMarker = {
      schemaVersion: 1,
      revoked: true,
      createdAt: this.now().toISOString(),
    };

    try {
      await this.fs.mkdir(this.userDataPath, { recursive: true });
      await this.fs.writeFile(tempPath, `${JSON.stringify(marker, null, 2)}\n`, "utf8");
      await this.fs.rename(tempPath, this.filePath);
    } catch (error) {
      await this.fs.rm(tempPath, { force: true }).catch(() => undefined);
      throw new Error(`Could not save revocation marker: ${errorMessage(error)}`);
    }
  }

  async clearAndConfirmAbsent(): Promise<void> {
    try {
      await this.fs.rm(this.filePath, { force: true });
      const result = await this.load();
      if (result.status !== "absent") {
        throw new Error(result.warning ?? "Revocation marker is still present.");
      }
    } catch (error) {
      throw new Error(`Could not clear revocation marker: ${errorMessage(error)}`);
    }
  }
}

function parseMarker(value: unknown): RevocationMarker {
  if (!isObject(value)) {
    throw new Error("Revocation marker must be an object.");
  }
  if (value.schemaVersion !== 1) {
    throw new Error("Unsupported revocation marker schema version.");
  }
  if (value.revoked !== true) {
    throw new Error("Revocation marker must set revoked true.");
  }
  if (typeof value.createdAt !== "string") {
    throw new Error("Revocation marker timestamp is invalid.");
  }
  return value as RevocationMarker;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingFileError(error: unknown): boolean {
  return isObject(error) && error.code === "ENOENT";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
