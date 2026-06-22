---
abstract: Microsoft Store distribution planning and validation checklist for packaged desktop builds.
out_of_scope: GitHub beta publishing, runtime watcher implementation, and commercial certificate purchasing.
---

# Store Distribution

## Planned Packaging Path

The planned Store path is:

1. Build the Electron app with Electron Forge package output.
2. Create an AppX/MSIX-family package from the unpacked app output.
3. Align package identity, signing, and metadata with Partner Center values.
4. Validate with the Windows App Certification Kit.
5. Submit through Partner Center when identity, metadata, and policy questions are resolved.

Microsoft Store distribution provides Store-managed signing for accepted MSIX/AppX packages. Store acceptance must still be validated before treating the package as publicly releasable. Store-managed signing does not provide a reusable certificate for GitHub Release or other Store-external distribution.

## Partner Center Fields

The following values come from Partner Center and must not be guessed in runtime code:

- Package/Identity/Name: `MianQin.SatisfactorySaveMapUploader`
- Package/Identity/Publisher: `CN=DCC117A3-6615-4987-B0AD-FF45756501E3`
- Package/Properties/PublisherDisplayName: `Mian Qin`
- Package Family Name: `MianQin.SatisfactorySaveMapUploader_xrv9fnatjde9j`
- Package SID: `S-1-15-2-906032442-619397748-1334772913-511471008-4167244459-819296471-2325134967`
- Partner Center Product ID / Store ID: `9PHQ2D03K6ZS`
- Store URL: `https://apps.microsoft.com/detail/9PHQ2D03K6ZS`
- Store protocol link: `ms-windows-store://pdp/?productid=9PHQ2D03K6ZS`
- MSA App ID: `3d9d611b-125c-4112-887d-598d626a311b`

Current application metadata lives in `config/app-metadata.ts`. AppX packaging identity values are also mirrored in `electron-builder.config.cjs` because electron-builder reads a CommonJS configuration file directly.

## Save Directory Validation

The Store/MSIX build must be tested against the original game save directory:

`%LOCALAPPDATA%\FactoryGame\Saved\SaveGames`

Validation matrix:

- AppX/MSIX package installed for a clean Windows user.
- `fs.existsSync` detects the save root.
- Recursive save discovery finds nested account/profile saves.
- `fs.watch` receives create and overwrite events.
- The uploader can upload the newest save after the user starts automatic upload.
- The uploader can upload after a later game save.

The implementation should use minimum permissions. Broad file access capabilities should not be added unless validation proves they are necessary.

## Store Review Risks

Before Store submission, confirm:

- Whether the app is considered a wrapper for a third-party website.
- Whether Satisfactory Calculator allows Electron embedding, automatic upload, and automation of its upload control.
- Whether explicit website-owner permission is needed.
- How the listing states that this is an unofficial third-party community tool.
- Whether loading and automating a third-party remote website meets Store policy.
