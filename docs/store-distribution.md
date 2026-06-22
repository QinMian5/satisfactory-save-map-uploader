---
abstract: Microsoft Store distribution planning and validation checklist for packaged desktop builds.
out_of_scope: GitHub beta publishing, runtime watcher implementation, and commercial certificate purchasing.
---

# Store Distribution

## Planned Packaging Path

The planned Store path is:

1. Build the Electron app with Electron Forge package output.
2. Use Microsoft WinApp CLI to create an MSIX package.
3. Validate with the Windows App Certification Kit.
4. Submit through Partner Center when identity, metadata, and policy questions are resolved.

This path is not a guaranteed free signing solution. Store acceptance must be validated.

## Partner Center Fields

The following values must come from Partner Center and must not be guessed in runtime code:

- Publisher
- PublisherDisplayName
- Package Identity Name
- Package Family Name
- Partner Center Product ID

Current application metadata lives in `config/app-metadata.ts`. Store-only identity placeholders are centralized there until Partner Center provides final values.

## Save Directory Validation

The Store/MSIX build must be tested against the original game save directory:

`%LOCALAPPDATA%\FactoryGame\Saved\SaveGames`

Validation matrix:

- MSIX installed for a clean Windows user.
- `fs.existsSync` detects the save root.
- Recursive save discovery finds nested account/profile saves.
- `fs.watch` receives create and overwrite events.
- The watcher can upload the newest save after startup.
- The watcher can upload after a later game save.

The implementation should use minimum permissions. Broad file access capabilities should not be added unless validation proves they are necessary.

## Store Review Risks

Before Store submission, confirm:

- Whether the app is considered a wrapper for a third-party website.
- Whether Satisfactory Calculator allows Electron embedding, automatic upload, and automation of its upload control.
- Whether explicit website-owner permission is needed.
- How the listing states that this is an unofficial third-party community tool.
- Whether loading and automating a third-party remote website meets Store policy.
