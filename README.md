# Satisfactory Save Map Uploader

[English](README.md) | [简体中文](docs/readme/README.zh-CN.md)

[![CI](https://github.com/QinMian5/satisfactory-save-map-uploader/actions/workflows/ci.yml/badge.svg)](https://github.com/QinMian5/satisfactory-save-map-uploader/actions/workflows/ci.yml)
[![Release](https://github.com/QinMian5/satisfactory-save-map-uploader/actions/workflows/release.yml/badge.svg)](https://github.com/QinMian5/satisfactory-save-map-uploader/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Windows](https://img.shields.io/badge/platform-Windows-0078D4.svg)

Satisfactory Save Map Uploader is an unofficial Windows desktop app that uploads your selected Satisfactory `.sav` file to the Satisfactory Calculator interactive map and keeps the map open in the same window.

It is not affiliated with, endorsed by, or sponsored by Coffee Stain Studios, Coffee Stain Publishing, or Satisfactory Calculator.

## Download

Download the Windows build from [GitHub Releases](https://github.com/QinMian5/satisfactory-save-map-uploader/releases):

- `SatisfactorySaveMapUploader-Installer-<version>-x64.exe` installs the app with a guided Windows installer.
- `SatisfactorySaveMapUploader-Portable-<version>-x64.zip` runs after extracting the folder, without installing.

Unsigned beta builds can trigger Windows SmartScreen warnings.

## Features

- Starts with a first-run permission screen before it scans saves, starts watching, opens the map, or uploads a file.
- Uses the default Windows Satisfactory save directory.
- Uploads the newest save on demand.
- Can automatically upload new saves after you click **Start automatic upload**.
- Reuses one embedded Satisfactory Calculator map view.
- Supports English and Simplified Chinese app text, and opens the matching map language.
- Can open the current save folder from the app.

## Privacy

The app only runs locally, but uploads work by giving the selected `.sav` file to the third-party Satisfactory Calculator web page. That page can read the file contents and normal browser upload information.

The app developer does not receive or store save files and does not include analytics or telemetry. Only upload saves you are comfortable providing to that third-party page.

## Quick Start

1. Launch the app.
2. Choose your language if needed.
3. Click **Allow uploads** to grant permission.
4. Click **Upload latest save** for a one-time upload, or **Start automatic upload** to watch for new saves.
5. Use **Pause automatic upload** to stop automatic uploads without revoking permission.
6. Use **Disable uploads** to revoke permission and exit. The next launch returns to the permission screen.

## Troubleshooting

- If no save is found, open Satisfactory and create a save in the default local save directory.
- If the map does not update, try **Upload latest save** again after the Satisfactory Calculator page has loaded.
- If the website is offline or changes its upload UI, uploads can fail until the app is updated.
- If Windows blocks the app, verify the release artifact and checksum before choosing whether to run it.

## Development

Prerequisites: Node.js, pnpm through Corepack, and uv for installing git hooks.

```powershell
pnpm install
pnpm run dev
pnpm run check
pnpm run package
pnpm run make:installer
pnpm run make:portable
```

`pnpm run dev` starts the Electron development app. `pnpm run check` runs Biome, TypeScript, and Vitest. `pnpm run package` creates the unpacked Windows app. `pnpm run make:installer` and `pnpm run make:portable` create release artifacts under `out/make`.

More project details live in [the design spec](docs/specs/designs/save-map-uploader.md), [the release policy](docs/release-policy.md), [the privacy notice](PRIVACY.md), and [the security policy](SECURITY.md).

Contributions are welcome through issues and pull requests. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a larger change.

## License

MIT. See [LICENSE](LICENSE).
