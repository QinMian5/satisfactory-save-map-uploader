// abstract: Electron Forge packaging, maker, Vite, ASAR, and fuse configuration.
// out_of_scope: Runtime Electron window behavior, CI release orchestration, and Store identities.

import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig } from "@electron-forge/shared-types";
import { APP_METADATA } from "./config/app-metadata.js";

const config: ForgeConfig = {
  hooks: {
    async readPackageJson(_forgeConfig, packageJson) {
      return {
        ...packageJson,
        type: "commonjs",
      };
    },
  },
  packagerConfig: {
    asar: true,
    executableName: APP_METADATA.squirrelName,
    appBundleId: APP_METADATA.appId,
    win32metadata: {
      CompanyName: APP_METADATA.author,
      FileDescription: APP_METADATA.description,
      OriginalFilename: `${APP_METADATA.squirrelName}.exe`,
      ProductName: APP_METADATA.productName,
      InternalName: APP_METADATA.squirrelName,
    },
  },
  makers: [
    new MakerSquirrel({
      name: APP_METADATA.squirrelName,
      setupExe: APP_METADATA.setupExe,
      authors: APP_METADATA.author,
      description: APP_METADATA.description,
      noMsi: true,
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/main/app.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/main/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
